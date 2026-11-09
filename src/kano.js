// Kano iskelesi ve derede kanocular (2026-11-08 kullanıcı: "Nehirde kano yapan insanlar olabilir. Kano kiralama işletmesi
// açılabilir."; seçimi: işletme + süs). Derede her zaman üç kano gezer (süs): pazar köprüsünün kuzeyinden kuzeye kürek çekip
// döner. Köprünün kuzeyinde, derenin doğu kıyısındaki çimende iskele kilidi (xkano): tahta rıhtım, ona bağlı iki kano, kulübe,
// kano sehpası, kasa ve Kanocu. Tatil köyü tarafından (yolun doğusundan) gelen müşteri rıhtıma yürür, kanoya biner, dere boyunca
// kuzeye kürek çekip döner, inince ücretini kasaya bırakır. Batı kıyısı pazarın biber bostanı ve fıçılı alanıyla dolu olduğu için
// iskele doğu kıyıda; müşteriler köprüden geçmez (köprünün yüksekliğini yalnız oyuncu izler). Yağışta süs kanoları çekilir, yeni
// kiralama olmaz; dönen kano yine iner. main.js her kare updateKano(dt) çağırır; tanım expand-east.js'ten yüklenir.
import * as THREE from 'three';
import * as M from './models.js';
import { G, MoneyPile, Customer, floatText, rand, mult, popIn, lerpAngle } from './game.js';
import { defineExpansion } from './expand.js';
import { repMul } from './rating.js';
import { ring } from './fx.js';
import { havaIslak } from './hava.js';
import { texRep, textTex } from './tex.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
const WATER = -0.03;  // dere suyunun yüzü (decor.js river)
const SEAT = 0.12;    // kanodaki oturağın yüksekliği: kalça burada, bacaklar gövdenin içinde öne uzanır
const SPEED = 1.1;    // kürek hızı (m/sn)
const PAY = 40;       // bir kano turunun ücreti
const smooth = (k) => k * k * (3 - 2 * k);

// ---------- dere ekseni (decor.js river() ile aynı eğri) ----------
const CURVE = new THREE.CatmullRomCurve3([[77, -160], [73, -110], [67, -70], [64, -35], [62, -5], [60, 18], [59, 34]].map(([x, z]) => V(x, 0, z)));
const LEN = CURVE.getLength();
const _p = V(0, 0, 0), _t = V(0, 0, 0), _a = V(0, 0, 0), _b = V(0, 0, 0);
// s: eğri boyu (kuzeyden güneye artar), lat: eksenden doğuya uzaklık
function riverPt(s, lat, out) {
  const u = Math.min(1, Math.max(0, s / LEN));
  CURVE.getPointAt(u, _p); CURVE.getTangentAt(u, _t);
  const l = Math.hypot(_t.x, _t.z) || 1;
  return out.set(_p.x + (_t.z / l) * lat, 0, _p.z - (_t.x / l) * lat);
}
function sOfZ(z) {
  let a = 0, b = LEN;
  for (let i = 0; i < 30; i++) { const m = (a + b) / 2; CURVE.getPointAt(m / LEN, _p); if (_p.z < z) a = m; else b = m; }
  return (a + b) / 2;
}
function northAt(z) { CURVE.getTangentAt(sOfZ(z) / LEN, _t); return Math.atan2(-_t.x, -_t.z); } // akıntıya karşı (kuzeye) bakış

