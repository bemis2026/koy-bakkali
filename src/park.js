// Çocuk parkı (2026-11-09). Kullanıcı: "e ticaret komple kaldır. o alanı değerlendir çocuk parkı olabilir". Kaldırılan e-ticaret
// ofisinin yerinde: ana yolun güney kaldırımı ile at ahırı arasında, benzinlik avlusunun doğusunda, bisiklet parkının batısında.
// Kilitsiz, baştan açık süs: salıncak, kaydırak, atlıkarınca, tahterevalli, kum havuzu, seksek, yaylı at; çocuklar oynar, banklarda
// bir anne ile bir dede bakar. Yağışta herkes evine gider (hava.js havaIslak). Kamera güneyden bakar: oyuncuyu örtecek yüksek parça
// yok (kaydırak kulesi 2 m, salıncak çerçevesi ince direk), çit diz boyu ve yalnız yol (kuzey) ile benzinlik (batı) kenarında.
// world.js buildPark'ı kurar, main.js updatePark'ı her karede çağırır
import * as THREE from 'three';
import * as M from './models.js';
import { G, popIn } from './game.js';
import { texRep, textTex } from './tex.js';
import { havaIslak } from './hava.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PARK = [-62.4, -42.6, -14.4, -4.4]; // yürünen alan: kuzeyde yolun kaldırımına, doğuda bisiklet parkının cebine bitişik
const GATE = [-54.0, -51.2]; // kuzey çitinde yoldan giriş
const CX = (PARK[0] + PARK[1]) / 2, CZ = (PARK[2] + PARK[3]) / 2;
const KID = 0.62; // çocuk ölçeği (beach.js kum çocuğu gibi)
const people = [], acts = [];
let root = null, shown = true, T = 0;

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const kidLook = () => ({ ...M.touristLook(), shades: false, pants: pick(['#3d7dd8', '#e8604c', '#3a4a6b', '#f6c343', '#8fbf5a', '#c77dd8']) });
const col = (x0, x1, z0, z1) => G.colliders.push([x0, x1, z0, z1]);
function put(o, x, y, z, ry = 0, parent = root) { o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; }
const moving = (g) => { g.traverse((o) => { o.userData.bkNo = true; }); return g; }; // kımıldayan parça: perf.js birleştirmesin
const arms = (k, x) => { for (const a of k.userData.arms) a.rotation.x = x; };
const sit = (k) => { for (const l of k.userData.legs) l.rotation.set(-1.45, 0, 0); };
// oturan kişi: bacaklar öne, kalça y yüksekliğindeki oturakta (ebeveyninin içinde)
function sitter(look, scale, y) {
  const o = M.makeCharacter(look);
  o.scale.setScalar(scale); sit(o); o.position.y = y - 0.62 * scale;
  people.push(o);
  return o;
}
const walker = (look, scale) => { const o = M.makeCharacter(look); o.scale.setScalar(scale); people.push(o); return o; };

