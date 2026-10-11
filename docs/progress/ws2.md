# WS2 (Content) progress

## Branch / base
- Branch `ws2-content`, stacked on `origin/ws0-contracts` (WS0 not merged yet).
- Draft PR targets `ws0-contracts`.

## Done
- (slice 0) Setup: branch created, `pnpm install` ok.
- (slice 1) `packages/content/src/items/toys.ts` and `media.ts`: 20 items authored from 03 section 3.1 and 3.2. Generated once by a scratch script that parses the 03 tables (not committed); values copied verbatim.

## In progress
- Slice 2: glass, collectibles, antiques, misc items (same generator approach).

## Next
1. Generate `src/items/{glass,collectibles,antiques,misc}.ts` from 03 section 3.3-3.6 (the scratch generator parses `| \`id\` |` rows of section 3 and writes one file per category; if the scratch file is gone, hand-copy the rows exactly).
2. Add `src/items/index.ts` or `src/base-pack.ts`: `BASE_ITEMS` (60, category order toys, media, glass, collectibles, antiques, misc) and the 9 specials (`special-display-case-1..5`, `special-gift-1..4`, per 03 section 4).
3. Switch `src/index.ts` `activePack` to the base pack. KEEP `src/fixture.ts` (exported; protocol test uses literal ids; engine stub imports `activePack`).
4. Write `src/public.ts` as a hand-written public projection with NO `actualValue` / `tier` (generate once from base pack, then the test enforces `publicPack` equals `toPublicPack(activePack)`). Public module must not import `./index`, `./fixture` or the `items/` files (test checks this). Keep `getPublicCard` export (mock-server uses it).
5. Tests in `packages/content/test/`: zod validation of all base data (MUST), counts (60 items, 10 per category, 5 displayCase + 4 gift, unique ids), tier counts 9/33/15/3, per-category actual sums (8575 total; per cat 1420/1435/1435/1415/1425/1445), tier ratio bounds, flavor <=12 words, name length 2-40, brand denylist, public no-leak (no `actualValue`/`tier` key anywhere, including the JSON), web-bundle-facing public file has no `actualValue` text.
6. Run `pnpm -r typecheck`, `pnpm -r lint`, `pnpm --filter @dbay/content test` after each slice.

## Gotchas / decisions
- Schema (`src/schema.ts`) is the WS0 contract: NOT changed. Items have no icon field; `sprite` is optional in the schema and left absent (category fallback sprite per 03 "Sprites"). Art keys are therefore not authored in WS2.
- Schema allows est 25-400; base pack uses 30-300.
- Prettier config: single quotes, printWidth 100 (root `.prettierrc.json`).
- Mock server (`tools/mock-server`) uses `getPublicCard` and `publicPack`; engine stub uses `activePack`. Both keep working with the base pack.

## Open questions
- None yet. (03 section 2.3 says base pack tiers are ASSUMED and to be tuned by the simulator; values here are the authored ones from 03.)
