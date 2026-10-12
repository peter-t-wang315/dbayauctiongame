import type { Room } from './room';
import type { Limiter } from './limiter';

export interface Env {
  Room: DurableObjectNamespace<Room>;
  Limiter: DurableObjectNamespace<Limiter>;
  /** Comma-separated exact origins; `https://*.vercel.app` style suffix wildcard allowed. */
  ALLOWED_ORIGINS: string;
  LOG_LEVEL?: string;
  /** Room creations per IP per hour (default 10). */
  CREATE_LIMIT_PER_HOUR?: string;
  /** WebSocket upgrades per IP per minute (default 60). */
  JOIN_LIMIT_PER_MIN?: string;
}
