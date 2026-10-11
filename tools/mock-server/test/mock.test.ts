import { PROTOCOL_VERSION, ServerMsgSchema, type ClientMsg, type ServerMsg } from '@dbay/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { DEMO_CODE, startMockServer, type MockServer } from '../src/server';

let server: MockServer;
beforeAll(async () => {
  server = await startMockServer(0, () => {});
});
afterAll(() => server.close());

class Client {
  msgs: ServerMsg[] = [];
  ws: WebSocket;
  private seq = 0;
  constructor(code = DEMO_CODE) {
    this.ws = new WebSocket(`ws://localhost:${server.port}/parties/room/${code}`);
    this.ws.on('message', (d) => this.msgs.push(ServerMsgSchema.parse(JSON.parse(d.toString()))));
  }
  open() {
    return new Promise<void>(
      (res, rej) => (this.ws.once('open', () => res()), this.ws.once('error', rej)),
    );
  }
  send(msg: ClientMsg) {
    this.ws.send(JSON.stringify(msg));
  }
  act(msg: Record<string, unknown>) {
    this.send({ ...msg, seq: ++this.seq } as ClientMsg);
  }
  async waitFor<T extends ServerMsg>(pred: (m: ServerMsg) => m is T, ms = 3000): Promise<T> {
    const start = Date.now();
    for (;;) {
      const hit = this.msgs.find(pred);
      if (hit) {
        this.msgs = this.msgs.slice(this.msgs.indexOf(hit) + 1);
        return hit;
      }
      if (Date.now() - start > ms) throw new Error('timeout waiting for message');
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}
const isWelcome = (m: ServerMsg): m is Extract<ServerMsg, { t: 'welcome' }> => m.t === 'welcome';
const isSnap = (m: ServerMsg): m is Extract<ServerMsg, { t: 'snap' }> => m.t === 'snap';
const isErr = (m: ServerMsg): m is Extract<ServerMsg, { t: 'err' }> => m.t === 'err';
const snapWhere =
  (f: (s: Extract<ServerMsg, { t: 'snap' }>) => boolean) =>
  (m: ServerMsg): m is Extract<ServerMsg, { t: 'snap' }> =>
    isSnap(m) && f(m);

describe('mock server', () => {
  it('join -> welcome with secret -> lobby snapshot', async () => {
    const c = new Client();
    await c.open();
    c.send({ t: 'join', v: PROTOCOL_VERSION, name: 'Peter' });
    const w = await c.waitFor(isWelcome);
    expect(w.secret).toBeTruthy();
    const s = await c.waitFor(isSnap);
    expect(s.view.phase).toBe('lobby');
    expect(s.view.me).toBe(w.playerId);
    c.ws.close();
  });

  it('host adds bots, starts Classic, and reconnects with hello', async () => {
    const res = await fetch(`http://localhost:${server.port}/api/rooms`, { method: 'POST' });
    const { code } = (await res.json()) as { code: string };
    const c = new Client(code);
    await c.open();
    c.send({ t: 'join', v: PROTOCOL_VERSION, name: 'Host' });
    const w = await c.waitFor(isWelcome);
    c.act({ t: 'addBot' });
    c.act({ t: 'addBot' });
    c.act({ t: 'start' });
    const playing = await c.waitFor(snapWhere((s) => s.view.phase === 'playing'));
    expect(playing.view.bays).toHaveLength(3);
    expect(playing.view.turn).toBeDefined();
    expect(playing.view.myHand).toHaveLength(12);
    c.ws.close();

    const again = new Client(code);
    await again.open();
    again.send({ t: 'hello', v: PROTOCOL_VERSION, playerId: w.playerId, secret: w.secret! });
    const w2 = await again.waitFor(isWelcome);
    expect(w2.secret).toBeUndefined();
    const s2 = await again.waitFor(isSnap);
    expect(s2.view.phase).toBe('playing');
    again.ws.close();
  });

  it('Frenzy gives every bay a timer', async () => {
    const res = await fetch(`http://localhost:${server.port}/api/rooms`, { method: 'POST' });
    const { code } = (await res.json()) as { code: string };
    const c = new Client(code);
    await c.open();
    c.send({ t: 'join', v: PROTOCOL_VERSION, name: 'Host' });
    await c.waitFor(isWelcome);
    c.act({ t: 'setOpts', mode: 'frenzy' });
    for (let i = 0; i < 4; i++) c.act({ t: 'addBot' });
    c.act({ t: 'start' });
    const s = await c.waitFor(snapWhere((x) => x.view.phase === 'playing'));
    expect(s.view.bays).toHaveLength(4);
    expect(s.view.bays.every((b) => typeof b.endsAt === 'number')).toBe(true);
    c.ws.close();
  });

  it('rejects a bad secret', async () => {
    const c = new Client();
    await c.open();
    c.send({ t: 'hello', v: PROTOCOL_VERSION, playerId: 'p1', secret: 'wrong' });
    expect((await c.waitFor(isErr)).code).toBe('BAD_SECRET');
    c.ws.close();
  });

  it('404s an unknown room', async () => {
    const c = new Client('ZZZZZ');
    await expect(c.open()).rejects.toThrow();
  });
});
