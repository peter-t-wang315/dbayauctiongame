// Room Durable Object: a thin wrapper that runs @dbay/room-core (05 sections 7-12).
// Wrapper order is fixed: reduce -> persist -> setAlarm -> send (the reducer emits effects in that order).
// The wrapper is the only caller of Date.now(), crypto and DO storage.
import { type ClientMsg, type ServerMsg, parseClientFrame } from '@dbay/protocol';
import {
  type Effect,
  type RateState,
  type RoomEvent,
  type RoomState,
  createRoom,
  isCompatible,
  newRateState,
  rateLimit,
  reduce,
  roomNotFound,
  SCHEMA_VERSION,
} from '@dbay/room-core';
import { Server, type Connection, type WSMessage } from 'partyserver';
import { randomHex, sha256Hex } from './crypto';
import type { Env } from './env';

/** WebSocket close codes (4000 = kicked is relied on by the web client, ws4 notes). */
export const CLOSE = {
  kicked: 4000,
  replaced: 4001,
  expired: 4002,
  banned: 4003,
  rateLimited: 4008,
  notFound: 4004,
  deploy: 4005,
} as const;

interface ConnState {
  playerId?: string;
}

const STATE_KEY = `state:v${SCHEMA_VERSION}`;

export class Room extends Server<Env> {
  static override options = { hibernate: true };

  /** Authoritative state; null = no room here (never created, expired, or deleted). */
  private state: RoomState | null = null;
  /** True when storage holds a room written by an incompatible build. */
  private incompatible = false;
  /** Per-connection rate counters (memory only; reset on wake, which is fine). */
  private rates = new Map<string, RateState>();

