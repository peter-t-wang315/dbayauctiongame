'use client';
// Gift step (04 section 3.5b; 01 R28-R31): a centered card over the dimmed bays, one Gift at a time.
// Mounted once by the WS5 game route while `stage === 'gifts'`. Values stay hidden: only estimates show.
import { useState } from 'react';
import type { PlayerView } from '@dbay/protocol';
import type { SendResult } from '../../lib/net';
import { PlayerChip } from '../shell/PlayerChip';
import { cardInfo, playerById } from '../../lib/game-ui/viewModel';
import { formatClock, remainingMs } from '../../lib/game-ui/timers';
import './gift.css';

type Gift = NonNullable<PlayerView['gift']>;
export type GiftAction = { t: 'gift'; target: string } | { t: 'giftGive'; item: string };

/** R29/R30: scorable = items and Display Cases, never Gifts. */
export function scorableCards(collection: readonly string[]) {
  return collection.map(cardInfo).filter((c) => c !== null && c.special !== 'gift').map((c) => c!);
}

export function GiftStep({
  view,
  now,
  send,
}: {
  view: PlayerView;
  now: number;
  send: (a: GiftAction) => Promise<SendResult>;
}) {
  const gift = view.gift;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!gift) return null;
  const holder = playerById(view, gift.holder);
  const left = remainingMs(gift.endsAt, now);

  const act = async (a: GiftAction) => {
    setBusy(true);
    setErr(null);
    const r = await send(a);
    setBusy(false);
    if (!r.ok) setErr(`That didn't work (${r.code}). Try again.`);
  };

  return (
    <div className="g-gift-scrim" data-fx="gift-step" data-state={gift.stage}>
      <section className="g-gift" role="dialog" aria-modal="false" aria-labelledby="g-gift-title">
        <h2 id="g-gift-title">
          {holder ? `${holder.shape} ${holder.id === view.me ? 'You' : holder.name} opened a Gift!` : 'A Gift was opened!'}
        </h2>
        {left !== null && (
          <p className="g-gift__clock" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
            {formatClock(left)}
          </p>
        )}
        <GiftBody gift={gift} view={view} busy={busy} onAct={act} />
        {gift.remaining > 0 && (
          <p className="hint">
            {gift.remaining} more Gift{gift.remaining > 1 ? 's' : ''} after this one
          </p>
        )}
        {err && <p className="error-text">{err}</p>}
      </section>
    </div>
  );
}

function GiftBody({ gift, view, busy, onAct }: { gift: Gift; view: PlayerView; busy: boolean; onAct: (a: GiftAction) => void }) {
  const me = view.me;
  if (gift.stage === 'pickTarget') {
    if (gift.holder !== me) {
      const h = playerById(view, gift.holder);
      return <p>{h ? <PlayerChip color={h.color} shape={h.shape} name={h.name} /> : 'The holder'} is choosing...</p>;
    }
    return (
      <>
        <p>Pick a player to take an item from:</p>
        <ul className="g-gift__list">
          {view.players
            .filter((p) => p.id !== me)
            .map((p) => {
              const n = scorableCards(p.collection).length;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className="btn g-gift__pick"
                    disabled={busy || n === 0}
                    onClick={() => onAct({ t: 'gift', target: p.id })}
                  >
                    <PlayerChip color={p.color} shape={p.shape} name={p.name} />
                    <span className="hint">{n === 0 ? 'nothing to take' : `${n} item${n > 1 ? 's' : ''}`}</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </>
    );
  }
  if (gift.victim !== me) {
    const v = playerById(view, gift.victim);
    return <p>{v ? <PlayerChip color={v.color} shape={v.shape} name={v.name} /> : 'Someone'} must give up something...</p>;
  }
  const mine = scorableCards(playerById(view, me)?.collection ?? []);
  return (
    <>
      <p>Choose an item to give away:</p>
      <ul className="g-gift__list">
        {mine.map((c) => (
          <li key={c.id}>
            <button type="button" className="btn g-gift__pick" disabled={busy} onClick={() => onAct({ t: 'giftGive', item: c.id })}>
              <span>{c.name}</span>
              <span className="hint">{c.special === 'displayCase' ? '$100 wild' : c.est !== null ? `est $${c.est}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
