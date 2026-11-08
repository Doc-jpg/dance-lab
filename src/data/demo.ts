/**
 * Sample data ("practice mode"): three weeks of made-up sessions, sports, check-ins and notes so the
 * app can be explored before Vivi has any history. Every record id starts with "demo-" so it can be
 * removed in one tap. Nothing here is a real person's data.
 */
import type { DanceLabDB } from '../db/db';
import { seedLibrary } from '../db/db';
import type { CheckIn, Session, SessionItem, SportsLog, JournalEntry, HabitLog } from '../engine/types';
import { addDays, todayDay } from '../engine/types';
import { EXERCISE_BY_ID } from './exercises';
import { TEMPLATE_BY_ID } from './templates';

export const DEMO_PREFIX = 'demo-';

function itemsFor(templateId: string, difficulty: 1 | 2 | 3 | 4 | 5, ts: string): SessionItem[] {
  const t = TEMPLATE_BY_ID[templateId];
  return t.items.filter((i) => !i.requiresFormCheck).map((i) => {
    const e = EXERCISE_BY_ID[i.exerciseId];
    const sets = Array.from({ length: i.dose.sets }, () => ({ reps: i.dose.reps, seconds: i.dose.seconds, load: 'body' as const, done: true, ts }));
    return { exerciseId: e.id, exerciseName: e.name, catalogVersion: e.version, planned: i.dose, sets, difficulty, feltGood: difficulty <= 3 };
  });
}

