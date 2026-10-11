'use client';
import { useCallback, useState } from 'react';
import { MAX_PLAYERS, NameSchema, type PlayerView } from '@dbay/protocol';
import { BottomSheet } from '../shell/BottomSheet';
import { PlayerChip } from '../shell/PlayerChip';
import type { SendResult } from '../../lib/net/client';

type Player = PlayerView['players'][number];

export function PlayerGrid({
  view,
  onRename,
  onKick,
  onRemoveBot,
}: {
  view: PlayerView;
  onRename: (name: string) => Promise<SendResult>;
  onKick: (id: string) => Promise<SendResult>;
  onRemoveBot: (id: string) => Promise<SendResult>;
}) {
  const isHost = view.hostId === view.me;
  const [renaming, setRenaming] = useState(false);
  const [target, setTarget] = useState<Player | null>(null);
  const closeRename = useCallback(() => setRenaming(false), []);
  const closeTarget = useCallback(() => setTarget(null), []);
  const me = view.players.find((p) => p.id === view.me);
  const empty = Math.max(0, MAX_PLAYERS - view.players.length);

  return (
    <>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 8,
        }}
      >
        {view.players.map((p) => {
          const mine = p.id === view.me;
          return (
            <li key={p.id} style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
              {mine ? (
                <button
                  type="button"
                  style={{ all: 'unset', flex: 1, minWidth: 0, cursor: 'pointer' }}
                  aria-label={`${p.name} (you). Tap to rename`}
                  onClick={() => setRenaming(true)}
                >
                  <PlayerChip
                    color={p.color}
                    shape={p.shape}
                    name={p.name}
                    tags={<Tags p={p} hostId={view.hostId} you />}
                  />
                </button>
              ) : (
                <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
                  <PlayerChip
                    color={p.color}
                    shape={p.shape}
                    name={p.name}
                    tags={<Tags p={p} hostId={view.hostId} />}
                  />
                </div>
              )}
              {isHost && !mine && (
                <button
                  type="button"
                  className="btn btn--small"
                  aria-label={`${p.isBot ? 'Remove bot' : 'Kick'} ${p.name}`}
                  onClick={() => setTarget(p)}
                >
                  <span aria-hidden="true">⋮</span>
                </button>
              )}
            </li>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <li key={`empty-${i}`}>
            <span className="chip chip--empty" style={{ width: '100%' }}>
              + empty seat
            </span>
          </li>
        ))}
      </ul>

      {renaming && (
        <RenameSheet
          initial={me?.name ?? ''}
          onClose={closeRename}
          onSubmit={async (name) => {
            const r = await onRename(name);
            if (r.ok) setRenaming(false);
            return r;
          }}
        />
      )}

      <BottomSheet
        open={!!target}
        onClose={closeTarget}
        title={target?.isBot ? `Remove ${target.name}?` : `Kick ${target?.name ?? ''}?`}
      >
        {!target?.isBot && (
          <p className="hint">They will be removed from this room and cannot rejoin it.</p>
        )}
        <button
          type="button"
          className="btn btn--danger"
          onClick={async () => {
            if (!target) return;
            await (target.isBot ? onRemoveBot(target.id) : onKick(target.id));
            setTarget(null);
          }}
        >
          {target?.isBot ? 'Remove bot' : 'Kick player'}
        </button>
        <button type="button" className="btn" onClick={closeTarget}>
          Cancel
        </button>
      </BottomSheet>
    </>
  );
}

function Tags({ p, hostId, you }: { p: Player; hostId: string; you?: boolean }) {
  return (
    <>
      {p.id === hostId && <span className="tag">HOST</span>}
      {you && <span className="tag">YOU</span>}
      {p.isBot && <span className="tag">BOT</span>}
      {!p.connected && !p.isBot && <span className="tag">AWAY</span>}
    </>
  );
}

function RenameSheet({
  initial,
  onClose,
  onSubmit,
}: {
  initial: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<SendResult>;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  return (
    <BottomSheet open onClose={onClose} title="Rename">
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = NameSchema.safeParse(name);
          if (!parsed.success) return setError('Pick a name, 1 to 16 characters.');
          const r = await onSubmit(parsed.data);
          if (!r.ok) setError('That name is not allowed.');
        }}
      >
        <div className="field">
          <label htmlFor="rename">Your name</label>
          <input
            id="rename"
            className="input"
            value={name}
            maxLength={16}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            aria-describedby={error ? 'rename-error' : undefined}
            aria-invalid={error ? true : undefined}
          />
          {error && (
            <p id="rename-error" className="error-text">
              {error}
            </p>
          )}
        </div>
        <button type="submit" className="btn btn--primary">
          Save
        </button>
      </form>
    </BottomSheet>
  );
}
