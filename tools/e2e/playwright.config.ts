import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Real-stack e2e: Next dev on WEB_PORT + `wrangler dev` (apps/server) on SERVER_PORT. Ports differ
// from apps/web's own e2e (3100/8787) so both can coexist. Caveat: two `next dev` in apps/web share
// .next/dev/lock, so do not run this and `pnpm --filter @dbay/web test:e2e` at the same time.
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3200);
const SERVER_PORT = Number(process.env.E2E_SERVER_PORT ?? 8788);
const root = path.resolve(import.meta.dirname, '../..');
const webOrigin = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.pw.ts',
  timeout: 360_000,
  workers: 1,
  use: { baseURL: webOrigin, viewport: { width: 390, height: 844 } },
  webServer: [
    {
      command:
        `pnpm exec wrangler dev --ip 127.0.0.1 --port ${SERVER_PORT} --inspector-port ${SERVER_PORT + 1000}` +
        ` --var ALLOWED_ORIGINS:${webOrigin} --var CREATE_LIMIT_PER_HOUR:1000 --var JOIN_LIMIT_PER_MIN:600`,
      cwd: path.join(root, 'apps/server'),
      // Any HTTP response (even 404) from the Worker counts as up.
      url: `http://127.0.0.1:${SERVER_PORT}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec next dev -p ${WEB_PORT}`,
      cwd: path.join(root, 'apps/web'),
      url: webOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_PUBLIC_GAME_HOST: `localhost:${SERVER_PORT}` },
    },
  ],
});
