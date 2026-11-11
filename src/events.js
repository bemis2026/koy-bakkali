// Olaylar: köyde arabalı paket sipariş, her bölgede beliren bereket sandığı
import { CUST_RATE } from './rating.js';
import * as THREE from 'three';
import { G, ITEMS, Station, MoneyPile, fly, floatText, sfx, mult, rand, pick, popIn, lerpAngle, offscreen } from './game.js';
import * as M from './models.js';
import { say } from './texts.js';
import { confetti, sparkle, ring } from './fx.js';
import { banner } from './ui.js';
import { walkable } from './world.js';
import { toAccount, toKasa } from './account.js';
import { texRep } from './tex.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// paket servis cebi köyün batı patikasının yanında (otopark 2026-11-01'de kasabanın batısına taşındı, cep yerinde kaldı): arabalar
// batıdan ana yolun doğuya giden (güney) şeridiyle gelir, giriş şeridinden cebe girer, güneydeki dönemeçten çıkış şeridine geçip
// ana yolun batıya giden (kuzey) şeridine döner
const pts = (a) => a.map((q) => { const v = V(q[0], 0, q[1]); if (q[2]) v.rev = true; return v; });
const STOP_Z = -10.5, BAY_X = -23.9;
export const ROAD_FAR = -140; // ana yolun batısında, haritanın dışındaki ormanın içi: taşıtlar burada belirir ve kaybolur (yol düzeni)
const CAR_IN = pts([[ROAD_FAR, -17.4], [-28.6, -17.4], [-26.6, -16.2], [-25.6, -14.4], [-25.6, -12.6], [BAY_X, -11.5], [BAY_X, STOP_Z]]);
const CAR_OUT = pts([[BAY_X, -8.4], [-24.8, -6.6], [-26.9, -5.7], [-28.4, -7.0], [-28.4, -14.6], [-29.2, -16.8], [-30.8, -19.8], [ROAD_FAR, -19.8]]);
// cebin yolları: giriş şeridi, cep, dönemeç ve çıkış şeridi (eskiden otoparkın şeritleriydi)
function bayRoads(parent) {
  for (const [x, z, w, d, y] of [[-25.6, -10.4, 2.6, 11.4, 0.014], [BAY_X, -10.5, 1.6, 4.8, 0.013], [-27.0, -5.9, 5.2, 2.4, 0.015], [-28.4, -10.4, 2.4, 11.4, 0.014]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: texRep('asphalt', w / 3, d / 3), roughness: 0.95 }));
    m.rotation.x = -PI / 2; m.position.set(x, y, z); m.receiveShadow = true; parent.add(m);
  }
}
const VEHICLES = ['classic', 'classic', 'pickup', 'pickup', 'minibus', 'tractor', 'donkey'];
const meydan = () => (G.regions.meydan || G.regions.koy).content;

