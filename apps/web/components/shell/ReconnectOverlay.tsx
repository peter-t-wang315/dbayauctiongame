'use client';
// 04 section 3.7: appears after 1s of disconnect (no flicker), blocks input, hints after 5s.
import { useEffect, useState } from 'react';

export function ReconnectOverlay({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      setSlow(false);
      return;
    }
    const a = setTimeout(() => setVisible(true), 1000);
    const b = setTimeout(() => setSlow(true), 5000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [show]);

  if (!show || !visible) return null;
  return (
    <div className="scrim" role="status" aria-live="polite">
      <div className="modal">
        <div className="spinner" aria-hidden="true" />
        <h2>Reconnecting...</h2>
        {slow && <p className="hint">Still trying. Check your signal.</p>}
      </div>
    </div>
  );
}
