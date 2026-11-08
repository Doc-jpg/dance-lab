import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAthlete, useCheckIns, useExerciseMap, useFlags, useMessagesShown, useSessions, useSettings, useSportsLogs, useStatuses, useTemplates, useToday, fmtDateLong, fmtDate } from '../hooks';
import { useMode } from '../mode';
import { CheckInSheet, SportCard, newSportDraft, toLog, type SportDraft, type CheckInDraft } from '../components/CheckInSheet';
import { Sheet, useToast } from '../components/Sheet';
import { TourOffer } from '../components/Tour';
import { readinessFor, recordCheckIn, planSession, ensureMessageShown, type TodayContext } from '../../engine/today';
import { addSportsLog, db, updateSession } from '../../db/db';
import { pickMessage, daysSinceLastSession, CATEGORY_WORDS } from '../../engine/habits';
import { addDays, SPORT_WORDS, DURATION_WORDS, INTENSITY_WORDS, FEEL_WORDS, SLEEP_WORDS, type SportsLog, type Sport } from '../../engine/types';
import { estimateMinutes } from '../../engine/program';
import { COLOR_WORDS, chain } from '../../engine/readiness';
import { APP_NAME } from '../version';

export function TodayPage() {
  const nav = useNavigate();
  const day = useToday();
  const athlete = useAthlete();
  const settings = useSettings();
  const { mode } = useMode();
  const logs = useSportsLogs();
  const sessions = useSessions();
  const checkIns = useCheckIns();
  const templates = useTemplates();
  const exercises = useExerciseMap();
  const statuses = useStatuses();
  const shown = useMessagesShown();
  const flags = useFlags();
  const toast = useToast();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [sportOpen, setSportOpen] = useState<SportDraft | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const checkIn = checkIns.find((c) => c.day === day);
  const todayLogs = logs.filter((l) => l.day === day);
  const ctx: TodayContext | undefined = useMemo(() => (athlete ? { day, athlete, checkIn, logs, sessions, templates, exercises, statuses, strengthDaysPerWeek: settings.strengthDaysPerWeek } : undefined), [day, athlete, checkIn, logs, sessions, templates, exercises, statuses, settings.strengthDaysPerWeek]);
  const readiness = useMemo(() => (ctx && templates.length ? readinessFor(ctx) : undefined), [ctx, templates.length]);
  const todaySessions = sessions.filter((s) => s.day === day);
  const openSession = todaySessions.find((s) => (s.status === 'planned' || s.status === 'in_progress') && s.kind !== 'foundations');
  const doneToday = todaySessions.filter((s) => s.status === 'done');
  const foundationsDone = doneToday.some((s) => s.kind === 'foundations');
  const mainDone = doneToday.find((s) => s.kind !== 'foundations');
  const yesterday = addDays(day, -1);
  const ySessions = sessions.filter((s) => s.day === yesterday && s.status === 'done');
  const yLogs = logs.filter((l) => l.day === yesterday);

  const message = useMemo(() => pickMessage({ day, color: readiness?.color, todayLogs, yesterdayLogs: yLogs, daysSinceSession: daysSinceLastSession(sessions, day), sleepLow: checkIn ? checkIn.sleep <= 2 : false, shown, rotationDays: settings.reminders.rotationDays }, settings.reminders), [day, readiness?.color, todayLogs.length, yLogs.length, sessions.length, checkIn?.sleep, shown.length, settings.reminders]);
  useEffect(() => { if (message) ensureMessageShown(day, message.key, message.category).catch(() => undefined); }, [message?.key, day]);

  if (!athlete || !ctx) return null;
  const name = athlete.firstName;

  const saveCheckIn = async (sports: SportDraft[], draft: CheckInDraft) => {
    for (const s of sports) await addSportsLog(toLog(s, day, mode));
    const freshLogs = await db.sportsLogs.toArray();
    const { readiness: r } = await recordCheckIn({ ...draft, day, by: mode }, { ...ctx, logs: freshLogs });
    setCheckInOpen(false);
    toast.show(`${COLOR_WORDS[r.color]} day: ${r.headline}`);
  };

  const start = async (templateId: string) => {
    if (!checkIn) { setCheckInOpen(true); return; }
    if (!readiness) return;
    const existing = todaySessions.find((s) => s.templateId === templateId && (s.status === 'planned' || s.status === 'in_progress'));
    if (existing) { nav(`/workout/${existing.id}`); return; }
    const s = await planSession(templateId, readiness, ctx, mode);
    nav(`/workout/${s.id}`);
  };

  const skip = async () => {
    if (openSession) await updateSession(openSession.id, { status: 'skipped' });
    toast.show('Skipped. No penalty, ever.');
  };

  const offerMinutes = (templateId: string) => templates.find((t) => t.id === templateId)?.minutes ?? 15;
  const unacked = flags.filter((f) => !f.acknowledgedAt && f.day === day);

  return (
    <div className="col">
      <div className="hero">
        <div className="row between">
          <div><h1>Hey {name}</h1><div className="sub">{fmtDateLong(day)}{(() => { const c = chain(sessions, logs, day); return c.length ? ` · ${c.length} day${c.length === 1 ? '' : 's'} in a row` : ''; })()}</div></div>
          <Link to="/settings" className="btn sm" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', borderColor: 'transparent' }} aria-label="Settings">⚙︎</Link>
        </div>
      </div>
      <TourOffer />

      {/* 1. Check-in */}
      <div className="card" data-tour="checkin">
        {checkIn ? (
          <div className="row between">
            <div className="grow"><strong>You answered today's questions</strong><div className="small muted">Energy: {FEEL_WORDS[checkIn.energy]} · Sleep: {SLEEP_WORDS[checkIn.sleep]} · {checkIn.soreness === 'none' ? 'Not sore' : checkIn.soreness === 'some' ? 'A little sore' : 'Very sore'}{checkIn.pain ? ' · Something hurts' : ''}{checkIn.sick ? ' · Feeling sick' : ''}</div></div>
            <button className="btn sm" onClick={() => setCheckInOpen(true)}>Change my answers</button>
          </div>
        ) : (
          <div className="col">
            <div><strong>Start here: how are you today?</strong><div className="small muted">A few quick questions about what you did and how you feel. Then the app picks what you do today.</div></div>
            <button className="btn primary xl block" onClick={() => setCheckInOpen(true)}>Answer the questions</button>
          </div>
        )}
      </div>

      {/* 2. Sports already logged */}
      <div className="card">
        <div className="row between"><h3>What you did today</h3><button className="btn sm" onClick={() => setSportOpen(newSportDraft((athlete.sports[0] as Sport) || 'dance'))}>+ Add</button></div>
        {todayLogs.length === 0 ? <div className="small muted">Nothing added yet. Dance class, PE, playing outside: anything that got you moving.</div> : (
          <div className="list mt">{todayLogs.map((l) => <SportRow key={l.id} log={l} />)}</div>
        )}
      </div>

      {/* 3. Readiness and the recommendation */}
      {readiness && (
        <div className={`ready ${readiness.color}`} data-tour="ready">
          <div className="row between">
            <div className="row"><span className="color-dot" /><h2>{checkIn ? readiness.headline : 'Answer the questions first'}</h2></div>
            <span className={`pill ${readiness.color}`}>{checkIn ? COLOR_WORDS[readiness.color] : 'Not yet'}</span>
          </div>
          {checkIn && (
            <>
              <ul className="why">{readiness.reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}{readiness.blockedWhy.map((r, i) => <li key={'b' + i}>{r}</li>)}</ul>
              {readiness.reasons.length > 3 && <button className="btn ghost sm" onClick={() => setWhyOpen(true)}>Why this day</button>}
              {readiness.color !== 'red' && <div className="small muted mt">The color is a helper, not a doctor. If something really hurts, tell a grown-up.</div>}
            </>
          )}
          {!checkIn && <div className="small muted mt">The app picks your day from your answers, plus what you did the last few days.</div>}
        </div>
      )}

      {/* 4. Start / Skip */}
      <div className="card" data-tour="start">
        {mainDone ? (
          <div className="row between"><div><strong>{mainDone.templateName} done</strong><div className="small muted">Nice work. See the summary or add a note.</div></div><Link className="btn sm" to={`/sessions/${mainDone.id}`}>Summary</Link></div>
        ) : readiness?.color === 'red' && checkIn ? (
          <div className="col">
            <div><strong>Today: Easy day</strong><div className="small">Two minutes of slow breathing. That is your whole day, and it still counts. Tell a grown-up how you feel. Rest, water, food. Tomorrow you answer the questions again.</div></div>
            {openSession && openSession.status === 'in_progress' ? (
              <button className="btn primary xl block" onClick={() => nav(`/workout/${openSession.id}`)}>Continue Easy day</button>
            ) : (
              <button className="btn primary xl block" onClick={() => start('easy')}>Start the easy day</button>
            )}
            <Link className="btn block" to="/journal">Write a note about it</Link>
          </div>
        ) : readiness?.offer ? (
          <div className="col">
            <div><strong>{checkIn ? 'Today: ' : 'If today is a normal day: '}{readiness.offer.name}</strong><div className="small muted">About {offerMinutes(readiness.offer.templateId)} minutes{readiness.offer.reduced ? '. Each move just once, nice and easy' : ''}. {readiness.offer.kind === 'recovery' ? 'That is the whole workout today. Five minutes and you are done.' : ''}</div></div>
            {openSession && openSession.status === 'in_progress' ? (
              <button className="btn primary xl block" onClick={() => nav(`/workout/${openSession.id}`)}>Continue {openSession.templateName}</button>
            ) : (
              <button className="btn primary xl block" onClick={() => start(readiness.offer.templateId)}>{checkIn ? 'Start' : 'Answer the questions, then start'}</button>
            )}
            <div className="row">
              <button className="btn grow" onClick={skip}>Skip today</button>
              <Link className="btn grow" to="/workouts">Pick a different one</Link>
            </div>
          </div>
        ) : null}
        {readiness && readiness.foundations !== 'no' && !foundationsDone && (
          <div className="row between mt" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div className="grow"><strong>Daily 5</strong><div className="small muted">Five easy minutes you can add on any day{readiness.foundations === 'optional' ? ', but only if it feels good today' : ''}.</div></div>
            <button className="btn sm" onClick={() => start('foundations')}>Do it</button>
          </div>
        )}
        {foundationsDone && <div className="small muted mt">Daily 5 done today.</div>}
      </div>

      {/* 5. Message */}
      {message && (
        <div className="msg" data-tour="message">
          <div className="cat">{CATEGORY_WORDS[message.category]}</div>
          <div className="text">{message.text}</div>
        </div>
      )}
      {unacked.length > 0 && mode === 'athlete' && <div className="banner warn small">Your answers today are marked for a grown-up to see. That is the app doing its job. You are not in trouble.</div>}

      {/* 6. Yesterday */}
      <div className="card">
        <div className="row between"><h3>Yesterday</h3><Link className="small" to="/progress">See everything</Link></div>
        {ySessions.length === 0 && yLogs.length === 0 ? <div className="small muted">Nothing added for {fmtDate(yesterday)}. That is fine.</div> : (
          <div className="list mt">
            {ySessions.map((s) => <Link key={s.id} className="item tappable" to={`/sessions/${s.id}`}><div className="grow"><div className="title">{s.templateName}</div><div className="sub">{s.items.filter((i) => i.sets.some((x) => x.done)).length} exercises{s.overallDifficulty ? ` · felt ${['', 'easy', 'pretty easy', 'okay', 'hard', 'very hard'][s.overallDifficulty]}` : ''}{s.note ? ` · "${s.note}"` : ''}</div></div><span className="chev">›</span></Link>)}
            {yLogs.map((l) => <SportRow key={l.id} log={l} />)}
          </div>
        )}
      </div>

      {checkInOpen && <CheckInSheet name={name} onSave={saveCheckIn} onClose={() => setCheckInOpen(false)} />}
      {sportOpen && (
        <Sheet title="Add something you did" onClose={() => setSportOpen(null)} footer={<><button className="btn" onClick={() => setSportOpen(null)}>Cancel</button><button className="btn primary" onClick={async () => { await addSportsLog(toLog(sportOpen, day, mode)); setSportOpen(null); toast.show('Added'); }}>Add</button></>}>
          <div className="chips mb">{(['dance', 'gymnastics', 'pe', 'play', 'swimming', 'bike', 'other'] as Sport[]).map((s) => <button key={s} className={`chip sm ${sportOpen.sport === s ? 'on' : ''}`} onClick={() => setSportOpen({ ...sportOpen, sport: s })}>{SPORT_WORDS[s]}</button>)}</div>
          <SportCard draft={sportOpen} onChange={setSportOpen} onRemove={() => setSportOpen(null)} />
        </Sheet>
      )}
      {whyOpen && readiness && (
        <Sheet title="Why this day" onClose={() => setWhyOpen(false)}>
          <ul className="why">{[...readiness.reasons, ...readiness.blockedWhy].map((r, i) => <li key={i}>{r}</li>)}</ul>
          <p className="small muted mt">Activity load today {readiness.loadToday}, yesterday {readiness.loadYesterday} (each activity scores 1 to 9 from how long and how hard).</p>
        </Sheet>
      )}
      {toast.el}
    </div>
  );
}

export function SportRow({ log, onRemove }: { log: SportsLog; onRemove?: () => void }) {
  const extras = [log.performance && 'performance day', log.heavyJumping && 'lots of jumping'].filter(Boolean).join(', ');
  return (
    <div className="item">
      <div className="grow"><div className="title">{SPORT_WORDS[log.sport]}{log.label ? ` · ${log.label}` : ''}</div><div className="sub">{DURATION_WORDS[log.duration]} · {INTENSITY_WORDS[log.intensity]}{extras ? ` · ${extras}` : ''}</div></div>
      {onRemove && <button className="btn ghost sm" onClick={onRemove}>Remove</button>}
    </div>
  );
}
