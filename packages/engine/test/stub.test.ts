import { describe, expect, it } from 'vitest';
import { CONFIG, stubEngine } from '../src/index';

const players = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, isBot: false, connected: true }));

describe('stub engine (WS0 contract smoke test)', () => {
  it('deals 12 cards per player and scales bays with player count', () => {
    const { state } = stubEngine.setup({ seed: 's', mode: 'classic', bidWindowMs: 5000, relaxed: false, players }, 0);
    expect(state.players.every((p) => p.hand.length === CONFIG.BID_VALUES.length + CONFIG.PROXIES_PER_PLAYER)).toBe(true);
    expect(state.bays).toHaveLength(CONFIG.BAYS_BY_PLAYERS[5]);
  });

  it('rejects actions without changing state', () => {
    const { state } = stubEngine.setup({ seed: 's', mode: 'classic', bidWindowMs: 5000, relaxed: false, players: players.slice(0, 3) }, 0);
    expect(stubEngine.apply(state, { type: 'pass', player: 'a' }, 1)).toEqual({ ok: false, code: 'WRONG_PHASE' });
  });
});
