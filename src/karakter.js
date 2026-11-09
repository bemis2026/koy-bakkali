// Poly Pizza karakter modeli (assets/characters/karakter.glb: Quaternius "Character Animated", CC0). Oyuncu, müşteri, eleman ve kalabalık
// bu iskeletli modelin kopyası. Gömlek, pantolon, ten ve saç oyunun renklerine boyanır. Şapka ve yüz süsleri (models.js makeCharacter)
// kafa kemiğine takılı gruplara eklenir. Bekleme/yürüme/koşma modelin kendi klipleri; eski çağıranların döndürdüğü userData.legs/arms/head
// kuklaları her çizimde ilgili kemiğe ek dönüş olarak işlenir (oturma, el sallama, taşıma, bakınma). Karakter iki çizimdir: gömlek (dışarıdan
// malzemesi değişebilir) ve geri kalan her şey (köşe renkli tek parça).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { track, seen, thawed, busy, perfMode } from './donuk.js';

const H = 1.95; // saçın tepesine kadar boy: eski karakterin kafası ve saçı
const HIP = 0.62; // eski karakterin kalça yüksekliği (oturan karakter bu yüksekliğe iner)
let T = null;
export const hasChar = () => !!T;

// 2026-11-01 kullanıcı: karakterler kodla çizilen eski haline dönsün. Model ve kod yerinde; vitrin yükler (all)
export async function loadChars(base = 'assets/characters/', all = false) {
  if (!all) return;
  try { T = prep(await new GLTFLoader().loadAsync(`${base}karakter.glb`)); } catch (e) { console.warn('karakter modeli yüklenemedi:', e); }
}