export async function loadDemo(database: DanceLabDB): Promise<void> {
  await seedLibrary(database);
  const today = todayDay();
  const sessions: Session[] = [];
  const logs: SportsLog[] = [];
  const checkIns: CheckIn[] = [];
  const journal: JournalEntry[] = [];
  const habits: HabitLog[] = [];
  // 21 days back to yesterday. Pattern: Mon stretch, Tue sewing (no log) + strength, Wed dance class (short gentle workout),
  // Thu feet, Fri stretch, Sat playing outside, Sun rest; the Five-minute mini workout most days.
  for (let i = 21; i >= 1; i--) {
    const day = addDays(today, -i);
    const dow = new Date(day + 'T12:00:00').getDay();
    const ts = new Date(day + 'T17:30:00').toISOString();
    const id = (k: string) => `${DEMO_PREFIX}${k}-${day}`;
    const diff: 1 | 2 | 3 | 4 | 5 = i > 14 ? 3 : 2;
    if (dow === 3) logs.push({ id: id('log'), day, ts, sport: 'dance', label: 'Dance class', duration: 'medium', intensity: 'medium', by: 'athlete' });
    if (dow === 6) logs.push({ id: id('log'), day, ts, sport: 'play', label: 'Trampoline at a friend\'s', duration: 'long', intensity: 'medium', heavyJumping: true, by: 'athlete' });
    const energy = (dow === 0 ? 2 : dow === 6 ? 3 : 4) as CheckIn['energy'];
    const color = dow === 6 ? 'orange' : dow === 3 || dow === 0 ? 'yellow' : 'green';
    checkIns.push({ id: id('chk'), day, ts: new Date(day + 'T16:00:00').toISOString(), energy, sleep: dow === 0 ? 2 : 4, soreness: dow === 0 ? 'some' : 'none', pain: false, sick: false, dizzy: false, color, by: 'athlete' });
    if (dow === 1 || dow === 5) sessions.push({ id: id('s'), day, templateId: 'flex', templateName: 'Stretch and reach', kind: 'flex', status: 'done', readiness: 'green', why: ['Sample workout'], items: itemsFor('flex', diff, ts), startedAt: ts, finishedAt: ts, overallDifficulty: diff, feltGood: true, by: 'athlete', createdAt: ts, updatedAt: ts });
    if (dow === 2) sessions.push({ id: id('s'), day, templateId: 'strength', templateName: 'Strong and steady', kind: 'strength', status: 'done', readiness: 'green', why: ['Sample workout'], items: itemsFor('strength', diff, ts), startedAt: ts, finishedAt: ts, overallDifficulty: diff, feltGood: true, by: 'athlete', createdAt: ts, updatedAt: ts });
    if (dow === 3) sessions.push({ id: id('s'), day, templateId: 'light', templateName: 'Short gentle workout', kind: 'light', status: 'done', readiness: 'yellow', why: ['Dance class today, so a gentle workout'], items: itemsFor('light', 1, ts), startedAt: ts, finishedAt: ts, overallDifficulty: 1, feltGood: true, by: 'athlete', createdAt: ts, updatedAt: ts });
    if (dow === 4) sessions.push({ id: id('s'), day, templateId: 'feet', templateName: 'Happy feet', kind: 'feet', status: 'done', readiness: 'green', why: ['Sample workout'], items: itemsFor('feet', 2, ts), startedAt: ts, finishedAt: ts, overallDifficulty: 2, feltGood: true, by: 'athlete', createdAt: ts, updatedAt: ts });
    if (dow === 6) sessions.push({ id: id('s'), day, templateId: 'recovery', templateName: 'Five-minute stretch', kind: 'recovery', status: 'done', readiness: 'orange', why: ['Lots of jumping today'], items: itemsFor('recovery', 1, ts), startedAt: ts, finishedAt: ts, overallDifficulty: 1, feltGood: true, by: 'athlete', createdAt: ts, updatedAt: ts });
    if (dow !== 6 && dow !== 0 && i % 3 !== 0) sessions.push({ id: id('f'), day, templateId: 'foundations', templateName: 'Five-minute mini workout', kind: 'foundations', status: 'done', readiness: color as any, why: [], items: itemsFor('foundations', 1, ts), startedAt: ts, finishedAt: ts, by: 'athlete', createdAt: ts, updatedAt: ts });
    if (dow === 1 || dow === 6) journal.push({ id: id('j'), day, ts, updatedAt: ts, text: dow === 6 ? 'Legs were really tired after the trampoline.' : 'Pike stretch reached further today.', isPrivate: false, by: 'athlete' });
    if (dow === 3) journal.push({ id: id('jp'), day, ts, updatedAt: ts, text: 'Private note: felt nervous before class but it went fine.', isPrivate: true, by: 'athlete' });
    for (const h of ['water', 'meal', 'sleep'] as const) if ((i + h.length) % 4 !== 0) habits.push({ id: id('h-' + h), day, habit: h, done: true, ts });
  }
  // Stork seconds grow over the three weeks so the progress chart has a line to show.
  for (const s of sessions) for (const it of s.items) if (it.exerciseId === 'bl-stork') { const i = 21 - Math.round((new Date(today + 'T12:00:00').getTime() - new Date(s.day + 'T12:00:00').getTime()) / 86400000); it.sets = it.sets.map((x) => ({ ...x, seconds: 10 + Math.min(20, i) })); it.planned = { ...it.planned, seconds: 10 + Math.min(20, i) }; }
  await database.transaction('rw', [database.sessions, database.sportsLogs, database.checkIns, database.journal, database.habits, database.meta], async () => {
    await database.sessions.bulkPut(sessions);
    await database.sportsLogs.bulkPut(logs);
    await database.checkIns.bulkPut(checkIns);
    await database.journal.bulkPut(journal);
    await database.habits.bulkPut(habits);
    await database.meta.put({ key: 'demoLoaded', value: true });
  });
}

export async function removeDemo(database: DanceLabDB): Promise<number> {
  let n = 0;
  await database.transaction('rw', [database.sessions, database.sportsLogs, database.checkIns, database.journal, database.habits, database.achievements, database.missions, database.meta], async () => {
    for (const t of [database.sessions, database.sportsLogs, database.checkIns, database.journal, database.habits]) n += await (t as any).where('id').startsWith(DEMO_PREFIX).delete();
    await database.meta.put({ key: 'demoLoaded', value: false });
  });
  return n;
}
