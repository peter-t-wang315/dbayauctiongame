// Scoring (01 R32-R36): collections double, Display Case assignment by brute force, tiebreak, ranks.
import { CATEGORY_IDS, type CategoryId } from '@dbay/protocol';
import { CONFIG } from './config';
import type { PackIndex } from './pack';
import type { EnginePlayer, EngineState, ScoreResult } from './types';

export interface PlayerScore {
  total: number;
  collections: CategoryId[];
  /** One entry per Display Case, category null = unassigned (R34). */
  assign: Array<{ card: string; category: CategoryId | null }>;
}

/** R33-R34: best Display Case assignment. Ties: lowest category index first, "none" last. */
export function scoreCards(idx: PackIndex, won: readonly string[]): PlayerScore {
  const itemCount = new Map<CategoryId, number>();
  const itemSum = new Map<CategoryId, number>();
  const dcs: Array<{ id: string; value: number }> = [];
  for (const id of [...won].sort()) {
    const info = idx.cards.get(id);
    if (!info) continue;
    if (info.kind === 'displayCase') dcs.push({ id, value: info.actual });
    else if (info.kind === 'item' && info.category) {
      itemCount.set(info.category, (itemCount.get(info.category) ?? 0) + 1);
      itemSum.set(info.category, (itemSum.get(info.category) ?? 0) + info.actual);
    }
  }
  const NONE = CATEGORY_IDS.length;
  const k = dcs.length;
  const vec = new Array<number>(k).fill(0);
  let best = -1;
  let bestVec: number[] = new Array<number>(k).fill(NONE);
  let bestColl: CategoryId[] = [];
  for (;;) {
    let total = 0;
    const coll: CategoryId[] = [];
    CATEGORY_IDS.forEach((cat, ci) => {
      const items = itemCount.get(cat) ?? 0;
      let dcInCat = 0;
      let dcSum = 0;
      vec.forEach((a, d) => {
        if (a === ci) {
          dcInCat++;
          dcSum += (dcs[d] as { value: number }).value;
        }
      });
      const base = (itemSum.get(cat) ?? 0) + dcSum;
      if (items >= 1 && items + dcInCat >= CONFIG.collectionMin) {
        total += base * CONFIG.collectionMultiplier;
        coll.push(cat);
      } else total += base;
    });
    vec.forEach((a, d) => {
      if (a === NONE) total += (dcs[d] as { value: number }).value;
    });
    if (total > best) {
      best = total;
      bestVec = [...vec];
      bestColl = coll;
    }
    // odometer over [0..NONE]
    let pos = k - 1;
    while (pos >= 0 && (vec[pos] as number) === NONE) {
      vec[pos] = 0;
      pos--;
    }
    if (pos < 0) break;
    vec[pos] = (vec[pos] as number) + 1;
  }
  return {
    total: Math.max(best, 0),
    collections: bestColl,
    assign: dcs.map((d, i) => {
      const a = bestVec[i] as number;
      return { card: d.id, category: a === NONE ? null : (CATEGORY_IDS[a] as CategoryId) };
    }),
  };
}

/** R35: sum of face values of cards still in hand; a Proxy counts proxyTiebreakValue. */
export function handValue(p: EnginePlayer): number {
  return p.hand.reduce(
    (s, c) => s + (c.kind === 'value' ? (c.value ?? 0) : CONFIG.proxyTiebreakValue),
    0,
  );
}

/** Number of scorable cards held by all players (drives the R37 reveal duration). */
export function scorableCount(state: EngineState, idx: PackIndex): number {
  return state.players.reduce(
    (s, p) => s + p.won.filter((id) => idx.cards.get(id)?.kind !== 'gift').length,
    0,
  );
}

export function scoreGame(idx: PackIndex, state: EngineState): ScoreResult {
  const rows = state.players.map((p) => {
    const sc = scoreCards(idx, p.won);
    const items = [...p.won]
      .sort((a, b) => {
        const ca = CATEGORY_IDS.indexOf(idx.cards.get(a)?.category ?? 'misc');
        const cb = CATEGORY_IDS.indexOf(idx.cards.get(b)?.category ?? 'misc');
        return ca - cb || (a < b ? -1 : a > b ? 1 : 0);
      })
      .map((card) => {
        const info = idx.cards.get(card);
        const est = info?.est ?? 0;
        const actual = info?.actual ?? 0;
        const tag: 'steal' | 'ripped' | null =
          info?.kind !== 'item'
            ? null
            : actual >= est * CONFIG.stealRatio
              ? 'steal'
              : actual <= est * CONFIG.rippedRatio
                ? 'ripped'
                : null;
        return { card, est, actual, tag };
      });
    return {
      id: p.id,
      items,
      displayCaseAssign: sc.assign,
      collections: sc.collections,
      total: sc.total,
      tiebreak: handValue(p),
    };
  });
  const sorted = [...rows].sort((a, b) => b.total - a.total || b.tiebreak - a.tiebreak);
  const players = sorted.map((r) => {
    const rank = sorted.findIndex((o) => o.total === r.total && o.tiebreak === r.tiebreak) + 1;
    return { ...r, rank };
  });
  return { players, giftLog: state.giftLog };
}
