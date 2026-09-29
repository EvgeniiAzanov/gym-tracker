import {
  state,
  activeWorkout,
  finishedWorkouts,
  saveWorkout,
  dayById,
  groupById,
  groupOf,
  workoutOrder,
  workoutTitle,
  titleOf,
} from '../store.js';
import { DAYS } from '../program.js';
import * as S from '../stats.js';
import { esc, icon } from '../ui.js';
import { dateStr, agoStr, timeStr, plural } from '../format.js';
import { workoutRow } from './parts.js';
import { backupDue, exportBackup } from '../backup.js';
import { go, rerender } from '../router.js';

const STALE = 6 * 36e5; // тренировка, начатая больше 6 часов назад, скорее всего забыта

let pickedDay = null;
let order = null; // порядок групп, выбранный перед стартом: { dayId, groups }

const exCount = (groups) => groups.reduce((n, g) => n + groupById(g).exercises.length, 0);
const exWord = (n) => plural(n, 'упражнение', 'упражнения', 'упражнений');

function orderFor(day) {
  if (order?.dayId !== day.id) order = { dayId: day.id, groups: [...day.groups] };
  return order.groups;
}

// В каком порядке шли группы в прошлый раз этого дня
function lastOrder(day) {
  const prev = S.prevOfDay(state.workouts, day.id, null);
  if (!prev) return null;
  const groups = prev.groupOrder || S.workoutGroups(prev, groupOf);
  const same = groups.length === day.groups.length && groups.every((g) => day.groups.includes(g));
  return same ? groups : null;
}

function activeCard(w) {
  const groups = workoutOrder(w);
  const done = w.entries.filter((e) => e.sets.length).length;
  const stale = Date.now() - w.startedAt > STALE;
  return `<section class="card hero">
    <div class="kicker">${stale ? `Не завершена · ${dateStr(w.startedAt)}` : `Идёт тренировка · с ${timeStr(w.startedAt)}`}</div>
    <div class="hero-title">${esc(workoutTitle(w))}</div>
    <div class="hero-meta num">Сделано ${done} из ${exCount(groups)} ${exWord(exCount(groups))}</div>
    <button class="btn btn-primary big" data-a="continue">Продолжить ${icon.arrow}</button>
  </section>`;
}

function orderBlock(day) {
  const groups = orderFor(day);
  if (groups.length < 2) return '';
  const last = lastOrder(day);
  const same = last && last.every((g, i) => g === groups[i]);
  const rows = groups
    .map(
      (gid, i) => `<div class="order-row">
        <span class="order-n num">${i + 1}</span>
        <span class="order-name">${esc(groupById(gid).name)}<small>${groupById(gid).exercises.length} упр.</small></span>
        <button class="order-btn" data-a="move" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Выше">${icon.up}</button>
        <button class="order-btn" data-a="move" data-i="${i}" data-dir="1" ${i === groups.length - 1 ? 'disabled' : ''} aria-label="Ниже">${icon.down}</button>
      </div>`,
    )
    .join('');
  const lastLine = last
    ? `<div class="order-last"><span>В прошлый раз: ${last.map((g) => esc(groupById(g).name)).join(' → ')}</span>
        ${same ? '' : '<button data-a="order-last">Как в прошлый раз</button>'}</div>`
    : '';
  return `<div class="order">
    <div class="field-label">Порядок групп</div>
    ${rows}
    ${lastLine}
  </div>`;
}

function nextCard(day, nextId) {
  const groups = orderFor(day);
  const prev = S.prevOfDay(state.workouts, day.id, null);
  const idx = DAYS.findIndex((d) => d.id === day.id);
  return `<section class="card hero">
    <div class="kicker">${day.id === nextId ? 'Следующая по плану' : 'Выбран другой день'} · день ${idx + 1} из ${DAYS.length}</div>
    <div class="hero-title">${esc(titleOf(groups))}</div>
    <div class="hero-meta">${exCount(groups)} ${exWord(exCount(groups))} · ${prev ? `прошлый раз ${dateStr(prev.startedAt)}, ${agoStr(prev.startedAt)}` : 'ещё ни разу не делал'}</div>
    ${orderBlock(day)}
    <button class="btn btn-primary big" data-a="start" data-day="${day.id}">Начать тренировку</button>
  </section>`;
}

function dayPicker(dayId, nextId) {
  if (DAYS.length < 2) return '';
  return `<div class="section-label">Другой день</div>
    <div class="day-list">${DAYS.map(
      (d, i) => `<button class="day-chip ${d.id === dayId ? 'on' : ''}" data-a="pick" data-day="${d.id}">
        <span class="day-n num">${i + 1}</span><span>${esc(titleOf(d.groups))}</span>${d.id === nextId ? '<small>по плану</small>' : ''}
      </button>`,
    ).join('')}</div>`;
}

function lastCard() {
  const w = finishedWorkouts().at(-1);
  return w ? `<div class="section-label">Последняя тренировка</div>${workoutRow(w)}` : '';
}

export default {
  tabs: true,

  render() {
    const a = activeWorkout();
    const nextId = S.nextDayId(DAYS, state.workouts);
    const day = dayById(DAYS.some((d) => d.id === pickedDay) ? pickedDay : nextId);
    const banner = backupDue()
      ? `<div class="banner">${icon.save}<span>Давно не было резервной копии</span><button data-a="backup">Сохранить</button></div>`
      : '';
    return `<header class="top top-large"><div class="kicker">${dateStr(Date.now(), { weekday: true })}</div><h1>Тренировка</h1></header>
      <main class="body">
        ${banner}
        ${a ? activeCard(a) : nextCard(day, nextId) + dayPicker(day.id, nextId)}
        ${lastCard()}
      </main>`;
  },

  actions: {
    async start(el) {
      if (activeWorkout()) return;
      const now = Date.now();
      const day = dayById(el.dataset.day);
      const w = {
        id: `w${now}`,
        dayId: day.id,
        groupOrder: [...orderFor(day)],
        startedAt: now,
        finishedAt: null,
        entries: [],
      };
      pickedDay = null;
      order = null;
      await saveWorkout(w);
      go('workout');
    },
    continue: () => go('workout'),
    pick(el) {
      pickedDay = el.dataset.day;
      rerender();
    },
    move(el) {
      const i = Number(el.dataset.i);
      const j = i + Number(el.dataset.dir);
      const g = order.groups;
      [g[i], g[j]] = [g[j], g[i]];
      rerender();
    },
    'order-last'() {
      const last = lastOrder(dayById(order.dayId));
      if (last) order.groups = [...last];
      rerender();
    },
    open: (el) => go(`summary/${el.dataset.id}`),
    async backup() {
      if (await exportBackup()) rerender();
    },
  },
};

export { STALE };
