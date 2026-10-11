'use client';
// /r/CODE: join form -> lobby -> game slot, chosen by the room state.
import { GameSlot } from '../../../components/shell/GameSlot';
import { JoinForm } from '../../../components/shell/JoinForm';
import { Lobby } from '../../../components/lobby/Lobby';
import { useRoom } from '../../../lib/net/useRoom';

export default function RoomPage() {
  const room = useRoom();

  if (room.needsJoin) return <JoinForm />;
  if (!room.view) {
    return (
      <main className="page" aria-busy="true">
        <h1 className="sr-only">Connecting to room {room.code}</h1>
        <div className="skeleton" style={{ height: 32, width: '50%' }} />
        <div className="skeleton" style={{ height: 160 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </main>
    );
  }
  if (room.view.phase === 'lobby') return <Lobby />;
  return <GameSlot />;
}
