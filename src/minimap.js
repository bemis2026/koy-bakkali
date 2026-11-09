// Mini harita: küçükken oyuncunun çevresini yakından, tıklayınca bütün haritayı gösterir.
// Sabit katman (çimen, deniz, tarlalar, yollar, bölgeler, binalar) bir kez çizilir; her karede yalnızca görünen kısmı kopyalanır,
// üstüne oyuncu, elemanlar, müşteriler, paralar ve sıradaki hedef eklenir.
import * as THREE from 'three';
import { G } from './game.js';
import { coastZ, duneZ } from './nature.js';
import { PLACES } from './dest.js';
import { initHudMenu } from './hudmenu.js';
import { CITY } from './city.js';

const B_KOY = { x0: -88, x1: 106, z0: -70, z1: 46 }; // harita genişletmesi: batı -7, doğu +7 // kuzeyde taşınan hana ve İpek Yolu'na kadar // batıda benzinliğe kadar
// şehir ayrı bir dünya (x > 300): orada harita şehrin kendi planını çizer (2026-11-02; eskiden şehirde gizleniyordu)
const B_SEHIR = { x0: CITY.x - 36, x1: CITY.x + 36, z0: CITY.z - 20, z1: CITY.z + 24 };
let B = B_KOY;
const PX = 10; // sabit katmanda birim başına piksel
const SMALL_SPAN = 44; // küçük haritada görünen alan (birim)
const REG = {
  koy: { col: '#a3db83', edge: '#5f9e4a', icon: '🏡', short: 'Köy' },
  pazar: { col: '#d8d0c0', edge: '#8f8676', icon: '🍉', short: 'Pazar' },
  sahil: { col: '#f7e3a8', edge: '#c9a65a', icon: '🏖️', short: 'Sahil' },
  han: { col: '#eecb95', edge: '#b0814a', icon: '🐫', short: 'Han' },
  tarla: { col: '#bfe28d', edge: '#6f9e45', icon: '🌽', short: 'Tarla' },
  mera: { col: '#b3d98a', edge: '#6f8f45', icon: '🐑', short: 'Mera' },
  meydan: { col: '#dcd6c8', edge: '#8f8676', icon: '🅿️', short: 'Otopark' },
  ciftlik: { col: '#b9e08f', edge: '#6f9e45', icon: '🐄', short: 'Çiftlik' },
  atolye: { col: '#d8d0c0', edge: '#8f8676', icon: '🧶', short: 'Atölye' },
  atlar: { col: '#e3c99a', edge: '#9b6a3e', icon: '🐎', short: 'Ahır' },
  firin: { col: '#e8d2b0', edge: '#9b7a5a', icon: '🥯', short: 'Fırın' },
  kargo: { col: '#d8dde2', edge: '#7d776b', icon: '📦', short: 'Kargo' },
  tatil: { col: '#f7e3a8', edge: '#3ec1b5', icon: '🐚', short: 'Tatil Köyü' },
  kasaba: { col: '#b9e08f', edge: '#8f8676', icon: '⛲', short: 'Meydan' },
  enerji: { col: '#cfe3b0', edge: '#6d8a4a', icon: '🌬️', short: 'Enerji' },
  tarlalar: { col: '#d9c98a', edge: '#9b6a3e', icon: '🚜', short: 'Tarlalar' },
  iskele: { col: '#c8a06a', edge: '#2f6db5', icon: '🎣', short: 'İskele' },
  lunapark: { col: '#bfe3a0', edge: '#e8473c', icon: '🎡', short: 'Lunapark' },
};
for (const id in PLACES) if (REG[id]) REG[id].edge = PLACES[id].color; // bölge kenarı, ürünlerin altlığıyla aynı renk (dest.js)
// harita dışındaki dekor: tarlalar (merkez x, z, en, boy) ve yollar (x0, x1, z0, z1)
const FIELDS = [];
const ROADS = [[-97, -16, 8.8, 12.6], [-97, -16, -22.6, -21.2], [53, 127, 4.7, 8.3], [11.1, 14.1, -28, -21.2], [15.6, 23.4, -2.8, -0.2], [19.1, 22.5, -15.8, 5], [-62.6, -59.4, -59.6, -22.6], [-84, -59.4, -59.6, -57]]; // köy yolu, han yolu, köy caddesi, enerji yolu
const LOCKED_ROADS = { sahil: [[-60, -15.6, 28.9, 30.5], [-59.4, -57.8, 12.8, 28.9]], han: [[-33, -29, -66, -21.2], [-33, -15.6, -34.4, -30.4]] }; // bölgesiyle açılanlar: sahil yolu ve patikası, İpek Yolu (roads.js)
const ASPHALT = [[-97, 22.5, -21.4, -15.8]]; // ana yol: batı girişinden çiftlik köşesine

