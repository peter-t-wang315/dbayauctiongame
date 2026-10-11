// Hook point for WS8: the join button is a user gesture, so it is where Web Audio gets unlocked
// (04 section 3.2). WS8 calls registerAudioUnlock(fn) once; JoinForm calls runAudioUnlock().
let unlock: (() => void) | null = null;

export function registerAudioUnlock(fn: () => void): void {
  unlock = fn;
}

export function runAudioUnlock(): void {
  try {
    unlock?.();
  } catch {
    /* sound is optional */
  }
}
