import { describe, expect, it } from 'vitest';
import { engine, stubEngine } from '../src/index';

const players = ['a', 'b', 'c'].map((id) => ({ id, isBot: false, connected: true }));
const base = { seed: 'api', mode: 'classic' as const, bidWindowMs: 5000, relaxed: false, players };

describe('public engine (contract: engine-real-and-length)', () => {
  it('index exports the real engine with revealDelayMs and botAction(level)', () => {
    expect(engine).not.toBe(stubEngine);
    const { state } = engine.setup(base, 0);
    expect(engine.revealDelayMs(state)).toBeGreaterThan(0);
    for (const level of ['random', 'greedy', 'careful'] as const) {
      expect(() => engine.botAction(state, 'a', 0, level)).not.toThrow();
    }
    expect(stubEngine.revealDelayMs(state)).toBeGreaterThan(0);
  });
  it('length defaults to standard and is carried in the state', () => {
    expect(engine.setup(base, 0).state.length).toBe('standard');
    expect(engine.setup({ ...base, length: 'quick' }, 0).state.length).toBe('quick');
  });
});
