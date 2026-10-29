'use client';
// Juice and sound (WS8). Renders nothing. Derives feedback events from snapshot diffs, plays
// optional sound / haptics, and runs tiny transform/opacity animations on existing data-fx
// elements. Never blocks input; with sound off and reduced motion on it changes nothing visible
// beyond the 150ms fades the spec asks for.
import { useEffect, useRef } from 'react';
import type { PlayerView } from '@dbay/protocol';
import { useRoom } from '../../lib/net/useRoom';
import { crossedSecond, deriveFx, type FxEvent } from '../../lib/fx/events';
import { playSfx } from '../../lib/fx/audio';
import { fireConfetti } from '../../lib/fx/confetti';
import { PATTERNS, patternFor, vibrate } from '../../lib/fx/haptics';
import { pickSfx } from '../../lib/fx/plan';
import { getSettings } from '../../lib/fx/settings';
import '../../styles/fx.css';

type Animate = typeof import('motion/mini').animate;
let motion: Promise<Animate | null> | null = null;
const loadMotion = (): Promise<Animate | null> =>
  (motion ??= import('motion/mini').then((m) => m.animate).catch(() => null));

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = [0.2, 0.9, 0.3, 1.2] as const;
let active = 0; // never more than 3 pending animations (04 section 7); extras just show the final state

function run(el: Element | null, keyframes: Record<string, unknown>, duration: number, ease: unknown = 'easeOut'): void {
  if (!el || active >= 3) return;
  active++;
  void loadMotion().then(async (animate) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (animate as any)(el, keyframes, { duration, ease });
    } catch {
      /* decoration only */
    } finally {
      active--;
      // Drop whatever inline style the animation committed, so class/state styles (e.g. the bay's
      // outbid/legal rings via box-shadow) always win again afterwards.
      if (el instanceof HTMLElement || el instanceof SVGElement) {
        for (const k of Object.keys(keyframes)) el.style.removeProperty(k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
        if ('scale' in keyframes) el.style.removeProperty('transform');
      }
    }
  });
}

const q = (sel: string) => document.querySelector(sel);

function visual(e: FxEvent): void {
  const rm = reduced();
  if (e.t === 'bump') {
    const el = q(`[data-fx="bay"][data-bay="${e.bay}"] [data-fx="top-bid"]`);
    const bay = q(`[data-fx="bay"][data-bay="${e.bay}"]`);
    // The bay that took the bid pops and flashes a ring (mine: green, strong; others: soft).
    const ring = e.mine ? 'var(--ok)' : 'var(--ink)';
    const flash = ['0 0 0 0 transparent', `0 0 0 6px ${ring}`, '0 0 0 0 transparent'];
    if (rm) {
      run(el, { opacity: [0.4, 1] }, 0.15);
      run(bay, { boxShadow: flash }, 0.3);
    } else {
      run(el, { scale: [1, 1.25, 1] }, 0.28, EASE);
      run(bay, { scale: [1, e.mine ? 1.04 : 1.02, 1], boxShadow: flash }, 0.32, EASE);
    }
  } else if (e.t === 'outbid') {
    // Single 300ms edge flash (kept under reduced motion: one pulse, not a flicker).
    const el = q(`[data-fx="bay"][data-bay="${e.bay}"]`);
    run(el, { boxShadow: ['inset 0 0 0 0 transparent', 'inset 0 0 0 5px var(--danger)', 'inset 0 0 0 0 transparent'] }, 0.3);
  } else if (e.t === 'sold' && e.bay !== undefined) {
    const bay = e.bay;
    // The stamp is rendered one effect later by WS5's useSoldStamps.
    setTimeout(() => {
      const el = q(`[data-fx="bay"][data-bay="${bay}"] [data-fx="sold-stamp"]`);
      if (rm) run(el, { opacity: [0, 1] }, 0.15);
      else run(el, { scale: [2.2, 0.9, 1.04, 1], opacity: [0, 1, 1, 1] }, 0.36, EASE);
    }, 50);
  }
}

