# Playtest log

One section per session, newest first. Device checklist: `07-deploy-checklist.md` section C.

## How to run a playtest (host)
1. Don't deploy during a session (a deploy drops every socket).
2. Note the commit (`git log --oneline -1` or the Vercel deployment) before starting.
3. Play at least one Classic and one Frenzy game, one Quick and one Standard.
4. Right after each game, jot down: length (minutes), winner's total, how often someone had no legal bid ("skipped"), any confusion.
5. Paste notes below, or tell Claude "log this playtest: ..." and it will fill the template.

## How to report a bug
Write one line per bug: **what you did → what happened → what you expected**, plus device/browser and roughly when (time helps match server logs). A screenshot is a bonus. Severity: **blocker** (game can't continue), **major** (wrong result or very confusing), **minor** (cosmetic).

Example: "Frenzy, iPhone Safari, 21:05: bid $300 on bay B as timer hit 0 → card vanished from hand but bay didn't show it → expected 'Too late' and card back. Major."

## Questions to ask players afterwards
- Was it clear whose turn it was / when you could bid?
- Did you ever not know why a bid was rejected?
- Was the game too long or too short? Which mode did you prefer?
- Did the reveal feel fair and fun? Did collections matter?
- Was sound helpful or annoying (if on)?

## Template

### Session YYYY-MM-DD
- Build / commit:
- Players and devices:
- Games played (mode, length preset, minutes, winner total):
- Bugs (severity, what you did → what happened → expected):
- Balance notes (constants in `packages/engine/src/config.ts`):
- Answers to the questions above:
- Later-list triage:
