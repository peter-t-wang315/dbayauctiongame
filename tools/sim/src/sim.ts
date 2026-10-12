// Balance simulator core (docs/02 section 5): plays many bot games and aggregates metrics.
import { activePack, type ContentPack } from '@dbay/content';
import type { GameLength } from '@dbay/protocol';
import { createEngine } from '@dbay/engine/real';
import { playGame, synthPack } from '@dbay/engine/testing';

export type Level = 'random' | 'greedy' | 'careful';
export type Mode = 'classic' | 'frenzy';

export interface BatchOptions {
  mode: Mode;
  players: number;
  games: number;
  /** Skill per seat (cycled). One entry = all seats the same skill. */
  levels: Level[];
  seed: string;
  pack: ContentPack;
  /** Bot reaction time range, ms. Human-like by default. */
  reactionMs: [number, number];
  /** 'human' = people-like timing (see tools/sim/README.md). Default 'bot'. */
  pacing?: 'bot' | 'human';
  /** Game length preset. Default 'standard'. */
  length?: GameLength;
}

export interface BatchResult {
  mode: Mode;
  players: number;
  games: number;
  levels: Level[];
  length: GameLength;
  pacing: 'bot' | 'human';
  /** Classic: auto-skipped calls (no legal bid) / calls. */
  autoSkipRate: number;
  nonTerminating: number;
  rejected: number;
  lengthMin: { mean: number; median: number; p95: number; max: number };
  /** Classic: rounds actually played (calls done / players, rounded up). */
  roundsPlayed: { median: number; max: number };
  itemsPerPlayer: { mean: number; minSeat: number };
  dryEarlyShare: number;
  collectionShare: number;
  seatWinShare: number[];
  levelWinShare: Record<string, number>;
  levelMeanScore: Record<string, number>;
  levelMeanItems: Record<string, number>;
  unsoldShare: number;
  proxyWinShare: number;
  giftFizzleShare: number;
  scoreSpread: number;
}

