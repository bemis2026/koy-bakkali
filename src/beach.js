// Plajı canlandırır. Yüzme alanını şamandıra ipi çevirir; içinde şişme yataklar, simitler (biri flamingo) ve top süzülür.
// Yüzücüler arada bunlarla oyalanır: yatağa çıkıp sırtüstü güneşlenir, simide girip süzülür, ikişer ikişer top atışır.
// Yüzme alanının dış kenarında deniz bisikleti, ipin ötesinde jet ski dolaşır (kamera kıyıdan ancak birkaç metre açığı görür); kumda iki kişi matkot oynar, bir çocuk kum kalesi yapar. Hepsi süs:
// engel ve para yok. world.js sahil: initBeach(instant) açılışta, updateBeach(dt) R.update'te, seaPlay(c, dt) 'swim' durumunda.
import * as THREE from 'three';
import * as M from './models.js';
import { G, Station, rand, lerpAngle, popIn, floatText, mult, sfx } from './game.js';
import { coastZ } from './nature.js';
import { ring } from './fx.js';
import { esya } from './esya.js';
import { havaIslak } from './hava.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const X0 = -11, X1 = 48;           // yüzme alanı (world.js goSwim: x -12..49, kıyıdan 1,7–5,2 m)
const NEAR = 2.0, FAR = 4.6;       // oyuncaklar bu kuşakta süzülür
const WATER = -0.22;               // deniz yüzeyi (world.js buildSea -0.25, dalgayla)
const toys = [];                   // { kind: 'bed' | 'ring' | 'ball', obj, x, z, a, to, user, ph }
let built = false, boats = [], sand = [];

// ---------- modeller ----------
function makeBed(col) {
  const g = new THREE.Group(), c = M.mat(col), w = M.mat('#ffffff');
  M.rbox(0.86, 0.16, 1.95, 0.07, c, 0, 0, 0, g);
  for (const z of [-0.35, 0.15, 0.6]) M.rbox(0.87, 0.165, 0.12, 0.05, w, 0, 0.002, z, g); // beyaz şeritler
  M.rbox(0.8, 0.14, 0.36, 0.06, c, 0, 0.1, -0.76, g); // yastık
  return g;
}
function makeRing(col, flamingo) {
  const v = flamingo && esya('simidi'); // Poly Pizza flamingo simidi (esya.js); düz simitler ve yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group(), c = M.mat(col);
  const t = M.mesh(new THREE.TorusGeometry(0.5, 0.17, 10, 24), c, 0, 0, 0, g); t.rotation.x = PI / 2;
  if (!flamingo) {
    for (let i = 0; i < 4; i++) { const s = M.mesh(new THREE.TorusGeometry(0.5, 0.175, 10, 4, 0.35), M.mat('#ffffff'), 0, 0, 0, g); s.rotation.set(PI / 2, 0, i * PI / 2); }
    return g;
  }
  // flamingo: kıvrık boyun, kafa, siyah uçlu gaga
  const n = [[0, 0.22, -0.55], [0, 0.5, -0.62], [0, 0.78, -0.58], [0, 0.98, -0.45]];
  for (const [x, y, z] of n) M.sph(0.12, c, x, y, z, g, 10, 8);
  M.sph(0.17, c, 0, 1.08, -0.36, g, 12, 10);
  const beak = M.cyl(0.02, 0.07, 0.22, 8, M.mat('#ffffff'), 0, 1.04, -0.18, g); beak.rotation.x = PI / 2 + 0.5;
  M.sph(0.035, M.mat('#1d1d24'), 0, 0.96, -0.08, g, 8, 6);
  for (const sx of [-1, 1]) M.sph(0.03, M.mat('#1d1d24'), sx * 0.11, 1.13, -0.3, g, 8, 6);
  return g;
}
// renk dilimli deniz topu
function makeBall(r = 0.3) {
  const v = esya('top'); // Poly Pizza deniz topu (esya.js), çapı 0,6: r'ye göre ölçeklenir; yüklenemezse aşağıdaki çizim
  if (v) { v.scale.setScalar(r / 0.3); return v; }
  const g = new THREE.Group(), cols = ['#e8473c', '#ffffff', '#3d7dd8', '#ffffff', '#f6c343', '#ffffff'];
  for (let i = 0; i < 6; i++) M.mesh(new THREE.SphereGeometry(r, 8, 10, (i * PI) / 3, PI / 3), M.mat(cols[i]), 0, 0, 0, g);
  return g;
}
function makePedalo() {
  const g = new THREE.Group(), w = M.mat('#ffffff'), b = M.mat('#3d9be0');
  for (const sx of [-0.62, 0.62]) M.rbox(0.44, 0.36, 2.5, 0.16, w, sx, 0, 0, g); // yüzer gövdeler
  M.rbox(1.55, 0.12, 1.4, 0.05, b, 0, 0.2, -0.1, g);  // güverte
  M.rbox(1.45, 0.5, 0.14, 0.05, b, 0, 0.5, -0.62, g); // sırtlık
  const sl = M.rbox(0.5, 0.06, 1.5, 0.03, M.mat('#f6c343'), 0, 0.75, -1.25, g); sl.rotation.x = -0.45; // kaydırak
  return g;
}
function makeJetski() {
  const g = new THREE.Group();
  M.rbox(0.72, 0.36, 2.0, 0.16, M.mat('#e8473c'), 0, 0, 0, g);
  M.rbox(0.5, 0.2, 0.9, 0.08, M.mat('#2a2a2a'), 0, 0.24, -0.2, g); // sele
  M.rbox(0.62, 0.22, 0.5, 0.1, M.mat('#ffffff'), 0, 0.18, 0.62, g);
  M.cyl(0.025, 0.025, 0.7, 6, M.mat('#2a2a2a'), 0, 0.42, 0.45, g).rotation.z = PI / 2; // gidon
  return g;
}
// oturan kişi: bacaklar öne uzanır, kalçası zemine (yükseklik y) iner
function seated(look, y) {
  const o = M.makeCharacter(look);
  M.setSwimwear(o, true);
  o.userData.sitY = y - 0.62;
  for (const l of o.userData.legs) l.rotation.x = -1.45;
  return o;
}

