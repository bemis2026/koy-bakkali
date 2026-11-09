// Gün döngüsü (saat rozeti masaüstünde seviye ve mahalle puanının altında, telefonda sol üstte): 12 dakikada sabahtan (08.00) akşamüstüne (18.00) gidilir, sonra yarım dakikalık yumuşak geçişle yeni sabah
// başlar; hava hiç kararmaz. Güneş doğudan güneye, oradan batıya döner: gölgeler sabah ve akşamüstü uzun, öğlen kısa. Işığın,
// göğün ve sisin rengi sabah açık altın, öğlen beyaz, akşamüstü turuncu; akşamüstü fenerler yanar. Geçişte güneş sönükleşir,
// yönü en sönük anda doğuya döner (gölgeler bir anda yer değiştirmez, hafifçe silinip yeniden belirir).
// Oynanış (world.js sahil): öğlen sıcağında (heat) sahile daha çok müşteri gelir, dondurma istenir; şemsiyenin gölgesi
// şezlonga düşerken (shaded) yatan müşteri fazla bahşiş bırakır. Saat G.stats.dayT'de saklanır, kayıtla devam eder.
import * as THREE from 'three';
import { G, toast } from './game.js';
import * as M from './models.js';
import { updateHava, tintHava, havaSicak, havaInfo, hava } from './hava.js';

export const DAY = 720; // sn: bir tur
const FADE = 0.04; // turun sonu (≈29 sn): akşamüstünden yeni sabaha geçiş
// s: günün ilerleyişi (0 sabah, 0,5 öğle, 1 akşamüstü). sun/si: güneş rengi ve gücü, sky/gnd/hi: gök ışığı, bg: gök ve sis.
// Alçak güneş zemine az ışık düşürür: sabah ve akşamüstü güç ve gök ışığı yüksek tutulur, sahne kararmaz
const KEYS = [
  { s: 0, sun: '#ffd8a8', si: 2.6, sky: '#e2f0ff', gnd: '#a8c98b', hi: 2.05, bg: '#cfe8ff' },
  { s: 0.5, sun: '#fff6e8', si: 2.35, sky: '#ffffff', gnd: '#9cc27e', hi: 1.9, bg: '#bfe6ff' },
  { s: 1, sun: '#ffb46e', si: 2.7, sky: '#e4daf2', gnd: '#b59d74', hi: 1.95, bg: '#ffdcb8' },
].map((k) => ({ ...k, sun: new THREE.Color(k.sun), sky: new THREE.Color(k.sky), gnd: new THREE.Color(k.gnd), bg: new THREE.Color(k.bg) }));
const smooth = (x) => { const v = Math.min(1, Math.max(0, x)); return v * v * (3 - 2 * v); };
const D2R = Math.PI / 180;

export const day = { s: 0.2, heat: 0, dir: new THREE.Vector3(0.3, 0.8, 0.5).normalize(), hour: 10, fading: false };
let L = null, lamp = null, chip = null, chipT = 0, shown = '', hot = false;
const P = { sun: new THREE.Color(), sky: new THREE.Color(), gnd: new THREE.Color(), bg: new THREE.Color(), si: 0, hi: 0 };
const Q = { sun: new THREE.Color(), sky: new THREE.Color(), gnd: new THREE.Color(), bg: new THREE.Color(), si: 0, hi: 0 };

function paletteAt(s, out) {
  const i = s < 0.5 ? 0 : 1, a = KEYS[i], b = KEYS[i + 1], u = smooth((s - a.s) / (b.s - a.s));
  out.sun.copy(a.sun).lerp(b.sun, u); out.sky.copy(a.sky).lerp(b.sky, u); out.gnd.copy(a.gnd).lerp(b.gnd, u); out.bg.copy(a.bg).lerp(b.bg, u);
  out.si = a.si + (b.si - a.si) * u; out.hi = a.hi + (b.hi - a.hi) * u;
  return out;
}
// güneş yönü (zeminden güneşe): doğu +x, güney +z. Sabah doğu-güneydoğudan alçak, öğlen güneyden yüksek, akşamüstü batıdan alçak
function sunDir(s, out) {
  const az = (25 + 130 * s) * D2R, el = (28 + 34 * Math.sin(Math.PI * s)) * D2R;
  return out.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
}

// main.js: ışıklar ve gölge kutusunun eksenleri (LD güneş yönü; fitShadow her karede okur)
export function initDaylight(refs) {
  L = refs;
  lamp = M.mat('#fff3c4', { emissive: '#ffe08a', ei: 0.6 }); // sokak fenerlerinin ortak ampulü (models.js makeLamp)
  if (typeof G.stats.dayT !== 'number') G.stats.dayT = 0.12; // ilk açılış: sabah 09.00 sularında
  const st = document.createElement('style');
  st.textContent = `#dayChip { position: absolute; top: 152px; left: 14px; padding: 4px 12px 4px 8px; border-radius: 999px; font: 17px var(--font-title); display: flex; gap: 6px; align-items: center; cursor: pointer; white-space: nowrap;  pointer-events: auto; cursor: pointer;}
#dayChip i { font-style: normal; font-size: 18px; }
#dayChip.hot { background: #fff1c9; }
@media (max-width: 640px) { #dayChip { top: 12px; left: 10px; font-size: 14px; padding: 3px 9px 3px 6px; } #dayChip i { font-size: 15px; } #dayChip b { display: none; } } /* para kutusuna yer: sıcağı sarı zemin gösterir */`;
  document.head.appendChild(st);
  chip = document.createElement('div'); chip.id = 'dayChip'; chip.className = 'hp';
  chip.title = 'Gün döngüsü: öğlen sıcağında sahil kalabalıklaşır';
  chip.onclick = () => toast(havaInfo() || '☀️ Öğlen sıcağında sahile daha çok müşteri gelir, dondurma istenir. Şemsiyenin gölgesi şezlonga düşerken yatan müşteri fazla bahşiş bırakır.');
  (document.getElementById('hud') || document.body).appendChild(chip);
  updateDaylight(0);
}

