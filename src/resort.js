// Kabuk Tatil Köyü: nehrin doğusunda, deniz kenarında kiralık kabuk evler (Airbnb gibi).
// Misafir pazar caddesinden gelir, resepsiyonda kaydını yaptırır (gecelik ücret), evine yerleşir. Kaldığı sürece
// istekte bulunur (havlu, dondurma, mısır, karpuz, kahvaltılık...): evin önüne götürülünce bahşiş bırakır.
// Ayrılırken puan verir ve ev dağınık kalır: oyuncu evi toplar (kirli çamaşır sırtına yüklenir), çamaşırhaneye
// bırakır, temiz havlu çıkar. Ortalama puan yükseldikçe gecelik ücret artar, misafir daha sık gelir.
// Evler Kabuk Ev "Eva" modelinden esinli: deniz tarağı gibi kaburgalı gergi membran kabuk, önde camlı cephe, ahşap güverte.
import * as THREE from 'three';
import * as M from './models.js';
import { G, Station, Shelf, Converter, MoneyPile, Customer, ITEMS, makeItem, fly, floatText, sfx, popIn, rand, pick, mult } from './game.js';
import { orderHtml } from './events.js';
import { confetti } from './fx.js';
import { texRep, textTex } from './tex.js';
import { day } from './daylight.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SW = 4.6, SH = 3.5, SL = 4.8, RIBS = 9, DECK = 0.1;
export const HOUSE_X = [71.5, 79, 86.5, 94, 101.5]; // harita genişletmesi: doğu blok +7
const HOUSE_Z = 21;
export const TERRACE_Z = HOUSE_Z + SL / 2 + 0.9; // kat görevlisi de buraya gelir (upgrades.js)
const GATE = V(71.5, 0, 9.8), FAR = V(155, 0, 8.8), ROAD = V(73, 0, 8.8); // FAR ormanın içindeki yolda (2026-11-04: eskiden 125'te, ekranın kenarında yok oluyorlardı) // misafir caddenin güney kaldırımından yürür
const DESK = [76.5, 11.0], LAUNDRY = [93, 10.8]; // ikisinin de arkası bölgenin kuzey kenarında kalır
// evin yanındaki patika (evlerin arası); en doğudaki ev batısındakini kullanır
const lane = (h) => (h.i === HOUSE_X.length - 1 ? h.x - 3.75 : h.x + 3.75);
// veranda sandalyeleri (evin yerel ekseninde): sx −1 batıdaki, +1 doğudaki; ikisi de şömineye döner
const CHAIR_Z = SL / 2 + 2.45, chairRy = (sx) => -sx * (PI / 2 - 0.35);
// şömine yalnız akşam yanar: 16:00'dan gün bitimine (yeni güne geçiş dahil). 2026-11-04 kullanıcı: "şömineleri yalnızca akşam saatlerinde yansın"
const EVE_H = 16, evening = () => day.fading || day.hour >= EVE_H;
const ASH = new THREE.Color('#3a2c26'), EMBER = new THREE.Color('#ff8c2e');

