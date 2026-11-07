import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAthlete, saveSettings, setParentPin, seedLibrary, db } from '../../db/db';
import { startFamily, joinFamily, familyLink, formatCode, deviceName, syncNow } from '../../io/sync';
import { SYNC_AVAILABLE } from '../../sync-config';
import { useToast } from '../components/Sheet';
import { useAthlete } from '../hooks';
import { useTour } from '../components/Tour';
import type { ThemeChoice } from '../../engine/types';
import { nowIso } from '../../engine/types';
import { APP_NAME } from '../version';

/**
 * First run. Two people use this app and setup is the parent's part: whose phone this is, the
 * dancer's name and birth year, the parent's name, and a PIN typed twice and never shown again.
 * On the dancer's device a hand-off screen then speaks to the kid (pick a look, take the tour).
 * On the parent's phone it lands in the parent dashboard with the "merge a pack" instructions.
 */
type Role = 'athlete' | 'parent';

export function SetupPage() {
  const nav = useNavigate();
  const athlete = useAthlete();
  const tour = useTour();
  const [step, setStep] = useState<'who' | 'parent' | 'link' | 'handoff' | 'parentdone' | 'join'>('who');
  const [familySecret, setFamilySecret] = useState('');
  const [code, setCode] = useState('');
  const toast = useToast();
  const [role, setRole] = useState<Role>('athlete');
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sports, setSports] = useState<string[]>(['dance']);
  const [parentName, setParentName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [theme, setTheme] = useState<ThemeChoice>('play');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggleSport = (s: string) => setSports((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]));
  const year = parseInt(birthYear, 10);
  const yearOk = year >= 2005 && year <= new Date().getFullYear() - 4;
  const pinOk = pin.length >= 4 && pin === pin2;

  const finishParentPart = async () => {
    if (!name.trim()) { setErr("The dancer's first name is needed."); return; }
    if (!yearOk) { setErr('Birth year looks off.'); return; }
    if (!parentName.trim()) { setErr('What should the app call you?'); return; }
    if (!pinOk) { setErr(pin.length < 4 ? 'The PIN needs at least 4 digits.' : 'The two PINs do not match.'); return; }
    setErr('');
    setBusy(true);
    await seedLibrary();
    await createAthlete({ firstName: name.trim(), birthYear: year, sports, theme: 'play' });
    await saveSettings({ parentName: parentName.trim(), createdAt: nowIso() });
    await setParentPin(pin);
    await db.meta.put({ key: 'deviceRole', value: role });
    setPin('');
    setPin2('');
    if (role === 'athlete' && SYNC_AVAILABLE) {
      const fam = await startFamily(deviceName());
      setFamilySecret(fam.secret);
      setBusy(false);
      setStep('link');
      return;
    }
    setBusy(false);
    setStep(role === 'athlete' ? 'handoff' : 'parentdone');
  };

  const shareLink = async () => {
    const url = familyLink(familySecret);
    const nav2: any = navigator;
    try {
      if (nav2.share) { await nav2.share({ title: 'Dance Lab parent link', text: `Open this on your phone to get ${name.trim() || 'the athlete'}'s Dance Lab parent view: ${url}` }); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast.show('Link copied'); } catch { toast.show(url); }
  };

  const joinWithCode = async () => {
    if (!parentName.trim()) { setErr('What should the app call you?'); return; }
    if (!pinOk) { setErr(pin.length < 4 ? 'The PIN needs at least 4 digits.' : 'The two PINs do not match.'); return; }
    setErr('');
    setBusy(true);
    try {
      await seedLibrary();
      await saveSettings({ parentName: parentName.trim(), createdAt: nowIso() });
      await setParentPin(pin);
      await db.meta.put({ key: 'deviceRole', value: 'parent' });
      await joinFamily(code, deviceName());
      const r = await syncNow();
      if (r.error) throw new Error(r.error);
      setBusy(false);
      nav('/settings');
    } catch (e: any) {
      setBusy(false);
      setErr(e?.message ?? 'Could not join. Check the code and the signal.');
    }
  };

  if (athlete && (step === 'who' || step === 'parent')) {
    return (
      <div className="col">
        <div className="hero"><h1>{APP_NAME}</h1><div className="sub">Already set up on this phone.</div></div>
        <button className="btn primary lg block" onClick={() => nav('/today')}>Open the app</button>
      </div>
    );
  }

  return (
    <div className="col">
      <div className="hero">
        <h1>{APP_NAME}</h1>
        <div className="sub">Strength, mobility, athletic movement and good habits for one young athlete, adjusted to every day.</div>
      </div>

      {step === 'who' && (
        <div className="card">
          <h3>For the parent · whose device is this?</h3>
          <p className="small muted">Setup takes two minutes and is the parent's part. After it, the app talks to your dancer.</p>
          <div className="col mt">
            <button className="btn lg block" style={{ minHeight: 72, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} onClick={() => { setRole('athlete'); setStep('parent'); }}><span>My dancer's device (the main one) ›</span><span className="small muted" style={{ fontWeight: 500 }}>She checks in and does her sessions on it. You get a PIN-protected parent view on it too, and a link for your own phone.</span></button>
            <button className="btn lg block" style={{ minHeight: 72, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }} onClick={() => { setRole('parent'); setStep(SYNC_AVAILABLE ? 'join' : 'parent'); }}><span>My own phone (a parent copy) ›</span><span className="small muted" style={{ fontWeight: 500 }}>{SYNC_AVAILABLE ? 'Set up her device first; it gives you a link or a code. Open the link here, or type the code, and everything she does shows up on its own.' : 'Shows the parent dashboard and receives her records as a file she sends you. Set up her device first.'}</span></button>
          </div>
        </div>
      )}

      {step === 'parent' && (
        <div className="card">
          <h3>For the parent · the dancer and you</h3>
          <div className="field"><label>Dancer's first name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" autoFocus /></div>
          <div className="field"><label>Dancer's birth year</label><input className="input" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2017" /></div>
          <div className="field"><label>Activities this year</label>
            <div className="chips">
              {['dance', 'gymnastics', 'swimming', 'piano', 'sewing', 'other'].map((s) => <button key={s} className={`chip ${sports.includes(s) ? 'on' : ''}`} onClick={() => toggleSport(s)}>{s[0].toUpperCase() + s.slice(1)}</button>)}
            </div>
          </div>
          <div className="field"><label>What the app should call you</label><input className="input" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Dad" /></div>
          <div className="inline-fields">
            <div className="field"><label>Parent PIN (4 to 8 digits)</label><input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} aria-label="Parent PIN" /></div>
            <div className="field"><label>Type it again</label><input className="input" type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} aria-label="Parent PIN again" /></div>
          </div>
          <p className="small muted">The PIN opens the parent view. It is never shown on screen again, so pick one you will remember. Change it any time in the parent view.</p>
          <div className="banner warn small">
            This app is a guide for a healthy kid, not medical advice. Everything is body weight; be nearby the first time through a new move. Nobody ever pushes her deeper into a stretch. Anything that hurts: stop, and she tells you.
          </div>
          {err && <div className="banner danger small">{err}</div>}
          <div className="row mt"><button className="btn" onClick={() => setStep('who')}>Back</button><button className="btn primary grow" disabled={busy} onClick={finishParentPart}>{role === 'athlete' ? "Done. Hand it over" : 'Finish'}</button></div>
        </div>
      )}

      {step === 'link' && (
        <div className="card">
          <h3>For the parent · your own phone</h3>
          <p className="small">Everything {name.trim() || 'she'} does on this device will show up on yours on its own, and your settings will show up here. To connect your phone, send yourself this link and open it there (Messages or AirDrop to yourself works).</p>
          <button className="btn primary lg block" onClick={shareLink}>Send myself the parent link</button>
          <p className="small muted mt">Or type this code on your phone under "My own phone": <strong className="mono">{formatCode(familySecret)}</strong></p>
          <p className="small muted">The link holds a private family code. Keep it to yourself; anyone with it could see her sessions. It is also under the parent view, Linked devices, any time.</p>
          <button className="btn block mt" onClick={() => setStep('handoff')}>Done. Hand it over</button>
        </div>
      )}

      {step === 'join' && (
        <div className="card">
          <h3>For the parent · connect to the dancer's device</h3>
          <p className="small muted">Open the parent link from her device on this phone, or type the code it showed.</p>
          <div className="field"><label>Family code</label><input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></div>
          <div className="field"><label>What the app should call you</label><input className="input" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Dad" /></div>
          <div className="inline-fields">
            <div className="field"><label>Parent PIN (4 to 8 digits)</label><input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} aria-label="Parent PIN" /></div>
            <div className="field"><label>Type it again</label><input className="input" type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} aria-label="Parent PIN again" /></div>
          </div>
          <p className="small muted">A PIN here too, in case this phone ends up in a kid's hands.</p>
          {err && <div className="banner danger small">{err}</div>}
          <div className="row mt"><button className="btn" onClick={() => setStep('who')}>Back</button><button className="btn primary grow" disabled={busy} onClick={joinWithCode}>{busy ? 'Connecting…' : 'Connect'}</button></div>
        </div>
      )}

      {step === 'handoff' && (
        <div className="card">
          <h2>Hey {name}, this is yours</h2>
          <p className="small muted">Pick a look. You can change it later in Settings.</p>
          <div className="btn-grid cols-3">
            {([['play', 'Playful'], ['minimal', 'Calm'], ['pro', 'Stage']] as Array<[ThemeChoice, string]>).map(([k, label]) => (
              <button key={k} className={`theme-swatch ${theme === k ? 'on' : ''}`} onClick={async () => { setTheme(k); document.documentElement.setAttribute('data-theme', k); const a = await db.athlete.get('athlete'); if (a) await db.athlete.put({ ...a, theme: k }); }}>{label}</button>
            ))}
          </div>
          <p className="small mt">Every day starts with a quick check-in: dance or play you did and how you feel. Then the app picks the right kind of day and shows you the session one move at a time. Skipping is always allowed.</p>
          <p className="small">{parentName || 'Your parent'} has a PIN-protected view of your sessions, dance days and progress. Settings shows exactly what that includes; notes you mark private stay private.</p>
          <div className="col mt">
            <button className="btn primary lg block" onClick={() => { nav('/today'); setTimeout(tour.start, 200); }}>Take the one-minute tour</button>
            <button className="btn block" onClick={() => nav('/today')}>Skip the tour</button>
          </div>
        </div>
      )}

      {step === 'parentdone' && (
        <div className="card">
          <h2>Parent copy ready</h2>
          <p className="small">This phone shows the parent dashboard. {name}'s check-ins and sessions happen on her device; they reach this one as a file:</p>
          <ol className="step-list small">
            <li>On {name}'s device: Settings, open the parent view with your PIN, Backup, <strong>Make a parent pack</strong>, AirDrop or Message it to yourself.</li>
            <li>On this phone: Settings, parent view, Backup, <strong>Restore or merge</strong>, pick the file, <strong>Merge</strong>.</li>
          </ol>
          <p className="small muted">Settings you change here travel back the same way: Back up everything here, Merge on her device. Merging never overwrites newer records.</p>
          <button className="btn primary lg block mt" onClick={() => nav('/settings')}>Open Settings</button>
        </div>
      )}
      {toast.el}
    </div>
  );
}
