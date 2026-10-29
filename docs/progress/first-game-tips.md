# First-game tips (playtest follow-ups, slice 2)

Plan: [playtest-followups.md](playtest-followups.md) "Slice 2". Source: [the 2026-10-27 AI playtest](../playtests/2026-10-27-ai/README.md) "Clarity".

## Branch / base
- `feat/first-game-tips`, off `fix/playtest-followups` @ `a4f58b6` (the plan doc; that is `main` @ `7ad428c` + docs). Slices 1 and 3 run in parallel on their own branches; keep edits to shared files (viewModel.ts, StatusStrip.tsx, GameScreen.tsx) additive.

## Done
- Pure trigger module `apps/web/lib/game-ui/tips.ts` + `tips.test.ts` (vitest, 16 tests): five tips, priority order, per-device seen-set in localStorage (`dbay:tips`, every access in try/catch, `"off"` = all seen).

## In progress
- Nothing.

## Next
1. `TipToast` component (own file) mounted from `GameScreen.tsx` right after `StatusStrip`: polite live region, "Got it" button (44px), auto-hide, reduced motion; mark seen when shown.
2. "3 = x2" in the SETS strip (`Collections.tsx`).
3. "Show tips again" in Settings.
4. docs/04 section 4.8 "First-game tips".
5. e2e: new `tips.pw.ts`; run all web e2e; `pnpm typecheck && pnpm lint && pnpm test`.

## Gotchas / decisions
- **"First Proxy in hand"**: everyone starts with 2 Proxies (R2), so "in hand" would fire at game start on top of the first-turn tip. ASSUMED: the Proxy tip fires the first time a Proxy is on any bay, or I select a Proxy card.
- **Outbid trigger** is state-based (a bay still holds one of my cards but someone else is top), not log-based, so it also catches outbids that happened while the tab was away.
- **Pair trigger** is exactly 2 items of one category (Display Cases not counted; a jump straight to 3 skips the tip).
- **No tips outside `phase: playing`, `stage: bidding`** (the Gift step has its own UI).
- Copy checked against 01: R35 (cards in hand only break ties), R16 (card on a bay is out of hand until it closes; outbid player may bid there again), R19 (returns on close), R33 (3 = every card doubled), R15/R16.4 (latest Proxy is top; only a Proxy beats a Proxy), R27-R30 (Gift scores 0; after the last sale the holder picks a player who gives them a scorable card).
