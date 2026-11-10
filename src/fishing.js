// Balıkçı İskelesi (sahil yolunun güneyi, sahil büfesinin batısı; kilit 'gb'): denize uzanan ahşap iskele.
// Kuzeyde buzlu balık tezgahı, buzlu kasa ve iskele kasası; güney ucunda olta yeri (oyuncu durunca balık tutar),
// balıkçının yeri ve bağlı kayık (tekne yükseltmesiyle balıkçı açığa çıkar: upgrades.js Balikci). Köylü ve kasabalı
// müşteriler sahil yolundan gelip tezgahtan balık alır. Restoran kilidi ('b2'): masalar ve ızgara; oturan müşteri
// ızgara balık ister, tabağı oyuncu ya da restoran garsonu götürür. Ortak durum G.fish'te.
import * as THREE from 'three';
import * as M from './models.js';
import { crate } from './mobilya.js';
import { texRep, textTex } from './tex.js';
import { G, ITEMS, Station, Shelf, Generator, Converter, MoneyPile, Customer, makeItem, fly, floatText, sfx, popIn, rand, pick, mult } from './game.js';
import { maybeRush, pat, repMul } from './rating.js';
import { ring } from './fx.js';
import { esya } from './esya.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
// iskele: sahil yolunun iki feneri arasından denize
// harita genişletmesi: batı blok -7
const DECK = { x0: -38.8, x1: -25.6, z0: 30.6, z1: 43.6 };
const STALL = { x: -35.2, z: 33.6 }, CRATE = { x: -29.6, z: 33.3 };
const ROD_P = { x: -36.6, z: 42.7 }, BOAT_HOME = { x: -30.0, z: 45.6 }, BOARD = { x: -30.0, z: 43.2 };
const TABLES = [[-36.2, 37.6], [-32.8, 37.6], [-36.2, 40.2], [-32.8, 40.2]];
const ENTRY = V(-86, 0, 29.7), LANE = 29.7;

