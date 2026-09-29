// Общие куски экранов: результаты по группам мышц и строки упражнений.
// Всё сравнивается внутри группы — грудь с прошлой грудью, пресс с прошлым прессом.

import { state, exById, groupById, groupOf, workoutTitle } from '../store.js';
import * as S from '../stats.js';
import { esc, icon } from '../ui.js';
import { num, signed, pct, deltaClass, setsStr, dateStr, durStr } from '../format.js';

export const delta = (v, suffix = '') => `<span class="${deltaClass(v)}">${signed(v)}${suffix}</span>`;

export function groupResult(workout, gid) {
  const cur = S.groupSummary(workout, gid, groupOf, exById);
  const pw = S.prevGroup(state.workouts, gid, groupOf, workout);
  const prev = pw ? S.groupSummary(pw, gid, groupOf, exById) : null;
  return { cur, prev, pw, c: S.compare(cur, prev) };
}

// Главная цифра группы для списков: изменение тоннажа в %, а если тоннажа не было — повторов.
function headline({ c, prev }) {
  if (!c) return null;
  if (prev.volume > 0) return { v: c.volumePct, text: pct(c.volumePct) };
  return { v: c.reps, text: `${signed(c.reps)} повт.` };
}

// «Грудь +4% · Трицепс −2% · Пресс 0%» — для истории и главной.
export function groupsLine(workout) {
  return S.workoutGroups(workout, groupOf)
    .map((gid) => {
      const h = headline(groupResult(workout, gid));
      return `<span class="gl">${esc(groupById(gid).name)}${h ? ` <b class="num ${deltaClass(h.v)}">${h.text}</b>` : ''}</span>`;
    })
    .join('');
}

export function exRow(workout, e) {
  const ex = exById(e.exId);
  const cur = S.summarize(e.sets, ex);
  const prev = S.findPrev(state.workouts, e.exId, workout);
  const c = S.compare(cur, prev ? S.summarize(prev.entry.sets, ex) : null);
  const deltas = c
    ? `макс. ${delta(c.maxW, ' кг')} · подходы ${delta(c.sets)} · повт. ${delta(c.reps)}`
    : '<span class="eq">первый раз</span>';
  return `<button class="ex-row" data-a="ex" data-ex="${e.exId}">
    <div class="ex-row-head">
      <div class="ex-row-name">${esc(ex.name)}</div>
      <div class="ex-row-vol num">${num(cur.volume)} кг${c?.volumePct != null ? ` <span class="${deltaClass(c.volume)}">${pct(c.volumePct)}</span>` : ''}</div>
    </div>
    <div class="ex-row-sets num">${setsStr(e.sets, ex)}</div>
    <div class="ex-row-d num">${deltas}</div>
    ${e.note ? `<div class="ex-row-note">«${esc(e.note)}»</div>` : ''}
  </button>`;
}

// Карточка группы: тоннаж / подходы / повторения и сравнение с прошлым разом этой группы.
export function groupCard(workout, gid, { exercises = true, done = false } = {}) {
  const { cur, c, pw } = groupResult(workout, gid);
  const m = (label, value, d) =>
    `<div class="m"><div class="m-l">${label}</div><div class="m-v num">${value}</div>${d ? `<div class="m-d num">${d}</div>` : ''}</div>`;
  const volD = c ? delta(c.volume, ' кг') + (c.volumePct != null ? `<br>${delta(Math.round(c.volumePct), '%')}` : '') : '';
  const rows = exercises
    ? workout.entries
        .filter((e) => e.sets.length && groupOf(e) === gid)
        .map((e) => exRow(workout, e))
        .join('')
    : '';
  return `<section class="group-card">
    <div class="group-head">
      ${done ? icon.check : ''}<h2>${esc(groupById(gid).name)}${done ? ' — готово' : ''}</h2>
      <span class="group-vs">${pw ? `vs ${dateStr(pw.startedAt)}` : 'первый раз'}</span>
    </div>
    <div class="metrics metrics-3">
      ${m('Тоннаж', `${num(cur.volume)} кг`, volD)}
      ${m('Подходы', cur.sets, c ? delta(c.sets) : '')}
      ${m('Повторения', cur.reps, c ? delta(c.reps) : '')}
    </div>
    ${rows ? `<div class="list group-ex">${rows}</div>` : ''}
  </section>`;
}

// Строка тренировки в списках: название, дата, длительность и изменения по группам.
export function workoutRow(w) {
  const st = S.workoutStats(w, exById);
  return `<button class="row" data-a="open" data-id="${w.id}">
    <div class="row-main">
      <div class="row-title">${esc(workoutTitle(w))}</div>
      <div class="row-sub">${dateStr(w.startedAt, { weekday: true })} · ${durStr(st.duration)}</div>
      <div class="row-groups">${groupsLine(w)}</div>
    </div>
    ${icon.chevron}
  </button>`;
}
