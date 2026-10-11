// Seeded PRNG (01 R6): mulberry32 with one independent state per named stream.
// The engine never calls Math.random or Date.now.
import type { RngStream } from './types';

export type RngState = Record<RngStream, number>;

/** xmur3-style string hash -> unsigned 32-bit int. */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function initRng(seed: string): RngState {
  return {
    deck: hashString(`${seed}|deck`),
    calls: hashString(`${seed}|calls`),
    closes: hashString(`${seed}|closes`),
    misc: hashString(`${seed}|misc`),
  };
}

/** Next float in [0, 1) from one stream; advances only that stream. */
export function nextFloat(rng: RngState, stream: RngStream): number {
  const s = (rng[stream] + 0x6d2b79f5) >>> 0;
  rng[stream] = s;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, n). */
export function nextInt(rng: RngState, stream: RngStream, n: number): number {
  return Math.floor(nextFloat(rng, stream) * n);
}

/** Fisher-Yates; returns a new array. */
export function shuffle<T>(rng: RngState, stream: RngStream, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = nextInt(rng, stream, i + 1);
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}
