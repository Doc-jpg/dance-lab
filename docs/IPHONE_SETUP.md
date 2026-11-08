# Who sets it up, and how Vivi gets it

Two people use this app. **Setup is the parent's job, done once on Vivi's device** (her iPad or an old iPhone). After it, the app talks only to Vivi. Everything she does shows up on the parent's phone on its own; nothing is ever sent by hand.

## 1. Vivi's device (the parent does this, two minutes)
1. On her iPad or iPhone, open Safari and go to **https://doc-jpg.github.io/dance-lab/**
2. Tap **Share** (the square with the arrow), then **Add to Home Screen**, then **Add**. The icon is a plum square with ballet shoes, named "Dance Lab".
3. Open it from the home screen (online).
4. The first screen says it is for the parent. Tap **My dancer's device**, enter her first name and birth year, tick her activities, type what the app should call you ("Dad"), and type a PIN twice. The PIN is never shown on screen again.
5. The next screen makes the family link. Tap **Send myself the parent link** and Message or AirDrop it to yourself (or note the 20-character code). Then **Done. Hand it over.**
6. Vivi's screen: she picks a look (Playful, Calm or Stage) and takes the one-minute tour (or skips it).

From then on Vivi opens the app, checks in, and does the day. The only parent thing on her screens is the "What Dad can see" card and a line saying her records go to Dad's phone.

## 2. Your phone (one minute)
1. Install the same address the same way (Share, Add to Home Screen). It sits next to Athletic Lab and Dad Lab as its own app.
2. Open the link you sent yourself. It lands on "Parent link": type what the app should call you and a PIN, tap **Connect this phone**. Done. (Or open the app, tap **My own phone**, and type the code.)
3. Settings on your phone has the parent door at the top; the parent view shows her week, alerts and settings.

## What a day looks like for her
- Open the app, tap **Check in**: tap Dance class if she had it, say how she feels, Save.
- The app says which day it is and why, and shows one big button. Green: Stretch and reach, Strong and steady or Happy feet, whichever is next. Dance day (Wednesday): the Short gentle workout, about eight minutes. A recital or a very big day: the five-minute stretch. Sick or hurt: two minutes of balloon breathing, and tell you.
- In the session, the picture shows the move and the big button says what to tap: start the timer, or did it. The app says Done and moves on. Skip is small and quiet.
- The Five-minute mini workout is five easy minutes she can add any day on top (butterfly, stork, cat and cow, ankles, breathing).

## How the sync works
- Each device sends what changed and fetches what the other sent whenever the app is opened with a signal, two seconds after any change, when it comes back online, and every two minutes while open. iPad and iPhone web apps cannot run in the background, so her evening session reaches your phone the next time you open the app (it syncs on open).
- Merging is per record and never overwrites a newer copy.
- Never synced: journal notes marked private, PINs, settings. The server holds only the hash of the family code and only answers requests that carry the code.
- The parent view, Settings tab, "Linked devices" shows the status, a Sync now button, the link and code to connect another phone, and Disconnect.
- The cloud side is the same free Supabase project the other two apps use (organization "Flesher Family", project "athletic-lab"); each app has its own family code so the rows never meet. Athletic Lab's repo pings the project every three days so it never pauses. If it ever does, the Supabase dashboard restores it with one click and the devices catch up.

## Clips of Vivi
- Every move has a moving drawing. There are no outside videos in this app.
- The best demo is Vivi herself. In the parent view, open any exercise (Exercises tab, tap its name; or Workouts) and tap **+ Add a clip of her**: shoot ten seconds or pick a clip from your library. It uploads to the family's private cloud space and shows on her device under Watch it. Keep clips short (under 60 MB). Remove one from the same place.

## The parent view on Vivi's device
Settings (gear on Today) → **Open the parent view** → PIN. It locks again after ten minutes in the background. Tabs: This week (alerts, last seven days, totals), Exercises (every move; mark it watched, turn it off; a pill shows which have a clip), Settings (linked devices, strength days per week, growth-spurt mode, reminders, PIN and name, backup, sample data, erase).

## Backups (every few weeks)
Sync is not a backup. Vivi's Settings has **Back up everything** (share the file to Files or iCloud Drive); the parent view has the same plus restore and parent packs. Restoring on a new device: install, parent setup (new PIN), parent view → Restore → **Replace everything**, then reconnect with the family code from the other phone.

## Notifications
In-app messages always work (one a day on Today, not in quiet hours). Device notifications are optional, need iOS permission, and only fire while the app is open.

## If something goes wrong
- "Last try failed" under Linked devices: usually no signal; it retries on its own. If it says the project is paused, open the Supabase dashboard and restore it.
- A screen shows "Something went wrong": tap Go to Today; data is untouched.
- Forgot the PIN: there is no reset without erasing the app (the parent view's Erase, or delete and reinstall). Reconnect with the family code from the other phone and everything comes back from the cloud copy.
- The app says "Running in a browser tab": it is not on the home screen; do step 2 so the browser cannot clear its storage.
