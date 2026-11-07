import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTour } from '../components/Tour';
import { useAthlete } from '../hooks';
import { APP_NAME } from '../version';

const FAQ: Array<[string, string]> = [
  ['What do the colors mean?', 'Green: fresh, do the planned session. Yellow: dance class today, short sleep, or a little sore; the Easy workout, one set each, gentle. Orange: a recital, a show, a competition or a very big day; the five-minute stretch is the whole workout. Red: something hurts, you feel sick or dizzy; no workout, just the Easy day (two minutes of breathing) and tell a grown-up. Every color has something to do, because the habit is the point. The colors are a guide for a healthy kid, never a doctor\'s opinion.'],
  ['What are the three sessions?', 'They take turns. Stretch and reach is the big flexibility day: butterfly, straddle, pike, lunges, half splits, frog, figure four. Strong and steady is body-weight strength: squats, bridges, wall push-ups, plank, dead bugs, superman, a bear crawl. Happy feet is feet, ankles and balance: relevés, towel scrunches, point and flex, stork, arabesque, tightrope walk, soft landings. Strength days keep a day between them; stretch and feet days are gentle enough for any day.'],
  ['Why did it give me the Easy workout on a dance day?', 'Dance class already warmed you up and worked you. On top of that, a short gentle session is better than a long one: a few stretches while you are still warm, a little balance, breathing. The big sessions come on days without class.'],
  ['How far should I stretch?', 'To a good pull, never a pinch, a burn or a shake. Breathe out and let the stretch happen; never bounce, and never let anyone push you deeper. Hold 15 to 30 seconds. Flexibility comes from warm muscles, slow holds and doing a little every day, not from forcing one big stretch.'],
  ['Why are there no bridges, backbends or neck stretches?', 'Your spine is still growing. Deep backbends and bridges put a lot of pressure on the lower back at this age, and neck stretches are easy to overdo. Cobra is small and gentle on purpose. Your dance teacher can take you further in class when she is right there watching.'],
  ['Will the app ever add weight or make it harder on its own?', 'There are no weights at all; everything is your own body. It only ever adds a few reps or seconds, then a set, and only after two sessions in a row felt easy and were fully done. A harder version (wall push-up to couch push-up, stork to arabesque) is offered, never forced.'],
  ['I missed a few days. Did I lose anything?', 'No. Nothing is lost, no streak breaks, no badge goes away, no message scolds you. Check in and pick it back up. Even just the Daily 5 counts.'],
  ['Why does it say "Holding steady"?', 'Progress comes from form and doing it often, not from adding every week. In weeks 1 and 2 nothing is added on purpose. After that the app adds a little only when the last two sessions of that exercise were completed and felt easy.'],
  ['Can I do a different session than the one it suggests?', 'Yes. Workouts lists all of them. If you pick something other than the suggestion, the app says why it suggested what it did, then lets you go. Body parts it wants to rest stay swapped out even then.'],
  ['How do I know what a move is supposed to look like?', 'The drawing on every exercise shows the shape, and moves between the start and the finish when the move has one. Every exercise page has the steps, three cues and the common mistakes. And if a parent has added a clip of you doing it, "Watch it" shows that.'],
  ['What is the Daily 5?', 'Five easy minutes: balloon breathing, cat and cow, starfish, ankle rocks, butterfly and the stork. It is moving, not training, so it is fine on most days on top of whatever else. Skip it when you are sick, hurt or wiped out; the Easy day covers those.'],
  ['Is there a day with nothing to do?', 'No. Fresh day: a session. Dance day or a bit tired: the Easy workout. Recital or a very big day: the five-minute stretch. Sick or hurt: two minutes of breathing. Something small every day is how it becomes a habit, and a five-minute day counts exactly the same as a long one.'],
  ['I do not know what a move is or what it works.', 'You do not need to. Every exercise page says what it builds in plain words, why it matters for dancing, how to do it step by step, and has a moving drawing. In a session you only ever see one move at a time with the picture and the cues. The app just tells you what to do next.'],
  ['What can my parent see?', 'Finished and skipped sessions, dance and play logged, check-ins, easy days, progress, badges, journal notes that are not private, and safety alerts (pain, sick, dizzy, a stopped session, a performance day, a week with no rest day). Not private notes. The full list is on Settings under "What a parent can see".'],
  ['Does it work offline?', 'Yes, all of it. Open it once online after installing, then it runs with no signal. Everything is stored on this device. Linked devices catch up whenever either one has a signal; a backup file (Settings, Backup) works too.'],
  ['How do I install it on the home screen?', 'iPhone or iPad: open the address in Safari, tap Share, then Add to Home Screen. Android: open it in Chrome, menu, Install app. Open it once while online so it can store itself for offline use.'],
  ['What about food and weight?', 'Real food, water, and sleep. The app never talks about weight, shape, calories or dieting, and never will. Dancers eat; that is where the energy for class comes from.'],
  ['Something hurts during a session.', 'Tap Stop, pick "Something hurts", and tell a grown-up. The app marks it for the parent and stops suggesting sessions until the next check-in says it is gone. Pain is not something to push through, and the app does not decide whether to see a doctor; a parent does.'],
  ['How do I back up?', 'Settings, Back up everything, then share the file to Files, iCloud Drive, or a computer. Do it every few weeks. A parent pack is the same without private notes, for a parent\'s device.'],
  ['Why is the app asking me to tell a grown-up?', 'Because you reported pain, feeling sick or dizziness, or stopped a session for one of those. The app is a guide, not a teacher or a doctor. A grown-up decides what happens next.']
];

export function HelpPage() {
  const tour = useTour();
  const nav = useNavigate();
  const athlete = useAthlete();
  const [q, setQ] = useState('');
  const shown = FAQ.filter(([a, b]) => !q || (a + ' ' + b).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="col">
      <div className="row between"><h1>Help</h1>{athlete && <Link className="btn sm" to="/settings">Settings</Link>}</div>
      <div className="card">
        <p className="small">{APP_NAME} is a guide for flexibility, body-weight strength, balance, happy feet and healthy habits, made for a dancer. It adjusts to the dance and play already done each day, says why, and never punishes a missed day. It is not medical advice and does not replace a doctor or a dance teacher.</p>
        {athlete && <button className="btn primary block" onClick={() => { nav('/today'); setTimeout(tour.start, 150); }}>Take the one-minute tour</button>}
      </div>
      <input className="input" placeholder="Search the questions" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card">
        {shown.map(([a, b]) => <details key={a} className="faq"><summary>{a}</summary><p className="small">{b}</p></details>)}
        {shown.length === 0 && <div className="small muted">Nothing matches.</div>}
      </div>
    </div>
  );
}
