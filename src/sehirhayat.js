// Şehrin caddesi canlı (2026-11-08 kullanıcı: "Şehirde de caddede yürüyen çeşitli insanlar görelim. Tarzları da şehre daha uygun
// olsun. Arabalar motorlar bisikletler olsun"). Yayalar kaldırımlarda yürür: takım elbiseli evrak çantalı, elbiseli el çantalı,
// güneş gözlüklü hasır şapkalı turist, sırt çantalı öğrenci, siyahlar içinde alışveriş poşetli, yaşlı... Bazıları yaya geçidinden
// karşıya geçer (önce taşıtın durmasını bekler), ara ara vitrine bakar. Şehir müşterileri de aynı tarzda giyinir (cityLook, city.js).
// Trafik: batıya giden kuzey şerit (z 13,4; market kamyonları da bu şeritte), doğuya giden güney şerit (16,4), bisikletler güney
// kenardaki yeşil bisiklet yolunda (barselona.js BIKE_Z). Taşıt önündekinin arkasında kalır, yaya geçidinde karşıya geçen varken
// çizgide durur; kamyonlar ve muhasebecinin arabası da aynı kurala uyar (cityGapK: city.js, tahsilat.js). Yalnız oyuncu şehirdeyken
// çalışır ve görünür: köydeyken boşuna çizilmez; şehre her gelişte taşıtlar ve yayalar yeniden dağıtılır.
import * as THREE from 'three';
import * as M from './models.js';
import { G, lerpAngle, rand, pick, offscreen } from './game.js';
import { makeMotorbike, addHelmet } from './riders.js';
import { havaIslak } from './hava.js';
import { ZEBRA, BIKE_Z } from './barselona.js';

const PI = Math.PI, CX = 430;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const LANE_W = 13.4, LANE_E = 16.4;
const END_W = CX - 90, END_E = CX + 90;
const S_E = 20.5, S_W = 19.15, N_Z = 11.3, N0 = 398.5, N1 = 450.5; // kaldırım hatları (müşteriler WALK_S 19,4'te)
G.cityCars = G.cityCars || new Set(); // caddedeki öbür taşıtlar (muhasebecinin arabası): trafik onlara göre durur

