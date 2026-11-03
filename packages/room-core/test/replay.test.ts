import { PlayerViewSchema, type ClientAction } from '@dbay/protocol';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  RATE_LIMIT_PER_SEC,
  createRoom,
  newRateState,
  rateLimit,
  reduce,
  secretsMatch,
  view,
  type RoomEvent,
  type RoomState,
} from '../src/index';
import { Harness, T0, hashOf } from './helpers';

function replay(code: string, log: Array<{ event: RoomEvent; now: number }>) {
  let state = createRoom(code, T0);
  const effects: unknown[] = [];
  for (const { event, now } of log) {
    const r = reduce(state, event, now);
    state = r.state;
    effects.push(r.effects);
  }
  return { state, effects };
}

describe('replay golden', () => {
  it('the same event log replays to the same state and effects (full game incl. bots)', () => {
    const h = new Harness();
    const host = h.join('Host');
    h.join('Guest');
    h.act(host, { t: 'addBot' });
    h.act(host, { t: 'setOpts', length: 'quick' });
    h.start('golden-seed');
    for (let i = 0; i < 4000 && h.state.meta.phase !== 'ended'; i++) {
      h.tickTo(Math.max(h.state.deadlines[0]!.at, h.now));
    }
    expect(h.state.meta.phase).toBe('ended');
    const a = replay('K7QMX', h.events);
    const b = replay('K7QMX', h.events);
    expect(a.state).toEqual(h.state);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(h.state));
    expect(a.state).toEqual(b.state);
    expect(a.effects).toEqual(b.effects);
    // the log is a plain-JSON round trip (what the wrapper persists)
    expect(JSON.parse(JSON.stringify(h.state))).toEqual(h.state);
  });

  it('reduce never mutates its input state', () => {
    const h = Harness.started(3, 0);
    const frozen = JSON.stringify(h.state);
    reduce(h.state, { type: 'tick' }, h.now + 60_000);
    reduce(h.state, { type: 'disconnect', playerId: 'p1' }, h.now + 1);
    reduce(h.state, { type: 'action', playerId: 'p1', msg: { t: 'pass', seq: 99 } }, h.now + 1);
    expect(JSON.stringify(h.state)).toBe(frozen);
  });
});

describe('rate limit + secret compare', () => {
  it('20 msg/s ok, excess limited, 3 striking windows close; time is passed in', () => {
    let s = newRateState(0);
    const verdicts: string[] = [];
    for (let i = 0; i < RATE_LIMIT_PER_SEC; i++) {
      const r = rateLimit(s, i, RATE_LIMIT_PER_SEC);
      s = r.state;
      verdicts.push(r.verdict);
    }
    expect(new Set(verdicts)).toEqual(new Set(['ok']));
    let r = rateLimit(s, 500);
    expect(r.verdict).toBe('limited'); // strike 1
    r = rateLimit(r.state, 600);
    expect(r.verdict).toBe('limited'); // same window, still strike 1
    expect(r.state.strikes).toBe(1);
    // new window resets the count
    r = rateLimit(r.state, 1500);
    expect(r.verdict).toBe('ok');
    let st = r.state;
    for (let w = 1; w <= 2; w++) {
      for (let i = 0; i < RATE_LIMIT_PER_SEC; i++) st = rateLimit(st, 10_000 * w + i).state;
      const x = rateLimit(st, 10_000 * w + 500);
      st = x.state;
      expect(x.verdict).toBe(w === 2 ? 'close' : 'limited');
    }
    expect(rateLimit(st, 99_999).verdict).toBe('close');
  });

  it('secretsMatch compares hashes exactly', () => {
    expect(secretsMatch(hashOf('a'), hashOf('a'))).toBe(true);
    expect(secretsMatch(hashOf('a'), hashOf('b'))).toBe(false);
    expect(secretsMatch('abc', 'abcd')).toBe(false);
    expect(secretsMatch(null, 'x')).toBe(false);
  });
});

