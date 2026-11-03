# ci-flakes

## Branch / base
`fix/ci-flakes` off `origin/main`.

## Done
- Slice 1: fonts self-hosted via `next/font/local` (apps/web/app/fonts, OFL licenses alongside). Same CSS vars (`--font-lilita`, `--font-nunito`), `display: swap`; fallbacks live in styles/tokens.css, unchanged. Landing/game screenshots before/after match. `next build` clean with a dead proxy; no googleapis/gstatic refs in `.next`.

## In progress
- Slice 2: apps/server teardown flake (`Closing rpc while "onUserConsoleLog" was pending`).

## Next
Reproduce with 30x `pnpm --filter` server test loop, find source, fix; then run full checks + web e2e, open draft PR.

## Gotchas / decisions
- Fonts from fontsource (jsdelivr) woff2, latin subset: Lilita One 400; Nunito variable wght (covers 600/700/800 that next/font/google served). Licenses from google/fonts repo.
