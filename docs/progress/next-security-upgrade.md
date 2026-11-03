# Next.js security upgrade

## Branch / base
`chore/next-security-upgrade`, off `origin/main` (7ad428c).

## Done
- `pnpm audit` flagged three advisories on `next` (vulnerable `>=16.0.0 <=16.4.0`, patched `>=16.4.1`):
  - GHSA-2464-fhr4-w9xw (critical): unauthenticated RCE in the Image Optimization API with SVG files
  - GHSA-673q-mjm6-r5xr (critical): unauthenticated RCE in `use cache` functions returning typed arrays
  - GHSA-p3m5-59mp-jv5r (high): DoS in App Router using Server Actions
- Upgraded `next` 16.4.0 -> 16.4.1 in `apps/web/package.json` (smallest fix; no `eslint-config-next` or `@next/*` deps exist).
- Checks after upgrade: `pnpm audit` shows no `next` findings; `pnpm typecheck`, `pnpm lint`, `pnpm test` (all packages pass), and `pnpm --filter @dbay/web build` pass.

## In progress
Nothing.

## Next
- Let CI run `e2e-real` on the PR (not run locally: needs Playwright Chromium + wrangler).
- Merge when green.

## Gotchas / decisions
- `pnpm audit` still reports unrelated advisories (zod < 4.6.6, undici, ...); intentionally not touched here.
- Did not re-check the "dev exits on every other start" nudge from 16.4.0.