// ---------------------------------------------------------------- fast-check

/** Non-ASCII marker: fast-check's default `fc.string` is printable ASCII, and no view text uses it. */
const SEED_MARK = '§seed§';
const markSeed = (s: string) => `${SEED_MARK}${s}`;

/** Longer than any generated seed, so even a leaked seed length would differ after the swap. */
const SWAPPED = 'SWAPPED-SEED-'.padEnd(40, 'x');

/**
 * Neither the pending seed (`meta.seed`) nor the game seed may reach any view.
 * 1. Swap check: replacing both seed fields must leave every view byte-identical, i.e. no view reads
 *    them. Works for any seed, unlike `json.not.toContain(seed)`, which false-positives on 1-char
 *    seeds such as ',' or ' ' that occur naturally in view JSON. (It does not cover values derived
 *    from the seed, such as `game.rng` or deck order; redaction.test.ts mutates those.)
 * 2. Substring check for marked seeds (all non-empty fuzzed seeds are marked): catches a seed copied
 *    into some other state field that a view does expose.
 */
function expectSeedNotInViews(state: RoomState, viewers: string[]) {
  const seeds = [state.game?.seed, state.meta.seed].filter((s): s is string => s !== undefined);
  if (seeds.length === 0) return;
  const swapped: RoomState = structuredClone(state);
  if (swapped.game) swapped.game.seed = SWAPPED;
  if (swapped.meta.seed !== undefined) swapped.meta.seed = SWAPPED;
  for (const p of viewers) {
    const json = JSON.stringify(view(state, p));
    expect(JSON.stringify(view(swapped, p))).toBe(json);
    for (const s of seeds) if (s.startsWith(SEED_MARK)) expect(json).not.toContain(s);
  }
}

describe('seed leak check (regression: intermittent "holds invariants" failure)', () => {
  it('does not false-positive on a 1-char seed that occurs naturally in view JSON', () => {
    // Shrunk counterexample from fast-check (seed: 2, path: "32718:2:0:1:5:4:5:9:9:10:9:9:11:10:10:
    // 10:12:12:14:14:14:15:14:14:14:16:15:15:15:15:15:15:16:16:19:21:20:3:3:3:19:19:19:19:23:25:24:
    // 25:22:22"). The old check `expect(viewJson).not.toContain(game.seed)` failed on seed ','.
    const join = (playerId: string): RoomEvent => ({
      type: 'join',
      conn: '',
      name: '!',
      playerId,
      secret: 's',
      secretHash: 'h1',
    });
    const log: RoomEvent[] = [
      { type: 'seed', seed: ',' },
      join('bot1'),
      join('p1'),
      join('p4'),
      { type: 'action', playerId: 'bot1', msg: { t: 'start', seq: 1 } as ClientAction },
      { type: 'seed', seed: '' },
    ];
    const { state } = replay(
      'K7QMX',
      log.map((event) => ({ event, now: T0 })),
    );
    expect(state.meta.phase).toBe('playing');
    expect(state.game?.seed).toBe(',');
    const viewers = [...state.players.map((p) => p.id), 'ghost'];
    // ',' is in every view's JSON for reasons unrelated to the seed...
    expect(JSON.stringify(view(state, 'ghost'))).toContain(',');
    // ...but the seed itself does not reach any view.
    expectSeedNotInViews(state, viewers);
  });

  it('still catches a real leak of a marked seed', () => {
    const h = Harness.started(3, 0, {}, markSeed('leak'));
    const leaky: RoomState = structuredClone(h.state);
    leaky.players[0]!.name = h.state.game!.seed; // simulate a seed copied into a public field
    expect(() => expectSeedNotInViews(leaky, ['ghost'])).toThrow();
    expectSeedNotInViews(h.state, [...h.state.players.map((p) => p.id), 'ghost']);
  });

  it('covers the pending lobby seed (meta.seed) as well', () => {
    const h = new Harness();
    h.join('Host');
    h.join('Guest');
    h.run({ type: 'seed', seed: markSeed('pending') });
    expect(h.state.meta.seed).toBe(markSeed('pending'));
    const viewers = [...h.state.players.map((p) => p.id), 'ghost'];
    expectSeedNotInViews(h.state, viewers);
    const leaky: RoomState = structuredClone(h.state);
    leaky.players[1]!.name = h.state.meta.seed!;
    expect(() => expectSeedNotInViews(leaky, viewers)).toThrow();
  });
});

