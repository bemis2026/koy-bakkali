// Yollar: haritanın dışındaki yollar da yürünür, bölge kilidi gerekmez.
// Ana yol (asfalt) batı girişindeki benzinlikten kasaba, otopark ve köyün kuzeyinden geçip çiftlik köşesinde biter; oradan
// taş döşeli köy caddesi köyle pazarın arasından pazar caddesine iner, pazar caddesi köprüden nehrin öbür yakasına gider.
// Köy yolu batı ovasının içinden (tarlalar, at ahırı, mera, atölye) köye gelir. Enerji yolu ana yoldan elektrik direkleri
// boyunca kuzeybatıdaki enerji parkına çıkar.
// Sahil yolu: kumsal boyunca tahta yürüyüş yolu; batı ucunda atölyenin yanından köy yoluna bağlanır.
// İpek Yolu: kervanların özel yolu. Kuzeydeki dağ geçidinden x -31 boyunca iner, hanın önündeki meydana döner;
// güneye uzanan kolu ana yola bağlanır. Han yolu ana yolu köyün kuzeyine ve hana bağlar: bütün yollar birbirine çıkar.
import * as THREE from 'three';
import * as M from './models.js';
import { texRep, softEdge } from './tex.js';
import { G, popIn } from './game.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// kervanın yürüdüğü çizgi (world.js Caravan bunu izler)
export const SILK_ROAD = [V(-31, 0, -134), V(-31, 0, -32.4), V(-2.2, 0, -32.4)];
// [minX, maxX, minZ, maxZ]; bölgelerin yürüme alanlarına biraz biner ki geçişte takılmasın
const WALKWAYS = [
  [-92, -15.2, 8.0, 13.1],    // köy yolu: batı ovasının tarlaları arasından köye
  [-97, 22.5, -22.8, -14.4], // ana yol ve iki yanındaki kaldırımlar (benzinlik avlusu açılınca station.js ekler)
  [-62.8, -59.2, -60.0, -22.4], // enerji yolu: ana yoldan kuzeye
  [-84.2, -59.2, -59.8, -56.8], // enerji parkının önündeki kol
  [52.2, 132, 3.6, 9.4],      // pazar caddesi ve köprü (kaldırımlarıyla)
  [-23.4, 14.4, -20.4, -16.8], // han yolu: ana yoldan köyün kuzeyine
  [11.0, 14.2, -30.2, -14.0], // köyden hana çıkan yol
  [-15.8, -12.4, -17.4, -14.2], // köyün kuzeybatı patikası
  [-42.6, -23.0, -16.0, -4.4],  // eski otoparkın yeri (otopark 2026-11-01'de kasabanın batısına taşındı): bisiklet parkı ve paket servis cebi
  [52.2, 67.8, 28.0, 30.6],   // plajın doğu ucundan dereyi geçip tatil köyüne giden köprü
];

// bölgesiyle açılan yollar (2026-11-06 kullanıcı: "sahil yolunu plaj ile açılır yap açılmadan olmasın", "ipek yolu da kervan ile açılsın"):
// her biri kendi grubunda gizli durur; yürüme alanı, engelleri ve bordürleri de açılınca eklenir (world.js unlockRegion)
const GATED = {};
function gatedRoad(id, walk, build) {
  const g = new THREE.Group(), cols = [], n = CURBS.length;
  g.name = `yol-${id}`; g.visible = false; G.scene.add(g);
  build(g, cols);
  g.traverse((o) => { if (o.isMesh && o.geometry.type !== 'PlaneGeometry') o.castShadow = true; });
  return (GATED[id] = { g, walk, cols, curbs: CURBS.splice(n), shut: null, on: false });
}
export function openRoad(id, instant) {
  const r = GATED[id];
  if (!r || r.on) return;
  r.on = true; r.g.visible = true;
  if (r.shut) r.shut.visible = false;
  G.walkways.push(...r.walk); G.colliders.push(...r.cols); CURBS.push(...r.curbs);
  if (!instant) { let d = 0; for (const ch of r.g.children) { if (ch.isMesh && ch.geometry.type === 'PlaneGeometry') continue; popIn(ch, d); d += 0.02; } }
}

