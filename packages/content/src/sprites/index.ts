// Sprite data (public, no secrets). See docs/03-content.md "Sprites".
import type { Sprite } from '../schema';
import { ANTIQUES_SPRITES } from './antiques';
import { COLLECTIBLES_SPRITES } from './collectibles';
import { GLASS_SPRITES } from './glass';
import { MEDIA_SPRITES } from './media';
import { MISC_SPRITES } from './misc';
import { TOYS_SPRITES } from './toys';

export { CATEGORY_SPRITES } from './categories';
export { SHARED_PALETTE } from './util';

/** Per-item sprites keyed by item id. */
export const ITEM_SPRITES: Record<string, Sprite> = {
  ...TOYS_SPRITES,
  ...MEDIA_SPRITES,
  ...GLASS_SPRITES,
  ...COLLECTIBLES_SPRITES,
  ...ANTIQUES_SPRITES,
  ...MISC_SPRITES,
};

/** Attach the item's sprite (if one is authored) to an item record. */
export function withSprite<T extends { id: string }>(item: T): T & { sprite?: Sprite } {
  const s = ITEM_SPRITES[item.id];
  return s ? { ...item, sprite: s } : item;
}
