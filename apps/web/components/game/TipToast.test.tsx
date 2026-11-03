import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { CollectionStrip } from './Collections';
import { TipToast } from './TipToast';
import { summarizeCollection } from '../../lib/game-ui/viewModel';

const view = {
  code: 'ABCDE',
  phase: 'playing',
  stage: 'bidding',
  opts: { mode: 'classic', relaxed: false, bidWindowMs: 5000 },
  me: 'me',
  hostId: 'me',
  myHand: [],
  canAct: true,
  players: [],
  bays: [],
  turn: { player: 'me', color: 'red', endsAt: 1, phase: 'window' },
  round: { n: 1, of: 8, halfway: false, last: false },
  deckLeft: 10,
  log: [],
} satisfies PlayerView;

describe('TipToast', () => {
  it('server render: polite live region present and empty, no toast until storage is read', () => {
    const html = renderToStaticMarkup(createElement(TipToast, { view, selectedProxy: false }));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('data-fx="tip"');
  });
});

describe('SETS strip', () => {
  it('always shows the "3 = x2" reminder and says it to screen readers', () => {
    const html = renderToStaticMarkup(
      createElement(CollectionStrip, { summary: summarizeCollection(['toys-pink-snake']), onOpen: () => {} }),
    );
    expect(html).toContain('3 = x2');
    expect(html).toContain('3 of a kind scores x2.');
  });
});

describe('SETS strip: wild and win cue', () => {
  const strip = (cards: string[], win = null as import('../../lib/game-ui/win').WinCue | null) =>
    renderToStaticMarkup(createElement(CollectionStrip, { summary: summarizeCollection(cards), onOpen: () => {}, win }));
  it('P7: shows the Display Case and the set it joins; nothing when there is none', () => {
    const html = strip(['special-display-case-1', 'toys-pink-snake', 'toys-bean-bag-bear']);
    expect(html).toContain('data-fx="sets-wild"');
    expect(html).toMatch(/WILD[^<]*Toys/);
    expect(html).toContain('joins Toys at the end');
    expect(strip(['toys-pink-snake'])).not.toContain('sets-wild');
  });
  it('P1: the set holding my new item is marked NEW', () => {
    const win = { n: 1, card: 'toys-pink-snake', name: 'Pink Snake', category: 'toys' as const, special: null, text: 'You won Pink Snake!' };
    const html = strip(['toys-pink-snake'], win);
    expect(html).toContain('data-new="true"');
    expect(html).toContain('>NEW<');
    expect(html).toContain('New: Pink Snake.');
    expect(strip(['toys-pink-snake'])).not.toContain('>NEW<');
  });
});
