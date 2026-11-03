import { PROTOCOL_VERSION, type ServerMsg } from '@dbay/protocol';
import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from 'cloudflare:test';
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
  it('runs with DO logging silenced (avoids vitest onUserConsoleLog teardown race)', () => {
    expect(env.LOG_LEVEL).toBe('silent');
  });

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

  it('GET /api/rooms/:code/info: public summary, no secrets; 404 for unknown/malformed; origin checked', async () => {
    const info = (code: string, origin: string | null = ORIGIN) =>
      exports.default.fetch(`https://x/api/rooms/${code}/info`, {
        headers: origin ? { Origin: origin } : {},
      });
    const code = await createRoomCode();
    const fresh = await info(code);
    expect(fresh.status).toBe(200);
    expect(fresh.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(await fresh.json()).toEqual({
      exists: true,
      phase: 'lobby',
      players: 0,
      maxPlayers: 6,
      mode: 'classic',
    });

    const c = await client(code);
    c.send({ t: 'join', v: PROTOCOL_VERSION, name: 'Sam' });
    const w = await c.waitFor(isWelcome);
    const res = await info(code);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      exists: true,
      phase: 'lobby',
      players: 1,
      maxPlayers: 6,
      mode: 'classic',
      hostName: 'Sam',
    });
    expect(text).not.toContain(w.secret);
    expect(text).not.toContain(w.playerId);

    const unknown = await info('ZZZZZ');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ exists: false });
    expect((await info('abc')).status).toBe(404);
    expect((await info(code, 'http://evil.example')).status).toBe(403);
    expect((await info(code, null)).status).toBe(403);
    const post = await exports.default.fetch(`https://x/api/rooms/${code}/info`, {
      method: 'POST',
      headers: { Origin: ORIGIN },
    });
    expect(post.status).toBe(405);
    expect(post.headers.get('Cache-Control')).toBe('no-store');
    expect(unknown.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('malformed percent-encoding in the code is a 404, not a crash (info and websocket routes)', async () => {
    const info = await exports.default.fetch('https://x/api/rooms/%ZZ/info', {
      headers: { Origin: ORIGIN },
    });
    expect(info.status).toBe(404);
    expect(await info.json()).toEqual({ exists: false });
    const ws = await exports.default.fetch('https://x/parties/room/%ZZ', {
      headers: { Upgrade: 'websocket', Origin: ORIGIN },
    });
    expect(ws.status).toBe(404);
  });

  it('info lookups are rate limited per IP (429, no-store)', async () => {
    let last = 200;
    let cacheControl: string | null = null;
    for (let i = 0; i < 30 && last !== 429; i++) {
      const r = await exports.default.fetch('https://x/api/rooms/ZZZZY/info', {
        headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.9' },
      });
      last = r.status;
      cacheControl = r.headers.get('Cache-Control');
    }
    expect(last).toBe(429);
    expect(cacheControl).toBe('no-store');
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
        m.view.bays.some((b) => b.card !== null),
      60_000,
    );
    // Pick a pair that is legal now: bots may already have bid, so prefer an
    // empty bay; otherwise beat a value top with our highest value card.
    const values = mine.view.myHand
      .filter((c) => c.kind === 'value')
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    let bay = mine.view.bays.findIndex((b) => b.card !== null && b.stack.length === 0);
    let card = values[values.length - 1]!;
    if (bay < 0) {
      card = values[0]!;
      bay = mine.view.bays.findIndex((b) => {
        const top = b.stack[b.stack.length - 1];
        return b.card !== null && top?.kind === 'value' && (top.value ?? 0) < (card.value ?? 0);
      });
    }
    expect(bay).toBeGreaterThanOrEqual(0);
    h.send({ t: 'bid', seq: 5, card: card.id, bay });
    const ack = await h.waitFor(
      (m): m is Extract<ServerMsg, { t: 'ack' }> => m.t === 'ack' && m.seq === 5,
    );
    expect(ack).toMatchObject({ ok: true }); // shows the reject code if it fails
    const next = await h.waitFor(
      (m): m is Extract<ServerMsg, { t: 'snap' }> => m.t === 'snap' && m.rev > mine.rev,
    );
    expect(next.view.bays[bay]!.stack.some((s) => s.card === card.id)).toBe(true);
  });

  it('cold start marks humans with no live socket disconnected (stale connected flag)', async () => {
    const code = await createRoomCode();
    const a = await client(code);
    await a.join('Ann');
    const b = await client(code);
    await b.join('Bob');
    b.close();
    // Wait for Bob's disconnect to reach Ann.
    for (let i = 0; i < 40; i++) {
      const v = a.lastSnap()!.view;
      if (v.players.find((p) => p.id === b.playerId)?.connected === false) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    // Simulate a crash that skipped Bob's close handling: storage says Bob is still connected.
    await runInDurableObject(stubFor(code), async (_inst, state) => {
      const key = [...(await state.storage.list({ prefix: 'state:v' })).keys()][0]!;
      const s = (await state.storage.get(key)) as {
        players: Array<{ id: string; connected: boolean }>;
      };
      s.players.find((p) => p.id === b.playerId)!.connected = true;
      await state.storage.put(key, s);
    });
    await evictDurableObject(stubFor(code));
    // Ask for a fresh snapshot (it wakes the DO) and read the newest one after the request.
    const before = a.msgs.length;
    a.send({ t: 'snap' });
    await new Promise((r) => setTimeout(r, 1000));
    const fresh = a.msgs.slice(before).filter(isSnap);
    expect(fresh.length).toBeGreaterThan(0);
    const view = fresh[fresh.length - 1]!.view;
    expect(view.players.find((p) => p.id === b.playerId)?.connected).toBe(false);
    expect(view.players.find((p) => p.id === a.playerId)?.connected).toBe(true);
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
