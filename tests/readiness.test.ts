import { describe, it, expect } from 'vitest';
import { assessReadiness, logLoad, chain } from '../src/engine/readiness';
import type { SportsLog, Session, CheckIn } from '../src/engine/types';
import { addDays } from '../src/engine/types';

const DAY = '2026-11-09';
const log = (p: Partial<SportsLog>): SportsLog => ({ id: 'l' + Math.random(), day: DAY, ts: DAY + 'T17:00:00Z', sport: 'dance', duration: 'medium', intensity: 'medium', by: 'athlete', ...p });
const fine: Pick<CheckIn, 'energy' | 'sleep' | 'soreness' | 'pain' | 'sick' | 'dizzy'> = { energy: 4, sleep: 4, soreness: 'none', pain: false, sick: false, dizzy: false };
const settings = { strengthDaysPerWeek: 3 as const };
const done = (day: string, kind: Session['kind'], templateId = kind): Session => ({ id: 's' + day + kind, day, templateId, templateName: templateId, kind, status: 'done', why: [], items: [], by: 'athlete', createdAt: day + 'T18:00:00Z', updatedAt: day + 'T18:00:00Z' });
const strength = { kind: 'strength' as const, templateId: 'strength', name: 'Strong and steady' };
const flex = { kind: 'flex' as const, templateId: 'flex', name: 'Stretch and reach' };

