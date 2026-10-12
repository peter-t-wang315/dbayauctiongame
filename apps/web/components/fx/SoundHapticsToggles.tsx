'use client';
// Sound and Haptics toggles, mounted in the Settings tab of the menu. Haptics is hidden where
// navigator.vibrate does not exist (iOS Safari).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { playSfx, unlockAudio } from '../../lib/fx/audio';
import { hapticsSupported } from '../../lib/fx/haptics';
import { getSettings, serverSettings, setSettings, subscribeSettings } from '../../lib/fx/settings';

export function useFxSettings() {
  return useSyncExternalStore(subscribeSettings, getSettings, serverSettings);
}

/** Flip sound on/off from any user gesture (button or the M key); returns the new value. */
export function toggleSound(): boolean {
  const on = !getSettings().sound;
  setSettings({ sound: on });
  if (on) {
    unlockAudio();
    playSfx('tick');
  }
  return on;
}

export function SoundHapticsToggles() {
  const s = useFxSettings();
  const [canVibrate, setCanVibrate] = useState(false);
  useEffect(() => setCanVibrate(hapticsSupported()), []);
  return (
    <>
      <div className="field">
        <span className="label" id="fx-sound-label">
          Sound
        </span>
        <div className="seg" role="group" aria-labelledby="fx-sound-label">
          <button type="button" className="seg__opt" aria-pressed={!s.sound} onClick={() => s.sound && toggleSound()}>
            Off
          </button>
          <button type="button" className="seg__opt" aria-pressed={s.sound} onClick={() => !s.sound && toggleSound()}>
            On
          </button>
        </div>
        <span className="hint">Press M to toggle.</span>
      </div>
      {canVibrate && (
        <div className="field">
          <span className="label" id="fx-haptics-label">
            Vibration
          </span>
          <div className="seg" role="group" aria-labelledby="fx-haptics-label">
            <button type="button" className="seg__opt" aria-pressed={!s.haptics} onClick={() => setSettings({ haptics: false })}>
              Off
            </button>
            <button type="button" className="seg__opt" aria-pressed={s.haptics} onClick={() => setSettings({ haptics: true })}>
              On
            </button>
          </div>
        </div>
      )}
    </>
  );
}
