// Kodla çizilen yuvarlak low-poly modeller + Kenney GLB yükleyici
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tex, texRep, stripes, vstripes, textTex, markerTex, plasterOf, scallop } from './tex.js';
import { loadAnimals, animal, hasAnimal } from './hayvan.js';
import { loadNature, nature, hasNature } from './doga.js';
import { loadBuildings, building, hasBuilding, buildingSize } from './yapi.js';
import { loadChars, hasChar, character, charMove, charPants } from './karakter.js';
import { loadVehicles, vehicle } from './arac.js';
import { loadEsya, esya } from './esya.js';
import { workTable } from './mobilya.js'; // döngüsel içe aktarma: mobilya da buradan rbox/mat alır, ikisi de yalnız çalışma anında çağrılır

// koleksiyon albümü (album.js): hayvan yapan fonksiyonlar ürettiklerini buraya kaydeder; oyuncu yakından geçince çıkartması gelir
export const ANIMALS = [];
export const VOICED = []; // hayvanses.js: sesi çıkan hayvanlar (albüm dolunca ANIMALS boşalır, bu kalır)
export function tagAnimal(o, k) { ANIMALS.push([o, k, 0]); VOICED.push([o, k, 0]); return o; } // [nesne, tür, sahne dışı sn]: userData'yı ezen yapıcı da olur

const PI = Math.PI;
const matCache = new Map();

// texRep klonu (tex.js rep etiketi) görüntü ve tekrar sayısıyla anahtarlanır: aynı yapıcı her çağrıldığında aynı malzemeyi alır. Önbellekli
// malzemenin rengi, dokusu sonradan değiştirilmez (paylaşılır); değişecekse kendi malzemesi kurulur
export function mat(color, o = {}) {
  const key = [color, o.map ? o.map.userData.rep || o.map.uuid : '', o.flat ? 1 : 0, o.rough ?? 0.85, o.side ?? 0, o.emissive ?? '', o.opacity ?? 1].join('|');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, map: o.map || null, roughness: o.rough ?? 0.85, metalness: 0, flatShading: !!o.flat, side: o.side ?? THREE.FrontSide });
    if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
    if (o.opacity != null && o.opacity < 1) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = false; }
    matCache.set(key, m);
  }
  return m;
}

export function mesh(geo, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

const geoCache = new Map();
function cached(key, make) { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g; }

export function rbox(w, h, d, r, material, x, y, z, parent) {
  const rr = Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
  // köşe yuvarlağı ekranda birkaç piksel: küçük yarıçapa 1, büyüğe 2 basamak yeter (3 basamak kutu başı 588 üçgendi, 1'i 108)
  const geo = cached(`rb${w}|${h}|${d}|${rr}`, () => new RoundedBoxGeometry(w, h, d, rr >= 0.08 ? 2 : 1, rr));
  return mesh(geo, material, x, y, z, parent);
}
// şekil ayrıntısı (kalite.js): Performans ve Pil tasarrufunda küre, kapsül ve silindirler daha az bölümle çizilir (karakterler ve süsler
// sahnedeki üçgenlerin çoğunu tutuyordu: telefonda büyük yük). Yeni çizilen parçalara uygulanır
let DETAIL = 1;
export function setDetail(k) { DETAIL = Math.max(0.3, Math.min(1, k || 1)); }
const seg = (n, min) => Math.max(Math.min(n, min), Math.round(n * DETAIL));
export function cyl(rt, rb, h, seg0, material, x, y, z, parent, open = false) {
  const sg = seg(seg0, 6);
  const geo = cached(`cy${rt}|${rb}|${h}|${sg}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, sg, 1, open));
  return mesh(geo, material, x, y, z, parent);
}
export function sph(r, material, x, y, z, parent, ws0 = 18, hs0 = 14) {
  const ws = seg(ws0, 7), hs = seg(hs0, 5);
  const geo = cached(`sp${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
  return mesh(geo, material, x, y, z, parent);
}
export function ico(r, material, x, y, z, parent, detail = 1) {
  const geo = cached(`ic${r}|${detail}`, () => new THREE.IcosahedronGeometry(r, detail));
  return mesh(geo, material, x, y, z, parent);
}
export function caps(r, len, material, x, y, z, parent) {
  const cs = seg(6, 2), rs = seg(14, 7);
  const geo = cached(`ca${r}|${len}|${cs}|${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs));
  return mesh(geo, material, x, y, z, parent);
}
function halfSphere(r, material, x, y, z, parent, seg0 = 20) {
  const ws = seg(seg0, 8), hs = seg(10, 4);
  const geo = cached(`hs${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs, 0, PI * 2, 0, PI / 2));
  return mesh(geo, material, x, y, z, parent);
}

// ---------- GLB ----------
export const MODELS = {};
function normalize(obj, size) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(obj);
  const sz = box.getSize(new THREE.Vector3());
  const s = size / Math.max(sz.x, sz.y, sz.z);
  obj.scale.setScalar(s);
  obj.position.set(-(box.min.x + sz.x / 2) * s, -box.min.y * s, -(box.min.z + sz.z / 2) * s);
  const g = new THREE.Group();
  g.add(obj);
  g.userData.h = sz.y * s;
  return g;
}
export async function loadModels(list, onProgress) {
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all([...list.map(async ([key, url, size]) => {
    const gltf = await loader.loadAsync(url);
    MODELS[key] = normalize(gltf.scene, size);
    done++; onProgress && onProgress(done / list.length);
  }), loadAnimals(), loadNature(), loadBuildings(), loadChars(), loadVehicles(), loadEsya()]); // hayvan, doğa, yapı, karakter, araç ve eşya GLB'leri (hayvan.js, doga.js, yapi.js, karakter.js, arac.js, esya.js): yüklenemeyen model kodla çizilen eski haliyle kalır
}
export function model(key) {
  const m = MODELS[key].clone(true);
  m.userData.h = MODELS[key].userData.h;
  m.userData.mk = key; // hangi model (aracses.js: sedan, taxi, van, truck... motor sesini seçer)
  return m;
}

// ---------- karakter ----------
export const SHIRTS = ['#f28db2', '#9c8cf0', '#f2a65a', '#7fd1c7', '#e85d75', '#f2c14e', '#8fbf5a', '#5bb8e8', '#c77dd8', '#ff8a65'];
export const SKINS = ['#f6d2b0', '#eec39a', '#d9a67c', '#b98260', '#f3cfae'];
const PANTS = ['#4a5568', '#3d4f7a', '#6b4e3d', '#2f3b4c', '#5a6b4a'];

// karakterler bir tık küçük (2026-10-28): gövde iç grupta (rig) %90. Kök ölçeği 1 kalır; popIn, çocuk ölçeği (0,7) ve elde taşınan
// ürünler (Stack yüksekliği rig'e göre) bozulmaz
export const CHAR_S = 0.9;
export function makeCharacter(o = {}) {
  if (hasChar()) return glbCharacter(o);
  const g = new THREE.Group();
  const skin = mat(o.skin || '#f3cfae');
  const shirt = mat(o.shirt || '#3b8beb');
  const pants = mat(o.pants || '#3a4a6b');
  const dark = mat('#2a2a2a', { rough: 0.5 });
  const legs = [], arms = [], shirtMeshes = [], pantsMeshes = [], shoes = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.13, 0.62, 0); g.add(hip);
    pantsMeshes.push(caps(0.11, 0.32, pants, 0, -0.3, 0, hip));
    shoes.push(rbox(0.2, 0.1, 0.3, 0.05, dark, 0, -0.6, 0.05, hip));
    legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(sx * 0.37, 1.2, 0); g.add(sh);
    shirtMeshes.push(caps(0.085, 0.36, shirt, 0, -0.22, 0, sh));
    sph(0.09, skin, 0, -0.46, 0, sh, 10, 8);
    arms.push(sh);
  }
  const body = caps(0.31, 0.42, shirt, 0, 0.98, 0, g);
  // kafa, yüz ve şapka tek grup: yürürken birlikte sallanır, yüz ve şapka kafanın içine gömülmez
  const hg = new THREE.Group();
  hg.position.y = 1.64;
  g.add(hg);
  const head = sph(0.31, skin, 0, 0, 0, hg);
  const white = mat('#ffffff', { rough: 0.3 });
  for (const sx of [-1, 1]) {
    sph(0.048, dark, sx * 0.11, 0.04, 0.268, hg, 8, 6);
    sph(0.015, white, sx * 0.11 + 0.016, 0.062, 0.31, hg, 6, 4); // göz parıltısı: bakış canlı
    const brow = rbox(0.085, 0.02, 0.02, 0.008, mat(o.hat === 'hair' || o.hat === 'none' || !o.hat ? (o.hatColor || '#4a3020') : '#4a3020'), sx * 0.11, 0.13, 0.282, hg);
    brow.rotation.z = sx * -0.12;
  }
  const smile = mesh(cached('smile', () => new THREE.TorusGeometry(0.06, 0.012, 5, 12, Math.PI)), dark, 0, -0.1, 0.285, hg);
  smile.rotation.z = Math.PI; smile.scale.set(1, 0.7, 1);
  sph(0.05, mat('#f4a3a3'), 0.18, -0.06, 0.24, hg, 8, 6).scale.set(1, 0.6, 0.4);
  sph(0.05, mat('#f4a3a3'), -0.18, -0.06, 0.24, hg, 8, 6).scale.set(1, 0.6, 0.4);
  faceExtras(hg, o);
  const hat = o.hat || 'none';
  headwear(hg, o, hat, false);
  if (hat === 'scarf') head.position.z += 0.02;
  if (hat === 'none' && !o.fem) { const h = halfSphere(0.322, mat(o.hairColor || '#3a2a1a'), 0, 0.05, -0.04, hg); h.rotation.x = -0.35; h.scale.set(1, 0.8, 1); } // kısa saç
  cyl(0.315, 0.315, 0.07, 16, mat('#3a2a1a', { rough: 0.6 }), 0, 0.66, 0, g); // bel kemeri: gömlek ile pantolon ayrılır
  const sleeves = shirtMeshes.slice();
  shirtMeshes.push(body);
  const fem = o.fem ?? (hat === 'scarf' || hat === 'hair');
  g.userData = { legs, arms, body, head: hg, walk: 0, shirtMeshes, sleeves, pantsMeshes, shoes, skin, fem, rig: g, t: Math.random() * 10, lookY: 0, lookT: 0 };
  g.scale.setScalar(CHAR_S);
  const root = new THREE.Group(); root.add(g); root.userData = g.userData;
  return root;
}
// bıyık ve güneş gözlüğü: eski kafanın birimlerinde (yarıçap 0,31, yüz önü z 0,31); modelli karakterde yüz grubu gözlere göre yerleşik
function faceExtras(hg, o) {
  if (o.mustache) rbox(0.18, 0.045, 0.06, 0.02, mat('#2a2a2a', { rough: 0.5 }), 0, -0.075, 0.285, hg); // köylü bıyığı
  if (o.shades) { for (const sx of [-1, 1]) rbox(0.13, 0.08, 0.04, 0.03, mat('#1d1d24', { rough: 0.2 }), sx * 0.11, 0.05, 0.285, hg); rbox(0.08, 0.02, 0.03, 0.01, mat('#1d1d24'), 0, 0.07, 0.29, hg); } // güneş gözlüğü
}
// şapka, sarık, başörtüsü. glb: modelli karakter (saç kendi modelinde boyanır; başörtüsü yüzü örtmesin diye geride)
function headwear(hg, o, hat, glb) {
  const hc = mat(o.hatColor || '#ffd23f');
  if (hat === 'cap') {
    halfSphere(0.325, hc, 0, 0.06, 0, hg);
    const brim = cyl(0.2, 0.2, 0.04, 16, hc, 0, 0.08, 0.26, hg); brim.scale.set(1.1, 1, 0.9);
  } else if (hat === 'hair' && !glb) {
    const h = halfSphere(0.33, mat(o.hatColor || '#4a3020'), 0, 0.02, -0.03, hg); h.rotation.x = -0.25;
  } else if (hat === 'turban') {
    const t = mesh(cached('tor', () => new THREE.TorusGeometry(0.24, 0.1, 8, 18)), hc, 0, 0.22, 0, hg); t.rotation.x = PI / 2;
    sph(0.2, hc, 0, 0.29, 0, hg, 12, 10);
  } else if (hat === 'straw') {
    cyl(0.52, 0.52, 0.04, 22, mat('#f0d38a'), 0, 0.22, 0, hg);
    cyl(0.22, 0.27, 0.22, 16, mat('#f0d38a'), 0, 0.33, 0, hg);
    cyl(0.275, 0.275, 0.06, 16, mat('#e8604c'), 0, 0.26, 0, hg);
  } else if (hat === 'scarf') {
    const s = sph(0.345, hc, 0, 0.01, glb ? -0.12 : -0.04, hg); s.scale.set(1, 1.05, glb ? 0.9 : 1);
  }
}
// modelli karakter (karakter.js): aynı görünüş seçenekleri. Saç modelin kendi saçı (hat 'hair': o renkte), kadında arkaya uzun saç eklenir;
// sarık ve başörtüsünün altında saç yok
function glbCharacter(o) {
  const hat = o.hat || 'none', fem = o.fem ?? (hat === 'scarf' || hat === 'hair');
  const hair = hat === 'hair' ? (o.hatColor || '#4a3020') : (o.hairColor || '#3a2a1a');
  const root = character({ skin: o.skin || '#f3cfae', shirt: o.shirt || '#3b8beb', pants: o.pants || '#3a4a6b', hair, bald: hat === 'turban' || hat === 'scarf' });
  const u = root.userData;
  u.rig.scale.setScalar(CHAR_S);
  headwear(u.hats, o, hat, true);
  if (fem && hat !== 'turban' && hat !== 'scarf') { const h = sph(0.3, mat(hair), 0, -0.12, -0.12, u.hats, 14, 10); h.scale.set(1.05, 1.2, 0.8); } // uzun saç
  faceExtras(u.face, o);
  u.skin = mat(o.skin || '#f3cfae'); u.fem = fem;
  return root;
}

// mayo: sahilde güneşlenirken üstünü çıkarır. Kadın tek parça mayo, erkek şort mayo; kollar, bacaklar çıplak, ayaklar yalın
export function setSwimwear(g, on) {
  const u = g.userData;
  if (u.glbc) { // modelli karakter: gömlek tene (kadında mayoya), pantolon mayo rengine (kadında tene) boyanır
    if (!u.swim) { const hex = rpick(u.fem ? ['#e8473c', '#ff6fa8', '#3d7dd8', '#2fb5a8', '#f6c343', '#8e5fd6'] : ['#3d7dd8', '#e8604c', '#2f8e88', '#f6a623', '#5a3b6b', '#56c27e']); u.swim = { suit: mat(hex), hex, on: false }; }
    const s = u.swim, sh = u.shirtMeshes[0];
    if (s.on === on) return;
    s.on = on;
    if (on) { sh.userData.cloth = sh.material; sh.material = u.fem ? s.suit : u.skin; } else if (sh.userData.cloth) sh.material = sh.userData.cloth;
    charPants(u, on ? (u.fem ? u.glbc.look.skin : s.hex) : null);
    return;
  }
  if (!u.sleeves) return;
  if (!u.swim) {
    const suit = mat(rpick(u.fem ? ['#e8473c', '#ff6fa8', '#3d7dd8', '#2fb5a8', '#f6c343', '#8e5fd6'] : ['#3d7dd8', '#e8604c', '#2f8e88', '#f6a623', '#5a3b6b', '#56c27e']));
    const parts = [];
    if (!u.fem) {
      parts.push(cyl(0.318, 0.318, 0.17, 16, suit, 0, 0.55, 0, u.rig || g)); // şortun beli
      for (const hip of u.legs) parts.push(caps(0.122, 0.05, suit, 0, -0.08, 0, hip)); // kısa paçalar
    }
    for (const p of parts) p.visible = false;
    u.swim = { suit, parts, on: false };
  }
  const s = u.swim;
  if (s.on === on) return;
  s.on = on;
  const dress = (m, bare) => { if (on) { m.userData.cloth = m.userData.cloth || m.material; m.material = bare; } else if (m.userData.cloth) m.material = m.userData.cloth; };
  for (const m of u.sleeves) dress(m, u.skin);
  dress(u.body, u.fem ? s.suit : u.skin);
  for (const m of u.pantsMeshes) dress(m, u.skin);
  for (const m of u.shoes) dress(m, u.skin);
  for (const p of s.parts) p.visible = on;
}

// bölgeye göre görünüş: kasabalı (pazar), turist (sahil, tatil köyü: açık renkler, güneş şapkası, gözlük, başörtüsüz)
export function townLook() {
  const fem = Math.random() < 0.5;
  return { shirt: rpick(SHIRTS), pants: rpick(['#3d4f7a', '#4a5568', '#2f3b4c', '#6b4e3d', '#7a6a55']), skin: rpick(SKINS), fem,
    hat: fem ? rpick(['hair', 'hair', 'scarf']) : rpick(['none', 'cap', 'hair']), hatColor: rpick(['#4a3020', '#2a2a2a', '#7a5230', '#e8604c', '#3d7dd8']), mustache: !fem && Math.random() < 0.35 };
}
export function touristLook() {
  const fem = Math.random() < 0.5;
  return { shirt: rpick(['#ff8a65', '#5bb8e8', '#f2c14e', '#7fd1c7', '#f28db2', '#ffffff', '#c77dd8', '#8fbf5a']), pants: rpick(['#e9dcc0', '#ffffff', '#c9b48a', '#7fa8d1', '#f0e6d2']), skin: rpick(SKINS), fem,
    hat: rpick(fem ? ['straw', 'hair', 'hair'] : ['straw', 'cap', 'none', 'hair']), hatColor: rpick(['#ffffff', '#3d7dd8', '#f6c343', '#e8604c', '#4a3020']), shades: Math.random() < 0.55 };
}

export function randomLook(r = Math.random) {
  const hats = ['none', 'cap', 'hair', 'hair', 'straw', 'scarf'];
  const pick = (a) => a[Math.floor(r() * a.length)];
  return { shirt: pick(SHIRTS), skin: pick(SKINS), pants: pick(PANTS), hat: pick(hats), hatColor: pick(['#4a3020', '#e8604c', '#3d7dd8', '#f6c343', '#2a2a2a', '#9c8cf0', '#ffffff']) };
}

// run: oyuncunun aceleci koşusu (sık adım, uzun salınım, kollar pompalar, daha çok zıplar)
export function animateCharacter(g, speed01, dt, carrying, run = false) {
  const u = g.userData;
  if (u.glbc) { // modelli karakter: adım, kol salınımı ve nefes modelin kliplerinde; kuklalar yalnız taşıma pozu ve etrafa bakma için
    u.t = (u.t || 0) + dt;
    const idle = 1 - Math.min(1, speed01 * 3);
    if ((u.lookT = (u.lookT || 0) - dt) <= 0) { u.lookT = 2 + Math.random() * 3; u.lookY = idle > 0.9 && Math.random() < 0.6 ? (Math.random() - 0.5) * 1.0 : 0; }
    u.head.rotation.y += ((u.lookY || 0) * idle - u.head.rotation.y) * Math.min(1, dt * 4);
    u.head.rotation.z = 0;
    for (const a of u.arms) { a.rotation.z = 0; a.rotation.x = carrying ? -1.25 : 0; }
    if (u.umb && !carrying) u.arms[0].rotation.x = -1.3; // şemsiye tutan sağ kol (hava.js)
    for (const l of u.legs) l.rotation.x = 0;
    u.walk += dt * (run ? 16 : 11) * Math.max(0.15, speed01);
    charMove(u, speed01, run);
    return;
  }
  // yürürken kalça hafifçe yana, omuzlar adımın tersine döner, kafa dengeyi tutar; dururken nefes alır ve arada etrafa bakar
  u.t = (u.t || 0) + dt;
  const idle = 1 - Math.min(1, speed01 * 3), sw = Math.sin(u.walk) * speed01;
  u.body.rotation.z = sw * (run ? 0.04 : 0.06); u.body.rotation.y = sw * (run ? 0.1 : 0.14);
  u.body.scale.y = 1 + Math.sin(u.t * 2.3) * 0.015 * idle;
  if ((u.lookT = (u.lookT || 0) - dt) <= 0) { u.lookT = 2 + Math.random() * 3; u.lookY = idle > 0.9 && Math.random() < 0.6 ? (Math.random() - 0.5) * 1.0 : 0; }
  u.head.rotation.y += ((u.lookY || 0) * idle - sw * 0.1 - u.head.rotation.y) * Math.min(1, dt * 4);
  u.head.rotation.z = -sw * 0.05;
  for (const [i, a] of u.arms.entries()) a.rotation.z = (i ? -1 : 1) * (0.05 + idle * 0.03 + (run ? 0.12 : 0.04) * speed01);
  u.walk += dt * (run ? 16 : 11) * Math.max(0.15, speed01);
  const s = Math.sin(u.walk) * (run ? 0.95 : 0.75) * speed01;
  u.legs[0].rotation.x = s; u.legs[1].rotation.x = -s;
  if (carrying) { u.arms[0].rotation.x = u.arms[1].rotation.x = -1.25 + (run ? Math.sin(u.walk * 2) * 0.06 * speed01 : 0); }
  else { u.arms[0].rotation.x = -s * (run ? 1.15 : 0.9) - (run ? 0.35 * speed01 : 0); u.arms[1].rotation.x = s * (run ? 1.15 : 0.9) - (run ? 0.35 * speed01 : 0); }
  idleGesture(u, idle > 0.9 && !carrying && !u.umb, dt);
  if (u.umb && !carrying) { u.arms[0].rotation.x = -1.3; u.arms[0].rotation.z = 0; } // şemsiye tutan sağ kol (hava.js)
  // gövde, kollar ve kafa aynı miktarda sallanır
  const bob = Math.abs(Math.cos(u.walk)) * (run ? 0.09 : 0.05) * speed01;
  u.body.position.y = 0.98 + bob;
  u.head.position.y = 1.64 + bob;
  u.arms[0].position.y = u.arms[1].position.y = 1.2 + bob;
}

// 2026-11-04 kullanıcı: "oyunda heykel gibi duran kimse olmasın". Bir yerde bekleyen arada bir elini arkasında birleştirir,
// çenesini tutar, gerinir, elini beline koyar (kollar düz kukla: dirsek yok). Kendi işi olan workMotion'la bunu bastırır
const GEST = [
  [4.0, (A, e) => { A[0].rotation.x = A[1].rotation.x = 0.4 * e; A[0].rotation.z += 0.12 * e; A[1].rotation.z -= 0.12 * e; }], // eller arkada
  [2.6, (A, e) => { A[1].rotation.x = -2.2 * e; A[1].rotation.z -= 0.45 * e; }], // çenesini tutar
  [2.0, (A, e) => { A[0].rotation.x = A[1].rotation.x = -2.8 * e; A[0].rotation.z -= 0.2 * e; A[1].rotation.z += 0.2 * e; }], // gerinir
  [3.0, (A, e) => { A[0].rotation.z -= 0.55 * e; A[1].rotation.z += 0.55 * e; A[0].rotation.x = A[1].rotation.x = 0.2 * e; }], // eller belde
];
function idleGesture(u, still, dt) {
  u.still = still ? (u.still || 0) + dt : 0;
  if (u.still < 2.5) { u.gest = null; return; }
  if (!u.gest) {
    if ((u.gestT = (u.gestT ?? Math.random() * 5) - dt) > 0) return;
    u.gest = { f: GEST[Math.floor(Math.random() * GEST.length)], t: 0 }; u.gestT = 4 + Math.random() * 5;
  }
  const g = u.gest, [D, f] = g.f;
  if ((g.t += dt) >= D) { u.gest = null; return; }
  f(u.arms, Math.min(1, g.t / 0.45, (D - g.t) / 0.45));
}