function flat(parent, x0, x1, z0, z1, texName, tile, y) {
  // toprak patika kenarı çimene yumuşak geçer (biraz taşar ki görünen eni aynı kalsın); asfalt, taş ve tahta keskin kalır
  const soft = texName === 'path', p = soft ? 0.35 : 0;
  x0 -= p; x1 += p; z0 -= p; z1 += p;
  const w = x1 - x0, d = z1 - z0;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: texRep(texName, w / tile, d / tile), roughness: 0.95,
    ...(soft ? { alphaMap: softEdge(w, d, 0.7), transparent: true, depthWrite: false } : {}) }));
  m.rotation.x = -PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true;
  parent.add(m);
  return m;
}

// pazar caddesi: ortada iki şeritli asfalt (z 5-8,2, ortası kesik çizgili), iki yanında taş kenarlı kaldırım; pazarın içinde
// güney kenarda kamyon park cebi (beyaz çizgili), batı ucunda dönüş yeri. Köprüde suyun üstüne düzlem konmaz
// yaya geçitleri (2026-11-01 kullanıcı: "yaya geçidi yapabilirsin yola"): insanların yolu geçtiği yerlerde beyaz bantlar.
// Pazar caddesinde sahile iniş, tatil köyü kapısı ve lunapark kapısı; ana yolda han yolu, köyün kuzeybatı patikası ve kasaba girişi
// 2026-11-02: ana yola enerji yolunun ağzında (-61) bir geçit daha: otoparktan ve kasabanın batısından köye inenler için
// arnavut taşı her yerde aynı boyda: 2,4 m'lik doku (bölge zeminleri, genişlemeler, lunapark, şehir). 2026-11-04 kullanıcı: kaldırımlar 1,6,
// meydan girişi, han avlusu ve İpek Yolu 2,2 idi; yan yana gelen taş zeminlerde taş boyu farklı görünüyordu
const CROSS_PZ = [30.6, 71.5, 93.6], CROSS_MAIN = [12.6, -14.1, -45.5, -61.0];
// yürüyenin basabildiği bordürler [x0, x1, z0, z1, üst]: world.js heightAt yürüyeni üstüne çıkarır (2026-11-04: bordürü geçen ve
// üstünde duranların ayakları 10-12 cm taşın içine gömülüyordu). G.curbs olarak paylaşılır
const CURBS = [];
function kerb(w, h, d, r, m, x, y, z, g) {
  const b = M.rbox(w, h, d, r, m, x, y, z, g), e = [x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h / 2];
  CURBS.push(e); b.userData.kerb = e;
  return b;
}
function crosswalk(g, x, z0, z1, y) {
  const m = M.mat('#f6f5ef', { rough: 0.7 });
  for (let z = z0 + 0.28; z + 0.42 <= z1 - 0.2; z += 0.74) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.42), m); s.rotation.x = -PI / 2; s.position.set(x, y, z + 0.21); s.receiveShadow = true; g.add(s);
  }
}
function pazarStreet(g) {
  const cm = M.mat('#d9d4c8'), line = M.mat('#ffffff');
  for (const [x0, x1] of [[23, 57.6], [66.4, 132]]) {
    flat(g, x0, x1, 5.0, 8.2, 'asphalt', 3, 0.012);
    flat(g, x0, x1, 3.7, 5.0, 'cobble', 2.4, 0.016); // kuzey kaldırım
    curb(g, x0, x1, 5.0, [], cm, 0.12, CROSS_PZ); // ana yoldaki gibi yaya geçitlerinde açık
    for (let x = x0 + 1.2; x < x1 - 1; x += 2.6) if (!CROSS_PZ.some((c) => Math.abs(x - c) < 2)) M.rbox(1.3, 0.02, 0.12, 0.005, line, x, 0.022, 6.6, g); // şerit çizgisi (geçitte yok)
  }
  // güney: doğuda kaldırım, pazarın içinde park cebi ve arkasında kaldırım
  flat(g, 66.4, 132, 8.2, 9.3, 'cobble', 2.4, 0.016); curb(g, 66.4, 132, 8.2, [], cm, 0.12, CROSS_PZ);
  flat(g, 44.8, 57.6, 8.2, 9.3, 'cobble', 2.4, 0.016); curb(g, 44.8, 57.6, 8.2, [], cm, 0.12, CROSS_PZ);
  flat(g, 23, 44.8, 8.2, 11.0, 'asphalt', 3, 0.013); // park cebi
  flat(g, 23, 44.8, 11.0, 12.0, 'cobble', 2.4, 0.016); curb(g, 23, 44.8, 11.0, [], cm, 0.12, CROSS_PZ); // geçitten cebi geçen kaldırıma çıkar
  for (const x of [25.4, 34.1, 42.8]) M.rbox(0.1, 0.02, 2.6, 0.005, line, x, 0.024, 9.6, g); // cep çizgileri
  M.rbox(21.8, 0.02, 0.1, 0.005, line, 33.9, 0.024, 8.3, g);
  for (const x of CROSS_PZ) crosswalk(g, x, 5.0, 8.2, 0.02);
}

