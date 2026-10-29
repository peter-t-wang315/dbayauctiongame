// Synth recipes for the sound table in 04 section 7. Data only; audio.ts plays them.
export type SfxName =
  | 'tick'
  | 'tok'
  | 'chirp'
  | 'sting'
  | 'buzz'
  | 'bell'
  | 'clock'
  | 'ting'
  | 'gavel'
  | 'gavelWon'
  | 'fanfare'
  | 'gong'
  | 'flip'
  | 'cheer';

/** One voice: start offset (s), duration (s), frequency (Hz) sliding to `to`, gain, waveform or noise. */
export interface Voice {
  at: number;
  dur: number;
  f: number;
  to?: number;
  gain: number;
  wave: OscillatorType | 'noise';
}

const GAVEL: Voice[] = [
  { at: 0, dur: 0.05, f: 1, gain: 0.45, wave: 'noise' },
  { at: 0, dur: 0.14, f: 240, to: 70, gain: 0.45, wave: 'triangle' },
  { at: 0.17, dur: 0.07, f: 1, gain: 0.5, wave: 'noise' },
  { at: 0.17, dur: 0.2, f: 200, to: 55, gain: 0.45, wave: 'triangle' },
];

export const SFX: Record<SfxName, Voice[]> = {
  tick: [{ at: 0, dur: 0.04, f: 1400, gain: 0.08, wave: 'square' }],
  tok: [{ at: 0, dur: 0.09, f: 380, to: 160, gain: 0.3, wave: 'triangle' }],
  chirp: [
    { at: 0, dur: 0.09, f: 660, gain: 0.18, wave: 'sine' },
    { at: 0.09, dur: 0.12, f: 990, gain: 0.18, wave: 'sine' },
  ],
  // Outbid sting: a short dissonant stab (minor second) that drops, over a low thud. Reads as "uh-oh"
  // without being as loud as the gavel.
  sting: [
    { at: 0, dur: 0.05, f: 1, gain: 0.18, wave: 'noise' },
    { at: 0, dur: 0.32, f: 622, to: 294, gain: 0.11, wave: 'sawtooth' },
    { at: 0, dur: 0.32, f: 659, to: 311, gain: 0.11, wave: 'sawtooth' },
    { at: 0, dur: 0.22, f: 140, to: 70, gain: 0.3, wave: 'triangle' },
  ],
  buzz: [{ at: 0, dur: 0.18, f: 110, gain: 0.16, wave: 'sawtooth' }],
  bell: [
    { at: 0, dur: 0.5, f: 1320, gain: 0.18, wave: 'sine' },
    { at: 0, dur: 0.5, f: 1980, gain: 0.06, wave: 'sine' },
  ],
  clock: [{ at: 0, dur: 0.05, f: 900, gain: 0.12, wave: 'square' }],
  ting: [{ at: 0, dur: 0.25, f: 1760, gain: 0.12, wave: 'sine' }],
  // Gavel: two wooden knocks ("...SOLD!"), each a sharp noise crack over a falling body thump.
  gavel: GAVEL,
  // Sold to me: the same knocks, then a bright rising two-note "ding-ding".
  gavelWon: [
    ...GAVEL,
    { at: 0.34, dur: 0.14, f: 1047, gain: 0.16, wave: 'triangle' },
    { at: 0.46, dur: 0.34, f: 1568, gain: 0.16, wave: 'triangle' },
  ],
  fanfare: [
    { at: 0, dur: 0.12, f: 523, gain: 0.16, wave: 'square' },
    { at: 0.12, dur: 0.12, f: 659, gain: 0.16, wave: 'square' },
    { at: 0.24, dur: 0.12, f: 784, gain: 0.16, wave: 'square' },
    { at: 0.36, dur: 0.3, f: 1047, gain: 0.16, wave: 'square' },
  ],
  gong: [
    { at: 0, dur: 1.2, f: 110, gain: 0.3, wave: 'sine' },
    { at: 0, dur: 1.0, f: 165, gain: 0.15, wave: 'sine' },
  ],
  flip: [{ at: 0, dur: 0.07, f: 1, gain: 0.12, wave: 'noise' }],
  cheer: [
    { at: 0, dur: 0.15, f: 523, gain: 0.15, wave: 'triangle' },
    { at: 0.15, dur: 0.15, f: 659, gain: 0.15, wave: 'triangle' },
    { at: 0.3, dur: 0.15, f: 784, gain: 0.15, wave: 'triangle' },
    { at: 0.45, dur: 0.15, f: 1047, gain: 0.15, wave: 'triangle' },
    { at: 0.6, dur: 0.5, f: 1319, gain: 0.15, wave: 'triangle' },
  ],
};