// ---------- ürünler: balık ve ızgara balık (kodla çizilir, makeItem d.fn ile kurar) ----------
function makeFish() {
  const v = esya('balik'); // Poly Pizza balığı (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  const top = M.mat('#8fb4c9', { rough: 0.3 }), low = M.mat('#e6eef2', { rough: 0.5 });
  const body = M.sph(0.12, top, 0, 0.09, 0, g, 12, 8); body.scale.set(0.55, 0.7, 1.6);
  const belly = M.sph(0.1, low, 0, 0.068, 0.02, g, 10, 6); belly.scale.set(0.5, 0.42, 1.4);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 4), M.mat('#6f93a8')); tail.rotation.x = PI / 2; tail.scale.set(0.25, 1, 1); tail.position.set(0, 0.09, -0.25); g.add(tail);
  for (const sx of [-1, 1]) M.sph(0.017, M.mat('#1d1f24'), sx * 0.052, 0.115, 0.13, g, 6, 4);
  g.userData.h = 0.16;
  return g;
}
// ızgara balık tabağı: mavi kenarlı oval tabakta yan yatmış, sırtı ızgara izli balık; yanında limon, roka ve mor soğan halkaları.
// Çiğ balık GLB'si (palyaço balığı gibi dik duruyor, izler yüzgecin üstünde havada kalıyordu) tabakta kullanılmaz. Tabak başına ~1100 üçgen
let PG = null;
function plateParts() {
  if (PG) return PG;
  const lemon = new THREE.CylinderGeometry(0.05, 0.05, 0.016, 10, 1, false, 0, PI); // yarım ay dilim: yan yüz kabuk, üst ve alt meyve
  PG = {
    rim: new THREE.TorusGeometry(0.235, 0.011, 3, 22), body: new THREE.SphereGeometry(0.1, 14, 9), ridge: new THREE.SphereGeometry(0.1, 10, 6),
    tail: new THREE.ConeGeometry(0.08, 0.12, 4), bar: new THREE.BoxGeometry(0.075, 0.007, 0.009), gill: new THREE.BoxGeometry(0.008, 0.006, 0.07),
    lemon, leaf: new THREE.SphereGeometry(0.03, 5, 3), ring: new THREE.TorusGeometry(0.022, 0.0045, 3, 9),
    mats: {
      plate: M.mat('#ffffff', { rough: 0.3 }), rim: M.mat('#2f6db5', { rough: 0.3 }), fish: M.mat('#c98a4a', { rough: 0.7 }), back: M.mat('#a0652f', { rough: 0.7 }),
      tail: M.mat('#8f5a2c', { rough: 0.7 }), mark: M.mat('#4a2a14'), eye: M.mat('#f4efe6', { rough: 0.4 }), pupil: M.mat('#1d1f24'),
      lemon: [M.mat('#e9b80c', { rough: 0.5, side: THREE.DoubleSide }), M.mat('#f8dc4a', { rough: 0.6 }), M.mat('#f8dc4a', { rough: 0.6 })],
      leaf: [M.mat('#4f9e3a'), M.mat('#6bb54a')], onion: M.mat('#b56aa6', { rough: 0.5 }),
    },
  };
  return PG;
}
function makePlate() {
  const P = plateParts(), m = P.mats, g = new THREE.Group();
  const dish = new THREE.Group(); dish.scale.set(1.3, 1, 0.9); g.add(dish);
  M.cyl(0.23, 0.2, 0.022, 20, m.plate, 0, 0.011, 0, dish);
  const rim = M.mesh(P.rim, m.rim, 0, 0.022, 0, dish); rim.rotation.x = PI / 2;
  // balık yan yatmış: boyu x, kalınlığı y; sırtı (-z) koyu, kuyruğu yelpaze
  const f = new THREE.Group(); f.rotation.y = 0.22; f.position.set(-0.01, 0, -0.035); g.add(f);
  const RX = 0.175, RY = 0.042, CY = 0.056;
  M.mesh(P.body, m.fish, 0, CY, 0, f).scale.set(RX / 0.1, RY / 0.1, 0.62);
  M.mesh(P.ridge, m.back, -0.01, CY + 0.004, -0.03, f).scale.set(1.5, 0.36, 0.34);
  const tail = M.mesh(P.tail, m.tail, -RX - 0.04, CY, 0, f); tail.rotation.z = -PI / 2; tail.scale.set(0.22, 1, 1);
  const top = (x) => CY + RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2));
  for (const x of [-0.09, -0.035, 0.02, 0.075]) { const b = M.mesh(P.bar, m.mark, x, top(x) - 0.002, 0, f); b.rotation.y = 0.75; }
  M.mesh(P.gill, m.mark, 0.112, top(0.112) - 0.001, 0.004, f).rotation.y = -0.25;
  M.mesh(P.leaf, m.eye, 0.14, top(0.14), 0.012, f).scale.setScalar(0.5);
  M.mesh(P.leaf, m.pupil, 0.143, top(0.14) + 0.007, 0.012, f).scale.setScalar(0.34);
  // garnitür: tabağın ön kenarı boyunca
  const l1 = M.mesh(P.lemon, m.lemon, 0.17, 0.03, 0.115, g); l1.rotation.y = 0.5;
  const l2 = M.mesh(P.lemon, m.lemon, 0.12, 0.036, 0.13, g); l2.rotation.set(0.18, -0.3, 0);
  for (const [x, z, ry, k] of [[-0.17, 0.1, 0.4, 0], [-0.13, 0.13, -0.6, 1], [-0.2, 0.06, 1.3, 1], [-0.1, 0.1, 2.2, 0], [-0.16, 0.14, 2.9, 0]]) {
    const lf = M.mesh(P.leaf, m.leaf[k], x, 0.03, z, g); lf.scale.set(1.5, 0.28, 0.6); lf.rotation.set(0, ry, 0.15);
  }
  for (const [x, z] of [[-0.03, 0.135], [0.01, 0.15], [-0.055, 0.155]]) { const r = M.mesh(P.ring, m.onion, x, 0.031, z, g); r.rotation.set(PI / 2 + 0.12, 0, 0); }
  g.userData.h = 0.11;
  return g;
}
ITEMS.balik = { name: 'Balık', price: 9, fn: makeFish };
ITEMS.izgara = { name: 'Izgara balık', price: 28, fn: makePlate };

