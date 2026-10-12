'use client';
// Small React hooks for the game screen. Time always comes from the room's server-clock estimate.
import { useEffect, useRef, useState } from 'react';
import type { PlayerView } from '@dbay/protocol';
import { newAnnouncements } from './announce';
import { nextBarTotal } from './timers';

/** Re-render every `everyMs` while `active`; returns the current server time estimate. */
export function useServerNow(serverNow: () => number, active: boolean, everyMs = 100): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    setNow(serverNow());
    if (!active) return;
    const id = setInterval(() => setNow(serverNow()), everyMs);
    return () => clearInterval(id);
  }, [serverNow, active, everyMs]);
  return now;
}

/** Largest remaining ms seen for one timer window (resets when `key` changes). */
export function useBarTotal(key: string, remaining: number | null, floor?: number): number {
  const ref = useRef<{ key: string; total: number } | undefined>(undefined);
  ref.current = nextBarTotal(ref.current, key, remaining, floor);
  return ref.current.total;
}

/** True for `holdMs` after `endsAt` moves later within the same window (anti-snipe "+3s"). */
export function useExtended(windowKey: string, endsAt: number | undefined, holdMs = 1600): boolean {
  const prev = useRef<{ key: string; endsAt: number | undefined }>({ key: windowKey, endsAt });
  const [on, setOn] = useState(false);
  useEffect(() => {
    const p = prev.current;
    prev.current = { key: windowKey, endsAt };
    if (
      p.key === windowKey &&
      p.endsAt !== undefined &&
      endsAt !== undefined &&
      endsAt > p.endsAt + 500
    ) {
      setOn(true);
      const id = setTimeout(() => setOn(false), holdMs);
      return () => clearTimeout(id);
    }
    setOn(false);
    return undefined;
  }, [windowKey, endsAt, holdMs]);
  return on;
}

export interface SoldStamp {
  key: number;
  bay: number;
  by: string;
  amount: number | 'proxy' | undefined;
}

/** Log-driven SOLD stamps: one per new `sold` entry (not for entries already present at mount). */
export function useSoldStamps(view: PlayerView | null, holdMs = 1300): SoldStamp[] {
  const lastN = useRef<number | null>(null);
  const [stamps, setStamps] = useState<SoldStamp[]>([]);
  useEffect(() => {
    if (!view) return;
    const maxN = view.log.reduce((m, e) => Math.max(m, e.n), 0);
    if (lastN.current === null) {
      lastN.current = maxN;
      return;
    }
    const fresh = view.log.filter(
      (e) => e.n > lastN.current! && e.kind === 'sold' && e.by && e.bay !== undefined,
    );
    lastN.current = Math.max(lastN.current, maxN);
    if (fresh.length === 0) return;
    const added = fresh.map((e) => ({ key: e.n, bay: e.bay!, by: e.by!, amount: e.amount }));
    setStamps((s) => [...s, ...added]);
    // Not cancelled on the next snapshot: the stamp must still expire.
    setTimeout(
      () => setStamps((s) => s.filter((x) => !added.some((a) => a.key === x.key))),
      holdMs,
    );
  }, [view, holdMs]);
  return stamps;
}

/** Bays where I was top bidder and have just been outbid (cleared when the bay item changes or after a while). */
export function useOutbid(view: PlayerView | null, holdMs = 4000): Set<number> {
  const prev = useRef<Map<number, { card: string | null; mine: boolean }>>(new Map());
  const [out, setOut] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (!view) return;
    const hit: number[] = [];
    const clear: number[] = [];
    const next = new Map<number, { card: string | null; mine: boolean }>();
    for (const b of view.bays) {
      const mine = b.topBid?.by === view.me;
      const p = prev.current.get(b.idx);
      if (p && p.mine && !mine && p.card === b.card && b.topBid) hit.push(b.idx);
      if (p && p.card !== b.card) clear.push(b.idx);
      next.set(b.idx, { card: b.card, mine });
    }
    prev.current = next;
    if (hit.length === 0 && clear.length === 0) return;
    setOut((s) => {
      const n = new Set(s);
      clear.forEach((i) => n.delete(i));
      hit.forEach((i) => n.add(i));
      return n;
    });
    if (hit.length === 0) return;
    setTimeout(
      () =>
        setOut((s) => {
          const n = new Set(s);
          hit.forEach((i) => n.delete(i));
          return n;
        }),
      holdMs,
    );
  }, [view, holdMs]);
  return out;
}

/** Latest assertive announcement ({n} changes for each new one so a repeat is re-read); clears after a while. */
export function useAnnouncer(
  view: PlayerView | null,
  holdMs = 5000,
): { n: number; text: string } | null {
  const lastN = useRef<number | null>(null);
  const [cur, setCur] = useState<{ n: number; text: string } | null>(null);
  useEffect(() => {
    if (!view) return;
    const r = newAnnouncements(view, lastN.current);
    lastN.current = r.lastN;
    const last = r.items[r.items.length - 1];
    if (!last) return;
    setCur(last);
    const id = setTimeout(() => setCur((c) => (c?.n === last.n ? null : c)), holdMs);
    return () => clearTimeout(id);
  }, [view, holdMs]);
  return cur;
}
