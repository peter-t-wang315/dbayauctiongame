// view(): the ONLY path from room state to any client (05 sections 6.3 and 10).
// Every field is built explicitly from an allow-list; nothing is spread from state.
import { engine, type BidCard, type EngineBay, type EngineState } from '@dbay/engine';
import { DEFAULT_LENGTH, PLAYER_COLORS, type PlayerView } from '@dbay/protocol';
import type { RoomState } from './types';

type Color = (typeof PLAYER_COLORS)[number];
const colorOf = (seat: number): Color => PLAYER_COLORS[seat] ?? PLAYER_COLORS[0];

/** 01 R15: the most recent Proxy, else the highest face value. */
function topBid(bay: EngineBay): PlayerView['bays'][number]['topBid'] {
  let top: EngineBay['stack'][number] | null = null;
  for (const e of bay.stack) if (e.card.kind === 'proxy') top = e;
  if (!top) {
    for (const e of bay.stack) if (!top || (e.card.value ?? 0) > (top.card.value ?? 0)) top = e;
  }
  if (!top) return null;
  return top.card.kind === 'proxy'
    ? { by: top.by, kind: 'proxy' }
    : { by: top.by, kind: 'value', value: top.card.value };
}

function cardView(c: BidCard) {
  return c.kind === 'proxy'
    ? { kind: 'proxy' as const }
    : { kind: 'value' as const, value: c.value };
}

/**
 * Build one player's redacted view. `now` defaults to the time of the last state change
 * (`meta.updatedAt`); WS3b may pass the live clock so cooldowns/windows are judged exactly.
 */
export function view(state: RoomState, playerId: string, now?: number): PlayerView {
  const t = now ?? state.meta.updatedAt ?? 0;
  const { meta } = state;
  const g: EngineState | null = state.game;
  const inGame =
    g !== null && (meta.phase === 'playing' || meta.phase === 'reveal' || meta.phase === 'ended');
  const playing = inGame && meta.phase === 'playing' && g.stage !== 'done';
  const me = g?.players.find((p) => p.id === playerId);

  const myHand: PlayerView['myHand'] = [];
  if (inGame && me) {
    for (const c of me.hand) myHand.push({ id: c.id, ...cardView(c) });
    for (const b of g.bays)
      for (const e of b.stack)
        if (e.by === playerId) myHand.push({ id: e.card.id, ...cardView(e.card), onBay: b.idx });
  }

  let canAct = false;
  let cooldownUntil: number | undefined;
  if (playing && me && g.stage === 'bidding') {
    if (g.mode === 'classic') {
      canAct =
        g.call?.player === playerId &&
        g.call.phase === 'window' &&
        (g.call.endsAt === undefined || t < g.call.endsAt);
    } else {
      const cd = me.cooldownUntil;
      if (cd !== undefined && t < cd) cooldownUntil = cd;
      canAct = me.hand.length > 0 && cooldownUntil === undefined;
    }
  } else if (playing && me && g.stage === 'gifts' && g.gift) {
    const awaited = g.gift.stage === 'pickTarget' ? g.gift.holder : g.gift.victim;
    canAct = awaited === playerId && t < g.gift.endsAt;
  }

  const out: PlayerView = {
    code: meta.code,
    phase: meta.phase,
    opts: {
      mode: meta.opts.mode,
      relaxed: meta.opts.relaxed,
      bidWindowMs: meta.opts.bidWindowMs,
      length: meta.opts.length ?? DEFAULT_LENGTH,
    },
    me: playerId,
    hostId: meta.hostId ?? playerId,
    myHand,
    canAct,
    players: state.players.map((p) => {
      const color = colorOf(p.seat);
      const ep = g?.players.find((x) => x.id === p.id);
      return {
        id: p.id,
        name: p.name,
        color: color.id,
        shape: color.shape,
        connected: p.connected,
        isBot: p.isBot,
        cardsInHand: inGame && ep ? ep.hand.length : 0,
        collection: inGame && ep ? [...ep.won] : [],
        gifts: inGame && ep ? ep.gifts.length : 0,
      };
    }),
    bays: inGame
      ? g.bays.map((b) => ({
          idx: b.idx,
          card: b.card,
          stack: b.stack.map((e) => ({ by: e.by, card: e.card.id, ...cardView(e.card) })),
          topBid: topBid(b),
          ...(g.mode === 'frenzy' && b.card !== null && b.closesAt !== undefined && playing
            ? { endsAt: b.closesAt }
            : {}),
        }))
      : [],
    round: inGame ? { ...g.round } : { n: 0, of: 0, halfway: false, last: false },
    deckLeft: inGame ? g.deck.length : 0,
    log: state.log.slice(-30).map((e) => {
      const entry: PlayerView['log'][number] = { n: e.n, kind: e.kind };
      if (e.by !== undefined) entry.by = e.by;
      if (e.card !== undefined) entry.card = e.card;
      if (e.bay !== undefined) entry.bay = e.bay;
      if (e.amount !== undefined) entry.amount = e.amount;
      if (e.extra !== undefined) entry.extra = e.extra;
      return entry;
    }),
  };
  if (cooldownUntil !== undefined) out.cooldownUntil = cooldownUntil;
  if (playing && (g.stage === 'bidding' || g.stage === 'gifts')) out.stage = g.stage;
  if (playing && g.stage === 'bidding' && g.mode === 'classic' && g.call) {
    out.turn = {
      player: g.call.player,
      color: colorOf(state.players.find((p) => p.id === g.call?.player)?.seat ?? 0).id,
      phase: g.call.phase,
      ...(g.call.endsAt !== undefined ? { endsAt: g.call.endsAt } : {}),
    };
  }
  if (playing && g.stage === 'gifts' && g.gift) {
    out.gift = {
      stage: g.gift.stage,
      holder: g.gift.holder,
      ...(g.gift.victim !== undefined ? { victim: g.gift.victim } : {}),
      endsAt: g.gift.endsAt,
      remaining: g.players.reduce((n, p) => n + p.gifts.length, 0),
    };
  }
  if (inGame && (meta.phase === 'reveal' || meta.phase === 'ended') && g.stage === 'done') {
    out.reveal = engine.score(g);
  }
  return out;
}
