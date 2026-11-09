// Beach Club (expand-east.js xtatil4): kabuk tatil köyünün doğusunda, hamamın eski arsasında kumsal kulübü. DJ kabininden house
// çalar (calgi.js 'club'), kalabalık pistte dans eder, bir kısmı iskelenin iki yanında denize girip suda eğlenir, barda içer.
// Önünde denize uzanan iskele: yatlar açıktan gelip iskelenin iki yanına pruvadan yanaşır, bağlama ücreti öder, yolcuları kulübe
// iner; yolcular dönünce yat geri geri çıkıp açılır. Giriş ve bağlama ücreti kulübün kasasına düşer (sen, muhasebeci toplar).
// 2026-11-03 kullanıcı: "Kabuk tatil köyünün yan tarafına sahile beach club yap. Dj kabini olsun dj müzik çalsın insanlar denize
// girip eğlensin. Önüne iskele yap. Yatlar tekneler yanaşsın liman olsun." (seçim: satın alınan yeni iş)
import * as THREE from 'three';
import * as M from './models.js';
import { G, Customer, floatText, sfx, rand, mult } from './game.js';
import { coastZ } from './nature.js';
import { ring } from './fx.js';
import { repMul } from './rating.js';
import { texRep } from './tex.js';
import { beatOf } from './calgi.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
// yerleşim: kuzeyde giriş ve kasa, ortada DJ sahnesi (güneye, denize bakar), önünde pist, batıda bar, doğuda yatak-çardaklar
const DJ = { x: 119.5, z: 20.4 }, FLOOR = { x: 119.5, z: 24.9 }, BAR = { x: 114.3, z: 21.6 }, DOOR = { x: 116.8, z: 16.6 };
const FROM = V(155, 0, 8.8); // resort.js FAR: caddenin güney kaldırımı, misafirler de oradan gelir
// iskele: kumdan denize gövde, ucunda küçük T başı; yatlar gövdenin iki yanına yanaşır
const PIER = { x: 119.5, w: 2.6, z0: 28.4, z1: 43.4, tx0: 117.8, tx1: 121.2, tz1: 45.0 };
const DOCK_Z = 38.8, BERTHS = [{ x: 116.4, s: -1 }, { x: 122.6, s: 1 }]; // s: geldiği ve gittiği yan (batı / doğu)
const SWIM = [[112.2, 114.6], [124.4, 126.6]]; // denize girilen iki kıyı: iskeleden ve yatlardan uzak
const seaZ = (x) => coastZ(x) - 0.3;
const PAL = ['#ff3fa4', '#3fd7ff', '#ffe03f', '#8a5cff', '#3fff9b', '#ff7a3f'].map((c) => new THREE.Color(c));
const glow = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1, roughness: 0.4 }); // kendi malzemesi: M.mat önbellekli, rengi değişince başkası da değişirdi
const live = (o) => { o.traverse((m) => { m.userData.bkNo = true; }); return o; }; // birleştirmeye girmez (perf.js): oynar, renk değiştirir

const club = { on: false, sun: [], pile: null, t: 2, beat: 0, dt: 0, list: [], spots: [], stools: [], tiles: [], beams: [], cones: [], strips: [], disks: [], led: null, ledT: 0, dj: null, bart: null, yachts: [], floats: [] };

