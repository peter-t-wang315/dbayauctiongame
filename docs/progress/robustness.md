# Robustness e2e progress

## Branch / base
`robustness-e2e` off main at c618b33. Tests only under `tools/e2e/tests/`; fixes only in `apps/web/lib/net`, `apps/server`, `packages/room-core`.

## Done
- helpers (`tests/helpers.ts`): quick-length WS rewrite + network switch, lobby/game drivers.
- Scenario 1 (two humans + bot, Classic: consistent state, alternating turns, bid visible to the other): passes.
- Scenario 2 (reload mid-bid-window and mid-gift-step): passes (~6 min, game must reach the Gift).

## In progress
- Scenarios 3 (offline), 6 (host leaves), 5 (background in reveal), 4 (server restart).

## Next
- Run the rest, fix bugs found, open PR.

## Gotchas
- Run locally: `E2E_WEB_PORT=3300 E2E_SERVER_PORT=8789 pnpm --filter @dbay/e2e e2e`.
- Playwright clicks wait forever on `aria-disabled` elements; always pass `timeout`/`force` in loops (a hung click hid the test timeout for 20+ min).
- Humans that only pass never advance a Classic game; humans must bid sometimes for items to sell and the Gift to open.
- Scenario 4 kills the Playwright-started Worker (matched by its `--port`) and runs its own copy; file is named `robustness_restart` to sort last.

## Bugs found
| # | Scenario | Bug | Where fix belongs | Status |
|---|---|---|---|---|
