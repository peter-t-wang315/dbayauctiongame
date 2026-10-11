import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backoffDelay, baseDelay } from './backoff';
import { ClockEstimator, estimateOffset, median, sampleFromPong } from './clock';
import { RevGate } from './rev';
import { RoomClient, type SocketLike } from './client';

describe('clock offset', () => {
  it('median handles odd, even and empty', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('computes offset = now + rtt/2 - recv', () => {
    // sent at 1000, received at 1100 (rtt 100), server said 5050 -> offset 5050 + 50 - 1100
    expect(sampleFromPong(1000, 1100, 5050)).toEqual({ rtt: 100, offset: 4000 });
  });

  it('uses the median of the 5 lowest-RTT samples, ignoring slow outliers', () => {
    const samples = [
      { rtt: 20, offset: 100 },
      { rtt: 25, offset: 102 },
      { rtt: 30, offset: 98 },
      { rtt: 35, offset: 101 },
      { rtt: 40, offset: 99 },
      { rtt: 900, offset: 5000 }, // congested sample, must not count
      { rtt: 800, offset: -3000 },
    ];
    expect(estimateOffset(samples)).toBe(100);
  });

  it('estimator converts local time to server time', () => {
    const c = new ClockEstimator();
    for (let i = 0; i < 6; i++) c.addPong(1000, 1040, 11_020); // rtt 40, offset 10_000
    expect(c.offset).toBe(10_000);
    expect(c.serverNow(2000)).toBe(12_000);
  });
});

describe('rev gating', () => {
  it('accepts the first snapshot and only strictly newer revs', () => {
    const g = new RevGate();
    expect(g.accept(5)).toBe(true);
    expect(g.accept(5)).toBe(false);
    expect(g.accept(4)).toBe(false);
    expect(g.accept(6)).toBe(true);
    expect(g.rev).toBe(6);
  });

  it('accepts any first snapshot after a reset (reconnect)', () => {
    const g = new RevGate();
    g.accept(50);
    g.reset();
    expect(g.accept(3)).toBe(true);
    expect(g.accept(0)).toBe(false);
  });

  it('accepts rev 0 as the very first snapshot', () => {
    expect(new RevGate().accept(0)).toBe(true);
  });
});

describe('reconnect backoff', () => {
  it('doubles from 500ms and caps at 5s', () => {
    expect([0, 1, 2, 3, 4, 5, 20].map((a) => baseDelay(a))).toEqual([
      500, 1000, 2000, 4000, 5000, 5000, 5000,
    ]);
  });

  it('jitters within +-25% and never leaves [500, 5000]', () => {
    for (let a = 0; a < 10; a++) {
      const lo = backoffDelay(a, () => 0);
      const hi = backoffDelay(a, () => 0.999999);
      expect(lo).toBeGreaterThanOrEqual(500);
      expect(hi).toBeLessThanOrEqual(5000);
      expect(lo).toBeLessThanOrEqual(hi);
    }
    expect(backoffDelay(1, () => 0.5)).toBe(1000);
    expect(backoffDelay(1, () => 0)).toBe(750);
  });
});

// ----- client behaviour with a fake socket -----

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  recv(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const view = (rev: number) =>
  ({
    code: 'ABCDE',
    phase: 'lobby',
    opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
    me: 'p1',
    hostId: 'p1',
    myHand: [],
    canAct: false,
    players: [],
    bays: [],
    round: { n: 0, of: 0, halfway: false, last: false },
    log: [],
    deckLeft: rev,
  }) as never;

function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('RoomClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.all = [];
    vi.stubGlobal('localStorage', makeStorage());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const make = () =>
    new RoomClient({
      code: 'ABCDE',
      url: 'ws://x/parties/room/ABCDE',
      createSocket: (u) => new FakeSocket(u),
      random: () => 0.5,
    });

  it('ignores stale snapshots and resets the gate after reconnect', () => {
    localStorage.setItem('dbay:id:ABCDE', JSON.stringify({ playerId: 'p1', secret: 's' }));
    const c = make();
    c.start();
    const s1 = FakeSocket.all[0]!;
    s1.open();
    expect(s1.sent[0]).toMatchObject({ t: 'hello', playerId: 'p1', secret: 's' });
    s1.recv({ t: 'snap', rev: 10, now: 1, view: view(10) });
    s1.recv({ t: 'snap', rev: 9, now: 1, view: view(9) });
    s1.recv({ t: 'snap', rev: 10, now: 1, view: view(10) });
    expect(c.getState().rev).toBe(10);
    expect((c.getState().view as unknown as { deckLeft: number }).deckLeft).toBe(10);

    s1.drop();
    expect(c.getState().status).toBe('reconnecting');
    vi.advanceTimersByTime(500);
    const s2 = FakeSocket.all[1]!;
    s2.open();
    s2.recv({ t: 'welcome', v: 1, playerId: 'p1', code: 'ABCDE' });
    s2.recv({ t: 'snap', rev: 2, now: 1, view: view(2) }); // lower rev, but first after reconnect
    expect(c.getState().rev).toBe(2);
    c.dispose();
  });

  it('reconnects with growing delays and resets the attempt count on success', () => {
    localStorage.setItem('dbay:id:ABCDE', JSON.stringify({ playerId: 'p1', secret: 's' }));
    const c = make();
    c.start();
    FakeSocket.all[0]!.open();
    FakeSocket.all[0]!.drop();
    vi.advanceTimersByTime(499);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(2);
    FakeSocket.all[1]!.drop(); // never opened this time
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(3);
    FakeSocket.all[2]!.open();
    expect(c.getState().attempt).toBe(0);
    c.dispose();
  });

  it('tracks seq/acks and never buffers while offline', async () => {
    localStorage.setItem('dbay:id:ABCDE', JSON.stringify({ playerId: 'p1', secret: 's' }));
    const c = make();
    c.start();
    const s = FakeSocket.all[0]!;
    s.open();
    const p = c.send({ t: 'start' });
    const sent = s.sent.find((m) => m.t === 'start')!;
    s.recv({ t: 'ack', seq: sent.seq, ok: false, code: 'NOT_ENOUGH_PLAYERS' });
    await expect(p).resolves.toEqual({ ok: false, code: 'NOT_ENOUGH_PLAYERS' });
    s.drop();
    await expect(c.send({ t: 'pass' })).resolves.toEqual({ ok: false, code: 'OFFLINE' });
    c.dispose();
  });

  it('clears the secret on BAD_SECRET and asks to join anew', () => {
    localStorage.setItem('dbay:id:ABCDE', JSON.stringify({ playerId: 'p1', secret: 'bad' }));
    const c = make();
    c.start();
    const s = FakeSocket.all[0]!;
    s.open();
    s.recv({ t: 'err', code: 'BAD_SECRET' });
    expect(localStorage.getItem('dbay:id:ABCDE')).toBeNull();
    expect(c.getState().needsJoin).toBe(true);
    c.join('Pat');
    expect(s.sent.at(-1)).toMatchObject({ t: 'join', name: 'Pat' });
    c.dispose();
  });

  it('treats repeated failures before ever opening as a missing room', () => {
    const c = make();
    c.start();
    for (let i = 0; i < 3; i++) {
      FakeSocket.all[i]!.drop();
      vi.advanceTimersByTime(5000);
    }
    expect(c.getState().fatal).toBe('notfound');
    c.dispose();
  });

  describe('room gone / unreachable', () => {
    const seat = () =>
      localStorage.setItem('dbay:id:ABCDE', JSON.stringify({ playerId: 'p1', secret: 's' }));
    const makeP = (probe: () => Promise<boolean>, extra: object = {}) =>
      new RoomClient({
        code: 'ABCDE',
        url: 'ws://x/parties/room/ABCDE',
        createSocket: (u) => new FakeSocket(u),
        random: () => 0.5,
        probe,
        ...extra,
      });
    /** Drop the latest socket without it ever opening, then run the backoff timer. */
    const failNext = async () => {
      FakeSocket.all.at(-1)!.drop();
      await vi.advanceTimersByTimeAsync(5000);
    };

    it('ROOM_NOT_FOUND on hello is terminal "gone" and clears the secret', () => {
      seat();
      const c = make();
      c.start();
      const s = FakeSocket.all[0]!;
      s.open();
      s.recv({ t: 'err', code: 'ROOM_NOT_FOUND' });
      expect(c.getState().fatal).toBe('gone');
      expect(localStorage.getItem('dbay:id:ABCDE')).toBeNull();
      vi.advanceTimersByTime(60_000);
      expect(FakeSocket.all).toHaveLength(1); // no more retries
      c.dispose();
    });

    it('ROOM_NOT_FOUND with no seat (typo on first visit) stays "notfound"', () => {
      const c = make();
      c.start();
      FakeSocket.all[0]!.open();
      FakeSocket.all[0]!.recv({ t: 'err', code: 'ROOM_NOT_FOUND' });
      expect(c.getState().fatal).toBe('notfound');
      c.dispose();
    });

    it('server reachable but websocket refused after being connected -> gone', async () => {
      seat();
      const c = makeP(async () => true);
      c.start();
      FakeSocket.all[0]!.open();
      FakeSocket.all[0]!.drop(); // transient drop: no strike
      await vi.advanceTimersByTimeAsync(500);
      await failNext();
      expect(c.getState().fatal).toBeNull(); // one strike
      await failNext();
      expect(c.getState().fatal).toBe('gone');
      expect(localStorage.getItem('dbay:id:ABCDE')).toBeNull();
      c.dispose();
    });

    it('server down (probe false) never means gone; gives up as unreachable after the time cap', async () => {
      seat();
      const c = makeP(async () => false, { giveUpMs: 20_000 });
      c.start();
      FakeSocket.all[0]!.open();
      FakeSocket.all[0]!.drop();
      for (let i = 0; i < 30 && !c.getState().unreachable; i++) await failNext();
      const st = c.getState();
      expect(st.fatal).toBeNull();
      expect(st.unreachable).toBe(true);
      const n = FakeSocket.all.length;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(FakeSocket.all).toHaveLength(n); // stopped
      c.dispose();
    });

    it('also gives up after the attempt cap, and retry() restarts the backoff', async () => {
      seat();
      const c = makeP(async () => false, { maxAttempts: 4 });
      c.start();
      FakeSocket.all[0]!.open();
      FakeSocket.all[0]!.drop();
      for (let i = 0; i < 10 && !c.getState().unreachable; i++) await failNext();
      expect(c.getState().unreachable).toBe(true);
      const n = FakeSocket.all.length;
      c.retry();
      expect(c.getState()).toMatchObject({ unreachable: false, attempt: 0 });
      expect(FakeSocket.all).toHaveLength(n + 1);
      // server is back with the room: seat restored
      const s = FakeSocket.all.at(-1)!;
      s.open();
      s.recv({ t: 'welcome', v: 1, playerId: 'p1', code: 'ABCDE' });
      s.recv({ t: 'snap', rev: 1, now: 1, view: view(1) });
      expect(c.getState()).toMatchObject({ status: 'open', unreachable: false, playerId: 'p1' });
      c.dispose();
    });

    it('a hidden tab pauses instead of giving up; becoming visible restarts', async () => {
      seat();
      let hidden = true;
      const c = makeP(async () => false, { maxAttempts: 3, isHidden: () => hidden });
      c.start();
      FakeSocket.all[0]!.open();
      FakeSocket.all[0]!.drop();
      for (let i = 0; i < 6; i++) await failNext();
      expect(c.getState().unreachable).toBe(false);
      const n = FakeSocket.all.length;
      hidden = false;
      c.resume();
      expect(FakeSocket.all).toHaveLength(n + 1);
      c.dispose();
    });

    it('a transient drop with the room still there recovers the seat', async () => {
      seat();
      const c = makeP(async () => true);
      c.start();
      FakeSocket.all[0]!.open();
      FakeSocket.all[0]!.drop();
      await vi.advanceTimersByTimeAsync(500);
      const s = FakeSocket.all[1]!;
      s.open();
      s.recv({ t: 'welcome', v: 1, playerId: 'p1', code: 'ABCDE' });
      s.recv({ t: 'snap', rev: 1, now: 1, view: view(1) });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(c.getState()).toMatchObject({ status: 'open', fatal: null, unreachable: false });
      c.dispose();
    });
  });
});
