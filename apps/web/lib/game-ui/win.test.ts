import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { newWin, winCleared, winLine, wildTarget } from './win';
import { summarizeCollection } from './viewModel';

type Entry = PlayerView['log'][number];
const ME = 'me';
const e = (x: Partial<Entry> & { n: number; kind: Entry['kind'] }) => x as Entry;
const view = (log: Entry[]) =>
  ({
    phase: 'playing',
    stage: 'bidding',
    opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
    me: ME,
    players: [{ id: ME, name: 'Sam', color: 'red', shape: '●' }],
    bays: [],
    log,
  }) as unknown as PlayerView;

const won = e({ n: 5, kind: 'sold', by: ME, bay: 0, card: 'toys-pink-snake', amount: 100 });

describe('newWin', () => {
  it('first snapshot only sets the baseline (no cue from history)', () => {
    expect(newWin(view([won]), null)).toEqual({ lastN: 5, win: null });
  });
  it('my sale after the baseline gives a cue naming the item and category', () => {
    const r = newWin(view([won]), 4);
    expect(r.lastN).toBe(5);
    expect(r.win).toMatchObject({ n: 5, card: 'toys-pink-snake', category: 'toys', special: null });
    expect(r.win?.text).toMatch(/^You won .+!$/);
  });
  it("others' sales and already-seen sales give nothing", () => {
    expect(newWin(view([e({ n: 6, kind: 'sold', by: 'kai', card: 'media-violin' })]), 4).win).toBeNull();
    expect(newWin(view([won]), 5).win).toBeNull();
  });
  it('several wins in one snapshot: the newest', () => {
    const v = view([won, e({ n: 7, kind: 'sold', by: ME, card: 'media-violin' })]);
    expect(newWin(v, 4).win?.card).toBe('media-violin');
  });
  it('a won Gift is a special cue', () => {
    expect(newWin(view([e({ n: 6, kind: 'sold', by: ME, card: 'special-gift-1' })]), 5).win?.special).toBe('gift');
  });
});

describe('winCleared', () => {
  const cue = newWin(view([won]), 4).win!;
  it('stays through other players, refills and outbids', () => {
    const v = view([
      won,
      e({ n: 6, kind: 'bid', by: 'kai' }),
      e({ n: 7, kind: 'turn', by: 'kai' }),
      e({ n: 8, kind: 'refill', bay: 0 }),
    ]);
    expect(winCleared(v, cue)).toBe(false);
  });
  it('ends on my next bid, pass, skip or turn', () => {
    for (const kind of ['bid', 'pass', 'autoPass', 'turn'] as const) {
      expect(winCleared(view([won, e({ n: 6, kind, by: ME })]), cue)).toBe(true);
    }
  });
});

describe('winLine', () => {
  const cue = newWin(view([won]), 4).win!;
  it('shows the win text; null without a cue', () => {
    expect(winLine(view([won]), cue, 5)).toBe(cue.text);
    expect(winLine(view([won]), null, 5)).toBeNull();
  });
  it('a newer urgent entry for me (outbid) replaces it; a newer calm one does not', () => {
    const out = view([won, e({ n: 6, kind: 'outbid', by: ME, bay: 1 })]);
    expect(winLine(out, cue, 6)).toBeNull();
    const calm = view([won, e({ n: 6, kind: 'bid', by: 'kai' })]);
    expect(winLine(calm, cue, 6)).toBe(cue.text);
  });
});

describe('wildTarget', () => {
  it('names the best set, ties by category order; null with no items', () => {
    expect(wildTarget(summarizeCollection([]))).toBeNull();
    const s = summarizeCollection(['media-violin', 'toys-pink-snake', 'toys-bean-bag-bear']);
    expect(wildTarget(s)).toMatchObject({ category: 'toys', count: 2 });
    expect(wildTarget(summarizeCollection(['media-violin', 'toys-pink-snake']))?.category).toBe('toys');
  });
});
