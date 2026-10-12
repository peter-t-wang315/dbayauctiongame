import { describe, expect, it } from 'vitest';
import {
  ALL_DISCONNECTED_TTL_MS,
  GAME_TTL_MS,
  HOST_MIGRATION_MS,
  POSTGAME_TTL_MS,
  view,
} from '../src/index';
import { Harness, T0, hashOf } from './helpers';

const game = (h: Harness) => h.state.game!;
const caller = (h: Harness) => game(h).call!.player;

/** Tick through every deadline until `stop(h)` or the room leaves the given phases. */
function runUntil(h: Harness, stop: (h: Harness) => boolean, max = 20000): void {
  for (let i = 0; i < max && !stop(h); i++) {
    const next = h.state.deadlines[0];
    if (!next) throw new Error('no deadline');
    h.tickTo(Math.max(next.at, h.now));
  }
  if (!stop(h)) throw new Error('did not reach stop condition');
}

describe('start + engine wiring', () => {
  it('start moves lobby -> playing with a seeded engine state and game-length passthrough', () => {
    const quick = Harness.started(5, 0, { length: 'quick' });
    const std = Harness.started(5, 0, { length: 'standard' });
    expect(quick.state.meta.phase).toBe('playing');
    expect(quick.state.meta.seed).toBeUndefined();
    expect(game(quick).seed).toBe('seed-for-tests');
    expect(game(quick).length).toBe('quick');
    expect(game(std).length).toBe('standard');
    expect(game(quick).round.of).toBeLessThan(game(std).round.of);
    expect(game(quick).deckSize).toBeLessThan(game(std).deckSize);
    const def = Harness.started(3, 0);
    expect(game(def).length).toBe('standard');
    expect(view(quick.state, 'p1').opts.length).toBe('quick');
  });

  it('opts mode/relaxed/bidWindow pass through to the engine', () => {
    const h = Harness.started(3, 0, { mode: 'frenzy', relaxed: true, bidWindowMs: 8000 });
    expect(game(h)).toMatchObject({ mode: 'frenzy', relaxed: true, bidWindowMs: 8000 });
  });

  it('seats are compacted so color index == engine seat', () => {
    const h = new Harness();
    const host = h.join('A');
    h.act(host, { t: 'addBot' });
    h.act(host, { t: 'addBot' });
    h.act(host, { t: 'rmBot', playerId: 'bot1' });
    h.act(host, { t: 'addBot' });
    h.start();
    h.state.players.forEach((p, i) => expect(p.seat).toBe(i));
    game(h).players.forEach((p, i) => expect(p.seat).toBe(i));
  });

  it('lobby-only actions are WRONG_PHASE during play', () => {
    const h = Harness.started(3, 0);
    const host = h.state.meta.hostId!;
    for (const a of [
      { t: 'addBot' },
      { t: 'start' },
      { t: 'setOpts', mode: 'frenzy' },
      { t: 'rename', name: 'X' },
      { t: 'rematch' },
    ] as const) {
      const before = h.state;
      h.act(host, a);
      expect(h.errCode()).toBe('WRONG_PHASE');
      expect(h.state).toBe(before);
    }
  });
});

