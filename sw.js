// Service worker: sempre tenta a rede primeiro (dados sempre frescos).
// Só usa a cópia guardada quando o aparelho está sem internet — assim as orientações
// e os contatos continuam abrindo mesmo durante uma queda de conexão.
const CACHE = 'dc-guarapuava-v2';
const BASICO = [
  './', 'index.html', 'assets/css/site.css', 'assets/js/app.js', 'assets/js/config.js', 'assets/js/clima.js',
  'assets/js/ceu.js', 'assets/js/util.js',
  'assets/fonts/saira-var.woff2', 'assets/fonts/atkinson-next-var.woff2', 'assets/img/defesa-civil-guarapuava.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICO)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return resp;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
