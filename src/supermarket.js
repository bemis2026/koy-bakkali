// Şehir Marketi'nin süpermarkete dönüşmesi (2026-11-04 kullanıcı: "şehir marketine gelen ürünler yetersiz oluyor. Oraya gelen
// ürünleri arttırma seçeneği oluştur ve şehir marketinde de geliştirilebilir seçenekler oluştur. Orayı da yavaş yavaş süper markete
// dönüştürelim"). Kademeler expand-east.js'te: xsehir3 Büyük Market (1), xsehir4 Süpermarket (2), xsehir5 Hipermarket (3); kademeyi
// bölgeye city.js setStage kurar. Bu dosya: toptancı ürünleri, yeni reyon grupları, kademe tabelaları, alışveriş arabası durağı,
// hipermarket tabela direği ve toptancı kamyonunun panosu. Kamyon kapasitesi menüde (upgrades.js ctCap, city.js truckBonus)
import * as THREE from 'three';
import * as M from './models.js';
import { ITEMS } from './game.js';
import { textTex } from './tex.js';

const PI = Math.PI;

// ---------- toptancı ürünleri (kodla çizilir): toptancı kamyonu toptan paletine getirir, paletten toptan fiyatına (cost) alınır ----------
function makeMakarna() { // makarna paketi: mavi paket, penceresinden sarı makarna
  const g = new THREE.Group();
  M.rbox(0.32, 0.1, 0.2, 0.03, M.mat('#2a5cb8'), 0, 0.05, 0, g);
  M.rbox(0.2, 0.02, 0.12, 0.008, M.mat('#f2cf63'), 0, 0.1, 0, g);
  g.userData.h = 0.12;
  return g;
}
function makePirinc() { // pirinç: beyaz torba, yeşil bant
  const g = new THREE.Group();
  M.rbox(0.24, 0.22, 0.16, 0.05, M.mat('#f3efe2'), 0, 0.11, 0, g);
  M.rbox(0.25, 0.07, 0.17, 0.02, M.mat('#3f9a4f'), 0, 0.12, 0, g);
  g.userData.h = 0.23;
  return g;
}
function makeSu() { // pet şişe su: açık mavi gövde, mavi etiket ve kapak
  const g = new THREE.Group(), body = M.mat('#a9def5', { rough: 0.2 }), blue = M.mat('#2a7fd4');
  M.cyl(0.07, 0.07, 0.26, 10, body, 0, 0.13, 0, g);
  M.cyl(0.073, 0.073, 0.08, 10, blue, 0, 0.14, 0, g);
  M.cyl(0.032, 0.065, 0.05, 8, body, 0, 0.285, 0, g);
  M.cyl(0.03, 0.03, 0.03, 8, blue, 0, 0.325, 0, g);
  g.userData.h = 0.34;
  return g;
}
function makeGazoz() { // gazoz kutusu: kırmızı teneke, beyaz şerit, gümüş kapak
  const g = new THREE.Group();
  M.cyl(0.065, 0.065, 0.2, 12, M.mat('#d8342c', { rough: 0.35 }), 0, 0.1, 0, g);
  M.cyl(0.067, 0.067, 0.04, 12, M.mat('#ffffff'), 0, 0.11, 0, g);
  M.cyl(0.055, 0.065, 0.02, 12, M.mat('#d9dde2', { rough: 0.3 }), 0, 0.21, 0, g);
  g.userData.h = 0.22;
  return g;
}
function makeDeterjan() { // deterjan bidonu: turuncu gövde, beyaz etiket, mavi kapak, sap
  const g = new THREE.Group(), body = M.mat('#f08a24');
  M.rbox(0.22, 0.3, 0.14, 0.05, body, 0, 0.15, 0, g);
  M.rbox(0.16, 0.1, 0.02, 0.01, M.mat('#ffffff'), 0, 0.15, 0.072, g);
  M.cyl(0.035, 0.035, 0.05, 8, M.mat('#2a5cb8'), -0.05, 0.325, 0, g);
  M.rbox(0.03, 0.08, 0.1, 0.01, body, 0.07, 0.32, 0, g);
  g.userData.h = 0.35;
  return g;
}
function makeSabun() { // sabun paketi: su yeşili kutu, beyaz etiket
  const g = new THREE.Group();
  M.rbox(0.24, 0.09, 0.15, 0.03, M.mat('#8fd0c8'), 0, 0.045, 0, g);
  M.rbox(0.14, 0.02, 0.09, 0.01, M.mat('#ffffff'), 0, 0.095, 0, g);
  g.userData.h = 0.1;
  return g;
}
function makeKagit() { // kağıt havlu: iki rulo, pembe ambalaj bandı
  const g = new THREE.Group();
  for (const x of [-0.08, 0.08]) M.cyl(0.075, 0.075, 0.24, 12, M.mat('#fbfbf7'), x, 0.12, 0, g);
  M.rbox(0.33, 0.08, 0.16, 0.02, M.mat('#e86a9a'), 0, 0.12, 0, g);
  g.userData.h = 0.25;
  return g;
}
function makeCips() { // cips paketi: sarı şişkin paket, kırmızı bant
  const g = new THREE.Group();
  M.rbox(0.24, 0.3, 0.09, 0.06, M.mat('#f2c230'), 0, 0.15, 0, g);
  M.rbox(0.25, 0.07, 0.095, 0.02, M.mat('#d8342c'), 0, 0.2, 0, g);
  g.userData.h = 0.31;
  return g;
}
function makeCikolata() { // iki tablet çikolata, mor ambalaj
  const g = new THREE.Group();
  for (const y of [0.025, 0.07]) {
    M.rbox(0.28, 0.04, 0.14, 0.01, M.mat('#6b3a1f'), 0, y, 0, g);
    M.rbox(0.13, 0.044, 0.144, 0.005, M.mat('#6a3fb5'), 0.06, y, 0, g);
  }
  g.userData.h = 0.1;
  return g;
}
function makeBiskuvi() { // bisküvi: yatık rulo paket, mavi uçlar
  const g = new THREE.Group();
  M.cyl(0.07, 0.07, 0.28, 12, M.mat('#e8b04a'), 0, 0.07, 0, g).rotation.z = PI / 2;
  for (const x of [-0.13, 0.13]) M.cyl(0.072, 0.072, 0.03, 12, M.mat('#2a5cb8'), x, 0.07, 0, g).rotation.z = PI / 2;
  g.userData.h = 0.14;
  return g;
}
ITEMS.makarna = { name: 'Makarna', price: 10, cost: 4, fn: makeMakarna };
ITEMS.pirinc = { name: 'Pirinç', price: 14, cost: 6, fn: makePirinc };
ITEMS.su = { name: 'Su', price: 4, cost: 1, fn: makeSu };
ITEMS.gazoz = { name: 'Gazoz', price: 8, cost: 3, fn: makeGazoz };
ITEMS.deterjan = { name: 'Deterjan', price: 30, cost: 13, fn: makeDeterjan };
ITEMS.sabun = { name: 'Sabun', price: 9, cost: 4, fn: makeSabun };
ITEMS.kagit = { name: 'Kağıt havlu', price: 16, cost: 7, fn: makeKagit };
ITEMS.cips = { name: 'Cips', price: 9, cost: 4, fn: makeCips };
ITEMS.cikolata = { name: 'Çikolata', price: 12, cost: 5, fn: makeCikolata };
ITEMS.biskuvi = { name: 'Bisküvi', price: 8, cost: 3, fn: makeBiskuvi };

