/* MediVital Service Worker – macht die Aufnahme-Seiten offline verfuegbar.
   Strategie:
   - HTML-Seiten "network-first": online immer die frische Version, ohne Netz aus dem Cache.
   - uebrige Dateien (Manifest, Icons) "cache-first".
   - Beim ersten (Online-)Besuch werden alle Kern-Dateien vorab gecacht, damit danach
     auch noch nicht geoeffnete Seiten offline laufen.
   Freshness: da HTML network-first ist, erscheinen neue Uploads beim naechsten Online-Aufruf
   automatisch – kein manuelles Hochzaehlen noetig. */
const CACHE = 'medivital-offline-v1';
const ASSETS = [
  './',
  './index.html',
  './sozialstation.html',
  './tagespflege.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k !== CACHE && k.indexOf('medivital-') === 0; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // nur eigene Dateien behandeln

  var isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isHTML) {
    // network-first: frische Seite wenn online, sonst aus dem Cache
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (m) {
          return m || caches.match('./index.html');
        });
      })
    );
  } else {
    // cache-first fuer statische Dateien
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(function (m) {
        return m || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
  }
});