// ---------- modeller ----------
function makeStage() { // DJ sahnesi: platform, arkada LED ekran, kabin, pikaplar, hoparlörler, önde ışık iskelesi
  const g = new THREE.Group(), black = M.mat('#1d1f24'), dark = M.mat('#2b2f36'), steel = M.mat('#c9ccd0', { rough: 0.3 });
  M.rbox(6.0, 0.45, 3.0, 0.05, dark, 0, 0.225, 0, g);
  const strip = M.rbox(6.0, 0.06, 0.04, 0.01, glow('#ff3fa4'), 0, 0.36, 1.51, g); club.strips.push(strip);
  // LED ekran: tuval dokusu, ekolayzır ve yazı (her kare değil, aralıkla çizilir)
  M.rbox(5.3, 2.5, 0.16, 0.03, black, 0, 1.75, -1.32, g);
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 56;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const led = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  led.position.set(0, 1.75, -1.23); g.add(led); club.led = { cv, tex, ctx: cv.getContext('2d') };
  // kabin: önü ışıklı pano; üstünde iki pikap ve mikser
  M.rbox(2.6, 1.0, 0.8, 0.04, black, 0, 0.95, 0.55, g);
  const panel = M.rbox(2.4, 0.7, 0.02, 0.01, glow('#3fd7ff'), 0, 0.95, 0.96, g); club.strips.push(panel);
  for (const x of [-0.75, 0.75]) {
    M.rbox(0.62, 0.06, 0.5, 0.02, dark, x, 1.48, 0.55, g);
    const d = M.cyl(0.2, 0.2, 0.025, 20, M.mat('#111111', { rough: 0.3 }), x, 1.525, 0.55, g);
    M.cyl(0.06, 0.06, 0.03, 12, M.mat(x < 0 ? '#ff3fa4' : '#ffe03f'), 0, 0.005, 0, d); M.rbox(0.03, 0.02, 0.16, 0.005, steel, 0.08, 0.012, 0.05, d); // etiket, iğne izi
    club.disks.push(d);
  }
  M.rbox(0.5, 0.08, 0.42, 0.02, M.mat('#3a3f48'), 0, 1.49, 0.55, g);
  for (let i = 0; i < 6; i++) M.cyl(0.025, 0.025, 0.03, 8, M.mat(i % 2 ? '#3fd7ff' : '#ff7a3f'), -0.15 + (i % 3) * 0.15, 1.54, 0.45 + Math.floor(i / 3) * 0.16, g);
  // kulaklık kabinin üstünde
  const hp = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 14, PI), black); hp.position.set(1.15, 1.56, 0.4); hp.rotation.set(-PI / 2, 0, 0.4); g.add(hp);
  // hoparlörler: iki kule, ön yüzde vuruşla atan koniler
  for (const x of [-2.55, 2.55]) {
    M.rbox(0.75, 1.7, 0.62, 0.04, black, x, 1.3, -0.45, g);
    for (const [y, r] of [[1.75, 0.22], [1.02, 0.3]]) {
      M.cyl(r + 0.03, r + 0.03, 0.02, 18, dark, x, y, -0.13, g).rotation.x = PI / 2;
      const c = M.cyl(r * 0.55, r * 0.75, 0.05, 16, M.mat('#4a4f58', { rough: 0.4 }), x, y, -0.11, g); c.rotation.x = PI / 2; club.cones.push(c);
    }
  }
  // ışık iskelesi: önde iki direk ve üst kiriş; kirişe asılı hareketli ışıklar pistin üstünü tarar
  for (const x of [-3.1, 3.1]) M.rbox(0.2, 4.3, 0.2, 0.03, steel, x, 2.15, 1.3, g);
  M.rbox(6.4, 0.22, 0.22, 0.03, steel, 0, 4.3, 1.3, g);
  for (const [i, x] of [-2.1, -0.7, 0.7, 2.1].entries()) {
    M.cyl(0.13, 0.11, 0.26, 10, black, x, 4.05, 1.3, g);
    const geo = new THREE.ConeGeometry(0.85, 4.0, 16, 1, true); geo.translate(0, -2.0, 0);
    const b = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PAL[i].clone(), transparent: true, opacity: 0.17, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    b.position.set(x, 3.92, 1.3); b.renderOrder = 4; g.add(b); club.beams.push(b);
  }
  const s = M.makeSign('🎧 DJ', '#ff3fa4', 1.2, 0.45); s.scale.setScalar(0.8); s.position.set(0, 3.05, -1.25); g.add(s);
  return g;
}
function makeFloor() { // dans pisti: 5 × 4 ışıklı karo, vuruşla renk değiştirir
  const g = new THREE.Group();
  M.rbox(6.2, 0.04, 4.6, 0.01, M.mat('#15171c'), 0, 0.02, 0, g);
  for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) {
    const t = M.rbox(1.12, 0.03, 1.02, 0.01, new THREE.MeshStandardMaterial({ color: '#2a2d36', emissive: PAL[(q + r) % PAL.length].clone(), emissiveIntensity: 0.6, roughness: 0.4 }), -2.4 + q * 1.2, 0.045, -1.65 + r * 1.1, g);
    club.tiles.push(t);
  }
  return g;
}
function makeBar() { // sazdan tenteli bar: tezgâh, arkada şişe rafı, önde tabureler
  const g = new THREE.Group(), straw = M.mat('#d9b56c'), wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 1.2) });
  M.rbox(0.9, 1.05, 3.2, 0.04, wood, 0.45, 0.525, 0, g);
  M.rbox(1.1, 0.07, 3.4, 0.02, M.mat('#f1e6cc'), 0.5, 1.08, 0, g);
  for (let i = 0; i < 7; i++) M.rbox(0.02, 0.9, 0.36, 0.005, straw, 0.91, 0.5, -1.35 + i * 0.45, g); // önü hasır
  M.rbox(0.35, 1.6, 3.0, 0.03, wood, -1.15, 0.8, 0, g);
  const cols = ['#3fae5a', '#c8463a', '#f2c14e', '#3d7dd8', '#e9e2d6', '#8a5cff'];
  for (let i = 0; i < 14; i++) M.cyl(0.05, 0.06, 0.28, 8, M.mat(cols[i % cols.length], { rough: 0.2 }), -1.1, 1.75, -1.3 + i * 0.2, g);
  for (const [x, z] of [[-1.25, -1.6], [-1.25, 1.6], [1.0, -1.6], [1.0, 1.6]]) M.cyl(0.07, 0.08, 2.7, 6, M.mat('#8b5a2b'), x, 1.35, z, g);
  const roof = M.rbox(2.9, 0.22, 4.0, 0.08, straw, -0.12, 2.75, 0, g); roof.rotation.z = 0.12;
  for (let i = 0; i < 9; i++) M.rbox(0.05, 0.28, 4.0, 0.01, M.mat('#c39a52'), -1.4 + i * 0.32, 2.62 - (i - 4) * 0.04 + 0.04, 0, g); // saçak
  const s = M.makeSign('🍹 BAR', '#ff7a3f', 1.4, 0.45); s.scale.setScalar(0.8); s.position.set(1.3, 0, -1.95); g.add(s);
  for (const z of [-0.9, 0, 0.9]) { M.cyl(0.03, 0.03, 0.66, 6, M.mat('#c9ccd0', { rough: 0.3 }), 1.3, 0.33, z, g); M.cyl(0.2, 0.2, 0.07, 14, M.mat('#ff3fa4'), 1.3, 0.69, z, g); }
  return g;
}
function makeDaybed() { // çardaklı yatak: beyaz kaide, minder, yastıklar, dört direk, arkada tül
  const g = new THREE.Group(), white = M.mat('#f6f2ea'), wood = M.mat('#c9a06a');
  M.rbox(2.0, 0.32, 2.2, 0.04, wood, 0, 0.16, 0, g);
  M.rbox(1.9, 0.16, 2.1, 0.06, white, 0, 0.4, 0, g);
  for (const z of [-0.55, 0.55]) M.rbox(0.3, 0.22, 0.7, 0.08, M.mat(z < 0 ? '#3fd7ff' : '#ff7a3f'), 0.72, 0.58, z, g);
  for (const x of [-0.95, 0.95]) for (const z of [-1.05, 1.05]) M.cyl(0.04, 0.04, 2.3, 6, wood, x, 1.15, z, g);
  M.rbox(2.1, 0.06, 2.3, 0.02, white, 0, 2.3, 0, g);
  const tul = M.rbox(0.03, 1.8, 2.1, 0.0, M.mat('#ffffff', { opacity: 0.55 }), 0.97, 1.35, 0, g); tul.castShadow = false;
  return g;
}
function makeEntrance() { // giriş kemeri: iki direk, üstte ışıklı tabela
  const g = new THREE.Group(), post = M.mat('#2b2f36');
  for (const x of [-1.8, 1.8]) M.rbox(0.18, 3.0, 0.18, 0.03, post, x, 1.5, 0, g);
  M.rbox(4.0, 0.62, 0.16, 0.04, M.mat('#1d1f24'), 0, 3.0, 0, g);
  const s = M.makeSign('🎧 BEACH CLUB', '#ff3fa4', 3.2, 0.7); s.scale.setScalar(0.85); s.position.set(0, 2.42, 0.1); g.add(s);
  const neon = M.rbox(3.9, 0.05, 0.04, 0.01, glow('#3fd7ff'), 0, 2.68, 0.1, g); club.strips.push(neon);
  return g;
}
function makeLights(pts) { // ip ışıklar: direkler arasında sarkan renkli ampuller
  const g = new THREE.Group(), cols = ['#ffd27a', '#ff8fc8', '#8fe3ff', '#fff3b0'];
  for (const [x, z] of pts) M.cyl(0.05, 0.06, 3.2, 6, M.mat('#5a3b22'), x, 1.6, z, g);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.round(Math.hypot(bx - ax, bz - az) / 0.6);
    for (let k = 1; k < n; k++) { const f = k / n; M.sph(0.07, M.mat(cols[k % 4], { emissive: cols[k % 4], ei: 0.9 }), ax + (bx - ax) * f, 3.1 - Math.sin(f * PI) * 0.55, az + (bz - az) * f, g, 6, 4); }
  }
  return g;
}
function makePier() { // iskele: tahta güverte (kumdan denize), kazıklar, fenerler; uçta T başı
  const g = new THREE.Group(), deck = M.mat('#ffffff', { map: texRep('wood', 1, 6) }), pile = M.mat('#6b4a2e'), { x, w, z0, z1, tx0, tx1, tz1 } = PIER;
  M.rbox(w, 0.12, z1 - z0, 0.02, deck, x, 0.04, (z0 + z1) / 2, g);
  M.rbox(tx1 - tx0, 0.12, tz1 - z1 + 0.2, 0.02, deck, x, 0.04, (z1 + tz1) / 2 - 0.1, g);
  for (let z = z0 + 0.5; z < tz1; z += 1.8) {
    const xs = z > z1 ? [tx0 + 0.12, tx1 - 0.12] : [x - w / 2 + 0.1, x + w / 2 - 0.1];
    for (const px of xs) if (z > seaZ(px) - 0.6) M.cyl(0.11, 0.11, 1.6, 8, pile, px, -0.75, z, g);
  }
  for (const s of [-1, 1]) {
    for (const z of [DOCK_Z - 2.6, DOCK_Z + 2.6]) M.cyl(0.08, 0.1, 0.24, 8, M.mat('#3a3f48'), x + s * (w / 2 - 0.18), 0.22, z, g); // babalar
    for (let z = DOCK_Z - 3; z <= DOCK_Z + 3; z += 1.5) { const f = M.cyl(0.1, 0.1, 0.5, 8, M.mat('#f6f2ea'), x + s * (w / 2 + 0.05), -0.05, z, g); f.rotation.x = PI / 2; } // usturmaçalar
  }
  for (const [lx, lz] of [[x - w / 2 + 0.15, 31.5], [x + w / 2 - 0.15, 35.4], [x - w / 2 + 0.15, 41.2], [tx1 - 0.15, tz1 - 0.2], [tx0 + 0.15, tz1 - 0.2]]) {
    M.cyl(0.04, 0.05, 1.5, 6, M.mat('#2b2f36'), lx, 0.85, lz, g);
    M.sph(0.12, M.mat('#fff3b0', { emissive: '#ffd27a', ei: 1 }), lx, 1.66, lz, g, 8, 6);
  }
  const s = M.makeSign('⚓ MARİNA', '#2f6db5', 1.8, 0.5); s.scale.setScalar(0.8); s.position.set(x + w / 2 + 0.7, 0, z0 + 0.4); g.add(s);
  return g;
}
// yat: ExtrudeGeometry gövde (sivri pruva +z'de), renkli şerit, tik güverte, kamara, flybridge, korkuluk, bayrak, dümen suyu
function hullGeo(L, B, bow, depth, bevel) {
  const s = new THREE.Shape(), h = L / 2;
  s.moveTo(-B / 2, h); s.lineTo(B / 2, h); s.lineTo(B / 2, -h + bow);
  s.quadraticCurveTo(B * 0.45, -h + bow * 0.2, 0, -h); s.quadraticCurveTo(-B * 0.45, -h + bow * 0.2, -B / 2, -h + bow);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(-PI / 2); // şeklin -y'si (pruva) +z'ye, kalınlık yukarı
  return geo;
}
let wakeTex = null;
function wakeMap() {
  if (wakeTex) return wakeTex;
  const c = document.createElement('canvas'); c.width = 32; c.height = 64;
  const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.beginPath(); x.moveTo(10, 0); x.lineTo(22, 0); x.lineTo(32, 64); x.lineTo(0, 64); x.closePath(); x.fill();
  wakeTex = new THREE.CanvasTexture(c); return wakeTex;
}
function makeYacht(acc) {
  const g = new THREE.Group(), white = M.mat('#f7f7f4', { rough: 0.35 }), glass = M.mat('#22323f', { rough: 0.15 }), steel = M.mat('#c9ccd0', { rough: 0.3 });
  const hull = new THREE.Mesh(hullGeo(7.6, 2.5, 2.6, 0.95, 0.08), white); hull.position.y = -0.42; hull.castShadow = true; g.add(hull);
  const band = new THREE.Mesh(hullGeo(7.62, 2.52, 2.62, 0.16, 0.06), M.mat(acc)); band.position.y = 0.16; g.add(band);
  const deck = new THREE.Mesh(hullGeo(7.3, 2.25, 2.45, 0.05, 0), M.mat('#ffffff', { map: texRep('wood', 1, 3) })); deck.position.y = 0.6; g.add(deck);
  M.rbox(1.9, 0.75, 3.0, 0.12, white, 0, 1.0, -0.6, g); // kamara
  M.rbox(1.94, 0.3, 2.3, 0.06, glass, 0, 1.1, -0.45, g);
  const ws = M.rbox(1.7, 0.42, 0.06, 0.02, glass, 0, 1.28, 0.95, g); ws.rotation.x = -0.65; // ön cam
  M.rbox(1.6, 0.08, 1.9, 0.04, white, 0, 1.42, -1.0, g); // üst güverte
  for (const x of [-0.72, 0.72]) for (const z of [-1.8, -0.3]) M.cyl(0.02, 0.02, 0.9, 6, steel, x, 1.88, z, g);
  M.rbox(1.7, 0.05, 1.8, 0.02, M.mat(acc), 0, 2.34, -1.05, g); // tente
  M.rbox(1.5, 0.12, 1.1, 0.05, M.mat('#f1e6cc'), 0, 0.72, 1.75, g); // pruvada güneşlenme minderi
  M.rbox(1.6, 0.12, 0.9, 0.05, M.mat('#f1e6cc'), 0, 0.72, -2.85, g); // kıç kanepesi
  for (const x of [-1.05, 1.05]) { const r = M.cyl(0.018, 0.018, 4.6, 6, steel, x, 0.95, -0.9, g); r.rotation.x = PI / 2; for (let z = -3.1; z <= 1.4; z += 1.5) M.cyl(0.015, 0.015, 0.35, 6, steel, x, 0.78, z, g); }
  M.cyl(0.015, 0.015, 0.9, 6, steel, 0, 1.05, -3.65, g);
  const flag = new THREE.Group(); flag.position.set(0, 1.42, -3.65); g.add(flag);
  M.rbox(0.42, 0.28, 0.01, 0, M.mat('#e30a17'), 0.22, 0, 0, flag);
  M.sph(0.06, M.mat('#ffffff'), 0.16, 0, 0.01, flag, 8, 6).scale.z = 0.15;
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 7), new THREE.MeshBasicMaterial({ map: wakeMap(), transparent: true, opacity: 0, depthWrite: false }));
  wake.rotation.x = -PI / 2; wake.position.set(0, -0.2, -7.2); g.add(wake);
  g.userData = { wake, flag };
  return g;
}

