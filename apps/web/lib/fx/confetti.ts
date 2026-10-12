'use client';
// Winner confetti, lazy-loaded at the reveal only. 2.5s; callers skip it under reduced motion.
export async function fireConfetti(): Promise<void> {
  try {
    const { default: confetti } = await import('canvas-confetti');
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, disableForReducedMotion: true });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, disableForReducedMotion: true });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  } catch {
    /* decoration only */
  }
}
