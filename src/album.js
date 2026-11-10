// Koleksiyon albümü ve haftalık etkinlik (bitirme planı adım 7, 2026-11-02)
// Dört sayfa: ürünler (eline aldığın her tür), hayvanlar (yakınından geçtiğin), bölgeler (açtığın; kartpostalı kendi kamerasıyla
// çekilir), ziyaretçiler (gördüğün her müşteri türü). Sayfa dolunca para + XP + dükkâna kalıcı bir süs (kullanıcı: "Para + süs").
// Haftalık etkinlik: takvim haftasına bir tema (Bal haftası gibi); tema ürünleri %50 pahalı, hedef kadar toplanınca para ve
// albümün beşinci sayfasına özel çıkartma (kullanıcı: "Temalı hafta").
import * as THREE from 'three';
import { G, ITEMS, toast, sfx, save } from './game.js';
import { banner } from './ui.js';
import { addXp } from './level.js';
import { ANIMALS } from './models.js';
import { reprice } from './mevsim.js';
import { STAGES } from './dukkan.js';

const ANIMAL = [['tavuk', '🐔', 'Tavuk'], ['civciv', '🐤', 'Civciv'], ['inek', '🐄', 'İnek'], ['koyun', '🐑', 'Koyun'], ['at', '🐎', 'At'], ['deve', '🐫', 'Deve'],
  ['esek', '🐴', 'Eşek'], ['kedi', '🐈', 'Kedi'], ['kopek', '🐕', 'Köpek'], ['ordek', '🦆', 'Ördek'], ['guvercin', '🕊️', 'Güvercin'], ['marti', '🐦', 'Martı']];
const VISIT = [['koy', '👨‍🌾', 'Köylü'], ['bisiklet', '🚲', 'Bisikletli'], ['moto', '🏍️', 'Motorlu'], ['araba', '🚗', 'Arabalı'], ['pazar', '🧺', 'Pazar alıcısı'],
  ['sahil', '🏖️', 'Plajcı'], ['firin', '🥯', 'Simit sever'], ['han', '🛎️', 'Han misafiri'], ['kervan', '🐫', 'Kervan'], ['atli', '🏇', 'Atlı'], ['kasaba', '🎩', 'Kasabalı'],
  ['iskele', '🎣', 'Balık meraklısı'], ['tatil', '🩱', 'Tatilci'], ['lunapark', '🎠', 'Lunaparkçı'], ['sehir', '🏙️', 'Şehirli'], ['hirsiz', '🦹', 'Hırsız']];
const REG_IC = { koy: '🏡', pazar: '🍉', ciftlik: '🐄', sahil: '🏖️', han: '🐫', atlar: '🐎', firin: '🥯', kargo: '📦', tatil: '🐚', kasaba: '⛲', tarla: '🌽', mera: '🐑',
  atolye: '🧶', sehir: '🏙️', enerji: '🌬️', tarlalar: '🚜', iskele: '🎣', lunapark: '🎡', meydan: '🅿️' };
// haftanın teması: req açılmadıysa o tema seçilmez (ürünü olmayan hafta olmasın)
const WEEKS = [
  { id: 'bostan', icon: '🍅', name: 'Bostan haftası', items: ['domates', 'salatalik'] },
  { id: 'sut', icon: '🥛', name: 'Süt haftası', items: ['sut', 'peynir', 'yogurt', 'ksut', 'dondurma'], req: ['ka'] },
  { id: 'pazar', icon: '🍉', name: 'Pazar haftası', items: ['karpuz', 'biber', 'patlican', 'tursu'], req: ['gp'] },
  { id: 'misir', icon: '🌽', name: 'Mısır haftası', items: ['kocan', 'misir', 'patlamis'], req: ['gs'] },
  { id: 'firin', icon: '🥖', name: 'Fırın haftası', items: ['simit', 'pogaca', 'ekmek'], req: ['gf', 'gh'] },
  { id: 'kilim', icon: '🧶', name: 'Kilim haftası', items: ['yun', 'kilim'], req: ['gm'] },
  { id: 'balik', icon: '🐟', name: 'Balık haftası', items: ['balik', 'izgara'], req: ['gb'] },
  { id: 'bal', icon: '🍯', name: 'Bal haftası', items: ['bal'], req: ['xciftlik2'] },
];
const PAGES = [
  { id: 'urun', icon: '🧺', name: 'Ürünler', money: 25000, deco: 'Altın tabela çerçevesi', how: 'Bir ürünü ilk kez eline aldığında çıkartması gelir.' },
  { id: 'hayvan', icon: '🐾', name: 'Hayvanlar', money: 10000, deco: 'Horozlu rüzgâr gülü', how: 'Bir hayvanın yakınından geçince çıkartması gelir.' },
  { id: 'bolge', icon: '🗺️', name: 'Bölgeler', money: 20000, deco: 'Renkli bayrak süsü', how: 'Açtığın her bölgenin kartpostalı buraya yapışır.' },
  { id: 'ziyaretci', icon: '👋', name: 'Ziyaretçiler', money: 15000, deco: 'Çiçekli saksılar', how: 'Bir müşteri türünü yakından görünce çıkartması gelir.' },
  { id: 'etkinlik', icon: '🎪', name: 'Etkinlikler', money: 30000, deco: 'Fener dizisi', how: 'Haftalık etkinliğin hedefini tamamlayınca o haftanın rozeti gelir.' },
];
const XP_PAGE = 150, XP_WEEK = 120;
const ANIMAL_R = 7, VISIT_R = 16;

