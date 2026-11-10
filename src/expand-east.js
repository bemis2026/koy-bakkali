// Doğu ve orta bölgelerin genişletmeleri (genisleme-plan.md "Diğer oturumun bölgeleri"): pazar, çiftlik, büyük tarlalar, han,
// fırın, sahil, tatil köyü, kasaba, şehir. Her bölgede üç kademe: 1. kapasite, 2. yeni iş ya da ürün, 3. büyük kapasite.
// Her kademe defineExpansion ile tanımlanır (expand.js). Arsalar ölçülerek seçildi: çiftlik ve tarla şeridi hanın kenarına,
// sahil arsası tahta yola, tatil arsası müşteri yoluna taşmaz; her arsa yürünen bir alana (bölge, yol ya da önceki arsa)
// en az 0,3 m biner, yoksa NPC ızgarası kopuk kalır. Yer olmayan kademeler yerinde yükseltmedir (rect null).
// Bölgelerin kendi dosyalarına dokunmadan kapasite artırmak için bölgenin R.update'i sarılır (müşteri sıklığı).
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, Station, MoneyPile, Customer, fly, floatText, sfx, rand, mult, priceOf, mineFx } from './game.js';
import { makeAisle } from './reyon.js';
import { defineExpansion } from './expand.js';
import { banner } from './ui.js';
import { confetti } from './fx.js';
import { repMul } from './rating.js';
import { HOUSE_X } from './resort.js';
import { addRental } from './beach.js';
import { texRep } from './tex.js';
import { esya } from './esya.js';
import { workTable } from './mobilya.js';
import { Mixer, makeKekTezgahi } from './expand-west.js';
import './mutfak.js'; // sahil mutfağı: püre, karpuz suyu, menemen tezgâhları (genişletme tanımları world.js UNLOCKS'tan önce yüklenmeli)
import './koymakine.js'; // büyük köy marketinin doğu şeridindeki makineler (tanımları da UNLOCKS kurulmadan kaydolmalı)
import './kano.js'; // derenin doğu kıyısında kano iskelesi (xkano) ve derede gezen kanolar
import { makeBakeOven } from './carsi.js';
import { buildClub, updateClub } from './club.js';
import { sunflowerField } from './farmland.js';
import { LaleField, KarpuzField, LALE, KARPUZ, fieldTier, irrigation } from './tarla.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
const mods = () => G.mods || (G.mods = {});

// ---------- yeni ürünler ----------
function makeBal() { // bal kavanozu: amber cam, beyaz kapak, etiket
  const g = new THREE.Group();
  M.cyl(0.15, 0.15, 0.3, 14, M.mat('#f2a516', { rough: 0.25 }), 0, 0.15, 0, g);
  M.cyl(0.16, 0.16, 0.06, 14, M.mat('#fff4d6'), 0, 0.33, 0, g);
  M.rbox(0.2, 0.1, 0.02, 0.01, M.mat('#ffffff'), 0, 0.16, 0.15, g);
  g.userData.h = 0.36;
  return g;
}
function makeAycicek() { // ayçiçeği: sarı taç yapraklar, kahverengi göbek
  const v = esya('aycicek'); // ayçiçeği modeli (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group(), head = new THREE.Group();
  M.cyl(0.03, 0.03, 0.36, 6, M.mat('#5aa84a'), 0, 0.18, 0, g);
  head.position.set(0, 0.38, 0); head.rotation.x = -1.1; g.add(head);
  for (let k = 0; k < 10; k++) { const a = (k * PI) / 5, p = M.rbox(0.1, 0.02, 0.05, 0.01, M.mat('#f6c343'), Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13, head); p.rotation.y = -a; }
  M.cyl(0.09, 0.09, 0.04, 12, M.mat('#5a3a1e'), 0, 0.01, 0, head);
  g.userData.h = 0.48;
  return g;
}
function makePide() { // pide: uzun hamur kayık, içi kıymalı
  const v = esya('pide'); // pizza modeli (kullanıcı seçti) (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group();
  M.rbox(0.56, 0.08, 0.22, 0.04, M.mat('#e2a85a'), 0, 0.05, 0, g);
  M.rbox(0.42, 0.04, 0.12, 0.02, M.mat('#b5523b'), 0, 0.1, 0, g);
  for (const x of [-0.12, 0.08]) M.sph(0.03, M.mat('#3fae6b'), x, 0.13, 0.02, g, 6, 5);
  g.userData.h = 0.14;
  return g;
}
function makeKesme() { // kesme çiçek demeti (ham): ince saplar, renkli taçlar, bağlanmamış
  const v = esya('kesme'); // iki modelden biri (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group(), stem = M.mat('#4f9a3f');
  for (const [x, z, c, h] of [[0, 0, '#e8473c', 0.34], [0.07, 0.03, '#ff6fa8', 0.3], [-0.06, 0.04, '#f6c343', 0.31], [0.02, -0.06, '#ffffff', 0.28]]) {
    const st = M.cyl(0.012, 0.012, h, 5, stem, x * 0.5, h / 2, z * 0.5, g); st.rotation.z = -x * 1.6; st.rotation.x = z * 1.6;
    M.sph(0.05, M.mat(c), x, h + 0.02, z, g, 8, 6);
  }
  g.userData.h = 0.36;
  return g;
}
function makeCicek() { // çiçek buketi: kâğıt külah, renkli çiçekler, kurdele
  const g = new THREE.Group();
  const cone = M.cyl(0.13, 0.04, 0.3, 10, M.mat('#f4ead5'), 0, 0.15, 0, g); cone.rotation.x = 0.1;
  for (const [x, z, c] of [[0, 0, '#e8473c'], [0.08, 0.05, '#ff6fa8'], [-0.08, 0.04, '#f6c343'], [0.03, -0.08, '#9c6cf0'], [-0.05, -0.05, '#ffffff']]) M.sph(0.06, M.mat(c), x, 0.36, z, g, 8, 6);
  M.rbox(0.2, 0.05, 0.03, 0.01, M.mat('#e8473c'), 0, 0.12, 0.12, g); // kurdele
  g.userData.h = 0.42;
  return g;
}
function makeTost() { // kaşarlı tost: iki dilim ekmek arasında erimiş kaşar
  const v = esya('tost'); // tost modeli (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group(), b = M.mat('#d99a4e');
  M.rbox(0.36, 0.06, 0.3, 0.03, b, 0, 0.03, 0, g);
  M.rbox(0.38, 0.03, 0.32, 0.01, M.mat('#f6d743'), 0, 0.075, 0, g);
  M.rbox(0.36, 0.06, 0.3, 0.03, b, 0, 0.12, 0, g);
  g.userData.h = 0.16;
  return g;
}
ITEMS.tursu = { name: 'Turşu', price: 26, model: 'barrel' };
ITEMS.guvec = { name: 'Güveç', price: 32, model: 'pot-stew' };
ITEMS.bal = { name: 'Bal', price: 28, fn: makeBal };
ITEMS.aycicek = { name: 'Ayçiçeği', price: 12, fn: makeAycicek };
ITEMS.pide = { name: 'Pide', price: 22, fn: makePide };
ITEMS.cicek = { name: 'Çiçek', price: 16, fn: makeKesme }; // tarhtan kesme çiçek; çiçekçinin buket masasında bukete döner
ITEMS.buket = { name: 'Buket', price: 46, fn: makeCicek }; // iki çiçekten bir buket, çiçekçinin vitrininde satılır
ITEMS.tost = { name: 'Tost', price: 18, fn: makeTost };

