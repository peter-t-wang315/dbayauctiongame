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
}

// ASSUMED. Placeholder: both presets equal the original single table until tuned (docs/02).
const BASE_PRESET: LengthPreset = {
  DECK_BY_PLAYERS: {
    3: { items: 16, displayCase: 1, gift: 1, catsInPlay: 4 },
    4: { items: 21, displayCase: 2, gift: 1, catsInPlay: 5 },
    5: { items: 26, displayCase: 2, gift: 2, catsInPlay: 6 },
    6: { items: 31, displayCase: 3, gift: 2, catsInPlay: 6 },
  },
  ROUNDS_BY_PLAYERS: { 3: 30, 4: 25, 5: 20, 6: 18 },
  frenzyOpenMinMs: 18000,
  frenzyOpenMaxMs: 30000,
};

export const LENGTH_PRESETS: Record<GameLength, LengthPreset> = {
  quick: BASE_PRESET,
  standard: BASE_PRESET,
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
  // R17
  pBase: 0.05,
  pMax: 0.15,
  maxBayAgeCycles: 3,
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
  frenzyHardCapMs: 60000,
  frenzyIdleRecheckMs: 10000,
  frenzyMaxIdleExpiries: 2,
  bidCooldownMs: 1000,
  frenzyMaxMs: 1500000,
  frenzyLastRoundMaxMs: 15000,
  // 05 section 8: bot seats act after a human-like delay
  botDelayMinMs: 800,
  botDelayMaxMs: 2000,
} as const;

export type EngineConfig = typeof CONFIG;
