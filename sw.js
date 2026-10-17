const CACHE = 'webhoaliem-shell-v7-20261017';
const FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/css/utilities.css',
  '/css/education.css',
  '/css/studio.css',
  '/css/themes.css',
  '/scripts.js',
  '/js/core.js',
  '/js/navigation.js',
  '/js/arena-core.js',
  '/js/study.js',
  '/js/exam-engine.js',
  '/js/learning.js',
  '/js/library.js',
  '/js/data-access.js',
  '/js/theme-system.js',
  '/js/admin-center.js',
  '/js/leaderboard-upgrade.js',
  '/js/admissions-core.js',
  '/js/admissions-data.js',
  '/js/admissions.js',
  '/js/studio.js',
  '/js/vendor/firebase-app.js',
  '/js/vendor/firebase-auth.js',
  '/js/vendor/firebase-database.js',
  '/js/vendor/papaparse.min.js',
  '/favicon.png',
  '/ai-avatar.png',
  '/study-break-5h.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('webhoaliem-shell-') && k !== CACHE).map(k => caches.delete(k)))
    )
  );
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }
  if (FILES.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(() => caches.match(url.pathname))
    );
  }
});
