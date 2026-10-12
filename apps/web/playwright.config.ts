import { defineConfig } from '@playwright/test';

// Smoke test against the mock server (docs/06 WS4). The spec starts/stops the mock itself so it can
// restart it; only the Next dev server is managed here. Run: pnpm --filter @dbay/web test:e2e
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.ts',
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:3100', viewport: { width: 390, height: 844 } },
  webServer: {
    command: 'pnpm exec next dev -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { NEXT_PUBLIC_GAME_HOST: 'localhost:8787' },
  },
});
