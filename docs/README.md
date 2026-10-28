# dBay: Project Docs

This is a browser version of the 2001 *eBay Electronic Talking Auction Game*, rebuilt with a **generic, fictional theme** (no eBay branding). It's meant for friends to play together, each on their own phone or desktop:

1. The host creates a room and shares a link.
2. Friends join with a room code and a username.
3. Everyone plays live.

> **Status (2026-10-27):** M1 and M2 done; M4 code done. Merged through PR #30: everything above plus R17 age bonus + R18b no-bid round clear (#21), engine follow-up tests (#27), special sprites + ranked results (#23), create-room safety net + landing/lobby polish + lobby length hint (#24), HUD polish (#25), turn-edge flash (#26), desktop hybrid layout (#28), CI e2e jobs pinned to ubuntu-24.04 because Playwright can't install Chromium on 26.04 (#30). CI: `check`, `e2e-web`, `e2e-real`, `e2e-robustness`. Run locally with `pnpm dev` (web :3000, server :8787).
> **AI playtest 2026-10-27:** 4 persona agents, fun 6.5-7/10. Findings, bugs and the feature wishlist are in [playtests/2026-10-27-ai/](playtests/2026-10-27-ai/README.md); start with its "Recommended next steps".
> **Open items:** (1) Quick-fix PR from the playtest (stale "YOUR TURN", tap feedback, Gift modal wording, outbid item name, badge truncation; investigate the "no legal bid" skip). (2) Desktop reveal/results layout. (3) 6-player podium crowding at 1280px. (4) Join-screen room info / bad-code-on-load need a room-info endpoint. (5) Tests for the FxController bump and "Bid sent" flash. (6) Next.js has a known security advisory; upgrade on its own branch. (7) Cleanup: orphaned `.claude/worktrees/agent-*` folders from the OneDrive move (contents verified in git history); delete them, `git worktree unlock` + `prune`, and delete merged branches.
> **Needs the user:** play-test; Cloudflare + Vercel accounts and [07-deploy-checklist.md](07-deploy-checklist.md) (incl. replacing `CHANGE-ME.vercel.app` in `apps/server/wrangler.jsonc`); iPhone/Android checks. Per-workstream progress lives in `docs/progress/`.

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
- [x] **M1 (WS0):** contracts, monorepo, CI, mock server
- [x] **M2:** playable local game against bots (WS1 ✅, WS2 ✅, WS3a ✅, WS3b ✅ local, WS4 ✅, WS5 ✅, WS6 ✅)
- [ ] **M3:** online multiplayer deployed (WS3b ✅, WS6 ✅, WS7 prep ✅; deploy waits on user accounts)
- [ ] **M4:** juice and polish (WS8 ✅ code; manual iPhone audio / Android haptics checks pending)
- [ ] **M5:** playtest with friends, then tune constants with the simulator

## Working within usage limits (Claude Pro, $20/mo)
The project is built on the Pro plan. Usage is capped per rolling window and per week, and every subagent spends from the same budget. **Plan work to finish within limits, not to maximize parallelism.** This section overrides the concurrency suggestions in 06.

- **Do it yourself first.** Handle work inline in the main session. Only spawn a subagent when it really saves effort or the user asks: a large isolated research sweep, the pre-PR review, or a truly independent workstream.
- **Parallelism: at most 3 coding subagents at a time**, plus at most 1 reviewer subagent. Only run workstreams in parallel when 06 says they have no file conflicts. Parallel agents spend the usage window faster; they don't stretch it. If several agents run at once, they can all be cut off at the same moment, which is why the checkpoint protocol below is mandatory.
- **Model choice:**
  - **Sonnet** is the default for coding and reviews.
  - **Haiku** is for mechanical or bulk work: lookups, data entry such as the 60 items and sprites, simple refactors.
  - **Opus** is reserved for hard design or debugging problems, and only when needed.
  - Use **medium effort** unless the task is truly hard.
- **Read narrowly.** Read only the docs and sections your workstream lists in 06, not the whole `docs/` tree. Use search instead of reading big files end to end. Don't re-read files that are already in context.
- **Cheap checks before expensive ones.** Run typecheck, lint and tests locally; they're free. Fix what they catch *before* asking any agent to review.
- **Pre-PR review stays, but lean.** One reviewer, focused on the diff only. Round 2 happens only if round 1 found blockers.
- **Checkpoint often.** Commit and push at safe points (see Git workflow), and update the Status checklist. If the session hits a usage limit, the next session resumes from the repo with nothing lost.

