import type { CategoryDef } from './schema';

/** Category display data (03 section 1; accents finalized in 04). Public, not secret. */
export const CATEGORIES: CategoryDef[] = [
  { id: 'toys', name: 'Toys & Plush', emoji: '🧸', accentHint: '#E4572E' },
  { id: 'media', name: 'Books, Movies & Music', emoji: '📀', accentHint: '#3A86FF' },
  { id: 'glass', name: 'Pottery & Glass', emoji: '🏺', accentHint: '#2EC4B6' },
  { id: 'collectibles', name: 'Collectibles', emoji: '🪙', accentHint: '#8E5BD9' },
  { id: 'antiques', name: 'Antiques & Art', emoji: '🖼️', accentHint: '#A47148' },
  { id: 'misc', name: 'Everything Else', emoji: '📦', accentHint: '#7A8793' },
];
