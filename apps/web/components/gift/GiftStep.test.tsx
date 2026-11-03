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
  it('holder is asked who has to give them an item (B3, R29)', () => {
    const html = renderToStaticMarkup(createElement(GiftStep, { view: view('a', g), now: 5000, send: noSend }));
    expect(html).toContain('Pick who has to give you an item');
  });
  it('others only see who is choosing', () => {
    const html = renderToStaticMarkup(createElement(GiftStep, { view: view('b', g), now: 5000, send: noSend }));
    expect(html).toContain('Sam opened a Gift!');
    expect(html).toContain('is choosing who has to give them an item...');
    expect(html).not.toContain('g-gift__pick');
  });
  const picked = { stage: 'pickItem' as const, holder: 'a', victim: 'b', endsAt: 20_000, remaining: 0 };
  it('victim sees own scorable items, never Gift cards', () => {
    const html = renderToStaticMarkup(createElement(GiftStep, { view: view('b', picked), now: 5000, send: noSend }));
    expect(html).toContain('Fuzzy Pink Snake');
    expect(html).toContain('est $40');
    expect(html).not.toContain('Gift</span>');
  });
  it('victim is told whose Gift picked them and who receives the item (B3, R30)', () => {
    const html = renderToStaticMarkup(createElement(GiftStep, { view: view('b', picked), now: 5000, send: noSend }));
    expect(html).toContain('Sam&#x27;s Gift picked you!');
    expect(html).toMatch(/Give .*Sam.* one of your items/);
    expect(html).not.toContain('opened a Gift');
  });
  it('holder and onlookers see who gives to whom', () => {
    const holder = renderToStaticMarkup(createElement(GiftStep, { view: view('a', picked), now: 5000, send: noSend }));
    expect(holder).toMatch(/Pat.* is giving you an item/);
    const v = view('c', picked);
    v.players.push({ ...v.players[0]!, id: 'c', name: 'Lee', color: 'yellow', shape: '■', collection: [] });
    const other = renderToStaticMarkup(createElement(GiftStep, { view: v, now: 5000, send: noSend }));
    expect(other).toMatch(/Pat.* is giving .*Sam.* an item/);
  });
  it('disables targets with nothing scorable (R29)', () => {
    const v = view('a', g);
    v.players[1]!.collection = ['special-gift-1'];
    const html = renderToStaticMarkup(createElement(GiftStep, { view: v, now: 5000, send: noSend }));
    expect(html).toContain('nothing to take');
    expect(html).toContain('disabled');
  });
});

