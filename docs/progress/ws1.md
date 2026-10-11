# WS1 progress (rules engine + bots)

## Branch / base
`ws1-engine`, stacked on `origin/ws0-contracts` (WS0 not merged to main yet). Draft PR base: `ws0-contracts`.

## Done
- Slice 1: seeded RNG, pack index, setup/deck build, scoring, synthetic 60-item pack. Tests R1-R6, R32-R36.
- Slice 2: engine state machine (`src/game.ts`: Classic, Frenzy, Gifts), `src/engine.ts` (`createEngine`), bots, simulated-clock driver. Classic tests R7-R24.
- Slice 3: Gift/special tests R25-R31, R37 and Frenzy tests F1-F8.
- Slice 4: `tools/sim` CLI (`pnpm --filter @dbay/sim start -- --games 1000 [--players 3,4 --modes classic --levels careful,greedy,random --assert]`).
- Slice 5: replay test, golden snapshots, fast-check properties (5 properties across 2 tests), package README, bot tuning.
- Every rule ID R1-R37 and F1-F8 has a test whose name contains it.

Sim result (1000 games per mode and player count, all-careful bots, synthetic 60-item pack, bot reaction 1.5-4 s): 0 non-terminating games, 0 rejected bot actions, all hard limits pass. Warnings (see "Open questions"): game length, collection share for 3-4 players and Frenzy, score spread at 6 players.

## In progress
Nothing. Remaining optional work: tune warnings (needs a user decision on constants), swap synthPack for the real pack once WS2 lands and rerun the sim.

## Next
1. After WS2 merges: `pnpm --filter @dbay/sim start -- --pack active --games 1000` and re-evaluate (sim picks the active pack automatically when it has 60+ items).
2. After the contract question below is settled: export the real engine from `packages/engine/src/index.ts`.

## Gotchas / decisions
- `src/stub.ts` and `src/index.ts` are untouched (public API frozen). Real engine: `@dbay/engine/real` (`src/engine.ts`: `engine`, `createEngine(pack)`, `RealEngine` adds `revealDelayMs(state)` and `botActionAt(level, ...)`). New subpath exports in `packages/engine/package.json`: `./real`, `./testing`. fast-check 4.10.2 added as engine devDependency; `tools/sim` is a new workspace package (pnpm-lock.yaml updated accordingly).
- Setup throws RangeError for player counts outside 3-6 (setup has no error channel). `apply` never throws.
- Scoring tie for Display Case assignment follows 01 R34 literally: lowest category index wins even if the assignment has no effect.
- Fizzled Gift: giftLog entry has `victim = holder`, `card = null` (contract requires a victim id). Event `special` with `extra: 'fizzle'`.
- Reveal `items` includes Display Cases (est = actual = 100, tag null) so totals are derivable; `players` is in rank order; `tiebreak` always set.
- Classic: close roll happens when a call resolves (not after the gap); the sweep and gifts start immediately after the final call; `p` uses calls completed including the current call. First call starts inside `setup`.
- Classic late bid: during the gap, the previous caller gets TOO_LATE, others NOT_YOUR_TURN.
- Frenzy: last-round time cap `frenzyMaxMs` is not scaled by Relaxed; hard cap and others are. Last round triggers at setup if the deck is already empty.
- `CONFIG` gained `stealRatio`/`rippedRatio` (additive, from 04 reveal tags).
- Bot synergy weights (bots.ts `worth`) were lowered to 1.5 / 1.1 to keep collection share down; bots treat bid cards as plentiful (about half go unused) and pay up to 1.6 x estimate.

## Open questions for the user / contract
1. Contract: `index.ts` should export the real engine instead of `stubEngine`; room-core needs `revealDelayMs` (R37) and a way to pick bot skill (contract `botAction` has no level, it uses 'careful'). Suggested additive contract PR.
2. Game length cannot reach the 15-25 min target with the current constants: Classic is capped near calls x (window + gap) = 90 x 6.5 s = about 10 min for 3 players (sim: 3-5.5 min with bot reaction times), Frenzy is deck / bays x about 24 s = 2.4-3.7 min. Options: longer Frenzy open timers, fewer bays, bigger decks, or more Classic rounds. Needs a decision before tuning.
3. Collections: 73-84% of players complete one at 3-4 players (and in Frenzy at all sizes) with careful bots; target is 30-70%. Trying 5/6 categories in play at 3/4 players gives about 71% / 68%. Raise `catsInPlay` (01 section 8)? Human players are probably less collection-driven than the bots.
4. Score spread winner/last (median) is above 4x at 6 players (about 5.7x classic): one unlucky seat gets few items.
5. Frenzy bot skill is flat: careful does not beat random bots there (the Frenzy sim is mostly decided by who bids fast).

---

# Follow-up: real engine export + game length presets

## Branch / base
Part 1: `contract/engine-real-and-length`, base `ws1-engine` (draft PR base `ws1-engine`). Part 2: `ws1-engine/length-presets`, base the contract branch. User decisions: new lobby option `length: 'quick'|'standard'` (default standard, independent of mode); Standard ~8 deck cards/player, Quick ~6; catsInPlay 3p 4->5, 4p 5->6 (max 6).

## Done
- Contract PR: `index.ts` exports `engine`/`createEngine`/`RealEngine`; `Engine.botAction(..., level?)` and `Engine.revealDelayMs`; `GameSetup.length`, `EngineState.length`; protocol v2 `length` on setOpts and PlayerView.opts (optional); `LENGTH_PRESETS`/`presetOf` in config.ts (placeholders equal to the old values; DECK_BY_PLAYERS, ROUNDS_BY_PLAYERS, frenzyOpenMin/MaxMs moved from CONFIG into presets); mock-server echoes `length`; docs/05 updated; golden snapshots regenerated (additive `length` field).

## In progress
Nothing.

## Next
Part 2: human-pacing mode in tools/sim; tune LENGTH_PRESETS; update docs 01 s8-9 and 02; preset deck tests.

## Gotchas / decisions
- `stubEngine` kept for tests; `engine` is the real one.
- `length` is optional everywhere (absent = standard) so apps/web on another branch keeps typechecking.

## Part 2 progress (branch ws1-length-presets; NOTE: `ws1-engine/length-presets` is impossible because branch `ws1-engine` exists)
- Done: sim `--pacing human`, `--lengths`, `--override-file`; presets hold deck/rounds/close-roll (per player count)/Frenzy timers. Classic tuned at 60-100 games: Quick 9.3-9.9 min, Standard 15-17+ min (human pacing).
- Collection share (careful bots, Standard, 6 cats): 86-91%, structural (random bots 68-75%); cannot be fixed within 6 categories. Report to user.
- Standard 3p Classic auto-skip about 5%.
- Next: tune Frenzy timers (presets), docs 01/02 updates, preset deck tests, final 1000-game runs, PR.

## Part 2 final (ws1-length-presets)
- Done: presets tuned, docs 01/02 updated, sim README, preset deck tests, 1000-game runs (tables in docs/02 section 7 and the PR body).
- Misses: Frenzy 3p short (Quick 7.3 / Standard 13.1 min); collection share 62-92% (structural); Classic 6p spread 3.3x-6.7x; 3p Standard Classic auto-skip about 5%.
- Next: pre-PR subagent review (by caller), real pack rerun after WS2, user decision on Frenzy timer length (60-130 s per auction is long).
