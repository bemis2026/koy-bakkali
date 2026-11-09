// Poly Pizza araçları (assets/vehicles, kaynaklar CREDITS.txt'de; CC BY 3.0): motosiklet (MiniPoly "Bike"), bisiklet ve sandal (Poly by Google).
// Yüklenince parçaların dönüşü geometriye işlenir, ölçeklenir, tabanı y=0'a oturur; önü +z (sandalın boyu x boyunca, eski tekne gibi).
// Tekerler ayrı göbek gruplarında döner (userData.wheels, rotation.x): world.js ve upgrades.js eski çizimdeki gibi çevirir.
// models.js makeBicycle/makeBoat ve riders.js makeMotorbike bunların kopyasını döndürür. Yüklenemeyen araç kodla çizilen eski halinde kalır.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// seat: modelin kendi biriminde sele üstünün yüksekliği ve sele ortasının z'si (ölçülerek). top/z: oyunda sele üstü ve sele ortası.
// Sürücüyü world.js ve upgrades.js yerleştirir: aracın 0,2 (bisiklet) / 0,38 (motor) gerisinde, sabit yükseklikte (0,65 / 0,28);
// ölçek seleden çıkar (bisikletin selesi tekerine göre yüksek: boyu 1,96, teker çapı 0,7). tint: araç rengini alan malzeme
// ('tex': dokudaki mavi gövde). col: malzeme renkleri (bisikletin nane yeşili selesi ve elcikleri kahverengi deri). len: sandalın boyu.
// flat: dokusu düz renk alanlarından oluşur; her renk ayrı dokusuz malzeme olur (perf.js düz renkli parçaları tek çizimde birleştirir)
const SPEC = {
  motosiklet: { seat: [4.36, -2.395], top: 0.86, z: -0.43, wheels: true, tint: 'tex' },
  bisiklet: { off: true, seat: [256.4, -112.85], top: 1.12, z: -0.25, wheels: true, tint: 'Mat.2', col: { 'Mat.3': '#4a3328' } },
  sandal: { len: 3.0, flat: true },
};
const T = {};
export const hasVehicle = (k) => !!T[k];

export async function loadVehicles(base = 'assets/vehicles/') {
  const L = new GLTFLoader();
  // off: oyunda yüklenmez, kodla çizilen eski hali kalır (2026-11-03 kullanıcı: "bisikletleri 3d değil eski haline getir")
  await Promise.all(Object.keys(SPEC).filter((k) => !SPEC[k].off).map(async (k) => {
    try { T[k] = fit(k, (await L.loadAsync(`${base}${k}.glb`)).scene); } catch (e) { console.warn('araç modeli yüklenemedi:', k, e); }
  }));
}

// GLB malzemesi oyununkiyle aynı: metalsiz ve mat (yapi.js matte)
const matte = (m, col) => { m = m.clone(); m.metalness = 0; m.roughness = Math.max(m.roughness, 0.85); if (col) m.color.set(col); return m; };
const flatMats = new Map();
const flatMat = (hex) => { if (!flatMats.has(hex)) flatMats.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 })); return flatMats.get(hex); };

