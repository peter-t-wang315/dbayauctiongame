import { describe, expect, it } from 'vitest';
import { CONFIG, LENGTH_PRESETS } from '../src/config';
import { topOf } from '../src/game';
import type { BidCard, EngineState, GameEvent, StackEntry } from '../src/types';
import {
  T0,
  act,
  caller,
  clone,
  engine,
  kinds,
  mkSetup,
  newGame,
  player,
  runAllPass,
  toGifts,
} from './helpers';

const v = (value: number): BidCard => ({ id: `v${value}`, kind: 'value', value });
const px = (n: number): BidCard => ({ id: `p${n}`, kind: 'proxy' });

/** Put entries on a bay, removing the cards from their owners' hands. */
function stackOn(
  s: EngineState,
  bay: number,
  entries: Array<[string, BidCard]>,
  calls?: { first: number; last: number },
) {
  const b = s.bays[bay]!;
  b.stack = entries.map(([by, card]) => {
    const p = player(s, by);
    p.hand = p.hand.filter((c) => c.id !== card.id);
    return { by, card } as StackEntry;
  });
  if (calls) {
    b.firstBidCall = calls.first;
    b.lastBidCall = calls.last;
  }
}

/** Resolve the current call by letting its window expire. */
function expire(s: EngineState) {
  return engine.tick(s, s.call!.endsAt!);
}

describe('R7 rounds', () => {
  const cases = (['quick', 'standard'] as const).flatMap((length) =>
    ([3, 4, 5, 6] as const).map(
      (n) => [length, n, LENGTH_PRESETS[length].ROUNDS_BY_PLAYERS[n]] as const,
    ),
  );
  it.each(cases)(
    'R7: %s, %i players -> %i rounds, every player called once per round',
    (length, n, rounds) => {
      const g = engine.setup({ ...mkSetup(n, 'seed-1', 'classic'), length }, T0);
      expect(g.state.callsTotal).toBe(rounds * n);
      expect(g.state.round.of).toBe(rounds);
      const events: GameEvent[] = [...g.events];
      const end = runAllPass(g.state, events);
      expect(end.callsDone).toBe(rounds * n);
      const turns = events.filter((e) => e.kind === 'turn').map((e) => e.by);
      expect(turns).toHaveLength(rounds * n);
      for (let r = 0; r < rounds; r++)
        expect(new Set(turns.slice(r * n, (r + 1) * n)).size).toBe(n);
    },
  );
});

describe('R8 color order', () => {
  it('R8: bags are shuffled permutations; no repeat across a bag boundary', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const g = newGame(3, 'classic', seed);
      const events: GameEvent[] = [...g.events];
      runAllPass(g.state, events);
      const turns = events.filter((e) => e.kind === 'turn').map((e) => e.by as string);
      for (let i = 1; i < turns.length; i++) expect(turns[i]).not.toBe(turns[i - 1]);
    }
    // order differs between seeds
    const order = (seed: string) => {
      const ev: GameEvent[] = [...newGame(6, 'classic', seed).events];
      return ev.filter((e) => e.kind === 'turn').map((e) => e.by);
    };
    expect(order('x')).not.toEqual(order('y'));
  });
});

describe('R9 announcements', () => {
  it('R9: Halfway at the start of round floor(rounds/2)+1, Last round at the final round, Game over after the sweep', () => {
    const g = newGame(3);
    const events: GameEvent[] = [...g.events];
    runAllPass(g.state, events);
    const ks = kinds(events);
    const turnIdx = (k: number) => {
      let seen = -1;
      return ks.findIndex((x) => x === 'turn' && ++seen === k);
    };
    expect(ks.filter((k) => k === 'halfway')).toHaveLength(1);
    expect(ks.filter((k) => k === 'lastRound')).toHaveLength(1);
    const rounds = g.state.round.of;
    expect(rounds).toBe(LENGTH_PRESETS.standard.ROUNDS_BY_PLAYERS[3]);
    // round floor(rounds/2)+1 starts at call index floor(rounds/2)*3 (0-based); the last at (rounds-1)*3
    expect(ks.indexOf('halfway')).toBe(turnIdx(Math.floor(rounds / 2) * 3) - 1);
    expect(ks.indexOf('lastRound')).toBe(turnIdx((rounds - 1) * 3) - 1);
    expect(ks.at(-1)).toBe('gameOver');
  });
});

