// HTTP + WebSocket mock of the Worker (05 sections 5-6): POST /api/rooms and /parties/room/:code.
import { createServer, type Server } from 'node:http';
import {
  MAX_INBOUND_BYTES,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
  parseClientFrame,
  type ServerMsg,
} from '@dbay/protocol';
import { WebSocketServer, type WebSocket } from 'ws';
import { MockRoom } from './room';

/** A room that always exists, so `/r/DBAYS` works without creating one. */
export const DEMO_CODE = 'DBAYS';

export interface MockServer {
  port: number;
  rooms: Map<string, MockRoom>;
  close(): Promise<void>;
}

function newCode(rooms: Map<string, MockRoom>): string {
  for (;;) {
    const code = Array.from(
      { length: ROOM_CODE_LENGTH },
      () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
    ).join('');
    if (!rooms.has(code)) return code;
  }
}

export function startMockServer(port = 8787, log = console.log): Promise<MockServer> {
  const rooms = new Map<string, MockRoom>();
  const sockets = new Map<string, Set<WebSocket>>(); // `${code}/${playerId}` -> sockets

  const makeRoom = (code: string) => {
    const room = new MockRoom(code, {
      toPlayer(playerId, msg: ServerMsg) {
        for (const ws of sockets.get(`${code}/${playerId}`) ?? []) ws.send(JSON.stringify(msg));
      },
      close(playerId) {
        for (const ws of sockets.get(`${code}/${playerId}`) ?? []) ws.close(4000, 'kicked');
        sockets.delete(`${code}/${playerId}`);
      },
    });
    rooms.set(code, room);
    return room;
  };
  makeRoom(DEMO_CODE);

  const http: Server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    if (req.method === 'POST' && req.url === '/api/rooms') {
      const code = newCode(rooms);
      makeRoom(code);
      log(`[mock] created room ${code}`);
      return void res
        .writeHead(201, { 'content-type': 'application/json' })
        .end(JSON.stringify({ code }));
    }
    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_INBOUND_BYTES });
  http.on('upgrade', (req, socket, head) => {
    const match = /^\/parties\/room\/([^/?]+)/.exec(req.url ?? '');
    const code = match ? normalizeRoomCode(decodeURIComponent(match[1]!)) : null;
    const room = code ? rooms.get(code) : undefined;
    if (!code || !room) {
      socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      let bound: string | null = null;
      const bind = (playerId: string | null) => {
        if (playerId === bound) return;
        if (bound) sockets.get(`${code}/${bound}`)?.delete(ws);
        bound = playerId;
        if (bound) {
          const key = `${code}/${bound}`;
          if (!sockets.has(key)) sockets.set(key, new Set());
          sockets.get(key)!.add(ws);
        }
      };
      ws.on('message', (data) => {
        const parsed = parseClientFrame(data.toString());
        if (!parsed.ok) return void ws.send(JSON.stringify({ t: 'err', code: parsed.code }));
        const msg = parsed.msg;
        // Bind before handling so welcome/snap reach this socket.
        if (msg.t === 'hello') bind(msg.playerId);
        const result = room.handle(bound, msg, (m) => ws.send(JSON.stringify(m)));
        if (msg.t === 'join' && result) {
          bind(result);
          room.sendSnap(result);
        } else if (msg.t === 'hello' && !result) {
          bind(null);
        }
        if (msg.t === 'leave') bind(null);
      });
      ws.on('close', () => {
        const playerId = bound;
        bind(null);
        if (playerId && !sockets.get(`${code}/${playerId}`)?.size) room.disconnect(playerId);
      });
    });
  });

  const ticker = setInterval(() => rooms.forEach((r) => r.tick()), 200);

  return new Promise((resolve) => {
    http.listen(port, () => {
      const addr = http.address();
      const actual = typeof addr === 'object' && addr ? addr.port : port;
      resolve({
        port: actual,
        rooms,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(ticker);
            wss.clients.forEach((c) => c.terminate());
            http.close(() => done());
          }),
      });
    });
  });
}
