// Hava durumu. 2026-11-05 kullanıcı: "Köye ara sıra yağmur yağsın ve yağmur yağdığında müşteri azalsın ve şemsiye kullananlarda olsun.
// Yani oyuncuyu zorlayacak kazancını olumsuz etkileyecek unsurlar olabilir. Yağmur, kar, fırtına gibi. Bunlar belli zamanlarda olur.
// Müşteri azalır. Hava açtığında tekrar kalabalık olur."
// Her oyun gününde (daylight.js DAY) mevsimine göre en çok bir hava olayı çıkar: yağmur, fırtına; kışın kar, tipi. Olay gün numarasından
// türetilir (kayıt gerekmez, sayfa yenilense de o gün aynı hava); ilk iki gün hep açık. 40 sn önce bulut toplanır (haber verilir),
// 25 sn'de kuvvetlenir, sonunda 25 sn'de diner; dindikten sonra 75 sn bekleyen müşteri akın eder (×1,35'ten 1'e iner).
// Etki: müşteri sıklığı (rating.js repMul × havaMul), sahil ayrıca boşalır, fırtınada şezlongdakiler kalkar (world.js havaBeach, havaKac);
// gök kararır, güneş söner, öğlen sıcağı düşer, şimşek çakar (daylight.js tintHava); müşterilerin bir kısmı şemsiye açar
// (models.js animateCharacter kolu kaldırır). Kuşlar yağmurda susar (ambience.js).
// Ses: gerçek yağmur, sağanak ve gök gürültüsü kaydı (assets/sfx/hava, Wikimedia Commons; kesme KoyBakkali-araclar/ses/kes3.py;
// kredi menu.js, final.js); tipinin rüzgârı kodla.
import * as THREE from 'three';
import { G, toast } from './game.js';
import { ambienceBus, settings } from './audio.js';
import { mat } from './models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DAY } from './daylight.js';

