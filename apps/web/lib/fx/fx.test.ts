import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { crossedSecond, deriveFx } from './events';
import { parseSettings } from './settings';
import { patternFor } from './haptics';
import { pickSfx, sfxFor } from './plan';
import { SFX } from './sfx';
import { centre, flyCard } from './fly';

describe('flyCard', () => {
  it('centres a rect and is a no-op without elements', () => {
    expect(centre({ left: 10, top: 20, width: 40, height: 20 })).toEqual({ x: 30, y: 30 });
    expect(() => flyCard(null, null, '$10')).not.toThrow();
  });
});

type Bay = PlayerView['bays'][number];
const bay = (idx: number, card: string | null, top: { by: string; value?: number } | null): Bay =>
  ({ idx, card, stack: [], topBid: top ? { by: top.by, kind: 'value', value: top.value ?? 100 } : null }) as unknown as Bay;

function view(over: Partial<PlayerView> = {}): PlayerView {
  return {
    phase: 'playing',
    stage: 'bidding',
    me: 'me',
    bays: [bay(0, 'a1', null), bay(1, 'a2', null)],
    log: [],
    round: { n: 1, of: 10, halfway: false, last: false },
    ...over,
  } as unknown as PlayerView;
}
const log = (n: number, kind: string, extra: object = {}) => ({ n, kind, ...extra });

describe('deriveFx', () => {
  it('yields nothing without a previous snapshot', () => {
    expect(deriveFx(null, view({ bays: [bay(0, 'a1', { by: 'x' })] }))).toEqual([]);
  });

  it('bid bump on a new top bid, mine or not', () => {
    const prev = view();
    expect(deriveFx(prev, view({ bays: [bay(0, 'a1', { by: 'x' }), bay(1, 'a2', null)] }))).toEqual([
      { t: 'bump', bay: 0, mine: false },
    ]);
    expect(deriveFx(prev, view({ bays: [bay(0, 'a1', { by: 'me' }), bay(1, 'a2', null)] }))).toEqual([
      { t: 'bump', bay: 0, mine: true },
    ]);
  });

  it('no bump when nothing changed or the bay was refilled', () => {
    const a = view({ bays: [bay(0, 'a1', { by: 'x', value: 50 })] });
    expect(deriveFx(a, view({ bays: [bay(0, 'a1', { by: 'x', value: 50 })] }))).toEqual([]);
    expect(deriveFx(a, view({ bays: [bay(0, 'a9', { by: 'x', value: 50 })] }))).toEqual([]);
    expect(deriveFx(a, view({ bays: [bay(0, 'a1', null)] }))).toEqual([]);
  });

  it('outbid when I was top and someone else now is, on the same card', () => {
    const prev = view({ bays: [bay(0, 'a1', { by: 'me' })] });
    const next = view({ bays: [bay(0, 'a1', { by: 'x', value: 200 })] });
    expect(deriveFx(prev, next)).toEqual([
      { t: 'bump', bay: 0, mine: false },
      { t: 'outbid', bay: 0 },
    ]);
    // the card was sold and replaced: not an outbid
    expect(deriveFx(prev, view({ bays: [bay(0, 'zz', { by: 'x' })] }))).toEqual([]);
  });

  it('your turn only on the transition into my window (or a new round)', () => {
    const other = view({ turn: { player: 'x', color: 'red', phase: 'window' } });
    const mine = view({ turn: { player: 'me', color: 'blue', phase: 'window' } });
    expect(deriveFx(other, mine)).toEqual([{ t: 'yourTurn' }]);
    expect(deriveFx(mine, mine)).toEqual([]);
    const gap = view({ turn: { player: 'me', color: 'blue', phase: 'gap' } });
    expect(deriveFx(other, gap)).toEqual([]);
    const nextRound = view({ turn: { player: 'me', color: 'blue', phase: 'window' }, round: { n: 2, of: 10, halfway: false, last: false } });
    expect(deriveFx(mine, nextRound)).toEqual([{ t: 'yourTurn' }]);
  });

  it('log-driven events fire once for new entries only', () => {
    const prev = view({ log: [log(1, 'bid')] as never });
    const next = view({
      log: [
        log(1, 'bid'),
        log(2, 'sold', { by: 'me', bay: 1 }),
        log(3, 'collection', { by: 'x' }),
        log(4, 'extended'),
        log(5, 'halfway'),
      ] as never,
    });
    expect(deriveFx(prev, next)).toEqual([
      { t: 'sold', bay: 1, mine: true },
      { t: 'collection', mine: false },
      { t: 'extended' },
      { t: 'gong' },
    ]);
    expect(deriveFx(next, next)).toEqual([]);
  });

  it('reveal fires on leaving playing', () => {
    expect(deriveFx(view(), view({ phase: 'reveal' }))).toEqual([{ t: 'reveal' }]);
    expect(deriveFx(view({ phase: 'reveal' }), view({ phase: 'ended' }))).toEqual([]);
  });
});

