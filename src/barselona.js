// Barselona: şehir marketinin çevresi (2026-11-08 kullanıcı: "market çevresinin şehir tasarımını geliştir ... Şehrimiz ve marketimiz
// barcelona mimarisinde olabilir. Binalar yollar botanik vs."). Eixample blokları: köşesi pahlı (xamfrà), krem, okr, pembe sıva, boy
// boy pencereler, yeşil panjurlar, dökme demir balkonlar, zemin katta tenteli dükkânlar, düz çatı terası (terrat). Marketin arkasında
// botanik bahçe (palmiye, servi, portakal saksıları, lavanta, begonvil, cam sera, pergola), iki yanında küçük meydanlar (çeşme,
// trencadís bank, kafe masaları, çiçekçi), arkada Casa Batlló'yu andıran mozaik cepheli ev. Caddenin güneyi Rambla gezisi: panot
// döşeme, çimenlik havuzlarda çınar ve palmiye sırası (kaldırımlar açık), banklar, büfeler, Canaletes çeşmesi, Gaudí fenerleri.
// Caddede yaya geçidi ve yeşil bisiklet yolu. Modernist market: tuğla cephe ve pilastrlar, trencadís mozaik korniş, seramik
// tepelikler, köşe kuleleri, hidrolik karo zemin (marketDecor; giriş kemeri supermarket.js storeSign).
// Kamera güneyden bakar: caddenin güneyindeki her şey alçak ve geride (oyuncuyu örtmesin), kuzey taraf yüksek olabilir. Yürüme alanı
// yalnız cadde ve iki kaldırım (city.js walkway) ve market: dışarıdaki süsler engel istemez. Hepsi duran parça: perf.js birleştirir.
import * as THREE from 'three';
import * as M from './models.js';
import { G } from './game.js';
import { texRep, textTex } from './tex.js';

const PI = Math.PI;
const CX = 430;
export const ZEBRA = [426.8, 433.2]; // ana caddedeki yaya geçidi (sehirhayat.js taşıtları burada durdurur)
export const BIKE_Z = 17.85; // doğuya giden bisiklet yolunun ortası (asfaltın güney kenarı 18,2)

