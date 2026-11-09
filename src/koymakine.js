// Köy dükkânının makineleri (2026-11-05 kullanıcı: "alan büyüyünce açılan alana bir şeyler eklenebilir olmalı bu yeni eklediğimiz püre
// makinesi gibi mantıkta olabilir"; seçtikleri: çekirdek kavurma, salata barı, köz kavanozu, kabak tatlısı). Büyük köy marketinin
// (dukkan.js 4. aşama) açtığı doğu şeridinde dört makine alt alta durur, her biri kendi kilidiyle açılır. Makine şeridin doğu kenarında
// dükkânın içine (batıya) bakar; önünde arkada (kuzeyde) girdi masası, önde (güneyde) çıktı masası, ön alanları raflarla makineler
// arasındaki koridorda. Ürün dükkânın ön sırasındaki kendi rafında satılır (world.js KOY_PLACES), parası dükkânın kasasına
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, Converter } from './game.js';
import { defineExpansion } from './expand.js';
import { Mixer } from './expand-west.js';
import { workTable } from './mobilya.js';
import { texRep } from './tex.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- ürünler ----------
function makeCekirdek() { // çekirdek paketi: sarı kese kâğıdı, siyah bant, kıvrık ağız, önünde ayçiçeği göbeği
  const g = new THREE.Group();
  M.rbox(0.2, 0.24, 0.1, 0.02, M.mat('#f2c230'), 0, 0.12, 0, g);
  M.rbox(0.205, 0.05, 0.105, 0.01, M.mat('#2b2b2b'), 0, 0.08, 0, g);
  M.rbox(0.19, 0.04, 0.08, 0.015, M.mat('#e0ad1f'), 0, 0.26, 0, g);
  M.cyl(0.045, 0.045, 0.01, 10, M.mat('#5a3a1a'), 0, 0.16, 0.052, g).rotation.x = PI / 2;
  g.userData.h = 0.28;
  return g;
}
function makeSalata() { // çoban salatası: beyaz kâsede doğranmış domates, salatalık, soğan ve maydanoz
  const g = new THREE.Group();
  M.cyl(0.16, 0.1, 0.1, 14, M.mat('#f4f1ea'), 0, 0.05, 0, g);
  M.cyl(0.145, 0.145, 0.02, 14, M.mat('#7fb84a'), 0, 0.1, 0, g);
  for (const [x, z, c] of [[-0.06, -0.03, '#d8342c'], [0.05, 0.04, '#d8342c'], [0, -0.08, '#a7d36b'], [-0.05, 0.07, '#a7d36b'], [0.08, -0.04, '#f4f1ea'], [0.02, 0.02, '#3f8f3a']])
    M.rbox(0.05, 0.03, 0.05, 0.01, M.mat(c), x, 0.115, z, g);
  g.userData.h = 0.13;
  return g;
}
function makeKoz() { // köz kavanozu: camda közlenmiş kırmızı biber, altta mor patlıcan, krem etiket, siyah kapak
  const g = new THREE.Group();
  M.cyl(0.1, 0.1, 0.22, 12, M.mat('#8a2a2a', { rough: 0.3 }), 0, 0.11, 0, g);
  M.cyl(0.102, 0.102, 0.07, 12, M.mat('#4a2a5a', { rough: 0.3 }), 0, 0.05, 0, g);
  M.cyl(0.105, 0.105, 0.06, 12, M.mat('#f4ead5'), 0, 0.15, 0, g);
  M.cyl(0.11, 0.11, 0.04, 12, M.mat('#2f2f2f'), 0, 0.24, 0, g);
  g.userData.h = 0.26;
  return g;
}
function makeKabakTatlisi() { // kabak tatlısı: beyaz tabakta iki turuncu kabak dilimi, üstünde kaymak ve ceviz
  const g = new THREE.Group();
  M.cyl(0.18, 0.15, 0.03, 16, M.mat('#ffffff'), 0, 0.015, 0, g);
  for (const [x, r] of [[-0.06, 0.4], [0.06, -0.3]]) M.rbox(0.1, 0.06, 0.16, 0.02, M.mat('#e8761e'), x, 0.06, 0, g).rotation.y = r;
  M.sph(0.035, M.mat('#fff4e0'), 0, 0.1, 0.02, g, 8, 6);
  for (const [x, z] of [[-0.03, -0.05], [0.04, 0.05]]) M.sph(0.02, M.mat('#8a5a33'), x, 0.1, z, g, 6, 5);
  g.userData.h = 0.12;
  return g;
}
ITEMS.cekirdek = { name: 'Çekirdek', price: 10, fn: makeCekirdek };              // bir ayçiçeğinden iki paket
ITEMS.salata = { name: 'Çoban salatası', price: 24, fn: makeSalata };           // domates ve salatalıktan
ITEMS.koz = { name: 'Köz kavanozu', price: 32, fn: makeKoz };                    // biber ve patlıcandan
ITEMS.kabaktatlisi = { name: 'Kabak tatlısı', price: 18, fn: makeKabakTatlisi }; // bir balkabağından iki tabak