export function buildRoads() {
  G.walkways = WALKWAYS; G.curbs = CURBS;
  const g = new THREE.Group();
  g.name = 'roads'; // main.js açılışta parçaları birleştirir (perf.js bakeStatic)
  G.scene.add(g);
  pazarStreet(g);
  for (const x of CROSS_MAIN) crosswalk(g, x, -21.4, -15.8, -0.02); // ana yol (decor.js, asfaltı y -0,03)
  sidewalks(g);
  G.hooks.crossK = crossK;
  // sahil yolu: tahta, kenarında lambalar; batı ucundan atölyenin yanındaki patikayla köy yoluna çıkılır
  gatedRoad('sahil', [[-60, -15.2, 28.8, 30.6], [-59.6, -57.6, 12.6, 30.6]], (s) => { // yol ve batı ucundan köy yoluna inen patika (atölyenin batısı)
    flat(s, -60, -15.6, 28.9, 30.5, 'wood', 2.2, 0.015);
    for (const x of [-57.5, -48, -38]) { const l = M.makeLamp(); l.position.set(x, 0, 31.0); s.add(l); }
    flat(s, -59.4, -57.8, 12.8, 28.9, 'path', 3, 0.012);
  });
  const silk = gatedRoad('han', [[-33.2, -28.8, -64, -21.2], [-33.2, -15.2, -34.6, -30.2]], silkRoad); // yürünen kısmı, ana yola inen kolu ve hana dönen ucu
  // İpek Yolu açılana kadar kaldırımın bordüründeki ağzı kapalı
  silk.shut = new THREE.Group(); G.scene.add(silk.shut);
  M.rbox(4.4, 0.1, 0.16, 0.02, M.mat('#cfc6b4', { rough: 0.9 }), -31, 0.05, SIDE_N[1] - 0.05, silk.shut);
  beachBridge(g);
  energyRoad(g);
  villageStreet(g);
  // han yolu: ana yolun köyün kuzeyindeki kesiminden hana çıkan toprak yol; köyün kuzeybatı kapısına inen kısa patika
  flat(g, 11.1, 14.1, -28.4, -21.2, 'path', 3, 0.011);
  flat(g, -15.6, -12.6, -15.8, -14.0, 'path', 3, 0.011);
  const hs = M.makeSign('KERVANSARAY ↑', '#2f6db5', 2.8, 0.75); hs.position.set(21.4, 0, -25.0); g.add(hs); // çiftlik yolunun kuzeyinde, tarlalara giden koridorun doğu kenarında
  for (const x of [20.05, 22.75]) G.colliders.push([x - 0.1, x + 0.1, -25.1, -24.9]);
  g.traverse((o) => { if (o.isMesh && o.geometry.type !== 'PlaneGeometry') o.castShadow = true; });
}

