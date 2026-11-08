/**
 * The glue between the engines and the database: what Today needs, and the writes that follow a
 * check-in, a session, or a finished session (flags for parents, badges, missions).
 */
import { db, addFlag, saveSession, updateSession, saveCheckIn, getSettings, addJournal } from '../db/db';
import type { Athlete, CheckIn, Day, Exercise, ExerciseStatus, Session, SportsLog, WorkoutTemplate, Who, Achievement, JournalEntry, HabitLog, Mission } from './types';
import { newId, nowIso } from './types';
import { assessReadiness, type Readiness } from './readiness';
import { buildSession, nextInRotation, type BuildContext } from './program';
import { newBadges, missionsForWeek, updateMissionProgress, weekStartOf, type BadgeState } from './achievements';

export interface TodayContext {
  day: Day;
  athlete: Athlete;
  checkIn?: CheckIn;
  logs: SportsLog[];
  sessions: Session[];
  templates: WorkoutTemplate[];
  exercises: Map<string, Exercise>;
  statuses: Map<string, ExerciseStatus>;
  strengthDaysPerWeek: 2 | 3;
}

export function readinessFor(ctx: TodayContext): Readiness {
  const { planned, fallback } = nextInRotation(ctx.sessions, ctx.templates);
  return assessReadiness({
    day: ctx.day,
    checkIn: ctx.checkIn ?? null,
    logs: ctx.logs,
    sessions: ctx.sessions,
    settings: { strengthDaysPerWeek: ctx.strengthDaysPerWeek },
    planned: { kind: planned.kind, templateId: planned.id, name: planned.name },
    fallback: { kind: fallback.kind, templateId: fallback.id, name: fallback.name }
  });
}

/** Record a check-in and the flags a parent should see. */
export async function recordCheckIn(input: Omit<CheckIn, 'id' | 'ts' | 'color'>, ctx: Omit<TodayContext, 'checkIn'>): Promise<{ checkIn: CheckIn; readiness: Readiness }> {
  const readiness = readinessFor({ ...ctx, checkIn: { ...input, id: 'tmp', ts: nowIso(), color: 'green' } });
  const checkIn = await saveCheckIn({ ...input, color: readiness.color });
  for (const a of readiness.alerts) await addFlag({ day: input.day, kind: input.pain ? 'pain' : input.sick ? 'sick' : input.dizzy ? 'dizzy' : a.includes('Performance') ? 'performance' : a.includes('rest day') ? 'no-rest-day' : 'heavy-week', text: a });
  await refreshRewards(ctx.day);
  return { checkIn, readiness };
}

/** Make today's workout from a template and the verdict, save it as planned, return it. */
export async function planSession(templateId: string, readiness: Readiness, ctx: TodayContext, by: Who): Promise<Session> {
  const template = ctx.templates.find((t) => t.id === templateId);
  if (!template) throw new Error('Template not found');
  const bctx: BuildContext = { day: ctx.day, athlete: ctx.athlete, exercises: ctx.exercises, statuses: ctx.statuses, sessions: ctx.sessions, by };
  const { session } = buildSession(template, readiness, bctx);
  await saveSession(session);
  return session;
}

export async function finishSession(id: string, patch: Partial<Session>, day: Day): Promise<Achievement[]> {
  await updateSession(id, { ...patch, status: patch.status ?? 'done', finishedAt: nowIso(), live: undefined });
  const s = await db.sessions.get(id);
  if (s && patch.note?.trim()) await addJournal({ day, text: patch.note.trim(), isPrivate: false, sessionId: id, by: s.by });
  if (s?.status === 'stopped' && (s.stoppedReason === 'pain' || s.stoppedReason === 'dizzy' || s.stoppedReason === 'sick')) {
    await addFlag({ day, kind: 'stopped', text: `Stopped ${s.templateName} because of ${s.stoppedReason === 'pain' ? 'pain' : s.stoppedReason === 'dizzy' ? 'dizziness' : 'feeling sick'}.` });
  }
  return refreshRewards(day, id);
}

/** Badges and missions after anything changes. Returns badges newly earned (and stamps them on the session if given). */
export async function refreshRewards(day: Day, sessionId?: string): Promise<Achievement[]> {
  const [sessions, checkIns, journal, habits, have, missions] = await Promise.all([db.sessions.toArray(), db.checkIns.toArray(), db.journal.toArray(), db.habits.toArray(), db.achievements.toArray(), db.missions.toArray()]);
  const state: BadgeState = { sessions, checkIns, journal: journal as JournalEntry[], habits: habits as HabitLog[], day };
  const earned = newBadges(state, have);
  if (earned.length) await db.achievements.bulkPut(earned);
  if (earned.length && sessionId) {
    const s = await db.sessions.get(sessionId);
    if (s) await db.sessions.update(sessionId, { achievements: [...(s.achievements ?? []), ...earned.map((e) => e.key)] });
  }
  const ws = weekStartOf(day);
  const current: Mission[] = missionsForWeek(ws, missions);
  const updated = updateMissionProgress(current, state);
  const changed = updated.filter((m, i) => m !== current[i] || !missions.some((x) => x.id === m.id));
  if (changed.length) await db.missions.bulkPut(changed);
  return earned;
}

export async function ensureMessageShown(day: Day, key: string, category: string): Promise<void> {
  const existing = await db.messages.where('day').equals(day).first();
  if (existing) return;
  await db.messages.put({ id: newId(), day, key, category, ts: nowIso() });
}

export async function defaultStrengthDays(): Promise<2 | 3> {
  return (await getSettings()).strengthDaysPerWeek;
}
