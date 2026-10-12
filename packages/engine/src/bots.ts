// Bot policies (05 section 8): random, greedy, careful. They read PUBLIC information only:
// bay contents, estimates, other players' collections, own hand. Never the deck, other hands
// or actual values. Pseudo-randomness comes from a hash of public state, so botAction is pure.
//
// Design (docs/progress/bots.md): every personality shares one value-aware bidder. A card on a bay
// costs nothing unless it wins (losing cards return to the hand, R19), so the real price of a bid is
// the opportunity cost of the card. The bot ranks the item among all pack estimates (a quantile)
// and only pays a face value near the matching rung of the bid ladder; it keeps a reserve of cards
// so it is not dry for the next good item, uses Proxies only on the best items, and limits how
// many cards it has locked on bays. Personalities differ only in the numbers in PERSONALITY.
import type { PlayerId } from '@dbay/protocol';
import { CONFIG } from './config';
import { legalBids, topOf } from './game';
import type { PackIndex } from './pack';
import { hashString } from './rng';
import type { BidCard, BotLevel, EngineAction, EnginePlayer, EngineState } from './types';

export type { BotLevel };

interface Personality {
  /** Highest face value it will pay, as a multiple of its item valuation (overpay tolerance). */
  maxMult: number;
  /** Item quantile (0-1) from which a Proxy is considered. */
  proxyQ: number;
  /** Value cards kept in hand early / mid game (late game: 0). */
  reserveEarly: number;
  reserveMid: number;
  /** Top face cards held back from ordinary items until late (they stay legal over any rival bid). */
  keepHigh: number;
  /** Ordinary items: do not join a bay that already holds this many cards (stacks lock hands). */
  maxStack: number;
  /** Most of this bot's cards allowed on bays at once. */
  maxOnBays: number;
  /** Relative noise on its item valuation (0 = exact). */
  noise: number;
  /** Always opens with the smallest legal card that is within budget (cheap increments) instead of the target card. */
  minimal: boolean;
  /** Chance of acting at all on a turn it has a worthwhile bid (Classic: of bidding; Frenzy: looking). */
  act: number;
  /** Frenzy: chance of re-bidding on a bay it has already been outbid on. */
  rebid: number;
}

const PERSONALITY: Record<BotLevel, Personality> = {
  careful: {
    maxMult: 1.3,
    proxyQ: 0.8,
    reserveEarly: 1,
    reserveMid: 1,
    keepHigh: 0,
    maxStack: 6,
    maxOnBays: 4,
    noise: 0,
    minimal: false,
    act: 1,
    rebid: 0.95,
  },
  greedy: {
    maxMult: 1.4,
    proxyQ: 0.65,
    reserveEarly: 0,
    reserveMid: 0,
    keepHigh: 0,
    maxStack: 8,
    maxOnBays: 8,
    noise: 0.1,
    minimal: true,
    act: 1,
    rebid: 0.9,
  },
  random: {
    maxMult: 1.15,
    proxyQ: 0.72,
    reserveEarly: 1,
    reserveMid: 1,
    keepHigh: 0,
    maxStack: 4,
    maxOnBays: 5,
    noise: 0.35,
    minimal: false,
    act: 0.8,
    rebid: 0.5,
  },
};

function pseudo(state: EngineState, player: PlayerId, now: number, salt: string): number {
  return hashString(`${player}|${state.callsDone}|${state.saleSeq}|${now}|${salt}`) / 4294967296;
}

// ---------------------------------------------------------------- valuation

const ladder = CONFIG.BID_VALUES;
const estCache = new WeakMap<PackIndex, number[]>();

/** Sorted estimates of every item in the pack (public). */
function sortedEsts(idx: PackIndex): number[] {
  let s = estCache.get(idx);
  if (!s) {
    s = [...idx.cards.values()].filter((c) => c.kind === 'item').map((c) => c.est);
    s.sort((a, b) => a - b);
    estCache.set(idx, s);
  }
  return s;
}

/** Share of pack items whose estimate is at most `w` (0-1). */
function quantile(idx: PackIndex, w: number): number {
  const s = sortedEsts(idx);
  if (s.length === 0) return 0.5;
  let n = 0;
  for (const e of s) if (e <= w) n++;
  return n / s.length;
}