// tur: doğu şeritten (lat +L) kuzeye, kuzey ucunda sola dönüp (B kadar kuzeye taşan yarım elips) batı şeritten güneye, güney ucunda
// yine sola dönüp başa. Herkes sağdan gider: karşılaşan kanolar yan yana geçer, aynı şeritte aynı hızla gidenler üst üste binmez
function makeLoop(zS, zN, L, B) {
  const sA = sOfZ(zS), sB = sOfZ(zN), D = sA - sB, T = PI * Math.sqrt((L * L + B * B) / 2);
  return { sA, sB, D, T, L, B, P: 2 * D + 2 * T };
}
function loopAt(R, d, out) {
  const { sA, sB, D, T, L, B, P } = R;
  d = ((d % P) + P) % P;
  let s, lat;
  if (d < D) { s = sA - d; lat = L; }
  else if (d < D + T) { const k = (d - D) / T; s = sB - Math.sin(PI * k) * B; lat = L * Math.cos(PI * k); }
  else if (d < 2 * D + T) { s = sB + (d - D - T); lat = -L; }
  else { const k = (d - 2 * D - T) / T; s = sA + Math.sin(PI * k) * B; lat = -L * Math.cos(PI * k); }
  return riverPt(s, lat, out);
}

// ---------- modeller ----------
// kano: sivri uçlu uzun gövde (yarısı suyun altında), burnu ve kıçı beyaz, her oturağın yerinde koyu açıklık
function makeCanoe(col, seats) {
  const g = new THREE.Group();
  M.sph(1, M.mat(col), 0, 0, 0, g, 18, 10).scale.set(0.44, 0.26, 1.6);
  for (const z of [-1.38, 1.38]) M.sph(1, M.mat('#ffffff'), 0, 0.1, z, g, 10, 6).scale.set(0.13, 0.1, 0.26);
  for (const z of seats) M.sph(1, M.mat('#3b2b20'), 0, 0.235, z, g, 12, 6).scale.set(0.3, 0.06, 0.55);
  return g;
}
// çift palalı kürek: ortası kanocunun göğsünde, palalar iki yanda
function makePaddle() {
  const g = new THREE.Group();
  M.cyl(0.022, 0.022, 1.7, 6, M.mat('#3d4552'), 0, 0, 0, g).rotation.z = PI / 2;
  for (const sx of [-1, 1]) M.rbox(0.34, 0.15, 0.025, 0.01, M.mat('#f6c343'), sx * 0.95, 0, 0, g);
  return g;
}
const PD_RIDE = [0, 0.55, 0.32], PD_REST = [0, 0.27, 0.15]; // kürek: çekerken göğüs hizasında, boşta kanonun üstüne yatık
function seat(o, z) { o.position.set(0, SEAT - 0.62, z); o.rotation.set(0, 0, 0); }
// kürek çekiş: kürek bir yana yatıp palası suya girer, öbür yana geçer; kollar onu izler, bacaklar öne uzanık
function paddle(R, t, k = 1) {
  const ph = t * 2.6 * k + R.ph, s = Math.sin(ph), u = R.o.userData;
  R.pd.position.set(PD_RIDE[0], PD_RIDE[1], R.z + PD_RIDE[2]);
  R.pd.rotation.set(0, Math.cos(ph) * 0.35, s * 0.62);
  for (const l of u.legs) l.rotation.set(-1.45, 0, 0);
  u.arms[0].rotation.x = -1.05 + s * 0.3; u.arms[1].rotation.x = -1.05 - s * 0.3;
}
function rider(canoe, o, z) {
  seat(o, z); canoe.add(o);
  const pd = makePaddle(); canoe.add(pd);
  return { o, pd, z, ph: rand(0, 6) };
}
// kanoyu yerine koyar; hFix verilmezse burnu gidiş yönüne döner. Suyun üstünde hafifçe sallanır, giderken arkasında halka
function setBoat(B, x, z, dt, t, hFix) {
  const o = B.obj;
  if (hFix != null) B.h = lerpAngle(B.h, hFix, 1 - Math.exp(-3 * dt));
  else { const dx = x - o.position.x, dz = z - o.position.z; if (dx * dx + dz * dz > 1e-8) B.h = lerpAngle(B.h, Math.atan2(dx, dz), 1 - Math.exp(-6 * dt)); }
  o.position.set(x, WATER + Math.sin(t * 1.5 + B.ph) * 0.02, z);
  o.rotation.set(0, B.h, Math.sin(t * 1.2 + B.ph) * 0.03);
  if (hFix == null && (B.wk -= dt) <= 0) {
    B.wk = 0.8;
    const P = G.player && G.player.position;
    if (P && Math.abs(P.x - x) + Math.abs(P.z - z) < 40) ring(V(x - Math.sin(B.h) * 1.5, 0.0, z - Math.cos(B.h) * 1.5), '#ffffff', 0.6);
  }
}

