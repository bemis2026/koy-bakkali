// Gökyüzü: ara sıra başın üstünden kuş sürüsü geçer (gölgesi yere düşer, kanat sesi duyulur);
// deniz üstünde martılar daire çizip süzülür, arada kanat çırpar ve çığlık atar (ses ortam ayarına bağlı).
import * as THREE from 'three';
import { G } from './game.js';
import { tagAnimal } from './models.js';
import { flockSound, gullCall } from './ambience.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const SHORE_Z = 31.6;
let root = null, M = null, BODY = null, WING = null, TIP = null;
const flocks = [], gulls = [];
let flockT = 30, gullCx = 15;

function init() {
  root = new THREE.Group();
  G.scene.add(root);
  M = {
    dark: new THREE.MeshStandardMaterial({ color: '#5a5360', roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
    white: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true }),
    grey: new THREE.MeshStandardMaterial({ color: '#c4ccd6', roughness: 0.8, flatShading: true, side: THREE.DoubleSide }),
    black: new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.8, flatShading: true, side: THREE.DoubleSide }),
    beak: new THREE.MeshStandardMaterial({ color: '#f6b12a', roughness: 0.7 }),
  };
  BODY = new THREE.SphereGeometry(0.16, 8, 6);
  const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3)); g.computeVertexNormals(); return g; };
  // kanat: gövdeye bağlı kök ve geriye yatık uç (+x yönünde; sol kanat aynalanır)
  WING = tri([0, 0, 0.16, 0, 0, -0.14, 0.62, 0, -0.1, 0, 0, 0.16, 0.62, 0, -0.1, 0.5, 0, 0.06]);
  TIP = tri([0.5, 0.002, 0.06, 0.62, 0.002, -0.1, 0.78, 0.002, -0.06]);
  for (let i = 0; i < 5; i++) gulls.push(makeGull());
  if (G.hooks) G.hooks.flock = spawnFlock; // test: sürüyü hemen gönder
}

function makeBird(gull) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const body = new THREE.Mesh(BODY, gull ? M.white : M.dark); body.scale.set(0.7, 0.6, 1.7); g.add(body);
  const head = new THREE.Mesh(BODY, gull ? M.white : M.dark); head.scale.setScalar(0.55); head.position.set(0, 0.04, 0.26); g.add(head);
  if (gull) { const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), M.beak); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.03, 0.39); g.add(beak); }
  const wings = [];
  for (const sx of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(sx * 0.07, 0.03, 0.02); g.add(pv);
    const w = new THREE.Mesh(WING, gull ? M.grey : M.dark); w.scale.x = sx; pv.add(w);
    if (gull) { const t = new THREE.Mesh(TIP, M.black); t.scale.x = sx; pv.add(t); }
    pv.userData.sx = sx;
    wings.push(pv);
  }
  g.userData.wings = wings;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(g);
  return g;
}
function flap(b, ang) { for (const w of b.userData.wings) w.rotation.z = w.userData.sx * ang; }

function makeGull() { const g = rawGull(); tagAnimal(g.o, 'marti'); return g; } // albüm: hayvan kaydı (album.js)
function rawGull() {
  const o = makeBird(true);
  o.scale.setScalar(rnd(1.0, 1.2));
  return { o, r: rnd(3.5, 9), w: rnd(0.22, 0.4) * (Math.random() < 0.5 ? -1 : 1), h: rnd(5.5, 8.5), ph: rnd(0, Math.PI * 2), dz: rnd(2.5, 6), flapT: rnd(0, 4), callT: rnd(3, 10) };
}

