// Poly Pizza köy yapıları (assets/buildings, kaynaklar CREDITS.txt'de; hepsi CC0): ev, ahır, kümes, kuyu, yel değirmeni, çit, sokak lambası.
// Yüklenince parçaların dönüşü geometriye işlenir, ölçeklenir, tabanı y=0'a oturur; models.js'teki makeHouse/makeBarn/... bunların kopyasını
// döndürür. Kopyalar geometri ve malzemeyi paylaşır (perf.js kımıldamayanları yine birleştirir). Yüklenemeyen yapı kodla çizilen eski halinde kalır.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// h: oyundaki boy, w: en (x), s: doğrudan ölçek. c: ortalanacak parça (malzeme ya da mesh adı; yoksa bütün kutu).
// ground: model kendi y=0'ını zemin sayar (kuyunun taş tabanı toprağın altına iniyor). col: malzeme renkleri oyunun paletine (eski kodla
// çizilen yapıların renkleri: krem duvar #fff3dc, kiremit #c8643b, ahşap #8b5a2b); modelin kendi renkleri gri ve soluk
const WOOD = { Wood: '#8b5a2b', Wood_Light: '#b07a48', Brown: '#8b5a2b' }, STONE = { Stone: '#b9b3a8', Stone_Light: '#d8d2c6' };
const SPEC = {
  ev: { s: 1, c: 'Walls', col: { ...WOOD, ...STONE } }, // makeHouse istenen en ve derinliğe göre ölçekler; duvar ve çatı onun renginde
  ahir: { w: 4.4, col: { ...WOOD, Brown: '#a86a3c', DarkRed: '#c9503f', LightRed: '#e46a58', White: '#ffffff', RoofBlack: '#b5573a' } },
  kumes: { s: 1.45, c: 'White', col: { ...WOOD, DarkRed: '#e8b866', LightRed: '#f2d8a8', White: '#ffffff', RoofBlack: '#c8643b' } },
  kuyu: { h: 2.8, ground: true, col: { ...WOOD, Bag: '#d9c08a', RoofTiles_Red: '#c8643b', Stone_Dark: '#9da3a8', Stone_Light: '#c4beb3' } },
  degirmen: { h: 6.8, c: 'Walls', col: { ...WOOD, ...STONE, Walls: '#fff3dc', Main: '#c8643b', Fabric: '#fffaf0' } }, // eski değirmenin kanatları çok uzundu (≈8 m); kule boyu yakın kalsın
  cit: { h: 1.25 },
  lamba: { h: 3.3, c: 'post_lantern' },
};
const T = {};
export const hasBuilding = (k) => !!T[k];
export const buildingSize = (k, part = 'size') => T[k].userData[part];

// GLB malzemesi oyununkiyle aynı: metalsiz ve mat (models.js mat). Quaternius dışa aktarımı metalik 0,4 / pürüzlülük 0,3; ortam haritası
// olmayan sahnede model %40 koyu ve plastik gibi parlak duruyordu. Dokulu modeller zaten pürüzlülük 1
const matte = (o, col = {}) => {
  o.traverse((c) => { if (c.material) for (const m of [].concat(c.material)) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.85); if (col[m.name]) m.color.set(col[m.name]); } });
  return o;
};
// oyunda kullanılanlar (2026-11-01 kullanıcı: ahır, çit ve sokak lambası kodla çizilen eski halinde). Modeller yerinde; vitrin hepsini yükler (all)
const OYUNDA = ['ev', 'kumes', 'kuyu', 'degirmen'];
export async function loadBuildings(base = 'assets/buildings/', all = false) {
  const L = new GLTFLoader();
  await Promise.all((all ? Object.keys(SPEC) : OYUNDA).map(async (k) => {
    try { T[k] = fit(k, matte((await L.loadAsync(`${base}${k}.glb`)).scene, SPEC[k].col)); } catch (e) { console.warn('yapı modeli yüklenemedi:', k, e); }
  }));
}

