// Offline start for the home-screen app: keeps the app itself (not your records, not map pictures) in the phone's cache.
const CACHE = 'run-app-473f8a9c47';
const SHELL = ['./', './index.html', './manifest.webmanifest', './vendor/leaflet.js', './vendor/leaflet.css',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-32.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // map pictures and fonts always come from the network
  if (url.pathname.endsWith('/version.json')) return; // always asked fresh, to notice a new version
  if (req.mode === 'navigate') { // newest app when online (checked with the server, not an old copy), the saved copy when offline
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