// ---------- modeller ----------
// kabuk yüzeyi: arka menteşeden öne açılan yelpaze; θ boyunca 9 kaburga (oluk), aralarda kabaran membran dilimleri
function shellPoint(th, v, lobe) {
  const s = Math.pow(Math.sin((v * PI) / 2), 0.55), r = 1 + 0.07 * lobe * v;
  return V(-Math.cos(th) * (SW / 2) * s * r, DECK + Math.sin(th) * SH * Math.pow(s, 0.9) * r, -SL / 2 + v * SL);
}
function shellGeo() {
  const nu = RIBS * 6, nv = 16, pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const th = (i / nu) * PI, p = shellPoint(th, j / nv, Math.abs(Math.sin(th * RIBS)));
    pos.push(p.x, p.y, p.z);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
let SHELL = null;
const shell = () => SHELL || (SHELL = shellGeo());
export function makeShellHouse(tint = '#f6f1e7') {
  const g = new THREE.Group();
  const steel = M.mat('#c9cfd6', { rough: 0.4 });
  const deckM = M.mat('#c98b52');
  // ahşap güverte: kabuğun altı ve önde teras; galvaniz vidalı ayaklar
  // güverte önde verandaya uzar (şömine ve iki sandalye için)
  M.rbox(SW + 1.0, DECK, SL + 3.6, 0.03, deckM, 0, DECK / 2, 1.4, g);
  for (const x of [-(SW / 2 + 0.4), SW / 2 + 0.4]) for (const z of [-SL / 2 + 0.2, 0.6, SL / 2 + 1.5, SL / 2 + 3.0]) M.cyl(0.05, 0.05, 0.14, 6, steel, x, 0.03, z, g);
  // kabuk membran ve kaburgalar
  const membrane = new THREE.Mesh(shell(), new THREE.MeshStandardMaterial({ color: tint, roughness: 0.75, side: THREE.DoubleSide }));
  membrane.castShadow = true; membrane.receiveShadow = true; g.add(membrane);
  for (let k = 1; k < RIBS; k++) {
    const th = (k / RIBS) * PI, pts = [];
    for (let v = 0.04; v <= 1.0001; v += 0.08) pts.push(shellPoint(th, v, 0).multiplyScalar(1.004));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.035, 5), steel));
  }
  // ön kemer (kabuğun ağzı); cephe ahşap duvarla kapalı, ortasında boydan camlı kapı
  const rim = [], shape = new THREE.Shape();
  for (let i = 0; i <= 72; i++) { const th = (i / 72) * PI, p = shellPoint(th, 1, Math.abs(Math.sin(th * RIBS))); rim.push(p); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim), 72, 0.06, 6), steel));
  shape.moveTo(rim[0].x, rim[0].y - DECK);
  for (const p of rim) shape.lineTo(p.x, p.y - DECK);
  const GW = 0.75, GH = 2.55; // camın yarı genişliği ve yüksekliği
  const hole = new THREE.Path(); hole.moveTo(-GW, 0); hole.lineTo(GW, 0); hole.lineTo(GW, GH); hole.lineTo(-GW, GH); hole.lineTo(-GW, 0);
  shape.holes.push(hole);
  const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#c08a55', map: texRep('wood', 0.55, 0.55), roughness: 0.85, side: THREE.DoubleSide }));
  wall.position.set(0, DECK, SL / 2 - 0.03); wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2, GH), new THREE.MeshStandardMaterial({ color: '#bfe6f5', roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.set(0, DECK + GH / 2, SL / 2 - 0.02); glass.renderOrder = 2; g.add(glass);
  // camın koyu ahşap çerçevesi, ortada kapı kayıtı
  const frame = M.mat('#6b4428');
  for (const x of [-GW, GW, 0]) M.rbox(x ? 0.1 : 0.05, GH, 0.08, 0.02, frame, x, DECK + GH / 2, SL / 2 + 0.01, g);
  M.rbox(GW * 2 + 0.1, 0.1, 0.08, 0.02, frame, 0, DECK + GH, SL / 2 + 0.01, g);
  M.rbox(0.05, 0.22, 0.05, 0.01, M.mat('#d9b25a'), 0.14, DECK + 1.15, SL / 2 + 0.07, g); // kapı kolu
  // duvarda dikey tahta derzleri
  for (const x of [-1.9, -1.45, -1.0, 1.0, 1.45, 1.9]) {
    const th = Math.acos(Math.max(-1, Math.min(1, -x / (SW / 2)))), h = Math.sin(th) * SH * 0.97;
    M.rbox(0.03, h, 0.02, 0.01, frame, x, DECK + h / 2, SL / 2 - 0.0, g);
  }
  // yanlarda yuvarlak pencereler: her yanda biri önde, biri arkada (kaburganın tam ortasında, kabuğa oturur)
  for (const th of [(1.5 * PI) / RIBS, PI - (1.5 * PI) / RIBS]) for (const v of [0.3, 0.72]) {
    const p = shellPoint(th, v, 1), e = 0.01;
    const n = new THREE.Vector3().crossVectors(shellPoint(th + e, v, 1).sub(shellPoint(th - e, v, 1)), shellPoint(th, v + e, 1).sub(shellPoint(th, v - e, 1))).normalize();
    if (n.x * p.x + n.y * (p.y - DECK) < 0) n.negate(); // dışa baksın
    const w = new THREE.Group(); w.position.copy(p).addScaledVector(n, 0.04); g.add(w); w.lookAt(w.position.clone().add(n));
    w.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20), M.mat('#6b4428')));
    const pane = new THREE.Mesh(new THREE.CircleGeometry(0.29, 20), new THREE.MeshStandardMaterial({ color: '#bfe6f5', emissive: '#ffcf7a', emissiveIntensity: 0.12, roughness: 0.1 }));
    pane.position.z = -0.01; w.add(pane);
  }
  // içerisi: yatak, halı ve sıcak ışık (camdan görünür); dolu evde ışık yanar
  M.rbox(1.8, 0.4, 1.4, 0.08, M.mat('#ffffff'), 0, DECK + 0.2, -0.7, g);
  M.rbox(1.8, 0.12, 0.4, 0.05, M.mat('#8ec5e8'), 0, DECK + 0.46, -1.25, g);
  M.rbox(2.2, 0.02, 1.6, 0.01, M.mat('#e8604c'), 0, DECK + 0.01, 0.9, g);
  const lampM = new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffb347', emissiveIntensity: 0.15 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lampM); lamp.position.set(0.9, DECK + 2.2, -0.4); g.add(lamp);
  // terasta iki şezlong ve saksı
  // cephenin tepesinden öne uzanan direk; ucundan zincirle asılı şömine (alevi titrer)
  const black = M.mat('#24262b', { rough: 0.5 });
  const top = shellPoint(PI / 2, 1, 1).y;
  const pole = M.cyl(0.055, 0.055, 2.75, 8, black, 0, top - 0.05, SL / 2 + 1.3, g); pole.rotation.x = PI / 2;
  M.sph(0.09, black, 0, top - 0.05, SL / 2 + 2.67, g, 8, 6);
  M.cyl(0.07, 0.07, top - 1.95, 8, black, 0, (top + 1.9) / 2, SL / 2 + 2.6, g); // baca borusu (askı)
  const fire = new THREE.Group(); fire.position.set(0, 1.55, SL / 2 + 2.6); g.add(fire);
  const bowl = M.sph(0.42, black, 0, 0, 0, fire, 18, 14); bowl.scale.set(1, 0.85, 1);
  M.cyl(0.13, 0.09, 0.22, 10, black, 0, 0.42, 0, fire);
  // ateş ağzı: içi kor gibi parlar, yukarıdan bakan kameraya hafif dönük
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.27, 20), new THREE.MeshBasicMaterial({ color: '#ff8c2e' })); mouth.position.set(0, 0.0, 0.37); mouth.rotation.x = -0.45; fire.add(mouth);
  const rimM = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 6, 20), black); rimM.position.copy(mouth.position); rimM.rotation.x = -0.45; fire.add(rimM);
  // şömine yanıyor: ağızdan taşan alev dilleri, kor ve çevresine yayılan turuncu ışıltı
  const flameM = new THREE.MeshBasicMaterial({ color: '#ff9a2a' }), coreM = new THREE.MeshBasicMaterial({ color: '#fff1a8' });
  const flames = [];
  for (const [x, h, r, m] of [[0, 0.5, 0.15, flameM], [-0.11, 0.34, 0.1, flameM], [0.11, 0.38, 0.1, flameM], [0, 0.3, 0.08, coreM]]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), m); f.position.set(x, -0.08 + h / 2, 0.32); f.rotation.x = 0.35; fire.add(f); flames.push({ f, h, x });
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb050', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.set(0, 0.05, 0.5); glow.scale.setScalar(1.7); fire.add(glow);
  let lit = 1;
  flames[0].f.onBeforeRender = () => {
    const t = performance.now() * 0.001;
    flames.forEach((q, i) => { const k = (1 + Math.sin(t * (11 + i * 3) + i) * 0.16 + Math.sin(t * 7.3 + i * 2) * 0.08) * lit; q.f.scale.set(lit, k, lit); q.f.position.y = -0.08 + (q.h * k) / 2; });
    glow.material.opacity = (0.75 + Math.sin(t * 9) * 0.12 + Math.sin(t * 5.1) * 0.08) * lit;
    glow.scale.setScalar((1.6 + Math.sin(t * 6.3) * 0.12) * (0.4 + 0.6 * lit));
  };
  // yakma ve söndürme (R.update akşamı izler): sönükken alev ve ışıltı gizli, ağız soğuk kül rengi
  for (const o of [mouth, ...flames.map((q) => q.f)]) o.userData.bkNo = true; // perf.js birleştirmesin: görünürlüğü ve rengi değişiyor
  const setFire = (k) => {
    lit = k;
    for (const q of flames) q.f.visible = k > 0.02;
    glow.visible = k > 0.02;
    mouth.material.color.copy(ASH).lerp(EMBER, Math.min(1, k * 1.5));
  };
  setFire(evening() ? 1 : 0);
  // verandada şömineye dönük iki sandalye
  for (const sx of [-1, 1]) { const ch = makeChair(); ch.position.set(sx * 1.25, DECK, CHAIR_Z); ch.rotation.y = chairRy(sx); g.add(ch); }
  const pot = new THREE.Group(); M.cyl(0.22, 0.17, 0.36, 10, M.mat('#c8643b'), 0, 0.18, 0, pot); M.sph(0.3, M.mat('#5dbb63', { flat: true }), 0, 0.55, 0, pot, 8, 6);
  pot.position.set(SW / 2 + 0.15, DECK, SL / 2 + 0.2); g.add(pot);
  // dağınıklık: misafir ayrılınca terasta kirli çamaşır yığını
  const mess = new THREE.Group();
  for (const [x, z, r] of [[-0.5, 0.1, 0.3], [0.1, -0.15, 0.24], [0.45, 0.2, 0.2]]) M.sph(r, M.mat('#9aa7b8', { flat: true }), x, r * 0.7, z, mess, 7, 5);
  mess.position.set(0.9, DECK, SL / 2 + 0.75); mess.visible = false; g.add(mess);
  g.userData = { lamp: lampM, mess, fire: setFire };
  g.traverse((o) => { if (o.isMesh && o !== glass) o.castShadow = true; });
  return g;
}

