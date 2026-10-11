import { DEMO_CODE, startMockServer } from './server';

const port = Number(process.env.PORT ?? 8787);
const server = await startMockServer(port);
console.log(`[mock] dBay mock server on http://localhost:${server.port}`);
console.log(
  `[mock] WebSocket: ws://localhost:${server.port}/parties/room/<CODE>  (demo room: ${DEMO_CODE})`,
);
console.log('[mock] POST /api/rooms creates a room. Add bots in the lobby to reach 3 players.');
