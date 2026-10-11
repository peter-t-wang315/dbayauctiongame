'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { NameSchema } from '@dbay/protocol';
import { loadName } from '../../lib/identity';
import { useRoom } from '../../lib/net/useRoom';
import { runAudioUnlock } from './audioUnlock';

export function JoinForm() {
  const room = useRoom();
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setName((n) => n || loadName());
  }, []);

  const serverNameError = room.error?.code === 'NAME_INVALID';
  const staleSeat = room.error?.code === 'BAD_SECRET';
  const error = localError ?? (serverNameError ? 'That name is not allowed.' : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = NameSchema.safeParse(name);
    if (!parsed.success) {
      setLocalError('Pick a name, 1 to 16 characters.');
      return;
    }
    setLocalError(null);
    runAudioUnlock(); // user gesture: unlock Web Audio (WS8 registers the hook)
    room.join(parsed.data);
  };

  return (
    <main className="page">
      <h1 style={{ margin: 0, font: '400 28px/1.2 var(--font-display)' }}>
        Room <span style={{ letterSpacing: 3 }}>{room.code}</span>
      </h1>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
        {staleSeat && (
          <p className="hint" role="status">
            Your old seat is no longer valid. Join again to get a new one.
          </p>
        )}
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setLocalError(null);
            }}
            maxLength={16}
            autoComplete="nickname"
            autoFocus
            aria-describedby={error ? 'name-error' : 'name-hint'}
            aria-invalid={error ? true : undefined}
          />
          {error ? (
            <p id="name-error" className="error-text">
              {error}
            </p>
          ) : (
            <p id="name-hint" className="hint">
              16 characters max. A color and shape are assigned when you join.
            </p>
          )}
        </div>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={room.joining || room.status !== 'open'}
        >
          {room.joining ? 'JOINING...' : 'JOIN THE ROOM'}
        </button>
        <p className="hint">Sound is off. Change in the menu later.</p>
      </form>
    </main>
  );
}