function fit(k, o) {
  const sp = SPEC[k];
  o.updateMatrixWorld(true);
  const parts = [];
  o.traverse((m) => { if (m.isMesh) parts.push({ geo: m.geometry.clone().applyMatrix4(m.matrixWorld), mat: m.material, name: m.name }); });
  const box = (L) => { const b = new THREE.Box3(); for (const p of L) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } return b; };
  const all = box(parts), cp = sp.c ? parts.filter((p) => p.mat.name === sp.c || p.name === sp.c) : [], cb = cp.length ? box(cp) : all;
  const base = sp.ground ? 0 : all.min.y;
  const s = sp.s || (sp.w ? sp.w / (all.max.x - all.min.x) : sp.h / (all.max.y - base));
  const cx = (cb.min.x + cb.max.x) / 2, cz = (cb.min.z + cb.max.z) / 2;
  const place = (geo) => geo.translate(-cx, -base, -cz).scale(s, s, s);
  const g = new THREE.Group();
  const add = (geo, mat, parent) => {
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
    if (mat.map) mat.map.anisotropy = 4;
    parent.add(m); return m;
  };
  if (k === 'degirmen') {
    // kanatlar ayrı göbekte döner (eski değirmen gibi userData.hub.rotation.z): yelken bezleri ve bütünüyle önde (z > 0,3) duran ahşap
    // parçalar (dört kol ve göbek kapağı). Kapı önündeki sandıklar z 0,24'ten başladığı için kulede kalır
    const sail = parts.find((p) => p.mat.name === 'Fabric'), hc = new THREE.Vector3();
    sail.geo.boundingBox.getCenter(hc);
    hc.set((hc.x - cx) * s, (hc.y - base) * s, (sail.geo.boundingBox.max.z - cz) * s);
    const hub = new THREE.Group(); hub.name = 'hub'; hub.position.copy(hc); g.add(hub);
    for (const p of parts) {
      const [front, rest] = p === sail ? [p.geo, null] : p.mat.name === 'Wood' ? split(p.geo, (min) => min.z > 0.3) : [null, p.geo];
      if (front) add(place(front).translate(-hc.x, -hc.y, -hc.z), p.mat, hub);
      if (rest) add(place(rest), p.mat, g);
    }
  } else for (const p of parts) add(place(p.geo), p.mat, g);
  if (k === 'lamba') {
    // fener camı kendi dokusuyla parlar (çerçeve koyu kalır): eski lambanın sarı ampulü gibi
    const ln = g.children.find((m, i) => parts[i].name === 'post_lantern_lantern');
    if (ln) { const m = ln.material.clone(); m.emissive.set('#ffd27a'); m.emissiveMap = m.map; m.emissiveIntensity = 0.9; ln.material = m; }
  }
  g.updateMatrixWorld(true);
  g.userData.size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()); // bütün yapı
  g.userData.core = cb.getSize(new THREE.Vector3()).multiplyScalar(s); // ortalanan parça (ev: duvarlar)
  return g;
}

// geometriyi birbirine değen parçalarına ayırır, her parçanın kutusuna göre ikiye böler (değirmen: kanat ahşabı / kule ahşabı)
function split(geo, pred) {
  const src = geo.index ? geo.toNonIndexed() : geo, pos = src.attributes.position, nT = pos.count / 3;
  const up = Array.from({ length: nT }, (_, i) => i), find = (a) => (up[a] === a ? a : (up[a] = find(up[a]))), seen = new Map();
  for (let i = 0; i < pos.count; i++) { // aynı konumdaki köşeyi paylaşan üçgenler aynı parça
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`, t = Math.floor(i / 3);
    if (seen.has(k)) up[find(seen.get(k))] = find(t); else seen.set(k, t);
  }
  const boxes = new Map(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const r = find(Math.floor(i / 3));
    if (!boxes.has(r)) boxes.set(r, new THREE.Box3());
    boxes.get(r).expandByPoint(v.fromBufferAttribute(pos, i));
  }
  const keep = [[], []];
  for (let t = 0; t < nT; t++) { const b = boxes.get(find(t)); keep[pred(b.min, b.max) ? 0 : 1].push(t * 3); }
  return keep.map((L) => {
    if (!L.length) return null;
    const out = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(src.attributes)) {
      const arr = new a.array.constructor(L.length * 3 * a.itemSize);
      L.forEach((t, i) => { for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) arr[(i * 3 + v) * a.itemSize + c] = a.array[(t + v) * a.itemSize + c]; });
      out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize, a.normalized));
    }
    return out;
  });
}

const tintCache = new Map();
// o.tint: bütün malzemelerin rengi ya da { malzemeAdı: renk } (ev: duvar ve çatı). o.s: ölçek; o.sx/o.sy/o.sz: eksen ölçekleri (ev, ahır)
export function building(k, o = {}) {
  const t = T[k];
  if (!t) return null;
  const g = t.clone(true);
  if (o.tint) g.traverse((m) => {
    if (!m.isMesh) return;
    const col = typeof o.tint === 'string' ? o.tint : o.tint[m.material.name];
    if (!col) return;
    const key = m.material.uuid + col;
    let c = tintCache.get(key);
    if (!c) { c = m.material.clone(); c.color.set(col); tintCache.set(key, c); }
    m.material = c;
  });
  if (o.s) g.scale.setScalar(o.s);
  if (o.sx) g.scale.set(o.sx, o.sy || o.sx, o.sz || o.sx);
  const hub = g.getObjectByName('hub');
  if (hub) g.userData.hub = hub;
  return g;
}