describe('Classic bidding', () => {
  it('caller bids, others cannot; bad card / bay / late rejected with no state change', () => {
    const h = Harness.started(3, 0);
    const c = caller(h);
    const other = h.state.players.find((p) => p.id !== c)!.id;
    h.now = T0 + 100;
    let before = h.state;
    h.act(other, { t: 'bid', card: 'v100', bay: 0 });
    expect(h.errCode()).toBe('NOT_YOUR_TURN');
    expect(h.state).toBe(before);
    h.act(c, { t: 'bid', card: 'nope', bay: 0 });
    expect(h.errCode()).toBe('ILLEGAL_BID');
    h.act(c, { t: 'bid', card: 'v100', bay: 9 });
    expect(h.errCode()).toBe('ILLEGAL_BID');
    expect(h.state).toBe(before);
    // late: at/after the window deadline
    const endsAt = game(h).call!.endsAt!;
    h.now = endsAt;
    before = h.state;
    h.act(c, { t: 'bid', card: 'v100', bay: 0 });
    expect(h.errCode()).toBe('TOO_LATE');
    expect(h.state).toBe(before);
    // on time
    h.now = endsAt - 1;
    h.act(c, { t: 'bid', card: 'v100', bay: 0 });
    expect(h.ack()).toMatchObject({ ok: true });
    expect(game(h).bays[0]!.stack).toHaveLength(1);
    expect(h.state.log.some((e) => e.kind === 'bid' && e.by === c)).toBe(true);
    const v = view(h.state, c);
    expect(v.bays[0]!.stack[0]).toMatchObject({ by: c, card: 'v100', kind: 'value', value: 100 });
    expect(v.bays[0]!.topBid).toMatchObject({ by: c, value: 100 });
    expect(v.myHand.find((x) => x.id === 'v100')?.onBay).toBe(0);
  });

  it('window expiry on tick auto-passes the caller and advances the call', () => {
    const h = Harness.started(3, 0);
    const first = caller(h);
    const endsAt = game(h).call!.endsAt!;
    h.tickTo(endsAt);
    expect(h.state.log.some((e) => e.kind === 'pass' && e.by === first)).toBe(true);
    expect(game(h).callsDone).toBe(1);
    // alarm points at the next engine deadline
    const alarm = h.last.find((e) => e.type === 'setAlarm');
    expect(alarm).toEqual({ type: 'setAlarm', at: h.state.deadlines[0]!.at });
  });

  it('explicit pass works for the caller only', () => {
    const h = Harness.started(3, 0);
    const c = caller(h);
    const other = h.state.players.find((p) => p.id !== c)!.id;
    h.now = T0 + 50;
    h.act(other, { t: 'pass' });
    expect(h.errCode()).toBe('NOT_YOUR_TURN');
    h.act(c, { t: 'pass' });
    expect(h.ack()).toMatchObject({ ok: true });
    expect(h.state.log.some((e) => e.kind === 'pass' && e.by === c)).toBe(true);
  });

  it('a tick before any deadline is a no-op (same state, no effects)', () => {
    const h = Harness.started(3, 0);
    const before = h.state;
    h.tickTo(T0 + 1);
    expect(h.state).toBe(before);
    expect(h.last).toEqual([]);
  });
});

describe('disconnect, auto-pass, reconnect', () => {
  it("disconnecting the caller auto-passes their call immediately; others' calls unaffected", () => {
    const h = Harness.started(3, 0);
    const c = caller(h);
    h.now = T0 + 200;
    h.run({ type: 'disconnect', playerId: c });
    expect(h.state.players.find((p) => p.id === c)!.connected).toBe(false);
    expect(h.state.log.some((e) => e.kind === 'left' && e.by === c)).toBe(true);
    expect(h.state.log.some((e) => e.kind === 'pass' && e.by === c)).toBe(true);
    expect(game(h).players.find((p) => p.id === c)!.connected).toBe(false);
    expect(view(h.state, c).players.find((p) => p.id === c)!.connected).toBe(false);
  });

  it('a disconnected player is auto-skipped when their call comes up', () => {
    const h = Harness.started(3, 0);
    const victim = h.state.players.find((p) => p.id !== caller(h))!.id;
    h.run({ type: 'disconnect', playerId: victim }, T0 + 10);
    runUntil(h, (x) => x.state.log.some((e) => e.kind === 'autoPass' && e.by === victim));
    expect(h.state.log.some((e) => e.kind === 'autoPass' && e.by === victim)).toBe(true);
  });

  it('a connected-but-slow player just loses the turn (pass, not autoPass)', () => {
    const h = Harness.started(3, 0);
    const c = caller(h);
    h.tickTo(game(h).call!.endsAt!);
    expect(h.state.log.some((e) => e.kind === 'pass' && e.by === c)).toBe(true);
    expect(h.state.log.some((e) => e.kind === 'autoPass')).toBe(false);
  });

  it('hello reclaims the seat mid-game: connected again, rejoined logged, fresh snapshot', () => {
    const h = Harness.started(3, 0);
    const p = h.state.players[1]!;
    h.run({ type: 'disconnect', playerId: p.id }, T0 + 100);
    h.run(
      { type: 'hello', conn: 'again', playerId: p.id, secretHash: hashOf(`s-${p.id}`) },
      T0 + 200,
    );
    expect(h.state.players[1]!.connected).toBe(true);
    expect(game(h).players[1]!.connected).toBe(true);
    expect(h.state.log.some((e) => e.kind === 'rejoined' && e.by === p.id)).toBe(true);
    const snap = h
      .sends()
      .find((s) => s.to && typeof s.to === 'object' && 'conn' in s.to && s.msg.t === 'snap');
    expect(snap).toBeTruthy();
    // their hand is intact
    expect(view(h.state, p.id).myHand.length).toBe(12);
  });
});

