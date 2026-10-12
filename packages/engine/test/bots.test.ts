import { describe, expect, it } from 'vitest';
import { bestBid, worth } from '../src/bots';
import type { BotLevel } from '../src/bots';
import { legalBids } from '../src/game';
import { indexPack } from '../src/pack';
import { playGame } from '../src/testing/driver';
import { synthPack } from '../src/testing/synthPack';
import type { EngineAction, EngineState } from '../src/types';
import { clone, engine, newGame, px, v } from './helpers';

const idx = indexPack(synthPack());
const LEVELS: BotLevel[] = ['random', 'greedy', 'careful'];

/** Items sorted by estimate, cheapest first. */
const itemsByEst = [...idx.cards.values()]
  .filter((c) => c.kind === 'item')
  .sort((a, b) => a.est - b.est);
const cheap = itemsByEst[0]!;
const pricey = itemsByEst[itemsByEst.length - 1]!;

function fullHand() {
  return [10, 25, 50, 75, 100, 125, 150, 200, 250, 300].map(v);
}

describe('bots: legality (property over seeded games)', () => {
  it('every bot action proposed during whole games is accepted by the engine', () => {
    let proposed = 0;
    const checked = {
      ...engine,
      botActionAt(level: BotLevel, state: EngineState, player: string, now: number) {
        const a = engine.botActionAt(level, state, player, now);
        if (a && a.type === 'bid') {
          proposed++;
          const me = state.players.find((p) => p.id === player)!;
          const ok = legalBids(state, me).some((l) => l.card.id === a.card && l.bay === a.bay);
          if (!ok) throw new Error(`illegal bid proposed by ${level}: ${JSON.stringify(a)}`);
        }
        return a;
      },
    } as typeof engine;
    for (const mode of ['classic', 'frenzy'] as const)
      for (const n of [3, 4, 6])
        for (let g = 0; g < 4; g++) {
          const r = playGame({
            engine: checked,
            setup: {
              seed: `bots-${mode}-${n}-${g}`,
              mode,
              bidWindowMs: 5000,
              relaxed: false,
              length: g % 2 === 0 ? 'quick' : 'standard',
              players: Array.from({ length: n }, (_, i) => ({
                id: `p${i}`,
                isBot: true,
                connected: true,
              })),
            },
            levels: LEVELS,
            pacing: g % 2 === 0 ? 'human' : 'bot',
            maxMs: 3 * 3600_000,
          });
          expect(r.terminated).toBe(true);
          expect(r.rejected).toBe(0);
        }
    expect(proposed).toBeGreaterThan(200);
  });

  it('bestBid on random mid-game states is always a legal bid or null', () => {
    for (let g = 0; g < 6; g++) {
      const r = playGame({
        engine,
        setup: {
          seed: `legal-${g}`,
          mode: 'classic',
          bidWindowMs: 5000,
          relaxed: false,
          players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, isBot: true, connected: true })),
        },
        levels: ['careful'],
        maxMs: 3 * 3600_000,
      });
      // Re-play the trace up to several cut points and ask every level for a decision.
      let s = engine.setup(
        {
          seed: `legal-${g}`,
          mode: 'classic',
          bidWindowMs: 5000,
          relaxed: false,
          players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, isBot: true, connected: true })),
        },
        1_000_000,
      ).state;
      let k = 0;
      for (const step of r.trace) {
        s = step.action
          ? (() => {
              const res = engine.apply(s, step.action, step.t);
              return res.ok ? res.state : s;
            })()
          : engine.tick(s, step.t).state;
        if (++k % 7 !== 0 || s.stage !== 'bidding') continue;
        for (const p of s.players)
          for (const level of LEVELS) {
            const pick = bestBid(level, idx, s, p);
            if (!pick) continue;
            expect(
              legalBids(s, p).some((l) => l.card.id === pick.card.id && l.bay === pick.bay),
            ).toBe(true);
          }
      }
    }
  });
});

