// Toplama tarlaları ve kademeleri (2026-11-05 kullanıcı: "ayçiçeği tarlasının içinde kademeleri arttırma mekaniği olsun, diğer tarlalardan
// da yapalım"): içinde yürüyen oyuncu yanındaki olgun ürünü sırtına alır; taşıyıcı ve köy kamyonu da toplar (avail / give / ripeCount).
// Büyük Tarlalar'da üç tarla: ayçiçeği (kuzeybatı parseli, farmland.js), lale (batı şeridinin kuzeyi), karpuz (batı şeridinin güneyi).
// Kademeler bütün toplama tarlalarına birden işler; sonradan açılan tarla da o anki kademeyle kurulur (expand-east.js xtarlalar4, xtarlalar7):
//   2. kademe Damla Sulama: şeritlerin arasında depo ve pompa, sıralarda hortum, bitki diplerinde ıslak toprak; yeniden yetişme %35 kısa
//   3. kademe Arı Kovanları: tarla kıyısında kovanlar, çiçeklerin üstünde arılar; tozlaşan bitki iri olur ve iki ürün verir
import * as THREE from 'three';
import * as M from './models.js';
import { G, Station, makeItem, rand, sfx, popIn } from './game.js';
import { texRep } from './tex.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z), REACH = 1.7; // oyuncu yürüdüğü şeridin bitkilerinden alır (2026-11-08: 1,7; ilk 2,2 m: yanındakileri de topluyordu, 0,65: tek tek üstüne basmak gerekiyordu, 1,4: kullanıcı "bir tık kolaylaştır")
export const FT = { lvl: 1, fields: [] }; // test kancası: G.regions.tarlalar.farm.FT
const growK = () => (FT.lvl >= 2 ? 0.65 : 1), yieldN = () => (FT.lvl >= 3 ? 2 : 1);
export function fieldTier(n, instant) { if (n <= FT.lvl) return; FT.lvl = n; for (const f of FT.fields) f.tier(instant); }
// ana boru: depodan kuzeye lale şeridinin güney kıyısına, oradan doğuya ayçiçeği parselinin batı kıyısına; güneye karpuz şeridine
export const MAIN_Z = -57.95, KARPUZ_Z = -53.25, TANK = [17.6, -55.6], SUN_HEAD_X = 24.35;

