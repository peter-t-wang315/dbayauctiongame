'use client';
// Sound / haptics preferences. Sound is OFF by default; haptics default on where supported.
// Persisted in localStorage (every access wrapped: private windows throw).
const KEY = 'dbay:fx';

export interface FxSettings {
  sound: boolean;
  haptics: boolean;
}
const DEFAULTS: FxSettings = { sound: false, haptics: true };

let current: FxSettings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

export function parseSettings(raw: string | null): FxSettings {
  try {
    const o = raw ? (JSON.parse(raw) as Partial<FxSettings>) : {};
    return {
      sound: typeof o.sound === 'boolean' ? o.sound : DEFAULTS.sound,
      haptics: typeof o.haptics === 'boolean' ? o.haptics : DEFAULTS.haptics,
    };
  } catch {
    return DEFAULTS;
  }
}

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    current = parseSettings(localStorage.getItem(KEY));
  } catch {
    current = DEFAULTS;
  }
}

export function getSettings(): FxSettings {
  load();
  return current;
}
export const serverSettings = (): FxSettings => DEFAULTS;

export function setSettings(patch: Partial<FxSettings>): void {
  load();
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* not persisted */
  }
  listeners.forEach((l) => l());
}

export function subscribeSettings(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
