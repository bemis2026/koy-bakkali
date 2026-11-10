// Bildirimler: raf raf, makine makine eksik yerine bölümün genel durumu. Saniyede bir oyunu tarar ve yalnızca kalıcı ya da
// önemli olanı sağ üstteki listeye düşürür (en önemli üç tanesi):
// - acil olaylar: plajda boğulan, kasaya yaklaşan hırsız, gitmek üzere olan kervan, uzak istek, kuryesiz paket
// - bölüm özetleri: darboğaz (makine uzun süredir girdisiz), uzun süredir boş raflar, son dakikada kızgın giden müşteriler,
//   uzun süredir boşta duran eleman
// - haberler (kısa süre görünür): mahallede popülerlik artıyor ya da düşüyor, bölüm müşterileri çok memnun, kazanç rekoru
// Aynı bildirim kapandıktan sonra bir süre yeniden çıkmaz: liste sürekli dolup boşalmaz. Satıra dokununca oraya yönlendirme
// açılır: yerde halka ve zıplayan ok, ekran dışındaysa kenarda yön oku. Varınca kendiliğinden kapanır.
import * as THREE from 'three';
import { G, ITEMS, Shelf, Converter, MoneyPile, VIEW } from './game.js';
import { rep, stars } from './rating.js';
import { EN, t as dilT } from './dil.js';

const CSS = `
#alerts { position: absolute; top: 136px; right: 14px; width: min(258px, 48vw); display: flex; flex-direction: column; gap: 6px; pointer-events: none; z-index: 2; }
/* başlık zil (2026-11-03, kullanıcı: "bildirimler tuşu yazıyla değil zil ile gösterilsin, alanı az kaplasın"): sayı köşesinde rozet */
#alerts .ah { align-self: flex-end; position: relative; width: 38px; height: 38px; box-sizing: border-box; display: grid; place-items: center; padding: 0; border-radius: 50%; font: 20px/1 var(--font-body); cursor: pointer; pointer-events: auto; user-select: none; }
#alerts.closed .ah span { opacity: .75; }
#alerts .ah em { position: absolute; top: -6px; right: -6px; font-style: normal; min-width: 19px; height: 19px; box-sizing: border-box; border-radius: 10px; display: grid; place-items: center; background: #e8604c; color: #fff; font: 900 11px/1 var(--font-body); padding: 0 4px; border: 2px solid #fff; }
#alerts .ah em.ok { background: #3fae6b; }
#alerts.closed .al { display: none; }
#alerts .al { display: grid; grid-template-columns: 30px minmax(0, 1fr) 34px 18px; align-items: center; gap: 6px; padding: 5px 6px 5px 6px; border-radius: 14px; pointer-events: auto; cursor: pointer; background: var(--row-bg); color: var(--row-ink); border: var(--bw) solid var(--line); box-shadow: var(--shadow); animation: alIn .35s ease both; }
#alerts .al.p3 { border-color: #e8604c; }
#alerts .al.good { border-color: #3fae6b; }
#alerts .al.on { outline: 3px solid #ffd23f; }
#alerts .ai { width: 30px; height: 30px; display: grid; place-items: center; font-size: 20px; }
#alerts .ai img { width: 30px; height: 30px; }
#alerts .at { display: flex; flex-direction: column; min-width: 0; }
#alerts .at b { font: 900 13px/1.15 var(--font-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#alerts .at small { font: 800 11px/1.2 var(--font-body); opacity: .75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#alerts .ad { display: flex; flex-direction: column; align-items: center; font: 900 10px var(--font-body); opacity: .8; }
#alerts .ad i { font-style: normal; font-size: 16px; line-height: 1; color: #e0a43a; display: inline-block; }
#alerts .ax { width: 18px; height: 18px; border: 0; border-radius: 50%; background: rgba(0,0,0,.1); color: inherit; font: 900 12px/18px var(--font-body); padding: 0; cursor: pointer; }
@keyframes alIn { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: none; } }
#guideEdge { position: absolute; left: 0; top: 0; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; display: none; place-items: center; background: #ffd23f; border: 3px solid #fff; box-shadow: 0 3px 0 rgba(0,0,0,.25); font-size: 22px; color: #6b3d00; pointer-events: none; z-index: 2; }
#guideEdge i { font-style: normal; display: inline-block; }
@media (max-width: 640px) { #alerts { top: 132px; width: min(230px, 62vw); } #alerts .ah { width: 34px; height: 34px; font-size: 18px; } }`;