function fit(k, o) {
  const sp = SPEC[k];
  o.updateMatrixWorld(true);
  const parts = [];
  o.traverse((m) => { if (m.isMesh) parts.push({ geo: m.geometry.clone().applyMatrix4(m.matrixWorld), mat: m.material }); });
  const all = new THREE.Box3();
  for (const p of parts) { p.geo.computeBoundingBox(); all.union(p.geo.boundingBox); Object.assign(p, pieces(p.geo)); }
  const s = sp.len ? sp.len / (all.max.x - all.min.x) : sp.top / (sp.seat[0] - all.min.y);
  const cx = (all.min.x + all.max.x) / 2, cz = sp.len ? (all.min.z + all.max.z) / 2 : sp.seat[1], dz = sp.len ? 0 : sp.z;
  const place = (v) => v.set((v.x - cx) * s, (v.y - all.min.y) * s, (v.z - cz) * s + dz);
  // tekerler: yere değen, yan yüzü yuvarlak (boyu ≈ eni), ince ve büyük parçalar (bisikletin çapraz kadro borusu da kare kutulu ama
  // havada); aynı merkezdekiler (lastik, jant) tek teker. Kutusu tekerin içinde kalan parçalar (jant telleri, göbek) tekerle döner;
  // çatal ve çamurluk tekerin dışına taşar, gövdede kalır
  const wheels = [];
  if (sp.wheels) {
    const H = all.max.y - all.min.y, sz = new THREE.Vector3(), c = new THREE.Vector3();
    for (const p of parts) for (const q of p.list) {
      q.box.getSize(sz); q.box.getCenter(c);
      if (q.box.min.y - all.min.y > 0.05 * H || sz.y < 0.25 * H || Math.abs(sz.y - sz.z) > 0.1 * sz.y || sz.x > 0.5 * sz.y) continue;
      const w = wheels.find((w) => w.c.distanceTo(c) < 0.1 * sz.y);
      if (w) w.box.union(q.box); else wheels.push({ box: q.box.clone(), c: c.clone() });
    }
    for (const w of wheels) w.box.expandByScalar(0.02 * w.box.getSize(new THREE.Vector3()).y);
  }
  const g = new THREE.Group();
  const hubs = wheels.map((w) => { const h = new THREE.Group(); h.name = 'teker'; h.position.copy(place(w.box.getCenter(new THREE.Vector3()))); g.add(h); return h; });
  const sampler = sp.flat ? texSampler : null;
  for (const p of parts) {
    const mat = sp.flat ? null : matte(p.mat, sp.col && sp.col[p.mat.name]), look = sampler && p.mat.map ? sampler(p.mat.map) : null;
    const buckets = new Map(); // teker sırası (0: gövde) + renk -> üçgenler
    for (const q of p.list) {
      const wi = wheels.findIndex((w) => w.box.containsBox(q.box)) + 1;
      for (const t of q.tris) {
        const key = `${wi}|${look ? look(p.src, t) : ''}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(t);
      }
    }
    for (const [key, L] of buckets) {
      const [wi, hex] = key.split('|'), geo = pick(p.src, L), pos = geo.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, ...place(v.fromBufferAttribute(pos, i)).toArray());
      const parent = +wi ? hubs[wi - 1] : g;
      if (parent !== g) geo.translate(-parent.position.x, -parent.position.y, -parent.position.z);
      geo.computeVertexNormals(); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, hex ? flatMat(hex) : mat); m.castShadow = true; m.receiveShadow = true;
      if (m.material.map) m.material.map.anisotropy = 4;
      parent.add(m);
    }
  }
  g.userData.tint = sp.tint;
  return g;
}

// geometriyi birbirine değen parçalarına ayırır (aynı konumdaki köşeyi paylaşan üçgenler aynı parça): src (indekssiz) ve [{ tris, box }]
function pieces(geo) {
  const src = geo.index ? geo.toNonIndexed() : geo, pos = src.attributes.position, nT = pos.count / 3;
  const up = Array.from({ length: nT }, (_, i) => i), find = (a) => (up[a] === a ? a : (up[a] = find(up[a]))), seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`, t = Math.floor(i / 3);
    if (seen.has(k)) up[find(seen.get(k))] = find(t); else seen.set(k, t);
  }
  const by = new Map(), v = new THREE.Vector3();
  for (let t = 0; t < nT; t++) {
    const r = find(t);
    if (!by.has(r)) by.set(r, { tris: [], box: new THREE.Box3() });
    const q = by.get(r); q.tris.push(t * 3);
    for (let j = 0; j < 3; j++) q.box.expandByPoint(v.fromBufferAttribute(pos, t * 3 + j));
  }
  return { src, list: [...by.values()] };
}
// indekssiz geometriden seçilen üçgenlerle (ilk köşe sırası) yeni geometri
function pick(src, L) {
  const out = new THREE.BufferGeometry();
  for (const [n, a] of Object.entries(src.attributes)) {
    const arr = new Float32Array(L.length * 3 * a.itemSize);
    L.forEach((t, i) => { for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) arr[(i * 3 + v) * a.itemSize + c] = a.getComponent(t + v, c); });
    out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return out;
}
const pixels = (tex) => {
  const img = tex.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
  return { cv, x, d: x.getImageData(0, 0, cv.width, cv.height) };
};
// üçgenin rengi: uv ortasındaki doku pikseli (GLTF dokusu flipY kapalı: v=0 resmin üstü)
function texSampler(tex) {
  const { cv, d } = pixels(tex), W = cv.width, H = cv.height;
  return (src, t) => {
    const uv = src.attributes.uv; let u = 0, v = 0;
    for (let j = 0; j < 3; j++) { u += uv.getX(t + j) / 3; v += uv.getY(t + j) / 3; }
    const i = (Math.min(H - 1, Math.max(0, Math.floor(v * H))) * W + Math.min(W - 1, Math.max(0, Math.floor(u * W)))) * 4;
    return '#' + [d.data[i], d.data[i + 1], d.data[i + 2]].map((n) => n.toString(16).padStart(2, '0')).join('');
  };
}

// motosiklet dokusunun mavi gövde piksellerini col tonuna çevirir (aynalar, far, sele ve lastikler kendi renginde); renk başına bir kez
const texTints = new Map();
function tintTex(mat, col) {
  const key = mat.uuid + col;
  if (texTints.has(key)) return texTints.get(key);
  const { cv, x, d } = pixels(mat.map), a = d.data, c = new THREE.Color(), h = {}, to = new THREE.Color(col).getHSL({}, THREE.SRGBColorSpace), o = {};
  for (let i = 0; i < a.length; i += 4) {
    c.setRGB(a[i] / 255, a[i + 1] / 255, a[i + 2] / 255, THREE.SRGBColorSpace).getHSL(h, THREE.SRGBColorSpace);
    if (h.s < 0.3 || h.h < 0.54 || h.h > 0.64) continue; // gövdenin mavisi (açık #5fa9e4, koyu #2089b7)
    c.setHSL(to.h, Math.min(1, (to.s * h.s) / 0.7), Math.min(0.9, (h.l * to.l) / 0.62), THREE.SRGBColorSpace).getRGB(o, THREE.SRGBColorSpace);
    a[i] = o.r * 255; a[i + 1] = o.g * 255; a[i + 2] = o.b * 255;
  }
  x.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;
  tex.wrapS = mat.map.wrapS; tex.wrapT = mat.map.wrapT;
  const m = mat.clone(); m.map = tex;
  texTints.set(key, m);
  return m;
}
const tints = new Map();
// col: araç rengi (motosiklet gövdesi, bisiklet kadrosu); sandal tek renk
export function vehicle(k, col) {
  const t = T[k];
  if (!t) return null;
  const g = t.clone(true), tint = t.userData.tint;
  if (col && tint) g.traverse((m) => {
    if (!m.isMesh) return;
    if (tint === 'tex') { if (m.material.map) m.material = tintTex(m.material, col); return; }
    if (m.material.name !== tint) return;
    const key = m.material.uuid + col;
    if (!tints.has(key)) { const c = m.material.clone(); c.color.set(col); tints.set(key, c); }
    m.material = tints.get(key);
  });
  g.userData = { wheels: g.children.filter((c) => c.name === 'teker') };
  return g;
}
