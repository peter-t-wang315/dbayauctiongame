# 04 - UX and UI

Audience: agents building `apps/web` (Next.js App Router, Motion, CSS) in WS4 (landing/join/lobby), WS5 (game UI), WS6 (reveal/rules), WS8 (juice/sound). Rules live in `01-game-rules.md`, modes in `02-modes-and-scaling.md`, protocol in `05-tech-stack.md`. All screens are built against the mock server first.

Fixed facts: 3-6 players. Colors/shapes: Red ●, Blue ▲, Yellow ■, Green ◆, Purple ★, Teal ✚. 3 bays (3-4 players) or 4 bays (5-6). Hand = 12 bid cards ($10, 25, 50, 75, 100, 125, 150, 200, 250, 300, plus 2 Proxy). 6 categories: toys, media, glass, collectibles, antiques, misc. Special cards: Display Case, Gift. Modes: Classic (color-called turns), Frenzy (anyone bids anytime, per-bay timers, +3s anti-snipe).

## 1. Design principles

1. **Gameplay owns the screen.** Bays, hand and the active turn get space first. Anything else lives in the ⋯ sheet. Nothing needed to play is behind a tap, and the game screen never scrolls.
2. **Feedback lives on existing elements.** Pop, flash, slide and stamp the bay/chip/card that already exist. No toasts, banners-on-banners, full-screen flashes or screen shake.
3. **Playable with sound off, and with color ignored.** Every player is color + shape + name. Every event has text in the status strip. Sound and haptics are garnish.
4. **Chunky and tactile, not form-like.** Big rounded cards, bold numerals, spring press states. Controls look like physical objects (cards, stamps, paddles), not inputs.
5. **Calm by default, loud on the moments that matter.** Idle UI is quiet and flat. Motion is reserved for the six feedback moments.

## 2. Visual direction

**Style: "auction house meets arcade."** Warm dark felt background (default), cream paper cards with a thick 2px ink border and a hard offset shadow (sticker/arcade feel), brass-gold accents for money, rubber-stamp SOLD. Light theme = cream table, same cards. Theme: light by default, dark via a toggle in ⋯ (OS setting ignored; see §13). No eBay branding or logos anywhere.

**Typography (Google Fonts via `next/font`, no layout shift):**
- Display/numerals: **Lilita One** (chunky, game-like). Used for bids, titles, SOLD, timers. Enable `font-variant-numeric: tabular-nums` where available; otherwise fixed-width number boxes so bids don't jitter.
- UI/body: **Nunito** 600/700/800 (rounded, legible at 12-14px).
- No third font. Minimum text size 12px (chips, captions); body 14-16px.

**Spacing scale (px):** 4, 8, 12, 16, 24, 32. Gutter 12 on game screen, 16 elsewhere. **Radii:** chip 8, card 12, bay 16, sheet 24, pill 999. **Borders:** 2px ink. **Shadow:** `0 3px 0 var(--ink)` hard offset (pressed = 1px). **Hit target:** at least 44x44px.

