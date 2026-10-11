// WS0 bare scaffold. WS3b implements the Room around @dbay/room-core (05 section 7).
import type { ServerMsg } from '@dbay/protocol';
import { routePartykitRequest, Server, type Connection } from 'partyserver';

export interface Env {
  Room: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS: string;
  LOG_LEVEL?: string;
}

export class Room extends Server<Env> {
  static override options = { hibernate: true };

  override onConnect(conn: Connection) {
    const msg: ServerMsg = {
      t: 'err',
      code: 'INTERNAL',
      msg: 'Room server not implemented yet (WS3b).',
    };
    conn.send(JSON.stringify(msg));
    conn.close(1011, 'not implemented');
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routePartykitRequest(request, env)) ?? new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
