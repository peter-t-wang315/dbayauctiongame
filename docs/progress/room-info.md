# Progress: room-info endpoint + join screen info

**Branch / base:** `feat/room-info` off `origin/main`.

## Done
- Server: `GET /api/rooms/:code/info` (Worker + DO `/__info`), `RoomInfo` type in protocol, `roomInfo()` in room-core, server test.
- Mock server supports the endpoint + test; 05 §5 documents it.

## In progress
- Web join screen.

## Next
- Web: `fetchRoomInfo` in lib/net/config.ts, pure `describeRoomInfo` view logic + unit tests, JoinForm info line, e2e (bad code, good code), docs README item (4) and 04 §3.2.

## Gotchas / decisions
- Path is `/api/rooms/:code/info` (matches existing `/api/rooms` prefix).