// ---------- modeller ----------
function makeDeck() {
  const g = new THREE.Group(), w = DECK.x1 - DECK.x0, d = DECK.z1 - DECK.z0, cx = (DECK.x0 + DECK.x1) / 2, cz = (DECK.z0 + DECK.z1) / 2;
  const planks = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), new THREE.MeshStandardMaterial({ map: texRep('wood', w / 1.6, d / 3), roughness: 0.85 }));
  planks.position.set(cx, -0.03, cz); planks.receiveShadow = true; planks.castShadow = true; g.add(planks);
  planks.material.map.offset.set(DECK.x0 / 1.6, -DECK.z1 / 3); // tahtalar dünyaya hizalı: teras ve uzantı (expand-west.js buildDeck) aynı çizgide devam eder
  const dark = M.mat('#6b4a2e', { rough: 0.9 }), rail = M.mat('#a8703f');
  // kazıklar
  for (let x = DECK.x0 + 0.3; x <= DECK.x1; x += 3.2) for (const z of [DECK.z1 - 0.2, (DECK.z0 + DECK.z1) / 2 + 1.5]) M.cyl(0.14, 0.16, 1.4, 8, dark, x, -0.75, z, g);
  for (const x of [DECK.x0 + 0.2, DECK.x1 - 0.2]) for (let z = 33.5; z <= DECK.z1; z += 3.2) M.cyl(0.14, 0.16, 1.4, 8, dark, x, -0.75, z, g);
  // korkuluk: batı, doğu ve güney kenarı (güneyde kayığa inen merdivenin yeri boş)
  const post = (x, z) => M.cyl(0.05, 0.06, 0.95, 6, rail, x, 0.5, z, g);
  for (let z = 32.2; z <= DECK.z1 - 0.1; z += 1.6) { post(DECK.x0 + 0.1, z); post(DECK.x1 - 0.1, z); }
  for (let x = DECK.x0 + 0.1; x <= DECK.x1; x += 1.6) if (Math.abs(x - BOARD.x) > 1.1) post(x, DECK.z1 - 0.1);
  for (const x of [DECK.x0 + 0.1, DECK.x1 - 0.1]) M.rbox(0.08, 0.08, DECK.z1 - 32.1, 0.02, rail, x, 0.95, (32.1 + DECK.z1) / 2, g);
  for (const [a, b] of [[DECK.x0, BOARD.x - 1.1], [BOARD.x + 1.1, DECK.x1]]) M.rbox(b - a, 0.08, 0.08, 0.02, rail, (a + b) / 2, 0.95, DECK.z1 - 0.1, g);
  // kayığa inen merdiven
  for (let k = 0; k < 3; k++) M.rbox(1.2, 0.06, 0.32, 0.02, rail, BOARD.x, -0.12 - k * 0.22, DECK.z1 + 0.2 + k * 0.3, g);
  // girişte tabela
  const s = M.makeSign('🎣 BALIKÇI İSKELESİ', '#2f6db5', 3.4, 0.7); s.position.set(DECK.x0 + 1.6, 0, DECK.z0 + 0.3); s.scale.setScalar(0.85); g.add(s);
  return g;
}
const FISH_SLOTS = (() => { const a = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) a.push(V(-1.05 + c * 1.05, 1.06, -0.4 + r * 0.38)); return a; })();
function makeFishStall() {
  const g = new THREE.Group();
  const wood = M.mat('#ffffff', { map: texRep('wood', 1, 0.6) });
  M.rbox(3.4, 0.9, 1.5, 0.08, wood, 0, 0.45, 0, g);
  M.rbox(3.2, 0.12, 1.3, 0.04, M.mat('#e9f7fc', { rough: 0.2 }), 0, 0.96, 0, g); // buz yatağı
  for (let i = 0; i < 14; i++) M.sph(0.06, M.mat('#ffffff', { rough: 0.1 }), rand(-1.5, 1.5), 1.02, rand(-0.55, 0.55), g, 5, 4);
  // arkada mavi beyaz çizgili tente (yüksekte: kamera tezgahı görür)
  for (const x of [-1.6, 1.6]) M.cyl(0.05, 0.05, 2.5, 6, M.mat('#a8703f'), x, 1.25, -0.7, g);
  for (let i = 0; i < 6; i++) { const st = M.rbox(0.57, 0.05, 1.0, 0.01, M.mat(i % 2 ? '#ffffff' : '#2f6db5'), -1.43 + i * 0.572, 2.42, -0.35, g); st.rotation.x = 0.35; }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.36), new THREE.MeshStandardMaterial({ map: textTex('TAZE BALIK', { bg: '#2f6db5', border: '#ffffff', w: 512, h: 124 }), roughness: 0.6 }));
  sign.position.set(0, 0.62, 0.76); g.add(sign);
  return g;
}
function makeIceChest() {
  const v = esya('buzluk'); // Poly Pizza buz sandığı (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  M.rbox(1.4, 0.55, 1.0, 0.06, M.mat('#f4f8fb', { rough: 0.4 }), 0, 0.28, 0, g);
  M.rbox(1.44, 0.08, 1.04, 0.03, M.mat('#2f6db5'), 0, 0.56, 0, g);
  for (let i = 0; i < 8; i++) M.sph(0.06, M.mat('#dff3fb', { rough: 0.1 }), rand(-0.55, 0.55), 0.6, rand(-0.35, 0.35), g, 5, 4);
  return g;
}
function makeBoat() {
  const g = new THREE.Group();
  const hullM = M.mat('#ffffff', { map: texRep('wood', 0.6, 2) }), paint = M.mat('#2f6db5'), inner = M.mat('#8a5a33');
  const hull = M.sph(0.6, hullM, 0, 0.1, 0, g, 16, 8); hull.scale.set(1.05, 0.55, 2.4); // tekne gövdesi
  const cut = M.rbox(1.2, 0.05, 2.6, 0.03, inner, 0, 0.36, 0, g); cut.castShadow = false;
  const band = M.sph(0.61, paint, 0, 0.16, 0, g, 16, 6); band.scale.set(1.06, 0.18, 2.42);
  for (const z of [-0.5, 0.45]) M.rbox(1.1, 0.06, 0.24, 0.02, inner, 0, 0.42, z, g); // oturaklar
  for (const sx of [-1, 1]) { const o = M.cyl(0.025, 0.025, 1.7, 6, M.mat('#c9a35a'), sx * 0.62, 0.46, 0.1, g); o.rotation.x = PI / 2; o.rotation.z = sx * 0.25; }
  g.userData.seat = V(0, 0.42, -0.45);
  return g;
}
function makeGrill() {
  const g = new THREE.Group();
  M.rbox(1.3, 0.8, 0.8, 0.05, M.mat('#b5643c', { map: texRep('brick', 1, 0.5) }), 0, 0.4, 0, g);
  M.rbox(1.2, 0.06, 0.7, 0.02, M.mat('#2a2a2a', { rough: 0.5 }), 0, 0.84, 0, g);
  for (let i = 0; i < 6; i++) M.rbox(0.03, 0.03, 0.68, 0.01, M.mat('#555555'), -0.5 + i * 0.2, 0.89, 0, g);
  const ember = M.rbox(1.0, 0.03, 0.5, 0.01, M.mat('#ff7a2a', { emissive: '#ff5a00', ei: 0.8 }), 0, 0.81, 0, g); ember.castShadow = false;
  g.userData.ember = ember;
  return g;
}
function makeTable() {
  const g = new THREE.Group();
  const wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.6) });
  M.cyl(0.55, 0.55, 0.06, 18, wood, 0, 0.76, 0, g);
  M.cyl(0.06, 0.08, 0.74, 8, M.mat('#6b4a2e'), 0, 0.37, 0, g);
  M.cyl(0.04, 0.04, 0.02, 10, M.mat('#c0392b'), 0, 0.8, 0, g); // masa örtüsünün süsü
  for (const sx of [-1, 1]) {
    M.rbox(0.5, 0.06, 0.5, 0.02, wood, sx * 0.85, 0.45, 0, g);
    M.rbox(0.06, 0.55, 0.5, 0.02, wood, sx * 1.08, 0.72, 0, g);
    for (const dz of [-0.2, 0.2]) M.cyl(0.03, 0.03, 0.45, 6, M.mat('#6b4a2e'), sx * 0.85, 0.22, dz, g);
  }
  return g;
}

