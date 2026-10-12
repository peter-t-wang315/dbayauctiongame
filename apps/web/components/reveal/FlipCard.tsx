// One scorable card in the reveal list: estimate first, then the actual value and its tag
// (04 section 3.5, R36). The flip is a CSS state; WS8 may animate `data-fx="reveal-flip"`.
import type { RevealCard } from '../../lib/reveal/results';
import { TAG_TEXT } from '../../lib/reveal/results';
import { cardInfo } from '../../lib/game-ui/viewModel';
import { SpriteView } from '../game/Sprite';

export function FlipCard({ card, shown, doubled }: { card: RevealCard; shown: boolean; doubled: boolean }) {
  const sprite = cardInfo(card.card)?.sprite ?? null;
  return (
    <li className="rv-card" data-fx="reveal-flip" data-state={shown ? 'shown' : 'hidden'} data-tag={shown ? (card.tag ?? undefined) : undefined}>
      <SpriteView sprite={sprite} size={24} />
      <span className="rv-card__name">
        {card.name}
        {card.displayCase && <span className="hint"> (wild)</span>}
      </span>
      <span className="rv-card__vals">
        <span className="rv-card__est">est ${card.est}</span>
        <span aria-hidden="true"> → </span>
        {shown ? (
          <strong className="rv-card__actual">
            ${card.actual}
            {doubled && <span className="rv-card__x2"> x2 = ${card.scored}</span>}
          </strong>
        ) : (
          <span className="rv-card__actual rv-card__actual--hidden">
            <span aria-hidden="true">?</span>
            <span className="sr-only">not revealed yet</span>
          </span>
        )}
      </span>
      {shown && card.tag && (
        <span className={`rv-tag rv-tag--${card.tag}`} data-fx="reveal-tag">
          {TAG_TEXT[card.tag]}
        </span>
      )}
    </li>
  );
}
