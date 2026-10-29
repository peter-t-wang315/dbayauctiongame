# Sale moment (playtest follow-ups, slice 3)

Plan: [playtest-followups.md](playtest-followups.md) "Slice 3". Source: [2026-10-27 AI playtest](../playtests/2026-10-27-ai/README.md) ("Sales feel flat").

## Branch / base
- `feat/sale-moment`, off `a4f58b6` (the plan doc commit, on top of `main` @ `7ad428c`). Slices 1 and 2 run in parallel on their own branches; this branch touches `GameScreen.tsx` with 2 additive lines only (import + `<SaleToast view={view} />`) and does not touch `viewModel.ts` or `StatusStrip.tsx`.

## Done
- **Pure logic + tests:** `apps/web/lib/game-ui/sale.ts` (`SALE_FX` timings, `saleNote`, `newSales`, `toastFor`) + `sale.test.ts`; `apps/web/lib/fx/plan.ts` `pickSfx` (sound priority under the per-snapshot cap) + tests in `fx.test.ts`.
- **Bigger, longer SOLD! stamp:** `Bay.tsx` (slab with winner color via `--sold`, `data-mine`), `game.css` (56px rows / clamp(30-40px) tiles / 64px >= 600px), hold 1.3s -> 2.0s (`useSoldStamps` default now `SALE_FX.stampHoldMs`), Motion slam 2.2 -> 0.9 -> 1.04 -> 1 over 360ms in `FxController.tsx` (reduced motion: unchanged 150ms fade).
- **Won/lost toast:** `components/game/SaleToast.tsx` (+ `.g-toast` CSS), mounted in `GameScreen.tsx`.
- **Sounds (synthesized, WS8 system):** `sfx.ts` new `gavel` (two knocks), `gavelWon` (knocks + ding-ding), `sting` (outbid; replaces `bwop`). `FxController` plays `pickSfx(events, 2)`.
- **A11y:** `announce.ts` sold-to-me now "Sold to you: {item}".
- Docs: 04 principle 2, 4.2 SOLD stamp, section 7 (row 5, new "Sale moment" paragraph, sound table, sound priority), section 15 assertive text.

## In progress
- Nothing (see Next).

## Next
- Machine checks from repo root (`pnpm typecheck`, `pnpm lint`, `pnpm test`), then web Playwright e2e (`apps/web`: `pnpm exec playwright test`), add an e2e for the toast/stamp if feasible.
- Pre-PR review per docs/README "Git workflow" (not done by this agent; no PR opened).
- Manual: listen to gavel / gavelWon / sting with sound on (M key).

## Gotchas / decisions
- **ASSUMED timings** (tune in `SALE_FX`): stamp hold 2000ms (was 1300ms), toast 3200ms. The stamp covers the refilled bay while it holds (bay stays clickable underneath), so don't push it much past ~2s in Frenzy.
- **No double reads:** sale to me = assertive only ("Sold to you: {item}"); others' sales = polite strip if it's the newest line, else the toast's polite region. The toast doesn't know about the strip's 2.6s local flash ("Bid sent ..."), so a sale arriving during a flash whose log line is the newest can go unread politely; rare, accepted.
- 04 principle 2 said "No toasts"; amended to allow this one click-through toast (the playtest asked for it explicitly).
- No in-app reduced-motion setting exists; only `prefers-reduced-motion` (CSS + `matchMedia` in FxController).
- Two sounds in one snapshot still play at the same instant (no stagger), as before.
- Worktree-isolated agents: compound shell commands touching files outside a single `cd` may be refused; split them.
