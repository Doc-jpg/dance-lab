# Design principles

Carried over from Dugout Lab (Deren, 2026-11-02: "blend comprehensiveness, thoroughness and granularity with ease of use, quick interactions, and a clean, simple UI for actual users who aren't technical at all") carried into Athletic Lab, and re-aimed here at a nine-year-old dancer with an iPad on the floor next to her.

1. **Thirty seconds to a plan.** The check-in defaults to "a normal day", so a kid with nothing to report taps Save and gets a color and a session. Dance and play are added by tapping a chip; three chips (how long, how hard, anything big) are all it asks.
2. **One tap per set.** In the player, a set is one big button. Holds count themselves down. Rest timers can be skipped. Reps can be nudged with plus and minus, never typed.
3. **Depth behind a fold, never gone.** Every exercise carries steps, cues, mistakes, skip conditions, versions and history; the player shows the picture and the cues, and "How to do it" and "Why it matters" open on demand.
4. **Say why, every time.** The readiness card lists its reasons; every swapped exercise says what it replaced and why; every dose says why it is what it is ("Holding steady until two sessions in a row feel easy").
5. **Nothing is required to start.** Name, birth year, activities, a look. Goals, reminders and the parent name come later, from the place they are used.
6. **Hard rules never relax.** Red means no workout. A blocked body part stays blocked even when Vivi picks a different session. There are no weights at all. Nobody pushes a stretch, nothing bounces, no deep backbends, no neck stretches. The engine's fallbacks can swap and drop, never override.
7. **Nothing punishes.** Skipping, stopping, missing a week: no streak, no lost badge, no scolding message. Smart recovery choices earn badges. The message pool is checked by a test for guilt, shame and body talk.
8. **Words a kid uses.** "Wiped out", "A little sore", "Something hurts", "Felt good". No codes, no RPE, no load percentages on screen (the load score sits under "Why this day" for the curious).
9. **Transparent, not surveilled.** Parent mode is behind a PIN and shows exactly what the "What a parent can see" card says. Private notes are private on the phone, in parent mode and in the parent pack.
10. **Works offline, one-handed, on a phone.** Big targets, bottom sheets, no hover, live state saved on every change so a closed app reopens mid-set.
11. **Test the path a new kid walks.** `scripts/acceptance.cjs` starts from an empty device: setup, check-in with dance class, a full Easy workout, offline reload, a journal note offline, Happy feet on a yellow day, a red day, parent mode, backup and restore, the tour, and with LIVE=1 the parent copy through the real sync server.

**Carried over from Athletic Lab (2026-11-07, after Eli's first session):** the big button is the instruction. Under the drawing there is always exactly one bright thing to tap (start the timer, did it), the app says Done and moves on by itself, and skipping is a quiet option, never the default. If a kid can get to the end without logging anything, the player is wrong.

**Dance Lab additions (2026-11-07):** flexibility is a daily habit, not a push. Holds are short (15 to 30 seconds), warm first, breathe out, "a good pull, never a pinch". Every stretch's skip line says never bounce and never let anyone push you deeper, and a test keeps it there. Nothing in the app talks about weight, shape or what a dancer's body should look like; the message pool is tested for it. Sessions are 12 minutes or less because nine-year-old attention is the real cap.