// ---------- küçük modeller ----------
const wood = () => M.mat('#a8703f');
function makeHives() { // üç arı kovanı: beyaz kutular, renkli çatılar
  const g = new THREE.Group();
  [['#f6c343', -1.1], ['#e8604c', 0], ['#3d7dd8', 1.1]].forEach(([c, x]) => {
    M.rbox(0.6, 0.12, 0.6, 0.03, wood(), x, 0.06, 0, g);
    for (const y of [0.3, 0.6]) M.rbox(0.56, 0.28, 0.56, 0.03, M.mat('#fbf6ec'), x, y, 0, g);
    M.rbox(0.66, 0.08, 0.66, 0.03, M.mat(c), x, 0.8, 0, g);
    M.rbox(0.2, 0.03, 0.02, 0.01, M.mat('#3a2a1a'), x, 0.2, 0.29, g); // giriş deliği
  });
  return g;
}
function makeTent(w, d, col) { // pazar çadırı: dört direk, çizgili tente
  const g = new THREE.Group(), pole = M.mat('#e9ecef');
  const t0 = esya('pazarcadiri'); // tente modeli (esya.js): genişliğe göre yan yana birkaç tane, tentesi col renginde
  if (t0) {
    const s = new THREE.Box3().setFromObject(t0).getSize(new THREE.Vector3()), n = Math.max(1, Math.round(w / s.x));
    for (let i = 0; i < n; i++) {
      const t = esya('pazarcadiri', { tint: { _crayfishdiffuse: col }, sx: w / n / s.x, sz: (d + 0.3) / s.z });
      t.position.x = -w / 2 + (w / n) * (i + 0.5); g.add(t);
    }
    return g;
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.cyl(0.06, 0.06, 3.0, 6, pole, (sx * w) / 2, 1.5, (sz * d) / 2, g);
  const n = 8;
  for (let i = 0; i < n; i++) M.rbox(w / n, 0.06, d + 0.3, 0.01, M.mat(i % 2 ? '#ffffff' : col), -w / 2 + (w / n) * (i + 0.5), 3.05, 0, g);
  return g;
}
function makeCampPen() { // deve ağılı: çit, yalak, saman
  const g = new THREE.Group(), w = wood();
  for (const [x0, z0, x1, z1] of [[-4.6, -3.2, 4.6, -3.2], [-4.6, 3.2, -1.2, 3.2], [1.2, 3.2, 4.6, 3.2], [-4.6, -3.2, -4.6, 3.2], [4.6, -3.2, 4.6, 3.2]]) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    for (let i = 0; i <= Math.round(L / 1.5); i++) { const t = i / Math.max(1, Math.round(L / 1.5)); M.cyl(0.06, 0.07, 1.0, 6, w, x0 + (x1 - x0) * t, 0.5, z0 + (z1 - z0) * t, g); }
    for (const y of [0.45, 0.85]) { const r = M.rbox(L, 0.07, 0.07, 0.02, w, (x0 + x1) / 2, y, (z0 + z1) / 2, g); r.rotation.y = -Math.atan2(z1 - z0, x1 - x0); }
  }
  M.rbox(2.0, 0.42, 0.6, 0.06, w, 0, 0.21, -2.4, g);
  M.rbox(1.8, 0.04, 0.4, 0.02, M.mat('#5fb6e0', { rough: 0.2 }), 0, 0.41, -2.4, g);
  return g;
}
function makeGuestHouse() { // konuk odaları: kerpiç duvar, düz çatı, kapılar, pencereler
  const g = new THREE.Group(), wall = M.mat('#e2c9a0'), dark = M.mat('#6b4a2e');
  M.rbox(9.0, 3.0, 4.2, 0.08, wall, 0, 1.5, 0, g);
  M.rbox(9.4, 0.3, 4.6, 0.06, M.mat('#c79a5a'), 0, 3.1, 0, g);
  for (const x of [-3, 0, 3]) { M.rbox(1.0, 1.9, 0.08, 0.02, dark, x, 0.95, 2.12, g); M.rbox(0.7, 0.6, 0.08, 0.02, M.mat('#9fd8f5', { rough: 0.15 }), x + 1.1, 1.7, 2.12, g); }
  const s = M.makeSign('🛏️ KONUK ODALARI', '#7a4a2e', 2.6, 0.55); s.scale.setScalar(0.8); s.position.set(-3.8, 0, 2.6); g.add(s);
  return g;
}
function makeHamam() { // hamam: beyaz kubbeli yapı, havlu dolabı önünde
  const g = new THREE.Group(), wall = M.mat('#f3ece0');
  M.rbox(5.6, 2.6, 4.2, 0.08, wall, 0, 1.3, 0, g);
  M.sph(1.7, M.mat('#e9e2d6'), 0, 2.6, 0, g, 18, 10).scale.y = 0.6;
  for (const x of [-1.6, 1.6]) M.sph(0.6, M.mat('#e9e2d6'), x, 2.6, 0.8, g, 12, 8).scale.y = 0.6;
  M.rbox(1.2, 1.9, 0.08, 0.04, M.mat('#2fb5a8'), 0, 0.95, 2.12, g);
  const s = M.makeSign('🧖 HAMAM', '#2fb5a8', 1.8, 0.5); s.scale.setScalar(0.8); s.position.set(2.0, 0, 2.6); g.add(s);
  return g;
}
function makeCafe() { // kasaba kahvesi: tente, masalar, sandalyeler
  const g = new THREE.Group();
  g.add(makeTent(6.0, 4.0, '#b5523b'));
  for (const [x, z] of [[-1.6, -0.8], [1.6, -0.8], [-1.6, 1.2], [1.6, 1.2]]) {
    M.cyl(0.45, 0.45, 0.06, 14, M.mat('#ffffff'), x, 0.75, z, g); M.cyl(0.05, 0.05, 0.75, 6, M.mat('#5a5f66'), x, 0.37, z, g);
    for (const sx of [-0.7, 0.7]) M.rbox(0.4, 0.45, 0.4, 0.04, wood(), x + sx, 0.22, z, g);
    M.cyl(0.05, 0.04, 0.09, 8, M.mat('#c8102e'), x + 0.1, 0.83, z, g); // çay bardağı
  }
  const s = M.makeSign('☕ KASABA KAHVESİ', '#b5523b', 2.6, 0.55); s.scale.setScalar(0.8); s.position.set(-2.6, 0, 2.4); g.add(s);
  return g;
}
function makeStage() { // konser sahnesi: platform, fon, hoparlörler, ışık direkleri
  const g = new THREE.Group();
  M.rbox(6.4, 0.6, 3.6, 0.06, wood(), 0, 0.3, 0, g);
  M.rbox(6.4, 3.2, 0.2, 0.04, M.mat('#3b2a6b'), 0, 2.2, -1.7, g);
  for (const x of [-2.9, 2.9]) { M.rbox(0.7, 1.4, 0.6, 0.04, M.mat('#2a2a2a'), x, 1.3, -1.1, g); M.cyl(0.05, 0.05, 3.8, 6, M.mat('#c9ccd0'), x, 1.9, 1.6, g); }
  const lights = [];
  for (const [x, c] of [[-2.9, '#ff6fa8'], [2.9, '#f6c343']]) { const l = M.sph(0.18, M.mat(c, { emissive: c, ei: 0.6 }), x, 3.8, 1.6, g, 10, 8); lights.push(l); }
  const s = M.makeSign('🎵 KONSER ALANI', '#9c6cf0', 2.4, 0.55); s.scale.setScalar(0.8); s.position.set(-2.4, 0, 2.6); g.add(s);
  g.userData.lights = lights;
  // sahne eşyaları: mikrofon ayağı ve davul takımı; sanatçılar işe alınınca sahneye çıkar (upgrades.js Artist)
  M.cyl(0.02, 0.02, 1.35, 6, M.mat('#2a2a2a'), 0, 1.27, 1.05, g); M.cyl(0.18, 0.2, 0.04, 10, M.mat('#2a2a2a'), 0, 0.62, 1.05, g);
  M.sph(0.06, M.mat('#5a5f66'), 0, 1.98, 1.02, g, 8, 6);
  const drum = M.mat('#e8604c'), chrome = M.mat('#c9ccd0', { rough: 0.3 });
  const kick = M.cyl(0.36, 0.36, 0.32, 14, drum, 1.7, 0.98, -0.25, g); kick.rotation.x = PI / 2;
  for (const [dx, dz] of [[-0.45, -0.1], [0.45, -0.1]]) M.cyl(0.16, 0.16, 0.18, 12, drum, 1.7 + dx, 1.35, -0.3 + dz, g);
  M.cyl(0.02, 0.02, 0.8, 6, chrome, 2.35, 1.0, -0.55, g); M.cyl(0.26, 0.26, 0.02, 14, M.mat('#e8c56a', { rough: 0.3 }), 2.35, 1.42, -0.55, g);
  // fonun üstünde gösteri levhası: konser ya da tiyatro
  const signs = {};
  for (const [k, txt, col] of [['konser', '🎵 KONSER', '#9c6cf0'], ['tiyatro', '🎭 TİYATRO', '#c8463a']]) {
    const sg = M.makeSign(txt, col, 2.2, 0.5); sg.position.set(0, 3.0, -1.6); sg.scale.setScalar(0.9); sg.visible = k === 'konser'; g.add(sg); signs[k] = sg;
  }
  g.userData.signs = signs;
  return g;
}
function makeBooth() { // gişe: iki direk, çatı, GİŞE levhası (kasa kutusu cashBox ile ortada)
  const g = new THREE.Group(), post = M.mat('#3d4552');
  for (const x of [-0.75, 0.75]) M.rbox(0.1, 2.2, 0.1, 0.03, post, x, 1.1, 0.45, g);
  M.rbox(1.9, 0.12, 1.4, 0.04, M.mat('#9c6cf0'), 0, 2.25, 0, g);
  M.rbox(1.7, 2.0, 0.08, 0.03, M.mat('#efe6ff'), 0, 1.0, -0.6, g);
  const sg = M.makeSign('🎟️ GİŞE', '#9c6cf0', 1.6, 0.45); sg.position.set(0, 2.35, 0.55); sg.scale.setScalar(0.85); g.add(sg);
  return g;
}
// seyirci: herkesin kendi dansı, hızı ve fazı var; konser yokken hafif, konserde coşkulu
const DANCES = ['zipla', 'sallan', 'el', 'alkis', 'don', 'kafa'];
function danceStep(d, t, dt, k) {
  const o = d.o, u = o.userData, w = t * d.f + d.ph, A = u.arms, Lg = u.legs;
  o.position.y = 0; o.rotation.x = 0; o.rotation.z = 0;
  if (d.style === 'zipla') { o.position.y = Math.abs(Math.sin(w)) * 0.2 * k; A[0].rotation.x = A[1].rotation.x = -2.5 + Math.sin(w * 2) * 0.3; }
  else if (d.style === 'sallan') { o.rotation.z = Math.sin(w) * 0.16 * k; A[0].rotation.x = -0.6 + Math.sin(w) * 0.6 * k; A[1].rotation.x = -0.6 - Math.sin(w) * 0.6 * k; }
  else if (d.style === 'el') { A[0].rotation.x = -2.7 + Math.sin(w * 2) * 0.45 * k; A[1].rotation.x = -0.3; o.rotation.z = Math.sin(w) * 0.06 * k; }
  else if (d.style === 'alkis') { A[0].rotation.x = A[1].rotation.x = -1.35 + Math.sin(w * 3) * 0.18 * k; o.position.y = Math.abs(Math.sin(w * 1.5)) * 0.06 * k; }
  else if (d.style === 'don') { d.ry += dt * 1.4 * k; A[0].rotation.x = A[1].rotation.x = -1.6; o.position.y = Math.abs(Math.sin(w)) * 0.08 * k; }
  else { o.rotation.x = Math.sin(w * 2) * 0.1 * k; A[0].rotation.x = -2.0 - Math.max(0, Math.sin(w)) * 0.7 * k; A[1].rotation.x = -0.4; }
  for (const [i, l] of Lg.entries()) l.rotation.x = Math.sin(w + i * PI) * 0.25 * k;
  o.rotation.y = d.ry + Math.sin(w * 0.5) * 0.25 * k;
}
function makeFloristShop() { // çiçekçi: arkada pembe duvar ve tabela, buket masasının üstünde tente, yanlarda çiçek kovaları
  const g = new THREE.Group();
  M.rbox(6.8, 2.4, 0.25, 0.05, M.mat('#f7d6e0'), 0, 1.2, -1.2, g);
  M.rbox(6.9, 0.2, 0.35, 0.05, M.mat('#ffffff'), 0, 2.45, -1.2, g);
  const aw = M.cyl(0.6, 0.6, 6.8, 16, new THREE.MeshStandardMaterial({ map: stripesTex('#ff6fa8', '#ffffff'), side: THREE.DoubleSide, roughness: 0.85 }), 0, 2.2, -0.95, g, true);
  aw.rotation.z = PI / 2; aw.scale.set(0.5, 1, 1);
  const s = M.makeSign('🌷 ÇİÇEKÇİ', '#e05a8c', 2.6, 0.6); s.position.set(0, 2.3, -1.25); s.scale.setScalar(0.9); g.add(s);
  // buket tezgâhı (iki tepsinin arası): kâğıt rulosu, kurdele makarası, makas
  M.rbox(1.6, 0.85, 0.8, 0.05, wood(), 0, 0.42, -0.5, g);
  const roll = M.cyl(0.09, 0.09, 1.1, 12, M.mat('#f4ead5'), -0.1, 0.95, -0.7, g); roll.rotation.z = PI / 2;
  M.cyl(0.08, 0.08, 0.07, 12, M.mat('#e8473c'), 0.55, 0.9, -0.4, g);
  M.rbox(0.22, 0.02, 0.06, 0.01, M.mat('#5a5f66'), 0.3, 0.88, -0.25, g);
  for (const [x, z] of [[-3.1, -0.6], [3.1, -0.6], [-3.1, 0.3], [3.1, 0.3]]) { // çiçek kovaları
    M.cyl(0.24, 0.2, 0.42, 10, M.mat('#9aa5b1', { rough: 0.4 }), x, 0.21, z, g);
    for (let k = 0; k < 5; k++) M.sph(0.08, M.mat(['#e8473c', '#ff6fa8', '#f6c343', '#ffffff', '#9c6cf0'][(k + Math.round(x + 4)) % 5]), x + Math.cos(k * 1.3) * 0.12, 0.55 + (k % 2) * 0.06, z + Math.sin(k * 1.3) * 0.12, g, 8, 6);
  }
  return g;
}
let stripesT = null;
function stripesTex(a, b) {
  if (stripesT) return stripesT;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(0, i * 16, 64, 16); }
  stripesT = new THREE.CanvasTexture(c); stripesT.colorSpace = THREE.SRGBColorSpace; return stripesT;
}
// vitrin müşterisi: parktan gelir, vitrinden bir ürün alır, parasını dükkânın kasasına bırakır, parka döner (çiçekçi; kahvenin kek vitrini)
const FLO_FROM = V(-45.6, 0, -37.0);
const florist = { vitrin: null, pile: null, t: 6, busy: 0 };
const cafe = { pile: null }; // kasaba kahvesinin kasası (xkasaba1)
// kek tezgâhı kahve açılmadan kurulmuş eski kayıtta kek parası vitrinin kendi kasasına düşer (xkoy5)
const kekShop = { vitrin: null, own: null, t: 8, busy: 0, get pile() { return cafe.pile || this.own; } };
function shopCustomer(S, type, icon) {
  const sh = S.vitrin; if (!sh || !sh.count(type)) return;
  const spot = sh.spots.find((q) => !q.c); if (!spot) return;
  const from = () => FLO_FROM.clone().setX(FLO_FROM.x + rand(-1.5, 1.5));
  const c = new Customer(from(), 'kasaba', Math.random() < 0.6 ? M.townLook() : M.villagerLook());
  spot.c = c; S.busy++;
  c.state = 'go'; c.path = [spot.p.clone()]; c.want = type; c.setBubble(type, 1);
  const done = () => { if (spot.c === c) spot.c = null; S.busy--; c.clearBubble(); c.state = 'leave'; c.leaving = true; c.path = [from()]; };
  c.think = (dt) => {
    if (c.state === 'go') { if (c.walk(dt)) { c.state = 'pick'; c.t = 0; } }
    else if (c.state === 'pick') {
      c.face(sh.faceY ?? PI, dt); c.t += dt;
      if (c.t > 1.1) {
        const obj = sh.takeType(type);
        if (obj) { mineFx(c, obj); c.stack.push(type, obj, 0.3); const pay = Math.round(priceOf(type, obj) * mult()); S.pile.add(pay, c.obj.position); floatText(c.obj.position, `${icon} +${pay} ₺`, 'pos'); c.mood(true); G.stats.customers++; } // kendi dizdiğin ürün %20 fazla (game.js)
        done();
      }
    } else if (c.state === 'leave' && c.walk(dt)) c.destroy();
  };
}
function makeRentalKiosk() { // deniz bisikleti kiralama tezgâhı: büfenin yanında, büfenin renklerinde (turkuaz gövde, mercan tente)
  const g = new THREE.Group();
  M.rbox(2.0, 1.0, 1.0, 0.06, M.mat('#3ec1b5'), 0, 0.5, 0, g);
  M.rbox(2.2, 0.08, 1.2, 0.03, M.mat('#ffffff'), 0, 1.04, 0, g);
  for (const x of [-0.95, 0.95]) M.cyl(0.05, 0.05, 1.4, 6, M.mat('#ffffff'), x, 1.7, -0.45, g);
  M.rbox(2.3, 0.1, 1.2, 0.03, M.mat('#ff6f61'), 0, 2.4, -0.15, g);
  const s = M.makeSign('🚲 DENİZ BİSİKLETİ', '#3d9be0', 2.4, 0.5); s.scale.setScalar(0.62); s.position.set(0, 1.2, 0.6); g.add(s);
  return g;
}
const SMALL_OVEN = (prod) => makeBakeOven(prod); // köy fırınının taş fırını (carsi.js); eskiden küçültülmüş genel fırın
function makeToaster() { // tost makinesi: çelik gövde, siyah kapak, kırmızı ışık; tezgahın üstünde
  const g = new THREE.Group();
  M.rbox(1.6, 0.85, 0.9, 0.05, M.mat('#b77b46'), 0, 0.42, 0, g);
  const v = esya('tostmakinesi'); // makine modeli (esya.js) tezgâhın üstünde; yüklenemezse çelik kutu
  if (v) g.add(v);
  else {
    M.rbox(1.1, 0.32, 0.7, 0.06, M.mat('#c9ccd0', { rough: 0.35 }), 0, 1.0, 0, g);
    M.rbox(1.12, 0.1, 0.72, 0.04, M.mat('#2a2a2a'), 0, 1.2, 0, g);
    M.sph(0.04, M.mat('#e8473c', { emissive: '#e8473c', ei: 0.8 }), 0.45, 1.0, 0.36, g, 6, 5);
  }
  const s = M.makeSign('🥪 TOST', '#d98a2b', 1.2, 0.4); s.scale.setScalar(0.7); g.add(s);
  if (v) s.position.set(0, 0.85, -0.32); // direkler tezgâhta, makinenin arkasında
  else s.position.set(0, 1.3, 0.2);
  return g;
}