// İş başındaki çalışanın el kol hareketi (2026-11-04 kullanıcı: "işlerinin başında duran adamlar hareketsiz durmasın, yaptıkları işe
// uygun hareketleri olsun"). animateCharacter'dan sonra çağrılır, kolları ve başın eğimini onun üstüne yazar. on: iş sürüyor
// (makine üretiyor, sırada müşteri var); değilse aynı işi ağır ağır yapar, arada başını kaldırır. Kollar: [0] sol, [1] sağ; x eksi öne
// kalkar, z artı soldakini, eksi sağdakini içe alır
const WORK = {
  yogur: (A, H, k, a) => { const s = Math.sin(k * 4.5) * 0.2 * a; A[0].rotation.x = -0.95 + s; A[1].rotation.x = -0.95 - s; A[0].rotation.z = 0.15; A[1].rotation.z = -0.15; H.rotation.x = 0.35; }, // hamur yoğurur
  karistir: (A, H, k, a) => { A[1].rotation.x = -1.0 + Math.sin(k * 3.5) * 0.2 * a; A[1].rotation.z = -0.2 + Math.cos(k * 3.5) * 0.2 * a; A[0].rotation.x = -0.6; A[0].rotation.z = 0.1; H.rotation.x = 0.3; }, // kazanı karıştırır
  cevir: (A, H, k, a) => { A[1].rotation.x = -0.85 - Math.pow(Math.max(0, Math.sin(k * 2.2)), 4) * 0.6 * a; A[1].rotation.z = -0.1; A[0].rotation.x = -0.7 + Math.sin(k * 1.1) * 0.08; H.rotation.x = 0.3; }, // ızgarada çevirir
  kepce: (A, H, k, a) => { const s = Math.sin(k * 2.6); A[1].rotation.x = -0.9 - (0.5 + 0.5 * s) * 0.4 * a; A[1].rotation.z = -0.1 - s * 0.12 * a; A[0].rotation.x = -1.15; A[0].rotation.z = 0.25; H.rotation.x = 0.25; }, // kaşıkla dondurma koyar
  tasi: (A, H, k, a) => { const e = (0.5 - 0.5 * Math.cos(k * 1.4)) * a; A[0].rotation.x = A[1].rotation.x = -0.5 - 1.1 * e; A[0].rotation.z = 0.25; A[1].rotation.z = -0.25; H.rotation.x = 0.15 + 0.1 * e; }, // çuvalı kaldırıp boşaltır
  tirmik: (A, H, k, a) => { const s = Math.sin(k * 2) * 0.45 * a; A[0].rotation.x = -0.7 + s; A[1].rotation.x = -1.0 + s; A[0].rotation.z = 0.1; A[1].rotation.z = -0.1; H.rotation.x = 0.25; }, // harmanı savurur
  katla: (A, H, k, a) => { const e = Math.max(0, Math.sin(k * 2)) * 0.5 * a; A[0].rotation.x = A[1].rotation.x = -1.1; A[0].rotation.z = 0.1 - e; A[1].rotation.z = -0.1 + e; H.rotation.x = 0.3; }, // havlu katlar
  diz: (A, H, k, a) => { A[0].rotation.x = -0.9 + Math.sin(k * 2.3) * 0.25 * a; A[1].rotation.x = -1.05 + Math.sin(k * 2.3 + 2) * 0.25 * a; A[0].rotation.z = 0.15; A[1].rotation.z = -0.15 + Math.sin(k * 1.7) * 0.1 * a; H.rotation.x = 0.3; }, // tezgâha dizer, düzeltir
  kasa: (A, H, k, a) => { A[1].rotation.x = -1.0 + Math.abs(Math.sin(k * 7)) * 0.12 * a; A[1].rotation.z = -0.25; A[0].rotation.x = -0.85 + Math.sin(k * 1.3) * 0.06; A[0].rotation.z = 0.2; H.rotation.x = Math.sin(k * 0.5) > 0.6 ? 0 : 0.3; }, // yazarkasaya basar, parayı sayar, arada bakar
  yaz: (A, H, k, a) => { A[1].rotation.x = -1.05 + Math.sin(k * 9) * 0.05 * a; A[1].rotation.z = -0.3 + Math.sin(k * 3) * 0.08 * a; A[0].rotation.x = -0.9; A[0].rotation.z = 0.3; H.rotation.x = Math.sin(k * 0.45) > 0.7 ? 0.05 : 0.4; }, // deftere yazar
};
WORK.sat = (A, H, k, a) => { // tezgâhı düzeltir, arada el edip müşteri çağırır
  if (Math.sin(k * 0.9) > 0.75) { A[1].rotation.x = -2.2 + Math.sin(k * 10) * 0.3; A[1].rotation.z = 0.15; A[0].rotation.x = -0.4; A[0].rotation.z = 0.1; H.rotation.x = 0; }
  else WORK.diz(A, H, k, a);
};
export const WORK_KINDS = Object.keys(WORK);
export function workMotion(g, kind, dt, on = true) {
  const u = g.userData;
  if (!u || !u.arms) return;
  u.gest = null; u.still = 0; // kendi işi var: boşta bekleyenin jesti yapılmaz
  if (u.wph == null) u.wph = Math.random() * 20;
  u.wph += dt * (on ? 1 : 0.5);
  (WORK[kind] || WORK.diz)(u.arms, u.head, u.wph, on ? 1 : 0.6);
}
// oturan ya da uzanan, animateCharacter'ı çağrılmayan karakter: nefes alır, başı ağır ağır döner (kollarına dokunmaz)
export function breathe(g, t, look = 0.4) {
  const u = g.userData;
  if (u.ph == null) u.ph = Math.random() * 20;
  const k = t + u.ph;
  if (u.body) u.body.scale.y = 1 + Math.sin(k * 2.1) * 0.02;
  if (u.head) u.head.rotation.y = Math.sin(k * 0.27) * look + Math.sin(k * 0.71) * look * 0.3;
}

// ---------- taşıma: eşek ve tekerlekli araba ----------
export function makeDonkey() { return tagAnimal(rawDonkey(), 'esek'); } // albüm: hayvan kaydı (album.js)
function rawDonkey() {
  if (hasAnimal('esek')) return glbDonkey();
  const g = new THREE.Group();
  const c = mat('#9a8f86'), cd = mat('#6f655e'), light = mat('#d9d2c8');
  const body = sph(0.45, c, 0, 0.88, 0, g); body.scale.set(0.72, 0.62, 1.2);
  const neck = caps(0.13, 0.35, c, 0, 1.12, 0.48, g); neck.rotation.x = 0.7;
  const head = caps(0.13, 0.3, c, 0, 1.3, 0.72, g); head.rotation.x = 1.25;
  sph(0.11, light, 0, 1.2, 0.92, g, 10, 8).scale.set(1, 0.8, 1);
  for (const sx of [-1, 1]) {
    const ear = caps(0.045, 0.28, c, sx * 0.08, 1.55, 0.62, g); ear.rotation.z = -sx * 0.25; ear.rotation.x = -0.2;
    sph(0.03, mat('#2a2a2a'), sx * 0.1, 1.36, 0.8, g, 6, 4);
  }
  const tail = caps(0.03, 0.3, cd, 0, 0.85, -0.6, g); tail.rotation.x = 0.4;
  const legs = [];
  for (const [x, z] of [[-0.17, 0.36], [0.17, 0.36], [-0.17, -0.36], [0.17, -0.36]]) {
    const hip = new THREE.Group(); hip.position.set(x, 0.7, z); g.add(hip);
    caps(0.07, 0.5, cd, 0, -0.38, 0, hip);
    legs.push(hip);
  }
  // eyer ve renkli heybeler; yük eyerin üstüne dizilir
  rbox(0.62, 0.08, 0.7, 0.03, mat('#b23a48'), 0, 1.18, 0, g);
  for (const sx of [-1, 1]) rbox(0.16, 0.36, 0.5, 0.06, mat('#e0b04a'), sx * 0.38, 0.95, 0, g);
  const saddle = new THREE.Group(); saddle.position.set(0, 1.22, 0); g.add(saddle);
  g.userData = { legs, walk: 0, saddle };
  return g;
}
// GLB eşek: eyer örtüsü ve heybeler sırta oturur, yük eyerin üstüne (kemiğe bağlanınca boştaki kıpırtıda eğri duruyordu)
function glbDonkey() {
  const g = animal('esek'), u = g.userData, { top, half } = u.back, z = u.back.z;
  const deco = new THREE.Group(); g.add(deco);
  rbox(half * 2 + 0.1, 0.07, 0.62, 0.03, mat('#b23a48'), 0, top + 0.01, z, deco);
  for (const sx of [-1, 1]) rbox(0.1, 0.26, 0.36, 0.04, mat('#e0b04a'), sx * (half + 0.05), top - 0.16, z, deco);
  const saddle = new THREE.Group(); saddle.position.set(0, top + 0.05, z); deco.add(saddle);
  u.saddle = saddle;
  return g;
}
export function animateDonkey(g, speed01, dt) {
  const u = g.userData;
  u.walk += dt * 9 * Math.max(0.1, speed01);
  const s = Math.sin(u.walk) * 0.55 * speed01;
  u.legs[0].rotation.x = s; u.legs[3].rotation.x = s;
  u.legs[1].rotation.x = -s; u.legs[2].rotation.x = -s;
}
export function makeCart() {
  const g = new THREE.Group();
  const wood = mat('#ffffff', { map: texRep('wood', 1, 0.5) }), dark = mat('#6b4423');
  rbox(1.15, 0.1, 1.25, 0.03, wood, 0, 0.62, 0, g);
  for (const sx of [-1, 1]) rbox(0.06, 0.28, 1.25, 0.02, wood, sx * 0.56, 0.78, 0, g);
  for (const sz of [-1, 1]) rbox(1.15, 0.28, 0.06, 0.02, wood, 0, 0.78, sz * 0.6, g);
  for (const sx of [-1, 1]) { const sh = rbox(0.06, 0.06, 1.3, 0.02, dark, sx * 0.3, 0.72, 1.1, g); sh.rotation.x = -0.12; }
  const wheels = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * 0.66, 0.42, 0); g.add(w);
    const rim = mesh(cached('cartrim', () => new THREE.TorusGeometry(0.36, 0.05, 6, 18)), dark, 0, 0, 0, w); rim.rotation.y = PI / 2;
    for (let i = 0; i < 4; i++) { const sp = rbox(0.04, 0.68, 0.04, 0.01, wood, 0, 0, 0, w); sp.rotation.x = (i * PI) / 4; }
    wheels.push(w);
  }
  const bed = new THREE.Group(); bed.position.set(0, 0.68, 0); g.add(bed);
  g.userData = { wheels, bed };
  return g;
}
// alışveriş sepeti: hasır gövde, iki yana uzanan sap
export function makeBasket() {
  const v = esya('sepet'); // Poly Pizza piknik sepeti (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  rbox(0.48, 0.2, 0.34, 0.05, mat('#c98b4a', { map: texRep('wood', 0.6, 0.3) }), 0, 0.1, 0, g);
  rbox(0.42, 0.02, 0.28, 0.01, mat('#8a5a33'), 0, 0.19, 0, g);
  mesh(cached('baskethandle', () => new THREE.TorusGeometry(0.21, 0.022, 6, 14, PI)), mat('#8a5a33'), 0, 0.19, 0, g);
  return g;
}
// alışveriş arabası: tel sepet (ince çubuklu kenarlar), kırmızı sap, dört küçük teker. Ürünler sepetin tabanına dizilir (userData.bin)
export function makeTrolley() {
  const g = new THREE.Group();
  const steel = mat('#cfd6de', { rough: 0.35 }), dark = mat('#3d4552'), red = mat('#e8604c');
  const bin = new THREE.Group(); bin.position.set(0, 0.6, 0.05); g.add(bin);
  rbox(0.56, 0.03, 0.66, 0.01, steel, 0, 0, 0, bin);
  for (const sx of [-1, 1]) rbox(0.025, 0.34, 0.66, 0.01, steel, sx * 0.28, 0.17, 0, bin);
  rbox(0.56, 0.34, 0.025, 0.01, steel, 0, 0.17, 0.33, bin);
  rbox(0.56, 0.3, 0.025, 0.01, steel, 0, 0.15, -0.33, bin);
  for (const y of [0.1, 0.22, 0.33]) for (const sx of [-1, 1]) rbox(0.035, 0.016, 0.67, 0.005, dark, sx * 0.285, y, 0, bin); // tel kafes çizgileri
  for (const y of [0.1, 0.22, 0.33]) rbox(0.57, 0.016, 0.035, 0.005, dark, 0, y, 0.335, bin);
  rbox(0.62, 0.045, 0.045, 0.015, red, 0, 1.0, -0.44, g); // sap
  for (const sx of [-1, 1]) rbox(0.03, 0.42, 0.03, 0.01, steel, sx * 0.28, 0.8, -0.4, g);
  for (const sx of [-1, 1]) rbox(0.03, 0.03, 0.72, 0.01, steel, sx * 0.24, 0.13, 0, g); // şasi
  for (const sx of [-1, 1]) rbox(0.03, 0.48, 0.03, 0.01, steel, sx * 0.24, 0.37, -0.3, g);
  for (const [x, z] of [[-0.24, 0.3], [0.24, 0.3], [-0.24, -0.3], [0.24, -0.3]]) { const w = cyl(0.06, 0.06, 0.04, 10, dark, x, 0.06, z, g); w.rotation.z = PI / 2; }
  g.userData = { bin };
  return g;
}
// bisiklet: iki teker, renkli üçgen kadro, sele, gidon ve önde küçük sepet
function rod(a, b, r, m, parent) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const c = mesh(new THREE.CylinderGeometry(r, r, len, 6), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
  c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return c;
}
export function makeBicycle(col = '#e8604c') {
  const v = vehicle('bisiklet', col); // Poly Pizza bisikleti (arac.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  const dark = mat('#2a2a2a', { rough: 0.6 }), frame = mat(col), steel = mat('#d7dde3', { rough: 0.35 });
  const wheels = [];
  for (const z of [-0.52, 0.52]) {
    const w = new THREE.Group(); w.position.set(0, 0.32, z); g.add(w);
    const tire = mesh(cached('biketire', () => new THREE.TorusGeometry(0.29, 0.045, 6, 18)), dark, 0, 0, 0, w); tire.rotation.y = PI / 2;
    for (let i = 0; i < 3; i++) { const sp = rbox(0.02, 0.54, 0.02, 0.005, steel, 0, 0, 0, w); sp.rotation.x = (i * PI) / 3; }
    wheels.push(w);
  }
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const rear = V3(0, 0.32, -0.52), front = V3(0, 0.32, 0.52), seat = V3(0, 0.78, -0.2), crank = V3(0, 0.34, 0), head = V3(0, 0.82, 0.38);
  for (const [a, b] of [[rear, seat], [rear, crank], [crank, seat], [seat, head], [crank, head]]) rod(a, b, 0.032, frame, g);
  rod(head, front, 0.026, steel, g);
  rbox(0.13, 0.05, 0.26, 0.02, dark, 0, 0.82, -0.24, g);
  rod(V3(-0.24, 0.92, 0.36), V3(0.24, 0.92, 0.36), 0.02, steel, g);
  rod(head, V3(0, 0.92, 0.36), 0.022, steel, g);
  rbox(0.3, 0.16, 0.22, 0.04, mat('#c98b4a', { map: texRep('wood', 0.6, 0.3) }), 0, 0.82, 0.58, g);
  g.userData = { wheels };
  g.scale.setScalar(1.3); // karakter 2,05 boyunda: teker çapı ~0,87, sele ~1,0 (eskisi çocuk bisikleti gibi kalıyordu)
  return g;
}
// bisiklet parkı: n yer, 0,8 arayla (yerel x). Bisikletin burnu -z'de. 2026-11-08 kullanıcı: "bisiklet durağını daha güzel yerleştir ve
// güzelleştir": çimendeki gri levha ve minik demirlerin yerine bordürlü taş zemin, her yerin yanında yeşil boyalı ters U demir, ön teker
// yanında iki direkli şeffaf yeşil sundurma (kamera bisikletleri görmeye devam eder), iki uçta çiçekli saksı ve kameraya bakan tabela.
// world.js grubu PI/2 döndürür: yerel -x dünyada güney (kameraya yakın uç), yerel -z batı
export function makeBikeRack(n = 4) {
  const g = new THREE.Group(), S = 0.8, w = (n - 1) * S + 1.4, D = 2.6;
  const paint = mat('#2f8a57', { rough: 0.45 }), post = mat('#4a5560', { rough: 0.5 });
  rbox(w + 0.5, 0.08, D + 0.3, 0.03, mat('#9a9184'), 0, 0.04, -0.1, g).receiveShadow = true; // bordür
  rbox(w + 0.3, 0.06, D + 0.1, 0.02, mat('#ffffff', { map: texRep('cobble', (w + 0.3) / 1.6, (D + 0.1) / 1.6) }), 0, 0.06, -0.1, g).receiveShadow = true;
  const hoop = cached('bikehoop', () => new THREE.TorusGeometry(0.3, 0.032, 6, 14, PI));
  for (let i = 0; i < n; i++) { // ters U demir bisikletin yanında
    const x = -((n - 1) * S) / 2 + i * S + 0.3;
    mesh(hoop, paint, x, 0.5, -0.35, g).rotation.y = PI / 2;
    for (const z of [-0.65, -0.05]) cyl(0.032, 0.032, 0.5, 6, paint, x, 0.25, z, g);
  }
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) cyl(0.045, 0.045, 1.9, 8, post, x, 0.95, -1.15, g);
  rbox(w + 0.2, 0.08, 0.08, 0.02, post, 0, 1.9, -1.15, g); // arka kiriş
  const roof = rbox(w + 0.2, 0.04, 1.1, 0.02, mat('#7fd1a0', { transparent: true, opacity: 0.45, rough: 0.2 }), 0, 1.84, -0.7, g);
  roof.rotation.x = -0.18; // öne (doğuya) doğru alçalır
  const box = mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
  for (const sx of [-1, 1]) { // iki uçta çiçekli ahşap saksı
    const px = sx * (w / 2 + 0.05);
    rbox(0.5, 0.42, 0.5, 0.05, box, px, 0.29, 0.75, g);
    const f = makeFlowers(); f.position.set(px, 0.5, 0.75); f.scale.setScalar(0.7); g.add(f);
  }
  const sign = makeSign('🚲 BİSİKLET PARKI', '#2f8a57', 1.8, 0.42); // kameraya (güneye) bakar: grubun PI/2 dönüşünü -PI/2 düzeltir
  sign.scale.setScalar(0.62); sign.position.set(-w / 2 - 0.45, 0, -0.9); sign.rotation.y = -PI / 2; g.add(sign);
  g.traverse((o) => { if (o.isMesh && o !== roof) o.castShadow = true; });
  return g;
}

