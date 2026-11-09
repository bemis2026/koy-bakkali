// Ana oturumun bölge genişletmeleri (genisleme-plan.md): köy, köy tarlaları, mera, atölye, at ahırı, benzinlik, enerji parkı,
// e-ticaret ofisi, otopark, balıkçı iskelesi. Her bölgede üç kademe: 1. kapasite, 2. yeni iş ya da ürün, 3. büyük kapasite.
// Her kademe defineExpansion ile tanımlanır (expand.js); arsalar batı ovasının ve köy kenarlarının boş, göstermelik alanlarıdır.
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, Station, Converter, fly, sfx, bedKey, lerpAngle } from './game.js';
import { texRep, textTex } from './tex.js';
import { defineExpansion } from './expand.js';
import { toKasa } from './account.js';
import { addExtraBay } from './station.js';
import { makeThresher, trainingArena, trackPt } from './riders.js';
import { esya } from './esya.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;

// ---------- yeni ürünler ----------
// halı: kilimin büyük, koyu kırmızı bordürlü rulosu
function makeHali() {
  const g = M.makeKilim(); g.scale.setScalar(1.3);
  const w = new THREE.Group(); w.add(g);
  for (const s of [-1, 1]) M.cyl(0.16, 0.16, 0.06, 14, M.mat('#7a1f2b'), 0.28 * s, 0.17, 0, w).rotation.z = PI / 2;
  w.userData.h = 0.32;
  return w;
}
// balık çorbası: çorba kâsesi, üstünde balık kılçığı süsü
function makeFishSoup() {
  const v = esya('corba'); // çorba kâsesi modeli (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = M.model('bowl-soup');
  const fin = M.rbox(0.14, 0.05, 0.06, 0.02, M.mat('#ff9a4d'), 0, (g.userData.h || 0.25) + 0.02, 0); g.add(fin);
  return g;
}
ITEMS.lahana = { name: 'Lahana', price: 9, model: 'cabbage' };
ITEMS.balkabagi = { name: 'Balkabağı', price: 14, model: 'pumpkin' };
ITEMS.hali = { name: 'Halı', price: 70, fn: makeHali };
ITEMS.balikcorba = { name: 'Balık çorbası', price: 30, fn: makeFishSoup };

// ---------- küçük modeller ----------
const wood = () => M.mat('#a8703f');
function makeGreenhouse(w, d) { // ince çerçeveli cam sera (bostanların üstünde, içi görünür)
  const g = new THREE.Group(), fr = M.mat('#e9ecef'), glass = new THREE.MeshStandardMaterial({ color: '#d8f3ff', transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl(0.05, 0.05, 2.4, 6, fr, (sx * w) / 2, 1.2, (sz * d) / 2, g);
  for (const sz of [-1, 1]) M.rbox(w, 0.06, 0.06, 0.02, fr, 0, 2.4, (sz * d) / 2, g);
  for (const sx of [-1, 1]) M.rbox(0.06, 0.06, d, 0.02, fr, (sx * w) / 2, 2.4, 0, g);
  M.rbox(w, 0.06, 0.06, 0.02, fr, 0, 3.0, 0, g);
  // çatı: sırttan iki yana inen cam yüzeyler
  const slope = Math.atan2(0.6, w / 2), L = Math.hypot(w / 2, 0.6);
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(L, d), glass);
    r.rotation.x = -PI / 2; r.rotation.y = 0; r.rotation.order = 'YXZ'; r.rotation.set(-PI / 2, 0, 0); r.rotateY(sx * slope);
    r.position.set((sx * w) / 4, 2.7, 0); g.add(r);
  }
  return g;
}
function makeSpinWheel() { // yün eğirme çıkrığı
  const g = new THREE.Group(), w = wood();
  M.rbox(1.1, 0.08, 0.4, 0.02, w, 0, 0.35, 0, g);
  for (const x of [-0.45, 0.45]) M.cyl(0.04, 0.04, 0.7, 6, w, x, 0.35, 0, g);
  const wh = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 20), w); wh.position.set(-0.15, 0.95, 0); g.add(wh);
  for (let k = 0; k < 6; k++) { const s = M.rbox(0.03, 0.8, 0.03, 0.01, w, -0.15, 0.95, 0, g); s.rotation.z = (k * PI) / 6; }
  M.cyl(0.07, 0.07, 0.3, 8, M.mat('#f4ead5'), 0.35, 0.75, 0, g);
  g.userData.wheel = wh;
  return g;
}
function makeBiogas() { // biyogaz tesisi: yeşil kubbeli tank, besleme hunisi, boru ve küçük pano
  const g = new THREE.Group();
  M.cyl(1.6, 1.7, 2.2, 18, M.mat('#7aa36a'), 0, 1.1, 0, g);
  M.sph(1.62, M.mat('#5f8a52'), 0, 2.2, 0, g, 18, 10).scale.y = 0.45;
  M.cyl(0.5, 0.25, 0.8, 10, M.mat('#8a9097'), 2.1, 1.0, 0.9, g); // besleme hunisi
  M.cyl(0.08, 0.08, 2.6, 6, M.mat('#c9ccd0'), -1.9, 1.3, 0, g).rotation.z = PI / 2;
  M.rbox(0.8, 0.6, 0.1, 0.03, M.mat('#c8102e'), -1.4, 1.1, 1.62, g);
  return g;
}
function makeShelter() { // dolmuş durağı: çatılı bank
  const g = new THREE.Group(), fr = M.mat('#3d7dd8');
  for (const x of [-1.2, 1.2]) M.cyl(0.06, 0.06, 2.4, 6, fr, x, 1.2, -0.4, g);
  M.rbox(2.8, 0.1, 1.2, 0.03, fr, 0, 2.45, -0.1, g);
  M.rbox(2.2, 0.08, 0.45, 0.02, wood(), 0, 0.5, -0.3, g);
  const s = M.makeSign('🚐 DOLMUŞ', '#3d7dd8', 1.6, 0.45); s.scale.setScalar(0.7); s.position.set(-1.7, 0, 0); g.add(s); // batısında: doğusunda otobüs durağı var (city.js)
  const t = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.42), new THREE.MeshBasicMaterial({ map: textTex('🚐 DOLMUŞ DURAĞI', { bg: '#3d7dd8', w: 512, h: 80, r: 10 }) }));
  t.position.set(0, 2.45, 0.52); g.add(t); // çatının ön alnında büyük yazı
  return g;
}
function makeNetRack() { // balık ağı askısı ve kafes
  const g = new THREE.Group(), w = wood();
  for (const x of [-1, 1]) M.cyl(0.06, 0.06, 1.8, 6, w, x, 0.9, 0, g);
  M.rbox(2.2, 0.06, 0.06, 0.02, w, 0, 1.75, 0, g);
  if (esya('agaski')) for (const x of [-0.5, 0.5]) { const n = esya('agaski'); n.position.x = x; g.add(n); } // kirişe asılı iki kepçe ağ (esya.js)
  else {
    const net = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), new THREE.MeshStandardMaterial({ color: '#cfd8c2', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    net.position.set(0, 1.05, 0); g.add(net);
  }
  M.rbox(0.9, 0.5, 0.6, 0.06, M.mat('#6b8cae'), 0, 0.25, 0.6, g); // kafes kasası
  return g;
}
function makeWash() { // oto yıkama kemeri: iki ayak, üst köprü, dönen fırçalar
  const g = new THREE.Group(), fr = M.mat('#3d7dd8'), br = M.mat('#ffd23f', { rough: 0.9 });
  for (const x of [-1.6, 1.6]) M.rbox(0.3, 2.9, 1.2, 0.06, fr, x, 1.45, 0, g);
  M.rbox(3.5, 0.4, 1.3, 0.06, fr, 0, 3.0, 0, g);
  const brushes = [];
  for (const x of [-1.25, 1.25]) { const b = M.cyl(0.32, 0.32, 2.2, 12, br, x, 1.4, 0, g); brushes.push(b); }
  const s = M.makeSign('🫧 OTO YIKAMA', '#3d7dd8', 2.2, 0.5); s.scale.setScalar(0.7); s.position.set(0, 1.4, 0.75); g.add(s);
  g.userData.brushes = brushes;
  // su (2026-11-01 kullanıcı: "su ile yıkama yapmıyor, yapsın"): iki yandan püskürtme perdesi, köprüden düşen damlalar, arabanın
  // üstünde köpük; yıkama bitince yerde bir süre su birikintisi kalır (updateExpandWest)
  const nz = M.mat('#c9cfd6', { rough: 0.3 });
  for (const x of [-1.42, 1.42]) for (const y of [0.6, 1.2, 1.8, 2.4]) M.cyl(0.05, 0.05, 0.16, 6, nz, x * 0.97, y, 0, g).rotation.z = PI / 2; // memeler
  const water = new THREE.Group(); water.visible = false; g.add(water);
  const wm = new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.42, roughness: 0.08, depthWrite: false, side: THREE.DoubleSide });
  for (const x of [-1.0, 1.0]) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.3), wm); sh.position.set(x, 1.4, 0); sh.rotation.y = PI / 2; water.add(sh); }
  const N = 80, drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: '#dff6ff', transparent: true, opacity: 0.9 }), N);
  drops.frustumCulled = false; water.add(drops);
  const dd = Array.from({ length: N }, () => ({ x: (Math.random() * 2 - 1) * 1.1, y: Math.random() * 2.7, z: (Math.random() * 2 - 1) * 0.6, v: 2.5 + Math.random() * 2.5 }));
  const foam = new THREE.Group(); water.add(foam);
  for (let i = 0; i < 16; i++) M.sph(0.08 + Math.random() * 0.09, M.mat('#ffffff', { rough: 0.6 }), (Math.random() - 0.5) * 1.3, 1.15 + Math.random() * 0.45, (Math.random() - 0.5) * 1.6, foam, 8, 6);
  const pud = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ color: '#8fd3ef', transparent: true, opacity: 0, roughness: 0.04, depthWrite: false }));
  pud.rotation.x = -PI / 2; pud.scale.set(1.5, 2.4, 1); pud.position.y = 0.03; pud.visible = false; g.add(pud);
  g.userData.water = { water, drops, dd, foam, pud, wm, k: 0 };
  return g;
}
// binicilik pisti: köşeleri yuvarlak dikdörtgen çit (riders.js trackPt), direkler eşit aralıklı, aralarında iki sıra kuşak
function makeTrack(w, d) {
  const g = new THREE.Group(), w2 = wood(), K = 720, line = [], len = [0];
  for (let i = 0; i <= K; i++) line.push(trackPt((i / K) * PI * 2, w / 2, d / 2, { x: 0, z: 0 }));
  for (let i = 1; i <= K; i++) len.push(len[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z));
  const L = len[K], n = Math.max(18, Math.round(L / 1.3)), posts = [];
  for (let i = 0, j = 0; i < n; i++) { const s = (i / n) * L; while (len[j + 1] < s) j++; posts.push(line[j]); }
  for (const p of posts) M.cyl(0.06, 0.06, 1.05, 6, w2, p.x, 0.52, p.z, g);
  for (let i = 0; i < n; i++) {
    const { x: x0, z: z0 } = posts[i], { x: x1, z: z1 } = posts[(i + 1) % n];
    for (const y of [0.5, 0.92]) { const r = M.rbox(Math.hypot(x1 - x0, z1 - z0), 0.07, 0.07, 0.02, w2, (x0 + x1) / 2, y, (z0 + z1) / 2, g); r.rotation.y = -Math.atan2(z1 - z0, x1 - x0); }
  }
  return g;
}

