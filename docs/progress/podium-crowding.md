# Desktop podium crowding at 6 players (1280px)

## Branch / base
`fix/podium-crowding`, off `origin/main`. Draft PR to `main`.

## Done
- Won-item row is now a single, fixed-height (34px), non-wrapping row. `podiumSlots(playerCount)` in `lib/game-ui/podiums.ts` gives the slot count (6 for 2-4 players, 4 for 5, 3 for 6); `podiumSplit` reserves the last slot for a `+n` chip when more items are won. No wrapping, clipping or height change as items are won.
- A11y: sprites and chip are `aria-hidden`; an `sr-only` line lists the count and every item name.
- Unit tests for the slot function and split. e2e: "Desktop 6 players at 1280x800 and 1440x900" in `e2e/game.pw.ts` (no podium/won-row overflow, equal podium heights, no page scroll).
- Screenshots (with 5 preset items per player via a temporary, uncommitted mock hack): `docs/mockups/desktop/podiums-6p-before-*.png` (two rows, 158px tall) and `podiums-6p-after-*.png` (one row + `+3`, 137px).
- Phone/tablet DOM unchanged (Podiums mounts only at >=1024px).

## In progress
Nothing.

## Next
Review and merge.

## Gotchas / decisions
- Chose fixed single row + `+n` over compact podiums: simplest and keeps the 24px (2x) integer sprite scale.
- CSS edits are limited to `.g-pod__won` and new `.g-pod__row` / `.g-pod__more` in the desktop block (PR #33 also touches game.css).
- The e2e test cannot win items via the mock; the overflow guarantee for many items is by construction (nowrap + slot cap), shown in the screenshots.
