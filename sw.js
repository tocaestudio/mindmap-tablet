/* Service worker do MindMap Studio (tablet): app disponível sem internet + receber arquivos do "Compartilhar". */
const VER = 'mm-tablet-v115';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' = baixa do site de verdade (não do cache do navegador), senão a versão nova podia nascer com o arquivo velho
  e.waitUntil(caches.open(VER).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  // verificação de versão: sempre direto do site
  if (url.searchParams.has('nocache') || e.request.cache === 'no-store') return;
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const nav = e.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
    const key = nav ? './index.html' : e.request;
    const fresh = () => fetch(nav ? new Request('./index.html', { cache: 'no-cache' }) : new Request(e.request, { cache: 'no-cache' }))
      .then(r => { if (r && r.ok) c.put(key, r.clone()); return r; });
    if (nav) {
      // app: primeiro o site (versão mais nova); sem internet ou demorando > 3,5 s, abre a cópia do aparelho
      const hit = await c.match(key);
      const net = fresh().catch(() => null);
      const timeout = new Promise(res => setTimeout(() => res(null), hit ? 3500 : 15000));
      const r = await Promise.race([net, timeout]);
      return (r && r.ok) ? r : (hit || (await net) || new Response('Sem conexão', { status: 503 }));
    }
    const hit = await c.match(key, { ignoreSearch: true });
    const net = fresh().catch(() => null);
    return hit || (await net) || new Response('Sem conexão', { status: 503 });
  })());
});
