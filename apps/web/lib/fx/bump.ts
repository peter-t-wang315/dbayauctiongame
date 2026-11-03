// Pure description of the bid "bump" animation, so FxController just plays it and the shape
// (what pops, which ring colour, what reduced motion keeps) can be unit tested without a DOM.
export interface BumpStep {
  /** `top-bid` is the price chip inside the bay; `bay` is the whole bay element. */
  target: 'top-bid' | 'bay';
  keyframes: Record<string, unknown[]>;
  duration: number;
  /** Cubic-bezier overshoot; omitted for the plain ease-out steps. */
  overshoot: boolean;
}

/** Steps for a bump on a bay. `mine`: green strong ring and bigger pop; others: soft ink ring. */
export function bumpSteps(mine: boolean, reducedMotion: boolean): BumpStep[] {
  const ring = mine ? 'var(--ok)' : 'var(--ink)';
  const flash = ['0 0 0 0 transparent', `0 0 0 6px ${ring}`, '0 0 0 0 transparent'];
  if (reducedMotion) {
    return [
      { target: 'top-bid', keyframes: { opacity: [0.4, 1] }, duration: 0.15, overshoot: false },
      { target: 'bay', keyframes: { boxShadow: flash }, duration: 0.3, overshoot: false },
    ];
  }
  return [
    { target: 'top-bid', keyframes: { scale: [1, 1.25, 1] }, duration: 0.28, overshoot: true },
    { target: 'bay', keyframes: { scale: [1, mine ? 1.04 : 1.02, 1], boxShadow: flash }, duration: 0.32, overshoot: true },
  ];
}
