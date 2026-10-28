import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Accessibility audit (04 section 8): axe (wcag2a + wcag2aa) on every screen at 390x844, light and dark,
// failing on serious/critical violations; plus keyboard / aria-live / reduced-motion / target-size checks.
// No axe rule is disabled.
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

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }, theme);
}

/** Scan the current screen in both themes; fail on serious/critical violations. */
async function scan(page: Page, label: string) {
  // let finite animations/transitions finish so axe reads final colours, not mid-fade ones
  await page
    .waitForFunction(() =>
      document.getAnimations().every((a) => a.effect?.getComputedTiming().iterations === Infinity || a.playState !== 'running'),
      undefined,
      { timeout: 5000 },
    )
    .catch(() => {});
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    // JS-driven (Motion) fades are invisible to getAnimations(); re-scan a couple of times before failing
    let bad: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      if (bad.length === 0) break;
      await page.waitForTimeout(1000);
    }
    const summary = bad.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(' ') + ' :: ' + (n.any[0]?.message ?? n.failureSummary ?? ''))
          .join(' | ')}`,
    );
    expect(summary, `${label} [${theme}]`).toEqual([]);
  }
  await setTheme(page, 'light');
}

async function join(page: Page) {
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
}
async function startGame(page: Page, mode: 'Classic' | 'Frenzy', bots: number) {
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await join(page);
  for (let i = 0; i < bots; i++) await page.getByRole('button', { name: '+ Add bot' }).click();
  await page.getByRole('button', { name: mode, exact: true }).click();
  await page.getByRole('button', { name: 'START GAME' }).click();
  await expect(page.locator('[data-fx="status-strip"]')).toBeVisible();
}

test('landing, join, lobby, rules', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'CREATE A ROOM' })).toBeVisible();
  await scan(page, 'landing');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  await expect(page.getByLabel('Your name')).toBeVisible();
  await scan(page, 'join');
  await join(page);
  await page.getByRole('button', { name: '+ Add bot' }).click();
  await expect(page.getByRole('button', { name: 'START GAME' })).toBeVisible();
  await scan(page, 'lobby');
  await page.goto('/rules');
  await expect(page.getByRole('heading', { name: 'How to play' })).toBeVisible();
  await scan(page, 'rules');
});

test('Classic 3 bays: game, menu sheet, focus/keyboard/aria-live/targets', async ({ page }) => {
  await startGame(page, 'Classic', 2);
  await expect(page.locator('[data-fx="bay"]')).toHaveCount(3);
  await scan(page, 'game classic 3 bays');

  // status strip is a polite live region
  const strip = page.locator('[data-fx="status-strip"]');
  expect(
    await strip.evaluate(
      (el) => el.closest('[aria-live],[role="status"]') !== null || el.querySelector('[aria-live],[role="status"]') !== null,
    ),
  ).toBe(true);

  // tap targets >= 44px for every visible interactive control
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input, [role="button"]'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5))
      .map(({ el, r }) => `${el.tagName}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);

  // keyboard: tab reaches hand cards and every stop shows a visible focus indicator
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el.tagName === 'NEXTJS-PORTAL') return null; // dev overlay, not ours
      const cs = getComputedStyle(el);
      const outlined = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow !== 'none' && /\d+px/.test(cs.boxShadow);
      return {
        kind: el.getAttribute('data-fx') ?? el.getAttribute('aria-label') ?? el.tagName,
        visible: outlined || shadow,
      };
    });
    if (info) {
      expect(info.visible, `focus indicator on ${info.kind}`).toBe(true);
      seen.add(info.kind);
    }
  }
  expect(seen.has('hand-card')).toBe(true);

  // menu sheet: axe, focus trap, Esc closes and returns focus
  const menu = page.getByRole('button', { name: /Menu/ }).first();
  await menu.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toBeVisible();
  await scan(page, 'menu sheet');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(menu).toBeFocused();
});

test('Frenzy 4 bays', async ({ page }) => {
  await startGame(page, 'Frenzy', 4);
  await expect(page.locator('[data-fx="bay"]')).toHaveCount(4);
  await scan(page, 'game frenzy 4 bays');
});

test('Desktop 1280x800: Classic 3 bays and Frenzy 4 bays (podiums, rail, legend)', async ({ browser }) => {
  for (const [mode, bots, bays] of [
    ['Classic', 2, 3],
    ['Frenzy', 4, 4],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await startGame(page, mode, bots);
    await expect(page.locator('[data-fx="bay"]')).toHaveCount(bays);
    await expect(page.locator('[data-fx="podium"]')).toHaveCount(bots + 1);
    await scan(page, `desktop ${mode} ${bays} bays`);
    await ctx.close();
  }
});

test('reduced motion: no looping or long animations', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await startGame(page, 'Classic', 2);
  const running = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => {
        const t = a.effect?.getComputedTiming();
        return t && (t.iterations === Infinity || Number(t.duration) > 100);
      })
      .map((a) => (a as CSSAnimation).animationName || a.id || 'anim'),
  );
  expect(running).toEqual([]);
  await ctx.close();
});

test('gift step and reveal/results', async ({ page }) => {
  test.setTimeout(240_000);
  await startGame(page, 'Frenzy', 2);
  const reveal = page.locator('[data-fx="reveal"]');
  const deadline = Date.now() + 200_000;
  let giftScanned = false;
  while (!(await reveal.isVisible())) {
    expect(Date.now(), 'reached the reveal').toBeLessThan(deadline);
    const pick = page.locator('.g-gift__pick:not([disabled])').first();
    if (await pick.isVisible().catch(() => false)) {
      if (!giftScanned) {
        giftScanned = true;
        await scan(page, 'gift step');
      }
      await pick.click().catch(() => {});
    }
    await page.waitForTimeout(500);
  }
  await scan(page, 'reveal');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('[data-fx="reveal"]')).toHaveAttribute('data-state', 'done');
  await scan(page, 'results');
});
