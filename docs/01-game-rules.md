# 01 - Game Rules (dBay)

Spec for `packages/engine`. Normative words: MUST / MUST NOT. Every rule has an ID for code and tests.
Tags: **CONFIRMED** (source) or **ASSUMED** (our decision; tunable where noted).
Sources: RP = rulespal.com/ebay-electronic-talking-auction-game/rulebook; TX = LXB Plays video transcript (line refs).
This doc defines shared rules plus Classic mode. Frenzy overrides are in `02-modes-and-scaling.md`.

## 1. Glossary
- **Player**: 3-6. Colors/shapes: Red ●, Blue ▲, Yellow ■, Green ◆, Purple ★, Teal ✚ (palette in 04).
- **Bay**: a numbered slot (0-based) holding one auction card (item or special) plus a **stack** of bids.
- **Bid card**: face value or Proxy. **Hand** = a player's bid cards not currently on a bay.
- **Item card**: category, `estValue` (public), `actualValue` (hidden until reveal). **Special card**: Display Case or Gift.
- **Scorable card**: an item card or a Display Case. A Gift is NOT scorable.
- **Call**: one color call. **Round**: one full cycle of calls (R7).

## 2. Setup
- **R1 Bays** (ASSUMED mapping): 3 bays for 3-4 players, 4 bays for 5-6.
- **R2 Bid cards** (ASSUMED; original 48 cards / 4 colors = 12): each player has 12: face values 10, 25, 50, 75, 100, 125, 150, 200, 250, 300, plus 2 Proxy. Identical sets for all. A Proxy has no face value.
- **R3 Pool** (ASSUMED counts): 6 categories (`toys`, `media`, `glass`, `collectibles`, `antiques`, `misc`) x 10 items = 60 items; 9 specials (5 Display Case, 4 Gift).
- **R4 Deck build** (ASSUMED): from the seed, per the table in section 8:
  1. Choose `catsInPlay` categories at random.
  2. Draw items round-robin across those categories (per-category counts differ by at most 1), random within each category.
  3. Add the specified Display Cases and Gifts (random from the specials pool).
  4. Shuffle everything; draw from the top.
- **R5 Initial bays**: fill bays 0..n-1 from the deck top. Specials may appear anywhere (ASSUMED).
- **R6 RNG** (ASSUMED): one seed per game; independent named streams (`deck`, `calls`, `closes`, `misc`) so adding a roll in one stream doesn't change another. The engine MUST NOT call `Math.random` or `Date.now`; time is passed in.

## 3. Rounds and calls (Classic)
- **R7 Round** (ASSUMED; sources say "~30 rounds" but not the unit; our counts depend on game length): a round = one drain of the color bag, in which every player is called exactly once. Total calls `N = rounds x players`. Rounds by player count: section 8.
- **R8 Color order** (ASSUMED; sources: random, "bounce around" TX L120-128): a shuffled bag of all player colors, one drawn per call; refill and reshuffle when empty. If the new bag's first color equals the previous bag's last, swap it with the second. Nobody is starved.
- **R9 Announcements** (CONFIRMED RP; TX L116, L486, L694): "Halfway" at the start of round `floor(rounds/2)+1`; "Last round" at the start of the final round; "Game over" after the sweep (R22).
- **R10 Call procedure** (ASSUMED sequencing). Per call, in order:
  1. Announce the color; start the bid window (R11).
  2. The called player bids or passes.
  3. Close roll (R17-R18).
  4. Refill sold bays (R21).
  5. Next call.
- **R11 Bid window** (ASSUMED value; "a few seconds" CONFIRMED RP): `bidWindowMs` default 5000; lobby options 3000/5000/8000; Relaxed x1.5. The server owns the deadline (`endsAt`). A bid arriving after it is rejected (`late`). Expiry with no bid = pass (buzzer).
- **R12 Early end** (ASSUMED): a legal bid ends the window immediately; wait `callGapMs` before the next call.
- **R13 Auto-skip** (ASSUMED): if the called player has no legal (card, bay) pair, or an empty hand, skip them: announce the call, wait `skipGapMs`, no window. A **disconnected** player (see 05) is auto-passed the same way. Skipped calls still count toward `N` and still trigger the close roll.
- **R14 One action** (CONFIRMED RP): the called player places exactly one bid card on exactly one bay, or passes. Only the called color may bid in Classic.

## 4. Bidding and closing
- **R15 Top bid** (CONFIRMED RP; TX L90-91): the stack is ordered. If it contains any Proxy, top = the most recently played Proxy. Otherwise top = the highest face value. Empty stack = no top.
- **R16 Legality** (CONFIRMED RP; TX L243, L506): a bid is legal iff all hold:
  1. The card is in the bidder's hand.
  2. The bay holds an auction card.
  3. The bidder does not own the current top bid. (TX L521 contradicts; we follow RP.)
  4. Stack empty, OR card is Proxy, OR (top is not a Proxy AND card face > top face). Equal faces are illegal ("can't put 50 on 50", TX L243). If top is a Proxy, only a Proxy is legal.
  - Proxy on Proxy is legal; the last one is top.
  - **Visibility** (ASSUMED): every card on a bay is public and face-up. A played Proxy shows as "Proxy" (it has no face value). Hands are private (others see only the count).
  - Error mapping: failing 1-4 = `ILLEGAL_BID`; arriving after the deadline = `TOO_LATE`; wrong color in Classic = `NOT_YOUR_TURN` (names in 05 section 6.4).
  - A player MAY have cards on several bays; a card on a bay is out of hand until that bay closes.
  - A player outbid on a bay MAY bid there again with a different card.
