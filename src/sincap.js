// Sincaplar (2026-11-05 kullanıcı: "Oyuna sincap da ekleyelim ağaçların altında ve dallarında dolaşsınlar"): oyuncunun yakınındaki
// yapraklı ağaçlarda birkaç sincap. Gövdeye tırmanır, yarı yolda durup etrafa bakar, kuyruğunu sallar, tepenin yapraklarına girip
// kaybolur; sonra gövdeden başı aşağı iner, ağacın dibinde zıplaya zıplaya dolaşır, arka ayakları üstünde oturup kemirir; yine aynı
// ağaca tırmanır ya da yakındaki başka bir sincap ağacına koşar. Oyuncu yaklaşınca gövdeye kaçıp hızla tepeye tırmanır.
// Ağaçtan dal çıkmaz (2026-11-05 kullanıcı: "ağaçtan çıkan dal güzel olmamış gövdesine tırmansın öyle dal çıkmasın"): eskiden tepeden
// yana çıplak bir dal uzanıyor, sincap dalın ucunda oturuyordu.
// Sincap ağaçları: orman (decor.js G.trees, çam hariç) ve makeTree'nin yapraklıları (models.js userData.leafTree). Gövde ışınla ölçülür
// (measure): kameraya bakan yandan yatay ışınlar gövdeyi boy boy izler ve tepenin başladığı boyu bulur, sincap eğri gövdede de
// gövdenin yüzeyine yapışır. Ölçüm sincap o ağaca ilk gittiğinde yapılır ve saklanır.
// Uzaklaşınca sincap ekran dışında yeni bir ağaca geçer.
// Boy ve hareket (2026-11-08 kullanıcı: "sincapları bir tık küçült kedi köpek ile orantılı olsun ve hareketlerini daha gerçekçi yap
// güzelleştir"): boy 1,35'ten 1,0'a (kuyruğuyla kedinin boyundaydı). Model tek iskeletli parça (bir çizim): kalça, arka bacaklar,
// göğüs, baş, ön bacaklar, palamut ve üç boğumlu kuyruk. Yerde sıçrayarak koşar (ön ayaklar uzanır, arka ayaklar iter, gövde kavis
// yapar, kuyruk dalgalanır), kısa koşulardan sonra durup kollar (bazen arka ayakları üstünde dikilir, kuyruğunu titretir); dipte toprağı
// eşeler, palamudu ön patileriyle ağzına götürüp kemirir. Tırmanırken hamle hamle çıkar, inerken temkinli duraklar.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, rand, lerpAngle, offscreen } from './game.js';
import { heightAt } from './world.js';
import { settings } from './audio.js';

const PI = Math.PI, NEAR = 40, FAR = 48, FLEE = 2.6;
const STEP = 0.2, OUT = 1.3, LEAF_R = 0.42; // ölçüm: ışın aralığı, ışının eksenden başladığı uzaklık, bundan kalını yaprak sayılır
const COUNT = { yuksek: 6, orta: 5, dusuk: 3, pil: 3 }; // görüntü kalitesine göre (kalite.js)
const SCALE = 1.0;
const hash = (x, z) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); };