const regionIds = () => Object.keys(G.regions).filter((id) => id !== 'yol');
const entries = (p) => (p === 'urun' ? Object.keys(ITEMS) : p === 'hayvan' ? ANIMAL.map((a) => a[0]) : p === 'bolge' ? regionIds() : p === 'ziyaretci' ? VISIT.map((v) => v[0]) : WEEKS.map((w) => w.id));
const pageOf = (id) => PAGES.find((p) => p.id === id);
const tl = (n) => Math.round(n).toLocaleString('tr-TR');

let A = null, scanT = 0, tab = 'urun', decoStage = -1, deco = null, vane = null, lastPaid = '';

// ---------- toplama ----------
function got(page, id, quiet) {
  const L = A[page];
  if (!L || L.includes(id) || !entries(page).includes(id)) return false;
  L.push(id);
  // ilk adımlar rehberi açıkken (rehber.js) yeni oyuncunun önüne çıkartma çıkmaz; menüdeki nokta yine yanar
  if (!quiet) { G.albumNew = true; if (!G.guideOn) { popQueue.push([page, id]); sfx('pick'); } }
  return true;
}
// sayfa dolduysa ödül (kayıt açılır açılmaz değil: sinematik ve menü bitince)
function checkPages() {
  for (const P of PAGES) {
    if (A.paid.includes(P.id) || A[P.id].length < entries(P.id).length) continue;
    A.paid.push(P.id);
    const m = P.money; G.money += m; addXp(XP_PAGE);
    banner('ALBÜM SAYFASI TAMAM', `${P.icon} ${P.name} · +${tl(m)} ₺`);
    toast(`📔 ${P.name} sayfası doldu: +${tl(m)} ₺, +${XP_PAGE} XP · dükkâna ${P.deco.toLowerCase()} takıldı`);
    sfx('hire');
    decoStage = -1; // süs hemen kurulsun
    save();
    return; // aynı anda iki sayfa dolarsa ikinci afiş bir sonraki taramada
  }
}

// elde tutulan ürün: oyuncunun ya da elemanın yığınına giren her tür (game.js Stack.push)
function onGot(type, stack) {
  if (!A || G.visit) return;
  if (stack !== G.stack && !G.workers.some((w) => w.stack === stack)) return; // müşterinin aldığı sayılmaz
  if (got('urun', type)) save();
  const W = A.wk;
  if (W && !W.done && WEEKS.find((w) => w.id === W.ev)?.items.includes(type)) W.n++;
}

const _v = new THREE.Vector3(), _p = new THREE.Vector3();
const shown = (o) => { for (let x = o; x; x = x.parent) { if (!x.visible) return false; if (x === G.scene) return true; } return false; };
function near(o, r) { if (!o || !shown(o)) return false; o.getWorldPosition(_v); const dx = _v.x - _p.x, dz = _v.z - _p.z; return dx * dx + dz * dz < r * r; } // yerde mesafe: martı tepeden uçar

