# WS1 progress (rules engine + bots)

## Branch / base
`ws1-engine`, stacked on `origin/ws0-contracts` (WS0 not merged to main yet). PR base: `ws0-contracts`.

## Done
- Slice 1: seeded RNG (`src/rng.ts`), pack index (`src/pack.ts`), setup/deck build (`src/setup.ts`), scoring (`src/scoring.ts`), synthetic 60-item pack for tests/sim (`src/testing/synthPack.ts`). Tests: R1-R6, R32-R36 (`test/setup-scoring.test.ts`).
- Slice 3: tests for specials/Gifts (R25-R31, R37, `test/gifts.test.ts`) and Frenzy (F1-F8, `test/frenzy.test.ts`).
- Slice 2: full engine implemented in `src/game.ts` (Classic, Frenzy, Gifts), `src/engine.ts` (`createEngine(pack)`, `engine`), `src/bots.ts`, `src/testing/driver.ts` (simulated-clock bot driver). Classic tests R7-R24 in `test/classic.test.ts`.

## In progress
- Slice 4: tools/sim CLI and balance run.

## Next
1. (done) Slice 3 added test/gifts.test.ts (R25-R31, R37) and test/frenzy.test.ts (F1-F8).
2. Slice 4: `tools/sim` CLI (uses `playGame` from `packages/engine/src/testing/driver.ts`); run 1000 games per player count and mode, tune bots/CONFIG if hard limits fail, record results here.
3. Slice 5: replay golden test, fast-check properties (SHOULD), docs, then the draft PR.

## Gotchas / decisions
- `src/stub.ts` and `src/index.ts` are untouched (public API frozen). Real engine: `src/engine.ts` (`engine`, `createEngine`, `RealEngine` adds `revealDelayMs`, `botActionAt(level, ...)`). OPEN QUESTION (contract): index.ts should export the real engine instead of `stubEngine`; room-core needs `revealDelayMs` for R37 and a way to pick bot skill (contract `botAction` has no level; it uses 'careful').
- Scoring tie for Display Case assignment follows 01 R34 literally: lowest category index wins even if the assignment has no effect.
- Fizzled Gift: giftLog entry has `victim = holder`, `card = null` (contract requires a victim id).
- Reveal `items` includes Display Cases (est = actual = 100, tag null) so totals are derivable; `players` is in rank order.
- Classic: roll happens when a call resolves (not after the gap); sweep/gifts start immediately after the final call resolves; `p` uses calls completed including the current call.
- Frenzy last-round time cap is `frenzyMaxMs` (unscaled by Relaxed).
- `CONFIG` gained `stealRatio`/`rippedRatio` (additive, from 04 reveal tags).
