import type { CategoryDef } from './schema';

/** Category display data (03 section 1; accents finalized in 04). Public, not secret.
 * Names are the short labels used on every screen (user decision 2026-10-12). */
export const CATEGORIES: CategoryDef[] = [
  { id: 'toys', name: 'Toys', emoji: '🧸', accentHint: '#E4572E' },
  { id: 'media', name: 'Media', emoji: '📀', accentHint: '#3A86FF' },
  { id: 'glass', name: 'Glass', emoji: '🏺', accentHint: '#2EC4B6' },
  { id: 'collectibles', name: 'Collectibles', emoji: '🪙', accentHint: '#8E5BD9' },
  { id: 'antiques', name: 'Antiques', emoji: '🖼️', accentHint: '#A47148' },
  { id: 'misc', name: 'Misc', emoji: '📦', accentHint: '#7A8793' },
];
