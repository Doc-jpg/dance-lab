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
  { route: '/today', anchor: 'checkin', title: 'Start with how you feel', text: 'Tap Check in: dance or play you did today, energy, sleep, soreness, and whether anything hurts. Thirty seconds. The app picks the right kind of day from that.' },
  { route: '/today', anchor: 'ready', title: 'Green, yellow, orange, red', text: 'Green means fresh: the planned session. Yellow means dance day or a bit tired: the Easy workout. Orange means a recital or a very big day: a five-minute stretch is the whole thing. Red means something hurts or you are sick: two minutes of breathing and tell a grown-up. There is always something, and it always says why.' },
  { route: '/today', anchor: 'start', title: 'Start, or skip, no penalty', text: 'Start opens the session one move at a time with a picture, a big button that tells you what to tap, and the cues. Skip is always fine. Nothing is lost by skipping.' },
  { route: '/today', anchor: 'message', title: 'One fresh message a day', text: 'Water, food, sleep, recovery, a mini-challenge. A different one each day, matched to what you did.' },
  { route: '/workouts', anchor: 'templates', title: 'Your sessions and every exercise', text: 'Stretch and reach, Strong and steady, Happy feet, the Daily 5, the Easy workout, the Five-minute stretch and the Easy day. Below them, every move with what it builds, why it matters for dancing, the steps and the common mistakes.' },
  { route: '/progress', title: 'Progress against yourself only', text: 'Sessions, stork balance time, plank time, consistency. You are only ever compared with your own earlier self. Badges here are never taken away.' },
  { route: '/habits', title: 'Habits and missions', text: 'The Daily 5 (five easy minutes), the everyday habits (water, meals, sleep, play), and three missions for the week.' },
  { route: '/journal', title: 'Notes in your own words', text: '"Pike stretch reached further today." "Legs were tired after dance." Short notes like that help the app adjust. Mark a note private and only you see it.' },
  { route: '/settings', anchor: 'parent', title: 'What a parent can see', text: 'The parent view is behind a PIN. It shows completed sessions, dance and easy days, progress, and any safety alerts. It never shows notes you marked private. This card lists all of it; nothing is hidden.' }
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
