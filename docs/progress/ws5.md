# WS5 progress (Game UI)

## Branch / base
`ws5-game-ui`, based on `origin/main` (WS0, WS1, WS2, WS4 merged).

## Done
- Slice 1: pure UI logic in `apps/web/lib/game-ui` (timers, bid legality hints, selection state machine + keyboard mapping, PlayerView -> view-model mapping, status-strip text per 04 4.5, progress, collections). 27 unit tests.

## In progress
- Slice 2: components (sprite, bay, hand, strip, GameScreen) + game.css.

## Next
1. `components/game`: Sprite, Bay, Hand, StatusStrip, TurnBanner, CollectionStrip + sheet, GameMenu (Players/Collections/Log/Settings), GiftOverlay, RevealSlot placeholder, GameScreen; swap GameSlot for GameScreen in `app/r/[code]/page.tsx`.
2. Playwright smoke (`apps/web/e2e/game.pw.ts`) against the mock; 390px layout measurement.
3. Draft PR.

## Gotchas / decisions
- 06 says WS6 owns `components/gift` (GiftStep); the kickoff asked WS5 to build gift UI. Until WS6 lands, WS5 ships `components/game/GiftOverlay.tsx`; the seam is the single import in GameScreen.
- Hand shows 12 fixed slots (`v10..v300`, `p1`, `p2`); a slot missing from `myHand` is rendered as spent.
