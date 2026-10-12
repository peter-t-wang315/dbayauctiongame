// Ranked final standings with tie notes (R35). The crown badge is the reduced-motion stand-in for
// confetti (04 section 7, moment 6); WS8 adds confetti on `data-fx="scoreboard"`.
import type { Standing } from '../../lib/reveal/results';
import { PlayerChip } from '../shell/PlayerChip';

export function Scoreboard({ rows, me }: { rows: Standing[]; me: string }) {
  return (
    <section className="rv-board" data-fx="scoreboard" aria-labelledby="rv-board-title">
      <h2 id="rv-board-title">Standings</h2>
      <ol className="rv-board__list">
        {rows.map((r) => (
          <li key={r.id} className="rv-board__row" data-rank={r.rank} data-me={r.id === me ? 'true' : undefined}>
            <span className="rv-board__rank" aria-label={`Rank ${r.rank}`}>
              {r.rank}
            </span>
            {r.player ? (
              <PlayerChip color={r.player.color} shape={r.player.shape} name={r.player.name} />
            ) : (
              <span>Player</span>
            )}
            {r.rank === 1 && (
              <span className="rv-crown" role="img" aria-label="Winner">
                👑
              </span>
            )}
            <strong className="rv-board__total">${r.total.toLocaleString('en-US')}</strong>
            {r.tieNote && <span className="rv-board__note">{r.tieNote}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
