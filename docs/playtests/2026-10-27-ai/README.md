# AI playtest, 2026-10-27

Four Sonnet agents (medium effort) played one full game as personas. Each drove its own headless Chromium on the real web UI.
- Build: `main` after #23-#28 (HUD polish, turn flash, desktop hybrid layout, special sprites, ranked results).
- Game: Classic, Quick, 4 players, 8s window + Relaxed.

Raw reports: [Mia](Mia.md), [Dev](Dev.md), [Sam](Sam.md), [Ray](Ray.md). Key screenshots are in [shots/](shots/).

| Player | Persona | Device | Score | Fun |
|---|---|---|---|---|
| Mia | casual party host (Jackbox, Uno) | phone 390x844 | **$1,280 (won)** | 7/10 |
| Dev | competitive auction-game fan (Ra, Modern Art) | desktop 1440x900 | $1,165 | 6.5/10 |
| Sam | mobile gamer (Clash Royale, Among Us) | phone 412x915 | $1,140 | 7/10 |
| Ray | owned the 2001 original; family game night | laptop 1280x800 | $230 | 7/10 |

**Caveats (read before acting on this):**
- Timers were stretched 15x (local-only change, reverted), so pacing and "dead time" were felt only in turn counts, not in seconds.
- The agents saw snapshots between actions, so they miss short animations: the sold stamp exists (`data-fx="sold-stamp"`) but nobody saw it.
- Sound was off.
- The Next.js dev-tools pill ("1 Insight") covered the $150/$200 cards on phones. It is dev-only and not in production builds, but it cost Mia and Sam turns.
- These are LLM players. Treat this as a cheap first pass before the real friends playtest (M5), not a replacement.

## What worked (3-4 of 4 testers)
- **The reveal** is the highlight. Estimated value flips to real value, with STEAL! / Ripped off! tags and the x2 set badge. Mia won without knowing she was ahead, and liked the surprise.
- Pixel-art items and funny item names (Cookbook of Questionable Casseroles, Snowshoes Never Snowed).
- The Proxy wars, the mystery Gift bay, and the $300 Display Case overpay made memorable moments.
- The green "You're winning" bay state, the Rules panel, and the desktop key legend.

## Problems, by how many testers hit them

### Bugs and small UI fixes
| # | Issue | Who | Notes |
|---|---|---|---|
| B1 | "YOUR TURN" stays up after the bid is sent | Mia, Dev, Sam | Should switch to "Bid placed, waiting" as soon as the server acks |
| B2 | Tapping a locked/spent card, or a tap that does nothing, gives no feedback | Mia, Ray | Needs a short reason ("This card is on bay B until it closes") |
| B3 | Gift modal says "Mia opened a Gift!" to Sam, who won the Gift and had to give an item; it never names the recipient | Sam | Check the gift-step copy vs R29-R30 (shots/Sam-128.png) |
| B4 | "Outbid by Dev! $25" log line has no item name | Ray | |
| B5 | Reveal/results is a narrow column on desktop | Dev, Ray | Known open item (desktop results layout) |
| B6 | Number hotkeys re-map as cards get placed | Dev, Ray | Keep a card's key fixed for the whole game |
| B7 | Skipped for "no legal bid" while bays looked empty | Dev | **Investigate**: R13 should not skip a player with cards when a bay is empty |
| B8 | COLLECTIBLES category badge truncated on a bay | Ray | shots/Ray-121.png |
| B9 | Menu panel doesn't close on tap-away | Sam | |
| B10 | Dev-tools pill covers the hand on phones | Mia, Sam | `devIndicators: false` in `next.config.ts` keeps local playtests honest |

