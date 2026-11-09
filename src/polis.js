// Polis: bekçi hırsızı yakalayınca (thief.js thiefCaught) hırsızı yere yatırır, üstüne çöküp kelepçeler, telsizle polisi çağırır.
// Polis aracı en yakın yoldan (ana yol ya da pazar caddesi) siren çalarak gelir, sağ yanı kaldırıma bakacak şekilde durur; yanındaki
// memur iner. Bekçi kelepçeli hırsızı kolundan tutup araca götürür, selamlaşıp memura teslim eder; memur arka kapıyı açar, hırsızın başını
// eğdirip arka koltuğa oturtur, kapıyı kapar, aracına biner; araç U dönüşüyle geldiği uca gider.
// Köpek ya da oyuncu yakalarsa hırsız yere düşer, bekçi koşup gelir. Bekçi yoksa thief.js'teki eski akış (sersemleyip kaçar) sürer.
// 2026-11-08 kullanıcı: "bekçi hırsızı yakalama animasyonunu gerçek gibi geliştir ve polis aracı gelip alsın götürsün bekçi polise teslim etsin"
import * as THREE from 'three';
import * as M from './models.js';
import { G, floatText, sfx, lerpAngle, toast } from './game.js';
import { banner } from './ui.js';
import { smoke, sparkle } from './fx.js';
import { findRoute, heightAt } from './world.js';
import { animateDog } from './thief.js';
import { EN } from './dil.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ROAD_FAR = -140; // ana yolun batı ucu (events.js ROAD_FAR; içe aktarılmaz: modül yükleme sırası değişmesin)
const K = 1.2; // araç ölçeği: köy arabaları gibi (models.js makeVillageCar), oturan tam boy karakter kabine sığar
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const COP = { shirt: '#22406e', pants: '#1b2638', hat: 'cap', hatColor: '#16243f', skin: '#e2b48c', mustache: true };
const MATE = { shirt: '#22406e', pants: '#1b2638', hat: 'cap', hatColor: '#16243f', skin: '#c99670' };

// polisin durduğu yollar. lane: geliş şeridi (z), d: gidiş yönü (+1 doğuya), [x0, x1]: aracın ortasının durabileceği aralık, bans: durmayacağı
// yerler (yaya geçidi ±3,75: araç geçidin üstünde kalmasın; kasaba durağı, dolmuşun U dönüşü ve paket cebinin ağzı; köprü, orada kaldırım
// yok), back: dönüş
// şeridi, far: belirip kaybolduğu uç. Sağ yanı (arka kapı) kaldırıma bakar
const ROADS = [
  { lane: -17.4, d: 1, x0: -57.2, x1: 8.8, bans: [[-49.3, -21.5], [-17.9, -10.3]], back: -19.8, far: ROAD_FAR, ok: () => true },
  { lane: 6.0, d: -1, x0: 34.4, x1: 125, bans: [[55.4, 75.3], [89.8, 97.4]], back: 7.4, far: 150, ok: () => !!(G.regions.pazar && G.regions.pazar.unlocked) },
];
function fit(R, x) {
  x = Math.max(R.x0, Math.min(R.x1, x));
  for (const [a, b] of R.bans) {
    if (x <= a || x >= b) continue;
    const lo = a >= R.x0, hi = b <= R.x1;
    x = !lo ? b : !hi ? a : x - a < b - x ? a : b;
  }
  return x;
}
// araca göre yer: side kaldırım yanına (sağa), fwd ileriye metre
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z); // yerde uzaklık (kaldırımın yüksekliği sayılmaz)
const off = (A, side, fwd) => V(A.x + A.d * fwd, 0, A.lane + A.d * side);
const P_H = [2.05, -2.15];  // kelepçeli hırsız bekçiyle burada bekler (kaldırım, arka kapının arkası)
const P_E = [1.2, -1.05];   // arka kapının ağzı: hırsız buradan arka koltuğa oturur
const P_O = [2.35, -0.25];  // memur arka kapıyı buradan açar
const P_X = [1.55, -0.05];  // memurun ön kapıdan indiği ve bindiği yer
const P_G = [2.8, -2.9];    // teslimden sonra bekçi bir adım geri çekilir
const SEAT = V(-0.4, 0.107, -0.85); // arka sağ koltuk (aracın içinde, ölçeksiz)
const DOOR_OPEN = 0.95;

