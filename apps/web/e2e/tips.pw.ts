import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// First-game tips (04 section 4.8) vs the mock server: the first-turn tip shows once, never blocks a
// bid, is dismissable, is remembered on this device, and `dbay:tips = "off"` keeps tips away.
const MOCK_DIR = path.resolve(process.cwd(), '../../tools/mock-server');
let mock: ChildProcess | null = null;

test.beforeAll(async () => {
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

async function startClassic(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: 'Classic', exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible();
}

test('first-turn tip: shows on my turn, does not block a bid, dismisses, is remembered', async ({ page }) => {
  await startClassic(page);
  const tip = page.locator('[data-fx="tip"][data-tip="firstTurn"]');
  await expect(tip).toBeVisible({ timeout: 40_000 });
  await expect(tip).toContainText("Bid cards don't score: only the items you win do.");
  await expect(page.locator('[data-fx="tip-live"]')).toContainText('Tip: Bid cards');
  await expect(page.locator('[data-fx="tip-live"]')).toHaveAttribute('aria-live', 'polite');
  // remembered as soon as it shows
  expect(await page.evaluate(() => localStorage.getItem('dbay:tips'))).toContain('firstTurn');

  // The toast overlays the top of the bays but taps go through it (only "Got it" is clickable).
  await page.locator('[data-card="v50"]').click();
  const legal = page.locator('[data-fx="bay"][data-state="legal"]').first();
  await expect(legal).toBeVisible();
  await legal.click({ position: { x: 40, y: 16 } });
  await expect(page.locator('[data-card="v50"]')).toHaveAttribute('data-state', /out|spent/, { timeout: 5000 });

  // dismiss (if the bid's snapshot didn't already let it time out)
  if (await tip.isVisible()) await page.getByRole('button', { name: /Got it/ }).click();
  await expect(tip).toHaveCount(0);
  // not shown again on my next turn
  await expect(page.locator('[data-fx="turn-frame"]')).toHaveCount(0);
  await expect(page.locator('[data-fx="turn-frame"]')).toBeVisible({ timeout: 40_000 });
  await page.waitForTimeout(500);
  await expect(page.locator('[data-fx="tip"][data-tip="firstTurn"]')).toHaveCount(0);
});

test('tips "off" on this device: no toast on my turn', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('dbay:tips', 'off');
    } catch {
      /* ignore */
    }
  });
  await startClassic(page);
  await expect(page.locator('[data-fx="turn-frame"]')).toBeVisible({ timeout: 40_000 });
  await page.waitForTimeout(500);
  await expect(page.locator('[data-fx="tip"]')).toHaveCount(0);
});

test('storage that throws: the tip still shows once', async ({ page }) => {
  await page.addInitScript(() => {
    const boom = () => {
      throw new Error('SecurityError');
    };
    Storage.prototype.getItem = boom;
    Storage.prototype.setItem = boom;
  });
  await startClassic(page);
  await expect(page.locator('[data-fx="tip"][data-tip="firstTurn"]')).toBeVisible({ timeout: 40_000 });
});