// modeli yerine koyup çarpışma kutusunu modelin kendi boyutundan alır (popIn küçültmeden önce ölçülür)
const BOX = new THREE.Box3();
function place(c, o, x, z, ry = 0, pad = 0.05) {
  o.position.set(x, 0, z); o.rotation.y = ry; o.updateMatrixWorld(true);
  BOX.setFromObject(o);
  c.col(BOX.min.x - pad, BOX.max.x + pad, BOX.min.z - pad, BOX.max.z + pad);
  return c.put(o, x, 0, z, ry);
}
// bölgenin R.update'ine ek iş: müşteri sıklığı gibi ayarlar bölge dosyasına dokunmadan
function after(R, fn) { const u = R.update; R.update = (dt) => { u(dt); fn(dt); }; }
// köşedeki kasa kutusu: parası toplanana kadar üstünde birikir (account.js mantığıyla aynı)
function cashBox(c, x, z) {
  c.put(M.rbox(1.12, 0.86, 1.02, 0.06, M.mat('#5d6b78')), x, 0.43, z);
  c.put(M.rbox(1.18, 0.07, 1.08, 0.03, M.mat('#38424c')), x, 0.885, z);
  const body = c.col(x - 0.56, x + 0.56, z - 0.51, z + 0.51);
  const P = new MoneyPile(c.group, x, z, 0.92, { desk: false, body, instant: c.instant });
  P.spot = { x, y: 0, z: z - 1, ry: 0 }; // muhasebeci önden (güneyden) gelir
  return P;
}
// pasif gelir: belli aralıkla kasaya para düşer (kahvehane, konuk odaları)
const incomes = [];
// pile: kasa ya da kasayı veren işlev (bölüm, kayıt açılırken bölgenin kasasından önce kurulabilir: gelir kasa gelince başlar)
function income(pile, every, base, label, at) { incomes.push({ pile, every, base, label, at, t: rand(2, every) }); }

// =====================================================================
// SEMT PAZARI: nehir kıyısı şeridi
// =====================================================================
defineExpansion({ id: 'xpazar1', region: 'pazar', tier: 1, icon: '🥒', title: 'Pazar Bostanı', price: 1700, rect: [52.3, 57.2, -4.6, 3.0], at: [55.2, -0.8], tex: 'grass',
  info: { text: 'Pazarın nehir kıyısına bostan kuruldu.', steps: [['domates', 'Domates ve salatalık burada kendi kendine büyür.'], ['🧺', 'Topla, tezgahına diz; toptancıya para vermeden tezgahın dolar.']] },
  build: (c) => { c.bed(55.2, -2.7, 'domates', 5); c.bed(55.2, 1.0, 'salatalik', 5); } });
defineExpansion({ id: 'xpazar2', region: 'pazar', tier: 2, icon: '🫙', title: 'Turşucu', price: 2800, rect: [52.3, 57.2, -11.6, -4.6], at: [55.2, -5.6], tex: 'cobble',
  info: { text: 'Yeni iş: turşu!', steps: [['salatalik', 'Salatalığı turşu fıçısının soldaki masasına bırak (iki salatalık bir turşu).'], ['tursu', `Turşu sağdaki masada birikir. Tanesi ${ITEMS.tursu.price} ₺; pazar tezgahında ve köy dükkânının manav reyonunda satılır.`]] },
  build: (c) => {
    const b = M.model('barrel'); b.scale.setScalar(2.0);
    c.machine(b, 55.2, -9.8, 'salatalik', 'tursu', 6.0, { need: 2 }); // iki salatalık bir turşu
    c.sell('tursu', 'pazar'); c.sell('tursu', 'manav');
  } });
defineExpansion({ id: 'xpazar3', region: 'pazar', tier: 3, icon: '⛺', title: 'Pazar Çadırı', price: 4200, rect: null, at: [44.0, 0.6],
  info: { text: 'Tezgahlarının arkasına gölgelik pazar çadırları kuruldu.', steps: [['🧺', 'Her tezgah bir kat daha ürün alır.'], ['👥', 'Pazara %35 daha sık müşteri gelir.']] },
  build: (c) => {
    const P = G.regions.pazar;
    // tezgâhların arkasına (dizdiğin şeride) gölgelik çadırlar: kamera sergideki ürünleri görmeye devam eder. Yerlerini ve
    // boyunu sıra belirler (world.js R.setTents: sıra uzayıp kısaldıkça yeniden kurulur)
    P.setTents((w) => makeTent(w, 2.4, '#e39b3a'), c.instant);
    P.bigStalls = true;
    for (const s of P.stalls || []) P.enlarge(s);
    after(P, (dt) => { P.spawnT -= dt * 0.35 * repMul(); });
  } });

// =====================================================================
// ÇİFTLİK: hanla çiftlik arasındaki batı koridoru
// =====================================================================
// 2026-11-08 kullanıcı: "2.kümesi 1.kümesten ayrı yapma beraber genişlesin açınca": ikinci kümes koridorda (19,7; -39) ayrı duruyordu.
// Artık birinci kümesin arkasına bitişik kurulur, kümes büyür: yumurta aynı folluğa iki kat hızlı düşer (world.js R.twinCoop). Arsası
// yok (koridor boş kalır), kilidi kümesin doğusunda. Bölümün hız ve tepsi yükseltmesi büyüyen kümese işler (G.xgens vekili)
defineExpansion({ id: 'xciftlik1', region: 'ciftlik', tier: 1, icon: '🐔', title: 'İkinci Kümes', price: 1800, rect: null, at: [34.6, -28.6],
  info: { text: 'Kümes büyüdü: arkasına ikinci kümes eklendi.', steps: [['yumurta', 'Kümesin önündeki tepside yumurta birikir; çiftliğin yumurtası iki katına çıktı.']] },
  build: (c) => G.regions.koy.twinCoop(c) });