function pickRoad(p) {
  let best = null;
  for (const R of ROADS) {
    if (!R.ok()) continue;
    const A = { R, x: fit(R, p.x), d: R.d, lane: R.lane }, h = off(A, ...P_H), dist = Math.hypot(h.x - p.x, h.z - p.z);
    if (!best || dist < best.dist) best = Object.assign(A, { dist });
  }
  return best;
}

// ---------- polis aracı ----------
// beyaz sedan, lacivert-mavi şerit, kapılarda POLİS ve 155, tavanda kırmızı-mavi tepe lambası (ışıltısı tepe lambasıyla yanıp söner)
const TEXT = {}, GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
function textMat(s, cw) {
  if (TEXT[s]) return TEXT[s];
  const c = document.createElement('canvas'); c.width = cw; c.height = 48;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.font = '900 40px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(s, cw / 2, 26, cw - 10);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (TEXT[s] = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.5 }));
}
let GLOW = null;
function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return (GLOW = new THREE.CanvasTexture(c));
}
export function makePoliceCar() {
  const g = new THREE.Group(), wheels = [];
  const white = M.mat('#f4f6f8', { rough: 0.45 }), navy = M.mat('#1d3f8f'), sky = M.mat('#3f8fe0'), dark = M.mat('#2a2f36');
  M.rbox(1.8, 0.55, 4.1, 0.14, white, 0, 0.62, 0, g);
  M.rbox(1.82, 0.08, 4.12, 0.03, dark, 0, 0.37, 0, g);
  M.cabin(g, 1.58, 0.92, 2.2, 0.9, -0.25, white);
  for (const sx of [-1, 1]) { // çamurluklardaki şerit (kapılarınki kapıyla döner)
    M.rbox(0.03, 0.17, 4.0, 0.01, navy, sx * 0.905, 0.68, 0, g);
    M.rbox(0.03, 0.05, 4.0, 0.01, sky, sx * 0.905, 0.55, 0, g);
  }
  for (const z of [2.08, -2.08]) M.rbox(1.9, 0.14, 0.12, 0.05, dark, 0, 0.45, z, g);
  M.rbox(1.0, 0.16, 0.04, 0.02, dark, 0, 0.66, 2.06, g);
  const lamp = M.mat('#fff6c8', { emissive: '#ffe9a0', ei: 0.3 }), tail = M.mat('#d8342c', { emissive: '#ff2a1a', ei: 0.35 });
  for (const sx of [-1, 1]) { M.rbox(0.36, 0.12, 0.05, 0.02, lamp, sx * 0.62, 0.7, 2.06, g); M.rbox(0.32, 0.12, 0.05, 0.02, tail, sx * 0.64, 0.7, -2.06, g); }
  for (const [x, z] of [[-0.86, 1.35], [0.86, 1.35], [-0.86, -1.35], [0.86, -1.35]]) M.carWheel(g, 0.34, 0.24, x, 0.34, z, wheels);
  // kapılar: sol önde sürücü; sağ önde inen memur, sağ arkada hırsız (araç z ekseninde, sağ yan -x)
  const doors = {};
  for (const [k, x, z] of [['fl', 0.92, 0.6], ['fr', -0.92, 0.6], ['rl', 0.92, -0.4], ['rr', -0.92, -0.4]]) {
    const d = M.carDoor(g, x, 0.66, z, 0.95, 0.5, white), s = Math.sign(x), front = k[0] === 'f';
    M.rbox(0.02, 0.17, 0.95, 0.01, navy, s * 0.06, 0.02, -0.475, d);
    M.rbox(0.02, 0.05, 0.95, 0.01, sky, s * 0.06, -0.11, -0.475, d);
    const t = new THREE.Mesh(geo(front ? 'pf' : 'pr', () => new THREE.PlaneGeometry(front ? 0.8 : 0.4, 0.15)), front ? textMat(EN ? 'POLICE' : 'POLİS', 256) : textMat('155', 128));
    t.position.set(s * 0.073, 0.02, -0.475); t.rotation.y = s * PI / 2; d.add(t);
    doors[k] = d;
  }
  M.rbox(1.25, 0.08, 0.34, 0.03, dark, 0, 1.91, -0.2, g);
  const red = new THREE.MeshStandardMaterial({ color: '#e8473c', emissive: '#ff2a1a', emissiveIntensity: 0.2, roughness: 0.3 });
  const blue = new THREE.MeshStandardMaterial({ color: '#2f6fe0', emissive: '#1a5cff', emissiveIntensity: 0.2, roughness: 0.3 });
  M.rbox(0.56, 0.15, 0.3, 0.05, red, 0.31, 2.02, -0.2, g);
  M.rbox(0.56, 0.15, 0.3, 0.05, blue, -0.31, 2.02, -0.2, g);
  const glow = (col, x) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(x, 2.05, -0.2); s.scale.setScalar(1.7); g.add(s);
    return s;
  };
  const gr = glow('#ff3a2a', 0.31), gb = glow('#3a7dff', -0.31);
  const driver = M.sitter(COP, 0.38, 0.107, 0.1, 1 / K, g), mate = M.sitter(MATE, -0.38, 0.107, 0.1, 1 / K, g);
  g.scale.setScalar(K);
  g.userData = { wheels, doors, driver, mate, red, blue, gr, gb, kind: 'classic' }; // kind: motor sesi (aracses.js)
  return g;
}
function blink(car, on) {
  const u = car.userData, ph = (G.time * 5.5) % 2, a = on && ph < 1, b = on && ph >= 1;
  u.red.emissiveIntensity = a ? 2.6 : 0.2; u.blue.emissiveIntensity = b ? 2.6 : 0.2;
  u.gr.material.opacity = a ? 0.9 : 0; u.gb.material.opacity = b ? 0.9 : 0;
}

