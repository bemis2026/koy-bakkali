// Hırsız: arada bir dışarıdan sinsice gelir, biriken para yığınından para kapıp kaçar.
// Oyuncu ona dokunursa ya da bekçi ve köpeği yetişirse para geri gelir; yoldan çıkıp kaçarsa para gider.
// Bekçi ve köpeği upgrades.js'te (Guard); onlar G.thief'e bakarak kovalar ve thiefCaught(by, bekçi) çağırır. Bekçi varsa yakalanan hırsızı
// yere yatırıp kelepçeler ve polise teslim eder (polis.js); yoksa hırsız sersemleyip eli boş kaçar.
import * as THREE from 'three';
import * as M from './models.js';
import { G, MoneyPile, fly, floatText, toast, sfx, lerpAngle, rand } from './game.js';
import { banner } from './ui.js';
import { confetti, sparkle } from './fx.js';
import { findRoute } from './world.js';
import { arrest, updatePolice } from './polis.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const MIN_LOOT = 40;            // bu kadar birikmemiş yığına gelmez
const SNEAK = 3.2, RUN = 4.9, LOADED = 4.3; // oyuncu 6,6 m/sn; para çuvalıyla yavaşlar, arada nefeslenir: bekçi (3,8+) de yetişebilir
// geldiği ve kaçtığı yerler: yolun ağzından girer; kaçarken yol boyunca haritanın dışına kadar koşar (out), kovalayana zaman kalır
const EXITS = [
  { at: V(-69, 0, 10.6), out: [V(-101, 0, 10.6)], ok: () => true },                     // köy yolu, batı
  { at: V(75, 0, 4.3), out: [V(137, 0, 4.3)], ok: () => G.regions.pazar.unlocked },    // pazar caddesi, doğu (kuzey kaldırım)
  { at: V(-58.6, 0, 29.7), out: [V(-58.6, 0, 10.6), V(-101, 0, 10.6)], ok: () => G.regions.sahil.unlocked },  // sahil yolu, batı ucundan köy yoluna
];
const escapePath = () => [T.exit.at.clone(), ...T.exit.out.map((q) => q.clone())];

let T = null, nextT = 90, arrow = null, firstSeen = false;

function makeThief() {
  const o = M.makeCharacter({ shirt: '#2b2d3a', pants: '#1c1d26', hat: 'cap', hatColor: '#1c1d26', skin: '#d9a67c' });
  // göz bandı: siyah maske, iki beyaz göz deliği
  const hd = o.userData.face || o.userData.head; // modelli karakterde gözlere göre yerleşik yüz grubu (karakter.js)
  M.rbox(0.68, 0.13, 0.2, 0.05, M.mat('#111111'), 0, 0.04, 0.22, hd);
  for (const sx of [-1, 1]) M.sph(0.04, M.mat('#ffffff'), sx * 0.11, 0.04, 0.325, hd, 8, 6);
  // gömlekte beyaz çizgiler (eski yuvarlak gövdeye göre; modelli karakterin ince gövdesinin çevresinde havada kalırdı)
  if (!o.userData.glbc) for (const y of [0.82, 1.0, 1.18]) M.cyl(0.318, 0.318, 0.05, 16, M.mat('#e8e8e8'), 0, y, 0, o);
  o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return o;
}
function makeBag() {
  const g = new THREE.Group();
  M.sph(0.3, M.mat('#a8763e'), 0, 0, 0, g, 12, 10).scale.set(1, 1.1, 0.9);
  M.cyl(0.09, 0.12, 0.12, 10, M.mat('#7a5228'), 0, 0.33, 0, g);
  const t = M.rbox(0.26, 0.2, 0.02, 0.03, M.mat('#ffd23f'), 0, 0.02, 0.27, g); t.castShadow = false; // ₺ etiketi yerine sarı yama
  return g;
}
function makeRedArrow() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 3), new THREE.MeshStandardMaterial({ color: '#e8473c', emissive: '#ff2a1a', emissiveIntensity: 0.45 }));
  c.rotation.x = PI / 2; c.position.z = 0.35; g.add(c);
  g.visible = false;
  return g;
}