export function pickPack(name: string): ContentPack {
  if (name === 'synth') return synthPack();
  if (name === 'active') return activePack;
  // auto: the real base pack once WS2 lands, otherwise the synthetic stand-in
  return activePack.items.length >= 60 ? activePack : synthPack();
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function runBatch(o: BatchOptions): BatchResult {
  const engine = createEngine(o.pack);
  const n = o.players;
  const lengths: number[] = [];
  const roundsList: number[] = [];
  const itemsBySeat: number[][] = Array.from({ length: n }, () => []);
  const wins = new Array<number>(n).fill(0);
  const levelWins: Record<string, number> = {};
  const levelScores: Record<string, number[]> = {};
  const levelItems: Record<string, number[]> = {};
  const levelSeats: Record<string, number> = {};
  let nonTerminating = 0;
  let autoSkips = 0;
  let calls = 0;
  let rejected = 0;
  let dryPlayers = 0;
  let collectors = 0;
  let sold = 0;
  let proxySold = 0;
  let unsold = 0;
  let deckCards = 0;
  let gifts = 0;
  let fizzles = 0;
  const spreads: number[] = [];
  const levelOf = (seat: number) => o.levels[seat % o.levels.length] as Level;

  for (let g = 0; g < o.games; g++) {
    const seed = `${o.seed}-${o.mode}-${n}-${g}`;
    const r = playGame({
      engine,
      setup: {
        seed,
        mode: o.mode,
        bidWindowMs: 5000,
        relaxed: false,
        length: o.length ?? 'standard',
        players: Array.from({ length: n }, (_, i) => ({
          id: `p${i}`,
          isBot: true,
          connected: true,
        })),
      },
      levels: Array.from({ length: n }, (_, i) => levelOf(i)),
      reactionMs: o.reactionMs,
      pacing: o.pacing ?? 'bot',
      maxMs: 3 * 3600_000,
    });
    rejected += r.rejected;
    if (!r.terminated) {
      nonTerminating++;
      continue;
    }
    const dur = r.endMs - r.startMs;
    lengths.push(dur / 60000);
    roundsList.push(Math.ceil(r.state.callsDone / n));
    const score = engine.score(r.state);
    const top = score.players.filter((p) => p.rank === 1);
    const totals = score.players.map((p) => p.total);
    spreads.push(Math.max(...totals) / Math.max(1, Math.min(...totals)));
    score.players.forEach((p) => {
      const seat = r.state.players.findIndex((x) => x.id === p.id);
      const lvl = levelOf(seat);
      itemsBySeat[seat]!.push(p.items.length);
      (levelScores[lvl] ??= []).push(p.total);
      (levelItems[lvl] ??= []).push(p.items.length);
      if (p.collections.length > 0) collectors++;
      if (p.rank === 1) {
        wins[seat]! += 1 / top.length;
        levelWins[lvl] = (levelWins[lvl] ?? 0) + 1 / top.length;
      }
    });
    for (let seat = 0; seat < n; seat++)
      levelSeats[levelOf(seat)] = (levelSeats[levelOf(seat)] ?? 0) + 1;
    const dryCut = r.startMs + 0.75 * dur;
    for (const p of r.state.players) if ((r.dryAt[p.id] ?? Infinity) < dryCut) dryPlayers++;
    for (const { e } of r.events) {
      if (e.kind === 'autoPass') autoSkips++;
      if (e.kind === 'sold') {
        sold++;
        if (e.amount === 'proxy') proxySold++;
      } else if (e.kind === 'unsold') unsold++;
    }
    deckCards += r.state.deckSize;
    calls += r.state.callsTotal;
    for (const gl of r.state.giftLog) {
      gifts++;
      if (gl.card === null) fizzles++;
    }
  }
  const done = o.games - nonTerminating;
  lengths.sort((a, b) => a - b);
  const seatMeans = itemsBySeat.map(mean);
  const levelWinShare: Record<string, number> = {};
  const levelMeanScore: Record<string, number> = {};
  const levelMeanItems: Record<string, number> = {};
  for (const l of Object.keys(levelSeats)) {
    levelWinShare[l] = done ? (levelWins[l] ?? 0) / done : 0;
    levelMeanScore[l] = mean(levelScores[l] ?? []);
    levelMeanItems[l] = mean(levelItems[l] ?? []);
  }
  return {
    mode: o.mode,
    players: n,
    games: o.games,
    levels: o.levels,
    length: o.length ?? 'standard',
    pacing: o.pacing ?? 'bot',
    autoSkipRate: calls ? autoSkips / calls : 0,
    nonTerminating,
    rejected,
    lengthMin: {
      mean: mean(lengths),
      median: median(lengths),
      p95: lengths[Math.floor(lengths.length * 0.95)] ?? 0,
      max: lengths.at(-1) ?? 0,
    },
    roundsPlayed: { median: median(roundsList), max: Math.max(0, ...roundsList) },
    itemsPerPlayer: { mean: mean(seatMeans), minSeat: Math.min(...seatMeans) },
    dryEarlyShare: done ? dryPlayers / (done * n) : 0,
    collectionShare: done ? collectors / (done * n) : 0,
    seatWinShare: wins.map((w) => (done ? w / done : 0)),
    levelWinShare,
    levelMeanScore,
    levelMeanItems,
    unsoldShare: deckCards ? unsold / deckCards : 0,
    proxyWinShare: sold ? proxySold / sold : 0,
    giftFizzleShare: gifts ? fizzles / gifts : 0,
    scoreSpread: median(spreads),
  };
}

export interface Check {
  name: string;
  value: string;
  status: 'ok' | 'warn' | 'FAIL';
  target: string;
}

/** Compare against the docs/02 section 5 targets and hard limits. */
export function evaluate(r: BatchResult): Check[] {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const checks: Check[] = [];
  const std = r.length === 'standard';
  // Targets per mode x preset x players (docs/02 section 5).
  const [lo, hi] =
    r.mode === 'frenzy'
      ? r.length === 'quick'
        ? [3.5, 7]
        : [5.5, 10]
      : r.length === 'quick'
        ? [8, 12]
        : r.players === 3
          ? [12, 15]
          : [15, 25];
  const add = (name: string, value: string, status: Check['status'], target: string) =>
    checks.push({ name, value, status, target });
  add(
    'non-terminating games',
    String(r.nonTerminating),
    r.nonTerminating === 0 ? 'ok' : 'FAIL',
    '0',
  );
  add(
    'game length min (median / p95 / max)',
    `${r.lengthMin.median.toFixed(1)} / ${r.lengthMin.p95.toFixed(1)} / ${r.lengthMin.max.toFixed(1)}`,
    r.lengthMin.max >= 40
      ? 'FAIL'
      : r.lengthMin.median >= lo && r.lengthMin.median <= hi
        ? 'ok'
        : 'warn',
    `${lo}-${hi} (hard <40)`,
  );
  if (r.mode === 'classic')
    add(
      'rounds played (median / max)',
      `${r.roundsPlayed.median} / ${r.roundsPlayed.max}`,
      r.roundsPlayed.max <= 50 ? 'ok' : 'warn',
      '<=~50',
    );
  add(
    'items per player (mean / worst seat)',
    `${r.itemsPerPlayer.mean.toFixed(2)} / ${r.itemsPerPlayer.minSeat.toFixed(2)}`,
    r.itemsPerPlayer.minSeat < 2 ? 'FAIL' : r.itemsPerPlayer.mean >= 3 ? 'ok' : 'warn',
    '>=3 (seat >=2)',
  );
  add('dry before last 25%', pct(r.dryEarlyShare), r.dryEarlyShare < 0.2 ? 'ok' : 'warn', '<20%');
  add(
    'players with a collection',
    pct(r.collectionShare),
    r.collectionShare < 0.15 || r.collectionShare > (std ? 0.98 : 0.85)
      ? 'FAIL'
      : r.collectionShare >= 0.3 && r.collectionShare <= (std ? 0.95 : 0.7)
        ? 'ok'
        : 'warn',
    std ? '30-95% (ASSUMED, pending playtest)' : '30-70% (hard 15-85)',
  );
  const fair = 1 / r.players;
  const dev = Math.max(...r.seatWinShare.map((w) => Math.abs(w - fair))) * 100;
  const same = new Set(r.levels).size === 1;
  add(
    'seat win-share deviation (pts)',
    dev.toFixed(1),
    !same ? 'ok' : dev <= 8 ? 'ok' : 'warn',
    same ? '<=8 (same skill)' : 'n/a (mixed skill)',
  );
  add(
    'auto-skip rate (classic calls)',
    pct(r.autoSkipRate),
    r.autoSkipRate < 0.05 ? 'ok' : 'warn',
    '<5% (rare)',
  );
  add('unsold share', pct(r.unsoldShare), r.unsoldShare < 0.1 ? 'ok' : 'warn', '<10%');
  add(
    'Proxy share of sales',
    pct(r.proxyWinShare),
    r.proxyWinShare >= 0.1 && r.proxyWinShare <= 0.3 ? 'ok' : 'warn',
    '10-30%',
  );
  add('Gift fizzle share', pct(r.giftFizzleShare), r.giftFizzleShare < 0.05 ? 'ok' : 'warn', '<5%');
  add(
    'score spread winner/last',
    `${r.scoreSpread.toFixed(2)}x`,
    r.scoreSpread >= 1.2 && r.scoreSpread <= 4 ? 'ok' : 'warn',
    '1.2-4x',
  );
  add(
    'first-seat win-rate advantage (pts)',
    (((r.seatWinShare[0] ?? 0) - fair) * 100).toFixed(1),
    !same || Math.abs(((r.seatWinShare[0] ?? 0) - fair) * 100) < 5 ? 'ok' : 'warn',
    '<5',
  );
  add('rejected bot actions', String(r.rejected), r.rejected === 0 ? 'ok' : 'warn', '0');
  return checks;
}
