// Service worker: guarda os arquivos do jogo para abrir sem internet (GitHub Pages).
// Sempre tenta a rede primeiro, então uma versão nova publicada aparece no próximo carregamento.
const CACHE = 'jornada-kanto-v2';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'index.html', 'style.css'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // no-cache: confere com o servidor em vez de usar a cópia do cache HTTP (o GitHub Pages guarda 10 min)
  e.respondWith(fetch(req.url, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
