/* Service worker do MindMap Studio (tablet): app disponível sem internet + receber arquivos do "Compartilhar". */
const VER = 'mm-tablet-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VER && k !== 'mm-shared').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Arquivos recebidos pelo "Compartilhar" do Android: guarda e abre o app
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const c = await caches.open('mm-shared');
        let i = 0;
        for (const f of fd.getAll('files')) {
          if (!f || typeof f === 'string') continue;
          await c.put(new Request('./shared/' + Date.now() + '-' + (i++)),
            new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-name': encodeURIComponent(f.name || 'arquivo') } }));
        }
      } catch (_) {}
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Primeiro do aparelho (abre na hora, sem internet); atualiza em segundo plano para a próxima abertura
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const key = e.request.mode === 'navigate' ? './index.html' : e.request;
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || new Response('Sem conexão', { status: 503 });
  })());
});