// ---------- kurulum ----------
export function initBeach(instant) {
  if (built) return;
  built = true;
  const add = (o) => { G.scene.add(o); if (!instant) popIn(o); return o; };
  // şamandıra ipi: yüzme alanının açık kenarı, kırmızı-beyaz toplar
  const line = new THREE.Group(), pts = [];
  for (let x = X0 - 3, i = 0; x <= X1 + 3; x += 1.7, i++) {
    const z = coastZ(x) + 6.6;
    M.sph(0.15, M.mat(i % 2 ? '#ffffff' : '#e8473c'), x, 0, z, line, 10, 8);
    pts.push(V(x, 0.02, z));
  }
  line.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#f3ead2' })));
  line.position.y = WATER;
  add(line);
  boats.push({ kind: 'buoys', obj: line });
  // denizde süzülen oyuncaklar
  const spots = [[-6, 3.0], [4, 4.2], [13, 2.6], [22, 3.8], [31, 2.8], [38, 4.4], [45, 3.2]];
  const kinds = [['bed', '#ff6fa8'], ['ring', '#ff9f43'], ['bed', '#4fc3e8'], ['flamingo', '#ff7eb6'], ['bed', '#f6c343'], ['ring', '#3fae6b'], ['ball']];
  kinds.forEach(([k, col], i) => {
    const [x, d] = spots[i];
    const obj = add(k === 'bed' ? makeBed(col) : k === 'ball' ? makeBall() : makeRing(col, k === 'flamingo'));
    toys.push({ kind: k === 'flamingo' ? 'ring' : k, obj, x, z: coastZ(x) + d, a: rand(0, 6), to: null, user: null, ph: rand(0, 6) });
  });
  // açıkta deniz bisikleti (iki kişi pedal çevirir) ve jet ski
  addPedalo(18, 22, 5.9, add);
  const js = add(makeJetski());
  const rider = M.makeCharacter(M.touristLook()); M.setSwimwear(rider, true);
  rider.position.set(0, -0.26, -0.25); rider.userData.legs[0].rotation.set(-1.1, 0, -0.35); rider.userData.legs[1].rotation.set(-1.1, 0, 0.35);
  js.add(rider);
  boats.push({ kind: 'jetski', obj: js, riders: [rider], cx: 20, rx: 30, d: 9.0, rz: 1.5, w: 0.16, th: rand(0, 6), wake: 0 });
  // kumda matkot: iki kişi kıyıdaki ıslak kumda raketle top sektirir; büfenin güneydoğusunda, 2. kule (x 31) ile ana kule (x 51)
  // arasındaki boş şeritte (kullanıcı 2026-11-03: "can kurtaranın önünde duruyor, daha güzel bir yere al"; eskiden x 29,4-34,8)
  const mk = [V(39.4, 0, 29.9), V(44.8, 0, 30.0)].map((p, i) => {
    const o = add(M.makeCharacter(M.touristLook()));
    M.setSwimwear(o, true);
    o.position.copy(p); o.rotation.y = i ? -PI / 2 : PI / 2;
    const r = M.cyl(0.17, 0.17, 0.03, 14, M.mat(i ? '#3d7dd8' : '#e8473c'), 0, -0.62, 0.1, o.userData.arms[0]); r.rotation.x = PI / 2; // raket sağ elde
    return { o, home: p.clone() };
  });
  const ball = add(M.sph(0.07, M.mat('#f6d743'), 40, 1.2, 29.9, null, 10, 8));
  sand.push({ kind: 'matkot', mk, ball, from: 0, t: 0, T: 0.9, on: true });
  // kum kalesinin (8,6; 29,8) batısında kova küreğiyle oynayan çocuk
  const kid = add(seated(M.touristLook(), 0.0));
  kid.scale.setScalar(0.62); kid.position.set(7.55, kid.userData.sitY * 0.62, 29.75); kid.rotation.y = PI / 2;
  const bucket = add(M.cyl(0.13, 0.1, 0.22, 10, M.mat('#e8473c'), 7.75, 0.11, 29.25));
  bucket.add(M.cyl(0.11, 0.11, 0.02, 10, M.mat('#e9c983'), 0, 0.1, 0));
  sand.push({ kind: 'kid', o: kid, on: true });
}