defineExpansion({ id: 'xciftlik2', region: 'ciftlik', tier: 2, icon: '🍯', title: 'Arı Kovanları', price: 3000, rect: [16.4, 23, -34.6, -31.2], at: [21.6, -32.4], tex: 'grass',
  info: { text: 'Yeni ürün: bal!', steps: [['bal', `Kovanların önündeki tepside bal birikir. Tanesi ${ITEMS.bal.price} ₺.`], ['🧺', 'Köy dükkânının manav reyonunda, pazar tezgahında ve şehir marketinde satılır.']] },
  build: (c) => {
    const h = place(c, makeHives(), 19.7, -33.9);
    bees.push({ at: V(19.7, 0.9, -33.9), list: Array.from({ length: 7 }, () => { const b = M.sph(0.05, M.mat('#f6c343'), 0, 0, 0, c.group, 6, 4); return { b, a: rand(0, 6), r: rand(0.6, 1.4), s: rand(1.5, 3), y: rand(0.3, 1.0) }; }) });
    c.gen(null, 19.7, -33.9, 'bal', { interval: 7.5, max: 6, trayDz: 1.2 });
    c.sell('bal', 'manav'); c.sell('bal', 'pazar'); c.sell('bal', 'sehir');
    return h;
  } });
// retired: kullanıcı isteğiyle (2026-10-28) yeni oyunculara sunulmaz, açmış olanda kalır (bitişik arsa kalabalığı azalsın)
defineExpansion({ id: 'xciftlik3', retired: true, region: 'ciftlik', tier: 3, icon: '🐄', title: 'İkinci Ahır', price: 4600, rect: [16.4, 23, -31.2, -25.6], at: [21.6, -26.6], tex: 'path',
  info: { text: 'Çiftliğe ikinci ahır ve inekler geldi.', steps: [['sut', 'Ahırın önündeki tepside süt birikir; çiftliğin sütü iki katına çıktı.']] },
  build: (c) => {
    const b = M.makeBarn(); b.scale.setScalar(0.8); place(c, b, 19.7, -29.0);
    c.gen(null, 19.7, -29.0, 'sut', { interval: 2.8, max: 8, trayDz: 1.9 });
    for (const [x, z, r] of [[17.4, -26.4, 0.4], [22.0, -26.8, 2.6]]) { const cow = M.makeCow ? M.makeCow() : null; if (cow) c.put(cow, x, 0, z, r); }
  } });

// =====================================================================
// BÜYÜK TARLALAR: aynı koridorun güneyi
// =====================================================================
// koridordaki küçük bostanlar kalktı (2026-11-03 kullanıcı: "toplanan küçük tarlaları kaldır, güzel tarlayı toplama alanı yap"): ayçiçeği
// büyük tarlaların kuzeybatı parselinde (farmland.js sunflowerField), emekli parsellerin bostanları da yok; alanlar çimen kalır
// xtarlalar1 emekli (2026-10-28 kullanıcı: "yeni parsel ve tarla yapmak nedir, neden ona bağlı ilerleniyor"): büyük tarlalar
// zaten traktörle buğday ekiyor; koridordaki buğday parseli yeni oyunculara çıkmaz, Ayçiçeği Tarlası doğrudan Büyük Tarlalar'dan sonra açılır
defineExpansion({ id: 'xtarlalar1', retired: true, region: 'tarlalar', tier: 1, icon: '🌾', title: 'Buğday Parseli', price: 2000, rect: [16.4, 23, -68, -58.6], at: [19.7, -59.6], tex: 'grass',
  info: { text: 'Koridora iki buğday parseli eklendi.', steps: [['bugday', 'Buğday kendi kendine büyür; topla, değirmene ya da harmana götür. Taşıyıcılar da buradan alır.']] },
  build: () => {} });
// yerinde yükseltme: kilidi büyük tarlaların ortasındaki yolda, kuzeybatı parselinin önünde
defineExpansion({ id: 'xtarlalar2', region: 'tarlalar', tier: 2, icon: '🌻', title: 'Ayçiçeği Tarlası', price: 3200, rect: null, at: [30.5, -55.6],
  info: { text: 'Yeni ürün: ayçiçeği!', steps: [['aycicek', `Büyük tarlanın bir parseli ayçiçeği tarlası oldu: içinde yürü, olgun başları topla. Tanesi ${ITEMS.aycicek.price} ₺.`], ['🧺', 'Pazar tezgahında ve şehir marketinin manavında satılır.']] },
  build: (c) => { sunflowerField(c); c.sell('aycicek', 'pazar'); c.sell('aycicek', 'sehir'); } });
defineExpansion({ id: 'xtarlalar3', retired: true, region: 'tarlalar', tier: 3, icon: '🚜', title: 'İkinci Traktör', price: 5200, rect: [16.4, 23, -49.3, -40], at: [19.7, -41.0], tex: 'path',
  info: { text: 'İkinci traktör geldi, tarlalar hızlandı.', steps: [['🚜', 'Büyük tarlalardaki ekin %50 daha hızlı büyür.'], ['bugday', 'Koridordaki parseller de %30 hızlı; bir buğday parseli daha açıldı.']] },
  // eski kayıtta duran traktör maketi kalktı: yerinde karpuz tarlası var (xtarlalar5)
  build: () => { mods().trGrow = 1.5; } });
// toplama tarlalarının kademeleri ve iki yeni tarla (2026-11-05 kullanıcı: "ayçiçeği tarlasının içinde kademeleri arttırma mekaniği olsun,
// diğer tarlalardan da yapalım"; tarla.js). Damla Sulama ve Arı Kovanları bütün toplama tarlalarına işler, sonra açılan tarlaya da.
// Karpuz ve lale batı şeridinde (emekli parsellerin yeri: orman ve süs yok); kilitleri iki şeridin arasındaki boşlukta, su deposu da orada.
// Karpuz toptancının karpuzu gibi pazar tezgâhına, köy manavına, karpuz suyu tezgâhına ve ahırın yemliğine gider (elemanlar parasızını
// seçer); lale çiçekçinin buket masasına, şehrin hediyelik rafına ve çiftliğin arı kovanlarının yemliğine
defineExpansion({ id: 'xtarlalar4', region: 'tarlalar', tier: 4, req: 'xtarlalar2', lvl: 10, icon: '💧', title: 'Damla Sulama', price: 4500, rect: null, at: [18.6, -55.6],
  info: { text: 'Tarlalara damla sulama döşendi: 2. kademe!', steps: [['💧', 'Toplama tarlaları (ayçiçeği, karpuz, lale) %35 daha çabuk yeniden yetişir.'], ['aycicek', 'Sonra açacağın toplama tarlasına da hortum döşenir.']] },
  build: (c) => { irrigation(c); fieldTier(2, c.instant); } });
defineExpansion({ id: 'xtarlalar5', region: 'tarlalar', tier: 5, req: 'xtarlalar2', lvl: 11, icon: '🍉', title: 'Karpuz Tarlası', price: 4400, rect: [16.6, 23.0, -53.6, -44.0], at: [21.2, -54.3], tex: 'grass',
  info: { text: 'Yeni tarla: karpuz!', steps: [['karpuz', `İçinde yürü, olgun karpuzları topla. Tanesi ${ITEMS.karpuz.price} ₺; toptancıdan para verip almana gerek kalmaz.`], ['🧺', 'Pazar tezgâhına, köy manavına, karpuz suyu tezgâhına ve ahırın yemliğine gider.']] },
  build: (c) => {
    c.src('karpuz', new KarpuzField(c.group));
    const [x0, x1, z0, z1] = KARPUZ; M.fieldMarks(c.group, (x0 + x1) / 2, (z0 + z1) / 2, 'karpuz', x1 - x0, z1 - z0);
    c.hint(x0 + 2.2, 1.9, z1 + 0.3, c.icon('karpuz'), 'Karpuz tarlası', 'İçinde yürü: yanındaki olgun karpuzlar sırtına gelir. Taşıyıcı da toplar.');
  } });
defineExpansion({ id: 'xtarlalar6', region: 'tarlalar', tier: 6, req: 'xtarlalar5', lvl: 12, icon: '🌷', title: 'Lale Tarlası', price: 5000, rect: [16.6, 23.0, -67.0, -57.6], at: [21.2, -56.9], tex: 'grass',
  info: { text: 'Yeni tarla: lale!', steps: [['cicek', `İçinde yürü, açmış lale demetlerini topla. Demeti ${ITEMS.cicek.price} ₺.`], ['🌷', 'Çiçekçinin buket masasına, şehrin hediyelik rafına ve çiftliğin arı kovanlarına gider.']] },
  build: (c) => {
    c.src('cicek', new LaleField(c.group));
    const [x0, x1, z0, z1] = LALE; M.fieldMarks(c.group, (x0 + x1) / 2, (z0 + z1) / 2, 'lale', x1 - x0, z1 - z0);
    c.hint(x0 + 2.2, 1.9, z1 + 0.3, c.icon('cicek'), 'Lale tarlası', 'İçinde yürü: yanındaki açmış laleler sırtına gelir. Taşıyıcı da toplar.');
  } });
defineExpansion({ id: 'xtarlalar7', region: 'tarlalar', tier: 7, req: 'xtarlalar4', lvl: 14, icon: '🐝', title: 'Arı Kovanları', price: 7000, rect: null, at: [30.5, -55.6],
  info: { text: 'Tarlalara arı kovanları kondu: 3. kademe!', steps: [['🐝', 'Arılar çiçekleri tozlaştırır: her olgun bitki iki ürün verir, başlar irileşir.'], ['aycicek', 'Ayçiçeği, karpuz ve lale tarlalarının hepsine işler.']] },
  build: (c) => { fieldTier(3, c.instant); } });

