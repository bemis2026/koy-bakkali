// Motorlu ve atlı müşteriler.
// Motor: bisiklet parkına motosikletle gelen müşteri (world.js spawnBiker kullanır).
// At Ahırı: köy yolundan atlı müşteriler gelir, atını bölmeye bırakıp bankta bekler. Ahırın batısındaki tarlada buğday
// büyür, harman makinesi buğdaydan saman çıkarır. Oyuncu ya da seyis samanı atın yemliğine koyar, gerekiyorsa atı tımar eder (bölmenin önünde durmak). Bakım bitince atlı
// parasını öder, atına binip gider.
import * as THREE from 'three';
import * as M from './models.js';
import { G, Station, Converter, PlantBed, MoneyPile, Customer, fly, floatText, sfx, popIn, lerpAngle, rand, pick, mult } from './game.js';
import { sparkle } from './fx.js';
import { leavePts } from './dukkan.js';
import { vehicle } from './arac.js';
import { esya } from './esya.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// ---------- modeller ----------
// motosiklet: iki teker, renkli depo, siyah sele, gidon ve far; tekerler userData.wheels (x ekseninde döner)
export function makeMotorbike(col = '#e8604c') {
  const v = vehicle('motosiklet', col); // Poly Pizza motosikleti (arac.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  const paint = M.mat(col, { rough: 0.3 }), black = M.mat('#1d1f24', { rough: 0.6 }), steel = M.mat('#b9c0c8', { rough: 0.25 });
  const wheels = [];
  for (const z of [-0.62, 0.62]) {
    const w = new THREE.Group(); w.position.set(0, 0.33, z); g.add(w);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 8, 18), black); tyre.rotation.y = PI / 2; w.add(tyre);
    const hub = M.cyl(0.08, 0.08, 0.1, 10, steel, 0, 0, 0, w); hub.rotation.z = PI / 2;
    for (let i = 0; i < 3; i++) { const s = M.rbox(0.03, 0.46, 0.03, 0.01, steel, 0, 0, 0, w); s.rotation.x = (i * PI) / 3; }
    wheels.push(w);
  }
  M.rbox(0.22, 0.2, 1.0, 0.06, black, 0, 0.42, 0, g);              // gövde
  M.rbox(0.36, 0.26, 0.5, 0.12, paint, 0, 0.66, 0.2, g);           // depo
  M.rbox(0.3, 0.1, 0.55, 0.05, black, 0, 0.64, -0.26, g);          // sele
  M.rbox(0.28, 0.16, 0.36, 0.06, paint, 0, 0.6, -0.55, g);         // arka çamurluk
  const fork = M.rbox(0.06, 0.6, 0.06, 0.02, steel, 0, 0.62, 0.56, g); fork.rotation.x = -0.35;
  M.rbox(0.62, 0.04, 0.04, 0.02, black, 0, 0.92, 0.48, g);          // gidon
  M.cyl(0.08, 0.08, 0.08, 12, M.mat('#fff6c8', { emissive: '#fff2a0', ei: 0.4 }), 0, 0.84, 0.66, g).rotation.x = PI / 2; // far
  const ex = M.cyl(0.045, 0.045, 0.6, 8, steel, 0.17, 0.32, -0.3, g); ex.rotation.x = PI / 2; // egzoz
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData = { wheels };
  g.scale.setScalar(1.25); // karaktere göre orantılı: sele ~0,8, boy ~2,4
  return g;
}
// motorcunun kaskı
export function addHelmet(ch, col = '#2d3e66') {
  const hd = ch.userData.head;
  const h = M.sph(0.36, M.mat(col, { rough: 0.25 }), 0, 0.06, -0.02, hd, 16, 12); h.scale.set(1, 0.95, 1.05);
  M.rbox(0.42, 0.14, 0.08, 0.05, M.mat('#1d1f24', { rough: 0.15 }), 0, 0.05, 0.33, hd); // vizör
}

