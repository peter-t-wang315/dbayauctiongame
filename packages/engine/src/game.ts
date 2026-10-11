// Core game mechanics shared by Classic and Frenzy: bidding legality (R15-R16), sale (R19-R20),
// refill (R21), Gift resolution (R28-R31), and mode flows (R7-R14, R17-R18, R22-R24, F1-F8).
// Every function here mutates the (already cloned) state it is given; engine.ts owns cloning.
import type { CardId, ErrorCode, PlayerId } from '@dbay/protocol';
import { CONFIG, presetOf, type PlayerCount } from './config';
import type { PackIndex } from './pack';
import { nextFloat, shuffle } from './rng';
import type {
  BidCard,
  EngineAction,
  EngineBay,
  EnginePlayer,
  EngineState,
  GameEvent,
  StackEntry,
} from './types';

export interface Ctx {
  idx: PackIndex;
  events: GameEvent[];
}

export const emit = (ctx: Ctx, e: GameEvent): void => {
  ctx.events.push(e);
};

export const scaleOf = (s: EngineState): number => (s.relaxed ? CONFIG.relaxedMultiplier : 1);
export const getPlayer = (s: EngineState, id: PlayerId): EnginePlayer | undefined =>
  s.players.find((p) => p.id === id);

// ---------------------------------------------------------------- bidding (R15-R16)

/** R15: any Proxy on the stack -> the most recently played Proxy; else the highest face value. */
export function topOf(stack: readonly StackEntry[]): StackEntry | null {
  let proxy: StackEntry | null = null;
  for (const e of stack) if (e.card.kind === 'proxy') proxy = e;
  if (proxy) return proxy;
  let best: StackEntry | null = null;
  for (const e of stack) if (!best || (e.card.value ?? 0) > (best.card.value ?? 0)) best = e;
  return best;
}

/** R16 rules 2-4 for a concrete card (rule 1, card in hand, is checked by the caller). */
export function isLegalOn(bay: EngineBay, player: PlayerId, card: BidCard): boolean {
  if (bay.card === null) return false;
  const top = topOf(bay.stack);
  if (!top) return true;
  if (top.by === player) return false;
  if (card.kind === 'proxy') return true;
  if (top.card.kind === 'proxy') return false;
  return (card.value ?? 0) > (top.card.value ?? 0);
}

/** R16: ILLEGAL_BID unless the card is in hand and legal on the bay. */
export function bidError(state: EngineState, p: EnginePlayer, cardId: CardId, bayIdx: number) {
  const bay = state.bays[bayIdx];
  if (!bay || bay.card === null) return 'ILLEGAL_BID' as const;
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) return 'ILLEGAL_BID' as const;
  return isLegalOn(bay, p.id, card) ? null : ('ILLEGAL_BID' as const);
}

export function hasLegalBid(state: EngineState, p: EnginePlayer): boolean {
  return state.bays.some((bay) => p.hand.some((c) => isLegalOn(bay, p.id, c)));
}

export function legalBids(
  state: EngineState,
  p: EnginePlayer,
): Array<{ card: BidCard; bay: number }> {
  const out: Array<{ card: BidCard; bay: number }> = [];
  for (const bay of state.bays)
    for (const c of p.hand) if (isLegalOn(bay, p.id, c)) out.push({ card: c, bay: bay.idx });
  return out;
}