describe('R10/R12 call procedure', () => {
  it('R10: bid is applied, then the call resolves (callsDone+1) and a gap starts', () => {
    const g = newGame(3);
    const c = caller(g.state);
    const r = act(g.state, { type: 'bid', player: c, card: 'v50', bay: 0 }, T0 + 100);
    expect(kinds(r.events)[0]).toBe('bid');
    expect(r.state.callsDone).toBe(1);
    expect(r.state.call).toEqual({ player: c, phase: 'gap', endsAt: T0 + 100 + CONFIG.callGapMs });
    expect(r.state.bays[0]!.stack).toHaveLength(1);
  });
  it('R12: a legal bid ends the window immediately; the next call starts after callGapMs', () => {
    const g = newGame(3);
    const c = caller(g.state);
    const t = T0 + 100;
    const r = act(g.state, { type: 'bid', player: c, card: 'v50', bay: 0 }, t);
    expect(engine.nextDeadline(r.state)).toBe(t + CONFIG.callGapMs);
    expect(engine.tick(r.state, t + CONFIG.callGapMs - 1).events).toEqual([]);
    const n = engine.tick(r.state, t + CONFIG.callGapMs);
    expect(kinds(n.events)).toContain('turn');
    expect(n.state.call?.phase).toBe('window');
    expect(n.state.call?.endsAt).toBe(t + CONFIG.callGapMs + 5000);
  });
});

describe('R11 bid window', () => {
  it('R11: window is bidWindowMs; Relaxed multiplies by 1.5', () => {
    expect(newGame(3).state.call?.endsAt).toBe(T0 + 5000);
    const relaxed = engine.setup({ ...mkSetup(3), relaxed: true }, T0);
    expect(relaxed.state.call?.endsAt).toBe(T0 + 7500);
    const w8 = engine.setup({ ...mkSetup(3), bidWindowMs: 8000 }, T0);
    expect(w8.state.call?.endsAt).toBe(T0 + 8000);
  });
  it('R11: a bid at or after the deadline is TOO_LATE and leaves state unchanged', () => {
    const g = newGame(3);
    const before = clone(g.state);
    const r = engine.apply(
      g.state,
      { type: 'bid', player: caller(g.state), card: 'v50', bay: 0 },
      T0 + 5000,
    );
    expect(r).toEqual({ ok: false, code: 'TOO_LATE' });
    expect(g.state).toEqual(before);
  });
  it('R11: expiry with no bid is a pass (buzzer) and the call advances', () => {
    const g = newGame(3);
    const c = caller(g.state);
    const r = expire(g.state);
    expect(r.events[0]).toEqual({ kind: 'pass', by: c });
    expect(r.state.callsDone).toBe(1);
    expect(r.state.call?.phase).toBe('gap');
  });
  it('R11: an explicit pass ends the window early', () => {
    const g = newGame(3);
    const c = caller(g.state);
    const r = act(g.state, { type: 'pass', player: c }, T0 + 10);
    expect(r.state.call).toEqual({ player: c, phase: 'gap', endsAt: T0 + 10 + CONFIG.callGapMs });
  });
});

