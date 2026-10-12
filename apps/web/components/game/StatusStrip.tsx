'use client';
// Status strip (04 section 4.5): event text (aria-live), Classic progress bar, menu button.
// Text-only by design, so the game is fully playable with sound off.
import type { Progress } from '../../lib/game-ui/viewModel';

export function StatusStrip({
  text,
  progress,
  showMenu,
  onOpenLog,
  onOpenMenu,
}: {
  text: string;
  progress: Progress;
  showMenu: boolean;
  onOpenLog: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <div className="g-strip" data-fx="status-strip">
      <button type="button" className="g-strip__text" onClick={onOpenLog} aria-label="Open event log">
        <span role="status" aria-live="polite" data-fx="status-text">
          {text}
        </span>
      </button>
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
            <span className="g-progress__fill" style={{ width: `${progress.fraction * 100}%` }} />
          </span>
          {progress.label && (
            <span className="g-progress__tag">{progress.label === 'last' ? 'Last round' : 'Halfway'}</span>
          )}
        </span>
      )}
      {showMenu && (
        <button type="button" className="g-strip__menu" aria-label="Menu: players, log, settings" onClick={onOpenMenu}>
          <span aria-hidden="true">⋯</span>
        </button>
      )}
    </div>
  );
}
