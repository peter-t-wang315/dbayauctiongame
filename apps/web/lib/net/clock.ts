// Clock-offset estimator (05 section 6.6).
// For each ping/pong sample: rtt = recvTime - c; offset = now + rtt/2 - recvTime.
// Estimate = median of the offsets of the (up to) 5 lowest-RTT samples.

export interface ClockSample {
  rtt: number;
  offset: number;
}

const BEST_N = 5;
const MAX_SAMPLES = 40;

export function sampleFromPong(sentAt: number, recvAt: number, serverNow: number): ClockSample {
  const rtt = Math.max(0, recvAt - sentAt);
  return { rtt, offset: serverNow + rtt / 2 - recvAt };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Median offset of the lowest-RTT samples; 0 when there are no samples. */
export function estimateOffset(samples: readonly ClockSample[], bestN = BEST_N): number {
  const best = [...samples].sort((a, b) => a.rtt - b.rtt).slice(0, bestN);
  return median(best.map((s) => s.offset));
}

export class ClockEstimator {
  private samples: ClockSample[] = [];

  add(sample: ClockSample): void {
    this.samples.push(sample);
    // Bounded memory: drop the oldest so drift is still tracked.
    if (this.samples.length > MAX_SAMPLES) this.samples.splice(0, this.samples.length - MAX_SAMPLES);
  }

  addPong(sentAt: number, recvAt: number, serverNow: number): void {
    this.add(sampleFromPong(sentAt, recvAt, serverNow));
  }

  get count(): number {
    return this.samples.length;
  }

  get offset(): number {
    return estimateOffset(this.samples);
  }

  /** Estimated server time for a local timestamp. */
  serverNow(localNow: number): number {
    return localNow + this.offset;
  }
}