// =====================================================================
// KERVANSARAY HANI: hanın kuzeyi (arka duvarının ötesi)
// =====================================================================
// ekler hanın batısında, İpek Yolu'nun kenarındaydı; kasabanın tam karşısında kalabalık yapıyordu (2026-11-01 kullanıcı: "kervansarayı
// kasabadan uzaklaştır"): hanın kuzeyine yan yana dizildi, hanın batısı ile İpek Yolu arası boş çayır kaldı. Hanın arka duvarı ile
// bölgenin kuzey kenarı arasından (z -55..-59,6) yürünür; ödeme yerleri o şeritte
defineExpansion({ id: 'xhan1', region: 'han', tier: 1, icon: '🐫', title: 'Deve Ağılı', price: 2200, rect: [-16, -5.4, -68.8, -59.6], at: [-10.7, -59.2], tex: 'path',
  info: { text: 'Hanın kuzeyine deve ağılı kuruldu.', steps: [['🐫', 'Kervanlar ağılda dinlenir: daha sık gelir ve teslimde %25 fazla öder.']] },
  build: (c) => {
    c.put(makeCampPen(), -10.7, 0, -64.6);
    for (const [x0, x1, z0, z1] of [[-15.4, -6.0, -67.9, -67.7], [-15.4, -11.8, -61.5, -61.3], [-9.6, -6.0, -61.5, -61.3], [-15.4, -15.2, -67.9, -61.3], [-6.2, -6.0, -67.9, -61.3]]) c.col(x0, x1, z0, z1);
    for (const [x, z, r, l] of [[-13.1, -63.4, 0.6, '#b23a48'], [-8.5, -65.2, 2.4, '#2f6db5']]) { const m = M.makeCamel(l); c.put(m, x, 0, z, r); }
    const H = G.regions.han; H.bonus = (H.bonus || 1) * 1.25;
    after(H, (dt) => { const K = H.caravan; if (K && K.state === 'away') K.t -= dt * 0.4; });
  } });
// güveç ocağı hanın avlusunda, kapının sağında (2026-11-02 kullanıcı: "develer her geldiğimde çorba istiyor ama çorba kervansarayın
// arkasında alakasız bir yerde kalmış, orayı da kervansarayın içine dahil et"): eskiden arka duvarın ardındaki eklerin arasındaydı
defineExpansion({ id: 'xhan2', region: 'han', tier: 2, icon: '🍲', title: 'Güveç Ocağı', price: 3400, rect: null, at: [6.5, -42.6],
  info: { text: 'Yeni ürün: güveç!', steps: [['domates', 'Domatesi ocağın soldaki masasına bırak (iki domates bir güveç).'], ['guvec', `Güveç sağdaki masada pişer. Tanesi ${ITEMS.guvec.price} ₺; kervanlar artık güveç de ister.`]] },
  build: (c) => {
    const p = M.model('pot-stew'); p.scale.setScalar(3.2);
    c.machine(p, 6.5, -45.6, 'domates', 'guvec', 6.5, { need: 2 }); // iki domates bir güveç
    const H = G.regions.han; if (H.menu && !H.menu.includes('guvec')) H.menu.push('guvec');
  } });
defineExpansion({ id: 'xhan3', region: 'han', tier: 3, icon: '🛏️', title: 'Konuk Odaları', price: 5000, rect: [5.4, 16, -68.8, -59.6], at: [10.7, -59.2], tex: 'cobble',
  info: { text: 'Han konuk odaları açtı.', steps: [['🛏️', 'Yolcular hanın meydanından gelip odalara yerleşir; çıkarken konaklama ücretini hanın kasasına bırakır (mahalle puanı yükseldikçe daha sık).'], ['🐫', 'Kervan ödemeleri %20 daha fazla.']] },
  build: (c) => {
    place(c, makeGuestHouse(), 10.7, -66.0);
    const H = G.regions.han; H.bonus = (H.bonus || 1) * 1.2;
    guests.on = true; // eskiden yalnız görünmez gelirdi; kayıt açılırken hanın kasası henüz yoksa o da hiç başlamıyordu (2026-11-01 kullanıcı: "konuk evi faaliyeti yok")
  } });
// hamam hanın kuzeyinde, deve ağılı ile konuk odalarının arasında. Eskiden tatil köyünün sahilindeydi; kimliği (xtatil2) kayıtlar
// bozulmasın diye aynı kaldı. 2026-11-03 kullanıcı: "Sahile kabuk otelin yan tarafından hamamı kaldır. Hamamı kervansarayın yanına al."
// (seçim: han konukları ve kervanlar). Havlu yine tatil köyünün çamaşırhanesinden gelir; ücret hanın kasasına düşer
let hamam = null, caravans0 = 0;
const HAMAM_DOOR = V(0, 0, -62.3);
defineExpansion({ id: 'xtatil2', region: 'han', tier: 4, icon: '🧖', title: 'Hamam', price: 4200, rect: [-5.4, 5.4, -68.8, -59.6], at: [0, -59.2], tex: 'cobble',
  info: { text: 'Yeni iş: hamam!', steps: [['havlu', 'Tatil köyünün çamaşırhanesinden temiz havluyu hamamın havlu dolabına götür.'], ['🧖', 'Dolapta havlu oldukça konuk odalarından çıkan yolcular ve gelen kervanlar hamama girer: 35 ₺ fazladan öder.']] },
  build: (c) => {
    place(c, makeHamam(), 0, -65.4);
    hamam = new TowelRack(c.group, -2.7, -61.4, c.instant);
    G.xsink.push({ type: 'havlu', conv: hamam, pri: 2 });
    c.hint(-2.7, 2.2, -61.4, ITEMS.havlu ? c.icon('havlu') : '🧺', 'Hamam havlu dolabı', 'Temiz havlu getir; konuk odalarından çıkan yolcular ve kervanlar hamama girer, fazladan öder.', 3.4);
    caravans0 = G.stats.caravans || 0; // kayıt açılırken eski kervanlar sayılmasın
  } });
// hamam ziyareti: dolaptan bir havlu gider, ücret hanın kasasına
function bathPay(label, base) {
  if (!hamam || !hamam.input.length) return;
  hamam.use();
  const H = G.regions.han, pay = Math.round(base * mult());
  if (H && H.pile) { H.pile.add(pay, hamam.at); floatText(hamam.at, `${label} +${pay} ₺`, 'pos'); sfx('cash', { at: hamam.at }); }
}
// konuklar: hanın meydanından gelir, üç odadan boş olanına girip 25-50 sn kalır, çıkarken ücreti hanın kasasına bırakıp meydana döner.
// Aynı anda en çok üç oda dolu; mahalle puanı yüksekse daha sık gelirler
const GUEST_DOORS = [7.7, 10.7, 13.7], GUEST_FROM = { x: 0, z: -30.5 };
const guests = { on: false, t: 8, list: [] };
function guestOne(door) {
  const c = new Customer(V(GUEST_FROM.x + rand(-2, 2), 0, GUEST_FROM.z), 'han', Math.random() < 0.6 ? M.townLook() : M.villagerLook());
  c.door = door; c.state = 'in'; c.path = [V(door, 0, -63.3)]; c.setBubbleText('🛏️', 'pay');
  c.think = (dt) => {
    if (c.state === 'in') { if (c.walk(dt)) { c.state = 'stay'; c.obj.visible = false; c.clearBubble(); c.t = rand(25, 50); } }
    else if (c.state === 'stay') {
      if ((c.t -= dt) > 0) return;
      c.obj.visible = true; c.state = 'out'; c.leaving = true; c.path = [V(GUEST_FROM.x + rand(-2, 2), 0, GUEST_FROM.z)];
      const pile = G.regions.han && G.regions.han.pile, pay = Math.round(rand(18, 28) * mult());
      if (pile) { pile.add(pay, c.obj.position); floatText(c.obj.position, `🛏️ Konaklama +${pay} ₺`, 'pos'); sfx('cash', { at: c.obj.position }); }
      if (hamam && hamam.input.length) { c.state = 'hamam'; c.path = [HAMAM_DOOR.clone().setX(rand(-0.4, 0.4))]; c.setBubbleText('🧖', 'pay'); } // havlu varsa yola çıkmadan hamama uğrar
    } else if (c.state === 'hamam') { if (c.walk(dt)) { c.state = 'bath'; c.obj.visible = false; c.clearBubble(); c.t = rand(5, 8); } }
    else if (c.state === 'bath') {
      if ((c.t -= dt) > 0) return;
      c.obj.visible = true; c.state = 'out'; c.path = [V(GUEST_FROM.x + rand(-2, 2), 0, GUEST_FROM.z)];
      bathPay('🧖 Hamam', 35);
    } else if (c.state === 'out' && c.walk(dt)) { guests.list = guests.list.filter((q) => q !== c); c.destroy(); }
  };
  guests.list.push(c);
}
function updateGuests(dt) {
  if (!guests.on || !G.regions.han || !G.regions.han.unlocked) return;
  if ((guests.t -= dt * repMul()) > 0) return;
  guests.t = rand(16, 26);
  const used = new Set(guests.list.filter((c) => c.state === 'in' || c.state === 'stay').map((c) => c.door)); // hamama giden odayı boşaltmıştır
  const free = GUEST_DOORS.filter((d) => !used.has(d));
  if (free.length) guestOne(free[Math.floor(Math.random() * free.length)]);
}

// =====================================================================
// KÖY FIRINI: fırının batısı
// =====================================================================
// retired: kullanıcı isteğiyle (2026-10-28) yeni oyunculara sunulmaz, açmış olanda kalır (bitişik arsa kalabalığı azalsın)
// iki fırın da fırın salonunun içinde (carsi.js makeBakeHall, 2026-11-04; eskiden batıdaki bitişik arsalardaydı): ikinci simit batı
// kanatta, pide ortada, kendi vitrininin arkasında
defineExpansion({ id: 'xfirin1', retired: true, region: 'firin', tier: 1, icon: '🥯', title: 'İkinci Simit Fırını', price: 1600, rect: null, at: [-19.7, -24.2],
  info: { text: 'Fırın salonunun batı kanadına ikinci simit fırını kuruldu.', steps: [['un', 'Unu fırının soldaki masasına bırak.'], ['simit', 'Simit sağdaki masada birikir; vitrine götür.']] },
  build: (c) => { c.machine(SMALL_OVEN('simit'), -19.7, -26.4, 'un', 'simit', 3.4); } });
defineExpansion({ id: 'xfirin2', region: 'firin', tier: 2, icon: '🫓', title: 'Pide Fırını', price: 2800, rect: null, at: [-2.4, -24.2],
  info: { text: 'Yeni ürün: pide!', steps: [['un', 'Unu pide fırınının soldaki masasına bırak (iki un bir pide).'], ['pide', `Pide sağdaki masada pişer. Tanesi ${ITEMS.pide.price} ₺; fırının vitrininde satılır.`]] },
  build: (c) => {
    c.machine(SMALL_OVEN('pide'), -2.4, -26.4, 'un', 'pide', 5.0, { need: 2 }); // iki un bir pide
    const F = G.regions.firin;
    if (F.house && F.house.userData.rack) F.house.userData.rack.visible = false; // fırın ekmek rafının önüne kurulur (carsi.js makeBakeHall)
    // pidenin kendi vitrini: fırın açıksa vitrin sırasının doğu ucuna kurulur (fırın sonradan açılsa da; carsi.js addVitrin)
    G.xsell.push({ type: 'pide', list: null, shelf: () => (F.unlocked && F.addVitrin && F.vitrins ? F.addVitrin('pide', false) : null) });
  } });
