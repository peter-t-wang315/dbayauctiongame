// Deterministic synthetic base-pack-shaped content (6 categories x 10 items, 5 Display Cases,
// 4 Gifts) for engine tests and the simulator, so they do not depend on WS2's real pack.
import { CATEGORIES, type ContentPack, type ItemDef, type SpecialDef } from '@dbay/content';

const ESTIMATES = [40, 60, 120, 80, 100, 150, 50, 200, 90, 70];
const RATIOS: Array<[number, ItemDef['tier']]> = [
  [1, 'fair'],
  [0.4, 'dud'],
  [3, 'jackpot'],
  [1, 'fair'],
  [1.5, 'good'],
  [1, 'fair'],
  [0.5, 'dud'],
  [1.5, 'good'],
  [1, 'fair'],
  [1.1, 'fair'],
];

export function synthPack(): ContentPack {
  const items: ItemDef[] = [];
  for (const cat of CATEGORIES) {
    for (let i = 0; i < 10; i++) {
      const est = ESTIMATES[(i + cat.id.length) % 10] as number;
      const [ratio, tier] = RATIOS[i] as [number, ItemDef['tier']];
      items.push({
        kind: 'item',
        id: `${cat.id}-item-${i + 1}`,
        name: `${cat.name} Thing ${i + 1}`,
        category: cat.id,
        estimatedValue: est,
        actualValue: Math.max(5, Math.round((est * ratio) / 5) * 5),
        tier,
        flavor: 'Synthetic test item.',
      });
    }
  }
  const specials: SpecialDef[] = [];
  for (let i = 1; i <= 5; i++) {
    specials.push({
      kind: 'special',
      id: `special-display-case-${i}`,
      type: 'displayCase',
      name: 'Display Case',
      estimatedDisplay: '$100 · Wild',
      fixedValue: 100,
      flavor: 'Fits anything.',
    });
  }
  for (let i = 1; i <= 4; i++) {
    specials.push({
      kind: 'special',
      id: `special-gift-${i}`,
      type: 'gift',
      name: 'Gift',
      estimatedDisplay: '?',
      flavor: 'Surprise.',
    });
  }
  return { packId: 'synth', version: 1, categories: CATEGORIES, items, specials };
}
