# WS7 progress (integration PREP only; nothing deployed)

Branch: `ws7-integration` (base origin/main at 820b2ff, after WS6 merge).

## Done
- `tools/smoke`: fast create-room + WS join + lobby-snapshot assert (`pnpm --filter @dbay/smoke start [host]`, env `SMOKE_ORIGIN`). Verified against local wrangler dev. The full bot-game smoke stays in `apps/server/scripts/smoke.mjs` (WS3b-owned, not moved).
- `tools/e2e`: Playwright config starts real `wrangler dev` (:8788) + `next dev` (:3200); spec plays a Frenzy bots game (with a mid-game reload) to the reveal. Passes locally in ~3.8 min.
- `.github/workflows/deploy.yml`: push-to-main (server/packages paths) + `workflow_dispatch` (production|preview); every step is skipped when `CLOUDFLARE_API_TOKEN` is absent (job stays green). Then `wrangler deploy --env X` and smoke against repo var `WORKER_HOST` (production) or `WORKER_HOST_PREVIEW` (preview; review fix).
- `docs/07-deploy-checklist.md` (account steps, env vars, iPhone-over-LAN checklist), `docs/07-playtest-log.md` template, README deploy section.

## In progress
- Nothing. PR open, awaiting user.

## Next (needs user accounts)
1. Cloudflare token + account id secrets, `WORKER_HOST`/`WORKER_HOST_PREVIEW`/`SMOKE_ORIGIN` vars, fix `CHANGE-ME` origin in `apps/server/wrangler.jsonc`, Vercel project + `NEXT_PUBLIC_GAME_HOST`.
2. First `workflow_dispatch` deploy (preview, then production), real-device checklist.

## Findings / gotchas
- Web lobby has no game-length control (only mode, bid window, relaxed), so every UI game is `standard` (~11 min with bots in Frenzy). The e2e rewrites the UI's `setOpts` frames to add `length:'quick'` via `page.routeWebSocket`. Product decision needed whether to expose length in the lobby.
- e2e and `apps/web` e2e both run `next dev` in apps/web, which shares `.next/dev/lock`: do not run them simultaneously (wrangler ports differ, so those do not collide).
- `env.production.vars.ALLOWED_ORIGINS` is still `https://CHANGE-ME.vercel.app` (apps/server, not mine); smoke in CD fails until set.
- The smoke only checks the Worker; the Vercel to Worker wiring is checked manually (checklist section B).
- No real web/server protocol mismatches found: join, bots, reload-restore, gift step and reveal all worked on the real server.
