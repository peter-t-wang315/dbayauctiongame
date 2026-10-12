import { expect, test } from '@playwright/test';

// One browser + 2 bots play a full Frenzy game on the REAL local Worker to the reveal.
test('bots game runs to the reveal on the real server', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: 'Frenzy', exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible();

  // Reload mid-game: the seat must be restored from the stored secret.
  await page.reload();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible({ timeout: 20_000 });

  const reveal = page.locator('[data-fx="reveal"]');
  const deadline = Date.now() + 330_000;
  while (!(await reveal.isVisible())) {
    expect(Date.now(), 'reached the reveal').toBeLessThan(deadline);
    const pick = page.locator('.g-gift__pick:not([disabled])').first();
    if (await pick.isVisible().catch(() => false)) await pick.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await expect(page.locator('.rv-player')).toHaveCount(3);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('.rv-board__row')).toHaveCount(3);
});
