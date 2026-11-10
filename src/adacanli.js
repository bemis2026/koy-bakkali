// Martı Adası'nın canlıları ve hizmetleri (karası ada.js'te; sıkılma, acente ve köye dönüş tatil.js'te).
// 2026-11-03 kullanıcı: "Tatil adasına büyük cruise gemisi ile gidelim. Ayrıca tatil adasında hiç bir hizmet yok. Orada denize
// girebilelim. Plajda voleybol oynayabilelim. Şezlongta yatabilelim... Adadaki insanların yürüyüşleri tuhaf olmuş... dondurma mısır
// gazoz standları koy. Denizde jetski yunus vb araçları kullanabilelim... çeşitli irili ufaklı kuş türleri olsun ve denizde yunusları
// görelim arasıra. Sahilinde gitar çalan eğlenen insanlar olsun. Köpeğiyle frizbi oynayan, plaj futbolu ve voleybolu olsun. Dj kabini
// de olsun. Denizde insanlar yüzsün." Seçimler: tezgâhlar ve turlar küçük ücretli (keyfi hızlı düzeltir), voleybolda ve futbolda
// avatar sahaya girince kendiliğinden oynar, gemi yolculuğu sahnesi (dokununca geçilir), modeller kodla çizilir.
// Yürüyüş düzeltmesi: eski kıyı yürüyüşçüleri 4-6 m/sn kayarken bacakları 0,45 hızla oynuyordu (patenle kayar gibiydi). Artık her
// yürüyen 1,1-1,5 m/sn gider, bacak hızı müşterilerin oranıyla eşleşir (3 m/sn = 1), ayakları arazinin üstündedir.
// Her yeni etkinlik (deniz, şezlong, tezgâh, tur, oyun, zirve, dans, gitar başı) dönüşte 1 dakika daha dinçlik verir (tatil.js fun).
import * as THREE from 'three';
import * as M from './models.js';
import { G, Station, floatText, sfx, toast, rand, makeItem, offscreen } from './game.js';
import { ring, confetti, smoke } from './fx.js';
import { trail, wake, splash, updateIz, clearIz } from './iz.js';
import { makePetDog, posePet } from './pets.js';
import { calgiSrc, beatOf } from './calgi.js';
import * as A from './ada.js';
import { day } from './daylight.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
const onIsle = () => !!(G.player && G.player.position.x > 700);
const lerpA = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const gy = (x, z) => A.ground(x, z);
let L = null, frameN = 0;

// ---------- yürünebilirlik ve yükseklik: world.js walkable/heightAt x > 700'de buraya sorar ----------
const SWIM = -0.42; // bundan derinde yüzülür
const onJetty = (x, z) => x > A.JETTY.x0 - 0.3 && x < A.JETTY.x1 && Math.abs(z - A.JETTY.z) < A.JETTY.w / 2;
const onTavern = (x, z) => x > A.TAVERN.x0 && x < A.TAVERN.x1 && z > A.TAVERN.z0 && z < A.TAVERN.z1; // balık restoranının güvertesi
// binilen yunus ve jetski burnunu kumsala sokmaz: çevresinde 1,1 m her yöne su olmalı (2026-11-08: "denizden sahile çıkmasınlar")
const deep = (x, z) => gy(x + 1.1, z) < -0.3 && gy(x - 1.1, z) < -0.3 && gy(x, z + 1.1) < -0.3 && gy(x, z - 1.1) < -0.3;
const inShip = (x, z) => Math.abs(x - A.SHIP_DOCK.x) < 18.6 && Math.abs(z - A.SHIP_DOCK.z) < 4.3;
export const ride = { kind: null, t: 0, max: 0, obj: null, home: null, hop: 0, wk: 0, warned: false };
const voy = { on: false, park: false, go: true, t: 0, T: 10, x0: 0, x1: 0, deckY: 9, done: null, ui: null, wk: 0 };
G.isle = {
  h(x, z) {
    if (voy.on) return voy.deckY;
    if (ride.kind) return 0;
    if (onJetty(x, z)) return A.JETTY.y;
    if (onTavern(x, z)) return A.TAVERN.y;
    const g = gy(x, z);
    return g < SWIM ? -0.48 : g;
  },
  walk(x, z) {
    if (voy.on) return true;
    if (inShip(x, z)) return false;
    if (ride.kind === 'parasut') return true; // uçarken yerini glideTick verir
    if (ride.kind) return gy(x, z) < -0.6 && deep(x, z) && !jets.some((j) => j !== ride.obj && Math.hypot(j.position.x - x, j.position.z - z) < 1.7) && A.edge(x, z) < 2.4 && !onJetty(x, z) && !onTavern(x, z); // araçla yalnız açık suda
    if (onJetty(x, z)) return true;
    if (onTavern(x, z)) return !A.blocked(x, z);
    if (gy(x, z) < SWIM) return A.edge(x, z) < 1.45; // yüzme alanı: kıyıdan ~20 m
    return !A.blocked(x, z);
  },
};

// ---------- oyuncunun hali ----------
const me = { sp: 0, lp: null, still: 0, swim: false, wetT: 0, splash: 0, lie: null, lieT: 0, seat: null, seatT: 0, dine: null, dance: 0, arms: 0, summit: false, summitDone: false, fener: false, fenerDone: false };
export const isleSpeedK = () => (ride.kind === 'jet' ? 1.9 : ride.kind === 'yunus' ? 1.45 : me.swim ? 0.55 : 1);
export const isleRelaxK = () => (me.lie ? 3 : me.seat || me.dine || me.dance > 0 || me.swim || ride.kind ? 1.6 : 0.8);
export const fun = new Set();
const FUN = { dondurma: '✨ Dondurma +%8', misir: '✨ Mısır +%8', gazoz: '✨ Gazoz +%8', deniz: '✨ Deniz +%8', sezlong: '✨ Şezlong +%8', jet: '✨ Jetski +%8',
  yunus: '✨ Yunus turu +%8', voleybol: '✨ Voleybol +%8', futbol: '✨ Futbol +%8', zirve: '✨ Zirve +%8', dans: '✨ Dans +%8', gitar: '✨ Gitar başı +%8',
  izgara: '✨ Balık +%8', parasut: '✨ Yamaç paraşütü +%8', fener: '✨ Deniz feneri +%8', kokteyl: '✨ Kokteyl +%8', kahve: '✨ Türk kahvesi +%8', hamak: '✨ Hamak +%8' };
function memory(k) {
  if (fun.has(k)) return;
  fun.add(k);
  floatText(G.player.position.clone(), FUN[k], 'pos');
  if (G.hooks.isleFun) G.hooks.isleFun(k); // tatil keyfi barı +%8 (tatil.js)
  if (fun.size === 1) toast('✨ Adada yaptığın her yeni şey tatil keyfini %8 doldurur');
}
// yemek, gol, paraşüt inişi gibi anlar tatil keyfi barını doldurur; sıkılma barla birlikte azalır (tatil.js addKeyif)
const relax = (n) => { if (G.hooks.isleRelax) G.hooks.isleRelax(n); };
const fee = (k) => Math.max(50, Math.round(((80 + 15 * (G.level || 1)) * k) / 10) * 10);
function pay(k) {
  const p = fee(k);
  if (G.money < p) { toast(`💸 Paran yetmiyor: ${p.toLocaleString('tr-TR')} ₺`); sfx('bad'); return false; }
  G.money -= p; floatText(G.player.position.clone(), `-${p.toLocaleString('tr-TR')} ₺`, 'neg'); sfx('cash');
  return true;
}

// ---------- yardımcılar ----------
function person(look, swim) { const o = M.makeCharacter(look || M.touristLook()); if (swim && M.setSwimwear) M.setSwimwear(o, true); o.rotation.order = 'YXZ'; L.root.add(o); return o; }
function place(o, x, z, ry, dy = 0) { o.position.set(x, gy(x, z) + dy, z); if (ry != null) o.rotation.y = ry; }
const seatPose = (o, a = -1.45) => { for (const l of o.userData.legs) l.rotation.x = a; };
const local = (c, x, z) => { const co = Math.cos(c.ry), si = Math.sin(c.ry), dx = x - c.x, dz = z - c.z; return [dx * co - dz * si, dx * si + dz * co]; };
const faceX = (c, sg) => Math.atan2(Math.cos(c.ry) * sg, -Math.sin(c.ry) * sg); // sahanın yerel ±x yönüne bakış
const near = (o, r) => { const p = G.player.position; return Math.abs(o.position.x - p.x) + Math.abs(o.position.z - p.z) < r; };
// uzaktakiler dört karede bir (biriken sürle) güncellenir
function lod(n, dt) {
  n.acc = (n.acc || 0) + dt;
  if (n.ph4 === undefined) n.ph4 = Math.floor(rand(0, 4));
  if (!near(n.o, 50) && (frameN + n.ph4) % 4) return 0;
  const d = n.acc; n.acc = 0; return d;
}
function ballMesh(col, r) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })); m.castShadow = true; m.userData.bkNo = true; m.userData.sd = true; L.root.add(m); return m; }
function swimPose(o, t, back) {
  const u = o.userData;
  o.rotation.x = back ? -1.2 : 1.15;
  u.arms[0].rotation.x = back ? t : -t; u.arms[1].rotation.x = u.arms[0].rotation.x + PI; // kulaç
  u.legs[0].rotation.x = Math.sin(t * 2.4) * 0.35; u.legs[1].rotation.x = -u.legs[0].rotation.x; // ayak çırpma
}

// ---------- kumsalda yürüyenler ----------
const walkers = [];
function walkersTick(dt) {
  for (const w of walkers) {
    const d = lod(w, dt); if (!d) continue;
    if (w.pause > 0) { w.pause -= d; w.o.rotation.y = lerpA(w.o.rotation.y, A.polar(w.th, w.e).ry, 1 - Math.exp(-3 * d)); M.animateCharacter(w.o, 0, d, false); continue; }
    if ((w.next -= d) <= 0) { w.next = rand(12, 26); w.pause = rand(3, 6); } // ara sıra durup denize bakar
    const a = A.polar(w.th, w.e), b = A.polar(w.th + 0.002, w.e), ds = Math.hypot(b.x - a.x, b.z - a.z) / 0.002;
    w.th += (w.v * d / ds) * w.dir;
    if (w.th > 0.74 * PI) w.dir = -1; else if (w.th < 0.26 * PI) w.dir = 1;
    const p = A.polar(w.th, w.e), o = w.o;
    o.rotation.y = lerpA(o.rotation.y, Math.atan2(p.x - o.position.x, p.z - o.position.z), 1 - Math.exp(-8 * d));
    place(o, p.x, p.z);
    M.animateCharacter(o, w.v / 3, d, false);
  }
}
// ---------- dağ yürüyüşçüleri: kumsaldan zirveye patika ----------
const ROUTE = A.ROUTE_UP.map(([x, z]) => ({ x, z })), RLEN = [0];
for (let i = 1; i < ROUTE.length; i++) RLEN.push(RLEN[i - 1] + Math.hypot(ROUTE[i].x - ROUTE[i - 1].x, ROUTE[i].z - ROUTE[i - 1].z));
function routeAt(s) {
  let i = 1; while (i < ROUTE.length - 1 && RLEN[i] < s) i++;
  const a = ROUTE[i - 1], b = ROUTE[i], k = Math.max(0, Math.min(1, (s - RLEN[i - 1]) / (RLEN[i] - RLEN[i - 1])));
  return [a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k];
}
const hikers = [];
function hikersTick(dt) {
  const end = RLEN[RLEN.length - 1];
  for (const h of hikers) {
    const d = lod(h, dt); if (!d) continue;
    if (h.pause > 0) { h.pause -= d; M.animateCharacter(h.o, 0, d, false); continue; }
    h.s += h.v * d * h.dir;
    if (h.s >= end) { h.s = end; h.dir = -1; h.pause = rand(6, 10); } else if (h.s <= 0) { h.s = 0; h.dir = 1; h.pause = rand(4, 8); }
    const [x, z] = routeAt(h.s), o = h.o;
    o.rotation.y = lerpA(o.rotation.y, Math.atan2(x - o.position.x, z - o.position.z), 1 - Math.exp(-6 * d));
    place(o, x, z);
    M.animateCharacter(o, h.v / 3, d, false);
  }
}
// ---------- yüzenler ve simitle süzülenler ----------
const swimmers = [], floaters = [], liers = []; // liers: şezlongda yatan tatilciler
const swimSpot = () => A.polar(rand(0.4, 0.6) * PI, rand(1.06, 1.24));
function swimTick(dt) {
  for (const s of swimmers) {
    const d = lod(s, dt); if (!d) continue;
    const o = s.o, p = o.position;
    if (!s.to || Math.hypot(s.to.x - p.x, s.to.z - p.z) < 0.4) s.to = swimSpot();
    const dx = s.to.x - p.x, dz = s.to.z - p.z, l = Math.hypot(dx, dz) || 1, st = (s.back ? 0.5 : 0.85) * d;
    p.x += (dx / l) * st; p.z += (dz / l) * st;
    o.rotation.y = lerpA(o.rotation.y, Math.atan2(dx, dz) + (s.back ? PI : 0), 1 - Math.exp(-2.5 * d));
    const t = G.time * (s.back ? 2.6 : 4.2) + s.ph;
    p.y = -0.42 + Math.sin(t * 0.5) * 0.04;
    swimPose(o, t, s.back);
    if ((s.spl -= d) <= 0) { s.spl = rand(1.2, 2); if (near(o, 30)) ring(V(p.x + Math.sin(o.rotation.y) * 0.6, -0.12, p.z + Math.cos(o.rotation.y) * 0.6), '#ffffff', 0.55); }
  }
  for (const f of floaters) {
    f.a += dt * f.w;
    const x = f.cx + Math.cos(f.a) * 2.2, z = f.cz + Math.sin(f.a) * 1.6, y = Math.sin(G.time * 1.6 + f.ph) * 0.05;
    f.ring.position.set(x, y - 0.02, z); f.o.position.set(x, y - 0.57, z); f.o.rotation.y = f.a * 0.3 + f.ph;
    if (near(f.o, 40)) { const u = f.o.userData, t = G.time + f.ph; M.breathe(f.o, t, 0.5); u.arms[0].rotation.x = -0.5 + Math.sin(t * 1.3) * 0.3; u.arms[1].rotation.x = -0.5 + Math.sin(t * 1.3 + 2) * 0.3; } // ellerini suda gezdirir
  }
  // şezlongdakiler: nefes alır, başını çevirir, arada kolunu başının altına atar, bir dizini kaldırıp indirir
  for (const n of liers) {
    if (!near(n.o, 40)) continue;
    const u = n.o.userData, t = G.time + n.ph, e = Math.max(0, Math.sin(t * 0.23)) ** 3, k = Math.max(0, Math.sin(t * 0.13 + 2)) ** 2;
    M.breathe(n.o, t, 0.35);
    u.arms[n.side].rotation.x = -0.1 - e * 2.7; u.arms[1 - n.side].rotation.x = -0.1 + Math.sin(t * 0.4) * 0.08;
    u.legs[n.side].rotation.x = -k * 0.55; u.legs[1 - n.side].rotation.z = Math.sin(t * 0.17) * 0.06;
  }
}

