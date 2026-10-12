// View-model mapping from PlayerView (+ public content) to what the game components render.
// Pure: no React, no clock. Text strings come from the table in docs/04 section 4.5.
import type { CategoryId, PlayerView } from '@dbay/protocol';
import { CATEGORIES, CATEGORY_SPRITES, ITEM_SPRITES, getPublicCard } from '@dbay/content/public';
import type { Sprite } from '@dbay/content/public';

export type PlayerInfo = PlayerView['players'][number];
export type LogEntry = PlayerView['log'][number];

export const BAY_LETTERS = ['A', 'B', 'C', 'D'] as const;
export const CATEGORY_ORDER: CategoryId[] = ['toys', 'media', 'glass', 'collectibles', 'antiques', 'misc'];

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export const categoryName = (id: CategoryId) => CATEGORY_BY_ID.get(id)?.name ?? id;
/** Same as categoryName: one name per category everywhere (user decision 2026-10-12). */
export const categoryShort = categoryName;
export const categoryEmoji = (id: CategoryId) => CATEGORY_BY_ID.get(id)?.emoji ?? '';

export function playerById(view: PlayerView, id: string | undefined): PlayerInfo | undefined {
  return id === undefined ? undefined : view.players.find((p) => p.id === id);
}

// ---------- auction cards ----------

export interface CardInfo {
  id: string;
  name: string;
  /** Items only. */
  category: CategoryId | null;
  /** Items only; specials have no estimate. */
  est: number | null;
  special: 'displayCase' | 'gift' | null;
  flavor: string;
  sprite: Sprite | null;
}

/** Unknown ids (content out of sync) render as a generic card instead of crashing. */
export function cardInfo(id: string | null): CardInfo | null {
  if (id === null) return null;
  const c = getPublicCard(id);
  if (!c) {
    return { id, name: 'Mystery item', category: null, est: null, special: null, flavor: '', sprite: null };
  }
  if (c.kind === 'item') {
    return {
      id,
      name: c.name,
      category: c.category,
      est: c.estimatedValue,
      special: null,
      flavor: c.flavor,
      sprite: ITEM_SPRITES[id] ?? c.sprite ?? CATEGORY_SPRITES[c.category] ?? null,
    };
  }
  return {
    id,
    name: c.name,
    category: null,
    est: c.fixedValue ?? null,
    special: c.type,
    flavor: c.flavor,
    sprite: null,
  };
}

// ---------- bays ----------

export interface BayVM {
  idx: number;
  letter: string;
  card: CardInfo | null;
  topLabel: string | null;
  topBy: PlayerInfo | undefined;
  mine: boolean;
  /** Absolute server time the bay closes (Frenzy), if any. */
  endsAt: number | undefined;
}

export function formatBid(b: { kind: 'value' | 'proxy'; value?: number } | null): string | null {
  if (!b) return null;
  return b.kind === 'proxy' ? 'Proxy' : `$${b.value ?? 0}`;
}

export function bayViewModels(view: PlayerView): BayVM[] {
  return view.bays.map((b) => ({
    idx: b.idx,
    letter: BAY_LETTERS[b.idx] ?? String(b.idx + 1),
    card: cardInfo(b.card),
    topLabel: formatBid(b.topBid),
    topBy: playerById(view, b.topBid?.by),
    mine: b.topBid?.by === view.me,
    endsAt: b.endsAt,
  }));
}

/** 3-4 players use 3 bays, 5-6 use 4 (04 section 14); the view's bay count is the truth. */
export function bayLayout(bayCount: number): 'row' | 'tile' {
  return bayCount >= 4 ? 'tile' : 'row';
}

// ---------- hand ----------

export const VALUE_CARD_FACES = [10, 25, 50, 75, 100, 125, 150, 200, 250, 300] as const;

export interface HandSlot {
  id: string;
  kind: 'value' | 'proxy';
  value?: number;
  /** Spent (won and gone): shown in place, dashed and struck through. */
  spent: boolean;
  /** Out on the table as a current top/stack bid on this bay. */
  onBay?: number;
}

