// The real rules engine. `createEngine(pack)` binds the content lookups; `engine` uses the active
// pack. index.ts exports `engine` as the public engine (contract PR engine-real-and-length).
import { activePack, type ContentPack } from '@dbay/content';
import type { PlayerId } from '@dbay/protocol';
import { CONFIG } from './config';
import { botActionFor } from './bots';
import { nextDeadlineOf, runAction, runTick, startGame, type Ctx } from './game';
import { indexPack, type PackIndex } from './pack';
import { scorableCount, scoreGame } from './scoring';
import { initState } from './setup';
import type {
  ApplyResult,
  BotLevel,
  Engine,
  EngineAction,
  EngineState,
  GameEvent,
  GameSetup,
} from './types';

export interface RealEngine extends Engine {
  /** botAction with an explicit skill level (same as `botAction(state, player, now, level)`). */
  botActionAt(
    level: BotLevel,
    state: EngineState,
    player: PlayerId,
    now: number,
  ): EngineAction | null;
  readonly index: PackIndex;
}

export function createEngine(pack: ContentPack): RealEngine {
  const idx = indexPack(pack);
  return {
    index: idx,
    setup(setup: GameSetup, now: number) {
      const state = initState(idx, setup, now);
      const ctx: Ctx = { idx, events: [] };
      startGame(state, ctx, now);
      return { state, events: ctx.events };
    },
    apply(state: EngineState, action: EngineAction, now: number): ApplyResult {
      const next = structuredClone(state);
      const ctx: Ctx = { idx, events: [] };
      const err = runAction(next, ctx, action, now);
      if (err) return { ok: false, code: err };
      return { ok: true, state: next, events: ctx.events };
    },
    tick(state: EngineState, now: number): { state: EngineState; events: GameEvent[] } {
      const next = structuredClone(state);
      const ctx: Ctx = { idx, events: [] };
      runTick(next, ctx, now);
      return { state: next, events: ctx.events };
    },
    nextDeadline: nextDeadlineOf,
    score(state: EngineState) {
      return scoreGame(idx, state);
    },
    botAction(state, player, now, level = 'careful') {
      return botActionFor(level, idx, state, player, now);
    },
    botActionAt(level, state, player, now) {
      return botActionFor(level, idx, state, player, now);
    },
    revealDelayMs(state: EngineState) {
      return CONFIG.revealBaseMs + CONFIG.revealPerCardMs * scorableCount(state, idx);
    },
  };
}

export const engine: RealEngine = createEngine(activePack);

// Deliverable-style aliases (docs/06 WS1).
export const createGame = (setup: GameSetup, now: number) => engine.setup(setup, now);
export const applyAction = (state: EngineState, action: EngineAction, now: number) =>
  engine.apply(state, action, now);
export const tick = (state: EngineState, now: number) => engine.tick(state, now);