// her parça dinlenme duruşundaki (kemiklerle bükülmüş) haliyle sahne uzayına alınır, sonra bu duruşa yeniden bağlanır. Kafadaki saç ve
// gözler kafa kemiğine tam ağırlıkla bağlanır. Ayaklar (modelde ters kinematik hedefi, kökün çocuğu) baldıra taşınır: oturan karakterin
// bacağı öne uzanınca ayak da gelir. Kliplerdeki ayak izleri atılır; adım açıları zaten bacak kemiklerinde
function prep(gltf) {
  const sc = gltf.scene;
  sc.updateMatrixWorld(true);
  const meshes = [];
  sc.traverse((m) => { if (m.isMesh) meshes.push(m); });
  const bones = meshes.find((m) => m.isSkinnedMesh).skeleton.bones, bone = (n) => bones.find((b) => b.name === n);
  const headI = bones.indexOf(bone('Head'));
  const parts = {};
  const W = new THREE.Matrix4(), B = new THREE.Matrix4(), v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const m of meshes) {
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, c = P.count;
    const pos = new Float32Array(c * 3), nor = new Float32Array(c * 3), si = new Uint16Array(c * 4), sw = new Float32Array(c * 4);
    for (let i = 0; i < c; i++) {
      if (m.isSkinnedMesh) {
        W.elements.fill(0);
        for (let k = 0; k < 4; k++) {
          const w = g.attributes.skinWeight.getComponent(i, k);
          if (!w) continue;
          const b = m.skeleton.bones[g.attributes.skinIndex.getComponent(i, k)];
          B.multiplyMatrices(b.matrixWorld, m.skeleton.boneInverses[m.skeleton.bones.indexOf(b)]);
          for (let e = 0; e < 16; e++) W.elements[e] += B.elements[e] * w;
          si[i * 4 + k] = bones.indexOf(b); sw[i * 4 + k] = w;
        }
        W.multiply(m.bindMatrix);
      } else { W.copy(m.matrixWorld); si[i * 4] = headI; sw[i * 4] = 1; }
      v.fromBufferAttribute(P, i).applyMatrix4(W).toArray(pos, i * 3);
      n.fromBufferAttribute(N, i).applyMatrix3(nm.getNormalMatrix(W)).normalize().toArray(nor, i * 3);
    }
    parts[m.material.name] = { pos, nor, si, sw, idx: Array.from(g.index.array), col: m.material.color.clone() };
  }
  for (const s of ['L', 'R']) bone(`LowerLeg${s}`).attach(bone(`Foot${s}`));
  for (const m of meshes) m.removeFromParent();
  // kemik uçları (_end) ve boş gruplar atılır: her karakterde sahneye eklenen düğüm sayısı (her karede matris güncellemesi) azalır
  const keep = (o) => bones.includes(o) || o.children.some(keep), drop = [];
  sc.traverse((o) => { if (o !== sc && !keep(o)) drop.push(o); });
  for (const o of drop) o.removeFromParent();
  sc.updateMatrixWorld(true);
  const inv = bones.map((b) => b.matrixWorld.clone().invert());
  // ölçüler (model uzayında): boy, saç kutusu, gözler, omuz ve el, kalça
  const box = (k) => { const b = new THREE.Box3(), p = parts[k].pos; for (let i = 0; i < p.length; i += 3) b.expandByPoint(v.fromArray(p, i)); return b; };
  let top = 0;
  for (const k in parts) top = Math.max(top, box(k).max.y);
  const s = H / top, hair = box('Hair'), eye = box('Eye');
  const at = (p, q, k, b) => new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(new THREE.Matrix4().compose(p, q, new THREE.Vector3(k, k, k)));
  const head = bone('Head'), I = new THREE.Quaternion();
  // yüz grubu (userData.face): eski kafanın birimleriyle (gözler merkezden +0,04 yukarıda, yüz önü z 0,31) bıyık, gözlük, maske gözlerin
  // üstüne oturur. Bu modelde gözler kafanın alt yarısında: kafa ortasına göre yapılan şapka ve kask için ayrı grup
  const face = at(new THREE.Vector3(0, (eye.min.y + eye.max.y) / 2 - 0.04 / s, eye.max.z + 0.008 - 0.31 / s), I, 1 / s, head);
  // kafa ve şapka grubu (userData.head, hats): saç kutusunun ortası, eski şapka ve kaskın 0,325'lik kubbesi saçın en geniş yerini örter
  const hc = hair.getCenter(new THREE.Vector3()), hs = hair.getSize(new THREE.Vector3()), kh = (Math.max(hs.x, hs.z) / 2) * s / 0.325;
  const hat = at(hc, I, kh / s, head);
  // kollar: eski kol grubu omuzdan aşağı (-y) uzanır; burada omuzdan yumruğa doğru, uzunlukça eski birimde (raket, ele tutulan şey)
  const arm = (side) => {
    const sh = bone(`UpperArm${side}`), sp = sh.getWorldPosition(new THREE.Vector3()), hp = bone(`Fist${side}`).getWorldPosition(new THREE.Vector3());
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), hp.sub(sp).normalize());
    return { b: sh.name, mtx: at(sp, q, 1 / s, sh), low: `LowerArm${side}` };
  };
  const leg = (side) => ({ b: `UpperLeg${side}`, low: `LowerLeg${side}` });
  const right = bone('UpperArmR').getWorldPosition(v).x < 0 ? 'R' : 'L', left = right === 'R' ? 'L' : 'R'; // eski sıra: 0 sağ (-x), 1 sol
  const rest = {};
  for (const b of bones) rest[b.name] = b.quaternion.clone();
  const clip = (name) => {
    const c = gltf.animations.find((a) => a.name === name);
    return c && new THREE.AnimationClip(name, c.duration, c.tracks.filter((t) => !/^Foot[LR]\./.test(t.name)));
  };
  return {
    arm: sc, names: bones.map((b) => b.name), inv, s, rest,
    face, hat, arms: [arm(right), arm(left)], legs: [leg(right), leg(left)],
    dh: bone('UpperLegR').getWorldPosition(v).y * s - HIP,
    clips: { idle: clip('Idle'), walk: clip('Walk'), run: clip('Run') },
    shirt: build(parts, [['Shirt', 1], ['UnderShirt', 0.72]]),
    body: [false, true].map((bald) => build(parts, Object.keys(parts).filter((k) => k !== 'Shirt' && k !== 'UnderShirt' && !(bald && k === 'Hair')))),
    lo: build({ ...parts, Hair: thin(parts.Hair, 1100) }, Object.keys(parts).filter((k) => k !== 'Shirt' && k !== 'UnderShirt')),
    sphere: new THREE.Sphere(new THREE.Vector3(0, top * 0.5, 0), top * 0.8),
  };
}

