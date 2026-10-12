# WS3b progress

Branch: `ws3b-server` (base origin/main after WS3a merge).

## Done
- apps/server: Worker entry (`POST /api/rooms`, WS upgrade routing, Origin check + CORS, rate limits via `Limiter` DO), `Room` DO wrapper around room-core (frame parse, rate limit, ping/pong, seed + crypto, effects execution, alarms, storage load in `blockConcurrencyWhile`, kick 4000, ROOM_NOT_FOUND), wrangler config (local top level, `preview`, `production` envs), `.dev.vars.example`, README with local run steps.
- 8 DO integration tests incl. bid and double-join (join, reconnect after eviction, bad secret, unknown room / origin / code, oversized frame, kick 4000, alarm after eviction drives bots) all pass.
- Root scripts: `dev`, `dev:server`, `dev:web`.

## Verified manually
- `node apps/server/scripts/smoke.mjs localhost:8787 frenzy`: full bot game (1 passive human + 2 bots, quick) reached reveal in ~230s on the local wrangler dev server.
- Playwright (temporary spec, not committed) drove the real web app against `wrangler dev`: create -> join -> add 2 bots -> refresh restores seat -> start; unknown room shows "No such room".

## In progress
- Pre-PR review pending.

## Next
1. Address review feedback; WS7 deploys (not done here).

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
