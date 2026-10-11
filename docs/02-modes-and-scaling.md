# 02 - Modes and Scaling

Rules not mentioned here are identical to `01-game-rules.md` (R-IDs). Mode is chosen in the lobby by the host. Tags: CONFIRMED / ASSUMED.

## 1. Classic (ASSUMED as our name; faithful to the original)
- Color-calling per 01 R7-R14. Default for 3-4 players (host may override in the lobby). Allowed for 5-6 (rounds per 01 section 8).
- Pros: orderly, low spam, readable. Cons: with 6 players each waits ~5 calls between turns (downtime), so 5-6 default to Frenzy.

## 2. Frenzy (ASSUMED; the original had no such mode)
Default for 5-6, optional for 3-4. No color calls; anyone may bid on any bay at any time.

- **F1 Bid legality**: same as 01 R16 (own top, equal, proxy rules). No "called player" check.
- **F2 Bay timer**: each bay has `closesAt`.
  - When an auction card enters a bay, `closesAt = now + U(frenzyOpenMinMs, frenzyOpenMaxMs)` (defaults per game length, section 4: Quick 60000-100000, Standard 80000-130000; seeded `closes` stream; randomness replaces the unpredictable closer).
  - Every accepted bid sets `closesAt = max(closesAt, now + antiSnipeMs)` (default 3000). It never shortens a timer.
  - Hard cap: `closesAt <= openedAt + frenzyHardCapMs` (Quick 180000, Standard 240000).
  - Snapshots carry each bay's `endsAt` (= `closesAt`) and `now` (server time; see 05); the client shows "+3s" when a bid extended the timer.
