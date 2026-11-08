/**
 * The days. Short, because she is nine and the point is every day, not a long day.
 *   Stretch and reach (flexibility, 12 min)   Strong and steady (bodyweight strength + core, 12 min)
 *   Happy feet (feet, ankles, balance, 10 min) Five-minute mini workout (five easy minutes, any day)
 *   Short gentle workout (after a dance day, 8 min)    Five-minute stretch (after a big day)   Just breathing (red day: breathing)
 */
import type { WorkoutTemplate } from '../engine/types';

export const TEMPLATES_VERSION = 1;
const TS = '2026-11-07T00:00:00.000Z';

const t = (x: Omit<WorkoutTemplate, 'source' | 'version' | 'createdAt' | 'updatedAt'>): WorkoutTemplate => ({ ...x, source: 'library', version: TEMPLATES_VERSION, createdAt: TS, updatedAt: TS });

export const LIBRARY_TEMPLATES: WorkoutTemplate[] = [
  t({
    id: 'flex',
    name: 'Stretch and reach',
    kind: 'flex',
    minutes: 12,
    summary: 'Warm up, then the big stretches: butterfly, straddle, pike, low lunge, half split, frog, figure four, open the book, child\'s pose. Slow holds, no bouncing. About 12 minutes.',
    items: [
      { exerciseId: 'wu-march', dose: { sets: 1, seconds: 60 } },
      { exerciseId: 'wu-catcow', dose: { sets: 1, reps: 8 } },
      { exerciseId: 'wu-inchworm', dose: { sets: 1, reps: 4 } },
      { exerciseId: 'fx-butterfly', dose: { sets: 1, seconds: 30 } },
      { exerciseId: 'fx-straddle', dose: { sets: 1, seconds: 30 } },
      { exerciseId: 'fx-pike', dose: { sets: 1, seconds: 30 } },
      { exerciseId: 'fx-lunge', dose: { sets: 1, seconds: 25, perSide: true } },
      { exerciseId: 'fx-halfsplit', dose: { sets: 1, seconds: 25, perSide: true } },
      { exerciseId: 'fx-frog', dose: { sets: 1, seconds: 30 }, optional: true },
      { exerciseId: 'fx-figure4', dose: { sets: 1, seconds: 25, perSide: true } },
      { exerciseId: 'fx-thoracic', dose: { sets: 1, reps: 6, perSide: true } },
      { exerciseId: 'fx-childpose', dose: { sets: 1, seconds: 45 } }
    ]
  }),
  t({
    id: 'strength',
    name: 'Strong and steady',
    kind: 'strength',
    minutes: 12,
    summary: 'Squats, split squats, bridges, wall push-ups, plank, dead bugs, superman, a bear crawl, then a quick stretch. No weights, just your own body. About 12 minutes.',
    items: [
      { exerciseId: 'wu-march', dose: { sets: 1, seconds: 60 } },
      { exerciseId: 'wu-skip', dose: { sets: 1, seconds: 45 } },
      { exerciseId: 'st-squat', dose: { sets: 2, reps: 8, repsMax: 12 } },
      { exerciseId: 'st-splitsquat', dose: { sets: 2, reps: 6, repsMax: 10, perSide: true } },
      { exerciseId: 'st-bridge', dose: { sets: 2, reps: 8, repsMax: 12 } },
      { exerciseId: 'st-wallpush', dose: { sets: 2, reps: 8, repsMax: 12 } },
      { exerciseId: 'st-plank', dose: { sets: 2, seconds: 20 } },
      { exerciseId: 'st-deadbug', dose: { sets: 2, reps: 6, perSide: true } },
      { exerciseId: 'st-superman', dose: { sets: 2, seconds: 10 } },
      { exerciseId: 'st-bearcrawl', dose: { sets: 1, seconds: 20 }, optional: true },
      { exerciseId: 'fx-quad', dose: { sets: 1, seconds: 20, perSide: true } },
      { exerciseId: 'fx-childpose', dose: { sets: 1, seconds: 30 } }
    ]
  }),
  t({
    id: 'feet',
    name: 'Happy feet',
    kind: 'feet',
    minutes: 10,
    summary: 'Relevés, one-foot relevés, towel scrunches, point and flex, ankle rocks, stork balance, arabesque hold, tightrope walk, soft landings. About 10 minutes.',
    items: [
      { exerciseId: 'wu-march', dose: { sets: 1, seconds: 45 } },
      { exerciseId: 'ft-ankle', dose: { sets: 1, reps: 10, perSide: true } },
      { exerciseId: 'ft-tendu', dose: { sets: 1, reps: 10 } },
      { exerciseId: 'ft-releve', dose: { sets: 2, reps: 10, repsMax: 16 } },
      { exerciseId: 'ft-single', dose: { sets: 1, reps: 6, repsMax: 10, perSide: true } },
      { exerciseId: 'ft-toecurls', dose: { sets: 1, reps: 10, perSide: true } },
      { exerciseId: 'bl-stork', dose: { sets: 1, seconds: 15, perSide: true } },
      { exerciseId: 'bl-arabesque', dose: { sets: 1, seconds: 10, perSide: true } },
      { exerciseId: 'bl-heeltoe', dose: { sets: 1, seconds: 30 } },
      { exerciseId: 'bl-landing', dose: { sets: 2, reps: 5 }, optional: true },
      { exerciseId: 'fx-calf', dose: { sets: 1, seconds: 25, perSide: true } }
    ]
  }),
  t({
    id: 'foundations',
    name: 'Five-minute mini workout',
    kind: 'foundations',
    minutes: 5,
    summary: 'Five easy minutes any day: balloon breathing, cat and cow, starfish, ankle rocks, butterfly, stork. On top of whatever else.',
    items: [
      { exerciseId: 'br-breathe', dose: { sets: 1, seconds: 45 } },
      { exerciseId: 'wu-catcow', dose: { sets: 1, reps: 6 } },
      { exerciseId: 'bl-starfish', dose: { sets: 1, reps: 6 } },
      { exerciseId: 'ft-ankle', dose: { sets: 1, reps: 6, perSide: true } },
      { exerciseId: 'fx-butterfly', dose: { sets: 1, seconds: 20 } },
      { exerciseId: 'bl-stork', dose: { sets: 1, seconds: 10, perSide: true } }
    ]
  }),
  t({
    id: 'light',
    name: 'Short gentle workout',
    kind: 'light',
    minutes: 8,
    summary: 'For a dance-class day: a short warm-up, the gentle stretches, a little balance, breathing. About 8 minutes.',
    items: [
      { exerciseId: 'wu-march', dose: { sets: 1, seconds: 45 } },
      { exerciseId: 'wu-catcow', dose: { sets: 1, reps: 6 } },
      { exerciseId: 'fx-butterfly', dose: { sets: 1, seconds: 25 } },
      { exerciseId: 'fx-pike', dose: { sets: 1, seconds: 25 } },
      { exerciseId: 'fx-figure4', dose: { sets: 1, seconds: 20, perSide: true } },
      { exerciseId: 'fx-thoracic', dose: { sets: 1, reps: 5, perSide: true } },
      { exerciseId: 'bl-stork', dose: { sets: 1, seconds: 10, perSide: true } },
      { exerciseId: 'fx-childpose', dose: { sets: 1, seconds: 30 } },
      { exerciseId: 'br-breathe', dose: { sets: 1, seconds: 60 } }
    ]
  }),
  t({
    id: 'recovery',
    name: 'Five-minute stretch',
    kind: 'recovery',
    minutes: 5,
    summary: 'After a recital, a competition or a very long dance day, this is the whole workout: breathing, cat and cow, pike, calves, child\'s pose. Five minutes, then you are done.',
    items: [
      { exerciseId: 'br-breathe', dose: { sets: 1, seconds: 45 } },
      { exerciseId: 'wu-catcow', dose: { sets: 1, reps: 6 } },
      { exerciseId: 'fx-pike', dose: { sets: 1, seconds: 25 } },
      { exerciseId: 'fx-calf', dose: { sets: 1, seconds: 20, perSide: true } },
      { exerciseId: 'fx-childpose', dose: { sets: 1, seconds: 40 } }
    ]
  }),
  t({
    id: 'easy',
    name: 'Just breathing',
    kind: 'recovery',
    minutes: 3,
    summary: 'For a day when something hurts or you feel sick: two minutes of balloon breathing and, if it feels fine, a slow walk around the house. That counts as your day. Tell a grown-up how you feel.',
    items: [
      { exerciseId: 'br-breathe', dose: { sets: 1, seconds: 120 } },
      { exerciseId: 'cd-walk', dose: { sets: 1, seconds: 60 }, optional: true }
    ]
  })
];

export const TEMPLATE_BY_ID: Record<string, WorkoutTemplate> = Object.fromEntries(LIBRARY_TEMPLATES.map((t) => [t.id, t]));
