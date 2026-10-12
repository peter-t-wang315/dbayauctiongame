'use client';
// Client-side reveal pacing (01 R37: the animation is client-only; the data arrives in one snapshot).
// One card flips every `stepMs` (04 section 3.5: about 0.5s). Skip jumps to the end. Starts finished
// when the phase is already `ended` (late joiner / reconnect) or the user prefers reduced motion.
import { useCallback, useEffect, useState } from 'react';

export const REVEAL_STEP_MS = 500;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useRevealSequence(total: number, startFinished: boolean, stepMs = REVEAL_STEP_MS) {
  const [shown, setShown] = useState(() => (startFinished ? total : 0));

  useEffect(() => {
    if (prefersReducedMotion()) setShown(total);
  }, [total]);

  useEffect(() => {
    if (shown >= total) return;
    const t = setTimeout(() => setShown((n) => Math.min(total, n + 1)), stepMs);
    return () => clearTimeout(t);
  }, [shown, total, stepMs]);

  const skip = useCallback(() => setShown(total), [total]);
  return { shown, done: shown >= total, skip };
}
