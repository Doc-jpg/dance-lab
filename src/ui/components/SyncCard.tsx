import React, { useState } from 'react';
import { useAthlete, useSettings, useMeta, timeAgo } from '../hooks';
import { useToast, Confirm } from './Sheet';
import { familyLink, formatCode, leaveFamily, startFamily, syncNow, deviceName } from '../../io/sync';
import { SYNC_AVAILABLE } from '../../sync-config';

/** Sync status. `full` (parent view) adds the link, the code and the controls; the dancer sees only the status line. */
export function SyncCard({ full }: { full: boolean }) {
  const settings = useSettings();
  const athlete = useAthlete();
  const deviceRole = useMeta('deviceRole');
  const toast = useToast();
  const [confirmOff, setConfirmOff] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!SYNC_AVAILABLE) return null;
  const s = settings.sync;
  const parent = settings.parentName ?? 'your parent';
  const status = !s?.enabled ? 'Not connected to another phone.' : s.lastError ? `Last try failed: ${s.lastError}` : s.lastSyncAt ? `Up to date as of ${timeAgo(s.lastSyncAt)}${s.lastSyncAt.slice(0, 10) === new Date().toISOString().slice(0, 10) ? ` (${new Date(s.lastSyncAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })})` : ''}.` : 'Connected; waiting for the first sync.';
  const share = async () => {
    if (!s) return;
    const url = familyLink(s.secret);
    const nav2: any = navigator;
    try {
      if (nav2.share) { await nav2.share({ title: 'Dance Lab parent link', text: `Open this on your phone to get ${athlete?.firstName ?? 'the dancer'}'s Dance Lab parent view: ${url}` }); return; }
    } catch (e: any) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); toast.show('Link copied'); } catch { toast.show(url); }
  };
  const syncNowClick = async () => { setBusy(true); const r = await syncNow(); setBusy(false); toast.show(r.error ? `Could not sync: ${r.error}` : r.skipped ? 'Offline or not connected' : `Synced (${r.pushed} sent, ${r.applied} received)`); };
  if (!full) {
    return (
      <div className="card">
        <h3>{parent}'s phone</h3>
        <div className="small mt">{s?.enabled ? `Your answers, workouts and shared notes go to ${parent}'s phone by themselves. ${parent}'s settings come here. ${status}` : status}</div>
      </div>
    );
  }
  return (
    <div className="card">
      <h3>Linked phones</h3>
      <div className="small mt">{status}</div>
      {s?.enabled ? (
        <>
          <p className="small muted mt">Syncs whenever either phone opens the app with a signal, after every change, and every two minutes while open. Private journal notes and PINs never sync.</p>
          {deviceRole !== 'parent' && (
            <>
              <button className="btn block" onClick={share}>Send the parent link to another phone</button>
              <p className="small muted mt">Code to type instead: <strong className="mono">{formatCode(s.secret)}</strong>. Anyone with this code can see the dancer's records, so keep it in the family.</p>
            </>
          )}
          <div className="row mt">
            <button className="btn grow" disabled={busy} onClick={syncNowClick}>Sync now</button>
            <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmOff(true)}>Disconnect</button>
          </div>
        </>
      ) : (
        <div className="col mt">
          <p className="small muted">Make a family link from this device, then open it on the other one.</p>
          <button className="btn primary block" disabled={busy} onClick={async () => { setBusy(true); await startFamily(deviceName()); setBusy(false); toast.show('Family link made'); }}>Make a family link</button>
        </div>
      )}
      {confirmOff && <Confirm title="Disconnect this phone?" text="This phone stops sending and receiving. Nothing is deleted anywhere. Reconnect any time with the link or code." yesLabel="Disconnect" danger onNo={() => setConfirmOff(false)} onYes={async () => { await leaveFamily(); setConfirmOff(false); }} />}
      {toast.el}
    </div>
  );
}
