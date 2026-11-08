import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTour } from '../components/Tour';
import { useAthlete } from '../hooks';
import { APP_NAME } from '../version';

const FAQ: Array<[string, string]> = [
  ['What do the colors mean?', 'Green: you feel fresh, so you do the normal workout. Yellow: you had dance today, or you did not sleep much, or you are a little sore. You do the Easy workout, each move once, nice and gentle. Orange: a recital, a show, a competition, or a really big day. The five-minute stretch is the whole workout. Red: something hurts, or you feel sick or dizzy. No workout, just the Easy day (two minutes of breathing), and tell a grown-up. Every color has something small to do, because doing a little every day is the whole point. The color is a helper, not a doctor.'],
  ['What are the three main workouts?', 'They take turns. Stretch and reach is the big stretching day: butterfly, straddle, pike, lunges, half splits, frog, figure four. Strong and steady is the strong day, using only your own body: squats, bridges, wall push-ups, plank, dead bugs, superman, a bear crawl. Happy feet is the feet, ankles and balance day: relevés, towel scrunches, point and flex, stork, arabesque, tightrope walk, soft landings. You get a day off between strong days. Stretch days and feet days are gentle enough for any day.'],
  ['Why did it give me the Easy workout on a dance day?', 'Dance class already warmed you up and worked your body. After that, a short gentle workout is better than a long one: a few stretches while you are still warm, a little balance, some breathing. The big workouts come on days when you do not have class.'],
  ['How far should I stretch?', 'Until it feels like a good pull. Never a pinch, a burn or a shake. Breathe out and let the stretch happen slowly. Never bounce, and never let anyone push you deeper. Hold each stretch for 15 to 30 seconds. Being bendy comes from warm muscles, slow holds and doing a little every day, not from forcing one big stretch.'],
  ['Why are there no bridges, backbends or neck stretches?', 'Because your back is still growing. Big backbends and bridges push hard on the lower back at your age, and neck stretches are easy to overdo. Baby cobra is small and gentle on purpose. Your dance teacher can take you further in class, when she is right there watching you.'],
  ['Will the app ever make it harder on its own?', 'There are no weights at all. Everything is just your own body. The app only ever adds a few more times or a few more seconds, then one more round, and only after two workouts in a row felt easy and you finished them. A harder version (wall push-up to couch push-up, stork to arabesque) is offered to you, never forced.'],
  ['I missed a few days. Did I lose anything?', 'No. Nothing is lost. No badge goes away. No message scolds you. Just answer the questions and start again. Even just the Daily 5 counts.'],
  ['Why does it say "Staying the same"?', 'Getting better comes from doing the moves nicely and doing them often, not from adding more every week. In weeks 1 and 2 nothing is added on purpose. After that the app adds a little only when the last two times you did that move felt easy and you finished them.'],
  ['Can I do a different workout than the one it picked?', 'Yes. The Workouts page lists all of them. If you pick a different one, the app tells you why it picked what it picked, then lets you go. Moves for a body part that needs a rest today are still left out.'],
  ['How do I know what a move is supposed to look like?', 'The drawing on every move shows the shape, and it moves when the move has a start and a finish. Every move has its own page with the steps, three tips, and the mistakes to watch for. And if a grown-up has added a video clip of you doing it, "Watch it" shows that.'],
  ['What is the Daily 5?', 'Five easy minutes: balloon breathing, cat and cow, starfish, ankle rocks, butterfly and the stork balance. It is moving, not a workout, so it is fine on most days on top of whatever else you do. Skip it when you are sick, hurt or wiped out. The Easy day covers those.'],
  ['Is there ever a day with nothing to do?', 'No. Fresh day: a workout. Dance day or a bit tired: the Easy workout. Recital or a really big day: the five-minute stretch. Sick or hurt: two minutes of breathing. Something small every day is how it becomes a habit. A five-minute day counts exactly the same as a long one.'],
  ['I do not know what a move is or what it is for.', 'You do not need to. Every move has a page that says what it makes stronger or bendier, why it helps your dancing, and how to do it step by step, with a moving drawing. In a workout you only ever see one move at a time, with the picture and the tips. The app just tells you what to do next.'],
  ['What can my parent see?', 'Workouts you finished or skipped, what you did each day (dance, playing), your answers to the questions, easy days, progress, badges, journal notes that are not marked private, and warnings (something hurt, you felt sick or dizzy, you stopped a workout, a recital day, a week with no rest day). Not private notes. The whole list is on Settings under "What a parent can see".'],
  ['Does it work with no internet?', 'Yes, all of it. Open it once while you are online after it is installed. After that it works with no signal at all. Everything is saved on this device. When you are online again, it sends your stuff to your parent\'s phone by itself.'],
  ['How do I put it on the home screen?', 'iPad or iPhone: open the address in Safari, tap Share, then Add to Home Screen. Android: open it in Chrome, tap the menu, then Install app. Open it once while online so it can save itself for when there is no internet.'],
  ['What about food and weight?', 'Real food, water, and sleep. The app never talks about weight, how you look, calories or diets, and it never will. Dancers eat. That is where the energy for class comes from.'],
  ['Something hurts during a workout.', 'Tap Stop, tap "Something hurts", and tell a grown-up. The app marks it for your parent and does not give you workouts until the next time you answer the questions and say it is gone. You never keep going when something hurts. A grown-up decides about the doctor, not the app.'],
  ['How do I make a backup?', 'That is a grown-up job. Settings, Back up everything, then save the file to Files, iCloud Drive, or a computer. Every few weeks is plenty.'],
  ['Why is the app telling me to tell a grown-up?', 'Because you said something hurts, or that you feel sick or dizzy, or you stopped a workout for one of those. The app is a helper, not a teacher or a doctor. A grown-up decides what happens next.']
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
        <p className="small">{APP_NAME} helps a dancer get bendier, stronger and steadier, a little bit every day. It looks at the dance and play you already did, picks what to do, and always says why. It never punishes you for a missed day. It is a helper, not a doctor and not a dance teacher.</p>
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