// ---------- kaldırımlar ve yaya geçitleri ----------
// 2026-11-02 kullanıcı: "insanlar otoyol üzerinde yürüyorlar, onlara kaldırım vb. yaya yolu yapılmalı, köy usulü mimaride. Arabalar yaya
// geçidinde yayalar geçerken dursun, yaya yoksa yavaş geçsin". Ana yolun iki yanında arnavut kaldırımı yaya yolu, yol tarafında taş
// bordür (geçitlerde ve araç girişlerinde açık); fırının önünde vitrinlere bakan dar şerit (müşteri orada durur).
// world.js yol bulma asfaltı yayaya pahalı sayar, karşıya geçeni en yakın geçide götürür (ROAD_BANDS). Araçla gidenler yolu kullanır.
export const ROAD_BANDS = [
  { r: [-97, 22.5, -21.4, -15.8], cross: CROSS_MAIN, open: [{ r: [-16, 10, -21.4, -20.8], side: -1 }] },
];
export const CROSSWALKS = [...CROSS_MAIN.map((x) => ({ x, z0: -21.4, z1: -15.8 })), ...CROSS_PZ.map((x) => ({ x, z0: 5.0, z1: 8.2 }))];
const SIDE_N = [-22.75, -21.4], SIDE_S = [-15.8, -14.45];
// bordürün açık olduğu araç girişleri: otoparkın çıkışı ve girişi, enerji yolu, İpek Yolu'nun ağzı (kuzey); benzinlik avlusu, bisiklet yolu,
// köy arabalarının cebi, köy caddesi (güney)
const GAPS_N = [[-89.4, -84.2], [-71.4, -67.6], [-63, -59], [-33.2, -28.8]];
const GAPS_S = [[-88.1, -62.4], [-43.2, -40.4], [-31.8, -23.8], [14.6, 23]]; // ilki benzinliğin batıdaki şerit girişini (x −86,6) de kapsar: araba bordürün üstünden geçmesin
function sidewalks(g) {
  const stone = M.mat('#cfc6b4', { rough: 0.9 });
  flat(g, -97, -16, SIDE_N[0], SIDE_N[1], 'cobble', 2.4, 0.014);
  flat(g, -16, 10, -21.4, -20.8, 'cobble', 2.4, 0.014); // fırın vitrinlerinin önü
  flat(g, -97, 22.5, SIDE_S[0], SIDE_S[1], 'cobble', 2.4, 0.014);
  curb(g, -97, -16, SIDE_N[1] - 0.05, GAPS_N, stone, 0.1);
  curb(g, -97, 22.5, SIDE_S[0] + 0.05, GAPS_S, stone, 0.1);
  curb(g, -16, 10, -20.82, [], stone, 0.025); // fırın şeridinin kenarı yolla bir hizada (geçen arabanın tekeri değmez)
}
function curb(g, x0, x1, z, gaps, m, h, cross = CROSS_MAIN) {
  const cuts = [...gaps, ...cross.map((x) => [x - 1.45, x + 1.45])].sort((a, b) => a[0] - b[0]);
  const seg = (a, b) => { if (b - a > 0.3) kerb(b - a, h, 0.16, Math.min(0.02, h / 2 - 0.003), m, (a + b) / 2, h / 2, z, g); };
  let x = x0;
  for (const [a, b] of cuts) { if (b <= x || a >= x1) continue; if (a > x) seg(x, a); x = Math.max(x, b); }
  if (x < x1) seg(x, x1);
}
// araç hız çarpanı (G.hooks.crossK): gidiş yönünde önündeki geçitte yaya varsa çizgiden önce durur (0), yoksa geçide yaklaşırken ve
// üstündeyken yavaşlar (0,45). p: aracın yeri, (hx, hz): gidiş yönü (birim). Geçitlerin doluluğu her karede bir kez sayılır
let occT = -1;
function occupancy() {
  if (occT === G.time) return;
  occT = G.time;
  for (const c of CROSSWALKS) c.busy = false;
  const see = (p) => { for (const c of CROSSWALKS) if (Math.abs(p.x - c.x) < 1.5 && p.z > c.z0 - 0.5 && p.z < c.z1 + 0.5) c.busy = true; };
  if (G.player) see(G.player.position);
  for (const c of G.customers || []) if (!c.riding) see(c.obj.position);
  for (const w of G.workers || []) if (!w.riding) see(w.obj.position);
}
export function crossK(p, hx, hz) {
  if (Math.abs(hx) < 0.6) return 1; // yola dik giden (yoldan çıkan, yola giren) geçide gelmez
  occupancy();
  let k = 1;
  for (const c of CROSSWALKS) {
    if (p.z < c.z0 - 0.5 || p.z > c.z1 + 0.5) continue;
    const ahead = (c.x - p.x) * Math.sign(hx); // geçide uzaklık (gidiş yönünde)
    if (ahead < -2.5 || ahead > 9) continue;
    const slow = ahead > 4 ? 0.45 + 0.55 * Math.min(1, (ahead - 4) / 5) : 0.45;
    k = Math.min(k, c.busy && ahead > 3.0 ? Math.min(slow, Math.max(0, (ahead - 4.0) / 4) * 0.6) : slow);
  }
  return k;
}

