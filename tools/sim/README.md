# @dbay/sim

Balance simulator (docs/02 section 5). Plays many bot games on a simulated clock and reports the balance metrics and hard limits.

```
pnpm --filter @dbay/sim start -- --games 1000 [--players 3,4,5,6] [--modes classic,frenzy]
  [--lengths quick,standard] [--pacing bot,human] [--levels careful,greedy,random]
  [--seed s] [--pack auto|synth|active] [--reaction 1500,4000] [--assert]
  [--override-file tuning.json | --override '{...}']
```

- `--lengths`: game length presets (`LENGTH_PRESETS`). Length targets are Quick 8-12 min, Standard 15-25 min.
- `--override` / `--override-file`: deep-merge JSON into `LENGTH_PRESETS` for tuning experiments without editing `config.ts`, e.g. `{"standard":{"ROUNDS_BY_PLAYERS":{"3":120}}}`.
- Exit code 1 on any non-terminating game, or with `--assert` on a hard-limit FAIL.

## Pacing assumptions (ASSUMED, no playtest data yet)

- **`--pacing bot`** (default): each seat polls every `--reaction` ms (uniform, default 1.5-4 s) and acts at once if its policy has an action. Fast and mechanical.
- **`--pacing human`**: people-like timing. Constants live in `HUMAN_PACING` (`packages/engine/src/testing/driver.ts`):
  - Classic: when a call window opens, the caller acts at a uniform 40-90% of the window (2-4.5 s of a 5 s window); with probability 0.10 they let it expire (pass by timeout).
  - Frenzy: each seat looks at the board every 1.5-5 s (uniform); if the policy has a bid it bids with probability 0.8.
  - Gift choices (target, item): 2-6 s.
- Game-length targets in docs/02 apply to human pacing. If real players are faster or slower, retune `ROUNDS_BY_PLAYERS`, `CLOSE_BY_PLAYERS` and the Frenzy timers in `LENGTH_PRESETS`.

Auto-skip rate (Classic) is reported as the share of calls skipped because the called player had no legal bid (R13).
