import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Make every game in this context `length: 'quick'` (the lobby UI has no length control). */
export interface Net {
  /** Simulate losing the network: context offline, open sockets dropped, new ones refused. */
  setDown(down: boolean): Promise<void>;
}

export async function forceQuick(ctx: BrowserContext): Promise<Net> {
  let down = false;
  const open = new Set<{ close(o?: { code?: number }): void }>();
  await ctx.routeWebSocket(/\/parties\/room\//, (ws) => {
    if (down) {
      void ws.close({ code: 1006 });
      return;
    }
    const server = ws.connectToServer();
    open.add({
      close: (o) => {
        void ws.close(o);
        void server.close();
      },
    });
    ws.onMessage((raw) => {
      try {
        const m = JSON.parse(String(raw)) as { t?: string };
        if (m.t === 'setOpts') return server.send(JSON.stringify({ ...m, length: 'quick' }));
      } catch {
        /* forward as-is */
      }
      server.send(raw);
    });
  });
  return {
    async setDown(d) {
      down = d;
      await ctx.setOffline(d);
      if (d) {
        for (const ws of open) void ws.close({ code: 1006 });
        open.clear();
      }
    },
  };
}

/** Host creates a room and joins it; returns the 5-char code. */
export async function hostCreates(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await page.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  const code = page.url().split('/').pop()!;
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  await expect(page.getByRole('heading', { name: /Players/ })).toBeVisible();
  return code;
}

export async function guestJoins(page: Page, code: string, name: string): Promise<void> {
  await page.goto(`/r/${code}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  await expect(page.getByRole('heading', { name: /Players/ })).toBeVisible();
}

/** Two humans (host + guest) and one bot in the lobby, mode chosen, ready to start. */
export async function lobbyOfThree(
  host: Page,
  guest: Page,
  mode: 'Classic' | 'Frenzy',
): Promise<string> {
  const code = await hostCreates(host, 'Hana');
  await guestJoins(guest, code, 'Gus');
  await host.getByRole('button', { name: '+ Add bot' }).click();
  await expect(host.getByRole('heading', { name: 'Players 3/6' })).toBeVisible();
  await host.getByRole('button', { name: mode, exact: true }).click();
  return code;
}

export async function startGame(host: Page, guest: Page): Promise<void> {
  await host.getByRole('button', { name: 'START GAME' }).click();
  await expect(host.locator('[data-fx="status-strip"]')).toBeVisible();
  await expect(guest.locator('[data-fx="status-strip"]')).toBeVisible();
}

/** Host + guest in separate browser contexts (each forced to quick games), lobby of 3 with a bot. */
export async function twoPlayers(browser: Browser, mode: 'Classic' | 'Frenzy') {
  const hctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const gctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const hnet = await forceQuick(hctx);
  const gnet = await forceQuick(gctx);
  const host = await hctx.newPage();
  const guest = await gctx.newPage();
  const code = await lobbyOfThree(host, guest, mode);
  return { hctx, gctx, host, guest, code, hnet, gnet };
}

/** Try card + bay combos until the bid is accepted (the bay shows my "winning" state). */
export async function placeBid(p: Page, lowFirst = false): Promise<void> {
  const cards = p.locator('[data-fx="hand-card"][data-state="ready"]');
  const bays = p.locator('[data-fx="bay"]');
  const nCards = await cards.count();
  for (let k = 0; k < nCards; k++) {
    const c = lowFirst ? k : nCards - 1 - k;
    await cards.nth(c).click({ timeout: 2000 });
    const n = await bays.count();
    for (let b = 0; b < n; b++) {
      await bays.nth(b).click({ timeout: 2000, force: true });
      await p.waitForTimeout(400);
      if ((await p.locator('[data-fx="bay"][data-state="winning"]').count()) > 0) return;
    }
  }
  throw new Error('no bid was accepted');
}

export const banner =(p: Page) => p.locator('[data-fx="turn-banner"]');
export const reconnecting = (p: Page) => p.getByRole('heading', { name: 'Reconnecting...' });

/** Passes on this page's Classic turn if it is mine; returns whether it passed. */
export async function passIfMyTurn(p: Page): Promise<boolean> {
  const mine = p.locator('[data-fx="turn-banner"][data-mine="true"]');
  if (!(await mine.isVisible().catch(() => false))) return false;
  const pass = mine.getByRole('button', { name: 'Pass' });
  if (!(await pass.isVisible().catch(() => false))) return false;
  await pass.click({ timeout: 2000 }).catch(() => {});
  return true;
}

/** Click the first enabled gift-pick button, if any (gift holder or victim step). */
export async function actOnGift(p: Page): Promise<void> {
  const pick = p.locator('.g-gift__pick:not([disabled])').first();
  if (await pick.isVisible().catch(() => false)) await pick.click({ timeout: 2000 }).catch(() => {});
}

/** Per-bay "index|item name|top bid" strings, for cross-client comparison. */
export async function bayState(p: Page): Promise<string[]> {
  return p.locator('[data-fx="bay"]').evaluateAll((els) =>
    els.map((e) => {
      const name = e.querySelector('.g-bay__name')?.textContent ?? '';
      const top = e.querySelector('[data-fx="top-bid"]')?.textContent ?? '';
      return `${e.getAttribute('data-bay')}|${name}|${top}`;
    }),
  );
}
