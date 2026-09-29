// Прогресс: список упражнений с историей → по каждому график и все выполнения.

import { state, exById } from '../store.js';
import { DAYS, GROUPS } from '../program.js';
import * as S from '../stats.js';
import { drawChart } from '../chart.js';
import { esc, icon } from '../ui.js';
import { num, pct, deltaClass, setsStr, dateStr, plural } from '../format.js';
import { go } from '../router.js';

const CHART_LAST = 20; // на графике — последние 20 раз, в списке — все

function listRow(exId) {
  const ex = exById(exId);
  const h = S.exerciseHistory(state.workouts, exId, ex);
  if (!h.length) return '';
  const last = h.at(-1);
  const prev = h.at(-2);
  const dv = prev ? S.compare(last.sum, prev.sum) : null;
  const main = ex.bw && !last.sum.maxW ? `${last.sum.reps} повт.` : `${num(last.sum.maxW)} кг`;
  return `<button class="row" data-a="open" data-ex="${exId}">
    <div class="row-main">
      <div class="row-title">${esc(ex.name)}</div>
      <div class="row-sub">${h.length} ${plural(h.length, 'раз', 'раза', 'раз')} · последний ${dateStr(last.t)}</div>
    </div>
    <div class="row-side num"><div>${main}</div>${dv?.volumePct != null ? `<div class="small ${deltaClass(dv.volume)}">${pct(dv.volumePct)}</div>` : ''}</div>
    ${icon.chevron}
  </button>`;
}

function listView() {
  const seen = new Set();
  let html = '';
  const groupIds = [...new Set(DAYS.flatMap((d) => d.groups))];
  for (const gid of groupIds) {
    const ids = GROUPS[gid].exercises.filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    const rows = ids.map(listRow).join('');
    if (rows) html += `<div class="section-label">${esc(GROUPS[gid].name)}</div><div class="list">${rows}</div>`;
  }
  const rest = [...new Set(state.workouts.flatMap((w) => w.entries.map((e) => e.exId)))].filter((id) => !seen.has(id));
  const restRows = rest.map(listRow).join('');
  if (restRows) html += `<div class="section-label">Не из программы</div><div class="list">${restRows}</div>`;
  if (!html) html = '<p class="empty">Прогресс появится после первой тренировки.</p>';
  return `<header class="top top-large"><h1>Прогресс</h1></header><main class="body">${html}</main>`;
}

function chartSpec(ex, h) {
  const noWeight = h.every((x) => !x.sum.maxW);
  if (noWeight) return [{ id: 'reps', title: 'Повторения за раз', kind: 'line', unit: 'повт.', v: (x) => x.sum.reps }];
  return [
    { id: 'maxw', title: ex.bw ? 'Макс. доп. вес, кг' : 'Макс. вес, кг', kind: 'line', unit: 'кг', v: (x) => x.sum.maxW },
    { id: 'vol', title: 'Тоннаж, кг', kind: 'col', unit: 'кг', v: (x) => x.sum.volume },
  ];
}

function detailView(exId) {
  const ex = exById(exId);
  const h = S.exerciseHistory(state.workouts, exId, ex);
  const header = `<header class="top wbar">
    <button class="icon-btn" data-a="back" aria-label="Назад">${icon.back}</button>
    <div class="wbar-mid"><div class="wbar-day">Прогресс</div></div><span class="icon-btn"></span></header>`;
  if (!h.length) return header + `<main class="body"><h1 class="ex-name">${esc(ex.name)}</h1><p class="empty">Это упражнение ещё не делалось.</p></main>`;

  const bestW = h.reduce((a, x) => (x.sum.maxW > a.sum.maxW ? x : a));
  const bestV = h.reduce((a, x) => (x.sum.volume > a.sum.volume ? x : a));
  const tile = (label, value, sub) => `<div class="m"><div class="m-l">${label}</div><div class="m-v">${value}</div><div class="m-d eq">${sub}</div></div>`;
  const tiles = ex.bw && !bestW.sum.maxW
    ? tile('Выполнено', `${h.length} ${plural(h.length, 'раз', 'раза', 'раз')}`, `с ${dateStr(h[0].t)}`)
    : tile('Рекорд веса', `${num(bestW.sum.maxW)} кг`, dateStr(bestW.t)) + tile('Лучший тоннаж', `${num(bestV.sum.volume)} кг`, dateStr(bestV.t));

  const charts = chartSpec(ex, h)
    .map(
      (c) => `<section class="chart-card"><div class="chart-title">${c.title}</div>
        ${h.length > CHART_LAST ? `<div class="chart-sub">последние ${CHART_LAST} раз</div>` : ''}
        <div class="chart" data-chart="${c.id}"></div></section>`,
    )
    .join('');

  const rows = h
    .map((x, i) => {
      const p = h[i - 1];
      const c = p ? S.compare(x.sum, p.sum) : null;
      return `<button class="ex-row" data-a="workout" data-id="${x.workout.id}">
        <div class="ex-row-head"><div class="ex-row-name">${dateStr(x.t, { weekday: true })}</div>
          <div class="ex-row-vol num">${num(x.sum.volume)} кг${c?.volumePct != null ? ` <span class="${deltaClass(c.volume)}">${pct(c.volumePct)}</span>` : ''}</div></div>
        <div class="ex-row-sets num">${setsStr(x.entry.sets, ex)}</div>
        ${x.entry.note ? `<div class="ex-row-note">«${esc(x.entry.note)}»</div>` : ''}
      </button>`;
    })
    .reverse()
    .join('');

  return (
    header +
    `<main class="body">
      <h1 class="ex-name">${esc(ex.name)}</h1>
      <div class="metrics">${tiles}</div>
      ${charts}
      <div class="section-label">Все выполнения</div>
      <div class="list">${rows}</div>
    </main>`
  );
}

export default {
  tabs: true,

  render(exId) {
    return exId ? detailView(exId) : listView();
  },

  mount(root, exId) {
    if (!exId) return;
    const ex = exById(exId);
    const h = S.exerciseHistory(state.workouts, exId, ex).slice(-CHART_LAST);
    if (!h.length) return;
    for (const c of chartSpec(ex, h)) {
      const host = root.querySelector(`[data-chart="${c.id}"]`);
      if (host) drawChart(host, h.map((x) => ({ t: x.t, v: c.v(x) })), c);
    }
  },

  actions: {
    open: (el) => go(`progress/${el.dataset.ex}`),
    back: () => history.back(),
    workout: (el) => go(`summary/${el.dataset.id}`),
  },
};
