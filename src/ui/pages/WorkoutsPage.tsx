import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAthlete, useCheckIns, useExercises, useSessions, useSettings, useSportsLogs, useStatuses, useTemplates, useToday, fmtDate } from '../hooks';
import { useMode } from '../mode';
import { readinessFor, planSession, type TodayContext } from '../../engine/today';
import { AREA_WORDS } from '../../data/exercises';
import type { Area, Exercise } from '../../engine/types';
import { Sheet } from '../components/Sheet';
import { programPhase } from '../../engine/program';

/** Sessions (templates) at the top, the whole exercise library under them, history at the bottom. */
export function WorkoutsPage() {
  const nav = useNavigate();
  const day = useToday();
  const athlete = useAthlete();
  const settings = useSettings();
  const { mode } = useMode();
  const templates = useTemplates();
  const exercises = useExercises();
  const statuses = useStatuses();
  const sessions = useSessions();
  const logs = useSportsLogs();
  const checkIns = useCheckIns();
  const [q, setQ] = useState('');
  const [area, setArea] = useState<Area | 'all'>('all');
  const [confirm, setConfirm] = useState<string | null>(null);
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const checkIn = checkIns.find((c) => c.day === day);
  const ctx: TodayContext | undefined = athlete ? { day, athlete, checkIn, logs, sessions, templates, exercises: exMap, statuses, strengthDaysPerWeek: settings.strengthDaysPerWeek } : undefined;
  const readiness = ctx && templates.length ? readinessFor(ctx) : undefined;
  if (!athlete || !ctx) return null;
  const phase = programPhase(athlete.programStart, day);

  const startTemplate = async (id: string) => {
    if (!checkIn) { nav('/today'); return; }
    if (!readiness) return;
    const s = await planSession(id, readiness, ctx, mode);
    nav(`/workout/${s.id}`);
  };
  const pick = (id: string) => {
    if (!checkIn) { nav('/today'); return; }
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (readiness?.color === 'red' && id !== 'easy') { setConfirm('red'); return; }
    if (readiness?.offer?.templateId !== id && t.kind !== 'foundations' && t.kind !== 'recovery' && t.kind !== 'light') setConfirm(id);
    else startTemplate(id);
  };

  const visible = exercises.filter((e) => !e.archived && (area === 'all' || e.area === area) && (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.develops.toLowerCase().includes(q.toLowerCase())));
  const byArea = new Map<Area, Exercise[]>();
  for (const e of visible) byArea.set(e.area, [...(byArea.get(e.area) ?? []), e]);
  const history = sessions.filter((s) => s.status !== 'planned').slice(0, 30);

  return (
    <div className="col">
      <h1>Workouts</h1>
      <div className="small muted">{phase.label}, week {phase.week} of the program. {phase.text}</div>
      <div className="list" data-tour="templates">
        {templates.filter((t) => !t.archived).map((t) => (
          <button key={t.id} className="item tappable" onClick={() => pick(t.id)} style={readiness?.offer?.templateId === t.id ? { borderColor: 'var(--accent)' } : undefined}>
            <div className="grow"><div className="title">{t.name} <span className="small muted">· {t.minutes} min</span></div><div className="sub">{t.summary}</div></div>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
      <p className="small muted">The one with the colored edge is today's recommendation. Picking a different one is allowed; the app will say what it thinks first.</p>

      <div className="section-title"><h2>Every exercise</h2><span className="small muted">{exercises.filter((e) => !e.archived).length}</span></div>
      <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button className={`chip sm ${area === 'all' ? 'on' : ''}`} onClick={() => setArea('all')}>All</button>
        {(Object.keys(AREA_WORDS) as Area[]).map((a) => <button key={a} className={`chip sm ${area === a ? 'on' : ''}`} onClick={() => setArea(a)}>{AREA_WORDS[a]}</button>)}
      </div>
      {[...byArea.entries()].map(([a, list]) => (
        <div key={a} className="section">
          <h3>{AREA_WORDS[a]}</h3>
          <div className="list mt">
            {list.map((e) => (
              <Link key={e.id} className="item tappable" to={`/exercises/${e.id}`}>
                <div className="grow"><div className="title">{e.name}</div><div className="sub">{e.develops}</div></div>
                <span className="pill">{e.level}</span>
                {statuses.get(e.id)?.formCheckedAt && <span className="pill green">checked</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="section-title"><h2>History</h2></div>
      {history.length === 0 ? <div className="empty">No sessions yet.</div> : (
        <div className="list">{history.map((s) => <Link key={s.id} className="item tappable" to={`/sessions/${s.id}`}><div className="grow"><div className="title">{s.templateName}</div><div className="sub">{fmtDate(s.day)} · {s.status === 'done' ? `${s.items.filter((i) => i.sets.some((x) => x.done)).length} exercises` : s.status}</div></div><span className="chev">›</span></Link>)}</div>
      )}

      {confirm === 'red' && <Sheet title="Not today" onClose={() => setConfirm(null)}><p>Your check-in says something hurts, you feel sick, or you are dizzy. No workout today; the Easy day (two minutes of breathing) is the one thing to do, and it counts. Tell a grown-up how you feel; tomorrow is a new check-in.</p></Sheet>}
      {confirm && confirm !== 'red' && (
        <Sheet title="Different from the recommendation" onClose={() => setConfirm(null)} footer={<><button className="btn" onClick={() => setConfirm(null)}>Go with the recommendation</button><button className="btn primary" onClick={() => { const id = confirm; setConfirm(null); startTemplate(id); }}>Do it anyway</button></>}>
          <p>Today the app suggests <strong>{readiness?.offer?.name ?? 'the easy day'}</strong>. Reasons:</p>
          <ul className="why">{readiness?.reasons.map((r, i) => <li key={i}>{r}</li>)}{readiness?.blockedWhy.map((r, i) => <li key={'b' + i}>{r}</li>)}</ul>
          <p className="small muted">If you go ahead, moves that work a part of the body the app wants to rest are still swapped out. Good form first, always.</p>
        </Sheet>
      )}
    </div>
  );
}
