// Wire protocol for dBay. Source of truth: docs/05-tech-stack.md section 6.
// Changing anything here is a contract change (docs/06-workstreams.md, "Contract-change process").
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
/** Max inbound frame size in bytes (05 section 6). */
export const MAX_INBOUND_BYTES = 2048;

// ---------- Shared vocabulary ----------

export const CATEGORY_IDS = ['toys', 'media', 'glass', 'collectibles', 'antiques', 'misc'] as const;
export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export type CategoryId = z.infer<typeof CategoryIdSchema>;

/** Seat colors in seat order (04 section 12). Shapes are mandatory alongside color. */
export const PLAYER_COLORS = [
  { id: 'red', shape: '●' },
  { id: 'blue', shape: '▲' },
  { id: 'yellow', shape: '■' },
  { id: 'green', shape: '◆' },
  { id: 'purple', shape: '★' },
  { id: 'teal', shape: '✚' },
] as const;
export const PlayerColorSchema = z.enum(['red', 'blue', 'yellow', 'green', 'purple', 'teal']);
export type PlayerColor = z.infer<typeof PlayerColorSchema>;

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const BID_WINDOW_OPTIONS = [3000, 5000, 8000] as const;

export const ErrorCodeSchema = z.enum([
  'BAD_MESSAGE',
  'VERSION_MISMATCH',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_EXPIRED',
  'GAME_IN_PROGRESS',
  'BAD_SECRET',
  'BANNED',
  'NAME_INVALID',
  'NOT_HOST',
  'NOT_YOUR_TURN',
  'NOT_ENOUGH_PLAYERS',
  'WRONG_PHASE',
  'ILLEGAL_BID',
  'TOO_LATE',
  'COOLDOWN',
  'BAD_OPTS',
  'RATE_LIMITED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/**
 * Game-log event kinds, one per row of the 04 section 4.5 status-strip table that the server
 * records. Rejections are not logged (05 section 6.5); "last 3 seconds" and "reconnected" are
 * client-side only.
 */
export const EventKindSchema = z.enum([
  'gameStart',
  'frenzyStart',
  'turn',
  'pass',
  'autoPass',
  'bid',
  'outbid',
  'lead',
  'extended',
  'sold',
  'unsold',
  'refill',
  'collection',
  'special',
  'halfway',
  'lastRound',
  'gameOver',
  'left',
  'rejoined',
  'host',
]);
export type EventKind = z.infer<typeof EventKindSchema>;

const Id = z.string().min(1).max(64);
export const PlayerIdSchema = Id;
export type PlayerId = string;
/** A bid card id, unique per player, e.g. `v100` or `p1`. */
export const CardIdSchema = Id;
export type CardId = string;
/** An auction card id: an ItemId or a special id from @dbay/content. */
export const AuctionCardIdSchema = Id;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
/** Display names: 1-16 chars after trimming, no control characters (05 section 5). */
export const NameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(16)
      .refine((s) => !CONTROL_CHARS.test(s), 'no control characters'),
  );

const Seq = z.number().int().min(1);
const Version = z.number().int().min(1);

// ---------- Client -> server (05 section 6.1) ----------

export const ClientMsgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('join'), v: Version, name: NameSchema }),
  z.object({
    t: z.literal('hello'),
    v: Version,
    playerId: PlayerIdSchema,
    secret: z.string().min(1).max(128),
    lastRev: z.number().int().min(0).optional(),
  }),
  z.object({ t: z.literal('ping'), c: z.number() }),
  z.object({ t: z.literal('snap') }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('bid'), seq: Seq, card: CardIdSchema, bay: z.number().int().min(0).max(3) }),
  z.object({ t: z.literal('pass'), seq: Seq }),
  z.object({ t: z.literal('gift'), seq: Seq, target: PlayerIdSchema }),
  z.object({ t: z.literal('giftGive'), seq: Seq, item: AuctionCardIdSchema }),
  z.object({ t: z.literal('rename'), seq: Seq, name: NameSchema }),
  z.object({ t: z.literal('start'), seq: Seq }),
  z.object({
    t: z.literal('setOpts'),
    seq: Seq,
    mode: z.enum(['classic', 'frenzy']).optional(),
    relaxed: z.boolean().optional(),
    bidWindowMs: z.union([z.literal(3000), z.literal(5000), z.literal(8000)]).optional(),
  }),
  z.object({ t: z.literal('addBot'), seq: Seq }),
  z.object({ t: z.literal('rmBot'), seq: Seq, playerId: PlayerIdSchema }),
  z.object({ t: z.literal('kick'), seq: Seq, playerId: PlayerIdSchema }),
  z.object({ t: z.literal('rematch'), seq: Seq }),
]);
export type ClientMsg = z.infer<typeof ClientMsgSchema>;
/** Client messages that carry a `seq` and therefore always receive exactly one `ack`. */
export type ClientAction = Extract<ClientMsg, { seq: number }>;

