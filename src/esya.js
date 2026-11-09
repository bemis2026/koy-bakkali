// Poly Pizza eşya, ürün ve bina modelleri (assets/esya, kaynaklar CREDITS.txt'de; dokular 512 piksele küçültüldü). Kullanıcı 2. turda
// seçti (2026-11-01). Yüklenince parçaların dönüşü geometriye işlenir, model eski çizimin kutusuna oturur. Dokusu düz renk alanlarından
// oluşan modelin her rengi ayrı dokusuz malzeme olur (perf.js düz renkli parçaları tek çizimde birleştirir). makeX işlevleri önce
// esya('anahtar') dener; yüklenemeyen model kodla çizilen eski halinde kalır.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// box: eski çizimin ölçüsü [x, y, z]; y0: eski taban; c: eski merkez [x, z]. fit: 'c' kutuya sığar (varsayılan), 'xz' tabanı doldurur,
// 'h' boyu tutar, 'k' kutuya gerilir (eksenler ayrı ölçeklenir). rx/rz: dik duran modeli yatırır; ry: modeli döndürür (eski çizimin önü +z); verilmezse uzun kenarı eski çizimin
// uzun kenarına çevrilir. keep(yMin, yMax, H): bağlı parçalardan yalnız süzgeçten geçenler kalır (son ölçüde).
// lift: düz renkler bu oranda beyaza yaklaşır. f: dosya adı (verilmezse anahtar; birden çoksa her çağrıda biri; 'dosya#a+b' yalnız o parça ya da malzeme adlarını alır). col: malzeme adı -> renk
const SPEC = {
  aycicek: { box: [0.36, 0.54, 0.18], fit: 'h' },
  pide: { box: [0.42, 0.09, 0.42], fit: 'k', y0: 0.01 }, // yuvarlak pizza kalınlaştırıldı: ürünün renkli altlığı (game.js withDest, 3.8 cm) onu örtmesin
  kesme: { box: [0.23, 0.41, 0.2], f: ['kesme1#Flower_1_Clump', 'kesme1#Flower_3_Clump', 'kesme1#Flower_5_Clump', 'kesme2'], fit: 'h' }, // Flowers yedi ayrı öbek
  tost: { box: [0.38, 0.15, 0.32], rz: Math.PI / 2 }, // dik duran dilim yatırılır
  corba: { box: [0.44, 0.23, 0.5] },
  balik: { box: [0.14, 0.22, 0.52], c: [0, -0.07], f: 'balik#Body+Stripes' }, // dış çizgi kabuğu (Outline) alınmaz
  buzluk: { box: [1.44, 0.66, 1.04], fit: 'xz' },
  kocan: { box: [0.39, 0.16, 0.3], c: [-0.025, 0], rz: Math.PI / 2 },
  bugday: { box: [0.48, 0.14, 0.14], y0: 0.01, rz: Math.PI / 2 },
  carsaf: { box: [0.52, 0.47, 0.44] },
  sepet: { box: [0.48, 0.42, 0.34] },
  yazarkasa: { box: [0.36, 0.38, 0.38], c: [0, 0.04] },
  yazihane: { box: [1.1, 0.87, 1.7] }, // yalnız masa: ekran, defter ve saksı models.js'te üstüne konur
  kumkale: { box: [2.2, 2.0, 2.2], fit: 'xz', y0: -0.03, lift: 0.3, keep: (y0, y1, H) => y1 > 0.3 * H }, // ölçü kum tabanıyla alınır, pembe taban tümseği atılır: kale ~1,1 m, renk kumsala yaklaşır
  mandira: { box: [4.4, 4.0, 4.8], c: [0, -4.3], ry: 0, col: { RoofBlack: '#5e4a3c' } }, // ahır binası istasyonun arkasında, kapısı istasyona (+z) bakar; models.js makeDairy
  ambar: { box: [3.2, 5.4, 2.1], c: [0, -2.6], ry: 0 }, // silolu ambar istasyonun arkasında; models.js makeGranary
  ordek: { box: [0.26, 0.32, 0.45], c: [0, 0.035] },
  kaydirak: { box: [0.94, 1.53, 2.93], c: [0, 0.225] },
  simidi: { box: [1.34, 1.41, 1.4], y0: -0.16, c: [0, -0.03], fit: 'xz' },
  top: { box: [0.6, 0.6, 0.6], y0: -0.3 },
  banka: { box: [6.3, 7.6, 9.4], c: [-1.24, 0], ry: Math.PI / 2, col: { '02___Default': '#8c4a3a' } }, // ön yüzü +x (eski banka gibi), siyah çatı kiremit; tabelalar bank.js'te. 2026-11-04 kullanıcı "çok küçük": 1,56 kat; aynı gün "biraz büyüt": 1,3 kat daha (6,3 × 9,4 m, 5,6 m boy), arkası batıdaki patikaya dayanır (x -59), ön yüz meydana 0,3 m yaklaşır
  firinbinasi: { box: [8.6, 4.5, 4.83], c: [0, 0.205], off: true }, // 2026-11-04: fırın açık salon oldu (carsi.js makeBakeHall), bina kullanılmıyor
  bisikletpark: { box: [0.78, 0.6, 1.0] }, // bir yerlik demir: models.js her bisiklet yerine bir tane dizer, zemin levhası da orada
  fiskiye: { box: [4.3, 2.4, 4.3] }, // su (jet, damlalar, halkalar) models.js'te
  salincak: { box: [3.0, 2.3, 1.73], fit: 'h', ry: Math.PI / 2, keep: (y0, y1, H) => y0 < 0.02 * H || y0 > 0.4 * H }, // yalnız çerçeve: oturak ve zincirler plaza.js'te sallanır
  atahiri: { box: [3.75, 2.3, 2.2], fit: 'k', ry: 0, off: true }, // her bölmenin arkasına bir tane (riders.js makeStable); atlar önünde görünür
  agaski: { box: [0.8, 1.42, 0.6], y0: 0.33, rx: -Math.PI / 2 }, // kepçe ağ: sapı yukarıda kirişe asılı, iki tane expand-west.js'te
  tostmakinesi: { box: [1.1, 0.5, 0.7], y0: 0.85 }, // yalnız makine: tezgâh ve tabela expand-east.js'te
  misirkazani: { box: [1.1, 0.9, 1.1] }, // yalnız kazan: iki tezgâh ve koçanlar models.js'te
  pazarcadiri: { box: [3.0, 3.1, 3.0], ry: Math.PI / 3 }, // direkler modelde 60° dönük; makeTent genişliğe göre yan yana dizer
};
const T = {};
export const hasEsya = (k) => !!T[k];

