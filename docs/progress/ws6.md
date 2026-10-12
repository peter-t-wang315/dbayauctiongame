# WS6 progress (Reveal + Rules)

## Branch / base
`ws6-reveal-rules`, merged to main via PR #10 (branch deleted).

## Done
- Slice 1: `lib/reveal/results.ts` (standings per R35 with tie notes, per-player category groups with collection doubling and Display Case placement per R33/R34, reveal order me-first, flip count, gift log lines) + 9 unit tests; `useRevealSequence` (0.5s per card, Skip / tap-to-skip, starts finished in `ended` or with reduced motion); `components/reveal` (RevealScreen, FlipCard, Scoreboard, reveal.css) replaces WS5's RevealSlot; `components/gift/GiftStep.tsx` (moved from WS5 GiftOverlay; R29 eligibility counts scorable cards only) + render tests; `components/rules` (content.ts copy with R1-R37 IDs in comments, RulesContent, rules.css) + tests (every section < 80 words, all 37 rule IDs referenced); `/rules` page; in-game menu Rules tab and `?` shortcut.

## In progress
- Nothing.

## Next
- (done) Playwright `e2e/reveal.pw.ts`: Frenzy vs 2 bots to reveal, Skip, standings, Rematch -> lobby; `/rules` TOC. Passing locally.
- Pre-PR review passed (1 round, no blockers; notes 1-2 applied). PR open; merge when CI is green.

## Gotchas / decisions
- Rules TOC has 10 chips (04 listed 7): added Setup, Bidding, Last round so every rule is covered with each section < 80 words.
- Rematch shows only once the standings are visible (R37 "as soon as the standings show"); Leave is always visible.
- Ranking trusts the server `rank`; the client only sorts (rank, total, tiebreak, seat) and writes tie notes.
- Confetti is WS8 (`data-fx="scoreboard"`); the crown badge is the static stand-in. Flip uses a 200ms CSS pop only when motion is allowed; WS8 may replace it via `data-fx="reveal-flip"` / `data-state`.
