'use client';
// SEAM to WS6: GameScreen renders this when phase is `reveal` or `ended`. WS6 replaces the body
// with its reveal/results screen (apps/web/components/reveal). Kept deliberately minimal: a plain
// standings list and Rematch/Leave so the mock game can be played to the end.
import type { PlayerView } from '@dbay/protocol';
import { useRoom } from '../../lib/net/useRoom';
import { PlayerChip } from '../shell/PlayerChip';

export function RevealSlot({ view }: { view: PlayerView }) {
  const room = useRoom();
  const rows = [...(view.reveal?.players ?? [])].sort((a, b) => a.rank - b.rank);
  return (
    <main className="page" data-phase={view.phase} data-fx="reveal-slot">
      <h1 className="g-reveal-title">{view.phase === 'ended' ? 'Final standings' : 'Reveal'}</h1>
      {rows.length === 0 ? (
        <p className="hint">Counting up the values...</p>
      ) : (
        <ol className="g-standings">
          {rows.map((r) => {
            const p = view.players.find((x) => x.id === r.id);
            return (
              <li key={r.id}>
                <span>{r.rank}</span>
                {p && <PlayerChip color={p.color} shape={p.shape} name={p.name} />}
                <strong>${r.total}</strong>
              </li>
            );
          })}
        </ol>
      )}
      <p className="hint">Full reveal screen: WS6.</p>
      {room.isHost ? (
        <button type="button" className="btn btn--primary" onClick={() => void room.send({ t: 'rematch' })}>
          REMATCH
        </button>
      ) : (
        <p className="hint">Waiting for host to rematch</p>
      )}
      <button type="button" className="btn" onClick={room.leave}>
        Leave
      </button>
    </main>
  );
}