// deniz bisikleti: iki kişi pedal çevirir, kıyıya paralel elipste dolaşır
function addPedalo(cx, rx, d, add) {
  const ped = add(makePedalo());
  const riders = [-0.36, 0.36].map((x) => { const o = seated(M.touristLook(), 0.26); o.position.set(x, o.userData.sitY, -0.2); ped.add(o); return o; });
  boats.push({ kind: 'pedalo', obj: ped, riders, cx, rx, d, rz: 0.5, w: 0.035 + rand(0, 0.015), th: rand(0, 6) });
}
// deniz bisikleti kiralama (expand-east.js xsahil2): açıkta bir bisiklet daha dolaşır; kumsalda tatilci oldukça arada biri
// kiralar. 2026-11-03'ten beri büfenin hizmeti: tezgâhı büfenin doğu yanında, ücret büfenin kasasına düşer (pile kasa ya da kasayı veren işlev)
const rentals = [];
// kulübenin başında kiralamacı (kullanıcı 2026-10-28: "deniz bisikleti kiralamanın başına bir adam lazım"): kırmızı-beyaz
// kıyafetli, şapkalı; denize bakar, nefes alır, etrafa bakar, her kiralamada el sallayıp sevinir
export function addRental(pile, at, instant, manAt = [at.x - 0.75, at.z + 0.55, 0.25]) { // manAt: kiralamacının yeri [x, z, yön]
  addPedalo(38, 12, 6.3, (o) => { G.scene.add(o); if (!instant) popIn(o); return o; });
  if (!MB.obj) addMyBoat(35, instant); // oyuncunun bineceği: kıyıda bağlı, iki kule arasında (matkotçuların batısı)
  const man = M.makeCharacter({ shirt: '#e8604c', pants: '#f4f4f4', hat: 'cap', hatColor: '#ffffff', skin: '#d9a67c', mustache: true });
  man.position.set(manAt[0], 0, manAt[1]); man.rotation.y = manAt[2];
  G.scene.add(man); if (!instant) popIn(man, 0.15);
  const el = document.createElement('div'); el.className = 'staff'; el.textContent = '🚲 Kiralamacı';
  G.labels.add(el, (v) => v.copy(man.position).setY(man.position.y + 2.3));
  rentals.push({ pile, at, t: rand(12, 20), man, wave: 0 });
}