/**
 * Fixed 12 positions (ascending value, Proxies last) so positions never shift (04 section 4.3).
 * A slot missing from `myHand` is spent. Any unexpected card ids in the hand are appended.
 */
export function handSlots(hand: PlayerView['myHand']): HandSlot[] {
  const byId = new Map(hand.map((c) => [c.id, c]));
  const slots: HandSlot[] = [];
  const seen = new Set<string>();
  const push = (id: string, kind: 'value' | 'proxy', value?: number) => {
    const c = byId.get(id);
    seen.add(id);
    slots.push({
      id,
      kind,
      ...(value !== undefined ? { value } : {}),
      spent: !c,
      ...(c?.onBay !== undefined ? { onBay: c.onBay } : {}),
    });
  };
  for (const v of VALUE_CARD_FACES) push(`v${v}`, 'value', v);
  push('p1', 'proxy');
  push('p2', 'proxy');
  const extras = hand.filter((c) => !seen.has(c.id));
  extras.sort((a, b) => (a.kind === b.kind ? (a.value ?? 0) - (b.value ?? 0) : a.kind === 'proxy' ? 1 : -1));
  for (const c of extras) push(c.id, c.kind, c.value);
  return slots;
}

// ---------- collections ----------

export interface CollectionRow {
  category: CategoryId;
  name: string;
  items: CardInfo[];
  count: number;
  /** 3 pips; "x2" when the set is complete (01 collection rule). */
  complete: boolean;
  oneMore: boolean;
}

export interface CollectionSummary {
  rows: CollectionRow[];
  displayCases: number;
  gifts: number;
}

export function summarizeCollection(collection: readonly string[], pendingGifts = 0): CollectionSummary {
  const infos = collection.map(cardInfo).filter((c): c is CardInfo => c !== null);
  const rows = CATEGORY_ORDER.map((category): CollectionRow => {
    const items = infos.filter((c) => c.category === category);
    return {
      category,
      name: categoryName(category),
      items,
      count: items.length,
      complete: items.length >= 3,
      oneMore: items.length === 2,
    };
  });
  const displayCases = infos.filter((c) => c.special === 'displayCase').length;
  const gifts = infos.filter((c) => c.special === 'gift').length + pendingGifts;
  return { rows, displayCases, gifts };
}

// ---------- progress ----------

export interface Progress {
  /** 0..1 */
  fraction: number;
  label: 'halfway' | 'last' | null;
  /** For aria only; the UI never prints "Round X of Y" (04 section 4.5 note). */
  now: number;
  max: number;
}

export function progressOf(view: PlayerView): Progress {
  const { n, of, halfway, last } = view.round;
  const fraction = of > 0 ? Math.min(1, Math.max(0, (last ? of : n - 1) / of)) : 0;
  // "Halfway" is a moment, not a state: show it only in the round it's announced (R9:
  // floor(rounds/2)+1). After that the bar's midpoint tick still marks the half.
  const halfwayNow = halfway && n <= Math.floor(of / 2) + 1;
  return { fraction, label: last ? 'last' : halfwayNow ? 'halfway' : null, now: n, max: of };
}

// ---------- status strip text ----------

