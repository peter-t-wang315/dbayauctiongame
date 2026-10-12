// View-model for the long-press item-details sheet. Only the public estimate is shown;
// the true value never reaches the client.
import type { Sprite } from '@dbay/content/public';
import type { PlayerView } from '@dbay/protocol';
import { bayViewModels, categoryEmoji, categoryName, type PlayerInfo } from './viewModel';

export interface ItemDetails {
  name: string;
  letter: string;
  category: string | null;
  categoryEmoji: string;
  est: number | null;
  special: 'displayCase' | 'gift' | null;
  flavor: string;
  sprite: Sprite | null;
  topLabel: string | null;
  topBy: PlayerInfo | undefined;
}

export function itemDetails(view: PlayerView, idx: number): ItemDetails | null {
  const vm = bayViewModels(view)[idx];
  if (!vm?.card) return null;
  const c = vm.card;
  return {
    name: c.name,
    letter: vm.letter,
    category: c.category ? categoryName(c.category) : null,
    categoryEmoji: c.category ? categoryEmoji(c.category) : '',
    est: c.special ? null : c.est,
    special: c.special,
    flavor: c.flavor,
    sprite: c.sprite,
    topLabel: vm.topLabel,
    topBy: vm.topBy,
  };
}
