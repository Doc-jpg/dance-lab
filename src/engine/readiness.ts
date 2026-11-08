/**
 * The Daily Readiness Engine, dance edition.
 *
 * Pure function: today's activity logs and check-in, plus the last several days of logs and
 * sessions, in; a color, the reasons, the body parts to leave alone, and a recommendation out.
 * The colors are guidance for a healthy kid, never medical clearance.
 *
 * Hard rules never relax:
 *   RED    pain, illness, dizziness: no training, tell a grown-up. The Easy day (two minutes of
 *          breathing) is still offered, because there is always something and it keeps the habit.
 *   ORANGE a recital, competition or performance day, or a lot of activity already: the five-minute
 *          stretch is the whole session.
 *   YELLOW a dance class today, or poor sleep/energy, or sore: the Easy session (gentle stretches,
 *          a little balance, breathing).
 *   GREEN  fresh and recovered: the planned session (Stretch and reach, Strong and steady or Happy
 *          feet, in turn).
 * Body-part blocks: a lot of jumping blocks extra jumping and hard leg work today and tomorrow; a
 * performance day blocks hard leg work the next day too. Strength days keep 48 hours between them.
 */
import type { CheckIn, SportsLog, Session, LoadTag, ReadinessColor, Day, SessionKind, Settings } from './types';
import { addDays, daysBetween, DEMANDING_KINDS } from './types';

export interface ReadinessInput {
  day: Day;
  checkIn?: Pick<CheckIn, 'energy' | 'sleep' | 'soreness' | 'pain' | 'sick' | 'dizzy'> | null;
  /** Logs for today and the previous days (any range; the engine filters by day). */
  logs: SportsLog[];
  /** Sessions in any state; the engine looks at done ones. */
  sessions: Session[];
  settings: Pick<Settings, 'strengthDaysPerWeek'>;
  /** What the program would offer on a green day (the stretch / strength / feet rotation). */
  planned?: { kind: SessionKind; templateId: string; name: string };
  /** The non-strength session to fall back on when strength is not allowed today. */
  fallback?: { kind: SessionKind; templateId: string; name: string };
}

export interface Readiness {
  color: ReadinessColor;
  headline: string;
  reasons: string[];
  /** Load tags to avoid in any session offered today. */
  blocked: LoadTag[];
  blockedWhy: string[];
  /** The session the app offers (templateId). Never none: a red day still gets the Easy day. Reduced means one set per exercise. */
  offer: { templateId: string; name: string; kind: SessionKind; reduced: boolean };
  /** The Daily 5: fine today, fine but optional, or not today. */
  foundations: 'yes' | 'optional' | 'no';
  loadToday: number;
  loadYesterday: number;
  /** Things the parent should see (a flag is created for these). */
  alerts: string[];
}

const DUR = { short: 1, medium: 2, long: 3 } as const;
const INT = { easy: 1, medium: 2, hard: 3 } as const;

/** One log's load score, 1 to 9. Performance days count as the top of the range. */
export function logLoad(l: SportsLog): number {
  if (l.performance) return 9;
  return DUR[l.duration] * INT[l.intensity];
}

export function dayLoad(logs: SportsLog[], day: Day): number {
  return logs.filter((l) => l.day === day).reduce((s, l) => s + logLoad(l), 0);
}

function isHeavyLegs(l: SportsLog): boolean {
  return !!l.heavyJumping || !!l.performance || ((l.sport === 'gymnastics' || l.sport === 'dance') && logLoad(l) >= 6);
}

