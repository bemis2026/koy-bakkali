// Su izi (2026-11-08 kullanıcı: "yunusları geliştir sudaki ... suda iz bıraksın su etkisi olsun"): yüzen yunusun, binilen yunusun ve
// jetskinin arkasında köpük izi, iki yana açılan dalga (V izi), sıçrayışta ve suya dalışta köpük halkası ve damlalar.
// Telefon için iki çizim: bütün köpük lekeleri ve halkalar tek InstancedMesh (saydamlık örnek başına), damlalar tek InstancedMesh.
// Kimse iz bırakmıyorsa hiçbir şey hesaplanmaz.
import * as THREE from 'three';
import { G } from './game.js';

const NF = 240, ND = 120, Y = 0.05; // köpük deniz yüzeyinin (−0,1, dalga ±0,14) üstünde
const F = [], D = [];
let foam = null, drops = null, fade = null, kind = null, live = false;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

function build() {
  const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
  fade = new THREE.InstancedBufferAttribute(new Float32Array(NF), 1); fade.setUsage(THREE.DynamicDrawUsage);
  kind = new THREE.InstancedBufferAttribute(new Float32Array(NF), 1); kind.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aFade', fade); geo.setAttribute('aKind', kind);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    vertexShader: `#include <common>
#include <fog_pars_vertex>
attribute float aFade; attribute float aKind;
varying vec2 vUv; varying float vFade; varying float vKind;
void main() {
  vUv = uv; vFade = aFade; vKind = aKind;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    // 0: köpük lekesi (kabarcıklı yumuşak leke), 1: halka
    fragmentShader: `#include <common>
#include <fog_pars_fragment>
varying vec2 vUv; varying float vFade; varying float vKind;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  vec2 w = vUv * 6.2832;
  float n = 0.5 + 0.5 * sin(w.x * 3.7 + sin(w.y * 2.9) * 1.6) * sin(w.y * 3.1 + sin(w.x * 2.3) * 1.6); // yumuşak köpük damarları
  float a = vKind < 0.5 ? smoothstep(1.0, 0.4, r) * (0.45 + 0.55 * smoothstep(0.3, 0.62, n)) : smoothstep(0.58, 0.8, r) * smoothstep(1.0, 0.86, r);
  a *= vFade;
  if (a < 0.01) discard;
  gl_FragColor = vec4(1.0, 1.0, 1.0, a);
  #include <fog_fragment>
}`,
    transparent: true, depthWrite: false, fog: true,
  });
  foam = new THREE.InstancedMesh(geo, mat, NF);
  foam.instanceMatrix.setUsage(THREE.DynamicDrawUsage); foam.count = 0; foam.frustumCulled = false; foam.renderOrder = 2;
  drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#f2faff' }), ND);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); drops.count = 0; drops.frustumCulled = false;
  for (const o of [foam, drops]) { o.userData.bkNo = true; G.scene.add(o); }
}
function add(o) {
  if (!foam) build();
  if (F.length >= NF) F[Math.floor(Math.random() * NF)] = o; else F.push(o);
  live = true;
}

// yüzenin arkasında uzunlamasına köpük lekesi (ry: gidiş yönü, w: genişlik)
export function trail(x, z, ry, w = 1, life = 2.2) {
  add({ x, z, ry, vx: 0, vz: 0, s0: 0.45 * w, s1: 1.35 * w, k: 1.9, life, max: life, t: 0, a: 0.7 });
}
// iki yana açılan dalga: hızla birlikte büyür (k: boy çarpanı, gemide 3)
export function wake(x, z, ry, sp, k = 1) {
  const c = Math.cos(ry), s = Math.sin(ry), v = Math.min(2.2, 0.6 + sp * 0.12) * Math.sqrt(k), life = 1.6 * Math.sqrt(k);
  for (const sg of [-1, 1]) add({ x: x + c * 0.3 * k * sg, z: z - s * 0.3 * k * sg, ry: ry + 0.55 * sg, vx: c * v * sg, vz: -s * v * sg, s0: 0.3 * k, s1: 1.1 * k, k: 2.6, life, max: life, t: 0, a: 0.5 });
}
export function foamRing(x, z, r = 1.4) {
  add({ x, z, ry: 0, vx: 0, vz: 0, s0: 0.25, s1: r * 2, k: 1, life: 0.9, max: 0.9, t: 1, a: 0.9 });
}
// sıçrama: damlalar, köpük halkası ve leke
export function splash(x, z, n = 10, up = 3.2, ry = 0) {
  if (!foam) build();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.6, life = 0.6 + Math.random() * 0.5;
    const o = { x, y: Y, z, vx: Math.cos(a) * sp + Math.sin(ry) * 0.8, vy: up * (0.55 + Math.random() * 0.6), vz: Math.sin(a) * sp + Math.cos(ry) * 0.8, s: 0.045 + Math.random() * 0.05, life, max: life };
    if (D.length >= ND) D[Math.floor(Math.random() * ND)] = o; else D.push(o);
  }
  foamRing(x, z, 1.0 + n * 0.06);
  add({ x, z, ry, vx: 0, vz: 0, s0: 0.5, s1: 1.8, k: 1.2, life: 1.8, max: 1.8, t: 0, a: 0.75 });
}

export function updateIz(dt) {
  if (!live) return;
  let n = 0;
  for (let i = F.length - 1; i >= 0; i--) {
    const f = F[i];
    f.life -= dt;
    if (f.life <= 0) { F[i] = F[F.length - 1]; F.pop(); continue; }
    const u = 1 - f.life / f.max, e = 1 - (1 - u) * (1 - u), s = f.s0 + (f.s1 - f.s0) * e;
    const drag = Math.max(0, 1 - 2 * dt); f.vx *= drag; f.vz *= drag; f.x += f.vx * dt; f.z += f.vz * dt;
    _m.compose(_p.set(f.x, Y, f.z), _q.setFromAxisAngle(UP, f.ry), _s.set(s, 1, s * f.k));
    foam.setMatrixAt(n, _m);
    fade.array[n] = f.a * Math.min(1, u / 0.08) * Math.pow(1 - u, 1.4);
    kind.array[n] = f.t;
    n++;
  }
  foam.count = n;
  if (n) { foam.instanceMatrix.needsUpdate = true; fade.needsUpdate = true; kind.needsUpdate = true; }
  let m = 0;
  _q.identity();
  for (let i = D.length - 1; i >= 0; i--) {
    const d = D[i];
    d.life -= dt; d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    if (d.life <= 0 || d.y < Y - 0.15) { D[i] = D[D.length - 1]; D.pop(); continue; }
    _m.compose(_p.set(d.x, d.y, d.z), _q, _s.setScalar(d.s * Math.sqrt(d.life / d.max)));
    drops.setMatrixAt(m++, _m);
  }
  drops.count = m;
  if (m) drops.instanceMatrix.needsUpdate = true;
  live = n > 0 || m > 0;
}
// adadan çıkınca izleri sil
export function clearIz() { F.length = 0; D.length = 0; if (foam) { foam.count = 0; drops.count = 0; } live = false; }
if (typeof window !== 'undefined') window.__iz = () => ({ foam: F.length, drops: D.length });
