'use client';
// Tiny Web Audio player. The context is created/resumed from a user gesture (Join tap or the
// sound toggle) so iOS Safari lets it run. Nothing here throws: sound is optional.
import { SFX, type SfxName } from './sfx';
import { getSettings } from './settings';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a user gesture. Only creates the context when sound is on. */
export function unlockAudio(): void {
  if (!getSettings().sound) return;
  const c = context();
  if (!c) return;
  try {
    void c.resume();
    // iOS: a started (silent) source inside the gesture fully unlocks output.
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, 22050);
    s.connect(c.destination);
    s.start(0);
  } catch {
    /* ignore */
  }
}

function makeNoise(c: AudioContext): AudioBuffer {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.2), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function playSfx(name: SfxName): void {
  if (!getSettings().sound) return;
  const c = context();
  if (!c || c.state === 'closed') return;
  try {
    if (c.state === 'suspended') void c.resume();
    const t0 = c.currentTime + 0.01;
    for (const v of SFX[name]) {
      const g = c.createGain();
      const start = t0 + v.at;
      g.gain.setValueAtTime(v.gain, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + v.dur);
      g.connect(c.destination);
      if (v.wave === 'noise') {
        noise ??= makeNoise(c);
        const src = c.createBufferSource();
        src.buffer = noise;
        src.connect(g);
        src.start(start);
        src.stop(start + v.dur);
      } else {
        const o = c.createOscillator();
        o.type = v.wave;
        o.frequency.setValueAtTime(v.f, start);
        if (v.to) o.frequency.exponentialRampToValueAtTime(v.to, start + v.dur);
        o.connect(g);
        o.start(start);
        o.stop(start + v.dur);
      }
    }
  } catch {
    /* ignore */
  }
}
