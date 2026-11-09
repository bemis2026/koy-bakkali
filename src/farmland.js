// Büyük Tarlalar: çiftliğin kuzeyinde geniş tarla alanı. Dört parsel (iki mısır, iki buğday). Traktör kendi kendine çalışır:
// boş parseli sıra sıra eker, ekin büyür (buğday yeşilden sarıya döner, mısırda koçan belirir), olgunlaşınca sıra sıra biçip
// römorkuna doldurur, tarla girişindeki hasat yığınlarına boşaltır. Koçanı ve buğdayı oyuncu ya da taşıyıcı yığından alır.
// Ses: ambience.js 'traktor' katmanı (TRACTOR dikdörtgeni traktörü izler).
import * as THREE from 'three';
import * as M from './models.js';
import { G, Generator, makeItem, fly, rand, lerpAngle } from './game.js';
import { texRep } from './tex.js';
import { TRACTOR } from './ambience.js';
import { SunField, FT } from './tarla.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
const ROW = 1.1, STEP = 0.9, GROW = 55, YIELD = 5, CAP = 30;
const PLOTS = [
  { type: 'kocan', x0: 24.6, x1: 36.4, z0: -53.4, z1: -44.6, g0: 1 },
  { type: 'bugday', x0: 39.6, x1: 51.4, z0: -53.4, z1: -44.6, g0: 0.6 },
  { type: 'bugday', x0: 24.6, x1: 36.4, z0: -66.4, z1: -57.6, g0: 0.25 },
  { type: 'kocan', x0: 39.6, x1: 51.4, z0: -66.4, z1: -57.6, g0: -1 }, // -1: anız, ekilmeyi bekler
];
const ROAD_Z = -42.4, MID_Z = -55.0, TRACK_X = 38.0; // harita genişletmesi: doğu blok +7
const DUMP = { kocan: [33.6, -40.6], bugday: [42.4, -40.6] };
const GREEN = new THREE.Color('#7cbf4a'), GOLD = new THREE.Color('#e8c25a'), STUBBLE = new THREE.Color('#c9a35a');
// Ayçiçeği Tarlası (expand-east.js xtarlalar2; 2026-11-03 kullanıcı: "toplanan küçük tarlaları kaldır, güzel tarlayı toplama alanı yap"):
// alınınca kuzeybatı parseli traktörden çıkar, ayçiçeği tarlası olur (tarla.js SunField: içinde yürüyen oyuncu olgun başları toplar,
// taşıyıcı da toplar; kademeleri de orada). Traktör kalan üç parselde çalışır
const SUN_PLOT = 2;
let farm = null, sunCtx = null;
export function sunflowerField(c) { sunCtx = c; if (farm) farm.sun(c); }