let box, cv, ctx, bg = null, bgKey = '', big = false, mini = false, t = 0, W = 0, dpr = 1;
let vx0 = 0, vz0 = 0, span = SMALL_SPAN, s = 1;
const X = (x) => (x - vx0) * s, Z = (z) => (z - vz0) * s;
const SX = (x) => (x - B.x0) * PX, SZ = (z) => (z - B.z0) * PX;
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function initMinimap() {
  box = document.getElementById('minimap');
  cv = document.getElementById('mmap');
  ctx = cv.getContext('2d');
  initHudMenu(); // yan menü ve telefon yerleşimi (hudmenu.js)
  // sol üstteki − haritayı köşede ufak bir kutuya indirir (ekran açılır); ufakken dokununca normal boyuna döner. Bu cihazda hatırlanır
  const mms = document.createElement('span'); mms.className = 'mms'; mms.textContent = '−'; mms.title = 'Haritayı küçült'; box.appendChild(mms);
  const setMini = (v) => { mini = v; box.classList.toggle('mini', v); document.body.classList.toggle('mm-mini', v); try { localStorage.setItem('koyBakkali.mmMini', v ? '1' : '0'); } catch (e) { /* yok */ } };
  try { if (localStorage.getItem('koyBakkali.mmMini') === '1') setMini(true); } catch (e) { /* yok */ }
  // küçükken dokununca büyür; büyükken dokunulan yere karakter kendi koşar (main.js G.hooks.goTo) ve harita küçülür.
  // Sağ üstteki ✕ yalnızca kapatır
  box.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target === mms) { setMini(true); return; }
    if (mini) { setMini(false); return; }
    if (big) {
      const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * (W / r.width), py = (e.clientY - r.top) * (W / r.height);
      if (!(px > W - 44 * dpr && py < 44 * dpr) && G.hooks.goTo) G.hooks.goTo(px / s + vx0, py / s + vz0);
    }
    big = !big; box.classList.toggle('big', big); t = 0;
  });
  // büyüme animasyonu boyunca ve pencere değişince tuvalin piksel boyu kutuya uysun
  if (window.ResizeObserver) new ResizeObserver(resize).observe(box); else addEventListener('resize', resize);
  resize();
}

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = cv.width = cv.height = Math.max(1, Math.round(Math.min(box.clientWidth, box.clientHeight) * dpr));
  t = 0;
}

