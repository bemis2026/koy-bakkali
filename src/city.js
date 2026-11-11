// Şehir Marketi: köy bakkalının ikinci dünyası. Köyün çok uzağında (x ≈ 430, sisin ötesinde) ayrı bir alan: cadde,
// apartmanlar ve mahalle süpermarketi. Köydeki otobüs durağından gidilir; oyuncu şehirdeyken köy aynı sahnede çalışmaya
// devam eder (elemanlar üretir, satar). Şehirde köy ürünü 1,5 katına satılır. Malın bir kısmı köyden gelir: köy kamyonu
// belli aralıklarla köyün fazlasını (tepside bekleyen süt, peynir, yumurta, sebze, fırın ürünü) getirip depoya boşaltır,
// nakliyesi ödenir. Bir kısmı şehrin halinden parayla alınır (meyve ve meyve suyu).
// Kilitler world.js UNLOCKS'a cityUnlocks ile eklenir: gc1 yol ve durak (seviye 10), gc2 dükkân kirası (12), gc market
// açılışı (14); sc1-sc6 reyon, hal, rafçı, kamyon. Market kasiyeri kilit değil, eleman menüsünden işe alınır (upgrades.js).
// 2026-11-08 kullanıcı: "Şehrimiz ve marketimiz barcelona mimarisinde olabilir. Binalar yollar botanik vs." ve "marketin arka kısmında
// sonradan açılan raflar çok uzakta kaldı": şehir Barselona'ya döndü (barselona.js: köşesi pahlı Eixample binaları, panot kaldırım,
// Rambla, meydanlar, botanik bahçe), cadde canlandı (sehirhayat.js: yayalar, araba, motor, bisiklet). Market modernist (tuğla, mozaik,
// hidrolik karo) ve tek salon: hipermarketin arka salonu kalktı, raflar arka duvarda ve orta reyonun iki yüzünde, kasaya yakın
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, Station, Shelf, Register, MoneyPile, PaidSource, Customer, Stack, makeItem, fly, floatText, sfx, popIn, rand, pick, lerpAngle, toast, priceOf, mineFx, queueStep, bounce } from './game.js';
import { texRep, textTex } from './tex.js';
import { makeAisle } from './reyon.js';
import { makeTag } from './tags.js';
import { fine } from './account.js';
import { repMul } from './rating.js';
import { SUPER_GROUPS, TOPTAN, storeSign, cartCorral, pylon, toptanBoard } from './supermarket.js';
import { marketDecor, buildBarcelona, hydraulicTex, ZEBRA } from './barselona.js';
import { cityLook, cityGapK } from './sehirhayat.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// şehrin halinden gelen ürünler (Kenney meyve modelleri)
ITEMS.elma = { name: 'Elma', price: 6, model: 'apple', cost: 3 };
ITEMS.portakal = { name: 'Portakal', price: 7, model: 'orange', cost: 3 };
ITEMS.limon = { name: 'Limon', price: 5, model: 'lemon', cost: 2 };
ITEMS.meyvesuyu = { name: 'Meyve suyu', price: 15, model: 'carton', cost: 8 };

const CX = 430, CZ = 0;
const FRONT_Z = CZ + 10, WALK_N = CZ + 11.2, STREET_Z = CZ + 15, WALK_S = CZ + 19.4;
const CSTOP_AT = [CX - 26, CZ + 9.2];
export const CITY = {
  x: CX, z: CZ,
  // 2026-11-01 büyüdü (kullanıcı: "raflar çok yakın, rahat koşulmuyor, market alanlarımızı büyüt"): iki yana 4'er, arkaya 2 m
  // 2026-11-08 ("raflar çok uzakta kaldı, iç mimariyi akışa uygun hale getir"): arka salonlu 24 m derinlik yerine tek salon, 20,5 m;
  // yanlara 1,5'er m (orta reyonun iki yarısında 6'şar raf). Arka duvar botanik bahçeye bakar (barselona.js)
  rect: [CX - 22.5, CX + 22.5, CZ - 10.5, CZ + 10], walk: [CX - 22.1, CX + 22.1, CZ - 10.1, CZ + 10.4],
  entry: [CX - 26, 0, CZ + 12.8], // menüden "Oraya git": şehir durağının önü
  street: [STREET_Z - 3.2, STREET_Z + 3.2], stop: CSTOP_AT, // mini haritanın şehir planı (minimap.js): cadde ve durak
};
const PREMIUM = () => (G.mods && G.mods.cityPremium) || 1.5; // şehirde köy ürünü pahalı satılır (Büyük Market: 1,7, expand-east.js)
// köy durağı: ana asfaltın güney kenarında, köyün batı koridorunda (köy yolu yaya yolu, araç girmez); otobüs doğuya giden şeritte
// köy durağı kasaba girişinde, ana yolun kuzey kenarında (2026-11-01 kullanıcı: "otobüs durağını kasabanın girişindeki yolun başlarına koy";
// köyün batı patikasının ağzında kalabalık yapıyordu). Dolmuş durağı (expand-west.js) hemen batısında, aynı durakta yan yana.
// Otobüs kuzey şeritte, batıya bakar. 2026-11-04 ("araçlar birbirinin içinden geçiyor"): x -32'deyken paket cebinden çıkan arabalar
// batıya giden şeritte içinden geçiyordu; cebin çıkışının doğusuna alındı, o kesimde batıya giden şeride hiçbir taşıt girmez (events.js)
const VSTOP = { shelter: [-37.9, -22.6], zone: [-37.9, -21.3], arrive: [-34.2, -21.8], bus: [-22.2, -19.8] };
const CSTOP = CSTOP_AT; // şehir durağı: marketin batısında, caddenin kuzey kaldırımı
const DOCK_X = CX - 12; // köy kamyonunun market önünde durduğu yer (deponun hizası)
const AISLE = CZ - 5.6, LANE = CX; // reyonların önündeki koridor, kapıdan arkaya inen orta yol
// kamyon kapasitesi (2026-11-04 kullanıcı: "şehir marketine gelen ürünler yetersiz oluyor, gelen ürünleri arttırma seçeneği oluştur"):
// menüdeki yükseltme (upgrades.js ctCap) köy kamyonuna, hal ve toptancı kamyonuna sefer başı ek ürün verir; depo ve paletler de büyür
const truckBonus = () => (G.mods && G.mods.ctCap) || 0;
const TOP_X = CX + 5; // toptan paleti (süpermarket): orta yolun doğusunda, kasanın batısında; toptancı kamyonu önünde (TOP_X + 2) durur
const HAL_X = CX - 17.5; // hal paleti deponun batısında, kapıya yakın (eski yeri orta reyonun önüydü, müşterinin raf hattını kesiyordu)

// bölümler: kilit bir ürün grubunu açar; her ürünün kendi rafı var (reyon.js, raf-plan.md). Genişletmeler gruba ürün ekler
// (expand.js sell: şehir manavına lahana, bal...; hediyeliğe halı, çiçek; kahvaltılığa tost)
const GROUPS = {
  taze: { color: '#4f9a3f', types: ['domates', 'salatalik'] }, // karpuz, biber, patlıcan rafları kalktı (2026-11-05 kullanıcı: "bazı üretimi olmayan raflar var onları fark et kaldır"): pazarın ürünleri şehre hiç gelmiyordu
  sut: { color: '#3d7dd8', types: ['sut', 'peynir', 'yogurt', 'ksut'] },
  kahve: { color: '#d98a2b', types: ['yumurta', 'ekmek', 'simit', 'pogaca'] },
  hal: { color: '#e8604c', types: ['elma', 'portakal', 'limon', 'meyvesuyu'] },
  hediye: { color: '#b5523b', types: ['kilim', 'yun'] },
  unlu: { color: '#c8964e', types: ['pide'] }, // genişletme (expand-east.js xsehir1); ekmek, simit, poğaça kahvaltılıkta
};
for (const [k, g] of Object.entries(SUPER_GROUPS)) GROUPS[k] = { color: g.color, types: g.types.slice() }; // süpermarket reyonları (supermarket.js)
// raf yerleri (2026-11-08 akış düzeni): arka duvarda 12 raf (iki katlı, güneye bakar), önünde 2,1 m'lik koridor; ortada sırt sırta
// çift yüzlü reyon, iki yarı, her yarıda 6 raf (orta yol x 430 açık). Kuzey yüzü manav ve bakkaliye, güney yüzü (kasaya bakan) hediyelik,
// fırın, temizlik ve atıştırmalık. Hipermarketin rafları eskiden arka salonun duvarındaydı (kasaya 25 m), şimdi reyonun güney yüzünde
const CITY_PLACES = (() => {
  const P = {}, row = (list, xs, z, face) => list.forEach((t, i) => { if (t) P[t] = [xs[i], z, face, 2.2]; });
  const back = Array.from({ length: 12 }, (_, i) => CX - 16.5 + i * 3.0); // raflar 3 m aralıklı
  const left = [CX - 19, CX - 16, CX - 13, CX - 10, CX - 7, CX - 4], right = [CX + 4, CX + 7, CX + 10, CX + 13, CX + 16, CX + 19];
  row(['sut', 'peynir', 'yogurt', 'ksut', 'elma', 'portakal', 'limon', 'meyvesuyu', 'yumurta', 'ekmek', 'simit', 'pogaca'], back, CZ - 7.7, 1);
  row(['domates', 'salatalik', 'lahana', 'balkabagi', 'aycicek', 'tursu'], left, CZ - 3.5, -1);
  row(['bal', 'makarna', 'pirinc', 'su', 'gazoz', null], right, CZ - 3.5, -1); // süpermarket: paketli gıda ve içecek
  row(['kilim', 'yun', 'hali', 'cicek', 'pide', 'tost'], left, CZ - 2.5, 1);
  row(['deterjan', 'sabun', 'kagit', 'cips', 'cikolata', 'biskuvi'], right, CZ - 2.5, 1); // hipermarket: temizlik ve atıştırmalık
  return P;
})();
const cityBack = (t) => CITY_PLACES[t][1] < CZ - 6;

