import { PROTOCOL_VERSION, type ServerMsg } from '@dbay/protocol';
import { env, evictDurableObject, runDurableObjectAlarm } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it } from 'vitest';
import { Client, ORIGIN, createRoomCode, isErr, isSnap, isWelcome } from './helpers';

const open: Client[] = [];
async function client(code: string, origin = ORIGIN): Promise<Client> {
  const c = await Client.open(code, origin);
  open.push(c);
  return c;
}
afterEach(() => {
  // Storage isolation is per file: close sockets so DOs can settle (05 section 17 item 4).
  for (const c of open.splice(0)) {
    try {
      c.close();
    } catch {
      /* already closed */
    }
  }
});

const stubFor = (code: string) => env.Room.get(env.Room.idFromName(code));

describe('room server', () => {
  it('join -> welcome with secret -> snapshot with me/host/lobby', async () => {
    const code = await createRoomCode();
    expect(code).toMatch(/^[2-9A-Z]{5}$/);
    const c = await client(code);
    await c.join('Alice');
    const snap = c.lastSnap()!;
    expect(snap.view.phase).toBe('lobby');
    expect(snap.view.me).toBe(c.playerId);
    expect(snap.view.hostId).toBe(c.playerId);
    expect(c.secret.length).toBeGreaterThan(16);
    // The secret hash never leaves the server.
    expect(JSON.stringify(snap)).not.toContain('secretHash');
  });

  it('reconnect with secret restores the seat, after the DO was evicted; bad secret is rejected', async () => {
    const code = await createRoomCode();
    const a = await client(code);
    await a.join('Alice');
    a.close();
    await evictDurableObject(stubFor(code));

    const b = await client(code);
    b.send({ t: 'hello', v: PROTOCOL_VERSION, playerId: a.playerId, secret: a.secret });
    const w = await b.waitFor(isWelcome);
    expect(w.playerId).toBe(a.playerId);
    expect((await b.waitFor(isSnap)).view.me).toBe(a.playerId);

    const bad = await client(code);
    bad.send({ t: 'hello', v: PROTOCOL_VERSION, playerId: a.playerId, secret: 'nope' });
    expect((await bad.waitFor(isErr)).code).toBe('BAD_SECRET');
  });

  it('unknown room answers hello with ROOM_NOT_FOUND; bad origin and bad code are refused', async () => {
    const c = await client('ZZZZZ');
    c.send({ t: 'hello', v: PROTOCOL_VERSION, playerId: 'x', secret: 'y' });
    expect((await c.waitFor(isErr)).code).toBe('ROOM_NOT_FOUND');

    const badOrigin = await exports.default.fetch('https://x/parties/room/ZZZZZ', {
      headers: { Upgrade: 'websocket', Origin: 'http://evil.example' },
    });
    expect(badOrigin.status).toBe(403);
    const post = await exports.default.fetch('https://x/api/rooms', {
      method: 'POST',
      headers: { Origin: 'http://evil.example' },
    });
    expect(post.status).toBe(403);
    const badCode = await exports.default.fetch('https://x/parties/room/abc', {
      headers: { Upgrade: 'websocket', Origin: ORIGIN },
    });
    expect(badCode.status).toBe(404);
    expect((await exports.default.fetch('https://x/')).status).toBe(200);
  });

  it('oversized and malformed frames are rejected with BAD_MESSAGE', async () => {
    const code = await createRoomCode();
    const c = await client(code);
    c.send('x'.repeat(3000));
    expect((await c.waitFor(isErr)).code).toBe('BAD_MESSAGE');
    c.send({ t: 'nonsense' });
    await c.waitFor(
      (m): m is Extract<ServerMsg, { t: 'err' }> => m.t === 'err' && c.msgs.length > 1,
    );
  });

  it('host kick closes the victim with code 4000 after a kicked message', async () => {
    const code = await createRoomCode();
    const host = await client(code);
    await host.join('Host');
    const vic = await client(code);
    await vic.join('Victim');
    host.send({ t: 'kick', seq: 1, playerId: vic.playerId });
    await vic.waitFor((m): m is Extract<ServerMsg, { t: 'kicked' }> => m.t === 'kicked');
    expect(await vic.waitClosed()).toBe(4000);
  });

  it('two rapid join frames on one socket create one seat', async () => {
    const code = await createRoomCode();
    const c = await client(code);
    c.send({ t: 'join', v: PROTOCOL_VERSION, name: 'A' });
    c.send({ t: 'join', v: PROTOCOL_VERSION, name: 'B' });
    await c.waitFor(isSnap);
    await new Promise((r) => setTimeout(r, 300));
    expect(c.msgs.filter((m) => m.t === 'welcome')).toHaveLength(1);
    expect(c.msgs.some((m) => m.t === 'err' && m.code === 'BAD_MESSAGE')).toBe(true);
    expect(c.lastSnap()!.view.players).toHaveLength(1);
  });

  it('bid: human with 2 bots bids on their call; ack ok then a newer snapshot', async () => {
    const code = await createRoomCode();
    const h = await client(code);
    await h.join('Host');
    h.send({ t: 'setOpts', seq: 1, mode: 'classic' });
    h.send({ t: 'addBot', seq: 2 });
    h.send({ t: 'addBot', seq: 3 });
    h.send({ t: 'start', seq: 4 });
    const mine = await h.waitFor(
      (m): m is Extract<ServerMsg, { t: 'snap' }> =>
        m.t === 'snap' &&
        m.view.phase === 'playing' &&
        m.view.canAct &&
        m.view.bays[0]?.card !== null,
      60_000,
    );
    const card = mine.view.myHand.find((c) => c.kind === 'value')!;
    h.send({ t: 'bid', seq: 5, card: card.id, bay: 0 });
    const ack = await h.waitFor(
      (m): m is Extract<ServerMsg, { t: 'ack' }> => m.t === 'ack' && m.seq === 5,
    );
    expect(ack.ok).toBe(true);
    const next = await h.waitFor(
      (m): m is Extract<ServerMsg, { t: 'snap' }> => m.t === 'snap' && m.rev > mine.rev,
    );
    expect(next.view.bays[0]!.stack.some((s) => s.card === card.id)).toBe(true);
  });

  it('alarm after eviction: bots act on the DO alarm and the game proceeds', async () => {
    const code = await createRoomCode();
    const h = await client(code);
    await h.join('Host');
    h.send({ t: 'addBot', seq: 1 });
    h.send({ t: 'addBot', seq: 2 });
    h.send({ t: 'start', seq: 3 });
    await h.waitFor(
      (m): m is Extract<ServerMsg, { t: 'snap' }> => m.t === 'snap' && m.view.phase === 'playing',
    );
    // Wake the DO from cold: the alarm must load state from storage and keep driving bots.
    await evictDurableObject(stubFor(code));
    const h2 = await client(code);
    h2.send({ t: 'hello', v: PROTOCOL_VERSION, playerId: h.playerId, secret: h.secret });
    await h2.waitFor(isSnap);
    const seen = h2.msgs.length;
    for (let i = 0; i < 60 && h2.msgs.length === seen; i++) {
      await new Promise((r) => setTimeout(r, 250));
      await runDurableObjectAlarm(stubFor(code));
    }
    expect(h2.msgs.length).toBeGreaterThan(seen);
  });
});
