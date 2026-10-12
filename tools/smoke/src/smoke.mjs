// Fast deploy smoke: create a room over HTTP, join it over WebSocket, assert the first snapshot.
// Usage: node src/smoke.mjs [host]
//   host   Worker host, scheme optional, e.g. localhost:8787 or dbay-server.<acct>.workers.dev
//          (env SMOKE_BASE_URL also accepted). Default localhost:8787.
//   SMOKE_ORIGIN  Origin header; must be in the Worker's ALLOWED_ORIGINS (default http://localhost:3000).
// For a whole bot game against a local server see apps/server/scripts/smoke.mjs.
import WebSocket from 'ws';

const raw = process.argv[2] ?? process.env.SMOKE_BASE_URL ?? 'localhost:8787';
const host = raw.replace(/^(https?|wss?):\/\//, '').replace(/\/+$/, '');
const local = /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/.test(host);
const origin = process.env.SMOKE_ORIGIN ?? 'http://localhost:3000';
const httpBase = `${local ? 'http' : 'https'}://${host}`;
const wsBase = `${local ? 'ws' : 'wss'}://${host}`;

function fail(msg) {
  console.error(`SMOKE FAIL: ${msg}`);
  process.exit(1);
}

const res = await fetch(`${httpBase}/api/rooms`, {
  method: 'POST',
  headers: { Origin: origin },
}).catch((e) => fail(`create request failed: ${e.message}`));
if (res.status !== 201)
  fail(`POST /api/rooms -> ${res.status} (check ALLOWED_ORIGINS vs SMOKE_ORIGIN)`);
const { code } = await res.json();
if (!/^[A-Z0-9]{4,8}$/.test(code ?? '')) fail(`bad room code ${JSON.stringify(code)}`);
console.log(`room ${code} created on ${host}`);

const ws = new WebSocket(`${wsBase}/parties/room/${code}`, { headers: { Origin: origin } });
const timer = setTimeout(() => fail('no snapshot within 15s'), 15_000);
ws.on('error', (e) => fail(`websocket error: ${e.message}`));
ws.on('open', () => ws.send(JSON.stringify({ t: 'join', v: 2, name: 'Smoke' })));
ws.on('message', (data) => {
  const m = JSON.parse(data.toString());
  if (m.t === 'err') fail(`server error ${m.code}`);
  if (m.t !== 'snap') return;
  if (m.view?.phase !== 'lobby') fail(`expected lobby, got ${m.view?.phase}`);
  if (!Array.isArray(m.view.players) || m.view.players.length !== 1)
    fail('expected exactly 1 player');
  clearTimeout(timer);
  console.log('SMOKE OK: joined, lobby snapshot with 1 player');
  ws.close();
  process.exit(0);
});
ws.on('close', () => fail('socket closed before snapshot'));