// ---------- derede gezen kanolar (süs) ----------
const AMB = { built: false, on: true, boats: [], loop: null };
function buildAmb() {
  AMB.built = true;
  AMB.loop = makeLoop(-14, -62, 1.5, 2.0);
  const kinds = [['#e8473c', [-0.55, 0.6]], ['#f6c343', [0]], ['#2fa39a', [0]]]; // biri iki kişilik
  kinds.forEach(([col, seats], i) => {
    const obj = makeCanoe(col, seats); G.scene.add(obj);
    const riders = seats.map((z) => rider(obj, M.makeCharacter(Math.random() < 0.6 ? M.touristLook() : M.villagerLook()), z));
    const B = { obj, riders, d: (i * AMB.loop.P) / kinds.length, h: 0, wk: rand(0, 1), ph: rand(0, 6) };
    loopAt(AMB.loop, B.d, _a); loopAt(AMB.loop, B.d + 0.2, _b);
    B.h = Math.atan2(_b.x - _a.x, _b.z - _a.z); obj.position.copy(_a);
    AMB.boats.push(B);
  });
}

// ---------- kano iskelesi (işletme) ----------
const QUAY = [64.6, 67.4, -10.8, -3.4];     // rıhtımın tahta güvertesi (yarısı suyun üstünde; doğu kıyısı x 65,35)
const MOOR = [-8.8, -5.2];                  // bağlı iki kanonun z'si, rıhtımın batı kenarında (x 64)
const FROM = () => V(rand(78, 84), 0, rand(4.0, 4.6)); // müşteri tatil köyü tarafından, yolun kuzey kenarından gelir
const BIZ = { on: false, canoes: [], t: 4, man: null, wave: 0, pile: null };

