# Desktop reveal/results layout (>=1024px)

## Branch / base
`feat/desktop-reveal`, off `origin/main` (7ad428c). Draft PR "Web: desktop reveal/results layout".

## Done
- `lib/reveal/results.ts`: `progressRows(view, shown)` (+ unit test): totals only after a player's last card flipped.
- `components/reveal/RevealRail.tsx` (desktop-only `RevealProgress`, `RevealLegend`), `RevealScreen.tsx` (useDesktop gate, rail with Standings/Scoreboard + Skip/Rematch/Leave, Space/Enter skip, R rematch), desktop CSS block in `reveal.css`.
- e2e: `reveal.pw.ts` desktop 6-player test (1280x800 then 1440x900, grid, rail, keys); `a11y.pw.ts` desktop reveal + results axe (light + dark).
- Docs: 04 section 3.5 desktop bullet; screenshots `docs/mockups/desktop/reveal-{before,after}-*.png`.

## In progress
Nothing.

## Next
- Optional: cards in a player card could use a 2-col item grid when a player holds many items; empty-handed players take a full grid cell.

## Gotchas / decisions
- Phone DOM unchanged: the footer actions JSX is hoisted into a const and rendered either in the footer (phone) or the rail (desktop).
- Legend omits `?`/M: the in-game hotkey handler lives in GameScreen and its rules sheet is not mounted during reveal.
- Next dev may print a security-upgrade nudge and exit the first time; rerun. Orphan mock on :8787 can block e2e; use a temp config on other ports (not committed).