// at: gövde, boyun, kafa, yele, dört bacak (yürürken çapraz adım), kuyruk, eyer
export function makeHorse(col) { return M.tagAnimal(rawHorse(col), 'at'); } // albüm: hayvan kaydı (album.js)
function rawHorse(col = '#8b5a2b') {
  const gh = M.glbHorse(col); // GLB at (models.js); yüklenemediyse kodla çizilen at
  if (gh) return gh;
  const g = new THREE.Group();
  const coat = M.mat(col), maneM = M.mat('#2a1d12'), hoof = M.mat('#262626'), black = M.mat('#141414');
  const body = M.rbox(0.62, 0.62, 1.55, 0.25, coat, 0, 1.15, 0, g);
  const neck = new THREE.Group(); neck.position.set(0, 1.32, 0.6); g.add(neck);
  const nk = M.rbox(0.32, 0.78, 0.38, 0.14, coat, 0, 0.3, 0.12, neck); nk.rotation.x = 0.5;
  const mane = M.rbox(0.09, 0.72, 0.16, 0.04, maneM, 0, 0.38, -0.04, neck); mane.rotation.x = 0.5;
  const head = new THREE.Group(); head.position.set(0, 0.68, 0.38); neck.add(head);
  M.rbox(0.3, 0.3, 0.6, 0.12, coat, 0, 0, 0.16, head);
  M.rbox(0.26, 0.22, 0.2, 0.08, M.mat('#3a2a1e'), 0, -0.05, 0.44, head);
  for (const sx of [-1, 1]) {
    M.sph(0.04, black, sx * 0.152, 0.06, 0.1, head, 8, 6);
    const ear = M.rbox(0.07, 0.16, 0.05, 0.02, coat, sx * 0.09, 0.2, -0.06, head); ear.rotation.z = sx * 0.2;
  }
  // bacak iki parça: üstte kalça/omuz, ortada diz (önde bilek, arkada topuk), altta incik ve toynak. Adım atarken diz bükülür, toynak kalkar
  const legs = [], knees = [];
  for (const [x, z] of [[-0.19, 0.55], [0.19, 0.55], [-0.19, -0.55], [0.19, -0.55]]) {
    const hip = new THREE.Group(); hip.position.set(x, 0.92, z); g.add(hip);
    M.rbox(0.16, 0.48, 0.16, 0.06, coat, 0, -0.22, 0, hip);
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0); hip.add(knee);
    M.rbox(0.12, 0.42, 0.12, 0.04, coat, 0, -0.2, 0, knee);
    M.rbox(0.16, 0.1, 0.18, 0.03, hoof, 0, -0.43, 0.01, knee);
    legs.push(hip); knees.push(knee);
  }
  const tail = new THREE.Group(); tail.position.set(0, 1.32, -0.78); g.add(tail);
  const tl = M.rbox(0.13, 0.66, 0.13, 0.05, maneM, 0, -0.3, -0.08, tail); tl.rotation.x = -0.3;
  M.rbox(0.72, 0.04, 0.72, 0.02, M.mat('#c8463a'), 0, 0.32, 0.02, body); // eyer örtüsü (gövdeyle birlikte iner kalkar)
  M.rbox(0.56, 0.1, 0.5, 0.05, M.mat('#6b3a1e'), 0, 0.38, 0.02, body);   // eyer
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData = { legs, knees, head, neck, tail, body, walk: 0, eat: 0 };
  return g;
}
// at gibi yürüyüş (2026-11-02 kullanıcı: "atların yürüyüşünü geliştir, insanlardan farklı at gibi olsun"): yavaşta dört vuruşlu yürüyüş
// (sol arka, sol ön, sağ arka, sağ ön; her bacak çeyrek tur arayla), hızlıda tırıs (çapraz çiftler birlikte). Öne gelen bacağın dizi
// bükülür, toynak yerden kalkar; baş her adımda iner kalkar, gövde hafifçe yalpalar; tırısta sıçrar
const GAIT = { walk: [0.25, 0.75, 0, 0.5], trot: [0, 0.5, 0.5, 0] }; // bacaklar: sol ön, sağ ön, sol arka, sağ arka
export function animateHorse(g, speed01, dt, eat = false) {
  const u = g.userData;
  const trot = speed01 > 0.65, k = Math.min(1, speed01 * 1.6);
  u.walk += dt * (trot ? 9.5 : 6.5) * Math.max(0.15, speed01);
  const ph = trot ? GAIT.trot : GAIT.walk, amp = trot ? 0.5 : 0.38;
  for (let i = 0; i < 4; i++) {
    const a = u.walk + ph[i] * Math.PI * 2;
    u.legs[i].rotation.x = Math.sin(a) * amp * k; // artı: toynak geriye
    if (u.knees) u.knees[i].rotation.x = Math.max(0, -Math.cos(a)) * (i < 2 ? 1.0 : 0.75) * k; // öne savrulurken diz bükülür
  }
  const bob = trot ? Math.abs(Math.sin(u.walk)) * 0.07 : (Math.sin(u.walk * 2) * 0.5 + 0.5) * 0.025;
  u.body.position.y = 1.15 + bob * k;
  u.body.rotation.z = Math.sin(u.walk) * (trot ? 0.015 : 0.03) * k;
  u.eat += ((eat ? 1 : 0) - u.eat) * Math.min(1, dt * 4);
  // yerken boynu yemliğe eğilir, başı hafifçe sağa döner ve çiğner; yürürken baş her adımda iner kalkar (tırısta az)
  u.neck.position.y = 1.32 + bob * k;
  u.neck.rotation.x = u.eat * (0.95 + Math.sin(G.time * 7) * 0.06) + Math.sin(u.walk * 2 + 0.6) * (trot ? 0.04 : 0.1) * k;
  u.neck.rotation.y = -u.eat * 0.45;
  u.tail.rotation.z = Math.sin(G.time * 2.2 + u.walk) * 0.25;
}
const COATS = ['#8b5a2b', '#5a3a22', '#d9c7a8', '#3a2a22', '#b07a45', '#efe9df'];

