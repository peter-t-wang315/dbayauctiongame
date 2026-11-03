# Sale moment (playtest follow-ups, slice 3)

Plan: [playtest-followups.md](playtest-followups.md) "Slice 3". Source: [2026-10-27 AI playtest](../playtests/2026-10-27-ai/README.md) ("Sales feel flat").

## Branch / base
- `feat/sale-moment`, off `a4f58b6` (the plan doc commit, on top of `main` @ `7ad428c`). Slices 1 and 2 run in parallel on their own branches; this branch touches `GameScreen.tsx` minimally (2 imports, `<SaleToast view={view} />`, and the StatusStrip `silent` expression) and does not touch `viewModel.ts` or `StatusStrip.tsx`.

## Done
- **Pure logic + tests:** `apps/web/lib/game-ui/sale.ts` (`SALE_FX` timings, `saleNote`, `newSales`, `toastFor`) + `sale.test.ts`; `apps/web/lib/fx/plan.ts` `pickSfx` (sound priority under the per-snapshot cap) + tests in `fx.test.ts`.
- **Stamp sizes checked** at 390 (rows 56px, tiles 39px), 320x568 (tiles 32px), 1280 (tiles 48px; 64px overflowed the ~214px desktop tile, so tiles >= 600px use 48px).
- **e2e:** `e2e/fx.pw.ts` "sale moment" test (stamp shows SOLD!, still there at 1.5s, gone within 5s; toast visible, click-through, below the strip). The spec's mock port now honors `E2E_MOCK_PORT` (default 8787) so parallel worktrees can run it on a private port.
- **Bigger, longer SOLD! stamp:** `Bay.tsx` (slab with winner color via `--sold`, `data-mine`), `game.css` (56px rows / clamp(30-40px) tiles; from 600px wide 64px rows, 48px tiles), hold 1.3s -> 2.0s (`useSoldStamps` default now `SALE_FX.stampHoldMs`), Motion slam 2.2 -> 0.9 -> 1.04 -> 1 over 360ms in `FxController.tsx` (reduced motion: unchanged 150ms fade).
- **Won/lost toast:** `components/game/SaleToast.tsx` (+ `.g-toast` CSS), mounted in `GameScreen.tsx`.
- **Sounds (synthesized, WS8 system):** `sfx.ts` new `gavel` (two knocks), `gavelWon` (knocks + ding-ding), `sting` (outbid; replaces `bwop`). `FxController` plays `pickSfx(events, 2)`.
- **A11y:** `announce.ts` sold-to-me now "Sold to you: {item}".
- Docs: 04 principle 2, 4.2 SOLD stamp, section 7 (row 5, new "Sale moment" paragraph, sound table, sound priority), section 15 assertive text.

## In progress
- Nothing (see Next).

## Next
- Re-run the full web e2e on a quiet machine (parallel agents share ports 3100/8787).
- Pre-PR review per docs/README "Git workflow" (not done by this agent; no PR opened).
- Manual: listen to gavel / gavelWon / sting with sound on (M key).

## Gotchas / decisions
- **ASSUMED timings** (tune in `SALE_FX`): stamp hold 2000ms (was 1300ms), toast 2800ms (one line, under the strip; it overlaps the top ~40px of the first bay row, so it stays short). The stamp covers the refilled bay while it holds (bay stays clickable underneath), so don't push it much past ~2s in Frenzy.
- **No double reads:** sale to me = assertive only ("Sold to you: {item}"); others' sales = the toast's polite region only. The strip silences sale lines (`isSaleEntry`, GameScreen `silent` prop) because in Frenzy it usually shows "Going once..." or a refill line instead and would miss them. The `silent` prop now also requires `!going` (before, an urgent line silenced the "Going once..." text that replaced it).
- 04 principle 2 said "No toasts"; amended to allow this one click-through toast (the playtest asked for it explicitly).
- No in-app reduced-motion setting exists; only `prefers-reduced-motion` (CSS + `matchMedia` in FxController).
- Two sounds in one snapshot still play at the same instant (no stagger), as before.
- The Next dev server prints a security-advisory nudge and exits on every other start (`next dev`); just retry. The Next upgrade is its own branch (docs/README status).
- Worktree-isolated agents: compound shell commands touching files outside a single `cd` may be refused; split them.
