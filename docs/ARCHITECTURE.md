# Architecture

## Forked from Athletic Lab (2026-11-07)

Dance Lab is Athletic Lab at v0.6.1 with the body swapped out: the types, database, backup, sync, clips, parent mode, player, tour and tests are the same code with new words. What changed: the exercise library (`src/data/exercises.ts`, 47 bodyweight moves, flex/strength/core/balance/feet/breathing areas, `Load` is always `'body'`), the templates (seven days, 12 minutes or less), the readiness engine (dance, performance and jumping instead of pitching, throwing and tournaments), the rotation (stretch, strength, feet instead of Strength A / Shortstop / Strength B), the Figure poses, the messages, badges and missions, the demo data, the parent view (no load approvals, no supplements, every move listed with watched/turn-off), and all copy. Removed: YouTube demos (`videos.ts`, `check-videos.cjs`, `keepalive.yml`), weights and load approvals, the supplements table.

## Reused from Dugout Dad and Dugout Lab (inspected 2026-11-02)

Same stack and shape: Vite + React + TypeScript PWA, Dexie (IndexedDB), fflate ZIP backups with SHA-256 manifests, hash router, vite-plugin-pwa precaching, GitHub Pages deploy through `.github/workflows/pages.yml`, zero-dependency static server, vitest with fake-indexeddb, Playwright acceptance walks. Reused as code: `Sheet.tsx` (bottom sheet, toast, confirm), `ErrorBoundary.tsx`, `hash.ts`, `server.cjs` (port 4177), the Pages workflow, the guided-tour component (new stops), the PIN pattern (now a parent-mode gate instead of a whole-app lock), the two-step share sheet, the merge-by-record restore with a kept-newer-here report, the design tokens (new palette and three themes).

Not reused: anything baseball.

## Separation from the other two apps

- Own repository and Pages path, so its own manifest `id`, `start_url` and service-worker scope (`/dance-lab/`). Own icon (plum square, ballet shoes) and name.
- Own IndexedDB database name (`dance-lab`). Athletic Lab is `athletic-lab`, Dad Lab is `dad-lab`, Dugout Dad is `dugout-dad`, Dugout Lab is `dugout-lab`. On an iPhone each home-screen app has its own storage container anyway; on a laptop under `doc-jpg.github.io` they share an origin but not a database. The acceptance walk checks that no sibling database is touched.
- No file format is shared. A Dance Lab backup (`dance-lab-backup`) is refused by the other apps and vice versa (format string check).

## Data (src/engine/types.ts, src/db/db.ts)

One Dexie database, schema version 1, tables: athlete, settings, exercises, exerciseStatus, templates, sessions, sportsLogs, checkIns, flags, journal, habits, messages, achievements, missions, meta, tombstones, clips. Every record carries `createdAt`/`updatedAt` or `ts`; backup merge keeps the newer copy and never deletes. Sessions snapshot the exercise name and catalog version per item, so history stays readable after a library change. A schema bump adds a `version(n)` line; `tests/persistence.test.ts` proves version-1 rows open after a bump.

Library seeding (`seedLibrary`): exercises and templates with `source: 'library'` are inserted once and refreshed only when `CATALOG_VERSION` / `TEMPLATES_VERSION` moves and the record was never edited (updatedAt === createdAt). Custom and edited items are left alone.

## Readiness engine (src/engine/readiness.ts)

Pure function. Inputs: the day, the check-in, every activity log and session in reach (it filters), the strength-days setting, the session the rotation would offer on a green day, and the non-strength fallback. Order of evaluation:

1. Body-part blocks from today's and yesterday's logs (lots of jumping, a performance day, or a long hard dance or gymnastics class: legs and jump today; a performance yesterday keeps legs blocked, jumping yesterday keeps jump blocked), plus the cumulative-load ratio (7-day load against the 28-day weekly average).
2. Red (pain, sick, dizzy): return at once with the Easy day (two minutes of breathing) as the offer, Foundations off, and parent alerts.
3. Orange: performance day, day load 6 or more, two activities adding to 4 or more, energy "wiped out", very sore, or load ratio 1.5 or more. Offer: Recovery; Foundations optional.
4. Yellow: day load 3 to 5 (a normal dance class is 4), big day yesterday, low energy, sleep 2 or less, a little sore, six active days in a row, or load ratio 1.3 or more. Offer: Light day, reduced (one set each).
5. Green: the next session in the rotation (Stretch and reach, Strong and steady, Happy feet, round again; `nextInRotation` in program.ts). A strength turn becomes the fallback (whichever of stretch and feet was longer ago) when strength was inside 48 hours, the weekly cap is reached, or legs are blocked. Stretch and feet days have no cap.