// ---------- biyogaz: saman ve buğday alır, işler, parası enerji kasasına ----------
class Biogas extends Station {
  constructor(parent, x, z, instant) {
    super(x + 2.1, z + 2.2, 2.4, 1.4, { instant });
    this.inType = 'saman'; this.cap = 10; this.input = []; this.t2 = 0;
    this.tray = new THREE.Group(); this.tray.position.set(x + 2.1, 0.6, z + 1.0); parent.add(this.tray);
  }
  accepts(t) { return t === 'saman' || t === 'bugday'; }
  putFrom(stack) {
    if (this.input.length >= this.cap) return false;
    const it = stack.takeOf(['saman', 'bugday']);
    if (!it) return false;
    this.input.push(it.type);
    fly(it.obj, this.tray, V(0, 0.2, 0), 0.3, 0.9, (o) => o.parent && o.parent.remove(o));
    sfx('pop', { npc: stack !== G.stack });
    return true;
  }
  update(dt) {
    // her 4 sn'de bir girdi işlenir: saman 9 ₺, buğday 6 ₺ (enerji santralinin kasasına)
    if (this.input.length && (this.t2 += dt) >= 4) {
      this.t2 = 0;
      const t = this.input.shift(), pay = t === 'saman' ? 9 : 6;
      const R = G.regions.enerji;
      if (R && R.payAt) toKasa('enerji', 'Enerji santrali', pay, R.payAt(), '⚡');
    }
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.15 && this.putFrom(G.stack)) this.t = 0;
  }
}

// =====================================================================
// KÖY BAKKALI: bahçenin doğu ucu (eski süs köşesi)
// =====================================================================
const allBeds = (rect) => Object.values(G.xsrc || {}).flat().filter((s) => s.plants && s.zone.x > rect[0] && s.zone.x < rect[1] && s.zone.z > rect[2] && s.zone.z < rect[3]);
// 2026-11-01 (kullanıcı: "köy bakkalında patlıcan biber bekliyor millet, onların tarlası yok"; "genişlettiğimiz yerde tekrar domates
// açıldı, domates uzağa değil yanına açılsın, değilse o bölümde domates olmasın"): doğu genişlemesi salatalık sıralarının yanında,
// domatesler batıda; buraya domates değil, köyde tarlası olmayan biber ve patlıcan gelir. Üç yatak alt alta: biber, patlıcan, karpuz.
// Eski kayıttaki domates sırasının ve karpuzun fideleri yeni yataklara aktarılır (fide parası kaybolmaz)
const moveFide = (from, to) => { if (G.fide && G.fide[from] != null && G.fide[to] == null) { G.fide[to] = G.fide[from]; delete G.fide[from]; } };
// bostan pazarın biber tezgâhından (pt3) sonra gelir: biber ancak o zaman satılır (dükkânın
// manav reyonu da p1'den sonra açılır). Eskiden salatalık bostanından hemen sonra açılabiliyordu, pazardan önce açılınca toplanan
// biber satılamıyordu (2026-11-06 kullanıcı: "biber yetiştirmeyi semt pazarından önce açınca satamıyoruz")
// 2026-11-08 kullanıcı: "biber artık toplanabilir olunca patlıcan da ..." (seçimi: biberle birlikte açılsın): patlıcan yatağı xkoy1'e geçti,
// xkoy2 yalnız karpuz. Bostan iki tezgâh da (pt3, pt4) açıldıktan sonra gelir: toplanan biber ve patlıcan hemen satılır. Yataklar yerinde
// kaldı (fide kayıtları bedKey'e bağlı); eski kayıtta xkoy1 açık, xkoy2 kapalıysa patlıcan yatağı açılışta gelir
defineExpansion({ id: 'xkoy1', region: 'koy', tier: 1, req: 'pt4', icon: '🫑', title: 'Biber ve Patlıcan Bostanı', price: 1200, rect: [9.4, 14.2, 3.0, 9.3], at: [11.8, 6.2], tex: 'grass',
  info: { text: 'Köy bahçesi doğuya büyüdü: biber ve patlıcan bostanı.', steps: [['biber', 'Biber artık köyde yetişiyor. Topla, pazardaki biber tezgahına ya da dükkânın manav reyonuna götür; sebze kamyonetine para vermezsin.'], ['patlican', 'Patlıcan bostanı biberin hemen altında. Topla, pazardaki patlıcan tezgahına ya da dükkânın manav reyonuna götür.']] },
  build: (c) => { moveFide(bedKey('domates', 11.8, 5.15), bedKey('biber', 11.8, 4.45)); moveFide(bedKey('biber', 11.8, 4.45), bedKey('biber', 11.8, 5.05)); c.bed(11.8, 5.05, 'biber', 6); // köy marketi öne büyüdü (2026-11-01): yataklar güneye kaydı
    moveFide(bedKey('patlican', 11.8, 7.35), bedKey('patlican', 11.8, 7.8)); c.bed(11.8, 7.8, 'patlican', 7); } });
