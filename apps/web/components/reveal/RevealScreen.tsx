'use client';
// Reveal / results screen (04 section 3.5; 01 R32-R37). Rendered by GameScreen in phases `reveal`
// and `ended`. Cards flip one at a time (my cards first); tap anywhere or Skip to jump to the end.
// Standings show once the sequence is done. Everything is text, so it works with sound and motion off.
import { useEffect } from 'react';
import type { PlayerView } from '@dbay/protocol';
import { useDesktop } from '../../lib/game-ui/useDesktop';
import { useRoom } from '../../lib/net/useRoom';
import { categoryEmoji, categoryName, playerById } from '../../lib/game-ui/viewModel';
import { flipCount, giftLines, progressRows, rankedRows, revealGroups, revealOrder, standings } from '../../lib/reveal/results';
import { useRevealSequence } from '../../lib/reveal/useRevealSequence';
import { PlayerChip } from '../shell/PlayerChip';
import { FlipCard } from './FlipCard';
import { RevealLegend, RevealProgress } from './RevealRail';
import { Scoreboard } from './Scoreboard';
import './reveal.css';

export function RevealScreen({ view }: { view: PlayerView }) {
  const room = useRoom();
  const { send } = room;
  const { shown, done, skip } = useRevealSequence(flipCount(view), view.phase === 'ended');
  // While flipping: me first. Once done: final standing order, winner on top (ties share the crown).
  const desktop = useDesktop();
  const canRematch = done && room.isHost;

  // Desktop keys (04 section 6): Space/Enter skip, R rematch (host). Never steal keys from controls.
  useEffect(() => {
    if (!desktop) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(t.tagName)) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === ' ' || e.key === 'Enter') && !done) {
        e.preventDefault();
        skip();
      } else if ((e.key === 'r' || e.key === 'R') && canRematch) {
        void send({ t: 'rematch' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [desktop, done, canRematch, skip, send]);

  const rows = done ? rankedRows(view) : revealOrder(view).map((row) => ({ row, rank: 0 }));

  if (!view.reveal) {
    return (
      <main className="page rv" data-phase={view.phase}>
        <h1 className="rv-title">Reveal</h1>
        <p className="hint">Counting up the values...</p>
      </main>
    );
  }

  const actions = (
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
  );

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

      {desktop ? (
        <aside className="rv-rail">
          {done ? <Scoreboard rows={standings(view)} me={view.me} /> : <RevealProgress rows={progressRows(view, shown)} me={view.me} />}
          {actions}
        </aside>
      ) : (
        done && <Scoreboard rows={standings(view)} me={view.me} />
      )}

      <div className="rv-list" onClick={done ? undefined : skip}>
        {rows.map(({ row: r, rank }) => {
          const p = playerById(view, r.id);
          const winner = done && rank === 1;
          const groups = revealGroups(r);
          const count = groups.reduce((n, g) => n + g.cards.length, 0);
          const playerDone = flip + count <= shown;
          return (
            <section
              key={r.id}
              className="rv-player"
              data-winner={winner ? 'true' : undefined}
              aria-label={p ? `${p.name}'s items` : 'Items'}
            >
              <h2 className="rv-player__head">
                {done && <span className="rv-player__rank"><span className="sr-only">Rank </span>{rank}</span>}
                {p && <PlayerChip color={p.color} shape={p.shape} name={r.id === view.me ? `${p.name} (you)` : p.name} />}
                {winner && (
                  <span className="rv-crown" role="img" aria-label="Winner">
                    👑
                  </span>
                )}
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

      {!desktop && actions}
      {desktop && <RevealLegend done={done} host={room.isHost} />}
    </main>
  );
}
