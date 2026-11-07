import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAthlete, useMeta, useSettings } from '../hooks';
import { useMode } from '../mode';
import { addGoal, setGoalStatus, updateAthlete, saveSettings } from '../../db/db';
import { BackupPanel } from '../components/BackupPanel';
import { SyncCard } from '../components/SyncCard';
import { Sheet, useToast } from '../components/Sheet';
import { useTour } from '../components/Tour';
import type { ThemeChoice } from '../../engine/types';
import { nowIso } from '../../engine/types';
import { APP_NAME, APP_VERSION } from '../version';

/** The card the dancer can read any time: the whole list of what the parent view shows. */
export function VisibilityCard() {
  const settings = useSettings();
  const athlete = useAthlete();
  const parent = settings.parentName ?? 'Your parent';
  return (
    <div className="card" data-tour="parent" style={{ borderLeft: '4px solid var(--accent-2)' }}>
      <h3>What {parent} can see</h3>
      <p className="small">{parent} has a view behind a PIN. It shows:</p>
      <ul className="small step-list">
        <li>Finished and skipped sessions, with sets, how they felt, and session notes</li>
        <li>Dance and play you logged, check-ins, and easy days</li>
        <li>Progress charts and badges</li>
        <li>Journal notes that are not marked private</li>
        <li>Safety alerts: pain, feeling sick, dizziness, a stopped session, a performance day, or a week with no rest day</li>
      </ul>
      <p className="small">{settings.sync?.enabled ? `All of that goes to ${parent}'s phone on its own whenever this phone has a signal, so nobody has to send anything. ` : ''}<strong>Not shown:</strong> journal notes marked private. There is no hidden tracking; this list is the whole list. {parent} can also turn moves on or off, set how many strength days a week, and manage reminders.</p>
      {!settings.visibilityNoticeSeenAt && athlete && <button className="btn sm" onClick={() => saveSettings({ visibilityNoticeSeenAt: nowIso() })}>Got it</button>}
    </div>
  );
}

/** Settings as the dancer sees them. Everything a parent manages lives behind the PIN on /parent. */
export function SettingsPage() {
  const nav = useNavigate();
  const athlete = useAthlete();
  const settings = useSettings();
  const { mode, enterParent } = useMode();
  const tour = useTour();
  const toast = useToast();
  const deviceRole = useMeta('deviceRole');
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [goal, setGoal] = useState('');
  const parent = settings.parentName ?? 'Parent';
  const tryPin = async () => {
    const ok = await enterParent(pin);
    setPin('');
    if (ok) { setPinOpen(false); setWrong(false); nav('/parent'); } else setWrong(true);
  };
  if (!athlete && deviceRole === 'parent') {
    return (
      <div className="col">
        <h1>Settings</h1>
        <div className="card"><h3>Waiting for the dancer's device</h3><p className="small">This phone is connected. Her name and records show up here the first time her device opens the app with a signal after setup. {settings.sync?.lastError ? `Last try: ${settings.sync.lastError}` : ''}</p></div>
        <SyncCard full={mode === 'parent'} />
        {mode === 'parent' ? <Link className="btn primary block" to="/parent">Open the parent view</Link> : <button className="btn block" onClick={() => setPinOpen(true)}>Open the parent view</button>}
        {pinOpen && (
          <Sheet title={`${parent}'s PIN`} onClose={() => { setPinOpen(false); setWrong(false); }} footer={<><button className="btn" onClick={() => setPinOpen(false)}>Cancel</button><button className="btn primary" disabled={pin.length < 4} onClick={tryPin}>Unlock</button></>}>
            <input className="input" type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} onKeyDown={(e) => { if (e.key === 'Enter') tryPin(); }} style={{ fontSize: 28, textAlign: 'center', letterSpacing: 8 }} aria-label="PIN" />
            {wrong && <div className="small mt" style={{ color: 'var(--danger)' }}>That is not it.</div>}
          </Sheet>
        )}
      </div>
    );
  }
  if (!athlete) return null;
  const parentDoor = (
    <div className="card">
      <h3>For {parent}</h3>
      <p className="small muted">The parent view needs the PIN.</p>
      {mode === 'parent' ? <Link className="btn primary block" to="/parent">Open the parent view</Link> : <button className="btn block" onClick={() => setPinOpen(true)}>Open the parent view</button>}
    </div>
  );
  return (
    <div className="col">
      <div className="row between"><h1>Settings</h1><Link className="btn sm" to="/help">Help</Link></div>
      {deviceRole === 'parent' && parentDoor}

      <div className="card">
        <h3>Look</h3>
        <div className="btn-grid cols-3 mt">
          {([['play', 'Playful'], ['minimal', 'Calm'], ['pro', 'Stage']] as Array<[ThemeChoice, string]>).map(([k, label]) => <button key={k} className={`theme-swatch ${athlete.theme === k ? 'on' : ''}`} onClick={() => updateAthlete({ theme: k })}>{label}</button>)}
        </div>
      </div>

      <div className="card">
        <h3>My goals</h3>
        <p className="small muted">Your own words. "Hold a plank for 45 seconds." "Feel quicker on defense."</p>
        <div className="list mt">
          {athlete.goals.filter((g) => g.status === 'active').map((g) => <div key={g.id} className="item"><div className="grow">{g.text}</div><button className="btn sm" onClick={() => setGoalStatus(g.id, 'done')}>Done</button></div>)}
          {athlete.goals.filter((g) => g.status === 'done').slice(0, 3).map((g) => <div key={g.id} className="item" style={{ opacity: .6 }}><div className="grow"><s>{g.text}</s></div><span className="pill green">Done</span></div>)}
        </div>
        <div className="row mt"><input className="input grow" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="New goal" /><button className="btn primary" disabled={!goal.trim()} onClick={async () => { await addGoal(goal.trim(), mode); setGoal(''); }}>Add</button></div>
      </div>

      <VisibilityCard />
      <SyncCard full={false} />

      <div className="card">
        <h3>Learn the app</h3>
        <div className="col mt">
          <button className="btn block" onClick={() => { nav('/today'); setTimeout(tour.start, 150); }}>Take the one-minute tour</button>
          <Link className="btn block" to="/help">Questions and answers</Link>
        </div>
      </div>

      <BackupPanel simple />

      {deviceRole !== 'parent' && parentDoor}

      <div className="card">
        <div className="small muted">{APP_NAME} {APP_VERSION}. Set up for {athlete.firstName}. Works offline; everything is stored on this device. Not medical advice.</div>
      </div>

      {pinOpen && (
        <Sheet title={`${parent}'s PIN`} onClose={() => { setPinOpen(false); setWrong(false); }} footer={<><button className="btn" onClick={() => setPinOpen(false)}>Cancel</button><button className="btn primary" disabled={pin.length < 4} onClick={tryPin}>Unlock</button></>}>
          <input className="input" type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} onKeyDown={(e) => { if (e.key === 'Enter') tryPin(); }} style={{ fontSize: 28, textAlign: 'center', letterSpacing: 8 }} aria-label="PIN" />
          {wrong && <div className="small mt" style={{ color: 'var(--danger)' }}>That is not it.</div>}
          <p className="small muted mt">The parent view locks itself again after ten minutes in the background.</p>
        </Sheet>
      )}
      {toast.el}
    </div>
  );
}