// ---------- yol düzeni ----------
// 2026-11-04 kullanıcı: "yollarda taşıtların geliş gidiş yönleri belli değil ve araçlar birbirinin içinden geçiyor". Ana yoldaki bütün
// taşıtlar (paket ve otopark arabaları, benzinlik/şarj arabaları, kargo kamyoneti, dolmuş) her adımda buraya sorar: kendi yolunun önündeki
// 12 m'sine (sıradaki noktalar boyunca, dönemeçler dahil) giren taşıtla tampon arası 1 m'ye inince durur, 5 m'de tam hız gider. Düz ileriye
// değil yola bakar: park yerine dönerken dönemecin ardındaki park etmiş arabalar önünü kesmez. İkisi birbirinin yolunda kalırsa (dönemeçte
// burun buruna) önce kaydolan geçer; aynı noktada belirenlerden yeni gelen bekler; otoparkta yerinde duran arabalar sayılmaz; ekran dışında 10 sn'den uzun kilitlenen yoluna devam eder (yol
// tıkanıp kalmasın; görünürken 40 sn bekler, gözümüzün önünde birbirinin içinden geçmesin, 2026-11-05). Taşıt ilk soruşta kaydolur, sahneden kalkınca ya da gizlenince düşer. Hepsi ana yolun batı ucundaki ormandan
// (ROAD_FAR) gelip oraya döner
let tN = 0;
const TRAF = G.traffic = new Set(), TA = new THREE.Vector3(), TC = new THREE.Vector3(), TB = new THREE.Box3(), TS = new THREE.Vector3(), HW = 0.9; // HW: taşıtın yarı eni
const carLen = (o) => o.userData.tLen || (o.userData.tLen = Math.max(2.4, Math.min(8, (TB.setFromObject(o).getSize(TS), Math.max(TS.x, TS.z)))));
// b, yolun (segs: [x, z, yön x, yön z, boy, öncesi]) içine giriyorsa a'nın önünden tampon arası, girmiyorsa Infinity (rb: b'nin yüz açısı)
function pathGap(segs, la, pb, rb, lb) {
  const bx = Math.sin(rb), bz = Math.cos(rb);
  for (const [ax, az, dx, dz, L, run] of segs) {
    const rx = pb.x - ax, rz = pb.z - az, t = rx * dx + rz * dz;
    const c = Math.abs(bx * dx + bz * dz), s = Math.abs(bx * dz - bz * dx), ext = c * lb / 2 + s * HW; // b'nin bu yön boyunca yarı boyu
    if (t < -ext || t > L + ext || run + t < 0) continue;
    if (Math.abs(rx * dz - rz * dx) > HW + 0.1 + s * lb / 2 + c * HW) continue;
    return run + t - la / 2 - ext;
  }
  return Infinity;
}
// path: sıradaki yol noktaları (taşıtın kendi grubunda)
export function gapK(o, path) {
  const u = o.userData; u.tN = u.tN || ++tN; u.tT = G.time; TRAF.add(o);
  o.getWorldPosition(TA); const la = carLen(o), ox = TA.x - o.position.x, oz = TA.z - o.position.z;
  const segs = []; let px = TA.x, pz = TA.z, run = 0;
  for (const q of path) { const x = q.x + ox, z = q.z + oz, dx = x - px, dz = z - pz, L = Math.hypot(dx, dz); if (L < 0.01) continue; segs.push([px, pz, dx / L, dz / L, L, run]); run += L; px = x; pz = z; if (run > 12) break; }
  u.tSegs = segs;
  let k = 1;
  for (const q of TRAF) {
    if (q === o) continue;
    if (!q.parent || !q.visible) { TRAF.delete(q); continue; }
    q.getWorldPosition(TC); const qu = q.userData, lb = carLen(q);
    // gövdeler zaten üst üste (aynı yerde belirdiler, ya da yan yoldan biri girdi): önde kalan ilerler, arkada kalan bekler; tam aynı
    // yerdeyse yeni gelen bekler. Eskiden yalnız 0,5 m'den yakın olanlara bakılıyordu, ormandaki çıkış noktasında arka arkaya belirenler
    // birbirinin içinden çıkıyordu (2026-11-05). Yalnız aynı yöne gidenler: karşı karşıya gelenlerde ikisi de durup kilitleniyordu
    if (G.time - (qu.tT || 0) > 0.5 && TC.x > LOT.rect[0] && TC.x < LOT.rect[1] && TC.z > LOT.rect[2] && TC.z < LOT.rect[3]) continue; // otoparktaki yerinde duran: koridor ona göre çizildi
    const fx = Math.sin(o.rotation.y), fz = Math.cos(o.rotation.y), rx = TC.x - TA.x, rz = TC.z - TA.z, along = rx * fx + rz * fz;
    if (fx * Math.sin(q.rotation.y) + fz * Math.cos(q.rotation.y) > 0.5 && Math.abs(rx * fz - rz * fx) < 2 * HW - 0.2 && Math.abs(along) < (la + lb) / 2) {
      if (along > 0.3 || (along > -0.3 && qu.tN < u.tN)) { k = 0; u.tBy = q; }
      continue;
    }
    const g = pathGap(segs, la, TC, q.rotation.y, lb);
    if (g === Infinity) continue;
    if (u.tN < qu.tN && G.time - qu.tT < 0.5 && pathGap(qu.tSegs, lb, TA, o.rotation.y, la) !== Infinity) continue; // burun buruna: önce gelen geçer
    const kq = Math.max(0, Math.min(1, (g - 1) / 4)); if (kq < k) { k = kq; u.tBy = q; }
  }
  if (k > 0.05) u.tStop = 0; else if (!u.tStop) u.tStop = G.time; else if (G.time - u.tStop > (offscreen(TA) ? 10 : 40)) return 1;
  return k;
}
G.hooks.gapK = gapK;
// yol ver: dikdörtgende ([x0, x1, z0, z1]) yolda olan (son yarım saniyede sürülen) başka taşıt varsa true. Otoparktan geri çıkan ve ana
// yola karışan araba bunu bekler: "önce gelen geçer" kuralıyla öbürünün içine giriyordu (2026-11-05)
function busy(me, x0, x1, z0, z1) {
  for (const q of TRAF) {
    if (q === me || !q.visible || G.time - (q.userData.tT || 0) > 0.5) continue;
    q.getWorldPosition(TC);
    if (TC.x > x0 && TC.x < x1 && TC.z > z0 && TC.z < z1) return true;
  }
  return false;
}
G.hooks.roadBusy = busy; // kargo aracı ve dolmuş U dönüşünden önce bakar (carsi.js, expand-west.js)

export function orderHtml(title, order) {
  const rows = Object.keys(order).map((k) => {
    const o = order[k];
    return `<span class="row${o.got >= o.need ? ' ok' : ''}"><img src="${G.icons[k]}" alt=""><b>${o.got}/${o.need}</b></span>`;
  }).join('');
  return `<span class="ct">${title}</span><span class="rows">${rows}</span><span class="bar"><i></i></span>`;
}

