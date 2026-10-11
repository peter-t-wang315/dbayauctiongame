import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import type { EngineState } from '../src/types';
import {
  T0,
  act,
  clone,
  engine,
  kinds,
  mkSetup,
  newGame,
  player,
  px,
  stackOn,
  toGifts,
  v,
} from './helpers';

const est = (id: string) => engine.index.cards.get(id)!.est;

/** A 4-player game moved to the gifts stage after `mutate` edits holdings. */
function scenario(
  mutate: (s: EngineState) => void,
  setupOpts: Partial<ReturnType<typeof mkSetup>> = {},
) {
  const g = engine.setup({ ...mkSetup(4), ...setupOpts }, T0);
  const s = clone(g.state);
  mutate(s);
  return toGifts(s, T0);
}

const giveGift = (s: EngineState, who: string, card: string, seq: number) => {
  player(s, who).gifts.push(card);
  s.giftSales[card] = seq;
};

describe('R25 specials are auctioned like items', () => {
  it('R25: a Display Case and a Gift can sit in a bay, be bid on and sold', () => {
    const g = newGame(3);
    const s = clone(g.state);
    s.bays[0]!.card = 'special-display-case-1';
    s.bays[1]!.card = 'special-gift-1';
    stackOn(s, 0, [['p1', v(10)]]);
    stackOn(s, 1, [['p2', v(10)]]);
    for (const b of s.bays) {
      b.firstBidCall = -1000;
      b.lastBidCall = 0;
    }
    const r = engine.tick(s, s.call!.endsAt!);
    expect(r.state.players[1]!.won).toContain('special-display-case-1');
    expect(r.state.players[2]!.gifts).toEqual(['special-gift-1']);
    expect(r.state.players[2]!.won).not.toContain('special-gift-1');
    expect(r.state.giftSales['special-gift-1']).toBeGreaterThan(0);
    expect(kinds(r.events).filter((k) => k === 'special')).toHaveLength(2);
  });
});

describe('R26 Display Case', () => {
  it('R26: wild for one category, fixed $100, scorable', () => {
    const end = scenario((s) => {
      player(s, 'p0').won = ['toys-item-1', 'toys-item-2', 'special-display-case-1'];
    });
    const res = engine.score(end).players.find((p) => p.id === 'p0')!;
    expect(res.collections).toEqual(['toys']);
    expect(res.displayCaseAssign).toEqual([{ card: 'special-display-case-1', category: 'toys' }]);
    const dc = res.items.find((i) => i.card === 'special-display-case-1')!;
    expect([dc.est, dc.actual]).toEqual([100, 100]);
  });
});

describe('R27 Gift is not an item', () => {
  it('R27: value 0, not scorable, consumed on resolution', () => {
    const end = scenario((s) => {
      player(s, 'p0').won = ['toys-item-1'];
      giveGift(s, 'p1', 'special-gift-1', 1);
    });
    const done = engine.tick(
      act(
        act(end, { type: 'gift', player: 'p1', target: 'p0' }, T0 + 5).state,
        { type: 'giftGive', player: 'p0', item: 'toys-item-1' },
        T0 + 6,
      ).state,
      T0 + 7,
    ).state;
    expect(done.stage).toBe('done');
    expect(player(done, 'p1').gifts).toEqual([]);
    expect(
      engine.score(done).players.every((p) => !p.items.some((i) => i.card === 'special-gift-1')),
    ).toBe(true);
  });
});

describe('R28 gift order', () => {
  it('R28: Gifts resolve in the order they were sold, not by seat', () => {
    const end = scenario((s) => {
      player(s, 'p3').won = ['toys-item-1'];
      giveGift(s, 'p0', 'special-gift-1', 7);
      giveGift(s, 'p2', 'special-gift-2', 3);
    });
    expect(end.stage).toBe('gifts');
    expect(end.gift).toMatchObject({
      holder: 'p2',
      giftCard: 'special-gift-2',
      stage: 'pickTarget',
    });
  });
});

