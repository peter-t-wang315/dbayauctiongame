'use client';
// The 12 bid cards (04 section 4.3): fixed positions, spent cards stay in place (dashed, struck
// through), cards out on the table show a bay-letter badge, Proxies are striped with a label.
import type { HandSlot } from '../../lib/game-ui/viewModel';
import { BAY_LETTERS } from '../../lib/game-ui/viewModel';

export function Hand({
  slots,
  selected,
  locked,
  shake,
  keyHints,
  onTap,
}: {
  slots: HandSlot[];
  selected: string | null;
  /** True when the player cannot act now (Classic: not my turn; Frenzy: cooldown). */
  locked: boolean;
  shake: string | null;
  /** card id -> keyboard shortcut (desktop badges). */
  keyHints: Record<string, string>;
  onTap: (id: string) => void;
}) {
  return (
    <div className="g-hand" role="group" aria-label="Your bid cards" data-locked={locked ? 'true' : undefined}>
      {slots.map((s) => {
        const out = s.onBay !== undefined;
        const unavailable = s.spent || out;
        const isSel = selected === s.id;
        const face = s.kind === 'proxy' ? 'Proxy' : `$${s.value}`;
        const name = s.spent
          ? `${face} card, spent`
          : out
            ? `${face} card, out on bay ${BAY_LETTERS[s.onBay!] ?? s.onBay! + 1}`
            : `${face} card`;
        return (
          <button
            key={s.id}
            type="button"
            className={`g-card${s.kind === 'proxy' ? ' g-card--proxy' : ''}`}
            data-fx="hand-card"
            data-card={s.id}
            data-state={s.spent ? 'spent' : out ? 'out' : isSel ? 'selected' : locked ? 'locked' : 'ready'}
            data-shake={shake === s.id ? 'true' : undefined}
            aria-label={name}
            aria-pressed={unavailable ? undefined : isSel}
            aria-disabled={unavailable || locked}
            tabIndex={s.spent ? -1 : 0}
            onClick={() => onTap(s.id)}
          >
            {s.kind === 'proxy' ? (
              <>
                <span aria-hidden="true" className="g-card__proxy-glyph">
                  ⓟ
                </span>
                <span className="g-card__face g-card__face--proxy">PROXY</span>
              </>
            ) : (
              <span className="g-card__face">{face}</span>
            )}
            {out && <span className="g-card__badge">{BAY_LETTERS[s.onBay!] ?? s.onBay! + 1}</span>}
            {keyHints[s.id] && (
              <kbd className="g-kbd" aria-hidden="true">
                {keyHints[s.id]}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