defineExpansion({ id: 'xkoy2', region: 'koy', tier: 2, req: 'pt4', icon: '🍉', title: 'Karpuz Bostanı', price: 1200, rect: [9.4, 14.2, 9.3, 11.7], at: [11.8, 10.5], tex: 'grass',
  info: { text: 'Karpuz artık köyde de yetişiyor!', steps: [['karpuz', 'Karpuz bostanı kendi kendine büyür. Topla, dükkânın manav reyonuna ya da pazar tezgahına götür; toptancıya para vermezsin.']] },
  build: (c) => { moveFide(bedKey('karpuz', 11.8, 9.5), bedKey('karpuz', 11.8, 10.25)); moveFide(bedKey('karpuz', 11.8, 10.25), bedKey('karpuz', 11.8, 10.55)); c.bed(11.8, 10.55, 'karpuz', 11); } });
defineExpansion({ id: 'xkoy3', region: 'koy', tier: 3, icon: '🪴', title: 'Bahçe Serası', price: 3200, rect: null, at: [15.6, 5.0],
  info: { text: 'Bahçeye cam sera kuruldu.', steps: [['🌱', 'Köydeki bütün bostanlar %30 daha hızlı büyür.']] },
  build: (c) => {
    c.put(makeGreenhouse(5.2, 8.2), 11.8, 0, 7.8);
    const K = G.regions.koy, rect = [-16, 16, -14, 12];
    for (const b of [...(K.beds || []), ...allBeds(rect)]) if (!b.sera) { b.sera = true; b.baseGrow /= 1.3; b.grow /= 1.3; }
    G.mods = G.mods || {}; G.mods.koySera = 1.3; // sonradan açılan köy bostanları da hızlı büyür (world.js addPlot)
  } });

// =====================================================================
// İMALAT ÜRÜNLERİ: salça ve kek
// =====================================================================
// 2026-11-01 kullanıcı: "domates koyup salça yapabileceğim, yumurta ve süt koyup un ile hamur ya da bir şeyler yapma da olsun; bakkalı
// büyüt, ileride bunları ekleyebilelim; 6-7 domates alıyorum rafa sığmıyor, o zaman gidip salça için makineye koyabilelim".
// Önce köy bakkalının batısındaki imalathanedeydiler, ürünleri dükkânın ön sırasında satılıyordu. 2026-11-02 kullanıcı: "yeni çıkan kek
// tezgâhının önünde rafçılar sıkışıyor, kek tezgâhını kafenin oraya alalım, orası aşırı kalabalık oldu; salça tezgâhı da semt pazarında
// olsun": salça kazanı semt pazarına taşındı (salça kendi pazar tezgâhında satılır), kek tezgâhı kasaba kahvesinin arkasına (expand-east.js
// xkoy5: kek kahvenin önündeki vitrinde satılır). Dükkândaki 'imalat' rafları artık kurulmaz (world.js)
function makeSalca() { // salça kavanozu: camda koyu kırmızı salça, kırmızı kapak, krem etiket
  const g = new THREE.Group();
  M.cyl(0.11, 0.11, 0.2, 12, M.mat('#b3261e', { rough: 0.35 }), 0, 0.1, 0, g);
  M.cyl(0.115, 0.115, 0.08, 12, M.mat('#f4ead5'), 0, 0.1, 0, g);
  M.cyl(0.12, 0.12, 0.05, 12, M.mat('#e8473c'), 0, 0.225, 0, g);
  g.userData.h = 0.26;
  return g;
}
function makeKek() { // kalıp kek: kızarmış kek, üstünde krema ve vişne
  const g = new THREE.Group();
  M.cyl(0.17, 0.19, 0.14, 14, M.mat('#b9763a'), 0, 0.07, 0, g);
  M.cyl(0.172, 0.172, 0.03, 14, M.mat('#fff4e6'), 0, 0.155, 0, g);
  M.sph(0.04, M.mat('#c8102e'), 0, 0.19, 0, g, 8, 6);
  g.userData.h = 0.22;
  return g;
}
ITEMS.salca = { name: 'Salça', price: 18, fn: makeSalca }; // iki domatesten bir kavanoz
ITEMS.kek = { name: 'Kek', price: 42, fn: makeKek };       // un, yumurta ve sütten
function makeSalcaKazani() { // tuğla ocağın üstünde bakır kazan, içinde kaynayan salça, kepçe
  const g = new THREE.Group();
  M.rbox(1.6, 0.6, 1.2, 0.06, M.mat('#a4553a'), 0, 0.3, 0, g);
  M.rbox(0.5, 0.25, 0.05, 0.02, M.mat('#ff8a3d', { emissive: '#ff6a00', ei: 0.8 }), 0, 0.25, 0.61, g);
  M.cyl(0.62, 0.5, 0.6, 18, M.mat('#c27a3e', { rough: 0.35 }), 0, 0.9, 0, g);
  M.cyl(0.58, 0.58, 0.04, 18, M.mat('#b3261e', { rough: 0.3 }), 0, 1.17, 0, g);
  M.cyl(0.03, 0.03, 0.9, 6, M.mat('#7a4f2b'), 0.25, 1.35, 0, g).rotation.z = 0.5;
  return g;
}
export function makeKekTezgahi() { // tahta tezgâh: hamur kâsesi ve küçük fırın
  const g = new THREE.Group();
  M.rbox(2.0, 0.85, 1.0, 0.05, wood(), 0, 0.42, 0, g);
  M.cyl(0.32, 0.22, 0.24, 14, M.mat('#e9e4da'), -0.45, 0.97, 0, g);
  M.cyl(0.28, 0.28, 0.03, 14, M.mat('#f2d9a6'), -0.45, 1.08, 0, g);
  M.rbox(0.8, 0.6, 0.7, 0.06, M.mat('#3d4552'), 0.5, 1.15, -0.05, g);
  M.rbox(0.6, 0.35, 0.03, 0.02, M.mat('#ffb36b', { emissive: '#ff8a3d', ei: 0.6 }), 0.5, 1.12, 0.31, g);
  return g;
}
// çok girdili tezgâh: tarifteki her üründen birer tane olunca üretir (kek: un + yumurta + süt); her üründen en çok 3 tane alır
export class Mixer extends Converter {
  constructor(parent, o) {
    super(parent, { ...o, inType: o.recipe[0], inCap: o.recipe.length * 3 });
    this.recipe = o.recipe;
    this.out.canMake = () => this.recipe.every((t) => this.n(t) > 0);
    this.out.onMake = () => {
      for (const t of this.recipe) {
        const i = this.input.findIndex((m) => m.userData.mix === t);
        if (i < 0) continue;
        const [m] = this.input.splice(i, 1);
        fly(m, this.out.origin.clone(), null, 0.3, 0.6, (x) => x.parent && x.parent.remove(x));
      }
      this.input.forEach((m, i) => m.position.copy(this.slot(i))); // kalanlar tepside sıkışır
    };
  }
  n(t) { return this.input.filter((m) => m.userData.mix === t).length; }
  hasSpaceFor(t) { return this.recipe.includes(t) && this.n(t) < 3; }
  roomFor(t) { return this.recipe.includes(t) ? Math.max(0, 3 - this.n(t)) : 0; } // her malzemeden en çok 3 (elemanlar buna bakar: upgrades.js convSink)
  putFrom(stack) {
    const want = this.recipe.filter((t) => this.n(t) < 3);
    if (!want.length) return false;
    const it = stack.takeOf(want);
    if (!it) return false;
    it.obj.userData.mix = it.type;
    this.input.push(it.obj);
    fly(it.obj, this.inTray, this.slot(this.input.length - 1), 0.18, 0.6);
    sfx('pop', { npc: stack !== G.stack });
    return true;
  }
}
// salça kazanı pazarın kuzeybatı köşesinde, rakiplerin U kolunun dışında (rivals.js, world.js pzSlot).
// Salçacı kendi satar (2026-11-09 kullanıcı: "semt pazarında salçaları alıp ilerideki rafa koymak saçma olmuş. Salçacı kendi satışını yapsın ama para
// semt pazarının ortak kasasında toplansın"; eskiden kavanoz bizim sıradaki kendi tezgâhına taşınıyordu): salçacı çıktı masasının arkasında durur, pazar
// müşterisi masanın önüne gelip kavanozu ondan alır, parasının tamamı pazar kasasına düşer (rivals.js shops). Kavanozu oyuncu ya da eleman taşımaz
defineExpansion({ id: 'xkoy4', region: 'pazar', chain: 'imalat', tier: 1, lvl: 10, icon: '🥫', title: 'Salça Kazanı', price: 2600, rect: null, at: [29.3, -7.6],
  info: { text: 'Semt pazarına salça kazanı kuruldu.', steps: [['domates', 'Domatesi kazanın soldaki masasına bırak: iki domates bir kavanoz salça olur.'], ['salca', `Salçacı kavanozu kazanın başında kendisi satar (${ITEMS.salca.price} ₺); parası pazar kasasında birikir.`]] },
  build: (c) => {
    const conv = c.machine(makeSalcaKazani(), 29.3, -11.0, 'domates', 'salca', 5.0, { need: 2 }); // iki domates bir kavanoz
    c.hint(27.3, 2.2, -8.6, c.icon('domates'), 'Salça kazanı', 'Domates bırak: iki domates bir kavanoz salça olur. Salçacı kendisi satar, parası pazar kasasına düşer.', 3.4);
    salcaci(c, conv);
  } });
