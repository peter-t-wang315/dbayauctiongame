// PUBLIC content entry: safe for the browser bundle. Must never import ./fixture, ./index, ./base-pack
// or ./items/*, which hold the secret fields. Kept in sync with the full pack by test/content.test.ts.
import { CATEGORIES } from './categories';
import { PUBLIC_ITEMS } from './public-items';
import type { PublicPack } from './schema';
import { SPECIALS } from './specials';
import { withSprite } from './sprites';

export type { CategoryDef, PublicItem, PublicPack, PublicSpecial, Sprite } from './schema';
export { CATEGORIES } from './categories';
export { CATEGORY_SPRITES, ITEM_SPRITES, SHARED_PALETTE, SPECIAL_SPRITES } from './sprites';

export const publicPack: PublicPack = {
  packId: 'base',
  version: 1,
  categories: CATEGORIES,
  items: PUBLIC_ITEMS.map(withSprite),
  specials: SPECIALS,
};

/** Look up public display data for an auction card id from a snapshot. */
export function getPublicCard(id: string) {
  return (
    publicPack.items.find((i) => i.id === id) ??
    publicPack.specials.find((s) => s.id === id) ??
    null
  );
}
