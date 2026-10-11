'use client';
// React binding for RoomClient. `RoomProvider` (mounted by app/r/[code]/layout.tsx) owns one
// client per room code; `useRoom()` reads it. WS5's game route uses the same hook.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { PlayerView } from '@dbay/protocol';
import { RoomClient, type ActionInput, type RoomState, type SendResult } from './client';
import { wsUrl } from './config';
import { holdWakeLock } from './wakeLock';

export interface UseRoom extends RoomState {
  code: string;
  /** The latest accepted PlayerView (alias of `view`). */
  view: PlayerView | null;
  send: (action: ActionInput) => Promise<SendResult>;
  join: (name: string) => void;
  leave: () => void;
  /** Estimated server time in ms; use with `endsAt` for countdowns. */
  serverNow: () => number;
  /** True when the player is the host (lobby controls). */
  isHost: boolean;
}

const RoomContext = createContext<UseRoom | null>(null);

const SERVER_STATE: RoomState = {
  status: 'connecting',
  view: null,
  rev: 0,
  playerId: null,
  needsJoin: false,
  joining: false,
  fatal: null,
  error: null,
  attempt: 0,
};

export function RoomProvider({ code, children }: { code: string; children: ReactNode }) {
  const [client, setClient] = useState<RoomClient | null>(null);

  useEffect(() => {
    const c = new RoomClient({ code, url: wsUrl(code) });
    setClient(c);
    c.start();
    const onVisible = () => {
      if (document.visibilityState === 'visible') c.resume();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      c.dispose();
      setClient(null);
    };
  }, [code]);

  const state = useSyncExternalStore(
    client ? client.subscribe : noopSubscribe,
    client ? client.getState : getServerState,
    getServerState,
  );

  const playing = state.view?.phase === 'playing';
  useEffect(() => (playing ? holdWakeLock() : undefined), [playing]);

  const send = useCallback(
    (a: ActionInput) =>
      client ? client.send(a) : Promise.resolve<SendResult>({ ok: false, code: 'OFFLINE' }),
    [client],
  );
  const join = useCallback((name: string) => client?.join(name), [client]);
  const leave = useCallback(() => client?.leave(), [client]);
  const serverNow = useCallback(() => (client ? client.serverNow() : Date.now()), [client]);

  const value = useMemo<UseRoom>(
    () => ({
      ...state,
      code,
      send,
      join,
      leave,
      serverNow,
      isHost: !!state.view && state.view.hostId === state.view.me,
    }),
    [state, code, send, join, leave, serverNow],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

const noopSubscribe = () => () => {};
const getServerState = () => SERVER_STATE;

export function useRoom(): UseRoom {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used inside <RoomProvider> (app/r/[code]/layout.tsx)');
  return ctx;
}