function salcaci(c, conv) {
  const out = conv.out, P = G.regions.pazar;
  out.takeTo = () => false; // tepsiden kimse almaz: kavanozu salçacı satar
  conv.op = true; // makinenin genel çalışanı (calisan.js) yerine salçacı durur: iki kişi olmasın
  const L = G.xsrc.salca, i = L ? L.indexOf(out) : -1; if (i >= 0) L.splice(i, 1); // elemanlar kaynak saymaz
  const v = c.put(M.makeCharacter({ shirt: '#b3261e', pants: '#4a3a2a', hat: 'cap', hatColor: '#ffffff', skin: '#d9a67c', mustache: true }), 31.3, 0, -10.75, 0);
  // müşteri çıktı masasının önünde durur; rakiplerin şeridinden (x 34,8) gelir, aynı yoldan döner
  P.rivals.shops.push({ shop: true, type: 'salca', sells: ['salca'], x: 31.3, z: -9.8, ry: 0, vendor: v,
    spots: [30.7, 31.9].map((x) => ({ p: new THREE.Vector3(x, 0, -8.3), c: null, ry: PI, lane: 34.8 })),
    has: () => out.items.length > 0, take: () => out.items.pop() });
}

// =====================================================================
// KÖY TARLALARI: tarlanın doğusunda, köyün batı koridoru
// =====================================================================
const tarlaFields = () => G.regions.tarla.fields || (G.regions.tarla.fields = []);
defineExpansion({ id: 'xtarla1', region: 'tarla', tier: 1, icon: '🌽', title: 'Tarla Genişler', price: 1100, rect: [-22.8, -16.6, -4.2, 0.1], at: [-20.6, -1.5], tex: 'grass',
  info: { text: 'Köy tarlalarına üçüncü koçan yatağı eklendi.', steps: [['kocan', 'Koçanı topla, sahildeki mısır kazanına götür; taşıyıcılar da buradan alır.']] },
  build: (c) => { tarlaFields().push(c.bed(-20.6, -1.5, 'kocan', 8)); } }); // tarlanın üçüncü sütunu (world.js buildTarla): eşit aralıklı üç sıra
defineExpansion({ id: 'xtarla2', region: 'tarla', tier: 2, icon: '🥬', title: 'Lahana Bostanı', price: 2000, rect: [-22.8, -16.6, 0.1, 4.25], at: [-20.6, 2.6], tex: 'grass',
  info: { text: 'Yeni ürün: lahana!', steps: [['lahana', `Lahana bostanı kendi kendine büyür. Tanesi ${ITEMS.lahana.price} ₺.`], ['🧺', 'Köy dükkânının manav reyonunda, pazar tezgahında ve şehir marketinde satılır.']] },
  build: (c) => { c.bed(-20.6, 2.6, 'lahana', 7); c.sell('lahana', 'manav'); c.sell('lahana', 'pazar'); c.sell('lahana', 'sehir'); } });
defineExpansion({ id: 'xtarla3', region: 'tarla', tier: 3, icon: '🌾', title: 'Büyük Tarla', price: 3400, rect: [-22.8, -16.6, 4.25, 8.4], at: [-20.6, 6.7], tex: 'grass',
  info: { text: 'Tarlanın dördüncü yatağı ve korkuluğu kuruldu.', steps: [['kocan', 'Dördüncü koçan yatağı açıldı.'], ['🌱', 'Köy tarlalarındaki her yatak %30 daha hızlı büyür.']] },
  build: (c) => {
    tarlaFields().push(c.bed(-20.6, 6.7, 'kocan', 8));
    c.put(M.makeScarecrow(), -17.6, 0, 4.65, -0.4); // üçüncü sütunun doğusunda, iki yatağın arasında
    for (const b of [...tarlaFields(), ...allBeds([-35, -16, -4.5, 8.6])]) if (!b.fast) { b.fast = true; b.baseGrow /= 1.3; b.grow /= 1.3; }
  } });