// ---------- dokular ----------
const TEX = new Map();
function canvasTex(key, w, h, draw, rx = 1, ry = 1, oy = 0) {
  let t = TEX.get(key);
  if (!t) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    TEX.set(key, t);
  }
  const k = t.clone(); k.repeat.set(rx, ry); k.offset.y = oy; k.needsUpdate = true; k.userData.rep = `${key}|${rx}|${ry}|${oy}`;
  return k;
}
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return `#${c.getHexString()}`; };
const rnd = (a, b) => a + Math.random() * (b - a);
// sabit tohumlu rastgele: dokular her açılışta aynı çıksın
let seed = 7;
const srnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// cephe: bir bölme (3 m) × bir kat (3,2 m). A: balkonlu, panjurlu; B: modernist kemerli pencere, kıvrık demir, seramik şerit;
// C: ahşap stor perdeli ikiz pencere
function facadeTex(style, col) {
  return canvasTex(`fa${style}${col}`, 128, 136, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = shade(col, 0.93); for (let y = 16; y < h; y += 17) g.fillRect(0, y, w, 1); // kesme taş derzi
    g.fillStyle = shade(col, 1.08); g.fillRect(0, h - 8, w, 8); g.fillStyle = shade(col, 0.8); g.fillRect(0, h - 9, w, 1); // kat silmesi
    const glass = (x, y, ww, hh) => { g.fillStyle = '#f4efe4'; g.fillRect(x - 3, y - 3, ww + 6, hh + 6); g.fillStyle = '#2e3b48'; g.fillRect(x, y, ww, hh); g.fillStyle = '#4d6478'; g.fillRect(x + 2, y + 2, ww * 0.35, hh - 4); g.fillStyle = '#f4efe4'; g.fillRect(x + ww / 2 - 1, y, 2, hh); };
    if (style === 0) {
      g.fillStyle = '#4f7a5a'; for (const x of [24, 90]) { g.fillRect(x, 24, 14, 82); g.fillStyle = '#3d6148'; for (let y = 28; y < 104; y += 5) g.fillRect(x + 1, y, 12, 2); g.fillStyle = '#4f7a5a'; }
      glass(42, 24, 44, 82);
      g.fillStyle = '#d9d0c0'; g.fillRect(18, 106, 92, 7); // balkon tablası
      g.fillStyle = '#26262b'; g.fillRect(20, 84, 88, 3); for (let x = 22; x < 108; x += 5) g.fillRect(x, 86, 2, 20); // demir korkuluk
      g.strokeStyle = '#26262b'; g.lineWidth = 2; for (let x = 32; x < 104; x += 24) { g.beginPath(); g.arc(x, 96, 6, 0, PI * 2); g.stroke(); }
    } else if (style === 1) {
      g.fillStyle = shade(col, 1.12); g.beginPath(); g.ellipse(64, 20, 36, 12, 0, PI, 0); g.fill(); // çiçekli kabartma
      g.strokeStyle = shade(col, 0.78); g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64, 16); g.bezierCurveTo(64 + s * 18, 4, 64 + s * 34, 22, 64 + s * 44, 14); g.stroke(); }
      g.fillStyle = '#f4efe4'; g.beginPath(); g.moveTo(37, 108); g.lineTo(37, 50); g.ellipse(64, 50, 27, 22, 0, PI, 0); g.lineTo(91, 108); g.fill();
      g.fillStyle = '#2e3b48'; g.beginPath(); g.moveTo(41, 106); g.lineTo(41, 50); g.ellipse(64, 50, 23, 18, 0, PI, 0); g.lineTo(87, 106); g.fill();
      g.fillStyle = '#4d6478'; g.fillRect(45, 48, 8, 56);
      const tiles = ['#3a7bbf', '#3f9a7a', '#e2b04a', '#f4efe4'];
      for (let x = 30; x < 98; x += 6) { g.fillStyle = tiles[(x / 6) % 4 | 0]; g.fillRect(x, 112, 5, 5); } // seramik şerit
      g.strokeStyle = '#26262b'; g.lineWidth = 3; g.beginPath(); for (let x = 30; x <= 98; x += 2) g.lineTo(x, 92 + Math.sin(x * 0.2) * 5); g.stroke();
      for (let x = 32; x < 98; x += 8) { g.beginPath(); g.moveTo(x, 94); g.lineTo(x, 108); g.stroke(); }
    } else {
      for (const x of [22, 72]) {
        glass(x, 26, 34, 80);
        g.fillStyle = '#b5835a'; g.fillRect(x - 1, 24, 36, 40); g.fillStyle = '#8f6440'; for (let y = 26; y < 64; y += 4) g.fillRect(x - 1, y, 36, 1); // stor
        g.fillStyle = '#d9d0c0'; g.fillRect(x - 5, 106, 44, 5); // denizlik
      }
    }
  }, 1 / 3, -1 / 3.2, 1 / 3.2); // ExtrudeGeometry yan yüz v = 1 - yükseklik: ters tekrar ve kayma katları zemin kat silmesine hizalar
}
// trencadís: beyaz derzli renkli seramik kırıkları
function mosaicTex(rx, ry = 1) {
  return canvasTex('mozaik', 128, 64, (g, w, h) => {
    g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h);
    const C = ['#2f6fb5', '#3fa0c8', '#3f9a5a', '#8cc152', '#f2c230', '#e8762e', '#d9473b', '#ffffff', '#1f4f8a'];
    seed = 11;
    for (let i = 0; i < 170; i++) {
      const x = srnd() * w, y = srnd() * h, r = 3 + srnd() * 6;
      g.fillStyle = C[Math.floor(srnd() * C.length)]; g.beginPath();
      for (let k = 0; k < 5; k++) { const a = (k / 5) * PI * 2 + srnd(); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.fill();
    }
  }, rx, ry);
}
// panot: Barselona kaldırım karosu (dört yapraklı çiçek kabartması)
function panotTex(w, d) {
  return canvasTex('panot', 64, 64, (g) => {
    g.fillStyle = '#c9c4ba'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#b3ada2'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64);
    g.fillStyle = '#d6d2c9';
    for (const [x, y] of [[32, 18], [32, 46], [18, 32], [46, 32]]) { g.beginPath(); g.ellipse(x, y, x === 32 ? 6 : 10, x === 32 ? 10 : 6, 0, 0, PI * 2); g.fill(); }
    g.fillStyle = '#b8b2a7'; g.beginPath(); g.arc(32, 32, 4, 0, PI * 2); g.fill();
    for (const [x, y] of [[0, 0], [64, 0], [0, 64], [64, 64]]) { g.beginPath(); g.arc(x, y, 7, 0, PI * 2); g.fill(); }
  }, w / 0.8, d / 0.8);
}
// hidrolik karo (market zemini): 50 cm'lik karolarda köşelerden açan çiçek, krem, kiremit, arduvaz mavisi, okr
export function hydraulicTex(rx, ry) {
  return canvasTex('hidrolik', 128, 128, (g) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * 32, y = j * 32;
      // renkler yumuşak (2026-11-08 önizleme: koyu daireler telefonda benekli halı gibi görünüp ürünleri ve kişileri bastırıyordu)
      g.fillStyle = '#f2ebdc'; g.fillRect(x, y, 32, 32);
      g.fillStyle = '#cfd8d4'; for (const [a, b] of [[0, 0], [32, 0], [0, 32], [32, 32]]) { g.beginPath(); g.arc(x + a, y + b, 9, 0, PI * 2); g.fill(); }
      g.fillStyle = '#e3c3ab'; g.beginPath(); g.moveTo(x + 16, y + 7); g.lineTo(x + 25, y + 16); g.lineTo(x + 16, y + 25); g.lineTo(x + 7, y + 16); g.fill();
      g.fillStyle = '#e2c27e'; g.beginPath(); g.arc(x + 16, y + 16, 3, 0, PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(x, y, 32, 1); g.fillRect(x, y, 1, 32);
    }
  }, rx, ry);
}
function brickTex(rx, ry) {
  return canvasTex('tugla', 64, 64, (g) => {
    g.fillStyle = '#d6c6ad'; g.fillRect(0, 0, 64, 64);
    seed = 5;
    for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) {
      g.fillStyle = shade('#a8483a', 0.88 + srnd() * 0.24);
      g.fillRect(c * 16 + (r % 2) * 8 + 1, r * 8 + 1, 14, 6);
    }
  }, rx, ry);
}
function awningTex(col) {
  return canvasTex(`tente${col}`, 64, 32, (g) => {
    for (let x = 0; x < 64; x += 16) { g.fillStyle = col; g.fillRect(x, 0, 8, 32); g.fillStyle = '#f6f1e6'; g.fillRect(x + 8, 0, 8, 32); }
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 26, 64, 6);
  });
}
function bikeIcon() {
  return canvasTex('bisiklet', 64, 64, (g) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 4;
    for (const x of [16, 48]) { g.beginPath(); g.arc(x, 40, 11, 0, PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(16, 40); g.lineTo(28, 22); g.lineTo(44, 22); g.lineTo(48, 40); g.moveTo(28, 22); g.lineTo(34, 40); g.lineTo(44, 22); g.moveTo(24, 16); g.lineTo(32, 16); g.moveTo(44, 22); g.lineTo(42, 14); g.stroke();
  });
}
function batlloTex() {
  return canvasTex('batllo', 256, 304, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#8fc7c9'); grd.addColorStop(0.5, '#a9cfb7'); grd.addColorStop(1, '#d9c79a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    seed = 23; const C = ['#2f6fb5', '#3fa0c8', '#e2b04a', '#d9473b', '#3f9a5a', '#ffffff', '#7a5cc9'];
    for (let i = 0; i < 900; i++) { g.fillStyle = C[Math.floor(srnd() * C.length)]; g.beginPath(); g.arc(srnd() * w, srnd() * h * 0.82, 1 + srnd() * 2.2, 0, PI * 2); g.fill(); }
    // üst katlar: dalgalı çerçeveli camlı pencereler ve altlarında açık renk maske balkonlar (önizlemede kapkara oyuklar göz çukuru
    // gibi duruyordu: camlar mavi-gri, parlak şeritli, balkonun göz delikleri küçük ve açık)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const x = 26 + c * 51, y = 36 + r * 46;
      g.fillStyle = '#f1ead6'; g.beginPath(); g.ellipse(x, y + 9, 12, 15, 0, 0, PI * 2); g.fill(); // çerçeve
      g.fillStyle = '#5b7f95'; g.beginPath(); g.ellipse(x, y + 9, 9, 12, 0, 0, PI * 2); g.fill(); // cam
      g.fillStyle = '#93b6c8'; g.fillRect(x - 5, y + 1, 3, 14);
      g.fillStyle = '#f6f0de'; g.beginPath(); g.ellipse(x, y + 22, 17, 7, 0, 0, PI); g.fill(); // maske balkon
      g.fillStyle = '#9fb9c2'; for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * 6, y + 25, 1.6, 0, PI * 2); g.fill(); }
    }
    // alt katlar: kemik sütunlu geniş pencereler
    g.fillStyle = '#ece3cc'; g.fillRect(0, 222, w, 82);
    g.fillStyle = '#4f6f84'; g.beginPath(); g.moveTo(10, 300); for (let x = 10; x <= 246; x += 4) g.lineTo(x, 236 + Math.sin(x * 0.05) * 8); g.lineTo(246, 300); g.fill();
    g.fillStyle = '#f4ecd8'; for (let x = 22; x < 246; x += 37) { g.beginPath(); g.ellipse(x, 268, 5, 34, 0, 0, PI * 2); g.fill(); g.beginPath(); g.arc(x, 236, 7, 0, PI * 2); g.fill(); }
  });
}
function scalesTex() {
  return canvasTex('pul', 64, 64, (g) => {
    const C = ['#d8708a', '#5aa3c8', '#7cbf6a', '#e2b04a'];
    for (let r = 0; r < 6; r++) for (let c = -1; c < 6; c++) { g.fillStyle = C[(r + c + 8) % 4]; g.beginPath(); g.arc(c * 12 + (r % 2) * 6 + 6, r * 11 + 4, 7, 0, PI); g.fill(); }
  }, 3, 1);
}

