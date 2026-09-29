import { state, setSetting, saveWorkout, wipe } from '../store.js';
import { VARIANTS } from '../input.js';
import { exportBackup, importBackup } from '../backup.js';
import { demoWorkouts } from '../demo.js';
import { toast } from '../ui.js';
import { dateStr, agoStr, plural } from '../format.js';
import { rerender } from '../router.js';

export default {
  tabs: true,

  render() {
    const v = state.settings.input;
    const n = state.workouts.length;
    const last = state.lastBackupAt ? `${dateStr(state.lastBackupAt)}, ${agoStr(state.lastBackupAt)}` : 'ещё не делалась';
    return `<header class="top top-large"><h1>Настройки</h1></header>
      <main class="body">
        <section class="group">
          <div class="section-label">Ввод подходов</div>
          <div class="seg">${VARIANTS.map((x) => `<button class="${x.id === v ? 'on' : ''}" data-a="set-input" data-v="${x.id}">${x.name}</button>`).join('')}</div>
          <p class="hint">${VARIANTS.find((x) => x.id === v)?.hint || ''}</p>
        </section>

        <section class="group">
          <div class="section-label">Резервная копия</div>
          <p class="hint">Все данные хранятся только на этом телефоне. Если удалить приложение с экрана «Домой» — история пропадёт. Последняя копия: ${last}.</p>
          <button class="btn btn-secondary" data-a="export">Сохранить копию</button>
          <button class="btn btn-ghost" data-a="import">Восстановить из файла</button>
          <input type="file" id="import-file" hidden>
        </section>

        <section class="group">
          <div class="section-label">Для теста</div>
          <button class="btn btn-ghost" data-a="demo">Добавить демо-историю</button>
          <button class="btn btn-ghost danger" data-a="wipe">Удалить все данные</button>
        </section>

        <p class="version" id="version">${n} ${plural(n, 'тренировка', 'тренировки', 'тренировок')} в памяти</p>
      </main>`;
  },

  async mount() {
    const input = document.getElementById('import-file');
    input.addEventListener('change', async () => {
      const file = input.files[0];
      input.value = '';
      if (file && (await importBackup(file))) rerender();
    });
    const keys = (await window.caches?.keys().catch(() => [])) || [];
    const ver = keys.find((k) => k.startsWith('gymlog-'));
    const el = document.getElementById('version');
    if (ver && el) el.textContent += ` · версия ${ver.slice(7)}`;
  },

  actions: {
    'set-input'(el) {
      setSetting('input', el.dataset.v);
      rerender();
    },
    async export() {
      if (await exportBackup()) rerender();
    },
    import: () => document.getElementById('import-file').click(),
    async demo() {
      if (!confirm('Добавить два круга сплита с выдуманными цифрами? Потом их можно удалить через «Удалить все данные».')) return;
      for (const w of demoWorkouts()) await saveWorkout(w);
      toast('Демо-история добавлена');
      rerender();
    },
    async wipe() {
      if (!confirm('Удалить ВСЕ тренировки и заметки с этого телефона? Отменить будет нельзя.')) return;
      await wipe();
      toast('Данные удалены');
      rerender();
    },
  },
};
