# dBay

A web remake of the electronic auction board game my brothers and I played as youngins.
Friends join a room with a code, bid on mystery items from their phones, and find out at the end
who got a steal and who got ripped off.

**Status:** WS0 (contracts) in progress. Planning docs and the build plan live in [`docs/`](docs/README.md).
Start there.

## Quick start (Windows, macOS or Linux)

Requires Node 22 (see `.nvmrc`) and pnpm 12 (`npm i -g pnpm@12.11.2`, or `corepack enable`).

```sh
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm mock                       # fake room server on :8787 (demo room DBAYS)
pnpm --filter @dbay/web dev     # Next.js on :3000
```

Copy `.env.example` values into `apps/web/.env.local` (`NEXT_PUBLIC_GAME_HOST=localhost:8787`).

## Layout

| Path                 | What                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `packages/protocol`  | Wire messages (zod + types), PlayerView, error codes                       |
| `packages/content`   | Item data. `@dbay/content/public` is the only entry the web app may import |
| `packages/engine`    | Game rules (WS1). Currently a stub implementing the `Engine` contract      |
| `packages/room-core` | Pure room reducer + redacted `view` (WS3a). Currently a stub               |
| `apps/web`           | Next.js UI (WS4-6, WS8)                                                    |
| `apps/server`        | Cloudflare Worker + Room Durable Object via PartyServer (WS3b)             |
| `tools/mock-server`  | Fake room server for frontend work                                         |
| `tools/lint-check`   | Tests that the import-boundary lint rules fire                             |

Import boundaries and the "no clock / no Math.random in pure packages" rule are enforced by
`eslint.config.mjs` (docs/05-tech-stack.md section 4).

## Pinned versions

Exact versions only (no `^`/`~`). Upgrades are their own PRs.

| Package                   | Version         | Notes                                                                   |
| ------------------------- | --------------- | ----------------------------------------------------------------------- |
| Node                      | 22.15.0         | `.nvmrc`; engines `>=22.13.0`                                           |
| pnpm                      | 12.11.2         | `packageManager`; build scripts allowed only for `esbuild`, `workerd`   |
| typescript                | 6.0.3           | 7.x not yet supported by typescript-eslint (`<6.1.0`)                   |
| zod                       | 4.6.5           |                                                                         |
| eslint                    | 10.12.0         | with `@eslint/js` 10.0.1, `typescript-eslint` 8.71.1, `globals` 17.13.0 |
| prettier                  | 3.9.10          |                                                                         |
| vitest                    | 4.1.11          | `@cloudflare/vitest-plugin` needs `^4.1.0`                              |
| next                      | 16.4.0          |                                                                         |
| react / react-dom         | 19.3.0          | `@types/react(-dom)` 19.3.0                                             |
| partyserver               | 0.5.10          |                                                                         |
| wrangler                  | 4.149.0         |                                                                         |
| @cloudflare/workers-types | 5.20261006.1    |                                                                         |
| ws / @types/ws            | 8.22.0 / 8.18.2 | mock server                                                             |
| tsx                       | 4.23.15         | mock server                                                             |
| @types/node               | 22.20.5         |                                                                         |

Added by later workstreams and pinned when introduced: `partysocket` 1.3.0 (WS4),
`@cloudflare/vitest-plugin` 1.4.0 (WS3b), `motion` 14.1.0 and `canvas-confetti` (WS8),
`fast-check` (WS1), `playwright` (WS7).

## License

MIT, see [LICENSE](LICENSE).