// ---------- tezgâhlar ve kiralama: ödeme alanında durunca alınır ----------
class Pay extends Station {
  constructor(x, z, o) { super(x, z, 1.6, 1.4, { dashed: true, y: (o.y ?? gy(x, z)) + 0.06 }); this.o = o; this.dwell = 0; this.used = false; this.told = false; }
  update(dt) {
    if (!this.inside || ride.kind || voy.on) { this.dwell = 0; if (!this.inside) { this.used = false; this.told = false; } return; }
    const z = this.zone;
    if (!this.told) { this.told = true; floatText(V(z.x, gy(z.x, z.z), z.z), `${this.o.label} · ${fee(this.o.k).toLocaleString('tr-TR')} ₺`, ''); }
    this.dwell = me.sp < 0.5 ? this.dwell + dt : 0;
    if (!this.used && this.dwell > 0.8) { this.used = true; if (pay(this.o.k)) this.o.buy(); }
  }
}
const treats = [];
function treat(kind) {
  let obj;
  if (kind === 'gazoz') { obj = new THREE.Group(); const gm = M.mat('#3f8f4a', { rough: 0.25 }); M.cyl(0.07, 0.07, 0.3, 8, gm, 0, 0.15, 0, obj); M.cyl(0.03, 0.05, 0.14, 6, gm, 0, 0.37, 0, obj); }
  else if (kind === 'kokteyl') { // uzun bardakta meyve kokteyli, kamış ve kâğıt şemsiye
    obj = new THREE.Group(); M.cyl(0.075, 0.06, 0.26, 10, M.mat('#f39a3a', { rough: 0.25 }), 0, 0.13, 0, obj); M.cyl(0.08, 0.08, 0.03, 10, M.mat('#f6d35a'), 0, 0.27, 0, obj);
    const st = M.cyl(0.01, 0.01, 0.3, 5, M.mat('#ffffff'), 0.03, 0.33, 0, obj); st.rotation.z = -0.3; const um = M.cyl(0.0, 0.1, 0.05, 8, M.mat('#f28db2'), -0.04, 0.36, 0.02, obj); um.rotation.z = 0.4; }
  else if (kind === 'kahve') { // tabakta Türk kahvesi fincanı, köpüklü
    obj = new THREE.Group(); M.cyl(0.11, 0.11, 0.015, 12, M.mat('#f7f4ec', { rough: 0.3 }), 0, 0, 0, obj); M.cyl(0.06, 0.045, 0.1, 10, M.mat('#f7f4ec', { rough: 0.3 }), 0, 0.06, 0, obj);
    M.cyl(0.055, 0.055, 0.01, 10, M.mat('#8a5a3a'), 0, 0.105, 0, obj); }
  else obj = makeItem(kind);
  L.root.add(obj); treats.push({ obj, t: 0 });
  floatText(G.player.position.clone(), '😋', 'pos'); relax(18); memory(kind);
}
function treatsTick(dt) {
  for (let i = treats.length - 1; i >= 0; i--) {
    const T = treats[i], P = G.player, r = P.rotation.y;
    T.t += dt;
    T.obj.position.set(P.position.x + Math.sin(r) * 0.32, P.position.y + 1.15 + Math.sin(T.t * 5) * 0.04, P.position.z + Math.cos(r) * 0.32);
    T.obj.scale.setScalar(Math.max(0.01, Math.min(1, (3 - T.t) * 2)));
    if (T.t > 3) { T.obj.removeFromParent(); treats.splice(i, 1); }
  }
}
// jetski ve yunus turu
let jets = [], penD = [];
function startRide(kind) {
  standUp();
  const o = kind === 'jet' ? jets[0] : penD[0].o, home = kind === 'jet' ? L.jets[0] : L.pen;
  Object.assign(ride, { kind, t: kind === 'jet' ? 60 : 50, obj: o, home, hop: 0, wk: 0, warned: false });
  ride.max = ride.t;
  G.player.position.set(home.x, 0, home.z);
  ring(V(home.x, -0.1, home.z), '#ffffff', 1.4);
  toast(kind === 'jet' ? '🚤 Jetski 60 sn senin! Denizde gez; süre bitince kulübeye dönersin' : '🐬 Yunus turu başladı! 50 sn yunusun sırtında denizdesin');
  memory(kind);
}
function rideTick(dt) {
  if (ride.kind === 'parasut') { glideTick(dt); return; }
  const P = G.player, p = P.position, o = ride.obj, u = P.userData;
  ride.t -= dt;
  o.position.set(p.x, 0, p.z); o.rotation.y = P.rotation.y;
  if (ride.kind === 'jet') { // 2026-11-08 (kullanıcı: "jetskilerin üstünde uçuyor gibiyiz"): kalça selenin 0,5 m üstündeydi. Sele (jetskide z -0,2, üstü 0,44) kalçanın altına gelir
    const fy = -0.05 + Math.sin(G.time * 5) * 0.03, ry = P.rotation.y;
    o.position.set(p.x + Math.sin(ry) * 0.2, fy, p.z + Math.cos(ry) * 0.2); o.rotation.z = Math.sin(G.time * 3) * 0.04 - Math.min(0.15, me.sp * 0.01); p.y = fy - 0.1;
  }
  else { // yunus yüzer, hızlanınca ara sıra sıçrar
    if (ride.hop <= 0 && me.sp > 5 && Math.random() < dt * 0.45) { ride.hop = 1; splash(p.x, p.z, 7, 2.4, P.rotation.y); }
    let y = -0.1 + Math.sin(G.time * 2.4) * 0.05; // sırtı ve yüzgeci sudan çıkar
    if (ride.hop > 0) {
      ride.hop -= dt * 1.1; const k = 1 - Math.max(0, ride.hop);
      y += Math.sin(k * PI) * 0.9; o.rotation.x = -Math.cos(k * PI) * 0.4;
      if (ride.hop <= 0) { splash(p.x, p.z, 14, 3.4, P.rotation.y); sfx('pop'); }
    } else o.rotation.x = 0;
    o.userData.tail.rotation.x = Math.sin(G.time * (6 + me.sp * 0.6)) * (0.18 + Math.min(0.2, me.sp * 0.03)); // kuyruk çırpar
    o.position.y = y; p.y = y - 0.3; // oturuş: kalça ayaktan 0,62 yukarıda, yunusun sırtında (0,29)
  }
  if (ride.kind === 'jet') { seatPose(P, -0.95); for (const l of u.legs) l.rotation.z = Math.sign(l.position.x || 1) * 0.3; u.arms[0].rotation.x = u.arms[1].rotation.x = -1.0; } // ata biner gibi: bacaklar iki yandan basamağa
  else { seatPose(P, -1.3); u.arms[0].rotation.x = u.arms[1].rotation.x = -1.15; }
  if (me.sp > 1.2 && (ride.wk -= dt) <= 0) { // arkada köpük izi, iki yana açılan dalga (iz.js)
    ride.wk = 0.1; const ry = P.rotation.y;
    trail(p.x - Math.sin(ry) * 1.0, p.z - Math.cos(ry) * 1.0, ry, ride.kind === 'jet' ? 1.1 : 0.9);
    if ((ride.vk = (ride.vk || 0) + 1) % 2 === 0) wake(p.x + Math.sin(ry) * 0.6, p.z + Math.cos(ry) * 0.6, ry, me.sp);
  }
  if (ride.t <= 10 && !ride.warned) { ride.warned = true; floatText(p.clone(), '⏱️ 10 sn', ''); }
  const homeD = Math.hypot(p.x - ride.home.x, p.z - ride.home.z);
  if (homeD > 4) ride.away = true; // iskeleden bir kez uzaklaştıktan sonra dönünce biter: hiç ayrılmadan bekleyenin binişi 4 sn'de bitmesin
  if (ride.t <= 0 || (ride.away && ride.max - ride.t > 4 && homeD < 2)) endRide(true);
}
function endRide(say) {
  if (!ride.kind) return;
  if (ride.kind === 'parasut') { endGlide(false); return; }
  const k = ride.kind, o = ride.obj, h = L.hut, P = G.player;
  ride.kind = null; ride.obj = null;
  o.position.set(ride.home.x, 0, ride.home.z); o.rotation.set(0, ride.home.ry, 0);
  P.position.set(h.bx, gy(h.bx, h.bz), h.bz); P.rotation.x = 0; seatPose(P, 0); for (const l of P.userData.legs) l.rotation.z = 0;
  if (say) { ring(P.position.clone(), '#56c27e', 1); toast(k === 'jet' ? '🚤 Jetski turu bitti' : '🐬 Yunus turu bitti'); }
}
// inme düğmesi (2026-11-08 kullanıcı: "ayrıca inme tuşu olsun"): jetski ve yunus turunda ekranın altında "⬇️ İn", klavyede F. İnince
// kulübenin önüne dönülür (derin suda bırakılmaz), jetski ya da yunus yerine gider
let inBtn = null, inT = 0;
function dismount() { if (ride.kind === 'jet' || ride.kind === 'yunus') endRide(true); }
function inTick(dt) {
  const on = ride.kind === 'jet' || ride.kind === 'yunus';
  if (!on && !inBtn) return;
  if (!inBtn) {
    const st = document.createElement('style');
    st.textContent = '#adaIn { position: absolute; right: 12px; bottom: 16px; z-index: 7; display: none; pointer-events: auto; padding: 10px 24px; border: none; border-radius: 999px; background: rgba(255,255,255,.94); color: #234; font: 18px var(--font-title); box-shadow: 0 3px 10px rgba(0,0,0,.25); cursor: pointer; } #adaIn.on { display: block; }';
    document.head.appendChild(st);
    inBtn = document.createElement('button'); inBtn.type = 'button'; inBtn.id = 'adaIn';
    inBtn.textContent = matchMedia('(pointer: coarse)').matches ? '⬇️ İn' : '⬇️ İn (F)';
    inBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); dismount(); });
    document.body.appendChild(inBtn);
  }
  inBtn.classList.toggle('on', on);
  if (on && (inT -= dt) <= 0) { // sağ kenarda, keyif barının ya da yardım satırının üstünde (telefonda ortadaki oyuncuyu örtmez)
    inT = 0.3;
    const r = ['keyifBar', 'help'].map((id) => document.getElementById(id)).map((e) => (e && e.offsetParent ? e.getBoundingClientRect() : null)).find((q) => q && q.height);
    inBtn.style.bottom = `${r ? Math.max(16, innerHeight - r.top + 10) : 16}px`;
  }
}
function jetsTick(dt) {
  jets.forEach((j, i) => { if (ride.obj === j) return; const h = L.jets[i]; j.position.set(h.x, -0.05 + Math.sin(G.time * 1.8 + i) * 0.04, h.z); j.rotation.z = Math.sin(G.time * 1.3 + i) * 0.05; });
  for (const d of penD) { // havuzdaki yunuslar: yüzgeç suyun üstünde gider, gittiği yöne bakar, kuyruk çırpar, arkada iz; sıçrayınca damla
    if (ride.obj === d.o) continue;
    d.a += dt * 0.55;
    const x = L.pen.x + Math.cos(d.a) * 2.3, z = L.pen.z + Math.sin(d.a) * 2.3, ry = Math.atan2(-Math.sin(d.a), Math.cos(d.a)), was = d.hop > 0;
    d.hop = d.hop > 0 ? d.hop - dt : Math.random() < dt * 0.08 ? 1 : 0;
    if (!was && d.hop > 0) splash(x, z, 6, 2.2, ry); else if (was && d.hop <= 0) splash(x, z, 10, 2.8, ry);
    d.o.position.set(x, -0.5 + Math.sin(G.time * 2 + d.a) * 0.04 + (d.hop > 0 ? Math.sin((1 - d.hop) * PI) * 1.0 : 0), z);
    d.o.rotation.y = ry; d.o.rotation.x = d.hop > 0 ? -Math.cos((1 - d.hop) * PI) * 0.6 : 0;
    d.o.userData.tail.rotation.x = Math.sin(G.time * 7 + d.a * 2) * 0.28;
    if (d.hop <= 0 && (d.wk = (d.wk || 0) - dt) <= 0) { d.wk = 0.2; trail(x - Math.sin(ry) * 0.7, z - Math.cos(ry) * 0.7, ry, 0.6, 1.6); }
  }
}

