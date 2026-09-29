// Service worker: всё приложение лежит в кэше и работает без сети.
// При любом изменении файлов подними VERSION — телефон скачает новую версию
// при следующем запуске с интернетом.

const VERSION = '3';
const CACHE = `gymlog-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/backup.js',
  './js/chart.js',
  './js/db.js',
  './js/demo.js',
  './js/format.js',
  './js/input.js',
  './js/program.js',
  './js/router.js',
  './js/stats.js',
  './js/store.js',
  './js/ui.js',
  './js/screens/history.js',
  './js/screens/home.js',
  './js/screens/parts.js',
  './js/screens/progress.js',
  './js/screens/settings.js',
  './js/screens/summary.js',
  './js/screens/workout.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gymlog-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html').then((r) => r || fetch(req));
      return fetch(req);
    }),
  );
});