// ahır binası: arka duvar, yan duvarlar, bölme araları, öne eğik çatı, ön direkler, her bölmede yemlik
function makeStable(xs, w) {
  const g = new THREE.Group();
  const plank = M.mat('#9c6a3f'), dark = M.mat('#6b4428'), roof = M.mat('#9c4a2e');
  const x0 = xs[0] - w / 2, x1 = xs[xs.length - 1] + w / 2, L = x1 - x0, cx = (x0 + x1) / 2;
  // ahır modeli (esya.js) varsa her bölmenin arkasında bir ahır evi; yoksa arka duvar ve yalnız arka yarıyı örten çatı
  const ev = esya('atahiri');
  if (ev) for (const x of xs) { const e = esya('atahiri'); e.position.set(x, 0, -2.5); g.add(e); }
  else M.rbox(L, 2.6, 0.2, 0.05, plank, cx, 1.3, -3.45, g);
  for (const x of [x0, x1]) M.rbox(0.2, 2.4, 4.4, 0.05, plank, x, 1.2, -1.3, g);
  for (let i = 1; i < xs.length; i++) M.rbox(0.14, 1.5, 4.0, 0.04, dark, xs[i] - w / 2, 0.75, -1.4, g);
  for (let i = 0; i <= xs.length; i++) M.rbox(0.2, 2.7, 0.2, 0.05, dark, x0 + i * w, 1.35, 1.0, g);
  M.rbox(L + 0.4, 0.22, 0.24, 0.05, dark, cx, 2.62, 1.0, g); // ön kiriş
  if (!ev) { // çatı yalnızca arka yarıda: kameradan bakınca bölmedeki atlar görünsün
    const r = M.rbox(L + 1.0, 0.16, 2.3, 0.05, roof, cx, 2.92, -2.75, g); r.rotation.x = -0.14;
    for (let i = 0; i <= xs.length; i++) M.rbox(0.14, 0.14, 4.6, 0.03, dark, x0 + i * w, 2.66, -1.2, g); // çatıdan öne uzanan kirişler
  }
  for (const x of xs) { // yemlik: bölmenin ön sağ köşesinde
    M.rbox(0.9, 0.5, 0.6, 0.06, dark, x + w / 2 - 0.65, 0.25, 0.35, g);
    M.rbox(0.78, 0.04, 0.48, 0.02, M.mat('#e8c45a'), x + w / 2 - 0.65, 0.49, 0.35, g);
  }
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
function makeBench(len = 3.6) {
  const g = new THREE.Group();
  const wood = M.mat('#a8703f'), dark = M.mat('#6b4428');
  M.rbox(len, 0.08, 0.5, 0.03, wood, 0, 0.46, 0, g);
  M.rbox(len, 0.4, 0.07, 0.03, wood, 0, 0.75, 0.24, g); // arkalık
  for (const x of [-len / 2 + 0.2, 0, len / 2 - 0.2]) M.rbox(0.08, 0.46, 0.44, 0.02, dark, x, 0.23, 0, g);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// ---------- ahır bölmesi ----------
const STALL_W = 3.95, STALL_X = [-49.6, -45.65, -41.7, -37.75], IN_Z = -1.3, FRONT_Z = 3.6; // IN_Z: at bölmenin içinde durur (ahır evi modeli -0,5 istiyordu; 2026-11-03'te eski ahıra dönüldü, esya.js off)
const GATE_X = -45, ROAD_Z = 10.4, FAR_X = -121; // ormanın içindeki köy yolunda (eskiden -91)
const BENCH = { x: -37.7, z: 7.4, seats: [-39.0, -38.0, -37.0, -36.3] };
const PAY_BASE = 10, PAY_HAY = 14, PAY_GROOM = 12, GROOM_T = 2.4, PATIENCE = 90;
// atın adım hızları (m/sn): GLB at 2,2'nin üstünde koşu klibine geçer (hayvan.js SPEC.at runAt), adımda bunun altında kalır.
// 2026-11-03 kullanıcı: "atlar kayar gibi yürüyor, gerçekçi bir yürüyüş olsun": 1,7 / 1,3 idi; at sakin, saniyede bir adımla yürür
const ROAD_WALK = 1.35, YARD_WALK = 1.1;

// binici eyerde: atın sırtına oturur, atla birlikte iner kalkar (GLB atta eyer kayması seatDy/seatDz)
function sitOn(horse, man) {
  const a = horse.rotation.y, u = horse.userData, back = 0.05 - (u.seatDz || 0);
  man.position.set(horse.position.x - Math.sin(a) * back, 0.9 + (u.seatDy || 0) + u.body.position.y - 1.15, horse.position.z - Math.cos(a) * back);
  man.rotation.y = a;
}
// binicinin bacakları üzengide, atın adımıyla hafifçe sallanır
function rideLegs(man, horse, hs, dt) {
  M.animateCharacter(man, 0, dt, false);
  for (const l of man.userData.legs) l.rotation.x = -0.35 + Math.sin(horse.userData.walk) * 0.08 * hs;
}
const mountLegs = (man, on) => { const L = man.userData.legs; L[0].rotation.z = on ? -0.55 : 0; L[1].rotation.z = on ? 0.55 : 0; };

export class Stall extends Station {
  constructor(R, x, instant) {
    super(x, 1.75, 2.8, 1.3, { instant });
    this.bodyFn = () => [[x - 1.7, x + 1.7, 0.25, 0.85]]; // yalnızca kendi bölmesinin önü: komşu bölmeyle karışmasın
    this.R = R; this.x = x; this.rider = null; this.need = 0; this.groom = 0; this.got = 0; this.groomed = false; this.eaten = [];
    this.trough = new THREE.Group(); this.trough.position.set(x + STALL_W / 2 - 0.65, 0.52, 0.35); R.content.add(this.trough);
  }
  ready() { return !!this.rider && this.rider.horseIn && !this.rider.done; } // at bölmede, bakımı sürüyor (sahibi nerede olursa olsun)
  feedFrom(stack) {
    if (!this.ready() || this.need <= 0) return false;
    const it = stack.takeOf(['saman']);
    if (!it) return false;
    this.need--; this.got++;
    fly(it.obj, this.trough, V(((this.got % 3) - 1) * 0.2, 0, 0), 0.3, 0.9, (o) => this.eaten.push({ o, t: 5 }));
    sfx('pop', { npc: stack !== G.stack });
    this.rider.refresh();
    return true;
  }
  groomTick(dt) {
    if (!this.ready() || this.groom <= 0) return false;
    this.groom = Math.max(0, this.groom - dt);
    const h = this.rider.horse.position;
    if (Math.random() < 0.6) sparkle(V(h.x + rand(-0.4, 0.4), 1.4, h.z + rand(-0.6, 0.6)), '#fff3b0', 2);
    if (this.groom === 0) { this.groomed = true; sfx('happy'); }
    this.rider.refresh();
    return true;
  }
  update(dt) {
    // yenen saman yemlikte küçülerek biter
    for (let i = this.eaten.length - 1; i >= 0; i--) {
      const e = this.eaten[i]; e.t -= dt;
      e.o.scale.setScalar(Math.max(0.05, Math.min(1, e.t / 3)));
      if (e.t <= 0) { e.o.parent && e.o.parent.remove(e.o); this.eaten.splice(i, 1); }
    }
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.15) { const step = this.t; this.t = 0; if (!this.feedFrom(G.stack)) this.groomTick(step); }
  }
}

// ---------- atlı müşteri ----------
// Atını bölmeye bırakır; bakım sürerken bankta oturur, köy marketinde alışveriş yapar (gerçek müşteri olur)
// ya da plaja / pazara gezmeye gider. Döndüğünde at hazırsa parasını öder, atına binip gider; değilse bankta bekler.
class Rider {
  constructor(R, stall) {
    this.R = R; this.stall = stall; stall.rider = this;
    this.horse = makeHorse(pick(COATS));
    this.look = M.randomLook();
    this.man = M.makeCharacter(this.look);
    this.horse.position.set(FAR_X, 0, ROAD_Z); this.horse.rotation.y = PI / 2;
    G.scene.add(this.horse); G.scene.add(this.man);
    this.seat = null; this.p = 1; this.state = 'ride'; this.done = null; this.horseIn = false; this.route = [];
    // 2026-11-03 kullanıcı: "atlılar sürekli koşmasın, nadiren koşan atlı görelim": çoğu yolda adım gider, ara sıra biri dörtnala
    this.gallop = Math.random() < 0.15;
    this.path = [V(GATE_X, 0, ROAD_Z), V(GATE_X, 0, 7.0), V(stall.x, 0, FRONT_Z)];
    this.mount(true);
  }
  mount(on) { mountLegs(this.man, on); this.riding = on; }
  // at yol noktalarına yürür; dönerek ya da geri geri (back) gider
  moveHorse(dt, speed, back = false) {
    const h = this.horse.position;
    while (this.path.length) {
      const q = this.path[0], dx = q.x - h.x, dz = q.z - h.z, d = Math.hypot(dx, dz), st = speed * dt;
      if (!back && d > 1e-3) this.horse.rotation.y = lerpAngle(this.horse.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-6 * dt));
      if (d > st) { h.x += (dx / d) * st; h.z += (dz / d) * st; return false; }
      h.x = q.x; h.z = q.z; this.path.shift();
      if (back) return !this.path.length;
    }
    return true;
  }
  walkMan(dt, to, speed = 2.6) {
    const p = this.man.position, dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz), st = speed * dt;
    if (d > 1e-3) this.man.rotation.y = lerpAngle(this.man.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
    if (d <= st) { p.x = to.x; p.z = to.z; return true; }
    p.x += (dx / d) * st; p.z += (dz / d) * st;
    return false;
  }
  // binaların ve çitlerin etrafından dolanarak yürür (world.js yol bulma)
  routeTo(to) { this.route = G.hooks.route ? G.hooks.route(this.man.position, to) : [to]; }
  walkRoute(dt) {
    while (this.route.length) { if (!this.walkMan(dt, this.route[0], 2.8)) return false; this.route.shift(); }
    return true;
  }
  syncRider() { sitOn(this.horse, this.man); }
  // istek balonu: saman sayısı, tımar ve sabır halkası
  bubble() {
    if (this.label) return;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.innerHTML = '<span class="ring"><img alt=""></span><b></b><i class="gm">✨</i>';
    this.el = el; this.img = el.querySelector('img'); this.txt = el.querySelector('b'); this.ring = el.querySelector('.ring'); this.gm = el.querySelector('.gm');
    this.img.src = G.icons.saman;
    this.label = G.labels.add(el, (v) => v.copy(this.horse.position).setY(2.75));
    this.refresh();
  }
  refresh() {
    if (!this.el || this.done) return;
    const s = this.stall;
    this.ring.style.display = s.need > 0 ? '' : 'none';
    this.txt.textContent = s.need > 1 ? `×${s.need}` : '';
    this.gm.style.display = s.groom > 0 ? '' : 'none';
    this.gm.style.opacity = s.groom > 0 && s.groom < GROOM_T ? '0.6' : '1';
  }
  say(text, cls) {
    if (!this.el) return;
    this.el.className = 'bubble txt ' + cls;
    this.el.innerHTML = `<b>${text}</b>`;
  }
  // bakım bitti (ya da sabır tükendi): ücret belli olur, at sahibini bekler
  finish(late) {
    const s = this.stall;
    this.done = late ? 'late' : 'ok';
    this.pay = Math.round((late ? (s.got > 0 ? PAY_HAY * s.got * mult() : 0) : (PAY_BASE + PAY_HAY * s.got + (s.groomed ? PAY_GROOM : 0)) * mult()) * ((G.mods && G.mods.riderPay) || 1));
    this.say(late ? '⌛' : '🐴✔ Hazır', late ? 'angry' : 'happy');
  }
  // atına döndü: öder, atı bölmeden çıkar
  pickUp() {
    const s = this.stall, h = this.horse.position;
    if (this.pay > 0) { this.R.pile.add(this.pay, h); floatText(h, `+${this.pay} ₺`, 'pos'); }
    this.say(this.done === 'ok' ? (s.groomed ? '🐴💖 Eline sağlık!' : '🐴 Sağ ol!') : '😠 Çok bekledim!', this.done === 'ok' ? 'happy' : 'angry');
    if (this.seat) { this.seat.r = null; this.seat = null; }
    this.sit = false; this.man.position.y = 0; this.state = 'fetch';
  }
  // bakım sürerken ne yapacağı: market, gezinti ya da bank
  choosePlan() {
    const K = G.regions.koy, r = Math.random();
    const shopOk = G.hooks.shopKoy && K && K.shelves && K.shelves.some((sh) => sh.spots.some((q) => !q.c));
    if (r < 0.4 && shopOk) return this.startShop();
    if (r < 0.75) {
      const S = G.regions.sahil, P = G.regions.pazar;
      const spot = S && S.unlocked ? { at: V(rand(-12, 8), 0, rand(25.5, 28)), face: 0 } : P && P.unlocked ? { at: V(rand(26, 31), 0, rand(3, 5)), face: PI } : null;
      if (spot) { this.plan = 'stroll'; this.spot = spot; this.lingerT = 0; this.routeTo(spot.at); return; }
    }
    this.plan = 'bench';
  }
  startShop() {
    this.plan = 'shop';
    const c = new Customer(this.man.position.clone(), 'koy', this.look);
    this.man.visible = false;
    G.hooks.shopKoy(c, {
      entry: [V(GATE_X, 0, 7.4), V(GATE_X, 0, ROAD_Z), V(-15.2, 0, ROAD_Z)],
      exit: () => [...leavePts(), V(-15.2, 0, ROAD_Z), V(GATE_X, 0, ROAD_Z), V(GATE_X, 0, 7.0)],
      onExit: () => { this.man.position.copy(c.obj.position).setY(0); this.man.rotation.y = c.obj.rotation.y; c.destroy(); this.man.visible = true; this.back(); },
    });
    c.state = 'begin';
  }
  back() { this.plan = 'return'; this.routeTo(V(this.stall.x + 1.3, 0, FRONT_Z + 0.3)); }
  update(dt) {
    const s = this.stall, h = this.horse.position, m = this.man.position;
    let hs = 0, ms = 0, eat = false;
    // at bölmedeyken bakım ve sabır, sahibinin nerede olduğundan bağımsız işler
    if (this.horseIn && !this.done) {
      eat = s.eaten.length > 0;
      this.p = Math.max(0, this.p - dt / PATIENCE);
      if (this.ring) this.ring.style.setProperty('--p', this.p.toFixed(3));
      if (s.need === 0 && s.groom === 0) this.finish(false);
      else if (this.p <= 0) this.finish(true);
    } else if (this.horseIn) eat = s.eaten.length > 0;
    switch (this.state) {
      case 'ride': { // yolda adım (seyrek dörtnala), avluda ağır adım
        const sp = h.z > 8.6 ? (this.gallop ? 5.5 : ROAD_WALK) : YARD_WALK;
        hs = sp / 5.5;
        if (this.moveHorse(dt, sp)) {
          this.state = 'off'; this.mount(false);
          this.manTo = V(s.x + 1.3, 0, FRONT_Z + 0.3);
          this.path = [V(s.x, 0, IN_Z)];
        }
        this.syncRider();
        break;
      }
      case 'off': // iner; at geri geri bölmesine girer, sahibi ne yapacağına karar verir
        if (m.y > 0) m.y = Math.max(0, m.y - dt * 3);
        if (this.manTo) { ms = 1; if (this.walkMan(dt, this.manTo)) { this.manTo = null; this.choosePlan(); this.state = 'act'; } }
        break;
      case 'act': // bakım sürerken: bank, market ya da gezinti
        if (this.plan === 'bench') {
          if (!this.seat) { this.seat = this.R.seats.find((q) => !q.r) || null; if (this.seat) this.seat.r = this; }
          if (this.seat && !this.sit) { ms = 1; if (this.walkMan(dt, V(this.seat.x, 0, BENCH.z - 0.3))) this.sit = true; }
          if (this.done && this.horseIn) { this.sit = false; m.y = 0; if (this.seat) { this.seat.r = null; this.seat = null; } this.state = 'toHorse'; }
        } else if (this.plan === 'stroll') {
          if (!this.lingerT) { ms = 1; if (this.walkRoute(dt)) this.lingerT = rand(12, 24); }
          else {
            this.man.rotation.y = lerpAngle(this.man.rotation.y, this.spot.face, Math.min(1, dt * 3));
            this.lingerT -= dt;
            if (this.lingerT <= 0 || (this.done && this.lingerT < 8)) { this.lingerT = 0; this.back(); }
          }
        } else if (this.plan === 'return') {
          ms = 1;
          if (this.walkRoute(dt)) { if (this.done && this.horseIn) this.state = 'toHorse'; else this.plan = 'bench'; }
        }
        // 'shop': müşteri olarak markette; çıkınca onExit → back()
        break;
      case 'toHorse':
        ms = 1;
        if (this.walkMan(dt, V(s.x + 1.0, 0, FRONT_Z))) this.pickUp();
        break;
      case 'fetch': { // at bölmeden çıkar, sahibi biner
        if (!this.out) { this.path = [V(s.x, 0, FRONT_Z)]; this.out = true; }
        const hd = this.moveHorse(dt, 1.3); hs = hd ? 0 : 0.4;
        this.man.rotation.y = lerpAngle(this.man.rotation.y, PI, Math.min(1, dt * 4));
        if (hd) {
          this.state = 'away'; this.mount(true);
          this.path = [V(GATE_X, 0, 7.0), V(GATE_X, 0, ROAD_Z), V(FAR_X, 0, ROAD_Z)];
          if (this.label) { G.labels.remove(this.label); this.label = null; this.el = null; }
          s.rider = null; s.need = 0; s.groom = 0;
        }
        break;
      }
      case 'away': {
        const sp = h.z > 8.6 ? (this.gallop ? 6.0 : ROAD_WALK) : YARD_WALK; hs = sp / 5.5;
        const done = this.moveHorse(dt, sp);
        this.syncRider();
        if (done) { G.scene.remove(this.horse); G.scene.remove(this.man); this.dead = true; }
        break;
      }
    }
    // at bölmesine geri geri girer (sahibi o sırada yürüyüp gidebilir)
    if (this.state !== 'ride' && !this.horseIn) {
      const done = this.moveHorse(dt, 0.8, true); hs = done ? 0 : 0.35;
      this.horse.rotation.y = lerpAngle(this.horse.rotation.y, 0, Math.min(1, dt * 3));
      if (done) {
        this.horseIn = true; this.p = 1;
        s.need = 1 + Math.floor(Math.random() * 3); s.got = 0; s.groom = Math.random() < 0.55 ? GROOM_T : 0; s.groomed = false;
        this.bubble();
      }
    }
    animateHorse(this.horse, Math.min(1, hs), dt, eat);
    const legs = this.man.userData.legs;
    if (this.riding) rideLegs(this.man, this.horse, hs, dt);
    else if (this.sit) { // bankta oturur, ahıra bakar
      m.y = 0.48 - 0.62; this.man.rotation.y = PI;
      M.animateCharacter(this.man, 0, dt, false);
      for (const l of legs) l.rotation.x = -PI / 2;
    } else if (this.man.visible) M.animateCharacter(this.man, ms, dt, false);
  }
}

