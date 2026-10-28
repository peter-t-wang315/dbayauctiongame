'use client';
// The merged top HUD (04 sections 4.5 + 4.6): one compact bar with whose turn it is, the event
// text (aria-live, so the game is fully playable with sound off), the Classic bid-window clock,
// Pass, the game-progress bar and the menu button. Tapping the title/text area opens the log.
import type { Progress } from '../../lib/game-ui/viewModel';
import { barFraction, formatClock, isDanger } from '../../lib/game-ui/timers';

export function StatusStrip({
  text,
  silent,
  title,
  sub,
  mine,
  color,
  remaining,
  barTotal,
  showClock,
  canPass,
  progress,
  showMenu,
  onPass,
  onOpenLog,
  onOpenMenu,
}: {
  text: string;
  /** The text is announced assertively elsewhere: keep it visible but out of the polite region's updates. */
  silent?: boolean;
  /** Turn title: "Your turn", "Bot Billy's turn", "FRENZY". */
  title: string;
  sub?: string;
  mine: boolean;
  /** Player color id for the accent, or null. */
  color: string | null;
  /** ms left on the shared clock (Classic bid window; Frenzy: soonest bay), null if none. */
  remaining: number | null;
  barTotal: number;
  /** Show the big numeric clock (Classic). Frenzy keeps only a thin bar: per-bay timers lead. */
  showClock: boolean;
  canPass: boolean;
  progress: Progress;
  showMenu: boolean;
  onPass: () => void;
  onOpenLog: () => void;
  onOpenMenu: () => void;
}) {
  const danger = isDanger(remaining);
  const clock = showClock && remaining !== null;
  return (
    <div
      className="g-strip"
      data-fx="status-strip"
      data-mine={mine ? 'true' : undefined}
      data-danger={danger ? 'true' : undefined}
      data-clock={clock ? 'true' : undefined}
      style={color ? { ['--accent' as string]: `var(--p-${color})` } : undefined}
    >
      <div className="g-strip__row">
        <button
          type="button"
          className="g-strip__text"
          onClick={onOpenLog}
          aria-label={`${title}. Open event log`}
        >
          {/* Stable e2e/fx hook: data-fx="turn-banner" carries data-mine on my turn (tools/e2e relies on it). */}
          <span
            className="g-strip__title"
            data-fx="turn-banner"
            data-mine={mine ? 'true' : undefined}
          >
            <span className="g-strip__who">{title}</span>
            {sub && <span className="g-strip__sub">{sub}</span>}
          </span>
          <span className="g-strip__line">
            <span className="g-strip__msg" aria-hidden="true">
              {text}
            </span>
            {progress.max > 0 && (
              <span className="g-progress" data-label={progress.label ?? undefined}>
                <span
                  className="g-progress__bar"
                  role="progressbar"
                  aria-label="Game progress"
                  aria-valuemin={0}
                  aria-valuemax={progress.max}
                  aria-valuenow={Math.min(progress.now, progress.max)}
                >
                  <span
                    className="g-progress__fill"
                    style={{ width: `${progress.fraction * 100}%` }}
                  />
                </span>
                {progress.label && (
                  <span className="g-progress__tag">
                    {progress.label === 'last' ? 'Last round' : 'Halfway'}
                  </span>
                )}
              </span>
            )}
          </span>
        </button>
        {clock && (
          <span className="g-strip__clock" data-fx="turn-clock" aria-hidden="true">
            {formatClock(remaining!)}
          </span>
        )}
        {canPass && (
          <button type="button" className="g-pass" onClick={onPass}>
            Pass
          </button>
        )}
        {showMenu && (
          <button
            type="button"
            className="g-strip__menu"
            aria-label="Menu: players, log, settings"
            onClick={onOpenMenu}
          >
            <span aria-hidden="true">⋯</span>
          </button>
        )}
      </div>
      <div className="g-bar g-bar--strip" aria-hidden="true" data-fx="timer-bar">
        <span className="g-bar__fill" style={{ width: `${barFraction(remaining, barTotal) * 100}%` }} />
      </div>
      {/* The one polite live region: the event text (sound-off play). The visible copy above is aria-hidden. */}
      <span className="sr-only" role="status" aria-live="polite" data-fx="status-text">
        {silent ? <span aria-hidden="true">{text}</span> : text}
      </span>
    </div>
  );
}