// saç modelde eğriden üretilmiş: 4480 üçgen, vücudun geri kalanı 1600. Uzak görünüm için kenar çökertmeyle seyreltilir (karesel hata
// ölçüsü, QEM): aynı yerdeki köşeler birleşir, her köşenin hata matrisi komşu yüzlerin düzlemlerinden toplanır, şekli en az bozan kenar
// uçlarından birine ya da ortasına çökertilir; yüzü ters çevirecek çökertme yapılmaz, açık kenarlar (tel uçları) ağır cezalı. Telefonda
// karakter 60 piksel boyunda, fark görünmez; ekranda 100 pikselden uzun görünürse (yakın çekim) tam saç. Saçın hepsi kafa kemiğine bağlı
function thin(p, target) {
  const n0 = p.pos.length / 3, weld = new Map(), map = new Int32Array(n0), src = [], P = [];
  let ext = 0;
  for (let i = 0; i < p.pos.length; i++) ext = Math.max(ext, Math.abs(p.pos[i]));
  const q = 1e5 / ext;
  for (let i = 0; i < n0; i++) {
    const k = `${Math.round(p.pos[i * 3] * q)},${Math.round(p.pos[i * 3 + 1] * q)},${Math.round(p.pos[i * 3 + 2] * q)}`;
    let j = weld.get(k);
    if (j === undefined) { j = src.length; weld.set(k, j); src.push(i); P.push(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]); }
    map[i] = j;
  }
  const nv = src.length, F = [], Q = new Float64Array(nv * 10), vf = Array.from({ length: nv }, () => []), edges = new Map();
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3(), M = new THREE.Vector3();
  const addQ = (v, a, b, c, d, w) => {
    const o = v * 10;
    Q[o] += w * a * a; Q[o + 1] += w * a * b; Q[o + 2] += w * a * c; Q[o + 3] += w * a * d; Q[o + 4] += w * b * b;
    Q[o + 5] += w * b * c; Q[o + 6] += w * b * d; Q[o + 7] += w * c * c; Q[o + 8] += w * c * d; Q[o + 9] += w * d * d;
  };
  const norm = (a, b, c, out) => out.subVectors(B.fromArray(P, b * 3), A.fromArray(P, a * 3)).cross(C.fromArray(P, c * 3).sub(A));
  const ek = (a, b) => (a < b ? a * nv + b : b * nv + a);
  for (let t = 0; t < p.idx.length; t += 3) {
    const a = map[p.idx[t]], b = map[p.idx[t + 1]], c = map[p.idx[t + 2]];
    if (a === b || b === c || a === c) continue;
    const s = norm(a, b, c, N).length();
    if (!s) continue;
    N.divideScalar(s);
    const f = F.length / 3;
    F.push(a, b, c);
    for (const v of [a, b, c]) { addQ(v, N.x, N.y, N.z, -N.dot(A), s); vf[v].push(f); }
    for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = ek(x, y), e = edges.get(k); if (e) e.n++; else edges.set(k, { x, y, f, n: 1 }); }
  }
  for (const e of edges.values()) { // açık kenar: kenardan geçen, yüze dik düzlem
    if (e.n !== 1) continue;
    norm(F[e.f * 3], F[e.f * 3 + 1], F[e.f * 3 + 2], N).normalize();
    A.fromArray(P, e.x * 3); M.fromArray(P, e.y * 3).sub(A);
    const w = M.lengthSq() * 50;
    M.cross(N).normalize();
    addQ(e.x, M.x, M.y, M.z, -M.dot(A), w); addQ(e.y, M.x, M.y, M.z, -M.dot(A), w);
  }
  const err = (a, b, x, y, z) => {
    let s = 0;
    for (const v of [a, b]) {
      const o = v * 10;
      s += Q[o] * x * x + 2 * Q[o + 1] * x * y + 2 * Q[o + 2] * x * z + 2 * Q[o + 3] * x + Q[o + 4] * y * y + 2 * Q[o + 5] * y * z
        + 2 * Q[o + 6] * y + Q[o + 7] * z * z + 2 * Q[o + 8] * z + Q[o + 9];
    }
    return s;
  };
  const best = (a, b, out) => { // uçlardan biri ya da orta: en az hatalı nokta
    let c = Infinity;
    for (const t of [0, 1, 0.5]) {
      const x = P[a * 3] + (P[b * 3] - P[a * 3]) * t, y = P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t, z = P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t;
      const e = err(a, b, x, y, z);
      if (e < c) { c = e; if (out) out.set(x, y, z); }
    }
    return c;
  };
  const heap = [], stamp = new Int32Array(nv), alive = new Uint8Array(nv).fill(1);
  const push = (a, b) => {
    const h = [best(a, b), a, b, stamp[a], stamp[b]];
    let i = heap.push(h) - 1;
    while (i) { const pi = (i - 1) >> 1; if (heap[pi][0] <= h[0]) break; heap[i] = heap[pi]; i = pi; }
    heap[i] = h;
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i, mc = last[0];
        if (l < heap.length && heap[l][0] < mc) { m = l; mc = heap[l][0]; }
        if (r < heap.length && heap[r][0] < mc) m = r;
        if (m === i) break;
        heap[i] = heap[m]; i = m;
      }
      heap[i] = last;
    }
    return top;
  };
  for (const e of edges.values()) push(e.x, e.y);
  const flips = (a, b, X) => { // a'nın b'yi içermeyen yüzleri, a X'e taşınınca ters dönüyor mu
    for (const f of vf[a]) {
      const o = f * 3;
      if (F[o] < 0 || F[o] === b || F[o + 1] === b || F[o + 2] === b) continue;
      norm(F[o], F[o + 1], F[o + 2], N);
      const k0 = P[a * 3], k1 = P[a * 3 + 1], k2 = P[a * 3 + 2];
      P[a * 3] = X.x; P[a * 3 + 1] = X.y; P[a * 3 + 2] = X.z;
      norm(F[o], F[o + 1], F[o + 2], M);
      P[a * 3] = k0; P[a * 3 + 1] = k1; P[a * 3 + 2] = k2;
      if (M.dot(N) <= 0) return true;
    }
    return false;
  };
  const X = new THREE.Vector3();
  let live = F.length / 3;
  while (live > target && heap.length) {
    const [, a, b, sa, sb] = pop();
    if (!alive[a] || !alive[b] || stamp[a] !== sa || stamp[b] !== sb) continue;
    best(a, b, X);
    if (flips(a, b, X) || flips(b, a, X)) continue;
    P[a * 3] = X.x; P[a * 3 + 1] = X.y; P[a * 3 + 2] = X.z;
    for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
    alive[b] = 0;
    for (const f of vf[b]) {
      const o = f * 3;
      if (F[o] < 0) continue;
      if (F[o] === a || F[o + 1] === a || F[o + 2] === a) { F[o] = -1; live--; continue; }
      for (let k = 0; k < 3; k++) if (F[o + k] === b) F[o + k] = a;
      vf[a].push(f);
    }
    stamp[a]++;
    const nb = new Set();
    for (const f of vf[a]) if (F[f * 3] >= 0) for (let k = 0; k < 3; k++) nb.add(F[f * 3 + k]);
    nb.delete(a);
    for (const v of nb) push(a, v);
  }
  const out = new Int32Array(nv).fill(-1), keep = [], idx = [];
  for (let o = 0; o < F.length; o += 3) {
    if (F[o] < 0) continue;
    for (let k = 0; k < 3; k++) { const v = F[o + k]; if (out[v] < 0) { out[v] = keep.length; keep.push(v); } idx.push(out[v]); }
  }
  const m = keep.length, pos = new Float32Array(m * 3), nor = new Float32Array(m * 3), si = new Uint16Array(m * 4), sw = new Float32Array(m * 4);
  keep.forEach((v, j) => {
    for (let e = 0; e < 3; e++) pos[j * 3 + e] = P[v * 3 + e];
    si.set(p.si.subarray(src[v] * 4, src[v] * 4 + 4), j * 4); sw.set(p.sw.subarray(src[v] * 4, src[v] * 4 + 4), j * 4);
  });
  for (let t = 0; t < idx.length; t += 3) { // alanla ağırlıklı yüz normallerinden köşe normalleri
    A.fromArray(pos, idx[t] * 3); B.fromArray(pos, idx[t + 1] * 3).sub(A); C.fromArray(pos, idx[t + 2] * 3).sub(A); B.cross(C);
    for (let k = 0; k < 3; k++) for (let e = 0; e < 3; e++) nor[idx[t + k] * 3 + e] += B.getComponent(e);
  }
  for (let j = 0; j < m; j++) A.fromArray(nor, j * 3).normalize().toArray(nor, j * 3);
  return { pos, nor, si, sw, idx, col: p.col };
}

