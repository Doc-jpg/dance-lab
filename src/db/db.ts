/**
 * Storage: one IndexedDB database named "dance-lab". Dugout Dad uses "dugout-dad" and Dugout Lab
 * uses "dugout-lab"; the three never touch each other. Schema versions are explicit; data written by
 * version 1 opens in every later version.
 */
import Dexie, { type Table } from 'dexie';
import type { Athlete, Settings, Exercise, ExerciseStatus, WorkoutTemplate, Session, SportsLog, CheckIn, SafetyFlag, JournalEntry, HabitLog, MessageShown, Achievement, Mission, Tombstone, Clip, Day, Who } from '../engine/types';
import { DEFAULT_SETTINGS, newId, nowIso, todayDay } from '../engine/types';
import { LIBRARY_EXERCISES, CATALOG_VERSION } from '../data/exercises';
import { LIBRARY_TEMPLATES, TEMPLATES_VERSION } from '../data/templates';
import { sha256Hex } from '../io/hash';

export interface Meta {
  key: string;
  value: unknown;
}

export class DanceLabDB extends Dexie {
  athlete!: Table<Athlete, string>;
  settings!: Table<Settings, string>;
  exercises!: Table<Exercise, string>;
  exerciseStatus!: Table<ExerciseStatus, string>;
  templates!: Table<WorkoutTemplate, string>;
  sessions!: Table<Session, string>;
  sportsLogs!: Table<SportsLog, string>;
  checkIns!: Table<CheckIn, string>;
  flags!: Table<SafetyFlag, string>;
  journal!: Table<JournalEntry, string>;
  habits!: Table<HabitLog, string>;
  messages!: Table<MessageShown, string>;
  achievements!: Table<Achievement, string>;
  missions!: Table<Mission, string>;
  meta!: Table<Meta, string>;
  tombstones!: Table<Tombstone, string>;
  clips!: Table<Clip, string>;

  constructor(name = 'dance-lab') {
    super(name);
    this.version(1).stores({
      athlete: 'id',
      settings: 'id',
      exercises: 'id, area, source, name',
      exerciseStatus: 'exerciseId',
      templates: 'id, kind, source',
      sessions: 'id, day, status, kind, templateId',
      sportsLogs: 'id, day, sport',
      checkIns: 'id, day',
      flags: 'id, day, kind',
      journal: 'id, day, isPrivate',
      habits: 'id, day, habit',
      messages: 'id, day, key',
      achievements: 'id, key',
      missions: 'id, weekStart, key',
      meta: 'key'
    });
    // v2 (2026-11-02): tombstones so a deletion reaches the other phone through sync. Existing rows untouched.
    this.version(2).stores({
      tombstones: 'key, ts'
    });
    // v3 (2026-11-05): the family's own exercise clips (metadata; the file lives in the cloud bucket).
    this.version(3).stores({
      clips: 'id, exerciseId'
    });
  }
}

export const db = new DanceLabDB();

/** Tell the sync engine something changed (debounced there). Safe to call anywhere; no-op outside a browser. */
export function noteChange(): void {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('dance-lab:changed'));
  } catch {
    /* ignore */
  }
}

/** All data tables, for backup and replace. Settings and meta are handled separately. */
export const DATA_TABLES = ['athlete', 'exercises', 'exerciseStatus', 'templates', 'sessions', 'sportsLogs', 'checkIns', 'flags', 'journal', 'habits', 'messages', 'achievements', 'missions', 'clips'] as const;
export type DataTable = (typeof DATA_TABLES)[number];

/** Seed or refresh the shipped library. Custom items and edited library items are kept. */
export async function seedLibrary(database: DanceLabDB = db): Promise<{ exercises: number; templates: number }> {
  const stampE = (await database.meta.get('catalogVersion'))?.value as number | undefined;
  const stampT = (await database.meta.get('templatesVersion'))?.value as number | undefined;
  let exercises = 0;
  let templates = 0;
  const ts = nowIso();
  await database.transaction('rw', database.exercises, database.templates, database.meta, async () => {
    const existingE = new Map((await database.exercises.where('source').equals('library').toArray()).map((e) => [e.id, e]));
    for (const e of LIBRARY_EXERCISES) {
      const cur = existingE.get(e.id);
      if (!cur) { await database.exercises.put({ ...e, createdAt: ts, updatedAt: ts }); exercises += 1; }
      else if (cur.updatedAt === cur.createdAt && stampE !== CATALOG_VERSION) { await database.exercises.put({ ...e, createdAt: cur.createdAt, updatedAt: cur.createdAt, archived: cur.archived }); exercises += 1; }
    }
    const existingT = new Map((await database.templates.where('source').equals('library').toArray()).map((t) => [t.id, t]));
    for (const t of LIBRARY_TEMPLATES) {
      const cur = existingT.get(t.id);
      if (!cur) { await database.templates.put({ ...t, createdAt: ts, updatedAt: ts }); templates += 1; }
      else if (cur.updatedAt === cur.createdAt && stampT !== TEMPLATES_VERSION) { await database.templates.put({ ...t, createdAt: cur.createdAt, updatedAt: cur.createdAt, archived: cur.archived }); templates += 1; }
    }
    await database.meta.put({ key: 'catalogVersion', value: CATALOG_VERSION });
    await database.meta.put({ key: 'templatesVersion', value: TEMPLATES_VERSION });
  });
  return { exercises, templates };
}

