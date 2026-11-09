// Muhasebecinin arabası (2026-11-08 kullanıcı: "Muhasebecinin rotasında şehir marketi yoksa ekle. Kendi arabasıyla gidip gelsin
// tahsilata"). Şehir Marketi'nin kasalarında (R.pile, R.pile2) para birikince muhasebecilerden biri bankanın arkasında, toprak
// yolun doğusunda duran arabasına biner: geri geri yola çıkar, toprak yoldan (çöp konteynerinin batısından) ana yola, batıya giden
// şeritten ormana (ROAD_FAR) girer. Şehirde caddenin doğu ucundan batıya giden şeritte belirir, marketin doğusundaki park cebine
// girer, yürüyüp kasaları boşaltır, arabasıyla batıya gidip çıkar; köyde doğuya giden şeritten gelip toprak yoldan park yerine
// girer, parayı bankaya yatırır. Köy yolunda öbür taşıtlarla aynı yol düzenine (events.js gapK) ve yaya geçidine (roads.js crossK)
// uyar, önünde yaya varsa durur; şehirde cityGapK (sehirhayat.js). Duran araba engeldir (dyn: yol ızgarası dolanır).
// Muhasebeci (upgrades.js) karar verirken tripWanted'a sorar; yolculukta update'i tripStep'e bırakır. Araba ilk muhasebeciyle gelir.
import * as THREE from 'three';
import * as M from './models.js';
import { G, lerpAngle, offscreen, sfx } from './game.js';
import { gapK, ROAD_FAR } from './events.js';
import { cityGapK, laneClear, LANE_W } from './sehirhayat.js';

const PI = Math.PI, CX = 430;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pts = (list) => list.map(([x, z, o]) => { const v = V(x, 0, z); if (o) Object.assign(v, o); return v; });
// köy: park yeri bankanın arkasında (burnu kuzeye), toprak yol x -62,5..-59,3; çöp konteyneri x -61..-59, z -24,9..-23,7
const PARK = { x: -58.0, z: -40.6, ry: PI };
const DOOR = V(-59.4, 0, -40.0);
const W_LANE = [-82, -55, -21.2, -18.6]; // ana yolun batıya giden şeridi: girip çıkarken boş olmalı
const OUT_V = () => [[-60.6, -43.0, { rev: true }], [-61.3, -38.6], [-61.8, -33.6], [-62.1, -28.4], [-62.1, -24.2], [-63.0, -21.7, { gate: W_LANE }], [-65.0, -20.1], [-68.0, -19.8], [ROAD_FAR, -19.8]]; // işlev: events.js ↔ world.js döngüsünde ROAD_FAR yüklenirken henüz tanımsız olabilir
const IN_V = [[-69.0, -17.4], [-65.4, -18.8, { gate: [-70, -50, -21.2, -18.6] }], [-62.9, -21.6], [-62.2, -24.6], [-62.0, -29.5], [-61.5, -34.5], [-60.2, -37.6], [-58.6, -39.4], [PARK.x, PARK.z]];
// şehir: park cebi marketin doğusunda, kuzey kaldırımda (barselona.js çizer); araba burnu batıya durur, yaya kapısı önünde
export const CAR_BAY = [461.75, 11.2];
const C_IN = [[468.0, LANE_W], [465.4, 12.5], [462.8, 11.35], [461.0, 11.2]];
const C_DOOR = V(458.0, 0, 11.0);
const C_OUT = [[458.4, 11.7, { cgate: true }], [455.6, 12.9], [452.0, LANE_W], [CX - 92, LANE_W]];