// oyuncu deniz bisikletine biner (2026-11-04 kullanıcı: "bizim adamımız köydeki etkinliklere katılabilmeli. Örneğin ...
// deniz bisikletlerine binebilmeli"): kiralamanın kıyıya bağlı bisikleti; önündeki pedde durunca biner (bedava, büfe onun), yön
// tuşlarıyla yüzme alanında ve açıkta gezer. Kıyıdaki yerine geri getirince ya da 90 sn dolunca iner. Binerken main.js oyuncuyu
// yürütmez, bisikleti ve oyuncuyu burası taşır (G.onRide)
const MB = { obj: null, dock: null, pad: null, on: false, t: 0, x: 0, z: 0, h: 0, v: 0, wk: 0, warned: false, seat: V(0, -0.36, -0.2) };
const PAD_CSS = 'font:14px var(--font-title);background:rgba(255,255,255,.92);color:#1d5f8a;padding:2px 10px;border-radius:999px;border:2px solid #1d5f8a;white-space:nowrap';
class BoatPad extends Station {
  constructor(x, z, instant) {
    super(x, z, 1.4, 1.4, { dashed: true, instant });
    this.dwell = 0; this.used = false; this.bodyFn = () => [];
    const el = document.createElement('div'); el.style.cssText = PAD_CSS; el.textContent = '🚲 Deniz bisikleti · bedava';
    G.labels.add(el, (v) => v.set(x, 0.7, z));
  }
  update(dt) {
    if (!this.inside || G.onRide) { this.dwell = 0; if (!this.inside) this.used = false; return; }
    if (this.used || (this.dwell += dt) < 0.6) return;
    this.used = true; boardBoat();
  }
}
function addMyBoat(x, instant) {
  const z = coastZ(x);
  MB.dock = { x, z: z + 1.5, h: 0 }; // kıyıya bağlı, burnu denize
  MB.obj = makePedalo(); G.scene.add(MB.obj); if (!instant) popIn(MB.obj);
  dockBoat();
  MB.pad = new BoatPad(x, z - 1.4, instant);
}
function dockBoat() {
  const d = MB.dock; Object.assign(MB, { x: d.x, z: d.z, h: d.h, v: 0 });
  MB.obj.position.set(d.x, WATER + 0.12, d.z); MB.obj.rotation.set(0, d.h, 0);
}
function boardBoat() {
  const P = G.player;
  Object.assign(MB, { on: true, t: 0, wk: 0, warned: false });
  G.onRide = boatTick;
  P.rotation.x = 0;
  ring(V(MB.x, -0.1, MB.z), '#ffffff', 1.4); sfx('pop');
  floatText(P.position.clone().setY(2.2), '🚲 Bedava · denizde gez, kıyıya geri getir', 'pos');
}
function endBoat() {
  const P = G.player, u = P.userData;
  MB.on = false; G.onRide = null; G.rideInp = null;
  for (const l of u.legs) l.rotation.x = 0;
  for (const a of u.arms) a.rotation.x = 0;
  dockBoat();
  P.position.set(MB.pad.zone.x + 1.6, 0, MB.pad.zone.z - 0.6); P.rotation.set(0, PI, 0); // pedin yanına, kumsala bakar
  ring(P.position.clone(), '#56c27e', 1);
  floatText(P.position.clone().setY(2.2), '😄', 'pos');
}
function boatTick(dt, inp) {
  const P = G.player, u = P.userData, o = MB.obj, t = G.time;
  MB.t += dt;
  const il = inp ? Math.hypot(inp.x, inp.z) : 0;
  if (il > 0.2) { MB.h = lerpAngle(MB.h, Math.atan2(inp.x, inp.z), 1 - Math.exp(-3 * dt)); MB.v += (2.8 * Math.min(1, il) - MB.v) * (1 - Math.exp(-2 * dt)); }
  else MB.v *= Math.exp(-1.2 * dt);
  const x = THREE.MathUtils.clamp(MB.x + Math.sin(MB.h) * MB.v * dt, X0 - 2, X1 + 8), c = coastZ(x);
  MB.x = x; MB.z = THREE.MathUtils.clamp(MB.z + Math.cos(MB.h) * MB.v * dt, c + 1.4, c + 9.5); // kumsala çıkmaz, şamandıra ipinin ötesine biraz açılır
  o.position.set(MB.x, WATER + 0.12 + Math.sin(t * 1.6) * 0.04, MB.z); o.rotation.set(0, MB.h, Math.sin(t * 1.3) * 0.04);
  o.updateMatrixWorld();
  P.position.copy(o.localToWorld(MB.seat.clone())); P.rotation.set(0, MB.h, 0);
  const ph = t * (2.5 + MB.v * 1.8), k = 0.12 + Math.min(1, MB.v / 2) * 0.25; // pedal: hızlandıkça sık ve geniş
  u.legs[0].rotation.x = -1.3 + Math.sin(ph) * k; u.legs[1].rotation.x = -1.3 - Math.sin(ph) * k;
  for (const a of u.arms) a.rotation.x = -0.25;
  if (MB.v > 0.8 && (MB.wk -= dt) <= 0) { MB.wk = 0.22; ring(V(MB.x - Math.sin(MB.h) * 1.4, -0.18, MB.z - Math.cos(MB.h) * 1.4), '#ffffff', 0.8); }
  if (MB.t > 80 && !MB.warned) { MB.warned = true; floatText(P.position.clone().setY(2.2), '⏱️ 10 sn', ''); }
  if (MB.t > 90 || (MB.t > 5 && Math.hypot(MB.x - MB.dock.x, MB.z - MB.dock.z) < 1.6)) endBoat();
}

