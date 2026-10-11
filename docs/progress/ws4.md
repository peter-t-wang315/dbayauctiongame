# WS4 progress (Frontend shell)

## Branch / base
`ws4-web-shell`, stacked on `origin/ws0-contracts` (WS0 not merged yet). PR base: `ws0-contracts`.

## Done
- Slice 1: net client in `apps/web/lib/net` (RoomClient, useRoom/RoomProvider, clock, rev gate, backoff, wake lock, config), `apps/web/lib/identity`, unit tests (14, green).
- Slice 2: tokens (`styles/tokens.css`), `app/globals.css`, root layout (next/font Lilita One + Nunito, light default), landing `/`, `app/r/[code]/layout.tsx` (RoomShell/RoomProvider + reconnect overlay + fatal cards) and `page.tsx` (join form -> lobby -> GameSlot), shell components (Wordmark, PlayerChip, BottomSheet, MessageCard, ReconnectOverlay, MoreSheet, JoinForm, GameSlot, audioUnlock hook), lobby (Lobby, PlayerGrid with rename/kick/remove bot, mode/bid window/relaxed, add bot, start). typecheck, lint, build all clean.

- Slice 3: Playwright smoke (`pnpm --filter @dbay/web test:e2e`, spawns the mock itself, Next dev on :3100): create -> join from 2nd context -> refresh restores seat -> kill/restart mock shows Reconnecting then recovers / re-offers join; 390px no h-scroll and all tap targets >= 44px. 2/2 pass. Added devDep `@playwright/test` 1.60.0 (needs `pnpm exec playwright install chromium` once).

- Fix: "Reconnecting..." forever after the room vanished (mock restart / room expiry). New fatal `gone` ("This room no longer exists" + Back to home + Create a new room, secret cleared), `unreachable` state ("Can't reach the room" + Try again -> `retry()`), `ROOM_NOT_FOUND` on hello -> `gone` when we had a seat. Constants in `lib/net/client.ts`: `RECONNECT_GIVE_UP_MS=120000`, `RECONNECT_MAX_ATTEMPTS=30`, `ROOM_GONE_STRIKES=2`. Hidden tab pauses instead of giving up; `resume()` (visibility/online) restarts. 7 new unit tests; e2e restart case now asserts the gone card. e2e 2/2 pass.

## In progress
- Nothing. Draft PR opened.

## Next
- Pre-PR subagent review (caller), then address findings. Optional polish: mode default follows player count, instant "room not found" once the server has a room-exists check.

## Gotchas / decisions
- Room-gone detection: browsers cannot see a WS 404 (mock answers unknown rooms with an HTTP 404 upgrade failure, never an `err` frame). So after a failed connect the client probes the game host over HTTP (`fetch(httpBase, {mode:'no-cors'})`); server answers + WS refused twice in a row = room gone; probe fails = server down, counts toward the unreachable cap. Real server's `ROOM_NOT_FOUND`/`ROOM_EXPIRED` err frames are handled directly.
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
- Open question for WS3b: reconnecting to an expired/unknown room should answer `hello` with `err ROOM_NOT_FOUND` (or `closing{expired}`) rather than a failed upgrade, so clients need no HTTP probe. The mock does a 404 upgrade failure and no close code distinguishes it; the real server's behaviour for an unknown code (DO creates rooms lazily) is unspecified. Also: the host must answer a plain GET (any status) for the probe to work, and CORS is not required (no-cors).