function makeKulube() { // kiralama kulübesi: tahta, önü (güneyi) tezgâhlı, kırmızı-beyaz tenteli; içinde can yelekleri, çatısında tabela
  const g = new THREE.Group(), wood = M.mat('#ffffff', { map: texRep('wood', 1, 1) }), dark = M.mat('#7a4f2a'), W = 3.0, D = 2.2, H = 2.3;
  M.rbox(W, H, 0.12, 0.03, wood, 0, H / 2, -D / 2 + 0.06, g);
  for (const sx of [-1, 1]) M.rbox(0.12, H, D, 0.03, wood, sx * (W / 2 - 0.06), H / 2, 0, g);
  M.rbox(W, 1.0, 0.12, 0.03, wood, 0, 0.5, D / 2 - 0.06, g);
  M.rbox(W + 0.2, 0.08, 0.5, 0.02, dark, 0, 1.04, D / 2 - 0.06, g);
  M.rbox(W + 0.6, 0.12, D + 0.8, 0.03, M.mat('#2f7d6a'), 0, H + 0.12, 0.1, g).rotation.x = 0.1;
  for (let i = 0; i < 6; i++) M.rbox(W / 6, 0.04, 0.7, 0.01, M.mat(i % 2 ? '#ffffff' : '#e8473c'), -W / 2 + W / 12 + (i * W) / 6, H - 0.15, D / 2 + 0.3, g).rotation.x = 0.35;
  for (const x of [-0.9, -0.3, 0.3, 0.9]) M.rbox(0.36, 0.48, 0.12, 0.05, M.mat('#ff7a1a'), x, 1.55, -D / 2 + 0.2, g); // can yelekleri
  for (const x of [-1.15, -1.0]) { const p = makePaddle(); p.rotation.set(0, PI / 2, PI / 2 - 0.12); p.position.set(x, 1.0, -0.5); g.add(p); } // köşede dikili kürekler
  M.rbox(2.4, 0.5, 0.08, 0.03, M.mat('#ffffff', { map: textTex('KANO KİRALAMA', { bg: '#1f7a8c', border: '#ffffff', w: 640, h: 133 }) }), 0, H + 0.45, D / 2 + 0.2, g);
  return g;
}
function makeSehpa() { // kano sehpası: iki tahta çatkı, üstünde ters çevrilmiş iki kano
  const g = new THREE.Group(), w = M.mat('#8a5a33');
  for (const x of [-1.1, 1.1]) {
    for (const z of [-0.35, 0.35]) M.rbox(0.1, 1.3, 0.1, 0.02, w, x, 0.65, z, g);
    for (const y of [0.5, 1.08]) M.rbox(0.1, 0.08, 0.9, 0.02, w, x, y, 0, g);
  }
  [['#3d7dd8', 0.73], ['#ff8a3d', 1.31]].forEach(([col, y]) => { const c = makeCanoe(col, [0]); c.rotation.set(PI, PI / 2, 0); c.position.set(0, y, 0); g.add(c); });
  return g;
}
function makeRihtim() { // rıhtım: tahta güverte (üstü 0,06), su tarafında babalar ve ayaklar
  const g = new THREE.Group(), [x0, x1, z0, z1] = QUAY, w = x1 - x0, d = z1 - z0, post = M.mat('#6b4526');
  M.rbox(w, 0.14, d, 0.03, M.mat('#ffffff', { map: texRep('wood', w / 1.4, d / 1.4) }), (x0 + x1) / 2, -0.01, (z0 + z1) / 2, g);
  for (let z = z0 + 0.3; z <= z1 - 0.29; z += (d - 0.6) / 3) { M.cyl(0.09, 0.09, 0.75, 8, post, x0 + 0.12, -0.08, z, g); M.cyl(0.11, 0.11, 0.06, 8, post, x0 + 0.12, 0.32, z, g); }
  return g;
}

function buildBiz(c) {
  BIZ.on = true;
  const add = (o) => { G.scene.add(o); if (!c.instant) popIn(o); return o; };
  c.put(makeRihtim(), 0, 0, 0);
  G.walkways.push(QUAY.slice());
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 7.0), new THREE.MeshStandardMaterial({ map: texRep('path', 0.6, 2.4), roughness: 0.95 }));
  path.rotation.x = -PI / 2; path.receiveShadow = true; c.put(path, 67.0, 0.006, 0.1); // yoldan rıhtıma toprak patika
  c.put(makeKulube(), 70.2, 0, -9.4); c.col(68.6, 71.8, -10.6, -8.2);
  c.put(makeSehpa(), 70.3, 0, -4.2); c.col(68.6, 72.0, -4.75, -3.65);
  const sg = M.makeSign('KANO KİRALAMA', '#1f7a8c', 2.6, 0.62); c.put(sg, 69.8, 0, 2.3);
  // kasa: kulübenin önünde; muhasebeci doğusundan gelir
  const kx = 68.9, kz = -7.0;
  c.put(M.rbox(1.12, 0.86, 1.02, 0.06, M.mat('#5d6b78')), kx, 0.43, kz);
  c.put(M.rbox(1.18, 0.07, 1.08, 0.03, M.mat('#38424c')), kx, 0.885, kz);
  const body = c.col(kx - 0.56, kx + 0.56, kz - 0.51, kz + 0.51);
  BIZ.pile = new MoneyPile(c.group, kx, kz, 0.92, { desk: false, body, instant: c.instant });
  BIZ.pile.spot = { x: kx + 1.0, y: 0, z: kz, ry: -PI / 2 };
  // bağlı kanolar ve bineceklerin rıhtımdaki yeri
  MOOR.forEach((zM, i) => {
    const obj = add(makeCanoe(['#e8604c', '#3fae6b'][i], [-0.1])), hN = northAt(zM), moor = V(64.0, 0, zM);
    const pd = makePaddle(); pd.position.set(PD_REST[0], PD_REST[1], -0.1 + PD_REST[2]); pd.rotation.set(0, 0.25, 0); obj.add(pd);
    obj.position.set(moor.x, WATER, moor.z); obj.rotation.y = hN;
    BIZ.canoes.push({ obj, pd, moor, hN, h: hN, ph: rand(0, 6), wk: 0, state: 'moored', t: 0, d: 0, c: null, R: null,
      loop: makeLoop(zM + 1.5, -40, 0.45, 1.6), spot: V(65.05, 0, zM) });
  });
  // Kanocu: rıhtımda iki kanonun arasında, dereye bakar; her binişte ve inişte el sallar
  const man = add(M.makeCharacter({ shirt: '#1f8a8c', pants: '#2d3e66', hat: 'cap', hatColor: '#f6c343', skin: '#d9a67c', mustache: true }));
  man.position.set(65.95, 0, -7.0); man.rotation.y = -PI / 2;
  const el = document.createElement('div'); el.className = 'staff'; el.textContent = '🛶 Kanocu';
  G.labels.add(el, (v) => v.copy(man.position).setY(man.position.y + 2.3));
  BIZ.man = man;
}