export function updateDaylight(dt) {
  if (!L) return;
  const t0 = G.stats.dayT, t = (G.stats.dayT = (t0 + dt / DAY) % 1);
  if (dt > 0 && t < t0) { G.stats.dayN = (G.stats.dayN || 0) + 1; if (G.hooks.newDay) G.hooks.newDay(G.stats.dayN); } // yeni gün: günlük görevler (gorev.js)
  let s, k = 1;
  if (t < 1 - FADE) { s = t / (1 - FADE); paletteAt(s, P); day.fading = false; }
  else {
    const u = (t - (1 - FADE)) / FADE, w = smooth(u);
    s = u < 0.5 ? 1 : 0; k = 1 - 0.7 * Math.sin(Math.PI * u); // en sönük anda güneş doğuya döner
    paletteAt(1, P); paletteAt(0, Q);
    P.sun.lerp(Q.sun, w); P.sky.lerp(Q.sky, w); P.gnd.lerp(Q.gnd, w); P.bg.lerp(Q.bg, w);
    P.si += (Q.si - P.si) * w; P.hi += (Q.hi - P.hi) * w;
    day.fading = true;
  }
  const S = G.season; // mevsim (mevsim.js): gök ve güneş rengine pay, öğlen sıcağına çarpan
  if (S) { P.bg.lerp(S.bgC, S.a); P.sun.lerp(S.sunC, S.a * 0.6); P.gnd.lerp(S.gndC, S.a); }
  updateHava(dt); tintHava(P); // yağmur, kar, fırtına (hava.js): gök kararır, güneş söner, şimşek çakar
  sunDir(s, day.dir);
  day.s = s; day.hour = 8 + 10 * s;
  day.heat = day.fading ? 0 : Math.sin(Math.PI * s) ** 2 * (S ? S.heat : 1) * havaSicak();
  const { sun, hemi, scene, LD, LX, LY } = L;
  sun.color.copy(P.sun); sun.intensity = P.si * k;
  hemi.color.copy(P.sky); hemi.groundColor.copy(P.gnd); hemi.intensity = P.hi * (1 + 0.2 * (1 - k)); // güneş sönerken gök ışığı biraz artar, kararmaz
  scene.background.copy(P.bg); scene.fog.color.copy(P.bg);
  // güneş yönü yarım derece değişince güncellenir: her karede azıcık dönen ışık gölge kenarlarını titretiyordu
  if (LD.dot(day.dir) < 0.99996 || dt === 0) { LD.copy(day.dir); LX.set(0, 1, 0).cross(LD).normalize(); LY.copy(LD).cross(LX); }
  lamp.emissiveIntensity = 0.6 + 1.1 * smooth((s - 0.72) / 0.28) * k;
  // öğlen sıcağı başlarken bir kez haber (sahil açıksa)
  if (!hot && day.heat > 0.75 && !hava.kind) { hot = true; if (dt > 0 && G.regions.sahil && G.regions.sahil.unlocked) toast('☀️ Öğlen sıcağı: sahil kalabalık, şemsiye gölgesindekiler fazla bahşiş bırakır'); }
  else if (hot && day.heat < 0.4) hot = false;
  if ((chipT -= dt) > 0) return;
  chipT = 0.5;
  const h = Math.floor(day.hour), m = Math.floor((day.hour - h) * 6) * 10;
  const icon = day.fading ? '🌅' : hava.icon || (S ? S.icon : s < 0.25 ? '🌤️' : s < 0.72 ? '☀️' : '🌇'); // mevsim simgesi; günün saati ışıktan belli
  const txt = day.fading ? `<i>${icon}</i>Yeni gün` : `<i>${icon}</i>${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${day.heat > 0.75 ? '<b> 🔥</b>' : ''}`;
  if (txt !== shown) { shown = txt; chip.innerHTML = txt; chip.classList.toggle('hot', day.heat > 0.75); }
}

// şemsiyenin gölgesi bu noktaya düşüyor mu: şemsiye tepesi (ux, top, uz), yarıçap r; nokta y yüksekliğinde (yatan müşteri)
export function shaded(px, pz, ux, uz, top = 2.55, r = 1.5, y = 0.5) {
  const d = day.dir, f = (top - y) / Math.max(0.2, d.y);
  return Math.hypot(ux - d.x * f - px, uz - d.z * f - pz) < r;
}
