/* Callboard service worker: app shell cache + optional user-saved audio (served with Range support). */
const VERSION = '__VERSION__';
const PLUGIN = '__PLUGIN_PATH__';
const SHELL = `callboard-shell-${VERSION}`;
const AUDIO = 'callboard-audio-v1';

self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.add('/')).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== SHELL && k !== AUDIO) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(url.pathname)) return e.respondWith(audio(req, url));
  if (req.mode === 'navigate') {
    if (url.pathname.startsWith('/wp-')) return;
    return e.respondWith(page(req));
  }
  if (url.pathname.startsWith(PLUGIN) || url.pathname === '/manifest.json') return e.respondWith(staleWhileRevalidate(req));
});

async function audio(req, url) {
  const cache = await caches.open(AUDIO);
  const hit = await cache.match(url.href, { ignoreVary: true });
  if (!hit) return fetch(req);
  const range = req.headers.get('range');
  if (!range) return hit;
  const buf = await hit.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start = m[1] ? +m[1] : 0;
  let end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
  if (!m[1] && m[2]) { start = Math.max(size - +m[2], 0); end = size - 1; }
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' },
  });
}
async function page(req) {
  const cache = await caches.open(SHELL);
  try { const res = await fetch(req); if (res.ok) cache.put(req.url, res.clone()); return res; }
  catch { return (await cache.match(req.url)) || (await cache.match('/')) || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(req.url);
  const network = fetch(req).then((res) => { if (res.ok) cache.put(req.url, res.clone()); return res; }).catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}