// cust: müşteri sıklığına çarpan (en kuvvetli anında), beach: sahile ayrıca, dark: gökün kararması, n: yağış tanesi, wind: yatıklık,
// umb: şemsiye açanların payı, leave: şezlongdakinin saniyede kalkma olasılığı
const KINDS = {
  yagmur: { name: 'Yağmur', icon: '🌧️', cust: 0.6, beach: 0.25, dark: 0.45, fall: 0, n: 2600, wind: 0.15, umb: 0.7, snd: 'yagmur', leave: 0.04,
    warn: '☁️ Bulutlar toplanıyor: birazdan yağmur başlayacak, müşteri azalacak', start: '🌧️ Yağmur başladı: müşteri azaldı, sahil boşalıyor',
    info: '🌧️ Yağmur: müşteri daha seyrek gelir, sahil boşalır, kimi müşteri şemsiye açar. Hava açınca bekleyenler akın eder.' },
  firtina: { name: 'Fırtına', icon: '⛈️', cust: 0.3, beach: 0.05, dark: 0.7, fall: 0, n: 5000, wind: 1, umb: 0.85, snd: 'saganak', bolt: true, leave: 0.3,
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
const RAMP = 25, WARN = 40, RUSH = 75, RUSH_K = 0.35; // sn
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
    if (roll < acc) { const t0 = 0.08 + r() * 0.54, len = 0.17 + r() * 0.13; planD = { kind, t0, t1: Math.min(t0 + len, 0.93) }; break; }
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

// ---------- yağış: tek çizim, taneler gölgelendiricide düşer (karede yalnız uniform) ----------
const MAXN = 5000, BOX = 56, TOP = 16;
const VS = `uniform float uT, uSnow, uWind, uSize, uScale; uniform vec3 uC; attribute float aR; varying float vA;
void main() {
  float sp = mix(15.0, 1.7, uSnow) * (0.75 + 0.5 * aR);
  float y = mod(position.y * ${TOP.toFixed(1)} - uT * sp, ${TOP.toFixed(1)});
  float bx = position.x * ${BOX.toFixed(1)}, bz = position.z * ${BOX.toFixed(1)};
  float x = uC.x + mod(bx - uC.x + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
  float z = uC.z + mod(bz - uC.z + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)};
  x += uWind * (${TOP.toFixed(1)} - y) * mix(0.22, 0.55, uSnow) + uSnow * sin(uT * 1.3 + aR * 40.0) * 0.5;
  z += uSnow * cos(uT * 1.1 + aR * 31.0) * 0.4;
  vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
  gl_PointSize = min(uSize * mix(1.0, 0.45, uSnow) * uScale / max(1.0, -mv.z), mix(30.0, 14.0, uSnow) * uScale / 800.0);
  gl_Position = projectionMatrix * mv;
  vA = (0.55 + 0.45 * aR) * smoothstep(0.0, 1.5, y) * smoothstep(8.0, 16.0, -mv.z); // kameranın dibindeki iri taneler silinir
}`;
const FS = `uniform float uSnow, uOp, uWind; uniform vec3 uCol; varying float vA;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float rain = (1.0 - smoothstep(0.02, 0.055, abs(q.x - q.y * uWind * 0.3))) * (1.0 - smoothstep(0.3, 0.5, abs(q.y)));
  float snow = 1.0 - smoothstep(0.2, 0.5, length(q));
  float a = mix(rain, snow, uSnow) * vA * uOp;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uCol, vec3(0.7, 0.76, 0.84), uSnow * smoothstep(0.12, 0.42, length(q))), a); // tanenin kıyısı griye döner: açık zeminde de seçilir
}`;
let pts = null;
const SZ = new THREE.Vector2();
function makeFall() {
  const geo = new THREE.BufferGeometry(), p = new Float32Array(MAXN * 3), r = new Float32Array(MAXN), rnd = rng(4242);
  for (let i = 0; i < MAXN; i++) { p[i * 3] = rnd(); p[i * 3 + 1] = rnd(); p[i * 3 + 2] = rnd(); r[i] = rnd(); }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('aR', new THREE.BufferAttribute(r, 1));
  const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uSnow: { value: 0 }, uWind: { value: 0 }, uSize: { value: 1 }, uScale: { value: 400 }, uOp: { value: 0 }, uC: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color('#d6e2ee') } } });
  pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 6; pts.visible = false; pts.matrixAutoUpdate = false;
  pts.layers.enableAll();
  G.scene.add(pts);
}
function stepFall(dt) {
  const K = hava.K, on = K && hava.w > 0.02;
  if (!on) { if (pts) pts.visible = false; return; }
  if (!pts) makeFall();
  const u = pts.material.uniforms, c = G.player ? G.player.position : G.camera.position;
  pts.visible = true;
  if (K.fall !== curFall) { curFall = K.fall; u.uSnow.value = K.fall; u.uCol.value.set(K.fall ? '#ffffff' : '#7f9bbb'); } // gün ışığında açık renk yağmur seçilmiyor: koyu mavi gri
  u.uT.value += dt; u.uWind.value = K.wind * (0.8 + 0.2 * Math.sin(u.uT.value * 0.4));
  u.uSize.value = K.fall ? 0.8 : 1.1; u.uOp.value = Math.min(1, hava.w * 1.4) * (K.fall ? 0.95 : 0.85);
  u.uC.value.set(c.x, 0, c.z);
  if (G.renderer) { G.renderer.getDrawingBufferSize(SZ); u.uScale.value = SZ.y / (2 * Math.tan((G.camera.fov * Math.PI) / 360)); }
  const q = settings.quality; // Performans ve Pil tasarrufunda daha az tane (ekran kartının boyadığı nokta sayısı)
  pts.geometry.setDrawRange(0, Math.round(K.n * (q === 'pil' ? 0.4 : q === 'dusuk' ? 0.6 : 1) * (0.35 + 0.65 * hava.w)));
}
// gölgelendirici olay başlamadan (uyarıda) derlenir: telefonda ilk yağış karesi takılmasın
let curFall = -1, warmed = false;
function prewarm() {
  if (warmed || !G.renderer || !G.camera || !G.scene) return;
  warmed = true;
  if (!pts) makeFall();
  const R = G.renderer, sc = new THREE.Scene(), p = new THREE.Points(pts.geometry, pts.material);
  p.frustumCulled = false; sc.add(p);
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
  if (!S.loading) { S.loading = true; fetch('assets/sfx/hava/' + S.f).then((r) => r.arrayBuffer()).then((b) => A.decodeAudioData(b)).then((b) => { S.buf = b; }).catch(() => { S.loading = false; }); }
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
