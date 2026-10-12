// Plays a full bot game against a running server (`pnpm dev:server`). Usage:
//   node scripts/smoke.mjs [host=localhost:8787] [mode=frenzy|classic]
// One human (passive) + two bots; resolves when the game reaches reveal/ended.
import WebSocket from 'ws';

const host = process.argv[2] ?? 'localhost:8787';
const mode = process.argv[3] ?? 'frenzy';
const origin = process.env.SMOKE_ORIGIN ?? 'http://localhost:3000';

const res = await fetch(`http://${host}/api/rooms`, {
  method: 'POST',
  headers: { Origin: origin },
});
if (res.status !== 201) throw new Error(`create failed: ${res.status}`);
const { code } = await res.json();
console.log('room', code);

const ws = new WebSocket(`ws://${host}/parties/room/${code}`, { headers: { Origin: origin } });
let seq = 0;
const send = (m) => ws.send(JSON.stringify(m));
const t0 = Date.now();
let phase = '';
ws.on('open', () => send({ t: 'join', v: 2, name: 'Smoke' }));
ws.on('message', (data) => {
  const m = JSON.parse(data.toString());
  if (m.t === 'err') throw new Error(`server error ${m.code}`);
  if (m.t !== 'snap') return;
  const v = m.view;
  if (v.phase !== phase) {
    phase = v.phase;
    console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s phase ${phase}`);
    if (phase === 'lobby') {
      send({ t: 'setOpts', seq: ++seq, mode, length: 'quick' });
      send({ t: 'addBot', seq: ++seq });
      send({ t: 'addBot', seq: ++seq });
      send({ t: 'start', seq: ++seq });
    }
    if (phase === 'reveal' || phase === 'ended') {
      console.log(
        'players',
        v.players.length,
        'reveal totals',
        v.reveal?.players.map((p) => p.total),
      );
      ws.close();
      process.exit(0);
    }
  }
});
ws.on('close', () => process.exit(1));
setTimeout(() => {
  console.error('timeout in phase', phase);
  process.exit(2);
}, 10 * 60_000);
