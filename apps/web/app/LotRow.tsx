import { ITEM_SPRITES } from '@dbay/content/public';
import { SpriteView } from '../components/game/Sprite';

// A "lot row" of existing item sprites: gives the landing page its game identity.
const LOT_IDS = [
  'toys-tin-robot',
  'glass-teapot',
  'misc-mystery-box',
  'media-gramophone',
  'collectibles-snow-globe',
];
const TILTS = [-4, 3, 0, -3, 4];

export function LotRow() {
  return (
    <div className="lot-row" data-testid="lot-row" aria-hidden="true">
      {LOT_IDS.map((id, i) => (
        <span key={id} className="lot-row__lot" style={{ transform: `rotate(${TILTS[i]}deg)` }}>
          <SpriteView sprite={ITEM_SPRITES[id] ?? null} size={52} />
        </span>
      ))}
    </div>
  );
}