// ---------- olta yeri: oyuncu durunca şamandıra iner, arada bir balık sırtına uçar ----------
class RodSpot extends Station {
  constructor(F, instant) {
    super(ROD_P.x, ROD_P.z, 1.8, 1.2, { instant });
    this.F = F; this.next = 2.5;
    this.bobber = new THREE.Group();
    M.sph(0.09, M.mat('#e8473c'), 0, 0, 0, this.bobber, 8, 6); M.sph(0.091, M.mat('#ffffff'), 0, 0.03, 0, this.bobber, 8, 3);
    this.bobber.visible = false; G.scene.add(this.bobber);
    this.rod = M.cyl(0.015, 0.022, 1.8, 6, M.mat('#5a3a22'), 0.25, 1.15, 0.6, null);
    this.rod.rotation.x = 0.85;
  }
  update(dt) {
    const on = this.inside && G.stack && !G.stack.full;
    this.bobber.visible = on;
    if (on && this.rod.parent !== G.player) G.player.add(this.rod);
    if (!on && this.rod.parent) this.rod.parent.remove(this.rod);
    if (!on) { this.t = 0; return; }
    const bx = ROD_P.x + 0.2, bz = DECK.z1 + 2.0;
    this.bobber.position.set(bx, -0.18 + Math.sin(G.time * 3) * 0.03, bz);
    this.t += dt;
    if (this.t < this.next) return;
    this.t = 0; this.next = rand(2.6, 4.2);
    const it = makeItem('balik'); it.position.set(bx, -0.1, bz); G.scene.add(it);
    G.stack.push('balik', it, 0.45);
    ring(V(bx, -0.12, bz), '#ffffff', 0.9); sfx('pop');
    this.bobber.position.y -= 0.12;
  }
}

