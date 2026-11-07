/**
 * Program and progression.
 *
 * Turns a template into today's session: honors the readiness blocks, anything a parent turned off,
 * the phase of the program, and what the last two sessions of that exercise felt like. One change
 * at a time (reps or seconds, then sets), never past an exercise's cap, bodyweight only, and nothing
 * added in the learn phase or in growth-spurt mode.
 */
import type { Athlete, Day, Dose, Exercise, ExerciseStatus, LoadTag, Session, SessionItem, SessionKind, WorkoutTemplate, Who } from './types';
import { daysBetween, newId, nowIso } from './types';
import type { Readiness } from './readiness';

export type Phase = 'learn' | 'build' | 'refine' | 'develop' | 'review';

export interface PhaseInfo {
  phase: Phase;
  week: number; // 1-based week of the program
  label: string;
  text: string;
}

/** Weeks 1 to 2 learn, 3 to 4 build, 5 to 6 refine, then four-week blocks of three build weeks and a review week. */
export function programPhase(programStart: Day, day: Day): PhaseInfo {
  const week = Math.max(1, Math.floor(daysBetween(programStart, day) / 7) + 1);
  if (week <= 2) return { phase: 'learn', week, label: 'Learning the moves', text: 'Weeks 1 and 2: learn each exercise, get the form right, build the habit. No extra reps yet, on purpose.' };
  if (week <= 4) return { phase: 'build', week, label: 'Building', text: 'Weeks 3 and 4: a few more reps or a set where the last two sessions felt easy and recovery was good.' };
  if (week <= 6) return { phase: 'refine', week, label: 'Refining', text: 'Weeks 5 and 6: movement quality, a harder version offered where the easier one is solid, and a look back at the basics.' };
  const inBlock = (week - 7) % 4; // 0..3
  if (inBlock === 3) return { phase: 'review', week, label: 'Review week', text: 'A lighter week to review form and recovery before the next block. No additions this week.' };
  return { phase: 'develop', week, label: `Development block, week ${inBlock + 1} of 4`, text: 'Steady development: small additions only where form and recovery support them.' };
}

/** The three green-day sessions take turns: Stretch and reach, Strong and steady, Happy feet, then round again. */
export const ROTATION: SessionKind[] = ['flex', 'strength', 'feet'];

export interface Rotation {
  /** What comes next in the rotation. */
  planned: WorkoutTemplate;
  /** The next non-strength session, for days when strength is not allowed. */
  fallback: WorkoutTemplate;
}

export function nextInRotation(sessions: Session[], templates: WorkoutTemplate[]): Rotation {
  const byKind = (k: SessionKind) => templates.find((t) => t.kind === k && !t.archived);
  const flex = byKind('flex') ?? templates[0];
  const strength = byKind('strength') ?? flex;
  const feet = byKind('feet') ?? flex;
  const pick = (k: SessionKind) => (k === 'strength' ? strength : k === 'feet' ? feet : flex);
  const done = sessions.filter((s) => s.status === 'done' && ROTATION.includes(s.kind)).sort((x, y) => (y.day + y.createdAt).localeCompare(x.day + x.createdAt));
  const last = done[0];
  const idx = last ? ROTATION.indexOf(last.kind) : -1;
  const next = ROTATION[(idx + 1) % ROTATION.length];
  const planned = pick(next);
  // Fallback: of stretch and feet, whichever was done longer ago.
  const lastFlex = done.find((s) => s.kind === 'flex');
  const lastFeet = done.find((s) => s.kind === 'feet');
  let fallback: WorkoutTemplate;
  if (next === 'flex') fallback = flex;
  else if (next === 'feet') fallback = feet;
  else if (!lastFlex) fallback = flex;
  else if (!lastFeet) fallback = feet;
  else fallback = lastFlex.day <= lastFeet.day ? flex : feet;
  return { planned, fallback };
}

export interface BuildContext {
  day: Day;
  athlete: Athlete;
  exercises: Map<string, Exercise>;
  statuses: Map<string, ExerciseStatus>;
  sessions: Session[];
  by: Who;
}

interface ItemHistory {
  session: Session;
  item: SessionItem;
}

function historyFor(exerciseId: string, sessions: Session[], before: Day): ItemHistory[] {
  const out: ItemHistory[] = [];
  for (const s of sessions) {
    if (s.status !== 'done' || s.day > before) continue;
    for (const it of s.items) if (it.exerciseId === exerciseId && !it.skipped && it.sets.some((x) => x.done)) out.push({ session: s, item: it });
  }
  return out.sort((x, y) => (y.session.day + y.session.createdAt).localeCompare(x.session.day + x.session.createdAt));
}

function doneAllPlanned(h: ItemHistory): boolean {
  const planned = h.item.planned.sets;
  const done = h.item.sets.filter((s) => s.done);
  if (done.length < planned) return false;
  if (h.item.planned.reps) return done.every((s) => (s.reps ?? 0) >= (h.item.planned.reps ?? 0));
  if (h.item.planned.seconds) return done.every((s) => (s.seconds ?? 0) >= (h.item.planned.seconds ?? 0));
  return true;
}

