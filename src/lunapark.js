// Lunapark (lunapark-plan.md): nehrin ötesinde, kuzeydoğuda; oyunun sonlarına doğru açılan en büyük, en görkemli alan.
// Kilitliyken de uzaktan görünür: çitle çevrili çayırda dev dönme dolabın ışıksız iskeleti, kapalı kapıda "YAKINDA" panosu.
// Giriş kilidi (gl): kapı, gişe, atlıkarınca, gezinti yolu, çeşmeli dinlenme yeri. İçindekiler sırayla açılır (xluna1-6):
// dönme dolap, yiyecek tezgâhları, çarpışan arabalar, oyun çadırları, korsan gemisi, hız treni.
// Ziyaretçi doğudan caddeyle gelir, gişede bilet alır, birkaç eğlenceye biner, tezgâhtan bir şey alır ya da oyun oynar,
// sonra gider. Her eğlencenin bilet kulübesinde para birikir; tezgâhlara koçan ve süt oyuncu ya da taşıyıcıyla gelir.
// Sonraya (plana alındı): çadırlarda oyuncunun oynadığı mini oyunlar, oyuncunun eğlencelere binmesi, gece ışık gösterisi.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from './models.js';
import { G, Converter, Generator, MoneyPile, Customer, Station, ITEMS, floatText, sfx, popIn, rand, pick, mult, lerpAngle } from './game.js';
import { defineExpansion } from './expand.js';
import { confetti } from './fx.js';
import { texRep, textTex, vstripes } from './tex.js';
import { KIND_OF, FROM } from './catalog.js';
import { setupMinigames, updateMinigames } from './minioyun.js';
import * as LS from './lunases.js';

const PI = Math.PI, TAU = PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const LP_RECT = [73, 113, -56, 1.5];
export const LP_WALK = [73.4, 112.6, -55.6, 1.4];
export const LP_ENTRY = [93.6, 0, -1.2];
const APRON = [89.8, 96.2, 0.8, 4.0]; // kapının önünden caddenin kuzey kaldırımına inen taşlık
const FAR = V(158, 0, 4.7), ROADP = V(94.8, 0, 4.7), GATE_OUT = V(93.6, 0, 2.6), GATE_IN = V(93.6, 0, -0.4);
const RED = '#e8473c', CREAM = '#fff4dc', GOLD = '#f2c14e', TEAL = '#2fb5a8', BLUE = '#3d7dd8', PURPLE = '#8a5cd6', PINK = '#ff7eb6', YEL = '#ffd23f', GREEN = '#3fae6b', ORANGE = '#ff8a3d';
const FEE = { bilet: 30, atli: 15, dolap: 25, carpisan: 20, oyun: 12, gemi: 30, tren: 45 };
// gişe kapının batı sütununun hemen arkasındaydı (87,4/-2,4): kasaya sütunla gişe arasındaki dar boğazdan, kuyruğun içinden geçiliyordu
// (2026-11-03 kullanıcı: "lunapark girişinde kasanın olduğu kısımdan giremiyorum"). Kuzeybatıya alındı, kuyruk kapıdan uzağa (batıya) dizilir
const BOOTH = V(86.2, 0, -3.4);
const FOOD_X = 80, FOOD_Z = [-6.2, -11.2, -16.2];
const TENT_X = 102.4, TENT_Z = [-20.0, -24.4, -28.8];

// ---------- yeni ürünler ----------
function makePopcorn() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.28, 12), M.mat('#ffffff', { map: vstripes(RED, '#ffffff', 10) }));
  box.position.y = 0.14; g.add(box);
  const puff = [M.mat('#fff8e1'), M.mat('#ffe7a3')];
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = i ? 0.085 : 0; M.sph(0.056, puff[i % 2], Math.cos(a) * r, 0.3 + (i % 3) * 0.025, Math.sin(a) * r, g, 8, 6); }
  return g;
}
function makeCottonCandy() {
  const g = new THREE.Group();
  M.cyl(0.012, 0.012, 0.36, 5, M.mat('#f4ecd8'), 0, 0.18, 0, g);
  const pink = M.mat('#ff9fd0', { rough: 1 }), pink2 = M.mat('#ffc2e2', { rough: 1 });
  M.ico(0.14, pink, 0, 0.42, 0, g, 1); M.ico(0.09, pink2, 0.08, 0.48, 0.04, g, 1); M.ico(0.08, pink2, -0.07, 0.36, -0.05, g, 1);
  return g;
}
ITEMS.patlamis = { name: 'Patlamış mısır', price: 18, fn: makePopcorn };
ITEMS.pamuk = { name: 'Pamuk şeker', price: 16, fn: makeCottonCandy };
KIND_OF.patlamis = 'islenmis'; KIND_OF.pamuk = 'islenmis';
FROM.patlamis = [['kocan'], 'lunaparkın patlamış mısır tezgâhında'];

