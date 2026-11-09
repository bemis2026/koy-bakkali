// Martı Adası'nın karası ve yapıları. Tatil (sıkılma, acente, yolculuk) tatil.js'te, adanın canlıları ve hizmetleri adacanli.js'te.
// 2026-11-03 kullanıcı: "Tatil adasına büyük cruise gemisi ile gidelim... Adada otantik taş evler olsun. Ayrıca ada botanik açıdan çok
// zengin olsun. Dağlık kısımları olsun yukarıya da tırmanabilelim." Seçimler: gemi yolculuğu sahnesi, modeller kodla çizilir.
// Ada x 900'de, 124 x 100 m: güneyde hilal kumsal, ortada taş evli köy ve meydan, batıda botanik bahçe ve flamingo gölü, kuzeyde
// patikayla çıkılan 19 m'lik dağ (zirve düzlüğünde taş kale), doğu sırtında taş yel değirmeni, doğuda gemi iskelesi.
// Yükseklik ground(x, z); world.js heightAt ve walkable bunu G.isle üzerinden okur (adacanli.js), engeller blocked(x, z).
// Bitki ve kayalar tür başına birkaç InstancedMesh; evler, gemi ve donatı malzeme başına tek geometride birleşir: az çizim, az bellek
// (telefonda ekran kartı belleği dolunca nesneler siyaha dönüyordu, perf.js 2026-11-03). perf.js bunlara dokunmaz (userData.bkNo).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as M from './models.js';
import { rand } from './game.js';
import { texRep } from './tex.js';

const PI = Math.PI;
export const IX = 900, IZ = 0;
const AX = 62, AZ = 50;
const PEAK = { x: 902, z: -25, h: 19, s: 13 }, RIDGE = { x: 931, z: -17, h: 6.5, s: 8 }, LAGOON = { x: 848, z: 4, h: -2.1, s: 4.6 };
export const CASTLE = { x: 904.6, z: -21.2 }; // zirve düzlüğünün güney kenarındaki kale
export const SUMMIT = { x: PEAK.x, z: PEAK.z }, LAKE = { x: LAGOON.x, z: LAGOON.z }, SQUARE = { x: 903, z: 12 }, MILL = { x: RIDGE.x, z: RIDGE.z };
export const JETTY = { x0: 959, x1: 1006, z: 10, w: 2.4, y: 0.63 };
export const SHIP_DOCK = { x: 990, z: 4.4 };
// 2026-11-04 (kullanıcı: "tatile gitme yerini geliştir"): doğu kumsalında denize uzanan güvertede balık restoranı, kuzeydoğu
// burnunda deniz feneri ve bekçi evi, zirvenin batısında yamaç paraşütü kalkış yeri (iniş doğu kumsalında, restoranın güneyinde)
export const TAVERN = { x0: 953, x1: 965.5, z0: -11.5, z1: -2.5, y: 0.62 }; // güvertenin üstü yürünür (adacanli.js G.isle)
export const GLIDE = { x: 896.5, z: -28.5, lx: 950, lz: -15 }; // kalkış ve iniş
// 2026-11-04 (kullanıcı: "Sahile 1-2 tane salaş bohem tarzda cafe ekleyebilirsin"): batı kumsalında gün batımına bakan Gün Batımı
// Kafe, doğuda restoranla iskele arasında Salaş Kafe (CAFES, cafe())

// ---------- arazi ----------
const wob = (a) => 1 + 0.06 * Math.sin(3 * a + 1.2) + 0.04 * Math.sin(5 * a - 0.7) + 0.025 * Math.sin(9 * a + 2.1);
// kıyıya göre uzaklık: 1 kıyı çizgisi, 0 adanın ortası
export function edge(x, z) { const dx = (x - IX) / AX, dz = (z - IZ) / AZ; return Math.hypot(dx, dz) / wob(Math.atan2(dz, dx)); }
const bump = (x, z, P) => P.h * Math.exp(-((x - P.x) ** 2 + (z - P.z) ** 2) / (2 * P.s * P.s));
function rawGround(x, z) {
  const e = edge(x, z);
  let h = e < 1 ? 0.12 + Math.pow(1 - e, 0.8) * 1.5 : 0.12 - (e - 1) * 7; // kumsal düz, içeri hafif yükselir; kıyıdan sonra deniz yavaş derinleşir
  h += bump(x, z, PEAK) + bump(x, z, RIDGE) + bump(x, z, LAGOON);
  if (e < 0.9) h += 0.3 * Math.sin(x * 0.23 + 1) * Math.cos(z * 0.19) * Math.min(1, (0.9 - e) * 5);
  return Math.max(-3.2, h);
}
// 2026-11-08 kullanıcı: "adanın zirvesindeki kaleyi daha iyi konumlandır ... biraz daha yükselt adanın zirvesini": dağ 15 m'den 19 m'ye
// çıktı; tepesi kalenin oturduğu düzlük: TOP.r içinde sabit yükseklik, kenarında TOP.b metrede yamaca yumuşakça karışır
const TOP = { x: 903, z: -23.5, r: 5.5, b: 3, h: 0 };
TOP.h = rawGround(TOP.x, TOP.z) - 1.1;
export function ground(x, z) {
  const h = rawGround(x, z), d = Math.hypot(x - TOP.x, z - TOP.z);
  if (d >= TOP.r + TOP.b) return h;
  const k = d <= TOP.r ? 1 : 1 - (d - TOP.r) / TOP.b;
  return h + (TOP.h - h) * k * k * (3 - 2 * k);
}
// kumsalda açı (0 doğu, π/2 güney) ve kıyı uzaklığına göre yer; ry denize bakış (önü +z olan nesne için)
export function polar(th, e) {
  const c = Math.cos(th), s = Math.sin(th), w = wob(th) * e, nx = c / AX, nz = s / AZ, n = Math.hypot(nx, nz);
  return { x: IX + c * AX * w, z: IZ + s * AZ * w, ry: Math.atan2(nx / n, nz / n) };
}
// yürüyüş yolları: kumsaldan meydana, meydandan zirveye, iskeleye, botanik bahçeye
export const PATHS = [
  [[902, 40], [903, 24], [903, 12]],
  [[903, 12], [913, 2], [920, -8], [915, -16], [903, -14], [893, -19], [892, -28], [900, -33], [903, -27], [902, -25.5]],
  [[903, 12], [925, 12], [945, 11], [962, 10]],
  [[903, 12], [884, 12], [868, 10], [858, 6]],
];
export const ROUTE_UP = PATHS[0].concat(PATHS[1].slice(1)); // kumsaldan zirveye (yürüyüşçüler)
const SEGS = [];
for (const P of PATHS) for (let i = 1; i < P.length; i++) SEGS.push([P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]]);
export function pathDist(x, z) {
  let best = 1e9;
  for (const [ax, az, bx, bz] of SEGS) {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < best) best = d;
  }
  return best;
}

// ---------- engeller: ev, ağaç gövdesi, büyük kaya, tezgâh (4 m'lik hücrelerde) ----------
const OBS = new Map(), OC = 4;
const cellsOf = (x, z, R, fn) => { for (let i = Math.floor((x - R) / OC); i <= Math.floor((x + R) / OC); i++) for (let j = Math.floor((z - R) / OC); j <= Math.floor((z + R) / OC); j++) fn(i * 4096 + j); };
// o: { x, z, r } daire ya da { x, z, hw, hd, ry } döndürülmüş kutu
export function obsAdd(o) {
  if (o.ry != null) { o.c = Math.cos(o.ry); o.s = Math.sin(o.ry); }
  cellsOf(o.x, o.z, (o.r ?? Math.hypot(o.hw, o.hd)) + 0.8, (k) => { let l = OBS.get(k); if (!l) OBS.set(k, (l = [])); l.push(o); });
}
export function blocked(x, z, pad = 0.3) {
  const l = OBS.get(Math.floor(x / OC) * 4096 + Math.floor(z / OC));
  if (!l) return false;
  for (const o of l) {
    const dx = x - o.x, dz = z - o.z;
    if (o.r != null) { if (dx * dx + dz * dz < (o.r + pad) ** 2) return true; continue; }
    const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
    if (Math.abs(lx) < o.hw + pad && Math.abs(lz) < o.hd + pad) return true;
  }
  return false;
}

// ---------- geometri yardımcıları ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);
// parça: önce ölçek, sonra dönüş (önce z, sonra y, sonra x ekseni), sonra yer
export function part(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
}
export const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const CYL = (rt, rb, h, n = 7) => new THREE.CylinderGeometry(rt, rb, h, n);
export const CONE = (r, h, n = 7) => new THREE.ConeGeometry(r, h, n);
export const BALL = (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h);
const ICO = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
// birleştirmeye hazır: indeksli, yalnız konum-normal-uv
function clean(g) {
  if (!g.index) { const n = g.attributes.position.count, a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(new THREE.BufferAttribute(a, 1)); }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.clearGroups();
  return g;
}
const mg = (gs) => mergeGeometries(gs.map(clean), false);
export const merge = mg;
// malzeme başına tek geometri: parçalar toplanır, build() her malzemeye bir Mesh kurar
export class Kit {
  constructor() { this.by = new Map(); }
  add(geo, m) { let l = this.by.get(m); if (!l) this.by.set(m, (l = [])); l.push(geo); return this; }
  build(parent, cast = true) {
    for (const [m, gs] of this.by) {
      const mesh = new THREE.Mesh(gs.length === 1 ? clean(gs[0]) : mg(gs), m);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.userData.bkNo = true; mesh.userData.sd = true;
      parent.add(mesh);
    }
    this.by.clear();
    return parent;
  }
}
// ev, tezgâh gibi bir yapının çerçevesi: yerel parçayı (önü +z) dünyaya taşır
export function frame(x, y, z, ry) {
  const F = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_up, ry), new THREE.Vector3(1, 1, 1));
  const f = (geo, lx = 0, ly = 0, lz = 0, rx = 0, rry = 0, rz = 0) => part(geo, lx, ly, lz, rx, rry, rz).applyMatrix4(F);
  f.at = (lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)]; // yerelden dünyaya (x, z)
  return f;
}

// ---------- bitkiler: tür başına birkaç InstancedMesh, örnek başına renk oynaması ----------
const FM = new Map();
const fmat = (flat) => { if (!FM.has(flat)) FM.set(flat, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: flat })); return FM.get(flat); };
class Flora {
  constructor(parts) { this.parts = parts; this.at = []; }
  put(x, z, s = 1, ry = rand(0, PI * 2)) { this.at.push([x, ground(x, z) - 0.04 * s, z, ry, s]); return this; }
  build(root) {
    const n = this.at.length;
    if (!n) return;
    for (const P of this.parts) {
      const im = new THREE.InstancedMesh(P.g, fmat(P.flat !== false), n);
      this.at.forEach(([x, y, z, ry, s], i) => {
        im.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_up, ry), _s.set(s, s, s)));
        im.setColorAt(i, _c.set(P.c).offsetHSL(P.jit ? rand(-0.015, 0.015) : 0, 0, P.jit ? rand(-P.jit, P.jit) : 0));
      });
      im.castShadow = P.cast !== false; im.receiveShadow = true;
      im.computeBoundingSphere(); im.userData.bkNo = true; im.userData.sd = true;
      root.add(im);
    }
  }
}
// yaprak: koni tabanı gövdede, ince yassı, d kadar sarkar, a yönüne bakar
function frond(r, h, d, a, x, y, z, thin = 0.22) { const g = CONE(r, h, 4); g.translate(0, h / 2, 0); g.scale(thin, 1, 1); return part(g, x, y, z, 0, a, -(PI / 2 + d)); }
function palmP(lean) {
  const tr = [], lf = [], nut = [], H = 5.0, n = 5;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, x0 = lean * t0 * t0, x1 = lean * t1 * t1, y0 = H * t0, y1 = H * t1;
    tr.push(part(CYL(0.15 - 0.015 * i, 0.18 - 0.015 * i, Math.hypot(x1 - x0, y1 - y0) * 1.06, 6), (x0 + x1) / 2, (y0 + y1) / 2, 0, 0, 0, -Math.atan2(x1 - x0, y1 - y0)));
  }
  for (let k = 0; k < 8; k++) lf.push(frond(0.42, 2.7, 0.3 + (k % 2) * 0.3, (k / 8) * PI * 2 + 0.3, lean, H - 0.05, 0));
  for (let k = 0; k < 3; k++) nut.push(part(BALL(0.13, 6, 4), lean + Math.cos(k * 2.1) * 0.22, H - 0.3, Math.sin(k * 2.1) * 0.22));
  return [{ g: mg(tr), c: '#9c7a52', jit: 0.05 }, { g: mg(lf), c: '#3f9e3c', jit: 0.08 }, { g: mg(nut), c: '#6b4a2a', cast: false }];
}
function bananaP() {
  const lf = [];
  for (let k = 0; k < 7; k++) lf.push(frond(0.55, 1.8, 0.05 + (k % 3) * 0.22, k * 0.9, 0, 1.5, 0, 0.12));
  return [{ g: mg([CYL(0.1, 0.15, 1.6, 6).translate(0, 0.8, 0)]), c: '#7d8f4a' }, { g: mg(lf), c: '#62c13c', jit: 0.08 }];
}
// çalı: yeşil topaklar, üstünde çiçekler
function bushP(leaf, flower, nf, h = 1, fr = 0.12) {
  const L = [], F = [], nb = 3 + Math.round(h * 1.5);
  for (let i = 0; i < nb; i++) { const a = i * 2.4, r = i ? 0.3 : 0; L.push(part(ICO(0.42 + 0.08 * (i % 2)), Math.cos(a) * r, 0.35 + (i / nb) * h * 0.85, Math.sin(a) * r)); }
  for (let i = 0; i < nf; i++) { const a = i * 2.39996, y = 0.3 + ((i * 0.618) % 1) * h * 0.95, r = 0.62 - 0.12 * Math.abs(y - 0.4 - h * 0.4) / Math.max(h, 0.5); F.push(part(ICO(fr), Math.cos(a) * r, y, Math.sin(a) * r)); }
  return nf ? [{ g: mg(L), c: leaf, jit: 0.08 }, { g: mg(F), c: flower, jit: 0.05, cast: false }] : [{ g: mg(L), c: leaf, jit: 0.08 }];
}
function lavenderP() {
  const S = [];
  for (let i = 0; i < 9; i++) { const a = i * 2.39996, r = 0.2 * Math.sqrt(i / 9); S.push(part(CONE(0.06, 0.38, 4), Math.cos(a) * r, 0.55, Math.sin(a) * r)); }
  return [{ g: mg([part(ICO(0.32), 0, 0.18, 0, 0, 0, 0, 1, 0.55, 1)]), c: '#8ea58a', cast: false }, { g: mg(S), c: '#9b7fd9', jit: 0.05, cast: false }];
}
function agaveP() {
  const L = [];
  for (let i = 0; i < 11; i++) { const g = CONE(0.12, 1.0, 4); g.translate(0, 0.5, 0); g.scale(1, 1, 0.45); L.push(part(g, 0, 0.05, 0, 0, i * 2.39996, -(0.35 + (i % 3) * 0.3))); }
  return [{ g: mg(L), c: '#7fae9a', jit: 0.06 }];
}
function pearP() { // frenk inciri: yassı yapraklar, uçlarında pembe meyve
  const P = [], F = [];
  for (const [x, y, z, rz, ry] of [[0, 0.35, 0, 0, 0], [0.22, 0.75, 0, 0.5, 0.4], [-0.2, 0.8, 0.05, -0.4, -0.3], [0.05, 1.12, -0.05, 0.1, 1.2]]) {
    P.push(part(BALL(0.3, 7, 5), x, y, z, 0, ry, rz, 0.75, 1, 0.22));
    F.push(part(BALL(0.05, 5, 3), x + 0.05, y + 0.3, z));
  }
  return [{ g: mg(P), c: '#5d9a4a', jit: 0.06 }, { g: mg(F), c: '#d8486a', cast: false }];
}
function fruitP(fruit) { // limon, portakal: yuvarlak taç, üstünde meyveler
  const F = [];
  for (let i = 0; i < 11; i++) { const a = i * 2.39996, y = 1.75 + Math.sin(i * 1.7) * 0.5, r = 1.04 * Math.sqrt(Math.max(0.05, 1 - ((y - 1.75) / 0.85) ** 2)); F.push(part(BALL(0.09, 6, 4), Math.cos(a) * r, y, Math.sin(a) * r)); }
  return [{ g: mg([CYL(0.08, 0.12, 1.3, 6).translate(0, 0.65, 0)]), c: '#7a5a3a' }, { g: mg([part(ICO(1.0, 1), 0, 1.75, 0, 0, 0, 0, 1, 0.85, 1)]), c: '#3f8f3a', jit: 0.07 }, { g: mg(F), c: fruit, cast: false }];
}
function figP() {
  return [{ g: mg([CYL(0.1, 0.16, 1.5, 6).translate(0, 0.75, 0)]), c: '#9a968a' },
    { g: mg([part(ICO(0.9, 1), 0, 1.9, 0, 0, 0, 0, 1, 0.7, 1), part(ICO(0.75, 1), 0.7, 1.7, 0.3, 0, 0, 0, 1, 0.7, 1), part(ICO(0.7, 1), -0.6, 1.75, -0.35, 0, 0, 0, 1, 0.7, 1)]), c: '#4f9a3f', jit: 0.07 }];
}
function oliveP() { // zeytin: eğri gövde, gümüşi yeşil taç
  return [{ g: mg([part(CYL(0.1, 0.17, 1.2, 6), 0.1, 0.55, 0, 0, 0, -0.25), part(CYL(0.07, 0.1, 1.0, 6), 0.05, 1.3, 0.1, 0.3, 0, 0.35)]), c: '#8a7a62' },
    { g: mg([part(ICO(0.7), 0, 1.9, 0, 0, 0, 0, 1.2, 0.7, 1.2), part(ICO(0.6), 0.6, 1.6, 0.3), part(ICO(0.55), -0.55, 1.7, -0.25), part(ICO(0.5), 0.1, 1.5, -0.6)]), c: '#93a97c', jit: 0.08 }];
}
function cypressP() {
  return [{ g: mg([CYL(0.08, 0.1, 0.8, 5).translate(0, 0.4, 0)]), c: '#6b4e36' },
    { g: mg([part(ICO(0.52), 0, 1.4, 0, 0, 0, 0, 1, 1.5, 1), part(ICO(0.45), 0, 2.6, 0, 0, 0, 0, 1, 1.6, 1), part(ICO(0.32), 0, 3.7, 0, 0, 0, 0, 1, 1.7, 1), part(CONE(0.22, 0.9, 6), 0, 4.5, 0)]), c: '#2f6b3a', jit: 0.06 }];
}
function pineP() { // kızılçam: uzun gövde, şemsiye taç
  return [{ g: mg([CYL(0.12, 0.2, 4.4, 6).translate(0, 2.2, 0)]), c: '#8a5a3c' },
    { g: mg([part(ICO(1.3), 0, 4.6, 0, 0, 0, 0, 1.25, 0.45, 1.25), part(ICO(0.9), 0.7, 4.0, 0.3, 0, 0, 0, 1.2, 0.45, 1.2), part(ICO(0.8), -0.6, 4.2, -0.4, 0, 0, 0, 1.2, 0.45, 1.2)]), c: '#3c7a3e', jit: 0.07 }];
}
function fernP() { const F = []; for (let k = 0; k < 7; k++) F.push(frond(0.2, 0.85, 0.45, k * 0.9, 0, 0.05, 0, 0.28)); return [{ g: mg(F), c: '#4fa84a', jit: 0.08, cast: false }]; }
function strelitziaP() { // cennet kuşu çiçeği: kürek yapraklar, turuncu-mavi çiçek
  const L = [], O = [], B = [];
  for (let k = 0; k < 6; k++) { const a = k * 1.05; L.push(part(CYL(0.02, 0.025, 1.0, 4), Math.cos(a) * 0.1, 0.5, Math.sin(a) * 0.1, 0, a, 0.15)); L.push(part(BALL(0.25, 6, 4), Math.cos(a) * 0.25, 1.2, Math.sin(a) * 0.25, 0, -a, 0.3, 0.32, 1, 0.08)); }
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; O.push(part(CONE(0.07, 0.4, 4), Math.cos(a) * 0.2, 1.3, Math.sin(a) * 0.2, 0, -a, -1.2)); B.push(part(CONE(0.04, 0.22, 4), Math.cos(a) * 0.28, 1.38, Math.sin(a) * 0.28, 0, -a, -0.6)); }
  return [{ g: mg(L), c: '#3f8a4a', jit: 0.06 }, { g: mg(O), c: '#f58a1e', cast: false }, { g: mg(B), c: '#3d6fd8', cast: false }];
}
function bambooP() {
  const S = [], L = [];
  for (let k = 0; k < 8; k++) { const a = k * 2.39996, r = 0.25 * Math.sqrt(k / 8), h = 3.0 + (k % 3) * 0.4; S.push(part(CYL(0.04, 0.05, h, 5), Math.cos(a) * r, h / 2, Math.sin(a) * r, 0.05 * Math.sin(a), 0, 0.05 * Math.cos(a))); L.push(part(ICO(0.35), Math.cos(a) * r * 1.6, h, Math.sin(a) * r * 1.6, 0, 0, 0, 1, 0.6, 1)); }
  return [{ g: mg(S), c: '#9fbf5a' }, { g: mg(L), c: '#6faa3c', jit: 0.08 }];
}
function meadowP(col) { // kır çiçekleri
  const F = [];
  for (let i = 0; i < 11; i++) { const a = i * 2.39996, r = 0.7 * Math.sqrt((i + 0.5) / 11); F.push(part(ICO(0.07), Math.cos(a) * r, 0.14 + (i % 3) * 0.05, Math.sin(a) * r)); }
  return [{ g: mg(F), c: col, jit: 0.04, cast: false }];
}
const thymeP = () => [{ g: mg([part(ICO(0.32), 0, 0.1, 0, 0, 0, 0, 1, 0.5, 1)]), c: '#a77fc0', jit: 0.06, cast: false }];
function dunegrassP() { const L = []; for (let i = 0; i < 7; i++) { const g = CONE(0.04, 0.6, 3); g.translate(0, 0.3, 0); L.push(part(g, 0, 0, 0, 0, i * 2.39996, -0.3 - (i % 3) * 0.15)); } return [{ g: mg(L), c: '#c2c27a', jit: 0.06, cast: false }]; }
const rockP = (sx, sy, sz) => [{ g: mg([part(ICO(0.6), 0, 0.15, 0, 0, 0, 0, sx, sy, sz)]), c: '#a49c92', jit: 0.12 }];

