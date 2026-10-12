// Worker entry (05 sections 6.4, 12, 13): POST /api/rooms, WebSocket upgrade routing with Origin
// check, CORS, rate limits. Everything else (including a plain GET /) answers with a small text body.
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, normalizeRoomCode } from '@dbay/protocol';
import { getServerByName, routePartykitRequest } from 'partyserver';
import { randomCode } from './crypto';
import type { Env } from './env';
import { corsHeaders, originAllowed } from './origin';

export { Room } from './room';
export { Limiter } from './limiter';
export type { Env } from './env';

function json(body: unknown, status: number, extra?: Headers): Response {
  const h = new Headers(extra);
  h.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers: h });
}

async function allow(env: Env, key: string, limit: number, windowMs: number): Promise<boolean> {
  const stub = env.Limiter.get(env.Limiter.idFromName(key));
  return stub.hit(limit, windowMs);
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

function clientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'local';
}

async function createRoom(request: Request, env: Env, cors: Headers): Promise<Response> {
  if (
    !(await allow(
      env,
      `create:${clientIp(request)}`,
      num(env.CREATE_LIMIT_PER_HOUR, 10),
      3_600_000,
    ))
  )
    return json({ error: 'RATE_LIMITED' }, 429, cors);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);
    const stub = await getServerByName(env.Room, code);
    const res = await stub.fetch(new Request(`https://room.internal/__init`, { method: 'POST' }));
    if (res.status === 201) return json({ code }, 201, cors);
    if (res.status !== 409) break;
  }
  return json({ error: 'INTERNAL' }, 500, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (url.pathname === '/api/rooms') {
      if (request.method === 'OPTIONS') {
        return originAllowed(origin, env.ALLOWED_ORIGINS)
          ? new Response(null, { status: 204, headers: cors })
          : new Response('Forbidden', { status: 403 });
      }
      if (request.method !== 'POST') return json({ error: 'METHOD' }, 405, cors);
      if (!originAllowed(origin, env.ALLOWED_ORIGINS)) return json({ error: 'FORBIDDEN' }, 403);
      return createRoom(request, env, cors);
    }

    if (url.pathname.startsWith('/parties/')) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
        return new Response('Not found', { status: 404 });
      if (!originAllowed(origin, env.ALLOWED_ORIGINS))
        return new Response('Forbidden', { status: 403 });
      // /parties/room/<CODE>; unknown but well-formed codes connect and get ROOM_NOT_FOUND on hello.
      const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '');
      const code = normalizeRoomCode(raw) === raw ? raw : null;
      if (!code || url.pathname.split('/').length !== 4)
        return new Response('Not found', { status: 404 });
      if (!(await allow(env, `join:${clientIp(request)}`, num(env.JOIN_LIMIT_PER_MIN, 60), 60_000)))
        return new Response('Too many requests', { status: 429 });
      return (
        (await routePartykitRequest(request, env, { prefix: 'parties' })) ??
        new Response('Not found', { status: 404 })
      );
    }

    // Plain GET (health / probe): any status is fine for the web client's "is the host up" probe.
    return new Response('dBay room server', { status: 200, headers: cors });
  },
} satisfies ExportedHandler<Env>;