// ---------- makineler (önleri +z'ye bakar, 1 m geniş; birimde batıya döner) ----------
function makeSalataTezgahi() { // salata tezgâhı: mermer tezgâh, kesme tahtası ve bıçak, büyük kâsede salata, köşede domates ve salatalık
  const g = new THREE.Group();
  M.rbox(1.0, 0.85, 0.85, 0.05, M.mat('#3f9a6b'), 0, 0.425, 0, g);
  M.rbox(1.06, 0.06, 0.92, 0.02, M.mat('#eceae4'), 0, 0.88, 0, g);
  M.rbox(0.36, 0.04, 0.3, 0.02, M.mat('#c99a5e'), -0.24, 0.93, 0.12, g);
  M.rbox(0.24, 0.015, 0.04, 0.005, M.mat('#c9d1d8', { rough: 0.25 }), -0.24, 0.96, 0.12, g);
  const b = makeSalata(); b.scale.setScalar(1.8); b.position.set(0.2, 0.91, 0.02); g.add(b);
  M.sph(0.07, M.mat('#d8342c'), -0.36, 0.98, -0.24, g, 10, 8);
  M.cyl(0.035, 0.035, 0.2, 8, M.mat('#3f8f3a'), -0.12, 0.95, -0.26, g).rotation.z = PI / 2;
  return g;
}
function makeMangal() { // köz mangalı: tuğla ocak, ızgarada közlenen biber ve patlıcan, közün turuncusu
  const g = new THREE.Group();
  M.rbox(1.0, 0.8, 0.85, 0.06, M.mat('#a4553a'), 0, 0.4, 0, g);
  M.rbox(0.8, 0.06, 0.6, 0.02, M.mat('#ff8a3d', { emissive: '#ff5a00', ei: 0.9 }), 0, 0.82, 0, g);
  for (let i = 0; i < 5; i++) M.rbox(0.02, 0.02, 0.62, 0.005, M.mat('#2f2f2f'), -0.4 + i * 0.2, 0.9, 0, g);
  for (const [x, z] of [[-0.28, -0.12], [-0.12, 0.13]]) M.cyl(0.055, 0.045, 0.26, 8, M.mat('#c8261e'), x, 0.95, z, g).rotation.z = PI / 2;
  for (const [x, z] of [[0.14, -0.1], [0.3, 0.12]]) M.sph(0.08, M.mat('#4a2a5a'), x, 0.96, z, g, 10, 8).scale.set(1.4, 0.9, 0.9);
  return g;
}
function makeKavurma() { // çekirdek kavurma makinesi: ayaklı ocakta çelik tambur, üstte ayçiçeği hunisi, altta ateş, önde çıkış oluğu
  const g = new THREE.Group(), steel = M.mat('#9aa4ad', { rough: 0.3 }), dark = M.mat('#3d4552');
  M.rbox(1.0, 0.5, 0.8, 0.04, dark, 0, 0.25, 0, g);
  M.rbox(0.44, 0.16, 0.04, 0.02, M.mat('#ff8a3d', { emissive: '#ff6a00', ei: 0.8 }), 0, 0.25, 0.41, g);
  M.cyl(0.34, 0.34, 0.76, 18, steel, 0, 0.88, 0, g).rotation.z = PI / 2;
  for (const x of [-0.4, 0.4]) M.cyl(0.36, 0.36, 0.04, 18, dark, x, 0.88, 0, g).rotation.z = PI / 2;
  M.cyl(0.26, 0.12, 0.3, 12, steel, 0.12, 1.36, -0.05, g, true);
  M.cyl(0.23, 0.23, 0.02, 12, M.mat('#3a2a1a'), 0.12, 1.49, -0.05, g);
  M.rbox(0.2, 0.04, 0.36, 0.01, steel, -0.24, 0.6, 0.44, g).rotation.x = 0.4;
  return g;
}
function makeTatliOcagi() { // kabak tatlısı ocağı: krem ocakta bakır tencere, yanında bütün balkabağı ve tahin kavanozu
  const g = new THREE.Group();
  M.rbox(1.0, 0.85, 0.85, 0.05, M.mat('#f1ece2'), 0, 0.425, 0, g);
  M.rbox(1.02, 0.04, 0.87, 0.02, M.mat('#3d4552'), 0, 0.87, 0, g);
  M.cyl(0.26, 0.22, 0.28, 16, M.mat('#c27a3e', { rough: 0.35 }), -0.16, 1.03, 0, g);
  M.cyl(0.24, 0.24, 0.02, 16, M.mat('#e8761e'), -0.16, 1.16, 0, g);
  for (const s of [-1, 1]) M.rbox(0.1, 0.04, 0.05, 0.01, M.mat('#8a5a33'), -0.16 + s * 0.29, 1.09, 0, g);
  M.sph(0.15, M.mat('#e8761e'), 0.3, 1.0, -0.16, g, 12, 8).scale.y = 0.75;
  M.cyl(0.025, 0.025, 0.07, 6, M.mat('#4f7a2a'), 0.3, 1.14, -0.16, g);
  M.cyl(0.06, 0.06, 0.13, 10, M.mat('#d9b48a'), 0.33, 0.955, 0.24, g);
  return g;
}

