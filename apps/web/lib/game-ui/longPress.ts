// Long-press detection for the bay item-details sheet. Pure timing/slop logic (timers injectable
// for tests). A long press that fired must swallow the click that follows pointer-up so it never bids.
export const LONG_PRESS_MS = 450;
export const LONG_PRESS_SLOP = 10;

export interface LongPress {
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  /** Pointer released. Returns true if the long press had fired (caller must swallow the click). */
  up(): boolean;
  cancel(): void;
}

export function createLongPress(
  onLong: () => void,
  opts: {
    ms?: number;
    slop?: number;
    set?: (fn: () => void, ms: number) => unknown;
    clear?: (h: unknown) => void;
  } = {},
): LongPress {
  const ms = opts.ms ?? LONG_PRESS_MS;
  const slop = opts.slop ?? LONG_PRESS_SLOP;
  const set = opts.set ?? ((fn, t) => setTimeout(fn, t));
  const clear = opts.clear ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let handle: unknown = null;
  let origin: { x: number; y: number } | null = null;
  let fired = false;
  const stop = () => {
    if (handle !== null) clear(handle);
    handle = null;
    origin = null;
  };
  return {
    down(x, y) {
      stop();
      fired = false;
      origin = { x, y };
      handle = set(() => {
        handle = null;
        fired = true;
        onLong();
      }, ms);
    },
    move(x, y) {
      if (!origin) return;
      if (Math.hypot(x - origin.x, y - origin.y) > slop) stop();
    },
    up() {
      stop();
      const was = fired;
      fired = false;
      return was;
    },
    cancel() {
      stop();
      fired = false;
    },
  };
}
