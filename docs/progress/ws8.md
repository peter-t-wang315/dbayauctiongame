# WS8 progress (Juice and sound)

## Branch / base
`ws8-juice` off main at 820b2ff. PR open to main (do not merge until reviewed).

## Done
- Slice 1: deps pinned (motion 14.1.0, canvas-confetti 1.9.4, @types/canvas-confetti 1.9.0), `lib/fx` pure logic: `deriveFx` snapshot diff, `crossedSecond`, settings store (sound off by default, localStorage in try/catch), synth recipes, Web Audio player, haptics, lazy confetti; 11 unit tests.
- Slice 2: `components/fx` FxController (sound, haptics, tiny animations on data-fx hooks), `SoundHapticsToggles`, `styles/fx.css`; mount points (GameScreen wrapper + M key, MenuPanel Settings, JoinForm audio-unlock register); `e2e/fx.pw.ts`.
- typecheck, lint, test and full Playwright e2e pass.

## In progress
- Nothing.

## Next
- Manual: iPhone audio unlock, Android vibrate, listen to the synth sounds.

## Gotchas / decisions
- Effects attach to existing `data-fx` elements; no layout changes. Sound/haptics for rejection use the existing `data-shake` / `data-nudge` attributes via a MutationObserver (no GameScreen coupling).
- Motion is used lazily via `motion/mini` `animate` (no React components, no LazyMotion), so nothing is added to the main bundle.
- Skipped: SOLD card flying into the collection strip (needs layoutId across components); stamp rotate -8deg (the stamp is a full-bay overlay, rotating it would poke outside the bay); bidder chip flash; "+3s" and outbid pill visuals already existed from WS5.
- Confetti only for the winner (rank 1 and me) and only when the reveal sequence finished in this session after a playing->reveal transition; never under reduced motion (the crown badge stays).
- If `pnpm install` has not been run in a fresh worktree, Next fails to resolve zod from packages/protocol.