// ---------- yardımcılar ----------
function plane(g, x, z, w, d, material, y = -0.02) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -PI / 2; m.position.set(x, y, z); m.receiveShadow = true; g.add(m);
  return m;
}
const flat = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } }); return o; };
const box = (g, w, h, d, col, x, y, z) => M.rbox(w, h, d, 0.02, typeof col === 'string' ? M.mat(col) : col, x, y, z, g);
// pahlı köşeli taban (dünya x, z); c: { ne, se, sw, nw } pah boyları
function footprint(x0, x1, z0, z1, c = {}, k = 0) {
  x0 -= k; x1 += k; z0 -= k; z1 += k;
  const p = [];
  const ne = c.ne ? c.ne + k * 0.4 : 0, se = c.se ? c.se + k * 0.4 : 0, sw = c.sw ? c.sw + k * 0.4 : 0, nw = c.nw ? c.nw + k * 0.4 : 0;
  if (nw) p.push([x0, z0 + nw], [x0 + nw, z0]); else p.push([x0, z0]);
  if (ne) p.push([x1 - ne, z0], [x1, z0 + ne]); else p.push([x1, z0]);
  if (se) p.push([x1, z1 - se], [x1 - se, z1]); else p.push([x1, z1]);
  if (sw) p.push([x0 + sw, z1], [x0, z1 - sw]); else p.push([x0, z1]);
  return p;
}
const toShape = (pts, S = new THREE.Shape()) => { pts.forEach(([x, z], i) => (i ? S.lineTo(x, -z) : S.moveTo(x, -z))); S.closePath(); return S; };
function extrude(pts, y0, h, mats, hole) {
  const S = toShape(pts);
  if (hole) S.holes.push(toShape(hole.slice().reverse(), new THREE.Path()));
  const geo = new THREE.ExtrudeGeometry(S, { depth: h, bevelEnabled: false });
  geo.rotateX(-PI / 2); geo.translate(0, y0, 0);
  const m = new THREE.Mesh(geo, mats); m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- Eixample binası ----------
const GF = 3.6; // zemin kat (dükkânlar)
const SIGNS = new Map();
const signMat = (name, sc) => { if (!SIGNS.has(name)) SIGNS.set(name, new THREE.MeshBasicMaterial({ map: textTex(name, { bg: '#f6f1e6', fg: sc, border: sc, w: 384, h: 72, r: 6 }) })); return SIGNS.get(name); };
const SHOPS = [['CAFÈ', '#7a4a2a'], ['FORN', '#c8862e'], ['FARMÀCIA', '#2f9a5a'], ['FLORS', '#c84a7a'], ['TAPES', '#c0392b'], ['GELATS', '#3a8fc8'], ['LLIBRES', '#5a4a8a'], ['FRUITA', '#4f9a3f']];
let shopN = 0;
// face: dükkân sırasının baktığı cephe ('s' güney, 'n' kuzey); shops: o cephede kaç dükkân
function building(g, b) {
  const { x0, x1, z0, z1, h, style, col, c = {}, face = 's', shops = 0 } = b;
  const pts = footprint(x0, x1, z0, z1, c);
  const roof = M.mat('#c9b9a6'), stone = M.mat(shade(col, 0.82));
  g.add(extrude(pts, 0, GF, [roof, stone]));
  g.add(extrude(pts, GF, h - GF, [roof, M.mat('#ffffff', { map: facadeTex(style, col) })]));
  const corn = M.mat(shade(col, 1.1));
  g.add(extrude(footprint(x0, x1, z0, z1, c, 0.3), GF - 0.05, 0.3, [corn, corn], footprint(x0, x1, z0, z1, c, -0.1))); // zemin kat silmesi
  g.add(extrude(footprint(x0, x1, z0, z1, c, 0.32), h - 0.1, 0.32, [corn, corn], footprint(x0, x1, z0, z1, c, -0.25))); // korniş
  g.add(extrude(footprint(x0, x1, z0, z1, c, 0.05), h, 0.75, [corn, M.mat(col)], footprint(x0, x1, z0, z1, c, -0.25))); // korkuluk duvarı
  // çatı terası: merdiven kulübesi, su deposu, bacalar
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  box(g, 2.4, 2.3, 2.2, col, mx + (x1 - x0) * 0.18, h + 1.15, mz - (z1 - z0) * 0.15);
  M.cyl(0.6, 0.6, 1.1, 10, M.mat('#9aa3ad'), mx - (x1 - x0) * 0.2, h + 0.95, mz - (z1 - z0) * 0.2, g);
  for (let i = 0; i < 3; i++) box(g, 0.45, 1.3, 0.45, shade(col, 0.9), x0 + 2 + i * (x1 - x0 - 4) / 2, h + 0.65, mz + (i - 1) * 1.5);
  // dükkânlar: koyu vitrin, çizgili tente, tabela
  if (!shops) return;
  const fz = face === 's' ? z1 : z0, out = face === 's' ? 1 : -1, sx0 = x0 + (c.sw || c.nw || 0) + 0.8, sx1 = x1 - (c.se || c.ne || 0) - 0.8;
  const step = (sx1 - sx0) / shops;
  for (let i = 0; i < shops; i++) {
    const cx = sx0 + step * (i + 0.5), w = Math.min(4.2, step - 0.8), [name, sc] = SHOPS[shopN++ % SHOPS.length];
    box(g, w, 2.5, 0.08, '#2c3a46', cx, 1.3, fz + out * 0.03);
    box(g, 0.12, 2.6, 0.12, '#2f5d4a', cx - w / 2, 1.3, fz + out * 0.08); box(g, 0.12, 2.6, 0.12, '#2f5d4a', cx + w / 2, 1.3, fz + out * 0.08);
    const aw = M.rbox(w + 0.3, 0.06, 1.3, 0.02, M.mat('#ffffff', { map: awningTex(sc) }), cx, 2.75, fz + out * 0.62, g); aw.rotation.x = out * 0.32;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.5), signMat(name, sc));
    s.position.set(cx, 3.2, fz + out * 0.05); if (out < 0) s.rotation.y = PI; g.add(s);
  }
}
// Casa Batlló'yu andıran ev: mozaik cephe, maske balkonlar, kemik sütunlar, ejder sırtı çatı ve dört kollu haçlı kule
function batllo(g, x, z, w, h) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.mat('#ffffff', { map: batlloTex() }));
  f.position.set(x, h / 2, z + 0.06); g.add(f);
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, w * 0.8, 14, 1, false, 0, PI), M.mat('#ffffff', { map: scalesTex() }));
  ridge.rotation.z = PI / 2; ridge.position.set(x + w * 0.05, h + 0.2, z - 1.2); ridge.scale.set(1, 1, 0.7); g.add(ridge);
  const tw = x - w * 0.36;
  M.cyl(0.55, 0.65, 3.2, 12, M.mat('#e9dfc6'), tw, h + 1.6, z - 1.0, g);
  M.sph(0.6, M.mat('#c8a24a'), tw, h + 3.5, z - 1.0, g, 12, 8);
  const arm = M.mat('#f2efe8');
  for (const [a, b] of [[0.9, 0.18], [0.18, 0.9]]) box(g, a, 0.18, b, arm, tw, h + 4.3, z - 1.0);
}

