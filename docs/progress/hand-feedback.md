# hand-feedback (playtest 2026-11-02 P2-P5)

## Branch / base
`fix/hand-feedback` off `origin/main`. Web only; no rule or protocol changes.

## Done
- P2: card keys on spent/out slots already reach `onCard` (`cardForKey` returns the fixed slot id since B6), which flashes `cardTapReason`. Locked in with a unit test and a desktop e2e step.
- P3: `bayLegality` label is now "Proxy on top" (short, fits the bay chip) with a `detail` "A Proxy is on top: only a Proxy can beat it" used in the bay-tap flash; `rejectionText` uses the same sentence (R15, R16 step 4).
- P4/P5: hand cards show an in-card label ("ON B" for out, "WON" for spent), the old corner badge is gone, aria-labels say "back when that item sells" / "it won an item and is gone for good", title tooltips, and the desktop key legend explains both.
- Screenshots: docs/mockups/hand-feedback/ (out/spent at 390 and 1280).

## In progress
Nothing.

## Next
Review and merge the draft PR.

## Gotchas / decisions
- The playtest's P2 claim (key falls through) did not reproduce on main; the code path already flashed. Tests added anyway.
- Visible label is just "on B" because cards are ~50px wide at 360px; the "back when it sells" wording lives in aria-label, title and the desktop legend.