**Tokens (CSS variables on `:root`; dark values under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` and again under `[data-theme="dark"]`):**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #F4EBD9 | #1B2A22 | page (felt) |
| `--bg-raised` | #FFF9EC | #25382E | bays, sheets |
| `--card` | #FFFDF5 | #FFF6E0 | bid cards (paper in both) |
| `--ink` | #1E1A14 | #0E1511 | borders, text on paper |
| `--text` | #1E1A14 | #F6EFDD | primary text on bg |
| `--text-dim` | #5E5648 | #B9B39F | secondary (4.5:1 min) |
| `--gold` | #B07A00 | #F2B93B | money, top bid |
| `--danger` | #B3261E | #FF6B5E | outbid edge, last-3s timer |
| `--ok` | #1F7A4D | #5FD59A | legal-target glow |
| `--focus` | #0B57D0 | #8AB4FF | focus ring (3px + 2px offset) |
| `--dim-opacity` | 0.45 | 0.45 | illegal bays (plus pattern, see 5) |

**Player palette (Okabe-Ito based; identity = color + shape + name, never color alone):**

| Player | Shape | Hex | Text on chip | Contrast |
|---|---|---|---|---|
| Red | ● | #F04B3E (coral-red, eBay-inspired) | ink #1E1A14 | 4.5:1 |
| Blue | ▲ | #3A85F8 (azure, eBay-inspired; was #2F7CF6, 4.39:1 with ink) | ink | 4.86:1 |
| Yellow | ■ | #FFB81C (marigold, eBay-inspired) | ink | 15:1 |
| Green | ◆ | #8BC53F (lime, eBay-inspired) | ink | 5.7:1 |
| Purple | ★ | #A97CF8 (violet) | ink | 7:1 |
| Teal | ✚ | #22BFAE | ink | 9:1 |

Notes: see §12 for the current palette and colorblind rules (shapes mandatory on every chip; danger color always paired with text or shake). Use `--p-red` ... `--p-teal` tokens plus `--on-p-*` text tokens (ink on all six).

**Category accents** (icon + label always shown, color is secondary; used on chips and reveal groups): toys #E4572E, media #3A86FF, glass #2EC4B6, collectibles #8E5BD9, antiques #A47148, misc #7A8793. Each has a distinct simple glyph (block, disc, goblet, star-badge, clock, box).

## 3. Screens

Wireframes are 390px wide. `[ ]` = button, `( )` = chip.

### 3.1 Landing `/`
```
+--------------------------------------+
|                                      |
|               dBay                   |
|   Bid. Bluff. Collect. (tagline)     |
|                                      |
|   +--------------------------------+ |
|   |        CREATE A ROOM           | |  primary, 56px
|   +--------------------------------+ |
|   [ A B C D E ]  [ JOIN ]            |  code input + button
|                                      |
|            How to play               |  link -> /rules
+--------------------------------------+
```
(Wordmark: "dBay" — lowercase d, capital B. Use our own logo; never eBay's colors, logo shapes or fonts.)
- Elements: wordmark, Create, code input (auto-uppercase, strips spaces, 5 chars, `autocapitalize=characters`, `inputmode=text`), Join, Rules link, theme-follows-system.
- States: Create loading (button spinner, disabled); Create error ("Couldn't make a room. Try again." plus retry; 429 -> "Too many rooms. Wait a bit."); bad code format (inline, no submit); join submit navigates to `/r/CODE`.
- Host vs non-host: n/a.

### 3.2 Join `/r/CODE`
```
+--------------------------------------+
|  Room  KQ4TZ                         |
|                                      |
|  Your name                           |
|  [ Pat________ ] 16 max              |
|                                      |
|  A color + shape is assigned on join |
|                                      |
|                                      |
|  [        JOIN THE ROOM         ]    |  unlocks audio
|  Sound is off. Change in ⋯ later.    |
+--------------------------------------+
```
- Elements: code header, name input (prefilled from `localStorage`), note that color and shape are assigned on join, Join button (also performs Web Audio unlock, Wake Lock request, and sends `hello`).
- States: loading (skeleton while checking room), **Room not found** (full-screen card "No such room. Check the code." [Back]), **Room full** ("This room is full (6/6)." [Back]), **Game already started** ("Game in progress. Ask the host to rejoin you" shown only if no stored secret; with stored secret it silently reconnects), **Kicked** ("You were removed from this room." [Home], no retry), name taken (suffix added server-side, shown in lobby as "Pat 2"), name invalid (inline).
- Host vs non-host: identical. A returning player with a stored secret skips this screen.

### 3.3 Lobby (same route, phase = lobby)
```
+--------------------------------------+
| Room KQ4TZ        [Copy link] [⋯]    |
|--------------------------------------|
| Players 4/6                          |
| (● Red  Sam  HOST)  (▲ Blue  Pat YOU)|
| (■ Yellow  Bot 1 🤖)  (◆ Green  Lee) |
| ( + empty seat )  ( + empty seat )   |
|--------------------------------------|
| Mode: (Classic) (Frenzy)             |
| Bid window: 3s (5s) 8s   Classic     |
| [ ] Relaxed timing x1.5              |
|--------------------------------------|
| [   START GAME   ]   (host only)     |
| Waiting for Sam to start...  (others)|
+--------------------------------------+
```
- Elements: code + Copy link (copies `https://host/r/CODE`, button text flips to "Copied!" for 1.5s), player chips (tap own chip to rename), mode selector (default follows player count: 3-4 Classic, 5-6 Frenzy; host may override, 02), game length selector (Quick / Standard, 01 section 8; hint shows target minutes per mode), bid-window selector (3/5/8 s, Classic only, 01 R11), Relaxed timing, Start, ⋯ (sound, haptics, theme, rules, leave).
- States: loading/connecting (skeleton chips); reconnecting overlay (3.7); under 3 seats (humans + bots): Start disabled with "Need at least 3 players"; kicked (as 3.2); empty seats shown as dashed placeholders.
- Host only: Start, Kick (kebab on each other chip, confirm; bots get Remove), Add bot, mode, game length, bid window, Relaxed timing (all via `setOpts`). Non-hosts see these read-only. Renaming uses `rename` (lobby only). Host badge "HOST" moves on host migration with toast-free text change.

### 3.4 Game (detail in section 4)

### 3.5 Reveal / Results (phase = reveal -> ended)
```
+--------------------------------------+
| REVEAL                      [⋯]      |
|--------------------------------------|
| TOYS  x2 collection!                 |
|  [Yo-yo  est 40 -> $85]  STEAL!      |
|  [Robot  est 60 -> $20]  Ripped off! |
| MEDIA ...                            |
|--------------------------------------|
| Standings                            |
| 1 ▲ Pat   $2,140  (crown)            |
| 2 ● Sam   $1,980                     |
| 3 ◆ Lee   $1,410                     |
|--------------------------------------|
| [ REMATCH ] (host)    [ Leave ]      |
+--------------------------------------+
```
- Elements: scrolling reveal list (this screen may scroll) grouped by category, each card flips estimate -> actual, tag (STEAL! when actual is at least 1.3x est, Ripped off! when at most 0.6x est; same as 03 section 2.2 tiers), collection bonus line, Gift resolution line, ranked scoreboard with tiebreak note ("Tie: Pat holds higher unspent cards"), Rematch, Leave. Reveal runs automatically (about 0.5s per item, tap anywhere to skip to the end); a "Skip" button is always visible. Final standings appear when done or skipped.
- States: loading (flip placeholders), reconnecting overlay, empty (a player with no items: "Empty-handed. Nothing to reveal."). Late joiner/reconnect during reveal gets the finished state.
- Host only: Rematch (returns everyone to lobby). Others see "Waiting for host to rematch" and Leave.

### 3.5b Gift step (phase `playing`, stage `gifts`; same route as the game)
Shown as a centered card over the dimmed bays, one Gift at a time (owner: WS6, mounted by the game route). Text: "{holder} opened a Gift!" Then:
- **Holder** (stage `pickTarget`): list of eligible players (chip + item count) and a countdown (`gift.endsAt`). Others see "{holder} is choosing...".
- **Victim** (stage `pickItem`): own scorable cards (items and Display Cases, never Gifts) as tappable tokens with est values; countdown; the pick sends `giftGive`. Others see "{victim} must give up something...".
- Fizzle or timeout default shows as a status-strip line ("{name} gave up {item}"). Values stay hidden until `reveal`.

### 3.6 Rules `/rules` and sheet
Single scrollable page with sticky short TOC chips (Goal, Setup, A turn, Bidding, Winning a bay, Last round, Special cards, Collections, Scoring, Modes; 10 sections so every rule R1-R37 fits under 80 words each, WS6 2026-10-12). Same content shows in-game as the **Rules** tab of the ⋯ menu (gameplay stays mounted behind); `?` opens it on desktop. Copy lives in `apps/web/components/rules/content.ts`. Plain language, each section under 80 words, with tiny illustrated examples. States: static, no loading. Host/non-host: identical.

### 3.7 Reconnecting overlay (all room screens)
Semi-opaque scrim over current screen, centered card "Reconnecting..." with spinner and attempt hint after 5s ("Still trying. Check your signal."). It blocks input (bids would be rejected anyway). Backoff 500ms to 5s. On success, snapshot replaces state silently. If the server says session invalid: "You've been removed or the room ended." [Home]. Overlay appears after 1s of disconnect to avoid flicker.

## 4. Game screen detail

### 4.1 Layout budget (390x844, about 780px usable; nothing scrolls)

| Element | 3 bays (stacked) | 4 bays (2x2) |
|---|---|---|
| Merged HUD (turn + status text + clock + Pass + menu, timer bar; no separate TurnBanner) | 94 | 94 |
| Bays | 408 (3 x 128 + 2 x 12 gap) | 336 (2 rows x 162 + 12 gap) |
| My collection strip | 44 | 44 |
| Hand (58px / 62px cards, 2 rows) | 128 | 136 |
| Padding | 40 | 40 |
| **Total** | **714** | **650** |

Both are under the 780px ceiling; the leftover (84px / 140px) is slack for the iOS safe areas and dynamic browser chrome, not new UI. Use `100dvh` and `env(safe-area-inset-*)`. Use a flex column where bays are `flex:1` with `min-height`, so small phones (360x640) shrink bay and hand heights but never scroll. Below 700px viewport height, hide the estimated-value line on bays (it stays in long-press details).

### 4.2 Bay component anatomy
3-bay card (342x128):
```
+----------------------------------------+
| [toy icon] Wind-up Robot      (toys)   |  name 16px bold; category chip
| est $60                         ⏱ 0:12 |  est value; timer (Frenzy only)
|                                        |
|   $150        ( ▲ Pat )                |  top bid 32px Lilita; bidder chip
+----------------------------------------+
```
4-bay card (165x162): name wraps to 2 lines, category chip is icon-only, timer is a thin bar along the bottom edge.
- **Item name**: 1-2 lines, truncated with ellipsis, full name in long-press details.
- **Category chip**: glyph + short label (icon-only in 4-bay).
- **Est value**: "est $60", dim. Hidden on short screens.
- **Top bid**: gold numerals; "No bids" in dim text when empty; also shows opening hint.
- **Bidder chip**: player color + shape + name; slides in on bid.
- **Per-bay timer (Frenzy only)**: bar plus mm:ss text; the clock is a 20px display number, and only in the last 3s it turns into a `--danger` chip with a tick pulse (no pulse under reduced motion); "+3s" floats on extension. In Classic the bay has no timer; the shared clock is in the merged HUD (4.6).
- **Winning state:** a bay you top is strong, not faded: 3px border in your player color, a tint of that color, a 6px top stripe, a green "✓ You're winning" pill (text + check, so it is not color-only) and a larger price. Faded (45%) plus stripes is only for illegal bays; empty bays are dashed.
- **SOLD stamp**: rotated -8deg slab over the bay in the winner's color with their shape; stays 1.2s then bay refills (new item slides in). Reduced motion: stamp appears without slam.
- **Legal/illegal** (when a card is selected): legal = `--ok` 3px glow border + "tap to bid"; illegal = 45% opacity plus diagonal-stripe pattern and a small reason label ("Beat $150"). Never color alone.
- Long-press (400ms): item details sheet (name, category, est, flavor text).

### 4.3 Hand component
- 12 cards in a **6x2 grid** (mobile): card 56x52 (3-bay layout, 112px total with 8px gap and padding), 2 rows. Bid cards $10 to $300 take 10 slots, the 2 Proxy cards take the last 2 slots in the second row. In the 4-bay layout (128px) cards are 56x60.
- Order by value ascending, Proxies last, so positions never shift.
- **Spent cards** (won and gone): remain in place but dashed outline, empty paper-gray, value struck-through at 40% opacity, not focusable (`aria-disabled`). Positions stay fixed so muscle memory holds.
- **Cards currently committed as a top bid** are "out on table": outline plus small bay-letter badge (A/B/C/D); not selectable.
- **Selected**: lifts 8px, 3px `--focus` ring, scale 1.06.
- **Unavailable (not your turn, Classic)**: 60% opacity, no lift on tap, status strip text explains.
- **Proxy styling**: striped gold diagonal band with a "PROXY" label and the ⓟ glyph (not color-only). A Proxy has no face value and no picker (01 R2, R15-R16); it behaves like any card. On a bay it shows face-up as "Proxy" (01 R16 visibility).
- **Special cards are not in the hand.** Display Case and Gift are won items (01 R25-R27), never bid cards. Won specials show as tokens in the collection strip (4.4); the hand is always exactly the 12 bid cards.

### 4.4 Collection strip (40px)
Horizontal row of mini item tokens (24px category glyph chips, grouped by category with a count badge), then special tokens: Display Case "$100 wild" and Gift (pending until resolved). Shows my items only here; overflow scrolls horizontally inside the strip, not the page. Tap opens ⋯ -> "Collections" tab. A collection reaching 3 gets a gold underline ("x2").

### 4.5 Status strip (44px, `aria-live="polite"`)
Left: event text (one line, ellipsis, crossfade 150ms). Middle: round pips (ASSUMED: Classic shows a progress bar rather than "Round X of Y", since rounds reach about 50; the R9 "Halfway" and "Last round" announcements stay unchanged; "Round {n}/{of}" plus a mini progress bar; `of` from the view, 01 section 8 / 02 F7). The server sends structured log entries; this table is the only text source. Right: ⋯ button (44x44). Tap the text area to open the event log (last 30 events). Exact strings (use `{name}`/`{amount}`/`{item}`; names include shape glyph in UI):

| Event | Text |
|---|---|
| Game start | "Doors open! First bays are up." |
| Classic: your turn | "Your turn, {name}! Pick a card." |
| Classic: other's turn | "{name}'s turn" |
| Classic: turn passed | "{name} passes" |
| Auto-pass (disconnected) | "{name} is away: auto-pass" |
| Frenzy start | "Frenzy! Bid any time." |
| New bid | "{name} bids ${amount} on {item}" |
| Outbid (you) | "Outbid by {name}! ${amount}" |
| Your bid is top | "You lead {item} at ${amount}" |
| Your bid accepted (local, 2.6s) | "Bid sent: ${amount} on {bay letter}" ("Proxy" for a Proxy card) |
| Bid rejected | "Can't bid that. Beat ${top}." |
| Timer extended (Frenzy) | "Late bid! +3s on {item}" |
| Last 3 seconds | "Going once... going twice..." |
| Sold | "SOLD! {item} to {name} for ${amount}" |
| Sold to you | "Yours! {item} for ${amount}" |
| Unsold / closes empty | "{item}: no bids. Carried over." |
| Bay refilled | "New in bay {letter}: {item}" |
| Collection made | "{name} completed {category}! x2" |
| Special acquired | "{name} got a {Display Case / Gift}" |
| Halfway | "Halfway there! Round {n}/{of}" |
| Last round | "Last round! Everything sells." |
| Game over | "That's the gavel. Time to reveal..." |
| Player left/rejoined | "{name} left" / "{name} is back" |
| Host changed | "{name} is now host" |
| Reconnected | "Back in the room" |

### 4.6 Merged HUD: turn + clock (one ~94px bar with 4.5)
There is no separate banner. One navy bar has a left accent border in the turn player's color. Row 1 (44px): tap area (opens the log) with the turn title on line 1 ("Your turn" as a pill in your color, or "{shape} {name}'s turn") and the status text on line 2 (plus the game-progress bar); then the clock, Pass (Classic, my turn) and the ⋯ button. A thin 8px timer bar sits along the bottom. The event text is exposed once, as a separate sr-only polite live region.
- **Classic clock:** a large (30px) dark-on-white number. Urgency (coral chip + tick pulse) starts only in the last 3s; no pulse under reduced motion.
- **Frenzy:** the title reads "FRENZY" and there is no global number; the bottom bar (3px, quiet) shows the soonest-ending bay. The per-bay clocks (4.2) carry the timing.
- **Bid feedback (sound off included):** on tapping a legal bay a ghost card flies from the hand card to the bay (260ms, transform only); when the snapshot arrives the bay pops (scale 1.04, 1.02 for others' bids) and flashes a 6px ring (green for my bid), and the status says "Bid sent: ${amount} on {bay}". Reduced motion: no flight and no scale; the ring flash and the status text remain.

### 4.7 ⋯ sheet (bottom sheet 70% height mobile; docked right sidebar 320px on desktop)
Tabs/sections: **Players** (all players with chips, item counts, card counts; tap to expand their collection: items with est values and category counts, from the view's public `collection`), **Collections** (mine, detailed), **Event log** (last 30), **Settings** (Sound toggle, Haptics toggle, Relaxed timing x1.5 (host-set, shown read-only to others mid-game), Theme), **Rules** (rules content inline as a tab), **Leave game** (confirm). Draggable handle, Esc/swipe-down/backdrop closes. Focus is trapped while open on mobile.

## 5. Bid interaction spec

Two taps: card, then bay.

| State | Trigger | Next state | Visual / side effects |
|---|---|---|---|
| Idle (can't act: Classic, not my turn) | tap card | Idle | cards 60% opacity; strip shows "{name}'s turn"; no selection |
| Idle (can act: my turn or Frenzy) | tap card | CardSelected(card) | card lifts; legal bays glow, illegal dim (stripes + reason) |
| CardSelected(c) | tap different unspent card | CardSelected(c2) | selection moves, legality re-evaluates |
| CardSelected(c) | tap same card | Idle | deselect |
| CardSelected(c) | Esc / tap empty space / tap spent card | Idle | deselect |
| CardSelected(c) | tap legal bay | Pending(c, bay) | optimistic: card slides onto bay, bidder chip appears with "sending" tint, `clientSeq` sent |
| CardSelected(c) | tap illegal bay | CardSelected(c) | bay does a tiny nudge (no shake), reason label flashes |
| Pending | ack ok + snapshot | Idle | tint resolves; bid-bump fires |
| Pending | ack error / newer snapshot invalidates | Idle | card flies back, **card shakes** (6px x 3, 300ms), strip: "Can't bid that. Beat ${top}." |
| Pending | disconnect | Idle | revert optimistic state; reconnect overlay |
| Any | phase changes / turn ends | Idle | selection cleared |

Legal bay for card c (client mirror of 01 R16; the server decides): bay holds a card, c is in my hand, top bidder is not me, and either the stack is empty, or c is a Proxy, or (top is not a Proxy and c's face is strictly greater than top's face; equal is illegal). If top is a Proxy only a Proxy is legal. Classic: only on my turn, one bid per call; on bid, turn ends. Frenzy: any time; selection persists across bay timer changes. If a selected bay becomes illegal due to a snapshot, selection stays but that bay dims. Always trust the snapshot over optimism.

Keep the default flow tap-friendly: no drag required (drag from card to bay is a progressive enhancement, Later).

## 6. Desktop (>=1024px) and tablet

**Desktop:** centered stage max 1100px. Bays in one row (3 or 4 wide, ~240px each, 160px tall) with the item art area larger. Hand below as a single row of 12 cards (64x80). Collection strip below the hand. Status strip on top. The ⋯ sheet content is docked open as a 320px right sidebar (Players, Collections, Log, Settings tabs), with no ⋯ needed. Same components as mobile via container queries; no desktop-only components.

**Keyboard shortcuts:** `1`-`9` pick cards 1-9 (in ascending order of unspent cards), `0` picks the 10th, `-` / `=` picks the Proxies; `Q W E R` bid the selected card on bays 1-4; `Esc` cancels selection or closes sheet; `?` opens rules; `M` toggles sound; `Tab` order: strip, hand, bays. Shortcut hints appear as small badges on cards/bays, desktop only. Don't steal keys while focus is in a text input.

**Tablet (600-1023px):** use the mobile layout scaled up in a centered 560px column with larger cards (hand 6x2, 72px cards), bays 2x2 even for 3 bays only if the screen is landscape. Sheet stays a bottom sheet. Landscape phones (height under 500px): bays left (2x2 or 3 in row), hand right in a 4x3 grid, strip on top; if too cramped, show a "Rotate to portrait" nudge (not a block).

## 7. Feedback moments, sound and haptics

All motion is wrapped by `MotionConfig reducedMotion="user"` for Motion, and `@media (prefers-reduced-motion: reduce)` for CSS. Default easing `cubic-bezier(.2,.9,.3,1.2)` (spring-ish) for entries, `ease-out` for exits.

| # | Moment | Timing and easing | Tech | Reduced-motion fallback |
|---|---|---|---|---|
| 1 | Bid bump: top-bid number pops, bidder chip flashes | number scale 1 -> 1.25 -> 1 over 280ms spring-ease; chip background flash 200ms | CSS (class toggled via `key` change) | no scale; 150ms color fade only |
| 2 | Your turn: pulsing border + timer bar in your color; Android vibrate | border pulse 1s ease-in-out infinite (opacity 0.5 -> 1); bar depletes linear | CSS | static 3px border, no pulse; bar still depletes |
| 3 | Outbid: your chip slides off bay, edge flashes red 300ms | chip translateX 0 -> 40px + fade 250ms; edge `--danger` 300ms | CSS | chip fades out in place; 300ms edge flash kept (single, non-flashing fade) |
| 4 | Timer: red in last 3s; "+3s" floats up | color transition 200ms at t<=3s; "+3s" translateY 0 -> -20px, fade out 700ms | CSS | color change only; "+3s" appears static for 700ms |
| 5 | SOLD: stamp slams, card flies into winner's collection | stamp scale 2 -> 1, rotate -8deg, 220ms with overshoot, holds 1.2s; card fades/translates to strip 450ms | Motion (`m`, `AnimatePresence`, `layoutId` for card travel) | stamp fades in 150ms; card swaps without travel |
| 6 | Reveal: values flip with tags; confetti for winner | card rotateY flip 400ms, staggered 500ms apart; tag pops 200ms; confetti 2.5s | Motion; `canvas-confetti` lazy-imported | no flip (crossfade 150ms); no confetti, a gold crown badge instead |

Rules: never block input during animations (all animate transforms/opacity only, pointer events pass through); never queue more than 3 pending animations (drop the rest to final state). Respect the `data-motion="off"` toggle from the ⋯ sheet if added.

**Sound (off by default; Web Audio context unlocked on the Join tap; hand-written ~100-line player; sounds are < 20KB each, synthesized or short files):**

| Event | SFX |
|---|---|
| Card select | soft tick |
| Bid placed | wooden "tok" |
| Bid accepted/top | rising two-note chirp |
| Outbid | low descending "bwop" |
| Rejected | dull buzz |
| Your turn | bell ding |
| Last 3s | clock tick each second |
| Timer extend | small "ting" |
| SOLD | gavel crack |
| Collection complete | short fanfare |
| Halfway/last round | gong |
| Reveal flip | paper flip per card |
| Win | cheer jingle |

Sound-off must lose no information: every row above has a text line in the status strip (4.5) and a visual from section 7.

**Haptics (Android only via `navigator.vibrate`; iOS Safari has no support, feature-detect and hide the toggle if absent; default on where supported, since it is silent):** your turn `[40]`; outbid `[30,40,30]`; bid rejected `[80]`; SOLD to you `[20,40,20,40,60]`; last 3s none (too noisy).

## 8. Accessibility checklist

- [ ] Player identity is color + shape + name everywhere (chips, bays, strip, reveal); palette is Okabe-Ito based (section 2).
- [ ] Contrast: text 4.5:1 (WCAG 1.4.3), UI components and focus rings 3:1 (1.4.11); validated per token pair.
- [ ] Card/bay states (selected, spent, legal, illegal, committed) differ by outline, pattern, label or icon, never color alone (1.4.1).
- [ ] Touch targets at least 44x44 CSS px; at least 8px between adjacent cards (2.5.8).
- [ ] Status strip is `role="status"` / `aria-live="polite"`; urgent events (your turn, outbid, sold to you) use `aria-live="assertive"` sparingly.
- [ ] Time limits: "Relaxed timing x1.5" (WCAG 2.2.1); no timer-only information.
- [ ] `prefers-reduced-motion` honored through Motion config and CSS (2.3.3); no flashing over 3 per second (2.3.1); 300ms outbid flash is a single pulse.
- [ ] Full keyboard operation (2.1.1), visible focus (2.4.7, 2.4.11), logical tab order, shortcuts documented and not single-key conflicts (2.1.4: disable via `?` panel option or only active outside inputs).
- [ ] Hand cards are `button`s with accessible names ("$150 card, available" / "$150 card, spent").
- [ ] Sheets are dialogs with focus trap, Esc to close, return focus.
- [ ] Reflow: works at 320px wide and 200% zoom without horizontal scroll (1.4.10) (game screen may enable vertical scroll under zoom).
- [ ] Do not disable pinch zoom (`viewport` without `user-scalable=no`).
- [ ] Reveal and results provide text equivalents for all stamps/tags.
- [ ] Language attribute, form labels, error text tied via `aria-describedby`.

## 9. Component inventory

| Component | Responsibility | Screens |
|---|---|---|
| `AppShell` / `ThemeProvider` / `MotionRoot` | theme, fonts, `LazyMotion`, `MotionConfig` | all |
| `RoomConnection` (hook + provider) | WS, snapshot store, reconnect, clock offset | join, lobby, game, reveal |
| `ReconnectOverlay` | blocking scrim | all room screens |
| `RoomErrorCard` | not found / full / kicked / expired | join, lobby |
| `CodeInput`, `NameInput` | validated inputs | landing, join, lobby |
| `PlayerChip` | color + shape + name, sizes sm/md | all |
| `PlayerList` | lobby chips, host actions | lobby |
| `HostControls` | start, kick, add bot, relaxed toggle | lobby |
| `BigButton` | chunky primary/secondary button | all |
| `BottomSheet` / `Sidebar` | ⋯ content container (dock on desktop) | game, lobby, rules |
| `MoreSheet` (tabs) | players, collections, log, settings | game |
| `StatusStrip` | event text, round pips, ⋯ | game |
| `EventLog` | last 30 events | game |
| `StatusStrip` (merged HUD) | turn, event text, clock, Pass, timer bar, menu | game |
| `BayGrid` / `Bay` | layout + bay anatomy | game |
| `BidChip`, `TopBid` | animated number + bidder | game |
| `SoldStamp` | slam animation | game |
| `Hand` / `BidCard` | grid, card states | game |
| `CollectionStrip` / `ItemToken` | my items | game |
| `ItemDetailsSheet` | long-press details | game |
| `useBidMachine` | section 5 state machine | game |
| `RevealList` / `FlipCard` / `Scoreboard` | reveal | reveal |
| `GiftStep` | gift step (3.5b) | game route (WS6-owned) |
| `Confetti` | lazy canvas-confetti | reveal |
| `RulesContent` | shared rules body | rules page, sheet |
| `SoundPlayer`, `useHaptics`, `useWakeLock` | sound/haptics/wake lock | WS8 |

Ownership: WS4 = shell, connection hook, landing/join/lobby, chips, buttons, errors, `BottomSheet`/`Sidebar`. WS5 = game screen components, `MoreSheet`, `EventLog`, `useBidMachine`. WS6 = reveal, rules and `GiftStep`. WS8 = animations, sound, haptics, and the feedback classes the other components expose via `data-` attributes.

## 10. MVP / Later / Cut

- **MVP:** everything above: all six screens, status strip, 2-tap bidding, six feedback moments, optional sound and haptics, Relaxed timing, a11y checklist, desktop layout and shortcuts.
- **Later:** emoji reactions (one button in ⋯, no permanent bar), award titles, auctioneer voice lines, the Appraisal card, item art packs, a feedback form.
- **Cut:** chat, screen shake, full-screen flash, toast stacks, team mode, spectator mode, market events, catch-up mechanics, Buy It Now and Snipe cards, music.

## 11. Decisions added 2026-10-11 (after mockup review)
**Brand palette.** Do not use eBay's logo colors (#E53238 / #0064D2 / #F5AF02 / #86B817):
- Paired with the name "dBay" they read as eBay trade dress.
- eBay's red/green pair also fails for colorblind players, and our player colors must be distinguishable.

Instead, the **wordmark letters d·B·a·y use our own player colors** (Red, Blue, Yellow, Green from §2). That gives the playful four-color nod and ties the logo to the game's players.

**Pixel-art item sprites (MVP).** Every item has a 12×12 pixel sprite:
- Rendered at **72×72 in Classic bays**, as the left column of the bay. The bay height doesn't change (136px), and the text moves right.
- Rendered at **48×48 in Frenzy 2×2 bays**, beside the item name.
- Rendered at **24px** in collection/reveal rows (optional).
- Decorative only: `aria-hidden`, and never the only way to identify an item.
- Use `image-rendering: pixelated` and crisp integer scaling.
- Fallback when an item has no sprite yet: its category's sprite.

Data format and authoring rules are in 03-content.md §Sprites.

**Bays you're winning stand out (changed in the HUD polish PR; they used to be muted).** Whenever you are the top bidder on a bay, that bay renders strong, never faded: 3px border in your player color, a tint of it, a top stripe, a larger price, and a green "✓ You're winning" pill. Faded styling is reserved for bays you cannot act on (illegal or empty). If you get outbid, it switches to the outbid ring and pill (feedback moment 3).

**Spacing.** The mockups are rough. The build uses the §2 spacing scale (4/8/12/16/24/32) and radii tokens exclusively. No ad-hoc pixel values.

## 12. Decisions added 2026-10-11 (second mockup review). These supersede §2 and §11 where they conflict.
**Player palette: eBay-inspired with our own twist (the user's call).**

| Player | Shape | Color |
|---|---|---|
| Red | ● | #F04B3E |
| Blue | ▲ | #3A85F8 |
| Yellow | ■ | #FFB81C |
| Green | ◆ | #8BC53F |
| Purple | ★ | #A97CF8 |
| Teal | ✚ | #22BFAE |

- **Player 6 changed** from Orange to Teal. Orange collided with marigold and coral-red.
- **Text on every player chip is ink** (#1E1A14).
- **Colorblind safety relies on shapes.** Red and Green are a weak pair for colorblind players, so shapes are **mandatory** on every chip and bidder label, and are never removed.
- **Wordmark** d·B·a·y uses Red, Blue, Yellow and Green.
- **Retheme path.** If the game is ever made public, swap these six tokens for a different palette. It's a one-file change.
- **Danger vs player red.** The danger token (#FF6B5E) stays close to player Red. It must always come with text ("OUTBID!") or a shake, never color alone.

**Frenzy tiles: no overlays during play.** Each tile is four fixed rows:
1. Status label + category chip. The status label is `BAY n`, an `OUTBID!` pill, or a `✓ WINNING` pill, and it replaces the label rather than floating over the tile.
2. Sprite (44px) + name and estimated value.
3. Top bid + bidder chip.
4. Timer bar, with `+3s` shown inline before the seconds text.

The only overlay is the terminal **SOLD** state, which covers the whole tile with the stamp plus "✚ Kai · $250".

**Collections are readable at a glance, with detail one tap away.**
- **The strip (44px)** is a button labelled SETS. It lists only the categories you own, each as color square + short name + 3 pips (●●○), plus a WILD tag if you hold a Display Case, and a ˄ chevron.
- **Tapping or swiping up** opens a bottom sheet "Your collections" with all 6 categories:
  - Each row shows its name, the items you own, and 3 pips.
  - A gold "One more = ×2!" hint appears at 2 of 3.
  - Empty categories are dimmed.
  - A dashed WILD row explains the Display Case.
- **Closing:** "Back to bidding", tap outside the sheet, or swipe down.
- **The sheet doesn't stop the game.** The HUD clock keeps running behind it, and in Classic it closes automatically when your turn starts.
- **Desktop** shows the same content docked in the right sidebar.

## 13. Theme decision 2026-10-11: WHITE is the default. This supersedes the §2 token table where they conflict.
- **Default is light (white).** The dark "felt" theme is an optional toggle in the ⋯ sheet.
- **Ignore the OS dark-mode setting.** Everyone starts in light, and the user's choice is remembered in localStorage.

**Light tokens (default):**

| Token | Value | Use |
|---|---|---|
| `--bg` | #FFFFFF | page |
| `--bg-raised` | #F3F4F6 | bays, strips, sheets |
| `--bg-muted` | #ECEEF2 | muted surfaces (spent cards, empty areas) |
| `--card` | #FFFFFF | bid cards (2px ink border + hard shadow) |
| `--ink` | #0E1511 | borders, shadows |
| `--text` | #191919 | primary text |
| `--text-dim` | #5B6370 | secondary text (was #6B7280; 4.39:1 failed AA, a11y audit 2026-10-12) |
| `--navy` (secondary brand color) | #1E2A44 | status strip, primary buttons, Proxy cards, selected segments, focus ring |
| `--gold` | #8F5E00 | money and top bids; marigold #FFB81C on navy surfaces (was #B07400; 3.92:1 failed AA) |
| `--ok` | #22A35A | legal-bid glow |
| `--danger` | #FF6B5E | always paired with text or shake |
| `--on-card` / `--on-card-dim` / `--gold-on-card` | = `--text` / `--text-dim` / `--gold` | text on `--card` surfaces (buttons, inputs, segments, reveal cards) |

- **Player colors** are unchanged (§12), with ink text on every chip.
- **Dark theme** keeps the original §2 felt tokens, with gold #F2B93B. Cards stay cream in dark, so `--on-card` #191919, `--on-card-dim` #5B6370 and `--gold-on-card` #8F5E00 keep text on cards readable (before the a11y audit, cream text on cream cards was 1.06:1).
- **Reference mockups:** every screen is white. Board 3b ("GameDark") shows the dark toggle.

## 14. Layout matrix: bay count is set by player count, not by mode
| | 3 bays (3–4 players) | 4 bays (5–6 players) |
|---|---|---|
| **Classic** | Stacked full-width bays, 136px, 72px sprite. Turn clock in the HUD only. (mockup 3) | 2×2 grid, 164px tiles, 52px sprite, no per-bay timer row. (mockup 4b) |
| **Frenzy** | Stacked full-width bays, 146px, 64px sprite, with a per-bay timer row at the bottom. (mockup 4c) | 2×2 grid, 188px tiles, 44px sprite, with a per-bay timer row. (mockup 4) |

- **One component.** `Bay` takes `layout: 'row' | 'tile'` and `showTimer: boolean`. Tile rows are always: status label + category, sprite + name and estimate, top bid + bidder, then the timer row (Frenzy only).
- **Fit check.** All four combinations must fit within the ~780px budget with nothing scrolling.

## 15. Polish decisions 2026-10-12 (WS5)

- Item details: long-press (450ms, cancelled by moving more than 10px or pointer-cancel) or right-click on a bay opens a bottom sheet with sprite, name, category, **estimated** value, flavor and the top bid (the true value is never sent). A fired long-press swallows the following click, so it never bids. Keyboard: `i` while a bay is focused; screen readers and keyboard users also get a per-bay "Item details: NAME, bay X" button (a 44px target that is invisible and click-through until focused).
- Assertive live region (visually hidden, separate from the polite status strip) announces only: "Your turn" (Classic), "You were outbid on bay X", "Sold to you". The strip text for those events is `aria-hidden` inside the polite region so nothing is read twice.
- Tab order is the merged HUD (log, Pass, menu), hand, bays, sets. DOM order is that; the visual order (bays above hand) is restored with CSS `order`.
- Small screens: 4-bay tiles on 320 wide keep amount + bidder on one line; at heights under 600px (320x568) tile sprites shrink to 28px and 3-bay rows go to a two-column grid (body | bid, timer underneath). 44px targets are enforced at 360x640; at 320x568 only "no page scroll" is enforced.
