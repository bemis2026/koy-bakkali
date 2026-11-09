// Rüzgar: direkte dalgalanan bayraklar. Kumaş direğe bağlı kenardan uca doğru açılan, yavaş ve yumuşak dalgalarla
// sallanır, ucu hafif sarkar. updateFlags her karede (world.js updateWorld) çağrılır.
import * as THREE from 'three';
import * as M from './models.js';

const flags = [];
const texCache = {};
function flagTex(kind) {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas'); c.width = 192; c.height = 128;
  const g = c.getContext('2d');
  if (kind === 'tr') {
    // al bayrak: kırmızı zemin, beyaz ay yıldız
    g.fillStyle = '#e30a17'; g.fillRect(0, 0, 192, 128);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(72, 64, 32, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e30a17'; g.beginPath(); g.arc(80, 64, 25.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 6.4 : 16; g.lineTo(112 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  } else {
    // kervan sancağı: firuze ve kırmızı şeritler
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#c0392b' : '#2fa5a0'; g.fillRect(0, i * 32, 192, 32); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[kind] = t);
}

// direk ve bayrak; direğin dibi (0,0,0). Bayrak +x yönünde (rüzgar yönü) açılır
export function makeFlag(kind = 'tr', pole = 2.2, w = 1.3, h = 0.86) {
  const g = new THREE.Group();
  M.cyl(0.035, 0.045, pole, 8, M.mat('#d7dde3', { rough: 0.35 }), 0, pole / 2, 0, g);
  M.sph(0.07, M.mat('#e0b04a', { rough: 0.4 }), 0, pole + 0.04, 0, g, 8, 6);
  const geo = new THREE.PlaneGeometry(w, h, 18, 6);
  geo.translate(w / 2, 0, 0);
  const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTex(kind), side: THREE.DoubleSide, roughness: 0.85 }));
  cloth.position.set(0.04, pole - h / 2 - 0.06, 0);
  cloth.castShadow = true;
  g.add(cloth);
  flags.push({ geo, cloth, base: geo.attributes.position.array.slice(), w, ph: Math.random() * 6 });
  return g;
}

// at: oyuncunun yeri. 70 m'den uzaktaki bayrak kımıldamaz: kumaşın normalleri her karede yeniden hesaplanıyordu (işlemci ve çöp)
// kumaş saniyede 20 kez yeniden kurulur: her karede köşe ve normal hesabı telefonda boşa iş (göz farkı seçmiyor)
const wp = new THREE.Vector3();
let flagT = -1;
export function updateFlags(t, at) {
  if (t >= flagT && t - flagT < 0.05) return;
  flagT = t;
  for (const f of flags) {
    if (at && (!f.cloth.parent || f.cloth.getWorldPosition(wp).distanceToSquared(at) > 4900)) continue;
    const p = f.geo.attributes.position, a = p.array, b = f.base;
    for (let i = 0; i < a.length; i += 3) {
      const x = b[i], k = x / f.w; // direkte 0, uçta 1
      a[i + 2] = (Math.sin(k * 4.6 - t * 2.4 + f.ph) * 0.11 + Math.sin(b[i + 1] * 2.5 + t * 1.7 + f.ph) * 0.02) * k * f.w;
      a[i + 1] = b[i + 1] - k * k * 0.045 * f.w;
    }
    p.needsUpdate = true;
    f.geo.computeVertexNormals();
  }
}