// ---------- birim ----------
// Her birim batıya (dükkânın içine) bakar, öteki makinelerin yerleşimi döndürülmüş gibi (expand.js machine): makine ortada şeridin doğu
// kenarında, müşterinin solunda (kuzeyde) girdi, sağında (güneyde) çıktı masası, ön alanlar koridorda (doğu raflarının ucu x 14,4).
// Usta çıktı masasının arkasında, makinenin yanında durur (calisan.js). Dükkân zemini 20 cm yüksekte (models.js makeShopStage):
// her şey zemine göre. Birimler 3,1 m arayla, arka duvardan (iç yüz z −13) ön koridorun yürüme şeridine (z −0,15) kadar
const MX = 17.45, TX = 16.7, AX = 15.6, FY = 0.2, DZ = 1.15;
function unit(c, u) {
  const z = u.z, K = G.regions.koy;
  c.put(u.model(), MX, FY, z, -PI / 2);
  const wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
  for (const dz of [-DZ, DZ]) c.put(workTable(0.8, 0.8, 0.7, wood), TX, FY + 0.4, z + dz, PI / 2);
  c.col(MX - 0.43, 18.4, z - 1.55, z + 1.55); // makine, ustanın yeri ve arkası: dört birim zeminin doğu kenarında kesintisiz sıra olur (arkadan geçilmez)
  for (const dz of [-DZ, DZ]) c.col(TX - 0.35, TX + 0.35, z + dz - 0.4, z + dz + 0.4); // masalar
  const tray = (dz) => [TX, FY + 0.86, z + dz];
  const out = { type: u.out, interval: u.interval, max: 6, origin: V(MX, FY + 1.2, z), tray: tray(DZ), zx: AX, zz: z + DZ, zw: 1.2, zd: 0.8, my: FY + 0.03 };
  const base = { ix: AX, iz: z - DZ, iw: 1.2, id: 0.8, inTray: tray(-DZ), instant: c.instant, my: FY + 0.03, out };
  const conv = u.recipe ? new Mixer(c.group, { ...base, recipe: u.recipe }) : new Converter(c.group, { ...base, inType: u.in, inCap: 6, per: u.per });
  conv.inTray.rotation.y = PI / 2; conv.out.tray.rotation.y = PI / 2; // tepsiler masanın boyunca (kuzey-güney) dizilir
  for (const s of [conv, conv.out]) { const slot = s.slot.bind(s); s.slot = (i) => { const v = slot(i); v.x *= 0.56; return v; }; } // yuvalar 0,8 m'lik masaya sığsın
  conv.opY = FY; // usta zeminin üstünde dursun (calisan.js)
  const ins = u.recipe || [u.in];
  for (const t of ins) G.xsink.push({ type: t, conv, pri: 3 });
  c.src(u.out, conv.out);
  (G.xgens[u.id] || (G.xgens[u.id] = [])).push(conv.out); // menüde hız ve tepsi yükseltmesi (upgrades.js XMACH)
  c.hint(AX, 2.4, z - DZ, ins.map(c.icon).join(''), u.title, u.hint, 3.0);
  // satış: dükkânın ön sırasında kendi rafı (world.js KOY_PLACES, 'imalat' grubu)
  if (!K.imalatTypes.includes(u.out)) K.imalatTypes.push(u.out);
  K.addShelf('imalat', c.instant);
  G.xsell.push({ type: u.out, list: () => K.imalatTypes, shelf: () => K.shelfByType[u.out] });
}

