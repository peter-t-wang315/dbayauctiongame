// Scripted fake room for frontend development (WS0). It speaks the real protocol and plays a
// simplified game: lobby -> Classic or Frenzy bidding -> gift step -> reveal -> ended -> rematch.
// It is NOT the rules engine: closing odds, deck and values are fake. Dev only.
import { getPublicCard, publicPack } from '@dbay/content/public';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
  PROTOCOL_VERSION,
  type CategoryId,
  type ClientAction,
  type ClientMsg,
  type ErrorCode,
  type EventKind,
  type PlayerView,
  type ServerMsg,
} from '@dbay/protocol';

type Bid = { id: string; kind: 'value' | 'proxy'; value?: number };
type StackEntry = { by: string; card: Bid };
type LogEntry = PlayerView['log'][number];

interface MockPlayer {
  id: string;
  name: string;
  seat: number;
  isBot: boolean;
  secret: string;
  connected: boolean;
  hand: Bid[];
  won: string[];
  gifts: string[];
  lastSeq: number;
  cooldownUntil?: number;
  botNextAt?: number;
}

interface MockBay {
  idx: number;
  card: string | null;
  stack: StackEntry[];
  endsAt?: number;
  lastBidAt?: number;
}

export interface Outbox {
  /** Send to every live socket of one player. */
  toPlayer(playerId: string, msg: ServerMsg): void;
  /** Close a player's sockets. */
  close(playerId: string): void;
}

const BID_VALUES = [10, 25, 50, 75, 100, 125, 150, 200, 250, 300];
const SALES_PER_GAME = 8;
const BOT_NAMES = ['Bot Billy', 'Bot Betty', 'Bot Bob', 'Bot Bea', 'Bot Bart'];

function freshHand(): Bid[] {
  return [
    ...BID_VALUES.map((v): Bid => ({ id: `v${v}`, kind: 'value', value: v })),
    { id: 'p1', kind: 'proxy' },
    { id: 'p2', kind: 'proxy' },
  ];
}

/** Fake but stable actual value per card id (dev only). */
function fakeActual(card: string, est: number): number {
  const mult = [0.5, 1, 1, 1.5, 3][[...card].reduce((a, c) => a + c.charCodeAt(0), 0) % 5]!;
  return Math.round((est * mult) / 5) * 5;
}

function estOf(card: string): number {
  const c = getPublicCard(card);
  if (!c) return 0;
  return c.kind === 'item' ? c.estimatedValue : (c.fixedValue ?? 0);
}

export class MockRoom {
  phase: PlayerView['phase'] = 'lobby';
  stage: 'bidding' | 'gifts' = 'bidding';
  opts: PlayerView['opts'] = { mode: 'classic', relaxed: false, bidWindowMs: 5000 };
  players: MockPlayer[] = [];
  hostId = '';
  bays: MockBay[] = [];
  deck: string[] = [];
  turn: PlayerView['turn'];
  turnIdx = 0;
  round = { n: 0, of: 0, halfway: false, last: false };
  sales = 0;
  log: LogEntry[] = [];
  logN = 0;
  rev = 0;
  gift: (NonNullable<PlayerView['gift']> & { giftCard?: string }) | undefined;
  giftLog: NonNullable<PlayerView['reveal']>['giftLog'] = [];
  reveal: PlayerView['reveal'];
  revealEndsAt = 0;
  private nextId = 1;

  constructor(
    readonly code: string,
    private readonly out: Outbox,
    private readonly clock: () => number = Date.now,
  ) {}

  // ---------- connection-level messages ----------

