// Ürünün gideceği yer: her ürün satıldığı (ya da işlendiği) yerin rengini taşır. Ürünün altında o renkte bir altlık durur
// (game.js makeItem). Satış raflarının önünde, rafın aldığı ürünlerin renginde şerit vardır (game.js Shelf): köy dükkânındaki
// fırın rafı mor, pazar tezgahı turuncu-yeşil. Mini haritada yerin bölgesinin kenarı aynı renktedir. Oyuncu ürün taşırken ekranın altında hangi yere kaç ürün götüreceği renkli çiplerle görünür.
// Birden çok yere gidebilen ürün asıl satış yerinin rengini alır (süt köy dolabında satılır; dondurma makinesine de girer).
import { G, ITEMS } from './game.js';

export const PLACES = {
  koy:    { name: 'Köy',    color: '#3cc35a' },
  pazar:  { name: 'Pazar',  color: '#ff8c1a' },
  sahil:  { name: 'Sahil',  color: '#ffd400' },
  han:    { name: 'Han',    color: '#e5484d' },
  firin:  { name: 'Fırın',  color: '#b45ee8' },
  iskele: { name: 'İskele', color: '#2f80ed' },
  tatil:  { name: 'Tatil',  color: '#14c4c4' },
  atlar:  { name: 'Ahır',   color: '#9a6233' },
  sehir:  { name: 'Şehir',  color: '#ff5fa8' }, // Şehir Marketi (city.js), otobüsle gidilir
  cicekci: { name: 'Çiçekçi', color: '#e05a8c' }, // kasabadaki çiçekçi (expand-east.js): buket masası ve vitrin
  kahve:  { name: 'Kahve',  color: '#b5523b' }, // kasaba kahvesinin kek vitrini (expand-east.js xkoy5)
};
// köydeki meyve bahçesinin meyvesi (meyve.js) Semt Pazarı'na gider: pazarın meyve tezgâhı oyuncu getirince açılır, tezgâh yokken de yol pazarı gösterir
const PIN = { elma: 'pazar', portakal: 'pazar', limon: 'pazar' };
export const DEST = {
  domates: 'koy', salatalik: 'koy', yumurta: 'koy', sut: 'koy', peynir: 'koy', ksut: 'koy', yogurt: 'koy',
  karpuz: 'pazar', biber: 'pazar', patlican: 'pazar', yun: 'pazar', kilim: 'pazar',
  kocan: 'sahil', misir: 'sahil', dondurma: 'sahil',
  bugday: 'han', ekmek: 'han', corba: 'han', yem: 'han',
  un: 'firin', simit: 'firin', pogaca: 'firin',
  saman: 'atlar',
  balik: 'iskele', izgara: 'iskele',
  kirli: 'tatil', havlu: 'tatil',
  elma: 'sehir', portakal: 'sehir', limon: 'sehir', meyvesuyu: 'sehir', // köyde bahçenin meyvesi pazara gider (PIN)
  lahana: 'koy', balkabagi: 'pazar', hali: 'pazar', balikcorba: 'iskele', // bölge genişletmelerinin ürünleri (expand-west.js)
  tursu: 'pazar', guvec: 'han', bal: 'koy', aycicek: 'pazar', pide: 'firin', cicek: 'cicekci', buket: 'cicekci', tost: 'sehir', // (expand-east.js)
  pure: 'sahil', karpuzsuyu: 'sahil', menemen: 'sahil', // sahil mutfağının vitrinleri (mutfak.js)
  salca: 'pazar', kek: 'kahve', // salça pazarda kendi tezgâhında, kek kasaba kahvesinin vitrininde (2026-11-02'ye kadar köy dükkânında)
};
export const destColor = (type) => { const p = PLACES[DEST[type]]; return p ? p.color : null; };