// harman makinesi: buğday soldaki besleme masasına konur, kırmızı gövdede dövülür, saman sağdaki oluktan yığına akar.
// Çalışırken yandaki çark döner (userData.wheel)
export function makeThresher() {
  const g = new THREE.Group(), red = M.mat('#c0392b', { rough: 0.5 }), dark = M.mat('#2b2f33');
  M.rbox(1.3, 0.72, 0.9, 0.05, M.mat('#b07a45'), -0.8, 0.36, 0, g); // besleme masası
  M.rbox(1.25, 1.05, 1.0, 0.1, red, 0.62, 0.78, 0, g); // gövde
  const hop = M.cyl(0.6, 0.28, 0.5, 4, M.mat('#e0b04a'), 0.55, 1.55, 0, g); hop.rotation.y = PI / 4; // huni
  const chute = M.rbox(0.6, 0.12, 0.42, 0.03, M.mat('#8a8f96'), 1.42, 0.95, 0, g); chute.rotation.z = -0.45; // saman oluğu
  for (const z of [-0.55, 0.55]) { const w = M.cyl(0.3, 0.3, 0.1, 12, dark, 0.62, 0.3, z, g); w.rotation.x = PI / 2; }
  const wheel = new THREE.Group(); wheel.position.set(0.62, 1.0, 0.53); g.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 6, 16), dark));
  for (const a of [0, PI / 3, (2 * PI) / 3]) M.rbox(0.54, 0.04, 0.03, 0.01, dark, 0, 0, 0, wheel).rotation.z = a;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.wheel = wheel;
  return g;
}

