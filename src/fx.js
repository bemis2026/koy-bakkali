// Parçacık efektleri: konfeti, toz, pırıltı, halka
import * as THREE from 'three';
import { G } from './game.js';

const parts = [];
const BOX = new THREE.BoxGeometry(1, 1, 1);
const ICO = new THREE.IcosahedronGeometry(1, 0);
const OCT = new THREE.OctahedronGeometry(1, 0);
const RING = new THREE.RingGeometry(0.8, 1, 32);
const CONFETTI = ['#ff6f61', '#ffd23f', '#56c27e', '#4fc3e8', '#c77dd8', '#ff9f43', '#ffffff'];

function spawn(geo, color, pos, o) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
  m.position.copy(pos);
  m.scale.setScalar(o.size ?? 0.1);
  if (o.flat) m.rotation.x = -Math.PI / 2;
  G.scene.add(m);
  parts.push({ m, v: o.v || new THREE.Vector3(), spin: o.spin || new THREE.Vector3(), g: o.g ?? 0, life: o.life, max: o.life, grow: o.grow ?? 0, drag: o.drag ?? 0, size: o.size ?? 0.1 });
}

export function confetti(pos, n = 46) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3.2;
    spawn(BOX, CONFETTI[i % CONFETTI.length], new THREE.Vector3(pos.x, pos.y + 0.6, pos.z), {
      size: 0.13, v: new THREE.Vector3(Math.cos(a) * s, 5 + Math.random() * 4, Math.sin(a) * s),
      spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), g: 9, life: 1.6 + Math.random() * 0.8, drag: 1.2,
    });
  }
  for (const p of parts.slice(-n)) p.m.scale.set(0.16, 0.03, 0.1);
  ring(pos, '#ffd23f', 3.2);
  if (G.hooks.feel) G.hooks.feel('party', pos, n); // titreşim, büyük kutlamada hafif sarsıntı (his.js)
}

export function dust(pos) {
  spawn(ICO, '#efe4cc', new THREE.Vector3(pos.x + (Math.random() - 0.5) * 0.3, pos.y + 0.08, pos.z + (Math.random() - 0.5) * 0.3), {
    size: 0.09, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4), life: 0.45, grow: 0.35, drag: 2,
  });
}

