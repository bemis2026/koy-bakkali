// Mevsimler: her mevsim 7 oyun günü (gün döngüsünün 7 turu, ≈84 dk; daylight.js), sırayla ilkbahar, yaz, sonbahar, kış.
// Mevsim yalnız yeni günün yumuşak geçişinde değişir (ışık sönükken). Her mevsimde:
//  - görünüş: doğa süsünün birleşik renkleri boyanır (perf.js setSeasonTint: sonbaharda yeşiller turuncu, kışın üstler karlı),
//    çim zeminin rengi, gök ve güneşin rengi değişir (daylight.js G.season); ilkbaharda çiçek yaprağı, sonbaharda yaprak,
//    kışın kar tanesi uçuşur.
//  - sahil ve sıcak: öğlen sıcağı yazın güçlü, kışın yok; sahile gelen müşteri mevsimle azalıp çoğalır (world.js).
//  - mevsim ürünleri: %30 pahalı satılır (ITEMS fiyatı mevsimce değişir) ve köy müşterisi onların rafına daha çok gider.
//  - mevsim görevi: mevsim boyunca tek büyük görev; hedef oyuncunun hızına göre, ödül 8 günlük görev kadar para ve 100 XP.
// Gün sayısı G.stats.dayN, mevsim görevi G.stats.season; kayıtla gider.
import * as THREE from 'three';
import { G, ITEMS, toast, sfx } from './game.js';
import { banner } from './ui.js';
import { addXp } from './level.js';
import { tex } from './tex.js';
import { DAY } from './daylight.js';
import { setSeasonTint, recolored } from './perf.js';

export const SEASON_DAYS = 7;
const hsl = { h: 0, s: 0, l: 0 }, SNOW = new THREE.Color('#f2f6fa');
const green = (c) => { c.getHSL(hsl); return hsl.h > 0.17 && hsl.h < 0.47 && hsl.s > 0.2; };
const AUTUMN = [0.075, 0.115, 0.035]; // turuncu, sarı, kızıl: parça parça karışık
const SEASONS = [
  { id: 'ilkbahar', name: 'İlkbahar', icon: '🌸', heat: 0.7, beach: 0.85, a: 0.2, bg: '#d6efff', sun: '#fff1ee', gnd: '#a9d08e', grass: '#f2ffe6', fx: 'petal',
    items: ['salatalik', 'cicek', 'yumurta', 'lahana'], tint: (c) => { if (green(c)) c.offsetHSL(0.01, 0.08, 0.03); } },
  { id: 'yaz', name: 'Yaz', icon: '☀️', heat: 1.25, beach: 1.25, a: 0.15, bg: '#c2e7ff', sun: '#fff3d2', gnd: '#a3c47a', grass: '#fff8de', fx: null,
    items: ['karpuz', 'dondurma', 'misir', 'meyvesuyu', 'limon'], tint: null },
  { id: 'sonbahar', name: 'Sonbahar', icon: '🍂', heat: 0.55, beach: 0.6, a: 0.3, bg: '#f1e1c9', sun: '#ffd49a', gnd: '#b9a06e', grass: '#f0d9a0', fx: 'leaf',
    items: ['balkabagi', 'elma', 'bal', 'tursu', 'aycicek'], tint: (c, ny, k) => { if (!green(c)) return; c.getHSL(hsl); c.setHSL(AUTUMN[k % 3], Math.min(0.95, hsl.s + 0.15), hsl.l * 0.95); } },
  { id: 'kis', name: 'Kış', icon: '❄️', heat: 0.1, beach: 0.35, a: 0.4, bg: '#e4edf4', sun: '#eef4ff', gnd: '#c9d3d8', grass: '#e3ecf0', fx: 'snow',
    items: ['corba', 'balikcorba', 'guvec', 'ekmek', 'simit'], tint: (c, ny) => { if (green(c)) c.offsetHSL(0, -0.3, -0.02); if (ny > 0.5) c.lerp(SNOW, Math.min(0.75, (ny - 0.5) * 1.6)); } },
].map((s) => ({ ...s, bgC: new THREE.Color(s.bg), sunC: new THREE.Color(s.sun), gndC: new THREE.Color(s.gnd) }));

const seasonOf = (n) => Math.floor((n || 0) / SEASON_DAYS) % 4;
const base = {}; // ürünlerin mevsimsiz fiyatı
let cur = -1, fx = null, checkT = 0;