function scan() {
  _p.copy(G.player.position);
  for (const id of regionIds()) if (G.regions[id].unlocked) got('bolge', id);
  // hayvanlar: albüme kaydolan (models.js tagAnimal); sahneden çıkıp 30 sn dönmeyen kayıttan düşer
  if (A.hayvan.length < ANIMAL.length) {
    for (let i = ANIMALS.length - 1; i >= 0; i--) {
      const a = ANIMALS[i], [o, k] = a;
      if (!o.parent) { if (++a[2] > 30) ANIMALS.splice(i, 1); continue; }
      a[2] = 0;
      if (!A.hayvan.includes(k) && near(o, ANIMAL_R)) got('hayvan', k);
    }
  } else ANIMALS.length = 0;
  // ziyaretçiler: müşterinin geldiği bölge; köyde bisikletli ve motorlu ayrı çıkartma
  for (const c of G.customers) {
    if (!c.obj || !near(c.obj, VISIT_R)) continue;
    got('ziyaretci', c.region === 'koy' ? (c.riding ? (c.pose ? 'moto' : 'bisiklet') : 'koy') : c.region);
  }
  if ((G.stats.cars || 0) > 0) got('ziyaretci', 'araba');
  if ((G.stats.caravans || 0) > 0) got('ziyaretci', 'kervan');
  for (const id in G.regions) for (const r of G.regions[id].riders || []) if (near(r.horse, VISIT_R)) got('ziyaretci', 'atli');
  if (G.thief && G.thief.active && near(G.thief.obj, VISIT_R)) got('ziyaretci', 'hirsiz');
}

// ---------- haftalık etkinlik ----------
// ISO haftası (online.js weekId ile aynı hesap; online modülü buraya çekilmesin diye kopya)
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return { id: `${y}-H${String(w).padStart(2, '0')}`, n: y * 53 + w };
}
const daysLeft = () => { const d = new Date(), wd = d.getDay() || 7; return 8 - wd; }; // pazartesi yeni hafta
const eligible = () => WEEKS.filter((w) => !w.req || w.req.some((r) => G.unlocked.has(r)));
// hedef: tema ürünlerini üreten istasyonların dakikalık hızının 15 dakikalığı (yeni oyuncuda da büyük köyde de makul)
function goalFor(ev) {
  let perMin = 0;
  for (const s of G.stations) {
    for (const x of [s, s.out]) {
      if (!x || !ev.items.includes(x.type)) continue;
      perMin += 60 * (x.plants ? x.plants.length / (x.grow || 10) : x.interval ? 1 / x.interval : 0);
    }
    if (Array.isArray(s.types)) for (const t of s.types) if (ev.items.includes(t)) perMin += 6; // kamyondan alınan mal
  }
  return Math.max(20, Math.min(300, Math.round((perMin * 15) / 10) * 10));
}
function weekCheck(first) {
  const W = isoWeek();
  if (A.wk && A.wk.id === W.id) { if (!G.weekItems) { G.weekItems = WEEKS.find((w) => w.id === A.wk.ev).items; reprice(); } return; }
  const list = eligible(), fresh = list.filter((w) => !A.etkinlik.includes(w.id)), pool = fresh.length ? fresh : list;
  const ev = pool[W.n % pool.length];
  A.wk = { id: W.id, ev: ev.id, goal: goalFor(ev), n: 0, done: false };
  G.weekItems = ev.items;
  reprice();
  save();
  if (!first || (G.stats.time || 0) > 600) { // ilk dakikalarda öğreticinin önüne afiş çıkmasın
    banner(`YENİ HAFTA ${ev.icon}`, ev.name);
    toast(`${ev.icon} ${ev.name}: ${ev.items.map((t) => ITEMS[t].name).join(', ')} %50 pahalı. ${A.wk.goal} tane topla, özel rozeti kap!`);
  }
}
const weekReward = () => 3000 + 400 * (G.level || 1);
function weekDone() {
  const W = A.wk;
  if (!W || W.done || W.n < W.goal) return;
  W.done = true;
  const ev = WEEKS.find((w) => w.id === W.ev), m = weekReward();
  G.money += m; addXp(XP_WEEK);
  got('etkinlik', ev.id);
  banner('ETKİNLİK TAMAM', `${ev.icon} ${ev.name} · +${tl(m)} ₺`);
  sfx('hire');
  save();
}
// görev penceresinde mevsimin altında (gorev.js)
function weekHTML() {
  const W = A && A.wk, ev = W && WEEKS.find((w) => w.id === W.ev);
  if (!ev) return '';
  const p = Math.min(W.goal, W.n), items = ev.items.map((t) => ITEMS[t].name).join(', ');
  return `<h5>${ev.icon} ${ev.name} · etkinlik</h5><p class="sz">Haftanın ürünleri (%50 pahalı): ${items}</p>
<div class="t${W.done ? ' done' : ''}"><i>${W.done ? '✅' : ev.icon}</i><b>Haftanın ürünlerinden ${W.goal} tane topla</b><span>${p}/${W.goal}</span><span class="bar"><u style="width:${(p / W.goal) * 100}%"></u></span></div>
<small>${W.done ? 'Rozet albümünde. ' : `Ödül ${tl(weekReward())} ₺, ${XP_WEEK} XP ve albüme özel rozet. `}Yeni haftaya ${daysLeft()} gün.</small><hr>`;
}

