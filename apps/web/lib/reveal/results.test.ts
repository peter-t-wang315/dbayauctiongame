import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { flipCount, giftLines, revealGroups, revealOrder, standings, type RevealRow } from './results';

const player = (id: string, name: string) => ({
  id,
  name,
  color: 'red' as const,
  shape: '●',
  connected: true,
  isBot: false,
  cardsInHand: 3,
  collection: [],
  gifts: 0,
});

function row(id: string, total: number, rank: number, tiebreak?: number, extra: Partial<RevealRow> = {}): RevealRow {
  return { id, items: [], displayCaseAssign: [], collections: [], total, rank, tiebreak, ...extra };
}

function view(rows: RevealRow[], me = 'a', giftLog: NonNullable<PlayerView['reveal']>['giftLog'] = []): PlayerView {
  return {
    code: 'ABCDE',
    phase: 'reveal',
    opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
    me,
    hostId: 'a',
    myHand: [],
    canAct: false,
    players: [player('a', 'Sam'), player('b', 'Pat'), player('c', 'Lee'), player('d', 'Kim')],
    bays: [],
    round: { n: 8, of: 8, halfway: true, last: true },
    deckLeft: 0,
    log: [],
    reveal: { players: rows, giftLog },
  };
}

describe('standings (R35)', () => {
  it('orders by rank, highest total first', () => {
    const s = standings(view([row('a', 900, 3, 0), row('b', 2140, 1, 0), row('c', 1980, 2, 0)]));
    expect(s.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(s.every((x) => x.tieNote === null)).toBe(true);
  });

  it('explains a tie split by unspent cards', () => {
    const s = standings(view([row('a', 1000, 2, 50), row('b', 1000, 1, 300), row('c', 400, 3, 0)]));
    expect(s.map((x) => [x.id, x.rank])).toEqual([
      ['b', 1],
      ['a', 2],
      ['c', 3],
    ]);
    expect(s[1]!.tieNote).toBe('Tie on $1000: Pat holds higher unspent cards ($300 vs $50).');
  });

  it('keeps a shared rank in seat order and notes it', () => {
    const s = standings(view([row('c', 800, 1, 100), row('a', 800, 1, 100), row('b', 200, 3, 0)]));
    expect(s.map((x) => [x.id, x.rank])).toEqual([
      ['a', 1],
      ['c', 1],
      ['b', 3],
    ]);
    expect(s[1]!.tieNote).toMatch(/^Shared rank/);
    expect(s[2]!.tieNote).toBeNull();
  });

  it('falls back to total and tiebreak when ranks are equal but values differ', () => {
    const s = standings(view([row('a', 500, 1, 10), row('b', 700, 1, 0)]));
    expect(s.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('is empty without reveal data', () => {
    const v = view([]);
    delete v.reveal;
    expect(standings(v)).toEqual([]);
  });
});

describe('revealGroups (R33, R34)', () => {
  it('groups by category, doubles collections and places Display Cases', () => {
    const r = row('a', 0, 1, 0, {
      items: [
        { card: 'toys-tin-robot', est: 60, actual: 20, tag: 'ripped' },
        { card: 'media-gramophone', est: 40, actual: 40, tag: null },
        { card: 'special-display-case-1', est: 100, actual: 100, tag: null },
        { card: 'special-display-case-2', est: 100, actual: 100, tag: null },
        { card: 'special-gift-1', est: 0, actual: 0, tag: null },
      ],
      displayCaseAssign: [
        { card: 'special-display-case-1', category: 'toys' },
        { card: 'special-display-case-2', category: null },
      ],
      collections: ['toys'],
    });
    const g = revealGroups(r);
    expect(g.map((x) => x.category)).toEqual(['toys', 'media', null]);
    expect(g[0]!.doubled).toBe(true);
    expect(g[0]!.cards.map((c) => c.scored)).toEqual([40, 200]);
    expect(g[0]!.subtotal).toBe(240);
    expect(g[1]!.doubled).toBe(false);
    expect(g[2]!.cards[0]!.displayCase).toBe(true);
    expect(g[2]!.subtotal).toBe(100);
    expect(g.flatMap((x) => x.cards).some((c) => c.card.startsWith('special-gift'))).toBe(false);
  });
});

describe('order, flips and gift lines', () => {
  it('reveals me first, then seat order', () => {
    const v = view([row('a', 1, 1), row('b', 1, 1), row('c', 1, 1)], 'b');
    expect(revealOrder(v).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('counts one flip per scorable card', () => {
    const items = [
      { card: 'toys-tin-robot', est: 60, actual: 20, tag: null },
      { card: 'special-gift-1', est: 0, actual: 0, tag: null },
    ];
    expect(flipCount(view([row('a', 0, 1, 0, { items }), row('b', 0, 1, 0, { items })]))).toBe(2);
  });

  it('describes gift outcomes', () => {
    const v = view([], 'a', [
      { holder: 'a', victim: 'b', card: 'toys-tin-robot' },
      { holder: 'c', victim: 'c', card: null },
    ]);
    const lines = giftLines(v);
    expect(lines[0]).toMatch(/^Sam took .+ from Pat with a Gift\.$/);
    expect(lines[1]).toBe("Lee's Gift fizzled.");
  });
});