// koşu tozu: ayağın arkasında yumuşak kenarlı toz bulutçukları. Küçük ve yoğun doğar, büyüyüp hafifçe yükselir, geride
// kalıp söner (duman gibi). Üç farklı bulut dokusu, her bulutçuk kendi saydamlığı ve dönüşüyle. Telefon için en çok 70 tane
const PUFFS = [], PUFF_TEX = [];
function puffTex() {
  // karikatür toz bulutu (2026-10-28 kullanıcı: "tozu beyaz, bir tık karikatür, çizim gibi"): üst üste beyaz yuvarlaklar,
  // dışta ince gri-mavi kontur, altta hafif gölge hilali. Yumuşak duman yerine çizgi film bulutçuğu
  if (!PUFF_TEX.length) for (let k = 0; k < 3; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    const blobs = [[48, 54, 22], [30 + k * 2, 58, 15], [66 - k, 57, 16], [40, 38 - k, 15], [58, 38 + k, 14]];
    g.fillStyle = '#9fb0c4'; for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r + 3.5, 0, Math.PI * 2); g.fill(); } // kontur
    g.fillStyle = '#ffffff'; for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(150,170,200,0.32)'; // altta gölge
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x + 2, y + r * 0.55, r * 0.85, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff'; for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x - 1, y - 2, r * 0.82, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(40, 36, 4, 0, Math.PI * 2); g.fill(); // parlama noktası
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; PUFF_TEX.push(t);
  }
  return PUFF_TEX[(Math.random() * 3) | 0];
}
const DUST_COL = ['#ffffff', '#f6f8fc', '#ffffff', '#eef2f8']; // beyaz karikatür toz (kontur dokuda) // açık toprak rengi: çimde de taşta da seçilir
export function smoke(pos, o = {}) {
  if (PUFFS.length >= 70) return;
  const mat = new THREE.SpriteMaterial({ map: puffTex(), color: o.color || DUST_COL[(Math.random() * DUST_COL.length) | 0], transparent: true, depthWrite: false, opacity: 0, rotation: Math.random() * Math.PI * 2 });
  const m = new THREE.Sprite(mat), s0 = o.size ?? 0.28;
  m.position.set(pos.x + (Math.random() - 0.5) * 0.2, 0, pos.z + (Math.random() - 0.5) * 0.2);
  m.scale.setScalar(s0);
  m.renderOrder = 2;
  G.scene.add(m);
  const v = o.v ? o.v.clone() : new THREE.Vector3();
  v.x += (Math.random() - 0.5) * 0.5; v.z += (Math.random() - 0.5) * 0.5; v.y += 0.25 + Math.random() * 0.3;
  const life = (o.life ?? 1.0) * (0.85 + Math.random() * 0.3);
  PUFFS.push({ m, v, life, max: life, s0, s1: s0 * (o.grow ?? 3.2), a: o.alpha ?? 0.5, spin: (Math.random() - 0.5) * 1.2, y0: (pos.y || 0) + 0.04, rise: 0 });
}
function updateSmoke(dt) {
  for (let i = PUFFS.length - 1; i >= 0; i--) {
    const p = PUFFS[i];
    p.life -= dt;
    if (p.life <= 0) { G.scene.remove(p.m); p.m.material.dispose(); PUFFS.splice(i, 1); continue; }
    const t = 1 - p.life / p.max, e = 1 - Math.pow(1 - t, 2.2); // hızlı açılır, yavaşlayarak büyür
    p.v.multiplyScalar(Math.max(0, 1 - 2.4 * dt)); p.v.y += 0.12 * dt; // yavaşlar, sıcak toz gibi hafifçe süzülür
    p.m.position.x += p.v.x * dt; p.m.position.z += p.v.z * dt; p.rise += p.v.y * dt;
    let s = p.s0 + (p.s1 - p.s0) * e;
    if (t > 0.7) s *= 1 - (t - 0.7) * 0.6; // karikatür bulut: sonunda biraz büzülerek kaybolur
    p.m.scale.setScalar(s);
    p.m.position.y = p.y0 + p.rise + s * 0.36; // bulut büyürken altı yere gömülmez
    p.m.material.rotation += p.spin * dt;
    p.m.material.opacity = Math.min(1, (p.a + 0.15) * Math.min(1, t / 0.05) * (t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45))); // dolu görünür, sonda söner
  }
}

export function sparkle(pos, color = '#ffe14d', n = 6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    spawn(OCT, color, new THREE.Vector3(pos.x, pos.y + 0.4 + Math.random() * 0.6, pos.z), {
      size: 0.08, v: new THREE.Vector3(Math.cos(a) * 1.4, 1.5 + Math.random() * 2, Math.sin(a) * 1.4),
      spin: new THREE.Vector3(0, 8, 4), g: 4, life: 0.55, drag: 1.5,
    });
  }
}

export function ring(pos, color = '#ffffff', r = 1.6) {
  spawn(RING, color, new THREE.Vector3(pos.x, (pos.y || 0) + 0.08, pos.z), { size: 0.2, flat: true, life: 0.6, grow: r / 0.6 });
}

export function updateFx(dt) {
  updateSmoke(dt);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { G.scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); continue; }
    p.v.y -= p.g * dt;
    if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
    p.m.position.addScaledVector(p.v, dt);
    if (p.m.position.y < 0.03 && p.g) { p.m.position.y = 0.03; p.v.set(0, 0, 0); p.spin.set(0, 0, 0); }
    p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt; p.m.rotation.z += p.spin.z * dt;
    if (p.grow) p.m.scale.addScalar(p.grow * dt);
    p.m.material.opacity = Math.min(1, p.life / Math.min(0.4, p.max * 0.6));
  }
}
