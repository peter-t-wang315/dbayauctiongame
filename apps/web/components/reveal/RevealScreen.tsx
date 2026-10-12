'use client';
// Reveal / results screen (04 section 3.5; 01 R32-R37). Rendered by GameScreen in phases `reveal`
// and `ended`. Cards flip one at a time (my cards first); tap anywhere or Skip to jump to the end.
// Standings show once the sequence is done. Everything is text, so it works with sound and motion off.
import type { PlayerView } from '@dbay/protocol';
import { useRoom } from '../../lib/net/useRoom';
import { categoryEmoji, categoryName, playerById } from '../../lib/game-ui/viewModel';
import { flipCount, giftLines, revealGroups, revealOrder, standings } from '../../lib/reveal/results';
import { useRevealSequence } from '../../lib/reveal/useRevealSequence';
import { PlayerChip } from '../shell/PlayerChip';
import { FlipCard } from './FlipCard';
import { Scoreboard } from './Scoreboard';
import './reveal.css';

export function RevealScreen({ view }: { view: PlayerView }) {
  const room = useRoom();
  const rows = revealOrder(view);
  const { shown, done, skip } = useRevealSequence(flipCount(view), view.phase === 'ended');

  if (!view.reveal) {
    return (
      <main className="page rv" data-phase={view.phase}>
        <h1 className="rv-title">Reveal</h1>
        <p className="hint">Counting up the values...</p>
      </main>
    );
  }

  let flip = 0;
  const gifts = giftLines(view);

  return (
    <main className="page rv" data-phase={view.phase} data-fx="reveal" data-state={done ? 'done' : 'running'}>
      <header className="rv-head">
        <h1 className="rv-title">{done ? 'Results' : 'Reveal'}</h1>
        {!done && (
          <button type="button" className="btn btn--small" onClick={skip}>
            Skip
          </button>
        )}
      </header>

      <div className="rv-list" onClick={done ? undefined : skip}>
        {rows.map((r) => {
          const p = playerById(view, r.id);
          const groups = revealGroups(r);
          const count = groups.reduce((n, g) => n + g.cards.length, 0);
          const playerDone = flip + count <= shown;
          return (
            <section key={r.id} className="rv-player" aria-label={p ? `${p.name}'s items` : 'Items'}>
              <h2 className="rv-player__head">
                {p && <PlayerChip color={p.color} shape={p.shape} name={r.id === view.me ? `${p.name} (you)` : p.name} />}
                <span className="rv-player__total">{playerDone ? `$${r.total.toLocaleString('en-US')}` : '...'}</span>
              </h2>
              {groups.length === 0 && <p className="hint">Empty-handed. Nothing to reveal.</p>}
              {groups.map((g) => (
                <div key={g.category ?? 'none'} className="rv-group" data-category={g.category ?? 'none'}>
                  <h3 className="rv-group__head">
                    {g.category ? (
                      <>
                        <span aria-hidden="true">{categoryEmoji(g.category)}</span> {categoryName(g.category)}
                      </>
                    ) : (
                      'Display Case (no category)'
                    )}
                    {g.doubled && <span className="rv-x2">x2 collection!</span>}
                  </h3>
                  <ul className="rv-cards">
                    {g.cards.map((c) => (
                      <FlipCard key={c.card} card={c} shown={flip++ < shown} doubled={g.doubled} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}

        {gifts.length > 0 && (
          <section className="rv-gifts" aria-label="Gifts">
            <h2>Gifts</h2>
            <ul>
              {gifts.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {done && <Scoreboard rows={standings(view)} me={view.me} />}

      <footer className="rv-actions">
        {/* R37: Rematch is offered as soon as the standings show. */}
        {!done ? null : room.isHost ? (
          <button type="button" className="btn btn--primary" onClick={() => void room.send({ t: 'rematch' })}>
            REMATCH
          </button>
        ) : (
          <p className="hint">Waiting for host to rematch</p>
        )}
        <button type="button" className="btn" onClick={room.leave}>
          Leave
        </button>
      </footer>
    </main>
  );
}
