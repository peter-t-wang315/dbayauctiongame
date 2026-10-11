// WS0 stubs for room-core. WS3a implements `reduce` fully; `view` is the ONLY state -> client path.
import { PLAYER_COLORS, type PlayerView } from '@dbay/protocol';
import type { Effect, ReduceResult, RoomEvent, RoomState } from './types';

export * from './types';

export const SCHEMA_VERSION = 1;

export function createRoom(code: string, now: number): RoomState {
  return {
    meta: {
      code,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      expireAt: now + 60 * 60 * 1000,
      hostId: null,
      phase: 'lobby',
      opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
      banned: [],
    },
    players: [],
    game: null,
    log: [],
    deadlines: [],
    rev: 0,
  };
}

/** Pure reducer: (state, event, now) -> (state, effects). WS0 stub: no-op. */
export function reduce(state: RoomState, _event: RoomEvent, _now: number): ReduceResult {
  const effects: Effect[] = [];
  return { state, effects };
}

/**
 * Build one player's redacted view. WS0 implements the lobby fields only; WS3a completes the
 * in-game fields and the redaction leak test (05 section 10).
 */
export function view(state: RoomState, playerId: string): PlayerView {
  return {
    code: state.meta.code,
    phase: state.meta.phase,
    opts: state.meta.opts,
    me: playerId,
    hostId: state.meta.hostId ?? playerId,
    myHand: [],
    canAct: false,
    players: state.players.map((p) => {
      const color = PLAYER_COLORS[p.seat] ?? PLAYER_COLORS[0];
      return {
        id: p.id,
        name: p.name,
        color: color.id,
        shape: color.shape,
        connected: p.connected,
        isBot: p.isBot,
        cardsInHand: 0,
        collection: [],
        gifts: 0,
      };
    }),
    bays: [],
    round: { n: 0, of: 0, halfway: false, last: false },
    deckLeft: 0,
    log: state.log.slice(-30),
  };
}