// ---------- kurulum (expand-east.js xtatil4) ----------
export function buildClub(c, { place, cashBox, danceStep }) {
  club.on = true; club.dance = danceStep; // dans adımı konser seyircisiyle aynı (expand-east.js)
  c.put(makeEntrance(), DOOR.x, 0, 15.9);
  for (const x of [DOOR.x - 1.8, DOOR.x + 1.8]) c.col(x - 0.1, x + 0.1, 15.8, 16.0); // yalnız direkler: kemerin altından geçilir
  club.pile = cashBox(c, 113.9, 16.9);
  c.hint(113.9, 2.0, 16.9, '🎧', 'Beach Club kasası', 'Giriş ve yat bağlama ücretleri burada birikir.', 3.2);
  c.put(makeStage(), DJ.x, 0, DJ.z);
  c.col(DJ.x - 3.0, DJ.x + 3.0, DJ.z - 1.5, DJ.z + 1.5); for (const x of [DJ.x - 3.1, DJ.x + 3.1]) c.col(x - 0.1, x + 0.1, DJ.z + 1.2, DJ.z + 1.4); // ışık konileri kutuya girmesin
  c.put(live(makeFloor()), FLOOR.x, 0, FLOOR.z);
  c.group.add(makeLights([[116.2, 22.5], [116.2, 27.3], [122.8, 27.3], [122.8, 22.5]])); // mutlak konumlu: popIn dünya merkezinden büyütürdü
  for (const [x, z] of [[116.2, 22.5], [116.2, 27.3], [122.8, 27.3], [122.8, 22.5]]) c.col(x - 0.08, x + 0.08, z - 0.08, z + 0.08);
  c.put(makeBar(), BAR.x, 0, BAR.z);
  c.col(112.9, 115.3, 20.0, 23.2);
  for (const z of [-0.9, 0, 0.9]) club.stools.push({ x: BAR.x + 1.3, z: BAR.z + z, c: null });
  for (const z of [18.6, 22.6]) place(c, makeDaybed(), 124.7, z);
  for (const [x, z, s] of [[113.4, 25.8, 1.1], [125.8, 26.6, 1.25], [125.9, 15.9, 1.0]]) { c.put(M.makePalm(s, rand(-0.3, 0.3)), x, 0, z, rand(0, 6)); c.col(x - 0.25, x + 0.25, z - 0.25, z + 0.25); }
  // DJ ve barmen: elleri, başı müzikle oynar
  const dj = M.makeCharacter(M.townLook()); c.put(live(dj), DJ.x, 0.45, DJ.z - 0.1, 0); club.dj = dj;
  const bart = M.makeCharacter(M.townLook()); c.put(live(bart), BAR.x - 0.55, 0, BAR.z, PI / 2); club.bart = bart;
  // yatak-çardaklarda ve kumda havluda güneşlenenler
  const tw = ['#ff8a5c', '#3fd7ff'];
  // ayaklar karakterin kökünde: yatakta baş doğuda (yastıklar), havluda baş kuzeyde
  for (const [i, [x, y, z, ry]] of [[123.9, 0.52, 18.6, -PI / 2], [123.9, 0.52, 22.6, -PI / 2], [116.9, 0.1, 30.0, 0], [123.9, 0.1, 30.0, 0]].entries()) {
    if (i >= 2) { const t = new THREE.Group(); for (let k = 0; k < 4; k++) M.rbox(0.9, 0.02, 0.45, 0.005, M.mat(k % 2 ? '#ffffff' : tw[i - 2]), 0, 0.012, -0.68 + k * 0.45, t); c.put(t, x, 0, z - 0.8, 0); }
    const o = M.makeCharacter(M.touristLook()); if (M.setSwimwear) M.setSwimwear(o, true);
    o.position.set(x, y, z); o.rotation.order = 'YXZ'; o.rotation.set(-1.3, ry, 0); c.group.add(live(o)); club.sun.push({ o, t: rand(2, 8), k: 0, a: 0 });
  }
  for (let i = 0; i < 12; i++) club.spots.push({ x: FLOOR.x - 2.4 + (i % 4) * 1.6 + rand(-0.3, 0.3), z: FLOOR.z - 1.4 + Math.floor(i / 4) * 1.4 + rand(-0.2, 0.2), c: null });
  // iskele ve marina: üstü yürünür; yatlar ve şişme simitler sahnede ayrı (oynar)
  c.group.add(makePier());
  if (!G.walkways.club) { G.walkways.push([PIER.x - PIER.w / 2, PIER.x + PIER.w / 2, PIER.z0, PIER.z1], [PIER.tx0, PIER.tx1, PIER.z1 - 0.2, PIER.tz1]); G.walkways.club = true; }
  const boat = M.makeBoat(); c.put(boat, PIER.x, 0, PIER.tz1 + 1.3, PI / 2);
  BERTHS.forEach((b, i) => { const o = live(makeYacht(i ? '#1f4e8c' : '#c8463a')); o.visible = false; G.scene.add(o); club.yachts.push({ o, b, i, st: 'away', t: i ? 16 : 5, v: 0, h: 0, wps: [], aboard: 0, stay: 0 }); });
  for (const [x, col] of [[113.4, '#ff6fa8'], [125.4, '#ffe03f']]) {
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.16, 8, 18), M.mat(col, { rough: 0.4 })); f.rotation.x = PI / 2;
    const z = coastZ(x) + 2.4; f.position.set(x, -0.18, z); G.scene.add(live(f)); club.floats.push({ f, x, z, ph: rand(0, 6) });
  }
}