// ---------- zemin, çit, tabela ----------
function ground() {
  const [x0, x1, z0, z1] = PARK, W = x1 - x0, D = z1 - z0;
  M.rbox(W - 0.1, 0.04, D - 0.1, 0.01, M.mat('#efe2c2', { map: texRep('sand', W / 3, D / 3) }), CX, 0.02, CZ, root); // ince kum
  const curb = M.mat('#d9d3c7');
  for (const [w, d, x, z] of [[W, 0.18, CX, z0 + 0.09], [W, 0.18, CX, z1 - 0.09], [0.18, D, x0 + 0.09, CZ], [0.18, D, x1 - 0.09, CZ]]) M.rbox(w, 0.08, d, 0.02, curb, x, 0.04, z, root);
  // salıncağın, kaydırağın, tahterevallinin ve yaylı atların altında yumuşak kauçuk zemin; atlıkarıncanın altında yuvarlak
  for (const [x, z, w, d, c] of [[-59.2, -9.6, 3.4, 4.6, '#5aa6d8'], [-55.6, -10.6, 2.0, 5.6, '#ef8a4a'], [-46.2, -7.2, 4.0, 1.8, '#e0645a'], [-60.2, -5.5, 3.6, 1.6, '#f2c94c']]) M.rbox(w, 0.03, d, 0.1, M.mat(c, { rough: 0.95 }), x, 0.045, z, root);
  M.cyl(2.05, 2.05, 0.03, 28, M.mat('#6cbf6a', { rough: 0.95 }), -50.6, 0.045, -7.6, root);
  // seksek: girişin içinde, tebeşir renginde kareler (1, 2, 3-4, 5, 6-7, 8 ve gök)
  const chalk = ['#ffffff', '#ffd6e8', '#d6ecff', '#fff3c4'];
  HOP.forEach(([dx, dz], i) => M.rbox(0.4, 0.008, 0.4, 0.04, M.mat(chalk[i % chalk.length], { rough: 1 }), HOP_X + dx, 0.046, HOP_Z - dz, root));
  M.cyl(0.32, 0.32, 0.008, 16, M.mat('#ffffff', { rough: 1 }), HOP_X, 0.046, HOP_Z - 3.25, root);
}
const HOP_X = -52.6, HOP_Z = -10.2, HOP = [[0, 0], [0, 0.45], [-0.22, 0.9], [0.22, 0.9], [0, 1.35], [-0.22, 1.8], [0, 2.25], [0.22, 1.8], [0, 2.7]];
const LAND = [[-0.5, 1], [0, 0], [0.45, 0], [0.9, 1], [1.35, 0], [1.8, 1], [2.25, 0], [2.7, 0], [3.25, 1]]; // sekerken basılan yerler: [uzaklık, iki ayak mı]
// diz boyu çit: renkli tahtalar tek çizimde (InstancedMesh), yolda giriş boşluğu
function fence() {
  const [x0, x1, z0, z1] = PARK, zf = z0 + 0.14, xf = x0 + 0.14, pts = [];
  for (let x = x0 + 0.2; x <= x1 - 0.1; x += 0.24) if (x < GATE[0] - 0.1 || x > GATE[1] + 0.1) pts.push([x, zf]);
  for (let z = z0 + 0.4; z <= z1 - 0.15; z += 0.24) pts.push([xf, z]);
  const geo = new THREE.BoxGeometry(0.09, 0.62, 0.05); geo.translate(0, 0.31, 0);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), pts.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), cols = ['#ff8a65', '#f6c343', '#5bb8e8', '#8fbf5a', '#c77dd8', '#ffffff'];
  pts.forEach(([x, z], i) => { im.setMatrixAt(i, m4.makeTranslation(x, 0, z)); im.setColorAt(i, c.set(cols[i % cols.length])); });
  im.castShadow = true; im.receiveShadow = true; root.add(im);
  const rail = M.mat('#ffffff');
  for (const y of [0.18, 0.46]) {
    for (const [a, b] of [[x0 + 0.1, GATE[0] - 0.05], [GATE[1] + 0.05, x1 - 0.05]]) M.rbox(b - a, 0.06, 0.04, 0.01, rail, (a + b) / 2, y, zf - 0.05, root);
    M.rbox(0.04, 0.06, z1 - z0 - 0.3, 0.01, rail, xf - 0.05, y, (z0 + z1) / 2 + 0.1, root);
  }
  col(x0, GATE[0] - 0.05, z0, zf + 0.12); col(GATE[1] + 0.05, x1, z0, zf + 0.12); col(x0, xf + 0.12, z0, z1);
  for (const x of [GATE[0] - 0.06, GATE[1] + 0.06]) { // giriş direkleri, tepelerinde top
    M.rbox(0.16, 0.9, 0.16, 0.03, M.mat('#3d7dd8'), x, 0.45, zf, root);
    M.sph(0.12, M.mat(x < CX ? '#e8473c' : '#f6c343'), x, 0.98, zf, root, 12, 8);
  }
  // tabela çitin üstünde, güneye (kameraya) bakar; çitten yüksek değil
  const s = M.rbox(2.4, 0.5, 0.06, 0.03, M.mat('#ffffff', { map: textTex('ÇOCUK PARKI', { bg: '#3fae6b', border: '#ffffff', w: 640, h: 134 }) }), -49.4, 0.42, zf + 0.06, root);
  s.castShadow = true;
}

