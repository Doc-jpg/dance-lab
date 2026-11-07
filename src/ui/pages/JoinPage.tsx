import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, saveSettings, seedLibrary, setParentPin } from '../../db/db';
import { useAthlete, useSettings } from '../hooks';
import { joinFamily, deviceName, syncNow, normalizeCode } from '../../io/sync';
import { SYNC_AVAILABLE } from '../../sync-config';
import { nowIso } from '../../engine/types';
import { APP_NAME } from '../version';

/**
 * Where the parent link lands (#/join?k=CODE). On a fresh phone: name, PIN, connect, and the
 * dancer's records arrive. On a phone already set up: just connects it.
 */
export function JoinPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const athlete = useAthlete();
  const settings = useSettings();
  const code = normalizeCode(params.get('k') ?? '');
  const [parentName, setParentName] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const alreadyThisFamily = settings.sync?.secret === code;
  const hasPin = !!settings.parentPinHash;
  useEffect(() => { if (athlete === undefined) return; }, [athlete]);

  const connect = async () => {
    if (!hasPin) {
      if (!parentName.trim()) { setErr('What should the app call you?'); return; }
      if (pin.length < 4 || pin !== pin2) { setErr(pin.length < 4 ? 'The PIN needs at least 4 digits.' : 'The two PINs do not match.'); return; }
    }
    setErr('');
    setBusy(true);
    try {
      await seedLibrary();
      if (!hasPin) { await saveSettings({ parentName: parentName.trim(), createdAt: nowIso() }); await setParentPin(pin); }
      if (!athlete) await db.meta.put({ key: 'deviceRole', value: 'parent' });
      await joinFamily(code, deviceName());
      const r = await syncNow();
      if (r.error) throw new Error(r.error);
      setBusy(false);
      setDone(true);
    } catch (e: any) {
      setBusy(false);
      setErr(e?.message ?? 'Could not connect. Check the signal and try again.');
    }
  };

  if (!SYNC_AVAILABLE) return <div className="card">Sync is not set up in this build.</div>;
  if (code.length !== 20) return <div className="card"><h2>That link is not complete</h2><p className="small muted">Open the parent link exactly as it was sent, or type the code under Setup, "My own phone".</p></div>;
  if (done) {
    return (
      <div className="col">
        <div className="hero"><h1>{APP_NAME}</h1><div className="sub">Connected.</div></div>
        <div className="card">
          <p className="small">This phone now follows the dancer's device: check-ins, sessions and shared notes show up here whenever either one opens the app with a signal, and your settings go back the same way. Nothing is ever needed from him.</p>
          <button className="btn primary lg block" onClick={() => nav('/settings')}>Open Settings</button>
        </div>
      </div>
    );
  }
  return (
    <div className="col">
      <div className="hero"><h1>{APP_NAME}</h1><div className="sub">Parent link</div></div>
      <div className="card">
        {alreadyThisFamily ? <p className="small">This phone is already connected to this family.</p> : <p className="small">{athlete ? 'Connect this phone to the dancer\'s device.' : 'This sets up this phone as the parent copy. His records arrive here on their own.'}</p>}
        {!hasPin && (
          <>
            <div className="field"><label>What the app should call you</label><input className="input" value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Dad" /></div>
            <div className="inline-fields">
              <div className="field"><label>Parent PIN (4 to 8 digits)</label><input className="input" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} aria-label="Parent PIN" /></div>
              <div className="field"><label>Type it again</label><input className="input" type="password" inputMode="numeric" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} aria-label="Parent PIN again" /></div>
            </div>
            <p className="small muted">A PIN on this phone too, in case it ends up in a kid's hands.</p>
          </>
        )}
        {err && <div className="banner danger small">{err}</div>}
        <button className="btn primary lg block" disabled={busy || alreadyThisFamily} onClick={connect}>{busy ? 'Connecting…' : alreadyThisFamily ? 'Already connected' : 'Connect this phone'}</button>
        {alreadyThisFamily && <button className="btn block mt" onClick={() => nav('/settings')}>Open Settings</button>}
      </div>
    </div>
  );
}
