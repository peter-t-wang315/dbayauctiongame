# ci-flakes

## Branch / base
`fix/ci-flakes` off `origin/main`.

## Done
- Slice 1: fonts self-hosted via `next/font/local` (apps/web/app/fonts, OFL licenses alongside). Same CSS vars (`--font-lilita`, `--font-nunito`), `display: swap`; fallbacks live in styles/tokens.css, unchanged. Landing/game screenshots before/after match. `next build` clean; no googleapis/gstatic refs in `.next`.
- Slice 2: server tests run with `LOG_LEVEL=silent` (vitest.config.ts miniflare binding) plus a test asserting it.

## In progress
- Final checks and draft PR.

## Next
Open draft PR (do not merge).

## Gotchas / decisions
- Fonts from fontsource (jsdelivr) woff2, latin subset: Lilita One 400; Nunito variable wght (covers the 600/700/800 next/font/google served). Licenses from the google/fonts repo.
- Server teardown flake: not reproducible locally (0/30 before, 0/30 after, Windows). Root-cause hypothesis: the Room DO's `console.log` (room.ts `log()`, on room create and effect log entries) is forwarded by the vitest pool to the runner via the `onUserConsoleLog` RPC; a log arriving as the worker is torn down yields "Closing rpc while onUserConsoleLog was pending". Fix: use the existing `LOG_LEVEL=silent` switch under test so the DO emits no console output. Prod config unchanged. No documented upstream fix found.