// şömine ışıltısı: ortası sıcak beyaz, kenara doğru sönen yuvarlak doku (bir kez üretilir)
let GLOW = null;
function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.35, 'rgba(255,160,60,.55)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return (GLOW = new THREE.CanvasTexture(c));
}
// veranda sandalyesi: evin kemerine benzeyen siyah kaburgalı iskelet (deniz tarağı sırtlık), turuncu minderler
function makeChair() {
  const g = new THREE.Group(), black = M.mat('#24262b', { rough: 0.45 }), cush = M.mat('#ff8a3d'), cush2 = M.mat('#ffb06a');
  for (const x of [-0.27, 0.27]) for (const z of [-0.24, 0.24]) M.cyl(0.022, 0.022, 0.34, 6, black, x, 0.17, z, g);
  M.rbox(0.66, 0.04, 0.58, 0.02, black, 0, 0.35, 0, g);
  M.rbox(0.62, 0.13, 0.56, 0.06, cush, 0, 0.43, 0.02, g); // oturak minderi
  // sırtlık: menteşeden yelpaze gibi açılan kaburgalar ve dış kemer, arkaya yatık
  const back = new THREE.Group(); back.position.set(0, 0.42, -0.27); back.rotation.x = -0.32; g.add(back);
  const arc = [];
  for (let i = 0; i <= 6; i++) {
    const a = -PI / 2 + (i / 6) * PI, end = V(Math.sin(a) * 0.36, Math.cos(a) * 0.58 + 0.02, 0);
    if (end.y < 0.02) end.y = 0.02;
    arc.push(end);
    back.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V(0, 0.02, 0), end), 1, 0.016, 5), black));
  }
  back.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 24, 0.024, 6), black));
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.33, 20, 0, PI), cush); pad.scale.set(1, 1.55, 1); pad.rotation.z = 0; pad.position.set(0, 0.03, 0.03);
  pad.material = new THREE.MeshStandardMaterial({ color: '#ff8a3d', roughness: 0.8, side: THREE.DoubleSide }); back.add(pad); // sırt minderi
  M.sph(0.11, cush2, 0.16, 0.56, -0.1, g, 10, 8).scale.set(1, 0.7, 0.55); // küçük yastık
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ofis deposu: resepsiyonun yanında iki katlı ahşap raf, üstünde tabela
const DEPOT = [82.4, 10.35];
const DEPOT_SLOTS = [];
for (const y of [0.17, 0.67]) for (const z of [0.16, -0.18]) for (const x of [-1.05, -0.35, 0.35, 1.05]) DEPOT_SLOTS.push(V(x, y, z));
function makeDepot() {
  const g = new THREE.Group(), wood = M.mat('#c98b52'), dark = M.mat('#6b4428');
  for (const x of [-1.5, 1.5]) M.rbox(0.1, 1.9, 0.8, 0.03, dark, x, 0.95, 0, g);
  for (const y of [0.12, 0.62, 1.22]) M.rbox(3.0, 0.07, 0.8, 0.02, wood, 0, y, 0, g);
  M.rbox(3.1, 1.9, 0.06, 0.02, dark, 0, 0.95, -0.4, g);
  const board = M.rbox(2.4, 0.42, 0.06, 0.03, M.mat('#ffffff', { map: textTex('📦 OFİS DEPOSU', { bg: '#3ec1b5', fg: '#ffffff', w: 512, h: 90 }) }), 0, 2.15, -0.36, g);
  board.castShadow = true;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// depo: misafirlerin istediği ürünler burada birikir. Taşıyıcı getirir; kat görevlisi ya da oyuncu evlere dağıtır.
// Oyuncu elinde istek ürünüyle gelirse rafa dizer; eli boş gelirse evlerin beklediği ürünleri sırtına alır.
class Depot extends Shelf {
  constructor(R, group, o) {
    super({ zx: DEPOT[0], zz: DEPOT[1] + 1.15, zw: 3.0, zd: 1.2, accepts: () => R.wantTypes(), cap: DEPOT_SLOTS.length, group, slots: DEPOT_SLOTS, spots: [], instant: o.instant });
    this.R = R; this.mode = null;
  }
  free() { return this.slots.filter((s) => !s).length; }
  // yalnızca belli bir ürünü rafa koyar (taşıyıcı)
  putType(stack, type) { const a = this.accepts; this.accepts = [type]; const r = this.putFrom(stack); this.accepts = a; return r; }
  setInside(v) { super.setInside(v); if (!v) this.mode = null; }
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t < 0.12) return;
    this.t = 0;
    const st = G.stack;
    // geldiği anda karar: elinde depoya konacak ürün varsa dizer, yoksa evlerin beklediğini alır (aynı ziyarette ikisi birden olmaz)
    if (!this.mode) this.mode = st.items.some((i) => this.acc().includes(i.type)) ? 'put' : 'take';
    if (this.mode === 'put') { this.putFrom(st); return; }
    if (st.full) return;
    const need = this.R.needs();
    for (const t in need) {
      if (need[t] - st.count(t) <= 0) continue;
      const o = this.takeType(t);
      if (o) { st.push(t, o, 0.3); sfx('pop'); return; }
    }
  }
}

