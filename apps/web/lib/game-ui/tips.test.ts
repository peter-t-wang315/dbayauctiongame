import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import {
  TIPS_KEY,
  TIPS_OFF,
  TIP_IDS,
  TIP_TEXT,
  loadSeen,
  nextTip,
  parseSeen,
  resetSeen,
  saveSeen,
  serializeSeen,
  tipCandidates,
  type TipId,
} from './tips';

const ME = 'me';
type Bay = PlayerView['bays'][number];

function bay(idx: number, card: string | null, stack: Bay['stack'] = []): Bay {
  const top = stack.length
    ? (stack.filter((s) => s.kind === 'proxy').at(-1) ??
      [...stack].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0]!)
    : null;
  return {
    idx,
    card,
    stack,
    topBid: top ? { by: top.by, kind: top.kind, ...(top.value ? { value: top.value } : {}) } : null,
  };
}

function makeView(over: Partial<PlayerView> = {}): PlayerView {
  return {
    code: 'ABCDE',
    phase: 'playing',
    stage: 'bidding',
    opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
    me: ME,
    hostId: ME,
    myHand: [],
    canAct: false,
    players: [
      { id: ME, name: 'Sam', color: 'red', shape: '●', connected: true, isBot: false, cardsInHand: 12, collection: [], gifts: 0 },
      { id: 'pat', name: 'Pat', color: 'blue', shape: '▲', connected: true, isBot: false, cardsInHand: 12, collection: [], gifts: 0 },
    ],
    bays: [bay(0, 'toys-pink-snake'), bay(1, 'media-violin'), bay(2, 'toys-bean-bag-bear')],
    turn: { player: 'pat', color: 'blue', endsAt: 1000, phase: 'window' },
    round: { n: 1, of: 8, halfway: false, last: false },
    deckLeft: 10,
    log: [],
    ...over,
  };
}

const myTurn = { turn: { player: ME, color: 'red' as const, endsAt: 1000, phase: 'window' as const }, canAct: true };
const ids = (v: PlayerView, ctx = {}) => tipCandidates(v, ctx).map((t) => t.id);
const withCollection = (collection: string[]) => (v: PlayerView): PlayerView => ({
  ...v,
  players: v.players.map((p) => (p.id === ME ? { ...p, collection } : p)),
});

describe('tip triggers', () => {
  it('nothing fires on a quiet snapshot that is not my turn', () => {
    expect(ids(makeView())).toEqual([]);
  });

  it('first turn: Classic, my call with the window open', () => {
    expect(ids(makeView(myTurn))).toEqual(['firstTurn']);
    // my call but I can't act (e.g. the gap after I bid): no tip
    expect(ids(makeView({ ...myTurn, canAct: false }))).toEqual([]);
  });

  it('first turn: Frenzy, whenever I can bid', () => {
    const f = makeView({ opts: { mode: 'frenzy', relaxed: false, bidWindowMs: 5000 }, turn: undefined, canAct: true });
    expect(ids(f)).toEqual(['firstTurn']);
  });

  it('outbid: one of my cards is still on a bay where someone else is top, naming the bay', () => {
    const v = makeView({
      bays: [
        bay(0, 'toys-pink-snake'),
        bay(1, 'media-violin', [
          { by: ME, card: 'v50', kind: 'value', value: 50 },
          { by: 'pat', card: 'v75', kind: 'value', value: 75 },
        ]),
        bay(2, null),
      ],
    });
    const t = tipCandidates(v).find((x) => x.id === 'outbid');
    expect(t?.text).toBe(TIP_TEXT.outbid('B'));
    expect(t?.text).toContain('stuck on bay B until it closes');
  });

  it('outbid: not when I am top, or the bay only has other players’ cards', () => {
    const v = makeView({
      bays: [
        bay(0, 'toys-pink-snake', [
          { by: 'pat', card: 'v50', kind: 'value', value: 50 },
          { by: ME, card: 'v75', kind: 'value', value: 75 },
        ]),
        bay(1, 'media-violin', [{ by: 'pat', card: 'v10', kind: 'value', value: 10 }]),
      ],
    });
    expect(ids(v)).not.toContain('outbid');
  });

  it('pair: exactly 2 items of one category, naming it', () => {
    const v = withCollection(['toys-pink-snake', 'toys-bean-bag-bear', 'media-violin'])(makeView());
    const t = tipCandidates(v).find((x) => x.id === 'pairSet');
    expect(t?.text).toBe('2 Toys so far! Get a 3rd and every Toys item scores x2.');
    expect(ids(withCollection(['toys-pink-snake'])(makeView()))).not.toContain('pairSet');
    // an already complete set is past teaching
    expect(
      ids(withCollection(['toys-pink-snake', 'toys-bean-bag-bear', 'toys-inflatable-alien'])(makeView())),
    ).not.toContain('pairSet');
  });

  it('gift (P9): only when I can bid on a Gift this turn, or I hold one', () => {
    const hand = [{ id: 'v50', kind: 'value' as const, value: 50 }];
    const giftBays = [bay(0, 'special-gift-1'), bay(1, 'media-violin')];
    // A Gift just sitting on a bay while it is not my turn: no tip (the playtest's complaint).
    expect(ids(makeView({ bays: giftBays, myHand: hand }))).toEqual([]);
    // My turn, a card that can bid on it: tip.
    expect(ids(makeView({ ...myTurn, bays: giftBays, myHand: hand })).includes('gift')).toBe(true);
    // My turn but nothing in hand beats the Gift's top bid: no Gift tip.
    const topped = [bay(0, 'special-gift-1', [{ by: 'pat', card: 'v100', kind: 'value', value: 100 }])];
    expect(ids(makeView({ ...myTurn, bays: topped, myHand: hand })).includes('gift')).toBe(false);
    // ...and a card already out on a bay does not count as available.
    expect(
      ids(makeView({ ...myTurn, bays: giftBays, myHand: [{ ...hand[0]!, onBay: 1 }] })).includes('gift'),
    ).toBe(false);
    // I am already the top bidder on the Gift: nothing to bid on.
    const mineTop = [bay(0, 'special-gift-1', [{ by: ME, card: 'v50', kind: 'value', value: 50 }])];
    expect(ids(makeView({ ...myTurn, bays: mineTop, myHand: hand })).includes('gift')).toBe(false);
    // Winning one (in my collection or pending) triggers it, any time.
    const held = withCollection(['special-gift-1'])(makeView());
    expect(ids(held)).toEqual(['gift']);
    const pending = makeView();
    pending.players[0]!.gifts = 1;
    expect(ids(pending)).toEqual(['gift']);
    // A Display Case is not a Gift
    expect(ids(makeView({ ...myTurn, bays: [bay(0, 'special-display-case-1')], myHand: hand })).includes('gift')).toBe(false);
  });

  it('proxy: a Proxy is played on any bay, or I pick one up', () => {
    const v = makeView({ bays: [bay(0, 'toys-pink-snake', [{ by: 'pat', card: 'p1', kind: 'proxy' }])] });
    expect(ids(v)).toEqual(['proxy']);
    expect(ids(makeView(), { selectedProxy: true })).toEqual(['proxy']);
    // holding Proxies (everyone starts with 2, R2) is not enough on its own
    expect(ids(makeView({ myHand: [{ id: 'p1', kind: 'proxy' }] }))).toEqual([]);
  });

  it('no tips outside bidding: gift stage, reveal, lobby', () => {
    const busy = makeView({ ...myTurn, bays: [bay(0, 'special-gift-1')], myHand: [{ id: 'v50', kind: 'value', value: 50 }] });
    expect(ids(busy).length).toBeGreaterThan(0);
    expect(ids({ ...busy, stage: 'gifts' })).toEqual([]);
    expect(ids({ ...busy, phase: 'reveal' })).toEqual([]);
    expect(ids({ ...busy, phase: 'lobby' })).toEqual([]);
  });

  it('priority order when several fire at once', () => {
    const v = withCollection(['toys-pink-snake', 'toys-bean-bag-bear'])(
      makeView({
        ...myTurn,
        myHand: [{ id: 'p2', kind: 'proxy' }],
        bays: [
          bay(0, 'special-gift-1', [{ by: 'pat', card: 'p1', kind: 'proxy' }]),
          bay(1, 'media-violin', [
            { by: ME, card: 'v50', kind: 'value', value: 50 },
            { by: 'pat', card: 'v75', kind: 'value', value: 75 },
          ]),
        ],
      }),
    );
    expect(ids(v)).toEqual(['firstTurn', 'outbid', 'pairSet', 'gift', 'proxy']);
  });
});

