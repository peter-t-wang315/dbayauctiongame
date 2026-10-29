import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// WS5 smoke vs the mock server: Classic two-tap bid, Frenzy timers, 390px layout budget.
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

async function startGame(page: Page, mode: 'Classic' | 'Frenzy', bots: number) {
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  for (let i = 0; i < bots; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: mode, exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible();
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const small = Array.from(document.querySelectorAll('.g-screen button'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.height < 43.5 || r.width < 43.5) && r.height > 0);
    const screen = document.querySelector('.g-screen')!;
    return {
      hScroll: document.documentElement.scrollWidth > innerWidth,
      vScroll: document.documentElement.scrollHeight > innerHeight,
      inner: screen.scrollHeight > screen.clientHeight,
      smallTargets: small.length,
      smallInfo: small.length
        ? Array.from(document.querySelectorAll('.g-screen button'))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.height > 0 && (r.height < 43.5 || r.width < 43.5);
            })
            .map(
              (el) =>
                el.className +
                ' ' +
                Math.round(el.getBoundingClientRect().width) +
                'x' +
                Math.round(el.getBoundingClientRect().height),
            )
        : [],
    };
  });
}

test('Classic 3 bays at 390x844: fits without scrolling, two-tap bid works', async ({ page }) => {
  await startGame(page, 'Classic', 2);
  await expect(page.locator('[data-fx="bay"]')).toHaveCount(3);
  await expect(page.locator('[data-fx="hand-card"]')).toHaveCount(12);
  await page.screenshot({ path: 'test-results/ws5-classic3.png' });
  expect(await layout(page)).toMatchObject({
    hScroll: false,
    vScroll: false,
    inner: false,
    smallTargets: 0,
  });

  // wait for my turn (bots take turns first or later)
  await expect(page.getByText(/Your turn/).first()).toBeVisible({ timeout: 40_000 });
  // the screen edges pulse while it's my turn
  await expect(page.locator('[data-fx="turn-frame"]')).toBeVisible();
  await page.locator('[data-card="v50"]').click();
  await expect(page.locator('[data-card="v50"]')).toHaveAttribute('data-state', 'selected');
  await expect(page.locator('[data-fx="bay"][data-state="legal"]').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/ws5-classic3-selected.png' });
  await page.locator('[data-fx="bay"][data-state="legal"]').first().click();
  await expect(page.locator('[data-card="v50"]')).toHaveAttribute('data-state', /out|spent/, {
    timeout: 5000,
  });
  // after my bid the turn ends: hand locked
  await expect(page.locator('[data-fx="hand-card"][data-state="locked"]').first()).toBeVisible();
  await expect(page.locator('[data-fx="turn-frame"]')).toHaveCount(0);
  // B1: no stale "Your turn" once the bid is in (the call stays on me through the gap)
  await expect(page.locator('[data-fx="turn-banner"][data-mine="true"]')).toHaveCount(0);
  await expect(page.locator('[data-fx="turn-banner"]')).not.toContainText('Your turn');
  // B2: tapping the card that is out on a bay says why instead of doing nothing
  if ((await page.locator('[data-card="v50"]').getAttribute('data-state')) === 'out') {
    await page.locator('[data-card="v50"]').click();
    await expect(page.locator('[data-fx="status-text"]')).toContainText(/on bay [A-D] until it closes/);
  }
  // the collection sheet opens and closes
  await page.getByRole('button', { name: /Your collections/ }).click();
  await expect(page.getByRole('dialog', { name: 'Your collections' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to bidding' }).click();
});

test('Frenzy 4 bays at 390x844: timers show, bid without waiting for a turn', async ({ page }) => {
  await startGame(page, 'Frenzy', 4);
  await expect(page.locator('[data-fx="bay"]')).toHaveCount(4);
  await expect(page.locator('[data-fx="bay-timer"]').first()).toContainText(/\d:\d\d/);
  await expect(page.locator('[data-fx="turn-frame"]')).toHaveCount(0); // no turns in Frenzy
  await page.screenshot({ path: 'test-results/ws5-frenzy4.png' });
  expect(await layout(page)).toMatchObject({
    hScroll: false,
    vScroll: false,
    inner: false,
    smallTargets: 0,
  });
  // $300: bots can't make it illegal between the legality check and the click (only a Proxy can).
  await page.locator('[data-card="v300"]').click();
  await expect(page.locator('[data-card="v300"]')).toHaveAttribute('data-state', 'selected');
  const legal = page.locator('[data-fx="bay"][data-state="legal"]').first();
  if (await legal.count()) {
    await legal.click();
    await expect(page.locator('[data-card="v300"]')).toHaveAttribute(
      'data-state',
      /out|spent|ready/,
      { timeout: 5000 },
    );
  }
});

test('Desktop 1280x800: podiums, big bays, card rack, persistent rail, keyboard bid', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await startGame(page, 'Classic', 2);
  await expect(page.locator('.g-side')).toBeVisible();
  await expect(page.getByRole('button', { name: /Menu: players/ })).toBeHidden();
  await expect(page.locator('[data-fx="podium"]')).toHaveCount(3);
  await expect(page.locator('[data-fx="key-legend"]')).toBeVisible();
  // Rail: sets + log open by default; L collapses and expands the log.
  await expect(page.locator('#g-rail-log')).toBeVisible();
  const ys = await page
    .locator('[data-fx="bay"]')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(1);
  const cardYs = await page
    .locator('[data-fx="hand-card"]')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(cardYs).size).toBe(1);
  // Integer sprite scale (96px = 8x) and no page scroll.
  const sprite = await page
    .locator('[data-fx="bay"] .g-sprite')
    .first()
    .evaluate((e) => e.getBoundingClientRect().width);
  expect(sprite - 8).toBe(96); // 96px art + 2x(2px padding + 2px border)
  expect(await layout(page)).toMatchObject({ hScroll: false, vScroll: false, inner: false });
  await page.keyboard.press('l');
  await expect(page.locator('#g-rail-log')).toBeHidden();
  await page.keyboard.press('l');
  await expect(page.locator('#g-rail-log')).toBeVisible();
  await page.screenshot({ path: 'test-results/ws5-desktop.png' });
  await expect(page.getByText(/Your turn, Sam/).first()).toBeVisible({ timeout: 40_000 });
  await page.keyboard.press('3'); // slot 3 is always $50
  await expect(page.locator('[data-card="v50"]')).toHaveAttribute('data-state', 'selected');
  await page.keyboard.press('q');
  await expect(page.locator('[data-card="v50"]')).toHaveAttribute('data-state', /out|spent/, {
    timeout: 5000,
  });
  // B6: keys stay on their slot after a card is played ($75 keeps 4; $50 keeps 3).
  await expect(page.locator('[data-card="v75"] .g-kbd')).toHaveText('4');
  await expect(page.locator('[data-card="v50"] .g-kbd')).toHaveText('3');
  await ctx.close();
});

for (const [mode, bots, bays] of [
  ['Classic', 4, 4],
  ['Frenzy', 2, 3],
] as const) {
  test(`${mode} with ${bays} bays fits at 390x844 and 360x640 (04 section 14 matrix)`, async ({
    page,
  }) => {
    await startGame(page, mode, bots);
    await expect(page.locator('[data-fx="bay"]')).toHaveCount(bays);
    expect(await layout(page)).toMatchObject({
      hScroll: false,
      vScroll: false,
      inner: false,
      smallTargets: 0,
    });
    await page.setViewportSize({ width: 360, height: 640 });
    expect(await layout(page)).toMatchObject({
      hScroll: false,
      vScroll: false,
      inner: false,
      smallTargets: 0,
    });
  });
}
