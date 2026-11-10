// Hava durumu. 2026-11-05 kullanıcı: "Köye ara sıra yağmur yağsın ve yağmur yağdığında müşteri azalsın ve şemsiye kullananlarda olsun.
// Yani oyuncuyu zorlayacak kazancını olumsuz etkileyecek unsurlar olabilir. Yağmur, kar, fırtına gibi. Bunlar belli zamanlarda olur.
// Müşteri azalır. Hava açtığında tekrar kalabalık olur."
// Her oyun gününde (daylight.js DAY) mevsimine göre en çok bir hava olayı çıkar: yağmur, fırtına; kışın kar, tipi. Olay gün numarasından
// türetilir (kayıt gerekmez, sayfa yenilense de o gün aynı hava); ilk iki gün hep açık. 40 sn önce bulut toplanır (haber verilir),
// 15 sn'de kuvvetlenir, sonunda 15 sn'de diner; dindikten sonra 75 sn bekleyen müşteri akın eder (×1,35'ten 1'e iner).
// Süre 60-105 sn (2026-11-09 kullanıcı: "aşırı uzun sürmesin yağmur"; eskiden günün %17-30'u, 2-3,5 dakika).
// Etki: müşteri sıklığı (rating.js repMul × havaMul), sahil ayrıca boşalır, fırtınada şezlongdakiler kalkar (world.js havaBeach, havaKac);
// gök kararır, güneş söner, öğlen sıcağı düşer, şimşek çakar (daylight.js tintHava); müşterilerin bir kısmı şemsiye açar
// (models.js animateCharacter kolu kaldırır). Kuşlar yağmurda susar (ambience.js).
// Ses: gerçek yağmur, sağanak ve gök gürültüsü kaydı (assets/sfx/hava, Wikimedia Commons; kesme KoyBakkali-araclar/ses/kes3.py;
// kredi menu.js, final.js); tipinin rüzgârı kodla.
import * as THREE from 'three';
import { loadSound } from './sesyukle.js'; // eski Safari: .ogg yerine .m4a
import { G, toast } from './game.js';
import { ambienceBus, settings } from './audio.js';
import { mat } from './models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DAY } from './daylight.js';

// cust: müşteri sıklığına çarpan (en kuvvetli anında), beach: sahile ayrıca, dark: gökün kararması, n: yağış tanesi, wind: yatıklık,
// umb: şemsiye açanların payı, leave: şezlongdakinin saniyede kalkma olasılığı
const KINDS = {
  yagmur: { name: 'Yağmur', icon: '🌧️', cust: 0.6, beach: 0.25, dark: 0.45, fall: 0, n: 4200, wind: 0.15, umb: 0.7, snd: 'yagmur', leave: 0.04,
    warn: '☁️ Bulutlar toplanıyor: birazdan yağmur başlayacak, müşteri azalacak', start: '🌧️ Yağmur başladı: müşteri azaldı, sahil boşalıyor',
    info: '🌧️ Yağmur: müşteri daha seyrek gelir, sahil boşalır, kimi müşteri şemsiye açar. Hava açınca bekleyenler akın eder.' },
  firtina: { name: 'Fırtına', icon: '⛈️', cust: 0.3, beach: 0.05, dark: 0.7, fall: 0, n: 6000, wind: 1, umb: 0.85, snd: 'saganak', bolt: true, leave: 0.3,
    warn: '☁️ Kara bulutlar geliyor: birazdan fırtına kopacak, müşteri çok azalacak', start: '⛈️ Fırtına koptu: müşteri çok azaldı, sahildekiler kaçıyor',
    info: '⛈️ Fırtına: müşteri çok seyrek gelir, sahil boşalır, şimşek çakar. Dinince bekleyenler akın eder.' },
  kar: { name: 'Kar', icon: '🌨️', cust: 0.55, beach: 0.2, dark: 0.3, fall: 1, n: 2200, wind: 0.1, umb: 0.2, snd: null, leave: 0.04,
    warn: '☁️ Gök griye döndü: birazdan kar yağacak, müşteri azalacak', start: '🌨️ Kar yağıyor: müşteri azaldı',
    info: '🌨️ Kar: müşteri daha seyrek gelir, sahil boşalır. Kar dinince bekleyenler akın eder.' },
  tipi: { name: 'Tipi', icon: '❄️', cust: 0.35, beach: 0.05, dark: 0.55, fall: 1, n: 4200, wind: 1.6, umb: 0, snd: 'ruzgar', leave: 0.3,
    warn: '☁️ Rüzgâr sertleşiyor: birazdan tipi başlayacak, müşteri çok azalacak', start: '❄️ Tipi başladı: müşteri çok azaldı',
    info: '❄️ Tipi: kar ve sert rüzgâr, müşteri çok seyrek gelir. Dinince bekleyenler akın eder.' },
};
// mevsime göre bir günde olay olasılıkları (mevsim.js id)
const CHANCE = { ilkbahar: [['yagmur', 0.4], ['firtina', 0.1]], yaz: [['yagmur', 0.1], ['firtina', 0.15]], sonbahar: [['yagmur', 0.45], ['firtina', 0.2]],
  kis: [['kar', 0.45], ['tipi', 0.12], ['yagmur', 0.08]] };
