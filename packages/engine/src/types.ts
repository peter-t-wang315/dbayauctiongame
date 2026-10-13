// Engine contract consumed by room-core (WS3a) and implemented by WS1.
// Changing these types is a contract change (docs/06-workstreams.md).
import type {
  CardId,
  ErrorCode,
  EventKind,
  GameLength,
  PlayerId,
  PlayerView,
} from '@dbay/protocol';

export type Mode = 'classic' | 'frenzy';
/** Bot skill (docs/06 WS1). room-core uses 'careful' unless the room says otherwise. */
export type BotLevel = 'random' | 'greedy' | 'careful';
export type Stage = 'bidding' | 'gifts' | 'done';
export type RngStream = 'deck' | 'calls' | 'closes' | 'misc';

export interface BidCard {
  id: CardId;
  kind: 'value' | 'proxy';
  /** Absent for a Proxy. */
  value?: number;
}

export interface StackEntry {
  by: PlayerId;
  card: BidCard;
}

export interface EngineBay {
  idx: number;
  /** ItemId or special id; null = empty (deck ran out). */
  card: string | null;
  /** Oldest first (01 R15). */
  stack: StackEntry[];
  firstBidCall?: number;
  lastBidCall?: number;
  /** Frenzy only (02 F2). */
  openedAt?: number;
  closesAt?: number;
  idleExpiries?: number;
}

export interface EnginePlayer {
  id: PlayerId;
  /** Seat index: also the color index into PLAYER_COLORS. */
  seat: number;
  isBot: boolean;
  connected: boolean;
  /** Cards in hand, i.e. not on a bay and not spent. */
  hand: BidCard[];
  /** Won scorable cards: ItemIds and Display Case ids. */
  won: string[];
  /** Won Gift card ids not yet resolved. */
  gifts: string[];
  /** Frenzy cooldown end (02 F5). */
  cooldownUntil?: number;
}

/** One game-log entry; room-core numbers them and keeps the last 30 for the view. */
export interface GameEvent {
  kind: EventKind;
  by?: PlayerId;
  card?: string;
  bay?: number;
  amount?: number | 'proxy';
  extra?: string;
}

export interface Call {
  player: PlayerId;
  phase: 'window' | 'gap';
  /** Absent during gaps and skips. */
  endsAt?: number;
}

export interface GiftStep {
  stage: 'pickTarget' | 'pickItem';
  holder: PlayerId;
  giftCard: string;
  victim?: PlayerId;
  endsAt: number;
}

export interface EngineState {
  seed: string;
  mode: Mode;
  bidWindowMs: number;
  relaxed: boolean;
  /** Game length preset; absent in states from older snapshots means 'standard'. */
  length?: GameLength;
  stage: Stage;
  players: EnginePlayer[];
  bays: EngineBay[];
  /** Remaining deck; index 0 is the top. SECRET. */
  deck: string[];
  /** Per-stream RNG state (01 R6). SECRET. */
  rng: Record<RngStream, number>;
  /** Classic call bookkeeping (01 R7-R8). */
  colorBag: PlayerId[];
  call: Call | null;
  callsDone: number;
  callsTotal: number;
  /** Classic: number of the last call (1-based) that placed an accepted bid; absent = none yet (01 R18b). */
  lastBidCallNo?: number;
  round: { n: number; of: number; halfway: boolean; last: boolean };
  /** Game-wide sale sequence (01 R28). */
  saleSeq: number;
  /** Gift card id -> saleSeq when sold, for resolution order. */
  giftSales: Record<string, number>;
  gift: GiftStep | null;
  giftLog: Array<{ holder: PlayerId; victim: PlayerId; card: string | null }>;
  /** Frenzy bookkeeping (02 F7). */
  startedAt: number;
  resolved: number;
  deckSize: number;
}

export type EngineAction =
  | { type: 'bid'; player: PlayerId; card: CardId; bay: number }
  | { type: 'pass'; player: PlayerId }
  | { type: 'gift'; player: PlayerId; target: PlayerId }
  | { type: 'giftGive'; player: PlayerId; item: string }
  | { type: 'setConnected'; player: PlayerId; connected: boolean };

export type ApplyResult =
  { ok: true; state: EngineState; events: GameEvent[] } | { ok: false; code: ErrorCode };

export interface GameSetup {
  seed: string;
  mode: Mode;
  bidWindowMs: number;
  relaxed: boolean;
  /** Game length preset (lobby option). Default 'standard'. */
  length?: GameLength;
  /** In seat order. 3-6 players. */
  players: Array<{ id: PlayerId; isBot: boolean; connected: boolean }>;
}

/** Final results; same shape as PlayerView.reveal. */
export type ScoreResult = NonNullable<PlayerView['reveal']>;

export interface Engine {
  /** Build the deck, deal hands, fill bays, schedule the first call (or Frenzy timers). */
  setup(setup: GameSetup, now: number): { state: EngineState; events: GameEvent[] };
  /** Apply one player action at server time `now`. Illegal actions leave state unchanged. */
  apply(state: EngineState, action: EngineAction, now: number): ApplyResult;
  /** Fire every engine deadline <= now (window expiry, gaps, bay timers, gift timeouts). */
  tick(state: EngineState, now: number): { state: EngineState; events: GameEvent[] };
  /** Earliest pending engine deadline, or null. room-core merges it into its alarm. */
  nextDeadline(state: EngineState): number | null;
  /** Valid only when stage === 'done'. */
  score(state: EngineState): ScoreResult;
  /** A bot seat's next action from public information only, or null to wait. `level` defaults to 'careful'. */
  botAction(
    state: EngineState,
    player: PlayerId,
    now: number,
    level?: BotLevel,
  ): EngineAction | null;
  /** R37: how long the `reveal` phase lasts before `ended`, from the final state. */
  revealDelayMs(state: EngineState): number;
}
