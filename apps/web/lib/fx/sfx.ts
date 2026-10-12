// Synth recipes for the sound table in 04 section 7. Data only; audio.ts plays them.
export type SfxName =
  | 'tick'
  | 'tok'
  | 'chirp'
  | 'bwop'
  | 'buzz'
  | 'bell'
  | 'clock'
  | 'ting'
  | 'gavel'
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

export const SFX: Record<SfxName, Voice[]> = {
  tick: [{ at: 0, dur: 0.04, f: 1400, gain: 0.08, wave: 'square' }],
  tok: [{ at: 0, dur: 0.09, f: 380, to: 160, gain: 0.3, wave: 'triangle' }],
  chirp: [
    { at: 0, dur: 0.09, f: 660, gain: 0.18, wave: 'sine' },
    { at: 0.09, dur: 0.12, f: 990, gain: 0.18, wave: 'sine' },
  ],
  bwop: [{ at: 0, dur: 0.28, f: 330, to: 130, gain: 0.25, wave: 'triangle' }],
  buzz: [{ at: 0, dur: 0.18, f: 110, gain: 0.16, wave: 'sawtooth' }],
  bell: [
    { at: 0, dur: 0.5, f: 1320, gain: 0.18, wave: 'sine' },
    { at: 0, dur: 0.5, f: 1980, gain: 0.06, wave: 'sine' },
  ],
  clock: [{ at: 0, dur: 0.05, f: 900, gain: 0.12, wave: 'square' }],
  ting: [{ at: 0, dur: 0.25, f: 1760, gain: 0.12, wave: 'sine' }],
  gavel: [
    { at: 0, dur: 0.12, f: 1, gain: 0.5, wave: 'noise' },
    { at: 0, dur: 0.1, f: 220, to: 80, gain: 0.35, wave: 'triangle' },
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
