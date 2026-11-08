import { describe, it, expect } from 'vitest';
import { programPhase, decideDose, buildSession, nextInRotation, estimateMinutes, doseText } from '../src/engine/program';
import { assessReadiness } from '../src/engine/readiness';
import { LIBRARY_EXERCISES, EXERCISE_BY_ID } from '../src/data/exercises';
import { LIBRARY_TEMPLATES, TEMPLATE_BY_ID } from '../src/data/templates';
import type { Athlete, Session, SessionItem, ExerciseStatus, Exercise } from '../src/engine/types';
import { addDays } from '../src/engine/types';

const DAY = '2026-12-07';
const athlete: Athlete = { id: 'athlete', firstName: 'Vivi', birthYear: 2017, sports: ['dance'], theme: 'play', goals: [], programStart: '2026-11-08', createdAt: '', updatedAt: '' };
const exercises = new Map(LIBRARY_EXERCISES.map((e) => [e.id, e]));
const fine = { energy: 4 as const, sleep: 4 as const, soreness: 'none' as const, pain: false, sick: false, dizzy: false };
const settings = { strengthDaysPerWeek: 3 as const };
const strength = { kind: 'strength' as const, templateId: 'strength', name: 'Strong and steady' };
const flex = { kind: 'flex' as const, templateId: 'flex', name: 'Stretch and reach' };

function doneSession(day: string, templateId: string, items: SessionItem[], difficulty: 1 | 2 | 3 | 4 | 5 = 2, feltGood = true): Session {
  const t = TEMPLATE_BY_ID[templateId];
  return { id: 's-' + day + templateId, day, templateId, templateName: t?.name ?? templateId, kind: t?.kind ?? 'light', status: 'done', why: [], items, overallDifficulty: difficulty, feltGood, by: 'athlete', createdAt: day + 'T18:00:00Z', updatedAt: day + 'T18:00:00Z' };
}
function doneItem(ex: Exercise, planned = ex.defaultDose, difficulty?: 1 | 2 | 3 | 4 | 5): SessionItem {
  const n = planned.sets * (planned.perSide ? 2 : 1);
  return { exerciseId: ex.id, exerciseName: ex.name, catalogVersion: ex.version, planned, sets: Array.from({ length: n }, () => ({ reps: planned.reps, seconds: planned.seconds, load: 'body' as const, done: true, ts: '' })), difficulty };
}

describe('program phases', () => {
  it('weeks 1-2 learn, 3-4 build, 5-6 refine, then four-week blocks with a review week', () => {
    expect(programPhase('2026-11-08', '2026-11-08').phase).toBe('learn');
    expect(programPhase('2026-11-08', '2026-11-21').phase).toBe('learn');
    expect(programPhase('2026-11-08', '2026-11-22').phase).toBe('build');
    expect(programPhase('2026-11-08', '2026-12-06').phase).toBe('refine');
    expect(programPhase('2026-11-08', '2026-12-20').phase).toBe('develop');
    expect(programPhase('2026-11-08', addDays('2026-11-08', 7 * 9)).phase).toBe('review');
  });
});

describe('the rotation: stretch, strength, feet', () => {
  it('starts with Stretch and reach and goes round', () => {
    expect(nextInRotation([], LIBRARY_TEMPLATES).planned.id).toBe('flex');
    expect(nextInRotation([doneSession(addDays(DAY, -1), 'flex', [])], LIBRARY_TEMPLATES).planned.id).toBe('strength');
    expect(nextInRotation([doneSession(addDays(DAY, -1), 'strength', [])], LIBRARY_TEMPLATES).planned.id).toBe('feet');
    expect(nextInRotation([doneSession(addDays(DAY, -1), 'feet', [])], LIBRARY_TEMPLATES).planned.id).toBe('flex');
  });
  it('light, recovery and Five-minute mini workout days do not move the rotation', () => {
    const s = [doneSession(addDays(DAY, -1), 'light', []), doneSession(addDays(DAY, -2), 'foundations', []), doneSession(addDays(DAY, -3), 'flex', [])];
    expect(nextInRotation(s, LIBRARY_TEMPLATES).planned.id).toBe('strength');
  });
  it('the fallback for a strength day is whichever of stretch and feet was longer ago', () => {
    const s = [doneSession(addDays(DAY, -1), 'flex', []), doneSession(addDays(DAY, -3), 'feet', [])];
    expect(nextInRotation(s, LIBRARY_TEMPLATES).fallback.id).toBe('feet');
    const s2 = [doneSession(addDays(DAY, -1), 'flex', [])];
    expect(nextInRotation(s2, LIBRARY_TEMPLATES).fallback.id).toBe('feet');
  });
});

