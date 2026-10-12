// Where the game server lives (05 section 13). Host has no scheme; it is derived.

const DEFAULT_HOST = 'localhost:8787';

export function gameHost(): string {
  return process.env.NEXT_PUBLIC_GAME_HOST || DEFAULT_HOST;
}

function isLocalHost(host: string): boolean {
  const name = host.replace(/:\d+$/, '');
  return (
    name === 'localhost' ||
    /^127\./.test(name) ||
    /^10\./.test(name) ||
    /^192\.168\./.test(name) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(name)
  );
}

export function httpBase(host = gameHost()): string {
  return `${isLocalHost(host) ? 'http' : 'https'}://${host}`;
}

export function wsUrl(code: string, host = gameHost()): string {
  return `${isLocalHost(host) ? 'ws' : 'wss'}://${host}/parties/room/${encodeURIComponent(code)}`;
}

export type CreateRoomResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'rate_limited' | 'error' };

export async function createRoom(host = gameHost()): Promise<CreateRoomResult> {
  try {
    const res = await fetch(`${httpBase(host)}/api/rooms`, { method: 'POST' });
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!res.ok) return { ok: false, reason: 'error' };
    const body = (await res.json()) as { code?: unknown };
    return typeof body.code === 'string'
      ? { ok: true, code: body.code }
      : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
