# Win moment (playtest 2026-11-02 P1, P7, P9)

Source: [2026-11-02 AI playtest](../playtests/2026-11-02-ai/README.md).

## Branch / base
- `feat/win-moment`, off `origin/main` @ `2db9cd1`. Web only; no rule, protocol or engine changes. Avoids Hand components, `legal.ts` (imports `bayLegality` only) and the GameScreen key handler.

## Done
- **P1 lasting win cue.** `lib/game-ui/win.ts` (+ `win.test.ts`): `newWin` (my newest sale after a baseline, so reconnects show no history cue), `winCleared` (my next bid/pass/autoPass/turn), `winLine`, `wildTarget`. `useWinCue` hook in `hooks.ts`. Marks: SETS strip row (front, gold ring, NEW), Your sets row (NEW, ring) in `DesktopRail`/`MySets`, my podium sprite (`freshId`), `game.css` "win moment" block (pulse only under `prefers-reduced-motion: no-preference`). Status line shows "You won {item}!" until my next action; GameScreen edits are small (hook, `winText` in `stripText`, `silent`, three props).
- **P7** wild pinned in the SETS strip before the sets ("WILD x2 -> Toys"), also in its aria-label; the sheet / rail row now says which set it joins.
- **P9** Gift tip: fires only when `canAct` and a card in hand (not already on a bay) is legal on a bay holding a Gift, or I hold/won a Gift. `tips.test.ts` updated.
- e2e (`fx.pw.ts`): mobile win cue persists past the toast, not clipped, ends on my next bid; desktop rail/podium marks with reduced motion (animation none). Screenshots: `docs/mockups/win-moment/win-390.png`, `win-1280.png` (set `WIN_SHOTS=<dir>`).
- docs/04: sale-moment bullet, SETS strip (4.4), tips table.

## In progress
- Nothing.

## Next
- Pre-PR review; un-draft after CI.

## Gotchas / decisions
- **Win line beats "Going once..."** in Frenzy (that text is on almost constantly there, it would hide the win); a flash (local message) still beats the win line, and a newer urgent entry for me (outbid) replaces it.
- Haptic: the existing `soldMine` pattern in `lib/fx/haptics.ts` already fires on my win (Android only); nothing added.
- Screen readers: untouched. Strip is `silent` while it shows the win, announce.ts reads "Sold to you: {item}" once.
- Opening the sets sheet does not clear the cue (it shows NEW inside); only acting does.
- The wild pill is hidden when I hold no Display Case (no room at 390px).
- No deterministic Gift in the mock, so the Gift tip timing is covered by unit tests only.
- e2e wins are random against bots: the helper polls every 100ms because my own next bid ends the cue.
