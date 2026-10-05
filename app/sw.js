const C = 'aune-v15';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './fx-pdf.js', './fx-fonts.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== C).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Réseau d'abord, cache en secours : l'app marche aussi hors connexion.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Jamais de cache pour l'API de synchronisation (autre origine) : données personnelles.
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copy = r.clone();
        caches.open(C).then(c => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request).then(m => m || caches.match('./index.html')))
  );
});