describe('progression (never weights, one change at a time)', () => {
  const squat = EXERCISE_BY_ID['st-squat'];
  const ctx = (sessions: Session[]) => ({ day: DAY, athlete, exercises, statuses: new Map<string, ExerciseStatus>(), sessions, by: 'athlete' as const });

  it('learn phase never adds', () => {
    const d = decideDose(squat, squat.defaultDose, ctx([doneSession(addDays(DAY, -2), 'strength', [doneItem(squat, undefined, 1)], 1), doneSession(addDays(DAY, -4), 'strength', [doneItem(squat, undefined, 1)], 1)]), { phase: 'learn', week: 1, label: '', text: '' }, false);
    expect(d.dose).toEqual(squat.defaultDose);
  });

  it('two easy, fully completed sessions add two reps in the build phase', () => {
    const s = [doneSession(addDays(DAY, -2), 'strength', [doneItem(squat, undefined, 1)], 1), doneSession(addDays(DAY, -4), 'strength', [doneItem(squat, undefined, 2)], 2)];
    const d = decideDose(squat, squat.defaultDose, ctx(s), { phase: 'build', week: 3, label: '', text: '' }, false);
    expect(d.dose.reps).toBe(squat.defaultDose.reps! + 2);
    expect(d.dose.sets).toBe(squat.defaultDose.sets);
  });

  it('one easy session is not enough', () => {
    const d = decideDose(squat, squat.defaultDose, ctx([doneSession(addDays(DAY, -2), 'strength', [doneItem(squat, undefined, 1)], 1), doneSession(addDays(DAY, -4), 'strength', [doneItem(squat, undefined, 4)], 4)]), { phase: 'build', week: 3, label: '', text: '' }, false);
    expect(d.dose).toEqual(squat.defaultDose);
  });

  it('a hard session eases back toward the template, never below it', () => {
    const higher = { ...squat.defaultDose, reps: 12 };
    const d = decideDose(squat, squat.defaultDose, ctx([doneSession(addDays(DAY, -2), 'strength', [doneItem(squat, higher, 5)], 5), doneSession(addDays(DAY, -4), 'strength', [doneItem(squat, higher, 2)], 2)]), { phase: 'build', week: 3, label: '', text: '' }, false);
    expect(d.dose.reps).toBe(10);
  });

  it('holds grow by five seconds, then a set, never past the cap', () => {
    const plank = EXERCISE_BY_ID['st-plank'];
    const d = decideDose(plank, plank.defaultDose, ctx([doneSession(addDays(DAY, -2), 'strength', [doneItem(plank, undefined, 1)], 1), doneSession(addDays(DAY, -4), 'strength', [doneItem(plank, undefined, 1)], 1)]), { phase: 'build', week: 3, label: '', text: '' }, false);
    expect(d.dose.seconds).toBe(plank.defaultDose.seconds! + 5);
    const atMax = { ...plank.defaultDose, seconds: 45, sets: 3 };
    const top = decideDose(plank, plank.defaultDose, ctx([doneSession(addDays(DAY, -2), 'strength', [doneItem(plank, atMax, 1)], 1), doneSession(addDays(DAY, -4), 'strength', [doneItem(plank, atMax, 1)], 1)]), { phase: 'develop', week: 8, label: '', text: '' }, false);
    expect(top.dose.seconds).toBe(45);
    expect(top.dose.sets).toBe(3);
  });

  it('growth-spurt mode and review week hold steady; a reduced day is one set', () => {
    const s = [doneSession(addDays(DAY, -2), 'strength', [doneItem(squat, undefined, 1)], 1), doneSession(addDays(DAY, -4), 'strength', [doneItem(squat, undefined, 1)], 1)];
    expect(decideDose(squat, squat.defaultDose, { ...ctx(s), athlete: { ...athlete, growthSpurtMode: true } }, { phase: 'build', week: 3, label: '', text: '' }, false).dose).toEqual(squat.defaultDose);
    expect(decideDose(squat, squat.defaultDose, ctx(s), { phase: 'review', week: 10, label: '', text: '' }, false).dose).toEqual(squat.defaultDose);
    expect(decideDose(squat, { ...squat.defaultDose, sets: 3 }, ctx([]), { phase: 'develop', week: 8, label: '', text: '' }, true).dose.sets).toBe(1);
  });

  it('every set the engine builds is body weight', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions: [], settings, planned: strength, fallback: flex });
    const { session } = buildSession(TEMPLATE_BY_ID['strength'], r, { day: DAY, athlete, exercises, statuses: new Map(), sessions: [], by: 'athlete' });
    for (const it of session.items) expect(exercises.get(it.exerciseId)!.loads).toEqual(['body']);
  });
});

