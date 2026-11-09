// Yol kenarı benzinlik: ana yolun batı girişinde, yolun güneyinde (denizden uzak). Yakıt pompaları, market ve parayla
// açılan Bemis E-V Charge şarj istasyonu. Arabalar ana yolun doğuya giden şeridinden girer, batıya giden şeridinden çıkar.
// Benzinlik baştan durur ve içinde yürünür. Şarj üniteleri kilitle açılır (e1: iki DC hızlı şarj, e2: iki AC şarj).
// Benzinli arabalar pompalarda yakıt alır, elektrikliler şarj olur; ikisi de parasını yığına bırakıp yoluna devam eder.
import { CUST_RATE } from './rating.js';
import * as THREE from 'three';
import * as M from './models.js';
import { texRep, textTex } from './tex.js';
import { G, popIn } from './game.js';
import { toKasa } from './account.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const RED = '#c8102e', GREEN = '#46d36b';
const ROAD_Z = -17.4, ROAD_OUT = -19.8, FAR_X = -140; // ana yolun şeritleri ve batıdaki uç (events.js ROAD_FAR; carsi.js ve events.js arabalarıyla aynı)

// Bemis logosu: kırmızı sekiz köşeli rozet içinde beyaz B, yanında kırmızı "bemis"
function bemisLogo(bg = '#ffffff', w = 512, h = 160) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const r = h * 0.34, cx = h * 0.5, cy = h / 2;
  g.fillStyle = RED;
  for (const a of [0, PI / 4]) { g.save(); g.translate(cx, cy); g.rotate(a); g.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); g.restore(); }
  g.fillStyle = '#ffffff'; g.font = `bold ${h * 0.46}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('B', cx, cy + h * 0.02);
  g.fillStyle = bg === '#ffffff' ? RED : '#ffffff'; g.font = `${h * 0.56}px Georgia, serif`; g.textAlign = 'left';
  g.fillText('bemis', cx + r + h * 0.18, cy + h * 0.02);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const plane = (w, h, map, x, y, z, parent, ry = 0) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
  return m;
};

// Bemis BEVDC 120: beyaz dolap, kırmızı logo, gri orta panel ve ekran, yeşil ışıklı iki tabanca yuvası, iki yanda kablo
function makeBemisDC(logo) {
  const g = new THREE.Group();
  const white = M.mat('#f4f5f6', { rough: 0.35 }), grey = M.mat('#80868c', { rough: 0.5 }), dark = M.mat('#2b2f33'), black = M.mat('#1b1d20', { rough: 0.75 });
  const led = new THREE.MeshBasicMaterial({ color: GREEN });
  M.rbox(1.15, 0.12, 0.7, 0.03, M.mat('#c9ccd0'), 0, 0.06, 0, g);
  M.rbox(1.0, 1.95, 0.55, 0.06, white, 0, 1.08, 0, g);
  for (const s of [-1, 1]) { const ch = M.rbox(0.3, 0.3, 0.55, 0.04, white, s * 0.4, 2.0, 0, g); ch.rotation.z = s * PI / 4; ch.scale.set(1, 0.6, 1); }
  M.rbox(0.62, 0.2, 0.55, 0.04, white, 0, 2.05, 0, g);
  for (const x of [-0.28, 0.28]) { M.cyl(0.025, 0.025, 0.14, 6, grey, x, 2.2, 0, g); const eye = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 10), grey); eye.position.set(x, 2.3, 0); g.add(eye); }
  plane(0.82, 0.26, logo, 0, 1.74, 0.281, g);
  M.rbox(0.5, 1.05, 0.04, 0.02, grey, 0, 0.98, 0.28, g);
  M.rbox(0.38, 0.26, 0.02, 0.01, dark, 0, 1.28, 0.302, g);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), new THREE.MeshBasicMaterial({ color: '#cfe9ff' }));
  screen.position.set(0, 1.28, 0.314); g.add(screen);
  M.rbox(0.14, 0.08, 0.02, 0.01, dark, 0, 1.08, 0.305, g);
  for (const x of [-0.13, 0.13]) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.17, 0.03), led); rim.position.set(x, 0.66, 0.3); g.add(rim);
    M.rbox(0.09, 0.13, 0.07, 0.02, black, x, 0.66, 0.33, g);
  }
  for (const x of [-0.42, 0.42]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.95, 0.02), led); l.position.set(x, 1.0, 0.285); g.add(l); }
  // kalın siyah kablolar: tabancadan yere sarkıp yana dolanır, gövdenin yanına asılır
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([V(s * 0.13, 0.66, 0.37), V(s * 0.42, 0.42, 0.48), V(s * 0.62, 0.07, 0.32), V(s * 0.6, 0.55, 0.05), V(s * 0.52, 1.25, -0.02)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(c, 28, 0.032, 6), black));
  }
  g.userData = { led, screen };
  return g;
}
// Bemis Charger Pro 2: direğe takılı duvar tipi AC cihaz; koyu çerçeve, krem ön yüz, ekran, yuvarlak soket
function makeBemisAC(logo) {
  const g = new THREE.Group();
  M.cyl(0.06, 0.07, 1.25, 8, M.mat('#c9ccd0'), 0, 0.62, 0, g);
  M.rbox(0.44, 0.62, 0.15, 0.13, M.mat('#3a3f45'), 0, 1.38, 0.07, g);
  M.rbox(0.35, 0.53, 0.04, 0.11, M.mat('#f1ede4'), 0, 1.38, 0.15, g);
  plane(0.26, 0.08, logo, 0, 1.58, 0.172, g);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.13), new THREE.MeshBasicMaterial({ color: '#9fd3ff' })); scr.position.set(0, 1.44, 0.172); g.add(scr);
  const sock = M.cyl(0.07, 0.07, 0.04, 14, M.mat('#2b2f33'), 0, 1.22, 0.17, g); sock.rotation.x = PI / 2;
  g.userData = { screen: scr };
  return g;
}
function makePump() {
  const g = new THREE.Group();
  M.rbox(0.7, 1.55, 0.45, 0.06, M.mat('#ffffff'), 0, 0.78, 0, g);
  M.rbox(0.72, 0.28, 0.47, 0.05, M.mat(RED), 0, 1.45, 0, g);
  for (const z of [0.235, -0.235]) M.rbox(0.42, 0.26, 0.02, 0.01, M.mat('#1f2a33'), 0, 1.08, z, g);
  for (const s of [-1, 1]) { M.rbox(0.08, 0.22, 0.12, 0.02, M.mat('#2b2f33'), s * 0.39, 0.85, 0, g); M.cyl(0.02, 0.02, 0.6, 5, M.mat('#2b2f33'), s * 0.42, 0.45, 0.1, g); }
  return g;
}
// fiyat direği: uzaktan görünen kırmızı pano
function priceBoard() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 512);
  g.fillStyle = RED; g.fillRect(0, 0, 256, 150);
  g.fillStyle = '#ffffff'; g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.fillText('bemis', 128, 80);
  g.font = 'bold 28px sans-serif'; g.fillText('ENERJİ', 128, 125);
  const rows = [['⚡ DC 120 kW', GREEN], ['⚡ AC 22 kW', GREEN], ['BENZİN', '#2b2f33'], ['MOTORİN', '#2b2f33']];
  rows.forEach(([t, col], i) => { g.fillStyle = col; g.font = 'bold 34px sans-serif'; g.fillText(t, 128, 210 + i * 80); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const bays = [];
window.__stationBays = () => bays; // test kancası: park yerleri ve arabaları (denetim/benzinyol.mjs)
let S = null, logoW = null, lot = null, lockL = null, lockEl = null, open = false;
const lockFn = (v) => v.set(-74, 1.5, -8.3);
const SHUT = []; // benzinlik açılınca etkinleşen engeller
const col = (minX, maxX, minZ, maxZ) => { const c = [minX, maxX, minZ, maxZ]; (open ? G.colliders : SHUT).push(c); };
// açılınca yürünen yer: avlu (kuzey kenarı ana yolun yürüyüşüne biner)
const YARD = [[-84.5, -62.6, -15.8, -1.8]];
export function buildStation() {
  S = new THREE.Group();
  S.visible = false; // kilitli: yalnızca "kilitli" yazısı görünür
  G.scene.add(S);
  logoW = bemisLogo('#ffffff');
  const logoR = bemisLogo(RED);
  // zemin: asfalt alan, yoldan iki giriş. 2026-11-06 kullanıcı: "bemis benzinlikte zemini siyah kalmış": koyu asfalt doku kilitliyken siyah
  // görünüyordu; diğer bölgelerde olduğu gibi zemin açılınca gelir, kilitliyken çimen kalır
  lot = new THREE.Mesh(new THREE.PlaneGeometry(21, 13), new THREE.MeshStandardMaterial({ map: texRep('asphalt', 7, 4.4), roughness: 0.9, color: '#8e939a' }));
  lot.rotation.x = -PI / 2; lot.position.set(-74, -0.035, -8.3); lot.receiveShadow = true; lot.visible = false; G.scene.add(lot);
  const el = document.createElement('div');
  el.className = 'lock';
  el.textContent = 'Bemis Benzinlik · kilitli';
  lockEl = el; lockL = G.labels.add(el, lockFn);
  // akaryakıt kanopisi: kırmızı-beyaz saçaklı çatı, iki pompa adası
  for (const x of [-81.4, -74.6]) for (const z of [-11.8, -8.0]) M.cyl(0.14, 0.14, 3.6, 10, M.mat('#e9ecef'), x, 1.8, z, S);
  M.rbox(8.4, 0.35, 5.4, 0.08, M.mat('#ffffff'), -78, 3.75, -9.9, S);
  M.rbox(8.6, 0.55, 5.6, 0.06, M.mat(RED), -78, 3.4, -9.9, S);
  plane(4.2, 0.5, textTex('BEMIS ENERJİ', { bg: RED, fg: '#ffffff', w: 1024, h: 120 }), -78, 3.4, -7.09, S);
  plane(2.1, 0.5, logoR, -78, 3.4, -12.71, S, PI);
  for (const x of [-80.2, -75.8]) {
    M.rbox(1.2, 0.18, 3.4, 0.05, M.mat('#cfd3d7'), x, 0.09, -9.9, S);
    for (const z of [-10.8, -9.0]) { const p = makePump(); p.position.set(x, 0.18, z); S.add(p); }
  }
  // market
  M.rbox(5.4, 3.0, 3.6, 0.08, M.mat('#ffffff'), -80.8, 1.5, -3.8, S);
  M.rbox(5.6, 0.4, 3.8, 0.05, M.mat(RED), -80.8, 3.1, -3.8, S); // çatı kenarında kırmızı şerit
  M.rbox(3.4, 1.6, 0.06, 0.03, M.mat('#9fd8f5', { rough: 0.15 }), -80.8, 1.2, -5.61, S);
  plane(3.6, 0.6, textTex('MARKET', { bg: RED, fg: '#ffffff', w: 512, h: 90 }), -80.8, 2.55, -5.62, S);
  // fiyat direği ana yolun kenarında
  M.cyl(0.12, 0.12, 5.2, 8, M.mat('#c9ccd0'), -63.2, 2.6, -15.0, S); // DC şarja giren arabaların yolunun dışında
  M.rbox(1.6, 3.0, 0.25, 0.06, M.mat('#ffffff'), -63.2, 5.0, -15.0, S);
  plane(1.5, 2.9, priceBoard(), -63.2, 5.0, -14.87, S);
  shadows(S);
  // içinde yürünür: kanopi direkleri, pompa adaları, market ve direk engel
  for (const x of [-81.4, -74.6]) for (const z of [-11.8, -8.0]) col(x - 0.16, x + 0.16, z - 0.16, z + 0.16);
  for (const x of [-80.2, -75.8]) col(x - 0.6, x + 0.6, -11.6, -8.2);
  col(-83.5, -78.1, -5.6, -2.0);
  col(-63.35, -63.05, -15.15, -14.85);
}
function shadows(o) { o.traverse((m) => { if (m.isMesh && !(m.material instanceof THREE.MeshBasicMaterial) && m.geometry.type !== 'PlaneGeometry') m.castShadow = true; }); }

// seviyesi gelmeyen benzinliğin kilit yazısı görünmez; seviyesi gelince ortaya çıkar (world.js revealAreas)
export function setStationRevealed(v, instant) {
  G.stationRevealed = v;
  if (open || !lot) return;
  if (v && !lockL) lockL = G.labels.add(lockEl, lockFn); else if (!v && lockL) { G.labels.remove(lockL); lockL = null; }
}
// açılış kilidi (e0) yerinde değilken benzinliğin adı yazmaz (world.js nameAreas)
let named = null;
export function setStationNamed(on) {
  if (named === on || !lockEl) return;
  named = on; lockEl.textContent = on ? 'Bemis Benzinlik · kilitli' : '🔒 Kilitli';
}
// kilit açılınca (e0): benzinlik kurulur, avlusunda yürünür
export function openStation(instant) {
  if (open) return;
  open = true; G.stationOpen = true;
  lot.material.color.set('#ffffff'); lot.visible = true; if (!instant) popIn(lot);
  S.visible = true;
  if (lockL) { G.labels.remove(lockL); lockL = null; }
  for (const c of SHUT) G.colliders.push(c);
  G.walkways.push(...YARD);
  addFuelBays(instant);
  if (!instant) { let d = 0; for (const ch of S.children) { if (ch.isMesh && ch.geometry.type === 'PlaneGeometry') continue; popIn(ch, d); d += 0.012; } }
}
const appear = (o, instant, d = 0) => { S.add(o); shadows(o); if (!instant) popIn(o, d); return o; };

// şarj parası yığını: DC ile AC arasındaki boşlukta

// akaryakıt: araba ana yoldan pompanın yanına girer, hortum takılır, depo dolunca parasını yığına bırakır,
// geri geri çıkıp yola döner. İki yer: iki ada arası (doğudaki pompa) ve batı adanın dışı
const PUMP_LANES = [
  { x: -78, hose: [V(-76.2, 1.03, -10.8), V(-76.7, 0.3, -10.6), V(-77.25, 0.72, -10.4)] },
  { x: -83.1, hose: [V(-80.6, 1.03, -9.0), V(-81.3, 0.3, -9.2), V(-82.0, 0.72, -9.4)] }, // kanopi direklerinin dışında
];
function addFuelBays(instant) {
  for (const [k, l] of PUMP_LANES.entries()) {
    const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(l.hose), 16, 0.03, 6), M.mat('#1b1d20'));
    hose.visible = false; S.add(hose);
    bays.push({ fuel: true, x: l.x, z: -9.9, pay: 12, car: null, state: 'empty', t: (instant ? 3 : 2) + k * 7, cable: hose, path: [],
      enter: () => [V(l.x, 0, ROAD_Z), V(l.x, 0, -9.9)],
      leave: () => [V(l.x, 0, -13.8), V(l.x - 2.4, 0, ROAD_OUT), V(FAR_X, 0, ROAD_OUT)] }); // kanopi direğinden uzakta döner
  }
}

// kilit açılınca: 'dc' iki hızlı şarj ünitesi + pano, 'ac' marketin yanında iki duvar tipi şarj
export function addCharging(kind, instant) {
  // eski kayıt: şarj açık ama benzinlik kilidi kayıtta yoksa benzinlik de açılmış sayılır
  if (!open) { openStation(instant); G.unlocked.add('e0'); }
  if (kind === 'dc') {
    // Bemis E-V Charge (2026-10-28 düzeni: eskiden üniteler yol ile park yeri arasındaydı, arabalar içlerinden geçiyordu):
    // iki park yerinin arasındaki adada sırt sırta iki ünite, ekranı yandan arabaya bakar. Araba yoldan dümdüz girer, geri geri
    // çıkar. Pano adanın kuzey ucundaki direkte, iki arabanın üstünde (araba yolunda direk yok)
    const sign = new THREE.Group(), ISL = -67.2;
    M.cyl(0.09, 0.09, 3.1, 8, M.mat('#c9ccd0'), ISL, 1.55, -10.45, sign);
    M.rbox(6.4, 0.7, 0.12, 0.04, M.mat('#1f2a33'), ISL, 2.85, -10.45, sign);
    plane(5.4, 0.6, textTex('bemis  E-V CHARGE', { bg: '#1f2a33', fg: GREEN, w: 1024, h: 110 }), ISL, 2.85, -10.38, sign);
    M.rbox(1.0, 0.15, 3.2, 0.05, M.mat('#cfd3d7'), ISL, 0.075, -9.0, sign); // ada
    appear(sign, instant);
    col(ISL - 0.5, ISL + 0.5, -10.6, -7.4);
    for (const [k, x] of [-68.9, -65.5].entries()) {
      const side = k ? 1 : -1, uz = k ? -8.35 : -9.65; // batıdaki araba adanın batısında, ünitesi batıya bakar
      const dc = appear(makeBemisDC(logoW), instant, 0.1 + k * 0.1); dc.position.set(ISL, 0.15, uz); dc.rotation.y = side * PI / 2;
      col(ISL - 0.35, ISL + 0.35, uz - 0.55, uz + 0.55);
      paintBay(x, -9.0, 4.4);
      // şarj kablosu: araba bağlıyken görünür (ünitenin yan yuvasından arabanın yanına)
      const px = ISL + side * 0.35, cx = x - side * 1.0;
      const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(px, 0.81, uz - side * 0.13), V((px + cx) / 2, 0.3, uz - side * 0.05), V(cx, 0.6, -9.0)]), 20, 0.035, 6), M.mat('#1b1d20'));
      cable.visible = false; S.add(cable);
      bays.push({ x, z: -9.0, pay: 28, revOut: 1, lane: 'dc', tag: k ? 'dc2' : 'dc1', car: null, state: 'empty', t: (instant ? 4 : 2) + k * 9, cable, led: dc.userData.led, screen: dc.userData.screen, path: [],
        enter: () => [V(x, 0, ROAD_Z), V(x, 0, -9.0)], leave: () => [V(x, 0, -13.4), V(x - 2.4, 0, ROAD_OUT), V(FAR_X, 0, ROAD_OUT)] });
    }
  } else {
    // Bemis Charger Pro 2: avlunun güney kenarında direğe takılı. Şerit (x -73,2) iki park yerinin arasından iner: araba yanından
    // geçerken öbür park yerindeki arabaya değmez. Burnu üniteye dönük park eder, geri geri çıkar
    const LANE = -73.2;
    for (const [k, x] of [-75.4, -71.0].entries()) {
      const ac = appear(makeBemisAC(logoW), instant, k * 0.1); ac.position.set(x, 0, -1.95); ac.rotation.y = PI;
      col(x - 0.16, x + 0.16, -2.1, -1.8);
      paintBay(x, -4.4, 4.2);
      const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x, 1.22, -2.15), V(x + 0.15, 0.5, -2.3), V(x + 0.3, 0.75, -2.45)]), 16, 0.03, 6), M.mat('#1b1d20'));
      cable.visible = false; S.add(cable);
      const ledMat = ac.userData.screen.material;
      const east = k === 1;
      bays.push({ x, z: -4.5, pay: 16, revOut: 1, lane: 'ac', tag: east ? 'ac2' : 'ac1', car: null, state: 'empty', t: (instant ? 7 : 3) + k * 11, cable, led: ledMat.color, screen: null, path: [],
        enter: east ? () => [V(x, 0, ROAD_Z), V(x, 0, -4.5)] : () => [V(LANE, 0, ROAD_Z), V(LANE, 0, -6.0), V(x, 0, -5.4), V(x, 0, -4.5)],
        leave: east ? () => [V(x, 0, -13.4), V(x - 2.4, 0, ROAD_OUT), V(FAR_X, 0, ROAD_OUT)] : () => [V(x, 0, -5.4), V(LANE, 0, -6.0), V(LANE, 0, ROAD_OUT), V(FAR_X, 0, ROAD_OUT)] });
    }
    const [acW, acE] = bays.slice(-2); acW.yieldTo = acE;
  }
  // batıdaki DC'den çıkan araba dönerken doğudaki AC'nin dümdüz şeridini keser (ve tersi): biri hareketteyken öbürü bekler
  const t1 = bays.find((b) => b.tag === 'dc1'), t2 = bays.find((b) => b.tag === 'ac2');
  if (t1 && t2) { t1.cross = [t2]; t2.cross = [t1]; }
}
// bölge genişletmesi (expand-west.js): avlunun güneyindeki arsalarda süper şarj ya da oto yıkama yeri. Arabalar benzinliğin
// batısındaki ayrı girişten (x -86,6) güneye iner, arsaların önünde (z 0,5) doğuya döner, yerine burunla girer; çıkarken geri
// geri çıkıp aynı yoldan yola döner. (Eskiden AC şeridinden iniyordu: AC şarj direğinin ve binicilik pistinin içinden geçiyordu)
let drivewayOn = false;
function addDriveway(instant) {
  if (drivewayOn) return;
  drivewayOn = true;
  const mat = (rx, ry) => new THREE.MeshStandardMaterial({ map: texRep('asphalt', rx, ry), roughness: 0.9, color: '#8e939a' });
  // şerit kaldırımın güney kenarında başlar: eskiden yolun 40 cm içine taşıyordu, yolun kenarında koyu bir yama görünüyordu (2026-11-04)
  const a = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 16.05), mat(1, 5.4)); a.rotation.x = -PI / 2; a.position.set(-86.6, 0.012, -6.425); a.receiveShadow = true; S.add(a);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(13.9, 2.6), mat(5, 1)); b.rotation.x = -PI / 2; b.position.set(-81.05, 0.014, 0.5); b.receiveShadow = true; S.add(b);
  // şeridin doğu ucu avluya bağlanır (2026-10-28 kullanıcı: "çıkmaz sokak olmasın"): arsaların önünden geçen araba avluya, oradan yola çıkabilir
  const c = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.4), mat(1, 0.5)); c.rotation.x = -PI / 2; c.position.set(-75.55, 0.013, -1.35); // doğuda binicilik pisti var: bağlantı şeridin ucunda c.receiveShadow = true; S.add(c);
  if (!instant) { popIn(a); popIn(b); popIn(c); }
}
export function addExtraBay(kind, x, instant, model) {
  if (!open) { openStation(instant); G.unlocked.add('e0'); }
  addDriveway(instant);
  const LANE = -86.6, ZA = 0.5, wash = kind === 'wash', BZ = wash ? 5.4 : 5.0;
  let cable, led = null, screen = null;
  if (!wash) {
    const dc = appear(makeBemisDC(logoW), instant); dc.position.set(x, 0, 7.7); dc.rotation.y = PI; // ekranı arabaya (kuzeye) dönük
    col(x - 0.55, x + 0.55, 7.35, 8.05);
    paintBay(x, 5.0, 4.4);
    cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(x - 0.13, 0.66, 7.35), V(x - 0.3, 0.25, 6.7), V(x - 0.35, 0.6, 6.25)]), 20, 0.035, 6), M.mat('#1b1d20'));
    cable.visible = false; S.add(cable); led = dc.userData.led; screen = dc.userData.screen;
  } else {
    // yıkamada kablo yerine kemerin fırçaları döner (expand-west.js modeli userData.on'a bakar)
    cable = { v: false, get visible() { return this.v; }, set visible(on) { this.v = on; if (model) model.userData.on = on; } };
    if (model && G.hooks.washModel) G.hooks.washModel(model);
    // yıkama girişin batısındaysa şeridin ucundan arsaya uzanan asfalt (çıkmaz yol olmasın, araba asfalttan döner)
    if (x < LANE) { const m = new THREE.Mesh(new THREE.PlaneGeometry(LANE - 1.4 - (x - 1.5), 2.6), new THREE.MeshStandardMaterial({ map: texRep('asphalt', 2, 1), roughness: 0.9, color: '#8e939a' })); m.rotation.x = -PI / 2; m.position.set((LANE - 1.4 + x - 1.5) / 2, 0.013, ZA); m.receiveShadow = true; S.add(m); if (!instant) popIn(m); }
  }
  bays.push({ x, z: BZ, pay: wash ? 22 : 40, wash, revOut: 1, lane: 'x', car: null, state: 'empty', t: (instant ? 6 : 3) + Math.random() * 6, cable, led, screen, path: [],
    enter: () => [V(LANE, 0, ROAD_Z), V(LANE, 0, ZA), V(x, 0, ZA), V(x, 0, BZ)],
    leave: () => [V(x, 0, ZA), V(LANE, 0, ZA), V(LANE, 0, ROAD_OUT), V(FAR_X, 0, ROAD_OUT)] });
}
function paintBay(x, z, d) {
  const paint = M.rbox(2.2, 0.02, d, 0.01, M.mat('#3fae6b'), x, 0.012, z, S); paint.receiveShadow = true;
  plane(0.9, 0.9, textTex('⚡', { bg: '#3fae6b', fg: '#ffffff', w: 128, h: 128, r: 60 }), x, 0.03, z + 1.0, S).rotation.x = -PI / 2;
}

// elektrikli araba: yoldan gelir, şarj yerine girer, 20-35 sn şarj olur, yoluna devam eder
const EV_LOOKS = ['sedan', 'taxi', 'suv', 'van'];
function drive(b, dt, speed) {
  const p = b.car.position, t = b.path[0];
  if (!t) return true;
  const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
  const st = speed * dt * (G.hooks.crossK && d > 0.01 ? G.hooks.crossK(p, dx / d, dz / d) : 1) * (G.hooks.gapK ? G.hooks.gapK(b.car, b.path) : 1); // yaya geçidinde (roads.js), önündeki taşıtta (events.js yol düzeni)
  if (d < 0.05) { b.path.shift(); if (b.rev) b.rev--; return !b.path.length; }
  p.x += (dx / d) * Math.min(st, d); p.z += (dz / d) * Math.min(st, d);
  let da = Math.atan2(dx, dz) + (b.rev ? PI : 0) - b.car.rotation.y; // geri giderken burnu ters yöne bakar
  da = Math.atan2(Math.sin(da), Math.cos(da)); // kısa yoldan döner (eskiden bu satır yorumun içindeydi: araba yerinde tam tur atıyordu)
  b.car.rotation.y += da * Math.min(1, dt * 9);
  return false;
}
// AC şarjları ve arsalardaki bölümler kendi şeritlerini paylaşır (lane): biri girip çıkarken öbürü bekler, arabalar iç içe geçmez
const moving = (o) => o.state === 'in' || o.state === 'out';
const laneBusy = (b) => (!!b.lane && bays.some((o) => o !== b && o.lane === b.lane && moving(o))) || !!(b.yieldTo && b.yieldTo.car) || !!(b.cross && b.cross.some(moving));
export function updateStation(dt) {
  for (const b of bays) {
    b.t -= dt;
    switch (b.state) {
      case 'empty':
        if (b.t > 0) break;
        if (laneBusy(b)) { b.t = 1.5; break; } // aynı şeritte giren ya da çıkan araba var: arkasından gelir
        b.car = M.model(EV_LOOKS[Math.floor(Math.random() * EV_LOOKS.length)]);
        b.car.position.set(FAR_X, 0, ROAD_Z); b.car.rotation.y = PI / 2;
        G.scene.add(b.car);
        b.path = b.enter(); b.fast = b.path.length - 1;
        b.state = 'in';
        break;
      case 'in':
        // yolda hızlı, istasyona girince yavaş
        if (drive(b, dt, b.path.length > b.fast ? 9 : 3.5)) { b.state = 'charge'; b.t = b.fuel ? 7 + Math.random() * 5 : b.wash ? 8 + Math.random() * 3 : 20 + Math.random() * 15; b.cable.visible = true; }
        break;
      case 'charge':
        if (b.t <= 0 && laneBusy(b)) b.t = 1; // şeritten giren araba geçsin
        // ana yolun iki şeridini geri geri ya da çapraz keser: yaklaşan taşıt varsa bekler (2026-11-05: önüne çıkıp içinden geçiyordu)
        if (b.t <= 0 && G.hooks.roadBusy && G.hooks.roadBusy(b.car, b.x - 16, b.x + 16, ROAD_OUT - 1.1, ROAD_Z + 1.1)) b.t = 0.5;
        if (b.t <= 0) {
          b.cable.visible = false; b.state = 'out'; b.path = b.leave(); b.rev = b.revOut ?? (b.fuel ? 1 : 0);
          // kartla öder: para marketin yanındaki kasa kutusunda birikir, oyuncu ya da muhasebeci toplar (account.js)
          const base = b.fuel ? (G.mods && G.mods.fuelPay) || b.pay : b.wash ? b.pay : Math.round(b.pay * ((G.mods && G.mods.evPay) || 1));
          toKasa('istasyon', 'Benzinlik ve şarj', Math.round(base * ((G.mods && G.mods.stationMul) || 1)), new THREE.Vector3(-80.8, 3.4, -5.6), b.fuel ? '⛽' : b.wash ? '🫧' : '⚡'); // market büyüyünce (genişletme) 1,3 kat
        }
        break;
      case 'out':
        if (drive(b, dt, b.rev ? 2.4 : b.path.length > 1 ? 3.5 : 9)) { G.scene.remove(b.car); b.car = null; b.state = 'empty'; b.t = (6 + Math.random() * 10) / CUST_RATE; }
        break;
    }
    if (b.fuel || b.wash) continue; // pompanın ve yıkamanın ışığı yok
    // şarj olurken yeşil ışıklar nabız gibi atar, ekran yanar
    const on = b.state === 'charge';
    const k = on ? 0.55 + 0.45 * Math.sin(G.time * 3 + b.x) : 0.35;
    if (b.screen) {
      b.led.color.setRGB(0.27 * k + 0.05, 0.83 * k + 0.1, 0.42 * k + 0.05);
      b.screen.material.color.set(on ? '#d9ffe2' : '#cfe9ff');
    } else if (on) b.led.setRGB(0.3 * k + 0.2, 0.83 * k + 0.15, 0.42 * k + 0.2); // AC: şarjda ekran yeşil yanıp söner
    else b.led.set('#9fd3ff');
  }
}
