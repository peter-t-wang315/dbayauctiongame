import { PlayerViewSchema, parseClientFrame } from '@dbay/protocol';
import { describe, expect, it } from 'vitest';
import { reduce, roomNotFound, view, type Effect } from '../src/index';
import { Harness, T0, hashOf } from './helpers';

describe('lobby', () => {
  it('first human joins as host; welcome carries the secret, snapshot validates', () => {
    const h = new Harness();
    const id = h.join('Peter');
    expect(h.state.meta.hostId).toBe(id);
    const sends = h.sends();
    const welcome = sends.find((s) => s.msg.t === 'welcome')!;
    expect(welcome.to).toEqual({ conn: `c-${id}` });
    expect(welcome.msg).toMatchObject({
      t: 'welcome',
      playerId: id,
      secret: `s-${id}`,
      code: 'K7QMX',
    });
    const snap = sends.find((s) => s.msg.t === 'snap')!;
    expect(PlayerViewSchema.safeParse((snap.msg as { view: unknown }).view).success).toBe(true);
    // the secret/hash never reach the state view
    expect(JSON.stringify(view(h.state, id))).not.toContain(hashOf(`s-${id}`));
    expect(h.state.rev).toBe(1);
  });

  it('duplicate names get a numeric suffix; invalid names are rejected', () => {
    const h = new Harness();
    h.join('Sam');
    h.join('Sam');
    h.join('Sam');
    expect(h.state.players.map((p) => p.name)).toEqual(['Sam', 'Sam 2', 'Sam 3']);
    const before = h.state;
    h.run({
      type: 'join',
      conn: 'x',
      name: '  ',
      playerId: 'zz',
      secret: 's',
      secretHash: 'h',
    });
    expect(h.errCode()).toBe('NAME_INVALID');
    expect(h.state).toBe(before);
  });

  it('seventh seat -> ROOM_FULL; join after start -> GAME_IN_PROGRESS', () => {
    const h = new Harness();
    for (let i = 0; i < 6; i++) h.join(`P${i}`);
    h.join('P7');
    expect(h.errCode()).toBe('ROOM_FULL');
    const g = Harness.started(3, 0);
    g.join('Late');
    expect(g.errCode()).toBe('GAME_IN_PROGRESS');
    expect(g.state.players).toHaveLength(3);
  });

  it('hello: good secret reclaims the seat and replaces the old socket; bad secret rejected', () => {
    const h = new Harness();
    const id = h.join('A');
    h.run({ type: 'disconnect', playerId: id }, T0 + 10);
    expect(h.state.players[0]!.connected).toBe(false);
    h.run({ type: 'hello', conn: 'new', playerId: id, secretHash: hashOf('wrong') });
    expect(h.errCode()).toBe('BAD_SECRET');
    expect(h.state.players[0]!.connected).toBe(false);
    h.run({ type: 'hello', conn: 'new', playerId: id, secretHash: hashOf(`s-${id}`) });
    expect(h.state.players[0]!.connected).toBe(true);
    expect(h.last).toContainEqual({
      type: 'closeSocket',
      playerId: id,
      why: 'replaced',
      exceptConn: 'new',
    });
    const welcome = h.sends().find((s) => s.msg.t === 'welcome')!;
    expect(welcome.to).toEqual({ conn: 'new' });
    expect((welcome.msg as { secret?: string }).secret).toBeUndefined();
    expect(h.sends().some((s) => s.msg.t === 'snap')).toBe(true);
  });

  it('hello for an unknown player or a bot is BAD_SECRET', () => {
    const h = new Harness();
    const id = h.join('A');
    h.act(id, { t: 'addBot' });
    h.run({ type: 'hello', conn: 'c', playerId: 'nobody', secretHash: 'x' });
    expect(h.errCode()).toBe('BAD_SECRET');
    h.run({ type: 'hello', conn: 'c', playerId: 'bot1', secretHash: 'x' });
    expect(h.errCode()).toBe('BAD_SECRET');
  });

  it('host-only actions are NOT_HOST for others; no state change', () => {
    const h = new Harness();
    h.join('Host');
    const g = h.join('Guest');
    const before = h.state;
    for (const t of ['addBot', 'start', 'rematch'] as const) {
      h.act(g, { t });
      expect(h.errCode()).toBe('NOT_HOST');
    }
    h.act(g, { t: 'setOpts', mode: 'frenzy' });
    expect(h.errCode()).toBe('NOT_HOST');
    expect(h.state).toBe(before);
  });

  it('setOpts carries length through (default standard), validates values', () => {
    const h = new Harness();
    const host = h.join('Host');
    expect(view(h.state, host).opts.length).toBe('standard');
    h.act(host, {
      t: 'setOpts',
      length: 'quick',
      mode: 'frenzy',
      relaxed: true,
      bidWindowMs: 8000,
    });
    expect(h.state.meta.opts).toEqual({
      mode: 'frenzy',
      relaxed: true,
      bidWindowMs: 8000,
      length: 'quick',
    });
    expect(view(h.state, host).opts).toEqual(h.state.meta.opts);
    // partial update keeps the rest
    h.act(host, { t: 'setOpts', mode: 'classic' });
    expect(h.state.meta.opts.length).toBe('quick');
    const before = h.state;
    h.act(host, { t: 'setOpts', bidWindowMs: 4000 as 3000 });
    expect(h.errCode()).toBe('BAD_OPTS');
    h.act(host, { t: 'setOpts', length: 'epic' as 'quick' });
    expect(h.errCode()).toBe('BAD_OPTS');
    expect(h.state).toBe(before);
  });

  it('bots: add/remove in lobby, never host, room caps at 6', () => {
    const h = new Harness();
    const host = h.join('Host');
    for (let i = 0; i < 5; i++) h.act(host, { t: 'addBot' });
    h.act(host, { t: 'addBot' });
    expect(h.errCode()).toBe('ROOM_FULL');
    expect(h.state.players).toHaveLength(6);
    h.act(host, { t: 'rmBot', playerId: 'bot2' });
    expect(h.state.players.some((p) => p.id === 'bot2')).toBe(false);
    h.act(host, { t: 'rmBot', playerId: host });
    expect(h.errCode()).toBe('BAD_MESSAGE');
    expect(h.state.meta.hostId).toBe(host);
  });

  it('start needs >= 3 seats and a seed', () => {
    const h = new Harness();
    const host = h.join('Host');
    h.act(host, { t: 'addBot' });
    h.run({ type: 'seed', seed: 'x' });
    h.act(host, { t: 'start' });
    expect(h.errCode()).toBe('NOT_ENOUGH_PLAYERS');
    h.act(host, { t: 'addBot' });
    const h2 = new Harness();
    const host2 = h2.join('Host');
    h2.act(host2, { t: 'addBot' });
    h2.act(host2, { t: 'addBot' });
    h2.act(host2, { t: 'start' });
    expect(h2.errCode()).toBe('INTERNAL'); // no seed supplied
    expect(h2.state.meta.phase).toBe('lobby');
  });

  it('rename in lobby only, kick removes + bans (by id and by secret hash)', () => {
    const h = new Harness();
    const host = h.join('Host');
    const g = h.join('Guest');
    h.act(g, { t: 'rename', name: 'Host' });
    expect(h.state.players[1]!.name).toBe('Host 2');
    h.act(host, { t: 'kick', playerId: g });
    expect(h.state.players.map((p) => p.id)).toEqual([host]);
    const sends = h.sends();
    expect(sends.some((s) => s.to === g && s.msg.t === 'kicked')).toBe(true);
    expect(h.last).toContainEqual({ type: 'closeSocket', playerId: g, why: 'kicked' });
    expect(sends.some((s) => s.to === g && s.msg.t === 'snap')).toBe(false);
    // kicked player cannot come back by hello or by join with same id
    h.run({ type: 'hello', conn: 'c', playerId: g, secretHash: hashOf(`s-${g}`) });
    expect(h.errCode()).toBe('BAD_SECRET');
    h.run({ type: 'join', conn: 'c', name: 'G', playerId: g, secret: 's', secretHash: 'new' });
    expect(h.errCode()).toBe('BANNED');
    // same secret hash is banned as well
    h.run({
      type: 'join',
      conn: 'c',
      name: 'G',
      playerId: 'g2',
      secret: 's',
      secretHash: hashOf(`s-${g}`),
    });
    expect(h.errCode()).toBe('BANNED');
  });

  it('leaving the lobby frees the seat and moves the host', () => {
    const h = new Harness();
    const a = h.join('A');
    const b = h.join('B');
    h.run({ type: 'leave', playerId: a });
    expect(h.state.players.map((p) => p.id)).toEqual([b]);
    expect(h.state.meta.hostId).toBe(b);
  });

  it('seq idempotency: duplicate / older seq acks ok without re-applying', () => {
    const h = new Harness();
    const host = h.join('Host');
    h.act(host, { t: 'addBot', seq: 5 });
    expect(h.state.players).toHaveLength(2);
    const rev = h.state.rev;
    h.act(host, { t: 'addBot', seq: 5 });
    expect(h.ack()).toEqual({ t: 'ack', seq: 5, ok: true });
    h.act(host, { t: 'addBot', seq: 3 });
    expect(h.ack()).toEqual({ t: 'ack', seq: 3, ok: true });
    expect(h.state.players).toHaveLength(2);
    expect(h.state.rev).toBe(rev);
  });

  it('every accepted action acks BEFORE the snapshots; rejections keep rev', () => {
    const h = new Harness();
    const host = h.join('Host');
    const rev = h.state.rev;
    const fx = h.act(host, { t: 'addBot' });
    const kinds = fx.flatMap((e) => (e.type === 'send' ? [e.msg.t] : []));
    expect(kinds[0]).toBe('ack');
    expect(kinds.slice(1).every((k) => k === 'snap')).toBe(true);
    expect(h.state.rev).toBe(rev + 1);
    const before = h.state;
    h.act(host, { t: 'rematch' });
    expect(h.errCode()).toBe('WRONG_PHASE');
    expect(h.state).toBe(before);
    expect(h.state.rev).toBe(rev + 1);
  });

  it('rejects malformed actions and oversized/unknown frames with correct codes', () => {
    const h = new Harness();
    const host = h.join('Host');
    const before = h.state;
    h.run({ type: 'action', playerId: host, msg: { t: 'dance', seq: 9 } as never });
    expect(h.errCode()).toBe('BAD_MESSAGE');
    h.run({ type: 'action', playerId: host, msg: { t: 'addBot', seq: 'x' } as never });
    expect(h.errCode()).toBe('BAD_MESSAGE');
    h.run({ type: 'action', playerId: 'ghost', msg: { t: 'addBot', seq: 1 } });
    expect(h.last).toEqual([]);
    expect(h.state).toBe(before);
    // frame-level rejection is the protocol's job and composes with the reducer
    expect(parseClientFrame('x'.repeat(3000))).toEqual({ ok: false, code: 'BAD_MESSAGE' });
    expect(parseClientFrame('{"t":"dance"}')).toEqual({ ok: false, code: 'BAD_MESSAGE' });
  });

  it('unknown rooms answer ROOM_NOT_FOUND; expired rooms close and then answer the same', () => {
    expect(roomNotFound('c1')).toEqual([
      { type: 'send', to: { conn: 'c1' }, msg: { t: 'err', code: 'ROOM_NOT_FOUND' } },
    ]);
    const h = new Harness();
    const id = h.join('A');
    const fx = h.tickTo(T0 + 61 * 60 * 1000);
    expect(h.state.meta.closed).toBe(true);
    expect(fx).toContainEqual({ type: 'deleteRoom' });
    expect(fx).toContainEqual({ type: 'closeSocket', playerId: id, why: 'expired' });
    expect(h.sends(fx).some((s) => s.to === 'all' && s.msg.t === 'closing')).toBe(true);
    expect(fx).toContainEqual({ type: 'setAlarm', at: null });
    const r = reduce(
      h.state,
      { type: 'hello', conn: 'c9', playerId: id, secretHash: 'x' },
      T0 + 62 * 60 * 1000,
    );
    expect(r.effects).toEqual(roomNotFound('c9'));
    expect(r.state).toBe(h.state);
  });

  it('effects order: persist, setAlarm, log, then sends', () => {
    const h = new Harness();
    const fx: Effect[] = h.run({
      type: 'join',
      conn: 'c',
      name: 'A',
      playerId: 'a',
      secret: 's',
      secretHash: 'h',
    });
    expect(fx.slice(0, 3).map((e) => e.type)).toEqual(['persist', 'setAlarm', 'log']);
    expect(fx[1]).toEqual({ type: 'setAlarm', at: T0 + 60 * 60 * 1000 });
  });
});
