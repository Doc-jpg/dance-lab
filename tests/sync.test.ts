import { describe, it, expect } from 'vitest';
import { DanceLabDB, createAthlete, saveSession, addJournal, setExerciseStatus, deleteJournal, setParentPin, getSettings, addGoal } from '../src/db/db';
import { startFamily, joinFamily, syncNow, makeFamilyCode, formatCode, normalizeCode, familyLink } from '../src/io/sync';
import { SYNC_CONFIG } from '../src/sync-config';
import { sha256Hex } from '../src/io/hash';
import type { Session } from '../src/engine/types';

let n = 0;
const fresh = () => new DanceLabDB('sync-' + Date.now() + '-' + n++);

function session(day: string, patch: Partial<Session> = {}): Session {
  const ts = day + 'T18:00:00.000Z';
  return { id: 'sess-' + day, day, templateId: 'strength', templateName: 'Strong and steady', kind: 'strength', status: 'done', why: [], items: [], by: 'athlete', createdAt: ts, updatedAt: ts, ...patch };
}

/** An in-memory stand-in for the server with the same rules: family isolation, older copy never overwrites, server_ts on accept. */
function fakeServer() {
  const rows = new Map<string, any>();
  let clock = 1;
  const fetchImpl = async (url: string, init: any = {}) => {
    const secret = init.headers?.['x-family-key'] ?? '';
    const fid = await sha256Hex(secret);
    if (init.method === 'POST') {
      const body = JSON.parse(init.body);
      for (const r of body) {
        if (r.family_id !== fid) return { ok: false, status: 401, json: async () => ({}), text: async () => 'rls' };
        const key = `${r.family_id}|${r.tbl}|${r.id}`;
        const cur = rows.get(key);
        if (cur && r.stamp < cur.stamp) continue;
        rows.set(key, { ...r, server_ts: new Date(Date.UTC(2026, 10, 2, 0, 0, clock++)).toISOString() });
      }
      return { ok: true, status: 201, json: async () => [], text: async () => '' };
    }
    const u = new URL(url, 'https://x');
    const gt = decodeURIComponent((u.searchParams.get('server_ts') ?? 'gt.1970').slice(3));
    const offset = Number(u.searchParams.get('offset') ?? 0);
    const out = [...rows.values()].filter((r) => r.family_id === fid && r.server_ts > gt).sort((a, b) => a.server_ts.localeCompare(b.server_ts)).slice(offset, offset + 500);
    return { ok: true, status: 200, json: async () => out, text: async () => '' };
  };
  return { fetchImpl, rows };
}

const cfg = { url: 'https://fake', anonKey: 'k' };

describe('family code and link', () => {
  it('makes a 20-character code without confusable letters, formats and normalizes it', () => {
    const c = makeFamilyCode();
    expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{20}$/);
    expect(formatCode(c).split('-').length).toBe(4);
    expect(normalizeCode(formatCode(c).toLowerCase())).toBe(c);
    expect(familyLink(c)).toContain(`#/join?k=${c}`);
  });
});