Every branch appends a plain-words reason. Alerts become `flags` for the parent dashboard.

## Program and progression (src/engine/program.ts)

`programPhase` from the program start: weeks 1 to 2 learn, 3 to 4 build, 5 to 6 refine, then four-week blocks (three develop weeks, one review week). `buildSession` turns a template into a session: disabled exercises out; an exercise a parent has not watched yet (none in the shipped library) swapped for a substitute (first substitute, else the easier version, that is not blocked); an exercise carrying a blocked tag swapped the same way or dropped; jumps dropped on a reduced day. `decideDose` starts from the template dose, moves to what was last done (bounded by the template below and the exercise cap above), and adds two reps, or five seconds, or one set, only when the last two sessions of that exercise were fully completed and felt easy, in a phase that allows it; a hard session eases back toward the template. Growth-spurt mode and review weeks hold. Every set is body weight; there is no load code path left in the UI.

## Messages, badges, missions (src/engine/habits.ts, achievements.ts)

Messages: a pool with a fit function per message (dance day, jumping day, low sleep, recovery color, days since the last session); the best-fitting message not shown inside the rotation window wins, ties broken by the date; quiet hours return null; once chosen the day's message is recorded and stays. Badges: pure tests over sessions, check-ins, journal and habits; `newBadges` only adds. Missions: three per week picked by week number; progress recomputed on every refresh; unfinished ones expire with the week.

## Parent mode (src/ui/mode.tsx)

Session state, not persisted: `athlete` by default; `enterParent(pin)` checks the salted SHA-256 in settings; drops back after ten minutes in the background or on "Back to Vivi mode". The parent page never queries private journal entries. The visibility card on Settings is the whole list of what parent mode shows.

## Backup (src/io/backup.ts)

ZIP of one JSON file per table plus `manifest.json` (format `athletic-lab-backup`, scope `full` or `parent`, SHA-256 per file). `parent` scope strips private journal entries and all PIN fields. Restore: `merge` adds missing records, keeps the newer copy (sessions: the more finished status wins, so a done session is never replaced by a planned copy; athlete: goals are unioned by id), and reports records that were newer here; `replace` clears data tables first and keeps this phone's PINs, parent name and tour flag. Same file twice changes nothing.

## Offline

vite-plugin-pwa precaches the shell (about 580 KB). Data is in IndexedDB. Live workout state (index, paused, elapsed) is written to the session on every change. Installed home-screen apps count as safe storage; a browser tab gets an install prompt. A home-screen icon is not a backup, and the Settings copy says so.

## Sync (src/io/sync.ts, docs/sync-schema.sql)

Automatic two-way sync through a free Supabase project. One table `records(family_id, tbl, id, stamp, data, deleted, device, server_ts)`; `family_id` is sha256 of the family code; every request carries the code in `x-family-key` and the row-level policy compares the hash. A trigger refuses an older stamp and sets `server_ts` on every accepted write. Push: every local record with stamp > lastPush (plus tombstones), upserted in batches; pull: rows with server_ts > lastPullTs, merged with `mergeRecord`; a pull that merged anything pushes again. Triggers: open, foreground, online, two seconds after a write, every two minutes. Not synced: private journal entries, settings, meta, untouched library rows. Without a family code the app is a single-device app. The Supabase project is shared with Athletic Lab and Dad Lab; each app's family code is different, so rows never meet, and no new SQL was needed.

## Watch it: drawings and clips (src/ui/components/Figure.tsx, Watch.tsx, src/io/clips.ts)

Figure draws a stick figure from joint positions and, where a pose has a second frame, eases between the two with requestAnimationFrame (reduced motion → first frame only). 48 poses: the shared ones (squat, bridge, plank, dead bug, bird dog, march, skip, breathing, cat and cow) plus the dance set (butterfly, straddle, pike, frog, cobra, child's pose, down dog, arabesque, relevé, point and flex, inchworm, bear crawl, crab walk, starfish, low lunge, quad, figure four, superman, wall sit, hollow, toe curls). No outside videos: `Watch` renders only the family's own clips. `clips.ts` uploads to the private Supabase storage bucket `clips` at `<familyId>/<exerciseId>/<id>.<ext>` with the family key header, fetches a clip as a blob behind the same header, and deletes file + row + tombstone. The `clips` table is in `DATA_TABLES`, so backups and sync carry the metadata.

## Still needing a server
Background push notifications. Everything else the master prompt listed under "requires infrastructure" is in.