// ---------- şehirli görünüşler ----------
const SK = M.SKINS, HAIR = ['#2a1d14', '#3a2a1a', '#6b4a2a', '#b08850', '#1d1d1d', '#a0522d'];
const STYLES = [
  [3, () => { const c = pick(['#2b2f3a', '#3a4256', '#4a4a50', '#5a4a3e']); return { look: { shirt: c, pants: c, hat: 'none', hairColor: pick(HAIR), skin: pick(SK), mustache: Math.random() < 0.25 }, acc: ['canta'] }; }],
  [3, () => { const c = pick(['#d9534f', '#e8a33d', '#5a8fd6', '#c86fae', '#2fae8f', '#f2efe8', '#7a5cc9']); return { look: { shirt: c, pants: c, hat: 'hair', hatColor: pick(HAIR), skin: pick(SK), fem: true }, acc: [pick(['elcanta', 'elcanta', 'poset'])] }; }],
  [3, () => ({ look: { shirt: pick(['#ffb347', '#7fd1c7', '#f28db2', '#ffffff', '#9fd86b']), pants: pick(['#d8c4a0', '#c8b48a', '#7a8aa0']), hat: pick(['straw', 'cap']), hatColor: pick(['#f2efe8', '#e8604c', '#2f6db5']), skin: pick(['#f6d2b0', '#f3cfae', '#eec39a']), hairColor: pick(HAIR), shades: true }, acc: [pick(['sirt', 'kamera'])] })],
  [2, () => ({ look: { shirt: pick(['#6c7a89', '#3d7dd8', '#8e5fd6', '#e85d75', '#2a2a30']), pants: pick(['#3d4f7a', '#2f3b4c']), hat: Math.random() < 0.4 ? 'cap' : 'none', hatColor: pick(['#2a2a30', '#c0392b', '#f2efe8']), hairColor: pick(HAIR), skin: pick(SK), fem: Math.random() < 0.45 }, acc: ['sirt'] })],
  [2, () => ({ look: { shirt: '#1f1f24', pants: '#1f1f24', hat: 'hair', hatColor: pick(HAIR), skin: pick(SK), fem: true, shades: Math.random() < 0.6 }, acc: ['poset'] })],
  [3, () => ({ look: { shirt: pick(M.SHIRTS), pants: pick(['#4a5568', '#3d4f7a', '#6b4e3d']), hat: 'none', hairColor: pick(HAIR), skin: pick(SK), fem: Math.random() < 0.5 }, acc: Math.random() < 0.5 ? ['poset'] : [] })],
  [1, () => ({ look: { shirt: pick(['#a08c6e', '#7a8a7a', '#8a6f6f']), pants: '#5a5a5a', hat: Math.random() < 0.5 ? 'cap' : 'none', hatColor: '#6b6b6b', hairColor: '#cfcfcf', skin: pick(SK), mustache: Math.random() < 0.5 }, acc: [] })],
];
const WSUM = STYLES.reduce((a, [w]) => a + w, 0);
function style() { let r = Math.random() * WSUM; for (const [w, f] of STYLES) { if ((r -= w) <= 0) return f(); } return STYLES[0][1](); }
export const cityLook = () => style().look;
function addAcc(o, kind) {
  if (kind === 'canta') M.rbox(0.36, 0.26, 0.1, 0.03, M.mat('#4a2e1e'), 0.32, 0.5, 0.06, o); // evrak çantası
  else if (kind === 'elcanta') M.rbox(0.26, 0.2, 0.1, 0.03, M.mat(pick(['#c0392b', '#2a2a30', '#d8b48a', '#2f6db5'])), 0.3, 0.62, 0.04, o);
  else if (kind === 'poset') M.rbox(0.28, 0.32, 0.12, 0.02, M.mat(pick(['#f2efe8', '#e8604c', '#d8b48a', '#3f9a5a'])), -0.33, 0.42, 0.04, o);
  else if (kind === 'sirt') M.rbox(0.34, 0.42, 0.18, 0.05, M.mat(pick(['#2f6db5', '#c0392b', '#3f9a5a', '#2a2a30', '#f2c230'])), 0, 0.98, -0.26, o);
  else if (kind === 'kamera') M.rbox(0.15, 0.1, 0.08, 0.02, M.mat('#1d1d24'), 0, 0.88, 0.25, o);
}
// belirip kaybolma (game.js müşterisindeki gibi): malzemeler saydam kopyalanır, bitince eskisi geri gelir
function seeThrough(o, on) {
  const tr = (m) => { const c = m.clone(); c.transparent = true; c.userData.op0 = m.opacity; return c; };
  o.traverse((m) => {
    if (!m.isMesh) return;
    if (on && !m.userData.mat0) { m.userData.mat0 = m.material; m.material = Array.isArray(m.material) ? m.material.map(tr) : tr(m.material); }
    else if (!on && m.userData.mat0) { for (const c of [].concat(m.material)) c.dispose(); m.material = m.userData.mat0; delete m.userData.mat0; }
  });
}
function opacity(o, k) { o.traverse((m) => { if (m.isMesh && m.userData.mat0) for (const c of [].concat(m.material)) c.opacity = c.userData.op0 * k; }); }

// ---------- yaya geçidi ----------
const _p = V(0, 0, 0);
let zT = -1, zBusy = false;
const onZebra = (p) => p.x > ZEBRA[0] - 0.6 && p.x < ZEBRA[1] + 0.6 && p.z > 11.5 && p.z < 18.5;
function zebraBusy() {
  if (zT === G.time) return zBusy;
  zT = G.time; zBusy = false;
  if (G.world === 'sehir' && G.player && onZebra(G.player.position)) return (zBusy = true);
  for (const c of G.customers) if (c.region === 'sehir' && onZebra(c.obj.position)) return (zBusy = true);
  for (const w of WALK) if (w.state !== 'off' && w.o.visible && onZebra(w.o.position)) return (zBusy = true);
  return zBusy;
}

