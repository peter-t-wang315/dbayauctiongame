// Content data shapes and per-record validation (docs/03-content.md section 5).
// Pack-level rules for the base pack (60 items, tier counts, per-category balance) belong to WS2.
import { CategoryIdSchema } from '@dbay/protocol';
import { z } from 'zod';

export const TIER_RANGES = {
  dud: [0.25, 0.6],
  fair: [0.8, 1.25],
  good: [1.3, 2.0],
  jackpot: [2.5, 4.0],
} as const;
export const TierSchema = z.enum(['dud', 'fair', 'good', 'jackpot']);
export type Tier = z.infer<typeof TierSchema>;

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const Money = z
  .number()
  .int()
  .positive()
  .refine((n) => n % 5 === 0, 'must be a multiple of 5');
const Flavor = z
  .string()
  .min(1)
  .refine((s) => s.trim().split(/\s+/).length <= 12, 'at most 12 words');

/** 12x12 pixel sprite (03 "Sprites"): 12 rows of 12 palette keys, `.` = transparent. */
export const SpriteSchema = z.object({
  rows: z.array(z.string().length(12)).length(12),
  palette: z.record(z.string().length(1), z.string()).optional(),
});
export type Sprite = z.infer<typeof SpriteSchema>;

export const CategoryDefSchema = z.object({
  id: CategoryIdSchema,
  name: z.string().min(1),
  emoji: z.string().min(1),
  accentHint: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type CategoryDef = z.infer<typeof CategoryDefSchema>;

export const ItemDefSchema = z
  .object({
    kind: z.literal('item'),
    id: z.string().regex(ID_RE),
    name: z.string().min(2).max(40),
    category: CategoryIdSchema,
    estimatedValue: Money.refine((n) => n >= 25 && n <= 400, 'estimate must be 25-400'),
    /** SECRET until reveal. Never in @dbay/content/public. */
    actualValue: Money,
    /** SECRET until reveal. Never in @dbay/content/public. */
    tier: TierSchema,
    flavor: Flavor,
    sprite: SpriteSchema.optional(),
  })
  .refine((i) => i.id.startsWith(`${i.category}-`), {
    message: 'item id must start with its category',
  })
  .refine(
    (i) => {
      const [lo, hi] = TIER_RANGES[i.tier];
      const tol = 2.5 / i.estimatedValue;
      const ratio = i.actualValue / i.estimatedValue;
      return ratio >= lo - tol && ratio <= hi + tol;
    },
    { message: 'tier does not match actual/estimated ratio' },
  );
export type ItemDef = z.infer<typeof ItemDefSchema>;

export const SpecialDefSchema = z
  .object({
    kind: z.literal('special'),
    id: z.string().regex(/^special-(display-case|gift)-\d+$/),
    type: z.enum(['displayCase', 'gift']),
    name: z.string().min(1),
    estimatedDisplay: z.string(),
    fixedValue: z.number().int().positive().optional(),
    flavor: Flavor,
    sprite: SpriteSchema.optional(),
  })
  .refine(
    (s) =>
      s.type === 'displayCase'
        ? s.estimatedDisplay === '$100 · Wild' && s.fixedValue === 100
        : s.estimatedDisplay === '?' && s.fixedValue === undefined,
    { message: 'special display/fixedValue mismatch' },
  );
export type SpecialDef = z.infer<typeof SpecialDefSchema>;

export const ContentPackSchema = z
  .object({
    packId: z.string().min(1),
    version: z.number().int().min(1),
    categories: z.array(CategoryDefSchema),
    items: z.array(ItemDefSchema),
    specials: z.array(SpecialDefSchema),
  })
  .refine(
    (p) => {
      const ids = [...p.items.map((i) => i.id), ...p.specials.map((s) => s.id)];
      return new Set(ids).size === ids.length;
    },
    { message: 'ids must be unique across items and specials' },
  );
export type ContentPack = z.infer<typeof ContentPackSchema>;

// ---------- Public projection (safe for the browser) ----------

export type PublicItem = Omit<ItemDef, 'actualValue' | 'tier'>;
export type PublicSpecial = SpecialDef;
export interface PublicPack {
  packId: string;
  version: number;
  categories: CategoryDef[];
  items: PublicItem[];
  specials: PublicSpecial[];
}

/** Strip secret fields. Used by tests to check that the hand-written public data stays in sync. */
export function toPublicPack(pack: ContentPack): PublicPack {
  return {
    packId: pack.packId,
    version: pack.version,
    categories: pack.categories,
    items: pack.items.map(({ actualValue: _a, tier: _t, ...rest }) => rest),
    specials: pack.specials,
  };
}
