import { PlayerViewSchema } from '@dbay/protocol';
import { describe, expect, it } from 'vitest';
import { createRoom, view, type RoomState } from '../src/index';

describe('room-core stub (WS0 contract smoke test)', () => {
  it('lobby view validates against the protocol schema and never exposes secrets', () => {
    const room: RoomState = createRoom('K7QMX', 0);
    room.meta.hostId = 'p1';
    room.players.push({ id: 'p1', name: 'Peter', seat: 0, isBot: false, secretHash: 'deadbeef', connected: true, joinedAt: 0, lastSeen: 0, lastSeq: 0 });
    const v = view(room, 'p1');
    expect(PlayerViewSchema.safeParse(v).success).toBe(true);
    expect(JSON.stringify(v)).not.toContain('deadbeef');
  });
});
