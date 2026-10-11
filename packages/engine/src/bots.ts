// Bot policies (05 section 8): random, greedy, careful. They read PUBLIC information only:
// bay contents, estimates, other players' collections, own hand. Never the deck, other hands
// or actual values. Pseudo-randomness comes from a hash of public state, so botAction is pure.
import type { PlayerId } from '@dbay/protocol';
import { legalBids, topOf } from './game';
import type { PackIndex } from './pack';
import { hashString } from './rng';
import type { BidCard, EngineAction, EnginePlayer, EngineState } from './types';

export type BotLevel = 'random' | 'greedy' | 'careful';

/** What a Proxy is "worth spending" in face-value terms when comparing against an item. */
const PROXY_COST = 150;

function pseudo(state: EngineState, player: PlayerId, now: number, salt: string): number {
  return hashString(`${player}|${state.callsDone}|${state.saleSeq}|${now}|${salt}`) / 4294967296;
}

/** The bot's own estimate of an auction card, from public data and its collection progress. */
function worth(idx: PackIndex, me: EnginePlayer, cardId: string): number {
  const info = idx.cards.get(cardId);
  if (!info) return 0;
  const owned = (cat: string | undefined) =>
    me.won.filter((w) => idx.cards.get(w)?.category === cat).length;
  if (info.kind === 'gift') return 40;
  if (info.kind === 'displayCase') {
    const best = Math.max(0, ...idx.categories.map((c) => owned(c)));
    return 100 + (best >= 2 ? 80 : best === 1 ? 20 : 0);
  }
  const n = owned(info.category);
  return info.est * (n >= 2 ? 1.9 : n === 1 ? 1.25 : 1);
}

const costOf = (c: BidCard): number => (c.kind === 'proxy' ? PROXY_COST : (c.value ?? 0));

interface Pick {
  card: BidCard;
  bay: number;
  margin: number;
}

function bestBid(
  level: BotLevel,
  idx: PackIndex,
  state: EngineState,
  me: EnginePlayer,
): Pick | null {
  const k = level === 'careful' ? 0.9 : 1.0;
  const onBays = state.bays.reduce((s, b) => s + b.stack.filter((e) => e.by === me.id).length, 0);
  if (level === 'careful' && onBays >= 3) return null;
  const perBay = new Map<number, Pick>();
  for (const { card, bay } of legalBids(state, me)) {
    const b = state.bays[bay];
    if (!b || b.card === null) continue;
    const ceiling = worth(idx, me, b.card) * k;
    const cost = costOf(card);
    if (card.kind === 'proxy' && ceiling < PROXY_COST) continue;
    if (cost > ceiling) continue;
    const margin = ceiling - cost;
    const cur = perBay.get(bay);
    // Prefer the cheapest card that works on each bay; Proxies only when no face card does.
    if (
      !cur ||
      (cur.card.kind === 'proxy' && card.kind === 'value') ||
      (cur.card.kind === card.kind && cost < costOf(cur.card))
    )
      perBay.set(bay, { card, bay, margin });
  }
  let best: Pick | null = null;
  for (const p of perBay.values()) if (!best || p.margin > best.margin) best = p;
  return best;
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
  const pass: EngineAction | null = mustAct ? { type: 'pass', player: me.id } : null;
  const open = (b: number) => {
    const bay = state.bays[b];
    return bay && bay.closesAt !== undefined ? bay.closesAt > now : true;
  };
  if (level === 'random') {
    const legal = legalBids(state, me).filter((x) => open(x.bay));
    if (legal.length === 0) return pass;
    if (pseudo(state, me.id, now, 'act') < (mustAct ? 0.25 : 0.6)) return pass;
    const pick = legal[Math.floor(pseudo(state, me.id, now, 'pick') * legal.length)];
    return pick ? { type: 'bid', player: me.id, card: pick.card.id, bay: pick.bay } : pass;
  }
  const pick = bestBid(level, idx, state, me);
  if (!pick || !open(pick.bay)) return pass;
  // Top-bid awareness: do not bid on a bay I already lead (illegal anyway).
  const top = topOf(state.bays[pick.bay]?.stack ?? []);
  if (top?.by === me.id) return pass;
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