// ---------- yerleştirme: yollara, yapılara, ayrılmış alanlara ve birbirine girmeden ----------
const RES = []; // ayrılmış alanlar { x, z, r }: kumsal oyunları, meydan, zirve
const OCC = new Map();
function occOk(x, z, r) {
  let ok = true;
  cellsOf(x, z, r + 3, (k) => { if (!ok) return; for (const q of OCC.get(k) || []) if (Math.hypot(x - q[0], z - q[1]) < q[2] + r) { ok = false; return; } });
  return ok;
}
const occAdd = (x, z, r) => cellsOf(x, z, 0, (k) => { let l = OCC.get(k); if (!l) OCC.set(k, (l = [])); l.push([x, z, r]); });
function freeSpot(x, z, r, o) {
  if (edge(x, z) > (o.emax ?? 0.8) || ground(x, z) < (o.hmin ?? 0.25) || ground(x, z) > (o.hmax ?? 99)) return false;
  if (pathDist(x, z) < r + (o.pathPad ?? 1.0) || blocked(x, z, r + 0.3)) return false;
  for (const q of RES) if (Math.hypot(x - q.x, z - q.z) < q.r + r) return false;
  return occOk(x, z, r);
}
// n tane, area() rastgele yer verir; trunk: gövde engeli (ölçekle)
function scatter(F, n, area, r, s0, s1, o = {}) {
  for (let t = 0, k = 0; t < n * 25 && k < n; t++) {
    const [x, z] = area();
    if (!freeSpot(x, z, r, o)) continue;
    const s = rand(s0, s1);
    F.put(x, z, s); occAdd(x, z, r * s); k++;
    if (o.trunk) obsAdd({ x, z, r: o.trunk * s });
  }
}

// ---------- bohem ada evleri ----------
// 2026-11-08 (kullanıcı: "adadaki binaları daha bohem tarza adaya uygun tarza çevir"): taş duvar ve kiremit yerine yuvarlak köşeli badanalı
// sıva (beyaz, kum, toprak pembesi, hardal), iki katlıda üst kat küp gibi arkaya oturur, önünde dam terası ve yandan çıkan dış merdiven;
// kemerli renkli kapı, kemerli pencere ve altında çiçek kasası; ön verandada ahşap pergola ve kamış gölgelik, ampullü ip, rattan fener, sedir
// ve minderler, kilim, alçak masa, saksıda pampas. Pergolalı evlerin damında kamış gölgelikli oturma köşesi, düz damlıların yuvarlak korkuluğu
// ve bacası var. Begonvil ve meyve ağacı yerinde. Ada genelinde malzeme başına tek geometri: renkler sınırlı
// [x, z, yön, en, derinlik, kat, dam ('flat' korkuluk ve baca, 'perg' damda pergola), kapı-pencere rengi]
const HOUSES = [
  [891, 6, PI / 2, 5.2, 4.2, 2, 'flat', '#2f6fc9'],
  [895, -3, PI * 0.15, 4.6, 4.0, 1, 'perg', '#3fae9a'],
  [911, -2, -PI * 0.2, 5.0, 4.4, 2, 'perg', '#c8643c'],
  [917, 6, -PI / 2, 4.4, 4.0, 1, 'flat', '#2f8fc9'],
  [916, 19, -PI * 0.62, 5.0, 4.0, 2, 'flat', '#d9a43a'],
  [889, 19, PI * 0.6, 4.6, 4.2, 1, 'perg', '#6f9a6a'],
  [893, 27, PI * 0.82, 4.2, 3.8, 1, 'flat', '#3fae9a'],
  [913, 28, -PI * 0.82, 4.6, 4.0, 1, 'perg', '#b8574a'],
];
const WALLS = ['#f6f1e7', '#efd8b6', '#ecc4ac', '#f6f1e7', '#efd29a', '#f6f1e7', '#ecc4ac', '#efd8b6'];
const RB = (w, h, d, r = 0.2) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
const ARCH = (r, dp) => new THREE.CylinderGeometry(r, r, dp, 10, 1, false, 0, PI).rotateX(PI / 2).rotateZ(PI / 2); // üst yarım daire, düz kenarı x boyunca
const STONE = () => M.mat('#dccbab', { map: texRep('cobble', 1.1, 0.8) });
const LIME = () => M.mat('#f1ece0');
let RATTAN = null;
const rattanM = () => RATTAN || (RATTAN = M.mat('#ffffff', { map: checkerTex('#b8894a', '#d9b678') }));
const KPAL = [['#c8653d', '#e3a840', '#2f8f8a', '#efe4cf', '#b5523b'], ['#2f8f8a', '#efe4cf', '#d98c6a', '#e3c25a', '#3c6f9a']];
function house(K, H, flora, hi) {
  const [x, z, ry, w, d, fl, roof, shc] = H;
  const F0 = frame(x, 0, z, ry), hs = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1.3], [0, 1.8]].map(([a, b]) => { const [px, pz] = F0.at(a * w / 2, b * d / 2); return ground(px, pz); });
  const y0 = (Math.min(...hs) + Math.max(...hs)) / 2, F = frame(x, y0, z, ry);
  const wc = WALLS[hi % WALLS.length], white = wc === '#f6f1e7', wall = M.mat(wc), trim = white ? M.mat('#dcc9a6') : LIME(), door = M.mat(shc), glass = M.mat('#34404c', { rough: 0.3 });
  const wood = M.mat('#b9a487', { map: texRep('wood', 2, 0.6) }), postM = M.mat('#7a5c40'), reed = M.mat('#cdb17a', { map: texRep('wood', 0.5, 3) }), terra = M.mat('#c46a45');
  const leaf = M.mat('#3f8a3a'), flw = ['#e33b3b', '#f28db2', '#f6c343'].map((c) => M.mat(c)), dk = M.mat('#3a3330'), plume = M.mat('#eadcbc', { flat: true });
  const bulb = M.mat('#ffe2a0', { emissive: '#ffcf70', ei: 0.7 }), rattan = rattanM();
  const cush = ['#e3a840', '#2f8f8a', '#d9603c', '#efe4cf'].map((c) => M.mat(c)), kilim = M.mat('#ffffff', { map: kilimTex(KPAL[hi % 2]) });
  const put = (geo, lx, ly, lz, m, rx = 0, rry = 0, rz = 0) => K.add(F(geo, lx, ly, lz, rx, rry, rz), m);
  // yüzeye bakan parça: side 0 ön (+z), ±1 yan duvar; u yüzey boyunca, v yukarı, n dışarı
  const face = (cx, cz, side) => (geo, u, v, n, m) => put(geo, side ? cx + side * n : cx + u, v, side ? cz - side * u : cz + n, m, 0, side ? side * PI / 2 : 0, 0);
  const win = (P, u, b) => { // kemerli pencere: renkli çerçeve, kayıtlı cam, çiçek kasası
    P(BOX(0.86, 0.8, 0.05), u, b + 0.4, 0.025, door); P(ARCH(0.43, 0.05), u, b + 0.8, 0.025, door);
    P(BOX(0.66, 0.74, 0.05), u, b + 0.41, 0.045, glass); P(ARCH(0.33, 0.05), u, b + 0.78, 0.045, glass);
    P(BOX(0.04, 1.05, 0.04), u, b + 0.55, 0.07, door); P(BOX(0.66, 0.04, 0.04), u, b + 0.5, 0.07, door);
    P(BOX(0.94, 0.2, 0.24), u, b - 0.06, 0.13, terra);
    for (let k = 0; k < 3; k++) { P(BALL(0.13, 6, 4), u - 0.3 + k * 0.3, b + 0.08, 0.14, leaf); P(BALL(0.08, 6, 4), u - 0.3 + k * 0.3 + 0.05, b + 0.16, 0.2, flw[(k + hi) % 3]); }
  };
  const archDoor = (P, u, b, m) => { // kemerli kapı ve çevresinde sıva pervaz
    P(BOX(1.24, 1.7, 0.05), u, b + 0.85, 0.025, trim); P(ARCH(0.62, 0.05), u, b + 1.7, 0.025, trim);
    P(BOX(1.0, 1.7, 0.08), u, b + 0.85, 0.05, m); P(ARCH(0.5, 0.08), u, b + 1.7, 0.05, m);
    for (const k of [-0.25, 0, 0.25]) P(BOX(0.025, 1.9, 0.02), u + k, b + 0.95, 0.095, dk); // tahta aralıkları
    P(BALL(0.05, 6, 4), u + 0.36, b + 1.0, 0.11, M.mat('#c9a24a', { rough: 0.35 }));
  };
  const parapet = (cx, cz, pw, pd, y, skip) => { // yuvarlak köşeli dam korkuluğu (skip: o kenar açık)
    for (const sz of [-1, 1]) if (skip !== 'z' + sz) put(RB(pw, 0.42, 0.18, 0.08), cx, y + 0.21, cz + sz * (pd / 2 - 0.09), wall);
    for (const sx of [-1, 1]) if (skip !== 'x' + sx) put(RB(0.18, 0.42, pd, 0.08), cx + sx * (pw / 2 - 0.09), y + 0.21, cz, wall);
  };
  const pot = (lx, ly, lz, big) => { // saksıda bitki: büyükte pampas, küçükte yapraklı
    put(CYL(big ? 0.2 : 0.15, big ? 0.15 : 0.11, big ? 0.5 : 0.3, 8), lx, ly + (big ? 0.25 : 0.15), lz, terra);
    if (big) for (let k = 0; k < 6; k++) { const a = k * 1.05; put(CONE(0.06, 0.8, 5), lx + Math.cos(a) * 0.08, ly + 0.9, lz + Math.sin(a) * 0.08, plume, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); }
    else put(BALL(0.22, 7, 5), lx, ly + 0.42, lz, leaf);
  };
  const lights = (ax, az, bx, bz, y, n) => { // ampullü ip: iki nokta arasında sarkan
    for (let k = 0; k <= n; k++) { const t = k / n, sag = Math.sin(t * PI) * 0.22; put(BALL(0.06, 6, 4), ax + (bx - ax) * t, y - sag, az + (bz - az) * t, bulb); }
    const len = Math.hypot(bx - ax, bz - az); put(BOX(0.012, 0.012, len), (ax + bx) / 2, y - 0.12, (az + bz) / 2, dk, 0, Math.atan2(bx - ax, bz - az), 0);
  };
  const seatNook = (cx, cz, y) => { // kilim, alçak masa, minderler
    put(BOX(1.8, 0.02, 1.4), cx, y + 0.01, cz, kilim);
    put(CYL(0.36, 0.36, 0.05, 12), cx, y + 0.34, cz, wood); put(CYL(0.12, 0.14, 0.32, 8), cx, y + 0.16, cz, wood);
    [[-0.75, 0], [0.75, 0], [0, -0.55]].forEach(([dx, dz], k) => put(BALL(0.3, 9, 5).scale(1, 0.4, 1), cx + dx, y + 0.1, cz + dz, cush[(k + hi) % 4]));
  };
  const pergola = (x0, x1, z0, z1, y, h = 2.25) => { // dört dikme, kirişler, çıtalar, yarısında kamış gölgelik, ön kirişte ampullü ip
    for (const px of [x0, x1]) for (const pz of [z0, z1]) put(CYL(0.06, 0.07, h, 6), px, y + h / 2, pz, postM);
    for (const pz of [z0, z1]) put(BOX(x1 - x0 + 0.3, 0.1, 0.1), (x0 + x1) / 2, y + h, pz, postM);
    const n = Math.max(3, Math.round((x1 - x0) / 0.42));
    for (let k = 0; k <= n; k++) put(BOX(0.06, 0.06, z1 - z0 + 0.3), x0 + ((x1 - x0) * k) / n, y + h + 0.08, (z0 + z1) / 2, wood);
    put(BOX((x1 - x0) * 0.55, 0.03, z1 - z0 + 0.2), x0 + (x1 - x0) * 0.3, y + h + 0.13, (z0 + z1) / 2, reed);
    lights(x0, z1, x1, z1, y + h - 0.06, Math.round((x1 - x0) / 0.45));
  };
  // taş temel (yokuşta toprağa gömülür), verandanın önüne de uzanır
  put(BOX(w + 0.3, 1.5, d + 1.9), 0, -0.65, 0.8, M.mat('#e2d8c6', { map: texRep('cobble', 1.1, 0.4) }));
  // yokuşta veranda önü yüksek kalırsa badanalı kenar ve kapıya inen basamaklar; oyuncu taş sekiye gömülmesin diye seki engel olur
  { const [gx, gz] = F.at(0, d / 2 + 2.1), drop = 0.1 - (ground(gx, gz) - y0), lime = LIME();
    put(BOX(w + 0.36, 0.07, 0.22), 0, 0.1, d / 2 + 1.68, lime);
    if (drop > 0.3) {
      const n = Math.ceil(drop / 0.22), rise = drop / n, bot = 0.1 - drop - 0.3;
      for (let k = 0; k < n; k++) { const tp = 0.1 - (k + 1) * rise; put(BOX(1.5, tp - bot, 0.32), 0, (tp + bot) / 2, d / 2 + 1.91 + k * 0.32, lime); }
      const [ox, oz] = F.at(0, d / 2 + 0.9); obsAdd({ x: ox, z: oz, hw: w / 2 + 0.15, hd: 0.95, ry });
    } }
  // gövde: zemin kat küpü; iki katlıda üst kat arkaya ve bir yana oturur
  const H1 = 2.7, sd = hi % 4 === 2 ? 1 : -1;
  put(RB(w, H1, d, 0.22), 0, 0.15 + H1 / 2, 0, wall);
  let top = { cx: 0, cz: 0, w, d, y: 0.15 + H1 };
  const front = face(0, d / 2, 0), sideF = (sx) => face(sx * w / 2, 0, sx);
  archDoor(front, 0, 0.15, door);
  put(RB(1.5, 0.16, 0.6, 0.05), 0, 0.17, d / 2 + 0.3, wall); // eşik
  const fx = w > 4.5 ? [-w / 2 + 0.95, w / 2 - 0.95] : [w / 2 - 0.9];
  for (const u of fx) win(front, u, 1.05);
  for (const sx of [-1, 1]) if (!(fl === 2 && sx === -sd)) win(sideF(sx), sx * 0.2, 1.05); // merdiven yanında pencere yok
  if (fl === 2) {
    const wb = Math.round(w * 0.58 * 10) / 10, db = Math.round(d * 0.7 * 10) / 10, cx = sd * (w - wb) / 2, cz = -(d - db) / 2, yb = 0.15 + H1, H2 = 2.55;
    put(RB(wb, H2, db, 0.2), cx, yb + H2 / 2, cz, wall);
    top = { cx, cz, w: wb, d: db, y: yb + H2 };
    const uf = face(cx, cz + db / 2, 0);
    archDoor(uf, -sd * (wb / 2 - 0.75), yb, door); // terasa çıkan kapı
    if (wb > 2.6) win(uf, sd * (wb / 2 - 0.6), yb + 0.9);
    win(face(cx + sd * wb / 2, cz, sd), 0, yb + 0.9);
    // zemin kat damı teras: korkuluk (merdiven yanında arka yarısı açık), dış merdiven
    parapet(0, 0, w, d, yb, null);
    for (let k = 0; k < 11; k++) { const sh = (k + 1) * 0.245; put(BOX(0.8, sh, 0.34), -sd * (w / 2 + 0.42), 0.15 + sh / 2, d / 2 - 0.35 - k * 0.33, wall); }
    put(RB(0.12, 0.7, 4.1, 0.05), -sd * (w / 2 + 0.78), 1.97, d / 2 - 2.0, wall, 0.64, 0, 0); // merdiven korkuluğu
    const [qx, qz] = F.at(-sd * (w / 2 + 0.42), d / 2 - 2.0); obsAdd({ x: qx, z: qz, hw: 0.45, hd: 1.95, ry });
    if (roof === 'perg') { const a = sd > 0 ? -w / 2 + 0.35 : w / 2 - wb + 0.2, b = sd > 0 ? w / 2 - wb - 0.2 : w / 2 - 0.35; pergola(a, b, -d / 2 + 0.4, d / 2 - 0.4, yb); seatNook((a + b) / 2, 0.1, yb); }
    else { pot(-sd * (w / 2 - 0.45), yb, d / 2 - 0.45, true); pot(-sd * (w / 2 - 1.2), yb, d / 2 - 0.4, false); seatNook(-sd * (w / 2 - (w - wb) / 2), 0.4, yb); }
  }
  // en üst dam
  if (roof === 'perg' && fl === 1) {
    parapet(0, 0, w, d, top.y, null);
    pergola(-w / 2 + 0.4, w / 2 - 0.4, -d / 2 + 0.4, d / 2 - 0.4, top.y); seatNook(0, 0.1, top.y);
    pot(w / 2 - 0.42, top.y, -0.3, true);
  } else {
    parapet(top.cx, top.cz, top.w, top.d, top.y, null);
    put(RB(0.6, 1.0, 0.6, 0.12), top.cx + top.w / 2 - 0.65, top.y + 0.5, top.cz - top.d / 2 + 0.65, wall); // baca
    put(RB(0.8, 0.1, 0.8, 0.04), top.cx + top.w / 2 - 0.65, top.y + 1.05, top.cz - top.d / 2 + 0.65, trim);
    for (const sx of [-1, 1]) put(BOX(0.08, 0.2, 0.62), top.cx + top.w / 2 - 0.65 + sx * 0.2, top.y + 0.85, top.cz - top.d / 2 + 0.65, dk);
    if (fl === 1) { pot(-top.w / 2 + 0.5, top.y, top.d / 2 - 0.5, false); pot(-top.w / 2 + 1.1, top.y, top.d / 2 - 0.45, false); }
  }
  // ön veranda: pergola ve kamış gölgelik, sedir ve minderler, alçak masa, saksılar, rattan fener
  const vz = d / 2 + 1.55;
  for (const sx of [-1, 1]) { put(CYL(0.07, 0.08, 2.45, 6), sx * (w / 2 - 0.18), 0.1 + 1.22, vz, postM); const [px, pz] = F.at(sx * (w / 2 - 0.18), vz); obsAdd({ x: px, z: pz, r: 0.12 }); }
  put(BOX(w, 0.1, 0.1), 0, 2.5, vz, postM);
  for (const sx of [-1, 1]) put(BOX(0.1, 0.1, 1.65), sx * (w / 2 - 0.18), 2.5, d / 2 + 0.75, postM);
  for (let k = 0; k < 7; k++) put(BOX(w - 0.1, 0.04, 0.12), 0, 2.58, d / 2 + 0.12 + k * 0.24, k % 2 ? reed : wood);
  lights(-w / 2 + 0.2, vz, w / 2 - 0.2, vz, 2.42, Math.round(w / 0.45));
  const bx0 = -w / 2 + 0.25, bx1 = -0.82, bw = bx1 - bx0, bcx = (bx0 + bx1) / 2;
  put(RB(bw, 0.42, 0.5, 0.08), bcx, 0.31, d / 2 + 0.25, wall); // sedir
  put(BOX(bw - 0.1, 0.1, 0.44), bcx, 0.57, d / 2 + 0.27, cush[hi % 4]);
  for (let k = 0; k < 2; k++) put(BOX(0.42, 0.3, 0.12), bcx - bw / 4 + (k * bw) / 2, 0.74, d / 2 + 0.1, cush[(hi + 1 + k) % 4], -0.2, 0, 0);
  { const [qx, qz] = F.at(bcx, d / 2 + 0.25); obsAdd({ x: qx, z: qz, hw: bw / 2, hd: 0.3, ry }); }
  put(BOX(1.4, 0.02, 0.95), bcx + 0.1, 0.13, d / 2 + 1.0, kilim);
  put(CYL(0.3, 0.3, 0.04, 12), bcx + 0.1, 0.42, d / 2 + 1.0, wood); put(CYL(0.1, 0.12, 0.3, 8), bcx + 0.1, 0.25, d / 2 + 1.0, wood);
  put(CYL(0.05, 0.035, 0.1, 8), bcx + 0.2, 0.49, d / 2 + 0.95, M.mat('#f7f4ec', { rough: 0.3 }));
  { const [qx, qz] = F.at(bcx + 0.1, d / 2 + 1.0); obsAdd({ x: qx, z: qz, r: 0.32 }); }
  pot(0.95, 0.1, d / 2 + 0.35, true); pot(w / 2 - 0.45, 0.1, d / 2 + 0.45, false);
  put(BOX(0.012, 0.35, 0.012), w / 4 + 0.2, 2.28, vz, dk); put(CYL(0.13, 0.1, 0.3, 8), w / 4 + 0.2, 1.98, vz, rattan); put(BALL(0.07, 6, 4), w / 4 + 0.2, 1.88, vz, bulb); // rattan fener
  // ön köşede begonvil (iki katlıda merdivenin karşı köşesinde), yanında meyve ağacı ya da zeytin
  const bs = fl === 2 ? sd : -1, [bxw, bzw] = F.at(bs * (w / 2 + 0.2), d / 2 + 0.1); flora.bougain.put(bxw, bzw, 1.25); occAdd(bxw, bzw, 0.6);
  const [tx, tz] = F.at(w / 2 + 1.6, -d / 2 + 0.4); const tk = (x * 7 + z) % 3 < 1 ? 'lemon' : (x * 7 + z) % 3 < 2 ? 'orange' : 'olive';
  if (!blocked(tx, tz, 0.6)) { flora[tk].put(tx, tz, rand(0.85, 1.05)); occAdd(tx, tz, 1.1); obsAdd({ x: tx, z: tz, r: 0.25 }); }
  obsAdd({ x, z, hw: w / 2 + 0.15, hd: d / 2 + 0.15, ry });
  const [rx, rz] = F.at(top.cx, top.cz);
  return { door: F.at(0, d / 2 + 1.1), doorY: y0 + 0.1, ry, y0, x, z, roofY: y0 + top.y + 0.02, rx, rz, rw: Math.max(0.3, Math.min(top.w, top.d) / 2 - 0.6) };
}