// =====================================================================
// KOYUN MERASI: meranın doğusu, köy yolundan sahile kadar
// =====================================================================
function grazers(c, n, rect) { // arsada otlayan koyunlar (süs): olduğu yerde yavaşça döner, başını eğer
  for (let i = 0; i < n; i++) {
    const s = M.makeSheep(i % 2 ? '#fbf6ec' : '#e9e2d6');
    c.put(s, rect[0] + 1 + Math.random() * (rect[1] - rect[0] - 2), 0, rect[2] + 1 + Math.random() * (rect[3] - rect[2] - 2), Math.random() * 6);
  }
}
defineExpansion({ id: 'xmera1', region: 'mera', tier: 1, icon: '🐑', title: 'Yeni Ağıl', price: 1400, rect: [-22.8, -16.6, 13.2, 18.2], at: [-19.7, 17.3], tex: 'grass',
  info: { text: 'Meranın yanına yeni ağıl ve kırkım barakası kuruldu.', steps: [['yun', 'Yeni barakanın tepsisinde de yün birikir; meranın yün üretimi iki katına çıktı.']] },
  build: (c) => { c.gen(M.makeShearShed(), -19.7, 14.4, 'yun', { interval: 3.4, max: 8, trayDz: 1.9 }); c.col(-21.8, -17.6, 13.2, 15.8); grazers(c, 2, [-22.6, -21.4, 13.6, 17.8]); } });
defineExpansion({ id: 'xmera2', region: 'mera', tier: 2, icon: '🧀', title: 'Tulum Mahzeni', price: 2400, rect: [-22.8, -16.6, 18.2, 23.2], at: [-19.7, 22.6], tex: 'grass',
  info: { text: 'Yeni iş: koyun sütünden tulum peyniri.', steps: [['ksut', 'Koyun sütünü mahzenin soldaki masasına bırak.'], ['peynir', 'Mahzen peynir yapar; sağdaki masadan al, köydeki süt dolabında sat.']] },
  build: (c) => { c.machine(M.makeYogurtJar(), -19.7, 19.4, 'ksut', 'peynir', 4.8); } });
defineExpansion({ id: 'xmera3', region: 'mera', tier: 3, icon: '🍼', title: 'Büyük Sağımhane', price: 3600, rect: [-22.8, -16.6, 23.2, 28.3], at: [-19.7, 27.4], tex: 'grass',
  info: { text: 'Büyük sağımhane açıldı.', steps: [['ksut', 'İkinci sağım yerinin tepsisinde de koyun sütü birikir.']] },
  build: (c) => {
    c.gen(M.makeShearShed(), -19.7, 24.2, 'ksut', { interval: 3.0, max: 8, trayDz: 1.9 }); c.col(-21.8, -17.6, 23.2, 25.6);
    for (const dx of [-1.2, 0, 1.1]) c.put(M.cyl(0.22, 0.18, 0.4, 12, M.mat('#c9d1d8', { rough: 0.35 })), -19.7 + dx, 0.2, 25.4);
  } });

// =====================================================================
// DOKUMA ATÖLYESİ: patikanın batısı (eski süs tarlası)
// =====================================================================
const atolyeLooms = [];
defineExpansion({ id: 'xatolye1', region: 'atolye', tier: 1, icon: '🧶', title: 'İkinci Dokuma Tezgahı', price: 1500, rect: [-65.0, -59.4, 13.0, 26.8], at: [-62.4, 23.6], tex: 'cobble',
  info: { text: 'Atölyenin yanına ikinci dokuma tezgahı kuruldu.', steps: [['yun', 'Yünü soldaki masaya bırak.'], ['kilim', 'Kilim sağdaki masada birikir; dokumacılar iki tezgahı da besler.']] },
  build: (c) => { atolyeLooms.push(c.machine(M.makeLoom(), -62.4, 17.0, 'yun', 'kilim', 5.0)); } });
defineExpansion({ id: 'xatolye2', region: 'atolye', tier: 2, icon: '🟥', title: 'Halı Tezgahı', price: 2800, rect: [-70.0, -65.0, 13.0, 26.8], at: [-67.5, 23.6], tex: 'cobble',
  info: { text: 'Yeni ürün: halı!', steps: [['kilim', 'Kilimi halı tezgahının soldaki masasına bırak.'], ['hali', `Tezgah kilimi büyük bir halıya çevirir. Tanesi ${ITEMS.hali.price} ₺; pazar tezgahında ve şehrin hediyelik köşesinde satılır.`]] },
  build: (c) => {
    const m = M.makeLoom(); m.scale.setScalar(1.25);
    c.machine(m, -67.5, 17.0, 'kilim', 'hali', 9.0);
    c.sell('hali', 'pazar'); c.sell('hali', 'hediye');
  } });
defineExpansion({ id: 'xatolye3', region: 'atolye', tier: 3, icon: '🧵', title: 'Yün Eğirme Çıkrığı', price: 4200, rect: [-74.6, -70.0, 13.0, 26.8], at: [-72.3, 23.6], tex: 'cobble',
  info: { text: 'Çıkrık geldi, atölye büyüdü.', steps: [['🧵', 'Bütün dokuma tezgahları %50 daha hızlı dokur.'], ['kilim', 'Üçüncü dokuma tezgahı da kuruldu.']] },
  build: (c) => {
    atolyeLooms.push(c.machine(M.makeLoom(), -72.3, 17.0, 'yun', 'kilim', 5.0));
    const w = c.put(makeSpinWheel(), -72.3, 0, 21.2); c.col(-72.9, -71.7, 21.0, 21.4);
    G.spinWheel = w;
    const A = G.regions.atolye;
    for (const conv of [A && A.loom, ...atolyeLooms]) if (conv && !conv.fast) { conv.fast = true; conv.out.interval /= 1.5; conv.out.baseInterval = conv.out.interval; }
  } });

// =====================================================================
// AT AHIRI: ahırın batısı (eski süs tarlası)
// =====================================================================
defineExpansion({ id: 'xatlar1', region: 'atlar', tier: 1, icon: '🌾', title: 'İkinci Saman Tarlası', price: 1600, rect: [-64.47, -59.6, -3.4, 8.3], at: [-62.0, 7.2], tex: 'path',
  info: { text: 'Ahırın batısına buğday tarlası ve ikinci harman makinesi kuruldu.', steps: [['bugday', 'Buğdayı topla, yanındaki harman makinesinin soldaki masasına bırak.'], ['saman', 'Saman sağdaki masada birikir; atlara yedir.']] },
  build: (c) => {
    c.bed(-62.0, -1.0, 'bugday', 7); // balkabağı yataklarıyla aynı sırada
    const th = makeThresher(); c.machine(th, -62.0, 2.6, 'bugday', 'saman', 2.6);
  } });
defineExpansion({ id: 'xatlar2', region: 'atlar', tier: 2, icon: '🎃', title: 'Balkabağı Bostanı', price: 2600, rect: [-69.33, -64.47, -3.4, 8.3], at: [-66.9, 7.2], tex: 'grass',
  info: { text: 'Yeni ürün: balkabağı!', steps: [['balkabagi', `İki balkabağı yatağı kendi kendine büyür. Tanesi ${ITEMS.balkabagi.price} ₺.`], ['🧺', 'Pazar tezgahında ve şehir marketinde satılır.']] },
  build: (c) => { c.bed(-66.9, -1.0, 'balkabagi', 10); c.bed(-66.9, 3.2, 'balkabagi', 10); c.sell('balkabagi', 'pazar'); c.sell('balkabagi', 'sehir'); } });
