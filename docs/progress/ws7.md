# WS7 progress (integration PREP only; nothing deployed)

Branch: `ws7-integration` (base origin/main after WS6 merge docs commit 820b2ff).

## Done
- `tools/smoke`: fast create-room + WS join + lobby-snapshot assert (`pnpm --filter @dbay/smoke start [host]`, env `SMOKE_ORIGIN`). Verified against local wrangler dev. The full bot-game smoke stays in `apps/server/scripts/smoke.mjs` (WS3b-owned, not moved).
- `tools/e2e`: Playwright config starting real `wrangler dev` (:8788) + `next dev` (:3200), spec plays a Frenzy bots game to the reveal.

## In progress
- Run e2e locally; deploy workflow; docs.

## Next
1. `.github/workflows/deploy.yml` (guarded), `docs/07-deploy-checklist.md`, README deploy section, PR.

## Gotchas
- e2e and `apps/web` e2e both run `next dev` in apps/web, which shares `.next/dev/lock`: do not run them simultaneously.
