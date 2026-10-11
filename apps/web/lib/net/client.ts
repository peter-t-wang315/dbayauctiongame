// Framework-free room client: one WebSocket, hello/join, rev-gated snapshots, seq/ack tracking,
// clock sync, reconnect with backoff. React binds to it through useRoom.ts.
import {
  PROTOCOL_VERSION,
  parseServerFrame,
  type ClientAction,
  type ClientMsg,
  type ErrorCode,
  type PlayerView,
  type ServerMsg,
} from '@dbay/protocol';
import { clearIdentity, loadIdentity, saveIdentity, saveName } from '../identity';
import { backoffDelay } from './backoff';
import { ClockEstimator } from './clock';
import { RevGate } from './rev';

export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Terminal conditions: the client stops reconnecting and the UI shows a full-screen message. */
export type Fatal =
  | 'kicked'
  | 'banned'
  | 'expired'
  | 'ended'
  | 'notfound'
  | 'full'
  | 'started'
  | 'version';

export interface RoomState {
  status: ConnStatus;
  /** Latest accepted PlayerView, or null before the first snapshot. */
  view: PlayerView | null;
  rev: number;
  playerId: string | null;
  /** Socket is open but we have no seat: show the join form. */
  needsJoin: boolean;
  joining: boolean;
  fatal: Fatal | null;
  /** Last non-fatal server error (NAME_INVALID, BAD_SECRET, ...). Cleared by the next action. */
  error: { code: ErrorCode; msg?: string } | null;
  /** Consecutive failed reconnect attempts (0 while connected). */
  attempt: number;
}

export type SendResult = { ok: true } | { ok: false; code: ErrorCode | 'OFFLINE' | 'TIMEOUT' };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An action without its `seq`; the client assigns one. */
export type ActionInput = DistributiveOmit<ClientAction, 'seq'>;

/** The subset of WebSocket the client uses (lets tests inject a fake). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface RoomClientOptions {
  code: string;
  url: string;
  createSocket?: (url: string) => SocketLike;
  now?: () => number;
  random?: () => number;
}

const WS_OPEN = 1;
const PING_BURST = 8;
const PING_BURST_GAP_MS = 200;
const PING_EVERY_MS = 15_000;
const ACK_TIMEOUT_MS = 5000;
/** Connection failures before ever opening that we read as "no such room". */
const NEVER_OPENED_LIMIT = 3;
const KICK_CLOSE_CODE = 4000;

export class RoomClient {
  readonly code: string;
  readonly clock = new ClockEstimator();
  private readonly gate = new RevGate();
  private readonly url: string;
  private readonly createSocket: (url: string) => SocketLike;
  private readonly now: () => number;
  private readonly random: () => number;

