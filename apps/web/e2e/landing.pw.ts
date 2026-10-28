import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const MOCK_DIR = path.resolve(process.cwd(), '../../tools/mock-server');
let mock: ChildProcess | null = null;

test.beforeAll(async () => {
  // Reuse any game server already on :8787 (e.g. a local `pnpm dev`); otherwise start the mock.
  const up = await fetch('http://localhost:8787/', { signal: AbortSignal.timeout(2000) }).then(
    () => true,
    () => false,
  );
  if (up) return;
  mock = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: MOCK_DIR,
    env: { ...process.env, PORT: '8787' },
    stdio: 'pipe',
  });
  await new Promise<void>((resolve, reject) => {
    mock!.stdout!.on('data', (d: Buffer) => d.toString().includes('mock server on') && resolve());
    mock!.on('error', reject);
    setTimeout(() => reject(new Error('mock did not start')), 20_000);
  });
});
test.afterAll(() => {
  mock?.kill();
});

// Regression: "CREATE A ROOM" hung on "Creating..." when the page was opened from a non-localhost
// dev origin (127.0.0.1 / LAN IP), because the dev server blocked hydration/RSC. Both must land.
const PORT = process.env.E2E_WEB_PORT ?? '3100';
for (const origin of [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`]) {
  test(`create room lands on /r/CODE from ${origin}`, async ({ page }) => {
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' }); // let React hydrate before clicking
    await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
    await page.waitForURL(/\/r\/[A-Z0-9]{5}$/, { timeout: 15_000 });
    await expect(page.getByLabel('Your name')).toBeVisible();
  });
}

test('landing shows lot row, pitch, and outlined How to play', async ({ page }) => {
  await page.goto(`http://localhost:${PORT}/`);
  await expect(page.getByTestId('lot-row').locator('svg, canvas, img, [data-sprite]').first()).toBeVisible();
  await expect(page.getByText('Best collection wins.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'How to play' })).toBeVisible();
});