describe('session building from a template', () => {
  const base = { day: DAY, athlete, exercises, sessions: [] as Session[], by: 'athlete' as const };

  it('a green strength day builds the full Strong and steady with its warm-up and stretch at the end', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions: [], settings, planned: strength, fallback: flex });
    const { session } = buildSession(TEMPLATE_BY_ID['strength'], r, { ...base, statuses: new Map() });
    const ids = session.items.map((i) => i.exerciseId);
    expect(ids[0]).toBe('wu-march');
    expect(ids).toEqual(expect.arrayContaining(['st-squat', 'st-bridge', 'st-wallpush', 'st-plank', 'st-deadbug']));
    expect(ids[ids.length - 1]).toBe('fx-childpose');
    expect(estimateMinutes(session.items)).toBeLessThanOrEqual(16);
  });

  it('a performance day: even a forced Strong and steady has no leg or jump items', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [{ id: 'l', day: DAY, ts: '', sport: 'dance', duration: 'long', intensity: 'hard', performance: true, by: 'athlete' }], sessions: [], settings, planned: strength, fallback: flex });
    expect(r.offer.kind).toBe('recovery');
    const { session, changes } = buildSession(TEMPLATE_BY_ID['strength'], r, { ...base, statuses: new Map() });
    for (const it of session.items) expect(exercises.get(it.exerciseId)!.loadTags.some((t) => t === 'legs' || t === 'jump'), it.exerciseId).toBe(false);
    expect(changes.join(' ')).toMatch(/rest today/);
  });

  it('a yellow (dance) day drops jumping and keeps the gentle stretches, one set each', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [{ id: 'l', day: DAY, ts: '', sport: 'dance', duration: 'medium', intensity: 'medium', by: 'athlete' }], sessions: [], settings, planned: strength, fallback: flex });
    expect(r.offer.templateId).toBe('light');
    const { session } = buildSession(TEMPLATE_BY_ID['feet'], r, { ...base, statuses: new Map() });
    expect(session.items.map((i) => i.exerciseId)).not.toContain('bl-landing');
    for (const it of session.items) expect(it.planned.sets).toBe(1);
  });

  it('a parent can turn a move off', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions: [], settings, planned: flex, fallback: flex });
    const statuses = new Map<string, ExerciseStatus>([['fx-frog', { exerciseId: 'fx-frog', approvedLoads: [], disabled: true, updatedAt: '' }]]);
    const { session, changes } = buildSession(TEMPLATE_BY_ID['flex'], r, { ...base, statuses });
    expect(session.items.map((i) => i.exerciseId)).not.toContain('fx-frog');
    expect(changes.join(' ')).toMatch(/turned it off/);
  });

  it('Just breathing is two minutes of breathing and an optional walk', () => {
    const r = assessReadiness({ day: DAY, checkIn: { ...fine, pain: true }, logs: [], sessions: [], settings });
    const { session } = buildSession(TEMPLATE_BY_ID['easy'], r, { ...base, statuses: new Map() });
    expect(session.items[0].exerciseId).toBe('br-breathe');
    expect(session.items[0].planned.seconds).toBe(120);
    expect(session.items.length).toBeLessThanOrEqual(2);
  });

  it('doseText reads like a kid would say it', () => {
    expect(doseText({ sets: 2, reps: 8, repsMax: 12 })).toBe('8 to 12 times, 2 rounds');
    expect(doseText({ sets: 1, seconds: 30, perSide: true })).toBe('hold 30 seconds, each side');
  });
});