// ---------- yardımcı modeller ----------
function flat(g, cx, cz, w, d, tex, tile, y, color = '#ffffff') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: texRep(tex, w / tile, d / tile), color, roughness: 0.95 }));
  m.rotation.x = -PI / 2; m.position.set(cx, y, cz); m.receiveShadow = true; g.add(m);
  return m;
}
function makeBus() {
  const g = new THREE.Group(), body = M.mat('#f6c343'), dark = M.mat('#2a3340'), glass = M.mat('#9fd8f5', { rough: 0.15 });
  M.rbox(7.2, 2.3, 2.4, 0.25, body, 0, 1.55, 0, g);
  M.rbox(6.2, 0.8, 2.46, 0.08, glass, -0.3, 2.05, 0, g); // yan camlar
  M.rbox(0.1, 1.0, 2.0, 0.05, glass, 3.62, 1.95, 0, g); // ön cam
  M.rbox(7.25, 0.28, 2.45, 0.05, M.mat('#e8604c'), 0, 0.9, 0, g); // kırmızı şerit
  for (const x of [-2.4, 2.4]) for (const z of [-1.15, 1.15]) { const w = M.cyl(0.45, 0.45, 0.3, 14, dark, x, 0.45, z, g); w.rotation.x = PI / 2; }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// durak: iki direk, cam arka, çatı, bank ve levha
function makeShelter() {
  const g = new THREE.Group(), pole = M.mat('#5a6270');
  for (const x of [-1.4, 1.4]) M.cyl(0.06, 0.06, 2.4, 8, pole, x, 1.2, 0, g);
  M.rbox(3.2, 0.12, 1.4, 0.04, M.mat('#2f6db5'), 0, 2.45, 0.2, g);
  M.rbox(2.9, 1.5, 0.05, 0.02, M.mat('#cfeefc', { opacity: 0.55 }), 0, 1.2, -0.45, g);
  M.rbox(2.4, 0.12, 0.5, 0.03, M.mat('#a8703f'), 0, 0.55, -0.15, g);
  const s = M.makeSign('🚌 OTOBÜS', '#e8604c', 1.6, 0.5); s.position.set(1.9, 0, 0); s.scale.setScalar(0.8); g.add(s);
  // çatının ön alnında büyük yazı: yukarıdan bakınca da ne durağı olduğu okunur (dolmuş durağıyla yan yana, expand-west.js)
  const t = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.42), new THREE.MeshBasicMaterial({ map: textTex('🚌 OTOBÜS DURAĞI', { bg: '#e8604c', w: 512, h: 72, r: 10 }) }));
  t.position.set(0, 2.45, 0.92); g.add(t);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// depo paleti: köy kamyonunun getirdiği mallar üst üste
class Palet extends Station {
  constructor(C, x, z) {
    super(x, z + 1.3, 2.6, 1.3, { y: 0.03 });
    this.items = [];
    this.group = new THREE.Group(); this.group.position.set(x, 0, z); C.add(this.group);
    M.rbox(2.3, 0.16, 1.3, 0.03, M.mat('#b07a45'), 0, 0.08, 0, this.group);
  }
  slot(i) { const l = Math.floor(i / 8), c = i % 8; return V(-0.8 + (c % 4) * 0.53, 0.22 + l * 0.32, -0.3 + Math.floor(c / 4) * 0.6); }
  get cap() { return 32 + Math.min(16, truckBonus()); } // kamyon kapasitesiyle depo da büyür (en çok 6 kat)
  get free() { return this.cap - this.items.length; }
  // kamyondan gelen ürün: from noktasından uçarak palete konur
  put(type, from) {
    if (this.items.length >= this.cap) return false;
    const o = makeItem(type); o.position.copy(from); G.scene.add(o);
    this.items.push({ type, obj: o });
    fly(o, this.group, this.slot(this.items.length - 1), 0.4, 1.3);
    return true;
  }
  // elemana ya da oyuncuya: istenen türlerden (yoksa sonuncu) bir tane
  give(stack, want) {
    if (stack.full || !this.items.length) return false;
    const i = want ? this.items.findIndex((x) => want.includes(x.type)) : this.items.length - 1;
    if (i < 0) return false;
    const it = this.items.splice(i, 1)[0];
    stack.push(it.type, it.obj);
    this.items.forEach((x, k) => { if (x.obj.parent === this.group) x.obj.position.copy(this.slot(k)); });
    sfx('pop', { npc: stack !== G.stack });
    return true;
  }
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t < 0.14) return;
    this.t = 0;
    const R = G.regions.sehir, want = R ? R.shelves.filter((s) => s.slots.includes(null)).flatMap((s) => s.acc()) : null;
    this.give(G.stack, want && want.length ? want : null);
  }
}
// hal paleti (2026-11-04 kullanıcı: "şehir marketinin önünde sürekli sabit duran araç var, ürün alabiliyorum ama uzakta ve anlamsız;
// diğer araç gibi ürünleri getirip bıraksın"): hal kamyoneti arada bir gelir, meyveyi deponun kuzeyindeki bu palete bırakır, gider
// (updateHalTruck). Meyve toptancı malı: paletten alınırken toptan fiyatı ödenir. Eskiden caddenin karşısında park etmiş
// kamyonetten alınıyordu. PaidSource'tan türer: eleman isteği (requests.js) ve imleç onu yine toptancı sayar
const HAL = ['elma', 'portakal', 'limon', 'meyvesuyu'];
class HalPalet extends PaidSource {
  // o.types: paletin türleri; o.base: ilk kapasite, kamyon kapasitesiyle o.grow kadar büyür; o.wide: yan yana iki palet (toptan paleti)
  constructor(C, x, z, instant, o = {}) {
    super({ x, z: z + 1.6, types: o.types || HAL, origin: V(x, 1.0, z), instant });
    this.items = []; this.base = o.base || 16; this.grow = o.grow ?? 16; this.wide = !!o.wide;
    this.group = new THREE.Group(); this.group.position.set(x, 0, z); C.add(this.group);
    for (const dx of this.wide ? [-1.18, 1.18] : [0]) M.rbox(2.3, 0.16, 1.3, 0.03, M.mat('#b07a45'), dx, 0.08, 0, this.group);
  }
  get cap() { return this.base + Math.min(this.grow, truckBonus()); }
  get stock() { return this.items.length; } // mal paletteki kadar (PaidSource kurucusu stock yazar: yok sayılır)
  set stock(v) {}
  get free() { return this.cap - this.items.length; }
  count(t) { return this.items.filter((x) => x.type === t).length; }
  slot(i) { // katta tek palette 8, iki palette 16 ürün
    const n = this.wide ? 16 : 8, k = n / 2, l = Math.floor(i / n), c = i % n;
    return V((this.wide ? -1.95 : -0.8) + (c % k) * (this.wide ? 0.557 : 0.53), 0.22 + l * 0.32, -0.3 + Math.floor(c / k) * 0.6);
  }
  put(type, from) {
    if (this.items.length >= this.cap) return false;
    const o = makeItem(type); o.position.copy(from); G.scene.add(o);
    this.items.push({ type, obj: o });
    fly(o, this.group, this.slot(this.items.length - 1), 0.4, 1.3);
    return true;
  }
  // want: elemanın istediği tür; oyuncuya reyonda yeri olan türden (yoksa sonuncu)
  buyTo(stack, want) {
    if (stack.full) return 'full';
    if (!this.items.length) return 'empty';
    const R = G.regions.sehir, need = want ? [want] : R ? R.shelves.filter((s) => s.slots.includes(null)).flatMap((s) => s.acc()) : [];
    let i = this.items.findIndex((x) => need.includes(x.type));
    if (i < 0) { if (want) return 'empty'; i = this.items.length - 1; }
    const type = this.items[i].type, cost = G.visit && stack !== G.stack ? 0 : ITEMS[type].cost;
    if (G.money < cost) return 'poor';
    if (stack === G.stack) bounce(G.player, 0.04);
    const it = this.items.splice(i, 1)[0];
    G.money -= cost;
    stack.push(type, it.obj, 0.32);
    this.items.forEach((x, k) => { if (x.obj.parent === this.group) x.obj.position.copy(this.slot(k)); });
    floatText(this.origin, `-${cost} ₺`, 'neg');
    sfx('pop', { npc: stack !== G.stack });
    return 'ok';
  }
}
// durak: üstünde DURUNCA (koşarak geçerken değil) 1 sn sonra bilet ödenir, otobüsle öbür dünyaya geçilir. Eskiden yolun
// üstündeki karede koşarken de 0,9 sn dolunca oyuncu bir anda şehre gidiyordu ("ışınlanma")
export const FARE = 50;
let busy = false, busyAt = 0, fadeEl = null;
class BusStop extends Station {
  constructor(x, z, to) { super(x, z, 2.6, 1.6, { dashed: true, y: 0.03 }); this.to = to; this.dwell = 0; }
  update(dt) {
    if (busy && Date.now() - busyAt > 5000) busy = false; // arka planda zamanlayıcı durduysa geçiş takılı kalmasın
    const p = G.player.position, sp = this.lp && dt > 0 ? Math.hypot(p.x - this.lp.x, p.z - this.lp.z) / dt : 0;
    this.lp = { x: p.x, z: p.z };
    this.dwell = this.inside && sp < 0.8 && G.time > (this.block || 0) ? this.dwell + dt : 0;
    if (this.dwell > 1 && !busy) {
      this.dwell = 0;
      if (G.money < FARE) { this.block = G.time + 4; toast(`🚌 Otobüs bileti ${FARE} ₺: paran yetmiyor`); return; }
      G.money -= FARE; floatText(p, `🚌 -${FARE} ₺`, 'neg');
      travel(this.to);
    }
  }
}
function fade() {
  if (fadeEl) return fadeEl;
  fadeEl = document.createElement('div');
  fadeEl.style.cssText = 'position:fixed;inset:0;z-index:50;background:#1d2633;opacity:0;pointer-events:none;transition:opacity .45s ease;display:grid;place-items:center;color:#fff;font:28px var(--font-title)';
  fadeEl.innerHTML = '<b></b>';
  document.body.appendChild(fadeEl);
  return fadeEl;
}
// geçiş: ekran kararır, oyuncu öbür durağın önüne konur, kamera yetişince açılır (köy arkada çalışmaya devam eder)
function travel(to) {
  busy = true; busyAt = Date.now();
  const el = fade();
  el.querySelector('b').textContent = to.city ? '🚌 Şehre gidiliyor…' : '🚌 Köye dönülüyor…';
  el.style.opacity = '1';
  sfx('open');
  setTimeout(() => {
    G.player.position.set(to.x, 0, to.z);
    G.world = to.city ? 'sehir' : 'koy';
    for (const s of G.stations) if (s instanceof BusStop) s.block = G.time + 2.5; // varınca hemen geri dönmesin
    setTimeout(() => { el.style.opacity = '0'; busy = false; }, 1300);
  }, 480);
}

