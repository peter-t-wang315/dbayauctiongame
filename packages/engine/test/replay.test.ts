import { describe, expect, it } from 'vitest';
import { hashString } from '../src/rng';
import { playGame } from '../src/testing/driver';
import { engine, kinds, mkSetup } from './helpers';

const digest = (x: unknown) => hashString(JSON.stringify(x)).toString(16);

describe('replay', () => {
  it('same seed + same recorded steps -> identical state (classic and frenzy)', () => {
    for (const mode of ['classic', 'frenzy'] as const) {
      const r = playGame({
        engine,
        setup: mkSetup(4, 'replay-1', mode),
        levels: ['careful', 'greedy', 'random'],
      });
      expect(r.terminated).toBe(true);
      let { state } = engine.setup(mkSetup(4, 'replay-1', mode), r.startMs);
      for (const step of r.trace) {
        const res = step.action
          ? engine.apply(state, step.action, step.t)
          : { ok: true as const, ...engine.tick(state, step.t) };
        expect(res.ok).toBe(true);
        if (res.ok) state = res.state;
      }
      expect(state).toEqual(r.state);
      expect(engine.score(state)).toEqual(engine.score(r.state));
    }
  });

  it('different seeds give different games', () => {
    const a = playGame({ engine, setup: mkSetup(4, 'one'), levels: ['careful'] });
    const b = playGame({ engine, setup: mkSetup(4, 'two'), levels: ['careful'] });
    expect(digest(a.state)).not.toBe(digest(b.state));
  });
});

// Golden fixtures: a fixed seed must keep producing exactly this game. If you change rules or
// bot behaviour on purpose, regenerate the numbers (they print on failure) and say so in the PR.
describe('golden', () => {
  const cases = [
    { mode: 'classic', n: 4 },
    { mode: 'frenzy', n: 5 },
  ] as const;
  for (const c of cases) {
    it(`golden ${c.mode} ${c.n}p`, () => {
      const r = playGame({
        engine,
        setup: mkSetup(c.n, 'golden-seed', c.mode),
        levels: ['careful', 'greedy', 'random'],
        driverSeed: 'golden-driver',
      });
      const score = engine.score(r.state);
      const summary = {
        endMs: r.endMs - r.startMs,
        events: r.events.length,
        sold: kinds(r.events.map((e) => e.e)).filter((k) => k === 'sold').length,
        totals: score.players.map((p) => [p.id, p.total, p.rank]),
        state: digest(r.state),
      };
      expect(summary).toMatchSnapshot();
    });
  }
});
