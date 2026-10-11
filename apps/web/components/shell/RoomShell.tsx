'use client';
// Mounted by app/r/[code]/layout.tsx: one RoomClient per code, shared by every route under it
// (lobby here, the game route owned by WS5), plus the reconnect overlay.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { normalizeRoomCode } from '@dbay/protocol';
import { RoomProvider, useRoom } from '../../lib/net/useRoom';
import type { Fatal } from '../../lib/net/client';
import { MessageCard } from './MessageCard';
import { ReconnectOverlay } from './ReconnectOverlay';

export const FATAL_COPY: Record<Fatal, { title: string; body: string }> = {
  notfound: { title: 'No such room', body: 'Check the code and try again.' },
  full: { title: 'Room is full', body: 'This room is full (6/6).' },
  started: {
    title: 'Game in progress',
    body: 'This game already started. Ask the host to rejoin you.',
  },
  kicked: { title: 'Removed', body: 'You were removed from this room.' },
  banned: { title: 'Removed', body: 'You were removed from this room.' },
  expired: { title: 'Room expired', body: 'This room has closed. Start a new one.' },
  ended: { title: 'Room ended', body: "You've been removed or the room ended." },
  version: { title: 'Update needed', body: 'Reload the page to get the latest version.' },
};

function Inner({ children }: { children: ReactNode }) {
  const room = useRoom();
  if (room.fatal) {
    const copy = FATAL_COPY[room.fatal];
    return (
      <MessageCard
        title={copy.title}
        actions={
          <Link className="btn" href="/">
            Home
          </Link>
        }
      >
        <p className="hint">{copy.body}</p>
      </MessageCard>
    );
  }
  const away = room.status === 'reconnecting' || (room.status === 'connecting' && !!room.view);
  return (
    <>
      {children}
      <ReconnectOverlay show={away} />
    </>
  );
}

export function RoomShell({ code, children }: { code: string; children: ReactNode }) {
  const normalized = normalizeRoomCode(code);
  if (!normalized) {
    return (
      <MessageCard
        title="No such room"
        actions={
          <Link className="btn" href="/">
            Home
          </Link>
        }
      >
        <p className="hint">Check the code and try again.</p>
      </MessageCard>
    );
  }
  return (
    <RoomProvider code={normalized}>
      <Inner>{children}</Inner>
    </RoomProvider>
  );
}
