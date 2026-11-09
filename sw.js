// Köy Bakkalı servis çalışanı: oyun uygulama gibi kurulabilsin, bağlantı kopsa da son açılan sürüm açılsın.
// Kod (html/js/json) önce ağdan gelir (yeni sürüm hemen gelir), ağ yoksa önbellekten. Resim, ses ve yazı tipi
// önbellekten verilir, arkada tazelenir. Firebase ve başka sunuculara giden istekler hiç ellenmez.
const V = 'kb-1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.png', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return; // ses parçalı isteği tarayıcıya kalır
  const u = new URL(r.url), same = u.origin === location.origin, font = /^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!same && !font) return;
  if (same && (u.pathname.startsWith('/__/') || u.pathname.startsWith('/kayit'))) return;
  const media = font || /\.(png|jpe?g|webp|mp3|ogg|wav|glb|woff2?)$/i.test(u.pathname);
  e.respondWith(media ? cacheFirst(r) : networkFirst(r));
});
// mobil ağda kopan istek iki kez daha denenir (tek bir model yüklenemezse oyun açılmaz)
const get = async (r, n = 2) => { try { return await fetch(r); } catch (err) { if (n <= 0) throw err; await new Promise((ok) => setTimeout(ok, 400)); return get(r, n - 1); } };
const keep = (c, r, res) => { if (res && (res.ok || res.type === 'opaque') && res.status !== 206) c.put(r, res.clone()).catch(() => {}); return res; };
// 2026-11-09: kod ve sayfa her seferinde sunucuya sorulur (koşullu istek: değişmediyse 304, gövde inmez). GitHub Pages bütün
// dosyalara max-age=600 verir; tarayıcı önbelleği güncellemeden sonraki 10 dk eski modülü yenisiyle karıştırabiliyordu.
// Firebase'de js/html zaten max-age=0, must-revalidate: orada bir şey değişmez. Gezinme isteği init ile kopyalanamaz, adresinden
// yeniden kurulur; no-store/reload istekleri olduğu gibi kalır.
const fresh = (r) => (r.cache === 'no-store' || r.cache === 'reload' ? r
  : r.mode === 'navigate' ? new Request(r.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(r, { cache: 'no-cache' }));
async function networkFirst(r) {
  const c = await caches.open(V);
  try {
    let res = await get(fresh(r));
    if (r.mode === 'navigate' && res.redirected) res = await get(r); // yönlendirilmiş yanıt gezinmeye verilemez
    return keep(c, r, res);
  } catch (err) {
    return (await c.match(r)) || (r.mode === 'navigate' && ((await c.match(r, { ignoreSearch: true })) || (await c.match('./')))) || Response.error();
  }
}
async function cacheFirst(r) {
  const c = await caches.open(V), hit = await c.match(r);
  const net = get(r).then((res) => keep(c, r, res)).catch(() => null);
  return hit || (await net) || Response.error();
}
