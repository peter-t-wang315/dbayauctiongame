'use client';
import { useEffect, useMemo, useRef, type PointerEvent as RPointerEvent } from 'react';
// One auction bay (04 section 4.2, 11, 12, 14). `layout` row = stacked full-width, tile = 2x2.
// Status label row replaces itself (BAY n / OUTBID! / WINNING); the only overlay is the SOLD stamp.
import type { PlayerView } from '@dbay/protocol';
import { PlayerChip } from '../shell/PlayerChip';
import { SpriteView } from './Sprite';
import { categoryEmoji, categoryShort, type BayVM } from '../../lib/game-ui/viewModel';
import { barFraction, formatClock, isDanger } from '../../lib/game-ui/timers';
import { useExtended } from '../../lib/game-ui/hooks';
import { createLongPress } from '../../lib/game-ui/longPress';

export type Hint = { kind: 'none' } | { kind: 'legal' } | { kind: 'illegal'; reason: string };
type PlayerInfo = PlayerView['players'][number];

export interface BayProps {
  vm: BayVM;
  layout: 'row' | 'tile';
  showTimer: boolean;
  hint: Hint;
  /** A card is selected (bays become bid targets). */
  armed: boolean;
  me: PlayerInfo | undefined;
  /** ms left on the bay timer (Frenzy), null if none. */
  remaining: number | null;
  barTotal: number;
  outbid: boolean;
  sold: { by: PlayerInfo | undefined; amount: number | 'proxy' | undefined } | null;
  /** Optimistic: my bid is in flight for this bay. */
  sending: string | null;
  nudge: boolean;
  keyHint?: string;
  onTap: () => void;
  /** Open the item-details sheet (long-press, right-click, or the keyboard/screen-reader button). */
  onDetails: () => void;
}

