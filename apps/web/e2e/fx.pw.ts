import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// WS8: sound is off by default, M toggles it and the choice persists; effects never break the game.
const MOCK_DIR = path.resolve(process.cwd(), '../../tools/mock-server');
let mock: ChildProcess | null = null;

test.beforeAll(async () => {
  mock = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: MOCK_DIR,
    env: { ...process.env, PORT: process.env.E2E_MOCK_PORT ?? '8787' },
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

test('M toggles sound, persisted; reduced motion game still plays', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: 'Frenzy', exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible();

  const stored = () => page.evaluate(() => localStorage.getItem('dbay:fx'));
  expect(await stored()).toBeNull(); // off by default, nothing written

  await page.keyboard.press('m');
  await expect(page.locator('[data-fx="status-text"]')).toHaveText('Sound on');
  expect(JSON.parse((await stored())!).sound).toBe(true);
  await page.keyboard.press('m');
  await expect(page.locator('[data-fx="status-text"]')).toHaveText('Sound off');
  expect(JSON.parse((await stored())!).sound).toBe(false);

  // Bid by tapping a card then a bay (effects run in the background of a normal bid).
  await page.locator('[data-fx="hand-card"]').first().click();
  await page.locator('[data-fx="bay"]').first().click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('sale moment: SOLD! stamp holds ~2s and a click-through won/lost toast appears', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: 'Frenzy', exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible();

  // Bots bid; Frenzy bay timers sell. Wait for the first sale.
  const anyStamp = page.locator('[data-fx="sold-stamp"]').first();
  await expect(anyStamp).toBeVisible({ timeout: 90_000 });
  const shownAt = Date.now();
  const bayIdx = await anyStamp.evaluate((el) => el.closest('[data-fx="bay"]')!.getAttribute('data-bay'));
  const stamp = page.locator(`[data-fx="bay"][data-bay="${bayIdx}"] [data-fx="sold-stamp"]`);
  await expect(stamp).toContainText('SOLD!');

  const toast = page.locator('[data-fx="sale-toast"][data-show="true"]');
  await expect(toast).toBeVisible();
  await expect(toast.locator('.g-toast__title')).toHaveText(/^(You won .+!|.+ won .+)$/);
  expect(await toast.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  // Sits below the status strip, never over the hand.
  const strip = await page.locator('[data-fx="status-strip"]').boundingBox();
  const card = await toast.locator('.g-toast__card').boundingBox();
  expect(card!.y).toBeGreaterThanOrEqual(strip!.y + strip!.height);

  // The stamp outlasts the old 1.3s hold (SALE_FX.stampHoldMs = 2000), then clears.
  await page.waitForTimeout(Math.max(0, 1500 - (Date.now() - shownAt)));
  await expect(stamp).toBeVisible();
  await expect(stamp).toHaveCount(0, { timeout: 5_000 });
});
