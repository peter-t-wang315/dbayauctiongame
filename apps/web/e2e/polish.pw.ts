import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// WS5 polish vs the mock server: item details (long-press / keyboard), tab order, assertive live
// region, and the 360x640 / 320x568 fit matrix.
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

async function fit(page: Page) {
  return page.evaluate(() => {
    const small = Array.from(document.querySelectorAll('.g-screen button'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.width > 0 && (r.height < 43.5 || r.width < 43.5);
      })
      .map(
        (el) =>
          `${el.className} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`,
      );
    const screen = document.querySelector('.g-screen')!;
    return {
      hScroll: document.documentElement.scrollWidth > innerWidth,
      vScroll: document.documentElement.scrollHeight > innerHeight,
      inner: screen.scrollHeight > screen.clientHeight,
      small,
    };
  });
}

async function longPress(page: Page, selector: string, ms = 600) {
  const box = (await page.locator(selector).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test('long-press opens item details without bidding; a normal tap still bids', async ({ page }) => {
  await startGame(page, 'Classic', 2);
  const bay0 = '[data-fx="bay"][data-bay="0"]';
  await expect(page.getByText(/Your turn/).first()).toBeVisible({ timeout: 40_000 });
  await page.locator('[data-card="v50"]').click();
  await expect(page.locator('[data-card="v50"]')).toHaveAttribute('data-state', 'selected');

  await longPress(page, bay0);
  const dlg = page.getByRole('dialog', { name: 'Item details' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByTestId('item-est')).toContainText(/Estimated value \$\d+/);
  await expect(dlg.getByTestId('item-name')).not.toBeEmpty();
  await expect(dlg.getByTestId('item-bids')).toContainText(/Bay A/);
  await expect(dlg).not.toContainText(/actual|true value/i);
  await page.screenshot({ path: 'test-results/ws5-item-details.png' });
  // The long press must not have bid: the card is still selected and in hand.
  await dlg.getByRole('button', { name: 'Close' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.locator('[data-card="v50"]')).toHaveAttribute('data-state', 'selected');

  // A normal tap still bids (two-tap flow intact).
  await page.locator('[data-fx="bay"][data-state="legal"]').first().click();
  await expect(page.locator('[data-card="v50"]')).toHaveAttribute('data-state', /out|spent/, {
    timeout: 5000,
  });
});

test('a short press does not open details', async ({ page }) => {
  await startGame(page, 'Classic', 2);
  await longPress(page, '[data-fx="bay"][data-bay="0"]', 120);
  await expect(page.getByRole('dialog', { name: 'Item details' })).toBeHidden();
});

test('keyboard: "i" on a focused bay and the details button open the sheet', async ({ page }) => {
  await startGame(page, 'Classic', 2);
  await page.locator('[data-fx="bay"][data-bay="1"]').focus();
  await page.keyboard.press('i');
  const dlg = page.getByRole('dialog', { name: 'Item details' });
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();

  // The next Tab stop after a bay is its (named) details button, revealed at 44x44 on focus.
  await page.locator('[data-fx="bay"][data-bay="0"]').focus();
  await page.keyboard.press('Tab');
  const info = page.getByRole('button', { name: /^Item details: .*bay A$/ });
  await expect(info).toBeFocused();
  const box = (await info.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect(dlg).toBeVisible();
});

test('tab order is strip, hand, bays; assertive region is separate from the polite strip', async ({
  page,
}) => {
  await startGame(page, 'Classic', 2);
  const order = await page.evaluate(() => {
    const tabbables = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.g-screen button:not(:disabled), .g-screen [tabindex]',
      ),
    );
    const idx = (sel: string) => tabbables.findIndex((el) => el.matches(sel));
    return {
      menu: idx('.g-strip__menu'),
      card: idx('[data-fx="hand-card"]'),
      bay: idx('[data-fx="bay"]'),
    };
  });
  expect(order.menu).toBeGreaterThanOrEqual(0);
  expect(order.menu).toBeLessThan(order.card);
  expect(order.card).toBeLessThan(order.bay);
  // Visual layout unchanged: bays sit above the hand.
  const ys = await page.evaluate(() => ({
    bay: document.querySelector('[data-fx="bay"]')!.getBoundingClientRect().top,
    card: document.querySelector('[data-fx="hand-card"]')!.getBoundingClientRect().top,
  }));
  expect(ys.bay).toBeLessThan(ys.card);

  const live = page.locator('[data-fx="assertive-live"]');
  await expect(live).toHaveAttribute('aria-live', 'assertive');
  await expect(page.locator('[data-fx="status-text"]')).toHaveAttribute('aria-live', 'polite');
  await expect(live).toContainText('Your turn', { timeout: 40_000 });
});

for (const [mode, bots, bays] of [
  ['Classic', 2, 3],
  ['Classic', 4, 4],
  ['Frenzy', 2, 3],
  ['Frenzy', 4, 4],
] as const) {
  test(`${mode} ${bays} bays: 360x640 fits with 44px targets; 320x568 does not break`, async ({
    page,
  }) => {
    await startGame(page, mode, bots);
    await expect(page.locator('[data-fx="bay"]')).toHaveCount(bays);
    // Let a first bid land so bays carry amount + bidder chip (the tightest content).
    // (Classic may start on my turn, so a bot bid is not guaranteed: do not fail on it.)
    await page
      .locator('[data-fx="top-bid"]')
      .first()
      .waitFor({ timeout: 15_000 })
      .catch(() => undefined);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.screenshot({ path: `test-results/ws5-${mode.toLowerCase()}${bays}-360.png` });
    expect(await fit(page)).toMatchObject({
      hScroll: false,
      vScroll: false,
      inner: false,
      small: [],
    });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.screenshot({ path: `test-results/ws5-${mode.toLowerCase()}${bays}-320.png` });
    const r = await fit(page);
    expect(r).toMatchObject({ hScroll: false, vScroll: false, inner: false });
    // Report only (tighter is allowed at 320): which targets shrink below 44px.
    if (r.small.length) console.log(`320px small targets (${mode} ${bays}):`, r.small);
  });
}

test('gift step fits at 360x640 and 320x568 (when the mock deals a Gift)', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 360, height: 640 });
  await startGame(page, 'Frenzy', 2);
  const pick = page.locator('.g-gift__pick:not([disabled])').first();
  const reveal = page.locator('[data-fx="reveal"]');
  const deadline = Date.now() + 120_000;
  let seen = false;
  while (!(await reveal.isVisible()) && Date.now() < deadline) {
    if (await pick.isVisible().catch(() => false)) {
      seen = true;
      break;
    }
    await page.waitForTimeout(400);
  }
  test.skip(!seen, 'the mock did not deal a Gift in this run');
  for (const [w, h] of [
    [360, 640],
    [320, 568],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    const r = await page.evaluate(() => {
      const gift = document.querySelector('.g-gift')!.getBoundingClientRect();
      const small = Array.from(document.querySelectorAll('.g-gift button'))
        .map((el) => el.getBoundingClientRect())
        .filter((b) => b.height > 0 && (b.height < 43.5 || b.width < 43.5)).length;
      return {
        hScroll: document.documentElement.scrollWidth > innerWidth,
        vScroll: document.documentElement.scrollHeight > innerHeight,
        inside:
          gift.left >= 0 && gift.right <= innerWidth && gift.top >= 0 && gift.bottom <= innerHeight,
        small,
      };
    });
    expect(r, `${w}x${h}`).toMatchObject({
      hScroll: false,
      vScroll: false,
      inside: true,
      small: 0,
    });
    await page.screenshot({ path: `test-results/ws5-gift-${w}.png` });
  }
});
