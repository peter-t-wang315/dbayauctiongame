'use client';
// Android only (navigator.vibrate); iOS Safari has none, so the toggle is hidden there.
import { getSettings } from './settings';
import type { FxEvent } from './events';

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export const PATTERNS = {
  yourTurn: [40],
  outbid: [30, 40, 30],
  rejected: [80],
  soldMine: [20, 40, 20, 40, 60],
} as const;

export function patternFor(e: FxEvent): readonly number[] | null {
  if (e.t === 'yourTurn') return PATTERNS.yourTurn;
  if (e.t === 'outbid') return PATTERNS.outbid;
  if (e.t === 'sold' && e.mine) return PATTERNS.soldMine;
  return null;
}

export function vibrate(p: readonly number[]): void {
  if (!hapticsSupported() || !getSettings().haptics) return;
  try {
    navigator.vibrate([...p]);
  } catch {
    /* ignore */
  }
}
