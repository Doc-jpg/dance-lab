/**
 * The quick check: a few yes-or-not-yet questions at the top of Today, picked by the time of day.
 * Deren (2026-11-08): "she has to literally be reminded all the time to go pee and feed the dogs...
 * ask her if she's used the restroom lately, if she's drank any water, if she's brushed her teeth
 * today, if the dogs need fed... tell her to take a pause and go do those things and come back."
 *
 * Nothing here is a score. A "yes" is remembered (bathroom and water for a couple of hours, the
 * rest for the day). A "not yet" turns into "go do it now, then come back".
 */
import type { Day, HabitLog, QuickCheckKey } from './types';

export interface QuickItem {
  key: QuickCheckKey;
  question: string;
  /** What to do when the answer is not yet. */
  go: string;
  /** Ask again this many minutes after the last yes. Undefined means once a day is enough. */
  repeatMin?: number;
  /** The label on the yes button, when plain "Yes" would be odd. */
  yes?: string;
}

const BATHROOM: QuickItem = { key: 'qc-bathroom', question: 'Have you gone to the bathroom in the last two hours?', go: 'Go now, before you start. The app will be right here when you get back.', repeatMin: 120 };
const DRINK: QuickItem = { key: 'qc-drink', question: 'Have you had a drink of water in the last hour or so?', go: 'Go get a glass of water and drink it. Then come back.', repeatMin: 90 };
const TEETH_AM: QuickItem = { key: 'qc-teeth-am', question: 'Have you brushed your teeth this morning?', go: 'Go brush them now (two minutes). Then come back.' };
const TEETH_PM: QuickItem = { key: 'qc-teeth-pm', question: 'Have you brushed your teeth tonight?', go: 'Go brush them now (two minutes). Then come back.' };
const DOGS_AM: QuickItem = { key: 'qc-dogs-am', question: 'Have Bear and Teddy had their breakfast?', go: 'Go feed the dogs first. They are counting on you. Then come back.' };
const DOGS_PM: QuickItem = { key: 'qc-dogs-pm', question: 'Have Bear and Teddy had their dinner?', go: 'Go feed the dogs first. They are counting on you. Then come back.' };
const READY: QuickItem = { key: 'qc-ready', question: 'Are you dressed and ready for the day (hair brushed, things packed)?', go: 'Get ready first. Then come back and do your moves.' };
const FIRST: QuickItem = { key: 'qc-first', question: 'Is there something you are supposed to do first (homework, piano practice, a chore)?', go: 'Do that first. The app will be here after.', yes: 'No, I am free' };

/** The questions worth asking right now. */
export function quickItems(now: Date = new Date()): QuickItem[] {
  const h = now.getHours();
  const items: QuickItem[] = [BATHROOM, DRINK];
  if (h >= 5 && h < 11) items.push(TEETH_AM, DOGS_AM, READY);
  if (h >= 12 && h < 20) items.push(FIRST);
  if (h >= 16 && h < 21) items.push(DOGS_PM);
  if (h >= 19 && h < 24) items.push(TEETH_PM);
  return items;
}

export type QuickState = 'pending' | 'go' | 'done';

/** For each item: done (a recent enough yes), go (she said not yet and has not come back), or pending. */
export function quickStates(items: QuickItem[], logs: HabitLog[], day: Day, now: Date = new Date()): Array<{ item: QuickItem; state: QuickState }> {
  return items.map((item) => {
    const log = logs.find((l) => l.day === day && l.habit === item.key);
    if (!log) return { item, state: 'pending' as const };
    if (!log.done) return { item, state: 'go' as const };
    if (item.repeatMin !== undefined) {
      const age = (now.getTime() - new Date(log.ts).getTime()) / 60000;
      if (age > item.repeatMin) return { item, state: 'pending' as const };
    }
    return { item, state: 'done' as const };
  });
}

export function quickOpen(states: Array<{ state: QuickState }>): boolean {
  return states.some((s) => s.state !== 'done');
}
