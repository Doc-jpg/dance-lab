import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useJournal, useSessions, useToday, fmtDate } from '../hooks';
import { useMode } from '../mode';
import { addJournal, deleteJournal } from '../../db/db';
import { refreshRewards } from '../../engine/today';
import { useToast, Confirm } from '../components/Sheet';
import { nowIso } from '../../engine/types';

/** Short notes in Vivi's words. Private notes stay on this device and out of parent mode and parent packs. */
export function JournalPage() {
  const day = useToday();
  const { mode } = useMode();
  const entries = useJournal(mode === 'athlete');
  const sessions = useSessions();
  const toast = useToast();
  const [text, setText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [del, setDel] = useState<string | null>(null);
  const save = async () => {
    if (!text.trim()) return;
    await addJournal({ day, text: text.trim(), isPrivate, by: mode });
    await refreshRewards(day);
    setText('');
    setIsPrivate(false);
    toast.show(isPrivate ? 'Saved. Private: only you see it.' : 'Saved');
  };
  const prompts = ['What felt easier than last time?', 'What was hard today, and why do you think?', 'Something your body told you today.', 'One thing you are proud of this week.'];
  const prompt = prompts[Number(day.slice(8)) % prompts.length];
  return (
    <div className="col">
      <h1>Journal</h1>
      <div className="card">
        <div className="small muted">{prompt}</div>
        <textarea className="input mt" value={text} onChange={(e) => setText(e.target.value)} placeholder='"Pike stretch reached further today." "My legs were really tired after dance."' />
        <div className="row between mt">
          <label className="row small"><input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> Private (only I can see it)</label>
          <button className="btn primary" disabled={!text.trim()} onClick={save}>Save</button>
        </div>
        {mode === 'parent' && <div className="small muted mt">Parent view: private notes are not shown here.</div>}
      </div>
      {entries.length === 0 ? <div className="empty">No notes yet. A line or two after a workout is plenty.</div> : (
        <div className="list">
          {entries.map((j) => {
            const s = j.sessionId ? sessions.find((x) => x.id === j.sessionId) : undefined;
            return (
              <div key={j.id} className="item" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="sub">{fmtDate(j.day)}{j.isPrivate ? ' · private' : ''}{j.by === 'parent' ? ' · parent' : ''}{s ? <> · <Link to={`/sessions/${s.id}`}>{s.templateName}</Link></> : ''}</div>
                  <div>{j.text}</div>
                </div>
                <button className="btn ghost sm" onClick={() => setDel(j.id)} aria-label="Delete note">✕</button>
              </div>
            );
          })}
        </div>
      )}
      {del && <Confirm title="Delete this note?" text="It will be gone from this device." yesLabel="Delete" danger onNo={() => setDel(null)} onYes={async () => { await deleteJournal(del); setDel(null); }} />}
      {toast.el}
    </div>
  );
}