// ---------- kumsal donatısı ----------
function iceCart(K, F) { // dondurma arabası
  const wht = M.mat('#ffffff'), pink = M.mat('#f28db2'), steel = M.mat('#c9cfd6', { rough: 0.4 }), dk = M.mat('#333333');
  K.add(F(BOX(1.7, 0.85, 0.85), 0, 0.75, 0), wht); K.add(F(BOX(1.72, 0.18, 0.87), 0, 0.55, 0), pink);
  K.add(F(BOX(1.5, 0.08, 0.7), 0, 1.22, 0), steel);
  for (const [x, c] of [[-0.45, '#f6e3b0'], [0, '#f28db2'], [0.45, '#8b5a3c']]) { K.add(F(CONE(0.11, 0.3, 6), x, 1.42, 0.15, PI), M.mat('#d9a35a')); K.add(F(BALL(0.13, 7, 5), x, 1.62, 0.15), M.mat(c)); }
  for (const sx of [-1, 1]) K.add(F(CYL(0.25, 0.25, 0.08, 10), sx * 0.6, 0.25, -0.45, PI / 2), dk);
  K.add(F(CYL(0.03, 0.03, 2.4, 6), 0.7, 1.9, -0.3), steel); K.add(F(CONE(1.15, 0.45, 10), 0.7, 3.1, -0.3), pink);
}
function cornCart(K, F) { // mısır arabası: kazan, koçanlar
  const red = M.mat('#d8432f'), steel = M.mat('#c9cfd6', { rough: 0.35 }), dk = M.mat('#333333'), corn = M.mat('#f2c53a'), wht = M.mat('#ffffff');
  K.add(F(BOX(1.7, 0.85, 0.85), 0, 0.75, 0), red); K.add(F(BOX(1.72, 0.14, 0.87), 0, 0.5, 0), wht);
  K.add(F(CYL(0.36, 0.32, 0.5, 12), -0.35, 1.42, 0), steel); K.add(F(CYL(0.38, 0.38, 0.06, 12), -0.35, 1.7, 0), steel);
  for (let i = 0; i < 4; i++) K.add(F(CYL(0.06, 0.06, 0.32, 7), 0.25 + i * 0.16, 1.3, 0.15, PI / 2, 0.3, 0), corn);
  for (const sx of [-1, 1]) K.add(F(CYL(0.25, 0.25, 0.08, 10), sx * 0.6, 0.25, -0.45, PI / 2), dk);
  K.add(F(CYL(0.03, 0.03, 2.4, 6), 0.75, 1.9, -0.3), steel); K.add(F(CONE(1.15, 0.45, 10), 0.75, 3.1, -0.3), M.mat('#f2c14e'));
}
function sodaStand(K, F) { // gazoz standı: buzdolabı, şişeler, tente
  const blue = M.mat('#2f7fd8'), wht = M.mat('#ffffff'), glass = M.mat('#9fd3e8', { rough: 0.2 });
  K.add(F(BOX(1.8, 0.95, 0.8), 0, 0.48, 0), blue); K.add(F(BOX(1.6, 0.55, 0.04), 0, 0.5, 0.41), glass);
  K.add(F(BOX(1.85, 0.06, 0.85), 0, 0.98, 0), wht);
  ['#3f8f4a', '#f58a1e', '#cfe8ef', '#7a4a2a', '#e8344a', '#3f8f4a'].forEach((c, i) => { const m = M.mat(c, { rough: 0.25 }); K.add(F(CYL(0.06, 0.06, 0.26, 7), -0.62 + i * 0.25, 1.14, 0.1), m); K.add(F(CYL(0.025, 0.04, 0.12, 6), -0.62 + i * 0.25, 1.33, 0.1), m); });
  for (const sx of [-1, 1]) K.add(F(CYL(0.035, 0.035, 2.2, 6), sx * 0.85, 1.1, -0.35), wht);
  K.add(F(BOX(2.1, 0.08, 1.3), 0, 2.25, -0.05, 0.12), blue);
}
function hut(K, F) { // su sporları kulübesi
  const wood = M.mat('#b07a48'), blue = M.mat('#2f8fc9'), wht = M.mat('#ffffff'), red = M.mat('#e8473c');
  K.add(F(BOX(2.6, 2.2, 1.9), 0, 1.1, -0.4), wood); K.add(F(BOX(3.0, 0.12, 2.5), 0, 2.32, -0.35, 0.1), blue);
  K.add(F(BOX(1.6, 0.7, 0.05), 0, 1.35, 0.56), M.mat('#3a4652')); K.add(F(BOX(1.8, 0.08, 0.35), 0, 0.98, 0.7), wht);
  const ring = new THREE.TorusGeometry(0.28, 0.07, 6, 14); K.add(F(ring, 1.0, 1.5, 0.57), red);
  K.add(F(BOX(0.06, 0.02, 1.4), 0, 0.03, 1.8), wht); // iki kiralama alanının arası
}
function volleyCourt(K, F) { // yerel x kıyı boyunca 14 m, z denize doğru 7 m; file x = 0'da
  const blue = M.mat('#3d7dd8'), wht = M.mat('#ffffff'), net = M.mat('#2a2a2a');
  for (const sz of [-1, 1]) K.add(F(BOX(14, 0.03, 0.07), 0, 0.02, sz * 3.5), blue);
  for (const sx of [-1, 1]) K.add(F(BOX(0.07, 0.03, 7), sx * 7, 0.02, 0), blue);
  for (const sz of [-1, 1]) K.add(F(CYL(0.06, 0.06, 2.6, 7), 0, 1.3, sz * 4.2), wht);
  K.add(F(BOX(0.04, 0.12, 8.4), 0, 2.4, 0), wht);
  for (let i = 0; i < 4; i++) K.add(F(BOX(0.02, 0.02, 8.4), 0, 1.6 + i * 0.22, 0), net);
  for (let i = 0; i <= 16; i++) K.add(F(BOX(0.02, 0.8, 0.02), 0, 1.95, -4 + i * 0.5), net);
}
function footPitch(K, F) { // 16 x 8 m, kaleler x = ±8
  const wht = M.mat('#ffffff'), net = M.mat('#cfd3d8');
  for (const sz of [-1, 1]) K.add(F(BOX(16, 0.03, 0.07), 0, 0.02, sz * 4), wht);
  for (const sx of [-1, 0, 1]) K.add(F(BOX(0.07, 0.03, 8), sx * 8, 0.02, 0), wht);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) { K.add(F(CYL(0.05, 0.05, 1.3, 6), sx * 8, 0.65, sz * 1.25), wht); K.add(F(CYL(0.03, 0.03, 1.4, 5), sx * 8.55, 0.6, sz * 1.25, 0, 0, sx * 0.4), wht); }
    K.add(F(CYL(0.05, 0.05, 2.5, 6), sx * 8, 1.3, 0, PI / 2), wht);
    for (let i = 0; i <= 8; i++) K.add(F(BOX(0.02, 1.3, 0.02), sx * 8.55, 0.65, -1.25 + i * 0.3125, 0, 0, sx * 0.4), net); // ağ
    for (let i = 0; i < 4; i++) K.add(F(BOX(0.02, 0.02, 2.5), sx * (8.12 + i * 0.13), 0.3 + i * 0.3, 0), net);
  }
}
function djStage(K, F) { // DJ sahnesi: önü +z (denize), arkasında LED ekran
  const deck = M.mat('#3a2f2a'), blk = M.mat('#1d1d22'), gry = M.mat('#55595f'), truss = M.mat('#2a2a2e');
  K.add(F(BOX(5, 0.5, 3.2), 0, 0.25, 0), deck);
  K.add(F(BOX(2.2, 1.0, 0.7), 0, 1.0, 0.45), blk);
  for (const sx of [-1, 1]) { K.add(F(CYL(0.22, 0.22, 0.05, 14), sx * 0.55, 1.53, 0.45), gry); K.add(F(BOX(0.8, 1.7, 0.7), sx * 2.05, 1.35, 0.6), blk); for (const y of [1.0, 1.65]) K.add(F(CYL(0.25, 0.25, 0.05, 12), sx * 2.05, y, 0.96, PI / 2), gry); }
  K.add(F(BOX(0.5, 0.08, 0.35), 0, 1.54, 0.45), gry);
  for (const sx of [-1, 1]) K.add(F(BOX(0.18, 3.4, 0.18), sx * 2.4, 2.2, -1.4), truss);
  K.add(F(BOX(5, 0.18, 0.18), 0, 3.8, -1.4), truss);
}
function bonfire(K, F) { // taş halka, odunlar ve çevresinde oturmalık kütükler
  const stone = M.mat('#8f8a84'), log = M.mat('#6b4a2e'), ash = M.mat('#3a3330');
  for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; K.add(F(ICO(0.17), Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55), stone); }
  K.add(F(CYL(0.45, 0.45, 0.04, 10), 0, 0.03, 0), ash);
  for (let i = 0; i < 3; i++) K.add(F(CYL(0.07, 0.07, 0.9, 6), 0, 0.15, 0, 0.25, (i / 3) * PI, PI / 2), log);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; K.add(F(CYL(0.2, 0.2, 1.3, 8), Math.cos(a) * 1.85, 0.2, Math.sin(a) * 1.85, 0, -a, PI / 2), log); }
}

