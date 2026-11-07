/**
 * The family's own exercise clips: short videos of the athlete doing a move, shot on a parent's
 * phone, stored in a private bucket in the family's cloud project, keyed by the family code like
 * everything else. Metadata (the `clips` table) syncs through records; the file lives in storage.
 * Nothing here touches YouTube. Clips are fetched with the family key and shown from a local blob.
 */
import { db, getSettings, noteChange } from '../db/db';
import type { Clip, Who } from '../engine/types';
import { newId, nowIso } from '../engine/types';
import { SYNC_CONFIG } from '../sync-config';

const BUCKET = 'clips';
const MAX_BYTES = 60 * 1024 * 1024;

function headers(secret: string): Record<string, string> {
  return { apikey: SYNC_CONFIG.anonKey, Authorization: `Bearer ${SYNC_CONFIG.anonKey}`, 'x-family-key': secret };
}

export async function clipsAvailable(): Promise<boolean> {
  const s = await getSettings();
  return !!SYNC_CONFIG.url && !!s.sync?.enabled;
}

/** Upload a clip for an exercise. The parent does this; the metadata row then syncs to the other phone. */
export async function uploadClip(exerciseId: string, file: File, by: Who, note?: string): Promise<Clip> {
  const s = await getSettings();
  if (!s.sync?.enabled) throw new Error('Connect the phones first (Linked phones) so the clip has a family to belong to.');
  if (file.size > MAX_BYTES) throw new Error('That clip is over 60 MB. Trim it to ten or twenty seconds and try again.');
  const id = newId();
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const path = `${s.sync.familyId}/${exerciseId}/${id}.${ext}`;
  const res = await fetch(`${SYNC_CONFIG.url}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { ...headers(s.sync.secret), 'Content-Type': file.type || 'video/mp4', 'x-upsert': 'false' }, body: file });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  const ts = nowIso();
  const clip: Clip = { id, exerciseId, path, mime: file.type || 'video/mp4', bytes: file.size, note, by, createdAt: ts, updatedAt: ts };
  await db.clips.put(clip);
  noteChange();
  return clip;
}

const urlCache = new Map<string, string>();

/** A local object URL for a clip, fetched with the family key. Cached for the session. */
export async function clipObjectUrl(clip: Clip): Promise<string> {
  const cached = urlCache.get(clip.id);
  if (cached) return cached;
  const s = await getSettings();
  if (!s.sync?.enabled) throw new Error('Not connected');
  const res = await fetch(`${SYNC_CONFIG.url}/storage/v1/object/authenticated/${BUCKET}/${clip.path}`, { headers: headers(s.sync.secret) });
  if (!res.ok) throw new Error(`Could not load the clip (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  urlCache.set(clip.id, url);
  return url;
}

/** Remove a clip: the file from the bucket (best effort) and the metadata row (with a tombstone so the other phone drops it too). */
export async function deleteClip(clip: Clip): Promise<void> {
  const s = await getSettings();
  if (s.sync?.enabled) {
    try { await fetch(`${SYNC_CONFIG.url}/storage/v1/object/${BUCKET}/${clip.path}`, { method: 'DELETE', headers: headers(s.sync.secret) }); } catch { /* the row still goes; the file is orphaned at worst */ }
  }
  await db.transaction('rw', db.clips, db.tombstones, async () => {
    await db.clips.delete(clip.id);
    await db.tombstones.put({ key: `clips:${clip.id}`, tbl: 'clips', id: clip.id, ts: nowIso() });
  });
  const u = urlCache.get(clip.id);
  if (u) { URL.revokeObjectURL(u); urlCache.delete(clip.id); }
  noteChange();
}