export function assessReadiness(input: ReadinessInput): Readiness {
  const { day, checkIn, logs, sessions, settings } = input;
  const yesterday = addDays(day, -1);
  const todayLogs = logs.filter((l) => l.day === day);
  const yLogs = logs.filter((l) => l.day === yesterday);
  const loadToday = dayLoad(logs, day);
  const loadYesterday = dayLoad(logs, yesterday);
  const reasons: string[] = [];
  const alerts: string[] = [];
  const blocked = new Set<LoadTag>();
  const blockedWhy: string[] = [];

  // Body-part blocks carry one day.
  for (const l of todayLogs) {
    if (isHeavyLegs(l)) {
      blocked.add('legs');
      blocked.add('jump');
      blockedWhy.push(l.performance ? 'Recital or show day: no extra leg work or jumping.' : l.heavyJumping ? 'Lots of jumping today, so no extra jumps or hard leg work.' : 'A long, hard class today, so no extra jumps or hard leg work.');
    }
  }
  for (const l of yLogs) {
    if (l.performance && !blocked.has('legs')) {
      blocked.add('legs');
      blocked.add('jump');
      blockedWhy.push('Recital or show yesterday, so your legs get another easy day.');
    } else if (l.heavyJumping && !blocked.has('jump')) {
      blocked.add('jump');
      blockedWhy.push('Lots of jumping yesterday, so no jumping today.');
    }
  }
  // Cumulative load brake (slow-down only): this week's activity against the four-week average.
  const week = sumLoad(logs, addDays(day, -6), day);
  const month = sumLoad(logs, addDays(day, -27), day);
  const weeklyAvg = month / 4;
  const ratio = weeklyAvg > 0 && month >= 12 ? week / weeklyAvg : 0;

  // RED: symptoms. Nothing else matters.
  if (checkIn && (checkIn.pain || checkIn.sick || checkIn.dizzy)) {
    if (checkIn.pain) { reasons.push('You said something hurts. Pain means stop. You never keep going when something hurts.'); alerts.push('Reported pain at check-in.'); }
    if (checkIn.sick) { reasons.push('You feel sick. Rest, drink water, and tell a grown-up.'); alerts.push('Reported feeling sick at check-in.'); }
    if (checkIn.dizzy) { reasons.push('You feel dizzy. Sit down, drink some water, and tell a grown-up right now.'); alerts.push('Reported dizziness at check-in.'); }
    return {
      color: 'red',
      headline: 'Easy day: breathe, and tell a grown-up',
      reasons: [...reasons, 'Tell a parent or another grown-up how you feel. If it is more than tired muscles, a grown-up decides about the doctor, not the app.', 'Two minutes of slow breathing still counts as your day. Nothing else today.'],
      blocked: [...blocked],
      blockedWhy,
      offer: { templateId: 'easy', name: 'Easy day', kind: 'recovery', reduced: true },
      foundations: 'no',
      loadToday,
      loadYesterday,
      alerts
    };
  }

  // Recent training: strength inside 48 hours, strength count this week, rest day this week.
  const done = sessions.filter((s) => s.status === 'done');
  const lastStrength = done.filter((s) => DEMANDING_KINDS.includes(s.kind) && s.day <= day).sort((a, b) => b.day.localeCompare(a.day))[0];
  const hoursSinceStrength = lastStrength ? daysBetween(lastStrength.day, day) * 24 : Infinity;
  const weekStart = addDays(day, -6);
  const strengthThisWeek = done.filter((s) => DEMANDING_KINDS.includes(s.kind) && s.day >= weekStart && s.day < day).length;
  const activeDays = new Set<Day>();
  for (let i = 1; i <= 6; i++) {
    const d = addDays(day, -i);
    if (done.some((s) => s.day === d && s.kind !== 'foundations' && s.kind !== 'recovery') || logs.some((l) => l.day === d)) activeDays.add(d);
  }
  const noRestDay = activeDays.size >= 6;

  // Score the day.
  let color: ReadinessColor = 'green';
  const performance = todayLogs.some((l) => l.performance);
  const twoThings = todayLogs.length >= 2 && loadToday >= 4;
  if (performance) { color = 'orange'; reasons.push('Recital or show day! That was your workout. A five-minute stretch is all that is left.'); alerts.push('Performance day logged.'); }
  else if (loadToday >= 6) { color = 'orange'; reasons.push('You already moved a lot today (a long, hard one). You do not need anything extra.'); }
  else if (twoThings) { color = 'orange'; reasons.push('Two things today add up to a big day.'); }
  else if (checkIn?.energy === 1) { color = 'orange'; reasons.push('You have no energy today. Five easy minutes and then rest is the smart choice.'); }
  else if (checkIn?.soreness === 'alot') { color = 'orange'; reasons.push('You are very sore. Sore muscles need a gentle stretch and a good sleep, not more work.'); }
  else if (ratio >= 1.5) { color = 'orange'; reasons.push('This week has been a lot busier than usual. A stretch today keeps the rest of the week good.'); alerts.push('Activity load this week is more than 1.5 times the four-week average.'); }
  else {
    if (ratio >= 1.3) { color = 'yellow'; reasons.push('This week has been busier than usual, so today is easier.'); }
    if (loadToday >= 3) { color = 'yellow'; reasons.push(todayLogs.some((l) => l.sport === 'dance') ? 'You had dance today, so today is a gentle one.' : 'You already did something today, so today is a gentle one.'); }
    if (loadYesterday >= 6 && color === 'green') { color = 'yellow'; reasons.push('Yesterday was a big day, so today stays easy.'); }
    if (checkIn?.energy === 2) { color = 'yellow'; reasons.push('Your energy is low today.'); }
    if (checkIn && checkIn.sleep <= 2) { color = 'yellow'; reasons.push('You did not sleep well, so today is easier. Tonight, get a good sleep.'); }
    if (checkIn?.soreness === 'some') { color = 'yellow'; reasons.push('You are a little sore, so today is easier.'); }
    if (noRestDay) { color = 'yellow'; reasons.push('Six busy days in a row. A real rest day this week is part of the plan.'); alerts.push('No rest day in the last six days.'); }
  }
  if (color === 'green') reasons.push('You feel fresh, slept okay, and nothing big happened today or yesterday.');

  // What to offer.
  let offer: Readiness['offer'];
  let foundations: Readiness['foundations'] = 'yes';
  if (color === 'orange') {
    offer = { templateId: 'recovery', name: 'Five-minute stretch', kind: 'recovery', reduced: false };
    foundations = 'optional';
  } else if (color === 'yellow') {
    offer = { templateId: 'light', name: 'Easy workout', kind: 'light', reduced: true };
  } else {
    const planned = input.planned ?? { kind: 'flex', templateId: 'flex', name: 'Stretch and reach' };
    const fallback = input.fallback ?? { kind: 'flex', templateId: 'flex', name: 'Stretch and reach' };
    const demanding = DEMANDING_KINDS.includes(planned.kind);
    if (demanding && hoursSinceStrength < 48) {
      reasons.push(`You did Strong and steady ${hoursSinceStrength === 0 ? 'today' : 'yesterday'}. Muscles get a day off between strong days, so today is ${fallback.name}.`);
      offer = { ...fallback, reduced: false };
    } else if (demanding && strengthThisWeek >= settings.strengthDaysPerWeek) {
      reasons.push(`You already did Strong and steady ${strengthThisWeek} times this week (the plan is ${settings.strengthDaysPerWeek}), so today is ${fallback.name}.`);
      offer = { ...fallback, reduced: false };
    } else if (demanding && blocked.has('legs')) {
      reasons.push(`Your legs already worked hard, so today is ${fallback.name} instead of Strong and steady.`);
      offer = { ...fallback, reduced: false };
    } else {
      offer = { templateId: planned.templateId, name: planned.name, kind: planned.kind, reduced: false };
    }
  }

  const headline = color === 'green' ? 'Fresh and ready' : color === 'yellow' ? 'Easy workout today' : 'Big day already: just the five-minute stretch';
  return { color, headline, reasons, blocked: [...blocked], blockedWhy, offer, foundations, loadToday, loadYesterday, alerts };
}

function sumLoad(logs: SportsLog[], from: Day, to: Day): number {
  return logs.filter((l) => l.day >= from && l.day <= to).reduce((s, l) => s + logLoad(l), 0);
}

/** Days in a row with something done (any session, the Daily 5 and the Easy day included) or an activity logged. */
export function chain(sessions: Session[], logs: SportsLog[], day: Day): { length: number; aliveToday: boolean } {
  const days = new Set([...sessions.filter((s) => s.status === 'done').map((s) => s.day), ...logs.map((l) => l.day)]);
  const aliveToday = days.has(day);
  let d = aliveToday ? day : addDays(day, -1);
  let n = 0;
  while (days.has(d)) { n += 1; d = addDays(d, -1); }
  return { length: n, aliveToday };
}

export const COLOR_WORDS: Record<ReadinessColor, string> = { green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red' };
