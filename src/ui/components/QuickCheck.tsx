import React, { useEffect, useState } from 'react';
import { useHabits, useToday } from '../hooks';
import { setHabit } from '../../db/db';
import { quickItems, quickStates, quickOpen } from '../../engine/quickcheck';

/** A few yes-or-not-yet questions at the top of Today, picked by the time of day. "Not yet" means go do it and come back. */
export function QuickCheck() {
  const day = useToday();
  const habits = useHabits();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const states = quickStates(quickItems(now), habits, day, now);
  const open = quickOpen(states);
  const goCount = states.filter((s) => s.state === 'go').length;
  if (!open) return <div className="small muted" data-tour="quickcheck" style={{ padding: '0 4px' }}>✓ Quick check done. Bathroom, water{states.some((s) => s.item.key === 'qc-dogs-am' || s.item.key === 'qc-dogs-pm') ? ', dogs' : ''}: all good.</div>;
  return (
    <div className="card" data-tour="quickcheck" style={{ borderColor: goCount ? 'var(--accent-2)' : undefined }}>
      <h3>Quick check before you start</h3>
      <p className="small muted">Answer each one. If it is "not yet", go do it now and come back. The app waits.</p>
      <div className="list mt">
        {states.map(({ item, state }) => (
          <div key={item.key} className={`item ${state === 'done' ? 'on' : ''}`} style={{ display: 'block' }}>
            <div className="title">{state === 'done' ? '✓ ' : ''}{item.question}</div>
            {state === 'pending' && (
              <div className="row mt" style={{ gap: 8 }}>
                <button className="btn primary grow" onClick={() => setHabit(day, item.key, true)}>{item.yes ?? 'Yes'}</button>
                <button className="btn grow" onClick={() => setHabit(day, item.key, false)}>{item.yes ? 'Yes, there is' : 'Not yet'}</button>
              </div>
            )}
            {state === 'go' && (
              <div className="mt">
                <div className="banner warn small">{item.go}</div>
                <button className="btn primary block mt" onClick={() => setHabit(day, item.key, true)}>Done, I did it</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
