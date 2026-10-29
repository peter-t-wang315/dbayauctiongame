// Assertive screen-reader announcements (a11y, 04 section 8). Used sparingly: only three
// events interrupt: my Classic turn, being outbid, and winning an item. Everything else stays
// in the polite status strip. Pure: derives text from new log entries, no React or clock.
import type { PlayerView } from '@dbay/protocol';
import { BAY_LETTERS, cardInfo, type LogEntry } from './viewModel';

/** Text to announce assertively for this log entry, or null if it is not urgent for me. */
export function urgentText(view: PlayerView, e: LogEntry): string | null {
  if (e.by !== view.me) return null;
  switch (e.kind) {
    case 'turn':
      return view.opts.mode === 'classic' ? 'Your turn' : null;
    case 'outbid':
      return `You were outbid on bay ${e.bay !== undefined ? (BAY_LETTERS[e.bay] ?? e.bay + 1) : ''}`.trim();
    case 'sold': {
      // Names the item: the polite strip line ("Yours! ...") is silenced for this entry, and the
      // sale toast (sale.ts) does not speak my wins, so this is the only read.
      const item = e.card ? cardInfo(e.card)?.name : undefined;
      return item ? `Sold to you: ${item}` : 'Sold to you';
    }
    default:
      return null;
  }
}

/**
 * New urgent announcements since `lastN` (the highest log number already handled; null on the first
 * snapshot, which only sets the baseline so joining mid-game does not announce history).
 */
export function newAnnouncements(
  view: PlayerView,
  lastN: number | null,
): { lastN: number; items: { n: number; text: string }[] } {
  const maxN = view.log.reduce((m, e) => Math.max(m, e.n), 0);
  if (lastN === null) return { lastN: maxN, items: [] };
  const items = view.log
    .filter((e) => e.n > lastN)
    .sort((a, b) => a.n - b.n)
    .flatMap((e) => {
      const text = urgentText(view, e);
      return text ? [{ n: e.n, text }] : [];
    });
  return { lastN: Math.max(lastN, maxN), items };
}

/** True when log entry `n` is announced assertively (so the polite strip must not read it again). */
export function isUrgentEntry(view: PlayerView, n: number): boolean {
  const e = view.log.find((x) => x.n === n);
  return !!e && urgentText(view, e) !== null;
}
