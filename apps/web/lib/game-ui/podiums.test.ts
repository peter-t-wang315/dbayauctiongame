import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { podiumModels, podiumSlots, podiumSplit } from './podiums';

function view(over: Partial<PlayerView> = {}): PlayerView {
  const p = (id: string, color: PlayerView['players'][number]['color'], shape: string, collection: string[] = []) => ({
    id,
    name: id.toUpperCase(),
    color,
    shape,
    connected: true,
    isBot: id !== 'me',
    cardsInHand: 12,
    collection,
    gifts: 0,
  });
  return {
    code: 'ABCDE',
    phase: 'playing',
    stage: 'bidding',
    opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
    me: 'me',
    hostId: 'me',
    myHand: [],
    canAct: false,
    players: [p('pat', 'blue', '▲', ['toys-tin-robot']), p('me', 'red', '●'), p('lee', 'yellow', '■')],
    bays: [
      { idx: 0, card: 'toys-tin-robot', stack: [], topBid: { by: 'lee', kind: 'value', value: 50 } },
      { idx: 1, card: null, stack: [], topBid: null },
    ],
    turn: { player: 'pat', color: 'blue', phase: 'window' },
    round: { n: 1, of: 8, halfway: false, last: false },
    deckLeft: 10,
    log: [],
    ...over,
  } as PlayerView;
}

describe('podiumModels', () => {
  it('puts me first and marks the player on turn (Classic)', () => {
    const pods = podiumModels(view());
    expect(pods.map((x) => x.id)).toEqual(['me', 'pat', 'lee']);
    expect(pods.find((x) => x.turn)?.id).toBe('pat');
    expect(pods[0]).toMatchObject({ me: true, cardsLeft: 12, wonCount: 0 });
  });
  it('has no turn in Frenzy and reports the bays a player leads', () => {
    const pods = podiumModels(view({ opts: { mode: 'frenzy', relaxed: false, bidWindowMs: 5000 } }));
    expect(pods.some((x) => x.turn)).toBe(false);
    expect(pods.find((x) => x.id === 'lee')?.leading).toEqual(['A']);
  });
  it('lists items won with their sprite', () => {
    const pat = podiumModels(view()).find((x) => x.id === 'pat')!;
    expect(pat.wonCount).toBe(1);
    expect(pat.won[0]?.sprite).not.toBeNull();
  });
});

describe('podium sprite slots', () => {
  it('shrinks the slot count as players are added', () => {
    expect([3, 4, 5, 6].map(podiumSlots)).toEqual([6, 6, 4, 3]);
  });
  it('shows every sprite while they fit, then reserves the last slot for +n', () => {
    expect(podiumSplit(0, 6)).toEqual({ shown: 0, more: 0 });
    expect(podiumSplit(3, 6)).toEqual({ shown: 3, more: 0 });
    expect(podiumSplit(4, 6)).toEqual({ shown: 2, more: 2 });
    expect(podiumSplit(9, 5)).toEqual({ shown: 3, more: 6 });
    expect(podiumSplit(7, 3)).toEqual({ shown: 5, more: 2 });
  });
});
