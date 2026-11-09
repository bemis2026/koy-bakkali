// Poly Pizza hayvan modelleri (assets/animals, kaynaklar CREDITS.txt'de). İnek, koyun, at ve eşek Quaternius'un iskeletli modelleri:
// AnimationMixer bekleme/yürüme klibini hayvanın dünyadaki hızına bakıp kendisi seçer, otlarken boyun kemiği eğilir. Tavuk, güvercin
// ve devenin iskeleti yok: yüklerken baş ya da bacak bölgesine yumuşak ağırlıklı kemik takılır (otomatik iskelet).
// Eski çağıranlar userData.legs/head/body döndürmeye devam eder: iskeletlilerde bunlar boş kukla, otomatik iskelettekilerde gerçek kemik.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { track, seen, thawed, busy } from './donuk.js';

// len: burundan kuyruğa boy (oyun birimi). ws: yürüme klibinin 1× hızda karşıladığı yürüyüş hızı (m/sn). bend: otlama eğimi çarpanı
// rs: koşu klibinin 1× hızda karşıladığı hız; wmax: yürüme klibinin en çok hızlanması (yoksa 2); walkEnd: yürüme klibinin döngü sonu (sn)
const SPEC = {
  inek: { len: 2.5, idle: 'Armature|Idle', walk: 'Armature|WalkSlow', ws: 0.45, neck: 'Neck', bend: 1.6 },
  koyun: { len: 1.5, idle: 'Armature|Idle', walk: ['inek', 'Armature|WalkSlow'], ws: 0.5, neck: 'Neck', bend: 0.8 },
  // at (2026-11-03 kullanıcı: "atlar kayar gibi yürüyor, gerçekçi yürüsün"): GLB'nin yürüme klibi 2,67 sn ama bacaklar yalnızca ilk
  // 1,33 sn'de oynuyor, ikinci yarısı donuk; at her adımın yarısında bacakları durmuş halde kayıyordu. Döngü ilk yarıda kapanır (walkEnd).
  // Toynak izinden ölçüldü: yürüme 1×'te ~1,0 m/sn, koşu ~4,0 m/sn
  at: { len: 2.7, idle: 'Armature|Idle', walk: 'Armature|Walk', run: 'Armature|Run', runAt: 2.2, ws: 1.0, wmax: 2.2, rs: 4.0, walkEnd: 32 / 24, neck: 'Neck', bend: 1, backZ: -0.25 },
  esek: { len: 1.65, idle: 'Idle', walk: 'Walk', run: 'Gallop', runAt: 2.4, ws: 1.0, neck: 'Neck1', bend: 1, rearZ: -0.6, tint: { Main: '#8f857c', Main_Light: '#d9d2c8' } },
  tavuk: { len: 0.72, auto: 'head', py: 0.66, pz: 0.12, soft: 0.06, col: [1.75, 1.7, 1.6] },
  guvercin: { len: 0.46, auto: 'head', py: 0.7, pz: 0.1, soft: 0.06 },
  deve: { len: 2.4, auto: 'legs', hip: 0.5, soft: 0.07 },
};
const T = {};
export const hasAnimal = (k) => !!T[k];

// GLB malzemesi oyununkiyle aynı: metalsiz ve mat (models.js mat). Quaternius dışa aktarımı metalik 0,4 / pürüzlülük 0,3; ortam haritası
// olmayan sahnede model %40 koyu ve plastik gibi parlak duruyordu. Dokulu modeller zaten pürüzlülük 1
const matte = (o) => { o.traverse((c) => { if (c.material) for (const m of [].concat(c.material)) { m.metalness = 0; m.roughness = Math.max(m.roughness, 0.85); } }); return o; };
// oyunda kullanılanlar (2026-11-01 kullanıcı: yalnız deve yeni, öteki hayvanlar kodla çizilen eski halinde). Modeller yerinde; vitrin hepsini yükler (all)
// 2026-11-02 kullanıcı: "develer çok küçük olmuş, biraz büyüt ve eski haline getir": deve de kodla çizilen eski haline döndü
// 2026-11-03 kullanıcı: "atlar 3d haline geri dönsün": at yeniden GLB (atlılar çoğunlukla adım gider, riders.js)
const OYUNDA = ['at'];
export async function loadAnimals(base = 'assets/animals/', all = false) {
  const L = new GLTFLoader();
  const raw = {};
  await Promise.all((all ? Object.keys(SPEC) : OYUNDA).map(async (k) => {
    try { raw[k] = await L.loadAsync(`${base}${k}.glb`); matte(raw[k].scene); } catch (e) { console.warn('hayvan modeli yüklenemedi:', k, e); }
  }));
  for (const k in raw) {
    try { T[k] = SPEC[k].auto ? prepAuto(k, raw[k]) : prepRig(k, raw[k], raw); } catch (e) { console.warn('hayvan modeli hazırlanamadı:', k, e); }
  }
}

