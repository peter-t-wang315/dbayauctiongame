// Reveal/results view-model (04 section 3.5). Pure: reads only `view.reveal`, which the server sends
// in phases `reveal` and `ended` only, so nothing here can surface actual values early.
import type { CategoryId, PlayerView } from '@dbay/protocol';
import { CATEGORY_ORDER, cardInfo, playerById, type PlayerInfo } from '../game-ui/viewModel';

export type RevealData = NonNullable<PlayerView['reveal']>;
export type RevealRow = RevealData['players'][number];

export interface Standing {
  id: string;
  player: PlayerInfo | undefined;
  rank: number;
  total: number;
  /** R35: sum of face values still in hand (Proxy = 0). */
  tiebreak: number | undefined;
  /** Text shown under the row when this player's total equals the row above it. */
  tieNote: string | null;
}

/**
 * R35 ordering: rank (server-computed) first, then total, then tiebreak, then seat order so equal
 * rows keep a stable order. Tie notes explain how equal totals were split, or that the rank is shared.
 */
export function standings(view: PlayerView): Standing[] {
  const rows = view.reveal?.players ?? [];
  const seat = (id: string) => view.players.findIndex((p) => p.id === id);
  const sorted = [...rows].sort(
    (a, b) =>
      a.rank - b.rank ||
      b.total - a.total ||
      (b.tiebreak ?? 0) - (a.tiebreak ?? 0) ||
      seat(a.id) - seat(b.id),
  );
  return sorted.map((r, i) => {
    const above = sorted[i - 1];
    const player = playerById(view, r.id);
    let tieNote: string | null = null;
    if (above && above.total === r.total) {
      const upName = playerById(view, above.id)?.name ?? 'They';
      tieNote =
        above.rank === r.rank
          ? `Shared rank: same total and same unspent cards ($${r.tiebreak ?? 0}).`
          : `Tie on $${r.total}: ${upName} holds higher unspent cards ($${above.tiebreak ?? 0} vs $${r.tiebreak ?? 0}).`;
    }
    return { id: r.id, player, rank: r.rank, total: r.total, tiebreak: r.tiebreak, tieNote };
  });
}

export interface RevealCard {
  card: string;
  name: string;
  est: number;
  actual: number;
  /** What this card adds to the total: actual, doubled inside a collection (R33, R34). */
  scored: number;
  tag: 'steal' | 'ripped' | null;
  displayCase: boolean;
}

export interface RevealGroup {
  /** null = Display Cases not assigned to any category. */
  category: CategoryId | null;
  doubled: boolean;
  cards: RevealCard[];
  subtotal: number;
}

/** One player's scorable cards grouped by category in the fixed order; Display Cases join their assigned category. */
export function revealGroups(row: RevealRow): RevealGroup[] {
  const assigned = new Map(row.displayCaseAssign.map((d) => [d.card, d.category]));
  const doubled = new Set(row.collections);
  const groups = new Map<CategoryId | null, RevealCard[]>();
  for (const it of row.items) {
    const info = cardInfo(it.card);
    if (info?.special === 'gift') continue; // R27: never scorable
    const displayCase = info?.special === 'displayCase';
    const category = displayCase ? (assigned.get(it.card) ?? null) : (info?.category ?? null);
    const x2 = category !== null && doubled.has(category);
    const card: RevealCard = {
      card: it.card,
      name: info?.name ?? 'Mystery item',
      est: it.est,
      actual: it.actual,
      scored: x2 ? it.actual * 2 : it.actual,
      tag: it.tag,
      displayCase,
    };
    const list = groups.get(category) ?? [];
    list.push(card);
    groups.set(category, list);
  }
  const order: (CategoryId | null)[] = [...CATEGORY_ORDER, null];
  return order
    .filter((c) => groups.has(c))
    .map((c) => {
      const cards = groups.get(c)!;
      return {
        category: c,
        doubled: c !== null && doubled.has(c),
        cards,
        subtotal: cards.reduce((s, x) => s + x.scored, 0),
      };
    });
}

/** Reveal order: me first, then the others in seat order (04: my items are what I care about most). */
export function revealOrder(view: PlayerView): RevealRow[] {
  const rows = view.reveal?.players ?? [];
  const seat = (id: string) => (id === view.me ? -1 : view.players.findIndex((p) => p.id === id));
  return [...rows].sort((a, b) => seat(a.id) - seat(b.id));
}

/** Number of flips in the client-side sequence (one per scorable card). */
export function flipCount(view: PlayerView): number {
  return revealOrder(view).reduce((n, r) => n + revealGroups(r).reduce((m, g) => m + g.cards.length, 0), 0);
}

/** Text lines for the Gift resolutions, in order (04 section 3.5 "Gift resolution line"). */
export function giftLines(view: PlayerView): string[] {
  return (view.reveal?.giftLog ?? []).map((g) => {
    const holder = playerById(view, g.holder)?.name ?? 'Someone';
    const victim = playerById(view, g.victim)?.name ?? 'someone';
    if (g.card === null) return `${holder}'s Gift fizzled.`;
    return `${holder} took ${cardInfo(g.card)?.name ?? 'an item'} from ${victim} with a Gift.`;
  });
}

export const TAG_TEXT = { steal: 'STEAL!', ripped: 'Ripped off!' } as const;
