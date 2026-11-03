# desktop-tip-placement

## Branch / base
`fix/desktop-tip-placement`, off `origin/main`.

## Done
- Desktop (>=1024px): `TipToast` mounts at the top of the right rail (`.g-side`, in flow) instead of hanging under the status strip over the podiums. Phone/tablet DOM and CSS unchanged (still after the status strip, as an overlay).
- e2e: desktop 1280x800 6-player check in `apps/web/e2e/tips.pw.ts` (tip box vs `.g-pods`, podiums, bays; polite live region; axe wcag2a/aa with the tip showing).

## In progress
Nothing; all checks green (typecheck, lint, unit, e2e tips/game/a11y). Screenshots in docs/mockups/desktop/tip-before.png and tip-after.png.

## Next
Open the draft PR; do not merge.

## Gotchas / decisions
- Rail placement chosen over beside-strip / above-hand: the rail is the only desktop region with spare room, and the sale toast stays under the strip, so they cannot collide.
- In flow (not overlay): the log section (flex 1) just gets shorter while the tip shows (max 9s), so nothing in the rail is hidden.
- `.g-tipanchor` is `display: contents` on desktop so no empty flex item adds a gap.
