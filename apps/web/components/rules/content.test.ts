import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RULES, wordCount } from './content';

describe('rules copy (04 section 3.6)', () => {
  it('keeps every section under 80 words', () => {
    for (const s of RULES) expect(wordCount(s), s.id).toBeLessThan(80);
  });

  it('references every rule R1-R37 from 01 in source comments', () => {
    const src = readFileSync(new URL('./content.ts', import.meta.url), 'utf8');
    const seen = new Set([...src.matchAll(/\bR(\d+)\b/g)].map((m) => Number(m[1])));
    const missing = Array.from({ length: 37 }, (_, i) => i + 1).filter((n) => !seen.has(n));
    expect(missing).toEqual([]);
  });

  it('has unique section ids', () => {
    expect(new Set(RULES.map((s) => s.id)).size).toBe(RULES.length);
  });
});