describe('nextTip: one time per device', () => {
  it('skips tips already seen and returns null when all are seen', () => {
    const v = makeView({ ...myTurn, bays: [bay(0, 'special-gift-1')], myHand: [{ id: 'v50', kind: 'value', value: 50 }] });
    expect(nextTip(v, new Set())?.id).toBe('firstTurn');
    expect(nextTip(v, new Set<TipId>(['firstTurn']))?.id).toBe('gift');
    expect(nextTip(v, new Set<TipId>(['firstTurn', 'gift']))).toBeNull();
    expect(nextTip(v, new Set(TIP_IDS))).toBeNull();
  });
});

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}
const throwing = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceeded');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('seen-set storage', () => {
  it('round-trips, ignoring unknown ids and junk', () => {
    const s = new Set<TipId>(['gift', 'firstTurn']);
    expect(parseSeen(serializeSeen(s))).toEqual(s);
    expect(parseSeen('["proxy","nope",3]')).toEqual(new Set(['proxy']));
    expect(parseSeen('{oops')).toEqual(new Set());
    expect(parseSeen('{"a":1}')).toEqual(new Set());
    expect(parseSeen(null)).toEqual(new Set());
  });

  it('"off" means every tip is seen', () => {
    expect(parseSeen(TIPS_OFF)).toEqual(new Set(TIP_IDS));
  });

  it('load/save/reset through a store', () => {
    const st = memStore();
    expect(loadSeen(st)).toEqual(new Set());
    expect(saveSeen(new Set<TipId>(['outbid']), st)).toBe(true);
    expect(st.m.get(TIPS_KEY)).toBe('["outbid"]');
    expect(loadSeen(st)).toEqual(new Set(['outbid']));
    resetSeen(st);
    expect(loadSeen(st)).toEqual(new Set());
  });

  it('works when storage is missing or throws', () => {
    expect(loadSeen(null)).toEqual(new Set());
    expect(saveSeen(new Set<TipId>(['gift']), null)).toBe(false);
    expect(loadSeen(throwing)).toEqual(new Set());
    expect(saveSeen(new Set<TipId>(['gift']), throwing)).toBe(false);
    expect(() => resetSeen(throwing)).not.toThrow();
  });
});

describe('tip copy stays short enough for a phone toast', () => {
  it('every tip is at most 130 characters', () => {
    const texts = [
      TIP_TEXT.firstTurn,
      TIP_TEXT.outbid('D'),
      TIP_TEXT.pairSet('Collectibles'),
      TIP_TEXT.gift,
      TIP_TEXT.proxy,
    ];
    for (const t of texts) expect(t.length, t).toBeLessThanOrEqual(130);
  });
});