// ---------- ortak yardımcılar ----------
const NOOP = () => {};
// hareketli parça: perf.js birleştirmez (dururken birleşip dönünce bozulmasın)
const live = (o) => { o.traverse((m) => { if (m.isMesh) m.onBeforeRender = NOOP; }); return o; };
// oyuncu binince yarı saydamlaşan çatı (atlıkarınca tentesi, çarpışan araba tavanı): üstten bakan kamera binen oyuncuyu görsün.
// Kendi malzemesi olur (M.mat önbellekte paylaşılır), birleştirmeye girmez
const fader = (...ms) => ms.map((m) => { m.material = m.material.clone(); m.material.transparent = true; live(m); return m; });
const fadeTo = (ms, on, dt) => { const k = on ? 0.22 : 1; for (const m of ms) { const o = m.material.opacity; if (Math.abs(o - k) > 0.005) { m.material.opacity = o + (k - o) * (1 - Math.exp(-6 * dt)); m.material.depthWrite = m.material.opacity > 0.95; } } };
// düz renkli alt parçalar köşe rengiyle tek geometride birleşir (dönen eğlencenin çizim sayısı az kalsın); dokulu ve ışıklı parça ayrı
const VCM = new Map();
const vcMat = (r, side) => { const k = `${r}|${side}`; if (!VCM.has(k)) VCM.set(k, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, side })); return VCM.get(k); };
const plainM = (m) => m && !Array.isArray(m) && m.isMeshStandardMaterial && !m.map && !m.transparent && !m.vertexColors && !(m.emissiveIntensity > 0 && m.emissive.getHex());
function solid(g) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), buckets = new Map(), done = [], mtx = new THREE.Matrix4();
  g.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !plainM(o.material) || o.children.length) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.applyMatrix4(mtx.multiplyMatrices(inv, o.matrixWorld));
    const n = geo.attributes.position.count, c = o.material.color, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const key = `${Math.round(o.material.roughness * 5) / 5}|${o.material.side}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(geo); done.push(o);
  });
  if (done.length < 2) return g;
  for (const o of done) o.parent.remove(o);
  for (const [key, geos] of buckets) {
    const [r, side] = key.split('|').map(Number);
    const m = new THREE.Mesh(mergeGeometries(geos), vcMat(r, side));
    m.castShadow = true; m.receiveShadow = true; g.add(m);
  }
  return g;
}
const UP = V(0, 1, 0);
function beam(a, b, r, m, parent, seg = 8) {
  const d = b.clone().sub(a), len = d.length();
  const c = M.cyl(r, r, len, seg, m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
  c.quaternion.setFromUnitVectors(UP, d.normalize());
  return c;
}
function board(w, h, tex, x, y, z, parent, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; parent.add(m);
  return m;
}
const sign = (text, bg, w, h, o = {}) => textTex(text, { w: 1024, h: Math.max(96, Math.round((1024 * h) / w)), bg, fg: '#fff8e6', border: GOLD, ...o });
const wrap = (a) => ((((a + PI) % TAU) + TAU) % TAU) - PI;

// ampuller: iki takım sırayla yanıp söner (koşan ışık). Örneklenmiş tek çizim (perf.js dokunmaz)
const BULB_GEO = new THREE.SphereGeometry(0.075, 8, 6);
const lampMat = (c) => new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: c, emissiveIntensity: 1.2, roughness: 0.4 });
const SETS = [];
const bulbSet = (c) => { const s = [lampMat(c), lampMat(c)]; SETS.push(s); return s; };
const BULB = bulbSet('#ffc23a');
const RAINBOW = ['#ff4f6d', '#ffc23a', '#4fd1ff', '#7dff5a', '#c77dff'].map(bulbSet);
function bulbs(parent, pts, set = BULB) {
  for (let k = 0; k < 2; k++) {
    const sel = pts.filter((_, i) => i % 2 === k);
    if (!sel.length) continue;
    const im = new THREE.InstancedMesh(BULB_GEO, set[k], sel.length), m4 = new THREE.Matrix4();
    sel.forEach((p, i) => im.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    parent.add(im);
  }
}
const bulbsRainbow = (parent, pts) => RAINBOW.forEach((s, k) => bulbs(parent, pts.filter((_, i) => i % RAINBOW.length === k), s));
const ring = (r, y, n, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * TAU; return V(Math.sin(a) * r, y, Math.cos(a) * r); });
const line = (a, b, n) => Array.from({ length: n }, (_, i) => a.clone().lerp(b, n > 1 ? i / (n - 1) : 0.5));

// flama: direğe bağlı üçgen bayrak, rüzgârda sallanır (R.flags)
let PENNANT = null;
function pennant(col, s = 1) {
  if (!PENNANT) { PENNANT = new THREE.BufferGeometry(); PENNANT.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.5, 0, 0.9, -0.25, 0], 3)); PENNANT.computeVertexNormals(); }
  const m = new THREE.Mesh(PENNANT, M.mat(col, { side: THREE.DoubleSide }));
  m.scale.setScalar(s); m.userData.ph = Math.random() * TAU;
  return m;
}
function flagPole(parent, x, y, z, col, h = 1.1, flags) {
  M.cyl(0.03, 0.03, h, 6, M.mat('#d9dde2', { rough: 0.3 }), x, y + h / 2, z, parent);
  M.sph(0.06, M.mat(GOLD, { rough: 0.3 }), x, y + h + 0.04, z, parent, 8, 6);
  const f = pennant(col, 0.9); f.position.set(x, y + h - 0.02, z); parent.add(f); flags.push(f);
  return f;
}

// korsan bayrağı: siyah zeminde kafatası ve çapraz kemik
function skullTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#16161a'; g.fillRect(0, 0, 128, 96);
  g.strokeStyle = '#f4f1e8'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(34, 76); g.lineTo(94, 26); g.moveTo(34, 26); g.lineTo(94, 76); g.stroke();
  g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(64, 42, 20, 0, TAU); g.fill(); g.fillRect(53, 50, 22, 16);
  g.fillStyle = '#16161a'; g.beginPath(); g.arc(56, 42, 5.5, 0, TAU); g.moveTo(77.5, 42); g.arc(72, 42, 5.5, 0, TAU); g.fill();
  for (const x of [57, 63, 69]) g.fillRect(x, 58, 3, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- modeller ----------
// bilet kulübesi: önü açık tezgâh, çizgili sivri çatı, üstünde eğlencenin adı (ön yüz +z)
// eğlence operatörünün kumanda kürsüsü (2026-11-02, eğlencelerin bilet kulübelerinin yerine): krem gövde, renkli şeritler, operatöre
// eğik tuş paneli (yeşil başlat, kırmızı dur düğmesi, kol), yanda direk ve üstünde durum lambası (rengini Ride.op değiştirir)
function makeConsole(col) {
  const g = new THREE.Group(), trim = M.mat(col), dark = M.mat('#2b2f3a');
  M.rbox(0.72, 0.92, 0.44, 0.04, M.mat(CREAM), 0, 0.46, 0, g);
  M.rbox(0.76, 0.16, 0.48, 0.03, trim, 0, 0.08, 0, g);
  M.rbox(0.76, 0.08, 0.48, 0.02, trim, 0, 0.9, 0, g);
  const panel = new THREE.Group(); panel.position.set(0, 0.97, 0); panel.rotation.x = -0.35; g.add(panel);
  M.rbox(0.66, 0.05, 0.4, 0.015, dark, 0, 0, 0, panel);
  M.sph(0.05, M.mat('#3ad65b', { rough: 0.3 }), -0.2, 0.04, 0.02, panel, 10, 8);
  M.sph(0.05, M.mat(RED, { rough: 0.3 }), -0.04, 0.04, 0.02, panel, 10, 8);
  M.rbox(0.03, 0.18, 0.03, 0.01, M.mat('#c9ced6', { rough: 0.3 }), 0.18, 0.1, 0, panel);
  M.sph(0.045, M.mat(YEL, { rough: 0.3 }), 0.18, 0.2, 0, panel, 10, 8);
  M.rbox(0.05, 2.0, 0.05, 0.015, dark, 0.44, 1.0, 0.12, g);
  const lamp = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: RED, emissiveIntensity: 1.4, roughness: 0.4 });
  live(M.sph(0.11, lamp, 0.44, 2.08, 0.12, g, 12, 10));
  return { g, lamp };
}
// gişe: kubbeli, kırmızı-beyaz çizgili bilet kulübesi; penceresi güneye bakar
function makeTicketBooth(flags) {
  const g = new THREE.Group(), wall = M.mat(CREAM), red = M.mat(RED), gold = M.mat(GOLD, { rough: 0.3 }), wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
  M.rbox(2.6, 2.3, 0.12, 0.03, wall, 0, 1.15, -1.0, g);
  for (const sx of [-1, 1]) M.rbox(0.12, 2.3, 2.0, 0.03, wall, sx * 1.24, 1.15, 0, g);
  M.rbox(2.6, 1.0, 0.12, 0.03, red, 0, 0.5, 1.0, g);
  M.rbox(2.6, 0.5, 0.12, 0.03, red, 0, 2.05, 1.0, g);
  for (const sx of [-1, 1]) M.rbox(0.5, 0.82, 0.12, 0.03, wall, sx * 1.05, 1.41, 1.0, g);
  M.rbox(1.9, 0.07, 0.5, 0.02, wood, 0, 1.03, 1.2, g);
  for (const [x, z] of [[-1.3, -1.05], [1.3, -1.05], [-1.3, 1.05], [1.3, 1.05]]) M.rbox(0.18, 2.4, 0.18, 0.04, red, x, 1.2, z, g);
  M.rbox(2.9, 0.16, 2.3, 0.04, gold, 0, 2.34, 0, g);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.45, 24, 10, 0, TAU, 0, PI / 2), M.mat('#ffffff', { map: vstripes(RED, CREAM, 16) }));
  dome.scale.y = 0.75; dome.position.y = 2.42; dome.castShadow = true; g.add(dome);
  flagPole(g, 0, 3.45, 0, YEL, 1.0, flags);
  board(1.7, 0.42, sign('GİŞE', BLUE, 1.7, 0.42), 0, 2.05, 1.07, g);
  bulbs(g, ring(1.47, 2.42, 26));
  return g;
}
// giriş kapısı: iki çizgili kule, soğan kubbeler, ışıklı kemer ve büyük LUNAPARK tabelası (ön yüz +z)
function makeGate(flags) {
  const g = new THREE.Group(), white = M.mat(CREAM), gold = M.mat(GOLD, { rough: 0.3 }), teal = M.mat(TEAL), red = M.mat(RED);
  const col = M.mat('#ffffff', { map: vstripes(RED, CREAM, 12) });
  for (const sx of [-1, 1]) {
    const x = sx * 3.6;
    M.rbox(1.7, 0.55, 1.7, 0.08, white, x, 0.27, 0, g);
    M.cyl(0.62, 0.7, 5.2, 18, col, x, 2.95, 0, g);
    for (const y of [0.6, 3.0, 5.5]) M.cyl(0.8, 0.8, 0.18, 18, gold, x, y, 0, g);
    const dome = M.sph(0.86, teal, x, 6.25, 0, g, 18, 12); dome.scale.y = 1.25;
    M.cyl(0, 0.1, 0.9, 8, gold, x, 7.75, 0, g);
    flagPole(g, x, 8.1, 0, sx < 0 ? RED : YEL, 1.0, flags);
    bulbs(g, [0, 1, 2, 3, 4, 5, 6].flatMap((k) => ring(0.74, 1.0 + k * 0.62, 6, k * 0.5)).map((p) => p.add(V(x, 0, 0))));
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.2, 10, 40, PI), gold);
  arch.position.set(0, 5.0, 0); arch.castShadow = true; g.add(arch);
  const arch2 = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.1, 8, 40, PI), red);
  arch2.position.set(0, 5.0, 0.05); g.add(arch2);
  bulbs(g, Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * PI; return V(Math.cos(a) * 2.9, 5.0 + Math.sin(a) * 2.9, 0.24); }));
  M.rbox(5.6, 1.4, 0.28, 0.08, red, 0, 6.3, 0.35, g);
  board(5.3, 1.15, sign('LUNAPARK', RED, 5.3, 1.15, { fg: '#fff6c8' }), 0, 6.3, 0.5, g);
  bulbs(g, [...line(V(-2.75, 7.05, 0.52), V(2.75, 7.05, 0.52), 16), ...line(V(-2.75, 5.55, 0.52), V(2.75, 5.55, 0.52), 16)]);
  for (const sx of [-1, 1]) { const s = M.sph(0.22, gold, sx * 2.0, 7.3, 0.35, g, 10, 8); s.scale.set(1, 1, 0.5); }
  M.sph(0.3, gold, 0, 8.15, 0, g, 12, 10);
  // açık duran demir kanatlar
  const iron = M.mat('#2d3340', { rough: 0.5 });
  for (const sx of [-1, 1]) {
    const leaf = new THREE.Group(); leaf.position.set(sx * 2.85, 0, -0.1); leaf.rotation.y = sx * 1.35;
    for (let k = 0; k < 7; k++) M.cyl(0.025, 0.025, 2.0, 5, iron, -sx * (0.15 + k * 0.18), 1.0, 0, leaf);
    for (const y of [0.25, 1.1, 1.95]) M.rbox(1.3, 0.05, 0.05, 0.01, iron, -sx * 0.69, y, 0, leaf);
    g.add(leaf);
  }
  return g;
}
// lunaparkın çiti: beyaz direkler, kırmızı başlıklar, altın korkuluk (örneklenmiş)
function makeFence(segs) {
  const g = new THREE.Group(), posts = [], white = M.mat('#fbf7ef'), gold = M.mat(GOLD, { rough: 0.35 });
  for (const [ax, az, bx, bz] of segs) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.4));
    for (let i = 0; i <= n; i++) posts.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
    for (const y of [0.45, 1.05]) { const r = M.rbox(L, 0.07, 0.07, 0.02, gold, (ax + bx) / 2, y, (az + bz) / 2, g); r.rotation.y = -Math.atan2(bz - az, bx - ax); }
  }
  const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.08, 1.3, 8), white, posts.length);
  const cm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), M.mat(RED), posts.length);
  const m4 = new THREE.Matrix4();
  posts.forEach(([x, z], i) => { pm.setMatrixAt(i, m4.makeTranslation(x, 0.65, z)); cm.setMatrixAt(i, m4.makeTranslation(x, 1.36, z)); });
  for (const m of [pm, cm]) { m.castShadow = true; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); g.add(m); }
  return g;
}
// atlıkarınca atı: dörtnala, eyerli (ön yüz +z); tek geometriye birleşir
function makeHorse(col, mane, saddle) {
  const g = new THREE.Group(), body = M.mat(col), dark = M.mat(mane), gold = M.mat(GOLD, { rough: 0.3 });
  const b = M.caps(0.2, 0.5, body, 0, 0, 0, g); b.rotation.x = PI / 2;
  const neck = M.caps(0.11, 0.3, body, 0, 0.22, 0.34, g); neck.rotation.x = 0.55;
  const head = M.rbox(0.17, 0.2, 0.36, 0.06, body, 0, 0.42, 0.55, g); head.rotation.x = 0.5;
  M.rbox(0.05, 0.24, 0.32, 0.02, dark, 0, 0.36, 0.28, g).rotation.x = 0.55;
  for (const sx of [-1, 1]) {
    M.sph(0.032, M.mat('#222222'), sx * 0.085, 0.47, 0.6, g, 6, 5);
    M.cyl(0, 0.04, 0.1, 5, body, sx * 0.05, 0.58, 0.47, g);
    const fl = M.caps(0.05, 0.3, body, sx * 0.1, -0.2, 0.32, g); fl.rotation.x = -0.9;
    const bl = M.caps(0.05, 0.34, body, sx * 0.1, -0.33, -0.27, g); bl.rotation.x = 0.35;
    M.cyl(0.06, 0.06, 0.05, 8, gold, sx * 0.1, -0.53, -0.33, g);
  }
  const tail = M.cyl(0.02, 0.08, 0.38, 6, dark, 0, 0.04, -0.44, g); tail.rotation.x = -0.8;
  M.rbox(0.32, 0.06, 0.34, 0.03, M.mat(saddle), 0, 0.21, -0.02, g);
  M.rbox(0.34, 0.03, 0.04, 0.01, gold, 0, 0.18, 0.17, g);
  return g;
}
function makeCarousel(flags) {
  const g = new THREE.Group(), gold = M.mat(GOLD, { rough: 0.3 }), red = M.mat(RED), cream = M.mat(CREAM);
  M.cyl(4.85, 4.95, 0.22, 40, M.mat('#e9dcc4'), 0, 0.11, 0, g);
  M.cyl(5.1, 5.15, 0.1, 40, M.mat('#cdbfa6'), 0, 0.05, 0, g);
  const rotor = new THREE.Group(); rotor.position.y = 0.22; g.add(rotor);
  const frame = new THREE.Group(); rotor.add(frame);
  M.cyl(4.6, 4.6, 0.16, 40, M.mat('#f6e7c8'), 0, 0.08, 0, frame);
  M.cyl(4.66, 4.66, 0.1, 40, red, 0, 0.05, 0, frame);
  M.cyl(0.6, 0.6, 3.3, 16, gold, 0, 1.81, 0, frame);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, p = M.rbox(0.32, 1.4, 0.05, 0.02, cream, Math.sin(a) * 0.62, 1.9, Math.cos(a) * 0.62, frame); p.rotation.y = a; }
  M.cyl(0.85, 0.7, 0.4, 16, red, 0, 3.3, 0, frame);
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(4.85, 32), M.mat('#fff1d0', { side: THREE.DoubleSide })); ceil.rotation.x = PI / 2; ceil.position.y = 3.46; rotor.add(ceil); // birleşmez: oyuncu binince saydamlaşır
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU, v = new THREE.Mesh(new THREE.CircleGeometry(0.3, 10, 0, PI), M.mat(i % 2 ? GOLD : RED, { side: THREE.DoubleSide }));
    v.position.set(Math.sin(a) * 4.9, 3.46, Math.cos(a) * 4.9); v.rotation.set(0, a, PI); frame.add(v);
  }
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(4.95, 1.6, 32, 1, true), M.mat('#ffffff', { map: vstripes(RED, CREAM, 16), side: THREE.DoubleSide }));
  canopy.position.y = 4.26; canopy.castShadow = true; rotor.add(canopy);
  M.cyl(0.45, 0.55, 0.5, 12, cream, 0, 5.2, 0, rotor);
  const cup = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.8, 12), M.mat('#ffffff', { map: vstripes(TEAL, CREAM, 8) })); cup.position.y = 5.85; rotor.add(cup);
  flagPole(rotor, 0, 6.2, 0, RED, 0.9, flags);
  bulbs(rotor, ring(4.92, 3.36, 44));
  bulbs(rotor, ring(0.88, 3.52, 12), RAINBOW[2]);
  // 14 at: dışta 8, içte 6; direkleri tavana kadar, atlar direk boyunca iner çıkar
  const horses = [], seats = [], cols = [['#fbf7ef', '#c88a3a', RED], ['#f6c7d8', '#8a5cd6', BLUE], ['#cfe6ff', '#3d7dd8', GOLD], ['#f5deb3', '#6b3d22', GREEN], ['#e9e3ff', '#d14f8a', ORANGE]];
  for (const [r, n, a0] of [[3.35, 8, 0], [2.15, 6, 0.4]]) {
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU, x = Math.sin(a) * r, z = Math.cos(a) * r, head = Math.atan2(Math.cos(a), -Math.sin(a));
      const [c, m, s] = cols[(horses.length * 3) % cols.length];
      const h = makeHorse(c, m, s); h.scale.setScalar(1.3);
      h.position.set(x, 1.0, z); h.rotation.y = head;
      const seat = new THREE.Object3D(); seat.position.set(0, -0.2, -0.04); h.add(seat);
      solid(h); rotor.add(h);
      M.cyl(0.035, 0.035, 3.3, 6, gold, x + Math.sin(head) * 0.22, 1.79, z + Math.cos(head) * 0.22, frame);
      horses.push({ g: h, y0: 1.0, ph: i * 1.3 + r }); seats.push(seat);
    }
  }
  solid(frame);
  live(rotor);
  return { g, rotor, horses, seats, fade: fader(ceil, canopy) };
}
// dönme dolap: iki A ayağı, 7 m yarıçaplı çift jant, 20 kollu; kabinler sonra takılır (kilitliyken iskelet görünür)
const WH = 10, WR = 7, GONDOLAS = 10;
function makeWheel() {
  const g = new THREE.Group(), white = M.mat('#f4f6f8', { rough: 0.4 }), steel = M.mat('#c9cfd6', { rough: 0.35 }), red = M.mat(RED);
  M.rbox(9.6, 0.4, 4.4, 0.08, M.mat('#e9dcc4'), 0, 0.2, 0, g);
  M.rbox(3.2, 0.12, 1.0, 0.03, M.mat('#d8c9ad'), 0, 0.06, 2.6, g);
  for (const z of [-1.6, 1.6]) {
    beam(V(-4.4, 0.4, z), V(0, WH, z * 0.6), 0.18, white, g, 10);
    beam(V(4.4, 0.4, z), V(0, WH, z * 0.6), 0.18, white, g, 10);
    beam(V(-2.2, 5.2, z * 0.8), V(2.2, 5.2, z * 0.8), 0.09, white, g);
    beam(V(-1.1, 7.6, z * 0.7), V(1.1, 7.6, z * 0.7), 0.07, white, g);
  }
  const ax = M.cyl(0.24, 0.24, 2.4, 14, steel, 0, WH, 0, g); ax.rotation.x = PI / 2;
  solid(g);
  const rotor = new THREE.Group(); rotor.position.y = WH; g.add(rotor);
  const frame = new THREE.Group(); rotor.add(frame);
  for (const z of [-0.62, 0.62]) {
    for (const [r, t] of [[WR, 0.1], [WR * 0.55, 0.07]]) { const tor = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 72), white); tor.position.z = z; frame.add(tor); }
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; beam(V(0, 0, z * 0.45), V(Math.cos(a) * WR, Math.sin(a) * WR, z), 0.045, white, frame, 5); }
  }
  for (let i = 0; i < GONDOLAS; i++) { const a = (i / GONDOLAS) * TAU, c = M.cyl(0.05, 0.05, 1.5, 6, steel, Math.cos(a) * WR, Math.sin(a) * WR, 0, frame); c.rotation.x = PI / 2; }
  const hub = M.cyl(0.9, 0.9, 1.5, 20, red, 0, 0, 0, frame); hub.rotation.x = PI / 2;
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = PI / 2 + (i / 10) * TAU, r = i % 2 ? 0.32 : 0.75; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  for (const z of [0.77, -0.77]) { const s = new THREE.Mesh(new THREE.ShapeGeometry(star), M.mat(GOLD, { rough: 0.3, side: THREE.DoubleSide })); s.position.z = z; frame.add(s); }
  solid(frame);
  live(rotor);
  return { g, rotor, gondolas: [], seats: [] };
}
// kabin: tepede askı, sivri çatı, dört direk, oturak çanağı; dört kişi ayakta (iki öne, iki arkaya bakar)
function makeGondola(col) {
  const g = new THREE.Group(), c = M.mat(col), white = M.mat('#fdfdfd'), steel = M.mat('#c9cfd6', { rough: 0.35 });
  M.cyl(0.04, 0.04, 0.42, 6, steel, 0, -0.21, 0, g);
  const roof = M.cyl(0.08, 0.82, 0.36, 12, c, 0, -0.58, 0, g); roof.castShadow = true;
  M.cyl(0.84, 0.84, 0.05, 12, white, 0, -0.78, 0, g);
  for (let i = 0; i < 4; i++) { const a = PI / 4 + (i / 4) * TAU; M.cyl(0.03, 0.03, 0.84, 5, steel, Math.cos(a) * 0.68, -1.2, Math.sin(a) * 0.68, g); }
  M.cyl(0.78, 0.7, 0.9, 14, c, 0, -2.07, 0, g);
  M.cyl(0.8, 0.8, 0.06, 14, white, 0, -1.62, 0, g);
  const seats = [];
  for (const sz of [1, -1]) for (const sx of [-1, 1]) { const s = new THREE.Object3D(); s.position.set(sx * 0.27, -2.48, sz * 0.24); s.rotation.y = sz > 0 ? 0 : PI; g.add(s); seats.push(s); }
  solid(g); live(g);
  return { g, seats };
}
// çarpışan araba: kauçuk halka, parlak gövde, direk tavandaki ızgaraya değer (ön yüz +z)
function makeBumperCar(col) {
  const g = new THREE.Group(), c = M.mat(col), black = M.mat('#22252b', { rough: 0.6 }), steel = M.mat('#c9cfd6', { rough: 0.35 }), cream = M.mat(CREAM);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.12, 8, 20), black); rim.rotation.x = PI / 2; rim.scale.set(1, 1.35, 1); rim.position.y = 0.2; g.add(rim);
  M.rbox(1.05, 0.38, 1.5, 0.16, c, 0, 0.35, 0, g);
  M.rbox(0.86, 0.5, 0.14, 0.06, c, 0, 0.72, -0.52, g);
  M.rbox(0.6, 0.1, 0.4, 0.04, cream, 0, 0.56, 0.42, g);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14), black); sw.position.set(0, 0.78, 0.3); sw.rotation.x = -0.9; g.add(sw);
  M.cyl(0.02, 0.02, 0.3, 5, black, 0, 0.66, 0.36, g).rotation.x = -0.6;
  M.cyl(0.025, 0.025, 2.95, 6, steel, 0, 2.0, -0.64, g);
  M.rbox(0.18, 0.06, 0.18, 0.02, steel, 0, 3.46, -0.64, g);
  for (const sx of [-1, 1]) M.sph(0.06, M.mat('#fff4b0'), sx * 0.32, 0.42, 0.75, g, 8, 6);
  const seat = new THREE.Object3D(); seat.position.set(0, 0.16, -0.14); g.add(seat);
  solid(g); live(g);
  return { g, seat };
}
function makeRink(flags) {
  const g = new THREE.Group(), W = 11.2, D = 8.4, white = M.mat('#fbf7ef'), rub = M.mat('#ffb02e', { rough: 0.6 });
  M.rbox(W + 0.4, 0.16, D + 0.4, 0.04, M.mat('#8d97a3', { rough: 0.3 }), 0, 0.08, 0, g);
  M.rbox(W + 0.4, 0.42, 0.28, 0.1, rub, 0, 0.37, -D / 2, g);
  M.rbox(W + 0.4, 0.42, 0.28, 0.1, rub, 0, 0.37, D / 2, g);
  M.rbox(0.28, 0.42, D, 0.1, rub, -W / 2, 0.37, 0, g);
  for (const s of [-1, 1]) M.rbox(0.28, 0.42, D / 2 - 0.9, 0.1, rub, W / 2, 0.37, s * (D / 4 + 0.45), g); // doğuda giriş aralığı
  for (const x of [-W / 2, 0, W / 2]) for (const z of [-D / 2, D / 2]) M.cyl(0.13, 0.15, 3.6, 10, white, x, 1.8, z, g);
  const lid = M.rbox(W + 1.0, 0.26, D + 1.0, 0.06, M.mat('#3d62b3'), 0, 3.73, 0, g);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.8, D + 0.8), M.mat('#ffffff', { map: vstripes(BLUE, '#f4f6fb', 14) })); top.rotation.x = -PI / 2; top.position.y = 3.87; g.add(top);
  g.userData.fade = fader(lid, top);
  const st = vstripes(RED, GOLD, 24);
  for (const [w, x, z, ry] of [[W + 1.0, 0, D / 2 + 0.51, 0], [W + 1.0, 0, -D / 2 - 0.51, PI], [D + 1.0, W / 2 + 0.51, 0, PI / 2], [D + 1.0, -W / 2 - 0.51, 0, -PI / 2]]) board(w, 0.62, st, x, 3.72, z, g, ry);
  board(5.4, 0.95, sign('ÇARPIŞAN ARABALAR', BLUE, 5.4, 0.95), W / 2 + 0.56, 4.55, 0, g, PI / 2);
  M.rbox(0.12, 1.0, 5.6, 0.03, M.mat('#3a3f4a'), W / 2 + 0.46, 4.4, 0, g);
  board(5.4, 0.95, sign('ÇARPIŞAN ARABALAR', BLUE, 5.4, 0.95), 0, 4.55, D / 2 + 0.56, g, 0);
  M.rbox(5.6, 1.0, 0.12, 0.03, M.mat('#3a3f4a'), 0, 4.4, D / 2 + 0.46, g);
  const per = [];
  for (const [a, b, n] of [[V(-W / 2 - 0.5, 3.38, D / 2 + 0.55), V(W / 2 + 0.5, 3.38, D / 2 + 0.55), 26], [V(W / 2 + 0.55, 3.38, D / 2 + 0.5), V(W / 2 + 0.55, 3.38, -D / 2 - 0.5), 20]]) per.push(...line(a, b, n));
  bulbs(g, per);
  for (const x of [-W / 2, W / 2]) flagPole(g, x, 3.86, D / 2 + 0.3, x < 0 ? YEL : RED, 1.0, flags);
  return g;
}
function makeTeddy(col) {
  const g = new THREE.Group(), c = M.mat(col), d = M.mat('#2a2a2a');
  M.sph(0.16, c, 0, 0.16, 0, g, 10, 8); M.sph(0.12, c, 0, 0.38, 0, g, 10, 8);
  for (const s of [-1, 1]) { M.sph(0.05, c, s * 0.09, 0.48, 0, g, 8, 6); M.sph(0.055, c, s * 0.14, 0.2, 0.06, g, 8, 6); M.sph(0.016, d, s * 0.045, 0.41, 0.105, g, 6, 4); }
  M.sph(0.045, M.mat('#fff3e0'), 0, 0.36, 0.1, g, 8, 6); M.sph(0.018, d, 0, 0.375, 0.145, g, 6, 4);
  return g;
}
// oyun çadırı: çizgili bez duvarlar, piramit çatı, önde tezgâh ve tabela; arkada oyuna göre hedefler (ön yüz +z)
function makeTent(col, label, kind, flags, anims) {
  const g = new THREE.Group(), W = 3.8, D = 3.4, canvas = M.mat('#ffffff', { map: vstripes(col, '#fff6e6', 10) });
  M.rbox(W, 2.3, 0.08, 0.02, canvas, 0, 1.15, -D / 2, g);
  for (const sx of [-1, 1]) M.rbox(0.08, 2.3, D, 0.02, canvas, sx * W / 2, 1.15, 0, g);
  M.rbox(W - 0.2, 1.0, 0.5, 0.04, M.mat(col), 0, 0.5, D / 2 - 0.25, g);
  M.rbox(W, 0.06, 0.62, 0.02, M.mat('#ffffff', { map: texRep('wood', 0.8, 0.3) }), 0, 1.02, D / 2 - 0.25, g);
  const rg = new THREE.ConeGeometry(Math.SQRT1_2, 1.5, 4, 1); rg.rotateY(PI / 4);
  const roof = new THREE.Mesh(rg, M.mat('#ffffff', { map: vstripes(col, '#fff6e6', 8) })); roof.scale.set(W + 0.5, 1, D + 0.5); roof.position.y = 3.05; roof.castShadow = true; g.add(roof);
  flagPole(g, 0, 3.8, 0, col === RED ? YEL : RED, 0.9, flags);
  const front = new THREE.Group(); g.add(front); // tabela, saçak ve ampuller: mini oyunda kamera önden bakarken gizlenir (minioyun.js)
  for (let i = 0; i < 9; i++) { const v = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8, 0, PI), M.mat(i % 2 ? GOLD : col, { side: THREE.DoubleSide })); v.position.set(-W / 2 + 0.21 + i * 0.42, 2.3, D / 2 + 0.26); v.rotation.z = PI; front.add(v); }
  board(W - 0.5, 0.38, sign(label, col, W - 0.5, 0.38), 0, 1.98, D / 2 + 0.03, front);
  bulbs(front, line(V(-W / 2 - 0.2, 2.34, D / 2 + 0.3), V(W / 2 + 0.2, 2.34, D / 2 + 0.3), 12));
  // yan duvarlarda asılı ödül ayıcıklar
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const t = makeTeddy([PINK, BLUE, YEL, GREEN][(k + (sx > 0 ? 1 : 0)) % 4]); t.position.set(sx * (W / 2 - 0.24), 1.15 + (k % 2) * 0.45, -0.9 + k * 0.7); t.rotation.y = -sx * PI / 2; g.add(t); }
  const back = new THREE.Group(); back.position.z = -D / 2 + 0.15; g.add(back);
  let play = NOOP;
  const api = { kind, front, back, roof };
  if (kind === 'atis') {
    // atış poligonu: raylı ördekler soldan sağa kayar, vurulan ördek devrilip kalkar; üstte nişan tahtaları
    M.rbox(W - 0.4, 0.08, 0.2, 0.02, M.mat('#6b4a2e'), 0, 1.25, 0.1, back);
    const ducks = [];
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Group(), y = M.mat(YEL), o = M.mat(ORANGE);
      M.sph(0.13, y, 0, 0.13, 0, d, 10, 8).scale.set(1.2, 0.9, 0.8); M.sph(0.085, y, 0.1, 0.27, 0, d, 8, 6); M.cyl(0, 0.04, 0.09, 6, o, 0.2, 0.26, 0, d).rotation.z = -PI / 2;
      d.position.set(-1.5 + i * 0.6, 1.3, 0.12); back.add(d); ducks.push({ g: d, flip: 0 });
    }
    for (let i = 0; i < 5; i++) for (const [r, c] of [[0.2, RED], [0.13, '#ffffff'], [0.06, RED]]) { const t = M.cyl(r, r, 0.03, 16, M.mat(c), -1.36 + i * 0.68, 1.85, 0.02 + (0.2 - r) * 0.2, back); t.rotation.x = PI / 2; }
    anims.push((dt, t) => { for (const [i, d] of ducks.entries()) { d.g.position.x = -1.6 + (((t * 0.5 + i * 0.6) % 3.2) + 3.2) % 3.2; if (d.flip > 0) d.flip -= dt; d.g.rotation.x = d.flip > 0 ? -PI / 2 * Math.min(1, d.flip * 3) : 0; } });
    play = () => { const d = pick(ducks); d.flip = 0.9; };
    api.ducks = ducks;
  } else if (kind === 'halka') {
    // halka atma: basamaklı rafta şişeler; atılan halka bir şişenin boynuna geçer, altı halkada toplanır
    const shelf = M.mat('#7a4a2a'), cols = ['#2e8b57', '#8b5a2b', '#3d7dd8', '#c0392b'], necks = [];
    for (let r = 0; r < 3; r++) {
      M.rbox(W - 0.6, 0.06, 0.32, 0.02, shelf, 0, 0.9 + r * 0.42, 0.1 + r * 0.0, back);
      for (let i = 0; i < 6 - r; i++) { const x = -1.1 + i * 0.44 + r * 0.22, y = 0.93 + r * 0.42; M.cyl(0.07, 0.07, 0.22, 10, M.mat(cols[(i + r) % 4], { rough: 0.25 }), x, y + 0.11, 0.1, back); M.cyl(0.025, 0.04, 0.12, 8, M.mat(cols[(i + r) % 4], { rough: 0.25 }), x, y + 0.28, 0.1, back); necks.push(Object.assign(V(x, y + 0.27, 0.1), { row: r })); }
    }
    const rings = [];
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 14), M.mat([RED, YEL, BLUE][i % 3])); r.rotation.x = PI / 2; r.visible = false; back.add(r); rings.push(r); }
    let k = 0;
    const ringAt = (v) => { if (k >= rings.length) { for (const r of rings) r.visible = false; k = 0; } const r = rings[k++]; r.position.copy(v); r.visible = true; };
    play = () => ringAt(pick(necks));
    Object.assign(api, { necks, ringAt, clear: () => { for (const r of rings) r.visible = false; k = 0; } });
  } else {
    // balon patlatma: arka tahtada renkli balonlar; patlayan balon birkaç saniyede yeniden şişer
    M.rbox(W - 0.4, 1.5, 0.06, 0.02, M.mat('#2c3e66'), 0, 1.75, 0, back);
    const balloons = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) { const b = M.sph(0.15, M.mat([RED, YEL, BLUE, GREEN, PINK, PURPLE][(i + r * 2) % 6], { rough: 0.3 }), -1.3 + i * 0.52, 1.25 + r * 0.48, 0.15, back, 10, 8); b.scale.set(1, 1.15, 0.8); balloons.push({ m: b, t: 0, base: b.position.clone() }); }
    anims.push((dt) => { for (const b of balloons) if (b.t > 0) { b.t -= dt; const s = b.t > 3.6 ? 0.01 : Math.min(1, (3.6 - b.t) / 0.6 + 0.01); b.m.scale.set(s, s * 1.15, s * 0.8); } });
    play = () => { const b = balloons.find((x) => x.t <= 0 && Math.random() < 0.35) || balloons.find((x) => x.t <= 0); if (b) b.t = 4.2; };
    api.balloons = balloons;
  }
  return { g, play, api };
}
// çekiç gücü: tokmağın vurduğu tablaya basınca pul direk boyunca fırlar, en tepeye çıkarsa zil çalar (ön yüz +z)
function makeStriker(anims) {
  const g = new THREE.Group(), red = M.mat(RED), wood = M.mat('#ffffff', { map: texRep('wood', 0.5, 0.5) });
  M.rbox(1.6, 0.25, 1.4, 0.05, wood, 0, 0.12, 0, g);
  M.rbox(0.5, 0.18, 0.5, 0.05, red, 0, 0.32, 0.35, g);
  const scale = document.createElement('canvas'); scale.width = 32; scale.height = 256;
  const sg = scale.getContext('2d'), cols = ['#3fae6b', '#9ccc3c', '#ffd23f', '#ff8a3d', '#e8473c', '#8a5cd6'];
  cols.forEach((c, i) => { sg.fillStyle = c; sg.fillRect(0, 256 - (i + 1) * 42.6, 32, 42.6); });
  const st = new THREE.CanvasTexture(scale); st.colorSpace = THREE.SRGBColorSpace;
  M.rbox(0.36, 5.4, 0.2, 0.04, M.mat('#ffffff', { map: st }), 0, 2.95, -0.25, g);
  M.cyl(0.02, 0.02, 5.0, 5, M.mat('#c9cfd6'), 0, 2.8, -0.1, g);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 8, 0, TAU, 0, PI / 2), M.mat(GOLD, { rough: 0.25 })); bell.position.set(0, 5.75, -0.15); bell.rotation.x = PI; g.add(bell);
  M.sph(0.2, M.mat(RED), 0, 6.0, -0.2, g, 10, 8);
  board(1.3, 0.42, sign('ÇEKİÇ GÜCÜ', RED, 1.3, 0.42), 0, 6.45, -0.2, g);
  const puck = M.rbox(0.22, 0.12, 0.12, 0.03, M.mat('#2a2d33'), 0, 0.5, -0.05, g); live(puck);
  const hammer = new THREE.Group(); hammer.position.set(0.55, 0, 0.55); g.add(hammer);
  M.cyl(0.03, 0.03, 0.9, 6, M.mat('#8a5a33'), 0, 0.45, 0, hammer); M.rbox(0.3, 0.16, 0.16, 0.04, red, 0, 0.92, 0, hammer);
  let t = 0, top = 0, rang = true;
  anims.push((dt) => { if (t <= 0) return; t -= dt; const k = 1 - t / 1.6; puck.position.y = 0.5 + top * Math.sin(Math.min(1, k) * PI); if (!rang && k > 0.45 && top > 4.9) { rang = true; sfx('bong', { at: g.getWorldPosition(V(0, 0, 0)), npc: true }); } });
  // hit(p): oyuncunun vuruşu (0-1); 0,95 ve üstü zili çaldırır (minioyun.js)
  return { g, play: () => { t = 1.6; top = rand(2.4, 5.0); rang = false; }, api: { kind: 'cekic', hit: (p) => { t = 1.6; top = 0.4 + p * 4.75; rang = false; }, busy: () => t > 0 } };
}
// korsan gemisi: iki A ayağı arasında sallanan tekne; kaburgalı gövde, altın şerit, kalkanlar, direkte korsan bayrağı
const SHIP_H = 6.6;
function makeShip(flags) {
  const g = new THREE.Group(), timber = M.mat('#7a3b2e'), wood = M.mat('#ffffff', { map: texRep('wood', 1.5, 1) }), gold = M.mat(GOLD, { rough: 0.3 });
  M.rbox(9.6, 0.3, 5.2, 0.06, wood, 0, 0.15, 0, g);
  M.rbox(2.4, 0.15, 1.1, 0.03, wood, 0, 0.08, 3.1, g);
  for (const z of [-2.1, 2.1]) {
    beam(V(-4.5, 0.3, z), V(0, SHIP_H, z * 0.9), 0.2, timber, g, 8);
    beam(V(4.5, 0.3, z), V(0, SHIP_H, z * 0.9), 0.2, timber, g, 8);
    beam(V(-2.3, 3.4, z * 0.95), V(2.3, 3.4, z * 0.95), 0.1, timber, g, 6);
  }
  const ax = M.cyl(0.22, 0.22, 4.4, 12, M.mat('#c9cfd6', { rough: 0.35 }), 0, SHIP_H, 0, g); ax.rotation.x = PI / 2;
  solid(g);
  const swing = new THREE.Group(); swing.position.y = SHIP_H; g.add(swing);
  const steel = M.mat('#c9cfd6', { rough: 0.35 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(V(0, 0, sz * 0.5), V(sx * 2.6, -4.7, sz * 0.95), 0.08, steel, swing, 6);
  const hull = new THREE.Group(); hull.position.y = -5.4; swing.add(hull);
  const sh = new THREE.Shape();
  sh.moveTo(-4.4, 1.5); sh.quadraticCurveTo(-3.9, -0.1, -2.4, -0.55); sh.lineTo(2.4, -0.55); sh.quadraticCurveTo(3.9, -0.1, 4.4, 1.5);
  sh.lineTo(3.7, 1.1); sh.quadraticCurveTo(3.1, 0.25, 2.2, 0.15); sh.lineTo(-2.2, 0.15); sh.quadraticCurveTo(-3.1, 0.25, -3.7, 1.1); sh.closePath();
  const hg = new THREE.ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 10 }); hg.translate(0, 0, -1.1);
  const hm = new THREE.Mesh(hg, M.mat('#8a5a33')); hm.castShadow = true; hm.receiveShadow = true; hull.add(hm);
  M.rbox(4.9, 0.13, 2.36, 0.04, gold, 0, -0.12, 0, hull);
  M.rbox(4.4, 0.08, 2.3, 0.03, M.mat('#5a3420'), 0, -0.38, 0, hull);
  for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) { const s = M.cyl(0.19, 0.19, 0.05, 12, M.mat([RED, BLUE, GOLD, GREEN, '#ffffff'][i]), -1.8 + i * 0.9, 0.35, sz * 1.18, hull); s.rotation.x = PI / 2; }
  for (const x of [-4.35, 4.35]) M.sph(0.14, gold, x, 1.55, 0, hull, 10, 8);
  for (let i = 0; i < 5; i++) M.rbox(0.3, 0.42, 1.9, 0.04, M.mat('#6b3d22'), -2.0 + i * 1.0 - 0.3, 0.36, 0, hull);
  M.cyl(0.07, 0.09, 3.3, 8, M.mat('#5a3420'), 0, 1.8, 0, hull);
  M.cyl(0.3, 0.26, 0.28, 10, M.mat('#5a3420'), 0, 3.0, 0, hull);
  const seats = [];
  for (let i = 0; i < 5; i++) for (const sz of [-0.5, 0.5]) { const s = new THREE.Object3D(); s.position.set(-2.0 + i * 1.0, 0.15, sz); hull.add(s); seats.push(s); }
  solid(hull);
  const flag = board(1.1, 0.8, skullTex(), 0.6, 3.2, 0, hull); flag.material.side = THREE.DoubleSide; flag.userData.ph = 0;
  live(swing);
  return { g, swing, seats, flag };
}
// hız treni rayı: istasyondan batıya, zincirli tepe, ilk büyük iniş, iki tümsek; stadyum biçimli halka
const CO_L = 12.5 + PI * 4 + 25 + PI * 4 + 12.5;
const HK = [[0, 0.6], [5, 0.6], [12.5, 6.8], [15.5, 7.4], [22, 7.4], [25.5, 6.6], [31, 1.0], [35, 4.4], [38, 4.6], [42.5, 1.2], [46.5, 3.4], [50, 2.2], [56, 3.0], [61, 1.4], [67, 0.75], [CO_L, 0.6]];
function coY(s) {
  for (let i = 1; i < HK.length; i++) if (s <= HK[i][0]) { const [a, ya] = HK[i - 1], [b, yb] = HK[i], k = (s - a) / (b - a); return ya + ((yb - ya) * (1 - Math.cos(k * PI))) / 2; }
  return HK[0][1];
}
function coP(s, out = V(0, 0, 0)) {
  s = ((s % CO_L) + CO_L) % CO_L;
  const A = 12.5, B = A + PI * 4, C = B + 25, D = C + PI * 4;
  if (s < A) out.set(93 - s, 0, -47);
  else if (s < B) { const u = (s - A) / 4; out.set(80.5 - 4 * Math.sin(u), 0, -51 + 4 * Math.cos(u)); }
  else if (s < C) out.set(80.5 + (s - B), 0, -55);
  else if (s < D) { const u = (s - C) / 4; out.set(105.5 + 4 * Math.sin(u), 0, -51 - 4 * Math.cos(u)); }
  else out.set(105.5 - (s - D), 0, -47);
  out.y = coY(s);
  return out;
}
function makeCoaster(flags) {
  const g = new THREE.Group(), N = 320, ctr = [], left = [], right = [], spine = [], t = V(0, 0, 0), lat = V(0, 0, 0);
  for (let i = 0; i < N; i++) {
    const s = (i / N) * CO_L, p = coP(s), a = coP(s - 0.08), b = coP(s + 0.08);
    t.subVectors(b, a).normalize(); lat.crossVectors(t, UP).normalize();
    ctr.push(p); left.push(p.clone().addScaledVector(lat, 0.38)); right.push(p.clone().addScaledVector(lat, -0.38)); spine.push(p.clone().setY(p.y - 0.22));
  }
  const tube = (pts, r, m) => { const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 480, r, 6, true), m); c.castShadow = true; g.add(c); };
  const steel = M.mat('#d7dbe0', { rough: 0.3 }), red = M.mat(RED, { rough: 0.45 }), white = M.mat('#f4f6f8', { rough: 0.45 });
  tube(left, 0.055, steel); tube(right, 0.055, steel); tube(spine, 0.12, red);
  // traversler ve ayaklar (örneklenmiş)
  const dummy = new THREE.Object3D(), nT = Math.floor(CO_L / 0.6), ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.06, 0.14), M.mat('#3a3f4a'), nT);
  for (let i = 0; i < nT; i++) { const s = i * 0.6, p = coP(s), q = coP(s + 0.1); dummy.position.set(p.x, p.y - 0.08, p.z); dummy.lookAt(q.x, q.y - 0.08, q.z); dummy.updateMatrix(); ties.setMatrixAt(i, dummy.matrix); }
  const legs = [];
  for (let s = 0; s < CO_L; s += 2.3) {
    const p = coP(s), a = coP(s - 0.1), b = coP(s + 0.1);
    if (p.y < 0.9) continue;
    t.subVectors(b, a).normalize(); lat.crossVectors(t, UP).normalize();
    if (p.y > 3) for (const k of [-0.5, 0.5]) legs.push([p.x + lat.x * k, p.z + lat.z * k, p.y - 0.25]); else legs.push([p.x, p.z, p.y - 0.25]);
  }
  const lm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.11, 1, 8), white, legs.length);
  legs.forEach(([x, z, h], i) => { dummy.position.set(x, h / 2, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, h, 1); dummy.updateMatrix(); lm.setMatrixAt(i, dummy.matrix); });
  for (const m of [ties, lm]) { m.castShadow = true; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); g.add(m); }
  // istasyon: tahta peron, çizgili çatı, tabela
  const wood = M.mat('#ffffff', { map: texRep('wood', 3, 0.6) });
  M.rbox(10.5, 0.08, 1.7, 0.02, wood, 93, 0.04, -45.8, g);
  for (const x of [88.2, 97.8]) for (const z of [-45.05, -48.6]) M.cyl(0.1, 0.12, 3.0, 8, white, x, 1.5, z, g);
  M.rbox(10.8, 0.2, 4.1, 0.05, M.mat('#5b3b8c'), 93, 3.05, -46.85, g);
  const roofTop = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 3.9), M.mat('#ffffff', { map: vstripes(PURPLE, '#f6f0ff', 12) })); roofTop.rotation.x = -PI / 2; roofTop.position.set(93, 3.16, -46.85); g.add(roofTop);
  board(10.8, 0.5, vstripes(RED, GOLD, 30), 93, 3.0, -44.79, g);
  board(4.6, 0.9, sign('HIZ TRENİ', PURPLE, 4.6, 0.9), 93, 3.75, -44.85, g);
  M.rbox(4.8, 0.95, 0.1, 0.03, M.mat('#3a3f4a'), 93, 3.7, -44.92, g);
  bulbs(g, line(V(87.7, 2.72, -44.75), V(98.3, 2.72, -44.75), 28));
  flagPole(g, 88.2, 3.15, -45.05, YEL, 1.0, flags); flagPole(g, 97.8, 3.15, -45.05, RED, 1.0, flags);
  return g;
}
function makeCoasterCar(col, front) {
  const g = new THREE.Group(), c = M.mat(col), dark = M.mat('#2a2d33'), gold = M.mat(GOLD, { rough: 0.3 });
  M.rbox(1.0, 0.42, 1.35, 0.12, c, 0, 0.3, 0, g);
  M.rbox(1.04, 0.1, 1.39, 0.04, gold, 0, 0.12, 0, g);
  M.rbox(0.9, 0.44, 0.12, 0.05, dark, 0, 0.62, -0.45, g);
  M.cyl(0.03, 0.03, 0.9, 6, gold, 0, 0.74, 0.22, g).rotation.z = PI / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl(0.08, 0.08, 0.08, 10, dark, sx * 0.44, 0.05, sz * 0.45, g).rotation.z = PI / 2;
  if (front) {
    const nose = M.sph(0.42, c, 0, 0.36, 0.7, g, 14, 10); nose.scale.set(1.1, 0.7, 1.15);
    for (const sx of [-1, 1]) { M.sph(0.09, M.mat('#ffffff'), sx * 0.22, 0.56, 0.98, g, 8, 6); M.sph(0.045, dark, sx * 0.22, 0.57, 1.06, g, 6, 5); M.cyl(0, 0.06, 0.2, 6, gold, sx * 0.2, 0.75, 0.82, g); }
  }
  const seats = [];
  for (const sx of [-0.24, 0.24]) { const s = new THREE.Object3D(); s.position.set(sx, 0.14, -0.08); g.add(s); seats.push(s); }
  solid(g); live(g);
  return { g, seats };
}
// yiyecek tezgâhı: önü açık araba-kiosk, çizgili tente, çatıda ürünün dev maketi (ön yüz +z)
function makeStall(col, label, kind) {
  const g = new THREE.Group(), cream = M.mat(CREAM), c = M.mat(col), wood = M.mat('#ffffff', { map: texRep('wood', 0.8, 0.4) });
  M.rbox(3.0, 1.0, 0.7, 0.05, c, 0, 0.5, 0.6, g);
  M.rbox(3.1, 0.06, 0.8, 0.02, wood, 0, 1.02, 0.62, g);
  M.rbox(3.0, 2.4, 0.1, 0.03, cream, 0, 1.2, -0.95, g);
  for (const sx of [-1, 1]) M.rbox(0.1, 2.4, 1.9, 0.03, cream, sx * 1.45, 1.2, 0, g);
  M.rbox(3.2, 0.12, 2.2, 0.03, c, 0, 2.46, 0, g);
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.0), M.mat('#ffffff', { map: vstripes(col, '#ffffff', 10), side: THREE.DoubleSide }));
  aw.position.set(0, 2.25, 1.38); aw.rotation.x = -1.05; aw.castShadow = true; g.add(aw);
  for (let i = 0; i < 8; i++) { const v = new THREE.Mesh(new THREE.CircleGeometry(0.2, 8, 0, PI), M.mat(i % 2 ? '#ffffff' : col, { side: THREE.DoubleSide })); v.position.set(-1.4 + i * 0.4, 1.83, 1.8); v.rotation.set(-0.2, 0, PI); g.add(v); }
  board(2.4, 0.42, sign(label, col, 2.4, 0.42), 0, 2.8, 0.1, g);
  M.rbox(2.5, 0.5, 0.08, 0.02, c, 0, 2.8, 0.05, g);
  const top = new THREE.Group(); top.position.y = 3.15; g.add(top);
  if (kind === 'patlamis') {
    const box = M.cyl(0.55, 0.4, 0.95, 16, M.mat('#ffffff', { map: vstripes(RED, '#ffffff', 12) }), 0, 0.48, 0, top); box.castShadow = true;
    for (let i = 0; i < 14; i++) { const a = i * 2.4, r = (i % 4) * 0.13; M.sph(0.16, M.mat(i % 2 ? '#fff6d8' : '#ffe08a'), Math.cos(a) * r, 1.0 + (i % 3) * 0.08, Math.sin(a) * r, top, 8, 6); }
    // camlı patlatma makinesi tezgâhta
    M.rbox(0.7, 0.75, 0.55, 0.03, M.mat('#bfe6ff', { opacity: 0.45, rough: 0.1 }), 0.9, 1.43, 0.45, g);
    for (let i = 0; i < 10; i++) M.sph(0.06, M.mat('#fff3c8'), 0.75 + (i % 4) * 0.1, 1.12 + Math.floor(i / 4) * 0.08, 0.35 + (i % 3) * 0.1, g, 6, 5);
  } else if (kind === 'pamuk') {
    M.cyl(0.05, 0.05, 1.2, 6, M.mat('#f4ecd8'), 0, 0.6, 0, top);
    for (const [x, y, z, r] of [[0, 1.45, 0, 0.6], [0.35, 1.7, 0.15, 0.38], [-0.3, 1.3, -0.15, 0.36], [0.1, 1.85, -0.2, 0.3]]) M.ico(r, M.mat(r > 0.5 ? '#ff9fd0' : '#ffc2e2', { rough: 1 }), x, y, z, top, 1);
  } else {
    const cone = M.cyl(0.42, 0.04, 1.0, 12, M.mat('#e2a85c'), 0, 0.5, 0, top); cone.castShadow = true;
    for (const [y, c2] of [[1.1, '#ffd3e0'], [1.5, '#fff1c4'], [1.85, '#8a5a3c']]) M.sph(0.42 - (y - 1.1) * 0.15, M.mat(c2), 0, y, 0, top, 14, 10);
    M.sph(0.08, M.mat(RED), 0, 2.15, 0, top, 8, 6);
    // dondurma dolabı: renkli kaplar
    M.rbox(0.9, 0.12, 0.5, 0.02, M.mat('#dfe7ee'), 0.85, 1.11, 0.5, g);
    for (let i = 0; i < 4; i++) M.cyl(0.09, 0.09, 0.06, 10, M.mat(['#ffd3e0', '#fff1c4', '#8a5a3c', '#c7f0c2'][i]), 0.55 + i * 0.2, 1.19, 0.5, g);
  }
  bulbs(g, line(V(-1.55, 1.76, 1.85), V(1.55, 1.76, 1.85), 9));
  return { g, top };
}
function makeFountain() {
  const g = new THREE.Group(), stone = M.mat('#ece6da'), stone2 = M.mat('#d8cfbf');
  M.cyl(2.5, 2.6, 0.5, 32, stone, 0, 0.25, 0, g);
  const wm = new THREE.MeshStandardMaterial({ color: '#7fd8f2', map: texRep('water', 1.5, 1.5), roughness: 0.15, transparent: true, opacity: 0.9 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.28, 32), wm); water.rotation.x = -PI / 2; water.position.y = 0.46; g.add(water);
  M.cyl(0.35, 0.5, 1.2, 16, stone2, 0, 1.0, 0, g);
  M.cyl(1.1, 0.6, 0.3, 24, stone, 0, 1.65, 0, g);
  M.cyl(0.18, 0.24, 0.8, 12, stone2, 0, 2.15, 0, g);
  M.cyl(0.6, 0.35, 0.22, 20, stone, 0, 2.6, 0, g);
  const fm = new THREE.MeshStandardMaterial({ color: '#d8f4ff', map: texRep('water', 2, 1), roughness: 0.1, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
  const fall = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.25, 24, 1, true), fm); fall.position.y = 1.05; g.add(fall);
  const fall2 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 0.55, 18, 1, true), fm); fall2.position.y = 2.38; g.add(fall2);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 10, 1, true), fm); jet.position.y = 3.15; jet.rotation.x = PI; g.add(jet);
  return { g, wm, fm, jet };
}

// ---------- eğlence ----------
const pin = (c, seat) => { seat.getWorldPosition(c.obj.position); seat.getWorldQuaternion(c.obj.quaternion); };
const say = (c, t, d = 1.6) => { c.setBubbleText(t); c.bubbleT = d; };
// oyuncu da biner (2026-11-04 kullanıcı: "bizim adamımız köydeki etkinliklere katılabilmeli. Örneğin çarpışan arabaya, gondola,
// dönme dolaba, atlı karıncaya binebilmeli"): eğlencenin başındaki pedde durunca sıradaki turda boş koltuğa oturur, para ödemez
// (lunapark onun). Binenler listesinde ME olarak durur: koltuğa iliştirme, iniş ve tepkiler ziyaretçilerinkiyle aynı yoldan.
// Binince main.js oyuncuyu yürütmez (G.onRide); çarpışan arabayı oyuncu yön tuşlarıyla sürer (G.rideInp)
const ME = { me: true, obj: null, setBubbleText(t) { const p = G.player.position; floatText(V(p.x, p.y + 2.3, p.z), t, ''); }, clearBubble() {} };
const PAD_CSS = 'font:14px var(--font-title);background:rgba(255,255,255,.92);color:#3b2a6b;padding:2px 10px;border-radius:999px;border:2px solid #3b2a6b;white-space:nowrap';
class RidePad extends Station {
  constructor(ride, x, z, instant) {
    super(x, z, 1.4, 1.4, { dashed: true, instant });
    this.ride = ride; this.dwell = 0;
    this.bodyFn = () => []; // yalnız pedin kendisi: yandaki eğlencenin gövdesine değmek bindirmez
    const el = document.createElement('div'); el.style.cssText = PAD_CSS; el.textContent = `${ride.icon} Bin · bedava`;
    G.labels.add(el, (v) => v.set(x, 0.7, z));
  }
  update(dt) {
    const r = this.ride;
    if (!this.inside || G.onRide) { this.dwell = 0; if (!this.inside && !G.onRide) r.want = false; return; }
    if ((this.dwell += dt) < 0.6 || r.want) return;
    r.want = true;
    floatText(V(this.zone.x, 1.8, this.zone.z), r.phase === 'run' || r.phase === 'unload' ? '⏳ Bu tur bitince binersin' : `${r.icon} Biniyorsun…`, '');
  }
}
// eğlence: sıra (kuyruk), binen ziyaretçiler, döngü: bekle → yükle → çalış → indir
class Ride {
  constructor(R, o) {
    Object.assign(this, { R, queue: [], riders: [], phase: 'idle', t: 0, bt: 0, loadT: 5, want: false }, o);
    R.rides.push(this);
    if (o.pad) new RidePad(this, o.pad[0], o.pad[1], o.instant);
  }
  slot(i) { return this.gate.clone().addScaledVector(this.qdir, i * 0.78); }
  repath() { this.queue.forEach((c, i) => { c.path = [this.slot(i)]; }); }
  join(c) { this.queue.push(c); c.path = [this.slot(this.queue.length - 1)]; c.state = 'rideQ'; c.ride = this; c.wait = 0; }
  leaveQ(c) { const i = this.queue.indexOf(c); if (i >= 0) { this.queue.splice(i, 1); this.repath(); } }
  freeSeat() { return this.seats.find((s) => !this.riders.some((r) => r.seat === s)) || null; }
  board(c) {
    const seat = this.freeSeat();
    if (!seat) return;
    this.leaveQ(c);
    c.state = 'riding'; c.riding = true; c.clearBubble(); c.bubbleT = 0;
    this.riders.push({ c, seat });
    const fee = Math.round(this.fee * mult()), at = c.obj.position.clone();
    this.R.till(fee); // bütün gelir gişedeki tek kasada (R.till)
    floatText(at.setY(1.8), `${this.icon} +${fee} ₺`, 'pos');
    sfx('cash', { at, npc: true });
    pin(c, seat);
  }
  // oyuncu biner: önce meSeat (hız treninde en ön), yoksa ilk boş koltuk; tur az sonra kalkar
  boardMe() {
    const seat = (this.meSeat && this.meSeat()) || this.freeSeat(), P = G.player;
    this.want = false; ME.obj = P; this.meT = G.time;
    this.riders.push({ c: ME, seat });
    this.bt = 0.45; this.t = Math.max(this.t, this.loadT - 2.5);
    G.onRide = (dt, inp) => {
      G.rideInp = inp;
      // bölge güncellenmez olduysa (oyuncu başka yere ışınlandı) oyuncu koltukta kalmasın
      if (G.time - this.meT > 0.6) { const r = this.riders.find((q) => q.c === ME); if (r) this.unboard(r); else this.meOff(); return; }
      this.poseMe(P);
    };
    P.rotation.x = 0;
    sfx('pop');
    floatText(P.position.clone().setY(2.2), `${this.icon} Bedava · lunapark senin!`, 'pos');
  }
  // oturuş: bacaklar öne; heyecanlı eğlencede (gemi, tren) çalışırken eller havada, ötekilerde tutunur
  poseMe(P) {
    const u = P.userData, up = this.thrill && this.phase === 'run';
    for (const [i, l] of u.legs.entries()) { l.rotation.x = this.legX ?? -1.45; l.rotation.z = this.legZ ? (i ? this.legZ : -this.legZ) : 0; }
    u.arms.forEach((a, i) => { a.rotation.x = up ? -2.85 + Math.sin(G.time * 7 + i * 2) * 0.12 : -0.95; a.rotation.z = up ? (i ? -0.3 : 0.3) : 0; });
  }
  meOff() {
    const P = G.player, u = P.userData;
    G.onRide = null; G.rideInp = null;
    P.quaternion.identity();
    for (const l of u.legs) { l.rotation.x = 0; l.rotation.z = 0; }
    for (const a of u.arms) { a.rotation.x = 0; a.rotation.z = 0; }
    P.position.copy(this.exit).add(V(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)));
    P.rotation.y = this.look ?? 0;
    floatText(P.position.clone().setY(2.2), pick(['😄', '🤩', '😆', '🥳']), 'pos');
    confetti(P.position.clone().setY(1.6), 8);
  }
  unboard(r) {
    this.riders.splice(this.riders.indexOf(r), 1);
    const c = r.c;
    if (c === ME) { this.meOff(); return; }
    c.riding = false;
    c.obj.quaternion.identity();
    c.obj.position.copy(this.exit).add(V(rand(-0.6, 0.6), 0, rand(-0.6, 0.6)));
    c.obj.rotation.y = rand(-PI, PI);
    c.state = 'afterRide'; c.path = [];
    say(c, pick(['😄', '🤩', '😆', '🥳', '😍']), 1.8);
    if (Math.random() < 0.25) confetti(c.obj.position.clone().setY(1.6), 6);
  }
  update(dt) {
    this.t += dt;
    const head = this.queue[0], ready = !!head && head.state === 'rideQ' && !head.path.length, me = this.want && !G.onRide;
    switch (this.phase) {
      case 'idle': if (ready || me) { this.phase = 'load'; this.t = 0; this.bt = 0.3; } break;
      case 'load':
        this.bt -= dt;
        if (me && this.bt <= 0 && this.freeSeat()) this.boardMe();
        else if (this.bt <= 0 && ready && this.freeSeat()) { this.board(head); this.bt = 0.45; }
        if (this.riders.length && this.bt <= 0 && (this.t > this.loadT || !this.freeSeat())) { this.phase = 'run'; this.t = 0; this.start(); LS.bell(this.gate); }
        else if (!this.riders.length && this.t > this.loadT && !ready && !me) this.phase = 'idle';
        break;
      case 'run': if (this.run(dt)) { this.phase = 'unload'; this.t = 0; } break;
      case 'unload':
        if (this.t > 0.3) { this.t = 0; if (this.riders.length) this.unboard(this.riders[0]); else this.phase = 'idle'; }
        break;
    }
    if (this.op) this.op(dt);
    this.anim(dt);
    for (const r of this.riders) pin(r.c, r.seat);
    if (G.onRide && this.riders.some((r) => r.c === ME)) this.meT = G.time;
  }
}

// ---------- kurulum ----------
let LR = null; // genişleme kademeleri bölgeye buradan ulaşır
export function setupLunapark(R, T) {
  LR = R;
  const C = R.content, { strip, rcol, hint } = T;
  // yuvarlak nesnenin çarpışması: tek kare kutunun köşeleri çemberin ~1,8 m dışına taşıyordu, atlıkarıncanın yanından geçen oyuncu
  // görünmeyen köşeye takılıp yana itiliyordu (2026-11-03 kullanıcı). Çembere oturan basamaklı kutular (köşeler en çok %2 dışarıda)
  const ring = (x, z, r) => { for (const [a, b] of [[1, 0.21], [0.92, 0.39], [0.82, 0.58]]) { rcol(R, x - a * r, x + a * r, z - b * r, z + b * r); rcol(R, x - b * r, x + b * r, z - a * r, z + a * r); } };
  const put = (o, x, z, ry = 0, instant = true, y = 0) => { o.position.set(x, y, z); o.rotation.y = ry; C.add(o); if (!instant) popIn(o); return o; };
  Object.assign(R, { rides: [], visitors: [], npcs: [], flags: [], anims: [], stalls: [], games: [], legacy: [], t: 0, spawnT: 4 });
  // tek kasa (2026-11-02 kullanıcı: "lunaparkta tek kasa olsun, tüm oyun gelirleri tek kasada toplansın"): bilet, eğlence, tezgâh ve
  // oyun parası girişteki gişenin kasasında birikir; banknotlar gişenin önünden kasaya uçar
  const TILL = V(BOOTH.x, 0, BOOTH.z + 1.9);
  R.till = (amount) => { if (R.gatePile) R.gatePile.add(amount, TILL); };
  const npc = (x, z, ry, look, parent = C) => {
    const n = M.makeCharacter(look || { shirt: pick([RED, BLUE, TEAL, PURPLE, ORANGE]), pants: '#2b2f3a', hat: 'cap', hatColor: CREAM });
    n.position.set(x, 0, z); n.rotation.y = ry; parent.add(n); R.npcs.push(n);
    return n;
  };
  // eğlencenin başındaki operatör (2026-11-02 kullanıcı: "lunaparkta çalışan yok, aletlerin başında operatörler olmalı"): kumanda
  // kürsüsünün arkasında durur; binişte sıranın başına, çalışırken alete bakar. Kürsünün lambası beklerken kırmızı, biniş ve inişte
  // sarı, alet çalışırken yeşil. (x, z) kürsü; operatör onun alete göre arkasında
  const operator = (ride, x, z, col, instant) => {
    const ry = ride.look, s = Math.sin(ry), c = Math.cos(ry), k = makeConsole(col);
    put(k.g, x, z, ry, instant);
    const n = npc(x - 0.6 * s, z - 0.6 * c, ry, { shirt: col, pants: '#2b2f3a', hat: 'cap', hatColor: '#ffffff' }), o = n.position;
    rcol(R, x - 0.38, x + 0.38, z - 0.38, z + 0.38); // yalnız kürsü: operatör müşteriler gibi içinden geçilir (kürsüyle birlikte yürüme yoluna 1,5 m taşıyordu)
    const toQ = Math.atan2(ride.gate.x - o.x, ride.gate.z - o.z);
    ride.op = (dt) => {
      n.rotation.y += wrap((ride.phase === 'load' ? toQ : ry) - n.rotation.y) * (1 - Math.exp(-6 * dt));
      k.lamp.emissive.set(ride.phase === 'run' ? '#3ad65b' : ride.phase === 'idle' ? RED : '#ffc23a');
    };
  };
  // eski kasaların yeri: kayıtta kalan para (world.js yığınları konumundan tanır) buraya döner, R.update gişedeki kasaya aktarır
  const legacy = (x, z) => { const p = new MoneyPile(C, x, z, 1.01, { instant: true, desk: false }); p.base.visible = false; p.bodyFn = () => []; R.legacy.push(p); };
  const oldKiosk = (x, z, ry) => legacy(x + 0.68 * Math.sin(ry), z + 0.68 * Math.cos(ry)); // eğlencenin bilet kulübesindeki kasa

  // --- kilitliyken de görünen: çit, dönme dolabın iskeleti, kapalı geçici kapı ve YAKINDA panosu ---
  const tease = new THREE.Group(); tease.name = 'lunapark-tease'; G.scene.add(tease);
  const [x0, x1, z0, z1] = [73.3, 112.7, -55.8, 1.35];
  tease.add(makeFence([[x0, z1, 89.6, z1], [96.4, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1], [x0, z0, x1, z0]]));
  rcol(R, x0, 89.6, 1.15, 1.55); rcol(R, 96.4, x1, 1.15, 1.55);
  const wheel = makeWheel(); wheel.g.position.set(104, 0, -38); tease.add(wheel.g);
  rcol(R, 99.2, 108.8, -40.4, -35.8);
  const closed = new THREE.Group(); tease.add(closed);
  {
    const wood = M.mat('#c98b52'), iron = M.mat('#2d3340', { rough: 0.5 });
    for (const x of [89.9, 96.1]) M.rbox(0.35, 2.4, 0.35, 0.05, wood, x, 1.2, z1, closed);
    for (let k = 0; k < 16; k++) M.cyl(0.025, 0.025, 1.9, 5, iron, 90.2 + k * 0.38, 0.95, z1, closed);
    for (const y of [0.3, 1.0, 1.75]) M.rbox(5.9, 0.05, 0.05, 0.01, iron, 93, y, z1, closed);
    M.cyl(0.03, 0.03, 0.4, 6, M.mat('#c9cfd6'), 93, 1.0, z1 + 0.06, closed);
    board(2.6, 0.62, sign('YAKINDA', RED, 2.6, 0.62), 93, 1.35, z1 + 0.06, closed);
    // büyük pano: dolabın önünde, caddeden okunur
    for (const x of [97.6, 103.4]) M.cyl(0.12, 0.12, 3.2, 8, wood, x, 1.6, -1.2, closed);
    M.rbox(6.4, 2.1, 0.2, 0.06, M.mat('#2c3e66'), 100.5, 3.3, -1.2, closed);
    board(6.1, 1.0, sign('LUNAPARK', RED, 6.1, 1.0, { fg: '#fff6c8' }), 100.5, 3.75, -1.08, closed);
    board(6.1, 0.62, sign('YAKINDA AÇILIYOR', '#2c3e66', 6.1, 0.62, { border: '#2c3e66' }), 100.5, 2.75, -1.08, closed);
  }

  // --- zemin (bölge açılınca görünür) ---
  strip(C, 93, -1.5, 23, 5.6, 'cobble', 2.4);
  strip(C, 93, 2.4, 6.4, 2.6, 'cobble', 2.4);
  { const d = new THREE.Mesh(new THREE.CircleGeometry(7.4, 48), new THREE.MeshStandardMaterial({ map: texRep('cobble', 6, 6), roughness: 0.95 })); d.rotation.x = -PI / 2; d.position.set(93, 0.012, -11); d.receiveShadow = true; C.add(d); }
  strip(C, 93, -32.2, 5.2, 28.4, 'cobble', 2.4);
  strip(C, 83.6, -11.2, 3.0, 13.4, 'cobble', 2.4);
  strip(C, 98.8, -24.4, 2.6, 12.6, 'cobble', 2.4);
  strip(C, 100.2, -34.7, 9.6, 2.0, 'cobble', 2.4);
  strip(C, 86.4, -34.2, 8.6, 2.0, 'cobble', 2.4);
  strip(C, 89.2, -24.2, 3.0, 2.2, 'cobble', 2.4);
  strip(C, 105.5, -10.8, 11, 11, 'path', 3);

  // --- giriş meydanı süsleri, ağaçlar, lambalar, flamalı ipler ---
  const lampAt = (x, z) => { put(M.makeLamp(), x, z); rcol(R, x - 0.18, x + 0.18, z - 0.18, z + 0.18); };
  for (const [x, z] of [[84.6, 0.4], [101.6, 0.4], [82.2, -3.9], [104.2, -3.9]]) lampAt(x, z);
  for (const [x, z] of [[83.2, -1.2], [103.0, -1.6], [97.6, 0.3]]) { put(M.makeFlowers(), x, z); }
  for (const [x, z] of [[74.6, -2.6], [74.6, -8.8], [74.7, -14.4], [111.3, -2.8], [111.4, -19.0], [111.4, -30.6], [111.5, -43.0], [74.4, -31.0]]) { put(M.makeTree(Math.random() < 0.5 ? 0 : 1, 0.9), x, z); rcol(R, x - 0.35, x + 0.35, z - 0.35, z + 0.35); }
  {
    // gezinti yolunun iki yanında lambalar; karşılıklı lambaların arasında renkli flamalı ipler
    const flagGeo = new THREE.BufferGeometry(); flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.38, 0], 3)); flagGeo.computeVertexNormals();
    const spans = [], cols = [RED, YEL, BLUE, GREEN, PINK, ORANGE, PURPLE].map((c) => new THREE.Color(c));
    for (const z of [-20.5, -27.2, -41.0]) { lampAt(90.1, z); lampAt(95.9, z); spans.push([V(90.1, 3.15, z), V(95.9, 3.15, z)]); }
    spans.push([V(89.6, 5.6, 1.2), V(87.4, 3.6, -2.4)], [V(96.6, 5.6, 1.2), V(101.6, 3.2, 0.4)], [V(89.6, 5.0, 1.2), V(84.6, 3.2, 0.4)]);
    const pts = [], strs = [];
    for (const [a, b] of spans) {
      const L = a.distanceTo(b), n = Math.max(4, Math.round(L / 0.42)), prev = [];
      for (let i = 0; i <= n; i++) { const k = i / n, p = a.clone().lerp(b, k); p.y -= Math.sin(k * PI) * 0.55; prev.push(p); if (i && i < n) pts.push({ p, ry: Math.atan2(b.x - a.x, b.z - a.z) + PI / 2 }); }
      for (let i = 1; i < prev.length; i++) strs.push(prev[i - 1], prev[i]);
    }
    const im = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), pts.length), d = new THREE.Object3D();
    pts.forEach(({ p, ry }, i) => { d.position.copy(p); d.rotation.set(0, ry, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, cols[i % cols.length]); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); C.add(im);
    C.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strs), new THREE.LineBasicMaterial({ color: '#5a5f6a' })));
  }
  // dinlenme yeri: çeşme, çevresinde banklar, şemsiyeli masalar, balon satıcısı
  const fount = makeFountain(); put(fount.g, 105.5, -10.8); ring(105.5, -10.8, 2.6);
  R.anims.push((dt, t) => { fount.wm.map.offset.set(t * 0.02, Math.sin(t * 0.7) * 0.03); fount.fm.map.offset.y = -t * 0.6; fount.jet.scale.y = 1 + Math.sin(t * 5) * 0.12; });
  for (const [x, z, ry] of [[105.5, -6.9, PI], [105.5, -14.7, 0], [101.6, -10.8, -PI / 2], [109.4, -10.8, PI / 2]]) { put(M.makeBench(), x, z, ry); rcol(R, x - (ry % PI ? 0.35 : 0.8), x + (ry % PI ? 0.35 : 0.8), z - (ry % PI ? 0.8 : 0.35), z + (ry % PI ? 0.8 : 0.35)); }
  for (const [x, z, c] of [[101.8, -16.0, '#ff6f61'], [109.2, -16.0, '#4fc3e8']]) {
    const tb = new THREE.Group(); M.cyl(0.6, 0.6, 0.06, 16, M.mat('#fbf7ef'), 0, 0.74, 0, tb); M.cyl(0.05, 0.08, 0.74, 8, M.mat('#c9cfd6'), 0, 0.37, 0, tb);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; M.cyl(0.2, 0.2, 0.05, 12, M.mat(c), Math.sin(a) * 0.95, 0.45, Math.cos(a) * 0.95, tb); M.cyl(0.03, 0.03, 0.45, 6, M.mat('#c9cfd6'), Math.sin(a) * 0.95, 0.22, Math.cos(a) * 0.95, tb); }
    put(tb, x, z); put(M.makeUmbrella(c), x, z); rcol(R, x - 0.7, x + 0.7, z - 0.7, z + 0.7);
  }
  {
    const bx = 100.4, bz = -6.0, seller = npc(bx, bz, PI / 2 + 0.4, { shirt: PURPLE, pants: '#3a3f4a', hat: 'cap', hatColor: YEL, mustache: true });
    const bunch = new THREE.Group(); bunch.position.set(bx + 0.3, 0, bz + 0.25); C.add(bunch);
    const strs = [];
    for (let i = 0; i < 8; i++) { const a = i * 0.8, x = Math.cos(a) * 0.35 * (i % 2 ? 1 : 0.6), z = Math.sin(a) * 0.35 * (i % 2 ? 1 : 0.6), y = 2.5 + (i % 3) * 0.28; const b = M.sph(0.21, M.mat([RED, YEL, BLUE, GREEN, PINK, PURPLE, ORANGE, TEAL][i], { rough: 0.3 }), x, y, z, bunch, 12, 10); b.scale.y = 1.2; strs.push(V(0, 1.0, 0), V(x, y - 0.25, z)); }
    bunch.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strs), new THREE.LineBasicMaterial({ color: '#777777' })));
    live(bunch);
    R.anims.push((dt, t) => { bunch.rotation.y = Math.sin(t * 0.6) * 0.25; bunch.rotation.z = Math.sin(t * 1.1) * 0.04; });
    void seller;
  }
  R.strollPts = [V(103.4, 0, -7.6), V(107.8, 0, -13.6), V(101.6, 0, -12.8), V(109.2, 0, -8.0), V(98.6, 0, -2.0), V(86.0, 0, -0.9), V(93.0, 0, -19.6), V(96.4, 0, -40.6)];

  // --- giriş kilidi: kapı, gişe, atlıkarınca ---
  R.activate = (instant) => {
    if (!G.walkways.lunapark) { G.walkways.push(APRON); G.walkways.lunapark = true; }
    tease.remove(closed);
    put(makeGate(R.flags), 93, 1.2, 0, instant);
    rcol(R, 88.6, 90.2, 0.4, 2.0); rcol(R, 95.8, 97.4, 0.4, 2.0);
    put(makeTicketBooth(R.flags), BOOTH.x, BOOTH.z, 0, instant);
    rcol(R, BOOTH.x - 1.32, BOOTH.x + 1.32, BOOTH.z - 1.1, BOOTH.z + 1.25);
    npc(BOOTH.x, BOOTH.z - 0.35, 0, { shirt: RED, pants: '#2b2f3a', hat: 'cap', hatColor: CREAM });
    R.gatePile = new MoneyPile(C, BOOTH.x, BOOTH.z + 1.22, 1.07, { instant, desk: false, body: [BOOTH.x - 1.32, BOOTH.x + 1.32, BOOTH.z - 1.1, BOOTH.z + 1.25] });
    R.booth = {
      queue: [],
      slot: (i) => V(BOOTH.x - i * 0.8, 0, BOOTH.z + 1.85),
      join(c) { this.queue.push(c); c.path = [this.slot(this.queue.length - 1)]; c.state = 'ticketQ'; c.t = 0; },
      sell(c) {
        this.queue.shift(); this.queue.forEach((q, i) => { q.path = [this.slot(i)]; });
        const fee = Math.round(FEE.bilet * mult()), at = c.obj.position.clone();
        R.gatePile.add(fee, at); floatText(at.setY(1.8), `🎟️ +${fee} ₺`, 'pos'); sfx('cash', { at, npc: true });
        G.stats.customers++;
        c.plan = plan();
        next(c);
      },
    };
    // atlıkarınca
    const car = makeCarousel(R.flags); put(car.g, 93, -11, 0, instant);
    ring(93, -11, 5.15);
    const ride = new Ride(R, { id: 'atli', icon: '🎠', fee: FEE.atli, seats: car.seats, gate: V(93.6, 0, -5.5), qdir: V(1, 0, 0), exit: V(93, 0, -16.7), look: PI, pad: [92.8, -4.1], instant, legX: -0.25, legZ: 0.3 });
    operator(ride, 92.4, -5.55, RED, instant); oldKiosk(87.6, -5.0, 0);
    let w = 0, rt = 0;
    ride.start = () => { rt = 0; };
    ride.run = (dt) => {
      rt += dt; const T2 = 16; w = 0.75 * Math.min(1, rt / 3, Math.max(0, (T2 - rt) / 3));
      if (w > 0.5 && Math.random() < dt * 0.35) LS.laugh(V(93, 1, -11)); // orgu calgi.js çalar; arada çocuk gülüşü
      return rt >= T2;
    };
    // G.carouselW: atlıkarınca dönerken org tam sesle çalar (calgi.js)
    ride.anim = (dt) => { fadeTo(car.fade, G.onRide && ride.riders.some((r) => r.c === ME), dt); if (ride.phase !== 'run') w = 0; G.carouselW = w; car.rotor.rotation.y += w * dt; const k = Math.min(1, w / 0.4); for (const h of car.horses) h.g.position.y = h.y0 + Math.sin(R.t * 2.4 + h.ph) * 0.22 * k; };
    hint(93, 4.2, 2.2, '🎡', 'Lunapark', 'Ziyaretçi gişede bilet alır, eğlencelere biner, tezgâhtan alışveriş yapar. Bütün gelir girişteki gişenin kasasında toplanır.', 9);
    R.spawnT = instant ? 6 : 3;
  };

  // --- kademeler (expand.js defineExpansion: build → R.addX) ---
  R.addWheel = (instant) => {
    const ride = new Ride(R, { id: 'dolap', icon: '🎡', fee: FEE.dolap, seats: [], gate: V(104, 0, -34.7), qdir: V(-1, 0, 0), exit: V(107.0, 0, -34.7), look: PI, pad: [104.8, -33.3], instant });
    operator(ride, 105.3, -35.3, PURPLE, instant); oldKiosk(97.0, -33.0, -PI / 2);
    const cols = [RED, YEL, BLUE, GREEN, PINK, ORANGE, TEAL, PURPLE, '#ffffff', '#ff5e6c'];
    for (let i = 0; i < GONDOLAS; i++) {
      const a = (i / GONDOLAS) * TAU, gd = makeGondola(cols[i]);
      gd.g.position.set(Math.cos(a) * WR, Math.sin(a) * WR, 0); wheel.rotor.add(gd.g);
      if (!instant) popIn(gd.g, i * 0.05);
      wheel.gondolas.push(gd.g); ride.seats.push(...gd.seats); gd.g.userData.seats = gd.seats; gd.g.userData.a = a;
    }
    // ışıklar: iki jant ve iç halka gökkuşağı, ayaklarda sarı
    const rim = [];
    for (const z of [-0.72, 0.72]) for (const [r, n] of [[WR, 56], [WR * 0.55, 28]]) for (let i = 0; i < n; i++) { const a = (i / n) * TAU; rim.push(V(Math.cos(a) * r, Math.sin(a) * r, z)); }
    bulbsRainbow(wheel.rotor, rim);
    bulbs(wheel.g, [...line(V(-4.2, 0.6, 1.7), V(-0.2, 9.6, 1.0), 14), ...line(V(4.2, 0.6, 1.7), V(0.2, 9.6, 1.0), 14)]);
    let gi = -1, target = null, a0 = 0, rt = 0, last = 'idle';
    const seatsOf = (i) => wheel.gondolas[i].userData.seats;
    ride.freeSeat = () => (gi >= 0 && target === null ? seatsOf(gi).find((s) => !ride.riders.some((r) => r.seat === s)) || null : null);
    ride.start = () => { a0 = wheel.rotor.rotation.z; rt = 0; };
    const WC = wheel.g.position.clone().setY(WH); // ses: göbekten
    ride.run = (dt) => {
      rt += dt; const k = Math.min(1, rt / 24); wheel.rotor.rotation.z = a0 + TAU * (k - Math.sin(k * TAU) / TAU);
      if (Math.random() < dt * 0.3) LS.creak(WC, 0.7);
      return k >= 1;
    };
    ride.anim = (dt) => {
      const r = wheel.rotor;
      if (ride.phase === 'load' && last !== 'load') {
        // en alttaki kabin binişe gelir
        let best = Infinity;
        for (let i = 0; i < GONDOLAS; i++) { const d = wrap(-PI / 2 - (wheel.gondolas[i].userData.a + r.rotation.z)); if (Math.abs(d) < Math.abs(best)) { best = d; gi = i; } }
        target = r.rotation.z + best;
      }
      if (ride.phase === 'idle') { r.rotation.z += 0.05 * dt; gi = -1; target = null; }
      if (target !== null) { const d = target - r.rotation.z, st = 0.5 * dt; if (Math.abs(d) <= st) { r.rotation.z = target; target = null; } else r.rotation.z += Math.sign(d) * st; }
      last = ride.phase;
      LS.loopLevel('dolap', 'motor', WC, ride.phase === 'run' ? 1 : target !== null ? 0.6 : 0.15); // motor: dönerken, kabin binişe gelirken
      for (const gd of wheel.gondolas) gd.rotation.z = -r.rotation.z;
    };
  };
  R.addFood = (instant) => {
    const defs = [['patlamis', RED, 'PATLAMIŞ MISIR', 'kocan'], ['pamuk', PINK, 'PAMUK ŞEKER', null], ['dondurma', TEAL, 'DONDURMA', 'sut']];
    defs.forEach(([type, col, label, inType], i) => {
      const z = FOOD_Z[i], st = makeStall(col, label, type);
      put(st.g, FOOD_X, z, PI / 2, instant);
      rcol(R, FOOD_X - 1.05, FOOD_X + 1.3, z - 1.6, z + 1.6);
      npc(FOOD_X - 0.3, z + 0.2, PI / 2, { shirt: '#ffffff', pants: '#3a3f4a', hat: 'cap', hatColor: col });
      const outO = { type, interval: inType ? 3.4 : 6.5, max: 6, origin: V(FOOD_X + 0.2, 1.6, z), tray: [FOOD_X + 0.95, 1.03, z - 0.7], zx: FOOD_X - 0.4, zz: z - 0.7, zw: 0.5, zd: 0.5, instant };
      let out, conv = null;
      if (inType) {
        put(M.rbox(0.9, 0.62, 0.9, 0.06, M.mat('#ffffff', { map: texRep('wood', 0.5, 0.5) })), FOOD_X + 1.75, z + 0.85, 0, instant, 0.31);
        rcol(R, FOOD_X + 1.3, FOOD_X + 2.2, z + 0.4, z + 1.3);
        conv = new Converter(C, { inType, inCap: 8, ix: FOOD_X + 2.9, iz: z + 0.85, iw: 1.2, id: 1.2, inTray: [FOOD_X + 1.75, 0.66, z + 0.85], instant, out: outO });
        conv.inTray.rotation.y = PI / 2;
        out = conv.out;
        G.xsink.push({ type: inType, conv, pri: 3 });
        hint(FOOD_X + 2.0, 3.6, z + 0.6, `${T.icon(inType)}→${T.icon(type)}`, label.charAt(0) + label.slice(1).toLocaleLowerCase('tr'), `${ITEMS[inType].name} getir, tezgâhın önündeki kasaya bırak. Tezgâh ${ITEMS[type].name.toLocaleLowerCase('tr')} yapar, ziyaretçiler alır.`, 4);
      } else out = new Generator(C, outO);
      out.bodyFn = () => []; // tepsideki ürün ziyaretçinin: oyuncu almaz
      out.tray.rotation.y = PI / 2;
      R.stalls.push({ type, out, conv, at: V(FOOD_X + 2.45, 0, z - 0.7) });
    });
    legacy(FOOD_X + 0.95, FOOD_Z[1] + 0.7); // tezgâhların eski kasası
  };
  R.addBumper = (instant) => {
    const rink = put(makeRink(R.flags), 82, -24.2, 0, instant);
    rcol(R, 76.3, 87.7, -28.5, -19.9);
    const cars = [], cols = [RED, BLUE, YEL, GREEN, PINK, ORANGE];
    for (let i = 0; i < 6; i++) {
      const bc = makeBumperCar(cols[i]), park = { x: 77.6, z: -27.4 + i * 1.45, h: PI / 2 };
      bc.g.position.set(park.x, 0.16, park.z); bc.g.rotation.y = park.h; C.add(bc.g); if (!instant) popIn(bc.g, i * 0.05);
      cars.push({ g: bc.g, seat: bc.seat, park, x: park.x, z: park.z, h: park.h, v: 0, turn: 0, tt: 0 });
    }
    const ride = new Ride(R, { id: 'carpisan', icon: '🚗', fee: FEE.carpisan, seats: cars.map((c) => c.seat), gate: V(88.3, 0, -24.2), qdir: V(0, 0, 1), exit: V(88.4, 0, -27.7), look: -PI / 2, pad: [89.7, -25.0], instant });
    operator(ride, 88.25, -25.4, BLUE, instant); oldKiosk(88.7, -29.9, PI / 2);
    // yalnız binilen araba pistte gezer (2026-11-02 kullanıcı: "çarpışan arabalar insan olmadan hareket ediyor"); boşlar park yerinde
    // durur, çarpan sürücülü araba onlardan seker
    let rt = 0;
    const busy = (c) => ride.riders.some((r) => r.seat === c.seat);
    const home = (c, dt) => { const k = 1 - Math.exp(-3 * dt); c.x += (c.park.x - c.x) * k; c.z += (c.park.z - c.z) * k; c.h += wrap(c.park.h - c.h) * k; };
    ride.start = () => { rt = 0; for (const c of cars) if (busy(c)) { c.v = rand(1.9, 2.7); c.h = rand(-PI, PI); } };
    let bumpT = 0;
    ride.run = (dt) => {
      rt += dt; bumpT -= dt;
      const mine = ride.riders.find((r) => r.c === ME), inp = G.rideInp;
      for (const c of cars) {
        if (!busy(c)) { home(c, dt); continue; }
        // oyuncunun arabası: yön tuşuna basılıyken o yöne döner ve hızlanır; bırakınca kendi kendine gezer
        if (mine && mine.seat === c.seat && inp && Math.hypot(inp.x, inp.z) > 0.2) { c.h = lerpAngle(c.h, Math.atan2(inp.x, inp.z), 1 - Math.exp(-5 * dt)); c.v = 3.4; c.tt = 0.6; c.turn = 0; }
        else if ((c.tt -= dt) <= 0) { c.tt = rand(0.7, 1.8); c.turn = rand(-1.8, 1.8); }
        c.h += c.turn * dt;
        c.x += Math.sin(c.h) * c.v * dt; c.z += Math.cos(c.h) * c.v * dt;
        if (c.x < 77.2 || c.x > 86.8) { c.x = Math.min(86.8, Math.max(77.2, c.x)); c.h = -c.h; }
        if (c.z < -27.6 || c.z > -20.8) { c.z = Math.min(-20.8, Math.max(-27.6, c.z)); c.h = PI - c.h; }
      }
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), ma = busy(a), mb = busy(b);
        if (d < 1.5 && d > 0.001 && (ma || mb)) {
          const p = (1.5 - d) / (ma && mb ? 2 : 1), nx = dx / d, nz = dz / d; // boş araba yerinden oynamaz
          if (ma) { a.x -= nx * p; a.z -= nz * p; a.h = Math.atan2(-nx, -nz) + rand(-0.4, 0.4); }
          if (mb) { b.x += nx * p; b.z += nz * p; b.h = Math.atan2(nx, nz) + rand(-0.4, 0.4); }
          if (bumpT <= 0) { bumpT = 0.18; LS.bump(a.g.position); } // tampon tokuşması
          if (Math.random() < 0.3) sfx('pop', { at: a.g.position, npc: true });
          const rr = ride.riders.find((q) => q.seat === a.seat || q.seat === b.seat); if (rr && Math.random() < 0.4) say(rr.c, pick(['😆', '💥', '😂']), 1.0);
        }
      }
      const bz = cars.filter(busy); if (bz.length && Math.random() < dt * 0.25) LS.honk(pick(bz).g.position); // korna
      return rt >= 15;
    };
    const RINK = V(82, 0.5, -24.2);
    ride.anim = (dt) => {
      LS.loopLevel('carpisan', 'buzz', RINK, ride.phase === 'run' ? Math.min(1, rt * 2) : 0); // elektrik vızıltısı
      fadeTo(rink.userData.fade, G.onRide && ride.riders.some((r) => r.c === ME), dt);
      if (ride.phase !== 'run') for (const c of cars) home(c, dt);
      for (const c of cars) { c.g.position.set(c.x, 0.16, c.z); c.g.rotation.y = c.h; }
    };
  };
  R.addTents = (instant) => {
    const defs = [[RED, 'ATIŞ POLİGONU', 'atis', '🎯'], [BLUE, 'HALKA AT', 'halka', '⭕'], [GREEN, 'BALON PATLAT', 'balon', '🎈']];
    const minis = []; // oyuncunun oynadığı mini oyunlar (minioyun.js): çadırın önündeki pedde "Oyna"
    defs.forEach(([col, label, kind, ic], i) => {
      const z = TENT_Z[i], tent = makeTent(col, label, kind, R.flags, R.anims);
      put(tent.g, TENT_X, z, -PI / 2, instant);
      rcol(R, TENT_X - 1.9, TENT_X + 1.9, z - 1.95, z + 1.95);
      const att = npc(TENT_X - 0.9, z, -PI / 2, { shirt: col, pants: '#2b2f3a', hat: 'cap', hatColor: '#ffffff' });
      const spots = [-0.75, 0.75].map((dz) => ({ at: V(TENT_X - 2.75, 0, z + dz), face: PI / 2, icon: ic, busy: null, play: tent.play }));
      R.games.push(...spots);
      tent.g.updateMatrixWorld(true);
      const look = tent.api.back.getWorldPosition(V(0, 0, 0)); look.x -= 0.1; look.y = 1.55;
      minis.push({ kind, name: label, icon: ic, api: tent.api, hide: [tent.api.front, tent.api.roof, att], spots, pad: V(TENT_X - 3.7, 0, z), look, half: [1.75, 0.95], dir: V(-1, 0.06, 0) });
    });
    const sk = makeStriker(R.anims); put(sk.g, 108.4, -24.4, -PI / 2, instant);
    rcol(R, 107.6, 109.1, -25.2, -23.6);
    const ss = { at: V(106.7, 0, -24.0), face: PI / 2, icon: '🔨', busy: null, play: sk.play };
    R.games.push(ss);
    // çekiç kulesi çadırların arkasında: kamera güneybatıdan, çadırların üstünden değil yanından bakar
    minis.push({ kind: 'cekic', name: 'ÇEKİÇ GÜCÜ', icon: '🔨', api: sk.api, hide: [], spots: [ss], pad: V(106.0, 0, -26.1), look: V(108.4, 3.2, -24.4), half: [1.4, 3.5], dir: V(-0.45, 0.08, 0.89) });
    legacy(TENT_X - 1.62, TENT_Z[1] - 1.2); // çadırların eski kasası
    setupMinigames(R, minis, instant);
  };
  R.addShip = (instant) => {
    const ship = makeShip(R.flags); put(ship.g, 82, -37.4, 0, instant);
    R.flags.push(ship.flag);
    rcol(R, 75.4, 88.6, -40.0, -34.8);
    const ride = new Ride(R, { id: 'gemi', icon: '🏴‍☠️', fee: FEE.gemi, seats: ship.seats, gate: V(82, 0, -34.2), qdir: V(1, 0, 0), exit: V(78.6, 0, -34.1), look: PI, loadT: 6, pad: [81.2, -32.8], instant, thrill: true });
    operator(ride, 80.75, -34.4, '#7a3b2e', instant); oldKiosk(89.0, -32.6, PI / 2);
    let rt = 0;
    ride.start = () => { rt = 0; };
    const SC = V(82, 3.5, -37.4); let wv = 0;
    ride.run = (dt) => {
      rt += dt; const T2 = 18, amp = 0.9 * Math.min(1, rt / 6, Math.max(0, (T2 - rt) / 6));
      const a0 = ship.swing.rotation.z, a1 = amp * Math.sin((rt * TAU) / 3.8), w1 = dt > 0 ? (a1 - a0) / dt : 0;
      ship.swing.rotation.z = a1;
      // tepede dönüş: gıcırtı, yükseldiyse aşağı inerken çığlık; savrulurken rüzgâr uğultusu hızla artar
      if (wv * w1 < 0) { LS.creak(SC, amp); if (amp > 0.5 && Math.random() < 0.8) LS.scream(SC, Math.min(4, 1 + Math.ceil(ride.riders.length / 3)), amp); }
      wv = w1;
      LS.loopLevel('gemi', 'whoosh', SC, Math.min(1, Math.abs(w1) / 1.4));
      if (amp > 0.6 && Math.random() < dt * 0.5 && ride.riders.length) say(pick(ride.riders).c, pick(['😱', '🙀', '🤢', '😆']), 1.1);
      return rt >= T2;
    };
    ride.anim = () => { if (ride.phase !== 'run') { ship.swing.rotation.z = Math.sin(R.t * 0.9) * 0.015; LS.loopLevel('gemi', 'whoosh', SC, 0); } };
  };
  R.addCoaster = (instant) => {
    put(makeCoaster(R.flags), 0, 0); // dünya koordinatında kurulu: belirme ölçeği dünya merkezinden olmasın
    rcol(R, 76.0, 110.0, -55.6, -46.6);
    for (const x of [88.2, 97.8]) rcol(R, x - 0.16, x + 0.16, -45.2, -44.9);
    const cars = [], seats = [];
    for (let i = 0; i < 3; i++) { const cc = makeCoasterCar([RED, YEL, BLUE][i], i === 0); C.add(cc.g); if (!instant) popIn(cc.g, i * 0.08); cars.push(cc.g); seats.push(...cc.seats); }
    const ride = new Ride(R, { id: 'tren', icon: '🎢', fee: FEE.tren, seats, gate: V(97.6, 0, -45.7), qdir: V(1, 0, 0), exit: V(89.0, 0, -45.6), look: PI, loadT: 6, pad: [96.8, -44.3], instant, thrill: true });
    operator(ride, 96.35, -45.95, PURPLE, instant); oldKiosk(103.6, -44.0, 0);
    let s = 0, v = 0;
    const p = V(0, 0, 0), q = V(0, 0, 0);
    ride.meSeat = () => seats.slice(0, 2).find((st) => !ride.riders.some((r) => r.seat === st)); // oyuncu en öndeki vagona
    let clk = 0;
    ride.start = () => { v = 0.4; };
    ride.run = (dt) => {
      const y = coY(s), s0 = s, at = cars[0].position;
      if (s < 5) v = Math.min(2.2, v + 1.5 * dt);
      else if (s < 12.6) v = 2.4;
      else if (s > 66) v = Math.max(0.9, Math.min(v, (CO_L - s) * 0.6 + 0.6));
      else v = Math.max(3.0, Math.sqrt(2 * 9.8 * Math.max(0, 7.9 - y)) * 0.9);
      s += v * dt;
      if (s > 25.5 && s < 31 && Math.random() < dt * 2 && ride.riders.length) say(pick(ride.riders).c, pick(['😱', '🙀', '🤩']), 1.2);
      // ses: zincirli yokuşta tıkırtı, rayda hızla artan gürültü, büyük inişte hep birlikte, ikincide birkaç kişi çığlık, sonda fren
      if (s > 5 && s < 12.6 && (clk -= dt) <= 0) { clk = 0.17; LS.clack(at); }
      if (s0 < 25.7 && s >= 25.7) LS.scream(at, Math.min(5, 2 + ride.riders.length), 1.15);
      if (s0 < 38.4 && s >= 38.4) LS.scream(at, 2, 0.8);
      if (s0 < 66 && s >= 66) LS.brake(at);
      LS.loopLevel('tren', 'rumble', at, Math.min(1, v / 9));
      if (s >= CO_L) { s = 0; LS.loopLevel('tren', 'rumble', at, 0); return true; }
      return false;
    };
    ride.anim = () => {
      cars.forEach((g, i) => { coP(s - i * 1.55, p); coP(s - i * 1.55 + 0.25, q); g.position.set(p.x, p.y + 0.12, p.z); g.lookAt(q.x, q.y + 0.12, q.z); });
    };
    ride.anim();
  };

  // ---------- ziyaretçiler ----------
  const attractions = () => R.rides.length + (R.stalls.length ? 1 : 0) + (R.games.length ? 1 : 0);
  function plan() {
    const opts = [...R.rides.map((r) => r.id), ...(R.stalls.length ? ['food', 'food'] : []), ...(R.games.length ? ['game'] : [])];
    const k = Math.min(opts.length, 2 + Math.floor(Math.random() * 3)), out = [];
    while (out.length < k && opts.length) { const a = opts.splice(Math.floor(Math.random() * opts.length), 1)[0]; if (!out.includes(a)) out.push(a); }
    if (out.length < 3 && Math.random() < 0.6) out.splice(Math.floor(Math.random() * (out.length + 1)), 0, 'stroll');
    return out;
  }
  function next(c) {
    c.ride = null; c.t = 0; c.wait = 0;
    const a = c.plan.shift();
    if (!a) { c.path = [GATE_IN.clone(), GATE_OUT.clone(), ROADP.clone(), FAR.clone().setZ(FAR.z + rand(-0.3, 0.3))]; c.state = 'leave'; return; }
    if (a === 'food') {
      const s = R.stalls.slice().sort((x, y) => y.out.items.length - x.out.items.length + rand(-1.5, 1.5))[0];
      c.stall = s; c.path = [s.at.clone().add(V(rand(-0.2, 0.3), 0, rand(-0.3, 0.3)))]; c.state = 'food'; return;
    }
    if (a === 'game') {
      const free = R.games.filter((g) => !g.busy && !g.locked); // oyuncu mini oyun oynarken o tezgâh kilitli (minioyun.js)
      if (!free.length) { next(c); return; }
      const g = pick(free); g.busy = c; c.spot = g; c.path = [g.at.clone()]; c.state = 'game'; return;
    }
    if (a === 'stroll') { c.path = [pick(R.strollPts).clone().add(V(rand(-0.6, 0.6), 0, rand(-0.6, 0.6)))]; c.state = 'stroll'; c.linger = rand(2.5, 5); return; }
    const ride = R.rides.find((r) => r.id === a);
    if (ride) ride.join(c); else next(c);
  }
  function think(c, dt) {
    if (c.bubbleT > 0 && (c.bubbleT -= dt) <= 0) c.clearBubble();
    switch (c.state) {
      case 'arrive': if (c.walk(dt)) R.booth.join(c); break;
      case 'ticketQ':
        c.walk(dt);
        if (!c.path.length && R.booth.queue[0] === c) { c.face(PI, dt); if ((c.t += dt) > 1.3) R.booth.sell(c); }
        break;
      case 'rideQ':
        c.walk(dt); c.wait += dt;
        if (!c.path.length) c.face(c.ride.look, dt);
        if (c.wait > 60) { c.ride.leaveQ(c); say(c, '😕'); next(c); }
        break;
      case 'riding': break;
      case 'afterRide': if (c.walk(dt)) next(c); break;
      case 'food': {
        if (!c.walk(dt)) break;
        const s = c.stall;
        c.face(-PI / 2, dt); c.t += dt;
        if (s.out.items.length && c.t > 0.6) {
          c.stack.push(s.type, s.out.items.pop());
          const price = Math.round(ITEMS[s.type].price * 1.25 * mult()), at = c.obj.position.clone();
          R.till(price); floatText(at.setY(1.8), `+${price} ₺`, 'pos'); sfx('cash', { at, npc: true });
          G.stats.sold++;
          next(c);
        } else if (c.t > 9) { say(c, '😕'); next(c); }
        break;
      }
      case 'game': {
        if (!c.walk(dt)) break;
        const g = c.spot;
        c.face(g.face, dt);
        if (c.t === 0) say(c, g.icon, 3.0);
        c.t += dt;
        if (c.t > 1.4 && !c.played) { c.played = true; g.play(); }
        if (c.t > 3.6) {
          const fee = Math.round(FEE.oyun * mult()), at = c.obj.position.clone();
          R.till(fee); floatText(at.setY(1.8), `${g.icon} +${fee} ₺`, 'pos');
          if (Math.random() < 0.35 && !c.prize) {
            c.prize = makeTeddy(pick([PINK, BLUE, YEL, GREEN, PURPLE])); c.prize.scale.setScalar(0.55); c.prize.position.set(0.3, 0.75, 0.22); c.obj.add(c.prize);
            say(c, '🧸 Kazandım!', 1.8); sfx('happy', { at, npc: true });
          }
          g.busy = null; c.spot = null; c.played = false;
          next(c);
        }
        break;
      }
      case 'stroll': if (c.walk(dt) && (c.linger -= dt) <= 0) next(c); break;
      case 'leave': if (c.walk(dt)) { c.destroy(); const i = R.visitors.indexOf(c); if (i >= 0) R.visitors.splice(i, 1); } break;
    }
  }
  function spawn() {
    const kid = Math.random() < 0.25, c = new Customer(FAR.clone().setZ(FAR.z + rand(-0.4, 0.4)), 'lunapark', Math.random() < 0.5 ? M.touristLook() : M.randomLook());
    if (kid) c.obj.scale.setScalar(0.74);
    c.speed = rand(2.4, 3.1); c.plan = []; c.bubbleT = 0;
    c.path = [ROADP.clone(), GATE_OUT.clone(), GATE_IN.clone()];
    c.state = 'arrive';
    c.think = (dt) => think(c, dt);
    R.visitors.push(c);
  }

  R.update = (dt) => {
    R.t += dt;
    const on = Math.floor(R.t * 2.5) % 2;
    for (const s of SETS) { s[0].emissiveIntensity = on ? 1.6 : 0.35; s[1].emissiveIntensity = on ? 0.35 : 1.6; }
    for (const f of R.flags) f.rotation.y = Math.sin(R.t * 3 + f.userData.ph) * 0.35;
    for (const n of R.npcs) M.animateCharacter(n, 0, dt, false);
    for (const a of R.anims) a(dt, R.t);
    for (const r of R.rides) r.update(dt);
    for (const p of R.legacy) if (p.amount > 0) { R.till(p.amount); p.amount = 0; }
    if (R.minis) updateMinigames(dt);
    if ((R.spawnT -= dt) <= 0) {
      const n = attractions();
      R.spawnT = (9 / (1 + 0.32 * n)) * rand(0.75, 1.25);
      if (R.visitors.length < Math.min(24, 6 + 3 * n)) spawn();
    }
  };
  T.registerIntro && T.registerIntro('gl', { text: 'Lunapark açıldı! Nehrin ötesindeki çayırda kasabanın en büyük eğlence yeri kuruluyor.', steps: [
    ['🎟️', `Ziyaretçi doğudan caddeyle gelir, gişede ${FEE.bilet} ₺ bilet alır.`],
    ['🎠', 'Her eğlencenin başında bir operatör durur. Bilet, eğlence, tezgâh ve oyun parası girişteki gişenin kasasında toplanır.'],
    ['🎡', 'İçerisi aldıkça büyür: dönme dolap, tezgâhlar, çarpışan arabalar, oyun çadırları, korsan gemisi, hız treni.'],
  ] });
  return R;
}

// ---------- kademeler ----------
// taban fiyat: oyun ×2 (PRICE_K) ve ×1,25 (zorluk, world.js) uygular → ekranda 30 / 20 / 45 / 35 / 60 / 120 bin ₺
const TIERS = [
  { id: 'xluna1', tier: 1, icon: '🎡', title: 'Dönme Dolap', price: 12000, at: [97.8, -35.4], fn: 'addWheel', info: { text: 'Dev dönme dolap ışıl ışıl döndü!', steps: [['🎡', `On kabin, kabinde dört kişi. Binen ${FEE.dolap} ₺ öder; para gişedeki kasaya gider.`]] } },
  { id: 'xluna2', tier: 2, icon: '🍿', title: 'Yiyecek Tezgâhları', price: 8000, at: [85.2, -11.2], fn: 'addFood', info: { text: 'Tezgâhlar açıldı: patlamış mısır, pamuk şeker, dondurma.', steps: [['kocan', 'Koçanı mısır tezgâhının önündeki kasaya, sütü dondurmacının kasasına bırak (taşıyıcılar da getirir).'], ['pamuk', 'Pamuk şeker kendi şekeriyle yapılır. Ziyaretçi tezgâhtan alır, para gişedeki kasaya gider.']] } },
  { id: 'xluna3', tier: 3, icon: '🚗', title: 'Çarpışan Arabalar', price: 18000, at: [89.0, -22.6], fn: 'addBumper', info: { text: 'Çarpışan arabalar pistte!', steps: [['🚗', `Altı araba, binen ${FEE.carpisan} ₺ öder.`]] } },
  { id: 'xluna4', tier: 4, icon: '🎯', title: 'Oyun Çadırları', price: 14000, at: [97.6, -22.6], fn: 'addTents', info: { text: 'Oyun çadırları kuruldu: atış poligonu, halka at, balon patlat ve çekiç gücü.', steps: [['🎯', `Oynayan ${FEE.oyun} ₺ öder, kazanan ayıcık kapar. Para gişedeki kasaya gider.`]] } },
  { id: 'xluna5', tier: 5, icon: '🏴‍☠️', title: 'Korsan Gemisi', price: 24000, at: [88.4, -36.6], fn: 'addShip', info: { text: 'Korsan gemisi sallanmaya başladı!', steps: [['🏴‍☠️', `On kişilik tekne, binen ${FEE.gemi} ₺ öder.`]] } },
  { id: 'xluna6', tier: 6, icon: '🎢', title: 'Hız Treni', price: 48000, at: [93, -44.0], fn: 'addCoaster', info: { text: 'Hız treni açıldı: lunaparkın en büyük eğlencesi!', steps: [['🎢', `Zincirli tepe, büyük iniş, iki tümsek. Binen ${FEE.tren} ₺ öder.`]] } },
];
for (const d of TIERS) defineExpansion({ id: d.id, region: 'lunapark', tier: d.tier, icon: d.icon, title: d.title, price: d.price, rect: null, at: d.at, info: d.info, build: (ctx) => LR && LR[d.fn](ctx.instant) });
