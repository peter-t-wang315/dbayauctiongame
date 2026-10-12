// Pure room reducer (05 sections 7-12). No clock, no randomness, no platform APIs: `now`, seeds and
// secret hashes are passed in. A rejected event returns the SAME state object and only error effects.
import {
  engine,
  type EngineAction,
  type GameEvent,
  type Mode,
} from '@dbay/engine';
import {
  BID_WINDOW_OPTIONS,
  LENGTH_OPTIONS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PROTOCOL_VERSION,
  type ClientAction,
  type ErrorCode,
  type PlayerId,
  type ServerMsg,
} from '@dbay/protocol';
import type { Deadline, Effect, ReduceResult, RoomEvent, RoomPlayer, RoomState } from './types';
import { hash32, secretsMatch } from './util';
import { view } from './view';

export const SCHEMA_VERSION = 1;

const MIN = 60 * 1000;
export const LOBBY_TTL_MS = 60 * MIN;
export const GAME_TTL_MS = 120 * MIN;
export const POSTGAME_TTL_MS = 30 * MIN;
export const ALL_DISCONNECTED_TTL_MS = 10 * MIN;
export const HOST_MIGRATION_MS = 30 * 1000;
export const BOT_DELAY_MIN_MS = 800;
export const BOT_DELAY_MAX_MS = 2000;
const LOG_KEEP = 200;
const MAX_TICK_STEPS = 5000;
const BOT_NAMES = ['Bot Billy', 'Bot Betty', 'Bot Bob', 'Bot Bea', 'Bot Bart'];
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const HOST_ONLY = new Set(['start', 'setOpts', 'addBot', 'rmBot', 'kick', 'rematch']);

export function createRoom(code: string, now: number): RoomState {
  return {
    meta: {
      code,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      expireAt: now + LOBBY_TTL_MS,
      baseExpireAt: now + LOBBY_TTL_MS,
      hostId: null,
      phase: 'lobby',
      opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000, length: 'standard' },
      banned: [],
      updatedAt: now,
    },
    players: [],
    game: null,
    log: [],
    deadlines: [{ at: now + LOBBY_TTL_MS, kind: 'expire' }],
    rev: 0,
  };
}

/**
 * Effects for a connection that addressed a room that does not exist (or whose state was deleted
 * on expiry): the wrapper calls this when it has no stored state. WS3b answers `hello`/`join`.
 */
export function roomNotFound(conn: string): Effect[] {
  return [{ type: 'send', to: { conn }, msg: { t: 'err', code: 'ROOM_NOT_FOUND' } }];
}

/** True when a stored state can be run by this build (wrapper ends the room otherwise). */
export function isCompatible(state: { meta?: { schemaVersion?: number } }): boolean {
  return state.meta?.schemaVersion === SCHEMA_VERSION;
}

// ---------------------------------------------------------------- working draft

interface Draft {
  s: RoomState;
  now: number;
  /** Replies in order (acks/welcome before snapshots). */
  out: Effect[];
  extra: Effect[];
  changed: boolean;
  /** Bump `rev` (anything that alters a view). */
  bump: boolean;
  /** Send fresh snapshots to everyone connected. */
  snaps: boolean;
  /** For join/hello: this connection receives its snapshot directly. */
  newConn?: { conn: string; playerId: PlayerId };
  /** Players that must not receive a snapshot (kicked). */
  skip: Set<PlayerId>;
  closed: boolean;
  /** Human-readable event tag for the log effect. */
  tag: string;
}

type SendTo = Extract<Effect, { type: 'send' }>['to'];
const send = (d: Draft, to: SendTo, msg: ServerMsg): void => {
  d.out.push({ type: 'send', to, msg });
};

const connErr = (d: Draft, conn: string, code: ErrorCode) =>
  send(d, { conn }, { t: 'err', code });

const humans = (s: RoomState) => s.players.filter((p) => !p.isBot);
const find = (s: RoomState, id: PlayerId): RoomPlayer | undefined =>
  s.players.find((p) => p.id === id);

function uniqueName(s: RoomState, raw: string, exceptId?: PlayerId): string {
  const base = raw.trim();
  const taken = new Set(s.players.filter((p) => p.id !== exceptId).map((p) => p.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = ` ${i}`;
    const cand = base.slice(0, 16 - suffix.length) + suffix;
    if (!taken.has(cand)) return cand;
  }
}

function validName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const n = raw.trim();
  if (n.length < 1 || n.length > 16 || CONTROL_CHARS.test(n)) return null;
  return n;
}