const RAMP = 15, WARN = 40, RUSH = 75, RUSH_K = 0.35, LEN_MIN = 60, LEN_RND = 45; // sn
const CLEAR = 'Hava açtı: bekleyen müşteriler geri geliyor!';

export const hava = { kind: null, K: null, w: 0, rush: 1, icon: null, flash: 0 };
const smooth = (x) => { const v = Math.min(1, Math.max(0, x)); return v * v * (3 - 2 * v); };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let planN = -1, planD = null, force = null;
// günün olayı: { kind, t0, t1 } (günün kesri) ya da null
function plan(n) {
  if (force && force.n === n) return force.kind ? force : null;
  if (n === planN) return planD;
  planN = n; planD = null;
  if (n < 2) return null; // yeni oyuncu ilk iki gün rahat oynasın
  const r = rng(n * 9973 + 17), S = (G.season && G.season.id) || 'ilkbahar', roll = r();
  let acc = 0;
  for (const [kind, p] of CHANCE[S] || CHANCE.ilkbahar) {
    acc += p;
    if (roll < acc) { const t0 = 0.08 + r() * 0.54, len = (LEN_MIN + r() * LEN_RND) / DAY; planD = { kind, t0, t1: Math.min(t0 + len, 0.93) }; break; }
  }
  return planD;
}

// ---------- oyuna etkisi ----------
export const havaMul = () => (hava.K ? 1 - (1 - hava.K.cust) * hava.w : 1) * hava.rush;
export const havaBeach = () => (hava.K ? 1 - (1 - hava.K.beach) * hava.w : 1);
export const havaKac = (dt) => !!(hava.K && hava.w > 0.6 && Math.random() < dt * hava.K.leave);
// sahil yağışta tamamen boşalır (2026-11-08 kullanıcı: "yağmur yağınca sahilde kimse kalmamalı"): yağış başlayınca (w 0,3) yeni tatilci
// gelmez, denizdekiler çıkar, şezlongdakiler kalkar (her biri ortalama 1,4 sn içinde, hep birden değil); deniz bisikleti, jet ski,
// matkotçular ve kumdaki çocuk gider (beach.js). Hava açınca yeniden gelirler
export const havaIslak = () => !!(hava.K && hava.w > 0.3);
export const havaPlaj = (dt) => havaIslak() && Math.random() < dt * 0.7;
export const havaSicak = () => 1 - 0.9 * hava.w; // öğlen sıcağı (daylight.js day.heat)
export const havaW = () => hava.w;
export const havaInfo = () => (hava.K && hava.w > 0.15 ? hava.K.info : null);