// ---------- şehrin zemini, caddesi ve binaları (kilitten bağımsız; köyden görünmez) ----------
export function buildCityGround() {
  const g = new THREE.Group(); g.name = 'city';
  G.scene.add(g);
  flat(g, CX, CZ + 5, 280, 220, 'cobble', 2.4, -0.05, '#d8d2c6');
  flat(g, CX, STREET_Z, 170, 6.4, 'asphalt', 3, -0.03);
  const line = M.mat('#ffffff');
  for (let x = CX - 82; x < CX + 82; x += 3.4) if (Math.abs(x - CX) > 4) M.rbox(1.6, 0.02, 0.14, 0.005, line, x, -0.01, STREET_Z, g); // yaya geçidinde kesik
  const curb = M.mat('#d9d4c8');
  M.rbox(170, 0.12, 0.18, 0.02, curb, CX, 0.02, STREET_Z + 3.2, g); // güney bordürü
  // kuzey bordürü otobüs ve park ceplerinde kesilir (cepler kaldırıma girer: otobüs 390,7..399,3, muhasebecinin arabası 457,5..466)
  for (const [a, b] of [[CX - 85, 390.7], [399.3, 457.5], [466, CX + 85]]) M.rbox(b - a, 0.12, 0.18, 0.02, curb, (a + b) / 2, 0.02, STREET_Z - 3.2, g);
  // Barselona: Eixample binaları, panot kaldırım, Rambla, meydanlar, botanik bahçe, Gaudí lambaları (barselona.js). Otobüs cebi
  // durağın batısında, muhasebecinin park cebi marketin doğusunda (tahsilat.js CAR_BAY)
  buildBarcelona(g, { busBay: [CSTOP[0] - 9, 10.9], carBay: [461.75, 11.2] });
  // durakta bekleyen otobüs (yalnızca süs; geçiş ekran kararınca olur)
  // eskiden kamyonların şeridinde duruyordu (kamyon içinden geçiyordu): şimdi durağın batısındaki cepte, burnu batıya
  const bus = makeBus(); bus.position.set(CSTOP[0] - 9, 0, 10.9); bus.rotation.y = PI; g.add(bus);
  G.colliders.push([CSTOP[0] - 12.6, CSTOP[0] - 5.4, 9.7, 12.1]);
  G.walkways.push([CX - 80, CX + 80, CZ + 10, CZ + 21.2]); // cadde ve iki kaldırım yürünür
}

