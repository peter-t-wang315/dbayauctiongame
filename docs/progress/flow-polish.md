# Flow polish progress

## Branch / base
`fix/create-room-and-flow` off origin/main (e8a3c6a). Files: `apps/web/app/**`, `components/shell/**`, `components/lobby/**`.

## Done
- Task 1: create-room hang. NOT reproduced (create landed on /r/CODE every time on localhost); likely stale dev-server state. Added a safety net: `allowedDevOrigins` (a separate dev issue for 127.0.0.1/LAN origins; does not affect localhost) and a hard-navigation fallback (`components/shell/gotoRoom.ts`, only fires if the pathname is unchanged, warns in the console) used by the landing and "Create a new room" buttons.
- Pre-PR review round 1 blockers fixed: docs/04 updated, length hint matches docs/02 (rounded outward, unit-tested in `lengthHint.test.ts`), gotoRoom race.
- Task 2: landing lot row (5 item sprites), pitch line, outlined "How to play", higher-contrast tagline.
- Task 5: lobby names no longer truncated (single column on phones, tags wrap); guest settings chips read as intentional read-only.
- Task 6: lobby length hint uses PR #21 targets per player count.
- Tasks 3/4 partial: invite line on the join form.

## In progress
- Run landing e2e (needs port 8787 free for the mock).

## Next
- Open draft PR.

## Gotchas
- Pre-join room context (host name, player count) and bad-code detection on load need a protocol/server change (the server only answers after `hello`/`join`); follow-up.
- `pnpm dev` holds :8787 (wrangler); the e2e mock also uses :8787.