// ---------- köy araçları: eski sedan, kamyonet, köy dolmuşu, römorklu traktör, eşek arabası ----------
const VCOLS = ['#e8d9b0', '#c0504d', '#3d7dd8', '#f6f1e7', '#6b8e5a', '#d9a066', '#2f8e88'];
const rpick = (a) => a[Math.floor(Math.random() * a.length)];
// köylü: kasketli bıyıklı adam ya da yemenili kadın
export function villagerLook() {
  const skin = rpick(['#f3cfae', '#e0b48a', '#d9a67c', '#c68e5f']);
  return Math.random() < 0.55
    ? { shirt: rpick(['#6b4e36', '#4e5d6c', '#7a3b2e', '#3f5f3a', '#8a7a5a', '#5b6770']), pants: rpick(['#3a3a3a', '#4a3b2a', '#2d3e66']), hat: 'cap', hatColor: rpick(['#3a2a1a', '#4a4a4a', '#2a2a2a', '#5a4632']), skin, mustache: true }
    : { shirt: rpick(['#c0504d', '#3d7dd8', '#7a3b6e', '#2f8e88', '#e8a33c', '#8e5fd6']), pants: rpick(['#5a3b6b', '#3a4a6b', '#6b3a3a', '#2f4a3a']), hat: 'scarf', hatColor: rpick(['#ffffff', '#f6c343', '#e85d9a', '#9c8cf0', '#7fc4e8', '#f4a3a3']), skin };
}
export function carWheel(g, r, w, x, y, z, list) {
  const wh = new THREE.Group(); wh.position.set(x, y, z); g.add(wh);
  cyl(r, r, w, 14, mat('#2a2a2a', { rough: 0.7 }), 0, 0, 0, wh).rotation.z = PI / 2;
  cyl(r * 0.52, r * 0.52, w + 0.02, 10, mat('#d7dde3', { rough: 0.35 }), 0, 0, 0, wh).rotation.z = PI / 2;
  rbox(w + 0.04, r * 1.3, 0.07, 0.02, mat('#8b939c'), 0, 0, 0, wh); // dönerken görünen jant çizgisi
  list.push(wh);
  return wh;
}
// araçta oturan köylü: bacaklar öne, kollar direksiyonda
export function sitter(look, x, y, z, s, parent) {
  const d = makeCharacter(look);
  d.scale.setScalar(s); d.position.set(x, y, z);
  for (const l of d.userData.legs) l.rotation.x = -1.45;
  for (const a of d.userData.arms) a.rotation.x = -1.0;
  parent.add(d);
  return d;
}
// camlı kabin: içindeki köylü dışarıdan görünür
export function cabin(g, w, h, d, y, z, roof) {
  const glass = new THREE.MeshStandardMaterial({ color: '#cfeefa', roughness: 0.1, transparent: true, opacity: 0.32, depthWrite: false });
  const box = mesh(new THREE.BoxGeometry(w, h, d), glass, 0, y + h / 2, z, g);
  box.castShadow = false; box.renderOrder = 3;
  rbox(w + 0.06, 0.1, d + 0.06, 0.04, roof, 0, y + h, z, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rbox(0.08, h, 0.08, 0.02, roof, sx * (w / 2 - 0.02), y + h / 2, z + sz * (d / 2 - 0.02), g);
}
// sürücü kapısı: menteşe önde, açılınca dışa döner
export function carDoor(g, x, y, z, len, h, m) {
  const door = new THREE.Group(); door.position.set(x, y, z); g.add(door);
  const s = Math.sign(x);
  rbox(0.06, h, len, 0.02, m, s * 0.02, 0, -len / 2, door);
  rbox(0.03, 0.05, 0.18, 0.01, mat('#e6e9ec'), s * 0.06, 0.06, -len * 0.75, door);
  door.userData.side = s;
  return door;
}
// Ölçek: araba K kat büyütülür, oturan köylü 1/K ölçekle konur; sonuçta sürücü yürüyen köylüyle (2,05) aynı boydadır,
// arabaya binince küçülmez. Arabalar böylece hazır model arabalarla (sedan, taksi: ~2,2 boy) aynı boyda olur;
// kabinler oturan tam boy köylünün başı tavana değmeyecek yükseklikte. Eşek arabası büyütülmez (eşek inekten büyük olmasın)
export function makeVillageCar(kind, o = {}) {
  const K = kind === 'donkey' ? 1 : kind === 'tractor' ? 1.1 : 1.2, DS = 1 / K;
  const g = new THREE.Group(), wheels = [], look = o.look || villagerLook();
  const c1 = mat(o.color || rpick(VCOLS)), c2 = mat(o.color2 || rpick(['#c0504d', '#3d7dd8', '#3fae6b', '#e8604c'])), chrome = mat('#e6e9ec', { rough: 0.3 });
  const lamp = mat('#fff6c8', { emissive: '#ffe9a0', ei: 0.3 }), wood = mat('#ffffff', { map: texRep('wood', 1, 0.4) }), hay = mat('#e8c86a', { flat: true });
  const lamps = (y, z, x = 0.6) => { for (const sx of [-1, 1]) cyl(0.13, 0.13, 0.06, 12, lamp, sx * x, y, z, g).rotation.x = PI / 2; };
  let driver = null, door = null, speed = 7, donkey = null;
  if (kind === 'classic') { // köşeli eski sedan
    rbox(1.8, 0.55, 4.1, 0.14, c1, 0, 0.62, 0, g);
    cabin(g, 1.58, 0.96, 1.9, 0.9, -0.25, c1);
    for (const z of [2.08, -2.08]) rbox(1.9, 0.14, 0.12, 0.05, chrome, 0, 0.45, z, g);
    for (const sx of [-1, 1]) rbox(0.04, 0.08, 4.0, 0.02, c2, sx * 0.91, 0.66, 0, g);
    lamps(0.66, 2.06);
    for (const [x, z] of [[-0.86, 1.35], [0.86, 1.35], [-0.86, -1.35], [0.86, -1.35]]) carWheel(g, 0.34, 0.24, x, 0.34, z, wheels);
    driver = sitter(look, 0.38, 0.107, -0.05, DS, g);
    door = carDoor(g, 0.92, 0.66, 0.55, 1.15, 0.5, c1);
  } else if (kind === 'pickup') { // eski kamyonet: kasasında saman ve süt güğümleri
    rbox(1.8, 0.62, 1.7, 0.14, c1, 0, 0.66, 1.25, g);
    rbox(1.8, 0.5, 1.2, 0.1, c1, 0, 0.6, 0.0, g);
    cabin(g, 1.6, 1.0, 1.15, 0.85, 0.0, c1);
    rbox(1.84, 0.14, 2.0, 0.04, mat('#6b4423'), 0, 0.5, -1.65, g);
    for (const sx of [-1, 1]) rbox(0.08, 0.42, 2.0, 0.02, wood, sx * 0.88, 0.78, -1.65, g);
    rbox(1.84, 0.42, 0.08, 0.02, wood, 0, 0.78, -2.62, g);
    rbox(0.9, 0.5, 0.7, 0.08, hay, -0.3, 0.82, -1.9, g);
    for (const z of [-1.3, -0.95]) cyl(0.14, 0.14, 0.46, 12, mat('#d7dde3', { rough: 0.35 }), 0.45, 0.8, z, g);
    rbox(1.9, 0.14, 0.12, 0.05, chrome, 0, 0.45, 2.12, g);
    lamps(0.72, 2.11);
    for (const [x, z] of [[-0.86, 1.3], [0.86, 1.3], [-0.86, -1.6], [0.86, -1.6]]) carWheel(g, 0.36, 0.26, x, 0.36, z, wheels);
    driver = sitter(look, 0.38, 0.088, -0.05, DS, g);
    door = carDoor(g, 0.92, 0.66, 0.5, 0.95, 0.52, c1);
  } else if (kind === 'minibus') { // köy dolmuşu: tavanında çuvallar, içinde yolcular
    const white = mat('#f6f1e7');
    rbox(1.9, 0.62, 4.0, 0.14, white, 0, 0.66, 0, g);
    cabin(g, 1.78, 0.98, 3.8, 0.97, 0, white);
    rbox(1.94, 0.12, 4.02, 0.03, c2, 0, 0.82, 0, g);
    rbox(1.6, 0.1, 2.4, 0.03, mat('#5a4632'), 0, 2.06, -0.3, g); // tavan bagajı
    rbox(0.6, 0.3, 0.5, 0.06, mat('#c9a35a'), -0.3, 2.26, -0.8, g);
    rbox(0.5, 0.26, 0.6, 0.06, mat('#8a6a4a'), 0.35, 2.24, 0.1, g);
    for (const z of [2.04, -2.04]) rbox(1.96, 0.14, 0.12, 0.05, chrome, 0, 0.42, z, g);
    lamps(0.7, 2.02, 0.62);
    for (const [x, z] of [[-0.9, 1.35], [0.9, 1.35], [-0.9, -1.35], [0.9, -1.35]]) carWheel(g, 0.36, 0.26, x, 0.36, z, wheels);
    driver = sitter(look, 0.42, 0.2, 1.2, DS, g);
    for (const [x, z] of [[-0.42, 0.2], [0.42, -0.8], [-0.42, -1.3]]) if (Math.random() < 0.7) sitter(villagerLook(), x, 0.18, z, DS, g);
    door = carDoor(g, 0.97, 0.75, 1.8, 0.9, 0.6, white);
  } else if (kind === 'tractor') { // traktör ve samanlı römork
    const body = mat(o.color || rpick(['#c0392b', '#2f8e3a', '#2f6db5', '#e67e22']));
    rbox(0.95, 0.7, 1.5, 0.12, body, 0, 0.95, 0.75, g);
    rbox(0.8, 0.5, 0.05, 0.02, mat('#3a3a3a'), 0, 0.95, 1.5, g);
    cyl(0.07, 0.07, 0.7, 8, mat('#3a3a3a'), 0.3, 1.55, 1.1, g);
    for (const sx of [-1, 1]) rbox(0.5, 0.08, 1.2, 0.03, body, sx * 0.75, 1.25, -0.45, g);
    rbox(0.55, 0.12, 0.5, 0.03, mat('#3a3a3a'), 0, 1.02, -0.45, g);
    mesh(cached('steer', () => new THREE.TorusGeometry(0.18, 0.03, 6, 14)), mat('#2a2a2a'), 0, 1.4, 0.05, g).rotation.x = -1.0;
    carWheel(g, 0.62, 0.36, -0.75, 0.62, -0.45, wheels); carWheel(g, 0.62, 0.36, 0.75, 0.62, -0.45, wheels);
    carWheel(g, 0.32, 0.22, -0.55, 0.32, 1.2, wheels); carWheel(g, 0.32, 0.22, 0.55, 0.32, 1.2, wheels);
    rbox(1.7, 0.12, 2.2, 0.03, wood, 0, 0.66, -2.7, g);
    for (const sx of [-1, 1]) rbox(0.07, 0.35, 2.2, 0.02, wood, sx * 0.82, 0.86, -2.7, g);
    rbox(1.7, 0.35, 0.07, 0.02, wood, 0, 0.86, -3.78, g);
    for (const [x, z] of [[-0.4, -2.3], [0.4, -2.3], [0, -3.1]]) rbox(0.7, 0.45, 0.55, 0.08, hay, x, 0.95, z, g);
    rbox(0.1, 0.08, 0.9, 0.02, mat('#3a3a3a'), 0, 0.6, -1.4, g);
    carWheel(g, 0.36, 0.24, -0.92, 0.36, -2.7, wheels); carWheel(g, 0.36, 0.24, 0.92, 0.36, -2.7, wheels);
    driver = sitter(look, 0, 0.5, -0.42, DS, g);
    speed = 4.2;
  } else { // eşek arabası
    donkey = makeDonkey(); donkey.position.z = 1.35; g.add(donkey);
    const cart = makeCart(); cart.position.z = -0.35; g.add(cart);
    wheels.push(...cart.userData.wheels);
    driver = sitter(look, 0, 0.28, 0.05, DS, g);
    speed = 3.2;
  }
  g.scale.setScalar(K);
  g.userData = { wheels, driver, door, speed, donkey, kind, look };
  return g;
}

// tarla korkuluğu
export function makeScarecrow() {
  const g = new THREE.Group();
  const wood = mat('#8b5a2b');
  cyl(0.05, 0.05, 1.8, 6, wood, 0, 0.9, 0, g);
  rbox(1.1, 0.06, 0.06, 0.02, wood, 0, 1.35, 0, g);
  caps(0.2, 0.35, mat('#c0504d'), 0, 1.25, 0, g);
  sph(0.18, mat('#f0d38a'), 0, 1.75, 0, g, 10, 8);
  cyl(0.32, 0.32, 0.03, 14, mat('#c9a35a'), 0, 1.88, 0, g);
  cyl(0.14, 0.17, 0.16, 10, mat('#c9a35a'), 0, 1.96, 0, g);
  return g;
}

// ---------- doğa ----------
// köy meydanı fıskiyesi: sekizgen taş havuz, iki katlı tas; ortadan su fışkırır, damlalar taslara ve havuza düşer
// eski taş gövde (Poly Pizza çeşmesi yüklenemezse)
function makeFiskiyeStone(g) {
  const stone = mat('#efe6d6', { map: texRep('cobble', 3, 0.6) }), rim = mat('#d9ccb4'), water = mat('#7fd0ec', { rough: 0.1 });
  cyl(2.05, 2.15, 0.55, 16, stone, 0, 0.275, 0, g);
  cyl(1.86, 1.86, 0.04, 24, water, 0, 0.5, 0, g);
  const lip = mesh(cached('fisLip', () => new THREE.TorusGeometry(1.97, 0.1, 6, 32)), rim, 0, 0.56, 0, g); lip.rotation.x = PI / 2;
  cyl(0.28, 0.38, 1.1, 12, stone, 0, 0.95, 0, g);
  cyl(0.95, 0.55, 0.22, 16, rim, 0, 1.5, 0, g); cyl(0.86, 0.86, 0.03, 16, water, 0, 1.6, 0, g);
  cyl(0.14, 0.2, 0.55, 10, stone, 0, 1.85, 0, g);
  cyl(0.5, 0.3, 0.16, 14, rim, 0, 2.15, 0, g); cyl(0.42, 0.42, 0.03, 14, water, 0, 2.22, 0, g);
}
// yeni çeşmede su yükseklikleri: dış havuz, orta kâse, halkalar (görüntüyle ölçüldü)
const FIS_Y = [0.4, 1.3, 0.4];
export function makeFiskiye() {
  const g = new THREE.Group();
  const body = esya('fiskiye'); // Poly Pizza çeşmesi (esya.js): taş gövde onun; jet, damlalar ve halkalar aşağıdaki eski çizim
  const H = body ? body.userData.h : 2.3, Y = body ? FIS_Y : [0.54, 1.62, 0.53];
  if (body) g.add(body);
  else makeFiskiyeStone(g);
  const wm = new THREE.MeshStandardMaterial({ color: '#d4f1ff', transparent: true, opacity: 0.78, emissive: '#9fdcff', emissiveIntensity: 0.3, roughness: 0.1, depthWrite: false });
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.09, 1, 8), wm); g.add(jet);
  const dropGeo = new THREE.SphereGeometry(0.05, 6, 4), drops = [];
  for (let i = 0; i < 30; i++) { const d = new THREE.Mesh(dropGeo, wm); d.userData = { a: (i / 30) * PI * 2 + Math.random() * 0.2, ph: Math.random(), far: i % 2 }; g.add(d); drops.push(d); }
  const ringM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), ripples = [];
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(cached('fisRip', () => new THREE.RingGeometry(0.85, 1, 24)), ringM.clone()); r.rotation.x = -PI / 2; r.position.y = Y[2]; r.userData.ph = i / 4; g.add(r); ripples.push(r); }
  const TOP = H;
  g.userData.tick = (t) => {
    const h = 1.05 + Math.sin(t * 5) * 0.08;
    jet.scale.y = h; jet.position.y = TOP + h / 2;
    for (const d of drops) {
      const u = d.userData, k = ((t * 0.9 + u.ph) % 1), rEnd = u.far ? 1.6 : 0.82, yEnd = u.far ? Y[0] : Y[1], top = TOP + h;
      d.position.set(Math.cos(u.a) * rEnd * k, top * (1 - k) + yEnd * k + 0.55 * 4 * k * (1 - k), Math.sin(u.a) * rEnd * k);
    }
    for (const r of ripples) { const k = (t * 0.45 + r.userData.ph) % 1; r.scale.setScalar(0.3 + k * 1.55); r.material.opacity = 0.45 * (1 - k); }
  };
  g.traverse((o) => { if (o.isMesh && o.material !== wm && !o.material.transparent) o.castShadow = true; });
  return g;
}
// meydan bankı: ahşap oturak ve sırtlık, dökme demir ayaklar; önü +z
export function makeBench() {
  const g = new THREE.Group(), wood = mat('#ffffff', { map: texRep('wood', 1, 0.3) }), iron = mat('#3a3a40', { rough: 0.5 });
  for (const z of [-0.12, 0.08, 0.28]) rbox(1.6, 0.06, 0.17, 0.02, wood, 0, 0.46, z, g);
  for (const y of [0.68, 0.86]) { const b = rbox(1.6, 0.13, 0.05, 0.02, wood, 0, y, -0.26, g); b.rotation.x = -0.12; }
  for (const x of [-0.68, 0.68]) { rbox(0.07, 0.46, 0.52, 0.02, iron, x, 0.23, 0.06, g); rbox(0.06, 0.52, 0.06, 0.01, iron, x, 0.72, -0.28, g); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// meydan güvercini: gri gövde, yeşil boyun parıltısı, gagalarken başını eğer
export function makePigeon() { return tagAnimal(rawPigeon(), 'guvercin'); } // albüm: hayvan kaydı (album.js)
function rawPigeon() {
  if (hasAnimal('guvercin')) return animal('guvercin');
  const g = new THREE.Group(), grey = mat('#9aa1ad', { flat: true }), dark = mat('#5d6470', { flat: true });
  const body = sph(0.13, grey, 0, 0.15, 0, g, 8, 6); body.scale.set(0.8, 0.75, 1.25);
  for (const sx of [-1, 1]) { const w = sph(0.1, dark, sx * 0.08, 0.17, -0.03, g, 6, 5); w.scale.set(0.35, 0.6, 1.3); }
  rbox(0.1, 0.02, 0.15, 0.01, dark, 0, 0.16, -0.19, g);
  const head = new THREE.Group(); head.position.set(0, 0.25, 0.12); g.add(head);
  sph(0.075, mat('#6fae9a', { flat: true }), 0, -0.05, -0.01, head, 8, 6);
  sph(0.065, dark, 0, 0.01, 0.02, head, 8, 6);
  const beak = cyl(0.008, 0.022, 0.06, 5, mat('#e8c27a'), 0, 0, 0.09, head); beak.rotation.x = PI / 2;
  for (const sx of [-1, 1]) cyl(0.012, 0.012, 0.09, 4, mat('#e07a7a'), sx * 0.04, 0.045, 0, g);
  g.userData.head = head;
  return g;
}

// para yığınının kasa tezgahı: ahşap tezgah, üstünde yazar kasa; para tezgahın sol yanına dizilir. Önü +z
export function makeCashDesk() {
  const g = new THREE.Group(), wood = mat('#ffffff', { map: texRep('wood', 1, 0.5) });
  rbox(1.5, 0.9, 0.75, 0.06, wood, 0, 0.45, 0, g);
  rbox(1.6, 0.07, 0.85, 0.03, mat('#f7e2c4'), 0, 0.93, 0, g);
  rbox(1.52, 0.12, 0.04, 0.02, mat('#56c27e'), 0, 0.72, 0.39, g);
  // ekran masanın arkasında duran kasiyere (-z) bakar; yeşil şeritli ön yüz müşteriye (+z)
  rbox(0.36, 0.22, 0.3, 0.05, mat('#3d4552'), 0.5, 1.08, 0.16, g);
  const sc = rbox(0.28, 0.16, 0.04, 0.02, mat('#9fe3ff', { emissive: '#6fd0ff', ei: 0.35 }), 0.5, 1.27, 0.27, g); sc.rotation.x = 0.4;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// yazarkasa: satış tezgahının üstünde, paranın yanında
export function makeRegister() {
  const v = esya('yazarkasa'); // Poly Pizza yazar kasası (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  rbox(0.36, 0.2, 0.3, 0.05, mat('#3d4552'), 0, 0.1, 0, g);
  const sc = rbox(0.28, 0.16, 0.04, 0.02, mat('#9fe3ff', { emissive: '#6fd0ff', ei: 0.35 }), 0, 0.3, -0.1, g); sc.rotation.x = -0.4;
  rbox(0.3, 0.05, 0.12, 0.02, mat('#f2f2f2'), 0, 0.03, 0.17, g);
  return g;
}
// satış tezgahının kasa ucu: tezgahın parçası olarak ucuna eklenir (ayrı masa değil), üstünde yazarkasa; para tezgahta birikir.
// reg: yazarkasanın uçtaki yeri [x, z] (derin uçta arkada, sığ uçta yanda)
export function makeCashLedge(w = 0.75, d = 1.5, h = 0.9, reg = [0, -d / 2 + 0.25]) {
  const g = new THREE.Group();
  rbox(w, h, d, 0.05, mat('#ffffff', { map: texRep('wood', 0.5, 0.6) }), 0, h / 2, 0, g);
  rbox(w + 0.06, 0.06, d + 0.06, 0.02, mat('#f7e2c4'), 0, h + 0.03, 0, g);
  const r = makeRegister(); r.position.set(reg[0], h + 0.06, reg[1]); g.add(r);
  g.userData.register = r; // kurulunca faceRegister ile tezgahtaki elemana çevrilir
  return g;
}
// yazarkasayı (ekranı ve fiş yuvası +z'de) arkasında duran elemana çevirir: müşteri yazarkasanın arkasını görür.
// Ebeveyn grubu döndürülmüş olsa da dünya konumuna göre hesaplar
export function faceRegister(r, x, z) {
  r.parent.updateWorldMatrix(true, false);
  const p = r.getWorldPosition(new THREE.Vector3());
  const py = new THREE.Euler().setFromQuaternion(r.parent.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
  r.rotation.y = Math.atan2(x - p.x, z - p.z) - py;
}
// süt güğümü: köy sütü ahırda sağılır, güğümde satılır
export function makeMilkCan() {
  const g = new THREE.Group(), steel = mat('#d7dde3', { rough: 0.3 });
  cyl(0.12, 0.13, 0.26, 12, steel, 0, 0.13, 0, g);
  cyl(0.07, 0.12, 0.08, 12, steel, 0, 0.3, 0, g);
  cyl(0.075, 0.075, 0.06, 12, mat('#3d7dd8'), 0, 0.37, 0, g);
  const h = mesh(cached('canH', () => new THREE.TorusGeometry(0.07, 0.012, 5, 12, PI)), mat('#8b939c'), 0, 0.4, 0, g); h.rotation.z = 0;
  return g;
}

// Köydeki yapraklı ağaçlar sırayla türlenir (2026-11-04): yuvarlak ağaç, meşe, zeytin, kavak. Tepe genişliği ~3,5 m'yi geçmez,
// tezgâh ve yolların üstüne taşmaz (meşe köyde 0,8 boy: tepesi gövdeden biraz yana kayık); geniş salkım söğüt yalnız ormanda ve nehir kıyısında (decor.js). leaf: tepenin ortası (mevsim.js)
const KOY_TUR = ['agac', 'mese', 'agac', 'zeytin', 'kavak', 'agac', 'mese', 'zeytin'], TUR_LEAF = { mese: 2.9, zeytin: 2.4, kavak: 4.2 };
let turN = 0;
export function makeTree(kind = 0, s = 1) {
  if (kind === 2 && hasNature('cam')) return nature('cam', { s });
  if (kind !== 2) {
    const k = KOY_TUR[turN++ % KOY_TUR.length];
    if (k !== 'agac' && hasNature(k)) { const o = nature(k, { s: k === 'mese' ? 0.8 * s : s }); o.userData.leafTree = TUR_LEAF[k]; return o; }
  }
  if (kind !== 2 && hasNature('agac')) { // yaprak oyunun yeşilleri
    const o = nature('agac', { s, tint: { Tree_Green: kind === 1 ? '#7cc76a' : '#5dbb63', Tree_Wood: '#8b5a2b' } });
    o.userData.leafTree = 2.9 * s; // tepenin ortası: sonbaharda yaprak, ilkbaharda çiçek yaprağı buradan kopar (mevsim.js)
    return o;
  }
  s *= 1.2; // karakter 2,05 boyunda: ağaç ~3,5 (eskisi karakterin ancak 1,4 katıydı)
  const g = new THREE.Group();
  cyl(0.13 * s, 0.2 * s, 1.2 * s, 7, mat('#8b5a2b'), 0, 0.6 * s, 0, g);
  if (kind === 2) {
    const c = mat('#4f9e5a', { flat: true });
    for (let i = 0; i < 3; i++) {
      const geo = cached(`cone${i}`, () => new THREE.ConeGeometry(1 - i * 0.22, 1.2, 8));
      mesh(geo, c, 0, (1.4 + i * 0.6) * s, 0, g).scale.setScalar(s);
    }
    return g;
  }
  const greens = kind === 1 ? ['#7cc76a', '#93d873', '#6bb55c'] : ['#5dbb63', '#72cc6c', '#4fae58'];
  ico(0.95 * s, mat(greens[0], { flat: true }), 0, 1.75 * s, 0, g);
  ico(0.7 * s, mat(greens[1], { flat: true }), 0.45 * s, 2.25 * s, 0.15 * s, g);
  ico(0.62 * s, mat(greens[2], { flat: true }), -0.4 * s, 2.05 * s, -0.25 * s, g);
  g.userData.leafTree = 2.0 * s; // mevsim.js yaprakları
  return g;
}

export function makeBush(s = 1, col = '#68c15f') {
  if (hasNature('cali')) return nature('cali', { s });
  const g = new THREE.Group();
  ico(0.5 * s, mat(col, { flat: true }), 0, 0.38 * s, 0, g);
  ico(0.38 * s, mat(col, { flat: true }), 0.42 * s, 0.3 * s, 0.1 * s, g);
  ico(0.34 * s, mat(col, { flat: true }), -0.38 * s, 0.28 * s, -0.08 * s, g);
  return g;
}

export function makeFlowers(r = Math.random) {
  if (hasNature('cicek')) { const w = new THREE.Group(), f = nature('cicek'); f.rotation.y = r() * PI * 2; w.add(f); return w; } // put() dönüşü dıştaki gruba
  const g = new THREE.Group();
  const cols = ['#ff6f91', '#ffd23f', '#ffffff', '#c77dd8', '#ff9f43'];
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.5) * 1.2, z = (r() - 0.5) * 1.2;
    cyl(0.02, 0.02, 0.3, 4, mat('#4f9e5a'), x, 0.15, z, g);
    sph(0.08, mat(cols[Math.floor(r() * cols.length)]), x, 0.32, z, g, 8, 6);
  }
  return g;
}

export function makeRock(s = 1, col = '#b9b3a8') {
  if (hasNature('kaya')) return nature('kaya', { s, tint: col });
  const g = new THREE.Group();
  const m = ico(0.5 * s, mat(col, { flat: true }), 0, 0.25 * s, 0, g, 0);
  m.scale.set(1.2, 0.7, 1);
  return g;
}

export function makeFence(len, axis = 'x', col = '#d9a066') {
  const g = new THREE.Group();
  if (hasBuilding('cit')) { // GLB çit parçaları boydan boya dizilir, uzunluğa tam otursun diye enine biraz esner
    const row = new THREE.Group(), L0 = buildingSize('cit').x, n = Math.max(1, Math.round(len / 3.2));
    for (let i = 0; i < n; i++) {
      const p = building('cit', { tint: { Brown: col } });
      p.scale.x = len / (n * L0); p.position.x = -len / 2 + ((i + 0.5) * len) / n; row.add(p);
    }
    if (axis !== 'x') row.rotation.y = PI / 2;
    g.add(row);
    return g;
  }
  const m = mat(col, { map: texRep('wood', 0.5, 0.5) });
  const n = Math.max(2, Math.round(len / 1.4) + 1);
  // karakterin beline gelen boyda (1,25): engel olduğu uzaktan belli olur, sahneye derinlik katar
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + (len * i) / (n - 1);
    rbox(0.17, 1.25, 0.17, 0.05, m, axis === 'x' ? t : 0, 0.62, axis === 'x' ? 0 : t, g);
    rbox(0.22, 0.08, 0.22, 0.03, m, axis === 'x' ? t : 0, 1.27, axis === 'x' ? 0 : t, g); // dikme başlığı
  }
  for (const y of [0.38, 0.74, 1.08]) {
    if (axis === 'x') rbox(len, 0.1, 0.07, 0.03, m, 0, y, 0, g);
    else rbox(0.07, 0.1, len, 0.03, m, 0, y, 0, g);
  }
  return g;
}

export function makeHay() {
  const g = new THREE.Group();
  const c = cyl(0.5, 0.5, 0.9, 16, mat('#f0cf63'), 0, 0.5, 0, g);
  c.rotation.z = PI / 2;
  for (const x of [-0.25, 0.25]) { const b = cyl(0.51, 0.51, 0.06, 16, mat('#c99a3a'), x, 0.5, 0, g); b.rotation.z = PI / 2; }
  return g;
}

export function makeWell() {
  if (hasBuilding('kuyu')) return building('kuyu');
  const g = new THREE.Group();
  const stone = mat('#cfc6b6', { map: texRep('cobble', 1, 0.4) });
  cyl(0.8, 0.85, 0.8, 14, stone, 0, 0.4, 0, g);
  cyl(0.66, 0.66, 0.05, 14, mat('#3f88b8', { rough: 0.2 }), 0, 0.72, 0, g);
  const wood = mat('#a8703f');
  for (const x of [-0.7, 0.7]) rbox(0.12, 1.5, 0.12, 0.04, wood, x, 1.2, 0, g);
  const roof = mesh(cached('wellroof', () => new THREE.ConeGeometry(1.15, 0.7, 4)), mat('#c8643b', { flat: true }), 0, 2.25, 0, g);
  roof.rotation.y = PI / 4;
  return g;
}

export function makeLamp(col = '#3a4250') {
  if (hasBuilding('lamba')) return building('lamba'); // GLB fenerli direk (kendi dokusu; col eski kod lambası için)
  const g = new THREE.Group();
  cyl(0.06, 0.09, 3, 8, mat(col), 0, 1.5, 0, g);
  sph(0.22, mat('#fff3c4', { emissive: '#ffe08a', ei: 0.6 }), 0, 3.1, 0, g, 12, 10);
  cyl(0.28, 0.12, 0.12, 10, mat(col), 0, 3.3, 0, g);
  return g;
}

// ---------- ürün (kod) ----------
// ham mısır: yeşil yapraklı koçan (kazanda haşlanır)
export function makeHusk() {
  const v = esya('kocan'); // Poly Pizza mısır koçanı (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  const cob = caps(0.07, 0.2, mat('#f6c343'), 0, 0.08, 0, g); cob.rotation.z = PI / 2;
  const leaf = mat('#7cbf4a', { flat: true });
  for (const [a, y, z] of [[0.35, 0.05, 0.05], [-0.35, 0.05, -0.05], [0, 0.11, 0]]) { const l = caps(0.045, 0.24, leaf, -0.05, y, z, g); l.rotation.z = PI / 2 + a * 0.25; l.rotation.y = a; }
  g.userData.h = 0.17;
  return g;
}
// buğday demeti: yatık, ortası bağlı
export function makeWheat() {
  const v = esya('bugday'); // Poly Pizza buğdayı (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  const stem = mat('#d9b25a'), ear = mat('#e8c46a', { flat: true });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI * 2, r = i ? 0.045 : 0, y = 0.08 + Math.sin(a) * r, z = Math.cos(a) * r;
    cyl(0.013, 0.013, 0.36, 4, stem, -0.05, y, z, g).rotation.z = PI / 2;
    caps(0.026, 0.08, ear, 0.18, y, z, g).rotation.z = PI / 2;
  }
  cyl(0.066, 0.066, 0.05, 10, mat('#a0522d'), -0.04, 0.08, 0, g).rotation.z = PI / 2;
  g.userData.h = 0.16;
  return g;
}