// ---------- restoran masası: iki sandalye, oturan müşteri ızgara balık bekler ----------
class Table extends Station {
  constructor(F, x, z, instant) {
    super(x, z, 2.6, 1.8, { instant });
    this.F = F; this.x = x; this.z = z;
    this.col = [x - 0.6, x + 0.6, z - 0.6, z + 0.6];
    this.bodyFn = () => [this.col];
    this.seats = [-1, 1].map((sx) => ({ p: V(x + sx * 0.85, 0, z), ry: sx > 0 ? -PI / 2 : PI / 2, c: null }));
  }
  waiting() { return this.seats.filter((s) => s.c && s.c.state === 'order' && !s.c.served); }
  needs() { return this.waiting().length; }
  servePoint() { return V(this.x + rand(-0.3, 0.3), 0, this.z - 1.0); }
  putFrom(stack) {
    let s = null, it = null;
    for (const w of this.waiting()) { it = stack.takeOf([w.c.want || 'izgara']); if (it) { s = w; break; } } // müşteri ızgara ya da balık çorbası ister
    if (!it) return false;
    s.c.served = true; s.c.plate = it.obj;
    fly(it.obj, this.F.R.content, V(this.x + (s.p.x - this.x) * 0.45, 0.8, this.z), 0.3, 0.9);
    sfx('pop', { npc: stack !== G.stack });
    s.c.clearBubble(); s.c.setBubbleText('😋');
    return true;
  }
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.2) { this.t = 0; this.putFrom(G.stack); }
  }
}

