# 03 - Content: Categories, Items, Special Cards

Status: draft for WS2 (Content). All numbers marked **ASSUMED** are starting points to be tuned by the balance simulator. Theme is generic and fictional: no real brands, no marketplace names, no trademarked products.

## 1. Categories

Ids are fixed by the lead. Emoji and accent hints are suggestions only; doc 04 finalizes colors and must keep them visually distinct from the player colors/shapes. Category identity must never rely on color alone (always show emoji + name).

| id | Display name | Emoji | Accent hint (colorblind-friendly, suggestion) |
|---|---|---|---|
| `toys` | Toys & Plush | 🧸 | warm orange `#E69F00` |
| `media` | Books, Movies & Music | 📀 | sky blue `#56B4E9` |
| `glass` | Pottery & Glass | 🏺 | teal-green `#009E73` |
| `collectibles` | Collectibles | 🪙 | yellow `#F0E442` (dark text on it) |
| `antiques` | Antiques & Art | 🖼️ | vermillion `#D55E00` |
| `misc` | Everything Else | 📦 | reddish purple `#CC79A7` |

(The hints are the Okabe-Ito palette. If 04 uses Okabe-Ito for players, it should choose a different set for categories or rely on emoji + pattern.)

## 2. Value design

### 2.1 Concepts
- **Estimated value (est):** public, printed on the card and shown in the bay.
- **Actual value (actual):** hidden until the reveal phase; never sent to clients before reveal (see 05 redaction rules).
- Both are positive integers, multiples of 5.
- Score = sum of actual values of owned items, with any category holding 3+ items doubled (a Display Case counts as a wild item worth $100), plus tiebreaks from the rules doc.

### 2.2 Multiplier distribution (ASSUMED)
`actual = round5(est x multiplier)`, with the multiplier drawn from a tier. The values in the table are fixed (authored) and chosen to match this distribution exactly across the 60 items.

| Tier | Share target | Multiplier range | Count used | Player experience |
|---|---|---|---|---|
| dud | ~15% | 0.25-0.60x | 9 (15%) | "I got ripped off!" |
| fair | ~55% | 0.80-1.25x | 33 (55%) | Roughly what it said on the tin |
| good | ~25% | 1.30-2.00x | 15 (25%) | "Nice find." |
| jackpot | ~5% | 2.50-4.00x | 3 (5%) | "WHAT A STEAL!" |

Suggested reveal tags (for 04): dud gets "Ripped off!"; good and jackpot get "STEAL!"; fair gets no tag. Tags can be computed from `tier` or from actual/est at reveal time.

### 2.3 Balance reasoning (ASSUMED, to be tuned)
- A hand has 10 numbered cards ($10-$300, sum $1,260) plus 2 proxies. Players spend only the winning card, so one win costs $10-$300. Expected winning bid in a normal game is guessed at roughly $80-$120.
- Estimated values average about $115 (range $30-$300), the middle of the card ladder. A $100-$125 card usually wins a typical item; $200+ cards are for contested items and collection-completing bids.
- Mean actual (about $143) is about 1.24x mean est and above a typical winning bid, so winning is generally worthwhile (paying near est has positive expected return), while the dud tier and bidding wars still create regret. Category doubling (3+) is a bigger swing than any one item.
- Jackpots sit on low-to-mid est items (est $80-$120, actual $240-$360). A cheap-looking item hiding a big payoff is the "what a steal!" moment, and it avoids a huge outlier that would swamp doubling.
- Duds appear at both ends: cheap junk (est $30-$60) and an expensive trap (Oil Portrait, est $160, actual $60). Players should be wary of high estimates but never certain.
- The base pack has no est above $300 (the top card). Est up to $400 is reserved for future packs (section 7).
- **Per-category parity:** every category has a similar tier mix and total actual within about 2% (range $1,415-$1,445), so no category is a dominant strategy. Total est varies ($1,110-$1,250), so some categories look pricier without being better.
- Starting simulator targets (hypotheses): win-rate spread between equal-skill bots by seat < 10 points; no category chosen as "best" by more than 25% of top finishers; at least one 3+ doubling in most games.

