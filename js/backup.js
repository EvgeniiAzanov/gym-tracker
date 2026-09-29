// Резервная копия — JSON-файл. На iPhone уходит через «Поделиться» (Файлы, iCloud, Telegram себе).

import { state, exportData, markBackup, finishedWorkouts, validateImport, importData } from './store.js';
import { toast } from './ui.js';

const REMIND_AFTER = 7 * 864e5;

// Напоминать, если есть тренировки после последней копии и копии не было неделю.
export function backupDue() {
  const fin = finishedWorkouts();
  if (!fin.length) return false;
  const since = state.lastBackupAt || fin[0].startedAt;
  return fin.at(-1).finishedAt > (state.lastBackupAt || 0) && Date.now() - since > REMIND_AFTER;
}

export async function exportBackup() {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const name = `trenirovki-${stamp}.json`;
  const file = new File([JSON.stringify(exportData())], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e.name !== 'AbortError') toast('Не получилось: ' + e.message);
      return false;
    }
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  await markBackup();
  toast('Копия сохранена');
  return true;
}

export async function importBackup(file) {
  let data;
  try {
    data = validateImport(JSON.parse(await file.text()));
  } catch (e) {
    toast(e instanceof SyntaxError ? 'Файл не читается' : e.message);
    return false;
  }
  const msg = `Заменить текущие данные (тренировок: ${state.workouts.length}) данными из файла (тренировок: ${data.workouts.length})?`;
  if (!confirm(msg)) return false;
  await importData(data);
  toast('Данные восстановлены');
  return true;
}
