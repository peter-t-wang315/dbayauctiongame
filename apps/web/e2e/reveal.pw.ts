import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// WS6 smoke vs the mock server: play a short Frenzy game to the reveal, skip it, check standings and
// Rematch; the rules page renders every section.
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

test('game reaches the reveal; Skip shows standings and Rematch', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: 'Frenzy', exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible();

  // Let the bots play. Answer any Gift step aimed at me so the game keeps moving.
  const reveal = page.locator('[data-fx="reveal"]');
  const deadline = Date.now() + 200_000;
  while (!(await reveal.isVisible())) {
    expect(Date.now(), 'reached the reveal').toBeLessThan(deadline);
    const pick = page.locator('.g-gift__pick:not([disabled])').first();
    if (await pick.isVisible().catch(() => false)) await pick.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  await expect(page.locator('.rv-player')).toHaveCount(3);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('[data-fx="reveal"]')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('.rv-card[data-state="hidden"]')).toHaveCount(0);
  await expect(page.locator('.rv-board__row')).toHaveCount(3);
  await expect(page.locator('.rv-board__row').first()).toHaveAttribute('data-rank', '1');
  await expect(page.getByRole('button', { name: 'REMATCH' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'test-results/ws6-results.png', fullPage: true });

  await page.getByRole('button', { name: 'REMATCH' }).click();
  await expect(page.getByRole('button', { name: 'START GAME' })).toBeVisible();
});

test('rules page shows every section with TOC chips', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible();
  const chips = page.locator('.rules-toc__chip');
  const sections = page.locator('.rules-sec');
  expect(await chips.count()).toBe(await sections.count());
  await page.getByRole('link', { name: 'Collections' }).click();
  await expect(page).toHaveURL(/#rules-collections$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