// ---------- bitkiler ve kent eşyası ----------
function platan(g, x, z, s = 1) { // çınar: alacalı açık gövde, geniş tepe
  M.cyl(0.16 * s, 0.22 * s, 2.6 * s, 8, M.mat('#bfb39a'), x, 1.3 * s, z, g);
  const L = M.mat('#6f9a4a', { flat: true }), L2 = M.mat('#86ad5a', { flat: true });
  for (const [dx, dy, dz, r, m] of [[0, 3.6, 0, 1.55, L], [0.9, 3.2, 0.3, 1.05, L2], [-0.8, 3.3, -0.2, 1.1, L2], [0.1, 4.4, -0.3, 0.95, L]]) M.sph(r * s, m, x + dx * s, dy * s, z + dz * s, g, 9, 7);
}
function cypress(g, x, z, s = 1) {
  M.cyl(0.08, 0.1, 0.6, 6, M.mat('#6b4e3d'), x, 0.3, z, g);
  const c = M.cyl(0.02, 0.62 * s, 5.4 * s, 9, M.mat('#3f6b3a', { flat: true }), x, 0.4 + 2.7 * s, z, g); c.scale.z = 0.95;
}
function palm(g, x, z, s = 1, lean = 0.2) { const p = M.makePalm(s, lean); p.position.set(x, 0, z); p.rotation.y = rnd(0, PI * 2); g.add(p); }
function orangePot(g, x, z) { // terrakota saksıda portakal ağacı
  M.cyl(0.42, 0.32, 0.6, 12, M.mat('#c0704a'), x, 0.3, z, g);
  M.cyl(0.05, 0.06, 0.8, 6, M.mat('#6b4e3d'), x, 0.95, z, g);
  M.sph(0.62, M.mat('#4f8a3a', { flat: true }), x, 1.6, z, g, 9, 7);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; M.sph(0.08, M.mat('#f29a2e'), x + Math.cos(a) * 0.5, 1.45 + (i % 3) * 0.18, z + Math.sin(a) * 0.5, g, 6, 5); }
}
function bed(g, x, z, w, d, flower) { // çimenlik havuz: taş bordür, çim, isteğe bağlı çiçek
  box(g, w + 0.3, 0.16, d + 0.3, '#d6cfc2', x, 0.06, z);
  box(g, w, 0.06, d, '#78a650', x, 0.15, z);
  if (flower) for (let i = 0; i < Math.floor(w * d * 1.2); i++) M.sph(0.13, M.mat(flower, { flat: true }), x + rnd(-w / 2 + 0.2, w / 2 - 0.2), 0.24, z + rnd(-d / 2 + 0.2, d / 2 - 0.2), g, 5, 4);
}
function agave(g, x, z) { for (let i = 0; i < 7; i++) { const l = M.cyl(0.02, 0.09, 0.8, 5, M.mat('#7aa58e', { flat: true }), x, 0.35, z, g); l.rotation.set(0.7, i * 0.9, 0); l.position.x += Math.sin(i * 0.9) * 0.2; l.position.z += Math.cos(i * 0.9) * 0.2; } }
function bougainvillea(g, x, y, z, n = 6) { for (let i = 0; i < n; i++) M.sph(rnd(0.25, 0.42), M.mat(i % 3 ? '#d6409b' : '#4f8a3a', { flat: true }), x + rnd(-1.2, 1.2), y + rnd(-0.6, 0.6), z + rnd(-0.15, 0.15), g, 7, 5); }
// Gaudí feneri (Plaça Reial): yeşil kaide, ince direk, üç kollu taç, kırmızı-beyaz kask
export function gaudiLamp() {
  const g = new THREE.Group(), green = M.mat('#2f5d4a', { rough: 0.5 }), gold = M.mat('#c8a24a', { rough: 0.4 });
  M.cyl(0.26, 0.32, 0.7, 10, green, 0, 0.35, 0, g);
  M.cyl(0.07, 0.09, 3.4, 8, green, 0, 2.2, 0, g);
  M.cyl(0.16, 0.12, 0.25, 8, gold, 0, 3.95, 0, g);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2, ax = Math.cos(a) * 0.45, az = Math.sin(a) * 0.45;
    const arm = M.cyl(0.03, 0.03, 0.55, 5, green, ax / 2, 4.05, az / 2, g); arm.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
    M.sph(0.15, M.mat('#fff4d0', { emissive: '#ffe2a0', ei: 0.6 }), ax, 4.05, az, g, 8, 6);
    M.cyl(0.11, 0.05, 0.12, 6, green, ax, 4.25, az, g);
  }
  M.cyl(0.05, 0.2, 0.35, 8, M.mat('#c0392b'), 0, 4.45, 0, g); M.sph(0.08, M.mat('#f2efe8'), 0, 4.68, 0, g, 6, 5);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function kiosk(g, x, z, name, col, ry = 0) { // altıgen büfe: yeşil demir, kubbe çatı, tabela
  const k = new THREE.Group(); k.position.set(x, 0, z); k.rotation.y = ry; g.add(k);
  const iron = M.mat('#2f5d4a', { rough: 0.5 });
  M.cyl(1.25, 1.25, 2.3, 6, M.mat('#e9e2d2'), 0, 1.15, 0, k).rotation.y = PI / 6; // düz yüzü öne (vitrin)
  M.cyl(1.32, 1.32, 0.16, 6, iron, 0, 2.38, 0, k).rotation.y = PI / 6;
  const d = M.sph(1.25, iron, 0, 2.4, 0, k, 6, 5); d.scale.y = 0.55; d.rotation.y = PI / 6;
  M.sph(0.14, M.mat('#c8a24a'), 0, 3.2, 0, k, 6, 5);
  box(k, 1.7, 0.9, 0.06, '#2c3a46', 0, 1.35, 1.12);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.42), new THREE.MeshBasicMaterial({ map: textTex(name, { bg: col, fg: '#ffffff', w: 384, h: 84, r: 8 }) }));
  s.position.set(0, 2.05, 1.16); k.add(s);
  if (name === 'FLORS') for (let i = 0; i < 8; i++) M.sph(0.16, M.mat(['#e8473c', '#f6c343', '#d6409b', '#ffffff'][i % 4]), -0.9 + i * 0.26, 0.55, 1.45, k, 6, 5);
}
function canaletes(g, x, z) { // Rambla'nın dökme demir çeşmesi: dört musluk, fener tacı
  const iron = M.mat('#1f2a26', { rough: 0.45 }), gold = M.mat('#c8a24a', { rough: 0.4 });
  M.cyl(0.55, 0.6, 0.35, 12, iron, x, 0.17, z, g);
  M.cyl(0.18, 0.24, 2.2, 10, iron, x, 1.3, z, g);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2; M.cyl(0.03, 0.03, 0.3, 5, gold, x + Math.cos(a) * 0.3, 0.9, z + Math.sin(a) * 0.3, g).rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4); }
  M.cyl(0.32, 0.12, 0.3, 10, gold, x, 2.5, z, g);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; M.sph(0.14, M.mat('#fff4d0', { emissive: '#ffe2a0', ei: 0.5 }), x + Math.cos(a) * 0.38, 2.75, z + Math.sin(a) * 0.38, g, 7, 5); }
}
function fountain(g, x, z) {
  M.cyl(2.3, 2.4, 0.55, 20, M.mat('#d8cfbf'), x, 0.27, z, g);
  M.cyl(2.05, 2.05, 0.1, 20, M.mat('#6fb3c8', { rough: 0.2 }), x, 0.48, z, g);
  M.cyl(0.35, 0.5, 1.4, 12, M.mat('#d8cfbf'), x, 1.1, z, g);
  M.cyl(0.9, 0.6, 0.25, 14, M.mat('#d8cfbf'), x, 1.85, z, g);
  M.sph(0.25, M.mat('#c8a24a'), x, 2.15, z, g, 8, 6);
}
function trencadisBench(g, x, z, r) { // Park Güell usulü kıvrık mozaik bank (yarım çember)
  const geo = new THREE.TorusGeometry(r, 0.35, 6, 30, PI);
  const m = new THREE.Mesh(geo, M.mat('#ffffff', { map: mosaicTex(8, 1) })); m.rotation.x = -PI / 2; m.position.set(x, 0.42, z); m.scale.z = 1.4; m.castShadow = true; g.add(m);
}
function cafeTable(g, x, z, col) {
  M.cyl(0.04, 0.04, 0.72, 6, M.mat('#3a3a40'), x, 0.36, z, g); M.cyl(0.38, 0.38, 0.04, 12, M.mat('#e9e2d2'), x, 0.74, z, g);
  M.cyl(0.03, 0.03, 2.3, 6, M.mat('#e9e2d2'), x, 1.15, z, g);
  const u = M.cyl(0.05, 1.25, 0.5, 8, M.mat(col), x, 2.25, z, g); u.castShadow = true;
  for (const a of [0.4, 2.5, 4.4]) box(g, 0.36, 0.05, 0.36, '#3a3a40', x + Math.cos(a) * 0.65, 0.45, z + Math.sin(a) * 0.65);
}
function bench(g, x, z, ry) { const b = M.makeBench(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b); }

