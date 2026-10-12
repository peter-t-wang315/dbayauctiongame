import type { ReactNode } from 'react';

/** Full-screen centred card for terminal states (no such room, kicked, ...). */
export function MessageCard({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <main className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div className="modal" role="alert">
        <h1>{title}</h1>
        {children}
        {actions && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {actions}
          </div>
        )}
      </div>
    </main>
  );
}
