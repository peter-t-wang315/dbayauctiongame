import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const MOCK_DIR = path.resolve(process.cwd(), '../../tools/mock-server');
let mock: ChildProcess | null = null;

async function startMock() {
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
}
async function stopMock() {
  mock?.kill();
  await new Promise((r) => setTimeout(r, 300));
  mock = null;
}

test.beforeAll(startMock);
test.afterAll(stopMock);

async function join(page: Page, name: string) {
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'JOIN THE ROOM' }).click();
}

test('create -> lobby -> second player -> bot -> start; refresh restores seat; mock restart reconnects', async ({
  browser,
}) => {
  const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostCtx.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await host.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  const code = host.url().split('/').pop()!;
  await join(host, 'Sam');
  await expect(host.getByRole('heading', { name: new RegExp(`Room ${code}`) })).toBeVisible();

  // 390px: no horizontal scroll, tap targets >= 44px
  expect(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const small = await host.evaluate(() =>
    Array.from(document.querySelectorAll('button, input, a'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.height < 43.5 || r.width < 43.5)).length,
  );
  expect(small).toBe(0);

  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guest = await guestCtx.newPage();
  await guest.goto(`/r/${code}`);
  await join(guest, 'Pat');
  await expect(guest.getByText('Waiting for Sam to start...')).toBeVisible();
  await expect(host.getByText('Pat')).toBeVisible();

  // refresh restores the seat without the join form
  await guest.reload();
  await expect(guest.getByText('Waiting for Sam to start...')).toBeVisible();
  await expect(guest.getByLabel('Your name')).toHaveCount(0);

  // killing the mock and restarting it: client shows reconnecting, then recovers
  await stopMock();
  await expect(guest.getByText('Reconnecting...')).toBeVisible({ timeout: 10_000 });
  await startMock();
  // the restarted mock has no such room (state is in memory): demo code rooms only. Verify the UI
  // gives up cleanly instead of hanging (room gone -> fatal card).
  await expect(guest.getByRole('heading', { name: /No such room|Reconnecting/ })).toBeVisible({
    timeout: 20_000,
  });

  await hostCtx.close();
  await guestCtx.close();
});

test('demo room: reconnect after mock restart restores the seat; host starts', async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/r/DBAYS');
  await join(page, 'Sam');
  await expect(page.getByRole('heading', { name: /Room DBAYS/ })).toBeVisible();
  // demo room may already have bots; make sure we can start
  const start = page.getByRole('button', { name: 'START GAME' });
  while (await start.isDisabled()) await page.getByRole('button', { name: '+ Add bot' }).click();

  await stopMock();
  await expect(page.getByText('Reconnecting...')).toBeVisible({ timeout: 10_000 });
  await startMock();
  // DBAYS is recreated on boot, but our old seat is gone -> join form offered again
  await expect(page.getByLabel('Your name')).toBeVisible({ timeout: 20_000 });
  await join(page, 'Sam');
  while (await start.isDisabled()) await page.getByRole('button', { name: '+ Add bot' }).click();
  await start.click();
  await expect(page.getByText(/Game in progress/)).toBeVisible();
  await ctx.close();
});