// elindekiler: ekranın altında taşıdığın her ürün resmi, adı ve sayısıyla; resmin köşesinde gideceği yerin rengi, başta
// doluluk (5/10). Yığın boşken gizli. Ürünün yanında nereye götürüleceği yazar (2026-10-28 kullanıcı: "nerede satılacağını
// anlayamıyoruz"): açık raf, tezgah ve makine girdilerinden en yakın iki bölgenin adı; telefonda yalnız en yakını
const CSS = `#carryDest { position: absolute; left: 50%; bottom: 58px; transform: translateX(-50%); display: none; align-items: center; gap: 6px; pointer-events: none; max-width: 92vw; flex-wrap: wrap; justify-content: center; }
#carryDest > span { position: relative; display: flex; align-items: center; gap: 6px; padding: 3px 5px 3px 4px; border-radius: 999px; background: var(--hud-bg); color: var(--hud-ink);
  border: 2px solid var(--line); box-shadow: var(--shadow); font: 15px var(--font-title); white-space: nowrap; animation: cdIn .18s ease-out; }
#carryDest > span.cap { padding: 3px 11px; background: #3b2a6b; color: #fff; }
#carryDest .it { position: relative; display: inline-flex; align-items: center; gap: 2px; }
#carryDest img { width: 26px; height: 26px; }
#carryDest i { position: absolute; left: 18px; top: -1px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.25); }
#carryDest b { font-weight: 400; opacity: .75; }
#carryDest .sh { display: none; }
#carryDest em { font-style: normal; font-size: 12.5px; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,.07); }
@keyframes cdIn { from { transform: scale(.7); opacity: 0; } to { transform: none; opacity: 1; } }
@media (max-width: 640px) { #carryDest { bottom: 150px; gap: 4px; } #carryDest > span { font-size: 13px; gap: 4px; } #carryDest .nm, #carryDest .lg { display: none; } #carryDest .sh { display: inline; } #carryDest > span.cap { padding: 3px 7px; } #carryDest img { width: 22px; height: 22px; } #carryDest i { left: 14px; } #carryDest em { font-size: 11px; padding: 1px 5px; } }
@media (max-width: 380px) { #carryDest > span.cap:first-child { display: none; } } /* dar telefonda çanta sayacı yer kaplamasın: satış yeri sığsın */`;
let box = null, shown = '', t = 0, again = 0;
// ürünün götürülebildiği bölgeler: rafı/tezgahı ürünü alan ya da makinesi onu işleyen yerler, oyuncuya yakından uzağa.
// Bölümlerin arsası bölgenin dışında kalır (G.annexes): bölgesinin adıyla. (world.js içe aktarılmaz: game.js bu dosyayı
// yüklerken döngü olur, G hazır olmadan kullanılır)
// telefonda kısa ad (elindekiler dar alanda tek satıra sığsın)
const SHORT = { koy: 'Bakkal', pazar: 'Pazar', sahil: 'Büfe', han: 'Han', firin: 'Fırın', kasaba: 'Kasaba', tarla: 'Tarla', mera: 'Mera', atolye: 'Atölye', ciftlik: 'Çiftlik',
  atlar: 'Ahır', kargo: 'Kargo', tatil: 'Tatil', iskele: 'İskele', tarlalar: 'Tarlalar', sehir: 'Market', meydan: 'Otopark', enerji: 'Enerji', yol: 'Yol' };
