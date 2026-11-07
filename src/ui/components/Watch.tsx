import React, { useRef, useState } from 'react';
import type { Clip, Who } from '../../engine/types';
import { useClips, useOnline, useSettings } from '../hooks';
import { clipObjectUrl, deleteClip, uploadClip } from '../../io/clips';
import { useToast, Confirm } from './Sheet';

/**
 * "Watch it": the family's own clips (Vivi doing the move, shot by a parent, stored in the family's
 * own cloud space). No outside videos here; the moving drawing on every exercise shows the shape.
 */
function ClipCard({ clip, canDelete }: { clip: Clip; canDelete: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [del, setDel] = useState(false);
  const online = useOnline();
  const load = async () => { try { setSrc(await clipObjectUrl(clip)); } catch (e: any) { setErr(e?.message ?? 'Could not load'); } };
  return (
    <div className="card" style={{ padding: 10 }}>
      {src ? <video src={src} controls playsInline style={{ width: '100%', borderRadius: 10, background: '#000' }} /> : (
        <button className="btn block" style={{ minHeight: 64, justifyContent: 'flex-start', textAlign: 'left', gap: 12 }} disabled={!online} onClick={load}>
          <span style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--green)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 18 }}>▶</span>
          <span className="grow"><span style={{ display: 'block' }}>{clip.note || 'Your clip'}</span><span className="small muted" style={{ display: 'block', fontWeight: 500 }}>Shot {new Date(clip.createdAt).toLocaleDateString()}{online ? '' : ' · needs a signal'}</span></span>
        </button>
      )}
      {err && <div className="small" style={{ color: 'var(--danger)' }}>{err}</div>}
      {canDelete && <button className="btn ghost sm mt" style={{ color: 'var(--danger)' }} onClick={() => setDel(true)}>Remove this clip</button>}
      {del && <Confirm title="Remove this clip?" text="It is deleted from the family's cloud space and from both devices." yesLabel="Remove" danger onNo={() => setDel(false)} onYes={async () => { await deleteClip(clip); setDel(false); }} />}
    </div>
  );
}

export function Watch({ exerciseId, who, compact = false, asCard = false }: { exerciseId: string; who: Who; compact?: boolean; asCard?: boolean }) {
  const clips = useClips(exerciseId);
  const settings = useSettings();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const canUpload = who === 'parent' && !!settings.sync?.enabled;
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { await uploadClip(exerciseId, f, 'parent'); toast.show('Clip saved to the family cloud'); } catch (e: any) { toast.show(e?.message ?? 'Upload failed'); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  if (!clips.length && !canUpload) return null;
  return (
    <div className={asCard ? 'card' : 'section'}>
      <div className="row between"><h3>Watch it</h3>{canUpload && <button className="btn sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : '+ Add a clip of her'}</button>}</div>
      <input ref={fileRef} type="file" accept="video/*" capture="environment" className="hide" onChange={(e) => onFile(e.target.files?.[0])} />
      <div className="list mt">
        {clips.map((c) => <ClipCard key={c.id} clip={c} canDelete={who === 'parent'} />)}
      </div>
      {!compact && canUpload && <p className="small muted mt">A ten-second clip of her doing it right is the best demo there is.</p>}
      {toast.el}
    </div>
  );
}