defineExpansion({ id: 'xfirin3', region: 'firin', tier: 3, icon: '🥐', title: 'Büyük Vitrin', price: 3800, rect: null, at: [4.0, -21.0],
  info: { text: 'Fırın büyüdü, mahalle sıraya giriyor.', steps: [['🥐', 'Fırına %60 daha sık müşteri gelir.'], ['🔥', 'Bütün fırınlar %30 daha hızlı pişirir.']] },
  build: () => {
    const F = G.regions.firin;
    for (const o of F.ovens || []) if (!o.fast) { o.fast = true; o.out.interval /= 1.3; o.out.baseInterval = o.out.interval; }
    after(F, (dt) => { F.custT -= dt * 0.6; });
  } });

// =====================================================================
// SAHİL BÜFESİ: kumsal ve nehir kıyısı
// =====================================================================
defineExpansion({ id: 'xsahil1', region: 'sahil', tier: 1, icon: '⛱️', title: 'Şezlong Sırası', price: 1500, rect: null, at: [19.5, 22.6],
  info: { text: 'Kumsala üç şezlong daha kondu.', steps: [['⛱️', 'Daha çok tatilci aynı anda güneşlenir, büfeden sipariş verir.']] },
  build: (c) => { G.regions.sahil.addLoungers([19.5, 26.25, 3.75], c.instant); } });
// deniz bisikleti kiralama büfenin hizmeti (2026-11-03 kullanıcı: "deniz bisikleti kiralama hizmetini sahildeki büfe ile birleştir, tek bir
// işletmenin sırayla açılan hizmetleri olsun"): eskiden derenin kıyısında ayrı kulübe ve kasaydı (arsa 52,3-56,6 / 14,9-27,4). Tezgâh büfenin
// doğusunda, içecek dolabıyla palmiyenin arasında; ücret büfenin kasasına düşer. Kayıttaki eski kasa parası world.js MOVED_PILES ile büfeye geçer
defineExpansion({ id: 'xsahil2', region: 'sahil', tier: 2, icon: '🚲', title: 'Deniz Bisikleti Kiralama', price: 3000, rect: null, at: [39.6, 18.4],
  info: { text: 'Büfe deniz bisikleti de kiralıyor!', steps: [['🚲', 'Tatilciler büfeden deniz bisikleti kiralar; açıkta bir bisiklet daha dolaşır.'], ['💰', 'Her kiralama 24 ₺; para büfenin kasasına düşer.']] },
  build: (c) => {
    place(c, makeRentalKiosk(), 39.6, 18.4);
    addRental(() => G.regions.sahil && G.regions.sahil.pile, V(39.6, 1.6, 18.9), c.instant, [40.4, 19.6, 0.3]); // kiralamacı tezgâhın önünde, denize bakar
  } });
defineExpansion({ id: 'xsahil3', region: 'sahil', tier: 3, icon: '🍦', title: 'Büfe Büyür', price: 4400, rect: null, at: [36.2, 22.6],
  info: { text: 'Büfe büyüdü, kumsal kalabalık.', steps: [['⛱️', 'Bir şezlong daha; tatilciler %50 daha sık gelir.'], ['🍦', 'Mısır kazanı ve dondurma makinesi %30 daha hızlı.']] },
  build: (c) => {
    const S = G.regions.sahil;
    S.addLoungers([41.25], c.instant);
    for (const m of [S.iceMachine, S.cornPot]) if (m && !m.fast) { m.fast = true; m.out.interval /= 1.3; m.out.baseInterval = m.out.interval; }
    after(S, (dt) => { S.spawnT -= dt * 0.5 * repMul(); });
  } });

// =====================================================================
// KABUK TATİL KÖYÜ: doğu ucu (tahta yolun güneyi)
// =====================================================================
// retired: kullanıcı isteğiyle (2026-10-28) yeni oyunculara sunulmaz, açmış olanda kalır (bitişik arsa kalabalığı azalsın)
defineExpansion({ id: 'xtatil1', retired: true, region: 'tatil', tier: 1, icon: '🐚', title: 'Altıncı Kabuk Ev', price: 3000, rect: [104.3, 113, 15.2, 31], at: [107.4, 29.6], tex: 'sand',
  info: { text: 'Tatil köyüne altıncı kabuk ev kuruldu.', steps: [['🐚', 'Bir misafir daha konaklar; resepsiyondan kayıt olur, evini temizletir, ödeyip gider.']] },
  build: (c) => { const T = G.regions.tatil; if (!HOUSE_X.includes(109)) HOUSE_X.push(109); T.addHouse(HOUSE_X.indexOf(109), c.instant); } });
// beach club hamamın eski arsasında (2026-11-03 kullanıcı: "Kabuk tatil köyünün yan tarafına sahile beach club yap. Dj kabini olsun dj
// müzik çalsın insanlar denize girip eğlensin. Önüne iskele yap. Yatlar tekneler yanaşsın liman olsun."): DJ sahnesi, pist, bar,
// iskele ve yanaşan yatlar club.js'te. Giriş ve yat bağlama ücreti kulübün kasasına düşer. Ödeme yeri tahta yolun doğu ucunda (resort.js)
defineExpansion({ id: 'xtatil4', region: 'tatil', tier: 2, icon: '🎧', title: 'Beach Club', price: 5200, rect: [112.7, 126.4, 15.2, 31], at: [116.8, 14.2], tex: 'sand',
  info: { text: 'Yeni iş: Beach Club!', steps: [['🎧', 'DJ çalar; kalabalık dans eder, denize girip eğlenir. Her giriş kulübün kasasına 15 ₺ bırakır.'], ['⚓', 'İskeleye yatlar yanaşır: bağlama ücreti 60 ₺, yolcuları da kulübe iner.']] },
  build: (c) => buildClub(c, { place, cashBox, danceStep }) });
defineExpansion({ id: 'xtatil3', region: 'tatil', tier: 3, icon: '🌟', title: 'Beş Yıldızlı Hizmet', price: 6000, rect: null, at: [98, 12.6],
  info: { text: 'Tatil köyü beş yıldızlı oldu.', steps: [['💰', 'Konaklama ücreti %25 daha yüksek.'], ['🧳', 'Misafirler %40 daha sık gelir.']] },
  build: () => {
    const T = G.regions.tatil, fee = T.fee;
    if (!T.fiveStar) { T.fiveStar = true; T.fee = () => Math.round(fee() * 1.25); }
    after(T, (dt) => { T.spawnT -= dt * 0.4; });
  } });
// havlu dolabı: havlu kabul eder, rafta görünür; her hamam ziyaretinde bir havlu gider
class TowelRack extends Station {
  constructor(parent, x, z, instant) {
    super(x, z + 1.2, 2.4, 1.3, { instant });
    this.inType = 'havlu'; this.cap = 8; this.input = [];
    this.at = V(x, 1.6, z);
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    M.rbox(1.6, 1.4, 0.6, 0.05, M.mat('#a8703f'), 0, 0.7, 0, g);
    for (const y of [0.55, 1.05]) M.rbox(1.5, 0.05, 0.55, 0.02, M.mat('#c99a6a'), 0, y, 0.02, g);
    this.slotG = g;
    G.colliders.push([x - 0.85, x + 0.85, z - 0.35, z + 0.35]);
  }
  accepts(t) { return t === 'havlu'; }
  putFrom(stack) {
    if (this.input.length >= this.cap) return false;
    const it = stack.takeOf(['havlu']);
    if (!it) return false;
    const i = this.input.length;
    this.input.push(it.obj);
    fly(it.obj, this.slotG, V(-0.55 + (i % 4) * 0.37, i < 4 ? 0.62 : 1.12, 0.05), 0.3, 0.9);
    sfx('pop', { npc: stack !== G.stack });
    return true;
  }
  use() { const o = this.input.pop(); if (o && o.parent) o.parent.remove(o); }
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.15 && this.putFrom(G.stack)) this.t = 0;
  }
}

// =====================================================================
// KASABA MEYDANI: meydanın kuzeyi (ormanda açıklık)
// =====================================================================
let cafeFolks = [], stage = null;
// gösteri (konser ya da tiyatro): sanatçı yoksa sahne boş, seyirci gelmez. Varsa ~30 sn'de bir: 12 sn seyirci toplanır ve gişeden
// bilet alır (gişe görevlisi ya da gişede duran oyuncu satar), 35 sn gösteri, sonra herkes dağılır. G.show sanatçıları oynatır.
// Gösteriler arasında sanatçılar prova eder; provayı birkaç meraklı arkadan bedavaya izler (2026-11-01 kullanıcı: "sahnede sanatçılar
// var ama dinleyiciler yok": gösteriler 75 sn arayla, 25 sn sürüyordu; sahne çoğu zaman boş görünüyordu)
const GISE = { x: -41.0, z: -50.6 }, SHOW_FROM = { x: -39.5, z: -37.5 };
const show = { t: 12, gather: 0, on: 0, kind: 'konser', next: 'konser', want: 0, spawnT: 0, spots: [], pile: null, aud: [], idle: [], idleT: 0 };
// sahnede duran sanatçı var mı (upgrades.js Artist: gösteri yokken kasabada gezinirler, gösteriye 14 sn kala sahneye yürürler)
const onStage = () => ((G.staff && G.staff.artist) || []).some((a) => a.mode === 'stage');
G.show = show;
defineExpansion({ id: 'xkasaba1', region: 'kasaba', tier: 1, lvl: 8, icon: '☕', title: 'Kasaba Kahvesi', price: 2500, rect: [-57, -49.5, -62, -49.3], at: [-53.2, -51.0], tex: 'cobble',
  info: { text: 'Meydanın kuzeyine kasaba kahvesi açıldı.', steps: [['☕', 'Kasabalılar oturup çay içer; hesap kahvenin kasasında birikir (mahalle puanı yükseldikçe daha çok).'], ['💰', 'Kasayı sen ya da muhasebeci toplar.']] },
  build: (c) => {
    c.put(makeCafe(), -53.2, 0, -57.0);
    for (const [x, z] of [[-54.8, -57.8], [-51.6, -57.8], [-54.8, -55.8], [-51.6, -55.8]]) c.col(x - 0.55, x + 0.55, z - 0.5, z + 0.5);
    for (const [x, z, r] of [[-55.5, -57.8, PI / 2], [-50.9, -55.8, -PI / 2]]) {
      const o = M.makeCharacter(Math.random() < 0.5 ? M.townLook() : M.villagerLook());
      for (const l of o.userData.legs) l.rotation.x = -1.45;
      c.put(o, x, -0.18, z, r); cafeFolks.push(o);
    }
    const P = cashBox(c, -55.6, -53.0);
    cafe.pile = P; // kek vitrininin parası da buraya (xkoy5)
    income(P, 9, 9, '☕ çay', V(-53.2, 1.8, -57.0));
  } });
