'use client';
// Dialog: bottom sheet on mobile. Focus is trapped, Esc and a tap outside the sheet close, focus
// returns on close.
import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const downOutside = useRef(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  // Tap-away close (playtest B9): a press that starts AND ends outside the sheet closes it; a drag
  // or scroll that starts inside never does. Closing on the click (the last event of a tap) means
  // no ghost tap reaches the game underneath. The scrim's `cursor: pointer` makes iOS Safari
  // deliver that click on a plain div.
  const outside = (e: { target: EventTarget }) => !ref.current?.contains(e.target as Node);
  return (
    <div
      className="scrim scrim--bottom"
      data-fx="sheet-scrim"
      onPointerDown={(e) => {
        downOutside.current = outside(e);
      }}
      onClick={(e) => {
        const close = downOutside.current && outside(e);
        downOutside.current = false;
        if (close) onClose();
      }}
    >
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