// bildirim türleri: kaç saniye sürünce görünür, önceliği, kapandıktan sonra kaç saniye yeniden çıkmaz
const DELAY = { urgent: 0, kervan: 0, req: 3, neck: 4, angry: 0, shelf: 4, idle: 0, cash: 5, good: 0, bad: 0 };
const PRI = { urgent: 4, kervan: 2.6, req: 2.4, angry: 2.3, neck: 2, shelf: 1.8, bad: 1.7, cash: 1.6, good: 1.2, idle: 1 };
const COOL = { urgent: 0, kervan: 0, req: 0, neck: 90, angry: 75, shelf: 90, idle: 180, cash: 60, good: 0, bad: 0 };
const NECK_AFTER = 40, SHELF_AFTER = 45, IDLE_AFTER = 90, ANGRY_MIN = 3; // saniye / kişi
const MACHINE = { misir: 'Mısır kazanı', dondurma: 'Dondurma makinesi', ekmek: 'Fırın', yem: 'Yem ambarı', corba: 'Çorba kazanı', kilim: 'Dokuma tezgahı',
  yogurt: 'Yoğurt küpü', peynir: 'Mandıra', saman: 'Harman makinesi', simit: 'Simit fırını', pogaca: 'Poğaça fırını', un: 'Değirmen', izgara: 'Izgara', havlu: 'Çamaşırhane',
  tursu: 'Turşu fıçısı', guvec: 'Güveç ocağı', pide: 'Pide fırını', tost: 'Tost makinesi', hali: 'Halı tezgahı', balikcorba: 'Çorba kazanı',
  pure: 'Püre makinesi', karpuzsuyu: 'Karpuz sıkacağı', menemen: 'Menemen ocağı' }; // genişletmelerin makineleri (son üçü sahil mutfağı, mutfak.js)
const SKIP_IN = new Set(['kirli']); // yalnızca misafirden gelen girdi: makinenin boş durması doğal

let root = null, head = null, edge = null, marker = null, scanT = 0, uiT = 0, newsT = 0, open = true;
const seen = new Map(); // anahtar → bildirimin ilk görüldüğü an
const snooze = new Map(); // anahtar → bu ana kadar gösterme (× ile kapatılan)
const cool = new Map(); // anahtar → kendiliğinden kapanan bildirim bu ana kadar yeniden çıkmaz
const since = new Map(); // istasyon/eleman → bu durumda (boş, girdisiz, boşta) olduğu ilk an
let shown = new Set(), alerts = [], guide = null, news = [];
const moods = []; // son dakikaların müşteri ruh hali: { t, r, ok }
let moodHook = null, repHist = [], earnHist = [], bestMin = 0;
const ids = new WeakMap(); let nextId = 1;
const idOf = (o) => { if (!ids.has(o)) ids.set(o, nextId++); return ids.get(o); };
const img = (t) => (G.icons[t] ? `<img src="${G.icons[t]}" alt="">` : '❔');
const nm = (t) => (ITEMS[t] ? ITEMS[t].name : t);
const tl = (n) => Math.floor(n).toLocaleString('tr-TR');