describe('R29 gift target', () => {
  const base = (s: EngineState) => {
    player(s, 'p1').won = ['toys-item-1'];
    giveGift(s, 'p0', 'special-gift-1', 1);
  };
  it('R29: target must be another player with at least one scorable card', () => {
    const end = scenario(base);
    expect(engine.apply(end, { type: 'gift', player: 'p0', target: 'p0' }, T0 + 5)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    });
    expect(engine.apply(end, { type: 'gift', player: 'p0', target: 'p2' }, T0 + 5)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    });
    expect(engine.apply(end, { type: 'gift', player: 'p1', target: 'p0' }, T0 + 5)).toEqual({
      ok: false,
      code: 'NOT_YOUR_TURN',
    });
    expect(
      engine.apply(end, { type: 'giftGive', player: 'p1', item: 'toys-item-1' }, T0 + 5),
    ).toEqual({ ok: false, code: 'WRONG_PHASE' });
    const ok = act(end, { type: 'gift', player: 'p0', target: 'p1' }, T0 + 5);
    expect(ok.state.gift).toMatchObject({ stage: 'pickItem', victim: 'p1', holder: 'p0' });
  });
  it('R29: with no eligible target the Gift fizzles', () => {
    const end = scenario((s) => giveGift(s, 'p0', 'special-gift-1', 1));
    expect(end.stage).toBe('done');
    expect(end.giftLog).toEqual([{ holder: 'p0', victim: 'p0', card: null }]);
    expect(player(end, 'p0').gifts).toEqual([]);
  });
  it('R29: timeout picks a random eligible target; deadline is giftChoiceMs (x1.5 Relaxed)', () => {
    const end = scenario((s) => {
      player(s, 'p1').won = ['toys-item-1'];
      player(s, 'p2').won = ['toys-item-2'];
      giveGift(s, 'p0', 'special-gift-1', 1);
    });
    const at = end.gift!.endsAt;
    expect(at).toBe(T0 + 1 + CONFIG.giftChoiceMs);
    const r = engine.tick(end, at);
    expect(r.state.gift?.stage).toBe('pickItem');
    expect(['p1', 'p2']).toContain(r.state.gift?.victim);
    expect(engine.apply(end, { type: 'gift', player: 'p0', target: 'p1' }, at)).toEqual({
      ok: false,
      code: 'TOO_LATE',
    });
    const relaxed = scenario(base, { relaxed: true });
    expect(relaxed.gift!.endsAt).toBe(T0 + 1 + CONFIG.giftChoiceMs * 1.5);
  });
});

describe('R30 gift give', () => {
  const base = (s: EngineState) => {
    player(s, 'p1').won = ['toys-item-1', 'toys-item-2', 'special-display-case-1'];
    giveGift(s, 'p0', 'special-gift-1', 1);
  };
  it('R30: the target picks one scorable card; never a Gift; the holder receives it', () => {
    const end = scenario(base);
    const t = act(end, { type: 'gift', player: 'p0', target: 'p1' }, T0 + 5).state;
    expect(engine.apply(t, { type: 'giftGive', player: 'p1', item: 'nope' }, T0 + 6)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    });
    expect(
      engine.apply(t, { type: 'giftGive', player: 'p0', item: 'toys-item-1' }, T0 + 6),
    ).toEqual({ ok: false, code: 'NOT_YOUR_TURN' });
    const r = act(
      t,
      { type: 'giftGive', player: 'p1', item: 'special-display-case-1' },
      T0 + 6,
    ).state;
    expect(player(r, 'p0').won).toEqual(['special-display-case-1']);
    expect(player(r, 'p1').won).toEqual(['toys-item-1', 'toys-item-2']);
    expect(r.giftLog).toEqual([{ holder: 'p0', victim: 'p1', card: 'special-display-case-1' }]);
    expect(r.stage).toBe('done');
  });
  it('R30: timeout auto-gives the lowest estValue card (Display Case = 100; tie -> lowest id)', () => {
    const end = scenario(base);
    const t = act(end, { type: 'gift', player: 'p0', target: 'p1' }, T0 + 5).state;
    const cheapest = ['toys-item-1', 'toys-item-2', 'special-display-case-1']
      .map((id) => ({ id, est: est(id) }))
      .sort((a, b) => a.est - b.est || (a.id < b.id ? -1 : 1))[0]!.id;
    const r = engine.tick(t, t.gift!.endsAt);
    expect(player(r.state, 'p0').won).toEqual([cheapest]);
  });
  it('R30: disconnected players take the timeout default instantly', () => {
    const end = scenario(base);
    const t = act(end, { type: 'gift', player: 'p0', target: 'p1' }, T0 + 5).state;
    const r = act(t, { type: 'setConnected', player: 'p1', connected: false }, T0 + 6).state;
    expect(r.stage).toBe('done');
    expect(player(r, 'p0').won).toHaveLength(1);
    // a disconnected holder is auto-resolved the moment the Gift step starts
    const dis = scenario((s) => {
      base(s);
      player(s, 'p0').connected = false;
    });
    // the disconnected holder's target step is skipped; the connected victim now chooses
    expect(dis.gift).toMatchObject({ stage: 'pickItem', holder: 'p0', victim: 'p1' });
  });
});

