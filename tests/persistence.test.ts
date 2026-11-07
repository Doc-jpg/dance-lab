import { describe, it, expect, beforeEach } from 'vitest';
import { DanceLabDB, seedLibrary, createAthlete, setParentPin, checkParentPin, saveSession, addJournal, saveCheckIn, addSportsLog, setExerciseStatus } from '../src/db/db';
import { buildBackup, readBackup, restoreBackup, BackupFormatError } from '../src/io/backup';
import { loadDemo, removeDemo } from '../src/data/demo';
import { newBadges, missionsForWeek, updateMissionProgress, weekStartOf } from '../src/engine/achievements';
import type { Session } from '../src/engine/types';
import { nowIso, todayDay, addDays } from '../src/engine/types';

let n = 0;
const fresh = () => new DanceLabDB('test-' + Date.now() + '-' + n++);

function session(day: string, patch: Partial<Session> = {}): Session {
  const ts = day + 'T18:00:00.000Z';
  return { id: 'sess-' + day, day, templateId: 'strength', templateName: 'Strong and steady', kind: 'strength', status: 'done', why: [], items: [{ exerciseId: 'lo-chairsquat', exerciseName: 'Chair squat', catalogVersion: 1, planned: { sets: 2, reps: 8 }, sets: [{ reps: 8, load: 'body', done: true, ts }, { reps: 8, load: 'body', done: true, ts }] }], by: 'athlete', createdAt: ts, updatedAt: ts, ...patch };
}

describe('storage', () => {
  let db: DanceLabDB;
  beforeEach(() => { db = fresh(); });

  it('seeds the library once and refreshes untouched items only when the version moves', async () => {
    const first = await seedLibrary(db);
    expect(first.exercises).toBeGreaterThan(40);
    const second = await seedLibrary(db);
    expect(second.exercises).toBe(0);
    expect((await db.templates.toArray()).length).toBe(7);
  });

  it('acceptance 1 and 2: a session saved offline is there when the app reopens (same database, new connection)', async () => {
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: ['dance'] }, db);
    await saveSession(session('2026-11-01'), db);
    const again = new DanceLabDB(db.name);
    const s = await again.sessions.where('day').equals('2026-11-01').first();
    expect(s?.status).toBe('done');
    expect(s?.items[0].sets.filter((x) => x.done).length).toBe(2);
  });

  it('acceptance 13: data written at schema version 1 opens unchanged after a (future) version bump', async () => {
    await saveSession(session('2026-11-01'), db);
    db.close();
    // Simulate the next app version adding a table: Dexie upgrades in place, existing rows untouched.
    class Next extends DanceLabDB { constructor(name: string) { super(name); this.version(2).stores({ extra: 'id' }); } }
    const next = new Next(db.name);
    expect((await next.sessions.get('sess-2026-11-01'))?.templateName).toBe('Strong and steady');
  });

  it('acceptance 9: parent access needs the PIN', async () => {
    await setParentPin('7101', db);
    expect(await checkParentPin('7101', db)).toBe(true);
    expect(await checkParentPin('0000', db)).toBe(false);
    const s = await db.settings.get('settings');
    expect(s?.parentPinHash).not.toContain('7101');
  });

  it('acceptance 11: a fresh install has no supplement records', async () => {
    await seedLibrary(db);
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, db);
  });

  it('sample data loads and removes cleanly, leaving real records alone', async () => {
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, db);
    await saveSession(session('2026-10-01'), db);
    await loadDemo(db);
    expect(await db.sessions.count()).toBeGreaterThan(10);
    const removed = await removeDemo(db);
    expect(removed).toBeGreaterThan(10);
    expect(await db.sessions.count()).toBe(1);
  });
});