  /** Returns the playerId bound to the socket, or null. */
  /** `reply` sends directly on the calling socket (used before it is bound to a player). */
  handle(boundPlayer: string | null, msg: ClientMsg, reply: (m: ServerMsg) => void): string | null {
    const now = this.clock();
    if (msg.t === 'join') return this.join(msg.name, reply);
    if (msg.t === 'hello') {
      const p = this.players.find((x) => x.id === msg.playerId);
      if (!p || p.isBot || p.secret !== msg.secret) {
        reply({ t: 'err', code: 'BAD_SECRET' });
        return null;
      }
      const wasAway = !p.connected;
      p.connected = true;
      this.out.toPlayer(p.id, {
        t: 'welcome',
        v: PROTOCOL_VERSION,
        playerId: p.id,
        code: this.code,
      });
      if (wasAway) this.event('rejoined', { by: p.id });
      this.broadcast();
      return p.id;
    }
    if (!boundPlayer) return null;
    if (msg.t === 'ping') {
      this.out.toPlayer(boundPlayer, { t: 'pong', c: msg.c, now });
      return boundPlayer;
    }
    if (msg.t === 'snap') {
      this.sendSnap(boundPlayer);
      return boundPlayer;
    }
    if (msg.t === 'leave') {
      if (this.phase === 'lobby') {
        // Leaving the lobby frees the seat (05 section 6.1).
        this.players = this.players.filter((p) => p.id !== boundPlayer);
        if (this.hostId === boundPlayer) this.hostId = this.players.find((p) => !p.isBot)?.id ?? '';
        this.broadcast();
      } else {
        this.disconnect(boundPlayer);
      }
      return null;
    }
    this.action(boundPlayer, msg, now);
    return boundPlayer;
  }

