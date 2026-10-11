// FULL content entry. Contains hidden actual values: server/engine only.
// The web app must import @dbay/content/public instead (enforced by ESLint).
import { fixturePack } from './fixture';
import type { ContentPack } from './schema';

export * from './schema';
export { CATEGORIES } from './categories';
export { fixturePack } from './fixture';

/** The pack used to build decks. WS2 swaps this for the full base pack. */
export const activePack: ContentPack = fixturePack;
