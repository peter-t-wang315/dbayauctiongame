# The Original Game - Findings (researched 2026-10-10/11)

Subject: "eBay Electronic Talking Auction Game" (Parker Brothers / Hasbro, 2001). Our game is a generic, fictional, unbranded adaptation (no eBay name, art or items).

## Sources
1. Rulebook summary: https://rulespal.com/ebay-electronic-talking-auction-game/rulebook (third-party summary, not the official rulebook; accessed 2026-10-10).
2. BoardGameMatcher listing for the game (metadata; accessed 2026-10-10).
3. LXB Plays video: https://www.youtube.com/watch?v=ay3CZb1-Evs (auto-generated English transcript read locally 2026-10-11; auto-captions contain errors).
4. Customer reviews summarised from retail/review pages by research agents (complaints below); individual URLs not retained - treat as low-confidence.

## Metadata (BoardGameMatcher)
- 3-4 players, age 10+, about 20 minutes, BGG rating 3.0/5 from 409 ratings, weight 1.3 (light), designer Todd Kurtzer, published 2001.

## Components (rulespal)
63 item cards, 9 special cards, 48 bid cards, 3 auction bays, an electronic talking unit. 48 bid cards / 4 players = 12 per player, which matches our 12 bid cards per player assumption (note: our $10-300 + 2 Proxy composition is partly ASSUMED).

## Rules as established (rulespal + transcript)
- Each bay holds one item card from a category (toys, music, etc.) with an estimated value. Win items, collect 3 of a kind for a collection that doubles that category's value.
- Players bid by placing a bid card in a bay. Denominations roughly $10 up to $300 (transcript: "from increments from 10 all the way up to I think 300").
- Proxy bid: can only be beaten by another proxy.
- Electronic unit calls colors in random order ("red, blue, yellow"); the called color's player may place one bid card. Colors, not bay numbers, identify players.
- At unpredictable moments the unit says stop; the top bid in each closed bay wins. Only the winning card is spent; all other bid cards in that bay return to their owners.
- Sold bays refill with new items; unsold bays carry on.
- 30 rounds announced; the unit announces "Halfway" and the last round.
- Gift special: resolved at the end; the holder picks a player, and that victim chooses which item to give up.
- Display Case: acts as a wild for collection and adds $100.
- Scoring: sum of actual item values, doubled for collections; ties by remaining high-value bid cards (ASSUMED in our rules; see 01).

## Video findings (LXB transcript, key points)
- Bid denominations about 10 to 300; proxy cards exist.
- Only the winning card is lost; all others return.
- Colors are called randomly; bays close unpredictably; sold bays refill.
- Gift card was seen and resolved at the end, with the victim picking the item given up.
- Display Case seen: counts as wild and +$100.
- Only two special types were seen in play (Gift and Display Case) - consistent with our 5 Display Case + 4 Gift.
- Hosts initially called it fast-paced and "maddening"; they said three players feels right even though four is allowed.
- Players rated it about 4/5, loved the panic and the final value reveal.
- Pain points: fiddly physical handling - hard to see the top bid in a bay, missed color calls. Both are things a screen can fix (always show top bid; show whose color is called).
- Transcript quality: auto-captioned, misattributed speakers; do not quote as authoritative.

## Review themes (retail reviews)
Complaints: 3-player minimum (hard to play 2-player), short bid windows, high luck, batteries/electronics fragility. Praise: fast, funny, tension.

## Unknowns / ASSUMED in our rules
- Exact bid-card composition per player (we assume 12: $10-300 plus 2 Proxy).
- Exact probabilities that a bay closes each call.
- Exact item/value lists (we create our own fictional 60).
- Whether proxy faces are hidden until resolution.
- Exact tie-break rules.
- How many specials exist per game, their exact deck split (we chose 5 Display Case + 4 Gift).
- Exact end condition mechanics beyond "about 30 rounds; last round sells everything left".
- Whether a player can complete multiple collections in one category (we allow).
These are tagged ASSUMED in `../01-game-rules.md` and tunable in `packages/engine/config.ts`.