// yün yumağı: kabarık, kırık beyaz
export function makeWool() {
  const g = new THREE.Group();
  const w = mat('#fbf6ec', { flat: true }), w2 = mat('#f1e8d6', { flat: true });
  ico(0.14, w, 0, 0.12, 0, g, 1);
  for (const [x, y, z, r] of [[0.1, 0.1, 0.03, 0.09], [-0.1, 0.1, -0.02, 0.09], [0.02, 0.2, 0.05, 0.08], [-0.03, 0.09, 0.1, 0.07]]) ico(r, w2, x, y, z, g, 1);
  g.userData.h = 0.24;
  return g;
}

// koyun sütü: küçük cam şişe, mavi kapak, açık mavi etiket
export function makeSheepMilk() {
  const g = new THREE.Group();
  const glass = mat('#fbfbf6', { rough: 0.3 });
  cyl(0.1, 0.11, 0.28, 12, glass, 0, 0.14, 0, g);
  cyl(0.05, 0.095, 0.09, 12, glass, 0, 0.32, 0, g);
  cyl(0.058, 0.058, 0.05, 12, mat('#3d7dd8'), 0, 0.385, 0, g);
  cyl(0.113, 0.113, 0.09, 12, mat('#7fc4e8'), 0, 0.15, 0, g);
  g.userData.h = 0.42;
  return g;
}
// un çuvalı: beyaz bez çuval, ağzı bağlı, üstünde mavi şerit
export function makeFlourSack() {
  const g = new THREE.Group();
  const s = sph(0.2, mat('#f4f1ea'), 0, 0.18, 0, g, 12, 10); s.scale.set(1, 0.95, 0.75);
  cyl(0.07, 0.11, 0.1, 10, mat('#e9e3d6'), 0, 0.38, 0, g);
  rbox(0.3, 0.05, 0.02, 0.01, mat('#3d7dd8'), 0, 0.2, 0.15, g);
  g.userData.h = 0.36;
  return g;
}
// simit: susamlı halka
export function makeSimit() {
  const g = new THREE.Group();
  const t = mesh(cached('simitgeo', () => new THREE.TorusGeometry(0.15, 0.05, 8, 18)), mat('#b9692e'), 0, 0.05, 0, g); t.rotation.x = PI / 2;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; sph(0.012, mat('#f6e7c1'), Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15, g, 4, 3); }
  g.userData.h = 0.1;
  return g;
}
// poğaça: altın sarısı yumuşak çörek, üstü yumurtalı parlak
export function makePogaca() {
  const g = new THREE.Group();
  const b = sph(0.14, mat('#e3a64f', { rough: 0.5 }), 0, 0.08, 0, g, 12, 10); b.scale.set(1.15, 0.65, 0.9);
  sph(0.01, mat('#2a2a2a'), 0.03, 0.17, 0.02, g, 4, 3); sph(0.01, mat('#2a2a2a'), -0.04, 0.165, -0.02, g, 4, 3); // çörek otu
  g.userData.h = 0.16;
  return g;
}
// saman balyası: sarı dikdörtgen balya, iki koyu iple bağlı (at ahırı)
// tatil köyü: katlanmış havlu yığını (çizgili) ve bağlı kirli çamaşır bohçası
export function makeTowel() {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const c = i ? '#5fb6e0' : '#ffffff';
    rbox(0.42, 0.11, 0.3, 0.05, mat(c), 0, 0.06 + i * 0.12, 0, g);
    rbox(0.43, 0.03, 0.06, 0.01, mat(i ? '#ffffff' : '#5fb6e0'), 0, 0.06 + i * 0.12, 0.1, g);
  }
  return g;
}
export function makeLinen() {
  const v = esya('carsaf'); // Poly Pizza katlı çamaşır yığını (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  sph(0.22, mat('#9aa7b8', { flat: true }), 0, 0.17, 0, g, 8, 6).scale.set(1.2, 0.8, 1);
  sph(0.12, mat('#b8c2cf', { flat: true }), 0.08, 0.34, 0.02, g, 7, 5);
  rbox(0.04, 0.05, 0.3, 0.01, mat('#c8643b'), 0, 0.3, 0, g);
  return g;
}

export function makeHayBale() {
  const g = new THREE.Group();
  rbox(0.5, 0.26, 0.32, 0.05, mat('#e8c45a'), 0, 0.13, 0, g);
  for (const x of [-0.12, 0.12]) rbox(0.03, 0.275, 0.335, 0.01, mat('#a8742f'), x, 0.13, 0, g);
  for (const [x, z] of [[-0.2, 0.17], [0.05, 0.17], [0.18, -0.17]]) rbox(0.05, 0.02, 0.02, 0.005, mat('#f4dc8a'), x, 0.2, z, g); // çıkan saplar
  g.userData.h = 0.27;
  return g;
}
// koyun yoğurdu: toprak çanak, üstü kaymaklı beyaz
export function makeYogurt() {
  const g = new THREE.Group();
  cyl(0.16, 0.12, 0.2, 14, mat('#c8763f'), 0, 0.1, 0, g);
  cyl(0.165, 0.165, 0.03, 14, mat('#a85f2e'), 0, 0.2, 0, g);
  const top = sph(0.15, mat('#fffdf3'), 0, 0.2, 0, g, 14, 8); top.scale.y = 0.35;
  g.userData.h = 0.27;
  return g;
}
// kilim: rulo halı, enine bantlı, uçlarında saçak
export function makeKilim() {
  const g = new THREE.Group();
  const roll = mesh(cached('kilimroll', () => new THREE.CylinderGeometry(0.12, 0.12, 0.62, 14)), mat('#ffffff', { map: stripes('#c8463a', '#f0c35a', 6) }), 0, 0.12, 0, g);
  roll.rotation.z = PI / 2;
  for (const x of [-0.32, 0.32]) { const f = cyl(0.11, 0.11, 0.04, 14, mat('#f3e3c0'), x, 0.12, 0, g); f.rotation.z = PI / 2; }
  g.userData.h = 0.24;
  return g;
}
// dokuma tezgahı: ahşap çerçeve, yarısı dokunmuş kilim, üstte gergin renkli iplikler
export function makeLoom() {
  const g = new THREE.Group();
  const wood = mat('#ffffff', { map: texRep('wood', 1, 0.5) });
  rbox(2.7, 0.08, 0.9, 0.03, mat('#8a5a2e'), 0, 0.04, 0.1, g);
  for (const x of [-1.15, 1.15]) rbox(0.14, 1.9, 0.14, 0.04, wood, x, 0.95, 0, g);
  for (const y of [0.35, 1.85]) rbox(2.44, 0.14, 0.16, 0.04, wood, 0, y, 0, g);
  rbox(2.0, 0.85, 0.04, 0.01, mat('#ffffff', { map: stripes('#c8463a', '#f0c35a', 8) }), 0, 0.84, 0.02, g);
  for (let i = 0; i < 9; i++) rbox(0.025, 0.55, 0.025, 0.005, mat(['#c8463a', '#3d7dd8', '#f0c35a'][i % 3]), -0.9 + i * 0.225, 1.53, 0.02, g);
  // tezgahın önünde taburede oturan, yemenili dokumacı kadın; elleri tezgahta gidip gelir (animateLooms)
  rbox(0.5, 0.42, 0.42, 0.04, mat('#8a5a2e'), 0, 0.21, 0.78, g);
  const w = makeCharacter({ shirt: rpick(['#b23a48', '#7a3b6e', '#2f8e88', '#c0504d']), pants: '#5a3b6b', hat: 'scarf', hatColor: rpick(['#ffffff', '#f6d04d', '#e8c56a']), skin: rpick(['#e9b98f', '#f3cfae', '#d9a47a']) });
  w.position.set(0, -0.2, 0.78); w.rotation.y = PI; g.add(w);
  for (const l of w.userData.legs) l.rotation.x = -1.45;
  LOOMS.push({ w, ph: Math.random() * 6 });
  return g;
}
// dokumacı kadınlar: mekik atar gibi kollar sırayla öne uzanır, baş hafif sallanır
const LOOMS = [];
export function animateLooms(t) {
  for (const L of LOOMS) {
    const A = L.w.userData.arms, k = t * 4.2 + L.ph;
    A[0].rotation.x = -1.25 + Math.sin(k) * 0.28; A[1].rotation.x = -1.25 + Math.sin(k + PI) * 0.28;
    L.w.rotation.z = Math.sin(k * 0.5) * 0.04;
  }
}
// yoğurt küpü: büyük toprak küp, bez örtülü, ağzı iple bağlı
export function makeYogurtJar() {
  const g = new THREE.Group();
  const clay = mat('#c8763f', { flat: false }), band = mat('#a85f2e'), cloth = mat('#f2e6c8'), rope = mat('#8a6a3e'), stone = mat('#9a9288', { flat: true });
  // gövde tornada çekilmiş gibi: dar dip, geniş karın, boğaz ve dışa kıvrık ağız
  const P = [[0.001, 0.02], [0.38, 0], [0.52, 0.06], [0.66, 0.22], [0.75, 0.45], [0.78, 0.72], [0.76, 0.98], [0.68, 1.22], [0.55, 1.42], [0.44, 1.55], [0.4, 1.62], [0.43, 1.68], [0.48, 1.72], [0.47, 1.77], [0.4, 1.77]];
  mesh(cached('kupGovde', () => new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)), 22)), clay, 0, 0, 0, g);
  for (const [y, r] of [[0.98, 0.765], [0.5, 0.758]]) mesh(cached(`kupBant${r}`, () => new THREE.TorusGeometry(r, 0.022, 5, 28)), band, 0, y, 0, g).rotation.x = PI / 2; // kazıma bantlar
  for (const k of [-1, 1]) mesh(cached('kupKulp', () => new THREE.TorusGeometry(0.12, 0.035, 6, 10, PI)), clay, k * 0.6, 1.27, 0, g).rotation.z = -k * PI / 2; // iki kulp
  // ağız bezle örtülü, boğazına ip sarılı; bezin dört ucu sarkar
  sph(0.5, cloth, 0, 1.78, 0, g, 14, 8).scale.y = 0.3;
  for (let i = 0; i < 4; i++) {
    const a = i * (PI / 2) + PI / 4, f = rbox(0.24, 0.28, 0.02, 0.01, cloth, Math.cos(a) * 0.47, 1.64, Math.sin(a) * 0.47, g);
    f.rotation.order = 'YXZ'; f.rotation.set(0.28, PI / 2 - a, 0);
  }
  mesh(cached('kupIp', () => new THREE.TorusGeometry(0.43, 0.028, 5, 24)), rope, 0, 1.66, 0, g).rotation.x = PI / 2;
  sph(0.05, rope, 0.44, 1.66, 0.06, g, 6, 4);
  for (const k of [-1, 1]) { const e = cyl(0.014, 0.014, 0.24, 5, rope, 0.47, 1.54, 0.06 + k * 0.03, g); e.rotation.z = 0.15 * k; }
  // dibinde oturduğu düz taşlar
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.3; ico(0.17, stone, Math.cos(a) * 0.66, 0.05, Math.sin(a) * 0.66, g, 0).scale.y = 0.45; }
  return g;
}

// koyun: kabarık gövde, koyu yüz; otlarken başı eğilir, yürürken bacakları sallanır
export function makeSheep(col) { return tagAnimal(rawSheep(col), 'koyun'); } // albüm: hayvan kaydı (album.js)
function rawSheep(col = '#fbf6ec') {
  if (hasAnimal('koyun')) return animal('koyun', { tint: { White: col } });
  const g = new THREE.Group();
  const wool = mat(col, { flat: true }), face = mat('#3b3330'), ear = mat('#4a403c');
  const body = new THREE.Group(); body.position.y = 0.62; g.add(body);
  ico(0.42, wool, 0, 0, 0, body, 1).scale.set(1, 0.85, 1.25);
  for (const [x, y, z, r] of [[0.22, 0.14, 0.25, 0.26], [-0.22, 0.14, 0.2, 0.25], [0.18, 0.18, -0.25, 0.26], [-0.2, 0.16, -0.28, 0.25], [0, 0.3, 0, 0.28]]) ico(r, wool, x, y, z, body, 1);
  const head = new THREE.Group(); head.position.set(0, 0.78, 0.5); g.add(head);
  const fc = sph(0.17, face, 0, 0, 0.1, head, 12, 10); fc.scale.set(0.85, 0.95, 1.25);
  ico(0.15, wool, 0, 0.12, -0.02, head, 1);
  for (const x of [-0.17, 0.17]) { const e = sph(0.07, ear, x, 0.04, 0.02, head, 8, 6); e.scale.set(1.6, 0.6, 0.8); }
  for (const x of [-0.07, 0.07]) sph(0.025, mat('#ffffff'), x, 0.06, 0.28, head, 6, 4);
  const legs = [];
  for (const [x, z] of [[-0.2, 0.28], [0.2, 0.28], [-0.2, -0.28], [0.2, -0.28]]) {
    const l = new THREE.Group(); l.position.set(x, 0.42, z); g.add(l);
    cyl(0.055, 0.05, 0.42, 6, face, 0, -0.21, 0, l);
    legs.push(l);
  }
  g.userData = { head, legs, body };
  return g;
}

// kırkım barakası: açık önlü ahşap sundurma, içinde yün denkleri
export function makeShearShed() {
  const g = new THREE.Group();
  const wood = mat('#ffffff', { map: texRep('wood', 1.5, 0.6) }), dark = mat('#8a5a2e'), roof = mat('#c8643b', { flat: true });
  rbox(4.2, 0.18, 2.8, 0.05, dark, 0, 0.09, 0, g);
  rbox(4.2, 2.3, 0.16, 0.04, wood, 0, 1.25, -1.3, g);
  for (const x of [-2.0, 2.0]) rbox(0.16, 2.3, 2.7, 0.04, wood, x, 1.25, 0, g);
  const r = rbox(4.8, 0.14, 3.6, 0.05, roof, 0, 2.55, 0.05, g); r.rotation.x = -0.18;
  // yün denkleri: çuval bezine sarılı, iki iple bağlı, dikiş yerinden ve üstünden kabarık yün taşan balyalar
  const jute = mat('#c4a46c'), rope = mat('#6e4f2a'), seamM = mat('#93764a'), wool = mat('#fbf6ec', { flat: true }), wool2 = mat('#f1e8d6', { flat: true });
  for (const [x, z, open] of [[-1.3, -0.7, 0], [-0.3, -0.8, 1], [0.8, -0.75, 0], [-0.8, -0.2, 0]]) {
    const b = new THREE.Group(); b.position.set(x, 0.46, z); b.rotation.y = x * 0.4; g.add(b);
    rbox(0.8, 0.55, 0.6, 0.12, jute, 0, 0, 0, b);
    for (const sx of [-0.22, 0.22]) rbox(0.05, 0.57, 0.62, 0.02, rope, sx, 0, 0, b);
    rbox(0.72, 0.012, 0.02, 0.004, seamM, 0, 0.276, 0, b); // üstteki dikiş
    if (open) { for (const [tx, tz, r] of [[-0.1, 0.02, 0.17], [0.12, -0.04, 0.15], [0.02, 0.1, 0.13], [-0.25, -0.08, 0.11]]) ico(r, tx > 0 ? wool2 : wool, tx, 0.27, tz, b, 1).scale.y = 0.6; }
    else for (const [tx, ty, tz, r] of [[0.36, 0.2, 0.05, 0.1], [-0.08, 0.27, 0.0, 0.09], [0.1, 0.27, 0.02, 0.08], [-0.36, 0.18, -0.1, 0.08]]) ico(r, wool, tx, ty, tz, b, 1); // dikiş ve köşeden taşan yün
  }
  return g;
}

export function makeCucumber() {
  const g = new THREE.Group();
  const c = caps(0.085, 0.3, mat('#3f9b4a'), 0, 0.09, 0, g);
  c.rotation.z = PI / 2;
  for (let i = 0; i < 5; i++) sph(0.018, mat('#8fd17c'), -0.15 + i * 0.075, 0.17, (i % 2 ? 0.03 : -0.03), g, 6, 4);
  g.userData.h = 0.18;
  return g;
}

// ---------- köy ----------
export const SHOP_W = 21;
export function makeShop(W = SHOP_W, deco = true) {
  const g = new THREE.Group();
  rbox(W, 0.2, 9, 0.08, mat('#ffffff', { map: texRep('tiles', W / 2, 4.5) }), 0, 0.1, -8.5, g);
  const back = rbox(W + 0.4, 3.2, 0.4, 0.1, new THREE.MeshStandardMaterial({ map: plasterOf('#6fc7bb', W / 3, 1), roughness: 0.85 }), 0, 1.6, -13.2, g);
  const sides = [-1, 1].map((sx) => rbox(0.4, 1.1, 9.2, 0.1, new THREE.MeshStandardMaterial({ map: plasterOf('#6fc7bb', 3, 1), roughness: 0.85 }), sx * (W / 2 + 0.2), 0.55, -8.6, g));
  // tente
  const aw = mesh(cached(`shopaw${W}`, () => new THREE.CylinderGeometry(0.7, 0.7, W + 0.4, 18, 1, true, 0, PI)), new THREE.MeshStandardMaterial({ map: stripes('#e8604c', '#ffffff', 18), side: THREE.DoubleSide, roughness: 0.85 }), 0, 3.05, -12.85, g);
  aw.rotation.z = PI / 2; aw.scale.set(0.55, 1, 1);
  // tabela
  // tabela tentenin üstünde, iki direkte: önündeki raf reklamlarıyla çakışmaz
  for (const x of [-2.6, 2.6]) rbox(0.14, 1.2, 0.14, 0.04, mat('#8a5a33'), x, 3.9, -13.2, g);
  const sign = rbox(6.8, 1.2, 0.25, 0.12, new THREE.MeshStandardMaterial({ map: textTex('KÖY BAKKALI', { bg: '#e8604c', border: '#ffffff', w: 768, h: 144 }), roughness: 0.8 }), 0, 4.75, -13.05, g);
  sign.castShadow = false;
  // arka duvarda dekor rafları
  const shelfM = mat('#ffffff', { map: texRep('wood', 1, 0.3) });
  // reyonların (x ±2.6, ±7.8) arasındaki boşluklarda: uzun soğutucunun arka paneliyle çakışmaz
  for (const x of deco ? [-5.2, 5.2] : []) { // tek ürünlü raflarda arka sıra duvara kadar dolu: dekor rafı yok
    rbox(1.8, 0.08, 0.5, 0.03, shelfM, x, 1.7, -12.75, g);
    rbox(1.8, 0.08, 0.5, 0.03, shelfM, x, 2.3, -12.75, g);
  }
  g.userData = { sign, awning: aw, walls: [back, ...sides], W };
  return g;
}

// köy bakkalının tasarım seçenekleri (tasarim.js, 2026-11-08 kullanıcı: "büyürken zemin değiştiği aşamada zemini ve genel
// geliştirmede kişiselleştirme olsun"). G.custom.floor / wallSt / awningSt / signSt; seçilmeyen biçim aşamanın kendi görünüşüdür:
// köy dükkânı tahta zemin ve tahta duvar, bakkal ve sonrası karo zemin ve sıva. Biçim değişince bina yeniden kurulur (world.js restyle)
export const SHOP_LOOKS = { floor: ['ahsap', 'fayans', 'dama', 'mermer', 'toprak', 'cini'], wallSt: ['siva', 'tugla', 'tas', 'ahsap'], awningSt: ['kavis', 'duz', 'kiremit'], signSt: ['boya', 'ahsap', 'isikli', 'harf'] };
export function shopStyle(n, c = {}) {
  const pick = (k, d) => (SHOP_LOOKS[k].includes(c[k]) ? c[k] : d);
  return { floor: pick('floor', n === 1 ? 'ahsap' : 'fayans'), wall: pick('wallSt', n === 1 ? 'ahsap' : 'siva'), awning: pick('awningSt', 'kavis'), sign: pick('signSt', 'boya') };
}
const FLOOR_MAT = {
  ahsap: (W, D) => mat('#e2bf8f', { map: texRep('wood', W / 3, D / 3) }),
  fayans: (W, D) => mat('#ffffff', { map: texRep('tiles', W / 2, D / 2) }),
  dama: (W, D) => mat('#ffffff', { map: texRep('dama', W / 2.5, D / 2.5), rough: 0.6 }),
  mermer: (W, D) => mat('#ffffff', { map: texRep('mermer', W / 2.4, D / 2.4), rough: 0.4 }),
  toprak: (W, D) => mat('#ffffff', { map: texRep('toprak', W / 2, D / 2) }),
  cini: (W, D) => mat('#ffffff', { map: texRep('cini', W / 2, D / 2), rough: 0.6 }),
};
// binaya özgü malzeme: yeniden kurulunca atılır (disposeShop); sharedMap: dokusu önbellekte paylaşılan (stripes), doku atılmaz
const own = (o, sharedMap = false) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.85, ...o }); m.userData.own = true; m.userData.ownMap = !sharedMap; return m; };
function wallMatOf(style, w, h, c) {
  if (style === 'ahsap') return own({ map: texRep('wood', w / 3, (0.6 * h) / 2.6), color: '#d6a46a', roughness: 0.9 });
  if (style === 'tugla') return own({ map: texRep('tugla', w / 1.6, h / 1.6) });
  if (style === 'tas') return own({ map: texRep('tas', w / 2.4, h / 2.4), roughness: 0.95 });
  return own({ map: plasterOf(c.wall || '#6fc7bb', w / 3, 1) });
}
// tabela yüzü: boyalı (tente rengi), tahta levha (oyma harfler), ışıklı kutu (içi yanar), kabartma harf (zemini yok, harfler duvarda)
function signTex(style, name, c) {
  const col = c.awning || '#e8604c', size = Math.min(80, Math.floor(1300 / Math.max(6, name.length)));
  if (style === 'ahsap') return textTex(name, { bg: '#9a6436', grain: true, border: '#5e3b1f', fg: '#fff1d6', stroke: '#5e3b1f', w: 768, h: 144, r: 14, size });
  if (style === 'isikli') return textTex(name, { bg: '#fffaf0', border: col, fg: col, w: 768, h: 144, size });
  if (style === 'harf') return textTex(name, { bg: 'none', fg: col, stroke: '#ffffff', w: 768, h: 144, size: Math.round(size * 1.15) });
  return textTex(name, { bg: col, border: '#ffffff', w: 768, h: 144, size });
}
// iki köşeli eğik yüzey (düz tente, kiremit saçak): duvar dibinden (y0, z0) öne ve aşağıya (y1, z1)
function slope(x0, x1, y0, z0, y1, z1, uvAlongX) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, z0, x1, y0, z0, x1, y1, z1, x0, y1, z1], 3));
  // şeritli tentede bantlar x boyunca dizilsin: şerit dokusu v boyunca bantlı (stripes), u ile v yer değiştirir
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvAlongX ? [0, 0, 0, 1, 1, 1, 1, 0] : [0, 1, 1, 1, 1, 0, 0, 0], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}

