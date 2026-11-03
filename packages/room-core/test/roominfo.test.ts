import { describe, expect, it } from 'vitest';
import { roomInfo } from '../src/index';
import { Harness } from './helpers';

describe('roomInfo', () => {
  it('reports the lobby summary with host name, no ids or secrets', () => {
    const h = new Harness();
    const id = h.join('Sam');
    const info = roomInfo(h.state);
    expect(info).toEqual({
      exists: true,
      phase: 'lobby',
      players: 1,
      maxPlayers: 6,
      mode: 'classic',
      hostName: 'Sam',
    });
    const text = JSON.stringify(info);
    expect(text).not.toContain(id);
    expect(text).not.toContain('secret');
  });

  it('counts bots as players', () => {
    const h = new Harness();
    h.join('Sam');
    h.state.players.push({
      ...h.state.players[0]!,
      id: 'bot1',
      name: 'Botty',
      isBot: true,
      secretHash: null,
      seat: 1,
    });
    expect(roomInfo(h.state)).toMatchObject({ players: 2, hostName: 'Sam' });
  });

  it('omits hostName when there is no host', () => {
    const h = new Harness();
    h.join('Sam');
    h.state.meta.hostId = null;
    expect('hostName' in roomInfo(h.state)).toBe(false);
  });

  it('reflects later phases and treats a closed room as missing', () => {
    const h = new Harness();
    h.join('Sam');
    h.state.meta.phase = 'ended';
    expect(roomInfo(h.state)).toMatchObject({ exists: true, phase: 'ended' });
    h.state.meta.closed = true;
    expect(roomInfo(h.state)).toEqual({ exists: false });
  });
});
