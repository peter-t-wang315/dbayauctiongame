import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CATEGORY_SPRITES } from '@dbay/content/public';
import { Hand } from './Hand';
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