function regionOf(x, z) {
  for (const id in G.regions) { const R = G.regions[id], r = R.rect; if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) return R; }
  return null;
}
const live = (R) => R && R.unlocked && !R.hidden;
const mid = (R) => ({ x: (R.rect[0] + R.rect[1]) / 2, z: (R.rect[2] + R.rect[3]) / 2 });
function shelfName(s, R) {
  const acc = s.acc();
  const KIND = { manav: 'Manav reyonu', kilim: 'Kilim ve yün rafı', firin: 'Fırın rafı' };
  if (KIND[s.type]) return KIND[s.type];
  if (R.id === 'pazar') return 'Pazar tezgahı';
  if (R.id === 'iskele') return 'Balık tezgahı';
  if (R.id === 'firin') return 'Vitrin';
  if (acc.some((t) => t === 'sut' || t === 'ksut' || t === 'peynir' || t === 'yogurt')) return 'Süt dolabı';
  return acc.length === 1 ? `${nm(acc[0])} rafı` : 'Karışık raf';
}
// bir durum ne zamandır sürüyor (sürmüyorsa sayaç sıfırlanır)
function lasting(key, on) {
  if (!on) { since.delete(key); return 0; }
  if (!since.has(key)) since.set(key, G.time);
  return G.time - since.get(key);
}

// müşteri ruh hali rating.js'in kancasından okunur; kanca sonradan değişirse yeniden sarılır
function hookMoods() {
  if (G.onMood && G.onMood === moodHook) return;
  const prev = G.onMood;
  moodHook = (c, happy) => { if (c && c.region) moods.push({ t: G.time, r: c.region, ok: !!happy }); if (prev) prev(c, happy); };
  G.onMood = moodHook;
}

