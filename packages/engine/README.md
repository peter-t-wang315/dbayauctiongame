# @dbay/engine

Pure, deterministic rules engine for dBay (docs/01-game-rules.md, docs/02-modes-and-scaling.md). No I/O, no clock, no `Math.random`: time is passed in and randomness comes from per-stream seeded PRNGs stored in the state.

## Exports

- `src/index.ts` (frozen contract): types, `CONFIG`, and the WS0 `stubEngine`.
- `@dbay/engine/real` (`src/engine.ts`): `createEngine(pack)`, `engine` (uses the active content pack), plus `createGame` / `applyAction` / `tick` aliases. `RealEngine` extends the contract `Engine` with `revealDelayMs(state)` (R37) and `botActionAt(level, ...)`.
- `@dbay/engine/testing`: `playGame` (simulated-clock bot driver) and `synthPack` (60-item stand-in pack) for tests and `tools/sim`.

## Layout

| File             | Rules                                              |
| ---------------- | -------------------------------------------------- |
| `src/config.ts`  | every ASSUMED constant                             |
| `src/rng.ts`     | R6 seeded streams                                  |
| `src/setup.ts`   | R1-R5                                              |
| `src/game.ts`    | R7-R31, F1-F8 (state machine)                      |
| `src/scoring.ts` | R32-R36                                            |
| `src/bots.ts`    | random / greedy / careful, public information only |

## Testing

`pnpm --filter @dbay/engine test`. Every rule ID appears in a test name (`R16: ...`, `F5: ...`). `test/replay.test.ts` holds the replay and golden snapshots; `test/properties.test.ts` holds the fast-check properties.
