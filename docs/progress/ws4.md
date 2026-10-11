# WS4 progress (Frontend shell)

## Branch / base
`ws4-web-shell`, stacked on `origin/ws0-contracts` (WS0 not merged yet). PR base: `ws0-contracts`.

## Done
- Slice 1: net client in `apps/web/lib/net` (RoomClient, useRoom/RoomProvider, clock, rev gate, backoff, wake lock, config), `apps/web/lib/identity`, unit tests (14, all green).

## In progress
- Nothing.

## Next
- Slice 2: design tokens (`apps/web/styles/tokens.css`), root layout (fonts via next/font, viewport), shell components, landing `/`, `app/r/[code]/layout.tsx` (RoomProvider) and `page.tsx` (join form / lobby / game slot).
- Slice 3: lobby components in `apps/web/components/lobby`.
- Slice 4: polish, manual run against `pnpm mock`, Playwright smoke (SHOULD), draft PR.

## Gotchas / decisions
- No `partysocket`: own small reconnect in RoomClient (500ms doubling to 5s, jitter), no new deps.
- Seq is seeded from `Date.now()` so a page refresh never reuses seqs (server dedups on highest seq).
- Failing to open the socket 3 times before ever connecting is reported as fatal `notfound` (a WS 404 is indistinguishable from an unreachable server in browsers).
- Transport keepalive string `"ping"` is NOT sent (mock server answers it with BAD_MESSAGE); app-level `{t:'ping'}` every 15s is used. Real server's auto-response is for WS3b/WS7 to reconcile.
- Close code 4000 is treated as "kicked" (mock closes that way) in addition to the `kicked` message.