// ---------- arabalı paket sipariş (köy yolu) ----------
class CarDrop extends Station {
  constructor(co, o) {
    super(-15.0, STOP_Z, 1.8, 2.6, o); this.co = co;
    // cepte bekleyen arabanın her yanından teslim edilir (araba z ekseninde durur)
    this.bodyFn = () => { const c = co.car; return c && co.state === 'wait' ? [[c.position.x - 1.05, c.position.x + 1.05, c.position.z - 2.25, c.position.z + 2.25]] : null; };
  }
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.12 && this.deliverFrom(G.stack)) this.t = 0;
  }
  deliverFrom(stack) {
    const co = this.co;
    if (co.state !== 'wait') return false;
    const need = Object.keys(co.order).filter((k) => co.order[k].got < co.order[k].need);
    const it = stack.takeOf(need);
    if (!it) return false;
    co.order[it.type].got++;
    fly(it.obj, co.car, V(0, 1.3, 0), 0.3, 1.2, (o) => o.parent && o.parent.remove(o));
    sfx('put', { npc: stack !== G.stack });
    co.refresh();
    if (Object.values(co.order).every((o) => o.got >= o.need)) co.finish(true);
    return true;
  }
}

export class CarOrders {
  constructor(R, instant) {
    this.R = R; this.state = 'away'; this.t = instant ? 5 : 2; this.car = null; this.path = []; this.v = 0; this.order = null;
    // teslim alanı köy marketinin batı duvarının önünde (elemanlar buraya getirir, ürün arabaya uçar); tabela arabanın beklediği cepte:
    // cebin doğusundaki çimende, ana yolun kaldırımının güneyinde, kameraya dönük. Eskiden batı patikasının üstünde kemerdi; patika
    // marketin altında kalınca sağ direği market duvarının içine, tabelanın yarısı dolapların üstüne düşmüştü (2026-11-11 kullanıcı:
    // "paket servis tabelası saçma yerde duruyor"). Direkler arabanın dönüş yolunun dışında (araba x -22,85'e kadar)
    // paket servis parası tezgaha düşmez: servis elemanı ya da sen teslim edince doğrudan hesaba geçer
    this.drop = new CarDrop(this, { instant });
    bayRoads(R.content);
    const sign = M.makeSign('PAKET SERVİS', '#e8604c', 3.9, 0.6);
    sign.position.set(-20.6, 0, -13.6); sign.scale.setScalar(0.8);
    R.content.add(sign);
    for (const px of [-22.04, -19.16]) G.colliders.push([px - 0.1, px + 0.1, -13.7, -13.5]);
    if (!instant) popIn(sign);
    this.el = document.createElement('div');
    this.el.className = 'order';
    this.label = G.labels.add(this.el, (v) => v.set(BAY_X, 3.2, STOP_Z));
    this.label.hidden = true;
  }
  types() {
    const K = this.R, t = ['domates'];
    if (K.beds.some((b) => b.type === 'salatalik')) t.push('salatalik');
    if (K.gens.yumurta) t.push('yumurta');
    if (K.gens.sut) t.push('sut');
    if (K.gens.peynir) t.push('peynir');
    return t;
  }
  spawnCar() {
    this.car = M.makeVillageCar(pick(VEHICLES)); // köylü arabasında bekler, camdan görünür
    this.car.position.copy(CAR_IN[0]);
    this.car.rotation.y = PI / 2;
    this.path = CAR_IN.slice(1).map((p) => p.clone());
    this.v = 5;
    meydan().add(this.car);
    this.state = 'arrive';
  }
  // yol üzerinde sürer: durağa yaklaşırken yavaşlar, kalkışta hızlanır, ekran dışındayken çabuk geçer
  drive(dt, brake) { return driveCar(this, dt, brake); }
  start() {
    const types = this.types().sort(() => Math.random() - 0.5).slice(0, this.types().length >= 4 ? 3 : 2);
    this.order = {};
    let total = 0;
    for (const t of types) { const need = ITEMS[t].price >= 20 ? 1 : 1 + Math.floor(Math.random() * 3); this.order[t] = { need, got: 0 }; total += need; }
    this.timer = this.total = 60 + total * 12; // acele ettirmesin: rafçı da yetişebilsin
    this.refresh();
    this.label.hidden = false;
    sfx('honk', { at: this.car.position });
    floatText(this.car.position, say('carHi'), 'rival');
  }
  refresh() {
    this.el.innerHTML = orderHtml('🚗 Paket sipariş', this.order);
    this.barEl = this.el.querySelector('.bar i');
  }
  finish(done) {
    let pay = 0;
    for (const k in this.order) { const o = this.order[k]; pay += ITEMS[k].price * (done ? o.need : o.got); }
    pay = Math.round(pay * (done ? 1.8 : 1) * mult());
    // tamamlanan sipariş tek, neşeli bir sesle kutlanır; yarım kalan sessizce ödenir
    const at = this.car.position;
    if (pay > 0) { toAccount(pay, null); floatText(at, done ? `${say('carDone')} +${pay} ₺` : `+${pay} ₺`, 'pos'); sfx('cash', { at }); }
    else { floatText(at, say('carLate'), 'neg'); sfx('bad', { at }); }
    if (done) { confetti(at, 26); sfx('happy', { at }); G.stats.cars++; }
    else if (G.hooks.fineOrder) G.hooks.fineOrder(this.order, at); // yetişmeyen sipariş tazminatı (account.js)
    for (const k in this.order) G.stats.sold += this.order[k].got;
    this.label.hidden = true;
    this.state = 'leave';
    this.path = CAR_OUT.map((p) => p.clone());
    this.v = 0;
  }
  update(dt) {
    switch (this.state) {
      case 'away':
        this.t -= dt;
        if (this.t <= 0) this.spawnCar();
        break;
      case 'arrive':
        if (this.drive(dt, true)) { this.state = 'wait'; this.start(); }
        break;
      case 'wait':
        this.timer -= dt;
        if (this.barEl) { const w = `${Math.round(Math.max(0, this.timer / this.total) * 200) / 2}%`; if (this._bw !== w) { this._bw = w; this.barEl.style.width = w; } }
        if (this.timer <= 0) this.finish(false);
        break;
      case 'leave':
        if (this.drive(dt, false)) { this.car.parent.remove(this.car); this.car = null; this.state = 'away'; this.t = rand(10, 18) / CUST_RATE; }
        break;
    }
    if (this.car && this.state === 'wait') idleCar(this.car, dt);
  }
}