function feltEasy(h: ItemHistory): boolean {
  const d = h.item.difficulty ?? h.session.overallDifficulty;
  const good = h.item.feltGood ?? h.session.feltGood;
  if (d === undefined) return false;
  return d <= 2 || (d === 3 && good === true);
}

function feltHard(h: ItemHistory): boolean {
  const d = h.item.difficulty ?? h.session.overallDifficulty;
  const good = h.item.feltGood ?? h.session.feltGood;
  return (d !== undefined && d >= 4) || good === false;
}

export interface DoseDecision {
  dose: Dose;
  reason?: string;
  /** In the refine phase: a harder version worth trying, offered, never forced. */
  tryHarder?: string;
}

/**
 * The dose for one exercise today. Starts from the template dose, moves to what was last done,
 * then adds a little only when the last two sessions were completed and felt easy, in a phase that
 * allows it. One change at a time; reps first, then a set; never past the cap; never on a reduced day.
 */
export function decideDose(exercise: Exercise, templateDose: Dose, ctx: BuildContext, phase: PhaseInfo, reduced: boolean): DoseDecision {
  const hist = historyFor(exercise.id, ctx.sessions, ctx.day);
  const last = hist[0];
  let dose: Dose = { ...templateDose };
  if (reduced) return { dose: { ...dose, sets: 1 }, reason: 'Lighter day: one set, easy pace.' };
  if (last) dose = { ...dose, sets: last.item.planned.sets, reps: last.item.planned.reps ?? dose.reps, seconds: last.item.planned.seconds ?? dose.seconds };
  const cap = exercise.maxDose ?? { sets: 3, reps: 15, seconds: 60 };
  // Safety first: never above the cap, never below the template.
  dose.sets = Math.min(Math.max(dose.sets, templateDose.sets), cap.sets);
  if (dose.reps !== undefined) dose.reps = Math.min(Math.max(dose.reps, templateDose.reps ?? dose.reps), cap.reps ?? 15);
  if (dose.seconds !== undefined) dose.seconds = Math.min(Math.max(dose.seconds, templateDose.seconds ?? dose.seconds), cap.seconds ?? 60);

  if (ctx.athlete.growthSpurtMode) return { dose, reason: 'Growth-spurt mode: holding steady while coordination catches up.' };
  if (phase.phase === 'learn') return { dose, reason: 'Learning phase: same dose, better form.' };
  if (phase.phase === 'review') return { dose, reason: 'Review week: no additions.' };
  if (hist.length < 2) return { dose };
  const [h1, h2] = hist;
  if (feltHard(h1)) {
    // Ease back toward the template, never below it.
    const eased: Dose = { ...dose };
    if (eased.reps !== undefined && templateDose.reps !== undefined && eased.reps > templateDose.reps) eased.reps = Math.max(templateDose.reps, eased.reps - 2);
    else if (eased.seconds !== undefined && templateDose.seconds !== undefined && eased.seconds > templateDose.seconds) eased.seconds = Math.max(templateDose.seconds, eased.seconds - 5);
    const changed = JSON.stringify(eased) !== JSON.stringify(dose);
    return { dose: eased, reason: changed ? 'Last time felt hard, so a little less today.' : 'Last time felt hard; holding here.' };
  }
  if (!(doneAllPlanned(h1) && doneAllPlanned(h2) && feltEasy(h1) && feltEasy(h2))) return { dose, reason: 'Holding steady until two sessions in a row feel easy.' };

  const out: DoseDecision = { dose: { ...dose } };
  if (phase.phase === 'refine' && exercise.harder) out.tryHarder = exercise.harder;
  if (dose.reps !== undefined) {
    const maxReps = cap.reps ?? 15;
    if (dose.reps < maxReps) { out.dose.reps = Math.min(maxReps, dose.reps + 2); out.reason = 'Last two sessions felt easy: two more reps.'; return out; }
    if (dose.sets < cap.sets) { out.dose.sets = dose.sets + 1; out.reason = 'Reps are at the top of the range: one more set.'; return out; }
  } else if (dose.seconds !== undefined) {
    const maxSec = cap.seconds ?? 60;
    if (dose.seconds < maxSec) { out.dose.seconds = Math.min(maxSec, dose.seconds + 5); out.reason = 'Last two felt easy: five more seconds.'; return out; }
    if (dose.sets < cap.sets) { out.dose.sets = dose.sets + 1; out.reason = 'Time is at the top of the range: one more set.'; return out; }
  }
  out.reason = exercise.harder ? 'At the top of this exercise. A harder version is there when you want it.' : 'At the top of this exercise. Keep the form perfect.';
  if (exercise.harder) out.tryHarder = exercise.harder;
  return out;
}

