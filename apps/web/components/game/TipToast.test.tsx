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
