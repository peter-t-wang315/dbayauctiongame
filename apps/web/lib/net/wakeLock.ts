// Screen Wake Lock while a game is being played (05 section 11). Best effort: unsupported
// browsers and denied requests are ignored. The lock is released by the browser when the tab
// is hidden, so it is re-requested on visibilitychange.

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

export function holdWakeLock(): () => void {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return () => {};
  const api = (
    navigator as unknown as {
      wakeLock: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
    }
  ).wakeLock;
  let sentinel: WakeLockSentinelLike | null = null;
  let stopped = false;

  const acquire = () => {
    if (stopped || document.visibilityState !== 'visible') return;
    api
      .request('screen')
      .then((s) => {
        if (stopped) void s.release().catch(() => {});
        else sentinel = s;
      })
      .catch(() => {});
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') acquire();
  };

  acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => {});
    sentinel = null;
  };
}