// ---------- kukla pozları ----------
function arms(u, x0, z0, x1, z1) { u.arms[0].rotation.x = x0; u.arms[0].rotation.z = z0; u.arms[1].rotation.x = x1; u.arms[1].rotation.z = z1; }
const CUFF = [0.55, 0.2]; // eller arkada birleşik (kelepçe)
function cuffed(u, e = 1) { arms(u, CUFF[0] * e, CUFF[1] * e, CUFF[0] * e, -CUFF[1] * e); }
// bekçi diz çöküp üstüne eğilir: bir bacak önde, öteki geride, gövde öne, eller aşağıda hırsızın sırtında
function kneel(w, e) {
  const u = w.obj.userData;
  if (u.rig) { u.rig.rotation.x = 0.42 * e; u.rig.position.y = -0.24 * e; }
  u.legs[0].rotation.x = -0.95 * e; u.legs[1].rotation.x = 0.55 * e;
  arms(u, -1.25 * e, 0.12 * e, -1.25 * e, -0.12 * e);
}
function lean(w, a) { const u = w.obj.userData; if (u.rig) { u.rig.rotation.x = a; u.rig.position.y = 0; } }
// selam: sağ el alına
function salute(u, e) { u.arms[0].rotation.x = -2.6 * e; u.arms[0].rotation.z = 0.55 * e; }
function makeCuffs() {
  const g = new THREE.Group(), steel = M.mat('#c9d1d9', { rough: 0.25 });
  for (const sx of [-1, 1]) { const r = M.mesh(geo('torus', () => new THREE.TorusGeometry(0.06, 0.016, 6, 14)), steel, sx * 0.075, 0, 0, g); r.rotation.x = PI / 2; }
  M.rbox(0.08, 0.022, 0.022, 0.008, steel, 0, 0, 0, g);
  return g;
}
// yürüyüş: noktaları sırayla, varınca true
function stepTo(o, q, dt, speed) {
  const p = o.position, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), st = speed * dt;
  if (d > 1e-4) o.rotation.y = lerpAngle(o.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
  if (d <= st) { p.x = q.x; p.z = q.z; return true; }
  p.x += (dx / d) * st; p.z += (dz / d) * st;
  return false;
}
function follow(o, path, dt, speed) { while (path.length) { if (!stepTo(o, path[0], dt, speed)) return false; path.shift(); } return true; }
const face = (o, q, dt, k = 8) => { o.rotation.y = lerpAngle(o.rotation.y, Math.atan2(q.x - o.position.x, q.z - o.position.z), 1 - Math.exp(-k * dt)); };

// ---------- sahne ----------
let S = null, told = false;
export const arresting = () => !!S;

