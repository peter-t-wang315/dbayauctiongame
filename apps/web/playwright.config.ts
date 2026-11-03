import { defineConfig } from '@playwright/test';
import { AGENT_ENV_OFF, MOCK_PORT, WEB_PORT } from './e2e/ports';

// Smoke test against the mock server (docs/06 WS4). The spec starts/stops the mock itself so it can
// restart it; only the Next dev server is managed here. Run: pnpm --filter @dbay/web test:e2e
// Ports: E2E_WEB_PORT (default 3100), E2E_MOCK_PORT (default 8787).
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${WEB_PORT}`, viewport: { width: 390, height: 844 } },
  webServer: {
    command: `pnpm exec next dev -p ${WEB_PORT}`,
    url: `http://localhost:${WEB_PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { ...AGENT_ENV_OFF, NEXT_PUBLIC_GAME_HOST: `localhost:${MOCK_PORT}` },
  },
});