// ---------- model: arka ayaklar orijinde, burun +z ----------
// kemikler [ad, ebeveyn, bağlama duruşundaki yeri]; her parça tek kemiğe bağlı (katı deri). Bağlama duruşunda kuyruk dimdik yukarı
const BONES = [
  ['root', -1, 0, 0, 0], ['hips', 0, 0, 0.13, 0.04], ['hind', 1, 0, 0.1, 0.03], ['chest', 1, 0, 0.14, 0.1],
  ['head', 3, 0, 0.2, 0.22], ['front', 3, 0, 0.13, 0.22], ['nut', 5, 0, 0.05, 0.27],
  ['t1', 1, 0, 0.14, -0.07], ['t2', 7, 0, 0.27, -0.07], ['t3', 8, 0, 0.41, -0.07],
];
const BI = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
function part(geo, col, bone, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) {
  if (geo.index) geo = geo.toNonIndexed();
  geo.deleteAttribute('uv');
  geo.scale(sx, sy, sz); if (rz) geo.rotateZ(rz); geo.translate(x, y, z);
  const c = new THREE.Color(col), n = geo.attributes.position.count, a = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; si[i * 4] = BI[bone]; sw[i * 4] = 1; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return geo;
}
const ball = () => new THREE.IcosahedronGeometry(1, 1);
let GEO = null, MAT = null;
function geos() {
  if (GEO) return;
  const fur = '#c0662e', dark = '#9c4f22', cream = '#f1d9b5', paw = '#7f3f1a';
  const L = [];
  for (const sx of [-1, 1]) {
    L.push(part(ball(), dark, 'hind', sx * 0.075, 0.085, 0.02, 0.06, 0.075, 0.09)); // arka bacak (but)
    L.push(part(ball(), paw, 'hind', sx * 0.07, 0.015, 0.075, 0.03, 0.02, 0.065)); // arka ayak
    L.push(part(ball(), fur, 'front', sx * 0.042, 0.09, 0.225, 0.022, 0.05, 0.024)); // ön bacak
    L.push(part(ball(), paw, 'front', sx * 0.044, 0.04, 0.235, 0.022, 0.02, 0.028)); // ön pati
    L.push(part(ball(), '#141414', 'head', sx * 0.048, 0.27, 0.31, 0.019, 0.019, 0.019)); // göz
    L.push(part(ball(), '#ffffff', 'head', sx * 0.054, 0.277, 0.325, 0.006, 0.006, 0.006)); // gözde ışık
    L.push(part(ball(), cream, 'head', sx * 0.042, 0.222, 0.312, 0.034, 0.03, 0.034)); // yanak
    L.push(part(new THREE.ConeGeometry(0.028, 0.07, 5), dark, 'head', sx * 0.045, 0.33, 0.24, 1, 1, 1, -sx * 0.25)); // kulak
  }
  L.push(part(ball(), fur, 'hips', 0, 0.13, 0.03, 0.115, 0.11, 0.125)); // gövdenin arkası
  L.push(part(ball(), cream, 'hips', 0, 0.105, 0.065, 0.08, 0.075, 0.09)); // karın
  L.push(part(ball(), fur, 'chest', 0, 0.15, 0.16, 0.1, 0.1, 0.12)); // gövdenin önü
  L.push(part(ball(), cream, 'chest', 0, 0.125, 0.2, 0.07, 0.07, 0.08)); // göğüs
  L.push(part(ball(), fur, 'head', 0, 0.24, 0.26, 0.085, 0.085, 0.085)); // baş
  L.push(part(ball(), cream, 'head', 0, 0.225, 0.33, 0.055, 0.05, 0.06)); // ağız
  L.push(part(ball(), '#2b1b14', 'head', 0, 0.235, 0.39, 0.016, 0.016, 0.016)); // burun
  L.push(part(ball(), '#a8743a', 'nut', 0, 0.045, 0.272, 0.026, 0.032, 0.026)); // palamut (yalnız yerken görünür)
  L.push(part(ball(), '#5b3a1e', 'nut', 0, 0.073, 0.272, 0.029, 0.014, 0.029));
  // kabarık kuyruk: üç boğum, ucu açık renkli
  // her boğumda iç içe iki tüy yumağı: bükülünce boğum yerlerinde boşluk kalmaz, kuyruk boncuk dizisi gibi görünmez
  for (const [bone, y, r, c] of [['t1', 0.17, 0.056, '#b25a28'], ['t1', 0.225, 0.07, '#bd642d'], ['t2', 0.285, 0.082, '#c56d34'], ['t2', 0.35, 0.092, '#cb7539'],
    ['t3', 0.42, 0.09, '#d07c40'], ['t3', 0.49, 0.077, '#d88a4c'], ['t3', 0.55, 0.055, '#e6ab72']]) L.push(part(ball(), c, bone, 0, y, -0.07, r * 1.05, r * 0.95, r * 0.9));
  GEO = mergeGeometries(L);
  MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
}
// duruşlar: kemiklerin x açısı (+ öne/aşağı eğer), pp gövdenin fazladan eğimi (− burun yukarı). Dikilip oturunca arka bacaklar
// gövdenin eğimini geri alır (ayaklar yerde kalır), baş öne bakar; kuyruk sırtta S çizer
const POSE = {
  run: { hips: 0, hind: 0, chest: 0, head: -0.1, front: 0, t1: -1.25, t2: 0.35, t3: 0.45, pp: 0 },
  flee: { hips: 0, hind: 0, chest: 0, head: -0.05, front: 0, t1: -1.5, t2: 0.12, t3: 0.18, pp: 0 },
  climb: { hips: 0, hind: 0.3, chest: 0, head: -0.25, front: -0.3, t1: -1.2, t2: 0.3, t3: 0.4, pp: 0 },
  cling: { hips: 0, hind: 0.35, chest: 0, head: -0.2, front: -0.35, t1: -1.0, t2: 0.5, t3: 0.6, pp: 0 },
  still: { hips: 0, hind: 0, chest: -0.12, head: -0.3, front: 0, t1: -0.7, t2: 0.65, t3: 0.75, pp: 0 },
  tall: { hips: 0, hind: 1.25, chest: -0.15, head: 1.25, front: -0.9, t1: 0.6, t2: 0.6, t3: 0.7, pp: -1.25 },
  eat: { hips: 0, hind: 1.05, chest: -0.2, head: 1.1, front: -1.35, t1: 0.45, t2: 0.65, t3: 0.85, pp: -1.05 },
  dig: { hips: 0, hind: -0.15, chest: 0.18, head: 0.35, front: -0.35, t1: -0.9, t2: 0.75, t3: 0.6, pp: 0.22 },
};
const KEYS = ['hips', 'hind', 'chest', 'head', 'front', 't1', 't2', 't3', 'pp'];
const LOOKS = new Set(['still', 'tall', 'cling']); // başını kesik kesik sağa sola çevirdiği duruşlar
function makeSquirrel() {
  geos();
  const o = new THREE.Group(), pose = new THREE.Group(), mesh = new THREE.SkinnedMesh(GEO, MAT);
  const bones = BONES.map(([name]) => { const q = new THREE.Bone(); q.name = name; return q; });
  BONES.forEach(([, p, x, y, z], i) => { const q = p >= 0 ? BONES[p] : [0, 0, 0, 0, 0]; bones[i].position.set(x - q[2], y - q[3], z - q[4]); if (p >= 0) bones[p].add(bones[i]); });
  mesh.add(bones[0]); mesh.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true; mesh.frustumCulled = false; mesh.userData.bkNo = true; // kımıldar: perf.js birleştirmesine girmez
  pose.add(mesh); o.add(pose);
  o.scale.setScalar(SCALE); o.visible = false;
  G.scene.add(o);
  const b = Object.fromEntries(bones.map((q) => [q.name, q]));
  b.nut.scale.setScalar(1e-3);
  return { o, pose, b, a: { ...POSE.still }, gw: 0, hy: 0, mode: 'still', T: null, st: 'hide', y: 0, x: 0, z: 0, tx: 0, tz: 0, t: 0, wait: 0, yaw: 0, pitch: 0,
    ph: 0, look: 0, lookT: 0, flick: 0, hops: 0, fast: false, goal: '', T2: null, ck: 0, act: 'eat', pz: 0, pzK: 'still', run: 1, cb: 0, cp: 0 };
}

