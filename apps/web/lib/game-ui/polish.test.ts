import { describe, expect, it, vi } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { isUrgentEntry, newAnnouncements } from './announce';
import { itemDetails } from './itemDetails';
import { createLongPress } from './longPress';

type Entry = PlayerView['log'][number];
const ME = 'me';
const log = (x: Partial<Entry> & { n: number; kind: Entry['kind'] }) => x as Entry;

function makeView(over: Partial<PlayerView> = {}): PlayerView {
  return {
    code: 'ABCDE',
    phase: 'playing',
    stage: 'bidding',
    opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
    me: ME,
    hostId: ME,
    myHand: [],
    canAct: true,
    players: [
      { id: ME, name: 'Sam', color: 'red', shape: '●', connected: true, isBot: false, cardsInHand: 3, collection: [], gifts: 0 },
      { id: 'pat', name: 'Pat', color: 'blue', shape: '▲', connected: true, isBot: false, cardsInHand: 12, collection: [], gifts: 0 },
    ],
    bays: [{ idx: 0, card: 'toys-tin-robot', stack: [], topBid: { by: 'pat', kind: 'value', value: 50 } }],
    round: { n: 3, of: 8, halfway: false, last: false },
    deckLeft: 10,
    log: [],
    ...over,
  } as PlayerView;
}

describe('assertive announcements', () => {
  it('first snapshot only sets a baseline', () => {
    const v = makeView({ log: [log({ n: 4, kind: 'turn', by: ME })] });
    expect(newAnnouncements(v, null)).toEqual({ lastN: 4, items: [] });
  });
  it('announces my turn (Classic), outbid with bay letter, and sold to me; once each', () => {
    const v = makeView({
      log: [
        log({ n: 5, kind: 'turn', by: ME }),
        log({ n: 6, kind: 'outbid', by: ME, bay: 1 }),
        log({ n: 7, kind: 'sold', by: ME, bay: 0, amount: 50 }),
      ],
    });
    const r = newAnnouncements(v, 4);
    expect(r.items.map((i) => i.text)).toEqual(['Your turn', 'You were outbid on bay B', 'Sold to you']);
    expect(newAnnouncements(v, r.lastN).items).toEqual([]);
  });
  it('ignores other players, non-urgent kinds, and Frenzy turns', () => {
    const v = makeView({
      log: [log({ n: 2, kind: 'turn', by: 'pat' }), log({ n: 3, kind: 'bid', by: ME }), log({ n: 4, kind: 'sold', by: 'pat' })],
    });
    expect(newAnnouncements(v, 1).items).toEqual([]);
    const f = makeView({
      opts: { mode: 'frenzy', relaxed: false, bidWindowMs: 5000 },
      log: [log({ n: 2, kind: 'turn', by: ME })],
    });
    expect(newAnnouncements(f, 1).items).toEqual([]);
  });
  it('isUrgentEntry marks entries the polite strip should not repeat', () => {
    const v = makeView({ log: [log({ n: 2, kind: 'sold', by: ME }), log({ n: 3, kind: 'bid', by: ME })] });
    expect(isUrgentEntry(v, 2)).toBe(true);
    expect(isUrgentEntry(v, 3)).toBe(false);
  });
});

describe('itemDetails', () => {
  it('shows estimate, category, flavor and the top bid; empty bay is null', () => {
    const d = itemDetails(makeView(), 0)!;
    expect(d.name).toBeTruthy();
    expect(typeof d.est).toBe('number');
    expect(d.category).toBeTruthy();
    expect(d.topLabel).toBe('$50');
    expect(d.topBy?.name).toBe('Pat');
    expect(Object.keys(d)).not.toContain('actualValue');
    expect(itemDetails(makeView({ bays: [{ idx: 0, card: null, stack: [], topBid: null }] as PlayerView['bays'] }), 0)).toBeNull();
  });
});

describe('createLongPress', () => {
  function harness() {
    const timers: { fn: () => void; ms: number; live: boolean }[] = [];
    const onLong = vi.fn();
    const lp = createLongPress(onLong, {
      set: (fn, ms) => {
        const t = { fn, ms, live: true };
        timers.push(t);
        return t;
      },
      clear: (h) => {
        (h as { live: boolean }).live = false;
      },
    });
    const fire = () =>
      timers
        .filter((t) => t.live)
        .forEach((t) => {
          t.live = false;
          t.fn();
        });
    return { lp, onLong, fire, timers };
  }
  it('fires after 450ms and swallows the following click once', () => {
    const { lp, onLong, fire, timers } = harness();
    lp.down(10, 10);
    expect(timers[0]!.ms).toBe(450);
    fire();
    expect(onLong).toHaveBeenCalledTimes(1);
    expect(lp.up()).toBe(true);
    expect(lp.up()).toBe(false);
  });
  it('a normal tap does not fire and does not swallow the click', () => {
    const { lp, onLong, fire } = harness();
    lp.down(10, 10);
    expect(lp.up()).toBe(false);
    fire();
    expect(onLong).not.toHaveBeenCalled();
  });
  it('moving past the slop cancels; small jitter does not', () => {
    const a = harness();
    a.lp.down(0, 0);
    a.lp.move(3, 4);
    a.fire();
    expect(a.onLong).toHaveBeenCalledTimes(1);
    const b = harness();
    b.lp.down(0, 0);
    b.lp.move(20, 0);
    b.fire();
    expect(b.onLong).not.toHaveBeenCalled();
  });
  it('cancel (pointercancel) stops it', () => {
    const { lp, onLong, fire } = harness();
    lp.down(0, 0);
    lp.cancel();
    fire();
    expect(onLong).not.toHaveBeenCalled();
  });
});