// T: hırsız (thief.js), guard: bekçi (upgrades.js Guard), by: 'guard' | 'dog' | 'player'; hooks.done(): hırsız araçta (thief.js bırakır),
// hooks.flee(): sahne bozuldu (bekçi işten çıkarıldı), hırsız kaçar
export function arrest(T, guard, by, hooks) {
  if (S || !T || !guard || guard.gone) return false;
  const road = pickRoad(T.obj.position);
  if (!road) return false;
  const o = T.obj, f = V(Math.sin(o.rotation.y), 0, Math.cos(o.rotation.y));
  o.rotation.order = 'YXZ';
  S = G.arrest = { T, o, guard, by, hooks, road, f, from: o.position.clone(), phase: 'fall', t: 0, pitch: 0, dogHold: by === 'dog' && !!guard.dog, cuffs: null, car: null, cop: null, path: null, said: {} };
  road.H = off(road, ...P_H); road.E = off(road, ...P_E); road.O = off(road, ...P_O); road.X = off(road, ...P_X); road.G = off(road, ...P_G);
  T.state = 'arrest';
  if (G.player && o.position.distanceTo(G.player.position) < 30) G.camFocus = { pos: o.position, until: G.time + 1.6 };
  return true;
}

// hırsızın sırtının yanı: bekçi buraya çöker (bekçiye yakın taraf)
function kneelSpot(at) {
  const f = S.f, r = V(-f.z, 0, f.x), back = (at || S.o.position).clone().addScaledVector(f, 0.8), gp = S.guard.obj.position;
  S.back = back.clone();
  const s = (gp.x - back.x) * r.x + (gp.z - back.z) * r.z >= 0 ? 1 : -1;
  S.kSide = s;
  return back.addScaledVector(r, 0.62 * s);
}
function once(k) { if (S.said[k]) return false; S.said[k] = true; return true; }
function go(phase) { S.phase = phase; S.t = 0; }

export function updatePolice(dt) {
  if (!S) return;
  if (S.guard && S.guard.gone) { abort(); if (!S) return; }
  S.t += dt;
  if (S.T) thiefStep(dt);
  else if (S.guard) { S.guard.moving = false; guardFinish(dt, null); }
  if (S.car) carStep(dt);
}