// ---------- şehrin sabit katmanı: kaldırım, cadde, marketin zemini ve duvarı, raflar, kasalar, durak ----------
function drawCity() {
  bg = bg || document.createElement('canvas');
  const w = (B.x1 - B.x0) * PX, h = (B.z1 - B.z0) * PX, R = G.regions.sehir;
  bg.width = w; bg.height = h;
  const g = bg.getContext('2d');
  const rect = (x0, x1, z0, z1, fill) => { g.fillStyle = fill; g.fillRect(SX(x0), SZ(z0), (x1 - x0) * PX, (z1 - z0) * PX); };
  rect(B.x0, B.x1, B.z0, B.z1, '#d8d2c6'); // arnavut kaldırımı
  const [s0, s1] = CITY.street, sm = SZ((s0 + s1) / 2);
  rect(B.x0, B.x1, s0, s1, '#6b6f76'); // cadde, ortasında kesik çizgi
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.setLineDash([24, 18]);
  g.beginPath(); g.moveTo(0, sm); g.lineTo(w, sm); g.stroke(); g.setLineDash([]);
  const [x0, x1, z0, z1] = CITY.rect;
  rect(x0, x1, z0, z1, R && R.unlocked ? '#f3ead9' : '#c9c3b8'); // market zemini; açılmadıysa gri
  g.strokeStyle = '#2f6db5'; g.lineWidth = 6; g.strokeRect(SX(x0), SZ(z0), (x1 - x0) * PX, (z1 - z0) * PX);
  if (R && R.unlocked) {
    for (const sh of R.shelves || []) rect(sh.zone.x - 1.2, sh.zone.x + 1.2, sh.zone.z - 0.55, sh.zone.z + 0.55, '#6fb35a'); // raflar
    for (const r of R.registers || (R.register ? [R.register] : [])) rect(r.zone.x - 1.35, r.zone.x + 1.35, r.zone.z + 0.9, r.zone.z + 2.1, '#2f6db5'); // kasa bankoları
  }
  const [bx, bz] = CITY.stop; rect(bx - 1.6, bx + 1.6, bz - 1.2, bz - 0.3, '#2f6db5'); // otobüs durağı
}