// ---------- çıkartma bildirimi ----------
// ekranın alt ortasında: üstte hedef kartı, bildirim (toast) ve afiş (banner) durur
const popQueue = [];
let popEl = null, popT = 0;
function info(page, id) {
  if (page === 'urun') return [G.icons[id] ? `<img src="${G.icons[id]}" alt="">` : '🧺', ITEMS[id].name];
  if (page === 'hayvan') { const a = ANIMAL.find((x) => x[0] === id); return [a[1], a[2]]; }
  if (page === 'bolge') return [REG_IC[id] || '🗺️', G.regions[id].name];
  if (page === 'ziyaretci') { const v = VISIT.find((x) => x[0] === id); return [v[1], v[2]]; }
  const w = WEEKS.find((x) => x.id === id); return [w.icon, w.name];
}
function stepPop(dt) {
  if (popT > 0) { popT -= dt; if (popT <= 0) popEl.classList.remove('on'); return; }
  if (popT > -0.35 || !popQueue.length || G.cine || G.menuOpen || G.guideOn || document.querySelector('.modal.open')) { popT -= dt; return; } // açılış penceresinin ve ilk adımlar rehberinin üstüne çıkmaz (2026-11-10)
  const [page, id] = popQueue.shift(), [ic, name] = info(page, id), P = pageOf(page);
  if (!popEl) { popEl = document.createElement('div'); popEl.id = 'albPop'; document.body.appendChild(popEl); }
  popEl.innerHTML = `<span class="ic">${ic}</span><span><small>📔 Albüme eklendi</small><b>${name}</b></span><span class="n">${P.icon} ${A[page].length}/${entries(page).length}</span>`;
  void popEl.offsetWidth; popEl.classList.add('on');
  popT = popQueue.length > 3 ? 1.2 : 2.4;
}

