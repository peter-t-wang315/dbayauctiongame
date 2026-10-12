'use client';
// Layout slot for the in-game screen. WS5 replaces the placeholder body with its GameScreen
// (owned by WS5) and keeps the status strip slot. The shell guarantees: RoomProvider is mounted
// (useRoom() works), the reconnect overlay is shown, and this only renders when phase != lobby.
import type { ReactNode } from 'react';
import { useRoom } from '../../lib/net/useRoom';

export function GameSlot({ children }: { children?: ReactNode }) {
  const { view } = useRoom();
  return (
    <div className="game-slot" data-phase={view?.phase}>
      <div className="game-slot__strip" role="status" aria-live="polite">
        {/* status strip placeholder (44px): WS5 */}
        Game in progress ({view?.phase ?? '...'})
      </div>
      <div className="game-slot__body">
        {children ?? (
          <p className="hint">GameScreen placeholder. WS5 renders the game here.</p>
        )}
      </div>
    </div>
  );
}