// köy bakkalı aşamalı bina (dukkan-plan.md): s = { x0, x1, zf } iç zemin, door = { x, w } ön duvardaki kapı, c = G.custom (biçimler).
// 1 köy dükkânı: tahta zemin ve tahta kaplama alçak duvarlar, el boyası tabela. 2 bakkal: karo zemin, sıvalı duvar, tente.
// 3 köy marketi: desenli zemin, camlı ön cephe, ışıklı tabela, kapı tentesi, saksılar. Konumlar dünya koordinatında (grup 0'da).
export function makeShopStage(n, s, door, c = {}) {
  const g = new THREE.Group();
  const st = shopStyle(n, c);
  const W = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2, D = s.zf + 13.2, cz = (s.zf - 13.2) / 2;
  // zemin
  rbox(W + 0.4, 0.2, D, 0.08, FLOOR_MAT[st.floor](W, D), cx, 0.1, cz, g);
  if (n === 3) { // kapıdan kasaya ve koridorlara açık renkli yürüme şeridi, girişte paspas
    rbox(W - 1.2, 0.02, 0.9, 0.01, mat('#d8ecf3'), cx + 0.4, 0.215, s.zf - 2.5, g);
    rbox(1.9, 0.03, 1.1, 0.01, mat('#8a3b2e'), door.x, 0.22, s.zf - 0.7, g);
  }
  // arka duvar: tabelanın ve tentenin taşıyıcısı
  const bh = n === 1 ? 2.6 : 3.2;
  const back = rbox(W + 0.8, bh, 0.4, 0.1, wallMatOf(st.wall, W + 0.8, bh, c), cx, bh / 2, -13.2, g); back.userData.rx = W / 3;
  if (n === 3) rbox(W + 1.0, 0.25, 0.6, 0.06, mat('#f4efe6'), cx, bh + 0.1, -13.2, g); // saçak
  // ön ve yan duvar yok (kullanıcı 2026-10-28: "öndeki duvarlar da komple kalksın"): dükkân üç yandan açık, yalnız arka duvar.
  // Zeminin önüne ve iki yanına alçak bir basamak: yerden dükkâna yumuşak geçiş; köşelerde saksılar
  const sides = [], fronts = [];
  const d0 = door.x - door.w / 2, d1 = door.x + door.w / 2;
  const stepM = st.floor === 'ahsap' ? mat('#c9a77a', { map: texRep('wood', W / 3, 0.3) }) : mat(st.floor === 'toprak' ? '#d9b48c' : '#e8e2d6');
  rbox(W + 0.4, 0.1, 0.45, 0.04, stepM, cx, 0.05, s.zf + 0.22, g);
  for (const x of [s.x0 - 0.42, s.x1 + 0.42]) rbox(0.45, 0.1, D - 0.3, 0.04, stepM, x, 0.05, cz + 0.15, g);
  const potM = mat('#c96f4a'), leaf = mat('#4f9a3f', { rough: 0.8 });
  for (const [x, z] of [[s.x0 + 0.1, s.zf + 0.75], [s.x1 - 0.1, s.zf + 0.75]]) { cyl(0.32, 0.26, 0.5, 10, potM, x, 0.25, z, g); mesh(cached('potbush', () => new THREE.IcosahedronGeometry(0.42, 0)), leaf, x, 0.78, z, g); }
  // tente: arkada duvar boyunca. Kavisli (yarım silindir), düz (eğik bez ve dilimli fırfır), kiremit saçak (tahta payandalı)
  const x0 = cx - W / 2 - 0.2, x1 = cx + W / 2 + 0.2;
  let aw, valance = null;
  if (st.awning === 'duz') {
    aw = mesh(slope(x0, x1, bh - 0.08, -13.0, bh - 0.62, -11.65, true), own({ map: stripes('#e8604c', '#ffffff', 18), side: THREE.DoubleSide }, true), 0, 0, 0, g);
    const vt = scallop('#ffffff', '#e8604c', 8).clone(); vt.repeat.set(18 / 8, 1); vt.needsUpdate = true;
    valance = mesh(cached(`shopval${W}`, () => new THREE.PlaneGeometry(W + 0.4, 0.3)), own({ map: vt, side: THREE.DoubleSide, alphaTest: 0.5 }), cx, bh - 0.77, -11.65, g);
    valance.castShadow = false;
    for (const x of [x0 + 0.1, cx, x1 - 0.1]) { // tentenin altında iki ucu ve ortası eğik demir kol
      const arm = mesh(cached('shoparm', () => new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6)), mat('#3d4552'), x, bh - 0.75, -12.35, g);
      arm.rotation.x = -1.0; arm.castShadow = false;
    }
  } else if (st.awning === 'kiremit') {
    const rm = own({ map: texRep('roof', (W + 0.6) / 2.4, 0.6), side: THREE.DoubleSide, roughness: 0.9 });
    aw = mesh(slope(x0 - 0.1, x1 + 0.1, bh + 0.02, -13.05, bh - 0.58, -11.7, false), rm, 0, 0, 0, g);
    const woodM = mat('#8a5a33', { map: texRep('wood', 2, 0.2) });
    rbox(W + 0.7, 0.14, 0.08, 0.02, woodM, cx, bh - 0.64, -11.68, g); // saçak tahtası
    rbox(W + 0.7, 0.12, 0.16, 0.03, mat('#9c4a2a'), cx, bh + 0.05, -13.02, g); // mahya
    const nb = Math.max(2, Math.round(W / 4));
    for (let i = 0; i <= nb; i++) { // payandalar: duvardan saçağa eğik dikmeler
      const px = x0 + 0.15 + ((x1 - x0 - 0.3) * i) / nb;
      const b = rbox(0.1, 0.1, 1.45, 0.02, woodM, px, bh - 0.78, -12.4, g); b.rotation.x = 0.5;
    }
  } else {
    aw = mesh(cached(`shopaw${W}`, () => new THREE.CylinderGeometry(0.7, 0.7, W + 0.4, 18, 1, true, 0, PI)), own({ map: stripes('#e8604c', '#ffffff', 18), side: THREE.DoubleSide }, true), cx, bh - 0.15, -12.85, g);
    aw.rotation.z = PI / 2; aw.scale.set(0.55, 1, 1);
  }
  const awnings = [aw];

  // tabela: aşamaya göre boyu; yüzü seçilen biçimle (signTex)
  const sw = n === 1 ? 4.6 : n === 2 ? 6.8 : 8.6, sh = n === 1 ? 0.95 : n === 2 ? 1.2 : 1.45, sy = bh + (n === 1 ? 1.05 : 1.55);
  const metal = n === 3 || st.sign === 'isikli' || st.sign === 'harf';
  for (const x of [-sw * 0.38, sw * 0.38]) rbox(0.14, sy - bh + 0.2, 0.14, 0.04, mat(metal ? '#3d4552' : '#8a5a33'), cx + x, bh + (sy - bh) / 2 - 0.1, -13.2, g);
  const name = (c.name || 'Köy Bakkalı').toLocaleUpperCase('tr');
  let sign;
  if (st.sign === 'harf') { // kabartma harfler: ince bir demir kirişin önünde, zeminsiz
    rbox(sw * 0.9, 0.12, 0.16, 0.03, mat('#3d4552'), cx, sy - sh * 0.4, -13.06, g); // harfler kirişin üstüne oturur
    sign = mesh(cached(`shopsignp${sw}|${sh}`, () => new THREE.PlaneGeometry(sw, sh)), own({ map: signTex('harf', name, c), alphaTest: 0.4, roughness: 0.6 }), cx, sy, -13.02, g);
  } else if (st.sign === 'isikli') { // ışıklı kutu: koyu çerçeve, yüzü kendinden aydınlık
    rbox(sw + 0.16, sh + 0.16, 0.3, 0.06, mat('#3d4552'), cx, sy, -13.12, g);
    const m = own({ map: signTex('isikli', name, c), roughness: 0.5 }); m.emissiveMap = m.map; m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 0.55;
    sign = rbox(sw, sh, 0.25, 0.06, m, cx, sy, -13.0, g);
  } else {
    sign = rbox(sw, sh, 0.25, 0.12, own({ map: signTex(st.sign, name, c), roughness: 0.8 }), cx, sy, -13.05, g);
  }
  sign.castShadow = false;
  if (n === 3) { // tabelanın altında ışık şeridi ve iki spot
    rbox(sw + 0.2, 0.08, 0.3, 0.03, mat('#fff4c2', { emissive: '#ffe08a', ei: 0.9 }), cx, sy - sh / 2 - 0.1, -13.0, g);
    for (const x of [-sw * 0.3, sw * 0.3]) cyl(0.09, 0.14, 0.22, 8, mat('#3d4552'), cx + x, sy + sh / 2 + 0.16, -12.85, g);
  }
  // köy marketi: girişte ayaklı AÇIK panosu
  if (n === 3) {
    const open = rbox(0.9, 0.45, 0.05, 0.03, own({ map: textTex('AÇIK', { bg: '#3fae6b', border: '#ffffff', w: 256, h: 128 }), roughness: 0.7 }), d1 + 0.9, 1.0, s.zf + 0.9, g);
    open.castShadow = false;
    for (const dx of [-0.35, 0.35]) rbox(0.05, 0.85, 0.05, 0.01, mat('#3d4552'), d1 + 0.9 + dx, 0.42, s.zf + 0.92, g);
  }
  if (n === 1) { // köy dükkânı: kapı önünde sebze kasaları
    const crate = mat('#c98b52', { map: texRep('wood', 1, 0.5) });
    for (const [x, z] of [[d1 + 0.8, s.zf + 0.9], [d1 + 1.7, s.zf + 0.9]]) rbox(0.8, 0.4, 0.6, 0.03, crate, x, 0.2, z, g);
  }
  g.userData = { sign, awning: aw, awnings, valance, walls: [back, ...sides, ...fronts], W, stage: n, wood: st.wall === 'ahsap', style: st };
  return g;
}
// eski binanın kendine ait malzeme ve dokuları (önbellekteki paylaşılan dokular ve malzemeler atılmaz; texRep ve plasterOf klonu
// görüntüyü önbellekle paylaşır, klonu atmak önbellektekini bozmaz)
export function disposeShop(g) {
  g.traverse((o) => {
    const m = o.material;
    if (!m || !m.userData.own) return;
    if (m.map && m.userData.ownMap) m.map.dispose();
    m.dispose();
  });
}

// kişiselleştirme: tabela adı, tente ve duvar rengi (yalnız sıva duvar boyanır; kiremit saçak boyanmaz)
export function paintShop(g, c) {
  const u = g.userData, st = u.style || shopStyle(u.stage || 2, c);
  const name = (c.name || 'Köy Bakkalı').toLocaleUpperCase('tr');
  const sm = u.sign.material, old = sm.map;
  sm.map = signTex(st.sign, name, c);
  if (sm.emissiveMap) sm.emissiveMap = sm.map;
  sm.needsUpdate = true;
  if (old && old !== sm.map) old.dispose();
  if (st.awning !== 'kiremit') { u.awning.material.map = stripes(c.awning, '#ffffff', 18); u.awning.material.needsUpdate = true; }
  if (u.valance) {
    const vm = u.valance.material, o = vm.map, t = scallop('#ffffff', c.awning, 8).clone();
    t.repeat.set(18 / 8, 1); t.needsUpdate = true; vm.map = t; vm.needsUpdate = true; if (o) o.dispose();
  }
  if (st.wall !== 'siva') return;
  for (const w of u.walls) { const o = w.material.map; w.material.map = plasterOf(c.wall, w.userData.rx || 3, 1); w.material.needsUpdate = true; if (o) o.dispose(); }
}

export function decorShopShelves(g) {
  // arka duvar raflarına küçük ürünler
  const keys = ['cheese', 'carton', 'apple', 'orange', 'lemon', 'pumpkin'];
  let k = 0;
  for (const x of [-5.2, 5.2]) for (const y of [1.74, 2.34]) for (let i = 0; i < 3; i++) {
    const m = model(keys[k++ % keys.length]);
    m.position.set(x - 0.55 + i * 0.55, y, -12.72);
    g.add(m);
  }
}

// ---------- görünüm kademeleri (dukkan-plan.md) ----------
// Birimin gövdesi hep durur; kademe süsleri ayrı gruplarda: 'only' grubu yalnız kendi kademesinde, 'from' grubu o kademeden
// itibaren görünür. Gizlenen parçaların birleşimi perf.js'te kendiliğinden çözülür, yeni görünenler sonraki turda birleşir.
function lookGroups(g, modes) {
  const L = [null];
  for (let k = 1; k <= 3; k++) { const q = new THREE.Group(); q.name = `look${k}`; q.visible = false; q.userData.from = modes[k - 1] === 'from'; g.add(q); L.push(q); }
  g.userData.looks = L;
  return L;
}
export function setLook(unit, L) {
  const ls = unit.userData.looks;
  if (!ls || unit.userData.look === L) return false;
  unit.userData.look = L;
  for (let k = 1; k <= 3; k++) ls[k].visible = ls[k].userData.from ? L >= k : L === k;
  return true;
}
// raf: 1 tahta sandık raf, 2 boyalı raf (renkli süpürgelik), 3 metal market rafı (fiyat rayı, uç kapakları, arkada başlık levhası)
const LOOK_COL = { wood: '#e8604c', produce: '#3fae6b', eggs: '#f2c14e' };
function shelfLooks(g, w, kind) {
  const [, l1, l2, l3] = lookGroups(g, ['only', 'only', 'only']), col = LOOK_COL[kind] || '#e8604c';
  // önler etiketin (z 0,512) arkasında kalır
  if (kind !== 'produce') {
    rbox(w + 0.02, 0.84, 0.006, 0.002, mat('#8a5a33', { map: texRep('wood', 1.4, 0.4) }), 0, 0.44, 0.503, l1);
    for (const sx of [-1, 1]) rbox(0.1, 0.96, 1.04, 0.02, mat('#6e4526'), sx * (w / 2 + 0.02), 0.48, 0, l1);
  } else for (const sx of [-1, 1]) rbox(0.1, 0.96, 1.04, 0.02, mat('#6e4526'), sx * (w / 2 + 0.02), 0.48, 0, l1);
  rbox(w + 0.02, 0.72, 0.006, 0.002, mat('#fff3dc'), 0, 0.5, 0.503, l2);
  rbox(w + 0.04, 0.13, 0.05, 0.02, mat(col), 0, 0.065, 0.51, l2);
  rbox(w + 0.02, 0.8, 0.006, 0.002, mat('#d5dbe2'), 0, 0.46, 0.503, l3);
  rbox(w + 0.06, 0.07, 0.05, 0.02, mat(col), 0, 0.86, 0.53, l3); // fiyat rayı
  rbox(w + 0.06, 0.1, 0.05, 0.02, mat('#7d8894'), 0, 0.05, 0.52, l3); // süpürgelik
  for (const sx of [-1, 1]) rbox(0.06, 1.0, 1.06, 0.02, mat('#9aa5b1'), sx * (w / 2 + 0.03), 0.5, 0, l3);
  const head = new THREE.Group(); l3.add(head); g.userData.header = head;
  rbox(w - 0.1, 0.42, 0.05, 0.03, mat(col), 0, 0, 0, head);
  rbox(w - 0.3, 0.26, 0.02, 0.01, mat('#ffffff'), 0, 0, 0.03, head);
  for (const sx of [-1, 1]) rbox(0.05, 0.6, 0.05, 0.01, mat('#7d8894'), sx * (w / 2 - 0.2), -0.45, 0, head);
  placeHeader(g, 1);
}
// başlık levhası en üst katın arkasında
export function placeHeader(unit, tiers) {
  const h = unit.userData.header;
  if (h) h.position.set(0, 1.45 + (tiers - 1) * 0.42, -0.42 - (tiers - 1) * TIER_STEP);
}

// kasa bankosu: 1 tahta tezgah ve çekmeceli para kutusu, 2 yazarkasalı banko (ekran kasiyere döner), 3 bantlı modern kasa
export function makeCounter() {
  const g = new THREE.Group();
  rbox(2.6, 1.0, 1.1, 0.1, mat('#7fd1c7'), 0, 0.5, 0, g);
  rbox(2.75, 0.1, 1.2, 0.05, mat('#ffffff'), 0, 1.03, 0, g);
  const [, l1, l2, l3] = lookGroups(g, ['only', 'from', 'from']);
  // 1: tahta kaplama ve tahta para kutusu
  const plank = mat('#b77b46', { map: texRep('wood', 1.6, 0.6) });
  rbox(2.64, 0.96, 1.14, 0.08, plank, 0, 0.5, 0, l1);
  rbox(2.79, 0.1, 1.24, 0.05, mat('#8a5a33'), 0, 1.04, 0, l1);
  rbox(0.6, 0.22, 0.42, 0.03, mat('#7a4a2e'), -0.5, 1.2, 0.05, l1);
  rbox(0.5, 0.04, 0.3, 0.01, mat('#e8c56a'), -0.5, 1.32, 0.05, l1);
  // 2: yazarkasa; ekranı bankonun arkasındaki kasiyere (-z) bakar, müşteri önden (+z) gelir
  rbox(0.75, 0.4, 0.55, 0.08, mat('#3d4552'), -0.5, 1.28, 0.1, l2);
  const sc = rbox(0.55, 0.32, 0.06, 0.03, mat('#9fe3ff', { emissive: '#6fd0ff', ei: 0.35 }), -0.5, 1.62, 0.25, l2);
  sc.rotation.x = 0.3;
  rbox(0.5, 0.12, 0.35, 0.04, mat('#f2f2f2'), 0.55, 1.14, -0.05, l2);
  // 3: yürüyen bant, kart okuyucu, poşet askısı ve önde yeşil şerit
  rbox(1.3, 0.05, 0.62, 0.02, mat('#2e3742'), 0.55, 1.105, 0.05, l3);
  for (const x of [-0.08, 1.18]) cyl(0.04, 0.04, 0.62, 8, mat('#9aa5b1'), x, 1.12, 0.05, l3).rotation.x = PI / 2;
  rbox(0.16, 0.22, 0.1, 0.03, mat('#1d1f24'), -0.05, 1.2, 0.42, l3);
  rbox(0.12, 0.06, 0.02, 0.01, mat('#9fe3ff', { emissive: '#6fd0ff', ei: 0.5 }), -0.05, 1.27, 0.475, l3);
  rbox(2.62, 0.16, 0.006, 0.002, mat('#3fae6b'), 0, 0.75, 0.553, l3);
  for (const x of [1.15, 1.32]) rbox(0.03, 0.5, 0.03, 0.01, mat('#9aa5b1'), x, 1.32, -0.42, l3);
  setLook(g, 2);
  return g;
}

// ---------- ürüne göre reyonlar (marketlerden) ----------
// sebze: tahta kasalı manav tezgahı, kasaların altında yeşil manav çimi
// yumurta: kareli köy örtülü raf, her yerde bir viyol
// süt-peynir: camlı, ışıklı açık soğutucu (fridge, makeFridge)
let checkerT = null, viyolT = null;
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
}
const checkerTex = () => checkerT || (checkerT = canvasTex(64, 64, (g) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(214,58,58,0.55)'; g.fillRect(0, 0, 64, 16); g.fillRect(0, 32, 64, 16);
  g.fillStyle = 'rgba(214,58,58,0.55)'; g.fillRect(0, 0, 16, 64); g.fillRect(32, 0, 16, 64);
}, 6, 2));
const viyolTex = () => viyolT || (viyolT = canvasTex(192, 128, (g) => {
  g.fillStyle = '#ddd2bd'; g.fillRect(0, 0, 192, 128);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = 32 + i * 64, y = 32 + j * 64, r = g.createRadialGradient(x - 6, y - 6, 4, x, y, 26);
    r.addColorStop(0, '#b3a68c'); r.addColorStop(1, '#ddd2bd');
    g.fillStyle = r; g.beginPath(); g.arc(x, y, 25, 0, PI * 2); g.fill();
  }
}));

export function makeShelfUnit(w = 3, kind = 'wood') {
  const g = new THREE.Group();
  if (kind === 'produce') {
    // manav tezgahı: koyu tahta gövde, önde üst ve alt çıta (aradaki ürün etiketi açıkta kalır), üstte manav çimi
    rbox(w, 0.86, 1.0, 0.05, mat('#c98b52', { map: texRep('wood', 1.2, 0.6) }), 0, 0.43, 0, g);
    const band = mat('#7a4a2e');
    rbox(w + 0.04, 0.14, 0.05, 0.02, band, 0, 0.08, 0.5, g);
    rbox(w + 0.04, 0.1, 0.05, 0.02, band, 0, 0.8, 0.5, g);
    rbox(w + 0.12, 0.05, 1.1, 0.02, mat('#6cc04a', { rough: 1 }), 0, 0.885, 0, g);
    shelfLooks(g, w, kind);
    return g;
  }
  if (kind === 'eggs') {
    // köy usulü: açık tahta raf, kırmızı kareli örtü önden sarkar
    rbox(w, 0.86, 1.0, 0.06, mat('#ffffff', { map: texRep('wood', 1, 0.5) }), 0, 0.43, 0, g);
    const cloth = mat('#ffffff', { map: checkerTex() });
    rbox(w + 0.12, 0.05, 1.1, 0.02, cloth, 0, 0.885, 0, g);
    rbox(w + 0.12, 0.11, 0.03, 0.01, cloth, 0, 0.82, 0.56, g);
    shelfLooks(g, w, kind);
    return g;
  }
  const wood = mat('#ffffff', { map: texRep('wood', 1, 0.5) });
  rbox(w, 0.9, 1.0, 0.07, wood, 0, 0.45, 0, g);
  rbox(w + 0.12, 0.08, 1.1, 0.03, mat('#f7e2c4'), 0, 0.92, 0, g);
  shelfLooks(g, w, 'wood');
  return g;
}

// raf katları: her kat bir basamak geride ve yukarıda; katta 2 sıra x 4 yer
export function shelfSlots(t) {
  const a = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) a.push(new THREE.Vector3(-1.05 + i * 0.7, 0.97 + t * 0.42, 0.2 - j * 0.42 - t * TIER_STEP));
  return a;
}
// her kat bir öncekinin iki sırasını açıkta bırakacak kadar geride durur
export const TIER_STEP = 0.85;
export function addShelfTier(unit, t, kind, w = 3.0) {
  const g = new THREE.Group();
  const body = kind === 'fridge' ? mat('#f4f7fb') : kind === 'produce' ? mat('#c98b52', { map: texRep('wood', 1.2, 0.3) }) : mat('#ffffff', { map: texRep('wood', 1, 0.3) });
  const top = kind === 'fridge' ? mat('#bfe7f5', { rough: 0.2 }) : kind === 'produce' ? mat('#6cc04a', { rough: 1 }) : kind === 'eggs' ? mat('#ffffff', { map: checkerTex() }) : mat('#f7e2c4');
  const y = 0.92 + t * 0.42, z = -t * TIER_STEP;
  rbox(w, 0.42, 0.95, 0.05, body, 0, y - 0.21, z, g);
  rbox(w + 0.12, 0.07, 1.02, 0.03, top, 0, y, z, g);
  if (kind === 'fridge') {
    rbox(w + 0.04, 0.08, 0.06, 0.02, mat('#3d7dd8'), 0, y - 0.05, z + 0.49, g); // fiyat rayı
    rbox(w - 0.04, 0.13, 0.025, 0.01, mat('#cfefff', { opacity: 0.35, rough: 0.1 }), 0, y + 0.1, z + 0.5, g); // cam kenar
  }
  if (kind === 'produce') rbox(w + 0.04, 0.08, 0.05, 0.02, mat('#7a4a2e'), 0, y - 0.06, z + 0.49, g);
  unit.add(g);
  return g;
}
// boş yerler belli olsun: her yerin altında açık renkli işaret
export function addShelfMarkers(unit, slots, kind) {
  if (kind === 'produce') {
    // her sütunda bir tahta kasa (önlü arkalı iki yer)
    const cols = new Map();
    for (const s of slots) {
      const k = s.x.toFixed(2), c = cols.get(k) || { x: s.x, y: s.y, z0: s.z, z1: s.z };
      c.z0 = Math.min(c.z0, s.z); c.z1 = Math.max(c.z1, s.z); cols.set(k, c);
    }
    const wood = mat('#e2ae73', { map: texRep('wood', 0.5, 0.25) });
    for (const c of cols.values()) {
      const cr = new THREE.Group(), w = 0.62, d = c.z1 - c.z0 + 0.4;
      cr.position.set(c.x, c.y - 0.06, (c.z0 + c.z1) / 2);
      rbox(w, 0.03, d, 0.01, wood, 0, 0.015, 0, cr);
      for (const sx of [-1, 1]) rbox(0.04, 0.14, d, 0.01, wood, sx * (w / 2 - 0.02), 0.07, 0, cr);
      for (const sz of [-1, 1]) rbox(w, sz > 0 ? 0.09 : 0.14, 0.04, 0.01, wood, 0, sz > 0 ? 0.045 : 0.07, sz * (d / 2 - 0.02), cr); // ön tahta alçak: ürün görünsün
      cr.traverse((o) => { o.castShadow = false; });
      unit.add(cr);
    }
    return;
  }
  if (kind === 'eggs') {
    const pulp = mat('#ffffff', { map: viyolTex(), rough: 1 });
    for (const s of slots) { const k = rbox(0.56, 0.04, 0.36, 0.012, pulp, s.x, s.y - 0.04, s.z, unit); k.castShadow = false; }
    return;
  }
  const m = mat(kind === 'fridge' ? '#e3f6fc' : '#fff4df');
  for (const s of slots) { const k = rbox(0.56, 0.02, 0.34, 0.008, m, s.x, s.y - 0.045, s.z, unit); k.castShadow = false; }
}