// ---------- yamaç paraşütü: zirveden kalkış, kuzey kıyısı ve fenerin açığından doğu kumsalına iniş (~28 sn) ----------
const GL = { wing: null, curve: null, len: 1, u: 0, h: null, bank: 0 };
function makeWing() {
  const g = new THREE.Group(), K = new A.Kit(), cols = ['#ff5a3c', '#ffd34d', '#2fb5a8'].map((c) => M.mat(c, { side: THREE.DoubleSide }));
  for (let i = 0; i < 9; i++) { const a = ((i - 4) / 4) * 0.95; K.add(A.part(BOX(1.05, 0.14, 1.7), Math.sin(a) * 4.2, Math.cos(a) * 4.2 - 4.2, 0, 0, 0, -a), cols[i % 3]); }
  K.build(g);
  const pts = [];
  for (let i = 0; i <= 8; i += 2) { const a = ((i - 4) / 4) * 0.95; pts.push(V(Math.sin(a) * 4.1, Math.cos(a) * 4.2 - 4.28, 0), V(0, -4.4, 0)); }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#333333' })));
  g.traverse((o) => { o.userData.bkNo = true; }); g.visible = false; L.root.add(g);
  return g;
}
function startGlide() {
  standUp();
  const P = A.GLIDE, y0 = gy(P.x, P.z);
  const pts = [[P.x, y0 + 1.3, P.z], [892, y0 + 2.6, -36], [896, y0 + 3.4, -47], [913, y0 + 2.8, -57], [935, y0 + 1.4, -55], [956, y0 - 1.0, -48], [970, 10, -35], [971, 7, -22], [961, 3.5, -14.5], [P.lx, gy(P.lx, P.lz) + 1.25, P.lz]];
  GL.curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => V(x, y, z)), false, 'centripetal'); GL.len = GL.curve.getLength(); GL.u = 0; GL.h = null; GL.bank = 0;
  Object.assign(ride, { kind: 'parasut', t: 0, max: 0, obj: null, home: null, hop: 0, wk: 0, warned: false });
  GL.wing.visible = true;
  toast('🪂 Havalandın! Adanın üstünde süzülüyorsun; iniş doğu kumsalında'); sfx('unlock'); memory('parasut');
}
function glideTick(dt) {
  const P = G.player, p = P.position, u = P.userData;
  GL.u = Math.min(1, GL.u + (dt * 6.5) / GL.len);
  const q = GL.curve.getPointAt(GL.u), tg = GL.curve.getTangentAt(GL.u), h = Math.atan2(tg.x, tg.z);
  if (GL.h == null) GL.h = h;
  const turn = Math.atan2(Math.sin(h - GL.h), Math.cos(h - GL.h)) / Math.max(dt, 1e-3); GL.h = h;
  GL.bank += (Math.max(-0.45, Math.min(0.45, -turn * 0.6)) - GL.bank) * (1 - Math.exp(-3 * dt)); // dönüşte kanat içe yatar
  p.set(q.x, q.y - 1.2, q.z); P.rotation.set(0, h, GL.bank * 0.5);
  GL.wing.position.set(q.x, q.y + 4.5, q.z); GL.wing.rotation.set(0, h, GL.bank);
  seatPose(P, -1.2); u.arms[0].rotation.x = u.arms[1].rotation.x = -2.75; // koşum takımında oturur, kollar frenlerde
  if (GL.u >= 1) endGlide(true);
}
function endGlide(say) {
  ride.kind = null; GL.wing.visible = false;
  const P = G.player, A0 = A.GLIDE;
  P.position.set(A0.lx, gy(A0.lx, A0.lz), A0.lz); P.rotation.set(0, P.rotation.y, 0); seatPose(P, 0);
  if (say) { ring(P.position.clone(), '#56c27e', 1.2); sfx('pop'); relax(25); toast('🪂 Güzel iniş! Balık restoranı hemen kuzeyde'); }
}
// balık restoranının garsonu: mutfakla masalar arasında tepsiyle dolaşır
const WT = { o: null, pts: [], i: 0, wait: 0 };
function waiterTick(dt) {
  const o = WT.o; if (!o || !near(o, 45)) return;
  if (WT.wait > 0) { WT.wait -= dt; M.animateCharacter(o, 0, dt, true); if (WT.wait <= 0) WT.i = (WT.i + 1) % WT.pts.length; return; }
  const [tx, tz] = WT.pts[WT.i], dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz);
  if (d < 0.12) { WT.wait = rand(1.5, 3.5); return; }
  const v = Math.min(d, 1.25 * dt); o.position.x += (dx / d) * v; o.position.z += (dz / d) * v; o.position.y = A.TAVERN.y;
  o.rotation.y = lerpA(o.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
  M.animateCharacter(o, 1.25 / 3, dt, true);
}
// deniz feneri: akşamüstü (saat 16'dan sonra) iki ışık huzmesi denizi tarar
const LB = { g: null, m: [] };
function beamInit() {
  const g = new THREE.Group(); g.position.set(L.light.x, L.light.y, L.light.z);
  for (const s of [1, -1]) {
    const geo = new THREE.ConeGeometry(2.2, 26, 16, 1, true); geo.translate(0, -13, 0); geo.rotateZ(s * (PI / 2 - 0.05));
    const m = new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(geo, m)); LB.m.push(m);
  }
  g.traverse((o) => { o.userData.bkNo = true; }); g.visible = false; L.root.add(g); LB.g = g;
}
function lightTick(dt) {
  const k = Math.max(0, Math.min(1, (day.hour - 16) / 1.5));
  LB.g.visible = k > 0.01; if (!LB.g.visible) return;
  LB.g.rotation.y += dt * 0.9; for (const m of LB.m) m.opacity = 0.22 * k;
}

// ---------- voleybol: 2'ye 2; oyuncu batı yarıya girince ilk oyuncunun yerine geçer, top ona gelince kendisi vurur ----------
const VB = { s: [], ball: null, t: 0, dur: 1, from: V(0, 0, 0), to: V(0, 0, 0), tgt: 1, wait: 1.5, serve: 0, drop: 0, dropTeam: 0, score: [0, 0], human: false, inT: 0, outT: 0, out: null };
const VB_HOME = [[-4.6, -1.6], [-2.6, 1.7], [2.6, -1.7], [4.6, 1.6]];
const vbPos = (i) => (VB.human && i === 0 ? G.player.position : VB.s[i].o.position);
function vbLaunch(i) {
  const j = (VB.s[i].team ? [0, 1] : [2, 3])[Math.random() < 0.5 ? 0 : 1], a = vbPos(i);
  VB.from.set(a.x, a.y + 2.1, a.z);
  if (VB.human && j === 0) { const p = G.player.position; VB.to.set(p.x, p.y + 2.0, p.z); }
  else { const s = VB.s[j]; s.gx = s.hx + rand(-0.9, 0.9); s.gz = s.hz + rand(-0.9, 0.9); VB.to.set(s.gx, gy(s.gx, s.gz) + 2.0, s.gz); }
  VB.tgt = j; VB.t = 0; VB.dur = Math.min(1.7, 0.75 + VB.from.distanceTo(VB.to) / 9);
  if (!(VB.human && i === 0)) VB.s[i].up = 0.35;
}
function vbTick(dt) {
  const c = L.volley, p = G.player.position, [lx, lz] = local(c, p.x, p.z);
  const inside = !ride.kind && lx > -7.2 && lx < -0.3 && Math.abs(lz) < 3.6;
  if (!VB.human) { VB.inT = inside ? VB.inT + dt : 0; if (VB.inT > 0.6) { VB.human = true; VB.outT = 0; floatText(p.clone(), '🏐 Oyuna katıldın!', 'pos'); } }
  else { VB.outT = inside ? 0 : VB.outT + dt; if (VB.outT > 1.2) VB.human = false; }
  const B = VB.ball;
  if (VB.wait > 0) { VB.wait -= dt; if (VB.wait <= 0) vbLaunch(VB.serve === 0 ? (VB.human ? 1 : Math.random() < 0.5 ? 0 : 1) : Math.random() < 0.5 ? 2 : 3); }
  else if (VB.drop > 0) {
    VB.drop -= dt; B.position.y = Math.max(gy(B.position.x, B.position.z) + 0.12, B.position.y - dt * 7);
    if (VB.drop <= 0) { VB.score[VB.dropTeam]++; floatText(V(c.x, c.y + 0.6, c.z), `🏐 ${VB.score[0]} - ${VB.score[1]}`, ''); VB.wait = 1.8; VB.serve = VB.dropTeam; }
  } else {
    VB.t += dt; const k = Math.min(1, VB.t / VB.dur);
    B.position.lerpVectors(VB.from, VB.to, k); B.position.y += Math.sin(k * PI) * 3.2; B.rotation.x += dt * 6;
    if (k >= 1) {
      const j = VB.tgt, hum = VB.human && j === 0;
      if (hum ? Math.hypot(p.x - VB.to.x, p.z - VB.to.z) < 2.6 : Math.random() > 0.1) { if (hum) { me.arms = 0.4; relax(1.5); memory('voleybol'); sfx('pop'); } vbLaunch(j); }
      else { VB.drop = 0.6; VB.dropTeam = VB.s[j].team ? 0 : 1; if (hum) floatText(p.clone(), '😅', ''); }
    }
  }
  for (const s of VB.s) {
    const o = s.o, sideline = VB.human && s.i === 0;
    let gx = s.hx, gz = s.hz;
    if (sideline) [gx, gz] = VB.out; else if (VB.tgt === s.i && VB.wait <= 0 && VB.drop <= 0) { gx = s.gx; gz = s.gz; }
    const dx = gx - o.position.x, dz = gz - o.position.z, d = Math.hypot(dx, dz), v = d > 0.15 ? Math.min(3.2, d * 3) : 0;
    if (v) { o.position.x += (dx / d) * v * dt; o.position.z += (dz / d) * v * dt; }
    o.position.y = gy(o.position.x, o.position.z);
    o.rotation.y = lerpA(o.rotation.y, v > 0.5 ? Math.atan2(dx, dz) : sideline ? Math.atan2(c.x - o.position.x, c.z - o.position.z) : faceX(c, s.team ? -1 : 1), 1 - Math.exp(-8 * dt));
    M.animateCharacter(o, v / 3, dt, false);
    if (s.up > 0) { s.up -= dt; const u = o.userData; u.arms[0].rotation.x = u.arms[1].rotation.x = -2.9; o.position.y += Math.sin((Math.max(0, s.up) / 0.35) * PI) * 0.3; }
  }
}

// ---------- plaj futbolu: 2'ye 2, oyuncu sahaya girince batı takımına katılır; top ayağına gelince sürer, kaleye yakınsa şut çeker ----------
const FB = { s: [], ball: null, holder: -1, hold: 0, t: 0, dur: 1, from: V(0, 0, 0), to: V(0, 0, 0), kind: 'pass', goal: false, recv: -1, wait: 1, kick: 2, score: [0, 0], human: false, inT: 0, outT: 0, out: null };
const FB_HOME = [[-5, -1.5], [-2.2, 1.6], [2.2, -1.6], [5, 1.5]];
const fbPos = (i) => (FB.human && i === 0 ? G.player.position : FB.s[i].o.position);
const fbFace = (i) => (FB.human && i === 0 ? G.player.rotation.y : FB.s[i].o.rotation.y);
function fbKick(i, kind, j) {
  const c = L.foot, a = fbPos(i), f = fbFace(i), team = FB.s[i].team;
  FB.from.set(a.x + Math.sin(f) * 0.45, 0, a.z + Math.cos(f) * 0.45);
  if (kind === 'pass') { const b = fbPos(j); FB.to.set(b.x, 0, b.z); FB.recv = j; }
  else { const human = FB.human && i === 0; FB.goal = Math.random() < (human ? 0.65 : 0.5); const gz = FB.goal ? rand(-1.0, 1.0) : rand(1.6, 2.6) * (Math.random() < 0.5 ? -1 : 1); const [x, z] = c.F.at((team ? -8 : 8) * 1.04, gz); FB.to.set(x, 0, z); }
  FB.kind = kind; FB.holder = -1; FB.t = 0; FB.dur = FB.from.distanceTo(FB.to) / (kind === 'shot' ? 12 : 8) + 0.15;
  if (!(FB.human && i === 0)) FB.s[i].kickT = 0.25;
}
function fbTake(i) { FB.holder = i; FB.hold = FB.human && i === 0 ? 1.4 : rand(0.7, 1.5); if (FB.human && i === 0) { relax(1.5); memory('futbol'); sfx('pop'); } }
function fbTick(dt) {
  const c = L.foot, p = G.player.position, [plx, plz] = local(c, p.x, p.z), B = FB.ball;
  const inside = !ride.kind && Math.abs(plx) < 8 && Math.abs(plz) < 4.2;
  if (!FB.human) { FB.inT = inside ? FB.inT + dt : 0; if (FB.inT > 0.6) { FB.human = true; FB.outT = 0; floatText(p.clone(), '⚽ Takıma katıldın!', 'pos'); if (FB.holder === 0) FB.holder = 1; } }
  else { FB.outT = inside ? 0 : FB.outT + dt; if (FB.outT > 1.2) { FB.human = false; if (FB.holder === 0) FB.holder = 1; } }
  if (FB.wait > 0) { FB.wait -= dt; B.position.set(c.x, c.y + 0.17, c.z); if (FB.wait <= 0) fbTake(FB.human && FB.kick === 0 ? 1 : FB.kick); }
  else if (FB.holder >= 0) {
    const h = FB.holder, hp = fbPos(h), f = fbFace(h), team = FB.s[h].team, [hlx] = local(c, hp.x, hp.z);
    const bx = hp.x + Math.sin(f) * 0.45, bz = hp.z + Math.cos(f) * 0.45;
    B.position.set(bx, gy(bx, bz) + 0.17, bz); B.rotation.x += me.sp * dt * 3;
    FB.hold -= dt;
    if (FB.hold <= 0) {
      const gx = team ? -8 : 8, mate = team ? (h === 2 ? 3 : 2) : h === 0 ? 1 : 0;
      if (Math.abs(gx - hlx) < (FB.human && h === 0 ? 9 : 7) && Math.random() < 0.7) fbKick(h, 'shot');
      else fbKick(h, 'pass', mate);
    } else { // en yakın rakip top kapmaya çalışır; oyuncu da rakibin topunu kapabilir
      for (const s of FB.s) {
        if (s.team === team || (FB.human && s.i === 0)) continue;
        if (Math.hypot(s.o.position.x - bx, s.o.position.z - bz) < 0.8 && Math.random() < dt * (FB.human && h === 0 ? 0.6 : 1.4)) { fbTake(s.i); break; }
      }
      if (FB.human && team === 1 && Math.hypot(p.x - bx, p.z - bz) < 0.9 && Math.random() < dt * 2.5) fbTake(0);
    }
  } else {
    FB.t += dt; const k = Math.min(1, FB.t / FB.dur);
    const x = FB.from.x + (FB.to.x - FB.from.x) * k, z = FB.from.z + (FB.to.z - FB.from.z) * k;
    B.position.set(x, gy(x, z) + 0.17 + Math.abs(Math.sin(k * PI)) * (FB.kind === 'shot' ? 0.7 : 0.25), z); B.rotation.x += dt * 14;
    if (k >= 1) {
      if (FB.kind === 'shot') {
        const scorer = FB.from.distanceTo(V(...L.foot.F.at(8, 0), 0)) > 0 ? null : null; // (okunaklık için aşağıda takım bulunur)
        const [tlx] = local(c, FB.to.x, FB.to.z), team = tlx > 0 ? 0 : 1;
        if (FB.goal) {
          FB.score[team]++; confetti(V(FB.to.x, gy(FB.to.x, FB.to.z) + 0.8, FB.to.z), 30); sfx('happy');
          floatText(V(c.x, c.y + 0.6, c.z), `⚽ GOL! ${FB.score[0]} - ${FB.score[1]}`, 'pos');
          if (FB.human && team === 0 && FB.lastHuman) { relax(8); toast('⚽ Golü sen attın!'); }
          FB.wait = 2; FB.kick = team ? 0 : 2;
        } else { FB.wait = 1.2; FB.kick = team ? 0 : 3; }
        void scorer;
      } else {
        const j = FB.recv;
        if (FB.human && j === 0) { if (Math.hypot(p.x - FB.to.x, p.z - FB.to.z) < 2.2) fbTake(0); else fbTake(1); }
        else fbTake(j);
      }
    }
  }
  FB.lastHuman = FB.human && FB.holder === 0 ? true : FB.holder >= 0 ? false : FB.lastHuman;
  const hold = FB.holder, hTeam = hold >= 0 ? FB.s[hold].team : -1;
  let chaser = -1;
  if (hold >= 0) { let best = 1e9; for (const s of FB.s) if (s.team !== hTeam && !(FB.human && s.i === 0)) { const d = s.o.position.distanceTo(B.position); if (d < best) { best = d; chaser = s.i; } } }
  for (const s of FB.s) {
    const o = s.o, sideline = FB.human && s.i === 0, dir = s.team ? -1 : 1;
    let gx, gz, vmax = 2.6;
    if (sideline) [gx, gz] = FB.out;
    else if (s.i === hold) { [gx, gz] = c.F.at(dir * 6.5, s.hz0 * 0.6); vmax = 2.4; }
    else if (s.i === chaser) { gx = B.position.x; gz = B.position.z; vmax = 3.4; }
    else [gx, gz] = c.F.at(s.lx0 + (hTeam === s.team ? 1.5 : -1.0) * dir, s.hz0);
    const dx = gx - o.position.x, dz = gz - o.position.z, d = Math.hypot(dx, dz), v = d > 0.2 ? Math.min(vmax, d * 2.5) : 0;
    if (v) { o.position.x += (dx / d) * v * dt; o.position.z += (dz / d) * v * dt; }
    o.position.y = gy(o.position.x, o.position.z);
    o.rotation.y = lerpA(o.rotation.y, v > 0.4 ? Math.atan2(dx, dz) : Math.atan2(B.position.x - o.position.x, B.position.z - o.position.z), 1 - Math.exp(-8 * dt));
    M.animateCharacter(o, v / 3, dt, false, v > 2.8);
    if (s.kickT > 0) { s.kickT -= dt; o.userData.legs[0].rotation.x = -0.9; }
  }
}