// ---------- gemi: Martı cruise gemisi (36 m, önü +z) ----------
// 2026-11-08 (kullanıcı: "cruise gemisini geliştir üst kısımda bizimle insanlar olsun ve olanı geliştir"): bordada lacivert şerit ve MARTI ad
// levhası, pruvada çapa, direkli parmaklıklar (güneşlenme, baş ve kıç güvertesi, pruva), köprüyü saran camlar ve köprü kanatları, radar, baca
// bandı, mataforalarda kapaklı filikalar, direkten pruva gönderine ve bacaya bayrak dizisi, kıçta bayrak; güneşlenme güvertesinde denize bakan
// havlulu şezlonglar, mozaik kenarlı gömme havuz ve krom merdiven, jakuzi, kıçta küçük bar. Yolcu yerleri userData.pax: adacanli.js yerleştirir,
// kıpırdatır, varışta bizimle iskeleye indirir
function nameTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#f5f6f8'; x.fillRect(0, 0, 512, 128); // borda beyazı
  x.strokeStyle = '#d6392f'; x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(34, 72); x.quadraticCurveTo(64, 32, 94, 68); x.quadraticCurveTo(124, 32, 154, 72); x.stroke(); // martı
  x.fillStyle = '#1d2b52'; x.font = 'bold 92px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('MARTI', 332, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function bake(K, o, x, y, z, ry, s = 1) { // hazır modelin (şezlong) parçaları Kit'e: gemiyle tek çizimde birleşir
  o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.setScalar(s); o.updateMatrixWorld(true);
  o.traverse((m) => { if (m.isMesh) K.add(m.geometry.clone().applyMatrix4(m.matrixWorld), m.material); });
}
export function makeShip() {
  const g = new THREE.Group(), K = new Kit(), L = 36, W = 3.9, DY = 8.66;
  const white = M.mat('#f5f6f8'), navy = M.mat('#1d2b52'), red = M.mat('#d6392f'), glass = M.mat('#2f4f78', { rough: 0.3 }), wood = M.mat('#b98a5a');
  const pool = M.mat('#3cc8ea', { rough: 0.2 }), orange = M.mat('#f28a1e'), black = M.mat('#222428'), yellow = M.mat('#f6c343');
  const rail = M.mat('#e6eaef', { rough: 0.5 }), tile = M.mat('#d4ecf3'), spa = M.mat('#7fdcef', { rough: 0.2 }), teak = M.mat('#9a6a40');
  // gövde: üstten bakışta kıç yuvarlak, baş sivri; şekil y'si -z olur
  const hull = (w, y0, h) => {
    const s = new THREE.Shape();
    s.moveTo(-w, L / 2 - 1.5); s.quadraticCurveTo(-w, L / 2, -w + 1.5, L / 2); s.lineTo(w - 1.5, L / 2); s.quadraticCurveTo(w, L / 2, w, L / 2 - 1.5);
    s.lineTo(w, -L / 2 + 9); s.quadraticCurveTo(w * 0.95, -L / 2 + 2, 0, -L / 2); s.quadraticCurveTo(-w * 0.95, -L / 2 + 2, -w, -L / 2 + 9); s.closePath();
    const e = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
    e.rotateX(-PI / 2); e.translate(0, y0, 0);
    return e;
  };
  K.add(hull(W, -1.3, 1.9), navy); K.add(hull(W + 0.02, 0.55, 0.14), red); K.add(hull(W, 0.69, 3.7), white);
  K.add(hull(W + 0.015, 3.92, 0.16), navy); // borda şeridi
  // lumbozlar; baş tarafta ad levhası, pruvada çapa (borda orada 0,44 rad içe döner)
  for (const sx of [-1, 1]) for (const y of [2.0, 3.3]) for (let z = -15.5; z < 4.6; z += 1.1) K.add(part(BOX(0.06, 0.35, 0.55), sx * (W + 0.01), y, z), glass);
  const nameM = M.mat('#ffffff', { map: nameTex() });
  for (const sx of [-1, 1]) {
    K.add(part(new THREE.PlaneGeometry(3.4, 0.85), sx * (W + 0.025), 2.65, 6.9, 0, sx * PI / 2, 0), nameM);
    const ay = sx * (PI / 2 - 0.44), ax = sx * 2.78, az = 15.03;
    K.add(part(CYL(0.24, 0.24, 0.1, 12), ax, 3.65, az, 0, -sx * 0.44, PI / 2), black);
    K.add(part(BOX(0.07, 0.72, 0.07), ax, 3.2, az, 0, ay, 0), black); K.add(part(BOX(0.42, 0.06, 0.06), ax, 3.42, az, 0, ay, 0), black);
    K.add(part(new THREE.TorusGeometry(0.22, 0.045, 5, 10, PI), ax, 2.98, az, 0, ay, PI), black);
  }
  // güverteler: balkon camları
  K.add(part(BOX(2 * W - 0.6, 2.2, 25), 0, 5.5, -2), white);
  for (const sx of [-1, 1]) K.add(part(BOX(0.05, 0.9, 24), sx * (W - 0.29), 5.6, -2), glass);
  K.add(part(BOX(2 * W - 1.4, 2.0, 20), 0, 7.6, -3.5), white);
  for (const sx of [-1, 1]) K.add(part(BOX(0.05, 0.8, 19), sx * (W - 0.69), 7.7, -3.5), glass);
  // köprü: saran camlar, iki yanda kanat, üstte direk ve radar
  K.add(part(BOX(2 * W - 1.0, 1.4, 3.2), 0, 9.3, 5.2), white); K.add(part(BOX(2 * W - 1.1, 0.5, 0.05), 0, 9.45, 6.82), black);
  for (const sx of [-1, 1]) { K.add(part(BOX(0.05, 0.5, 2.9), sx * (W - 0.49), 9.45, 5.2), black); K.add(part(BOX(0.8, 0.08, 1.3), sx * (W - 0.1), DY, 6.0), white); }
  K.add(part(CYL(0.06, 0.08, 2.5, 6), 0, 11.2, 5.2), white); K.add(part(BOX(1.4, 0.08, 0.12), 0, 12.2, 5.2), white); K.add(part(BALL(0.26, 10, 7), 0, 12.62, 5.2), white);
  // güneşlenme güvertesi: döşeme, mozaik kenarlı gömme havuz ve krom merdiven, jakuzi, kıçta bar
  K.add(part(BOX(2 * W - 1.4, 0.06, 20), 0, 8.63, -3.5), wood); K.add(part(BOX(3.4, 0.08, 5), 0, 8.68, -4), pool);
  for (const sz of [-1, 1]) K.add(part(BOX(3.7, 0.1, 0.15), 0, 8.71, -4 + sz * 2.575), tile);
  for (const sx of [-1, 1]) K.add(part(BOX(0.15, 0.1, 5.3), sx * 1.775, 8.71, -4), tile);
  for (const x of [-0.28, 0.28]) K.add(part(new THREE.TorusGeometry(0.2, 0.022, 4, 8, PI), x, 8.72, -1.5, 0, PI / 2, 0, 1, 2.6, 1), rail);
  K.add(part(new THREE.CylinderGeometry(0.95, 0.95, 0.45, 16, 1, true), -2.0, DY + 0.225, -8.4), tile);
  K.add(part(new THREE.RingGeometry(0.8, 0.95, 16).rotateX(-PI / 2), -2.0, DY + 0.45, -8.4), white);
  K.add(part(CYL(0.8, 0.8, 0.04, 16), -2.0, DY + 0.38, -8.4), spa);
  K.add(part(BOX(0.55, 1.05, 1.7), 2.25, DY + 0.525, -12.4), teak); K.add(part(BOX(0.72, 0.06, 1.86), 2.22, DY + 1.08, -12.4), white);
  for (let i = 0; i < 4; i++) K.add(part(CYL(0.04, 0.045, 0.24, 6), 2.12, DY + 1.23, -13.0 + i * 0.4), M.mat(['#3f8f4a', '#c8553d', '#e0b84a', '#4f7fbf'][i], { rough: 0.25 }));
  for (const z of [-12.9, -11.9]) { K.add(part(CYL(0.2, 0.2, 0.06, 10), 1.55, DY + 0.72, z), red); K.add(part(CYL(0.035, 0.04, 0.7, 6), 1.55, DY + 0.35, z), rail); }
  // şezlonglar: iki yanda üçer, ayakucu denize, havlulu
  const towel = ['#4fc3e8', '#ff8a65', '#f2c14e'];
  for (const sx of [-1, 1]) [2.95, 1.85, 0.75].forEach((z, i) => bake(K, M.makeLounger(towel[(i + (sx > 0 ? 0 : 2)) % 3]), sx * 2.0, DY, z, sx * PI / 2));
  // baca: kırmızı, beyaz halka, lacivert bant, siyah ağız
  K.add(part(CYL(0.9, 1.2, 3.2, 12), 0, 10.25, -10, 0, 0, 0, 0.75, 1, 1), red); K.add(part(CYL(1.0, 1.05, 0.35, 12), 0, 10.7, -10, 0, 0, 0, 0.75, 1, 1), white);
  K.add(part(CYL(0.985, 1.02, 0.2, 12), 0, 11.25, -10, 0, 0, 0, 0.75, 1, 1), navy);
  K.add(part(CYL(0.92, 0.92, 0.4, 12), 0, 11.95, -10, 0, 0, 0, 0.75, 1, 1), black);
  // parmaklık: dikmeler, küpeşte ve orta ray
  const railRun = (x0, z0, x1, z1, y, h = 0.95) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.2));
    for (const k of [1, 0.5]) K.add(part(BOX(0.05, 0.05, len), (x0 + x1) / 2, y + h * k, (z0 + z1) / 2, 0, ry, 0), rail);
    for (let i = 0; i <= n; i++) { const t = i / n; K.add(part(CYL(0.025, 0.025, h, 5), x0 + (x1 - x0) * t, y + h / 2, z0 + (z1 - z0) * t), rail); }
  };
  for (const sx of [-1, 1]) railRun(sx * (W - 0.72), -13.45, sx * (W - 0.72), 3.6, DY);
  railRun(-(W - 0.72), -13.45, W - 0.72, -13.45, DY);
  for (const sx of [-1, 1]) railRun(sx * (W + 0.28), 5.4, sx * (W + 0.28), 6.6, DY, 0.9); // köprü kanadı
  for (const sx of [-1, 1]) railRun(sx * (W - 0.33), 6.6, sx * (W - 0.33), 10.45, 6.6); // baş güvertesi
  railRun(-(W - 0.33), 10.45, W - 0.33, 10.45, 6.6);
  for (const sx of [-1, 1]) { railRun(sx * (W - 0.08), -14.5, sx * (W - 0.08), -16.4, 4.39); railRun(sx * (W - 0.08), -16.4, sx * (W - 1.5), -17.85, 4.39); } // kıç
  railRun(-(W - 1.5), -17.85, W - 1.5, -17.85, 4.39);
  const bowPt = (t, sx) => [sx * (W - 0.12) * ((1 - t) ** 2 + 1.9 * t * (1 - t)), 9 * (1 - t) ** 2 + 32 * t * (1 - t) + 18 * t * t - 0.1];
  for (const sx of [-1, 1]) for (let t = 0.11; t < 0.9; t += 0.13) { const [ax, az] = bowPt(t, sx), [bx, bz] = bowPt(Math.min(0.92, t + 0.13), sx); railRun(ax, az, bx, bz, 4.39, 0.8); } // pruva
  // filikalar: turuncu tekne, beyaz kapak, iki matafora ve askı halatı
  const cap = () => new THREE.SphereGeometry(0.5, 10, 5, 0, PI * 2, 0, PI / 2);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    const z = -10 + i * 4, x = sx * (W + 0.08);
    K.add(part(BALL(0.5, 10, 6), x, 5.0, z, 0, 0, 0, 0.62, 0.42, 1.7), orange); K.add(part(cap(), x, 5.06, z, 0, 0, 0, 0.56, 0.6, 1.5), white);
    for (const dz of [-0.95, 0.95]) {
      K.add(part(CYL(0.035, 0.045, 1.9, 5), sx * (W - 0.24), 5.34, z + dz), rail);
      K.add(part(BOX(0.42, 0.06, 0.06), sx * (W - 0.05), 6.27, z + dz), rail);
      K.add(part(BOX(0.015, 0.85, 0.015), x, 5.83, z + dz), black);
    }
  }
  // bayrak dizisi: direkten pruva gönderine ve bacaya; kıçta bayrak
  const flagM = ['#d6392f', '#f6c343', '#2f8fc9', '#ffffff', '#3fae9a'].map((c) => M.mat(c, { side: THREE.DoubleSide }));
  const tri = () => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.13, 0, 0, 0.13, 0, -0.32, 0], 3));
  const line = (y0, z0, y1, z1) => {
    const dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dy, dz), n = Math.floor(len / 0.55);
    K.add(part(CYL(0.012, 0.012, len, 4), 0, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(dz, dy)), black);
    for (let i = 1; i < n; i++) K.add(part(tri(), 0, y0 + (dy * i) / n, z0 + (dz * i) / n), flagM[i % flagM.length]);
  };
  K.add(part(CYL(0.025, 0.03, 1.3, 5), 0, 5.0, 17.2), rail); line(12.4, 5.2, 5.62, 17.2); line(12.4, 5.2, 12.12, -10);
  K.add(part(CYL(0.025, 0.03, 1.4, 5), 0, 5.05, -17.55), rail); K.add(part(BOX(0.02, 0.42, 0.62), 0, 5.5, -17.9), red);
  // su kaydırağı: bacanın yanında aşağı dolanan sarı boru
  const pts = []; for (let i = 0; i <= 24; i++) { const a = i * 0.42; pts.push(new THREE.Vector3(1.6 + Math.cos(a) * 1.0, 11.3 - i * 0.11, -7 + Math.sin(a) * 1.0)); }
  K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.22, 6, false), yellow);
  K.build(g);
  g.userData.deck = { y: DY, x: 2.65, z: -0.6 }; // oyuncunun yolculukta durduğu yer: havuz yanında küpeşte dibi (dönüşte öbür yanda, adacanli.js)
  // yolcular: lie şezlongda (yer: şezlongun ortası), pool havuzda, edge havuz kenarında, tub jakuzide, wave el sallar, look bakar, crew barmen;
  // walk: varışta bizimle iskeleden iner
  g.userData.pax = [
    { k: 'lie', x: 2.0, y: DY, z: 2.95, ry: PI / 2 }, { k: 'lie', x: -2.0, y: DY, z: 1.85, ry: -PI / 2 }, { k: 'lie', x: -2.0, y: DY, z: 0.75, ry: -PI / 2 },
    { k: 'pool', x: 0.45, y: DY, z: -4, ry: 0 }, { k: 'edge', x: -1.85, y: DY, z: -5.2, ry: PI / 2 },
    { k: 'tub', x: -2.0, y: DY, z: -8.82, ry: 0 }, { k: 'tub', x: -2.0, y: DY, z: -7.98, ry: PI },
    { k: 'wave', x: -2.85, y: DY, z: -3.2, ry: -PI / 2, walk: 1 }, { k: 'wave', x: -2.85, y: DY, z: -4.2, ry: -PI / 2, walk: 1 }, { k: 'wave', x: 2.85, y: DY, z: -3.6, ry: PI / 2, walk: 1 },
    { k: 'look', x: -0.65, y: 6.6, z: 9.7, ry: 0, walk: 1 }, { k: 'look', x: 0.65, y: 6.6, z: 9.9, ry: 0.2, walk: 1, point: 1 }, { k: 'look', x: -0.8, y: DY, z: -13.0, ry: PI, walk: 1 },
    { k: 'crew', x: 2.85, y: DY, z: -12.4, ry: -PI / 2 },
  ];
  return g;
}