// kek tezgâhı kahvenin arkasında, masaları kahveye bakar; kek kahvenin önündeki, parka bakan vitrinde satılır (çiçekçinin vitrini gibi),
// parası kahvenin kasasına düşer. 2026-11-02'ye kadar köy bakkalının imalathanesindeydi (expand-west.js); kimliği kayıtlar için aynı
defineExpansion({ id: 'xkoy5', region: 'kasaba', chain: 'kek', req: 'xkasaba1', tier: 1, lvl: 14, icon: '🧁', title: 'Kek Tezgâhı', price: 4400, rect: [-57, -49.8, -66.6, -62], at: [-53.4, -62.6], tex: 'cobble',
  info: { text: 'Yeni ürün: ev keki!', steps: [['un', 'Unu, yumurtayı ve sütü tezgâhın soldaki masasına bırak: üçü bir araya gelince kek fırına girer.'], ['kek', `Keki kahvenin önündeki vitrine diz; parktan gelenler alır, parası kahvenin kasasına düşer. Tanesi ${ITEMS.kek.price} ₺.`]] },
  build: (c) => {
    const x = -53.4, z = -65.2, tw = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) }); // c.machine düzeni: solda girdi, sağda çıktı masası
    c.put(makeKekTezgahi(), x, 0, z);
    for (const dx of [-2, 2]) c.put(workTable(1.2, 0.8, 0.8, tw), x + dx, 0.4, z + 1.2);
    c.col(x - 2.7, x + 2.7, z - 0.9, z + 1.7);
    const conv = new Mixer(c.group, { recipe: ['un', 'yumurta', 'sut'], ix: x - 2, iz: z + 2.4, iw: 2.2, id: 1.3, inTray: [x - 2, 0.86, z + 1.2], instant: c.instant,
      out: { type: 'kek', interval: 6.0, max: 6, origin: new THREE.Vector3(x + 0.5, 1.4, z), tray: [x + 2, 0.86, z + 1.2], zx: x + 2, zz: z + 2.4, zw: 2.2, zd: 1.3 } });
    for (const t of conv.recipe) G.xsink.push({ type: t, conv, pri: 3 });
    c.src('kek', conv.out);
    (G.xgens.xkoy5 || (G.xgens.xkoy5 = [])).push(conv.out); // menüde hız ve tepsi yükseltmesi (upgrades.js XMACH)
    c.hint(x - 2, 2.2, z + 2.4, c.icon('un'), 'Kek tezgâhı', 'Un, yumurta ve süt bırak: üçü bir araya gelince kek olur.', 3.4);
    const A = makeAisle({}, { content: c.group, put: (p, o, x, y, z, ry) => c.put(o, x, y, z, ry), rcol: (_, ...a) => c.col(...a), places: { kek: [-53.0, -51.0, 1, 2.0] },
      w: 2.0, tagColor: '#b5523b', place: 'kahve', back: 0.5, look: () => 2 });
    kekShop.vitrin = A.ensure('kek', c.instant);
    G.xsell.push({ type: 'kek', list: null, shelf: () => kekShop.vitrin });
    if (!cafe.pile) kekShop.own = cashBox(c, -50.6, -53.2);
  } });
// arsa kuzeye 4,6 m uzun (2026-10-28 kullanıcı: "çiçekçi çok dar"): doğu ve batısı kahve ile konser alanı, genişleyemez; tarhlar geriye
// alındı, tarh, buket masası, vitrin ve kasa arasında yürüme payı var. Vitrin arsanın içinde, parka bakar
defineExpansion({ id: 'xkasaba2', region: 'kasaba', tier: 2, lvl: 10, icon: '🌷', title: 'Çiçekçi', price: 3500, rect: [-49.8, -42, -66.6, -49.3], at: [-45.75, -51.0], tex: 'grass',
  info: { text: 'Kasabaya çiçekçi açıldı: tarhta çiçek yetişir, masada buket yapılır, vitrinde satılır.', steps: [
    ['cicek', 'Arkadaki tarhlardan çiçekleri topla.'],
    ['buket', `Çiçekleri buket masasının soldaki tepsisine bırak: iki çiçek bir buket olur, sağdaki tepside birikir. Buketi ${ITEMS.buket.price} ₺.`],
    ['🌷', 'Buketleri parka bakan vitrine diz. Parktan gelenler alır, parayı yandaki kasaya bırakır; taşıyıcı ve muhasebeci de yardım eder.'],
  ] },
  build: (c) => {
    c.bed(-45.75, -64.4, 'cicek', 7); c.bed(-45.75, -60.6, 'cicek', 7);
    c.put(makeFloristShop(), -45.9, 0, -56.0);
    c.machine(null, -45.9, -56.8, 'cicek', 'buket', 4.5, { need: 2, pri: 2 }); // buket masası: girdi solda, buket sağda; iki çiçek bir buket
    const F = {}; // vitrin: parka bakan tek ürünlü raf (reyon.js)
    const A = makeAisle(F, { content: c.group, put: (p, o, x, y, z, ry) => c.put(o, x, y, z, ry), rcol: (_, ...a) => c.col(...a), places: { buket: [-45.75, -51.2, 1, 2.0] },
      w: 2.0, tagColor: '#e05a8c', place: 'cicekci', back: 0.5, look: () => 2 });
    florist.vitrin = A.ensure('buket', c.instant);
    G.xsell.push({ type: 'buket', list: null, shelf: () => florist.vitrin });
    florist.pile = cashBox(c, -48.6, -50.6); // vitrinin batısında
    // ön avlu: masa ile vitrin arası taş döşeme; iki yanda çiçek saksılı ahşap tekne, vitrinin doğusunda basamaklı çiçek sehpası
    c.put(M.rbox(7.2, 0.03, 5.4, 0.01, new THREE.MeshStandardMaterial({ color: '#f6e7e4', map: texRep('cobble', 3.6, 2.7), roughness: 0.95 })), -45.9, 0.016, -52.4);
    for (const x of [-49.15, -42.65]) {
      c.put(M.rbox(0.7, 0.45, 1.6, 0.05, wood()), x, 0.23, -52.8);
      for (const dz of [-0.5, 0, 0.5]) c.put(M.makeFlowers(), x, 0.42, -52.8 + dz);
      c.col(x - 0.35, x + 0.35, -53.6, -52.0);
    }
    const stand = new THREE.Group();
    [[0.9, 0.18], [0.62, 0.42], [0.34, 0.66]].forEach(([d, y], k) => {
      M.rbox(1.0, 0.06, d, 0.02, wood(), 0, y, -0.4 + d / 2, stand);
      for (let i = 0; i < 3; i++) {
        M.cyl(0.11, 0.08, 0.18, 8, M.mat('#c56a3c'), -0.33 + i * 0.33, y + 0.12, -0.4 + d - 0.16, stand);
        M.sph(0.11, M.mat(['#e8473c', '#ff6fa8', '#f6c343', '#9c6cf0', '#ffffff'][(i + k * 2) % 5]), -0.33 + i * 0.33, y + 0.28, -0.4 + d - 0.16, stand, 8, 6);
      }
    });
    for (const x of [-0.48, 0.48]) M.rbox(0.05, 0.66, 0.9, 0.01, wood(), x, 0.33, 0.05, stand);
    c.put(stand, -43.3, 0, -50.8); c.col(-43.85, -42.75, -51.25, -50.3);
    c.sell('cicek', 'hediye'); // kesme çiçek şehirde de satılır
  } });
defineExpansion({ id: 'xkasaba3', region: 'kasaba', tier: 3, lvl: 12, icon: '🎵', title: 'Konser Alanı', price: 6000, rect: [-42.3, -34.5, -62, -49.3], at: [-38.25, -51.0], tex: 'grass',
  info: { text: 'Kasabaya konser alanı kuruldu.', steps: [['🎵', 'Arada bir konser verilir: mahalle puanı yükselir, bütün bölgelere daha çok müşteri gelir.']] },
  build: (c) => {
    stage = place(c, makeStage(), -38.25, -58.4);
    // gişe: alanın güneybatı köşesinde; bilet parası kasasında birikir (sen, muhasebeci toplar)
    c.put(makeBooth(), GISE.x, 0, GISE.z);
    show.pile = cashBox(c, GISE.x, GISE.z);
    for (let i = 0; i < 12; i++) show.spots.push({ x: -41.0 + (i % 4) * 1.9 + rand(-0.35, 0.35), z: -55.4 + Math.floor(i / 4) * 1.3 + rand(-0.25, 0.25), c: null });
  } });

// =====================================================================
// ŞEHİR MARKETİ: marketin içinde yerinde yükseltmeler (city.js)
// =====================================================================
defineExpansion({ id: 'xsehir1', region: 'sehir', tier: 1, icon: '🥖', title: 'Unlu Mamul Reyonu', price: 6000, rect: null, at: [423, 0.5], // pide rafının açılacağı yerin önü (city.js)
  info: { text: 'Markete pide rafı açıldı.', steps: [['pide', 'Köy kamyoneti pideyi de getirir; kendi rafına diz. Ekmek, simit ve poğaça kahvaltılık raflarında.'], ['💰', 'Şehirde köy fiyatının 1,5 katına satılır.']] },
  build: (c) => { const S = G.regions.sehir; if (S.addShelf) S.addShelf('unlu', c.instant); } });
defineExpansion({ id: 'xsehir2', region: 'sehir', tier: 2, icon: '🥪', title: 'Tost Büfesi', price: 9000, rect: null, at: [424.5, 8.6],
  info: { text: 'Yeni ürün: kaşarlı tost!', steps: [['ekmek', 'Ekmeği tost makinesinin soldaki masasına bırak.'], ['tost', `Tost sağdaki masada pişer. Tanesi ${ITEMS.tost.price} ₺ (şehirde 1,5 katı); kahvaltılık reyonunda satılır.`]] },
  build: (c) => {
    c.machine(makeToaster(), 424.5, 5.6, 'ekmek', 'tost', 4.0);
    const S = G.regions.sehir;
    G.xsell.push({ type: 'tost', list: () => S.groups && S.groups.kahve, shelf: () => S.shelfByType && S.shelfByType.tost }); // kendi rafı (city.js)
  } });
defineExpansion({ id: 'xsehir3', region: 'sehir', tier: 3, icon: '🏬', title: 'Büyük Market', price: 14000, rect: null, at: [428.5, 1.8],
  info: { text: 'Şehir Marketi büyük markete dönüştü.', steps: [['👥', 'Aynı anda 6 müşteri daha gezer, müşteriler %50 daha sık gelir.'], ['💰', 'Ürünler köy fiyatının 1,7 katına satılır.']] },
  build: (c) => { const m = mods(); m.cityMax = 6; m.cityRate = 1.5; m.cityPremium = 1.7; const S = G.regions.sehir; if (S.setStage) S.setStage(1, c.instant); } });
