// Otomatik koşu: menüden bir bölgeye ("Oraya git"), büyük mini haritadan ya da bir bildirimden seçilen yere karakter kendi koşar.
// Yol oyuncunun gövdesine göre planlanır: engeller ve ağaç gövdeleri gövde yarıçapı kadar şişirilmiş sayılır, dipleri pahalıdır
// (duvara sürtünmeden ortadan gider). Bölgeler, yollar ve serbest çimen yürünür; deniz, dere ve çitli tarlalar değil.
// Yol düzleştirilirken her kısa yol engellere karşı tam geometriyle denetlenir. Takılırsa (0,7 sn ilerleyemezse) bulunduğu
// yerden yeniden planlar. Klavye, joystick ya da basılı tutma koşuyu bırakır.
import * as THREE from 'three';
import { G } from './game.js';
import { walkable } from './world.js';
import { openGround } from './nature.js';

const C = 0.5, PR = 0.38, X0 = -94, Z0 = -78, NX = 460, NZ = 256; // x -94..136 (beach club'ın çevresi dahil, nature.js ROAM_CLUB), z -78..50
const FREE = 1, NEAR = 2, BLOCK = 0;
let base = null, baseKey = '', grid = null, gridKey = '';

const regionKey = () => { let k = ''; for (const id in G.regions) if (G.regions[id].unlocked) k += id; return `${k}|${(G.walkways || []).length}`; };
// yürünebilir zemin (engelsiz): bölge açılınca ya da yol eklenince yeniden çıkarılır. Ağaçlar burada sayılmaz, sonra damgalanır
function buildBase() {
  const trees = G.trees;
  G.trees = [];
  try {
    base = new Uint8Array(NX * NZ);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = X0 + (i + 0.5) * C, z = Z0 + (j + 0.5) * C;
      base[j * NX + i] = walkable(x, z) || openGround(x, z) ? FREE : BLOCK;
    }
  } finally { G.trees = trees; }
}
function stampRect(g, x0, x1, z0, z1, v) {
  const i0 = Math.max(0, Math.ceil((x0 - X0) / C - 0.5)), i1 = Math.min(NX - 1, Math.floor((x1 - X0) / C - 0.5));
  const j0 = Math.max(0, Math.ceil((z0 - Z0) / C - 0.5)), j1 = Math.min(NZ - 1, Math.floor((z1 - Z0) / C - 0.5));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * NX + i; if (v === BLOCK || g[k] === FREE) g[k] = v; }
}
function stampDisc(g, x, z, r, v) {
  const i0 = Math.max(0, Math.ceil((x - r - X0) / C - 0.5)), i1 = Math.min(NX - 1, Math.floor((x + r - X0) / C - 0.5));
  const j0 = Math.max(0, Math.ceil((z - r - Z0) / C - 0.5)), j1 = Math.min(NZ - 1, Math.floor((z + r - Z0) / C - 0.5));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const dx = X0 + (i + 0.5) * C - x, dz = Z0 + (j + 0.5) * C - z, k = j * NX + i;
    if (dx * dx + dz * dz <= r * r && (v === BLOCK || g[k] === FREE)) g[k] = v;
  }
}
const treeR = (t) => 0.3 + 0.22 * t[2]; // nature.js openGround ile aynı gövde yarıçapı
function navGrid() {
  const rk = regionKey();
  if (rk !== baseKey) { buildBase(); baseKey = rk; grid = null; }
  let h = 0;
  for (const c of G.colliders) h += c[0] * 3 + c[1] * 5 + c[2] * 7 + c[3] * 11;
  const key = `${rk}|${G.colliders.length}|${h.toFixed(2)}|${(G.trees || []).length}`;
  if (grid && key === gridKey) return grid;
  gridKey = key;
  const g = Uint8Array.from(base);
  for (const c of G.colliders) stampRect(g, c[0] - PR - 0.55, c[1] + PR + 0.55, c[2] - PR - 0.55, c[3] + PR + 0.55, NEAR);
  for (const t of G.trees || []) stampDisc(g, t[0], t[1], treeR(t) + PR + 0.4, NEAR);
  for (const c of G.colliders) stampRect(g, c[0] - PR - 0.08, c[1] + PR + 0.08, c[2] - PR - 0.08, c[3] + PR + 0.08, BLOCK);
  for (const t of G.trees || []) stampDisc(g, t[0], t[1], treeR(t) + 0.12, BLOCK);
  return (grid = g);
}
const cellOf = (x, z) => { const i = Math.floor((x - X0) / C), j = Math.floor((z - Z0) / C); return i < 0 || j < 0 || i >= NX || j >= NZ ? -1 : j * NX + i; };
const cx = (k) => X0 + ((k % NX) + 0.5) * C, cz = (k) => Z0 + (Math.floor(k / NX) + 0.5) * C;
// yürünebilir en yakın hücre (oyuncu engelin dibinde ya da hedef bir binanın içindeyse)
function nearestOpen(g, x, z, maxR = 8) {
  const k0 = cellOf(x, z);
  if (k0 < 0) return -1;
  if (g[k0]) return k0;
  const i0 = k0 % NX, j0 = Math.floor(k0 / NX), n = Math.ceil(maxR / C);
  let best = -1, bd = 1e9;
  for (let r = 1; r <= n && best < 0; r++) {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= NX || j >= NZ || !g[j * NX + i]) continue;
      const d = di * di + dj * dj;
      if (d < bd) { bd = d; best = j * NX + i; }
    }
  }
  return best;
}