function makeReception() {
  const g = new THREE.Group(), wood = M.mat('#c98b52'), white = M.mat('#f6f1e7');
  M.rbox(4.2, 0.12, 2.6, 0.03, M.mat('#a8703f'), 0, 0.06, 0, g);
  M.rbox(3.0, 1.05, 0.7, 0.08, wood, 0, 0.6, 0.55, g); // tezgah
  M.rbox(3.2, 0.08, 0.86, 0.03, M.mat('#f7e2c4'), 0, 1.15, 0.55, g);
  // gölgelik: evlerle aynı kaburgalı kabuk, küçültülmüş; ağzı tezgahın üstünde
  const sh = new THREE.Mesh(shell(), new THREE.MeshStandardMaterial({ color: '#f6f1e7', roughness: 0.75, side: THREE.DoubleSide }));
  sh.scale.set(0.82, 0.9, 0.55); sh.position.z = -0.35; sh.castShadow = true; g.add(sh);
  M.rbox(1.2, 1.6, 0.1, 0.03, white, 0, 1.9, -1.05, g); // anahtar panosu
  for (let i = 0; i < 5; i++) M.cyl(0.04, 0.04, 0.12, 6, M.mat('#f6b12a'), -0.4 + i * 0.2, 2.1, -0.98, g);
  M.cyl(0.11, 0.13, 0.08, 12, M.mat('#f6b12a', { rough: 0.3 }), 0.9, 1.24, 0.6, g); // zil
  return g;
}

function makeLaundry() {
  const g = new THREE.Group(), white = M.mat('#ffffff');
  M.rbox(5.6, 0.1, 2.2, 0.03, M.mat('#d8d0c0'), 0, 0.05, -0.2, g);
  for (const x of [-0.45, 0.45]) {
    M.rbox(0.8, 0.85, 0.75, 0.06, white, x, 0.48, -0.1, g);
    const door = M.cyl(0.24, 0.24, 0.04, 16, M.mat('#5fa8d3', { rough: 0.15 }), x, 0.5, 0.27, g); door.rotation.x = PI / 2;
    M.cyl(0.27, 0.27, 0.02, 16, M.mat('#c9cfd6'), x, 0.5, 0.26, g).rotation.x = PI / 2;
  }
  // girdi (sol) ve çıktı (sağ) masaları
  for (const x of [-1.8, 1.8]) { M.rbox(1.6, 0.8, 1.0, 0.06, M.mat('#c98b52'), x, 0.4, 0.3, g); M.rbox(1.7, 0.06, 1.1, 0.02, M.mat('#f7e2c4'), x, 0.83, 0.3, g); }
  // arkada ip üstünde kuruyan havlular
  for (const x of [-2.5, 2.5]) M.rbox(0.07, 1.9, 0.07, 0.02, M.mat('#8a5a33'), x, 0.95, -1.15, g);
  M.rbox(5.0, 0.02, 0.02, 0.005, M.mat('#eeeeee'), 0, 1.85, -1.15, g);
  ['#5fb6e0', '#ffffff', '#f6b12a', '#e8604c', '#ffffff', '#5fb6e0'].forEach((c, i) => M.rbox(0.5, 0.65, 0.02, 0.01, M.mat(c), -1.9 + i * 0.75, 1.5, -1.15, g));
  return g;
}

// ---------- istasyonlar ----------
// resepsiyon: misafir sırada bekler, oyuncu tezgaha gelince kaydını yapar
class Desk extends Station {
  // kabuğun içi kapalı: kayıt tezgahın önünden (sıranın doğu yanı) ya da kabuğa değince yapılır (Station.near)
  constructor(R, o) { super(DESK[0] + 1.3, DESK[1] + 1.6, 1.4, 1.0, o); this.R = R; this.queue = []; }
  slot(i) { return V(DESK[0] - i * 1.15, 0, DESK[1] + 1.8); }
  update(dt) {
    if (!this.inside || !this.queue.length) return;
    const c = this.queue[0];
    if (c.state !== 'desk') return;
    this.t += dt;
    if (this.t >= 0.5) { this.t = 0; this.R.checkIn(c); }
  }
}
// evin terası: istek teslimi ve misafir çıkınca toparlama
class Terrace extends Station {
  constructor(h, o) { super(h.x, TERRACE_Z, 3.4, 1.4, o); this.h = h; }
  update(dt) {
    const h = this.h;
    if (!this.inside) { if (h.state === 'kirli' && h.clean > 0 && !h.cleaner) { h.clean = Math.max(0, h.clean - dt * 0.5); h.R.drawLabel(h); } return; }
    if (h.state === 'kirli') {
      h.clean += dt / 2.2;
      h.R.drawLabel(h);
      if (h.clean >= 1) h.R.tidy(h);
      return;
    }
    this.t += dt;
    if (this.t >= 0.12 && h.order && this.deliver(G.stack)) this.t = 0;
  }
  deliver(stack) {
    const h = this.h, need = Object.keys(h.order).filter((k) => h.order[k].got < h.order[k].need);
    const it = stack.takeOf(need);
    if (!it) return false;
    h.order[it.type].got++;
    fly(it.obj, h.obj, V(0, 1.2, SL / 2 - 0.3), 0.3, 1.2, (o) => o.parent && o.parent.remove(o));
    sfx('put', { npc: stack !== G.stack });
    if (Object.values(h.order).every((o) => o.got >= o.need)) h.R.orderDone(h, true);
    else h.R.drawLabel(h);
    return true;
  }
}

