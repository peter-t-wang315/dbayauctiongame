# 02 - Modes and Scaling

Rules not mentioned here are identical to `01-game-rules.md` (R-IDs). Mode is chosen in the lobby by the host. Tags: CONFIRMED / ASSUMED.

## 1. Classic (ASSUMED as our name; faithful to the original)
- Color-calling per 01 R7-R14. Default for 3-4 players (host may override in the lobby). Allowed for 5-6 (rounds per 01 section 8).
- Pros: orderly, low spam, readable. Cons: with 6 players each waits ~5 calls between turns (downtime), so 5-6 default to Frenzy.

## 2. Frenzy (ASSUMED; the original had no such mode)
Default for 5-6, optional for 3-4. No color calls; anyone may bid on any bay at any time. Auctions stay fast (about 35-55 s open timer); Frenzy uses the same bays and decks as Classic (3 bays at 3-4 players, 4 at 5-6; 01 R1). Frenzy is intentionally shorter than Classic (user decision 2026-10-11; ASSUMED targets in section 5).

- **F1 Bid legality**: same as 01 R16 (own top, equal, proxy rules). No "called player" check.
- **F2 Bay timer**: each bay has `closesAt`.
  - When an auction card enters a bay, `closesAt = now + U(frenzyOpenMinMs, frenzyOpenMaxMs)` (defaults per game length, section 4: Quick 35000-50000, Standard 40000-55000; seeded `closes` stream; randomness replaces the unpredictable closer).
  - Every accepted bid sets `closesAt = max(closesAt, now + antiSnipeMs)` (default 3000). It never shortens a timer.
  - Hard cap: `closesAt <= openedAt + frenzyHardCapMs` (Quick 100000, Standard 110000).
  - Snapshots carry each bay's `endsAt` (= `closesAt`) and `now` (server time; see 05); the client shows "+3s" when a bid extended the timer.
