// "Make the sale the moment" (playtest follow-ups, slice 3). Pure: which sales are new, what the
// won/lost toast says, and what (if anything) it should read out. No React, DOM or clock.
//
// Screen-reader rule (no double reads): a sale to me is already announced assertively by
// announce.ts ("Sold to you: {item}"), and the polite status strip reads the newest log line. So the
// toast speaks only another player's sale that the strip is NOT showing (typically because a refill,
// collection or special line arrived after it in the same snapshot).
import type { PlayerView } from '@dbay/protocol';
import { cardInfo, latestStatus, playerById, type LogEntry } from './viewModel';

/** ASSUMED timings (tune here). The stamp used to hold 1.3s; the toast is a little longer. */
export const SALE_FX = {
  /** SOLD! stamp on the bay, from the snapshot that sold it until it is removed. */
  stampHoldMs: 2000,
  /** Won/lost toast under the status strip. */
  toastMs: 3200,
} as const;

export interface SaleNote {
  n: number;
  bay: number | undefined;
  mine: boolean;
  /** "You won Teddy Bear!" / "Kai won Teddy Bear" (no shape glyph; the chip shows it). */
  title: string;
  /** "for $250" / "with a Proxy" / "" when the amount is unknown. */
  detail: string;
  /** Winner's player color id and shape glyph, for the toast chip. */
  color: string | null;
  shape: string;
  /** Polite live-region text, or null when another region already reads this sale. */
  speak: string | null;
}

export interface SaleToast {
  key: number;
  main: SaleNote;
  /** Other sales in the same batch ("+2 more sold"). */
  more: number;
  /** Joined polite text for the batch ('' = say nothing). */
  speech: string;
}

function amountText(a: LogEntry['amount']): string {
  if (a === undefined) return '';
  return a === 'proxy' ? 'with a Proxy' : `for $${a}`;
}

/** The note for one `sold` log entry, or null for any other entry. */
export function saleNote(view: PlayerView, e: LogEntry, stripN: number | null): SaleNote | null {
  if (e.kind !== 'sold' || !e.by) return null;
  const who = playerById(view, e.by);
  const mine = e.by === view.me;
  const item = cardInfo(e.card ?? null)?.name ?? 'the item';
  const name = who?.name ?? 'Someone';
  const title = mine ? `You won ${item}!` : `${name} won ${item}`;
  const detail = amountText(e.amount);
  const speak = mine || e.n === stripN ? null : `${title}${detail ? ` ${detail}` : ''}`;
  return { n: e.n, bay: e.bay, mine, title, detail, color: who?.color ?? null, shape: who?.shape ?? '', speak };
}

/**
 * Sales newer than `lastN` (the highest log number already handled). `lastN === null` (first
 * snapshot, late join, reconnect) only sets the baseline, so history never pops a toast.
 */
export function newSales(
  view: PlayerView,
  lastN: number | null,
): { lastN: number; items: SaleNote[] } {
  const maxN = view.log.reduce((m, e) => Math.max(m, e.n), 0);
  if (lastN === null) return { lastN: maxN, items: [] };
  const stripN = latestStatus(view)?.n ?? null;
  const items = view.log
    .filter((e) => e.n > lastN)
    .sort((a, b) => a.n - b.n)
    .flatMap((e) => {
      const s = saleNote(view, e, stripN);
      return s ? [s] : [];
    });
  return { lastN: Math.max(lastN, maxN), items };
}

/** One toast per batch: my newest win if I won anything, else the newest sale. */
export function toastFor(items: readonly SaleNote[]): SaleToast | null {
  if (items.length === 0) return null;
  const mine = items.filter((s) => s.mine);
  const main = (mine.length ? mine : items)[(mine.length ? mine : items).length - 1]!;
  const speech = items
    .map((s) => s.speak)
    .filter((t): t is string => !!t)
    .join('. ');
  return { key: main.n, main, more: items.length - 1, speech };
}
