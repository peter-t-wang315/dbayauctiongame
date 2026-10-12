'use client';
// The "⋯" menu (04 section 3.3). Sound and haptics toggles belong to WS8; theme, rules and leave live here.
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';

function readTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function MoreSheet({ onLeave }: { onLeave?: () => void }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (open) setTheme(readTheme());
  }, [open]);

  const choose = (t: 'light' | 'dark') => {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.setItem('dbay:theme', t);
    } catch {
      /* not persisted */
    }
    setTheme(t);
  };

  return (
    <>
      <button type="button" className="btn" aria-label="Menu" onClick={() => setOpen(true)}>
        <span aria-hidden="true">⋯</span>
      </button>
      <BottomSheet open={open} onClose={close} title="Menu">
        <div className="field">
          <span className="label" id="theme-label">
            Theme
          </span>
          <div className="seg" role="group" aria-labelledby="theme-label">
            <button
              type="button"
              className="seg__opt"
              aria-pressed={theme === 'light'}
              onClick={() => choose('light')}
            >
              Light
            </button>
            <button
              type="button"
              className="seg__opt"
              aria-pressed={theme === 'dark'}
              onClick={() => choose('dark')}
            >
              Dark
            </button>
          </div>
        </div>
        <Link className="btn" href="/rules" target="_blank">
          How to play
        </Link>
        {onLeave && (
          <button type="button" className="btn btn--danger" onClick={onLeave}>
            Leave room
          </button>
        )}
        <button type="button" className="btn" onClick={close}>
          Close
        </button>
      </BottomSheet>
    </>
  );
}
