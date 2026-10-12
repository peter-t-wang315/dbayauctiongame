# @dbay/server

Cloudflare Worker + PartyServer Durable Object (`Room`) running `@dbay/room-core`.

## Run locally (Windows, no Cloudflare account needed)

```
pnpm install
pnpm dev            # from the repo root: server on :8787 and web on :3000
```

or in two terminals:

```
pnpm dev:server     # wrangler dev, http://localhost:8787
pnpm dev:web        # next dev, http://localhost:3000 (talks to localhost:8787 by default)
```

Open http://localhost:3000, create a room, add bots in the lobby, start. The web app's game host
defaults to `localhost:8787`; to change it set `NEXT_PUBLIC_GAME_HOST` in `apps/web/.env.local`.

Phones on the same Wi-Fi: set `NEXT_PUBLIC_GAME_HOST=<LAN-IP>:8787` for the web app, copy
`.dev.vars.example` to `.dev.vars` and add `http://<LAN-IP>:3000` to `ALLOWED_ORIGINS`, and allow
Node and workerd through Windows Firewall (private network). Local state lives in `.wrangler/` (git-ignored).

## Behaviour

- `POST /api/rooms` (Origin must be allowed) -> `201 {code}`; 403 bad origin; 429 rate limited.
- WebSocket `/parties/room/<CODE>` (Origin checked). A well-formed but unknown/expired code connects and
  answers `hello`/`join` with `err ROOM_NOT_FOUND`, then closes with code 4004 (no HTTP probe needed).
- Plain `GET /` returns 200 text. Non-WebSocket requests under `/parties/` return 404.
- Close codes: 4000 kicked, 4001 replaced by a newer socket, 4002 expired, 4003 banned, 4004 not found,
  4005 deploy (incompatible stored schema), 4008 rate limited.
- Rate limits: 20 msg/s per connection (3 strikes close), 2KB frames, room creation per IP/hour and
  WebSocket upgrades per IP/minute via a small `Limiter` Durable Object (`CREATE_LIMIT_PER_HOUR`,
  `JOIN_LIMIT_PER_MIN`; local defaults are generous).

## Tests

`pnpm --filter @dbay/server test` runs Durable Object integration tests with
`@cloudflare/vitest-plugin` (Miniflare/workerd, native on Windows).