export function setupIskele(R, T) {
  const C = R.content, { put, rcol, hint, icon } = T;
  const F = (G.fish = { R, tables: [], customers: 0, spawnT: 3, restT: 6, boat: null });
  put(C, makeDeck(), 0, 0, 0);
  // korkuluk engelleri (merdiven boşluğu dahil kapalı: balıkçı kayığa kendi yolundan iner)
  rcol(R, DECK.x0 - 0.1, DECK.x0 + 0.25, 32.0, DECK.z1); rcol(R, DECK.x1 - 0.25, DECK.x1 + 0.1, 32.0, DECK.z1); rcol(R, DECK.x0, DECK.x1, DECK.z1 - 0.25, DECK.z1 + 0.1);
  F.rodAt = (n) => V(-33.4 + n * 1.3, 0, 42.6);
  F.board = V(BOARD.x, 0, BOARD.z);
  F.boatHome = V(BOAT_HOME.x, 0, BOAT_HOME.z);
  F.seaSpot = () => V(rand(-43, -19), 0, rand(52, 60));
  R.activate = (instant) => {
    // iskelenin üstü yürünür (suyun üstündeki yol), korkuluklar kenarı kapatır
    (G.walkways || (G.walkways = [])).push([DECK.x0 + 0.2, DECK.x1 - 0.2, DECK.z0, DECK.z1 - 0.2]);
    const st = put(C, makeFishStall(), STALL.x, 0, STALL.z, PI); if (!instant) popIn(st);
    rcol(R, STALL.x - 1.7, STALL.x + 1.7, STALL.z - 0.75, STALL.z + 0.75);
    F.stall = new Shelf({ zx: STALL.x, zz: STALL.z + 1.85, zw: 3.4, zd: 1.4, accepts: () => ['balik'], cap: 9, group: st, slots: FISH_SLOTS, instant,
      spots: [V(STALL.x - 1.1, 0, STALL.z - 2.1), V(STALL.x, 0, STALL.z - 2.1), V(STALL.x + 1.1, 0, STALL.z - 2.1)] });
    const ch = put(C, makeIceChest(), CRATE.x, 0, CRATE.z); if (!instant) popIn(ch);
    rcol(R, CRATE.x - 0.75, CRATE.x + 0.75, CRATE.z - 0.55, CRATE.z + 0.55);
    F.crate = new Generator(C, { type: 'balik', interval: 1e9, max: 18, origin: V(CRATE.x, 1.0, CRATE.z + 2), tray: [CRATE.x, 0.62, CRATE.z], zx: CRATE.x, zz: CRATE.z + 1.3, zw: 1.8, zd: 1.2, instant });
    F.crate.canMake = () => false;
    // buzlu kasaya balık bırakma (oyuncu değince ve balıkçı): tezgah dolunca fazlası burada bekler
    F.crate.putFrom = (stack) => {
      const g = F.crate;
      if (g.items.length >= g.max) return false;
      const it = stack.takeOf(['balik']);
      if (!it) return false;
      g.items.push(it.obj); fly(it.obj, g.tray, g.slot(g.items.length - 1), 0.25, 0.9);
      sfx('pop', { npc: stack !== G.stack });
      return true;
    };
    // kasa tezgahın kendi ucunda (doğu): yazarkasa arkada, para üstünde; balıkçı kasiyeri (DESKS ka_iskele) arkasında durur
    const ledge = M.makeCashLedge(0.75, 1.5, 0.9); ledge.position.set(-2.08, 0, 0); st.add(ledge); if (!instant) popIn(ledge);
    M.faceRegister(ledge.userData.register, -26.12, 35.0); // ekran kasiyerin durduğu yere
    F.pile = new MoneyPile(C, -33.12, 33.35, 0.92, { instant, desk: false, body: rcol(R, -33.5, -32.74, 32.85, 34.35), spot: [-33.12, 35.0, PI],
      look: { shirt: '#2f6db5', pants: '#2a2a2a', hat: 'cap', hatColor: '#ffffff', skin: '#c68e5f', mustache: true } });
    R.pile = F.pile; // kasiyer (upgrades.js DESKS ka_iskele) buradan bulur
    F.rod = new RodSpot(F, instant);
    // olta yerinde kova ve yem kutusu
    const kova = new THREE.Group(); M.cyl(0.2, 0.16, 0.34, 12, M.mat('#8fa3b0', { rough: 0.4 }), 0, 0.17, 0, kova); M.rbox(0.36, 0.14, 0.24, 0.02, M.mat('#c0392b'), 0.42, 0.07, 0.05, kova);
    put(C, kova, ROD_P.x - 1.05, 0, ROD_P.z + 0.15);
    F.boat = put(C, makeBoat(), BOAT_HOME.x, -0.18, BOAT_HOME.z);
    hint(STALL.x, 3.0, STALL.z, icon('balik'), 'Balık tezgahı', 'Tuttuğun balığı arkadan diz; müşteri önden gelip alır, parası yandaki kasada birikir.', 4);
    hint(CRATE.x, 1.9, CRATE.z, icon('balik'), 'Buzlu kasa', 'Tezgah dolunca balığı buraya bırak; ızgara ve elemanlar buradan alır.', 3);
    hint(ROD_P.x, 1.9, ROD_P.z, '🎣', 'Olta yeri', 'Burada dur: şamandıra suya iner, balık tuttukça sırtına gelir.', 3);
    hint(BOAT_HOME.x, 1.6, BOAT_HOME.z, '🛶', 'Balıkçı kayığı', 'Yükseltmeler → Balıkçı İskelesi → Balıkçı teknesi: balıkçı kayıkla açığa çıkıp ağla çok balık getirir.', 4);
  };
  // restoran: dört masa ve ızgara (kilit 'b2')
  // restoran terası (genişletme, expand-west.js): masa ekler, müşteriler boş sandalyeye oturur
  F.addTable = (x, z, instant) => { const t = new Table(F, x, z, instant); const m = put(C, makeTable(), x, 0, z); if (!instant) popIn(m); rcol(R, ...t.col); F.tables.push(t); return t; };
  R.addRestaurant = (instant) => {
    for (const [x, z] of TABLES) {
      const tb = put(C, makeTable(), x, 0, z); if (!instant) popIn(tb);
      const t = new Table(F, x, z, instant); rcol(R, ...t.col); F.tables.push(t);
    }
    const gr = put(C, makeGrill(), -28.0, 0, 38.6); if (!instant) popIn(gr);
    rcol(R, -28.7, -27.3, 38.2, 39.0);
    for (const x of [-29.6, -26.4]) { put(C, crate(0.9, 0.78, 0.7, '#a8703f'), x, 0.39, 38.6); rcol(R, x - 0.45, x + 0.45, 38.25, 38.95); }
    F.grillObj = gr;
    F.grill = new Converter(C, { inType: 'balik', inCap: 6, ix: -29.6, iz: 37.3, iw: 1.4, id: 1.1, inTray: [-29.6, 0.8, 38.6], instant,
      out: { type: 'izgara', interval: 3.2, max: 8, origin: V(-28.0, 1.2, 38.6), tray: [-26.4, 0.8, 38.6], zx: -26.4, zz: 37.3, zw: 1.4, zd: 1.1 } });
    R.gens = { izgara: F.grill.out };
    const sign = M.makeSign('🐟 BALIK RESTORANI', '#c0392b', 3.4, 0.7); sign.scale.setScalar(0.8); put(C, sign, -27.0, 0, 41.8, PI);
    hint(-28.0, 2.3, 38.6, `${icon('balik')}→${icon('izgara')}`, 'Izgara', 'Balığı soldaki masaya bırak, ızgara pişirir; tabağı sağdaki masadan al, bekleyen masaya götür.', 3.4);
    F.restT = 3;
  };
  R.update = (dt) => update(F, dt);
  return R;
}

