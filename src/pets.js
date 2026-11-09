// Kediler ve köpekler (2026-10-28 kullanıcı isteği): kasaba meydanı ve parkı, köy bakkalının önü, semt pazarı.
// Süs canlılar, çarpışmasız: gidecekleri yerin yürünebilir ve engelsiz olduğuna bakarlar, kimsenin yolunu kesmezler.
// Kedi: gezinir, oturup patisini yalar, kıvrılıp uyur, gerinir; meydanda güvercine sinsice yaklaşıp atılır (güvercinler
// havalanır: plaza.js G.pigeonThreats), bazen banka zıplayıp orada uyur, oyuncu yanına gelince miyavlar. Köpekten kaçar.
// Köpek: koklayarak gezinir, oturup kulağını kaşır, kuyruğunu kovalar, uzanıp dinlenir, yakındaki kediye havlayıp kovalar,
// yanından geçen oyuncunun bir süre peşinden gelir.
// Pozlar: gövde arka kalçadan döner (oturunca ön yükselir); bacak boyu kalçanın yerden yüksekliğine göre ölçeklenir.
import * as THREE from 'three';
import * as M from './models.js';
import { G, rand, pick, floatText, lerpAngle } from './game.js';
import { PLAZA } from './plaza.js';

const PI = Math.PI;
const clamp = THREE.MathUtils.clamp;
const LOOKS = {
  sarman: { fur: '#dd8a3c', dark: '#a9581d', belly: '#f6dcb0', eye: '#7fbf3a', stripes: true },
  duman: { fur: '#33333a', dark: '#1d1d22', belly: '#f2f2f2', eye: '#e8c53a' },
  pamuk: { fur: '#f3f1ea', dark: '#cfc9bc', belly: '#ffffff', eye: '#59a0e0' },
  minnos: { fur: '#f2e8da', dark: '#d07a2e', belly: '#ffffff', eye: '#6bb04a', patch: '#2e2e33' },
  karabas: { fur: '#e3c58f', dark: '#3a2c20', belly: '#f4e6c8' }, // kangal: açık sarı, kara maske
  coban: { fur: '#f2ece0', dark: '#4a3a2a', belly: '#ffffff' }, // meranın çoban köpeği: beyaz akbaş
  comar: { fur: '#8a5a33', dark: '#4e3018', belly: '#d9b07a' },
};