// ---------- sincap ağaçları ----------
let trees = [], treeKey = '', treeT = 0, inst = null;
const sq = [], MEAS = new Map(); // ölçümler ağacın yeriyle saklanır: bölge açılınca liste tazelenir, ölçüm kalır
function blockedAt(x, z, m = 0.25) {
  if (heightAt(x, z) < -0.15) return true; // su
  for (const c of G.colliders) if (x > c[0] - m && x < c[1] + m && z > c[2] - m && z < c[3] + m) return true;
  return false;
}
function refreshTrees() {
  const key = Object.values(G.regions).filter((r) => r.unlocked).length + '|' + (G.unlocked ? G.unlocked.size : 0) + '|' + (G.trees ? G.trees.length : 0);
  if (key === treeKey) return;
  treeKey = key; inst = null;
  const all = [];
  for (const t of G.trees || []) if (!t[3]) all.push([t[0], t[1], 2.0 * t[2], null, null]);
  const v = new THREE.Vector3(), sc = new THREE.Vector3();
  G.scene.traverseVisible((o) => {
    if (!o.userData.leafTree) return;
    o.getWorldPosition(v); o.getWorldScale(sc);
    all.push([v.x, v.z, o.userData.leafTree * sc.y, v.y, o]);
  });
  trees = [];
  for (const [x, z, hc, y0, obj] of all) {
    const k = x.toFixed(2) + ',' + z.toFixed(2), m = MEAS.get(k);
    if (m === false) continue; // ölçümde elendi
    trees.push({ x, z, y0: y0 ?? heightAt(x, z), hc, obj, k, m, busy: null });
  }
  for (const s of sq) { // ağacı yerinde duran sincap kaldığı yerden sürer
    if (!s.T) continue;
    const T = trees.find((q) => q.k === s.T.k);
    if (T) { T.busy = s; s.T = T; } else { s.T = null; s.o.visible = false; s.wait = 0; }
    if (s.T2) s.T2 = trees.find((q) => q.k === s.T2.k) || null;
  }
}
const RC = new THREE.Raycaster(), HITS = [], DUMMY = new THREE.Mesh(), IM = new THREE.Matrix4(), PV = new THREE.Vector3(), DV = new THREE.Vector3();
RC.layers.enableAll(); // perf.js birleştirdiği asılları gizli katmana alır: ışın onları da görsün
const cellK = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
// orman ağacının parçaları decor.js'in InstancedMesh örnekleri: ağacın birkaç metre yakınındakiler
function nearInst(T) {
  if (!inst) {
    inst = new Map();
    const want = new Set(trees.filter((q) => !q.obj).map((q) => cellK(q.x, q.z)));
    G.scene.traverseVisible((o) => {
      if (!o.isInstancedMesh) return;
      const a = o.instanceMatrix.array;
      for (let i = 0; i < o.count; i++) {
        PV.set(a[i * 16 + 12], a[i * 16 + 13], a[i * 16 + 14]).applyMatrix4(o.matrixWorld);
        const k = cellK(PV.x, PV.z);
        if (!want.has(k)) continue;
        if (!inst.has(k)) inst.set(k, []);
        inst.get(k).push([o, i]);
      }
    });
  }
  const out = [], cx = Math.floor(T.x / 2), cz = Math.floor(T.z / 2);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of inst.get(`${cx + i},${cz + j}`) || []) out.push(q);
  return out;
}
// kameraya bakan yandan gövdeye doğru yatay ışın (l: eksenden yana kayma): çarptığı yüzeye uzaklık, çarpmazsa -1
function cast(T, list, dx, dz, l, h) {
  RC.set(PV.set(T.x + dx * OUT + dz * l, T.y0 + h, T.z + dz * OUT - dx * l), DV.set(-dx, 0, -dz)); RC.far = OUT + 0.05;
  HITS.length = 0;
  if (T.obj) RC.intersectObject(T.obj, true, HITS);
  else for (const [im, i] of list) {
    im.getMatrixAt(i, IM);
    DUMMY.geometry = im.geometry; DUMMY.material = im.material; DUMMY.matrixWorld.multiplyMatrices(im.matrixWorld, IM);
    DUMMY.raycast(RC, HITS);
  }
  let d = 1e9;
  for (const q of HITS) if (q.distance < d) d = q.distance;
  return d > OUT ? -1 : d;
}
// gövde boy boy izlenir: her boyda ışın bir önceki boyda gövdeyi bulduğu yandan atılır, bulamazsa biraz sağına soluna bakılır
// (köydeki GLB ağaçların gövdesi eğri, ağaç da rastgele döner: dümdüz ışın kıvrımda gövdeyi ıskalıyordu). pts: gövdenin kameraya
// bakan yüzeyi boy boy, top: gövdenin görünen üst ucu. Işın birden öne yakın bir şeye çarparsa yapraklar başlamıştır.
// Tepesi olmayan, gövdesi kısa ya da gövdesi bulunamayan ağaç elenir
const LAT = [[0, -0.07, 0.07], [-0.15, 0.15, -0.25, 0.25]];
function measure(T) {
  if (T.m !== undefined) return T.m;
  let m = false;
  try {
    const list = T.obj ? null : nearInst(T), side = hash(T.z, T.x) < 0.5 ? 1 : -1;
    for (const a of [0.85 * side, -0.85 * side, 0.4 * side, -0.4 * side]) { // yandan, biraz kameraya (güneye) dönük: tırmanan sincap yandan görünür
      const dx = Math.sin(a), dz = Math.cos(a), pts = [];
      let crown = false, c = 0, prev = -1;
      for (let h = 0.3; h < T.hc + 0.6 && !crown; h += STEP) {
        let best = -1, bl = 0;
        for (const ring of LAT) {
          for (const o of ring) { const d = cast(T, list, dx, dz, c + o, h); if (d >= 0 && (best < 0 || d < best)) { best = d; bl = c + o; } }
          if (best >= 0) break;
        }
        if (best < 0) break; // gövde bitti
        if (OUT - best > LEAF_R + Math.abs(bl) || (prev >= 0 && prev - best > 0.25)) { crown = true; break; } // yapraklar öne taştı
        pts.push([T.x + dx * (OUT - best) + dz * bl, T.z + dz * (OUT - best) - dx * bl]);
        c = bl; prev = best;
      }
      const top = 0.3 + (pts.length - 1) * STEP;
      if (!crown || top < 1.1 || blockedAt(pts[0][0] + dx * 0.6, pts[0][1] + dz * 0.6, 0.1)) continue;
      m = { dx, dz, pts, top };
      break;
    }
  } catch (e) { console.warn('sincap ölçümü', e); }
  MEAS.set(T.k, m); T.m = m;
  return m;
}
const AT = [0, 0];
function at(T, y, out = 0) { // gövdenin bu boydaki yüzeyi (ölçümden ara değer), out kadar dışarıda
  const p = T.m.pts, f = Math.min(p.length - 1, Math.max(0, (y - 0.3) / STEP)), i = Math.floor(f), j = Math.min(p.length - 1, i + 1), k = f - i;
  AT[0] = p[i][0] + (p[j][0] - p[i][0]) * k + T.m.dx * out; AT[1] = p[i][1] + (p[j][1] - p[i][1]) * k + T.m.dz * out;
  return AT;
}