let CAR = null;
const BOX = new THREE.Box3(), SZ = V(0, 0, 0);
function makeCar() {
  const o = M.model('sedan');
  o.position.set(PARK.x, 0, PARK.z); o.rotation.y = PARK.ry;
  BOX.setFromObject(o).getSize(SZ);
  CAR = { o, v: 0, path: [], col: null, owner: null, L: Math.max(SZ.x, SZ.z) / 2, W: Math.min(SZ.x, SZ.z) / 2 };
  G.scene.add(o);
  parkCol();
}
function parkCol() {
  dropCol();
  const p = CAR.o.position, ns = Math.abs(Math.sin(CAR.o.rotation.y)) < 0.5, L = CAR.L + 0.1, W = CAR.W + 0.08;
  CAR.col = ns ? [p.x - W, p.x + W, p.z - L, p.z + L] : [p.x - L, p.x + L, p.z - W, p.z + W];
  CAR.col.dyn = true; G.colliders.push(CAR.col);
}
function dropCol() { if (CAR && CAR.col) { const i = G.colliders.indexOf(CAR.col); if (i >= 0) G.colliders.splice(i, 1); CAR.col = null; } }
// önünde (burnunun 0,4..2,4 m ötesinde, gövde enince) yürüyen biri var mı
const _q = V(0, 0, 0);
function peopleAhead(o, owner) {
  const p = o.position, fx = Math.sin(o.rotation.y), fz = Math.cos(o.rotation.y), reach = CAR.L + 2.4;
  const hit = (q) => { const rx = q.x - p.x, rz = q.z - p.z, a = rx * fx + rz * fz; return a > CAR.L * 0.6 && a < reach && Math.abs(rx * fz - rz * fx) < CAR.W + 0.6; };
  if (G.player && hit(G.player.position)) return true;
  for (const c of G.customers) if (hit(c.obj.position)) return true;
  for (const w of G.workers) if (w !== owner && w.obj.visible && hit(w.obj.position)) return true;
  return false;
}
// köy şeridinde dikdörtgende taşıt var mı (gapK'nın taşıt kümesi)
function busy(r) {
  for (const q of G.traffic || []) {
    if (q === CAR.o || !q.parent || !q.visible) continue;
    q.getWorldPosition(_q);
    if (_q.x > r[0] && _q.x < r[1] && _q.z > r[2] && _q.z < r[3]) return true;
  }
  return false;
}
function drive(dt, city) {
  const o = CAR.o, p = o.position, t = CAR.path[0];
  if (!t) return true;
  const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz), top = city ? 8 : 7.5;
  let k = 1, gated = false;
  // ana yola çıkmadan / yolun karşısına dönmeden önce şerit boşalsın. 10 sn'den uzun bekleyişte yalnız dönüş noktasının yakınına bakar
  // (şeritte duran taşıt yüzünden kilitlenmesin)
  // Geçişe bir kez başladıysa (t.went) yolun ortasında durmaz: karşı şeridi kapatıp kendi bekleyişini kilitliyordu
  if (t.gate && !t.went && busy(t.gate)) { CAR.gw = (CAR.gw || 0) + dt; gated = CAR.gw < 10 || busy([t.x - 4, t.x + 6, t.gate[2], t.gate[3]]); } else CAR.gw = 0;
  if (t.gate && !gated) t.went = true;
  if (gated) k = 0;
  else if (t.cgate && !laneClear('W', p.x - 8, p.x + 20, o)) k = 0; // park cebinden çıkarken arkadan gelen geçsin
  else if (!t.rev) {
    if (city) k = cityGapK(o, Math.sin(o.rotation.y) < 0 ? -1 : 1);
    else { k = gapK(o, CAR.path); if (G.hooks.crossK && d > 0.01) k *= G.hooks.crossK(p, dx / d, dz / d); }
    if (k > 0 && peopleAhead(o, CAR.owner)) k = 0;
  }
  const goal = (t.rev ? 1.8 : CAR.path.length === 1 ? Math.max(1.2, Math.min(top, d * 1.5)) : top) * k;
  CAR.v = goal < CAR.v ? goal : Math.min(goal, CAR.v + 4 * dt);
  const step = CAR.v * dt * (!city && offscreen(p) ? 2 : 1), st = Math.min(d, step);
  if (d <= step) { p.x = t.x; p.z = t.z; CAR.path.shift(); } else { p.x += (dx / d) * st; p.z += (dz / d) * st; }
  // dururken burnunu çevirmez: köye dönüşte sola dönmeyi beklerken köşesi karşı şeride taşıyor, karşıdan gelenler onu engel sayıp
  // duruyor, o da şeridin boşalmasını bekliyordu (2026-11-09 canlı testinde 58 sn kilit)
  if (d > 0.05 && st > 0) o.rotation.y = lerpAngle(o.rotation.y, t.rev ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz), 1 - Math.exp(-6 * dt));
  p.y = CAR.v > 0.5 ? Math.abs(Math.sin(G.time * 18)) * 0.02 : 0;
  return !CAR.path.length;
}

