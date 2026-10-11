// Base pack validation (docs/03-content.md sections 2.4, 3.7, 4, 5). Values in 03 are authored;
// these tests fail if the data drifts from them.
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../src/categories';
import { ContentPackSchema, ItemDefSchema, SpecialDefSchema, type ItemDef } from '../src/schema';
import { basePack } from '../src/base-pack';
import { activePack } from '../src/index';

const CATEGORY_IDS = ['toys', 'media', 'glass', 'collectibles', 'antiques', 'misc'] as const;
const items = basePack.items;
const specials = basePack.specials;

const byCategory = (cat: string): ItemDef[] => items.filter((i) => i.category === cat);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// 03 section 3.7 (authored per-category totals, used as a regression check).
const EXPECTED_SUM_EST: Record<string, number> = {
  toys: 1110,
  media: 1185,
  glass: 1140,
  collectibles: 1110,
  antiques: 1125,
  misc: 1250,
};
const EXPECTED_SUM_ACTUAL: Record<string, number> = {
  toys: 1420,
  media: 1435,
  glass: 1435,
  collectibles: 1415,
  antiques: 1425,
  misc: 1445,
};
// 03 section 2.4 tier mix per category.
const EXPECTED_TIERS: Record<string, [number, number, number, number]> = {
  // [dud, fair, good, jackpot]
  toys: [2, 5, 2, 1],
  media: [1, 6, 3, 0],
  glass: [2, 5, 2, 1],
  collectibles: [2, 5, 3, 0],
  antiques: [1, 5, 3, 1],
  misc: [1, 7, 2, 0],
};

// Obvious marketplace, toy, game and brand names that must not appear in any public text.
const BRAND_DENYLIST = [
  'ebay',
  'amazon',
  'etsy',
  'craigslist',
  'alibaba',
  'walmart',
  'hasbro',
  'mattel',
  'lego',
  'monopoly',
  'pokemon',
  'pokémon',
  'pikachu',
  'charizard',
  'schwinn',
  'barbie',
  'nintendo',
  'tamagotchi',
  'furby',
  'beanie baby',
  'hot wheels',
  'rubik',
  'fisher-price',
  'disney',
  'mickey',
  'snoopy',
  'hello kitty',
  'transformers',
  'star wars',
  'marvel',
  'tupperware',
  'coca-cola',
  'pepsi',
];

function allStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(allStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(allStrings);
  return [];
}

describe('base pack: zod validation (MUST)', () => {
  it('the whole base pack parses with ContentPackSchema', () => {
    const result = ContentPackSchema.safeParse(basePack);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
  });

  it('every item parses with ItemDefSchema', () => {
    for (const item of items) {
      const r = ItemDefSchema.safeParse(item);
      if (!r.success) console.error(item.id, r.error.issues);
      expect(r.success, item.id).toBe(true);
    }
  });

  it('every special parses with SpecialDefSchema', () => {
    for (const s of specials) {
      expect(SpecialDefSchema.safeParse(s).success, s.id).toBe(true);
    }
  });

  it('the active (full) pack is the base pack', () => {
    expect(activePack).toBe(basePack);
    expect(CATEGORIES.map((c) => c.id)).toEqual([...CATEGORY_IDS]);
  });
});

