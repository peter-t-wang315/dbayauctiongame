import { expect, test } from '@playwright/test';
import {
  actOnGift,
  banner,
  bayState,
  forceQuick,
  guestJoins,
  hostCreates,
  reconnecting,
  startGame,
  twoPlayers,
} from './helpers';

// Network / lifecycle robustness against the REAL local Worker (docs/progress/robustness.md).
test.describe.configure({ timeout: 720_000 });

test('3. a player offline ~10s reconnects; the game continues and auto-passes them meanwhile', async ({
  browser,
}) => {
  const { hctx, gctx, host, guest, gnet } = await twoPlayers(browser, 'Classic');
  try {
    await startGame(host, guest);
    await expect(banner(guest)).toBeVisible();
    await gnet.setDown(true);
    // Overlay shows after ~1s of disconnect (04 3.7).
    await expect(reconnecting(guest)).toBeVisible({ timeout: 5000 });
    // Stay away at least 10s AND until the host has seen Gus's turn auto-passed (01 R13).
    const awayUntil = Date.now() + 10_000;
    const log = host.locator('[data-fx="status-text"]');
    let autoPassed = false;
    const giveUp = Date.now() + 60_000;
    while ((Date.now() < awayUntil || !autoPassed) && Date.now() < giveUp) {
      const t = (await log.innerText().catch(() => '')).trim();
      if (/Gus.*(away|auto-pass)/i.test(t)) autoPassed = true;
      await host.waitForTimeout(150);
    }
    expect(autoPassed, 'host saw Gus auto-passed while away').toBe(true);
    await gnet.setDown(false);
    await expect(reconnecting(guest)).toHaveCount(0, { timeout: 15_000 });
    await expect(guest.getByLabel('Your name')).toHaveCount(0);
    await expect(guest.locator('[data-fx="hand-card"]').first()).toBeVisible();
    // Same state on both clients again, and Gus gets a live turn again.
    await expect
      .poll(async () => JSON.stringify(await bayState(host)), { timeout: 15_000 })
      .toBe(JSON.stringify(await bayState(guest)));
    await expect(guest.locator('[data-fx="turn-banner"][data-mine="true"]')).toBeVisible({
      timeout: 90_000,
    });
  } finally {
    await hctx.close();
    await gctx.close();
  }
});

test('6. host leaves in the lobby: host passes to the remaining human', async ({ browser }) => {
  const hctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const host = await hctx.newPage();
    const guest = await gctx.newPage();
    const code = await hostCreates(host, 'Hana');
    await guestJoins(guest, code, 'Gus');
    await expect(guest.getByText('Only the host can change settings.')).toBeVisible();
    await host.getByRole('button', { name: 'Menu', exact: true }).click();
    await host.getByRole('button', { name: 'Leave room' }).click();
    // Gus is promoted: host-only copy goes away and the HOST tag moves to Gus.
    await expect(guest.getByText('Only the host can change settings.')).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(guest.getByRole('heading', { name: 'Players 1/6' })).toBeVisible();
    await expect(guest.locator('.tag', { hasText: 'HOST' })).toHaveCount(1);
    await expect(guest.getByRole('button', { name: '+ Add bot' })).toBeVisible();
  } finally {
    await hctx.close();
    await gctx.close();
  }
});

test('5. page backgrounded during the reveal returns to rendered results without crashing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await forceQuick(page.context());
  await hostCreates(page, 'Sam');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: 'Frenzy', exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  const reveal = page.locator('[data-fx="reveal"]');
  const deadline = Date.now() + 400_000;
  while (!(await reveal.isVisible())) {
    expect(Date.now(), 'reached the reveal').toBeLessThan(deadline);
    await actOnGift(page);
    await page.waitForTimeout(500);
  }
  const setVis = (state: 'hidden' | 'visible') =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVis('hidden');
  await page.waitForTimeout(4000); // the reveal animation runs on while hidden
  await setVis('visible');
  await expect(page.locator('.rv-player')).toHaveCount(3);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('.rv-board__row')).toHaveCount(3);
  await expect(reconnecting(page)).toHaveCount(0);
  expect(errors, 'no uncaught page errors').toEqual([]);
});
