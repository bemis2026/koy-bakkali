// Çizim yükünü azaltan yardımcılar (main.js çağırır).
// sweepSizes: küçük parçalar gölge çizmez, minik ve küçük parçalar ayrı katmana geçer; yeni karakterler sıkıştırılır.
// layerMask: uzaklaştıkça kamera minik ve küçük parça katmanlarını çizmez.
// itemTick: ürünlerin ve bostan fidelerinin parçaları (kımıldasalar da) malzeme başına tek BatchedMesh'te çizilir.
// bakeTick: birkaç saniye kımıldamayan parçalar (ev, raf, çit, ağaç, yol...) hücre hücre tek geometride birleşir. Birleşen
//   her parçanın aslı sık sık yoklanır; değişen olursa birleşim bozulur (dekor) ya da yeniden kurulur (karakter).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Birleşen parçanın aslı bu katmana geçer: sahnede durur, oyun kodu onu eskisi gibi taşır, gizler, siler; kamera çizmez.
const HIDE = 30;

// ---------- ortak ----------
function copyAttr(a) {
  if (a.isBufferAttribute && a.array instanceof Float32Array && !a.normalized) return new THREE.BufferAttribute(a.array.slice(0, a.count * a.itemSize), a.itemSize);
  const n = a.count, k = a.itemSize, out = new Float32Array(n * k);
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) out[i * k + j] = a.getComponent(i, j);
  return new THREE.BufferAttribute(out, k);
}
const noCompile = THREE.Material.prototype.onBeforeCompile, noHook = THREE.Object3D.prototype.onBeforeRender;
const MAPS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'lightMap', 'bumpMap', 'alphaMap', 'displacementMap'];
// düz renkli malzeme: rengi köşe rengine taşınabilir, farklı renkli parçalar tek çizimde birleşir
const plain = (m) => m.isMeshStandardMaterial && !m.map && !m.transparent && !m.vertexColors && !m.normalMap && !m.alphaMap
  && (m.emissive.getHex() === 0 || m.emissiveIntensity === 0) && m.onBeforeCompile === noCompile;
const VC = new Map();
function vcMat(m, coarse) { // coarse: karakterde iki pürüzlülük basamağı yeter (göz ve ayakkabı biraz daha mat görünür)
  const r = coarse ? (m.roughness < 0.4 ? 0.3 : 0.8) : Math.round(m.roughness * 5) / 5, key = `${r}|${m.metalness}|${+m.flatShading}|${m.side}`;
  let v = VC.get(key);
  if (!v) { VC.set(key, (v = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: m.metalness, flatShading: m.flatShading, side: m.side }))); OWN.add(v); }
  return v;
}
// Toplu çizim aslıyla aynı malzemeyi paylaşmaz: three bir malzemeyi hem BatchedMesh'te hem tek başına çizince her geçişte
// gölgelendiriciyi yeniden seçiyordu (getProgram: karede onlarca, saniyede ~7 MB çöp, çöp toplayıcı takılmaları). İkiz, aslının
// rengini, ışımasını, saydamlığını her karede izler (twinTick); aslı yeniden kurulursa (needsUpdate) baştan kopyalanır.
const OWN = new WeakSet(), TWIN = new Map(); // OWN: yalnız toplu çizimin kullandığı malzemeler (ikize gerek yok)
function twinCopy(t, m) {
  const ud = m.userData; m.userData = {}; // userData'daki nesneler JSON kopyasında takılmasın: ikiz aslınınkini paylaşır
  if (t) t.copy(m); else t = m.clone();
  m.userData = ud; t.userData = ud;
  t.onBeforeCompile = m.onBeforeCompile; t.customProgramCacheKey = m.customProgramCacheKey; t.ver = m.version;
  return t;
}
function twinOf(m) {
  if (OWN.has(m)) return m;
  let t = TWIN.get(m);
  if (!t) { TWIN.set(m, (t = twinCopy(null, m))); OWN.add(t); }
  return t;
}
function twinTick() {
  for (const [m, t] of TWIN) {
    if (m.version !== t.ver) { twinCopy(t, m); t.needsUpdate = true; continue; }
    if (t.color && !t.color.equals(m.color)) t.color.copy(m.color);
    if (t.emissive && !t.emissive.equals(m.emissive)) t.emissive.copy(m.emissive);
    t.emissiveIntensity = m.emissiveIntensity; t.opacity = m.opacity; t.transparent = m.transparent; t.depthWrite = m.depthWrite; t.visible = m.visible; t.map = m.map;
  }
}
// parçanın geometrisi kopyalanır ve matrisi uygulanır; vc: rengi köşe rengine yazılır. Döngüler tipli dizilerde elle yazıldı:
// three'nin applyMatrix4/setIndex yolları birleştirme işini üç kat yavaşlatıyordu.
const nrm = new THREE.Matrix3();
function partGeo(o, mtx, vc) {
  const g = o.geometry, at = g.attributes, m = o.material, n = at.position.count, geo = new THREE.BufferGeometry();
  const pa = copyAttr(at.position), na = copyAttr(at.normal), p = pa.array, q = na.array, e = mtx.elements, f = nrm.getNormalMatrix(mtx).elements;
  for (let i = 0; i < n * 3; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    p[i] = e[0] * x + e[4] * y + e[8] * z + e[12]; p[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; p[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    const a = q[i], b = q[i + 1], c = q[i + 2];
    const u = f[0] * a + f[3] * b + f[6] * c, v = f[1] * a + f[4] * b + f[7] * c, w = f[2] * a + f[5] * b + f[8] * c, l = Math.hypot(u, v, w) || 1;
    q[i] = u / l; q[i + 1] = v / l; q[i + 2] = w / l;
  }
  geo.setAttribute('position', pa);
  geo.setAttribute('normal', na);
  if (vc) {
    const col = new Float32Array(n * 3), c = m.color;
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  } else {
    if (at.uv && MAPS.some((k) => m[k])) geo.setAttribute('uv', copyAttr(at.uv)); // renk dokusu ya da ışıltı, pürüz... dokusu
    if (m.vertexColors) geo.setAttribute('color', copyAttr(at.color));
  }
  let idx;
  if (g.index) idx = new Uint32Array(g.index.array.subarray(0, g.index.count));
  else { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
  if (mtx.determinant() < 0) for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } // aynalı parça ters dönmesin
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}
const okGeo = (o) => !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.onBeforeRender === noHook
  && o.geometry.attributes.position && o.geometry.attributes.normal && !o.geometry.morphAttributes.position;
// renk yoklaması: getHex her çağrıda renk uzayı dönüşümü (üs alma) yapıyordu, karede binlerce parça için 0,3-0,4 ms. Ham bileşenlerden
// tek sayı yeter (rengin değiştiğini anlamak için; geri çevrilmez)
const ck = (m) => (m.color ? m.color.r + m.color.g * 7.31 + m.color.b * 53.7 : 0);
const sameMtx = (a, b) => { for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-5) return false; return true; };
// aslın o anki hali: yoklamada bununla karşılaştırılır
const rec = (o, mtx) => ({ o, mtx: mtx.slice(), mat: o.material, geo: o.geometry, col: ck(o.material), mask: o.layers.mask });
const drifted = (s, mtx) => s.o.material !== s.mat || s.o.geometry !== s.geo || ck(s.o.material) !== s.col || !sameMtx(mtx, s.mtx);
// Gizlenen asıl donar: matrisi her karede yeniden hesaplanmaz (sahnenin yarısı asıl, çizimin 5 ms'si matris güncellemesiydi).
// Yoklamada şimdiki matrisi elle kurulur (nowMtx); oyun kodu onu taşırsa yine yakalanır, geri gelince donması çözülür.
function hide(s) {
  const o = s.o;
  o.userData.bk = true; o.layers.set(HIDE);
  if (!o.children.length && o.matrixAutoUpdate && o.matrixWorldAutoUpdate) { s.fz = true; o.matrixAutoUpdate = o.matrixWorldAutoUpdate = false; }
}
function restore(s) {
  const o = s.o;
  o.layers.mask = s.mask; delete o.userData.bk;
  if (!s.fz) return;
  s.fz = false; o.matrixAutoUpdate = o.matrixWorldAutoUpdate = true;
  o.updateMatrix(); if (o.parent) o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix);
}
const tmpM = new THREE.Matrix4();
function nowMtx(s, local) { // aslın şimdiki (yerel ya da dünya) matrisi; dünya için asıl sahneye bağlı olmalı
  const o = s.o;
  if (!s.fz) return local ? o.matrix.elements : o.matrixWorld.elements;
  o.updateMatrix();
  return local ? o.matrix.elements : tmpM.multiplyMatrices(o.parent.matrixWorld, o.matrix).elements;
}

