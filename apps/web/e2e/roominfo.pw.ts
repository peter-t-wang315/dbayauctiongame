import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { MOCK_PORT } from './ports';

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
test.afterAll(async () => {
  mock?.kill();
  await new Promise((r) => setTimeout(r, 300));
  mock = null;
});

test('bad room code on load shows "No such room" without a join form', async ({ page }) => {
  await page.goto('/r/ZZZZZ');
  await expect(page.getByRole('heading', { name: 'No such room' })).toBeVisible();
  await expect(page.getByLabel('Your name')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
});

test('good code shows the room info line on the join screen, updated with players', async ({
  browser,
}) => {
  const hostCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostCtx.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'CREATE A ROOM' }).click();
  await host.waitForURL(/\/r\/[A-Z0-9]{5}$/);
  const code = host.url().split('/').pop()!;
  await expect(host.getByTestId('room-info')).toHaveText(`Room ${code} · 0/6 players · Classic`);
  await host.getByLabel('Your name').fill('Sam');
  await host.getByRole('button', { name: 'JOIN THE ROOM' }).click();
  await expect(host.getByRole('heading', { name: new RegExp(`Room ${code}`) })).toBeVisible();

  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guest = await guestCtx.newPage();
  await guest.goto(`/r/${code}`);
  await expect(guest.getByTestId('room-info')).toHaveText(
    `Room ${code} · 1/6 players · Classic · Host Sam`,
  );
  expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await hostCtx.close();
  await guestCtx.close();
});

test('info fetch failure falls back to the plain join form', async ({ page }) => {
  await page.route('**/api/rooms/*/info', (route) => route.abort());
  await page.goto('/r/DBAYS');
  await expect(page.getByLabel('Your name')).toBeVisible();
  await expect(page.getByTestId('room-info')).toHaveCount(0);
});