- **R17 Close roll** (ASSUMED; unpredictability CONFIRMED TX L297, L431): after each call resolves, for each bay in index order, if **eligible**, roll the `closes` stream against `p`.
  - Eligible: stack non-empty AND `lastBidCall < currentCall` (a bay can't close on the call that placed its latest bid).
  - `p = pBase + (pMax - pBase) x callsDone / N`.
  - **Forced close**: eligible and `currentCall - firstBidCall >= maxBayAgeCycles x players` -> closes with p = 1.
- **R18 Unbid items** (ASSUMED; carry-over CONFIRMED TX L234): a bay with an empty stack MUST NOT close and is not rolled.
- **R19 Sale** (CONFIRMED RP; TX L106-112): winner = owner of the top bid. The winning card is discarded permanently; every other card on that bay returns to its owner's hand; the auction card goes to the winner's collection. Announce "Sold to {color} for {face|Proxy}".
- **R20 Winning Proxy**: discarded like any card; price displayed as "Proxy".
- **R21 Refill** (CONFIRMED TX L211, L234): each sold bay draws the next deck card immediately, in bay order. Deck empty -> bay stays `null`. Unsold bays keep their cards.
- **R22 Last round and sweep** (sweep CONFIRMED RP "last round sells all remaining"; unbid handling ASSUMED): the normal roll applies during the final round. After the final call's roll, **sweep**: every bay with a non-empty stack closes via R19 in bay order, no refill. Bays with an empty stack are **discarded unsold**. Then phase = `gifts` (R28).
- **R23 Early end** (ASSUMED): if the deck is empty and all bays are `null`, skip to R28 immediately.
- **R24 Dry players** (CONFIRMED that it happens: TX L553, L609, L674): a player with an empty hand is auto-skipped (R13). Their cards on bays still compete and return on close. They aren't eliminated.

## 5. Special cards
- **R25 Auctioned like items** (CONFIRMED TX L323): specials sit in bays and use the same rules. Display Case shows a public `$100`; Gift shows "?".
- **R26 Display Case** (CONFIRMED RP wild, $100; TX L655, L766-814): wild for one category (chosen at scoring, R34); fixed value $100; scorable.
- **R27 Gift is not an item** (ASSUMED): value 0, not scorable, not counted in collections, consumed on resolution.

## 6. End-of-game order (ordering ASSUMED; mechanics CONFIRMED TX L391, L708-731)
1. Phase `gifts` (R28-R31), values still hidden.
2. Phase `reveal`: actual values shown.
3. Collections doubled (R33-R34); scores and ranking (R35).
4. **R37 Reveal to ended** (ASSUMED): phase `reveal` carries the full results (actual values, scores, ranks) in one snapshot; the reveal animation is client-side only. The server moves `reveal` -> `ended` by deadline after `revealBaseMs + revealPerCardMs x scorableCards` (defaults 5000 + 600). `ended` has the same data. The host may `rematch` in `reveal` or `ended`; the UI offers Rematch as soon as the standings show.

- **R28 Gift order**: held Gifts resolve one at a time in the order they were *sold* (game-wide sale sequence). Unsold Gifts vanish.
- **R29 Gift step 1, target** (ASSUMED details): the holder picks another player who has at least one scorable card. No self-target. If nobody qualifies, the Gift **fizzles** (consumed). Timeout `giftChoiceMs` (15000, x1.5 Relaxed): server picks a random eligible target (`misc` stream).
- **R30 Gift step 2, give**: the target picks one scorable card (item or Display Case, never a Gift) to give to the holder. Timeout: auto-give the lowest `estValue` card (Display Case = 100; tie -> lowest card id). Disconnected players take the timeout default instantly.
- **R31 Multiple Gifts / Gift-on-Gift**: strictly sequential, state is re-read each time. A card received via Gift can be taken by a later Gift. A holder with several Gifts resolves each in turn. Gifts can't be targeted or traded.

## 7. Scoring
- **R32 Values**: `actualValue` fixed at deck build; Display Case = 100.
- **R33 Collection** (CONFIRMED RP): per player, per category, if `count >= 3` every card in it is doubled. `count` = items of that category + Display Cases assigned to it. A collection needs at least one real item of that category (ASSUMED). Several collections allowed (CONFIRMED TX L766-814).
- **R34 Display Case assignment** (ASSUMED): each Display Case is assigned to one category, or none, to maximize that player's total (brute force, at most 7^5 combos: 6 categories or none, up to 5 Display Cases). Ties: lowest category index in the order `toys, media, glass, collectibles, antiques, misc`, then "none". A Display Case in a doubled category scores $200 (decision: it **does** double); otherwise $100.
- **R35 Winner and tiebreak** (CONFIRMED RP): highest total wins; tiebreak = highest sum of face values of cards still in hand. Proxy = $0 (ASSUMED). Still tied = shared rank.
- **R36 Reveal data**: each scorable card exposes `estValue`, `actualValue`, delta, for STEAL!/Ripped off! tags (UX in 04).

## 8. Per-player-count table (ASSUMED)
The host picks a **game length** in the lobby (`length`: `quick` or `standard`, default `standard`; independent of mode). Each length is a preset of constants (`LENGTH_PRESETS` in `packages/engine/src/config.ts`). Bays do not depend on length.

**Standard** (~8 deck cards per player; target 15-25 min):
| Players | Bays | Deck | Items | Display Case | Gift | Cats in play | Classic rounds | Calls N |
|---|---|---|---|---|---|---|---|---|
| 3 | 3 | 24 | 21 | 2 | 1 | 6 | 110 | 330 |
| 4 | 3 | 32 | 28 | 2 | 2 | 6 | 58 | 232 |
| 5 | 4 | 40 | 35 | 3 | 2 | 6 | 42 | 210 |
| 6 | 4 | 48 | 42 | 3 | 3 | 6 | 33 | 198 |

**Quick** (~6 deck cards per player; target 8-12 min):
| Players | Bays | Deck | Items | Display Case | Gift | Cats in play | Classic rounds | Calls N |
|---|---|---|---|---|---|---|---|---|
| 3 | 3 | 18 | 16 | 1 | 1 | 5 | 52 | 156 |
| 4 | 3 | 24 | 21 | 2 | 1 | 6 | 36 | 144 |
| 5 | 4 | 30 | 26 | 2 | 2 | 6 | 23 | 115 |
| 6 | 4 | 36 | 31 | 3 | 2 | 6 | 19 | 114 |

Rationale: the original single table (now Quick, with more categories at 3-4 players) gave 6 cards per player; Standard adds about a third more cards and keeps specials at about the same share. Classic rounds are large because the close roll (R17) must spread the deck over enough calls to fill the target time; a round of 3 players is only about 15 s. Frenzy uses the same decks (02). The pack has 6 categories x 10 items, 5 Display Cases, 4 Gifts, so the largest deck (6 players, Standard: 42 items = 7 per category, 3 + 3 specials) fits. Bid cards stay at 12 per player (R2) at both lengths; Standard at 3-4 players with the longest bay ages is where auto-skips (R13) are most common (about 3-5% of calls in the sim).

## 9. Tunable constants (`packages/engine/config.ts`)
| Name | Default | Rationale |
|---|---|---|
| `BID_VALUES` | [10,25,50,75,100,125,150,200,250,300] | R2 |
| `PROXIES_PER_PLAYER` | 2 | R2 |
| `BAYS_BY_PLAYERS` | {3:3,4:3,5:4,6:4} | R1 |
| `LENGTH_PRESETS[length].DECK_BY_PLAYERS` | section 8 | R4 |
| `LENGTH_PRESETS[length].ROUNDS_BY_PLAYERS` | section 8 | R7; Standard targets 15-25 min, Quick 8-12 (human pacing, 02 section 5) |
| `LENGTH_PRESETS[length].CLOSE_BY_PLAYERS` (`pBase`, `pMax`, `maxBayAgeCycles`) | Quick {3: .02/.07/7, 4: .04/.12/4, 5: .05/.15/3, 6: .05/.15/3}; Standard {3: .008/.036/10, 4: .025/.08/6, 5: .03/.085/5, 6: .04/.10/4} | R17; the deck is mostly sold by ~85% of calls; per player count because the deck-to-bay ratio differs |
| `bidWindowMs` | 5000 (3000/8000) | R11 |
| `relaxedMultiplier` | 1.5 | WCAG 2.2.1 |
| `callGapMs` | 1500 | R12 readability |
| `skipGapMs` | 1000 | R13 |
| `giftChoiceMs` | 15000 | R29-30 |
| `revealBaseMs` / `revealPerCardMs` | 5000 / 600 | R37 |
| `proxyTiebreakValue` | 0 | R35 |
| `displayCaseValue` | 100 | R26 CONFIRMED |
| `collectionMin` / `collectionMultiplier` | 3 / 2 | R33 CONFIRMED |

## 10. Worked scoring example
Blue ▲ ends with: `toys` A (actual 40), B (60), C (35); `glass` D (80), E (50); one Display Case; and a resolved Gift that took `media` card F (actual 90) from Red. The Gift is consumed.
1. Counts: toys 3, glass 2, media 1, plus 1 Display Case.
2. Display Case to `glass` (R34): glass count 3, (80+50+100) x 2 = 460; toys 135 x 2 = 270; media 90. Total 820.
3. Display Case to `toys`: (135+100) x 2 = 470; glass 130 (2 cards, not doubled); media 90. Total 690.
4. Option 2 is best. Blue total = **820**.
5. If tied, Blue's hand 10 + 25 + 300 + Proxy(0) = 335 breaks the tie.