function targets() {
  const p = G.player.position;
  // kasadarın başında durduğu yığına (P.clerk) ve şehirdeki kasaya (ayrı dünya) gelmez
  return G.stations.filter((s) => s instanceof MoneyPile && s.amount >= MIN_LOOT && !s.clerk && s.zone.x < 300 && Math.hypot(s.zone.x - p.x, s.zone.z - p.z) > 8);
}
function spawn(pile) {
  const at = V(pile.zone.x, 0, pile.zone.z);
  const ex = EXITS.filter((e) => e.ok()).sort((a, b) => a.at.distanceTo(at) - b.at.distanceTo(at))[0];
  const obj = makeThief();
  obj.position.copy(ex.at);
  G.scene.add(obj);
  const el = document.createElement('div');
  el.className = 'thief';
  el.innerHTML = '<span class="tp">🦹 <b>Hırsız</b></span>'; // yanıp sönme içteki pilde: dıştaki transform konumu taşır
  const label = G.labels.add(el, (v) => v.copy(obj.position).setY(obj.position.y + 2.5));
  T = G.thief = { obj, pile, exit: ex, state: 'sneak', path: [at], leg: null, loot: 0, bag: null, el, tp: el.firstChild, label, t: 0, run: 0, runFor: rand(6, 9), rest: 0, active: true };
}
function remove() {
  G.scene.remove(T.obj);
  G.labels.remove(T.label);
  T = G.thief = null;
  if (arrow) arrow.visible = false;
  nextT = rand(110, 170);
}

