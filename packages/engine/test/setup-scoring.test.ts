import { describe, expect, it } from 'vitest';
import { fixturePack } from '@dbay/content';
import { CATEGORY_IDS } from '@dbay/protocol';
import { LENGTH_PRESETS, type PlayerCount } from '../src/config';
import { indexPack } from '../src/pack';
import { hashString, initRng, nextFloat, shuffle } from '../src/rng';
import { scoreCards, scoreGame } from '../src/scoring';
import { initState } from '../src/setup';
import { synthPack } from '../src/testing/synthPack';
import { mkSetup } from './helpers';

const idx = indexPack(synthPack());

describe('R1 bays by player count', () => {
  it.each([
    [3, 3],
    [4, 3],
    [5, 4],
    [6, 4],
  ])('R1: %i players -> %i bays', (n, bays) => {
    expect(initState(idx, mkSetup(n), 0).bays).toHaveLength(bays);
  });
});

describe('R2 bid cards', () => {
  it('R2: each player has 10 face values and 2 Proxies, identical sets', () => {
    const s = initState(idx, mkSetup(4), 0);
    for (const p of s.players) {
      expect(p.hand).toHaveLength(12);
      expect(p.hand.filter((c) => c.kind === 'proxy')).toHaveLength(2);
      expect(p.hand.filter((c) => c.kind === 'value').map((c) => c.value)).toEqual([
        10, 25, 50, 75, 100, 125, 150, 200, 250, 300,
      ]);
      expect(p.hand.find((c) => c.kind === 'proxy')?.value).toBeUndefined();
      expect(p.hand).toEqual(s.players[0]?.hand);
    }
  });

  it('R2: bot seats are dealt exactly the same hand as humans', () => {
    const setup = mkSetup(4);
    setup.players = setup.players.map((p, i) => ({ ...p, isBot: i > 0 }));
    const s = initState(idx, setup, 0);
    const human = s.players.find((p) => !p.isBot)!;
    expect(s.players.filter((p) => p.isBot)).toHaveLength(3);
    for (const p of s.players) expect(p.hand).toEqual(human.hand);
  });
});

