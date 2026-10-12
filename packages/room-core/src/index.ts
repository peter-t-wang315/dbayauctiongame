// room-core: pure reducer + view (the only redaction path). Implemented by WS3a.
export * from './types';
export {
  reduce,
  createRoom,
  roomNotFound,
  isCompatible,
  SCHEMA_VERSION,
  LOBBY_TTL_MS,
  GAME_TTL_MS,
  POSTGAME_TTL_MS,
  ALL_DISCONNECTED_TTL_MS,
  HOST_MIGRATION_MS,
  BOT_DELAY_MIN_MS,
  BOT_DELAY_MAX_MS,
} from './reduce';
export { view } from './view';
export {
  secretsMatch,
  newRateState,
  rateLimit,
  RATE_LIMIT_PER_SEC,
  RATE_LIMIT_STRIKES,
  type RateState,
  type RateVerdict,
} from './util';
