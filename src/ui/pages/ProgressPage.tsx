import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAchievements, useAthlete, useCheckIns, useExerciseMap, useJournal, useSessions, useSportsLogs, useToday, fmtDate } from '../hooks';
import { useMode } from '../mode';
import { Spark, Bars } from '../components/Charts';
import { BADGES, weekStartOf } from '../../engine/achievements';
import { addDays, type Day } from '../../engine/types';
import { programPhase } from '../../engine/program';
import { Sheet } from '../components/Sheet';
import { SportRow } from './TodayPage';
import { COLOR_WORDS } from '../../engine/readiness';

/** Progress against her own earlier self: sessions, consistency, key exercises, badges, and a calendar. No comparison with anyone else, no body measurements. */
export function ProgressPage() {
  const day = useToday();
  const athlete = useAthlete();
  const sessions = useSessions();
  const logs = useSportsLogs();
  const checkIns = useCheckIns();
  const achievements = useAchievements();
  const exercises = useExerciseMap();
  const { mode } = useMode();
  const journal = useJournal(mode === 'athlete');
  const [pick, setPick] = useState<Day | null>(null);
  const [exId, setExId] = useState('bl-stork');
  const done = sessions.filter((s) => s.status === 'done');
  const workouts = done.filter((s) => s.kind !== 'foundations' && s.kind !== 'recovery');

  // Sessions per week, last 8 weeks.
  const weeks = useMemo(() => {
    const ws = weekStartOf(day);
    return Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i)));
  }, [day]);
  const perWeek = weeks.map((w) => sessions.filter((s) => s.day >= w && s.day <= addDays(w, 6)).length);
  const foundationsPerWeek = weeks.map((w) => done.filter((s) => s.kind === 'foundations' && s.day >= w && s.day <= addDays(w, 6)).length);

  // Key exercise trend.
  const tracked = ['bl-stork', 'st-plank', 'st-wallpush', 'st-inclinepush', 'st-squat', 'st-bridge', 'ft-releve', 'ft-single', 'bl-arabesque', 'st-wallsit', 'st-sideplank', 'fx-pike', 'fx-straddle'].filter((id) => done.some((s) => s.items.some((i) => i.exerciseId === id && i.sets.some((x) => x.done))));
  const trend = done.filter((s) => s.items.some((i) => i.exerciseId === exId && i.sets.some((x) => x.done))).sort((a, b) => a.day.localeCompare(b.day)).map((s) => { const it = s.items.find((i) => i.exerciseId === exId)!; const d = it.sets.filter((x) => x.done); return { day: s.day, v: it.planned.seconds !== undefined ? Math.max(...d.map((x) => x.seconds ?? 0)) : d.reduce((a, x) => a + (x.reps ?? 0), 0), unit: it.planned.seconds !== undefined ? 'best hold (sec)' : 'total reps' }; });

  const bestHold = (id: string) => Math.max(0, ...done.flatMap((s) => s.items.filter((i) => i.exerciseId === id).flatMap((i) => i.sets.filter((x) => x.done).map((x) => x.seconds ?? 0))));
  const bestBalance = bestHold('bl-stork');
  const bestPlank = bestHold('st-plank');
  const recoveryDays = checkIns.filter((c) => c.color === 'orange' || c.color === 'red').length;

  // Calendar: current month.
  const monthStart = day.slice(0, 8) + '01';
  const first = new Date(monthStart + 'T12:00:00');
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = first.getDay(); // Sunday first
  const cells: Array<Day | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i))];
  const marks = (d: Day) => ({ w: sessions.some((s) => s.day === d), f: done.some((s) => s.day === d && s.kind === 'foundations'), s: logs.some((l) => l.day === d), j: journal.some((j) => j.day === d) });
  const phase = athlete ? programPhase(athlete.programStart, day) : undefined;

  return (
    <div className="col">
      <h1>Progress</h1>
      <div className="small muted">You only ever get compared with the old you, never with anyone else. {phase ? `Week ${phase.week}: ${phase.label.toLowerCase()}.` : ''}</div>
      <div className="kpi">
        <div className="k"><div className="v">{workouts.length}</div><div className="l">Workouts</div></div>
        <div className="k"><div className="v">{done.filter((s) => s.kind === 'foundations').length}</div><div className="l">Daily 5s</div></div>
        <div className="k"><div className="v">{bestBalance ? `${bestBalance}s` : '–'}</div><div className="l">Longest stork balance</div></div>
        <div className="k"><div className="v">{bestPlank ? `${bestPlank}s` : '–'}</div><div className="l">Longest plank</div></div>
        <div className="k"><div className="v">{recoveryDays}</div><div className="l">Rest days you chose</div></div>
        <div className="k"><div className="v">{achievements.length}</div><div className="l">Badges</div></div>
      </div>

      <div className="card">
        <h3>Workouts each week (the last 8 weeks)</h3>
        <Bars values={perWeek} labels={weeks.map((w) => fmtDate(w).replace(/^\w+,? /, ''))} max={4} />
        <div className="small muted">Daily 5s each week: {foundationsPerWeek.join(' · ')}</div>
      </div>

      {tracked.length > 0 && (
        <div className="card">
          <h3>One exercise over time</h3>
          <div className="chips mt">{tracked.map((id) => <button key={id} className={`chip sm ${exId === id ? 'on' : ''}`} onClick={() => setExId(id)}>{exercises.get(id)?.name ?? id}</button>)}</div>
          {trend.length ? <><div className="small muted mt">{trend[0].unit}</div><Spark values={trend.map((t) => t.v)} labels={trend.map((t) => fmtDate(t.day).replace(/^\w+,? /, ''))} /></> : <div className="small muted mt">Pick an exercise.</div>}
        </div>
      )}

      <div className="card">
        <div className="row between"><h3>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><span className="tiny muted">● workout · ● dance or play · ● note · ● Daily 5ations</span></div>
        <div className="cal mt">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((h, i) => <div key={i} className="h">{h}</div>)}
          {cells.map((d, i) => d ? (() => { const m = marks(d); const has = m.w || m.f || m.s || m.j; return <button key={i} className={`d ${has ? 'has' : ''} ${d === day ? 'today' : ''}`} onClick={() => setPick(d)}><span>{Number(d.slice(8))}</span><span className="marks">{m.w && <i className="w" />}{m.s && <i className="s" />}{m.j && <i className="j" />}{m.f && <i className="f" />}</span></button>; })() : <div key={i} />)}
        </div>
      </div>

      <div className="card">
        <h3>Badges</h3>
        <div className="list mt">
          {BADGES.map((b) => { const a = achievements.find((x) => x.key === b.key); return <div key={b.key} className={`badge ${a ? '' : 'locked'}`}><div className="medal">{a ? '★' : '·'}</div><div className="grow"><div><strong>{b.title}</strong></div><div className="small muted">{b.text}{a ? ` · ${fmtDate(a.earnedAt.slice(0, 10))}` : ''}</div></div></div>; })}
        </div>
        <p className="small muted mt">Once you earn a badge, it is yours forever. Missing a day changes nothing here.</p>
      </div>

      {pick && (
        <Sheet title={fmtDate(pick)} onClose={() => setPick(null)}>
          {(() => {
            const ss = sessions.filter((s) => s.day === pick && s.status !== 'planned');
            const ls = logs.filter((l) => l.day === pick);
            const js = journal.filter((j) => j.day === pick);
            const c = checkIns.find((x) => x.day === pick);
            if (!ss.length && !ls.length && !js.length && !c) return <div className="small muted">Nothing logged.</div>;
            return (
              <div className="list">
                {c && <div className="item"><div className="grow"><div className="title">Check-in: {COLOR_WORDS[c.color]} day</div><div className="sub">Energy {c.energy}/5 · Sleep {c.sleep}/5{c.note ? ` · "${c.note}"` : ''}</div></div></div>}
                {ss.map((s) => <Link key={s.id} className="item tappable" to={`/sessions/${s.id}`} onClick={() => setPick(null)}><div className="grow"><div className="title">{s.templateName}</div><div className="sub">{s.status}{s.note ? ` · "${s.note}"` : ''}</div></div><span className="chev">›</span></Link>)}
                {ls.map((l) => <SportRow key={l.id} log={l} />)}
                {js.map((j) => <div key={j.id} className="item"><div className="grow"><div className="sub">Note{j.isPrivate ? ' (private)' : ''}</div><div>{j.text}</div></div></div>)}
              </div>
            );
          })()}
        </Sheet>
      )}
    </div>
  );
}