export function eventText(view: PlayerView, e: LogEntry): string | null {
  const me = view.me;
  const who = e.by ? playerById(view, e.by) : undefined;
  const nm = who ? `${who.shape} ${who.name}` : 'Someone';
  const bayCard = e.bay !== undefined ? view.bays[e.bay]?.card ?? null : null;
  const item = cardInfo(e.card ?? bayCard)?.name ?? 'the item';
  const amt = e.amount === undefined ? '' : e.amount === 'proxy' ? 'a Proxy' : `$${e.amount}`;
  const letter = e.bay !== undefined ? (BAY_LETTERS[e.bay] ?? String(e.bay + 1)) : '';
  switch (e.kind) {
    case 'gameStart':
      return 'Doors open! First bays are up.';
    case 'frenzyStart':
      return 'Frenzy! Bid any time.';
    case 'turn':
      return e.by === me ? `Your turn${who ? `, ${who.name}` : ''}! Pick a card.` : `${nm}'s turn`;
    case 'pass':
      return `${nm} passes`;
    case 'autoPass':
      // R13: auto-pass is either a disconnected human or a player with no legal bid (bots are never away).
      return who && !who.isBot && !who.connected ? `${nm} is away: auto-pass` : `${nm} has no legal bid: skipped`;
    case 'bid':
      return `${nm} bids ${amt} on ${item}`;
    case 'outbid': {
      // `by` is the player who was outbid; only the local player cares.
      if (e.by !== me) return null;
      const top = e.bay !== undefined ? view.bays[e.bay]?.topBid : null;
      const topWho = playerById(view, top?.by);
      return topWho ? `Outbid by ${topWho.shape} ${topWho.name}! ${formatBid(top ?? null) ?? ''}` : `Outbid on ${item}!`;
    }
    case 'lead':
      return e.by === me ? `You lead ${item} at ${amt}` : null;
    case 'extended':
      return `Late bid! +3s on ${item}`;
    case 'sold':
      return e.by === me ? `Yours! ${item} for ${amt}` : `SOLD! ${item} to ${nm} for ${amt}`;
    case 'unsold':
      // 01 no-bid round: a whole Classic round without bids clears every bay.
      if (e.extra === 'noBidRound') return `No bids all round: ${item} cleared.`;
      return `${item}: no bids. Carried over.`;
    case 'refill':
      return `New in bay ${letter}: ${item}`;
    case 'collection': {
      const cat = e.extra && CATEGORY_BY_ID.has(e.extra as CategoryId) ? categoryName(e.extra as CategoryId) : 'a set';
      return `${nm} completed ${cat}! x2`;
    }
    case 'special': {
      const s = cardInfo(e.card ?? null)?.special;
      return `${nm} got a ${s === 'gift' ? 'Gift' : 'Display Case'}`;
    }
    case 'halfway':
      return 'Halfway there!';
    case 'lastRound':
      return 'Last round! Everything sells.';
    case 'gameOver':
      return "That's the gavel. Time to reveal...";
    case 'left':
      return `${nm} left`;
    case 'rejoined':
      return `${nm} is back`;
    case 'host':
      return `${nm} is now host`;
  }
}

/** Most recent log entry that has display text. The log is oldest-first (see mock/05); sorted by n to be safe. */
export function latestStatus(view: PlayerView): { n: number; text: string } | null {
  const sorted = [...view.log].sort((a, b) => a.n - b.n);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const text = eventText(view, sorted[i]!);
    if (text) return { n: sorted[i]!.n, text };
  }
  return null;
}

/** Newest-first list for the event-log sheet. */
export function logLines(view: PlayerView): { n: number; text: string }[] {
  return [...view.log]
    .sort((a, b) => b.n - a.n)
    .map((e) => ({ n: e.n, text: eventText(view, e) }))
    .filter((l): l is { n: number; text: string } => l.text !== null);
}

/** Banner text for Classic/Frenzy (04 section 4.6). */
export function bannerFor(view: PlayerView): { title: string; mine: boolean; color: string | null } {
  if (view.stage === 'gifts') return { title: 'GIFT TIME', mine: false, color: null };
  if (view.opts.mode === 'frenzy') return { title: 'FRENZY', mine: false, color: null };
  const t = view.turn;
  if (!t) return { title: 'Get ready', mine: false, color: null };
  if (t.player === view.me) return { title: 'Your turn', mine: true, color: t.color };
  const who = playerById(view, t.player);
  return { title: `${who?.shape ?? ''} ${who?.name ?? 'Someone'}'s turn`.trim(), mine: false, color: t.color };
}