// ---------- engeller: şeritteki taşıtlar, market kamyonları, muhasebecinin arabası ----------
const BOX = new THREE.Box3(), SZ = V(0, 0, 0);
const lenOf = (o) => o.userData.cityLen || (o.userData.cityLen = (BOX.setFromObject(o).getSize(SZ), Math.max(1.6, Math.max(SZ.x, SZ.z))));
function obstacles(lane) {
  const L = [], lz = lane === 'W' ? LANE_W : LANE_E;
  if (lane !== 'B') {
    if (shown) for (const v of VEH) if (v.state === 'drive' && v.lane === lane) L.push({ x: v.o.position.x, len: v.len, ref: v.o });
    const R = G.regions && G.regions.sehir;
    if (R) for (const T of [R.truck, R.halTruck, R.toptanTruck]) if (T && T.obj && Math.abs(T.obj.position.z - lz) < 1.9) L.push({ x: T.obj.position.x, len: lenOf(T.obj), ref: T.obj });
    for (const o of G.cityCars) if (o.visible && Math.abs(o.position.z - lz) < 1.9) L.push({ x: o.position.x, len: lenOf(o), ref: o });
  } else if (shown) for (const v of VEH) if (v.state === 'drive' && v.lane === 'B') L.push({ x: v.o.position.x, len: v.len, ref: v.o });
  return L;
}
// önündeki boşluk (metre): şeritte önde giden taşıtın arkasına, yaya geçidinde biri varsa durma çizgisine
function gapAhead(x, dir, len, list, self) {
  let g = Infinity;
  for (const q of list) {
    if (q.ref === self) continue;
    const d = (q.x - x) * dir;
    if (d <= 0) continue;
    g = Math.min(g, d - (len + q.len) / 2);
  }
  if (zebraBusy()) {
    const front = x + dir * len / 2, line = dir > 0 ? ZEBRA[0] - 0.7 : ZEBRA[1] + 0.7, d = (line - front) * dir;
    if (d > -1.0) g = Math.min(g, d);
  }
  return g;
}
const laneOf = (z) => (Math.abs(z - LANE_W) < 1.3 ? 'W' : Math.abs(z - LANE_E) < 1.3 ? 'E' : null);
// kamyonlar ve muhasebecinin arabası için hız çarpanı (0..1)
export function cityGapK(o, dir) {
  const lane = laneOf(o.position.z);
  const g = gapAhead(o.position.x, dir, lenOf(o), lane ? obstacles(lane) : [], o);
  return g <= 0.3 ? 0 : Math.min(1, (g - 0.3) / 7);
}
// şeridin [x0, x1] arası boş mu (park cebinden çıkarken arkadan gelen var mı)
export function laneClear(lane, x0, x1, self) {
  return !obstacles(lane).some((q) => q.ref !== self && q.x + q.len / 2 > x0 && q.x - q.len / 2 < x1);
}

// ---------- taşıtlar ----------
const COLS = ['#e8473c', '#2f6db5', '#f6c343', '#3f9a5a', '#1d1f24', '#f2efe8', '#8e5fd6'];
const KINDS = ['sedan', 'taxi', 'suv', 'van', 'taxi', 'sedan', 'motor', 'motor', 'bisiklet', 'bisiklet', 'bisiklet'];
const VEH = [];
class Veh {
  constructor(kind) {
    this.kind = kind; this.bike = kind === 'bisiklet'; this.moto = kind === 'motor';
    if (this.bike || this.moto) {
      this.o = new THREE.Group();
      const b = this.bike ? M.makeBicycle(pick(COLS)) : makeMotorbike(pick(COLS));
      this.o.add(b); this.wheels = (b.userData && b.userData.wheels) || [];
      const s = style();
      this.rider = M.makeCharacter(this.moto ? { ...s.look, hat: 'none' } : s.look);
      if (this.moto) addHelmet(this.rider, pick(['#2d3e66', '#e8473c', '#1d1f24', '#f6c343', '#f2efe8']));
      else if (s.acc.includes('sirt')) addAcc(this.rider, 'sirt');
      this.rider.position.set(0, this.moto ? 0.28 : 0.65, this.moto ? -0.38 : -0.2); // selede (world.js spawnBiker ile aynı)
      this.o.add(this.rider);
      this.len = this.bike ? 1.8 : 2.3; this.top = this.bike ? rand(4.2, 5.2) : rand(8, 9.5);
    } else {
      this.o = M.model(kind); this.wheels = [];
      this.len = lenOf(this.o); this.top = kind === 'van' ? rand(6.5, 7.5) : rand(7.5, 9);
    }
    this.o.visible = false; G.scene.add(this.o);
    this.v = 0; this.state = 'off'; this.t = rand(0, 4); this.lane = 'E'; this.dir = 1;
  }
  place(lane, x) {
    this.lane = lane; this.dir = lane === 'W' ? -1 : 1;
    const z = lane === 'W' ? LANE_W : lane === 'E' ? LANE_E : BIKE_Z;
    this.o.position.set(x, 0, z); this.o.rotation.y = this.dir > 0 ? PI / 2 : -PI / 2;
    this.o.visible = true; this.state = 'drive'; this.v = this.top * 0.8;
    if (!this.bike && !this.moto && G.traffic) G.traffic.add(this.o); // motor sesi (aracses.js)
  }
  hide() { this.o.visible = false; this.state = 'off'; this.t = rand(1.5, 6); if (G.traffic) G.traffic.delete(this.o); }
  pickLane() { return this.bike ? 'B' : Math.random() < 0.5 ? 'W' : 'E'; }
  update(dt) {
    if (this.state === 'off') {
      if ((this.t -= dt) > 0) return;
      const lane = this.pickLane(), x = lane === 'W' ? END_E : END_W;
      if (laneClear(lane, x - 14, x + 14, this.o)) this.place(lane, x); else this.t = 1;
      return;
    }
    const p = this.o.position, g = gapAhead(p.x, this.dir, this.len, obstacles(this.lane), this.o);
    const goal = g <= 0.3 ? 0 : Math.min(this.top, 0.6 + (g - 0.3) * 1.2);
    this.v = goal < this.v ? goal : Math.min(goal, this.v + 3 * dt);
    const st = this.v * dt;
    p.x += this.dir * st;
    for (const w of this.wheels) w.rotation.x += st / (this.moto ? 0.41 : 0.38);
    if (this.rider) {
      M.animateCharacter(this.rider, this.bike && this.v > 0.3 ? Math.min(1, this.v / 5) : 0, dt, true);
      if (this.moto) for (const l of this.rider.userData.legs || []) l.rotation.x = -1.15; // ayaklar basamakta
    } else p.y = this.v > 0.5 ? Math.abs(Math.sin(G.time * 17 + this.len)) * 0.02 : 0;
    if ((this.dir > 0 && p.x > END_E) || (this.dir < 0 && p.x < END_W)) this.hide();
  }
}