// modeli boyuna göre ölçekler, ayakları y=0'a, gövdeyi ortaya (ya da kuyruğu rearZ'ye) koyar
function fit(k, o) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3());
  const sp = SPEC[k], s = sp.len / sz.z;
  o.scale.multiplyScalar(s);
  const z0 = sp.rearZ != null ? sp.rearZ + sp.len / 2 : 0;
  o.position.set(-(b.min.x + sz.x / 2) * s, -b.min.y * s, -(b.min.z + sz.z / 2) * s + z0);
  o.updateMatrixWorld(true);
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { h: sz.y * s, w: sz.x * s };
}
// noktanın model uzayındaki yeri; iskeletlide kemiklerle bükülmüş hali (çizilen hali), çıplak geometri değil
const pos = (m, i, v) => (m.isSkinnedMesh ? m.getVertexPosition(i, v) : v.fromBufferAttribute(m.geometry.attributes.position, i)).applyMatrix4(m.matrixWorld);
// sırt: gövdenin ortasındaki (|z| küçük) en yüksek nokta ve oradaki yarım genişlik; eyer, heybe ve yük buraya oturur
function backOf(o, zc, tol) {
  let top = 0, half = 0;
  const v = new THREE.Vector3();
  o.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      pos(m, i, v);
      if (Math.abs(v.z - zc) < tol) { if (v.y > top) top = v.y; }
    }
  });
  o.traverse((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      pos(m, i, v);
      if (Math.abs(v.z - zc) < tol && v.y > top - 0.45 && Math.abs(v.x) > half) half = Math.abs(v.x);
    }
  });
  return { top, half };
}

function prepRig(k, gltf, raw) {
  const sp = SPEC[k], o = gltf.scene, { h } = fit(k, o);
  const clips = {};
  const find = (src, name) => (src.animations || []).find((c) => c.name === name);
  for (const key of ['idle', 'walk', 'run']) {
    const want = sp[key];
    if (!want) continue;
    if (Array.isArray(want)) { // başka hayvanın klibi (aynı kemik adları): yalnızca dönüşler, boyutu farklı modelde konum izi kaydırır
      const c = raw[want[0]] && find(raw[want[0]], want[1]);
      if (c) clips[key] = new THREE.AnimationClip(c.name, c.duration, c.tracks.filter((t) => t.name.endsWith('.quaternion')));
    } else clips[key] = find(gltf, want);
  }
  if (sp.walkEnd && clips.walk) clips.walk.duration = sp.walkEnd; // klibin donuk kuyruğu oynatılmaz (SPEC.at)
  const zc = sp.backZ ?? (sp.rearZ != null ? sp.rearZ + sp.len * 0.45 : 0); // eyerin oturacağı yer (attaki z=0 yağırına denk geliyordu)
  return { scene: o, clips, h, back: { ...backOf(o, zc, sp.len * 0.08), z: zc } };
}