/** The bot's own estimate of an auction card, from public data and its collection progress. */
export function worth(idx: PackIndex, me: EnginePlayer, cardId: string): number {
  const info = idx.cards.get(cardId);
  if (!info) return 0;
  const ownedEst = (cat: string | undefined) => {
    let n = 0;
    let sum = 0;
    for (const w of me.won) {
      const c = idx.cards.get(w);
      if (c && c.kind === 'item' && c.category === cat) {
        n++;
        sum += c.est;
      }
    }
    return { n, sum };
  };
  if (info.kind === 'gift') return 40;
  if (info.kind === 'displayCase') {
    let best = { n: 0, sum: 0 };
    for (const c of idx.categories) {
      const o = ownedEst(c);
      if (o.n > best.n || (o.n === best.n && o.sum > best.sum)) best = o;
    }
    const dc = CONFIG.displayCaseValue;
    return best.n >= 2 ? 2 * dc + best.sum : best.n === 1 ? dc * 1.2 : dc;
  }
  const { n, sum } = ownedEst(info.category);
  // The third item of a category doubles the whole set (R33).
  if (n >= 3) return info.est * CONFIG.collectionMultiplier;
  if (n === 2) return info.est * CONFIG.collectionMultiplier + sum * 0.4;
  return info.est * (n === 1 ? 1.1 : 1);
}

/** Fraction of the game played (0-1). */
function progress(state: EngineState): number {
  if (state.mode === 'classic')
    return state.callsTotal > 0 ? state.callsDone / state.callsTotal : 0;
  return state.deckSize > 0 ? state.resolved / state.deckSize : 0;
}

/** Face-value cards the bot wants to keep in hand after this bid. */
function reserveFor(prm: Personality, state: EngineState): number {
  const g = progress(state);
  return g < 0.4 ? prm.reserveEarly : g < 0.8 ? prm.reserveMid : 0;
}

// ---------------------------------------------------------------- bidding

interface Pick {
  card: BidCard;
  bay: number;
  score: number;
}

/**
 * Best bid for `me`, or null (pure; exported for tests). Never returns an illegal bid.
 * Valuation noise is fixed per (game, player, item), so a personality is consistent across looks.
 */
export function bestBid(
  level: BotLevel,
  idx: PackIndex,
  state: EngineState,
  me: EnginePlayer,
): Pick | null {
  const prm = PERSONALITY[level];
  let onBays = 0;
  for (const b of state.bays) for (const e of b.stack) if (e.by === me.id) onBays++;
  if (onBays >= prm.maxOnBays) return null;

  const valueCards = me.hand.filter((c) => c.kind === 'value').length;
  const proxies = me.hand.filter((c) => c.kind === 'proxy').length;
  const reserve = reserveFor(prm, state);
  const late = progress(state) >= 0.75;
  const heldBack = new Set(
    me.hand
      .filter((c) => c.kind === 'value')
      .sort((a, c) => (c.value ?? 0) - (a.value ?? 0))
      .slice(0, prm.keepHigh)
      .map((c) => c.id),
  );
  const legal = legalBids(state, me);
  const best: { [bay: number]: Pick } = {};

  for (const bay of new Set(legal.map((l) => l.bay))) {
    const b = state.bays[bay];
    if (!b || b.card === null) continue;
    // At most two of my cards per bay (a third rarely helps and locks the hand).
    const mine = b.stack.filter((e) => e.by === me.id).length;
    if (mine >= 2) continue;
    let w = worth(idx, me, b.card);
    if (prm.noise > 0)
      w *=
        1 +
        prm.noise * (2 * (hashString(`${state.seed}|${me.id}|${b.card}|noise`) / 4294967296) - 1);
    const q = quantile(idx, w);
    const isTop = q >= prm.proxyQ;
    if (!isTop && (b.stack.length >= prm.maxStack || mine >= 1)) continue;

    const cards = legal.filter((l) => l.bay === bay).map((l) => l.card);
    const values = cards
      .filter((c) => c.kind === 'value')
      .sort((a, c) => (a.value ?? 0) - (c.value ?? 0));
    // Face cards: smallest that reaches the target rung, else the largest below it.
    const maxVal = w * prm.maxMult * (state.mode === 'frenzy' && !prm.minimal ? 1.05 : 1);
    const wantVal = w * 0.9;
    const held = isTop || late ? new Set<string>() : heldBack;
    const okVals = values.filter((c) => (c.value ?? 0) <= maxVal && !held.has(c.id));
    let pick: BidCard | undefined = prm.minimal
      ? okVals[0]
      : okVals.find((c) => (c.value ?? 0) >= wantVal);
    if (!pick && okVals.length > 0) pick = okVals[okVals.length - 1];
    // Reserve: do not drain the value cards below the reserve for an ordinary item.
    if (pick && valueCards - 1 < reserve && !isTop) pick = undefined;
    // A bay already holding a bid has proven interest; a much lower target card is not worth a fight.
    if (pick && (pick.value ?? 0) < wantVal * 0.5 && wantVal >= 60) pick = undefined;

    let chosen: BidCard | undefined = pick;
    if (!chosen && isTop && proxies > 0) {
      const px = cards.find((c) => c.kind === 'proxy');
      // Keep the last Proxy for the very best items.
      if (px && (proxies > 1 || q >= Math.min(0.95, prm.proxyQ + 0.12))) chosen = px;
    }
    if (!chosen) continue;
    const cost =
      chosen.kind === 'proxy' ? (ladder[ladder.length - 2] as number) : (chosen.value ?? 0);
    best[bay] = { card: chosen, bay, score: w - 0.4 * cost + (isTop ? 50 : 0) };
  }
  let out: Pick | null = null;
  for (const p of Object.values(best)) if (!out || p.score > out.score) out = p;
  return out;
}

