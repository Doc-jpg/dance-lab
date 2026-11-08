import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAthlete, useSettings } from '../hooks';
import { saveSettings } from '../../db/db';
import { nowIso } from '../../engine/types';

/**
 * A one-minute guided tour on the real screens with the real buttons lit. Offered once on Today,
 * from the last setup step, and from Help any time. Finishing or skipping stamps settings.tourSeenAt.
 */
interface Stop { route: string; anchor?: string; title: string; text: string }

const STOPS: Stop[] = [
  { route: '/today', anchor: 'quickcheck', title: 'First, the quick check', text: 'At the top of Today, a few quick questions: have you gone to the bathroom, had some water, brushed your teeth, fed Bear and Teddy, got ready for the day. The questions change with the time of day. If one is "not yet", go do it and come back. The app waits.' },
  { route: '/today', anchor: 'checkin', title: 'Then, how you feel', text: 'Tap Answer the questions. It asks what you did today (dance, playing), how much energy you have, how you slept, if you are sore, and if anything hurts. It takes about thirty seconds. Then the app picks what you do today.' },
  { route: '/today', anchor: 'ready', title: 'Every day gets a color', text: 'Green means you feel fresh: you do the normal workout. Yellow means you had dance today or you are a bit tired: you do the Short gentle workout. Orange means a recital or a really big day: the five-minute stretch is the whole thing. Red means something hurts or you are sick: two minutes of breathing, and tell a grown-up. There is always something small to do, and the app always tells you why it picked it.' },
  { route: '/today', anchor: 'start', title: 'Start, or skip. Both are fine', text: 'Start shows you one move at a time: a picture, a big button that tells you exactly what to tap, and a few tips. Skipping is always allowed. You never lose anything by skipping.' },
  { route: '/today', anchor: 'message', title: 'One little message a day', text: 'A tip about water, food, sleep or rest, or a fun thing to try. A different one each day, picked to match what you did.' },
  { route: '/workouts', anchor: 'templates', title: 'Your workouts and every move', text: 'Stretch and reach, Strong and steady, Happy feet, the Five-minute mini workout, the Short gentle workout, the Five-minute stretch and Just breathing. Under them is every single move, with what it makes stronger or bendier, why it helps your dancing, how to do it step by step, and the mistakes to watch for.' },
  { route: '/progress', title: 'Your progress', text: 'How many workouts, your longest stork balance, your longest plank, and how many days in a row. You are only ever compared with the old you, never with anyone else. Badges you earn are never taken away.' },
  { route: '/habits', title: 'Habits and missions', text: 'The Five-minute mini workout (five easy minutes you can add any day), the good everyday things (water, meals, sleep, playing), and three little challenges for the week.' },
  { route: '/journal', title: 'Notes in your own words', text: '"Pike stretch reached further today." "Legs were tired after dance." Short notes like that help the app pick better days. Mark a note private and only you can see it.' },
  { route: '/settings', anchor: 'parent', title: 'What a grown-up can see', text: 'Your parent has a page that opens with a secret number. It shows your finished workouts, dance days, gentle days, progress, and any warnings. It never shows notes you marked private. This card lists all of it. Nothing is hidden from you.' }
];

interface TourApi { start: () => void; active: boolean }
const TourCtx = createContext<TourApi>({ start: () => undefined, active: false });
export const useTour = () => useContext(TourCtx);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<number | null>(null);
  const api = useMemo(() => ({ start: () => setStep(0), active: step !== null }), [step]);
  return (
    <TourCtx.Provider value={api}>
      {children}
      {step !== null && <TourOverlay step={step} setStep={setStep} />}
    </TourCtx.Provider>
  );
}

function TourOverlay({ step, setStep }: { step: number; setStep: (s: number | null) => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const stop = STOPS[step];
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => { if (loc.pathname !== stop.route) nav(stop.route); }, [step]);
  useLayoutEffect(() => {
    let tries = 0;
    let timer: number | undefined;
    const find = () => (stop.anchor ? (document.querySelector(`[data-tour="${stop.anchor}"]`) as HTMLElement | null) : null);
    const measure = () => {
      const el = find();
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }); setRect(el.getBoundingClientRect()); }
      else { setRect(null); if (stop.anchor && tries++ < 8) timer = window.setTimeout(measure, 120); }
    };
    timer = window.setTimeout(measure, 80);
    const onMove = () => { const el = find(); if (el) setRect(el.getBoundingClientRect()); };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => { window.clearTimeout(timer); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); };
  }, [step, loc.pathname]);
  const finish = async () => { setStep(null); await saveSettings({ tourSeenAt: nowIso() }); nav('/today'); };
  const pad = 6;
  const cardOnTop = rect ? rect.top + rect.height / 2 > window.innerHeight * 0.55 : false;
  return (
    <>
      {rect ? <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} /> : <div className="tour-mask" style={{ background: 'rgba(10,14,20,0.5)' }} />}
      <div className={`tour-card ${cardOnTop ? 'top' : ''}`} role="dialog" aria-label="Guided tour">
        <div className="step">Tour · {step + 1} of {STOPS.length}</div>
        <h3>{stop.title}</h3>
        <p className="small" style={{ margin: '4px 0 10px' }}>{stop.text}</p>
        <div className="row between">
          <button className="btn ghost sm" onClick={finish}>{step + 1 < STOPS.length ? 'Skip the rest' : 'Done'}</button>
          <div className="row">
            {step > 0 && <button className="btn sm" onClick={() => setStep(step - 1)}>Back</button>}
            {step + 1 < STOPS.length ? <button className="btn primary" onClick={() => setStep(step + 1)}>Next ›</button> : <button className="btn primary" onClick={finish}>Done, let's go</button>}
          </div>
        </div>
      </div>
    </>
  );
}

export function TourOffer() {
  const settings = useSettings();
  const athlete = useAthlete();
  const tour = useTour();
  if (!athlete || settings.tourSeenAt || tour.active) return null;
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
      <div className="row between">
        <div className="grow"><strong>New here?</strong><div className="small muted">A one-minute tour of the five screens.</div></div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => saveSettings({ tourSeenAt: nowIso() })}>Not now</button>
          <button className="btn primary sm" onClick={tour.start}>Take the tour</button>
        </div>
      </div>
    </div>
  );
}
