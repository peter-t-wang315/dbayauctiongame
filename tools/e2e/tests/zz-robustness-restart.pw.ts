import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { banner, bayState, reconnecting, startGame, twoPlayers } from './helpers';

// Scenario 4: the server process dies mid-game and comes back (docs/05 section 8/12: room state is
// DO SQLite storage, which `wrangler dev` persists under apps/server/.wrangler/state). Expected:
// clients show the reconnecting overlay, then the room RESUMES (same seats, game continues).
// This file sorts last on purpose: it kills the Playwright-started Worker and runs its own copy.
// Only processes whose command line carries THIS run's `--port <E2E_SERVER_PORT>` are touched.
test.describe.configure({ timeout: 360_000 });

const SERVER_PORT = Number(process.env.E2E_SERVER_PORT ?? 8788);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3200);
const serverDir = path.resolve(import.meta.dirname, '../../../apps/server');

function killServerTree(): void {
  // Top-most shell of `pnpm exec wrangler dev ... --port <N>`; /T takes workerd with it.
  const script =
    `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'wrangler dev' -and ` +
    `$_.CommandLine -match '--port ${SERVER_PORT} ' -and $_.Name -eq 'cmd.exe' } | ` +
    `ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }`;
  execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'ignore' });
}

async function waitForServer(up: boolean, ms = 90_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const ok = await fetch(`http://127.0.0.1:${SERVER_PORT}/`).then(
      () => true,
      () => false,
    );
    if (ok === up) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not go ${up ? 'up' : 'down'} in time`);
}

test('4. server restart mid-game: clients reconnect and the room resumes', async ({ browser }) => {
  test.skip(process.platform !== 'win32', 'process control below is Windows-specific');
  let restarted: ChildProcess | null = null;
  const { hctx, gctx, host, guest } = await twoPlayers(browser, 'Classic');
  try {
    await startGame(host, guest);
    await expect(banner(host)).toBeVisible();
    // Let the game get going so there is real state to lose.
    await host.waitForTimeout(8000);
    const before = await bayState(host);
    expect(before.length).toBeGreaterThan(0);

    killServerTree();
    await waitForServer(false);
    await expect(reconnecting(host)).toBeVisible({ timeout: 15_000 });
    await expect(reconnecting(guest)).toBeVisible({ timeout: 15_000 });

    restarted = spawn(
      `pnpm exec wrangler dev --ip 127.0.0.1 --port ${SERVER_PORT} --inspector-port ${SERVER_PORT + 1000}` +
        ` --var ALLOWED_ORIGINS:http://localhost:${WEB_PORT} --var CREATE_LIMIT_PER_HOUR:1000 --var JOIN_LIMIT_PER_MIN:600`,
      { cwd: serverDir, shell: true, stdio: 'ignore' },
    );
    await waitForServer(true);

    // Resumed: no fatal card, overlay gone, game screen back, both clients agree.
    await expect(reconnecting(host)).toHaveCount(0, { timeout: 30_000 });
    await expect(reconnecting(guest)).toHaveCount(0, { timeout: 30_000 });
    await expect(host.getByText('This room no longer exists')).toHaveCount(0);
    await expect(host.locator('[data-fx="status-strip"]')).toBeVisible();
    await expect(guest.locator('[data-fx="status-strip"]')).toBeVisible();
    await expect
      .poll(async () => JSON.stringify(await bayState(host)), { timeout: 15_000 })
      .toBe(JSON.stringify(await bayState(guest)));
    // The game is live after the restart: someone's turn banner is ticking and a human gets a turn.
    await expect(banner(host)).toBeVisible();
    await expect(
      host.locator('[data-fx="turn-banner"][data-mine="true"], [data-fx="turn-banner"]').first(),
    ).toBeVisible();
    const live = await Promise.race([
      host.locator('[data-fx="turn-banner"][data-mine="true"]').waitFor({ timeout: 90_000 }).then(() => 'host'),
      guest.locator('[data-fx="turn-banner"][data-mine="true"]').waitFor({ timeout: 90_000 }).then(() => 'guest'),
    ]);
    expect(live).toMatch(/host|guest/);
  } finally {
    await hctx.close();
    await gctx.close();
    if (restarted?.pid) {
      try {
        execFileSync('taskkill', ['/PID', String(restarted.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        /* already gone */
      }
    }
  }
});