// ---------- market bölgesi ----------
export function cityRegion(R, h) {
  const C = R.content;
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; C.add(o); return o; };
  G.world = G.world || 'koy';
  const [x0, x1, z0, z1] = CITY.rect, wall = M.mat('#efe9df'), trim = M.mat('#a4473a'); // ön alçak duvar tuğla kırmızısı
  // hidrolik karo zemin: Barselona'nın çiçek desenli çimento karoları (barselona.js), 2 m'de bir tekrar
  const ft = hydraulicTex((x1 - x0) / 2, (z1 - z0) / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.6 }));
  floor.rotation.x = -PI / 2; floor.position.set(CX, 0.015, (z0 + z1) / 2); floor.receiveShadow = true; C.add(floor);
  // arka ve yan duvarlar yüksek; ön cephe alçak duvar ve cam (kamera içeriyi görsün), kapı ortada. Arka duvar tek parça (hipermarketin
  // arka salonu kalktı)
  M.rbox(x1 - x0, 3.2, 0.4, 0.06, wall, CX, 1.6, z0 + 0.2, C); h.rcol(x0, x1, z0, z0 + 0.4);
  for (const x of [x0 + 0.2, x1 - 0.2]) { M.rbox(0.4, 3.2, z1 - z0, 0.06, wall, x, 1.6, (z0 + z1) / 2, C); h.rcol(x - 0.2, x + 0.2, z0, z1); }
  for (const [a, b] of [[x0, CX - 3], [CX + 3, x1]]) {
    const w = b - a, m = (a + b) / 2;
    M.rbox(w, 0.7, 0.35, 0.05, trim, m, 0.35, z1 - 0.2, C);
    M.rbox(w, 1.4, 0.06, 0.02, M.mat('#cfeefc', { opacity: 0.4 }), m, 1.4, z1 - 0.2, C);
    h.rcol(a, b, z1 - 0.4, z1);
  }
  marketDecor(C, CITY.rect, h.rcol); // tuğla cephe, pilastrlar, mozaik korniş, seramik tepelikler, arka köşe kuleleri
  R.facade = put(storeSign(0), CX, 0, z1 + 0.9); // kademeyle değişir (setStage): Büyük Market, Süpermarket, Hipermarket
  for (const x of [CX - 3.05, CX + 3.05]) h.rcol(x - 0.12, x + 0.12, z1 + 0.78, z1 + 1.02);
  R.shelves = []; R.helpers = []; R.truck = { state: 'away', t: 12, cap: 12, every: 45, obj: null, cargo: [] }; R.spawnT = 4;

  // tek ürünlü raflar (reyon.js): şeridin çerçevesi şehir renginde (game.js addRail), etiket bölüm renginde
  R.groups = Object.fromEntries(Object.entries(GROUPS).map(([k, g]) => [k, g.types.slice()]));
  const colorOf = (t) => (GROUPS[Object.keys(R.groups).find((k) => R.groups[k].includes(t))] || GROUPS.taze).color;
  R.aisle = makeAisle(R, { content: C, put: (p, o, x, y, z, ry) => put(o, x, y, z, ry), rcol: (_, ...a) => h.rcol(...a), places: CITY_PLACES,
    w: 2.2, y: 0, my: 0.06, place: 'sehir', tagColor: colorOf, back: (t) => (cityBack(t) ? 2.4 : 0.5), tiers: (t) => (cityBack(t) ? 2 : 1) });
  R.openGroups = new Set();
  R.addShelf = (key, instant) => {
    R.openGroups.add(key);
    for (const t of R.groups[key] || []) R.aisle.ensure(t, instant);
  };
  // hal: şehrin toptancısı. Kamyoneti meyveyi ve meyve suyunu marketin içindeki hal paletine getirir (updateHalTruck); parayla alınır
  R.addHal = (instant) => {
    R.hal = new HalPalet(C, HAL_X, CZ + 4.4, instant); // deponun batısında, aynı hizada (2026-11-08 akış düzeni)
    h.rcol(HAL_X - 1.15, HAL_X + 1.15, CZ + 3.75, CZ + 5.05);
    R.halTruck = { state: 'away', t: instant ? 4 : 8, cap: 12, every: 35, obj: null, cargo: [], dock: HAL_X + 2, label: '🍎 Halden', unit: 'meyve' };
    h.hint(HAL_X, 2.4, CZ + 6.2, '🍎', 'Hal paleti', 'Hal kamyoneti meyveyi ve meyve suyunu buraya bırakır. Toptan fiyatına al, meyve reyonuna diz.', 4);
  };
  // kasiyer: kasada durur, ödemeyi alır; para tezgahta birikir, oyuncu toplar. Kasa kasiyersiz kurulur: kasiyer eleman
  // menüsünden işe alınır (upgrades.js mcashier), işten çıkarılınca removeCashier. İkinci kasa açıksa (sc7) ikinci kasiyer oraya geçer
  R.cashiers = []; // { o, reg, tag }
  const seat = (e, reg) => { e.reg = reg; reg.cashier = { obj: e.o, interval: 0.8 }; e.o.position.set(reg.zone.x, 0, reg.zone.z - 0.1); };
  R.addCashier = (instant) => {
    const reg = (R.registers || [R.register]).find((r) => !r.cashier) || R.register;
    const o = M.makeCharacter({ shirt: '#2f6db5', pants: '#2a2a2a', hat: 'cap', hatColor: '#2f6db5', skin: '#e9b98f' });
    G.scene.add(o); if (!instant) popIn(o);
    const e = { o, reg: null, tag: staffTag(o, R.cashiers.length ? `Market kasiyeri ${R.cashiers.length + 1}` : 'Market kasiyeri') };
    seat(e, reg); R.cashiers.push(e); R.cashier = R.cashiers[0].o;
    return e;
  };
  R.removeCashier = (e = R.cashiers[R.cashiers.length - 1]) => {
    if (!e || !R.cashiers.includes(e)) return;
    G.scene.remove(e.o); G.labels.remove(e.tag);
    if (e.reg.cashier && e.reg.cashier.obj === e.o) e.reg.cashier = null;
    R.cashiers.splice(R.cashiers.indexOf(e), 1);
    R.cashier = R.cashiers.length ? R.cashiers[0].o : null;
  };
  // ikinci kasa (kilit sc7; 2026-11-02 kullanıcının "yeni kasa alma" isteği şehirde de): birincinin doğusunda kendi bankosu, para
  // yığını ve kuyruğu (doğu duvarındaki soğutucuların önünde kıvrılır); müşteri çalışan kasalardan kuyruğu kısa olanı seçer
  R.addRegister2 = (instant) => {
    if (R.register2) return;
    const X = CX + 16.5;
    const ctr = put(M.makeCounter(), X, 0, CZ + 3.5); if (!instant) popIn(ctr);
    h.rcol(X - 1.35, X + 1.35, CZ + 2.9, CZ + 4.1);
    R.pile2 = new MoneyPile(C, X + 1.02, CZ + 3.55, 1.04, { instant, desk: false, body: [X - 1.35, X + 1.35, CZ + 2.9, CZ + 4.1] });
    R.register2 = new Register({ zx: X, zz: CZ + 2.0, zw: 2.4, zd: 1.3, my: 0.06, pile: R.pile2, instant, top: V(X + 0.4, 1.08, CZ + 3.45), topDir: V(1, 0, 0),
      queue: [V(X, 0, CZ + 5.0), V(X, 0, CZ + 6.2), V(X, 0, CZ + 7.4), V(X + 1.2, 0, CZ + 8.5), V(X + 2.4, 0, CZ + 8.5), V(X + 2.4, 0, CZ + 7.3), V(X + 2.4, 0, CZ + 6.1), V(X + 2.4, 0, CZ + 4.9)] });
    R.registers.push(R.register2);
    // kayıt açılırken kasiyerler kasadan önce kurulduysa ikisi birinci kasada kalmıştır: ikincisi yeni kasaya geçer
    const extra = R.cashiers.find((e) => e.reg === R.register && !(R.register.cashier && R.register.cashier.obj === e.o));
    if (extra) seat(extra, R.register2);
    h.hint(X, 2.6, CZ + 6.2, '🧾', 'İkinci kasa', 'Müşteri kısa kuyruğu seçer. İkinci market kasiyerini eleman menüsünden al ya da kasanın başında dur.', 4);
  };
  // şehre giden yol kademeli açılır (cityUnlocks gc1, gc2, gc). Bölge içeriği market açılana kadar gizli olduğu için durak ve
  // tabela doğrudan sahneye kurulur
  R.buildStop = (instant) => {
    if (R.stop) return;
    const g = R.stop = new THREE.Group();
    const sh = makeShelter(); sh.position.set(VSTOP.shelter[0], 0, VSTOP.shelter[1]); g.add(sh); // önü yola (güneye) bakar
    G.scene.add(g); if (!instant) popIn(g);
    G.colliders.push([VSTOP.shelter[0] - 1.6, VSTOP.shelter[0] + 1.6, VSTOP.shelter[1] - 0.6, VSTOP.shelter[1] - 0.3]); // arkadaki cam
  };
  R.rentShop = (instant) => {
    if (R.soon || R.unlocked) return;
    R.soon = M.makeSign('ŞEHİR MARKETİ · YAKINDA', '#2f6db5', 3.4, 0.7);
    R.soon.position.set(VSTOP.shelter[0] + 6.5, 0, VSTOP.shelter[1] - 0.4); // durağın doğusunda, otobüs levhasının yanında
    G.scene.add(R.soon); if (!instant) popIn(R.soon); // yazılar intro.js gc1, gc2
  };
  R.addShelver = (instant) => { R.helpers.push(new CityShelver(R, instant, R.helpers.length)); };
  R.bigTruck = () => { R.truck.cap = 24; R.truck.every = 30; };

  // kademeler (supermarket.js; expand-east.js xsehir3 Büyük Market, xsehir4 Süpermarket, xsehir5 Hipermarket): tabela değişir.
  // Süpermarkette toptan paleti, toptancı kamyonu, alışveriş arabaları ve iki reyon (paketli gıda, içecek); hipermarkette iki reyon
  // daha (temizlik, atıştırmalık: orta reyonun kasaya bakan yüzünde; eskiden 8 m'lik arka salondaydı) ve caddeden görünen tabela direği
  R.stage = 0;
  R.setStage = (n, instant) => {
    if (n <= R.stage) return;
    R.stage = n;
    R.facade.removeFromParent(); R.facade = put(storeSign(n), CX, 0, z1 + 0.9); if (!instant) popIn(R.facade);
    if (n >= 2 && !R.toptan) {
      R.toptan = new HalPalet(C, TOP_X, CZ + 1.2, instant, { types: TOPTAN, base: 24, grow: 24, wide: true });
      h.rcol(TOP_X - 2.35, TOP_X + 2.35, CZ + 0.55, CZ + 1.85);
      R.toptanTruck = { state: 'away', t: instant ? 6 : 10, cap: 12, every: 35, obj: null, cargo: [], model: 'delivery', dock: TOP_X + 2, label: '📦 Toptancıdan', unit: 'ürün' };
      const cc = put(cartCorral(), CX + 7.5, 0, z1 + 0.55); h.rcol(CX + 6.2, CX + 8.8, z1 + 0.15, z1 + 0.95); if (!instant) popIn(cc);
      R.addShelf('paket', instant); R.addShelf('icecek', instant);
      h.hint(TOP_X, 2.4, CZ + 3.0, '📦', 'Toptan paleti', 'Toptancı kamyonu paketli gıdayı, içeceği ve temizlik malını buraya bırakır. Toptan fiyatına al, reyonlara diz.', 4);
    }
    if (n >= 3 && !R.hall) {
      R.hall = true; R.addShelf('temizlik', instant); R.addShelf('atistirma', instant);
      const py = put(pylon(), CX + 24.6, 0, z1 + 0.7); if (!instant) popIn(py); // doğu köşesinin önünde, kaldırımda
      h.rcol(CX + 23.3, CX + 23.6, z1 + 0.6, z1 + 0.8); h.rcol(CX + 25.6, CX + 25.9, z1 + 0.6, z1 + 0.8);
    }
  };

  R.activate = (instant) => {
    // köy durağı (kasaba girişi; yol kademesi kurar, eski kayıtta burada) ve şehir durağı (caddenin kuzey kaldırımı)
    R.buildStop(true);
    if (R.soon) { R.soon.removeFromParent(); R.soon = null; }
    put(makeBus(), VSTOP.bus[0], 0, VSTOP.bus[1], PI); // durakta bekleyen otobüs market açılınca gelir (süs; geçiş ekran kararınca olur)
    put(makeShelter(), CSTOP[0], 0, CSTOP[1] - 0.6); h.rcol(CSTOP[0] - 1.6, CSTOP[0] + 1.6, CSTOP[1] - 1.2, CSTOP[1] - 0.3);
    new BusStop(VSTOP.zone[0], VSTOP.zone[1], { city: true, x: CITY.entry[0], z: CITY.entry[2] });
    new BusStop(CSTOP[0], CSTOP[1] + 2.0, // kare tamamen kaldırımda (kuzey yarısı yürünmez alana taşıyordu)
      { city: false, x: VSTOP.arrive[0], z: VSTOP.arrive[1] });
    h.hint(VSTOP.zone[0], 2.8, VSTOP.zone[1], '🚌', 'Şehre otobüs', `Durakta dur ve bekle: ${FARE} ₺ bilet, otobüs seni şehirdeki marketine götürür. Köy sen yokken de çalışır.`, 4);
    h.hint(CSTOP[0], 2.8, CSTOP[1] + 2.0, '🚌', 'Köye otobüs', `Durakta dur ve bekle: ${FARE} ₺ bilet, köye dönersin.`, 4);
    // temel reyonlar, kasa ve depo
    R.addShelf('taze', instant); R.addShelf('sut', instant);
    put(M.makeCounter(), CX + 11, 0, CZ + 3.5);
    h.rcol(CX + 9.65, CX + 12.35, CZ + 2.9, CZ + 4.1);
    R.pile = new MoneyPile(C, CX + 12.02, CZ + 3.55, 1.04, { instant, desk: false, body: [CX + 9.65, CX + 12.35, CZ + 2.9, CZ + 4.1] });
    // ürünler bankonun doğusundaki banda dizilir: yazar kasa batıda (CX + 10,5), para yığını doğu uçta (game.js counterAt)
    R.register = new Register({ zx: CX + 11, zz: CZ + 2.0, zw: 2.4, zd: 1.3, my: 0.06, pile: R.pile, instant, top: V(CX + 11.4, 1.08, CZ + 3.45), topDir: V(1, 0, 0),
      queue: [V(CX + 11, 0, CZ + 5.0), V(CX + 11, 0, CZ + 6.2), V(CX + 11, 0, CZ + 7.4), V(CX + 9.8, 0, CZ + 8.4), V(CX + 8.6, 0, CZ + 8.4), V(CX + 7.4, 0, CZ + 8.4), V(CX + 6.2, 0, CZ + 8.4), V(CX + 5.0, 0, CZ + 8.4), V(CX + 3.8, 0, CZ + 8.4)] });
    R.registers = [R.register]; // uzun kuyruk kapıya doğru uzar
    R.depot = new Palet(C, DOCK_X, CZ + 4.4);
    h.rcol(DOCK_X - 1.15, DOCK_X + 1.15, CZ + 3.75, CZ + 5.05);
    h.hint(DOCK_X, 2.4, CZ + 5.9, '🚚', 'Köyden gelen mal', 'Köy kamyonu köyün fazlasını buraya bırakır. Al, reyonlara diz; şehirde 1,5 katına satılır.', 4);
    h.hint(CX, 3.2, FRONT_Z + 0.2, '🏙️', 'Mahalle Marketi', 'Köyün taze ürünlerini şehirde sat. Kasada dur, müşterinin ödemesini al.', 6);
    if (!instant) toast('🚌 Ana yolun kenarında, köyün batısında otobüs durağı açıldı: şehre gitmek için durakta bekle');
  };
  R.update = (dt) => updateCity(R, dt);
  return R;
}

