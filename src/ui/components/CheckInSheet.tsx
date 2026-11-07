import React, { useState } from 'react';
import { Sheet } from './Sheet';
import type { Day, Feel, Sport, Duration, Intensity, SportsLog, Who } from '../../engine/types';
import { FEEL_WORDS, SLEEP_WORDS, SPORT_WORDS, DURATION_WORDS, INTENSITY_WORDS } from '../../engine/types';

/**
 * The readiness check-in. One sheet, two parts: what you did today (dance, play) and how you feel.
 * Defaults are "a normal day", so a kid with nothing to report taps Save in two seconds.
 */
export interface SportDraft {
  sport: Sport;
  duration: Duration;
  intensity: Intensity;
  heavyJumping: boolean;
  performance: boolean;
}

export interface CheckInDraft {
  energy: Feel;
  sleep: Feel;
  soreness: 'none' | 'some' | 'alot';
  pain: boolean;
  painWhere?: string;
  sick: boolean;
  dizzy: boolean;
  note?: string;
}

const SPORTS: Sport[] = ['dance', 'gymnastics', 'pe', 'play', 'swimming', 'bike', 'other'];

export function SportCard({ draft, onChange, onRemove }: { draft: SportDraft; onChange: (d: SportDraft) => void; onRemove: () => void }) {
  const set = (p: Partial<SportDraft>) => onChange({ ...draft, ...p });
  return (
    <div className="card">
      <div className="row between"><strong>{SPORT_WORDS[draft.sport]}</strong><button className="btn ghost sm" onClick={onRemove}>Remove</button></div>
      <div className="small muted mt">How long?</div>
      <div className="chips">{(['short', 'medium', 'long'] as Duration[]).map((d) => <button key={d} className={`chip sm ${draft.duration === d ? 'on' : ''}`} onClick={() => set({ duration: d })}>{DURATION_WORDS[d]}</button>)}</div>
      <div className="small muted mt">How hard?</div>
      <div className="chips">{(['easy', 'medium', 'hard'] as Intensity[]).map((d) => <button key={d} className={`chip sm ${draft.intensity === d ? 'on' : ''}`} onClick={() => set({ intensity: d })}>{INTENSITY_WORDS[d]}</button>)}</div>
      <div className="small muted mt">Anything big?</div>
      <div className="chips">
        <button className={`chip sm ${draft.heavyJumping ? 'on' : ''}`} onClick={() => set({ heavyJumping: !draft.heavyJumping })}>Lots of jumping</button>
        <button className={`chip sm ${draft.performance ? 'on' : ''}`} onClick={() => set({ performance: !draft.performance })}>Recital, show or competition</button>
      </div>
    </div>
  );
}

export function newSportDraft(sport: Sport): SportDraft {
  return { sport, duration: 'medium', intensity: 'medium', heavyJumping: false, performance: false };
}

export function toLog(d: SportDraft, day: Day, by: Who): Omit<SportsLog, 'id' | 'ts'> {
  return { day, sport: d.sport, duration: d.duration, intensity: d.intensity, heavyJumping: d.heavyJumping, performance: d.performance, by };
}

function FiveScale({ value, words, onChange }: { value: Feel; words: Record<Feel, string>; onChange: (v: Feel) => void }) {
  return (
    <div className="btn-grid cols-5">
      {([1, 2, 3, 4, 5] as Feel[]).map((v) => <button key={v} className={`btn ${value === v ? 'primary' : ''}`} onClick={() => onChange(v)}>{words[v]}</button>)}
    </div>
  );
}

export function CheckInSheet({ name, initialSports, onSave, onClose }: { name: string; initialSports?: SportDraft[]; onSave: (sports: SportDraft[], draft: CheckInDraft) => Promise<void>; onClose: () => void }) {
  const [sports, setSports] = useState<SportDraft[]>(initialSports ?? []);
  const [draft, setDraft] = useState<CheckInDraft>({ energy: 4, sleep: 4, soreness: 'none', pain: false, sick: false, dizzy: false });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<CheckInDraft>) => setDraft({ ...draft, ...p });
  const red = draft.pain || draft.sick || draft.dizzy;
  return (
    <Sheet
      title={`How are you today, ${name}?`}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await onSave(sports, draft); setBusy(false); }}>Save check-in</button></>}
    >
      <h3>What did you already do today?</h3>
      <p className="small muted">Tap one to add it. Nothing today? Skip this part.</p>
      <div className="chips mb">
        {SPORTS.map((s) => <button key={s} className="chip sm" onClick={() => setSports([...sports, newSportDraft(s)])}>+ {SPORT_WORDS[s]}</button>)}
      </div>
      <div className="list mb">
        {sports.map((d, i) => <SportCard key={i} draft={d} onChange={(x) => setSports(sports.map((y, j) => (j === i ? x : y)))} onRemove={() => setSports(sports.filter((_, j) => j !== i))} />)}
      </div>
      <h3>Energy</h3>
      <FiveScale value={draft.energy} words={FEEL_WORDS} onChange={(v) => set({ energy: v })} />
      <h3 className="mt">Sleep last night</h3>
      <FiveScale value={draft.sleep} words={SLEEP_WORDS} onChange={(v) => set({ sleep: v })} />
      <h3 className="mt">Sore or tired muscles?</h3>
      <div className="btn-grid cols-3">
        {([['none', 'Not really'], ['some', 'A little'], ['alot', 'A lot']] as Array<[CheckInDraft['soreness'], string]>).map(([k, l]) => <button key={k} className={`btn ${draft.soreness === k ? 'primary' : ''}`} onClick={() => set({ soreness: k })}>{l}</button>)}
      </div>
      <h3 className="mt">Anything wrong?</h3>
      <p className="small muted">Tired muscles are normal. These are different.</p>
      <div className="chips">
        <button className={`chip red ${draft.pain ? 'on' : ''}`} onClick={() => set({ pain: !draft.pain })}>Something hurts</button>
        <button className={`chip red ${draft.sick ? 'on' : ''}`} onClick={() => set({ sick: !draft.sick })}>Feeling sick</button>
        <button className={`chip red ${draft.dizzy ? 'on' : ''}`} onClick={() => set({ dizzy: !draft.dizzy })}>Dizzy or lightheaded</button>
      </div>
      {draft.pain && <div className="field mt"><label>Where does it hurt?</label><input className="input" value={draft.painWhere ?? ''} onChange={(e) => set({ painWhere: e.target.value })} placeholder="for example left knee" /></div>}
      {red && <div className="banner danger mt">No workout today. You still get the Easy day (two minutes of breathing), and it still counts. Tell a grown-up how you feel; if it is more than tired muscles, a doctor decides, not the app.</div>}
      <div className="field mt"><label>Anything else? (optional)</label><input className="input" value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Legs are tired from dance" /></div>
    </Sheet>
  );
}
