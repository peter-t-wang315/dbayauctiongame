// Player-facing rules copy (04 section 3.6), derived from docs/01-game-rules.md and docs/02 (Frenzy).
// Plain language, each section body under 80 words. Rule IDs in the comments tie each line to 01/02;
// `content.test.ts` checks that every rule R1-R37 is covered here. Numbers mirror packages/engine config.

export interface RulesSection {
  id: string;
  /** Short TOC chip label. */
  chip: string;
  title: string;
  body: string[];
  /** Tiny worked example, shown boxed under the body. */
  example?: string;
}

export const RULES: RulesSection[] = [
  {
    id: 'goal',
    chip: 'Goal',
    title: 'The goal',
    body: [
      // R3, R32, R36
      'Win auctions, build collections, and finish with the most valuable stuff.',
      // R32, R36
      'Every item shows an estimated value. Its real value stays hidden until the end: some are steals, some are junk.',
      // R35
      'Highest total wins.',
    ],
  },
  {
    id: 'setup',
    chip: 'Setup',
    title: 'Your cards',
    body: [
      // R2
      'Everyone gets the same 12 bid cards: $10, 25, 50, 75, 100, 125, 150, 200, 250, 300 and 2 Proxies.',
      // R1, R5
      'Items wait in 3 bays (4 bays with 5-6 players).',
      // R3, R4, R6
      'The deck mixes items from up to 6 categories with a few special cards, shuffled fairly by the server. Quick games use a smaller deck.',
      // R16 visibility
      'Cards on bays are face-up. Your hand is private.',
    ],
  },
  {
    id: 'turn',
    chip: 'A turn',
    title: 'A turn (Classic)',
    body: [
      // R7, R8, R10, R11, R14
      'The auctioneer calls a color. That player has a few seconds to play one card on one bay, or pass. Everyone is called once per round, in a fresh random order.',
      // R12
      'A bid ends the turn right away.',
      // R13, R24
      "No legal bid, no cards left, or disconnected? You're skipped. You're never out: losing cards come back to you.",
    ],
  },
  {
    id: 'bidding',
    chip: 'Bidding',
    title: 'Bidding',
    body: [
      // R16.4, R15
      'A bid must beat the top card on that bay with a higher number. Ties are not allowed.',
      // R16.3
      "You can't outbid yourself.",
      // R15, R16.4
      'A Proxy beats any number. Only another Proxy beats a Proxy, and the newest Proxy is on top.',
      // R16 notes
      'You may have cards on several bays, and bid again where you were outbid.',
    ],
    example: 'Top bid is $75. You can play $100 or a Proxy, but not $50 or $75.',
  },
  {
    id: 'winning',
    chip: 'Winning a bay',
    title: 'Winning a bay',
    body: [
      // R17, R18
      'After each call, a bay with bids may close at random, more often as the game goes on. A bay never closes on the call that just got a bid, and bays left open too long are forced shut. Bays without bids never close.',
      // R19, R20, R21
      'The top bid wins the item. That card is spent; every other card goes back to its owner. A new item fills the bay.',
    ],
  },
  {
    id: 'end',
    chip: 'Last round',
    title: 'Halfway and last round',
    body: [
      // R9
      'The auctioneer announces Halfway and Last round.',
      // R22, R23
      'After the last round, every bay with bids sells and items nobody bid on are thrown out. If the deck and bays run out early, the game ends early.',
      // 01 section 6 order
      'Then Gifts are opened, and finally the real values are revealed.',
    ],
  },
  {
    id: 'specials',
    chip: 'Special cards',
    title: 'Special cards',
    body: [
      // R25
      'Display Case and Gift are auctioned like items.',
      // R26
      'A Display Case is worth $100 and is wild: at scoring it joins whichever collection helps you most.',
      // R27, R28, R29, R30
      'A Gift is worth nothing itself. After the auction, each Gift in turn lets its owner pick another player, who must hand over one item or Display Case. If time runs out, the game picks for them.',
      // R31
      'Gifts resolve one at a time, in the order they were won.',
    ],
  },
  {
    id: 'collections',
    chip: 'Collections',
    title: 'Collections',
    body: [
      // R33
      'Three or more cards of one category make a collection: every card in it counts double. You can have several.',
      // R33, R34
      'Display Cases can fill in, but you need at least one real item of that category. A Display Case in a collection is worth $200.',
    ],
    example: 'Two toys ($40 + $60) and a Display Case = 3 toys. Doubled: $80 + $120 + $200 = $400.',
  },
  {
    id: 'scoring',
    chip: 'Scoring',
    title: 'Scoring',
    body: [
      // R36, R37
      'At the end the real values flip over. STEAL! means an item was worth well over its estimate; Ripped off! means well under.',
      // R32, R33
      'Add up your cards, doubling collections. Most money wins.',
      // R35
      'Tied? The player holding more unspent bid value wins (Proxies count $0). Still tied, you share the place.',
      // R37
      'The host can start a rematch from the results.',
    ],
  },
  {
    id: 'modes',
    chip: 'Modes',
    title: 'Modes',
    body: [
      // 02 section 1, R11
      'Classic (default for 3-4 players): color calls, one bid per call. The host picks a 3, 5 or 8 second bid window.',
      // 02 F1-F7
      'Frenzy (default for 5-6): no turns. Anyone bids on any bay at any time. Each bay has its own timer, and a late bid pushes it back to 3 seconds. After a bid you wait 1 second.',
      // R11, 02 F8
      'Relaxed timing makes every timer 1.5x longer.',
    ],
  },
];

export const wordCount = (s: RulesSection) => s.body.join(' ').split(/\s+/).filter(Boolean).length;