// ---------- otopark: arabalı müşteriler ----------
// Kasabanın batısında, ana yolun kuzeyinde (2026-11-01 kullanıcı: "otoparkı daha büyüt ve yerini biraz daha dışarı taşı"; eskiden köyün
// batısında 3 yerdi). Tek yönlü: arabalar ana yoldan doğu şeride döner, ortadaki koridordan batıya gider; kuzey sıradaki yere burnu
// kuzeye, güney sıradakine burnu güneye girer, geri geri koridora çıkıp batı şeritten ana yolun batıya giden (kuzey) şeridine döner.
// Altı yer (yan yana 3,3 aralıklı: köy arabaları 2,4 enli, kapı açılır), genişletmeyle (expand-west.js xmeydan1) batı uçta iki yer daha.
// world.js buildMeydan şeritleri ve çizgileri bu ölçülerle çizer
export const LOT = { rect: [-87, -68, -35.6, -21.9], east: -69.4, west: -85.6, aisle: -28.0, north: -31.6, south: -24.4, xs: [-78.9, -75.6, -72.3] };
const LOT_SPOTS = LOT.xs.flatMap((x) => [{ x, z: LOT.north }, { x, z: LOT.south }]);
const LOT_IN = [[ROAD_FAR, -17.4], [-72.0, -17.4], [-70.2, -18.6], [LOT.east, -20.8], [LOT.east, -26.4], [LOT.east - 1.2, LOT.aisle]];
// çıkışta erken ve geniş döner: araba ortasından döndüğü için eskiden burnu doğuya giden şeride taşıyordu (2026-11-05)
const LOT_OUT = [[LOT.west + 1.8, LOT.aisle], [LOT.west, LOT.aisle + 1.4], [LOT.west, -23.2], [LOT.west - 1.2, -21.6], [LOT.west - 3.2, -20.4], [LOT.west - 5.4, -19.8], [ROAD_FAR, -19.8]];
const rowOf = (spot) => (spot.z < LOT.aisle ? -1 : 1); // kuzey sıra -1, güney sıra +1
const LOT_CARS = VEHICLES.filter((k) => k !== 'pickup' && k !== 'tractor');

// yol üzerinde sür: son noktaya yaklaşırken yavaşla, kalkışta hızlan, geri vitesle yavaş git, ekran dışında çabuk geç
function driveCar(o, dt, brake) {
  const car = o.car, p = car.position, t = o.path[0];
  if (!t) return true;
  const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz), top = car.userData.speed || 7;
  const yieldK = G.hooks.crossK && d > 0.01 ? G.hooks.crossK(p, dx / d, dz / d) : 1; // yaya geçidinde yavaşlar, yaya varsa durur (roads.js)
  const goal = (t.rev ? 2.2 : brake && o.path.length === 1 ? Math.max(1.0, Math.min(top, d * 1.6)) : top) * yieldK * gapK(car, o.path); // önündeki taşıta göre (yol düzeni)
  o.v = goal < o.v ? goal : Math.min(goal, o.v + 4 * dt);
  const step = o.v * dt * (offscreen(p) ? 2.5 : 1), st = Math.min(d, step);
  if (d <= step) { p.x = t.x; p.z = t.z; o.path.shift(); } else { p.x += (dx / d) * st; p.z += (dz / d) * st; }
  if (d > 0.05) car.rotation.y = lerpAngle(car.rotation.y, t.rev ? Math.atan2(-dx, -dz) : Math.atan2(dx, dz), 1 - Math.exp(-6 * dt));
  for (const w of car.userData.wheels || []) w.rotation.x += (t.rev ? -st : st) / (0.36 * car.scale.x); // teker yarıçapı araba ölçeğiyle
  if (car.userData.donkey) M.animateDonkey(car.userData.donkey, Math.min(1, o.v / 3), dt);
  else car.position.y = o.v > 0.5 ? Math.abs(Math.sin(G.time * 18)) * 0.025 : 0;
  return !o.path.length;
}
// duran araç: eşek dinlenir, kasa sarsılmaz
function idleCar(car, dt) {
  car.position.y = 0;
  if (car.userData.donkey) M.animateDonkey(car.userData.donkey, 0, dt);
}

