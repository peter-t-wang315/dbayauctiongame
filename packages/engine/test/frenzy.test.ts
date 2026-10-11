import { describe, expect, it } from 'vitest';
import { CONFIG, LENGTH_PRESETS } from '../src/config';
import { T0, act, clone, engine, kinds, mkSetup, newGame, player, px, stackOn, v } from './helpers';

const frenzy = (n = 5, seed = 'f1') => newGame(n, 'frenzy', seed);
const bid = (card: string, bay: number, by: string) =>
  ({ type: 'bid', player: by, card, bay }) as const;

describe('F1 bid legality', () => {
  it('F1: same legality as R16 but any player may bid on any bay at any time', () => {
    const s = frenzy().state;
    expect(s.call).toBeNull();
    const a = act(s, bid('v50', 0, 'p0'), T0 + 100).state;
    // different players, different bays, no turn order
    const b = act(a, bid('v75', 0, 'p3'), T0 + 200).state;
    expect(engine.apply(b, bid('v100', 0, 'p3'), T0 + 2000)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    }); // own top
    expect(engine.apply(b, bid('v75', 0, 'p1'), T0 + 300)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    }); // equal
    expect(engine.apply(b, bid('v10', 0, 'p1'), T0 + 300)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    }); // lower
    expect(engine.apply(b, bid('v10', 1, 'p1'), T0 + 300).ok).toBe(true);
    expect(engine.apply(b, { type: 'pass', player: 'p1' }, T0 + 300)).toEqual({
      ok: false,
      code: 'WRONG_PHASE',
    });
    const p = act(b, bid('p1', 0, 'p1'), T0 + 300).state;
    expect(engine.apply(p, bid('v300', 0, 'p2'), T0 + 300).ok).toBe(false); // only a Proxy beats a Proxy
    expect(engine.apply(p, bid('p1', 0, 'p2'), T0 + 300).ok).toBe(true);
    void px;
  });
});

describe('F2 bay timer', () => {
  it('F2: closesAt = open + U(18000, 30000); every bay is armed at setup', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const s = frenzy(5, seed).state;
      for (const b of s.bays) {
        expect(b.openedAt).toBe(T0);
        expect(b.closesAt! - T0).toBeGreaterThanOrEqual(LENGTH_PRESETS.standard.frenzyOpenMinMs);
        expect(b.closesAt! - T0).toBeLessThanOrEqual(LENGTH_PRESETS.standard.frenzyOpenMaxMs);
      }
    }
    const [x, y] = [frenzy(5, 'a').state, frenzy(5, 'b').state];
    expect(x.bays.map((b) => b.closesAt)).not.toEqual(y.bays.map((b) => b.closesAt));
  });
  it('F2: an accepted bid sets closesAt = max(closesAt, now + 3000), never shortening', () => {
    const s = clone(frenzy().state);
    s.bays[0]!.closesAt = T0 + 20000;
    const early = act(s, bid('v10', 0, 'p0'), T0 + 5000);
    expect(early.state.bays[0]!.closesAt).toBe(T0 + 20000);
    expect(kinds(early.events)).not.toContain('extended');
    const late = act(s, bid('v10', 0, 'p0'), T0 + 19000);
    expect(late.state.bays[0]!.closesAt).toBe(T0 + 22000);
    expect(kinds(late.events)).toContain('extended');
  });
  it('F2: hard cap closesAt <= openedAt + frenzyHardCapMs', () => {
    const s = clone(frenzy().state);
    s.bays[0]!.closesAt = T0 + 59000;
    const r = act(s, bid('v10', 0, 'p0'), T0 + 58500);
    expect(r.state.bays[0]!.closesAt).toBe(T0 + CONFIG.frenzyHardCapMs);
  });
});

