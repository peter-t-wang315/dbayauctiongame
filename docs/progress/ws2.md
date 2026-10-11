# WS2 (Content) progress

## Branch / base
- Remote branch `ws2-content` (PR #2, base `main`; WS0 / PR #1 already merged). Art work continues in a local worktree branch `ws2-art` that tracks `origin/ws2-content` (push with `git push origin HEAD:ws2-content`), because `ws2-content` is checked out in another worktree.

## Done
- Slices 1-5 (earlier): 60 items, 9 specials, `basePack`, public projection, tests (see git log). Values verbatim from 03.
- Art slice A: item swaps (user request, trademark-free names, same tier/est/actual as the replaced item so all 03 sums and tier counts are unchanged):
  - `collectibles-rookie-card` -> `collectibles-holo-monster-card` "Holo Pocket-Critter Card, 1st Edition" (collectibles, est 200, actual 320, good).
  - `misc-unicycle` -> `misc-e-bike` "Electric Bicycle, Battery Included" (misc, est 250, actual 265, fair).
  - 03 tables, items files, public-items and brand denylist (added pikachu, charizard, schwinn; pokemon was already there) updated.

- Art slice B: `src/sprites/{util,categories,index}.ts`: `sprite()` helper, `SHARED_PALETTE` (k, w), `CATEGORY_SPRITES` (6), exported from both entries; `test/sprites.test.ts` covers fallbacks (and has the `checkSprite` helper to reuse for items).

- Art slice C: sprites for toys (10) and media (10) in `src/sprites/{toys,media}.ts`; `ITEM_SPRITES` + `withSprite()` in `src/sprites/index.ts`, applied in `base-pack.ts` and `public.ts` (so full and public items both carry `sprite`). Preview script `packages/content/scripts/sprites-preview.ts` (`pnpm --filter @dbay/content sprites:preview`, writes gitignored `packages/content/.preview/sprites.html`); added `tsx` devDependency to content.

## In progress
- Nothing.

## Next
1. (done: slice B)
2. Slices D-E: sprites for glass+collectibles, then antiques+misc in `src/sprites/<cat>.ts`; add each to `ITEM_SPRITES` in `src/sprites/index.ts` (toys, media done).
3. Slice F: add "all 60 items have a sprite" test, add sprite files to the no-secret-words check in `test/public.test.ts`, 03 sprites notes, eyeball the preview.
4. Update PR #2 body (art box, swaps, preview command), keep draft, "Pre-PR review: pending".

## Gotchas / decisions
- Schema (`src/schema.ts`, WS0 contract) NOT changed.
- Public modules (`public.ts`, `public-items.ts`, `specials.ts`, `categories.ts`, sprites) must not contain the words actualValue/tier/actual in code; a test enforces this.
- Prettier config: single quotes, printWidth 100.
- Specials have no sprite (SpecialDef has no sprite field).
- Tooling quirk: worktree agent sandbox refuses compound shell with `git` and loops using variables; use small plain commands or node scripts.

## Open questions
- 03 section 2.3 values are ASSUMED and to be tuned by the simulator.