// arabada bekleyen müşterinin teslim alanı (2026-11-08 kullanıcı: "otoparka ürün taşıma saçma uzak oluyor" → "şuanki gibi kalsın optimize
// et"): servis isteyen araba kaldırıma bakan (güney) sıranın köye en yakın boş yerine girer, teslim alanı burnunun önünde, yolun kuzey
// kaldırımında: otoparka girmeden kaldırımdan teslim edilir. Kuzey sırada (yedek) eskisi gibi arabanın arkasında, koridorun o yarısında
const DROP_Z = -21.95; // kaldırım z -22,75..-21,4; güney sıradaki arabanın engeli -22,5'te biter
class ServiceDrop extends Station {
  constructor(pc) { const r = rowOf(pc.spot); super(pc.spot.x, r > 0 ? DROP_Z : LOT.aisle + r * 0.6, r > 0 ? 3.0 : 2.0, 1.0); this.pc = pc; } // kaldırımda 3 m: yürürken geçince de teslim edilir (yan yerler 3,3 arayla)
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.12 && this.pc.deliverFrom(G.stack)) this.t = 0;
  }
}

class ParkedCar {
  constructor(lot, spot, mode) {
    this.lot = lot; this.spot = spot; this.R = lot.R;
    const r = rowOf(spot);
    // park yerleri 2,4x4,4'lük köy arabasına göre: kamyonet (5,8) ve traktör (6 m) otoparka girmez, klasik araba ve minibüs en çok
    // 4,5 m'ye küçülür (×0,88). Eskiden kuyrukları koridora taşıyor, koridordan geçen araba içlerinden geçiyordu (2026-11-05)
    this.car = M.makeVillageCar(pick(LOT_CARS));
    const L = carLen(this.car);
    if (L > 4.5) { this.car.scale.setScalar(4.5 / L); this.car.userData.tLen = 4.5; }
    this.car.position.set(LOT_IN[0][0], 0, LOT_IN[0][1]);
    this.car.rotation.y = PI / 2;
    meydan().add(this.car);
    this.path = pts([...LOT_IN.slice(1), [spot.x + 1.8, LOT.aisle], [spot.x + 0.3, LOT.aisle + r * 1.2], [spot.x, LOT.aisle + r * 2.4], [spot.x, spot.z]]);
    this.v = 5; this.state = 'arrive'; this.t = 0; this.doorT = 0; this.doorOpen = false;
    this.mode = mode || (Math.random() < 0.55 ? 'walk' : 'service');
  }
  // sürücü kapısı arabanın sol yanında (kuzeye bakan arabada batı, güneye bakanda doğu tarafı)
  doorPoint() {
    const r = this.car.rotation.y, fx = Math.sin(r), fz = Math.cos(r), p = this.car.position;
    return V(p.x + fz * 1.55 - fx * 0.3, 0, p.z - fx * 1.55 - fz * 0.3);
  }
  // sürücü koltuğunun yerdeki izdüşümü
  seatPoint() { this.car.updateMatrixWorld(true); const p = this.car.userData.driver.getWorldPosition(V(0, 0, 0)); p.y = 0; return p; }
  park() {
    // güney sıradakinin burnu yola bakar: engeli kuzey kaldırımına taşmasın (roads.js, z -22,75..-21,4; yayalar oradan yürür)
    this.col = [this.spot.x - 1.25, this.spot.x + 1.25, this.spot.z - 2.6, this.spot.z + (rowOf(this.spot) > 0 ? 1.9 : 2.6)];
    this.col.dyn = true; // gelip giden engel: yol ızgarası onu üstüne ekler, küçük harita çizmez (world.js navGrid, minimap.js)
    G.colliders.push(this.col);
    sfx('honk', { at: this.car.position });
    if (this.mode === 'walk') { this.state = 'getout'; this.doorOpen = true; this.t = 0; } else this.startService();
  }
  // köylü arabadan iner: kapı açılır, koltuktaki köylü aynı boyda ayağa kalkıp kapıya kayar, sonra alışverişe gider
  getOut() {
    this.car.userData.driver.visible = false;
    const n = G.customers.length;
    this.R.spawnDriver(this); // world.js: kapının yanında müşteri olarak belirir
    if (G.customers.length > n) this.takeWalker(G.customers[G.customers.length - 1]);
    this.state = 'shopping'; this.t = 0.8;
  }
  // büyüme animasyonu iptal (arabadakiyle aynı boy), koltuktan kapıya kayar. Dönüşte kapıya varınca onExit'in sildiği köylü
  // silinmez: getin'de koltuğuna kayıp oturunca silinir, araba ondan sonra kalkar
  takeWalker(c) {
    const i = G.pops.findIndex((q) => q.obj === c.obj);
    if (i >= 0) G.pops.splice(i, 1);
    c.obj.scale.setScalar(1);
    const door = c.obj.position.clone(), seat = this.seatPoint(), think = c.think;
    let t = 0;
    c.obj.position.copy(seat); c.obj.rotation.y = this.car.rotation.y;
    c.think = (dt) => { t += dt; c.obj.position.lerpVectors(seat, door, Math.min(1, t / 0.45)); if (t >= 0.45) c.think = think; };
    const destroy = c.destroy.bind(c);
    c.destroy = () => {
      if (this.state === 'shopping' && c.obj.position.distanceTo(this.doorPoint()) < 0.4) { this.walker = { c, from: c.obj.position.clone(), destroy }; c.think = () => {}; }
      else destroy();
    };
  }
  driverBack() { this.state = 'getin'; this.doorOpen = true; this.t = 0; }
  startService() {
    const K = this.R, types = ['domates'];
    if (K.beds.some((b) => b.type === 'salatalik')) types.push('salatalik');
    for (const t of ['yumurta', 'sut', 'peynir']) if (K.gens[t]) types.push(t);
    this.order = {};
    let total = 0;
    for (const t of types.sort(() => Math.random() - 0.5).slice(0, Math.min(types.length, Math.random() < 0.5 ? 2 : 3))) {
      const need = ITEMS[t].price >= 20 ? 1 : 1 + Math.floor(Math.random() * 2);
      this.order[t] = { need, got: 0 }; total += need;
    }
    this.timer = this.total = 55 + total * 8; // köyden otoparka yol uzun: 2026-11-08'de 40'tan 55'e
    this.el = document.createElement('div');
    this.el.className = 'order';
    this.label = G.labels.add(this.el, (v) => v.set(this.spot.x, 3.0, this.spot.z));
    this.drop = new ServiceDrop(this);
    this.refresh();
    this.state = 'service';
    floatText(this.car.position, say('carHi'), 'rival');
  }
  refresh() { this.el.innerHTML = orderHtml('🅿️ Arabaya servis', this.order); this.barEl = this.el.querySelector('.bar i'); }
  deliverFrom(stack) {
    if (this.state !== 'service') return false;
    const need = Object.keys(this.order).filter((k) => this.order[k].got < this.order[k].need);
    const it = stack.takeOf(need);
    if (!it) return false;
    this.order[it.type].got++;
    fly(it.obj, this.car, V(0, 1.2, 0), 0.3, 1.2, (o) => o.parent && o.parent.remove(o));
    sfx('put', { at: this.car.position });
    this.refresh();
    if (Object.values(this.order).every((o) => o.got >= o.need)) this.finish(true);
    return true;
  }
  finish(done) {
    let pay = 0, got = 0;
    for (const k in this.order) { const o = this.order[k]; pay += ITEMS[k].price * o.got; got += o.got; }
    pay = Math.round(pay * (done ? 1.5 : 1) * mult() * ((G.mods && G.mods.lotCharge) || 1)); // şarjlı otopark (genişletme) 1,3 kat
    if (pay > 0) { const m = this.lot.meter(this.car.position); toKasa('otopark', 'Otopark', pay, V(m.position.x, 1.5, m.position.z), '🅿️'); if (done) floatText(this.car.position, say('carDone'), 'pos'); } // otoparkın kasasında birikir
    else { floatText(this.car.position, say('carLate'), 'neg'); sfx('bad', { at: this.car.position }); }
    if (done) confetti(this.car.position, 24);
    else if (G.hooks.fineOrder) G.hooks.fineOrder(this.order, this.car.position);
    if (got) { G.stats.customers++; G.stats.sold += got; }
    G.labels.remove(this.label);
    this.drop.remove();
    this.leave();
  }
  leave() {
    if (this.state === 'leave') return;
    const i = G.colliders.indexOf(this.col);
    if (i >= 0) G.colliders.splice(i, 1);
    this.state = 'leave'; this.doorOpen = false;
    // geri geri koridora çıkar (karşı sıradakinin kuyruğuna değmeden), batıya döner; batı uçtaki ek yerden çıkan araba koridorun ucunu atlar
    const x = this.spot.x - 1.8;
    this.path = pts([[this.spot.x + 0.6, LOT.aisle + rowOf(this.spot) * 1.0, 1], [x, LOT.aisle], ...LOT_OUT.filter((q, i) => i > 0 || q[0] < x)]);
    this.v = 0;
    sfx('honk', { at: this.car.position });
  }
  update(dt) {
    const D = this.car.userData.door;
    this.doorT += ((this.doorOpen ? 1 : 0) - this.doorT) * Math.min(1, dt * 7);
    if (D) D.rotation.y = -D.userData.side * 1.15 * this.doorT;
    switch (this.state) {
      case 'arrive': { // doğuya giden şeritten otoparka dönmeden önce karşıdan (batıya giden şeritte) gelen geçer
        const q = this.path[0], turn = q && !this.cross && Math.abs(q.x - LOT_IN[2][0]) < 0.05 && Math.abs(q.z - LOT_IN[2][1]) < 0.05;
        if (turn && busy(this.car, LOT_IN[2][0] - 6, LOT_IN[2][0] + 14, -20.9, -18.7)) { this.v = 0; idleCar(this.car, dt); break; }
        if (turn) this.cross = true;
        if (driveCar(this, dt, true)) this.park();
        break;
      }
      case 'getout': this.t += dt; idleCar(this.car, dt); if (this.t > 0.4) this.getOut(); break;
      case 'shopping': idleCar(this.car, dt); if (this.t > 0) { this.t -= dt; if (this.t <= 0) this.doorOpen = false; } break;
      case 'getin': { // köylü döndü: kapı açılır, kapıdan koltuğuna kayıp oturur, kapı kapanır; araba ancak o zaman kalkar
        this.t += dt; idleCar(this.car, dt);
        const w = this.walker, d = this.car.userData.driver;
        if (w) { w.c.obj.position.lerpVectors(w.from, this.seatPoint(), Math.min(1, this.t / 0.45)); w.c.face(this.car.rotation.y, dt); }
        if (this.t >= 0.45 && !d.visible) { d.visible = true; if (w) { w.destroy(); this.walker = null; } }
        if (this.t > 0.75) this.doorOpen = false;
        if (this.t > 1.35) this.leave();
        break;
      }
      case 'service':
        idleCar(this.car, dt);
        this.timer -= dt;
        if (this.barEl) { const w = `${Math.round(Math.max(0, this.timer / this.total) * 200) / 2}%`; if (this._bw !== w) { this._bw = w; this.barEl.style.width = w; } }
        if (this.timer <= 0) this.finish(false);
        break;
      case 'leave': {
        // geri çıkmadan önce koridorun o yanı, çıkış şeridine girmeden (burnu yola değmeden) batıya giden şeridin doğusu boş olmalı;
        // yola karışmaya başlayan durmaz, yoldaki onu görüp arkasında bekler
        const q = this.path[0], x = this.spot.x, exit = q && !this.merge && Math.abs(q.z + 23.2) < 0.05;
        if ((!this.v && q && q.rev && busy(this.car, x - 7, x + 7, LOT.aisle - 2.6, LOT.aisle + 2.6)) || (exit && busy(this.car, LOT.west - 4, LOT.west + 14, -20.9, -18.7))) { this.v = 0; idleCar(this.car, dt); break; }
        if (exit) this.merge = true;
        if (driveCar(this, dt, false)) { this.car.parent.remove(this.car); this.spot.pc = null; }
        break;
      }
    }
  }
}

