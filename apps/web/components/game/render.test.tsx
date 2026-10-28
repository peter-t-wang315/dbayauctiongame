import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CATEGORY_SPRITES } from '@dbay/content/public';
import { Hand } from './Hand';
import { StatusStrip } from './StatusStrip';
import { spriteRuns } from './Sprite';
import { handSlots } from '../../lib/game-ui/viewModel';

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

describe('StatusStrip (merged HUD)', () => {
  const base = {
    text: 'Your turn, Sam! Pick a card.',
    title: 'Your turn',
    mine: true,
    color: 'red',
    remaining: 2000,
    barTotal: 10000,
    showClock: true,
    canPass: true,
    progress: { now: 0, max: 0, fraction: 0, label: null },
    showMenu: true,
    onPass: () => {},
    onOpenLog: () => {},
    onOpenMenu: () => {},
  };
  it('shows turn, big clock, Pass and one polite live region; danger only in the last 3s', () => {
    const html = renderToStaticMarkup(createElement(StatusStrip, base));
    expect(html).toContain('Your turn');
    expect(html).toContain('0:02');
    expect(html).toContain('>Pass<');
    expect(html).toContain('data-danger="true"');
    expect((html.match(/aria-live="polite"/g) ?? []).length).toBe(1);
    const calm = renderToStaticMarkup(createElement(StatusStrip, { ...base, remaining: 9000 }));
    expect(calm).not.toContain('data-danger');
  });
  it('Frenzy: no global numeric clock', () => {
    const html = renderToStaticMarkup(
      createElement(StatusStrip, { ...base, showClock: false, canPass: false, title: 'FRENZY', mine: false }),
    );
    expect(html).not.toContain('turn-clock');
    expect(html).toContain('FRENZY');
  });
});
