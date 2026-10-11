// WS0 stub engine: deals hands and fills bays deterministically so room-core and the mock server
// can be built against real types. It plays no rules. WS1 replaces it with the real engine.
import { activePack } from '@dbay/content';
import { CONFIG, presetOf, type PlayerCount } from './config';
import type { BidCard, Engine, EngineState } from './types';

export function startingHand(): BidCard[] {
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

export const stubEngine: Engine = {
  setup(setup, now) {
    const count = setup.players.length as PlayerCount;
    const cards = [...activePack.items.map((i) => i.id), ...activePack.specials.map((s) => s.id)];
    const bayCount = CONFIG.BAYS_BY_PLAYERS[count];
    const state: EngineState = {
      seed: setup.seed,
      mode: setup.mode,
      bidWindowMs: setup.bidWindowMs,
      relaxed: setup.relaxed,
      length: setup.length ?? 'standard',
      stage: 'bidding',
      players: setup.players.map((p, seat) => ({
        ...p,
        seat,
        hand: startingHand(),
        won: [],
        gifts: [],
      })),
      bays: Array.from({ length: bayCount }, (_, idx) => ({
        idx,
        card: cards[idx % cards.length] ?? null,
        stack: [],
      })),
      deck: [],
      rng: { deck: 0, calls: 0, closes: 0, misc: 0 },
      colorBag: [],
      call: null,
      callsDone: 0,
      callsTotal: presetOf(setup.length).ROUNDS_BY_PLAYERS[count] * count,
      round: {
        n: 1,
        of: presetOf(setup.length).ROUNDS_BY_PLAYERS[count],
        halfway: false,
        last: false,
      },
      saleSeq: 0,
      giftSales: {},
      gift: null,
      giftLog: [],
      startedAt: now,
      resolved: 0,
      deckSize: bayCount,
    };
    return { state, events: [{ kind: 'gameStart' }] };
  },
  apply() {
    return { ok: false, code: 'WRONG_PHASE' };
  },
  tick(state) {
    return { state, events: [] };
  },
  nextDeadline() {
    return null;
  },
  score(state) {
    return {
      players: state.players.map((p) => ({
        id: p.id,
        items: [],
        displayCaseAssign: [],
        collections: [],
        total: 0,
        rank: 1,
      })),
      giftLog: state.giftLog,
    };
  },
  botAction() {
    return null;
  },
  revealDelayMs() {
    return CONFIG.revealBaseMs;
  },
};
