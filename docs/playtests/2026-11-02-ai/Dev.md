# Dev notes
- Opened with $125 on a Crystal Decanter, got outbid-proof with $200 next turn and won it. Quickly learned keys 1-0 pick cards and Q/W/E pick bays (shown in the footer), which made turns fast.
- Learned the hard way that a card stays "out" on a bay until it closes even after being outbid ("That card is on bay B until it closes"); I wasted two key presses on already-committed cards (and mixed up the $125/$200 hotkeys).
- Built Antiques (Bronze Horse Statue $150, Treasure Map $75) and bought a Display Case wild for $250 after a 3-way bid war. The "One more = x2!" hint in YOUR SETS drove my decisions.
- Paid $300 for the Holo Critter Card (est $200); it revealed at $320 (Steal). Prices are est, but the real value is hidden until the end.
- Used Proxy on a Film Reel and a Comic Book and won both for "a Proxy" (it seemingly beats numbers); did not fully understand its rules until after.
- Mia's Gift picked me; I had to hand over an item (gave the Lawn Flamingo Pair). Never got to see what a Gift bay yields for the winner besides Mia's result.
- Results reveal: 9 items, Antiques x2 plus a wild x2 doubled.

## Verdict
$2,055, 1st of 4 (Mia $1,380, Sam $600, Ray $385). Fun 7/10: fast and tense, but the hidden values make the bidding feel like guessing.

## Best moments
- The reveal: Bronze Horse Statue est $150 -> $255 x2 = $510, Map $480. Huge swing.
- Winning bay A's Decanter early with the "Yours!" log line.

## Worst moments
- Hotkey mix-ups and locked cards after being outbid.
- Having no idea why I was ahead until results; the lead looked like luck.

## Bugs / UI problems
- Hotkeys for cards 1-0 map by denomination, but spent cards stay in place so press 7 after $150 is spent silently does nothing but the bay press then shows "Pick a card first" (Dev-032.png, Dev-092.png, Dev-116.png). A visible "card spent / locked" flash on the key press would help.
- Outbid cards still showing "out on bay X" (Dev-035.png) is confusing: I did not realize outbid cards stay locked.
- Bay "closing" is invisible; I never saw a clear countdown for when a bay sells (items just vanished in "SOLD!" log lines). Bay B showed "empty" with no explanation (Dev-116 state).

## Did the game teach you the rules?
Partly. The first tip ("Bid cards don't score: only the items you win do. Spend them!") appeared on my first card pick (Dev-007.png), which is the right moment. "One more = x2!" in the sets panel taught sets of 3 well. Proxy and Gift were never explained in-flow; I found Proxy by trying it. Winning an item is signalled only by a log line "Yours!" and the bay clearing: not exciting.

## Strategy and balance
There are real decisions (which bay, how much, set chasing), but item true values are hidden, so est is a noisy guide. Strongest line: chase a 2-3 set of Antiques plus a wild. Overpaying with high cards is cheap since leftovers are worth nothing, so spend everything (Sam and Ray ended with 8-9 unused cards and finished last: leftover cards were the clear mistake). Mia seemed to dominate by bidding often on all bays.

## What I would have wanted
A running "spent/remaining" total, a visible bay close timer, a toast on winning an item, and a quick explanation of Proxy and Gift.

## Top 5 changes
1. Celebrate winning an item (toast/animation, not just log).
2. Show a bay close timer clearly.
3. Make outbid cards free again immediately, or explain the lock.
4. Explain Proxy and Gift in tips at first use.
5. Show a "cards left to spend" reminder on late turns.