// ---------- yayalar ----------
const WALK = [], NW = 12;
class Walker {
  constructor(i) {
    const s = style();
    this.o = M.makeCharacter(s.look); for (const a of s.acc) addAcc(this.o, a);
    this.o.visible = false; G.scene.add(this.o);
    this.i = i; this.state = 'off'; this.t = rand(0, 3); this.path = []; this.fade = 1;
  }
  // güzergâh: güney kaldırımda doğuya ya da batıya, kuzey kaldırımda (market önü), ya da yaya geçidinden karşıya
  route(mid) {
    const r = Math.random(), east = Math.random() < 0.5, e0 = east ? END_E - 4 : END_W + 4, e1 = east ? END_W + 4 : END_E - 4;
    this.wait = -1;
    if (r < 0.34) this.path = [V(END_W + 4, 0, S_E + rand(-0.15, 0.15)), V(END_E - 4, 0, S_E)];
    else if (r < 0.66) this.path = [V(END_E - 4, 0, S_W + rand(-0.15, 0.15)), V(END_W + 4, 0, S_W)];
    else if (r < 0.78) this.path = east ? [V(N0, 0, N_Z), V(N1, 0, N_Z)] : [V(N1, 0, N_Z), V(N0, 0, N_Z)];
    else if (r < 0.89) { const z = Math.random() < 0.5 ? S_E : S_W; this.path = [V(e0, 0, z), V(CX + 0.4, 0, z), V(CX + 0.4, 0, 18.75), V(CX + 0.4, 0, N_Z), V(Math.random() < 0.5 ? N0 : N1, 0, N_Z)]; this.wait = 1; }
    else { this.path = [V(Math.random() < 0.5 ? N0 : N1, 0, N_Z), V(CX - 0.4, 0, N_Z), V(CX - 0.4, 0, 11.95), V(CX - 0.4, 0, S_W), V(e1, 0, S_W)]; this.wait = 1; }
    this.pos0 = this.path.shift();
    this.o.position.copy(this.pos0);
    if (mid && this.path.length === 1) this.o.position.lerp(this.path[0], rand(0.05, 0.95)); // şehre gelişte kaldırımlar boş görünmesin
    this.spd = rand(1.5, 1.95); this.look = Math.random() < 0.25 ? rand(8, 60) : -1; // vitrine bakacağı yer (yürüdüğü metre)
    this.walked = 0; this.state = 'walk'; this.o.visible = true;
    const q = this.path[0]; this.o.rotation.y = Math.atan2(q.x - this.o.position.x, q.z - this.o.position.z);
    if (!offscreen(this.o.position)) { this.fade = 0; seeThrough(this.o, true); opacity(this.o, 0); } else this.fade = 1;
  }
  // karşıya geçmeden: yaklaşan (durmamış) taşıt yoksa
  clear() {
    for (const v of VEH) if (v.state === 'drive' && v.v > 0.4 && v.lane !== 'B' && (CX - v.o.position.x) * v.dir > -2 && (CX - v.o.position.x) * v.dir < 16) return false;
    const R = G.regions && G.regions.sehir;
    if (R) for (const T of [R.truck, R.halTruck, R.toptanTruck]) if (T && T.obj && T.state !== 'unload' && T.obj.position.x > CX - 2 && T.obj.position.x < CX + 18) return false;
    for (const o of G.cityCars) if (o.visible && Math.abs(o.position.x - CX) < 14) return false;
    return true;
  }
  update(dt) {
    const o = this.o, p = o.position;
    if (this.state === 'off') {
      if ((this.t -= dt) > 0) return;
      if (this.i >= (havaIslak() ? 5 : NW)) { this.t = 4; return; } // yağışta sokak tenhalaşır
      this.route(false); return;
    }
    if (this.fade < 1 && this.state !== 'out') { this.fade = Math.min(1, this.fade + dt / 0.9); opacity(o, this.fade); if (this.fade >= 1) seeThrough(o, false); }
    let moving = false;
    if (this.state === 'out') {
      this.fade -= dt / 1.1; opacity(o, Math.max(0, this.fade));
      if (this.fade <= 0) { seeThrough(o, false); o.visible = false; this.state = 'off'; this.t = rand(1, 5); return; }
    } else if (this.state === 'look') {
      this.t -= dt; o.rotation.y = lerpAngle(o.rotation.y, p.z < 15 ? PI : 0, Math.min(1, dt * 5));
      if (this.t <= 0) this.state = 'walk';
    } else if (this.state === 'wait') {
      if (this.clear()) this.state = 'walk';
    } else {
      const q = this.path[0];
      if (!q) { if (offscreen(p)) { o.visible = false; this.state = 'off'; this.t = rand(1, 5); return; } seeThrough(o, true); this.fade = 1; this.state = 'out'; return; }
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), st = this.spd * dt;
      if (d <= st) {
        p.x = q.x; p.z = q.z; this.path.shift();
        if (this.wait >= 0 && --this.wait < 0 && !this.clear()) this.state = 'wait'; // kaldırımın ucunda: taşıt geçsin
      } else { p.x += (dx / d) * st; p.z += (dz / d) * st; moving = true; }
      if (d > 0.01) o.rotation.y = lerpAngle(o.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 8));
      this.walked += st;
      if (this.look > 0 && this.walked > this.look && this.path.length === 1 && (p.z < 12 || p.z > 18.9)) { this.look = -1; this.state = 'look'; this.t = rand(2, 4); } // vitrine, büfeye bakar
    }
    M.animateCharacter(o, moving ? Math.max(0.25, Math.min(1, (this.spd / 2 - 0.6) / 0.7)) : 0, dt, false);
  }
}