// ---------- PlayerView (05 section 6.3) ----------

const BidKind = z.enum(['value', 'proxy']);
const ServerTime = z.number();

export const BidOnBaySchema = z.object({
  by: PlayerIdSchema,
  card: CardIdSchema,
  kind: BidKind,
  value: z.number().int().positive().optional(),
});

export const PlayerViewSchema = z.object({
  code: z.string(),
  phase: z.enum(['lobby', 'playing', 'reveal', 'ended']),
  stage: z.enum(['bidding', 'gifts']).optional(),
  opts: z.object({
    mode: z.enum(['classic', 'frenzy']),
    relaxed: z.boolean(),
    bidWindowMs: z.number().int().positive(),
  }),
  me: PlayerIdSchema,
  hostId: PlayerIdSchema,
  myHand: z.array(
    z.object({
      id: CardIdSchema,
      kind: BidKind,
      value: z.number().int().positive().optional(),
      onBay: z.number().int().min(0).optional(),
    }),
  ),
  canAct: z.boolean(),
  cooldownUntil: ServerTime.optional(),
  players: z.array(
    z.object({
      id: PlayerIdSchema,
      name: z.string(),
      color: PlayerColorSchema,
      shape: z.string(),
      connected: z.boolean(),
      isBot: z.boolean(),
      /** Others: count only, never which cards. */
      cardsInHand: z.number().int().min(0),
      collection: z.array(AuctionCardIdSchema),
      gifts: z.number().int().min(0),
    }),
  ),
  bays: z.array(
    z.object({
      idx: z.number().int().min(0),
      card: AuctionCardIdSchema.nullable(),
      stack: z.array(BidOnBaySchema),
      topBid: z
        .object({ by: PlayerIdSchema, kind: BidKind, value: z.number().int().positive().optional() })
        .nullable(),
      endsAt: ServerTime.optional(),
    }),
  ),
  turn: z
    .object({
      player: PlayerIdSchema,
      color: PlayerColorSchema,
      endsAt: ServerTime.optional(),
      phase: z.enum(['window', 'gap']),
    })
    .optional(),
  round: z.object({
    n: z.number().int().min(0),
    of: z.number().int().min(0),
    halfway: z.boolean(),
    last: z.boolean(),
  }),
  deckLeft: z.number().int().min(0),
  log: z
    .array(
      z.object({
        n: z.number().int().min(0),
        kind: EventKindSchema,
        by: PlayerIdSchema.optional(),
        card: AuctionCardIdSchema.optional(),
        bay: z.number().int().min(0).optional(),
        amount: z.union([z.number().int(), z.literal('proxy')]).optional(),
        extra: z.string().max(64).optional(),
      }),
    )
    .max(30),
  gift: z
    .object({
      stage: z.enum(['pickTarget', 'pickItem']),
      holder: PlayerIdSchema,
      victim: PlayerIdSchema.optional(),
      endsAt: ServerTime,
      remaining: z.number().int().min(0),
    })
    .optional(),
  /** Present ONLY in phases `reveal` and `ended`. */
  reveal: z
    .object({
      players: z.array(
        z.object({
          id: PlayerIdSchema,
          items: z.array(
            z.object({
              card: AuctionCardIdSchema,
              est: z.number().int(),
              actual: z.number().int(),
              tag: z.enum(['steal', 'ripped']).nullable(),
            }),
          ),
          displayCaseAssign: z.array(
            z.object({ card: AuctionCardIdSchema, category: CategoryIdSchema.nullable() }),
          ),
          collections: z.array(CategoryIdSchema),
          total: z.number().int(),
          rank: z.number().int().min(1),
          tiebreak: z.number().int().optional(),
        }),
      ),
      giftLog: z.array(
        z.object({ holder: PlayerIdSchema, victim: PlayerIdSchema, card: AuctionCardIdSchema.nullable() }),
      ),
    })
    .optional(),
});
export type PlayerView = z.infer<typeof PlayerViewSchema>;