// park otomatı: gri gövde, mavi P levhası, ekran ve kart yuvası
function makeParkMeter() {
  const g = new THREE.Group();
  M.rbox(0.42, 1.25, 0.32, 0.06, M.mat('#c9ced4', { rough: 0.4 }), 0, 0.62, 0, g);
  M.rbox(0.46, 0.12, 0.36, 0.04, M.mat('#2f6db5'), 0, 1.3, 0, g);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ color: '#ffffff' })); p.position.set(0, 1.02, 0.165); g.add(p);
  M.rbox(0.2, 0.2, 0.02, 0.02, M.mat('#2f6db5'), 0, 1.02, 0.17, g); // P levhası (mavi zemin)
  M.rbox(0.07, 0.15, 0.02, 0.01, M.mat('#ffffff'), -0.03, 1.02, 0.183, g); M.rbox(0.07, 0.07, 0.02, 0.01, M.mat('#ffffff'), 0.02, 1.06, 0.183, g); // P harfi
  M.rbox(0.28, 0.14, 0.02, 0.02, M.mat('#9fe3b0', { emissive: '#5fd38a', ei: 0.5 }), 0, 0.72, 0.165, g); // ekran
  M.rbox(0.14, 0.03, 0.02, 0.01, M.mat('#1d1f24'), 0, 0.52, 0.165, g); // kart yuvası
  g.traverse((o) => { if (o.isMesh && !(o.material instanceof THREE.MeshBasicMaterial)) o.castShadow = true; });
  return g;
}