// ---------- binicilik pisti (expand-west.js xatlar3) ----------
// 2026-11-03 kullanıcı: "oranın içi boş, orada atlı biniciler eğitim yapsınlar": biniciler oval pistte tur atar. Çoğunlukla adım,
// ara sıra tırıs (hızlı adım), seyrek dörtnala; arada durup soluklanır. Öndekinden hızlı olan iç kulvardan geçer, yer yoksa yavaşlar.
// Ortada eğitmen en yakın biniciye döner
// [hız, olasılık, en az, en çok sn]. Adım ve tırıs yürüme klibiyle, dörtnala koşu klibiyle (hayvan.js SPEC.at)
const GAITS = [[0, 0.1, 3, 6], [1.2, 0.45, 8, 16], [2.0, 0.3, 6, 12], [3.8, 0.15, 5, 8]];
const LANE = 1.0; // iç kulvar dış kulvardan bu kadar içeride
// pistin çizgisi: köşeleri yuvarlak dikdörtgen (süperelips, üs 3; 2026-11-03 kullanıcı: "binicilik pistini büyüt, çok küçük olmuş").
// Elips dikdörtgenin %79'unu, bu %88'ini kaplar; çit (expand-west.js makeTrack) ve kulvarlar aynı çizgide. a, b: yarı genişlik, yarı boy
export function trackPt(t, a, b, out) {
  const c = Math.cos(t), s = Math.sin(t);
  out.x = a * Math.sign(c) * Math.abs(c) ** (2 / 3); out.z = b * Math.sign(s) * Math.abs(s) ** (2 / 3);
  return out;
}
const _p = { x: 0, z: 0 }, _p2 = { x: 0, z: 0 };
class Trainee {
  constructor(A, th) {
    this.A = A; this.th = th; this.lane = 0; this.laneT = 0; this.v = 0; this.want = 1.2; this.t = rand(4, 12);
    this.horse = makeHorse(pick(COATS)); this.man = M.makeCharacter(M.randomLook());
    mountLegs(this.man, true);
    G.scene.add(this.horse); G.scene.add(this.man);
    this.move(0);
  }
  axes() { return [this.A.a - this.lane * LANE, this.A.b - this.lane * LANE]; }
  gait() {
    let r = Math.random();
    for (const [v, p, t0, t1] of GAITS) if ((r -= p) <= 0) { this.want = v; this.t = rand(t0, t1); return; }
    this.want = 1.2; this.t = 10;
  }
  // pist çizgisi boyunca hızı kadar ilerler (açı adımı çizginin o noktadaki uzunluğuna bölünür), burnu tur yönünde
  move(dt) {
    const [a, b] = this.axes(), e = 0.01;
    trackPt(this.th, a, b, _p); trackPt(this.th + e, a, b, _p2);
    this.th = (this.th + (this.v * dt) / Math.max(0.5, Math.hypot(_p2.x - _p.x, _p2.z - _p.z) / e)) % (PI * 2);
    trackPt(this.th, a, b, _p); trackPt(this.th + e, a, b, _p2);
    this.horse.position.set(this.A.x + _p.x, 0, this.A.z + _p.z);
    this.horse.rotation.y = Math.atan2(_p2.x - _p.x, _p2.z - _p.z);
  }
}
// x, z: pistin ortası; a, b: dış kulvarın yarı çapları (x ve z); n: binici sayısı
export function trainingArena(x, z, a, b, n = 2) {
  const A = { x, z, a, b, list: [] }, r = (a + b) / 2 * 1.12; // süperelipsin çevresi aynı yarı çaplı elipsinkinden ~%12 uzun
  for (let i = 0; i < n; i++) A.list.push(new Trainee(A, (i / n) * PI * 2 + rand(-0.3, 0.3)));
  A.coach = M.makeCharacter(M.randomLook()); A.coach.position.set(x, 0, z); G.scene.add(A.coach);
  const ahead = (T, O) => ((O.th - T.th + PI * 4) % (PI * 2)) * r; // T'den O'ya tur yönünde pist uzunluğu
  A.update = (dt) => {
    const P = G.player && G.player.position;
    if (P && Math.hypot(P.x - x, P.z - z) > 90) return; // uzaktayken görünmez: hesaplanmaz
    for (const T of A.list) {
      if ((T.t -= dt) <= 0) T.gait();
      let lead = null, gap = 1e9;
      for (const O of A.list) if (O !== T && ahead(T, O) < gap) { gap = ahead(T, O); lead = O; }
      if (lead && gap < 6.0 && T.want > lead.v + 0.2 && lead.laneT === 0) T.laneT = 1; // erkenden iç kulvara geçip sollar
      else if (T.laneT === 1 && A.list.every((O) => O === T || Math.min(ahead(T, O), ahead(O, T)) > 3.0)) T.laneT = 0; // yanında kimse kalmayınca dışa döner
      let want = T.want;
      if (lead && gap < 3.0 && Math.abs(lead.lane - T.lane) < 0.8) want = Math.min(want, lead.v * 0.9); // kulvar değişmeden yetişti: yavaşlar
      T.v += Math.max(-1.6 * dt, Math.min(1.0 * dt, want - T.v));
      T.lane += Math.max(-dt, Math.min(dt, T.laneT - T.lane));
      T.move(dt);
      const hs = Math.min(1, T.v / 3.8);
      animateHorse(T.horse, hs, dt);
      sitOn(T.horse, T.man);
      rideLegs(T.man, T.horse, hs, dt);
    }
    // eğitmen en yakın biniciye döner
    let near = null, nd = 1e9;
    for (const T of A.list) { const d = T.horse.position.distanceTo(A.coach.position); if (d < nd) { nd = d; near = T; } }
    if (near) { const h = near.horse.position; A.coach.rotation.y = lerpAngle(A.coach.rotation.y, Math.atan2(h.x - x, h.z - z), Math.min(1, dt * 3)); }
    M.animateCharacter(A.coach, 0, dt, false);
  };
  return A;
}

