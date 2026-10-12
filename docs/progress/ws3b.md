# WS3b progress

Branch: `ws3b-server` (base origin/main after WS3a merge).

## Done
- apps/server: Worker entry (`POST /api/rooms`, WS upgrade routing, Origin check + CORS, rate limits via `Limiter` DO), `Room` DO wrapper around room-core (frame parse, rate limit, ping/pong, seed + crypto, effects execution, alarms, storage load in `blockConcurrencyWhile`, kick 4000, ROOM_NOT_FOUND), wrangler config (local top level, `preview`, `production` envs), `.dev.vars.example`, README with local run steps.
- 6 DO integration tests (join, reconnect after eviction, bad secret, unknown room / origin / code, oversized frame, kick 4000, alarm after eviction drives bots) all pass.
- Root scripts: `dev`, `dev:server`, `dev:web`.

## In progress
- Manual smoke against the web app; full bot game test; PR.

## Next
1. Smoke: `pnpm dev`, open web, create room, add bots, start; verify snapshots flow.
2. Optional full-game test (frenzy + quick + bots) if fast enough.
3. Draft PR.

## Gotchas / decisions
- Effects are executed as: persist/setAlarm/log in order, then sends, then socket closes, then deleteRoom, so `kicked`/`closing` go out before the socket closes and `welcome` binds conn->player before `replaced` closes.
- A tick with nothing due emits no effects, so `onAlarm` always re-arms from `deadlines[0]` (found by the alarm-after-eviction test).
- Room creation: Worker picks the code and POSTs `/__init` to the DO (reachable only through the stub; public routing needs a WebSocket upgrade). Unknown codes create an empty DO lazily but write nothing.
- Close codes: 4000 kicked, 4001 replaced, 4002 expired, 4003 banned, 4004 not found, 4005 deploy, 4008 rate limited.
- Rate-limit mechanism (05 s17 item 6): small `Limiter` DO (free-plan safe) rather than the rate-limit binding.
- Origin: exact match, plus `https://*.vercel.app`-style suffix wildcard entries (preview env). Missing Origin is rejected.
- App-level `{t:'ping'}` -> `pong`; the native `"ping"`/`"pong"` auto-response is also registered.
- No "30s without traffic -> disconnected" sweep; disconnect is driven by socket close.
- `events` SQL table stores the event log without join/hello/seed (no secrets).
