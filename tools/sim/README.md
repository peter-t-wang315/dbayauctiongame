# @dbay/sim

Balance simulator (docs/02 section 5). Plays many bot games on a simulated clock and reports the balance metrics and hard limits.

```
pnpm --filter @dbay/sim start -- --games 1000 [--players 3,4,5,6] [--modes classic,frenzy]
  [--lengths quick,standard] [--pacing bot,human] [--levels careful,greedy,random]
  [--seed s] [--pack auto|synth|active] [--reaction 1500,4000] [--assert]
  [--override-file tuning.json | --override '{...}']
```

- `--lengths`: game length presets (`LENGTH_PRESETS`). Median-length targets per mode x preset: Classic Quick 8-12 min, Classic Standard 15-25 (3 players 12-15), Frenzy Quick 3.5-7 (intentionally shorter than Classic), Frenzy Standard 5.5-10. Classic also reports rounds played (median / max; target <= ~50). Standard collection share is accepted up to 95% (ASSUMED, pending playtest).
- `--pack auto` (default) picks the active (real) content pack when it has 60 or more items, else the synthetic pack. `--pack active` forces the real pack. Published numbers (docs/02 section 7) use the real pack.
- Classic auto-skip limit is < 5% per cell, except Standard 3 players which accepts < 8% (user decision 2026-10-11, ASSUMED, revisit after playtest) so it can reach 12-15 min; skip rises with game length at a fixed deck (cards stay locked on bays). The limits are measured with all-careful bots (the default `--levels careful`). With mixed bots (`--levels random,greedy,careful`) skip is much higher (e.g. Standard 3p 18.9%, 4p 19.4%); that is a known playtest risk, see docs/02 section 7.
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