// ---------- bölge ----------
// h: world.js'ten { rcol, hint, icon }; bölgenin kalıcı yapıları burada kurulur, açılınca bölmeler ve saman yığını gelir
export function stableRegion(R, h) {
  const C = R.content;
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; C.add(o); return o; };
  C.add(makeStable(STALL_X, STALL_W));
  for (const x of STALL_X) h.rcol(x - STALL_W / 2, x + STALL_W / 2, -3.6, 0.85); // bölmelerin içi: atın yeri
  for (let i = 0; i <= STALL_X.length; i++) { const x = STALL_X[0] - STALL_W / 2 + i * STALL_W; h.rcol(x - 0.14, x + 0.14, 0.86, 1.14); } // ön direkler
  // sonradan açılan iki bölmenin önü tahtayla kapalı
  R.boards = [];
  for (const x of STALL_X.slice(2)) {
    const b = new THREE.Group();
    for (const y of [0.5, 1.0, 1.5]) M.rbox(STALL_W - 0.3, 0.16, 0.08, 0.03, M.mat('#b07a45'), 0, y, 0, b);
    R.boards.push(put(b, x, 0, 0.95));
  }
  // çit: batı ve doğu kenar, kuzeyde köy yoluna açılan kapı (x -40..-36)
  put(M.makeFence(12, 'z'), -59, 0, 2.4); h.rcol(-59.15, -58.85, -3.6, 8.4);
  put(M.makeFence(7.4, 'x'), -55.3, 0, -3.45); h.rcol(-59, -51.5, -3.6, -3.3); // tarlanın kuzeyi (bölmelerin batısı)
  put(M.makeFence(7.5, 'z'), -35.75, 0, 4.65); h.rcol(-35.9, -35.6, 0.9, 8.4);
  put(M.makeFence(12, 'x'), -53, 0, 8.3); h.rcol(-59, -47, 8.15, 8.45);
  put(M.makeFence(7.4, 'x'), -39.3, 0, 8.3); h.rcol(-43, -35.6, 8.15, 8.45);
  put(M.makeSign('AT AHIRI', '#8a5a33', 3.2, 0.75), GATE_X, 0, 8.45);
  for (const x of [GATE_X - 1.45, GATE_X + 1.45]) h.rcol(x - 0.12, x + 0.12, 8.33, 8.57);
  // su yalağı ve saman yığını
  const wt = put(M.rbox(0.6, 0.5, 1.4, 0.08, M.mat('#8a8f96')), -52.3, 0.25, 2.6); wt.castShadow = true;
  put(M.rbox(0.5, 0.04, 1.28, 0.02, M.mat('#5fb4e0')), -52.3, 0.49, 2.6);
  h.rcol(-52.65, -51.95, 1.9, 3.3);
  for (const [x, y, z] of [[-51.9, 0, 4.7], [-51.9, 0, 5.7], [-51.9, 0.95, 5.2]]) put(M.makeHay(), x, y, z, PI / 2);
  h.rcol(-52.6, -51.2, 4.2, 6.2);
  put(M.rbox(1.4, 0.7, 0.8, 0.06, M.mat('#9c6a3f')), -50.2, 0.35, 5.2); h.rcol(-50.9, -49.5, 4.8, 5.6); // saman masası
  R.thresher = put(makeThresher(), -54.6, 0, 5.0); h.rcol(-56.1, -53.25, 4.5, 5.5); // harman makinesi, solunda besleme masası
  // bekleme bankı
  put(makeBench(3.6), BENCH.x, 0, BENCH.z, PI); h.rcol(BENCH.x - 1.8, BENCH.x + 1.8, BENCH.z - 0.05, BENCH.z + 0.35);
  R.seats = BENCH.seats.map((x) => ({ x, r: null }));
  R.stalls = []; R.riders = []; R.riderT = 6;

  R.activate = (instant) => {
    // ahırın buğday tarlası → harman makinesi → saman masası (saman artık boşluktan değil buğdaydan çıkar)
    R.field = new PlantBed(C, -56.3, 0.9, 'bugday', 4, { instant }); M.fieldMarks(C, -56.3, 0.9, 'bugday'); // tarım kuşağı: tabela ve direkler
    R.harman = new Converter(C, { inType: 'bugday', inCap: 6, ix: -55.4, iz: 6.15, iw: 1.6, id: 1.1, inTray: [-55.4, 0.74, 5.0], instant,
      out: { type: 'saman', interval: 2.4, max: 8, origin: V(-53.2, 1.0, 5.0), tray: [-50.2, 0.72, 5.2], zx: -50.2, zz: 6.3, zw: 2.4, zd: 1.2 } });
    R.gens = { saman: R.harman.out };
    h.hint(-56.3, 2.0, 0.9, `${h.icon('bugday')}`, 'Saman tarlası', 'Buğdayı topla, harman makinesinin soldaki masasına bırak.', 3.4);
    h.hint(-55.4, 2.3, 5.0, `${h.icon('bugday')}→${h.icon('saman')}`, 'Harman makinesi', 'Buğdayı masaya bırak: makine dövüp samanı yığının yanındaki masaya döker.', 3.2);
    R.pile = new MoneyPile(C, -40.6, 6.6, 0, { instant });
    R.addStalls(2, instant);
    h.hint(-50.2, 2.2, 6.0, `${h.icon('saman')}`, 'Saman yığını', 'Samanı al, bekleyen atın bölmesinin önüne götür: yemliğe kendiliğinden konur. ✨ isteyen atın önünde biraz dur, tımar edilir.', 3.4);
  };
  // n bölme daha açılır (ilk ikisi bölgeyle, son ikisi yeni bölmeler kilidiyle)
  R.addStalls = (n, instant) => {
    for (let i = 0; i < n && R.stalls.length < STALL_X.length; i++) {
      const k = R.stalls.length, x = STALL_X[k];
      if (k >= 2) { const b = R.boards[k - 2]; if (b) b.parent && b.parent.remove(b); }
      R.stalls.push(new Stall(R, x, instant));
    }
  };
  R.update = (dt) => {
    // harman çalışırken çark döner
    const S = R.gens && R.gens.saman;
    if (S && R.harman.input.length && S.items.length < S.max) R.thresher.userData.wheel.rotation.z -= dt * 7;
    for (const r of R.riders) r.update(dt);
    R.riders = R.riders.filter((r) => !r.dead);
    if (R.arena) R.arena.update(dt); // binicilik pisti (expand-west.js xatlar3)
    R.riderT -= dt;
    const free = R.stalls.find((s) => !s.rider);
    if (R.riderT <= 0 && free) { R.riders.push(new Rider(R, free)); R.riderT = rand(14, 26) / ((G.mods && G.mods.riderRate) || 1); } // binicilik pisti (genişletme) sıklaştırır
  };
  return R;
}
