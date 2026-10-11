// FULL content entry. Contains hidden actual values: server/engine only.
// The web app must import @dbay/content/public instead (enforced by ESLint).
import { basePack } from './base-pack';
import type { ContentPack } from './schema';

export * from './schema';
export { CATEGORIES } from './categories';
export { CATEGORY_SPRITES, SHARED_PALETTE } from './sprites';
export { basePack, BASE_PACK_ID } from './base-pack';
export { fixturePack } from './fixture';

/** The pack used to build decks: the full base pack (03). */
export const activePack: ContentPack = basePack;