const label = (id) => (G.regions[id] ? G.regions[id].name : id);
export function placeName(z) {
  for (const [id, R] of Object.entries(G.regions || {})) { const r = R.rect; if (r && z.x >= r[0] && z.x <= r[1] && z.z >= r[2] && z.z <= r[3]) return id; }
  const a = (G.annexes || []).find((q) => z.x >= q.rect[0] && z.x <= q.rect[1] && z.z >= q.rect[2] && z.z <= q.rect[3]);
  return a && G.regions[a.region] ? a.region : null;
}
function whereOf(type) {
  const pp = G.player.position, best = new Map();
  for (const s of G.stations) {
    if (!s.zone || s.hidden) continue;
    const ok = s.inType === type || (typeof s.acc === 'function' && Array.isArray(s.slots) && s.acc().includes(type));
    if (!ok) continue;
    const nm = placeName(s.zone);
    if (!nm) continue;
    const d = Math.hypot(s.zone.x - pp.x, s.zone.z - pp.z);
    if (!best.has(nm) || best.get(nm) > d) best.set(nm, d);
  }
  return [...best.entries()].sort((a, b) => a[1] - b[1]).slice(0, 2).map(([n]) => n);
}
export function updateDest(dt) {
  if ((t -= dt) > 0) return;
  t = 0.2;
  if (!box) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    box = document.createElement('div'); box.id = 'carryDest';
    (document.getElementById('hud') || document.body).appendChild(box);
  }
  const n = {}, order = [];
  const city = G.world === 'sehir'; // şehirde taşınan her şey şehir marketine gider
  if (G.stack) for (const it of G.stack.items) { if (!n[it.type]) { n[it.type] = 0; order.push(it.type); } n[it.type]++; }
  const cap = G.stack ? G.stack.cap : 0, total = G.stack ? G.stack.items.length : 0;
  const key = order.map((k) => k + n[k]).join() + (city ? '|s' : '') + `|${cap}`;
  if (key === shown && (again -= 0.2) > 0) return; // yürüdükçe en yakın yer değişir: saniyede bir yenilenir
  again = 1;
  shown = key;
  box.style.display = total ? 'flex' : 'none';
  if (!total) { box.innerHTML = ''; return; }
  // aynı yere gidenler tek kutuda, yeri bir kez yazar; tek çeşit taşınırken adı ve ikinci yer de görünür
  const it = (k, p) => `<span class="it">${G.icons && G.icons[k] ? `<img src="${G.icons[k]}" alt="">` : ''}<i style="background:${p ? p.color : '#c9ccd0'}"></i></span>`;
  const groups = new Map();
  for (const k of order) {
    const pin = !city && PIN[k] && G.unlocked.has('xciftlik4') && G.regions[PIN[k]] && G.regions[PIN[k]].unlocked ? PIN[k] : null, w = city ? ['sehir'] : whereOf(k);
    const p = PLACES[city ? 'sehir' : pin || DEST[k]], to = pin && !w.includes(pin) ? [pin, ...w].slice(0, 2) : w, list = to.length ? to : p ? [DEST[k] in G.regions ? DEST[k] : p.name] : [''];
    if (!groups.has(list[0])) groups.set(list[0], { list, items: [] });
    groups.get(list[0]).items.push([k, p]);
  }
  // telefonda dar alan: en yakın iki yer gösterilir, gerisi "+N" kutusunda (adları üstünde)
  const one = order.length === 1, all = [...groups.values()], phone = matchMedia('(max-width: 640px)').matches, show = phone && all.length > 2 ? all.slice(0, 2) : all, rest = all.slice(show.length);
  box.innerHTML = `<span class="cap">🎒 ${total}/${cap}</span>` + show.map((g) => {
    const em = g.list[0] ? `<em>→ <span class="lg">${label(g.list[0])}${one && g.list[1] ? `, ${label(g.list[1])}` : ''}</span><span class="sh">${SHORT[g.list[0]] || label(g.list[0])}</span></em>` : '';
    const its = g.items.map(([k, p]) => it(k, p) + (one ? `<span class="nm">${(ITEMS[k] || {}).name || k}</span>` : '') + `<b>×${n[k]}</b>`).join('');
    return `<span title="${g.list.map(label).join(', ')}">${its}${em}</span>`;
  }).join('') + (rest.length ? `<span class="cap" title="${rest.map((g) => label(g.list[0])).join(', ')}">+${rest.reduce((m, g) => m + g.items.length, 0)}</span>` : '');
}
