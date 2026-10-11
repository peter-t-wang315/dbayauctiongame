// Game setup: bid cards (R2), bays (R1), deck build (R4), initial fill (R5), RNG streams (R6).
import { DEFAULT_LENGTH, type GameLength } from '@dbay/protocol';
import { CONFIG, presetOf, type PlayerCount } from './config';
import type { PackIndex } from './pack';
import { initRng, shuffle, type RngState } from './rng';
import type { BidCard, EngineState, GameSetup } from './types';

export function newHand(): BidCard[] {
  const values: BidCard[] = CONFIG.BID_VALUES.map((v) => ({
    id: `v${v}`,
    kind: 'value',
    value: v,
  }));
  const proxies: BidCard[] = Array.from({ length: CONFIG.PROXIES_PER_PLAYER }, (_, i) => ({
    id: `p${i + 1}`,
    kind: 'proxy',
  }));
  return [...values, ...proxies];
}

/** R4: category subset, round-robin items, specials, shuffle. Uses the `deck` stream. */
export function buildDeck(
  idx: PackIndex,
  count: PlayerCount,
  rng: RngState,
  length?: GameLength,
): string[] {
  const spec = presetOf(length).DECK_BY_PLAYERS[count];
  const cats = shuffle(rng, 'deck', idx.categories).slice(0, spec.catsInPlay);
  const lists = cats.map((c) => shuffle(rng, 'deck', idx.itemsByCategory.get(c) ?? []));
  const items: string[] = [];
  for (let round = 0; items.length < spec.items; round++) {
    let progressed = false;
    for (const list of lists) {
      const id = list[round];
      if (id !== undefined && items.length < spec.items) {
        items.push(id);
        progressed = true;
      }
    }
    if (!progressed) break; // pack too small (fixture); use what exists
  }
  const dcs = shuffle(rng, 'deck', idx.displayCases).slice(0, spec.displayCase);
  const gifts = shuffle(rng, 'deck', idx.gifts).slice(0, spec.gift);
  return shuffle(rng, 'deck', [...items, ...dcs, ...gifts]);
}

/** Build the initial state: hands dealt, deck built, bays filled from the top. No timers yet. */
export function initState(idx: PackIndex, setup: GameSetup, now: number): EngineState {
  const n = setup.players.length;
  if (n < 3 || n > 6) throw new RangeError(`dBay needs 3-6 players, got ${n}`);
  const count = n as PlayerCount;
  const rng = initRng(setup.seed);
  const deck = buildDeck(idx, count, rng, setup.length);
  const deckSize = deck.length;
  const bayCount =
    setup.mode === 'frenzy'
      ? presetOf(setup.length).FRENZY_BAYS_BY_PLAYERS[count]
      : CONFIG.BAYS_BY_PLAYERS[count];
  const bays = Array.from({ length: bayCount }, (_, i) => ({
    idx: i,
    card: deck.shift() ?? null,
    stack: [],
  }));
  const length = setup.length ?? DEFAULT_LENGTH;
  const rounds = presetOf(length).ROUNDS_BY_PLAYERS[count];
  return {
    seed: setup.seed,
    mode: setup.mode,
    bidWindowMs: setup.bidWindowMs,
    relaxed: setup.relaxed,
    length,
    stage: 'bidding',
    players: setup.players.map((p, seat) => ({
      id: p.id,
      seat,
      isBot: p.isBot,
      connected: p.connected,
      hand: newHand(),
      won: [],
      gifts: [],
    })),
    bays,
    deck,
    rng,
    colorBag: [],
    call: null,
    callsDone: 0,
    callsTotal: setup.mode === 'classic' ? rounds * count : 0,
    round: { n: 1, of: rounds, halfway: false, last: false },
    saleSeq: 0,
    giftSales: {},
    gift: null,
    giftLog: [],
    startedAt: now,
    resolved: 0,
    deckSize,
  };
}
