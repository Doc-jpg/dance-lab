import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAthlete, useExerciseMap, useSession, useSessions, useStatuses, fmtClock } from '../hooks';
import { useMode } from '../mode';
import { Figure } from '../components/Figure';
import { Watch } from '../components/Watch';
import { useClips } from '../hooks';
import { Sheet, useToast } from '../components/Sheet';
import { updateSession } from '../../db/db';
import { finishSession } from '../../engine/today';
import { doseText } from '../../engine/program';
import type { Exercise, Session, SessionItem, SetLog } from '../../engine/types';
import { nowIso } from '../../engine/types';

/**
 * The workout player. One exercise at a time, big buttons, one tap per set, optional rest timer,
 * easier/harder swaps, pause and resume, a quick note, and a Stop that takes pain seriously.
 * Live state is saved on every change so a closed app reopens exactly here.
 */
export function WorkoutPage() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const session = useSession(sessionId);
  const sessions = useSessions();
  const exercises = useExerciseMap();
  const statuses = useStatuses();
  const athlete = useAthlete();
  const { mode } = useMode();
  const toast = useToast();
  const [index, setIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [hold, setHold] = useState<{ setIdx: number; left: number } | null>(null);
  const [stopOpen, setStopOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [watchOpen, setWatchOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [repsAdj, setRepsAdj] = useState<number | null>(null);
  const started = useRef(false);

  // Resume where we were.
  useEffect(() => {
    if (!session || started.current) return;
    started.current = true;
    const live = session.live;
    setIndex(live?.index ?? 0);
    setPaused(live?.paused ?? false);
    setElapsed(live?.elapsedSec ?? 0);
    if (session.status === 'planned') updateSession(session.id, { status: 'in_progress', startedAt: nowIso(), live: { index: 0, paused: false, elapsedSec: 0 } });
  }, [session?.id]);

  // Session clock.
  useEffect(() => {
    if (paused || index === null) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [paused, index]);
  // Rest and hold countdowns.
  useEffect(() => {
    if (rest === null || paused) return;
    if (rest <= 0) { setRest(null); return; }
    const t = window.setTimeout(() => setRest(rest - 1), 1000);
    return () => window.clearTimeout(t);
  }, [rest, paused]);
  useEffect(() => {
    if (!hold || paused) return;
    if (hold.left <= 0) { try { (navigator as any).vibrate?.([120, 80, 120]); } catch { /* ignore */ } completeSet(hold.setIdx, { seconds: current?.planned.seconds }); setHold(null); return; }
    const t = window.setTimeout(() => setHold({ ...hold, left: hold.left - 1 }), 1000);
    return () => window.clearTimeout(t);
  }, [hold, paused]);
  // Save live state.
  useEffect(() => {
    if (!session || index === null) return;
    const t = window.setTimeout(() => updateSession(session.id, { live: { index, paused, elapsedSec: elapsed } }), 400);
    return () => window.clearTimeout(t);
  }, [index, paused, elapsed]);

  const current: SessionItem | undefined = session && index !== null ? session.items[index] : undefined;
  const exercise: Exercise | undefined = current ? exercises.get(current.exerciseId) : undefined;
  const clips = useClips(exercise?.id);
  useEffect(() => { if (exercise) { setRepsAdj(null); setHold(null); } }, [exercise?.id]);

  // After the last set of an item: flash Done, then move on by itself (not on the last item).
  const itemDone = (() => { if (!session || index === null) return false; const it = session.items[index]; if (!it) return false; const need = it.planned.sets * (it.planned.perSide ? 2 : 1); return it.sets.filter((x) => x?.done).length >= need; })();
  const isLastItem = !!session && index !== null && index === session.items.length - 1;
  useEffect(() => {
    if (!itemDone || rest !== null || hold || isLastItem || index === null) return;
    setFlash(true);
    const t = window.setTimeout(() => { setFlash(false); setIndex(index + 1); }, 1400);
    return () => window.clearTimeout(t);
  }, [itemDone, rest, hold, isLastItem, index]);

  if (!session || !athlete || index === null) return <div className="empty">Opening…</div>;
  if (session.status === 'done' || session.status === 'stopped' || session.status === 'skipped') return <div className="col"><div className="card"><strong>This session is finished.</strong></div><Link className="btn primary block" to={`/sessions/${session.id}`}>See the summary</Link></div>;
  if (!current || !exercise) return <div className="col"><div className="card">Nothing to do in this session.</div><button className="btn primary block" onClick={() => setFinishOpen(true)}>Finish</button>{finishOpen && <FinishSheet session={session} onClose={() => setFinishOpen(false)} />}</div>;

  const planned = current.planned;
  const sets: SetLog[] = current.sets;
  const totalSets = planned.sets * (planned.perSide ? 2 : 1);
  const doneCount = sets.filter((s) => s.done).length;
  const allDone = doneCount >= totalSets;

  async function patchItem(i: number, patch: Partial<SessionItem>) {
    if (!session) return;
    const items = session.items.map((it, j) => (j === i ? { ...it, ...patch } : it));
    await updateSession(session.id, { items });
  }
  async function completeSet(setIdx: number, extra: Partial<SetLog> = {}) {
    if (!session || index === null) return;
    const it = session.items[index];
    const next = [...it.sets];
    next[setIdx] = { reps: it.planned.reps !== undefined ? (repsAdj ?? it.planned.reps) : undefined, seconds: it.planned.seconds, load: 'body', done: true, ts: nowIso(), ...extra };
    await patchItem(index, { sets: next });
    const total = it.planned.sets * (it.planned.perSide ? 2 : 1);
    if (next.filter((s) => s?.done).length < total && !exercise?.area.match(/warmup|cooldown|mobility|breathing/)) setRest(30);
  }
  async function undoSet(setIdx: number) {
    if (!session || index === null) return;
    const it = session.items[index];
    const next = [...it.sets];
    next[setIdx] = { ...next[setIdx], done: false };
    await patchItem(index, { sets: next });
  }
  const go = (d: number) => { setRest(null); setHold(null); setIndex(Math.max(0, Math.min(session.items.length - 1, index + d))); };
  const swapTo = async (target: Exercise) => {
    if (!session) return;
    await patchItem(index, { exerciseId: target.id, exerciseName: target.name, catalogVersion: target.version, planned: { ...target.defaultDose, sets: current.planned.sets }, sets: [], swappedFromId: exercise.id, swappedFromName: exercise.name, doseReason: 'Swapped during the workout.' });
    setSwapOpen(false);
    toast.show(`Switched to ${target.name}`);
  };
  const setLabel = (i: number) => (planned.perSide ? `${planned.perSide ? (i % 2 === 0 ? 'L' : 'R') : ''} set ${Math.floor(i / 2) + 1}` : `Set ${i + 1}`);
  const isLast = index === session.items.length - 1;
  const action = (() => {
        const nextIdx = sets.findIndex((x) => !x?.done) === -1 ? (allDone ? -1 : sets.length) : sets.findIndex((x) => !x?.done);
        const which = totalSets > 1 && nextIdx >= 0 ? ` (${setLabel(nextIdx).toLowerCase()} of ${totalSets})` : '';
        if (flash || allDone) return <div className="banner green" style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>✓ Done{isLastItem ? '. Tap Finish workout.' : flash ? '. Next one coming up…' : ''}</div>;
        if (hold) return <div className="center" style={{ padding: '6px 0' }}><div className="small muted">{exercise.area === 'breathing' ? 'Breathe' : 'Keep going'}</div><div className="timer">{hold.left}</div><button className="btn mt" onClick={() => { completeSet(hold.setIdx); setHold(null); }}>Done early</button></div>;
        if (rest !== null) return <div className="small muted center">Rest, then the next set.</div>;
        if (planned.seconds !== undefined) return <button className="btn primary xl block" onClick={() => setHold({ setIdx: Math.max(0, nextIdx), left: planned.seconds! })}>▶ Start the {planned.seconds} second timer{which}</button>;
        return <button className="btn primary xl block" onClick={() => completeSet(Math.max(0, nextIdx))}>✓ Did it{which}</button>;
      })();

  return (
    <div className="player">
      <div className="row between">
        <button className="btn sm" onClick={() => nav('/today')}>‹ Today</button>
        <div className="row"><span className={`small ${paused ? 'muted' : ''}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtClock(elapsed)} total</span><button className="btn sm" onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button></div>
        <button className="btn sm stop-btn" onClick={() => setStopOpen(true)}>Stop</button>
      </div>
      <div className="progress-dots" aria-label={`Exercise ${index + 1} of ${session.items.length}`}>{session.items.map((it, i) => <i key={i} className={`${it.sets.some((s) => s.done) ? 'on' : ''} ${i === index ? 'now' : ''}`} />)}</div>
      <div className="small muted">{session.templateName} · {index + 1} of {session.items.length}</div>

      <div className="card">
        <div className="exname">{exercise.name}</div>
        <div className="dose">{doseText(planned)}</div>
        {current.doseReason && <div className="small muted">{current.doseReason}</div>}
        {current.swappedFromName && <div className="small muted">In place of {current.swappedFromName}.</div>}
        <Figure pose={exercise.pose} />
        <div className="mt">{action}</div>
        <div className="chips" style={{ marginTop: 6 }}>{exercise.cues.map((c) => <span key={c} className="cue">{c}</span>)}</div>
        <details className="fold"><summary>How to do it</summary><ol className="step-list">{exercise.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>{exercise.commonErrors.length > 0 && <div className="small muted">Watch for: {exercise.commonErrors.map((e) => `${e.error.toLowerCase()} (${e.fix.toLowerCase()})`).join('; ')}</div>}</details>
        <details className="fold"><summary>Why it matters</summary><p className="small">{exercise.develops} {exercise.why}</p><Link className="small" to={`/exercises/${exercise.id}`}>Full exercise page</Link></details>
        {clips.length > 0 && <button className="btn block mt" onClick={() => setWatchOpen(true)}>▶ Watch it</button>}
        {current.note && current.note.startsWith('Ready to try') && <div className="banner green small">{current.note}. Tap Swap to try it, or stay here. Both are good choices.</div>}
      </div>

      {planned.reps !== undefined && (
        <div className="card row between">
          <div><strong>Reps this set</strong><div className="small muted">Stop a set early any time. Fewer good reps beat more sloppy ones.</div></div>
          <div className="stepper"><button className="btn sm" onClick={() => setRepsAdj(Math.max(1, (repsAdj ?? planned.reps!) - 1))}>−</button><span className="val">{repsAdj ?? planned.reps}</span><button className="btn sm" onClick={() => setRepsAdj(Math.min(30, (repsAdj ?? planned.reps!) + 1))}>+</button></div>
        </div>
      )}

      {rest !== null ? (
        <div className="card center"><div className="small muted">Rest</div><div className="timer">{rest}</div><button className="btn mt" onClick={() => setRest(null)}>Skip rest</button></div>
      ) : null}

      <div className="small muted">Sets (tap one to undo)</div>
      <div className="set-row">
        {Array.from({ length: totalSets }, (_, i) => {
          const done = sets[i]?.done;
          return (
            <button key={i} className={`set-btn ${done ? 'done' : ''}`} onClick={() => (done ? undoSet(i) : planned.seconds ? setHold({ setIdx: i, left: planned.seconds }) : completeSet(i))} aria-label={done ? `Undo ${setLabel(i)}` : `Complete ${setLabel(i)}`}>
              <span className="l">{setLabel(i)}</span>
              <span>{done ? '✓' : planned.seconds ? `${planned.seconds}s` : `${repsAdj ?? planned.reps}`}</span>
            </button>
          );
        })}
      </div>

      <div className="row">
        <button className="btn" onClick={() => setSwapOpen(true)}>Swap</button>
        <FeltRow item={current} onChange={(p) => patchItem(index, p)} />
      </div>
      <QuickNote value={current.note && !current.note.startsWith('Ready to try') ? current.note : ''} onSave={(v) => patchItem(index, { note: v })} />

      <div className="row">
        <button className="btn lg" disabled={index === 0} onClick={() => go(-1)}>‹ Back</button>
        {isLast ? <button className={`btn lg grow ${allDone ? 'primary' : ''}`} onClick={() => setFinishOpen(true)}>Finish workout</button> : <button className={`btn lg grow ${allDone ? 'primary' : 'ghost'}`} onClick={() => go(1)}>{allDone ? 'Next ›' : 'Skip this one ›'}</button>}
      </div>

      {swapOpen && (
        <Sheet title="Swap this exercise" onClose={() => setSwapOpen(false)}>
          <div className="list">
            {[exercise.easier && { e: exercises.get(exercise.easier), tag: 'Easier' }, exercise.harder && { e: exercises.get(exercise.harder), tag: 'Harder' }, ...exercise.substitutes.map((id) => ({ e: exercises.get(id), tag: 'Instead' }))]
              .filter((x): x is { e: Exercise; tag: string } => !!x && !!x.e && !x.e.archived)
              .filter((x) => !(x.e.needsFormCheck && !statuses.get(x.e.id)?.formCheckedAt))
              .map((x) => <button key={x.e.id} className="item tappable" onClick={() => swapTo(x.e)}><div className="grow"><div className="title">{x.e.name}</div><div className="sub">{x.e.develops}</div></div><span className="pill">{x.tag}</span></button>)}
          </div>
          <p className="small muted mt">Harder versions a parent has not watched yet do not show up here.</p>
        </Sheet>
      )}
      {watchOpen && <Sheet title={exercise.name} onClose={() => setWatchOpen(false)}><Watch exerciseId={exercise.id} who={mode} /></Sheet>}
      {stopOpen && <StopSheet session={session} onClose={() => setStopOpen(false)} />}
      {finishOpen && <FinishSheet session={session} onClose={() => setFinishOpen(false)} />}
      {toast.el}
    </div>
  );
}

function FeltRow({ item, onChange }: { item: SessionItem; onChange: (p: Partial<SessionItem>) => void }) {
  return (
    <div className="row grow" style={{ justifyContent: 'flex-end' }}>
      <span className="small muted">Felt</span>
      <button className={`btn sm ${item.feltGood === true ? 'green' : ''}`} onClick={() => onChange({ feltGood: item.feltGood === true ? undefined : true })}>Good</button>
      <button className={`btn sm ${item.feltGood === false ? 'selected' : ''}`} onClick={() => onChange({ feltGood: item.feltGood === false ? undefined : false })}>Not great</button>
    </div>
  );
}

function QuickNote({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input className="input" placeholder="Quick note (optional): easier today, left side wobbly…" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }} />;
}

function StopSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const nav = useNavigate();
  const reasons: Array<[Session['stoppedReason'], string]> = [['pain', 'Something hurts'], ['dizzy', 'Dizzy or lightheaded'], ['sick', 'Feeling sick'], ['tired', 'Too tired'], ['time', 'Out of time'], ['other', 'Something else']];
  const stop = async (r: Session['stoppedReason']) => {
    await finishSession(session.id, { status: 'stopped', stoppedReason: r }, session.day);
    nav(`/sessions/${session.id}`);
  };
  return (
    <Sheet title="Stop the workout" onClose={onClose}>
      <p className="small muted">Stopping is always okay. If something hurts, you are dizzy, or you feel sick, stop now and tell a parent. That is the smart move.</p>
      <div className="list">{reasons.map(([r, label]) => <button key={r} className={`btn lg ${r === 'pain' || r === 'dizzy' || r === 'sick' ? 'stop-btn' : ''}`} onClick={() => stop(r)}>{label}</button>)}</div>
    </Sheet>
  );
}

function FinishSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const nav = useNavigate();
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [feltGood, setFeltGood] = useState<boolean | undefined>(undefined);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const words = ['', 'Easy', 'Pretty easy', 'Okay', 'Hard', 'Very hard'];
  const save = async () => {
    setBusy(true);
    const earned = await finishSession(session.id, { status: 'done', overallDifficulty: difficulty, feltGood, note: note.trim() || undefined }, session.day);
    setBusy(false);
    nav(`/sessions/${session.id}`, { state: { earned: earned.map((e) => e.title) } });
  };
  return (
    <Sheet title="How was it?" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Not yet</button><button className="btn primary" disabled={busy} onClick={save}>Save workout</button></>}>
      <h3>How hard was it?</h3>
      <div className="btn-grid cols-5">{([1, 2, 3, 4, 5] as const).map((d) => <button key={d} className={`btn ${difficulty === d ? 'primary' : ''}`} onClick={() => setDifficulty(d)}>{words[d]}</button>)}</div>
      <h3 className="mt">Did the movement feel good?</h3>
      <div className="btn-grid"><button className={`btn ${feltGood === true ? 'green' : ''}`} onClick={() => setFeltGood(true)}>Yes</button><button className={`btn ${feltGood === false ? 'selected' : ''}`} onClick={() => setFeltGood(false)}>Not really</button></div>
      <div className="field mt"><label>One line for the journal (optional)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pike stretch reached further today." /></div>
      <p className="small muted">The app uses "easy" two sessions in a row to add a little next time. "Hard" eases back. Honest answers make it work.</p>
    </Sheet>
  );
}