// ---------- görünüş ----------
function paintGround(S) {
  const src = tex('grass').source, mats = new Set();
  G.scene.traverse((o) => { if (o.isMesh && !Array.isArray(o.material) && o.material.map && o.material.map.source === src) mats.add(o.material); });
  const tint = new THREE.Color(S.grass);
  for (const m of mats) {
    if (!m.userData.baseCol) { m.userData.baseCol = m.color.clone(); m.userData.baseEm = [m.emissive.getHex(), m.emissiveIntensity]; }
    m.color.copy(m.userData.baseCol).multiply(tint);
    // kış: çarpma yeşili yalnız koyulaştırır; hafif beyaz parıltı çimi kırağı tutmuş gibi açar
    if (S.id === 'kis') { m.emissive.set('#dfe8ee'); m.emissiveIntensity = 0.38; } else { m.emissive.setHex(m.userData.baseEm[0]); m.emissiveIntensity = m.userData.baseEm[1]; }
    recolored(m); // birleşimler "renk değişti" sanıp bozulmasın
  }
}
// uçuşan parçacıklar (tek çizim). Kar oyuncunun çevresindeki 50 m'lik kutuda yağar, yere inince tepeye döner. Yaprak ve çiçek
// yaprağı (tree) yalnız ağaçlardan kopar: oyuncunun 30 m çevresindeki yapraklı bir ağacın tepesinden düşer, yere inince biraz bekleyip
// yakındaki başka bir ağaçtan yeniden kopar; yakında ağaç yoksa uçuşmaz (2026-11-04 kullanıcı: "çok fazla yaprak uçuşuyor, azalt ve
// ağaçlık bölgelerde olsun"; eskiden 160-180 parça her yerde yağıyordu)
const FX = { petal: { n: 60, v: 0.7, cols: ['#ffd1e3', '#ffffff', '#ffb6cf'], size: 0.5, sway: 1.0, tree: true }, leaf: { n: 60, v: 0.9, cols: ['#e8792b', '#f2b134', '#c94a25', '#a8641d'], size: 0.6, sway: 1.4, tree: true },
  snow: { n: 260, v: 1.1, cols: ['#ffffff', '#eef6ff'], size: 0.45, sway: 0.6 } }; // boy: dünya birimi, 30 m uzaktan 6-8 piksel
function dotTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function setFx(kind) {
  if (fx) { fx.pts.removeFromParent(); fx.pts.geometry.dispose(); fx.pts.material.dispose(); fx = null; }
  const F = FX[kind];
  if (!F) return;
  const pos = new Float32Array(F.n * 3), col = new Float32Array(F.n * 3), ph = new Float32Array(F.n), c = new THREE.Color();
  for (let i = 0; i < F.n; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 50; pos[i * 3 + 1] = F.tree ? -50 - Math.random() * 4 : Math.random() * 16; pos[i * 3 + 2] = (Math.random() - 0.5) * 50; // ağaç yaprağı beklemede başlar, birer birer kopar
    c.set(F.cols[i % F.cols.length]); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; ph[i] = Math.random() * 6.28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: F.size, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5;
  G.scene.add(pts);
  fx = { F, pts, ph, t: 0 };
}
// yapraklı ağaçlar [x, z, tepe yüksekliği]: orman (decor.js G.trees, çam hariç) ve makeTree'nin yapraklıları (models.js userData.leafTree).
// Liste 20 sn'de bir tazelenir (yeni açılan bölgelerin ağaçları da girer); oyuncunun yakınındakiler saniyede bir süzülür
const TREE_R = 30;
let leafy = null, leafyT = -99, near = [], nearT = -99;
function nearTrees() {
  if (G.time - leafyT > 20 || !leafy) {
    leafyT = G.time; leafy = [];
    for (const t of G.trees || []) if (!t[3]) leafy.push([t[0], t[1], 2.0 * t[2]]);
    const v = new THREE.Vector3(), sc = new THREE.Vector3();
    G.scene.traverse((o) => { if (o.userData.leafTree) { o.getWorldPosition(v); o.getWorldScale(sc); leafy.push([v.x, v.z, o.userData.leafTree * sc.y]); } });
    nearT = -99;
  }
  if (G.time - nearT > 1) {
    nearT = G.time; const p = G.player.position;
    near = leafy.filter((t) => Math.abs(t[0] - p.x) < TREE_R && Math.abs(t[1] - p.z) < TREE_R);
  }
  return near;
}
function stepFx(dt) {
  if (!fx || !G.player) return;
  const { F, pts, ph } = fx, a = pts.geometry.attributes.position.array, p = G.player.position;
  if (F.tree) return stepLeaves(dt);
  pts.position.set(p.x, 0, p.z); // kutu oyuncuyla gelir; parçacıklar kutunun içinde düşer
  fx.t += dt;
  for (let i = 0; i < F.n; i++) {
    const k = i * 3;
    a[k + 1] -= F.v * dt * (0.7 + 0.6 * ((i * 7) % 5) / 5);
    a[k] += Math.sin(fx.t * 1.3 + ph[i]) * F.sway * dt;
    a[k + 2] += Math.cos(fx.t * 1.1 + ph[i]) * F.sway * 0.6 * dt;
    if (a[k + 1] < 0) { a[k + 1] = 14 + Math.random() * 2; a[k] = (Math.random() - 0.5) * 50; a[k + 2] = (Math.random() - 0.5) * 50; }
  }
  pts.geometry.attributes.position.needsUpdate = true;
}
// ağaç yaprağı: dünya koordinatında düşer. y < −40: beklemede (görünmez); bekleme bitince yakındaki bir ağacın tepesinden kopar.
// Havadaki yaprak sayısı yakındaki ağaç başına 3 ile sınırlı: tek ağacın altında bir iki yaprak, ormanda daha çok
function stepLeaves(dt) {
  const { F, pts, ph } = fx, a = pts.geometry.attributes.position.array;
  pts.position.set(0, 0, 0);
  fx.t += dt;
  const T = nearTrees(), cap = T.length * 3;
  let act = 0;
  for (let i = 1; i < a.length; i += 3) if (a[i] >= -40) act++;
  for (let i = 0; i < F.n; i++) {
    const k = i * 3;
    if (a[k + 1] < -40) { // beklemede: süre y'nin içinde sayılır (−50'den −54'e kadar rastgele)
      a[k + 1] += dt;
      if (a[k + 1] < -50 || act >= cap) continue;
      act++;
      const t = T[(Math.random() * T.length) | 0], r = t[2] * (0.3 + Math.random() * 0.2), th = Math.random() * 6.28; // tepenin alt kenarından (içinden kopsa tepe örterdi)
      a[k] = t[0] + Math.cos(th) * r; a[k + 2] = t[1] + Math.sin(th) * r; a[k + 1] = t[2] * (0.55 + Math.random() * 0.25);
      continue;
    }
    a[k + 1] -= F.v * dt * (0.7 + 0.6 * ((i * 7) % 5) / 5);
    a[k] += Math.sin(fx.t * 1.3 + ph[i]) * F.sway * dt;
    a[k + 2] += Math.cos(fx.t * 1.1 + ph[i]) * F.sway * 0.6 * dt;
    if (a[k + 1] < 0.02) a[k + 1] = -50 - 4 - Math.random() * 4; // yere indi: 4-8 sn bekler
  }
  pts.geometry.attributes.position.needsUpdate = true;
}

// ---------- mevsim ürünleri ve görevi ----------
const per = (v) => (G.stats.time > 600 ? (v / G.stats.time) * DAY * SEASON_DAYS * 0.5 : 0);
const QUESTS = {
  mus: { icon: '👥', text: (n) => `Mevsim boyunca ${n.toLocaleString('tr-TR')} müşteriye hizmet et`, val: () => G.stats.customers, goal: () => Math.round(Math.max(80, per(G.stats.customers)) / 10) * 10 },
  sat: { icon: '📦', text: (n) => `Mevsim boyunca ${n.toLocaleString('tr-TR')} ürün sat`, val: () => G.stats.sold, goal: () => Math.round(Math.max(150, per(G.stats.sold)) / 10) * 10 },
  kaz: { icon: '💰', text: (n) => `Mevsim boyunca ${n.toLocaleString('tr-TR')} ₺ kazan`, val: () => G.stats.earned, goal: () => Math.round(Math.max(2000, per(G.stats.earned)) / 1000) * 1000 },
  golge: { icon: '☂️', text: (n) => `Yaz boyunca ${n} müşteriye şemsiye gölgesinde servis yap`, val: () => G.stats.shade || 0, goal: () => Math.round((4 + 0.6 * G.level) * SEASON_DAYS * 0.6) },
  kervan: { icon: '🐫', text: (n) => `Mevsim boyunca ${n} kervanı memnun et`, val: () => G.stats.caravans, goal: () => Math.round((2 + G.level / 10) * SEASON_DAYS * 0.6) },
};
const questKind = (S) => (S.id === 'ilkbahar' ? 'mus' : S.id === 'yaz' ? (G.unlocked.has('gs') ? 'golge' : 'sat') : S.id === 'sonbahar' ? (G.unlocked.has('gh') ? 'kervan' : 'kaz') : 'kaz');
const reward = () => 8 * (50 + 40 * (G.level || 1));
const yearOf = (n) => Math.floor((n || 0) / (SEASON_DAYS * 4));

function applySeason(i, fresh) {
  const S = SEASONS[i];
  cur = i; G.season = S;
  reprice();
  setSeasonTint(S.tint);
  paintGround(S);
  setFx(S.fx);
  const q = G.stats.season;
  if (!q || q.i !== i || q.y !== yearOf(G.stats.dayN)) {
    const k = questKind(S);
    G.stats.season = { i, y: yearOf(G.stats.dayN), k, goal: QUESTS[k].goal(), from: QUESTS[k].val(), done: false };
  }
  if (fresh) {
    banner(`YENİ MEVSİM ${S.icon}`, S.name);
    toast(`${S.icon} ${S.name}: ${S.items.filter((t) => ITEMS[t]).map((t) => ITEMS[t].name || t).join(', ')} %30 pahalı ve çok aranıyor`);
  }
}

export function initMevsim() {
  for (const t in ITEMS) if (typeof ITEMS[t].price === 'number') base[t] = ITEMS[t].price;
  applySeason(seasonOf(G.stats.dayN), false);
  const prev = G.hooks.newDay; // gorev.js de yeni günü dinler
  G.hooks.newDay = (n) => { if (prev) prev(n); const i = seasonOf(n); if (i !== cur) applySeason(i, true); };
}
export function updateMevsim(dt) {
  stepFx(dt);
  if ((checkT -= dt) > 0) return;
  checkT = 0.5;
  const q = G.stats.season, Q = q && QUESTS[q.k];
  if (!Q || q.done || Q.val() - q.from < q.goal) return;
  q.done = true;
  const m = reward(); if (!G.visit) G.money += m; addXp(100);
  banner('MEVSİM GÖREVİ TAMAM', `${G.season.icon} +${m.toLocaleString('tr-TR')} ₺`); sfx('hire');
}
// fiyat: mevsim ürünü %30, haftanın etkinlik ürünü %50 pahalı (album.js G.weekItems); ikisi denk gelirse çarpılır
export function reprice() {
  const S = G.season, W = G.weekItems || [];
  for (const t in base) ITEMS[t].price = Math.round(base[t] * (S && S.items.includes(t) ? 1.3 : 1) * (W.includes(t) ? 1.5 : 1));
}
// köy müşterisi: mevsim ürünü alan rafı daha çok seçer (world.js koyPlan)
export const seasonItems = () => (G.season ? G.season.items : []);
// görev listesinin üstünde mevsim satırı (gorev.js)
export function seasonHTML() {
  const S = G.season, q = G.stats.season;
  if (!S || !q) return '';
  const Q = QUESTS[q.k], p = Math.min(q.goal, Math.max(0, Q.val() - q.from)), d = ((G.stats.dayN || 0) % SEASON_DAYS) + 1;
  const items = S.items.filter((t) => ITEMS[t]).map((t) => ITEMS[t].name || t).join(', ');
  return `<h5>${S.icon} ${S.name} · ${d}/${SEASON_DAYS}. gün</h5><p class="sz">Mevsim ürünleri (%30 pahalı): ${items}</p>
<div class="t${q.done ? ' done' : ''}"><i>${q.done ? '✅' : Q.icon}</i><b>${Q.text(q.goal)}</b><span>${p.toLocaleString('tr-TR')}/${q.goal.toLocaleString('tr-TR')}</span><span class="bar"><u style="width:${(p / q.goal) * 100}%"></u></span></div>
<small>Mevsim görevi ödülü ${reward().toLocaleString('tr-TR')} ₺ ve 100 XP.</small><hr>`;
}
