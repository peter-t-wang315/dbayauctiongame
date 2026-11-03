'use client';
// First-game tips (04 section 4.8): a small non-modal toast under the status strip. One tip at a
// time; each tip shows once per device (marked seen as soon as it shows). Triggers are pure
// (lib/game-ui/tips.ts). The toast is pointer-transparent except its "Got it" button, so it never
// blocks a tap on the bay underneath, and it hides by itself (paused while hovered or focused).
import { useEffect, useState } from 'react';
import type { PlayerView } from '@dbay/protocol';
import { loadSeen, nextTip, resetSeen, saveSeen, type Tip, type TipId } from '../../lib/game-ui/tips';
import './tips.css';

/** How long a tip stays up (ASSUMED; long enough to read ~120 chars twice). */
const TIP_MS = 9000;
/** Quiet gap after a tip before the next one may show (ASSUMED). */
const TIP_GAP_MS = 3000;
const RESET_EVENT = 'dbay:tips-reset';

/** "Show tips again" (Settings): clears this device's memory and tells a mounted toast. */
export function showTipsAgain(): void {
  resetSeen();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RESET_EVENT));
}

export function TipToast({ view, selectedProxy }: { view: PlayerView; selectedProxy: boolean }) {
  // null until read on the client (no storage during SSR).
  const [seen, setSeen] = useState<Set<TipId> | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [resting, setResting] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setSeen(loadSeen());
    const onReset = () => setSeen(loadSeen());
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, []);

  // Pick the next unseen tip whose trigger holds on this snapshot.
  useEffect(() => {
    if (!seen || tip || resting) return;
    const t = nextTip(view, seen, { selectedProxy });
    if (!t) return;
    const next = new Set(seen).add(t.id);
    saveSeen(next); // false = storage unavailable: still one-time for this session
    setSeen(next);
    setTip(t);
  }, [view, seen, tip, resting, selectedProxy]);

  // Auto-hide (not while the player is reading it with the pointer or keyboard).
  useEffect(() => {
    if (!tip || paused) return;
    const id = setTimeout(() => close(), TIP_MS);
    return () => clearTimeout(id);
  }, [tip, paused]);

  useEffect(() => {
    if (!resting) return;
    const id = setTimeout(() => setResting(false), TIP_GAP_MS);
    return () => clearTimeout(id);
  }, [resting]);

  function close() {
    setTip(null);
    setPaused(false);
    setResting(true);
  }

  return (
    <div className="g-tipanchor">
      {/* Polite, separate from the status strip's region; the visible copy below is aria-hidden. */}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-fx="tip-live">
        {tip ? `Tip: ${tip.text}` : ''}
      </span>
      {tip && (
        <div
          key={tip.id}
          className="g-tip"
          data-fx="tip"
          data-tip={tip.id}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <p className="g-tip__text" aria-hidden="true">
            <span className="g-tip__tag">TIP</span> {tip.text}
          </p>
          <button type="button" className="g-tip__ok" aria-label="Got it, hide tip" onClick={close}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}

/** Settings row: bring the first-game tips back on this device. */
export function TipsAgain() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      disabled={done}
      onClick={() => {
        showTipsAgain();
        setDone(true);
      }}
    >
      {done ? 'Tips will show again' : 'Show first-game tips again'}
    </button>
  );
}
