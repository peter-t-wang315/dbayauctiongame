import { describe, expect, it } from 'vitest';
import { lengthHint } from './lengthHint';

describe('lengthHint', () => {
  it('Classic varies by player count and length, rounded outward', () => {
    expect(lengthHint(true, 'quick', 3)).toBe('About 4-6 min with 3 players.');
    expect(lengthHint(true, 'quick', 4)).toBe('About 6-9 min with 4 players.');
    expect(lengthHint(true, 'quick', 5)).toBe('About 7-10 min with 5 players.');
    expect(lengthHint(true, 'standard', 5)).toBe('About 10-14 min with 5 players.');
    expect(lengthHint(true, 'standard', 6)).toBe('About 13-18 min with 6 players.');
  });
  it('Frenzy ignores player count', () => {
    expect(lengthHint(false, 'quick', 3)).toBe('About 3-7 min.');
    expect(lengthHint(false, 'standard', 6)).toBe('About 5-10 min.');
  });
  it('clamps seats below 3 and above 6', () => {
    expect(lengthHint(true, 'quick', 1)).toBe(lengthHint(true, 'quick', 3));
    expect(lengthHint(true, 'standard', 9)).toBe(lengthHint(true, 'standard', 6));
  });
});
