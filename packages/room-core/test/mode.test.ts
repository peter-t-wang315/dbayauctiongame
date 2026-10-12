import { describe, expect, it } from 'vitest';
import { view } from '../src/index';
import { Harness } from './helpers';

describe('default mode follows player count', () => {
  const room = (n: number) => {
    const h = new Harness();
    const host = h.join('Host');
    for (let i = 1; i < n; i++) h.act(host, { t: 'addBot' });
    return { h, host };
  };

  it('3 players -> classic, 5 players -> frenzy; start fixes it', () => {
    expect(room(3).h.state.meta.opts.mode).toBe('classic');
    const { h } = room(5);
    expect(h.state.meta.opts.mode).toBe('frenzy');
    expect(view(h.state, 'p1').opts.mode).toBe('frenzy');
    h.start();
    expect(h.state.game!.mode).toBe('frenzy');
  });

  it('join/leave flips the default', () => {
    const { h, host } = room(4);
    expect(h.state.meta.opts.mode).toBe('classic');
    h.act(host, { t: 'addBot' });
    expect(h.state.meta.opts.mode).toBe('frenzy');
    h.act(host, { t: 'rmBot', playerId: 'bot4' });
    expect(h.state.meta.opts.mode).toBe('classic');
    const g = h.join('Guest');
    expect(h.state.meta.opts.mode).toBe('frenzy');
    h.run({ type: 'leave', playerId: g });
    expect(h.state.meta.opts.mode).toBe('classic');
  });

  it('a host-set mode sticks', () => {
    const a = room(3);
    a.h.act(a.host, { t: 'setOpts', mode: 'frenzy' });
    a.h.act(a.host, { t: 'addBot' });
    a.h.act(a.host, { t: 'rmBot', playerId: 'bot3' });
    expect(a.h.state.meta.opts.mode).toBe('frenzy');
    const b = room(5);
    b.h.act(b.host, { t: 'setOpts', mode: 'classic' });
    b.h.act(b.host, { t: 'addBot' });
    expect(b.h.state.meta.opts.mode).toBe('classic');
    // setOpts without a mode does not count as choosing one
    const c = room(3);
    c.h.act(c.host, { t: 'setOpts', length: 'quick' });
    c.h.act(c.host, { t: 'addBot' });
    c.h.act(c.host, { t: 'addBot' });
    expect(c.h.state.meta.opts.mode).toBe('frenzy');
  });
});
