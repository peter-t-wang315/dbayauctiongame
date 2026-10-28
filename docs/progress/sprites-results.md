# Special sprites + ranked results

## Branch / base
`content/special-sprites-and-results`, off `origin/main`.

## Done
- Slice 1: Gift + Display Case sprites. Cause of the blank boxes: specials had no sprite data and `cardInfo()` in `lib/game-ui/viewModel.ts` hard-coded `sprite: null` for them. Sprites are in `packages/content/src/sprites/specials.ts`, attached to every special (`sprite` on SpecialDef), and `cardInfo` reads `c.sprite`. Tests in `packages/content/test/sprites.test.ts`.
- Slice 2: results ordered by standing (`rankedRows`), winner card with crown/gold highlight, Standings moved above the per-player breakdown, gold STEAL pill, 40px sprites with a two-line card layout. Unit tests in `lib/reveal/results.test.ts`; reveal e2e passes.

## In progress
Nothing.

## Next
Draft PR review by the main session.

## Gotchas / decisions
- The one-line `viewModel.ts` fix is outside the owned paths but is the actual root cause.
- While flipping, order stays "me first"; it switches to rank order once done.
- Screenshots taken right after Skip catch the pop-in animation mid-way (faded pills); wait ~1s.