const D0 = 3.0; // tur, bağlandığı yerin 1,5 m kuzeyinden başlar (döngünün güney ucu bağlama yerinin 1,5 m güneyinde)
function rentCustomer(K) {
  const c = new Customer(FROM(), 'kano', Math.random() < 0.7 ? M.touristLook() : M.villagerLook());
  K.c = c; c.state = 'go'; c.path = [K.spot.clone()]; c.setBubbleText('🛶');
  c.think = (dt) => {
    if (c.state === 'go') { if (c.walk(dt)) { c.state = 'wait'; c.t = 0; } }
    else if (c.state === 'wait') { c.face(-PI / 2, dt); c.t += dt; if (c.t > 1.0 && c.fadeIn == null) board(K); }
    else if (c.state === 'leave' && c.walk(dt)) c.destroy();
  };
}
function board(K) { // müşteri kanoya oturur: müşteri listesinden çıkar, kanoyla birlikte taşınır
  const c = K.c;
  c.clearBubble();
  const i = G.customers.indexOf(c); if (i >= 0) G.customers.splice(i, 1);
  K.obj.add(c.obj); seat(c.obj, -0.1);
  K.R = { o: c.obj, pd: K.pd, z: -0.1, ph: rand(0, 6) };
  K.state = 'out'; K.t = 0; BIZ.wave = 1.6;
}
function land(K) { // rıhtıma çıkar, ücreti kasaya bırakır, geldiği yola döner
  const c = K.c, u = c.obj.userData;
  G.scene.add(c.obj); c.obj.position.set(K.spot.x, 0, K.spot.z); c.obj.rotation.set(0, PI / 2, 0);
  for (const l of u.legs) l.rotation.set(0, 0, 0);
  for (const a of u.arms) a.rotation.set(0, 0, 0);
  G.customers.push(c);
  const pay = Math.round(PAY * mult());
  BIZ.pile.add(pay, c.obj.position); floatText(c.obj.position, `🛶 Kano +${pay} ₺`, 'pos'); c.mood(true); G.stats.customers++;
  c.state = 'leave'; c.leaving = true; c.path = [FROM()];
  K.pd.position.set(PD_REST[0], PD_REST[1], -0.1 + PD_REST[2]); K.pd.rotation.set(0, 0.25, 0);
  K.c = null; K.R = null; K.state = 'moored'; BIZ.wave = 1.6;
}

