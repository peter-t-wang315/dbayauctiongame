import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { newAnnouncements } from './announce';
import { isSaleEntry, newSales, SALE_FX, saleNote, toastFor } from './sale';

type Entry = PlayerView['log'][number];
const ME = 'me';
const log = (x: Partial<Entry> & { n: number; kind: Entry['kind'] }) => x as Entry;
const player = (id: string, name: string, color: string, shape: string) => ({
  id,
  name,
  color,
  shape,
  connected: true,
  isBot: false,
  cardsInHand: 10,
  collection: [],
  gifts: 0,
});

function makeView(entries: Entry[]): PlayerView {
  return {
    phase: 'playing',
    stage: 'bidding',
    opts: { mode: 'frenzy', relaxed: false, bidWindowMs: 5000 },
    me: ME,
    players: [player(ME, 'Sam', 'red', '●'), player('kai', 'Kai', 'teal', '✚')],
    bays: [],
    log: entries,
  } as unknown as PlayerView;
}

const ROBOT = 'toys-tin-robot';

describe('sale toast', () => {
  it('timings: the stamp holds longer than the old 1.3s, the toast a bit longer still', () => {
    expect(SALE_FX.stampHoldMs).toBeGreaterThan(1300);
    expect(SALE_FX.toastMs).toBeGreaterThan(SALE_FX.stampHoldMs);
  });

  it('first snapshot only sets the baseline (no toast for history)', () => {
    const v = makeView([log({ n: 3, kind: 'sold', by: 'kai', card: ROBOT, amount: 80 })]);
    expect(newSales(v, null)).toEqual({ lastN: 3, items: [] });
  });

  it('my win: "You won {item}!", not spoken (announce.ts reads it assertively)', () => {
    const v = makeView([log({ n: 5, kind: 'sold', by: ME, card: ROBOT, bay: 0, amount: 80 })]);
    const r = newSales(v, 4);
    expect(r.lastN).toBe(5);
    expect(r.items).toEqual([
      {
        n: 5,
        bay: 0,
        mine: true,
        title: 'You won Wind-Up Tin Robot!',
        detail: 'for $80',
        color: 'red',
        shape: '●',
        speak: null,
      },
    ]);
    expect(newAnnouncements(v, 4).items.map((i) => i.text)).toEqual(['Sold to you: Wind-Up Tin Robot']);
    expect(newSales(v, r.lastN).items).toEqual([]);
  });

  it("someone else's sale is spoken politely by the toast; the strip silences sale lines", () => {
    const v = makeView([
      log({ n: 5, kind: 'sold', by: 'kai', card: ROBOT, amount: 'proxy' }),
      log({ n: 6, kind: 'refill', bay: 0, card: ROBOT }),
    ]);
    const [a] = newSales(v, 4).items;
    expect(a?.title).toBe('Kai won Wind-Up Tin Robot');
    expect(a?.detail).toBe('with a Proxy');
    expect(a?.speak).toBe('Kai won Wind-Up Tin Robot with a Proxy');
    expect(isSaleEntry(v, 5)).toBe(true);
    expect(isSaleEntry(v, 6)).toBe(false);
    expect(isSaleEntry(v, 99)).toBe(false);
    // Sales to me are announced assertively (announce.ts) and are also silenced in the strip.
    expect(newAnnouncements(v, 4).items).toEqual([]);
  });

  it('ignores non-sale entries and sales without a winner', () => {
    const v = makeView([
      log({ n: 2, kind: 'bid', by: 'kai', amount: 50 }),
      log({ n: 3, kind: 'unsold', card: ROBOT }),
      log({ n: 4, kind: 'sold', card: ROBOT }),
    ]);
    expect(newSales(v, 1).items).toEqual([]);
    expect(saleNote(v, log({ n: 9, kind: 'bid', by: 'kai' }))).toBeNull();
    expect(isSaleEntry(v, 4)).toBe(false);
  });

  it('a batch shows my newest win first, counts the rest, and speaks only the unread ones', () => {
    const v = makeView([
      log({ n: 5, kind: 'sold', by: 'kai', card: ROBOT, amount: 100 }),
      log({ n: 6, kind: 'sold', by: ME, card: ROBOT, amount: 50 }),
      log({ n: 7, kind: 'sold', by: 'kai', card: ROBOT, amount: 25 }),
    ]);
    const t = toastFor(newSales(v, 4).items)!;
    expect(t.key).toBe(6);
    expect(t.main.mine).toBe(true);
    expect(t.more).toBe(2);
    // n=6 is mine (read assertively elsewhere): only the other two are read here, in order.
    expect(t.speech).toBe('Kai won Wind-Up Tin Robot for $100. Kai won Wind-Up Tin Robot for $25');
  });

  it('no sales, no toast; otherwise the newest sale', () => {
    expect(toastFor([])).toBeNull();
    const v = makeView([
      log({ n: 5, kind: 'sold', by: 'kai', card: ROBOT, amount: 100 }),
      log({ n: 6, kind: 'sold', by: 'kai', card: ROBOT }),
    ]);
    const t = toastFor(newSales(v, 4).items)!;
    expect(t.key).toBe(6);
    expect(t.main.detail).toBe('');
  });
});
