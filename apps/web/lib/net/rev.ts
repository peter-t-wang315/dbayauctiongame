// Snapshot ordering (05 section 6.5): ignore any snap with rev <= current.
// After (re)connecting the gate is reset and the first snapshot is always accepted.

export class RevGate {
  private current: number | null = null;

  /** True if the snapshot is newer than everything seen so far (and records it). */
  accept(rev: number): boolean {
    if (this.current !== null && rev <= this.current) return false;
    this.current = rev;
    return true;
  }

  reset(): void {
    this.current = null;
  }

  get rev(): number {
    return this.current ?? 0;
  }
}
