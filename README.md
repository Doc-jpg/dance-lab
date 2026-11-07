# Dance Lab (built for Vivi)

A flexibility, body-weight strength, balance and healthy-habits app for one nine-year-old dancer. Offline-first web app for an iPad or iPhone home screen (Android works too), its own app next to Athletic Lab (Eli's) and Dad Lab, never touching their data. Forked from Athletic Lab: same plumbing, different body, different words.

- **Live app:** https://doc-jpg.github.io/dance-lab/ (iPad or iPhone: Safari, Share, Add to Home Screen; Android: Chrome, menu, Install app). Open it once online so it can store itself for offline use.
- **Code:** https://github.com/Doc-jpg/dance-lab (every push to `main` redeploys through GitHub Actions).
- **Who sets it up:** the parent, once, on Vivi's device (two minutes); then the app talks to her. A family link connects the parent's phone, and from then on everything syncs on its own (`docs/IPHONE_SETUP.md`).
- **Docs:** `docs/` (architecture, decisions and lessons, setup, design principles).

## What it does

1. **Daily check-in** (dance class, PE, playing outside, swimming, gymnastics, bike; how long and how hard; lots of jumping; a recital, show or competition; energy, sleep, soreness; pain, sick, dizzy). Thirty seconds, sensible defaults.
2. **Readiness engine** turns that plus the last four weeks into Green (the planned session), Yellow (dance-class day, short sleep or a little sore: the Easy workout, one set each), Orange (a performance or a very big day: the five-minute stretch) or Red (something hurts or she is sick: the Easy day, two minutes of breathing, tell a grown-up), and always says why. Lots of jumping blocks jumps and hard leg work today and tomorrow; a performance day forces recovery and keeps the legs easy the next day; strength days keep 48 hours apart and a weekly cap (two or three); a rest-day check; a cumulative-load brake. Something every day, no matter what.
3. **Original exercise library** (47 moves: warm-up, stretching, strong, strong middle, balance, feet and ankles, breathing, cooldown), each with what it builds, why it matters for dancing, steps, cues, common mistakes, when to skip, easier and harder versions, a moving stick-figure drawing, and a slot for the family's own clips of Vivi uploaded from the parent view into a private bucket. Rules baked into the library: body weight only, nothing bouncy, nobody pushes a stretch, holds of 15 to 30 seconds, no deep backbends or bridges, no neck stretches, warm first.
4. **The days:** Stretch and reach, Strong and steady and Happy feet take turns on green days; the Daily 5 (five easy minutes, any day); the Easy workout (dance-class days); the Five-minute stretch (big days); the Easy day (red days). All 12 minutes or less.
5. **Progression** by phase (learn, build, refine, four-week blocks with a review week): a few reps or five seconds, then a set, only after two easy completed sessions, never past the cap. Harder versions (wall push-up to couch push-up, stork to arabesque) are offered, never forced.
6. **Player:** one move at a time with the drawing, one big button that says what to tap, a countdown for holds, "Done" and auto-advance, easier/harder swaps, pause, quick notes, and a Stop that treats pain, dizziness and illness as a grown-up's matter.
7. **Journal, calendar (Sunday first) and progress** against her own history only: sessions, best stork balance, best plank. **Badges** that are never taken away; **weekly missions** that simply expire.
8. **Habits:** water, real meals, fruit and vegetables, sleep, play. Nothing about weight, shape, calories or dieting, ever.
9. **Parent mode** behind a PIN: alerts, the week, turn any move off, note that you watched one, strength days per week, growth-spurt mode, reminders and quiet hours, backups. Everything parent mode shows is listed on a card Vivi can read; private journal notes stay private.
10. **Automatic sync** between Vivi's device and the parent's phone through a family code (private notes and PINs never leave the device), plus **backup** (ZIP with checksums), **parent pack**, restore with **merge** that never overwrites a newer record, three looks (Playful, Calm, Stage), a guided tour, an FAQ, and three weeks of sample data to explore.

## Run the checks

```
npm ci
npm test                      # 63 vitest tests: engine, library rules, persistence, sync
npm run build && node server.cjs
URL=http://localhost:4177/ node scripts/acceptance.cjs          # iPhone 13 walkthrough from an empty device
DEVICE="Pixel 5" URL=http://localhost:4177/ node scripts/acceptance.cjs
LIVE=1 URL=http://localhost:4177/ node scripts/acceptance.cjs   # adds the parent copy through the real sync server
```

Not medical advice. A guide for a healthy kid with a parent nearby; anything that hurts means stop and tell a grown-up. The dance teacher takes her further in class; this app keeps the everyday habit.