describe('automatic sync between two phones (fake server)', () => {
  it('a workout on the athlete phone shows up on the parent phone; an approval on the parent phone shows up on the athlete phone', async () => {
    const { fetchImpl } = fakeServer();
    const vivi = fresh();
    const dad = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, vivi);
    const fam = await startFamily('vivi-phone', vivi);
    await joinFamily(formatCode(fam.secret), 'dad-phone', dad);
    await saveSession(session('2026-11-01'), vivi);
    const r1 = await syncNow(vivi, fetchImpl, cfg);
    expect(r1.error).toBeUndefined();
    expect(r1.pushed).toBeGreaterThanOrEqual(2); // athlete + session
    const r2 = await syncNow(dad, fetchImpl, cfg);
    expect(r2.applied).toBeGreaterThanOrEqual(2);
    expect((await dad.athlete.get('athlete'))?.firstName).toBe('Vivi');
    expect((await dad.sessions.get('sess-2026-11-01'))?.status).toBe('done');
    await setExerciseStatus('st-inclinepush', { formCheckedAt: '2026-11-02T10:00:00.000Z', disabled: true }, dad);
    await syncNow(dad, fetchImpl, cfg);
    await syncNow(vivi, fetchImpl, cfg);
    expect((await vivi.exerciseStatus.get('st-inclinepush'))?.disabled).toBe(true);
  });

  it('private journal entries never leave the phone; shared ones do; a deletion reaches the other phone', async () => {
    const { fetchImpl, rows } = fakeServer();
    const vivi = fresh();
    const dad = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, vivi);
    const fam = await startFamily('vivi', vivi);
    await joinFamily(fam.secret, 'dad', dad);
    await addJournal({ day: '2026-11-01', text: 'private thought', isPrivate: true, by: 'athlete' }, vivi);
    const shared = await addJournal({ day: '2026-11-01', text: 'push-ups easier', isPrivate: false, by: 'athlete' }, vivi);
    await syncNow(vivi, fetchImpl, cfg);
    expect([...rows.values()].some((r) => r.tbl === 'journal' && r.data?.text === 'private thought')).toBe(false);
    await syncNow(dad, fetchImpl, cfg);
    expect((await dad.journal.toArray()).map((j) => j.text)).toEqual(['push-ups easier']);
    await deleteJournal(shared.id, vivi);
    await syncNow(vivi, fetchImpl, cfg);
    await syncNow(dad, fetchImpl, cfg);
    expect(await dad.journal.count()).toBe(0);
  });

  it('is idempotent, keeps the newer copy on conflict, and never sends PINs or settings', async () => {
    const { fetchImpl, rows } = fakeServer();
    const vivi = fresh();
    const dad = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, vivi);
    await setParentPin('7101', vivi);
    const fam = await startFamily('vivi', vivi);
    await joinFamily(fam.secret, 'dad', dad);
    await saveSession(session('2026-11-01', { status: 'done' }), vivi);
    await syncNow(vivi, fetchImpl, cfg);
    await syncNow(dad, fetchImpl, cfg);
    // Both phones add a goal before either syncs: both goals survive on both phones (union by id).
    await addGoal('Feel quicker', 'athlete', vivi);
    await new Promise((r) => setTimeout(r, 5));
    await addGoal('Plank 45 seconds', 'parent', dad);
    await syncNow(dad, fetchImpl, cfg);
    await syncNow(vivi, fetchImpl, cfg);
    await syncNow(dad, fetchImpl, cfg);
    expect((await vivi.athlete.get('athlete'))!.goals.map((g) => g.text).sort()).toEqual(['Feel quicker', 'Plank 45 seconds']);
    expect((await dad.athlete.get('athlete'))!.goals.map((g) => g.text).sort()).toEqual(['Feel quicker', 'Plank 45 seconds']);
    expect((await dad.sessions.get('sess-2026-11-01'))?.status).toBe('done');
    const again = await syncNow(vivi, fetchImpl, cfg);
    expect(again.pushed).toBe(0);
    expect(again.applied).toBe(0);
    expect([...rows.values()].some((r) => r.tbl === 'settings' || JSON.stringify(r).includes('pinHash'))).toBe(false);
    expect((await getSettings(dad)).parentPinHash).toBeUndefined();
  });

  it('another family cannot see the rows', async () => {
    const { fetchImpl, rows } = fakeServer();
    const vivi = fresh();
    const stranger = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, vivi);
    await startFamily('vivi', vivi);
    await startFamily('x', stranger);
    await saveSession(session('2026-11-01'), vivi);
    await syncNow(vivi, fetchImpl, cfg);
    const r = await syncNow(stranger, fetchImpl, cfg);
    expect(r.pulled).toBe(0);
    expect(rows.size).toBeGreaterThan(0);
  });

  it('without a family the app just works offline (sync skipped)', async () => {
    const vivi = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, vivi);
    const r = await syncNow(vivi, fakeServer().fetchImpl, cfg);
    expect(r.skipped).toBe(true);
  });
});

const LIVE = (globalThis as any).process?.env?.LIVE_SYNC === '1';
describe.skipIf(!LIVE)('live Supabase round trip', () => {
  it('two fresh databases meet at the real server', async () => {
    const vivi = fresh();
    const dad = fresh();
    await createAthlete({ firstName: 'Vivi', birthYear: 2017, sports: [] }, vivi);
    const fam = await startFamily('test-vivi', vivi);
    await joinFamily(fam.secret, 'test-dad', dad);
    await saveSession(session('2026-11-01'), vivi);
    const r1 = await syncNow(vivi, globalThis.fetch as any, SYNC_CONFIG);
    expect(r1.error).toBeUndefined();
    const r2 = await syncNow(dad, globalThis.fetch as any, SYNC_CONFIG);
    expect(r2.error).toBeUndefined();
    expect((await dad.sessions.get('sess-2026-11-01'))?.status).toBe('done');
  }, 30000);
});
