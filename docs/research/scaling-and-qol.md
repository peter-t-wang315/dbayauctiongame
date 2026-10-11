# Scaling and Quality-of-Life Research (2026-10-10/11)

Method: Haiku agents covered rules, reviews, scaling; Sonnet agents fact-checked improvement ideas; two tech leads reviewed. Facts about third-party games are from general knowledge of those games and are low-risk but not re-fetched.

## How auction games scale with player count
| Game | Players | Scaling lever |
|---|---|---|
| For Sale | 3-6 | Fewer cards removed/dealt per player count; fixed deck, rounds shrink with more players. |
| Modern Art | 3-5 | Cards dealt per player vary by count (e.g. fewer per player with more players). |
| Ra | 2-5 | Number of sun tiles/auction rounds per epoch scales with players. |
| Going Going GONE | 3-5 (check) | Simultaneous lots; decks scaled by player count. |
Takeaways for us: scale the number of simultaneous bays (3 for 3-4 players, 4 for 5-6), keep 12 bid cards per player, scale item/special draw with player count, and use Frenzy (anyone may bid anytime) for 5-6 where strict color-calling turns would leave people waiting.

## Online pitfalls and decisions
- **Sniping:** last-instant bids are unfair under latency. Fix: anti-snipe extension (+3s on late bids in Frenzy) computed from server time, never client time.
- **Server-authoritative timers:** client clocks drift; countdowns are drawn from server `endsAt` plus a measured offset (see 05 section 6.6).
- **AFK players:** auto-pass for disconnected players only; connected-but-slow players lose the turn on timer expiry. Relaxed timing x1.5 for accessibility.
- **Hidden info:** never send other hands or actual values (redaction path in 05 section 10).
- **Undo policy (BGA):** Board Game Arena allows undo only when no hidden information was revealed and no random event occurred. Bids reveal information and are time-bound, so we have NO undo; a bid rejection is shown clearly (card shakes) and the 2-tap flow reduces misclicks.
- **No chat:** players voice-chat externally.

## Critic verdicts on improvement ideas
| Idea | Verdict | Reason |
|---|---|---|
| Team mode | CUT | Complexity; breaks player scaling. |
| Spectator mode | CUT | Extra hidden-info surface and server load for little value. |
| Market events | CUT | Adds luck; game already luck-heavy. |
| Catch-up mechanics | CUT | Game is short; collections already swing scores. |
| Buy It Now / Snipe cards | CUT | Undermines the bay-close tension; snipe handled by anti-snipe. |
| Appraisal card | LATER | Interesting hidden-info special; needs rules + balance work. |
| Bots | LATER originally, now SHOULD (in scope in WS1) | Needed for simulator, solo testing, "Add bot", e2e. |
| Emoji reactions | LATER | One button in the menu, no permanent bar. |
| Award titles, auctioneer voice lines, item art packs, feedback form | LATER | Polish. |
| Chat, screen shake, full-screen flash, toast stacks, music | CUT | Screen space, accessibility (flashing), distraction. |
| Anti-snipe extension | KEEP | Fairness online. |
| Relaxed timing x1.5 | KEEP | Accessibility (WCAG 2.2.1). |
| Reduced-motion support, colorblind-safe colors + shapes | KEEP | Accessibility. |