function scan() {
  const out = [], t = G.time;
  // --- acil olaylar ---
  const S = G.regions.sahil, v = S && S.drowning;
  if (live(S) && v && v.obj) out.push({ key: 'bogulma', kind: 'urgent', icon: '🛟', title: 'Plajda biri boğuluyor!', sub: v.rescuer ? 'Cankurtaran yolda' : 'Hemen denize koş, kıyıya çek', x: v.obj.position.x, z: v.obj.position.z });
  const th = G.thief;
  if (th && th.obj && (th.state === 'sneak' || th.state === 'grab' || th.state === 'flee')) {
    const R = th.pile && th.pile.zone ? regionOf(th.pile.zone.x, th.pile.zone.z) : null;
    out.push({ key: 'hirsiz', kind: 'urgent', icon: '🦹', title: th.state === 'flee' ? 'Hırsız parayla kaçıyor!' : 'Hırsız kasaya yaklaşıyor!', sub: `${R ? R.name : 'Kasa'} · yakala, paran geri gelsin`, x: th.obj.position.x, z: th.obj.position.z });
  }
  const H = G.regions.han, car = H && H.caravan;
  if (live(H) && car && car.state === 'wait' && car.timer < 30 && car.drop) out.push({ key: 'kervan', kind: 'kervan', icon: '🐫', title: `Kervan ${Math.ceil(car.timer)} sn sonra gidiyor`, sub: 'Kervansaray · siparişi tamamla', x: car.drop.zone.x, z: car.drop.zone.z });
  for (const q of G.requests || []) {
    if (q.done || !q.drop) continue;
    const R = G.regions[q.region], p = q.c.obj.position;
    out.push({ key: `req:${idOf(q)}`, kind: 'req', icon: img(q.type), title: `${nm(q.type)} isteniyor 🚚`, sub: `${R ? R.name : ''} · başka bölgeden getir`, x: p.x, z: p.z });
  }

  // --- bölüm özetleri: darboğaz, uzun süredir boş raflar, kızgın müşteriler ---
  const per = {};
  const reg = (R) => per[R.id] || (per[R.id] = { R, neck: [], empty: [] });
  for (const s of G.stations) {
    const z = s.zone; if (!z) continue;
    if (s instanceof Converter) {
      const starved = !SKIP_IN.has(s.inType) && !s.input.length && !(s.out && s.out.items.length);
      const d = lasting(`c${idOf(s)}`, starved);
      const R = d >= NECK_AFTER && regionOf(z.x, z.z);
      if (live(R)) reg(R).neck.push({ s, d });
    } else if (s instanceof Shelf) {
      const d = lasting(`s${idOf(s)}`, s.count() === 0 && !s.packed); // toplanmış pazar tezgahı boş raf sayılmaz
      const R = d >= SHELF_AFTER && regionOf(z.x, z.z);
      if (live(R)) reg(R).empty.push({ s, d });
    }
  }
  while (moods.length && moods[0].t < t - 60) moods.shift();
  const angry = {};
  for (const m of moods) if (!m.ok) angry[m.r] = (angry[m.r] || 0) + 1;
  for (const id in angry) if (angry[id] >= ANGRY_MIN && live(G.regions[id])) reg(G.regions[id]).angry = angry[id];
  for (const id in per) {
    const { R, neck, empty, angry: n } = per[id];
    if (neck.length) {
      // İngilizcede "makine adı + ürün adı bekliyor" kalıba uymaz (iki ad yan yana), cümle burada kurulur
      const w = neck.sort((a, b) => b.d - a.d)[0].s, m = MACHINE[w.out && w.out.type] || `${nm(w.out && w.out.type)} makinesi`;
      out.push({ key: `neck:${id}`, kind: 'neck', icon: img(w.inType), title: `${R.name}: darboğaz`, sub: (EN ? `${dilT(m)} needs ${dilT(nm(w.inType)).toLowerCase()}` : `${m} ${nm(w.inType).toLocaleLowerCase('tr')} bekliyor`) + (neck.length > 1 ? ` · ${neck.length} makine durdu` : ''), x: w.zone.x, z: w.zone.z });
    }
    if (empty.length) {
      const e = empty.sort((a, b) => b.d - a.d)[0].s;
      out.push({ key: `shelf:${id}`, kind: 'shelf', icon: '📭', title: `${R.name}: ${empty.length > 1 ? `${empty.length} raf` : shelfName(e, R)} uzun süredir boş`, sub: 'Müşteri bulamayıp gidiyor · rafçı ya da taşıyıcı ekle', x: e.zone.x, z: e.zone.z });
    }
    if (n) { const c = mid(R); out.push({ key: `angry:${id}`, kind: 'angry', icon: '😠', title: `${R.name}: son dakikada ${n} müşteri kızgın gitti`, sub: empty.length ? 'Boş raflar müşteri kaçırıyor' : neck.length ? 'Ürün yetişmiyor, bekleme uzun' : 'Bekleme çok uzun · kasaya ya da eleman', x: c.x, z: c.z }); }
  }
  // --- toplanmayı bekleyen para: en dolu yığın (bulunduğun dünyada); hırsız da onu kollar ---
  let big = null, sum = 0;
  for (const s of G.stations) if (s instanceof MoneyPile && s.amount >= 1 && (s.zone.x > 300) === (G.world === 'sehir')) { sum += s.amount; if (!big || s.amount > big.amount) big = s; }
  if (big && big.amount >= Math.max(150, 60 * (G.level || 1))) {
    const R = regionOf(big.zone.x, big.zone.z), tl = (n) => `${Math.floor(n).toLocaleString('tr-TR')} ₺`;
    out.push({ key: 'cash', kind: 'cash', icon: '💰', title: `${R ? R.name : 'Kasa'}: ${tl(big.amount)} toplanmayı bekliyor`, sub: sum - big.amount >= 1 ? `Kasalarda toplam ${tl(sum)} · yanına git ya da muhasebeci al` : 'Yanına git, topla · hırsız da kollar', x: big.zone.x, z: big.zone.z });
  }
  // --- uzun süredir boşta duran eleman (kadroyu gözden geçirmek için) ---
  for (const w of G.workers) {
    const d = lasting(`w${idOf(w)}`, w.state === 'idle' && !w.moving);
    if (d >= IDLE_AFTER) { const p = w.obj.position; out.push({ key: `idle:${idOf(w)}`, kind: 'idle', icon: '💤', title: `${w.tag.el.textContent.replace(/ · .*/, '')} uzun süredir boşta`, sub: 'İşi yok · kadroyu gözden geçir', x: p.x, z: p.z }); }
  }
  // --- haberler (kısa süre görünür) ---
  for (const n of news) if (n.until > t) out.push(n);
  return out;
}

