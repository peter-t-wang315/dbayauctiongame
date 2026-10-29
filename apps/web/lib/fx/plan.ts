import type { FxEvent } from './events';
import type { SfxName } from './sfx';

/** Which sound an event makes (null = silent). */
export function sfxFor(e: FxEvent): SfxName | null {
  switch (e.t) {
    case 'bump':
      return e.mine ? 'chirp' : 'tok';
    case 'yourTurn':
      return 'bell';
    case 'outbid':
      return 'sting';
    case 'extended':
      return 'ting';
    case 'sold':
      return e.mine ? 'gavelWon' : 'gavel';
    case 'collection':
      return e.mine ? 'fanfare' : null;
    case 'gong':
      return 'gong';
    case 'reveal':
      return null;
  }
}

/** Higher plays first when a snapshot has more events than the per-snapshot sound cap. */
const PRIORITY: Partial<Record<SfxName, number>> = {
  gavelWon: 6,
  sting: 5,
  bell: 4,
  gavel: 3,
  fanfare: 2,
  gong: 2,
  chirp: 1,
};

/**
 * The sounds one snapshot's events make, at most `max`, most important first (playtest follow-up
 * slice 3: a sale or outbid must not lose its sound to a bid "tok" in the same snapshot). A bump on a
 * bay I was just outbid on is dropped (the sting replaces its tok), repeats collapse to one, and
 * my win replaces a plain gavel for other sales in the same batch.
 */
export function pickSfx(events: readonly FxEvent[], max: number): SfxName[] {
  const outbidBays = new Set(events.flatMap((e) => (e.t === 'outbid' ? [e.bay] : [])));
  const names: { s: SfxName; i: number }[] = [];
  events.forEach((e, i) => {
    if (e.t === 'bump' && outbidBays.has(e.bay)) return;
    const s = sfxFor(e);
    if (s && !names.some((x) => x.s === s)) names.push({ s, i });
  });
  const hasWon = names.some((x) => x.s === 'gavelWon');
  return names
    .filter((x) => !(hasWon && x.s === 'gavel'))
    .sort((a, b) => (PRIORITY[b.s] ?? 0) - (PRIORITY[a.s] ?? 0) || a.i - b.i)
    .slice(0, Math.max(0, max))
    .map((x) => x.s);
}
