import React, { useEffect, useRef, useState } from 'react';
import { buildBackup, readBackup, restoreBackup, shareOrDownload, type BackupContents, type RestoreReport } from '../../io/backup';
import { saveSettings, storageHealth, type StorageHealth } from '../../db/db';
import { useSettings, timeAgo } from '../hooks';
import { Sheet, useToast } from './Sheet';
import { APP_VERSION } from '../version';
import { nowIso } from '../../engine/types';

/**
 * Backup (two-step share sheet so a cancelled share is not counted), parent pack, and restore with
 * a preview and a choice of Merge (never overwrites a newer record here) or Replace.
 */
export function BackupPanel({ simple = false }: { simple?: boolean }) {
  const settings = useSettings();
  const toast = useToast();
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [pending, setPending] = useState<{ bytes: Uint8Array; fileName: string; scope: 'full' | 'parent' } | null>(null);
  const [preview, setPreview] = useState<BackupContents | null>(null);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { storageHealth().then(setHealth); }, []);

  const prepare = async (scope: 'full' | 'parent') => {
    setBusy(true);
    const b = await buildBackup(APP_VERSION, scope);
    setBusy(false);
    setPending({ bytes: b.bytes, fileName: b.fileName, scope });
  };
  const send = async () => {
    if (!pending) return;
    const r = await shareOrDownload(pending.bytes, pending.fileName);
    if (r === 'cancelled') { toast.show('Cancelled. Nothing was saved.'); return; }
    if (pending.scope === 'full') await saveSettings({ lastBackupAt: nowIso() });
    setPending(null);
    toast.show(r === 'shared' ? 'Sent to the share sheet' : 'Downloaded');
  };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      setPreview(await readBackup(bytes));
    } catch (e: any) {
      toast.show(e?.message ?? 'Could not read that file');
    }
    if (fileRef.current) fileRef.current.value = '';
  };
  const restore = async (mode: 'merge' | 'replace') => {
    if (!preview) return;
    setBusy(true);
    const r = await restoreBackup(preview, mode);
    setBusy(false);
    setPreview(null);
    setReport(r);
  };
  const count = (c: BackupContents) => Object.values(c.manifest.files).reduce((s, f) => s + f.records, 0);

  return (
    <div className="card" data-tour="backup">
      <h3>Backup</h3>
      {health && <div className={`banner ${health.verdict === 'safe' ? 'info' : 'warn'} small mt`}>{health.message}</div>}
      <div className="small muted">Last full backup: {settings.lastBackupAt ? timeAgo(settings.lastBackupAt) : 'never'}.</div>
      <div className="col mt">
        <button className="btn primary block" disabled={busy} onClick={() => prepare('full')}>Back up everything</button>
        {!simple && <button className="btn block" disabled={busy} onClick={() => prepare('parent')}>Make a parent pack (no private notes)</button>}
        {!simple && <button className="btn block" onClick={() => fileRef.current?.click()}>Restore or merge a backup file</button>}
        <input ref={fileRef} type="file" accept=".zip,application/zip" className="hide" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {simple ? <p className="small muted mt">A backup is a copy of everything in the app, saved as one file. This is a grown-up job: {settings.parentName ?? 'your parent'} does it every few weeks.</p> : <p className="small muted mt">Remote parent access and automatic sync between phones are not enabled (there is no server). A parent pack sent by AirDrop, Messages or Mail and merged on the other phone is how records move for now. A backup is a ZIP file with checksums. Merge adds what is missing and keeps the newer copy of anything that differs; nothing on this phone is overwritten by an older copy. Replace wipes this phone first (new phone, or starting over).</p>}

      {pending && (
        <Sheet title={pending.scope === 'parent' ? 'Parent pack ready' : 'Backup ready'} onClose={() => setPending(null)} footer={<><button className="btn" onClick={() => setPending(null)}>Cancel</button><button className="btn primary" onClick={send}>Share or save</button></>}>
          <p>{pending.fileName}</p>
          <p className="small muted">{pending.scope === 'parent' ? 'Private journal notes and this phone\'s PINs are left out. Send it to a parent by AirDrop, Messages or Mail; they open it in their own copy of the app with Restore or merge.' : 'Everything on this phone, including private notes. Save it to Files or iCloud Drive, or send it to a computer.'}</p>
        </Sheet>
      )}
      {preview && (
        <Sheet title="Restore a backup" onClose={() => setPreview(null)} footer={<><button className="btn primary" disabled={busy} onClick={() => restore('merge')}>Merge (safe)</button><button className="btn danger" disabled={busy} onClick={() => restore('replace')}>Replace everything</button></>}>
          <p>{preview.manifest.scope === 'parent' ? 'Parent pack' : 'Full backup'}{preview.manifest.athleteName ? ` for ${preview.manifest.athleteName}` : ''}, made {new Date(preview.manifest.createdAt).toLocaleString()}, app {preview.manifest.appVersion}. {count(preview)} records.</p>
          <ul className="small muted">{Object.entries(preview.manifest.files).filter(([, f]) => f.records > 0).map(([n, f]) => <li key={n}>{n.replace('.json', '')}: {f.records}</li>)}</ul>
          <p className="small"><strong>Merge</strong> keeps everything already here and adds what is new. <strong>Replace</strong> deletes what is on this phone first; PINs stay.</p>
        </Sheet>
      )}
      {report && (
        <Sheet title="Done" onClose={() => setReport(null)}>
          <p>{report.mode === 'merge' ? 'Merged.' : 'Replaced.'} Added {Object.values(report.added).reduce((a, b) => a + b, 0)}, updated {Object.values(report.updated).reduce((a, b) => a + b, 0)}, unchanged {Object.values(report.unchanged).reduce((a, b) => a + b, 0)}.</p>
          {report.keptNewerHere.length > 0 && <p className="small muted">{report.keptNewerHere.length} record{report.keptNewerHere.length === 1 ? ' was' : 's were'} newer on this phone and kept as they were.</p>}
        </Sheet>
      )}
      {toast.el}
    </div>
  );
}