// ---------- modeller ----------
// boy: karakterlerin yanında görünsün diye büyütülür (kedi yarım metre, köpek dize gelir)
function finish(g, u, k) { g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); g.userData = u; g.scale.setScalar(k); return g; }
function legs(torso, mat, paw, L, w, len, th) {
  const out = [];
  for (const [x, z] of [[-w, 0.02], [w, 0.02], [-w, L - 0.02], [w, L - 0.02]]) { // arka sol, arka sağ, ön sol, ön sağ
    const hip = new THREE.Group(); hip.position.set(x, 0, z); torso.add(hip);
    M.rbox(th, len, th, th * 0.4, mat, 0, -len / 2, 0, hip);
    M.sph(th * 0.62, paw, 0, -len + th * 0.3, 0.01, hip, 8, 6);
    out.push(hip);
  }
  return out;
}
function tail(torso, mat, tip, n, seg, th, y, z) {
  const chain = []; let parent = torso, at = new THREE.Vector3(0, y, z);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Group(); s.position.copy(at); parent.add(s);
    M.rbox(th, th, seg, th * 0.45, i === n - 1 && tip ? tip : mat, 0, 0, -seg / 2, s);
    chain.push(s); parent = s; at = new THREE.Vector3(0, 0, -seg * 0.92); th *= 0.92;
  }
  return chain;
}
function makeCat(p) { return M.tagAnimal(rawCat(p), 'kedi'); } // albüm: hayvan kaydı (album.js)
function rawCat(p) {
  const g = new THREE.Group(), fur = M.mat(p.fur), dark = M.mat(p.dark), belly = M.mat(p.belly), black = M.mat('#151515'), pink = M.mat('#f29aa8'), eyeM = M.mat(p.eye);
  const L = 0.34, HIP = 0.17;
  const torso = new THREE.Group(); torso.position.set(0, HIP, -L / 2); g.add(torso); // dönme noktası arka kalça
  M.rbox(0.17, 0.15, L + 0.12, 0.07, fur, 0, 0.035, L / 2, torso);
  M.rbox(0.12, 0.04, L * 0.8, 0.02, belly, 0, -0.04, L / 2, torso);
  if (p.stripes) for (const z of [0.06, 0.15, 0.24]) M.rbox(0.176, 0.028, 0.035, 0.012, dark, 0, 0.1, z, torso);
  if (p.patch) { M.rbox(0.13, 0.05, 0.13, 0.03, M.mat(p.patch), 0.025, 0.1, 0.1, torso); M.rbox(0.1, 0.05, 0.1, 0.03, dark, -0.03, 0.1, 0.27, torso); }
  const head = new THREE.Group(); head.position.set(0, 0.11, L + 0.07); torso.add(head);
  M.rbox(0.16, 0.13, 0.13, 0.055, fur, 0, 0, 0, head);
  M.rbox(0.08, 0.05, 0.05, 0.02, belly, 0, -0.03, 0.062, head);
  M.sph(0.013, pink, 0, -0.004, 0.09, head, 6, 4);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * 0.04, 0.022, 0.064); head.add(e);
    M.sph(0.019, eyeM, 0, 0, 0, e, 8, 6); M.rbox(0.008, 0.026, 0.008, 0.003, black, 0, 0, 0.016, e);
    eyes.push(e);
    const ear = M.cyl(0, 0.038, 0.075, 4, fur, sx * 0.05, 0.088, -0.01, head); ear.rotation.set(0, PI / 4, -sx * 0.22);
    for (const k of [-1, 1]) { const wh = M.rbox(0.07, 0.003, 0.003, 0.001, M.mat('#e8e8e8'), sx * 0.07, -0.02 + k * 0.008, 0.07, head); wh.rotation.z = sx * k * 0.12; }
  }
  const lg = legs(torso, fur, belly, L, 0.055, HIP, 0.045);
  const tl = tail(torso, fur, p.stripes ? dark : null, 3, 0.11, 0.036, 0.08, -0.04);
  return finish(g, { kind: 'cat', torso, head, legs: lg, tail: tl, eyes, L, HIP, walk: 0 }, 1.65);
}
function makeDog(p) { return M.tagAnimal(rawDog(p), 'kopek'); } // albüm: hayvan kaydı (album.js)
function rawDog(p) {
  const g = new THREE.Group(), fur = M.mat(p.fur), dark = M.mat(p.dark), belly = M.mat(p.belly), black = M.mat('#151515');
  const L = 0.5, HIP = 0.3;
  const torso = new THREE.Group(); torso.position.set(0, HIP, -L / 2); g.add(torso);
  M.rbox(0.26, 0.25, L + 0.16, 0.1, fur, 0, 0.06, L / 2, torso);
  M.rbox(0.18, 0.05, L * 0.75, 0.03, belly, 0, -0.06, L / 2, torso);
  const head = new THREE.Group(); head.position.set(0, 0.2, L + 0.1); torso.add(head);
  M.rbox(0.23, 0.21, 0.22, 0.08, fur, 0, 0, 0, head);
  M.rbox(0.13, 0.11, 0.15, 0.05, dark, 0, -0.04, 0.15, head); // kara maske ve burun
  M.sph(0.028, black, 0, -0.01, 0.23, head, 8, 6);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * 0.06, 0.045, 0.105); head.add(e);
    M.sph(0.022, black, 0, 0, 0, e, 8, 6); eyes.push(e);
    const ear = M.rbox(0.07, 0.13, 0.045, 0.02, dark, sx * 0.125, 0.04, -0.02, head); ear.rotation.z = sx * 0.35;
  }
  M.rbox(0.25, 0.045, 0.06, 0.02, M.mat('#3d7dd8'), 0, -0.09, -0.07, head); // tasma
  const lg = legs(torso, fur, belly, L, 0.085, HIP, 0.075);
  const tl = tail(torso, fur, null, 2, 0.15, 0.055, 0.15, -0.06);
  return finish(g, { kind: 'dog', torso, head, legs: lg, tail: tl, eyes, L, HIP, walk: 0 }, 1.35);
}

