# e2e-ports

**Branch / base:** `chore/e2e-ports`, stacked on `chore/next-security-upgrade` (PR #35, Next 16.4.0 -> 16.4.1).

**Done:**
- `apps/web/e2e/ports.ts`: `WEB_PORT` (E2E_WEB_PORT, default 3100), `MOCK_PORT` (E2E_MOCK_PORT, default 8787); used by playwright.config.ts and every spec.
- Whole-suite failure root cause: Next 16.4.0 `next dev` detects coding-agent env vars and, because 16.4.0 has a security advisory, exits with an "upgrade recommendation" (first start, and again mid-run after a 5 minute retry window). Single spec files finish before it fires; the full suite does not. The fix is the Next upgrade (#35); no env blanking in the harness.
- Verified on 16.4.1 under agent detection: `next dev` stayed up 9+ minutes with no nudge; full suite passes in one go.

**In progress:** none.

**Next:** after PR #40 merges, `roominfo.pw.ts` needs the same one-line change (`PORT: MOCK_PORT` + `import { MOCK_PORT } from './ports'`). Rebase onto main once #35 merges.

**Gotchas / decisions:** an earlier revision blanked agent env vars for the dev server; removed on review in favour of the real upgrade.