describe('crossedSecond', () => {
  it('ticks once per whole second in the last 3s', () => {
    expect(crossedSecond(3200, 2900)).toBe(true);
    expect(crossedSecond(2900, 2800)).toBe(false);
    expect(crossedSecond(1100, 900)).toBe(true);
    expect(crossedSecond(5200, 4900)).toBe(false);
    expect(crossedSecond(null, 2000)).toBe(false);
    expect(crossedSecond(500, 0)).toBe(false);
  });
});

describe('settings and plans', () => {
  it('sound is off by default and bad storage falls back', () => {
    expect(parseSettings(null)).toEqual({ sound: false, haptics: true });
    expect(parseSettings('{oops')).toEqual({ sound: false, haptics: true });
    expect(parseSettings('{"sound":true}')).toEqual({ sound: true, haptics: true });
  });
  it('haptics only for your turn, outbid and my sale', () => {
    expect(patternFor({ t: 'yourTurn' })).toEqual([40]);
    expect(patternFor({ t: 'outbid', bay: 0 })).toEqual([30, 40, 30]);
    expect(patternFor({ t: 'sold', bay: 0, mine: true })).not.toBeNull();
    expect(patternFor({ t: 'sold', bay: 0, mine: false })).toBeNull();
    expect(patternFor({ t: 'bump', bay: 0, mine: true })).toBeNull();
  });
  it('every event maps to a sound or deliberate silence', () => {
    expect(sfxFor({ t: 'bump', bay: 0, mine: true })).toBe('chirp');
    expect(sfxFor({ t: 'bump', bay: 0, mine: false })).toBe('tok');
    expect(sfxFor({ t: 'reveal' })).toBeNull();
    expect(sfxFor({ t: 'sold', bay: 0, mine: false })).toBe('gavel');
    expect(sfxFor({ t: 'sold', bay: 0, mine: true })).toBe('gavelWon');
    expect(sfxFor({ t: 'outbid', bay: 0 })).toBe('sting');
  });
});

describe('pickSfx (sale moment: the important sound always plays)', () => {
  it('outbid sting replaces the tok on the same bay and beats other bumps under the cap', () => {
    const ev = [
      { t: 'bump', bay: 1, mine: true },
      { t: 'bump', bay: 0, mine: false },
      { t: 'outbid', bay: 0 },
    ] as const;
    expect(pickSfx(ev, 2)).toEqual(['sting', 'chirp']);
    expect(pickSfx(ev, 1)).toEqual(['sting']);
  });
  it('a sale beats a bid tok; my win replaces other gavels; repeats collapse', () => {
    expect(
      pickSfx(
        [
          { t: 'bump', bay: 2, mine: false },
          { t: 'sold', bay: 0, mine: false },
        ],
        1,
      ),
    ).toEqual(['gavel']);
    expect(
      pickSfx(
        [
          { t: 'sold', bay: 0, mine: false },
          { t: 'sold', bay: 1, mine: true },
          { t: 'sold', bay: 2, mine: false },
          { t: 'collection', mine: true },
        ],
        2,
      ),
    ).toEqual(['gavelWon', 'fanfare']);
    expect(pickSfx([{ t: 'reveal' }], 2)).toEqual([]);
    expect(pickSfx([{ t: 'sold', bay: 0, mine: false }], 0)).toEqual([]);
  });
});

describe('synth recipes', () => {
  it('gavel, gavelWon and sting are short WebAudio voices (no assets)', () => {
    for (const n of ['gavel', 'gavelWon', 'sting'] as const) {
      const end = Math.max(...SFX[n].map((v) => v.at + v.dur));
      expect(end).toBeLessThan(1);
      expect(SFX[n].every((v) => v.gain > 0 && v.gain <= 0.5)).toBe(true);
    }
    // Noise voices must fit the 0.2s shared noise buffer (audio.ts).
    expect(Object.values(SFX).flat().filter((v) => v.wave === 'noise').every((v) => v.dur <= 0.2)).toBe(true);
  });
});