// ---------- raf reklamları ----------
// rafın arkasında direkli reklam tabelası (ürün resmi, adı, slogan, fiyat yıldızı) ve rafın önünde ürün etiketi
function adCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { g: c.getContext('2d'), tex };
}
const tint = (hex, l) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, l); return `#${c.getHexString()}`; };
function starPath(g, x, y, r1, r2, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i * PI) / n - PI / 2, r = i % 2 ? r2 : r1; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  g.closePath();
}
function paintAd(g, W, H, o, imgs) {
  const n = Math.max(1, o.items.length), cx = n > 1 ? 165 : 150, cy = H / 2;
  g.clearRect(0, 0, W, H);
  g.save();
  g.beginPath(); g.roundRect(0, 0, W, H, 30); g.clip();
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, tint(o.color, 0.12)); bg.addColorStop(1, tint(o.color, -0.1));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.13; g.fillStyle = '#ffffff'; // ürünün arkasında ışık hüzmeleri
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 700, a, a + 0.22); g.closePath(); g.fill(); }
  g.globalAlpha = 1;
  g.translate(W - 62, 46); g.rotate(0.62); // köşe kurdelesi
  g.fillStyle = '#ffffff'; g.fillRect(-100, -18, 200, 36);
  g.fillStyle = o.color; g.font = "900 23px 'Nunito','Segoe UI',sans-serif"; g.textAlign = 'center'; g.fillText('TAZE!', 0, 8);
  g.restore();
  g.strokeStyle = '#ffffff'; g.lineWidth = 10;
  g.beginPath(); g.roundRect(10, 10, W - 20, H - 20, 22); g.stroke();
  const r = n > 1 ? 78 : 104;
  for (let k = 0; k < n; k++) {
    const x = n > 1 ? 100 + k * 128 : cx, y = n > 1 ? cy + (k ? 22 : -22) : cy;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x + 4, y + 7, r, 0, PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r, 0, PI * 2); g.fill();
    if (imgs[k]) g.drawImage(imgs[k], x - r * 0.92, y - r * 0.92, r * 1.84, r * 1.84);
  }
  const tx = n > 1 ? 345 : 285;
  g.textAlign = 'left'; g.lineJoin = 'round';
  g.font = `${n > 1 ? 62 : 80}px 'Lilita One','Baloo 2',sans-serif`;
  g.lineWidth = 12; g.strokeStyle = tint(o.color, -0.28); g.strokeText(o.title, tx, 120, W - tx - 130);
  g.fillStyle = '#ffffff'; g.fillText(o.title, tx, 120, W - tx - 130);
  g.font = "800 31px 'Nunito','Segoe UI',sans-serif"; g.fillStyle = '#fff6d8';
  g.fillText(o.slogan, tx, 172, W - tx - 180);
  starPath(g, W - 100, H - 80, 72, 58, 14);
  g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
  g.fillStyle = '#7a4a00'; g.textAlign = 'center';
  g.font = `${o.price.length > 6 ? 30 : 42}px 'Lilita One','Baloo 2',sans-serif`;
  g.fillText(o.price, W - 100, H - 66, 120);
}
function paintStrip(g, W, H, o, imgs) {
  const n = Math.max(1, o.items.length);
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(0, 0, W, H, 20); g.fill();
  g.fillStyle = o.color; g.beginPath(); g.roundRect(7, 7, W - 14, H - 14, 15); g.fill();
  for (let k = 0; k < n; k++) if (imgs[k]) { g.drawImage(imgs[k], 12 + k * 74, 6, 108, 108); g.drawImage(imgs[k], W - 120 - k * 74, 6, 108, 108); }
  g.fillStyle = '#ffffff'; g.textAlign = 'center';
  g.font = "56px 'Lilita One','Baloo 2',sans-serif";
  g.fillText(`${o.title} · ${o.price}`, W / 2, 80, W - 2 * (128 + (n - 1) * 74));
}
// o: { items: [{ icon }], title, slogan, price, color }
export function addShelfAds(unit, o) {
  const board = adCanvas(768, 288), strip = adCanvas(768, 120), imgs = [];
  const paint = () => {
    paintAd(board.g, 768, 288, o, imgs); paintStrip(strip.g, 768, 120, o, imgs);
    board.tex.needsUpdate = true; strip.tex.needsUpdate = true;
  };
  o.items.forEach((it, k) => { if (!it.icon) return; const im = new Image(); im.onload = () => { imgs[k] = im; paint(); }; im.src = it.icon; });
  paint();
  if (document.fonts) document.fonts.ready.then(paint); // başlık yazı tipi geç yüklenirse yeniden çiz
  const g = new THREE.Group();
  const wood = mat('#8a5a33');
  // tabela dükkan tentesinin önüne asılır: en arka kattaki ürünlerin üstünde kalır, onları kapatmaz
  const bd = new THREE.Group();
  bd.position.set(0, 3.42, -1.45); bd.rotation.x = -0.25; // kameraya doğru hafif eğik
  g.add(bd);
  rbox(3.46, 1.36, 0.08, 0.04, wood, 0, 0, -0.03, bd).castShadow = false;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.24), new THREE.MeshStandardMaterial({ map: board.tex, roughness: 0.6 }));
  face.position.z = 0.015;
  bd.add(face);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.44), new THREE.MeshStandardMaterial({ map: strip.tex, roughness: 0.6 }));
  lab.position.set(0, 0.5, 0.512);
  g.add(lab);
  unit.add(g);
  return g;
}

// bostan: yere serili düz toprak (yükselti, tahta kenar yok); fidelerin dizildiği iki karık biraz daha koyu
export function makeBed(w = 4.0, d = 3.0) {
  const g = new THREE.Group();
  const flat = (pw, pd, m, z, y) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, pd), m); p.rotation.x = -PI / 2; p.position.set(0, y, z); p.receiveShadow = true; g.add(p); return p; };
  flat(w, d, mat('#ffffff', { map: texRep('soil', w / 3, d / 3) }), 0, 0.012);
  for (const z of [-0.7, 0.7]) flat(w - 0.5, 0.5, mat('#a88566', { map: texRep('soil', (w - 0.5) / 3, 0.17) }), z, 0.016);
  return g;
}

// tarla bitkileri: uzun mısır sapı, buğday başakları
function makeCrop(type) {
  const g = new THREE.Group();
  const fruit = new THREE.Group();
  if (type === 'kocan') {
    const stalk = mat('#6aa84f', { flat: true }), leaf = mat('#7cbf4a', { flat: true });
    cyl(0.045, 0.06, 1.5, 6, stalk, 0, 0.75, 0, g);
    for (let i = 0; i < 4; i++) {
      const s = i % 2 ? 1 : -1, l = caps(0.035, 0.55, leaf, s * 0.16, 0.45 + i * 0.25, (i - 1.5) * 0.05, g);
      l.rotation.z = -s * 0.95; l.rotation.y = i * 0.6;
    }
    for (let i = 0; i < 5; i++) cyl(0.01, 0.01, 0.25, 4, mat('#e0c36a'), 0, 1.6, 0, g).rotation.z = (i - 2) * 0.25;
    fruit.position.set(0.13, 0.75, 0.1); fruit.rotation.z = -1.1;
  } else {
    const stem = mat('#d9b25a'), ear = mat('#e8c46a', { flat: true }), green = mat('#a3c25e', { flat: true });
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, r = 0.08 + (i % 4) * 0.06, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.6 + (i % 3) * 0.08;
      const s = cyl(0.012, 0.016, h, 4, i % 3 ? stem : green, x, h / 2, z, g);
      s.rotation.z = -x * 0.6; s.rotation.x = z * 0.6;
      caps(0.03, 0.1, ear, x * 1.3, h + 0.04, z * 1.3, g);
    }
    fruit.position.set(0, 0.42, 0.28);
  }
  g.add(fruit);
  g.userData.fruit = fruit;
  return g;
}

export function makePlant(type) {
  if (type === 'kocan' || type === 'bugday') return makeCrop(type);
  // yere yatan bitkiler (karpuz, balkabağı, lahana): toprağa yayılan yapraklar, meyve yerde
  if (type === 'karpuz' || type === 'balkabagi' || type === 'lahana') {
    const g = new THREE.Group(), leaf = mat(type === 'lahana' ? '#7cc36a' : '#4f9e4a', { flat: true });
    for (let k = 0; k < 5; k++) { const a = (k * PI * 2) / 5, l = ico(type === 'lahana' ? 0.28 : 0.24, leaf, Math.cos(a) * 0.32, 0.1, Math.sin(a) * 0.32, g, 0); l.scale.set(1.3, 0.35, 1); }
    if (type !== 'lahana') for (let k = 0; k < 3; k++) { const v = rbox(0.6, 0.03, 0.04, 0.01, mat('#3f8a3c'), Math.cos(k * 2.1) * 0.35, 0.04, Math.sin(k * 2.1) * 0.35, g); v.rotation.y = k * 2.1; }
    const fruit = new THREE.Group(); fruit.position.set(0.05, 0.02, 0.1); g.add(fruit);
    g.userData.fruit = fruit;
    return g;
  }
  const g = new THREE.Group();
  const leaf = mat(type === 'salatalik' ? '#5aa84a' : '#4f9e4a', { flat: true });
  if (type === 'salatalik') {
    // 2026-11-09 kullanıcı: "salatalıkların gösterimi bostanda bitkinin içinde olsun yanında değil": yapraklar arkada ve iki yanda
    // yuva gibi kümelenir, önü alçak; salatalık bu yuvanın içinde, yaprakların arasında yatar ve kameradan görünür (fide yönü game.js addPlant)
    const leaf2 = mat('#6cbd57', { flat: true });
    ico(0.34, leaf, 0, 0.36, -0.2, g, 0).scale.set(1.35, 0.7, 0.85); // arka yaprak kümesi
    ico(0.25, leaf2, -0.4, 0.22, 0.06, g, 0).scale.set(1.0, 0.6, 1.2); // yan yapraklar: salatalığın uçları aralarına girer
    ico(0.25, leaf, 0.4, 0.2, 0.1, g, 0).scale.set(1.0, 0.55, 1.2);
    ico(0.16, leaf2, -0.14, 0.05, 0.36, g, 0).scale.set(1.4, 0.35, 0.9); // önde alçak yaprak: salatalığın altında kalır
    sph(0.06, mat('#ffd23f'), -0.3, 0.42, -0.06, g, 8, 6); // sarı çiçekler
    sph(0.05, mat('#ffd23f'), 0.3, 0.4, -0.14, g, 8, 6);
  } else {
    cyl(0.04, 0.06, 1.0, 6, mat('#4a8a3c'), 0, 0.55, 0, g);
    ico(0.26, leaf, 0.12, 0.65, 0.05, g, 0);
    ico(0.24, mat('#5fb34f', { flat: true }), -0.14, 0.9, -0.05, g, 0);
    ico(0.2, leaf, 0.05, 1.12, 0.02, g, 0);
    rbox(0.05, 1.3, 0.05, 0.02, mat('#c9a06b'), -0.18, 0.65, -0.12, g);
  }
  const fruit = new THREE.Group();
  fruit.position.set(type === 'salatalik' ? 0.02 : 0.2, type === 'salatalik' ? 0.13 : 0.55, type === 'salatalik' ? 0.12 : 0.22);
  // salatalık yaprak yuvasının içinde (2026-11-08'de fidenin 0,5 m önüne, toprağa alınmıştı; kullanıcı yanında değil içinde istedi).
  // face: fidenin açık yanı kameraya (+z) baksın diye fide az döndürülür (game.js addPlant)
  if (type === 'salatalik') { fruit.rotation.set(0, (Math.random() - 0.5) * 0.5, 0.12); g.userData.face = true; }
  g.add(fruit);
  g.userData.fruit = fruit;
  return g;
}

// tarım kuşağı (2026-10-28): tarlanın köşelerinde kısa çit direkleri, ön sol köşesinde ürün tabelası (çarpışmasız süs)
const FIELD_LABEL = { bugday: ['🌾 BUĞDAY', '#c8a03a'], kocan: ['🌽 MISIR', '#6aa84f'], lahana: ['🥬 LAHANA', '#4f9a3f'], balkabagi: ['🎃 BALKABAĞI', '#e8862f'],
  aycicek: ['🌻 AYÇİÇEĞİ', '#e0b03a'], karpuz: ['🍉 KARPUZ', '#3fae6b'], lale: ['🌷 LALE', '#e05a8c'] }; // lale: tarla.js lale tarlası (çiçekçinin tarhları tabelasız)
export const isFieldCrop = (type) => !!FIELD_LABEL[type];
export function fieldMarks(parent, x, z, type, w = 4.4, d = 3.4) {
  const [text, color] = FIELD_LABEL[type] || [type.toLocaleUpperCase('tr'), '#6aa84f'];
  const post = mat('#8a5a33');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rbox(0.12, 0.55, 0.12, 0.03, post, x + sx * (w / 2 + 0.12), 0.27, z + sz * (d / 2 + 0.12), parent);
  const s = makeSign(text, color, Math.max(1.5, text.length * 0.17), 0.42); s.scale.setScalar(0.6); s.position.set(x - w / 2 + 0.55, 0, z + d / 2 + 0.42); parent.add(s);
  return s;
}
export function makeSign(text, bg = '#3d7dd8', w = 3, h = 0.8) {
  const g = new THREE.Group();
  const wood = mat('#a8703f');
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) cyl(0.07, 0.07, 2.4, 8, wood, x, 1.2, 0, g);
  rbox(w, h, 0.14, 0.08, mat('#ffffff', { map: textTex(text, { bg, border: '#ffffff', w: 640, h: Math.round(640 * h / w) }) }), 0, 2.2, 0, g);
  return g;
}

// ---------- pazar ----------
// Pazar tezgâhı ailesi (2026-11-06 kullanıcı: "semt pazarındaki rafları ve üstüne konan ürünleri tasarımsal geliştir uyumlu hale getir anlaşılır olsun"):
// oyuncunun tek ürünlü tezgâhı ile rakibin geniş tezgâhı aynı parçalardan: tahta gövde, tente renginde ön şerit, arkadan öne inen üç basamak çul kaplı
// sergi, arkada yüksekte çizgili tente (kamera sergiyi görsün). Ön +z (müşteri), arka -z (satıcı).
export const STALL_ROWS = [[-0.24, 1.15], [0.12, 1.03], [0.48, 0.91]]; // [z, basamağın üstü], arkadan öne
function stallBase(g, w, col, nStripe) {
  const plank = mat('#ffffff', { map: texRep('wood', 0.5, 0.6) }), step = mat('#b77b46', { map: texRep('wood', 0.6, 0.3) }), burlap = mat('#d8c49a');
  rbox(w, 0.8, 1.4, 0.04, plank, 0, 0.4, 0, g);
  rbox(w + 0.03, 0.17, 0.03, 0.01, mat(col), 0, 0.72, 0.71, g); // tente renginde ön şerit: kimin tezgâhı olduğu önden de belli
  for (const [z, y] of STALL_ROWS) {
    rbox(w - 0.06, y - 0.78, 0.37, 0.02, step, 0, (y + 0.78) / 2, z, g);
    rbox(w - 0.14, 0.012, 0.3, 0, burlap, 0, y + 0.004, z, g);
  }
  const pole = mat('#e9e4d8');
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) cyl(0.04, 0.04, 2.5, 8, pole, x, 1.25, -0.66, g);
  const aw = mesh(cached(`pzaw${w}`, () => new THREE.CylinderGeometry(0.9, 0.9, w + 0.18, 12, 1, true, 0, PI)), mat('#ffffff', { map: stripes(col, '#ffffff', nStripe), side: THREE.DoubleSide }), 0, 2.46, -0.66, g);
  aw.rotation.z = PI / 2; aw.scale.set(0.36, 1, 0.48);
  rbox(w + 0.18, 0.09, 0.03, 0.01, mat(col), 0, 2.44, -0.23, g); // saçak
  g.userData.awning = aw;
  return g;
}
export function makeStall(col, o = {}) { // rakibin geniş tezgâhı: dört sütun, her sütunda bir ürün (STALL_SLOTS)
  const g = stallBase(new THREE.Group(), 3.4, col, 10);
  if (o.label) { // adı tentenin üstünde, kameraya dönük
    const b = rbox(2.2, 0.44, 0.05, 0.02, mat('#ffffff', { map: textTex(o.label, { bg: col, border: '#ffffff', w: 512, h: 102 }) }), 0, 3.02, -0.66, g);
    b.rotation.order = 'YXZ'; b.rotation.y = -(o.ry || 0) * 0.75; b.rotation.x = -0.3;
  }
  return g;
}

// oyuncunun tek ürünlü tezgâhı: tepesinde büyük ürün (world.js R.addStall), hangi yandan bakılsa ne satıldığı belli
export function makeMiniStall(col, w = 1.4) {
  const g = stallBase(new THREE.Group(), w, col, 5);
  cyl(0.3, 0.3, 0.05, 14, mat('#f7e2c4'), 0, 2.84, -0.66, g); // büyük ürünün altlığı
  return g;
}
// küçük levha: direk ve kameraya eğik yazı (kasa, bizim köşe)
export function makeMiniSign(text, bg, w, h, y) {
  const g = new THREE.Group();
  cyl(0.04, 0.04, y, 8, mat('#a8703f'), 0, y / 2, 0, g);
  const b = rbox(w, h, 0.05, 0.02, mat('#ffffff', { map: textTex(text, { bg, border: '#ffffff', w: 512, h: Math.round((512 * h) / w) }) }), 0, y + h / 2 - 0.05, 0, g);
  b.rotation.x = -0.3;
  return g;
}

// toptancı kasası: kamyonun arkasında, içindeki ürün dışarıdan görünür
export function makeCrateOf(kinds) {
  const g = new THREE.Group();
  const wood = mat('#c08a52', { map: texRep('wood', 0.6, 0.3) });
  rbox(0.9, 0.42, 0.72, 0.04, wood, 0, 0.21, 0, g);
  rbox(0.96, 0.06, 0.78, 0.02, mat('#8a5a2e'), 0, 0.44, 0, g);
  kinds.forEach((k, i) => { const m = k === 'cucumber' ? makeCucumber() : model(k); m.position.set(-0.2 + (i % 2) * 0.4, 0.5, -0.15 + Math.floor(i / 2) * 0.3); m.rotation.y = i * 1.3; g.add(m); });
  return g;
}

// rakip tezgâhının yerleri: dört sütun, üç basamak; her sütunda bir ürün
export const STALL_SLOTS = [-1.2, -0.4, 0.4, 1.2].flatMap((x) => STALL_ROWS.map(([z, y]) => new THREE.Vector3(x, y, z)));

// ---------- sahil ----------
// Sahil barı (2026-11-09 kullanıcı: "büfenin içini yap orda dursun kasada orda olsun barımsı sahile uygun şekilde"; eski makeKiosk dolu bir kutuydu).
// Grup merkezi (33, 18,5): zemin z -2,0...+1,2. Önde bambu kaplı bar tezgâhı (üstü y 1,215, kasa burada), arkada raflı duvar, tezgâh, içecek dolabı.
// Saz çatı yalnız arka bölümde: kamera güneyden 51° baktığı için çatı öne uzansa içi ve kasadarı örterdi; önü ince bambu kirişli ve ampullü
export function makeBeachBar(label = 'BÜFE') {
  const g = new THREE.Group();
  const plank = mat('#ffffff', { map: texRep('wood', 3, 2) }), wall = mat('#ffffff', { map: texRep('wood', 3, 1.4) }), top = mat('#ffffff', { map: texRep('wood', 3, 0.5) });
  const teal = mat('#3ec1b5'), bam = mat('#d8b873'), bam2 = mat('#c49f58'), sand = mat('#c8a25a', { flat: true }), sand2 = mat('#b48c47', { flat: true }), dark = mat('#6b4a2e');
  rbox(5.2, 0.1, 3.2, 0.03, plank, 0, 0.05, -0.4, g); // döşeme
  rbox(5.0, 3.7, 0.14, 0.04, wall, 0, 1.87, -1.92, g); // arka duvar
  for (const sx of [-1, 1]) rbox(0.12, 1.12, 3.0, 0.03, teal, sx * 2.48, 0.6, -0.42, g); // alçak yan duvarlar
  // bar tezgâhı: turkuaz gövde, önünde bambu sırası, üstte kalın ahşap
  rbox(4.96, 1.08, 0.72, 0.04, teal, 0, 0.6, 0.76, g);
  for (let i = 0; i < 25; i++) cyl(0.09, 0.09, 1.08, 6, i % 2 ? bam : bam2, -2.4 + i * 0.2, 0.6, 1.13, g);
  rbox(5.12, 0.09, 0.92, 0.03, top, 0, 1.17, 0.76, g);
  // arka tezgâh ve üstündekiler
  rbox(3.4, 0.92, 0.6, 0.04, wall, -0.72, 0.56, -1.55, g);
  rbox(3.5, 0.06, 0.66, 0.02, mat('#e9edf0', { rough: 0.35 }), -0.72, 1.05, -1.55, g);
  rbox(0.56, 0.44, 0.38, 0.05, mat('#c9ccd0', { rough: 0.3 }), -1.95, 1.3, -1.55, g); // kahve makinesi
  rbox(0.4, 0.05, 0.2, 0.01, dark, -1.95, 1.2, -1.32, g);
  for (const x of [-1.4, -1.22]) cyl(0.05, 0.04, 0.09, 8, mat('#ffffff'), x, 1.13, -1.42, g); // bardaklar
  cyl(0.11, 0.09, 0.13, 8, mat('#3a3f46'), -0.86, 1.15, -1.55, g); // blender
  cyl(0.12, 0.09, 0.32, 8, mat('#cfefff', { rough: 0.15, opacity: 0.55 }), -0.86, 1.37, -1.55, g);
  cyl(0.28, 0.17, 0.12, 12, mat('#f0e2c5'), -0.1, 1.14, -1.55, g); // meyve kâsesi
  for (const [x, z, c] of [[-0.2, -1.6, '#f2912e'], [0.0, -1.62, '#f6d33c'], [-0.1, -1.46, '#f2912e'], [0.07, -1.47, '#7bbf3a']]) sph(0.09, mat(c), x, 1.25, z, g, 10, 8);
  ico(0.14, mat('#d9a93a', { flat: true }), 0.62, 1.25, -1.55, g, 0).scale.set(0.9, 1.3, 0.9); // ananas
  for (let i = 0; i < 5; i++) { const l = cyl(0.0, 0.06, 0.28, 4, mat('#4f9a3c', { flat: true }), 0.62 + Math.cos(i * 1.26) * 0.05, 1.56, -1.55 + Math.sin(i * 1.26) * 0.05, g); l.rotation.set(Math.sin(i * 1.26) * 0.4, 0, -Math.cos(i * 1.26) * 0.4); }
  // içecek dolabı: içeride, doğu köşesinde
  rbox(0.95, 1.8, 0.62, 0.06, mat('#e8473c'), 1.75, 0.98, -1.55, g);
  rbox(0.76, 1.42, 0.04, 0.02, mat('#cfefff', { opacity: 0.5, rough: 0.1 }), 1.75, 1.05, -1.23, g);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) cyl(0.05, 0.05, 0.24, 6, mat(['#3fae6b', '#f6c343', '#e8604c', '#3d7dd8'][(i + r) % 4]), 1.48 + i * 0.18, 0.56 + r * 0.44, -1.36, g);
  // duvar rafları ve renkli şişeler
  const cols = ['#3fae6b', '#c2703a', '#e8c547', '#7a4fc4', '#e8604c', '#3d9be0', '#7fd1c7', '#a44a3f'];
  [1.56, 1.98].forEach((y, r) => {
    rbox(3.4, 0.05, 0.2, 0.01, dark, -0.72, y, -1.76, g);
    for (let i = 0; i < 9; i++) { const x = -2.25 + i * 0.38, h = 0.22 + ((i + r) % 3) * 0.03, m = mat(cols[(i * 3 + r) % cols.length], { rough: 0.3 }); cyl(0.05, 0.055, h, 6, m, x, y + 0.025 + h / 2, -1.76, g); cyl(0.018, 0.022, 0.09, 5, m, x, y + 0.025 + h + 0.045, -1.76, g); }
  });
  // direkler, ön kiriş, bambu çıtalar
  for (const sx of [-1, 1]) { cyl(0.075, 0.085, 3.0, 8, bam, sx * 2.44, 1.55, 1.1, g); cyl(0.075, 0.085, 3.3, 8, bam, sx * 2.44, 1.7, -0.92, g); }
  const beam = (w, x, y, z, ry) => { const c = cyl(0.05, 0.05, w, 6, bam2, x, y, z, g); c.rotation.set(0, ry, PI / 2); return c; };
  beam(5.0, 0, 3.02, 1.1, 0);
  for (let i = 0; i < 7; i++) beam(2.3, -2.4 + i * 0.8, 3.08, 0.12, PI / 2); // çıtalar güneyden bakanın görüşünü kapatmaz
  for (let i = 0; i < 9; i++) { sph(0.05, mat('#ffe9a8', { emissive: '#ffcf70', ei: 0.7 }), -2.2 + i * 0.55, 2.84 + Math.abs(Math.sin(i * 1.57)) * -0.08, 1.1, g, 6, 5); }
  // saz çatı: kameraya doğru alçalan üç kat, saçağında püsküller
  const roof = new THREE.Group(); roof.position.set(0, 3.62, -1.62); roof.rotation.x = 0.4; g.add(roof);
  rbox(5.9, 0.16, 1.95, 0.06, sand2, 0, 0, 0, roof);
  rbox(5.8, 0.14, 1.5, 0.05, sand, 0, 0.13, -0.2, roof);
  rbox(5.6, 0.12, 0.9, 0.05, sand2, 0, 0.25, -0.46, roof);
  for (let i = 0; i < 28; i++) cyl(0.12, 0.02, 0.4 + (i % 3) * 0.08, 5, i % 2 ? sand : sand2, -2.84 + i * 0.21, -0.2, 0.93, roof);
  const sign = rbox(3, 0.8, 0.2, 0.1, mat('#ffffff', { map: textTex(label, { bg: '#ff6f61', border: '#ffffff', w: 480, h: 128 }) }), 0, 4.55, -1.7, g);
  sign.castShadow = false;
  for (const sx of [-1, 1]) cyl(0.04, 0.04, 0.5, 6, dark, sx * 1.2, 4.0, -1.72, g);
  // dış duvara yaslı sörf tahtası
  const sb = rbox(0.5, 2.2, 0.07, 0.03, mat('#ffffff', { map: stripes('#ff6f61', '#ffffff', 6) }), -2.88, 1.15, 0.5, g); sb.rotation.set(0, PI / 2, 0.14);
  return g;
}