export class Otopark {
  constructor(R, instant) {
    this.R = R;
    this.spots = LOT_SPOTS.map((s) => ({ ...s, pc: null }));
    this.t = instant ? 6 : 3;
    // görevli yok: araç sahibi park otomatına öder, para iki otomatın arasındaki kasa kutusunda birikir (account.js). Otomatlar
    // otoparkın arka (kuzey) kenarında, kuzey sıradaki arabaların burnunun önünde
    this.meters = [-77.25, -73.95].map((x) => {
      const m = makeParkMeter(); m.position.set(x, 0, -34.6); meydan().add(m); if (!instant) popIn(m);
      G.colliders.push([x - 0.28, x + 0.28, -34.8, -34.4]);
      return m;
    });
  }
  // bölge genişletmesi (expand-west.js xmeydan1): otoparkın batı ucuna ek park yeri
  addSpot(x, z) { if (!this.spots.some((s) => s.x === x && s.z === z)) this.spots.push({ x, z, pc: null }); }
  // aracın en yakınındaki otomat
  meter(at) { return this.meters.reduce((a, b) => (a.position.distanceTo(at) <= b.position.distanceTo(at) ? a : b));
  }
  update(dt) {
    this.t -= dt;
    const free = this.spots.filter((s) => !s.pc);
    if (this.t <= 0 && free.length) {
      this.t = rand(10, 18);
      // servis isteyen kaldırıma bakan sıranın köye (doğuya) en yakın boş yerine girer; inip yürüyecek olan önce arka (kuzey) sırayı doldurur
      const front = free.filter((s) => rowOf(s) > 0).sort((a, b) => b.x - a.x)[0], back = free.filter((s) => rowOf(s) < 0);
      if (front && Math.random() < 0.45) front.pc = new ParkedCar(this, front, 'service');
      else { const s = back.length ? pick(back) : pick(free); s.pc = new ParkedCar(this, s, 'walk'); }
    }
    for (const s of this.spots) if (s.pc) s.pc.update(dt);
  }
}