// ---------- müşteriler ----------
function spawnBuyer(F) {
  const spot = F.stall.spots.find((s) => !s.c);
  if (!spot) return;
  const c = new Customer(ENTRY.clone().setZ(LANE + rand(-0.2, 0.2)), 'iskele', Math.random() < 0.5 ? M.villagerLook() : M.townLook());
  maybeRush(c, 0.15);
  spot.c = c;
  const want = 'balik', need = 1 + Math.floor(Math.random() * 3), patience = 30 * pat(c);
  c.got = 0; c.bill = 0; c.want = want;
  c.go(V(spot.p.x, 0, LANE), spot.p);
  c.state = 'come';
  c.setBubble(want, need);
  const leave = () => { spot.c = null; c.clearBubble(); c.leaving = true; c.state = 'leave'; c.path = [V(spot.p.x, 0, LANE + 0.3), ENTRY.clone().setZ(LANE + 0.3)]; };
  c.think = (dt) => {
    switch (c.state) {
      case 'come': if (c.walk(dt)) { c.state = 'buy'; c.wait = 0; c.t = 0; } break;
      case 'buy': {
        c.face(PI, dt);
        c.wait += dt; c.t += dt;
        c.setPatience(1 - c.wait / patience);
        if (c.t > 0.4) {
          c.t = 0;
          const obj = c.got < need && F.stall.takeType(want);
          if (obj) {
            const pay = Math.round(ITEMS[want].price * mult()); c.stack.push(want, obj, 0.3); c.got++; c.bill += pay; G.stats.sold++; if (c.got === 1) G.stats.customers++;
            F.pile.add(pay, c.obj.position); floatText(c.obj.position, `+${pay} ₺`, 'pos'); sfx('cash', { at: c.obj.position });
            c.setBubble(want, Math.max(1, need - c.got));
          }
        }
        if (c.got >= need || c.wait > patience) { c.mood(c.got > 0); leave(); }
        break;
      }
      case 'leave': if (c.walk(dt)) c.destroy(); break;
    }
  };
}
// restoran müşterisi: boş sandalyeye oturur, ızgara balık ister; tabak gelince yer, öder, kalkar
function spawnDiner(F) {
  const free = F.tables.flatMap((t) => t.seats.filter((s) => !s.c).map((s) => ({ t, s })));
  if (!free.length) return;
  const { t, s } = pick(free);
  const c = new Customer(ENTRY.clone().setZ(LANE + rand(-0.2, 0.2)), 'iskele', M.townLook());
  maybeRush(c, 0.12);
  s.c = c;
  const patience = 75 * pat(c);
  c.go(V(s.p.x, 0, LANE), V(s.p.x, 0, t.z - 1.0), s.p);
  c.state = 'come'; c.want = F.menu && F.menu.length && Math.random() < 0.45 ? pick(F.menu) : 'izgara'; // balık çorbası (genişletme) da istenir
  // oturunca bacaklar kırılır (taban güncellemesinden sonra)
  const base = c.update.bind(c);
  c.update = (dt2) => { base(dt2); if (c.sit) { c.obj.position.y = 0.12; for (const l of c.obj.userData.legs) l.rotation.x = -1.35; } };
  const leave = () => {
    c.sit = false; c.obj.position.y = 0; s.c = null; c.clearBubble(); c.leaving = true; c.state = 'leave';
    if (c.plate && c.plate.parent) c.plate.parent.remove(c.plate);
    c.path = [V(s.p.x, 0, t.z - 1.0), V(s.p.x, 0, LANE + 0.3), ENTRY.clone().setZ(LANE + 0.3)];
  };
  c.think = (dt) => {
    switch (c.state) {
      case 'come':
        if (c.walk(dt)) { c.state = 'order'; c.sit = true; c.wait = 0; c.obj.rotation.y = s.ry; c.setBubble(c.want, 1); }
        break;
      case 'order':
        c.face(s.ry, dt);
        if (c.served) { c.state = 'eat'; c.t = 0; break; }
        c.wait += dt;
        c.setPatience(1 - c.wait / patience);
        if (c.wait > patience) { c.mood(false); leave(); }
        break;
      case 'eat':
        c.face(s.ry, dt);
        c.t += dt;
        if (c.t > 5) {
          const pay = Math.round(ITEMS[c.want].price * mult());
          F.pile.add(pay, c.obj.position); floatText(c.obj.position, `+${pay} ₺`, 'pos'); sfx('cash', { at: c.obj.position });
          G.stats.sold++; G.stats.customers++;
          c.mood(true); leave();
        }
        break;
      case 'leave': if (c.walk(dt)) c.destroy(); break;
    }
  };
}

function update(F, dt) {
  if (!F.stall) return;
  const n = G.customers.filter((c) => c.region === 'iskele' && !c.leaving && c.want === 'balik').length;
  F.spawnT -= dt * repMul();
  if (F.spawnT <= 0 && n < 3) { F.spawnT = rand(6, 10); if (F.stall.count() || Math.random() < 0.3) spawnBuyer(F); }
  if (F.tables.length) {
    F.restT -= dt * repMul();
    if (F.restT <= 0) { F.restT = rand(9, 15); spawnDiner(F); }
    if (F.grillObj) F.grillObj.userData.ember.material.emissiveIntensity = F.grill.input.length ? 0.7 + Math.sin(G.time * 9) * 0.25 : 0.15;
  }
  // bağlı kayık dalgayla iner kalkar (balıkçı binmediyse)
  if (F.boat && !F.boat.busy) { F.boat.position.y = -0.18 + Math.sin(G.time * 1.4) * 0.05; F.boat.rotation.z = Math.sin(G.time * 1.1) * 0.04; }
}
