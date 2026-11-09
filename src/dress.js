// Süsleme: bölgelerin havasını veren, oyunun işleyişine karışmayan donatılar. Pazar ve tatil köyünde süs bayrakları
// ve ışık zincirleri; dükkânın önünde çiçek kasaları ve fırsat panosu; bahçede kulübe, korkuluk, el arabası; sahilde
// şamandıra hattı; ahırda saman, ofiste koli yığını, enerji parkında tabela; han duvarlarında asılı kilimler; tatil evlerinin önünde çiçeklik ve ev numarası.
// Her şey bölgenin kendi içeriğine eklenir (bölge kilitliyken ya da seviyesi gelmeden görünmez); engeller bölgenin
// çarpışma listesine girer, bölge açılınca etkinleşir. world.js buildWorld bölgeler kurulunca dressWorld'ü çağırır
import * as THREE from 'three';
import * as M from './models.js';
import { G } from './game.js';
import { textTex } from './tex.js';
import { HOUSE_X } from './resort.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FLAGS = ['#e8604c', '#ffd23f', '#3ec1b5', '#9c8cf0', '#7ed957', '#ff9f43'];

function put(R, o, x, y, z, ry = 0) {
  o.position.set(x, y, z); o.rotation.y = ry;
  o.traverse((m) => { if (m.isMesh && !(m.material instanceof THREE.MeshBasicMaterial)) m.castShadow = true; });
  R.content.add(o);
  return o;
}
function col(R, x0, x1, z0, z1) { const c = [x0, x1, z0, z1]; R.colliders.push(c); if (R.unlocked) G.colliders.push(c); }