// ---------- muhasebeci (upgrades.js) ----------
const cityPiles = (R) => [R.pile, R.pile2].filter((q) => q && q.amount >= 1);
// şehir kasalarındaki para köydekinden çoksa (ya da çok birikti) ve araba boştaysa gider
export function tripWanted(w, piles) {
  const R = G.regions && G.regions.sehir;
  if (!CAR || CAR.owner || !G.bank || !R || !R.unlocked || !R.pile || w.bag >= w.bagCap * 0.6) return false;
  const sum = cityPiles(R).reduce((a, q) => a + q.amount, 0);
  if (sum < 250) return false;
  const best = piles.reduce((m, q) => Math.max(m, q.amount), 0);
  return sum >= 1200 || sum > best * 1.3;
}
export function startTrip(w) {
  CAR.owner = w; w.trip = { step: 'toCar', t: 0 };
  w.go('trip', null, DOOR.clone());
}
const hide = (w) => { w.obj.visible = false; };
const show = (w, at, ry) => { w.obj.visible = true; w.obj.position.set(at.x, 0, at.z); w.obj.rotation.y = ry; w.path = []; w.leg = null; };
const sync = (w) => { w.obj.position.set(CAR.o.position.x, 0, CAR.o.position.z); }; // ad etiketi arabanın üstünde
// kasanın yanı: bankonun doğu ucu (kuyruğun önü değil)
const standAt = (pile) => V(pile.zone.x + 1.35, 0, pile.zone.z - 0.05);
function endTrip(w) {
  w.trip = null; if (CAR && CAR.owner === w) CAR.owner = null;
  w.obj.visible = true; w.state = 'decide'; w.path = [];
}
// yolculukta her kare (true: kare işlendi)
export function tripStep(w, dt) {
  const T = w.trip;
  if (!CAR || CAR.owner !== w) { endTrip(w); return false; }
  const o = CAR.o, R = G.regions.sehir;
  w.moving = false;
  const walk = () => { const done = w.walkPath(dt, w.speed); w.finish(dt); return done; };
  switch (T.step) {
    case 'toCar': if (walk()) { T.step = 'board'; T.t = 0; } break;
    case 'board': // kapıyı açıp biner
      T.t += dt; w.obj.rotation.y = lerpAngle(w.obj.rotation.y, PI / 2, Math.min(1, dt * 8)); w.finish(dt);
      if (T.t > 0.45) { hide(w); dropCol(); CAR.path = pts(OUT_V()); CAR.v = 0; T.step = 'outV'; sfx('honk', { at: o.position }); }
      break;
    case 'outV':
      if (drive(dt, false)) { o.visible = false; o.position.set(CX + 92, 0, LANE_W); o.rotation.y = -PI / 2; T.step = 'enterC'; }
      sync(w); break;
    case 'enterC': // şehrin doğu ucunda şerit boşalınca belirir
      if (laneClear('W', CX + 80, CX + 104, o)) { o.visible = true; G.cityCars.add(o); CAR.path = pts(C_IN); CAR.v = 6; T.step = 'inC'; }
      sync(w); break;
    case 'inC':
      if (drive(dt, true)) { CAR.v = 0; o.rotation.y = -PI / 2; parkCol(); show(w, C_DOOR, -PI / 2); T.step = 'walkIn'; T.pile = null; }
      else sync(w);
      break;
    case 'walkIn':
      if (!T.pile) {
        T.pile = R && w.bag < w.bagCap ? cityPiles(R).sort((a, b) => b.amount - a.amount)[0] : null;
        if (!T.pile) { T.step = 'walkBack'; w.path = [C_DOOR.clone()]; break; }
        w.path = [standAt(T.pile)];
      }
      if (walk()) { T.step = 'collect'; T.t = 0; }
      break;
    case 'collect':
      w.obj.rotation.y = lerpAngle(w.obj.rotation.y, -PI / 2, Math.min(1, dt * 8)); w.finish(dt);
      if ((T.t += dt) < 0.05) break;
      T.t = 0; w.target = T.pile;
      if (!w.collect()) { T.pile = null; T.step = 'walkIn'; }
      break;
    case 'walkBack': if (walk()) { T.step = 'board2'; T.t = 0; } break;
    case 'board2':
      T.t += dt; w.finish(dt);
      if (T.t > 0.45) { hide(w); dropCol(); CAR.path = pts(C_OUT); CAR.v = 0; T.step = 'outC'; sfx('honk', { at: o.position }); }
      break;
    case 'outC':
      if (drive(dt, true)) { G.cityCars.delete(o); o.position.set(ROAD_FAR, 0, -17.4); o.rotation.y = PI / 2; CAR.path = pts(IN_V); CAR.v = 6; T.step = 'inV'; }
      sync(w); break;
    case 'inV':
      if (drive(dt, false)) { CAR.v = 0; T.step = 'park'; T.t = 0; }
      sync(w); break;
    case 'park': // burnu kuzeye döner, iner, bankaya yürür
      T.t += dt; o.rotation.y = lerpAngle(o.rotation.y, PARK.ry, Math.min(1, dt * 5)); o.position.y = 0;
      if (T.t > 0.5) {
        o.rotation.y = PARK.ry; parkCol(); show(w, DOOR, -PI / 2); endTrip(w);
        if (w.bag > 0 && G.bank) w.go('deposit', null, V(G.bank.door.x + 0.5, 0, G.bank.door.z));
      }
      break;
  }
  return true;
}
// her kare (main.js): araba ilk muhasebeciyle gelir, hepsi işten çıkınca gider; yolculuktaki muhasebeci çıkarılırsa araba yerine döner
export function updateTahsilat() {
  const staff = (G.staff && G.staff.accountant) || [];
  if (!CAR) { if (staff.length && G.bank && G.scene) makeCar(); return; }
  if (CAR.owner && (CAR.owner.gone || !staff.includes(CAR.owner))) {
    CAR.owner = null; G.cityCars.delete(CAR.o);
    CAR.o.visible = true; CAR.o.position.set(PARK.x, 0, PARK.z); CAR.o.rotation.y = PARK.ry; CAR.path = []; parkCol();
  }
  if (!staff.length && !CAR.owner) { dropCol(); G.scene.remove(CAR.o); CAR = null; }
}
if (typeof window !== 'undefined') window.__tahsilat = () => CAR && { pos: [+CAR.o.position.x.toFixed(1), +CAR.o.position.z.toFixed(1)], v: +CAR.v.toFixed(1), path: CAR.path.length, owner: CAR.owner ? CAR.owner.name : null, step: CAR.owner && CAR.owner.trip ? CAR.owner.trip.step : null, bag: CAR.owner ? Math.floor(CAR.owner.bag) : 0, L: +CAR.L.toFixed(2), W: +CAR.W.toFixed(2) };