### Clarity: the rules that decide the game are learned too late (all 4)
- **Bid cards are free; only items score.** Ray hoarded his cards, finished on $230 with 7 cards unused, and only understood why at the end.
- **The x2 set bonus** is the biggest strategic lever (Dev's Misc set was $980 of his $1,165). It only appears as "One more = x2!" in the Sets panel.
- **Proxy** and **Gift** are unexplained until they happen to you.
- **Outbid cards stay locked on the bay** until it closes.

### Feel (3 of 4)
- **Sales feel flat.** Testers saw "SOLD!" as a log line. They want a big stamp, a gavel sound, and a toast saying whether you won or lost.
- The outbid moment needs a sting.

### Game design
- **Dead time and powerlessness** (Mia, Sam, Ray): hands run dry by mid-game and players just pass.
- **The last-place player is out of it** (Dev, Ray): no catch-up, and no way to see the gap until the end.
- **Standings visibility** (Mia, Sam, Ray) want a live indicator. This trades against the reveal surprise Mia loved. Option: show only each player's *estimated* total, never actual values.
- **Luck vs skill** (Dev):
  - Hidden values swing ±$200 (bear est $120 → $360).
  - Random bay closing can't be planned around.
  - "Spend everything" is dominant because leftover cards are worth nothing.
- **The game ends suddenly** when the deck runs out (Dev); show cards left in the deck.

## What they would have wanted (feature wishlist)
| Theme | Asked for | Who | Already planned? |
|---|---|---|---|
| Social | Emoji reactions and taunts on outbids | Mia, Sam | Yes, 04 "Later": emoji reactions |
| Social | Rematch with a running series score | Mia | Partly (rematch exists) |
| Social | Post-game awards ("Biggest Steal", "Biggest Overpay", "Gift Victim") | Mia, Sam, Dev | Yes, 04 "Later": award titles |
| Social | Shareable results / "my biggest steal" card | Sam | No |
| Feel | Voiced auctioneer with catchphrases | Ray | Yes, 04 "Later": auctioneer voice lines |
| Feel | Big SOLD!/outbid animation + sound + haptics | Sam, Ray, Mia | Partly (WS8 fx/sound exist, too subtle) |
| Onboarding | First-game tips: cards are free, sets x2, Proxy, Gift | All 4 | No |
| Onboarding | Kid/beginner mode, practice round with bots | Ray | No |
| Depth | Value ranges or an "appraiser peek" | Dev | Yes, 04 "Later": Appraisal card |
| Depth | Visible close-risk meter on bays | Dev | No |
| Depth | Leftover cards score something / catch-up bonus | Dev, Ray | No |
| Depth | Cards left in deck; cards left per player | Dev | Partly (podiums on desktop) |
| Downtime | Predictions / quick bets on other lots while waiting | Mia, Sam | No |
| Retention | XP, levels, cosmetics (paddle skins, bay frames), daily challenge, streaks | Sam | No (no accounts: would need localStorage profiles) |
| Retention | Stats, post-game recap (cost vs value per buy) | Dev | No |
| Content | Themed item packs (90s, holiday, family) | Ray | Yes, 04 "Later": item art packs |
| Access | Large-text mode, colour-blind check | Ray | Partly (colours already have shapes) |

## Recommended next steps
1. **Quick fixes** (one PR): B1, B2, B4, B8, B9 and B10, then investigate B7 and B3.
2. **Teach the game in-play** (one PR): contextual first-game tips for free cards, the x2 set bonus, Proxy, Gift and locked cards; show the bonus in the Sets panel.
3. **Make the sale the moment:** a bigger SOLD! stamp + a won/lost toast + a gavel sound, and an outbid sting.
4. **Post-game awards + rematch series score:** cheap retention, and already on the Later list.
5. **Emoji reactions:** on the Later list; the party hook two testers asked for.
6. **Design experiments, run through `tools/sim` before changing rules:**
   - leftover cards worth a little, or a catch-up bonus for last place
   - showing cards left in the deck
   - a close-risk hint on old bays

   All of these touch ASSUMED rules (R17 and the scoring rules), so they need the user's OK before changing CONFIRMED ones.

## Re-running this playtest
[harness/](harness/) has the scripts:
- `daemon.mjs <name> <port> <w> <h>` runs one headless browser per player.
- `pt.mjs <port> look|wait|click n|type n text|press Key|goto url` is the command agents use.

Steps:
1. Locally set `relaxedMultiplier` to 15 in `packages/engine/src/config.ts` and don't commit it.
2. Run `pnpm dev`, start four daemons, seat the players, and set Classic + 8s + Relaxed.
3. Give each agent a persona and its port.
4. In Git Bash, pass full `http://` URLs to `goto`, because MSYS rewrites `/r/CODE` into a Windows path.
