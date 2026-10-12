'use client';
// The menu content (04 section 4.7): Players, Sets, Log, Rules (WS6 RulesContent), Settings. Rendered in a bottom sheet on
// mobile and docked as a 320px sidebar on desktop. Sound/haptics toggles belong to WS8.
import { useEffect, useId, useState } from 'react';
import type { PlayerView } from '@dbay/protocol';
import { PlayerChip } from '../shell/PlayerChip';
import { RulesContent } from '../rules/RulesContent';
import { SoundHapticsToggles } from '../fx/SoundHapticsToggles';
import { CollectionsView } from './Collections';
import { logLines, summarizeCollection } from '../../lib/game-ui/viewModel';

export type MenuTab = 'players' | 'sets' | 'log' | 'rules' | 'settings';
const TABS: { id: MenuTab; label: string }[] = [
  { id: 'players', label: 'Players' },
  { id: 'sets', label: 'Sets' },
  { id: 'log', label: 'Log' },
  { id: 'rules', label: 'Rules' },
  { id: 'settings', label: 'Settings' },
];

export function MenuPanel({
  view,
  tab,
  onTab,
  onLeave,
}: {
  view: PlayerView;
  tab: MenuTab;
  onTab: (t: MenuTab) => void;
  onLeave: () => void;
}) {
  // Two MenuPanels mount at once (sidebar + sheet), so rules anchors need a per-instance prefix.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div className="g-menu">
      <div className="seg g-menu__tabs" role="tablist" aria-label="Menu sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`g-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-pressed={tab === t.id}
            className="seg__opt"
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-labelledby={`g-tab-${tab}`} className="g-menu__panel">
        {tab === 'players' && <Players view={view} />}
        {tab === 'sets' && <MySets view={view} />}
        {tab === 'log' && <Log view={view} />}
        {tab === 'rules' && <RulesContent idPrefix={`r${uid}`} />}
        {tab === 'settings' && <Settings view={view} onLeave={onLeave} />}
      </div>
    </div>
  );
}

export function MySets({ view }: { view: PlayerView }) {
  const me = view.players.find((p) => p.id === view.me);
  return <CollectionsView summary={summarizeCollection(me?.collection ?? [], me?.gifts ?? 0)} />;
}

function Players({ view }: { view: PlayerView }) {
  return (
    <ul className="g-plist">
      {view.players.map((p) => {
        const s = summarizeCollection(p.collection, p.gifts);
        const owned = s.rows.filter((r) => r.count > 0);
        return (
          <li key={p.id}>
            <details className="g-pdetail">
              <summary>
                <PlayerChip color={p.color} shape={p.shape} name={p.name} />
                <span className="g-pmeta">
                  {p.id === view.me && <span className="tag">YOU</span>}
                  {p.isBot && <span className="tag">BOT</span>}
                  {!p.connected && <span className="tag">AWAY</span>}
                  <span>{p.collection.length} items</span>
                  <span>{p.cardsInHand} cards</span>
                </span>
              </summary>
              <div className="g-pbody">
                {owned.length === 0 && <span className="hint">No items yet.</span>}
                {owned.map((r) => (
                  <div key={r.category}>
                    <strong>{r.name}</strong> ({r.count}
                    {r.complete ? ', x2' : ''}): {r.items.map((i) => `${i.name}${i.est ? ` (est $${i.est})` : ''}`).join(', ')}
                  </div>
                ))}
                {s.displayCases > 0 && <div>Display Case x{s.displayCases}</div>}
                {s.gifts > 0 && <div>Gift x{s.gifts}</div>}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function Log({ view }: { view: PlayerView }) {
  const lines = logLines(view);
  return (
    <ol className="g-log" aria-label="Recent events">
      {lines.length === 0 && <li className="hint">Nothing yet.</li>}
      {lines.map((l) => (
        <li key={l.n}>{l.text}</li>
      ))}
    </ol>
  );
}

function Settings({ view, onLeave }: { view: PlayerView; onLeave: () => void }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);
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
    <div className="g-settings">
      <div className="field">
        <span className="label" id="g-theme-label">
          Theme
        </span>
        <div className="seg" role="group" aria-labelledby="g-theme-label">
          <button type="button" className="seg__opt" aria-pressed={theme === 'light'} onClick={() => choose('light')}>
            Light
          </button>
          <button type="button" className="seg__opt" aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>
            Dark
          </button>
        </div>
      </div>
      <SoundHapticsToggles />
      <p className="hint">
        Mode: {view.opts.mode === 'frenzy' ? 'Frenzy' : 'Classic'}
        {view.opts.relaxed ? ', relaxed timing x1.5' : ''}
      </p>
      {confirm ? (
        <button type="button" className="btn btn--danger" onClick={onLeave}>
          Really leave? Tap to confirm
        </button>
      ) : (
        <button type="button" className="btn btn--danger" onClick={() => setConfirm(true)}>
          Leave game
        </button>
      )}
    </div>
  );
}