// ---------- ziyaretçiler ----------
const walkers = () => club.list.filter((c) => !c.club.yacht).length;
function visitor(at, yacht) {
  const c = new Customer(at, 'tatil', M.touristLook());
  c.club = { yacht, n: 0, ph: rand(0, PI * 2), t: 0 };
  club.list.push(c);
  if (yacht) next(c); else { c.state = 'in'; c.path = [V(DOOR.x + rand(-0.8, 0.8), 0, DOOR.z + rand(0, 0.4))]; c.setBubbleText('🎧', 'pay'); }
  c.think = (dt) => think(c, dt);
  return c;
}
function reset(c) { c.pose = null; const o = c.obj; o.position.y = 0; o.rotation.x = 0; o.rotation.z = 0; }
// sıradaki eğlence: pist, deniz, bar ya da eve dönüş (en çok üç durak)
function next(c) {
  const K = c.club; reset(c);
  const spot = club.spots.filter((s) => !s.c), stool = club.stools.filter((s) => !s.c), r = Math.random();
  if (K.n >= 3 || (K.n >= 1 && r < 0.2)) return leave(c);
  K.n++;
  if (spot.length && (K.n === 1 || r < 0.45)) { const s = spot[Math.floor(Math.random() * spot.length)]; s.c = c; K.spot = s; c.state = 'toDance'; c.path = [V(s.x, 0, s.z)]; return; }
  if (!K.swam && r < 0.8) {
    const [x0, x1] = SWIM[Math.random() < 0.5 ? 0 : 1], x = rand(x0, x1);
    K.shore = V(x, 0, 30.6); K.sea = V(x + rand(-0.6, 0.6), 0, coastZ(x) + rand(1.6, 3.4)); K.swam = true;
    c.state = 'toShore'; c.path = [K.shore.clone()]; return;
  }
  if (stool.length) { const s = stool[Math.floor(Math.random() * stool.length)]; s.c = c; K.stool = s; c.state = 'toBar'; c.path = [V(s.x + 0.35, 0, s.z)]; return; }
  leave(c);
}
function leave(c) {
  const K = c.club, Y = K.yacht; reset(c); c.leaving = true;
  if (Y && Y.st === 'dock') { c.state = 'board'; c.path = [V(PIER.x + Y.b.s * 0.7, 0, DOCK_Z + rand(-1, 1))]; }
  else { K.yacht = null; c.state = 'leave'; c.path = [V(DOOR.x, 0, DOOR.z - 0.6), V(FROM.x + rand(-1, 1), 0, FROM.z + rand(-0.3, 0.3))]; }
}
function gone(c) {
  const K = c.club;
  if (K.yacht && c.state === 'board') K.yacht.aboard--;
  club.list = club.list.filter((q) => q !== c); c.destroy();
}
// suda yürür: deniz yürünür alan değil, yol bulmadan dümdüz gider; derinleştikçe batar
function wade(c, to, dt) {
  const p = c.obj.position, dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz), st = 1.25 * dt;
  if (d > 0.02) c.face(Math.atan2(dx, dz), dt);
  if (d <= st) { p.x = to.x; p.z = to.z; } else { p.x += (dx / d) * st; p.z += (dz / d) * st; }
  c.moving = true;
  const deep = THREE.MathUtils.clamp((p.z - seaZ(p.x)) / 1.6, 0, 1);
  p.y += (-0.72 * deep - p.y) * Math.min(1, dt * 5);
  return d <= st;
}
function think(c, dt) {
  const K = c.club, o = c.obj, p = o.position;
  switch (c.state) {
    case 'in':
      if (!c.walk(dt)) return;
      { const pay = Math.round(15 * mult()); club.pile.add(pay, p); floatText(p, `🎧 Giriş +${pay} ₺`, 'pos'); sfx('cash', { at: p }); c.clearBubble(); }
      next(c); return;
    case 'toDance':
      if (!c.walk(dt)) return;
      c.state = 'dance'; K.t = rand(14, 26);
      { const s = K.spot; c.d = { o, style: ['zipla', 'sallan', 'el', 'alkis', 'don', 'kafa'][Math.floor(rand(0, 6))], f: PI, ph: rand(-0.25, 0.25), ry: Math.atan2(DJ.x - s.x, DJ.z - s.z) + rand(-0.3, 0.3) }; }
      c.pose = () => club.dance(c.d, club.beat, club.dt, 1);
      return;
    case 'dance':
      if ((K.t -= dt) > 0) return;
      if (K.spot) { K.spot.c = null; K.spot = null; }
      next(c); return;
    case 'toShore':
      if (!c.walk(dt)) return;
      if (M.setSwimwear) M.setSwimwear(o, true);
      c.state = 'wadeIn'; return;
    case 'wadeIn':
      if (!wade(c, K.sea, dt)) return;
      c.state = 'float'; K.t = rand(12, 20); K.splash = rand(0.5, 1.5);
      c.pose = () => { // suda dans: kollar havada, vuruşla zıplar
        const u = o.userData, b = club.beat * PI + K.ph, up = Math.sin(b);
        o.rotation.x = 0; o.rotation.z = 0;
        u.arms[0].rotation.set(-2.7 + up * 0.35, 0, 0.15); u.arms[1].rotation.set(-2.7 - up * 0.35, 0, -0.15);
        u.legs[0].rotation.x = Math.sin(G.time * 3 + K.ph) * 0.4; u.legs[1].rotation.x = -u.legs[0].rotation.x;
        p.y = -0.72 + Math.abs(up) * 0.12;
      };
      return;
    case 'float':
      c.face(Math.atan2(DJ.x - p.x, DJ.z - p.z), dt);
      if ((K.splash -= dt) <= 0) { K.splash = rand(0.9, 2.2); ring(V(p.x + rand(-0.3, 0.3), -0.2, p.z + rand(-0.3, 0.3)), '#ffffff', 0.6); }
      if ((K.t -= dt) > 0) return;
      reset(c); p.y = -0.72; c.state = 'wadeOut'; return;
    case 'wadeOut':
      if (!wade(c, K.shore, dt)) return;
      p.y = 0; next(c); return;
    case 'toBar':
      if (!c.walk(dt)) return;
      c.state = 'drink'; K.t = rand(8, 14);
      p.set(K.stool.x, 0, K.stool.z);
      c.pose = () => { const u = o.userData; for (const l of u.legs) l.rotation.x = -1.3; u.arms[0].rotation.x = -1.25 + Math.sin(G.time * 0.9 + K.ph) * 0.25; u.arms[1].rotation.x = -0.45; p.y = 0.1; o.rotation.y = -PI / 2; };
      return;
    case 'drink':
      if ((K.t -= dt) > 0) return;
      K.stool.c = null; K.stool = null; reset(c); p.x += 0.4; next(c); return;
    case 'board': case 'leave':
      if (c.walk(dt)) gone(c);
  }
}