// ---------- jetski ve yunus (adacanli.js sürer) ----------
export function makeJetski(col = '#e8473c') {
  const g = new THREE.Group();
  M.rbox(0.72, 0.36, 2.0, 0.16, M.mat(col), 0, 0.1, 0, g);
  M.rbox(0.5, 0.2, 0.9, 0.08, M.mat('#2a2a2a'), 0, 0.34, -0.2, g);
  M.rbox(0.62, 0.22, 0.5, 0.1, M.mat('#ffffff'), 0, 0.28, 0.62, g);
  M.cyl(0.025, 0.025, 0.7, 6, M.mat('#2a2a2a'), 0, 0.52, 0.45, g).rotation.z = PI / 2;
  return g;
}
let DOLPHIN = null;
// 2026-11-08 (kullanıcı: "yunusları geliştir"): yuvarlak uzun gövde, alın çıkıntısı ve gaga, arkaya kıvrık sırt yüzgeci, yüzgeç kanatları,
// arkaya kıvrık kuyruk yüzgeci, gözler; sırtı koyu, karnı açık, yumuşak geçişli ıslak parlaklık. Kuyruk ayrı parça (userData.tail): yüzerken
// yukarı aşağı çırpar. Dönüş sırası YXZ: önce yön, sonra burun inip kalkar (sıçrayışta yan yatmaz)
export function makeDolphin() { // önü +z
  if (!DOLPHIN) {
    const back = new THREE.Color('#566e82'), belly = new THREE.Color('#e7edf0'), eye = new THREE.Color('#161c22'), c = new THREE.Color();
    const paint = (geo, eyes) => {
      const p = geo.attributes.position, col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (eyes && Math.abs(Math.abs(x) - 0.165) < 0.045 && Math.abs(y - 0.04) < 0.045 && Math.abs(z - 0.8) < 0.045) c.copy(eye);
        else { const k = Math.max(0, Math.min(1, (y + 0.1 + 0.04 * Math.sin(z * 4)) / 0.18)); c.copy(belly).lerp(back, k * k * (3 - 2 * k)); }
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    };
    const lathe = (pts, seg) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); g.rotateX(PI / 2); g.scale(0.88, 1, 1); return g; };
    const flat = (sh, d) => new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -d / 2);
    const body = lathe([[0.19, -0.6], [0.24, -0.35], [0.285, -0.05], [0.3, 0.2], [0.285, 0.45], [0.25, 0.64], [0.2, 0.78], [0.14, 0.87], [0.1, 0.92], [0.085, 1.0], [0.07, 1.12], [0.045, 1.2], [0, 1.24]], 14);
    const finSh = new THREE.Shape(); finSh.moveTo(0.2, 0); finSh.quadraticCurveTo(0.02, 0.16, -0.24, 0.42); finSh.quadraticCurveTo(-0.17, 0.2, -0.3, 0); finSh.lineTo(0.2, 0);
    const fin = flat(finSh, 0.05).rotateY(-PI / 2).translate(0, 0.24, -0.02);
    const flip = (s) => { const g = new THREE.ConeGeometry(0.085, 0.4, 6); g.scale(0.28, 1, 1); g.rotateZ(-s * 2.21); g.rotateX(0.9); g.translate(s * 0.23, -0.15, 0.42); return g; };
    const front = paint(mg([body, fin, flip(1), flip(-1), part(BALL(0.03, 8, 6), 0.165, 0.04, 0.8), part(BALL(0.03, 8, 6), -0.165, 0.04, 0.8)]), true);
    const stock = lathe([[0, -1.1], [0.04, -1.07], [0.075, -0.95], [0.12, -0.78], [0.165, -0.62], [0.2, -0.5], [0, -0.47]], 12);
    const fk = new THREE.Shape(); fk.moveTo(0, 0.06); fk.quadraticCurveTo(0.22, 0.03, 0.4, -0.2); fk.quadraticCurveTo(0.2, -0.1, 0, -0.07); fk.quadraticCurveTo(-0.2, -0.1, -0.4, -0.2); fk.quadraticCurveTo(-0.22, 0.03, 0, 0.06);
    const fluke = flat(fk, 0.035).rotateX(PI / 2).translate(0, 0, -1.07);
    const tail = paint(mg([stock, fluke]), false).translate(0, 0, 0.55); // dönme noktası gövdenin 0,55 m gerisinde
    DOLPHIN = { front, tail, mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.05 }) };
  }
  const g = new THREE.Group(), m = new THREE.Mesh(DOLPHIN.front, DOLPHIN.mat), tp = new THREE.Group(), t = new THREE.Mesh(DOLPHIN.tail, DOLPHIN.mat);
  tp.position.z = -0.55; tp.add(t); g.add(m, tp); g.rotation.order = 'YXZ';
  for (const o of [m, t]) { o.castShadow = true; o.userData.bkNo = true; o.userData.sd = true; }
  g.userData.tail = tp;
  return g;
}

