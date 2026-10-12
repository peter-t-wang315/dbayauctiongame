// Shared rules body (04 section 3.6): used by the /rules page and the in-game menu Rules tab.
// Static, no state. TOC chips jump to sections with plain anchor links.
import { RULES } from './content';
import './rules.css';

export function RulesContent({ idPrefix = 'rules' }: { idPrefix?: string }) {
  return (
    <div className="rules">
      <nav className="rules-toc" aria-label="Rules sections">
        {RULES.map((s) => (
          <a key={s.id} className="rules-toc__chip" href={`#${idPrefix}-${s.id}`}>
            {s.chip}
          </a>
        ))}
      </nav>
      {RULES.map((s) => (
        <section key={s.id} id={`${idPrefix}-${s.id}`} className="rules-sec" aria-labelledby={`${idPrefix}-${s.id}-h`}>
          <h2 id={`${idPrefix}-${s.id}-h`}>{s.title}</h2>
          {s.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {s.example && (
            <p className="rules-example">
              <strong>Example: </strong>
              {s.example}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