// ---------- market kilitleri (world.js UNLOCKS'a eklenir) ----------
export function cityUnlocks({ unlockRegion }) {
  const S = () => G.regions.sehir;
  return [
    // şehre gidiş üç kademe: yol ve durak, dükkân kirası, ruhsat ve açılış (fiyatlar zorluk çarpanının dışında, world.js)
    { id: 'gc1', lvl: 10, icon: '🛣️', title: 'Şehir yolu ve durak', price: 8000, at: VSTOP.zone, side: true, build: (i) => S().buildStop(i) },
    { id: 'gc2', lvl: 12, icon: '🔑', title: 'Şehirde dükkân kirası', price: 15000, at: VSTOP.zone, side: true, req: 'gc1', build: (i) => S().rentShop(i) },
    { id: 'gc', lvl: 14, icon: '🏙️', title: 'Şehir Marketi açılışı', price: 25000, at: VSTOP.zone, side: true, req: 'gc2', build: (i) => unlockRegion('sehir', i) },
    { id: 'sc1', icon: '🥐', title: 'Kahvaltılık rafları', price: 1500, at: [CX + 12, CZ - 5.4], side: true, req: 'gc', build: (i) => S().addShelf('kahve', i) },
    { id: 'sc2', icon: '🍎', title: 'Meyve rafları ve hal', price: 2000, at: [CX, CZ - 5.4], side: true, req: 'gc', build: (i) => { S().addShelf('hal', i); S().addHal(i); } },
    { id: 'sc6', icon: '🧺', title: 'Market rafçısı', price: 1800, at: [CX - 6, CZ + 4.6], side: true, req: 'gc', build: (i) => S().addShelver(i) },
    { id: 'sc3', icon: '🚚', title: 'Büyük köy kamyonu', price: 2500, at: [CX - 18, CZ + 11.6], side: true, req: 'sc1', build: () => S().bigTruck() },
    { id: 'sc4', icon: '🧶', title: 'Hediyelik rafları', price: 2500, at: [CX - 17.5, CZ + 0.4], side: true, req: 'sc2', build: (i) => S().addShelf('hediye', i) },
    { id: 'sc7', icon: '🧾', title: 'İkinci kasa', price: 3000, at: [CX + 16.5, CZ + 6.4], side: true, req: 'gc', build: (i) => S().addRegister2(i) },
    // ikinci rafçı (2026-11-02 kullanıcı: "şehir marketine ekstra rafçı lazım"): ilkinin kilit yerinde, o alınınca görünür
    { id: 'sc8', icon: '🧺', title: 'İkinci market rafçısı', price: 3600, at: [CX - 6, CZ + 4.6], side: true, req: 'sc6', build: (i) => S().addShelver(i) },
    // üçüncü rafçı (2026-11-04, süpermarketin yeni reyonları için): ikincinin kilit yerinde, o alınınca görünür
    { id: 'sc9', icon: '🧺', title: 'Üçüncü market rafçısı', price: 5500, at: [CX - 6, CZ + 4.6], side: true, req: 'sc8', build: (i) => S().addShelver(i) },
  ];
}

// ---------- her kare ----------
function staffTag(o, name) {
  const el = document.createElement('div'); el.className = 'staff'; el.textContent = name;
  return G.labels.add(el, (v) => v.copy(o.position).setY(o.position.y + 2.45));
}
// şehir sahipsiz: oyuncu şehirde değil ve market rafçısı ya da market kasiyeri yok (kimse rafı dolduramaz ya da ödeme alamaz)
const unattended = (R) => G.world !== 'sehir' && !(R.helpers.length && R.cashier);
function updateCity(R, dt) {
  const px = G.player ? G.player.position.x : 0;
  G.world = px > 700 ? 'ada' : px > 300 ? 'sehir' : 'koy'; // Martı Adası x 900 (tatil.js)
  updateTruck(R, dt);
  updateSupply(R, R.halTruck, R.hal, dt);
  updateSupply(R, R.toptanTruck, R.toptan, dt);
  for (const w of R.helpers) w.update(dt);
  for (const { o } of R.cashiers) {
    // kasiyer ödemeyi alır; para tezgahta birikir, oyuncu ya da arabasıyla gelen muhasebeci toplar (tahsilat.js)
    M.animateCharacter(o, 0, dt, false);
    M.workMotion(o, 'kasa', dt, true); // ürünü okutur, yazarkasaya basar
    o.rotation.y = lerpAngle(o.rotation.y, 0, Math.min(1, dt * 6));
  }
  // müşteriler: caddenin iki ucundan gelir, rafta ürün oldukça daha sık
  const md = G.mods || {}; // Büyük Market (expand-east.js): daha çok ve daha sık müşteri
  R.spawnT -= dt * repMul() * (md.cityRate || 1);
  if ((R.groupT = (R.groupT || 0) - dt) <= 0) { R.groupT = 1; for (const k of R.openGroups) R.addShelf(k, G.time < 3); } // gruba sonradan eklenen ürünün rafı
  const u = Math.min(6, R.shelves.length); // tek ürünlü raflar çoğaldı: müşteri sayısı eski bölüm sayısı kadar büyür
  const live = G.customers.filter((c) => c.region === 'sehir').length, max = 3 + u * 2 + (md.cityMax || 0);
  if (unattended(R)) { R.spawnT = Math.max(R.spawnT, 2); return; } // sahipsiz şehre müşteri gelmez; boş rafa kızıp ceza yazdırırlardı
  if (R.spawnT <= 0 && live < max) { R.spawnT = rand(3.5, 6.5); spawnCustomer(R); }
}