export function botActionFor(
  level: BotLevel,
  idx: PackIndex,
  state: EngineState,
  playerId: PlayerId,
  now: number,
): EngineAction | null {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return null;

  if (state.stage === 'gifts') return giftAction(level, idx, state, me);
  if (state.stage !== 'bidding') return null;

  if (state.mode === 'classic') {
    const call = state.call;
    if (!call || call.player !== me.id || call.phase !== 'window') return null;
    if (call.endsAt !== undefined && now >= call.endsAt) return null;
    return chooseBid(level, idx, state, me, now, true);
  }
  if (me.cooldownUntil !== undefined && now < me.cooldownUntil) return null;
  return chooseBid(level, idx, state, me, now, false);
}

function chooseBid(
  level: BotLevel,
  idx: PackIndex,
  state: EngineState,
  me: EnginePlayer,
  now: number,
  mustAct: boolean,
): EngineAction | null {
  const prm = PERSONALITY[level];
  const pass: EngineAction | null = mustAct ? { type: 'pass', player: me.id } : null;
  const pick = bestBid(level, idx, state, me);
  if (!pick) return pass;
  const bay = state.bays[pick.bay];
  if (!bay || (bay.closesAt !== undefined && bay.closesAt <= now)) return pass;
  const top = topOf(bay.stack);
  if (top?.by === me.id) return pass;
  if (prm.act < 1 && pseudo(state, me.id, now, 'act') >= prm.act) return pass;
  // Frenzy: after being outbid on a bay, re-bid only sometimes (no bidding wars by reflex).
  if (
    !mustAct &&
    bay.stack.some((e) => e.by === me.id) &&
    pseudo(state, me.id, now, 'rebid') >= prm.rebid
  )
    return null;
  return { type: 'bid', player: me.id, card: pick.card.id, bay: pick.bay };
}

function giftAction(
  level: BotLevel,
  idx: PackIndex,
  state: EngineState,
  me: EnginePlayer,
): EngineAction | null {
  const g = state.gift;
  if (!g) return null;
  const scorable = (p: EnginePlayer) => p.won.filter((id) => idx.cards.get(id)?.kind !== 'gift');
  if (g.stage === 'pickTarget' && g.holder === me.id) {
    const targets = state.players.filter((p) => p.id !== me.id && scorable(p).length > 0);
    if (targets.length === 0) return null;
    const value = (p: EnginePlayer) =>
      scorable(p).reduce((s, id) => s + (idx.cards.get(id)?.est ?? 0), 0);
    const sorted = [...targets].sort((a, b) =>
      level === 'random' ? 0 : value(b) - value(a) || a.seat - b.seat,
    );
    return { type: 'gift', player: me.id, target: (sorted[0] as EnginePlayer).id };
  }
  if (g.stage === 'pickItem' && g.victim === me.id) {
    const cards = scorable(me);
    if (cards.length === 0) return null;
    const catCount = (id: string) => {
      const cat = idx.cards.get(id)?.category;
      return cat ? cards.filter((c) => idx.cards.get(c)?.category === cat).length : 0;
    };
    const score = (id: string) =>
      (idx.cards.get(id)?.est ?? 0) +
      (level === 'careful' ? 80 * Math.max(0, catCount(id) - 1) : 0);
    const sorted = [...cards].sort((a, b) => score(a) - score(b) || (a < b ? -1 : 1));
    return { type: 'giftGive', player: me.id, item: sorted[0] as string };
  }
  return null;
}