// ---------- ateş başında gitar: üç kişi çalıp alkışlar, dördüncü kütük oyuncunun ----------
const GT = { seats: [], who: [], flames: [], noteT: 0, smokeT: 0 };
function makeGuitar() {
  const g = new THREE.Group(), wood = M.mat('#c27a3a'), dark = M.mat('#4a2e1c');
  M.sph(0.13, wood, 0, -0.1, 0, g, 10, 8).scale.set(1, 1.15, 0.4);
  M.sph(0.1, wood, 0, 0.08, 0, g, 10, 8).scale.set(1, 1, 0.4);
  M.cyl(0.035, 0.035, 0.012, 10, dark, 0, -0.02, 0.05, g).rotation.x = PI / 2;
  M.rbox(0.05, 0.42, 0.025, 0.01, dark, 0, 0.36, 0, g);
  M.rbox(0.07, 0.1, 0.03, 0.01, dark, 0, 0.6, 0, g);
  return g;
}
function guitarTick(dt) {
  const g = L.guitar, on = near({ position: V(g.x, 0, g.z) }, 40);
  for (const [i, f] of GT.flames.entries()) { const k = 1 + Math.sin(G.time * (9 + i * 3) + i) * 0.15 + Math.sin(G.time * 23 + i) * 0.08; f.scale.set(1, k, 1); f.rotation.y += dt * (1 + i); }
  if (!on) return;
  const b = beatOf('adaGitar'), ph = b * PI;
  GT.who.forEach((o, i) => {
    const u = o.userData, a = u.arms;
    u.head.rotation.z = Math.sin(ph + i) * 0.07;
    if (i === 0) { u.head.rotation.x = 0.18; a[0].rotation.x = -0.8; a[0].rotation.z = 0.35 + Math.sin(b * PI * 4) * 0.08; a[1].rotation.x = -1.05; a[1].rotation.z = 0.55 + Math.sin(b * 1.3) * 0.04; }
    else { const cl = Math.max(0, Math.sin(ph * 2 + i)) * 0.35; a[0].rotation.x = a[1].rotation.x = -1.25; a[0].rotation.z = 0.5 - cl; a[1].rotation.z = -0.5 + cl; o.rotation.z = Math.sin(ph / 2 + i) * 0.05; }
  });
  if ((GT.noteT -= dt) <= 0) { GT.noteT = 1.7; const o = GT.who[0]; floatText(o.position.clone().setY(o.position.y - 0.6), ['🎵', '🎶'][Math.floor(rand(0, 2))], 'pos'); }
  if ((GT.smokeT -= dt) <= 0) { GT.smokeT = 0.7; smoke(V(g.x, g.y + 0.9, g.z), { size: 0.35, grow: 2.2, alpha: 0.28, v: V(0, 0.9, 0) }); }
}

// ---------- DJ kabini: LED ekran, ışıklar ve pist müzikle (calgi.js 'adaDJ') yanıp söner ----------
const DJ = { led: null, heads: [], beams: [], floor: null, dj: null, dancers: [], lastB: -1 };
const hsl = new THREE.Color();
function djTick(dt) {
  const d = L.dj;
  if (!near({ position: V(d.x, 0, d.z) }, 45)) return;
  const b = beatOf('adaDJ'), ph = b * PI, fb = Math.floor(b);
  DJ.led.material.color.setHSL((b / 16) % 1, 0.85, 0.32 + 0.22 * Math.max(0, Math.cos(ph)));
  DJ.heads.forEach((h, k) => h.material.color.setHSL((b / 8 + k * 0.25) % 1, 1, 0.45 + 0.2 * Math.max(0, Math.cos(ph + k))));
  DJ.beams.forEach((m, k) => { m.rotation.z = Math.sin(b * 0.5 + k * 2) * 0.55; m.material.color.copy(DJ.heads[k + 1].material.color); });
  if (fb !== DJ.lastB) { DJ.lastB = fb; for (let i = 0; i < 16; i++) DJ.floor.setColorAt(i, hsl.setHSL(((fb + i * 3) % 7) / 7, 0.9, (i + fb) % 2 ? 0.55 : 0.32)); DJ.floor.instanceColor.needsUpdate = true; }
  { const u = DJ.dj.userData; u.head.rotation.x = 0.15 + Math.sin(ph * 2) * 0.12; u.arms[1].rotation.x = -1.1; u.arms[0].rotation.x = fb % 4 === 3 ? -2.8 : -1.0; }
  for (const D of DJ.dancers) {
    const o = D.o, u = o.userData, a = u.arms;
    M.animateCharacter(o, 0, dt, false);
    o.position.y = D.y;
    if (D.st === 'zipla') { o.position.y += Math.abs(Math.sin(ph)) * 0.25; a[0].rotation.x = a[1].rotation.x = -2.6; }
    else if (D.st === 'el') { a[0].rotation.x = -2.8 + Math.sin(ph) * 0.3; a[1].rotation.x = -0.4; }
    else if (D.st === 'alkis') { const cl = Math.max(0, Math.sin(ph * 2)) * 0.4; a[0].rotation.x = a[1].rotation.x = -1.3; a[0].rotation.z = 0.5 - cl; a[1].rotation.z = -0.5 + cl; o.position.y += Math.abs(Math.sin(ph)) * 0.08; }
    else if (D.st === 'sallan') { o.rotation.z = Math.sin(ph / 2) * 0.12; a[0].rotation.x = -0.6 + Math.sin(ph) * 0.3; a[1].rotation.x = -0.6 - Math.sin(ph) * 0.3; }
    else { o.rotation.y += dt * 1.2; a[0].rotation.x = a[1].rotation.x = -2.2; }
  }
}

// ---------- köpeğiyle frizbi ----------
const DOG = { pet: null, owner: null, disc: null, st: 'wait', t: 1.5, from: V(0, 0, 0), to: V(0, 0, 0), dur: 1.5, side: 1, jump: 0 };
function dogTick(dt) {
  const D = DOG, pet = D.pet, o = pet.o, w = D.owner, f = L.frisbee;
  if (!near(w, 60)) return;
  const tg = [Math.cos(f.ry), -Math.sin(f.ry)]; // kıyı boyu
  const hand = V(w.position.x + Math.sin(w.rotation.y) * 0.3, w.position.y + 1.25, w.position.z + Math.cos(w.rotation.y) * 0.3);
  let goal = null, spd = 0;
  D.t -= dt;
  if (D.st === 'wait') { D.disc.position.copy(hand); goal = [w.position.x + Math.sin(w.rotation.y) * 1.3, w.position.z + Math.cos(w.rotation.y) * 1.3]; if (D.t <= 0) { D.st = 'throw'; D.t = 0.35; } }
  else if (D.st === 'throw') {
    w.userData.arms[0].rotation.x = -1.6 + (0.35 - D.t) * 4; D.disc.position.copy(hand);
    if (D.t <= 0) {
      const L0 = rand(7, 10.5), nx = Math.sin(f.ry), nz = Math.cos(f.ry), off = rand(-1, 1);
      D.from.copy(hand); D.to.set(w.position.x + tg[0] * D.side * L0 + nx * off, 0, w.position.z + tg[1] * D.side * L0 + nz * off); D.to.y = gy(D.to.x, D.to.z) + 0.6;
      D.st = 'fly'; D.t = 0; D.dur = 1.5;
    }
  } else if (D.st === 'fly') {
    D.t += dt * 2; const k = Math.min(1, (D.t / 2) / D.dur);
    D.disc.position.lerpVectors(D.from, D.to, k); D.disc.position.y += Math.sin(k * PI) * 1.4; D.disc.rotation.y += dt * 18;
    goal = [D.to.x, D.to.z]; spd = 7.5;
    const dd = Math.hypot(o.position.x - D.to.x, o.position.z - D.to.z);
    if (k > 0.82 && dd < 1.4 && D.jump <= 0) D.jump = 0.4;
    if (k >= 1) { D.st = 'back'; ring(D.to.clone().setY(gy(D.to.x, D.to.z) + 0.05), '#ffffff', 0.6); }
  } else if (D.st === 'back') {
    const r = o.rotation.y, s = o.scale.x;
    D.disc.position.set(o.position.x + Math.sin(r) * 0.62 * s, o.position.y + 0.42 * s, o.position.z + Math.cos(r) * 0.62 * s);
    goal = [w.position.x + Math.sin(w.rotation.y) * 0.9, w.position.z + Math.cos(w.rotation.y) * 0.9]; spd = 5.5;
    if (Math.hypot(o.position.x - goal[0], o.position.z - goal[1]) < 0.35) { D.st = 'wait'; D.t = rand(1.2, 2); D.side = -D.side; w.rotation.y = Math.atan2(tg[0] * D.side, tg[1] * D.side) * 0.6 + f.ry * 0.4; }
  }
  // köpek
  let mv = 0;
  if (goal) {
    const dx = goal[0] - o.position.x, dz = goal[1] - o.position.z, d = Math.hypot(dx, dz);
    if (d > 0.3) { const v = spd || Math.min(3, d * 2); mv = v; o.position.x += (dx / d) * Math.min(d, v * dt); o.position.z += (dz / d) * Math.min(d, v * dt); o.rotation.y = lerpA(o.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt)); }
    else o.rotation.y = lerpA(o.rotation.y, Math.atan2(w.position.x - o.position.x, w.position.z - o.position.z), 1 - Math.exp(-5 * dt));
  }
  o.position.y = gy(o.position.x, o.position.z);
  if (D.jump > 0) { D.jump -= dt; o.position.y += Math.sin((1 - D.jump / 0.4) * PI) * 0.55; }
  pet.spdNow = mv; pet.pose = mv > 3 ? 'run' : mv > 0.1 ? 'stand' : 'sit';
  posePet(pet, dt);
  M.animateCharacter(w, 0, dt, false);
}

