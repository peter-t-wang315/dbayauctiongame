'use client';
// Desktop-only row of player podiums above the bays (04 section 6): identity (color + shape +
// name), whose turn it is (Classic) or which bays they lead (Frenzy), cards left, and the items
// they have won as small 12x12 sprites at integer scale (24px = 2x). Mounted only at >=1024px.
import { SpriteView } from './Sprite';
import type { PodiumVM } from '../../lib/game-ui/podiums';

const MAX_SPRITES = 6;

export function Podiums({ players }: { players: PodiumVM[] }) {
  return (
    <ul className="g-pods" aria-label="Players" data-count={players.length}>
      {players.map((p) => {
        const shown = p.won.slice(0, MAX_SPRITES);
        const more = p.wonCount - shown.length;
        return (
          <li
            key={p.id}
            className="g-pod"
            data-fx="podium"
            data-turn={p.turn ? 'true' : undefined}
            data-me={p.me ? 'true' : undefined}
            style={{ ['--pc' as string]: `var(--p-${p.color})` }}
          >
            <span className="g-pod__head">
              <span className="g-pod__shape" aria-hidden="true">
                {p.shape}
              </span>
              <span className="sr-only">{p.color} </span>
              <span className="g-pod__name">{p.name}</span>
              {p.me && <span className="tag">YOU</span>}
              {p.isBot && <span className="tag">BOT</span>}
              {p.away && <span className="tag">AWAY</span>}
            </span>
            <span className="g-pod__body">
              <span className="g-pod__cards">
                <span className="g-pod__big">{p.cardsLeft}</span>
                <span className="g-pod__small">cards left</span>
              </span>
              <span className="g-pod__won" aria-label={`${p.wonCount} items won`}>
                {shown.length === 0 && <span className="g-pod__small">No items yet</span>}
                {shown.map((w) => (
                  <span key={w.id} title={w.name}>
                    <SpriteView sprite={w.sprite} size={24} />
                  </span>
                ))}
                {more > 0 && <span className="g-pod__small">+{more}</span>}
              </span>
            </span>
            <span className="g-pod__live">
              {p.turn ? (
                <b className="g-pod__now">{p.me ? 'YOUR TURN' : 'BIDDING NOW'}</b>
              ) : p.leading.length > 0 ? (
                <span>Leads {p.leading.join(', ')}</span>
              ) : (
                <span className="g-pod__small">{p.wonCount} won</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