// ---------- her kare (main.js) ----------
let shown = false, built = false;
function build() {
  built = true;
  for (const k of KINDS) VEH.push(new Veh(k));
  for (let i = 0; i < NW; i++) WALK.push(new Walker(i));
}
// şehre gelişte: taşıtlar şeritlere aralıklı, yayalar kaldırım boyuna dağılır
function seed() {
  for (const v of VEH) { v.hide(); v.t = 0; }
  for (const v of VEH) {
    for (let k = 0; k < 10; k++) {
      const lane = v.pickLane(), x = rand(END_W + 10, END_E - 10);
      if (laneClear(lane, x - v.len / 2 - 7, x + v.len / 2 + 7, v.o)) { v.place(lane, x); break; }
    }
  }
  for (const w of WALK) { if (w.o.visible) seeThrough(w.o, false); w.state = 'off'; w.o.visible = false; if (w.i < (havaIslak() ? 5 : NW) && Math.random() < 0.85) w.route(true); else w.t = rand(0, 4); }
}
export function updateCityLife(dt) {
  const R = G.regions && G.regions.sehir, inCity = G.world === 'sehir' && R && R.unlocked;
  if (inCity !== shown) {
    shown = inCity;
    if (inCity) { if (!built) build(); seed(); }
    else { for (const v of VEH) v.hide(); for (const w of WALK) { if (w.o.visible) seeThrough(w.o, false); w.o.visible = false; w.state = 'off'; } }
  }
  if (!shown) return;
  for (const v of VEH) v.update(dt);
  for (const w of WALK) w.update(dt);
}
if (typeof window !== 'undefined') window.__sehir = () => ({ shown, veh: VEH.map((v) => [v.kind, v.state, v.lane, +v.o.position.x.toFixed(1), +v.v.toFixed(1)]), walk: WALK.map((w) => [w.state, +w.o.position.x.toFixed(1), +w.o.position.z.toFixed(1)]), zebra: zebraBusy(), cars: G.cityCars.size });
