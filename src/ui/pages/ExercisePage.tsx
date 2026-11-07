import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useExercise, useExerciseMap, useSessions, useStatuses, fmtDate } from '../hooks';
import { Figure } from '../components/Figure';
import { Watch } from '../components/Watch';
import { useMode } from '../mode';
import { AREA_WORDS } from '../../data/exercises';
import { doseText } from '../../engine/program';
import { Spark } from '../components/Charts';

/** One exercise: what it builds, why it matters, how to do it, mistakes, when to skip, versions, and Vivi's own history with it. */
export function ExercisePage() {
  const { exerciseId } = useParams();
  const e = useExercise(exerciseId);
  const all = useExerciseMap();
  const statuses = useStatuses();
  const sessions = useSessions();
  const { mode } = useMode();
  if (!e) return <div className="empty">Loading…</div>;
  const status = statuses.get(e.id);
  const history = sessions.filter((s) => s.status === 'done').flatMap((s) => s.items.filter((i) => i.exerciseId === e.id && i.sets.some((x) => x.done)).map((i) => ({ day: s.day, item: i }))).sort((a, b) => a.day.localeCompare(b.day));
  const series = history.map((h) => { const done = h.item.sets.filter((x) => x.done); return h.item.planned.seconds !== undefined ? Math.max(...done.map((x) => x.seconds ?? 0)) : done.reduce((s, x) => s + (x.reps ?? 0), 0); });
  const unit = e.defaultDose.seconds !== undefined ? 'best hold (sec)' : 'total reps';
  return (
    <div className="col">
      <div className="row between"><Link className="btn sm" to="/workouts">‹ Workouts</Link><span className="pill">{AREA_WORDS[e.area]} · {e.level}</span></div>
      <div className="card">
        <h1>{e.name}</h1>
        <div className="small muted">Usual dose {doseText(e.defaultDose)}{e.maxDose ? ` · the app never goes past ${e.maxDose.sets} sets${e.maxDose.reps ? ` of ${e.maxDose.reps}` : e.maxDose.seconds ? ` of ${e.maxDose.seconds} sec` : ''}` : ''}</div>
        <Figure pose={e.pose} />
        <p><strong>Builds:</strong> {e.develops}</p>
        <p><strong>Why it matters:</strong> {e.why}</p>
      </div>
      <Watch exerciseId={e.id} who={mode} asCard />
      <div className="card">
        <h3>How to do it</h3>
        <ol className="step-list">{e.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <div className="chips">{e.cues.map((c) => <span key={c} className="cue">{c}</span>)}</div>
      </div>
      {e.commonErrors.length > 0 && <div className="card"><h3>Common mistakes</h3><ul className="step-list">{e.commonErrors.map((x, i) => <li key={i}><strong>{x.error}.</strong> {x.fix}</li>)}</ul></div>}
      <div className="card"><h3>Skip it when</h3><ul className="step-list">{e.skipIf.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
      <div className="card">
        <h3>Versions</h3>
        <div className="list mt">
          {e.easier && all.get(e.easier) && <Link className="item tappable" to={`/exercises/${e.easier}`}><div className="grow"><div className="title">{all.get(e.easier)!.name}</div><div className="sub">Easier</div></div><span className="chev">›</span></Link>}
          {e.harder && all.get(e.harder) && <Link className="item tappable" to={`/exercises/${e.harder}`}><div className="grow"><div className="title">{all.get(e.harder)!.name}</div><div className="sub">Harder{all.get(e.harder)!.needsFormCheck ? ' · a grown-up watches it first' : ''}</div></div><span className="chev">›</span></Link>}
          {e.substitutes.map((id) => all.get(id) && <Link key={id} className="item tappable" to={`/exercises/${id}`}><div className="grow"><div className="title">{all.get(id)!.name}</div><div className="sub">Can stand in for it</div></div><span className="chev">›</span></Link>)}
        </div>
        {e.needsFormCheck && <p className="small">{status?.formCheckedAt ? `Watched by ${status.formCheckedBy ?? 'a parent'} on ${fmtDate(status.formCheckedAt.slice(0, 10))}.` : 'A grown-up should watch the first few before it goes into a session.'}</p>}
      </div>
      <div className="card">
        <h3>Your history</h3>
        {history.length === 0 ? <div className="small muted mt">Not done yet.</div> : (
          <>
            <div className="small muted mt">{history.length} session{history.length === 1 ? '' : 's'} · {unit}</div>
            <Spark values={series} labels={history.map((h) => fmtDate(h.day))} />
            <div className="list mt">{history.slice(-5).reverse().map((h, i) => <div key={i} className="item"><div className="grow"><div className="title">{fmtDate(h.day)}</div><div className="sub">{h.item.sets.filter((x) => x.done).map((x) => (x.seconds !== undefined ? `${x.seconds}s` : `${x.reps}`)).join(' · ')}{h.item.feltGood === false ? ' · did not feel great' : ''}{h.item.note ? ` · "${h.item.note}"` : ''}</div></div></div>)}</div>
          </>
        )}
      </div>
    </div>
  );
}
