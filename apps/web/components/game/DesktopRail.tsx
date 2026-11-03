'use client';
// Desktop-only persistent right rail (04 section 6): "Your sets" with pips, the live event log
// (open by default, `L` collapses it) and shortcuts to the Rules / Settings panels. Players live in
// the podiums, not here.
import type { PlayerView } from '@dbay/protocol';
import { logLines } from '../../lib/game-ui/viewModel';
import type { WinCue } from '../../lib/game-ui/win';
import { MySets } from './MenuPanel';
import type { MenuTab } from './MenuPanel';

export function DesktopRail({
  view,
  logOpen,
  onToggleLog,
  onOpenPanel,
  win = null,
  pulse = false,
}: {
  view: PlayerView;
  logOpen: boolean;
  onToggleLog: () => void;
  onOpenPanel: (t: MenuTab) => void;
  /** Win-moment cue (win.ts): the item I just won is marked NEW in Your sets. */
  win?: WinCue | null;
  pulse?: boolean;
}) {
  const lines = logLines(view);
  return (
    <>
      <section className="g-rail__sec" aria-labelledby="g-rail-sets">
        <h2 className="g-rail__h" id="g-rail-sets">
          YOUR SETS
        </h2>
        <MySets view={view} win={win} pulse={pulse} />
      </section>
      <section className="g-rail__sec g-rail__sec--log" data-open={logOpen ? 'true' : 'false'}>
        <h2 className="g-rail__h">
          <button
            type="button"
            className="g-rail__toggle"
            aria-expanded={logOpen}
            aria-controls="g-rail-log"
            onClick={onToggleLog}
          >
            <span>LOG</span>
            <span aria-hidden="true">{logOpen ? '˅' : '˄'}</span>
          </button>
        </h2>
        {logOpen && (
          <ol className="g-log" id="g-rail-log" aria-label="Recent events">
            {lines.length === 0 && <li className="hint">Nothing yet.</li>}
            {lines.map((l) => (
              <li key={l.n}>{l.text}</li>
            ))}
          </ol>
        )}
      </section>
      <div className="g-rail__foot">
        <button type="button" className="btn" onClick={() => onOpenPanel('rules')}>
          Rules
        </button>
        <button type="button" className="btn" onClick={() => onOpenPanel('settings')}>
          Settings
        </button>
      </div>
    </>
  );
}