// ---------- kuşlar: tür başına gövde ve iki kanat InstancedMesh ----------
const BM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), WM = BM;
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _e1 = new THREE.Euler(0, 0, 0, 'YXZ'), _v1 = new THREE.Vector3(), _s1 = new THREE.Vector3();
class Flock {
  constructor(n, P) {
    this.P = P; this.list = [];
    P.wing.computeBoundingBox(); // sağ kanat aynalanmaz (ters sarımda karanlık görünüyordu), sola kaydırılmış eşi kullanılır
    this.b = new THREE.InstancedMesh(P.body, BM, n); this.l = new THREE.InstancedMesh(P.wing, WM, n); this.r = new THREE.InstancedMesh(P.wing.clone().translate(-P.wing.boundingBox.max.x, 0, 0), WM, n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      this.b.setColorAt(i, c.set(P.cb(i))); this.l.setColorAt(i, c.set(P.cw(i))); this.r.setColorAt(i, c.set(P.cw(i)));
      this.list.push({ i, x: 0, y: -50, z: 0, yaw: 0, pitch: 0, bank: 0, flap: 0 });
    }
    for (const m of [this.b, this.l, this.r]) { m.frustumCulled = false; m.castShadow = P.cast !== false; m.userData.bkNo = true; m.userData.sd = true; L.root.add(m); }
  }
  show(v) { if (this.b.visible !== v) this.b.visible = this.l.visible = this.r.visible = v; }
  sync() {
    const s = this.P.s || 1, [sx, sy, sz] = this.P.sh;
    for (const B of this.list) {
      _m1.compose(_v1.set(B.x, B.y, B.z), _q1.setFromEuler(_e1.set(B.pitch, B.yaw, B.bank)), _s1.set(s, s, s));
      this.b.setMatrixAt(B.i, _m1);
      _m2.makeRotationZ(B.flap).setPosition(sx, sy, sz); this.l.setMatrixAt(B.i, _m2.premultiply(_m1));
      _m2.makeRotationZ(-B.flap).setPosition(-sx, sy, sz); this.r.setMatrixAt(B.i, _m2.premultiply(_m1));
    }
    this.b.instanceMatrix.needsUpdate = this.l.instanceMatrix.needsUpdate = this.r.instanceMatrix.needsUpdate = true;
  }
}
const P_ = A.part, BALL = A.BALL, BOX = A.BOX, CYL = A.CYL, CONE = A.CONE, MG = A.merge;
const wingG = (w, d) => BOX(w, 0.015, d).translate(w / 2, 0, 0);
const BIRDS = {
  gull: () => ({ body: MG([P_(BALL(0.1, 7, 5), 0, 0, 0, 0, 0, 0, 1, 0.85, 2.3), P_(BALL(0.07, 6, 4), 0, 0.07, 0.21), P_(CONE(0.022, 0.1, 4), 0, 0.06, 0.31, PI / 2)]), wing: wingG(0.62, 0.2), sh: [0.07, 0.03, 0.02], cb: () => '#f4f6f8', cw: () => '#b8c0c8' }),
  parrot: () => ({ body: MG([P_(BALL(0.085, 7, 5), 0, 0, 0, 0, 0, 0, 1, 1.1, 1.6), P_(BALL(0.06, 6, 4), 0, 0.06, 0.13), P_(BOX(0.05, 0.015, 0.26), 0, -0.02, -0.2)]), wing: wingG(0.22, 0.11), sh: [0.06, 0.03, 0], s: 1.2,
    cb: (i) => ['#e8343a', '#2f6fd8', '#3faa3c', '#f2c53a', '#e8343a', '#3faa3c'][i % 6], cw: (i) => ['#2f6fd8', '#f2c53a', '#2f6fd8', '#3d8ad8', '#3faa3c', '#e8343a'][i % 6] }),
  flamingo: () => ({ body: MG([P_(BALL(0.2, 8, 6), 0, 0.95, 0, 0, 0, 0, 0.9, 0.75, 1.5), P_(CYL(0.03, 0.035, 0.5, 6), 0, 1.22, 0.24, -0.35), P_(BALL(0.06, 6, 4), 0, 1.48, 0.33), P_(CONE(0.025, 0.12, 4), 0, 1.44, 0.42, 2.2),
    P_(CYL(0.018, 0.018, 0.9, 5), 0.06, 0.45, -0.02), P_(CYL(0.018, 0.018, 0.9, 5), -0.06, 0.45, -0.02)]), wing: wingG(0.18, 0.24), sh: [0.12, 1.0, -0.02], cb: () => '#f48fb1', cw: () => '#f06292' }),
  pelican: () => ({ body: MG([P_(BALL(0.2, 8, 6), 0, 0, 0, 0, 0, 0, 0.9, 0.85, 1.9), P_(BALL(0.08, 6, 4), 0, 0.14, 0.3), P_(BOX(0.05, 0.04, 0.42), 0, 0.1, 0.55)]), wing: wingG(0.95, 0.3), sh: [0.12, 0.05, 0], cb: () => '#f2f2ee', cw: () => '#cfd4d8' }),
  eagle: () => ({ body: MG([P_(BALL(0.13, 7, 5), 0, 0, 0, 0, 0, 0, 1, 0.9, 2.2), P_(BALL(0.08, 6, 4), 0, 0.05, 0.25), P_(BOX(0.18, 0.02, 0.22), 0, 0, -0.32)]), wing: wingG(1.05, 0.32), sh: [0.08, 0.03, 0.02], s: 1.2, cb: () => '#5a3e28', cw: () => '#4a3220' }),
  sparrow: () => ({ body: MG([P_(BALL(0.05, 6, 4), 0, 0, 0, 0, 0, 0, 1, 0.95, 1.5), P_(BALL(0.035, 6, 4), 0, 0.04, 0.06), P_(BOX(0.03, 0.01, 0.08), 0, 0.01, -0.08)]), wing: wingG(0.09, 0.06), sh: [0.035, 0.02, 0], cb: () => '#8a6a4a', cw: () => '#6a4e34', cast: false }),
  humming: () => ({ body: MG([P_(BALL(0.028, 6, 4), 0, 0, 0, 0, 0, 0, 1, 1, 2.2), P_(CYL(0.004, 0.004, 0.07, 4), 0, 0, 0.09, PI / 2)]), wing: wingG(0.06, 0.025), sh: [0.02, 0.012, 0], s: 1.3, cb: () => '#2fb88a', cw: () => '#9fe0c9', cast: false }),
};
const F = {};
function flap(B, sp, amp = 0.8) { return Math.sin(G.time * sp + B.i * 1.7) * amp; }
function birdsInit() {
  F.gull = new Flock(9, BIRDS.gull()); F.parrot = new Flock(6, BIRDS.parrot()); F.flamingo = new Flock(5, BIRDS.flamingo()); F.pelican = new Flock(3, BIRDS.pelican());
  F.eagle = new Flock(2, BIRDS.eagle()); F.sparrow = new Flock(7, BIRDS.sparrow()); F.humming = new Flock(3, BIRDS.humming());
  F.gull.list.forEach((B, i) => { const p = i < 7 ? A.polar(rand(0.28, 0.72) * PI, rand(1.0, 1.3)) : { x: rand(968, 992), z: rand(4, 18) }; Object.assign(B, { cx: p.x, cz: p.z, r: rand(5, 12), h: rand(7, 12), w: rand(0.22, 0.38) * (i % 2 ? 1 : -1), a: rand(0, 6), ft: rand(0, 6) }); });
  const per = L.perches.length ? L.perches : [{ x: 870, z: 5, y: 5 }];
  F.parrot.list.forEach((B, i) => Object.assign(B, { st: 'perch', t: rand(1, 8), at: per[i % per.length], k: 0 }));
  const spots = [];
  for (let t = 0; t < 400 && spots.length < 40; t++) { const a = rand(0, PI * 2), r = rand(1, 10), x = A.LAKE.x + Math.cos(a) * r, z = A.LAKE.z + Math.sin(a) * r, g = gy(x, z); if (g > -0.5 && g < -0.12) spots.push({ x, z }); }
  F.flamingo.spots = spots.length ? spots : [{ x: A.LAKE.x, z: A.LAKE.z }];
  F.flamingo.list.forEach((B) => { const s = F.flamingo.spots[Math.floor(rand(0, F.flamingo.spots.length))]; Object.assign(B, { x: s.x, z: s.z, to: null, t: rand(0, 4), st: 'idle', yaw: rand(0, 6) }); });
  F.pelican.list.forEach((B, i) => { if (i < 2) { const x = A.JETTY.x0 + 12 + i * 12, z = A.JETTY.z - A.JETTY.w / 2 + 0.2; Object.assign(B, { x, y: A.JETTY.y + 0.55, z, yaw: PI / 2 + i, perch: true }); } else Object.assign(B, { a: rand(0, 6) }); });
  F.eagle.list.forEach((B, i) => Object.assign(B, { r: 11 + i * 5, h: gy(A.SUMMIT.x, A.SUMMIT.z) + 11 + i * 3, w: 0.17 * (i ? 1 : -1), a: rand(0, 6) }));
  F.sparrow.list.forEach((B) => { const a = rand(0, PI * 2), r = rand(2.6, 6); Object.assign(B, { x: A.SQUARE.x + Math.cos(a) * r, z: A.SQUARE.z + Math.sin(a) * r, hop: 0, t: rand(0, 1.5), st: 'ground', fx: 0, fz: 0, fy: 0 }); B.y = gy(B.x, B.z); B.hx = B.x; B.hz = B.z; });
  const fl = L.flowers.length ? L.flowers : [{ x: 870, z: 5, y: 1 }];
  F.humming.list.forEach((B, i) => Object.assign(B, { at: fl[(i * 7) % fl.length], t: rand(0.5, 2), st: 'hover', k: 0 }));
}
function birdsTick(dt) {
  const T = G.time;
  for (const B of F.gull.list) {
    B.a += B.w * dt; B.x = B.cx + Math.cos(B.a) * B.r; B.z = B.cz + Math.sin(B.a) * B.r; B.y = B.h + Math.sin(B.a * 2) * 0.6;
    const sg = Math.sign(B.w); B.yaw = Math.atan2(-Math.sin(B.a) * sg, Math.cos(B.a) * sg); B.bank = 0.3 * sg;
    B.ft -= dt; if (B.ft < -1.2) B.ft = rand(3, 7);
    B.flap = B.ft < 0 ? flap(B, 14, 0.75) : 0.1;
  }
  for (const B of F.parrot.list) {
    if (B.st === 'perch') {
      B.x = B.at.x; B.z = B.at.z; B.y = B.at.y + Math.abs(Math.sin(T * 3 + B.i)) * 0.02; B.pitch = -0.9; B.flap = -1.3; B.yaw += Math.sin(T * 0.7 + B.i) * dt * 0.8;
      if ((B.t -= dt) <= 0) { const opts = L.perches.filter((q) => q !== B.at && Math.hypot(q.x - B.at.x, q.z - B.at.z) < 26); if (opts.length) { B.from = B.at; B.to = opts[Math.floor(rand(0, opts.length))]; B.st = 'fly'; B.k = 0; B.dur = Math.max(1, Math.hypot(B.to.x - B.from.x, B.to.z - B.from.z) / 5); } else B.t = rand(3, 8); }
    } else {
      B.k = Math.min(1, B.k + dt / B.dur); const a = B.from, b = B.to, k = B.k;
      B.x = a.x + (b.x - a.x) * k; B.z = a.z + (b.z - a.z) * k; B.y = a.y + (b.y - a.y) * k + Math.sin(k * PI) * 2.2;
      B.yaw = Math.atan2(b.x - a.x, b.z - a.z); B.pitch = 0; B.flap = flap(B, 24, 0.9);
      if (k >= 1) { B.at = b; B.st = 'perch'; B.t = rand(3, 10); }
    }
  }
  for (const B of F.flamingo.list) {
    if (B.st === 'idle') { B.pitch = Math.sin(T * 0.8 + B.i) > 0.6 ? 0.3 : 0; B.flap = 0.15; if ((B.t -= dt) <= 0) { B.to = F.flamingo.spots[Math.floor(rand(0, F.flamingo.spots.length))]; B.st = 'walk'; } }
    else { const dx = B.to.x - B.x, dz = B.to.z - B.z, d = Math.hypot(dx, dz); if (d < 0.2) { B.st = 'idle'; B.t = rand(3, 8); } else { B.x += (dx / d) * 0.35 * dt; B.z += (dz / d) * 0.35 * dt; B.yaw = lerpA(B.yaw, Math.atan2(dx, dz), 1 - Math.exp(-3 * dt)); } B.pitch = 0.05; }
    B.y = gy(B.x, B.z) + (B.st === 'walk' ? Math.abs(Math.sin(T * 3 + B.i)) * 0.02 : 0);
  }
  for (const B of F.pelican.list) {
    if (B.perch) { B.flap = -1.2; B.pitch = Math.sin(T * 0.5 + B.i) * 0.05; continue; }
    B.a += dt * 0.1; const p = A.polar(B.a, 1.16), q = A.polar(B.a + 0.01, 1.16);
    B.x = p.x; B.z = p.z; B.y = 2.4 + Math.sin(B.a * 3) * 0.6; B.yaw = Math.atan2(q.x - p.x, q.z - p.z); B.bank = -0.12; B.flap = Math.sin(T * 0.4) > 0.8 ? flap(B, 9, 0.6) : 0.05;
  }
  for (const B of F.eagle.list) {
    B.a += B.w * dt; B.x = A.SUMMIT.x + Math.cos(B.a) * B.r; B.z = A.SUMMIT.z + Math.sin(B.a) * B.r; B.y = B.h + Math.sin(B.a) * 0.8;
    const sg = Math.sign(B.w); B.yaw = Math.atan2(-Math.sin(B.a) * sg, Math.cos(B.a) * sg); B.bank = 0.25 * sg; B.flap = Math.sin(T * 0.3 + B.i * 2) > 0.92 ? flap(B, 7, 0.5) : 0.06;
  }
  const p = G.player.position;
  for (const B of F.sparrow.list) {
    if (B.st === 'ground') {
      if (Math.hypot(p.x - B.x, p.z - B.z) < 3.2) { const h = L.houses[Math.floor(rand(0, L.houses.length))]; B.st = 'up'; B.k = 0; B.sx = B.x; B.sy = B.y; B.sz = B.z; B.fx = h.rx + rand(-h.rw, h.rw); B.fz = h.rz + rand(-h.rw, h.rw); B.fy = h.roofY; B.yaw = Math.atan2(B.fx - B.x, B.fz - B.z); continue; }
      if (B.hop > 0) { B.hop -= dt; const k = 1 - B.hop / 0.25; B.x = B.ax + (B.bx - B.ax) * k; B.z = B.az + (B.bz - B.az) * k; B.y = gy(B.x, B.z) + Math.sin(k * PI) * 0.12; B.flap = flap(B, 30, 0.6); }
      else { B.y = gy(B.x, B.z); B.flap = -1.2; B.pitch = Math.sin(T * 6 + B.i) > 0.7 ? 0.5 : 0; if ((B.t -= dt) <= 0) { B.t = rand(0.5, 1.5); const a = rand(0, PI * 2); B.ax = B.x; B.az = B.z; B.bx = B.hx + Math.cos(a) * rand(0, 1.2); B.bz = B.hz + Math.sin(a) * rand(0, 1.2); B.yaw = Math.atan2(B.bx - B.x, B.bz - B.z); B.hop = 0.25; } }
    } else if (B.st === 'up' || B.st === 'down') {
      B.k = Math.min(1, B.k + dt * 0.9); const k = B.k;
      B.x = B.sx + (B.fx - B.sx) * k; B.z = B.sz + (B.fz - B.sz) * k; B.y = B.sy + (B.fy - B.sy) * k + Math.sin(k * PI) * 1.2; B.flap = flap(B, 32, 0.8); B.pitch = 0;
      if (k >= 1) { if (B.st === 'up') { B.st = 'roof'; B.t = rand(6, 10); } else { B.st = 'ground'; B.t = rand(0.5, 1.5); } }
    } else { B.flap = -1.2; if ((B.t -= dt) <= 0 && Math.hypot(p.x - B.hx, p.z - B.hz) > 5) { B.st = 'down'; B.k = 0; B.sx = B.x; B.sy = B.y; B.sz = B.z; B.fx = B.hx; B.fz = B.hz; B.fy = gy(B.hx, B.hz); B.yaw = Math.atan2(B.fx - B.x, B.fz - B.z); } }
  }
  for (const B of F.humming.list) {
    if (B.st === 'hover') {
      B.x = B.at.x + Math.sin(T * 2 + B.i) * 0.08 + 0.35; B.z = B.at.z + Math.cos(T * 1.7 + B.i) * 0.08; B.y = B.at.y + 0.15 + Math.sin(T * 3 + B.i) * 0.05; B.pitch = -0.6; B.yaw = Math.atan2(B.at.x - B.x, B.at.z - B.z); B.flap = flap(B, 70, 0.9);
      if ((B.t -= dt) <= 0) { const o = L.flowers.filter((q) => q !== B.at && Math.hypot(q.x - B.at.x, q.z - B.at.z) < 12); if (o.length) { B.from = { x: B.x, y: B.y, z: B.z }; B.to = o[Math.floor(rand(0, o.length))]; B.st = 'dart'; B.k = 0; B.dur = Math.max(0.4, Math.hypot(B.to.x - B.x, B.to.z - B.z) / 7); } else B.t = rand(1, 2); }
    } else {
      B.k = Math.min(1, B.k + dt / B.dur); const a = B.from, b = B.to, k = B.k;
      B.x = a.x + (b.x + 0.35 - a.x) * k; B.z = a.z + (b.z - a.z) * k; B.y = a.y + (b.y + 0.15 - a.y) * k + Math.sin(k * PI) * 0.6; B.yaw = Math.atan2(b.x - a.x, b.z - a.z); B.pitch = 0; B.flap = flap(B, 70, 0.9);
      if (k >= 1) { B.at = b; B.st = 'hover'; B.t = rand(1.2, 2.5); }
    }
  }
  for (const k in F) F[k].sync();
}

