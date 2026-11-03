// "Win moment" (playtest 2026-11-02 P1): a cue that outlives the 2s SOLD! stamp and the toast.
// After I win an item, the item is marked NEW in my sets (strip / rail / podium) and the status line
// keeps "You won {item}!" until my next action. Pure: derives everything from the log; no React/clock.
//
// Screen-reader rule (unchanged): a sale to me is read once, assertively, by announce.ts ("Sold to you:
// {item}"). The persistent status line is therefore silenced while it shows the win (`silent`).
import type { CategoryId, PlayerView } from '@dbay/protocol';
import { isUrgentEntry } from './announce';
import { cardInfo, type CollectionSummary } from './viewModel';

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
  if (latestN !== null && latestN > cue.n && isUrgentEntry(view, latestN)) return null;
  return cue.text;
}

/** The set the Display Case(s) will most likely join at the end (R34: best set; ties by category order). */
export function wildTarget(summary: CollectionSummary): { category: CategoryId; name: string; count: number } | null {
  let best: CollectionSummary['rows'][number] | null = null;
  for (const r of summary.rows) if (r.count > 0 && (!best || r.count > best.count)) best = r;
  return best ? { category: best.category, name: best.name, count: best.count } : null;
}
