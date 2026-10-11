// Simulated-clock driver: plays a whole game with bots, standing in for room-core. Used by the
// simulator and by engine tests. Pure: all randomness comes from `driverSeed` via the engine RNG.
import type { BotLevel } from '../bots';
import type { RealEngine } from '../engine';
import { CONFIG } from '../config';
import { initRng, nextInt } from '../rng';
import type { EngineAction, EngineState, GameEvent, GameSetup } from '../types';

export interface PlayOptions {
  engine: RealEngine;
  setup: GameSetup;
  /** Skill per seat; shorter arrays repeat their last entry. */
  levels: BotLevel[];
  /** Hard stop for the simulated clock; a game still running then is reported non-terminating. */
  maxMs?: number;
  /** Bot reaction-time range in ms (default: CONFIG.botDelayMinMs..botDelayMaxMs). */
  reactionMs?: [number, number];
  /** Seed for bot reaction delays (separate from the game seed). */
  driverSeed?: string;
}

export interface PlayResult {
  state: EngineState;
  terminated: boolean;
  startMs: number;
  endMs: number;
  events: Array<{ t: number; e: GameEvent }>;
  /** Simulated time at which each player first had an empty hand (bidding stage). */
  dryAt: Record<string, number>;
  rejected: number;
  /** Every accepted step in order: a tick (no action) or an applied action. Replayable. */
  trace: Array<{ t: number; action?: EngineAction }>;
}

export function playGame(o: PlayOptions): PlayResult {
  const { engine } = o;
  const start = 1_000_000;
  const drv = initRng(o.driverSeed ?? `${o.setup.seed}|driver`);
  const [dMin, dMax] = o.reactionMs ?? [CONFIG.botDelayMinMs, CONFIG.botDelayMaxMs];
  const delay = () => dMin + nextInt(drv, 'misc', dMax - dMin + 1);
  const created = engine.setup(o.setup, start);
  let state = created.state;
  const events: PlayResult['events'] = created.events.map((e) => ({ t: start, e }));
  const trace: PlayResult['trace'] = [];
  const next = state.players.map(() => start + delay());
  const dryAt: Record<string, number> = {};
  let rejected = 0;
  let t = start;
  const maxMs = o.maxMs ?? 2 * 3600_000;
  const noteDry = () => {
    if (state.stage !== 'bidding') return;
    for (const p of state.players)
      if (p.hand.length === 0 && dryAt[p.id] === undefined) dryAt[p.id] = t;
  };
  let guard = 0;
  while (state.stage !== 'done' && t - start < maxMs && guard++ < 5_000_000) {
    const d = engine.nextDeadline(state);
    const bot = Math.min(...next);
    t = Math.max(t, d === null ? bot : Math.min(d, bot));
    if (d !== null && d <= t) {
      const r = engine.tick(state, t);
      state = r.state;
      for (const e of r.events) events.push({ t, e });
      trace.push({ t });
      noteDry();
      if (state.stage === 'done') break;
    }
    state.players.forEach((p, i) => {
      if ((next[i] as number) > t || state.stage === 'done') return;
      const level = o.levels[Math.min(i, o.levels.length - 1)] ?? 'careful';
      const action = engine.botActionAt(level, state, p.id, t);
      next[i] = t + delay();
      if (!action) return;
      const res = engine.apply(state, action, t);
      if (!res.ok) {
        rejected++;
        return;
      }
      state = res.state;
      for (const e of res.events) events.push({ t, e });
      trace.push({ t, action });
      noteDry();
    });
  }
  return {
    state,
    terminated: state.stage === 'done',
    startMs: start,
    endMs: t,
    events,
    trace,
    dryAt,
    rejected,
  };
}