describe('R31 multiple Gifts and Gift-on-Gift', () => {
  it('R31: strictly sequential; a card received by Gift can be taken by a later Gift', () => {
    const end = scenario((s) => {
      player(s, 'p1').won = ['toys-item-1'];
      giveGift(s, 'p0', 'special-gift-1', 1);
      giveGift(s, 'p2', 'special-gift-2', 2);
    });
    expect(end.gift?.holder).toBe('p0');
    let s = act(end, { type: 'gift', player: 'p0', target: 'p1' }, T0 + 5).state;
    s = act(s, { type: 'giftGive', player: 'p1', item: 'toys-item-1' }, T0 + 6).state;
    expect(s.gift).toMatchObject({ holder: 'p2', giftCard: 'special-gift-2', stage: 'pickTarget' });
    // p1 is no longer eligible, p0 now holds the item
    expect(engine.apply(s, { type: 'gift', player: 'p2', target: 'p1' }, T0 + 7).ok).toBe(false);
    s = act(s, { type: 'gift', player: 'p2', target: 'p0' }, T0 + 7).state;
    s = act(s, { type: 'giftGive', player: 'p0', item: 'toys-item-1' }, T0 + 8).state;
    expect(player(s, 'p2').won).toEqual(['toys-item-1']);
    expect(s.stage).toBe('done');
    expect(s.giftLog).toHaveLength(2);
  });
  it('R31: a holder with several Gifts resolves each in turn', () => {
    const end = scenario((s) => {
      player(s, 'p1').won = ['toys-item-1', 'toys-item-2'];
      giveGift(s, 'p0', 'special-gift-1', 1);
      giveGift(s, 'p0', 'special-gift-2', 2);
    });
    const done = engine.tick(end, end.gift!.endsAt + 3 * CONFIG.giftChoiceMs).state;
    expect(done.stage).toBe('done');
    expect(player(done, 'p0').won).toHaveLength(2);
    expect(player(done, 'p0').gifts).toEqual([]);
  });
});

describe('R37 reveal to ended', () => {
  it('R37: reveal lasts revealBaseMs + revealPerCardMs x scorable cards', () => {
    const end = scenario((s) => {
      player(s, 'p0').won = ['toys-item-1', 'toys-item-2'];
      player(s, 'p1').won = ['special-display-case-1'];
    });
    expect(engine.revealDelayMs(end)).toBe(CONFIG.revealBaseMs + 3 * CONFIG.revealPerCardMs);
    expect(engine.nextDeadline(end)).toBeNull();
  });
  it('R37: score() carries the full results (actual values, scores, ranks) once stage is done', () => {
    const end = scenario((s) => {
      player(s, 'p0').won = ['toys-item-1'];
    });
    const res = engine.score(end);
    expect(res.players[0]).toMatchObject({ id: 'p0', rank: 1 });
    expect(res.players[0]!.items[0]!.actual).toBe(engine.index.cards.get('toys-item-1')!.actual);
  });
});

void px;
