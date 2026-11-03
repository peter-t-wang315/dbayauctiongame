import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeRoomInfo, fetchRoomInfo } from './roomInfo';

const lobby = { exists: true, phase: 'lobby', players: 3, maxPlayers: 6, mode: 'classic' } as const;

describe('describeRoomInfo', () => {
  it('falls back to unknown without info', () => {
    expect(describeRoomInfo('ABCDE', null)).toEqual({ kind: 'unknown' });
  });
  it('flags missing rooms', () => {
    expect(describeRoomInfo('ABCDE', { exists: false })).toEqual({ kind: 'notfound' });
  });
  it('flags started games for every non-lobby phase', () => {
    for (const phase of ['playing', 'reveal', 'ended'] as const) {
      expect(describeRoomInfo('ABCDE', { ...lobby, phase })).toEqual({ kind: 'started' });
    }
  });
  it('flags full lobbies', () => {
    expect(describeRoomInfo('ABCDE', { ...lobby, players: 6 })).toEqual({ kind: 'full' });
  });
  it('builds the info line, with and without host', () => {
    expect(describeRoomInfo('ABCDE', lobby)).toEqual({
      kind: 'ok',
      line: 'Room ABCDE · 3/6 players · Classic',
    });
    expect(describeRoomInfo('ABCDE', { ...lobby, mode: 'frenzy', hostName: 'Sam' })).toEqual({
      kind: 'ok',
      line: 'Room ABCDE · 3/6 players · Frenzy · Host Sam',
    });
  });
});

describe('fetchRoomInfo', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (status: number, body: unknown) =>
    vi.stubGlobal('fetch', vi.fn(async () => ({ status, json: async () => body })));

  it('returns the summary, and exists:false on 404', async () => {
    stub(200, lobby);
    expect(await fetchRoomInfo('ABCDE', 'localhost:8787')).toEqual(lobby);
    stub(404, { exists: false });
    expect(await fetchRoomInfo('ABCDE', 'localhost:8787')).toEqual({ exists: false });
  });
  it('returns null on server errors, bad shapes and network failure', async () => {
    stub(500, {});
    expect(await fetchRoomInfo('ABCDE', 'localhost:8787')).toBeNull();
    stub(200, { exists: true });
    expect(await fetchRoomInfo('ABCDE', 'localhost:8787')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('down'))),
    );
    expect(await fetchRoomInfo('ABCDE', 'localhost:8787')).toBeNull();
  });
});