// A*: 8 komşu, çapraz geçişte iki yan da açık olmalı (köşe kesilmez); engel dibi 3 kat pahalı
let AS = null;
function astar(g, s, e) {
  const n = NX * NZ;
  if (!AS) AS = { gs: new Float32Array(n), came: new Int32Array(n), seen: new Uint32Array(n), shut: new Uint32Array(n), st: 0, hf: new Float32Array(1 << 16), hk: new Int32Array(1 << 16) };
  const A = AS, st = ++A.st, { gs, came, seen, shut } = A;
  const ex = e % NX, ez = Math.floor(e / NX);
  const hf = (k) => { const dx = Math.abs((k % NX) - ex), dz = Math.abs(Math.floor(k / NX) - ez); return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)); };
  let hn = 0;
  const push = (f, k) => {
    if (hn >= A.hf.length) { const a = new Float32Array(A.hf.length * 2), b = new Int32Array(A.hk.length * 2); a.set(A.hf); b.set(A.hk); A.hf = a; A.hk = b; }
    const H = A.hf, K = A.hk;
    let i = hn++;
    while (i > 0) { const p = (i - 1) >> 1; if (H[p] <= f) break; H[i] = H[p]; K[i] = K[p]; i = p; }
    H[i] = f; K[i] = k;
  };
  const pop = () => {
    const H = A.hf, K = A.hk, top = K[0], lf = H[--hn], lk = K[hn];
    let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= hn) break; if (c + 1 < hn && H[c + 1] < H[c]) c++; if (H[c] >= lf) break; H[i] = H[c]; K[i] = K[c]; i = c; }
    H[i] = lf; K[i] = lk;
    return top;
  };
  gs[s] = 0; seen[s] = st; came[s] = -1; push(hf(s), s);
  while (hn > 0) {
    const k = pop();
    if (k === e) break;
    if (shut[k] === st) continue;
    shut[k] = st;
    const i = k % NX, j = Math.floor(k / NX);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
      const m = b * NX + a;
      if (!g[m] || shut[m] === st) continue;
      if (di && dj && (!g[j * NX + a] || !g[b * NX + i])) continue;
      const step = (di && dj ? Math.SQRT2 : 1) * (g[m] === NEAR ? 3 : 1);
      const ng = gs[k] + step;
      if (seen[m] !== st || ng < gs[m]) { gs[m] = ng; seen[m] = st; came[m] = k; push(ng + hf(m), m); }
    }
  }
  if (seen[e] !== st) return null;
  const out = [];
  for (let k = e; k !== -1; k = came[k]) out.push(k);
  return out.reverse();
}

