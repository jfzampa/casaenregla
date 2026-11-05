// Service worker: permite instalar la app y abrirla sin conexión.
// Primero intenta internet (para ver siempre la última versión); si no hay, usa lo guardado.
const CACHE = 'casaenregla-v23';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'config.js', 'liquidacion.js', 'app.js', 'admin.js', 'empleado.js', 'manifest.json', 'icon.svg'];

self.addEventListener('install', (e) => {
  // cache: 'reload' = bajar siempre del servidor (no de la memoria del navegador)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS.map((u) => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const propio = new URL(e.request.url).origin === location.origin;
  e.respondWith(
    // archivos de la app: preguntar siempre al servidor si cambiaron (no usar la memoria del navegador)
    fetch(propio ? new Request(e.request, { cache: 'no-cache' }) : e.request)
      .then((resp) => {
        if (resp.ok && propio) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(e.request)),
  );
});
