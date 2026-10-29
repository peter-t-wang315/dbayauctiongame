# Playtest quick fixes (Slice 1 of docs/progress/playtest-followups.md)

Bug IDs (B1-B10) are from the "Problems" tables in [docs/playtests/2026-10-27-ai/README.md](../playtests/2026-10-27-ai/README.md). The plan lives in `playtest-followups.md` (not edited here: other branches work off it).

## Branch / base
- `fix/playtest-quick-fixes`, off `a4f58b6` (the plan commit on top of `main` @ `7ad428c`). Web only plus one engine test; no protocol change.

## Done
- **B1** stale "YOUR TURN": `bannerFor(view, pending)` (`viewModel.ts`) shows "Your turn" / `mine` only while my window is open and no bid is in flight; in the gap after my call the title is "Bid placed, waiting..." / "Passed" / "Skipped" (from my newest log entry since my last `turn`). `podiumModels(view, pending)` shows the turn marker only during a `window` phase. Wired in `GameScreen.tsx`. Tests: `gameUi.test.ts`, `podiums.test.ts`, `e2e/game.pw.ts`.
- **B2** silent taps: `cardTapReason()` in `legal.ts` (spent / on bay X until it closes / locked reason / sending). `GameScreen` flashes it (status text, polite live region); a bay tap with no card picked flashes the locked reason or "Pick a card first, then tap a bay". Illegal-bay taps already flashed. Tests: `gameUi.test.ts`, `e2e/game.pw.ts`.
- **B4** outbid line: "Outbid on {item} by {name}! $X".
- **B7** confirmed with two engine tests (`packages/engine/test/classic.test.ts`, R13 block): deck dry + other bays empty + the only item already topped by me (or by a Proxy when I hold none) -> autoPass with a full hand. Copy: "{name} has no bay to bid on: skipped" / mine "No bay you can bid on: skipped".
- docs/04 section 4.5 table + 4.6 updated with the new strings.

## In progress
- Nothing.

## Next
- B3 Gift copy (`GiftStep.tsx`, `GiftStep.test.tsx`, docs/04 3.5b), then B6, B8, B9, B10, then machine checks (`pnpm typecheck`, `pnpm lint`, `pnpm test`, web e2e).

## Gotchas / decisions
- The engine keeps `turn.player === me` through the `gap` after my bid/pass (R10), so the banner must look at `turn.phase`, not just the player.
- tools/e2e and the playtest harness key on `[data-fx="turn-banner"][data-mine="true"]`; it now holds only during my open window, which is what they want (they act on it).
- Python on Windows writes CRLF; normalize edited files back to LF (`sed -i 's/\r$//'`).