// 2026-11-03 kullanıcı: "içi boş, orada atlı biniciler eğitim yapsınlar; biraz daha büyük olsun, ahırın yanına yapabilirsin": pist batıdaki
// şeritten (x -71,8; 4,2×8,4) ahırın arkasına, eski otoparkın çimenine taşındı ve büyüdü; içinde iki binici eğitim yapar (riders.js).
// Batıda bisiklet parkı ve bisikletlilerin yolu (x -38,4), doğuda paket servis cebinin çıkış şeridi (x -29,6), güneyde bisikletlilerin
// dükkâna yürüdüğü yol (z -4,7) açık kalır. Bostan şeritleri yerinde: balkabağı fidelerinin kaydı yatağın yerine bağlı (game.js bedKey).
// 2026-11-03 kullanıcı: "binicilik eğitimi yapılan kısmı büyüt, çok küçük olmuş": 7,8×8,6 elipsti, köşeleri yuvarlak dikdörtgen oldu.
// Aynı gün: "2 katına çıkar ve ahırın arkasına değil sahile yakın tarafa al": ahırın arkasında (x -34, z -9,5) dört yanı doluydu; köy
// yolunun güneyine, batı uçtaki süs tarlalarının yerine taşındı (decor.js), 11×14 (eskisinin iki katı). Doğusunda atölyenin çıkrık
// arsası (x -74,6), batısında orman, güneyinde kumsal; üç binici çalışır
const ARENA = { x: -80.7, z: 20.8, w: 11.0, d: 14.0 };
defineExpansion({ id: 'xatlar3', region: 'atlar', tier: 3, icon: '🏇', title: 'Binicilik Pisti', price: 4000, rect: [-86.3, -75.1, 13.7, 27.9], at: [-77.6, 15.6], tex: 'path',
  info: { text: 'Binicilik pisti sahilin yanında, yel değirmeninin dibinde açıldı: biniciler pistte eğitim yapıyor, atlılar ahırı seviyor.', steps: [['🐎', 'Atlı müşteriler 1,5 kat daha sık gelir.'], ['💰', 'Bakım ücretleri 1,3 kat.']] },
  build: (c) => {
    const { x, z, w, d } = ARENA, A = G.regions.atlar;
    c.put(makeTrack(w, d), x, 0, z); c.col(x - w / 2 - 0.1, x + w / 2 + 0.1, z - d / 2 - 0.1, z + d / 2 + 0.1); // pistin içine girilmez: atların yolu
    if (A && !A.arena) A.arena = trainingArena(x, z, w / 2 - 0.9, d / 2 - 0.9, 3);
    G.mods = G.mods || {}; G.mods.riderRate = 1.5; G.mods.riderPay = 1.3;
  } });

// =====================================================================
// BEMIS BENZİNLİK: arsanın güneyi (eski süs tarlası)
// =====================================================================
defineExpansion({ id: 'xbenzin1', region: 'benzin', tier: 1, icon: '⚡', title: 'Süper Şarj Ünitesi', price: 2200, rect: [-78.8, -74.2, -1.6, 8.2], at: [-76.5, 1.0], tex: 'asphalt',
  info: { text: 'Avlunun güneyine süper hızlı DC şarj ünitesi kuruldu.', steps: [['⚡', 'Elektrikli arabalar buraya da girer, şarj olur, 40 ₺ öder. Para benzinliğin kasasında birikir.']] },
  build: (c) => { addExtraBay('dc', -76.5, c.instant); } });
// oto yıkama şarj ünitelerinin yanında değil (2026-11-01 kullanıcı): girişin batısında kendi arsasında; arabalar şeridin ucundan batıya döner
defineExpansion({ id: 'xbenzin2', region: 'benzin', tier: 2, icon: '🫧', title: 'Oto Yıkama', price: 3000, rect: [-93.6, -88.8, -1.6, 8.2], at: [-91.2, 1.0], tex: 'asphalt',
  info: { text: 'Yeni iş: oto yıkama!', steps: [['🚗', 'Arabalar yıkama kemerine girer, fırçalar döner, köpüklenip parlar.'], ['💰', 'Her yıkama 22 ₺; para benzinliğin kasasında birikir.']] },
  build: (c) => { const w = makeWash(); c.put(w, -91.2, 0, 5.4); for (const x of [-92.8, -89.6]) c.col(x - 0.16, x + 0.16, 4.8, 6.0); addExtraBay('wash', -91.2, c.instant, w); } }); // önündeki yol dönmeye yetsin (station.js)
defineExpansion({ id: 'xbenzin3', region: 'benzin', tier: 3, icon: '🔋', title: 'Ekspres Şarj ve Market', price: 4600, rect: [-83.4, -78.8, -1.6, 8.2], at: [-81.1, 1.0], tex: 'asphalt', // şarjlar yan yana, yıkama ayrı
  info: { text: 'İkinci süper şarj ünitesi ve büyüyen market.', steps: [['⚡', 'Bir süper şarj ünitesi daha.'], ['⛽', 'Benzinliğe uğrayan her araba 1,3 kat öder (market satışı).']] },
  build: (c) => { addExtraBay('dc', -81.1, c.instant); G.mods = G.mods || {}; G.mods.stationMul = 1.3; } });

// =====================================================================
// BEMIS ENERJİ PARKI: parkın güneyi (ormanda açıklık)
// =====================================================================
defineExpansion({ id: 'xenerji1', region: 'enerji', tier: 1, icon: '☀️', title: 'Güneş Tarlası', price: 3500, rect: [-84, -62.6, -57.2, -51.6], at: [-65.2, -54.4], tex: 'grass',
  info: { text: 'Üç güneş paneli dizisi daha kuruldu.', steps: [['☀️', 'Paneller güneşten elektrik üretir; kazanç enerji santralinin kasasında birikir.']] },
  build: (c) => { for (const [k, x] of [-71.2, -76.4, -81.6].entries()) G.regions.enerji.addUnitAt('sun', `xs${k}`, x, -54.4, c.instant); } });
// retired: kullanıcı isteğiyle (2026-10-28) yeni oyunculara sunulmaz, açmış olanda kalır (bitişik arsa kalabalığı azalsın)
defineExpansion({ id: 'xenerji2', retired: true, region: 'enerji', tier: 2, icon: '♻️', title: 'Biyogaz Tesisi', price: 4500, rect: [-84, -62.6, -51.6, -46], at: [-66.2, -48.8], tex: 'grass',
  info: { text: 'Yeni iş: biyogaz tesisi saman ve buğdayı elektriğe çevirir.', steps: [['saman', 'Saman ya da buğdayı tesisin besleme hunisine bırak (taşıyıcılar da getirir).'], ['💰', 'Her saman 9 ₺, her buğday 6 ₺; para enerji santralinin kasasına geçer.']] },
  build: (c) => {
    c.put(makeBiogas(), -75, 0, -49.6); c.col(-76.8, -73.2, -51.4, -47.8);
    const b = new Biogas(c.group, -75, -49.6, c.instant);
    G.xsink.push({ type: 'saman', conv: b, pri: 2 });
    const At = G.regions.atlar; if (At && At.gens && At.gens.saman && !(G.xsrc.saman || []).includes(At.gens.saman)) c.src('saman', At.gens.saman); // ahırın harmanı da kaynak
    c.hint(-72.9, 2.4, -47.4, `${c.icon('saman')}→⚡`, 'Biyogaz tesisi', 'Saman ya da buğdayı hunisine bırak; tesis elektriğe çevirir, parası enerji kasasına geçer.', 3.4);
  } });
defineExpansion({ id: 'xenerji3', region: 'enerji', tier: 3, icon: '🌬️', title: 'Rüzgâr Tarlası', price: 7800, rect: [-84, -62.6, -46, -40.4], at: [-65.2, -43.2], tex: 'grass',
  info: { text: 'Rüzgâr tarlası kuruldu: üç büyük türbin daha.', steps: [['🌬️', 'Türbinler rüzgâra göre döner; rüzgâr güçlendikçe kazanç artar.']] },
  build: (c) => { for (const [k, x] of [-71.2, -76.4, -81.6].entries()) G.regions.enerji.addUnitAt('wind', `xw${k}`, x, -43.2, c.instant); } });