function pushLog(d: Draft, events: GameEvent[]): void {
  const s = d.s;
  for (const e of events) {
    s.meta.logN = (s.meta.logN ?? 0) + 1;
    s.log.push({ ...e, n: s.meta.logN });
  }
  if (s.log.length > LOG_KEEP) s.log.splice(0, s.log.length - LOG_KEEP);
}

const isBanned = (s: RoomState, playerId: PlayerId, secretHash: string | null): boolean =>
  s.meta.banned.some((b) => b === playerId || (secretHash !== null && secretsMatch(b, secretHash)));

function pickHost(s: RoomState, mustBeConnected: boolean): RoomPlayer | undefined {
  const cands = humans(s)
    .filter((p) => !mustBeConnected || p.connected)
    .sort((a, b) => a.joinedAt - b.joinedAt || a.seat - b.seat);
  return cands[0];
}

function migrateHost(d: Draft, preferConnected = true): void {
  const s = d.s;
  const next = pickHost(s, preferConnected);
  if (!next || next.id === s.meta.hostId) return;
  s.meta.hostId = next.id;
  if (s.game) pushLog(d, [{ kind: 'host', by: next.id }]);
  d.changed = d.bump = d.snaps = true;
}

// ---------------------------------------------------------------- engine glue

function enterReveal(d: Draft, t: number): void {
  const s = d.s;
  const g = s.game!;
  s.meta.phase = 'reveal';
  s.meta.baseExpireAt = t + POSTGAME_TTL_MS;
  s.meta.revealAt = t + engine.revealDelayMs(g);
}

/** Apply an engine action; on success commits the new engine state and logs. Returns the error code. */
function engApply(d: Draft, action: EngineAction, t: number): ErrorCode | null {
  const s = d.s;
  if (!s.game) return 'WRONG_PHASE';
  const r = engine.apply(s.game, action, t);
  if (!r.ok) return r.code;
  s.game = r.state;
  pushLog(d, r.events);
  if (s.game.stage === 'done' && s.meta.phase === 'playing') enterReveal(d, t);
  return null;
}

function markDisconnected(d: Draft, p: RoomPlayer, t: number): void {
  if (!p.connected || p.isBot) return;
  const s = d.s;
  p.connected = false;
  p.disconnectedAt = t;
  p.lastSeen = t;
  d.changed = d.bump = d.snaps = true;
  if (s.game && s.meta.phase === 'playing') {
    pushLog(d, [{ kind: 'left', by: p.id }]);
    engApply(d, { type: 'setConnected', player: p.id, connected: false }, t);
    // Auto-pass (05 section 8): a disconnected player's open Classic call is passed at once.
    const g = s.game;
    if (
      s.meta.phase === 'playing' &&
      g.mode === 'classic' &&
      g.stage === 'bidding' &&
      g.call?.player === p.id &&
      g.call.phase === 'window'
    ) {
      engApply(d, { type: 'pass', player: p.id }, t);
    }
  } else if (s.game) {
    pushLog(d, [{ kind: 'left', by: p.id }]);
  }
}

// ---------------------------------------------------------------- deadlines and expiry

function botDelay(s: RoomState, botId: string, t: number): number {
  const span = BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS + 1;
  return BOT_DELAY_MIN_MS + (hash32(`${s.meta.code}|${s.rev}|${botId}|${t}`) % span);
}

function recomputeExpiry(s: RoomState, t: number): void {
  const hs = humans(s);
  const allDown = hs.every((p) => !p.connected) && (hs.length > 0 || s.rev > 0);
  const base = s.meta.baseExpireAt ?? s.meta.expireAt;
  if (allDown) {
    s.meta.allDownAt ??= t;
    s.meta.expireAt = Math.min(base, s.meta.allDownAt + ALL_DISCONNECTED_TTL_MS);
  } else {
    delete s.meta.allDownAt;
    s.meta.expireAt = base;
  }
}

