// Çarpışma kutularını nesnenin gerçek izine uydurma (2026-11-08 kullanıcı: "bazı nesnelerin etrafından geçerken takılıyorum kontrol et
// nesnelerin kapladığı alanları tam şekliyle uyumlu olacak gibi optimize et"). Engeller dünyada eksene hizalı kutu: yuvarlak nesnenin
// (fıskiye, masa, kum kalesi) köşeleri, yan dönmüş nesnenin (traktör, buzluk) çapraz boşlukları, iki direkli tabelanın direk arası
// görünmez duvardı. Oyuncunun yakınındaki her kutu için kutunun içinde gövde boyunda (yerden 0,1-1,75 m) kalan üçgenlerin izdüşümü
// kutuya kırpılır, birbirine değen parçalar kümelenir, her kümenin dış bükey zarfı alınır: oyuncu (main.js resolve) bu çokgenlere
// çarpar. Kutu kalır (geniş evre); yalnız oyuncunun çarpışması incelir. Müşteri, eleman ve otomatik koşu yolları eskisi gibi kutuyla.
// Karakterler, hayvanlar, ürünler, birleşmiş toplu parçalar sayılmaz (perf.js asılları gizli katmanda durur, onlar sayılır).
// Görüntüsü olmayan kutu (görünmez duvar, kapı aralığı, kasiyer yeri), suyun üstündeki kutu ve neredeyse dolu kutu olduğu gibi kalır.
// İş zamana yayılır: karede en çok BUDGET ms, oyuncuya en yakın kutudan başlayarak; kutu sonradan yer değiştirirse yeniden uydurulur.
import * as THREE from 'three';
import { G } from './game.js';
import { heightAt } from './world.js';

const LO = 0.1, HI = 1.75; // zemine göre gövde boyu: yerdeki döşeme ve tepedeki tente, dal sayılmaz
const CELL = 2, NEAR = 10, BUDGET = 2.5, FULL = 0.9, GAP = 0.18, MERGE = 0.7; // MERGE: oyuncunun (çap 0,76) sığamayacağı aralık kapanır
const FIT = new WeakMap(); // kutu → { b: [x0, x1, z0, z1] uydurulduğu andaki kutu, polys: [Float64Array x,z,...] | null (kutu kalır), gen }
// GLB modeller sonradan yüklenip yer değiştirir: dizin 30 sn'de bir tazelenir, parça sayısı değiştiyse kuşak (GEN) artar ve yakındaki
// kutular yeniden uydurulur (o arada eski çokgen geçerli kalır)
let OFF = false, index = null, known = new WeakSet(), job = null, build = null, builtAt = -1e9, queue = [], queueT = 0, GEN = 0, lastMc = -1;
const key = (i, j) => i * 100003 + j;

// ---------- sahne dizini: durağan parçalar 2 m'lik hücrelerde ----------
const BB = new THREE.Box3(), M4 = new THREE.Matrix4(), V3 = new THREE.Vector3();
function* buildIndex() {
  const cells = new Map(), stack = [G.scene], seen = new WeakSet();
  let n = 0, mc = 0;
  const add = (rec) => {
    for (let i = Math.floor(rec.x0 / CELL); i <= Math.floor(rec.x1 / CELL); i++) for (let j = Math.floor(rec.z0 / CELL); j <= Math.floor(rec.z1 / CELL); j++) {
      const k = key(i, j); let L = cells.get(k); if (!L) cells.set(k, (L = [])); L.push(rec);
    }
  };
  for (const c of G.colliders) seen.add(c);
  while (stack.length) {
    const o = stack.pop(), u = o.userData;
    if (!o.visible || o === G.player || (u && (u.head || u.glbc || u.arms || u.animal || u.pet || u.bkNo))) continue; // karakter, hayvan, kımıldayan: altına inilmez
    for (let i = 0; i < o.children.length; i++) stack.push(o.children[i]);
    if ((++n & 255) === 0) yield;
    if (!o.isMesh || o.isSkinnedMesh || o.isBatchedMesh || u.baked || !o.geometry || !o.geometry.attributes.position) continue;
    mc++;
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
    if (o.isInstancedMesh) {
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, M4); M4.premultiply(o.matrixWorld); BB.copy(g.boundingBox).applyMatrix4(M4);
        if (BB.max.y < -1 || BB.min.y > 4) continue;
        add({ o, i, x0: BB.min.x, x1: BB.max.x, z0: BB.min.z, z1: BB.max.z });
      }
      continue;
    }
    BB.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
    if (BB.max.y < -1 || BB.min.y > 4) continue;
    add({ o, i: -1, x0: BB.min.x, x1: BB.max.x, z0: BB.min.z, z1: BB.max.z });
  }
  index = cells; known = seen; builtAt = G.time || 0;
  if (lastMc < 0 || Math.abs(mc - lastMc) > Math.max(20, lastMc * 0.02)) { if (lastMc >= 0) GEN++; lastMc = mc; } // raftaki ürünlerin gidip gelmesi sayılmaz
}

