// Desktop podium view models (04 section 6): one per player, same data as the Players tab.
import type { PlayerView } from '@dbay/protocol';
import type { Sprite } from '@dbay/content/public';
import { BAY_LETTERS, cardInfo } from './viewModel';

export interface PodiumVM {
  id: string;
  name: string;
  color: PlayerView['players'][number]['color'];
  shape: string;
  me: boolean;
  isBot: boolean;
  away: boolean;
  /** Classic: it is this player's turn. */
  turn: boolean;
  cardsLeft: number;
  /** Bay letters this player currently tops (Frenzy has no turn, so this is the live state). */
  leading: string[];
  /** Items won, newest first. */
  won: { id: string; name: string; sprite: Sprite | null }[];
  wonCount: number;
}

/** Me first, then seating order. */
export function podiumModels(view: PlayerView): PodiumVM[] {
  const turnId =
    view.opts.mode === 'classic' && view.stage !== 'gifts' ? view.turn?.player : undefined;
  const ordered = [...view.players].sort(
    (a, b) => Number(b.id === view.me) - Number(a.id === view.me),
  );
  return ordered.map((p) => {
    const won = [...p.collection]
      .reverse()
      .map((id) => cardInfo(id))
      .filter((c) => c !== null)
      .map((c) => ({ id: c.id, name: c.name, sprite: c.sprite }));
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      shape: p.shape,
      me: p.id === view.me,
      isBot: p.isBot,
      away: !p.connected,
      turn: p.id === turnId,
      cardsLeft: p.cardsInHand,
      leading: view.bays
        .filter((b) => b.card && b.topBid?.by === p.id)
        .map((b) => BAY_LETTERS[b.idx] ?? String(b.idx + 1)),
      won,
      wonCount: won.length,
    };
  });
}

/**
 * Won-item sprite slots in a podium's single fixed-height row, from the player count (the podiums
 * share the row width, so 5-6 players get narrower cards). When more items are won than slots, the
 * last slot becomes a "+n" chip, so the row never wraps, clips or changes height as items are won.
 */
export function podiumSlots(playerCount: number): number {
  if (playerCount >= 6) return 3;
  if (playerCount === 5) return 4;
  return 6;
}

/** How many sprites to draw, and how many items hide behind the "+n" chip. */
export function podiumSplit(wonCount: number, playerCount: number): { shown: number; more: number } {
  const slots = podiumSlots(playerCount);
  if (wonCount <= slots) return { shown: wonCount, more: 0 };
  return { shown: slots - 1, more: wonCount - (slots - 1) };
}
