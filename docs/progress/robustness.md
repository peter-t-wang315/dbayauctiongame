# Robustness e2e progress

## Branch / base
`robustness-e2e` off main at c618b33. Tests only under `tools/e2e/tests/`; fixes only in `apps/web/lib/net`, `apps/server`, `packages/room-core`.

## Done
- helpers (`tests/helpers.ts`): quick-length WS rewrite + network switch, lobby/game drivers.
- Scenario 1 (two humans + bot, Classic: consistent state, alternating turns, bid visible to the other): passes.
- Scenario 2 (reload mid-bid-window and mid-gift-step): passes (~6 min, game must reach the Gift).

- Scenario 3 (offline ~10s, overlay, auto-pass while away, resume): passes.
- Scenario 6 (host leaves in lobby, host transfers): passes.
- Scenario 5 (visibilitychange during reveal, Frenzy 1 human + 2 bots): passes (~4 min).
- Scenario 4 (server killed and restarted mid-game; room resumes from persisted DO storage): passes.
- Server fix: stale `connected` flags reconciled on DO cold start (+ unit test).

## In progress
- Final full run, PR.

## Next
- Nothing after the PR.

## Gotchas
- Run locally: `E2E_WEB_PORT=3300 E2E_SERVER_PORT=8789 pnpm --filter @dbay/e2e e2e`.
- Playwright clicks wait forever on `aria-disabled` elements; always pass `timeout`/`force` in loops (a hung click hid the test timeout for 20+ min).
- Humans that only pass never advance a Classic game; humans must bid sometimes for items to sell and the Gift to open.
- Scenario 4 kills the Playwright-started Worker (matched by its `--port`) and runs its own copy; file is named `zz-robustness-restart` to sort last (it kills the Playwright-started Worker, so any test after it fails).
- Scenario 3 simulates the outage with `context.setOffline` plus dropping the routed WebSockets (Playwright's offline mode does not kill an open WS).
- Scenario 5 fakes `visibilityState`/`visibilitychange`; real tab throttling is not simulated.

## Bugs found
| # | Scenario | Bug | Where fix belongs | Status |
|---|---|---|---|---|
| 1 | 4 | After a server process restart, stored `connected: true` flags outlived the sockets (no close event), blocking auto-pass, host migration and the all-disconnected expiry | apps/server/src/room.ts | Fixed (`reconcileConnections` in onStart) + test |
| 2 | 1-3 | Status text for a bot's auto-pass reads "Bot Billy is away: auto-pass" (bots are never "away") | apps/web/lib/game-ui (copy) | Open, not touched (owned by another agent) |
| 3 | 2 | Playing a Classic game with a human that only passes never advances; not a bug, noted for test authors | n/a | n/a |