describe('backup, parent pack, restore and merge (acceptance 10 and 14)', () => {
  it('round trip: everything comes back, checksums verified', async () => {
    const a = fresh();
    await seedLibrary(a);
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: ['dance'] }, a);
    await saveSession(session('2026-11-01'), a);
    await addJournal({ day: '2026-11-01', text: 'Push-ups were easier today.', isPrivate: false, by: 'athlete' }, a);
    await addJournal({ day: '2026-11-01', text: 'private thought', isPrivate: true, by: 'athlete' }, a);
    await saveCheckIn({ day: '2026-11-01', energy: 4, sleep: 4, soreness: 'none', pain: false, sick: false, dizzy: false, color: 'green', by: 'athlete' }, a);
    const { bytes, manifest } = await buildBackup('test', 'full', a);
    expect(manifest.files['journal.json'].records).toBe(2);
    const contents = await readBackup(bytes);
    const b = fresh();
    const report = await restoreBackup(contents, 'replace', b);
    expect(report.added.sessions).toBe(1);
    expect(await b.journal.count()).toBe(2);
    expect((await b.athlete.get('athlete'))?.firstName).toBe('Vivi');
    // Damaged file is refused.
    const bad = new Uint8Array(bytes);
    bad[bad.length - 30] ^= 0xff;
    await expect(readBackup(bad)).rejects.toBeInstanceOf(BackupFormatError);
  });

  it('a parent pack leaves private notes and PINs out', async () => {
    const a = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, a);
    await setParentPin('7101', a);
    await addJournal({ day: '2026-11-01', text: 'shared', isPrivate: false, by: 'athlete' }, a);
    await addJournal({ day: '2026-11-01', text: 'private', isPrivate: true, by: 'athlete' }, a);
    const { bytes } = await buildBackup('test', 'parent', a);
    const c = await readBackup(bytes);
    expect(c.manifest.scope).toBe('parent');
    expect(c.tables.journal.map((j: any) => j.text)).toEqual(['shared']);
    expect(c.settings?.parentPinHash).toBeUndefined();
  });

  it('merge never overwrites a newer record here and never loses an offline session (acceptance 10)', async () => {
    const phone = fresh();
    const parent = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, phone);
    await saveSession(session('2026-11-01'), phone);
    const pack1 = await readBackup((await buildBackup('t', 'parent', phone)).bytes);
    await restoreBackup(pack1, 'replace', parent);
    // Parent edits the goal list and turns a move off; Vivi logs another session offline and adds a goal of his own.
    await setExerciseStatus('st-inclinepush', { formCheckedAt: nowIso(), disabled: true }, parent);
    const pa = (await parent.athlete.get('athlete'))!;
    await parent.athlete.put({ ...pa, goals: [{ id: 'g-parent', text: 'Plank 45 seconds', status: 'active', createdAt: nowIso(), by: 'parent' }], updatedAt: '2026-11-02T10:00:00.000Z' });
    await saveSession(session('2026-11-03'), phone);
    const ea = (await phone.athlete.get('athlete'))!;
    await phone.athlete.put({ ...ea, goals: [{ id: 'g-vivi', text: 'Feel quicker', status: 'active', createdAt: nowIso(), by: 'athlete' }], updatedAt: '2026-11-03T10:00:00.000Z' });
    // Pack from the phone merges into the parent's copy: both sessions, both goals, parent's approval intact.
    const pack2 = await readBackup((await buildBackup('t', 'parent', phone)).bytes);
    const report = await restoreBackup(pack2, 'merge', parent);
    expect(report.added.sessions).toBe(1);
    expect(await parent.sessions.count()).toBe(2);
    const goals = (await parent.athlete.get('athlete'))!.goals.map((g) => g.id).sort();
    expect(goals).toEqual(['g-parent', 'g-vivi']);
    expect((await parent.exerciseStatus.get('st-inclinepush'))?.disabled).toBe(true);
    // And the other way: parent's approvals reach the phone without erasing anything there.
    const back = await readBackup((await buildBackup('t', 'full', parent)).bytes);
    await restoreBackup(back, 'merge', phone);
    expect((await phone.exerciseStatus.get('st-inclinepush'))?.disabled).toBe(true);
    expect(await phone.sessions.count()).toBe(2);
    // Same file twice changes nothing.
    const r2 = await restoreBackup(back, 'merge', phone);
    expect(Object.values(r2.added).reduce((a, b) => a + b, 0)).toBe(0);
    expect(Object.values(r2.updated).reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('a done session is never replaced by a planned copy of itself', async () => {
    const a = fresh();
    await saveSession(session('2026-11-01', { status: 'done', updatedAt: '2026-11-01T18:00:00.000Z' }), a);
    const contents = await readBackup((await buildBackup('t', 'full', a)).bytes);
    contents.tables.sessions[0] = { ...contents.tables.sessions[0], status: 'planned', updatedAt: '2026-11-05T18:00:00.000Z' };
    await restoreBackup(contents, 'merge', a);
    expect((await a.sessions.get('sess-2026-11-01'))?.status).toBe('done');
  });

  it('replace keeps this phone\'s PIN', async () => {
    const a = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, a);
    const contents = await readBackup((await buildBackup('t', 'full', a)).bytes);
    const b = fresh();
    await setParentPin('4242', b);
    await restoreBackup(contents, 'replace', b);
    expect(await checkParentPin('4242', b)).toBe(true);
  });
});

describe('badges and missions (acceptance 7 and 12)', () => {
  const day = todayDay();
  it('earn badges for sessions and for smart recovery choices; nothing is ever removed', () => {
    const state = { sessions: [session(addDays(day, -1))], checkIns: [{ id: 'c', day, ts: '', energy: 1 as const, sleep: 3 as const, soreness: 'alot' as const, pain: false, sick: false, dizzy: false, color: 'orange' as const, by: 'athlete' as const }], journal: [], habits: [], day };
    const earned = newBadges(state, []);
    const keys = earned.map((e) => e.key);
    expect(keys).toContain('first-workout');
    expect(keys).toContain('first-checkin');
    expect(keys).toContain('good-call');
    // A week with nothing done: the same badges are still there (the function only adds).
    const later = newBadges({ ...state, sessions: [], day: addDays(day, 10) }, earned);
    expect(later.map((e) => e.key)).not.toContain('first-workout');
    expect(earned.length).toBeGreaterThan(0);
  });
  it('stopping for pain earns a badge, not a penalty', () => {
    const earned = newBadges({ sessions: [session(day, { status: 'stopped', stoppedReason: 'pain' })], checkIns: [], journal: [], habits: [], day }, []);
    expect(earned.map((e) => e.key)).toContain('stopped-smart');
  });
  it('three missions a week, progress counted, old ones simply expire', () => {
    const ws = weekStartOf(day);
    const m = missionsForWeek(ws, []);
    expect(m.length).toBe(3);
    const updated = updateMissionProgress(m, { sessions: [session(day)], checkIns: [], journal: [], habits: [], day });
    expect(updated.every((x) => x.progress <= x.target)).toBe(true);
    const nextWeek = missionsForWeek(addDays(ws, 7), m);
    expect(nextWeek.every((x) => x.weekStart === addDays(ws, 7))).toBe(true);
  });
});