// yol noktalarını sırayla yürür; önü kapalıysa (bina, çit) findRoute ile dolanır
function walk(dt, speed) {
  const p = T.obj.position;
  while (T.path.length) {
    if (T.path[0] !== T.leg) {
      const r = findRoute(p, T.path[0]);
      if (r.length > 1) { r.pop(); T.path.unshift(...r); }
      T.leg = T.path[0];
    }
    const d = T.path[0], dx = d.x - p.x, dz = d.z - p.z, dist = Math.hypot(dx, dz), st = speed * dt;
    if (dist > 1e-4) T.obj.rotation.y = lerpAngle(T.obj.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
    if (dist > st) { p.x += (dx / dist) * st; p.z += (dz / dist) * st; return false; }
    p.x = d.x; p.z = d.z; T.path.shift();
  }
  return true;
}

function steal() {
  const pile = T.pile;
  if (pile.amount < 5) { T.state = 'leave'; T.path = escapePath(); T.leg = null; return; } // oyuncu yığını toplamış: eli boş gider
  const take = Math.round(Math.min(pile.amount, Math.max(25, pile.amount * 0.6), 400));
  const n = Math.min(pile.bills.length, Math.ceil(pile.bills.length * take / pile.amount));
  for (let i = 0; i < n; i++) { const b = pile.bills.pop(); fly(b, T.obj, V(0, 1.2, -0.35), 0.3 + i * 0.03, 0.8, (o) => o.parent && o.parent.remove(o)); }
  pile.amount -= take;
  T.loot = take;
  T.bag = makeBag(); T.bag.position.set(0, 1.0, -0.42); T.obj.add(T.bag);
  T.tp.innerHTML = `🦹 <b>Hırsız</b> 💰 ${take} ₺`;
  T.el.classList.add('loot');
  banner('HIRSIZ!', `Kasadan ${take} ₺ çaldı, kaçmadan yakala!`);
  if (!firstSeen) { firstSeen = true; setTimeout(() => toast('Hırsızın peşinden koş, ona değince paran geri gelir.'), 4200); }
  sfx('bong');
  // kamera hırsıza döner, ekran kenarı kırmızı yanıp söner, başında "HIRSIZ!" yazısı
  G.camFocus = { pos: T.obj.position, until: G.time + 2.8 };
  floatText(T.obj.position, '🚨 HIRSIZ!', 'shout');
  alarm();
  T.state = 'grab'; T.t = 0.7;
}

function alarm() {
  let el = document.getElementById('thiefAlarm');
  if (!el) { el = document.createElement('div'); el.id = 'thiefAlarm'; document.body.appendChild(el); }
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
}

// by: 'player' ya da bekçi/köpek (who: o bekçi); oyuncu yakalarsa para doğrudan cebe, bekçi yakalarsa yığına döner
export function thiefCaught(by, who) {
  if (!T || !(T.state === 'sneak' || T.state === 'grab' || T.state === 'flee')) return false;
  const p = T.obj.position;
  if (T.loot > 0) {
    if (by === 'player') {
      G.money += T.loot; G.stats.earned += T.loot;
      for (let i = 0; i < Math.min(10, Math.ceil(T.loot / 20)); i++) {
        const b = M.makeBillMesh(); b.position.set(p.x, 1.3, p.z); G.scene.add(b);
        fly(b, G.player, V(0, 1.5, 0), 0.3 + i * 0.04, 1.0, (o) => o.parent && o.parent.remove(o));
      }
      floatText(G.player.position, `+${T.loot} ₺`, 'pos');
      sfx('pay');
    } else T.pile.add(T.loot, p);
  }
  if (T.bag) { T.obj.remove(T.bag); T.bag = null; }
  const back = T.loot ? ` · ${T.loot} ₺ geri geldi` : '';
  banner('YAKALANDI!', by === 'player' ? (T.loot ? `${T.loot} ₺ geri alındı` : 'Hırsızı daha çalmadan yakaladın') : by === 'dog' ? `Bekçi köpeği hırsızı yakaladı${back}` : `Bekçi hırsızı yakaladı${back}`);
  confetti(p.clone().setY(1), 40);
  sfx('happy');
  T.loot = 0;
  T.tp.innerHTML = '😵 <b>Yakalandı</b>'; T.el.classList.remove('loot'); T.el.classList.add('caught');
  // bekçi varsa (yakalayan bekçi, köpeği ya da en yakın bekçi) yere yatırıp kelepçeler, polise teslim eder
  const guard = who || ((G.staff && G.staff.guard) || []).filter((w) => !w.gone).sort((a, b) => a.obj.position.distanceTo(p) - b.obj.position.distanceTo(p))[0];
  if (guard && arrest(T, guard, by, { done: handedOver, flee: fleeCuffs })) return true;
  T.state = 'stun'; T.t = 1.6;
  return true;
}
// polis arka koltuğa oturttu: hırsız artık polis aracının içinde (polis.js götürür), etiketi kalkar, sonraki hırsız sayılır
function handedOver() {
  if (!T) return;
  G.labels.remove(T.label);
  T = G.thief = null;
  if (arrow) arrow.visible = false;
  nextT = rand(110, 170);
}
// sahne bozuldu (bekçi işten çıkarıldı): kelepçesinden kurtulup kaçar
function fleeCuffs() {
  if (!T) return;
  T.state = 'leave'; T.path = escapePath(); T.leg = null;
  T.tp.innerHTML = '🏃 <b>Hırsız</b>';
}

export function updateThief(dt) {
  if (!G.player) return;
  updatePolice(dt); // yakalama, kelepçe, polis aracı (polis.js)
  if (!arrow) { arrow = makeRedArrow(); G.scene.add(arrow); }
  if (!T) {
    if (!G.unlocked.has('gp')) return; // pazar açılmadan hırsız gelmez
    nextT -= dt;
    if (nextT > 0) return;
    const list = targets();
    if (!list.length) { nextT = 10; return; }
    spawn(list.sort((a, b) => b.amount - a.amount)[0]);
    return;
  }
  const o = T.obj, p = o.position, pl = G.player.position;
  if (T.state === 'arrest') { arrow.visible = false; return; } // bekçi ve polis sürer (polis.js)
  let moving = false;
  switch (T.state) {
    case 'sneak': // yığına sinsice yürür
      moving = true;
      if (walk(dt, SNEAK)) steal();
      break;
    case 'grab': // parayı çuvala doldurur
      T.t -= dt;
      if (T.t <= 0) { T.state = 'flee'; T.path = escapePath(); T.leg = null; }
      break;
    case 'flee':
      // ağır çuvalla koşar, birkaç saniyede bir durup nefeslenir (kovalayan yetişsin)
      if (T.rest > 0) { T.rest -= dt; break; }
      T.run += dt;
      if (T.run > T.runFor) { T.run = 0; T.runFor = rand(6, 9); T.rest = rand(0.9, 1.3); floatText(p, '😮‍💨 Nefes nefese!', 'neg'); break; }
      moving = true;
      if (walk(dt, T.loot ? LOADED : RUN)) {
        toast(`Hırsız ${T.loot} ₺ ile kaçtı! Yükseltmeler'den bekçi tutabilirsin.`);
        sfx('bad');
        remove();
        return;
      }
      break;
    case 'stun': // başında yıldızlar, sonra eli boş kaçar
      T.t -= dt;
      if (Math.random() < dt * 8) sparkle(V(p.x, 2.1, p.z), '#ffe14d', 2);
      if (T.t <= 0) { T.state = 'leave'; T.path = escapePath(); T.leg = null; T.tp.innerHTML = '🏃 <b>Hırsız</b>'; }
      break;
    case 'leave':
      moving = true;
      if (walk(dt, RUN * 1.25)) { remove(); return; }
      break;
  }
  // oyuncu hırsıza değerse yakalanır
  if ((T.state === 'sneak' || T.state === 'grab' || T.state === 'flee') && Math.hypot(pl.x - p.x, pl.z - p.z) < 1.15) thiefCaught('player');
  if (!T) return;
  M.animateCharacter(o, moving ? 1 : 0, dt * (T.state === 'flee' || T.state === 'leave' ? 1.4 : 0.8), T.state === 'grab');
  // çaldıktan sonra kırmızı ok oyuncunun önünde hırsızı gösterir
  const chase = T.state === 'flee' || T.state === 'grab';
  const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz);
  arrow.visible = chase && d > 3;
  if (arrow.visible) {
    arrow.position.set(pl.x + (dx / d) * 1.7, pl.y + 0.25 + Math.sin(G.time * 8) * 0.06, pl.z + (dz / d) * 1.7);
    arrow.rotation.y = Math.atan2(dx, dz);
  }
}