// ---------- boy taraması ----------
// Gölge geçişindeki çizim çağrılarının yarısı göz, el, raftaki ürün, çakıl gibi parçalardandı. Katmanlar: 1 minik (r < 0.12),
// 2 küçük (r < 0.3); büyükler 0'da kalır. Boy art arda iki taramada aynı çıkınca karar verilir: açılırken büyüyen (popIn)
// nesne küçükken yakalanıp gölgesiz kalmaz. Bir kez karar verilen parçaya bir daha bakılmaz.
// Tarama, anlık görüntü ve yoklama kareler arasına yayılır, kaldığı yerden sürer: sahne 14 bin nesneyi geçince tek karede
// gezmek telefonda 20-40 ms'lik takılma yapıyordu. Süre sınırı cihazın kendi saatiyle ölçülür, yavaş telefonda da aşılmaz.
const BUDGET = 1.5; // ms, iş başına kare payı
const DEPTH = {}, depthOf = (o) => DEPTH[o.type] || (DEPTH[o.type] = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
const SHADOW_MIN = 0.24, TINY = 0.12, SMALL = 0.3;
export const LAYER_TINY = 1, LAYER_SMALL = 2;
const timing = { sweep: 0, bake: 0, snap: 0, group: 0, jobs: 0, check: 0, items: 0 }; // test kancası: en uzun süren çağrı (ms)
const sweepStack = [];
// main.js 2 sn'de bir çağırır: önceki tur bitmişse yeni tur başlar; tur bakeTick'te kare kare sürer
export function sweepSizes(root) { stage = root; if (!sweepStack.length) sweepStack.push(root); sweepMore(); }
function sweepMore() {
  if (!sweepStack.length) return;
  const t0 = performance.now();
  for (let n = 1; sweepStack.length; n++) {
    if ((n & 15) === 0 && performance.now() - t0 > BUDGET) break;
    const o = sweepStack.pop(), u = o.userData;
    if ((u.type !== undefined || u.fruit) && !o.isMesh && !items.has(o)) items.set(o, { g: o, parts: null }); // ürün (makeItem) ve bostan fidesi: toplu çizime (itemTick)
    if (mover(u) && !u.cc && !o.isMesh && o.parent) { // karakter sıkıştırma pahalı: süre yarılandıysa sonraki kareye kalır
      if (n > 1 && performance.now() - t0 > BUDGET / 2) { sweepStack.push(o); break; }
      compactChar(o); n = 15;
    }
    for (let i = 0; i < o.children.length; i++) sweepStack.push(o.children[i]);
    // saydam çift yüzlü malzemeyi three iki geçişte çizip her çizimde iki kez needsUpdate yapıyordu (cam, su): tek geçiş yeter
    if (o.isMesh && o.material && o.material.transparent && o.material.side === THREE.DoubleSide) o.material.forceSinglePass = true;
    // gölge geçişinde three bütün nesnelere tek derinlik malzemesi verir; örnekli, toplu ve iskeletli nesneler arasında her geçişte
    // gölgelendiricisini yeniden seçiyordu (karede onlarca getProgram). Her türün kendi derinlik malzemesi var
    if ((o.isInstancedMesh || o.isBatchedMesh || o.isSkinnedMesh) && !o.customDepthMaterial) o.customDepthMaterial = depthOf(o);
    if (!o.isMesh || o.isInstancedMesh || u.sd === true || u.bk || u.inst) continue; // birleşmiş ya da örneklenmiş parçanın aslı gizli katmanda, ona dokunulmaz
    const g = o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const r = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis();
    if (u.sd === undefined || Math.abs(u.sd - r) > 1e-4) { u.sd = r; continue; }
    u.sd = true;
    if (r < SHADOW_MIN) o.castShadow = false;
    if (r < TINY) o.layers.set(LAYER_TINY); else if (r < SMALL) o.layers.set(LAYER_SMALL);
  }
  timing.sweep = Math.max(timing.sweep, performance.now() - t0);
}
// yakınlığa göre çizilen katmanlar: ekranda birkaç pikselden küçük kalacak parçalar için çizim çağrısı harcanmaz
export function layerMask(zoom) {
  return 1 | (zoom < 2.0 ? 1 << LAYER_TINY : 0) | (zoom < 3.0 ? 1 << LAYER_SMALL : 0);
}

// ---------- karakterler ----------
// Bir karakter 15-17 parçadan çizilir. Hareket eden düğümler (kalça, omuz, kafa grubu, gövde) yerinde kalır; her düğümün altındaki sabit
// parçalar (pantolon+ayakkabı, kol+el, kafa+göz+yanak+şapka, kemer) köşe renkli tek geometride birleşir. Bütün karakterlerin bu
// geometrileri malzeme başına tek bir BatchedMesh'te durur: her düğüm bir örnek, matrisi her çizimden önce düğümün dünya matrisinden
// yazılır. Sahnedeki bütün kalabalık 1-2 çizimdir (2026-11-02: kişi başı 8 çizimdi, köyde ekranın 860 çizimi karakterdi). Kıyafet,
// renk, görünürlük ya da düğümün parçaları değişince (plaj kıyafeti, rakip satıcının gömleği, oyuncunun şapkası) düğüm yeniden
// kurulur. Aynı görünüşlü düğümler geometriyi paylaşır; kullanan örnek sayısı tutulur, yer bitince kimsenin kullanmadığı geometriler
// silinip kalanlar başa toplanır (BatchedMesh.optimize), tampon ancak yine sığmazsa büyür, çok boşalmışsa küçülür.
// (2026-11-03 kullanıcı: "telefonda bir süre oynayınca ürünler, raflar, binalar siyaha dönüyor": görünüş çeşidi sınırlı sanılmıştı ama
// kıyafet rengi ve parça duruşu anahtara girdiği için geometriler hiç silinmeden birikiyordu. 12 dakikalık oyunda kalabalığın tamponu
// 2 milyon köşeye çıkmıştı, yalnız %37'si kullanılıyordu; her yeni dokulu malzeme de 1,2 MB'lık ayrı bir toplu çizim açıp boşalınca
// bile duruyordu: 130 toplu çizim, 200 MB. Telefonun ekran kartı belleği dolunca dokular yüklenemiyor, dokulu parçalar siyah çiziliyordu.)
const chars = [], batches = new Map(); // malzeme|gölge → { bm, geos: anahtar → geometri no, keys: no → anahtar, refs: no → örnek sayısı, v, i: ayrılan köşe ve indis }
let stage = null, syncF = -1;
// n: başlangıçtaki örnek yeri (karakterlerin köşe renkli malzemesinde 512, dokulu parçalarında 16, ürün türlerinde 64); dolunca iki katına çıkar.
// 20 sn boş kalan toplu çizim silinir (pruneBatches): her araç ve tezgâh kendi dokulu malzemesini getirebiliyor
function batchOf(m, cast = true, n = 512, name = 'karakterler') {
  const k = cast ? m.uuid : `${m.uuid}|0`;
  let b = batches.get(k);
  if (!b) {
    const bm = new THREE.BatchedMesh(n, n * 64, n * 128, twinOf(m));
    bm.sortObjects = false; bm.frustumCulled = false; bm.castShadow = cast; bm.receiveShadow = true; bm.name = name;
    bm.userData.baked = true; bm.userData.sd = true; bm.userData.zfix = null; // boy taraması ve zemin düzeltmesi dokunmasın
    batches.set(k, (b = { bm, geos: new Map(), keys: new Map(), refs: new Map(), idle: 0, v: n * 64, i: n * 128, v0: n * 64, i0: n * 128 }));
  }
  if (stage && b.bm.parent !== stage) stage.add(b.bm);
  return b;
}
// hiçbir örneğin kullanmadığı geometriler silinir, kalanlar tamponun başına toplanır. deleteGeometry kullanılmaz: three r171'de silinmiş
// bir örnek yerinde aynı geometri no'su kalmışsa hata atıp sıkıştırmayı yarıda bırakıyor; kullanan örnek kalmadığı sayaçtan belli
function compact(b) {
  const bm = b.bm;
  let freed = false;
  for (const [id, n] of b.refs) {
    if (n > 0) continue;
    bm._geometryInfo[id].active = false; bm._availableGeometryIds.push(id);
    b.geos.delete(b.keys.get(id)); b.keys.delete(id); b.refs.delete(id); freed = true;
  }
  bm._visibilityChanged = true;
  if (!freed) return;
  if (b.refs.size) bm.optimize();
  else { bm._nextVertexStart = 0; bm._nextIndexStart = 0; } // hepsi silindiyse optimize tamponu başa almıyor (three r171)
}
function geoOf(b, key, make) {
  let id = b.geos.get(key);
  if (id !== undefined) return id;
  const geo = make(), bm = b.bm, nv = geo.attributes.position.count, ni = geo.index.count;
  if (bm.unusedVertexCount < nv || bm.unusedIndexCount < ni) {
    compact(b);
    // yeni boy: dolu kısmın (eklenecekle birlikte) en az iki katı, başlangıç boyunun iki katlarından biri. Sığıyorsa ve boy aynıysa dokunulmaz
    const uv = b.v - bm.unusedVertexCount + nv, ui = b.i - bm.unusedIndexCount + ni;
    let v = b.v0, i = b.i0;
    while (v < uv * 2) v *= 2;
    while (i < ui * 2) i *= 2;
    if (v !== b.v || i !== b.i) { b.v = v; b.i = i; bm.setGeometrySize(v, i); }
  }
  id = bm.addGeometry(geo); geo.dispose(); b.geos.set(key, id); b.keys.set(id, key); b.refs.set(id, 0);
  return id;
}
function addInst(b, gid) {
  const bm = b.bm;
  if (bm.instanceCount >= bm.maxInstanceCount) bm.setInstanceCount(bm.maxInstanceCount * 2);
  const id = bm.addInstance(gid);
  bm.setVisibleAt(id, false); // ilk çizimden önce matrisiyle açılır (syncChars)
  b.refs.set(gid, b.refs.get(gid) + 1);
  return id;
}
function dropInst(b, id, gid) { b.bm.deleteInstance(id); b.refs.set(gid, b.refs.get(gid) - 1); }
let pruneT = 0;
function pruneBatches(dt) {
  if ((pruneT -= dt) > 0) return;
  pruneT = 1;
  for (const [k, b] of batches) {
    if (b.bm.instanceCount > 0) { b.idle = 0; continue; }
    if (++b.idle < 20) continue;
    b.bm.removeFromParent(); b.bm.dispose(); batches.delete(k);
  }
}
// Kolların gölgesi (main.js applyQuality): toplu çizimde kollar gövdeyle tek gölge çiziminde, ayrıca kapatmaya gerek kalmadı
export function setArmShadows() {}
function kidsSig(node) { let s = `${node.children.length}`; for (const c of node.children) s += c.visible ? '1' : '0'; return s; }
const I16 = new THREE.Matrix4().elements;
// self: düğüm kendisi de parça (gövde: kendi geometrisi, kendi matrisiyle; nefes alırken ölçeklenir, salınır)
function compactNode(node, skip, self) {
  const parts = node.children.filter((c) => c.isMesh && c.visible && !c.children.length && !skip.has(c) && !c.userData.baked && !c.userData.bkNo && okInst(c));
  if (self && okInst(node)) parts.unshift(node);
  const byMat = new Map(); // düz renkliler köşe renkli malzemede, dokulu ya da köşe renkliler kendi malzemelerinde
  for (const c of parts) { if (c !== node) c.updateMatrix(); const m = plain(c.material) ? vcMat(c.material, true) : c.material; if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(c); }
  const insts = [], done = [];
  for (const [m, list] of byMat) {
    const vc = m !== list[0].material, mtx = (c) => (c === node ? I16 : c.matrix.elements);
    const key = list.map((c) => `${c.geometry.uuid}:${vc ? c.material.color.getHexString() : ''}:${mtx(c).map((v) => v.toFixed(3)).join(',')}`).join(';');
    try { // aynı malzemede köşe bilgisi farklı geometriler (toplu çizim kabul etmez): bu parçalar kendi başına çizilir
      const b = batchOf(m, true, vc ? 512 : 16);
      const gid = geoOf(b, key, () => {
        const geos = list.map((c) => partGeo(c, c === node ? new THREE.Matrix4() : c.matrix, vc));
        const geo = mergeGeometries(geos, false); for (const g of geos) g.dispose();
        return geo;
      });
      insts.push({ b, g: gid, id: addInst(b, gid), on: false });
      done.push(...list);
    } catch (err) { /* atlanır */ }
  }
  const src = done.map((c) => {
    if (c !== node) { const s = rec(c, c.matrix.elements); hide(s); return s; }
    const s = rec(c, I16); s.self = true; s.mask = c.layers.mask; c.userData.bk = true; c.layers.set(HIDE); return s; // kımıldar: dondurulmaz
  });
  return { node, insts, src, sig: kidsSig(node), self };
}
function releaseNode(n) { for (const s of n.src) restore(s); for (const it of n.insts) dropInst(it.b, it.id, it.g); }
// toplu çizilen kımıldayan gruplar: kişiler, hayvanlar, eşek arabaları, araçlar
const mover = (u) => (u.legs && (u.head || u.walk !== undefined)) || u.wheels;
// karakterin içinde kendi başına kurulan (taşınan ürün, fide) ya da başka bir karakter (binen kişi) olan dal atlanır
const ownBranch = (o, g) => o === g || !(o.userData.type !== undefined || o.userData.fruit || ((mover(o.userData)) && o.userData !== g.userData));
// düğümler: karakterin altında doğrudan parça taşıyan her grup (kalça, omuz, kafa, şapka, sepet, gövde, teker göbeği...) ve kımıldayan
// parçalar (gövde gibi kendisi çizilen). Her biri toplu çizimde bir örnek, matrisi her çizimden önce yazılır
function charNodes(g, skip) {
  const out = [];
  const walk = (o) => {
    if (!ownBranch(o, g)) return;
    if (o.isMesh) { if (skip.has(o)) out.push({ n: o, self: true }); }
    else if (o.children.some((c) => c.isMesh && !c.children.length && !skip.has(c))) out.push({ n: o, self: false });
    for (const c of o.children) walk(c);
  };
  walk(g);
  return out;
}
// yapı imzası: bir gruba yeni dal eklenince ya da çıkınca (sepet alındı, şapka değişti) karakter baştan kurulur. Taşınan ürün sayılmaz
function structSig(g) {
  let h = 0;
  const walk = (o) => { let n = 0; for (const c of o.children) if (ownBranch(c, g)) { n++; walk(c); } h = (h * 31 + n + (o.isMesh ? 7 : 0)) | 0; };
  walk(g);
  return h;
}
const list_ = (a) => (Array.isArray(a) ? a : a ? [a] : []);
function compactChar(g) {
  const u = g.userData;
  const skip = new Set([...list_(u.legs), ...list_(u.arms), u.head, u.body].filter((o) => o && o.isMesh)); // kendisi kımıldayan parçalar
  u.cc = true;
  chars.push({ root: g, skip, sig: structSig(g), nodes: charNodes(g, skip).map(({ n, self }) => compactNode(n, skip, self)) });
}
function attached(o, scene) { for (let a = o; a; a = a.parent) if (a === scene) return true; return false; }
const changed = (s) => s.o.material !== s.mat || s.o.geometry !== s.geo || ck(s.o.material) !== s.col;
function checkChar(i, scene) { // sahneden çıktıysa listeden düşer (true döner): geri dönerse yeniden sıkıştırılır
  const ch = chars[i];
  if (!attached(ch.root, scene)) { for (const n of ch.nodes) releaseNode(n); delete ch.root.userData.cc; chars.splice(i, 1); return true; }
  const sig = structSig(ch.root);
  if (sig !== ch.sig) { // baştan: geometriler önbellekte, hızlı
    for (const n of ch.nodes) releaseNode(n);
    ch.sig = sig; ch.nodes = charNodes(ch.root, ch.skip).map(({ n, self }) => compactNode(n, ch.skip, self));
    return false;
  }
  for (let k = 0; k < ch.nodes.length; k++) {
    const n = ch.nodes[k];
    let bad = n.sig !== kidsSig(n.node);
    for (const s of n.src) {
      if (s.self ? changed(s) : s.o.parent !== n.node || changed(s)) bad = true;
      else if (!s.self && !sameMtx(nowMtx(s, true), s.mtx)) { bad = true; s.o.userData.bkNo = true; } // kendi kımıldayan parça (dönen teker): bundan sonra kendi başına çizilir
    }
    if (!bad) continue;
    releaseNode(n);
    ch.nodes[k] = compactNode(n.node, ch.skip, n.self);
  }
  return false;
}
// her çizimden önce (sahnenin matrisleri güncellendikten sonra: scene.onBeforeRender) düğümlerin dünya matrisleri örneklere yazılır.
// Gizli ya da sahnede olmayan karakterin örnekleri kapanır
function within(o, root) { for (let a = o; a; a = a.parent) { if (a === root) return true; if (!a.visible) return false; } return false; } // gruptan çıkan parça da kapanır
function syncChars(renderer) {
  if (renderer.info.render.frame === syncF) return;
  syncF = renderer.info.render.frame;
  syncItems();
  for (const ch of chars) {
    const on = shown(ch.root, stage);
    for (const n of ch.nodes) {
      const vis = on && within(n.node, ch.root);
      for (const it of n.insts) {
        if (vis) it.b.bm.setMatrixAt(it.id, n.node.matrixWorld);
        if (it.on !== vis) { it.on = vis; it.b.bm.setVisibleAt(it.id, vis); }
      }
    }
  }
}

// ---------- ürünler ----------
// Ürünlerin (makeItem: rafta, tepside, elde, uçarken) ve bostan fidelerinin (userData.fruit; meyvesi kendi başına bir üründür)
// parçaları da toplu çizilir: düz renkli parçalar köşe renkli malzemenin, öbürleri kendi malzemelerinin BatchedMesh'inde. Ürün
// kımıldasa da örnek kalır: matrisi her çizimden önce parçanın dünya matrisinden yazılır (yalnız değiştiyse). Parçası gizlenince
// örneği kapanır; malzemesi, rengi ya da geometrisi değişirse ürün yeniden kurulur; sahneden çıkınca örnekleri silinir.
// (2026-11-02: önce yalnız yarım saniye kımıldamayan ürünler tür tür InstancedMesh'le çiziliyordu; ekranda 120 tür çizimi, elde ve
// uçan ürünler de tek tek: 70-240 çizim daha. Fideler hasatta zıpladığı için birleşimde hep bozuluyordu.)
const items = new Map(); // ürün grubu → { g, parts: [{ o, b, id, mat, geo, col, mask, on, m }] | null }
// toplanabilir parça: düz renkli, dokulu (dokular parçanın ilk uv'sini kullanır) ya da köşe renkli malzeme; köşe gölgelendiricisine
// dokunan özel malzeme olmaz
const okInst = (o) => {
  const m = o.material, g = o.geometry;
  if (Array.isArray(m) || o.isSkinnedMesh || o.isInstancedMesh || o.isBatchedMesh || o.onBeforeRender !== noHook || g.morphAttributes.position || !g.attributes.normal) return false;
  if (!m.isMeshStandardMaterial || m.transparent || (m.vertexColors && !g.attributes.color)) return false;
  if (MAPS.some((k) => m[k] && (!g.attributes.uv || m[k].channel !== 0))) return false;
  return m.onBeforeCompile === noCompile || !/vertexShader/.test(String(m.onBeforeCompile));
};
const IDM = new THREE.Matrix4();
function buildItem(e) {
  const parts = [];
  const walk = (o) => {
    if (o !== e.g && o.userData.type !== undefined) return; // fidedeki meyve (ürün) ayrı kurulur
    if (o.isMesh && o.visible && !o.userData.bk && okInst(o)) parts.push(o);
    for (const c of o.children) walk(c);
  };
  walk(e.g);
  e.parts = [];
  for (const o of parts) {
    const m = o.material, vc = plain(m);
    let b, g, id;
    try { // aynı malzemede köşe bilgisi farklı bir geometri gelirse (toplu çizim kabul etmez) parça eskisi gibi kendi başına çizilir
      b = batchOf(vc ? vcMat(m, true) : m, o.castShadow, 64, 'urunler');
      g = geoOf(b, vc ? `${o.geometry.uuid}:${m.color.getHexString()}` : o.geometry.uuid, () => partGeo(o, IDM, vc));
      id = addInst(b, g);
    } catch (err) { continue; }
    e.parts.push({ o, b, g, id, mat: m, geo: o.geometry, col: ck(m), mask: o.layers.mask, on: false, m: new Float32Array(16) });
    o.layers.set(HIDE); o.userData.inst = true;
  }
}
function releaseItem(e) {
  if (!e.parts) return;
  for (const r of e.parts) { r.o.layers.mask = r.mask; delete r.o.userData.inst; dropInst(r.b, r.id, r.g); }
  e.parts = null;
}
const badPart = (r) => r.o.material !== r.mat || r.o.geometry !== r.geo || ck(r.mat) !== r.col;
// her karede: sahneden çıkan ürün düşer, değişen yeniden kurulur, yeni ürünler kare payı içinde kurulur
function itemTick(dt, scene) {
  const t0 = performance.now();
  for (const [g, e] of items) {
    if (!attached(g, scene)) { releaseItem(e); items.delete(g); continue; }
    if (e.parts && e.parts.some(badPart)) releaseItem(e);
    if (!e.parts && performance.now() - t0 < BUDGET) buildItem(e);
  }
}
function syncItems() {
  for (const e of items.values()) {
    if (!e.parts) continue;
    const on = shown(e.g, stage);
    for (const r of e.parts) {
      const vis = on && within(r.o, e.g);
      if (vis) {
        const w = r.o.matrixWorld.elements, m = r.m;
        let same = true;
        for (let i = 0; i < 16; i++) if (w[i] !== m[i]) { same = false; break; }
        if (!same) { m.set(w); r.b.bm.setMatrixAt(r.id, r.o.matrixWorld); }
      }
      if (r.on !== vis) { r.on = vis; r.b.bm.setVisibleAt(r.id, vis); }
    }
  }
}

// ---------- mevsim boyası ----------
// Doğa süsünün (kök 'decor': ağaç, çalı, çiçek, kaya) birleşik köşe renkleri mevsime göre boyanır (mevsim.js): sonbaharda
// yeşiller turuncuya döner, kışın yukarı bakan yüzler karlanır. Asılların malzemesine dokunulmaz, birleşim bozulmaz.
// Malzemesi bilerek boyanan parçalar (çim zemin) için recolored: kayıtlı renk güncellenir, birleşim "değişti" sanmaz.
let tintFn = null;
const tc = new THREE.Color();
function applyTint(b) {
  const g = b.mesh.geometry, col = g.attributes.color, nor = g.attributes.normal;
  for (const r of b.tint) for (let i = r.start, e = r.start + r.count; i < e; i++) {
    tc.copy(r.col); if (tintFn) tintFn(tc, nor.getY(i), r.k);
    col.setXYZ(i, tc.r, tc.g, tc.b);
  }
  col.needsUpdate = true;
}
export function setSeasonTint(fn) { tintFn = fn; for (const b of bins) if (b.tint) applyTint(b); }
export function recolored(mat) {
  const h = ck(mat), fix = (s) => { if (s.mat === mat) s.col = h; };
  for (const b of bins) b.src.forEach(fix);
  for (const ch of chars) for (const n of ch.nodes) n.src.forEach(fix);
  if (watch) for (const it of watch.list) fix(it.s);
  if (snap) for (const it of snap.list) fix(it.s);
  if (grp) grp.items.forEach(fix);
  for (const [, list] of queue) list.forEach(fix);
  for (const j of jobs) for (const it of j.list) fix(it.s);
}

// ---------- statik birleştirme ----------
// Sahnenin kök gruplarındaki parçalar izlenir: 6 sn boyunca yeri, malzemesi, rengi, görünürlüğü değişmeyenler 24 m'lik karelerde
// birleşir (kareler ayrı kaldığı için ekran dışındakiler yine çizilmez). Düz renkli parçalar köşe renkli tek malzemede, dokulu
// parçalar kendi malzemeleriyle toplanır. Bir aslı değişen karenin birleşimi bozulur, asıllar geri gelir ve o parça bir daha
// birleştirilmez. Karakter ve hayvanlar, ürünler, saydam ve çok büyük parçalar (zemin, deniz) aday olmaz. Turlar açılışta sık
// (açılış animasyonu sürerken kımıldayanlar sonraki tura kalır): 4, 10, 20, 30 sn arayla, sonra 40 sn'de bir.
const CELL = 24, MAX_R = 12, WATCH = 6, MIN_BIN = 3;
const living = (o) => { const u = o.userData; return u.legs || u.arms || u.walk !== undefined || u.type !== undefined || u.fruit || u.wheels; }; // ürünler (makeItem) sık el değiştirir; ürün, fide, karakter ve araçlar toplu çizilir
function shown(o, scene) { // sahneye bağlı ve bütün ataları görünür mü
  for (let a = o; a; a = a.parent) { if (!a.visible) return false; if (a === scene) return true; }
  return false;
}
function candidate(o) {
  const m = o.material, u = o.userData;
  if (u.bk || u.bkNo || u.baked || !okGeo(o) || m.transparent || (m.map && !o.geometry.attributes.uv) || (m.vertexColors && !o.geometry.attributes.color)) return false;
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  return o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() <= MAX_R;
}
const bins = []; // { mesh, src: [rec] }
const queue = [], jobs = []; // queue: gruplanacak kökler, jobs: birleştirilecek kareler (ikisi de kare kare sürer)
let snap = null, watch = null, roundT = 4, rounds = 0, binAt = 0, srcAt = 0, charAt = 0;
// anlık görüntü kök kök, kare kare alınır. Her kökün matrisi o kök başlarken güncellenir: bu karede eklenenler (ve __step'te
// hiç çizilmeyenler) kimlik matrisiyle kaydedilmesin. Bütün sahneyi güncellemek (scene.updateMatrixWorld) tek başına 4 ms sürüyordu.
function snapMore(scene) {
  const t0 = performance.now(), st = snap.stack;
  for (let n = 1; ; n++) {
    if (!st.length) {
      const r = snap.roots.pop();
      if (!r) return true;
      if (r.parent !== scene || !r.visible || living(r)) continue;
      r.updateMatrixWorld(); snap.root = r;
      for (let i = 0; i < r.children.length; i++) st.push(r.children[i]);
      continue;
    }
    if ((n & 15) === 0 && performance.now() - t0 > BUDGET) return false;
    const o = st.pop();
    if (!o.visible || living(o)) continue;
    if (o.isMesh && candidate(o)) snap.list.push({ root: snap.root, s: rec(o, o.matrixWorld.elements) });
    for (let i = 0; i < o.children.length; i++) st.push(o.children[i]);
  }
}
// kök kare kare gruplanır (büyük köyde bin aday 3 ms sürüyordu); 6 sn'de kımıldayan, gizlenen, başka birleşime giren aday olmaz
let grp = null;
function groupMore(scene) {
  if (!grp) {
    const [root, items] = queue.shift();
    if (root.parent !== scene) return;
    root.updateMatrixWorld();
    grp = { root, items, i: 0, inv: root.matrixWorld.clone().invert(), groups: new Map() };
  }
  const t0 = performance.now(), { root, items, inv, groups } = grp;
  for (; grp.i < items.length; grp.i++) {
    if ((grp.i & 15) === 15 && performance.now() - t0 > BUDGET) return;
    const s = items[grp.i], o = s.o;
    if (o.userData.bk || drifted(s, o.matrixWorld.elements) || !shown(o, scene)) continue;
    const g = o.geometry, vc = plain(o.material), m = vc ? vcMat(o.material) : o.material;
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const r = g.boundingSphere.radius * mtx.getMaxScaleOnAxis(), c = g.boundingSphere.center.clone().applyMatrix4(mtx);
    const layer = r < TINY ? LAYER_TINY : r < SMALL ? LAYER_SMALL : 0, cast = o.castShadow && r >= SHADOW_MIN;
    const key = `${Math.floor(c.x / CELL)}|${Math.floor(c.z / CELL)}|${m.uuid}|${+cast}${+o.receiveShadow}|${layer}|${!vc && m.vertexColors ? g.attributes.color.itemSize : 0}`;
    let b = groups.get(key);
    if (!b) groups.set(key, (b = { m, vc, cast, recv: o.receiveShadow, layer, list: [] }));
    b.list.push({ s, mtx });
  }
  // büyük kareler 8 bin köşelik parçalara bölünür
  for (const b of groups.values()) {
    if (b.list.length < MIN_BIN) continue;
    let part = [], verts = 0;
    for (const it of b.list) {
      part.push(it); verts += it.s.o.geometry.attributes.position.count;
      if (verts >= 8000) { jobs.push({ ...b, root, list: part }); part = []; verts = 0; }
    }
    if (part.length >= MIN_BIN) jobs.push({ ...b, root, list: part });
  }
  grp = null;
}
// parçaların geometrisi kare kare kopyalanır, kare payının yarısı kaldıysa birleşir (yoksa sonraki karede); bitince true döner
function bake(b, t0) {
  if (!b.geos) { if (b.list.some(({ s }) => s.o.userData.bk)) return true; b.geos = []; } // bu arada başka birleşime girmiş
  while (b.geos.length < b.list.length) {
    if (b.geos.length && performance.now() - t0 > BUDGET) return false;
    const { s, mtx } = b.list[b.geos.length];
    b.geos.push(partGeo(s.o, mtx, b.vc));
  }
  if (performance.now() - t0 > BUDGET / 2 && !b.late) { b.late = true; return false; }
  const geos = b.geos, geo = b.list.some(({ s }) => s.o.userData.bk) ? null : mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!geo) return true;
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, b.m);
  mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.layers.set(b.layer);
  mesh.userData.baked = true; mesh.userData.sd = true;
  b.root.add(mesh);
  const src = b.list.map(({ s }) => { s.mask = s.o.layers.mask; hide(s); return s; });
  const bin = { mesh, src };
  if (b.vc && b.root.name === 'decor') { // doğa süsü: mevsim boyası için her parçanın köşe aralığı ve aslının rengi
    let at = 0;
    bin.tint = b.list.map(({ s }, k) => { const n = s.o.geometry.attributes.position.count, r = { start: at, count: n, col: s.o.material.color.clone(), k }; at += n; return r; });
    if (tintFn) applyTint(bin);
  }
  bins.push(bin);
  return true;
}
function unbake(i, bad) {
  const b = bins[i];
  for (const s of b.src) restore(s);
  bad.userData.bkNo = true;
  b.mesh.removeFromParent(); b.mesh.geometry.dispose();
  bins.splice(i, 1);
}
const lap = (k, t) => { const n = performance.now(); timing[k] = Math.max(timing[k], n - t); return n; };
// her karede (main.js tick): tur başında adaylar alınır, 6 sn sonra değişmeyenler birleşir. İş kareler arasına yayılır,
// oyun takılmaz. Asıllar sırayla yoklanır: her birleşim ve karakter çeyrek saniyede bir, kare başına eşit pay.
export function bakeTick(dt, scene) {
  const t0 = performance.now();
  stage = scene;
  twinTick();
  if (!scene.userData.syncChars) { // sahnenin varsa önceki kancası korunur, senkron onun ardından çalışır
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (r, s, c, t) { prev.call(this, r, s, c, t); syncChars(r); };
    scene.userData.syncChars = true;
  }
  sweepMore();
  let t = performance.now();
  if (grp || queue.length) { groupMore(scene); t = lap('group', t); }
  while (jobs.length && performance.now() - t < BUDGET) { const b = jobs[0]; if (b.root.parent === scene && !bake(b, t)) break; jobs.shift(); }
  t = lap('jobs', t);
  if (snap) { if (snapMore(scene)) { watch = { t: WATCH, list: snap.list }; snap = null; } t = lap('snap', t); }
  else if (watch) {
    if ((watch.t -= dt) <= 0) {
      const byRoot = new Map(); // kımıldayan var mı, kökü işlenirken bakılır (group)
      for (const { root, s } of watch.list) { if (!byRoot.has(root)) byRoot.set(root, []); byRoot.get(root).push(s); }
      queue.push(...byRoot);
      watch = null;
    }
  } else if ((roundT -= dt) <= 0) { roundT = Math.min(40, 10 * ++rounds); snap = { roots: scene.children.filter((r) => r.isGroup), root: null, stack: [], list: [] }; }
  // birleşimlerin asılları parça parça yoklanır (her asıl yine çeyrek saniyede bir): yüzlerce parçalı bir birleşim tek karede yoklanınca
  // telefonda kare takılıyordu (2026-11-05 ölçümü); yarım kalan birleşime sonraki karede kalınan yerden devam edilir
  let srcTot = 0;
  for (const b of bins) srcTot += b.src.length;
  for (let q = Math.ceil(srcTot * dt * 4); q > 0 && bins.length;) {
    if (binAt >= bins.length) { binAt = 0; srcAt = 0; }
    const src = bins[binAt].src, end = Math.min(src.length, srcAt + q);
    let bad = null;
    for (let i = srcAt; i < end && !bad; i++) { const s = src[i]; if (!shown(s.o, scene) || drifted(s, nowMtx(s))) bad = s; }
    q -= Math.max(1, end - srcAt);
    if (bad) { unbake(binAt, bad.o); srcAt = 0; } else if (end >= src.length) { binAt++; srcAt = 0; } else srcAt = end;
  }
  for (let n = Math.min(chars.length, Math.ceil(chars.length * dt * 4)); n > 0 && chars.length; n--) {
    if (performance.now() - t > BUDGET * 2) break; // kıyafet değiştiren kalabalık (plaj) birden yeniden kurulmasın
    if (charAt >= chars.length) charAt = 0;
    if (!checkChar(charAt, scene)) charAt++;
  }
  t = lap('check', t);
  itemTick(dt, scene);
  pruneBatches(dt);
  lap('items', t);
  timing.bake = Math.max(timing.bake, performance.now() - t0);
}
// test kancası (main.js window.__bake)
export function bakeStats() {
  const t = { ...timing }; for (const k in timing) timing[k] = 0;
  let inst = 0; for (const e of items.values()) if (e.parts) inst += e.parts.length;
  const B = [...batches.values()];
  return { bins: bins.length, parts: bins.reduce((a, b) => a + b.src.length, 0), chars: chars.length, batchGeos: B.reduce((a, b) => a + b.geos.size, 0), batchInst: B.reduce((a, b) => a + b.bm.instanceCount, 0), items: items.size, inst, batches: B.length, maxMs: t };
}
