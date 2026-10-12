// Pixel sprite renderer (docs/03 "Sprites", 04 section 11): 12x12 rows of palette keys drawn as
// crisp SVG rects (horizontal runs merged). Decorative: aria-hidden, never the only identifier.
import { SHARED_PALETTE, type Sprite } from '@dbay/content/public';

export interface Run {
  x: number;
  y: number;
  w: number;
  fill: string;
}

/** Turn sprite rows into merged same-colour horizontal runs. Unknown keys and '.' are transparent. */
export function spriteRuns(sprite: Sprite): Run[] {
  const palette: Record<string, string> = { ...SHARED_PALETTE, ...(sprite.palette ?? {}) };
  const runs: Run[] = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x]!;
      const fill = key === '.' ? undefined : palette[key];
      if (!fill) {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w < row.length && row[x + w] === key) w += 1;
      runs.push({ x, y, w, fill });
      x += w;
    }
  });
  return runs;
}

export function SpriteView({ sprite, size }: { sprite: Sprite | null; size: number }) {
  return (
    <span className="g-sprite" aria-hidden="true" style={{ width: size, height: size }}>
      {sprite && (
        <svg
          viewBox="0 0 12 12"
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
          style={{ imageRendering: 'pixelated', display: 'block' }}
        >
          {spriteRuns(sprite).map((r) => (
            <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
          ))}
        </svg>
      )}
    </span>
  );
}
