import React, { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAchievements, useSession, fmtDateLong } from '../hooks';
import { useMode } from '../mode';
import { addJournal } from '../../db/db';
import { doseText, isHold } from '../../engine/program';
import { LOAD_WORDS } from '../../data/exercises';
import { useToast } from '../components/Sheet';
import { COLOR_WORDS } from '../../engine/readiness';

/** A finished (or stopped) session: what was done, how it felt, why it looked like this, badges earned. */
export function SessionPage() {
  const { sessionId } = useParams();
  const session = useSession(sessionId);
  const achievements = useAchievements();
  const loc = useLocation() as { state?: { earned?: string[] } };
  const { mode } = useMode();
  const toast = useToast();
  const [note, setNote] = useState('');
  if (!session) return <div className="empty">Loading…</div>;
  const earnedTitles = (session.achievements ?? []).map((k) => achievements.find((a) => a.key === k)?.title).filter(Boolean) as string[];
  const words = ['', 'easy', 'pretty easy', 'okay', 'hard', 'very hard'];
  const doneItems = session.items.filter((i) => i.sets.some((s) => s.done));
  return (
    <div className="col">
      <div className="row between"><Link className="btn sm" to="/today">‹ Today</Link><Link className="btn sm" to="/progress">Progress</Link></div>
      <div className="card">
        <h1>{session.templateName}</h1>
        <div className="small muted">{fmtDateLong(session.day)} · {session.status === 'done' ? 'Finished' : session.status === 'stopped' ? `Stopped early (${({ pain: 'something hurt', dizzy: 'felt dizzy', sick: 'felt sick', tired: 'too tired', time: 'out of time', other: 'another reason' } as Record<string, string>)[session.stoppedReason ?? 'other'] ?? 'another reason'})` : session.status}{session.readiness ? ` · ${COLOR_WORDS[session.readiness]} day` : ''}</div>
        {session.status === 'stopped' && (session.stoppedReason === 'pain' || session.stoppedReason === 'dizzy' || session.stoppedReason === 'sick') && <div className="banner danger mt">Stopping for that was the right thing to do. Tell a grown-up how you feel. The app has marked it for a grown-up to see.</div>}
        {(loc.state?.earned?.length || earnedTitles.length) ? <div className="banner green mt">Badge{(loc.state?.earned ?? earnedTitles).length > 1 ? 's' : ''} earned: {(loc.state?.earned ?? earnedTitles).join(', ')}</div> : null}
        {session.overallDifficulty && <div className="mt">Felt <strong>{words[session.overallDifficulty]}</strong>{session.feltGood === true ? ', and your body felt good' : session.feltGood === false ? ', and your body did not feel great' : ''}.</div>}
        {session.note && <div className="small">"{session.note}"</div>}
      </div>
      <div className="card">
        <h3>What you did</h3>
        {doneItems.length === 0 ? <div className="small muted">You did not finish any moves this time. That is okay.</div> : (
          <div className="list mt">
            {doneItems.map((it, i) => {
              const done = it.sets.filter((s) => s.done);
              const loads = [...new Set(done.map((s) => s.load))].filter((l) => l !== 'body');
              return (
                <Link key={i} className="item tappable" to={`/exercises/${it.exerciseId}`}>
                  <div className="grow">
                    <div className="title">{it.exerciseName}{it.swappedFromName ? <span className="small muted"> (instead of {it.swappedFromName})</span> : ''}</div>
                    <div className="sub">{done.length} of {it.planned.sets * (it.planned.perSide ? 2 : 1)} rounds done · the plan was {doseText(it.planned, isHold(it.exerciseId))}{done[0]?.reps !== undefined && done.some((s) => s.reps !== it.planned.reps) ? ` · did ${done.map((s) => s.reps).join(', ')}` : ''}{loads.length ? ` · ${loads.map((l) => LOAD_WORDS[l]).join(', ')}` : ''}{it.feltGood === false ? ' · did not feel great' : ''}{it.note ? ` · "${it.note}"` : ''}</div>
                  </div>
                  <span className="chev">›</span>
                </Link>
              );
            })}
          </div>
        )}
        {session.items.filter((i) => !i.sets.some((s) => s.done)).length > 0 && <div className="small muted mt">Skipped: {session.items.filter((i) => !i.sets.some((s) => s.done)).map((i) => i.exerciseName).join(', ')}. Skipping is fine.</div>}
      </div>
      <details className="card fold"><summary>Why the workout was like this</summary><ul className="why">{session.why.map((w, i) => <li key={i}>{w}</li>)}</ul></details>
      <div className="card">
        <h3>Add a note</h3>
        <div className="row mt"><input className="input grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder="My legs were really tired after dance." /><button className="btn primary" disabled={!note.trim()} onClick={async () => { await addJournal({ day: session.day, text: note.trim(), isPrivate: false, sessionId: session.id, by: mode }); setNote(''); toast.show('Saved to the journal'); }}>Save</button></div>
      </div>
      {toast.el}
    </div>
  );
}