// off: oyunda yüklenmez, eski çizim kalır (2026-11-03 kullanıcı: "at ahırını 3d değil eski haline getir"); vitrin keys ile yine yükleyebilir
export async function loadEsya(base = 'assets/esya/', keys = Object.keys(SPEC).filter((k) => !SPEC[k].off)) {
  const L = new GLTFLoader();
  await Promise.all(keys.map(async (k) => {
    const sp = SPEC[k];
    try {
      T[k] = await Promise.all([].concat(sp.f || k).map(async (f) => { const [file, part] = f.split('#'); return fit(sp, (await L.loadAsync(`${base}${file}.glb`)).scene, part); }));
    } catch (e) { console.warn('eşya modeli yüklenemedi:', k, e); }
  }));
}

const flatMats = new Map();
const flatMat = (hex) => { if (!flatMats.has(hex)) flatMats.set(hex, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 })); return flatMats.get(hex); };
// GLB malzemesi oyununkiyle aynı: metalsiz ve mat (yapi.js matte)
const WHITE = new THREE.Color('#ffffff');
const matte = (m, col, lift) => { m = m.clone(); m.metalness = 0; m.roughness = Math.max(m.roughness, 0.85); if (col) m.color.set(col); if (lift) m.color.lerp(WHITE, lift); return m; };