// haberler: 15 saniyede bir popülerlik, bölüm memnuniyeti ve kazanç
function addNews(n) { if (news.some((x) => x.key === n.key && x.until > G.time)) return; news.push({ ...n, until: G.time + 14 }); }
function checkNews() {
  const t = G.time;
  news = news.filter((n) => n.until > t);
  // popülerlik: son 60 saniyedeki değişim
  repHist.push({ t, v: rep() });
  while (repHist.length && repHist[0].t < t - 60) repHist.shift();
  const d = repHist.length > 2 ? repHist[repHist.length - 1].v - repHist[0].v : 0;
  const p = G.player.position;
  if (d >= 3) { addNews({ key: 'pop-up', kind: 'good', icon: '⭐', title: 'Mahallede popülerliğin artıyor', sub: `${stars().toFixed(1).replace('.', ',')} yıldız · müşteriler daha sık geliyor`, x: p.x, z: p.z }); repHist = [{ t, v: rep() }]; }
  else if (d <= -3) { addNews({ key: 'pop-down', kind: 'bad', icon: '📉', title: 'Popülerliğin düşüyor', sub: `${stars().toFixed(1).replace('.', ',')} yıldız · kızgın müşteri ve yetişmeyen siparişler`, x: p.x, z: p.z }); repHist = [{ t, v: rep() }]; }
  // bölüm memnuniyeti: son dakikada en az 8 memnun, hiç kızgın yok
  const happy = {}, sad = {};
  for (const m of moods) (m.ok ? happy : sad)[m.r] = ((m.ok ? happy : sad)[m.r] || 0) + 1;
  for (const id in happy) {
    const R = G.regions[id];
    if (live(R) && happy[id] >= 8 && !sad[id] && !(cool.get(`happy:${id}`) > t)) { const c = mid(R); addNews({ key: `happy:${id}`, kind: 'good', icon: '😊', title: `${R.name}: müşteriler çok memnun`, sub: `Son dakikada ${happy[id]} mutlu müşteri`, x: c.x, z: c.z }); cool.set(`happy:${id}`, t + 180); }
  }
  // kazanç rekoru: son 60 saniyede kazanılan, oyunun en iyi dakikasını geçince (ilk üç dakikadan sonra)
  earnHist.push({ t, v: G.stats.earned });
  while (earnHist.length && earnHist[0].t < t - 60) earnHist.shift();
  if (earnHist.length > 3 && t - earnHist[0].t >= 55) {
    const min = earnHist[earnHist.length - 1].v - earnHist[0].v;
    if (bestMin && min > bestMin * 1.15 && G.stats.time > 180) { addNews({ key: 'rekor', kind: 'good', icon: '💰', title: `Kazanç rekoru: dakikada ${tl(min)} ₺`, sub: 'Dükkanın hiç bu kadar iyi gitmemişti', x: p.x, z: p.z }); bestMin = min; }
    else if (min > bestMin) bestMin = Math.max(bestMin, min);
  }
}

function ensureUI() {
  if (root) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const hud = document.getElementById('hud') || document.body;
  try { open = localStorage.getItem('koyBakkali.alertsOpen') !== '0'; } catch (e) { /* yok */ }
  root = document.createElement('div'); root.id = 'alerts'; root.classList.toggle('closed', !open);
  head = document.createElement('div'); head.className = 'ah hp'; head.title = 'Bildirimler: dokun, listeyi aç ya da kapat';
  head.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault(); open = !open; root.classList.toggle('closed', !open);
    try { localStorage.setItem('koyBakkali.alertsOpen', open ? '1' : '0'); } catch (err) { /* yok */ }
  });
  root.appendChild(head);
  edge = document.createElement('div'); edge.id = 'guideEdge'; edge.innerHTML = '<i>➤</i>';
  hud.appendChild(root); hud.appendChild(edge);
  // yerdeki yönlendirme: dönen halka ve zıplayan aşağı bakan ok
  marker = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 32), gold); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.renderOrder = 5;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 16), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#a86b00', emissiveIntensity: 0.35 }));
  cone.rotation.x = Math.PI; cone.position.y = 3.2;
  marker.add(ring, cone); marker.userData = { ring, cone }; marker.visible = false;
  G.scene.add(marker);
}

