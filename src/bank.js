// Kasaba bankası: meydanın batı kenarında, kapısı fıskiyeye bakan taş bina. Muhasebeci (upgrades.js) kasalardan
// topladığı parayı kapının önündeki yatırma yerine bırakır; yatırılan para oyuncunun hesabına geçer (G.money).
import * as THREE from 'three';
import * as M from './models.js';
import { textTex } from './tex.js';
import { G, floatText, sfx, bounce, popIn, toast } from './game.js';
import { esya } from './esya.js';

const PI = Math.PI;
export const BANK = { x: -54.6, z: -30.6, door: { x: -52.2, z: -30.6 } };
// 2026-11-06 kullanıcı: "acenta da ilerleyen levellerde açılmalı. Banka'da aynı şekilde": kasaba kahvesiyle (xkasaba1) aynı seviyede gelir.
// Eski kayıtta muhasebeci tutulmuşsa banka yerinde kalır
export const BANK_LV = 8;
export const bankUp = () => (G.level || 1) >= BANK_LV || (G.upg && G.upg.accountant > 0);
let parts = null, cols = null, bankOn = false, first = true;
function showBank(instant) {
  bankOn = true; parts.visible = true;
  G.colliders.push(...cols);
  if (instant) return;
  let d = 0;
  for (const ch of parts.children) { popIn(ch, d); d += 0.05; }
  toast('🏦 Banka açıldı: muhasebeci tutarsan kasalardaki parayı toplayıp hesabına yatırır');
}

// Poly Pizza bankası (esya.js), ön yüzü +x: üstüne eski bankanın iki tabelası ve dönen altını
function glbBank(g) {
  const b = new THREE.Box3().setFromObject(g), gold = M.mat('#e0b04a', { rough: 0.35 }), k = (b.max.z - b.min.z) / 4.6; // tabelalar binayla büyür
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9 * k, 0.5 * k), new THREE.MeshStandardMaterial({ map: textTex('BANKA', { bg: '#2f6db5', border: '#ffffff', w: 640, h: 176 }), roughness: 0.6 }));
  sign.rotation.y = PI / 2; sign.position.set(b.max.x + 0.05, b.max.y * 0.62, 0); g.add(sign);
  const roofSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * k, 0.72 * k), new THREE.MeshStandardMaterial({ map: textTex('🏦 BANKA', { bg: '#2f6db5', border: '#ffd23f', w: 640, h: 178 }), roughness: 0.6, side: THREE.DoubleSide }));
  roofSign.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.45 * k, 0.25); roofSign.rotation.x = -0.3; g.add(roofSign);
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * k, 0.34 * k, 0.08 * k, 24), gold); coin.rotation.z = PI / 2; coin.position.set(b.max.x - 0.1, b.max.y * 0.82, 0); g.add(coin);
  g.userData.coin = coin; g.userData.box = b;
  return g;
}
function makeBank() {
  const v = esya('banka');
  if (v) return glbBank(v);
  const g = new THREE.Group();
  const stone = M.mat('#efe6d4', { rough: 0.85 }), trim = M.mat('#c9b48e', { rough: 0.7 }), roof = M.mat('#8c4a3a', { rough: 0.8 });
  const glass = M.mat('#9fd3e8', { rough: 0.2 }), gold = M.mat('#e0b04a', { rough: 0.35 }), dark = M.mat('#4a3426', { rough: 0.6 });
  // gövde: x derinlik 3,2, z genişlik 4,4; ön yüz +x
  M.rbox(3.2, 2.6, 4.4, 0.08, stone, 0, 1.3, 0, g);
  M.rbox(3.4, 0.24, 4.6, 0.05, trim, 0, 2.7, 0, g); // korniş
  // üçgen alınlık
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 4.6, 3, 1), roof);
  ped.rotation.x = PI / 2; ped.rotation.z = PI / 2; ped.scale.set(1, 1, 0.55); ped.position.set(0, 3.15, 0); ped.castShadow = true; g.add(ped);
  // sütunlar, basamaklar, kapı ve pencereler
  for (const z of [-1.7, -0.6, 0.6, 1.7]) { M.cyl(0.15, 0.17, 2.3, 10, stone, 1.85, 1.35, z, g); M.rbox(0.42, 0.14, 0.42, 0.03, trim, 1.85, 2.55, z, g); }
  M.rbox(1.1, 0.12, 4.6, 0.03, trim, 1.95, 0.06, 0, g);
  M.rbox(0.7, 0.12, 4.2, 0.03, trim, 2.25, 0.18, 0, g);
  M.rbox(0.06, 1.6, 1.0, 0.02, dark, 1.62, 0.95, 0, g);
  M.sph(0.05, gold, 1.66, 0.95, 0.3, g, 8, 6);
  for (const z of [-1.3, 1.3]) M.rbox(0.05, 0.8, 0.7, 0.02, glass, 1.62, 1.55, z, g);
  // tabela: cepheye asılı levha, meydandan okunur (+x yönüne bakar)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.5), new THREE.MeshStandardMaterial({ map: textTex('BANKA', { bg: '#2f6db5', border: '#ffffff', w: 640, h: 176 }), roughness: 0.6 }));
  sign.rotation.y = PI / 2; sign.position.set(2.07, 2.27, 0); g.add(sign); // sütunların önünde
  // çatıda güneye (kameraya) bakan büyük tabela ve yan duvarda pencereler: yukarıdan bakınca da banka olduğu belli
  const roofSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.72), new THREE.MeshStandardMaterial({ map: textTex('🏦 BANKA', { bg: '#2f6db5', border: '#ffd23f', w: 640, h: 178 }), roughness: 0.6, side: THREE.DoubleSide }));
  roofSign.position.set(0, 3.95, 0.25); roofSign.rotation.x = -0.3; g.add(roofSign);
  for (const x of [-0.75, 0.55]) { M.rbox(0.7, 0.8, 0.05, 0.02, glass, x, 1.55, 2.21, g); M.rbox(0.8, 0.08, 0.08, 0.02, trim, x, 1.12, 2.23, g); }
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24), gold); coin.rotation.z = PI / 2; coin.position.set(1.62, 3.1, 0); g.add(coin);
  g.userData.coin = coin;
  return g;
}

