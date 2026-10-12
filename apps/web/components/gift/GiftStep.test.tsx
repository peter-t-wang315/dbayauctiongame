import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@dbay/protocol';
import { GiftStep } from './GiftStep';

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

describe('GiftStep (04 section 3.5b)', () => {
  const g = { stage: 'pickTarget' as const, holder: 'a', endsAt: 20_000, remaining: 1 };
  it('holder sees target buttons and the countdown', () => {
    const html = renderToStaticMarkup(createElement(GiftStep, { view: view('a', g), now: 5000, send: noSend }));
    expect(html).toContain('You opened a Gift!');
    expect(html).toContain('Pat');
    expect(html).toContain('0:15');
    expect(html).toContain('1 more Gift');
  });
  it('others only see who is choosing', () => {
    const html = renderToStaticMarkup(createElement(GiftStep, { view: view('b', g), now: 5000, send: noSend }));
    expect(html).toContain('is choosing...');
    expect(html).not.toContain('g-gift__pick');
  });
  it('victim sees own scorable items, never Gift cards', () => {
    const v = view('b', { stage: 'pickItem', holder: 'a', victim: 'b', endsAt: 20_000, remaining: 0 });
    const html = renderToStaticMarkup(createElement(GiftStep, { view: v, now: 5000, send: noSend }));
    expect(html).toContain('Fuzzy Pink Snake');
    expect(html).toContain('est $40');
    expect(html).not.toContain('Gift</span>');
  });
  it('disables targets with nothing scorable (R29)', () => {
    const v = view('a', g);
    v.players[1]!.collection = ['special-gift-1'];
    const html = renderToStaticMarkup(createElement(GiftStep, { view: v, now: 5000, send: noSend }));
    expect(html).toContain('nothing to take');
    expect(html).toContain('disabled');
  });
});