// ---------- yatlar ----------
// açıktan gelir, iskeleye 15 m kala doğrulup pruvadan yanaşır; yolcular dönünce (ya da süre dolunca) geri geri çıkıp açılır
function sail(Y, dt) {
  const p = Y.o.position, wp = Y.wps[0], last = Y.wps.length === 1, dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
  const want = last && Y.st === 'in' ? THREE.MathUtils.clamp(d * 0.3, 0.45, 5) : 5;
  Y.v += (want - Y.v) * Math.min(1, dt * 0.7);
  if (last && Y.st === 'in' && d < 4.5) { // son metreler: doğrudan iskeleye, burnu kıyıya
    const st = Math.min(d, Y.v * dt); p.x += (dx / (d || 1)) * st; p.z += (dz / (d || 1)) * st;
    let da = PI - Y.h; da = Math.atan2(Math.sin(da), Math.cos(da)); Y.h += da * Math.min(1, dt * 1.2);
    if (d < 0.04) Y.wps.shift();
    return !Y.wps.length;
  }
  let da = Math.atan2(dx, dz) - Y.h; da = Math.atan2(Math.sin(da), Math.cos(da));
  const turn = 0.6 * Math.min(1, Y.v / 2.5) * dt;
  Y.h += THREE.MathUtils.clamp(da, -turn, turn);
  p.x += Math.sin(Y.h) * Y.v * dt; p.z += Math.cos(Y.h) * Y.v * dt;
  if (d < (last ? 1.5 : 3)) Y.wps.shift();
  return !Y.wps.length;
}
function yachtStep(Y, dt) {
  const o = Y.o, p = o.position, bx = Y.b.x, s = Y.b.s, u = o.userData;
  if (Y.st === 'away') {
    if ((Y.t -= dt) > 0) return;
    Y.st = 'in'; Y.v = 5; o.visible = true;
    p.set(bx + s * 60, 0, 112); Y.h = Math.atan2(-s * 57, -48);
    Y.wps = [V(bx + s * 3, 0, 64), V(bx, 0, 53), V(bx, 0, DOCK_Z)];
  } else if (Y.st === 'in') {
    if (sail(Y, dt)) { // yanaştı: bağlama ücreti, yolcular iner
      Y.st = 'dock'; Y.v = 0; Y.h = PI; Y.stay = 0;
      const pay = Math.round(60 * mult()), at = V(PIER.x + s * 1.2, 1.6, DOCK_Z);
      club.pile.add(pay, at); floatText(at, `⚓ Yat bağlama +${pay} ₺`, 'pos'); sfx('cash', { at });
      const n = 2 + Math.floor(Math.random() * 2); Y.aboard = n;
      for (let i = 0; i < n; i++) visitor(V(PIER.x + s * 0.7 + rand(-0.2, 0.2), 0, DOCK_Z + rand(-1.6, 1.6)), Y);
    }
  } else if (Y.st === 'dock') {
    Y.stay += dt;
    if ((Y.aboard <= 0 && Y.stay > 20) || Y.stay > 95) { Y.st = 'back'; Y.v = 0; for (const c of club.list) if (c.club.yacht === Y && c.state !== 'board') c.club.yacht = null; }
  } else if (Y.st === 'back') { // geri geri iskeleden çıkar
    Y.v = Math.min(1.4, Y.v + dt * 0.5);
    p.z += Y.v * dt;
    if (p.z > DOCK_Z + 12) { Y.st = 'out'; Y.v = 0.6; Y.wps = [V(bx + s * 14, 0, DOCK_Z + 17), V(bx + s * 70, 0, 115)]; }
  } else if (Y.st === 'out' && sail(Y, dt)) { Y.st = 'away'; o.visible = false; Y.t = rand(25, 50); }
  if (!o.visible) return;
  const t = G.time + Y.i * 2;
  p.y = Math.sin(t * 1.2) * 0.04; o.rotation.set(Math.sin(t * 0.7) * 0.012, Y.h, Math.sin(t * 0.9) * 0.025, 'YXZ');
  u.wake.material.opacity = Y.st === 'in' || Y.st === 'out' ? THREE.MathUtils.clamp(Y.v / 5, 0, 1) * 0.6 : 0;
  u.flag.rotation.y = Math.sin(t * 5) * 0.35;
}