const ids = ['p1', 'p2', 'p3', 'p4', 'bot1', 'ghost'];
const idArb = fc.constantFrom(...ids);
const actionArb: fc.Arbitrary<Record<string, unknown>> = fc.oneof(
  fc.record({
    t: fc.constant('bid'),
    card: fc.constantFrom('v10', 'v100', 'p1', 'p2', 'zz'),
    bay: fc.integer({ min: -1, max: 5 }),
  }),
  fc.record({ t: fc.constant('pass') }),
  fc.record({ t: fc.constant('gift'), target: idArb }),
  fc.record({ t: fc.constant('giftGive'), item: fc.string({ maxLength: 8 }) }),
  fc.record({ t: fc.constant('rename'), name: fc.string({ maxLength: 20 }) }),
  fc.record({ t: fc.constant('start') }),
  fc.record({
    t: fc.constant('setOpts'),
    mode: fc.constantFrom('classic', 'frenzy', 'x', undefined),
    length: fc.constantFrom('quick', 'standard', 'epic', undefined),
    bidWindowMs: fc.constantFrom(3000, 5000, 8000, 1, undefined),
    relaxed: fc.constantFrom(true, false, undefined),
  }),
  fc.record({ t: fc.constant('addBot') }),
  fc.record({ t: fc.constant('rmBot'), playerId: idArb }),
  fc.record({ t: fc.constant('kick'), playerId: idArb }),
  fc.record({ t: fc.constant('rematch') }),
  fc.record({ t: fc.string({ maxLength: 5 }) }),
);

const eventArb: fc.Arbitrary<{ ev: RoomEvent; dt: number }> = fc.record({
  dt: fc.oneof(fc.integer({ min: 0, max: 3000 }), fc.integer({ min: 0, max: 400_000 })),
  ev: fc.oneof(
    {
      weight: 3,
      arbitrary: fc.record({
        type: fc.constant('join' as const),
        conn: fc.string({ maxLength: 4 }),
        name: fc.string({ maxLength: 20 }),
        playerId: idArb,
        secret: fc.constant('s'),
        secretHash: fc.constantFrom('h1', 'h2'),
      }),
    },
    {
      weight: 2,
      arbitrary: fc.record({
        type: fc.constant('hello' as const),
        conn: fc.string({ maxLength: 4 }),
        playerId: idArb,
        secretHash: fc.constantFrom('h1', 'h2'),
      }),
    },
    {
      weight: 8,
      arbitrary: fc.record({
        type: fc.constant('action' as const),
        playerId: idArb,
        msg: fc
          .tuple(actionArb, fc.integer({ min: -2, max: 30 }))
          .map(([m, seq]) => ({ ...m, seq }) as unknown as ClientAction),
      }),
    },
    { weight: 1, arbitrary: fc.record({ type: fc.constant('leave' as const), playerId: idArb }) },
    {
      weight: 1,
      arbitrary: fc.record({
        type: fc.constant('connect' as const),
        conn: fc.string({ maxLength: 4 }),
      }),
    },
    {
      weight: 2,
      arbitrary: fc.record({ type: fc.constant('disconnect' as const), playerId: idArb }),
    },
    { weight: 1, arbitrary: fc.record({ type: fc.constant('snap' as const), playerId: idArb }) },
    { weight: 6, arbitrary: fc.record({ type: fc.constant('tick' as const) }) },
    {
      weight: 2,
      arbitrary: fc.record({
        type: fc.constant('seed' as const),
        // '' exercises the reducer's reject path; every other seed is marked so the substring leak
        // check in `expectSeedNotInViews` cannot collide with ordinary view JSON (e.g. seed ',').
        seed: fc.string({ maxLength: 6 }).map((s) => (s === '' ? '' : markSeed(s))),
      }),
    },
  ),
});

