# room-core replay property flake

**Branch / base:** `fix/room-core-replay-flake` off `origin/main` (7ad428c).

## Done
- Reproduced `packages/room-core/test/replay.test.ts` > "fast-check: reducer never throws on arbitrary
  event sequences" > "holds invariants" locally with inflated runs (temporary, not committed):
  `numRuns: 200000`, seeds 1, 2, 3 all failed (after 4665, 32719 and 102372 runs). With the committed
  `numRuns: 300` and a random seed, that is roughly a 1-6% chance per `pnpm test`.
- Shrunk counterexample (fast-check `seed: 2`, path
  `32718:2:0:1:5:4:5:9:9:10:9:9:11:10:10:10:12:12:14:14:14:15:14:14:14:16:15:15:15:15:15:15:16:16:19:21:20:3:3:3:19:19:19:19:23:25:24:25:22:22`):
  ```
  seed ","; join bot1, p1, p4 (name "!", hash h1); action bot1 {t:'start', seq:1}; seed ""
  ```
  Failure: `expected '{"code":"K7QMX","phase":"playing",...' not to contain ','`.
  Seed 1 shrank to the same shape with seed `" "` (player names get de-duplicated to `"! 2"`).
- **Root cause: a false positive in the test, not a reducer/engine bug.** The leak check was
  `expect(JSON.stringify(view(state, 'ghost'))).not.toContain(state.game.seed)`. The fuzzer generates
  seeds with `fc.string({ maxLength: 6 })`, so the game sometimes starts with a 1-char seed like `,`
  or ` `, which is present in every view's JSON for unrelated reasons. No randomness, clock or timeout
  is involved (300 runs take about 0.1 s).
- **Fix (test only, invariant kept and made stronger):** new helper `expectSeedNotInViews`:
  - Structural check: swap `game.seed` and the pending `meta.seed` in a clone; every view (each
    player and `ghost`) must stay byte-identical. That is sound for any seed. It now covers
    `meta.seed` and all viewers, where the old check covered only `game.seed` and `ghost`.
  - Substring check, only for "marked" seeds (`§seed§...`; `§` is non-ASCII, so `fc.string` never makes
    it and no view text has it). The generator now mixes raw seeds (for reducer robustness) with
    marked ones. This also catches a seed copied into some other state field.
- Deterministic regression tests: the shrunk counterexample replayed (asserts the game started with
  seed `,`, the view contains `,` anyway, and the helper passes), plus a positive test that a marked
  seed copied into a player name is caught.
- Verification: inflated 200k runs with seeds 1, 2, 3 (the ones that failed before), 42, 1337, 99999
  all pass after the fix. Typecheck, lint and all unit tests pass; room-core tests run repeatedly.

## In progress
- Nothing.

## Next
- Review and merge the draft PR.

## Gotchas / decisions
- No change to `packages/room-core/src` or `packages/engine`. The reducer correctly never puts the seed
  in a view; `docs/01-game-rules.md` R6 and the `meta.seed` doc comment ("SECRET; never in a view")
  stand as they are.
- Any future "secret not in JSON" substring check should use a distinctive secret or a structural
  swap check. Fuzzed short strings collide with ordinary JSON punctuation.
