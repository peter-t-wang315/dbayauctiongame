# ci-real-e2e progress

## Branch / base
`ci-real-e2e` off main (c618b33).

## Done
- `e2e-real` job in ci.yml (ubuntu only, 15 min timeout, chromium cached by Playwright version, report artifact on failure).
- e2e config: retries 1 + html reporter in CI, trace on-first-retry. Ports already env-configurable (E2E_WEB_PORT / E2E_SERVER_PORT).

## In progress
Verifying locally, then CI run.

## Next
Check CI green, record job duration in PR.

## Gotchas
- `WRANGLER_SEND_METRICS=false` set to avoid telemetry prompts; wrangler dev runs locally without login.