// kamyonun kasasındaki mal (2026-11-02 kullanıcı: "markete ürünleri getiren araç boş geliyor"): kasada tahta kasalar, içlerinde
// taşıdığı ürün. Hal kamyonetinde meyve kasaları hep durur; köy kamyonunda yükü kadar kasa, boşalttıkça azalır
const BED_Y = 1.0, BED = [[-0.5, -2.25], [0.5, -2.25], [-0.5, -1.45], [0.5, -1.45], [-0.5, -0.65], [0.5, -0.65]];
function loadBed(truck, types) {
  const crates = [], wood = M.mat('#b07a45');
  types.slice(0, BED.length).forEach((t, i) => {
    const c = new THREE.Group(); c.position.set(BED[i][0], BED_Y, BED[i][1]); truck.add(c);
    M.rbox(0.9, 0.36, 0.72, 0.03, wood, 0, 0.18, 0, c);
    for (let k = 0; k < 4; k++) { const o = makeItem(t); o.scale.multiplyScalar(0.7); o.position.set(-0.2 + (k % 2) * 0.4, 0.4, -0.16 + Math.floor(k / 2) * 0.32); c.add(o); }
    crates.push(c);
  });
  return crates;
}
// köy kamyonu: köyün fazlasını (tepside en az iki tane bekleyen) toplar, depoya boşaltır, nakliyeyi alır
function villageCargo(R, cap) {
  const want = [...new Set(R.shelves.flatMap((s) => s.acc()))].filter((t) => !ITEMS[t] || !ITEMS[t].cost);
  const bag = { full: false, types: [], push(type, obj) { for (let i = G.flights.length - 1; i >= 0; i--) if (G.flights[i].obj === obj) G.flights.splice(i, 1); if (obj && obj.parent) obj.parent.remove(obj); this.types.push(type); this.full = this.types.length >= cap; } };
  const srcs = G.stations.filter((s) => s.zone && s.zone.x < 300 && want.includes(s.type) && ((s.harvestTo && s.ripeCount() >= 2) || (Array.isArray(s.items) && s.max !== undefined && s.items.length >= 2)));
  for (let moved = true; moved && !bag.full;) {
    moved = false;
    for (const s of srcs) { if (bag.full) break; const left = s.harvestTo ? s.ripeCount() : s.items.length; if (left >= 2 && s.give(bag)) moved = true; }
  }
  return bag.types;
}
function updateTruck(R, dt) {
  const T = R.truck, D = R.depot;
  if (!D) return;
  const lane = STREET_Z - 1.6;
  switch (T.state) {
    case 'away':
      T.t -= dt;
      if (T.t > 0) break;
      if (dockBusy(R, T)) { T.t = 3; break; } // hal kamyoneti yanaşmışken gelmez
      T.cargo = D.free > 0 ? villageCargo(R, Math.min(T.cap + truckBonus(), D.free)) : [];
      if (!T.cargo.length) { T.t = 15; break; }
      T.obj = M.model('truck'); T.obj.position.set(CX + 85, 0, lane); T.obj.rotation.y = -PI / 2; G.scene.add(T.obj);
      T.state = 'in'; T.n = T.cargo.length;
      { const kinds = [...new Set(T.cargo)], k = Math.min(BED.length, Math.max(1, Math.ceil(T.n / 3))); T.crates = loadBed(T.obj, Array.from({ length: k }, (_, i) => kinds[i % kinds.length])); }
      break;
    case 'in': {
      const p = T.obj.position; p.x -= dt * 10 * cityGapK(T.obj, -1); // önündeki taşıta ve yaya geçidine göre yavaşlar (sehirhayat.js)
      if (p.x <= DOCK_X + 2) { p.x = DOCK_X + 2; T.state = 'unload'; T.t = 0; }
      break;
    }
    case 'unload':
      T.t += dt;
      if (T.t < 0.12) break;
      T.t = 0;
      if (T.cargo.length && D.put(T.cargo[0], V(T.obj.position.x, 1.6, T.obj.position.z))) { T.cargo.shift(); const left = Math.ceil((T.cargo.length / T.n) * T.crates.length); T.crates.forEach((c, i) => { c.visible = i < left; }); break; }
      // boşaltma bitti (depo doluysa artan köye geri döner): nakliye ödenir
      fine(T.n - T.cargo.length, V(T.obj.position.x, 2.4, T.obj.position.z), '🚚', 'nakliye');
      floatText(V(T.obj.position.x, 3.2, T.obj.position.z), `🚚 Köyden ${T.n - T.cargo.length} ürün geldi`, 'pos');
      T.state = 'out';
      break;
    case 'out': {
      const p = T.obj.position; p.x -= dt * 10 * cityGapK(T.obj, -1); // önündeki taşıta ve yaya geçidine göre yavaşlar (sehirhayat.js)
      if (p.x < CX - 90) { G.scene.remove(T.obj); T.obj = null; T.state = 'away'; T.t = T.every; }
      break;
    }
  }
}

// hal ve toptancı kamyonu (aynı iş, ayrı palet): paletin açık reyonlu türlerini paletin kapasitesine eşit paylarla tamamlar
// (türü başına en az 4), köy kamyonunun şeridinde T.dock'ta durur, palete boşaltır, gider. Toptancı kamyonu süpermarketle gelir
// (setStage 2): kargo aracı, üstünde TOPTAN panosu. Biri yanaşmışken öbürleri gelmez (aynı şeritte birbirinin içinden geçmesinler)
const dockBusy = (R, me) => [R.truck, R.halTruck, R.toptanTruck].some((T) => T && T !== me && T.state !== 'away');
function updateSupply(R, T, P, dt) {
  if (!T || !P) return;
  const lane = STREET_Z - 1.6;
  switch (T.state) {
    case 'away': {
      T.t -= dt;
      if (T.t > 0) break;
      const types = P.types.filter((t) => [...R.openGroups].some((k) => (R.groups[k] || []).includes(t)));
      const max = Math.min(T.cap + truckBonus(), P.free), each = Math.max(4, Math.floor(P.cap / Math.max(1, types.length)));
      const n = (t) => P.count(t) + T.cargo.filter((x) => x === t).length;
      T.cargo = [];
      for (let k = 0; k < each; k++) for (const t of types) if (n(t) < each && T.cargo.length < max) T.cargo.push(t);
      if (!T.cargo.length) { T.t = 12; break; }
      if (dockBusy(R, T)) { T.t = 3; break; }
      T.obj = M.model(T.model || 'truck'); T.obj.position.set(CX + 85, 0, lane); T.obj.rotation.y = -PI / 2; G.scene.add(T.obj);
      T.state = 'in'; T.n = T.cargo.length;
      if (T.model === 'delivery') { const b = toptanBoard(); b.position.set(0, 2.85, 0); b.rotation.y = PI / 2; T.obj.add(b); T.crates = []; }
      else T.crates = loadBed(T.obj, Array.from({ length: Math.min(BED.length, Math.ceil(T.n / 2)) }, (_, i) => T.cargo[(i * 2) % T.n])); // kasada meyve kasaları
      break;
    }
    case 'in': {
      const p = T.obj.position; p.x -= dt * 10 * cityGapK(T.obj, -1); // önündeki taşıta ve yaya geçidine göre yavaşlar (sehirhayat.js)
      if (p.x <= T.dock) { p.x = T.dock; T.state = 'unload'; T.t = 0; }
      break;
    }
    case 'unload':
      T.t += dt;
      if (T.t < 0.12) break;
      T.t = 0;
      if (T.cargo.length && P.put(T.cargo[0], V(T.obj.position.x, 1.6, T.obj.position.z))) { T.cargo.shift(); const left = Math.ceil((T.cargo.length / T.n) * T.crates.length); T.crates.forEach((c, i) => { c.visible = i < left; }); break; }
      floatText(V(T.obj.position.x, 3.2, T.obj.position.z), `${T.label} ${T.n - T.cargo.length} ${T.unit} geldi`, 'pos');
      T.state = 'out';
      break;
    case 'out': {
      const p = T.obj.position; p.x -= dt * 10 * cityGapK(T.obj, -1); // önündeki taşıta ve yaya geçidine göre yavaşlar (sehirhayat.js)
      if (p.x < CX - 90) { G.scene.remove(T.obj); T.obj = null; T.state = 'away'; T.t = T.every; }
      break;
    }
  }
}

