import { describe, expect, it } from 'vitest';
import {
  ClientMsgSchema,
  MAX_INBOUND_BYTES,
  PROTOCOL_VERSION,
  ServerMsgSchema,
  normalizeRoomCode,
  parseClientFrame,
  parseServerFrame,
  type ClientMsg,
  type PlayerView,
  type ServerMsg,
} from '../src/index';

const v = PROTOCOL_VERSION;

// One valid fixture per client message type (05 section 6.1).
const validClient: Record<ClientMsg['t'], ClientMsg> = {
  join: { t: 'join', v, name: 'Peter' },
  hello: { t: 'hello', v, playerId: 'p1', secret: 's3cret', lastRev: 4 },
  ping: { t: 'ping', c: 1234.5 },
  snap: { t: 'snap' },
  leave: { t: 'leave' },
  bid: { t: 'bid', seq: 1, card: 'v100', bay: 2 },
  pass: { t: 'pass', seq: 2 },
  gift: { t: 'gift', seq: 3, target: 'p2' },
  giftGive: { t: 'giftGive', seq: 4, item: 'toys-pink-snake' },
  rename: { t: 'rename', seq: 5, name: 'Pat' },
  start: { t: 'start', seq: 6 },
  setOpts: { t: 'setOpts', seq: 7, mode: 'frenzy', relaxed: true, bidWindowMs: 8000 },
  addBot: { t: 'addBot', seq: 8 },
  rmBot: { t: 'rmBot', seq: 9, playerId: 'b1' },
  kick: { t: 'kick', seq: 10, playerId: 'p3' },
  rematch: { t: 'rematch', seq: 11 },
};

// At least one invalid fixture per client message type.
const invalidClient: Record<ClientMsg['t'], unknown[]> = {
  join: [{ t: 'join', v, name: '' }, { t: 'join', v, name: 'x'.repeat(17) }, { t: 'join', v, name: 'a\u0007b' }, { t: 'join', name: 'A' }],
  hello: [{ t: 'hello', v, playerId: 'p1' }, { t: 'hello', v, playerId: '', secret: 's' }],
  ping: [{ t: 'ping' }, { t: 'ping', c: 'now' }],
  snap: [{ t: 'snapshot' }],
  leave: [{ t: 'leav' }],
  bid: [{ t: 'bid', seq: 1, card: 'v100', bay: 4 }, { t: 'bid', seq: 0, card: 'v100', bay: 0 }, { t: 'bid', seq: 1, bay: 0 }],
  pass: [{ t: 'pass' }, { t: 'pass', seq: 1.5 }],
  gift: [{ t: 'gift', seq: 1 }],
  giftGive: [{ t: 'giftGive', seq: 1, item: '' }],
  rename: [{ t: 'rename', seq: 1, name: '   ' }],
  start: [{ t: 'start', seq: -1 }],
  setOpts: [{ t: 'setOpts', seq: 1, mode: 'turbo' }, { t: 'setOpts', seq: 1, bidWindowMs: 4000 }],
  addBot: [{ t: 'addBot' }],
  rmBot: [{ t: 'rmBot', seq: 1 }],
  kick: [{ t: 'kick', seq: 1, playerId: 7 }],
  rematch: [{ t: 'rematch', seq: 'one' }],
};

export const sampleView: PlayerView = {
  code: 'K7QMX',
  phase: 'playing',
  stage: 'bidding',
  opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
  me: 'p1',
  hostId: 'p1',
  myHand: [
    { id: 'v10', kind: 'value', value: 10 },
    { id: 'v150', kind: 'value', value: 150, onBay: 2 },
    { id: 'p1', kind: 'proxy' },
  ],
  canAct: true,
  players: [
    { id: 'p1', name: 'Peter', color: 'red', shape: '●', connected: true, isBot: false, cardsInHand: 3, collection: ['toys-pink-snake'], gifts: 0 },
    { id: 'p2', name: 'Pat', color: 'blue', shape: '▲', connected: true, isBot: false, cardsInHand: 9, collection: [], gifts: 1 },
    { id: 'b1', name: 'Bot Billy', color: 'yellow', shape: '■', connected: true, isBot: true, cardsInHand: 11, collection: [], gifts: 0 },
  ],
  bays: [
    { idx: 0, card: 'toys-bean-bag-bear', stack: [{ by: 'p2', card: 'v75', kind: 'value', value: 75 }], topBid: { by: 'p2', kind: 'value', value: 75 } },
    { idx: 1, card: 'special-gift-1', stack: [], topBid: null },
    { idx: 2, card: 'glass-crystal-swan', stack: [{ by: 'p1', card: 'v150', kind: 'value', value: 150 }], topBid: { by: 'p1', kind: 'value', value: 150 } },
  ],
  turn: { player: 'p1', color: 'red', endsAt: 1_700_000_005_000, phase: 'window' },
  round: { n: 7, of: 30, halfway: false, last: false },
  deckLeft: 9,
  log: [{ n: 41, kind: 'bid', by: 'p2', card: 'toys-bean-bag-bear', bay: 0, amount: 75 }],
};

