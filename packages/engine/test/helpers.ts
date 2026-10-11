import { createEngine } from '../src/engine';
import { synthPack } from '../src/testing/synthPack';
import type {
  BidCard,
  EngineAction,
  EngineState,
  GameEvent,
  GameSetup,
  Mode,
  StackEntry,
} from '../src/types';

export const v = (value: number): BidCard => ({ id: `v${value}`, kind: 'value', value });
export const px = (n: number): BidCard => ({ id: `p${n}`, kind: 'proxy' });

/** Put entries on a bay, removing the cards from their owners' hands. */
export function stackOn(s: EngineState, bay: number, entries: Array<[string, BidCard]>): void {
  s.bays[bay]!.stack = entries.map(([by, card]) => {
    const p = s.players.find((x) => x.id === by)!;
    p.hand = p.hand.filter((c) => c.id !== card.id);
    return { by, card } as StackEntry;
  });
}

export const engine = createEngine(synthPack());
export const T0 = 1000;

export function mkSetup(n: number, seed = 'seed-1', mode: Mode = 'classic'): GameSetup {
  return {
    seed,
    mode,
    bidWindowMs: 5000,
    relaxed: false,
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, isBot: false, connected: true })),
  };
}

export function newGame(n = 3, mode: Mode = 'classic', seed = 'seed-1', now = T0) {
  return engine.setup(mkSetup(n, seed, mode), now);
}

export const clone = <T>(x: T): T => structuredClone(x);

export function act(state: EngineState, action: EngineAction, now: number) {
  const r = engine.apply(state, action, now);
  if (!r.ok) throw new Error(`action rejected: ${r.code}`);
  return r;
}

export function kinds(events: GameEvent[]): string[] {
  return events.map((e) => e.kind);
}

/** The player whose call window is open. */
export function caller(state: EngineState): string {
  if (!state.call) throw new Error('no call');
  return state.call.player;
}

export function player(state: EngineState, id: string) {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

/** Empty all bays and the deck, then end the call so the game proceeds to the gifts stage. */
export function toGifts(state: EngineState, now = T0): EngineState {
  const s = clone(state);
  for (const b of s.bays) {
    b.card = null;
    b.stack = [];
  }
  s.deck = [];
  s.call = { player: s.players[0]!.id, phase: 'window', endsAt: now + 1 };
  return engine.tick(s, now + 1).state;
}

/** Run a whole game with all-pass actions by waiting out each window; returns final state. */
export function runAllPass(state: EngineState, events: GameEvent[] = []): EngineState {
  let s = state;
  let guard = 0;
  while (s.stage === 'bidding' && guard++ < 10000) {
    const d = engine.nextDeadline(s);
    if (d === null) break;
    const r = engine.tick(s, d);
    s = r.state;
    events.push(...r.events);
  }
  return s;
}
