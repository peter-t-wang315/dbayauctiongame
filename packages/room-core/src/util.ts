// Pure helpers: constant-time secret compare, deterministic hash, per-connection rate limiter.

/** Constant-time string equality (for SHA-256 hex digests). Length mismatch still scans. */
export function secretsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** FNV-1a 32-bit. Deterministic, used for bot delays (not security-relevant). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------- rate limiting (05 section 12: 20 msg/s per connection, 3 strikes -> close) ----------

export const RATE_LIMIT_PER_SEC = 20;
export const RATE_LIMIT_STRIKES = 3;
const WINDOW_MS = 1000;

export interface RateState {
  windowStart: number;
  count: number;
  /** Windows in which the limit was exceeded. */
  strikes: number;
  /** True once the strike limit was hit; the wrapper closes the socket. */
  closed: boolean;
}

export type RateVerdict = 'ok' | 'limited' | 'close';

export function newRateState(now: number): RateState {
  return { windowStart: now, count: 0, strikes: 0, closed: false };
}

/**
 * Count one inbound message for a connection at server time `now`. Pure: returns the new state and
 * a verdict. `limited` -> reply `err RATE_LIMITED` (do not process); `close` -> close the socket.
 * The wrapper keeps one RateState per connection in memory (it is not part of RoomState).
 */
export function rateLimit(
  s: RateState,
  now: number,
  limit: number = RATE_LIMIT_PER_SEC,
): { state: RateState; verdict: RateVerdict } {
  if (s.closed) return { state: s, verdict: 'close' };
  let { windowStart, count, strikes } = s;
  if (now - windowStart >= WINDOW_MS || now < windowStart) {
    windowStart = now;
    count = 0;
  }
  count += 1;
  if (count <= limit)
    return { state: { windowStart, count, strikes, closed: false }, verdict: 'ok' };
  // Exactly one strike per window, on its first excess message.
  if (count === limit + 1) strikes += 1;
  const closed = strikes >= RATE_LIMIT_STRIKES;
  return {
    state: { windowStart, count, strikes, closed },
    verdict: closed ? 'close' : 'limited',
  };
}
