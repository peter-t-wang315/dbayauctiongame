'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BID_WINDOW_OPTIONS, MAX_PLAYERS, MIN_PLAYERS, type PlayerView } from '@dbay/protocol';
import { MoreSheet } from '../shell/MoreSheet';
import { useRoom } from '../../lib/net/useRoom';
import type { SendResult } from '../../lib/net/client';
import { PlayerGrid } from './PlayerGrid';

// Median game length ranges in minutes from docs/02 section 5 (human pacing, after PR #21).
// Classic: [quick, standard] per player count 3..6; Frenzy does not vary with player count.
const CLASSIC_MIN: Record<number, [string, string]> = {
  3: ['4-6', '5-8'],
  4: ['6-8', '8-11'],
  5: ['8-10', '11-14'],
  6: ['9-12', '14-18'],
};
const FRENZY_MIN: [string, string] = ['4-7', '6-10'];

export function lengthHint(classic: boolean, length: 'quick' | 'standard', seats: number): string {
  const i = length === 'quick' ? 0 : 1;
  const n = Math.min(6, Math.max(3, seats));
  const range = classic ? CLASSIC_MIN[n]![i] : FRENZY_MIN[i];
  return classic ? `About ${range} min with ${n} players.` : `About ${range} min.`;
}

const ERROR_COPY: Record<string, string> = {
  NOT_HOST: 'Only the host can do that.',
  NOT_ENOUGH_PLAYERS: `Need at least ${MIN_PLAYERS} players.`,
  ROOM_FULL: 'The room is full.',
  WRONG_PHASE: 'The game already started.',
  BAD_OPTS: 'Those settings are not allowed.',
  NAME_INVALID: 'That name is not allowed.',
  RATE_LIMITED: 'Slow down a little.',
  OFFLINE: 'You are offline. Reconnecting...',
  TIMEOUT: 'The server did not answer. Try again.',
};

export function Lobby() {
  const room = useRoom();
  const view = room.view as PlayerView;
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (copyTimer.current && clearTimeout(copyTimer.current)), []);

  const run = useCallback(
    async (p: Promise<SendResult>) => {
      const r = await p;
      setMessage(r.ok ? null : (ERROR_COPY[r.code] ?? 'Something went wrong. Try again.'));
      return r;
    },
    [setMessage],
  );

  const copyLink = async () => {
    const url = `${window.location.origin}/r/${view.code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link', url); // clipboard blocked (insecure origin / permissions)
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const host = view.players.find((p) => p.id === view.hostId);
  const isHost = view.hostId === view.me;
  const seats = view.players.length;
  const canStart = seats >= MIN_PLAYERS;
  const classic = view.opts.mode === 'classic';

  return (
    <main className="page">
      <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1 style={{ margin: 0, flex: 1, font: '400 26px/1.1 var(--font-display)' }}>
          Room <span style={{ letterSpacing: 3 }}>{view.code}</span>
        </h1>
        <button type="button" className="btn btn--small" onClick={copyLink}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <MoreSheet onLeave={room.leave} />
      </header>

      <section className="panel" aria-labelledby="players-h">
        <h2 id="players-h">
          Players {seats}/{MAX_PLAYERS}
        </h2>
        <PlayerGrid
          view={view}
          onRename={(name) => run(room.send({ t: 'rename', name }))}
          onKick={(id) => run(room.send({ t: 'kick', playerId: id }))}
          onRemoveBot={(id) => run(room.send({ t: 'rmBot', playerId: id }))}
        />
        {isHost && seats < MAX_PLAYERS && (
          <button type="button" className="btn" onClick={() => run(room.send({ t: 'addBot' }))}>
            + Add bot
          </button>
        )}
      </section>

      <section className="panel" aria-labelledby="opts-h">
        <h2 id="opts-h">Game settings</h2>
        <div className="field">
          <span className="label" id="mode-l">
            Mode
          </span>
          <div className={isHost ? "seg" : "seg seg--readonly"} role="group" aria-labelledby="mode-l">
            {(['classic', 'frenzy'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="seg__opt"
                aria-pressed={view.opts.mode === m}
                disabled={!isHost}
                onClick={() => run(room.send({ t: 'setOpts', mode: m }))}
              >
                {m === 'classic' ? 'Classic' : 'Frenzy'}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label" id="len-l">
            Game length
          </span>
          <div className={isHost ? "seg" : "seg seg--readonly"} role="group" aria-labelledby="len-l">
            {(['quick', 'standard'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className="seg__opt"
                aria-pressed={(view.opts.length ?? 'standard') === l}
                disabled={!isHost}
                onClick={() => run(room.send({ t: 'setOpts', length: l }))}
              >
                {l === 'quick' ? 'Quick' : 'Standard'}
              </button>
            ))}
          </div>
          {/* Targets from docs/02 section 5 (median, human pacing). */}
          <span className="hint">
            {lengthHint(classic, view.opts.length ?? 'standard', seats)}
          </span>
        </div>
        <div className="field">
          <span className="label" id="win-l">
            Bid window {classic ? '' : '(Classic only)'}
          </span>
          <div className={isHost ? "seg" : "seg seg--readonly"} role="group" aria-labelledby="win-l">
            {BID_WINDOW_OPTIONS.map((ms) => (
              <button
                key={ms}
                type="button"
                className="seg__opt"
                aria-pressed={view.opts.bidWindowMs === ms}
                disabled={!isHost || !classic}
                onClick={() => run(room.send({ t: 'setOpts', bidWindowMs: ms }))}
              >
                {ms / 1000}s
              </button>
            ))}
          </div>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minHeight: 44,
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            style={{ width: 24, height: 24 }}
            checked={view.opts.relaxed}
            disabled={!isHost}
            onChange={(e) => run(room.send({ t: 'setOpts', relaxed: e.target.checked }))}
          />
          Relaxed timing x1.5
        </label>
        {!isHost && <p className="hint">Only the host can change settings.</p>}
      </section>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="error-text" role="status" aria-live="polite" hidden={!message}>
          {message}
        </p>
        {isHost ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canStart}
              onClick={() => run(room.send({ t: 'start' }))}
            >
              START GAME
            </button>
            {!canStart && <p className="hint">Need at least {MIN_PLAYERS} players</p>}
          </>
        ) : (
          <p className="hint" role="status">
            Waiting for {host?.name ?? 'the host'} to start...
          </p>
        )}
      </div>
    </main>
  );
}