describe('Frenzy anti-snipe', () => {
  it('an accepted bid extends the bay close time (never shortens); cooldown applies', () => {
    const h = Harness.started(3, 0, { mode: 'frenzy' });
    const bay = game(h).bays[0]!;
    const p1 = h.state.players[0]!.id;
    // bid right before the close so the antiSnipe window extends it
    const closeBefore = bay.closesAt!;
    h.now = closeBefore - 500;
    h.act(p1, { t: 'bid', card: 'v100', bay: 0 });
    expect(h.ack()).toMatchObject({ ok: true });
    const closeAfter = game(h).bays[0]!.closesAt!;
    expect(closeAfter).toBeGreaterThanOrEqual(closeBefore);
    expect(closeAfter).toBeGreaterThan(h.now);
    expect(view(h.state, p1).bays[0]!.endsAt).toBe(closeAfter);
    // immediate second bid by same player is on cooldown
    const before = h.state;
    h.act(p1, { t: 'bid', card: 'v125', bay: 0 });
    expect(h.errCode()).toBe('COOLDOWN');
    expect(h.state).toBe(before);
    expect(view(h.state, p1).cooldownUntil).toBeGreaterThan(h.now);
    expect(view(h.state, p1).canAct).toBe(false);
    // other players do not see my cooldown
    expect(view(h.state, h.state.players[1]!.id).cooldownUntil).toBeUndefined();
    // bid after the (extended) close is TOO_LATE
    h.now = closeAfter + 1;
    h.act(h.state.players[1]!.id, { t: 'bid', card: 'v50', bay: 0 });
    expect(h.errCode()).toBe('TOO_LATE');
  });
});

describe('bots', () => {
  it('bots act on tick after a human-like delay (800-2000ms), using the engine policy', () => {
    const h = Harness.started(1, 2);
    const bots = h.state.players.filter((p) => p.isBot).map((p) => p.id);
    const botDl = () => h.state.deadlines.filter((d) => d.kind === 'bot');
    // advance through the game until a bot has the call and acts
    let acted = false;
    for (let i = 0; i < 400 && !acted; i++) {
      const next = h.state.deadlines[0]!;
      h.tickTo(Math.max(next.at, h.now));
      acted = h.state.log.some((e) => e.kind === 'bid' && bots.includes(e.by!));
    }
    expect(acted).toBe(true);
    for (const d of botDl()) {
      expect(bots).toContain(d.data);
    }
    // the delay is within bounds: the first bot deadline after the call opens
    const h2 = Harness.started(1, 2);
    const c = game(h2).call!.player;
    if (h2.state.players.find((p) => p.id === c)!.isBot) {
      const dl = h2.state.deadlines.find((d) => d.kind === 'bot' && d.data === c)!;
      expect(dl.at - h2.now).toBeGreaterThanOrEqual(800);
      expect(dl.at - h2.now).toBeLessThanOrEqual(2000);
    }
  });

  it('bots never count as connected humans: expiry shortens when the last human drops', () => {
    const h = Harness.started(1, 2);
    h.run({ type: 'disconnect', playerId: h.state.players.find((p) => !p.isBot)!.id }, T0 + 1000);
    expect(h.state.meta.expireAt).toBe(T0 + 1000 + ALL_DISCONNECTED_TTL_MS);
  });
});

