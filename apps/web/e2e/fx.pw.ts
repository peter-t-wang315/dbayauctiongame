import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { MOCK_PORT } from './ports';
import { expect, test, type Page } from '@playwright/test';

// WS8: sound is off by default, M toggles it and the choice persists; effects never break the game.
const MOCK_DIR = path.resolve(process.cwd(), '../../tools/mock-server');
let mock: ChildProcess | null = null;

test.beforeAll(async () => {
  mock = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: MOCK_DIR,
    env: { ...process.env, PORT: MOCK_PORT },
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
  // Last slot is the Proxy: always legal on a non-empty bay I'm not winning, so it beats any bot opener.
  // Tap a bay the UI marks legal, so a bay that just sold (now empty) can't make this flaky.
  await page.locator('[data-fx="hand-card"]').last().click();
  await page.locator('[data-fx="bay"]').and(page.getByRole('button', { name: /Tap to bid\./ })).first().click();
  // The accepted bid flashes "Bid sent: <face> on <bay>" in the status line (and the bump runs).
  await expect(page.locator('[data-fx="status-text"]')).toHaveText(/^Bid sent: (\$\d+|Proxy) on [A-D]$/);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

// Playtest 11-02 P1/P7: winning an item leaves a lasting cue (status line + NEW mark in my sets) that
// outlives the 2s stamp / toast and ends at my next action; the wild shows in the SETS strip.
async function startFrenzy(page: Page) {
  await page.addInitScript(() => localStorage.setItem('dbay:tips', 'off'));
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: 'Frenzy', exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible();
}

/** Bid my highest cards on legal bays until a sale to me lands ("You won ..." on the status line). */
async function winSomething(page: Page) {
  const text = page.locator('[data-fx="status-strip"] .g-strip__msg');
  for (let i = 0; i < 40; i++) {
    if ((await text.count()) === 0) throw new Error('game ended before I won an item');
    if (/^You won /.test((await text.textContent({ timeout: 2000 })) ?? '')) return;
    const cards = page.locator('[data-fx="hand-card"]:not([aria-disabled="true"])');
    const n = await cards.count();
    // Never bid while a win cue is showing (my bid would end it before the test looks).
    if (await page.locator('[data-fx="collection-strip"][data-new="true"]').count()) return;
    if (n > 0) {
      await cards.nth(n - 1 - (i % Math.min(n, 3))).click();
      const bay = page.locator('[data-fx="bay"]').and(page.getByRole('button', { name: /Tap to bid\./ })).first();
      if (await bay.count()) await bay.click();
    }
    // Poll fast: my next bid (above) ends the cue, so a slow check could miss a short-lived win.
    for (let k = 0; k < 15; k++) {
      if (/^You won /.test((await text.textContent({ timeout: 2000 }).catch(() => '')) ?? '')) return;
      await page.waitForTimeout(100);
    }
  }
  throw new Error('never won an item against the mock bots');
}

test('win moment: status line and NEW mark outlive the toast; the wild shows in SETS', async ({ page }) => {
  test.setTimeout(150_000);
  await startFrenzy(page);
  await winSomething(page);
  const msg = page.locator('[data-fx="status-strip"] .g-strip__msg');
  const sets = page.locator('[data-fx="collection-strip"]');
  await expect(msg).toHaveText(/^You won .+!$/);
  await expect(sets).toHaveAttribute('data-new', 'true');
  // A Display Case / Gift win marks the wild/gift pill instead of a set row (no NEW tag there).
  const marked = sets.locator('.g-sets__item[data-new="true"], .g-wild[data-new="true"]');
  await expect(marked.first()).toBeVisible();
  // Past the toast (2.8s) and the stamp (2s): the cue is still there, and the strip is not double-read.
  await page.waitForTimeout(3500);
  await expect(msg).toHaveText(/^You won .+!$/);
  await expect(sets).toHaveAttribute('data-new', 'true');
  await expect(page.locator('[data-fx="status-text"] > span[aria-hidden="true"]')).toHaveCount(1);
  // The won item is in the strip, not clipped (it moves to the front).
  const item = marked.first();
  const box = await item.boundingBox();
  const sbox = await sets.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(sbox!.x + sbox!.width);
  if (process.env.WIN_SHOTS) await page.screenshot({ path: `${process.env.WIN_SHOTS}/win-390.png` });
  // My next bid ends the cue.
  const cards = page.locator('[data-fx="hand-card"]:not([aria-disabled="true"])');
  await cards.last().click();
  await page.locator('[data-fx="bay"]').and(page.getByRole('button', { name: /Tap to bid\./ })).first().click();
  await expect(sets).not.toHaveAttribute('data-new', 'true');
  await expect(msg).not.toHaveText(/^You won /);
});

test('win moment on desktop: Your sets row and my podium are marked; reduced motion keeps it static', async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await startFrenzy(page);
  await winSomething(page);
  await expect(page.locator('.g-side .g-crow[data-new="true"], .g-side .g-crow--wild[data-new="true"]').first()).toBeVisible();
  await expect(page.locator('[data-fx="podium"][data-me][data-fresh="true"]')).toBeVisible();
  const anim = await page.locator('[data-fx="podium"][data-fresh="true"]').evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  if (process.env.WIN_SHOTS) await page.screenshot({ path: `${process.env.WIN_SHOTS}/win-1280.png` });
  await ctx.close();
});