### 2.4 Tier mix per category
| Category | dud | fair | good | jackpot |
|---|---|---|---|---|
| toys | 2 | 5 | 2 | 1 |
| media | 1 | 6 | 3 | 0 |
| glass | 2 | 5 | 2 | 1 |
| collectibles | 2 | 5 | 3 | 0 |
| antiques | 1 | 5 | 3 | 1 |
| misc | 1 | 7 | 2 | 0 |
| **Total** | **9** | **33** | **15** | **3** |

## 3. Item table (60 items)

Columns: `id`, name, category, estimatedValue (Est), actualValue (Actual), x = actual/est (verification only, not stored), tier, flavor line (<=12 words).

### 3.1 toys - Toys & Plush
| id | Name | Cat | Est | Actual | x | Tier | Flavor line |
|---|---|---|---|---|---|---|---|
| `toys-pink-snake` | Fuzzy Pink Snake | toys | 40 | 40 | 1.00 | fair | Soft, long, and weirdly hard to explain at parties. |
| `toys-inflatable-alien` | Inflatable Space Alien | toys | 60 | 25 | 0.42 | dud | Arrived flat. Stayed flat. Still smiling. |
| `toys-bean-bag-bear` | Bean-Bag Bear, Limited Edition | toys | 120 | 360 | 3.00 | jackpot | Collectors whisper its name. Nobody told the seller. |
| `toys-astronaut-figure` | Action Figure Astronaut | toys | 90 | 150 | 1.67 | good | Moon-ready. Boots included, oxygen sold separately. |
| `toys-scary-puppet` | Scary Puppet | toys | 75 | 30 | 0.40 | dud | Its eyes follow you. Its value does not. |
| `toys-tin-robot` | Wind-Up Tin Robot | toys | 200 | 220 | 1.10 | fair | Walks three steps, then reconsiders everything. |
| `toys-plush-walrus` | Giant Plush Walrus | toys | 110 | 100 | 0.91 | fair | Hugs back, technically. Takes up a whole couch. |
| `toys-glow-yoyo` | Glow-in-the-Dark Yo-Yo | toys | 35 | 35 | 1.00 | fair | Glows for ten seconds. Tricks sold separately. |
| `toys-rocket-playset` | Toy Rocket Playset | toys | 250 | 250 | 1.00 | fair | Launches imaginations. Parents sold separately. |
| `toys-talking-doll` | Talking Doll, Mostly Working | toys | 130 | 210 | 1.62 | good | Says three phrases. One is a compliment. |

### 3.2 media - Books, Movies & Music
| id | Name | Cat | Est | Actual | x | Tier | Flavor line |
|---|---|---|---|---|---|---|---|
| `media-eight-track-player` | Eight-Track Player | media | 80 | 120 | 1.50 | good | Plays one song, twice, at the wrong speed. |
| `media-gramophone` | Gramophone with a Crank | media | 200 | 220 | 1.10 | fair | Sounds like a song sung through a hallway. |
| `media-violin` | Violin, One String Short | media | 250 | 400 | 1.60 | good | Plays three-quarters of any tune. Confidently. |
| `media-encyclopedia` | Encyclopedia Set, A to M | media | 60 | 20 | 0.33 | dud | Knows everything, except the rest of the alphabet. |
| `media-polka-records` | Polka Record Collection | media | 45 | 45 | 1.00 | fair | Forty records, one tempo, zero regrets. |
| `media-signed-novel` | Signed Mystery Novel | media | 120 | 130 | 1.08 | fair | Signature suggests the author was in a hurry. |
| `media-silent-film` | Silent Film Reel | media | 150 | 140 | 0.93 | fair | Dramatic. Very, very dramatic. And quiet. |
| `media-casserole-cookbook` | Cookbook of Questionable Casseroles | media | 30 | 30 | 1.00 | fair | Page one: "Add canned something." |
| `media-brass-tuba` | Brass Tuba, Dented | media | 150 | 160 | 1.07 | fair | The dent adds character. And about four extra notes. |
| `media-first-comic` | First-Issue Comic Book | media | 100 | 170 | 1.70 | good | Slightly crinkled. Hugely super. |