describe('full game: reveal -> ended -> rematch', () => {
  it('runs to reveal, then ends by deadline (R37), then rematch returns to lobby', () => {
    const h = Harness.started(1, 2, undefined, 'full-game');
    const host = h.state.meta.hostId!;
    runUntil(h, (x) => x.state.meta.phase !== 'playing');
    expect(h.state.meta.phase).toBe('reveal');
    const revealAt = h.state.meta.revealAt!;
    expect(revealAt).toBeGreaterThan(h.now - 1);
    const v = view(h.state, host);
    expect(v.reveal).toBeTruthy();
    expect(v.stage).toBeUndefined();
    expect(h.state.meta.expireAt).toBeLessThanOrEqual(h.now + POSTGAME_TTL_MS);
    // actions during reveal are WRONG_PHASE
    h.act(host, { t: 'pass' });
    expect(h.errCode()).toBe('WRONG_PHASE');
    // not yet ended just before the deadline
    h.tickTo(revealAt - 1);
    expect(h.state.meta.phase).toBe('reveal');
    h.tickTo(revealAt);
    expect(h.state.meta.phase).toBe('ended');
    expect(view(h.state, host).reveal).toBeTruthy();
    // rematch
    h.act(host, { t: 'rematch' });
    h.run({ type: 'seed', seed: 'second' });
    expect(h.state.meta.phase).toBe('lobby');
    expect(h.state.game).toBeNull();
    expect(h.state.log).toEqual([]);
    expect(h.state.players).toHaveLength(3);
    expect(h.state.players.filter((p) => p.isBot)).toHaveLength(2);
    expect(view(h.state, host).reveal).toBeUndefined();
    h.act(host, { t: 'start' });
    expect(h.state.meta.phase).toBe('playing');
    expect(game(h).seed).toBe('second');
  });

  it('rematch is also accepted straight from reveal, by the host only', () => {
    const h = Harness.started(1, 2, { length: 'quick' }, 'rv');
    const host = h.state.meta.hostId!;
    runUntil(h, (x) => x.state.meta.phase === 'reveal');
    h.act(host, { t: 'rematch' });
    expect(h.state.meta.phase).toBe('lobby');
    expect(h.state.meta.opts.length).toBe('quick');
  });
});