// ---------- modeller ----------
// iki direk arasında sarkan ip (zincir eğrisi) boyunca bir şey dizer; ip ince beyaz tüp
function sagLine(ax, az, bx, bz, h, sag, step, each) {
  const g = new THREE.Group(), dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
  const at = (t) => V(ax + dx * t, h - sag * 4 * t * (1 - t), az + dz * t);
  const pts = []; for (let i = 0; i <= 24; i++) pts.push(at(i / 24));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.016, 4), M.mat('#f4f1ea')));
  const n = Math.max(2, Math.round(L / step));
  for (let i = 1; i < n; i++) each(g, at(i / n), i, Math.atan2(dz, dx));
  return g;
}
const TRI = (() => { const t = new THREE.BufferGeometry(); t.setAttribute('position', new THREE.Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.36, 0], 3)); t.computeVertexNormals(); return t; })();
// süs bayrakları: renkli üçgen flamalar
function bunting(ax, az, bx, bz, h, sag = 0.7) {
  return sagLine(ax, az, bx, bz, h, sag, 0.8, (g, p, i, ang) => {
    const f = new THREE.Mesh(TRI, new THREE.MeshStandardMaterial({ color: FLAGS[i % FLAGS.length], side: THREE.DoubleSide, roughness: 0.8 }));
    f.position.copy(p); f.rotation.set(0.12 * Math.sin(i * 1.7), -ang, 0); f.scale.setScalar(1.8); g.add(f); // uzaktan da seçilsin
  });
}
// ışık zinciri: sıcak sarı küçük ampuller
function lights(ax, az, bx, bz, h, sag = 0.5) {
  const bulb = M.mat('#fff1b8', { emissive: '#ffcf5a', ei: 0.9 });
  return sagLine(ax, az, bx, bz, h, sag, 0.7, (g, p) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bulb); b.position.copy(p).add(V(0, -0.07, 0)); g.add(b); });
}
// bahçe kulübesi: tahta duvar, eğik çatı, kapı ve pencere; önünde sulama kabı
function shed() {
  const g = new THREE.Group(), plank = M.mat('#b07a45'), dark = M.mat('#7a4f2b');
  M.rbox(2.0, 1.7, 1.5, 0.04, plank, 0, 0.85, 0, g);
  for (let i = -3; i <= 3; i++) M.rbox(0.03, 1.66, 1.52, 0.01, dark, i * 0.28, 0.85, 0, g); // tahta çizgileri
  const roof = M.rbox(2.3, 0.1, 1.9, 0.03, M.mat('#c8643b'), 0, 1.85, 0, g); roof.rotation.z = 0.18;
  M.rbox(0.62, 1.2, 0.05, 0.02, dark, -0.45, 0.62, 0.77, g); // kapı
  M.rbox(0.5, 0.42, 0.04, 0.02, M.mat('#bfe6ff', { rough: 0.2 }), 0.5, 1.12, 0.77, g); // pencere
  M.rbox(0.58, 0.06, 0.06, 0.01, M.mat('#ffffff'), 0.5, 1.12, 0.8, g);
  const can = new THREE.Group(); can.position.set(0.55, 0, 1.05); g.add(can); // sulama kabı
  M.cyl(0.14, 0.16, 0.3, 10, M.mat('#3aa6a0'), 0, 0.15, 0, can);
  const sp = M.cyl(0.025, 0.035, 0.32, 6, M.mat('#3aa6a0'), 0.2, 0.24, 0, can); sp.rotation.z = -0.9;
  M.rbox(0.36, 0.5, 0.36, 0.04, M.mat('#c9a06b'), 0.95, 0.25, 1.0, g); // yanında çuval
  return g;
}
// bostan korkuluğu: çapraz direk, çuval kafa, hasır şapka, ekose gömlek
function scarecrow() {
  const g = new THREE.Group(), wood = M.mat('#8a5a33');
  M.cyl(0.05, 0.06, 1.9, 6, wood, 0, 0.95, 0, g);
  M.rbox(1.3, 0.07, 0.07, 0.02, wood, 0, 1.35, 0, g);
  M.rbox(0.56, 0.6, 0.3, 0.08, M.mat('#c0392b'), 0, 1.2, 0, g); // gömlek
  for (const s of [-1, 1]) M.rbox(0.42, 0.16, 0.18, 0.05, M.mat('#c0392b'), s * 0.46, 1.35, 0, g);
  for (const s of [-1, 1]) M.cyl(0.06, 0.02, 0.18, 5, M.mat('#e8c35a'), s * 0.72, 1.35, 0, g).rotation.z = s * PI / 2; // saman eller
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.mat('#d9b98a')); head.position.y = 1.72; g.add(head);
  for (const s of [-1, 1]) M.rbox(0.04, 0.04, 0.02, 0.01, M.mat('#2a2a2a'), s * 0.07, 1.76, 0.19, g);
  M.cyl(0.36, 0.36, 0.03, 14, M.mat('#e8c35a'), 0, 1.86, 0, g);
  M.cyl(0.14, 0.18, 0.2, 10, M.mat('#e8c35a'), 0, 1.97, 0, g);
  return g;
}
// el arabası: domates yüklü
function wheelbarrow() {
  const g = new THREE.Group();
  M.rbox(0.8, 0.32, 0.6, 0.06, M.mat('#3a7bd5'), 0, 0.42, 0, g);
  const w = M.cyl(0.18, 0.18, 0.08, 12, M.mat('#2b2f33'), 0.48, 0.18, 0, g); w.rotation.x = PI / 2;
  for (const s of [-1, 1]) { const h = M.rbox(0.9, 0.05, 0.05, 0.01, M.mat('#8a5a33'), -0.55, 0.5, s * 0.24, g); h.rotation.z = -0.25; M.cyl(0.03, 0.03, 0.3, 5, M.mat('#8a5a33'), -0.2, 0.15, s * 0.22, g); }
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), M.mat('#e8473c')); t.position.set(-0.2 + (i % 3) * 0.2, 0.62, -0.12 + Math.floor(i / 3) * 0.24); g.add(t); }
  return g;
}
// denizde şamandıra hattı: halatla bağlı kırmızı-beyaz toplar
function buoyLine(x0, x1, z) {
  const g = new THREE.Group(), rope = [];
  for (let x = x0, i = 0; x <= x1; x += 1.8, i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), M.mat(i % 2 ? '#ffffff' : '#e8473c'));
    b.position.set(x, -0.08, z + Math.sin(x * 0.3) * 0.4); g.add(b); rope.push(b.position.clone().setY(-0.05));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope), rope.length * 4, 0.02, 4), M.mat('#f4e3b0')));
  return g;
}
// kilim deseni: kırmızı zemin, ortada baklava dizisi, kenarlarda zikzak; tohumla renk değişir
const kilimMaps = {};
function kilimMap(k) {
  if (kilimMaps[k]) return kilimMaps[k];
  const P = [['#a3262a', '#f2c14e', '#1f4e79', '#f4ead5'], ['#1f4e79', '#e8604c', '#f2c14e', '#f4ead5'], ['#5a2d6b', '#f2c14e', '#3ea38b', '#f4ead5']][k % 3];
  const c = document.createElement('canvas'); c.width = 128; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = P[0]; g.fillRect(0, 0, 128, 192);
  g.fillStyle = P[3]; g.fillRect(8, 8, 112, 176); g.fillStyle = P[0]; g.fillRect(14, 14, 100, 164);
  for (let i = 0; i < 3; i++) {
    const cy = 44 + i * 52;
    g.fillStyle = P[1]; g.beginPath(); g.moveTo(64, cy - 24); g.lineTo(98, cy); g.lineTo(64, cy + 24); g.lineTo(30, cy); g.closePath(); g.fill();
    g.fillStyle = P[2]; g.beginPath(); g.moveTo(64, cy - 12); g.lineTo(82, cy); g.lineTo(64, cy + 12); g.lineTo(46, cy); g.closePath(); g.fill();
  }
  g.fillStyle = P[1]; for (let y = 14; y < 178; y += 10) { g.fillRect(16, y, 5, 5); g.fillRect(107, y + 5, 5, 5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (kilimMaps[k] = t);
}
// duvara asılı kilim: üstte tahta çubuk, altta püsküller
function hangingKilim(w, h, k) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: kilimMap(k), roughness: 0.9 })); g.add(p);
  M.cyl(0.04, 0.04, w + 0.3, 6, M.mat('#7a4f2b'), 0, h / 2 + 0.04, 0.03, g).rotation.z = PI / 2;
  for (let x = -w / 2 + 0.08; x < w / 2; x += 0.14) M.rbox(0.03, 0.12, 0.01, 0.005, M.mat('#f4ead5'), x, -h / 2 - 0.06, 0.01, g);
  return g;
}
// tatil evi önü: alçak taş kenarlı çiçeklik, yanında ev numarası tabelası
function houseBed(n) {
  const g = new THREE.Group();
  M.rbox(2.4, 0.22, 0.8, 0.08, M.mat('#e9dfcf'), 0, 0.11, 0, g);
  M.rbox(2.2, 0.06, 0.62, 0.03, M.mat('#6b4a2e'), 0, 0.22, 0, g);
  for (const x of [-0.6, 0.55]) { const f = M.makeFlowers(); f.scale.set(0.8, 1, 0.45); f.position.set(x, 0.18, 0); g.add(f); }
  const b = M.makeBush(0.4, '#4fae58'); b.position.set(0, 0.2, 0); g.add(b);
  M.cyl(0.04, 0.04, 1.0, 6, M.mat('#7a4f2b'), -1.45, 0.5, 0, g);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshBasicMaterial({ map: textTex(`${n}`, { bg: '#3ec1b5', fg: '#ffffff', w: 128, h: 96 }) }));
  s.position.set(-1.45, 0.95, 0.05); g.add(s);
  return g;
}

