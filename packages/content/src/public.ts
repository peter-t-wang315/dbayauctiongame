// PUBLIC content entry: safe for the browser bundle. Must never import ./fixture, ./index or any
// data file containing actualValue/tier. Kept in sync with the full pack by test/content.test.ts.
import { CATEGORIES } from './categories';
import type { PublicPack } from './schema';

export type { CategoryDef, PublicItem, PublicPack, PublicSpecial, Sprite } from './schema';
export { CATEGORIES } from './categories';

export const publicPack: PublicPack = {
  packId: 'fixture',
  version: 1,
  categories: CATEGORIES,
  items: [
    { kind: 'item', id: 'toys-pink-snake', name: 'Fuzzy Pink Snake', category: 'toys', estimatedValue: 40, flavor: 'Soft, long, and weirdly hard to explain at parties.' },
    { kind: 'item', id: 'toys-inflatable-alien', name: 'Inflatable Space Alien', category: 'toys', estimatedValue: 60, flavor: 'Arrived flat. Stayed flat. Still smiling.' },
    { kind: 'item', id: 'toys-bean-bag-bear', name: 'Bean-Bag Bear, Limited Edition', category: 'toys', estimatedValue: 120, flavor: 'Collectors whisper its name. Nobody told the seller.' },
  ],
  specials: [
    { kind: 'special', id: 'special-display-case-1', type: 'displayCase', name: 'Display Case', estimatedDisplay: '$100 · Wild', fixedValue: 100, flavor: 'Fits anything. Judges nothing.' },
    { kind: 'special', id: 'special-gift-1', type: 'gift', name: 'Gift', estimatedDisplay: '?', flavor: "Surprise! Someone else's stuff is now your stuff." },
  ],
};

/** Look up public display data for an auction card id from a snapshot. */
export function getPublicCard(id: string) {
  return publicPack.items.find((i) => i.id === id) ?? publicPack.specials.find((s) => s.id === id) ?? null;
}
