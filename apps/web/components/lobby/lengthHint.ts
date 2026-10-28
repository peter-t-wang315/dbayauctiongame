// Median game length ranges in minutes from docs/02 section 5 (human pacing, after PR #21).
// The doc has half minutes (e.g. 7.5-10); we round outward (floor the low end, ceil the high end)
// so the hint never promises a shorter or longer game than the targets.
// Classic: [quick, standard] per player count 3..6; Frenzy does not vary with player count.
type Range = readonly [number, number];
const CLASSIC_MIN: Record<number, readonly [Range, Range]> = {
  3: [[4, 6], [5, 8]],
  4: [[6, 8.5], [8, 11]],
  5: [[7.5, 10], [10.5, 14]],
  6: [[9, 12], [13.5, 18]],
};
const FRENZY_MIN: readonly [Range, Range] = [[3.5, 7], [5.5, 10]];

export function lengthHint(classic: boolean, length: 'quick' | 'standard', seats: number): string {
  const i = length === 'quick' ? 0 : 1;
  const n = Math.min(6, Math.max(3, seats));
  const [lo, hi] = classic ? CLASSIC_MIN[n]![i]! : FRENZY_MIN[i]!;
  const range = `${Math.floor(lo)}-${Math.ceil(hi)}`;
  return classic ? `About ${range} min with ${n} players.` : `About ${range} min.`;
}
