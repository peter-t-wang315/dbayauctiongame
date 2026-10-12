'use client';
// Turn banner + timer bar (04 section 4.6). Classic: whose turn + draining bid-window bar.
// Frenzy: "FRENZY" and a bar for the soonest-ending bay. Pass button on my Classic turn.
import { barFraction, formatClock, isDanger } from '../../lib/game-ui/timers';

export function TurnBanner({
  title,
  sub,
  mine,
  color,
  remaining,
  barTotal,
  canPass,
  onPass,
}: {
  title: string;
  sub?: string;
  mine: boolean;
  /** Player color id for the banner accent, or null. */
  color: string | null;
  remaining: number | null;
  barTotal: number;
  canPass: boolean;
  onPass: () => void;
}) {
  const danger = isDanger(remaining);
  return (
    <div
      className="g-banner"
      data-fx="turn-banner"
      data-mine={mine ? 'true' : undefined}
      data-danger={danger ? 'true' : undefined}
      style={color ? { ['--accent' as string]: `var(--p-${color})` } : undefined}
    >
      <div className="g-banner__row">
        <span className="g-banner__title">{title}</span>
        {sub && <span className="g-banner__sub">{sub}</span>}
        {remaining !== null && <span className="g-banner__clock">{formatClock(remaining)}</span>}
        {canPass && (
          <button type="button" className="g-pass" onClick={onPass}>
            Pass
          </button>
        )}
      </div>
      <div className="g-bar g-bar--banner" aria-hidden="true" data-fx="timer-bar">
        <span className="g-bar__fill" style={{ width: `${barFraction(remaining, barTotal) * 100}%` }} />
      </div>
    </div>
  );
}
