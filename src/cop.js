// Sokak çöpü ve pisliği (2026-11-01 kullanıcı: "sokakta kediler köpekler ve başka pislikler zamanla oluşsun; bunları temizleyen çöpçü
// gibi kasabaya temizlikçi alabilelim, temizlik arabasına dönüşsün; bölümler büyüyünce çöp oluştursun, onları toplasın").
// Müşteriler arada yere çöp atar (kâğıt, kutu, muz kabuğu, şişe), sokak köpekleri pislik bırakır. Açık bölge ve bölüm çoğaldıkça çöp
// daha sık birikir ve tavanı yükselir; kasaba büyüdükçe yeni sokak kedileri ve köpekleri gelir (pets.js addStray). Sokak kirliyse
// mahalle puanı yavaş yavaş düşer. Oyuncu üstünden geçerek toplar (+1 ₺), çöpçüler (upgrades.js Sweeper) kendiliğinden toplar.
// Çöp kaydedilmez: her açılışta sokak temiz başlar. Şehir (x > 300) ayrı dünya: orada çöp birikmez
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from './models.js';
import { G, rand, pick, floatText, sfx, popIn, toast } from './game.js';
import { walkable } from './world.js';
import { EN } from './dil.js';
import { addStray } from './pets.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const litter = []; // { obj, x, z, kind, by (onu almaya giden çöpçü), byT }
// Çöp parçaları (2026-11-06 kullanıcı: "çöplerin çöp olduğunu anlaşılır yap biraz daha"): eskiden 10-20 cm'lik düz parçalardı, oyun
// kamerasından ne oldukları seçilmiyordu. Şimdi 1,5 kat büyükler ve altlarında koyu kir lekesi var; kâğıdın yanında gazete, tenekenin
// kapakları, şişenin boynu ve etiketi, pisliğin üstünde sinekler. Yeni: cips paketi, pipetli karton bardak, bağlı siyah çöp poşeti.
// Her tür bir kez çizilir, düz renkli parçaları köşe renkli tek geometride birleşir: çöp başına 2-3 çizim çağrısı
const KINDS = ['kagit', 'kagit', 'kutu', 'muz', 'sise', 'cips', 'bardak', 'torba'];
const PI = Math.PI, LITTER_S = 1.5;
const VC = new Map();
const vcMat = (rough) => { let m = VC.get(rough); if (!m) { m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0 }); VC.set(rough, m); } return m; };
// düz renkli parçalar köşe renkli tek geometride; dokulu ve saydam parçalar ayrı kalır
function merged(g, rough = 0.6) {
  g.updateMatrixWorld(true);
  const list = [], keep = [];
  g.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.map || o.material.transparent) { keep.push(o); return; }
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.applyMatrix4(o.matrixWorld);
    const n = geo.attributes.position.count, c = new Float32Array(n * 3), col = o.material.color;
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    list.push(geo);
  });
  const out = new THREE.Group();
  if (list.length) { const m = new THREE.Mesh(mergeGeometries(list), vcMat(rough)); m.castShadow = m.receiveShadow = true; out.add(m); for (const l of list) l.dispose(); }
  for (const o of keep) { const c = o.clone(); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); out.add(c); }
  return out;
}
const CIRC = new THREE.CircleGeometry(1, 18);
// yerdeki koyu leke: parçanın kir olduğu uzaktan da okunur
function stain(r, col = '#3b2f25', op = 0.3) { const m = new THREE.Mesh(CIRC, M.mat(col, { opacity: op })); m.rotation.x = -PI / 2; m.position.y = 0.012; m.scale.setScalar(r); return m; }
// yatık silindirli parça (teneke, şişe, bardak) için döndürülmüş kap
function lay(g, y, ry = 0) { const p = new THREE.Group(); p.rotation.z = PI / 2; const q = new THREE.Group(); q.position.y = y; q.rotation.y = ry; q.add(p); g.add(q); return p; }
// pisliğin üstünde dönen sinekler (updateCop döndürür)
function flies(n) {
  const f = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2, b = new THREE.Group(); b.position.set(Math.cos(a) * 0.16, (i % 2) * 0.07, Math.sin(a) * 0.16);
    M.sph(0.022, M.mat('#15171b'), 0, 0, 0, b, 6, 4);
    for (const s of [-1, 1]) M.sph(0.02, M.mat('#dfe8f0'), s * 0.018, 0.014, 0, b, 6, 4).scale.set(1, 0.3, 0.6);
    f.add(b);
  }
  return f;
}
// [çizim, leke (yarıçap, renk, saydamlık), pürüzlülük]
function drawLitter(kind) {
  const g = new THREE.Group();
  if (kind === 'kagit') { // buruşuk kâğıt ve yırtık gazete
    const a = M.ico(0.14, M.mat('#f6f3ea'), 0.04, 0.11, 0, g, 0); a.scale.set(1, 0.8, 1.1); a.rotation.set(0.4, 0.7, 0.2);
    M.ico(0.08, M.mat('#ece6d6'), -0.15, 0.07, 0.1, g, 0).rotation.set(1, 0.3, 0.5);
    const sh = new THREE.Group(); sh.position.set(-0.05, 0.02, -0.16); sh.rotation.set(0.08, 0.5, -0.06); g.add(sh);
    M.rbox(0.34, 0.014, 0.26, 0.005, M.mat('#e9e4d6'), 0, 0, 0, sh);
    for (let i = 0; i < 4; i++) M.rbox(i ? 0.24 : 0.28, 0.004, i ? 0.025 : 0.05, 0.001, M.mat(i ? '#8d8d8d' : '#3a3a3a'), 0, 0.009, -0.09 + i * 0.055, sh);
    return [g, [0.24], 0.95];
  }
  if (kind === 'kutu') { // ezik kola tenekesi: kırmızı gövde, beyaz bant, gümüş kapaklar ve açma halkası
    const p = lay(g, 0.075, 0.3);
    M.cyl(0.075, 0.075, 0.24, 14, M.mat('#d93a2e'), 0, 0, 0, p); M.cyl(0.077, 0.077, 0.07, 14, M.mat('#ffffff'), 0, 0.01, 0, p);
    for (const s of [-1, 1]) M.cyl(s > 0 ? 0.064 : 0.07, s > 0 ? 0.07 : 0.064, 0.025, 14, M.mat('#c9ccd1'), 0, s * 0.13, 0, p);
    M.rbox(0.03, 0.01, 0.04, 0.004, M.mat('#9aa0a6'), 0, 0.145, 0.03, p).rotation.x = PI / 2;
    return [g, [0.2], 0.35];
  }
  if (kind === 'muz') { // açılmış muz kabuğu: sap ve dört yaprak, uçları kararmış
    M.cyl(0.03, 0.04, 0.09, 8, M.mat('#6b4c22'), 0, 0.05, 0, g);
    for (let i = 0; i < 4; i++) {
      const pv = new THREE.Group(); pv.rotation.y = i * PI / 2 + 0.4; pv.position.y = 0.04; g.add(pv);
      const pe = new THREE.Group(); pe.rotation.x = -1.25 + (i % 2) * 0.15; pv.add(pe);
      M.rbox(0.08, 0.025, 0.2, 0.012, M.mat('#f2cf3a'), 0, 0, 0.1, pe); M.rbox(0.07, 0.026, 0.05, 0.01, M.mat('#7a5a22'), 0, 0, 0.2, pe);
    }
    return [g, [0.24, '#5a4a20', 0.25], 0.7];
  }
  if (kind === 'sise') { // yatık yeşil şişe: boyun, kapak, etiket
    const p = lay(g, 0.065, -0.4), gl = M.mat('#2f9e5b');
    M.cyl(0.065, 0.065, 0.22, 12, gl, 0, 0, 0, p); M.cyl(0.028, 0.065, 0.07, 12, gl, 0, 0.145, 0, p); M.cyl(0.026, 0.026, 0.08, 10, gl, 0, 0.215, 0, p);
    M.cyl(0.031, 0.031, 0.025, 10, M.mat('#d8b54a'), 0, 0.265, 0, p); M.cyl(0.067, 0.067, 0.09, 12, M.mat('#f1e3c0'), 0, -0.01, 0, p);
    return [g, [0.24], 0.2];
  }
  if (kind === 'cips') { // boş cips paketi: kıvrık uçlar, sarı logo
    const p = new THREE.Group(); p.rotation.set(0.12, 0.6, 0.05); p.position.y = 0.035; g.add(p);
    M.rbox(0.24, 0.06, 0.3, 0.028, M.mat('#f08a24'), 0, 0, 0, p);
    for (const s of [-1, 1]) M.rbox(0.25, 0.022, 0.035, 0.008, M.mat('#c0392b'), 0, 0, s * 0.16, p);
    M.cyl(0.065, 0.065, 0.006, 14, M.mat('#ffd23f'), 0, 0.031, 0.01, p); M.rbox(0.13, 0.004, 0.03, 0.001, M.mat('#c0392b'), 0, 0.034, 0.09, p);
    return [g, [0.24], 0.35];
  }
  if (kind === 'bardak') { // pipetli karton bardak, dökülmüş içecek lekesi
    const p = lay(g, 0.065, 1.1);
    M.cyl(0.072, 0.052, 0.19, 12, M.mat('#ffffff'), 0, 0, 0, p); M.cyl(0.073, 0.073, 0.05, 12, M.mat('#c94f3a'), 0, 0.02, 0, p);
    M.cyl(0.078, 0.078, 0.022, 12, M.mat('#5a3a2a'), 0, 0.1, 0, p); M.cyl(0.009, 0.009, 0.2, 6, M.mat('#e8604c'), 0.02, 0.19, 0, p).rotation.z = 0.35;
    return [g, [0.3, '#6a3e1e', 0.4], 0.6];
  }
  if (kind === 'torba') { // ağzı bağlı siyah çöp poşeti
    const bm = M.mat('#23262c');
    M.sph(0.21, bm, 0, 0.16, 0, g, 12, 9).scale.set(1.05, 0.78, 0.95); M.sph(0.07, bm, 0, 0.31, 0, g, 8, 6).scale.set(1, 0.8, 1);
    for (const s of [-1, 1]) M.rbox(0.05, 0.12, 0.025, 0.012, bm, s * 0.045, 0.39, 0, g).rotation.z = s * -0.5;
    return [g, [0.36], 0.3];
  }
  const pm = M.mat('#6b4a2b'); // köpek pisliği
  for (let i = 0; i < 3; i++) M.sph(0.12 - i * 0.035, pm, i * 0.01, 0.06 + i * 0.075, 0, g, 9, 6).scale.set(1, 0.7, 1);
  M.cyl(0.0, 0.03, 0.06, 6, pm, 0.02, 0.26, 0, g);
  return [g, [0.24, '#4a3520', 0.3], 0.7];
}
const PROTO = new Map();
function makeLitter(kind) {
  let p = PROTO.get(kind);
  if (!p) {
    const [g, st, rough] = drawLitter(kind);
    p = merged(g, rough); p.add(stain(...st));
    if (kind === 'kaka') { const f = merged(flies(3), 0.5); f.name = 'flies'; f.position.y = 0.36; p.add(f); }
    PROTO.set(kind, p);
  }
  const o = p.clone();
  o.scale.setScalar(LITTER_S * rand(0.9, 1.1));
  return o;
}
// Büyük çöp konteyneri (2026-11-06 kullanıcı: "büyük konteyner da olsun bir köşede"): kasaba meydanında bankanın batı köşesi, yol
// kenarı. Yeşil belediye konteyneri: tekerlekli, bir kapağı açık, içinden siyah poşetler taşar; önünde ÇÖP yazısı ve geri dönüşüm
// işareti, yanında poşetler ve karton. Bölgenin içeriğine eklenir (bölge kapalıyken görünmez), çarpışma alır (detay.js gibi)
const BIN = [-60.0, -24.3];
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const labelTex = () => canvasTex(256, 128, (x) => {
  x.fillStyle = '#ffffff'; x.beginPath(); x.roundRect(6, 6, 244, 116, 22); x.fill();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#1f6b3c'; x.font = `bold ${EN ? 62 : 74}px sans-serif`; x.fillText(EN ? 'TRASH' : 'ÇÖP', 128, 58);
  x.fillStyle = '#5f6b63'; x.font = 'bold 20px sans-serif'; x.fillText(EN ? 'TOWN COUNCIL' : 'BELEDİYE', 128, 104);
});
// geri dönüşüm işareti: üç ok
const recycleTex = () => canvasTex(128, 128, (x) => {
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(64, 64, 60, 0, PI * 2); x.fill();
  x.strokeStyle = x.fillStyle = '#1f6b3c'; x.lineWidth = 12; x.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2 - PI / 2, b = a + (2 * PI) / 3, ax = 64 + Math.cos(a) * 36, ay = 64 + Math.sin(a) * 36, bx = 64 + Math.cos(b) * 36, by = 64 + Math.sin(b) * 36;
    const mx = ax + (bx - ax) * 0.72, my = ay + (by - ay) * 0.72, d = Math.atan2(by - ay, bx - ax);
    x.fillStyle = '#1f6b3c'; x.beginPath(); x.moveTo(ax + (bx - ax) * 0.15, ay + (by - ay) * 0.15); x.lineTo(mx, my); x.stroke();
    x.beginPath(); x.moveTo(mx + Math.cos(d) * 16, my + Math.sin(d) * 16); x.lineTo(mx + Math.cos(d + 2.3) * 14, my + Math.sin(d + 2.3) * 14); x.lineTo(mx + Math.cos(d - 2.3) * 14, my + Math.sin(d - 2.3) * 14); x.fill();
  }
});
function drawBin() {
  const g = new THREE.Group(), body = M.mat('#2f7d4a'), dk = M.mat('#24603a'), lid = M.mat('#2a2f36'), tire = M.mat('#1d1f24'), steel = M.mat('#9aa0a6'), bm = M.mat('#23262c');
  M.rbox(1.9, 1.0, 1.1, 0.07, body, 0, 0.64, 0, g); M.rbox(1.96, 0.1, 1.16, 0.03, dk, 0, 0.17, 0, g); M.rbox(1.96, 0.08, 1.16, 0.03, dk, 0, 1.12, 0, g);
  for (const x of [-0.62, 0, 0.62]) M.rbox(0.06, 0.82, 0.02, 0.01, dk, x, 0.64, 0.56, g); // ön yüzün nervürleri
  for (const [x, z] of [[-0.8, 0.42], [0.8, 0.42], [-0.8, -0.42], [0.8, -0.42]]) { M.cyl(0.1, 0.1, 0.07, 12, tire, x, 0.1, z, g).rotation.x = PI / 2; M.cyl(0.04, 0.04, 0.075, 8, steel, x, 0.1, z, g).rotation.x = PI / 2; }
  for (const s of [-1, 1]) { M.cyl(0.025, 0.025, 0.7, 8, steel, s * 1.0, 0.95, 0, g).rotation.x = PI / 2; for (const z of [-0.33, 0.33]) M.rbox(0.08, 0.04, 0.04, 0.01, steel, s * 0.975, 0.95, z, g); } // yan tutamaklar
  M.rbox(0.93, 0.06, 1.18, 0.025, lid, -0.48, 1.19, 0, g); // kapalı kapak
  const hinge = new THREE.Group(); hinge.position.set(0.48, 1.18, -0.57); hinge.rotation.x = -1.05; g.add(hinge); // açık kapak, arka menteşede
  M.rbox(0.93, 0.06, 1.18, 0.025, lid, 0, 0.03, 0.59, hinge);
  for (const [x, z, s] of [[0.3, 0.1, 1], [0.7, -0.15, 0.85], [0.5, 0.3, 0.7]]) { M.sph(0.26 * s, bm, x, 1.16, z, g, 12, 9).scale.set(1, 0.75, 0.95); M.sph(0.06 * s, bm, x, 1.16 + 0.22 * s, z, g, 8, 6); } // taşan poşetler
  M.rbox(0.42, 0.34, 0.03, 0.02, M.mat('#c8955a'), 0.62, 1.32, 0.28, g).rotation.set(-0.3, 0.2, 0.25); // içinden çıkan karton
  for (const [x, z, s, ry] of [[1.25, 0.35, 1.6, 0.4], [1.3, -0.25, 1.3, 1.2]]) { const t = drawLitter('torba')[0]; t.scale.setScalar(s); t.position.set(x, 0, z); t.rotation.y = ry; g.add(t); } // yanındaki poşetler
  M.rbox(0.5, 0.4, 0.06, 0.02, M.mat('#c8955a'), -1.15, 0.22, 0.25, g).rotation.set(0, 0.5, -0.35); // yere dayanmış karton
  const out = merged(g, 0.5);
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: labelTex(), roughness: 0.8 })); lab.position.set(-0.4, 0.7, 0.565); out.add(lab);
  const rec = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: recycleTex(), roughness: 0.8 })); rec.position.set(0.52, 0.7, 0.565); out.add(rec);
  for (const [x, z, r] of [[1.25, 0.35, 0.55], [1.3, -0.25, 0.45]]) { const s = stain(r); s.position.set(x, 0.012, z); out.add(s); }
  return out;
}
let binDone = false;
function buildBin() {
  binDone = true;
  const R = G.regions && G.regions.kasaba; // bankanın köşesi bölgenin batı sınırının (x −57) az dışında, sokakta; kasabayla gelir
  if (!R || !R.content) return;
  const o = drawBin(); o.position.set(BIN[0], 0, BIN[1]); R.content.add(o);
  const c = [BIN[0] - 1.02, BIN[0] + 1.02, BIN[1] - 0.62, BIN[1] + 0.62]; // poşetler ve karton yürünebilir kalır
  R.colliders.push(c); if (R.unlocked) G.colliders.push(c);
}
// büyüme: açık bölge sayısı ve açılan kilit/bölüm sayısı (her bölüm biraz daha kalabalık demek)
const growth = () => Object.values(G.regions || {}).filter((R) => R.unlocked).length + (G.unlocked ? G.unlocked.size * 0.15 : 0);
export const litterCap = () => Math.min(48, 6 + Math.round(growth() * 1.6));
const blocked = (x, z) => G.colliders.some((c) => x > c[0] - 0.3 && x < c[1] + 0.3 && z > c[2] - 0.3 && z < c[3] + 0.3);
export function dropLitter(x, z, kind = pick(KINDS)) {
  if (litter.length >= litterCap() || x > 300 || !walkable(x, z) || blocked(x, z)) return null;
  const o = makeLitter(kind); o.position.set(x, 0.01, z); o.rotation.y = rand(0, Math.PI * 2);
  G.scene.add(o); popIn(o);
  const L = { obj: o, x, z, kind, by: null, byT: 0, fly: o.getObjectByName('flies') };
  litter.push(L);
  return L;
}
// toplanan çöp: oyuncu alırsa 1 ₺ (sokak temizliğine katkı), çöpçünün aldığı parasız
export function collect(L, by) {
  const i = litter.indexOf(L); if (i < 0) return;
  litter.splice(i, 1); if (L.obj.parent) L.obj.parent.remove(L.obj);
  if (!by) { G.money += 1; floatText(V(L.x, 0.6, L.z), '🧹 +1 ₺', 'pos'); }
  sfx('pop', { at: V(L.x, 0, L.z), npc: !!by });
}
let dropT = 8, strayT = 45, repT = 5, warnAt = -999;
export function updateCop(dt) {
  if (G.visit || !G.player) return; // komşunun köyünde çöp yok
  if (!binDone) buildBin();
  for (const L of litter) if (L.fly) { L.fly.rotation.y += dt * 6; L.fly.position.y = 0.36 + Math.sin(G.time * 7 + L.x) * 0.04; } // sinekler
  const g = growth();
  // müşteriler arada yere çöp atar: büyüyen kasabada daha sık
  if ((dropT -= dt) <= 0) {
    dropT = rand(9, 14) / (1 + g * 0.05); // küçük köyde ~9 sn'de bir, büyük kasabada ~4 sn'de bir
    const cs = G.customers.filter((c) => !c.leaving && !c.lying && !c.follower && c.obj.position.x < 300);
    if (cs.length) { const p = pick(cs).obj.position; dropLitter(p.x + rand(-0.7, 0.7), p.z + rand(-0.7, 0.7)); }
  }
  // sokak hayvanları: kasaba büyüdükçe yenileri gelir (açık bölge başına aşağı yukarı dörtte bir); köpekler arada pislik bırakır
  if ((strayT -= dt) <= 0) { strayT = rand(70, 120); addStray(Math.floor(g / 4)); }
  for (const p of G.pets || []) {
    if (p.kind !== 'dog' || !p.o.parent) continue;
    if ((p.poopT = (p.poopT ?? rand(40, 90)) - dt) <= 0) { p.poopT = rand(60, 110); const q = p.o.getWorldPosition(V(0, 0, 0)); dropLitter(q.x + rand(-0.3, 0.3), q.z + rand(-0.3, 0.3), 'kaka'); }
  }
  // oyuncu üstünden geçerken toplar
  const pp = G.player.position;
  for (let i = litter.length - 1; i >= 0; i--) { const L = litter[i]; if (Math.abs(L.x - pp.x) < 0.75 && Math.abs(L.z - pp.z) < 0.75) collect(L, null); }
  // kirli sokak mahalle puanını yavaş yavaş düşürür (10 parçaya kadar sorun yok)
  if ((repT -= dt) <= 0) {
    repT = 5;
    const over = litter.length - 10;
    if (over > 0) {
      G.stats.rep = Math.max(0, (G.stats.rep ?? 60) - over * 0.012);
      if (litter.length >= 18 && G.time - warnAt > 240) { warnAt = G.time; toast('🧹 Sokaklar kirlendi, mahalle puanı düşüyor: üstlerinden geçip topla ya da Kasaba Meydanı\'ndan çöpçü al'); }
    }
  }
}