// ---------- uydurma ----------
function clip(poly, c) { // Sutherland-Hodgman: üçgenin izdüşümü kutuya
  for (let e = 0; e < 4; e++) {
    const ax = e < 2 ? 0 : 1, sg = e % 2 ? -1 : 1, lim = c[e], out = [], n = poly.length;
    for (let i = 0; i < n; i++) {
      const P = poly[i], Q = poly[(i + 1) % n], pi = sg * (P[ax] - lim) >= 0, qi = sg * (Q[ax] - lim) >= 0;
      if (pi) out.push(P);
      if (pi !== qi) { const t = (lim - P[ax]) / (Q[ax] - P[ax]); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
    }
    poly = out; if (!poly.length) return poly;
  }
  return poly;
}
function hull(P) {
  if (P.length < 3) return P;
  P.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-12) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up); // saat yönünün tersine (x sağa, z yukarı alınırsa)
}
const area = (H) => { let s = 0; for (let i = 0; i < H.length; i++) { const p = H[i], q = H[(i + 1) % H.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };
// köşe sayısını azaltır: alanı en az değiştiren köşe atılır (en çok 12 köşe, 1 cm²'den az etkileyenler hep)
function simplify(H) {
  while (H.length > 4) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < H.length; i++) {
      const a = H[(i + H.length - 1) % H.length], b = H[i], c = H[(i + 1) % H.length];
      const d = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (H.length <= 12 && bd > 0.0001) break;
    H.splice(best, 1);
  }
  return H;
}
const TA = new THREE.Vector3(), TB = new THREE.Vector3(), TC = new THREE.Vector3();
function* fit(c) {
  const b = [c[0], c[1], c[2], c[3]], w = b[1] - b[0], d = b[3] - b[2];
  const done = (polys) => { FIT.set(c, { b, polys, gen: GEN }); };
  if (!(w > 0.02 && d > 0.02) || w * d > 400) return done(null);
  // zemin: kutunun içinden dokuz nokta; suyun üstündeyse dokunulmaz (havuz, kıyı)
  const hs = [];
  for (const fx of [0.15, 0.5, 0.85]) for (const fz of [0.15, 0.5, 0.85]) hs.push(heightAt(b[0] + w * fx, b[2] + d * fz));
  if (Math.min(...hs) < -0.1) return done(null);
  hs.sort((p, q) => p - q);
  const y0 = hs[4] + LO, y1 = hs[4] + HI;
  const units = [], seen = new Set();
  for (let i = Math.floor(b[0] / CELL); i <= Math.floor(b[1] / CELL); i++) for (let j = Math.floor(b[2] / CELL); j <= Math.floor(b[3] / CELL); j++) {
    for (const r of index.get(key(i, j)) || []) {
      if (seen.has(r) || r.x1 < b[0] || r.x0 > b[1] || r.z1 < b[2] || r.z0 > b[3]) continue;
      seen.add(r);
      // tamamen kutunun içinde kalan parça kutunun asıl nesnesidir: alçak da olsa sayılır (havuz suyu, saman yatağı); zemin döşemesi kutudan büyüktür
      const inBox = r.x0 >= b[0] - 0.3 && r.x1 <= b[1] + 0.3 && r.z0 >= b[2] - 0.3 && r.z1 <= b[3] + 0.3, lo = inBox ? hs[4] - 0.05 : y0;
      const o = r.o, g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count;
      let mw = o.matrixWorld;
      if (r.i >= 0) { o.getMatrixAt(r.i, M4); M4.premultiply(o.matrixWorld); mw = M4.clone(); }
      for (let t = 0; t < n; t += 3) {
        TA.fromBufferAttribute(P, I ? I.getX(t) : t).applyMatrix4(mw);
        TB.fromBufferAttribute(P, I ? I.getX(t + 1) : t + 1).applyMatrix4(mw);
        TC.fromBufferAttribute(P, I ? I.getX(t + 2) : t + 2).applyMatrix4(mw);
        if (Math.max(TA.y, TB.y, TC.y) < lo || Math.min(TA.y, TB.y, TC.y) > y1) continue;
        if (Math.max(TA.x, TB.x, TC.x) < b[0] || Math.min(TA.x, TB.x, TC.x) > b[1] || Math.max(TA.z, TB.z, TC.z) < b[2] || Math.min(TA.z, TB.z, TC.z) > b[3]) continue;
        const q = clip([[TA.x, TA.z], [TB.x, TB.z], [TC.x, TC.z]], b);
        if (q.length) units.push(q);
        if ((t & 1023) === 0) yield;
      }
      yield;
    }
  }
  if (!units.length) return done(null); // görüntüsü yok: bilerek konmuş görünmez engel
  // kümeleme: birbirine GAP'ten yakın parçalar aynı kümede (birleşim-bul, hücre ızgarasıyla)
  const par = units.map((_, i) => i), find = (i) => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  const grid = new Map(), G2 = GAP;
  units.forEach((q, ui) => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of q) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    const cells = [], ci0 = Math.floor(x0 / G2), ci1 = Math.floor(x1 / G2), cj0 = Math.floor(z0 / G2), cj1 = Math.floor(z1 / G2);
    if ((ci1 - ci0 + 1) * (cj1 - cj0 + 1) <= 64) { for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) cells.push(key(i, j)); }
    else for (let e = 0; e < q.length; e++) { // büyük parça: yalnız kenarları boyunca
      const A = q[e], B = q[(e + 1) % q.length], m = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / (G2 * 0.7)));
      for (let s = 0; s <= m; s++) cells.push(key(Math.floor((A[0] + (B[0] - A[0]) * s / m) / G2), Math.floor((A[1] + (B[1] - A[1]) * s / m) / G2)));
    }
    for (const k of cells) for (const kk of [k, k + 1, k - 1, k + 100003, k - 100003]) { const o = grid.get(kk); if (o !== undefined) par[find(ui)] = find(o); }
    for (const k of cells) if (!grid.has(k)) grid.set(k, ui);
  });
  const groups = new Map();
  units.forEach((q, ui) => { const r = find(ui); let L = groups.get(r); if (!L) groups.set(r, (L = [])); for (const p of q) L.push(p); });
  let polys = [];
  for (const L of groups.values()) {
    let H = hull(L);
    if (H.length < 3) { // çizgi (ince levha, çit teli): 2 cm kalınlık verilir
      const [p, q] = [L[0], L[L.length - 1]], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz) || 1, nx = -dz / len * 0.01, nz = dx / len * 0.01;
      H = [[p[0] - nx, p[1] - nz], [q[0] - nx, q[1] - nz], [q[0] + nx, q[1] + nz], [p[0] + nx, p[1] + nz]];
      if (area(H) < 0) H.reverse();
    }
    H = simplify(H);
    polys.push(H);
  }
  const inside = (H, x, z) => { for (let i = 0; i < H.length; i++) { const p = H[i], q = H[(i + 1) % H.length]; if ((q[0] - p[0]) * (z - p[1]) - (q[1] - p[1]) * (x - p[0]) < -1e-9) return false; } return true; };
  // oyuncunun geçemeyeceği kadar yakın kümeler birleşir (masa ile sandalye arası): dar oyuğa sıkışıp takılmaz
  const segD = (p, a, q) => { const ex = q[0] - a[0], ez = q[1] - a[1], L2 = ex * ex + ez * ez, t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2)) : 0; return Math.hypot(p[0] - a[0] - ex * t, p[1] - a[1] - ez * t); };
  const cross = (a, b2, c2, d2) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b2, c2) !== o(a, b2, d2) && o(c2, d2, a) !== o(c2, d2, b2); };
  const dist = (A, B) => {
    if (A.some((p) => inside(B, p[0], p[1])) || B.some((p) => inside(A, p[0], p[1]))) return 0;
    let m = 1e9;
    for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
      const a = A[i], a2 = A[(i + 1) % A.length], q = B[j], q2 = B[(j + 1) % B.length];
      if (cross(a, a2, q, q2)) return 0;
      m = Math.min(m, segD(a, q, q2), segD(q, a, a2));
    }
    return m;
  };
  for (let again = true; again && polys.length > 1;) {
    again = false;
    for (let i = 0; i < polys.length && !again; i++) for (let j = i + 1; j < polys.length && !again; j++) {
      if (dist(polys[i], polys[j]) >= MERGE) continue;
      polys[i] = simplify(hull(polys[i].concat(polys[j]))); polys.splice(j, 1); again = true;
    }
  }
  // başka bir çokgenin içinde kalan küçük çokgen atılır (masa üstündeki bardak)
  polys.sort((p, q) => area(q) - area(p));
  polys = polys.filter((H, i) => !polys.slice(0, i).some((K) => H.every((p) => inside(K, p[0], p[1]))));
  const sum = polys.reduce((s, H) => s + area(H), 0);
  if (sum >= FULL * w * d) return done(null); // neredeyse dolu: kutu yeter
  done(polys.map((H) => Float64Array.from(H.flat())));
}

