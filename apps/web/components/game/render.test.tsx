import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { CATEGORY_SPRITES } from '@dbay/content/public';
import { GiftOverlay } from './GiftOverlay';
import { Hand } from './Hand';
import { spriteRuns } from './Sprite';
import { handSlots } from '../../lib/game-ui/viewModel';

function view(me: string, gift: NonNullable<PlayerView['gift']>): PlayerView {
  const p = (id: string, name: string, color: PlayerView['players'][number]['color'], shape: string, collection: string[]) => ({
    id,
    name,
    color,
    shape,
    connected: true,
    isBot: false,
    cardsInHand: 5,
    collection,
    gifts: 0,
  });
  return {
    code: 'ABCDE',
    phase: 'playing',
    stage: 'gifts',
    opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
    me,
    hostId: 'a',
    myHand: [],
    canAct: false,
    players: [
      p('a', 'Sam', 'red', '●', ['toys-tin-robot']),
      p('b', 'Pat', 'blue', '▲', ['toys-pink-snake', 'special-gift-1']),
    ],
    bays: [],
    round: { n: 8, of: 8, halfway: true, last: true },
    deckLeft: 0,
    log: [],
    gift,
  };
}

const noSend = () => Promise.resolve({ ok: true } as const);

describe('GiftOverlay (04 section 3.5b)', () => {
  const g = { stage: 'pickTarget' as const, holder: 'a', endsAt: 20_000, remaining: 1 };
  it('holder sees target buttons and the countdown', () => {
    const html = renderToStaticMarkup(createElement(GiftOverlay, { view: view('a', g), now: 5000, send: noSend }));
    expect(html).toContain('Sam opened a Gift!');
    expect(html).toContain('Pat');
    expect(html).toContain('0:15');
    expect(html).toContain('1 more Gift');
  });
  it('others only see who is choosing', () => {
    const html = renderToStaticMarkup(createElement(GiftOverlay, { view: view('b', g), now: 5000, send: noSend }));
    expect(html).toContain('is choosing...');
    expect(html).not.toContain('g-gift__pick');
  });
  it('victim sees own scorable items, never Gift cards', () => {
    const v = view('b', { stage: 'pickItem', holder: 'a', victim: 'b', endsAt: 20_000, remaining: 0 });
    const html = renderToStaticMarkup(createElement(GiftOverlay, { view: v, now: 5000, send: noSend }));
    expect(html).toContain('Fuzzy Pink Snake');
    expect(html).toContain('est $40');
    expect(html).not.toContain('Gift</span>');
  });
});

describe('Hand', () => {
  it('spent cards are aria-disabled and not focusable; selected is pressed', () => {
    const slots = handSlots([{ id: 'v10', kind: 'value', value: 10 }]);
    const html = renderToStaticMarkup(
      createElement(Hand, { slots, selected: 'v10', locked: false, shake: null, keyHints: { v10: '1' }, onTap: () => {} }),
    );
    expect((html.match(/data-fx="hand-card"/g) ?? []).length).toBe(12);
    expect(html).toContain('aria-label="$10 card"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="$25 card, spent"');
    expect(html).toContain('tabindex="-1"');
  });
});

describe('spriteRuns', () => {
  it('merges horizontal runs and skips transparent pixels', () => {
    const runs = spriteRuns({ rows: ['kkk.kk......', ...Array(11).fill('............')] });
    expect(runs).toEqual([
      { x: 0, y: 0, w: 3, fill: '#0E1511' },
      { x: 4, y: 0, w: 2, fill: '#0E1511' },
    ]);
  });
  it('category sprites render something', () => {
    expect(spriteRuns(CATEGORY_SPRITES.toys).length).toBeGreaterThan(5);
  });
});