function rebuildDeadlines(s: RoomState, t: number): void {
  recomputeExpiry(s, t);
  const dl: Deadline[] = [{ at: s.meta.expireAt, kind: 'expire' }];
  const g = s.game;
  if (s.meta.phase === 'playing' && g) {
    const nd = engine.nextDeadline(g);
    if (nd !== null) dl.push({ at: nd, kind: 'engine' });
    // Bots: keep pending bot deadlines, add one for each bot that can act (or, in Frenzy, poll).
    for (const bot of s.players.filter((p) => p.isBot)) {
      const existing = s.deadlines.find((x) => x.kind === 'bot' && x.data === bot.id);
      if (existing) {
        dl.push(existing);
        continue;
      }
      const wants =
        engine.botAction(g, bot.id, t) !== null ||
        (g.mode === 'frenzy' && g.stage === 'bidding');
      if (wants) dl.push({ at: t + botDelay(s, bot.id, t), kind: 'bot', data: bot.id });
    }
  }
  if (s.meta.phase === 'reveal' && s.meta.revealAt !== undefined)
    dl.push({ at: s.meta.revealAt, kind: 'reveal' });
  const host = s.meta.hostId ? find(s, s.meta.hostId) : undefined;
  if (host && !host.isBot && !host.connected && host.disconnectedAt !== undefined)
    dl.push({ at: host.disconnectedAt + HOST_MIGRATION_MS, kind: 'hostCheck', data: host.id });
  dl.sort((a, b) => a.at - b.at || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  s.deadlines = dl;
}

function runTick(d: Draft, now: number): void {
  const s = d.s;
  for (let step = 0; step < MAX_TICK_STEPS; step++) {
    const due = s.deadlines[0];
    if (!due || due.at > now) break;
    s.deadlines = s.deadlines.slice(1);
    d.changed = d.bump = d.snaps = true;
    const t = due.at;
    switch (due.kind) {
      case 'expire': {
        for (const p of humans(s)) {
          d.extra.push({ type: 'closeSocket', playerId: p.id, why: 'expired' });
        }
        send(d, 'all', { t: 'closing', reason: 'expired' });
        d.extra.push({ type: 'deleteRoom' });
        s.meta.closed = true;
        s.deadlines = [];
        d.closed = true;
        d.snaps = false;
        return;
      }
      case 'engine':
        if (s.game && s.meta.phase === 'playing') {
          const r = engine.tick(s.game, t);
          s.game = r.state;
          pushLog(d, r.events);
          if (s.game.stage === 'done') enterReveal(d, t);
        }
        break;
      case 'bot': {
        const g = s.game;
        if (g && s.meta.phase === 'playing' && due.data) {
          const a = engine.botAction(g, due.data, t);
          if (a) engApply(d, a, t);
        }
        break;
      }
      case 'reveal':
        if (s.meta.phase === 'reveal') {
          s.meta.phase = 'ended';
          delete s.meta.revealAt;
        }
        break;
      case 'hostCheck': {
        const h = s.meta.hostId ? find(s, s.meta.hostId) : undefined;
        if (h && !h.connected) migrateHost(d);
        break;
      }
      default:
        break;
    }
    rebuildDeadlines(s, t);
  }
}

// ---------------------------------------------------------------- event handlers

function onJoin(d: Draft, e: Extract<RoomEvent, { type: 'join' }>): void {
  const s = d.s;
  if (s.meta.phase !== 'lobby') return connErr(d, e.conn, 'GAME_IN_PROGRESS');
  if (isBanned(s, e.playerId, e.secretHash)) return connErr(d, e.conn, 'BANNED');
  const name = validName(e.name);
  if (name === null) return connErr(d, e.conn, 'NAME_INVALID');
  if (s.players.length >= MAX_PLAYERS) return connErr(d, e.conn, 'ROOM_FULL');
  if (typeof e.secretHash !== 'string' || e.secretHash === '' || find(s, e.playerId))
    return connErr(d, e.conn, 'INTERNAL');
  const used = new Set(s.players.map((p) => p.seat));
  const seat = [0, 1, 2, 3, 4, 5].find((x) => !used.has(x)) ?? s.players.length;
  s.players.push({
    id: e.playerId,
    name: uniqueName(s, name),
    seat,
    isBot: false,
    secretHash: e.secretHash,
    connected: true,
    joinedAt: d.now,
    lastSeen: d.now,
    lastSeq: 0,
  });
  if (!s.meta.hostId || !find(s, s.meta.hostId) || find(s, s.meta.hostId)?.isBot)
    s.meta.hostId = e.playerId;
  send(d, { conn: e.conn }, {
    t: 'welcome',
    v: PROTOCOL_VERSION,
    playerId: e.playerId,
    secret: e.secret,
    code: s.meta.code,
  });
  d.newConn = { conn: e.conn, playerId: e.playerId };
  d.changed = d.bump = d.snaps = true;
}

function onHello(d: Draft, e: Extract<RoomEvent, { type: 'hello' }>): void {
  const s = d.s;
  const p = find(s, e.playerId);
  if (!p || p.isBot || p.secretHash === null) return connErr(d, e.conn, 'BAD_SECRET');
  if (isBanned(s, p.id, p.secretHash)) return connErr(d, e.conn, 'BANNED');
  if (!secretsMatch(p.secretHash, e.secretHash)) return connErr(d, e.conn, 'BAD_SECRET');
  const wasAway = !p.connected;
  p.connected = true;
  p.lastSeen = d.now;
  delete p.disconnectedAt;
  d.extra.push({ type: 'closeSocket', playerId: p.id, why: 'replaced', exceptConn: e.conn });
  send(d, { conn: e.conn }, {
    t: 'welcome',
    v: PROTOCOL_VERSION,
    playerId: p.id,
    code: s.meta.code,
  });
  if (wasAway && s.game) {
    pushLog(d, [{ kind: 'rejoined', by: p.id }]);
    if (s.meta.phase === 'playing')
      engApply(d, { type: 'setConnected', player: p.id, connected: true }, d.now);
  }
  d.newConn = { conn: e.conn, playerId: p.id };
  d.changed = d.bump = d.snaps = true;
}

function onLeave(d: Draft, playerId: PlayerId): void {
  const s = d.s;
  const p = find(s, playerId);
  if (!p || p.isBot) return;
  if (s.meta.phase === 'lobby') {
    s.players = s.players.filter((x) => x.id !== playerId);
    if (s.meta.hostId === playerId) {
      s.meta.hostId = null;
      const next = pickHost(s, true) ?? pickHost(s, false);
      if (next) s.meta.hostId = next.id;
    }
    d.changed = d.bump = d.snaps = true;
    return;
  }
  markDisconnected(d, p, d.now);
}

function reject(d: Draft, playerId: PlayerId, seq: number, code: ErrorCode): void {
  send(d, playerId, { t: 'ack', seq, ok: false, code });
}

function removePlayer(s: RoomState, id: PlayerId): void {
  s.players = s.players.filter((p) => p.id !== id);
}

function onAction(d: Draft, playerId: PlayerId, msg: ClientAction): void {
  const s = d.s;
  const p = find(s, playerId);
  if (!p || p.isBot) return;
  const seq = (msg as { seq?: unknown }).seq;
  if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1) {
    send(d, playerId, { t: 'err', code: 'BAD_MESSAGE' });
    return;
  }
  // Idempotent duplicate / stale retry (05 section 6.5): ack ok, never re-apply.
  if (seq <= p.lastSeq) {
    send(d, playerId, { t: 'ack', seq, ok: true });
    return;
  }
  const fail = (code: ErrorCode) => reject(d, playerId, seq, code);
  const phase = s.meta.phase;
  const kind = (msg as { t: string }).t;
  if (HOST_ONLY.has(kind) && s.meta.hostId !== playerId) return fail('NOT_HOST');

  const accept = (): void => {
    p.lastSeq = seq;
    d.changed = d.bump = d.snaps = true;
    // ack goes BEFORE the snapshots (they are appended last).
    d.out.unshift({ type: 'send', to: playerId, msg: { t: 'ack', seq, ok: true } });
  };

  switch (msg.t) {
    case 'rename': {
      if (phase !== 'lobby') return fail('WRONG_PHASE');
      const n = validName(msg.name);
      if (n === null) return fail('NAME_INVALID');
      p.name = uniqueName(s, n, p.id);
      return accept();
    }
    case 'setOpts': {
      if (phase !== 'lobby') return fail('WRONG_PHASE');
      const o = msg as {
        mode?: unknown;
        relaxed?: unknown;
        bidWindowMs?: unknown;
        length?: unknown;
      };
      if (o.mode !== undefined && o.mode !== 'classic' && o.mode !== 'frenzy')
        return fail('BAD_OPTS');
      if (o.relaxed !== undefined && typeof o.relaxed !== 'boolean') return fail('BAD_OPTS');
      if (
        o.bidWindowMs !== undefined &&
        !(BID_WINDOW_OPTIONS as readonly unknown[]).includes(o.bidWindowMs)
      )
        return fail('BAD_OPTS');
      if (o.length !== undefined && !(LENGTH_OPTIONS as readonly unknown[]).includes(o.length))
        return fail('BAD_OPTS');
      s.meta.opts = {
        mode: (o.mode as Mode | undefined) ?? s.meta.opts.mode,
        relaxed: (o.relaxed as boolean | undefined) ?? s.meta.opts.relaxed,
        bidWindowMs: (o.bidWindowMs as number | undefined) ?? s.meta.opts.bidWindowMs,
        length: (o.length as 'quick' | 'standard' | undefined) ?? s.meta.opts.length ?? 'standard',
      };
      return accept();
    }
    case 'addBot': {
      if (phase !== 'lobby') return fail('WRONG_PHASE');
      if (s.players.length >= MAX_PLAYERS) return fail('ROOM_FULL');
      const used = new Set(s.players.map((x) => x.seat));
      const seat = [0, 1, 2, 3, 4, 5].find((x) => !used.has(x)) ?? s.players.length;
      let n = 1;
      while (s.players.some((x) => x.id === `bot${n}`)) n++;
      const name =
        BOT_NAMES.find((x) => !s.players.some((y) => y.name === x)) ?? uniqueName(s, 'Bot');
      s.players.push({
        id: `bot${n}`,
        name,
        seat,
        isBot: true,
        secretHash: null,
        connected: true,
        joinedAt: d.now,
        lastSeen: d.now,
        lastSeq: 0,
      });
      return accept();
    }
    case 'rmBot': {
      if (phase !== 'lobby') return fail('WRONG_PHASE');
      const t = find(s, msg.playerId);
      if (!t || !t.isBot) return fail('BAD_MESSAGE');
      removePlayer(s, t.id);
      return accept();
    }
    case 'kick': {
      const t = find(s, msg.playerId);
      if (!t || t.isBot || t.id === playerId) return fail('BAD_MESSAGE');
      s.meta.banned.push(t.id);
      if (t.secretHash) s.meta.banned.push(t.secretHash);
      send(d, t.id, { t: 'kicked' });
      d.extra.push({ type: 'closeSocket', playerId: t.id, why: 'kicked' });
      d.skip.add(t.id);
      if (phase === 'lobby') removePlayer(s, t.id);
      else markDisconnected(d, t, d.now);
      return accept();
    }
    case 'start': {
      if (phase !== 'lobby') return fail('WRONG_PHASE');
      if (s.players.length < MIN_PLAYERS) return fail('NOT_ENOUGH_PLAYERS');
      if (!s.meta.seed) return fail('INTERNAL');
      const ordered = [...s.players].sort((a, b) => a.seat - b.seat);
      ordered.forEach((x, i) => (x.seat = i));
      s.players = ordered;
      const setup = engine.setup(
        {
          seed: s.meta.seed,
          mode: s.meta.opts.mode,
          bidWindowMs: s.meta.opts.bidWindowMs,
          relaxed: s.meta.opts.relaxed,
          length: s.meta.opts.length ?? 'standard',
          players: ordered.map((x) => ({ id: x.id, isBot: x.isBot, connected: x.connected })),
        },
        d.now,
      );
      delete s.meta.seed;
      s.game = setup.state;
      s.log = [];
      s.meta.logN = 0;
      s.meta.phase = 'playing';
      s.meta.baseExpireAt = d.now + GAME_TTL_MS;
      pushLog(d, setup.events);
      if (s.game.stage === 'done') enterReveal(d, d.now);
      return accept();
    }
    case 'rematch': {
      if (phase !== 'reveal' && phase !== 'ended') return fail('WRONG_PHASE');
      s.game = null;
      s.log = [];
      s.meta.logN = 0;
      s.meta.phase = 'lobby';
      s.meta.baseExpireAt = d.now + LOBBY_TTL_MS;
      delete s.meta.revealAt;
      delete s.meta.seed;
      return accept();
    }
    case 'bid':
    case 'pass':
    case 'gift':
    case 'giftGive': {
      if (phase !== 'playing') return fail('WRONG_PHASE');
      let action: EngineAction;
      if (msg.t === 'bid') {
        if (typeof msg.card !== 'string' || !Number.isInteger(msg.bay)) return fail('BAD_MESSAGE');
        action = { type: 'bid', player: playerId, card: msg.card, bay: msg.bay };
      } else if (msg.t === 'pass') action = { type: 'pass', player: playerId };
      else if (msg.t === 'gift') {
        if (typeof msg.target !== 'string') return fail('BAD_MESSAGE');
        action = { type: 'gift', player: playerId, target: msg.target };
      } else {
        if (typeof msg.item !== 'string') return fail('BAD_MESSAGE');
        action = { type: 'giftGive', player: playerId, item: msg.item };
      }
      const code = engApply(d, action, d.now);
      if (code) return fail(code);
      return accept();
    }
    default:
      return fail('BAD_MESSAGE');
  }
}

