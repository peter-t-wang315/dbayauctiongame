import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { playGame } from '../src/testing/driver';
import type { BotLevel } from '../src/bots';
import type { EngineAction, EngineState, GameEvent, Mode } from '../src/types';
import { engine, mkSetup } from './helpers';

const levelArb = fc.constantFrom<BotLevel>('random', 'greedy', 'careful');
const modeArb = fc.constantFrom<Mode>('classic', 'frenzy');
const nArb = fc.integer({ min: 3, max: 6 });
const CARD_IDS = [...CONFIG.BID_VALUES.map((v) => `v${v}`), 'p1', 'p2', 'bogus'];

type Op =
  | { k: 'tick'; dt: number }
  | { k: 'noise'; p: number; card: number; bay: number; kind: number }
  | { k: 'bot'; p: number; level: BotLevel };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ k: fc.constant('tick' as const), dt: fc.integer({ min: 0, max: 40000 }) }),
  fc.record({
    k: fc.constant('noise' as const),
    p: fc.integer({ min: 0, max: 7 }),
    card: fc.integer({ min: 0, max: CARD_IDS.length - 1 }),
    bay: fc.integer({ min: -1, max: 5 }),
    kind: fc.integer({ min: 0, max: 4 }),
  }),
  fc.record({
    k: fc.constant('bot' as const),
    p: fc.integer({ min: 0, max: 5 }),
    level: levelArb,
  }),
);

/** Cards conserved: hand + on bays + won (discarded) bid cards = the starting 12, per player. */
function checkConserved(state: EngineState, sales: Record<string, number>) {
  for (const p of state.players) {
    const onBays = state.bays.reduce((s, b) => s + b.stack.filter((e) => e.by === p.id).length, 0);
    expect(p.hand.length + onBays + (sales[p.id] ?? 0)).toBe(
      CONFIG.BID_VALUES.length + CONFIG.PROXIES_PER_PLAYER,
    );
    const ids = [
      ...p.hand.map((c) => c.id),
      ...state.bays.flatMap((b) => b.stack.filter((e) => e.by === p.id).map((e) => e.card.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  }
}

function tally(events: GameEvent[], sales: Record<string, number>) {
  for (const e of events) if (e.kind === 'sold' && e.by) sales[e.by] = (sales[e.by] ?? 0) + 1;
}

describe('properties', () => {
  it('never throws, illegal actions are no-ops, cards are conserved (random action sequences)', () => {
    fc.assert(
      fc.property(
        nArb,
        modeArb,
        fc.string({ maxLength: 8 }),
        fc.array(opArb, { maxLength: 150 }),
        (n, mode, seed, ops) => {
          const created = engine.setup(mkSetup(n, seed, mode), 1000);
          let state = created.state;
          const sales: Record<string, number> = {};
          tally(created.events, sales);
          let t = 1000;
          for (const op of ops) {
            if (op.k === 'tick') {
              t += op.dt;
              const r = engine.tick(state, t);
              state = r.state;
              tally(r.events, sales);
            } else {
              t += 37;
              const who = state.players[op.p % state.players.length]!.id;
              let action: EngineAction | null;
              if (op.k === 'bot') action = engine.botActionAt(op.level, state, who, t);
              else {
                const card = CARD_IDS[op.card] as string;
                const bay = op.bay;
                action = [
                  { type: 'bid', player: who, card, bay },
                  { type: 'pass', player: who },
                  { type: 'gift', player: who, target: `p${op.bay}` },
                  { type: 'giftGive', player: who, item: card },
                  { type: 'setConnected', player: who, connected: op.bay > 2 },
                ][op.kind] as EngineAction;
              }
              if (!action) continue;
              const before = JSON.stringify(state);
              const res = engine.apply(state, action, t);
              if (res.ok) {
                state = res.state;
                tally(res.events, sales);
              } else expect(JSON.stringify(state)).toBe(before);
            }
            checkConserved(state, sales);
          }
          expect(() => JSON.stringify(state)).not.toThrow();
        },
      ),
      { numRuns: 150 },
    );
  });

  it('same seed gives the same game; games always terminate; bid cards conserved', () => {
    fc.assert(
      fc.property(
        nArb,
        modeArb,
        fc.string({ maxLength: 10 }),
        levelArb,
        levelArb,
        (n, mode, seed, l1, l2) => {
          const run = () => playGame({ engine, setup: mkSetup(n, seed, mode), levels: [l1, l2] });
          const a = run();
          const b = run();
          expect(a.terminated).toBe(true);
          expect(a.rejected).toBe(0);
          expect(b.state).toEqual(a.state);
          const sales: Record<string, number> = {};
          tally(
            a.events.map((e) => e.e),
            sales,
          );
          checkConserved(a.state, sales);
          // every scorable card ends with exactly one owner
          const owned = a.state.players.flatMap((p) => p.won);
          expect(new Set(owned).size).toBe(owned.length);
        },
      ),
      { numRuns: 40 },
    );
  });
});

it('property helper sanity: engine terminates with disconnected players only', () => {
  const setup = mkSetup(3, 'dc', 'classic');
  setup.players.forEach((p) => (p.connected = false));
  let s = engine.setup(setup, 0).state;
  let guard = 0;
  while (s.stage === 'bidding' && guard++ < 1000) s = engine.tick(s, engine.nextDeadline(s)!).state;
  expect(s.stage).toBe('done');
});
