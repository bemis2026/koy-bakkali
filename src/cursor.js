// Oyun imleci: işaret parmağı kalkık beyaz eldiven el. Üstüne gelinen yere göre sağ üstte rozet çıkar
// (topla, koy, para, kasa, kilit, çöp, yükselt); fareyle yürürken parmak bastırır ve yere yeşil bir dokunuş halkası iner.
import * as THREE from 'three';
import { G, PlantBed, Generator, Shelf, Register, MoneyPile, UnlockPad, PaidSource, Lounger, Converter } from './game.js';

const LINE = '#3b2a6b';
const svg = (body) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${body}</svg>`)}")`;

// eldiven: parmaklar, avuç ve başparmak ayrı şekiller; önce kalın koyu çerçeve, üstüne beyaz dolgu → tek parça temiz siluet
function handShapes(press) {
  const top = press ? 4.6 : 2;
  return `<rect x="8.6" y="${top}" width="5" height="${17 - top}" rx="2.5"/>` +
    '<rect x="13.2" y="11.4" width="4.4" height="8" rx="2.2"/><rect x="17.2" y="12.4" width="4.4" height="7.6" rx="2.2"/><rect x="21.1" y="13.8" width="4.1" height="6.8" rx="2"/>' +
    '<rect x="7" y="15" width="18.2" height="11.4" rx="5"/>' +
    '<rect x="3.3" y="15.6" width="5.6" height="8.6" rx="2.8" transform="rotate(-30 6.1 19.9)"/>';
}
function hand(press = false) {
  const sh = handShapes(press);
  const tap = press ? `<ellipse cx="11.1" cy="${press ? 5 : 3}" rx="6.6" ry="2.6" fill="none" stroke="${LINE}" stroke-width="3.6"/><ellipse cx="11.1" cy="5" rx="6.6" ry="2.6" fill="none" stroke="#56c27e" stroke-width="1.9"/>` : '';
  return tap +
    `<g transform="translate(1.1 1.3)" opacity=".28">${sh}</g>` +
    `<g fill="${LINE}" stroke="${LINE}" stroke-width="3.4" stroke-linejoin="round">${sh}</g>` +
    `<g fill="#ffffff">${sh}</g>` +
    '<path d="M13.4 15.4 V17.8 M17.4 16.2 V18.4 M21.2 17.2 V19" stroke="#cdc6e0" stroke-width="1.3" stroke-linecap="round"/>' +
    `<path d="M10.4 ${press ? 7.4 : 5} V12" stroke="#e9f2ff" stroke-width="1.5" stroke-linecap="round"/>` +
    `<rect x="7.6" y="25" width="17" height="4.8" rx="2.2" fill="#ffd23f" stroke="${LINE}" stroke-width="2"/>` +
    '<path d="M10 27.4 H22.4" stroke="#f6a623" stroke-width="1.2" stroke-linecap="round"/>';
}
// rozet sağ üst köşede, parmağın yanında: büyük, renkli ve kolay okunur
const badge = (fill, inner) => `<circle cx="25" cy="7.6" r="7.9" fill="${LINE}"/><circle cx="25" cy="7.6" r="6.7" fill="${fill}" stroke="#ffffff" stroke-width="1.6"/>${inner}`;
const lira = (c) => `<text x="25" y="11.4" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="10.5" text-anchor="middle" fill="${c}">₺</text>`;
const BADGES = {
  collect: badge('#56c27e', '<path d="M25 3.1 L29.1 7.6 H26.5 V11.9 H23.5 V7.6 H20.9 Z" fill="#ffffff"/>'),
  put: badge('#3d7dd8', '<path d="M25 12.1 L20.9 7.6 H23.5 V3.3 H26.5 V7.6 H29.1 Z" fill="#ffffff"/>'),
  coin: badge('#ffd23f', lira('#7a4a00')),
  pay: badge('#2f9a4f', lira('#ffffff')),
  unlock: badge('#f6a623', '<rect x="21.5" y="6.7" width="7" height="5.3" rx="1.2" fill="#ffffff"/><path d="M23 6.8 V5.2 a2 2 0 0 1 4 0 V6.8" fill="none" stroke="#ffffff" stroke-width="1.6"/>'),
  trash: badge('#8b85a3', '<rect x="21.6" y="3.7" width="6.8" height="1.6" rx=".7" fill="#ffffff"/><path d="M22.4 6 H27.6 L27 11.6 H23 Z" fill="#ffffff"/>'),
  upgrade: badge('#e8604c', '<path d="M25 3 L29.4 7.8 H26.6 V12 H23.4 V7.8 H20.6 Z" fill="#ffd23f"/>'),
};
const HOT = ' 11 2', CUR = { hand: `${svg(hand())}${HOT}, pointer`, walk: `${svg(hand(true))} 11 4, pointer` };
for (const k in BADGES) CUR[k] = `${svg(hand() + BADGES[k])}${HOT}, pointer`;
export const CURSOR_URLS = CUR; // test ve önizleme için

// istasyon → rozet ve öncelik (üst üste binen alanlarda yüksek öncelik kazanır)
function classify(s) {
  if (s instanceof UnlockPad) return ['unlock', 9];
  if (s instanceof MoneyPile) return s.amount > 0 ? ['coin', 8] : null;
  const n = s.constructor.name;
  if (n === 'Trash') return ['trash', 7];
  if (s instanceof Register) return ['pay', 5];
  if (s instanceof PlantBed || s instanceof Generator || s instanceof PaidSource) return ['collect', 4];
  if (s instanceof Shelf || s instanceof Converter || s instanceof Lounger || n === 'CarDrop' || n === 'CaravanDrop') return ['put', 4];
  return null;
}

let canvas, kind = '', pressed = false, has = false, dirty = false, t = 0;
const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

export function initCursor(cv) {
  canvas = cv;
  const root = document.documentElement.style;
  root.setProperty('--cur-arrow', CUR.hand);
  root.setProperty('--cur-hand', CUR.hand);
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    has = true; dirty = true;
  });
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { pressed = true; dirty = true; } });
  addEventListener('pointerup', () => { pressed = false; dirty = true; });
  canvas.addEventListener('pointerleave', () => { has = false; });
  set('hand');
}

function set(k) { if (k !== kind) { kind = k; canvas.style.cursor = CUR[k]; } }

export function updateCursor(dt) {
  t -= dt;
  if (!has || (!dirty && t > 0)) return;
  dirty = false; t = 0.15; // fare dursa da altındaki yer değişebilir (yeni açılan alan, biriken para)
  if (pressed) return set('walk');
  ray.setFromCamera(ndc, G.camera);
  if (!ray.ray.intersectPlane(plane, hit)) return set('hand');
  let best = null, pri = -1;
  for (const s of G.stations) {
    if (!s.near(hit)) continue;
    const c = classify(s);
    if (c && c[1] > pri) { best = c[0]; pri = c[1]; }
  }
  set(best || 'hand');
}