// ---------- bölge ----------
export function setupResort(R, T) {
  const C = R.content;
  const { put, strip, rcol, hint } = T;
  // zemin: kuzeyden pazar caddesine açılan giriş, ortadan geçen tahta yürüyüş yolu
  strip(C, 86, 14, 38, 2.4, 'wood', 2.2);
  strip(C, 112.8, 14, 15.6, 2.4, 'wood', 2.2); // doğuya uzanan kolu: beach club'ın (club.js, expand-east.js xtatil4) girişine; hamam hana taşındı
  strip(C, GATE.x, 11.1, 3.0, 3.4, 'path', 3, 0.011);
  for (const x of HOUSE_X.slice(0, -1)) strip(C, x + 3.75, 19.9, 1.4, 9.4, 'path', 3, 0.011); // evlerin arasından sahile inen patikalar
  put(C, M.makeSign('KABUK TATİL KÖYÜ', '#3ec1b5', 3.6, 0.8), GATE.x, 0, 9.9, 0);
  for (const px of [GATE.x - 1.65, GATE.x + 1.65]) rcol(R, px - 0.1, px + 0.1, 9.8, 10.0);
  // resepsiyon ve çamaşırhane yolun kuzeyinde
  put(C, makeReception(), DESK[0], 0, DESK[1]);
  rcol(R, DESK[0] - 1.9, DESK[0] + 1.9, DESK[1] - 1.7, DESK[1] + 0.95);
  rcol(R, DEPOT[0] - 1.6, DEPOT[0] + 1.6, DEPOT[1] - 0.45, DEPOT[1] + 0.45); // ofis deposu rafı
  put(C, makeLaundry(), LAUNDRY[0], 0, LAUNDRY[1]);
  rcol(R, LAUNDRY[0] - 0.9, LAUNDRY[0] + 0.9, LAUNDRY[1] - 0.5, LAUNDRY[1] + 0.3);
  rcol(R, LAUNDRY[0] - 2.6, LAUNDRY[0] - 1.0, LAUNDRY[1] - 0.2, LAUNDRY[1] + 0.8); rcol(R, LAUNDRY[0] + 1.0, LAUNDRY[0] + 2.6, LAUNDRY[1] - 0.2, LAUNDRY[1] + 0.8);
  rcol(R, LAUNDRY[0] - 2.6, LAUNDRY[0] + 2.6, LAUNDRY[1] - 1.25, LAUNDRY[1] - 1.05);
  // sahil tarafı: palmiyeler, şemsiyeler, fenerler
  for (const x of [68.2, 105 - 1.4]) { put(C, M.makePalm(1, 0.2), x, 0, 27.5); rcol(R, x - 0.35, x + 0.35, 27.15, 27.85); }
  // ortak havuz: 2. ve 3. evin önünde, kumsalda; beyaz taş kenar, mavi su, merdiven, simitler, iki şezlong
  {
    const PX = 82.75, PZ = 29.2, PW = 9.6, PD = 2.2, pool = new THREE.Group(), stone = M.mat('#f2efe8');
    for (const z of [-1, 1]) M.rbox(PW + 0.7, 0.36, 0.35, 0.05, stone, 0, 0.18, z * (PD / 2 + 0.175), pool);
    for (const x of [-1, 1]) M.rbox(0.35, 0.36, PD, 0.05, stone, x * (PW / 2 + 0.175), 0.18, 0, pool);
    M.rbox(PW, 0.22, PD, 0.02, M.mat('#2f9fd0'), 0, 0.1, 0, pool); // havuzun mavi döşemesi
    const wm = new THREE.MeshStandardMaterial({ color: '#7fd8f2', map: texRep('water', 3, 0.7), roughness: 0.12, transparent: true, opacity: 0.88 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(PW, PD), wm); water.rotation.x = -PI / 2; water.position.y = 0.3; pool.add(water);
    water.onBeforeRender = () => { const t = performance.now() * 0.001; wm.map.offset.set(t * 0.03, Math.sin(t * 0.6) * 0.04); };
    const steel = M.mat('#c9cfd6', { rough: 0.3 });
    for (const dx of [-0.25, 0.25]) { // merdiven tutamakları
      const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(PW / 2 - 0.8 + dx, 0.15, -PD / 2 + 0.2), V(PW / 2 - 0.8 + dx, 0.85, -PD / 2 - 0.05), V(PW / 2 - 0.8 + dx, 0.75, -PD / 2 - 0.35), V(PW / 2 - 0.8 + dx, 0.36, -PD / 2 - 0.45)]), 12, 0.03, 6), steel);
      pool.add(rail);
    }
    for (const [x, z, c] of [[-2.6, 0.2, '#e8473c'], [2.4, -0.3, '#ffd23f']]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 8, 16), M.mat(c)); r.rotation.x = PI / 2; r.position.set(x, 0.33, z); pool.add(r); }
    M.sph(0.17, M.mat('#ffffff'), 0.6, 0.38, 0.4, pool, 12, 10);
    pool.traverse((o) => { if (o.isMesh && o !== water) { o.castShadow = true; o.receiveShadow = true; } });
    put(C, pool, PX, 0, PZ);
    rcol(R, PX - PW / 2 - 0.35, PX + PW / 2 + 0.35, PZ - PD / 2 - 0.35, PZ + PD / 2 + 0.35);
    // havuz başındaki iki şezlong: misafirler evinden çıkıp burada güneşlenir (yerleri R.poolSeats)
    R.poolSeats = [];
    for (const sx of [-1, 1]) {
      const lx = PX + sx * (PW / 2 + 1.5), ry = -sx * PI / 2, l = M.makeLounger('#ff8a3d');
      l.scale.setScalar(0.85); put(C, l, lx, 0, PZ, ry); rcol(R, lx - 0.95, lx + 0.95, PZ - 0.42, PZ + 0.42);
      R.poolSeats.push({ x: lx, z: PZ, ry, c: null, stand: V(lx, 0, PZ - 1.0) });
    }
  }
  HOUSE_X.forEach((x, i) => {
    if (i % 2 === 0 && i !== 2) put(C, M.makeUmbrella(['#ff6f61', '#f9c74f', '#4fc3e8'][i % 3]), x - 1.6, 0, 28.6);
  });
  // lambalar evlerin arasından sahile inen patikaların ağzındaydı: patikanın doğu kenarına alındı; ikinci patikanın ağzındaki çiçek kaldırıldı
  // (2026-11-01 kullanıcı: "yolda duranları kaldır"). dress.js ışık zinciri bu lambalara bağlı
  for (const x of [76.45, 91.45, 98.95]) put(C, M.makeLamp(), x, 0, 16.2);
  for (const [x, z] of [[68.5, 11], [99, 11.4], [103.5, 16.6]]) put(C, M.makeFlowers(), x, 0, z);

  R.houses = [];
  R.ratings = [];
  R.waiting = 0;
  R.addHouse = (i, instant) => {
    if (R.houses.some((h) => h.i === i)) return;
    const x = HOUSE_X[i];
    const obj = put(C, makeShellHouse(['#f6f1e7', '#f3ece0', '#eef3f6', '#f7efe6', '#f1f4ee'][i]), x, 0, HOUSE_Z);
    if (!instant) popIn(obj);
    rcol(R, x - SW / 2 - 0.05, x + SW / 2 + 0.05, HOUSE_Z - SL / 2 - 0.05, HOUSE_Z + SL / 2);
    for (const sx of [-1.25, 1.25]) rcol(R, x + sx - 0.32, x + sx + 0.32, HOUSE_Z + SL / 2 + 2.13, HOUSE_Z + SL / 2 + 2.77); // veranda sandalyeleri
    rcol(R, x - 0.45, x + 0.45, HOUSE_Z + SL / 2 + 2.15, HOUSE_Z + SL / 2 + 3.05); // asma şöminenin altı
    const h = { i, x, obj, R, state: 'temiz', guest: null, order: null, clean: 0, reqT: 0, stay: 0 };
    h.drop = new Terrace(h, { instant });
    const el = document.createElement('div');
    el.className = 'order';
    h.el = el;
    h.label = G.labels.add(el, (v) => v.set(x, SH + 1.0, HOUSE_Z + 0.6));
    h.label.hidden = true;
    R.houses.push(h);
    R.houses.sort((a, b) => a.i - b.i);
  };

  R.activate = (instant) => {
    // para resepsiyon bankosunun üstünde birikir, yanında yazarkasa; resepsiyonist toplar (ayrı kasiyer yok)
    R.pile = new MoneyPile(C, DESK[0] - 0.85, DESK[1] + 0.55, 1.15, { instant, desk: false, register: [0.62, 0.04, -0.05], face: [DESK[0], DESK[1] - 0.2], body: [DESK[0] - 1.9, DESK[0] + 1.9, DESK[1] - 1.7, DESK[1] + 0.95] });
    R.desk = new Desk(R, { instant });
    R.laundry = new Converter(C, { inType: 'kirli', inCap: 8, ix: LAUNDRY[0] - 1.8, iz: LAUNDRY[1] + 1.55, iw: 2.2, id: 1.3, inTray: [LAUNDRY[0] - 1.8, 0.86, LAUNDRY[1] + 0.3], instant,
      out: { type: 'havlu', interval: 3.0, max: 8, origin: V(LAUNDRY[0], 1.0, LAUNDRY[1]), tray: [LAUNDRY[0] + 1.8, 0.86, LAUNDRY[1] + 0.3], zx: LAUNDRY[0] + 1.8, zz: LAUNDRY[1] + 1.55, zw: 2.2, zd: 1.3 } });
    R.gens = { havlu: R.laundry.out };
    // ofis deposu: istenen ürünler burada birikir
    const dg = put(C, makeDepot(), DEPOT[0], 0, DEPOT[1]); if (!instant) popIn(dg);
    R.depot = new Depot(R, dg, { instant });
    hint(DEPOT[0], 2.9, DEPOT[1], '📦', 'Ofis deposu', 'Misafirlerin istediği ürünler burada birikir. Taşıyıcılar getirir, kat görevlisi evlere dağıtır. Eli boş gelirsen bekleyen istekleri sırtına alırsın.', 3.6);
    R.addHouse(0, instant); R.addHouse(1, instant);
    // tahta yolun doğu kolu beach club'ın arsasına kadar yürünür (altıncı kabuk ev emekli: arada başka yol yok)
    if (G.walkways && !G.walkways.resort) { G.walkways.push([104.4, 120.8, 12.8, 15.2]); G.walkways.resort = true; }
    R.rateEl = document.createElement('div');
    R.rateEl.className = 'hint near';
    R.rateEl.innerHTML = '<span class="hi">🐚</span><span class="hx"><b>Kabuk Tatil Köyü</b><small></small></span>';
    G.labels.add(R.rateEl, (v) => v.set(DESK[0], 4.2, DESK[1] - 0.4));
    R.drawRating();
    hint(LAUNDRY[0], 2.6, LAUNDRY[1] + 0.3, `${T.icon('kirli')}→${T.icon('havlu')}`, 'Çamaşırhane', 'Boşalan evden topladığın kirli çamaşırı soldaki masaya bırak. Temiz havlu sağdaki tepsiye çıkar.', 3.6);
    R.spawnT = instant ? 6 : 3;
  };

  R.avg = () => (R.ratings.length ? R.ratings.reduce((a, b) => a + b, 0) / R.ratings.length : 4.5);
  R.drawRating = () => {
    if (!R.rateEl) return;
    const n = R.ratings.length;
    R.rateEl.querySelector('small').textContent = n ? `⭐ ${R.avg().toFixed(1)} · ${n} konaklama · gecelik ${R.fee()} ₺` : `Gecelik ${R.fee()} ₺ · misafir bekleniyor`;
  };
  R.fee = () => Math.round(60 * (0.55 + 0.14 * R.avg()));
  // istekler: o an üretilebilen ürünlerden
  // misafir her şeyi isteyebilir: köyün, pazarın, sahilin, hanın, meranın açık olan bütün ürünleri
  const WANT_BY = [['domates', null], ['salatalik', 'k1'], ['yumurta', 'kk'], ['sut', 'ka'], ['peynir', 'km'], ['karpuz', 'gp'], ['biber', 'pt3'], ['patlican', 'pt4'],
    ['misir', 'gs'], ['dondurma', 's1'], ['ekmek', ['gh', 'gf']], ['corba', 'h1'], ['ksut', 'm1'], ['yogurt', 'm3'], ['kilim', 'm2'], ['simit', 'gf'], ['pogaca', 'gf']];
  R.wants = () => {
    const u = G.unlocked, w = ['havlu', 'havlu'];
    for (const [t, id] of WANT_BY) if (!id || [].concat(id).some((k) => u.has(k))) w.push(t);
    return w;
  };
  R.wantTypes = () => [...new Set(R.wants())].filter((t) => t !== 'havlu'); // depoya konabilenler (havlu çamaşırhaneden)
  // evlerin hâlâ beklediği ürünler (kat görevlilerinin elindekiler düşülür)
  R.needs = () => {
    const n = {};
    for (const h of R.houses) if (h.order) for (const k in h.order) n[k] = (n[k] || 0) + h.order[k].need - h.order[k].got;
    for (const w of G.staff.maid || []) for (const k in n) n[k] -= w.stack.count(k);
    return n;
  };

  R.checkIn = (c) => {
    const h = R.houses.find((x) => x.state === 'temiz' && !x.reserved);
    if (!h) return;
    R.desk.queue.shift();
    const fee = Math.round(R.fee() * mult());
    R.pile.add(fee, c.obj.position);
    floatText(c.obj.position, `🔑 +${fee} ₺`, 'pos'); sfx('cash', { at: c.obj.position });
    G.stats.customers++;
    h.reserved = true; h.guest = c; c.house = h;
    c.clearBubble();
    c.path = [V(lane(h), 0, 15.6), V(lane(h), 0, TERRACE_Z + 0.4), V(h.x, 0, TERRACE_Z - 0.5)];
    c.state = 'toHouse';
    R.desk.queue.forEach((q, i) => { q.path = [R.desk.slot(i)]; });
  };
  R.request = (h) => {
    const types = R.wants().sort(() => Math.random() - 0.5);
    const pickT = [...new Set(types)].slice(0, Math.random() < 0.35 ? 2 : 1);
    h.order = {};
    let total = 0;
    for (const t of pickT) { const need = t === 'havlu' ? 1 + Math.floor(Math.random() * 2) : 1; h.order[t] = { need, got: 0 }; total += need; }
    h.timer = h.total = 45 + total * 12;
    h.label.hidden = false;
    R.drawLabel(h);
    sfx('bong', { at: h.obj.position });
  };
  R.orderDone = (h, ok) => {
    let tip = 0;
    for (const k in h.order) tip += ITEMS[k].price * h.order[k].got;
    tip = Math.round(tip * (ok ? 1.8 : 1) * mult());
    const at = V(h.x, 1.6, TERRACE_Z);
    if (tip > 0) { R.pile.add(tip, at); floatText(at, ok ? `💛 Bahşiş +${tip} ₺` : `+${tip} ₺`, 'pos'); }
    if (ok) { confetti(at, 18); sfx('happy', { at }); } else { h.score -= 1.4; floatText(at, '😕 İstek yetişmedi', 'neg'); sfx('bad', { at }); }
    for (const k in h.order) G.stats.sold += h.order[k].got;
    if (!ok && G.hooks.fineOrder) G.hooks.fineOrder(h.order, at); // yetişmeyen istek tazminatı (account.js)
    h.order = null; h.label.hidden = true;
    h.reqT = rand(16, 28);
  };
  // toplanan çamaşır toplayanın sırtına yüklenir (oyuncu ya da kat görevlisi); yer yoksa ev yine temizlenir
  R.tidy = (h, stack = G.stack) => {
    for (let k = 0; k < 2 && !stack.full; k++) { const it = makeItem('kirli'); it.position.set(h.x, 0.6, TERRACE_Z - 0.6); G.scene.add(it); stack.push('kirli', it, 0.3); }
    h.state = 'temiz'; h.clean = 0; h.cleaner = null; h.label.hidden = true;
    h.obj.userData.mess.visible = false;
    floatText(V(h.x, 1.6, TERRACE_Z), '✨ Ev hazır', 'pos'); sfx('happy', { at: h.obj.position, npc: stack !== G.stack });
  };
  R.drawLabel = (h) => {
    if (h.state === 'kirli') {
      h.el.innerHTML = `<span class="ct">🧹 Toplanacak · Ev ${h.i + 1}</span><span class="bar"><i style="width:${Math.round(h.clean * 100)}%;background:#56c27e"></i></span>`;
      h.label.hidden = false;
      return;
    }
    if (!h.order) return;
    h.el.innerHTML = orderHtml(`🐚 Ev ${h.i + 1} · istek`, h.order);
    h.barEl = h.el.querySelector('.bar i');
  };

  function spawnGuest() {
    const c = new Customer(FAR.clone().setZ(FAR.z + rand(-0.3, 0.3)), 'tatil', M.touristLook());
    // valiz: misafirin elinde
    const bag = M.rbox(0.36, 0.42, 0.18, 0.05, M.mat(pick(['#e8604c', '#3d7dd8', '#f6b12a', '#3fae6b'])), 0.34, 0.45, 0.05, c.obj);
    bag.castShadow = true; c.bag = bag;
    c.alwaysCarry = true;
    c.house = null; c.wait = 0;
    c.path = [ROAD.clone(), GATE.clone()];
    c.state = 'arrive';
    R.waiting++;
    c.think = (dt) => {
      switch (c.state) {
        case 'arrive':
          if (c.walk(dt)) {
            R.desk.queue.push(c);
            c.path = [R.desk.slot(R.desk.queue.length - 1)];
            c.state = 'queue';
            c.setBubbleText('🛎️ Kayıt');
          }
          break;
        case 'queue':
          c.walk(dt); c.wait += dt;
          if (c.wait > 45) { R.giveUp(c); break; }
          if (!c.path.length && R.desk.queue[0] === c) { c.state = 'desk'; c.face(PI, 1); }
          break;
        case 'desk':
          c.face(PI, dt); c.wait += dt;
          if (c.wait > 45) { R.giveUp(c); break; }
          break;
        case 'toHouse':
          if (c.walk(dt)) {
            const h = c.house;
            c.obj.visible = false; // içeri girdi
            R.waiting--;
            h.state = 'dolu'; h.reserved = false; h.stay = rand(70, 110); h.reqT = rand(6, 12); h.score = c.wait > 25 ? 4 : 5;
            c.poolT = Math.random() < 0.65 ? rand(10, 28) : Infinity; // çoğu misafir bir ara havuz başında güneşlenir
            c.porchT = R.porchWait();
            h.obj.userData.lamp.emissiveIntensity = 1.1;
            c.state = 'stay';
          }
          break;
        case 'stay': {
          const h = c.house;
          R.stayTick(h, dt);
          c.poolT -= dt; c.porchT -= dt;
          const seat = (R.poolSeats || []).find((s) => !s.c);
          if (c.poolT <= 0 && !h.order && h.stay > 28 && seat) { R.toPool(c, seat); break; }
          if (c.porchT <= 0 && h.stay > 16) { R.toPorch(c); break; }
          if (h.stay <= 0 && !h.order) R.checkOut(c);
          break;
        }
        case 'toPorch':
          c.house.stay -= dt;
          if (c.walk(dt)) R.sitPorch(c);
          break;
        case 'porch': {
          // verandada oturur: istekleri sürer, vakti dolunca ya da ayrılma yaklaşınca içeri girer
          const h = c.house;
          R.stayTick(h, dt); c.t += dt;
          if (c.t > c.porchDur || h.stay < 8) R.fromPorch(c);
          break;
        }
        case 'toPool':
          if (c.walk(dt)) {
            const s = c.seat0, k = 0.72; // şezlongun ayak ucuna doğru uzanır (şezlong 0,85 ölçekli)
            c.lying = true; c.state = 'pool'; c.t = 0;
            c.obj.rotation.order = 'YXZ';
            c.obj.position.set(s.x + Math.sin(s.ry) * 0.85 * k, 0.43, s.z + Math.cos(s.ry) * 0.85 * k);
            c.obj.rotation.set(-1.25, s.ry, 0);
            c.seat = c.obj.position.clone();
            M.setSwimwear(c.obj, true); // havuz başında mayoyla
            c.setBubbleText('😎');
            setTimeout(() => { if (c.state === 'pool') c.clearBubble(); }, 1600);
          }
          break;
        case 'pool': {
          const h = c.house;
          h.stay -= dt; c.t += dt;
          // istek vermez, keyif yapar; süresi dolunca ya da ayrılma vakti yaklaşınca evine döner
          if (c.t > c.poolDur || h.stay < 10) R.fromPool(c);
          break;
        }
        case 'back':
          c.house.stay -= dt;
          if (c.walk(dt)) { c.obj.visible = false; c.state = 'stay'; }
          break;
        case 'leave':
          if (c.walk(dt)) c.destroy();
          break;
      }
    };
  }
  // evde kalırken her karede: kalış süresi, istek zamanlayıcısı (içerideyken de verandadayken de)
  R.stayTick = (h, dt) => {
    h.stay -= dt;
    if (h.order) {
      h.timer -= dt;
      if (h.barEl) h.barEl.style.width = `${Math.max(0, h.timer / h.total) * 100}%`;
      if (h.timer <= 0) R.orderDone(h, false);
    } else if (h.stay > 22) {
      h.reqT -= dt;
      if (h.reqT <= 0) R.request(h);
    }
  };
  // veranda: misafir arada bir dışarı çıkıp sandalyelerden birine oturur; akşam şömine yanarken daha sık ve daha uzun
  // 2026-11-04 kullanıcı: "kabuk evlerin verandasındaki sandalyelerde otursun misafirler"
  R.porchWait = () => (evening() ? rand(3, 8) : rand(14, 30));
  const SIT_Y = DECK + 0.495 - 0.6; // minderin üstü; kalça yüksekliği ≈0,6
  const sitPose = (o) => { o.position.y = SIT_Y; for (const l of o.userData.legs) l.rotation.x = -1.45; };
  R.toPorch = (c) => {
    const h = c.house, sx = Math.random() < 0.5 ? -1 : 1, ry = chairRy(sx);
    const x = h.x + sx * 1.25, z = HOUSE_Z + CHAIR_Z;
    c.chair = { x, z, ry, sx };
    c.obj.visible = true;
    c.obj.position.set(h.x, 0, TERRACE_Z - 0.5);
    c.path = [V(h.x + sx * 0.7, 0, TERRACE_Z + 0.5), V(x + Math.sin(ry) * 0.55, 0, z + Math.cos(ry) * 0.55)];
    c.state = 'toPorch';
  };
  R.sitPorch = (c) => {
    const { x, z, ry } = c.chair;
    c.obj.position.set(x - Math.sin(ry) * 0.04, SIT_Y, z - Math.cos(ry) * 0.04);
    c.obj.rotation.y = ry;
    c.alwaysCarry = false; c.bag.visible = false; // valiz içeride kalır
    c.pose = sitPose;
    c.state = 'porch'; c.t = 0;
    const warm = evening();
    c.porchDur = warm ? rand(26, 45) : rand(12, 22);
    c.setBubbleText(warm ? '🔥😌' : '😌');
    setTimeout(() => { if (c.state === 'porch') c.clearBubble(); }, 1600);
  };
  R.fromPorch = (c) => {
    const h = c.house, { x, z, ry, sx } = c.chair;
    c.pose = null; c.obj.position.set(x + Math.sin(ry) * 0.55, 0, z + Math.cos(ry) * 0.55);
    for (const l of c.obj.userData.legs) l.rotation.x = 0;
    c.alwaysCarry = true; c.bag.visible = true;
    c.chair = null; c.porchT = R.porchWait();
    c.path = [V(h.x + sx * 0.7, 0, TERRACE_Z + 0.5), V(h.x, 0, TERRACE_Z - 0.5)];
    c.state = 'back';
  };
  R.toPool = (c, s) => {
    const h = c.house;
    s.c = c; c.seat0 = s; c.poolT = Infinity; c.poolDur = rand(14, 26);
    c.obj.visible = true;
    c.obj.position.set(h.x, 0, TERRACE_Z - 0.5);
    c.path = [V(lane(h), 0, TERRACE_Z + 0.4), s.stand.clone()];
    c.state = 'toPool';
  };
  R.fromPool = (c) => {
    const h = c.house, s = c.seat0;
    c.lying = false; c.clearBubble(); M.setSwimwear(c.obj, false);
    c.obj.rotation.set(0, PI, 0); c.obj.rotation.order = 'XYZ';
    c.obj.position.copy(s.stand);
    s.c = null; c.seat0 = null;
    c.path = [V(lane(h), 0, TERRACE_Z + 0.4), V(h.x, 0, TERRACE_Z - 0.5)];
    c.state = 'back';
  };
  // kayıt için çok bekleyen misafir kızıp gider: puanı düşürür (oyuncu ya da kat görevlisi masada olmalı)
  R.giveUp = (c) => {
    const i = R.desk.queue.indexOf(c);
    if (i >= 0) R.desk.queue.splice(i, 1);
    R.desk.queue.forEach((q, k) => { q.path = [R.desk.slot(k)]; });
    R.waiting--;
    R.ratings.push(2); if (R.ratings.length > 12) R.ratings.shift();
    R.drawRating();
    c.mood(false);
    c.path = [GATE.clone(), ROAD.clone(), FAR.clone()];
    c.state = 'leave';
  };
  R.checkOut = (c) => {
    const h = c.house, stars = Math.max(1, Math.min(5, Math.round(h.score)));
    R.ratings.push(stars); if (R.ratings.length > 12) R.ratings.shift();
    R.drawRating();
    c.obj.visible = true;
    const at = V(h.x, 2.2, TERRACE_Z);
    floatText(at, `${'⭐'.repeat(stars)}`, stars >= 4 ? 'pos' : 'neg');
    if (stars >= 4) sfx('happy', { at });
    h.state = 'kirli'; h.guest = null; h.clean = 0;
    h.obj.userData.lamp.emissiveIntensity = 0.15;
    h.obj.userData.mess.visible = true;
    R.drawLabel(h);
    c.path = [V(lane(h), 0, TERRACE_Z + 0.4), V(lane(h), 0, 15.6), GATE.clone(), ROAD.clone(), FAR.clone()];
    c.state = 'leave';
  };

  R.update = (dt) => {
    // şömineler akşam yavaşça yanar, sabah söner (2,5 sn)
    const fk = evening() ? 1 : 0;
    for (const h of R.houses) {
      if (h.fk === undefined) h.fk = fk;
      if (h.fk === fk) continue;
      h.fk += Math.sign(fk - h.fk) * Math.min(Math.abs(fk - h.fk), dt / 2.5);
      h.obj.userData.fire(h.fk);
    }
    R.spawnT -= dt;
    const free = R.houses.filter((h) => h.state === 'temiz' && !h.reserved).length;
    if (R.spawnT <= 0) {
      R.spawnT = Math.max(12, 30 - (R.avg() - 3) * 4) * rand(0.8, 1.2);
      if (free > R.waiting && R.waiting < 3) spawnGuest();
    }
  };
  return R;
}