  disconnect(playerId: string) {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || !p.connected) return;
    p.connected = false;
    this.event('left', { by: p.id });
    if (this.hostId === p.id) {
      const next = this.players.find((x) => x.connected && !x.isBot);
      if (next) {
        this.hostId = next.id;
        this.event('host', { by: next.id });
      }
    }
    this.broadcast();
  }

  private join(rawName: string, reply: (m: ServerMsg) => void): string | null {
    const err: ErrorCode | null =
      this.phase !== 'lobby'
        ? 'GAME_IN_PROGRESS'
        : this.players.length >= MAX_PLAYERS
          ? 'ROOM_FULL'
          : null;
    if (err) {
      reply({ t: 'err', code: err });
      return null;
    }
    const p = this.addPlayer(this.uniqueName(rawName), false);
    reply({ t: 'welcome', v: PROTOCOL_VERSION, playerId: p.id, secret: p.secret, code: this.code });
    this.broadcast(); // the caller binds the socket and then sends this player's own snapshot
    return p.id;
  }

  private addPlayer(name: string, isBot: boolean): MockPlayer {
    const used = new Set(this.players.map((p) => p.seat));
    const seat = [0, 1, 2, 3, 4, 5].find((s) => !used.has(s))!;
    const p: MockPlayer = {
      id: `${isBot ? 'b' : 'p'}${this.nextId++}`,
      name,
      seat,
      isBot,
      secret: isBot ? '' : crypto.randomUUID(),
      connected: true,
      hand: freshHand(),
      won: [],
      gifts: [],
      lastSeq: 0,
    };
    this.players.push(p);
    if (!this.hostId && !isBot) this.hostId = p.id;
    return p;
  }

  private uniqueName(name: string): string {
    let n = name;
    for (let i = 2; this.players.some((p) => p.name === n); i++) n = `${name.slice(0, 13)} ${i}`;
    return n;
  }

  // ---------- actions ----------

  private action(playerId: string, msg: ClientAction, now: number) {
    const p = this.players.find((x) => x.id === playerId)!;
    if (msg.seq <= p.lastSeq) return this.ack(playerId, msg.seq, null); // idempotent duplicate
    p.lastSeq = msg.seq;
    const err = this.apply(p, msg, now);
    this.ack(playerId, msg.seq, err);
    if (!err) this.broadcast();
  }

  private ack(playerId: string, seq: number, code: ErrorCode | null) {
    this.out.toPlayer(
      playerId,
      code ? { t: 'ack', seq, ok: false, code } : { t: 'ack', seq, ok: true },
    );
  }

  private apply(p: MockPlayer, msg: ClientAction, now: number): ErrorCode | null {
    const hostOnly = ['start', 'setOpts', 'addBot', 'rmBot', 'kick', 'rematch'];
    if (hostOnly.includes(msg.t) && p.id !== this.hostId) return 'NOT_HOST';
    switch (msg.t) {
      case 'rename':
        if (this.phase !== 'lobby') return 'WRONG_PHASE';
        p.name = this.uniqueName(msg.name);
        return null;
      case 'setOpts':
        if (this.phase !== 'lobby') return 'WRONG_PHASE';
        this.opts = {
          mode: msg.mode ?? this.opts.mode,
          relaxed: msg.relaxed ?? this.opts.relaxed,
          bidWindowMs: msg.bidWindowMs ?? this.opts.bidWindowMs,
        };
        return null;
      case 'addBot':
        if (this.phase !== 'lobby') return 'WRONG_PHASE';
        if (this.players.length >= MAX_PLAYERS) return 'ROOM_FULL';
        this.addPlayer(
          BOT_NAMES.find((n) => !this.players.some((x) => x.name === n)) ?? 'Bot',
          true,
        );
        return null;
      case 'rmBot':
      case 'kick': {
        if (this.phase !== 'lobby' && msg.t === 'rmBot') return 'WRONG_PHASE';
        const target = this.players.find((x) => x.id === msg.playerId);
        if (!target || target.id === p.id) return 'BAD_MESSAGE';
        this.players = this.players.filter((x) => x !== target);
        if (msg.t === 'kick') {
          this.out.toPlayer(target.id, { t: 'kicked' });
          this.out.close(target.id);
        }
        return null;
      }
      case 'start':
        if (this.phase !== 'lobby') return 'WRONG_PHASE';
        if (this.players.length < MIN_PLAYERS) return 'NOT_ENOUGH_PLAYERS';
        this.startGame(now);
        return null;
      case 'rematch':
        if (this.phase !== 'reveal' && this.phase !== 'ended') return 'WRONG_PHASE';
        this.toLobby();
        return null;
      case 'pass':
        if (this.phase !== 'playing' || this.stage !== 'bidding' || this.opts.mode !== 'classic')
          return 'WRONG_PHASE';
        if (this.turn?.player !== p.id || this.turn.phase !== 'window') return 'NOT_YOUR_TURN';
        this.event('pass', { by: p.id });
        this.endCall(now);
        return null;
      case 'bid':
        return this.bid(p, msg.card, msg.bay, now);
      case 'gift': {
        const g = this.gift;
        if (this.stage !== 'gifts' || !g || g.stage !== 'pickTarget') return 'WRONG_PHASE';
        if (g.holder !== p.id) return 'NOT_YOUR_TURN';
        const victim = this.players.find((x) => x.id === msg.target);
        if (!victim || victim.id === p.id || victim.won.length === 0) return 'BAD_MESSAGE';
        this.gift = {
          ...g,
          stage: 'pickItem',
          victim: victim.id,
          endsAt: now + this.scaled(15000),
        };
        return null;
      }
      case 'giftGive': {
        const g = this.gift;
        if (this.stage !== 'gifts' || !g || g.stage !== 'pickItem') return 'WRONG_PHASE';
        if (g.victim !== p.id) return 'NOT_YOUR_TURN';
        if (!p.won.includes(msg.item)) return 'BAD_MESSAGE';
        this.giveItem(p, msg.item, now);
        return null;
      }
    }
  }

  private bid(p: MockPlayer, cardId: string, bayIdx: number, now: number): ErrorCode | null {
    if (this.phase !== 'playing' || this.stage !== 'bidding') return 'WRONG_PHASE';
    const bay = this.bays[bayIdx];
    if (this.opts.mode === 'classic') {
      if (this.turn?.player !== p.id || this.turn.phase !== 'window') return 'NOT_YOUR_TURN';
      if (this.turn.endsAt !== undefined && now >= this.turn.endsAt) return 'TOO_LATE';
    } else {
      if (p.cooldownUntil && now < p.cooldownUntil) return 'COOLDOWN';
      if (bay?.endsAt !== undefined && now >= bay.endsAt) return 'TOO_LATE';
    }
    const card = p.hand.find((c) => c.id === cardId);
    if (!bay || !card || !this.isLegal(p.id, card, bay)) return 'ILLEGAL_BID';
    p.hand = p.hand.filter((c) => c !== card);
    const prevTop = this.top(bay);
    bay.stack.push({ by: p.id, card });
    bay.lastBidAt = now;
    this.event('bid', {
      by: p.id,
      card: bay.card ?? undefined,
      bay: bayIdx,
      amount: card.value ?? 'proxy',
    });
    if (prevTop && prevTop.by !== p.id) this.event('outbid', { by: prevTop.by, bay: bayIdx });
    if (this.opts.mode === 'frenzy') {
      p.cooldownUntil = now + 1000;
      const extended = Math.max(bay.endsAt ?? 0, now + this.scaled(3000));
      if (extended > (bay.endsAt ?? 0))
        this.event('extended', { bay: bayIdx, card: bay.card ?? undefined });
      bay.endsAt = extended;
    } else {
      this.endCall(now);
    }
    return null;
  }

  private top(bay: MockBay): StackEntry | null {
    const proxies = bay.stack.filter((s) => s.card.kind === 'proxy');
    if (proxies.length) return proxies[proxies.length - 1]!;
    return bay.stack.reduce<StackEntry | null>(
      (m, s) => (!m || (s.card.value ?? 0) > (m.card.value ?? 0) ? s : m),
      null,
    );
  }

  private isLegal(playerId: string, card: Bid, bay: MockBay): boolean {
    if (!bay.card) return false;
    const top = this.top(bay);
    if (!top) return true;
    if (top.by === playerId) return false;
    if (card.kind === 'proxy') return true;
    if (top.card.kind === 'proxy') return false;
    return (card.value ?? 0) > (top.card.value ?? 0);
  }

  // ---------- game flow ----------

  private scaled(ms: number) {
    return this.opts.relaxed ? Math.round(ms * 1.5) : ms;
  }

  private startGame(now: number) {
    this.phase = 'playing';
    this.stage = 'bidding';
    this.sales = 0;
    this.log = [];
    this.giftLog = [];
    this.reveal = undefined;
    for (const p of this.players)
      Object.assign(p, { hand: freshHand(), won: [], gifts: [], cooldownUntil: undefined });
    const ids = [...publicPack.items.map((i) => i.id), ...publicPack.specials.map((s) => s.id)];
    this.deck = Array.from({ length: SALES_PER_GAME + 6 }, (_, i) => ids[i % ids.length]!);
    const bayCount = this.players.length >= 5 ? 4 : 3;
    this.bays = Array.from({ length: bayCount }, (_, idx) => ({
      idx,
      card: this.deck.shift() ?? null,
      stack: [],
    }));
    this.round = { n: 1, of: SALES_PER_GAME, halfway: false, last: false };
    this.event('gameStart', {});
    if (this.opts.mode === 'frenzy') {
      this.event('frenzyStart', {});
      this.turn = undefined;
      this.bays.forEach((b) => (b.endsAt = now + this.scaled(12000 + b.idx * 2500)));
    } else {
      this.turnIdx = 0;
      this.startCall(now);
    }
  }

  private startCall(now: number) {
    const p = this.players[this.turnIdx % this.players.length]!;
    this.turn = {
      player: p.id,
      color: PLAYER_COLORS[p.seat]!.id,
      endsAt: now + this.scaled(this.opts.bidWindowMs),
      phase: 'window',
    };
    if (p.isBot) p.botNextAt = now + 900;
    this.event('turn', { by: p.id });
  }

  private endCall(now: number) {
    // Fake close roll: each bay with bids closes with 35% chance (the real rules are 01 R17).
    for (const bay of this.bays) {
      if (bay.stack.length && Math.random() < 0.35) this.sell(bay);
    }
    if (this.finishedBidding()) return this.toGifts(now);
    this.turnIdx++;
    this.turn = { player: this.turn!.player, color: this.turn!.color, phase: 'gap' };
    this.gapUntil = now + 1200;
  }
  private gapUntil = 0;

  private sell(bay: MockBay) {
    const top = this.top(bay)!;
    const winner = this.players.find((p) => p.id === top.by)!;
    for (const s of bay.stack) {
      if (s === top) continue;
      this.players.find((p) => p.id === s.by)?.hand.push(s.card);
    }
    const card = bay.card!;
    if (card.startsWith('special-gift')) winner.gifts.push(card);
    else winner.won.push(card);
    this.event('sold', { by: winner.id, card, bay: bay.idx, amount: top.card.value ?? 'proxy' });
    this.sales++;
    this.round = {
      ...this.round,
      n: Math.min(this.sales + 1, this.round.of),
      halfway: this.sales >= this.round.of / 2,
    };
    if (this.sales === Math.ceil(this.round.of / 2)) this.event('halfway', {});
    bay.stack = [];
    bay.card = this.deck.shift() ?? null;
    if (bay.card) this.event('refill', { bay: bay.idx, card: bay.card });
    if (this.opts.mode === 'frenzy')
      bay.endsAt = bay.card ? this.clock() + this.scaled(15000) : undefined;
    if (this.sales === this.round.of - 1) {
      this.round.last = true;
      this.event('lastRound', {});
    }
  }

  private finishedBidding() {
    return this.sales >= this.round.of || this.bays.every((b) => !b.card);
  }

  private toGifts(now: number) {
    this.turn = undefined;
    this.event('gameOver', {});
    this.stage = 'gifts';
    this.nextGift(now);
  }

  private nextGift(now: number) {
    const holder = this.players.find((p) => p.gifts.length > 0);
    if (!holder) return this.toReveal(now);
    const giftCard = holder.gifts.shift()!;
    this.gift = {
      stage: 'pickTarget',
      holder: holder.id,
      endsAt: now + this.scaled(15000),
      remaining: this.players.reduce((n, p) => n + p.gifts.length, 0),
      giftCard,
    };
    if (!this.players.some((p) => p.id !== holder.id && p.won.length)) {
      this.giftLog.push({ holder: holder.id, victim: holder.id, card: null });
      this.nextGift(now);
    }
  }

  private giveItem(victim: MockPlayer, item: string, now: number) {
    const holder = this.players.find((p) => p.id === this.gift!.holder)!;
    victim.won.splice(victim.won.indexOf(item), 1);
    holder.won.push(item);
    this.giftLog.push({ holder: holder.id, victim: victim.id, card: item });
    this.nextGift(now);
  }

  private toReveal(now: number) {
    this.stage = 'bidding';
    this.gift = undefined;
    this.phase = 'reveal';
    const rows = this.players.map((p) => {
      const items = p.won.map((card) => {
        const est = estOf(card);
        const actual = card.startsWith('special-display-case') ? 100 : fakeActual(card, est);
        const tag: 'steal' | 'ripped' | null =
          actual > est * 1.25 ? 'steal' : actual < est * 0.8 ? 'ripped' : null;
        return { card, est, actual, tag };
      });
      const counts = new Map<CategoryId, number>();
      for (const it of items) {
        const c = getPublicCard(it.card);
        if (c?.kind === 'item') counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
      }
      const collections = [...counts].filter(([, n]) => n >= 3).map(([c]) => c);
      const total = items.reduce((sum, it) => {
        const c = getPublicCard(it.card);
        return (
          sum + (c?.kind === 'item' && collections.includes(c.category) ? it.actual * 2 : it.actual)
        );
      }, 0);
      const displayCaseAssign = items
        .filter((it) => it.card.startsWith('special-display-case'))
        .map((it) => ({ card: it.card, category: null }));
      return { id: p.id, items, displayCaseAssign, collections, total, rank: 0 };
    });
    for (const r of rows) r.rank = 1 + rows.filter((o) => o.total > r.total).length;
    this.reveal = { players: rows, giftLog: this.giftLog };
    this.revealEndsAt = now + 5000 + 600 * rows.reduce((n, r) => n + r.items.length, 0);
  }

  private toLobby() {
    this.phase = 'lobby';
    this.reveal = undefined;
    this.turn = undefined;
    this.bays = [];
    this.log = [];
    this.round = { n: 0, of: 0, halfway: false, last: false };
  }

  /** Called every ~200ms by the server. Fires deadlines and drives bots. */
  tick() {
    const now = this.clock();
    const before = this.rev;
    if (this.phase === 'reveal' && now >= this.revealEndsAt) {
      this.phase = 'ended';
      this.rev++;
    }
    if (this.phase === 'playing' && this.stage === 'bidding') {
      if (this.opts.mode === 'classic') this.tickClassic(now);
      else this.tickFrenzy(now);
    }
    if (this.phase === 'playing' && this.stage === 'gifts' && this.gift && now >= this.gift.endsAt)
      this.giftTimeout(now);
    if (this.rev !== before || this.dirty) this.broadcast();
  }
  private dirty = false;

  private tickClassic(now: number) {
    const t = this.turn;
    if (!t) return;
    const p = this.players.find((x) => x.id === t.player);
    if (t.phase === 'gap') {
      if (now >= this.gapUntil) {
        this.startCall(now);
        this.dirty = true;
      }
      return;
    }
    if (p && (p.isBot || !p.connected) && now >= (p.botNextAt ?? 0)) {
      if (!p.connected && !p.isBot) {
        this.event('autoPass', { by: p.id });
        this.endCall(now);
        this.dirty = true;
        return;
      }
      const move = this.botMove(p);
      if (!move || this.bid(p, move.card, move.bay, now)) {
        this.event('pass', { by: p.id });
        this.endCall(now);
      }
      this.dirty = true;
      return;
    }
    if (t.endsAt !== undefined && now >= t.endsAt) {
      this.event('pass', { by: t.player });
      this.endCall(now);
      this.dirty = true;
    }
  }

  private tickFrenzy(now: number) {
    for (const bay of this.bays) {
      if (bay.card && bay.endsAt !== undefined && now >= bay.endsAt) {
        if (bay.stack.length) this.sell(bay);
        else bay.endsAt = now + this.scaled(10000);
        this.dirty = true;
      }
    }
    for (const p of this.players.filter((x) => x.isBot)) {
      if (now < (p.botNextAt ?? 0)) continue;
      p.botNextAt = now + 2500 + p.seat * 400;
      const move = this.botMove(p);
      if (move && !this.bid(p, move.card, move.bay, now)) this.dirty = true;
    }
    if (this.finishedBidding()) {
      this.toGifts(now);
      this.dirty = true;
    }
  }

  private botMove(p: MockPlayer): { card: string; bay: number } | null {
    const values = p.hand
      .filter((c) => c.kind === 'value')
      .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    for (const bay of this.bays) {
      const card = values.find((c) => this.isLegal(p.id, c, bay));
      if (card && Math.random() < 0.6) return { card: card.id, bay: bay.idx };
    }
    return null;
  }

  private giftTimeout(now: number) {
    const g = this.gift!;
    if (g.stage === 'pickTarget') {
      const victim = this.players.find((p) => p.id !== g.holder && p.won.length);
      if (!victim) return this.nextGift(now);
      this.gift = { ...g, stage: 'pickItem', victim: victim.id, endsAt: now + this.scaled(15000) };
    } else {
      const victim = this.players.find((p) => p.id === g.victim)!;
      const cheapest = [...victim.won].sort((a, b) => estOf(a) - estOf(b))[0]!;
      this.giveItem(victim, cheapest, now);
    }
    this.dirty = true;
  }

  // ---------- output ----------

  private event(kind: EventKind, e: Omit<LogEntry, 'n' | 'kind'>) {
    this.log.push({ n: ++this.logN, kind, ...e });
    if (this.log.length > 30) this.log.shift();
  }

  broadcast() {
    this.rev++;
    this.dirty = false;
    for (const p of this.players) if (!p.isBot) this.sendSnap(p.id);
  }

  sendSnap(playerId: string) {
    this.out.toPlayer(playerId, {
      t: 'snap',
      rev: this.rev,
      now: this.clock(),
      view: this.view(playerId),
    });
  }

  view(me: string): PlayerView {
    const now = this.clock();
    const self = this.players.find((p) => p.id === me);
    const onBay = new Map<string, number>();
    for (const bay of this.bays)
      for (const s of bay.stack) if (s.by === me) onBay.set(s.card.id, bay.idx);
    const myHand = self
      ? [
          ...self.hand,
          ...this.bays.flatMap((b) => b.stack.filter((s) => s.by === me).map((s) => s.card)),
        ].map((c) => ({
          id: c.id,
          kind: c.kind,
          ...(c.value !== undefined ? { value: c.value } : {}),
          ...(onBay.has(c.id) ? { onBay: onBay.get(c.id)! } : {}),
        }))
      : [];
    const bidding = this.phase === 'playing' && this.stage === 'bidding';
    const canAct =
      bidding &&
      (this.opts.mode === 'classic'
        ? this.turn?.player === me && this.turn.phase === 'window'
        : !(self?.cooldownUntil && now < self.cooldownUntil));
    const { giftCard: _g, ...gift } = this.gift ?? { giftCard: undefined };
    return {
      code: this.code,
      phase: this.phase,
      ...(this.phase === 'playing' ? { stage: this.stage } : {}),
      opts: this.opts,
      me,
      hostId: this.hostId,
      myHand,
      canAct,
      ...(self?.cooldownUntil && now < self.cooldownUntil
        ? { cooldownUntil: self.cooldownUntil }
        : {}),
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: PLAYER_COLORS[p.seat]!.id,
        shape: PLAYER_COLORS[p.seat]!.shape,
        connected: p.connected,
        isBot: p.isBot,
        cardsInHand: p.hand.length,
        collection: p.won,
        gifts: p.gifts.length,
      })),
      bays: this.bays.map((b) => {
        const top = this.top(b);
        return {
          idx: b.idx,
          card: b.card,
          stack: b.stack.map((s) => ({
            by: s.by,
            card: s.card.id,
            kind: s.card.kind,
            ...(s.card.value !== undefined ? { value: s.card.value } : {}),
          })),
          topBid: top
            ? {
                by: top.by,
                kind: top.card.kind,
                ...(top.card.value !== undefined ? { value: top.card.value } : {}),
              }
            : null,
          ...(b.endsAt !== undefined ? { endsAt: b.endsAt } : {}),
        };
      }),
      ...(this.turn ? { turn: this.turn } : {}),
      round: this.round,
      deckLeft: this.deck.length,
      log: this.log,
      ...(this.gift && this.stage === 'gifts'
        ? { gift: gift as NonNullable<PlayerView['gift']> }
        : {}),
      ...((this.phase === 'reveal' || this.phase === 'ended') && this.reveal
        ? { reveal: this.reveal }
        : {}),
    };
  }
}
