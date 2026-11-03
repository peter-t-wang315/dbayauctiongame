import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import {
  bayLegality,
  cardTapReason,
  lockedReason,
  rejectionText,
  type BayView,
  type HandCardView,
} from './legal';
import { IDLE, bayForKey, cardForKey, reconcile, tapCard } from './selection';
import { barFraction, cooldownLeft, formatClock, isDanger, nextBarTotal, remainingMs } from './timers';
import {
  bayLayout,
  bayViewModels,
  bannerFor,
  eventText,
  handSlots,
  latestStatus,
  progressOf,
  summarizeCollection,
} from './viewModel';

const ME = 'me';
const val = (v: number): HandCardView => ({ id: `v${v}`, kind: 'value', value: v });
const proxy: HandCardView = { id: 'p1', kind: 'proxy' };

function bay(top: BayView['topBid'], card: string | null = 'toys-tin-robot'): BayView {
  return { idx: 0, card, stack: [], topBid: top };
}

function makeView(over: Partial<PlayerView> = {}): PlayerView {
  return {
    code: 'ABCDE',
    phase: 'playing',
    stage: 'bidding',
    opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
    me: ME,
    hostId: ME,
    myHand: [val(10), val(50), proxy],
    canAct: true,
    players: [
      { id: ME, name: 'Sam', color: 'red', shape: '●', connected: true, isBot: false, cardsInHand: 3, collection: [], gifts: 0 },
      { id: 'pat', name: 'Pat', color: 'blue', shape: '▲', connected: true, isBot: false, cardsInHand: 12, collection: [], gifts: 0 },
    ],
    bays: [bay(null)],
    round: { n: 3, of: 8, halfway: false, last: false },
    deckLeft: 10,
    log: [],
    ...over,
  };
}

describe('bayLegality (01 R16 mirror)', () => {
  it('empty stack: any card is legal', () => {
    expect(bayLegality(val(10), bay(null), ME).legal).toBe(true);
    expect(bayLegality(proxy, bay(null), ME).legal).toBe(true);
  });
  it('empty bay (no card) is illegal', () => {
    expect(bayLegality(val(300), bay(null, null), ME)).toEqual({ legal: false, reason: 'Empty' });
  });
  it('must strictly beat the top face; equal is illegal', () => {
    const top = { by: 'pat', kind: 'value' as const, value: 50 };
    expect(bayLegality(val(50), bay(top), ME)).toEqual({ legal: false, reason: 'Beat $50' });
    expect(bayLegality(val(25), bay(top), ME).legal).toBe(false);
    expect(bayLegality(val(75), bay(top), ME).legal).toBe(true);
  });
  it('proxy beats any value and any proxy; value never beats a proxy', () => {
    expect(bayLegality(proxy, bay({ by: 'pat', kind: 'value', value: 300 }), ME).legal).toBe(true);
    expect(bayLegality(proxy, bay({ by: 'pat', kind: 'proxy' }), ME).legal).toBe(true);
    expect(bayLegality(val(300), bay({ by: 'pat', kind: 'proxy' }), ME).legal).toBe(false);
  });
  it('never legal when I am the top bidder', () => {
    expect(bayLegality(proxy, bay({ by: ME, kind: 'value', value: 10 }), ME).legal).toBe(false);
  });
  it('rejection text names the amount to beat', () => {
    expect(rejectionText(bay({ by: 'pat', kind: 'value', value: 150 }))).toBe("Can't bid that. Beat $150.");
    expect(rejectionText(undefined)).toBe("Can't bid that.");
  });
});

describe('lockedReason', () => {
  it('null when the server says I can act', () => {
    expect(lockedReason(makeView(), 0)).toBeNull();
  });
  it('Classic: not my turn', () => {
    const v = makeView({ canAct: false, turn: { player: 'pat', color: 'blue', phase: 'window' } });
    expect(lockedReason(v, 0)).toBe('Not your turn');
  });
  it('Frenzy cooldown locks even if canAct lags', () => {
    const v = makeView({ opts: { mode: 'frenzy', relaxed: false, bidWindowMs: 5000 } });
    expect(lockedReason(v, 600)).toBe('Cooling down');
  });
});

