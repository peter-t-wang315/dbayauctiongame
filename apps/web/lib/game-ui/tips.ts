// First-game tips (04 section 4.8): one-time, dismissable hints that teach the rules that decide
// the game at the moment they first matter. Pure: triggers read only the PlayerView (plus the
// local selection); the seen-set lives in localStorage on this device. No React, no clock.
// Copy is checked against docs/01 (R15-R16 Proxy, R19 sale, R27-R30 Gift, R33 sets, R35 scoring).
import type { PlayerView } from '@dbay/protocol';
import { BAY_LETTERS, cardInfo, summarizeCollection } from './viewModel';

export type TipId = 'firstTurn' | 'outbid' | 'pairSet' | 'gift' | 'proxy';

/** Priority when several trigger on the same snapshot: the first one wins, the rest wait their turn. */
export const TIP_IDS: readonly TipId[] = ['firstTurn', 'outbid', 'pairSet', 'gift', 'proxy'];

export interface Tip {
  id: TipId;
  text: string;
}

export interface TipContext {
  /** The card currently selected in my hand is a Proxy (counts as "first Proxy in hand"). */
  selectedProxy?: boolean;
}

/** Fixed copy (the set and outbid tips also name the category / bay). */
export const TIP_TEXT = {
  // R35: only won items score; cards left in hand only break ties. R19: the winning card is spent.
  firstTurn: "Bid cards don't score: only the items you win do. Spend them!",
  // R16 (a card on a bay is out of hand until it closes; an outbid player may bid there again), R19 (returns on close).
  outbid: (letter: string) =>
    `Outbid! Your card is stuck on bay ${letter} until it closes, then comes back. You can still bid there with another card.`,
  // R33: 3 of a category doubles every card in it.
  pairSet: (category: string) => `2 ${category} so far! Get a 3rd and every ${category} item scores x2.`,
  // R27 (scores nothing), R28 (after the last sale), R29-R30 (holder picks a player; that player gives the holder an item).
  gift: 'Gift: scores nothing itself. After the last sale, whoever won it picks a player, and that player must give them an item.',
  // R15 (latest Proxy is top), R16.4 (beats any face value; only a Proxy beats a Proxy).
  proxy: 'Proxy: beats any $ bid. Only a later Proxy can beat it.',
} as const;

function inBidding(view: PlayerView): boolean {
  return view.phase === 'playing' && view.stage !== 'gifts';
}

function tipFor(id: TipId, view: PlayerView, ctx: TipContext): Tip | null {
  const me = view.me;
  switch (id) {
    case 'firstTurn': {
      // Classic: my call with the window open. Frenzy has no calls: any moment I can bid.
      const mine = view.opts.mode === 'frenzy' ? view.canAct : view.turn?.player === me && view.canAct;
      return mine ? { id, text: TIP_TEXT.firstTurn } : null;
    }
    case 'outbid': {
      // A bay that still holds one of my cards, but someone else is on top.
      const b = view.bays.find(
        (x) => x.card !== null && x.topBid !== null && x.topBid.by !== me && x.stack.some((s) => s.by === me),
      );
      if (!b) return null;
      return { id, text: TIP_TEXT.outbid(BAY_LETTERS[b.idx] ?? String(b.idx + 1)) };
    }
    case 'pairSet': {
      const mine = view.players.find((p) => p.id === me);
      const row = summarizeCollection(mine?.collection ?? []).rows.find((r) => r.count === 2);
      return row ? { id, text: TIP_TEXT.pairSet(row.name) } : null;
    }
    case 'gift':
      return view.bays.some((b) => cardInfo(b.card)?.special === 'gift') ? { id, text: TIP_TEXT.gift } : null;
    case 'proxy': {
      const played = view.bays.some((b) => b.card !== null && b.stack.some((s) => s.kind === 'proxy'));
      return played || ctx.selectedProxy ? { id, text: TIP_TEXT.proxy } : null;
    }
  }
}

/** Every tip whose trigger holds on this snapshot, in priority order (seen or not). */
export function tipCandidates(view: PlayerView, ctx: TipContext = {}): Tip[] {
  if (!inBidding(view)) return [];
  return TIP_IDS.map((id) => tipFor(id, view, ctx)).filter((t): t is Tip => t !== null);
}

/** The tip to show now: the highest-priority triggered tip not seen on this device yet. */
export function nextTip(view: PlayerView, seen: ReadonlySet<TipId>, ctx: TipContext = {}): Tip | null {
  return tipCandidates(view, ctx).find((t) => !seen.has(t.id)) ?? null;
}

// ---------- per-device memory ----------

export const TIPS_KEY = 'dbay:tips';
/** Stored value that turns every tip off (also used by e2e to keep tips out of the way). */
export const TIPS_OFF = 'off';

const isTipId = (x: unknown): x is TipId => typeof x === 'string' && (TIP_IDS as readonly string[]).includes(x);

export function parseSeen(raw: string | null): Set<TipId> {
  if (raw === TIPS_OFF) return new Set(TIP_IDS);
  try {
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter(isTipId) : []);
  } catch {
    return new Set();
  }
}

export function serializeSeen(seen: ReadonlySet<TipId>): string {
  return JSON.stringify(TIP_IDS.filter((id) => seen.has(id)));
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // some browsers throw on the property access itself
  }
}

/** Seen tips on this device. Storage that is missing or throws = nothing seen (tips still work this session). */
export function loadSeen(store: Store | null = defaultStore()): Set<TipId> {
  try {
    return parseSeen(store?.getItem(TIPS_KEY) ?? null);
  } catch {
    return new Set();
  }
}

/** Persist; returns false if storage is unavailable (the caller keeps the in-memory set). */
export function saveSeen(seen: ReadonlySet<TipId>, store: Store | null = defaultStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(TIPS_KEY, serializeSeen(seen));
    return true;
  } catch {
    return false;
  }
}

/** "Show tips again" (Settings). */
export function resetSeen(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(TIPS_KEY);
  } catch {
    /* not persisted */
  }
}
