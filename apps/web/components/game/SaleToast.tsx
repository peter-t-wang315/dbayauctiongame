'use client';
// Won/lost toast (playtest follow-ups slice 3): "You won {item}!" / "{name} won {item}" for
// SALE_FX.toastMs after a sale. Non-modal and click-through (pointer-events: none), placed just
// under the status strip so it never covers the hand. Decisions (which sale, what to read) live in
// lib/game-ui/sale.ts; this only renders and times it.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerView } from '@dbay/protocol';
import { newSales, SALE_FX, toastFor, type SaleToast as Toast } from '../../lib/game-ui/sale';

export function useSaleToast(view: PlayerView | null, holdMs: number = SALE_FX.toastMs): Toast | null {
  const lastN = useRef<number | null>(null);
  const [cur, setCur] = useState<Toast | null>(null);
  useEffect(() => {
    if (!view) return;
    const r = newSales(view, lastN.current);
    lastN.current = r.lastN;
    const t = toastFor(r.items);
    if (!t) return;
    setCur(t);
    // Not cancelled on the next snapshot (it must still expire); a newer toast replaces it.
    setTimeout(() => setCur((c) => (c?.key === t.key ? null : c)), holdMs);
  }, [view, holdMs]);
  return cur;
}

export function SaleToast({ view }: { view: PlayerView | null }) {
  const toast = useSaleToast(view);
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  // Sit just below the status strip (its height varies by layout and text).
  useLayoutEffect(() => {
    if (!toast) return;
    const el = ref.current;
    const strip = document.querySelector('[data-fx="status-strip"]');
    const parent = el?.offsetParent;
    if (!el || !strip || !parent) return;
    setTop(strip.getBoundingClientRect().bottom - parent.getBoundingClientRect().top + 6);
  }, [toast]);

  const m = toast?.main;
  return (
    <div
      ref={ref}
      className="g-toast"
      data-fx="sale-toast"
      data-show={m ? 'true' : undefined}
      data-mine={m?.mine ? 'true' : undefined}
      style={{
        ...(top !== null ? { top } : {}),
        ...(m?.color ? { ['--sold' as string]: `var(--p-${m.color})` } : {}),
      }}
    >
      {/* Polite, and only for sales no other region reads (sale.ts); the visible card is aria-hidden. */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {toast?.speech ? <span key={toast.key}>{toast.speech}</span> : null}
      </span>
      {m && (
        <div className="g-toast__card" key={toast.key} aria-hidden="true">
          <span className="g-toast__shape">{m.shape}</span>
          <span className="g-toast__text">
            <span className="g-toast__title">{m.title}</span>
            {(m.detail || toast.more > 0) && (
              <span className="g-toast__detail">
                {m.detail}
                {toast.more > 0 ? `${m.detail ? ' · ' : ''}+${toast.more} more sold` : ''}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
