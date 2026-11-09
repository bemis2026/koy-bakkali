// Sahil mutfağı (2026-11-05 kullanıcı: "domatesi sadece rafa değil başka yerlere de koyabilelim elimizde sadece rafını beklemeyelim
// atıyorum domates püremakinesine koyalım yanda püre rafı olabilir ... bunu diğer ürünler içinde kurgulayabilirsin"; seçtikleri: domates
// püresi, karpuz suyu, menemen; her biri kilit alanıyla satın alınır). Üç tezgâh köy bostanlarının hemen güneyinde, kumsalın kuzey
// şeridinde yan yana: solda makine (girdi masası solda, çıktı sağda), yanında kendi vitrini ve kasası. Vitrine kumsaldaki tatilciler
// gelir, parası tezgâhın kasasına düşer. Köyde ve pazarda makinelik boş yer kalmadığı için ham ürünün bölgesi yerine burada
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, MoneyPile, Customer, floatText, rand, mult, priceOf, mineFx } from './game.js';
import { makeAisle } from './reyon.js';
import { defineExpansion } from './expand.js';
import { repMul } from './rating.js';
import { Mixer } from './expand-west.js';
import { workTable } from './mobilya.js';
import { texRep } from './tex.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- ürünler ----------
function makePure() { // domates püresi: kırmızı karton kutu, beyaz bant, yeşil kapak
  const g = new THREE.Group();
  M.rbox(0.18, 0.26, 0.12, 0.02, M.mat('#d8342c'), 0, 0.13, 0, g);
  M.rbox(0.185, 0.07, 0.125, 0.01, M.mat('#ffffff'), 0, 0.15, 0, g);
  M.sph(0.035, M.mat('#c8102e'), 0, 0.15, 0.064, g, 8, 6); // etiketteki domates
  M.cyl(0.025, 0.025, 0.03, 8, M.mat('#3f9a4f'), 0.04, 0.275, 0, g);
  g.userData.h = 0.29;
  return g;
}
function makeKarpuzSuyu() { // karpuz suyu: cam şişede pembe-kırmızı su, yeşil kapak, karpuz dilimi etiketi
  const g = new THREE.Group();
  M.cyl(0.065, 0.065, 0.24, 12, M.mat('#f25c6e', { rough: 0.2 }), 0, 0.12, 0, g);
  M.cyl(0.067, 0.067, 0.07, 12, M.mat('#3f9a4f'), 0, 0.12, 0, g);
  M.cyl(0.03, 0.06, 0.06, 10, M.mat('#f25c6e', { rough: 0.2 }), 0, 0.27, 0, g);
  M.cyl(0.032, 0.032, 0.03, 10, M.mat('#2f7d3a'), 0, 0.315, 0, g);
  g.userData.h = 0.33;
  return g;
}
function makeMenemen() { // menemen: bakır sahanda domatesli yumurta, iki kulp
  const g = new THREE.Group(), cu = M.mat('#b8693a', { rough: 0.35 });
  M.cyl(0.19, 0.16, 0.07, 16, cu, 0, 0.035, 0, g);
  M.cyl(0.175, 0.175, 0.02, 16, M.mat('#e2552f'), 0, 0.07, 0, g);
  for (const [x, z] of [[-0.06, 0.04], [0.07, -0.03], [0, -0.09]]) M.cyl(0.045, 0.045, 0.015, 10, M.mat('#f5c542'), x, 0.083, z, g);
  M.sph(0.018, M.mat('#3f9a4f'), 0.09, 0.085, 0.07, g, 6, 4); // biber
  for (const x of [-0.22, 0.22]) M.rbox(0.06, 0.03, 0.05, 0.01, cu, x, 0.055, 0, g);
  g.userData.h = 0.1;
  return g;
}
ITEMS.pure = { name: 'Domates püresi', price: 16, fn: makePure };     // iki domatesten bir kutu
ITEMS.karpuzsuyu = { name: 'Karpuz suyu', price: 12, fn: makeKarpuzSuyu }; // bir karpuzdan iki şişe
ITEMS.menemen = { name: 'Menemen', price: 36, fn: makeMenemen };     // yumurta, domates ve biberden