let mats = null;
function MAT() {
  if (mats) return mats;
  const stripes = (a, b, n, w) => { const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d'); for (let i = 0; i < 64; i++) { g.fillStyle = i % n < w ? a : b; g.fillRect(i, 0, 1, 8); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  mats = {
    pipe: M.mat('#2b2b2b', { rough: 0.6 }),
    wet: new THREE.MeshStandardMaterial({ color: '#3e2716', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    wood: M.mat('#a8703f'), white: M.mat('#fbf6ec'), hole: M.mat('#3a2a1a'),
    bee: new THREE.MeshStandardMaterial({ map: stripes('#2a1a0a', '#f2c230', 16, 6), roughness: 0.7 }),
    melon: new THREE.MeshStandardMaterial({ map: stripes('#2f6b2a', '#5aa846', 8, 3), roughness: 0.55 }),
  };
  return mats;
}
const UNIT = new THREE.CylinderGeometry(1, 1, 1, 6), UP = V(0, 1, 0), DIR = V(0, 0, 0);
// boru parçaları tek örnekli ağda: [x0, z0, x1, z1] uçları, r kalınlık, y yerden yükseklik
export function pipes(C, segs, r = 0.045, y = 0.1) {
  const m = new THREE.InstancedMesh(UNIT, MAT().pipe, segs.length), o3 = new THREE.Object3D();
  segs.forEach(([x0, z0, x1, z1], i) => {
    const L = Math.hypot(x1 - x0, z1 - z0) || 0.01;
    o3.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); o3.quaternion.setFromUnitVectors(UP, DIR.set(x1 - x0, 0, z1 - z0).normalize()); o3.scale.set(r, L, r); o3.updateMatrix();
    m.setMatrixAt(i, o3.matrix);
  });
  m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); C.add(m);
  return m;
}
// arı kovanı: ahşap altlık, iki beyaz kat, renkli çatı, önde uçuş deliği
function makeHive(roof) {
  const g = new THREE.Group(), T = MAT();
  M.rbox(0.6, 0.12, 0.6, 0.03, T.wood, 0, 0.06, 0, g);
  for (const y of [0.3, 0.58]) M.rbox(0.56, 0.26, 0.56, 0.03, T.white, 0, y, 0, g);
  M.rbox(0.66, 0.08, 0.66, 0.03, M.mat(roof), 0, 0.76, 0, g);
  M.rbox(0.2, 0.03, 0.02, 0.01, T.hole, 0, 0.2, 0.29, g);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
const ROOFS = ['#f6c343', '#e8604c', '#3d7dd8', '#6cbf4a'];
// 2. kademenin deposu: dört çelik ayak üstünde mavi su deposu, konik kapak, yanında kırmızı pompa; ana boru buradan dağılır
export function irrigation(c) {
  const g = new THREE.Group(), steel = M.mat('#b9c2cc', { rough: 0.4 }), [tx, tz] = TANK;
  for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) M.rbox(0.08, 1.1, 0.08, 0.01, steel, dx, 0.55, dz, g);
  M.cyl(0.62, 0.62, 1.3, 16, M.mat('#3d7dd8', { rough: 0.4 }), 0, 1.75, 0, g);
  const lid = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.3, 16), M.mat('#2d5fa8')); lid.position.set(0, 2.55, 0); g.add(lid);
  M.rbox(0.45, 0.35, 0.35, 0.04, M.mat('#e8604c'), 0.95, 0.18, 0, g); // pompa
  M.cyl(0.05, 0.05, 1.2, 6, MAT().pipe, 0.62, 0.7, 0, g); // depodan pompaya inen boru
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  c.put(g, tx, 0, tz);
  c.col(tx - 0.55, tx + 1.2, tz - 0.55, tz + 0.55);
  pipes(c.group, [[tx, tz - 0.5, tx, MAIN_Z], [tx, MAIN_Z, SUN_HEAD_X, MAIN_Z], [tx, tz + 0.5, tx, KARPUZ_Z]], 0.06, 0.1);
}