// ---------- her kare (expand-east.js updateExpandEast) ----------
function drawLed(b) {
  const { ctx: x, cv, tex } = club.led, W = cv.width, H = cv.height, kick = Math.pow(1 - (b % 1), 2);
  x.fillStyle = '#0b0614'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) {
    const h = (0.25 + 0.55 * Math.abs(Math.sin(b * 0.9 + i * 0.7)) * (0.6 + 0.4 * Math.sin(i * 1.7 + Math.floor(b))) + kick * 0.25 * (i < 5 ? 1 : 0.4)) * (H - 18);
    x.fillStyle = `hsl(${(i * 18 + b * 22) % 360},95%,60%)`; x.fillRect(4 + i * 7.6, H - 4 - h, 6, h);
  }
  x.fillStyle = `hsl(${(b * 22) % 360},100%,${70 + kick * 25}%)`; x.font = 'bold 13px sans-serif'; x.textAlign = 'center'; x.fillText('BEACH CLUB', W / 2, 13);
  tex.needsUpdate = true;
}
// renk sırası eksi ve kesirli sayıda da dizinin içinde kalır (pal(-1) sonuncusu)
const pal = (k) => PAL[(((Math.floor(k) || 0) % PAL.length) + PAL.length) % PAL.length];
function animateClub(dt) {
  const b = club.beat, kick = Math.pow(1 - (b % 1), 3), bar = Math.floor(b / 4);
  club.tiles.forEach((m, i) => { const r = Math.floor(i / 5), q = i % 5; m.material.emissive.copy(pal(Math.floor(b) + q + r * 2)); m.material.emissiveIntensity = 0.3 + kick * 1.0; });
  club.beams.forEach((m, i) => { m.rotation.set(-0.45 - Math.sin(b * PI / 8 + i * 1.3) * 0.35, 0, Math.sin(b * PI / 4 + i * 1.9) * 0.5); m.material.color.copy(pal(bar + i)); m.material.opacity = 0.12 + kick * 0.1; });
  for (const c of club.cones) { const k = 1 + kick * 0.25; c.scale.set(k, 1, k); }
  club.strips.forEach((m, i) => { m.material.emissive.copy(pal(bar + i * 2)); m.material.emissiveIntensity = 0.6 + kick * 0.8; });
  for (const d of club.disks) d.rotation.y -= dt * 3.5;
  if ((club.ledT -= dt) <= 0) { club.ledT = 0.08; drawLed(b); }
  const ph = b * PI;
  if (club.dj) { // tempoyla başını sallar; sol el pikapta, dört ölçüde bir sağ el havaya
    const u = club.dj.userData;
    u.head.rotation.x = 0.12 + Math.abs(Math.sin(ph)) * 0.2;
    u.arms[1].rotation.set(-1.05, 0, 0.25 + Math.sin(ph * 2) * 0.05);
    if (bar % 4 === 3) u.arms[0].rotation.set(-2.8 + Math.sin(ph) * 0.3, 0, 0); else u.arms[0].rotation.set(-1.0, 0, -0.25 + Math.sin(b * 1.7) * 0.12);
    club.dj.position.y = 0.45 + Math.abs(Math.sin(ph)) * 0.03;
  }
  // güneşlenenler: nefes alır, başını çevirir; arada eliyle gözünü güneşten korur ya da dizini kırar (heykel gibi yatmasın)
  for (const S of club.sun) {
    const u = S.o.userData; M.breathe(S.o, G.time, 0.35);
    if ((S.t -= dt) <= 0) { S.t = rand(5, 10); S.k = Math.floor(rand(0, 3)); S.a = 2.6; }
    const e = S.a > 0 ? Math.min(1, S.a / 0.5, (2.6 - S.a) / 0.5) : 0; S.a = Math.max(0, S.a - dt);
    u.arms[1].rotation.x = S.k === 0 ? -2.5 * e : 0; u.arms[0].rotation.x = S.k === 1 ? -0.5 * e : 0; u.legs[1].rotation.x = S.k === 2 ? -0.45 * e : 0;
  }
  if (club.bart) { // kokteyl çalkalar
    const u = club.bart.userData, w = Math.sin(G.time * 13);
    u.arms[0].rotation.set(-1.7 + w * 0.3, 0, 0); u.arms[1].rotation.set(-1.7 - w * 0.3, 0, 0); u.head.rotation.z = Math.sin(ph) * 0.06;
  }
}
export function updateClub(dt) {
  if (!club.on) return;
  // vuruş eksiye düşmez (2026-11-03 kullanıcı: "beach club'ın oraya gidince donuyor"): şarkının son notası planlanınca calgi.js loop0'ı
  // bir sonraki turun başına (ileriye) alır, o arada vuruş birkaç kare eksi kalır; PAL[-1] boş gelip hata veriyor, oyun döngüsü duruyordu
  club.dt = dt; club.beat = Math.max(0, beatOf('club') || 0);
  const p = G.player && G.player.position;
  if (p && Math.hypot(p.x - DJ.x, p.z - DJ.z) < 75) animateClub(dt);
  for (const Y of club.yachts) yachtStep(Y, dt);
  for (const F of club.floats) { F.f.position.y = -0.18 + Math.sin(G.time * 1.4 + F.ph) * 0.05; F.f.rotation.z += dt * 0.15; }
  if ((club.t -= dt * repMul()) <= 0) { club.t = rand(3.5, 6.5); if (walkers() < 9) visitor(V(FROM.x + rand(-1, 1), 0, FROM.z + rand(-0.3, 0.3)), null); }
}
window.__club = () => ({ on: club.on, n: club.list.length, st: club.list.map((c) => c.state), yachts: club.yachts.map((Y) => ({ st: Y.st, x: +Y.o.position.x.toFixed(1), z: +Y.o.position.z.toFixed(1), aboard: Y.aboard })), beat: +club.beat.toFixed(2) }); // test kancası