// =====================================================================
// OTOPARK: e-ticaret ofisiyle otopark arasındaki şerit
// =====================================================================
// otopark kasabanın batısında (2026-11-01, events.js LOT): koridor z -28, kuzey sıra z -31,6, güney sıra z -24,4
defineExpansion({ id: 'xmeydan1', region: 'meydan', tier: 1, icon: '🅿️', title: 'Yeni Park Yeri', price: 1500, rect: null, at: [-82.2, -28.0],
  info: { text: 'Otoparka iki park yeri daha eklendi.', steps: [['🚗', 'İki araba daha park eder; alışverişe gelen ya da arabaya servis isteyen müşteri artar.']] },
  build: (c) => {
    for (const z of [-31.6, -24.4]) c.put(M.rbox(0.12, 0.02, 4.4, 0.005, M.mat('#ffffff')), -83.85, 0.03, z);
    const L = G.regions.koy.lot; if (L && L.addSpot) for (const z of [-31.6, -24.4]) L.addSpot(-82.2, z); // batı uçta, iki sıraya birer yer
  } });
// dolmuş durağı kasaba girişindeki otobüs durağının batısında, aynı durakta yan yana (2026-11-01 kullanıcı: "dolmuş durağı saçma dar bir
// yerde, gözükmüyor; otobüs durağıyla tek durak içinde yan yana olabilir"). city.js VSTOP ile aynı hizada (z -22,6)
const DOLMUS = { x: -41.6, z: -22.6, stop: -41.8 };
defineExpansion({ id: 'xmeydan2', region: 'meydan', tier: 2, icon: '🚐', title: 'Dolmuş Durağı', price: 2400, rect: null, at: [DOLMUS.x, -21.6],
  info: { text: 'Yeni iş: dolmuş durağı!', steps: [['🚐', 'Köy dolmuşu kasaba girişindeki durağa gelir, 3-4 yolcu indirir.'], ['🛒', 'Yolcular köy marketine alışverişe gider.']] },
  build: (c) => { c.put(makeShelter(), DOLMUS.x, 0, DOLMUS.z); c.col(DOLMUS.x - 1.3, DOLMUS.x + 1.3, DOLMUS.z - 0.55, DOLMUS.z - 0.25); G.dolmus = { t: c.instant ? 20 : 8, car: null, state: 'away' }; } });
defineExpansion({ id: 'xmeydan3', region: 'meydan', tier: 3, icon: '🔌', title: 'Şarjlı Otopark', price: 3600, rect: null, at: [-72.3, -28.0],
  info: { text: 'Otopark şarj noktalarıyla donandı.', steps: [['⚡', 'Park eden arabalar şarj olur; otopark ödemeleri 1,3 kat.']] },
  build: (c) => {
    // otoparkın arka (kuzey) kenarında, OTOPARK tabelasının doğusunda, kameraya dönük
    const s = M.makeSign('⚡ ŞARJLI OTOPARK', '#3fae6b', 2.4, 0.55); s.scale.setScalar(0.8); c.put(s, -71.4, 0, -35.3);
    G.mods = G.mods || {}; G.mods.lotCharge = 1.3;
  } });
// dolmuş: ana yolun batısından güney şeritle gelir, otobüsün önünde dönüp kuzey şeride geçer, kasaba durağında durur,
// yolcuları indirir, batıya gider
function updateDolmus(dt) {
  const D = G.dolmus;
  if (!D) return;
  const speed = 7;
  if (D.state === 'away') {
    if ((D.t -= dt) > 0) return;
    D.car = M.makeVillageCar('minibus'); D.car.position.set(-140, 0, -17.4); D.car.rotation.y = PI / 2; G.scene.add(D.car); // ana yolun batı ucundan (events.js ROAD_FAR)
    D.path = [V(-38.6, 0, -17.4), V(-36.6, 0, -18.6), V(-38.6, 0, -19.8), V(DOLMUS.stop, 0, -19.8)]; D.state = 'in'; D.turn = false;
  } else if (D.state === 'in' || D.state === 'out') {
    const p = D.car.position, q = D.path[0];
    // U dönüşüne girmeden batıya giden şeritte yaklaşan taşıt geçer (2026-11-05: önüne kırıp içinden geçiyordu)
    if (D.state === 'in' && q && !D.turn && Math.abs(q.x + 36.6) < 0.05) { if (G.hooks.roadBusy && G.hooks.roadBusy(D.car, -46, -22, -20.9, -18.7)) return; D.turn = true; }
    if (!q) { if (D.state === 'in') { D.state = 'stop'; D.t = 3.2; } else { G.scene.remove(D.car); D.car = null; D.state = 'away'; D.t = 55 + Math.random() * 30; } return; }
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), yieldK = (G.hooks.crossK && d > 0.01 ? G.hooks.crossK(p, dx / d, dz / d) : 1) * (G.hooks.gapK ? G.hooks.gapK(D.car, D.path) : 1); // yaya geçidinde (roads.js), önündeki taşıtta (events.js yol düzeni)
    const st = Math.min(d, speed * dt * yieldK * (D.state === 'in' && d < 6 ? Math.max(0.35, d / 6) : 1));
    if (d < 0.05) { D.path.shift(); return; }
    p.x += (dx / d) * st; p.z += (dz / d) * st; D.car.rotation.y = lerpAngle(D.car.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 5)); // kısa yoldan döner (eskiden U dönüşünde ters yöne tam tur atıyordu)
    for (const w of D.car.userData.wheels || []) w.rotation.x += st / (0.36 * D.car.scale.x);
  } else if (D.state === 'stop') {
    if (!D.dropped) { D.dropped = true; const n = 3 + Math.floor(Math.random() * 2); for (let k = 0; k < n; k++) setTimeout(() => G.hooks.koyVisitor && G.hooks.koyVisitor(V(DOLMUS.stop + (k - 1.5) * 0.6, 0, -21.9)), k * 450); }
    if ((D.t -= dt) <= 0) { D.dropped = false; D.state = 'out'; D.path = [V(-140, 0, -19.8)]; }
  }
}