// ---------- yunuslar: ara sıra kıyının açığında sürü halinde yüzer ve sıçrar; gemi yolculuğunda geminin yanında ----------
// 2026-11-08 (kullanıcı: "yunusları geliştir sudaki ve denizden sahile çıkmasınlar. ayrıca suda iz bıraksın su etkisi olsun"): sıçrayışlar
// arasında kaybolmak yerine sırt yüzgeci suyu yararak yüzer, kuyruğunu çırpar, arkasında köpük izi kalır; sıçrarken ve dalarken damla ve
// köpük halkası (iz.js). Rota yalnız derin sudan seçilir (baştan sona her 2 m'de deniz tabanı -1,4 m'den derin), yine de sığa gelen yunus dalıp
// kaybolur; son turda derine dalarak ayrılır
const POD = { list: [], t: 6, on: false, ship: false };
const DEEP = -1.4, CYC = 2.4, AIR = 1.0, JUMPS = 4, SPD = 3.3;
function podStart(base, dir, ship) {
  POD.on = true; POD.ship = ship; POD.t = 0;
  POD.list.forEach((d, i) => { Object.assign(d, { ox: -i * 1.4, oz: (i % 2 ? 1 : -1) * 0.9 * (i ? 1 : 0), ph: i * 0.35, base, dir, up: false, wk: 0 }); d.o.visible = false; });
}
function podRoute(p) { // oyuncunun baktığı kıyının açığında, kıyıya paralel ve baştan sona derin suda kalan bir rota
  const th0 = Math.atan2((p.z - A.IZ) / 50, (p.x - A.IX) / 62), len = SPD * (JUMPS * CYC + 1.2) + 2;
  for (let k = 0; k < 10; k++) {
    const c = A.polar(th0 + rand(-0.12, 0.12) * PI, rand(1.2, 1.42)), dir = c.ry + (Math.random() < 0.5 ? PI / 2 : -PI / 2), sx = Math.sin(dir), sz = Math.cos(dir);
    let ok = true;
    for (let s = -4; s <= len && ok; s += 2) for (const oz of [-1.2, 1.2]) { const x = c.x + sx * s + sz * oz, z = c.z + sz * s - sx * oz; if (gy(x, z) > DEEP || A.edge(x, z) > 2.3) { ok = false; break; } }
    if (ok) return { base: { x: c.x, z: c.z }, dir };
  }
  return null;
}
function podTick(dt) {
  if (!POD.on) {
    if (!voy.on && (POD.t -= dt) <= 0) { // yolculukta sayacı voyTick işletir
      POD.t = rand(10, 18);
      const r = podRoute(G.player.position);
      if (r) podStart(r.base, r.dir, false);
    }
    return;
  }
  POD.t += dt;
  let alive = false;
  for (const d of POD.list) {
    const t = POD.t - d.ph, o = d.o; if (t < 0) { alive = true; continue; }
    const n = Math.floor(t / CYC), k = t % CYC;
    if (n >= JUMPS) { o.visible = false; continue; }
    const s = t * SPD + d.ox, sx = Math.sin(d.dir), sz = Math.cos(d.dir), ship = POD.ship;
    const base = ship ? { x: L.ship.position.x + sx * (2 - d.oz), z: L.ship.position.z + sz * (2 - d.oz) + 7.5 } : d.base; // geminin kameraya bakan yanında
    const x = base.x + sx * s + (ship ? 0 : sz * d.oz), z = base.z + sz * s - (ship ? 0 : sx * d.oz);
    if (!ship && gy(x, z) > DEEP + 0.4) { o.visible = false; continue; } // sığa geldiyse dalıp gider: kıyıya çıkmaz
    alive = true; o.visible = true;
    o.userData.tail.rotation.x = Math.sin(t * 9 + d.ph * 3) * 0.32;
    if (k < AIR) { // sıçrayış
      const u = k / AIR;
      o.position.set(x, -0.55 + Math.sin(u * PI) * 1.75, z); o.rotation.set(-Math.cos(u * PI) * 0.85, d.dir, 0);
      if (!d.up) { d.up = true; splash(x, z, 8, 2.6, d.dir); }
    } else { // sırt yüzgeci suyu yararak yüzer; son turda derine dalar
      const u = (k - AIR) / (CYC - AIR), dive = n === JUMPS - 1 ? u * 1.4 : 0;
      o.position.set(x, -0.62 + Math.sin(u * PI * 2) * 0.05 - dive, z); o.rotation.set(0.12 * Math.sin(u * PI * 2) + dive * 0.25, d.dir, 0);
      if (d.up) { d.up = false; splash(x, z, 12, 3.2, d.dir); }
      if (!dive && (d.wk -= dt) <= 0) { d.wk = 0.11; trail(x - sx * 0.7, z - sz * 0.7, d.dir, 0.8); }
    }
  }
  if (!alive) POD.on = false;
}

// ---------- gemi yolculuğu (tatil.js kararmanın altında başlatır) ----------
const CSS = `#adaCine { position: fixed; inset: 0; z-index: 45; pointer-events: none; }
#adaCine .lb { position: absolute; left: 0; right: 0; height: 9vh; background: #0b0b10; transition: transform .6s cubic-bezier(.2,.8,.2,1); }
#adaCine .lb.t { top: 0; transform: translateY(-100%); } #adaCine .lb.b { bottom: 0; transform: translateY(100%); }
#adaCine.on .lb { transform: none; }
#adaCine .ct { position: absolute; left: 0; right: 0; bottom: 0; height: 9vh; display: flex; align-items: center; justify-content: center; color: #fff; font: clamp(15px, 2.6vh, 22px) var(--font-title); opacity: 0; transition: opacity .5s; white-space: nowrap; }
#adaCine.on .ct { opacity: 1; }
#adaCine .sk { position: absolute; right: 16px; bottom: calc(9vh + 12px); pointer-events: auto; padding: 8px 16px; border-radius: 999px; border: none; background: rgba(255,255,255,.92); color: #234; font: 16px var(--font-title); cursor: pointer; display: none; }
#adaCine.on .sk { display: block; }
body.adacine #hud, body.adacine #banner { opacity: 0 !important; transition: opacity .4s; pointer-events: none !important; }`;
function cineUi() {
  if (voy.ui) return voy.ui;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'adaCine';
  el.innerHTML = '<div class="lb t"></div><div class="lb b"></div><div class="ct"></div><button type="button" class="sk">Geç ⏩</button>';
  document.body.appendChild(el);
  el.querySelector('.sk').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (voy.on && !voy.park) voy.t = voy.T; });
  return (voy.ui = el);
}
function deckPlayer() { // gidişte sancak, dönüşte iskele küpeştesi: ikisinde de kameraya bakan yan
  const S = L.ship, dk = S.userData.deck, sx = voy.go ? 1 : -1;
  S.updateMatrixWorld(true);
  const p = S.localToWorld(V(dk.x * sx, dk.y, dk.z));
  voy.deckY = p.y; G.player.position.copy(p); G.player.rotation.set(0, S.rotation.y + 0.5 * sx, 0);
}
// ---------- gemi yolcuları ----------
// 2026-11-08 (kullanıcı: "crusie gemisinde adaya tek gelmeyelim ... üst kısımda bizimle insanlar olsun"): güneşlenme güvertesinde şezlongda
// yatanlar, havuzda yüzen, kenarda ayaklarını suya sarkıtan, jakuzidekiler, küpeşteden el sallayanlar, baş güvertesinde ufka bakanlar, barda
// barmen. Geminin çocuklarıdır, onunla gider. Varınca el sallayanlar ve bakanlar (walk) bizimle iskeleden iner, kıyıya yürür, görüş dışında
// kalınca gizlenir; dönüş yolculuğunda yine güvertededirler. Yalnız yolculukta ya da gemi yakınken kıpırdarlar
const PAX = [];
function paxBuild() {
  const swimK = { lie: 1, pool: 1, edge: 1, tub: 1 };
  for (const s of L.ship.userData.pax) {
    const look = s.k === 'crew' ? { ...M.touristLook(), shirt: '#ffffff', pants: '#1d2b52', hat: 'cap', hatColor: '#ffffff', shades: false } : M.touristLook();
    const o = M.makeCharacter(look); if (swimK[s.k] && M.setSwimwear) M.setSwimwear(o, true); o.rotation.order = 'YXZ';
    PAX.push({ s, o, ph: rand(0, 20), side: PAX.length % 2, w: null });
  }
  paxReset();
}
function paxReset() { // herkes gemideki yerine ve duruşuna
  for (const p of PAX) {
    const { s, o } = p, u = o.userData;
    L.ship.add(o); o.visible = true; p.w = null;
    o.position.set(s.x, s.y, s.z); o.rotation.set(0, s.ry, 0);
    for (const l of u.legs) l.rotation.set(0, 0, 0);
    for (const a of u.arms) a.rotation.set(0, 0, 0);
    if (s.k === 'lie') { o.position.set(s.x + Math.sin(s.ry) * 0.85, s.y + 0.5, s.z + Math.cos(s.ry) * 0.85); o.rotation.x = -1.25; }
    else if (s.k === 'pool') o.position.y = s.y - 0.72; // bacakları havuz suyunun altında
    else if (s.k === 'edge') { o.position.y = s.y - 0.54; seatPose(o, -0.55); }
    else if (s.k === 'tub') { o.position.y = s.y - 0.44; seatPose(o, -1.45); }
  }
}
function paxLand() { // varış: yürüyenler oyuncunun arkasından iskeleye iner
  let i = 0;
  for (const p of PAX) {
    if (!p.s.walk) continue;
    const o = p.o; L.root.add(o);
    o.position.set(G.player.position.x + 1.8 + i * 1.1, A.JETTY.y, A.JETTY.z + (i % 2 ? 0.55 : -0.55)); o.rotation.set(0, -PI / 2, 0);
    for (const a of o.userData.arms) a.rotation.set(0, 0, 0);
    p.w = { v: 1.32 - i * 0.03, wait: 0.4 + i * 0.3, t: 0 }; i++;
  }
}
function paxTick(dt) {
  if (!PAX.length) return;
  const act = voy.on || near(L.ship, 45), P = G.player.position;
  for (const p of PAX) {
    const o = p.o, s = p.s, u = o.userData, a = u.arms, t = G.time + p.ph;
    if (p.w) { // iskeleden kıyıya; oyuncu önündeyse yanından geçer
      const w = p.w, q = o.position, x0 = A.JETTY.x0;
      w.t += dt;
      if ((w.wait -= dt) > 0) { M.animateCharacter(o, 0, dt, false); continue; }
      if (q.x > x0 - 5) {
        const dz = q.z - P.z, block = P.x < q.x && q.x - P.x < 1.4 && Math.abs(dz) < 0.75;
        if (block && q.x > x0) q.z = Math.max(A.JETTY.z - 0.95, Math.min(A.JETTY.z + 0.95, q.z + (dz >= 0 ? 1 : -1) * dt * 1.2));
        q.x -= w.v * dt * (block ? 0.3 : 1);
        q.y = q.x > x0 ? A.JETTY.y : Math.max(gy(q.x, q.z), 0);
        M.animateCharacter(o, block ? 0.15 : 0.5, dt, false);
      } else M.animateCharacter(o, 0, dt, false);
      if ((q.x < x0 && offscreen(q)) || w.t > 45) { o.visible = false; p.w = null; }
      continue;
    }
    if (!act || o.parent !== L.ship) continue;
    switch (s.k) {
      case 'lie': { M.breathe(o, t, 0.35); const e = Math.max(0, Math.sin(t * 0.23)) ** 3; a[p.side].rotation.x = -0.1 - e * 2.7; break; }
      case 'pool': { o.position.z = s.z + Math.sin(t * 0.35) * 1.4; o.position.y = s.y - 0.72 + Math.sin(t * 2.2) * 0.03; o.rotation.y = Math.cos(t * 0.35) >= 0 ? 0 : PI; a[0].rotation.x = -1.3 + Math.sin(t * 3) * 0.5; a[1].rotation.x = -1.3 - Math.sin(t * 3) * 0.5; break; }
      case 'edge': M.breathe(o, t, 0.5); u.legs[0].rotation.x = -0.55 + Math.sin(t * 2.6) * 0.3; u.legs[1].rotation.x = -0.55 - Math.sin(t * 2.6) * 0.3; a[0].rotation.x = a[1].rotation.x = 0.35; break;
      case 'tub': M.breathe(o, t, 0.6); a[0].rotation.x = a[1].rotation.x = -0.35; break;
      case 'wave': { M.breathe(o, t, 0.5); const on = Math.sin(t * 0.45) > -0.2; a[0].rotation.x = on ? -2.75 : -0.12; a[0].rotation.z = on ? Math.sin(t * 7) * 0.35 : 0; break; }
      case 'look': M.breathe(o, t, 0.7); if (s.point) a[1].rotation.x = Math.sin(t * 0.3) > 0.55 ? -1.5 : -0.1; break;
      default: M.breathe(o, t, 0.5); a[0].rotation.x = a[1].rotation.x = -0.55; // barmen: elleri tezgâhta
    }
  }
}
export function voyage(go, done) {
  cineUi(); endRide(false); standUp();
  if (me.swim) { me.swim = false; G.player.rotation.x = 0; }
  const d = A.SHIP_DOCK;
  Object.assign(voy, { on: true, park: false, go, t: 0, T: go ? 10 : 12, done, x0: go ? d.x + 70 : d.x, x1: go ? d.x : d.x + 70, wk: 0 });
  L.ship.position.set(voy.x0, 0, d.z); L.ship.rotation.set(0, -PI / 2, 0);
  paxReset();
  if (go) { fun.clear(); me.summitDone = false; }
  G.cine = true; G.camSnap = true; document.body.classList.add('adacine');
  voy.ui.querySelector('.ct').textContent = go ? '🚢 Martı Adası\'na gidiyoruz…' : '🚢 Köye dönüyoruz…';
  voy.ui.classList.add('on');
  deckPlayer();
  POD.on = false; for (const d of POD.list) d.o.visible = false; // adanın açığındaki sürü yolculukta kalmaz
  POD.t = go ? 1.5 : 7.6; // dönüşte yunuslar gemi döndükten sonra
}
function voyTick(dt) {
  if (voy.park) { deckPlayer(); return; }
  voy.t = Math.min(voy.T, voy.t + dt);
  const k = voy.t / voy.T, S = L.ship, d = A.SHIP_DOCK, px = S.position.x, pz = S.position.z;
  if (voy.go) { const e = 1 - (1 - k) * (1 - k); S.position.set(voy.x0 + (voy.x1 - voy.x0) * e, 0, d.z); S.rotation.y = -PI / 2; }
  else { // 2026-11-08 (kullanıcı: "geri giderken dönsün gemi"): iskeleden güneye açılır, başını güneyden doğuya çevirir, sonra hızlanıp uzaklaşır
    const sm = (a, b) => { const u = Math.min(1, Math.max(0, (k - a) / (b - a))); return u * u * (3 - 2 * u); };
    const off = sm(0, 0.35), turn = sm(0.12, 0.62), g2 = Math.max(0, (k - 0.5) / 0.5);
    S.position.set(d.x + 12 * off + 70 * g2 * g2, 0, d.z - 22 * off); S.rotation.y = -PI / 2 - PI * turn;
  }
  S.position.y = Math.sin(G.time * 0.7) * 0.06; S.rotation.z = Math.sin(G.time * 0.55) * 0.01;
  deckPlayer();
  M.animateCharacter(G.player, 0, dt, false);
  // kıçta köpük izi, baştan iki yana açılan dalga (iz.js)
  const sp = Math.hypot(S.position.x - px, S.position.z - pz) / Math.max(dt, 1e-3), ry = S.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry);
  if (sp > 0.8 && (voy.wk -= dt) <= 0) {
    voy.wk = 0.1; trail(S.position.x - fx * 18.6, S.position.z - fz * 18.6, ry, 3.4, 3.2);
    if ((voy.vk = (voy.vk || 0) + 1) % 3 === 0) wake(S.position.x + fx * 15, S.position.z + fz * 15, ry, sp, 3);
  }
  if (!POD.on && (POD.t -= dt) <= 0 && voy.T - voy.t > 3) { POD.t = 99; podStart(null, S.rotation.y, true); }
  if (voy.t >= voy.T) {
    if (voy.go) {
      voy.on = false; G.cine = false; voy.ui.classList.remove('on'); document.body.classList.remove('adacine');
      const x = A.SHIP_DOCK.x - 9; G.player.position.set(x, A.JETTY.y, A.JETTY.z); G.player.rotation.set(0, -PI / 2, 0); G.camSnap = true;
      toast('🏝️ Martı Adası\'na hoş geldin! Denize gir, şezlongda uzan, voleybol-futbol oyna, tezgâhlardan dondurma al, jetski kirala, dağa tırman');
      paxLand();
    } else voy.park = true; // köye geçişi tatil.js yapar; o zamana dek güvertede kalınır
    const cb = voy.done; voy.done = null; if (cb) cb();
  }
}
function endVoyage() { voy.on = false; voy.park = false; G.cine = false; document.body.classList.remove('adacine'); if (voy.ui) voy.ui.classList.remove('on'); L.ship.position.set(A.SHIP_DOCK.x, 0, A.SHIP_DOCK.z); L.ship.rotation.set(0, -PI / 2, 0); }