// arkadan öne: kabak tatlısı arka duvarın dibinde, salata barı ön koridorun yanında (ilk açılan, en göz önünde)
const UNITS = [
  { id: 'xkoym1', z: -2.05, lvl: 12, price: 3000, icon: '🥗', title: 'Salata Barı', model: makeSalataTezgahi, recipe: ['domates', 'salatalik'], out: 'salata', interval: 5.0,
    text: 'Dükkâna salata barı kuruldu.', how: 'Domates ve salatalığı tezgâhın arka masasına bırak: ikisi bir araya gelince bir kâse çoban salatası olur.',
    hint: 'Domates ve salatalık bırak: ikisi bir kâse çoban salatası olur.', sell: 'Salata dükkânın ön sırasındaki kendi rafında satılır. Kâsesi {0} ₺.' },
  { id: 'xkoym2', z: -5.15, lvl: 13, price: 3400, icon: '🍆', title: 'Köz Mangalı', model: makeMangal, recipe: ['biber', 'patlican'], out: 'koz', interval: 6.0,
    text: 'Dükkâna köz mangalı kuruldu.', how: 'Biber ve patlıcanı mangalın arka masasına bırak: ikisi közlenip bir kavanoz olur. Biber ve patlıcan köy bahçesinin doğusunda yetişir.',
    hint: 'Biber ve patlıcan bırak: ikisi közlenip bir kavanoz olur.', sell: 'Köz kavanozu dükkânın ön sırasındaki kendi rafında satılır. Kavanozu {0} ₺.' },
  { id: 'xkoym3', z: -8.25, lvl: 14, price: 3800, icon: '🌻', title: 'Çekirdek Kavurma', model: makeKavurma, in: 'aycicek', per: 2, out: 'cekirdek', interval: 4.5,
    text: 'Dükkâna çekirdek kavurma makinesi kuruldu.', how: 'Ayçiçeğini makinenin arka masasına bırak: bir ayçiçeği iki paket çekirdek olur. Ayçiçeği büyük tarlalarda yetişir.',
    hint: 'Ayçiçeği bırak: bir ayçiçeği iki paket çekirdek olur.', sell: 'Çekirdek dükkânın ön sırasındaki kendi rafında satılır. Paketi {0} ₺.' },
  { id: 'xkoym4', z: -11.35, lvl: 15, price: 4200, icon: '🎃', title: 'Kabak Tatlısı', model: makeTatliOcagi, in: 'balkabagi', per: 2, out: 'kabaktatlisi', interval: 6.0,
    text: 'Dükkâna kabak tatlısı ocağı kuruldu.', how: 'Balkabağını ocağın arka masasına bırak: bir balkabağı iki tabak kabak tatlısı olur. Balkabağı at ahırının bostanında yetişir.',
    hint: 'Balkabağı bırak: bir balkabağı iki tabak kabak tatlısı olur.', sell: 'Kabak tatlısı dükkânın ön sırasındaki kendi rafında satılır. Tabağı {0} ₺.' },
];
for (const u of UNITS) {
  defineExpansion({ id: u.id, region: 'koy', chain: u.id, req: 'kS4', tier: 1, lvl: u.lvl, icon: u.icon, title: u.title, price: u.price, rect: null,
    at: [AX, u.z], y: FY + 0.03, size: 2.4,
    info: { text: u.text, steps: [[(u.recipe || [u.in])[0], u.how], [u.out, u.sell.replace('{0}', ITEMS[u.out].price)]] },
    build: (c) => unit(c, u) });
}