// ---------- oyun aletleri ----------
// salıncak: kiriş z boyunca, iki uçta A ayak; salıncaklar x boyunca sallanır (kameradan yandan görünür)
function swings(x, z) {
  const g = put(new THREE.Group(), x, 0, z), steel = M.mat('#e8473c', { rough: 0.4 }), H = 2.2, L = 1.7, sp = 0.9;
  for (const sz of [-1.85, 1.85]) for (const sx of [-1, 1]) { const p = M.cyl(0.05, 0.05, Math.hypot(H, sp), 8, steel, sx * sp / 2, H / 2, sz, g); p.rotation.z = sx * Math.atan2(sp, H); }
  M.cyl(0.06, 0.06, 3.8, 10, steel, 0, H, 0, g).rotation.x = PI / 2;
  [-0.85, 0.85].forEach((sz, i) => {
    const piv = new THREE.Group(); piv.position.set(0, H, sz); g.add(piv);
    for (const dz of [-0.24, 0.24]) M.cyl(0.012, 0.012, L, 4, M.mat('#9aa3ab', { rough: 0.3 }), 0, -L / 2, dz, piv);
    M.rbox(0.36, 0.05, 0.56, 0.02, M.mat(i ? '#f6c343' : '#3d7dd8'), 0, -L, 0, piv); // oturak
    const kid = sitter(kidLook(), KID, -L + 0.03); kid.rotation.y = PI / 2; piv.add(kid);
    moving(piv);
    acts.push({ kind: 'swing', piv, kid, ph: i * 1.9, amp: 0.52 - i * 0.1 });
  });
  col(x - 1.4, x + 1.4, z - 2.0, z + 2.0);
}
// kaydırak: kule (x, z), merdiven kuzeyde, kaydırak güneye (kameraya doğru) iner
const SP = 1.35; // kule döşemesi
function slide(x, z) {
  const g = put(new THREE.Group(), x, 0, z), post = M.mat('#3d7dd8', { rough: 0.4 }), wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.6) });
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) M.cyl(0.06, 0.06, SP + 0.65, 8, post, dx, (SP + 0.65) / 2, dz, g);
  M.rbox(1.3, 0.08, 1.3, 0.02, wood, 0, SP, 0, g);
  for (const dx of [-0.6, 0.6]) M.rbox(0.05, 0.5, 1.2, 0.02, M.mat('#f6c343'), dx, SP + 0.3, 0, g); // yan paneller
  M.rbox(1.2, 0.06, 0.05, 0.02, post, 0, SP + 0.58, -0.6, g);
  // merdiven: iki eğik dikme, beş basamak
  const lz0 = -1.45, lz1 = -0.62, lean = Math.atan2(lz1 - lz0, SP), ll = Math.hypot(SP, lz1 - lz0);
  for (const dx of [-0.26, 0.26]) M.cyl(0.035, 0.035, ll + 0.5, 6, post, dx, (SP + 0.5) / 2, (lz0 + lz1) / 2, g).rotation.x = lean;
  for (let i = 1; i <= 5; i++) { const f = i / 6; M.cyl(0.025, 0.025, 0.52, 6, M.mat('#c9ced4'), 0, f * SP, lz0 + f * (lz1 - lz0), g).rotation.z = PI / 2; }
  // kaydırak oluğu ve kenarları, sonunda düz çıkış
  const cz0 = 0.65, cz1 = 3.1, y1 = 0.3, cl = Math.hypot(cz1 - cz0, SP - y1), ca = Math.atan2(SP - y1, cz1 - cz0);
  const chute = new THREE.Group(); chute.position.set(0, (SP + y1) / 2 + 0.03, (cz0 + cz1) / 2); chute.rotation.x = ca; g.add(chute);
  M.rbox(0.62, 0.05, cl, 0.02, M.mat('#f6c343', { rough: 0.3 }), 0, 0, 0, chute);
  for (const dx of [-0.33, 0.33]) M.rbox(0.05, 0.18, cl, 0.02, M.mat('#e8473c', { rough: 0.3 }), dx, 0.08, 0, chute);
  M.rbox(0.62, 0.05, 0.5, 0.02, M.mat('#f6c343', { rough: 0.3 }), 0, y1, cz1 + 0.25, g);
  col(x - 0.7, x + 0.7, z + lz0 - 0.1, z + 0.7); col(x - 0.38, x + 0.38, z + 0.7, z + cz1 + 0.5);
  const kid = walker(kidLook(), KID); put(kid, x, 0, z + 3.7);
  acts.push({ kind: 'slide', kid, x, z, st: 'rest', t: 0, path: [], lz0, cz0, cz1, y1 });
}
// atlıkarınca: dört renkli dilimli disk; bir çocuk üstünde oturur, öbürü yanında koşup iter, sonra durup bekler
function merry(x, z) {
  const g = put(new THREE.Group(), x, 0, z);
  M.cyl(0.2, 0.26, 0.16, 12, M.mat('#8a96a3'), 0, 0.08, 0, g);
  const disc = new THREE.Group(); disc.position.y = 0.16; g.add(disc);
  ['#e8473c', '#f6c343', '#3d7dd8', '#3fae6b'].forEach((c, i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.1, 12, 1, false, (i * PI) / 2, PI / 2), M.mat(c)); m.position.y = 0.05; m.castShadow = true; m.receiveShadow = true; disc.add(m); });
  M.cyl(0.06, 0.06, 0.8, 8, M.mat('#c9ced4', { rough: 0.3 }), 0, 0.5, 0, disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 6, 28), M.mat('#c9ced4', { rough: 0.3 })); ring.rotation.x = PI / 2; ring.position.y = 0.82; disc.add(ring);
  for (let i = 0; i < 4; i++) { const a = (i * PI) / 2 + PI / 4; const s = M.cyl(0.025, 0.025, 0.95, 6, M.mat('#c9ced4'), Math.sin(a) * 0.47, 0.82, Math.cos(a) * 0.47, disc); s.rotation.order = 'YXZ'; s.rotation.set(PI / 2, a, 0); } // göbekten halkaya kollar
  for (let i = 0; i < 4; i++) { const a = (i * PI) / 2 + PI / 4; M.cyl(0.025, 0.025, 0.72, 6, M.mat('#c9ced4'), Math.sin(a) * 0.95, 0.46, Math.cos(a) * 0.95, disc); }
  const rider = sitter(kidLook(), KID, 0.11); rider.position.x = 0; rider.position.z = 0.55; disc.add(rider);
  moving(disc);
  const pusher = walker(kidLook(), KID); root.add(pusher);
  acts.push({ kind: 'merry', disc, rider, pusher, x, z, w: 0.6, push: true, t: 5, ang: PI * 0.4 });
  col(x - 1.35, x + 1.35, z - 1.35, z + 1.35);
}
// tahterevalli: x boyunca tahta, iki uçta karşılıklı oturan çocuklar
function seesaw(x, z) {
  const g = put(new THREE.Group(), x, 0, z);
  M.rbox(0.34, 0.46, 0.5, 0.04, M.mat('#3d7dd8'), 0, 0.23, 0, g);
  M.cyl(0.06, 0.06, 0.56, 8, M.mat('#8a96a3'), 0, 0.5, 0, g).rotation.x = PI / 2;
  const plank = new THREE.Group(); plank.position.y = 0.54; g.add(plank);
  M.rbox(3.2, 0.07, 0.3, 0.02, M.mat('#e8473c'), 0, 0, 0, plank);
  const kids = [-1, 1].map((sx) => {
    M.rbox(0.42, 0.05, 0.34, 0.02, M.mat('#f6c343'), sx * 1.38, 0.06, 0, plank);
    M.cyl(0.025, 0.025, 0.34, 6, M.mat('#c9ced4'), sx * 1.08, 0.2, 0, plank);
    M.cyl(0.022, 0.022, 0.3, 6, M.mat('#c9ced4'), sx * 1.08, 0.36, 0, plank).rotation.x = PI / 2;
    const k = sitter(kidLook(), KID, 0.09); k.position.x = sx * 1.38; k.rotation.y = -sx * PI / 2; plank.add(k); // ortaya bakar
    return k;
  });
  moving(plank);
  acts.push({ kind: 'seesaw', plank, kids, ph: 0 });
  col(x - 1.85, x + 1.85, z - 0.4, z + 0.4);
}
// kum havuzu: tahta çerçeve, kum, kova kürek ve yarım kale; içinde kum kazan çocuk
function sandbox(x, z) {
  const W = 3.0, D = 2.4, w = M.mat('#ffffff', { map: texRep('wood', 1, 0.2) });
  for (const [bw, bd, dx, dz] of [[W, 0.16, 0, -D / 2], [W, 0.16, 0, D / 2], [0.16, D, -W / 2, 0], [0.16, D, W / 2, 0]]) M.rbox(bw, 0.26, bd, 0.03, w, x + dx, 0.13, z + dz, root);
  M.rbox(W - 0.16, 0.18, D - 0.16, 0.02, M.mat('#ecd9a6', { map: texRep('sand', 1.2, 1) }), x, 0.09, z, root);
  const castle = new THREE.Group();
  M.cyl(0.32, 0.4, 0.22, 10, M.mat('#dcc48e'), 0, 0.11, 0, castle);
  for (const [dx, dz] of [[-0.2, -0.12], [0.2, -0.12], [0, 0.18]]) M.cyl(0.08, 0.1, 0.22, 8, M.mat('#dcc48e'), dx, 0.33, dz, castle);
  put(castle, x + 0.7, 0.18, z - 0.3);
  const bucket = M.cyl(0.13, 0.1, 0.22, 10, M.mat('#e8473c'), x - 0.9, 0.29, z + 0.5, root); bucket.add(M.cyl(0.11, 0.11, 0.02, 10, M.mat('#e9c983'), 0, 0.1, 0));
  const kid = sitter(kidLook(), KID, 0.18); put(kid, x - 0.2, kid.position.y, z - 0.25, PI / 2);
  acts.push({ kind: 'dig', kid });
  col(x - W / 2 - 0.1, x + W / 2 + 0.1, z - D / 2 - 0.1, z + D / 2 + 0.1);
}
// yaylı at ve ördek: yayın üstünde sallanır
function rider(x, z, kind) {
  const g = put(new THREE.Group(), x, 0, z), steel = M.mat('#9aa3ab', { rough: 0.3 });
  M.cyl(0.18, 0.18, 0.04, 12, M.mat('#8a96a3'), 0, 0.02, 0, g);
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 5, 12), steel); t.rotation.x = PI / 2; t.position.y = 0.08 + i * 0.08; g.add(t); }
  const top = new THREE.Group(); top.position.y = 0.46; g.add(top);
  if (kind === 'at') {
    const b = M.sph(0.3, M.mat('#e8473c'), 0, 0.12, 0, top, 12, 8); b.scale.set(0.55, 0.5, 1.15);
    const n = M.rbox(0.16, 0.36, 0.16, 0.06, M.mat('#e8473c'), 0, 0.34, 0.26, top); n.rotation.x = 0.4;
    M.rbox(0.18, 0.18, 0.34, 0.07, M.mat('#e8473c'), 0, 0.5, 0.4, top);
    M.rbox(0.06, 0.2, 0.2, 0.02, M.mat('#f6c343'), 0, 0.5, 0.22, top); // yele
    for (const sx of [-0.07, 0.07]) M.cyl(0.02, 0.02, 0.3, 5, M.mat('#c9ced4'), sx * 3, 0.42, 0.3, top).rotation.z = PI / 2;
  } else {
    const b = M.sph(0.3, M.mat('#f6c343'), 0, 0.12, 0, top, 12, 8); b.scale.set(0.6, 0.55, 1.05);
    M.sph(0.15, M.mat('#f6c343'), 0, 0.42, 0.22, top, 10, 8);
    const bk = M.cyl(0.0, 0.07, 0.14, 6, M.mat('#ef8a3a'), 0, 0.4, 0.4, top); bk.rotation.x = PI / 2;
    for (const sx of [-1, 1]) M.sph(0.025, M.mat('#2a2a2a'), sx * 0.09, 0.47, 0.33, top, 6, 4);
  }
  moving(top);
  acts.push({ kind: 'rider', top, ph: Math.random() * 6 });
  col(x - 0.35, x + 0.35, z - 0.45, z + 0.55);
}
// bank ve oturan büyük: arada başını çevirip çocuklara bakar
function benchSit(x, z, look) {
  const b = put(M.makeBench(), x, 0, z, 0); col(x - 0.82, x + 0.82, z - 0.32, z + 0.38);
  const o = M.makeCharacter(look); sit(o); o.position.set(0.32, 0.47 - 0.62, 0.06); b.add(o); people.push(o);
  acts.push({ kind: 'adult', o, ph: Math.random() * 6 });
}
function fountain(x, z) { // içme çeşmesi
  const g = put(new THREE.Group(), x, 0, z), stone = M.mat('#d9d3c7');
  M.cyl(0.16, 0.2, 0.8, 10, stone, 0, 0.4, 0, g);
  M.cyl(0.26, 0.18, 0.12, 12, stone, 0, 0.86, 0, g);
  M.cyl(0.2, 0.2, 0.02, 12, M.mat('#7fc6e8', { rough: 0.1 }), 0, 0.92, 0, g);
  M.cyl(0.02, 0.02, 0.14, 6, M.mat('#c9ced4', { rough: 0.2 }), 0.12, 0.97, 0, g);
  col(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
}

export function buildPark() {
  if (root) return;
  root = new THREE.Group(); root.name = 'park'; G.scene.add(root);
  G.walkways.push(PARK.slice());
  ground(); fence();
  swings(-59.2, -9.6);
  slide(-55.6, -11.7);
  merry(-50.6, -7.6);
  seesaw(-46.2, -7.2);
  sandbox(-46.6, -11.4);
  rider(-61.0, -5.5, 'at'); rider(-59.4, -5.5, 'ordek');
  benchSit(-58.6, -13.5, { shirt: '#8a9a5a', pants: '#4a4a4a', hat: 'cap', hatColor: '#3a3a3a', skin: '#d9a87a', mustache: true }); // dede: salıncaklara bakar
  benchSit(-45.0, -13.5, { shirt: '#c94f8a', pants: '#3a4a6b', fem: true, hat: 'hair', hatColor: '#4a3020', skin: '#e8b98f' }); // anne: kum havuzuna bakar
  fountain(-43.4, -9.8);
  for (const [x, z, s] of [[-61.8, -13.7, 0.9], [-43.3, -13.7, 0.8], [-61.8, -5.0, 0.8], [-43.3, -5.0, 0.9]]) put(M.makeBush(s, '#68c15f'), x, 0, z, Math.random() * 6);
  const hop = walker(kidLook(), KID); put(hop, HOP_X, 0, HOP_Z + 0.5, PI);
  acts.push({ kind: 'hop', kid: hop, i: 0, dir: 1, t: 0, wait: 1 });
  const shade = (o) => { if (people.includes(o)) return; if (o.isMesh && !o.isInstancedMesh) { o.castShadow = true; o.receiveShadow = true; } for (const c of o.children) shade(c); };
  shade(root); // karakterlerin gölgesine dokunulmaz
  window.__park = () => ({ people: people.length, shown, acts: acts.map((a) => a.kind + (a.st ? `:${a.st}` : '')) }); // test kancası
}

// ---------- her kare ----------
const STEP = {
  swing(a) {
    const s = Math.sin(T * 2.4 + a.ph), L = a.kid.userData.legs;
    a.piv.rotation.z = a.amp * s;
    L[0].rotation.x = L[1].rotation.x = -1.45 - 0.35 * s; // öne giderken bacaklarını uzatır
    arms(a.kid, -2.5); // zincirlere tutunur
  },
  seesaw(a) {
    a.plank.rotation.z = 0.24 * Math.sin(T * 1.6);
    for (const k of a.kids) arms(k, -1.15);
  },
  dig(a) { const u = a.kid.userData; u.arms[0].rotation.x = -0.95 + Math.sin(T * 5) * 0.4; u.arms[1].rotation.x = -0.7 + Math.sin(T * 3.1) * 0.25; },
  rider(a) { a.top.rotation.x = 0.16 * Math.sin(T * 1.3 + a.ph) * Math.max(0, Math.sin(T * 0.21 + a.ph)); }, // arada rüzgârda hafifçe sallanır
  adult(a) { const u = a.o.userData; u.head.rotation.y = 0.55 * Math.sin(T * 0.33 + a.ph); u.arms[1].rotation.x = -0.35 + 0.15 * Math.sin(T * 0.7 + a.ph); },
  merry(a, dt) {
    if ((a.t -= dt) <= 0) { a.push = !a.push; a.t = a.push ? 5 + Math.random() * 3 : 4 + Math.random() * 2; }
    a.w += ((a.push ? 1.3 : 0.2) - a.w) * Math.min(1, dt * (a.push ? 0.9 : 0.3));
    a.disc.rotation.y += a.w * dt;
    arms(a.rider, -1.0);
    const k = a.pusher;
    if (a.push) a.ang += a.w * dt; // iterken diskle birlikte koşar, dururken yerinde bekler
    k.position.set(a.x + Math.sin(a.ang) * 1.7, 0, a.z + Math.cos(a.ang) * 1.7);
    k.rotation.y = a.push ? a.ang + PI / 2 : a.ang + PI; // koşarken dönüş yönüne, beklerken atlıkarıncaya bakar
    M.animateCharacter(k, a.push ? Math.min(1, (a.w * 1.7) / 2.4) : 0, dt, false, a.push);
    if (a.push) arms(k, -1.3);
  },
  hop(a, dt) { // seksek: tek karelere tek ayakla, çift karelere iki ayakla sekerek göğe varır, döner, geri seker
    const k = a.kid, L = k.userData.legs, last = LAND.length - 1;
    M.animateCharacter(k, 0, dt, false);
    if (a.wait > 0) { a.wait -= dt; return; }
    a.t += dt;
    const f = Math.min(1, a.t / 0.42), p0 = LAND[a.i], p1 = LAND[a.i + a.dir];
    k.position.set(HOP_X, 0.16 * Math.sin(PI * f), HOP_Z - (p0[0] + (p1[0] - p0[0]) * f));
    k.rotation.y = a.dir > 0 ? PI : 0;
    const two = f > 0.5 ? p1[1] : p0[1];
    L[0].rotation.set(two ? 0 : -0.15, 0, two ? 0.22 : 0); L[1].rotation.set(two ? 0 : -1.0, 0, two ? -0.22 : 0);
    if (f >= 1) { a.t = 0; a.i += a.dir; if (a.i === last || a.i === 0) { a.dir = -a.dir; a.wait = 0.8 + Math.random(); } }
  },
  slide(a, dt) { // merdivenden çıkar, oturup kayar, koşup yeniden merdivene gider
    const k = a.kid, p = k.position, { x, z } = a;
    a.t += dt;
    const next = (st) => { a.st = st; a.t = 0; };
    switch (a.st) {
      case 'run': {
        const q = a.path[0], dx = q[0] - p.x, dz = q[1] - p.z, d = Math.hypot(dx, dz), st = 2.4 * dt;
        if (d > 1e-3) k.rotation.y = Math.atan2(dx, dz);
        if (d <= st) { p.x = q[0]; p.z = q[1]; a.path.shift(); if (!a.path.length) next('climb'); } else { p.x += (dx / d) * st; p.z += (dz / d) * st; }
        p.y = 0;
        M.animateCharacter(k, 0.85, dt, false, true);
        break;
      }
      case 'climb': {
        const f = Math.min(1, a.t / 1.4);
        p.set(x, f * SP, z + a.lz0 - 0.1 + f * 0.9); k.rotation.y = 0;
        M.animateCharacter(k, 0.4, dt, false);
        arms(k, -2.0 + Math.sin(a.t * 9) * 0.35);
        if (f >= 1) next('top');
        break;
      }
      case 'top': {
        const f = Math.min(1, a.t / 0.5);
        p.set(x, SP + 0.04, z - 0.65 + f * 1.2);
        M.animateCharacter(k, 0.35, dt, false);
        if (f >= 1) { sit(k); next('perch'); }
        break;
      }
      case 'perch': p.set(x, SP + 0.06 - 0.62 * KID, z + 0.6); if (a.t > 0.4) next('down'); break;
      case 'down': {
        const f = Math.min(1, a.t / 1.0), e = f * f; // hızlanarak iner
        const zz = z + a.cz0 + (a.cz1 - a.cz0) * e, y = SP + (a.y1 - SP) * e + 0.06;
        p.set(x, y - 0.62 * KID, zz);
        arms(k, -2.7); // eller havada
        if (f >= 1) next('out');
        break;
      }
      case 'out': { const f = Math.min(1, a.t / 0.3); p.set(x, a.y1 + 0.03 - 0.62 * KID, z + a.cz1 + f * 0.45); if (f >= 1) { for (const l of k.userData.legs) l.rotation.set(0, 0, 0); p.set(x, 0, z + 3.75); next('rest'); } break; }
      case 'rest':
        M.animateCharacter(k, 0, dt, false);
        if (a.t > 0.6) { a.path = [[x + 1.15, z + 3.4], [x + 1.15, z + a.lz0 - 0.45], [x, z + a.lz0 - 0.1]]; next('run'); }
        break;
    }
  },
};

export function updatePark(dt) {
  if (!root) return;
  const p = G.player && G.player.position;
  if (!p || Math.abs(p.x - CX) > 70 || Math.abs(p.z - CZ) > 60) return; // uzaktayken (şehirde, adada) oynatılmaz
  const wet = havaIslak();
  if (wet === shown) { shown = !wet; for (const o of people) { o.visible = shown; if (shown) popIn(o); } }
  if (!shown) return;
  T += dt;
  for (const a of acts) STEP[a.kind](a, dt);
}
