import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ContentPackSchema, ItemDefSchema, activePack, fixturePack, toPublicPack } from '../src/index';
import { publicPack } from '../src/public';

describe('content schema', () => {
  it('the fixture pack validates', () => {
    expect(() => ContentPackSchema.parse(fixturePack)).not.toThrow();
  });

  it('rejects bad items', () => {
    const good = fixturePack.items[0]!;
    expect(ItemDefSchema.safeParse({ ...good, estimatedValue: 42 }).success).toBe(false); // not x5
    expect(ItemDefSchema.safeParse({ ...good, id: 'media-pink-snake' }).success).toBe(false); // wrong prefix
    expect(ItemDefSchema.safeParse({ ...good, tier: 'jackpot' }).success).toBe(false); // ratio mismatch
    expect(ItemDefSchema.safeParse({ ...good, flavor: 'one two three four five six seven eight nine ten eleven twelve thirteen' }).success).toBe(false);
  });

  it('rejects duplicate ids', () => {
    const dup = { ...fixturePack, items: [...fixturePack.items, fixturePack.items[0]!] };
    expect(ContentPackSchema.safeParse(dup).success).toBe(false);
  });
});

describe('public entry', () => {
  it('matches the full pack with secrets stripped', () => {
    expect(publicPack).toEqual(toPublicPack(activePack));
  });

  it('contains no secret fields', () => {
    const json = JSON.stringify(publicPack);
    expect(json).not.toMatch(/actualValue|"tier"/);
  });

  it('does not import the full data', () => {
    const src = readFileSync(fileURLToPath(new URL('../src/public.ts', import.meta.url)), 'utf8');
    expect(src).not.toMatch(/from '\.\/(index|fixture)'/);
  });
});