// ---------- davranış ----------
function assign(s, p) {
  if (s.T) { s.T.busy = null; s.T = null; }
  if (s.T2 && s.T2.busy === s) s.T2.busy = null;
  const c = [];
  for (const T of trees) {
    const dx = T.x - p.x, dz = T.z - p.z;
    if (T.busy || T.m === false || Math.abs(dx) > NEAR || Math.abs(dz) > NEAR) continue;
    const d = dx * dx + dz * dz; if (d > 16 && d < NEAR * NEAR) c.push(T);
  }
  for (let n = 0; n < 2 && c.length; n++) { // karede en çok iki ağaç ölçülür (telefonda ağaç başı ~5 ms)
    const T = c.splice((Math.random() * c.length) | 0, 1)[0];
    if (!measure(T)) continue;
    T.busy = s; s.T = T; s.T2 = null; s.st = 'hide'; s.y = T.m.top + 0.3; s.t = rand(0.3, 2.5); s.fast = false; // tepenin yapraklarında, birazdan iner
    s.yaw = Math.atan2(T.m.dx, T.m.dz); s.pitch = PI / 2; s.o.visible = false;
    return true;
  }
  return false;
}
// ağacın dibinde zıplanacak yer: çoğu kameraya bakan yanda
function pickGround(s) {
  const T = s.T;
  for (let k = 0; k < 5; k++) {
    const a = Math.atan2(T.m.dx, T.m.dz) + rand(-1.7, 1.7), r = rand(0.8, 2.3), x = T.x + Math.sin(a) * r, z = T.z + Math.cos(a) * r;
    if (blockedAt(x, z, 0.15)) continue;
    s.tx = x; s.tz = z; s.goal = 'sit'; s.st = 'ground'; return true;
  }
  return false;
}
function toTrunk(s, T, fast) { const q = at(T, 0, 0.05); s.T2 = T; s.tx = q[0]; s.tz = q[1]; s.goal = 'up'; s.st = 'ground'; s.fast = fast; }
// dipte dolaşma bitti: çoğu kez aynı ağaca tırmanır, bazen yakındaki boş bir sincap ağacına koşar
function decide(s) {
  if (Math.random() < 0.3) {
    const c = trees.filter((T) => !T.busy && T !== s.T && T.m !== false && Math.hypot(T.x - s.x, T.z - s.z) < 10 && Math.hypot(T.x - s.x, T.z - s.z) > 3);
    for (let n = 0; n < 2 && c.length; n++) {
      const T = c.splice((Math.random() * c.length) | 0, 1)[0];
      if (!measure(T)) continue;
      s.T.busy = null; T.busy = s; return toTrunk(s, T, false);
    }
  }
  toTrunk(s, s.T, false);
}
// dipte bir yere varınca: eşeler (sonra çoğu kez bulduğunu yer), palamut kemirir ya da arka ayakları üstünde dikilip kollar
function pickAct(s) {
  const r = Math.random();
  s.act = r < 0.4 ? 'dig' : r < 0.75 ? 'eat' : 'tall';
  s.t = s.act === 'dig' ? rand(0.9, 1.8) : s.act === 'eat' ? rand(1.8, 3.4) : rand(0.9, 2.0);
  s.lookT = 0;
}
function step(s, dt, p) {
  if (!s.T || (Math.hypot(s.T.x - p.x, s.T.z - p.z) > FAR && (offscreen(s.o.position) || Math.hypot(s.T.x - p.x, s.T.z - p.z) > FAR + 14))) {
    if ((s.wait -= dt) > 0) return;
    if (!assign(s, p)) { s.o.visible = false; s.wait = 2; return; }
  }
  const T = s.T, m = T.m;
  let yaw = s.yaw, pitch = 0, moving = false, ground = false, mode = 'still', x, y, z;
  s.t -= dt;
  const pd = Math.hypot(p.x - s.x, p.z - s.z), near = Math.hypot(p.x - (T.x + m.dx * 0.5), p.z - (T.z + m.dz * 0.5)) < FLEE;
  const glance = (a, t0, t1, fl) => { if ((s.lookT -= dt) <= 0) { s.lookT = rand(t0, t1); s.look = rand(-a, a); if (Math.random() < fl) s.flick = 0.5; } };
  switch (s.st) {
    case 'hide': // tepenin yaprakları arasında, görünmez
      if (s.t <= 0 && !near) { s.st = 'down'; s.y = m.top; s.cb = rand(0.3, 0.6); s.cp = 0; }
      break;
    case 'down': // başı aşağı, temkinli: biraz iner, durup bakar
      mode = 'climb';
      if (near) { s.st = 'up'; s.fast = true; s.ck = 0; s.cp = 0; } // biri geliyor: geri tırmanır
      else if (s.cp > 0) { s.cp -= dt; mode = 'cling'; glance(0.6, 0.3, 0.6, 0.3); }
      else {
        s.y -= 1.2 * dt; moving = true;
        if ((s.cb -= dt) <= 0) { s.cb = rand(0.3, 0.6); s.cp = rand(0.25, 0.7); s.lookT = 0; }
        if (s.y <= 0.3) { // burnu yere değdi
          const q = at(T, 0, 0.05);
          s.y = 0; s.x = q[0]; s.z = q[1]; s.hops = 2 + ((Math.random() * 3) | 0); s.run = rand(0.5, 1.2);
          if (!pickGround(s)) toTrunk(s, T, false);
        }
      }
      break;
    case 'up': // hamle hamle tırmanır; kaçarken durmadan
      mode = 'climb';
      if (!s.fast && s.cp > 0) { s.cp -= dt; mode = 'cling'; }
      else {
        s.y += (s.fast ? 2.8 : 2.0) * dt; moving = true;
        if (!s.fast && (s.cb -= dt) <= 0) { s.cb = rand(0.35, 0.8); s.cp = rand(0.12, 0.45); }
      }
      if (s.ck > 0 && s.y >= s.ck) { s.y = s.ck; s.ck = 0; s.st = 'cling'; s.t = rand(1.5, 4); s.look = 0; s.lookT = rand(0.4, 1); }
      else if (s.y >= m.top + 0.3) { s.y = m.top + 0.3; s.st = 'hide'; s.t = rand(2, 6); s.fast = false; }
      break;
    case 'cling': // gövdede durur, sağa sola bakar
      mode = 'cling';
      if (near) { s.st = 'up'; s.fast = true; }
      else if (s.t <= 0) { s.st = Math.random() < 0.6 ? 'up' : 'down'; s.cb = rand(0.3, 0.7); s.cp = 0; }
      else glance(0.7, 0.5, 1.4, 0.5);
      break;
    case 'ground': {
      ground = true;
      if (s.goal === 'sit' && pd < FLEE) toTrunk(s, s.T, true); // oyuncu yaklaştı: gövdeye kaç
      if (s.pz > 0 && !s.fast) { s.pz -= dt; mode = s.pzK; glance(0.8, 0.2, 0.5, 0.25); break; } // kısa koşudan sonra durup kollar
      const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz), v = (s.fast ? 3.6 : s.goal === 'up' && s.T2 !== s.T ? 2.6 : 1.6) * dt;
      if (d > 0.02) yaw = Math.atan2(dx, dz);
      moving = true; mode = s.fast ? 'flee' : 'run';
      if (d <= v) {
        s.x = s.tx; s.z = s.tz;
        if (s.goal === 'up') { s.T = s.T2 || s.T; s.T2 = null; s.y = 0; s.st = 'up'; s.cb = rand(0.35, 0.8); s.cp = 0; s.ck = !s.fast && Math.random() < 0.75 ? rand(0.35, 0.8) * s.T.m.top : 0; }
        else { s.st = 'sit'; pickAct(s); }
      } else {
        s.x += (dx / d) * v; s.z += (dz / d) * v;
        if (!s.fast && d > 0.5 && (s.run -= v) <= 0) { s.run = rand(0.5, 1.4); s.pz = rand(0.25, 0.9); s.pzK = Math.random() < 0.3 ? 'tall' : 'still'; s.lookT = 0; }
      }
      break;
    }
    case 'sit':
      ground = true; mode = s.act;
      if (pd < FLEE) { toTrunk(s, T, true); break; }
      if (s.act === 'tall') glance(0.9, 0.3, 0.8, 0.4);
      if (s.t <= 0) {
        if (s.act === 'dig' && Math.random() < 0.6) { s.act = 'eat'; s.t = rand(1.8, 3.4); } // bulduğunu yer
        else { if (--s.hops > 0 && pickGround(s)) break; decide(s); }
      }
      break;
  }
  if (s.st === 'hide') { s.o.visible = false; return; }
  const B = s.T, bm = B.m; // tırmanırken ağaç değişmiş olabilir
  if (s.st === 'up' || s.st === 'down' || s.st === 'cling') { // arka ayaklar gövdenin yüzeyinde, karnı gövdeye dönük
    const by = Math.atan2(bm.dx, bm.dz), q = at(B, s.y, 0.015);
    x = q[0]; z = q[1]; y = B.y0 + s.y;
    yaw = s.st === 'down' ? by : by + PI; pitch = s.st === 'down' ? PI / 2 : -PI / 2; // çıkarken burnu yukarı, inerken başı aşağı
    s.x = x; s.z = z;
  } else { x = s.x; z = s.z; y = heightAt(x, z); }
  s.o.visible = !(s.st === 'up' && s.y > bm.top + 0.15); // tepenin yapraklarına girdi
  pose(s, dt, mode, moving, ground, yaw, pitch, x, y, z);
}
// kemikleri sürer: duruş yumuşakça değişir, koşu adımı (sıçrama) duruşun üstüne eklenir
function pose(s, dt, mode, moving, ground, yaw, pitch, x, y, z) {
  s.mode = mode;
  const k = 1 - Math.exp(-12 * dt), kp = 1 - Math.exp(-10 * dt), P = POSE[mode], a = s.a, b = s.b, t = G.time;
  s.yaw = lerpAngle(s.yaw, yaw, k); s.pitch += (pitch - s.pitch) * k;
  for (const key of KEYS) a[key] += (P[key] - a[key]) * kp;
  s.gw += ((moving ? 1 : 0) - s.gw) * (1 - Math.exp(-14 * dt));
  if (moving) s.ph += dt * (mode === 'flee' ? 31 : mode === 'climb' ? (s.fast ? 30 : 24) : 22);
  const w = s.gw, f = s.ph, sf = Math.sin(f);
  // sıçrayış: uçuşta ön ayaklar öne uzanır, arka ayaklar geride iter; gövde toplanırken kavis yapar; kuyruk gecikmeli dalgalanır
  let hips = a.hips + w * 0.1 * Math.sin(f + 0.4), hind = a.hind + w * 0.9 * Math.sin(f - 0.6), chest = a.chest + w * 0.2 * Math.cos(f);
  let head = a.head - w * 0.12 * Math.cos(f), front = a.front - w * 0.8 * sf;
  let t1 = a.t1 + w * 0.12 * Math.sin(f - 0.9), t2 = a.t2 + w * 0.22 * Math.sin(f - 1.8), t3 = a.t3 + w * 0.3 * Math.sin(f - 2.7), t1z = 0;
  const pp = a.pp - w * (ground ? 0.12 : 0.05) * sf;
  if (!moving) chest += Math.sin(t * 9 + s.ph) * 0.02; // soluk alıp verir
  if (mode === 'dig') { front += Math.sin(t * 24) * 0.55; head += Math.sin(t * 13) * 0.06; } // ön patileriyle hızlı hızlı eşeler
  if (mode === 'eat') { head += Math.sin(t * 31) * 0.07; front += Math.sin(t * 15 + 1) * 0.05; } // kemirir, palamudu çevirir
  if (s.flick > 0) { s.flick -= dt; const q = s.flick * 38; t2 += Math.sin(q) * 0.45; t3 += Math.sin(q - 1.1) * 0.55; t1z = Math.sin(q) * 0.18; } // kuyruk titretme
  s.hy += ((LOOKS.has(mode) ? s.look : 0) - s.hy) * (1 - Math.exp(-25 * dt)); // baş kesik kesik döner
  b.hips.rotation.x = hips; b.hind.rotation.x = hind; b.chest.rotation.x = chest; b.front.rotation.x = front;
  b.head.rotation.x = head; b.head.rotation.y = s.hy;
  b.t1.rotation.x = t1; b.t1.rotation.z = t1z; b.t2.rotation.x = t2; b.t3.rotation.x = t3;
  b.nut.scale.setScalar(mode === 'eat' ? 1 : 1e-3);
  s.o.position.set(x, y, z); s.o.rotation.y = s.yaw;
  s.pose.position.y = w * Math.max(0, sf) * (ground ? (mode === 'flee' ? 0.09 : 0.065) : 0.03);
  s.pose.rotation.x = s.pitch + pp;
}

