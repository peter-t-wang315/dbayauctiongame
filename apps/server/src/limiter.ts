// Tiny sliding-window rate limiter Durable Object (05 section 12; decision in docs/progress/ws3b.md).
// One instance per key (e.g. `create:<ip>`), called over RPC from the Worker.
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

export class Limiter extends DurableObject<Env> {
  /** Records a hit and returns true if it is within `limit` hits per `windowMs`. */
  async hit(limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const prev = (await this.ctx.storage.get<number[]>('hits')) ?? [];
    const hits = prev.filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      await this.ctx.storage.put('hits', hits);
      return false;
    }
    hits.push(now);
    await this.ctx.storage.put('hits', hits);
    await this.ctx.storage.setAlarm(now + windowMs + 1000);
    return true;
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}
