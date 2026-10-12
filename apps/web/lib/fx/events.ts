// Feedback events derived by diffing two consecutive snapshots (04 section 7). Pure: no DOM, no
// audio. The FxController turns events into sound, haptics and tiny animations; none of them carry
// information the status strip, log and bay state do not already show.
import type { PlayerView } from '@dbay/protocol';

export type FxEvent =
  | { t: 'bump'; bay: number; mine: boolean }
  | { t: 'yourTurn' }
  | { t: 'outbid'; bay: number }
  | { t: 'extended' }
  | { t: 'sold'; bay: number | undefined; mine: boolean }
  | { t: 'collection'; mine: boolean }
  | { t: 'gong' }
  | { t: 'reveal' };

type Top = PlayerView['bays'][number]['topBid'];

function sameTop(a: Top, b: Top): boolean {
  if (!a || !b) return a === b;
  return a.by === b.by && a.kind === b.kind && a.value === b.value;
}

/** Events between two snapshots. `prev === null` (first snapshot, or a resync) yields nothing. */
export function deriveFx(prev: PlayerView | null, next: PlayerView): FxEvent[] {
  if (!prev) return [];
  const out: FxEvent[] = [];

  if (prev.phase === 'playing' && (next.phase === 'reveal' || next.phase === 'ended')) {
    out.push({ t: 'reveal' });
  }

  // Log-driven events: only entries newer than anything in the previous snapshot.
  const lastN = prev.log.reduce((m, e) => Math.max(m, e.n), -1);
  for (const e of next.log) {
    if (e.n <= lastN) continue;
    if (e.kind === 'sold') out.push({ t: 'sold', bay: e.bay, mine: e.by === next.me });
    else if (e.kind === 'extended') out.push({ t: 'extended' });
    else if (e.kind === 'collection') out.push({ t: 'collection', mine: e.by === next.me });
    else if (e.kind === 'halfway' || e.kind === 'lastRound') out.push({ t: 'gong' });
  }

  if (next.phase !== 'playing') return out;

  for (const b of next.bays) {
    const p = prev.bays.find((x) => x.idx === b.idx);
    // A different (or newly placed) card is a refill, not a bid.
    if (!p || p.card === null || p.card !== b.card || !b.topBid || sameTop(p.topBid, b.topBid)) continue;
    const mine = b.topBid.by === next.me;
    out.push({ t: 'bump', bay: b.idx, mine });
    if (p.topBid?.by === next.me && !mine) out.push({ t: 'outbid', bay: b.idx });
  }

  // Classic: my bidding window opened.
  const wasMine = prev.phase === 'playing' && prev.turn?.player === prev.me && prev.turn.phase === 'window';
  const isMine = next.turn?.player === next.me && next.turn.phase === 'window' && next.stage !== 'gifts';
  if (isMine && (!wasMine || prev.round.n !== next.round.n)) out.push({ t: 'yourTurn' });

  return out;
}

/** True when a clock crosses to a lower whole second inside the last `windowMs` (for tick sounds). */
export function crossedSecond(prevMs: number | null, nowMs: number | null, windowMs = 3000): boolean {
  if (prevMs === null || nowMs === null || nowMs <= 0 || nowMs > windowMs) return false;
  return Math.ceil(nowMs / 1000) < Math.ceil(prevMs / 1000);
}
