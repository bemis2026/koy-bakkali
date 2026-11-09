// Köy bakkalının arka duvarındaki evler (2026-11-08 kullanıcı: "köy bakkalı arka duvarı bir binası da olsun içi gözükmese de arkasında bir
// alana koy onu genişlet. şirin bir köy binası"). Duvarın hemen arkasından ana yolun kaldırımı geçer: evler duvarın üstüne üst kat olarak
// oturur, arkada kaldırımın üstüne ahşap payandalı çıkma yapar (eski Türk evi gibi). Ortada üçgen alınlıklı bakkal evi (dükkânın tabelası
// cephesinde durur), iki yanda komşu evler: dükkâna bakan cumba ya da küçük balkon, kepenkli perdeli pencereler, çiçek kasaları, kiremit
// dam, baca, birinde leylek yuvası. İçleri yok. Dükkân büyüdükçe arka duvarla birlikte uzar (world.js buildShop her aşamada yeniden kurar).
// Malzeme başına tek geometri: bir avuç çizim. Kafa hizasının çok üstünde: engel yok
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from './models.js';
import { texRep } from './tex.js';

const PI = Math.PI;
const ZF = -13.15, ZB = -14.2, ZM = (ZF + ZB) / 2, DEP = ZF - ZB; // cephe (dükkâna bakar) ve arka yüz (kaldırımın üstü; fenerler z −14,6'da)
const SIGN_W = [0, 4.6, 6.8, 8.6, 8.6]; // models.js makeShopStage tabela eni (aşamaya göre)
const SIDES = [ // komşu evlerin sıvası ve kepenkleri
  { wall: '#f1e6cf', sh: '#4f7f4a' }, { wall: '#e9c3b0', sh: '#3d6f9a' }, { wall: '#d9e3df', sh: '#8a4a2e' }, { wall: '#ecd3a0', sh: '#3d6f9a' },
];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
const BALL = (r, w = 6, h = 4) => new THREE.SphereGeometry(r, w, h);
// ölçek, dönüş (önce z, sonra y, sonra x), yer
function at(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
}
// üçgen prizma, tabanı y 0'da, tepesi rise yukarıda; sırtı x boyunca ya da (alongZ) z boyunca, half: tabanın yarı eni
function prism(len, half, rise, alongZ, open = false) {
  const g = new THREE.CylinderGeometry(1, 1, len, 3, 1, open);
  if (alongZ) { g.rotateX(-PI / 2); g.scale(half / 0.866, rise / 1.5, 1); } else { g.rotateZ(PI / 2); g.rotateX(-PI / 2); g.scale(1, rise / 1.5, half / 0.866); }
  return g.translate(0, rise / 3, 0);
}
function clean(g) {
  if (!g.index) { const n = g.attributes.position.count, a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; g.setIndex(new THREE.BufferAttribute(a, 1)); }
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  g.clearGroups();
  return g;
}
class Kit {
  constructor() { this.by = new Map(); }
  add(geo, m) { let l = this.by.get(m); if (!l) this.by.set(m, (l = [])); l.push(geo); }
  build(parent) {
    for (const [m, gs] of this.by) {
      const mesh = new THREE.Mesh(gs.length === 1 ? clean(gs[0]) : mergeGeometries(gs.map(clean), false), m);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.bkNo = true;
      parent.add(mesh);
    }
    return parent;
  }
}

