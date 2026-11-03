# Progress: room-info endpoint + join screen info

**Branch / base:** `feat/room-info` off `origin/main`.

## Done
- Server: `GET /api/rooms/:code/info` (Worker + DO `/__info`), `RoomInfo` type in protocol, `roomInfo()` in room-core, server test.
- Mock server supports the endpoint + test; 05 section 5 documents it.
- Web: `lib/net/roomInfo.ts` (fetch + `describeRoomInfo`) with unit tests; JoinForm shows one info line, or a message card for unknown / started / full rooms; fetch failure falls back to the old form.
- e2e `apps/web/e2e/roominfo.pw.ts` (bad code, good code, fetch failure).
- Docs: README item (4), 04 section 3.2.

## In progress
- Pre-PR review.

## Next
- Merge once CI is green and review passes.

## Gotchas / decisions
- Path is `/api/rooms/:code/info` (matches existing `/api/rooms` prefix).
- `players` counts bots (they take seats and count toward ROOM_FULL).
- e2e was run on temp ports 3200/8887 because 3100/8787 were in use (temp config not committed).