// sepet ve alışveriş arabası yükü (world.js'teki köy müşterisininkilerle aynı dizilim; o dosya ortak olduğu için burada da tanımlı):
// sepette küçülüp 2x2 kat, arabanın tabanında 3x2 kat kat dizilir
class TrolleyLoad extends Stack {
  constructor(holder, cap) { super(holder, cap, 0, 0); }
  push(type, obj, dur) { obj.scale.setScalar(0.75); return super.push(type, obj, dur); }
  slot(i) { const k = i % 6; return V(((k % 3) - 1) * 0.16, 0.08 + Math.floor(i / 6) * 0.17, (Math.floor(k / 3) - 0.5) * 0.26); }
  update(dt) { const k = 1 - Math.exp(-12 * dt); this.items.forEach((it, i) => { if (!it.flying) it.obj.position.lerp(this.slot(i), k); }); }
}
class BasketLoad extends Stack {
  constructor(holder, cap) { super(holder, cap, 0, 0); }
  push(type, obj, dur) { obj.scale.setScalar(0.6); return super.push(type, obj, dur); }
  slot(i) { const k = i % 4; return V(((k % 2) - 0.5) * 0.2, 0.13 + Math.floor(i / 4) * 0.15, (Math.floor(k / 2) - 0.5) * 0.15); }
  update(dt) { const k = 1 - Math.exp(-12 * dt); this.items.forEach((it, i) => { if (!it.flying) it.obj.position.lerp(this.slot(i), k); }); }
}
// şehir müşterisi: kaldırımdan kapıya, bir iki reyondan alır, kasada öder (ürün fiyatının 1,5 katı), caddeden gider
function spawnCustomer(R) {
  const stocked = R.shelves.filter((s) => s.count() > 0), pool = (stocked.length ? stocked : R.shelves).slice().sort(() => Math.random() - 0.5);
  const steps = pool.slice(0, Math.random() < 0.6 ? 1 : 2).map((sh) => {
    const want = pick(sh.types().length ? sh.types() : sh.acc());
    return { shelf: sh, want, need: ITEMS[want].price >= 20 ? 1 : 1 + Math.floor(Math.random() * 2), got: 0, spot: null };
  });
  if (!steps.length) return;
  // iki kaldırımdan gelir (2026-11-11 kullanıcı: "müşteriler markete tek yönden geliyor, çeşitlendir, tek yolda kuyruklar oluşmasın"):
  // kuzey kaldırımındaki caddeyi geçmez, güneydeki yaya geçidinin bir yerinden geçer; kapının batı yarısından girer, doğu yarısından çıkar
  const east = Math.random() < 0.5, north = Math.random() < 0.5;
  const c = new Customer(V(CX + (east ? 76 : -76), 0, (north ? WALK_N : WALK_S) + rand(-0.3, 0.3)), 'sehir', cityLook()); // şehirli giyimi (sehirhayat.js)
  // çok ürün alan elinde değil sepette ya da arabada taşır (köydeki gibi; 2026-11-02 kullanıcının isteği şehirde de): 4+ ürün arabayla,
  // 2-3 ürün sepetle
  const total = steps.reduce((n, s) => n + s.need, 0);
  if (total >= 4) {
    const t = M.makeTrolley(); t.position.set(0, 0, 0.78); c.obj.add(t);
    c.stack = new TrolleyLoad(t.userData.bin, 14); c.alwaysCarry = true; c.basketMode = true; c.trolley = c.carrier = t;
  } else if (total >= 2) {
    const b = M.makeBasket(); b.position.set(0, 0.78, 0.36); c.obj.add(b); // karakter %90: kolların hizası
    c.stack = new BasketLoad(b, 9); c.alwaysCarry = true; c.basketMode = true; c.carrier = b;
  }
  // oyuncu ayrılınca içeride kalan müşteri kızarak gitse de şehir sahipsizse ceza yazılmaz (account.js c.fined)
  const mood0 = c.mood.bind(c); c.mood = (happy) => { if (!happy && unattended(R)) c.fined = true; mood0(happy); };
  let i = 0, st = null, last = null;
  c.got = 0; c.bill = 0; c.state = 'in';
  const exitX = CX + (Math.random() < 0.5 ? 76 : -76), exitN = Math.random() < 0.5;
  const zebra = () => rand(ZEBRA[0] + 0.6, ZEBRA[1] - 0.6), inX = CX + rand(-2.4, -0.5), outX = CX + rand(0.5, 2.4), zx = zebra();
  const lane = (sh) => (sh.zone.z > AISLE + 2 ? sh.zone.z + 0.8 : AISLE); // rafın önündeki yürüme hattı: arka sıra ve reyonun kuzey yüzü koridorda
  c.path = north ? [V(inX, 0, WALK_N), V(inX, 0, FRONT_Z - 1.6)] : [V(zx, 0, WALK_S), V(zx, 0, WALK_N), V(inX, 0, FRONT_Z - 1.6)]; // caddeyi yaya geçidinden geçer (barselona.js ZEBRA)
  const bubble = () => { c.want = st.want; c.setBubble(st.want, Math.max(1, st.need - st.got)); if (c.basketMode) c.bEl.classList.add('basket'); };
  const leave = () => {
    c.state = 'leave'; c.leaving = true;
    const zo = zebra(), out = [V(outX, 0, FRONT_Z - 1.4), V(outX, 0, WALK_N + 0.4)];
    c.path = exitN ? [...out, V(exitX, 0, WALK_N + 0.4)] : [...out, V(zo, 0, WALK_N + 0.4), V(zo, 0, WALK_S), V(exitX, 0, WALK_S)];
  };
  const toQueue = () => {
    c.clearBubble();
    if (!c.got) { if (c.tried) c.mood(false); leave(); return; } // hiçbir rafın önünde yer bulamadıysa (tried yok) kızmaz: kusur dükkânda değil
    const ln = lane(last || steps[0].shelf); // son durduğu rafın önünden kasaya (sıradaki rafın önü doluysa st boş kalır)
    // çalışan kasalardan (kasiyeri olan ya da başında senin durduğun) kuyruğu kısa olanı seçer; hiçbiri çalışmıyorsa birinci kasa
    const regs = R.registers || [R.register], live = regs.filter((r) => r.cashier || r.inside);
    const reg = c.reg = (live.length ? live : [R.register]).reduce((a, b) => (b.queue.length < a.queue.length ? b : a));
    reg.join(c); c.path = [V(c.obj.position.x, 0, ln), V(LANE, 0, ln), V(LANE, 0, CZ + 5.2)]; c.state = 'toQueue';
    if (reg !== R.register) c.path.push(V(reg.zone.x - 2.2, 0, CZ + 5.2)); // birinci kuyruğun önünden geçip kendi kasasına
  };
  const goStep = () => {
    st = steps[i];
    if (!st) { toQueue(); return; }
    st.spot = st.shelf.spots.find((q) => !q.c);
    if (!st.spot) { i++; goStep(); return; } // reyonun önü dolu: sıradakine geçer
    st.spot.c = c; last = st.shelf; c.tried = true;
    const ln = lane(st.shelf);
    c.path = [V(LANE, 0, c.obj.position.z), V(LANE, 0, ln), V(st.spot.p.x, 0, ln), st.spot.p.clone()];
    c.state = 'toShelf'; bubble();
  };
  c.onPaid = () => { c.mood(true); leave(); };
  const patience = 32;
  c.think = (dt) => {
    switch (c.state) {
      case 'in': if (c.walk(dt)) goStep(); break;
      case 'toShelf': if (c.walk(dt)) { c.state = 'shelf'; c.wait = 0; c.t = 0; } break;
      case 'shelf':
        c.face(st.shelf.faceY ?? PI, dt);
        c.wait += dt; c.t += dt;
        c.setPatience(1 - c.wait / patience);
        if (c.t > 0.35) {
          c.t = 0;
          const obj = st.got < st.need && !c.stack.full && st.shelf.takeType(st.want);
          if (obj) { mineFx(c, obj); c.bill += priceOf(st.want, obj, Math.round(ITEMS[st.want].price * PREMIUM())); c.stack.push(st.want, obj, 0.3); st.got++; c.got++; bubble(); } // kendi dizdiğin ürün fazla satılır
        }
        if (st.got >= st.need || c.stack.full || c.wait > patience) { st.spot.c = null; i++; if (i >= steps.length || c.stack.full) toQueue(); else goStep(); }
        break;
      case 'toQueue': if (c.walk(dt)) c.state = 'queue'; break;
      case 'queue': { // yerinde bekler, sıra ilerleyince ağır adımla geçer (game.js)
        const reg = c.reg || R.register, px = G.player.position.x;
        // kasasında kimse yoksa ve çalışan başka kasa varsa 8 sn sonra oraya geçer (eskiden ilk seçtiği kasada bekliyordu; köyde world.js qDead)
        if (!(reg.cashier || reg.inside) && !(reg.sale && reg.sale.c === c)) {
          if ((c.qDead = (c.qDead || 0) + dt) > 8) {
            c.qDead = 0;
            const alt = (R.registers || [R.register]).filter((r) => r !== reg && (r.cashier || r.inside));
            if (alt.length) { reg.leave(c); c.qIdle = 0; toQueue(); break; } // toQueue çalışan kasalardan kuyruğu kısayı seçer
          }
        } else c.qDead = 0;
        // kasada kimse yokken ve sen şehirde değilken (otobüsle köye döndün) 25 sn bekleyen müşteri sırayı bırakıp gider: yoksa sonsuza
        // dek bekleyip köy, pazar ve sahilin müşteri payını tüketiyordu (rating.js crowd). Sen şehirdeyken eskisi gibi bekler
        if (!(reg.cashier || reg.inside) && !(reg.sale && reg.sale.c === c) && (px < 300 || px > 700)) {
          if ((c.qIdle = (c.qIdle || 0) + dt) > 25) { reg.leave(c); leave(); break; }
        } else c.qIdle = 0;
        queueStep(c, reg, dt, PI); break;
      }
      case 'leave': if (c.walk(dt)) c.destroy(); break;
    }
  };
}