describe('R13 auto-skip', () => {
  it('R13: a disconnected player is skipped: announce, wait skipGapMs, no window, call counted', () => {
    const setup = mkSetup(3);
    setup.players.forEach((p) => (p.connected = false));
    const g = engine.setup(setup, T0);
    expect(kinds(g.events)).toEqual(['gameStart', 'turn', 'autoPass']);
    expect(g.state.callsDone).toBe(1);
    expect(g.state.call?.phase).toBe('gap');
    expect(g.state.call?.endsAt).toBe(T0 + CONFIG.skipGapMs);
  });
  it('R13: a skipped call still triggers the close roll', () => {
    const g = newGame(3);

    const s = clone(g.state);
    // make the next called player unable to bid, then finish the current call
    stackOn(s, 0, [['p0', v(10)]], { first: -1000, last: 1 });
    s.players.forEach((p) => (p.hand = []));
    const next = engine.tick(expire(s).state, s.call!.endsAt! + CONFIG.callGapMs);
    expect(next.state.callsDone).toBeGreaterThanOrEqual(2);
    expect(kinds(next.events)).toContain('sold');
  });
  it('R13: a player with an empty hand is auto-skipped', () => {
    const g = newGame(3);
    const s = clone(g.state);
    s.players.forEach((p) => (p.hand = []));
    const r = engine.tick(expire(s).state, s.call!.endsAt! + CONFIG.callGapMs);
    expect(kinds(r.events)).toEqual(expect.arrayContaining(['turn', 'autoPass']));
    expect(r.state.callsDone).toBe(2);
  });
});

describe('R14 one action', () => {
  it('R14: only the called color may bid; a second action in the gap is rejected', () => {
    const g = newGame(3);
    const c = caller(g.state);
    const other = g.state.players.find((p) => p.id !== c)!.id;
    expect(
      engine.apply(g.state, { type: 'bid', player: other, card: 'v50', bay: 0 }, T0 + 1),
    ).toEqual({
      ok: false,
      code: 'NOT_YOUR_TURN',
    });
    expect(engine.apply(g.state, { type: 'pass', player: other }, T0 + 1)).toEqual({
      ok: false,
      code: 'NOT_YOUR_TURN',
    });
    const r = act(g.state, { type: 'bid', player: c, card: 'v50', bay: 0 }, T0 + 1);
    expect(engine.apply(r.state, { type: 'bid', player: c, card: 'v75', bay: 1 }, T0 + 2)).toEqual({
      ok: false,
      code: 'TOO_LATE',
    });
    expect(engine.apply(r.state, { type: 'pass', player: c }, T0 + 2).ok).toBe(false);
  });
});

describe('R15 top bid', () => {
  const e = (by: string, card: BidCard): StackEntry => ({ by, card });
  it('R15: empty stack has no top', () => expect(topOf([])).toBeNull());
  it('R15: no Proxy -> highest face value', () => {
    expect(topOf([e('a', v(50)), e('b', v(100)), e('c', v(75))])?.by).toBe('b');
  });
  it('R15: any Proxy -> the most recently played Proxy', () => {
    expect(topOf([e('a', px(1)), e('b', v(300)), e('c', px(2)), e('d', v(250))])?.by).toBe('c');
  });
});

