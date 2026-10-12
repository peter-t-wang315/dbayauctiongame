# Progress: smarter bots

## Branch / base
`bots-smarter`, off `main` (c8b745f). Owns `packages/engine/src/bots.ts`, `packages/engine/test/bots.test.ts`, `tools/sim` (reporting only), docs/02 section 7.

## Done
- Slice 1: rewrote `bots.ts`. One shared value-aware bidder; the three `BotLevel` personalities differ only in `PERSONALITY` numbers. API unchanged (`botAction` / `botActionAt` / `BotLevel`).
  - Valuation `worth()`: estimate x collection progress (3rd item doubles the set, 2nd item counts the doubling of owned items at 40%), Display Case grows with the best category progress.
  - Pays face value between 0.9x and `maxMult` x its valuation (smallest card reaching 0.9x, else the largest below the cap); never a $300 card on a $40 item.
  - Reserve of face cards early/mid game for ordinary items, last Proxy kept for the top items, caps on cards locked on bays (`maxOnBays`) and on bay stack size.
  - Valuation noise is fixed per (seed, player, item), not re-rolled per look.
  - Frenzy: `rebid` chance after being outbid, cooldown respected as before.
- Unit tests `packages/engine/test/bots.test.ts` (legality over seeded games, determinism, value-awareness, reserve, cooldown).
- `tools/sim` prints the per-seat win share by skill (`levelWinPerSeat`).
- Slice 2: Frenzy tuning (non-minimal bots may pay 5% more), random personality made the weakest, softer collection premium. docs/02 section 7 and sim README updated with before/after numbers.
- Replay snapshots in `packages/engine/test/__snapshots__/replay.test.ts.snap` regenerated (they pin bot behavior).

## In progress
PR open (`Engine: smarter bots`); waiting for review. Pre-PR reviewer subagent not run (usage limits); author self-review only.

## Next
- Address review comments. After the playtest, retune `PERSONALITY` (top of bots.ts) from real-player feedback.

## Gotchas / decisions
- Mixed-bot auto-skip was 14-19% at Standard 3p/4p with the old bots; the old careful bot also won ~70% of 4-player mixed games. New personalities are closer to parity (see PR table).
- Skip responds to thrift: a higher `maxMult` (paying 1.6x+) drains high cards and raises auto-skip above the 02 section 5 limits for all-careful games. Keep careful at ~1.3.
- Proxies on ordinary items raise skip (a Proxy top leaves only Proxies legal); keep them for the best items.
