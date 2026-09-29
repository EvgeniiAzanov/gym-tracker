import { finishedWorkouts } from '../store.js';
import { monthStr } from '../format.js';
import { workoutRow } from './parts.js';
import { go } from '../router.js';

export default {
  tabs: true,

  render() {
    const list = finishedWorkouts().reverse();
    let html = '';
    let month = '';
    for (const w of list) {
      const m = monthStr(w.startedAt);
      if (m !== month) {
        html += `<div class="section-label">${m}</div>`;
        month = m;
      }
      html += workoutRow(w);
    }
    if (!list.length) html = '<p class="empty">Здесь появятся завершённые тренировки.</p>';
    return `<header class="top top-large"><h1>История</h1></header><main class="body"><div class="list">${html}</div></main>`;
  },

  actions: {
    open: (el) => go(`summary/${el.dataset.id}`),
  },
};