// =====================================================================
// BALIKÇI İSKELESİ: denize uzanan güverteler
// =====================================================================
// güverte: tahta zemin, kazıklar, korkuluk (açık kenar hariç). İskelenin yanına bitişen kenarın korkuluğu açılır
const DECK = { x0: -38.8, x1: -25.6, z0: 30.6, z1: 43.6 };
function buildDeck(c, x0, x1, z0, z1, openSide) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rail = M.mat('#a8703f'), dark = M.mat('#6b4a2e');
  const pl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), new THREE.MeshStandardMaterial({ map: texRep('wood', w / 1.6, d / 3), roughness: 0.85 }));
  pl.position.set(cx, -0.03, cz); pl.receiveShadow = true; c.group.add(pl);
  pl.material.map.offset.set(x0 / 1.6, -z1 / 3); // tahtalar dünyaya hizalı: ana iskeleyle (fishing.js makeDeck) birleşimde çizgiler kaymaz
  for (let x = x0 + 0.3; x <= x1; x += 3.0) for (const z of [z0 + 0.3, z1 - 0.3]) M.cyl(0.14, 0.16, 1.4, 8, dark, x, -0.75, z, c.group);
  const side = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.6));
    for (let i = 0; i <= n; i++) M.cyl(0.05, 0.06, 0.95, 6, rail, ax + ((bx - ax) * i) / n, 0.5, az + ((bz - az) * i) / n, c.group);
    const r = M.rbox(L, 0.08, 0.08, 0.02, rail, (ax + bx) / 2, 0.95, (az + bz) / 2, c.group); r.rotation.y = -Math.atan2(bz - az, bx - ax);
    c.col(Math.min(ax, bx) - 0.12, Math.max(ax, bx) + 0.12, Math.min(az, bz) - 0.12, Math.max(az, bz) + 0.12);
  };
  const i = 0.1; // korkuluk ana iskeledeki gibi kenardan 10 cm içeride: birleşimde iki korkuluk aynı hizada
  if (openSide !== 'n') side(x0, z1 - i, x1, z1 - i);
  if (openSide !== 's') side(x0, z0 + i, x1, z0 + i);
  if (openSide !== 'e') side(x1 - i, z0, x1 - i, z1);
  if (openSide !== 'w') side(x0 + i, z0, x0 + i, z1);
}
// iskelenin x kenarındaki korkuluğu z0..z1 arasında açar: engeli böler, o aralıktaki korkuluk parçalarını gizler
function openDeckRail(x, z0, z1) {
  const i = G.colliders.findIndex((c) => Math.abs((c[0] + c[1]) / 2 - x) < 0.3 && c[1] - c[0] < 0.5 && c[2] <= z0 && c[3] >= z1);
  if (i >= 0) { const c = G.colliders[i]; G.colliders.splice(i, 1, [c[0], c[1], c[2], z0], [c[0], c[1], z1, c[3]]); }
  const R = G.regions.iskele, v = new THREE.Vector3(), box = new THREE.Box3();
  R.content.parent && R.content.parent.updateMatrixWorld(true);
  G.scene.traverse((o) => {
    if (!o.isMesh) return; // birleştirilmiş (perf.js) parçanın aslı da gizlenir: birleşim kendini bozar
    box.setFromObject(o); box.getCenter(v);
    if (Math.abs(v.x - x) < 0.3 && v.z > z0 - 0.2 && v.z < z1 + 0.2 && box.max.y > 0.2 && box.min.y < 1.2 && box.max.x - box.min.x < 0.6) {
      if (box.max.z - box.min.z > (z1 - z0) + 1) return; // boydan boya tırabzan: kısalt
      o.visible = false;
    }
  });
  // boydan boya tırabzan tek parça: açık aralığın iki yanında yenisi çizilir
  G.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    box.setFromObject(o); box.getCenter(v);
    if (Math.abs(v.x - x) < 0.3 && box.max.z - box.min.z > (z1 - z0) && box.max.x - box.min.x < 0.4 && box.min.y > 0.4) {
      o.visible = false;
      const rail = M.mat('#a8703f');
      for (const [a, b] of [[box.min.z, z0], [z1, box.max.z]]) if (b - a > 0.2) { const r = M.rbox(0.08, box.max.y - box.min.y, b - a, 0.02, rail, x, (box.min.y + box.max.y) / 2, (a + b) / 2); G.scene.add(r); }
    }
  });
}
defineExpansion({ id: 'xiskele1', region: 'iskele', tier: 1, icon: '🪝', title: 'İskele Uzantısı', price: 2000, rect: [-26.0, -19.2, 34.0, 43.4], at: [-26.5, 37.5], tex: 'wood', noGround: true,
  info: { text: 'İskele doğuya uzadı, balık ağı kuruldu.', steps: [['balik', 'Ağın kasasında kendiliğinden balık birikir; topla, tezgaha ya da ızgaraya götür.']] },
  build: (c) => {
    buildDeck(c, -25.6, -19.2, 34.0, 43.6, 'w'); // güney kenarı ana iskeleyle aynı hizada (43,6; eskiden 43,4'te 20 cm basamak vardı)
    openDeckRail(DECK.x1, 34.2, 43.2);
    c.gen(makeNetRack(), -22.3, 42.4, 'balik', { interval: 6.5, max: 8, trayDz: -1.8, zoneDz: -1.25, trayY: 0.1 }); c.col(-23.5, -21.1, 42.2, 43.2);
  } });
defineExpansion({ id: 'xiskele2', region: 'iskele', tier: 2, icon: '🍲', title: 'Balık Çorbası', price: 3200, rect: null, at: [-22.3, 39.6],
  info: { text: 'Yeni iş: balık çorbası!', steps: [['balik', 'Balığı mutfağın soldaki masasına bırak, çorba pişer.'], ['balikcorba', `Restoranda bazı müşteriler balık çorbası ister: masaya götür, ${ITEMS.balikcorba.price} ₺ öder.`]] },
  build: (c) => { c.machine(M.model('pot-stew'), -22.3, 35.0, 'balik', 'balikcorba', 5.0); if (G.fish) G.fish.menu = ['balikcorba']; } });
// açılış yeri iskelenin güneybatı köşesindeki boş şeritte, terasın açılacağı korkuluğun dibinde (2026-11-03 kullanıcı: "teras açılımı
// için olan bölge denizin içinde kalıyor, ulaşamıyorum": eskiden -41,8 / 39,4'teydi, terasın yerinde, suyun üstünde)
defineExpansion({ id: 'xiskele3', region: 'iskele', tier: 3, icon: '🍽️', title: 'Restoran Terası', price: 4400, rect: [-45.0, -38.2, 35.6, 43.4], at: [-37.0, 42.0], tex: 'wood', noGround: true,
  info: { text: 'Restoranın batısına deniz manzaralı teras eklendi.', steps: [['🍽️', 'Dört masa daha: aynı anda daha çok müşteri yemek yer.']] },
  build: (c) => {
    buildDeck(c, -45.0, -38.8, 35.6, 43.6, 'e'); // güney kenarı ana iskeleyle aynı hizada
    openDeckRail(DECK.x0, 35.8, 43.2);
    if (G.fish && G.fish.addTable) for (const [x, z] of [[-43.4, 37.6], [-40.4, 37.6], [-43.4, 41.0], [-40.4, 41.0]]) G.fish.addTable(x, z, c.instant);
  } });

// ---------- her kare (services.js) ----------
export function updateExpandWest(dt) {
  updateDolmus(dt);
  if (G.spinWheel) G.spinWheel.userData.wheel.rotation.z -= dt * 3;
  for (const w of washes) {
    const on = !!w.userData.on, W = w.userData.water;
    for (const b of w.userData.brushes) b.rotation.y += dt * (on ? 9 : 0.6);
    if (!W) continue;
    W.k = Math.max(0, Math.min(1, W.k + (on ? dt * 1.5 : -dt * 0.12))); // birikinti yavaşça kurur
    W.pud.visible = W.k > 0.01; W.pud.material.opacity = 0.55 * W.k;
    W.water.visible = on;
    if (!on) continue;
    const t = G.time;
    W.wm.opacity = 0.32 + Math.sin(t * 17) * 0.08;
    W.dd.forEach((d, i) => { d.y -= d.v * dt; if (d.y < 0.05) { d.y = 2.7; d.x = (Math.random() * 2 - 1) * 1.1; } WM4.makeTranslation(d.x * (0.75 + d.y * 0.1), d.y, d.z); W.drops.setMatrixAt(i, WM4); });
    W.drops.instanceMatrix.needsUpdate = true;
    W.foam.scale.setScalar(0.85 + Math.sin(t * 3) * 0.12);
  }
}
const WM4 = new THREE.Matrix4();
const washes = [];
G.hooks.washModel = (w) => washes.push(w);
