# Announcer fix + FxController/"Bid sent" tests

## Branch / base
- `fix/announcer-and-fx-tests`, stacked on `feat/sale-moment` (PR #34, unmerged). Rebase onto it if it changes; after it merges, merge `main` in.

## Done
- **A. Announcer:** `useAnnouncer` announced only the last urgent item per snapshot. New pure `combineAnnouncements` (`lib/game-ui/announce.ts`) joins all urgent items of one snapshot into one assertive message in log order ("Sold to you: X. You were outbid on bay B"). Others' sales were never urgent (the sale toast reads them), so nothing is double-announced. Tests in `lib/game-ui/polish.test.ts`.

## In progress
- B. Tests for the FxController bump and the "Bid sent" flash.

## Next
- Extract pure helpers, add unit tests, add an e2e assertion; run all checks; update docs/README.md open item (5); open draft PR with base `feat/sale-moment`.

## Gotchas / decisions
- vitest runs in the node environment (no jsdom), so DOM/motion behaviour is tested via extracted pure helpers plus Playwright.
