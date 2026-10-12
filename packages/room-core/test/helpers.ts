// Test harness: a tiny wrapper around reduce() that records the event log and all effects.
import type { ClientAction, ServerMsg } from '@dbay/protocol';
import { PROTOCOL_VERSION } from '@dbay/protocol';
import { createRoom, reduce, type Effect, type RoomEvent, type RoomState } from '../src/index';

export const T0 = 1_000_000;
type DistOmit<T, K extends string> = T extends unknown ? Omit<T, K> : never;
export type ActMsg = DistOmit<ClientAction, 'seq'> & { seq?: number };
export const hashOf = (secret: string) => `h(${secret})`;

export class Harness {
  state: RoomState;
  now = T0;
  events: Array<{ event: RoomEvent; now: number }> = [];
  effects: Effect[] = [];
  last: Effect[] = [];
  private seqs = new Map<string, number>();
  private n = 0;

  constructor(code = 'K7QMX') {
    this.state = createRoom(code, T0);
  }

  run(event: RoomEvent, at?: number): Effect[] {
    if (at !== undefined) this.now = at;
    this.events.push({ event, now: this.now });
    const r = reduce(this.state, event, this.now);
    this.state = r.state;
    this.last = r.effects;
    this.effects.push(...r.effects);
    return r.effects;
  }

  advance(ms: number): Effect[] {
    this.now += ms;
    return this.run({ type: 'tick' });
  }

  tickTo(at: number): Effect[] {
    this.now = at;
    return this.run({ type: 'tick' });
  }

  join(name: string, id = `p${++this.n}`): string {
    this.run({
      type: 'join',
      conn: `c-${id}`,
      name,
      playerId: id,
      secret: `s-${id}`,
      secretHash: hashOf(`s-${id}`),
    });
    return id;
  }

  act(playerId: string, msg: ActMsg): Effect[] {
    const seq = msg.seq ?? (this.seqs.get(playerId) ?? 0) + 1;
    this.seqs.set(playerId, Math.max(seq, this.seqs.get(playerId) ?? 0));
    return this.run({ type: 'action', playerId, msg: { ...msg, seq } as ClientAction });
  }

  /** Host sets seed then starts. */
  start(seed = 'seed-for-tests'): Effect[] {
    this.run({ type: 'seed', seed });
    return this.act(this.state.meta.hostId!, { t: 'start' });
  }

  /** Lobby with `humans` humans and `bots` bots, started. */
  static started(
    humans: number,
    bots: number,
    opts?: Omit<Extract<ActMsg, { t: 'setOpts' }>, 't' | 'seq'>,
    seed?: string,
  ): Harness {
    const h = new Harness();
    for (let i = 0; i < humans; i++) h.join(`Player${i + 1}`);
    const host = h.state.meta.hostId!;
    for (let i = 0; i < bots; i++) h.act(host, { t: 'addBot' });
    if (opts) h.act(host, { t: 'setOpts', ...opts });
    h.start(seed);
    return h;
  }

  sends(effects: Effect[] = this.last): Array<{ to: unknown; msg: ServerMsg }> {
    return effects.flatMap((e) => (e.type === 'send' ? [{ to: e.to, msg: e.msg }] : []));
  }

  /** The ack for a seq in the last effects. */
  ack(effects: Effect[] = this.last): ServerMsg | undefined {
    return this.sends(effects).find((s) => s.msg.t === 'ack')?.msg;
  }

  errCode(effects: Effect[] = this.last): string | undefined {
    const m = this.sends(effects).find(
      (s) => s.msg.t === 'err' || (s.msg.t === 'ack' && !s.msg.ok),
    )?.msg;
    return m && 'code' in m ? m.code : undefined;
  }
}

export { PROTOCOL_VERSION };