// ---------- dükkân süsleri ----------
// tamamlanan her sayfanın süsü dükkânın arka duvarına ve önüne kurulur; dükkân büyüyünce (kS2, kS3) yeni ölçüye göre yeniden
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _s = new THREE.Vector3(), _t = new THREE.Vector3();
const GEO = { ico: new THREE.IcosahedronGeometry(0.5, 0), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), sph: new THREE.SphereGeometry(0.5, 10, 8), cone: new THREE.ConeGeometry(0.5, 1, 8) };
// parçaları tek geometriye pişirir (köşe rengi): her süs 1 çizim çağrısı
function bake(parts, opt = {}) {
  const pos = [], nor = [], col = [];
  for (const [g, c, at, s = [1, 1, 1], r = [0, 0, 0]] of parts) {
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(_m.compose(_t.set(...at), _q.setFromEuler(_e.set(...r)), _s.set(...s)));
    _c.set(c);
    pos.push(...geo.attributes.position.array); nor.push(...geo.attributes.normal.array);
    for (let i = 0; i < geo.attributes.position.count; i++) col.push(_c.r, _c.g, _c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...opt }));
  m.castShadow = false; m.receiveShadow = false;
  return m;
}
// bayrak dizisi: iki uç arasında sarkan ip ve üçgen bayraklar (tek geometri)
function bunting(a, b, sag) {
  const pos = [], col = [], COLS = ['#e8604c', '#f4c542', '#3b8beb', '#5cc46a', '#ffffff', '#a24bff'], n = Math.max(4, Math.round(a.distanceTo(b) / 0.34));
  const at = (k) => new THREE.Vector3().lerpVectors(a, b, k).add(new THREE.Vector3(0, -sag * 4 * k * (1 - k), 0));
  for (let i = 0; i < n; i++) {
    const p0 = at((i + 0.12) / n), p1 = at((i + 0.88) / n), tip = at((i + 0.5) / n).add(new THREE.Vector3(0, -0.28, 0));
    pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, tip.x, tip.y, tip.z);
    _c.set(COLS[i % COLS.length]); for (let k = 0; k < 3; k++) col.push(_c.r, _c.g, _c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const flags = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  const pts = []; for (let i = 0; i <= 24; i++) pts.push(at(i / 24));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#5a4636' }));
  const g = new THREE.Group(); g.add(flags, line);
  return g;
}
function buildDeco() {
  const K = G.regions.koy, n = K.stage || 1, S = STAGES[n];
  decoStage = n; lastPaid = A.paid.join();
  if (deco) { K.content.remove(deco); deco.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  deco = new THREE.Group(); vane = null;
  const cx = (S.x0 + S.x1) / 2, bh = n === 1 ? 2.6 : 3.2, sw = n === 1 ? 4.6 : n === 2 ? 6.8 : 8.6, sh = n === 1 ? 0.95 : n === 2 ? 1.2 : 1.45, sy = bh + (n === 1 ? 1.05 : 1.55);
  const has = (p) => A.paid.includes(p);
  if (has('urun')) { // altın tabela çerçevesi ve köşe topuzları
    const gold = '#e2b23c', z = -12.98, fx = sw / 2 + 0.08, fy = sh / 2 + 0.08;
    deco.add(bake([[GEO.box, gold, [cx, sy + fy, z], [sw + 0.3, 0.13, 0.3]], [GEO.box, gold, [cx, sy - fy, z], [sw + 0.3, 0.13, 0.3]],
      [GEO.box, gold, [cx - fx, sy, z], [0.13, sh + 0.3, 0.3]], [GEO.box, gold, [cx + fx, sy, z], [0.13, sh + 0.3, 0.3]],
      ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([i, j]) => [GEO.sph, '#ffd968', [cx + i * fx, sy + j * fy, z + 0.04], [0.22, 0.22, 0.22]])], { metalness: 0.35, roughness: 0.45, emissive: '#3a2600' }));
  }
  if (has('hayvan')) { // tabelanın üstünde horozlu rüzgâr gülü
    const y0 = sy + sh / 2 + (n >= 3 ? 0.3 : 0.1), z = -13.05, iron = '#3d4552';
    deco.add(bake([[GEO.cyl, iron, [cx, y0 + 0.45, z], [0.06, 0.9, 0.06]], [GEO.box, iron, [cx, y0 + 0.55, z], [0.7, 0.035, 0.035]], [GEO.box, iron, [cx, y0 + 0.55, z], [0.035, 0.035, 0.7]],
      [GEO.sph, '#c8873a', [cx, y0 + 0.92, z], [0.1, 0.1, 0.1]]], { metalness: 0.3 }));
    vane = new THREE.Group(); vane.position.set(cx, y0 + 0.98, z);
    const cu = '#c8873a';
    vane.add(bake([[GEO.box, cu, [0, 0.16, 0], [0.34, 0.2, 0.05]], [GEO.box, cu, [-0.21, 0.27, 0], [0.14, 0.3, 0.05], [0, 0, 0.5]], [GEO.box, cu, [0.17, 0.32, 0], [0.12, 0.14, 0.05]],
      [GEO.box, '#d8402f', [0.17, 0.42, 0], [0.09, 0.07, 0.055]], [GEO.box, '#f4c542', [0.26, 0.31, 0], [0.07, 0.04, 0.05]], [GEO.box, cu, [0, 0.03, 0], [0.04, 0.1, 0.04]],
      [GEO.box, cu, [0, 0, 0], [0.62, 0.035, 0.035]], [GEO.cone, cu, [0.34, 0, 0], [0.09, 0.14, 0.09], [0, 0, -Math.PI / 2]]], { metalness: 0.4, roughness: 0.5 }));
    deco.add(vane);
  }
  if (has('bolge')) { // tentenin uçlarından tabelanın tepesine iki bayrak dizisi
    const L = new THREE.Vector3(S.x0 - 0.15, bh - 0.12, -12.15), R = new THREE.Vector3(S.x1 + 0.15, bh - 0.12, -12.15);
    deco.add(bunting(L, new THREE.Vector3(cx - sw / 2 - 0.1, sy + sh / 2, -12.95), 0.3), bunting(new THREE.Vector3(cx + sw / 2 + 0.1, sy + sh / 2, -12.95), R, 0.3));
  }
  if (has('ziyaretci')) { // arka duvarın üstünde, tabelanın iki yanında çiçekli saksılar (yerde boş köşe yok: tarla, yol, ağaç)
    const parts = [], FL = ['#e8463c', '#f4c542', '#ff8fb8', '#ffffff', '#a24bff', '#ff8a2a'], y0 = bh + (n >= 3 ? 0.225 : 0), z = -13.2, L = 1.5;
    for (const [a, b] of [[S.x0 + 0.1, cx - sw / 2 - 0.25], [cx + sw / 2 + 0.25, S.x1 - 0.1]]) {
      const k = Math.max(1, Math.floor((b - a) / 2.2)), gap = (b - a - k * L) / (k + 1);
      for (let j = 0; j < k; j++) {
        const x = a + gap + L / 2 + j * (L + gap);
        parts.push([GEO.box, '#9a6436', [x, y0 + 0.17, z], [L, 0.34, 0.4]], [GEO.box, '#c48a52', [x, y0 + 0.36, z], [L + 0.08, 0.07, 0.48]]);
        for (let i = 0; i < 5; i++) {
          const fx = x - L / 2 + 0.2 + i * ((L - 0.4) / 4), h = y0 + 0.5 + ((i * 7 + j * 3) % 4) * 0.04;
          parts.push([GEO.ico, '#4f9a3c', [fx, h - 0.06, z], [0.3, 0.2, 0.34]], [GEO.ico, FL[(i + j * 2) % FL.length], [fx, h + 0.08, z + 0.02], [0.18, 0.15, 0.18]]);
        }
      }
    }
    deco.add(bake(parts));
  }
  if (has('etkinlik')) { // tentenin altında fener dizisi; gece ışıldar
    const W = S.x1 - S.x0, k = Math.max(3, Math.round(W / 1.7)), y = bh - 0.42, z = -12.25, wire = [], glow = [];
    wire.push([GEO.box, '#3d3328', [cx, bh - 0.17, z], [W - 0.6, 0.025, 0.025]]);
    for (let i = 0; i < k; i++) {
      const x = S.x0 + 0.5 + ((W - 1) * (i + 0.5)) / k;
      wire.push([GEO.box, '#3d3328', [x, bh - 0.24, z], [0.02, 0.14, 0.02]], [GEO.cyl, '#3d3328', [x, y + 0.17, z], [0.16, 0.05, 0.16]], [GEO.cyl, '#3d3328', [x, y - 0.17, z], [0.14, 0.04, 0.14]]);
      glow.push([GEO.sph, i % 2 ? '#f4c542' : '#e8463c', [x, y, z], [0.3, 0.34, 0.3]]);
    }
    deco.add(bake(wire), bake(glow, { emissive: '#ff9a3c', emissiveIntensity: 0.35, roughness: 0.6 }));
  }
  K.content.add(deco);
}

// ---------- albüm sayfası (menü) ----------
const cards = loadCards(); // bölge kartpostalları: bir kez çekilir, ayrı anahtarda saklanır
function loadCards() { try { return JSON.parse(localStorage.getItem('koyBakkali.kart') || '{}'); } catch (e) { return {}; } }
function saveCards() { try { localStorage.setItem('koyBakkali.kart', JSON.stringify(cards)); } catch (e) { /* yer yok */ } }
let cam = null, cardQ = [], cardTimer = 0;
// bölgenin üstünden kuşbakışı kare: ana tuvalin sol alt köşesine 3:2 çizilir, küçük tuvale kopyalanır, oyun karesi geri çizilir
function shoot(id) {
  const R = G.regions[id], rd = G.renderer, r = R.rect;
  if (!rd || !R.unlocked) return null;
  const cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2, s = Math.max(r[1] - r[0], r[3] - r[2], 14);
  if (!cam) cam = new THREE.PerspectiveCamera(38, 1.5, 0.5, 600);
  cam.position.set(cx, s * 0.66 + 4, cz + s * 0.58 + 4); cam.lookAt(cx, 0, cz - s * 0.04); cam.updateProjectionMatrix();
  const el = rd.domElement, pr = rd.getPixelRatio(), cw = el.width / pr, ch = el.height / pr;
  const w = Math.min(cw, ch * 1.5), h = w / 1.5;
  rd.setViewport(0, 0, w, h);
  rd.info.render.frame += 7; rd.render(G.scene, cam);
  const cv = document.createElement('canvas'); cv.width = 240; cv.height = 160;
  cv.getContext('2d').drawImage(el, 0, el.height - h * pr, w * pr, h * pr, 0, 0, 240, 160);
  rd.setViewport(0, 0, cw, ch);
  rd.info.render.frame += 7; rd.render(G.scene, G.camera);
  return cv.toDataURL('image/jpeg', 0.78);
}
// menü açıkken oyun döngüsü durur: kartlar zamanlayıcıyla birer birer çekilir (telefonda tek seferde 19 çizim takılma yapar)
function pumpCards() {
  cardTimer = 0;
  const id = cardQ.shift();
  if (!id || !document.querySelector('#mmBody [data-pc]')) { cardQ = []; return; }
  const fresh = !cards[id], url = cards[id] || shoot(id);
  if (url) {
    cards[id] = url;
    const el = document.querySelector(`#mmBody [data-pc="${id}"]`);
    if (el && fresh) el.innerHTML = `<img src="${url}" alt="">`;
    if (fresh && !cardQ.some((k) => !cards[k])) saveCards();
  }
  if (cardQ.length) cardTimer = setTimeout(pumpCards, fresh ? 120 : 0);
}
function albumHTML() {
  G.albumNew = false;
  const P = pageOf(tab), list = entries(tab), mine = A[tab], n = mine.filter((x) => list.includes(x)).length, done = A.paid.includes(tab);
  const tabs = PAGES.map((p) => { const L = entries(p.id), k = A[p.id].filter((x) => L.includes(x)).length;
    return `<button type="button" class="${p.id === tab ? 'on' : ''}${A.paid.includes(p.id) ? ' full' : ''}" data-alb="${p.id}"><span>${p.icon}</span><b>${p.name}</b><small>${k}/${L.length}</small></button>`; }).join('');
  const st = (ok, ic, name, cls = '') => `<div class="st${ok ? ' got' : ''}${cls}"><span class="pic">${ic}</span><small>${name}</small></div>`;
  let grid = '';
  if (tab === 'urun') grid = list.map((k) => st(mine.includes(k), G.icons[k] ? `<img src="${G.icons[k]}" alt="">` : '🧺', ITEMS[k].name)).join('');
  else if (tab === 'hayvan') grid = ANIMAL.map(([k, ic, nm]) => st(mine.includes(k), ic, nm)).join('');
  else if (tab === 'ziyaretci') grid = VISIT.map(([k, ic, nm]) => st(mine.includes(k), ic, nm)).join('');
  else if (tab === 'etkinlik') grid = WEEKS.map((w) => st(mine.includes(w.id), w.icon, w.name, ' badge')).join('');
  else {
    cardQ = []; clearTimeout(cardTimer);
    grid = list.map((id) => {
      const R = G.regions[id], ok = mine.includes(id);
      if (ok && !cards[id]) cardQ.push(id);
      return `<div class="st pc${ok ? ' got' : ''}"><span class="pic" data-pc="${id}">${ok && cards[id] ? `<img src="${cards[id]}" alt="">` : REG_IC[id] || '🗺️'}</span><small>${ok || !R.hidden ? R.name : '❓ Gizli bölge'}</small></div>`;
    }).join('');
  }
  const W = A.wk, ev = W && WEEKS.find((w) => w.id === W.ev);
  const week = tab === 'etkinlik' && ev ? `<div class="alb-wk"><span class="ic">${ev.icon}</span><span><small>Bu hafta · ${daysLeft()} gün kaldı</small><b>${ev.name}</b><small>${ev.items.map((t) => ITEMS[t].name).join(', ')} %50 pahalı</small></span><b class="pr">${Math.min(W.n, W.goal)}/${W.goal}${W.done ? ' ✓' : ''}</b></div>` : '';
  if (cardQ.length) cardTimer = setTimeout(pumpCards, 250); // menü yerleşince ilk kart
  return `<p class="mm-lead">Köyde gördüğün, eline aldığın, açtığın her şey buraya çıkartma olur. Sayfa dolunca para, XP ve dükkânına kalıcı bir süs.</p>
<div class="alb-tabs">${tabs}</div>
<div class="alb-head mm-next${done ? ' boost' : ''}"><span class="ic">${P.icon}</span><span><small>${P.how}</small><b>${P.name} · ${n}/${list.length}</b></span><b class="pr">${done ? '✓ Tamam' : `${tl(P.money)} ₺`}</b></div>
<div class="mm-prog"><span class="bar"><i style="width:${(n / list.length) * 100}%"></i></span><b>${done ? `Süs: ${P.deco}` : `Ödül: ${P.deco}`}</b></div>
${week}<div class="alb-grid${tab === 'bolge' ? ' wide' : ''}">${grid}</div>`;
}
const CSS = `#albPop { position: fixed; left: 50%; bottom: 92px; z-index: 40; display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border-radius: 16px;
  background: var(--row-bg); color: var(--row-ink); border: var(--bw) solid var(--line); box-shadow: 0 5px 0 rgba(0,0,0,.14), 0 10px 26px rgba(0,0,0,.18);
  transform: translate(-50%, 24px) scale(.9); opacity: 0; transition: transform .28s cubic-bezier(.3,1.6,.5,1), opacity .2s; pointer-events: none; }
#albPop.on { transform: translate(-50%, 0) scale(1); opacity: 1; }
#albPop .ic { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; font-size: 28px; background: rgba(0,0,0,.06); }
#albPop .ic img { width: 38px; height: 38px; object-fit: contain; }
#albPop small { display: block; font: 900 11px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: var(--row-soft); }
#albPop b { display: block; font: 19px var(--font-title); font-weight: normal; }
#albPop .n { margin-left: 6px; font: 15px var(--font-title); background: var(--gold); color: var(--gold-ink); padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.alb-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 10px; }
.alb-tabs button { display: flex; align-items: center; gap: 6px; padding: 6px 12px 6px 8px; border-radius: 999px; cursor: pointer; background: var(--row-bg); color: var(--row-ink); border: var(--bw) solid var(--line); box-shadow: 0 3px 0 rgba(0,0,0,.12); font: 15px var(--font-title); }
.alb-tabs button span { font-size: 18px; }
.alb-tabs button b { font-weight: normal; }
.alb-tabs button small { font: 900 12px var(--font-body); opacity: .7; }
.alb-tabs button.on { background: var(--tab-on); color: var(--tab-ink); }
.alb-tabs button.full small::after { content: ' ✓'; }
.alb-wk { display: grid; grid-template-columns: 40px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 10px 14px; margin-top: 10px; background: var(--gold); color: var(--gold-ink); border: var(--bw) solid var(--line); border-radius: 16px; }
.alb-wk .ic { font-size: 30px; text-align: center; }
.alb-wk small { display: block; font: 800 12px var(--font-body); opacity: .85; }
.alb-wk b { display: block; font: 19px var(--font-title); font-weight: normal; }
.alb-wk .pr { font-size: 20px; }
.alb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; margin-top: 12px; }
.alb-grid.wide { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.alb-grid .st { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px 7px; border-radius: 14px; border: 2px dashed rgba(0,0,0,.18); background: rgba(0,0,0,.05); text-align: center; }
.alb-grid .st .pic { width: 54px; height: 54px; display: grid; place-items: center; font-size: 34px; filter: grayscale(1) brightness(.35) opacity(.35); }
.alb-grid .st .pic img { width: 50px; height: 50px; object-fit: contain; }
.alb-grid .st small { font: 800 11.5px var(--font-body); line-height: 1.15; color: var(--row-soft); opacity: .7; }
.alb-grid .st.got { background: var(--row-bg); border: var(--bw) solid var(--line); border-style: solid; box-shadow: 0 3px 0 rgba(0,0,0,.1); transform: rotate(-1.2deg); }
.alb-grid .st.got:nth-child(2n) { transform: rotate(1.4deg); }
.alb-grid .st.got .pic { filter: none; }
.alb-grid .st.got small { color: var(--row-ink); opacity: 1; }
.alb-grid .st.badge.got .pic { border-radius: 50%; background: var(--gold); box-shadow: inset 0 0 0 3px #fff8; }
.alb-grid .st.pc .pic { width: 100%; height: auto; aspect-ratio: 3 / 2; border-radius: 9px; overflow: hidden; background: rgba(0,0,0,.08); font-size: 38px; }
.alb-grid .st.pc .pic img { width: 100%; height: 100%; object-fit: cover; }
.alb-grid .st.pc.got .pic { box-shadow: 0 0 0 4px #fff, 0 2px 6px rgba(0,0,0,.25); }`;

// ---------- başlat ve kare ----------
function init() {
  const st = G.stats;
  const old = !st.album;
  A = st.album = st.album || {};
  for (const P of PAGES) if (!Array.isArray(A[P.id])) A[P.id] = [];
  if (!Array.isArray(A.paid)) A.paid = [];
  // eski kayıt: açılmış bölgelerin müşterileri ve üretilen ürünler sessizce yapışır (oyuncu baştan toplamak zorunda kalmasın)
  if (old && (st.time || 0) > 600) {
    for (const id of regionIds()) if (G.regions[id].unlocked) { got('bolge', id, true); got('ziyaretci', id, true); }
    for (const s of G.stations) for (const x of [s, s.out]) if (x && x.type && ITEMS[x.type] && x.def === undefined) got('urun', x.type, true);
  }
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  G.hooks.got = onGot;
  G.hooks.weekHTML = weekHTML;
  G.hooks.albumHTML = albumHTML;
  G.hooks.albumTab = (t) => { if (pageOf(t)) tab = t; };
  weekCheck(true);
}
export function updateAlbum(dt) {
  if (!A) { if (!G.player || !G.stats) return; init(); }
  stepPop(dt);
  if (vane) vane.rotation.y = Math.sin(G.time * 0.23) * 0.9 + Math.sin(G.time * 0.71) * 0.25; // rüzgârda salınır
  if ((scanT -= dt) > 0) return;
  scanT = 1;
  if (G.visit) return;
  scan();
  weekCheck(false);
  weekDone();
  if (G.time > 8 && !G.cine && !G.menuOpen && !G.paused) checkPages();
  const K = G.regions.koy;
  if (K && (decoStage !== (K.stage || 1) || lastPaid !== A.paid.join())) { if (A.paid.length || deco) buildDeco(); else decoStage = K.stage || 1; }
}
