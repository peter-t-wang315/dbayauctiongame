# Playtest follow-ups (from the 2026-10-27 AI playtest)

Source: [docs/playtests/2026-10-27-ai/README.md](../playtests/2026-10-27-ai/README.md). Read its "Problems" tables first; bug IDs (B1-B10) below match that file.

## Branch / base
- `fix/playtest-followups`, off `main` @ `7ad428c` (after #31). No code changes yet: this file is the plan.
- Suggested PR split: **PR 1** = slice 1 (quick fixes). **PR 2** = slice 2 (teach the rules in-play). **PR 3** = slice 3 (sale moment). Open each as its own branch off `main` if PR 1 merges first; name them `fix/playtest-quick-fixes`, `feat/first-game-tips`, `feat/sale-moment`.

## Done
- Playtest run, written up, merged (#31).
- Triage of B3 and B7 (see Gotchas): neither is an engine bug; both are UI copy/feedback.

## In progress
- Nothing.

## Next

### Slice 1: quick fixes (PR 1, web only, no protocol change)
1. **B1 stale "YOUR TURN" after bidding.** `apps/web/lib/game-ui/viewModel.ts:291` returns `{ title: 'Your turn', mine: true }` while the turn is still mine on the server. Once a bid is sent (pending) or acked, show "Bid placed, waiting..." and drop `data-mine`/turn-frame. Check `StatusStrip.tsx`, `Podiums.tsx:52` ("YOUR TURN" on desktop), and the turn frame in `GameScreen.tsx`. Test in `gameUi.test.ts` + `e2e/game.pw.ts` (the frame is already asserted gone after the bid).
2. **B2 silent taps.** Tapping a spent/locked/outbid-locked card, or an illegal bay with a card selected, should show a short reason in the status text (polite live region), e.g. "That card is on bay B until it closes" / "Spent". The hand card states are `data-state` spent|locked|out|ready in the hand component.
3. **B4 outbid line has no item.** `viewModel.ts:229` `Outbid by ${who}! $X` → add the item name: `Outbid on {item} by {who}! $X`. Update `gameUi.test.ts:224`.
4. **B3 Gift copy.** `apps/web/components/gift/GiftStep.tsx:48`. Rules R29-R30: the holder picks a target; the target gives one scorable card **to the holder**. For the target, say "{holder}'s Gift picked you: give {holder} one of your items". For the holder, say "Pick who has to give you an item". For others, say "{target} is giving {holder} an item". Update `GiftStep.test.tsx`.
5. **B7 "no legal bid" skip.** The engine is correct: `packages/engine/src/game.ts:63` `hasLegalBid` and R13. A bay with no item card can't take bids, so near the deck's end a player can be skipped with cards in hand. The fix is UI: the skip text should say why ("No bay you can bid on: skipped"). Confirm the exact case first with a quick engine test (all bays empty or all tops unbeatable) before changing copy.
6. **B6 hotkeys re-map.** Desktop number keys should map to a card's fixed slot for the whole game (spent slots stay, just disabled), not to the n-th remaining card. See `KeyLegend.tsx` and the hand key handler.
7. **B8** COLLECTIBLES badge truncated on a bay (shots/Ray-121.png): allow the category chip to shrink its font or abbreviate; check at 1280 and 390.
8. **B9** the menu panel doesn't close on tap-away (phone). Add an outside-click close.
9. **B10** `apps/web/next.config.ts`: add `devIndicators: false` so the Next dev pill can't cover the hand in local playtests (dev-only; production is unaffected).

Machine checks, then the pre-PR review per docs/README "Git workflow".

### Slice 2: teach the rules in-play (PR 2)
Every tester learned the deciding rules too late. Add one-time contextual tips (dismissable; remember per device in `localStorage` with try/catch), shown in the status strip or a small toast, never a modal:
- First turn: "Bid cards are free money: only the items you win score."
- First time a player has 2 of a category: "Get 3 {category} for x2!" (also show "3 = x2" in the Sets panel).
- First Proxy in hand / first Proxy played: what a Proxy does (R15).
- First Gift on a bay: what a Gift does (R29-R30).
- First outbid: "Your card is stuck on that bay until it closes."
Docs: 04 (UX) gets a "first-game tips" subsection. No rule changes.

### Slice 3: make the sale the moment (PR 3)
The sold stamp exists (`Bay.tsx:200`, `FxController.tsx:72`) but testers read sales as log lines. Make SOLD! bigger and longer (respect reduced motion), add a "You won {item}!" / "{name} won {item}" toast, a gavel sound in the existing WS8 sound system, and an outbid sting.

### Later (needs the user's go-ahead; see the playtest README wishlist)
- Post-game awards (Biggest Steal / Overpay / Gift Victim) + rematch series score. Cheap retention; already on the 04 "Later" list.
- Emoji reactions (04 Later).
- Design experiments via `tools/sim`, **not** shipped without the user's OK: leftover cards score a little, or a catch-up bonus; cards left in the deck; a close-risk hint on old bays. These touch R17 and the scoring rules.
- Bigger asks (voiced auctioneer, XP/cosmetics, kid mode, themed packs): put to the user as a batched question.

## Gotchas / decisions
- **B3 is copy, not logic.** Sam thought he had won the Gift; in fact Mia (the holder) targeted him, and per R30 the target gives an item to the holder.
- **B7 is expected engine behaviour** (empty or unbeatable bays → R13 skip); only the explanation is missing.
- **Playtest caveats:** the timers were stretched 15x and the agents saw only snapshots (they missed animations and sound). Don't "fix" pacing from this data; real players (M5) decide that.
- Re-run the AI playtest after slices 1-2 using `docs/playtests/2026-10-27-ai/harness/` (steps at the end of that README) and compare scores.
- Also open, unrelated to this branch (see docs/README status):
  - the Next.js security advisory (upgrade on its own branch)
  - the desktop reveal/results layout
  - orphaned `.claude/worktrees/agent-*` folders (the user deletes them)
