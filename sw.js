// Service worker: permite instalar la app y abrirla sin conexión.
// Primero intenta internet (para ver siempre la última versión); si no hay, usa lo guardado.
const CACHE = 'casaenregla-v25';
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

// ---- Notificaciones al celular ----
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { cuerpo: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'CasaEnRegla', {
    body: d.cuerpo || '', icon: 'icon.svg', badge: 'icon.svg', tag: 'casaenregla-avisos', data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
    for (const v of ventanas) if ('focus' in v) return v.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
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