const TAG = { Skin: 1, Pants: 2, Hair: 3 };
// parçaları tek geometride birleştirir: list [ad] ya da [[ad, gölge]] (gömlek: kollar biraz koyu). tag: boyanacak köşeler (ten, pantolon, saç)
function build(parts, list) {
  const L = list.map((e) => (Array.isArray(e) ? e : [e, null]));
  let nv = 0, ni = 0;
  for (const [k] of L) { nv += parts[k].pos.length / 3; ni += parts[k].idx.length; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4), idx = new Uint32Array(ni);
  const col = new Float32Array(nv * 3), tag = new Uint8Array(nv);
  let o = 0, oi = 0;
  for (const [k, shade] of L) {
    const p = parts[k], c = p.pos.length / 3;
    pos.set(p.pos, o * 3); nor.set(p.nor, o * 3); si.set(p.si, o * 4); sw.set(p.sw, o * 4);
    for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + o;
    for (let i = 0; i < c; i++) {
      if (shade != null) col.fill(shade, (o + i) * 3, (o + i) * 3 + 3); else p.col.toArray(col, (o + i) * 3);
      tag[o + i] = TAG[k] || 0;
    }
    o += c; oi += p.idx.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return { g, col, tag };
}

// gövdenin renk çeşidi: köşe konumu ve kemik bağları paylaşılır, yalnız renk dizisi ayrı. lo: seyrek saçlı uzak görünüm
const bodyCache = new Map();
function bodyGeo(bald, skin, pants, hair, lo) {
  const key = `${bald ? 1 : lo ? 2 : 0}|${skin}|${pants}|${hair}`;
  let g = bodyCache.get(key);
  if (g) return g;
  const b = bald ? T.body[1] : lo ? T.lo : T.body[0], c = b.col.slice(), want = [null, new THREE.Color(skin), new THREE.Color(pants), new THREE.Color(hair)];
  for (let i = 0; i < b.tag.length; i++) if (b.tag[i]) want[b.tag[i]].toArray(c, i * 3);
  g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'skinIndex', 'skinWeight']) g.setAttribute(k, b.g.attributes[k]);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setIndex(b.g.index);
  bodyCache.set(key, g);
  return g;
}
let bodyMat = null;
const shirtMats = new Map();
function shirtMat(col) {
  let m = shirtMats.get(col);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: col, vertexColors: true, roughness: 0.85, metalness: 0 }); shirtMats.set(col, m); }
  return m;
}