describe('base pack: counts and ids', () => {
  it('has exactly 60 items, 10 per category', () => {
    expect(items).toHaveLength(60);
    for (const cat of CATEGORY_IDS) {
      expect(byCategory(cat), cat).toHaveLength(10);
    }
  });

  it('has exactly 5 Display Case and 4 Gift specials (69 cards total)', () => {
    expect(specials.filter((s) => s.type === 'displayCase')).toHaveLength(5);
    expect(specials.filter((s) => s.type === 'gift')).toHaveLength(4);
    expect(items.length + specials.length).toBe(69);
  });

  it('ids are unique across items and specials', () => {
    const ids = [...items.map((i) => i.id), ...specials.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('special ids are numbered 1..5 and 1..4', () => {
    expect(specials.filter((s) => s.type === 'displayCase').map((s) => s.id)).toEqual(
      [1, 2, 3, 4, 5].map((n) => `special-display-case-${n}`),
    );
    expect(specials.filter((s) => s.type === 'gift').map((s) => s.id)).toEqual(
      [1, 2, 3, 4].map((n) => `special-gift-${n}`),
    );
  });
});

describe('base pack: values from 03', () => {
  it('per-category est and actual sums match 03 section 3.7', () => {
    for (const cat of CATEGORY_IDS) {
      expect(sum(byCategory(cat).map((i) => i.estimatedValue)), cat).toBe(EXPECTED_SUM_EST[cat]);
      expect(sum(byCategory(cat).map((i) => i.actualValue)), cat).toBe(EXPECTED_SUM_ACTUAL[cat]);
    }
  });

  it('total est 6,920 and total actual 8,575', () => {
    expect(sum(items.map((i) => i.estimatedValue))).toBe(6920);
    expect(sum(items.map((i) => i.actualValue))).toBe(8575);
  });

  it('per-category actual totals are within +/-5% of the cross-category mean (schema rule)', () => {
    const totals = CATEGORY_IDS.map((c) => sum(byCategory(c).map((i) => i.actualValue)));
    const mean = sum(totals) / totals.length;
    for (const t of totals) {
      expect(Math.abs(t - mean) / mean).toBeLessThanOrEqual(0.05);
    }
  });

  it('tier counts are 9 dud / 33 fair / 15 good / 3 jackpot overall', () => {
    const count = (tier: string) => items.filter((i) => i.tier === tier).length;
    expect({
      dud: count('dud'),
      fair: count('fair'),
      good: count('good'),
      jackpot: count('jackpot'),
    }).toEqual({ dud: 9, fair: 33, good: 15, jackpot: 3 });
  });

  it('tier mix per category matches 03 section 2.4', () => {
    for (const cat of CATEGORY_IDS) {
      const c = (tier: string) => byCategory(cat).filter((i) => i.tier === tier).length;
      expect([c('dud'), c('fair'), c('good'), c('jackpot')], cat).toEqual(EXPECTED_TIERS[cat]);
    }
  });

  it('every estimate is 25-400 and the base pack stays at 30-300', () => {
    for (const i of items) {
      expect(i.estimatedValue, i.id).toBeGreaterThanOrEqual(30);
      expect(i.estimatedValue, i.id).toBeLessThanOrEqual(300);
    }
  });

  it('every actual and estimate is a positive multiple of 5', () => {
    for (const i of items) {
      for (const v of [i.estimatedValue, i.actualValue]) {
        expect(v > 0 && v % 5 === 0, `${i.id}: ${v}`).toBe(true);
      }
    }
  });

  it('actual/est ratio sits inside the tier range (with the 2.5/est rounding tolerance)', () => {
    const RANGES = {
      dud: [0.25, 0.6],
      fair: [0.8, 1.25],
      good: [1.3, 2.0],
      jackpot: [2.5, 4.0],
    } as const;
    for (const i of items) {
      const [lo, hi] = RANGES[i.tier];
      const tol = 2.5 / i.estimatedValue;
      const r = i.actualValue / i.estimatedValue;
      expect(r, i.id).toBeGreaterThanOrEqual(lo - tol);
      expect(r, i.id).toBeLessThanOrEqual(hi + tol);
    }
  });

  it('flavor lines are at most 12 words; names are 2-40 characters', () => {
    for (const i of items) {
      expect(i.flavor.trim().split(/\s+/).length, i.id).toBeLessThanOrEqual(12);
      expect(i.name.length, i.id).toBeGreaterThanOrEqual(2);
      expect(i.name.length, i.id).toBeLessThanOrEqual(40);
    }
  });

  it('specials carry the 03 display values', () => {
    for (const s of specials) {
      if (s.type === 'displayCase') {
        expect(s.estimatedDisplay).toBe('$100 · Wild');
        expect(s.fixedValue).toBe(100);
      } else {
        expect(s.estimatedDisplay).toBe('?');
        expect(s.fixedValue).toBeUndefined();
      }
      expect(s.name.length).toBeGreaterThan(0);
    }
  });
});

describe('base pack: fictional names (sanity)', () => {
  it('no item or special text contains a known brand or marketplace name', () => {
    const texts = [
      ...items.flatMap((i) => [i.name, i.flavor]),
      ...specials.flatMap((s) => [s.name, s.flavor]),
    ].map((t) => t.toLowerCase());
    for (const brand of BRAND_DENYLIST) {
      const hit = texts.find((t) => t.includes(brand));
      expect(hit, `brand "${brand}" in "${hit}"`).toBeUndefined();
    }
  });
});

describe('base pack: no duplicates in the data itself', () => {
  it('no two items share a name', () => {
    const names = items.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every string in the base pack is free of leftover markdown artifacts', () => {
    const strings = allStrings(basePack);
    for (const s of strings) {
      expect(s, s).not.toMatch(/[`|]/);
    }
  });
});