// test kancası: hemen bir hırsız gönder
window.__thief = () => { if (T) return 'zaten var'; const l = targets(); if (!l.length) return 'yığın yok'; spawn(l.sort((a, b) => b.amount - a.amount)[0]); return 'geldi'; };

// köpek modeli (bekçinin köpeği, upgrades.js kullanır)
export function makeDog() {
  const g = new THREE.Group();
  const fur = M.mat('#a0682f'), dark = M.mat('#5a3a1a'), black = M.mat('#1a1a1a');
  const body = M.rbox(0.36, 0.34, 0.8, 0.14, fur, 0, 0.48, 0, g);
  const head = new THREE.Group(); head.position.set(0, 0.78, 0.42); g.add(head);
  M.rbox(0.3, 0.3, 0.32, 0.12, fur, 0, 0, 0, head);
  M.rbox(0.18, 0.15, 0.2, 0.06, M.mat('#c48a4a'), 0, -0.06, 0.2, head);
  M.sph(0.045, black, 0, -0.02, 0.31, head, 8, 6);
  for (const sx of [-1, 1]) {
    M.sph(0.035, black, sx * 0.08, 0.07, 0.16, head, 8, 6);
    const ear = M.rbox(0.08, 0.18, 0.05, 0.03, dark, sx * 0.14, 0.12, -0.04, head); ear.rotation.z = sx * 0.4;
  }
  const legs = [];
  for (const [x, z] of [[-0.12, 0.28], [0.12, 0.28], [-0.12, -0.28], [0.12, -0.28]]) {
    const hip = new THREE.Group(); hip.position.set(x, 0.38, z); g.add(hip);
    M.rbox(0.1, 0.38, 0.1, 0.04, fur, 0, -0.19, 0, hip);
    legs.push(hip);
  }
  const tail = M.rbox(0.07, 0.07, 0.32, 0.03, fur, 0, 0.62, -0.5, g); tail.rotation.x = -0.6;
  M.rbox(0.32, 0.06, 0.06, 0.02, M.mat('#e8473c'), 0, 0.12, -0.13, head); // kırmızı tasma
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData = { legs, tail, head, body, walk: 0 };
  g.scale.setScalar(0.8); // karakterin yarısı kadar kalıyordu: orta boy köpek
  return g;
}
export function animateDog(g, speed01, dt) {
  const u = g.userData;
  u.walk += dt * 16 * Math.max(0.2, speed01);
  const s = Math.sin(u.walk) * 0.7 * speed01;
  u.legs[0].rotation.x = s; u.legs[3].rotation.x = s; u.legs[1].rotation.x = -s; u.legs[2].rotation.x = -s;
  u.tail.rotation.y = Math.sin(G.time * (speed01 > 0.1 ? 14 : 6)) * 0.5;
  u.body.position.y = 0.48 + Math.abs(Math.cos(u.walk)) * 0.04 * speed01;
}
