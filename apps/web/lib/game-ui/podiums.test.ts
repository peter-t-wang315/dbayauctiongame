import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { podiumModels } from './podiums';

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
  it('drops the turn marker in the gap and while my bid is in flight (B1)', () => {
    expect(podiumModels(view({ turn: { player: 'pat', color: 'blue', phase: 'gap' } })).some((x) => x.turn)).toBe(false);
    const mine = view({ turn: { player: 'me', color: 'red', phase: 'window' } });
    expect(podiumModels(mine).find((x) => x.turn)?.id).toBe('me');
    expect(podiumModels(mine, true).some((x) => x.turn)).toBe(false);
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