// enerji yolu: ana yoldan kuzeye toprak servis yolu, ucunda enerji parkının önünden geçen kol. Batı kenarında ahşap elektrik
// direkleri parktan kasabaya hat taşır (iki tel); kavşakta tabela
function energyRoad(g) {
  flat(g, -62.6, -59.4, -59.6, -22.6, 'path', 3, 0.012);
  flat(g, -84, -59.4, -59.6, -57.0, 'path', 3, 0.011);
  const wood = M.mat('#7a5534'), dark = M.mat('#3a3f45'), wire = M.mat('#2b2f33');
  const X = -63.4, zs = [];
  for (let z = -55.4; z < -25; z += 8.6) zs.push(z);
  for (const z of zs) {
    M.cyl(0.1, 0.13, 5.4, 7, wood, X, 2.7, z, g);
    M.rbox(1.5, 0.12, 0.12, 0.03, wood, X, 5.0, z, g); // travers
    for (const dx of [-0.6, 0.6]) M.cyl(0.05, 0.06, 0.22, 6, dark, X + dx, 5.17, z, g); // izolatör
    G.colliders.push([X - 0.16, X + 0.16, z - 0.16, z + 0.16]);
  }
  for (let i = 0; i + 1 < zs.length; i++) for (const dx of [-0.6, 0.6]) M.rbox(0.025, 0.025, zs[i + 1] - zs[i], 0.005, wire, X + dx, 5.22, (zs[i] + zs[i + 1]) / 2, g);
  // parkın batı, kuzey ve doğu çiti (güneyi yola açık)
  const fn = M.makeFence(21, 'x'); fn.position.set(-73.8, 0, -66.9); g.add(fn); G.colliders.push([-84.3, -63.3, -67.05, -66.75]);
  for (const x of [-84.3, -63.3]) { const f = M.makeFence(6.8, 'z'); f.position.set(x, 0, -63.5); g.add(f); G.colliders.push([x - 0.15, x + 0.15, -66.9, -60.1]); }
  const s = M.makeSign('⚡ ENERJİ PARKI ↑', '#2e8b57', 3.4, 0.75); s.position.set(-65.4, 0, -23.8); g.add(s);
  for (const x of [-66.95, -63.85]) G.colliders.push([x - 0.1, x + 0.1, -23.9, -23.7]);
}