### 3.3 glass - Pottery & Glass
| id | Name | Cat | Est | Actual | x | Tier | Flavor line |
|---|---|---|---|---|---|---|---|
| `glass-porcelain-vase` | Porcelain Vase | glass | 200 | 210 | 1.05 | fair | Looks expensive. Happens to be. |
| `glass-decorative-vase` | Decorative Vase, Mystery Crack | glass | 90 | 35 | 0.39 | dud | The crack is "just part of the pattern." |
| `glass-teapot` | Teapot Shaped Like a Teapot | glass | 60 | 65 | 1.08 | fair | Very on-brand teapot. Zero ambiguity. |
| `glass-crystal-decanter` | Crystal Decanter | glass | 180 | 170 | 0.94 | fair | Makes grape juice feel like a decision. |
| `glass-cookie-jar` | Ceramic Cookie Jar | glass | 40 | 15 | 0.38 | dud | Empty. Lid chipped. Smells faintly of old optimism. |
| `glass-paperweight` | Swirly Glass Paperweight | glass | 70 | 110 | 1.57 | good | Holds down paper. Holds your gaze harder. |
| `glass-stained-lamp` | Stained-Glass Lamp | glass | 250 | 275 | 1.10 | fair | Turns any room into a very fancy sandwich shop. |
| `glass-garden-gnome` | Garden Gnome Statue | glass | 50 | 55 | 1.10 | fair | Judges your lawn silently. Rarely wrong. |
| `glass-mug-set` | Hand-Painted Mug Set | glass | 80 | 140 | 1.75 | good | Four mugs, each painted by someone who tried. |
| `glass-dynasty-bowl` | Mystery Dynasty Bowl | glass | 120 | 360 | 3.00 | jackpot | Used as a cereal bowl for years. Oops. |

### 3.4 collectibles - Collectibles
| id | Name | Cat | Est | Actual | x | Tier | Flavor line |
|---|---|---|---|---|---|---|---|
| `collectibles-coin-tin` | Old Metal Tin of Coins | collectibles | 100 | 175 | 1.75 | good | Rattles hopefully. Some coins are even from this century. |
| `collectibles-amethyst` | Amethyst Stone | collectibles | 120 | 130 | 1.08 | fair | Purple, shiny, and quietly smug about it. |
| `collectibles-stamp-album` | Stamp Album, Slightly Licked | collectibles | 90 | 95 | 1.06 | fair | Every stamp tells a story. Mostly "postage." |
| `collectibles-rookie-card` | Rookie Trading Card | collectibles | 200 | 320 | 1.60 | good | Kept in a sleeve since 1987. Worth the paranoia. |
| `collectibles-spoon-set` | Souvenir Spoon Collection | collectibles | 40 | 15 | 0.38 | dud | Forty spoons, zero soup. Zero demand. |
| `collectibles-snow-globe` | Snow Globe of a Small Town | collectibles | 40 | 40 | 1.00 | fair | It snows indoors, perfectly, forever. |
| `collectibles-meteorite` | Pocket-Sized Meteorite | collectibles | 150 | 270 | 1.80 | good | Fell from space. Landed in a yard sale. |
| `collectibles-pin-set` | Commemorative Pin Set | collectibles | 55 | 25 | 0.45 | dud | Commemorates an event nobody remembers. |
| `collectibles-thimble-set` | Thimble Collection (48) | collectibles | 65 | 70 | 1.08 | fair | Forty-eight tiny hats for tiny fingers. |
| `collectibles-band-medal` | Marching Band Medal | collectibles | 250 | 275 | 1.10 | fair | Awarded for Outstanding Enthusiasm. Very rare. |

