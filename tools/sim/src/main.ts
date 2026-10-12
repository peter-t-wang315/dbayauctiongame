// Balance simulator CLI. Usage:
//   pnpm --filter @dbay/sim start -- [--games 1000] [--players 3,4,5,6] [--modes classic,frenzy]
//        [--levels careful] [--seed s] [--pack auto|synth|active] [--reaction 1500,4000] [--assert]
// Exits 1 when any HARD limit fails (non-terminating game, length >= 40 min, seat < 2 items,
// collections outside 15-85%) and --assert is set; non-terminating games always exit 1.
import type { GameLength } from '@dbay/protocol';
import { readFileSync } from 'node:fs';
import { LENGTH_PRESETS } from '@dbay/engine';
import { evaluate, pickPack, runBatch, type Level, type Mode } from './sim';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--')
    ? (process.argv[i + 1] as string)
    : def;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const games = Number(arg('games', '1000'));
const players = arg('players', '3,4,5,6').split(',').map(Number);
const modes = arg('modes', 'classic,frenzy').split(',') as Mode[];
const levels = arg('levels', 'careful').split(',') as Level[];
const lengths = arg('lengths', 'standard').split(',') as GameLength[];
const pacings = arg('pacing', 'bot').split(',') as Array<'bot' | 'human'>;
const seed = arg('seed', 'sim');
const pack = pickPack(arg('pack', 'auto'));
const [rMin, rMax] = arg('reaction', '1500,4000').split(',').map(Number) as [number, number];

// --override '{"standard":{"ROUNDS_BY_PLAYERS":{"3":80}}}' deep-merges into LENGTH_PRESETS (tuning aid).
function merge(dst: Record<string, unknown>, src: Record<string, unknown>) {
  for (const [k, v] of Object.entries(src)) {
    const cur = dst[k];
    if (v && typeof v === 'object' && cur && typeof cur === 'object')
      merge(cur as Record<string, unknown>, v as Record<string, unknown>);
    else dst[k] = v;
  }
}
const overrideFile = arg('override-file', '');
const override = overrideFile ? readFileSync(overrideFile, 'utf8') : arg('override', '');
if (override) merge(LENGTH_PRESETS as unknown as Record<string, unknown>, JSON.parse(override));

let hardFail = false;
let nonTerminating = 0;
console.log(
  `dBay sim: pack=${pack.packId} (${pack.items.length} items) games=${games} levels=${levels.join('/')} reaction=${rMin}-${rMax}ms lengths=${lengths.join('/')} pacing=${pacings.join('/')}`,
);
for (const length of lengths)
  for (const pacing of pacings)
    for (const mode of modes) {
      for (const n of players) {
        const t0 = performance.now();
        const r = runBatch({
          mode,
          players: n,
          games,
          levels,
          seed,
          pack,
          reactionMs: [rMin, rMax],
          length,
          pacing,
        });
        nonTerminating += r.nonTerminating;
        console.log(
          `\n== ${length} / ${pacing} pacing / ${mode} / ${n} players (${((performance.now() - t0) / 1000).toFixed(1)}s) ==`,
        );
        for (const c of evaluate(r)) {
          if (c.status === 'FAIL') hardFail = true;
          console.log(
            `  [${c.status.padEnd(4)}] ${c.name.padEnd(38)} ${c.value.padEnd(22)} target ${c.target}`,
          );
        }
        console.log(
          `  seat win shares: ${r.seatWinShare.map((w) => (w * 100).toFixed(1) + '%').join(' ')}`,
        );
        if (new Set(levels).size > 1) {
          console.log(
            `  by skill: ${Object.keys(r.levelWinShare)
              .map(
                (l) =>
                  `${l} win ${(r.levelWinShare[l]! * 100).toFixed(1)}% (${(r.levelWinPerSeat[l]! * 100).toFixed(1)}%/seat) score ${r.levelMeanScore[l]!.toFixed(0)} items ${r.levelMeanItems[l]!.toFixed(2)}`,
              )
              .join(' | ')}`,
          );
        }
      }
    }
if (nonTerminating > 0) {
  console.error(`\nFAIL: ${nonTerminating} non-terminating games`);
  process.exit(1);
}
if (flag('assert') && hardFail) {
  console.error('\nFAIL: hard limit exceeded (see FAIL rows)');
  process.exit(1);
}
