// "Card flies from the hand to the bay" (04 section 5, Pending state). A throwaway ghost chip is
// animated with the Web Animations API (transform/opacity only) and removed when done. Pure
// decoration: skipped under prefers-reduced-motion, when either element is missing, or when the
// browser has no element.animate. The bid itself never waits on it.

export interface Pt {
  x: number;
  y: number;
}

/** Centre of a rect, used for the start and end of the flight. */
export function centre(r: { left: number; top: number; width: number; height: number }): Pt {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function flyCard(from: Element | null, to: Element | null, label: string): void {
  if (typeof document === 'undefined' || !from || !to) return;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const ghost = document.createElement('div');
  ghost.className = 'fx-fly';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.setAttribute('data-fx', 'fly');
  ghost.textContent = label;
  ghost.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px`;
  document.body.appendChild(ghost);
  if (typeof ghost.animate !== 'function') {
    ghost.remove();
    return;
  }
  const s = centre(a);
  const e = centre(b);
  const anim = ghost.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${e.x - s.x}px, ${e.y - s.y}px) scale(0.7)`, opacity: 0.9 },
    ],
    { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'forwards' },
  );
  const done = () => ghost.remove();
  anim.onfinish = done;
  anim.oncancel = done;
  setTimeout(done, 600);
}