### 3.5 antiques - Antiques & Art
| id | Name | Cat | Est | Actual | x | Tier | Flavor line |
|---|---|---|---|---|---|---|---|
| `antiques-xray` | Vintage X-Ray of a Mystery Foot | antiques | 100 | 100 | 1.00 | fair | Somebody's foot. Possibly yours. |
| `antiques-grandfather-clock` | Grandfather Clock, Runs Late | antiques | 250 | 265 | 1.06 | fair | Always fashionably late, never apologetic. |
| `antiques-oil-portrait` | Oil Portrait of a Stern Cousin | antiques | 160 | 60 | 0.38 | dud | Disapproves of your bid. And your hair. |
| `antiques-sword-replica` | Legendary Sword Replica | antiques | 120 | 200 | 1.67 | good | Cuts nothing. Looks fantastic doing it. |
| `antiques-girls-bicycle` | Girls' Bicycle, Basket Included | antiques | 70 | 70 | 1.00 | fair | Bell still rings. Brakes are a suggestion. |
| `antiques-board-game` | Vintage Board Game | antiques | 45 | 75 | 1.67 | good | Missing two pieces and one rule. Still a hit. |
| `antiques-treasure-map` | Pirate Treasure Map, Probably Real | antiques | 80 | 240 | 3.00 | jackpot | X marks the spot. The spot is your attic. |
| `antiques-typewriter` | Typewriter with Attitude | antiques | 90 | 95 | 1.06 | fair | Clacks loudly. Judges your spelling. |
| `antiques-bronze-horse` | Bronze Horse Statue | antiques | 150 | 255 | 1.70 | good | Gallops nowhere, gloriously. |
| `antiques-umbrella-stand` | Fancy Umbrella Stand | antiques | 60 | 65 | 1.08 | fair | Elegant. Holds umbrellas, canes, and the occasional sword. |

### 3.6 misc - Everything Else
| id | Name | Cat | Est | Actual | x | Tier | Flavor line |
|---|---|---|---|---|---|---|---|
| `misc-lawn-flamingos` | Lawn Flamingo Pair | misc | 50 | 50 | 1.00 | fair | Pink, plastic, and fiercely loyal. |
| `misc-mystery-box` | Sealed Box Labeled "Misc." | misc | 200 | 320 | 1.60 | good | Rattles. Smells like adventure. Or basement. |
| `misc-fondue-set` | Fondue Set, Never Used | misc | 70 | 75 | 1.07 | fair | Dinner party pending since 1978. |
| `misc-ab-roller` | Ab-Roller 3000 | misc | 30 | 10 | 0.33 | dud | The 3000 is its price in guilt. |
| `misc-lunch-box` | Tin Lunch Box, Cartoon Cat | misc | 60 | 60 | 1.00 | fair | Smells faintly of sandwiches from 1983. |
| `misc-telescope` | Backyard Telescope | misc | 300 | 315 | 1.05 | fair | Sees the Moon. Sees your neighbor's window. |
| `misc-snowshoes` | Snowshoes, Never Snowed | misc | 40 | 40 | 1.00 | fair | Waiting patiently for a winter that never comes. |
| `misc-lava-lamp` | Bubbling Lava Lamp | misc | 90 | 150 | 1.67 | good | Hypnotic. Do not stare during auctions. |
| `misc-tent` | Two-Person Tent for Four | misc | 160 | 160 | 1.00 | fair | Cozy. "Cozy" is doing a lot of work here. |
| `misc-unicycle` | Unicycle | misc | 250 | 265 | 1.06 | fair | Half a bike, double the confidence. |

