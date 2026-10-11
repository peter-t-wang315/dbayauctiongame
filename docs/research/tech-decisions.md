# Tech Decisions - Research and Fact-checks (2026-10-10/11)

Prices and limits change. Entries marked "re-verify" should be rechecked when WS0/WS3b/WS7 start. URLs are the documentation roots consulted; exact deep links were not retained by the research agents.

## Hosting comparison
| Option | Finding (date) | Verdict |
|---|---|---|
| Vercel only | WebSockets in beta; Hobby max function duration 300s, so sockets cut at about 5 min; reconnects may land on another instance. https://vercel.com/docs (2026-10-10) | Frontend only |
| Cloudflare Durable Objects + PartyServer | Free plan allows SQLite-backed DOs only; 100k requests/day; incoming WebSocket messages billed 20:1; hibernation; alarms survive hibernation. https://developers.cloudflare.com/durable-objects/ (pricing page; 2026-10-10) | CHOSEN |
| PartyKit hosted | Hosted service shuts down 23 Oct 2026. Open-source PartyServer library continues. https://www.partykit.io / PartyServer repo (2026-10-10) | Do not use hosted |
| Fly.io | About $2.19/mo smallest VM, no free tier. https://fly.io/docs/about/pricing/ (re-verify) | Fallback with Colyseus |
| Railway | Hobby $5/mo. https://railway.com/pricing (re-verify) | Fallback |
| Render | Free web services sleep after 15 min idle and may restart. https://render.com/docs/free | Unsuitable |
| Ably | Free tier about 6M messages/month, 200 concurrent connections. https://ably.com/pricing (re-verify) | Possible but needs separate authoritative server |
| Supabase Realtime | Free about 200 concurrent connections; no server-side game timers. https://supabase.com/docs/guides/realtime/limits | Not a fit |
| Convex | Has a scheduler for timers; adds a new platform/lock-in. https://docs.convex.dev | Not chosen |
| Colyseus | Node game server with `allowReconnection`; good fallback framework. https://docs.colyseus.io | Fallback |
| OpenNext on Cloudflare | Supports Next.js 14-16; on Windows requires WSL. https://opennext.js.org/cloudflare | Possible later, not now |
| Vercel Hobby | Non-commercial use only. https://vercel.com/docs/limits/fair-use-guidelines (re-verify) | OK for friends/hobby project |

Decision: Next.js on Vercel + Cloudflare Durable Objects via PartyServer; Wrangler native on Windows. See `../05-tech-stack.md`.

## Libraries (npm verified 2026-10-11)
- **Motion** 14.1.0, MIT, pinned exact. Use `LazyMotion` + `m` + `domMax` (about 20kb) and `MotionConfig reducedMotion="user"`. Motion+ is a paid add-on; not needed. https://motion.dev
- **Howler.js**: last release 2023, so stale; replaced by a hand-rolled Web Audio player (about 100 lines). https://www.npmjs.com/package/howler
- **canvas-confetti**: used lazily at the reveal only. https://www.npmjs.com/package/canvas-confetti
- **Not used:** GSAP (licensing/size, not needed), PixiJS and Phaser (overkill for a DOM card UI), Tone.js (heavy, no music).
- Everything else is CSS keyframes.

## Sound-off design rationale
- iOS Safari requires a user gesture to unlock audio (Join tap unlocks) and the hardware silent switch can mute Web Audio, so sound cannot be relied upon.
- `navigator.vibrate` is unsupported on iOS Safari; haptics are Android-only enhancement.
- WCAG 2.2.1 Timing Adjustable: provide a way to extend time limits -> Relaxed timing x1.5.
- WCAG 1.4.1 Use of Color: player identity and card states use shape + name + color, never color alone.
- WCAG 2.3.1 Three Flashes: no full-screen flash; effects are small and limited.
- Therefore a 44px always-visible status strip carries every announcement the auctioneer voice would give, as a screen-reader live region. https://www.w3.org/WAI/WCAG22/Understanding/

## Testing research
- `@cloudflare/vitest-pool-workers` runs tests in the Workers runtime and provides `runDurableObjectAlarm` to fire alarms deterministically. https://developers.cloudflare.com/workers/testing/vitest-integration/ (re-verify config with chosen vitest version and on Windows)
- Playwright preferred over Cypress: multi-context/multi-page in one test (several players), better WebSocket support, free parallelism. https://playwright.dev
- fast-check scoped to about 5 engine/room-core properties. https://fast-check.dev

## Design choices tied to research
- Full snapshots (<5KB) not deltas: simpler, makes reconnect trivial, within free-tier message budget.
- Alarm-only timers because hibernation wipes memory.
- Auto-response keepalive to avoid billing/waking the DO per ping.

## WS3b pre-verification results
(Empty. WS3b appends results of the Open Verifications from `../05-tech-stack.md` section 17 here, with date and doc URLs.)
