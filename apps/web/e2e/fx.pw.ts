import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

// WS8: sound is off by default, M toggles it and the choice persists; effects never break the game.
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