// ---------- şehri kur (city.js buildCityGround) ----------
export function buildBarcelona(g, S) {
  seed = 7; shopN = 0;
  // yerler: panot kaldırımlar ve Rambla, yan sokaklar, meydanlar, bahçe
  plane(g, CX, 10.9, 170, 1.8, M.mat('#ffffff', { map: panotTex(170, 1.8) }), -0.025);
  plane(g, CX, 25.1, 170, 13.8, M.mat('#ffffff', { map: panotTex(170, 13.8) }), -0.025);
  plane(g, CX, 9.25, 170, 1.5, M.mat('#d4cbbb'), -0.03); // binaların önündeki şerit
  for (const x of [387.5, 471.5]) {
    plane(g, x, -16.6, 7, 56.8, M.mat('#ffffff', { map: texRep('asphalt', 7 / 3, 56.8 / 3) }), -0.02); // kuzey yan sokak, kaldırımı keser
    for (let k = -2.8; k <= 2.81; k += 0.8) M.rbox(0.45, 0.02, 2.6, 0.005, M.mat('#ffffff'), x + k, -0.005, 10.4, g); // yan sokağın ağzında yaya geçidi
    plane(g, x, 46, 7, 28, M.mat('#ffffff', { map: texRep('asphalt', 7 / 3, 28 / 3) }), -0.02); // güney yan sokak (Rambla'da biter)
  }
  plane(g, 399.25, -0.25, 16.5, 20.5, M.mat('#ffffff', { map: panotTex(16.5, 20.5) }), -0.022); // batı meydanı
  plane(g, 460.25, -0.25, 15.5, 20.5, M.mat('#ffffff', { map: panotTex(15.5, 20.5) }), -0.022); // doğu meydanı
  plane(g, 430.5, -14.5, 79, 8, M.mat('#7fae5a'), -0.022); // botanik bahçe
  plane(g, 430.5, -14.4, 79, 1.4, M.mat('#d9c7a0'), -0.018);
  for (const x of [404, 420, 441, 457]) plane(g, x, -12.4, 1.2, 3.8, M.mat('#d9c7a0'), -0.017);
  // cadde: yaya geçidi, yeşil bisiklet yolu
  for (let z = 12.2; z <= 17.81; z += 0.8) M.rbox(ZEBRA[1] - ZEBRA[0], 0.02, 0.45, 0.005, M.mat('#ffffff'), CX, -0.012, z, g);
  plane(g, CX - 1.5, BIKE_Z, 167, 0.62, M.mat('#4f9a5a'), -0.014);
  M.rbox(167, 0.02, 0.06, 0.005, M.mat('#ffffff'), CX - 1.5, -0.012, BIKE_Z - 0.36, g);
  const bk = new THREE.MeshBasicMaterial({ map: bikeIcon(), transparent: true, depthWrite: false });
  for (let x = CX - 80; x < CX + 80; x += 18) { if (Math.abs(x - CX) < 6) continue; plane(g, x, BIKE_Z, 0.6, 0.6, bk, -0.01); }
  // otobüs cebi (kaldırımda, durağın batısı) ve muhasebecinin park cebi (marketin doğusu, sehirhayat.js / tahsilat.js)
  plane(g, S.busBay[0], S.busBay[1], 8.6, 2.5, M.mat('#ffffff', { map: texRep('asphalt', 3, 1) }), -0.015);
  plane(g, S.carBay[0], S.carBay[1], 8.5, 2.3, M.mat('#ffffff', { map: texRep('asphalt', 3, 1) }), -0.015);
  for (const x of [S.carBay[0] - 4.25, S.carBay[0] + 4.25]) M.rbox(0.1, 0.02, 2.2, 0.005, M.mat('#ffffff'), x, -0.01, S.carBay[1], g);
  plane(g, S.carBay[0] + 2.6, S.carBay[1] - 0.2, 0.9, 0.9, new THREE.MeshBasicMaterial({ map: textTex('P', { bg: '#2f6db5', fg: '#ffffff', w: 96, h: 96, r: 12 }) }), -0.008);

  // kuzey sıra (caddeye bakan) ve arka sıra binalar: yüksek, kamera arkasını görür
  const B = [
    { x0: 340, x1: 357, z0: -10, z1: 8.5, h: 17, style: 0, col: '#efe3c8', shops: 3 },
    { x0: 357, x1: 372, z0: -10, z1: 8.5, h: 20, style: 1, col: '#e2b77a', shops: 3 },
    { x0: 372, x1: 384, z0: -10, z1: 8.5, h: 18, style: 0, col: '#e8b8a8', c: { se: 3.5 }, shops: 2 },
    { x0: 340, x1: 384, z0: -32, z1: -12, h: 16, style: 2, col: '#e7d2b0', c: { se: 3.5, ne: 3.5 } },
    { x0: 391, x1: 407, z0: -36, z1: -20, h: 18, style: 1, col: '#d9d4cb', c: { sw: 3.5 } },
    { x0: 407, x1: 453, z0: -40, z1: -20, h: 19, style: 0, col: '#f0d99a' },
    { x0: 453, x1: 468, z0: -36, z1: -20, h: 17, style: 2, col: '#e8b8a8', c: { se: 3.5 } },
    { x0: 475, x1: 489, z0: -10, z1: 8.5, h: 18, style: 1, col: '#c9d3d6', c: { sw: 3.5 }, shops: 2 },
    { x0: 489, x1: 504, z0: -10, z1: 8.5, h: 21, style: 0, col: '#e2b77a', shops: 3 },
    { x0: 504, x1: 520, z0: -10, z1: 8.5, h: 16, style: 2, col: '#cf8a62', shops: 3 },
    { x0: 475, x1: 520, z0: -32, z1: -12, h: 17, style: 0, col: '#efe3c8', c: { sw: 3.5, nw: 3.5 } },
    // güney sıra: alçak ve geride (kuzey cepheleri z 32'de), Rambla'ya bakar
    { x0: 340, x1: 364, z0: 32, z1: 46, h: 10, style: 0, col: '#efe3c8', face: 'n', shops: 3 },
    { x0: 364, x1: 384, z0: 32, z1: 46, h: 11, style: 2, col: '#e8b8a8', c: { ne: 3.5 }, face: 'n', shops: 2 },
    { x0: 391, x1: 410, z0: 32, z1: 46, h: 9.5, style: 1, col: '#c9d3d6', c: { nw: 3.5 }, face: 'n', shops: 2 },
    { x0: 410, x1: 430, z0: 32, z1: 46, h: 11, style: 0, col: '#e2b77a', face: 'n', shops: 2 },
    { x0: 430, x1: 449, z0: 32, z1: 46, h: 10, style: 2, col: '#f0d99a', face: 'n', shops: 2 },
    { x0: 449, x1: 468, z0: 32, z1: 46, h: 10.5, style: 1, col: '#e7d2b0', c: { ne: 3.5 }, face: 'n', shops: 2 },
    { x0: 475, x1: 497, z0: 32, z1: 46, h: 10, style: 0, col: '#cf8a62', c: { nw: 3.5 }, face: 'n', shops: 3 },
    { x0: 497, x1: 520, z0: 32, z1: 46, h: 11, style: 1, col: '#efe3c8', face: 'n', shops: 2 },
  ];
  for (const b of B) building(g, b);
  batllo(g, CX, -20, 16, 19.4);

  // botanik bahçe (marketin arkası): palmiyeler, servi sırası, portakal saksıları, lavanta ve gül tarhları, agavlar, begonvil, sera, pergola
  for (let x = 394; x <= 468; x += 4.6) cypress(g, x, -18.2, rnd(0.85, 1.05));
  for (const x of [412, 425, 436, 448]) palm(g, x, -16.4, rnd(1.1, 1.3), rnd(0.1, 0.3));
  for (const x of [414, 422, 430, 438, 446]) orangePot(g, x, -11.6);
  for (const [x, f] of [[418, '#8e6fd0'], [426, '#e85d75'], [434, '#8e6fd0'], [442, '#f6c343']]) bed(g, x, -12.4, 3.2, 1.1, f);
  for (const x of [410, 450, 462]) agave(g, x, -12.2);
  for (let x = 410; x <= 450; x += 6.5) bougainvillea(g, x, 2.6, -10.75, 5);
  // cam sera (Hivernacle): demir iskelet, kemerli cam çatı
  {
    const iron = M.mat('#2f5d4a', { rough: 0.5 }), glass = M.mat('#cfe9e6', { opacity: 0.45, rough: 0.1 });
    const sx = 399, sz = -15.2;
    box(g, 9, 2.6, 4.6, glass, sx, 1.3, sz);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 9, 12, 1, true, -PI / 2, PI), glass); roof.rotation.z = PI / 2; roof.position.set(sx, 2.6, sz); g.add(roof);
    for (let k = -4.5; k <= 4.51; k += 1.5) { box(g, 0.08, 2.6, 4.7, iron, sx + k, 1.3, sz); const r = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.05, 4, 12, PI), iron); r.rotation.y = PI / 2; r.position.set(sx + k, 2.6, sz); g.add(r); }
    for (const x of [sx - 2.5, sx, sx + 2.5]) palm(g, x, sz, 0.55, 0.1);
  }
  // pergola ve begonvil
  {
    const wood = M.mat('#8a6a4a');
    for (const x of [455, 459, 463]) for (const z of [-16.4, -12.8]) M.cyl(0.08, 0.08, 2.6, 6, wood, x, 1.3, z, g);
    for (const z of [-16.4, -12.8]) box(g, 9, 0.12, 0.14, wood, 459, 2.65, z);
    for (let x = 455; x <= 463; x += 1) box(g, 0.1, 0.1, 4.2, wood, x, 2.78, -14.6);
    bougainvillea(g, 457, 2.9, -14.6, 7); bougainvillea(g, 461.5, 2.9, -14.0, 6);
    bench(g, 459, -14.6, PI / 2);
  }

  // batı meydanı: çeşme, trencadís bank, palmiyeler, kafe masaları (otobüs durağı güney ucunda)
  fountain(g, 399, -2);
  trencadisBench(g, 399, -2, 4.3);
  for (const [x, z] of [[393.6, -9], [404.6, -9], [393.6, 4.6]]) { bed(g, x, z, 2.4, 2.4); palm(g, x, z, rnd(1.0, 1.25), rnd(0.15, 0.35)); }
  for (const [x, z, c] of [[398, 4.2, '#c0392b'], [401.6, 3.4, '#f2efe8'], [398.4, 7.0, '#2f6db5']]) cafeTable(g, x, z, c);
  // doğu meydanı: çiçekçi, banklar, ağaçlar, fener
  kiosk(g, 461, 2.2, 'FLORS', '#c84a7a');
  for (const [x, z] of [[456.5, -8.5], [465, -8.5]]) { bed(g, x, z, 2.4, 2.4, '#f6c343'); platan(g, x, z, 1.05); }
  for (const [x, z] of [[456, 6.5], [466, 6.5]]) { bed(g, x, z, 2.2, 2.2); palm(g, x, z, 1.05, 0.2); }
  bench(g, 458, -3.5, 0); bench(g, 464, -3.5, 0);
  { const l = gaudiLamp(); l.position.set(460.5, 0, -2); g.add(l); }
  { const l = gaudiLamp(); l.position.set(399, 0, 8.4); g.add(l); }

  // Rambla (caddenin güneyi): fenerler kaldırımın cadde kenarında, banklar kaldırımın hemen dışında, ağaçlar çimenlik havuzlarda
  for (let x = CX - 76; x <= CX + 76; x += 16) {
    const l = gaudiLamp(); l.position.set(x, 0, 18.6); g.add(l);
    G.colliders.push([x - 0.3, x + 0.3, 18.3, 18.9]);
  }
  for (let x = CX - 72; x <= CX + 72; x += 16) { if (Math.abs(x - CX) < 4) continue; bench(g, x, 22.3, PI); }
  for (let x = CX - 80; x < CX + 80; x += 24) bed(g, x + 12, 27.8, 21, 2.6, null);
  for (let i = 0, x = CX - 76; x <= CX + 76; i++, x += 8) { if (Math.abs(x - 388) < 5 || Math.abs(x - 472) < 5) continue; if (i % 2) platan(g, x, 27.8, rnd(0.95, 1.1)); else palm(g, x, 27.8, rnd(1.0, 1.15), rnd(0.1, 0.3)); }
  kiosk(g, 414, 24.4, 'FLORS', '#c84a7a');
  kiosk(g, 447, 24.4, 'QUIOSC', '#2f6db5');
  canaletes(g, CX, 23.6);
  for (const x of [CX - 50, CX + 54]) { for (let i = 0; i < 3; i++) cafeTable(g, x + i * 2.2, 24.6, ['#c0392b', '#f2efe8', '#2f6db5'][i]); }
}

