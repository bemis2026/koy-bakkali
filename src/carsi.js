// Fırın.
// Fırın: köyün kuzeyinde, han yolunun kenarında. Değirmenden gelen un çuvallarından iki taş fırın simit ve poğaça
// pişirir; vitrine dizilen ürünleri ana yoldan gelen köylüler alıp parasını bırakır. Fırıncı (upgrades.js) bu işi yapar.
// E-ticaret ofisi de buradaydı; 2026-11-09'da kalktı, yerinde çocuk parkı var (park.js).
import * as THREE from 'three';
import * as M from './models.js';
import { G, Converter, Shelf, MoneyPile, Customer, ITEMS, makeItem, popIn, rand, mult, priceOf, mineFx } from './game.js';
import { orderHtml } from './events.js';
import { repMul, maybeRush, pat } from './rating.js';
import { textTex, texRep } from './tex.js';
import { makeHall } from './salon.js';
import { makeTag } from './tags.js';
import { esya } from './esya.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const FAR_X = -140; // ana yolun batıdaki ucu (events.js arabalarıyla aynı, ROAD_FAR)

// ---------- modeller ----------
function signBoard(text, bg, w = 3.2, h = 0.6) {
  return M.rbox(w, h, 0.08, 0.03, M.mat('#ffffff', { map: textTex(text, { bg, fg: '#ffffff', w: 640, h: Math.round(640 * h / w) }) }));
}
// fırın salonu (2026-11-04 kullanıcı: "fırını köy bakkalı gibi önü ya da üstü açık kapalı bir alan yap, dışındaki nesneleri içine al"):
// eskiden ortada küçük bir bina (Poly Pizza fırını), fırınlar ve değirmen avluda dururdu. Şimdi hepsini içine alan uzun bir salon:
// arkada sıvalı duvar (tabela, saçak, baca), iki yanda öne doğru alçalan duvar, önü ve üstü açık. Genişletmelerin iki fırını da içeride
export const HALL = { x0: -23.0, x1: 10.9, zb: -27.55, zf: -21.35 };
// batı yan duvarı kaldırımın (roads.js SIDE_N, z −22,75..−21,4) gerisinde biter: kaldırımdan yürüyen köylüler ve fırın müşterileri
// duvarın içinden geçmesin
function makeBakeHall() {
  const { x0, x1, zb } = HALL, cx = (x0 + x1) / 2, H = 3.4, { g, cols } = makeHall({ ...HALL, H, band: '#c9805a', sideZ: [-22.9, HALL.zf] });
  const brick = M.mat('#e3d2b4', { map: texRep('brick', 1, 0.5) });
  g.userData.cols = cols;
  // tabela: arka duvarın üstünde iki direkte
  const sign = signBoard('🥯 KÖY FIRINI', '#b5553a', 6.2, 1.1); sign.position.set(cx, H + 1.15, zb + 0.05); g.add(sign); sign.castShadow = false;
  for (const dx of [-2.3, 2.3]) M.rbox(0.14, 0.9, 0.14, 0.04, M.mat('#7a4a2e'), cx + dx, H + 0.4, zb, g);
  // tuğla baca: ekmek ve simit fırınının arasında; duman buradan
  M.rbox(0.9, 2.0, 0.9, 0.06, brick, -11.2, H + 0.6, zb, g);
  M.rbox(1.1, 0.16, 1.1, 0.04, M.mat('#8a4a32'), -11.2, H + 1.66, zb, g);
  g.userData.smoke = V(-11.2, H + 1.9, zb);
  // ortada, eski binanın yerinde: arka duvarda ekmek rafı ve un çuvalları (süs). Pide fırını (expand-east.js xfirin2) rafın önüne
  // kurulur, raf o zaman gizlenir: birleştirmeye girmez (perf.js)
  const wood = M.mat('#a8703f'), rack = new THREE.Group(); g.add(rack); g.userData.rack = rack;
  for (const dx of [-1.9, 1.9]) M.rbox(0.1, 2.5, 0.5, 0.02, wood, -2.4 + dx, 1.25, zb + 0.42, rack);
  for (const y of [0.75, 1.4, 2.05]) M.rbox(3.9, 0.06, 0.5, 0.02, wood, -2.4, y, zb + 0.42, rack);
  const loaves = ['ekmek', 'pogaca', 'ekmek', 'simit'];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    const it = makeItem(loaves[(r + i) % 4]); it.position.set(-4.0 + i * 0.64, [0.78, 1.43, 2.08][r], zb + 0.42); it.rotation.y = i * 0.7; rack.add(it);
  }
  rack.traverse((o) => { o.userData.bkNo = true; });
  for (const [x, z, y] of [[0.3, -26.9, 0], [0.75, -26.95, 0], [0.5, -26.6, 0], [0.55, -26.85, 0.34]]) { const f = M.makeFlourSack(); f.scale.setScalar(1.4); f.position.set(x, y, z); g.add(f); }
  // hamur tezgâhı: vitrin sırasının batısında, usta arkasında yoğurur (bakeryRegion); yanında ve doğu köşede un çuvalı yığını
  const dc = makeDoughCounter(); dc.position.set(-9.0, 0, -21.95); g.add(dc);
  sackPile(g, -10.85, -21.95); sackPile(g, 9.7, -22.3);
  g.traverse((o) => { if (o.isMesh && o !== sign) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// üst üste dört un çuvalı
function sackPile(g, x, z) {
  for (const [dx, dz, y, r] of [[-0.24, 0.06, 0, 0.3], [0.24, 0, 0, -0.2], [0, -0.26, 0, 0.9], [0.02, -0.04, 0.36, 0.1]]) {
    const f = M.makeFlourSack(); f.scale.setScalar(1.35); f.position.set(x + dx, y, z + dz); f.rotation.y = r; g.add(f);
  }
}
// hamur tezgâhı: kapaklı ahşap gövde, unlu kayın tablası; ortada yoğrulan hamur, yanda oklava ve tepside bezelenmiş hamur topları
function makeDoughCounter() {
  const g = new THREE.Group(), dough = M.mat('#f1dfc0'), door = M.mat('#9a6638');
  M.rbox(2.6, 0.78, 0.78, 0.04, M.mat('#b07a46'), 0, 0.39, 0, g);
  for (const x of [-0.86, 0, 0.86]) {
    M.rbox(0.78, 0.58, 0.03, 0.02, door, x, 0.38, 0.39, g);
    M.sph(0.028, M.mat('#d4a94a', { rough: 0.4 }), x + 0.28, 0.56, 0.42, g, 8, 6);
  }
  M.rbox(2.75, 0.08, 0.9, 0.02, M.mat('#ffffff', { map: texRep('wood', 1.2, 0.4) }), 0, 0.82, 0, g);
  M.rbox(1.3, 0.006, 0.6, 0.002, M.mat('#f7f3ea'), 0.05, 0.862, -0.05, g); // un serpintisi
  M.sph(0.2, dough, 0, 0.9, -0.12, g, 14, 8).scale.set(1.4, 0.45, 1); // yoğrulan hamur
  M.cyl(0.022, 0.022, 0.95, 8, M.mat('#d9b27c'), 0.86, 0.885, 0.16, g).rotation.z = PI / 2; // oklava
  M.rbox(0.62, 0.03, 0.42, 0.01, M.mat('#8a9098', { rough: 0.5 }), -0.92, 0.875, 0.05, g);
  for (const x of [-1.12, -0.92, -0.72]) for (const z of [-0.06, 0.16]) M.sph(0.065, dough, x, 0.925, z, g, 10, 6).scale.y = 0.7;
  return g;
}
// fırın ustası: beyaz gömlek ve pantolon, bıyıklı, aşçı kepli; hamur tezgâhının arkasında durmadan yoğurur (bakeryRegion R.update)
function makeUsta() {
  const u = M.makeCharacter({ shirt: '#f7f4ee', pants: '#e6e0d4', skin: '#e2b48c', hat: 'none', hairColor: '#2b2118', mustache: true });
  const hg = u.userData.hats || u.userData.head, white = M.mat('#ffffff');
  M.cyl(0.24, 0.22, 0.26, 16, white, 0, 0.34, 0, hg);
  M.sph(0.3, white, 0, 0.5, 0, hg, 14, 8).scale.set(1, 0.55, 1);
  u.traverse((o) => { o.userData.bkNo = true; }); // kolları oynar: birleştirmeye girmez (perf.js)
  return u;
}
// taş fırın (2026-11-04 kullanıcı: "içindeki fırınları daha güzel yap, fırına benzesin"): taş kaide, altında odun gözü; tuğla kubbe;
// önde badanalı alın duvarı, taş kemerli ağzın içinde kor, alev ve pişen ürün (prod); kubbede baca, önde yaslı kürek. Tezgâhları ayrı
// konur (makeCounter; genişletme fırınlarında expand.js). Genişlik 2,2: iki yanındaki tezgâhlara değmez
const FLAMES = [], FLAME_GEO = new THREE.ConeGeometry(0.08, 0.28, 6); // alevler: bakeryRegion titretir
export function makeBakeOven(prod = 'ekmek') {
  const g = new THREE.Group(), stone = M.mat('#cbbba0'), trim = M.mat('#b9a585', { flat: true });
  M.rbox(2.2, 0.8, 2.0, 0.08, M.mat('#e3d2b4', { map: texRep('brick', 1, 0.4) }), 0, 0.4, 0, g); // kaide
  M.rbox(2.3, 0.08, 2.1, 0.03, stone, 0, 0.82, 0, g);
  M.rbox(1.3, 0.42, 0.04, 0.01, M.mat('#2a1a12'), 0, 0.38, 1.0, g); // odun gözü
  for (const [x, y] of [[-0.16, 0.245], [0, 0.245], [0.16, 0.245], [-0.08, 0.385], [0.08, 0.385], [0, 0.525]]) M.cyl(0.075, 0.075, 0.3, 8, M.mat('#8a5a33'), x, y, 0.92, g).rotation.x = PI / 2;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, PI * 2, 0, PI / 2), M.mat('#d98a5a', { map: texRep('brick', 3, 1) }));
  dome.position.set(0, 0.86, -0.1); dome.scale.set(1, 0.95, 0.9); g.add(dome);
  // alın duvarı: basık kemerli, ortasında yuvarlak kemerli ağız
  const fs = new THREE.Shape(); fs.moveTo(-1.1, 0); fs.lineTo(1.1, 0); fs.lineTo(1.1, 0.6); fs.absellipse(0, 0.6, 1.1, 0.55, 0, PI, false); fs.lineTo(-1.1, 0);
  const hp = new THREE.Path(); hp.moveTo(-0.36, 0.14); hp.lineTo(0.36, 0.14); hp.lineTo(0.36, 0.36); hp.absarc(0, 0.36, 0.36, 0, PI, false); hp.lineTo(-0.36, 0.14);
  fs.holes.push(hp);
  M.mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.25, bevelEnabled: false, curveSegments: 12 }), M.mat('#f1e6d0'), 0, 0.86, 0.75, g);
  // ağzın içi: içten görünen karanlık oda (yüzleri içe bakar), korun ve alevlerin önünde pişen ürün
  const cave = M.mesh(new THREE.BoxGeometry(0.84, 0.6, 0.43), M.mat('#3a2418', { side: THREE.BackSide }), 0, 1.29, 0.535, g);
  M.sph(0.16, M.mat('#ffb347', { emissive: '#ff7a1c', ei: 1.4 }), 0, 1.0, 0.42, g, 10, 6).scale.set(1.7, 0.35, 0.8);
  for (const [x, z, s] of [[-0.12, 0.42, 1], [0.1, 0.45, 0.8], [0.0, 0.38, 1.2]]) {
    const f = M.mesh(FLAME_GEO, M.mat('#ffd36b', { emissive: '#ffa21c', ei: 1.6 }), x, 1.13, z, g); f.userData.s = s; f.userData.bkNo = true; f.scale.setScalar(s); FLAMES.push(f);
  }
  for (const [x, ry] of [[-0.17, 0.3], [0.17, -0.5]]) { const it = makeItem(prod); it.scale.setScalar(0.75); it.position.set(x, 1.0, 0.64); it.rotation.y = ry; g.add(it); }
  M.mesh(new THREE.TorusGeometry(0.43, 0.065, 6, 16, PI), trim, 0, 1.22, 1.0, g); // taş kemer
  for (const s of [-1, 1]) M.rbox(0.13, 0.24, 0.12, 0.02, trim, s * 0.43, 1.1, 1.0, g);
  M.rbox(1.05, 0.07, 0.32, 0.02, trim, 0, 0.965, 1.05, g); // ağzın taş eşiği
  M.rbox(0.34, 0.9, 0.34, 0.03, M.mat('#c9774a', { map: texRep('brick', 0.5, 0.6) }), 0.45, 1.95, -0.45, g); // baca
  M.rbox(0.46, 0.08, 0.46, 0.02, M.mat('#7a4a32'), 0.45, 2.42, -0.45, g);
  const peel = new THREE.Group(), pw = M.mat('#c49a62'); // fırıncı küreği, alın duvarına yaslı
  M.cyl(0.024, 0.024, 1.5, 6, pw, 0, 0.75, 0, peel);
  M.rbox(0.3, 0.34, 0.025, 0.02, pw, 0, 1.66, 0, peel);
  peel.position.set(0.82, 0, 1.2); peel.rotation.x = -0.1; g.add(peel);
  g.traverse((o) => { if (o.isMesh && o !== cave) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
// fırın tezgâhı: unlu kayın tablası, altında raf. Un konan tezgâhın rafında un çuvalları, ürün çıkanınkinde istif fırın tepsileri.
// Tablanın üstü 0,86'da: ürün tepsisi (Converter inTray/tray) aynı yükseklikte
function makeCounter(w, d, under) {
  const g = new THREE.Group(), top = M.mat('#ffffff', { map: texRep('wood', w / 2, 0.4) }), leg = M.mat('#8a5a33');
  M.rbox(w, 0.08, d, 0.02, top, 0, 0.82, 0, g);
  M.rbox(w * 0.7, 0.006, d * 0.55, 0.002, M.mat('#f7f3ea'), -w * 0.05, 0.862, 0.02, g); // un serpintisi
  M.rbox(w - 0.12, 0.1, d - 0.12, 0.02, leg, 0, 0.73, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.rbox(0.08, 0.72, 0.08, 0.02, leg, sx * (w / 2 - 0.08), 0.36, sz * (d / 2 - 0.08), g);
  M.rbox(w - 0.1, 0.04, d - 0.1, 0.01, top, 0, 0.16, 0, g); // alt raf
  if (under === 'sack') for (const [x, r] of [[-w * 0.21, 0.3], [w * 0.21, -0.4]]) { const s = M.makeFlourSack(); s.position.set(x, 0.18, 0); s.rotation.y = r; g.add(s); }
  else for (let i = 0; i < 3; i++) M.rbox(w - 0.3, 0.035, d - 0.25, 0.01, M.mat('#6f747b', { rough: 0.5 }), 0, 0.2 + i * 0.06, 0, g);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function makeTable(w = 2.2, d = 0.9) {
  const g = new THREE.Group(), wood = M.mat('#c98b52');
  M.rbox(w, 0.08, d, 0.02, wood, 0, 0.82, 0, g);
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) M.rbox(0.07, 0.8, 0.07, 0.02, M.mat('#8a5a33'), x, 0.4, z, g);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// vitrin: camlı tezgah, önünde fiyat şeridi
// değirmen taşı: ahşap kasnak üstünde iki taş, tepesinde huni, yanında un çuvalı
function makeMillstone() {
  const g = new THREE.Group(), stone = M.mat('#b8b2a6', { flat: true }), wood = M.mat('#a8703f');
  M.rbox(1.3, 0.5, 1.0, 0.06, wood, 0, 0.25, 0, g);
  M.cyl(0.5, 0.52, 0.18, 14, stone, 0, 0.6, 0, g);
  M.cyl(0.48, 0.48, 0.16, 14, stone, 0, 0.78, 0, g);
  M.mesh(new THREE.ConeGeometry(0.32, 0.4, 8, 1, true), wood, 0, 1.1, 0, g).rotation.x = Math.PI; // huni
  const s = M.makeFlourSack(); s.scale.setScalar(1.3); s.position.set(0.85, 0, 0.15); g.add(s);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makeVitrine(w = 3.4) {
  const g = new THREE.Group();
  M.rbox(w, 0.8, 0.9, 0.06, M.mat('#c98b52'), 0, 0.4, 0, g);
  M.rbox(w - 0.1, 0.06, 0.85, 0.02, M.mat('#f7e2c4'), 0, 0.83, 0, g);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: '#cfeefc', transparent: true, opacity: 0.35, roughness: 0.1 }));
  glass.position.set(0, 1.1, 0.42); g.add(glass);
  M.rbox(w, 0.16, 0.04, 0.01, M.mat('#e8604c'), 0, 0.6, 0.47, g);
  g.traverse((o) => { if (o.isMesh && o !== glass) o.castShadow = true; });
  return g;
}

// ---------- fırın ----------
export function bakeryRegion(R, h) {
  const C = R.content;
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; C.add(o); return o; };
  R.house = put(makeBakeHall(), 0, 0, 0); // salonun duvarları, ekmek rafı ve un çuvalları engel
  for (const c of R.house.userData.cols) h.rcol(...c);
  h.rcol(-4.5, -0.3, HALL.zb, HALL.zb + 0.7); h.rcol(0.0, 1.05, -27.3, -26.3);
  h.rcol(-11.4, -7.65, -22.4, -21.5); h.rcol(9.2, 10.2, -22.65, -21.85); // hamur tezgâhı ve çuval yığınları
  // değirmen taşı: binanın doğusunda; önündeki masanın soluna buğday konur, öğütülen un sağında birikir
  R.millStone = put(makeMillstone(), 3.4, 0, -26.3);
  h.rcol(2.4, 4.3, -27.1, -25.6);
  R.ovens = []; R.smokeT = 0;
  // tek ürünlü vitrinler: ekmek, simit, poğaça ve genişletmeyle pide; her biri kendi yerinde
  const VIT_X = { ekmek: -5.4, simit: -3.6, pogaca: -1.8, pide: 0 }, VIT_W = 1.6;
  R.vitrins = []; R.vitrinOf = {};
  R.addVitrin = (type, instant) => {
    if (R.vitrinOf[type]) return R.vitrinOf[type];
    const x = VIT_X[type];
    if (x === undefined) return null;
    const vg = put(makeVitrine(VIT_W), x, 0, -21.9); if (!instant) popIn(vg);
    const tag = makeTag(ITEMS[type].name.toLocaleUpperCase('tr'), [type], '#d98a2b', VIT_W - 0.12, 0.34); tag.position.set(0, 0.3, 0.466); vg.add(tag);
    h.rcol(x - VIT_W / 2 - 0.1, x + VIT_W / 2 + 0.1, -22.4, -21.4); // komşu vitrinin kutusuna değer: aradan geçilmez
    const slots = []; for (const sx of [-0.57, -0.19, 0.19, 0.57]) for (const sz of [-0.18, 0.18]) slots.push(V(sx, 0.86, sz));
    const sh = new Shelf({ zx: x, zz: -23.0, zw: VIT_W, zd: 0.8, accepts: [type], cap: slots.length, group: vg, slots, instant,
      spots: [V(x - 0.4, 0, -20.9), V(x + 0.4, 0, -20.9)] });
    sh.type = type;
    sh.bodyFn = () => [[x - VIT_W / 2, x + VIT_W / 2, -22.4, -22.0]]; // yalnızca arka yüzü: önden geçen oyuncu dizmez
    R.vitrins.push(sh); R.vitrinOf[type] = sh;
    return sh;
  };
  R.activate = (instant) => {
    const t = put(makeCounter(1.6, 0.8, 'sack'), 3.4, 0, -24.9); if (!instant) popIn(t); h.rcol(2.6, 4.2, -25.3, -24.5);
    // fırının buğdayı avluda değil, köyün batısındaki Köy Tarlaları'nda yetişir (tarım kuşağı, world.js buildTarla addWheat);
    // değirmene oradan gelir (oyuncu, taşıyıcı ya da fırıncı)
    const T = G.regions.tarla; if (T && T.addWheat) T.addWheat(0, instant);
    R.mill = new Converter(C, { inType: 'bugday', inCap: 8, per: 3, ix: 2.85, iz: -23.8, iw: 1.1, id: 1.2, inTray: [2.95, 0.86, -24.9], instant,
      out: { type: 'un', interval: 1.6, max: 8, origin: V(3.4, 1.3, -26.3), tray: [3.85, 0.86, -24.9], zx: 3.95, zz: -23.8, zw: 1.1, zd: 1.2 } });
    R.flour = R.mill.out; // fırınlar ve elemanlar unu değirmenin tepsisinden alır
    R.gens = { un: R.flour };
    // üç taş fırın: en batıda ekmek, binanın yanında simit, doğuda poğaça; un soldaki masaya, ürün sağdaki masadan
    for (const [x, out, iv] of [[-8.6, 'simit', 3.2], [7.6, 'pogaca', 3.8], [-13.7, 'ekmek', 2.8]]) { // ekmek ucuz (8 ₺): simit ve poğaçadan hızlı pişer ki fırını işe yarasın
      const ov = put(makeBakeOven(out), x, 0, -26.3); if (!instant) popIn(ov);
      for (const dx of [-1.8, 1.8]) { const tb = put(makeCounter(1.2, 0.8, dx < 0 ? 'sack' : 'tray'), x + dx, 0, -25.1); if (!instant) popIn(tb); }
      h.rcol(x - 2.4, x + 2.4, -27.4, -24.6);
      R.ovens.push(new Converter(C, { inType: 'un', inCap: 6, ix: x - 1.8, iz: -23.9, iw: 1.4, id: 1.2, inTray: [x - 1.8, 0.86, -25.1], instant,
        out: { type: out, interval: iv, max: 8, origin: V(x, 1.4, -26.0), tray: [x + 1.8, 0.86, -25.1], zx: x + 1.8, zz: -23.9, zw: 1.4, zd: 1.2 } }));
    }
    R.gens.simit = R.ovens[0].out; R.gens.pogaca = R.ovens[1].out; R.gens.ekmek = R.ovens[2].out;
    // vitrinler: her ürünün kendi vitrini (raf-plan.md). Arkadan (binaya bakan yandan) dizilir, köylüler önden (yol tarafından) alır
    for (const t of ['ekmek', 'simit', 'pogaca']) R.addVitrin(t, instant);
    // kasa vitrin sırasının doğu ucunda: yazarkasa yanda, para üstünde; fırıncı toplar
    const ledge = put(M.makeCashLedge(1.1, 0.9, 0.82, [0.3, -0.1]), 1.4, 0, -21.9); if (!instant) popIn(ledge);
    M.faceRegister(ledge.userData.register, 1.48, -23.6); // ekran vitrinin arkasındaki fırıncıya
    h.rcol(0.85, 1.95, -22.35, -21.45);
    R.pile = new MoneyPile(C, 1.18, -21.75, 0.84, { instant, desk: false, body: [0.85, 1.95, -22.35, -21.45] });
    R.custT = 6;
    R.usta = put(makeUsta(), -9.0, 0, -22.7); if (!instant) popIn(R.usta);
    h.rcol(-9.4, -8.6, -23.05, -22.4);
    h.hint(3.4, 2.2, -24.9, `${h.icon('bugday')}→${h.icon('un')}`, 'Değirmen', 'Buğdayı masanın soluna bırak, öğütülen unu sağından al ve fırınların soldaki masasına götür. Buğday fırının batısındaki tarladan gelir.', 3.2);
    h.hint(-13.7, 3.0, -25.1, `${h.icon('un')}→${h.icon('ekmek')}`, `Ekmek fırını · ${ITEMS.ekmek.price} ₺`, 'Unu soldaki masaya bırak, ekmeği sağdaki masadan al ve vitrine diz.', 3.0);
    h.hint(-8.6, 3.0, -25.1, `${h.icon('un')}→${h.icon('simit')}`, `Simit fırını · ${ITEMS.simit.price} ₺`, 'Unu soldaki masaya bırak, simidi sağdaki masadan al ve vitrine diz.', 3.0);
    h.hint(7.6, 3.0, -25.1, `${h.icon('un')}→${h.icon('pogaca')}`, `Poğaça fırını · ${ITEMS.pogaca.price} ₺`, 'Unu soldaki masaya bırak, poğaçayı sağdaki masadan al ve vitrine diz.', 3.4);
    h.hint(-2.7, 2.4, -22.6, '🥯', 'Vitrinler', 'Her ürünün kendi vitrini var: ekmeği, simidi ve poğaçayı kendi vitrinine arkadan diz. Köylüler önden gelip alır, parası kasaya düşer.', 3.0);
  };
  R.update = (dt) => {
    // bacadan duman: fırınlar çalışırken
    R.smokeT -= dt;
    if (R.smokeT <= 0 && R.ovens.some((o) => o.input.length)) { R.smokeT = 0.5; puff(R.house.localToWorld(R.house.userData.smoke.clone())); }
    R.fireT = (R.fireT || 0) + dt;
    for (const [i, f] of FLAMES.entries()) { const s = f.userData.s * (0.8 + 0.3 * Math.abs(Math.sin(R.fireT * 7 + i * 1.7)) + 0.08 * Math.sin(R.fireT * 23 + i)); f.scale.set(s * 0.9, s, s * 0.9); }
    if (R.usta) { // usta hamuru yoğurur: iki kol sırayla bastırır, başı hamura eğik
      const u = R.usta.userData, k = Math.sin(R.fireT * 4.5) * 0.2;
      u.arms[0].rotation.x = -0.95 + k; u.arms[1].rotation.x = -0.95 - k; u.head.rotation.x = 0.35;
    }
    R.custT -= dt;
    if (R.custT <= 0) { R.custT = rand(8, 14) / repMul(); spawnBakeryCustomer(R); } // mahalle puanı yüksekse daha sık
    updatePuffs(dt);
  };
  return R;
}
// duman bulutçukları
const puffs = [];
const puffMat = new THREE.MeshStandardMaterial({ color: '#e6e6e6', transparent: true, opacity: 0.6, depthWrite: false });
const PUFF_GEO = new THREE.SphereGeometry(0.3, 8, 6); // ortak: her duman için yeni geometri ekran kartı belleğinde birikiyordu (2026-11-10)
function puff(at) {
  const m = new THREE.Mesh(PUFF_GEO, puffMat.clone());
  m.position.copy(at); G.scene.add(m); puffs.push({ m, t: 0 });
}
function updatePuffs(dt) {
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.t += dt;
    p.m.position.y += dt * 0.8; p.m.position.x += dt * 0.25;
    p.m.scale.setScalar(1 + p.t * 0.9); p.m.material.opacity = Math.max(0, 0.6 - p.t * 0.25);
    if (p.t > 2.4) { G.scene.remove(p.m); p.m.material.dispose(); puffs.splice(i, 1); }
  }
}
// köylü fırın müşterisi: ana yoldan gelir, dolu bir vitrinin önünde durup o ürünü alır, parasını bırakıp döner
function spawnBakeryCustomer(R) {
  const open = (R.vitrins || []).filter((v) => v.count() > 0 && v.spots.some((s) => !s.c));
  if (!open.length) return;
  const V2 = open[Math.floor(Math.random() * open.length)], spot = V2.spots.find((s) => !s.c);
  const want = V2.type, need = 1 + Math.floor(Math.random() * 3);
  const z = -22.05 + rand(-0.15, 0.15); // ana yolun kuzey kaldırımı (roads.js); eskiden asfaltın ortasından yürüyordu
  const c = new Customer(V(FAR_X, 0, z), 'firin');
  maybeRush(c); // acele müşteri: sabrı yarı süre, zamanında alırsa bahşiş
  spot.c = c;
  c.go(V(-15.6, 0, z), V(-15.6, 0, -20.95), spot.p); // fırının köşesinden vitrinlerin önündeki şeride iner
  c.state = 'toShop'; c.got = 0; c.bill = 0; c.wait = 0;
  c.setBubble(want, need);
  const leave = () => { spot.c = null; c.clearBubble(); c.path = [V(-15.6, 0, -20.95), V(-15.6, 0, z), V(FAR_X, 0, z)]; c.state = 'leave'; c.leaving = true; };
  c.think = (dt) => {
    switch (c.state) {
      case 'toShop': if (c.walk(dt)) { c.state = 'buy'; c.t = 0; } break;
      case 'buy': {
        c.face(PI, dt);
        c.wait += dt; c.t += dt;
        c.setPatience(1 - c.wait / (30 * pat(c)));
        if (c.t > 0.45) {
          c.t = 0;
          const obj = c.got < need && V2.takeType(want);
          if (obj) { mineFx(c, obj); c.bill += priceOf(want, obj); c.stack.push(want, obj, 0.3); c.got++; c.setBubble(want, Math.max(1, need - c.got)); } // kendi dizdiğin ürün fazla satılır
        }
        if (c.got >= need || c.wait > 30 * pat(c)) {
          if (c.got) { const pay = Math.round(c.bill * mult()); R.pile.add(pay, c.obj.position); c.mood(true); G.stats.sold += c.got; }
          else c.mood(false);
          leave();
        }
        break;
      }
      case 'leave': if (c.walk(dt)) c.destroy(); break;
    }
  };
}