export async function getSettings(database: DanceLabDB = db): Promise<Settings> {
  const s = await database.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), reminders: { ...DEFAULT_SETTINGS.reminders, ...(s?.reminders ?? {}) } };
}

export async function saveSettings(patch: Partial<Settings>, database: DanceLabDB = db): Promise<Settings> {
  const cur = await getSettings(database);
  const next: Settings = { ...cur, ...patch, id: 'settings', updatedAt: nowIso(), createdAt: cur.createdAt ?? nowIso() };
  await database.settings.put(next);
  return next;
}

export async function pinHashFor(pin: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${pin}`);
}

export async function setParentPin(pin: string, database: DanceLabDB = db): Promise<void> {
  const salt = newId();
  await saveSettings({ parentPinSalt: salt, parentPinHash: await pinHashFor(pin, salt) }, database);
}

export async function checkParentPin(pin: string, database: DanceLabDB = db): Promise<boolean> {
  const s = await getSettings(database);
  if (!s.parentPinHash) return false;
  return (await pinHashFor(pin, s.parentPinSalt ?? '')) === s.parentPinHash;
}

export async function getAthlete(database: DanceLabDB = db): Promise<Athlete | undefined> {
  return database.athlete.get('athlete');
}

export async function createAthlete(input: { firstName: string; birthYear: number; sports: string[]; theme?: Athlete['theme'] }, database: DanceLabDB = db): Promise<Athlete> {
  const ts = nowIso();
  const a: Athlete = { id: 'athlete', firstName: input.firstName, birthYear: input.birthYear, sports: input.sports, theme: input.theme ?? 'play', goals: [], programStart: todayDay(), createdAt: ts, updatedAt: ts };
  await database.athlete.put(a);
  return a;
}

export async function updateAthlete(patch: Partial<Athlete>, database: DanceLabDB = db): Promise<void> {
  const cur = await database.athlete.get('athlete');
  if (!cur) return;
  await database.athlete.put({ ...cur, ...patch, id: 'athlete', updatedAt: nowIso() });
  noteChange();
}

export async function addGoal(text: string, by: Who, database: DanceLabDB = db): Promise<void> {
  const cur = await database.athlete.get('athlete');
  if (!cur) return;
  await database.athlete.put({ ...cur, goals: [...cur.goals, { id: newId(), text, status: 'active', createdAt: nowIso(), by }], updatedAt: nowIso() });
  noteChange();
}

export async function setGoalStatus(id: string, status: 'active' | 'done', database: DanceLabDB = db): Promise<void> {
  const cur = await database.athlete.get('athlete');
  if (!cur) return;
  await database.athlete.put({ ...cur, goals: cur.goals.map((g) => (g.id === id ? { ...g, status, doneAt: status === 'done' ? nowIso() : undefined } : g)), updatedAt: nowIso() });
  noteChange();
}

export async function saveSession(s: Session, database: DanceLabDB = db): Promise<void> {
  await database.sessions.put({ ...s, updatedAt: nowIso() });
  noteChange();
}

export async function updateSession(id: string, patch: Partial<Session>, database: DanceLabDB = db): Promise<void> {
  await database.sessions.update(id, { ...patch, updatedAt: nowIso() });
  noteChange();
}

export async function addSportsLog(input: Omit<SportsLog, 'id' | 'ts'>, database: DanceLabDB = db): Promise<SportsLog> {
  const l: SportsLog = { id: newId(), ts: nowIso(), ...input };
  await database.sportsLogs.put(l);
  noteChange();
  return l;
}

export async function saveCheckIn(input: Omit<CheckIn, 'id' | 'ts'>, database: DanceLabDB = db): Promise<CheckIn> {
  // One check-in per day: a second one replaces the first (same id by day).
  const existing = await database.checkIns.where('day').equals(input.day).first();
  const c: CheckIn = { id: existing?.id ?? newId(), ts: nowIso(), ...input };
  await database.checkIns.put(c);
  noteChange();
  return c;
}

export async function addFlag(input: Omit<SafetyFlag, 'id' | 'ts'>, database: DanceLabDB = db): Promise<SafetyFlag> {
  // Do not pile up the same flag twice in a day.
  const dup = await database.flags.where('day').equals(input.day).filter((f) => f.kind === input.kind && f.text === input.text).first();
  if (dup) return dup;
  const f: SafetyFlag = { id: newId(), ts: nowIso(), ...input };
  await database.flags.put(f);
  noteChange();
  return f;
}

export async function addJournal(input: { day: Day; text: string; isPrivate: boolean; sessionId?: string; by: Who }, database: DanceLabDB = db): Promise<JournalEntry> {
  const ts = nowIso();
  const j: JournalEntry = { id: newId(), ts, updatedAt: ts, ...input };
  await database.journal.put(j);
  noteChange();
  return j;
}

export async function setHabit(day: Day, habit: HabitLog['habit'], done: boolean, database: DanceLabDB = db): Promise<void> {
  const cur = await database.habits.where('day').equals(day).filter((h) => h.habit === habit).first();
  await database.habits.put({ id: cur?.id ?? newId(), day, habit, done, ts: nowIso() });
  noteChange();
}

export async function setExerciseStatus(exerciseId: string, patch: Partial<ExerciseStatus>, database: DanceLabDB = db): Promise<ExerciseStatus> {
  const cur = (await database.exerciseStatus.get(exerciseId)) ?? { exerciseId, approvedLoads: [], updatedAt: nowIso() };
  const next: ExerciseStatus = { ...cur, ...patch, exerciseId, updatedAt: nowIso() };
  await database.exerciseStatus.put(next);
  noteChange();
  return next;
}

export async function saveExercise(e: Exercise, database: DanceLabDB = db): Promise<void> {
  await database.exercises.put({ ...e, updatedAt: nowIso() });
}

export async function saveTemplate(t: WorkoutTemplate, database: DanceLabDB = db): Promise<void> {
  await database.templates.put({ ...t, updatedAt: nowIso() });
}

/** Delete a journal entry and leave a tombstone so the deletion reaches the other phone. */
export async function deleteJournal(id: string, database: DanceLabDB = db): Promise<void> {
  await database.transaction('rw', database.journal, database.tombstones, async () => {
    const j = await database.journal.get(id);
    await database.journal.delete(id);
    if (j && !j.isPrivate) await database.tombstones.put({ key: `journal:${id}`, tbl: 'journal', id, ts: nowIso() });
  });
  noteChange();
}

/** Wipe everything on this phone. Used by Replace restore and "start over". */
export async function clearAll(database: DanceLabDB = db): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    for (const t of database.tables) await t.clear();
  });
}

// ---------------------------------------------------------------------------
// Storage health (installed on the home screen counts as safe, same as the other two apps)
// ---------------------------------------------------------------------------

export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean((window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export interface StorageHealth {
  persisted: boolean | null;
  usageBytes: number | null;
  installed: boolean;
  verdict: 'safe' | 'install' | 'unknown';
  message: string;
}

export async function storageHealth(): Promise<StorageHealth> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  let persisted: boolean | null = null;
  let usageBytes: number | null = null;
  try {
    if (nav?.storage?.persisted) persisted = await nav.storage.persisted();
    if (nav?.storage?.estimate) usageBytes = (await nav.storage.estimate()).usage ?? null;
  } catch {
    /* ignore */
  }
  const installed = isInstalled();
  if (installed || persisted === true) {
    return { persisted, usageBytes, installed, verdict: 'safe', message: installed ? 'Installed on the home screen: your workouts stay on this phone. A home-screen icon alone is not a backup, so back up every few weeks.' : 'Storage is persistent on this device. Back up every few weeks.' };
  }
  return { persisted, usageBytes, installed, verdict: 'install', message: 'Running in a browser tab. Add the app to your home screen (Share, Add to Home Screen) so the browser cannot clear your workouts, and back up every few weeks.' };
}

export async function requestPersistence(): Promise<boolean | null> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
  try {
    if (nav?.storage?.persist) return await nav.storage.persist();
  } catch {
    /* ignore */
  }
  return null;
}
