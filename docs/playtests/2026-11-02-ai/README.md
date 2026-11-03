# AI playtest, 2026-11-02 (re-run after the playtest follow-ups)

The same setup as [2026-10-27](../2026-10-27-ai/README.md), to check whether the follow-ups landed. Four Sonnet agents (medium effort) each played one full game as a persona, driving their own headless Chromium on the real web UI.
- Build: `main` @ `2db9cd1`, after #32-#45. That includes quick fixes B1-B10 (#33), first-game tips (#32), the sale moment (#34, #37), the desktop reveal (#36), the podium fixes (#41, #42), room info on join (#40) and the desktop tip placement (#45).
- Game: Classic, Quick, 4 players, 8s window + Relaxed, timers stretched 15x (local only, reverted). Room BF5JR.

Raw reports: [Mia](Mia.md), [Dev](Dev.md), [Sam](Sam.md), [Ray](Ray.md). Key screenshots are in [shots/](shots/).

| Player | Persona | Device | Score | Fun | Fun on 10-27 |
|---|---|---|---|---|---|
| Dev | competitive auction-game fan | desktop 1440x900 | **$2,055 (won)** | 7/10 | 6.5 |
| Mia | casual party host | phone 390x844 | $1,380 | 7/10 | 7 |
| Sam | mobile gamer | phone 412x915 | $600 | 6/10 | 7 |
| Ray | owned the 2001 original | laptop 1280x800 | $385 | 5/10 | 7 |

Average fun: 6.25, down from 6.9. With 4 LLM players and one game each, that is within noise, and the low scores track the players who finished last (Ray, Sam). Don't read it as a regression on its own.

**Caveats (read before acting on this):**
- **Transient UI is under-sampled.** The agents look at snapshots between actions. Tips auto-hide after 9s, and the sale toast and SOLD! stamp last about 2s. Meanwhile each turn was stretched 15x, so most of that UI showed and vanished while an agent was in `wait`. Ray did see a win toast. Mia saw later tips "come on their own". So "never saw X" often means "X was gone by the next snapshot". A human watching continuously would see more.
- Sam's "card indices shift after tip dismiss" is a harness artifact. The `[n]` numbers in the harness's element list renumber when the "Got it" button goes away. On screen the cards don't move (shots/Sam-006.png vs Sam-008).
- Sound was off; LLM players, not people. The friends playtest (M5) is the real test.

## What landed (vs 10-27)
- **B1 to B10:** none of the 10-27 bugs came back. Nobody hit the stale "YOUR TURN", silent card taps, Gift wording, dev pill, badge truncation or sheet issues.
- **First-turn tip:** "Bid cards don't score: only the items you win do. Spend them!" was seen by all 4 at the right moment (shots/Dev-007.png). On 10-27 this was the rule everyone learned too late.
- **"3 = x2" and "One more = x2!" in the SETS strip/panel:** this taught sets to Dev and Sam during play. On 10-27 sets were learned only at the reveal by all 4. Mia and Ray still learned it at the reveal.
- **Reveal:** STEAL / Ripped off moments were the best moment for 3 of 4 again.
- **Join screen:** the room info line ("Room BF5JR · 0/6 players · Classic") worked.

## Still not landing, by how many testers hit it
| # | Problem | Who | Notes / likely fix |
|---|---|---|---|
| P1 | **Winning an item doesn't feel like a moment.** It reads as a log line ("Yours! ..."). | all 4 | The toast and stamp exist (#34) but are brief. Add a *persistent* cue: the won item flies to / pulses in the SETS strip or podium, and the next status line says "You won {item}!" until you act. Haptic on phones. |
| P2 | **Number keys on a spent or out card do nothing**, then the bay key says "Pick a card first". | Dev, Ray | B2 (#33) added reasons for *taps*; the keyboard path still fails silently: `cardForKey` returns null for a spent slot, so the key falls through with no message (`GameScreen.tsx` key handler). Reuse `cardTapReason` for key presses (shots/Dev-032.png). |
| P3 | **Proxy is unexplained**, and the bay reason "Proxy tops" doesn't say how to answer it. | Dev, Sam, Ray (Mia got the Proxy tip) | The Proxy tip only fires on selecting a Proxy. Make the illegal-bay reason say what to do: "A Proxy is on top: only a Proxy can beat it" (R15, R16 step 4). |
| P4 | **Outbid cards stay on the bay until it closes** surprised players; some thought outbid cards return at once. | Dev (+ Mia, Sam unclear) | There is an "outbid" tip, but it is one-time and brief. Make the hand card's "out on B" state self-explanatory (shots/Dev-035.png), e.g. "on B · back when it sells". |
| P5 | **Spent vs out** (a winning card is gone; an outbid card comes back later) isn't explained. | Mia, Ray | Pair this with P4: one short line in the hand legend or a tip on the first spent card. |
| P6 | **Leftover cards**: the two last-place players ended with 8-9 unused cards. | Sam, Ray (observed by Dev) | The first-turn tip says "Spend them!", but late game there's no nudge. A "cards left to spend" hint in the last round (Dev's ask). |
| P7 | **Wild (Display Case) missing from the SETS strip.** | Sam | shots/Sam-082.png. Show the wild and which set it will join. |
| P8 | **Reveal is a long wall of text on phones**, with no focus on *my* wins. | Sam, Ray | shots/Sam-090.png, Ray-120.png. Lead with my items, or a running total bar. |
| P9 | The Gift tip fired before the player had any Gift context. | Sam | Trigger it when a Gift is on a bay *and* I can bid on it, or when I win one. |
| P10 | Late game: bays sit "empty" with little to bid on. | Dev, Ray | Expected (deck runs out; R13). Could say "No more items in the deck" (shots/Ray-111.png). |

## Recommended next steps
1. **P2 + P3 + P4/P5 (small, web only):** keyboard reasons, a clearer "Proxy tops" reason, a self-explanatory out state, and spent vs out copy. These are cheap and remove the most confusion.
2. **P1 (win moment):** a persistent "You won {item}!" cue plus a SETS/podium pulse. This is the top ask in both playtests.
3. **P7 and P9:** small fixes to the SETS strip and the Gift tip trigger.
4. **P6 and P8:** design calls (a late-game nudge, reveal emphasis). Put them to the user.
5. **For the next AI run:** have the harness log transient UI (tips, toasts, stamps) as events, like it already does for the status line, so the snapshot gap stops hiding them.

## Re-running this playtest
Same as [2026-10-27](../2026-10-27-ai/README.md#re-running-this-playtest), using [harness/](harness/). Notes from this run:
- The harness writes screenshots to `harness/shots/`. About 450 PNGs (52 MB) per run; keep only the key shots in `shots/`.
- `pnpm dev` leaves `next start-server.js` and `workerd` running after the parent stops. Kill those by port (3000, 8787).
- In the lobby, "Relaxed timing" is a checkbox that starts unchecked. The harness shows `(checked)` once it is on.