- **F3 Expiry**: at `closesAt`, a bay with a non-empty stack sells (01 R19) and refills (R21). A bay with an empty stack re-arms `closesAt = now + frenzyIdleRecheckMs` (Quick 15000, Standard 15000); after `frenzyMaxIdleExpiries` (default 2) re-arms with still no bid, the card is discarded unsold and the bay refills.
- **F4 Ordering and fairness**: the server orders bids strictly by arrival at the room (single-threaded Durable Object). A bid made legal/illegal by an earlier arrival is rejected with `ILLEGAL_BID`. Ties in arrival cannot occur. A bid arriving after `closesAt` is rejected `TOO_LATE` (01 R11 `late`), even if the alarm hasn't fired yet (check `now >= closesAt` first). Clients may show latency-based UI hints but never decide.
- **F5 Rate limit**: after each accepted bid, that player has `bidCooldownMs` (default 1000, not scaled by Relaxed) during which new bids are rejected `COOLDOWN` (rejected bids don't restart it). The transport cap (20 msg/s) is separate.
- **F6 No auto-skip / no dry-turns**: a dry player simply cannot bid. Disconnected players do nothing.
- **F7 Rounds mapping**: let `resolved` = bays sold + discarded, `D` = deck size. Display round = `floor(resolved / D x R) + 1`, with `R` = Classic rounds for that player count (cosmetic).
  - "Halfway" fires when `resolved >= ceil(D/2)`.
  - "Last round" fires when the deck becomes empty (the last card is drawn into a bay) OR elapsed time reaches `frenzyMaxMs` (Quick 600000 = 10 min, Standard 1080000 = 18 min), whichever is first. If the time cap triggers, the deck is stopped (no more refills).
  - In the last round, no re-arm and no hard-cap change: each bay closes at its `closesAt` (capped to `now + frenzyLastRoundMaxMs`, default 15000); empty stacks are discarded. When all bays are `null`, go to gifts (01 R28).
- **F8 Relaxed**: all Frenzy durations (open, anti-snipe, idle, last-round cap, hard cap) x1.5 (ASSUMED); cooldown unscaled.

## 3. Scaling table (ASSUMED; copies 01 section 8)
Two game-length presets, chosen by the host in the lobby (`length`: `quick` | `standard`, default `standard`), independent of mode. Full per-preset tables (items, specials, Classic rounds, calls) are in 01 section 8.

| Players | Bays | Quick deck (items+DC+Gift) | Standard deck (items+DC+Gift) | Cats (Quick / Standard) | Frenzy default |
|---|---|---|---|---|---|
| 3 | 3 | 18 (16+1+1) | 24 (21+2+1) | 5 / 6 | optional |
| 4 | 3 | 24 (21+2+1) | 32 (28+2+2) | 6 / 6 | optional |
| 5 | 4 | 30 (26+2+2) | 40 (35+3+2) | 6 / 6 | yes |
| 6 | 4 | 36 (31+3+2) | 48 (42+3+3) | 6 / 6 | yes |

Bid cards: 12 per player at all sizes and both lengths (01 R2).
Why:
- **Fairness**: ~6 (Quick) or ~8 (Standard) deck cards per player at every size so expected share is equal; more players means more competition per card, which is fine.
- **Downtime**: 4 bays at 5-6 give more simultaneous things to bid on; Frenzy removes waiting for a color.
- **Collections**: more categories in play lower the odds of 3-of-a-kind, but with ~8 cards per player and at most 6 categories a collection is very likely (see section 5 results). Categories are capped at 6 (the pack has 6).

## 4. Frenzy constants (`packages/engine/config.ts`, per game length in `LENGTH_PRESETS`)
| Name | Quick | Standard | Rationale |
|---|---|---|---|
| `frenzyOpenMinMs` / `frenzyOpenMaxMs` | 35000 / 50000 | 40000 / 55000 | unpredictable like the original closer; kept short so Frenzy feels fast (ASSUMED) |
| `frenzyHardCapMs` | 100000 | 110000 | stops endless bidding wars |
| `frenzyIdleRecheckMs` | 15000 | 15000 | give unbid items time |
| `frenzyMaxMs` | 600000 | 1080000 | game length cap (last round starts) |
| `antiSnipeMs` | 3000 | 3000 | plan: late bid adds 3s |
| `frenzyMaxIdleExpiries` | 2 | 2 | avoid dead bays |
| `bidCooldownMs` | 1000 | 1000 | anti-spam |
| `frenzyLastRoundMaxMs` | 15000 | 15000 | quick finish |

Classic close-roll constants (`pBase`, `pMax`, `maxBayAgeCycles`, `ageBonusPerCycle`) per player count and length are in 01 section 9.

## 5. Balance targets (simulator MUST report; CI fails on hard limits)
Run with bots over many seeds (at least 1000 per mode and player count). Bot skill levels: random, greedy, careful.
| Metric | Target | Hard limit |
|---|---|---|
| Game length, median (simulated clock, **human pacing**, section 6) | Classic (user decision 2026-10-12: accept shorter games after the R17 age bonus; deck sizes unchanged), Quick: 3p 4-6, 4p 6-8.5, 5p 7.5-10, 6p 9-12 min; Classic Standard: 3p 5-8, 4p 8-11, 5p 10.5-14, 6p 13.5-18 min; Frenzy Quick 3.5-7 min; Frenzy Standard 5.5-10 min (intentionally shorter than Classic, ASSUMED) | game always terminates, < 40 min |
| Classic rounds played | <= ~50 (prefer fewer); report max per cell | - |
| Classic bay wait (rounds from a bay's first bid to its sale), p95 | <= ~4 rounds (user decision 2026-10-12, ASSUMED; before: 6-8 rounds at 3-4 players); sim reports median / p95 / max | - |
| Items won per player (average) | >= 3 (deck gives ~5-6 Quick, ~7-8 Standard) | no seat averages < 2 |
| Players dry before last 25% of game | < 20% of players | - |
| Players with >= 1 collection | Quick 30-70%; Standard: accepted up to ~95% pending playtest (ASSUMED, structural at ~8 cards per player and 6 categories) | Quick outside 15-85% = fail; Standard > 98% = fail |
| Winner share among seats (same skill) | within 1/players +/- 8 points | - |
| Share of items discarded unsold (includes no-bid round clears, 01 R18b) | < 10% | - |
| Share of sales that are Proxy wins | 10-30% | - |
| Gift fizzles | < 5% of Gifts | - |
| Score spread (winner/last) | 1.2x-4x | - |
| First-seat (Classic) or fastest-seat (Frenzy) advantage | < 5 points win rate | - |
Tune order if failing: `pBase/pMax`, `ageBonusPerCycle` and `maxBayAgeCycles` (length, sales), rounds, Frenzy open timers, cats in play, deck size, then Proxy count.

Additional metric: Classic auto-skip rate (R13, calls with no legal bid / calls) should be rare (< 5%; Standard 3p Classic accepts up to 8% so it can reach 12-15 min, user decision 2026-10-11, ASSUMED, revisit after playtest). The limit is measured with all-careful bots (the sim default); with the smarter bots (section 7) a mixed table of random, greedy and careful bots also stays within the limit (highest 4.5%).

## 6. Simulator pacing (ASSUMED)
`tools/sim` has two bot pacings. **Bot pacing** (default): every seat polls on a 1.5-4 s timer and acts at once. **Human pacing** (`--pacing human`): the Classic caller acts uniformly 40-90% into the bid window (2-4.5 s of 5 s) and lets the window expire 10% of the time; Frenzy seats look at the board every 1.5-5 s and bid with probability 0.8 when the policy has a bid; gift choices take 2-6 s. Length targets apply to human pacing. See `tools/sim/README.md`.

## 7. Latest sim results (1000 games per cell, all-careful bots, REAL 60-item base pack (`--pack active`), human pacing)
| preset | mode | n | length min median / p95 / max | Classic rounds median / max | collect | autoskip | spread | nonterm |
|---|---|---|---|---|---|---|---|---|
| quick | classic | 3 | 8.0 / 9.1 / 12.8 | 33 / 50 | 71.3% | 3.6% | 2.44x | 0 |
| quick | classic | 4 | 10.4 / 11.7 / 12.2 | 32 / 36 | 71.2% | 3.3% | 3.19x | 0 |
| quick | classic | 5 | 8.8 / 9.8 / 10.3 | 21 / 23 | 69.6% | 1.6% | 3.94x | 0 |
| quick | classic | 6 | 9.9 / 10.2 / 10.5 | 19 / 19 | 67.5% | 0.4% | 5.29x | 0 |
| quick | frenzy | 3 | 4.0 / 4.2 / 4.5 | - | 75.3% | - | 2.38x | 0 |
| quick | frenzy | 4 | 5.4 / 5.7 / 6.1 | - | 74.5% | - | 2.94x | 0 |
| quick | frenzy | 5 | 5.3 / 5.6 / 5.8 | - | 74.4% | - | 3.96x | 0 |
| quick | frenzy | 6 | 6.3 / 6.6 / 6.9 | - | 74.3% | - | 4.81x | 0 |
| standard | classic | 3 | 12.2 / 12.7 / 13.1 | 50 / 50 | 83.8% | 4.4% | 2.03x | 0 |
| standard | classic | 4 | 16.5 / 17.2 / 17.6 | 50 / 50 | 88.8% | 4.1% | 2.35x | 0 |
| standard | classic | 5 | 15.2 / 17.0 / 18.1 | 37 / 42 | 90.0% | 4.2% | 2.53x | 0 |
| standard | classic | 6 | 16.6 / 17.3 / 17.8 | 33 / 33 | 88.2% | 2.8% | 3.14x | 0 |
| standard | frenzy | 3 | 6.0 / 6.3 / 6.7 | - | 91.6% | - | 1.76x | 0 |
| standard | frenzy | 4 | 8.3 / 8.6 / 8.9 | - | 92.8% | - | 2.01x | 0 |
| standard | frenzy | 5 | 7.8 / 8.1 / 8.4 | - | 90.4% | - | 2.39x | 0 |
| standard | frenzy | 6 | 9.5 / 9.8 / 10.0 | - | 89.3% | - | 2.73x | 0 |

Classic was retuned on the real pack (2026-10-11, ws1-classic-retune): the previous Classic constants gave auto-skip above 5% at several cells in the pre-PR review. Slow closes and long `maxBayAgeCycles` keep bid cards locked on bays, so hands run dry late in the game. Faster closes (a long, flat start and a steeper ramp, shorter bay ages) free the cards. Auto-skip (careful bots) is now below 5% in every Classic cell except Standard 3p, which accepts up to 8% (6.1% measured) to reach its length target; skip rate rises with game length at a fixed deck, so length and skips conflict at 3 players. Standard 3p close values: rounds 50, pBase .005, pMax .03, maxBayAgeCycles 8 (was .005/.15/5).

Smarter bots (2026-10-11, branch bots-smarter). All three bot levels now share one value-aware bidder (`packages/engine/src/bots.ts`): they value the item from its estimate and collection progress, pay a face value of about 0.9x to `maxMult` x that value (careful 1.3x, greedy 1.4x opening with the smallest card that works, random 1.15x with fixed +/-35% misjudgment and 20% idle turns), keep a reserve of face cards, spend a Proxy only on the best items, and cap the cards locked on bays. The table above is the all-careful result (1000 games per cell); every Classic cell is inside its auto-skip limit (< 5%, Standard 3p < 8%).

Mixed bots (random, greedy, careful, careful seats cycled; 500 games per cell, same seeds before and after, real pack, human pacing). Auto-skip, old to new: Quick 3p 9.2% to 3.7%, 4p 8.5% to 3.2%, 5p 3.3% to 1.4%, 6p 0.7% to 0.2%; Standard 3p 18.8% to 4.5%, 4p 14.3% to 3.5%, 5p 10.1% to 4.0%, 6p 5.7% to 1.9%. Win share per seat across the 16 mode x length x players cells (fair = 1/n): the ratio between the best and the worst skill level was 12x on average and up to 101x (old Standard Frenzy 6p: careful 30.4% per seat, random 0.3%); it is now 1.8x on average and at most 2.3x, and the mean distance of a level from its fair share fell from 9.8 to 4.9 points. Careful is still the strongest on average, random the weakest on purpose (a casual player); greedy is slightly ahead at 3 players. Example, Standard 4p Classic win share per seat, old to new: random 12.8% to 14.4%, greedy 18.8% to 29.4%, careful 34.2% to 28.1% (fair 25%).

Misses (ASSUMED, accepted for now): Quick collection share 67-75% (Classic 67-71%, Frenzy 74-75%, slightly above 70%; smarter bots chase collections a little better); Standard collection share 84-93% (accepted up to ~95% pending playtest); score spread above 4x at Quick Classic 6 players (5.3x) and Quick Frenzy 6 players (4.8x). Classic auto-skip (careful bots) is below the limit everywhere (highest: Standard 3p 4.4% of 8%, Standard 4p 4.1% and 5p 4.2% of 5%). Bot-pacing results are in the PR description.

### Stale bays: no-bid round clear and age-based close (2026-10-12, branch rules-stale-bays; user decision, ASSUMED)
Two rule changes (01 R17 age term, R18b no-bid round clear; the clear needs 2 quiet rounds at 3 players, 1 at 4-6). 300 games per cell, same seeds before and after, real pack, human pacing, Classic. "Bay wait" = rounds from a bay's first bid to its sale. Frenzy is unchanged. User decision 2026-10-12: accept shorter Classic games after the R17 age bonus (targets in section 5 updated; decks unchanged).

All-careful bots:
| cell | length min median/p95 before | after | bay wait rounds median/p95 before | after | no-bid clears/game | autoskip before | after | unsold after | collect after |
|---|---|---|---|---|---|---|---|---|---|
| quick 3p | 8.2 / 9.1 | 4.8 / 5.6 | 6.00 / 6.00 | 2.00 / 4.00 | 0.25 | 3.7% | 1.2% | 1.8% | 66.6% |
| quick 4p | 10.5 / 11.7 | 6.7 / 7.5 | 3.50 / 5.00 | 1.75 / 3.25 | 1.07 | 3.2% | 1.0% | 8.5% | 62.3% |
| quick 5p | 8.8 / 9.8 | 8.0 / 9.0 | 1.80 / 3.00 | 1.40 / 3.00 | 0.44 | 1.6% | 1.2% | 2.5% | 66.9% |
| quick 6p | 9.9 / 10.2 | 9.7 / 10.2 | 1.33 / 3.00 | 1.17 / 3.00 | 0.12 | 0.3% | 0.8% | 1.3% | 69.4% |
| standard 3p | 12.2 / 12.7 | 6.1 / 6.8 | 8.00 / 8.00 | 2.00 / 3.67 | 0.35 | 5.0% | 1.8% | 1.9% | 88.0% |
| standard 4p | 16.5 / 17.1 | 8.9 / 9.9 | 5.75 / 6.00 | 1.75 / 3.25 | 1.27 | 4.1% | 1.2% | 7.7% | 83.8% |
| standard 5p | 15.1 / 17.1 | 11.3 / 12.7 | 2.80 / 5.00 | 1.80 / 4.00 | 0.95 | 4.5% | 1.5% | 5.5% | 86.3% |
| standard 6p | 16.7 / 17.3 | 14.5 / 15.9 | 1.83 / 4.00 | 1.50 / 3.83 | 0.74 | 2.9% | 2.2% | 3.3% | 87.3% |

Mixed bots (random, greedy, careful, careful cycled):
| cell | length min median/p95 before | after | bay wait rounds median/p95 before | after | no-bid clears/game | autoskip before | after | unsold after | collect after |
|---|---|---|---|---|---|---|---|---|---|
| quick 3p | 8.3 / 9.8 | 5.1 / 5.9 | 6.00 / 6.00 | 2.00 / 4.00 | 0.26 | 4.1% | 1.3% | 2.0% | 58.2% |
| quick 4p | 10.6 / 11.9 | 7.0 / 7.9 | 3.50 / 5.00 | 1.75 / 3.25 | 0.89 | 3.3% | 1.0% | 7.0% | 58.3% |
| quick 5p | 9.0 / 10.0 | 8.2 / 9.2 | 1.80 / 3.00 | 1.40 / 3.00 | 0.38 | 1.5% | 1.2% | 1.8% | 60.0% |
| quick 6p | 9.9 / 10.2 | 9.9 / 10.2 | 1.33 / 3.00 | 1.17 / 3.00 | 0.05 | 0.2% | 0.5% | 1.6% | 60.7% |
| standard 3p | 12.2 / 12.7 | 6.4 / 7.5 | 8.00 / 8.00 | 2.00 / 3.67 | 0.47 | 4.7% | 1.7% | 2.8% | 82.1% |
| standard 4p | 16.6 / 17.1 | 9.1 / 10.3 | 5.75 / 6.00 | 1.75 / 3.25 | 1.23 | 3.7% | 1.2% | 7.6% | 78.2% |
| standard 5p | 15.4 / 17.4 | 11.8 / 13.1 | 2.80 / 5.00 | 1.80 / 4.00 | 0.94 | 4.2% | 1.4% | 5.1% | 83.6% |
| standard 6p | 16.9 / 17.4 | 15.0 / 16.7 | 1.83 / 4.00 | 1.50 / 3.83 | 0.54 | 1.8% | 1.7% | 2.0% | 81.9% |


Findings:
- Bay wait p95 is 3.0-4.0 rounds everywhere (before: 3-8; the old median at 3-4 players was the forced-close cap itself). Meets the <= ~4 rounds target.
- Classic games are shorter at 3-5 players: bays now turn over in about 2 rounds, so the deck is spent well before the round cap (decks cannot grow: 6x10 pack shared with Frenzy). Accepted by the user; section 5 ranges follow these results.
- 3 players: requiring 2 quiet rounds keeps unsold at about 2% (with a 1-round clear it was 15-16%) and collection share at 67% Quick / 88% Standard.
- Unsold share: highest 8.5% (Quick 4p), all < 10%. Auto-skip fell everywhere (cards no longer sit locked on stale bays): all cells <= 2.2%.
- Standard collection share 84-88% is inside the accepted ~95%.
