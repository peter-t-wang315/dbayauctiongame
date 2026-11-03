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
- **B3** Gift copy (`GiftStep.tsx` `giftTitle()` + body): holder "Pick who has to give you an item:"; victim title "{holder}'s Gift picked you!" + "Give {holder} one of your items:"; holder while waiting "{victim} is giving you an item..."; others "{victim} is giving {holder} an item..." / "{holder} is choosing who has to give them an item...". Tests in `GiftStep.test.tsx`; docs/04 3.5b updated.
- **B6** fixed hotkeys: `cardForKey()` (`selection.ts`) maps `CARD_KEYS` to `handSlots()` positions, so a key always means the same card; spent/out cards keep their key and badge, and pressing it flashes the B2 reason. Legend reads "1-0 $10-$300". Tests: `gameUi.test.ts`, desktop e2e (badges keep 3/4 after a bid); docs/04 section 6 shortcut text updated.

- **B8** category chip (`game.css`): the chip and its label may shrink (ellipsis only as a last resort, never past the bay edge); a crowded head (`:has(.g-pill, .g-hint)`) drops the chip to 10px on phones; on desktop (>=1024px) the head wraps so the chip moves to its own line at full 13px.
- **B9** `BottomSheet.tsx`: tap-away close now requires the press to start and end outside the sheet (no accidental close from a drag that starts inside), closes on the click (no ghost tap on the game below), and the scrim has `cursor: pointer` so iOS Safari delivers the click. e2e in `game.pw.ts`.
- **B10** `next.config.ts`: `devIndicators: false`.

- Machine checks (2026-10-28): `pnpm typecheck`, `pnpm lint`, `pnpm test` green (engine 146, web 105, room-core 53, ...). Web Playwright e2e: 27 passed, 1 skipped (run on temporary copies with ports 3117/8797 because another agent held 8787; a11y + fx first hit "mock did not start" in the full run and passed on rerun).

## In progress
- Nothing. Slice 1 is done; awaiting review/PR by the user.

## Next
- Pre-PR review per docs/README "Git workflow", then PR `fix/playtest-quick-fixes` -> `main`.
- Not yet eyeballed: B8 in the exact crowded case (winning pill + COLLECTIBLES at 1280 and 390); worth a glance in the review.

## Gotchas / decisions
- The engine keeps `turn.player === me` through the `gap` after my bid/pass (R10), so the banner must look at `turn.phase`, not just the player.
- tools/e2e and the playtest harness key on `[data-fx="turn-banner"][data-mine="true"]`; it now holds only during my open window, which is what they want (they act on it).
- B9: the scrim already closed on click before this branch; the playtest harness clicked game elements covered by the sheet (force clicks land on the sheet), which reads as "doesn't close". The fix hardens the real-device path (iOS click, drag-from-inside) rather than closing on taps that land on the sheet.
- B8: the user decided one category name everywhere (2026-10-12), so no abbreviations; the fix only shrinks/wraps.
- Playwright treats `aria-disabled="true"` as not actionable and waits; e2e taps on spent/out cards need `click({ force: true })`.
- Next 16.4 dev prints a security-advisory nudge and exits on every other start ("retry the same command"); just rerun. The upgrade stays on its own branch (docs/README open item 6).
- Python on Windows writes CRLF; normalize edited files back to LF (`sed -i 's/\r$//'`).
