'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createRoom } from '../../lib/net/config';
import { gotoRoom } from './gotoRoom';

/** "Create a new room" for terminal cards: makes a room and navigates to it. */
export function CreateRoomButton({ label = 'Create a new room' }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const create = async () => {
    setBusy(true);
    setFailed(false);
    const res = await createRoom();
    if (res.ok) return gotoRoom(router, res.code);
    setBusy(false);
    setFailed(true);
  };
  return (
    <button type="button" className="btn" onClick={create} disabled={busy} aria-busy={busy}>
      {busy ? 'Creating...' : failed ? "Couldn't create. Try again" : label}
    </button>
  );
}
