// Deniz: yüzey dalgaları (gölgelendiricide yer değiştirme ve normal), kıyıya doğru ilerleyip sönen köpük çizgileri.
// Yüzücüler: suya girince yatıp kulaç atar (bazıları sırtüstü), bulundukları yerde yavaşça dolaşır, arada su sıçratır.
import * as THREE from 'three';
import { G, rand, lerpAngle } from './game.js';
import { coastZ, bandGeo } from './nature.js';
import { ring } from './fx.js';

const U = { uTime: { value: 0 } };
const surf = [];
const SEA_Z = 131; // deniz düzleminin merkezi (world.js buildSea)

export function enhanceSea(sea) {
  sea.geometry.dispose();
  sea.geometry = new THREE.PlaneGeometry(400, 200, 200, 100);
  const m = sea.material;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    // kıyıya yakın dalgalar küçük (köpük ve kumla çakışmasın), açıkta büyür
    const waves = `
      float wz = ${SEA_Z.toFixed(1)} - position.y;
      float amp = 0.25 + 0.75 * smoothstep(33.0, 42.0, wz);
      float a1 = position.x * 0.32 + uTime * 1.05, a2 = position.y * 0.47 - uTime * 1.5 + position.x * 0.11, a3 = (position.x + position.y) * 0.85 + uTime * 2.2;`;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>${waves}
      float ddx = (cos(a1) * 0.065 * 0.32 + cos(a2) * 0.05 * 0.11 + cos(a3) * 0.022 * 0.85) * amp;
      float ddy = (cos(a2) * 0.05 * 0.47 + cos(a3) * 0.022 * 0.85) * amp;
      objectNormal = normalize(vec3(-ddx * 2.2, -ddy * 2.2, 1.0));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed.z += (sin(a1) * 0.065 + sin(a2) * 0.05 + sin(a3) * 0.022) * amp;`);
  };
  m.needsUpdate = true;
  // kıyıya koşan köpük çizgileri: açıkta belirir, kıyıya yaklaşırken incelip söner
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(bandGeo(-200, 230, (x) => coastZ(x), (x) => coastZ(x) + 0.22 + 0.12 * Math.sin(x * 0.7 + i)), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    s.position.y = -0.17; s.renderOrder = 2;
    G.scene.add(s);
    surf.push({ m: s, ph: i / 3 });
  }
}

export function updateSea(dt) {
  U.uTime.value += dt;
  for (const s of surf) {
    const k = (U.uTime.value / 4.2 + s.ph) % 1; // 0: açıkta doğar, 1: kıyıya vurur
    s.m.position.z = 4.6 * (1 - k) + 0.25;
    s.m.material.opacity = Math.min(1, k * 5) * (1 - k) * 0.75;
    s.m.scale.z = 1 + (1 - k) * 0.6;
  }
}

// ---------- yüzücüler ----------
const seaZ = (x) => coastZ(x) - 0.3;
// suya giren müşteri: karada eski hızıyla yürür, suda yavaşlar ve yatıp kulaç atar
export function enableSwim(c) {
  if (c.swimWrap) return;
  c.swimWrap = true;
  c.landSpeed = c.speed;
  c.back = Math.random() < 0.3; // sırtüstü süzülenler
  c.swimPh = rand(0, 6);
  const base = c.update.bind(c);
  c.update = (dt) => {
    const p = c.obj.position, wet = p.z > seaZ(p.x) && c.state !== 'drown';
    c.speed = wet ? 1.15 : c.landSpeed;
    base(dt);
    const u = c.obj.userData;
    if (!wet) { if (c.obj.rotation.x) c.obj.rotation.x = 0; return; }
    c.obj.rotation.order = 'YXZ';
    c.obj.rotation.x += ((c.back ? -1.2 : 1.15) - c.obj.rotation.x) * Math.min(1, dt * 4);
    const t = G.time * (c.back ? 2.6 : 4.2) + c.swimPh;
    p.y = -0.42 + Math.sin(t * 0.5) * 0.04;
    u.arms[0].rotation.x = c.back ? t : -t; u.arms[1].rotation.x = u.arms[0].rotation.x + Math.PI; // kulaç
    u.legs[0].rotation.x = Math.sin(t * 2.4) * 0.35; u.legs[1].rotation.x = -u.legs[0].rotation.x; // ayak çırpma
    c.splashT = (c.splashT || rand(0, 1.4)) - dt;
    if (c.splashT <= 0) { c.splashT = rand(1.0, 1.8); ring(new THREE.Vector3(p.x + Math.sin(c.obj.rotation.y) * 0.6, -0.15, p.z + Math.cos(c.obj.rotation.y) * 0.6), '#ffffff', 0.55); }
  };
}
// 'swim' durumunda olduğu yerde değil, çevresinde yavaşça yüzerek dolaşır
export function swimAround(c, dt) {
  const p = c.obj.position, s = c.swim;
  if (s.cx === undefined) s.cx = p.x;
  if (!s.to || Math.hypot(s.to.x - p.x, s.to.z - p.z) < 0.4) {
    const x = THREE.MathUtils.clamp(s.cx + rand(-4, 4), -12, 49);
    s.to = { x, z: coastZ(x) + rand(1.7, 5.2) };
  }
  const dx = s.to.x - p.x, dz = s.to.z - p.z, d = Math.hypot(dx, dz) || 1, st = (c.back ? 0.55 : 0.9) * dt;
  p.x += (dx / d) * st; p.z += (dz / d) * st;
  c.obj.rotation.y = lerpAngle(c.obj.rotation.y, Math.atan2(dx, dz) + (c.back ? Math.PI : 0), 1 - Math.exp(-2.5 * dt));
}
