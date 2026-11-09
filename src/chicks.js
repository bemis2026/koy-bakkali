// Civcivler: çiftlikteki her tavuğun peşinde 2-3 sarı civciv. Annesinin arkasında sekerek yürür,
// durunca yere gagalar, arada kendi başına küçük bir tur atar. Tavuklar world.js'te (köyün R.critters'ı, çiftliğe konur).
import * as THREE from 'three';
import * as M from './models.js';
import { G, popIn, rand } from './game.js';

const PI = Math.PI;

function makeChick() { return M.tagAnimal(rawChick(), 'civciv'); } // albüm: hayvan kaydı (album.js)
function rawChick() {
  const g = new THREE.Group();
  const fluff = M.mat('#ffd84a'), orange = M.mat('#ff9a2a'), black = M.mat('#2a2a2a');
  const body = M.sph(0.11, fluff, 0, 0.12, 0, g, 12, 10); body.scale.set(0.95, 0.9, 1.1);
  const head = new THREE.Group(); head.position.set(0, 0.23, 0.07); g.add(head);
  M.sph(0.075, fluff, 0, 0, 0, head, 10, 8);
  const beak = M.cyl(0, 0.025, 0.05, 5, orange, 0, -0.005, 0.085, head); beak.rotation.x = PI / 2;
  for (const sx of [-1, 1]) {
    M.sph(0.014, black, sx * 0.04, 0.025, 0.06, head, 6, 4);
    const w = M.sph(0.05, fluff, sx * 0.09, 0.12, -0.01, g, 8, 6); w.scale.set(0.4, 0.8, 1.1); // kanatçık
    M.cyl(0.008, 0.008, 0.06, 4, orange, sx * 0.035, 0.03, 0.01, g);
  }
  g.scale.setScalar(1.3); // oyunun çizgi film ölçeğinde görünsün
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.userData = { head };
  return g;
}

export function updateChicks(dt) {
  const K = G.regions.koy, F = G.regions.ciftlik;
  if (!K || !K.critters || !F || !F.unlocked) return;
  for (const k of K.critters) {
    if (k.kind !== 'chicken') continue;
    if (!k.chicks) {
      k.chicks = [];
      const n = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const c = makeChick(), a = rand(0, PI * 2);
        c.position.set(k.obj.position.x + Math.sin(a) * 0.5, 0, k.obj.position.z + Math.cos(a) * 0.5);
        F.content.add(c); popIn(c, 0.3 + i * 0.08);
        k.chicks.push({ obj: c, a: rand(-0.9, 0.9), r: rand(0.35, 0.75), t: rand(0, 2), hop: rand(0, 6) });
      }
    }
    const hen = k.obj, hp = hen.position, hy = hen.rotation.y;
    for (const c of k.chicks) {
      const o = c.obj, p = o.position, u = o.userData;
      c.t -= dt;
      if (c.t <= 0) { c.t = rand(1.2, 3.5); c.a = rand(-1.1, 1.1); c.r = rand(0.3, 0.8); } // annesinin arkasında yeni bir yer seçer
      // hedef: tavuğun arkasında, biraz yana açılmış
      const ang = hy + PI + c.a, tx = hp.x + Math.sin(ang) * c.r, tz = hp.z + Math.cos(ang) * c.r;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > 0.06) {
        const sp = Math.min(2.2, 0.6 + d * 2.5) * dt;
        p.x += (dx / d) * Math.min(sp, d); p.z += (dz / d) * Math.min(sp, d);
        let da = Math.atan2(dx, dz) - o.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
        o.rotation.y += da * Math.min(1, dt * 10);
        c.hop += dt * 18;
        p.y = Math.abs(Math.sin(c.hop)) * 0.05; // sekerek yürür
        u.head.rotation.x = 0;
      } else {
        p.y = 0;
        u.head.rotation.x = Math.max(0, Math.sin(G.time * 9 + o.id)) * 0.8; // yere gagalar
      }
    }
  }
}
