// Tunable constants (docs/01-game-rules.md section 9, docs/02-modes-and-scaling.md section 4).
// Every ASSUMED value lives here; tune it here, never inline.

import { DEFAULT_LENGTH, type GameLength } from '@dbay/protocol';

export type PlayerCount = 3 | 4 | 5 | 6;

export interface DeckSpec {
  items: number;
  displayCase: number;
  gift: number;
  catsInPlay: number;
}

/** Constants that differ per game length (lobby option `length`; 01 section 8, 02 section 4). */
export interface LengthPreset {
  /** R4, 01 section 8. */
  DECK_BY_PLAYERS: Record<PlayerCount, DeckSpec>;
  /** R7. */
  ROUNDS_BY_PLAYERS: Record<PlayerCount, number>;
  /** F2: a Frenzy bay's open timer is uniform in [min, max]. */
  frenzyOpenMinMs: number;
  frenzyOpenMaxMs: number;
  /** F2: a bay's timer never runs past openedAt + this. */
  frenzyHardCapMs: number;
  /** F3: re-arm delay for a bay with no bids. */
  frenzyIdleRecheckMs: number;
  /** F7: elapsed time that triggers the last round. */
  frenzyMaxMs: number;
  /**
   * R17: close probability ramps from pBase to pMax over the game; a bay is force-closed after
   * maxBayAgeCycles x players calls. Per player count because the deck-to-bay ratio differs.
   */
  CLOSE_BY_PLAYERS: Record<PlayerCount, CloseSpec>;
}

export interface CloseSpec {
  pBase: number;
  pMax: number;
  maxBayAgeCycles: number;
}

// ASSUMED (docs/01 section 8-9, docs/02 section 4). Tuned with `tools/sim` under human pacing.
const QUICK: LengthPreset = {
  // ~6 deck cards per player.
  DECK_BY_PLAYERS: {
    3: { items: 16, displayCase: 1, gift: 1, catsInPlay: 5 },
    4: { items: 21, displayCase: 2, gift: 1, catsInPlay: 6 },
    5: { items: 26, displayCase: 2, gift: 2, catsInPlay: 6 },
    6: { items: 31, displayCase: 3, gift: 2, catsInPlay: 6 },
  },
  ROUNDS_BY_PLAYERS: { 3: 52, 4: 36, 5: 23, 6: 19 },
  frenzyOpenMinMs: 35000,
  frenzyOpenMaxMs: 50000,
  frenzyHardCapMs: 100000,
  frenzyIdleRecheckMs: 15000,
  frenzyMaxMs: 600000,
  CLOSE_BY_PLAYERS: {
    3: { pBase: 0.02, pMax: 0.07, maxBayAgeCycles: 7 },
    4: { pBase: 0.04, pMax: 0.12, maxBayAgeCycles: 4 },
    5: { pBase: 0.05, pMax: 0.15, maxBayAgeCycles: 3 },
    6: { pBase: 0.05, pMax: 0.15, maxBayAgeCycles: 3 },
  },
};

const STANDARD: LengthPreset = {
  // ~8 deck cards per player.
  DECK_BY_PLAYERS: {
    3: { items: 21, displayCase: 2, gift: 1, catsInPlay: 6 },
    4: { items: 28, displayCase: 2, gift: 2, catsInPlay: 6 },
    5: { items: 35, displayCase: 3, gift: 2, catsInPlay: 6 },
    6: { items: 42, displayCase: 3, gift: 3, catsInPlay: 6 },
  },
  ROUNDS_BY_PLAYERS: { 3: 50, 4: 50, 5: 42, 6: 33 },
  frenzyOpenMinMs: 40000,
  frenzyOpenMaxMs: 55000,
  frenzyHardCapMs: 110000,
  frenzyIdleRecheckMs: 15000,
  frenzyMaxMs: 1080000,
  CLOSE_BY_PLAYERS: {
    3: { pBase: 0.014, pMax: 0.055, maxBayAgeCycles: 8 },
    4: { pBase: 0.025, pMax: 0.08, maxBayAgeCycles: 6 },
    5: { pBase: 0.03, pMax: 0.085, maxBayAgeCycles: 5 },
    6: { pBase: 0.04, pMax: 0.1, maxBayAgeCycles: 4 },
  },
};

export const LENGTH_PRESETS: Record<GameLength, LengthPreset> = {
  quick: QUICK,
  standard: STANDARD,
};

/** The preset for a state/setup `length` (absent = 'standard'). */
export function presetOf(length: GameLength | undefined): LengthPreset {
  return LENGTH_PRESETS[length ?? DEFAULT_LENGTH];
}

export const CONFIG = {
  // R2
  BID_VALUES: [10, 25, 50, 75, 100, 125, 150, 200, 250, 300],
  PROXIES_PER_PLAYER: 2,
  // R1
  BAYS_BY_PLAYERS: { 3: 3, 4: 3, 5: 4, 6: 4 } satisfies Record<PlayerCount, number>,
  // R11-R13
  bidWindowMs: 5000,
  relaxedMultiplier: 1.5,
  callGapMs: 1500,
  skipGapMs: 1000,
  // R29-R30
  giftChoiceMs: 15000,
  // R37
  revealBaseMs: 5000,
  revealPerCardMs: 600,
  // R35, R26, R33
  // R36 / 04 reveal tags: STEAL! at actual >= 1.3x est, Ripped off! at <= 0.6x est
  stealRatio: 1.3,
  rippedRatio: 0.6,
  proxyTiebreakValue: 0,
  displayCaseValue: 100,
  collectionMin: 3,
  collectionMultiplier: 2,
  // Frenzy F2-F8
  antiSnipeMs: 3000,
  frenzyMaxIdleExpiries: 2,
  bidCooldownMs: 1000,
  frenzyLastRoundMaxMs: 15000,
  // 05 section 8: bot seats act after a human-like delay
  botDelayMinMs: 800,
  botDelayMaxMs: 2000,
} as const;

export type EngineConfig = typeof CONFIG;