export function Bay(p: BayProps) {
  const { vm, layout, hint } = p;
  const card = vm.card;
  const extended = useExtended(card?.id ?? 'none', vm.endsAt);
  const danger = isDanger(p.remaining);
  const winning = vm.mine && !p.sending;
  const state = p.sold
    ? 'sold'
    : !card
      ? 'empty'
      : p.outbid
        ? 'outbid'
        : winning
          ? 'winning'
          : hint.kind === 'legal'
            ? 'legal'
            : hint.kind === 'illegal'
              ? 'illegal'
              : 'open';
  const spriteSize = layout === 'row' ? (p.showTimer ? 64 : 72) : p.showTimer ? 44 : 52;
  const label = `Bay ${vm.letter}`;
  const aria = card
    ? `${label}: ${card.name}${card.est ? `, estimate $${card.est}` : ''}. ${
        vm.topLabel ? `Top bid ${vm.topLabel} by ${vm.topBy?.name ?? 'someone'}.` : 'No bids.'
      }${state === 'winning' ? " You're winning." : ''}${
        state === 'outbid' ? ' You were outbid.' : ''
      }${hint.kind === 'illegal' ? ` Can't bid: ${hint.reason}.` : ''}${hint.kind === 'legal' ? ' Tap to bid.' : ''}`
    : `${label}: empty`;

  // Long-press opens details; the click that follows a fired long-press is swallowed (never bids).
  // Time-boxed so a stray flag can never eat a later keyboard/screen-reader click.
  const swallowUntil = useRef(0);
  const detailsRef = useRef(p.onDetails);
  detailsRef.current = p.onDetails;
  const press = useMemo(() => createLongPress(() => detailsRef.current()), []);
  useEffect(() => () => press.cancel(), [press]);
  const down = (e: RPointerEvent) => {
    swallowUntil.current = 0;
    if (e.button === 0 && card) press.down(e.clientX, e.clientY);
  };
  const up = () => {
    if (press.up()) swallowUntil.current = performance.now() + 700;
  };

  return (
    <div className="g-bayw">
      <button
        type="button"
        className={`g-bay g-bay--${layout}`}
        data-fx="bay"
        data-state={state}
        data-bay={vm.idx}
        data-nudge={p.nudge ? 'true' : undefined}
        style={p.me ? { ['--me' as string]: `var(--p-${p.me.color})` } : undefined}
        aria-label={aria}
        aria-disabled={!p.armed || !card}
        onPointerDown={down}
        onPointerMove={(e) => press.move(e.clientX, e.clientY)}
        onPointerUp={up}
        onPointerCancel={() => press.cancel()}
        onPointerLeave={() => press.cancel()}
        onContextMenu={(e) => {
          e.preventDefault();
          if (card) p.onDetails();
        }}
        onClick={(e) => {
          if (performance.now() < swallowUntil.current) {
            swallowUntil.current = 0;
            e.preventDefault();
            return;
          }
          p.onTap();
        }}
        title={card ? `${card.name}${card.flavor ? ` - ${card.flavor}` : ''}` : undefined}
      >
        <span className="g-bay__head">
          {state === 'winning' ? (
            <span className="g-pill g-pill--win" data-fx="winning-pill">
              <span aria-hidden="true">✓</span> {layout === 'tile' ? 'WINNING' : "You're winning"}
            </span>
          ) : state === 'outbid' ? (
            <span className="g-pill g-pill--out" data-fx="outbid-pill">
              OUTBID!
            </span>
          ) : (
            <span className="g-bay__label">BAY {vm.letter}</span>
          )}
          {card?.category && (
            <span className="g-cat" style={{ ['--cat' as string]: `var(--cat-${card.category})` }}>
              <span aria-hidden="true">{categoryEmoji(card.category)}</span>
              <span className="g-cat__label">{categoryShort(card.category)}</span>
            </span>
          )}
          {card?.special && (
            <span className="g-cat g-cat--special">
              {card.special === 'gift' ? 'GIFT' : 'WILD'}
            </span>
          )}
          {hint.kind === 'legal' && state === 'legal' && (
            <span className="g-hint g-hint--ok">tap to bid</span>
          )}
          {hint.kind === 'illegal' && (
            <span className="g-hint g-hint--no" data-fx="reason">
              {hint.reason}
            </span>
          )}
        </span>

        {card ? (
          <>
            <span className="g-bay__body">
              <SpriteView sprite={card.sprite} size={spriteSize} />
              <span className="g-bay__text">
                <span className="g-bay__name">{card.name}</span>
                {card.est !== null && !card.special && (
                  <span className="g-bay__est">est ${card.est}</span>
                )}
                {card.special === 'displayCase' && <span className="g-bay__est">$100 wild</span>}
              </span>
            </span>
            <span className="g-bay__bid">
              {vm.topLabel ? (
                <span className="g-bay__amount" data-fx="top-bid">
                  {vm.topLabel}
                </span>
              ) : (
                <span className="g-bay__none">No bids</span>
              )}
              {vm.topBy && (
                <PlayerChip color={vm.topBy.color} shape={vm.topBy.shape} name={vm.topBy.name} />
              )}
              {p.sending && (
                <span className="g-sending" data-fx="sending">
                  sending {p.sending}
                </span>
              )}
            </span>
            {p.showTimer && (
              <span className="g-bay__timer" data-danger={danger ? 'true' : undefined}>
                <span className="g-bar" aria-hidden="true">
                  <span
                    className="g-bar__fill"
                    style={{ width: `${barFraction(p.remaining, p.barTotal) * 100}%` }}
                  />
                </span>
                <span className="g-bay__clock" data-fx="bay-timer">
                  {extended && <span className="g-plus3">+3s </span>}
                  {p.remaining === null ? '--' : formatClock(p.remaining)}
                </span>
              </span>
            )}
          </>
        ) : (
          <span className="g-bay__empty">Empty bay</span>
        )}

        {p.keyHint && (
          <kbd className="g-kbd" aria-hidden="true">
            {p.keyHint}
          </kbd>
        )}
        {p.sold && (
          <span className="g-sold" data-fx="sold-stamp" aria-hidden="true">
            SOLD
            <span className="g-sold__who">
              {p.sold.by ? `${p.sold.by.shape} ${p.sold.by.name}` : ''}
              {p.sold.amount !== undefined
                ? ` · ${p.sold.amount === 'proxy' ? 'Proxy' : `$${p.sold.amount}`}`
                : ''}
            </span>
          </span>
        )}
      </button>
      {card && (
        <button
          type="button"
          className="g-info"
          onClick={p.onDetails}
          aria-label={`Item details: ${card.name}, bay ${vm.letter}`}
        >
          <span aria-hidden="true">i</span>
        </button>
      )}
    </div>
  );
}