// ---------- gök: daylight.js her karede paleti boyatır ----------
const GREY = { bg: new THREE.Color('#7f8a96'), sky: new THREE.Color('#9aa4ae'), sun: new THREE.Color('#c9d2dc'), snowBg: new THREE.Color('#c3ccd4') };
const WHITE = new THREE.Color('#f4f8ff');
export function tintHava(P) {
  const K = hava.K;
  if (K && hava.w > 0) {
    const d = K.dark * hava.w;
    P.bg.lerp(K.fall ? GREY.snowBg : GREY.bg, d); P.sky.lerp(GREY.sky, d); P.sun.lerp(GREY.sun, d);
    P.si *= 1 - 0.75 * d; P.hi *= 1 - 0.3 * d;
  }
  if (hava.flash > 0) { const f = hava.flash; P.hi *= 1 + 2.4 * f; P.si *= 1 + 1.2 * f; P.bg.lerp(WHITE, 0.55 * f); P.sky.lerp(WHITE, 0.6 * f); }
}

// ---------- yağış: taneler gölgelendiricide düşer (karede yalnız uniform) ----------
// 2026-11-09 kullanıcı: "yağmur damlalarını geliştir ve zoom out yağınca yağma efekti bozuluyor onu da optimize et". Eskiden nokta karelerinin içine
// ince çizgi boyanıyordu ve yağış oyuncunun çevresinde sabit 56 m'lik kutuydu: uzaklaşınca kutunun kenarı görünüyor, çizgi piksel altına inip titriyordu,
// her nokta 30 piksele kadar kare boyatıp çoğunu atıyordu. Şimdi her tane ekranda sabit genişlikte ince dörtgen (tek örnekli çizim); kutu, yükseklik, tane boyu
// ve hız kameranın uzaklığıyla (uK) büyür, yağış her yakınlıkta aynı görünür. Kutu kameranın baktığı yeri izler; tanelerin kaydırması (uOff) dünyaya sabit
// kalır, uzaklaşırken akmaz. Yere düşen tanelerin halkaları ayrı, ufak bir çizim.
const MAXN = 6000, MAXS = 900, BOX = 56, TOP = 16;
const quad = (pts) => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex([0, 1, 2, 0, 2, 3]); return g; };
const VS = `uniform float uT, uSnow, uWind, uK, uSize, uScale, uPx; uniform vec2 uRes, uOff; uniform vec3 uC; attribute vec3 aP; attribute float aR; varying float vA; varying vec2 vQ;
void main() {
  float sp = mix(15.0, 1.7, uSnow) * (0.75 + 0.5 * aR);
  float y = mod(aP.y * ${TOP.toFixed(1)} - uT * sp, ${TOP.toFixed(1)}) * uK;
  float x = uC.x + (fract(aP.x + uOff.x) - 0.5) * ${BOX.toFixed(1)} * uK;
  float z = uC.z + (fract(aP.z + uOff.y) - 0.5) * ${BOX.toFixed(1)} * uK;
  x += uWind * (${TOP.toFixed(1)} * uK - y) * mix(0.22, 0.55, uSnow) + uSnow * sin(uT * 1.3 + aR * 40.0) * 0.5 * uK;
  z += uSnow * cos(uT * 1.1 + aR * 31.0) * 0.4 * uK;
  float L = (0.75 + 0.85 * aR) * uK; // tane boyu
  vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
  vec4 a = projectionMatrix * mv, b = projectionMatrix * modelViewMatrix * vec4(x - uWind * 0.22 * L, y + L, z, 1.0);
  vQ = vec2(position.x, position.y * 2.0 - 1.0);
  vA = (0.55 + 0.45 * aR) * smoothstep(0.0, 1.5 * uK, y) * smoothstep(8.0 * uK, 16.0 * uK, -mv.z); // kameranın dibindeki iri taneler silinir
  if (a.w < 0.2 || b.w < 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 p;
  if (uSnow > 0.5) { // kar: yuvarlak, kameraya dönük
    float hs = min(0.5 * uSize * 0.45 * uK * uScale / max(1.0, -mv.z), 7.0 * uScale / 800.0);
    p = a; p.xy += vQ * hs * 2.0 / uRes * a.w;
  } else { // yağmur: başı (aşağı) ile kuyruğu arasında ekranda sabit kalınlıkta çizgi
    vec2 d = (b.xy / b.w - a.xy / a.w) * uRes;
    float l = length(d);
    vec2 n = l > 0.01 ? vec2(-d.y, d.x) / l : vec2(1.0, 0.0);
    p = mix(a, b, position.y); p.xy += n * position.x * (0.75 + 0.65 * aR) * uPx * 2.0 / uRes * p.w;
  }
  gl_Position = p;
}`;
const FS = `uniform float uSnow, uOp; uniform vec3 uCol; varying float vA; varying vec2 vQ;
void main() {
  float rain = (1.0 - smoothstep(0.35, 1.0, abs(vQ.x))) * (1.0 - smoothstep(-0.2, 1.0, vQ.y)); // başı parlak, kuyruğu silinir
  float r = length(vQ);
  float snow = 1.0 - smoothstep(0.4, 1.0, r);
  float a = mix(rain, snow, uSnow) * vA * uOp;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uCol, vec3(0.7, 0.76, 0.84), uSnow * smoothstep(0.24, 0.84, r)), a); // tanenin kıyısı griye döner: açık zeminde de seçilir
}`;
// yere değen tanenin halkası: kısa ömürlü, her turda başka yerde (gölgelendirici içi rastgele)
const SVS = `uniform float uT, uK; uniform vec2 uOff; uniform vec3 uC; attribute vec3 aP; attribute float aR; varying float vP; varying vec2 vQ;
float h(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float t = uT / (0.45 + 0.3 * aR) + aP.y * 11.0, id = floor(t);
  vP = t - id; vQ = position.xz;
  float x = uC.x + (fract(aP.x + h(id + aR * 91.0) + uOff.x) - 0.5) * ${BOX.toFixed(1)} * uK;
  float z = uC.z + (fract(aP.z + h(id + aR * 57.0) + uOff.y) - 0.5) * ${BOX.toFixed(1)} * uK;
  float r = (0.06 + 0.24 * vP) * min(uK, 1.5); // uzaklaşınca halka büyümez
  gl_Position = projectionMatrix * modelViewMatrix * vec4(x + position.x * r, 0.13, z + position.z * r, 1.0);
}`;
const SFS = `uniform float uOp; uniform vec3 uCol; varying float vP; varying vec2 vQ;
void main() {
  float r = length(vQ), a = smoothstep(0.45, 0.78, r) * (1.0 - smoothstep(0.82, 1.0, r)) * (1.0 - vP * vP) * uOp;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uCol, a);
}`;
let pts = null, spl = null;
const SZ = new THREE.Vector2(), TGT = new THREE.Vector3(), DIR = new THREE.Vector3(), FALL_C = { x: 0, z: 0, on: false };
function makeFall() {
  const rnd = rng(4242);
  const inst = (geo, n) => {
    const p = new Float32Array(n * 3), r = new Float32Array(n);
    for (let i = 0; i < n; i++) { p[i * 3] = rnd(); p[i * 3 + 1] = rnd(); p[i * 3 + 2] = rnd(); r[i] = rnd(); }
    geo.setAttribute('aP', new THREE.InstancedBufferAttribute(p, 3)); geo.setAttribute('aR', new THREE.InstancedBufferAttribute(r, 1));
    return geo;
  };
  const shared = { uT: { value: 0 }, uK: { value: 1 }, uOff: { value: new THREE.Vector2() }, uC: { value: new THREE.Vector3() }, uOp: { value: 0 }, uCol: { value: new THREE.Color('#d6e2ee') } };
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...shared, uSnow: { value: 0 }, uWind: { value: 0 }, uSize: { value: 1 }, uScale: { value: 400 }, uPx: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) } } });
  pts = new THREE.Mesh(inst(quad([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), MAXN), m);
  const ms = new THREE.ShaderMaterial({ vertexShader: SVS, fragmentShader: SFS, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: shared.uT, uK: shared.uK, uOff: shared.uOff, uC: shared.uC, uOp: { value: 0 }, uCol: { value: new THREE.Color('#f2f7fc') } } });
  spl = new THREE.Mesh(inst(quad([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), MAXS), ms);
  for (const o of [pts, spl]) { o.frustumCulled = false; o.visible = false; o.matrixAutoUpdate = false; o.layers.enableAll(); G.scene.add(o); }
  pts.renderOrder = 6; spl.renderOrder = 5;
}
function stepFall(dt) {
  const K = hava.K, on = K && hava.w > 0.02;
  if (!on) { if (pts) pts.visible = spl.visible = false; FALL_C.on = false; return; }
  if (!pts) makeFall();
  const u = pts.material.uniforms, us = spl.material.uniforms, cam = G.camera;
  if (K.fall !== curFall) { curFall = K.fall; u.uSnow.value = K.fall; u.uCol.value.set(K.fall ? '#ffffff' : '#7d97b8'); }
  u.uT.value += dt; u.uWind.value = K.wind * (0.8 + 0.2 * Math.sin(u.uT.value * 0.4));
  u.uSize.value = K.fall ? 0.8 : 1.1; u.uOp.value = Math.min(1, hava.w * 1.4) * (K.fall ? 0.95 : 1.0);
  // yağış kutusu kameranın baktığı yerde; her şey kameranın uzaklığıyla orantılı (varsayılan yakınlıkta 23,8 m, uK 1)
  cam.getWorldDirection(DIR);
  const d = DIR.y < -0.12 ? Math.min(-cam.position.y / DIR.y, 160) : 60, zk = Math.max(0.55, d / 23.8);
  const bw = BOX * zk, fw = 0.12 * bw / Math.max(0.001, Math.hypot(DIR.x, DIR.z)); // ekranın üstü daha uzak: kutu biraz ileride
  TGT.set(cam.position.x + DIR.x * (d + fw), 0, cam.position.z + DIR.z * (d + fw));
  if (FALL_C.on) { const o = u.uOff.value; o.x -= (TGT.x - FALL_C.x) / bw; o.y -= (TGT.z - FALL_C.z) / bw; o.x -= Math.floor(o.x); o.y -= Math.floor(o.y); }
  FALL_C.x = TGT.x; FALL_C.z = TGT.z; FALL_C.on = true;
  u.uC.value.copy(TGT); u.uK.value = zk;
  if (G.renderer) { G.renderer.getDrawingBufferSize(SZ); u.uRes.value.copy(SZ); u.uPx.value = G.renderer.getPixelRatio(); u.uScale.value = SZ.y / (2 * Math.tan((cam.fov * Math.PI) / 360)); }
  const q = settings.quality, qk = q === 'pil' ? 0.4 : q === 'dusuk' ? 0.6 : 1; // Performans ve Pil tasarrufunda daha az tane
  pts.visible = true; pts.geometry.instanceCount = Math.min(MAXN, Math.round(K.n * qk * (0.35 + 0.65 * hava.w)));
  spl.visible = !K.fall && q !== 'pil';
  if (spl.visible) { us.uOp.value = 0.7 * Math.min(1, hava.w * 1.4) / Math.max(1, zk * 0.7); spl.geometry.instanceCount = Math.min(MAXS, Math.round(K.n * 0.16 * qk * hava.w)); }
}
// gölgelendirici olay başlamadan (uyarıda) derlenir: telefonda ilk yağış karesi takılmasın
let curFall = -1, warmed = false;
function prewarm() {
  if (warmed || !G.renderer || !G.camera || !G.scene) return;
  warmed = true;
  if (!pts) makeFall();
  const R = G.renderer, sc = new THREE.Scene();
  for (const o of [pts, spl]) { const p = new THREE.Mesh(o.geometry, o.material); p.frustumCulled = false; sc.add(p); }
  try { if (R.compileAsync) R.compileAsync(sc, G.camera, G.scene).catch(() => {}); else R.compile(sc, G.camera, G.scene); } catch (e) { /* derlenemezse ilk karede derlenir */ }
}