// ---------- sabit katman ----------
function drawStatic() {
  bg = bg || document.createElement('canvas');
  const w = (B.x1 - B.x0) * PX, h = (B.z1 - B.z0) * PX;
  bg.width = w; bg.height = h;
  const g = bg.getContext('2d');
  const rr = (x0, x1, z0, z1, r = 0) => { g.beginPath(); g.roundRect(SX(x0), SZ(z0), (x1 - x0) * PX, (z1 - z0) * PX, r * PX); };
  // çimen, üstünde açık-koyu benekler
  g.fillStyle = '#c4e6a8'; g.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 1400; i++) { g.fillStyle = i % 2 ? 'rgba(80,140,60,.13)' : 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 1.5 + rnd() * 2, 0, 7); g.fill(); }
  // kumsal ve dalgalı deniz
  // kumsal ve deniz girintili kıyıyı izler (nature.js)
  g.beginPath(); g.moveTo(SX(B.x0), SZ(duneZ(B.x0)));
  for (let x = B.x0; x <= B.x1 + 0.5; x += 0.5) g.lineTo(SX(x), SZ(duneZ(x)));
  for (let x = B.x1; x >= B.x0 - 0.5; x -= 0.5) g.lineTo(SX(x), SZ(coastZ(x)));
  g.closePath(); g.fillStyle = '#efdca3'; g.fill();
  const sea = g.createLinearGradient(0, SZ(31), 0, h);
  sea.addColorStop(0, '#84d2f2'); sea.addColorStop(1, '#4fa9de');
  g.beginPath(); g.moveTo(SX(B.x0), h);
  for (let x = B.x0; x <= B.x1 + 0.5; x += 0.5) g.lineTo(SX(x), SZ(coastZ(x)));
  g.lineTo(SX(B.x1), h); g.closePath(); g.fillStyle = sea; g.fill();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2.5;
  for (let z = 32.4; z < B.z1; z += 1.1) {
    g.beginPath();
    let pen = false; // burunların üstünden geçen dalga çizilmez
    for (let x = B.x0; x <= B.x1; x += 0.5) { const zz = z + Math.sin(x * 0.9 + z * 3) * 0.18; if (zz < coastZ(x) + 0.6) { pen = false; continue; } if (pen) g.lineTo(SX(x), SZ(zz)); else { g.moveTo(SX(x), SZ(zz)); pen = true; } }
    g.stroke();
  }
  // dış tarlalar: sıra sıra ekin
  for (const [cx, cz, fw, fd] of FIELDS) {
    rr(cx - fw / 2, cx + fw / 2, cz - fd / 2, cz + fd / 2, 0.8);
    g.fillStyle = '#ddd27c'; g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(150,125,40,.35)'; g.lineWidth = 3;
    for (let z = cz - fd / 2 + 0.45; z < cz + fd / 2; z += 0.9) { g.beginPath(); g.moveTo(SX(cx - fw / 2), SZ(z)); g.lineTo(SX(cx + fw / 2), SZ(z)); g.stroke(); }
    g.restore();
  }
  // yollar
  for (const r of [...ROADS, ...Object.keys(LOCKED_ROADS).flatMap((id) => (G.regions[id] && G.regions[id].unlocked ? LOCKED_ROADS[id] : []))]) { rr(...r, 0.5); g.fillStyle = '#e8cf9a'; g.fill(); g.strokeStyle = 'rgba(150,110,60,.4)'; g.lineWidth = 2; g.stroke(); }
  for (const r of ASPHALT) {
    rr(...r, 0.4); g.fillStyle = '#8e959c'; g.fill();
    g.setLineDash([12, 10]); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(SX(r[0]), SZ((r[2] + r[3]) / 2)); g.lineTo(SX(r[1]), SZ((r[2] + r[3]) / 2)); g.stroke(); g.setLineDash([]);
  }
  // benzinlik avlusu: kilitliyken gri ve kilitli
  const st = G.stationOpen;
  if (st || G.stationRevealed) { // seviyesi gelmeyen benzinlik haritada yok
    rr(-84.5, -63.5, -14.8, -1.8, 0.6); g.fillStyle = st ? '#a7adb3' : '#c3c7cb'; g.fill(); g.lineWidth = 3; g.strokeStyle = st ? '#c8102e' : '#9aa0a6'; g.stroke();
    g.font = `${5 * PX}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(st ? '⛽' : '🔒', SX(-74), SZ(-8.3));
  }
  // çocuk parkı (park.js, 2026-11-09): e-ticaret ofisinin yerinde, baştan açık
  rr(-62.4, -42.6, -14.4, -4.4, 0.8); g.fillStyle = '#cfe8b4'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#6fae5a'; g.stroke();
  g.font = `${5 * PX}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🎠', SX(-52.5), SZ(-9.4));
  // bölge genişletmeleri (expand.js): satın alınan arsa bölgesinin renginde, kilidi açık olan arsa kesikli çerçeveyle
  for (const a of G.annexes || []) {
    const c = REG[a.region] || { col: '#cfd3d7', edge: '#9aa0a6' };
    rr(...a.rect, 0.8); g.fillStyle = c.col; g.fill(); g.lineWidth = 3; g.strokeStyle = c.edge; g.stroke();
  }
  // bölgeler: açıklar renkli ve çerçeveli, kilitliler gri ve çizgili
  for (const id in REG) {
    const R = G.regions[id];
    if (!R || R.hidden) continue; // seviyesi gelmeyen bölüm haritada yok
    const [x0, x1, z0, z1] = R.rect, c = REG[id];
    rr(x0, x1, z0, z1, 1.2);
    if (R.unlocked) {
      g.fillStyle = c.col; g.fill();
      g.lineWidth = 5; g.strokeStyle = c.edge; g.stroke();
      rr(x0 + 0.5, x1 - 0.5, z0 + 0.5, z1 - 0.5, 0.8); g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke();
    } else {
      g.fillStyle = '#c3c7cb'; g.fill();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 7;
      for (let k = -(z1 - z0); k < x1 - x0; k += 2.4) { g.beginPath(); g.moveTo(SX(x0 + k), SZ(z0)); g.lineTo(SX(x0 + k + (z1 - z0)), SZ(z1)); g.stroke(); }
      g.restore();
      rr(x0, x1, z0, z1, 1.2); g.lineWidth = 3; g.strokeStyle = '#9aa0a6'; g.stroke();
    }
  }
  // tahta iskele
  if (G.regions.sahil && G.regions.sahil.unlocked) {
    rr(-16, 46, 12.8, 15.2); g.fillStyle = '#d9a066'; g.fill();
    g.strokeStyle = 'rgba(120,70,30,.35)'; g.lineWidth = 1.5;
    for (let x = -16; x < 46; x += 1.2) { g.beginPath(); g.moveTo(SX(x), SZ(12.8)); g.lineTo(SX(x), SZ(15.2)); g.stroke(); }
  }
  // tarlalar ve bostanlar: kahverengi toprak, yeşil sıralar
  for (const f of G.soft || []) {
    rr(f[0] + 0.1, f[1] - 0.1, f[2] + 0.1, f[3] - 0.1, 0.4); g.fillStyle = '#a8744a'; g.fill();
    g.fillStyle = '#6fbf4f';
    for (let x = f[0] + 0.8; x < f[1] - 0.3; x += 1.1) for (let z = f[2] + 0.7; z < f[3] - 0.3; z += 1.1) { g.beginPath(); g.arc(SX(x), SZ(z), 3, 0, 7); g.fill(); }
  }
  // dükkan: tenteli bina
  if (G.regions.koy.unlocked) {
    rr(-10.7, 10.7, -13.4, -4, 0.5); g.fillStyle = '#fbefd9'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#c0504d'; g.stroke();
    g.save(); rr(-10.7, 10.7, -13.4, -12.1, 0.4); g.clip();
    for (let x = -10.7, i = 0; x < 10.7; x += 1.1, i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e8604c'; g.fillRect(SX(x), SZ(-13.4), 1.1 * PX, 1.3 * PX); }
    g.restore();
  }
  // engeller: küçükler ağaç gibi yeşil benek, büyükler bina, tezgah, duvar
  for (const c of G.colliders) {
    if (c.dyn && !c.mm) continue; // park eden araç bina gibi çizilmez; yer değiştiren pazar tezgahı (mm) çizilir
    const cw = c[1] - c[0], cd = c[3] - c[2];
    if (c[1] < B.x0 || c[0] > B.x1 || c[3] < B.z0 || c[2] > B.z1) continue;
    if (cw < 1 && cd < 1) { g.fillStyle = '#4f9a45'; g.beginPath(); g.arc(SX((c[0] + c[1]) / 2), SZ((c[2] + c[3]) / 2), 5, 0, 7); g.fill(); continue; }
    if (cw > 18 && cd < 1) continue; // dükkanın arka duvarı zaten çizili
    rr(c[0], c[1], c[2], c[3], 0.25);
    g.fillStyle = cw < 0.8 || cd < 0.8 ? '#8a5a33' : 'rgba(150,105,65,.75)'; g.fill();
  }
}

// ---------- her kare ----------
function label(text, x, y, size, bold = true) {
  ctx.font = `${bold ? 900 : 700} ${Math.round(size * dpr)}px 'Nunito','Segoe UI',sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3.2 * dpr; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y); ctx.fillStyle = '#3b2a6b'; ctx.fillText(text, x, y);
}
// emoji simgeleri bir kez küçük tuvale çizilir, sonra resim olarak basılır: renkli emojiyi her çizimde yeniden yazmak telefonda pahalı
const GLY = new Map();
function icon(ch, px, x, y) {
  const k = ch + '|' + px;
  let c = GLY.get(k);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = Math.ceil(px * 1.6);
    const g = c.getContext('2d'); g.font = `${px}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, c.width / 2, c.height / 2);
    GLY.set(k, c);
  }
  ctx.drawImage(c, x - c.width / 2, y - c.height / 2);
}
function dot(x, z, r, fill, line = '#ffffff', lw = 1.4) {
  ctx.beginPath(); ctx.arc(X(x), Z(z), r * dpr, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw * dpr; ctx.strokeStyle = line; ctx.stroke();
}
// aynı renkteki noktalar (müşteriler, elemanlar) tek yolda çizilir, haritanın dışındakiler atlanır: her nokta için ayrı dolgu ve
// çizgi telefonda mini haritayı oyun karesinin ~%5'ine çıkarıyordu (2026-11-05 denetimi)
function dots(list, r, fill, line, lw) {
  const R = r * dpr, m = R + 2;
  ctx.beginPath();
  for (const o of list) { const x = X(o.obj.position.x), y = Z(o.obj.position.z); if (x < -m || y < -m || x > W + m || y > W + m) continue; ctx.moveTo(x + R, y); ctx.arc(x, y, R, 0, Math.PI * 2); }
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw * dpr; ctx.strokeStyle = line; ctx.stroke();
}
function star(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, q = i % 2 ? r * 0.46 : r; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  ctx.closePath(); ctx.fillStyle = '#ffd23f'; ctx.fill();
  ctx.lineWidth = 1.6 * dpr; ctx.strokeStyle = '#7a4a00'; ctx.stroke();
}

let sizeK = 0, keyK = -1, mapKey = '', wasCity = null;
export function updateMinimap(dt) {
  t -= dt;
  if (t > 0 || !ctx || !G.player) return;
  t = 0.08;
  box.style.visibility = G.world === 'ada' ? 'hidden' : ''; // Martı Adası'nda (tatil.js) köy haritası gösterilmez
  if (G.world === 'ada') return;
  // gizli sekmede ResizeObserver gecikebilir: boy saniyede bir yoklanır (her çizimde okumak sayfa yerleşimini kare ortasında hesaplatıyordu)
  if ((sizeK = (sizeK + 1) % 12) === 0 && Math.round(Math.min(box.clientWidth, box.clientHeight) * dpr) !== W) resize();
  const city = G.world === 'sehir', SR = G.regions.sehir;
  B = city ? B_SEHIR : B_KOY;
  // sabit katmanın imzası yarım saniyede bir (tüm engeller sayılıyor): açılan bölge, kurulan yapı en geç yarım saniyede çizilir
  if ((keyK = (keyK + 1) % 6) === 0 || city !== wasCity) { wasCity = city; mapKey = city ? `sehir|${SR.unlocked ? 1 : 0}|${(SR.shelves || []).length}|${(SR.registers || []).length}`
    : `${Object.values(G.regions).map((R) => (R.unlocked ? 1 : R.hidden ? 2 : 0)).join('')}|${G.stationRevealed ? 1 : 0}|${G.colliders.reduce((n, c) => n + !c.dyn, 0)}|${(G.soft || []).length}|${G.regions.pazar ? G.regions.pazar.rowV : 0}|${(G.annexes || []).length}`; }
  if (mapKey !== bgKey) { bgKey = mapKey; if (city) drawCity(); else drawStatic(); }
  const p = G.player.position;
  if (big) { span = Math.max(B.x1 - B.x0, B.z1 - B.z0); vx0 = (B.x0 + B.x1 - span) / 2; vz0 = (B.z0 + B.z1 - span) / 2; }
  else { span = SMALL_SPAN; vx0 = clamp(p.x - span / 2, B.x0, B.x1 - span); vz0 = clamp(p.z - span / 2, B.z0, B.z1 - span); }
  s = W / span;
  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = city ? '#d8d2c6' : '#4fa9de'; ctx.fillRect(0, 0, W, W); // haritanın dışı: köyde deniz, şehirde kaldırım
  const sx = (vx0 - B.x0) * PX, sz = (vz0 - B.z0) * PX, sw = span * PX;
  ctx.drawImage(bg, sx, sz, sw, sw, 0, 0, W, W);
  // büyük haritada kameranın gördüğü alan
  if (big) {
    const q = [];
    for (const [nx, ny] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ndc.set(nx, ny); ray.setFromCamera(ndc, G.camera); if (ray.ray.intersectPlane(plane, hit)) q.push([X(hit.x), Z(hit.z)]); }
    if (q.length === 4) {
      ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill();
      ctx.setLineDash([6 * dpr, 4 * dpr]); ctx.strokeStyle = 'rgba(59,42,107,.65)'; ctx.lineWidth = 1.6 * dpr; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // bölge simgeleri ve adları (şehirde marketin ve durağın simgesi)
  if (city) {
    ctx.font = `${Math.round((big ? 22 : 17) * dpr)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mx = X(CITY.x), mz = Z(CITY.rect[2] + 3);
    const px = Math.round((big ? 22 : 17) * dpr);
    icon('🏙️', px, mx, mz); if (big) label('Şehir Marketi', mx, mz + 17 * dpr, 11);
    icon('🚌', px, X(CITY.stop[0]), Z(CITY.stop[1]) - 12 * dpr); if (big) label('Köye otobüs', X(CITY.stop[0]), Z(CITY.stop[1]) + 6 * dpr, 10);
  }
  for (const id in REG) {
    const R = G.regions[id];
    if (city || !R || R.hidden) continue;
    const cx = X((R.rect[0] + R.rect[1]) / 2), cy = Z((R.rect[2] + R.rect[3]) / 2) + (id === 'koy' ? 3.5 * s : 0);
    if (cx < -20 * dpr || cy < -20 * dpr || cx > W + 20 * dpr || cy > W + 20 * dpr) continue;
    ctx.globalAlpha = R.unlocked ? 1 : 0.75;
    icon(R.unlocked ? REG[id].icon : '🔒', Math.round((big ? 22 : 17) * dpr), cx, cy);
    if (big && (R.unlocked || R.named !== false)) label(REG[id].short, cx, cy + 17 * dpr, 11); // açılış kilidi gelmeyen bölümün adı yazmaz (world.js nameAreas)
    ctx.globalAlpha = 1;
  }
  // biriken paralar: üstünde ₺ olan altın para
  for (const st of G.stations) {
    if (!(st.amount > 0 && st.bills)) continue;
    dot(st.zone.x, st.zone.z, big ? 4.6 : 5.4, '#ffd23f', '#c97a00', 1.6);
    ctx.font = `900 ${Math.round((big ? 7 : 8) * dpr)}px Arial,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#7a4a00';
    ctx.fillText('₺', X(st.zone.x), Z(st.zone.z) + 0.5 * dpr);
  }
  const big2 = big ? 0.85 : 1;
  dots(G.customers, 2.3 * big2, '#ffffff', 'rgba(59,42,107,.8)', 1.1);
  if (G.thief) dot(G.thief.obj.position.x, G.thief.obj.position.z, (G.thief.loot ? 5 + Math.sin(G.time * 10) : 3.6) * big2, '#e8473c', '#ffffff', 1.6); // hırsız
  dots(G.workers, 3.4 * big2, '#9c6cf0', '#ffffff', 1.5);
  const cvn = G.regions.han && G.regions.han.caravan;
  if (cvn && cvn.state !== 'away') dot(cvn.members[0].position.x, cvn.members[0].position.z, 4 * big2, '#f6a623', '#ffffff', 1.5);
  const car = G.regions.koy.cars && G.regions.koy.cars.car;
  if (car) dot(car.position.x, car.position.z, 3.6 * big2, '#e8604c', '#ffffff', 1.5);
  // sıradaki hedef: parlayan yıldız; küçük haritada görünmüyorsa kenarda yönünü gösteren ok
  const pad = G.nextPad || G.needPad || G.finalPad; // bölge şartının işi (sart.js); son görevde en yakın açık yan kilit (final.js)
  if (pad) {
    const k = 1 + Math.sin(G.time * 5) * 0.15, gx = X(pad.def.at[0]), gy = Z(pad.def.at[1]), m = 12 * dpr;
    if (gx > m && gy > m && gx < W - m && gy < W - m) {
      ctx.beginPath(); ctx.arc(gx, gy, 11 * dpr * k, 0, 7); ctx.fillStyle = 'rgba(255,210,63,.3)'; ctx.fill();
      star(gx, gy, 7.5 * dpr * k);
    } else {
      const px = X(p.x), py = Z(p.z), a = Math.atan2(gy - py, gx - px);
      const ex = clamp(px + Math.cos(a) * W, m, W - m), ey = clamp(py + Math.sin(a) * W, m, W - m);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(9 * dpr, 0); ctx.lineTo(-5 * dpr, -6 * dpr); ctx.lineTo(-5 * dpr, 6 * dpr); ctx.closePath();
      ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 1.6 * dpr; ctx.strokeStyle = '#7a4a00'; ctx.stroke();
      ctx.restore();
      star(ex - Math.cos(a) * 12 * dpr, ey - Math.sin(a) * 12 * dpr, 5.5 * dpr);
    }
  }
  // oyuncu: nabız gibi atan halka ve baktığı yöne dönük ok
  const ry = G.player.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry), L = (big ? 7.5 : 8.5) * dpr;
  const px = X(p.x), py = Z(p.z), pulse = (G.time * 1.4) % 1;
  ctx.beginPath(); ctx.arc(px, py, L * (1 + pulse * 1.3), 0, 7);
  ctx.strokeStyle = `rgba(59,139,235,${0.6 * (1 - pulse)})`; ctx.lineWidth = 2.2 * dpr; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px + fx * L, py + fz * L);
  ctx.lineTo(px - fx * L * 0.65 + fz * L * 0.7, py - fz * L * 0.65 - fx * L * 0.7);
  ctx.lineTo(px - fx * L * 0.25, py - fz * L * 0.25);
  ctx.lineTo(px - fx * L * 0.65 - fz * L * 0.7, py - fz * L * 0.65 + fx * L * 0.7);
  ctx.closePath();
  ctx.fillStyle = '#3b8beb'; ctx.fill();
  ctx.lineWidth = 2.2 * dpr; ctx.strokeStyle = '#ffffff'; ctx.lineJoin = 'round'; ctx.stroke();
  // otomatik koşunun hedefi: yeşil halka (autorun.js G.runGoal)
  const rg = G.runGoal;
  if (rg) {
    ctx.beginPath(); ctx.arc(X(rg.x), Z(rg.z), 6.5 * dpr, 0, 7); ctx.lineWidth = 3 * dpr; ctx.strokeStyle = '#56c27e'; ctx.stroke();
    ctx.beginPath(); ctx.arc(X(rg.x), Z(rg.z), 2.4 * dpr, 0, 7); ctx.fillStyle = '#56c27e'; ctx.fill();
  }
  // büyük haritada üstte ipucu, sağ üstte kapatma düğmesi
  if (big) {
    label('Gitmek istediğin yere dokun', W / 2, 18 * dpr, 12);
    const cxp = W - 22 * dpr, cyp = 22 * dpr;
    ctx.beginPath(); ctx.arc(cxp, cyp, 15 * dpr, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = 'rgba(59,42,107,.35)'; ctx.stroke();
    ctx.font = `900 ${Math.round(14 * dpr)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3b2a6b';
    ctx.fillText('✕', cxp, cyp + 0.5 * dpr);
  }
  // büyük haritada sol altta dikey açıklama kutusu (orası boş çimen, önemli bir şey kapanmaz)
  if (big) {
    const items = [['#ffd23f', 'Hedef', 'star'], ['#ffd23f', 'Para', 'coin'], ['#9c6cf0', 'Eleman'], ['#ffffff', 'Müşteri'], ['#3b8beb', 'Sen']];
    ctx.font = `800 ${Math.round(11 * dpr)}px 'Nunito','Segoe UI',sans-serif`;
    const tw = Math.max(...items.map((i) => ctx.measureText(i[1]).width));
    const row = 17 * dpr, pad = 7 * dpr, bw = pad * 2 + 16 * dpr + tw, bh = pad * 2 + row * items.length;
    const by = W - bh - 8 * dpr;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.roundRect(8 * dpr, by, bw, bh, 10 * dpr); ctx.fill();
    ctx.lineWidth = 1.2 * dpr; ctx.strokeStyle = 'rgba(59,42,107,.25)'; ctx.stroke();
    items.forEach(([c, n, kind], i) => {
      const x = 8 * dpr + pad + 6 * dpr, y = by + pad + row * (i + 0.5);
      if (kind === 'star') star(x, y, 6 * dpr);
      else { ctx.beginPath(); ctx.arc(x, y, 4.8 * dpr, 0, 7); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 1.3 * dpr; ctx.strokeStyle = kind === 'coin' ? '#c97a00' : 'rgba(59,42,107,.8)'; ctx.stroke(); }
      ctx.font = `800 ${Math.round(11 * dpr)}px 'Nunito','Segoe UI',sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3b2a6b';
      ctx.fillText(n, x + 10 * dpr, y + 0.5 * dpr);
    });
  }
}
