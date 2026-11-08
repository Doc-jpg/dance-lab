/* Vivi's Dance Lab acceptance walkthrough on an iPhone-sized browser, from an empty device.
   LIVE=1 adds a second device (the parent copy) through the real sync server.
   Run: node server.cjs  (in another terminal)  then  URL=http://localhost:4177/ node scripts/acceptance.cjs
   DEVICE="Pixel 5" runs the same walk as an Android phone. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const URL = process.env.URL || 'http://localhost:4177/';
const fails = [];
function expect(label, got, want) { if (JSON.stringify(got) !== JSON.stringify(want)) { fails.push(`${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); console.log('  !! MISMATCH', label, JSON.stringify(got), 'want', JSON.stringify(want)); } else console.log('  ok', label); }
const shotsDir = path.join(__dirname, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: false });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'], acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGEERROR', e.message); fails.push('pageerror ' + e.message); });
  const settle = (ms = 350) => page.waitForTimeout(ms);
  const body = () => page.locator('body').innerText();

  // --- Setup (three steps) ---
  console.log('Setup');
  await page.goto(URL);
  await page.waitForSelector('text=whose device is this?');
  expect('setup speaks to the parent first', /for the parent/i.test(await body()), true);
  await page.click('text=My dancer\'s device');
  await page.waitForSelector('text=the dancer and you');
  await page.fill('input[placeholder="First name"]', 'Vivi');
  await page.fill('input[placeholder="2017"]', '2017');
  await page.fill('input[placeholder="Dad"]', 'Dad');
  await page.fill('input[aria-label="Parent PIN"]', '7101');
  await page.fill('input[aria-label="Parent PIN again"]', '7101');
  await page.click('role=button[name="Done. Hand it over"]');
  await page.waitForSelector('text=your own phone');
  const codeText = await page.locator('strong.mono').innerText();
  expect('family code shown to the parent', /^[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(codeText), true);
  const FAMILY_CODE = codeText;
  await page.click('role=button[name="Done. Hand it over"]');
  await page.waitForSelector('text=Hey Vivi, this is yours');
  expect('PIN is never shown on screen', /7101/.test(await body()), false);
  await page.click('text=Dark with gold');
  await page.click('role=button[name="Skip the tour"]');
  await page.waitForSelector('text=Hey Vivi');
  await page.waitForSelector('text=Take the tour');
  expect('tour offered once', /Take the tour/.test(await body()), true);
  await page.click('role=button[name="Not now"]');
  await shot(page, '01_today_fresh');
  expect('theme applied', await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'pro');
  expect('start needs the questions first', /Answer the questions, then start/.test(await body()), true);

  // --- A dance-class day check-in ---
  console.log('Check-in with dance class');
  await page.click('role=button[name="Answer the questions"]');
  await page.waitForSelector('text=How are you today, Vivi?');
  await page.click('text=+ Dance class');
  await page.click('role=button[name="Save my answers"]');
  await page.waitForSelector('text=You answered today');
  await settle();
  let t = await body();
  expect('yellow day after dance class', /Easy workout today/.test(t), true);
  expect('the reason names the class', /You had dance today/.test(t), true);
  expect('daily message shown', /Recovery|Hydration|Food|Sleep|Consistency|Confidence|Mobility|Challenge/.test(t), true);
  await shot(page, '02_today_checked_in');

  // --- Acceptance 1: complete a full workout ---
  console.log('Workout player');
  await page.click('role=button[name="Start"]');
  await page.waitForURL(/\/workout\//);
  await settle();
  t = await body();
  expect('light day session opened', /Easy workout · 1 of/.test(t), true);
  await shot(page, '03_player');
  const total = await page.locator('.progress-dots i').count();
  for (let i = 0; i < total; i++) {
    const sets = page.locator('.set-btn');
    const n = await sets.count();
    for (let k = 0; k < n; k++) {
      const label = await sets.nth(k).innerText();
      await sets.nth(k).click();
      if (/s$/.test(label.split('\n')[1] || '')) await page.click('role=button[name="Done early"]');
      await settle(120);
      const restSkip = page.locator('role=button[name="I am ready"]');
      if (await restSkip.count()) await restSkip.click();
    }
    if (i < total - 1) {
      // After the last set the player flashes Done and moves on by itself; wait for that, else skip.
      const moved = await page.waitForFunction((n) => /·\s*(\d+) of /.test(document.body.innerText) && Number(document.body.innerText.match(/·\s*(\d+) of /)[1]) === n, i + 2, { timeout: 3000 }).then(() => true).catch(() => false);
      if (!moved) await page.click('text=/Next ›|Skip this one ›/');
      await settle(150);
    }
    await settle(150);
  }
  expect('all exercises visited', await page.locator('.progress-dots i.on').count(), total);
  await page.click('role=button[name="Finish workout"]');
  await page.waitForSelector('text=How was it?');
  await page.click('role=button[name="Easy"]');
  await page.click('role=button[name="Yes"]');
  await page.fill('input[placeholder="Pike stretch reached further today."]', 'Felt good, easy day.');
  await page.click('role=button[name="Save my workout"]');
  await page.waitForURL(/\/sessions\//);
  await settle();
  t = await body();
  expect('session finished', /Finished/.test(t), true);
  expect('badges earned on the first workout', /Badge.*earned/.test(t), true);
  expect('note saved on the session', /Felt good, easy day/.test(t), true);
  await shot(page, '04_session_summary');

  // --- Acceptance 1 (offline) and 2 (reopen, see yesterday / today) ---
  console.log('Offline');
  await page.goto(URL + '#/today');
  await page.waitForSelector('text=Hey Vivi');
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== null, null, { timeout: 15000 }).catch(() => fails.push('service worker never took control'));
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('text=Hey Vivi', { timeout: 15000 });
  t = await body();
  expect('offline: app opens and shows the finished session', /Easy workout done/.test(t), true);
  await page.click('a[href="#/journal"]');
  await page.waitForSelector('text=Journal');
  await page.fill('textarea', 'My legs were really tired after dance.');
  await page.click('role=button[name="Save"]');
  await settle();
  expect('offline: journal note saved', /legs were really tired/.test(await body()), true);
  await page.click('a[href="#/workouts"]');
  await page.waitForSelector('text=Every exercise');
  await page.click('text=Squats (sit and stand)');
  await page.waitForSelector('text=How to do it');
  expect('offline: exercise page with illustration', await page.locator('.figure svg').count(), 1);
  await shot(page, '05_exercise_offline');
  await ctx.setOffline(false);

  // --- Happy feet on a yellow day: offered the gate, one set each, no soft landings ---
  console.log('Happy feet');
  await page.goto(URL + '#/workouts');
  await page.waitForSelector('text=Every exercise');
  t = await body();
  expect('the seven days are listed', /Stretch and reach/.test(t) && /Strong and steady/.test(t) && /Happy feet/.test(t) && /Daily 5/.test(t) && /Five-minute stretch/.test(t) && /Easy day/.test(t), true);
  await page.click('text=Happy feet');
  await page.waitForSelector('text=The app picked something else today');
  await page.click('role=button[name="Do it anyway"]');
  await page.waitForURL(/\/workout\//);
  await settle();
  t = await body();
  expect('feet session opened on a yellow day', /Happy feet · 1 of/.test(t), true);
  expect('yellow day drops the soft landings (11 items become 10)', await page.locator('.progress-dots i').count(), 10);
  expect('one set each on a yellow day', /Gentle today: each move just once/.test(t), true);
  expect('no Watch it button without a family clip', await page.locator('role=button[name="▶ Watch it"]').count(), 0);
  expect('player has the big button that says what to tap', /Start the .* second timer|Did it/.test(t), true);
  await shot(page, '05a_feet_player');
  await page.click('role=button[name="Stop"]');
  await page.click('role=button[name="Out of time"]');
  await page.waitForURL(/\/sessions\//);
  await page.goto(URL + '#/exercises/bl-arabesque');
  await page.waitForSelector('text=How to do it');
  expect('arabesque page says why, for a dancer', /from dance class/.test(await body()), true);
  expect('arabesque page has its drawing', await page.locator('.figure svg').count(), 1);
  expect('no outside videos anywhere', await page.locator('iframe').count(), 0);
  expect('dancer view has no clip upload button', await page.locator('text=Add a clip of her').count(), 0);
  await shot(page, '05b_arabesque');
  await page.goto(URL + '#/progress');
  await page.waitForSelector('text=Progress');
  t = await body();
  expect('progress counts the workout', /workouts each week/i.test(t) && /\b1\s+WORKOUTS/i.test(t.replace(/\s+/g, ' ')), true);
  await shot(page, '06_progress');

  // --- Acceptance 6: pain stops recommendations ---
  console.log('Pain');
  await page.goto(URL + '#/today');
  await page.waitForSelector('text=You answered today');
  await page.click('role=button[name="Change my answers"]');
  await page.click('role=button[name="Something hurts"]');
  await page.fill('input[placeholder="for example left knee"]', 'left knee');
  await page.click('role=button[name="Save my answers"]');
  await settle();
  t = await body();
  expect('red day: the headline is the easy day, not nothing', /Easy day: breathe, and tell a grown-up/.test(t), true);
  expect('red day: tell a grown-up', /grown-up/.test(t), true);
  await shot(page, '07_red_day');
  await page.click('a[href="#/workouts"]');
  await page.waitForSelector('text=Every exercise');
  await page.click('text=Easy day');
  await page.waitForURL(/\/workout\//);
  await settle();
  t = await body();
  expect('easy day is breathing plus an optional walk', /Easy day · 1 of 2/.test(t) && /Balloon breathing/.test(t), true);
  await page.click('role=button[name="Stop"]');
  await page.click('role=button[name="Out of time"]');
  await page.waitForURL(/\/sessions\//);
  await page.goto(URL + '#/today');
  await page.waitForSelector('text=You answered today');
  await page.click('a[href="#/workouts"]');
  await page.waitForSelector('text=Every exercise');
  await page.click('text=Strong and steady');
  await page.waitForSelector('text=Not today');
  expect('workouts list refuses a workout on a red day', /So no workout today/.test(await body()), true);
  await page.keyboard.press('Escape');

  // --- Acceptance 9: parent access, disclosed and authenticated ---
  console.log('Parent mode');
  await page.goto(URL + '#/settings');
  await page.waitForSelector('text=What Dad can see');
  t = await body();
  expect('visibility card lists what is shown and what is not', /Not shown:.*private/.test(t), true);
  await page.click('role=button[name="Open Dad\'s page"]');
  await page.fill('input[aria-label="PIN"]', '0000');
  await page.click('role=button[name="Unlock"]');
  await settle();
  expect('wrong PIN refused', /That is not it/.test(await body()), true);
  await page.fill('input[aria-label="PIN"]', '7101');
  await page.click('role=button[name="Unlock"]');
  await page.waitForURL(/\/parent/);
  await settle();
  t = await body();
  expect('parent sees the pain alert', /Reported pain/.test(t), true);
  expect('parent sees the week', /last 7 days/i.test(t), true);
  await shot(page, '08_parent');
  await page.click('role=button[name="Exercises"]');
  await page.waitForSelector('text=Push-ups on a bench or couch');
  t = await body();
  expect('no weights to approve anywhere', /\blb\b|dumbbell/i.test(t), false);
  const pushCard = page.locator('.item', { hasText: 'Push-ups on a bench or couch' });
  await pushCard.getByRole('button', { name: 'Mark watched' }).click();
  await settle();
  expect('parent can note she watched a move', /Watched it/.test(await pushCard.innerText()), true);
  await pushCard.getByRole('button', { name: 'Turn off' }).click();
  await settle();
  expect('parent can turn a move off', /Turned off/.test(await pushCard.innerText()), true);
  await page.click('role=button[name="Settings"]');
  await page.waitForSelector('text=Strong and steady days per week');
  expect('no supplements, no doctor records anywhere', /supplement|From a doctor/i.test(await body()), false);

  // --- Acceptance 14: backup and restore ---
  console.log('Backup');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => { await page.click('role=button[name="Back up everything"]'); await page.waitForSelector('text=Backup ready'); await page.click('role=button[name="Share or save"]'); })()
  ]);
  const file = path.join(os.tmpdir(), `dance-lab-acceptance-${Date.now()}.zip`);
  await download.saveAs(file);
  expect('backup file written', fs.statSync(file).size > 500, true);
  await page.locator('input[type="file"]').last().setInputFiles(file);
  await page.waitForSelector('text=Restore a backup');
  expect('restore preview reads the manifest', /Full backup for Vivi/.test(await body()), true);
  await page.click('role=button[name="Merge (safe)"]');
  await page.waitForSelector('text=Merged.');
  t = await body();
  expect('merging the same file changes nothing', /Added 0, updated 0/.test(t), true);
  await page.keyboard.press('Escape');
  await page.click('role=button[name="Back to Vivi mode"]');
  await settle();
  expect('left parent mode', await page.locator('role=button[name="Back to Vivi mode"]').count(), 0);

  // --- Acceptance 12: its own app ---
  console.log('Identity');
  const manifest = await page.evaluate(async () => { const r = await fetch('manifest.webmanifest'); return r.json(); });
  expect('manifest name', manifest.name, 'Dance Lab');
  expect('manifest id is its own scope', typeof manifest.id === 'string' && manifest.id === manifest.scope, true);
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect('own IndexedDB database', dbs.includes('dance-lab'), true);
  expect('no sibling app databases touched', dbs.some((n) => /dugout|athletic|dad-lab/.test(n)), false);

  // --- Skip costs nothing; tour and FAQ ---
  console.log('Skip, tour, FAQ');
  await page.goto(URL + '#/today');
  await page.waitForSelector('text=You answered today');
  await page.click('role=button[name="Change my answers"]');
  await page.click('role=button[name="Something hurts"]'); // toggles it off
  await page.click('role=button[name="Save my answers"]');
  await settle();
  expect('pain cleared: the finished session is back on Today', /Easy workout done/.test(await body()), true);
  await page.goto(URL + '#/help');
  await page.waitForSelector('input[placeholder="Search the questions"]');
  await page.fill('input[placeholder="Search the questions"]', 'backbend');
  expect('FAQ search', /Why are there no bridges, backbends or neck stretches\?/.test(await body()) && (await page.locator('details.faq').count()) === 1, true);
  await page.click('role=button[name="Take the one-minute tour"]');
  await page.waitForSelector('text=Tour · 1 of 9');
  for (let i = 0; i < 8; i++) { await page.click('role=button[name="Next ›"]'); await settle(250); }
  expect('tour reaches the last stop', /Tour · 9 of 9/.test(await body()), true);
  await shot(page, '09_tour_last');
  await page.click("role=button[name=\"Done, let's go\"]");
  await settle();

  // --- Parent copy on the parent's own phone (fresh context = another phone), through the real sync server ---
  if (process.env.LIVE) {
    console.log('Parent copy');
    const ctx2 = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'] });
    const p2 = await ctx2.newPage();
    p2.on('pageerror', (e) => { fails.push('pageerror ' + e.message); });
    await p2.goto(URL);
    await p2.waitForSelector('text=whose device is this?');
    await p2.click('text=My own phone (a parent copy)');
    await p2.waitForSelector('text=Family code');
    await p2.fill('input[placeholder="XXXXX-XXXXX-XXXXX-XXXXX"]', FAMILY_CODE);
    await p2.fill('input[placeholder="Dad"]', 'Dad');
    await p2.fill('input[aria-label="Parent PIN"]', '7101');
    await p2.fill('input[aria-label="Parent PIN again"]', '7101');
    await p2.click('role=button[name="Connect"]');
    await p2.waitForURL(/\/settings/, { timeout: 30000 });
    await p2.waitForSelector('text=For Dad', { timeout: 30000 });
    await p2.waitForTimeout(1500);
    let t2 = await p2.locator('body').innerText();
    expect('parent copy received the dancer through sync', /Set up for Vivi/.test(t2), true);
    await shot(p2, '10_parent_copy_synced');
    await p2.click('role=button[name="Open Dad\'s page"]');
    await p2.fill('input[aria-label="PIN"]', '7101');
    await p2.click('role=button[name="Unlock"]');
    await p2.waitForURL(/\/parent/);
    await p2.waitForTimeout(800);
    t2 = await p2.locator('body').innerText();
    expect('dad sees the light day session synced from vivi', /Easy workout/.test(t2), true);
    // Dad marks a move watched on his phone; Vivi's device picks it up on its next sync.
    await p2.click('role=button[name="Exercises"]');
    const card2 = p2.locator('.item', { hasText: 'Split squat (one foot in front' });
    await card2.getByRole('button', { name: 'Mark watched' }).click();
    await p2.waitForTimeout(3500);
    await page.goto(URL + '#/workouts');
    await page.reload();
    await page.waitForSelector('text=Every exercise');
    await page.waitForTimeout(3500);
    const row = page.locator('a.item', { hasText: 'Split squat (one foot in front' });
    expect('vivi sees the watched mark made on dad\'s phone', /checked/.test(await row.innerText()), true);
    await ctx2.close();
  }

  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILED\n` + fails.join('\n') : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
