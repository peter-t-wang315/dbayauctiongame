// Content lookups used by the engine. Estimates are public; actual values are read only at scoring.
import type { CategoryId } from '@dbay/protocol';
import type { ContentPack } from '@dbay/content';
import { CONFIG } from './config';

export interface CardInfo {
  id: string;
  kind: 'item' | 'displayCase' | 'gift';
  category?: CategoryId;
  /** Public estimate (Display Case = 100, Gift = 0). */
  est: number;
  /** SECRET until reveal (Display Case = 100, Gift = 0). */
  actual: number;
}

export interface PackIndex {
  cards: Map<string, CardInfo>;
  /** Categories that have at least one item, in pack order. */
  categories: CategoryId[];
  itemsByCategory: Map<CategoryId, string[]>;
  displayCases: string[];
  gifts: string[];
}

export function indexPack(pack: ContentPack): PackIndex {
  const cards = new Map<string, CardInfo>();
  const itemsByCategory = new Map<CategoryId, string[]>();
  const displayCases: string[] = [];
  const gifts: string[] = [];
  for (const it of pack.items) {
    cards.set(it.id, {
      id: it.id,
      kind: 'item',
      category: it.category,
      est: it.estimatedValue,
      actual: it.actualValue,
    });
    const list = itemsByCategory.get(it.category) ?? [];
    list.push(it.id);
    itemsByCategory.set(it.category, list);
  }
  for (const sp of pack.specials) {
    if (sp.type === 'displayCase') {
      const v = sp.fixedValue ?? CONFIG.displayCaseValue;
      cards.set(sp.id, { id: sp.id, kind: 'displayCase', est: v, actual: v });
      displayCases.push(sp.id);
    } else {
      cards.set(sp.id, { id: sp.id, kind: 'gift', est: 0, actual: 0 });
      gifts.push(sp.id);
    }
  }
  return {
    cards,
    categories: pack.categories.map((c) => c.id).filter((c) => itemsByCategory.has(c)),
    itemsByCategory,
    displayCases,
    gifts,
  };
}

export function isScorable(idx: PackIndex, id: string): boolean {
  const k = idx.cards.get(id)?.kind;
  return k === 'item' || k === 'displayCase';
}
