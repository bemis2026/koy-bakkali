// Ortak mobilya parçaları: makine iş masası ve tahta kasa. İkisi de rbox gibi merkezi ortada kurulur ve aynı ölçüyle onun yerine
// konur: üstlerine dizilen ürünlerin yüksekliği değişmez. Eski düz tahta bloklar oyun açısından kaba görünüyordu.
import * as THREE from 'three';
import { rbox, mat } from './models.js';

// iş masası: tahta tabla (üstünde iki tahta arası çizgisi), alt kuşak, dört ayak, altta raf
export function workTable(w, h, d, top) {
  const g = new THREE.Group(), dark = mat('#7a4e2c'), seam = mat('#5e3b20');
  rbox(w, 0.1, d, 0.03, top, 0, h / 2 - 0.05, 0, g);
  for (const k of [-1, 1]) rbox(w - 0.06, 0.008, 0.02, 0.003, seam, 0, h / 2 + 0.003, (k * d) / 6, g);
  rbox(w - 0.14, 0.12, d - 0.14, 0.02, dark, 0, h / 2 - 0.16, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rbox(0.09, h - 0.1, 0.09, 0.02, dark, sx * (w / 2 - 0.09), -0.05, sz * (d / 2 - 0.09), g);
  rbox(w - 0.2, 0.05, d - 0.2, 0.01, top, 0, -h / 2 + 0.18, 0, g);
  return g;
}

// tahta kasa: araları açık yatay çıtalar, köşe dikmeleri, kapak çıtaları; aralardan koyu içi görünür
export function crate(w, h, d, col = '#a8703f') {
  const g = new THREE.Group(), m = mat(col), dark = mat('#4a3020'), n = 3, step = (h - 0.06) / n;
  rbox(w - 0.06, h - 0.04, d - 0.06, 0.01, dark, 0, -0.02, 0, g);
  for (let i = 0; i < n; i++) rbox(w, step * 0.72, d, 0.015, m, 0, -h / 2 + 0.03 + (i + 0.5) * step, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rbox(0.07, h, 0.07, 0.01, m, sx * (w / 2 - 0.035), 0, sz * (d / 2 - 0.035), g);
  for (let i = 0; i < 4; i++) rbox(w - 0.02, 0.03, (d / 4) * 0.8, 0.008, m, 0, h / 2 - 0.015, -d / 2 + (i + 0.5) * (d / 4), g);
  return g;
}
