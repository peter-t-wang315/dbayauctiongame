'use client';
import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 1024px)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/** True at >=1024px. Desktop-only components mount only then, so phones keep the exact same DOM. */
export function useDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
