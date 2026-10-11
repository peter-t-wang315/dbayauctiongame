// FULL base pack (docs/03-content.md sections 3-4). Contains hidden actualValue/tier: server and engine only.
import { ANTIQUES_ITEMS } from './items/antiques';
import { COLLECTIBLES_ITEMS } from './items/collectibles';
import { GLASS_ITEMS } from './items/glass';
import { MEDIA_ITEMS } from './items/media';
import { MISC_ITEMS } from './items/misc';
import { TOYS_ITEMS } from './items/toys';
import { CATEGORIES } from './categories';
import type { ContentPack } from './schema';
import { SPECIALS } from './specials';

export const BASE_PACK_ID = 'base';

/** Base pack: 6 categories x 10 items (60) + 5 Display Case + 4 Gift specials (69 cards). */
export const basePack: ContentPack = {
  packId: BASE_PACK_ID,
  version: 1,
  categories: CATEGORIES,
  items: [
    ...TOYS_ITEMS,
    ...MEDIA_ITEMS,
    ...GLASS_ITEMS,
    ...COLLECTIBLES_ITEMS,
    ...ANTIQUES_ITEMS,
    ...MISC_ITEMS,
  ],
  specials: SPECIALS,
};
