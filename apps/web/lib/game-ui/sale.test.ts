import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { newAnnouncements } from './announce';
import { newSales, SALE_FX, saleNote, toastFor } from './sale';

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

  it("someone else's sale: silent when it is the strip's newest line, spoken when a refill follows", () => {
    const last = makeView([log({ n: 5, kind: 'sold', by: 'kai', card: ROBOT, amount: 'proxy' })]);
    const [a] = newSales(last, 4).items;
    expect(a?.title).toBe('Kai won Wind-Up Tin Robot');
    expect(a?.detail).toBe('with a Proxy');
    expect(a?.speak).toBeNull();

    const followed = makeView([
      log({ n: 5, kind: 'sold', by: 'kai', card: ROBOT, amount: 80 }),
      log({ n: 6, kind: 'refill', bay: 0, card: 'toys-tin-robot' }),
    ]);
    expect(newSales(followed, 4).items[0]?.speak).toBe('Kai won Wind-Up Tin Robot for $80');
  });

  it('ignores non-sale entries and sales without a winner', () => {
    const v = makeView([
      log({ n: 2, kind: 'bid', by: 'kai', amount: 50 }),
      log({ n: 3, kind: 'unsold', card: ROBOT }),
      log({ n: 4, kind: 'sold', card: ROBOT }),
    ]);
    expect(newSales(v, 1).items).toEqual([]);
    expect(saleNote(v, log({ n: 9, kind: 'bid', by: 'kai' }), null)).toBeNull();
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
    // n=7 is the strip's newest line and n=6 is mine: only n=5 is read here.
    expect(t.speech).toBe('Kai won Wind-Up Tin Robot for $100');
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
