/**
 * Badges and weekly missions. Earned things are never taken away. Missing a day costs nothing.
 * Safe choices (resting when wiped out, stopping on pain, swapping to easier) earn badges too.
 */
import type { Achievement, CheckIn, Day, JournalEntry, Mission, Session, HabitLog } from './types';
import { addDays, newId, nowIso } from './types';

export interface BadgeDef {
  key: string;
  title: string;
  text: string;
  test: (s: BadgeState) => boolean;
}

export interface BadgeState {
  sessions: Session[];
  checkIns: CheckIn[];
  journal: JournalEntry[];
  habits: HabitLog[];
  day: Day;
}

const done = (s: BadgeState, kind?: Session['kind']) => s.sessions.filter((x) => x.status === 'done' && (!kind || x.kind === kind));
const workouts = (s: BadgeState) => done(s).filter((x) => x.kind === 'strength' || x.kind === 'flex' || x.kind === 'feet' || x.kind === 'light');
const anyDay = (s: BadgeState) => done(s);
const bestHold = (s: BadgeState, id: string) => Math.max(0, ...done(s).flatMap((x) => x.items.filter((i) => i.exerciseId === id).flatMap((i) => i.sets.filter((st) => st.done).map((st) => st.seconds ?? 0))));

export const BADGES: BadgeDef[] = [
  { key: 'first-checkin', title: 'Checked in', text: 'First check-in. Knowing how you feel is step one.', test: (s) => s.checkIns.length >= 1 },
  { key: 'first-workout', title: 'First session', text: 'One session in the book.', test: (s) => workouts(s).length >= 1 },
  { key: 'five-sessions', title: 'Five sessions', text: 'Five sessions done. The habit is forming.', test: (s) => workouts(s).length >= 5 },
  { key: 'ten-sessions', title: 'Ten sessions', text: 'Ten sessions. This is a routine now.', test: (s) => workouts(s).length >= 10 },
  { key: 'twentyfive-sessions', title: 'Twenty-five sessions', text: 'Twenty-five. Serious consistency.', test: (s) => workouts(s).length >= 25 },
  { key: 'fifty-sessions', title: 'Fifty sessions', text: 'Fifty sessions. That is a dancer who takes care of her body.', test: (s) => workouts(s).length >= 50 },
  { key: 'good-call', title: 'Good call', text: 'Took an easy day when your body asked for it. That is what smart dancers do.', test: (s) => s.checkIns.some((c) => c.color === 'orange' || c.color === 'red') },
  { key: 'stopped-smart', title: 'Stopped smart', text: 'Stopped a session because something did not feel right and told someone. Exactly right.', test: (s) => s.sessions.some((x) => x.status === 'stopped' && (x.stoppedReason === 'pain' || x.stoppedReason === 'dizzy' || x.stoppedReason === 'sick')) },
  { key: 'foundations-7', title: 'Daily 5 x7', text: 'Seven Daily 5s done. A few easy minutes, a lot of days.', test: (s) => done(s, 'foundations').length >= 7 },
  { key: 'foundations-30', title: 'Daily 5 x30', text: 'Thirty Daily 5s. Your hips and ankles thank you.', test: (s) => done(s, 'foundations').length >= 30 },
  { key: 'chain-7', title: 'Seven days running', text: 'Something every day for a week. That is the whole idea.', test: (s) => { const days = new Set(anyDay(s).map((x) => x.day)); for (let i = 0; i < 7; i++) if (!days.has(addDays(s.day, -i))) return false; return true; } },
  { key: 'stork-30', title: 'Steady as a stork', text: 'Held the stork balance for 30 seconds a side.', test: (s) => bestHold(s, 'bl-stork') >= 30 },
  { key: 'plank-30', title: 'Strong middle', text: 'Held a plank for 30 seconds.', test: (s) => bestHold(s, 'st-plank') >= 30 },
  { key: 'pushup-level', title: 'Push-up level up', text: 'Moved from the wall to the couch push-up.', test: (s) => done(s).some((x) => x.items.some((i) => i.exerciseId === 'st-inclinepush' && i.sets.some((st) => st.done))) },
  { key: 'flex-first', title: 'Stretch and reach', text: 'First full stretching session.', test: (s) => done(s, 'flex').length >= 1 },
  { key: 'flex-10', title: 'Bendy', text: 'Ten stretching sessions. Flexibility is made of days like these.', test: (s) => done(s, 'flex').length >= 10 },
  { key: 'feet-first', title: 'Happy feet', text: 'First feet and balance session.', test: (s) => done(s, 'feet').length >= 1 },
  { key: 'feet-10', title: 'Strong ankles', text: 'Ten feet and balance sessions. Relevés are getting easy.', test: (s) => done(s, 'feet').length >= 10 },
  { key: 'journal-5', title: 'Thinker', text: 'Five journal notes. Noticing how things feel is how you get better at them.', test: (s) => s.journal.length >= 5 },
  { key: 'three-week', title: 'Three in a week', text: 'Three sessions in one week.', test: (s) => { for (let i = 0; i < 28; i++) { const end = addDays(s.day, -i); const start = addDays(end, -6); if (workouts(s).filter((x) => x.day >= start && x.day <= end).length >= 3) return true; } return false; } },
  { key: 'habits-10', title: 'Habit builder', text: 'Ten healthy habits checked off.', test: (s) => s.habits.filter((h) => h.done).length >= 10 }
];