describe('bots: determinism', () => {
  it('same state, same decision; same seed, same whole game', () => {
    const { state } = newGame(4, 'classic', 'det-1');
    const me = state.players[0]!;
    for (const level of LEVELS) {
      expect(bestBid(level, idx, state, me)).toEqual(bestBid(level, idx, clone(state), me));
      expect(engine.botActionAt(level, state, me.id, 5000)).toEqual(
        engine.botActionAt(level, clone(state), me.id, 5000),
      );
    }
    const run = () =>
      playGame({
        engine,
        setup: {
          seed: 'det-game',
          mode: 'frenzy',
          bidWindowMs: 5000,
          relaxed: false,
          players: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, isBot: true, connected: true })),
        },
        levels: LEVELS,
        pacing: 'human',
      });
    const a = run();
    const b = run();
    expect(b.trace).toEqual(a.trace);
    expect(engine.score(b.state)).toEqual(engine.score(a.state));
  });
});

describe('bots: value-aware bidding and reserve', () => {
  function stageBay(card: string) {
    const { state } = newGame(3, 'classic', 'value-1');
    const s = clone(state);
    s.bays[0]!.card = card;
    s.bays[0]!.stack = [];
    for (const b of s.bays.slice(1)) {
      b.card = null;
      b.stack = [];
    }
    for (const p of s.players) p.hand = [...fullHand(), px(1), px(2)];
    return s;
  }

  it('does not spend a high card on a cheap item', () => {
    const s = stageBay(cheap.id);
    for (const level of LEVELS) {
      const pick = bestBid(level, idx, s, s.players[0]!);
      if (!pick) continue;
      expect(pick.card.kind).toBe('value');
      expect(pick.card.value!).toBeLessThanOrEqual(worth(idx, s.players[0]!, cheap.id) * 1.9);
    }
    // And the careful bot does not open with a Proxy on it.
    expect(bestBid('careful', idx, s, s.players[0]!)?.card.kind).not.toBe('proxy');
  });

  it('bids on a valuable item with a card commensurate with its value', () => {
    const s = stageBay(pricey.id);
    const pick = bestBid('careful', idx, s, s.players[0]!);
    expect(pick).not.toBeNull();
    if (pick!.card.kind === 'value')
      expect(pick!.card.value!).toBeGreaterThanOrEqual(pricey.est * 0.5);
  });

  it('keeps a reserve: with only one value card left it does not spend it on an ordinary item', () => {
    const s = stageBay(itemsByEst[Math.floor(itemsByEst.length / 2)]!.id);
    const me = s.players[0]!;
    me.hand = [v(100)];
    expect(bestBid('careful', idx, s, me)).toBeNull();
  });

  it('does not bid on a bay it already leads, and stops at its on-bay limit', () => {
    const s = stageBay(pricey.id);
    const me = s.players[0]!;
    s.bays[0]!.stack = [{ by: me.id, card: v(50) }];
    me.hand = me.hand.filter((c) => c.id !== 'v50');
    expect(bestBid('careful', idx, s, me)).toBeNull();
    const a = engine.botActionAt(
      'careful',
      { ...s, call: { player: me.id, phase: 'window', endsAt: 9e9 } },
      me.id,
      1,
    );
    expect(a).toEqual({ type: 'pass', player: me.id });
  });

  it('Frenzy: respects the cooldown', () => {
    const { state } = newGame(3, 'frenzy', 'cool-1', 1000);
    const s = clone(state);
    const me = s.players[0]!;
    me.cooldownUntil = 5000;
    for (const level of LEVELS) expect(engine.botActionAt(level, s, me.id, 2000)).toBeNull();
  });

  it('plays are never proposed with a card absent from the hand', () => {
    const s = stageBay(pricey.id);
    const me = s.players[0]!;
    me.hand = [px(1)];
    for (const level of LEVELS) {
      const a = bestBid(level, idx, s, me);
      if (a) expect(me.hand.some((c) => c.id === a.card.id)).toBe(true);
    }
    const act: EngineAction | null = engine.botActionAt('greedy', s, me.id, 1);
    expect(act === null || act.type === 'pass' || act.type === 'bid').toBe(true);
  });
});