export function makeCornPot() {
  const g = new THREE.Group();
  const pot = esya('misirkazani'); // Poly Pizza tenceresi (esya.js): içinde sarı haşlama suyu ve koçanlar; yüklenemezse kırmızı kazan
  let top = 0.88;
  if (pot) {
    g.add(pot); top = pot.userData.h * 0.82;
    cyl(0.3, 0.3, 0.04, 18, mat('#f9c74f', { emissive: '#f9a74f', ei: 0.2 }), 0, top, 0, g);
  } else {
    cyl(0.55, 0.5, 0.9, 18, mat('#d94f3d'), 0, 0.45, 0, g);
    cyl(0.5, 0.5, 0.05, 18, mat('#f9c74f', { emissive: '#f9a74f', ei: 0.2 }), 0, 0.88, 0, g);
  }
  for (let i = 0; i < 3; i++) { const c = model('corn'); c.position.set(-0.2 + i * 0.2, top - 0.03, 0); c.rotation.z = 0.3 - i * 0.3; g.add(c); }
  tableAt(g, 1.6, 0.85, 1.0, mat('#ffffff', { map: texRep('wood', 1, 0.5) }), 1.1, 0.43, 0);
  tableAt(g, 1.4, 0.85, 1.0, mat('#e8c99a', { map: texRep('wood', 1, 0.5) }), -1.25, 0.43, 0); // koçan masası
  return g;
}

export function makeFreezer() {
  const g = new THREE.Group();
  rbox(1.5, 0.9, 0.9, 0.12, mat('#f4f7fb'), 0, 0.45, 0, g);
  rbox(1.3, 0.06, 0.7, 0.03, mat('#bfe7f5', { rough: 0.15, opacity: 0.85 }), 0, 0.92, 0, g);
  rbox(1.5, 0.25, 0.92, 0.08, mat('#f7a1c4'), 0, 0.2, 0, g);
  tableAt(g, 1.6, 0.85, 1.0, mat('#ffffff', { map: texRep('wood', 1, 0.5) }), 1.65, 0.43, 0);
  tableAt(g, 1.4, 0.85, 1.0, mat('#e8c99a', { map: texRep('wood', 1, 0.5) }), -1.55, 0.43, 0); // süt masası
  // dolabın üstünde dondurma makinesi: süt girer, külahtan dondurma çıkar
  rbox(0.75, 0.6, 0.5, 0.1, mat('#f7a1c4'), 0, 1.25, -0.15, g);
  rbox(0.6, 0.1, 0.38, 0.04, mat('#ffffff'), 0, 1.6, -0.15, g);
  cyl(0.06, 0.04, 0.18, 8, mat('#d7dde3', { rough: 0.35 }), 0, 0.98, 0.12, g);
  const cone = model('ice-cream'); cone.position.set(0, 1.66, -0.15); g.add(cone);
  return g;
}

export function makeLounger(col = '#4fc3e8') {
  const g = new THREE.Group();
  const white = mat('#ffffff');
  rbox(0.85, 0.12, 1.5, 0.05, white, 0, 0.35, 0.3, g);
  const back = rbox(0.85, 0.12, 0.8, 0.05, white, 0, 0.55, -0.72, g);
  back.rotation.x = 0.6;
  const towel = rbox(0.7, 0.04, 1.4, 0.02, mat('#ffffff', { map: stripes(col, '#ffffff', 6) }), 0, 0.43, 0.3, g);
  towel.rotation.y = PI / 2; towel.scale.set(1, 1, 1);
  towel.rotation.y = 0;
  for (const x of [-0.35, 0.35]) for (const z of [-0.3, 0.9]) cyl(0.03, 0.03, 0.35, 6, mat('#cfcfcf'), x, 0.17, z, g);
  return g;
}

export function makeUmbrella(col = '#ff6f61') {
  const g = new THREE.Group();
  cyl(0.04, 0.04, 2.5, 8, mat('#f2f2f2'), 0, 1.25, 0, g);
  const cone = mesh(cached('umb', () => new THREE.ConeGeometry(1.5, 0.55, 12, 1, true)), mat('#ffffff', { map: vstripes(col, '#ffffff', 12), side: THREE.DoubleSide }), 0, 2.55, 0, g);
  cone.castShadow = true;
  sph(0.07, mat(col), 0, 2.85, 0, g, 8, 6);
  return g;
}

export function makePalm(s = 1, lean = 0.25) {
  if (hasNature('palmiye')) return nature('palmiye', { s });
  const g = new THREE.Group();
  const trunk = mat('#b07d47', { flat: true });
  let x = 0, y = 0;
  for (let i = 0; i < 6; i++) {
    const seg = cyl(0.17 - i * 0.012, 0.2 - i * 0.012, 0.62, 7, trunk, x, y + 0.31, 0, g);
    seg.rotation.z = -lean * (i / 6);
    x += Math.sin(lean * (i / 6)) * 0.62; y += 0.6;
  }
  const leaf = mat('#3faf6b', { flat: true }), leaf2 = mat('#56c27e', { flat: true });
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Group(); p.position.set(x, y + 0.05, 0); p.rotation.y = (i / 7) * PI * 2; g.add(p);
    const l = sph(0.5, i % 2 ? leaf : leaf2, 0.85, -0.12, 0, p, 10, 6);
    l.scale.set(1.9, 0.12, 0.42); l.rotation.z = -0.35;
  }
  for (let i = 0; i < 3; i++) sph(0.12, mat('#6b4423'), x + Math.cos(i * 2.1) * 0.18, y - 0.1, Math.sin(i * 2.1) * 0.18, g, 8, 6);
  g.scale.setScalar(s);
  return g;
}

export function makeBoat() {
  const v = vehicle('sandal'); // Poly Pizza sandalı (arac.js); yüklenemezse aşağıdaki yelkenli
  if (v) return v;
  const g = new THREE.Group();
  const hull = rbox(3, 0.6, 1.1, 0.25, mat('#ffffff'), 0, 0.3, 0, g);
  hull.scale.set(1, 1, 1);
  rbox(3.02, 0.15, 1.12, 0.06, mat('#3d7dd8'), 0, 0.45, 0, g);
  cyl(0.05, 0.05, 2.6, 6, mat('#8b5a2b'), 0.2, 1.6, 0, g);
  const sail = mesh(cached('sail', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.4, 0); s.lineTo(0, 2.1); s.closePath(); return new THREE.ShapeGeometry(s); }), mat('#ff6f61', { side: THREE.DoubleSide }), 0.25, 0.6, 0, g);
  sail.castShadow = true;
  return g;
}

export function makeLifeguard() {
  const g = new THREE.Group();
  const w = mat('#ffffff', { map: texRep('wood', 0.5, 1) });
  for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) rbox(0.12, 2.2, 0.12, 0.04, w, x, 1.1, z, g);
  rbox(1.6, 0.15, 1.6, 0.05, w, 0, 2.2, 0, g);
  rbox(1.5, 0.9, 0.1, 0.04, mat('#e8604c'), 0, 2.7, -0.7, g);
  // çatı oturan cankurtaranın başından (≈3.7) yüksekte ve arkaya kaymış: kameradan yüzü görünsün
  const roof = mesh(cached('lgroof', () => new THREE.ConeGeometry(1.3, 0.6, 4)), mat('#e8604c', { flat: true }), 0, 4.7, -0.25, g);
  roof.rotation.y = PI / 4;
  for (const x of [-0.7, 0.7]) for (const z of [-0.7, 0.6]) cyl(0.04, 0.04, 2.1, 6, mat('#ffffff'), x, 3.35, z, g);
  return g;
}

export function makeSandCastle() {
  const v = esya('kumkale'); // Poly Pizza kumdan kalesi (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  const s = mat('#e9c983', { flat: true });
  rbox(1.0, 0.35, 1.0, 0.08, s, 0, 0.18, 0, g);
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) { cyl(0.16, 0.18, 0.55, 8, s, x, 0.45, z, g); mesh(cached('scone', () => new THREE.ConeGeometry(0.18, 0.25, 8)), s, x, 0.85, z, g); }
  cyl(0.25, 0.3, 0.6, 8, s, 0, 0.6, 0, g);
  cyl(0.01, 0.01, 0.6, 4, mat('#8b5a2b'), 0, 1.15, 0, g);
  rbox(0.25, 0.15, 0.02, 0.01, mat('#e8604c'), 0.13, 1.35, 0, g);
  return g;
}

// ---------- han ----------
// Kemerli duvar: uzunluk L, yükseklik H, kalınlık T; kemerler [merkezX, genişlik, yükseklik]
export function makeArchWall(L, H, T, arches, colorMap = 'brick') {
  const s = new THREE.Shape();
  s.moveTo(-L / 2, 0); s.lineTo(L / 2, 0); s.lineTo(L / 2, H); s.lineTo(-L / 2, H); s.closePath();
  for (const [cx, w, h] of arches) {
    const p = new THREE.Path();
    const r = w / 2, sh = h - r;
    p.moveTo(cx - r, 0); p.lineTo(cx - r, sh);
    p.absarc(cx, sh, r, PI, 0, true);
    p.lineTo(cx + r, 0); p.closePath();
    s.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 10 });
  geo.translate(0, 0, -T / 2);
  const t = tex(colorMap).clone(); t.repeat.set(0.5, 0.5); t.needsUpdate = true;
  const m = mesh(geo, mat('#ffffff', { map: t }));
  return m;
}

export function makeTower(r = 1.2, h = 4.5, domeCol = '#3aa6a0') {
  const g = new THREE.Group();
  const t = tex('brick').clone(); t.repeat.set(2, 1.5); t.needsUpdate = true;
  cyl(r, r * 1.08, h, 14, mat('#ffffff', { map: t }), 0, h / 2, 0, g);
  cyl(r * 1.12, r * 1.12, 0.3, 14, mat('#c8643b'), 0, h + 0.15, 0, g);
  const band = cyl(r * 1.01, r * 1.01, 0.5, 14, mat('#ffffff', { map: texRep('cini', 3, 0.5) }), 0, h - 0.5, 0, g);
  band.castShadow = false;
  halfSphere(r * 0.95, mat(domeCol), 0, h + 0.3, 0, g);
  cyl(0.05, 0.05, 0.6, 6, mat('#e0b04a', { rough: 0.4 }), 0, h + 0.3 + r + 0.2, 0, g);
  sph(0.12, mat('#e0b04a', { rough: 0.4 }), 0, h + 0.3 + r + 0.55, 0, g, 10, 8);
  return g;
}

export function makeFountain() {
  const g = new THREE.Group();
  const stone = mat('#e3d2b4', { map: texRep('cobble', 2, 0.5) });
  cyl(2.0, 2.1, 0.7, 8, stone, 0, 0.35, 0, g);
  cyl(1.75, 1.75, 0.06, 8, mat('#62c6e0', { rough: 0.15 }), 0, 0.66, 0, g);
  cyl(0.35, 0.45, 1.6, 8, stone, 0, 1.2, 0, g);
  cyl(0.9, 0.6, 0.25, 8, mat('#2f6db5'), 0, 2.0, 0, g);
  halfSphere(0.55, mat('#3aa6a0'), 0, 2.12, 0, g, 12);
  sph(0.1, mat('#e0b04a', { rough: 0.4 }), 0, 2.75, 0, g, 8, 6);
  return g;
}

export function makeOven() {
  const g = new THREE.Group();
  rbox(2.6, 0.6, 2.2, 0.1, mat('#e3d2b4', { map: texRep('brick', 1, 0.4) }), 0, 0.3, 0, g);
  halfSphere(1.05, mat('#c97a4a', { flat: false }), 0, 0.6, 0, g);
  const hole = mesh(cached('ovenhole', () => new THREE.CircleGeometry(0.42, 16, 0, PI)), mat('#2a1a12'), 0, 0.62, 1.0, g);
  hole.castShadow = false;
  sph(0.18, mat('#ff9a3c', { emissive: '#ff7a1c', ei: 1.2 }), 0, 0.72, 0.75, g, 8, 6);
  cyl(0.18, 0.22, 0.9, 8, mat('#a8603a'), 0.45, 1.75, -0.3, g);
  tableAt(g, 1.8, 0.8, 1.0, mat('#ffffff', { map: texRep('wood', 1, 0.5) }), 2.3, 0.4, 0.3);
  tableAt(g, 1.8, 0.8, 1.0, mat('#e8c99a', { map: texRep('wood', 1, 0.5) }), -2.3, 0.4, 0.3); // buğday masası
  return g;
}

export function makeCauldron() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) { const a = (i / 7) * PI * 2; ico(0.22, mat('#9a9288', { flat: true }), Math.cos(a) * 0.85, 0.15, Math.sin(a) * 0.85, g, 0); }
  const fire = mesh(cached('fire', () => new THREE.ConeGeometry(0.35, 0.6, 7)), mat('#ff8a2c', { emissive: '#ff6a00', ei: 1.4, flat: true }), 0, 0.3, 0, g);
  fire.name = 'fire';
  const pot = sph(0.8, mat('#3b3b40', { rough: 0.5 }), 0, 0.95, 0, g, 18, 12);
  pot.scale.set(1, 0.75, 1);
  cyl(0.72, 0.72, 0.05, 18, mat('#e59a3c', { emissive: '#c26a1c', ei: 0.25 }), 0, 1.45, 0, g);
  tableAt(g, 1.8, 0.8, 1.0, mat('#ffffff', { map: texRep('wood', 1, 0.5) }), 2.0, 0.4, 0.3);
  tableAt(g, 1.8, 0.8, 1.0, mat('#e8c99a', { map: texRep('wood', 1, 0.5) }), -2.0, 0.4, 0.3); // domates masası
  return g;
}

export function makeGranary() {
  const g = new THREE.Group();
  const w = mat('#ffffff', { map: texRep('wood', 1, 1) });
  rbox(2.4, 0.3, 2.0, 0.06, w, 0, 0.15, 0, g);
  for (let i = 0; i < 6; i++) { const b = model('bag'); b.position.set(-0.7 + (i % 3) * 0.7, 0.3 + Math.floor(i / 3) * 0.45, -0.2 + Math.floor(i / 3) * 0.1); b.rotation.y = i; g.add(b); }
  tableAt(g, 1.8, 0.8, 1.0, w, 2.2, 0.4, 0.3);
  tableAt(g, 1.8, 0.8, 1.0, mat('#e8c99a', { map: texRep('wood', 1, 0.5) }), -2.2, 0.4, 0.3); // buğday masası
  backBuilding(g, 'ambar'); // silolu ambar binası arkada (esya.js)
  return g;
}
// makinenin yanındaki iş masası (mobilya.js workTable): rbox gibi merkezden konur, üst yüzü aynı yükseklikte kalır
function tableAt(g, w, h, d, top, x, y, z) { const t = workTable(w, h, d, top); t.position.set(x, y, z); g.add(t); return t; }
// istasyonun arkasındaki bina modeli (esya.js); world.js çarpışma kutusunu userData.bina'dan (yerel x0, x1, z0, z1) kurar
function backBuilding(g, k) {
  const b = esya(k);
  if (!b) return;
  g.add(b);
  const bb = new THREE.Box3().setFromObject(b);
  g.userData.bina = [bb.min.x, bb.max.x, bb.min.z, bb.max.z];
}

export function makeCamel(load) { return tagAnimal(rawCamel(load), 'deve'); } // albüm: hayvan kaydı (album.js)
function rawCamel(load) {
  if (hasAnimal('deve')) return glbCamel(load);
  const g = new THREE.Group();
  const c = mat('#d3a466'), cd = mat('#b98a4f');
  const body = sph(0.7, c, 0, 1.45, 0, g); body.scale.set(0.75, 0.62, 1.25);
  const hump = sph(0.42, c, 0, 2.0, -0.05, g); hump.scale.set(0.9, 0.8, 1);
  const neck = caps(0.17, 0.75, c, 0, 1.95, 0.95, g); neck.rotation.x = 0.55;
  const head = caps(0.16, 0.35, c, 0, 2.4, 1.3, g); head.rotation.x = PI / 2;
  sph(0.035, mat('#2a2a2a'), 0.12, 2.48, 1.32, g, 6, 4); sph(0.035, mat('#2a2a2a'), -0.12, 2.48, 1.32, g, 6, 4);
  const legs = [];
  for (const [x, z] of [[-0.28, 0.55], [0.28, 0.55], [-0.28, -0.55], [0.28, -0.55]]) {
    const hip = new THREE.Group(); hip.position.set(x, 1.2, z); g.add(hip);
    caps(0.1, 0.95, cd, 0, -0.6, 0, hip);
    legs.push(hip);
  }
  if (load) {
    for (const sx of [-1, 1]) rbox(0.25, 0.55, 0.8, 0.08, mat(load), sx * 0.58, 1.55, 0, g);
    rbox(1.1, 0.12, 0.9, 0.05, mat(load), 0, 2.32, 0, g).visible = false;
    const rug = rbox(1.25, 0.06, 0.95, 0.03, mat('#ffffff', { map: texRep('cini', 1, 1) }), 0, 1.88, 0.45, g);
    rug.rotation.x = -0.15;
  }
  g.scale.setScalar(1.15); // 2026-11-02 kullanıcı: "develer çok küçük, biraz büyüt" (kervandaki aralık world.js Caravan)
  g.userData = { legs, walk: 0 };
  return g;
}

// GLB deve: yüklüyse hörgücün iki yanında renkli heybeler, üstünde çini desenli örtü
function glbCamel(load) {
  const g = animal('deve');
  if (!load) return g;
  const { top, half } = g.userData.back;
  for (const sx of [-1, 1]) rbox(0.14, 0.4, 0.6, 0.06, mat(load), sx * (half + 0.06), top - 0.45, 0, g);
  rbox(half * 2 + 0.24, 0.05, 0.8, 0.02, mat('#ffffff', { map: texRep('cini', 1, 1) }), 0, top - 0.2, 0, g);
  return g;
}
// GLB at (riders.js makeHorse): kürk rengi boyanır, eyer sırtta. animateHorse'un döndürdüğü boyun/kuyruk/gövde kukla;
// boynun eğimi (yemlikte otlama) hayvan.js'te boyun kemiğine geçer. seatDy: binicinin eski eyer yüksekliğine (1,58) göre farkı
export function glbHorse(col) {
  if (!hasAnimal('at')) return null;
  const g = animal('at', { tint: { 'Material.003': col } }), u = g.userData, { half, z } = u.back, top = u.back.top - 0.03;
  rbox(half * 2 + 0.14, 0.04, 0.78, 0.02, mat('#c8463a'), 0, top + 0.01, z, g); // eyer örtüsü
  rbox(half * 2 - 0.02, 0.1, 0.56, 0.05, mat('#6b3a1e'), 0, top + 0.07, z, g); // eyer
  u.neck = new THREE.Object3D(); u.tail = new THREE.Object3D(); u.eat = 0; u.body.position.y = 1.15;
  u.seatDy = top + 0.12 - 1.58; u.seatDz = z - 0.02; // binicinin eski eyere (y 1,58, z 0,02) göre kayması
  return g;
}
export function animateCamel(g, speed01, dt) {
  const u = g.userData;
  u.walk += dt * 6 * Math.max(0.1, speed01);
  const s = Math.sin(u.walk) * 0.5 * speed01;
  u.legs[0].rotation.x = s; u.legs[3].rotation.x = s;
  u.legs[1].rotation.x = -s; u.legs[2].rotation.x = -s;
}

export function makeAmphora(col = '#c8643b') {
  const pts = [];
  const prof = [[0, 0], [0.18, 0.02], [0.3, 0.25], [0.32, 0.5], [0.22, 0.75], [0.12, 0.85], [0.14, 0.95], [0.16, 1.0]];
  for (const [x, y] of prof) pts.push(new THREE.Vector2(x, y));
  const geo = cached('amph', () => new THREE.LatheGeometry(pts, 14));
  const g = new THREE.Group();
  mesh(geo, mat(col), 0, 0, 0, g);
  return g;
}

export function makeRug(col = '#b23a48') {
  const g = new THREE.Group();
  rbox(1.6, 0.03, 2.4, 0.01, mat('#ffffff', { map: texRep('cini', 1, 1.5) }), 0, 0.02, 0, g);
  rbox(1.7, 0.025, 2.5, 0.01, mat(col), 0, 0.012, 0, g);
  return g;
}

