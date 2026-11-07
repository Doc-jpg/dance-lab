/**
 * Smart daily messages. One fresh, relevant message a day, chosen from a pool by what today looks
 * like, never repeated inside the rotation window, never shown in quiet hours. No guilt, no shame,
 * no body talk, nothing about weight or shape, no streak threats.
 */
import type { Day, MessageShown, Reminders, ReadinessColor, Session, SportsLog } from './types';
import { addDays } from './types';

export type MessageCategory = 'hydration' | 'nutrition' | 'sleep' | 'recovery' | 'consistency' | 'confidence' | 'mobility' | 'fun';

export interface MessageContext {
  day: Day;
  color?: ReadinessColor;
  todayLogs: SportsLog[];
  yesterdayLogs: SportsLog[];
  /** Days since the last done session (not counting foundations). Undefined if never. */
  daysSinceSession?: number;
  sleepLow?: boolean;
  shown: MessageShown[];
  rotationDays: number;
  seed?: number;
}

interface Msg {
  key: string;
  category: MessageCategory;
  text: string;
  /** Higher when the context matches; 0 means not today. */
  fit: (c: MessageContext) => number;
}

const any = () => 1;
const hasSport = (c: MessageContext, s: string) => c.todayLogs.some((l) => l.sport === s);

export const MESSAGES: Msg[] = [
  { key: 'hyd-dance', category: 'hydration', text: 'Dance day? Water bottle in the dance bag, and a drink at every break, not just when you feel thirsty.', fit: (c) => (hasSport(c, 'dance') ? 3 : 0) },
  { key: 'hyd-plain', category: 'hydration', text: 'Water first. A glass when you wake up and one with every meal is most of the job.', fit: any },
  { key: 'hyd-long', category: 'hydration', text: 'Long day of moving? Drink before, during and after. Plain water is perfect.', fit: (c) => (c.todayLogs.some((l) => l.duration === 'long') ? 2 : 1) },
  { key: 'nut-color', category: 'nutrition', text: 'A real meal has something with protein, something with color, and something that fills you up.', fit: any },
  { key: 'nut-after', category: 'nutrition', text: 'After dance class the best recovery tool is dinner. Eat a good one.', fit: (c) => (c.todayLogs.length ? 3 : 0) },
  { key: 'nut-breakfast', category: 'nutrition', text: 'Breakfast is the first move of the day. Eggs, oatmeal, a banana, peanut butter toast: anything beats nothing.', fit: any },
  { key: 'nut-fruit', category: 'nutrition', text: 'Fruit and vegetables are not a rule, they are fuel. One at lunch, one at dinner, done.', fit: any },
  { key: 'slp-tomorrow', category: 'sleep', text: "Tomorrow's energy starts tonight. Nine to eleven hours is what a growing dancer runs on.", fit: (c) => (c.sleepLow ? 4 : 1) },
  { key: 'slp-screens', category: 'sleep', text: 'Screens off a little earlier tonight. Sleep is when muscles actually get stronger and stretchier.', fit: (c) => (c.sleepLow ? 3 : 1) },
  { key: 'slp-big', category: 'sleep', text: 'Big day tomorrow? The best prep is boring: good dinner, early bed.', fit: any },
  { key: 'rec-worked', category: 'recovery', text: 'You moved a lot today. The five-minute stretch is part of getting stronger, not a day off from it.', fit: (c) => (c.color === 'orange' ? 4 : c.todayLogs.length ? 2 : 0) },
  { key: 'rec-goodcall', category: 'recovery', text: 'Taking a rest day when you are wiped out is a smart dancer move. Professionals do it on purpose.', fit: (c) => (c.color === 'orange' || c.color === 'red' ? 3 : 0) },
  { key: 'rec-jump', category: 'recovery', text: 'A day of easy legs after lots of jumping is how knees and ankles last for years. Stretching is plenty.', fit: (c) => (c.todayLogs.some((l) => l.heavyJumping) || c.yesterdayLogs.some((l) => l.heavyJumping) ? 4 : 0) },
  { key: 'con-ten', category: 'consistency', text: 'Ten slow minutes beats rushing. Stretching only works when you breathe and wait.', fit: any },
  { key: 'con-back', category: 'consistency', text: 'Been a few days. No big deal. Pick it back up today, even just the Daily 5.', fit: (c) => (c.daysSinceSession !== undefined && c.daysSinceSession >= 3 ? 4 : 0) },
  { key: 'con-small', category: 'consistency', text: 'A little every day is how splits happen. Not one big push, lots of small ones.', fit: any },
  { key: 'cnf-learn', category: 'confidence', text: 'Your goal is not to be bendier than yesterday every single day. It is to keep showing up.', fit: any },
  { key: 'cnf-form', category: 'confidence', text: 'A beautiful easy version beats a wobbly hard one. Teachers notice the clean one.', fit: any },
  { key: 'cnf-listen', category: 'confidence', text: 'Knowing when to go for it and when to take it easy is a skill. You are practicing it right now.', fit: (c) => (c.color === 'yellow' ? 3 : 1) },
  { key: 'cnf-pull', category: 'confidence', text: 'A stretch should feel like a good pull, never a pinch or a burn. Breathing out is the secret button.', fit: any },
  { key: 'mob-feet', category: 'mobility', text: 'Your feet and ankles do all the work on stage. Give them a few minutes today.', fit: any },
  { key: 'mob-sitting', category: 'mobility', text: 'Lots of sitting at school? Hips get tight. Butterfly and a low lunge are three minutes well spent.', fit: any },
  { key: 'mob-brush', category: 'mobility', text: 'Mini-challenge: brush your teeth standing on one foot tonight. Switch halfway. Balance for free.', fit: any },
  { key: 'fun-cat', category: 'fun', text: 'Land like a cat. Quiet feet are strong feet.', fit: any },
  { key: 'fun-play', category: 'fun', text: 'Playing outside counts. Tag, bikes, climbing, cartwheels in the yard: that is training with no app needed.', fit: any },
  { key: 'fun-tv', category: 'fun', text: 'Challenge: sit in butterfly or straddle while you watch something tonight. Comfy and stretchy at the same time.', fit: any },
  { key: 'fun-piano', category: 'fun', text: 'Between piano pieces: roll the shoulders back three times and shake out the wrists. Tiny habit, big help.', fit: any }
];