// ---------- bereket sandığı ----------
function freeSpot(x, z) {
  if (!walkable(x, z)) return false;
  for (const c of G.colliders) if (x > c[0] - 0.9 && x < c[1] + 0.9 && z > c[2] - 0.9 && z < c[3] + 0.9) return false;
  for (const s of G.stations) if (s.zone.has({ x, z })) return false;
  return true;
}

class Boosts {
  constructor() { this.t = 70; this.crate = null; this.ringT = 0; }
  spawn() {
    const p = G.player.position;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * PI * 2, d = rand(4, 8);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (!freeSpot(x, z)) continue;
      const obj = M.makeCrate();
      obj.position.set(x, 0.3, z);
      G.scene.add(obj);
      popIn(obj);
      const el = document.createElement('div');
      el.className = 'crate';
      el.innerHTML = '<span class="ct">✨ Bereket Sandığı <b></b></span>';
      const lbl = G.labels.add(el, (v) => v.set(x, 2.0, z));
      this.crate = { obj, lbl, tEl: el.querySelector('b'), life: 30 };
      sfx('glass', { at: obj.position });
      return;
    }
    this.t = 8;
  }
  remove() {
    const c = this.crate;
    G.scene.remove(c.obj);
    G.labels.remove(c.lbl);
    this.crate = null;
  }
  take() {
    const pos = this.crate.obj.position.clone();
    G.boost = Math.min(120, G.boost + 60);
    G.stats.boosts++;
    confetti(pos, 50);
    sparkle(pos, '#ffe14d', 12);
    sfx('boost');
    banner(say('boost').toLocaleUpperCase('tr'), '2 kat kazanç · 60 sn');
    this.remove();
    this.t = rand(110, 170);
  }
  update(dt) {
    if (G.boost > 0) G.boost = Math.max(0, G.boost - dt);
    if (!this.crate) {
      this.t -= dt;
      if (this.t <= 0) this.spawn();
      return;
    }
    const c = this.crate;
    c.life -= dt;
    c.obj.rotation.y += dt * 1.6;
    c.obj.position.y = 0.3 + Math.abs(Math.sin(G.time * 3)) * 0.3;
    c.tEl.textContent = `${Math.ceil(c.life)} sn`;
    this.ringT -= dt;
    if (this.ringT <= 0) { this.ringT = 0.8; ring(c.obj.position.clone().setY(0), '#ffd23f', 1.4); }
    const p = G.player.position;
    if (Math.hypot(p.x - c.obj.position.x, p.z - c.obj.position.z) < 1.3) this.take();
    else if (c.life <= 0) { this.remove(); this.t = rand(110, 170); } // kaçırılan sandık: sonraki bir süre sonra gelir
  }
}

let boosts = null;
export function initEvents() { boosts = new Boosts(); G.boosts = boosts; }
export function updateEvents(dt) { if (boosts) boosts.update(dt); }