// ---------- oyuncu: yüzme, şezlong, ateş başı, dans, zirve, oyun hareketleri ----------
function standUp() {
  const P = G.player; if (!P) return;
  if (me.lie || me.seat || me.dine) { P.rotation.x = 0; seatPose(P, 0); P.position.y = G.isle.h(P.position.x, P.position.z); }
  me.lie = null; me.seat = null; me.dine = null; me.dance = 0;
}
function playerTick(dt) {
  const P = G.player, p = P.position, u = P.userData;
  me.sp = me.lp ? Math.hypot(p.x - me.lp.x, p.z - me.lp.z) / Math.max(dt, 1e-3) : 0; me.lp = { x: p.x, z: p.z };
  me.still = me.sp < 0.3 ? me.still + dt : 0;
  if (ride.kind) { rideTick(dt); return; }
  if (gy(p.x, p.z) < SWIM && !onJetty(p.x, p.z)) {
    if (!me.swim) { me.swim = true; standUp(); ring(V(p.x, -0.1, p.z), '#ffffff', 1.2); sfx('pop'); }
    me.wetT += dt; if (me.wetT > 3) memory('deniz');
    const t = G.time * 4.2;
    P.rotation.x = 1.15; p.y = -0.42 + Math.sin(t * 0.5) * 0.04;
    if (me.sp > 0.3) { u.arms[0].rotation.x = -t; u.arms[1].rotation.x = -t + PI; } else { u.arms[0].rotation.x = -1.4 + Math.sin(t * 0.5) * 0.3; u.arms[1].rotation.x = -1.4 - Math.sin(t * 0.5) * 0.3; }
    u.legs[0].rotation.x = Math.sin(t * 2.4) * 0.35; u.legs[1].rotation.x = -u.legs[0].rotation.x;
    if ((me.splash -= dt) <= 0 && me.sp > 0.5) { me.splash = 0.9; ring(V(p.x + Math.sin(P.rotation.y) * 0.6, -0.12, p.z + Math.cos(P.rotation.y) * 0.6), '#ffffff', 0.6); }
    return;
  }
  if (me.swim) { me.swim = false; me.wetT = 0; P.rotation.x = 0; }
  // şezlong: boş şezlonga gelip durunca uzanır, yürüyünce kalkar
  if (me.lie) {
    if (me.sp > 0.6 || G.inMag > 0.35) standUp();
    else { const l = me.lie; p.set(l.x + Math.sin(l.ry) * 0.85, l.y + 0.5, l.z + Math.cos(l.ry) * 0.85); P.rotation.set(l.k === 'hamak' ? -1.5 : -1.25, l.ry, 0); me.lieT += dt; if (me.lieT > 4) memory(l.k || 'sezlong'); return; } // hamakta düz yatar
  }
  // ateş başındaki boş kütük
  if (me.seat) {
    if (me.sp > 0.6 || G.inMag > 0.35) standUp();
    else {
      const s = me.seat, b = beatOf('adaGitar'), cl = Math.max(0, Math.sin(b * PI * 2)) * 0.35;
      p.set(s.x, s.y + 0.4 - 0.62, s.z); P.rotation.y = s.ry; seatPose(P);
      u.arms[0].rotation.x = u.arms[1].rotation.x = -1.25; u.arms[0].rotation.z = 0.5 - cl; u.arms[1].rotation.z = -0.5 + cl;
      me.seatT += dt; if (me.seatT > 3) memory('gitar');
      return;
    }
  }
  // balık restoranında boş sandalye, kafede minder ya da kanepe: durunca oturur, yürüyünce kalkar
  if (me.dine) {
    if (me.sp > 0.6 || G.inMag > 0.35) standUp();
    else { const s = me.dine; p.set(s.x, s.y + (s.h ?? 0.45) - 0.62, s.z); P.rotation.y = s.ry; seatPose(P, s.leg); u.arms[0].rotation.x = u.arms[1].rotation.x = -0.9; return; }
  }
  if (me.still > 0.8) {
    const dn = L.dineSeats.find((q) => !q.c && Math.hypot(p.x - q.x, p.z - q.z) < 0.7);
    if (dn) { me.dine = dn; floatText(V(dn.x, dn.y + 1, dn.z), dn.ic || '🍽️', 'pos'); return; }
    const l = L.loungers.find((q) => !q.c && Math.hypot(p.x - q.x, p.z - q.z) < 0.95);
    if (l) { me.lie = l; me.lieT = 0; floatText(V(l.x, l.y, l.z), '😎', 'pos'); return; }
    const s = GT.seats[3];
    if (s && Math.hypot(p.x - s.x, p.z - s.z) < 0.8) { me.seat = s; me.seatT = 0; floatText(V(s.x, s.y, s.z), '🎵', 'pos'); return; }
  }
  // DJ pistinde durunca dans eder
  { const [lx, lz] = local(L.dj, p.x, p.z);
    if (lx > -2.1 && lx < 2.1 && lz > 2.0 && lz < 6.2 && me.sp < 0.5 && me.still > 0.6) {
      me.dance += dt; const b = beatOf('adaDJ'), ph = b * PI;
      p.y += Math.abs(Math.sin(ph)) * 0.18; u.arms[0].rotation.x = -2.7 + Math.sin(ph) * 0.3; u.arms[1].rotation.x = Math.floor(b) % 2 ? -2.7 : -0.6;
      if (me.dance > 3) memory('dans');
    } else me.dance = 0; }
  // zirve
  const ds = Math.hypot(p.x - A.SUMMIT.x, p.z - A.SUMMIT.z);
  if (ds < 4.5 && !me.summit) {
    me.summit = true; memory('zirve');
    if (!me.summitDone) { me.summitDone = true; confetti(p.clone().setY(p.y + 1.2), 40); sfx('unlock'); toast('⛰️ Zirvedesin! Adanın tamamı ayağının altında'); }
  } else if (ds > 6) me.summit = false;
  // deniz feneri
  const dl = Math.hypot(p.x - L.light.x, p.z - L.light.z);
  if (dl < 6.5 && !me.fener) { me.fener = true; memory('fener'); if (!me.fenerDone) { me.fenerDone = true; toast('🗼 Deniz feneri! Akşamüstü ışığı denizi tarar'); } } else if (dl > 9) me.fener = false;
  // voleybolda topa vuruş
  if (me.arms > 0) { me.arms -= dt; u.arms[0].rotation.x = u.arms[1].rotation.x = -2.9; p.y += Math.sin((Math.max(0, me.arms) / 0.4) * PI) * 0.35; }
}

