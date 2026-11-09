// Doğal kenarlar. Tasarım kuralı: insan yapımı yerler (bölge zeminleri, yollar, tarlalar, çitler) düz kalabilir;
// doğanın çizdiği sınırlar (deniz kıyısı, kumsal, nehir kıyısı, kum tepeleri) asla cetvelle çizilmiş gibi durmaz.
// Bu hatlar birkaç farklı dalga boyundaki sinüslerin toplamıyla girintili çıkıntılı yapılır. Yeni eklenen doğal
// alanlar da (göl, dere, kayalık kıyı...) buradaki yardımcıları kullanmalı.
import * as THREE from 'three';
import { G } from './game.js';

const PI = Math.PI;
// -1..1 arası, düzensiz ama yumuşak dalga: uzun girinti + orta koy + küçük çentikler
export function wobble(t, seed = 0, f = [0.083, 0.21, 0.53], w = [0.56, 0.28, 0.16]) {
  let v = 0;
  for (let i = 0; i < f.length; i++) v += w[i] * Math.sin(t * f[i] + seed * (i + 1) * 1.73 + i * 0.9);
  return v;
}
// deniz kıyısı: hiçbir yerde z 31'in gerisine çekilmez (yürünen kum hep kuru kalır); yer yer 2-3 m denize uzanan
// burunlar, aralarında koylar
export const COAST_MIN = 31.0;
export function coastZ(x) {
  const n = 0.5 + 0.55 * wobble(x, 1, [0.07, 0.17, 0.41], [0.4, 0.36, 0.24]); // uzun koy + orta burun + küçük çentik
  return COAST_MIN + 3.4 * Math.max(0, Math.min(1, n));
}
// kumsalın iç (kara) kenarı: kumul gibi hafif dalgalı
export const duneZ = (x) => 27.6 + 0.7 * wobble(x, 5, [0.12, 0.31], [0.65, 0.35]);

// iki kenar fonksiyonu arasında kalan kuşak (x boyunca): kumsal, ıslak kum gibi
export function bandGeo(x0, x1, zN, zS, step = 0.8) {
  const pos = [], uv = [], idx = [];
  const n = Math.ceil((x1 - x0) / step);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, a = zN(x), b = zS(x);
    pos.push(x, 0, a, x, 0, b);
    uv.push(x / 3, a / 3, x / 3, b / 3);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// bir eğri boyunca değişken genişlikte şerit (nehir, dere): hw(s, side) yarım genişlik; s = yol boyu (birim)
export function ribbonGeo(curve, samples, hwL, hwR, vScale = 6) {
  const pos = [], uv = [], idx = [];
  const len = curve.getLength();
  for (let i = 0; i <= samples; i++) {
    const t = i / samples, p = curve.getPointAt(t), tg = curve.getTangentAt(t), s = t * len;
    const nx = -tg.z, nz = tg.x, l = Math.hypot(nx, nz) || 1;
    const a = hwL(s), b = hwR(s);
    pos.push(p.x + (nx / l) * a, 0, p.z + (nz / l) * a, p.x - (nx / l) * b, 0, p.z - (nz / l) * b);
    uv.push(0, s / vScale, 1, s / vScale);
    if (i < samples) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// kıyıya bakan bölge zemini: kuzey kenarı düz, güney kenarı kıyı çizgisini izler (world.js slab ile aynı kalınlık)
export function coastSlabGeo(rect, south) {
  // kıyıdaki bölgenin düz zemini: güney kenarı kıyı çizgisini izler. Geometri world.js slab() düzleminin yerel ekseninde
  // (merkezli, döndürülmemiş); uv bölge dikdörtgenine göre 0..1, böylece doku hizası ve kenar yumuşatma maskesi aynı kalır
  const [x0, x1, z0, z1] = rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, s = new THREE.Shape();
  s.moveTo(x0 - cx, cz - z0); s.lineTo(x1 - cx, cz - z0);
  const n = Math.ceil((x1 - x0) / 0.5);
  for (let i = 0; i <= n; i++) { const x = x1 - ((x1 - x0) * i) / n; s.lineTo(x - cx, cz - south(x)); }
  s.lineTo(x0 - cx, cz - z0);
  const geo = new THREE.ShapeGeometry(s), pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + d / 2) / d);
  return geo;
}

// ---------- serbest yürüme ----------
// oyuncu karada her yerde gezebilir: bölge ve yol dışındaki çimenler de yürünür. Yürünmeyenler: harita sınırının dışı,
// deniz, nehrin suyu (köprüler yol sayılır), çitli dekor köyü ve batıdaki tarla-değirmen bloğu, ağaç gövdeleri.
// Yalnızca oyuncu içindir; elemanlar ve müşteriler eskisi gibi bölge ve yollardan yürür (world.js walkable)
const ROAM = [-89, 107, -72]; // harita genişletmesi: batı -7, doğu +7 // batı, doğu, kuzey sınırı; güneyde deniz
const RIVER = [[77, -160], [73, -110], [67, -70], [64, -35], [62, -5], [60, 18], [59, 34]]; // decor.js river() ile aynı
// çitli dekor köyleri (batıdaki mezra, nehrin ötesi), batıdaki tarlalar ve değirmen, kuzeydoğudaki uzak kasaba silueti
// dere ötesi köy, uzak kasaba. Batı ovasının batı ucundaki çitli tarlalar 2026-11-03'te kalktı (yerinde binicilik pisti, kendi engeli var)
const NO_ROAM = [[82.5, 117.5, -48.5, -11.5], [69, 109, -92, -65.5]];
function riverX(z) {
  for (let i = 1; i < RIVER.length; i++) {
    const [x0, z0] = RIVER[i - 1], [x1, z1] = RIVER[i];
    if (z <= z1) return x0 + ((x1 - x0) * (z - z0)) / (z1 - z0);
  }
  return RIVER[RIVER.length - 1][0];
}
// beach club'ın çevresi (club.js, x 108-131): ana yolun güneyinden denize kadar kum ve çimen de yürünür. 2026-11-03 kullanıcı: "yürüyüş
// yollarında ve başka bazı kısımlarda görünmez duvarlar var, adam yürürken çok takılıyor": ROAM doğuda 107'de bitiyordu; kulübün iki
// yanındaki kum, yolla kulüp arasındaki çimen yürünmüyor, oyuncu kulübün çevresinde görünmeyen bir çerçeveye çarpıyordu
const ROAM_CLUB = [136, 9.0]; // doğu sınırı, kuzey sınırı (yolun güney kenarı)
export function openGround(x, z) {
  const east = x > ROAM[1] && x <= ROAM_CLUB[0] && z >= ROAM_CLUB[1];
  if (x < ROAM[0] || (x > ROAM[1] && !east) || z < ROAM[2] || z > coastZ(x) - 0.5) return false;
  if (Math.abs(x - riverX(z)) < 3.6) return false; // su; kumlu kıyısı yürünür
  for (const r of NO_ROAM) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) return false;
  for (const t of G.trees || []) { const r = 0.3 + 0.22 * t[2], dx = x - t[0], dz = z - t[1]; if (dx * dx + dz * dz < r * r) return false; } // ağaç gövdesi
  return true;
}
