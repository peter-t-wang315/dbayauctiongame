// Timer math for bay timers and the turn bar. All inputs are server-clock ms; callers pass
// `serverNow()` from useRoom() (client clock + estimated offset, 05 section 6.6).

export const DANGER_MS = 3000;
/** Floor for the denominator of a bay timer bar (Frenzy windows are 18-60s, 02 section 4). */
export const MIN_BAR_TOTAL_MS = 15000;

export function remainingMs(endsAt: number | undefined, serverNow: number): number | null {
  if (endsAt === undefined) return null;
  return Math.max(0, endsAt - serverNow);
}

/** 0..1 fill of a depleting bar. `totalMs` is the longest remaining time seen for this window. */
export function barFraction(remaining: number | null, totalMs: number): number {
  if (remaining === null || totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, remaining / totalMs));
}

/** m:ss, rounding up so the clock never shows 0:00 while time is left. */
export function formatClock(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function isDanger(remaining: number | null): boolean {
  return remaining !== null && remaining > 0 && remaining <= DANGER_MS;
}

/**
 * Track the largest remaining time seen for one window so the bar starts full and drains. The
 * total resets when the window `key` changes (new item in the bay) and only grows within a window,
 * so an anti-snipe extension refills the bar up to its earlier maximum.
 */
export function nextBarTotal(
  prev: { key: string; total: number } | undefined,
  key: string,
  remaining: number | null,
  floor = MIN_BAR_TOTAL_MS,
): { key: string; total: number } {
  const base = prev && prev.key === key ? prev.total : floor;
  return { key, total: Math.max(base, remaining ?? 0) };
}

/** Cooldown left for the local player (Frenzy), 0 when none. */
export function cooldownLeft(cooldownUntil: number | undefined, serverNow: number): number {
  return cooldownUntil === undefined ? 0 : Math.max(0, cooldownUntil - serverNow);
}
