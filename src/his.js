// Oyun hissi (bitirme planı, 2 Kasım 2026): telefonda titreşim, büyük anlarda hafif ekran sarsıntısı, seviye ışığı ve açılış tozu.
// Titreşim Ayarlar > 📳 Titreşim ile kapanır (settings.haptic). Cihazda "hareketi azalt" seçiliyse ekran sarsılmaz.
// game.js ve fx.js buraya G.hooks.feel üzerinden ulaşır (doğrudan içe aktarsalar döngü olurdu).
import * as THREE from 'three';
import { G } from './game.js';
import { settings } from './audio.js';
import { sparkle, ring, smoke } from './fx.js';

export const CAN_VIBRATE = typeof navigator !== 'undefined' && 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches;
const CALM = matchMedia('(prefers-reduced-motion: reduce)');
let hT = 0, busy = 0;
// gap: art arda gelen kısa tıkların arası (para toplarken saniyede onlarca çağrı gelir). gap 0: büyük an, her zaman çalar.
// Yeni titreşim öncekini keser; o yüzden büyük anın deseni bitene kadar kısa tıklar beklemede kalır (busy)
export function haptic(p, gap = 60) {
  if (!CAN_VIBRATE || settings.haptic === false || document.hidden) return;
  const now = performance.now();
  if (gap && (now - hT < gap || now < busy)) return;
  hT = now; busy = now + (Array.isArray(p) ? p.reduce((x, y) => x + y, 0) : p);
  try { navigator.vibrate(p); } catch (e) { /* tarayıcı izin vermedi */ }
}

// sarsıntı: kamera her karede main.js'te yeniden kurulur. Çizimin ilk parçası (görünmez, renderOrder en önde) kameraya küçük bir
// kayma ekler, çizim bitince (scene.onAfterRender) geri alınır; kamera takibi ve etiketler bozulmaz. scene.onBeforeRender
// kullanılmaz: perf.js karakter senkronu (syncChars) onu her karede kendine geri alıyor. Süre gerçek saatle sayılır.
let amp = 0, dur = 1, end = 0, shaker = null;
const off = new THREE.Vector3();
export function shake(a, d = 0.4) {
  if (CALM.matches || !G.scene) return;
  const now = performance.now(), cur = end > now ? amp * ((end - now) / dur) ** 2 : 0;
  if (a < cur) return; // daha güçlü bir sarsıntı sürüyor
  amp = a; dur = d * 1000; end = now + dur;
  if (shaker && shaker.parent) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)); // tek nokta: ekranda iz bırakmaz
  shaker = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false }));
  shaker.frustumCulled = false; shaker.renderOrder = -1e9; shaker.castShadow = shaker.receiveShadow = false;
  shaker.userData.sd = true; shaker.userData.bkNo = true; // boy taraması ve birleştirme dokunmasın (perf.js)
  shaker.onBeforeRender = (r, s, cam) => {
    const now = performance.now();
    if (now >= end || cam !== G.camera || off.lengthSq() > 0) return;
    const k = ((end - now) / dur) ** 2, t = now * 0.001, a = amp * k;
    off.set(Math.sin(t * 61) + Math.sin(t * 37) * 0.5, Math.sin(t * 53 + 1) * 0.6, Math.cos(t * 47) + Math.sin(t * 29) * 0.5).multiplyScalar(a);
    cam.position.add(off); cam.updateMatrixWorld();
  };
  G.scene.add(shaker);
  const prev = G.scene.onAfterRender;
  G.scene.onAfterRender = function (r, s, cam) {
    prev.call(this, r, s, cam);
    if (off.lengthSq() === 0) return;
    G.camera.position.sub(off); G.camera.updateMatrixWorld(); off.set(0, 0, 0);
  };
}

// seviye ışığı: oyuncunun üstünde yükselip sönen altın ışık sütunu. Kendi çiziminde (onBeforeRender) canlanır, ekrandan
// çıksa da zamanlayıcı onu kaldırır
let BEAM = null;
function beam(pos) {
  if (!BEAM) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(255,240,170,0)'); gr.addColorStop(0.55, 'rgba(255,226,110,0.55)'); gr.addColorStop(1, 'rgba(255,214,80,0.95)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    BEAM = { geo: new THREE.CylinderGeometry(0.9, 1.25, 7, 24, 1, true).translate(0, 3.5, 0), tex };
  }
  const m = new THREE.Mesh(BEAM.geo, new THREE.MeshBasicMaterial({ map: BEAM.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, opacity: 0 }));
  m.position.set(pos.x, 0.02, pos.z); m.renderOrder = 3;
  const t0 = performance.now(), life = 1700;
  const kill = () => { if (!m.parent) return; m.parent.remove(m); m.material.dispose(); };
  m.onBeforeRender = () => {
    const t = (performance.now() - t0) / life;
    if (t >= 1) { kill(); return; }
    m.material.opacity = Math.min(1, t * 6) * (1 - t) ** 1.5;
    m.scale.set(1 - t * 0.45, 0.4 + Math.min(1, t * 3) * 0.6, 1 - t * 0.45);
    m.rotation.y = t * 2;
    m.position.set(G.player.position.x, 0.02, G.player.position.z); // oyuncu yürürse ışık onunla gelir
  };
  G.scene.add(m);
  setTimeout(kill, life + 200);
}

// açılış tozu: yeni yerin etrafında dışa doğru savrulan karikatür toz halkası (fx.js smoke)
function dustRing(pos, n, r, s) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
    smoke({ x: pos.x + Math.cos(a) * r, y: pos.y || 0, z: pos.z + Math.sin(a) * r }, { v: new THREE.Vector3(Math.cos(a) * s, 0, Math.sin(a) * s), size: 0.45, grow: 3.4, life: 1.1, alpha: 0.6 });
  }
}

const near = (pos) => !pos || !G.player || Math.hypot(pos.x - G.player.position.x, pos.z - G.player.position.z) < 18;
// oyunun büyük ve küçük anları: kind'a göre titreşim, sarsıntı ve ek parçacık
export function feel(kind, pos, n = 0) {
  switch (kind) {
    case 'level':
      shake(0.32, 0.6); haptic([30, 60, 30, 60, 70], 0);
      beam(G.player.position); sparkle(G.player.position, '#ffe14d', 16); ring(G.player.position, '#ffd23f', 5);
      break;
    case 'region':
      shake(0.42, 0.75); haptic([40, 50, 90], 0);
      if (pos) { dustRing(pos, 16, 1.6, 4.2); ring(pos, '#ffffff', 6); }
      break;
    case 'unlock':
      shake(0.2, 0.4); haptic([25, 40, 25], 0);
      if (pos) { dustRing(pos, 10, 1.0, 3.2); ring(pos, '#ffffff', 3.6); }
      break;
    case 'hire': haptic([15, 40, 15], 0); break;
    case 'buy':
      haptic(18, 0);
      if (pos) { sparkle(pos, '#ffe14d', 8); ring(pos, '#ffe14d', 1.4); }
      break;
    case 'party': // fx.js konfetisi: başarım, hırsız yakalama, mini oyun, araba siparişi... büyüklüğüne göre
      if (!near(pos)) return;
      if (n >= 40) { shake(0.12, 0.3); haptic([20, 40, 20]); } else haptic(16);
      break;
    case 'pay': haptic(6, 130); break; // kilit pedine para akarken
    case 'coin': haptic(5, 150); break; // kasadan para toplarken
    case 'bad': haptic([12, 50, 12], 300); break;
  }
}
G.hooks.feel = feel;