function render() {
  for (const el of [...root.querySelectorAll('.al')]) el.remove();
  const bad = alerts.filter((a) => a.kind !== 'good').length;
  head.innerHTML = `<span>🔔</span><em class="${bad ? '' : 'ok'}">${alerts.length}</em>`;
  head.style.display = alerts.length ? '' : 'none';
  for (const a of alerts.slice(0, 3)) {
    const el = document.createElement('div');
    el.className = `al${PRI[a.kind] >= 2.3 ? ' p3' : ''}${a.kind === 'good' ? ' good' : ''}${guide && guide.key === a.key ? ' on' : ''}`;
    el.innerHTML = `<span class="ai">${a.icon}</span><span class="at"><b></b><small></small></span><span class="ad"><i>➤</i><span></span></span><button type="button" class="ax" title="Bir süre gösterme">×</button>`;
    el.querySelector('b').textContent = a.title; el.querySelector('small').textContent = a.sub;
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (e.target.closest('.ax')) { snooze.set(a.key, G.time + 120); news = news.filter((n) => n.key !== a.key); if (guide && guide.key === a.key) guide = null; refresh(); return; }
      guide = guide && guide.key === a.key ? null : { key: a.key, x: a.x, z: a.z, until: G.time + 45 };
      if (guide && G.hooks.goTo) G.hooks.goTo(a.x, a.z); // dokunulan bildirimin yerine kendi koşar (autorun.js)
      refresh();
    });
    root.appendChild(el);
  }
}
function refresh() {
  const now = scan(), keys = new Set(now.map((a) => a.key)), t = G.time;
  for (const k of [...seen.keys()]) if (!keys.has(k)) seen.delete(k);
  for (const a of now) if (!seen.has(a.key)) seen.set(a.key, t);
  // gösterilen bildirim kendiliğinden kapanınca bir süre yeniden çıkmaz: liste sürekli dolup boşalmaz
  for (const k of shown) if (!keys.has(k)) { const kind = k.split(':')[0], c = COOL[{ bogulma: 'urgent', hirsiz: 'urgent' }[kind] || kind] || 0; if (c) cool.set(k, t + c); }
  const next = now.filter((a) => t - seen.get(a.key) >= DELAY[a.kind] && !(snooze.get(a.key) > t) && !(a.kind !== 'urgent' && !shown.has(a.key) && cool.get(a.key) > t))
    .sort((a, b) => PRI[b.kind] - PRI[a.kind] || seen.get(a.key) - seen.get(b.key));
  shown = new Set(next.map((a) => a.key));
  const sig = next.slice(0, 3).map((a) => a.key + a.title + a.sub).join('|') + next.length + (guide ? guide.key : '');
  alerts = next;
  if (guide) { const g = next.find((a) => a.key === guide.key); if (g) { guide.x = g.x; guide.z = g.z; } else guide = null; }
  if (sig !== root.dataset.sig) { root.dataset.sig = sig; render(); }
}