// look: { skin, shirt, pants, hair, bald }. Döner: kök grup (userData eski karakterle aynı alanlar + hats: şapka grubu, face: yüz grubu,
// glbc: canlandırma)
export function character(look) {
  const root = new THREE.Group(), g = new THREE.Group(), m = new THREE.Group();
  root.add(g); g.add(m); m.scale.setScalar(T.s);
  const arm = T.arm.clone(true);
  m.add(arm);
  const by = {};
  arm.traverse((b) => { by[b.name] = b; });
  const skel = new THREE.Skeleton(T.names.map((nm) => by[nm]), T.inv);
  bodyMat = bodyMat || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  const skinned = (geo, mat) => {
    const s = new THREE.SkinnedMesh(geo, mat);
    s.castShadow = true; s.receiveShadow = true;
    s.boundingSphere = T.sphere; // kemik duruşundan hesaplatılmaz: oturan, kolunu kaldıran karakter de içinde kalır
    m.add(s); s.bind(skel, new THREE.Matrix4());
    return s;
  };
  const shirt = skinned(T.shirt.g, shirtMat(look.shirt));
  const body = skinned(bodyGeo(look.bald, look.skin, look.pants, look.hair, true), bodyMat);
  const anchor = (b, mtx) => { const o = new THREE.Group(); o.matrixAutoUpdate = false; o.matrix.copy(mtx); by[b].add(o); return o; };
  const head = anchor('Head', T.hat), face = anchor('Head', T.face);
  const arms = T.arms.map((a) => anchor(a.b, a.mtx));
  const legs = [new THREE.Object3D(), new THREE.Object3D()];
  const mixer = new THREE.AnimationMixer(arm);
  const act = (k) => (T.clips[k] ? mixer.clipAction(T.clips[k]) : null);
  const a = { g, m, mixer, idle: act('idle'), walk: act('walk'), run: act('run'), cur: null, last: 0, spd: 0, spdAt: 0, isRun: false, flagT: 0,
    look: { ...look }, body, anchors: [head, face, ...arms], saved: [], sv: new Map(), drive: [], fz: track([arm], [shirt, body], [skel]), lo: true, pc: null };
  // kukla → kemik. Kol ve bacak belirgin poza girince (oturma, el sallama, taşıma) klibin salınımı yerine düz dinlenme duruşundan döner
  const pose = (n) => [by[n], T.rest[n]];
  T.legs.forEach((l, i) => a.drive.push({ d: legs[i], b: by[l.b], reset: [pose(l.b), pose(l.low)] }));
  T.arms.forEach((l, i) => a.drive.push({ d: arms[i], b: by[l.b], reset: [pose(l.b), pose(l.low)] }));
  a.drive.push({ d: head, b: by.Head, reset: null });
  for (const d of a.drive) { a.sv.set(d.b, new THREE.Quaternion()); if (d.reset) for (const [b] of d.reset) a.sv.set(b, new THREE.Quaternion()); }
  a.cur = a.idle;
  if (a.idle) { a.idle.play(); a.idle.time = Math.random() * a.idle.getClip().duration; } // kalabalık aynı anda kıpırdamasın
  mixer.update(0);
  shirt.onBeforeRender = body.onBeforeRender = (r, s, cam) => tick(a, r, cam); // hangisi önce çizilirse (donmadan çıkışta ikisi de güncel)
  g.userData = { legs, arms, body: new THREE.Object3D(), head, hats: head, face, walk: 0, shirtMeshes: [shirt], sleeves: [], pantsMeshes: [], shoes: [], rig: g,
    t: Math.random() * 10, lookY: 0, lookT: 0, cc: true, glbc: a };
  root.userData = g.userData;
  return root;
}

