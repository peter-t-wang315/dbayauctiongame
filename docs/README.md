# dBay: Project Docs

This is a browser version of the 2001 *eBay Electronic Talking Auction Game*, rebuilt with a **generic, fictional theme** (no eBay branding). It's meant for friends to play together, each on their own phone or desktop:

1. The host creates a room and shares a link.
2. Friends join with a room code and a username.
3. Everyone plays live.

> **Status:** planning complete, no code yet. Next step: **WS0 Contracts** (see [06-workstreams.md](06-workstreams.md)).

## Start here (new session or new agent)
1. Read this file.
2. Read the doc for your task (table below). Every workstream in `06-workstreams.md` lists the docs it needs and has a ready-to-paste kickoff prompt.
3. Update the **Status checklist** below when you finish something.

## Docs index
| Doc | What it answers | Main readers |
|---|---|---|
| [01-game-rules.md](01-game-rules.md) | Exact rules of our version. Rule IDs R1…, each tagged CONFIRMED or ASSUMED. Tunable constants. | Engine (WS1), room-core (WS3a) |
| [02-modes-and-scaling.md](02-modes-and-scaling.md) | Classic vs Frenzy modes, scaling to 3–6 players, balance targets | WS1, WS3a, simulator |
| [03-content.md](03-content.md) | 6 categories, 60 fictional items with estimated and actual values, special cards, data schema | Content (WS2) |
| [04-ux-and-ui.md](04-ux-and-ui.md) | Screens, wireframes, mobile layout budget, bid interaction, visual style, feedback animations, sound-off play, accessibility | WS4, WS5, WS6, WS8 |
| [05-tech-stack.md](05-tech-stack.md) | Hosting decision, architecture, monorepo, protocol, room server design, deploy, costs | WS0, WS3a, WS3b, WS7 |
| [06-workstreams.md](06-workstreams.md) | Work packages, owned files, dependencies, acceptance criteria, testing strategy, milestones | Everyone |
| [Mockups](https://claude.ai/artifact/6GqjUAkgWqH8xJ78KFAkST) | Clickable phone mockups (landing, lobby, Classic, Frenzy, reveal); source in `mockups/project/*.dc.html` | Everyone |
| [research/](research/README.md) | Sources and evidence behind the decisions | Reference |

## Key decisions (short version)
- **Players:** 3–6.
  - **Classic mode** (default for 3–4 players) keeps the original's color-calling turns.
  - **Frenzy mode** (default for 5–6 players) lets anyone bid at any time, with per-bay timers that extend on late bids. The host can override the default mode at any player count.
  - 3 bays for 3–4 players, 4 bays for 5–6.
- **Stack:**
  - Next.js on Vercel for the frontend.
  - One Cloudflare Durable Object per room for the game server, written with PartyServer (not hosted PartyKit, which shuts down 23 Oct 2026). Free tier.
  - pnpm monorepo: `apps/web`, `apps/server`, `packages/{protocol,room-core,engine,content}`.
- **The server is authoritative:**
  - The room logic is a pure reducer.
  - All timers are Durable Object alarms.
  - Every update is a full snapshot, filtered per player. **Hidden actual values never reach any client before the reveal.**
- **No accounts:**
  - 5-character room codes (30-character alphabet, no 0/O/1/I/L/U), usernames, and a per-room secret in `localStorage` so a player can reconnect.
- **UX:**
  - Mobile-first, and nothing needed to play scrolls or hides behind a tap.
  - Fully playable with sound off: a status strip shows in text what the auctioneer would say.
  - No chat (players are on a call or in the same room). Emoji reactions are Later.
- **Testing:**
  - Pure engine and room-core tests, a replay test, a redaction leak test, and about 6 Durable Object integration tests run in CI.
  - Simulator, bots, and Playwright smoke tests are SHOULD.

- **Cards and rules in one line:** 12 bid cards per player ($10, 25, 50, 75, 100, 125, 150, 200, 250, 300 + 2 Proxy). 60 items (6 categories x 10) + 9 specials (5 Display Case, 4 Gift). Display Case and Gift are won items, not bid cards, and never sit in the hand. Played Proxies are face-up on the bay.
- **ASSUMED decisions made during doc review** (change in the named doc): `reveal` -> `ended` by a server deadline (01 R37, 05 section 8); bots are in scope for WS1 (SHOULD); played Proxies are public (01 R16); either mode is allowed at any player count (02).

## Open questions for the user
1. ~~Game name~~ **Decided: dBay** (2026-10-11). Own logo and colors; no eBay logo, colors or fonts.
2. ~~Art direction~~ **Decided:** "auction house meets arcade" + 12×12 pixel-art item sprites; wordmark uses our player colors, not eBay's (see 04 §11).
3. ~~Item list~~ **Decided: keep the 60 items for now** (easy to edit later in `packages/content`).
4. ~~Domain~~ **Decided: default `*.vercel.app` + `*.workers.dev` URLs for now.**

## Status checklist
- [x] Research the original game and its reviews
- [x] Improvement ideas vetted (KEEP/LATER/CUT)
- [x] Tech stack chosen and fact-checked
- [x] Planning docs written (01–06, research)
- [x] Mockups: white theme default, eBay-inspired player colors, pixel sprites (04 §11–13)
- [ ] **M1 (WS0):** contracts, monorepo, CI, mock server
- [ ] **M2:** playable local game against bots (WS1, WS2, WS3a, WS4, WS5)
- [ ] **M3:** online multiplayer deployed (WS3b, WS6, WS7)
- [ ] **M4:** juice and polish (WS8)
- [ ] **M5:** playtest with friends, then tune constants with the simulator

## Git workflow for sessions and agents
Use your judgement here. Don't wait to be asked for routine git hygiene. The detailed branch and PR naming per workstream is in [06-workstreams.md](06-workstreams.md).

- **Commit and push periodically.** Commit whenever you reach a safe checkpoint:
  - typecheck, lint and tests pass for what you touched
  - the change is a coherent step
  - no secrets or local-only files are included

  Push after committing, so work is never stranded on one machine. Also commit or push whenever the user tells you to. Never commit broken builds to `main`. If unsure, commit to a feature branch instead.
- **Start a new branch when new work begins.** Branch off up-to-date `main` when you start:
  - a new workstream
  - a new feature
  - a contract change
  - a fix unrelated to your current branch

  Stay on the current branch when the work is a direct continuation of it. Name branches per 06, for example `ws1-engine`, `ws5-game-ui/hand`, `contract/add-gift-stage` or `fix/reconnect-loop`. Docs-only tweaks may go straight to `main`.
- **Open a PR when the feature is reviewable.** That means:
  - its acceptance criteria (06) are met, or it's a meaningful, self-contained slice
  - CI is green
  - it's rebased on `main`

  Keep PRs small and focused. Title `WS<n>: <summary>`. The body lists the acceptance-criteria checkboxes, the tests run, and any doc or contract changes. Open a **draft PR** early if parallel agents need to see the work in progress.
- **Merging to `main`** happens via squash-merge after CI passes. Merge your own PR only when the user has allowed it for that work. Otherwise, leave it open and say so.
- **Always say what you did.** At the end of a session, report which branch you're on, what was committed and pushed, and any open PRs.

## Conventions
- Docs are the source of truth. If code needs to differ from them, update the doc in the same PR.
- `ASSUMED` values are expected to change. Tune them in `packages/engine/config.ts`, not inline.
- No real brands or trademarked products in content or UI.
- Exact dependency versions are pinned at WS0 and recorded here:

| Package | Version |
|---|---|
| _(filled in during WS0)_ | |
