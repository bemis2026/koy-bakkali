// Poly Pizza doğa modelleri (assets/nature, kaynaklar CREDITS.txt'de): ağaç, çam, çalı, kaya, çiçek, palmiye (CC0); meşe, kavak, zeytin,
// salkım söğüt (CC-BY 3.0, krediler.js). Yeni dört tür 2026-11-04'te eklendi (kullanıcı: "ağaçlardan meşe ve kavak ve seçtiğin 1-2si
// eklenebilir oyun ile uyumlu olsun"); dokuları 256 px'e küçültüldü, meşenin taşlı çim kaidesi atıldı.
// Yüklenince boyuna göre ölçeklenir, tabanı y=0'a, gövdesi ortaya oturur; models.js'teki makeTree/makeBush/... bunların kopyasını döndürür.
// Kopyalar geometri ve malzemeyi paylaşır (perf.js kımıldamayanları yine birleştirir). Yüklenemeyen model kodla çizilen eski halinde kalır.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// h: oyundaki boy (s = 1 iken). Eski kod modellerinin boyları: ağaç ~3,5, çam ~3,4, çalı ~0,9, kaya 0,7 (1,2 en), çiçek ~0,4, palmiye ~4
const SPEC = {
  agac: { h: 3.5 },
  cam: { h: 3.6, col: { tiny_treats_1: '#c8ffa0' } }, // doku turkuaz: mavisi kısılır, eski çamın yeşiline (#4f9e5a) yaklaşır
  cali: { h: 0.9 },
  kaya: { w: 1.25 }, // kaya enine göre: eski çağrıların ölçeği (0,6-1,6) en üstünden verilmiş
  cicek: { h: 0.45 },
  palmiye: { h: 4.2 },
  // trunk: tepe yamuk olsa da ağaç gövdesinden dikilir (söğüt, zeytin), çarpışma kutusu gövdede kalır
  // sink: boyun o kadarı toprağa gömülür (meşenin yüzeydeki kökleri dal gibi açılıyordu)
  mese: { h: 4.0, col: { FOLHAS: '#4fae58', TRONCO: '#8b5a2b' }, trunk: true, sink: 0.1 }, // yaprak ve gövde oyunun renklerinde
  kavak: { h: 6.2, trunk: true },
  zeytin: { h: 3.4, trunk: true },
  sogut: { h: 3.8, trunk: true }, // tepesi boyunun ~1,4 katı geniş
};
const T = {};
export const hasNature = (k) => !!T[k];

// GLB malzemesi oyununkiyle aynı: metalsiz ve mat (models.js mat). Quaternius dışa aktarımı metalik 0,4 / pürüzlülük 0,3; ortam haritası
// olmayan sahnede model %40 koyu ve plastik gibi parlak duruyordu. Dokulu modeller zaten pürüzlülük 1
const matte = (o, col = {}) => {
  o.traverse((c) => { if (c.material) for (const m of [].concat(c.material)) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.85); if (col[m.name]) m.color.set(col[m.name]); } });
  return o;
};
// oyunda kullanılanlar (2026-11-01 kullanıcı: çam, çalı ve palmiye kodla çizilen eski halinde). Modeller yerinde; vitrin hepsini yükler (all)
const OYUNDA = ['agac', 'kaya', 'cicek', 'mese', 'kavak', 'zeytin', 'sogut'];
export async function loadNature(base = 'assets/nature/', all = false) {
  const L = new GLTFLoader();
  await Promise.all((all ? Object.keys(SPEC) : OYUNDA).map(async (k) => {
    try { T[k] = fit(k, matte((await L.loadAsync(`${base}${k}.glb`)).scene, SPEC[k].col)); } catch (e) { console.warn('doğa modeli yüklenemedi:', k, e); }
  }));
}

function fit(k, o) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), sp = SPEC[k];
  const s = sp.w ? sp.w / Math.max(sz.x, sz.z) : sp.h / sz.y;
  let cx = b.min.x + sz.x / 2, cz = b.min.z + sz.z / 2;
  if (sp.trunk) { // gövdenin dibi (en alttaki köşeler) ortaya gelir
    const v = new THREE.Vector3(); let n = 0, sx = 0, sz2 = 0;
    o.traverse((m) => { if (!m.isMesh) return; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if (v.y < b.min.y + sz.y * 0.04) { sx += v.x; sz2 += v.z; n++; } } });
    if (n) { cx = sx / n; cz = sz2 / n; }
  }
  o.scale.multiplyScalar(s);
  o.position.set(-cx * s, -(b.min.y + sz.y * (sp.sink || 0)) * s, -cz * s);
  o.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    if (m.material.map) m.material.map.anisotropy = 4;
  });
  const g = new THREE.Group(); g.add(o);
  g.userData.h = sz.y * s;
  return g;
}

// orman (decor.js) türleri InstancedMesh ile diker: modelin parçaları, boyu SPEC h iken yerleşim matrisleriyle
export function natureParts(k) {
  const t = T[k];
  if (!t) return null;
  t.updateMatrixWorld(true);
  const parts = [];
  t.traverse((m) => { if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, mx: m.matrixWorld.clone() }); });
  return { parts, h: t.userData.h };
}

const tintCache = new Map();
// o.tint: bütün malzemelerin rengi (kaya: kum ya da gri) ya da { malzemeAdı: renk } (ağaç: yaprak ve gövde oyunun yeşiline). o.s: ölçek
export function nature(k, o = {}) {
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
  if (o.s && o.s !== 1) g.scale.setScalar(o.s);
  g.userData.h = t.userData.h * (o.s || 1);
  return g;
}