/** Badges newly earned given current state; the caller saves them. */
export function newBadges(state: BadgeState, have: Achievement[]): Achievement[] {
  const owned = new Set(have.map((a) => a.key));
  const ts = nowIso();
  return BADGES.filter((b) => !owned.has(b.key) && b.test(state)).map((b) => ({ id: newId(), key: b.key, title: b.title, text: b.text, earnedAt: ts }));
}

/** Sunday of the week containing `day` (Sunday is the first day of the week in this house). */
export function weekStartOf(day: Day): Day {
  const d = new Date(day + 'T12:00:00');
  return addDays(day, -d.getDay());
}

interface MissionDef {
  key: string;
  title: string;
  text: string;
  target: number;
  progress: (s: BadgeState, weekStart: Day) => number;
}

const inWeek = (day: Day, ws: Day) => day >= ws && day <= addDays(ws, 6);

export const MISSIONS: MissionDef[] = [
  { key: 'foundations-3', title: 'Daily 5 on 3 days', text: 'Five easy minutes, three different days.', target: 3, progress: (s, ws) => new Set(done(s, 'foundations').filter((x) => inWeek(x.day, ws)).map((x) => x.day)).size },
  { key: 'journal-1', title: 'Write one note', text: 'One line in the journal about how something felt.', target: 1, progress: (s, ws) => s.journal.filter((j) => inWeek(j.day, ws)).length },
  { key: 'checkin-4', title: 'Check in 4 days', text: 'Open the app and say how you feel on four days.', target: 4, progress: (s, ws) => new Set(s.checkIns.filter((c) => inWeek(c.day, ws)).map((c) => c.day)).size },
  { key: 'balance-chal', title: 'Balance challenge', text: 'Do the stork balance in any session this week.', target: 1, progress: (s, ws) => done(s).filter((x) => inWeek(x.day, ws) && x.items.some((i) => i.exerciseId.startsWith('bl-') && i.sets.some((st) => st.done))).length },
  { key: 'water-4', title: 'Water on 4 days', text: 'Check off the water habit four days this week.', target: 4, progress: (s, ws) => s.habits.filter((h) => h.habit === 'water' && h.done && inWeek(h.day, ws)).length },
  { key: 'sessions-2', title: 'Two sessions', text: 'Any two sessions this week, whatever color the days turn out.', target: 2, progress: (s, ws) => workouts(s).filter((x) => inWeek(x.day, ws)).length },
  { key: 'sleep-good-3', title: 'Three good sleeps', text: 'Rate sleep Good or Great on three check-ins.', target: 3, progress: (s, ws) => s.checkIns.filter((c) => inWeek(c.day, ws) && c.sleep >= 4).length },
  { key: 'flex-1', title: 'Stretch and reach', text: 'One full stretching session on a fresh day.', target: 1, progress: (s, ws) => done(s, 'flex').filter((x) => inWeek(x.day, ws)).length },
  { key: 'feet-1', title: 'Happy feet', text: 'One feet and balance session this week.', target: 1, progress: (s, ws) => done(s, 'feet').filter((x) => inWeek(x.day, ws)).length },
  { key: 'every-day-5', title: 'Five days of something', text: 'Anything at all, even the Daily 5, on five days.', target: 5, progress: (s, ws) => new Set(anyDay(s).filter((x) => inWeek(x.day, ws)).map((x) => x.day)).size }
];

/** Three missions for the week, picked by week number so they rotate. */
export function missionsForWeek(weekStart: Day, existing: Mission[]): Mission[] {
  const mine = existing.filter((m) => m.weekStart === weekStart);
  if (mine.length) return mine;
  const n = Math.floor(new Date(weekStart + 'T12:00:00').getTime() / (7 * 86400000));
  const picks = [MISSIONS[n % MISSIONS.length], MISSIONS[(n + 3) % MISSIONS.length], MISSIONS[(n + 5) % MISSIONS.length]];
  const uniq = [...new Map(picks.map((p) => [p.key, p])).values()];
  return uniq.map((p) => ({ id: newId(), weekStart, key: p.key, title: p.title, text: p.text, target: p.target, progress: 0 }));
}

export function updateMissionProgress(missions: Mission[], state: BadgeState): Mission[] {
  return missions.map((m) => {
    const def = MISSIONS.find((d) => d.key === m.key);
    if (!def) return m;
    const progress = Math.min(def.target, def.progress(state, m.weekStart));
    const doneAt = m.doneAt ?? (progress >= def.target ? nowIso() : undefined);
    return progress === m.progress && doneAt === m.doneAt ? m : { ...m, progress, doneAt };
  });
}