// animateCharacter'dan: hız (0..1) ve koşu. 0,3 sn çağrılmazsa karakter durmuş sayılır
export function charMove(u, spd, run) { const a = u.glbc; a.spd = spd; a.isRun = run; a.spdAt = performance.now(); }
// mayo: pantolonun rengi (null: asıl pantolon)
export function charPants(u, col) { u.glbc.pc = col; setBody(u.glbc); }
function setBody(a) { const l = a.look; a.body.geometry = bodyGeo(l.bald, l.skin, a.pc || l.pants, l.hair, a.lo); }

function fade(a, to) {
  if (!to || to === a.cur) return;
  to.reset().setEffectiveWeight(1).fadeIn(0.25).play();
  if (a.cur) a.cur.fadeOut(0.25);
  a.cur = to;
}
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _e = new THREE.Euler();
function save(a, b) { if (!a.saved.includes(b)) { a.sv.get(b).copy(b.quaternion); a.saved.push(b); } }
// kemiği karakter uzayında (eski kuklanın ekseninde) döndürür: yerel = ata⁻¹ · kukla · ata · yerel
function turn(a, b, r) {
  _q.identity();
  for (let p = b.parent; p && p !== a.g; p = p.parent) _q.premultiply(p.quaternion);
  _q2.setFromEuler(_e.set(r.x, r.y, r.z, r.order));
  b.quaternion.premultiply(_q2.premultiply(_q3.copy(_q).invert()).multiply(_q));
}
// her çizimde (görünürken) bir kez: klip seçimi, karıştırıcı, kuklaların kemiğe işlenmesi, oturunca kalçanın inmesi. Uzaktaki küçük
// karakterde 2-3 karede bir (donuk.js)
function tick(a, r, cam) {
  if (!seen(a.fz, r) || busy(a.fz, a.g, H, r, cam)) return;
  if (a.lo !== (a.fz.px < 100 || perfMode())) { a.lo = !a.lo; setBody(a); } // Performans'ta hep seyrek saç
  const now = performance.now(), dt = Math.min(0.1, (now - a.last) / 1000);
  a.last = now;
  for (const b of a.saved) b.quaternion.copy(a.sv.get(b)); // geçen karenin ek dönüşü klipsiz kemikte birikmesin
  a.saved.length = 0;
  const spd = now - a.spdAt < 300 ? a.spd : 0;
  fade(a, spd > 0.05 ? (a.isRun && a.run ? a.run : a.walk) : a.idle);
  if (a.cur === a.walk) a.walk.timeScale = 0.6 + 0.7 * Math.min(1, spd);
  a.mixer.update(dt);
  for (const d of a.drive) {
    const r = d.d.rotation, amt = Math.abs(r.x) + Math.abs(r.y) + Math.abs(r.z);
    if (amt < 0.01) continue;
    if (d.reset && amt > 0.3) for (const [b, q] of d.reset) { save(a, b); b.quaternion.copy(q); }
    save(a, d.b);
    turn(a, d.b, r);
  }
  const L = a.g.userData.legs, k = Math.min(1, Math.max(0, -(L[0].rotation.x + L[1].rotation.x) / 2 / 1.3));
  a.m.position.y = -T.dh * k;
  // kafaya, ele takılanlar (şapka, kask, maske, raket) kemikle oynar: perf.js bunları duruyor sanıp birleştirmesin
  if ((a.flagT -= dt) <= 0) { a.flagT = 2; for (const o of a.anchors) o.traverse((c) => { c.userData.bkNo = true; }); }
  thawed(a.fz);
}