// ---------- makineler ----------
function makePureMakinesi() { // çelik kazanlı püre makinesi: hunisinde domatesler, yanda kol, önde lüle
  const g = new THREE.Group(), steel = M.mat('#c9d1d8', { rough: 0.3 });
  M.rbox(1.4, 0.7, 1.0, 0.06, M.mat('#8a5a33'), 0, 0.35, 0, g);
  M.cyl(0.45, 0.4, 0.7, 16, steel, 0, 1.05, 0, g);
  M.cyl(0.55, 0.42, 0.22, 16, steel, 0, 1.5, 0, g, true); // huni
  for (const [x, z] of [[-0.15, 0.1], [0.15, -0.05], [0, 0.18], [0.12, 0.15]]) M.sph(0.11, M.mat('#d8342c'), x, 1.52, z, g, 10, 8);
  M.rbox(0.06, 0.06, 0.5, 0.02, M.mat('#3d4552'), 0.5, 1.2, 0, g).rotation.x = 0.5; // kol
  M.cyl(0.05, 0.05, 0.3, 8, steel, 0, 0.9, 0.5, g).rotation.x = PI / 2; // lüle
  return g;
}
function makeSikacak() { // karpuz sıkacağı: tezgâhta musluklu büyük cam fanus, kesik karpuz yarımları
  const g = new THREE.Group();
  M.rbox(1.6, 0.8, 1.0, 0.06, M.mat('#2a8fd4'), 0, 0.4, 0, g);
  M.rbox(1.7, 0.06, 1.1, 0.02, M.mat('#ffffff'), 0, 0.82, 0, g);
  M.cyl(0.32, 0.32, 0.7, 16, M.mat('#f25c6e', { rough: 0.15 }), -0.3, 1.2, 0, g);
  M.cyl(0.34, 0.34, 0.06, 16, M.mat('#dfe6ec'), -0.3, 1.58, 0, g);
  M.cyl(0.04, 0.04, 0.16, 8, M.mat('#c9d1d8'), -0.3, 0.98, 0.36, g).rotation.x = PI / 2; // musluk
  for (const x of [0.35, 0.62]) { // yarım karpuzlar
    M.sph(0.2, M.mat('#3f9a4f'), x, 0.9, 0.05, g, 12, 8).scale.y = 0.6;
    M.cyl(0.19, 0.19, 0.02, 12, M.mat('#e8404f'), x, 1.02, 0.05, g);
  }
  return g;
}
function makeOcak() { // menemen ocağı: tuğla ocak, üstünde iki sahan, közün turuncusu
  const g = new THREE.Group();
  M.rbox(1.6, 0.8, 1.0, 0.06, M.mat('#a4553a'), 0, 0.4, 0, g);
  M.rbox(0.5, 0.25, 0.05, 0.02, M.mat('#ff8a3d', { emissive: '#ff6a00', ei: 0.8 }), 0, 0.35, 0.51, g);
  M.rbox(1.62, 0.06, 1.02, 0.02, M.mat('#3d4552'), 0, 0.82, 0, g);
  for (const x of [-0.4, 0.4]) { const s = makeMenemen(); s.scale.setScalar(1.6); s.position.set(x, 0.85, 0); g.add(s); }
  return g;
}