describe('cardTapReason (B2: no silent taps)', () => {
  const v = makeView({ myHand: [val(10), { ...val(50), onBay: 1 }, proxy] });
  it('null for a card that can be selected', () => {
    expect(cardTapReason(v, 'v10', 0)).toBeNull();
  });
  it('spent, out on a bay, locked, in flight', () => {
    expect(cardTapReason(v, 'v300', 0)).toBe('Spent: that card already won an item');
    expect(cardTapReason(v, 'v50', 0)).toBe('That card is on bay B until it closes');
    const notMine = makeView({ canAct: false, turn: { player: 'pat', color: 'blue', phase: 'window' } });
    expect(cardTapReason(notMine, 'v10', 0)).toBe('Not your turn');
    expect(cardTapReason(v, 'v10', 0, 'v50')).toBe('Sending your bid...');
  });
});

describe('selection', () => {
  const hand = [val(10), val(50), { ...val(100), onBay: 0 }, proxy];
  it('tap selects, tap same deselects, tap other moves', () => {
    const a = tapCard(IDLE, 'v10', hand, true);
    expect(a.card).toBe('v10');
    expect(tapCard(a, 'v10', hand, true)).toEqual(IDLE);
    expect(tapCard(a, 'v50', hand, true).card).toBe('v50');
  });
  it('ignores taps when I cannot act', () => {
    expect(tapCard(IDLE, 'v10', hand, false)).toEqual(IDLE);
  });
  it('card out on the table is not selectable; tapping it clears', () => {
    expect(tapCard({ card: 'v10' }, 'v100', hand, true)).toEqual(IDLE);
    expect(tapCard(IDLE, 'v100', hand, true)).toEqual(IDLE);
  });
  it('reconcile clears on turn end, phase change, spent card', () => {
    const sel = { card: 'v10' };
    expect(reconcile(sel, makeView())).toEqual(sel);
    expect(reconcile(sel, makeView({ canAct: false }))).toEqual(IDLE);
    expect(reconcile(sel, makeView({ phase: 'reveal' }))).toEqual(IDLE);
    expect(reconcile(sel, makeView({ myHand: [val(50)] }))).toEqual(IDLE);
    expect(reconcile(sel, makeView({ myHand: [{ ...val(10), onBay: 1 }] }))).toEqual(IDLE);
  });
  it('Frenzy selection survives canAct=false (cooldown)', () => {
    const v = makeView({ canAct: false, opts: { mode: 'frenzy', relaxed: false, bidWindowMs: 5000 } });
    expect(reconcile({ card: 'v10' }, v)).toEqual({ card: 'v10' });
  });
  it('keyboard mapping: each key is a fixed slot for the whole game (B6)', () => {
    const h = [val(10), val(25), val(50), proxy, { id: 'p2', kind: 'proxy' as const }];
    expect(cardForKey('1', h)).toBe('v10');
    expect(cardForKey('3', h)).toBe('v50');
    expect(cardForKey('0', h)).toBe('v300');
    expect(cardForKey('-', h)).toBe('p1');
    expect(cardForKey('=', h)).toBe('p2');
    expect(cardForKey('x', h)).toBeNull();
    // $25 spent and $10 out on a bay: $50 is still on 3, not re-mapped to 1.
    const later = [{ ...val(10), onBay: 0 }, val(50), proxy];
    expect(cardForKey('3', later)).toBe('v50');
    expect(cardForKey('1', later)).toBe('v10');
    expect(cardForKey('2', later)).toBe('v25');
    expect(bayForKey('Q')).toBe(0);
    expect(bayForKey('r')).toBe(3);
    expect(bayForKey('x')).toBeNull();
  });
});