const validServer: ServerMsg[] = [
  { t: 'welcome', v, playerId: 'p1', secret: 'abc', code: 'K7QMX' },
  { t: 'welcome', v, playerId: 'p1', code: 'K7QMX' },
  { t: 'snap', rev: 12, now: 1_700_000_000_000, view: sampleView },
  { t: 'ack', seq: 3, ok: true },
  { t: 'ack', seq: 3, ok: false, code: 'ILLEGAL_BID', msg: 'Beat $75' },
  { t: 'pong', c: 10, now: 1_700_000_000_000 },
  { t: 'kicked' },
  { t: 'closing', reason: 'expired' },
  { t: 'err', code: 'BAD_SECRET' },
];

const invalidServer: unknown[] = [
  { t: 'welcome', v, code: 'K7QMX' },
  { t: 'snap', rev: 1, now: 0, view: { ...sampleView, phase: 'paused' } },
  { t: 'snap', rev: 1, now: 0, view: { ...sampleView, players: [{ ...sampleView.players[0], color: 'orange' }] } },
  { t: 'ack', seq: 1, ok: false },
  { t: 'ack', seq: 1, ok: false, code: 'NOPE' },
  { t: 'closing', reason: 'bored' },
  { t: 'hello' },
];

describe('client messages', () => {
  for (const [t, msg] of Object.entries(validClient)) {
    it(`${t}: valid fixture round-trips`, () => {
      const r = parseClientFrame(JSON.stringify(msg));
      expect(r).toEqual({ ok: true, msg: ClientMsgSchema.parse(msg) });
    });
    it(`${t}: invalid fixtures are rejected`, () => {
      for (const bad of invalidClient[t as ClientMsg['t']]) {
        expect(parseClientFrame(JSON.stringify(bad))).toEqual({ ok: false, code: 'BAD_MESSAGE' });
      }
    });
  }

  it('trims names', () => {
    const r = parseClientFrame(JSON.stringify({ t: 'join', v, name: '  Sam  ' }));
    expect(r.ok && r.msg.t === 'join' && r.msg.name).toBe('Sam');
  });

  it('rejects non-JSON and oversized frames', () => {
    expect(parseClientFrame('{nope')).toEqual({ ok: false, code: 'BAD_MESSAGE' });
    const big = JSON.stringify({ t: 'ping', c: 1, pad: 'x'.repeat(MAX_INBOUND_BYTES) });
    expect(parseClientFrame(big)).toEqual({ ok: false, code: 'BAD_MESSAGE' });
  });

  it('rejects a protocol version mismatch on join and hello', () => {
    expect(parseClientFrame(JSON.stringify({ t: 'join', v: v + 1, name: 'A' }))).toEqual({ ok: false, code: 'VERSION_MISMATCH' });
    expect(parseClientFrame(JSON.stringify({ t: 'hello', v: v + 1, playerId: 'p', secret: 's' }))).toEqual({ ok: false, code: 'VERSION_MISMATCH' });
  });
});

describe('server messages', () => {
  for (const msg of validServer) {
    it(`${msg.t}: valid fixture round-trips`, () => {
      expect(parseServerFrame(JSON.stringify(msg))).toEqual({ ok: true, msg: ServerMsgSchema.parse(msg) });
    });
  }
  it('invalid fixtures are rejected', () => {
    for (const bad of invalidServer) {
      expect(parseServerFrame(JSON.stringify(bad)).ok).toBe(false);
    }
  });
  it('a snapshot of the sample view stays under 5KB', () => {
    expect(JSON.stringify({ t: 'snap', rev: 1, now: 0, view: sampleView }).length).toBeLessThan(5000);
  });
});

describe('room codes', () => {
  it('normalises case, spaces and hyphens', () => {
    expect(normalizeRoomCode(' k7q-mx ')).toBe('K7QMX');
  });
  it('rejects excluded letters and wrong lengths', () => {
    expect(normalizeRoomCode('K7QMO')).toBeNull();
    expect(normalizeRoomCode('K7QM')).toBeNull();
    expect(normalizeRoomCode('K7QMXX')).toBeNull();
  });
});