// ---------- yerleşim ----------
function dressKoy(R) {
  // çiçek kasası (11,25/-9,8) ve günün fırsatı panosu (11,4/-7,6) eski bakkalın doğu duvarının dibindeydi; market büyüyünce raf
  // sıralarının arasında kaldı: kaldırıldı (2026-11-03 kullanıcı: "rafların arasında yerde duran 2 obje var, adam takılıyor geçemiyor")
  // bahçenin doğu ucu boş: bahçe genişletmesinin arsası (expand-west.js)
}
function dressPazar(R) {
  // meydanın lambalarına bağlı süs bayrakları
  put(R, bunting(24, -3, 52.45, -3, 3.0, 0.8), 0, 0, 0);
  put(R, bunting(24, 10.8, 52.45, 3.2, 3.0, 0.9), 0, 0, 0);
}
function dressSahil(R) {
  put(R, buoyLine(-14, 51, 38.2), 0, 0, 0); // yüzme alanının sınırı
}
function dressHan(R) {
  // kuzey duvarın kemer araları ve yan duvarların payandalarında asılı kilimler
  [-6, -2, 2, 6].forEach((x, i) => put(R, hangingKilim(1.3, 1.9, i), x, 2.25, -54.06)); // duvarın iç yüzü -54.15 (pah dahil)
  [-48, -43].forEach((z, i) => { put(R, hangingKilim(1.4, 1.5, i + 1), -10.06, 1.65, z, PI / 2); put(R, hangingKilim(1.4, 1.5, i + 2), 10.06, 1.65, z, -PI / 2); });
}
function dressTatil(R) {
  // evlerin önünde çiçeklik ve ev numarası (evin yeri boşken de bahçe düzeni görünür)
  HOUSE_X.forEach((x, i) => { put(R, houseBed(i + 1), x, 0, 17.3); col(R, x - 1.55, x + 1.25, 16.95, 17.65); });
  // tahta yol boyunca lambalar arasında ışık zinciri, iki uçta palmiye
  put(R, lights(76.45, 16.2, 91.45, 16.2, 2.95, 0.55), 0, 0, 0); // lambalar patikaların kenarında (resort.js)
  put(R, lights(91.45, 16.2, 98.95, 16.2, 2.95, 0.4), 0, 0, 0);
  for (const [x, z] of [[68.3, 17.4], [104.2, 17.4]]) { put(R, M.makePalm(1.0, 0.2), x, 0, z, Math.random() * 6); col(R, x - 0.25, x + 0.25, z - 0.25, z + 0.25); }
}

// yeni alanlar: ahırın tarla köşesinde saman yığını, enerji parkının yol kenarında tabela
function dressNew(Rg) {
  const A = Rg.atlar;
  // saman balyaları tarlanın kuzeybatı köşesinde: tarlaya güneyden (harman makinesinin batısından) giriş açık kalır
  for (const [x, y, z] of [[-57.9, 0, -2.75], [-57.9, 0, -1.85], [-57.9, 0.95, -2.3]]) put(A, M.makeHay(), x, y, z, PI / 2);
  col(A, -58.6, -57.2, -3.25, -1.35);
  const E = Rg.enerji;
  put(E, M.makeSign('⚡ BEMIS ENERJİ PARKI', '#c8102e', 3.4, 0.7), -71.2, 0, -59.95);
  for (const x of [-72.75, -69.65]) col(E, x - 0.1, x + 0.1, -60.05, -59.85);
}

export function dressWorld() {
  const Rg = G.regions;
  dressKoy(Rg.koy); dressPazar(Rg.pazar); dressSahil(Rg.sahil); dressHan(Rg.han); dressTatil(Rg.tatil); dressNew(Rg);
}