describe('timers', () => {
  it('remaining is clamped and null without endsAt', () => {
    expect(remainingMs(undefined, 1000)).toBeNull();
    expect(remainingMs(5000, 1000)).toBe(4000);
    expect(remainingMs(5000, 9000)).toBe(0);
  });
  it('clock rounds up', () => {
    expect(formatClock(12_000)).toBe('0:12');
    expect(formatClock(11_001)).toBe('0:12');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
  });
  it('danger only in the last 3s while running', () => {
    expect(isDanger(3000)).toBe(true);
    expect(isDanger(3001)).toBe(false);
    expect(isDanger(0)).toBe(false);
    expect(isDanger(null)).toBe(false);
  });
  it('bar fraction and total tracking (anti-snipe keeps the max)', () => {
    expect(barFraction(7500, 15000)).toBe(0.5);
    expect(barFraction(null, 15000)).toBe(0);
    let t = nextBarTotal(undefined, 'a', 20000);
    expect(t.total).toBe(20000);
    t = nextBarTotal(t, 'a', 3000);
    expect(t.total).toBe(20000);
    t = nextBarTotal(t, 'b', 4000);
    expect(t.total).toBe(15000);
  });
  it('cooldown', () => {
    expect(cooldownLeft(undefined, 100)).toBe(0);
    expect(cooldownLeft(1500, 1000)).toBe(500);
    expect(cooldownLeft(900, 1000)).toBe(0);
  });
});