function thiefStep(dt) {
  const o = S.o, u = o.userData, w = S.guard, gu = w.obj.userData, t = S.t, p = o.position;
  w.moving = false;
  let gPose = null, tSpeed = 0;
  switch (S.phase) {
    case 'fall': { // yere kapaklanır: yerçekimiyle hızlanarak öne düşer, biraz kayar
      const k = Math.min(1, t / 0.6);
      S.pitch = (PI / 2) * k * k;
      const s = 0.9 * (1 - (1 - k) * (1 - k));
      p.x = S.from.x + S.f.x * s; p.z = S.from.z + S.f.z * s;
      if (S.by === 'guard') { if (!S.K) S.K = kneelSpot(S.from.clone().addScaledVector(S.f, 0.9)); w.walkTo(S.K, dt, 5); gPose = () => { lean(w, 0.35); arms(gu, -1.5, 0.1, -1.5, -0.1); }; }
      if (t >= 0.6) {
        for (let i = 0; i < 7; i++) smoke(p.clone().addScaledVector(S.f, 0.2 + i * 0.25).setY(0.15), { color: '#f2ead8' });
        sfx('door', { at: p });
        S.K = kneelSpot();
        go(Math.hypot(w.obj.position.x - S.K.x, w.obj.position.z - S.K.z) < 0.25 ? 'pin' : 'reach');
      }
      break;
    }
    case 'reach': { // köpek ya da oyuncu yere düşürdü: bekçi koşup gelir; hırsız kalkmaya çalışır
      S.pitch = PI / 2 - 0.13 * Math.max(0, Math.sin(t * 3.1));
      if (Math.random() < dt * 5) sparkle(V(p.x + S.f.x * 1.4, 0.5, p.z + S.f.z * 1.4), '#ffe14d', 2);
      if (!w.path.length || w.path[w.path.length - 1] !== S.K) { w.path = [S.K]; w.leg = null; }
      const near = Math.hypot(w.obj.position.x - S.K.x, w.obj.position.z - S.K.z) < 0.12;
      if (near || w.walkPath(dt, Math.max(w.speed || 4, 4.8)) || t > 25) { w.path = []; w.obj.position.x = S.K.x; w.obj.position.z = S.K.z; go('pin'); }
      break;
    }
    case 'pin': { // üstüne çöker, düdük çalar; hırsız çırpınır, yavaş yavaş durulur
      S.pitch = PI / 2;
      if (once('pin')) { S.dogHold = false; sfx('whistle', { at: p }); floatText(w.obj.position, '🗣️ Kımıldama!', 'shout'); }
      face(w.obj, S.back, dt, 12);
      gPose = () => kneel(w, ease(t / 0.3));
      if (t >= 1.0) go('cuff');
      break;
    }
    case 'cuff': { // kollarını arkada birleştirip kelepçeler
      S.pitch = PI / 2;
      face(w.obj, S.back, dt, 12);
      gPose = () => { kneel(w, 1); arms(gu, -1.15 + 0.13 * Math.sin(t * 14), 0.2, -1.15 - 0.13 * Math.sin(t * 14), -0.2); };
      if (t >= 0.95 && once('cuff')) {
        S.cuffs = makeCuffs(); S.cuffs.position.set(0, 0.8, -0.3); o.add(S.cuffs);
        sfx('cuff', { at: p }); floatText(p, '🔗 Kelepçelendi!', 'pos');
        S.T.tp.innerHTML = '🔗 <b>Kelepçeli</b>';
      }
      if (t >= 1.6) go('radio');
      break;
    }
    case 'radio': { // doğrulup telsizle polisi çağırır
      S.pitch = PI / 2;
      if (t >= 0.35 && once('radio')) {
        dispatch(); sfx('radio', { at: w.obj.position }); floatText(w.obj.position, '📻 Polis çağrıldı!', '');
        if (!told) { told = true; setTimeout(() => toast('Bekçi polisi çağırdı, hırsızı polise teslim edecek.'), 1800); }
      }
      gPose = () => {
        kneel(w, 1 - ease(t / 0.4));
        const e = ease((t - 0.35) / 0.3) * (1 - ease((t - 1.2) / 0.3));
        gu.arms[1].rotation.x = -2.2 * e; gu.arms[1].rotation.z = -0.55 * e; gu.head.rotation.x = 0.15 * e;
      };
      if (t >= 1.5) go('lift');
      break;
    }
    case 'lift': { // kolundan tutup ayağa kaldırır
      const k = ease((t - 0.15) / 0.85);
      S.pitch = (PI / 2) * (1 - k);
      gPose = () => { lean(w, 0.45 * Math.sin(PI * Math.min(1, t / 1.1))); arms(gu, -1.3, 0.1, -1.3, -0.1); };
      face(w.obj, p, dt);
      if (t >= 1.1) {
        S.pitch = 0;
        const r = findRoute(p, S.road.H);
        S.path = r.length ? r.map((q) => q.clone()) : [];
        if (!S.path.length || S.path[S.path.length - 1].distanceTo(S.road.H) > 0.05) S.path.push(S.road.H.clone());
        S.T.tp.innerHTML = '🚓 <b>Polise götürülüyor</b>';
        go('escort');
      }
      break;
    }
    case 'escort': // bekçi arkasından kolundan tutar, kaldırımdaki buluşma yerine yürütür
    case 'wait': {
      if (S.phase === 'escort') {
        tSpeed = 0.55;
        if (follow(o, S.path, dt, 2.0) || t > 70) { if (t > 70) { p.x = S.road.H.x; p.z = S.road.H.z; } go('wait'); }
      } else face(o, S.road.E, dt, 5);
      escortGuard(dt);
      gPose = () => { gu.arms[1].rotation.x = -1.15; gu.arms[1].rotation.z = 0.08; };
      if (S.phase === 'wait' && S.car && S.car.state === 'ready') go('hand');
      break;
    }
    case 'hand': handStep(dt); return;
  }
  // hırsız: yerde (göğsü üstünde, başı yana dönük) ya da ayakta kelepçeli
  p.y = heightAt(p.x, p.z) + 0.17 * Math.sin(S.pitch);
  o.rotation.x = S.pitch;
  M.animateCharacter(o, tSpeed, dt, false);
  const down = S.pitch > 0.6;
  if (S.cuffs) cuffed(u);
  else if (S.phase === 'fall') arms(u, -2.4 * Math.min(1, t / 0.5), 0.15, -2.4 * Math.min(1, t / 0.5), -0.15);
  else if (S.phase === 'cuff') { const e = ease((t - 0.1) / 0.6); arms(u, -0.35 + (CUFF[0] + 0.35) * e, CUFF[1] * e, -0.35 + (CUFF[0] + 0.35) * e, -CUFF[1] * e); }
  else arms(u, -0.35, 0.1, -0.35, -0.1);
  if (down) {
    u.head.rotation.y = 1.1 * Math.min(1, (S.phase === 'fall' ? t / 0.6 : 1));
    const kick = S.phase === 'reach' ? 0.35 : S.phase === 'pin' ? 0.35 * Math.exp(-t * 2) : S.phase === 'cuff' ? 0.08 : 0;
    u.legs[0].rotation.x = kick * Math.max(0, Math.sin(G.time * 15)); u.legs[1].rotation.x = kick * Math.max(0, -Math.sin(G.time * 15));
  } else if (S.cuffs) u.head.rotation.x = 0.28; // başı önde
  if (S.dogHold && w.dog) holdDog(dt);
  guardFinish(dt, gPose);
}
// bekçi: animasyonu (Worker.finish), sonra sahnenin pozu
function guardFinish(dt, pose) {
  const w = S.guard, u = w.obj.userData;
  if (u.rig) { u.rig.rotation.x = 0; u.rig.position.y = 0; }
  w.finish(dt);
  if (pose) pose();
}
function escortGuard(dt) {
  const w = S.guard, o = S.o, fx = Math.sin(o.rotation.y), fz = Math.cos(o.rotation.y);
  const q = V(o.position.x - fx * 0.62 - fz * 0.34, 0, o.position.z - fz * 0.62 + fx * 0.34); // arkasında, sağında
  const d = Math.hypot(q.x - w.obj.position.x, q.z - w.obj.position.z);
  if (d > 0.05) w.walkTo(q, dt, d > 2 ? 4.5 : 2.4);
  if (d < 0.3) w.obj.rotation.y = lerpAngle(w.obj.rotation.y, o.rotation.y, 1 - Math.exp(-8 * dt));
}
// köpek hırsızın ayağından tutup çekiştirir
function holdDog(dt) {
  const d = S.guard.dog, o = S.o;
  d.position.set(o.position.x - S.f.x * 0.5, 0, o.position.z - S.f.z * 0.5);
  d.rotation.y = Math.atan2(S.f.x, S.f.z);
  animateDog(d, 0, dt);
  d.userData.head.rotation.z = 0.35 * Math.sin(G.time * 20);
}

