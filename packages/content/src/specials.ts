// The 9 special cards (docs/03-content.md section 4). No secrets here, so the public entry may import it.
import type { SpecialDef } from './schema';

export const DISPLAY_CASE_COUNT = 5;
export const GIFT_COUNT = 4;

export const SPECIALS: SpecialDef[] = [
  ...Array.from({ length: DISPLAY_CASE_COUNT }, (_, i) => ({
    kind: 'special' as const,
    id: `special-display-case-${i + 1}`,
    type: 'displayCase' as const,
    name: 'Display Case',
    estimatedDisplay: '$100 · Wild',
    fixedValue: 100,
    flavor: 'Fits anything. Judges nothing.',
  })),
  ...Array.from({ length: GIFT_COUNT }, (_, i) => ({
    kind: 'special' as const,
    id: `special-gift-${i + 1}`,
    type: 'gift' as const,
    name: 'Gift',
    estimatedDisplay: '?',
    flavor: "Surprise! Someone else's stuff is now your stuff.",
  })),
];
