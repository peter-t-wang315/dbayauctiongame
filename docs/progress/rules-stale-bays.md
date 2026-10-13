# rules-stale-bays

## Branch / base
`rules-stale-bays` off `main` (5177dd7). PR: "Engine: no-bid round clears bays; older bays close sooner".

## Done
- Slice 1: sim metrics (bay wait first bid to sale, no-bid clears per game).
- Slice 2: engine R18b (no-bid round clears all Classic bays) and R17 age term (`ageBonusPerCycle`), tests, replay snapshot, mock-server mirror.
- Slice 3: docs 01 (R17, R18b, section 9) and 02 (sections 5, 7), final constants, before/after tables.
- Slice 4 (user decisions 2026-10-12): accept shorter Classic games (02 section 5 ranges, sim ranges); R18b needs 2 quiet rounds at 3p (`NO_BID_ROUNDS_TO_CLEAR`).

## In progress
- Nothing; PR open, awaiting review (do not merge).

## Next
- Decide on Classic length targets (see 02 section 7, stale bays subsection).

## Gotchas / decisions
- User decision 2026-10-12: R17 age term and R18b are ASSUMED rules.
- State field `lastBidCallNo` (optional) tracks the last call with an accepted bid.
- Bays refilled on the same call as the no-bid round end are not cleared (fresh item unseen).
- Deck sizes cannot grow (6 categories x 10 items, shared with Frenzy), so Classic game length drops.