// teslim: selamlaşma, kapı, arka koltuk
function handStep(dt) {
  const o = S.o, u = o.userData, w = S.guard, gu = w.obj.userData, c = S.car, cop = S.cop, cu = cop.userData, R = S.road, t = S.t, p = o.position;
  w.moving = false;
  let tSpeed = 0, gPose = null;
  const door = c.obj.userData.doors.rr;
  // memur ve bekçi selamlaşır
  if (t < 1.0) {
    face(cop, w.obj.position, dt); face(w.obj, cop.position, dt); face(o, R.E, dt, 5);
    if (t > 0.05 && once('hand1')) floatText(w.obj.position, '🫡 Teslim ediyorum!', '');
    if (t > 0.8 && once('hand2')) floatText(cop.position, '👮 Teşekkürler, kolay gelsin!', '');
    gPose = () => { salute(gu, ease((t - 0.15) / 0.25) * (1 - ease((t - 0.85) / 0.15))); gu.arms[1].rotation.x = -1.15; gu.arms[1].rotation.z = 0.08; };
  } else if (t < 1.45) { // arka kapıyı açar
    if (once('door1')) sfx('click', { at: c.obj.position, vol: 0.6 });
    face(cop, R.E, dt);
    door.rotation.y = DOOR_OPEN * ease((t - 1.0) / 0.4);
    gPose = () => { gu.arms[1].rotation.x = -1.15; gu.arms[1].rotation.z = 0.08; };
  } else if (t < 2.45) { // hırsız kapının ağzına yürür; bekçi bırakıp geri çekilir
    tSpeed = 0.4;
    stepTo(o, R.E, dt, 1.4);
    if (!stepTo(w.obj, R.G, dt, 1.6)) w.moving = true; else face(w.obj, c.obj.position, dt);
    face(cop, p, dt);
  } else if (t < 3.05) { // başını eğdirip arka koltuğa oturtur
    if (once('seat0')) { S.seatFrom = p.clone(); S.seatTo = c.obj.localToWorld(SEAT.clone()); }
    const k = ease((t - 2.45) / 0.6);
    p.lerpVectors(S.seatFrom, S.seatTo, k);
    o.rotation.y = lerpAngle(o.rotation.y, c.obj.rotation.y, 1 - Math.exp(-10 * dt));
    face(w.obj, c.obj.position, dt); face(cop, p, dt);
    S.duck = k;
  } else if (once('seated')) {
    c.obj.attach(o); o.position.copy(SEAT); o.rotation.set(0, 0, 0); o.scale.setScalar(1 / K);
    for (const l of u.legs) l.rotation.x = -1.45;
    cuffed(u); u.head.rotation.set(0.3, 0, 0);
    S.prisoner = o; S.T = null;
    S.hooks.done();
    banner('POLİSE TESLİM!', 'Bekçi hırsızı polise teslim etti');
    sfx('happy');
    c.state = 'close'; c.t = 0;
    return;
  }
  if (S.T) {
    if (t < 3.05) {
      p.y = t >= 2.45 ? p.y : heightAt(p.x, p.z);
      M.animateCharacter(o, tSpeed, dt, false);
      cuffed(u);
      u.head.rotation.x = 0.28 + 0.3 * (S.duck || 0);
      if (S.duck) for (const l of u.legs) l.rotation.x = -1.45 * S.duck;
    }
    // memur: kolu hırsızın başının üstünde
    copPose(dt, t < 1.0 ? () => salute(cu, ease(t / 0.25) * (1 - ease((t - 0.75) / 0.25))) : t < 1.45 ? () => { cu.arms[0].rotation.x = -1.2; } : () => { cu.arms[0].rotation.x = t < 2.45 ? -1.5 : -2.1; cu.arms[0].rotation.z = 0.15; });
  }
  guardFinish(dt, gPose);
}
function copPose(dt, pose) {
  const cop = S.cop, p = cop.position, lp = cop.userData.lp || (cop.userData.lp = p.clone());
  const v = dt > 0 ? Math.hypot(p.x - lp.x, p.z - lp.z) / dt : 0; lp.copy(p);
  p.y = heightAt(p.x, p.z);
  M.animateCharacter(cop, v > 0.2 ? Math.min(1, v / 2.6) : 0, dt, false);
  if (pose) pose();
}

