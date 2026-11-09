// Açık salon: işin yapıldığı bina, makinelerini ve tezgâhlarını içine alan, köy bakkalı gibi önü ve üstü açık bir yer olur
// (2026-11-04 kullanıcı: "fırını ve diğer evleri köy bakkalı gibi önü ya da üstü açık kapalı bir alan yap, dışındaki nesneleri içine al").
// Kamera güneyden bakar: arka duvar kuzeyde (zb < zf), sıvalı, kesilmiş çatının saçağıyla; iki yan duvar öne doğru alçalır ki içerisi
// her açıdan görünsün; önü açık ya da alçak duvarlı. Fırın (carsi.js) ve dokuma atölyesi (world.js, duvarsız) kullanır
import * as THREE from 'three';
import * as M from './models.js';
import { texRep, plasterOf } from './tex.js';

// gaps: arka duvardaki kapı boşlukları [[x0, x1]]; sides: [batı, doğu] yan duvar var mı (yoksa o yan da açık); front: ön duvarın boyu (0: önü açık, köşelerde saksı); floor: [doku, renk, karo boyu]
// sideZ: [batı, doğu] yan duvarın ön ucu (salonun önünden kaldırım geçiyorsa duvar kaldırımın gerisinde biter); verilmezse zf
// eave: arka duvarın üstündeki kesilmiş çatı saçağı; walls: false yalnız döşeme ve ön köşelerde saksı (2026-11-09: dokuma atölyesi duvarsız)
// döner: { g, cols }; cols engel kutuları [x0, x1, z0, z1] (çağıran kendi rcol'üyle ekler)
export function makeHall({ x0, x1, zb, zf, H = 3.4, HF = 1.2, band = '#c9805a', side = '#f6ead2', floor = ['tiles', '#f2cfa2', 1.6], gaps = [], sides = [true, true], front = 0, sideZ = null, eave = true, walls = true }) {
  const g = new THREE.Group(), W = x1 - x0, cx = (x0 + x1) / 2, D = zf - zb, cols = [];
  const sideM = M.mat(side), tile = M.mat('#ffffff', { map: texRep('roof', W / 2.4, 1) }), brick = M.mat('#e3d2b4', { map: texRep('brick', D / 2.2, 0.5) });
  M.rbox(W - 0.3, 0.04, D - 0.15, 0.01, M.mat(floor[1], { map: texRep(floor[0], W / floor[2], D / floor[2]) }), cx, 0.02, (zb + zf) / 2 + 0.07, g);
  // arka duvar: kapı boşlukları arasında parça parça
  let a = x0 - 0.15;
  for (const [g0, g1] of walls ? [...gaps, [x1 + 0.15, x1 + 0.15]] : []) {
    const w = g0 - a;
    if (w > 0.05) {
      const m = new THREE.MeshStandardMaterial({ map: plasterOf(band, w / 3.2, 1), roughness: 0.85 });
      M.rbox(w, H, 0.3, 0.06, m, a + w / 2, H / 2, zb, g); cols.push([a, g0, zb - 0.2, zb + 0.2]);
    }
    a = g1;
  }
  if (eave && walls) M.rbox(W + 0.9, 0.16, 1.15, 0.04, tile, cx, H + 0.02, zb + 0.32, g).rotation.x = 0.2; // kesilmiş çatının kalan saçağı
  // yan duvarlar: arkada tam boy, öne doğru alçalır
  const fz = (i) => (sideZ ? sideZ[i] : zf);
  [x0, x1].forEach((x, i) => {
    if (!sides[i] || !walls) return;
    const f = fz(i), sh = new THREE.Shape([[zb - 0.15, 0], [f, 0], [f, HF], [zb + 1.6, H], [zb - 0.15, H]].map(([p, q]) => new THREE.Vector2(p, q)));
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }), sideM); m.rotation.y = -Math.PI / 2; m.position.x = x + 0.15; g.add(m);
    const L = Math.hypot(f - zb - 1.6, H - HF), ang = Math.atan2(H - HF, f - zb - 1.6);
    M.rbox(0.44, 0.12, L + 0.1, 0.03, tile, x, (H + HF) / 2 + 0.06, (f + zb + 1.6) / 2, g).rotation.x = ang; // duvar başlığı
    M.rbox(0.44, 0.12, 1.75, 0.03, tile, x, H + 0.06, zb + 0.72, g);
    M.rbox(0.36, 0.5, f - zb - 0.2, 0.02, brick, x, 0.25, (zb + f) / 2 + 0.05, g); // tuğla etek
    cols.push([x - 0.2, x + 0.2, zb - 0.2, f]);
  });
  if (front) { // alçak ön duvar, kiremit başlıklı
    M.rbox(W + 0.3, front, 0.3, 0.05, sideM, cx, front / 2, zf, g);
    M.rbox(W + 0.44, 0.1, 0.44, 0.03, tile, cx, front + 0.05, zf, g);
    cols.push([x0, x1, zf - 0.2, zf + 0.2]);
  } else { // ön köşelerde saksılar (köy bakkalı gibi)
    for (const x of [x0 + 0.55, x1 - 0.55].filter((_, i) => !walls || (sides[i] && fz(i) >= zf))) {
      M.cyl(0.32, 0.26, 0.5, 10, M.mat('#c96f4a'), x, 0.25, zf - 0.45, g);
      M.mesh(new THREE.IcosahedronGeometry(0.42, 0), M.mat('#4f9a3f', { rough: 0.8 }), x, 0.78, zf - 0.45, g);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, cols };
}