// süpermarket ve hipermarket (2026-11-04 kullanıcı: "orayı da yavaş yavaş süper markete dönüştürelim"; supermarket.js, city.js setStage)
defineExpansion({ id: 'xsehir4', region: 'sehir', tier: 4, icon: '🛒', title: 'Süpermarket', price: 20000, rect: null, at: [435, 4.6],
  info: { text: 'Şehir Marketi süpermarkete dönüştü!', steps: [['makarna', 'Toptancı kamyonu makarna, pirinç, su ve gazozu toptan paletine getirir. Toptan fiyatına al, yeni reyonlara diz.'], ['👥', 'Aynı anda 10 müşteri daha gezer, müşteriler 1,8 kat sık gelir. Ürünler köy fiyatının 1,8 katına satılır.']] },
  build: (c) => { const m = mods(); m.cityMax = 10; m.cityRate = 1.8; m.cityPremium = 1.8; const S = G.regions.sehir; if (S.setStage) S.setStage(2, c.instant); } });
defineExpansion({ id: 'xsehir5', region: 'sehir', tier: 5, icon: '🏬', title: 'Hipermarket', price: 32000, rect: null, at: [449.5, -5.4],
  // 2026-11-08: arka salon kalktı, yeni raflar orta reyonun kasaya bakan yüzünde (kullanıcı: "sonradan açılan raflar çok uzakta kaldı")
  info: { text: 'Market hipermarkete dönüştü!', steps: [['deterjan', 'Orta reyonda temizlik ve atıştırmalık rafları: deterjan, sabun, kağıt havlu, cips, çikolata, bisküvi. Toptancı kamyonu getirir.'], ['🏙️', 'Caddeden görünen hipermarket tabelası dikilir.'], ['👥', 'Aynı anda 14 müşteri daha gezer, müşteriler 2,1 kat sık gelir. Ürünler köy fiyatının 1,9 katına satılır.']] },
  build: (c) => { const m = mods(); m.cityMax = 14; m.cityRate = 2.1; m.cityPremium = 1.9; const S = G.regions.sehir; if (S.setStage) S.setStage(3, c.instant); } });

// ---------- her kare (services.js) ----------
const bees = [];
export function updateExpandEast(dt) {
  const t = G.time;
  for (const h of bees) for (const b of h.list) { b.a += dt * b.s; b.b.position.set(h.at.x + Math.cos(b.a) * b.r, h.at.y + b.y + Math.sin(t * 6 + b.a) * 0.08, h.at.z + Math.sin(b.a * 1.3) * b.r * 0.7); }
  for (const f of cafeFolks) { const a = f.userData.arms; a[0].rotation.x = -0.9 + Math.sin(t * 1.3 + f.id) * 0.25; }
  // pasif gelir: kasaya düşer, puan yüksekse daha sık
  for (const I of incomes) {
    if ((I.t -= dt * repMul()) > 0) continue;
    I.t = I.every * rand(0.8, 1.2);
    const pile = typeof I.pile === 'function' ? I.pile() : I.pile;
    if (!pile) continue;
    const pay = Math.round((I.base + rand(0, I.base * 0.6)) * mult());
    pile.add(pay, I.at); floatText(I.at, `${I.label} +${pay} ₺`, 'pos');
  }
  updateGuests(dt);
  if (hamam && (G.stats.caravans || 0) > caravans0) { caravans0 = G.stats.caravans; bathPay('🐫 Kervan hamamda', 45); } // teslim eden kervanın yolcuları yıkanır
  updateClub(dt);
  // çiçekçi: vitrinde buket varsa parktan müşteri gelir (aynı anda en çok 3, mahalle puanı yüksekse daha sık)
  if (florist.vitrin && (florist.t -= dt * repMul()) <= 0) { florist.t = rand(7, 12); if (florist.busy < 3) shopCustomer(florist, 'buket', '🌷'); }
  if (kekShop.vitrin && (kekShop.t -= dt * repMul()) <= 0) { kekShop.t = rand(7, 12); if (kekShop.busy < 2) shopCustomer(kekShop, 'kek', '🧁'); } // kahvenin kek vitrini
  if (stage) updateShow(dt, t);
}
// ---------- gösteri ----------
const artistsN = () => ((G.staff && G.staff.artist) || []).length;
function audienceOne() {
  const spot = show.spots.find((q) => !q.c); if (!spot) return;
  const c = new Customer(V(SHOW_FROM.x + rand(-2, 2), 0, SHOW_FROM.z), 'kasaba', Math.random() < 0.55 ? M.townLook() : M.villagerLook());
  spot.c = c; show.aud.push(c);
  const at = V(GISE.x + rand(-0.5, 0.5), 0, GISE.z + 1.35);
  c.state = 'gise'; c.path = [at]; c.wait = 0; c.setBubbleText('🎟️', 'pay');
  c.d = { o: c.obj, style: DANCES[Math.floor(rand(0, DANCES.length))], f: rand(4.2, 6.8), ph: rand(0, PI * 2), ry: Math.atan2(-38.25 - spot.x, -58.4 - spot.z) + rand(-0.3, 0.3) };
  const gone = () => { if (spot.c === c) spot.c = null; c.clearBubble(); c.obj.position.y = 0; c.obj.rotation.x = c.obj.rotation.z = 0; c.state = 'leave'; c.leaving = true; c.path = [V(SHOW_FROM.x + rand(-2, 2), 0, SHOW_FROM.z)]; };
  c.goHome = gone;
  c.think = (dt) => {
    if (c.state === 'gise') {
      if (!c.walk(dt)) return;
      c.face(PI, dt); c.wait += dt;
      const clerk = G.staff && G.staff.ticket && G.staff.ticket.length, pl = G.player.position, here = Math.hypot(pl.x - GISE.x, pl.z - (GISE.z + 1.0)) < 2.2;
      if ((clerk && c.wait > 1.0) || (here && c.wait > 0.5)) { // bilet satıldı
        const n = artistsN(), pay = Math.round((20 + 6 * n) * mult());
        show.pile.add(pay, c.obj.position); floatText(c.obj.position, `🎟️ +${pay} ₺`, 'pos'); sfx('cash', { at: c.obj.position });
        c.clearBubble(); c.state = 'seat'; c.path = [V(spot.x, 0, spot.z)];
      } else if (c.wait > 12) gone(); // bileti satan yok: bekleyip gider
    } else if (c.state === 'seat') { if (c.walk(dt)) c.state = 'watch'; }
    else if (c.state === 'watch') {
      const on = show.on > 0, k = on ? 1 : 0.15;
      if (show.kind === 'tiyatro') { c.d.style = 'alkis'; danceStep(c.d, G.time, dt, on ? 0.5 : 0.1); } else danceStep(c.d, G.time, dt, k);
    } else if (c.state === 'leave' && c.walk(dt)) { show.aud = show.aud.filter((x) => x !== c); c.destroy(); }
  };
}
// prova izleyicisi: arka sırada (gişeden uzakta) durup hafifçe sallanır, 25-45 sn izleyip gider; gösteri sürerken ayrılmaz
function idleOne() {
  const x = -40.0 + rand(0, 5.2), z = -51.7 + rand(-0.3, 0.3);
  const c = new Customer(V(SHOW_FROM.x + rand(-2, 2), 0, SHOW_FROM.z), 'kasaba', Math.random() < 0.55 ? M.townLook() : M.villagerLook());
  c.state = 'seat'; c.path = [V(x, 0, z)]; c.stay = rand(25, 45);
  c.d = { o: c.obj, style: DANCES[Math.floor(rand(0, DANCES.length))], f: rand(4.2, 6.8), ph: rand(0, PI * 2), ry: Math.atan2(-38.25 - x, -58.4 - z) + rand(-0.2, 0.2) };
  c.think = (dt) => {
    if (c.state === 'seat') { if (c.walk(dt)) c.state = 'watch'; }
    else if (c.state === 'watch') {
      c.stay -= dt; danceStep(c.d, G.time, dt, show.on > 0 ? 0.7 : 0.25);
      if (c.stay <= 0 && !(show.on > 0)) { c.obj.position.y = 0; c.obj.rotation.x = c.obj.rotation.z = 0; c.state = 'leave'; c.leaving = true; c.path = [V(SHOW_FROM.x + rand(-2, 2), 0, SHOW_FROM.z)]; }
    } else if (c.state === 'leave' && c.walk(dt)) { show.idle = show.idle.filter((q) => q !== c); c.destroy(); }
  };
  show.idle.push(c);
}
function updateShow(dt, t) {
  const L = stage.userData.lights, n = artistsN();
  if (n && onStage() && (show.idleT -= dt) <= 0) { show.idleT = rand(2.5, 4.5); if (show.idle.length < Math.min(4, 1 + n)) idleOne(); }
  if (show.on > 0) {
    show.on -= dt;
    L.forEach((l, i) => l.material.emissiveIntensity = 0.6 + Math.abs(Math.sin(t * 6 + i)) * 1.4);
    if (show.on <= 0) { for (const c of show.aud) if (c.state !== 'leave') c.goHome(); L.forEach((l) => l.material.emissiveIntensity = 0.6); }
    return;
  }
  if (show.gather > 0) { // seyirci toplanıyor
    show.gather -= dt;
    if ((show.spawnT -= dt) <= 0 && show.aud.length < show.want) { show.spawnT = rand(0.6, 1.4); audienceOne(); }
    if (show.gather <= 0) {
      show.on = 35;
      const seated = show.aud.filter((c) => c.state === 'watch' || c.state === 'seat').length;
      G.stats.rep = Math.min(100, (G.stats.rep ?? 50) + (seated >= 6 ? 3 : 1));
      const at = V(-38.25, 1.5, -58.4), title = show.kind === 'konser' ? 'KASABA KONSERİ' : 'KASABA TİYATROSU';
      confetti(at, 50); sfx('region', { at });
      if (Math.hypot(G.player.position.x - at.x, G.player.position.z - at.z) < 40) banner(title, `${show.kind === 'konser' ? '🎵' : '🎭'} ${seated} seyirci · mahalle puanı yükseldi`);
      for (const c of show.aud) if (c.state === 'gise') c.goHome(); // bileti satılmayanlar döner
    }
    return;
  }
  if (!n) { show.t = Math.max(show.t, 10); return; } // sanatçı yok: sahne boş
  if ((show.t -= dt * repMul()) <= 0) {
    show.t = 55; show.gather = 12; show.kind = show.next; show.next = show.kind === 'konser' ? 'tiyatro' : 'konser'; // arada sanatçılar kasabada gezer
    show.want = Math.min(12, 4 + 3 * n);
    for (const k in stage.userData.signs) stage.userData.signs[k].visible = k === show.kind;
    floatText(V(GISE.x, 2.6, GISE.z), `${show.kind === 'konser' ? '🎵 Konser' : '🎭 Tiyatro'} 12 sn sonra: gişe açıldı`, 'pos');
  }
}
