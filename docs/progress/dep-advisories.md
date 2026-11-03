# dep-advisories progress

## Branch / base
`chore/dep-advisories`, stacked on `chore/next-security-upgrade` (PR #35) because both touch `pnpm-lock.yaml`. Retarget to `main` after #35 merges.

## Done
`pnpm audit` before: 12 advisories (5 high, 7 moderate). After: 1 moderate (dev-only, left open).

| Package | Severity | Path | Scope | Patched | Result |
|---|---|---|---|---|---|
| zod (oversized constrained collections memory exhaustion) | high | direct in `packages/protocol`, `packages/content`; transitive via `@cloudflare/vitest-plugin` | PROD (protocol validation shipped to server and web) | >=4.6.6 | FIXED: zod 4.6.5 -> 4.6.6 (patch) in both packages; vitest-plugin 1.5.0 also uses 4.6.6 |
| undici x 8 (EventSource DoS, SRI bypass, content-encoding DoS, cross-origin redirect cache poisoning, TLS options dropped, TLS renegotiation DoS, WS PONG buffering, decompress interceptor): 4 high, 4 moderate | high/moderate | transitive via `wrangler > miniflare > undici` and `@cloudflare/vitest-plugin > miniflare` | DEV-ONLY (local wrangler dev/test tooling, not in the deployed Worker bundle) | >=7.30.1 | FIXED: wrangler 4.149.0 -> 4.156.0, `@cloudflare/vitest-plugin` 1.4.0 -> 1.4.11, `@cloudflare/workers-types` 5.20261006.1 -> 5.20261029.1 (peer required by wrangler); newest versions that pass the minimumReleaseAge guard (4.156.1+, 1.4.12+, 1.5.0 are too new). miniflare 5.20261023.3-beta (the previous one was already alpha) uses undici 7.30.1 |
| @vitest/mocker x 2 (manual mock code injection, Windows backslash traversal) | moderate | `vitest > @vitest/mocker` | DEV-ONLY (test runner) | >=4.1.12 | FIXED: vitest 4.1.11 -> 4.1.12 |
| minimatch (globparts amplification DoS) | moderate | `eslint > minimatch`, `eslint > @eslint/config-array > minimatch` | DEV-ONLY (lint) | >=11.0.1 | LEFT OPEN: needs minimatch 10 -> 11 (major); latest eslint (10.14.0) and `@eslint/config-array` (0.23.5) still depend on ^10, so an override would force a major onto a tool that does not declare support. Revisit when eslint takes minimatch 11. |

Also bumped typescript-eslint 8.71.1 -> 8.72.1 (patch; it still uses minimatch 10).

## Checks
typecheck, lint, all unit tests, web `next build`, server `wrangler deploy --dry-run`: all pass. Web e2e (earlier run with identical web deps, alt port 3101): 27 passed, 1 skipped (gift step).

## Next
Merge #35, then retarget this PR to `main`.

## Gotchas / decisions
- No `pnpm.overrides` added.
- The minimumReleaseAge guard is respected: no `minimumReleaseAgeExclude` entries, `pnpm-workspace.yaml` is unchanged from #35. wrangler 4.156.0 requires the beta miniflare line, so a non-beta is not available at a fixed version. Web e2e from the earlier run was not repeated: it exercises web + mock server only, and those deps (next, zod) are unchanged since that run; wrangler/vitest-plugin are covered by the server tests and dry-run deploy.