/** Sounds per snapshot are capped so a reconnect after a backgrounded tab doesn't burst. */
const MAX_SFX_PER_SNAPSHOT = 2;

function handle(e: FxEvent): void {
  const p = patternFor(e);
  if (p) vibrate(p);
  visual(e);
}

/** Soonest running clock in ms, or null. */
function clockMs(view: PlayerView, now: number): number | null {
  const ends: number[] = [];
  if (view.turn?.phase === 'window' && view.turn.endsAt !== undefined) ends.push(view.turn.endsAt);
  for (const b of view.bays) if (b.card && b.topBid && b.endsAt !== undefined) ends.push(b.endsAt);
  return ends.length ? Math.min(...ends) - now : null;
}

export function FxController({ view }: { view: PlayerView | null }) {
  const room = useRoom();
  const prev = useRef<PlayerView | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const confettiArmed = useRef(false);
  const lastClock = useRef<number | null>(null);

  // Snapshot diff -> events.
  useEffect(() => {
    if (!view) {
      prev.current = null;
      return;
    }
    const events = deriveFx(prev.current, view);
    prev.current = view;
    // Most important sounds first (sale / outbid sting beat a bid tok); playSfx honors the mute.
    for (const s of pickSfx(events, MAX_SFX_PER_SNAPSHOT)) playSfx(s);
    for (const e of events) {
      if (e.t === 'reveal') confettiArmed.current = true;
      handle(e);
    }
  }, [view]);

  // Last-3s tick (sound only; the red timer and text are the visible equivalents).
  useEffect(() => {
    const id = setInterval(() => {
      const v = viewRef.current;
      if (!v || v.phase !== 'playing' || !getSettings().sound) {
        lastClock.current = null;
        return;
      }
      const rem = clockMs(v, room.serverNow());
      if (crossedSecond(lastClock.current, rem)) playSfx('clock');
      lastClock.current = rem;
    }, 200);
    return () => clearInterval(id);
  }, [room]);

  // DOM-state reactions: card select tick, rejection buzz, reveal flips, winner confetti.
  useEffect(() => {
    let lastFlip = 0;
    const onClick = (ev: MouseEvent) => {
      const card = (ev.target as Element | null)?.closest?.('[data-fx="hand-card"]');
      const st = card?.getAttribute('data-state');
      if (card && (st === 'ready' || st === 'selected')) playSfx('tick');
    };
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as Element;
        const fx = el.getAttribute('data-fx');
        if (r.attributeName === 'data-shake' && el.getAttribute('data-shake') === 'true') {
          playSfx('buzz');
          vibrate(PATTERNS.rejected);
        } else if (r.attributeName === 'data-nudge' && el.getAttribute('data-nudge') === 'true') {
          playSfx('buzz');
        } else if (r.attributeName === 'data-state' && fx === 'reveal-flip') {
          if (r.oldValue === 'hidden' && el.getAttribute('data-state') === 'shown') {
            const now = Date.now();
            if (now - lastFlip > 80) playSfx('flip');
            lastFlip = now;
            if (reduced()) run(el, { opacity: [0.3, 1] }, 0.15);
            else {
              run(el, { transform: ['perspective(600px) rotateY(-90deg)', 'perspective(600px) rotateY(0deg)'] }, 0.4);
              const tag = el.querySelector('[data-fx="reveal-tag"]');
              run(tag, { scale: [0.6, 1.15, 1] }, 0.2, EASE);
            }
          }
        } else if (r.attributeName === 'data-state' && fx === 'reveal' && el.getAttribute('data-state') === 'done') {
          if (!confettiArmed.current) continue;
          confettiArmed.current = false;
          if (q('[data-fx="scoreboard"] [data-rank="1"][data-me="true"]')) {
            playSfx('cheer');
            if (!reduced()) void fireConfetti();
          }
        }
      }
    });
    document.addEventListener('click', onClick, true);
    mo.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['data-state', 'data-shake', 'data-nudge'],
    });
    return () => {
      document.removeEventListener('click', onClick, true);
      mo.disconnect();
    };
  }, []);

  return null;
}
