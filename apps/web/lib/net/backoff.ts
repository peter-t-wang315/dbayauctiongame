// Reconnect backoff (05 sections 6.6 and 11): 500ms doubling to a 5s cap, with jitter.

export const BACKOFF_MIN_MS = 500;
export const BACKOFF_MAX_MS = 5000;

/** Un-jittered delay for the given attempt (0-based). */
export function baseDelay(attempt: number, min = BACKOFF_MIN_MS, max = BACKOFF_MAX_MS): number {
  return Math.min(max, min * 2 ** Math.max(0, attempt));
}

/**
 * Delay with +-25% jitter, never below `min` and never above `max`.
 * `rand` is a [0,1) source, injected so it is testable.
 */
export function backoffDelay(
  attempt: number,
  rand: () => number = Math.random,
  min = BACKOFF_MIN_MS,
  max = BACKOFF_MAX_MS,
): number {
  const base = baseDelay(attempt, min, max);
  const jittered = base * (0.75 + rand() * 0.5);
  return Math.round(Math.min(max, Math.max(min, jittered)));
}