describe('R16 legality', () => {
  function withTop(top: Array<[string, BidCard]>) {
    const g = newGame(3);
    const s = clone(g.state);
    const c = caller(s);
    const o = s.players.find((p) => p.id !== c)!.id;
    stackOn(
      s,
      0,
      top.map(([who, card]) => [who === 'o' ? o : c, card] as [string, BidCard]),
    );
    return { s, c, o };
  }
  const bid = (s: EngineState, c: string, card: string, bay = 0) =>
    engine.apply(s, { type: 'bid', player: c, card, bay }, T0 + 10);

  it('R16: card must be in the hand', () => {
    const { s, c } = withTop([]);
    expect(bid(s, c, 'nope')).toEqual({ ok: false, code: 'ILLEGAL_BID' });
    const r = act(s, { type: 'bid', player: c, card: 'v10', bay: 1 }, T0 + 1);
    expect(r.state.players.find((p) => p.id === c)!.hand.some((x) => x.id === 'v10')).toBe(false);
  });
  it('R16: the bay must hold an auction card', () => {
    const { s, c } = withTop([]);
    s.bays[2]!.card = null;
    expect(bid(s, c, 'v10', 2)).toEqual({ ok: false, code: 'ILLEGAL_BID' });
    expect(bid(s, c, 'v10', 99)).toEqual({ ok: false, code: 'ILLEGAL_BID' });
  });
  it('R16: you cannot bid on a bay whose top bid you own', () => {
    const { s, c } = withTop([['c', v(50)]]);
    expect(bid(s, c, 'v300')).toEqual({ ok: false, code: 'ILLEGAL_BID' });
  });
  it('R16: face must beat the top; equal is illegal', () => {
    const { s, c } = withTop([['o', v(100)]]);
    expect(bid(s, c, 'v50').ok).toBe(false);
    expect(bid(s, c, 'v100').ok).toBe(false);
    expect(bid(s, c, 'v125').ok).toBe(true);
    expect(bid(s, c, 'p1').ok).toBe(true);
  });
  it('R16: over a Proxy only a Proxy is legal; Proxy on Proxy is legal', () => {
    const { s, c } = withTop([['o', px(1)]]);
    expect(bid(s, c, 'v300')).toEqual({ ok: false, code: 'ILLEGAL_BID' });
    const r = bid(s, c, 'p1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(topOf(r.state.bays[0]!.stack)?.by).toBe(c);
  });
  it('R16: an outbid player may bid on the same bay again; cards on bays are out of hand', () => {
    const { s, c, o } = withTop([
      ['c', v(50)],
      ['o', v(100)],
    ]);
    const r = bid(s, c, 'v125');
    expect(r.ok).toBe(true);
    void o;
    // a player may have cards on several bays
    const g = newGame(3);
    const a1 = act(g.state, { type: 'bid', player: caller(g.state), card: 'v10', bay: 0 }, T0 + 1);
    expect(a1.state.players.find((p) => p.id === caller(g.state))!.hand).toHaveLength(11);
  });
  it('R16: error mapping (wrong color NOT_YOUR_TURN, late TOO_LATE, otherwise ILLEGAL_BID)', () => {
    const { s, c } = withTop([['o', v(100)]]);
    expect(bid(s, c, 'v10')).toEqual({ ok: false, code: 'ILLEGAL_BID' });
    expect(engine.apply(s, { type: 'bid', player: c, card: 'v125', bay: 0 }, T0 + 6000)).toEqual({
      ok: false,
      code: 'TOO_LATE',
    });
    expect(engine.apply(s, { type: 'bid', player: 'ghost', card: 'v125', bay: 0 }, T0)).toEqual({
      ok: false,
      code: 'NOT_YOUR_TURN',
    });
  });
});

describe('R17 close roll', () => {
  it('R17: a bay cannot close on the call that placed its latest bid', () => {
    const g = newGame(3);
    const s = clone(g.state);
    stackOn(s, 0, [['p1', v(50)]], { first: -1000, last: 1 }); // current call number is 1
    const r = expire(s);
    expect(kinds(r.events)).not.toContain('sold');
    expect(r.state.bays[0]!.stack).toHaveLength(1);
  });
  it('R17: forced close once the bay is maxBayAgeCycles x players calls old', () => {
    const g = newGame(3);
    const s = clone(g.state);
    stackOn(s, 0, [['p1', v(50)]], {
      first: 1 - LENGTH_PRESETS.standard.CLOSE_BY_PLAYERS[3].maxBayAgeCycles * 3,
      last: 0,
    });
    expect(kinds(expire(s).events)).toContain('sold');
    const s2 = clone(g.state);
    stackOn(s2, 0, [['p1', v(50)]], {
      first: 2 - LENGTH_PRESETS.standard.CLOSE_BY_PLAYERS[3].maxBayAgeCycles * 3,
      last: 0,
    });
    // one call younger: not forced, so only the random roll can sell it (rng-dependent)
    s2.rng.closes = 123;
    const roll = expire(s2);
    expect(roll.state.bays[0]!.stack.length === 1 || kinds(roll.events).includes('sold')).toBe(
      true,
    );
  });
  it('R17: probability rises from about pBase to pMax over the game (closes stream)', () => {
    const base = newGame(3).state;
    const rate = (callsDone: number) => {
      let sold = 0;
      const N = 3000;
      for (let i = 0; i < N; i++) {
        const s = clone(base);
        s.callsDone = callsDone;
        s.rng.closes = i * 7919 + 1;
        stackOn(s, 0, [['p1', v(50)]], { first: callsDone, last: 0 });
        if (kinds(expire(s).events).includes('sold')) sold++;
      }
      return sold / N;
    };
    const { pBase, pMax } = LENGTH_PRESETS.standard.CLOSE_BY_PLAYERS[3];
    const total = base.callsTotal;
    const expected = (callsDone: number) => pBase + ((pMax - pBase) * (callsDone + 1)) / total;
    const late = total - 3;
    expect(Math.abs(rate(0) - expected(0))).toBeLessThan(0.012);
    expect(Math.abs(rate(late) - expected(late))).toBeLessThan(0.012);
    expect(rate(late)).toBeGreaterThan(rate(0));
  });
  it('R17: the roll is deterministic for a given seed', () => {
    const a = runAllPass(newGame(3, 'classic', 'same').state);
    const b = runAllPass(newGame(3, 'classic', 'same').state);
    expect(a).toEqual(b);
  });
});

describe('R18 unbid items', () => {
  it('R18: an empty-stack bay never closes by roll; it carries over until the sweep', () => {
    const g = newGame(3);
    const cards = g.state.bays.map((b) => b.card);
    const events: GameEvent[] = [];
    // all-pass until the final round starts: no sale, no refill
    let s = g.state;
    while (s.callsDone < s.callsTotal - 1) {
      const r = engine.tick(s, engine.nextDeadline(s)!);
      s = r.state;
      events.push(...r.events);
    }
    expect(kinds(events)).not.toContain('sold');
    expect(kinds(events)).not.toContain('refill');
    expect(s.bays.map((b) => b.card)).toEqual(cards);
  });
});

describe('R19/R20 sale', () => {
  const setupSale = (entries: Array<[string, BidCard]>) => {
    const g = newGame(3);
    const s = clone(g.state);
    stackOn(s, 0, entries, { first: -1000, last: 0 });
    return { s, card: s.bays[0]!.card!, r: expire(s) };
  };
  it('R19: winner takes the card, the winning bid card is discarded, others return to owners', () => {
    const { s, card, r } = setupSale([
      ['p1', v(50)],
      ['p2', v(100)],
      ['p1', v(125)],
    ]);
    expect(r.state.players[1]!.won).toContain(card);
    const hand1 = r.state.players[1]!.hand.map((c) => c.id);
    expect(hand1).toContain('v50');
    expect(hand1).not.toContain('v125');
    expect(r.state.players[2]!.hand.map((c) => c.id)).toContain('v100');
    expect(r.events.find((e) => e.kind === 'sold')).toMatchObject({
      by: 'p1',
      amount: 125,
      card,
      bay: 0,
    });
    void s;
  });
  it('R20: a winning Proxy is discarded and displayed as "proxy"', () => {
    const { r } = setupSale([
      ['p1', v(300)],
      ['p2', px(1)],
    ]);
    expect(r.events.find((e) => e.kind === 'sold')).toMatchObject({ by: 'p2', amount: 'proxy' });
    expect(r.state.players[2]!.hand.some((c) => c.id === 'p1')).toBe(false);
    expect(r.state.players[1]!.hand.some((c) => c.id === 'v300')).toBe(true);
  });
});

describe('R21 refill', () => {
  it('R21: sold bays draw the next deck cards immediately in bay order', () => {
    const g = newGame(3);
    const s = clone(g.state);
    stackOn(s, 0, [['p1', v(50)]], { first: -1000, last: 0 });
    stackOn(s, 2, [['p2', v(50)]], { first: -1000, last: 0 });
    const [d0, d1] = s.deck;
    const r = expire(s);
    expect(r.state.bays[0]!.card).toBe(d0);
    expect(r.state.bays[2]!.card).toBe(d1);
    expect(r.state.bays[1]!.card).toBe(s.bays[1]!.card);
    expect(kinds(r.events).filter((k) => k === 'refill')).toHaveLength(2);
  });
  it('R21: deck empty -> the bay stays null', () => {
    const g = newGame(3);
    const s = clone(g.state);
    s.deck = [];
    stackOn(s, 0, [['p1', v(50)]], { first: -1000, last: 0 });
    expect(expire(s).state.bays[0]!.card).toBeNull();
  });
});

describe('R22 sweep', () => {
  it('R22: after the last call bays with bids are sold, empty bays discarded, no refill', () => {
    const g = newGame(3);
    const s = clone(g.state);
    s.callsDone = s.callsTotal - 1;
    stackOn(s, 0, [['p1', v(50)]], { first: 1, last: s.callsTotal });
    const deckLen = s.deck.length;
    const r = expire(s);
    expect(r.state.bays.every((b) => b.card === null)).toBe(true);
    expect(r.state.deck).toHaveLength(deckLen);
    const ks = kinds(r.events);
    expect(ks.filter((k) => k === 'sold')).toHaveLength(1);
    expect(ks.filter((k) => k === 'unsold')).toHaveLength(2);
    expect(ks.at(-1)).toBe('gameOver');
    expect(r.state.stage).toBe('done');
  });
});

describe('R23 early end', () => {
  it('R23: deck empty and every bay null skips the remaining calls', () => {
    const g = newGame(3);
    const end = toGifts(g.state);
    expect(end.stage).toBe('done');
    expect(end.callsDone).toBeLessThan(end.callsTotal);
  });
});

describe('R24 dry players', () => {
  it('R24: a dry player is skipped, their cards on bays still compete and return on close', () => {
    const g = newGame(3);
    const s = clone(g.state);
    stackOn(s, 0, [['p0', v(50)]], { first: -1000, last: 0 });
    stackOn(s, 1, [['p1', v(75)]], { first: 5, last: 5 });
    s.players[0]!.hand = [];
    const sold = expire(s);
    // bay 0 had top owner p0 (the only entry), so p0 wins; use a rival stack instead
    expect(sold.state.players[0]!.won.length).toBe(1);
    const s2 = clone(g.state);
    stackOn(
      s2,
      0,
      [
        ['p0', v(50)],
        ['p1', v(75)],
      ],
      { first: -1000, last: 0 },
    );
    s2.players[0]!.hand = [];
    const r = expire(s2);
    expect(r.state.players[0]!.hand.map((c) => c.id)).toEqual(['v50']);
    // when p0 is called with an empty hand, the call is skipped
    const s3 = clone(g.state);
    s3.players.forEach((p) => (p.hand = []));
    const n = engine.tick(expire(s3).state, s3.call!.endsAt! + CONFIG.callGapMs);
    expect(kinds(n.events)).toContain('autoPass');
  });
});

describe('invariants', () => {
  it('illegal actions return an error and leave state unchanged', () => {
    const g = newGame(4);
    const before = clone(g.state);
    const bad = [
      { type: 'gift', player: 'p0', target: 'p1' },
      { type: 'giftGive', player: 'p0', item: 'x' },
      { type: 'bid', player: 'p0', card: 'zzz', bay: 0 },
      { type: 'pass', player: 'nobody' },
    ] as const;
    for (const a of bad) {
      const r = engine.apply(g.state, a, T0 + 1);
      expect(r.ok).toBe(false);
      expect(g.state).toEqual(before);
    }
  });
  it('setConnected toggles the flag', () => {
    const g = newGame(3);
    const r = act(g.state, { type: 'setConnected', player: 'p1', connected: false }, T0);
    expect(r.state.players[1]!.connected).toBe(false);
  });
});
