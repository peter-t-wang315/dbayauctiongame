import type { FxEvent } from './events';
import type { SfxName } from './sfx';

/** Which sound an event makes (null = silent). */
export function sfxFor(e: FxEvent): SfxName | null {
  switch (e.t) {
    case 'bump':
      return e.mine ? 'chirp' : 'tok';
    case 'yourTurn':
      return 'bell';
    case 'outbid':
      return 'bwop';
    case 'extended':
      return 'ting';
    case 'sold':
      return 'gavel';
    case 'collection':
      return e.mine ? 'fanfare' : null;
    case 'gong':
      return 'gong';
    case 'reveal':
      return null;
  }
}
