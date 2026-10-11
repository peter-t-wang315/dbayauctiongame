// Public projection no-leak tests (MUST). The public entry is bundled into the browser, so no
// hidden field may appear in its values, its keys, its JSON, or its source text.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { publicPack, getPublicCard } from '../src/public';
import { basePack } from '../src/base-pack';
import { toPublicPack } from '../src/schema';

const SECRET_KEYS = ['actualValue', 'actual', 'tier'];

function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [k, ...allKeys(v)]);
  }
  return [];
}

const srcPath = (name: string) => fileURLToPath(new URL(`../src/${name}`, import.meta.url));

describe('public projection: no leak (MUST)', () => {
  it('no key anywhere in the public export is actualValue, actual or tier', () => {
    const keys = allKeys(publicPack);
    for (const k of SECRET_KEYS) {
      expect(keys, k).not.toContain(k);
    }
  });

  it('the serialized public export contains no secret field name or value field', () => {
    const json = JSON.stringify(publicPack);
    expect(json).not.toMatch(/actualValue/);
    expect(json).not.toMatch(/"actual"/);
    expect(json).not.toMatch(/"tier"/);
  });

  it('every public item equals the full item with actualValue and tier removed', () => {
    const expected = toPublicPack(basePack);
    expect(publicPack).toEqual(expected);
    for (const item of publicPack.items) {
      const full = basePack.items.find((i) => i.id === item.id)!;
      const { actualValue: _a, tier: _t, ...rest } = full;
      expect(item).toEqual(rest);
    }
  });

  it('public item count and specials match the full pack', () => {
    expect(publicPack.items).toHaveLength(60);
    expect(publicPack.specials).toHaveLength(9);
  });

  it('getPublicCard returns public data only', () => {
    for (const id of ['toys-bean-bag-bear', 'special-gift-1', 'special-display-case-5']) {
      const card = getPublicCard(id) as Record<string, unknown>;
      expect(card, id).not.toBeNull();
      expect(Object.keys(card)).not.toContain('actualValue');
      expect(Object.keys(card)).not.toContain('tier');
    }
    expect(getPublicCard('no-such-card')).toBeNull();
  });

  it('public source files do not mention the secret fields in code or data', () => {
    // Comments are stripped by bundlers, so only check the data-bearing files for the field names.
    for (const name of ['public.ts', 'public-items.ts', 'specials.ts', 'categories.ts']) {
      const src = readFileSync(srcPath(name), 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n');
      expect(src, name).not.toMatch(/actualValue|\btier\b|\bactual\b/);
    }
  });

  it('public entry does not import the full data (base pack, items, index, fixture)', () => {
    const src = readFileSync(srcPath('public.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\/(index|fixture|base-pack|items\/[a-z]+)'/);
  });
});
