# Desktop design pass (mockups only, no app code changed)

File: `docs/mockups/desktop/desktop-mockups.html` (self-contained; Google Fonts only; opens at any width, mockups scale to fit, phone width scrolls inside each frame).

## What is in it
- Direction A "Auction floor": top bar, a row of player podiums (turn, cards left, items won as sprites), big bays (96px / 72px art), sets strip, hand as a card rack, key legend bar.
- Direction B "Dashboard": bays and hand in the centre, persistent 360px right rail (players, sets with pips, log).
- For each: Classic 3 bays (my turn, card selected), Frenzy 4 bays (timers, one bay "going twice"), Results/reveal. Each playing scene also has a 1280x800 variant.
- "What changes vs today" with `before-classic3.png` and `before-frenzy4.png` (current build at 1440x900).

## Open questions
1. A, B, or a hybrid (e.g. A's podiums plus B's right rail for log and sets)?
2. Should desktop bays use art larger than the spec's 72px Classic (96px shown, a multiple of 12)?
3. Is a persistent log (B) worth the width, or is the `L` drawer (A) enough?
4. Keep the full-width key legend bar, or show hints only as card/bay badges?
5. Reveal: show only your own haul with a player switcher (B), or everyone's at once (A)?
6. Sprite sizes assume integer scaling (48/72/96); confirm that is a hard rule on desktop.