// ---------- pozlar ----------
// drop: kalça yüksekliği (1 ayakta), pitch: gövde eğimi (eksi: ön yukarı, oturma), head: baş eğimi, tailUp: kuyruk açısı
const POSES = {
  stand: { drop: 1, pitch: 0, head: 0, tailUp: 0.9, curl: 0.2, eyes: 1 },
  walk: { drop: 1, pitch: 0, head: 0.05, tailUp: 1.1, curl: 0.35, eyes: 1 },
  sit: { drop: 0.42, pitch: -0.42, head: -0.1, tailUp: -0.35, curl: 0.5, eyes: 1 },
  sleep: { drop: 0.34, pitch: 0, head: 0.38, tailUp: -0.2, curl: 1.2, eyes: 0.12 },
  stalk: { drop: 0.72, pitch: 0.04, head: 0.12, tailUp: 0.1, curl: 0, eyes: 1 },
  run: { drop: 0.95, pitch: 0, head: 0.1, tailUp: 0.35, curl: 0, eyes: 1 },
  stretch: { drop: 1, pitch: 0.32, head: -0.2, tailUp: 1.3, curl: 0.1, eyes: 0.5, front: -1.15 },
  sniff: { drop: 0.95, pitch: 0.08, head: 0.65, tailUp: 0.7, curl: 0, eyes: 1 },
  lie: { drop: 0.36, pitch: 0, head: 0.28, tailUp: -0.3, curl: 0.3, eyes: 0.6, front: -1.35 },
};
const KEYS = ['drop', 'pitch', 'head', 'tailUp', 'curl', 'eyes'];
function applyPose(pet, dt) {
  const o = pet.o, u = o.userData, tp = POSES[pet.pose] || POSES.stand, c = pet.cur, k = 1 - Math.exp(-9 * dt);
  for (const key of KEYS) c[key] += ((tp[key] ?? 0) - c[key]) * k;
  c.front += ((tp.front ?? 0) - c.front) * k; // gerinirken ve uzanırken ön ayaklar öne uzanır
  const hipY = u.HIP * c.drop, sitAmt = clamp(-c.pitch / 0.4, 0, 1), mv = pet.spdNow, t = G.time;
  u.torso.position.y = hipY; u.torso.rotation.x = c.pitch;
  // yürüyüş: çapraz bacaklar birlikte; koşuda adım büyür, gövde zıplar
  const run = pet.pose === 'run', amp = mv > 0.05 ? (run ? 0.85 : 0.5) : 0;
  u.walk += dt * (u.kind === 'cat' ? 15 : 10) * Math.min(2.2, 0.4 + mv * (run ? 0.55 : 1.1));
  const s = Math.sin(u.walk) * amp;
  const frontLen = (hipY + u.L * Math.sin(-c.pitch)) / u.HIP;
  const [rl, rr, fl, fr] = u.legs;
  for (const [leg, ph, front] of [[rl, s, false], [rr, -s, false], [fl, -s, true], [fr, s, true]]) {
    if (front) { const w = clamp(Math.abs(c.front) / 0.6, 0, 1); leg.rotation.x = -c.pitch + ph + c.front * w; leg.scale.y = clamp(frontLen, 0.2, 1.6) * (1 - w) + 0.95 * w; }
    else { leg.rotation.x = -0.85 * sitAmt + ph; leg.scale.y = clamp(sitAmt > 0.2 ? 1 - 0.35 * sitAmt : c.drop, 0.2, 1); }
  }
  if (pet.lick) { fr.rotation.x = -1.1 - c.pitch + Math.sin(t * 9) * 0.15; fr.scale.y = 0.8; } // patisini yalar
  if (pet.scratch) { rr.rotation.x = -1.2 + Math.sin(t * 30) * 0.45; rr.scale.y = 0.9; } // arka ayakla kulağını kaşır
  u.torso.position.y += run && mv > 0.5 ? Math.abs(Math.cos(u.walk)) * 0.035 : 0;
  // baş: eğim, dönüş (bir şeye bakar), yalarken ve kaşırken sallanır
  u.head.rotation.x = c.head + (pet.lick ? 0.45 + Math.sin(t * 9) * 0.12 : 0) + (pet.sniffing ? Math.sin(t * 22) * 0.05 : 0);
  u.head.rotation.y = pet.look + (pet.lick ? 0.35 : 0);
  u.head.rotation.z = pet.scratch ? 0.35 : 0;
  for (const e of u.eyes) e.scale.y = clamp(c.eyes * (Math.sin(t * 0.7 + pet.ph) > 0.985 ? 0.15 : 1), 0.1, 1); // ara sıra göz kırpar
  // kuyruk: kedi kıvrık ve yavaş sallanır, köpek hızlı sallar; uyurken gövdenin yanına sarılır
  const [t0, ...rest] = u.tail, wagF = u.kind === 'dog' ? (pet.happy ? 16 : 7) : (pet.pose === 'stalk' ? 10 : 2.2);
  t0.rotation.x = c.tailUp; t0.rotation.y = Math.sin(t * wagF + pet.ph) * (u.kind === 'dog' ? (pet.happy ? 0.7 : 0.35) : 0.25) + c.curl * 0.6;
  for (const [i, sg] of rest.entries()) { sg.rotation.x = u.kind === 'cat' ? 0.25 + (1 - c.curl) * 0.15 * (i + 1) : 0.1; sg.rotation.y = c.curl * 0.7 + (pet.pose === 'stalk' && i === rest.length - 1 ? Math.sin(t * 14) * 0.5 : 0); }
  t0.scale.setScalar(pet.puff > 0 ? 1.35 : 1);
  // uykuda soluk alıp verir
  u.torso.scale.y = pet.pose === 'sleep' || pet.pose === 'lie' ? 1 + Math.sin(t * 2.4 + pet.ph) * 0.035 : 1;
}