describe('expiry and host migration', () => {
  it('lobby 1h, playing 2h, post-game 30min', () => {
    const h = new Harness();
    const host = h.join('A');
    expect(h.state.meta.expireAt).toBe(T0 + 60 * 60 * 1000);
    h.act(host, { t: 'addBot' });
    h.act(host, { t: 'addBot' });
    h.now = T0 + 5000;
    h.start();
    expect(h.state.meta.expireAt).toBe(T0 + 5000 + GAME_TTL_MS);
    runUntil(h, (x) => x.state.meta.phase === 'reveal');
    expect(h.state.meta.expireAt).toBeLessThanOrEqual(h.now + POSTGAME_TTL_MS);
    expect(h.state.meta.expireAt).toBeGreaterThan(h.now);
  });

  it('all humans disconnected: expireAt = +10min; reconnect restores the phase expiry', () => {
    const h = new Harness();
    const a = h.join('A');
    const b = h.join('B');
    const base = h.state.meta.expireAt;
    h.run({ type: 'disconnect', playerId: a }, T0 + 1000);
    expect(h.state.meta.expireAt).toBe(base);
    h.run({ type: 'disconnect', playerId: b }, T0 + 2000);
    expect(h.state.meta.expireAt).toBe(T0 + 2000 + ALL_DISCONNECTED_TTL_MS);
    expect(h.state.deadlines.find((d) => d.kind === 'expire')!.at).toBe(h.state.meta.expireAt);
    h.run({ type: 'hello', conn: 'c', playerId: a, secretHash: hashOf(`s-${a}`) }, T0 + 3000);
    expect(h.state.meta.expireAt).toBe(base);
    // expire fires after 10 min of total silence
    h.run({ type: 'disconnect', playerId: a }, T0 + 4000);
    h.tickTo(T0 + 4000 + ALL_DISCONNECTED_TTL_MS - 1);
    expect(h.state.meta.closed).toBeUndefined();
    const fx = h.tickTo(T0 + 4000 + ALL_DISCONNECTED_TTL_MS);
    expect(h.state.meta.closed).toBe(true);
    expect(fx).toContainEqual({ type: 'deleteRoom' });
  });

  it('host migrates to the longest-connected human after 30s disconnected; bots never host', () => {
    const h = new Harness();
    const a = h.join('A');
    h.now = T0 + 10;
    const b = h.join('B');
    h.now = T0 + 20;
    const c = h.join('C');
    h.act(a, { t: 'addBot' });
    h.run({ type: 'disconnect', playerId: a }, T0 + 1000);
    expect(h.state.meta.hostId).toBe(a);
    expect(h.state.deadlines.some((d) => d.kind === 'hostCheck')).toBe(true);
    h.tickTo(T0 + 1000 + HOST_MIGRATION_MS - 1);
    expect(h.state.meta.hostId).toBe(a);
    h.tickTo(T0 + 1000 + HOST_MIGRATION_MS);
    expect(h.state.meta.hostId).toBe(b);
    expect(view(h.state, c).hostId).toBe(b);
    // the old host reconnecting does not take the role back
    h.run({ type: 'hello', conn: 'x', playerId: a, secretHash: hashOf(`s-${a}`) }, T0 + 60_000);
    expect(h.state.meta.hostId).toBe(b);
    // if the host comes back inside 30s, no migration
    h.run({ type: 'disconnect', playerId: b }, T0 + 70_000);
    h.run({ type: 'hello', conn: 'y', playerId: b, secretHash: hashOf(`s-${b}`) }, T0 + 80_000);
    h.tickTo(T0 + 120_000);
    expect(h.state.meta.hostId).toBe(b);
    expect(h.state.deadlines.some((d) => d.kind === 'hostCheck')).toBe(false);
  });

  it('only bots + disconnected humans: host stays (nobody to migrate to)', () => {
    const h = new Harness();
    const a = h.join('A');
    h.act(a, { t: 'addBot' });
    h.run({ type: 'disconnect', playerId: a }, T0 + 1000);
    h.tickTo(T0 + 1000 + HOST_MIGRATION_MS + 1);
    expect(h.state.meta.hostId).toBe(a);
  });

  it('leave in-game acts like a disconnect (seat kept, auto-pass)', () => {
    const h = Harness.started(3, 0);
    const c = caller(h);
    h.run({ type: 'leave', playerId: c }, T0 + 100);
    expect(h.state.players.some((p) => p.id === c)).toBe(true);
    expect(h.state.players.find((p) => p.id === c)!.connected).toBe(false);
  });

  it('kicking mid-game bans and auto-passes but keeps the seat in the engine', () => {
    const h = Harness.started(3, 0);
    const host = h.state.meta.hostId!;
    const victim = h.state.players.find((p) => p.id !== host)!.id;
    h.act(host, { t: 'kick', playerId: victim });
    expect(h.state.meta.banned).toContain(victim);
    expect(h.state.players).toHaveLength(3);
    expect(h.state.players.find((p) => p.id === victim)!.connected).toBe(false);
    h.run({ type: 'hello', conn: 'k', playerId: victim, secretHash: hashOf(`s-${victim}`) });
    expect(h.errCode()).toBe('BANNED');
  });
});
