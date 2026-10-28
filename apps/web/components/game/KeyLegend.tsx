// Desktop-only full-width keyboard legend (04 section 6). Decorative: the keys are also documented
// in the Rules panel, and the per-card/bay badges carry the same hints.
const BAY_KEYS = ['Q', 'W', 'E', 'R'];

export function KeyLegend({ bays }: { bays: number }) {
  return (
    <div className="g-legend" aria-hidden="true" data-fx="key-legend">
      <span>
        <kbd>1</kbd>-<kbd>0</kbd> pick card
      </span>
      <span>
        <kbd>-</kbd> <kbd>=</kbd> Proxy
      </span>
      <span>
        {BAY_KEYS.slice(0, bays).map((k) => (
          <kbd key={k}>{k}</kbd>
        ))}{' '}
        bid on bay
      </span>
      <span>
        <kbd>Esc</kbd> cancel
      </span>
      <span>
        <kbd>L</kbd> log
      </span>
      <span>
        <kbd>?</kbd> rules
      </span>
      <span>
        <kbd>M</kbd> sound
      </span>
    </div>
  );
}