function spawnFlock() {
  const c = G.player.position, a = rnd(0, Math.PI * 2), dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-dir.z, 0, dir.x);
  const pos = c.clone().addScaledVector(dir, -50).addScaledVector(side, rnd(-9, 9)); pos.y = rnd(5.5, 7); // alçakta: kameraya yakın uçan kuş ekranda çok hızlı kayıp böcek gibi görünüyordu
  const n = 4 + Math.floor(Math.random() * 4), birds = [];
  for (let i = 0; i < n; i++) {
    const b = makeBird(false), row = Math.ceil(i / 2), s = i % 2 ? 1 : -1; // V düzeni
    b.scale.setScalar(rnd(0.85, 1.0)); // kuş olduğu seçilsin
    b.userData.off = new THREE.Vector3().addScaledVector(dir, -row * 1.4 + rnd(-0.3, 0.3)).addScaledVector(side, s * row * 1.2 + rnd(-0.3, 0.3));
    b.userData.off.y = rnd(-0.5, 0.5); b.userData.ph = rnd(0, 6);
    birds.push(b);
  }
  flocks.push({ pos, dir, speed: rnd(2.2, 3.0), birds, left: 100, called: false }); // ağır ağır süzülür: ekranı birkaç saniyede geçer
}

export function updateBirds(dt) {
  if (!G.scene || !G.player) return;
  if (!root) init();
  const p = G.player.position, t = G.time;
  // kuş sürüsü. 2026-11-08 kullanıcı: "Şehir marketi bölümünde havada uçan kuşları kaldır": şehirde (x 300..700) sürü doğmaz,
  // şehre girerken havadaki sürü silinir (martılar zaten köy kıyısında kalır)
  const city = p.x > 300 && p.x < 700;
  flockT -= dt;
  if (flockT <= 0) { flockT = rnd(60, 110); if (!city) spawnFlock(); }
  if (city) while (flocks.length) { for (const b of flocks[0].birds) root.remove(b); flocks.shift(); }
  for (let i = flocks.length - 1; i >= 0; i--) {
    const f = flocks[i], step = f.speed * dt;
    f.pos.addScaledVector(f.dir, step); f.left -= step;
    const yaw = Math.atan2(f.dir.x, f.dir.z);
    for (const b of f.birds) {
      const u = b.userData;
      b.position.copy(f.pos).add(u.off); b.position.y += Math.sin(t * 2 + u.ph) * 0.15;
      b.rotation.y = yaw;
      flap(b, (t * 0.35 + u.ph) % 1 < 0.45 ? Math.sin(t * 6 + u.ph) * 0.55 : 0.14); // birkaç kanat çırpışı, sonra süzülme
    }
    const dx = f.pos.x - p.x, dz = f.pos.z - p.z;
    if (!f.called && Math.hypot(dx, dz) < 13) { f.called = true; flockSound(0.05, Math.max(-1, Math.min(1, dx / 14))); }
    if (f.left <= 0) { for (const b of f.birds) root.remove(b); flocks.splice(i, 1); }
  }
  // martılar: kıyının hemen açığında, oyuncunun hizasında daire çizer
  gullCx += (Math.max(-45, Math.min(103, p.x)) - gullCx) * Math.min(1, dt * 0.3);
  const near = Math.max(0, 1 - Math.max(0, SHORE_Z - 4 - p.z) / 22); // kıyıya yaklaştıkça çığlıklar duyulur
  for (const g of gulls) {
    g.ph += g.w * dt;
    const cx = gullCx + Math.cos(g.ph) * g.r, cz = SHORE_Z + g.dz + Math.sin(g.ph) * g.r * 0.55;
    const vx = -Math.sin(g.ph) * g.r * g.w, vz = Math.cos(g.ph) * g.r * 0.55 * g.w;
    g.o.position.set(cx, g.h + Math.sin(t * 0.7 + g.ph) * 0.4, cz);
    g.o.rotation.y = Math.atan2(vx, vz);
    g.o.rotation.z = -Math.sign(g.w) * 0.35; // dönüşe yatar
    // çoğunlukla süzülür, arada bir saniye kanat çırpar
    g.flapT -= dt;
    if (g.flapT < 0) { flap(g.o, Math.sin(t * 9 + g.ph) * 0.55); if (g.flapT < -1.1) g.flapT = rnd(3, 7); } else flap(g.o, 0.12);
    g.callT -= dt;
    if (g.callT <= 0) {
      g.callT = rnd(7, 16);
      const d = Math.hypot(cx - p.x, cz - p.z);
      if (near > 0.05 && d < 30) gullCall(0.05 * near * (1 - d / 34), Math.max(-1, Math.min(1, (cx - p.x) / 16)));
    }
  }
}