describe('F3 expiry', () => {
  it('F3: a bay with bids sells at closesAt and refills with a fresh timer', () => {
    const s = clone(frenzy().state);
    stackOn(s, 0, [['p1', v(50)]]);
    const at = s.bays[0]!.closesAt!;
    const before = s.bays[0]!.card;
    const next = s.deck[0];
    const r = engine.tick(s, at);
    expect(r.state.players[1]!.won).toEqual([before]);
    expect(r.state.bays[0]!.card).toBe(next);
    expect(r.state.bays[0]!.openedAt).toBe(at);
    expect(r.state.bays[0]!.closesAt! - at).toBeGreaterThanOrEqual(
      LENGTH_PRESETS.standard.frenzyOpenMinMs,
    );
    expect(r.state.resolved).toBe(1);
  });
  it('F3: an empty bay re-arms +10000 up to 2 times, then is discarded unsold and refilled', () => {
    let s = clone(frenzy().state);
    s.bays.forEach((b, i) => i && (b.closesAt = T0 + 55000));
    const card = s.bays[0]!.card;
    const t1 = s.bays[0]!.closesAt!;
    s = engine.tick(s, t1).state;
    expect(s.bays[0]!.closesAt).toBe(t1 + CONFIG.frenzyIdleRecheckMs);
    expect(s.bays[0]!.card).toBe(card);
    const t2 = s.bays[0]!.closesAt!;
    s = engine.tick(s, t2).state;
    expect(s.bays[0]!.closesAt).toBe(t2 + CONFIG.frenzyIdleRecheckMs);
    expect(s.bays[0]!.idleExpiries).toBe(2);
    const t3 = s.bays[0]!.closesAt!;
    const r = engine.tick(s, t3);
    expect(kinds(r.events)).toContain('unsold');
    expect(r.state.bays[0]!.card).not.toBe(card);
    expect(r.state.resolved).toBe(1);
  });
});

describe('F4 ordering and fairness', () => {
  it('F4: a bid at or after closesAt is TOO_LATE even before the alarm fires', () => {
    const s = frenzy().state;
    const at = s.bays[0]!.closesAt!;
    const before = clone(s);
    expect(engine.apply(s, bid('v10', 0, 'p0'), at)).toEqual({ ok: false, code: 'TOO_LATE' });
    expect(engine.apply(s, bid('v10', 0, 'p0'), at - 1).ok).toBe(true);
    expect(s).toEqual(before);
  });
  it('F4: the later of two conflicting bids is rejected ILLEGAL_BID (strict arrival order)', () => {
    const s = frenzy().state;
    const first = act(s, bid('v100', 0, 'p0'), T0 + 10).state;
    expect(engine.apply(first, bid('v100', 0, 'p1'), T0 + 11)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    });
    expect(engine.apply(first, bid('v75', 0, 'p1'), T0 + 11)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    });
  });
});

describe('F5 rate limit', () => {
  it('F5: after an accepted bid the player is on cooldown; rejected bids do not restart it', () => {
    const s = frenzy().state;
    const a = act(s, bid('v10', 0, 'p0'), T0 + 100).state;
    expect(a.players[0]!.cooldownUntil).toBe(T0 + 100 + CONFIG.bidCooldownMs);
    expect(engine.apply(a, bid('v25', 1, 'p0'), T0 + 500)).toEqual({ ok: false, code: 'COOLDOWN' });
    expect(engine.apply(a, bid('v25', 1, 'p0'), T0 + 1099)).toEqual({
      ok: false,
      code: 'COOLDOWN',
    });
    const again = act(a, bid('v25', 1, 'p0'), T0 + 1100).state;
    expect(again.players[0]!.cooldownUntil).toBe(T0 + 2100);
    // other players are unaffected
    expect(engine.apply(a, bid('v25', 1, 'p1'), T0 + 500).ok).toBe(true);
  });
});

describe('F6 no auto-skip / no dry turns', () => {
  it('F6: dry players just cannot bid; disconnected players do nothing; no autoPass', () => {
    const s = clone(frenzy().state);
    s.players[0]!.hand = [];
    expect(engine.apply(s, bid('v10', 0, 'p0'), T0 + 1)).toEqual({
      ok: false,
      code: 'ILLEGAL_BID',
    });
    const d = act(s, { type: 'setConnected', player: 'p1', connected: false }, T0 + 1).state;
    expect(d.players[1]!.connected).toBe(false);
    const r = engine.tick(d, T0 + 1000);
    expect(kinds(r.events)).not.toContain('autoPass');
    expect(r.state.callsDone).toBe(0);
  });
});

