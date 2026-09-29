// Все расчёты — чистые функции без DOM и базы.
// Подход: { w: вес, r: повторы, t: время записи }.
// Тренировки в массиве отсортированы по startedAt по возрастанию.

export const round2 = (x) => Math.round(x * 100) / 100;

export const setVolume = (s, ex) => s.w * s.r * (ex.mult || 1);

export function summarize(sets, ex) {
  let reps = 0;
  let volume = 0;
  let maxW = 0;
  for (const s of sets) {
    reps += s.r;
    volume += setVolume(s, ex);
    if (s.w > maxW) maxW = s.w;
  }
  return { sets: sets.length, reps, volume: round2(volume), maxW };
}

export function compare(cur, prev) {
  if (!prev) return null;
  return {
    sets: cur.sets - prev.sets,
    reps: cur.reps - prev.reps,
    maxW: round2(cur.maxW - prev.maxW),
    volume: round2(cur.volume - prev.volume),
    volumePct: prev.volume ? ((cur.volume - prev.volume) / prev.volume) * 100 : null,
  };
}

// Сколько осталось до результата прошлого раза.
// Если в прошлый раз был тоннаж — считаем в кг (и в повторах при текущем весе),
// если нет (собственный вес без доп. веса) — в повторах.
export function gap(cur, prev, weight, ex) {
  if (!prev) return null;
  const byVolume = prev.volume > 0;
  const target = byVolume ? prev.volume : prev.reps;
  const done = byVolume ? cur.volume : cur.reps;
  const left = round2(target - done);
  let reps = 0;
  if (left > 0) {
    const perRep = weight * (ex.mult || 1);
    reps = byVolume ? (perRep > 0 ? Math.ceil(left / perRep) : null) : left;
  }
  return { byVolume, target, done, left, reps, ratio: target > 0 ? done / target : 1 };
}

const isBefore = (w, current) => !current || (w.id !== current.id && w.startedAt < current.startedAt);

// Последний раз, когда делали это упражнение (до текущей тренировки).
export function findPrev(workouts, exId, current) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i];
    if (!isBefore(w, current)) continue;
    const entry = w.entries.find((e) => e.exId === exId && e.sets.length);
    if (entry) return { workout: w, entry };
  }
  return null;
}

// Прошлая завершённая тренировка этого же дня сплита.
export function prevOfDay(workouts, dayId, current) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i];
    if (w.dayId === dayId && w.finishedAt && isBefore(w, current)) return w;
  }
  return null;
}

// Какие упражнения ещё не начаты: первая по порядку группа, где что-то осталось.
// order — id групп в порядке этой тренировки, groups — описание групп из программы.
export function planLeft(order, groups, workout) {
  const used = new Set(workout.entries.map((e) => e.exId));
  for (let i = 0; i < order.length; i++) {
    const group = groups[order[i]];
    const left = group ? group.exercises.filter((id) => !used.has(id)) : [];
    if (left.length) return { index: i, gid: order[i], group, left };
  }
  return null;
}

// Следующий день по кругу после последней завершённой тренировки.
export function nextDayId(days, workouts) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    if (!workouts[i].finishedAt) continue;
    const idx = days.findIndex((d) => d.id === workouts[i].dayId);
    return days[(idx + 1) % days.length].id;
  }
  return days[0].id;
}

// Что подставить в поля ввода для следующего подхода.
// Первый подход — как первый подход прошлого раза; со второго — как первый подход сегодня,
// чтобы прибавку веса не приходилось повторять в каждом подходе.
export function prefill(sets, prevSets, ex) {
  const first = sets[0] || prevSets?.[0];
  if (first) return { w: first.w, r: first.r };
  return { w: ex.start ?? 0, r: ex.reps ?? 10 };
}

export function workoutStats(workout, exOf) {
  let volume = 0;
  let sets = 0;
  let reps = 0;
  let end = workout.startedAt;
  for (const e of workout.entries) {
    const s = summarize(e.sets, exOf(e.exId));
    volume += s.volume;
    sets += s.sets;
    reps += s.reps;
    for (const x of e.sets) if (x.t > end) end = x.t;
  }
  return {
    volume: round2(volume),
    sets,
    reps,
    exercises: workout.entries.filter((e) => e.sets.length).length,
    duration: end - workout.startedAt,
  };
}

// Все выполнения упражнения, от старых к новым.
export function exerciseHistory(workouts, exId, ex) {
  const out = [];
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.exId === exId && e.sets.length) out.push({ workout: w, entry: e, t: w.startedAt, sum: summarize(e.sets, ex) });
    }
  }
  return out;
}

// ——— Группы мышц ———
// groupOf(entry) → id группы упражнения.

// Группы тренировки в том порядке, в каком их делали.
export function workoutGroups(workout, groupOf) {
  const out = [];
  for (const e of workout.entries) {
    const g = groupOf(e);
    if (e.sets.length && !out.includes(g)) out.push(g);
  }
  return out;
}

// Итог группы за тренировку. Сравнивать группы можно только сами с собой:
// грудь с грудью, а не общий тоннаж груди и пресса.
export function groupSummary(workout, gid, groupOf, exOf) {
  const s = { sets: 0, reps: 0, volume: 0, maxW: 0, exercises: 0 };
  for (const e of workout.entries) {
    if (groupOf(e) !== gid || !e.sets.length) continue;
    const x = summarize(e.sets, exOf(e.exId));
    s.sets += x.sets;
    s.reps += x.reps;
    s.volume += x.volume;
    s.exercises++;
  }
  s.volume = round2(s.volume);
  return s;
}

// Прошлая завершённая тренировка, где была эта группа (в любой день сплита).
export function prevGroup(workouts, gid, groupOf, current) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i];
    if (!w.finishedAt || !isBefore(w, current)) continue;
    if (w.entries.some((e) => e.sets.length && groupOf(e) === gid)) return w;
  }
  return null;
}