  private socket: SocketLike | null = null;
  private state: RoomState;
  private listeners = new Set<() => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimers: ReturnType<typeof setTimeout>[] = [];
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pending = new Map<
    number,
    { resolve: (r: SendResult) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private pendingJoin: string | null = null;
  private hasBeenOpen = false;
  private failuresBeforeOpen = 0;
  private disposed = false;
  /** Seeded from the clock: the server dedups by highest seq, so a page refresh must not restart at 1. */
  private seq: number;

  constructor(opts: RoomClientOptions) {
    this.code = opts.code;
    this.url = opts.url;
    this.now = opts.now ?? Date.now;
    this.random = opts.random ?? Math.random;
    this.createSocket = opts.createSocket ?? ((u) => new WebSocket(u) as unknown as SocketLike);
    this.seq = this.now();
    this.state = {
      status: 'connecting',
      view: null,
      rev: 0,
      playerId: loadIdentity(opts.code)?.playerId ?? null,
      needsJoin: false,
      joining: false,
      fatal: null,
      error: null,
      attempt: 0,
    };
  }

  // ----- store API (useSyncExternalStore) -----

  getState = (): RoomState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<RoomState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** Estimated server time now, from the median clock offset. */
  serverNow(): number {
    return this.clock.serverNow(this.now());
  }

  // ----- lifecycle -----

  start(): void {
    if (this.disposed || this.socket) return;
    this.connect();
  }

  dispose(): void {
    this.disposed = true;
    this.teardownSocket();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.failPending('OFFLINE');
    this.listeners.clear();
  }

  /** Tab became visible / network is back: reconnect now, or ask for a fresh snapshot. */
  resume(): void {
    if (this.disposed || this.state.fatal) return;
    if (this.socket && this.socket.readyState === WS_OPEN) {
      this.raw({ t: 'snap' });
      return;
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (!this.socket) {
      this.set({ attempt: 0 });
      this.connect();
    }
  }

  /** First-time join (or re-join after BAD_SECRET). */
  join(name: string): void {
    saveName(name);
    this.set({ joining: true, error: null });
    if (this.socket && this.socket.readyState === WS_OPEN) this.raw({ t: 'join', v: PROTOCOL_VERSION, name });
    else {
      this.pendingJoin = name;
      this.resume();
    }
  }

  /** Leave the room for good: forget the seat and close. */
  leave(): void {
    this.raw({ t: 'leave' });
    clearIdentity(this.code);
    this.dispose();
  }

  /** Send an action and resolve with the server's ack. Never buffered while offline. */
  send(action: ActionInput): Promise<SendResult> {
    if (!this.socket || this.socket.readyState !== WS_OPEN)
      return Promise.resolve({ ok: false, code: 'OFFLINE' });
    const seq = ++this.seq;
    this.set({ error: null });
    return new Promise<SendResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        resolve({ ok: false, code: 'TIMEOUT' });
      }, ACK_TIMEOUT_MS);
      this.pending.set(seq, { resolve, timer });
      this.raw({ ...action, seq } as ClientMsg);
    });
  }

  // ----- internals -----

  private raw(msg: ClientMsg): void {
    if (this.socket && this.socket.readyState === WS_OPEN) this.socket.send(JSON.stringify(msg));
  }

  private connect(): void {
    if (this.disposed) return;
    this.set({ status: this.hasBeenOpen ? 'reconnecting' : 'connecting' });
    let sock: SocketLike;
    try {
      sock = this.createSocket(this.url);
    } catch {
      this.onClosed(0);
      return;
    }
    this.socket = sock;
    sock.onopen = () => {
      if (this.socket === sock) this.onOpen();
    };
    sock.onmessage = (ev) => {
      if (this.socket === sock && typeof ev.data === 'string') this.onFrame(ev.data);
    };
    sock.onerror = () => {};
    sock.onclose = (ev) => {
      if (this.socket !== sock) return;
      this.socket = null;
      this.onClosed(ev.code);
    };
  }

  private teardownSocket(): void {
    this.stopPings();
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.onopen = s.onmessage = s.onclose = s.onerror = null;
      try {
        s.close();
      } catch {
        /* already closed */
      }
    }
  }

  private onOpen(): void {
    this.hasBeenOpen = true;
    this.failuresBeforeOpen = 0;
    this.gate.reset();
    this.set({ status: 'open', attempt: 0 });
    const id = loadIdentity(this.code);
    if (id) {
      this.raw({
        t: 'hello',
        v: PROTOCOL_VERSION,
        playerId: id.playerId,
        secret: id.secret,
        lastRev: this.state.rev,
      });
    } else if (this.pendingJoin !== null) {
      const name = this.pendingJoin;
      this.pendingJoin = null;
      this.raw({ t: 'join', v: PROTOCOL_VERSION, name });
    } else {
      this.set({ needsJoin: true });
    }
    this.startPings();
  }

  private onClosed(code: number): void {
    this.stopPings();
    this.failPending('OFFLINE');
    if (this.disposed) return;
    if (code === KICK_CLOSE_CODE) return this.fatal('kicked');
    if (this.state.fatal) return;
    if (!this.hasBeenOpen) {
      this.failuresBeforeOpen++;
      if (this.failuresBeforeOpen >= NEVER_OPENED_LIMIT) return this.fatal('notfound');
    }
    const attempt = this.state.attempt;
    this.set({ status: this.hasBeenOpen ? 'reconnecting' : 'connecting', attempt: attempt + 1 });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, backoffDelay(attempt, this.random));
  }

  private fatal(reason: Fatal): void {
    if (reason === 'kicked' || reason === 'banned') clearIdentity(this.code);
    this.teardownSocket();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.failPending('OFFLINE');
    this.set({ fatal: reason, status: 'closed', joining: false, needsJoin: false });
  }

  private failPending(code: 'OFFLINE'): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, code });
    }
    this.pending.clear();
  }

  private onFrame(raw: string): void {
    const parsed = parseServerFrame(raw);
    if (!parsed.ok) return; // non-protocol frames (e.g. transport keepalive) are ignored
    this.onMsg(parsed.msg);
  }

  private onMsg(msg: ServerMsg): void {
    switch (msg.t) {
      case 'welcome':
        if (msg.secret) saveIdentity(this.code, { playerId: msg.playerId, secret: msg.secret });
        this.gate.reset();
        this.set({ playerId: msg.playerId, needsJoin: false, joining: false, error: null });
        return;
      case 'snap': {
        if (!this.gate.accept(msg.rev)) return;
        if (this.clock.count === 0) this.clock.add({ rtt: 1000, offset: msg.now - this.now() });
        this.set({ view: msg.view, rev: msg.rev, playerId: msg.view.me });
        return;
      }
      case 'ack': {
        const p = this.pending.get(msg.seq);
        if (!p) return;
        clearTimeout(p.timer);
        this.pending.delete(msg.seq);
        if (msg.ok) p.resolve({ ok: true });
        else {
          this.set({ error: { code: msg.code, msg: msg.msg } });
          p.resolve({ ok: false, code: msg.code });
        }
        return;
      }
      case 'pong': {
        this.clock.addPong(msg.c, this.now(), msg.now);
        return;
      }
      case 'kicked':
        return this.fatal('kicked');
      case 'closing':
        if (msg.reason === 'expired') return this.fatal('expired');
        if (msg.reason === 'ended') return this.fatal('ended');
        if (msg.reason === 'banned') return this.fatal('banned');
        return; // deploy: the socket closes next and we reconnect
      case 'err':
        return this.onErr(msg.code, msg.msg);
    }
  }

  private onErr(code: ErrorCode, msg?: string): void {
    switch (code) {
      case 'ROOM_NOT_FOUND':
        return this.fatal('notfound');
      case 'ROOM_FULL':
        return this.fatal('full');
      case 'GAME_IN_PROGRESS':
        return this.fatal('started');
      case 'BANNED':
        return this.fatal('banned');
      case 'ROOM_EXPIRED':
        return this.fatal('expired');
      case 'VERSION_MISMATCH':
        return this.fatal('version');
      case 'BAD_SECRET':
        // The stored seat is no longer valid: forget it and offer to join anew (05 section 11).
        clearIdentity(this.code);
        this.set({ playerId: null, needsJoin: true, joining: false, error: { code, msg } });
        return;
      default:
        this.set({ joining: false, error: { code, msg } });
    }
  }

  // ----- pings (05 section 6.6) -----

  private ping(): void {
    this.raw({ t: 'ping', c: this.now() });
  }

  private startPings(): void {
    this.stopPings();
    for (let i = 0; i < PING_BURST; i++) {
      this.pingTimers.push(setTimeout(() => this.ping(), i * PING_BURST_GAP_MS));
    }
    this.pingInterval = setInterval(() => this.ping(), PING_EVERY_MS);
  }

  private stopPings(): void {
    for (const t of this.pingTimers) clearTimeout(t);
    this.pingTimers = [];
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
  }
}
