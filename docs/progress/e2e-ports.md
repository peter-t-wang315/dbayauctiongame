# e2e-ports

**Branch / base:** `chore/e2e-ports` off `origin/main`.

**Done:**
- `apps/web/e2e/ports.ts`: `WEB_PORT` (E2E_WEB_PORT, default 3100), `MOCK_PORT` (E2E_MOCK_PORT, default 8787); used by playwright.config.ts and every spec.
- Whole-suite failure root cause: Next 16.4.0 `next dev` detects coding-agent env vars (AI_AGENT, CLAUDECODE, ...) and, because 16.4.0 has a security advisory, exits with an "upgrade recommendation" (first start, and again mid-run after a 5 minute retry window). Single spec files finish before it fires; the full suite does not. Fix: `AGENT_ENV_OFF` blanks those vars for the webServer only.

**In progress:** none.

**Next:** after PR #40 merges, `roominfo.pw.ts` needs the same one-line change (`PORT: MOCK_PORT` + `import { MOCK_PORT } from './ports'`). After #35 (Next 16.4.1) merges, `AGENT_ENV_OFF` may be removable.

**Gotchas / decisions:** the agent-env blanking is a no-op in CI (vars unset).
