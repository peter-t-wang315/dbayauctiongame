// Client mirror of the bid legality rule (01 R16; the server decides). Used only for hints:
// legal-bay glow, dimmed illegal bays with a reason label, and the rejection message.
import type { PlayerView } from '@dbay/protocol';

export type HandCardView = PlayerView['myHand'][number];
export type BayView = PlayerView['bays'][number];

export interface Legality {
  legal: boolean;
  /** Short label shown on an illegal bay (never colour alone). */
  reason?: string;
}

const money = (n: number) => `$${n}`;

export function bayLegality(card: HandCardView, bay: BayView, me: string): Legality {
  if (bay.card === null) return { legal: false, reason: 'Empty' };
  const top = bay.topBid;
  if (!top) return { legal: true };
  if (top.by === me) return { legal: false, reason: "You're winning" };
  if (card.kind === 'proxy') return { legal: true };
  if (top.kind === 'proxy') return { legal: false, reason: 'Proxy tops it' };
  const face = card.value ?? 0;
  const topFace = top.value ?? 0;
  return face > topFace ? { legal: true } : { legal: false, reason: `Beat ${money(topFace)}` };
}

/** Text for a rejected bid (04 section 4.5: "Can't bid that. Beat ${top}."). */
export function rejectionText(bay: BayView | undefined): string {
  const top = bay?.topBid;
  if (top?.kind === 'value' && top.value !== undefined) return `Can't bid that. Beat ${money(top.value)}.`;
  if (top?.kind === 'proxy') return "Can't bid that. Only a Proxy beats a Proxy.";
  return "Can't bid that.";
}

/** Why the hand is locked right now, or null when the player may act. */
export function lockedReason(view: PlayerView, cooldownMs: number): string | null {
  if (view.stage === 'gifts') return 'Gift time';
  if (view.canAct && cooldownMs <= 0) return null;
  if (view.opts.mode === 'frenzy') return cooldownMs > 0 ? 'Cooling down' : 'Wait a moment';
  const t = view.turn;
  if (t && t.player !== view.me) return 'Not your turn';
  return 'Wait for your color';
}
