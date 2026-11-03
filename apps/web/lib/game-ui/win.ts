// "Win moment" (playtest 2026-11-02 P1): a cue that outlives the 2s SOLD! stamp and the toast.
// After I win an item, the item is marked NEW in my sets (strip / rail / podium) and the status line
// keeps "You won {item}!" until my next action. Pure: derives everything from the log; no React/clock.
//
// Screen-reader rule (unchanged): a sale to me is read once, assertively, by announce.ts ("Sold to you:
// {item}"). The persistent status line is therefore silenced while it shows the win (`silent`).
import type { CategoryId, PlayerView } from '@dbay/protocol';
import { isUrgentEntry } from './announce';
import { cardInfo, categoryShort, type CollectionSummary } from './viewModel';

export const WIN_FX = {
  /** The new row pulses this long (then stays marked NEW, static, until my next action). */
  pulseMs: 4500,
} as const;

export interface WinCue {
  /** Log number of the sale. */
  n: number;
  card: string | null;
  name: string;
  category: CategoryId | null;
  special: 'gift' | 'displayCase' | null;
  /** "You won Teddy Bear!" */
  text: string;
}

/** My newest win among log entries newer than `lastN` (null baseline: first snapshot, no history cue). */
export function newWin(view: PlayerView, lastN: number | null): { lastN: number; win: WinCue | null } {
  const maxN = view.log.reduce((m, e) => Math.max(m, e.n), 0);
  if (lastN === null) return { lastN: maxN, win: null };
  let win: WinCue | null = null;
  for (const e of [...view.log].sort((a, b) => a.n - b.n)) {
    if (e.n <= lastN || e.kind !== 'sold' || e.by !== view.me) continue;
    const info = cardInfo(e.card ?? null);
    const name = info?.name ?? 'the item';
    win = {
      n: e.n,
      card: e.card ?? null,
      name,
      category: info?.category ?? null,
      special: info?.special ?? null,
      text: `You won ${name}!`,
    };
  }
  return { lastN: Math.max(lastN, maxN), win };
}

/** The cue ends when I act or my turn comes round: any later bid, pass, skip or turn entry of mine. */
export function winCleared(view: PlayerView, cue: WinCue): boolean {
  return view.log.some(
    (e) =>
      e.n > cue.n &&
      e.by === view.me &&
      (e.kind === 'bid' || e.kind === 'pass' || e.kind === 'autoPass' || e.kind === 'turn'),
  );
}

/**
 * The status-line text while a win cue is active, or null to show the normal line. A newer urgent
 * entry for me (outbid, a second win) is more important and replaces it. The caller gives a flash or
 * "Going once..." priority by not asking.
 */
export function winLine(view: PlayerView, cue: WinCue | null, latestN: number | null): string | null {
  if (!cue) return null;
  if (latestN !== null && latestN > cue.n) {
    if (isUrgentEntry(view, latestN)) return null;
    // Game-wide moments (and the end) must be seen and read politely, not hidden behind my win.
    const kind = view.log.find((x) => x.n === latestN)?.kind;
    if (kind === 'halfway' || kind === 'lastRound' || kind === 'gameOver') return null;
  }
  return cue.text;
}

/** What a Display Case will likely join. A hint only: R34 decides at scoring (brute force over the real values). */
export interface WildHint {
  categories: CategoryId[];
  /** "Toys" or "Toys or Media". */
  name: string;
  /** Short form for the phone strip: "Toys" or "Toys/Media". */
  short: string;
}

/**
 * R34 picks the assignment that maximizes the total. Joining a set at exactly 2 completes it (the whole
 * set doubles, docs/01 section 9), which beats joining a set already at 3+ (+100). So: sets at exactly 2
 * first (several = a hedged list; the values decide and the client does not weigh them), else the
 * biggest set at 3+, else no hint.
 */
export function wildHint(summary: CollectionSummary): WildHint | null {
  let rows = summary.rows.filter((r) => r.count === 2);
  if (rows.length === 0) {
    const max = Math.max(0, ...summary.rows.map((r) => r.count));
    rows = max >= 3 ? summary.rows.filter((r) => r.count === max) : [];
  }
  if (rows.length === 0) return null;
  return {
    categories: rows.map((r) => r.category),
    name: rows.map((r) => r.name).join(' or '),
    short: rows.map((r) => categoryShort(r.category)).join('/'),
  };
}