function inQuietHours(now: Date, r: Reminders): boolean {
  const [qs, qe] = [r.quietStart, r.quietEnd].map((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; });
  const cur = now.getHours() * 60 + now.getMinutes();
  return qs > qe ? cur >= qs || cur < qe : cur >= qs && cur < qe;
}

/** The message for today, or null in quiet hours or when reminders are off. Stable for a day once chosen (via `shown`). */
export function pickMessage(ctx: MessageContext, reminders: Reminders, now: Date = new Date()): Msg | null {
  if (!reminders.enabled) return null;
  const already = ctx.shown.find((m) => m.day === ctx.day);
  if (already) return MESSAGES.find((m) => m.key === already.key) ?? null;
  if (inQuietHours(now, reminders)) return null;
  const since = addDays(ctx.day, -ctx.rotationDays);
  const recent = new Set(ctx.shown.filter((m) => m.day > since).map((m) => m.key));
  const recentCats = ctx.shown.filter((m) => m.day > addDays(ctx.day, -2)).map((m) => m.category);
  const scored = MESSAGES.filter((m) => !recent.has(m.key)).map((m) => ({ m, s: m.fit(ctx) - (recentCats.includes(m.category) ? 0.5 : 0) })).filter((x) => x.s > 0);
  if (!scored.length) return MESSAGES.find((m) => !recent.has(m.key)) ?? MESSAGES[0];
  scored.sort((a, b) => b.s - a.s);
  const top = scored.filter((x) => x.s === scored[0].s);
  const seed = ctx.seed ?? ctx.day.split('-').reduce((a, b) => a + Number(b), 0);
  return top[seed % top.length].m;
}

export const CATEGORY_WORDS: Record<MessageCategory, string> = { hydration: 'Hydration', nutrition: 'Food', sleep: 'Sleep', recovery: 'Recovery', consistency: 'Consistency', confidence: 'Confidence', mobility: 'Mobility', fun: 'Challenge' };

export function daysSinceLastSession(sessions: Session[], day: Day): number | undefined {
  const last = sessions.filter((s) => s.status === 'done' && s.kind !== 'foundations' && s.kind !== 'recovery' && s.day <= day).sort((a, b) => b.day.localeCompare(a.day))[0];
  if (!last) return undefined;
  return Math.round((new Date(day + 'T12:00:00').getTime() - new Date(last.day + 'T12:00:00').getTime()) / 86400000);
}