// iki nokta arası düz gidilebilir mi: gövde hiçbir engele ve ağaca değmez, yol boyu yürünebilir zeminde kalır
function clearLine(g, ax, az, bx, bz) {
  const minX = Math.min(ax, bx) - PR - 0.1, maxX = Math.max(ax, bx) + PR + 0.1, minZ = Math.min(az, bz) - PR - 0.1, maxZ = Math.max(az, bz) + PR + 0.1;
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
  for (const c of G.colliders) {
    if (c[1] < minX || c[0] > maxX || c[3] < minZ || c[2] > maxZ) continue;
    if (segRect(ax, az, dx, dz, c[0] - PR - 0.05, c[1] + PR + 0.05, c[2] - PR - 0.05, c[3] + PR + 0.05)) return false;
  }
  for (const t of G.trees || []) {
    if (t[0] < minX - 1.5 || t[0] > maxX + 1.5 || t[1] < minZ - 1.5 || t[1] > maxZ + 1.5) continue;
    const r = treeR(t) + 0.1, u = L ? Math.max(0, Math.min(1, ((t[0] - ax) * dx + (t[1] - az) * dz) / (L * L))) : 0;
    if (Math.hypot(ax + dx * u - t[0], az + dz * u - t[1]) < r) return false;
  }
  for (let s = 0; s <= L; s += 0.3) { const k = cellOf(ax + (dx * s) / (L || 1), az + (dz * s) / (L || 1)); if (k < 0 || !base[k]) return false; }
  return true;
}
// doğru parçası dikdörtgeni kesiyor mu (Liang-Barsky)
function segRect(ax, az, dx, dz, x0, x1, z0, z1) {
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

// from → to yolu (dünya noktaları), bulunamazsa null
export function planRun(from, to) {
  if (!G.regions.koy || cellOf(from.x, from.z) < 0 || cellOf(to.x, to.z) < 0) return null; // şehir gibi ayrı alanlar: ızgaranın dışı
  const g = navGrid(), s = nearestOpen(g, from.x, from.z, 3), e = nearestOpen(g, to.x, to.z, 8);
  if (s < 0 || e < 0) return null;
  const cells = astar(g, s, e);
  if (!cells) return null;
  const pts = cells.map((k) => new THREE.Vector3(cx(k), 0, cz(k)));
  const end = g[cellOf(to.x, to.z)] ? new THREE.Vector3(to.x, 0, to.z) : pts[pts.length - 1];
  pts[pts.length - 1] = end;
  // düzleştir: görülebilen en uzak noktaya doğrudan (en çok 80 hücre ileri bakılır)
  const out = [];
  let ax = from.x, az = from.z, i = 0;
  while (i < pts.length) {
    let far = i;
    for (let m = Math.min(pts.length - 1, i + 80); m > i; m--) if (clearLine(g, ax, az, pts[m].x, pts[m].z)) { far = m; break; }
    out.push(pts[far]); ax = pts[far].x; az = pts[far].z; i = far + 1;
  }
  return out;
}

// koşunun durumu: main.js inputVec her karede steer() sorar
const run = { path: null, i: 0, goal: null, chk: 0, last: new THREE.Vector3(), tries: 0 };
export const running = () => !!run.path;
export function startRun(x, z) {
  const p = G.player.position, path = planRun(p, { x, z });
  if (!path || !path.length) return false;
  Object.assign(run, { path, i: 0, goal: path[path.length - 1].clone(), chk: 0, tries: 0 });
  run.last.copy(p);
  G.runGoal = run.goal; // mini harita hedefi çizer
  return true;
}
export function stopRun() { run.path = null; G.runGoal = null; }
// yürüme yönü (birim vektör, varınca yavaşlar); koşu yoksa null
export function steer(dt) {
  if (!run.path) return null;
  const p = G.player.position;
  while (run.i < run.path.length - 1 && Math.hypot(run.path[run.i].x - p.x, run.path[run.i].z - p.z) < 0.55) run.i++;
  const w = run.path[run.i], dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz), last = run.i === run.path.length - 1;
  if (last && d < 0.3) { stopRun(); return { x: 0, z: 0, done: true }; }
  // takıldıysa (0,7 sn'de 0,35 m'den az ilerledi) bulunduğu yerden yeniden planla; dört denemede olmazsa bırak
  if ((run.chk += dt) > 0.7) {
    const moved = Math.hypot(p.x - run.last.x, p.z - run.last.z);
    run.chk = 0; run.last.copy(p);
    if (moved < 0.35) {
      const path = ++run.tries <= 4 && planRun(p, run.goal);
      if (!path) { stopRun(); return { x: 0, z: 0, done: true }; }
      run.path = path; run.i = 0;
      return steer(0);
    }
  }
  const k = last ? Math.min(1, 0.45 + d / 1.4) : 1;
  return { x: (dx / (d || 1)) * k, z: (dz / (d || 1)) * k };
}