const TAG_WORDS: Record<LoadTag, string> = { legs: 'legs', jump: 'legs', spine: 'back', shoulder: 'shoulders', hip: 'hips', ankle: 'ankles', wrist: 'wrists', knee: 'knees' };

function blockedBy(exercise: Exercise, blocked: LoadTag[]): LoadTag | undefined {
  return exercise.loadTags.find((t) => blocked.includes(t));
}

function pickSubstitute(exercise: Exercise, ctx: BuildContext, blocked: LoadTag[], needFormCheckOk: boolean): Exercise | undefined {
  const candidates = [...exercise.substitutes, exercise.easier].filter((x): x is string => !!x).map((id) => ctx.exercises.get(id)).filter((e): e is Exercise => !!e && !e.archived);
  for (const c of candidates) {
    if (ctx.statuses.get(c.id)?.disabled) continue;
    if (blockedBy(c, blocked)) continue;
    if (needFormCheckOk && c.needsFormCheck && !ctx.statuses.get(c.id)?.formCheckedAt) continue;
    return c;
  }
  return undefined;
}

export interface BuiltSession {
  session: Session;
  /** Items that were swapped or dropped and why, for the "Why this session" card. */
  changes: string[];
}

/** Build today's session from a template and the readiness verdict. */
export function buildSession(template: WorkoutTemplate, readiness: Readiness, ctx: BuildContext): BuiltSession {
  const phase = programPhase(ctx.athlete.programStart, ctx.day);
  const reduced = readiness.offer.reduced;
  const changes: string[] = [];
  const items: SessionItem[] = [];
  for (const ti of template.items) {
    let ex = ctx.exercises.get(ti.exerciseId);
    if (!ex || ex.archived) continue;
    const status = ctx.statuses.get(ex.id);
    if (status?.disabled) { changes.push(`${ex.name} is turned off by a parent, so it is out.`); continue; }
    let swappedFrom: Exercise | undefined;
    const needsCheck = (ti.requiresFormCheck || ex.needsFormCheck) && !status?.formCheckedAt;
    const tag = blockedBy(ex, readiness.blocked);
    if (needsCheck || tag) {
      const sub = pickSubstitute(ex, ctx, readiness.blocked, true);
      const why = needsCheck ? `${ex.name} waits for a grown-up to watch it once` : `${ex.name} works the ${tag === 'jump' ? 'jumping legs' : TAG_WORDS[tag as LoadTag]}, which rest today`;
      if (sub) { changes.push(`${why}, so ${sub.name} is in its place.`); swappedFrom = ex; ex = sub; }
      else if (ti.optional) { changes.push(`${why}; it was optional, so it is out.`); continue; }
      else { changes.push(`${why}; nothing safe fits, so it is out today.`); continue; }
    }
    if (reduced && ex.loadTags.includes('jump')) { changes.push(`${ex.name} is out on a lighter day.`); continue; }
    const base = swappedFrom ? ex.defaultDose : ti.dose;
    const decision = decideDose(ex, base, ctx, phase, reduced);
    items.push({
      exerciseId: ex.id,
      exerciseName: ex.name,
      catalogVersion: ex.version,
      planned: decision.dose,
      sets: [],
      swappedFromId: swappedFrom?.id,
      swappedFromName: swappedFrom?.name,
      doseReason: decision.reason,
      ...(decision.tryHarder ? { note: `Ready to try: ${ctx.exercises.get(decision.tryHarder)?.name ?? ''}` } : {})
    });
  }
  const ts = nowIso();
  const session: Session = {
    id: newId(),
    day: ctx.day,
    templateId: template.id,
    templateName: template.name,
    kind: template.kind as SessionKind,
    status: 'planned',
    readiness: readiness.color,
    why: [...readiness.reasons, ...readiness.blockedWhy, ...changes, `${phase.label}: ${phase.text}`],
    items,
    by: ctx.by,
    createdAt: ts,
    updatedAt: ts
  };
  return { session, changes };
}

/** Minutes a session will take, roughly: reps at 3 seconds, holds as timed, 20 seconds between sets. */
export function estimateMinutes(items: SessionItem[]): number {
  let sec = 0;
  for (const it of items) {
    const sides = it.planned.perSide ? 2 : 1;
    const per = it.planned.seconds ?? (it.planned.reps ?? 8) * 3;
    sec += it.planned.sets * sides * per + it.planned.sets * 20;
  }
  return Math.max(3, Math.round(sec / 60));
}

export function doseText(d: Dose): string {
  const reps = d.reps !== undefined ? (d.repsMax && d.repsMax !== d.reps ? `${d.reps} to ${d.repsMax}` : `${d.reps}`) : undefined;
  const unit = d.seconds !== undefined ? `${d.seconds} sec` : `${reps} reps`;
  return `${d.sets} × ${unit}${d.perSide ? ' per side' : ''}`;
}