const v = new THREE.Vector3();
let edgeRT = -1e9; const edgeR = [null, null];
function toScreen(x, y, z, out) {
  v.set(x, y, z).project(G.camera);
  out.x = (v.x * 0.5 + 0.5) * VIEW.w; out.y = (-v.y * 0.5 + 0.5) * VIEW.h; out.z = v.z; // VIEW: pencere boyu önbellekte (game.js)
  return out;
}
const sp = { x: 0, y: 0, z: 0 }, tp = { x: 0, y: 0, z: 0 };
export function updateAlerts(dt) {
  if (!G.camera || !G.player) return;
  ensureUI();
  hookMoods();
  newsT -= dt;
  if (newsT <= 0) { newsT = 15; checkNews(); }
  scanT -= dt;
  if (scanT <= 0) { scanT = 1; refresh(); }
  const p = G.player.position;
  toScreen(p.x, 1, p.z, sp);
  // satırlardaki yön okları ve uzaklıklar
  uiT -= dt;
  if (uiT <= 0) {
    uiT = 0.15;
    root.querySelectorAll('.al').forEach((el, i) => {
      const a = alerts[i]; if (!a) return;
      toScreen(a.x, 0.5, a.z, tp);
      const ang = Math.atan2(tp.y - sp.y, tp.x - sp.x), d = Math.hypot(a.x - p.x, a.z - p.z);
      el.querySelector('.ad i').style.transform = `rotate(${ang.toFixed(2)}rad)`;
      el.querySelector('.ad span').textContent = `${Math.round(d)} m`;
    });
  }
  // yönlendirme
  if (guide && (G.time > guide.until || Math.hypot(guide.x - p.x, guide.z - p.z) < 2.6)) { guide = null; root.dataset.sig = ''; refresh(); }
  marker.visible = !!guide;
  if (!guide) { edge.style.display = 'none'; return; }
  marker.position.set(guide.x, 0, guide.z);
  marker.userData.cone.position.y = 3.2 + Math.abs(Math.sin(G.time * 3.2)) * 0.5;
  marker.userData.ring.rotation.z += dt * 1.5;
  toScreen(guide.x, 3.4, guide.z, tp); // zıplayan okun yüksekliği: ok üstteki para ve hedef kutularının altında kalmasın
  const W = VIEW.w, H = VIEW.h, m = 40, top = 150;
  const inView = tp.x > m && tp.x < W - m && tp.y > top && tp.y < H - m && tp.z < 1;
  if (inView) { edge.style.display = 'none'; return; }
  // ekran dışı: oyuncudan hedefe giden çizginin ekran kenarını kestiği yerde yön oku
  const dx = tp.x - sp.x, dy = tp.y - sp.y, ang = Math.atan2(dy, dx);
  const kx = dx > 0 ? (W - m - sp.x) / dx : dx < 0 ? (m - sp.x) / dx : Infinity;
  const ky = dy > 0 ? (H - m - sp.y) / dy : dy < 0 ? (top - sp.y) / dy : Infinity;
  const k = Math.max(0, Math.min(kx, ky, 1));
  let ex = sp.x + dx * k, ey = sp.y + dy * k;
  // kenar oku bildirim listesinin ve mini haritanın üstüne binmez: kenar boyunca kayar
  // bildirim listesinin ve haritanın yeri 0,5 sn'de bir ölçülür (her karede iki zorunlu yerleşim okumasıydı)
  const now = performance.now();
  if (now - edgeRT > 500) { edgeRT = now; const mm = document.getElementById('minimap'); edgeR[0] = root.offsetParent ? root.getBoundingClientRect() : null; edgeR[1] = mm && mm.offsetParent ? mm.getBoundingClientRect() : null; }
  const hit = (r) => (r && ex > r.left - 26 && ex < r.right + 26 && ey > r.top - 26 && ey < r.bottom + 26 ? r : null);
  let r = hit(edgeR[0]); if (r) { if (ey <= top + 1) ex = r.left - 30; else ey = r.bottom + 30; }
  r = hit(edgeR[1]); if (r) ey = r.top - 30;
  edge.style.display = 'grid';
  edge.style.transform = `translate(${ex.toFixed(0)}px,${ey.toFixed(0)}px)`;
  edge.firstChild.style.transform = `rotate(${ang.toFixed(2)}rad)`;
}
