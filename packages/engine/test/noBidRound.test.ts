// R18b (no-bid round clears the bays) and the age term of R17.
import { describe, expect, it } from 'vitest';
import { CONFIG, LENGTH_PRESETS, closeProbability } from '../src/config';
import type { EngineState, GameEvent } from '../src/types';
import {
  act,
  caller,
  clone,
  engine,
  kinds,
  newGame,
  player,
  px,
  runAllPass,
  stackOn,
  v,
} from './helpers';

/** Pass until `callsDone` reaches `n` (the call that completes it has just been resolved). */
function passUntil(s: EngineState, n: number, events: GameEvent[]): EngineState {
  let cur = s;
  while (cur.callsDone < n && cur.call) {
    const r = engine.tick(cur, cur.call!.endsAt!);
    events.push(...r.events);
    cur = r.state;
    if (cur.callsDone >= n) break;
    const g = engine.tick(cur, engine.nextDeadline(cur)!);
    events.push(...g.events);
    cur = g.state;
  }
  return cur;
}

describe('R18b no-bid round clears every bay', () => {
  it('R18b: a full round of passes discards empty bays unsold and refills them in bay order', () => {
    const g = newGame(4);
    const before = g.state.bays.map((b) => b.card);
    const deckTop = g.state.deck.slice(0, before.length);
    const events: GameEvent[] = [];
    const s = passUntil(g.state, 4, events);
    const unsold = events.filter((e) => e.kind === 'unsold');
    expect(unsold.map((e) => e.bay)).toEqual([0, 1, 2]);
    expect(unsold.map((e) => e.card)).toEqual(before);
    expect(unsold.every((e) => e.extra === 'noBidRound')).toBe(true);
    const refills = events.filter((e) => e.kind === 'refill');
    expect(refills.map((e) => e.bay)).toEqual([0, 1, 2]);
    expect(refills.map((e) => e.card)).toEqual(deckTop);
    // all unsold events come before the first refill (clear, then refill in bay order)
    const ks = kinds(events);
    expect(ks.lastIndexOf('unsold')).toBeLessThan(ks.indexOf('refill'));
    expect(s.bays.map((b) => b.card)).toEqual(deckTop);
  });

  it('R18b: bays holding bids from earlier rounds are cleared too; cards return, nobody wins', () => {
    const g = newGame(4);
    const s0 = clone(g.state);
    stackOn(s0, 0, [
      ['p1', v(50)],
      ['p2', v(75)],
    ]);
    const handsBefore = s0.players.map((p) => p.hand.length);
    const itemBefore = s0.bays[0]!.card;
    const events: GameEvent[] = [];
    const s = passUntil(s0, 4, events);
    expect(s.bays[0]!.stack).toEqual([]);
    expect(s.bays[0]!.card).not.toBe(itemBefore);
    expect(kinds(events)).not.toContain('sold');
    expect(s.players.every((p) => p.won.length === 0)).toBe(true);
    expect(s.players.map((p) => p.hand.length)).toEqual(
      handsBefore.map((n, i) => n + (i === 1 || i === 2 ? 1 : 0)),
    );
    expect(player(s, 'p1').hand.some((c) => c.id === 'v50')).toBe(true);
    expect(player(s, 'p2').hand.some((c) => c.id === 'v75')).toBe(true);
    expect(s.bays[0]!.firstBidCall).toBeUndefined();
    const u = events.find((e) => e.kind === 'unsold' && e.bay === 0)!;
    expect(u.card).toBe(itemBefore);
    expect(u.extra).toBe('noBidRound');
  });

  it('R18b: an accepted bid anywhere in the round prevents the clear', () => {
    const g = newGame(4);
    let s = g.state;
    const events: GameEvent[] = [];
    const p = caller(s);
    s = act(s, { type: 'bid', player: p, card: 'v10', bay: 1 }, T(s)).state;
    s = engine.tick(s, engine.nextDeadline(s)!).state; // gap -> call 2
    s = passUntil(s, 4, events);
    expect(kinds(events)).not.toContain('unsold');
    expect(s.bays[1]!.stack).toHaveLength(1);
  });

  it('R18b: not in the final round (R22 sweeps) and not mid-round', () => {
    const g = newGame(4);
    const s0 = clone(g.state);
    // jump to the start of the final round: callsDone = callsTotal - 3
    s0.callsDone = s0.callsTotal - 4;
    s0.colorBag = [];
    const events: GameEvent[] = [];
    const s = passUntil(s0, s0.callsTotal - 2, events); // two calls into the last round
    expect(kinds(events)).not.toContain('unsold');
    const done = runAllPass(s, events);
    // the sweep discards the (still empty) bays without the noBidRound tag
    const unsold = events.filter((e) => e.kind === 'unsold');
    expect(unsold.length).toBeGreaterThan(0);
    expect(unsold.every((e) => e.extra === undefined)).toBe(true);
    expect(done.stage).not.toBe('bidding');
  });

  it('R18b: no clear when every bay is already null (R23 ends the game first)', () => {
    const g = newGame(4);
    const s0 = clone(g.state);
    s0.deck = [];
    for (const b of s0.bays) b.card = null;
    const events: GameEvent[] = [];
    const s = passUntil(s0, 4, events);
    expect(kinds(events)).not.toContain('unsold');
    expect(s.stage).not.toBe('bidding');
  });

  it('R18b: bays refilled on the same call are not cleared', () => {
    const g = newGame(4);
    const s0 = clone(g.state);
    s0.callsDone = 3; // the next call is the last of round 1
    s0.colorBag = [];
    // bay 0 is old enough to be force-closed on this call
    stackOn(s0, 0, [['p1', v(50)]]);
    s0.bays[0]!.firstBidCall = -100;
    s0.bays[0]!.lastBidCall = 0;
    // start from a fresh window: make the pending call the third call
    const s = clone(s0);
    s.call = { player: 'p0', phase: 'window', endsAt: T(s) + 5000 };
    const r = engine.tick(s, s.call!.endsAt!);
    const evs = r.events;
    expect(kinds(evs)).toContain('sold');
    const soldBay0Card = r.state.bays[0]!.card;
    // the freshly refilled bay 0 keeps its new item; bays 1 and 2 are cleared
    expect(evs.filter((e) => e.kind === 'unsold').map((e) => e.bay)).toEqual([1, 2]);
    expect(soldBay0Card).toBe(g.state.deck[0]);
  });

  it('R18b: 3 players need two quiet rounds; one quiet round does not clear', () => {
    const g = newGame(3);
    expect(CONFIG.NO_BID_ROUNDS_TO_CLEAR[3]).toBe(2);
    const events: GameEvent[] = [];
    const one = passUntil(g.state, 3, events);
    expect(kinds(events)).not.toContain('unsold');
    expect(one.bays.map((b) => b.card)).toEqual(g.state.bays.map((b) => b.card));
    const two = passUntil(one, 6, events);
    expect(events.filter((e) => e.extra === 'noBidRound').map((e) => e.bay)).toEqual([0, 1, 2]);
    expect(two.bays.map((b) => b.card)).toEqual(g.state.deck.slice(0, 3));
  });

  it('R18b: at 3 players a bid in either quiet round resets the count', () => {
    const g = newGame(3);
    const events: GameEvent[] = [];
    let s = passUntil(g.state, 3, events);
    s = engine.tick(s, engine.nextDeadline(s)!).state; // gap -> next call
    s = act(s, { type: 'bid', player: caller(s), card: 'v10', bay: 2 }, T(s)).state;
    s = engine.tick(s, engine.nextDeadline(s)!).state;
    passUntil(s, 6, events);
    expect(kinds(events)).not.toContain('unsold');
  });

  it('R18b: 4 players clear after one quiet round', () => {
    expect(CONFIG.NO_BID_ROUNDS_TO_CLEAR[4]).toBe(1);
    const events: GameEvent[] = [];
    passUntil(newGame(4).state, 4, events);
    expect(events.filter((e) => e.extra === 'noBidRound')).toHaveLength(3);
  });

  it('R18b: auto-passed calls (R13 disconnected seat) count toward the quiet round', () => {
    const s0 = clone(newGame(4).state);
    s0.players[1]!.connected = false;
    s0.players[2]!.connected = false;
    const events: GameEvent[] = [];
    passUntil(s0, 4, events);
    expect(kinds(events).filter((k) => k === 'autoPass')).toHaveLength(2);
    expect(events.filter((e) => e.extra === 'noBidRound')).toHaveLength(3);
  });

  it('R18b: deterministic, and an all-pass game still terminates with consistent cards', () => {
    const a = runAllPass(newGame(4, 'classic', 'nobid').state);
    const b = runAllPass(newGame(4, 'classic', 'nobid').state);
    expect(a).toEqual(b);
    // 11 cards per... every player still holds all 12 bid cards (nothing was ever bid)
    expect(a.players.every((p) => p.hand.length === 12)).toBe(true);
  });

  it('R18b: Frenzy is unaffected (no noBidRound events)', () => {
    const g = newGame(4, 'frenzy');
    const events: GameEvent[] = [];
    let s = g.state;
    let guard = 0;
    while (s.stage === 'bidding' && guard++ < 1000) {
      const r = engine.tick(s, engine.nextDeadline(s)!);
      s = r.state;
      events.push(...r.events);
    }
    expect(events.filter((e) => e.extra === 'noBidRound')).toHaveLength(0);
  });
});

