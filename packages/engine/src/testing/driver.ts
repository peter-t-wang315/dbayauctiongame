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
  /**
   * 'bot' (default): each seat polls every `reactionMs` and acts at once if it has an action.
   * 'human': people-like timing, see `HUMAN_PACING` (tools/sim/README.md).
   */
  pacing?: 'bot' | 'human';
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

/** Human pacing assumptions (ASSUMED, docs/02 section 5; no playtest data yet). */
export const HUMAN_PACING = {
  /** Classic: fraction of the bid window at which a human acts, uniform in [min, max]. */
  classicActFrac: [0.4, 0.9] as [number, number],
  /** Classic: chance a human lets the window expire without acting. */
  classicSkipP: 0.1,
  /** Frenzy: gap between a human's looks at the board, ms, uniform. */
  frenzyPollMs: [1500, 5000] as [number, number],
  /** Frenzy: chance that a look results in a bid when the bot policy has one. */
  frenzyActP: 0.8,
  /** Gift choices (target / item), ms. */
  giftMs: [2000, 6000] as [number, number],
};

export function playGame(o: PlayOptions): PlayResult {
  const { engine } = o;
  const start = 1_000_000;
  const drv = initRng(o.driverSeed ?? `${o.setup.seed}|driver`);
  const [dMin, dMax] = o.reactionMs ?? [CONFIG.botDelayMinMs, CONFIG.botDelayMaxMs];
  const delay = () => dMin + nextInt(drv, 'misc', dMax - dMin + 1);
  const human = o.pacing === 'human';
  const H = HUMAN_PACING;
  const between = (lo: number, hi: number) =>
    lo + nextInt(drv, 'misc', Math.max(1, Math.round(hi - lo)) + 1);
  const frac = () =>
    H.classicActFrac[0] +
    (nextInt(drv, 'misc', 1001) / 1000) * (H.classicActFrac[1] - H.classicActFrac[0]);
  let trigger = '';
  const created = engine.setup(o.setup, start);
  let state = created.state;
  const events: PlayResult['events'] = created.events.map((e) => ({ t: start, e }));
  const trace: PlayResult['trace'] = [];
  const next = state.players.map(() =>
    human && state.mode === 'classic'
      ? Infinity
      : start + (human ? between(...H.frenzyPollMs) : delay()),
  );
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
    if (!Number.isFinite(d === null ? bot : Math.min(d, bot))) break;
    t = Math.max(t, d === null ? bot : Math.min(d, bot));
    if (d !== null && d <= t) {
      const r = engine.tick(state, t);
      state = r.state;
      for (const e of r.events) events.push({ t, e });
      trace.push({ t });
      noteDry();
      if (state.stage === 'done') break;
    }
    if (human && state.mode === 'classic') {
      // Schedule a human-like response when a new window or gift step opens.
      const c = state.call;
      const g = state.gift;
      const key =
        state.stage === 'bidding' && c?.phase === 'window'
          ? `w:${state.callsDone}:${c.player}`
          : state.stage === 'gifts' && g
            ? `g:${g.stage}:${g.endsAt}`
            : '';
      if (key !== trigger) {
        trigger = key;
        if (key.startsWith('w:') && c) {
          const seat = state.players.findIndex((p) => p.id === c.player);
          const win = state.bidWindowMs * (state.relaxed ? 1.5 : 1);
          next[seat] = t + Math.round(frac() * win);
          if (nextInt(drv, 'misc', 1000) / 1000 < H.classicSkipP) next[seat] = Infinity;
        } else if (key.startsWith('g:') && g) {
          const who = g.stage === 'pickTarget' ? g.holder : g.victim;
          const seat = state.players.findIndex((p) => p.id === who);
          if (seat >= 0) next[seat] = t + between(...H.giftMs);
        }
      }
    }
    state.players.forEach((p, i) => {
      if ((next[i] as number) > t || state.stage === 'done') return;
      const level = o.levels[Math.min(i, o.levels.length - 1)] ?? 'careful';
      const action = engine.botActionAt(level, state, p.id, t);
      next[i] = !human
        ? t + delay()
        : state.mode === 'classic'
          ? Infinity
          : t + between(...H.frenzyPollMs);
      if (!action) return;
      if (human && state.mode === 'frenzy' && nextInt(drv, 'misc', 1000) / 1000 >= H.frenzyActP)
        return;
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