// ---------- ortak tarla ----------
// b: [x0, x1, z0, z1]; pl: bitkiler { x, z, s, sp, r } (r: 0 toplandı … 1 olgun); grow: 1. kademede yeniden yetişme süresi (sn).
// Alt sınıf çizimi (draw), hortum sıralarını (hoses), ıslak toprak beneklerini (wets), kovan yerlerini (hives) ve arı sayısını (beeN) verir
export class WalkField extends Station {
  constructor(C, b, type, pl, grow) {
    const [x0, x1, z0, z1] = b, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    super(cx, cz, w + 0.8, d + 0.8, { instant: true }); // alan tarlanın 0,4 m dışına taşar: kenar sırası yanından yürürken de toplanır (2026-11-08)
    this.type = type; this.bodyFn = () => null; this.dwell = 0; this.gt = 0; this.C = C; this.b = b; this.base = grow;
    (G.soft || (G.soft = [])).push([x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3]); // yürüyenler tarlanın içinden geçmez
    for (const p of pl) p.left = p.r >= 1 ? yieldN() : 0; // olgun bitkide kalan ürün: 3. kademede iki
    this.pl = pl; this.o3 = new THREE.Object3D(); this.col = new THREE.Color(); this.dirty = true;
    this.bs = new THREE.Sphere(V(cx, 1, cz), Math.hypot(w, d) / 2 + 1.5);
    this.hoses = []; this.wets = []; this.hives = []; this.beeN = 10; this.top = 0.6;
    FT.fields.push(this);
  }
  inst(geo, mat, n) { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; m.boundingSphere = this.bs.clone(); this.C.add(m); return m; }
  get big() { return FT.lvl >= 3 ? 1.25 : 1; } // tozlaşan bitki iri
  // kademe (kurulurken ve kademe alınınca): yetişme süresi, hortumlar, kovanlar
  tier(instant = true) {
    this.gtime = this.base * growK();
    this.plants = this.pl; this.grow = this.gtime / yieldN(); // haftalık etkinliğin hedefi üretim hızını bostan gibi sayar (album.js)
    if (FT.lvl >= 2 && !this.drip) this.addDrip();
    if (FT.lvl >= 3 && !this.bees) this.addBees(instant);
    for (const p of this.pl) if (p.r >= 1) p.left = Math.max(p.left, yieldN());
    this.dirty = true;
  }
  addDrip() {
    this.drip = pipes(this.C, this.hoses);
    const wet = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 8).rotateX(-PI / 2), MAT().wet, this.wets.length), o3 = this.o3;
    this.wets.forEach(([x, z, r], i) => { o3.position.set(x, 0.02, z); o3.rotation.set(0, 0, 0); o3.scale.set(r, 1, r); o3.updateMatrix(); wet.setMatrixAt(i, o3.matrix); });
    wet.receiveShadow = true; wet.boundingSphere = this.bs.clone(); this.C.add(wet);
  }
  addBees(instant) {
    const R = G.regions.tarlalar;
    this.hives.forEach(([x, z], i) => {
      const h = makeHive(ROOFS[(i + FT.fields.indexOf(this)) % 4]); h.position.set(x, 0, z); this.C.add(h); if (!instant) popIn(h);
      const c = [x - 0.36, x + 0.36, z - 0.36, z + 0.36]; G.colliders.push(c); if (R && R.colliders) R.colliders.push(c);
    });
    const [x0, x1, z0, z1] = this.b;
    this.beeHome = Array.from({ length: this.beeN }, () => ({ x: rand(x0 + 0.4, x1 - 0.4), z: rand(z0 + 0.4, z1 - 0.4), y: rand(0.75, 1.5), a: rand(0.8, 1.6), ph: rand(0, 6.3) }));
    this.bees = this.inst(new THREE.SphereGeometry(0.07, 6, 4).scale(1, 1, 1.5), MAT().bee, this.beeN);
    this.bees.castShadow = false; this.buzz(true);
  }
  // arılar çiçeklerin üstünde sekiz çizerek uçar; oyuncu uzaktayken kımıldamaz
  buzz(force) {
    const P = G.player && G.player.position;
    if (!force && (!P || Math.abs(P.x - this.zone.x) > 45 || Math.abs(P.z - this.zone.z) > 45)) return;
    const t = G.time || 0, o3 = this.o3;
    this.beeHome.forEach((b, i) => {
      const u = t * b.a + b.ph;
      o3.position.set(b.x + Math.sin(u) * 0.7, b.y + Math.sin(u * 3.1) * 0.12, b.z + Math.sin(u * 2) * 0.35);
      o3.rotation.set(0, Math.atan2(Math.cos(u) * 0.7, Math.cos(u * 2) * 0.7), 0); o3.scale.setScalar(1); o3.updateMatrix();
      this.bees.setMatrixAt(i, o3.matrix);
    });
    this.bees.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    if ((this.gt += dt) >= 0.25) {
      const k = this.gt; this.gt = 0;
      for (const p of this.pl) if (p.r < 1) { p.r = Math.min(1, p.r + (k * p.sp) / this.gtime); if (p.r >= 1) p.left = yieldN(); this.dirty = true; }
    }
    this.dwell = this.inside ? this.dwell + dt : 0;
    if (this.inside && this.dwell >= 0.16) { this.t += dt; if (this.t >= 0.07 && this.harvestTo(G.stack, G.player.position)) this.t = 0; }
    if (this.bees) this.buzz();
    if (this.dirty) this.draw();
  }
  avail() { let n = 0; for (const p of this.pl) if (p.r >= 1) n += p.left; return n; }
  ripeCount() { return this.avail(); } // köy kamyonu (city.js) bostan gibi sorar
  give(stack) { return this.harvestTo(stack); }
  // oyuncu üstünden geçtiği olgun bitkiden alır (yürüdükçe toplar); taşıyıcı herhangi birinden. Bitkinin ürünü bitince yeniden yetişir
  harvestTo(stack, at) {
    if (stack.full) return false;
    let best = null, bd = REACH;
    for (const p of this.pl) {
      if (p.r < 1) continue;
      if (!at) { best = p; break; }
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d < bd) { best = p; bd = d; }
    }
    if (!best) return false;
    const it = makeItem(this.type); it.position.set(best.x, (best.h || this.top) + 0.1, best.z); G.scene.add(it);
    stack.push(this.type, it); sfx('pop', { npc: stack !== G.stack });
    if (--best.left <= 0) { best.r = 0; best.left = 0; this.dirty = true; }
    return true;
  }
}

