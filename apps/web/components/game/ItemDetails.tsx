'use client';
// Item details (long-press / "i" on a bay): sprite, name, category, estimate, flavor, current bid.
// Shows the public estimate only; actual values never reach the client.
import { PlayerChip } from '../shell/PlayerChip';
import { SpriteView } from './Sprite';
import type { ItemDetails } from '../../lib/game-ui/itemDetails';

export function ItemDetailsBody({ d, onClose }: { d: ItemDetails; onClose: () => void }) {
  return (
    <>
      <div className="g-item">
        {d.sprite && <SpriteView sprite={d.sprite} size={96} />}
        <div className="g-item__text">
          <p className="g-item__name" data-testid="item-name">
            {d.name}
          </p>
          {d.category && (
            <p className="g-item__meta">
              <span aria-hidden="true">{d.categoryEmoji}</span> {d.category}
            </p>
          )}
          {d.est !== null && !d.special && (
            <p className="g-item__meta" data-testid="item-est">
              Estimated value ${d.est}
            </p>
          )}
          {d.special === 'displayCase' && (
            <p className="g-item__meta">Display Case: counts as $100 wild</p>
          )}
          {d.special === 'gift' && <p className="g-item__meta">Gift card</p>}
        </div>
      </div>
      {d.flavor && <p className="g-item__flavor">{d.flavor}</p>}
      <p className="g-item__bids" data-testid="item-bids">
        <span className="g-item__label">Bay {d.letter}</span>{' '}
        {d.topLabel && d.topBy ? (
          <>
            Top bid {d.topLabel}{' '}
            <PlayerChip color={d.topBy.color} shape={d.topBy.shape} name={d.topBy.name} />
          </>
        ) : (
          'No bids yet'
        )}
      </p>
      <button type="button" className="btn btn--primary" onClick={onClose}>
        Close
      </button>
    </>
  );
}
