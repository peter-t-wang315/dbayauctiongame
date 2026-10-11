'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ROOM_CODE_LENGTH, normalizeRoomCode } from '@dbay/protocol';
import { createRoom } from '../lib/net/config';

export function LandingActions() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const create = async () => {
    setCreating(true);
    setCreateError(null);
    const res = await createRoom();
    if (res.ok) {
      router.push(`/r/${res.code}`);
      return;
    }
    setCreating(false);
    setCreateError(
      res.reason === 'rate_limited'
        ? 'Too many rooms. Wait a bit.'
        : "Couldn't make a room. Try again.",
    );
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeRoomCode(code);
    if (!normalized) {
      setCodeError(`Room codes are ${ROOM_CODE_LENGTH} letters or digits.`);
      return;
    }
    router.push(`/r/${normalized}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      <button
        type="button"
        className="btn btn--primary"
        onClick={create}
        disabled={creating}
        aria-busy={creating}
      >
        {creating ? <span className="spinner" aria-hidden="true" /> : null}
        {creating ? 'Creating...' : 'CREATE A ROOM'}
      </button>
      {createError && (
        <p className="error-text" role="alert">
          {createError}{' '}
          <button type="button" className="btn btn--small btn--ghost" onClick={create}>
            Retry
          </button>
        </p>
      )}

      <form onSubmit={join} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label htmlFor="code" className="sr-only">
          Room code
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="code"
            className="input input--code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/[\s-]/g, '').slice(0, ROOM_CODE_LENGTH));
              setCodeError(null);
            }}
            placeholder="ABCDE"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            maxLength={ROOM_CODE_LENGTH}
            aria-describedby={codeError ? 'code-error' : undefined}
            aria-invalid={codeError ? true : undefined}
          />
          <button type="submit" className="btn" style={{ minHeight: 48 }}>
            JOIN
          </button>
        </div>
        {codeError && (
          <p id="code-error" className="error-text">
            {codeError}
          </p>
        )}
      </form>
    </div>
  );
}