// parsel toprağı: büyük tarlaların parselleri gibi düz toprak
function soil(C, [x0, x1, z0, z1]) {
  const w = x1 - x0, d = z1 - z0, m = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, d + 0.6), new THREE.MeshStandardMaterial({ map: texRep('soil', w / 2.4, d / 2.4), roughness: 1 }));
  m.rotation.x = -PI / 2; m.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2); m.receiveShadow = true; C.add(m);
}

// ---------- ayçiçeği (farmland.js kuzeybatı parseli) ----------
// baş: olgun (r = 1) tam boy parlak sarı; açan tomurcuk küçük ve yeşile çalar, toplanınca yeşil tomurcuktan başlar
const BUD = new THREE.Color('#7cb342'), PETAL = new THREE.Color('#f6c343');
export class SunField extends WalkField {
  constructor(C, P) {
    super(C, [P.x0, P.x1, P.z0, P.z1], 'aycicek', P.plants.map((p) => ({ x: p.x, z: p.z, s: p.s, h: 1.25 * p.s, sp: rand(0.8, 1.25), r: Math.random() < 0.7 ? 1 : rand(0.1, 0.9) })), 70);
    const n = this.pl.length, o3 = this.o3;
    const stemGeo = new THREE.CylinderGeometry(0.045, 0.06, 1, 5); stemGeo.translate(0, 0.5, 0);
    const leafGeo = new THREE.ConeGeometry(0.32, 0.7, 4); leafGeo.translate(0, 0.35, 0);
    const stem = this.inst(stemGeo, M.mat('#4f9a3c', { flat: true }), n), leaf = this.inst(leafGeo, M.mat('#5fb043', { flat: true }), n);
    this.pl.forEach((p, i) => {
      o3.position.set(p.x, 0, p.z); o3.rotation.set(0, 0, 0); o3.scale.set(1, p.h, 1); o3.updateMatrix(); stem.setMatrixAt(i, o3.matrix);
      o3.rotation.set(0, i * 1.3, 0); o3.scale.setScalar(p.s); o3.updateMatrix(); leaf.setMatrixAt(i, o3.matrix);
    });
    this.pet = this.inst(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), n);
    this.cen = this.inst(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12), M.mat('#6b4220', { flat: true }), n);
    // hortum her sıranın güneyinde, batı kıyısındaki dağıtım borusundan; kovanlar parselin güney kıyısında, orta yola bakar
    const rz = P.rows.map((r) => r.reduce((s, p) => s + p.z, 0) / r.length);
    this.hoses = [[SUN_HEAD_X, P.z0 - 0.1, SUN_HEAD_X, MAIN_Z], ...rz.map((z) => [SUN_HEAD_X, z + 0.24, P.x1 - 0.1, z + 0.24])];
    this.wets = this.pl.map((p) => [p.x + 0.05, p.z + 0.1, 0.16]);
    this.hives = [[P.x0 + 0.7, P.z1 + 0.8], [P.x0 + 1.85, P.z1 + 0.8], [P.x1 - 1.85, P.z1 + 0.8], [P.x1 - 0.7, P.z1 + 0.8]]; this.beeN = 18;
    this.tier();
  }
  draw() {
    const { o3, col } = this, big = this.big;
    this.pl.forEach((p, i) => {
      const k = (p.r >= 1 ? 1.05 * big : 0.35 + 0.5 * p.r) * (0.9 + p.s * 0.2);
      o3.position.set(p.x, p.h + 0.05, p.z + 0.06); o3.rotation.set(0.95, ((i % 5) - 2) * 0.12, 0); o3.scale.setScalar(k); o3.updateMatrix();
      this.pet.setMatrixAt(i, o3.matrix); this.cen.setMatrixAt(i, o3.matrix);
      this.pet.setColorAt(i, col.copy(BUD).lerp(PETAL, p.r >= 1 ? 1 : p.r * p.r * 0.6));
    });
    this.pet.instanceMatrix.needsUpdate = true; this.cen.instanceMatrix.needsUpdate = true; this.pet.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
}

