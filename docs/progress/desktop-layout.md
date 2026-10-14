# Desktop in-game layout (>=1024px)

## Branch / base
`feat/desktop-layout`, stacked on `feat/turn-flash` (PR #26, which is on top of #25). Draft PR targets `feat/turn-flash`.

## Done
- Hybrid layout per the user's picks: podiums row (turn, cards left, won items as sprites), big bays in one row with 96px art, card rack hand, full-width key legend bar, persistent right rail (Your sets with pips + event log; `L` collapses it, open by default).
- Desktop-only components mount via `useDesktop()` (phone/tablet DOM unchanged): `components/game/Podiums.tsx`, `DesktopRail.tsx`, `KeyLegend.tsx`, `lib/game-ui/podiums.ts` (+ test), `lib/game-ui/useDesktop.ts`.
- CSS: desktop block in `components/game/game.css`. Turn flash (`.g-turnframe`) still works.
- e2e: Desktop 1280x800 test in `e2e/game.pw.ts` rewritten; desktop axe test (light + dark, Classic 3 and Frenzy 4) in `e2e/a11y.pw.ts`.
- Docs: `docs/04-ux-and-ui.md` section 6 rewritten. Screenshots: `docs/mockups/desktop/after-*.png`.

## In progress
Nothing; final checks and PR.

## Next
- Reveal/results desktop layout (out of scope here; waits for PR #23).
- Optional: 6-player podium crowding check at 1280 (sprites wrap to two rows and are clipped, `+n` shows the rest).

## Gotchas / decisions
- Sprites are sized by inline style in `Bay.tsx` for mobile; desktop CSS overrides with `!important` to pin 96px.
- Rail empty set rows use dim text color, not opacity (axe contrast).
- Running Playwright locally while other dev servers are up: copy `e2e/*.pw.ts` to a temp dir with the mock port changed and use a temp config (`next dev -p 3400`, `NEXT_PUBLIC_GAME_HOST=localhost:8797`). Not committed.