describe('F7 rounds mapping, halfway and last round', () => {
  it('F7: display round = floor(resolved / D x R) + 1', () => {
    const s = clone(frenzy().state);
    expect(s.round).toMatchObject({ n: 1, of: 20 });
    s.resolved = 14; // D = 30, R = 20 -> floor(15/30*20)+1 = 11 after the next resolution
    stackOn(s, 0, [['p1', v(50)]]);
    const r = engine.tick(s, s.bays[0]!.closesAt!);
    expect(r.state.resolved).toBe(15);
    expect(r.state.round.n).toBe(11);
  });
  it('F7: Halfway fires once resolved >= ceil(D/2)', () => {
    const s = clone(frenzy().state);
    s.resolved = Math.ceil(s.deckSize / 2) - 1;
    stackOn(s, 0, [['p1', v(50)]]);
    const r = engine.tick(s, s.bays[0]!.closesAt!);
    expect(kinds(r.events)).toContain('halfway');
    expect(r.state.round.halfway).toBe(true);
  });
  it('F7: Last round starts when the last deck card is drawn; no refills, closesAt capped, empty bays discarded', () => {
    const s = clone(frenzy().state);
    s.deck = ['toys-item-9'];
    stackOn(s, 0, [['p1', v(50)]]);
    const t = s.bays[0]!.closesAt!;
    const r = engine.tick(s, t);
    expect(kinds(r.events)).toContain('lastRound');
    expect(r.state.round.last).toBe(true);
    expect(r.state.deck).toEqual([]);
    for (const b of r.state.bays)
      expect(b.closesAt! - t).toBeLessThanOrEqual(CONFIG.frenzyLastRoundMaxMs);
    // empty-stack bays are discarded at their closesAt with no re-arm; game then goes to gifts/done
    const end = engine.tick(r.state, t + CONFIG.frenzyLastRoundMaxMs + 1);
    expect(end.state.bays.every((b) => b.card === null)).toBe(true);
    expect(end.state.stage).not.toBe('bidding');
    expect(kinds(end.events)).toContain('gameOver');
  });
  it('F7: the time cap (frenzyMaxMs) triggers the last round and stops the deck', () => {
    const s = clone(frenzy().state);
    s.bays.forEach((b) => (b.closesAt = T0 + 55000));
    expect(engine.nextDeadline(s)).toBe(T0 + 55000);
    const capAt = T0 + CONFIG.frenzyMaxMs;
    s.bays.forEach((b) => (b.closesAt = capAt + 40000));
    expect(engine.nextDeadline(s)).toBe(capAt);
    const r = engine.tick(s, capAt);
    expect(r.state.round.last).toBe(true);
    expect(r.state.deck).toEqual([]);
    for (const b of r.state.bays) expect(b.closesAt).toBe(capAt + CONFIG.frenzyLastRoundMaxMs);
  });
});

describe('F8 Relaxed', () => {
  it('F8: durations x1.5 (open, anti-snipe, idle, hard cap); cooldown unscaled', () => {
    const s = engine.setup({ ...mkSetup(5, 'r', 'frenzy'), relaxed: true }, T0).state;
    for (const b of s.bays) {
      expect(b.closesAt! - T0).toBeGreaterThanOrEqual(
        LENGTH_PRESETS.standard.frenzyOpenMinMs * 1.5,
      );
      expect(b.closesAt! - T0).toBeLessThanOrEqual(LENGTH_PRESETS.standard.frenzyOpenMaxMs * 1.5);
    }
    const c = clone(s);
    c.bays[0]!.closesAt = T0 + 20000;
    const r = act(c, bid('v10', 0, 'p0'), T0 + 19000);
    expect(r.state.bays[0]!.closesAt).toBe(T0 + 19000 + 4500);
    expect(r.state.players[0]!.cooldownUntil).toBe(T0 + 19000 + CONFIG.bidCooldownMs);
    const capped = clone(s);
    capped.bays[0]!.closesAt = T0 + 89000;
    expect(act(capped, bid('v10', 0, 'p0'), T0 + 88500).state.bays[0]!.closesAt).toBe(T0 + 90000);
    const idle = clone(s);
    idle.bays.forEach((b, i) => i && (b.closesAt = T0 + 100000));
    const t = idle.bays[0]!.closesAt!;
    expect(engine.tick(idle, t).state.bays[0]!.closesAt).toBe(t + 15000);
    void player;
  });
});

describe('Frenzy full game', () => {
  it('terminates with all bays null, even with no bids at all', () => {
    let s = frenzy().state;
    let guard = 0;
    while (s.stage === 'bidding' && guard++ < 10000)
      s = engine.tick(s, engine.nextDeadline(s)!).state;
    expect(s.stage).toBe('done');
    expect(s.bays.every((b) => b.card === null)).toBe(true);
  });
});