  override async onStart(): Promise<void> {
    // Answer the transport-level keepalive without waking the DO (05 section 6.6).
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS events (n INTEGER PRIMARY KEY, at INTEGER NOT NULL, json TEXT NOT NULL)',
    );
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<RoomState>(STATE_KEY);
      if (stored) {
        this.state = stored;
        return;
      }
      // A room written by another schema version lives under a different key: end it (no migrations).
      const other = await this.ctx.storage.list({ prefix: 'state:v', limit: 1 });
      if (other.size > 0) this.incompatible = true;
    });
  }

  // ------------------------------------------------------------------ HTTP (internal only)

  /** Reached only via the Worker's stub (public routing refuses non-WebSocket requests). */
  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.endsWith('/__init')) {
      if (this.state || this.incompatible) return new Response('exists', { status: 409 });
      this.state = createRoom(this.name, Date.now());
      await this.ctx.storage.put(STATE_KEY, this.state);
      await this.ctx.storage.setAlarm(this.state.deadlines[0]?.at ?? Date.now() + 3_600_000);
      this.log({ room: this.name, event: 'create', rev: 0 });
      return new Response(JSON.stringify({ code: this.name }), { status: 201 });
    }
    return new Response('Not found', { status: 404 });
  }

  // ------------------------------------------------------------------ sockets

  override onConnect(conn: Connection<ConnState>): void {
    this.rates.set(conn.id, newRateState(Date.now()));
    conn.setState({});
  }

  override async onMessage(conn: Connection<ConnState>, message: WSMessage): Promise<void> {
    const now = Date.now();
    const rl = rateLimit(this.rates.get(conn.id) ?? newRateState(now), now);
    this.rates.set(conn.id, rl.state);
    if (rl.verdict === 'close') {
      conn.close(CLOSE.rateLimited, 'rate limited');
      return;
    }
    if (rl.verdict === 'limited') return this.sendTo(conn, { t: 'err', code: 'RATE_LIMITED' });
    if (typeof message !== 'string') return this.sendTo(conn, { t: 'err', code: 'BAD_MESSAGE' });

    const parsed = parseClientFrame(message);
    if (!parsed.ok) return this.sendTo(conn, { t: 'err', code: parsed.code });
    const msg = parsed.msg;

    if (msg.t === 'ping') return this.sendTo(conn, { t: 'pong', c: msg.c, now });

    // Joining / reconnecting: the room must exist.
    if (msg.t === 'join' || msg.t === 'hello') {
      if (this.incompatible || (this.state && !isCompatible(this.state))) {
        this.sendTo(conn, { t: 'closing', reason: 'deploy' });
        conn.close(CLOSE.deploy, 'deploy');
        return;
      }
      if (!this.state) {
        this.runEffects(roomNotFound(conn.id));
        conn.close(CLOSE.notFound, 'not found');
        return;
      }
      if (conn.state?.playerId) return this.sendTo(conn, { t: 'err', code: 'BAD_MESSAGE' });
      if (msg.t === 'join') {
        const playerId = randomHex(8);
        const secret = randomHex(24);
        const secretHash = await sha256Hex(secret);
        this.apply(
          [
            {
              type: 'join',
              conn: conn.id,
              name: msg.name,
              playerId,
              secret,
              secretHash,
            },
          ],
          now,
        );
      } else {
        const secretHash = await sha256Hex(msg.secret);
        this.apply([{ type: 'hello', conn: conn.id, playerId: msg.playerId, secretHash }], now);
      }
      if (this.state.meta.closed) conn.close(CLOSE.notFound, 'not found');
      return;
    }

    const playerId = conn.state?.playerId;
    if (!playerId || !this.state) {
      return this.sendTo(conn, { t: 'err', code: this.state ? 'BAD_MESSAGE' : 'ROOM_NOT_FOUND' });
    }

    if (msg.t === 'snap') return this.apply([{ type: 'snap', playerId }], now);
    if (msg.t === 'leave') {
      this.apply([{ type: 'leave', playerId }], now);
      conn.close(1000, 'left');
      return;
    }
    const events: RoomEvent[] = [];
    // A fresh secret seed before every host start, including after a rematch (WS3a "For WS3b").
    if (msg.t === 'start' && this.state.meta.hostId === playerId) {
      events.push({ type: 'seed', seed: randomHex(16) });
    }
    events.push({ type: 'action', playerId, msg: msg as Extract<ClientMsg, { seq: number }> });
    this.apply(events, now);
  }

  override onClose(conn: Connection<ConnState>): void {
    this.rates.delete(conn.id);
    this.dropped(conn);
  }

  override onError(conn: Connection<ConnState>): void {
    this.rates.delete(conn.id);
    this.dropped(conn);
  }

  private dropped(conn: Connection<ConnState>): void {
    const playerId = conn.state?.playerId;
    if (!playerId || !this.state) return;
    // A replaced socket closing must not disconnect the seat's new socket.
    for (const c of this.getConnections<ConnState>()) {
      if (c.id !== conn.id && c.state?.playerId === playerId) return;
    }
    this.apply([{ type: 'disconnect', playerId }], Date.now());
  }

  // ------------------------------------------------------------------ alarm

  override onAlarm(): void {
    if (!this.state) return;
    const now = Date.now();
    this.apply([{ type: 'tick' }], now);
    // A tick that finds nothing due returns no effects (hence no setAlarm): always re-arm so an
    // early/spurious alarm can never leave the room without one (one alarm per DO, 05 section 9).
    const next = this.state?.deadlines[0]?.at;
    if (this.state && !this.state.meta.closed && next !== undefined) {
      void this.ctx.storage.setAlarm(Math.max(next, now + 10));
    }
  }

  // ------------------------------------------------------------------ reducer driver

  private apply(events: RoomEvent[], now: number = Date.now()): void {
    for (const ev of events) {
      if (!this.state) return;
      const res = reduce(this.state, ev, now);
      this.state = res.state;
      this.runEffects(res.effects, ev, now);
    }
  }

  /**
   * Execute effects: persist / setAlarm / log first (in the reducer's order), then sends, then socket
   * closes (so `kicked` / `closing` messages go out before the socket does), then deleteRoom.
   */
  private runEffects(effects: Effect[], ev?: RoomEvent, now: number = Date.now()): void {
    let del = false;
    const closes: Array<Extract<Effect, { type: 'closeSocket' }>> = [];
    const sends: Array<Extract<Effect, { type: 'send' }>> = [];
    for (const e of effects) {
      switch (e.type) {
        case 'persist':
          this.persist(ev, now);
          break;
        case 'setAlarm':
          if (e.at === null) void this.ctx.storage.deleteAlarm();
          else void this.ctx.storage.setAlarm(e.at);
          break;
        case 'log':
          this.log(e.entry);
          break;
        case 'send':
          sends.push(e);
          break;
        case 'closeSocket':
          closes.push(e);
          break;
        case 'deleteRoom':
          del = true;
          break;
        case 'broadcastSnapshots':
          break;
      }
    }
    for (const e of sends) this.deliver(e.to, e.msg);
    for (const c of closes) {
      for (const conn of this.getConnections<ConnState>()) {
        if (conn.state?.playerId !== c.playerId || conn.id === c.exceptConn) continue;
        conn.close(CLOSE[c.why], c.why);
      }
    }
    if (del) void this.wipe();
  }

  private persist(ev: RoomEvent | undefined, now: number): void {
    if (!this.state) return;
    // Synchronous write coalescing: DO storage writes are applied before outgoing messages are released.
    void this.ctx.storage.put(STATE_KEY, this.state);
    if (ev && ev.type !== 'seed' && ev.type !== 'hello' && ev.type !== 'join') {
      // Event log for replays: never includes secrets (join/hello carry them and are skipped) or the seed.
      this.ctx.storage.sql.exec(
        'INSERT INTO events (n, at, json) VALUES (?, ?, ?)',
        null,
        now,
        JSON.stringify(ev),
      );
    }
  }

  private async wipe(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    // Keep the closed marker in memory so any socket still open gets ROOM_NOT_FOUND; after eviction
    // there is no state at all, which answers the same way.
  }

  private deliver(to: Extract<Effect, { type: 'send' }>['to'], msg: ServerMsg): void {
    const data = JSON.stringify(msg);
    if (to === 'all') {
      for (const c of this.getConnections()) c.send(data);
      return;
    }
    if (typeof to === 'object') {
      const c = this.getConnection<ConnState>(to.conn);
      if (!c) return;
      if (msg.t === 'welcome') c.setState({ playerId: msg.playerId });
      c.send(data);
      return;
    }
    for (const c of this.getConnections<ConnState>()) {
      if (c.state?.playerId === to) c.send(data);
    }
  }

  private sendTo(conn: Connection, msg: ServerMsg): void {
    conn.send(JSON.stringify(msg));
  }

  private log(entry: { room: string; event: string; rev: number }): void {
    if (this.env.LOG_LEVEL === 'silent') return;
    console.log(JSON.stringify(entry));
  }
}
