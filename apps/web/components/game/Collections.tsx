'use client';
// My collections: the 44px SETS strip (04 section 12) and the detail view used by the
// "Your collections" sheet and the desktop sidebar.
import { categoryName, type CollectionSummary, CATEGORY_ORDER, categoryShort } from '../../lib/game-ui/viewModel';

function Pips({ n }: { n: number }) {
  return (
    <span className="g-pips" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className={`g-pip${i < n ? ' g-pip--on' : ''}`} />
      ))}
    </span>
  );
}

export function CollectionStrip({ summary, onOpen }: { summary: CollectionSummary; onOpen: () => void }) {
  const owned = summary.rows.filter((r) => r.count > 0);
  const label =
    owned.length === 0 && summary.displayCases === 0 && summary.gifts === 0
      ? 'Your collections: nothing yet.'
      : `Your collections: ${owned.map((r) => `${r.name} ${Math.min(r.count, 3)} of 3`).join(', ')}.`;
  return (
    <button type="button" className="g-sets" data-fx="collection-strip" aria-label={`${label} Tap for details.`} onClick={onOpen}>
      <span className="g-sets__title">SETS</span>
      <span className="g-sets__list">
        {owned.length === 0 && summary.displayCases === 0 && summary.gifts === 0 && (
          <span className="g-sets__none">Win items to start sets</span>
        )}
        {owned.map((r) => (
          <span key={r.category} className="g-sets__item" data-complete={r.complete ? 'true' : undefined}>
            <span className="g-sq" style={{ background: `var(--cat-${r.category})` }} aria-hidden="true" />
            {categoryShort(r.category)}
            <Pips n={r.count} />
            {r.complete && <span className="g-x2">x2</span>}
          </span>
        ))}
        {summary.displayCases > 0 && <span className="g-wild">WILD{summary.displayCases > 1 ? ` x${summary.displayCases}` : ''}</span>}
        {summary.gifts > 0 && <span className="g-wild g-wild--gift">GIFT{summary.gifts > 1 ? ` x${summary.gifts}` : ''}</span>}
      </span>
      <span className="g-sets__chev" aria-hidden="true">
        ˄
      </span>
    </button>
  );
}

export function CollectionsView({ summary }: { summary: CollectionSummary }) {
  const rows = CATEGORY_ORDER.map((c) => summary.rows.find((r) => r.category === c)!);
  return (
    <div className="g-collections">
      <p className="hint">3 of a kind = x2 value</p>
      {rows.map((r) => (
        <div key={r.category} className="g-crow" data-empty={r.count === 0 ? 'true' : undefined}>
          <span className="g-sq g-sq--lg" style={{ background: `var(--cat-${r.category})` }} aria-hidden="true" />
          <span className="g-crow__main">
            <span className="g-crow__name">{categoryName(r.category)}</span>
            <span className="g-crow__items">
              {r.items.length ? r.items.map((i) => i.name).join(', ') : 'None yet'}
            </span>
          </span>
          {r.oneMore && <span className="g-crow__note">One more = x2!</span>}
          {r.complete && <span className="g-crow__note">x2!</span>}
          <Pips n={r.count} />
        </div>
      ))}
      <div className="g-crow g-crow--wild">
        <span className="g-wild">WILD</span>
        <span className="g-crow__name">
          Display Case x{summary.displayCases}: joins your best set at the end (+$100)
        </span>
      </div>
      {summary.gifts > 0 && (
        <div className="g-crow g-crow--wild">
          <span className="g-wild g-wild--gift">GIFT</span>
          <span className="g-crow__name">Gift x{summary.gifts}: opens after the last sale; you take an item from someone</span>
        </div>
      )}
    </div>
  );
}
