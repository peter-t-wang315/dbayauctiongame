# WS3a progress (Room-core)

## Branch / base
`ws3a-room-core`, from `origin/main` (f96e6c1).

## Done
- Slice 2: game tests (bids, TOO_LATE, auto-pass, reconnect, frenzy, bots, reveal, rematch, expiry, host migration); fixed hostCheck busy-loop.
- Slice 1: state shape (additive optional fields), reduce (lobby, join/hello/leave/kick/ban, setOpts incl. length, bots, start via engine, rematch, tick/deadline queue, expiry, host migration, bot driving, reveal->ended, auto-pass on disconnect, seq idempotency), view (all 05 6.3 fields), util (secretsMatch, rateLimit), lobby tests.

## In progress
Slice 3: redaction leak test + replay + fast-check.

## Next
1. test/game.test.ts, test/redaction.test.ts (leak test all phases x players), test/replay.test.ts (golden + fast-check).
2. Fix any reducer bugs found; PR (draft) per task text.

## Gotchas / decisions
- Rejections return the SAME state object and only error effects (no rev bump).
- Effects order: persist, setAlarm, log, closeSocket..., then sends (acks/welcome first, snaps last). Snapshots are explicit `send` effects (to playerId, or `{conn}` for the joining socket); `broadcastSnapshots` is unused.
- `view(state, pid, now?)`: optional third param; defaults to `meta.updatedAt`.