// ---------- polis aracı: gelir, memur iner, teslim alır, gider ----------
function dispatch() {
  const R = S.road, x0 = R.d > 0 ? Math.max(R.R.far, R.x - 60) : Math.min(R.R.far, R.x + 60);
  const obj = makePoliceCar();
  obj.position.set(x0, 0, R.lane); obj.rotation.y = R.d > 0 ? PI / 2 : -PI / 2;
  G.scene.add(obj);
  S.car = { obj, state: 'come', path: [V(R.x, 0, R.lane)], t: 0, siren: 0 };
}
function drive(c, dt, speed, slow) {
  const p = c.obj.position, q = c.path[0];
  if (!q) return true;
  const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.05) { c.path.shift(); return !c.path.length; }
  const k = (G.hooks.crossK && d > 0.01 ? G.hooks.crossK(p, dx / d, dz / d) : 1) * (G.hooks.gapK ? G.hooks.gapK(c.obj, c.path) : 1); // yaya geçidi, öndeki taşıt (events.js yol düzeni)
  const st = Math.min(d, speed * dt * k * (slow && c.path.length === 1 && d < 10 ? Math.max(0.25, d / 10) : 1));
  p.x += (dx / d) * st; p.z += (dz / d) * st;
  c.obj.rotation.y = lerpAngle(c.obj.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 5));
  for (const wh of c.obj.userData.wheels) wh.rotation.x += st / (0.34 * K);
  return false;
}
function carStep(dt) {
  const c = S.car, R = S.road, u = c.obj.userData;
  c.t += dt;
  blink(c.obj, true);
  if (c.state === 'come' || c.state === 'leave') {
    if ((c.siren -= dt) <= 0 && (c.state === 'come' || c.t < 1)) { c.siren = 2.4; sfx('siren', { at: c.obj.position }); }
  }
  switch (c.state) {
    case 'come':
      if (drive(c, dt, 11, true)) { c.state = 'park'; c.t = 0; }
      break;
    case 'park': { // ön sağ kapıdan memur iner
      const dr = u.doors.fr;
      dr.rotation.y = DOOR_OPEN * ease((c.t - 0.4) / 0.3) * (1 - ease((c.t - 1.0) / 0.3));
      if (c.t >= 0.75 && !S.cop) {
        u.mate.visible = false;
        const cop = S.cop = M.makeCharacter(MATE);
        cop.position.copy(R.X); cop.rotation.y = Math.atan2(R.O.x - R.X.x, R.O.z - R.X.z);
        G.scene.add(cop);
        const el = document.createElement('div'); el.className = 'staff'; el.textContent = '👮 Polis';
        S.copTag = G.labels.add(el, (v) => v.copy(cop.position).setY(cop.position.y + 2.3));
      }
      if (S.cop) { stepTo(S.cop, R.O, dt, 2.2); copPose(dt, null); }
      if (c.t >= 1.4 && S.cop && flat(S.cop.position, R.O) < 0.05) { dr.rotation.y = 0; c.state = 'ready'; }
      break;
    }
    case 'ready': // memur buluşma yerinde bekler (teslim handStep'te)
      if (S.T && S.phase !== 'hand') { face(S.cop, S.o.position, dt, 4); copPose(dt, null); }
      break;
    case 'close': { // arka kapıyı kapar, bekçi serbest; memur aracına döner
      const dr = u.doors.rr;
      dr.rotation.y = DOOR_OPEN * (1 - ease(c.t / 0.35));
      if (c.t >= 0.35 && once('slam')) { sfx('door', { at: c.obj.position }); release(); }
      if (c.t >= 0.4) stepTo(S.cop, R.X, dt, 2.2);
      copPose(dt, null);
      if (c.t >= 0.4 && flat(S.cop.position, R.X) < 0.05) { c.state = 'board'; c.t = 0; }
      break;
    }
    case 'board': { // ön kapıdan biner
      const dr = u.doors.fr;
      dr.rotation.y = DOOR_OPEN * ease(c.t / 0.25) * (1 - ease((c.t - 0.55) / 0.25));
      if (S.cop && c.t >= 0.3) removeCop();
      else if (S.cop) copPose(dt, null);
      if (c.t >= 0.85) { dr.rotation.y = 0; leave(); }
      break;
    }
    case 'leave': {
      // U dönüşüne girmeden dönüş şeridinde yaklaşan taşıt geçer (dolmuş gibi, expand-west.js)
      if (!c.turn) {
        const x = R.x, a = x - 2 * R.d, b = x + 22 * R.d;
        if (G.hooks.roadBusy && G.hooks.roadBusy(c.obj, Math.min(a, b), Math.max(a, b), R.R.back - 1.1, R.R.back + 1.1)) break;
        c.turn = true;
      }
      if (drive(c, dt, 9, false)) end();
      break;
    }
  }
}
function leave() {
  const c = S.car, R = S.road, x = R.x, d = R.d, mid = (R.lane + R.R.back) / 2;
  c.state = 'leave'; c.t = 0; c.siren = 0; c.turn = false;
  c.path = [V(x + 4 * d, 0, R.lane), V(x + 6 * d, 0, mid), V(x + 4 * d, 0, R.R.back), V(R.R.far, 0, R.R.back)];
}
function removeCop() {
  if (!S.cop) return;
  G.scene.remove(S.cop); G.labels.remove(S.copTag);
  S.cop = null; S.copTag = null;
  if (S.car) S.car.obj.userData.mate.visible = true;
}
// bekçi devriyesine döner
function release() {
  const w = S.guard;
  if (!w) return;
  const u = w.obj.userData;
  if (u.rig) { u.rig.rotation.x = 0; u.rig.position.y = 0; }
  w.path = []; w.leg = null; w.t = 1.5;
  S.guard = null;
}
function end() {
  if (S.car) { const u = S.car.obj.userData; G.scene.remove(S.car.obj); for (const m of [u.red, u.blue, u.gr.material, u.gb.material]) m.dispose(); }
  removeCop();
  S = G.arrest = null;
}
// bekçi işten çıkarıldı: hırsız kelepçesinden kurtulup kaçar, polis geldiyse geri döner
function abort() {
  const T = S.T;
  if (T) {
    const o = S.o, u = o.userData;
    if (S.cuffs) o.remove(S.cuffs);
    o.rotation.x = 0; o.position.y = 0; arms(u, 0, 0, 0, 0); u.head.rotation.x = 0; for (const l of u.legs) l.rotation.x = 0;
    S.T = null;
    S.hooks.flee();
  }
  S.guard = null;
  if (!S.car) { S = G.arrest = null; return; }
  removeCop();
  if (S.car.state !== 'leave') leave();
}