describe('R3/R4 deck build', () => {
  it('R3: synthetic pool has 6 categories x 10 items and 5 DC + 4 Gift', () => {
    expect(idx.categories).toHaveLength(6);
    for (const c of idx.categories) expect(idx.itemsByCategory.get(c)).toHaveLength(10);
    expect(idx.displayCases).toHaveLength(5);
    expect(idx.gifts).toHaveLength(4);
  });
  const cases = (['quick', 'standard'] as const).flatMap((l) =>
    ([3, 4, 5, 6] as PlayerCount[]).map((n) => [l, n] as const),
  );
  it.each(cases)('R4: %s deck for %i players follows the table', (length, n) => {
    const s = initState(idx, { ...mkSetup(n), length }, 0);
    const all = [...s.bays.map((b) => b.card as string), ...s.deck];
    const spec = LENGTH_PRESETS[length].DECK_BY_PLAYERS[n];
    expect(all).toHaveLength(spec.items + spec.displayCase + spec.gift);
    expect(new Set(all).size).toBe(all.length);
    const items = all.filter((id) => idx.cards.get(id)?.kind === 'item');
    expect(items).toHaveLength(spec.items);
    expect(all.filter((id) => idx.cards.get(id)?.kind === 'displayCase')).toHaveLength(
      spec.displayCase,
    );
    expect(all.filter((id) => idx.cards.get(id)?.kind === 'gift')).toHaveLength(spec.gift);
    const perCat = new Map<string, number>();
    for (const id of items) {
      const c = idx.cards.get(id)?.category as string;
      perCat.set(c, (perCat.get(c) ?? 0) + 1);
    }
    expect(perCat.size).toBe(spec.catsInPlay);
    const counts = [...perCat.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    // enough items for the categories in play: catsInPlay <= 6 and ceil(items / cats) <= 10 per category
    expect(spec.catsInPlay).toBeLessThanOrEqual(6);
    expect(Math.ceil(spec.items / spec.catsInPlay)).toBeLessThanOrEqual(10);
    expect(spec.displayCase).toBeLessThanOrEqual(idx.displayCases.length);
    expect(spec.gift).toBeLessThanOrEqual(idx.gifts.length);
  });
  it.each(([3, 4, 5, 6] as PlayerCount[]).map((n) => [n]))(
    'R4: Standard has more deck cards per player than Quick at %i players',
    (n) => {
      const per = (l: 'quick' | 'standard') => {
        const d = LENGTH_PRESETS[l].DECK_BY_PLAYERS[n];
        return (d.items + d.displayCase + d.gift) / n;
      };
      expect(per('quick')).toBeGreaterThanOrEqual(5.5);
      expect(per('quick')).toBeLessThanOrEqual(6.5);
      expect(per('standard')).toBeGreaterThanOrEqual(7.5);
      expect(per('standard')).toBeLessThanOrEqual(8.5);
    },
  );
  it('R4: a tiny pack (WS0 fixture) still builds a deck', () => {
    const s = initState(indexPack(fixturePack), mkSetup(3), 0);
    expect(s.deckSize).toBe(5);
  });
});

describe('R5 initial bays', () => {
  it('R5: bays 0..n-1 take the deck top in order; specials may appear anywhere', () => {
    const s = initState(idx, mkSetup(3), 0);
    expect(s.bays.map((b) => b.idx)).toEqual([0, 1, 2]);
    expect(s.bays.every((b) => b.card !== null && b.stack.length === 0)).toBe(true);
    expect(s.deck).toHaveLength(s.deckSize - 3);
    expect(s.deck).not.toContain(s.bays[0]?.card);
  });
});

describe('R6 RNG', () => {
  it('R6: same seed gives the same deck; different seeds differ', () => {
    expect(initState(idx, mkSetup(4, 'a'), 0)).toEqual(initState(idx, mkSetup(4, 'a'), 0));
    expect(initState(idx, mkSetup(4, 'a'), 0).deck).not.toEqual(
      initState(idx, mkSetup(4, 'b'), 0).deck,
    );
  });
  it('R6: streams are independent (drawing from one does not move another)', () => {
    const a = initRng('x');
    const b = initRng('x');
    nextFloat(a, 'calls');
    nextFloat(a, 'calls');
    expect(a.deck).toBe(b.deck);
    expect(a.closes).toBe(b.closes);
    expect(a.calls).not.toBe(b.calls);
    expect(hashString('x|deck')).toBe(b.deck);
  });
  it('R6: floats are in [0,1) and shuffle is a permutation', () => {
    const r = initRng('z');
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(r, 'misc');
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
    expect(shuffle(r, 'deck', [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('scoring R32-R36', () => {
  const pack = synthPack();
  const byCat = (cat: string) => pack.items.filter((i) => i.category === cat).map((i) => i.id);
  it('R32: actual values fixed; Display Case is 100; Gift is not scorable', () => {
    expect(scoreCards(idx, ['special-display-case-1']).total).toBe(100);
    expect(scoreCards(idx, ['special-gift-1']).total).toBe(0);
  });
  it('R33: 3+ of a category doubles every card in it; several collections allowed', () => {
    const toys = byCat('toys').slice(0, 3);
    const media = byCat('media').slice(0, 3);
    const raw = (ids: string[]) => ids.reduce((s, id) => s + (idx.cards.get(id)?.actual ?? 0), 0);
    const r = scoreCards(idx, [...toys, ...media]);
    expect(r.total).toBe(2 * raw(toys) + 2 * raw(media));
    expect(r.collections).toEqual(['toys', 'media']);
    expect(scoreCards(idx, toys.slice(0, 2)).total).toBe(raw(toys.slice(0, 2)));
  });
  it('R34: Display Case goes where it maximizes the total, and a doubled DC scores 200', () => {
    const toys = byCat('toys').slice(0, 2);
    const raw = toys.reduce((s, id) => s + (idx.cards.get(id)?.actual ?? 0), 0);
    const r = scoreCards(idx, [...toys, 'special-display-case-1']);
    expect(r.total).toBe((raw + 100) * 2);
    expect(r.assign).toEqual([{ card: 'special-display-case-1', category: 'toys' }]);
  });
  it('R34: a collection needs at least one real item; unhelpful DCs stay unassigned', () => {
    const r = scoreCards(idx, [
      'special-display-case-1',
      'special-display-case-2',
      'special-display-case-3',
    ]);
    expect(r.total).toBe(300);
    expect(r.collections).toEqual([]);
    expect(r.assign.every((a) => a.category === 'toys')).toBe(true); // all tie: lowest index
  });
  it('R34: ties choose the lowest category index', () => {
    // Assigning cannot help, so every option ties: the lowest category index (toys) wins.
    const r = scoreCards(idx, [byCat('toys')[0] as string, 'special-display-case-1']);
    expect(r.assign[0]?.category).toBe('toys');
  });
  it('R34: worked example from 01 section 10 totals 820', () => {
    const mk = (id: string, category: string, estimatedValue: number, actualValue: number) => ({
      id,
      category,
      estimatedValue,
      actualValue,
    });
    const items = [
      mk('toys-a', 'toys', 40, 40),
      mk('toys-b', 'toys', 60, 60),
      mk('toys-c', 'toys', 35, 35),
      mk('glass-d', 'glass', 80, 80),
      mk('glass-e', 'glass', 50, 50),
      mk('media-f', 'media', 90, 90),
    ];
    const p = synthPack();
    p.items = items.map((i) => ({
      ...(p.items[0] as (typeof p.items)[number]),
      ...i,
      category: i.category as 'toys',
    }));
    const r = scoreCards(indexPack(p), [...items.map((i) => i.id), 'special-display-case-1']);
    expect(r.total).toBe(820);
    expect(r.assign[0]?.category).toBe('glass');
  });
  it('R35: highest total wins, tiebreak by hand value (Proxy = 0), equal = shared rank', () => {
    const s = initState(idx, mkSetup(3), 0);
    const dc = 'special-display-case-1';
    s.players[0]!.won = [dc];
    s.players[1]!.won = [dc];
    s.players[2]!.won = [];
    s.players[0]!.hand = [{ id: 'v10', kind: 'value', value: 10 }];
    s.players[1]!.hand = [
      { id: 'v10', kind: 'value', value: 10 },
      { id: 'p1', kind: 'proxy' },
    ];
    s.players[2]!.hand = [{ id: 'v300', kind: 'value', value: 300 }];
    const res = scoreGame(idx, s);
    expect(res.players.map((p) => [p.id, p.rank, p.tiebreak])).toEqual([
      ['p0', 1, 10],
      ['p1', 1, 10],
      ['p2', 3, 300],
    ]);
  });
  it('R35: a higher tiebreak ranks first', () => {
    const s = initState(idx, mkSetup(3), 0);
    s.players[0]!.won = ['special-display-case-1'];
    s.players[1]!.won = ['special-display-case-2'];
    s.players[0]!.hand = [{ id: 'v10', kind: 'value', value: 10 }];
    s.players[1]!.hand = [{ id: 'v25', kind: 'value', value: 25 }];
    const res = scoreGame(idx, s);
    expect(res.players.map((p) => p.id).slice(0, 2)).toEqual(['p1', 'p0']);
    expect(res.players.map((p) => p.rank)).toEqual([1, 2, 3]);
  });
  it('R36: reveal data exposes est, actual and STEAL!/Ripped off! tags', () => {
    const p = synthPack();
    const base = p.items[0] as (typeof p.items)[number];
    p.items = [
      {
        ...base,
        id: 'toys-s',
        category: 'toys',
        estimatedValue: 40,
        actualValue: 85,
        tier: 'good',
      },
      { ...base, id: 'toys-r', category: 'toys', estimatedValue: 60, actualValue: 20, tier: 'dud' },
      {
        ...base,
        id: 'toys-f',
        category: 'toys',
        estimatedValue: 50,
        actualValue: 50,
        tier: 'fair',
      },
    ];
    const i2 = indexPack(p);
    const s = initState(idx, mkSetup(3), 0);
    s.players[0]!.won = ['toys-s', 'toys-r', 'toys-f', 'special-display-case-1'];
    const res = scoreGame(i2, s);
    const mine = res.players.find((x) => x.id === 'p0')!;
    expect(mine.items.map((x) => [x.card, x.est, x.actual, x.tag])).toEqual([
      ['toys-f', 50, 50, null],
      ['toys-r', 60, 20, 'ripped'],
      ['toys-s', 40, 85, 'steal'],
      ['special-display-case-1', 100, 100, null],
    ]);
    expect(CATEGORY_IDS).toContain(mine.collections[0]);
  });
});
