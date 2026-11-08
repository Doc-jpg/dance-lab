import { describe, it, expect } from 'vitest';
import { quickItems, quickStates, quickOpen } from '../src/engine/quickcheck';
import type { HabitLog } from '../src/engine/types';

const DAY = '2026-11-09';
const at = (h: number, m = 0) => new Date(`${DAY}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
const log = (habit: HabitLog['habit'], done: boolean, when: Date): HabitLog => ({ id: habit + when.toISOString(), day: DAY, habit, done, ts: when.toISOString() });

describe('the quick check', () => {
  it('asks about the bathroom and water any time, and the rest by the time of day', () => {
    expect(quickItems(at(7)).map((i) => i.key)).toEqual(['qc-bathroom', 'qc-drink', 'qc-teeth-am', 'qc-dogs-am', 'qc-ready']);
    expect(quickItems(at(14)).map((i) => i.key)).toEqual(['qc-bathroom', 'qc-drink', 'qc-first']);
    expect(quickItems(at(17, 30)).map((i) => i.key)).toEqual(['qc-bathroom', 'qc-drink', 'qc-first', 'qc-dogs-pm']);
    expect(quickItems(at(19, 30)).map((i) => i.key)).toEqual(['qc-bathroom', 'qc-drink', 'qc-first', 'qc-dogs-pm', 'qc-teeth-pm']);
    expect(quickItems(at(22)).map((i) => i.key)).toEqual(['qc-bathroom', 'qc-drink', 'qc-teeth-pm']);
  });

  it('a yes lasts the day for teeth and dogs, two hours for the bathroom, ninety minutes for water', () => {
    const logs = [log('qc-bathroom', true, at(8)), log('qc-drink', true, at(8)), log('qc-teeth-am', true, at(8)), log('qc-dogs-am', true, at(8)), log('qc-ready', true, at(8))];
    const soon = quickStates(quickItems(at(9)), logs, DAY, at(9));
    expect(soon.every((s) => s.state === 'done')).toBe(true);
    expect(quickOpen(soon)).toBe(false);
    const later = quickStates(quickItems(at(10, 30)), logs, DAY, at(10, 30));
    expect(later.find((s) => s.item.key === 'qc-bathroom')?.state).toBe('pending');
    expect(later.find((s) => s.item.key === 'qc-drink')?.state).toBe('pending');
    expect(later.find((s) => s.item.key === 'qc-teeth-am')?.state).toBe('done');
    expect(quickOpen(later)).toBe(true);
  });

  it('"not yet" becomes "go do it and come back" until she says she did', () => {
    const logs = [log('qc-dogs-pm', false, at(17))];
    const s = quickStates(quickItems(at(17, 5)), logs, DAY, at(17, 5));
    expect(s.find((x) => x.item.key === 'qc-dogs-pm')?.state).toBe('go');
    expect(s.find((x) => x.item.key === 'qc-dogs-pm')?.item.go).toMatch(/feed the dogs first/);
  });

  it('never says anything about a score, and every question is a question', () => {
    for (const i of quickItems(at(7)).concat(quickItems(at(19))))  { expect(i.question.endsWith('?')).toBe(true); expect(i.go + i.question).not.toMatch(/score|streak|lazy/i); }
  });
});
