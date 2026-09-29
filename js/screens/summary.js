// Итог тренировки: сразу после завершения (#/summary/<id>/new) и из истории (#/summary/<id>).
// Результат разбит по группам мышц: каждая сравнивается с прошлым разом этой же группы.

import { state, exById, groupOf, workoutTitle, removeWorkout } from '../store.js';
import * as S from '../stats.js';
import { esc, icon } from '../ui.js';
import { dateStr, timeStr, durStr } from '../format.js';
import { groupCard } from './parts.js';
import { go } from '../router.js';

let fromNew = false;

export default {
  render(id, flag) {
    fromNew = flag === 'new';
    const w = state.workouts.find((x) => x.id === id);
    const header = (title) => `<header class="top wbar">
      <button class="icon-btn" data-a="back" aria-label="Назад">${icon.back}</button>
      <div class="wbar-mid"><div class="wbar-day">${title}</div></div><span class="icon-btn"></span></header>`;
    if (!w) return header('Тренировка') + '<main class="body"><p class="empty">Тренировка не найдена.</p></main>';

    const st = S.workoutStats(w, exById);
    const groups = S.workoutGroups(w, groupOf).map((gid) => groupCard(w, gid)).join('');

    return (
      header(fromNew ? 'Готово' : dateStr(w.startedAt)) +
      `<main class="body">
        <section class="sum-hero">
          ${fromNew ? `<div class="sum-check">${icon.check}</div>` : ''}
          <div class="kicker">${dateStr(w.startedAt, { weekday: true })} · ${timeStr(w.startedAt)} · ${durStr(st.duration)}</div>
          <h1 class="sum-title">${esc(workoutTitle(w))}</h1>
        </section>
        ${groups}
        <div class="bottom-actions">
          ${fromNew ? '<button class="btn btn-primary big" data-a="back">На главную</button>' : `<button class="btn btn-ghost danger" data-a="delete" data-id="${w.id}">Удалить тренировку</button>`}
        </div>
      </main>`
    );
  },

  actions: {
    back: () => go(fromNew ? '' : 'history'),
    ex: (el) => go(`progress/${el.dataset.ex}`),
    async delete(el) {
      const w = state.workouts.find((x) => x.id === el.dataset.id);
      if (!w || !confirm('Удалить эту тренировку из истории? Отменить будет нельзя.')) return;
      await removeWorkout(w);
      go('history');
    },
  },
};