// ---------- her kare ----------
const free = (T) => !T.user;
function wander(T, dt, k) {
  if (!T.to || Math.hypot(T.to.x - T.x, T.to.z - T.z) < 0.3) {
    const x = THREE.MathUtils.clamp(T.x + rand(-4, 4), X0, X1);
    T.to = { x, z: coastZ(x) + rand(NEAR, FAR) };
  }
  const dx = T.to.x - T.x, dz = T.to.z - T.z, d = Math.hypot(dx, dz) || 1, st = 0.13 * k * dt;
  T.x += (dx / d) * st; T.z += (dz / d) * st;
  T.a += dt * (T.kind === 'ring' ? 0.12 : 0.04) * k;
}
function place(T) {
  const o = T.obj, t = G.time + T.ph;
  o.position.set(T.x, (T.kind === 'ball' ? WATER + 0.22 : WATER) + Math.sin(t * 1.4) * 0.035, T.z);
  o.rotation.set(Math.sin(t * 1.1) * 0.04, T.a, Math.sin(t * 0.9) * 0.05);
}
// yağış (hava.js havaIslak): deniz bisikletleri ve jet ski açığa çekilip kaybolur, matkotçular ve kumdaki çocuk gider; hava açınca döner.
// away 0 → 1 yaklaşık 3 sn (2026-11-08 kullanıcı: "yağmur yağınca sahilde kimse kalmamalı ... denizde deniz aracına binenler")
let away = 0;
export function updateBeach(dt) {
  if (!built) return;
  const t = G.time;
  away = Math.max(0, Math.min(1, away + (havaIslak() ? dt : -dt) / 3));
  const off = away * away * 18, gone = away > 0.97;
  if (MB.obj && !MB.on) { MB.obj.position.y = WATER + 0.12 + Math.sin(t * 1.6) * 0.04; MB.obj.rotation.z = Math.sin(t * 1.3) * 0.04; } // kıyıda sallanır
  for (const T of toys) {
    if (T.user && !G.customers.includes(T.user)) T.user = null; // kullanan gitti (bölge yenilendi)
    if (!T.user || T.user.play?.phase === 'on') wander(T, dt, T.user ? 0.5 : 1);
    place(T);
  }
  for (const B of boats) {
    if (B.kind === 'buoys') { B.obj.position.y = WATER + Math.sin(t * 1.2) * 0.03; continue; }
    // kıyıya paralel uzun elips: yönü teğete döner
    B.th += B.w * dt;
    const x = B.cx + Math.cos(B.th) * B.rx, z = coastZ(B.cx) + B.d + Math.sin(B.th) * B.rz + off; // yağışta açığa çekilir
    if (B.obj.visible === gone) { B.obj.visible = !gone; if (!gone) popIn(B.obj); }
    const tx = -Math.sin(B.th) * B.rx, tz = Math.cos(B.th) * B.rz;
    B.obj.position.set(x, WATER + 0.12 + Math.sin(t * 1.6 + B.cx) * 0.04, z);
    B.obj.rotation.set(0, Math.atan2(tx, tz), Math.sin(t * 1.3) * 0.04);
    if (B.kind === 'pedalo') for (const [i, o] of B.riders.entries()) {
      const ph = t * 4 + i;
      o.userData.legs[0].rotation.x = -1.3 + Math.sin(ph) * 0.35; o.userData.legs[1].rotation.x = -1.3 - Math.sin(ph) * 0.35;
      for (const a of o.userData.arms) a.rotation.x = -0.25;
    } else {
      for (const a of B.riders[0].userData.arms) a.rotation.x = -1.35; // gidonu tutar
      if ((B.wake -= dt) <= 0) { B.wake = 0.14; ring(V(x - Math.sin(B.obj.rotation.y) * 1.1, -0.18, z - Math.cos(B.obj.rotation.y) * 1.1), '#ffffff', 0.9); }
    }
  }
  for (const Rn of rentals) {
    if ((Rn.t -= dt) > 0) continue;
    Rn.t = rand(22, 34);
    if (!G.customers.some((c) => c.region === 'sahil' && !c.leaving)) continue;
    const pay = Math.round(24 * mult());
    const P = typeof Rn.pile === 'function' ? Rn.pile() : Rn.pile;
    if (!P) continue;
    P.add(pay, Rn.at); floatText(Rn.at, `🚲 Kiralama +${pay} ₺`, 'pos');
    Rn.wave = 1.6;
  }
  for (const Rn of rentals) { // kiralamacı: dururken nefes alıp etrafa bakar; kiralama olunca el sallar
    if (!Rn.man) continue;
    M.animateCharacter(Rn.man, 0, dt, false);
    if (Rn.wave > 0) { Rn.wave -= dt; Rn.man.userData.arms[1].rotation.x = -2.7 + Math.sin(t * 14) * 0.35; Rn.man.userData.arms[1].rotation.z = -0.35; }
  }
  const sandOn = away < 0.08; // kumdakiler yağış başlar başlamaz gider, hava tam açınca döner
  for (const S of sand) {
    if (S.on !== sandOn) {
      S.on = sandOn;
      for (const o of S.kind === 'kid' ? [S.o] : [...S.mk.map((m) => m.o), S.ball]) { o.visible = sandOn; if (sandOn) popIn(o); }
    }
    if (!sandOn) continue;
    if (S.kind === 'kid') {
      const u = S.o.userData;
      u.arms[0].rotation.x = -0.95 + Math.sin(t * 5) * 0.4; u.arms[1].rotation.x = -0.7 + Math.sin(t * 3.1) * 0.25; // kum kazar
      continue;
    }
    // matkot: top bir raketten ötekine kavis çizerek gider, vuran kolunu savurur
    S.t += dt;
    const a = S.mk[S.from], b = S.mk[1 - S.from], k = Math.min(1, S.t / S.T);
    for (const [i, m] of S.mk.entries()) {
      m.o.position.z = m.home.z + Math.sin(t * 1.3 + i * 2) * 0.35; // topa göre yana kayar
      M.animateCharacter(m.o, 0.12, dt, false);
      const hit = i === S.from ? Math.max(0, 1 - S.t * 3) : k > 0.75 ? (k - 0.75) * 4 : 0; // vuruş ve karşılama
      m.o.userData.arms[0].rotation.x = -0.6 - hit * 1.1;
    }
    const pa = a.o.position, pb = b.o.position;
    S.ball.position.set(pa.x + (pb.x - pa.x) * k, 1.15 + 4 * 0.75 * k * (1 - k), pa.z + (pb.z - pa.z) * k);
    if (k >= 1) { S.from = 1 - S.from; S.t = 0; S.T = rand(0.75, 1.0); }
  }
}

