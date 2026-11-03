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
  - Swap check: replace `game.seed` and the pending `meta.seed` in a clone with a 40-char value
    (longer than any generated seed); every view (each player and `ghost`) must stay byte-identical,
    so no view reads either field. Works for any seed, including `,`. It now covers `meta.seed` and
    all viewers, where the old check covered only `game.seed` and `ghost`. It does not cover values
    derived from the seed (`game.rng`, deck order); `redaction.test.ts` already mutates those.
  - Substring check for marked seeds: every non-empty fuzzed seed is now `§seed§<fc.string>`. `§` is
    non-ASCII, so `fc.string` (printable ASCII) never makes it and no view text has it. `''` is kept
    raw to exercise the reducer's reject path. This catches a seed copied into another state field.
  - The mid-game property now starts with a marked seed and runs the same check every step, so the
    check also covers bidding, reveal and ended states.
- Deterministic regression tests: the shrunk counterexample replayed (asserts the game started with
  seed `,`, the view contains `,` anyway, and the helper passes); a marked game seed copied into a
  player name is caught; a pending lobby `meta.seed` passes clean and is caught when copied.
- Pre-PR review (`/code-review` medium, 1 round): no blocking bugs. Fixed from its notes: raw seeds
  lost the copy-detection (so all non-empty seeds are now marked), `meta.seed` had no deterministic
  test, the mid-game property had no leak check, the `''` seed handling was inconsistent, the swap
  value could match a seed's length, and the docstring overstated what it covers. Not changed: the
  extra `view()` calls per step (room-core suite still takes about 2 s).
- Verification: before the review fixes, inflated 200k runs with seeds 1, 2, 3 (the ones that failed
  before), 42, 1337 and 99999 all passed. After them, 100k "holds invariants" runs plus 5k mid-game
  runs with seeds 2, 7 and 31337 passed. Typecheck, lint and all unit tests pass; the room-core suite
  passed 15 times in a row.

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