// ---------- lale (batı şeridinin kuzeyi, expand-east.js xtarlalar5) ----------
// bitki dört laleli bir demet (iki sıra × iki); her sıra çifti bir renk. Olgun demet açmış renkli kadeh, toplanınca yeşil gonca
export const LALE = [17.4, 22.8, -66.4, -58.2];
const TULIP = ['#e8473c', '#f6c343', '#f28cb1', '#fbf6ec', '#9b59d0', '#f39a3c'].map((c) => new THREE.Color(c)), GONCA = new THREE.Color('#6fae3e');
export class LaleField extends WalkField {
  constructor(C, b = LALE) {
    const [x0, x1, z0, z1] = b, pl = [], tl = [];
    let ci = 0;
    for (let x = x0 + 0.35; x + 0.42 <= x1 - 0.2; x += 0.84, ci++) for (let z = z0 + 0.3; z + 0.27 <= z1 - 0.2; z += 0.54) {
      const p = { x: x + 0.21, z: z + 0.135, s: 1, sp: rand(0.8, 1.25), r: Math.random() < 0.7 ? 1 : rand(0.1, 0.9), c: TULIP[ci % TULIP.length], t: [] };
      for (const [dx, dz] of [[0, 0], [0.42, 0], [0, 0.27], [0.42, 0.27]]) { p.t.push(tl.length); tl.push({ x: x + dx + rand(-0.05, 0.05), z: z + dz + rand(-0.04, 0.04), h: rand(0.85, 1.15) }); }
      pl.push(p);
    }
    soil(C, b);
    super(C, b, 'cicek', pl, 80);
    const n = tl.length, o3 = this.o3;
    const stem = this.inst(new THREE.CylinderGeometry(0.018, 0.022, 0.45, 4).translate(0, 0.225, 0), M.mat('#4f9a3c', { flat: true }), n);
    const leaf = this.inst(new THREE.ConeGeometry(0.13, 0.36, 3).translate(0, 0.16, 0), M.mat('#5fb043', { flat: true }), n);
    tl.forEach((t, i) => {
      o3.position.set(t.x, 0.012, t.z); o3.rotation.set(0, rand(0, 6.3), 0); o3.scale.set(1, t.h, 1); o3.updateMatrix(); stem.setMatrixAt(i, o3.matrix);
      o3.scale.set(1, 1, 1); o3.rotation.set(0.25, rand(0, 6.3), 0); o3.updateMatrix(); leaf.setMatrixAt(i, o3.matrix);
    });
    this.cup = this.inst(new THREE.CylinderGeometry(0.12, 0.07, 0.2, 6), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6 }), n);
    this.tl = tl; this.top = 0.55;
    // hortum her demet sütununun ortasında, ana borudan kuzeye; kovanlar ayçiçeği parseliyle arasındaki boşlukta
    this.hoses = [...new Set(pl.map((p) => p.x))].map((x) => [x, MAIN_Z, x, z0 + 0.1]);
    this.wets = pl.map((p) => [p.x, p.z + 0.04, 0.24]);
    this.hives = [[23.55, -61.2], [23.55, -64.2]]; this.beeN = 12;
    this.tier();
  }
  draw() {
    const { o3, col } = this, big = this.big;
    for (const p of this.pl) {
      const k = p.r >= 1 ? big : 0.45 + 0.4 * p.r;
      col.copy(GONCA).lerp(p.c, p.r >= 1 ? 1 : p.r * p.r * 0.5);
      for (const i of p.t) {
        const t = this.tl[i];
        o3.position.set(t.x, 0.012 + 0.45 * t.h + 0.06 * k, t.z); o3.rotation.set(0, 0, 0); o3.scale.set(k, k * (p.r >= 1 ? 1 : 1.3), k); o3.updateMatrix();
        this.cup.setMatrixAt(i, o3.matrix); this.cup.setColorAt(i, col);
      }
    }
    this.cup.instanceMatrix.needsUpdate = true; this.cup.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
}

