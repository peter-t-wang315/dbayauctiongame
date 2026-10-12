'use client';
// Gift step (04 section 3.5b): a centered card over the dimmed bays, one Gift at a time.
// SEAM: docs/06 assigns the gift UI to WS6 (components/gift/GiftStep). Until it lands this is the
// stand-in; GameScreen mounts exactly one <GiftOverlay/>, so swapping it is a one-line change.
import { useState } from 'react';
import type { PlayerView } from '@dbay/protocol';
import type { SendResult } from '../../lib/net';
import { PlayerChip } from '../shell/PlayerChip';
import { cardInfo } from '../../lib/game-ui/viewModel';
import { formatClock, remainingMs } from '../../lib/game-ui/timers';

type Gift = NonNullable<PlayerView['gift']>;

export function GiftOverlay({
  view,
  now,
  send,
}: {
  view: PlayerView;
  now: number;
  send: (a: { t: 'gift'; target: string } | { t: 'giftGive'; item: string }) => Promise<SendResult>;
}) {
  const gift = view.gift;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!gift) return null;
  const by = (id: string | undefined) => view.players.find((p) => p.id === id);
  const holder = by(gift.holder);
  const victim = by(gift.victim);
  const left = remainingMs(gift.endsAt, now);

  const act = async (a: Parameters<typeof send>[0]) => {
    setBusy(true);
    setErr(null);
    const r = await send(a);
    setBusy(false);
    if (!r.ok) setErr(`That didn't work (${r.code}). Try again.`);
  };

  return (
    <div className="g-gift-scrim" data-fx="gift-step">
      <section className="g-gift" role="dialog" aria-modal="false" aria-label="Gift">
        <h2>{holder ? `${holder.shape} ${holder.name} opened a Gift!` : 'A Gift was opened!'}</h2>
        {left !== null && <p className="g-gift__clock">{formatClock(left)}</p>}
        <GiftBody gift={gift} view={view} busy={busy} onTarget={(t) => act({ t: 'gift', target: t })} onItem={(i) => act({ t: 'giftGive', item: i })} />
        {gift.remaining > 0 && <p className="hint">{gift.remaining} more Gift{gift.remaining > 1 ? 's' : ''} after this one</p>}
        {err && <p className="error-text">{err}</p>}
        {victim && gift.stage === 'pickItem' && view.me !== gift.victim && (
          <p className="hint">{victim.shape} {victim.name} must give up something...</p>
        )}
      </section>
    </div>
  );
}

function GiftBody({
  gift,
  view,
  busy,
  onTarget,
  onItem,
}: {
  gift: Gift;
  view: PlayerView;
  busy: boolean;
  onTarget: (id: string) => void;
  onItem: (id: string) => void;
}) {
  const me = view.me;
  const holder = view.players.find((p) => p.id === gift.holder);
  if (gift.stage === 'pickTarget') {
    if (gift.holder !== me) return <p>{holder?.name ?? 'The holder'} is choosing...</p>;
    return (
      <>
        <p>Pick a player to take an item from:</p>
        <ul className="g-gift__list">
          {view.players
            .filter((p) => p.id !== me)
            .map((p) => (
              <li key={p.id}>
                <button type="button" className="btn g-gift__pick" disabled={busy || p.collection.length === 0} onClick={() => onTarget(p.id)}>
                  <span aria-hidden="true">{p.shape}</span>
                  <span>{p.name}</span>
                  <span className="hint">{p.collection.length} items</span>
                </button>
              </li>
            ))}
        </ul>
      </>
    );
  }
  if (gift.victim !== me) {
    const v = view.players.find((p) => p.id === gift.victim);
    return <p>{v ? <PlayerChip color={v.color} shape={v.shape} name={v.name} /> : 'Someone'} must give up something...</p>;
  }
  const mine = view.players.find((p) => p.id === me)?.collection ?? [];
  const cards = mine.map(cardInfo).filter((c) => c !== null && c.special !== 'gift');
  return (
    <>
      <p>Choose an item to give away:</p>
      <ul className="g-gift__list">
        {cards.map((c) => (
          <li key={c!.id}>
            <button type="button" className="btn g-gift__pick" disabled={busy} onClick={() => onItem(c!.id)}>
              <span>{c!.name}</span>
              <span className="hint">{c!.est !== null ? `est $${c!.est}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