### 3.7 Per-category summary
| Category | Sum est | Sum actual | dud / fair / good / jackpot |
|---|---|---|---|
| toys | 1,110 | 1,420 | 2 / 5 / 2 / 1 |
| media | 1,185 | 1,435 | 1 / 6 / 3 / 0 |
| glass | 1,140 | 1,435 | 2 / 5 / 2 / 1 |
| collectibles | 1,110 | 1,415 | 2 / 5 / 3 / 0 |
| antiques | 1,125 | 1,425 | 1 / 5 / 3 / 1 |
| misc | 1,250 | 1,445 | 1 / 7 / 2 / 0 |
| **Total** | **6,920** | **8,575** | **9 / 33 / 15 / 3** |

Mean est about $115; mean actual about $143 (1.24x). Spread between category actual totals: 30 (about 2%). The WS2 content test must recompute these and fail if tier counts, per-category sums, or any multiplier fall outside the rules in section 5.

## 4. Special cards (9)

Specials share the deck with items and are auctioned in bays like items. They belong to no category.

| id | Type | Est display in bay | Actual | Behavior |
|---|---|---|---|---|
| `special-display-case-1` ... `special-display-case-5` (5 cards) | displayCase | "$100 · Wild" | 100 (fixed, public) | Counts as one item of any category (needs at least one real item of that category, 01 R33). The engine assigns it to the category that maximizes the owner's score (multiple cases allowed; a player can complete several collections). |
| `special-gift-1` ... `special-gift-4` (4 cards) | gift | "?" | none | Resolved at game end: holder picks a player; that player chooses one of their items to give to the holder. No value of its own. |

- Display Case: name "Display Case", flavor "Fits anything. Judges nothing."
- Gift: name "Gift", flavor "Surprise! Someone else's stuff is now your stuff."
- Display Case's $100 is both est and actual (nothing hidden). The "?" on Gift signals its worth depends on what others own.
- Gift edge cases (target with no items, several gifts, resolution order) belong to 01-game-rules.md; this doc supplies data only.

Total deck = 60 items + 9 specials = 69 cards. Deck scaling by player count belongs to 02.

## 5. Data shape spec for `packages/content` (SPEC, not code)

```ts
// SPEC ONLY - to be implemented in WS2 and exported from packages/content
type CategoryId = 'toys' | 'media' | 'glass' | 'collectibles' | 'antiques' | 'misc';
type Tier = 'dud' | 'fair' | 'good' | 'jackpot';

interface CategoryDef {
  id: CategoryId;
  name: string;           // display name
  emoji: string;
  accentHint: string;     // hex suggestion; 04 finalizes
}

interface ItemDef {
  kind: 'item';
  id: string;             // kebab-case, `${category}-...`
  name: string;
  category: CategoryId;
  estimatedValue: number; // positive int, multiple of 5
  actualValue: number;    // positive int, multiple of 5 (SERVER ONLY before reveal)
  tier: Tier;             // authoring/balance aid; SERVER ONLY before reveal
  flavor: string;         // <= 12 words
}

interface SpecialDef {
  kind: 'special';
  id: string;             // `special-display-case-N` | `special-gift-N`
  type: 'displayCase' | 'gift';
  name: string;
  estimatedDisplay: string; // "$100 · Wild" | "?"
  fixedValue?: number;      // 100 for displayCase, absent for gift
  flavor: string;
}

interface ContentPack {
  packId: string;         // e.g. 'base'
  version: number;
  categories: CategoryDef[];
  items: ItemDef[];
  specials: SpecialDef[];
}
```

`actualValue` and `tier` are secrets until reveal. The public item type in `protocol` must omit them, and the redaction leak test must cover them.

