# Announcer fix + FxController/"Bid sent" tests

## Branch / base
- `fix/announcer-and-fx-tests`, stacked on `feat/sale-moment` (PR #34, unmerged). Rebase onto it if it changes; after it merges, merge `main` in.

## Done
- **A. Announcer:** `useAnnouncer` announced only the last urgent item per snapshot. New pure `combineAnnouncements` (`lib/game-ui/announce.ts`) joins all urgent items of one snapshot into one assertive message in log order ("Sold to you: X. You were outbid on bay B"). Others' sales were never urgent (the sale toast reads them), so nothing is double-announced. Tests in `lib/game-ui/polish.test.ts`.
- **B. Tests:** bump animation description extracted to pure `lib/fx/bump.ts` (`bumpSteps`), used by `FxController`; tests in `lib/fx/fx.test.ts` (mine vs others, reduced motion). "Bid sent" text extracted to `bidSentText` in `lib/game-ui/legal.ts`, used by `GameScreen`; tests in `gameUi.test.ts`. e2e: `fx.pw.ts` asserts the status line shows "Bid sent: ... on X" after a tap-bid.
- README open item (5) updated.

## In progress
- Nothing (draft PR open, base `feat/sale-moment`).

## Next
- Rebase/merge as #34 lands.

## Gotchas / decisions
- vitest runs in the node environment (no jsdom), so DOM/motion behaviour is tested via extracted pure helpers plus Playwright.
- Local e2e used a temp Playwright config on ports 3190/8790 (not committed) because 3100/8787 were busy.