// ---------- çiftlik ----------
function prism(w, h, d, material, x, y, z, parent) {
  const geo = cached(`pr${w}|${h}|${d}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return g;
  });
  return mesh(geo, material, x, y, z, parent);
}

export function makeChicken() { return tagAnimal(rawChicken(), 'tavuk'); } // albüm: hayvan kaydı (album.js)
function rawChicken() {
  if (hasAnimal('tavuk')) return animal('tavuk');
  const g = new THREE.Group();
  const white = mat('#ffffff'), red = mat('#e8473a'), yel = mat('#ffb627');
  const body = sph(0.22, white, 0, 0.32, 0, g, 14, 10); body.scale.set(0.9, 0.85, 1.15);
  const tail = sph(0.12, mat('#f1f1f1'), 0, 0.45, -0.22, g, 8, 6); tail.scale.set(0.6, 1, 0.8);
  const head = new THREE.Group(); head.position.set(0, 0.5, 0.17); g.add(head);
  sph(0.11, white, 0, 0.04, 0, head, 10, 8);
  sph(0.045, red, 0, 0.15, 0, head, 6, 4); sph(0.04, red, 0, 0.13, 0.05, head, 6, 4);
  const beak = mesh(cached('beak', () => new THREE.ConeGeometry(0.035, 0.09, 6)), yel, 0, 0.03, 0.12, head); beak.rotation.x = PI / 2;
  sph(0.018, mat('#2a2a2a'), 0.06, 0.07, 0.08, head, 6, 4); sph(0.018, mat('#2a2a2a'), -0.06, 0.07, 0.08, head, 6, 4);
  for (const x of [-0.07, 0.07]) cyl(0.015, 0.015, 0.16, 4, yel, x, 0.08, 0.02, g);
  g.userData = { head };
  return g;
}

export function makeCoop(bare) { // bare: folluksuz ikiz kümes (world.js twinCoop: birincinin arkasına bitişik)
  const g = new THREE.Group();
  const wood = mat('#ffffff', { map: texRep('wood', 1, 1) });
  if (hasBuilding('kumes')) { const b = building('kumes'); b.position.z = -0.25; g.add(b); } // GLB kümes; folluk ve tavuk eskisi gibi önünde
  else {
    for (const x of [-1.05, 1.05]) for (const z of [-0.8, 0.8]) cyl(0.07, 0.07, 0.5, 6, wood, x, 0.25, z, g);
    rbox(2.4, 1.3, 1.9, 0.08, mat('#f2d8a8', { map: texRep('wood', 1, 1) }), 0, 1.15, 0, g);
    prism(2.9, 0.95, 2.3, mat('#ffffff', { map: texRep('roof', 0.7, 0.7) }), 0, 1.8, 0, g);
    rbox(0.55, 0.65, 0.06, 0.08, mat('#3a2516'), 0, 1.05, 0.96, g);
    const win = cyl(0.17, 0.17, 0.05, 12, mat('#3a2516'), 0.75, 1.35, 0.96, g); win.rotation.x = PI / 2;
    const ramp = rbox(0.5, 0.06, 1.0, 0.02, wood, 0, 0.42, 1.35, g); ramp.rotation.x = 0.55;
  }
  if (bare) return g;
  // kuluçka folluğu: yere yakın tahta sandık, saman döşeli altı yuva (yumurtalar yuvalarda durur), köşede kuluçkaya yatmış tavuk
  rbox(2.5, 0.3, 1.0, 0.05, wood, 0, 0.15, 2.1, g);
  rbox(2.4, 0.06, 0.9, 0.02, mat('#f0cf63'), 0, 0.31, 2.1, g);
  for (let i = 0; i < 6; i++) { const n = mesh(cached('nest', () => new THREE.TorusGeometry(0.15, 0.05, 6, 12)), mat('#c99a3a'), 0.25 - 0.5 + (i % 3) * 0.5, 0.35, 2.1 - 0.18 + Math.floor(i / 3) * 0.38, g); n.rotation.x = PI / 2; }
  const hen = makeChicken(); hen.position.set(-0.95, 0.24, 2.1); hen.rotation.y = 0.6; hen.scale.set(1.05, 0.85, 1.05); g.add(hen);
  return g;
}

export function makeCow() { return tagAnimal(rawCow(), 'inek'); } // albüm: hayvan kaydı (album.js)
function rawCow() {
  if (hasAnimal('inek')) return animal('inek', { tint: { White: '#f3f0ea' } });
  const g = new THREE.Group();
  const w = mat('#ffffff'), b = mat('#2b2b2b'), pink = mat('#f4b6b6');
  rbox(0.9, 0.75, 1.6, 0.3, w, 0, 1.05, 0, g);
  sph(0.26, b, 0.43, 1.12, 0.25, g, 12, 8).scale.set(0.2, 0.9, 1.1);
  sph(0.22, b, -0.43, 1.0, -0.35, g, 12, 8).scale.set(0.2, 0.9, 1.0);
  sph(0.24, b, 0, 1.43, -0.25, g, 12, 8).scale.set(0.9, 0.2, 1.0);
  const head = new THREE.Group(); head.position.set(0, 1.3, 0.95); g.add(head);
  rbox(0.52, 0.5, 0.55, 0.18, w, 0, 0, 0, head);
  rbox(0.44, 0.26, 0.2, 0.08, pink, 0, -0.1, 0.3, head);
  for (const sx of [-1, 1]) {
    sph(0.04, b, sx * 0.14, 0.08, 0.27, head, 6, 4);
    const horn = cyl(0.03, 0.05, 0.18, 6, mat('#efe2c4'), sx * 0.2, 0.3, -0.05, head); horn.rotation.z = -sx * 0.5;
    const ear = sph(0.1, w, sx * 0.32, 0.12, -0.05, head, 8, 6); ear.scale.set(1.3, 0.5, 0.7);
  }
  const legs = [];
  for (const [x, z] of [[-0.28, 0.55], [0.28, 0.55], [-0.28, -0.55], [0.28, -0.55]]) {
    const hip = new THREE.Group(); hip.position.set(x, 0.75, z); g.add(hip);
    caps(0.1, 0.5, w, 0, -0.38, 0, hip);
    cyl(0.1, 0.11, 0.1, 8, b, 0, -0.7, 0, hip);
    legs.push(hip);
  }
  sph(0.13, pink, 0, 0.66, -0.35, g, 8, 6);
  const tail = cyl(0.025, 0.025, 0.6, 5, w, 0, 1.0, -0.82, g); tail.rotation.x = 0.25;
  g.userData = { head, legs, walk: 0 };
  return g;
}

export function makeBarn() {
  const g = new THREE.Group();
  if (hasBuilding('ahir')) { // GLB açık ahır: eski ahırın derinliğine (≈3,8) inceltilir, içinde iki saman rulosu
    g.add(building('ahir', { sx: 1, sy: 1, sz: 0.62 }));
    const h1 = makeHay(); h1.position.set(0.9, 0.13, -0.6); g.add(h1);
    const h2 = makeHay(); h2.position.set(-0.9, 0.13, -0.65); h2.rotation.y = 0.3; g.add(h2);
    return g;
  }
  const red = mat('#e46a58', { map: texRep('wood', 1.5, 1.5) }), white = mat('#ffffff');
  rbox(4.4, 0.08, 3.0, 0.02, mat('#ffffff', { map: texRep('path', 1.5, 1) }), 0, 0.04, 0, g);
  rbox(4.2, 2.6, 0.25, 0.06, red, 0, 1.3, -1.4, g);
  for (const x of [-2.0, 2.0]) rbox(0.25, 2.6, 3.0, 0.06, red, x, 1.3, 0, g);
  for (const x of [-2.0, 2.0]) rbox(0.32, 2.66, 0.14, 0.04, white, x, 1.33, 1.5, g);
  rbox(4.3, 0.16, 0.16, 0.05, white, 0, 2.58, 1.5, g);
  prism(4.4, 1.3, 0.12, red, 0, 2.6, 1.46, g);
  prism(4.9, 1.5, 3.4, mat('#ffffff', { map: texRep('roof', 0.6, 0.6) }), 0, 2.62, 0, g);
  const h1 = makeHay(); h1.position.set(0.9, 0, -0.7); g.add(h1);
  const h2 = makeHay(); h2.position.set(-0.9, 0, -0.75); h2.rotation.y = 0.3; g.add(h2);
  return g;
}

export function makeDairy() {
  const g = new THREE.Group();
  const steel = mat('#d7dde3', { rough: 0.35 });
  const wood = mat('#ffffff', { map: texRep('wood', 1, 0.5) });
  rbox(2.0, 0.3, 1.8, 0.06, mat('#ffffff', { map: texRep('cobble', 0.8, 0.8) }), 0, 0.15, 0, g);
  cyl(0.7, 0.75, 1.3, 18, steel, 0, 0.95, 0, g);
  cyl(0.73, 0.73, 0.08, 18, mat('#aeb6bd', { rough: 0.35 }), 0, 1.62, 0, g);
  cyl(0.62, 0.62, 0.04, 18, mat('#fff8e1'), 0, 1.66, 0, g);
  const paddle = rbox(0.08, 0.9, 0.08, 0.03, mat('#8b5a2b'), 0.2, 1.9, 0, g); paddle.rotation.z = 0.35; paddle.name = 'paddle';
  for (const sx of [-1, 1]) { const p = cyl(0.07, 0.07, 0.8, 8, steel, sx * 0.95, 0.9, 0.3, g); p.rotation.z = PI / 2; }
  rbox(1.8, 0.8, 1.0, 0.08, wood, -1.8, 0.4, 0.3, g);
  rbox(1.8, 0.8, 1.0, 0.08, wood, 1.8, 0.4, 0.3, g);
  for (let i = 0; i < 3; i++) cyl(0.28, 0.28, 0.16, 16, mat('#f6c343'), 1.4 + i * 0.4, 0.08 + (i % 2) * 0.17, -0.5, g);
  const sign = rbox(1.9, 0.5, 0.1, 0.05, mat('#ffffff', { map: textTex('MANDIRA', { bg: '#3d7dd8', border: '#ffffff', w: 512, h: 136 }) }), 0, 2.55, -0.75, g);
  sign.castShadow = false;
  for (const x of [-0.8, 0.8]) cyl(0.04, 0.04, 2.3, 6, mat('#8b5a2b'), x, 1.15, -0.8, g);
  backBuilding(g, 'mandira'); // ahır binası arkada, kapısı istasyona bakar (esya.js)
  return g;
}

// süt-peynir soğutucusu: marketlerdeki açık önlü, camlı yanlı, ışıklı soğutucu reyon. Dolap baştan tam boy (duvara kadar);
// büyütmeyle eklenen katlar içine basamak basamak oturur. Tabelası raf reklamı olarak world.js'de eklenir
export function makeFridge(w = 3) {
  const g = new THREE.Group();
  const white = mat('#f4f7fb'), glass = mat('#cfefff', { opacity: 0.3, rough: 0.1, side: THREE.DoubleSide });
  const D0 = 0.5, D1 = -2.3, TOP = 2.5; // önü, arka paneli, yüksekliği (yerel z, y)
  // görünüm (dukkan-plan.md): 1 krem renkli eski dolap, 2 + yan camlar, 3 + ışıklı kanopi ve arka ışık
  const [, l1, l2, l3] = lookGroups(g, ['only', 'from', 'from']);
  rbox(w, 0.9, D0 - D1, 0.08, white, 0, 0.45, (D0 + D1) / 2, g);
  rbox(w + 0.04, 0.07, 0.04, 0.02, mat('#3d7dd8'), 0, 0.035, D0 + 0.005, g);
  rbox(w - 0.14, 0.16, 0.03, 0.01, mat('#ffffff', { map: vstripes('#5a6574', '#2e3742', 26) }), 0, 0.16, D0 + 0.01, g); // havalandırma ızgarası
  rbox(w - 0.1, 0.15, 0.025, 0.01, glass, 0, 1.0, D0 - 0.01, g); // ön cam kenar
  rbox(w + 0.2, TOP, 0.12, 0.04, white, 0, TOP / 2, D1, g); // arka panel
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 + 0.05);
    rbox(0.07, 1.15, 0.07, 0.02, white, x, 0.575, D0, g); // ön dikme
    rbox(0.07, TOP, 0.07, 0.02, white, x, TOP / 2, D1 - 0.03, g); // arka dikme
  }
  // 1: eski dolap: krem kaplama, krom kulp, yuvarlak marka levhası
  rbox(w + 0.02, 0.62, 0.006, 0.002, mat('#f3e6c4'), 0, 0.58, D0 + 0.004, l1);
  rbox(w * 0.6, 0.05, 0.05, 0.02, mat('#c9d1d8', { rough: 0.3 }), 0, 0.8, D0 + 0.04, l1);
  cyl(0.11, 0.11, 0.02, 14, mat('#e8604c'), -w * 0.32, 0.55, D0 + 0.012, l1).rotation.x = PI / 2;
  rbox(w + 0.16, 0.12, 0.2, 0.04, mat('#e9dcb8'), 0, TOP - 0.05, D1 + 0.06, l1);
  // 2: yan camlar ve çerçeveleri
  const sh = new THREE.Shape();
  sh.moveTo(-D0, 0); sh.lineTo(-D0, 1.15); sh.lineTo(1.2, TOP); sh.lineTo(-D1 + 0.06, TOP); sh.lineTo(-D1 + 0.06, 0); sh.closePath();
  const geo = cached('fridgeSide', () => new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }));
  const slope = Math.atan2(TOP - 1.15, 1.2 + D0), len = Math.hypot(TOP - 1.15, 1.2 + D0);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 + 0.05);
    const side = new THREE.Mesh(geo, glass); side.rotation.y = PI / 2; side.position.set(x - 0.015, 0, 0); side.renderOrder = 3; l2.add(side);
    const rail = rbox(0.07, 0.07, len, 0.02, white, x, (1.15 + TOP) / 2, (D0 - 1.2) / 2, l2); rail.rotation.x = slope; // eğik üst kenar
    rbox(0.07, 0.07, -D1 + 0.06 - 1.2, 0.02, white, x, TOP, (-1.2 + D1 - 0.06) / 2, l2); // düz üst kenar
  }
  // 3: soğuk ışıklı taban, arka panelin içinde ışık, üst kanopi ve ışık şeridi
  rbox(w - 0.2, 0.04, D0 - D1 - 0.3, 0.02, mat('#c6ecf8', { rough: 0.15, emissive: '#c6ecf8', ei: 0.22 }), 0, 0.92, (D0 + D1) / 2 - 0.05, l3);
  rbox(w - 0.1, TOP - 0.55, 0.02, 0.01, mat('#d6f1fb', { emissive: '#d6f1fb', ei: 0.35 }), 0, 0.92 + (TOP - 0.55) / 2, D1 + 0.07, l3);
  rbox(w + 0.24, 0.3, 0.62, 0.05, white, 0, TOP + 0.1, D1 + 0.28, l3);
  rbox(w + 0.26, 0.09, 0.05, 0.02, mat('#3d7dd8'), 0, TOP + 0.1, D1 + 0.6, l3);
  rbox(w - 0.3, 0.035, 0.08, 0.01, mat('#fdfdff', { emissive: '#fdfdff', ei: 0.9 }), 0, TOP - 0.07, D1 + 0.5, l3);
  setLook(g, 3);
  return g;
}

export function makeDesk() {
  const v = esya('yazihane'); // Poly Pizza masası (esya.js); üstündeki ekran, defter ve saksı eski çizimden, masanın boyuna göre
  const g = v || new THREE.Group(), dy = v ? v.userData.h - 0.865 : 0;
  if (!v) {
    const wood = mat('#ffffff', { map: texRep('wood', 1, 0.5) });
    rbox(1.0, 0.8, 1.6, 0.06, wood, 0, 0.4, 0, g);
    rbox(1.1, 0.07, 1.7, 0.03, mat('#f7e2c4'), 0, 0.83, 0, g);
  }
  const scr = rbox(0.08, 0.45, 0.7, 0.03, mat('#3d4552'), 0.25, 1.12 + dy, -0.2, g);
  rbox(0.02, 0.36, 0.6, 0.02, mat('#9fe3ff', { emissive: '#6fd0ff', ei: 0.4 }), 0.2, 1.12 + dy, -0.2, g);
  scr.rotation.z = 0.08;
  const book = rbox(0.4, 0.06, 0.3, 0.02, mat('#e8604c'), -0.1, 0.9 + dy, 0.45, g); book.rotation.y = 0.3;
  sph(0.12, mat('#56c27e', { flat: true }), -0.25, 1.0 + dy, -0.6, g, 8, 6);
  cyl(0.08, 0.06, 0.16, 8, mat('#c8643b'), -0.25, 0.94 + dy, -0.6, g);
  return g;
}

export function makeHouse(wall = '#fff3dc', roof = '#c8643b', w = 3.2, d = 2.6) {
  if (hasBuilding('ev')) {
    // GLB ev: duvarların alanı w×d'ye denk gelecek kadar büyür; en/boy oranı istenene yarı yarıya yaklaşır (çatı fazla bozulmasın)
    const c = buildingSize('ev', 'core'), s = Math.sqrt((w * d) / (c.x * c.z)), a = Math.pow((w / d) / (c.x / c.z), 0.25);
    return building('ev', { tint: { Walls: wall, Main: roof }, sx: s * a, sy: s, sz: s / a });
  }
  const g = new THREE.Group();
  rbox(w, 2.0, d, 0.1, mat(wall), 0, 1.0, 0, g);
  prism(w + 0.6, 1.3, d + 0.5, mat(roof, { map: texRep('roof', 0.7, 0.7) }), 0, 2.0, 0, g);
  rbox(0.6, 1.0, 0.06, 0.05, mat('#7a4a2e'), 0, 0.5, d / 2 + 0.01, g);
  for (const x of [-w / 3, w / 3]) rbox(0.5, 0.45, 0.06, 0.04, mat('#9fd8f5'), x, 1.25, d / 2 + 0.01, g);
  rbox(0.35, 0.8, 0.35, 0.04, mat('#a8603a'), w / 3, 2.6, -d / 5, g);
  return g;
}

// Mahalle evi (decor.js, 2026-11-07 kullanıcı: "köyün uzağındaki evler gri renk dokusuz ... sanki müşterilerin evleri gibi"): dükkân duvarının
// krem sıvası ve renkli alt bandı (plasterOf), kiremit çatı, ahşap kapı, panjurlu pencere, tuğla baca. Yürünemeyen yerde durur, köşeleri düz
// kutu: ev başına birkaç yüz üçgen (GLB köy evi 3.504 üçgen ve kaplama koordinatı yok). Ön yüz +z. Malzemeler paylaşılır, perf.js birleştirir
const evMats = new Map();
const evMat = (k, fn) => { if (!evMats.has(k)) evMats.set(k, fn()); return evMats.get(k); };
const evBox = (w, h, d, m, x, y, z, g) => mesh(cached(`evb${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), m, x, y, z, g);
const evWall = (band, tint) => evMat(`w${band}${tint}`, () => mat(tint, { map: plasterOf(band, 1, 1) }));
const evCream = () => mat('#fff3dc');
const evGlass = () => mat('#9fd8f5', { rough: 0.3 });
const evDoor = () => evMat('kapi', () => mat('#a8693c', { map: texRep('wood', 0.5, 1) }));
function evWindow(band, x, y, z, g) {
  evBox(0.72, 0.74, 0.04, evCream(), x, y, z, g);
  evBox(0.54, 0.56, 0.06, evGlass(), x, y, z + 0.01, g);
  const sh = mat(band);
  for (const s of [-1, 1]) evBox(0.2, 0.72, 0.05, sh, x + s * 0.47, y, z, g); // panjur: alt bantla aynı renk
}
export function makeMahalleEvi({ band = '#6fc7bb', tint = '#ffffff', roof = '#ffffff', w = 4.2, d = 3.6, floors = 1, side = false, yard = false } = {}) {
  const g = new THREE.Group(), H = floors > 1 ? 4.5 : 2.6, rh = side ? 1.5 : 1.7, fz = d / 2 + 0.02;
  evBox(w, H, d, evWall(band, tint), 0, H / 2, 0, g);
  const rm = evMat(`r${roof}`, () => mat(roof, { map: texRep('roof', 0.7, 0.7) }));
  // çatı: side ise mahya cepheye paralel (kiremit öne bakar), değilse üçgen alınlık öne bakar; alınlık kiremit değil sıva
  const rw = side ? d + 0.7 : w + 0.7, rd = side ? w + 0.7 : d + 0.7;
  const r = prism(rw, rh, rd, rm, 0, H, 0, g), gb = prism(rw - 0.5, rh * (1 - 0.5 / rw), rd + 0.04, evCream(), 0, H, 0, g);
  if (side) r.rotation.y = gb.rotation.y = PI / 2;
  evBox(0.42, 1.2, 0.42, evMat('baca', () => mat('#c9774a', { map: texRep('brick', 0.5, 0.6) })), w * 0.26, H + 0.9, -d * 0.16, g);
  evBox(1.0, 1.72, 0.04, evCream(), 0, 0.86, fz, g);
  evBox(0.8, 1.56, 0.06, evDoor(), 0, 0.78, fz + 0.01, g);
  const wx = w * 0.31;
  for (const x of [-wx, wx]) { evWindow(band, x, 1.5, fz, g); if (floors > 1) evWindow(band, x, 3.3, fz, g); }
  if (floors > 1) evWindow(band, 0, 3.3, fz, g);
  if (yard) { // ön bahçe çiti: ortada kapı aralığı
    const fm = evMat('cit', () => mat('#d9a066', { map: texRep('wood', 0.5, 0.5) })), yz = d / 2 + 1.5, half = w / 2 + 0.6, seg = half - 0.7;
    for (const s of [-1, 1]) {
      for (const y of [0.34, 0.68]) evBox(seg, 0.1, 0.07, fm, s * (0.7 + seg / 2), y, yz, g);
      for (const x of [0.7, half]) evBox(0.14, 0.86, 0.14, fm, s * x, 0.43, yz, g);
      evBox(0.07, 0.1, 1.5, fm, s * half, 0.68, d / 2 + 0.75, g);
    }
  }
  return g;
}
// mahallenin camisi: sıvalı gövde, tuğla kubbe, ince minare (siluette de vardı; artık gri değil)
export function makeMahalleCami() {
  const g = new THREE.Group(), band = '#c9a97a', W = 6.6, D = 5.4, H = 3.4;
  evBox(W, H, D, evWall(band, '#ffffff'), 0, H / 2, 0, g);
  sph(2.5, evMat('kubbe', () => mat('#d98a5a', { map: texRep('brick', 7, 3) })), -0.5, H - 0.1, 0, g, 16, 8).scale.y = 0.85;
  evBox(1.2, 2.3, 0.04, evCream(), -0.5, 1.15, D / 2 + 0.02, g);
  evBox(0.96, 2.1, 0.06, evDoor(), -0.5, 1.05, D / 2 + 0.03, g);
  for (const x of [-2.4, 1.4]) evWindow(band, x, 1.9, D / 2 + 0.02, g);
  const stone = evMat('minare', () => mat('#e3d2b4', { map: texRep('brick', 1.5, 6) }));
  cyl(0.5, 0.62, 12.5, 8, stone, W / 2 - 0.2, 6.25, D / 2 - 0.6, g);
  cyl(0.82, 0.58, 0.34, 8, evCream(), W / 2 - 0.2, 9.8, D / 2 - 0.6, g);
  mesh(cached('evcone', () => new THREE.ConeGeometry(0.62, 2.5, 8)), evMat('r#ffffff', () => mat('#ffffff', { map: texRep('roof', 0.7, 0.7) })), W / 2 - 0.2, 13.75, D / 2 - 0.6, g);
  return g;
}

export function makeWindmill() {
  if (hasBuilding('degirmen')) return building('degirmen'); // GLB değirmen: kanatlar userData.hub'da döner
  const g = new THREE.Group();
  cyl(0.9, 1.4, 5, 10, mat('#fff3dc', { flat: true }), 0, 2.5, 0, g);
  const cap = mesh(cached('wmcap', () => new THREE.ConeGeometry(1.2, 1.4, 10)), mat('#c8643b', { flat: true }), 0, 5.7, 0, g);
  cap.castShadow = true;
  rbox(0.6, 0.9, 0.06, 0.04, mat('#7a4a2e'), 0, 0.45, 1.38, g);
  const hub = new THREE.Group(); hub.position.set(0, 4.6, 1.1); g.add(hub);
  sph(0.22, mat('#7a4a2e'), 0, 0, 0, hub, 8, 6);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group(); arm.rotation.z = (i * PI) / 2; hub.add(arm);
    rbox(0.12, 3.2, 0.06, 0.02, mat('#8b5a2b'), 0, 1.7, 0, arm);
    rbox(0.7, 2.4, 0.03, 0.01, mat('#fffaf0'), 0.38, 1.9, 0.02, arm);
  }
  g.userData.hub = hub;
  return g;
}

export function makeCrate() {
  const g = new THREE.Group();
  const gold = mat('#ffc83d', { rough: 0.35, emissive: '#ff9f1a', ei: 0.3 });
  const wood = mat('#b9722a');
  rbox(0.92, 0.56, 0.66, 0.1, wood, 0, 0.3, 0, g);
  const lid = mesh(cached('cratelid', () => new THREE.CylinderGeometry(0.33, 0.33, 0.94, 16, 1, false, 0, PI)), wood, 0, 0.58, 0, g);
  lid.rotation.z = PI / 2;
  for (const x of [-0.3, 0.3]) {
    rbox(0.1, 0.6, 0.7, 0.03, gold, x, 0.31, 0, g);
    const b = mesh(cached('crateband', () => new THREE.CylinderGeometry(0.345, 0.345, 0.1, 16, 1, false, 0, PI)), gold, x, 0.58, 0, g);
    b.rotation.z = PI / 2;
  }
  rbox(0.18, 0.22, 0.08, 0.03, mat('#fff3c4', { emissive: '#ffd23f', ei: 0.8 }), 0, 0.52, 0.34, g);
  return g;
}

export function makeBin() {
  const g = new THREE.Group();
  cyl(0.38, 0.32, 0.85, 14, mat('#4caf6a'), 0, 0.43, 0, g);
  cyl(0.42, 0.42, 0.08, 14, mat('#3a8f55'), 0, 0.88, 0, g);
  cyl(0.39, 0.39, 0.06, 14, mat('#2f7a46'), 0, 0.15, 0, g);
  rbox(0.3, 0.06, 0.08, 0.03, mat('#2f7a46'), 0, 0.95, 0, g);
  return g;
}

// ---------- işaretler ----------
export function makeMarker(w, d, dashed) {
  const m = new THREE.Mesh(
    cached(`mkp${w}|${d}`, () => new THREE.PlaneGeometry(w, d)),
    new THREE.MeshBasicMaterial({ map: markerTex(w, d, dashed), transparent: true, depthWrite: false, opacity: 0.7 })
  );
  m.rotation.x = -PI / 2;
  m.position.y = 0.05;
  m.renderOrder = 2;
  return m;
}

export function makeArrow() {
  const g = new THREE.Group();
  const m = mat('#ffb627', { emissive: '#ff9500', ei: 0.35 });
  const c = mesh(new THREE.ConeGeometry(0.28, 0.6, 3), m, 0, 0, 0.3, g);
  c.rotation.x = PI / 2;
  c.castShadow = false;
  return g;
}

export function makeBillMesh() {
  const g = cached('billgeo', () => new RoundedBoxGeometry(0.5, 0.07, 0.3, 1, 0.03));
  const m = mesh(g, mat('#ffffff', { map: tex('bill') }));
  m.castShadow = true;
  return m;
}