// yeni reyon grupları (city.js GROUPS'a katılır): stage, açıldığı kademe. Süpermarketinkiler ortadaki reyonun güney yüzünün boş
// dört yerinde, hipermarketinkiler arka salonun duvarında
export const SUPER_GROUPS = {
  paket: { color: '#c9962b', types: ['makarna', 'pirinc'], stage: 2 },
  icecek: { color: '#2a8fd4', types: ['su', 'gazoz'], stage: 2 },
  temizlik: { color: '#7a5cc9', types: ['deterjan', 'sabun', 'kagit'], stage: 3 },
  atistirma: { color: '#e0702a', types: ['cips', 'cikolata', 'biskuvi'], stage: 3 },
};
export const TOPTAN = Object.values(SUPER_GROUPS).flatMap((g) => g.types);

// kademe tabelaları: 0 açılış, 1 Büyük Market, 2 Süpermarket, 3 Hipermarket
export const STAGES = [
  { sign: 'MAHALLE MARKETİ', bg: '#2f6db5', w: 6.4 },
  { sign: 'BÜYÜK MARKET', bg: '#2f6db5', w: 6.4 },
  { sign: 'SÜPERMARKET', bg: '#d8342c', w: 7.0 },
  { sign: 'HİPERMARKET', bg: '#1f8a5b', w: 7.6 },
];
// kapının önündeki modernist giriş (2026-11-08 Barselona): yeşil dökme demir direkler (hep ±3,05'te, engel kutuları aynı), altın
// başlıklar, seramik tabela (kademe adı kademenin renginde), üstte basık kemer ve vitray yelpaze. 3,5 m'yi geçmez: kapıdan giren
// oyuncuyu örtmesin (kamera güneyden bakar)
let fanT = null;
function fanTex() {
  if (fanT) return fanT;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d'), cols = ['#2f6fb5', '#e2b04a', '#3f9a5a', '#c0392b', '#7fb7d9', '#e2b04a', '#3f9a5a', '#2f6fb5'];
  g.fillStyle = '#f3ead6'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 8; i++) { g.fillStyle = cols[i]; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 124, PI + (i * PI) / 8, PI + ((i + 1) * PI) / 8); g.closePath(); g.fill(); }
  g.strokeStyle = '#1f3a2b'; g.lineWidth = 4;
  for (let i = 0; i <= 8; i++) { const a = PI + (i * PI) / 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124); g.stroke(); }
  g.beginPath(); g.arc(128, 128, 40, PI, 2 * PI); g.fillStyle = '#f3ead6'; g.fill(); g.stroke();
  fanT = new THREE.CanvasTexture(c); fanT.colorSpace = THREE.SRGBColorSpace;
  return fanT;
}
export function storeSign(stage) {
  const s = STAGES[stage] || STAGES[0];
  const g = new THREE.Group(), iron = M.mat('#2f5b3a', { rough: 0.5 }), gold = M.mat('#c8a24a', { rough: 0.35 }), stone = M.mat('#e6dccb');
  for (const x of [-3.05, 3.05]) {
    M.rbox(0.32, 0.3, 0.32, 0.04, stone, x, 0.15, 0, g); // taş kaide
    M.cyl(0.07, 0.1, 2.46, 10, iron, x, 1.53, 0, g);
    M.cyl(0.16, 0.08, 0.18, 10, gold, x, 2.85, 0, g); // altın başlık
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.07, 6, 28, PI), iron); // basık kemer
  arch.scale.y = 0.19; arch.position.set(0, 2.9, 0); g.add(arch);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(3.0, 28, 0, PI), new THREE.MeshStandardMaterial({ map: fanTex(), roughness: 0.4, side: THREE.DoubleSide }));
  fan.scale.y = 0.19; fan.position.set(0, 2.9, -0.02); g.add(fan); // vitray yelpaze
  M.rbox(5.7, 0.9, 0.1, 0.04, M.mat('#1f3a2b'), 0, 2.45, -0.04, g); // seramik tabela: koyu yeşil çerçeve, krem zemin
  M.rbox(5.5, 0.76, 0.12, 0.03, M.mat('#ffffff', { map: textTex(s.sign, { bg: '#f7f1e3', fg: s.bg, border: s.bg, w: 768, h: 106 }) }), 0, 2.45, 0, g);
  return g;
}