// ---------- şemsiye ----------
const UCOL = ['#d8443a', '#2f6fd6', '#f2b632', '#3aa067', '#7a4fc4', '#2a2f38', '#e86fa6', '#f07f2e'];
let UG = null;
// kubbe 8 dilim (dört açık, dört koyu ayrı parça), sap ile uç bir parça. Düz renkli malzeme: perf.js karakterin toplu çizimine katar,
// yeni gölgelendirici derlenmez, çizim çağrısı artmaz
function umbParts() {
  if (UG) return UG;
  const can = new THREE.ConeGeometry(0.75, 0.36, 8, 1, true).toNonIndexed(); can.translate(0, 1.38, 0);
  const cp = can.attributes.position.array, half = (odd) => {
    const out = [];
    for (let i = 0; i < cp.length; i += 9) {
      const x = cp[i] + cp[i + 3] + cp[i + 6], z = cp[i + 2] + cp[i + 5] + cp[i + 8];
      if ((Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * 8) % 2 === 1) === odd) for (let j = 0; j < 9; j++) out.push(cp[i + j]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.computeVertexNormals();
    return g;
  };
  const tip = new THREE.CylinderGeometry(0.014, 0.014, 0.14, 4).translate(0, 1.62, 0), sh = new THREE.CylinderGeometry(0.016, 0.016, 1.2, 5).translate(0, 0.6, 0);
  UG = { a: half(false), b: half(true), sh: mergeGeometries([tip, sh]), light: UCOL.map((c) => mat(c, { rough: 0.6 })),
    dark: UCOL.map((c) => mat('#' + new THREE.Color(c).multiplyScalar(0.62).getHexString(), { rough: 0.6 })), shaft: mat('#2b2b2b') };
  return UG;
}
// sağ elde (kol 0, -x yanı), kol öne kalkık (models.js umb): sap elden yukarı, kubbe başın üstüne hafif geri yatık
function addUmb(obj) {
  const U = umbParts(), i = Math.floor(Math.random() * UCOL.length), g = new THREE.Group();
  for (const [geo, m] of [[U.a, U.light[i]], [U.b, U.dark[i]], [U.sh, U.shaft]]) { const me = new THREE.Mesh(geo, m); me.castShadow = true; g.add(me); }
  g.position.set(-0.24, 1.08, 0.42); g.rotation.x = -0.32;
  g.userData.umbrella = true;
  obj.add(g); obj.userData.umb = true;
  return g;
}
function dropUmb(c) { if (c.umb) { c.umb.removeFromParent(); c.obj.userData.umb = false; } delete c.umb; }
let umbT = 0;
function stepUmb(dt) {
  if ((umbT -= dt) > 0) return;
  umbT = 0.3;
  const K = hava.K, wet = K && K.umb > 0 && hava.w > 0.45, dry = !K || hava.w < 0.25;
  let add = 3, drop = 4; // geçişte hepsi aynı karede açılıp kapanmaz: karakterin toplu çizimi yeniden kurulur (perf.js), yük karelere yayılır
  for (const c of G.customers || []) {
    if (!c.obj) continue;
    if (wet && c.umb === undefined && !c.riding && add > 0) { add--; c.umb = Math.random() < K.umb ? addUmb(c.obj) : null; }
    else if (dry && c.umb !== undefined && drop > 0) { drop--; dropUmb(c); }
    if (c.umb) { const hide = !!(c.lying || c.riding || /wim|drown/.test(c.state || '')); c.umb.visible = !hide; c.obj.userData.umb = !hide; }
  }
}

// ---------- ses ----------
const SES = { yagmur: { f: 'yagmur.ogg' }, saganak: { f: 'saganak.ogg' }, gok: { f: 'gok.ogg', p: [[0, 7], [7.25, 4.3], [11.8, 3.3]] } };
const VOL = { yagmur: 0.38, saganak: 0.45, ruzgar: 0.22, gok: 0.75 }; // ölçüm: yağmurda ortam sesi açık havanın ≈ 2,5 katı
let A = null, OUT = null;
const loops = {};
function load(S) {
  if (S.buf) return true;
  if (!S.loading) { S.loading = true; loadSound(A, 'assets/sfx/hava/' + S.f).then((b) => { S.buf = b; }).catch(() => { S.loading = false; }); }
  return false;
}
function noiseBuf() { const n = A.sampleRate * 2, b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return b; }
function startLoop(k) {
  const s = A.createBufferSource(), g = A.createGain(); g.gain.value = 0;
  if (k === 'ruzgar') { // tipi: kahverengi gürültü, bant geçiren ve yavaş salınan frekansla uğultu
    s.buffer = noiseBuf(); const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.8;
    const lfo = A.createOscillator(), lg = A.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 260; lfo.connect(lg).connect(bp.frequency); lfo.start();
    s.connect(bp).connect(g); loops[k] = { s, g, lfo };
  } else { if (!load(SES[k])) return null; s.buffer = SES[k].buf; s.connect(g); loops[k] = { s, g }; }
  s.loop = true; g.connect(OUT); s.start(A.currentTime + 0.02, k === 'ruzgar' ? 0 : Math.random() * s.buffer.duration);
  return loops[k];
}
let sndT = 0;
function stepSound(dt) {
  if ((sndT -= dt) > 0) return;
  sndT = 0.25; // ses düzeyi saniyede 4 kez (her kare zamanlama olayı eklemesin)
  const b = ambienceBus(); if (!b) return;
  A = b.A; OUT = b.out;
  const want = hava.K && hava.w > 0.01 ? hava.K.snd : null, now = A.currentTime;
  for (const k of ['yagmur', 'saganak', 'ruzgar']) {
    let L = loops[k];
    const v = k === want ? VOL[k] * hava.w : 0;
    if (v > 0 && !L) L = startLoop(k);
    if (!L) continue;
    L.g.gain.setTargetAtTime(v, now, 0.6);
    if (v === 0 && L.g.gain.value < 0.002) { L.s.stop(); if (L.lfo) L.lfo.stop(); delete loops[k]; }
  }
}
// uyarı sırasında kayıt önceden yüklenir: yağmur başladığında ses hemen gelir
function preload(kind) {
  const b = ambienceBus(), K = KINDS[kind]; if (!b || !K) return;
  A = b.A; OUT = b.out;
  if (SES[K.snd]) load(SES[K.snd]);
  if (K.bolt) load(SES.gok);
}
function thunder(delay, near) {
  if (!A || !OUT || !load(SES.gok)) return;
  const S = SES.gok, [o, d] = S.p[Math.floor(Math.random() * S.p.length)], s = A.createBufferSource(), lp = A.createBiquadFilter(), g = A.createGain();
  s.buffer = S.buf; s.playbackRate.value = 0.9 + Math.random() * 0.2; lp.type = 'lowpass'; lp.frequency.value = near ? 9000 : 1400;
  g.gain.value = VOL.gok * (near ? 1 : 0.55);
  s.connect(lp).connect(g).connect(OUT); s.start(A.currentTime + delay, o, d);
}

// ---------- şimşek ----------
let boltT = 8, fl = null;
function stepBolt(dt) {
  hava.flash = 0;
  if (fl) { fl.t += dt; const t = fl.t; hava.flash = t < 0.08 ? 1 : t < 0.16 ? 0.25 : t < 0.24 ? 0.85 : Math.max(0, 0.85 - (t - 0.24) * 3); if (t > 0.6) fl = null; }
  if (!hava.K || !hava.K.bolt || hava.w < 0.5) return;
  if ((boltT -= dt) > 0) return;
  boltT = 6 + Math.random() * 9;
  const near = Math.random() < 0.4;
  fl = { t: 0 };
  thunder(near ? 0.15 + Math.random() * 0.3 : 0.8 + Math.random() * 1.8, near);
}

// ---------- karede ----------
let lastDay = -1, said = {};
export function updateHava(dt) {
  if (!G.stats || typeof G.stats.dayT !== 'number') return;
  const n = G.stats.dayN || 0, t = G.stats.dayT, P = plan(n);
  if (n !== lastDay) { lastDay = n; said = {}; }
  let w = 0, rush = 1, warn = false;
  if (P) {
    const a = (t - P.t0) * DAY, b = (P.t1 - t) * DAY;
    if (a >= 0 && b >= 0) w = smooth(a / RAMP) * smooth(b / RAMP);
    warn = a < 0 && a > -WARN;
    if (b < 0 && -b < RUSH) rush = 1 + RUSH_K * (1 - -b / RUSH);
    if (warn && !said.warn) { said.warn = true; if (dt > 0) toast(KINDS[P.kind].warn); }
    if (w > 0.5 && !said.start) { said.start = true; if (dt > 0) toast(KINDS[P.kind].start); }
    if (b < 0 && said.start && !said.end) { said.end = true; if (dt > 0) toast(`🌤️ ${CLEAR}`); }
  }
  hava.kind = P && (w > 0 || warn) ? P.kind : null; hava.K = P && w > 0 ? KINDS[P.kind] : null;
  hava.w = w; hava.rush = rush;
  hava.icon = hava.K && w > 0.15 ? hava.K.icon : warn || (P && w > 0) ? '☁️' : rush > 1 ? '🌤️' : null;
  if (warn || w > 0) { prewarm(); preload(P.kind); }
  stepFall(dt); stepUmb(dt); stepSound(dt); stepBolt(dt);
  // pozlama: gök kapanınca bütün sahne biraz kararır, şimşekte bir an aydınlanır (main.js 1,0 bırakır, başka yer değiştirmez)
  const ex = (1 - 0.3 * (hava.K ? hava.K.dark * w : 0)) * (1 + 0.35 * hava.flash);
  if (G.renderer && Math.abs(G.renderer.toneMappingExposure - ex) > 0.002) G.renderer.toneMappingExposure = ex;
}

// test kancası: __hava('yagmur' | 'firtina' | 'kar' | 'tipi', sn) olayı şimdi başlatır (rampa dahil), 'acik' bugünü açık yapar,
// 'simsek' şimşek çaktırır; __hava() durumu verir
window.__hava = (kind, sec = 120) => {
  if (kind === 'simsek') { fl = { t: 0 }; thunder(0.3, true); }
  else if (kind && G.stats) { const t = G.stats.dayT; force = { n: G.stats.dayN || 0, kind: KINDS[kind] ? kind : null, t0: t, t1: Math.min(t + sec / DAY, 0.95) }; said = {}; }
  return { kind: hava.kind, w: +hava.w.toFixed(2), rush: +hava.rush.toFixed(2), mul: +havaMul().toFixed(2), beach: +havaBeach().toFixed(2), plan: plan(G.stats ? G.stats.dayN || 0 : 0), umb: (G.customers || []).filter((c) => c.umb).length, cust: (G.customers || []).length };
};
