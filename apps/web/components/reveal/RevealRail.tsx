// Desktop-only (>=1024px, mounted via useDesktop) pieces of the reveal screen (04 section 6).
// Progress rail: while the reveal runs, one row per player; the total appears when that player's last
// card has flipped. Once done, RevealScreen swaps in the real Scoreboard in the same rail slot.
import type { ProgressRow } from '../../lib/reveal/results';
import { PlayerChip } from '../shell/PlayerChip';

export function RevealProgress({ rows, me }: { rows: ProgressRow[]; me: string }) {
  return (
    <section className="rv-board rv-progress" data-fx="reveal-progress" aria-labelledby="rv-progress-title">
      <h2 id="rv-progress-title">Standings</h2>
      <p className="hint">Totals fill in as each player's items are revealed.</p>
      <ul className="rv-board__list">
        {rows.map((r) => (
          <li key={r.id} className="rv-board__row" data-me={r.id === me ? 'true' : undefined}>
            {r.player && (
              <PlayerChip color={r.player.color} shape={r.player.shape} name={r.id === me ? `${r.player.name} (you)` : r.player.name} />
            )}
            <strong className="rv-board__total">{r.total === null ? '...' : `$${r.total.toLocaleString('en-US')}`}</strong>
            {r.total === null && <span className="sr-only">not revealed yet</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Decorative key legend, same pattern as the in-game KeyLegend; the buttons carry the real actions. */
export function RevealLegend({ done, host }: { done: boolean; host: boolean }) {
  return (
    <div className="g-legend rv-legend" aria-hidden="true" data-fx="key-legend">
      {!done && (
        <span>
          <kbd>Space</kbd> <kbd>Enter</kbd> skip
        </span>
      )}
      {done && host && (
        <span>
          <kbd>R</kbd> rematch
        </span>
      )}
    </div>
  );
}