// ---------- alanlar ----------
let walkableFn = () => true;
const ZONES = [];
function zoneOk(z, x, y) {
  const r = z.rect;
  if (x < r[0] || x > r[1] || y < r[2] || y > r[3] || !walkableFn(x, y) || (z.no && z.no(x, y))) return false;
  for (const c of z.cols) if (x > c[0] - 0.15 && x < c[1] + 0.15 && y > c[2] - 0.15 && y < c[3] + 0.15) return false;
  return true;
}
function clearPath(z, a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(d / 0.3);
  for (let i = 1; i <= n; i++) { const u = i / n; if (!zoneOk(z, a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u)) return false; }
  return true;
}
// rastgele, gidilebilen bir nokta: from'dan [lo, hi] m uzakta; away verilirse ondan uzaklaşan yönde
function spot(z, from, lo, hi, away) {
  for (let i = 0; i < 16; i++) {
    let a = rand(0, PI * 2);
    if (away) a = Math.atan2(from.x - away.x, from.z - away.z) + rand(-0.9, 0.9);
    const r = rand(lo, hi), q = new THREE.Vector3(from.x + Math.sin(a) * r, 0, from.z + Math.cos(a) * r);
    if (zoneOk(z, q.x, q.z) && clearPath(z, from, q)) return q;
  }
  return null;
}