// köy caddesi: ana yolun doğu ucundan (çiftlik köşesi) köyle pazarın arasından pazar caddesine inen taş döşeli cadde;
// iki yanında bordür, batı kenarında fenerler. Ana yol, han yolu, çiftlik yolu ve pazar caddesi burada birleşir
const street = { lamps: [] }; // büyük köy marketi caddeye dayanınca caddenin kenarına geçerler (streetLampsTo)
function villageStreet(g) {
  const curb = M.mat('#d9d4c8');
  flat(g, 19.1, 22.5, -15.8, 3.7, 'cobble', 2.4, 0.014);
  flat(g, 19.1, 23.0, 3.7, 5.0, 'cobble', 2.4, 0.016); // pazar caddesinin kuzey kaldırımına bağlanır
  for (const x of [19.0, 22.6]) kerb(0.16, 0.12, 19.5, 0.02, curb, x, 0.06, -6.05, g);
  for (const z of [-12.2, -4.6, 1.6]) { const l = M.makeLamp(); l.position.set(18.7, 0, z); g.add(l); const col = [18.55, 18.85, z - 0.15, z + 0.15]; G.colliders.push(col); street.lamps.push({ l, col }); }
}
// büyük köy marketi (dukkan.js 4. aşama) caddenin batı bordürüne dayanır: fenerler dükkânın yan basamağında kalmasın diye caddenin batı
// kenarına (x, bordürün iç yanı) geçer; cadde ve bordürleri olduğu gibi kalır (2026-11-05: eskiden dükkân caddenin yarısını alıyordu)
export function streetLampsTo(x) {
  for (const s of street.lamps) { s.l.position.x = x; s.col[0] = x - 0.15; s.col[1] = x + 0.15; }
}

// plaj köprüsü: sahilin doğu ucundan (cankurtaran kulesinin önü) dereyi geçip kabuk evlere uzanan tahta yaya köprüsü.
// Güverte yere yakın (yürüyen zeminde kalır), iki yanında korkuluk, suyun içinde kazık ayaklar, iki ucunda fener
function beachBridge(g) {
  const X0 = 52.2, X1 = 67.8, Z = 29.3, W = 1.4, L = X1 - X0, cx = (X0 + X1) / 2;
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(L, W * 2), new THREE.MeshStandardMaterial({ map: texRep('wood', L / 1.1, 1.4), roughness: 0.9 }));
  deck.rotation.x = -PI / 2; deck.position.set(cx, 0.06, Z); deck.receiveShadow = true; g.add(deck);
  const beam = M.mat('#8a5a33'), post = M.mat('#6b4428');
  M.rbox(L, 0.12, 0.16, 0.03, beam, cx, 0.02, Z - W, g); M.rbox(L, 0.12, 0.16, 0.03, beam, cx, 0.02, Z + W, g); // yan kirişler
  for (const z of [Z - W, Z + W]) {
    M.rbox(L, 0.08, 0.08, 0.03, beam, cx, 0.95, z, g); // tırabzan
    M.rbox(L, 0.06, 0.05, 0.02, beam, cx, 0.55, z, g);
    for (let x = X0 + 0.2; x <= X1; x += 1.95) M.rbox(0.12, 1.0, 0.12, 0.03, post, x, 0.5, z, g);
  }
  for (let x = 55.5; x < 64.5; x += 2.2) for (const z of [Z - W, Z + W]) M.cyl(0.09, 0.09, 0.9, 6, post, x, -0.42, z, g); // sudaki kazıklar
  for (const x of [X0 + 0.15, X1 - 0.15]) { const l = M.makeLamp('#7a4a2e'); l.position.set(x, 0, Z + W + 0.35); g.add(l); G.colliders.push([x - 0.15, x + 0.15, Z + W + 0.2, Z + W + 0.5]); }
  // korkuluklar yürüyüşü köprünün üstünde tutar (uçları açık)
  G.colliders.push([X0 + 0.6, X1 - 0.6, Z - W - 0.1, Z - W + 0.05], [X0 + 0.6, X1 - 0.6, Z + W - 0.05, Z + W + 0.1]);
}

