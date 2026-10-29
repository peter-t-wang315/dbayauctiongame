# First-game tips (playtest follow-ups, slice 2)

Plan: [playtest-followups.md](playtest-followups.md) "Slice 2". Source: [the 2026-10-27 AI playtest](../playtests/2026-10-27-ai/README.md) "Clarity".

## Branch / base
- `feat/first-game-tips`, off `fix/playtest-followups` @ `a4f58b6` (the plan doc; that is `main` @ `7ad428c` + docs). Slices 1 and 3 run in parallel on their own branches; keep edits to shared files (viewModel.ts, StatusStrip.tsx, GameScreen.tsx) additive.

## Done
- Pure trigger module `apps/web/lib/game-ui/tips.ts` + `tips.test.ts` (vitest, 16 tests): five tips, priority order, per-device seen-set in localStorage (`dbay:tips`, every access in try/catch, `"off"` = all seen).
- `TipToast` (`apps/web/components/game/TipToast.tsx` + `tips.css`), mounted in `GameScreen.tsx` right after `StatusStrip` (1 import + 1 line): own polite live region, "Got it" button, auto-hide 9s (paused on hover/focus), 3s gap between tips, slide-in only without reduced motion; marked seen as soon as shown.
- "3 = x2" reminder in the SETS strip (`Collections.tsx`, also in its aria-label); "Show first-game tips again" in Settings (`MenuPanel.tsx`, 1 import + 1 line).
- `TipToast.test.tsx` (server render: empty live region; SETS strip copy).
- docs/04 section 4.8 "First-game tips" (where, lifetime, memory, a11y, trigger/copy table).
- e2e `apps/web/e2e/tips.pw.ts` (3 tests: first-turn tip shows, a bay tap through the toast still bids, "Got it" hides it, not shown on the next turn; `"off"` suppresses; throwing storage still shows it). `pnpm typecheck`, `pnpm lint`, `pnpm test` green.

- Full web e2e (2026-10-28): 30 passed, 1 skipped (polish.pw.ts gift-step fit: the mock dealt no Gift in that run). Existing specs needed no changes.

## In progress
- Nothing. Slice complete.

## Next
1. Open the PR (`feat/first-game-tips`) after the pre-PR review (docs/README); rebase on main once slices 1 and 3 land (shared files touched: `GameScreen.tsx` +2 lines, `MenuPanel.tsx` +2 lines, `Collections.tsx` +4/-1).
2. Re-run the AI playtest after slices 1-2 (see playtest-followups "Gotchas").

## Gotchas / decisions
- **"First Proxy in hand"**: everyone starts with 2 Proxies (R2), so "in hand" would fire at game start on top of the first-turn tip. ASSUMED: the Proxy tip fires the first time a Proxy is on any bay, or I select a Proxy card.
- **Outbid trigger** is state-based (a bay still holds one of my cards but someone else is top), not log-based, so it also catches outbids that happened while the tab was away.
- **Pair trigger** is exactly 2 items of one category (Display Cases not counted; a jump straight to 3 skips the tip).
- **ASSUMED timings:** a tip stays 9s (paused on hover/focus), then at least 3s before the next.
- **E2E:** the toast is pointer-transparent except "Got it", so existing specs pass untouched; a spec can still suppress tips with `localStorage["dbay:tips"] = "off"` (addInitScript).
- **Local e2e gotcha:** `next dev` (16.4.0) prints a security-advisory nudge and exits on the first launch; start it again (or run Playwright twice). Other worktrees' dev servers on :3100 get reused by `reuseExistingServer`, so check the port is yours.
- **No tips outside `phase: playing`, `stage: bidding`** (the Gift step has its own UI).
- Copy checked against 01: R35 (cards in hand only break ties), R16 (card on a bay is out of hand until it closes; outbid player may bid there again), R19 (returns on close), R33 (3 = every card doubled), R15/R16.4 (latest Proxy is top; only a Proxy beats a Proxy), R27-R30 (Gift scores 0; after the last sale the holder picks a player who gives them a scorable card).