function T(s: EngineState): number {
  return s.call!.endsAt! - CONFIG.bidWindowMs + 1;
}

describe('R17 age term', () => {
  const spec = LENGTH_PRESETS.standard.CLOSE_BY_PLAYERS[3];
  it('closeProbability = ramp + ageBonusPerCycle x age cycles, capped to [0, 1]', () => {
    const total = 150;
    const ramp = (c: number) => spec.pBase + ((spec.pMax - spec.pBase) * c) / total;
    expect(closeProbability(spec, 30, total, 0)).toBeCloseTo(ramp(30), 10);
    expect(closeProbability(spec, 30, total, 2)).toBeCloseTo(ramp(30) + 2 * spec.ageBonusPerCycle, 10);
    expect(closeProbability(spec, 30, total, -1)).toBeCloseTo(ramp(30), 10);
    expect(closeProbability(spec, 150, total, 1000)).toBe(1);
  });
  it('is monotone in age and in progress', () => {
    const p = (c: number, a: number) => closeProbability(spec, c, 150, a);
    for (let a = 0; a < 5; a += 0.5) expect(p(40, a + 0.5)).toBeGreaterThanOrEqual(p(40, a));
    expect(p(100, 1)).toBeGreaterThan(p(10, 1));
  });
  it('every preset has an age bonus and the forced cap bounds the age', () => {
    for (const preset of Object.values(LENGTH_PRESETS))
      for (const c of Object.values(preset.CLOSE_BY_PLAYERS)) {
        expect(c.ageBonusPerCycle).toBeGreaterThan(0);
        expect(c.maxBayAgeCycles).toBeGreaterThanOrEqual(2);
      }
  });
  it('an older bay sells more often than a young one on the same call (closes stream)', () => {
    const base = newGame(3).state;
    const rate = (age: number) => {
      let sold = 0;
      const N = 2000;
      for (let i = 0; i < N; i++) {
        const s = clone(base);
        s.callsDone = 20;
        s.rng.closes = i * 7919 + 1;
        stackOn(s, 0, [['p1', px(1)]]);
        s.bays[0]!.firstBidCall = 21 - age;
        s.bays[0]!.lastBidCall = 0;
        s.call = { player: 'p0', phase: 'window', endsAt: 99999 };
        if (kinds(engine.tick(s, 99999).events).includes('sold')) sold++;
      }
      return sold / N;
    };
    expect(rate(6)).toBeGreaterThan(rate(1) + 0.1);
  });
  it('the roll is deterministic for a given seed', () => {
    const a = runAllPass(newGame(5, 'classic', 'age').state);
    const b = runAllPass(newGame(5, 'classic', 'age').state);
    expect(a).toEqual(b);
  });
});
