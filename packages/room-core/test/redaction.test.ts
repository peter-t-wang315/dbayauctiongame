// The redaction leak test (05 section 10): every phase x every player (+ a non-member), forbidden
// data never appears, and hidden state cannot influence the serialized view.
import { engine } from '@dbay/engine';
import { PlayerViewSchema } from '@dbay/protocol';
import { describe, expect, it } from 'vitest';
import { view, type RoomState } from '../src/index';
import { Harness } from './helpers';

const SEED = 'LEAKSEED-9f3a7c';

/** Play a whole game with bots, with a bot-policy proxy driving the human seat; sample states. */
function sampleGame(seed: string, mode: 'classic' | 'frenzy', samples: RoomState[]): Set<string> {
  const seen = new Set<string>();
  const h = new Harness();
  const host = h.join('Human');
  h.act(host, { t: 'addBot' });
  h.act(host, { t: 'addBot' });
  h.act(host, { t: 'setOpts', mode, length: 'quick' });
  samples.push(h.state); // lobby
  h.start(seed);
  let n = 0;
  for (let i = 0; i < 6000 && h.state.meta.phase !== 'ended'; i++) {
    const g = h.state.game;
    if (g && h.state.meta.phase === 'playing') {
      const a = engine.botAction(g, host, h.now);
      if (a && (a.type === 'bid' || a.type === 'gift' || a.type === 'giftGive')) {
        h.now += 50;
        h.act(
          host,
          a.type === 'bid'
            ? { t: 'bid', card: a.card, bay: a.bay }
            : a.type === 'gift'
              ? { t: 'gift', target: a.target }
              : { t: 'giftGive', item: a.item },
        );
      }
    }
    const next = h.state.deadlines[0]!;
    h.tickTo(Math.max(next.at, h.now));
    seen.add(`${h.state.meta.phase}/${h.state.game?.stage ?? '-'}`);
    if (i % 7 === 0 || h.state.game?.stage === 'gifts') {
      if (n++ < 400) samples.push(h.state);
    }
  }
  samples.push(h.state); // ended
  return seen;
}

function allIds(s: RoomState): string[] {
  return [...s.players.map((p) => p.id), 'spectator-nobody'];
}

function visibleCardIds(s: RoomState): Set<string> {
  const g = s.game;
  const ids = new Set<string>();
  if (!g) return ids;
  for (const b of g.bays) if (b.card) ids.add(b.card);
  for (const p of g.players) {
    for (const w of p.won) ids.add(w);
    for (const w of p.gifts) ids.add(w);
  }
  for (const e of s.log) if (e.card) ids.add(e.card);
  for (const gl of g.giftLog) if (gl.card) ids.add(gl.card);
  return ids;
}

describe('redaction leak test', () => {
  const samples: RoomState[] = [];
  const seen = new Set<string>();
  for (const [seed, mode] of [
    [SEED, 'classic'],
    [`${SEED}-b`, 'classic'],
    [`${SEED}-c`, 'frenzy'],
  ] as const) {
    for (const k of sampleGame(seed, mode, samples)) seen.add(k);
  }

  it('covers every phase (and the gifts stage)', () => {
    expect(seen.has('playing/bidding')).toBe(true);
    expect(seen.has('playing/gifts')).toBe(true);
    expect(seen.has('reveal/done')).toBe(true);
    expect(seen.has('ended/done')).toBe(true);
    expect(samples.some((s) => s.meta.phase === 'lobby')).toBe(true);
    expect(samples.length).toBeGreaterThan(50);
  });

  it('views validate and never contain the seed, hashes, deck cards, or `actual` before reveal', () => {
    for (const s of samples) {
      const pre = s.meta.phase === 'lobby' || s.meta.phase === 'playing';
      const visible = visibleCardIds(s);
      for (const pid of allIds(s)) {
        const v = view(s, pid);
        expect(PlayerViewSchema.safeParse(v).success).toBe(true);
        const json = JSON.stringify(v);
        expect(json).not.toContain('LEAKSEED');
        expect(json).not.toContain('secretHash');
        for (const p of s.players) if (p.secretHash) expect(json).not.toContain(p.secretHash);
        if (s.game) {
          expect(json).not.toContain(s.game.seed);
          for (const id of s.game.deck) {
            if (!visible.has(id)) expect(json).not.toContain(`"${id}"`);
          }
          expect(json).not.toContain('"rng"');
          expect(json).not.toContain('"deck"');
        }
        if (pre) {
          expect(v.reveal).toBeUndefined();
          expect(json).not.toContain('"actual"');
          expect(json).not.toContain('"tier"');
        }
        // others: counts only
        const ids = new Set(v.myHand.map((c) => c.id));
        expect(ids.size).toBe(v.myHand.length);
        if (s.game) {
          const mine = s.game.players.find((p) => p.id === pid);
          const onBays = s.game.bays.flatMap((b) => b.stack.filter((e) => e.by === pid));
          expect(v.myHand).toHaveLength((mine?.hand.length ?? 0) + (mine ? onBays.length : 0));
          for (const p of v.players) {
            const ep = s.game.players.find((x) => x.id === p.id)!;
            expect(p.cardsInHand).toBe(ep.hand.length);
          }
        } else {
          expect(v.myHand).toEqual([]);
        }
      }
    }
  });

  it('hidden state cannot influence the view: mutating others hands, deck, seed, rng, secrets leaves JSON unchanged', () => {
    let checked = 0;
    for (const s of samples) {
      if (!s.game) continue;
      for (const pid of allIds(s)) {
        const before = JSON.stringify(view(s, pid));
        const m: RoomState = structuredClone(s);
        const g = m.game!;
        g.seed = 'MUTATED-SEED';
        g.deck = [...g.deck].reverse().map((id) => `${id}`);
        g.deck.sort();
        for (const k of Object.keys(g.rng) as Array<keyof typeof g.rng>) g.rng[k] = 12345;
        // After the game, remaining hand totals are legitimately public via `reveal.tiebreak`.
        const handsPublic = s.meta.phase === 'reveal' || s.meta.phase === 'ended';
        for (const p of g.players) {
          if (p.id === pid || handsPublic) continue;
          // same count, different identity: scramble ids and values of other hands
          p.hand = p.hand.map((c, i) => ({
            id: `zz${i}`,
            kind: c.kind,
            ...(c.value !== undefined ? { value: c.value + 7 } : {}),
          }));
        }
        for (const p of m.players) if (p.id !== pid) p.secretHash = 'MUTATED';
        m.meta.seed = 'MUTATED-PENDING';
        m.deadlines = [];
        expect(JSON.stringify(view(m, pid))).toBe(before);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('reveal/ended views expose results identically to every player; actual only there', () => {
    const post = samples.filter((s) => s.meta.phase === 'reveal' || s.meta.phase === 'ended');
    expect(post.length).toBeGreaterThan(0);
    for (const s of post) {
      const views = allIds(s).map((pid) => view(s, pid));
      for (const v of views) {
        expect(v.reveal).toBeTruthy();
        expect(v.reveal).toEqual(views[0]!.reveal);
      }
      // numbers agree with the content the engine scored from
      for (const rp of views[0]!.reveal!.players)
        for (const it of rp.items) expect(it.actual).toBe(engine.index.cards.get(it.card)!.actual);
    }
  });

  it('a non-member sees public info only and cannot act', () => {
    const s = samples.find((x) => x.meta.phase === 'playing')!;
    const v = view(s, 'spectator-nobody');
    expect(v.myHand).toEqual([]);
    expect(v.canAct).toBe(false);
    expect(v.cooldownUntil).toBeUndefined();
  });
});
