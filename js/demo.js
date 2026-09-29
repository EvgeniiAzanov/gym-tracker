// Демо-история для проверки сравнений: два круга сплита с выдуманными цифрами.
// Во втором круге первый день сделан в другом порядке групп.

import { DAYS, GROUPS, EXERCISES } from './program.js';

function makeWorkout(day, order, daysAgo, bump) {
  const start = new Date();
  start.setDate(start.getDate() - daysAgo);
  start.setHours(18, 5, 0, 0);
  let t = start.getTime();
  const entries = [];
  for (const gid of order) {
    for (const id of GROUPS[gid].exercises) {
      const ex = EXERCISES[id];
      t += 2 * 60e3;
      const startedAt = t;
      const sets = [];
      for (let k = 0; k < ex.sets; k++) {
        t += 120e3;
        const w = Math.max(0, (ex.start ?? 0) + (bump - 1) * ex.step - (k === ex.sets - 1 ? ex.step : 0));
        sets.push({ w, r: Math.max(1, ex.reps - (k === ex.sets - 1 ? 2 : 0) + (bump && k === 1 ? 1 : 0)), t });
      }
      entries.push({ exId: id, group: gid, startedAt, finishedAt: t, sets, note: '' });
    }
  }
  return { id: `w${start.getTime()}`, dayId: day.id, groupOrder: order, startedAt: start.getTime(), finishedAt: t + 60e3, entries };
}

export function demoWorkouts() {
  const out = [];
  const n = DAYS.length;
  DAYS.forEach((day, i) => {
    // первый круг заканчивается раньше второго; последним по времени идёт последний день сплита
    out.push(makeWorkout(day, day.groups, 2 * n + 1 - i, 0));
    const order = i === 0 ? [...day.groups].reverse() : day.groups;
    out.push(makeWorkout(day, order, n + 1 - i, 1));
  });
  out[0].entries[0].note = 'плечо немного тянуло';
  return out;
}