// otomatik iskelet: tek parça modelin geometrisi model uzayına taşınır, baş ya da bacak bölgelerine kemik ağırlığı verilir
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function prepAuto(k, gltf) {
  const sp = SPEC[k], o = gltf.scene, { h } = fit(k, o);
  let src = null;
  o.traverse((m) => { if (m.isMesh && !src) src = m; });
  const geo = src.geometry.clone().applyMatrix4(src.matrixWorld);
  const p = geo.attributes.position, n = p.count, len = sp.len;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const parts = [];
  if (sp.auto === 'head') {
    const py = sp.py * h, pz = sp.pz * len, s = sp.soft * h; // boyun: bu yükseklikten yukarısı ve bu z'den önü baş
    parts.push(new THREE.Vector3(0, py, pz));
    for (let i = 0; i < n; i++) {
      const w = sstep(py - s, py + s, p.getY(i)) * sstep(pz - s, pz + s, p.getZ(i));
      si[i * 4] = 1; si[i * 4 + 1] = 0; sw[i * 4] = w; sw[i * 4 + 1] = 1 - w;
    }
  } else { // bacaklar: alçaktaki noktalar dört kümeye (sol/sağ × ön/arka), kemik kalçada
    const hip = sp.hip * h, s = sp.soft * h;
    let zm = 0, cnt = 0;
    for (let i = 0; i < n; i++) if (p.getY(i) < 0.2 * h) { zm += p.getZ(i); cnt++; }
    zm /= Math.max(1, cnt);
    const quad = (x, z) => (z > zm ? 0 : 2) + (x > 0 ? 1 : 0); // eski sıra: 0 sol-ön, 1 sağ-ön, 2 sol-arka, 3 sağ-arka
    const acc = [0, 1, 2, 3].map(() => [0, 0, 0]);
    for (let i = 0; i < n; i++) if (p.getY(i) < 0.2 * h) { const a = acc[quad(p.getX(i), p.getZ(i))]; a[0] += p.getX(i); a[1] += p.getZ(i); a[2]++; }
    for (const a of acc) parts.push(new THREE.Vector3(a[0] / Math.max(1, a[2]), hip, a[1] / Math.max(1, a[2])));
    for (let i = 0; i < n; i++) {
      const w = sstep(hip + s, hip - s, p.getY(i));
      si[i * 4] = 1 + quad(p.getX(i), p.getZ(i)); si[i * 4 + 1] = 0; sw[i * 4] = w; sw[i * 4 + 1] = 1 - w;
    }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  let mat = src.material;
  if (sp.col) { mat = mat.clone(); mat.color.setRGB(...sp.col); } // dokusu oyunun pastel ışığında gri kalan model açılır
  const holder = new THREE.Group(); holder.add(new THREE.Mesh(geo, mat)); holder.updateMatrixWorld(true);
  return { geo, mat, parts, h, back: { ...backOf(holder, 0, len * 0.12), z: 0 } };
}

const tintCache = new Map();
function tinted(m, name, col) { // aynı renk istekleri aynı malzemeyi paylaşır
  const key = m.uuid + col;
  let t = tintCache.get(key);
  if (!t) { t = m.clone(); t.color.set(col); tintCache.set(key, t); }
  return t;
}

// o: { tint: { malzemeAdı: renk } }
export function animal(k, o = {}) {
  const t = T[k];
  if (!t) return null;
  return SPEC[k].auto ? autoInst(k, t) : rigInst(k, t, o);
}

function autoInst(k, t) {
  const g = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(t.geo, t.mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const root = new THREE.Bone(), bones = [root];
  for (const p of t.parts) { const b = new THREE.Bone(); b.position.copy(p); root.add(b); bones.push(b); }
  mesh.add(root); g.add(mesh);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  g.userData = SPEC[k].auto === 'head' ? { head: bones[1] } : { legs: bones.slice(1), walk: 0 };
  g.userData.glb = k; g.userData.back = t.back;
  return g;
}

const dummy = () => new THREE.Object3D();
function rigInst(k, t, o) {
  const sp = SPEC[k], g = new THREE.Group(), m = skClone(t.scene);
  g.add(m);
  const skins = [], roots = [];
  m.traverse((c) => {
    if (c.isBone && !c.parent.isBone) roots.push(c);
    if (!c.isMesh) return;
    const col = (o.tint && o.tint[c.material.name]) || (sp.tint && sp.tint[c.material.name]);
    if (col) c.material = tinted(c.material, c.material.name, col);
    if (c.isSkinnedMesh) skins.push(c);
  });
  const mixer = new THREE.AnimationMixer(m);
  const act = (key) => (t.clips[key] ? mixer.clipAction(t.clips[key]) : null);
  const a = { g, sp, mixer, idle: act('idle'), walk: act('walk'), run: act('run'), cur: null, last: 0, px: NaN, pz: 0, v: 0,
    neck: sp.neck ? m.getObjectByName(sp.neck) : null, nq: new THREE.Quaternion(), bent: false };
  a.cur = a.idle;
  if (a.idle) { a.idle.play(); a.idle.time = Math.random() * a.idle.getClip().duration; } // sürü aynı anda kıpırdamasın
  a.mixer.update(0);
  a.fz = track(roots, skins, [...new Set(skins.map((s) => s.skeleton))]); // ekran dışındayken kemikler donar (donuk.js)
  for (const s of skins) s.onBeforeRender = (r, sc, cam) => tick(a, r, cam); // hangi parça önce çizilirse
  const body = dummy();
  g.userData = { legs: [dummy(), dummy(), dummy(), dummy()], head: dummy(), body, walk: 0, cc: true, glb: k, anim: a, back: t.back, bone: (n) => m.getObjectByName(n) };
  return g;
}

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _ax = new THREE.Vector3();
function fade(a, to) {
  if (!to || to === a.cur) return;
  to.reset().setEffectiveWeight(1).fadeIn(0.3).play();
  if (a.cur) a.cur.fadeOut(0.3);
  a.cur = to;
}
// her çizimde (görünürken) bir kez: hız ölçümü, klip seçimi, karıştırıcı, otlama eğimi. Uzaktaki küçük hayvanda 2-3 karede bir (donuk.js)
function tick(a, r, cam) {
  if (!seen(a.fz, r) || busy(a.fz, a.g, 1.5, r, cam)) return;
  const now = performance.now(), dt0 = Math.max(0.001, (now - a.last) / 1000);
  a.last = now;
  const dt = Math.min(0.1, dt0);
  a.g.getWorldPosition(_v);
  const d = Number.isNaN(a.px) ? 0 : Math.hypot(_v.x - a.px, _v.z - a.pz);
  if (d > 0.002) { a.g.getWorldDirection(_f); a.back = (_v.x - a.px) * _f.x + (_v.z - a.pz) * _f.z < -0.3 * d; } // geri geri: klip tersine
  a.px = _v.x; a.pz = _v.z;
  const v = d > 3 ? 0 : d / dt0; // ışınlanma yürümek sayılmaz
  a.v += (v - a.v) * Math.min(1, dt * 6);
  const sp = a.sp, u = a.g.userData, src = u.neck || u.head;
  let want = a.idle;
  if (a.v > 0.12 && a.walk) want = a.run && a.v > sp.runAt ? a.run : a.walk;
  fade(a, want);
  if (a.cur === a.walk) a.walk.timeScale = Math.min(sp.wmax || 2, Math.max(0.5, a.v / sp.ws)) * (a.back ? -1 : 1);
  if (a.cur === a.run && a.run) a.run.timeScale = sp.rs ? Math.min(1.8, Math.max(0.5, a.v / sp.rs)) : Math.min(1.6, Math.max(0.7, a.v / (sp.runAt * 2)));
  if (a.bent) { a.neck.quaternion.copy(a.nq); a.bent = false; }
  a.mixer.update(dt);
  const px = src ? src.rotation.x * (sp.bend || 1) : 0, py = src ? src.rotation.y : 0;
  if (a.neck && (Math.abs(px) > 0.01 || Math.abs(py) > 0.01)) {
    a.nq.copy(a.neck.quaternion); a.bent = true;
    a.neck.parent.getWorldQuaternion(_q).invert();
    a.g.getWorldQuaternion(_q2);
    _ax.set(1, 0, 0).applyQuaternion(_q2).applyQuaternion(_q); _q3.setFromAxisAngle(_ax, px); a.neck.quaternion.premultiply(_q3);
    if (Math.abs(py) > 0.01) { _ax.set(0, 1, 0).applyQuaternion(_q2).applyQuaternion(_q); _q3.setFromAxisAngle(_ax, py); a.neck.quaternion.premultiply(_q3); }
  }
  thawed(a.fz);
}
