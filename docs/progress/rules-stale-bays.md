# rules-stale-bays

## Branch / base
`rules-stale-bays` off `main` (5177dd7). PR: "Engine: no-bid round clears bays; older bays close sooner".

## Done
- Slice 1: sim metrics (bay wait first bid to sale, no-bid clears per game).
- Slice 2: engine R18b (no-bid round clears all Classic bays) and R17 age term (`ageBonusPerCycle`), tests, replay snapshot, mock-server mirror.

## In progress
- Tuning constants with `tools/sim` and writing docs 01 / 02.

## Next
- Docs 01 (R17, R18b, section 9), 02 (sections 5 and 7), then PR with before/after tables.

## Gotchas / decisions
- User decision 2026-10-12: R17 age term and R18b are ASSUMED rules.
- State field `lastBidCallNo` (optional) tracks the last call with an accepted bid.
- Bays refilled on the same call as the no-bid round end are not cleared (fresh item unseen).
- Deck sizes cannot grow (6 categories x 10 items, shared with Frenzy), so Classic game length drops.