export function updateSincap(dt) {
  if (!G.player || !G.scene || !G.regions) return;
  if ((treeT -= dt) <= 0) { treeT = 5; try { refreshTrees(); } catch (e) { console.warn('sincap ağaçları', e); } }
  if (!trees.length) return;
  const want = COUNT[settings.quality] || 4, p = G.player.position;
  while (sq.length < want) sq.push(makeSquirrel());
  for (let i = 0; i < sq.length; i++) {
    const s = sq[i];
    if (i >= want) { if (s.T) s.T.busy = null; if (s.T2) s.T2.busy = null; s.T = s.T2 = null; s.o.visible = false; continue; }
    step(s, dt, p);
  }
}
window.__sincap = (k) => { // test kancası; 'olc': bütün ağaçları yeniden ölçer, 'sq': sincap nesneleri
  if (k === 'olc') { MEAS.clear(); for (const T of trees) { T.m = undefined; measure(T); } }
  if (k === 'sq') return sq;
  return { trees: trees.length, olcu: [...MEAS.values()].filter(Boolean).length, elenen: [...MEAS.values()].filter((m) => !m).length, sq: sq.map((s) => [s.st, s.mode, +s.o.position.x.toFixed(1), +s.o.position.y.toFixed(2), +s.o.position.z.toFixed(1), s.o.visible]) };
};