- **F3 Expiry**: at `closesAt`, a bay with a non-empty stack sells (01 R19) and refills (R21). A bay with an empty stack re-arms `closesAt = now + frenzyIdleRecheckMs` (Quick 25000, Standard 30000); after `frenzyMaxIdleExpiries` (default 2) re-arms with still no bid, the card is discarded unsold and the bay refills.
- **F4 Ordering and fairness**: the server orders bids strictly by arrival at the room (single-threaded Durable Object). A bid made legal/illegal by an earlier arrival is rejected with `ILLEGAL_BID`. Ties in arrival cannot occur. A bid arriving after `closesAt` is rejected `TOO_LATE` (01 R11 `late`), even if the alarm hasn't fired yet (check `now >= closesAt` first). Clients may show latency-based UI hints but never decide.
- **F5 Rate limit**: after each accepted bid, that player has `bidCooldownMs` (default 1000, not scaled by Relaxed) during which new bids are rejected `COOLDOWN` (rejected bids don't restart it). The transport cap (20 msg/s) is separate.
- **F6 No auto-skip / no dry-turns**: a dry player simply cannot bid. Disconnected players do nothing.
- **F7 Rounds mapping**: let `resolved` = bays sold + discarded, `D` = deck size. Display round = `floor(resolved / D x R) + 1`, with `R` = Classic rounds for that player count (cosmetic).
  - "Halfway" fires when `resolved >= ceil(D/2)`.
  - "Last round" fires when the deck becomes empty (the last card is drawn into a bay) OR elapsed time reaches `frenzyMaxMs` (Quick 720000 = 12 min, Standard 1500000 = 25 min), whichever is first. If the time cap triggers, the deck is stopped (no more refills).
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
| `frenzyOpenMinMs` / `frenzyOpenMaxMs` | 60000 / 100000 | 80000 / 130000 | unpredictable like the original closer; long because 18-48 cards over 3-4 bays only fill 8-12 / 15-25 min with long timers (ASSUMED; likely too slow to feel like Frenzy, see section 5 notes) |
| `frenzyHardCapMs` | 180000 | 240000 | stops endless bidding wars |
| `frenzyIdleRecheckMs` | 25000 | 30000 | give unbid items time |
| `frenzyMaxMs` | 720000 | 1500000 | game length cap (last round starts) |
| `antiSnipeMs` | 3000 | 3000 | plan: late bid adds 3s |
| `frenzyMaxIdleExpiries` | 2 | 2 | avoid dead bays |
| `bidCooldownMs` | 1000 | 1000 | anti-spam |
| `frenzyLastRoundMaxMs` | 15000 | 15000 | quick finish |

Classic close-roll constants (`pBase`, `pMax`, `maxBayAgeCycles`) per player count and length are in 01 section 9.

## 5. Balance targets (simulator MUST report; CI fails on hard limits)
Run with bots over many seeds (at least 1000 per mode and player count). Bot skill levels: random, greedy, careful.
| Metric | Target | Hard limit |
|---|---|---|
| Game length (simulated clock, **human pacing**, section 6) | Standard 15-25 min; Quick 8-12 min | game always terminates, < 40 min |
| Items won per player (average) | >= 3 (deck gives ~5-6 Quick, ~7-8 Standard) | no seat averages < 2 |
| Players dry before last 25% of game | < 20% of players | - |
| Players with >= 1 collection | 30-70% | outside 15-85% = fail |
| Winner share among seats (same skill) | within 1/players +/- 8 points | - |
| Share of items discarded unsold | < 10% | - |
| Share of sales that are Proxy wins | 10-30% | - |
| Gift fizzles | < 5% of Gifts | - |
| Score spread (winner/last) | 1.2x-4x | - |
| First-seat (Classic) or fastest-seat (Frenzy) advantage | < 5 points win rate | - |
Tune order if failing: `pBase/pMax` and `maxBayAgeCycles` (length, sales), rounds, Frenzy open timers, cats in play, deck size, then Proxy count.

Additional metric: Classic auto-skip rate (R13, calls with no legal bid / calls) should be rare (< 5%).

## 6. Simulator pacing (ASSUMED)
`tools/sim` has two bot pacings. **Bot pacing** (default): every seat polls on a 1.5-4 s timer and acts at once. **Human pacing** (`--pacing human`): the Classic caller acts uniformly 40-90% into the bid window (2-4.5 s of 5 s) and lets the window expire 10% of the time; Frenzy seats look at the board every 1.5-5 s and bid with probability 0.8 when the policy has a bid; gift choices take 2-6 s. Length targets apply to human pacing. See `tools/sim/README.md`.

## 7. Latest sim results (1000 games per cell, all-careful bots, synthetic 60-item pack, human pacing)
| preset | mode | n | len mean/p95/max | items | collect | autoskip | spread | nonterm |
|---|---|---|---|---|---|---|---|---|
| quick | classic | 3 | 9.2 / 10.4 / 11.6 | 5.67 / 5.64 | 67.4% | 4.4% | 2.34x | 0 |
| quick | classic | 4 | 9.5 / 10.6 / 11.7 | 5.75 / 5.71 | 64.2% | 2.0% | 3.17x | 0 |
| quick | classic | 5 | 9.6 / 10.3 / 10.5 | 5.59 / 5.56 | 62.7% | 0.8% | 4.26x | 0 |
| quick | classic | 6 | 9.9 / 10.2 / 10.5 | 4.89 / 4.83 | 54.7% | 0.0% | 6.65x | 0 |
| quick | frenzy | 3 | 7.3 / 7.8 / 8.5 | 5.67 / 5.61 | 70.5% | 0.0% | 2.19x | 0 |
| quick | frenzy | 4 | 10.0 / 10.6 / 11.2 | 5.75 / 5.72 | 70.2% | 0.0% | 2.69x | 0 |
| quick | frenzy | 5 | 9.6 / 10.1 / 10.5 | 5.60 / 5.56 | 73.4% | 0.0% | 3.20x | 0 |
| quick | frenzy | 6 | 11.6 / 12.1 / 12.5 | 5.67 / 5.63 | 75.8% | 0.0% | 3.98x | 0 |
| standard | classic | 3 | 17.3 / 19.3 / 27.2 | 7.67 / 7.64 | 89.0% | 4.9% | 1.84x | 0 |
| standard | classic | 4 | 16.3 / 18.2 / 19.4 | 7.50 / 7.46 | 88.2% | 3.1% | 2.17x | 0 |
| standard | classic | 5 | 16.1 / 17.7 / 18.3 | 7.60 / 7.55 | 90.3% | 1.9% | 2.51x | 0 |
| standard | classic | 6 | 17.0 / 17.5 / 18.2 | 7.33 / 7.29 | 86.2% | 0.6% | 3.25x | 0 |
| standard | frenzy | 3 | 13.1 / 13.8 / 14.5 | 7.66 / 7.63 | 89.6% | 0.0% | 1.80x | 0 |
| standard | frenzy | 4 | 17.9 / 18.7 / 19.7 | 7.50 / 7.46 | 91.5% | 0.0% | 2.01x | 0 |
| standard | frenzy | 5 | 16.8 / 17.5 / 18.3 | 7.60 / 7.57 | 92.1% | 0.0% | 2.24x | 0 |
| standard | frenzy | 6 | 20.4 / 21.1 / 21.9 | 7.50 / 7.47 | 92.5% | 0.0% | 2.39x | 0 |

Misses (see PR): Frenzy 3 players is short (Quick 7.3, Standard 13.1 min; longer timers would exceed 100-130 s per auction); collection share is 62-92% (above the 70% target, mostly Standard, structural with ~8 cards per player and at most 6 categories; random-skill bots still reach 68-75%); Classic score spread at 6 players is 3.3x (Standard) to 6.7x (Quick); Classic auto-skip is 4.9-5.2% at 3 players Standard. Bot-pacing results are in the PR description.