// İpek Yolu: kum taşı döşeli geniş yol, iki yanında taş bordür, mil taşları ve fenerler, girişinde kemerli kapı
function silkRoad(g, cols) {
  const stone = new THREE.MeshStandardMaterial({ map: texRep('cobble', 4 / 2.4, 1), color: '#ead2a0', roughness: 0.95 });
  const lay = (x0, x1, z0, z1) => {
    const w = x1 - x0, d = z1 - z0, m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), stone.clone());
    m.material.map = texRep('cobble', w / 2.4, d / 2.4);
    m.rotation.x = -PI / 2; m.position.set((x0 + x1) / 2, 0.014, (z0 + z1) / 2); m.receiveShadow = true; g.add(m);
  };
  lay(-33, -29, -140, -22.75); // dağ geçidinden ana yolun kaldırımına (2026-11-04: kaldırımın üstüne aynı yükseklikte taşıyordu, titreşiyordu)
  lay(-29, -15.6, -34.4, -30.4); // hana dönen kol
  const curb = M.mat('#b89a6a');
  for (const x of [-33.1, -28.9]) kerb(0.22, 0.14, 105, 0.04, curb, x, 0.07, -87.5, g); // kuzey kesimin bordürleri (kavşağa kadar)
  kerb(0.22, 0.14, 4.0, 0.04, curb, -33.1, 0.07, -32.5, g);
  kerb(0.22, 0.14, 5.9, 0.04, curb, -33.1, 0.07, -25.7, g); // bordürler kaldırımda biter: yürüyen kaldırımda taşa takılmaz
  kerb(0.22, 0.14, 7.55, 0.04, curb, -28.9, 0.07, -26.525, g);
  for (const z of [-34.5, -30.3]) kerb(13.2, 0.14, 0.22, 0.04, curb, -22.3, 0.07, z, g); // hana dönen kol köyün yanındaki koridoru da geçer
  // mil taşları: kırmızı başlıklı alçak taş dikmeler
  for (let z = -48; z > -135; z -= 14) {
    const ms = new THREE.Group(); M.rbox(0.36, 0.7, 0.28, 0.06, M.mat('#d8c39a'), 0, 0.35, 0, ms); M.rbox(0.4, 0.12, 0.32, 0.04, M.mat('#b23a48'), 0, 0.74, 0, ms);
    ms.position.set(-33.7, 0, z); g.add(ms); if (z > -64) cols.push([-33.9, -33.5, z - 0.16, z + 0.16]);
  }
  // fenerler, sırayla iki yanda
  for (let z = -40, k = 0; z > -135; z -= 18, k++) {
    const x = k % 2 ? -28.3 : -33.7, l = M.makeLamp('#7a4a2e'); l.position.set(x, 0, z); g.add(l);
    if (z > -64) cols.push([x - 0.15, x + 0.15, z - 0.15, z + 0.15]);
  }
  // girişte kemerli kapı: iki taş ayak, üstte çini bantlı lento ve tabela
  const arch = new THREE.Group(), sand = M.mat('#d9b98a');
  for (const x of [-2.75, 2.75]) { M.rbox(0.8, 4.4, 0.8, 0.08, sand, x, 2.2, 0, arch); M.rbox(1.0, 0.3, 1.0, 0.06, M.mat('#b89a6a'), x, 4.5, 0, arch); }
  M.rbox(6.4, 0.7, 0.9, 0.08, sand, 0, 4.9, 0, arch);
  M.rbox(6.5, 0.22, 0.95, 0.04, M.mat('#ffffff', { map: texRep('cini', 5, 0.4) }), 0, 4.5, 0, arch);
  const sign = M.makeSign('İPEK YOLU', '#8a3a2a', 3.6, 0.8); sign.position.set(0, 3.15, 0.5); arch.add(sign);
  arch.position.set(-31, 0, -40); g.add(arch);
  for (const x of [-33.75, -28.25]) cols.push([x - 0.4, x + 0.4, -40.4, -39.6]);
  // kavşakta yön tabelası
  const ys = M.makeSign('🐫 İPEK YOLU · KERVANSARAY →', '#8a3a2a', 3.8, 0.75); ys.position.set(-35.6, 0, -29.6); g.add(ys);
  for (const x of [-37.35, -33.85]) cols.push([x - 0.1, x + 0.1, -29.7, -29.5]);
}
