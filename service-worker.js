importScripts('/push-config.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp(SWA_PUSH.firebase);
firebase.messaging();
const CACHE = 'studywithaaly-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('studywithaaly-offline-') && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  // Never cache Firebase data, payment requests, sessions, or authenticated responses.
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' ||
      new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () =>
    (await caches.match(OFFLINE)) || new Response('Connexion indisponible. Réessaie dans un instant.',
      {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}})));
});