// ---------- vitrin müşterisi: kumsaldan gelir, vitrinden bir ürün alır, parasını tezgâhın kasasına bırakır, kumsala döner ----------
function cashBox(c, x, z) {
  c.put(M.rbox(1.12, 0.86, 1.02, 0.06, M.mat('#5d6b78')), x, 0.43, z);
  c.put(M.rbox(1.18, 0.07, 1.08, 0.03, M.mat('#38424c')), x, 0.885, z);
  const body = c.col(x - 0.56, x + 0.56, z - 0.51, z + 0.51);
  const P = new MoneyPile(c.group, x, z, 0.92, { desk: false, body, instant: c.instant });
  P.spot = { x, y: 0, z: z - 1, ry: 0 }; // muhasebeci arkadan (kuzeyden) gelir
  return P;
}
const SHOPS = [];
function shopCustomer(S) {
  const sh = S.vitrin; if (!sh || !sh.count(S.type)) return;
  const spot = sh.spots.find((q) => !q.c); if (!spot) return;
  const from = () => V(sh.zone.x + rand(-2.5, 2.5), 0, 24.5); // kumsalın ortası, şezlongların önü
  const c = new Customer(from(), 'sahil', Math.random() < 0.7 ? M.touristLook() : M.villagerLook());
  spot.c = c; S.busy++;
  c.state = 'go'; c.path = [spot.p.clone()]; c.want = S.type; c.setBubble(S.type, 1);
  const done = () => { if (spot.c === c) spot.c = null; S.busy--; c.clearBubble(); c.state = 'leave'; c.leaving = true; c.path = [from()]; };
  c.think = (dt) => {
    if (c.state === 'go') { if (c.walk(dt)) { c.state = 'pick'; c.t = 0; } }
    else if (c.state === 'pick') {
      c.face(sh.faceY ?? PI, dt); c.t += dt;
      if (c.t > 1.1) {
        const obj = sh.takeType(S.type);
        if (obj) { mineFx(c, obj); c.stack.push(S.type, obj, 0.3); const pay = Math.round(priceOf(S.type, obj) * mult()); S.pile.add(pay, c.obj.position); floatText(c.obj.position, `${S.icon} +${pay} ₺`, 'pos'); c.mood(true); G.stats.customers++; }
        done();
      }
    } else if (c.state === 'leave' && c.walk(dt)) c.destroy();
  };
}
export function updateMutfak(dt) {
  for (const S of SHOPS) if (S.vitrin && (S.t -= dt * repMul()) <= 0) { S.t = rand(7, 12); if (S.busy < 2) shopCustomer(S); }
}

// tezgâh: x makinenin ortası; makine z 15,6'da (ahşap gezinti yolunun hemen güneyinde, kumda; yol açık kalır), ön alanları kumsala
// bakar (z 18); vitrin makinenin doğusunda, kasa onun yanında. Kumsal şeridinde çöp kutusu (-13,4), palmiye (-4, 18), BÜFE tabelası (12,5)
// ve büfe (30,4-42,4) arasındaki üç boşlukta: püre köy tarafında, menemen ortada, karpuz suyu büfenin doğusunda (parası büfenin kasasına)
const Z = 15.6;
function stall(c, x, type, icon, conv, hintIn, hintTxt, pile) {
  G.xsink = G.xsink || [];
  c.src(type, conv.out);
  c.hint(x - 2, 2.2, Z + 2.4, hintIn, ITEMS[type].name, hintTxt, 3.4);
  const A = makeAisle({}, { content: c.group, put: (p, o, ax, y, z, ry) => c.put(o, ax, y, z, ry), rcol: (_, ...a) => c.col(...a), places: { [type]: [x + 4.6, Z + 0.6, 1, 2.0] },
    w: 2.0, tagColor: '#e0702a', place: 'sahil', back: 0.5, look: () => 2, shallow: true }); // karpuz suyu soğutucusu sığ: arkası gezinti yoluna taşmaz
  const own = pile ? null : cashBox(c, x + 7.0, Z + 0.8);
  const S = { type, icon, vitrin: A.ensure(type, c.instant), get pile() { return own || pile(); }, t: rand(3, 6), busy: 0 };
  G.xsell.push({ type, list: null, shelf: () => S.vitrin });
  SHOPS.push(S);
}
function machineAt(c, model, x) {
  c.put(model, x, 0, Z);
  const wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
  for (const dx of [-2, 2]) c.put(workTable(1.2, 0.8, 0.8, wood), x + dx, 0.4, Z + 1.2);
  c.col(x - 2.7, x + 2.7, Z - 0.9, Z + 1.7);
}