// ---------- karpuz (batı şeridinin güneyi, expand-east.js xtarlalar6) ----------
// yere yayılan yapraklar arasında çizgili karpuzlar; toplanınca küçük açık yeşil karpuzdan büyür
export const KARPUZ = [17.4, 22.8, -53.0, -44.6];
const HAM = new THREE.Color('#d6efb0'), OLGUN = new THREE.Color('#ffffff');
export class KarpuzField extends WalkField {
  constructor(C, b = KARPUZ) {
    const [x0, x1, z0, z1] = b, rows = [], pl = [];
    for (let x = x0 + 0.7; x <= x1 - 0.5; x += 1.25) rows.push(x);
    for (const x of rows) for (let z = z0 + 0.6; z <= z1 - 0.5; z += 0.75) pl.push({ x: x + rand(-0.25, 0.25), z: z + rand(-0.12, 0.12), s: rand(0.85, 1.25), sp: rand(0.8, 1.25), r: Math.random() < 0.7 ? 1 : rand(0.1, 0.9), ry: rand(0, 6.3) });
    soil(C, b);
    super(C, b, 'karpuz', pl, 75);
    const lp = []; for (const x of rows) for (let z = z0 + 0.3; z <= z1 - 0.3; z += 0.32) lp.push([x + rand(-0.25, 0.25), z]);
    const leaf = this.inst(new THREE.SphereGeometry(0.22, 7, 4), M.mat('#ffffff', { flat: true }), lp.length), o3 = this.o3, lc = ['#4f9a3c', '#5fb043', '#3f8a35'].map((c) => new THREE.Color(c));
    lp.forEach(([x, z], i) => { o3.position.set(x, 0.1, z); o3.rotation.set(0, rand(0, 6.3), 0); o3.scale.set(1.2, 0.35, 1); o3.updateMatrix(); leaf.setMatrixAt(i, o3.matrix); leaf.setColorAt(i, lc[i % 3]); });
    this.mel = this.inst(new THREE.SphereGeometry(0.2, 14, 8), MAT().melon, pl.length); this.top = 0.35;
    // hortum her sıranın yanında, kuzey kıyısındaki dağıtım borusundan; kovanlar mısır parseliyle arasındaki boşlukta
    this.hoses = [[TANK[0], KARPUZ_Z, x1 - 0.2, KARPUZ_Z], ...rows.map((x) => [x + 0.32, KARPUZ_Z, x + 0.32, z1 - 0.2])];
    this.wets = pl.map((p) => [p.x, p.z, 0.3]);
    this.hives = [[23.6, -47.6], [23.6, -50.6]]; this.beeN = 10;
    this.tier();
  }
  draw() {
    const { o3, col } = this, big = this.big;
    this.pl.forEach((p, i) => {
      const k = (p.r >= 1 ? big : 0.3 + 0.6 * p.r) * p.s;
      o3.position.set(p.x, 0.17 * k + 0.03, p.z); o3.rotation.set(0, p.ry, PI / 2); o3.scale.set(0.85 * k, 1.35 * k, 0.9 * k); o3.updateMatrix();
      this.mel.setMatrixAt(i, o3.matrix); this.mel.setColorAt(i, col.copy(HAM).lerp(OLGUN, p.r >= 1 ? 1 : p.r * 0.6));
    });
    this.mel.instanceMatrix.needsUpdate = true; this.mel.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
}