// alışveriş arabası durağı (süpermarket): cephenin önünde iç içe beş araba, çelik korkuluk
export function cartCorral() {
  const g = new THREE.Group(), steel = M.mat('#cfd6de', { rough: 0.35 });
  for (let i = 0; i < 5; i++) { const t = M.makeTrolley(); t.position.set(-0.7 + i * 0.32, 0, 0); t.rotation.y = PI / 2; g.add(t); }
  M.rbox(2.3, 0.05, 0.05, 0.02, steel, 0.08, 0.9, -0.42, g);
  for (const x of [-1.05, 1.2]) M.cyl(0.03, 0.03, 0.9, 8, steel, x, 0.45, -0.42, g);
  return g;
}

// hipermarket tabela direği: caddeden görünen yüksek pano
export function pylon() {
  const g = new THREE.Group(), steel = M.mat('#9aa3ad', { rough: 0.4 });
  for (const x of [-1.2, 1.2]) M.cyl(0.1, 0.1, 5.2, 10, steel, x, 2.6, 0, g);
  M.rbox(3.4, 1.0, 0.18, 0.06, M.mat('#ffffff', { map: textTex('HİPERMARKET', { bg: '#1f8a5b', border: '#ffffff', w: 768, h: 226 }) }), 0, 4.7, 0, g);
  M.rbox(3.4, 0.7, 0.18, 0.06, M.mat('#ffffff', { map: textTex('AÇIK 7/24', { bg: '#f2c230', fg: '#1f3a2b', w: 768, h: 158 }) }), 0, 3.85, 0, g);
  return g;
}

// toptancı kamyonunun üstündeki pano (kargo aracının KARGO panosu gibi)
let TB = null; // pano geometrisi ve yazı dokusu bir kez kurulur: her kamyon seferinde yenisi kurulup silinmiyordu (2026-11-10 denetimi)
export function toptanBoard() {
  const g = new THREE.Group();
  if (!TB) TB = { geo: new THREE.PlaneGeometry(2.2, 0.58), mat: new THREE.MeshStandardMaterial({ map: textTex('TOPTAN', { bg: '#c9962b', border: '#ffffff', w: 512, h: 134 }), side: THREE.DoubleSide, roughness: 0.6 }) };
  const m = new THREE.Mesh(TB.geo, TB.mat);
  g.add(m);
  return g;
}
