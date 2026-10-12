# WS3a progress (Room-core)

## Branch / base

`ws3a-room-core`, from `origin/main` (f96e6c1). Draft PR open against `main`.

## Done

- Slice 1: state shape (additive optional fields), `reduce` (join/hello/leave/disconnect/snap/seed/tick, all 05 section 6.1 actions), `view` (all of 05 section 6.3), `util` (secretsMatch, rateLimit), lobby tests.
- Slice 2: game tests (bids, TOO_LATE, auto-pass, reconnect, Frenzy anti-snipe + cooldown, bots, reveal -> ended, rematch, expiry, host migration); fixed a hostCheck busy-loop.
- Slice 3: redaction leak test (every phase incl. gifts, every player + non-member, mutation test), replay golden, rate-limit tests, fast-check (cold and mid-game sequences).

## In progress

Nothing. Waiting on review.

## Next

Pre-PR review (one reviewer, diff only), then merge. WS3b wires the wrapper (see "For WS3b").

## Gotchas / decisions

- Rejections return the SAME state object and only error effects (no rev bump, lastSeq not advanced).
- Effects order: persist, setAlarm, log, closeSocket/deleteRoom, then sends (ack/welcome first, snapshots last). Snapshots are explicit `send` effects (to a playerId, or `{conn}` for the socket that just joined/hello'd); `broadcastSnapshots` is never emitted.
- Connection-level failures (join/hello) are `send {conn} err{code}`; action failures are `send playerId ack{ok:false}`.
- Contract additions (all optional/additive): `RoomOpts.length`, `meta.{seed,baseExpireAt,allDownAt,revealAt,updatedAt,logN,closed}`, `RoomPlayer.disconnectedAt`, `Effect.closeSocket.exceptConn`, `view(state, pid, now?)`, new exports `roomNotFound`, `isCompatible`, `rateLimit`, `newRateState`, `secretsMatch`.
- `seed` event must be sent before every `start` (including after `rematch`; rematch drops any pending seed). `start` without a seed acks `INTERNAL`.
- Seats are compacted to 0..n-1 at `start` so color index == engine seat.
- `reveal.tiebreak` exposes remaining-hand totals after the game; hand-scramble mutation is therefore skipped in reveal/ended in the leak test.
- Expiry: lobby 1h from creation, game 2h from start, post-game 30min from entering `reveal`, rematch resets to 1h, all humans disconnected -> `min(base, +10min)`; reconnect recomputes. On expiry: `closing{expired}` to all, `closeSocket expired`, `deleteRoom`, `meta.closed = true`; later `join`/`hello` get `err ROOM_NOT_FOUND`.
- Bots: deadline kind `bot`, delay 800-2000ms from a hash of (code, rev, botId, t); Frenzy bots poll with the same delay while bidding.
- Disconnect during a Classic window passes immediately; the engine auto-skips disconnected players on later calls and gift steps.
- Kick: ban playerId + secretHash; in-game kick keeps the seat (disconnected, auto-passed).

## For WS3b

- Call `roomNotFound(conn)` when a `hello`/`join` hits a room with no stored state; close code 4000 for `closeSocket why:'kicked'` (ws4 note).
- Wrapper owns: crypto (secret + SHA-256), `seed`, per-connection `RateState` (`rateLimit`), size/zod parse (`parseClientFrame`), binding conn -> playerId on `welcome`, honoring `exceptConn`, `setAlarm` from the effect, `ping/pong`.
- `view(state, pid, now)` can take the live clock; the snapshots emitted by the reducer use the event `now`.
- Default mode follows player count (Classic 3-4, Frenzy 5-6) until the host sets one via setOpts (`meta.modeSet`); fixed at start.
- Decision: `reveal.tiebreak` (remaining-hand totals) is public after the game.
- Decision: in-game kick bans the player and keeps the seat (disconnected, auto-passed).