function sortHand(p: EnginePlayer): void {
  p.hand.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'value' ? -1 : 1;
    if (a.kind === 'value') return (a.value ?? 0) - (b.value ?? 0);
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Move a validated bid card onto a bay. Mode-specific timers are the caller's job. */
function placeCard(ctx: Ctx, p: EnginePlayer, cardId: CardId, bay: EngineBay) {
  const at = p.hand.findIndex((c) => c.id === cardId);
  const card = p.hand.splice(at, 1)[0] as BidCard;
  const before = topOf(bay.stack);
  bay.stack.push({ by: p.id, card });
  emit(ctx, {
    kind: 'bid',
    by: p.id,
    bay: bay.idx,
    card: bay.card ?? undefined,
    amount: card.kind === 'proxy' ? 'proxy' : (card.value as number),
  });
  if (before && before.by !== p.id) emit(ctx, { kind: 'outbid', by: before.by, bay: bay.idx });
}

// ---------------------------------------------------------------- sale and refill (R19-R21)

/** R19-R20: sell a non-empty bay to its top bidder. The bay's auction card is cleared. */
function sell(state: EngineState, ctx: Ctx, bay: EngineBay): void {
  const top = topOf(bay.stack) as StackEntry;
  const winner = getPlayer(state, top.by) as EnginePlayer;
  for (const e of bay.stack) {
    if (e === top) continue;
    const owner = getPlayer(state, e.by) as EnginePlayer;
    owner.hand.push(e.card);
    sortHand(owner);
  }
  const id = bay.card as string;
  const info = ctx.idx.cards.get(id);
  state.saleSeq += 1;
  if (info?.kind === 'gift') {
    winner.gifts.push(id);
    state.giftSales[id] = state.saleSeq;
  } else {
    winner.won.push(id);
  }
  emit(ctx, {
    kind: 'sold',
    by: winner.id,
    bay: bay.idx,
    card: id,
    amount: top.card.kind === 'proxy' ? 'proxy' : (top.card.value as number),
  });
  if (info?.kind === 'gift' || info?.kind === 'displayCase') {
    emit(ctx, { kind: 'special', by: winner.id, card: id, bay: bay.idx, extra: info.kind });
  }
  if (info?.kind === 'item' && info.category) {
    const n = winner.won.filter((w) => ctx.idx.cards.get(w)?.category === info.category).length;
    if (n === CONFIG.collectionMin)
      emit(ctx, { kind: 'collection', by: winner.id, extra: info.category });
  }
  bay.stack = [];
  bay.card = null;
  delete bay.firstBidCall;
  delete bay.lastBidCall;
  delete bay.openedAt;
  delete bay.closesAt;
  delete bay.idleExpiries;
}

function discardUnsold(ctx: Ctx, bay: EngineBay): void {
  emit(ctx, { kind: 'unsold', card: bay.card ?? undefined, bay: bay.idx });
  bay.card = null;
  delete bay.firstBidCall;
  delete bay.lastBidCall;
  delete bay.openedAt;
  delete bay.closesAt;
  delete bay.idleExpiries;
}

/** R21: draw the next deck card into an empty bay; deck empty -> stays null. */
function refill(state: EngineState, ctx: Ctx, bay: EngineBay, t: number): void {
  const next = state.deck.shift();
  if (next === undefined) return;
  bay.card = next;
  emit(ctx, { kind: 'refill', card: next, bay: bay.idx });
  if (state.mode === 'frenzy') openBay(state, bay, t);
}

const allEmpty = (s: EngineState): boolean => s.bays.every((b) => b.card === null);

// ---------------------------------------------------------------- Classic (R7-R14, R17-R18, R22-R24)

function startCall(state: EngineState, ctx: Ctx, t: number): void {
  if (state.callsDone >= state.callsTotal) {
    sweep(state, ctx, t);
    return;
  }
  const n = state.players.length;
  // R8: shuffled bag; swap if the new bag's first color equals the last one called.
  if (state.colorBag.length === 0) {
    const bag = shuffle(
      state.rng,
      'calls',
      state.players.map((p) => p.id),
    );
    if (state.call && bag.length > 1 && bag[0] === state.call.player) {
      [bag[0], bag[1]] = [bag[1] as string, bag[0] as string];
    }
    state.colorBag = bag;
  }
  const id = state.colorBag.shift() as PlayerId;
  const player = getPlayer(state, id) as EnginePlayer;
  // R7 / R9: round bookkeeping; announcements at the start of a round.
  const roundN = Math.floor(state.callsDone / n) + 1;
  const of = state.round.of;
  if (state.callsDone % n === 0) {
    if (roundN === Math.floor(of / 2) + 1) emit(ctx, { kind: 'halfway' });
    if (roundN === of) emit(ctx, { kind: 'lastRound' });
  }
  state.round = { n: roundN, of, halfway: roundN >= Math.floor(of / 2) + 1, last: roundN === of };
  emit(ctx, { kind: 'turn', by: id });
  // R13 / R24: auto-skip a disconnected or stuck player.
  if (!player.connected || !hasLegalBid(state, player)) {
    emit(ctx, { kind: 'autoPass', by: id });
    state.call = { player: id, phase: 'gap' };
    finishCall(state, ctx, t, CONFIG.skipGapMs);
    return;
  }
  // R11: the server owns the deadline.
  state.call = {
    player: id,
    phase: 'window',
    endsAt: t + Math.round(state.bidWindowMs * scaleOf(state)),
  };
}

/** R10 steps 3-5 plus the gap: close roll, refill, advance. `gapMs` is the pause before the next call. */
function finishCall(state: EngineState, ctx: Ctx, t: number, gapMs: number): void {
  const callNo = state.callsDone + 1;
  const n = state.players.length as PlayerCount;
  closeRoll(state, ctx, callNo, n);
  state.callsDone = callNo;
  // R23: nothing left to sell.
  if (state.deck.length === 0 && allEmpty(state)) {
    state.round = { ...state.round, n: state.round.of };
    endBidding(state, ctx, t);
    return;
  }
  if (state.callsDone >= state.callsTotal) {
    sweep(state, ctx, t);
    return;
  }
  const call = state.call as NonNullable<EngineState['call']>;
  state.call = { player: call.player, phase: 'gap', endsAt: t + gapMs };
}

/** R17-R18: roll each eligible bay in index order; refill sold bays afterwards. */
function closeRoll(state: EngineState, ctx: Ctx, callNo: number, players: number): void {
  const total = state.callsTotal;
  const pre = presetOf(state.length);
  const p = pre.pBase + ((pre.pMax - pre.pBase) * callNo) / total;
  const sold: EngineBay[] = [];
  for (const bay of state.bays) {
    if (bay.card === null || bay.stack.length === 0) continue; // R18
    if ((bay.lastBidCall ?? 0) >= callNo) continue; // not on the call that placed the latest bid
    const forced = callNo - (bay.firstBidCall ?? callNo) >= pre.maxBayAgeCycles * players;
    if (forced || nextFloat(state.rng, 'closes') < p) {
      sell(state, ctx, bay);
      sold.push(bay);
    }
  }
  for (const bay of sold) refill(state, ctx, bay, 0);
}

/** R22: after the last call, sell every bay with bids, discard the rest, then go to gifts. */
function sweep(state: EngineState, ctx: Ctx, t: number): void {
  for (const bay of state.bays) {
    if (bay.card === null) continue;
    if (bay.stack.length > 0) sell(state, ctx, bay);
    else discardUnsold(ctx, bay);
  }
  state.round = { ...state.round, n: state.round.of };
  endBidding(state, ctx, t);
}

function endBidding(state: EngineState, ctx: Ctx, t: number): void {
  state.call = null;
  emit(ctx, { kind: 'gameOver' });
  state.stage = 'gifts';
  nextGift(state, ctx, t);
}

// ---------------------------------------------------------------- Gifts (R28-R31)

const scorableOf = (ctx: Ctx, p: EnginePlayer): string[] =>
  p.won.filter((id) => ctx.idx.cards.get(id)?.kind !== 'gift');

function consumeGift(state: EngineState): void {
  const g = state.gift as NonNullable<EngineState['gift']>;
  const holder = getPlayer(state, g.holder) as EnginePlayer;
  holder.gifts = holder.gifts.filter((id) => id !== g.giftCard);
  delete state.giftSales[g.giftCard];
  state.gift = null;
}

/** R28: start the oldest-sold unresolved Gift, or finish the game. */
function nextGift(state: EngineState, ctx: Ctx, t: number): void {
  for (;;) {
    let best: { holder: EnginePlayer; card: string } | null = null;
    for (const p of state.players)
      for (const card of p.gifts) {
        const seq = state.giftSales[card] ?? Infinity;
        if (!best || seq < (state.giftSales[best.card] ?? Infinity)) best = { holder: p, card };
      }
    if (!best) {
      state.stage = 'done';
      state.gift = null;
      return;
    }
    const targets = state.players.filter(
      (p) => p.id !== best.holder.id && scorableOf(ctx, p).length > 0,
    );
    state.gift = {
      stage: 'pickTarget',
      holder: best.holder.id,
      giftCard: best.card,
      endsAt: t + Math.round(CONFIG.giftChoiceMs * scaleOf(state)),
    };
    if (targets.length === 0) {
      // R29: nobody to take from, the Gift fizzles.
      state.giftLog.push({ holder: best.holder.id, victim: best.holder.id, card: null });
      emit(ctx, { kind: 'special', by: best.holder.id, card: best.card, extra: 'fizzle' });
      consumeGift(state);
      continue;
    }
    settleDisconnected(state, ctx, t);
    return;
  }
}

function chooseTarget(state: EngineState, ctx: Ctx, target: PlayerId, t: number): void {
  const g = state.gift as NonNullable<EngineState['gift']>;
  state.gift = {
    ...g,
    stage: 'pickItem',
    victim: target,
    endsAt: t + Math.round(CONFIG.giftChoiceMs * scaleOf(state)),
  };
  settleDisconnected(state, ctx, t);
}

function giveItem(state: EngineState, ctx: Ctx, item: string, t: number): void {
  const g = state.gift as NonNullable<EngineState['gift']>;
  const victim = getPlayer(state, g.victim as PlayerId) as EnginePlayer;
  const holder = getPlayer(state, g.holder) as EnginePlayer;
  victim.won = victim.won.filter((id) => id !== item);
  holder.won.push(item);
  state.giftLog.push({ holder: holder.id, victim: victim.id, card: item });
  emit(ctx, { kind: 'special', by: holder.id, card: item, extra: `gift:${victim.id}` });
  consumeGift(state);
  nextGift(state, ctx, t);
}

/** R29/R30 timeout defaults (also used instantly for disconnected players). */
function autoStep(state: EngineState, ctx: Ctx, t: number): void {
  const g = state.gift as NonNullable<EngineState['gift']>;
  if (g.stage === 'pickTarget') {
    const targets = state.players.filter((p) => p.id !== g.holder && scorableOf(ctx, p).length > 0);
    const pick = targets[Math.floor(nextFloat(state.rng, 'misc') * targets.length)] as EnginePlayer;
    chooseTarget(state, ctx, pick.id, t);
  } else {
    const victim = getPlayer(state, g.victim as PlayerId) as EnginePlayer;
    const cards = scorableOf(ctx, victim)
      .map((id) => ({ id, est: ctx.idx.cards.get(id)?.est ?? 0 }))
      .sort((a, b) => a.est - b.est || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    giveItem(state, ctx, (cards[0] as { id: string }).id, t);
  }
}

function settleDisconnected(state: EngineState, ctx: Ctx, t: number): void {
  const g = state.gift;
  if (!g) return;
  const awaited = getPlayer(state, g.stage === 'pickTarget' ? g.holder : (g.victim as PlayerId));
  if (awaited && !awaited.connected) autoStep(state, ctx, t);
}

// ---------------------------------------------------------------- Frenzy (F1-F8)

function openBay(state: EngineState, bay: EngineBay, t: number): void {
  const u =
    presetOf(state.length).frenzyOpenMinMs +
    nextFloat(state.rng, 'closes') *
      (presetOf(state.length).frenzyOpenMaxMs - presetOf(state.length).frenzyOpenMinMs);
  bay.openedAt = t;
  bay.closesAt = t + Math.round(u * scaleOf(state));
  bay.idleExpiries = 0;
}

/** F7: last round starts; no more refills, bays close at most frenzyLastRoundMaxMs from now. */
function triggerLastRound(state: EngineState, ctx: Ctx, t: number, stopDeck: boolean): void {
  if (state.round.last) return;
  if (stopDeck) state.deck = [];
  state.round = { ...state.round, last: true };
  emit(ctx, { kind: 'lastRound' });
  const cap = t + Math.round(CONFIG.frenzyLastRoundMaxMs * scaleOf(state));
  for (const bay of state.bays)
    if (bay.card !== null && bay.closesAt !== undefined) bay.closesAt = Math.min(bay.closesAt, cap);
}

function updateFrenzyRound(state: EngineState, ctx: Ctx): void {
  const D = state.deckSize;
  const R = state.round.of;
  if (!state.round.halfway && state.resolved >= Math.ceil(D / 2)) {
    emit(ctx, { kind: 'halfway' });
    state.round = { ...state.round, halfway: true };
  }
  const n = Math.min(R, Math.floor((state.resolved / D) * R) + 1);
  state.round = { ...state.round, n: state.round.last ? R : n };
}

/** Frenzy setup: open every bay and check the "deck already empty" last-round condition. */
export function startFrenzy(state: EngineState, ctx: Ctx, t: number): void {
  emit(ctx, { kind: 'frenzyStart' });
  for (const bay of state.bays) if (bay.card !== null) openBay(state, bay, t);
  if (state.deck.length === 0) triggerLastRound(state, ctx, t, false);
}

function frenzyExpire(state: EngineState, ctx: Ctx, bay: EngineBay, t: number): void {
  if (bay.stack.length > 0) {
    sell(state, ctx, bay);
  } else if (!state.round.last && (bay.idleExpiries ?? 0) < CONFIG.frenzyMaxIdleExpiries) {
    bay.idleExpiries = (bay.idleExpiries ?? 0) + 1;
    bay.closesAt = t + Math.round(presetOf(state.length).frenzyIdleRecheckMs * scaleOf(state));
    return;
  } else {
    discardUnsold(ctx, bay);
  }
  state.resolved += 1;
  if (!state.round.last) {
    refill(state, ctx, bay, t);
    if (state.deck.length === 0) triggerLastRound(state, ctx, t, false);
  }
  updateFrenzyRound(state, ctx);
}

function frenzyTick(state: EngineState, ctx: Ctx, now: number): void {
  const capTime = state.startedAt + presetOf(state.length).frenzyMaxMs;
  while (state.stage === 'bidding') {
    let due: EngineBay | null = null;
    for (const bay of state.bays)
      if (bay.card !== null && (bay.closesAt as number) <= now)
        if (!due || (bay.closesAt as number) < (due.closesAt as number)) due = bay;
    const capDue = !state.round.last && capTime <= now;
    if (capDue && (!due || capTime <= (due.closesAt as number))) {
      triggerLastRound(state, ctx, capTime, true);
      continue;
    }
    if (!due) break;
    const at = due.closesAt as number;
    frenzyExpire(state, ctx, due, at);
    if (allEmpty(state)) endBidding(state, ctx, at);
  }
}

// ---------------------------------------------------------------- public entry points

/** Fire every deadline <= now. */
export function runTick(state: EngineState, ctx: Ctx, now: number): void {
  if (state.stage === 'bidding') {
    if (state.mode === 'frenzy') {
      frenzyTick(state, ctx, now);
    } else {
      while (
        state.stage === 'bidding' &&
        state.call?.endsAt !== undefined &&
        state.call.endsAt <= now
      ) {
        const t = state.call.endsAt;
        if (state.call.phase === 'window') {
          emit(ctx, { kind: 'pass', by: state.call.player });
          finishCall(state, ctx, t, CONFIG.callGapMs);
        } else {
          startCall(state, ctx, t);
        }
      }
    }
  }
  while (state.stage === 'gifts' && state.gift && state.gift.endsAt <= now) {
    autoStep(state, ctx, state.gift.endsAt);
  }
}

export function startGame(state: EngineState, ctx: Ctx, now: number): void {
  emit(ctx, { kind: 'gameStart' });
  if (state.mode === 'frenzy') {
    state.round = { ...state.round, n: 1 };
    startFrenzy(state, ctx, now);
    if (allEmpty(state)) endBidding(state, ctx, now);
  } else {
    startCall(state, ctx, now);
  }
}

export function nextDeadlineOf(state: EngineState): number | null {
  if (state.stage === 'gifts') return state.gift?.endsAt ?? null;
  if (state.stage !== 'bidding') return null;
  if (state.mode === 'classic') return state.call?.endsAt ?? null;
  let min: number | null = state.round.last
    ? null
    : state.startedAt + presetOf(state.length).frenzyMaxMs;
  for (const bay of state.bays)
    if (bay.card !== null && bay.closesAt !== undefined && (min === null || bay.closesAt < min))
      min = bay.closesAt;
  return min;
}

/** Returns an error code (state untouched on error) or null after mutating `state`. */
export function runAction(
  state: EngineState,
  ctx: Ctx,
  action: EngineAction,
  now: number,
): ErrorCode | null {
  const p = getPlayer(state, action.player);
  if (!p) return 'NOT_YOUR_TURN';
  switch (action.type) {
    case 'setConnected': {
      p.connected = action.connected;
      if (!action.connected && state.stage === 'gifts') settleDisconnected(state, ctx, now);
      return null;
    }
    case 'pass': {
      if (state.stage !== 'bidding' || state.mode !== 'classic' || !state.call)
        return 'WRONG_PHASE';
      if (state.call.player !== p.id || state.call.phase !== 'window') return 'NOT_YOUR_TURN';
      if (now >= (state.call.endsAt as number)) return 'TOO_LATE';
      emit(ctx, { kind: 'pass', by: p.id });
      finishCall(state, ctx, now, CONFIG.callGapMs);
      return null;
    }
    case 'bid': {
      if (state.stage !== 'bidding') return 'WRONG_PHASE';
      if (state.mode === 'classic') {
        if (!state.call) return 'WRONG_PHASE';
        if (state.call.player !== p.id) return 'NOT_YOUR_TURN';
        if (state.call.phase !== 'window' || now >= (state.call.endsAt as number))
          return 'TOO_LATE';
        const err = bidError(state, p, action.card, action.bay);
        if (err) return err;
        const bay = state.bays[action.bay] as EngineBay;
        const callNo = state.callsDone + 1;
        placeCard(ctx, p, action.card, bay);
        bay.lastBidCall = callNo;
        bay.firstBidCall ??= callNo;
        finishCall(state, ctx, now, CONFIG.callGapMs);
        return null;
      }
      // Frenzy (F1, F4, F5)
      const bay = state.bays[action.bay];
      if (!bay || bay.card === null) return 'ILLEGAL_BID';
      if (now >= (bay.closesAt as number)) return 'TOO_LATE';
      if (p.cooldownUntil !== undefined && now < p.cooldownUntil) return 'COOLDOWN';
      const err = bidError(state, p, action.card, action.bay);
      if (err) return err;
      placeCard(ctx, p, action.card, bay);
      p.cooldownUntil = now + CONFIG.bidCooldownMs;
      const sc = scaleOf(state);
      const cap =
        (bay.openedAt as number) + Math.round(presetOf(state.length).frenzyHardCapMs * sc);
      const closes = bay.closesAt as number;
      const next = Math.max(closes, Math.min(now + Math.round(CONFIG.antiSnipeMs * sc), cap));
      if (next > closes) {
        bay.closesAt = next;
        emit(ctx, {
          kind: 'extended',
          bay: bay.idx,
          extra: `+${Math.round((next - closes) / 1000)}s`,
        });
      }
      return null;
    }
    case 'gift': {
      const g = state.gift;
      if (state.stage !== 'gifts' || !g || g.stage !== 'pickTarget') return 'WRONG_PHASE';
      if (g.holder !== p.id) return 'NOT_YOUR_TURN';
      if (now >= g.endsAt) return 'TOO_LATE';
      const target = getPlayer(state, action.target);
      if (!target || target.id === p.id || scorableOf(ctx, target).length === 0)
        return 'ILLEGAL_BID';
      chooseTarget(state, ctx, target.id, now);
      return null;
    }
    case 'giftGive': {
      const g = state.gift;
      if (state.stage !== 'gifts' || !g || g.stage !== 'pickItem') return 'WRONG_PHASE';
      if (g.victim !== p.id) return 'NOT_YOUR_TURN';
      if (now >= g.endsAt) return 'TOO_LATE';
      if (!scorableOf(ctx, p).includes(action.item)) return 'ILLEGAL_BID';
      giveItem(state, ctx, action.item, now);
      return null;
    }
  }
}