export function addBank(R, T) {
  const { put } = T;
  parts = new THREE.Group(); parts.visible = false; R.content.add(parts); // seviyesi gelene kadar gizli (updateBank)
  const b = put(parts, makeBank(), BANK.x, 0, BANK.z), bb = b.userData.box; // 3B banka kendi ölçüsünde engel olur (eski çizim 3,4 × 4,6)
  cols = bb ? [[BANK.x + bb.min.x + 0.1, BANK.x + bb.max.x - 0.1, BANK.z + bb.min.z + 0.1, BANK.z + bb.max.z - 0.1]] : [[BANK.x - 1.7, BANK.x + 1.7, BANK.z - 2.3, BANK.z + 2.3]];
  for (const dz of [-1.4, 1.4]) put(parts, M.makeLamp(), BANK.door.x + 0.3, 0, BANK.door.z + dz * 2.1);
  G.bank = {
    door: BANK.door,
    // muhasebeci çantasındaki parayı yatırır: hesabına geçer, kapıda yazı çıkar
    deposit(amount, who) {
      if (amount <= 0) return;
      G.money += amount; G.stats.earned = (G.stats.earned || 0) + amount;
      const at = new THREE.Vector3(BANK.door.x, 0, BANK.door.z);
      floatText(at, `🏦 +${Math.round(amount)} ₺ hesaba geçti`, 'pos');
      sfx('coin', { at });
      if (who) bounce(who, 0.12);
      b.userData.coin.rotation.x = 0; b.userData.spin = 1.2;
    },
  };
  R.bankObj = b;
  return b;
}
// altın lira yatırma sonrası birkaç tur döner
export function updateBank(dt) {
  const R = G.regions.kasaba, b = R && R.bankObj;
  if (!b) return;
  if (!bankOn && bankUp()) showBank(first);
  first = false;
  if (!b.userData.spin) return;
  b.userData.spin = Math.max(0, b.userData.spin - dt);
  b.userData.coin.rotation.x += dt * 9 * b.userData.spin;
}