describe('view-model', () => {
  it('hand has 12 fixed slots; missing = spent; onBay carried', () => {
    const slots = handSlots([val(10), { ...val(50), onBay: 2 }, proxy]);
    expect(slots).toHaveLength(12);
    expect(slots.map((s) => s.id).slice(0, 3)).toEqual(['v10', 'v25', 'v50']);
    expect(slots[0]!.spent).toBe(false);
    expect(slots[1]!.spent).toBe(true);
    expect(slots[2]!.onBay).toBe(2);
    expect(slots[10]!.id).toBe('p1');
    expect(slots[11]!.spent).toBe(true);
  });
  it('bays: top bid label, mine flag, layout by bay count', () => {
    const v = makeView({
      bays: [
        { idx: 0, card: 'toys-tin-robot', stack: [], topBid: { by: ME, kind: 'value', value: 75 } },
        { idx: 1, card: 'toys-pink-snake', stack: [], topBid: { by: 'pat', kind: 'proxy' } },
        { idx: 2, card: null, stack: [], topBid: null },
      ],
    });
    const vms = bayViewModels(v);
    expect(vms[0]).toMatchObject({ letter: 'A', topLabel: '$75', mine: true });
    expect(vms[0]!.card?.name).toBe('Wind-Up Tin Robot');
    expect(vms[0]!.card?.sprite).not.toBeNull();
    expect(vms[1]).toMatchObject({ topLabel: 'Proxy', mine: false });
    expect(vms[2]!.card).toBeNull();
    expect(bayLayout(3)).toBe('row');
    expect(bayLayout(4)).toBe('tile');
  });
  it('collections: counts per category, x2 at 3, one-more hint at 2, specials', () => {
    const s = summarizeCollection(
      ['toys-tin-robot', 'toys-pink-snake', 'toys-scary-puppet', 'special-display-case-1', 'media-x'],
      1,
    );
    const toys = s.rows.find((r) => r.category === 'toys')!;
    expect(toys.count).toBe(3);
    expect(toys.complete).toBe(true);
    expect(s.displayCases).toBe(1);
    expect(s.gifts).toBe(1);
  });
  it('progress: fraction, labels; never a "Round X of Y" string', () => {
    expect(progressOf(makeView())).toMatchObject({ fraction: 2 / 8, label: null });
    expect(progressOf(makeView({ round: { n: 5, of: 8, halfway: true, last: false } })).label).toBe('halfway');
    // Past the halfway round the tag goes away (the bar keeps going).
    expect(progressOf(makeView({ round: { n: 6, of: 8, halfway: true, last: false } })).label).toBeNull();
    expect(progressOf(makeView({ round: { n: 8, of: 8, halfway: true, last: true } }))).toMatchObject({
      fraction: 1,
      label: 'last',
    });
    expect(progressOf(makeView({ round: { n: 0, of: 0, halfway: false, last: false } })).fraction).toBe(0);
  });
  it('status text per 04 section 4.5', () => {
    const v = makeView({
      bays: [{ idx: 0, card: 'toys-tin-robot', stack: [], topBid: { by: 'pat', kind: 'value', value: 150 } }],
    });
    const e = (x: Partial<PlayerView['log'][number]> & { kind: PlayerView['log'][number]['kind'] }) =>
      eventText(v, { n: 1, ...x });
    expect(e({ kind: 'turn', by: ME })).toBe('Your turn, Sam! Pick a card.');
    expect(e({ kind: 'turn', by: 'pat' })).toBe("▲ Pat's turn");
    expect(e({ kind: 'bid', by: 'pat', bay: 0, amount: 150 })).toBe('▲ Pat bids $150 on Wind-Up Tin Robot');
    expect(e({ kind: 'bid', by: 'pat', bay: 0, amount: 'proxy' })).toBe('▲ Pat bids a Proxy on Wind-Up Tin Robot');
    expect(e({ kind: 'outbid', by: ME, bay: 0 })).toBe('Outbid on Wind-Up Tin Robot by ▲ Pat! $150');
    expect(e({ kind: 'outbid', by: 'pat', bay: 0 })).toBeNull();
    expect(e({ kind: 'sold', by: ME, card: 'toys-tin-robot', amount: 80 })).toBe('Yours! Wind-Up Tin Robot for $80');
    expect(e({ kind: 'sold', by: 'pat', card: 'toys-tin-robot', amount: 80 })).toBe(
      'SOLD! Wind-Up Tin Robot to ▲ Pat for $80',
    );
    expect(e({ kind: 'halfway' })).toBe('Halfway there!');
    expect(e({ kind: 'lastRound' })).toBe('Last round! Everything sells.');
    expect(e({ kind: 'unsold', bay: 0, card: 'toys-tin-robot', extra: 'noBidRound' })).toMatch(/^No bids all round: .+ cleared\.$/);
    expect(e({ kind: 'autoPass', by: 'pat' })).toBe('▲ Pat has no bay to bid on: skipped');
    expect(e({ kind: 'autoPass', by: ME })).toBe('No bay you can bid on: skipped');
    v.players.find((p) => p.id === 'pat')!.connected = false;
    expect(e({ kind: 'autoPass', by: 'pat' })).toBe('▲ Pat is away: auto-pass');
  });
  it('latestStatus picks the newest displayable entry', () => {
    const v = makeView({
      log: [
        { n: 1, kind: 'gameStart' },
        { n: 2, kind: 'outbid', by: 'pat', bay: 0 },
      ],
    });
    expect(latestStatus(v)).toEqual({ n: 1, text: 'Doors open! First bays are up.' });
  });
  it('banner', () => {
    expect(bannerFor(makeView({ turn: { player: ME, color: 'red', phase: 'window' } }))).toMatchObject({
      title: 'Your turn',
      mine: true,
    });
    expect(bannerFor(makeView({ opts: { mode: 'frenzy', relaxed: false, bidWindowMs: 5000 } })).title).toBe('FRENZY');
  });
  it('banner: no stale "Your turn" once my bid is sent or acked (B1)', () => {
    const win = makeView({ turn: { player: ME, color: 'red', phase: 'window' } });
    expect(bannerFor(win, true)).toEqual({ title: 'Bid placed, waiting...', mine: false, color: 'red' });
    const gap = (log: PlayerView['log']) =>
      bannerFor(makeView({ canAct: false, turn: { player: ME, color: 'red', phase: 'gap' }, log }));
    expect(gap([{ n: 1, kind: 'turn', by: ME }, { n: 2, kind: 'bid', by: ME, bay: 0, amount: 50 }])).toMatchObject({
      title: 'Bid placed, waiting...',
      mine: false,
    });
    expect(gap([{ n: 1, kind: 'turn', by: ME }, { n: 2, kind: 'pass', by: ME }]).title).toBe('Passed');
    expect(gap([{ n: 1, kind: 'turn', by: ME }, { n: 2, kind: 'autoPass', by: ME }]).title).toBe('Skipped');
    // An older bid from a previous turn doesn't count.
    expect(gap([{ n: 1, kind: 'bid', by: ME, bay: 0, amount: 50 }, { n: 2, kind: 'turn', by: ME }]).title).toBe('Waiting...');
    expect(
      bannerFor(makeView({ turn: { player: 'pat', color: 'blue', phase: 'gap' } })),
    ).toMatchObject({ title: "▲ Pat's turn", mine: false });
  });
});
