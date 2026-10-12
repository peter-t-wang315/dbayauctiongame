# Deploy checklist and real-device playtest

Nothing here has been done yet. Needs the owner's Cloudflare and Vercel accounts. Background: `05-tech-stack.md` sections 13-16.

## A. One-time setup (owner)

1. **Cloudflare**: create a free account. Workers Free is enough (SQLite-backed DOs, already configured).
   - Note the Account ID (dashboard sidebar).
   - My Profile > API Tokens > Create Token > template "Edit Cloudflare Workers" (scopes: Account > Workers Scripts: Edit; Account Settings: Read; User Details: Read; Memberships: Read).
   - The first `workers.dev` subdomain must be registered once (dashboard > Workers & Pages > it prompts).
2. **GitHub repo** (Settings > Secrets and variables > Actions):
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
   - Variables: `WORKER_HOST` (e.g. `dbay-server.<subdomain>.workers.dev`), `WORKER_HOST_PREVIEW` (e.g. `dbay-server-preview.<subdomain>.workers.dev`), `SMOKE_ORIGIN` (the Vercel production URL). The smoke origin must be in the target Worker's `ALLOWED_ORIGINS`: preview allows any `https://*.vercel.app`, production only the exact origin you set. Optional `SMOKE_ORIGIN_PREVIEW` overrides it for preview runs.
   - Until the token exists, `.github/workflows/deploy.yml` skips cleanly.
3. **Worker config** (`apps/server/wrangler.jsonc`): replace `https://CHANGE-ME.vercel.app` in `env.production.vars.ALLOWED_ORIGINS` with the real Vercel production origin (comma-separated for more, e.g. a custom domain). `env.preview` already allows `https://*.vercel.app`.
4. **Vercel**: import the GitHub repo.
   - Root Directory `apps/web`; framework Next.js; install command default (pnpm workspace is detected); "Include source files outside of the Root Directory" ON (workspace packages).
   - Env var `NEXT_PUBLIC_GAME_HOST` (host only, no scheme):
     - Production: `dbay-server.<subdomain>.workers.dev`
     - Preview: `dbay-server-preview.<subdomain>.workers.dev`
   - It is inlined at build time: change it, then redeploy.
5. **First deploy** (once approved): Actions > "Deploy Worker" > Run workflow > `preview` first, then `production`. Smoke runs at the end. After that, pushes to `main` touching `apps/server` or `packages` deploy production.

Do not deploy while a playtest is running; it drops every socket.

## B. After deploy

- Open the Vercel production URL, create a room, add 2 bots, play to the reveal.
- A Vercel preview deployment must talk to the preview Worker: check the browser Network tab for `dbay-server-preview`.
- Local pre-check any time: `pnpm --filter @dbay/e2e e2e` (real local Worker + web, no accounts needed).

## C. iPhone over LAN (before or instead of a public deploy)

PC and phones on the same Wi-Fi. Find the PC IP (`ipconfig`), say `192.168.1.50`.

1. `apps/server/.dev.vars`: `ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.50:3000`
2. `apps/web/.env.local`: `NEXT_PUBLIC_GAME_HOST=192.168.1.50:8787`
3. `pnpm dev:server` and `pnpm dev:web` (both bind 0.0.0.0).
4. Windows Firewall: allow Node and workerd on the private network (ports 3000, 8787).
5. On the iPhone open `http://192.168.1.50:3000`.

Checklist (tick on a real device, Safari, portrait):

- [ ] Page loads, no horizontal scroll; tap targets comfortable with a thumb
- [ ] Create room, share code, second phone joins by code/link
- [ ] Name entry keyboard does not cover the Join button
- [ ] Classic: two-tap bid works; Frenzy: bid without turn
- [ ] Timers/countdown look right (no visible drift between phones)
- [ ] Lock the phone 10 s, unlock: seat restored, state current
- [ ] Switch to another app for 30 s and back: reconnects without losing seat
- [ ] Toggle airplane mode for 5 s: reconnects
- [ ] Reload mid-game: seat restored
- [ ] Reveal sequence plays, Skip works, Rematch returns to lobby
- [ ] Sound off by default; haptics/confetti do not jank
- [ ] Safe-area (notch/home bar) not covering controls
- [ ] 3 humans + bots finish a full game

Record the session in `docs/07-playtest-log.md`.
