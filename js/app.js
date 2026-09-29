import { load, activeWorkout } from './store.js';
import { register, render, go, dispatch } from './router.js';
import { toast } from './ui.js';
import home, { STALE } from './screens/home.js';
import workout from './screens/workout.js';
import summary from './screens/summary.js';
import historyScreen from './screens/history.js';
import progress from './screens/progress.js';
import settings from './screens/settings.js';

register('home', home);
register('workout', workout);
register('summary', summary);
register('history', historyScreen);
register('progress', progress);
register('settings', settings);

document.addEventListener('click', dispatch);

async function start() {
  try {
    await load();
  } catch (e) {
    document.getElementById('app').innerHTML = `<main class="body"><p class="empty">Не удалось открыть хранилище: ${e.message}</p></main>`;
    return;
  }

  // Просим браузер не вычищать данные при нехватке места.
  navigator.storage?.persist?.().catch(() => {});

  // Если приложение закрылось посреди тренировки — сразу возвращаемся в неё.
  const a = activeWorkout();
  if (a && Date.now() - a.startedAt < STALE && !location.hash.startsWith('#/workout')) {
    go('workout', { replace: true });
  } else {
    render();
  }

  // На localhost (разработка) не кэшируем, иначе правки не видны до смены VERSION.
  const dev = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && !dev) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) toast('Приложение обновилось', { action: 'Перезапустить', onAction: () => location.reload(), ms: 15000 });
    });
  }
}

start();
