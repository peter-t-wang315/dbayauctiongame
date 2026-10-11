import type { ReactNode } from 'react';
import type { PlayerColor } from '@dbay/protocol';

const COLOR_LABEL: Record<PlayerColor, string> = {
  red: 'Red',
  blue: 'Blue',
  yellow: 'Yellow',
  green: 'Green',
  purple: 'Purple',
  teal: 'Teal',
};

/** Identity is always color + shape + name, never color alone (04 section 8). */
export function PlayerChip({
  color,
  shape,
  name,
  tags,
  children,
}: {
  color: PlayerColor;
  shape: string;
  name: string;
  tags?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <span className={`chip chip--p-${color}`}>
      <span className="chip__shape" aria-hidden="true">
        {shape}
      </span>
      <span className="sr-only">{COLOR_LABEL[color]} </span>
      <span className="chip__name">{name}</span>
      {tags}
      {children}
    </span>
  );
}
