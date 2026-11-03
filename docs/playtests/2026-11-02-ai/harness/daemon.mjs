// One headless browser per player, driven over HTTP by pt.mjs.
// Usage: node daemon.mjs <name> <port> <width> <height>
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [name, port, w, h] = process.argv.slice(2);
const REPO = 'C:/Users/wangt/Documents/projects/ebaytheauctiongame';
const req = createRequire(path.join(REPO, 'apps/web/package.json'));
const { chromium } = req('@playwright/test');
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), 'shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, isMobile: +w < 600, hasTouch: +w < 600 });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/');

// Record every change of the status line so a player sees what happened while they waited.
const events = [];
let lastStatus = '';
let shot = 0;
setInterval(async () => {
  try {
    const s = (await page.locator('[data-fx="status-text"]').first().innerText({ timeout: 300 })).trim();
    if (s && s !== lastStatus) {
      lastStatus = s;
      events.push(`${new Date().toLocaleTimeString()}  ${s}`);
    }
  } catch {}
}, 400);
let eventsSeen = 0;

async function myTurnish() {
  return page.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getClientRects().length > 0);
    if (vis('[data-fx="turn-frame"]') || vis('[data-fx="turn-banner"][data-mine="true"]')) return 'YOUR TURN';
    if (vis('.g-gift__pick:not([disabled])')) return 'GIFT CHOICE NEEDED';
    if (vis('[data-fx="reveal"]')) return 'REVEAL / RESULTS';
    return '';
  });
}

async function look() {
  const file = path.join(OUT, `${name}-${String(++shot).padStart(3, '0')}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  const info = await page.evaluate(() => {
    document.querySelectorAll('[data-pt-ref]').forEach((e) => e.removeAttribute('data-pt-ref'));
    const els = [
      ...document.querySelectorAll(
        'button, a[href], input, select, [role="button"], [data-fx="hand-card"], [data-fx="bay"]',
      ),
    ].filter((e) => e.getClientRects().length > 0);
    const seen = new Set();
    const refs = [];
    for (const e of els) {
      if (seen.has(e)) continue;
      seen.add(e);
      const n = refs.length + 1;
      e.setAttribute('data-pt-ref', String(n));
      const fx = e.getAttribute('data-fx');
      const label = (e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 90);
      const st = e.getAttribute('data-state');
      const dis = e.disabled || e.getAttribute('aria-disabled') === 'true';
      const kind = fx === 'hand-card' ? 'CARD' : fx === 'bay' ? 'BAY' : e.tagName === 'INPUT' ? `INPUT(${e.type})` : 'BTN';
      refs.push(`[${n}] ${kind}${st ? ` {${st}}` : ''}${dis ? ' (disabled)' : ''}${e.checked ? ' (checked)' : ''} ${label}`);
    }
    const text = document.body.innerText.replace(/\n{2,}/g, '\n').trim().slice(0, 3000);
    return { url: location.pathname, text, refs };
  });
  const turn = await myTurnish();
  const newEvents = events.slice(eventsSeen);
  eventsSeen = events.length;
  return [
    `STATE: ${turn || 'waiting'}   url=${info.url}`,
    `SCREENSHOT: ${file}`,
    newEvents.length ? `--- events since last look ---\n${newEvents.slice(-25).join('\n')}` : '',
    `--- screen text ---\n${info.text}`,
    `--- interactive (use the [n] with click/type) ---\n${info.refs.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function waitTurn(maxMs) {
  const until = Date.now() + maxMs;
  while (Date.now() < until) {
    if (await myTurnish().catch(() => '')) break;
    await page.waitForTimeout(700);
  }
  return look();
}

const ref = (n) => page.locator(`[data-pt-ref="${n}"]`);

http
  .createServer(async (rq, rs) => {
    const u = new URL(rq.url, 'http://x');
    const op = u.searchParams.get('op');
    const a = u.searchParams.get('a') ?? '';
    const b = u.searchParams.get('b') ?? '';
    let out;
    try {
      if (op === 'look') out = await look();
      else if (op === 'wait') out = await waitTurn(Math.min(+a || 240000, 280000));
      else if (op === 'click') {
        await ref(a).click({ timeout: 3000, force: true });
        await page.waitForTimeout(700);
        out = await look();
      } else if (op === 'type') {
        await ref(a).fill(b, { timeout: 3000 });
        out = await look();
      } else if (op === 'press') {
        await page.keyboard.press(a);
        await page.waitForTimeout(700);
        out = await look();
      } else if (op === 'goto') {
        await page.goto(a.startsWith('http') ? a : `http://localhost:3000${a}`);
        await page.waitForTimeout(1500);
        out = await look();
      } else out = 'ops: look | wait [ms] | click <n> | type <n> <text> | press <Key> | goto <path>';
    } catch (e) {
      out = `ERROR: ${String(e.message).split('\n')[0]}\n\n${await look().catch(() => '')}`;
    }
    rs.end(out);
  })
  .listen(+port, () => console.log(`${name} ready on ${port}`));
