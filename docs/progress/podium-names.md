# Podium names readable at 6 players

**Branch / base:** `fix/podium-names`, stacked on `fix/podium-crowding` (draft PR #41).

**Done:**
- At 5-6 podiums the desktop header is tighter: 16px name font (was 18), 8px side padding, 4px gap, smaller BOT/YOU/AWAY tags (9px, 4px padding).
- Name element has `title={name}` (full name on hover; the name is also in the li text for screen readers).
- e2e (game.pw.ts, 6 players at 1280 and 1440): every `.g-pod__name` has `title === text` and `scrollWidth <= clientWidth`.
- Screenshot: `docs/mockups/desktop/podiums-6p-names-1280.png`.

**In progress:** none.

**Next:** review/merge after #41.

**Gotchas / decisions:**
- Name limit is 16 chars (JoinForm/PlayerGrid `maxLength={16}`); longer names still ellipsize at 6 players, by design.
- Mock bot names: Bot Billy, Bot Betty, Bot Bob, Bea, Bart. Phone/tablet DOM unchanged apart from the title attribute on a desktop-only component.