// ---------- her kare: oyuncunun yakınındaki uydurulmamış kutular ----------
export function updateColFit() {
  if (!G.player || !G.colliders || !(G.time > 3)) return; // açılışta modeller yerine otursun
  const t0 = performance.now(), p = G.player.position;
  if (!build && index && (G.time || 0) - builtAt > 30) build = buildIndex();
  try {
    while (performance.now() - t0 < BUDGET) {
      if (build) { if (build.next().done) build = null; continue; }
      if (job) { if (job.next().done) job = null; continue; }
      if ((queueT -= 1) <= 0 || !queue.length) { // aday listesi seyrek tazelenir
        queueT = 20;
        queue = [];
        for (const c of G.colliders) {
          const f = FIT.get(c);
          if (f && f.gen === GEN && f.b[0] === c[0] && f.b[1] === c[1] && f.b[2] === c[2] && f.b[3] === c[3]) continue;
          const dx = Math.max(c[0] - p.x, 0, p.x - c[1]), dz = Math.max(c[2] - p.z, 0, p.z - c[3]);
          if (dx < NEAR && dz < NEAR) queue.push([dx * dx + dz * dz, c]);
        }
        queue.sort((a, b2) => b2[0] - a[0]); // en yakın sonda
        if (!queue.length) break;
      }
      const c = queue.pop()[1];
      if (!G.colliders.includes(c)) continue;
      if (!index || (!known.has(c) && (G.time || 0) - builtAt > 1)) { queue.push([0, c]); build = buildIndex(); continue; } // yeni kurulan engel: dizin tazelenir
      job = fit(c);
    }
  } catch (e) { console.warn('çarpışma uydurma', e); job = build = null; }
}