### Checkpoint protocol (every coding agent, mandatory)
An agent cannot tell when the usage limit is about to hit. Requests just start failing mid-task and the agent's in-context reasoning is lost; only what is on disk and in git survives. So agents must keep their saved place current **at all times**, not at the end of their work.
1. **Work in small slices.** A slice is a coherent step of about 30–60 minutes of work, for example "R1–R6 deck setup + tests". Never hold more than one slice of uncommitted work.
2. **Commit and push after every slice**, even if the workstream isn't done. WIP commits are fine on feature branches (`ws1: wip deck setup, tests pass`). If tests are red, still commit and push, but say so in the message and the progress file.
3. **Keep `docs/progress/<ws>.md` up to date** (for example `docs/progress/ws1.md`) and commit it in the same commit as the slice. It has these sections:
   - **Branch / base:** the branch name and what it is stacked on.
   - **Done:** finished slices and the rule IDs they cover.
   - **In progress:** the current slice and how far it got.
   - **Next:** the exact next step, specific enough that a fresh agent can start it without re-planning.
   - **Gotchas / decisions:** anything non-obvious learned, ASSUMED values chosen, and open questions for the user.
4. **One agent per branch.** Use a separate git worktree (`isolation: worktree`) for each parallel coding agent, so partial work never collides.

**Resuming after a cutoff:** the new session reads this README, then `docs/progress/*.md`, then `git log` and `git status` on each WS branch and worktree. Commit or discard any leftover uncommitted changes, then relaunch each agent with its kickoff prompt from 06 plus "Continue from `docs/progress/<ws>.md`; do not redo finished slices."
- **Size sessions to fit.** One workstream, or one clear slice of one, per session. Stop at a clean checkpoint rather than starting something big near the end of a window.
- **Batch questions to the user.** Ask in one message instead of many back-and-forth turns.
- **Before kicking off a multi-agent batch,** say how many agents and which models in a short line. No go-ahead is needed (see "Operating mode").

**Recommended pacing for the build:**
1. WS0 alone.
2. Then M2, one or two workstreams per session, in this order: WS1 → WS2 → WS3a → WS4 → WS5.
3. Then M3: WS3b → WS6 → WS7.
4. Then WS8.

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
- **Pre-PR review (required before every code PR).** Before opening or un-drafting a PR, the authoring agent must have the change reviewed:
  1. **Machine checks first.** Typecheck, lint and tests must pass.
  2. **Spawn a fresh reviewer subagent.** It must not be the author. Use Sonnet at medium effort, or the built-in `/code-review`. Give it:
     - the diff against `main`
     - the workstream's acceptance criteria from 06
     - the relevant rule IDs and doc sections
  3. **The reviewer reports only blocking issues:**
     - rule or logic bugs
     - hidden values or the seed leaking into a `PlayerView`
     - protocol or contract changes inside a feature PR
     - missing MUST-tier tests
     - unmet acceptance criteria
     - security problems

     Style suggestions are optional, non-blocking notes.
  4. **The author fixes the blocking issues and the reviewer re-checks.** Maximum 2 review rounds. If blockers remain after round 2, open the PR as a **draft** and list the unresolved issues in the body.
  5. **Note it in the PR body:** "Pre-PR review: passed (n rounds)", or the open items.

  Docs-only PRs skip this step.
- **Stacked branches (while a PR awaits review).** Coding may continue before an earlier PR is merged. Branch the new work off the unmerged branch, for example `ws1-engine` off `ws0-contracts`, and open its PR as a draft with that branch as the base. Rules:
  - Record the base in `docs/progress/<ws>.md`.
  - When the base PR changes, rebase the stacked branch onto it.
  - After the base is merged (merge commit), GitHub retargets the stacked PR to `main` once the base branch is deleted; just merge `main` into the stacked branch if it's behind.
- **Merging to `main`** uses a **merge commit** (not squash), so stacked branches keep working without rebases. Delete the branch after merging.
- **Operating mode: autonomous (user decision, 2026-10-11).** The user is hands-off. They test the app and report problems; the main session runs the project:
  - Pick the next workstreams per the pacing order below, launch agents (within the concurrency limit), and keep going between sessions.
  - Merge a PR yourself once CI is green and the pre-PR review has passed (or its blockers are fixed and re-checked). Merge in dependency order.
  - Make routine engineering and tuning decisions yourself, and record them in the docs and the PR.
  - Still ask the user (batched, condensed) before: changing a CONFIRMED rule or a decision listed in "Key decisions", anything that costs money or deploys publicly for the first time, adding real brands, or deleting anything not recoverable from git.
  - After each milestone or testable step, tell the user briefly what they can try and how.
- **Always say what you did.** At the end of a session, report which branch you're on, what was committed and pushed, and any open PRs.

## Conventions
- Docs are the source of truth. If code needs to differ from them, update the doc in the same PR.
- `ASSUMED` values are expected to change. Tune them in `packages/engine/config.ts`, not inline.
- No real brands or trademarked products in content or UI.
- Exact dependency versions are pinned at WS0 and recorded here:

| Package | Version |
|---|---|
| See the root [README](../README.md#pinned-versions) | |