defineExpansion({ id: 'xkano', region: 'tatil', chain: 'kano', tier: 1, lvl: 10, icon: '🛶', title: 'Kano İskelesi', price: 3600,
  rect: [65.6, 72.4, -11.2, 3.8], noGround: true, at: [67.0, 1.4],
  info: { text: 'Derenin doğu kıyısına kano iskelesi kuruldu.', steps: [['🛶', 'Tatil tarafından gelenler rıhtımda kanoya biner, dere boyunca kürek çekip döner.'], ['💰', `Dönen her kanocu ${PAY} ₺ bırakır; parası kulübenin önündeki kasada birikir.`]] },
  build: buildBiz });

// ---------- her kare ----------
export function updateKano(dt) {
  if (!G.scene) return;
  if (!AMB.built) buildAmb();
  const t = G.time, wet = havaIslak();
  if (AMB.on === wet) { AMB.on = !wet; for (const B of AMB.boats) { B.obj.visible = AMB.on; if (AMB.on) popIn(B.obj); } } // yağışta süs kanoları çekilir
  if (AMB.on) for (const B of AMB.boats) {
    B.d += SPEED * dt;
    loopAt(AMB.loop, B.d, _a); setBoat(B, _a.x, _a.z, dt, t, null);
    for (const R of B.riders) paddle(R, t);
  }
  if (!BIZ.on) return;
  if ((BIZ.t -= dt * repMul()) <= 0) {
    BIZ.t = rand(8, 14);
    const K = BIZ.canoes.find((k) => k.state === 'moored' && !k.c);
    if (K && !wet) rentCustomer(K);
  }
  for (const K of BIZ.canoes) {
    const o = K.obj;
    if (K.state === 'moored') { o.position.y = WATER + Math.sin(t * 1.5 + K.ph) * 0.02; o.rotation.z = Math.sin(t * 1.2 + K.ph) * 0.03; continue; }
    K.t += dt;
    if (K.state === 'out') { // bağlandığı yerden şeride süzülür
      const k = smooth(Math.min(1, K.t / 3));
      loopAt(K.loop, D0, _a); _b.copy(K.moor).lerp(_a, k); setBoat(K, _b.x, _b.z, dt, t, K.hN);
      if (K.t >= 3) { K.state = 'trip'; K.d = D0; }
    } else if (K.state === 'trip') {
      K.d = Math.min(K.loop.P, K.d + SPEED * dt);
      loopAt(K.loop, K.d, _a); setBoat(K, _a.x, _a.z, dt, t, null);
      if (K.d >= K.loop.P) { K.state = 'in'; K.t = 0; }
    } else if (K.state === 'in') { // turu bitirip bağlama yerine yanaşır
      const k = smooth(Math.min(1, K.t / 3.5));
      loopAt(K.loop, 0, _a); _b.copy(_a).lerp(K.moor, k); setBoat(K, _b.x, _b.z, dt, t, K.hN);
      if (K.t >= 3.5) land(K);
    }
    if (K.R) paddle(K.R, t, K.state === 'trip' ? 1 : 0.6);
  }
  const man = BIZ.man, a = man.userData.arms[1];
  M.animateCharacter(man, 0, dt, false);
  if (BIZ.wave > 0) { BIZ.wave -= dt; a.rotation.x = -2.7 + Math.sin(t * 14) * 0.35; a.rotation.z = BIZ.wave > 0 ? -0.35 : 0; }
}
// test kancası: kanoların durumu
if (typeof window !== 'undefined') window.__kano = () => ({ amb: AMB.boats.map((B) => [+B.obj.position.x.toFixed(1), +B.obj.position.z.toFixed(1)]),
  biz: BIZ.canoes.map((K) => [K.state, +K.obj.position.x.toFixed(1), +K.obj.position.z.toFixed(1), K.c ? K.c.state : '-']), kasa: BIZ.pile ? BIZ.pile.amount : null });
