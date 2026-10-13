# HUD polish (WS5 follow-up)

**Branch / base:** `ws5-hud-polish` off `origin/main` (the name `ws5-game-ui/hud-polish` is blocked by the existing `ws5-game-ui` branch).

## Done
- Task 1: winning bay is no longer faded. Thick border in your colour, tint, top stripe, green "You're winning" pill with a check, bigger price. Faded stays only for illegal/empty bays.
- Task 2: `StatusStrip` is now the single merged HUD (turn title, event text, clock, Pass, progress, menu). `TurnBanner` deleted. The polite live region is a separate sr-only `status` element (`data-fx="status-text"`); the visible copy is aria-hidden. Tap on title/text still opens the log.
- Task 3: Classic clock is a 30px display number on a white chip; danger (coral chip + tick pulse) only in the last 3s, no animation under reduced motion. Frenzy drops the global number (thin soonest-bay bar remains); per-bay clocks are 20px.
- Task 4: `lib/fx/fly.ts` ghost card flies hand to bay (skipped under reduced motion); FxController pops and rings the bay on a bump; status shows "Bid sent: $125 on A" after the ack.
- Task 5: hand cards 58px (62px with 4 bays; 52px on very short phones), 24px numerals.
- Task 6: docked sidebar tabs wrap/flex instead of clipping.

## In progress
- Nothing. e2e game, fx, polish, a11y passed locally (19 passed, 1 skipped gift) on alternate ports 3400/8797 via a temporary config copy (not committed).

## Next
- Main session: pre-PR review; before/after screenshots. (docs/04 4.1/4.2/4.5/4.6 and the winning-bay text are updated.)

## Gotchas / decisions
- Docs 04 section 4.5/4.6 list a 44px strip plus 52px banner; the merged bar is ~94px (two 44px rows collapsed into one text button + right cluster). Update docs/04 if the layout is accepted.
- Playwright playing on a reused :3100 server would test another worktree's code; confirm the port is free first.