const PURE_X = 1.5, MEN_X = 18.5, SUYU_X = 46;
defineExpansion({ id: 'xmutfak1', region: 'sahil', chain: 'mutfak1', tier: 1, lvl: 5, icon: '🥫', title: 'Püre Makinesi', price: 1600, rect: null, at: [PURE_X, Z + 2.2],
  info: { text: 'Kumsala domates püresi tezgâhı kuruldu.', steps: [['domates', 'Domatesi makinenin soldaki masasına bırak: iki domates bir kutu püre olur.'], ['pure', `Püreyi yanındaki vitrine diz; kumsaldakiler gelip alır. Kutusu ${ITEMS.pure.price} ₺.`]] },
  build: (c) => {
    const conv = c.machine(makePureMakinesi(), PURE_X, Z, 'domates', 'pure', 4.5, { need: 2 }); // iki domates bir kutu
    stall(c, PURE_X, 'pure', '🥫', conv, c.icon('domates'), 'Domates bırak: iki domates bir kutu püre olur. Rafa sığmayan domatesi buraya getir.');
  } });
defineExpansion({ id: 'xmutfak2', region: 'sahil', chain: 'mutfak2', tier: 1, lvl: 6, icon: '🍉', title: 'Karpuz Suyu', price: 2200, rect: null, at: [SUYU_X, Z + 2.2],
  info: { text: 'Kumsala karpuz suyu tezgâhı kuruldu.', steps: [['karpuz', 'Karpuzu sıkacağın soldaki masasına bırak: bir karpuz iki şişe karpuz suyu olur.'], ['karpuzsuyu', `Şişeleri yanındaki soğutucuya diz; kumsaldakiler gelip alır, parası büfenin kasasına düşer. Şişesi ${ITEMS.karpuzsuyu.price} ₺.`]] },
  build: (c) => {
    const conv = c.machine(makeSikacak(), SUYU_X, Z, 'karpuz', 'karpuzsuyu', 4.0, { per: 2 }); // bir karpuz iki şişe
    stall(c, SUYU_X, 'karpuzsuyu', '🍉', conv, c.icon('karpuz'), 'Karpuz bırak: bir karpuz iki şişe karpuz suyu olur.', () => G.regions.sahil.pile); // büfenin kasası
  } });
defineExpansion({ id: 'xmutfak3', region: 'sahil', chain: 'mutfak3', tier: 1, lvl: 8, icon: '🍳', title: 'Menemen Ocağı', price: 3000, rect: null, at: [MEN_X, Z + 2.2],
  info: { text: 'Kumsala menemen ocağı kuruldu.', steps: [['yumurta', 'Yumurta, domates ve biberi ocağın soldaki masasına bırak: üçü bir araya gelince menemen pişer.'], ['menemen', `Menemeni yanındaki vitrine diz; kumsaldakiler kahvaltıya gelir. Sahanı ${ITEMS.menemen.price} ₺.`]] },
  build: (c) => {
    machineAt(c, makeOcak(), MEN_X);
    const conv = new Mixer(c.group, { recipe: ['yumurta', 'domates', 'biber'], ix: MEN_X - 2, iz: Z + 2.4, iw: 2.2, id: 1.3, inTray: [MEN_X - 2, 0.86, Z + 1.2], instant: c.instant,
      out: { type: 'menemen', interval: 6.0, max: 6, origin: V(MEN_X, 1.4, Z), tray: [MEN_X + 2, 0.86, Z + 1.2], zx: MEN_X + 2, zz: Z + 2.4, zw: 2.2, zd: 1.3 } });
    for (const t of conv.recipe) G.xsink.push({ type: t, conv, pri: 3 });
    (G.xgens.xmutfak3 || (G.xgens.xmutfak3 = [])).push(conv.out); // menüde hız ve tepsi yükseltmesi
    stall(c, MEN_X, 'menemen', '🍳', conv, c.icon('yumurta') + c.icon('domates') + c.icon('biber'), 'Yumurta, domates ve biber bırak: üçü bir araya gelince menemen olur.');
  } });
