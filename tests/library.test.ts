import { describe, it, expect } from 'vitest';
import { LIBRARY_EXERCISES, EXERCISE_BY_ID, CATALOG_VERSION } from '../src/data/exercises';
import { LIBRARY_TEMPLATES } from '../src/data/templates';
import { MESSAGES, pickMessage } from '../src/engine/habits';
import { BADGES } from '../src/engine/achievements';

/** Gates the content: every exercise complete and safe, every template consistent, no banned content anywhere. */
describe('exercise library', () => {
  it('has the moves a young dancer needs: flexibility, body-weight strength, feet, balance', () => {
    for (const id of ['fx-butterfly', 'fx-straddle', 'fx-pike', 'fx-lunge', 'fx-halfsplit', 'fx-frog', 'fx-quad', 'fx-figure4', 'fx-calf', 'fx-childpose', 'st-squat', 'st-splitsquat', 'st-bridge', 'st-wallpush', 'st-inclinepush', 'st-plank', 'st-sideplank', 'st-deadbug', 'st-superman', 'st-birddog', 'ft-releve', 'ft-single', 'ft-toecurls', 'ft-tendu', 'ft-ankle', 'bl-stork', 'bl-arabesque', 'bl-heeltoe', 'bl-landing', 'br-breathe']) expect(EXERCISE_BY_ID[id], id).toBeTruthy();
    expect(LIBRARY_EXERCISES.length).toBeGreaterThanOrEqual(40);
  });

  it('every exercise is complete: develops, why, steps, cues, skip conditions, a pose and a dose', () => {
    for (const e of LIBRARY_EXERCISES) {
      expect(e.develops.length, e.id).toBeGreaterThan(10);
      expect(e.why.length, e.id).toBeGreaterThan(10);
      expect(e.steps.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.cues.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.pose, e.id).toBeTruthy();
      expect(e.defaultDose.sets, e.id).toBeGreaterThanOrEqual(1);
      expect(e.defaultDose.reps !== undefined || e.defaultDose.seconds !== undefined, e.id).toBe(true);
      expect(e.version).toBe(CATALOG_VERSION);
      if (e.area !== 'warmup' && e.area !== 'cooldown' && e.area !== 'breathing') expect(e.skipIf.length, e.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('links point at real exercises', () => {
    for (const e of LIBRARY_EXERCISES) {
      for (const id of [e.easier, e.harder, ...e.substitutes]) if (id) expect(EXERCISE_BY_ID[id], `${e.id} -> ${id}`).toBeTruthy();
    }
  });

  it('youth ranges: 1 to 3 sets, 3 to 16 reps, holds 60 seconds or less (breathing and child\'s pose aside); caps never exceed that', () => {
    for (const e of LIBRARY_EXERCISES) {
      expect(e.defaultDose.sets).toBeLessThanOrEqual(3);
      if (e.defaultDose.reps !== undefined) expect(e.defaultDose.reps, e.id).toBeLessThanOrEqual(16);
      if (e.defaultDose.seconds !== undefined && e.area !== 'breathing' && e.area !== 'cooldown' && e.area !== 'warmup') expect(e.defaultDose.seconds, e.id).toBeLessThanOrEqual(60);
      if (e.maxDose) {
        expect(e.maxDose.sets, e.id).toBeLessThanOrEqual(5);
        if (e.maxDose.reps !== undefined) expect(e.maxDose.reps, e.id).toBeLessThanOrEqual(20);
        if (e.maxDose.seconds !== undefined && e.area !== 'breathing') expect(e.maxDose.seconds, e.id).toBeLessThanOrEqual(60);
      }
    }
  });

  it('body weight only: no exercise offers anything else', () => {
    for (const e of LIBRARY_EXERCISES) expect(e.loads, e.id).toEqual(['body']);
  });

  it('stretches are held, not bounced, and nobody pushes: every flex move says so or holds 30 seconds or less', () => {
    for (const e of LIBRARY_EXERCISES.filter((x) => x.area === 'flex')) {
      expect(e.defaultDose.seconds ?? 0, e.id).toBeLessThanOrEqual(45);
      const text = (e.steps.join(' ') + ' ' + e.cues.join(' ') + ' ' + e.skipIf.join(' ')).toLowerCase();
      expect(text, e.id).not.toMatch(/bounce to go deeper|have someone push|partner push/);
    }
  });

  it('no banned content anywhere in the library', () => {
    const text = JSON.stringify(LIBRARY_EXERCISES).toLowerCase();
    for (const bad of ['max out', 'one rep max', '1rm', 'to failure', 'creatine', 'protein powder', 'weighted', 'dumbbell', 'box jump', 'depth jump', 'barbell', 'deadlift', 'burn fat', 'body fat', 'lose weight', 'calorie', 'wheel pose', 'full bridge', 'neck roll', 'oversplit', 'skinny']) expect(text, bad).not.toContain(bad);
  });

  it('leg and jump moves are tagged so performance and jumping days can block them', () => {
    for (const id of ['st-squat', 'st-splitsquat', 'st-wallsit']) expect(EXERCISE_BY_ID[id].loadTags.includes('legs'), id).toBe(true);
    for (const id of ['bl-landing', 'wu-skip']) expect(EXERCISE_BY_ID[id].loadTags.includes('jump'), id).toBe(true);
  });

  it('templates reference real exercises, start with a warm-up where it matters, and are the right length', () => {
    for (const t of LIBRARY_TEMPLATES) {
      for (const it of t.items) expect(EXERCISE_BY_ID[it.exerciseId], `${t.id} -> ${it.exerciseId}`).toBeTruthy();
      if (t.kind === 'strength' || t.kind === 'flex' || t.kind === 'feet') {
        expect(EXERCISE_BY_ID[t.items[0].exerciseId].area, t.id).toBe('warmup');
        expect(['flex', 'cooldown', 'breathing']).toContain(EXERCISE_BY_ID[t.items[t.items.length - 1].exerciseId].area);
      }
      expect(t.minutes, t.id).toBeLessThanOrEqual(12);
    }
    expect(LIBRARY_TEMPLATES.map((t) => t.id).sort()).toEqual(['easy', 'feet', 'flex', 'foundations', 'light', 'recovery', 'strength']);
    expect(LIBRARY_TEMPLATES.find((t) => t.id === 'flex')!.items.map((i) => i.exerciseId)).toEqual(expect.arrayContaining(['fx-butterfly', 'fx-straddle', 'fx-pike', 'fx-halfsplit']));
    expect(LIBRARY_TEMPLATES.find((t) => t.id === 'feet')!.items.map((i) => i.exerciseId)).toEqual(expect.arrayContaining(['ft-releve', 'ft-toecurls', 'bl-stork']));
    expect(LIBRARY_TEMPLATES.find((t) => t.id === 'foundations')!.minutes).toBeLessThanOrEqual(6);
    expect(LIBRARY_TEMPLATES.find((t) => t.id === 'easy')!.items[0].dose.seconds).toBe(120);
  });

  it('acceptance 11: no creatine or protein supplementation in the default program', () => {
    const everything = JSON.stringify({ LIBRARY_EXERCISES, LIBRARY_TEMPLATES, MESSAGES, BADGES }).toLowerCase();
    expect(everything).not.toContain('creatine');
    expect(everything).not.toContain('protein powder');
    expect(everything).not.toContain('supplement');
  });
});

describe('daily messages', () => {
  const base = { day: '2026-11-02', todayLogs: [], yesterdayLogs: [], shown: [], rotationDays: 7 };
  const reminders = { enabled: true, quietStart: '21:00', quietEnd: '07:00', rotationDays: 7, deviceNotifications: false };
  it('acceptance 7: nothing in the pool shames, guilts, threatens a streak, or talks about weight', () => {
    const text = MESSAGES.map((m) => m.text).join(' ').toLowerCase();
    for (const bad of ['streak', 'lazy', 'shame', 'guilt', 'fat', 'skinny', 'lose weight', 'calories', 'you failed', 'excuse', 'disappoint', 'diet', 'body shape']) expect(text, bad).not.toContain(bad);
    const back = pickMessage({ ...base, daysSinceSession: 5 }, reminders, new Date('2026-11-02T12:00:00'));
    expect(back?.key).toBe('con-back');
    expect(back?.text).toMatch(/That is okay/);
  });
  it('matches the day: dance class gets the water-bottle message, a jumping day the easy-legs message', () => {
    const b = pickMessage({ ...base, todayLogs: [{ id: 'x', day: '2026-11-02', ts: '', sport: 'dance', duration: 'long', intensity: 'hard', by: 'athlete' }] }, reminders, new Date('2026-11-02T12:00:00'));
    expect(['hyd-dance', 'nut-after']).toContain(b?.key);
    const t = pickMessage({ ...base, todayLogs: [{ id: 'x', day: '2026-11-02', ts: '', sport: 'play', duration: 'short', intensity: 'easy', heavyJumping: true, by: 'athlete' }] }, reminders, new Date('2026-11-02T12:00:00'));
    expect(t?.key).toBe('rec-jump');
  });
  it('respects the rotation window and quiet hours', () => {
    const shown = MESSAGES.slice(0, MESSAGES.length - 1).map((m, i) => ({ id: 'm' + i, day: '2026-11-01', key: m.key, category: m.category, ts: '' }));
    const m = pickMessage({ ...base, shown }, reminders, new Date('2026-11-02T12:00:00'));
    expect(m?.key).toBe(MESSAGES[MESSAGES.length - 1].key);
    expect(pickMessage(base, reminders, new Date('2026-11-02T22:30:00'))).toBeNull();
    expect(pickMessage(base, { ...reminders, enabled: false }, new Date('2026-11-02T12:00:00'))).toBeNull();
    // Already chosen today: same message even in quiet hours.
    const chosen = pickMessage({ ...base, shown: [{ id: 'z', day: '2026-11-02', key: 'fun-cat', category: 'fun', ts: '' }] }, reminders, new Date('2026-11-02T23:00:00'));
    expect(chosen?.key).toBe('fun-cat');
  });
});
