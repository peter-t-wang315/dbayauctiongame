import { exports } from 'cloudflare:workers';
import { PROTOCOL_VERSION, type ServerMsg } from '@dbay/protocol';

export const ORIGIN = 'http://localhost:3000';

export async function createRoomCode(): Promise<string> {
  const res = await exports.default.fetch('https://x/api/rooms', {
    method: 'POST',
    headers: { Origin: ORIGIN },
  });
  if (res.status !== 201) throw new Error(`create failed ${res.status}`);
  return ((await res.json()) as { code: string }).code;
}

export class Client {
  msgs: ServerMsg[] = [];
  closed: { code: number } | null = null;
  playerId = '';
  secret = '';
  private waiters: Array<() => void> = [];
  private constructor(private ws: WebSocket) {
    ws.addEventListener('message', (e) => {
      this.msgs.push(JSON.parse(e.data as string) as ServerMsg);
      this.waiters.splice(0).forEach((w) => w());
    });
    ws.addEventListener('close', (e) => {
      this.closed = { code: e.code };
      this.waiters.splice(0).forEach((w) => w());
    });
  }

  static async open(code: string, origin = ORIGIN): Promise<Client> {
    const res = await exports.default.fetch(`https://x/parties/room/${code}`, {
      headers: { Upgrade: 'websocket', Origin: origin },
    });
    const ws = res.webSocket;
    if (!ws) throw new Error(`no websocket, status ${res.status}`);
    ws.accept();
    return new Client(ws as unknown as WebSocket);
  }

  send(m: unknown): void {
    this.ws.send(typeof m === 'string' ? m : JSON.stringify(m));
  }

  close(): void {
    this.ws.close(1000);
  }

  async waitFor<T extends ServerMsg>(
    pred: (m: ServerMsg) => m is T,
    timeoutMs = 10_000,
  ): Promise<T> {
    const start = Date.now();
    let from = 0;
    for (;;) {
      for (; from < this.msgs.length; from++) {
        const m = this.msgs[from]!;
        if (pred(m)) return m;
      }
      if (Date.now() - start > timeoutMs) throw new Error('timeout waiting for message');
      await new Promise<void>((r) => {
        this.waiters.push(r);
        setTimeout(r, 50);
      });
    }
  }

  async waitClosed(timeoutMs = 5000): Promise<number> {
    const start = Date.now();
    while (!this.closed) {
      if (Date.now() - start > timeoutMs) throw new Error('timeout waiting for close');
      await new Promise<void>((r) => {
        this.waiters.push(r);
        setTimeout(r, 50);
      });
    }
    return this.closed.code;
  }

  /** Latest snapshot view. */
  lastSnap(): Extract<ServerMsg, { t: 'snap' }> | undefined {
    for (let i = this.msgs.length - 1; i >= 0; i--) {
      const m = this.msgs[i]!;
      if (m.t === 'snap') return m;
    }
    return undefined;
  }

  async join(name: string): Promise<void> {
    this.send({ t: 'join', v: PROTOCOL_VERSION, name });
    const w = await this.waitFor(
      (m): m is Extract<ServerMsg, { t: 'welcome' }> => m.t === 'welcome',
    );
    this.playerId = w.playerId;
    this.secret = w.secret ?? '';
    await this.waitFor((m): m is Extract<ServerMsg, { t: 'snap' }> => m.t === 'snap');
  }
}

export const isSnap = (m: ServerMsg): m is Extract<ServerMsg, { t: 'snap' }> => m.t === 'snap';
export const isErr = (m: ServerMsg): m is Extract<ServerMsg, { t: 'err' }> => m.t === 'err';
export const isWelcome = (m: ServerMsg): m is Extract<ServerMsg, { t: 'welcome' }> =>
  m.t === 'welcome';