function fit(sp, o, part) {
  o.updateMatrixWorld(true);
  const parts = [];
  const want = part && part.split('+');
  o.traverse((m) => { if (m.isMesh && (!want || want.includes(m.name) || want.includes(m.material.name))) parts.push({ geo: (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld), mat: m.material }); });
  const box = () => { const b = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } return b; };
  if (sp.rx || sp.rz) { const r = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(sp.rx || 0, 0, sp.rz || 0)); for (const p of parts) p.geo.applyMatrix4(r); }
  let b = box(), sz = b.getSize(new THREE.Vector3());
  let ry = sp.ry;
  if (ry == null) { const [bx, , bz] = sp.box; ry = (bx > bz * 1.25 && sz.z > sz.x * 1.25) || (bz > bx * 1.25 && sz.x > sz.z * 1.25) ? Math.PI / 2 : 0; }
  if (ry) { const r = new THREE.Matrix4().makeRotationY(ry); for (const p of parts) p.geo.applyMatrix4(r); b = box(); sz = b.getSize(new THREE.Vector3()); }
  const [bx, by, bz] = sp.box, fm = sp.fit || 'c';
  const s = fm === 'h' ? by / sz.y : fm === 'xz' ? Math.min(bx / sz.x, bz / sz.z) : Math.min(bx / sz.x, by / sz.y, bz / sz.z);
  const S = fm === 'k' ? [bx / sz.x, by / sz.y, bz / sz.z] : [s, s, s];
  const [cx, cz] = sp.c || [0, 0], y0 = sp.y0 || 0, mc = b.getCenter(new THREE.Vector3());
  const m4 = new THREE.Matrix4().makeTranslation(cx, y0, cz).multiply(new THREE.Matrix4().makeScale(...S)).multiply(new THREE.Matrix4().makeTranslation(-mc.x, -b.min.y, -mc.z));
  const g = new THREE.Group();
  for (const p of parts) {
    p.geo.applyMatrix4(m4);
    if (sp.keep) p.geo = keepParts(p.geo, sp.keep, sz.y * S[1]);
    const flat = p.mat.map ? flatten(p.geo, p.mat.map) : null;
    if (flat) for (const [hex, geo] of flat) add(g, geo, flatMat(sp.lift ? '#' + new THREE.Color(hex).lerp(WHITE, sp.lift).getHexString() : hex));
    else add(g, p.geo, matte(p.mat, sp.col && sp.col[p.mat.name], sp.lift));
  }
  g.userData.h = sz.y * S[1];
  return g;
}
// indekssiz geometrinin seçilen üçgenleri (t: üçgenin ilk köşesi); names verilmezse bütün öznitelikler
function subset(geo, tris, names = Object.keys(geo.attributes)) {
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const a = geo.attributes[n];
    if (!a) continue;
    const k = a.itemSize, arr = new Float32Array(tris.length * 3 * k);
    tris.forEach((t, i) => { for (let v = 0; v < 3; v++) for (let c = 0; c < k; c++) arr[(i * 3 + v) * k + c] = a.getComponent(t + v, c); });
    out.setAttribute(n, new THREE.BufferAttribute(arr, k));
  }
  return out;
}
// aynı konumdaki köşelerle birbirine bağlı parçalar; keep(yMin, yMax, H) geçenlerin üçgenleri kalır
function keepParts(geo, keep, H) {
  const P = geo.attributes.position, n = P.count, ids = new Map(), par = [], vid = new Int32Array(n);
  const f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  for (let i = 0; i < n; i++) {
    const k = P.getX(i).toFixed(3) + ',' + P.getY(i).toFixed(3) + ',' + P.getZ(i).toFixed(3);
    if (!ids.has(k)) { ids.set(k, par.length); par.push(par.length); }
    vid[i] = ids.get(k);
  }
  for (let t = 0; t < n; t += 3) { const a = f(vid[t]); par[f(vid[t + 1])] = a; par[f(vid[t + 2])] = a; }
  const yr = new Map();
  for (let i = 0; i < n; i++) { const r = f(vid[i]), y = P.getY(i), b = yr.get(r) || [y, y]; b[0] = Math.min(b[0], y); b[1] = Math.max(b[1], y); yr.set(r, b); }
  const tris = [];
  for (let t = 0; t < n; t += 3) { const b = yr.get(f(vid[t])); if (keep(b[0], b[1], H)) tris.push(t); }
  return subset(geo, tris);
}
function add(g, geo, mat) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true;
  if (mat.map) mat.map.anisotropy = 4;
  g.add(m);
}

// doku düz renk alanlarından oluşuyorsa (üçgenin üç köşesi aynı renk, en çok 24 renk) renk başına geometri; yoksa null (doku kalır)
function flatten(geo, tex) {
  const uv = geo.attributes.uv;
  if (!uv || !tex.image) return null;
  const img = tex.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, cv.width, cv.height).data, W = cv.width, H = cv.height;
  const at = (u, v) => { u -= Math.floor(u); v -= Math.floor(v); const i = (Math.min(H - 1, Math.floor(v * H)) * W + Math.min(W - 1, Math.floor(u * W))) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const nT = uv.count / 3, by = new Map();
  let mixed = 0;
  for (let t = 0; t < nT; t++) {
    const c = [0, 1, 2].map((j) => at(uv.getX(t * 3 + j), uv.getY(t * 3 + j)));
    if (Math.abs(c[0][0] - c[1][0]) + Math.abs(c[0][1] - c[1][1]) + Math.abs(c[0][2] - c[1][2]) + Math.abs(c[0][0] - c[2][0]) + Math.abs(c[0][1] - c[2][1]) + Math.abs(c[0][2] - c[2][2]) > 30) mixed++;
    const m = at((uv.getX(t * 3) + uv.getX(t * 3 + 1) + uv.getX(t * 3 + 2)) / 3, (uv.getY(t * 3) + uv.getY(t * 3 + 1) + uv.getY(t * 3 + 2)) / 3);
    const hex = '#' + m.map((n) => (n & 0xf8).toString(16).padStart(2, '0')).join('');
    if (!by.has(hex)) by.set(hex, []);
    by.get(hex).push(t * 3);
    if (by.size > 24 || mixed > nT * 0.03) return null;
  }
  return [...by].map(([hex, L]) => [hex, subset(geo, L, ['position', 'normal'])]);
}

const tints = new Map();
// o.tint: { malzemeAdı: renk } ya da bütün malzemeler için tek renk; o.sx/o.sz: eksen ölçeği (parametreli çizimler: çadır, bisiklet parkı)
export function esya(k, o = {}) {
  const L = T[k];
  if (!L) return null;
  const t = L[Math.floor(Math.random() * L.length)], g = t.clone(true);
  if (o.tint) g.traverse((m) => {
    if (!m.isMesh) return;
    const col = typeof o.tint === 'string' ? o.tint : o.tint[m.material.name];
    if (!col) return;
    const key = m.material.uuid + col;
    if (!tints.has(key)) { const c = m.material.clone(); c.color.set(col); tints.set(key, c); }
    m.material = tints.get(key);
  });
  if (o.sx || o.sz) g.scale.set(o.sx || 1, 1, o.sz || 1);
  g.userData = { h: t.userData.h };
  g.name = 'esya-' + k; // oyunda bulup denetlemek için
  return g;
}
