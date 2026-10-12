# WS5 progress (Game UI)

## Branch / base
`ws5-game-ui`, based on `origin/main` (WS0, WS1, WS2, WS4 merged).

## Done
- Slice 1: pure UI logic in `apps/web/lib/game-ui` (timers, bid legality hints, selection state machine + keyboard mapping, PlayerView -> view-model mapping, status-strip text per 04 4.5, progress, collections). 27 unit tests.

- Slice 2: `components/game` (SpriteView SVG renderer, Bay row/tile, Hand 6x2, StatusStrip + progress bar, TurnBanner, CollectionStrip + sheet, MenuPanel tabs, GiftOverlay stand-in, RevealSlot placeholder, GameScreen, game.css); `app/r/[code]/page.tsx` now renders GameScreen (GameSlot.tsx left in place, unused). Playwright `e2e/game.pw.ts` (Classic 3 bays + Frenzy 4 bays at 390x844: no scroll, all targets >= 44, two-tap bid) passes; `e2e/smoke.pw.ts` assertion updated (was "Game in progress").

## In progress
- Slice 3: desktop check, gift/reveal manual run vs mock, spriteRuns unit test, polish.

## Next
1. Screenshot desktop (1280 wide) and tablet; fix layout.
2. Run the mock through gift -> reveal -> rematch in the browser; fix issues.
3. Open draft PR.

## Gotchas / decisions
- 06 says WS6 owns `components/gift` (GiftStep); the kickoff asked WS5 to build gift UI. Until WS6 lands, WS5 ships `components/game/GiftOverlay.tsx`; the seam is the single import in GameScreen.
- Hand shows 12 fixed slots (`v10..v300`, `p1`, `p2`); a slot missing from `myHand` is rendered as spent.
