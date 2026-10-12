import type { Sprite } from '../schema';

/** Shared palette keys every sprite may use without declaring them (03 "Sprites"). `.` is transparent. */
export const SHARED_PALETTE: Record<string, string> = {
  k: '#0E1511',
  w: '#FFF6E0',
};

/** Build a sprite from its item colors (max 4) and 12 rows of 12 palette keys. */
export function sprite(palette: Record<string, string>, rows: string[]): Sprite {
  return { rows, palette };
}
