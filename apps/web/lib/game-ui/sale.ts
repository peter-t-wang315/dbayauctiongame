// "Make the sale the moment" (playtest follow-ups, slice 3). Pure: which sales are new, what the
// won/lost toast says, and what (if anything) it should read out. No React, DOM or clock.
//
// Screen-reader rule (each sale read exactly once): a sale to me is announced assertively by
// announce.ts ("Sold to you: {item}"); another player's sale is read by the toast's polite region.
// The status strip keeps showing sale lines but silences them (`isSaleEntry`), because it often
// shows something else instead ("Going once...", a refill line, a local flash) and would miss them.
import type { PlayerView } from '@dbay/protocol';
import { cardInfo, playerById, type LogEntry } from './viewModel';

/** ASSUMED timings (tune here). The stamp used to hold 1.3s; the toast is a little longer (it covers
 * the top edge of the first bay row, so keep it short). */
export const SALE_FX = {
  /** SOLD! stamp on the bay, from the snapshot that sold it until it is removed. */
  stampHoldMs: 2000,
  /** Won/lost toast under the status strip. */
  toastMs: 2800,
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
export function saleNote(view: PlayerView, e: LogEntry): SaleNote | null {
  if (e.kind !== 'sold' || !e.by) return null;
  const who = playerById(view, e.by);
  const mine = e.by === view.me;
  const item = cardInfo(e.card ?? null)?.name ?? 'the item';
  const name = who?.name ?? 'Someone';
  const title = mine ? `You won ${item}!` : `${name} won ${item}`;
  const detail = amountText(e.amount);
  const speak = mine ? null : `${title}${detail ? ` ${detail}` : ''}`;
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
  const items = view.log
    .filter((e) => e.n > lastN)
    .sort((a, b) => a.n - b.n)
    .flatMap((e) => {
      const s = saleNote(view, e);
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

/** True when log entry `n` is a sale (the polite strip must not read it: the toast or announce.ts does). */
export function isSaleEntry(view: PlayerView, n: number): boolean {
  return view.log.some((e) => e.n === n && e.kind === 'sold' && !!e.by);
}