// ---------- kurulum ----------
export function buildIsle(scene) {
  if (L) return;
  L = A.buildLand(scene);
  // tatilciler
  // yürüyenler kurulurken yerine konur: yalnız oyuncu adadayken yürüdükleri için eskiden ilk adaya çıkışa kadar dünyanın ortasında
  // (0, 0), köy bakkalının içinde üst üste duruyorlardı (2026-11-05 kullanıcı: "köy bakkalının önünde sabit bir beden duruyor")
  for (let i = 0; i < 4; i++) { const w = { o: person(M.touristLook(), i % 2 === 0), th: rand(0.3, 0.7) * PI, dir: i % 2 ? 1 : -1, v: rand(1.2, 1.5), e: rand(0.965, 0.985), pause: 0, next: rand(8, 20) }, p = A.polar(w.th, w.e); place(w.o, p.x, p.z); walkers.push(w); }
  for (let i = 0; i < 2; i++) { const h = { o: person(M.touristLook()), s: i ? RLEN[RLEN.length - 1] * 0.55 : 0, dir: 1, v: rand(1.0, 1.15), pause: i ? 0 : 3 }, [x, z] = routeAt(h.s); place(h.o, x, z); hikers.push(h); }
  for (const i of [0, 3, 6, 9, 13]) {
    const l = L.loungers[i], o = person(M.touristLook(), true);
    l.c = o; o.position.set(l.x + Math.sin(l.ry) * 0.85, l.y + 0.5, l.z + Math.cos(l.ry) * 0.85); o.rotation.set(-1.25, l.ry, 0); liers.push({ o, ph: rand(0, 20), side: i % 2 });
  }
  for (let i = 0; i < 5; i++) { const o = person(M.touristLook(), true), s = swimSpot(); o.position.set(s.x, -0.42, s.z); swimmers.push({ o, back: i === 2, ph: rand(0, 6), spl: rand(0, 2), to: null }); }
  for (let i = 0; i < 2; i++) {
    const c = A.polar((0.45 + i * 0.12) * PI, 1.15), rg = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.15, 8, 16), new THREE.MeshStandardMaterial({ color: i ? '#f6c343' : '#f48fb1', roughness: 0.4 }));
    rg.rotation.x = PI / 2; rg.userData.bkNo = true; L.root.add(rg);
    const o = person(M.touristLook(), true); seatPose(o);
    const f = { o, ring: rg, cx: c.x, cz: c.z, a: rand(0, 6), w: rand(0.08, 0.14) * (i ? 1 : -1), ph: rand(0, 6) }, x = f.cx + Math.cos(f.a) * 2.2, z = f.cz + Math.sin(f.a) * 1.6;
    rg.position.set(x, -0.02, z); o.position.set(x, -0.57, z); floaters.push(f); // simitliler de yerinde başlar (yürüyenler gibi köy bakkalında kalmasın)
  }
  // tezgâhlar, satıcılar ve su sporları
  const BUY = { dondurma: ['🍦 Dondurma', 1], misir: ['🌽 Mısır', 1], gazoz: ['🥤 Gazoz', 1] };
  L.vendors = [];
  for (const s of L.stands) {
    const o = person(M.villagerLook()); place(o, s.vx, s.vz, s.ry); L.vendors.push(o);
    new Pay(s.px, s.pz, { label: BUY[s.k][0], k: BUY[s.k][1], buy: () => treat(s.k) });
  }
  { const h = L.hut, o = person(M.touristLook()); place(o, h.mx, h.mz, h.ry); L.vendors.push(o);
    new Pay(h.jx, h.jz, { label: '🚤 Jetski', k: 4, buy: () => startRide('jet') });
    new Pay(h.dx, h.dz, { label: '🐬 Yunus turu', k: 5, buy: () => startRide('yunus') }); }
  jets = L.jets.map((p, i) => { const j = A.makeJetski(i ? '#f6c343' : '#e8473c'); j.position.set(p.x, 0, p.z); j.rotation.y = p.ry; L.root.add(j); return j; });
  { const K = new A.Kit(), ball = M.mat('#f6c343'), post = M.mat('#7a4f2b'), P0 = L.pen; // yunus havuzu: şamandıra halkası
    for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2; K.add(A.part(BALL(0.2, 7, 5), P0.x + Math.cos(a) * 3.6, -0.05, P0.z + Math.sin(a) * 3.6), ball); if (i % 4 === 0) K.add(A.part(CYL(0.08, 0.08, 1.6, 6), P0.x + Math.cos(a) * 3.6, -0.3, P0.z + Math.sin(a) * 3.6), post); }
    K.build(L.root); }
  penD = [0, 1].map((i) => { const o = A.makeDolphin(); o.position.set(L.pen.x + Math.cos(i * PI) * 2.3, -0.5, L.pen.z + Math.sin(i * PI) * 2.3); L.root.add(o); return { o, a: i * PI, hop: 0 }; }); // ada ziyaretinden önce de havuzda: konumsuz yunus dünyanın ortasında, bakkalın önündeki yolda "balık" gibi yatıyordu (2026-11-10)
  POD.list = [0, 1, 2].map(() => { const o = A.makeDolphin(); o.visible = false; L.root.add(o); return { o }; });
  paxBuild();
  addEventListener('keydown', (e) => { if (e.code === 'KeyF' && !e.repeat && onIsle() && !/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) dismount(); });
  // voleybol ve futbol
  { const c = L.volley;
    VB.s = VB_HOME.map(([lx, lz], i) => { const o = person(M.touristLook(), true), [x, z] = c.F.at(lx, lz); place(o, x, z, faceX(c, i < 2 ? 1 : -1)); return { o, i, team: i < 2 ? 0 : 1, hx: x, hz: z, gx: x, gz: z, up: 0 }; });
    VB.ball = ballMesh('#f7f1d8', 0.12); VB.out = c.F.at(-5.2, -5.4); VB.ball.position.set(VB.out[0], gy(VB.out[0], VB.out[1]) + 0.12, VB.out[1]); } // ada ziyaretinden önce de yerinde (konumsuz top bakkalın önündeydi, 2026-11-10)
  { const c = L.foot;
    FB.s = FB_HOME.map(([lx, lz], i) => { const o = person(M.touristLook(), true), [x, z] = c.F.at(lx, lz); place(o, x, z, faceX(c, i < 2 ? 1 : -1)); return { o, i, team: i < 2 ? 0 : 1, lx0: lx, hz0: lz, kickT: 0 }; });
    FB.ball = ballMesh('#ffffff', 0.17); FB.out = c.F.at(-6, -5.6); FB.ball.position.set(FB.out[0], gy(FB.out[0], FB.out[1]) + 0.17, FB.out[1]); }
  // ateş başı: dört kütük, üçünde gitarcılar
  { const g = L.guitar;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * PI * 2 + PI / 4, [x, z] = g.F.at(Math.cos(a) * 1.85, Math.sin(a) * 1.85); GT.seats.push({ x, z, y: gy(x, z), ry: Math.atan2(g.x - x, g.z - z) }); }
    for (let k = 0; k < 3; k++) { const s = GT.seats[k], o = person(M.touristLook(), k !== 0); o.position.set(s.x, s.y + 0.4 - 0.62, s.z); o.rotation.y = s.ry; seatPose(o); GT.who.push(o); }
    const gt = makeGuitar(); gt.position.set(0.04, 0.88, 0.27); gt.rotation.z = -1.22; gt.rotation.y = 0.15; GT.who[0].add(gt);
    [['#ff8a1e', 0.32, 0.75], ['#ffd23f', 0.2, 0.55], ['#ff5a1e', 0.26, 0.65]].forEach(([c, r, h], i) => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false }));
      f.geometry.translate(0, h / 2, 0); f.position.set(g.x + (i - 1) * 0.08, g.y + 0.12, g.z + (i % 2) * 0.06); f.userData.bkNo = true; L.root.add(f); GT.flames.push(f);
    });
    const src = calgiSrc('adaGitar'); if (src) { src.x = g.x; src.z = g.z; } }
  // DJ: kabinde DJ, LED ekran, ışıklar, pist ve dansçılar
  { const d = L.dj, Fd = d.F, put = (m, lx, ly, lz) => { const [x, z] = Fd.at(lx, lz); m.position.set(x, d.y + ly, z); m.rotation.y = d.ry; m.userData.bkNo = true; L.root.add(m); return m; };
    DJ.led = put(new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.9, 0.1), new THREE.MeshBasicMaterial({ color: '#ff3fa4' })), 0, 2.45, -1.45);
    for (let k = 0; k < 4; k++) DJ.heads.push(put(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), new THREE.MeshBasicMaterial({ color: '#ffffff' })), -1.8 + k * 1.2, 3.62, -1.3));
    for (let k = 0; k < 3; k++) {
      const g = new THREE.ConeGeometry(0.9, 4.2, 12, 1, true); g.translate(0, -2.1, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      const b = put(new THREE.Group(), -1.2 + k * 1.2, 3.55, -1.1); b.add(m); b.rotation.x = -0.55; DJ.beams.push({ get rotation() { return m.rotation; }, material: m.material });
    }
    const fl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.06, 0.95), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 16), mm = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), d.ry);
    for (let i = 0; i < 16; i++) { const [x, z] = Fd.at(-1.5 + (i % 4), 2.6 + Math.floor(i / 4)); fl.setMatrixAt(i, mm.compose(V(x, gy(x, z) + 0.03, z), q, V(1, 1, 1))); fl.setColorAt(i, hsl.setHSL(i / 16, 0.9, 0.5)); }
    fl.receiveShadow = true; fl.userData.bkNo = true; fl.userData.sd = true; L.root.add(fl); DJ.floor = fl;
    DJ.dj = person(M.townLook()); { const [x, z] = Fd.at(0, -0.2); DJ.dj.position.set(x, d.y + 0.5, z); DJ.dj.rotation.y = d.ry; }
    [[-1.1, 3.0, 'zipla'], [0.2, 3.3, 'el'], [1.2, 3.1, 'alkis'], [-0.5, 4.6, 'sallan'], [0.9, 4.9, 'don']].forEach(([lx, lz, st]) => {
      const o = person(M.touristLook(), Math.random() < 0.6), [x, z] = Fd.at(lx, lz); place(o, x, z, d.ry + PI); DJ.dancers.push({ o, st, y: o.position.y });
    });
    const src = calgiSrc('adaDJ'); if (src) { src.x = d.x; src.z = d.z; } }
  // köpeğiyle frizbi
  { const f = L.frisbee, w = person(M.touristLook(), true); place(w, f.x, f.z, f.ry + PI / 2); DOG.owner = w;
    const dog = makePetDog({ fur: '#c98a4a', dark: '#8a5a2a', belly: '#f2dcb8' }); L.root.add(dog); place(dog, f.x + Math.sin(f.ry) * 1.2, f.z + Math.cos(f.ry) * 1.2);
    DOG.pet = { o: dog, pose: 'sit', cur: { drop: 1, pitch: 0, head: 0, tailUp: 0.3, curl: 0, eyes: 1, front: 0 }, spdNow: 0, look: 0, ph: rand(0, 6), happy: true };
    DOG.disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 14), new THREE.MeshStandardMaterial({ color: '#e8343a', roughness: 0.5 })); DOG.disc.castShadow = true; DOG.disc.userData.bkNo = true; DOG.disc.position.set(dog.position.x + 0.5, dog.position.y + 0.02, dog.position.z); L.root.add(DOG.disc); }
  // köy meydanı: tavla oynayanlar, bankta oturan, kapı önünü süpüren
  L.locals = [];
  { const t = L.tavla[0];
    for (const sz of [-1, 1]) { const o = person(M.villagerLook()); o.position.set(t.x, t.y + 0.545 - 0.62, t.z + sz * 0.78); o.rotation.y = sz > 0 ? PI : 0; seatPose(o, -1.2); L.locals.push({ o, kind: 'tavla', ph: rand(0, 6) }); }
    const b = L.benches[0], o = person(M.villagerLook()); o.position.set(b.x, b.y + 0.48 - 0.62, b.z); o.rotation.y = b.ry; seatPose(o); L.locals.push({ o, kind: 'bank', ph: 0 });
    const h = L.houses[3], sw = person(M.villagerLook()); place(sw, h.door[0], h.door[1], h.ry + PI); sw.position.y = Math.max(sw.position.y, h.doorY); // veranda sekisinin üstünde
    const wood = M.mat('#9a6a3e'); const st = M.cyl(0.02, 0.02, 1.3, 6, wood, 0.22, 0.6, 0.35, sw); st.rotation.x = 0.55; M.rbox(0.3, 0.12, 0.08, 0.02, M.mat('#c9a04a'), 0.22, 0.05, 0.72, sw);
    L.locals.push({ o: sw, kind: 'supur', ph: 0 }); }
  // balık restoranı: yemek yiyen tatilciler, tezgâhta aşçı, tepsili garson, ızgara balık ödeme alanı (2026-11-04)
  { const T = L.tavern, y = A.TAVERN.y;
    for (const i of T.busy) { const s = T.seats[i], o = person(M.touristLook()); o.position.set(s.x, y + 0.45 - 0.62, s.z); o.rotation.y = s.ry; seatPose(o); s.c = o; L.locals.push({ o, kind: 'yemek', ph: rand(0, 6) }); }
    const ck = person(M.villagerLook()); ck.position.set(T.cook.x, y, T.cook.z); L.vendors.push(ck);
    WT.o = person(M.villagerLook()); WT.pts = T.waiter; WT.o.position.set(T.waiter[0][0], y, T.waiter[0][1]);
    const tray = new THREE.Group(); M.cyl(0.24, 0.24, 0.025, 12, M.mat('#c0c4c8', { rough: 0.3 }), 0, 0, 0, tray); M.cyl(0.13, 0.11, 0.02, 10, M.mat('#f7f7f2'), 0, 0.025, 0, tray);
    tray.position.set(0, 1.12, 0.42); WT.o.add(tray);
    new Pay(T.pay.x, T.pay.z, { label: '🐟 Izgara balık', k: 2, y, buy: () => treat('izgara') }); }
  // salaş kafeler (2026-11-04): minderde ve kanepede oturup içenler, tezgâhta barmen, ödeme alanı; hamak boş kalır (oyuncu uzanabilir)
  for (const C of L.cafes) {
    for (const i of C.busy) { const s = C.seats[i], o = person(M.touristLook(), Math.random() < 0.4); o.position.set(s.x, s.y + s.h - 0.62, s.z); o.rotation.y = s.ry; seatPose(o, s.leg); s.c = o; L.locals.push({ o, kind: 'kafe', ph: rand(0, 6) }); }
    const b = person(M.townLook()); b.position.set(C.bar.x, C.bar.y, C.bar.z); b.rotation.y = C.ry; L.vendors.push(b);
    if (C.hammock) L.loungers.push(C.hammock);
    new Pay(C.pay.x, C.pay.z, { label: C.buy[0], k: 1, buy: () => treat(C.buy[1]) });
  }
  L.dineSeats = L.tavern.seats.concat(...L.cafes.map((C) => C.seats));
  GL.wing = makeWing();
  new Pay(A.GLIDE.x, A.GLIDE.z, { label: '🪂 Yamaç paraşütü', k: 6, buy: () => startGlide() });
  beamInit();
  birdsInit();
  window.__ada = { L, VB, FB, DOG, me, ride, voy, F, POD, fun, GL, startGlide, startRide, podRoute, penD }; // test kancası
}
function localsTick(dt) {
  for (const n of L.locals) {
    if (!near(n.o, 40)) continue;
    const u = n.o.userData, t = G.time + n.ph;
    if (n.kind === 'tavla') { u.arms[0].rotation.x = -1.1 + (Math.sin(t * 0.9) > 0.85 ? Math.sin(t * 9) * 0.25 : 0); u.arms[1].rotation.x = -0.9; u.head.rotation.x = 0.35; }
    else if (n.kind === 'bank') { u.head.rotation.y = Math.sin(t * 0.3) * 0.5; }
    else if (n.kind === 'kafe') { const e = Math.max(0, Math.sin(t * 0.55)) ** 4; u.arms[0].rotation.x = -0.7 - e * 1.5; u.arms[1].rotation.x = -0.6; u.head.rotation.y = Math.sin(t * 0.3) * 0.45; u.head.rotation.x = -e * 0.2; } // ara sıra yudumlar, sohbet eder
    else if (n.kind === 'yemek') { const e = Math.max(0, Math.sin(t * 1.1)); u.arms[0].rotation.x = -0.9 - e; u.arms[1].rotation.x = -0.75; u.head.rotation.x = 0.2 - e * 0.15; }
    else { u.arms[0].rotation.x = u.arms[1].rotation.x = -0.7 + Math.sin(t * 3) * 0.25; n.o.rotation.z = Math.sin(t * 3) * 0.05; }
  }
  for (const o of L.vendors) {
    if (!near(o, 30)) continue;
    M.animateCharacter(o, 0, dt, false);
    if (Math.hypot(G.player.position.x - o.position.x, G.player.position.z - o.position.z) < 3.4) o.userData.arms[0].rotation.x = -2.6 + Math.sin(G.time * 8) * 0.25; // el sallar
  }
}

// ---------- her kare (tatil.js) ----------
export function updateIsle(dt) {
  if (!L) return;
  const on = onIsle();
  G.camK = (G.camK || 1) + ((on && voy.on ? 1.9 : on && ride.kind === 'parasut' ? 1.6 : on && me.summit ? 1.3 : 1) - (G.camK || 1)) * (1 - Math.exp(-2 * dt)); // main.js uzaklık çarpanı
  for (const k in F) F[k].show(on);
  if (!on) { clearIz(); if (voy.on) endVoyage(); return; }
  frameN++;
  A.SEA_U.uTime.value += dt;
  L.sails.rotation.z -= dt * 0.7;
  if (voy.on) voyTick(dt); else playerTick(dt);
  walkersTick(dt); hikersTick(dt); swimTick(dt); jetsTick(dt); vbTick(dt); fbTick(dt);
  guitarTick(dt); djTick(dt); dogTick(dt); localsTick(dt); treatsTick(dt); podTick(dt); birdsTick(dt); waiterTick(dt); lightTick(dt); paxTick(dt); inTick(dt); updateIz(dt);
}