// oyuncu (main.js): uydurulmuş çokgenler; kutu sonradan değiştiyse null (kutu kullanılır, yeniden uydurulur)
export function shapeOf(c) {
  if (OFF) return null;
  const f = FIT.get(c);
  if (!f || !f.polys || f.b[0] !== c[0] || f.b[1] !== c[1] || f.b[2] !== c[2] || f.b[3] !== c[3]) return null;
  return f.polys;
}
// daire–dış bükey çokgen: çokgenin dışındaysa en yakın noktasından, içindeyse en az batılan kenardan dışarı itilir. OUT[0..1] yeni yer
export const OUT = [0, 0];
export function pushPoly(H, x, z, R) {
  const n = H.length >> 1;
  let ins = true, best = 1e18, cx = 0, cz = 0, pen = 1e18, nx = 0, nz = 0;
  for (let i = 0; i < n; i++) {
    const ax = H[i * 2], az = H[i * 2 + 1], j = (i + 1) % n, ex = H[j * 2] - ax, ez = H[j * 2 + 1] - az, L2 = ex * ex + ez * ez;
    if (L2 < 1e-12) continue;
    const L = Math.sqrt(L2), ox = ez / L, oz = -ex / L, s = (x - ax) * ox + (z - az) * oz; // dışa dönük normal ve işaretli uzaklık
    if (s > 0) ins = false;
    if (-s < pen) { pen = -s; nx = ox; nz = oz; }
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / L2)), px = ax + ex * t, pz = az + ez * t, dd = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (dd < best) { best = dd; cx = px; cz = pz; }
  }
  if (ins) { OUT[0] = x + nx * (pen + R); OUT[1] = z + nz * (pen + R); return true; }
  if (best >= R * R) return false;
  const dd = Math.sqrt(best), k = (R - dd) / dd;
  OUT[0] = x + (x - cx) * k; OUT[1] = z + (z - cz) * k;
  return true;
}
// nokta çokgenin (h payıyla) içinde mi
export function inPoly(H, x, z, h = 0) {
  const n = H.length >> 1;
  for (let i = 0; i < n; i++) {
    const ax = H[i * 2], az = H[i * 2 + 1], j = (i + 1) % n, ex = H[j * 2] - ax, ez = H[j * 2 + 1] - az, L = Math.hypot(ex, ez);
    if (L < 1e-6) continue;
    if (((x - ax) * ez - (z - az) * ex) / L > -h) return false;
  }
  return true;
}

