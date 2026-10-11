import { CATEGORIES, SpriteSchema, basePack } from '../src/index';
import type { Sprite } from '../src/index';
import { publicPack } from '../src/public';
import { CATEGORY_SPRITES, ITEM_SPRITES, SHARED_PALETTE } from '../src/sprites';
import { describe, expect, it } from 'vitest';

function checkSprite(name: string, s: Sprite) {
  expect(SpriteSchema.safeParse(s).success, `${name}: SpriteSchema`).toBe(true);
  const palette = s.palette ?? {};
  const own = Object.keys(palette).filter((k) => !(k in SHARED_PALETTE));
  expect(own.length, `${name}: at most 4 item colors`).toBeLessThanOrEqual(4);
  for (const [k, v] of Object.entries(palette)) {
    expect(v, `${name}: color ${k}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
  }
  const allowed = new Set(['.', ...Object.keys(SHARED_PALETTE), ...Object.keys(palette)]);
  const used = new Set<string>();
  s.rows.forEach((row, y) => {
    for (const ch of row) {
      expect(allowed.has(ch), `${name}: row ${y} uses unknown key "${ch}"`).toBe(true);
      used.add(ch);
    }
  });
  for (const k of own) expect(used.has(k), `${name}: palette key ${k} unused`).toBe(true);
  expect(used.has('k'), `${name}: has an ink outline`).toBe(true);
}

describe('item sprites', () => {
  it('every authored sprite is valid and belongs to a real item', () => {
    const ids = new Set(basePack.items.map((i) => i.id));
    for (const [id, s] of Object.entries(ITEM_SPRITES)) {
      expect(ids.has(id), `unknown item id ${id}`).toBe(true);
      checkSprite(id, s);
    }
  });

  it('sprites are attached to items in both the full and the public pack', () => {
    for (const item of basePack.items) {
      if (ITEM_SPRITES[item.id]) expect(item.sprite, item.id).toEqual(ITEM_SPRITES[item.id]);
    }
    for (const item of publicPack.items) {
      if (ITEM_SPRITES[item.id]) expect(item.sprite, item.id).toEqual(ITEM_SPRITES[item.id]);
    }
  });
});

describe('category fallback sprites', () => {
  it('exist for all 6 categories and are valid', () => {
    expect(Object.keys(CATEGORY_SPRITES).sort()).toEqual(CATEGORIES.map((c) => c.id).sort());
    expect(CATEGORIES).toHaveLength(6);
    for (const c of CATEGORIES) checkSprite(`category ${c.id}`, CATEGORY_SPRITES[c.id]);
  });

  it('shared palette is ink and cream', () => {
    expect(SHARED_PALETTE).toEqual({ k: '#0E1511', w: '#FFF6E0' });
  });
});