// ---------- modernist market (city.js cityRegion): tuğla cephe, pilastrlar, mozaik korniş, seramik tepelikler, köşe kuleleri ----------
export function marketDecor(C, rect, rcol) {
  const [x0, x1, z0, z1] = rect, H = 3.2, W = x1 - x0, D = z1 - z0;
  const brick = (len, rx) => M.mat('#ffffff', { map: brickTex(rx, H) });
  // dış yüzlere tuğla kaplama (ince levha), içte seramik süpürgelik
  M.rbox(W, H, 0.06, 0.01, brick(W, W), (x0 + x1) / 2, H / 2, z0 - 0.03, C);
  for (const x of [x0 - 0.03, x1 + 0.03]) M.rbox(0.06, H, D, 0.01, brick(D, D), x, H / 2, (z0 + z1) / 2, C);
  const tile = M.mat('#3f8a7a');
  M.rbox(W - 0.9, 1.05, 0.03, 0.01, M.mat('#e8f1ee'), (x0 + x1) / 2, 0.55, z0 + 0.42, C);
  M.rbox(W - 0.9, 0.12, 0.04, 0.01, tile, (x0 + x1) / 2, 1.1, z0 + 0.42, C);
  for (const s of [1, -1]) { const x = s > 0 ? x0 + 0.42 : x1 - 0.42; M.rbox(0.03, 1.05, D - 0.9, 0.01, M.mat('#e8f1ee'), x, 0.55, (z0 + z1) / 2, C); M.rbox(0.04, 0.12, D - 0.9, 0.01, tile, x, 1.1, (z0 + z1) / 2, C); }
  // mozaik korniş ve seramik tepelikler (duvarın üstü)
  const mz = (len) => M.mat('#ffffff', { map: mosaicTex(len / 2, 1) });
  M.rbox(W + 0.3, 0.32, 0.56, 0.03, mz(W), (x0 + x1) / 2, H + 0.16, z0 + 0.2, C);
  for (const x of [x0 + 0.2, x1 - 0.2]) M.rbox(0.56, 0.32, D + 0.3, 0.03, mz(D), x, H + 0.16, (z0 + z1) / 2, C);
  const fin = [M.mat('#2f6fb5'), M.mat('#3f9a5a'), M.mat('#e2b04a')];
  let n = 0;
  for (let x = x0 + 2.2; x < x1 - 1.5; x += 3) { M.cyl(0.02, 0.2, 0.55, 6, fin[n++ % 3], x, H + 0.6, z0 + 0.2, C); }
  for (let z = z0 + 2.2; z < z1 - 2.5; z += 3) for (const x of [x0 + 0.2, x1 - 0.2]) M.cyl(0.02, 0.2, 0.55, 6, fin[n++ % 3], x, H + 0.6, z, C);
  // tuğla pilastrlar (dışta, taş başlıklı)
  const pil = M.mat('#9a3f30'), cap = M.mat('#e6dccb');
  for (let x = x0 + 1.5; x < x1 - 1; x += 4.5) { M.rbox(0.55, H + 0.1, 0.25, 0.03, pil, x, (H + 0.1) / 2, z0 - 0.14, C); M.rbox(0.7, 0.16, 0.36, 0.03, cap, x, H + 0.05, z0 - 0.16, C); }
  for (let z = z0 + 1.5; z < z1 - 2; z += 4.5) for (const s of [-1, 1]) { const x = s < 0 ? x0 - 0.14 : x1 + 0.14; M.rbox(0.25, H + 0.1, 0.55, 0.03, pil, x, (H + 0.1) / 2, z, C); M.rbox(0.36, 0.16, 0.7, 0.03, cap, x, H + 0.05, z, C); }
  // ön alçak duvarın üstünde mozaik şerit
  for (const [a, b] of [[x0, CX - 3], [CX + 3, x1]]) M.rbox(b - a, 0.08, 0.4, 0.02, mz(b - a), (a + b) / 2, 0.74, z1 - 0.2, C);
  // köşe kuleleri arka köşelerde (önde kapıya yakın duran oyuncuyu örterdi: kamera güneyden bakar): tuğla gövde, taş bilezik,
  // mozaik kubbe ve tepelik
  for (const s of [-1, 1]) {
    const x = s < 0 ? x0 + 0.8 : x1 - 0.8, z = z0 + 0.8;
    M.rbox(1.6, 4.2, 1.6, 0.05, brick(1.6, 1.6), x, 2.1, z, C);
    M.rbox(1.8, 0.22, 1.8, 0.04, cap, x, 3.3, z, C); M.rbox(1.85, 0.25, 1.85, 0.04, cap, x, 4.25, z, C);
    const d = M.sph(0.9, M.mat('#ffffff', { map: mosaicTex(2, 1) }), x, 4.35, z, C, 12, 8); d.scale.y = 0.85;
    M.cyl(0.02, 0.14, 0.6, 6, M.mat('#c8a24a'), x, 5.35, z, C);
    rcol(x - 0.8, x + 0.8, z - 0.8, z + 0.8);
  }
}
