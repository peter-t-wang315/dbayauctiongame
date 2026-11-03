// Selection state for the two-tap bid flow (04 section 5). Pure functions over a small state.
import type { PlayerView } from '@dbay/protocol';
import { handSlots } from './viewModel';

export interface Selection {
  /** The currently selected hand card id, or null (Idle). */
  card: string | null;
}

export const IDLE: Selection = { card: null };

type Hand = PlayerView['myHand'];

/** Tap a hand card. Returns the next selection. Cards out on the table are not selectable. */
export function tapCard(sel: Selection, cardId: string, hand: Hand, canAct: boolean): Selection {
  if (!canAct) return sel;
  const c = hand.find((h) => h.id === cardId);
  if (!c || c.onBay !== undefined) return sel.card ? IDLE : sel;
  return sel.card === cardId ? IDLE : { card: cardId };
}

/**
 * Re-validate a selection against a new snapshot: cleared when the card is gone or on a bay, or
 * when the player can no longer act (Classic turn ends, phase changes). A selected bay turning
 * illegal does NOT clear it (the bay just dims); Frenzy selection also survives a cooldown.
 */
export function reconcile(sel: Selection, view: PlayerView): Selection {
  if (!sel.card) return sel;
  if (view.phase !== 'playing' || view.stage === 'gifts') return IDLE;
  if (view.opts.mode === 'classic' && !view.canAct) return IDLE;
  const c = view.myHand.find((h) => h.id === sel.card);
  return c && c.onBay === undefined ? sel : IDLE;
}

/** One key per fixed hand slot (handSlots order): 1-9 and 0 for $10..$300, - and = for the Proxies. */
export const CARD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='] as const;

/**
 * Keyboard card target: the card in that key's fixed slot for the whole game, even when it is
 * spent or out on a bay (the tap then says why), so keys never re-map as cards are played (B6).
 */
export function cardForKey(key: string, hand: Hand): string | null {
  const i = CARD_KEYS.indexOf(key as (typeof CARD_KEYS)[number]);
  return i < 0 ? null : (handSlots(hand)[i]?.id ?? null);
}

export const BAY_KEYS = ['q', 'w', 'e', 'r'] as const;
export function bayForKey(key: string): number | null {
  const i = BAY_KEYS.indexOf(key.toLowerCase() as (typeof BAY_KEYS)[number]);
  return i < 0 ? null : i;
}