// ---------- canlı ----------
class Pet {
  constructor(kind, look, zone, name) {
    this.kind = kind; this.zone = zone; this.name = name;
    this.o = kind === 'cat' ? makeCat(LOOKS[look]) : makeDog(LOOKS[look]);
    this.cur = { drop: 1, pitch: 0, head: 0, tailUp: 0.9, curl: 0.2, eyes: 1, front: 0 };
    this.pose = 'stand'; this.look = 0; this.ph = rand(0, 6); this.spdNow = 0; this.puff = 0;
    this.state = 'wait'; this.t = rand(0.5, 3); this.cool = rand(4, 10); this.say = 0;
    const p = this.placeStart(); this.o.position.copy(p); this.o.rotation.y = rand(0, PI * 2);
    zone.R.content.add(this.o);
  }
  placeStart() {
    const r = this.zone.rect;
    for (let i = 0; i < 60; i++) { const x = rand(r[0], r[1]), z = rand(r[2], r[3]); if (zoneOk(this.zone, x, z)) return new THREE.Vector3(x, 0, z); }
    return new THREE.Vector3((r[0] + r[1]) / 2, 0, (r[2] + r[3]) / 2);
  }
  get pos() { return this.o.position; }
  // durumlar: wait (pozda bekler), move (hedefe yürür/koşar), hunt, hop (banka zıplar), perch (bankta)
  idle(pose, secs, opts = {}) { this.state = 'wait'; this.pose = pose; this.t = secs; this.lick = !!opts.lick; this.scratch = !!opts.scratch; this.spin = opts.spin || 0; this.happy = !!opts.happy; this.sniffing = false; this.then = opts.then || null; }
  moveTo(q, spd, pose, then) { this.state = 'move'; this.to = q; this.spd = spd; this.pose = pose; this.then = then || null; this.lick = this.scratch = false; this.spin = 0; this.sniffing = pose === 'sniff'; this.t = 12; }
  near(m) { return this.pos.distanceTo(G.player.position) < m; }
  talk(text) { if (this.say > 0 || !this.near(12)) return; this.say = 9; floatText(this.pos.clone().setY(this.kind === 'cat' ? -1.25 : -0.95), text); } // yazı başının üstünde çıkar
  decide() {
    const z = this.zone, p = this.pos;
    this.look = 0; this.happy = false; this.puff = 0;
    if (this.kind === 'cat') {
      if (this.near(2.2) && this.cool <= 0) { this.cool = 14; this.face(G.player.position); this.talk(pick(['Miyav!', 'Mrrr…', 'Miyaav'])); return this.idle('sit', 2.5); }
      const r = Math.random();
      if (z.pigeons && G.pigeons && r < 0.45) { const prey = this.prey(); if (prey) { this.prey_ = prey; this.state = 'hunt'; this.pose = 'stalk'; this.t = 14; this.pounce = 0; return; } }
      if (z.perches && r < 0.56) { const pc = this.perch(); if (pc) return this.moveTo(new THREE.Vector3(pc.fx, 0, pc.fz), 0.7, 'walk', () => this.hopUp(pc)); }
      if (r < 0.72) { const q = spot(z, p, 2, 6); if (q) return this.moveTo(q, rand(0.55, 0.8), 'walk', () => this.idle(pick(['sit', 'stand']), rand(1.5, 4))); }
      if (r < 0.84) return this.idle('sit', rand(3.5, 6), { lick: true });
      if (r < 0.9) return this.idle('stretch', 1.6, { then: () => this.idle('stand', 0.6) });
      return this.idle('sleep', rand(6, 12));
    }
    // köpek
    const cat = Math.random() < 0.5 && this.cool <= 0 && z.pets.find((c) => c.kind === 'cat' && c.state !== 'perch' && c.state !== 'hop' && c.pos.distanceTo(p) < 9);
    if (cat) { this.cool = 18; this.face(cat.pos); this.talk('Hav! Hav!'); return this.idle('stand', 0.7, { happy: true, then: () => this.chase(cat) }); }
    if (this.near(4) && this.cool <= 0 && G.player.position.distanceTo(p) > 1.2) { this.cool = 18; this.talk(pick(['Hav!', 'Hav hav!'])); this.state = 'follow'; this.pose = 'walk'; this.happy = true; this.t = rand(5, 8); return; }
    const r = Math.random();
    if (r < 0.4) { const q = spot(z, p, 2, 7); if (q) return this.moveTo(q, 0.75, 'sniff', () => this.idle('sniff', rand(1, 2.2), { then: () => this.idle('stand', 0.8) })); }
    if (r < 0.55) return this.idle('sit', 2.2, { scratch: true, then: () => this.idle('sit', rand(1, 3), { happy: true }) });
    if (r < 0.66) return this.idle('walk', 1.8, { spin: 7.5, happy: true, then: () => this.idle('stand', 0.8) }); // kuyruğunu kovalar
    if (r < 0.82) return this.idle('lie', rand(6, 12));
    return this.idle('sit', rand(2, 4), { happy: Math.random() < 0.5 });
  }
  face(q) { this.o.rotation.y = Math.atan2(q.x - this.pos.x, q.z - this.pos.z); }
  // meydanın güvercinlerinden yolu açık, en yakını
  prey() {
    const p = this.pos;
    return G.pigeons.filter((g) => !g.to && g.o.position.distanceTo(p) < 8 && g.o.position.distanceTo(p) > 2.0 && clearPath(this.zone, p, g.o.position))
      .sort((a, b) => a.o.position.distanceTo(p) - b.o.position.distanceTo(p))[0] || null;
  }
  perch() {
    const p = this.pos, busy = new Set(this.zone.pets.map((c) => c.perch_));
    const list = this.zone.perches.filter((b) => !busy.has(b) && Math.hypot(b.fx - p.x, b.fz - p.z) < 9 && zoneOk(this.zone, b.fx, b.fz) && clearPath(this.zone, p, new THREE.Vector3(b.fx, 0, b.fz)));
    return list.length ? pick(list) : null;
  }
  hopUp(pc) { this.perch_ = pc; this.state = 'hop'; this.hop = { a: this.pos.clone(), b: new THREE.Vector3(pc.x, pc.y, pc.z), u: 0, up: true }; this.o.rotation.y = pc.ry + PI; this.pose = 'stand'; } // banka bakar, çıkınca meydana döner
  hopDown() { const pc = this.perch_; this.state = 'hop'; this.hop = { a: this.pos.clone(), b: new THREE.Vector3(pc.fx, 0, pc.fz), u: 0, up: false }; this.pose = 'stand'; }
  chase(cat) {
    this.chasing = cat; this.state = 'chase'; this.pose = 'run'; this.happy = true; this.t = 2.4;
    cat.flee(this);
  }
  flee(dog) {
    this.puff = 1; this.perch_ = null;
    if (this.zone.perches) { const pc = this.perch(); if (pc && Math.random() < 0.6) return this.moveTo(new THREE.Vector3(pc.fx, 0, pc.fz), 4.2, 'run', () => this.hopUp(pc)); }
    const q = spot(this.zone, this.pos, 4, 8, dog.pos) || spot(this.zone, this.pos, 3, 7);
    if (q) return this.moveTo(q, 4.2, 'run', () => this.idle('sit', rand(3, 5), { lick: true }));
    this.idle('stand', 2);
  }
  // hedefe düz yürür: yönünü yumuşakça çevirir, yol kapanırsa vazgeçer
  walk(q, spd, dt) {
    const p = this.pos, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), st = spd * dt;
    this.o.rotation.y = lerpAngle(this.o.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
    this.spdNow = spd;
    if (d <= st) { p.x = q.x; p.z = q.z; return true; }
    p.x += (dx / d) * st; p.z += (dz / d) * st;
    return false;
  }
  update(dt) {
    this.t -= dt; this.cool -= dt; this.say -= dt; this.spdNow = 0;
    const p = this.pos;
    switch (this.state) {
      case 'wait':
        if (this.spin) { this.o.rotation.y += this.spin * dt; this.spdNow = 1.2; }
        if (this.t <= 0) { const f = this.then; this.then = null; this.lick = this.scratch = false; this.spin = 0; if (f) f(); else this.state = 'decide'; }
        // uyuyan ya da oturan kediye oyuncu çok yaklaşırsa başını kaldırıp bakar
        if (this.kind === 'cat' && this.pose !== 'sleep' && this.near(3)) { const q = G.player.position; this.look = clamp(Math.atan2(q.x - p.x, q.z - p.z) - this.o.rotation.y, -0.9, 0.9); }
        break;
      case 'move':
        if (this.walk(this.to, this.spd, dt) || this.t <= 0) { const f = this.then; this.then = null; this.sniffing = false; if (f) f(); else this.state = 'decide'; }
        break;
      case 'hunt': { // sinsice yaklaşır, 1,8 m kalınca atılır; güvercinler havalanır, kedi oturup arkalarından bakar
        const g = this.prey_, q = g && g.o.position;
        if (!g || this.t <= 0 || !clearPath(this.zone, p, q)) { this.prey_ = null; this.idle('sit', 2); break; }
        const d = p.distanceTo(q);
        if (this.pose === 'stalk' && d < 1.8) { this.pose = 'run'; this.t = 0.9; this.pounce = 0; }
        const fast = this.pose === 'run', pause = !fast && Math.sin(G.time * 1.3 + this.ph) > 0.7; // sinsi yaklaşırken arada kıpırdamadan bekler
        if (fast) this.pounce += dt;
        if (pause) this.face(q);
        else if (this.walk(q, fast ? 4.4 : 0.7, dt) || (fast && (d < 0.35 || this.t <= 0.05))) {
          this.prey_ = null; p.y = 0;
          return this.idle('sit', 2.6, { then: () => this.idle('stand', 0.5) });
        }
        p.y = fast ? Math.max(0, Math.sin(clamp((this.pounce - 0.35) / 0.4, 0, 1) * PI) * 0.22) : 0;
        break;
      }
      case 'hop': { // banka zıplar ya da iner: yay çizer
        const h = this.hop; h.u = Math.min(1, h.u + dt / 0.38);
        p.lerpVectors(h.a, h.b, h.u); p.y += Math.sin(h.u * PI) * 0.28;
        this.cur.drop = h.up ? 0.85 : 1;
        if (h.u >= 1) {
          if (h.up) { this.o.rotation.y = this.perch_.ry; this.state = 'perch'; this.pose = Math.random() < 0.6 ? 'sleep' : 'sit'; this.t = rand(6, 12); this.lick = this.pose === 'sit'; }
          else { this.perch_ = null; p.y = 0; this.state = 'decide'; }
        }
        break;
      }
      case 'perch': if (this.t <= 0) { this.lick = false; this.hopDown(); } break;
      case 'chase': { // kediyi kovalar; kedi banka çıkarsa ya da uzaklaşırsa bırakır, kuyruk sallayarak döner
        const c = this.chasing;
        if (!c || this.t <= 0 || c.state === 'perch' || c.state === 'hop' || !clearPath(this.zone, p, c.pos)) { this.chasing = null; this.idle('stand', 1.2, { happy: true }); break; }
        if (p.distanceTo(c.pos) > 1.1) this.walk(c.pos, 3.6, dt);
        break;
      }
      case 'follow': { // oyuncunun peşinden: 1,5 m geride durur, kuyruk sallar
        const q = G.player.position, d = p.distanceTo(q);
        if (this.t <= 0 || d > 9 || !zoneOk(this.zone, q.x, q.z)) { this.idle('sit', 1.5, { happy: true }); break; }
        if (d > 1.6) { this.pose = 'walk'; this.walk(q, d > 3 ? 3.2 : 2.0, dt); } else { this.pose = 'sit'; this.face(q); }
        this.happy = true;
        break;
      }
      default: this.decide();
    }
    if (this.state !== 'hop' && this.state !== 'perch' && this.state !== 'hunt') p.y = 0;
    applyPose(this, dt);
  }
}