// ---------------------------------------------------------------- reduce

const snapMsg = (s: RoomState, pid: PlayerId, now: number): ServerMsg => ({
  t: 'snap',
  rev: s.rev,
  now,
  view: view(s, pid, now),
});

/**
 * Pure reducer: (state, event, now) -> { state, effects }. A rejected or no-op event returns the
 * same `state` reference. Effects are ordered: persist, setAlarm, log, then sends (acks and
 * welcome first, snapshots last), matching the wrapper order in 05 section 7.
 */
export function reduce(state: RoomState, event: RoomEvent, now: number): ReduceResult {
  const noop: ReduceResult = { state, effects: [] };
  if (state.meta.closed) {
    if (event.type === 'join' || event.type === 'hello')
      return { state, effects: roomNotFound(event.conn) };
    return noop;
  }
  const d: Draft = {
    s: structuredClone(state),
    now,
    out: [],
    extra: [],
    changed: false,
    bump: false,
    snaps: false,
    skip: new Set(),
    closed: false,
    tag: event.type,
  };

  switch (event.type) {
    case 'join':
      onJoin(d, event);
      break;
    case 'hello':
      onHello(d, event);
      break;
    case 'action':
      d.tag = `action:${(event.msg as { t?: string })?.t ?? '?'}`;
      onAction(d, event.playerId, event.msg);
      break;
    case 'leave':
      onLeave(d, event.playerId);
      break;
    case 'disconnect': {
      const p = find(d.s, event.playerId);
      if (p && !p.isBot) markDisconnected(d, p, now);
      break;
    }
    case 'snap': {
      if (find(state, event.playerId))
        return { state, effects: [{ type: 'send', to: event.playerId, msg: snapMsg(state, event.playerId, now) }] };
      return noop;
    }
    case 'seed':
      if (typeof event.seed === 'string' && event.seed !== '' && state.meta.phase === 'lobby') {
        d.s.meta.seed = event.seed;
        d.changed = true;
      }
      break;
    case 'tick':
      runTick(d, now);
      break;
    case 'connect':
    default:
      break;
  }

  if (!d.changed) return { state, effects: d.out };

  const s = d.s;
  if (d.closed) {
    s.rev += 1;
    return {
      state: s,
      effects: [{ type: 'setAlarm', at: null }, ...d.out, ...d.extra],
    };
  }
  s.meta.updatedAt = now;
  // Host gone for good (e.g. the only human left): hand over / reconsider.
  if (s.meta.hostId && !find(s, s.meta.hostId)) {
    s.meta.hostId = null;
    migrateHost(d, false);
  }
  if (d.bump) s.rev += 1;
  rebuildDeadlines(s, now);

  const effects: Effect[] = [
    { type: 'persist' },
    { type: 'setAlarm', at: s.deadlines[0]?.at ?? null },
    { type: 'log', entry: { room: s.meta.code, event: d.tag, rev: s.rev } },
    ...d.extra,
    ...d.out,
  ];
  if (d.snaps) {
    for (const p of humans(s)) {
      if (!p.connected || d.skip.has(p.id)) continue;
      const to = d.newConn && d.newConn.playerId === p.id ? { conn: d.newConn.conn } : p.id;
      effects.push({ type: 'send', to, msg: snapMsg(s, p.id, now) });
    }
  }
  return { state: s, effects };
}