// ---------- Server -> client (05 section 6.2) ----------

export const ServerMsgSchema = z.union([
  z.object({
    t: z.literal('welcome'),
    v: Version,
    playerId: PlayerIdSchema,
    secret: z.string().optional(),
    code: z.string(),
  }),
  z.object({ t: z.literal('snap'), rev: z.number().int().min(0), now: ServerTime, view: PlayerViewSchema }),
  z.object({ t: z.literal('ack'), seq: Seq, ok: z.literal(true) }),
  z.object({
    t: z.literal('ack'),
    seq: Seq,
    ok: z.literal(false),
    code: ErrorCodeSchema,
    msg: z.string().optional(),
  }),
  z.object({ t: z.literal('pong'), c: z.number(), now: ServerTime }),
  z.object({ t: z.literal('kicked') }),
  z.object({ t: z.literal('closing'), reason: z.enum(['expired', 'ended', 'deploy', 'banned']) }),
  z.object({ t: z.literal('err'), code: ErrorCodeSchema, msg: z.string().optional() }),
]);
export type ServerMsg = z.infer<typeof ServerMsgSchema>;

// ---------- Helpers ----------

export type ParseResult<T> = { ok: true; msg: T } | { ok: false; code: ErrorCode };

/** Parse one inbound text frame: size cap, JSON, schema, protocol version (05 section 12). */
export function parseClientFrame(raw: string): ParseResult<ClientMsg> {
  if (new TextEncoder().encode(raw).byteLength > MAX_INBOUND_BYTES) return { ok: false, code: 'BAD_MESSAGE' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'BAD_MESSAGE' };
  }
  const parsed = ClientMsgSchema.safeParse(json);
  if (!parsed.success) return { ok: false, code: 'BAD_MESSAGE' };
  const msg = parsed.data;
  if ((msg.t === 'join' || msg.t === 'hello') && msg.v !== PROTOCOL_VERSION) {
    return { ok: false, code: 'VERSION_MISMATCH' };
  }
  return { ok: true, msg };
}

/** Parse one server frame on the client. Throws nothing; bad frames return BAD_MESSAGE. */
export function parseServerFrame(raw: string): ParseResult<ServerMsg> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'BAD_MESSAGE' };
  }
  const parsed = ServerMsgSchema.safeParse(json);
  return parsed.success ? { ok: true, msg: parsed.data } : { ok: false, code: 'BAD_MESSAGE' };
}

/** Room-code alphabet: digits 2-9 and letters except I, L, O, U (05 section 5). 30 chars. */
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ROOM_CODE_LENGTH = 5;
const ROOM_CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Uppercase and strip whitespace and hyphens; returns null if the result is not a valid code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return ROOM_CODE_RE.test(code) ? code : null;
}