// kasaba meydanının ve parkın bankları: kedi önünden zıplayıp oturağa çıkar
function benches() {
  const P = PLAZA, out = [];
  const add = (bx, bz, ry) => { const fx = Math.sin(ry), fz = Math.cos(ry); out.push({ x: bx + fx * 0.06, z: bz + fz * 0.06, y: 0.49, ry, fx: bx + fx * 0.8, fz: bz + fz * 0.8 }); };
  for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2, bx = P.x + Math.cos(a) * 5.0, bz = P.z + Math.sin(a) * 5.0; add(bx, bz, Math.atan2(P.x - bx, P.z - bz)); }
  for (const [x, z, ry] of [[-48.6, -41.4, PI], [-42.4, -41.4, PI], [-47.45, -45.8, -PI / 2], [-42.0, -45.0, 0]]) add(x, z, ry); // plaza.js parkBenches
  return out;
}

// sokak hayvanları (cop.js, 2026-11-01): kasaba büyüdükçe açık bölgelerin boş alanlarına birer sokak kedisi ya da köpeği gelir
// (en çok 8); köpekler arada pislik bırakır, çöpçüler toplar. Kaydedilmez: her açılışta yeniden gelirler
const STRAY = [
  { id: 'koy', rect: [-15, 15.6, 3.6, 11.8] }, { id: 'pazar', rect: [23.6, 52.4, -13, 11.6] }, { id: 'sahil', rect: [-10, 45, 14, 25] },
  { id: 'kasaba', rect: [-55.6, -35.4, -48.6, -24.4] }, { id: 'firin', rect: [-22, 10, -27.2, -21] }, { id: 'han', rect: [-15, 15, -35, -28.5] },
  { id: 'ciftlik', rect: [24, 52, -24, -15] },
];
const S_CATS = [['sarman', 'Tekir'], ['duman', 'Boncuk'], ['pamuk', 'Pisi'], ['minnos', 'Zeytin']], S_DOGS = [['comar', 'Kömür'], ['karabas', 'Fındık'], ['comar', 'Paşa'], ['karabas', 'Toprak']];
export function addStray(max) {
  const n = ZONES.reduce((k, z) => k + z.pets.filter((p) => p.stray).length, 0);
  if (n >= Math.min(8, max)) return false;
  const open = STRAY.filter((d) => G.regions[d.id] && G.regions[d.id].unlocked && !G.regions[d.id].hidden);
  if (!open.length) return false;
  const d = pick(open), id = `sokak_${d.id}`;
  let z = ZONES.find((q) => q.id === id);
  if (!z) { z = { id, rect: d.rect, R: G.regions[d.id], cols: [], colT: 0, pets: [] }; refreshCols(z); ZONES.push(z); }
  const dog = Math.random() < 0.5, [look, name] = (dog ? S_DOGS : S_CATS)[n % 4];
  const p = new Pet(dog ? 'dog' : 'cat', look, z, name); p.stray = true;
  z.pets.push(p); (G.pets || (G.pets = [])).push(p);
  return true;
}
export function buildPets(helpers) {
  walkableFn = helpers.walkable;
  const P = PLAZA;
  const defs = [
    { id: 'kasaba', rect: [-55.6, -35.4, -48.6, -24.4], pigeons: true, perches: benches(),
      no: (x, z) => Math.hypot(x - P.x, z - P.z) < 3.2 || ((x + 51.2) / 3.7) ** 2 + ((z + 46.2) / 2.6) ** 2 < 1, // fıskiye ve gölet
      pets: [['cat', 'sarman', 'Sarman'], ['cat', 'duman', 'Duman'], ['dog', 'karabas', 'Karabaş']] },
    // köpek Çomar köyden çıktı (2026-11-08 kullanıcı: "köy bakkalının önünde yerde balık gibi bir şey var alakasız o ne kaldır onu"): uzanınca
    // kahverengi uzun gövdesi oyun kamerasından yerde yatan balık gibi görünüyordu. Kasabanın ve pazarın köpekleri yerinde
    { id: 'koy', rect: [-15, 15.6, 1.8, 11.8], pets: [['cat', 'pamuk', 'Pamuk']] },
    { id: 'pazar', rect: [23.6, 52.4, -13, 11.6], pets: [['cat', 'minnos', 'Minnoş']] },
    { id: 'mera', rect: [-44, -23.8, 13.6, 27.6], pets: [['dog', 'coban', 'Akbaş']] }, // koyunların arasında çoban köpeği (detay.js bölüm ayrıntıları)
  ];
  for (const d of defs) {
    const R = G.regions[d.id];
    if (!R) continue;
    const z = { ...d, R, cols: [], colT: 0, pets: [] };
    refreshCols(z);
    z.pets = d.pets.map(([k, look, name]) => new Pet(k, look, z, name));
    ZONES.push(z);
  }
  G.pets = ZONES.flatMap((z) => z.pets); // test kancası
}
// bölgenin engelleri (açılan bölümle yenisi eklenir): 10 sn'de bir yeniden süzülür
function refreshCols(z) { const r = z.rect; z.cols = G.colliders.filter((c) => c[1] > r[0] - 1 && c[0] < r[1] + 1 && c[3] > r[2] - 1 && c[2] < r[3] + 1); z.colT = 10; }

export function updatePets(dt) {
  const threats = [];
  for (const z of ZONES) {
    if (!z.R.unlocked || z.R.hidden) continue;
    if ((z.colT -= dt) <= 0) refreshCols(z);
    // oyuncudan çok uzaktaki alanın canlıları seyrek güncellenir (görünmezler)
    const far = Math.hypot(G.player.position.x - (z.rect[0] + z.rect[1]) / 2, G.player.position.z - (z.rect[2] + z.rect[3]) / 2) > 70;
    z.acc = (z.acc || 0) + dt;
    if (far && z.acc < 0.25) continue;
    const step = Math.min(0.25, z.acc); z.acc = 0;
    for (const p of z.pets) {
      p.update(step);
      if (p.state === 'hunt') threats.push({ o: p.o, fast: p.pose === 'run' });
    }
  }
  G.pigeonThreats = threats;
}
export { makeDog as makePetDog, applyPose as posePet }; // Martı Adası'nda sahibiyle frizbi oynayan köpek (adacanli.js)
