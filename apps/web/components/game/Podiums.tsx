'use client';
// Desktop-only row of player podiums above the bays (04 section 6): identity (color + shape +
// name), whose turn it is (Classic) or which bays they lead (Frenzy), cards left, and the items
// they have won as small 12x12 sprites at integer scale (24px = 2x). Mounted only at >=1024px.
import { SpriteView } from './Sprite';
import { podiumSplit, type PodiumVM } from '../../lib/game-ui/podiums';

export function Podiums({ players }: { players: PodiumVM[] }) {
  const crowded = players.length >= 5;
  return (
    <ul className="g-pods" aria-label="Players" data-count={players.length}>
      {players.map((p) => {
        const split = podiumSplit(p.wonCount, players.length);
        const shown = p.won.slice(0, split.shown);
        const more = split.more;
        return (
          <li
            key={p.id}
            className="g-pod"
            data-fx="podium"
            data-turn={p.turn ? 'true' : undefined}
            data-me={p.me ? 'true' : undefined}
            data-fresh={p.freshId ? 'true' : undefined}
            style={{ ['--pc' as string]: `var(--p-${p.color})` }}
          >
            <span className="g-pod__head">
              <span className="g-pod__shape" aria-hidden="true">
                {p.shape}
              </span>
              <span className="sr-only">{p.color} </span>
              <span className="g-pod__name" title={p.name}>
                {p.name}
              </span>
              {p.me && <span className="tag">YOU</span>}
              {/* 5-6 podiums: bot names already start with "Bot", so the tag is dropped to let names fit */}
              {p.isBot && !crowded && <span className="tag">BOT</span>}
              {p.away && <span className="tag">AWAY</span>}
            </span>
            <span className="g-pod__body">
              <span className="g-pod__cards">
                <span className="g-pod__big">{p.cardsLeft}</span>
                <span className="g-pod__small">cards left</span>
              </span>
              <span className="g-pod__won">
                <span className="sr-only">
                  {p.wonCount === 0
                    ? 'No items won'
                    : `${p.wonCount} ${p.wonCount === 1 ? 'item' : 'items'} won: ${p.won.map((w) => w.name).join(', ')}`}
                </span>
                <span className="g-pod__row" aria-hidden="true">
                  {shown.length === 0 && <span className="g-pod__small">No items yet</span>}
                  {shown.map((w) => (
                    <span key={w.id} title={w.name} data-new={w.id === p.freshId ? 'true' : undefined}>
                      <SpriteView sprite={w.sprite} size={24} />
                    </span>
                  ))}
                  {more > 0 && <span className="g-pod__more">+{more}</span>}
                </span>
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
