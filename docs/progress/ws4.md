# WS4 progress (Frontend shell)

## Branch / base
`ws4-web-shell`, stacked on `origin/ws0-contracts` (WS0 not merged yet). PR base: `ws0-contracts`.

## Done
- Slice 1: net client in `apps/web/lib/net` (RoomClient, useRoom/RoomProvider, clock, rev gate, backoff, wake lock, config), `apps/web/lib/identity`, unit tests (14, green).
- Slice 2: tokens (`styles/tokens.css`), `app/globals.css`, root layout (next/font Lilita One + Nunito, light default), landing `/`, `app/r/[code]/layout.tsx` (RoomShell/RoomProvider + reconnect overlay + fatal cards) and `page.tsx` (join form -> lobby -> GameSlot), shell components (Wordmark, PlayerChip, BottomSheet, MessageCard, ReconnectOverlay, MoreSheet, JoinForm, GameSlot, audioUnlock hook), lobby (Lobby, PlayerGrid with rename/kick/remove bot, mode/bid window/relaxed, add bot, start). typecheck, lint, build all clean.

## In progress
- Nothing.

## Next
- Slice 3: run against `pnpm mock` (+ `pnpm --filter @dbay/web dev`) in a real browser at 390px: create -> join from second context -> start; refresh restores seat; kill/restart mock reconnects. Fix whatever breaks. Then Playwright smoke (SHOULD) if time allows, then open the draft PR (see below).
- Draft PR: `gh pr create --draft --base ws0-contracts --head ws4-web-shell --title "WS4: frontend shell, net client and lobby"` with the 06 WS4 acceptance checkboxes, tests run, open questions, "Pre-PR review: pending".

## Gotchas / decisions
- No `partysocket`: own small reconnect in RoomClient (500ms doubling to 5s, jitter), no new deps.
- Seq is seeded from `Date.now()` so a page refresh never reuses seqs (server dedups on highest seq).
- Failing to open the socket 3 times before ever connecting is reported as fatal `notfound` (a WS 404 is indistinguishable from an unreachable server in browsers).
- Transport keepalive string `"ping"` is NOT sent (mock server answers it with BAD_MESSAGE); app-level `{t:'ping'}` every 15s is used. Real server's auto-response is for WS3b/WS7 to reconcile.
- Close code 4000 is treated as "kicked" (mock closes that way) in addition to the `kicked` message.
- No `@/` path alias in tsconfig (not owned); imports are relative.
- WS5 hook-in: `components/shell/GameSlot.tsx` is the placeholder rendered by `app/r/[code]/page.tsx` when phase != lobby. WS5 can render `<GameScreen/>` as its child/replace it. `useRoom()` is available anywhere under `/r/[code]/**` (provider is in the layout), so `app/r/[code]/game/**` can use it directly.
- WS8 hook-in: `registerAudioUnlock(fn)` in `components/shell/audioUnlock.ts`; called on the Join click.
- Theme: light default, dark only via saved choice (`dbay:theme`) per 04 section 13.
- Open question: mode default "follows player count" (04 3.3) is not set client-side; the client shows whatever `opts.mode` the server sends.
- Open question: no `GET` room-exists endpoint, so the join page cannot show "Room not found" instantly (only after 3 failed connects).