export function makeShopHouse(n, s) {
  const g = new THREE.Group(), K = new Kit();
  g.name = 'bakkal-evi';
  const bh = n === 1 ? 2.6 : 3.2, X0 = s.x0 - 0.4, X1 = s.x1 + 0.4, cx = (s.x0 + s.x1) / 2, sw = SIGN_W[Math.min(4, n)];
  const m = {
    wood: M.mat('#6b4a2e'), glass: M.mat('#36485a', { rough: 0.3 }), lace: M.mat('#f6f0e6'), terra: M.mat('#c46a45'), leaf: M.mat('#3f8a3a'),
    red: M.mat('#e33b3b'), pink: M.mat('#f28db2'), tile: M.mat('#c8643c', { map: texRep('roof', 2, 1), side: THREE.DoubleSide }),
    brick: M.mat('#b9654a'), cap: M.mat('#8f8a82'), white: M.mat('#fbfbf8'), black: M.mat('#232323'), beak: M.mat('#e8673a'), nest: M.mat('#7a5a3a', { flat: true }),
  };
  // pencere: çerçeve, cam, kayıt, dantel perde, açık kepenkler, denizlik, çiçek kasası. dir +1 cephe (güney), −1 arka yüz (yol)
  const win = (x, y, zf, dir, sh, opt = {}) => {
    const z = (k) => zf + dir * k, w = opt.w || 0.86, h = opt.h || 1.3;
    K.add(at(BOX(w, h, 0.06), x, y, z(0.03)), m.wood);
    K.add(at(BOX(w - 0.16, h - 0.16, 0.04), x, y, z(0.05)), m.glass);
    K.add(at(BOX(0.05, h - 0.16, 0.03), x, y, z(0.075)), m.wood); K.add(at(BOX(w - 0.16, 0.05, 0.03), x, y + h * 0.14, z(0.075)), m.wood);
    for (const sd of [-1, 1]) K.add(at(BOX((w - 0.2) / 3, h * 0.46, 0.012), x + sd * (w - 0.2) / 3, y + h * 0.18, z(0.085)), m.lace);
    if (sh) for (const sd of [-1, 1]) K.add(at(BOX(w * 0.47, h, 0.04), x + sd * (w * 0.5 + w * 0.26), y, z(0.04)), sh);
    K.add(at(BOX(w + 0.14, 0.07, 0.18), x, y - h / 2 - 0.04, z(0.09)), m.wood);
    if (opt.box !== false) {
      K.add(at(BOX(w, 0.17, 0.2), x, y - h / 2 - 0.16, z(0.12)), m.terra);
      for (let k = 0; k < 3; k++) {
        K.add(at(BALL(0.13), x - w / 3 + (k * w) / 3, y - h / 2 - 0.01, z(0.13)), m.leaf);
        K.add(at(BALL(0.075), x - w / 3 + (k * w) / 3 + 0.04, y - h / 2 + 0.07, z(0.19)), k % 2 ? m.pink : m.red);
      }
    }
  };
  // ahşap iskelet (bağdadi): döşeme ve saçak kirişi, köşe dikmeleri; yanlarda köşe payandaları
  const frame = (x0, x1, y0, y1, brace) => {
    const w = x1 - x0, xc = (x0 + x1) / 2;
    for (const y of [y0 + 0.08, y1 - 0.07]) K.add(at(BOX(w + 0.04, 0.15, DEP + 0.04), xc, y, ZM), m.wood);
    for (const x of [x0 + 0.07, x1 - 0.07]) for (const z of [ZF + 0.01, ZB - 0.01]) K.add(at(BOX(0.14, y1 - y0, 0.04), x, (y0 + y1) / 2, z), m.wood);
    if (brace) for (const sd of [-1, 1]) { const bx = sd < 0 ? x0 + 0.42 : x1 - 0.42, len = Math.hypot(0.6, y1 - y0 - 0.3); K.add(at(BOX(0.09, len, 0.03), bx, (y0 + y1) / 2, ZF + 0.02, 0, 0, sd * Math.atan2(0.6, y1 - y0 - 0.3)), m.wood); }
  };
  // arka yüz: pencereler ve kaldırımın üstündeki çıkmanın payandaları
  const back = (x0, x1, y0, sh) => {
    const nw = Math.max(1, Math.floor((x1 - x0) / 2.3));
    for (let k = 0; k < nw; k++) win(x0 + ((x1 - x0) * (k + 0.5)) / nw, y0 + 1.4, ZB, -1, sh, { box: k % 2 === 0 });
    const nb = Math.max(2, Math.round((x1 - x0) / 1.6));
    for (let k = 0; k <= nb; k++) { const x = x0 + 0.15 + ((x1 - x0 - 0.3) * k) / nb, dz = ZB + 13.42, len = Math.hypot(dz, 0.62); K.add(at(BOX(0.1, len, 0.1), x, y0 - 0.31, (-13.42 + ZB) / 2 + 0.02, Math.atan2(-dz, 0.62)), m.wood); }
  };
  const chimney = (x, y, stork) => {
    K.add(at(BOX(0.44, 1.2, 0.44), x, y + 0.6, ZM - 0.05), m.brick); K.add(at(BOX(0.58, 0.08, 0.58), x, y + 1.24, ZM - 0.05), m.cap);
    if (!stork) { K.add(at(BOX(0.3, 0.16, 0.3), x, y + 1.36, ZM - 0.05), m.brick); return; }
    const t = y + 1.28, z = ZM - 0.05; // leylek yuvası ve leylek (yandan görünsün diye doğuya bakar)
    K.add(at(CYL(0.5, 0.36, 0.24, 10), x, t + 0.12, z), m.nest);
    for (let k = 0; k < 7; k++) { const a = k * 0.9; K.add(at(BOX(0.6, 0.035, 0.035), x + Math.cos(a) * 0.32, t + 0.2 + (k % 3) * 0.03, z + Math.sin(a) * 0.32, 0, -a + 1.2, 0.2), m.nest); }
    K.add(at(BALL(0.2, 8, 6), x, t + 0.7, z, 0, 0, 0.12, 1.45, 0.8, 0.75), m.white);
    K.add(at(BOX(0.34, 0.1, 0.3), x - 0.17, t + 0.72, z, 0, 0, 0.25), m.black);
    K.add(at(CYL(0.035, 0.05, 0.4, 6), x + 0.26, t + 0.92, z, 0, 0, -0.35), m.white);
    K.add(at(BALL(0.075, 8, 6), x + 0.33, t + 1.12, z), m.white);
    K.add(at(new THREE.ConeGeometry(0.03, 0.32, 6), x + 0.52, t + 1.08, z, 0, 0, -PI / 2 - 0.25), m.beak);
    for (const sd of [-1, 1]) K.add(at(CYL(0.012, 0.012, 0.5, 4), x + 0.02, t + 0.4, z + sd * 0.06), m.beak);
  };

  // ev sırası: ortada bakkal evi (tabelanın iki yanında birer pencere), iki yanda arta kalan yer 6,5 m'yi geçmeyen komşu evlere bölünür
  let mw = Math.min(X1 - X0, sw + 4.3), restL = cx - mw / 2 - X0, restR = X1 - (cx + mw / 2);
  if (Math.min(restL, restR) < 2.4) { mw = X1 - X0; restL = restR = 0; }
  const houses = [];
  const split = (a, b, side) => { const k = Math.ceil((b - a) / 6.5); for (let i = 0; i < k; i++) houses.push({ x0: a + ((b - a) * i) / k, x1: a + ((b - a) * (i + 1)) / k, side }); };
  if (restL > 0) split(X0, cx - mw / 2, -1);
  houses.push({ x0: cx - mw / 2, x1: cx + mw / 2, mid: true });
  if (restR > 0) split(cx + mw / 2, X1, 1);

  let si = 0, storkDone = false;
  for (const h of houses) {
    const w = h.x1 - h.x0, xc = (h.x0 + h.x1) / 2;
    if (h.mid) { // bakkal evi: badanalı, koyu ahşap iskelet, öne bakan üçgen alınlık ve yuvarlak pencere
      const H = 3.0, y1 = bh + H, wall = M.mat('#f7f1e5'), sh = M.mat('#4f7f4a');
      K.add(at(BOX(w, H, DEP), xc, bh + H / 2, ZM), wall);
      frame(h.x0, h.x1, bh, y1, false);
      const wy = bh + 1.45, off = sw / 2 + 1.05;
      if (w > sw + 3.6) for (const sd of [-1, 1]) win(xc + sd * off, wy, ZF, 1, sh);
      else win(xc + w / 2 - 1.0, wy, ZF, 1, sh);
      const rise = Math.min(2.6, w * 0.19);
      K.add(at(prism(DEP, w / 2, rise * (w / 2) / (w / 2 + 0.3), true), xc, y1, ZM), wall); // alınlık dolgusu
      K.add(at(prism(DEP + 0.7, w / 2 + 0.3, rise, true, true), xc, y1, ZM), m.tile);
      K.add(at(BOX(w + 0.6, 0.12, 0.12), xc, y1 + 0.02, ZF + 0.36), m.wood); // saçak tahtası
      K.add(at(CYL(0.4, 0.4, 0.06, 16), xc, y1 + rise * 0.42, ZF + 0.03, PI / 2), m.wood); K.add(at(CYL(0.3, 0.3, 0.06, 16), xc, y1 + rise * 0.42, ZF + 0.05, PI / 2), m.glass);
      for (const sd of [-1, 1]) K.add(at(BOX(0.05, 0.6, 0.03), xc, y1 + rise * 0.42, ZF + 0.08, 0, 0, sd * PI / 4), m.wood);
      back(h.x0 + 0.2, h.x1 - 0.2, bh, sh);
      continue;
    }
    // komşu ev: renkli sıva, iskelet, kepenkli pencereler; genişse cumba ya da balkon, damda baca
    const P = SIDES[si % SIDES.length], H = 2.8 + (si % 2) * 0.3, y1 = bh + H, wall = M.mat(P.wall), sh = M.mat(P.sh);
    K.add(at(BOX(w, H, DEP), xc, bh + H / 2, ZM), wall);
    frame(h.x0, h.x1, bh, y1, w > 3.4);
    const wy = bh + 1.4, extra = w >= 4.2 ? (si % 2 === 0 ? 'cumba' : 'balkon') : null, ex = xc + (h.side < 0 ? 0.3 : -0.3);
    const nw = Math.max(1, Math.floor((w - (extra ? 2.4 : 0.4)) / 1.75));
    const slots = [];
    if (extra) { const left = ex - 1.25 - h.x0, right = h.x1 - (ex + 1.25); for (let k = 0; k < nw; k++) slots.push(k % 2 === 0 ? (left > right ? h.x0 + left / 2 : ex + 1.25 + right / 2) : (left > right ? ex + 1.25 + right / 2 : h.x0 + left / 2)); }
    else for (let k = 0; k < nw; k++) slots.push(h.x0 + (w * (k + 0.5)) / nw);
    for (const x of [...new Set(slots.map((v) => +v.toFixed(2)))]) if (Math.abs(x - xc) < w / 2 - 0.8) win(x, wy, ZF, 1, sh);
    if (extra === 'cumba') { // dükkâna bakan cumba: ahşap payandalar üstünde, iki pencere, kiremit başlık
      const cy0 = bh + 0.38, ch = 1.9, cd = 0.6, cw = 2.1;
      K.add(at(BOX(cw, ch, cd), ex, cy0 + ch / 2, ZF + cd / 2), wall);
      for (const sd of [-1, 1]) win(ex + sd * 0.5, cy0 + 1.05, ZF + cd, 1, null, { w: 0.72, h: 1.1, box: false });
      for (const sd of [-1, 1]) K.add(at(BOX(0.04, 1.0, 0.36), ex + sd * (cw / 2 + 0.005), cy0 + 1.05, ZF + cd / 2), m.glass);
      K.add(at(BOX(cw + 0.06, 0.1, cd + 0.06), ex, cy0 + 0.05, ZF + cd / 2), m.wood); K.add(at(BOX(cw + 0.06, 0.1, cd + 0.06), ex, cy0 + ch - 0.05, ZF + cd / 2), m.wood);
      K.add(at(BOX(cw + 0.3, 0.06, cd + 0.3), ex, cy0 + ch + 0.12, ZF + cd / 2 + 0.05, 0.32), m.tile);
      for (const sd of [-1, 0, 1]) K.add(at(BOX(0.09, 0.62, 0.09), ex + sd * 0.85, cy0 - 0.22, ZF + 0.24, -0.85), m.wood);
    } else if (extra === 'balkon') { // küçük ahşap balkon: camlı kapı, parmaklık, saksılar
      const fy = bh + 0.6, bw = 2.2, bd = 0.55;
      K.add(at(BOX(bw, 0.1, bd), ex, fy, ZF + bd / 2), m.wood);
      win(ex, fy + 1.05, ZF, 1, sh, { w: 0.9, h: 1.95, box: false });
      K.add(at(BOX(bw, 0.06, 0.06), ex, fy + 0.85, ZF + bd - 0.03), m.wood);
      for (const sd of [-1, 1]) K.add(at(BOX(0.06, 0.06, bd), ex + sd * (bw / 2 - 0.03), fy + 0.85, ZF + bd / 2), m.wood);
      for (let k = 0; k <= 11; k++) K.add(at(BOX(0.035, 0.8, 0.035), ex - bw / 2 + 0.05 + (k * (bw - 0.1)) / 11, fy + 0.45, ZF + bd - 0.03), m.wood);
      for (const sd of [-1, 1]) { K.add(at(CYL(0.13, 0.1, 0.24, 8), ex + sd * 0.78, fy + 0.17, ZF + 0.25), m.terra); K.add(at(BALL(0.18), ex + sd * 0.78, fy + 0.4, ZF + 0.25), m.leaf); K.add(at(BALL(0.08), ex + sd * 0.78 + 0.05, fy + 0.52, ZF + 0.32), m.red); }
      for (const sd of [-1, 1]) K.add(at(BOX(0.09, 0.62, 0.09), ex + sd * 0.8, fy - 0.27, ZF + 0.2, -0.75), m.wood);
    }
    // dam: x boyunca beşik çatı (uçlarda 0,25 m taşar), alınlık dolgusu sıvalı; baca
    const rise = 0.95, half = DEP / 2 + 0.42;
    K.add(at(prism(w, DEP / 2, rise * (DEP / 2) / half), xc, y1, ZM), wall);
    K.add(at(prism(w + 0.5, half, rise, false, true), xc, y1, ZM), m.tile);
    K.add(at(BOX(w + 0.5, 0.1, 0.1), xc, y1 + 0.02, ZF + 0.4), m.wood);
    const stork = !storkDone && h.side > 0 && w >= 3.5;
    chimney(h.side < 0 ? h.x0 + 0.7 : h.x1 - 0.7, y1 + 0.2, stork); if (stork) storkDone = true;
    back(h.x0 + 0.2, h.x1 - 0.2, bh, sh);
    si++;
  }
  if (!storkDone) { const h = houses[houses.length - 1]; chimney(h.x1 - 0.9, bh + 3.0 + 0.2, true); }
  return K.build(g);
}
// yeniden kurulurken eski geometriler atılır (malzemeler M.mat önbelleğinde, paylaşılır: atılmaz)
export function disposeShopHouse(g) { g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); }