// market rafçısı: boşalan reyonları doldurur. Malı depodan (köy kamyonunun getirdiği), tost makinesinin tepsisinden ve haldan
// (meyve; parası kasadan, para yetiyorsa) alır, tost makinesine depodaki ekmeği koyar; iş yoksa deponun yanında bekler.
// 2026-11-02 kullanıcı: "rafçı ve kasiyer sağlıklı çalışmıyor, şehir marketine ekstra rafçı lazım": eskiden yalnız depoya bakıyordu,
// meyve ve tost rafları hep boş kalıyor, müşteri boş rafın önünde bekleyip alışverişsiz gidiyordu (kasiyer de boşta kalıyordu).
// Beklediği yer sonradan kurulan tost makinesinin masasının içinde kalmıştı. İkinci rafçı sc8 ile gelir; ikisi aynı rafa gitmez
const toasterOf = () => { const x = (G.xsink || []).find((k) => k.type === 'ekmek' && k.conv && k.conv.zone.x > 300); return x && x.conv; };
class CityShelver {
  constructor(R, instant, n = 0) {
    this.R = R; this.n = n;
    this.obj = M.makeCharacter(n ? { shirt: '#2f8fd8', pants: '#2a2a2a', hat: 'cap', hatColor: '#ffffff', skin: '#c68e5f', mustache: true } : { shirt: '#3fae6b', pants: '#2a2a2a', hat: 'cap', hatColor: '#ffffff', skin: '#e0b48a' });
    this.home = V(DOCK_X + 1.6 - n * 1.3, 0, CZ + 7.6); // deponun güneyi, tost makinesinin batısı
    this.obj.position.copy(this.home); G.scene.add(this.obj); if (!instant) popIn(this.obj);
    this.stack = new Stack(this.obj, 8, 0.95, 0.45); // bir seferde 8 ürün (5 idi; kalabalık markette raflar dolar dolmaz boşalıyordu)
    this.path = []; this.state = 'decide'; this.t = 0; this.moving = false; this.n2 = 8;
    staffTag(this.obj, n ? `Market rafçısı ${n + 1}` : 'Market rafçısı');
  }
  walk(dt) {
    const p = this.obj.position;
    // her yeni bacak paletlerin, deponun, kasanın ve reyon uçlarının etrafından dolanır (müşterideki A*; yollar önbellekli, world.js)
    if (this.path.length && this.path[0] !== this.leg && !this.path[0].via && G.hooks.route) {
      const r = G.hooks.route(p, this.path[0], false);
      if (r.length > 1) { r.pop(); for (const q of r) q.via = true; this.path.unshift(...r); }
    }
    if (this.path.length) this.leg = this.path[0];
    while (this.path.length) {
      const d = this.path[0], dx = d.x - p.x, dz = d.z - p.z, dist = Math.hypot(dx, dz), st = 3.6 * dt; // 2,9 idi: 27 rafa yetişemiyordu
      if (dist <= st) { p.x = d.x; p.z = d.z; this.path.shift(); continue; }
      p.x += (dx / dist) * st; p.z += (dz / dist) * st;
      this.obj.rotation.y = lerpAngle(this.obj.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
      this.moving = true;
      return false;
    }
    return true;
  }
  go(state, path) { this.state = state; this.path = path; this.t = 0; }
  // marketin orta koridoruna (LANE - 2, CZ + 2) çıkış: haldaysa kapıdan girer, reyonlardaysa önündeki hattan, depo yanındaysa doğrudan
  inPts() {
    const p = this.obj.position;
    if (p.z > FRONT_Z - 0.5) return [V(CX - 1.2, 0, WALK_N), V(CX - 1.2, 0, FRONT_Z - 1.6), V(LANE - 2, 0, CZ + 2)];
    return p.x > DOCK_X + 3 ? [V(LANE - 2, 0, p.z), V(LANE - 2, 0, CZ + 2)] : [V(LANE - 2, 0, CZ + 2)];
  }
  // tost makinesinin önündeki alanlar (girdi ve çıktı) makinenin güneyinde: orta koridordan güneye inip batıya yürünür
  toTable(zone) {
    const p = this.obj.position, z = zone.z + 0.2;
    if (p.x < DOCK_X + 3 && p.z < FRONT_Z - 0.5) return [V(DOCK_X + 2.6, 0, z), V(zone.x + rand(-0.4, 0.4), 0, z)];
    return [...this.inPts(), V(LANE - 2, 0, z), V(zone.x + rand(-0.4, 0.4), 0, z)];
  }
  // bir türün raflardaki boş yeri (elindekiler ve öbür rafçının taşıdığı düşülür)
  room(t) {
    const R = this.R, mates = R.helpers.filter((h) => h !== this);
    return R.shelves.reduce((a, s) => a + (s.hasSpaceFor(t) ? s.slots.filter((x) => !x).length : 0), 0) - this.stack.count(t) - mates.reduce((a, m) => a + m.stack.count(t) + (m.want && m.want.length === 1 && m.want[0] === t && /toDepot|take|toHal|buy/.test(m.state) ? m.n2 : 0), 0);
  }
  // paletten (hal ya da toptan) alınacak mal: palette olup reyonda boş yeri en çok olan tür ve paleti
  wholesale() {
    const R = this.R;
    let best = null, n = 0;
    for (const P of [R.hal, R.toptan]) if (P) for (const t of P.types) { const k = Math.min(this.room(t), P.count(t)); if (k > n) { n = k; best = [P, t]; } }
    return best;
  }
  decide() {
    const R = this.R, D = R.depot, st = this.stack, p = this.obj.position, tc = toasterOf();
    const mates = R.helpers.filter((h) => h !== this);
    const open = R.shelves.filter((s) => s.slots.includes(null));
    const room = (t) => open.some((s) => s.hasSpaceFor(t));
    this.n2 = st.cap;
    // tost makinesine götürülen ekmek
    if (this.forToaster && st.count('ekmek') && tc && tc.input.length < tc.cap) return this.go('toFeed', this.toTable(tc.zone));
    this.forToaster = false;
    // 1) elindekini en yakın rafa (öbür rafçının gittiği rafa değil)
    const fits = (s) => st.items.some((it) => s.hasSpaceFor(it.type)), near = (a, b) => Math.hypot(a.zone.x - p.x, a.zone.z - p.z) - Math.hypot(b.zone.x - p.x, b.zone.z - p.z);
    const cands = st.items.length ? open.filter(fits).sort(near) : [];
    const sh = cands.find((s) => !mates.some((m) => m.target === s)) || cands[0];
    if (sh) {
      this.target = sh;
      const ln = sh.zone.z > AISLE + 2 ? sh.zone.z + 1.2 : AISLE, mid = [V(LANE - 2, 0, ln)]; // arka sıra ve kuzey yüz koridordan
      return this.go('toShelf', [...this.inPts(), ...mid, V(sh.zone.x, 0, ln), V(sh.zone.x + rand(-0.6, 0.6), 0, sh.zone.z)]);
    }
    this.target = null; this.src = null;
    if (!st.full) {
      // 2) tost tepsisindeki tost
      if (tc && tc.out.items.length && room('tost') && !mates.some((m) => m.src === tc.out)) {
        this.src = tc.out; this.n2 = Math.min(st.cap, st.count('tost') + tc.out.items.length);
        return this.go('toSrc', this.toTable(tc.out.zone));
      }
      // 3) tost makinesi aç kalmasın: depodaki ekmekten makineye (ekmek rafı boşsa önce raf)
      const ekD = D.items.filter((x) => x.type === 'ekmek').length;
      if (tc && tc.input.length < 2 && ekD && (ekD >= 2 || !room('ekmek')) && !mates.some((m) => m.forToaster)) {
        this.forToaster = true; this.want = ['ekmek']; this.n2 = Math.min(st.cap, st.count('ekmek') + 3);
        return this.go('toDepot', [...this.inPts(), V(D.zone.x + rand(-0.5, 0.5), 0, D.zone.z)]);
      }
      // 4) depodaki köy malı: eli dolana dek, raflarda en çok boşalan türlerden (depoda çoğu türden bir iki tane olur); sonra en yakın
      // raftan başlayıp dizer
      const kinds = [...new Set(D.items.map((x) => x.type))].map((t) => [t, this.room(t)]).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]);
      const ws = this.wholesale(), wsOk = ws && G.money > 300 && !mates.some((m) => m.state === 'toHal' || m.state === 'buy');
      if (kinds.length && !(wsOk && this.lastSrc === 'depo')) { this.lastSrc = 'depo'; this.want = kinds.map(([t]) => t); this.n2 = Math.min(st.cap, kinds.reduce((a, [, k]) => a + k, 0)); return this.go('toDepot', [...this.inPts(), V(D.zone.x + rand(-0.5, 0.5), 0, D.zone.z)]); }
      // 5) hal ya da toptan paletinden: para yetiyorsa, tek rafçı gider, tek türden eli dolana dek alır;
      // depoyla sırayla gider (depoda köy malı hep olduğundan paletlere hiç sıra gelmiyordu)
      if (wsOk) {
        const [P, ft] = ws; this.pal = P; this.lastSrc = 'palet';
        this.want = [ft]; this.n2 = Math.min(st.cap, this.room(ft));
        return this.go('toHal', [...this.inPts(), V(P.zone.x + rand(-0.5, 0.5), 0, P.zone.z)]); // paletler marketin içinde
      }
    }
    // iş yok: deponun yanında bekler (tost makinesinin güneyinden dolanır)
    const back = p.z > FRONT_Z - 0.5 || p.x > DOCK_X + 3 ? [...this.inPts(), V(LANE - 2, 0, CZ + 8.6), V(this.home.x, 0, CZ + 8.6)] : [];
    this.go('idle', [...back, V(this.home.x + rand(-0.4, 0.4), 0, this.home.z + rand(-0.3, 0.3))]); this.t = 2;
  }
  update(dt) {
    this.moving = false;
    const R = this.R, D = R.depot, st = this.stack;
    switch (this.state) {
      case 'decide': this.decide(); break;
      case 'toDepot': if (this.walk(dt)) this.go('take', []); break;
      case 'take': this.t += dt; if (this.t > 0.2) { this.t = 0; if (st.full || st.items.length >= this.n2 || !D.give(st, this.want)) this.state = 'decide'; } break;
      case 'toSrc': if (this.walk(dt)) this.go('takeSrc', []); break;
      case 'takeSrc': this.t += dt; if (this.t > 0.25) { this.t = 0; if (st.full || st.items.length >= this.n2 || !this.src.give(st)) { this.src = null; this.state = 'decide'; } } break;
      case 'toHal': if (this.walk(dt)) this.go('buy', []); break;
      case 'buy': {
        this.t += dt;
        if (this.t < 0.3) break;
        this.t = 0;
        const t = this.want && this.want[0];
        if (!t || st.full || st.count(t) >= this.n2 || G.money < 300 + ITEMS[t].cost || (this.pal || R.hal).buyTo(st, t) !== 'ok') this.state = 'decide';
        break;
      }
      case 'toShelf': if (this.walk(dt)) this.go('put', []); break;
      case 'put': this.t += dt; if (this.t > 0.2) { this.t = 0; if (!this.target.putFrom(st)) this.state = 'decide'; } break;
      case 'toFeed': if (this.walk(dt)) this.go('feed', []); break;
      case 'feed': { this.t += dt; if (this.t > 0.2) { this.t = 0; const c = toasterOf(); if (!c || !c.putFrom(st)) { this.forToaster = false; this.state = 'decide'; } } break; }
      case 'idle': this.walk(dt); this.t -= dt; if (this.t <= 0) this.state = 'decide'; break;
    }
    M.animateCharacter(this.obj, this.moving ? 1 : 0, dt, st.items.length > 0);
    st.update(dt);
  }
}
