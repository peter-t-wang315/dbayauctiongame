// Pre-join room summary: GET /api/rooms/:code/info (05 section 5) plus the pure view logic for it.
import type { RoomInfo } from '@dbay/protocol';
import { gameHost, httpBase } from './config';

/** Fetch the public room summary. Returns null when the server can't be asked (caller falls back). */
export async function fetchRoomInfo(
  code: string,
  host = gameHost(),
  signal?: AbortSignal,
): Promise<RoomInfo | null> {
  try {
    const res = await fetch(`${httpBase(host)}/api/rooms/${encodeURIComponent(code)}/info`, {
      signal,
    });
    if (res.status !== 200 && res.status !== 404) return null;
    const body = (await res.json()) as Partial<RoomInfo> | null;
    if (body?.exists === false) return { exists: false };
    if (
      body?.exists === true &&
      typeof body.players === 'number' &&
      typeof body.maxPlayers === 'number' &&
      typeof body.phase === 'string' &&
      (body.mode === 'classic' || body.mode === 'frenzy')
    ) {
      return body as RoomInfo;
    }
    return null;
  } catch {
    return null;
  }
}

export type JoinInfoView =
  | { kind: 'unknown' }
  | { kind: 'ok'; line: string }
  | { kind: 'notfound' | 'started' | 'full' };

const MODE_LABEL = { classic: 'Classic', frenzy: 'Frenzy' } as const;

/** Decide what the join screen shows for a (possibly missing) room summary. */
export function describeRoomInfo(code: string, info: RoomInfo | null): JoinInfoView {
  if (!info) return { kind: 'unknown' };
  if (!info.exists) return { kind: 'notfound' };
  if (info.phase !== 'lobby') return { kind: 'started' };
  if (info.players >= info.maxPlayers) return { kind: 'full' };
  const who = info.hostName ? ` · Host ${info.hostName}` : '';
  return {
    kind: 'ok',
    line: `Room ${code} · ${info.players}/${info.maxPlayers} players · ${MODE_LABEL[info.mode]}${who}`,
  };
}