### Zod validation rules (run as a content test in CI)
- `id`: regex `^[a-z0-9]+(-[a-z0-9]+)*$`; unique across items and specials.
- Item id must start with its category id followed by `-`.
- Base pack: exactly 6 categories with the fixed ids; exactly 10 items per category (60 total); exactly 5 `displayCase` and 4 `gift` specials.
- `estimatedValue` and `actualValue`: integer, > 0, divisible by 5. Allowed est range 25-400 (the base pack uses 30-300).
- `tier` must match `actualValue / estimatedValue` within the tier range (dud 0.25-0.60, fair 0.80-1.25, good 1.30-2.00, jackpot 2.50-4.00), allowing a rounding tolerance of 2.5/est.
- Base pack tier counts: 9 dud, 33 fair, 15 good, 3 jackpot. Per-category sum of `actualValue` within +/-5% of the cross-category mean (error for the base pack, warning for other packs).
- `flavor`: non-empty, at most 12 words, no real brand names (keep a small denylist of obvious marketplace, toy, and game brands). `name`: 2-40 characters.
- Special `estimatedDisplay` must equal "$100 · Wild" for displayCase (with `fixedValue` 100) and "?" for gift (no `fixedValue`).

## 6. Notes for other docs
- Reveal (04): flip order by category; tags per section 2.2.
- Engine (01/WS1): deal from a seeded shuffle; est values and specials' display are public; `actualValue` appears only in the reveal snapshot.
- Bots / simulator: must not read `actualValue` before reveal; they may use a prior expected multiplier of about 1.24.

## 7. Guidance: adding future item packs
1. Add a new file `packages/content/packs/<packId>.ts` using the shape in section 5, with its own `packId` and `version`. Never edit base pack ids; logged replays and golden snapshots depend on them.
2. Keep the same six categories unless the rules doc changes. Use the same number of items in every category so the deck stays balanced (the pack schema should carry an `itemsPerCategory` setting; the base pack is 10).
3. Pick tiers first, then multipliers, then `actualValue = round5(est x mult)`. Keep the 15/55/25/5 split to within about 2 items per 60.
4. Equalize category actual totals within +/-5%. Put jackpots on low-to-mid estimates. Est up to $400 is allowed for premium items; don't go above 400.
5. Write flavor lines in the same dry, playful voice: one short joke, at most 12 words, no real brands, no real people or companies, nothing mean about real groups.
6. Run the content test (schema, counts, sums) and the balance simulator, and put the simulator summary in the PR. A value change alters outcomes for a given seed, so regenerate golden replay snapshots in the same PR.
7. Packs are selected by `packId` in room settings (later); the base pack stays the default.
8. Item art, if added later, is keyed by item id (e.g. `apps/web/public/items/<id>.svg`) and is never required for rules to run; emoji/text fallback always works.

## Sprites (added 2026-10-11)
Each item gets a 12×12 pixel-art sprite stored as data, not image files:
- Each sprite is a `string[12]` of 12-character rows.
- Each character is a key into a shared palette, with `.` meaning transparent.
- The total size for all 60 items is a few KB.
- The UI renders a sprite as a CSS grid or canvas, so there's no image hosting.

```ts
// SPEC
type Sprite = { rows: string[]; palette?: Record<string, string> }; // rows.length === 12, each row length 12
type Item = { /* ...existing fields... */ sprite?: Sprite };          // missing → category fallback sprite
```

**Rules:**
- Use the shared palette: ink `k` #0E1511, cream `w` #FFF6E0, plus at most 4 item colors.
- Draw a 1px ink outline around the silhouette.
- The silhouette must read at 48px.
- No real brands or characters.

**zod checks:**
- 12 rows, each 12 characters long.
- Every character is in the palette.

**Authoring order:**
1. Draw 6 category fallback sprites (MVP minimum).
2. Draw per-item sprites (can be AI-drafted, then hand-tweaked in a pixel editor such as Piskel, which is free).

The mockup has 7 example sprites in `mockups/project/Game.dc.html` and `Frenzy.dc.html`: snake, bowl, map, bear, mixtape, alien, astronaut.