// ---------- yüzücünün oyunları ----------
// yüzücünün gövdesi sea.js'in yüzme pozundan sonra oyunun pozuna geçer: c.update'i bir kez sararız
function wrapPose(c) {
  c.beachWrap = true;
  const inner = c.update;
  c.update = (dt) => { inner(dt); if (c.play && c.play.phase === 'on' && c.play.pose) c.play.pose(dt); };
}
// kendi yüzerek hedefe gider (sea.js swimAround yerine)
function swimTo(c, x, z, dt) {
  const p = c.obj.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.25) return true;
  const st = Math.min(d, 1.1 * dt);
  p.x += (dx / d) * st; p.z += (dz / d) * st;
  c.obj.rotation.y = lerpAngle(c.obj.rotation.y, Math.atan2(dx, dz) + (c.back ? PI : 0), 1 - Math.exp(-4 * dt));
  return false;
}
function endPlay(c) {
  const P = c.play;
  if (!P) return;
  c.play = null;
  if (P.toy) P.toy.user = null;
  if (P.game && !P.game.done) { P.game.done = true; G.scene.remove(P.game.ball); }
  const u = c.obj.userData;
  for (const a of u.arms) a.rotation.z = 0;
  for (const l of u.legs) l.rotation.x = 0;
  c.swim.cx = c.obj.position.x; c.swim.to = null; // bulunduğu yerin çevresinde yüzmeye devam
}
const swimmers = (c) => G.customers.filter((q) => q !== c && q.region === 'sahil' && q.state === 'swim' && q.swimWrap && !q.play && q.swim && q.swim.t > 10);
function startToy(c, kind) {
  const p = c.obj.position;
  const T = toys.filter((T) => T.kind === kind && free(T) && Math.hypot(T.x - p.x, T.z - p.z) < 14).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (!T) return false;
  T.user = c;
  const P = c.play = { kind, toy: T, t: Math.min(rand(14, 24), c.swim.t - 1), phase: 'go' };
  const u = c.obj.userData;
  P.tick = (dt) => { if (P.phase === 'go' && swimTo(c, T.x, T.z, dt)) { P.phase = 'on'; ring(V(T.x, -0.15, T.z), '#ffffff', 0.9); } };
  if (kind === 'bed') {
    // sırtüstü uzanır: başı yastıkta, bir kolu başının altında, bir dizi kalkık
    P.pose = () => {
      const o = c.obj, s = Math.sin(T.a), k = Math.cos(T.a);
      o.rotation.order = 'YXZ'; o.rotation.set(-PI / 2, T.a, 0);
      o.position.set(T.x + s * 0.95, T.obj.position.y + 0.39, T.z + k * 0.95);
      u.arms[0].rotation.x = -2.8; u.arms[1].rotation.x = -0.15;
      u.legs[0].rotation.x = 0; u.legs[1].rotation.x = -0.5;
    };
  } else {
    // simidin içinde dik durur, kollarını simidin üstüne yaslar, simitle birlikte döner
    P.pose = () => {
      const o = c.obj;
      o.rotation.order = 'YXZ'; o.rotation.set(0, T.a, 0);
      o.position.set(T.x, T.obj.position.y - 0.52, T.z);
      u.arms[0].rotation.set(-0.3, 0, -1.0); u.arms[1].rotation.set(-0.3, 0, 1.0);
      u.legs[0].rotation.x = Math.sin(G.time * 2) * 0.3; u.legs[1].rotation.x = -u.legs[0].rotation.x;
    };
  }
  return true;
}
// iki yüzücü karşılıklı top atışır: önce aralarındaki noktanın iki yanına yüzerler
function startBall(c) {
  const p = c.obj.position;
  const q = swimmers(c).filter((q) => q.obj.position.distanceTo(p) < 10).sort((a, b) => a.obj.position.distanceTo(p) - b.obj.position.distanceTo(p))[0];
  if (!q) return false;
  const mx = THREE.MathUtils.clamp((p.x + q.obj.position.x) / 2, X0 + 2, X1 - 2), mz = coastZ(mx) + 3.2;
  const game = { done: false, ball: makeBall(0.2), from: 0, t: -0.6, T: 1.1, spots: [V(mx - 1.9, 0, mz), V(mx + 1.9, 0, mz)] };
  game.ball.visible = false; G.scene.add(game.ball);
  const dur = Math.min(rand(14, 20), c.swim.t - 1, q.swim.t - 1);
  [c, q].forEach((s, i) => {
    if (!s.beachWrap) wrapPose(s);
    const P = s.play = { kind: 'ball', game, i, t: dur, phase: 'go' }, u = s.obj.userData, o = s.obj;
    P.tick = (dt) => {
      if (P.phase === 'go') { if (swimTo(s, game.spots[i].x, game.spots[i].z, dt)) P.phase = 'on'; return; }
      if (i) return; // atışı ilk oyuncu yürütür
      const other = q.play && q.play.game === game ? q.play : null;
      if (!other || other.phase !== 'on') return;
      game.ball.visible = true;
      game.t += dt;
      const a = game.from ? q : c, b = game.from ? c : q, k = THREE.MathUtils.clamp(game.t / game.T, 0, 1);
      const pa = a.obj.position, pb = b.obj.position;
      game.ball.position.set(pa.x + (pb.x - pa.x) * k, 1.05 + 4 * 1.1 * k * (1 - k), pa.z + (pb.z - pa.z) * k);
      game.ball.rotation.x += dt * 6;
      if (k >= 1) { ring(V(pb.x, -0.15, pb.z), '#ffffff', 0.7); game.from = 1 - game.from; game.t = -0.4; game.T = rand(0.95, 1.25); } // tutar, biraz bekler, geri atar
    };
    // suda dik durur (ayak çırpar), karşısındakine döner; atarken ve tutarken kollar havada
    P.pose = () => {
      const other = i ? c : q;
      const dx = other.obj.position.x - o.position.x, dz = other.obj.position.z - o.position.z;
      o.rotation.order = 'YXZ'; o.rotation.set(0, Math.atan2(dx, dz), 0);
      o.position.y = -0.72 + Math.sin(G.time * 2.4 + i) * 0.05;
      const k = THREE.MathUtils.clamp(game.t / game.T, 0, 1), thrower = game.from === i;
      const up = game.ball.visible ? (thrower ? Math.max(0, 1 - k * 2.5) : Math.max(0, (k - 0.6) * 2.5)) : 0;
      u.arms[0].rotation.set(-0.5 - Math.min(1, up) * 2.3, 0, 0); u.arms[1].rotation.set(-0.5 - Math.min(1, up) * 2.3, 0, 0);
      u.legs[0].rotation.x = Math.sin(G.time * 3 + i) * 0.4; u.legs[1].rotation.x = -u.legs[0].rotation.x;
    };
  });
  return true;
}
// world.js seaThink 'swim': true dönerse yüzücü bu karede oyunda (swimAround ve boğulma denemesi atlanır)
export function seaPlay(c, dt) {
  if (!built) return false;
  if (!c.beachWrap) wrapPose(c);
  const P = c.play;
  if (P) {
    P.t -= dt;
    if (P.t <= 0 || c.swim.t <= 0.1 || (P.game && P.game.done)) { endPlay(c); return false; }
    P.tick(dt);
    return true;
  }
  c.playCd = (c.playCd ?? rand(2, 5)) - dt;
  if (c.playCd > 0 || c.swim.t < 9) return false;
  c.playCd = rand(9, 15);
  for (const f of [() => startToy(c, 'bed'), () => startToy(c, 'ring'), () => startBall(c)].sort(() => Math.random() - 0.5)) if (f()) return true;
  return false;
}
