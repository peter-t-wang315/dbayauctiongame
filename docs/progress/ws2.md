# WS2 (Content) progress

## Branch / base
- Branch `ws2-content`, stacked on `origin/ws0-contracts` (WS0 not merged yet; origin/ws0-contracts = be8d24d at start).
- Draft PR targets `ws0-contracts`.

## Done
- Setup: branch created, `pnpm install` ok.
- Slice 1 (`2246d89`): `src/items/toys.ts`, `src/items/media.ts` (20 items, 03 section 3.1-3.2).
- Slice 2: `src/items/{glass,collectibles,antiques,misc}.ts` (40 items, 03 section 3.3-3.6). All 60 items authored verbatim from the 03 tables.
- Slice 3: `src/specials.ts` (5 Display Case + 4 Gift, 03 section 4), `src/base-pack.ts` (`basePack`, packId `base`, version 1, 60 items + 9 specials), `activePack` in `src/index.ts` now = `basePack`; `basePack` and `BASE_PACK_ID` exported from index.
- Slice 4: public projection `src/public.ts` + `src/public-items.ts` (60 public items: id, name, category, estimatedValue, flavor; NO actualValue/tier), specials shared from `src/specials.ts`. `getPublicCard` kept (mock-server uses it).
- Slice 5 tests: `test/base-pack.test.ts` (zod validation of every item/special and the whole pack, counts 60/10 per category, 5+4 specials, 69 total, unique ids, 03 sums per category and total 6,920/8,575, tier counts 9/33/15/3 overall and per category, tier ratio bounds, est multiple of 5 and 30-300, flavor <=12 words, names 2-40, brand denylist, no duplicate names). `test/public.test.ts` (no-leak: no `actualValue`/`actual`/`tier` key, JSON check, public equals full minus secrets, source text check, no import of full data). Existing `test/content.test.ts` (WS0) kept.
- Status: `pnpm -r typecheck` green; `pnpm -r lint` green; `pnpm -r test` green (content: 34 tests).

## In progress
- Draft PR open: https://github.com/peter-t-wang315/dbayauctiongame/pull/2 (base ws0-contracts).

## Next
1. Pre-PR review (pending): needs a fresh reviewer subagent before un-drafting; not done in this run.
2. Decide on art (open question below).

## Gotchas / decisions
- Schema (`src/schema.ts`, WS0 contract) NOT changed.
- Items have no icon/art key field in the schema. `sprite` is optional and left absent, so the category fallback applies (03 "Sprites"). No art keys authored in WS2.
- `src/fixture.ts` kept (exported, unused by activePack now). Protocol test uses literal ids and does not import it.
- Item data files were generated once from the 03 markdown tables by a scratch script (not committed). Values were not hand-typed twice; the tests check per-category sums and tier counts against 03 sections 2.4 and 3.7.
- `src/public-items.ts` was generated the same way from the 03 tables, without the secret columns. `public.test.ts` checks it equals `toPublicPack(activePack)`, so a drift fails CI.
- Public modules (`public.ts`, `public-items.ts`, `specials.ts`, `categories.ts`) must not contain the words actualValue/tier/actual in code; a test enforces this.
- Prettier config: single quotes, printWidth 100.
- Mock server uses `publicPack` and `getPublicCard`; engine stub uses `activePack` (now 69 cards). Both tests pass.
- No separate "validator script" was added; the content test suite is the validator (`pnpm --filter @dbay/content test`).

## Open questions
- 03 section 2.3 marks the values as ASSUMED and to be tuned by the simulator. Values here are the authored ones from 03 unchanged.
- Art: no per-item sprites yet (03 "Sprites" authoring order: category fallbacks first). Is this in WS2 scope or a later art task?
- `special-gift` and `special-display-case` have no per-special sprite; the same applies.