export function setupFarmland(R, T) {
  const C = R.content, { put, strip, rcol, hint, icon } = T;
  strip(C, TRACK_X, ROAD_Z, 29.4, 2.6, 'path', 3);
  strip(C, TRACK_X, MID_Z, 29.4, 2.4, 'path', 3, 0.011);
  strip(C, TRACK_X, -54.6, 2.4, 25, 'path', 3, 0.012);

  // ---------- parseller ve ekin ----------
  const cornGeo = new THREE.ConeGeometry(0.24, 1, 5); cornGeo.translate(0, 0.5, 0);
  const wheatGeo = new THREE.ConeGeometry(0.2, 1, 6); wheatGeo.translate(0, 0.5, 0);
  const cobGeo = new THREE.CapsuleGeometry(0.06, 0.16, 3, 6);
  const o3 = new THREE.Object3D(), col = new THREE.Color();
  for (const P of PLOTS) {
    const w = P.x1 - P.x0, d = P.z1 - P.z0;
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, d + 0.6), new THREE.MeshStandardMaterial({ map: texRep('soil', w / 2.4, d / 2.4), roughness: 1 }));
    soil.rotation.x = -PI / 2; soil.position.set((P.x0 + P.x1) / 2, 0.012, (P.z0 + P.z1) / 2); soil.receiveShadow = true; C.add(soil);
    P.rows = [];
    for (let z = P.z0 + 0.55; z <= P.z1 - 0.3; z += ROW) {
      const row = [];
      for (let x = P.x0 + 0.45; x <= P.x1 - 0.3; x += STEP) row.push({ x: x + rand(-0.12, 0.12), z: z + rand(-0.08, 0.08), g: 0, s: rand(0.85, 1.15) });
      P.rows.push(row);
    }
    P.plants = P.rows.flat();
    const n = P.plants.length;
    P.mesh = new THREE.InstancedMesh(P.type === 'kocan' ? cornGeo : wheatGeo, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), n);
    P.mesh.castShadow = true; P.mesh.receiveShadow = true; C.add(P.mesh);
    if (P.type === 'kocan') { P.cobs = new THREE.InstancedMesh(cobGeo, M.mat('#f2c94c', { flat: true }), n); C.add(P.cobs); }
    // çizim sınırı parselin kendisi: three ilk çizimde örneklerin o anki (henüz konmamış, hepsi köyün ortasında) matrislerinden hesaplıyordu,
    // ekinler tarlaya bakınca ekran dışında sayılıp hiç çizilmiyordu (2026-11-02: dört büyük tarla boş görünüyordu)
    const bs = new THREE.Sphere(V((P.x0 + P.x1) / 2, 0.9, (P.z0 + P.z1) / 2), Math.hypot(w, d) / 2 + 1.2);
    P.mesh.boundingSphere = bs; if (P.cobs) P.cobs.boundingSphere = bs.clone();
    for (const p of P.plants) p.g = P.g0 < 0 ? -1 : Math.min(1, P.g0 * rand(0.85, 1.1));
    P.state = P.g0 < 0 ? 'stubble' : P.g0 >= 1 ? 'ripe' : 'sown';
    P.dirty = true;
  }
  // bitki boyu ve rengi büyümeye göre; anız (g<0) kısa kuru sap
  function draw(P) {
    P.plants.forEach((p, i) => {
      const g = p.g, corn = P.type === 'kocan';
      const h = g < 0 ? 0.14 : corn ? 0.2 + 1.5 * g : 0.15 + 0.7 * g, r = g < 0 ? 0.5 : corn ? 0.55 + 0.6 * g : 0.6 + 0.6 * g;
      o3.position.set(p.x, 0, p.z); o3.rotation.set(0, i * 1.7, 0); o3.scale.set(r * p.s, h * p.s, r * p.s); o3.updateMatrix();
      P.mesh.setMatrixAt(i, o3.matrix);
      if (g < 0) col.copy(STUBBLE); else if (corn) col.copy(GREEN).lerp(new THREE.Color('#5aa83f'), g); else col.copy(GREEN).lerp(GOLD, Math.max(0, (g - 0.35) / 0.65));
      P.mesh.setColorAt(i, col);
      if (P.cobs) { const ripe = g >= 0.8; o3.position.set(p.x + 0.09, h * p.s * 0.55, p.z); o3.rotation.set(0.3, 0, -0.35); o3.scale.setScalar(ripe ? p.s : 0.0001); o3.updateMatrix(); P.cobs.setMatrixAt(i, o3.matrix); }
    });
    P.mesh.instanceMatrix.needsUpdate = true; if (P.mesh.instanceColor) P.mesh.instanceColor.needsUpdate = true;
    if (P.cobs) P.cobs.instanceMatrix.needsUpdate = true;
    P.dirty = false;
  }

  // ---------- hasat yığınları: tarla girişinde, çiftlik tarafında, yerde tahta palet üstünde ----------
  R.gens = {};
  for (const type of ['kocan', 'bugday']) {
    const [x, z] = DUMP[type];
    put(C, M.rbox(1.9, 0.12, 1.1, 0.02, M.mat('#a8703f')), x, 0.06, z);
    rcol(R, x - 0.95, x + 0.95, z - 0.55, z + 0.55);
    const g = new Generator(C, { type, interval: 1e9, max: 24, origin: V(x, 1.0, z), tray: [x, 0.14, z], zx: x, zz: z + 1.2, zw: 2.4, zd: 1.2, instant: true });
    g.canMake = () => false;
    R.gens[type] = g;
    hint(x, 1.9, z, icon(type), type === 'kocan' ? 'Hasat yığını · Koçan' : 'Hasat yığını · Buğday', type === 'kocan' ? 'Traktör biçtiği koçanı buraya boşaltır. Sahildeki mısır kazanına götür, taşıyıcı da götürür.' : 'Traktör biçtiği buğdayı buraya boşaltır. Harmana ya da handaki fırına götürülür.', 3.4);
  }
  // dekor: korkuluk, saman balyaları, uçlarda ağaçlar
  put(C, M.makeScarecrow(), 23.9, 0, -49.0, PI / 2);
  for (const [x, z, r] of [[52.2, -47.0, 0.3], [52.2, -48.4, 1.2], [52.3, -62.0, 0.6]]) put(C, M.makeHay(), x, 0, z, r);
  // (23,9/-56) tarlalar arasındaki yolun üstündeydi: kaldırıldı (2026-11-01 kullanıcı: "yolda duranları kaldır")
  for (const [x, z] of [[23.9, -67.2], [52.2, -67.2]]) { put(C, M.makeTree(1, rand(0.9, 1.1)), x, 0, z, rand(0, 6)); rcol(R, x - 0.4, x + 0.4, z - 0.4, z + 0.4); }

  // ---------- traktör ----------
  const tr = M.makeVillageCar('tractor', { color: '#d23f31' }); tr.position.set(TRACK_X, 0, -46.0); tr.rotation.y = PI; C.add(tr);
  const trailerLoad = new THREE.Group(); trailerLoad.position.set(0, 0.74, -2.7); tr.add(trailerLoad);
  const S = { path: [], task: null, load: 0, loadType: null, v: 0, wait: 0, unloadT: 0 };
  const near = (p) => Math.hypot(p.x - tr.position.x, p.z - tr.position.z);
  // parsel işi: ortadaki yol kavşağından girer, yol tarafındaki uçtan başlayıp sıra sıra gidip gelir (dönüşler parselin
  // dışında), son sıradan parselin kenarı boyunca ortadaki yola döner
  function passPath(P) {
    const west = P.x1 < TRACK_X, near = west ? P.x1 + 1.2 : P.x0 - 1.2, far = west ? P.x0 - 1.2 : P.x1 + 1.2;
    const rows = P.z1 > -50 ? P.rows : [...P.rows].reverse(); // orta yola yakın sıradan başla
    const pts = [V(TRACK_X, 0, tr.position.z), V(TRACK_X, 0, MID_Z)]; // önce yola çıkar, tarlanın içinden kestirme gitmez
    rows.forEach((row, i) => { const z = row[0].z, a = i % 2 ? far : near, b = i % 2 ? near : far; pts.push(V(a, 0, z)); const e = V(b, 0, z); e.work = true; pts.push(e); });
    const endX = pts[pts.length - 1].x;
    pts.push(V(endX, 0, MID_Z), V(TRACK_X, 0, MID_Z));
    return pts;
  }
  function dumpPath() { const [x] = DUMP[S.loadType]; return [V(TRACK_X, 0, tr.position.z), V(TRACK_X, 0, ROAD_Z), V(x, 0, ROAD_Z)]; }
  const room = (t) => R.gens[t].max - R.gens[t].items.length;
  // iş seçimi: römork doluysa yığına boşaltır; yığın da doluysa o arada boş parseli eker. Olgun parseli yalnızca
  // römork boşken ve yığınında yer varken biçer; iş yoksa park yerinde (yük varsa yığının yanında) bekler
  function pickTask() {
    if (S.load > 0 && room(S.loadType) > 0) { S.task = { kind: 'dump' }; S.path = dumpPath(); return; }
    const ripe = S.load > 0 ? null : PLOTS.find((P) => !P.off && P.state === 'ripe' && room(P.type) >= 8);
    const bare = PLOTS.find((P) => !P.off && P.state === 'stubble');
    const P = ripe || bare;
    if (!P) {
      S.task = null;
      const home = S.load > 0 ? V(DUMP[S.loadType][0], 0, ROAD_Z) : V(TRACK_X, 0, -46.0);
      S.path = near(home) < 0.5 ? [] : S.load > 0 ? dumpPath() : [V(TRACK_X, 0, tr.position.z), home];
      return;
    }
    S.task = { kind: ripe ? 'harvest' : 'sow', P };
    S.path = passPath(P);
  }
  R.update = (dt) => {
    // ekin büyür
    for (const P of PLOTS) {
      if (P.off) continue;
      if (P.state === 'sown' || P.state === 'sowing') {
        let all = true;
        for (const p of P.plants) if (p.g >= 0 && p.g < 1) { p.g = Math.min(1, p.g + (dt * ((G.mods && G.mods.trGrow) || 1)) / GROW); all = all && p.g >= 1; } else if (p.g < 0) all = false;
        if (P.state === 'sown' && all) P.state = 'ripe';
        P.growT = (P.growT || 0) + dt;
        if (P.growT > 0.5) { P.growT = 0; P.dirty = true; }
      }
      if (P.dirty) draw(P);
    }
    // traktör
    if (!S.task && !S.path.length) { S.wait -= dt; if (S.wait <= 0) { pickTask(); S.wait = 3; } }
    if (S.task && S.task.kind === 'dump' && !S.path.length) {
      const gen = R.gens[S.loadType];
      S.unloadT -= dt;
      if (S.unloadT <= 0 && S.load > 0) {
        S.unloadT = 0.18;
        if (gen.items.length < gen.max) {
          const it = makeItem(S.loadType); it.position.set(tr.position.x, 1.3, tr.position.z - 1.5); G.scene.add(it);
          gen.items.push(it); fly(it, gen.tray, gen.slot(gen.items.length - 1), 0.35, 1.0);
          S.load--; if (trailerLoad.children.length > Math.ceil(S.load / 3)) trailerLoad.remove(trailerLoad.children[trailerLoad.children.length - 1]);
        } else { S.task = null; S.wait = 2; } // yığın dolu: başka işe bakar, yer açılınca kalanı boşaltır
      }
      if (S.load <= 0 && S.task) { S.task = null; S.wait = 1; }
    }
    const t = S.path[0];
    if (t) {
      const p = tr.position, dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      const working = S.task && (S.task.kind === 'harvest' || S.task.kind === 'sow') && t.work;
      const top = working ? 1.6 : 3.2;
      S.v += (top - S.v) * Math.min(1, dt * 2);
      const st = Math.min(d, S.v * dt);
      if (d < 0.05 || st >= d) { p.x = t.x; p.z = t.z; S.path.shift(); if (!S.path.length && S.task && S.task.kind !== 'dump') { finishPass(); } }
      else { p.x += (dx / d) * st; p.z += (dz / d) * st; tr.rotation.y = lerpAngle(tr.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-5 * dt)); }
      for (const w of tr.userData.wheels || []) w.rotation.x += st / 0.4;
      tr.position.y = Math.abs(Math.sin(G.time * 14)) * 0.02;
      if (working) workAt(S.task, p.x, p.z);
    }
    // ses: traktörün yeri
    TRACTOR[0][0] = tr.position.x - 1; TRACTOR[0][1] = tr.position.x + 1; TRACTOR[0][2] = tr.position.z - 1; TRACTOR[0][3] = tr.position.z + 1;
    // oyuncu traktörün ve römorkun içinden geçmez, yanından kayar
    const pp = G.player.position, fx = Math.sin(tr.rotation.y), fz = Math.cos(tr.rotation.y);
    for (const [ox, rr] of [[0.5, 1.2], [-2.6, 1.15]]) {
      const cx = tr.position.x + fx * ox, cz = tr.position.z + fz * ox, ddx = pp.x - cx, ddz = pp.z - cz, dd = Math.hypot(ddx, ddz);
      if (dd < rr && dd > 1e-3) { pp.x = cx + (ddx / dd) * rr; pp.z = cz + (ddz / dd) * rr; }
    }
  };
  // sıradaki bitkileri traktörün önünde biçer ya da eker
  function workAt(task, x, z) {
    const P = task.P;
    for (const row of P.rows) {
      if (Math.abs(row[0].z - z) > 0.45) continue;
      for (const p of row) {
        if (Math.abs(p.x - x) > 0.6) continue;
        if (task.kind === 'harvest' && p.g >= 0.9) {
          p.g = -1; P.dirty = true; task.cut = (task.cut || 0) + 1;
          if (task.cut % YIELD === 0 && S.load < CAP) {
            S.load++; S.loadType = P.type;
            if (trailerLoad.children.length < Math.ceil(S.load / 3) && trailerLoad.children.length < 10) { const m = makeItem(P.type); const k = trailerLoad.children.length; m.position.set(-0.5 + (k % 3) * 0.5, Math.floor(k / 3) * 0.22, -0.6 + (k % 2) * 0.5); trailerLoad.add(m); }
          }
        } else if (task.kind === 'sow' && p.g < 0) { p.g = 0.02; P.dirty = true; P.state = 'sowing'; }
      }
    }
  }
  function finishPass() {
    const P = S.task.P;
    if (S.task.kind === 'harvest') { for (const p of P.plants) if (p.g >= 0.9) p.g = -1; P.state = 'stubble'; P.dirty = true; }
    else { for (const p of P.plants) if (p.g < 0) p.g = 0.02; P.state = 'sown'; P.dirty = true; }
    S.task = null; S.wait = 0.5;
  }
  R.activate = () => {};
  R.farm = { PLOTS, S, tr, FT }; // test kancası
  // Ayçiçeği Tarlası alınınca (ya da kayıtta alınmışsa) kuzeybatı parseli dönüşür; parselin toprağı kalır
  farm = {
    sun: (c) => {
      const P = PLOTS[SUN_PLOT];
      if (P.off) return;
      P.off = true; C.remove(P.mesh);
      if (S.task && S.task.P === P) { S.task = null; S.path = []; S.wait = 0.5; }
      const f = new SunField(C, P), cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
      c.src('aycicek', f); R.farm.sun = f;
      M.fieldMarks(C, cx, cz, 'aycicek', P.x1 - P.x0, P.z1 - P.z0);
      hint(P.x0 + 2.2, 1.9, P.z1 + 0.3, icon('aycicek'), 'Ayçiçeği tarlası', 'İçinde yürü: yanındaki olgun başlar sırtına gelir. Taşıyıcı da toplar.');
    },
  };
  if (sunCtx) farm.sun(sunCtx);
  return R;
}