// ---------- kara, deniz, taban ----------
function terrain() {
  const X0 = 808, X1 = 992, Z0 = -76, Z1 = 76, geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, 160, 132); // kenarı deniz tabanına (-3,2) iner
  geo.rotateX(-PI / 2); geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(), t = new THREE.Color();
  const C = { wet: '#e2c98e', sand: '#f2dca6', deep: '#3f93ad', grass: '#94cf5e', lush: '#76bd4c', dry: '#b9c27a', rock: '#a39b90', rockD: '#857d73', path: '#dcc79c', cobble: '#cfc4ae' };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = ground(x, z), e = edge(x, z);
    pos.setY(i, h);
    const sl = Math.hypot(ground(x + 0.6, z) - ground(x - 0.6, z), ground(x, z + 0.6) - ground(x, z - 0.6)) / 1.2;
    const n = 0.5 * Math.sin(x * 0.9 + z * 0.3) + 0.5 * Math.sin(z * 1.3 - x * 0.4);
    if (h < -0.06) c.set(C.wet).lerp(t.set(C.deep), Math.min(1, -h / 3));
    else if (sl > 0.55 || (h > 12 && sl > 0.38)) c.set(C.rock).lerp(t.set(C.rockD), 0.5 + 0.5 * n);
    else if (pathDist(x, z) < 0.7 + 0.1 * n) c.set(C.path); // yolun asıl yüzeyi decals(): burası altında kalan taban
    else if (Math.hypot(x - SQUARE.x, z - SQUARE.z) < 6.0) c.set(C.cobble).offsetHSL(0, 0, n * 0.03);
    else if (e > 0.75 - 0.025 * n && h < 1.3) c.set(C.sand).lerp(t.set(C.wet), Math.max(0, Math.min(1, (e - 0.96) / 0.04)));
    else if (h > 11.5) c.set(C.dry).offsetHSL(0, 0, n * 0.03);
    else c.set(x < 887 ? C.lush : C.grass).offsetHSL(0, 0, n * 0.035);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = true; m.userData.bkNo = true; m.userData.sd = true;
  return m;
}
// toprak yollar ve meydanın taşları (2026-11-08 kullanıcı: "adada merkeze giden toprak yol zeminleri çok low res olmuş kontrol et"):
// eskiden arazinin 1,15 m'lik köşe renkleriydi, kenarları bulanık ve tırtıklıydı. Şimdi arazinin 4 cm üstünde 0,4 m'lik ızgarada ayrı
// yüzey: dokulu (patika toprağı, meydanda arnavut kaldırımı), kenarı yumuşak ve hafif dalgalı. Saydam kenar için köşe rengi alfa taşır;
// derinlik yazmaz ve araziyle çakışmasın diye öne itilir (polygonOffset). Yalnız yolun üstündeki hücreler kurulur
function decals() {
  const wav = (x, z) => 0.5 * Math.sin(x * 1.7 + z * 0.6) + 0.5 * Math.sin(z * 2.3 - x * 0.9);
  const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
  const mk = (pos, col, uv, idx, map) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, vertexColors: true, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    m.receiveShadow = true; m.userData.bkNo = true; m.userData.sd = true;
    return m;
  };
  // yollar: yarı genişlik 0,85 m'ye dek dolu, 1,3 m'de biter; meydanın taşlarına girmez
  const S = 0.4, W0 = 0.85, W1 = 1.3;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const P of PATHS) for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  x0 -= 2; z0 -= 2; x1 += 2; z1 += 2;
  const nx = Math.ceil((x1 - x0) / S) + 1, nz = Math.ceil((z1 - z0) / S) + 1, A = new Float32Array(nx * nz), id = new Int32Array(nx * nz).fill(-1);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * S, z = z0 + j * S, d = pathDist(x, z) + 0.12 * wav(x, z);
    A[j * nx + i] = sm((W1 - d) / (W1 - W0)) * sm((Math.hypot(x - SQUARE.x, z - SQUARE.z) - 6.0) / 0.8);
  }
  const pos = [], col = [], uv = [], idx = [];
  const vert = (i, j) => {
    const n = j * nx + i;
    if (id[n] < 0) { const x = x0 + i * S, z = z0 + j * S, t = 0.9 + 0.1 * A[n]; id[n] = pos.length / 3; pos.push(x, ground(x, z) + 0.04, z); col.push(t, t, t, A[n]); uv.push(x / 2.6, z / 2.6); }
    return id[n];
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const n = j * nx + i;
    if (A[n] + A[n + 1] + A[n + nx] + A[n + nx + 1] <= 0) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  // meydan: 6,6 m'ye dek dolu, 7,1 m'de biter
  const p2 = [], c2 = [], u2 = [], i2 = [], NR = 18, NA = 64, R = 7.2;
  for (let r = 0; r <= NR; r++) for (let s = 0; s < NA; s++) {
    const rr = (r / NR) * R, a = (s / NA) * PI * 2, x = SQUARE.x + Math.cos(a) * rr, z = SQUARE.z + Math.sin(a) * rr, k = sm((7.1 - rr - 0.2 * wav(x, z)) / 0.5);
    p2.push(x, ground(x, z) + 0.045, z); c2.push(1, 1, 1, k); u2.push(x / 2.4, z / 2.4);
  }
  for (let r = 0; r < NR; r++) for (let s = 0; s < NA; s++) {
    const a = r * NA + s, b = r * NA + ((s + 1) % NA), c = a + NA, d = b + NA;
    i2.push(a, b, c, b, d, c);
  }
  return [mk(pos, col, uv, idx, texRep('path', 1, 1)), mk(p2, c2, u2, i2, texRep('cobble', 1, 1))];
}
export const SEA_U = { uTime: { value: 0 } };
// yarı saydam deniz: sığda kum görünür. Adanın çevresi (320 x 280 m, 2 m'lik ızgara) dalgalı; ötesi düz halka (yolculukta ufuk)
const SEA = { x: IX + 20, z: IZ, w: 320, d: 280 };
function sea() {
  const geo = new THREE.PlaneGeometry(SEA.w, SEA.d, SEA.w / 2, SEA.d / 2); geo.rotateX(-PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: '#2a9fd6', roughness: 0.16, metalness: 0.1, transparent: true, opacity: 0.8 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = SEA_U.uTime;
    const w = `
      float a1 = position.x * 0.32 + uTime * 1.05, a2 = position.z * 0.47 - uTime * 1.5 + position.x * 0.11, a3 = (position.x + position.z) * 0.85 + uTime * 2.2;`;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>${w}
      objectNormal = normalize(vec3(-(cos(a1) * 0.021 + cos(a2) * 0.0055 + cos(a3) * 0.019) * 2.2, 1.0, -(cos(a2) * 0.024 + cos(a3) * 0.019) * 2.2));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.y += sin(a1) * 0.065 + sin(a2) * 0.05 + sin(a3) * 0.022;`);
  };
  mat.customProgramCacheKey = () => 'adaDeniz';
  const m = new THREE.Mesh(geo, mat);
  m.position.set(SEA.x, -0.1, SEA.z); m.renderOrder = 1;
  const sh = new THREE.Shape([new THREE.Vector2(-700, -500), new THREE.Vector2(700, -500), new THREE.Vector2(700, 500), new THREE.Vector2(-700, 500)]);
  sh.holes.push(new THREE.Path([new THREE.Vector2(-SEA.w / 2, -SEA.d / 2), new THREE.Vector2(-SEA.w / 2, SEA.d / 2), new THREE.Vector2(SEA.w / 2, SEA.d / 2), new THREE.Vector2(SEA.w / 2, -SEA.d / 2)]));
  const og = new THREE.ShapeGeometry(sh); og.rotateX(-PI / 2);
  const out = new THREE.Mesh(og, new THREE.MeshStandardMaterial({ color: '#2a9fd6', roughness: 0.16, metalness: 0.1, transparent: true, opacity: 0.8 }));
  out.position.set(SEA.x, -0.1, SEA.z); out.renderOrder = 1;
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1000), new THREE.MeshStandardMaterial({ color: '#1f6f96', roughness: 1 }));
  bed.rotation.x = -PI / 2; bed.position.set(SEA.x, -3.25, SEA.z);
  for (const o of [m, out, bed]) { o.userData.bkNo = true; o.userData.sd = true; }
  return [m, out, bed];
}

// ---------- balık restoranı, deniz feneri, yamaç paraşütü (2026-11-04) ----------
function checkerTex(a, b) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * 8, j * 8, 8, 8); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t;
}
// doğu kumsalında denize uzanan ahşap güverte: kuzeyinde badanalı mutfak ve mermer tezgâh, altı masa (ekose örtü), ampullü ip
function tavern(K, root) {
  const T = TAVERN, y = T.y, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
  const wood = M.mat('#a8703f', { map: texRep('wood', 6, 0.6) }), post = M.mat('#7a4f2b'), lime = LIME(), blue = M.mat('#2f7fbf'), tile = M.mat('#c8553d');
  K.add(part(BOX(T.x1 - T.x0, 0.16, T.z1 - T.z0), cx, y - 0.08, cz), wood);
  for (let x = T.x0 + 0.4; x < T.x1; x += 2.4) for (const z of [T.z0 + 0.3, cz, T.z1 - 0.3]) K.add(part(CYL(0.1, 0.1, 2.6, 7), x, y - 1.35, z), post);
  // korkuluk: denize bakan doğu kenarı, mutfağın doğusunda kuzey kenarı, güneyin doğu yarısı (batıdan, kumsaldan girilir)
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.2));
    K.add(part(BOX(0.08, 0.08, len), (x0 + x1) / 2, y + 0.92, (z0 + z1) / 2, 0, a), post);
    for (let k = 0; k <= n; k++) K.add(part(BOX(0.07, 0.92, 0.07), x0 + ((x1 - x0) * k) / n, y + 0.46, z0 + ((z1 - z0) * k) / n), post);
    obsAdd({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: 0.06, hd: len / 2, ry: a });
  };
  rail(T.x1 - 0.1, T.z0 + 0.1, T.x1 - 0.1, T.z1 - 0.1); rail(958.2, T.z0 + 0.1, T.x1 - 0.1, T.z0 + 0.1); rail(959.5, T.z1 - 0.1, T.x1 - 0.1, T.z1 - 0.1);
  // mutfak: mavi kapı ve kepenkler, kiremit saçak, duvarda can simidi; önünde mermer tezgâh, üstünde ızgara balıklar
  const kx = 955.7, kz = -10.1;
  K.add(part(BOX(4.6, 2.5, 2.4), kx, y + 1.25, kz), lime);
  K.add(part(BOX(5.0, 0.14, 2.9), kx, y + 2.57, kz + 0.15), tile);
  K.add(part(BOX(0.9, 1.9, 0.06), kx - 1.5, y + 0.95, kz + 1.21), blue);
  K.add(part(BOX(1.0, 0.85, 0.03), kx + 0.9, y + 1.6, kz + 1.215), M.mat('#3a4652'));
  for (const sx of [-0.78, 0.78]) K.add(part(BOX(0.5, 0.9, 0.05), kx + 0.9 + sx, y + 1.6, kz + 1.22), blue);
  K.add(part(BOX(3.2, 1.0, 0.55), kx + 0.4, y + 0.5, kz + 1.75), lime);
  K.add(part(BOX(3.3, 0.06, 0.65), kx + 0.4, y + 1.03, kz + 1.75), M.mat('#e9e6df', { rough: 0.3 }));
  for (let i = 0; i < 4; i++) K.add(part(BALL(0.09, 6, 4), kx - 0.5 + i * 0.45, y + 1.1, kz + 1.75, 0, 0, 0, 1, 0.5, 2.2), M.mat('#c9894a'));
  K.add(part(new THREE.TorusGeometry(0.32, 0.08, 6, 14), kx + 2.32, y + 1.5, kz, 0, PI / 2), M.mat('#f26b3a'));
  obsAdd({ x: kx, z: kz, hw: 2.3, hd: 1.2 }); obsAdd({ x: kx + 0.4, z: kz + 1.75, hw: 1.6, hd: 0.28 });
  // masalar: iki sıra, üçer masa; her masada karşılıklı iki sandalye ve tabaklar
  const cloth = M.mat('#ffffff', { map: checkerTex('#2f7fbf', '#ffffff') }), leg = M.mat('#555a60'), chairM = M.mat('#3f7fbf'), plate = M.mat('#f7f7f2', { rough: 0.3 }), fish = M.mat('#c9894a');
  const seats = [], tables = [], busy = [0, 1, 4, 5, 6, 7, 10];
  for (const tz of [-6.3, -3.9]) for (const tx of [958.2, 961.0, 963.8]) {
    K.add(part(CYL(0.55, 0.55, 0.05, 14), tx, y + 0.76, tz), cloth); K.add(part(CYL(0.05, 0.09, 0.74, 7), tx, y + 0.37, tz), leg);
    obsAdd({ x: tx, z: tz, r: 0.5 }); tables.push({ x: tx, z: tz });
    for (const sx of [-1, 1]) {
      const x = tx + sx * 0.82, ry = sx > 0 ? -PI / 2 : PI / 2, F = frame(x, y, tz, ry);
      K.add(F(BOX(0.44, 0.05, 0.44), 0, 0.45, 0), chairM); K.add(F(BOX(0.44, 0.5, 0.05), 0, 0.72, -0.2), chairM);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) K.add(F(BOX(0.04, 0.45, 0.04), lx, 0.22, lz), leg);
      const px = tx + sx * 0.38;
      K.add(part(CYL(0.16, 0.13, 0.025, 12), px, y + 0.8, tz), plate);
      if (busy.includes(seats.length)) K.add(part(BALL(0.07, 6, 4), px, y + 0.835, tz, 0, 0, 0, 2.0, 0.5, 0.9), fish);
      seats.push({ x, z: tz, y, ry, c: null });
    }
  }
  // ampullü ip: dört direk arasında, akşamüstü sıcak ışık
  const bulb = M.mat('#fff4cc', { emissive: '#ffd27a', ei: 1 }), wire = M.mat('#333333');
  const C4 = [[958.4, -11.25], [T.x1 - 0.25, -11.25], [T.x1 - 0.25, T.z1 - 0.25], [T.x0 + 0.3, T.z1 - 0.25], [T.x0 + 0.5, -8.95]], H = y + 2.8;
  for (const [x, z] of C4.slice(0, 4)) { K.add(part(CYL(0.06, 0.07, 2.9, 7), x, y + 1.45, z), post); obsAdd({ x, z, r: 0.1 }); }
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = C4[i], [x1, z1] = C4[i + 1], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.9));
    K.add(part(BOX(0.02, 0.02, len), (x0 + x1) / 2, H, (z0 + z1) / 2, 0, Math.atan2(x1 - x0, z1 - z0)), wire);
    for (let k = 1; k < n; k++) { const t = k / n; K.add(part(BALL(0.06, 6, 4), x0 + (x1 - x0) * t, H - 0.1 - Math.sin(t * PI) * 0.18, z0 + (z1 - z0) * t), bulb); }
  }
  const sg = M.makeSign('🐟 BALIK RESTORANI', '#c0392b', 3.4, 0.7); sg.scale.setScalar(0.75); sg.position.set(951.6, ground(951.6, -4.5), -4.5); sg.rotation.y = -PI / 2; root.add(sg);
  obsAdd({ x: 951.6, z: -4.5, hw: 0.15, hd: 1.3 });
  RES.push({ x: cx, z: cz, r: 7.5 }, { x: 951.6, z: -4.5, r: 1.8 });
  return { seats, busy, pay: { x: kx + 0.2, z: kz + 2.75 }, cook: { x: kx + 0.4, z: kz + 1.28 },
    waiter: [[954.4, -7.6], [958.2, -5.1], [961.0, -5.1], [963.8, -5.1], [961.0, -5.1], [958.2, -5.1]] };
}
// kuzeydoğu burnunda beyaz-kırmızı bantlı deniz feneri (10 m), galeri ve fener odası; yanında kiremit çatılı bekçi evi
function lighthouse(K) {
  const P = polar(-0.26 * PI, 0.92), y = ground(P.x, P.z) - 0.15, stone = STONE(), white = M.mat('#f6f4ee'), red = M.mat('#d23a32'), dk = M.mat('#2e3338');
  const glass = M.mat('#fff4c2', { emissive: '#ffd36a', ei: 0.8, rough: 0.2 }), Hh = 9.6, n = 6;
  K.add(part(CYL(2.3, 2.6, 0.7, 12), P.x, y + 0.35, P.z), stone);
  for (let i = 0; i < n; i++) { const r0 = 1.35 - (0.45 * i) / n, r1 = 1.35 - (0.45 * (i + 1)) / n; K.add(part(CYL(r1, r0, Hh / n, 14), P.x, y + 0.7 + (i + 0.5) * (Hh / n), P.z), i % 2 ? red : white); }
  const top = y + 0.7 + Hh;
  K.add(part(CYL(1.45, 1.45, 0.16, 16), P.x, top + 0.08, P.z), dk);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * PI * 2; K.add(part(BOX(0.05, 0.7, 0.05), P.x + Math.cos(a) * 1.38, top + 0.5, P.z + Math.sin(a) * 1.38), dk); }
  K.add(part(new THREE.TorusGeometry(1.38, 0.03, 4, 24), P.x, top + 0.85, P.z, PI / 2), dk);
  K.add(part(CYL(0.72, 0.72, 1.2, 12), P.x, top + 0.76, P.z), glass);
  K.add(part(CONE(0.95, 0.85, 12), P.x, top + 1.8, P.z), red);
  K.add(part(BALL(0.16, 8, 6), P.x, top + 2.3, P.z), dk);
  const ix = 900 - P.x, iz = -P.z, il = Math.hypot(ix, iz), ux = ix / il, uz = iz / il; // adanın içine doğru
  K.add(part(BOX(0.8, 1.5, 0.12), P.x + ux * 1.18, y + 1.45, P.z + uz * 1.18, 0, Math.atan2(ux, uz)), M.mat('#2f5f8f')); // kapı adaya bakar
  obsAdd({ x: P.x, z: P.z, r: 1.5 });
  const hx = P.x + ux * 3.8 - uz * 4.4, hz = P.z + uz * 3.8 + ux * 4.4, hy = ground(hx, hz) - 0.1, ry = Math.atan2(P.x - hx, P.z - hz), F = frame(hx, hy, hz, ry);
  K.add(F(BOX(3.4, 2.4, 2.6), 0, 1.2, 0), white);
  for (const s of [-1, 1]) K.add(F(BOX(3.8, 0.12, 1.75), 0, 2.78, s * 0.7, s * 0.55), red);
  K.add(F(BOX(0.8, 1.6, 0.06), 0.6, 0.8, 1.31), M.mat('#2f5f8f'));
  for (const sx of [-1.0, -0.42]) K.add(F(BOX(0.4, 0.7, 0.05), sx, 1.45, 1.31), M.mat('#2f5f8f'));
  obsAdd({ x: hx, z: hz, hw: 1.75, hd: 1.35, ry });
  RES.push({ x: P.x, z: P.z, r: 3.2 }, { x: hx, z: hz, r: 2.8 });
  return { x: P.x, z: P.z, y: top + 0.76 };
}
// zirvenin batısında yamaç paraşütü kalkış yeri: yapay çim rampa, rüzgâr tulumu, katlanmış kanat, tabela
function launchPad(K, root) {
  const P = GLIDE, a = Math.atan2(892 - P.x, -36 - P.z), rx = Math.cos(a), rz = -Math.sin(a);
  // 2026-11-08 (kullanıcı: "yamaç paraşütü var oturmamış"): düz kutu yamaçta havada kalıyordu; çim rampa ve kenar çizgileri araziyi izler
  const drape = (w, d, sw, sd, ox, lift) => {
    const g = new THREE.PlaneGeometry(w, d, sw, sd); g.rotateX(-PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const lx = p.getX(i) + ox, lz = p.getZ(i), x = P.x + lx * Math.cos(a) + lz * Math.sin(a), z = P.z - lx * Math.sin(a) + lz * Math.cos(a); p.setXYZ(i, x, ground(x, z) + lift, z); }
    g.computeVertexNormals(); return g;
  };
  K.add(drape(3.0, 5.0, 6, 10, 0, 0.05), M.mat('#6fc24a'));
  for (const s of [-1, 1]) K.add(drape(0.1, 5.0, 1, 10, 1.5 * s, 0.075), M.mat('#ffffff'));
  const wx = P.x + rx * 2.6, wz = P.z + rz * 2.6, wy = ground(wx, wz);
  K.add(part(CYL(0.04, 0.05, 3.2, 6), wx, wy + 1.6, wz), M.mat('#dddddd'));
  K.add(part(CONE(0.2, 1.0, 8), wx + 0.5, wy + 3.05, wz, 0, 0, -PI / 2), M.mat('#ff7a1e'));
  obsAdd({ x: wx, z: wz, r: 0.12 });
  const bx = P.x - rx * 1.0, bz = P.z - rz * 1.0; // katlanmış kanat çantası
  const by = ground(bx, bz); K.add(part(BOX(1.0, 0.36, 0.6), bx, by + 0.17, bz, 0, a), M.mat('#ff5a3c')); K.add(part(BOX(1.02, 0.08, 0.62), bx, by + 0.27, bz, 0, a), M.mat('#ffd34d'));
  const sx = P.x - rx * 2.8, sz = P.z - rz * 2.8, sg = M.makeSign('🪂 YAMAÇ PARAŞÜTÜ', '#ff7a1e', 3.0, 0.65);
  sg.scale.setScalar(0.7); sg.position.set(sx, ground(sx, sz), sz); sg.rotation.y = a; root.add(sg);
  obsAdd({ x: sx, z: sz, hw: 1.1, hd: 0.15, ry: a });
  RES.push({ x: P.x, z: P.z, r: 4 }, { x: P.lx, z: P.lz, r: 2.5 });
}

// ---------- salaş kafeler (2026-11-04) ----------
// kumsalda hasır damlı derme çatma bar: palet döşeme, eski tahta tezgâh, kamış perde önünde raf ve şişeler, saçakta kumaş fenerler.
// Önünde kilim üstünde minder ve alçak masa, hasır şemsiye, pampas otu. Batıdaki (gün batımına bakar) hamak, sörf tahtaları ve meşaleli;
// doğudaki (restoranla iskele arası) palet kanepeli ve ampullü ipli. Oturanlar, barmen ve ödeme alanı adacanli.js'te.
// [ad, levha rengi, levhanın dünya yönü (güneye, kameraya ve adanın içine döner) ve yeri (yerel), kumsal açısı (π), kıyı uzaklığı, yarı genişlik,
// renkler (kilim zemini, minderler...), ikram, batı mı]
export const CAFES = [
  { name: '🌅 GÜN BATIMI KAFE', bg: '#e0703a', signRy: 0.35, sign: [3.6, -3.0], th: 0.872, e: 0.845, hw: 5.4, pal: ['#c8653d', '#e3a840', '#2f8f8a', '#efe4cf', '#b5523b'], buy: ['🍹 Meyve kokteyli', 'kokteyl'], west: true },
  { name: '🐚 SALAŞ KAFE', bg: '#2f9a94', signRy: -0.35, sign: [-2.6, -5.0], th: 0.032, e: 0.84, hw: 4.2, pal: ['#2f8f8a', '#efe4cf', '#d98c6a', '#e3c25a', '#3c6f9a'], buy: ['☕ Türk kahvesi', 'kahve'], west: false },
];
function kilimTex(p) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = p[0]; g.fillRect(0, 0, 64, 64);
  for (const [y, k] of [[3, 1], [9, 3], [52, 3], [58, 1]]) { g.fillStyle = p[k]; g.fillRect(0, y, 64, 3); }
  for (let i = 0; i < 4; i++) { const x = 8 + i * 16; g.fillStyle = p[i % 2 ? 2 : 3]; g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 7, 32); g.lineTo(x, 44); g.lineTo(x - 7, 32); g.fill(); g.fillStyle = p[1]; g.fillRect(x - 2, 30, 4, 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.rep = 'kilim' + p.join(''); return t;
}
function cafe(K, root, o) {
  const P = polar(o.th * PI, o.e), ry = P.ry, cx = P.x, cz = P.z, F = frame(cx, 0, cz, ry), hw = o.hw;
  const gAt = (lx, lz) => { const [x, z] = F.at(lx, lz); return ground(x, z); };
  const put = (geo, lx, ly, lz, m, rx = 0, rry = 0, rz = 0) => K.add(F(geo, lx, gAt(lx, lz) + ly, lz, rx, rry, rz), m); // o noktadaki kumun üstüne
  const tilt = (lx, lz, w, d) => [-Math.atan2(gAt(lx, lz + d / 2) - gAt(lx, lz - d / 2), d), Math.atan2(gAt(lx + w / 2, lz) - gAt(lx - w / 2, lz), w)]; // kilim kuma yatar
  const drift = M.mat('#b9a487', { map: texRep('wood', 2, 0.6) }), pallet = M.mat('#c9a679', { map: texRep('wood', 3, 0.8) }), postM = M.mat('#7a5c40');
  const thatch = M.mat('#d4b06a', { flat: true }), fringe = M.mat('#bf9550', { flat: true }), reed = M.mat('#cdb17a', { map: texRep('wood', 0.5, 3) });
  const rattan = M.mat('#ffffff', { map: checkerTex('#b8894a', '#d9b678') }), terra = M.mat('#c46a45'), plume = M.mat('#eadcbc', { flat: true }), cream = M.mat('#efe4cf');
  const reelM = M.mat('#a8703f'), brass = M.mat('#c9a24a', { rough: 0.35 }), cup = M.mat('#f7f4ec', { rough: 0.3 }), dk = M.mat('#3a3330');
  const kilim = M.mat('#ffffff', { map: kilimTex(o.pal) }), cush = o.pal.slice(1).map((c) => M.mat(c));
  // bar: palet döşeme, tezgâh, raflar, dört direk, hasır dam ve püskül saçak
  const [sx, sz] = F.at(0, -2.4), ys = ground(sx, sz) + 0.02, S = frame(sx, ys, sz, ry);
  K.add(S(BOX(5.4, 0.14, 2.8), 0, 0.05, 0), pallet);
  K.add(S(BOX(3.6, 1.0, 0.5), 0, 0.6, 0.85), drift); K.add(S(BOX(3.9, 0.08, 0.7), 0, 1.14, 0.85), postM); K.add(S(BOX(3.3, 0.62, 0.04), 0, 0.62, 1.12), rattan);
  K.add(S(BOX(5.4, 2.3, 0.06), 0, 1.27, -1.3), reed);
  for (const y of [1.2, 1.7]) K.add(S(BOX(3.6, 0.05, 0.36), 0, y, -1.08), drift);
  const glassC = ['#3f8f4a', '#c8553d', '#e0b84a', '#4f7fbf', '#8a5a9a', '#3f8f4a', '#e0b84a', '#c8553d'];
  for (let i = 0; i < 8; i++) for (const y of [1.36, 1.86]) K.add(S(CYL(0.045, 0.05, i % 3 ? 0.26 : 0.18, 6), -1.55 + i * 0.44 + (y > 1.5 ? 0.2 : 0), y, -1.08), M.mat(glassC[(i + (y > 1.5 ? 3 : 0)) % 8], { rough: 0.25 }));
  for (const x of [-2.6, 2.6]) for (const z of [-1.3, 1.3]) K.add(S(CYL(0.08, 0.1, 2.6, 6), x, 1.37, z, 0, 0, x * 0.01), postM);
  K.add(S(CONE(1, 1.0, 4).rotateY(PI / 4).scale(6.4 / 1.414, 1, 3.9 / 1.414), 0, 3.05, 0), thatch);
  for (const z of [-1.95, 1.95]) K.add(S(BOX(6.4, 0.3, 0.04), 0, 2.42, z), fringe);
  for (const x of [-3.2, 3.2]) K.add(S(BOX(0.04, 0.3, 3.9), x, 2.42, 0), fringe);
  for (let i = 0; i < 5; i++) { const x = -2.4 + i * 1.2; K.add(S(BOX(0.01, 0.22, 0.01), x, 2.36, 1.75), dk); K.add(S(BALL(0.14, 8, 6), x, 2.13, 1.75), M.mat(o.pal[1 + (i % 4)], { emissive: o.pal[1 + (i % 4)], ei: 0.35 })); }
  // makrome duvar süsü: çubuk, sarkan ipler
  K.add(S(CYL(0.02, 0.02, 1.0, 5), 1.75, 2.1, -1.24, 0, 0, PI / 2), postM);
  for (let i = 0; i < 7; i++) K.add(S(BOX(0.025, 0.5 + (3 - Math.abs(i - 3)) * 0.12, 0.012), 1.39 + i * 0.12, 1.83 - (3 - Math.abs(i - 3)) * 0.06, -1.23), cream);
  if (o.west) { // blender ve meyve kâsesi
    K.add(S(CYL(0.1, 0.12, 0.3, 8), -1.2, 1.33, 0.8), M.mat('#dfe8ea', { rough: 0.2 })); K.add(S(CYL(0.25, 0.18, 0.1, 10), 1.1, 1.23, 0.8), terra);
    for (let k = 0; k < 4; k++) K.add(S(BALL(0.07, 6, 4), 1.0 + (k % 2) * 0.16, 1.32 + (k > 1 ? 0.06 : 0), 0.74 + (k % 3) * 0.06), M.mat(k % 2 ? '#f39a3a' : '#f2d43a'));
  } else { // bakır cezve ocağı ve fincanlar
    K.add(S(BOX(0.5, 0.18, 0.35), -1.2, 1.27, 0.8), M.mat('#2e3338')); K.add(S(CYL(0.07, 0.09, 0.14, 8), -1.2, 1.43, 0.8), M.mat('#c46a2a', { rough: 0.3 }));
    for (let k = 0; k < 4; k++) K.add(S(CYL(0.045, 0.035, 0.07, 8), 0.7 + k * 0.18, 1.22, 0.8), cup);
  }
  obsAdd({ x: sx, z: sz, hw: 2.75, hd: 1.45, ry });
  // bar taburesi: tezgâhın iki ucunda (ortası ödeme alanı)
  for (const x of [-1.35, 1.35]) { put(CYL(0.2, 0.2, 0.06, 10), x, 0.75, -0.75, drift); put(CYL(0.04, 0.05, 0.74, 6), x, 0.37, -0.75, postM); const [bx, bz] = F.at(x, -0.75); obsAdd({ x: bx, z: bz, r: 0.22 }); }
  // oturma: kilim, alçak masa, çevresinde minder; seats [x, z, y, ry, h, leg]
  const seats = [];
  const seat = (lx, lz, tx, tz, h, leg) => { const [x, z] = F.at(lx, lz), [qx, qz] = F.at(tx, tz); seats.push({ x, z, y: ground(x, z), ry: Math.atan2(qx - x, qz - z), h, leg, c: null, ic: [...o.buy[0]][0] }); };
  const rug = (lx, lz, w, d) => { const [rx, rz] = tilt(lx, lz, w, d); put(BOX(w, 0.025, d), lx, 0.015, lz, kilim, rx, 0, rz); };
  const table = (lx, lz, reel) => {
    if (reel) { put(CYL(0.45, 0.45, 0.05, 12), lx, 0.025, lz, reelM); put(CYL(0.2, 0.2, 0.3, 10), lx, 0.2, lz, reelM); put(CYL(0.5, 0.5, 0.05, 12), lx, 0.37, lz, reelM); }
    else { put(CYL(0.44, 0.44, 0.03, 14), lx, 0.37, lz, brass); for (const a of [0, 1]) put(BOX(0.04, 0.5, 0.04), lx, 0.18, lz, postM, 0, a * PI / 2, 0.55); }
    for (let k = 0; k < 2; k++) { const a = k * 2.4 + lz; put(o.west ? CYL(0.05, 0.04, 0.16, 7) : CYL(0.045, 0.035, 0.07, 8), lx + Math.cos(a) * 0.2, o.west ? 0.47 : 0.43, lz + Math.sin(a) * 0.2, o.west ? M.mat('#f39a3a', { rough: 0.25 }) : cup); }
    const [x, z] = F.at(lx, lz); obsAdd({ x, z, r: 0.5 });
  };
  const cushion = (lx, lz, tx, tz, k) => { put(BALL(0.33, 9, 5).scale(1, 0.4, 1), lx, 0.11, lz, cush[k % cush.length]); seat(lx, lz, tx, tz, 0.22, -1.15); };
  const lounge = (lx, lz, reel, n) => { rug(lx, lz, 2.6, 2.2); table(lx, lz, reel); [[-0.85, 0], [0.85, 0], [0, 0.8], [0, -0.8]].slice(0, n).forEach(([dx, dz], k) => cushion(lx + dx, lz + dz, lx, lz, k + n)); };
  const parasol = (lx, lz) => { put(CYL(0.035, 0.035, 2.6, 6), lx, 1.3, lz, postM); put(CONE(1.2, 0.5, 10), lx, 2.52, lz, thatch); put(new THREE.CylinderGeometry(1.16, 1.22, 0.2, 10, 1, true), lx, 2.18, lz, fringe); }; // küçük: oturanlar üstten görünsün
  const pampas = (lx, lz) => { put(CYL(0.13, 0.17, 0.55, 8), lx, 0.27, lz, terra); for (let k = 0; k < 6; k++) { const a = k * 1.05; put(CONE(0.06, 0.8, 5), lx + Math.cos(a) * 0.08, 0.95, lz + Math.sin(a) * 0.08, plume, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); } const [x, z] = F.at(lx, lz); obsAdd({ x, z, r: 0.2 }); };
  let hammock = null;
  if (o.west) {
    lounge(-2.5, 1.5, false, 4); parasol(-2.5, 1.5);
    lounge(1.4, 1.7, true, 4); parasol(1.4, 1.7);
    // hamak: iki direk arasında, denize doğru; ortası 0,55 m'ye sarkar
    const hx = 4.6, z0 = -0.3, z1 = 2.3, n = 9, hy = gAt(hx, 1.0), Hm = frame(cx, hy, cz, ry), yAt = (t) => 1.0 - 0.45 * Math.sin(PI * t);
    for (const z of [-0.65, 2.65]) { K.add(Hm(CYL(0.07, 0.09, 2.0, 6), hx, 1.0 + gAt(hx, z) - hy, z), postM); const [px, pz] = F.at(hx, z); obsAdd({ x: px, z: pz, r: 0.12 }); }
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, za = z0 + (z1 - z0) * t0, zb = z0 + (z1 - z0) * t1, ya = yAt(t0), yb = yAt(t1);
      K.add(Hm(BOX(0.78, 0.03, Math.hypot(zb - za, yb - ya) + 0.02), hx, (ya + yb) / 2, (za + zb) / 2, -Math.atan2(yb - ya, zb - za)), cush[i % 2 ? 0 : 2]);
    }
    for (const [z, zc] of [[-0.65, z0], [2.65, z1]]) { const dy = 1.85 - yAt(0), dz = zc - z; K.add(Hm(BOX(0.02, 0.02, Math.hypot(dy, dz)), hx, (1.85 + yAt(0)) / 2, (z + zc) / 2, Math.atan2(dy, dz)), cream); }
    const [ax, az] = F.at(hx, 1.0); hammock = { x: ax, z: az, ry, y: hy + 0.1, c: null, k: 'hamak' };
    // sörf tahtaları barın yanına dayalı, ön köşelerde meşaleler
    [['#3fb5c9', -1.25, -0.35], ['#f28a5b', -1.65, -0.31]].forEach(([c, z, a]) => put(BALL(1, 12, 8).scale(0.26, 1.0, 0.035).rotateY(PI / 2), -2.96, 0.95, z, M.mat(c, { rough: 0.35 }), 0, 0, a));
    { const [x, z] = F.at(-3.15, -1.45); obsAdd({ x, z, r: 0.35 }); }
    for (const [lx, lz] of [[-4.7, 3.3], [3.3, 3.5]]) {
      put(CYL(0.035, 0.045, 1.6, 6), lx, 0.8, lz, M.mat('#c9a35a')); put(CYL(0.08, 0.06, 0.18, 7), lx, 1.66, lz, dk);
      put(CONE(0.075, 0.24, 6), lx, 1.87, lz, M.mat('#ffb347', { emissive: '#ff7a1e', ei: 1.2 })); const [x, z] = F.at(lx, lz); obsAdd({ x, z, r: 0.08 });
    }
    pampas(-3.4, -0.6); pampas(3.3, -0.9);
  } else {
    // palet kanepe denize bakar, önünde makara masa, karşısında iki minder; sağda kilimli minder köşesi
    { const lx = -2.0, lz = 0.55; rug(lx, 1.5, 2.8, 2.6);
      put(BOX(1.9, 0.3, 0.85), lx, 0.15, lz, pallet); put(BOX(1.8, 0.12, 0.75), lx, 0.36, lz + 0.03, cush[0]); put(BOX(1.8, 0.45, 0.16), lx, 0.55, lz - 0.38, cush[3]);
      for (const dx of [-0.6, 0.3]) put(BOX(0.42, 0.34, 0.12), lx + dx, 0.6, lz - 0.25, cush[(dx > 0 ? 1 : 2)], -0.2);
      seat(lx - 0.45, lz + 0.05, lx - 0.45, 3, 0.42, -1.45); seat(lx + 0.45, lz + 0.05, lx + 0.45, 3, 0.42, -1.45);
      table(lx, 1.65, true); cushion(lx - 0.45, 2.55, lx, 1.65, 2); cushion(lx + 0.45, 2.55, lx, 1.65, 3); }
    lounge(2.0, 1.5, false, 4); // gölgeliği ampullü ip (şemsiye ipe değerdi)
    // ampullü ip: barın ön direklerinden öndeki iki bambu direğe
    const bulb = M.mat('#fff4cc', { emissive: '#ffd27a', ei: 1 }), wire = M.mat('#333333'), H = 2.5;
    const C = [[-2.6, -1.1], [-3.9, 3.5], [3.9, 3.5], [2.6, -1.1]].map(([lx, lz]) => [lx, lz, gAt(lx, lz)]);
    for (const [lx, lz] of [C[1], C[2]]) { put(CYL(0.05, 0.06, 2.65, 7), lx, 1.32, lz, M.mat('#c9a35a')); const [x, z] = F.at(lx, lz); obsAdd({ x, z, r: 0.1 }); }
    for (let i = 0; i < 3; i++) {
      const [x0, z0, g0] = C[i], [x1, z1, g1] = C[i + 1], len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.8)), y0 = (i === 0 ? ys : g0) + H, y1 = (i === 2 ? ys : g1) + H;
      for (let k = 1; k < n; k++) { const t = k / n; K.add(F(BALL(0.06, 6, 4), x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 0.1 - Math.sin(t * PI) * 0.3, z0 + (z1 - z0) * t), bulb); }
      for (let k = 0; k < n; k++) { const ta = k / n, tb = (k + 1) / n, f = (t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * PI) * 0.3, z0 + (z1 - z0) * t], a = f(ta), b = f(tb);
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz), h = Math.hypot(dx, dz);
        K.add(F(BOX(0.015, 0.015, l).rotateX(-Math.atan2(dy, h)).rotateY(Math.atan2(dx, dz)), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), wire); } // önce eğim, sonra yön
    }
    // düş kapanı: saçağın sağ ucunda
    K.add(S(new THREE.TorusGeometry(0.22, 0.015, 5, 16), 2.75, 1.85, 1.75), cream);
    for (let k = 0; k < 3; k++) K.add(S(CONE(0.04, 0.22, 4), 2.6 + k * 0.15, 1.5 - (k % 2) * 0.08, 1.75, PI), M.mat(o.pal[2 + k % 3]));
    pampas(-3.3, -0.8); pampas(3.3, -0.8);
  }
  // levha: barın arkasında; güneye (kameraya) ve adanın içinden gelene bakar
  const [gx, gz] = F.at(...o.sign), sg = M.makeSign(o.name, o.bg, 3.4, 0.7);
  sg.scale.setScalar(0.72); sg.position.set(gx, ground(gx, gz), gz); sg.rotation.y = o.signRy; root.add(sg);
  obsAdd({ x: gx, z: gz, hw: 1.25, hd: 0.15, ry: o.signRy });
  RES.push({ x: cx, z: cz, r: hw + 1.0 }, { x: gx, z: gz, r: 1.6 });
  const [px, pz] = F.at(0, -0.3), [bx, bz] = F.at(0, -2.2);
  return { x: cx, z: cz, ry, seats, hammock, pay: { x: px, z: pz }, bar: { x: bx, z: bz, y: ys + 0.12 }, buy: o.buy,
    busy: o.west ? [0, 1, 3, 4, 6] : [0, 1, 3, 4, 5, 7] };
}

// ---------- kurulum ----------
// adacanli.js'e döner: kumsal yerleri, şezlonglar, tezgâhlar, sahne, ateş, gemi, değirmen kanatları, papağan ağaçları, çiçekler
export function buildLand(scene) {
  const root = new THREE.Group(); root.name = 'marti-adasi'; scene.add(root);
  root.add(terrain()); for (const m of sea()) root.add(m); for (const m of decals()) root.add(m);
  const K = new Kit(), L = { root };
  const flora = {
    palm: new Flora(palmP(0.9)), palm2: new Flora(palmP(1.7)), banana: new Flora(bananaP()),
    bougain: new Flora(bushP('#3f8f3a', '#d6338a', 16, 1.1, 0.16)), hibiscus: new Flora(bushP('#3d8a3a', '#e8344a', 8, 0.8, 0.13)),
    oleander: new Flora(bushP('#4a8f45', '#f58cb8', 14, 1.6, 0.12)), lavender: new Flora(lavenderP()), agave: new Flora(agaveP()), pear: new Flora(pearP()),
    lemon: new Flora(fruitP('#f2d43a')), orange: new Flora(fruitP('#f5a020')), fig: new Flora(figP()), olive: new Flora(oliveP()),
    cypress: new Flora(cypressP()), pine: new Flora(pineP()), fern: new Flora(fernP()), strel: new Flora(strelitziaP()), bamboo: new Flora(bambooP()),
    myellow: new Flora(meadowP('#f6d23a')), mwhite: new Flora(meadowP('#ffffff')), mred: new Flora(meadowP('#e8343a')), mpurple: new Flora(meadowP('#b77fe0')),
    thyme: new Flora(thymeP()), dune: new Flora(dunegrassP()), rock: new Flora(rockP(1.3, 0.75, 1)), rock2: new Flora(rockP(0.9, 1.0, 1.25)), bush: new Flora(bushP('#5a9a48', '', 0, 0.7)),
  };
  // kumsal yerleşimi (açı, kıyı uzaklığı): batıda ateş başında gitar, voleybol, şezlonglar ve tezgâhlar, futbol, DJ, doğuda su sporları
  const at = (th, e) => polar(th * PI, e);
  L.guitar = at(0.8, 0.86); L.volley = at(0.68, 0.87); L.foot = at(0.32, 0.87); L.dj = at(0.205, 0.83); L.djFloor = at(0.205, 0.925); L.hut = at(0.115, 0.9);
  L.jets = [at(0.1, 1.12), at(0.135, 1.12)]; L.pen = at(0.15, 1.22); L.frisbee = at(0.47, 0.93);
  L.stands = [['dondurma', 0.555], ['misir', 0.5], ['gazoz', 0.445]].map(([k, th]) => ({ k, ...at(th, 0.775) }));
  for (const [q, r] of [[L.guitar, 4.2], [L.volley, 9.5], [L.foot, 10], [L.dj, 4.5], [L.djFloor, 3.5], [L.hut, 3.5], [SQUARE, 7], [SUMMIT, 8], [MILL, 3.2], [L.frisbee, 8]]) RES.push({ x: q.x, z: q.z, r });
  for (const s of L.stands) RES.push({ x: s.x, z: s.z, r: 2.6 });
  // şezlong ve şemsiyeler: iki sıra
  const cols = ['#4fc3e8', '#ff8a65', '#f2c14e', '#7fd1c7', '#f28db2', '#9c8cf0'];
  L.loungers = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 8; i++) {
    const p = at(0.585 - i * (0.16 / 7) + row * 0.01, row ? 0.905 : 0.84), c = cols[(i + row * 3) % cols.length];
    const l = M.makeLounger(c); l.position.set(p.x, ground(p.x, p.z), p.z); l.rotation.y = p.ry; root.add(l);
    if (i % 2 === 0) { const u = M.makeUmbrella(cols[(i + 2 + row) % cols.length]); const [ux, uz] = [p.x + Math.cos(p.ry) * 1.15, p.z - Math.sin(p.ry) * 1.15]; u.position.set(ux, ground(ux, uz), uz); root.add(u); }
    L.loungers.push({ x: p.x, z: p.z, ry: p.ry, y: ground(p.x, p.z), c: null });
    RES.push({ x: p.x, z: p.z, r: 1.6 });
  }
  // tezgâhlar: arkasında levha, önünde ödeme alanı (adacanli.js)
  const SIGN = { dondurma: ['🍦 DONDURMA', '#f28db2'], misir: ['🌽 MISIR', '#e0a21c'], gazoz: ['🥤 GAZOZ', '#2f7fd8'] };
  for (const s of L.stands) {
    s.y = ground(s.x, s.z);
    const F = frame(s.x, s.y, s.z, s.ry);
    ({ dondurma: iceCart, misir: cornCart, gazoz: sodaStand })[s.k](K, F);
    const sg = M.makeSign(...SIGN[s.k], 2.2, 0.55); sg.scale.setScalar(0.72); const [gx, gz] = F.at(0, -1.45); sg.position.set(gx, ground(gx, gz), gz); sg.rotation.y = s.ry; root.add(sg);
    [s.px, s.pz] = F.at(0, 1.55); [s.vx, s.vz] = F.at(-0.25, -0.85);
    obsAdd({ x: s.x, z: s.z, hw: 1.0, hd: 0.55, ry: s.ry });
  }
  // su sporları kulübesi ve iki kiralama alanı (jetski solda, yunus sağda)
  { const h = L.hut; h.y = ground(h.x, h.z); const F = frame(h.x, h.y, h.z, h.ry); hut(K, F);
    const sg = M.makeSign('🚤 SU SPORLARI', '#2f8fc9', 2.6, 0.6); sg.scale.setScalar(0.75); const [gx, gz] = F.at(0, -1.6); sg.position.set(gx, ground(gx, gz), gz); sg.rotation.y = h.ry; root.add(sg);
    [h.jx, h.jz] = F.at(-1.0, 1.8); [h.dx, h.dz] = F.at(1.0, 1.8); [h.mx, h.mz] = F.at(0.3, -0.2); [h.bx, h.bz] = F.at(0, 3.6);
    obsAdd({ x: h.x, z: h.z, hw: 1.4, hd: 1.1, ry: h.ry }); }
  // voleybol ve futbol sahaları
  { const v = L.volley; v.y = ground(v.x, v.z); volleyCourt(K, frame(v.x, v.y, v.z, v.ry)); v.F = frame(v.x, 0, v.z, v.ry); for (const sz of [-1, 1]) { const [px, pz] = v.F.at(0, sz * 4.2); obsAdd({ x: px, z: pz, r: 0.12 }); } }
  { const f = L.foot; f.y = ground(f.x, f.z); footPitch(K, frame(f.x, f.y, f.z, f.ry)); f.F = frame(f.x, 0, f.z, f.ry); }
  // DJ sahnesi: LED ekran, ışıklar ve pist adacanli.js'te (müzikle yanıp söner)
  { const d = L.dj; d.y = ground(d.x, d.z); const F = frame(d.x, d.y, d.z, d.ry); djStage(K, F); d.F = F;
    const sg = M.makeSign('🎧 DJ', '#ff3fa4', 1.3, 0.48); sg.scale.setScalar(0.8); const [gx, gz] = F.at(0, -1.7); sg.position.set(gx, d.y + 2.1, gz); sg.rotation.y = d.ry; root.add(sg);
    obsAdd({ x: d.x, z: d.z, hw: 2.6, hd: 1.7, ry: d.ry }); }
  { const g = L.guitar; g.y = ground(g.x, g.z); bonfire(K, frame(g.x, g.y, g.z, g.ry)); g.F = frame(g.x, g.y, g.z, g.ry); obsAdd({ x: g.x, z: g.z, r: 0.75 }); }
  // yüzme alanı şamandıraları
  { const ball = M.mat('#f28a1e'), rope = M.mat('#f5f5f5');
    let prev = null;
    for (let th = 0.37; th <= 0.631; th += 0.012) { const p = at(th, 1.3); K.add(part(BALL(0.18, 7, 5), p.x, -0.05, p.z), ball); if (prev) { const dx = p.x - prev.x, dz = p.z - prev.z; K.add(part(BOX(0.03, 0.03, Math.hypot(dx, dz)), (p.x + prev.x) / 2, -0.06, (p.z + prev.z) / 2, 0, Math.atan2(dx, dz)), rope); } prev = p; } }
  // iskele ve gemi
  { const wood = M.mat('#a8703f', { map: texRep('wood', 6, 0.6) }), post = M.mat('#7a4f2b'), dk = M.mat('#2a2a2a'), J = JETTY, len = J.x1 - J.x0;
    K.add(part(BOX(len, 0.16, J.w), (J.x0 + J.x1) / 2, J.y - 0.08, J.z), wood);
    for (let x = J.x0 + 1; x < J.x1; x += 2.4) for (const sz of [-1, 1]) K.add(part(CYL(0.1, 0.1, 2.6, 7), x, J.y - 1.2, J.z + sz * (J.w / 2 - 0.1)), post);
    for (let x = J.x0 + 12; x < J.x1; x += 6) K.add(part(CYL(0.12, 0.15, 0.35, 8), x, J.y + 0.17, J.z - J.w / 2 + 0.2), dk);
    const sg = M.makeSign('🏝️ MARTI ADASI', '#2fb5a8', 2.8, 0.7); sg.position.set(J.x0 - 1.5, ground(J.x0 - 1.5, J.z + 2.6), J.z + 2.6); sg.rotation.y = -0.4; root.add(sg); }
  L.ship = makeShip(); L.ship.position.set(SHIP_DOCK.x, 0, SHIP_DOCK.z); L.ship.rotation.y = -PI / 2; root.add(L.ship); // baş batıya, adaya
  // taş evler ve meydan: çeşme, yaşlı zeytin, banklar, tavla masaları
  L.houses = HOUSES.map((H, i) => house(K, H, flora, i));
  { const stone = STONE(), lime = LIME(), water = M.mat('#58b8e0', { rough: 0.15 }), wood = M.mat('#9a6a3e'), S = SQUARE, y = ground(S.x, S.z);
    // çeşme (2026-11-08 kullanıcı: "fıskiyede bug var rengi gidip geliyor"): su yüzeyi havuzun kapağıyla aynı yükseklikteydi, ikisi titreşiyordu.
    // Havuz ve üst tas artık içi boş halka (dönel profil), su yüzeyi kenarın altında
    const ringG = (pts, n) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), n);
    K.add(part(ringG([[1.9, -0.2], [1.86, 0.64], [1.6, 0.67], [1.5, 0.6], [1.5, 0.3]], 8), S.x, y, S.z), stone); K.add(part(CYL(1.56, 1.56, 0.04, 16), S.x, y + 0.4, S.z), water);
    K.add(part(CYL(0.24, 0.3, 1.5, 8), S.x, y + 0.9, S.z), lime);
    K.add(part(ringG([[0, 1.56], [0.3, 1.57], [0.62, 1.83], [0.66, 1.87], [0.57, 1.87], [0.55, 1.77]], 10), S.x, y, S.z), lime); K.add(part(CYL(0.57, 0.57, 0.03, 10), S.x, y + 1.785, S.z), water);
    obsAdd({ x: S.x, z: S.z, r: 1.85 });
    L.benches = [];
    for (const a of [-0.35, 1.25, 2.85]) {
      const bx = S.x + Math.sin(a) * 4.6, bz = S.z + Math.cos(a) * 4.6, by = ground(bx, bz), ry = a + PI, F = frame(bx, by, bz, ry);
      K.add(F(BOX(1.7, 0.08, 0.45), 0, 0.45, 0), wood); K.add(F(BOX(1.7, 0.4, 0.06), 0, 0.72, -0.22, -0.15), wood);
      for (const sx of [-0.7, 0.7]) K.add(F(BOX(0.08, 0.45, 0.4), sx, 0.22, 0), M.mat('#555555'));
      L.benches.push({ x: bx, z: bz, ry, y: by }); obsAdd({ x: bx, z: bz, hw: 0.9, hd: 0.3, ry });
    }
    L.tavla = [];
    for (const [tx, tz] of [[909.5, 8.4], [909.8, 15.8]]) {
      const ty = ground(tx, tz); K.add(part(CYL(0.45, 0.45, 0.05, 12), tx, ty + 0.72, tz), wood); K.add(part(CYL(0.05, 0.08, 0.7, 6), tx, ty + 0.36, tz), M.mat('#555555'));
      K.add(part(BOX(0.55, 0.04, 0.38), tx, ty + 0.77, tz), M.mat('#7a4a2a'));
      for (const sz of [-1, 1]) { // dört ayaklı sandalye, arkalık dışta (2026-11-08: oturanların altında tabure görünmüyordu, havada sanılıyordu)
        const cz = tz + sz * 0.8, bk = cz + sz * 0.2;
        K.add(part(BOX(0.46, 0.05, 0.44), tx, ty + 0.45, cz), wood);
        for (const lx of [-0.19, 0.19]) for (const lz of [-0.18, 0.18]) K.add(part(BOX(0.05, 0.43, 0.05), tx + lx, ty + 0.215, cz + lz), wood);
        for (const lx of [-0.19, 0.19]) K.add(part(BOX(0.05, 0.55, 0.05), tx + lx, ty + 0.72, bk), wood);
        for (const yy of [0.78, 0.92]) K.add(part(BOX(0.44, 0.07, 0.04), tx, ty + yy, bk), wood);
      }
      L.tavla.push({ x: tx, z: tz, y: ty }); obsAdd({ x: tx, z: tz, r: 0.5 });
    }
    flora.olive.put(S.x - 5.2, S.z + 3.6, 1.7); obsAdd({ x: S.x - 5.2, z: S.z + 3.6, r: 0.4 }); occAdd(S.x - 5.2, S.z + 3.6, 2.4);
    const sg = M.makeSign('⛰️ ZİRVE PATİKASI', '#6a9a3a', 2.8, 0.6); sg.scale.setScalar(0.7); sg.position.set(911, ground(911, 5), 5); sg.rotation.y = -0.6; root.add(sg);
    const sb = M.makeSign('🌺 BOTANİK BAHÇE', '#d6338a', 2.8, 0.6); sb.scale.setScalar(0.7); sb.position.set(885, ground(885, 14.4), 14.4); sb.rotation.y = 0.5; root.add(sb); }
  // zirve (2026-11-08 kullanıcı: "adanın zirvesindeki kaleyi daha iyi konumlandır bir tık geliştir"): eskiden yamaçta yarı gömülü tek kule
  // kalıntısıydı. Şimdi zirve düzlüğünün (TOP) güney kenarında, köyden ve kumsaldan görünen küçük taş kale: mazgallı ana burç, kiremit
  // külahlı gözcü kulesi, kısa sur ve köşe kulesi; kemerli kapısı patikanın vardığı düzlüğe bakar. Her kulenin tabanı altındaki en alçak yere
  // iner, havada kalmaz. Bank güneye, dürbün kuzeybatıda denize bakar
  { const stone = STONE(), dark = M.mat('#2e2a26'), tile = M.mat('#b5523b'), wood = M.mat('#9a6a3e'), gr = M.mat('#555a60');
    const C = CASTLE, ry = Math.atan2(SUMMIT.x - C.x, SUMMIT.z - C.z), y0 = ground(C.x, C.z), F = frame(C.x, y0, C.z, ry);
    const low = (lx, lz, r) => { let m = ground(...F.at(lx, lz)); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; m = Math.min(m, ground(...F.at(lx + Math.cos(a) * r, lz + Math.sin(a) * r))); } return m - y0 - 0.35; };
    const merlons = (lx, lz, r, top, n, w) => { for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; K.add(F(BOX(w, 0.42, 0.26), lx + Math.cos(a) * r, top + 0.51, lz + Math.sin(a) * r, 0, -a - PI / 2), stone); } };
    const tower = (lx, lz, r, top, n, mer) => {
      const b = low(lx, lz, r * 1.1), h = top - b;
      K.add(F(CYL(r, r * 1.08, h, n), lx, b + h / 2, lz), stone);
      K.add(F(CYL(r * 1.12, r * 1.02, 0.3, n), lx, top + 0.15, lz), stone); // taş taç
      if (mer) merlons(lx, lz, r * 1.02, top, mer, r * 0.42);
      const [wx, wz] = F.at(lx, lz); obsAdd({ x: wx, z: wz, r: r * 1.12 });
    };
    tower(0, 0, 1.6, 4.4, 12, 10); // ana burç
    tower(-1.75, -0.45, 0.72, 5.4, 10, 0); K.add(F(CONE(0.98, 1.4, 10), -1.75, 6.4, -0.45), tile); // kiremit külahlı gözcü kulesi
    tower(3.75, -0.25, 0.62, 3.1, 9, 6); // köşe kulesi
    { const wb = low(2.45, -0.25, 1.0), wh = 2.3 - wb; K.add(F(BOX(1.9, wh, 0.5), 2.45, wb + wh / 2, -0.25), stone); // sur
      for (const lx of [1.8, 2.3, 2.8, 3.2]) K.add(F(BOX(0.3, 0.36, 0.5), lx, 2.48, -0.25), stone);
      const [wx, wz] = F.at(2.45, -0.25); obsAdd({ x: wx, z: wz, hw: 0.95, hd: 0.3, ry }); }
    const arch = (r, d) => new THREE.CylinderGeometry(r, r, d, 10, 1, false, 0, PI); // yarım daire kemer
    K.add(F(BOX(0.8, 1.25, 0.14), 0, 0.62, 1.6), dark); K.add(F(arch(0.4, 0.14), 0, 1.245, 1.6, 0, PI / 2, PI / 2), dark);
    K.add(F(BOX(0.62, 1.12, 0.06), 0, 0.58, 1.68), wood); K.add(F(arch(0.31, 0.06), 0, 1.14, 1.68, 0, PI / 2, PI / 2), wood);
    for (const [a, h] of [[PI, 2.4], [PI * 0.66, 3.3], [-PI * 0.66, 3.1], [PI * 0.18, 2.9], [-PI * 0.2, 2.6], [-PI * 0.5, 3.4]]) K.add(F(BOX(0.14, 0.55, 0.12), Math.cos(a) * 1.63, h, Math.sin(a) * 1.63, 0, Math.atan2(Math.cos(a), Math.sin(a))), dark); // mazgal pencereler
    { const a = PI * 1.1; K.add(F(BOX(0.12, 0.42, 0.1), -1.75 + Math.cos(a) * 0.75, 4.3, -0.45 + Math.sin(a) * 0.75, 0, Math.atan2(Math.cos(a), Math.sin(a))), dark); }
    K.add(F(CYL(0.04, 0.04, 2.6, 6), 0, 6.0, 0), M.mat('#dddddd')); // bayrak direği burcun ortasında
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 64; const x2 = cv.getContext('2d');
    x2.fillStyle = '#e30a17'; x2.fillRect(0, 0, 96, 64); x2.fillStyle = '#ffffff'; x2.beginPath(); x2.arc(36, 32, 16, 0, PI * 2); x2.fill();
    x2.fillStyle = '#e30a17'; x2.beginPath(); x2.arc(40, 32, 12.8, 0, PI * 2); x2.fill(); x2.fillStyle = '#ffffff'; x2.beginPath();
    for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? 3.4 : 8; x2.lineTo(55 + Math.cos(a - PI / 2) * r, 32 + Math.sin(a - PI / 2) * r); } x2.fill();
    const ft = new THREE.CanvasTexture(cv); ft.colorSpace = THREE.SRGBColorSpace;
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ map: ft, side: THREE.DoubleSide, roughness: 0.8 }));
    const [fx, fz] = F.at(0, 0); flag.position.set(fx + 0.78, y0 + 6.8, fz); flag.userData.bkNo = true; root.add(flag); L.flag = flag;
    const bx = SUMMIT.x - 1.5, bz = SUMMIT.z + 2.2, by = ground(bx, bz), BF = frame(bx, by, bz, 0.2);
    K.add(BF(BOX(1.7, 0.08, 0.45), 0, 0.45, 0), wood); K.add(BF(BOX(1.7, 0.4, 0.06), 0, 0.72, -0.22, -0.15), wood); for (const sx of [-0.7, 0.7]) K.add(BF(BOX(0.08, 0.45, 0.4), sx, 0.22, 0), gr);
    obsAdd({ x: bx, z: bz, hw: 0.9, hd: 0.3, ry: 0.2 });
    const tx = SUMMIT.x - 2.4, tz = SUMMIT.z - 1.7, tyy = ground(tx, tz);
    K.add(part(CYL(0.05, 0.07, 1.1, 6), tx, tyy + 0.55, tz), gr); K.add(part(CYL(0.09, 0.07, 0.6, 8), tx, tyy + 1.18, tz - 0.1, 1.2), gr); obsAdd({ x: tx, z: tz, r: 0.2 });
    L.bench = { x: bx, z: bz, y: by, ry: 0.2 }; }
  L.tavern = tavern(K, root); L.light = lighthouse(K); launchPad(K, root);
  L.cafes = CAFES.map((o) => cafe(K, root, o));
  // doğu sırtında taş yel değirmeni: kanatları adacanli.js döndürür
  { const lime = LIME(), wood = M.mat('#6b4a2e'), my = ground(MILL.x, MILL.z) - 0.2;
    K.add(part(CYL(1.45, 1.8, 5.6, 12), MILL.x, my + 2.8, MILL.z), lime); K.add(part(CONE(1.75, 1.7, 12), MILL.x, my + 6.45, MILL.z), wood);
    K.add(part(BOX(0.8, 1.6, 0.1), MILL.x, my + 0.8, MILL.z + 1.78, -0.12), M.mat('#2f8fc9')); K.add(part(BOX(0.5, 0.6, 0.1), MILL.x - 0.5, my + 3.4, MILL.z + 1.6, -0.12), M.mat('#3a4652'));
    obsAdd({ x: MILL.x, z: MILL.z, r: 1.85 });
    const sails = new THREE.Group(), SK = new Kit(), cloth = M.mat('#f3efe2'), spar = M.mat('#5a3f28');
    SK.add(CYL(0.22, 0.22, 0.5, 8).rotateX(PI / 2), spar);
    for (let k = 0; k < 4; k++) { const a = k * PI / 2; SK.add(part(BOX(0.12, 3.8, 0.08), Math.sin(a) * -1.9, Math.cos(a) * 1.9, 0.1, 0, 0, a), spar); SK.add(part(BOX(0.9, 3.0, 0.03), Math.sin(a) * -2.2 + Math.cos(a) * 0.5, Math.cos(a) * 2.2 + Math.sin(a) * 0.5, 0.12, 0, 0, a), cloth); }
    SK.build(sails); sails.position.set(MILL.x, my + 5.2, MILL.z + 1.95); root.add(sails); L.sails = sails; }
  // bitkiler: kumsal ardında palmiyeler, batıda botanik bahçe, dağda çam-servi-kekik, her yerde kır çiçekleri ve kayalar
  const beachBack = () => { const p = at(rand(0.08, 0.92), rand(0.72, 0.79)); return [p.x, p.z]; };
  const botanic = () => [rand(848, 888), rand(-16, 31)];
  const mountain = () => { const a = rand(0, PI * 2), r = rand(3, 26); return [PEAK.x + Math.cos(a) * r * 1.25, PEAK.z + Math.sin(a) * r]; };
  const inland = () => [rand(842, 962), rand(-44, 34)];
  const bo = { emax: 0.85, hmin: 0.2 };
  scatter(flora.palm, 16, beachBack, 0.9, 0.85, 1.15, { emax: 0.82, hmin: 0.15, trunk: 0.25, pathPad: 1.2 });
  scatter(flora.palm2, 10, beachBack, 0.9, 0.85, 1.1, { emax: 0.82, hmin: 0.15, trunk: 0.25, pathPad: 1.2 });
  scatter(flora.palm, 6, botanic, 0.9, 0.9, 1.2, { ...bo, trunk: 0.25 });
  scatter(flora.banana, 14, botanic, 0.9, 0.8, 1.2, { ...bo, trunk: 0.15 });
  scatter(flora.bamboo, 4, botanic, 0.9, 0.9, 1.1, { ...bo, trunk: 0.3 });
  scatter(flora.strel, 10, botanic, 0.6, 0.8, 1.2, bo);
  scatter(flora.hibiscus, 12, botanic, 0.7, 0.8, 1.2, bo);
  scatter(flora.oleander, 10, botanic, 0.8, 0.8, 1.2, bo);
  scatter(flora.bougain, 6, botanic, 0.8, 0.9, 1.2, bo);
  scatter(flora.fern, 18, botanic, 0.5, 0.8, 1.3, bo);
  scatter(flora.agave, 10, botanic, 0.7, 0.8, 1.2, bo);
  scatter(flora.pear, 8, botanic, 0.6, 0.8, 1.2, bo);
  scatter(flora.lemon, 4, botanic, 1.1, 0.85, 1.05, { ...bo, trunk: 0.22 });
  scatter(flora.orange, 4, botanic, 1.1, 0.85, 1.05, { ...bo, trunk: 0.22 });
  scatter(flora.fig, 3, botanic, 1.3, 0.9, 1.1, { ...bo, trunk: 0.25 });
  for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) { const x = 866 + i * 1.1, z = -6 + r * 1.3; if (freeSpot(x, z, 0.35, bo)) { flora.lavender.put(x, z, rand(0.9, 1.15)); occAdd(x, z, 0.35); } } // lavanta tarhı
  scatter(flora.olive, 12, inland, 1.2, 0.8, 1.2, { emax: 0.72, hmin: 0.4, hmax: 7, trunk: 0.25 });
  scatter(flora.cypress, 12, inland, 0.7, 0.85, 1.25, { emax: 0.72, hmin: 0.5, trunk: 0.2 });
  scatter(flora.pine, 34, mountain, 1.3, 0.8, 1.2, { emax: 0.95, hmin: 3, trunk: 0.25 });
  scatter(flora.cypress, 8, mountain, 0.7, 0.8, 1.1, { emax: 0.95, hmin: 3, trunk: 0.2 });
  scatter(flora.thyme, 40, mountain, 0.45, 0.8, 1.4, { emax: 0.98, hmin: 2.5, pathPad: 0.6 });
  scatter(flora.rock, 34, mountain, 0.8, 0.8, 2.2, { emax: 1.02, hmin: 2, trunk: 0.5 });
  scatter(flora.rock2, 24, () => { const p = polar(rand(-1.0, 0.05) * PI, rand(0.9, 1.04)); return [p.x, p.z]; }, 0.8, 0.8, 2.0, { emax: 1.06, hmin: -0.8, trunk: 0.5 }); // kuzey kıyısı kayalık
  scatter(flora.bush, 20, inland, 0.6, 0.8, 1.3, { emax: 0.75, hmin: 0.4 });
  for (const k of ['myellow', 'mwhite', 'mred', 'mpurple']) scatter(flora[k], 22, inland, 0.6, 0.8, 1.3, { emax: 0.76, hmin: 0.35, pathPad: 0.5 });
  scatter(flora.dune, 30, beachBack, 0.4, 0.8, 1.3, { emax: 0.8, hmin: 0.1, pathPad: 0.5 });
  for (const F of Object.values(flora)) F.build(root);
  K.build(root);
  // papağanların konacağı ağaçlar ve sinek kuşlarının çiçekleri (adacanli.js)
  L.perches = flora.palm.at.filter(([x]) => x < 892).map(([x, y, z, ry, s]) => ({ x: x + Math.cos(ry) * 0.9 * s, z: z - Math.sin(ry) * 0.9 * s, y: y + 4.95 * s })); // palmiye tepesi (0,9 m eğik)
  L.flowers = flora.hibiscus.at.concat(flora.oleander.at, flora.strel.at).map(([x, y, z, , s]) => ({ x, z, y: y + 1.0 * s }));
  return L;
}