describe('fast-check: mid-game sequences', () => {
  it('never throws and keeps views valid from a started game', () => {
    const gids = ['p1', 'p2', 'p3', 'bot1'];
    const gameEvent: fc.Arbitrary<{ ev: RoomEvent; dt: number }> = fc.record({
      dt: fc.oneof(fc.integer({ min: 0, max: 2000 }), fc.integer({ min: 0, max: 200_000 })),
      ev: fc.oneof(
        {
          weight: 10,
          arbitrary: fc.record({
            type: fc.constant('action' as const),
            playerId: fc.constantFrom(...gids),
            msg: fc
              .tuple(actionArb, fc.integer({ min: 1, max: 40 }))
              .map(([m, seq]) => ({ ...m, seq }) as unknown as ClientAction),
          }),
        },
        {
          weight: 3,
          arbitrary: fc.record({
            type: fc.constant('disconnect' as const),
            playerId: fc.constantFrom(...gids),
          }),
        },
        {
          weight: 3,
          arbitrary: fc.constantFrom('p1', 'p2', 'p3').map((id): RoomEvent => ({
            type: 'hello',
            conn: 'c',
            playerId: id,
            secretHash: hashOf(`s-${id}`),
          })),
        },
        {
          weight: 1,
          arbitrary: fc
            .constantFrom('p1', 'p2', 'p3')
            .map((id): RoomEvent => ({ type: 'leave', playerId: id })),
        },
        { weight: 10, arbitrary: fc.record({ type: fc.constant('tick' as const) }) },
        {
          weight: 1,
          arbitrary: fc.record({
            type: fc.constant('seed' as const),
            seed: fc.string({ maxLength: 6 }),
          }),
        },
      ),
    });
    fc.assert(
      fc.property(
        fc.constantFrom('classic', 'frenzy'),
        fc.array(gameEvent, { minLength: 1, maxLength: 80 }),
        (mode, events) => {
          const h = Harness.started(3, 1, { mode }, markSeed('mid-game'));
          let state = h.state;
          let now = h.now;
          for (const { ev, dt } of events) {
            now += dt;
            state = reduce(state, ev, now).state;
            if (state.meta.closed) break;
            for (const p of state.players) {
              expect(PlayerViewSchema.safeParse(view(state, p.id)).success).toBe(true);
            }
            expectSeedNotInViews(state, [...state.players.map((p) => p.id), 'ghost']);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('fast-check: reducer never throws on arbitrary event sequences', () => {
  it('holds invariants', () => {
    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 1, maxLength: 60 }), (events) => {
        let state: RoomState = createRoom('K7QMX', T0);
        let now = T0;
        let prevRev = 0;
        for (const { ev, dt } of events) {
          now += dt;
          const r = reduce(state, ev, now);
          expect(r.state.rev).toBeGreaterThanOrEqual(prevRev);
          prevRev = r.state.rev;
          state = r.state;
          expect(state.players.length).toBeLessThanOrEqual(6);
          const dl = state.deadlines.map((d) => d.at);
          expect([...dl].sort((a, b) => a - b)).toEqual(dl);
          if (!state.meta.closed) {
            const viewers = [...state.players.map((x) => x.id), 'ghost'];
            for (const p of viewers) {
              const v = view(state, p);
              expect(PlayerViewSchema.safeParse(v).success).toBe(true);
            }
            expectSeedNotInViews(state, viewers);
          }
          JSON.stringify(state);
        }
      }),
      { numRuns: 300 },
    );
  });
});
