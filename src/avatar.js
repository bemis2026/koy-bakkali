// Oyuncunun kalabalıkta hemen seçilsin diye başının üstünde süzülüp dönen ok, ayağının altında nabız atan halka.
// Yönlendirme işaretinden (alerts.js, sarı) ayrılsın diye gök mavisi.
// Ok taşınan yığının tepesinin üstünde durur ve her şeyin üstünde çizilir (2026-11-01, kullanıcı: "taşırken avatarın üstünde
// git gel oluyor, kararıp normalleşiyor": sabit 2,85 m'deki ok uzun yığının içinde kalıp inip çıktıkça ürünlerin arkasında kayboluyordu)
import * as THREE from 'three';
import { G } from './game.js';

const COL = '#38c6ff';
const TMP = new THREE.Vector3();
let mark = null;
function build() {
  mark = new THREE.Group();
  const glow = new THREE.MeshStandardMaterial({ color: COL, emissive: COL, emissiveIntensity: 0.45, roughness: 0.4 });
  const edge = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  // aşağı bakan ok: koni ucu ve kısa gövde, arkasında beyaz kenarlık için biraz büyük ikiz
  const arrow = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 4), glow); tip.rotation.x = Math.PI; tip.position.y = 0.0;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.14), glow); shaft.position.y = 0.32;
  const rim = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.5, 4), edge); rim.rotation.x = Math.PI; rim.position.y = 0.01; rim.scale.set(1, 1, 0.6);
  arrow.add(rim, tip, shaft);
  for (const m of [tip, shaft, rim]) { m.castShadow = false; m.material.depthTest = false; m.renderOrder = m === rim ? 10 : 11; }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 40), new THREE.MeshBasicMaterial({ color: COL, transparent: true, opacity: 0.7, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 4;
  mark.add(arrow, ring);
  mark.userData = { arrow, ring };
  G.scene.add(mark);
}

export function updateAvatarMark(dt) {
  if (!G.player || !G.scene) return;
  if (!mark) build();
  const p = G.player.position, { arrow, ring } = mark.userData, t = G.time;
  mark.position.set(p.x, 0, p.z);
  mark.visible = !G.mini; // mini oyunda oyuncu gizli, kamera çadırda (minioyun.js)
  // yığının tepesi: tutma noktası + ürünlerin boyu; ok onun 0,45 m üstüne yumuşakça çıkar, yığın bitince iner
  let top = 2.85;
  const st = G.stack;
  if (st && st.items.length) { let h = 0; for (const it of st.items) h += it.h; top = Math.max(top, st.anchor.getWorldPosition(TMP).y - p.y + h + 0.45); }
  mark.userData.top = mark.userData.top == null ? top : mark.userData.top + (top - mark.userData.top) * Math.min(1, dt * 6);
  arrow.position.y = mark.userData.top + Math.sin(t * 3.2) * 0.14 + p.y;
  arrow.rotation.y += dt * 2.2;
  ring.position.y = p.y + 0.05;
  const k = (t * 0.9) % 1; // halka dışa doğru açılıp söner
  ring.scale.setScalar(0.85 + k * 0.5);
  ring.material.opacity = 0.75 * (1 - k);
}