describe('readiness engine (dance)', () => {
  it('fresh day is green with the planned session', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions: [], settings, planned: strength, fallback: flex });
    expect(r.color).toBe('green');
    expect(r.offer.templateId).toBe('strength');
    expect(r.blocked).toEqual([]);
  });

  it('a normal dance class makes a yellow day: the Easy workout, one set each', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [log({})], sessions: [], settings, planned: strength, fallback: flex });
    expect(r.color).toBe('yellow');
    expect(r.offer.templateId).toBe('light');
    expect(r.offer.reduced).toBe(true);
    expect(r.reasons.join(' ')).toMatch(/had dance today/);
  });

  it('a recital or competition day is orange: the five-minute stretch, and the parent sees it', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [log({ performance: true })], sessions: [], settings });
    expect(r.color).toBe('orange');
    expect(r.offer.kind).toBe('recovery');
    expect(r.foundations).toBe('optional');
    expect(r.blocked).toEqual(expect.arrayContaining(['legs', 'jump']));
    expect(r.alerts.some((a) => /Performance/.test(a))).toBe(true);
    const next = assessReadiness({ day: addDays(DAY, 1), checkIn: fine, logs: [log({ performance: true })], sessions: [], settings });
    expect(next.color).toBe('yellow');
    expect(next.blocked).toContain('legs');
  });

  it('lots of jumping blocks jumps today and tomorrow, and a long hard class is orange', () => {
    const today = assessReadiness({ day: DAY, checkIn: fine, logs: [log({ sport: 'play', duration: 'short', intensity: 'easy', heavyJumping: true })], sessions: [], settings });
    expect(today.blocked).toEqual(expect.arrayContaining(['legs', 'jump']));
    const tomorrow = assessReadiness({ day: addDays(DAY, 1), checkIn: fine, logs: [log({ sport: 'play', duration: 'short', intensity: 'easy', heavyJumping: true })], sessions: [], settings });
    expect(tomorrow.blocked).toContain('jump');
    expect(tomorrow.blocked).not.toContain('legs');
    const hard = assessReadiness({ day: DAY, checkIn: fine, logs: [log({ duration: 'long', intensity: 'hard' })], sessions: [], settings });
    expect(hard.color).toBe('orange');
  });

  it('pain, illness or dizziness is red: only the Easy day (breathing), with a parent alert', () => {
    for (const k of ['pain', 'sick', 'dizzy'] as const) {
      const r = assessReadiness({ day: DAY, checkIn: { ...fine, [k]: true }, logs: [], sessions: [], settings });
      expect(r.color).toBe('red');
      expect(r.offer.templateId).toBe('easy');
      expect(r.offer.reduced).toBe(true);
      expect(r.foundations).toBe('no');
      expect(r.alerts.length).toBeGreaterThan(0);
      expect(r.reasons.join(' ')).toMatch(/grown-up/);
    }
  });

  it('strength yesterday turns a planned strength day into the fallback; two days later it is fine', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions: [done(addDays(DAY, -1), 'strength')], settings, planned: strength, fallback: flex });
    expect(r.color).toBe('green');
    expect(r.offer.templateId).toBe('flex');
    expect(r.reasons.join(' ')).toMatch(/day off between/);
    const r2 = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions: [done(addDays(DAY, -2), 'strength')], settings, planned: strength, fallback: flex });
    expect(r2.offer.templateId).toBe('strength');
  });

  it('weekly strength cap: enough already this week means the fallback', () => {
    const sessions = [done(addDays(DAY, -2), 'strength'), done(addDays(DAY, -4), 'strength'), done(addDays(DAY, -6), 'strength')];
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions, settings, planned: strength, fallback: flex });
    expect(r.offer.templateId).toBe('flex');
    const r2 = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions: sessions.slice(0, 2), settings: { strengthDaysPerWeek: 2 }, planned: strength, fallback: flex });
    expect(r2.offer.templateId).toBe('flex');
  });

  it('stretch and feet days have no cap and no 48-hour rule', () => {
    const sessions = [done(addDays(DAY, -1), 'flex'), done(addDays(DAY, -2), 'feet'), done(addDays(DAY, -3), 'flex')];
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions, settings, planned: { kind: 'feet', templateId: 'feet', name: 'Happy feet' }, fallback: flex });
    expect(r.offer.templateId).toBe('feet');
  });

  it('poor sleep, low energy or soreness make a yellow day; wiped out or very sore is orange', () => {
    expect(assessReadiness({ day: DAY, checkIn: { ...fine, sleep: 2 }, logs: [], sessions: [], settings }).color).toBe('yellow');
    expect(assessReadiness({ day: DAY, checkIn: { ...fine, soreness: 'some' }, logs: [], sessions: [], settings }).color).toBe('yellow');
    expect(assessReadiness({ day: DAY, checkIn: { ...fine, energy: 1 }, logs: [], sessions: [], settings }).color).toBe('orange');
    expect(assessReadiness({ day: DAY, checkIn: { ...fine, soreness: 'alot' }, logs: [], sessions: [], settings }).color).toBe('orange');
  });

  it('six active days in a row asks for a rest day and tells the parent', () => {
    const logs = Array.from({ length: 6 }, (_, i) => log({ day: addDays(DAY, -(i + 1)), sport: 'play', duration: 'short', intensity: 'easy' }));
    const r = assessReadiness({ day: DAY, checkIn: fine, logs, sessions: [], settings });
    expect(r.color).toBe('yellow');
    expect(r.alerts.some((a) => /rest day/.test(a))).toBe(true);
  });

  it('load scores are bounded and performance days are the top', () => {
    expect(logLoad(log({ duration: 'short', intensity: 'easy' }))).toBe(1);
    expect(logLoad(log({ duration: 'long', intensity: 'hard' }))).toBe(9);
    expect(logLoad(log({ performance: true, duration: 'short', intensity: 'easy' }))).toBe(9);
  });

  it('the chain counts any done session or logged activity, Easy day included', () => {
    const c = chain([done(addDays(DAY, -1), 'recovery'), done(addDays(DAY, -2), 'foundations')], [log({ day: addDays(DAY, -3) })], DAY);
    expect(c.length).toBe(3);
    expect(c.aliveToday).toBe(false);
  });

  it('never claims medical clearance, never mentions weights', () => {
    const r = assessReadiness({ day: DAY, checkIn: fine, logs: [], sessions: [], settings });
    expect(JSON.stringify(r)).not.toMatch(/cleared|medical clearance|weight/i);
  });
});
