# WS5 progress (Game UI)

## Branch / base
`ws5-game-ui`, based on `origin/main` (WS0, WS1, WS2, WS4 merged). Draft PR open.

## Done
- Slice 1: pure UI logic in `apps/web/lib/game-ui` (timers, bid legality hints, selection state machine + keyboard mapping, PlayerView -> view-model mapping, status-strip text per 04 4.5, progress, collections). 27 unit tests.
- Slice 2: `components/game` (SpriteView SVG renderer, Bay row/tile, Hand 6x2, StatusStrip + progress bar, TurnBanner, CollectionStrip + sheet, MenuPanel tabs, GiftOverlay stand-in, RevealSlot placeholder, GameScreen, game.css); `app/r/[code]/page.tsx` renders GameScreen (GameSlot.tsx left in place, now unused).
- Slice 3: desktop layout (docked sidebar, single rows, keyboard shortcuts + badges), render tests (GiftOverlay roles, Hand, sprite runs) with `apps/web/vitest.config.ts` (JSX transform for tests only), Playwright `e2e/game.pw.ts`: Classic 3 bays, Frenzy 4 bays, Classic 4 bays, Frenzy 3 bays at 390x844 and 360x640 (no scroll, all targets >= 44), two-tap bid, desktop keyboard bid. `e2e/smoke.pw.ts` assertion updated (was "Game in progress").

## In progress
- Nothing.

## Next
- Pre-PR review (caller), address findings.
- Not yet done / follow-ups: long-press item details sheet (item name/flavor is in the bay `title` tooltip only); GiftOverlay never exercised against a live mock gift (the mock rarely deals a Gift; covered by render tests only); sound/haptics (WS8 hooks: `data-fx` / `data-state` attributes on bay, hand-card, top-bid, sold-stamp, outbid-pill, winning-pill, timer-bar, status-strip, gift-step); drag-to-bid (Later).

## Gotchas / decisions
- 06 says WS6 owns `components/gift` (GiftStep); the kickoff asked WS5 to build gift UI. Until WS6 lands, WS5 ships `components/game/GiftOverlay.tsx`; the seam is the single `<GiftOverlay/>` mount in GameScreen. Reveal seam: `RevealSlot` (rendered for phase reveal/ended), WS6 replaces its body.
- Layout deviations from 04 budget (still fit with slack): status strip is 48px outer (44px inner tap target + borders), banner 58px (44px Pass button fits).
- Hand shows 12 fixed slots (`v10..v300`, `p1`, `p2`); a slot missing from `myHand` is rendered as spent.
- Progress: bar only (never "Round X of Y"); "Halfway" / "Last round" tags on the bar, and the log events read "Halfway there!" / "Last round! Everything sells." (no round numbers).
- `outbid` log entries: assumed `by` = the outbid player (mock behaviour); only shown to that player, with the new top bid read from the bay.
- Bay timer bar total = longest remaining seen for that item (floor 15s); Frenzy anti-snipe "+3s" shown when `endsAt` grows by > 0.5s.
- Frenzy cooldown: hand locked while `cooldownUntil` is in the future (selection persists). Classic: selection cleared when turn ends.
- Next.js dev "N" badge overlaps the bottom-left hand card in dev only.
- Open questions (PlayerView): no per-bay "window total" so bar fraction is estimated client-side; `collection` event `extra` is assumed to hold the category id; Display Case assignment is not visible before reveal.