// test kancası: 'all' oyuncunun yakınını beklemeden hepsini uydurur; 'draw' kutuları (kırmızı) ve çokgenleri (yeşil) çizer
window.__colfit = (k, arg) => {
  if (k === 'all') {
    const it = buildIndex(); while (!it.next().done);
    let n = 0, sh = 0;
    for (const c of G.colliders) { const g = fit(c); while (!g.next().done); n++; if (shapeOf(c)) sh++; }
    return { n, sh };
  }
  if (k === 'draw') {
    if (window.__colLines) G.scene.remove(window.__colLines);
    const grp = new THREE.Group(), R = (arg && arg.r) || 30, p = arg && arg.x !== undefined ? arg : G.player.position, y = (x, z) => heightAt(x, z) + 0.06;
    const mats = {}, geo = new THREE.BoxGeometry(1, 0.02, 1);
    const line = (pts, col) => { // kalın şerit: ince çizgi küçük ekran görüntüsünde kaybolur
      const m = mats[col] || (mats[col] = new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.9 }));
      for (let i = 0; i < pts.length; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, bz - az);
        const e = new THREE.Mesh(geo, m); e.scale.set(col === 0xff3030 ? 0.05 : 0.08, 1, L + 0.04); e.position.set((ax + bx) / 2, y((ax + bx) / 2, (az + bz) / 2) + 0.05, (az + bz) / 2);
        e.rotation.y = Math.atan2(bx - ax, bz - az); e.renderOrder = 999; e.userData.bkNo = true; grp.add(e);
      }
    };
    for (const c of G.colliders) {
      if (Math.abs((c[0] + c[1]) / 2 - p.x) > R || Math.abs((c[2] + c[3]) / 2 - p.z) > R) continue;
      line([[c[0], c[2]], [c[1], c[2]], [c[1], c[3]], [c[0], c[3]]], 0xff3030);
      for (const H of shapeOf(c) || []) { const q = []; for (let i = 0; i < H.length; i += 2) q.push([H[i], H[i + 1]]); line(q, 0x20ff40); }
    }
    grp.renderOrder = 999; G.scene.add(grp); window.__colLines = grp;
    return grp.children.length;
  }
  if (k === 'off') { OFF = !!arg; return OFF; } // karşılaştırma testi: eski kutu çarpışması
  if (k === 'fit') { const f = FIT.get(arg); return f ? { b: f.b, polys: f.polys && f.polys.map((H) => Array.from(H).map((v) => +v.toFixed(2))) } : null; }
  let n = 0, sh = 0; for (const c of G.colliders) { if (FIT.has(c)) n++; if (shapeOf(c)) sh++; }
  return { fitted: n, shaped: sh, total: G.colliders.length, index: !!index };
};
