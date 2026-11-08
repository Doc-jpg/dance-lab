import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAthlete, useCheckIns, useExerciseMap, useHabits, useMissions, useSessions, useSettings, useSportsLogs, useStatuses, useTemplates, useToday } from '../hooks';
import { useMode } from '../mode';
import { setHabit } from '../../db/db';
import { refreshRewards, readinessFor, planSession } from '../../engine/today';
import { weekStartOf } from '../../engine/achievements';
import type { HabitKey } from '../../engine/types';

const HABITS: Array<{ key: HabitKey; title: string; text: string }> = [
  { key: 'water', title: 'Water', text: 'A glass when you wake up, one with every meal, the bottle in the dance bag.' },
  { key: 'meal', title: 'Real meals', text: 'Breakfast, lunch and dinner with something filling in each one. No skipping breakfast.' },
  { key: 'fruitveg', title: 'Fruit and vegetables', text: 'At least one of each today.' },
  { key: 'sleep', title: 'Good sleep plan', text: 'Screens off a bit early, bed at a time that gives 9 to 11 hours.' },
  { key: 'play', title: 'Normal play', text: 'Bikes, tag, climbing, cartwheels in the yard, dancing in the kitchen. Counts for a lot.' },
  { key: 'dogs', title: 'Fed Bear and Teddy', text: 'Breakfast and dinner, without being asked.' }
];

/** The Five-minute mini workout, the everyday habits, this week's missions, and the healthy-habits notes. No calories, no weight, nothing about shape. */
export function HabitsPage() {
  const nav = useNavigate();
  const day = useToday();
  const athlete = useAthlete();
  const settings = useSettings();
  const { mode } = useMode();
  const habits = useHabits();
  const missions = useMissions();
  const sessions = useSessions();
  const logs = useSportsLogs();
  const checkIns = useCheckIns();
  const templates = useTemplates();
  const exercises = useExerciseMap();
  const statuses = useStatuses();
  useEffect(() => { refreshRewards(day).catch(() => undefined); }, [day]);
  const today = habits.filter((h) => h.day === day);
  const isOn = (k: HabitKey) => today.some((h) => h.habit === k && h.done);
  const ws = weekStartOf(day);
  const thisWeek = missions.filter((m) => m.weekStart === ws);
  const foundationsDone = sessions.some((s) => s.day === day && s.kind === 'foundations' && s.status === 'done');
  const checkIn = checkIns.find((c) => c.day === day);
  const readiness = useMemo(() => (athlete && templates.length ? readinessFor({ day, athlete, checkIn, logs, sessions, templates, exercises, statuses, strengthDaysPerWeek: settings.strengthDaysPerWeek }) : undefined), [athlete, day, checkIn, logs, sessions, templates, exercises, statuses, settings.strengthDaysPerWeek]);

  const toggle = async (k: HabitKey) => { await setHabit(day, k, !isOn(k)); await refreshRewards(day); };
  const doFoundations = async () => {
    if (!athlete || !readiness) return;
    if (!checkIn) { nav('/today'); return; }
    const s = await planSession('foundations', readiness, { day, athlete, checkIn, logs, sessions, templates, exercises, statuses, strengthDaysPerWeek: settings.strengthDaysPerWeek }, mode);
    nav(`/workout/${s.id}`);
  };

  return (
    <div className="col">
      <h1>Habits</h1>
      <div className="card row between">
        <div className="grow"><strong>Five-minute mini workout</strong><div className="small muted">Balloon breathing, cat and cow, starfish, ankle rocks, butterfly, stork. About 5 minutes. It is small and easy, so it is fine on top of anything else. Skip it when you are sick, hurt or wiped out.</div></div>
        {foundationsDone ? <span className="pill green">Done</span> : readiness?.foundations === 'no' ? <span className="pill red">Not today</span> : <button className="btn primary" onClick={doFoundations}>Do it</button>}
      </div>

      <h3>Good things you did today (tap them)</h3>
      <div className="list">
        {HABITS.map((h) => <button key={h.key} className={`habit-row ${isOn(h.key) ? 'on' : ''}`} onClick={() => toggle(h.key)}><div className="box">{isOn(h.key) ? '✓' : ''}</div><div className="grow"><div><strong>{h.title}</strong></div><div className="small muted">{h.text}</div></div></button>)}
      </div>
      <p className="small muted">Tapping these is just for you. It is not a score. Nothing bad happens on a day you miss.</p>

      <h3>This week's missions (little challenges)</h3>
      <div className="list">
        {thisWeek.length === 0 && <div className="small muted">Missions show up after you answer the questions for the first time this week.</div>}
        {thisWeek.map((m) => <div key={m.id} className="card mission"><div className="row between"><strong>{m.title}</strong>{m.doneAt ? <span className="pill green">Done</span> : <span className="small muted">{m.progress} of {m.target}</span>}</div><div className="small muted">{m.text}</div><div className="bar"><div style={{ width: `${Math.round((100 * m.progress) / m.target)}%` }} /></div></div>)}
      </div>
      <p className="small muted">You get three new ones every Sunday. Missions you did not finish just go away. Nothing is lost.</p>

      <div className="card">
        <h3>Food, water and sleep: the short version</h3>
        <ul className="step-list small">
          <li><strong>Water first.</strong> Plain water is perfect. Sports drinks only after more than an hour of hard work or when it is really hot. Energy drinks, never.</li>
          <li><strong>Real food.</strong> Eggs, milk, yogurt, chicken, beans, peanut butter, rice, pasta, potatoes, fruit, vegetables. Growing dancers eat. This app never tells you to eat less of anything.</li>
          <li><strong>Food is fuel for dancing.</strong> A snack before class and a real dinner after.</li>
          <li><strong>Sleep is when you get stronger and stretchier.</strong> 9 to 11 hours a night at your age. If you did not sleep much, the app gives you a yellow (easier) day.</li>
          <li><strong>No diets, no weighing, no mirror talk.</strong> This app never asks about your weight or how you look. That is on purpose.</li>
        </ul>
      </div>
    </div>
  );
}
