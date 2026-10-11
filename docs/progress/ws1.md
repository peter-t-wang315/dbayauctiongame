# WS1 progress (rules engine + bots)

## Branch / base
`ws1-engine`, stacked on `origin/ws0-contracts` (WS0 not merged to main yet). PR base: `ws0-contracts`.

## Done
- Slice 1: seeded RNG (`src/rng.ts`), pack index (`src/pack.ts`), setup/deck build (`src/setup.ts`), scoring (`src/scoring.ts`), synthetic 60-item pack for tests/sim (`src/testing/synthPack.ts`). Rules covered: R1-R6, R32-R36.

## In progress
- Slice 2: core game flow (Classic).

## Next
1. Slice 2: `src/engine.ts` with `createEngine(pack)`: bidding legality (R15-R16), Classic calls (R7-R14), close roll (R17-R18), sale/refill/sweep (R19-R24). Tests in `test/classic.test.ts`.
2. Slice 3: specials + Gifts (R25-R31), R37 helper.
3. Slice 4: Frenzy F1-F8.
4. Slice 5: bots (`src/bots.ts`), `tools/sim`.
5. Slice 6: replay golden test, fast-check properties, docs, PR.

## Gotchas / decisions
- The stub in `src/stub.ts` and `src/index.ts` are left untouched (public API frozen). The real engine is exported from `src/engine.ts` and the `./real` subpath. OPEN QUESTION (contract): index.ts should export the real `engine` / `createEngine`.
- Scoring tie for Display Case assignment follows 01 R34 literally: lowest category index wins even if the assignment has no effect.
