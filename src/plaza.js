// Kasaba Meydanı ve Park: köyün dışında, ana yolun kuzeyinde, İpek Yolu'nun batısında (ana yoldan girilir).
// Güneyde büyük taş meydan, ortasında fıskiye, çevresinde banklar, fenerler, güvercinler.
// Kuzeyde park: çapraz yollar, gölet ve ördekler, salıncaklı kaydıraklı oyun alanı, çiçek tarhları, ağaçlar,
// banklarda oturup yollarda gezinen kasabalılar. Ses: ambience.js 'fiskiye' ve 'kasaba' katmanları.
import * as THREE from 'three';
import * as M from './models.js';
import { G, rand, pick } from './game.js';
import { texRep } from './tex.js';
import { addBank } from './bank.js';
import { esya } from './esya.js';
import { sitOnBench } from './tepki.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PLAZA = { x: -45.5, z: -30.6, r: 7.0 };
const POND = { x: -51.2, z: -46.2, rx: 3.2, rz: 2.1 }, PLAY = { x: -39.4, z: -46.4 };

function makeSwings() {
  const g = new THREE.Group(), iron = M.mat('#e8604c', { rough: 0.5 }), seat = M.mat('#3d7dd8');
  const fr = esya('salincak'); // çerçeve modeli (esya.js, kendi oturakları atıldı); oturaklar aşağıdaki sallanan gruplar
  if (fr) g.add(fr);
  else {
    for (const x of [-1.4, 1.4]) for (const z of [-0.5, 0.5]) { const p = M.rbox(0.09, 2.3, 0.09, 0.03, iron, x, 1.1, z * 0.6, g); p.rotation.x = z * 0.35; }
    M.rbox(3.0, 0.1, 0.1, 0.03, iron, 0, 2.2, 0, g);
  }
  const swings = [];
  for (const x of fr ? [-0.68, 0.68] : [-0.6, 0.6]) { // modelde oturakların yeri ±0.68
    const s = new THREE.Group(); s.position.set(x, 2.15, 0); g.add(s);
    for (const dx of [-0.2, 0.2]) M.rbox(0.02, 1.6, 0.02, 0.005, M.mat('#cccccc'), dx, -0.8, 0, s);
    M.rbox(0.5, 0.05, 0.25, 0.02, seat, 0, -1.62, 0, s);
    swings.push(s);
  }
  g.userData.swings = swings;
  return g;
}
function makeSlide() {
  const v = esya('kaydirak'); // Poly Pizza kaydırağı (esya.js); yüklenemezse aşağıdaki çizim
  if (v) return v;
  const g = new THREE.Group(), frame = M.mat('#f6c343'), slide = M.mat('#56c27e', { rough: 0.4 });
  for (const x of [-0.4, 0.4]) for (const z of [-0.4, 0.4]) M.rbox(0.08, 1.4, 0.08, 0.02, frame, x, 0.7, z - 0.6, g);
  M.rbox(0.95, 0.08, 0.95, 0.02, frame, 0, 1.4, -0.6, g);
  for (let i = 0; i < 4; i++) M.rbox(0.8, 0.05, 0.12, 0.01, frame, 0, 0.3 + i * 0.3, -1.12 - i * 0.02, g);
  const s = M.rbox(0.7, 0.06, 2.2, 0.03, slide, 0, 0.75, 0.75, g); s.rotation.x = 0.62;
  for (const x of [-0.37, 0.37]) { const r = M.rbox(0.05, 0.16, 2.2, 0.02, slide, x, 0.83, 0.75, g); r.rotation.x = 0.62; }
  return g;
}
function makeDuck() { return M.tagAnimal(rawDuck(), 'ordek'); } // albüm: hayvan kaydı (album.js)
// göletin eski ördeği: beyaz gövde, yeşil baş, turuncu gaga. Poly Pizza ördeği (esya.js 'ordek') küçük ve griydi, gölette seçilmiyordu
// (2026-11-08 kullanıcı: "gölette ördekler vardı onlar değişmiş ... oranın eski hali daha iyiydi")
function rawDuck() {
  const g = new THREE.Group(), w = M.mat('#ffffff', { flat: true });
  const b = M.sph(0.16, w, 0, 0.1, 0, g, 8, 6); b.scale.set(0.8, 0.6, 1.2);
  M.sph(0.08, M.mat('#3a8f5c', { flat: true }), 0, 0.24, 0.13, g, 8, 6);
  const beak = M.cyl(0.015, 0.035, 0.08, 5, M.mat('#f6a623'), 0, 0.22, 0.22, g); beak.rotation.x = PI / 2;
  return g;
}

export function setupPlaza(R, T) {
  const C = R.content, { put, strip, rcol } = T, P = PLAZA;
  // ---------- meydan ----------
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(P.r, 56), new THREE.MeshStandardMaterial({ map: texRep('cobble', P.r / 1.2, P.r / 1.2), roughness: 0.95 }));
  plaza.rotation.x = -PI / 2; plaza.position.set(P.x, 0.013, P.z); plaza.receiveShadow = true; C.add(plaza);
  const curb = new THREE.Mesh(new THREE.RingGeometry(P.r, P.r + 0.3, 56), new THREE.MeshStandardMaterial({ color: '#d9ccb4', roughness: 0.9 }));
  curb.rotation.x = -PI / 2; curb.position.set(P.x, 0.016, P.z); C.add(curb);
  strip(C, P.x, -23.9, 4.0, 1.6, 'cobble', 2.4, 0.012); // ana yoldan meydana giriş
  const fountain = put(C, M.makeFiskiye(), P.x, 0, P.z); fountain.scale.setScalar(1.35);
  rcol(R, P.x - 2.9, P.x + 2.9, P.z - 2.9, P.z + 2.9);
  // banklar fıskiyeye bakar; güney (ana yoldan giriş) ve kuzey (parka çıkış) açık kalır
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * PI * 2, bx = P.x + Math.cos(a) * 5.0, bz = P.z + Math.sin(a) * 5.0;
    put(C, M.makeBench(), bx, 0, bz, Math.atan2(P.x - bx, P.z - bz)); rcol(R, bx - 0.6, bx + 0.6, bz - 0.6, bz + 0.6);
    if (k === 1 || k === 4) sitOnBench(C, bx, bz, Math.atan2(P.x - bx, P.z - bz), 2, k === 1 ? M.villagerLook : M.townLook); // sohbet eden komşular (tepki.js)
  }
  for (let k = 0; k < 6; k++) { if (k === 3) continue; const a = (k / 6) * PI * 2; put(C, M.makeLamp(), P.x + Math.cos(a) * 6.85, 0, P.z + Math.sin(a) * 6.85); } // batıdaki fenerin yerinde bankanın kapısı
  // ---------- park ----------
  strip(C, P.x, -43.0, 2.4, 12.0, 'path', 3, 0.011);     // meydandan parkın içine
  strip(C, -45.75, -43.2, 21.5, 2.2, 'path', 3, 0.012);   // doğu-batı yolu
  strip(C, PLAY.x, PLAY.z, 6.2, 4.6, 'sand', 3, 0.013);    // oyun alanının kumu
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: '#6cc6e6', roughness: 0.15 }));
  pond.rotation.x = -PI / 2; pond.scale.set(POND.rx, POND.rz, 1); pond.position.set(POND.x, 0.02, POND.z); C.add(pond);
  const rim = new THREE.Mesh(new THREE.RingGeometry(1, 1.1, 40), new THREE.MeshStandardMaterial({ color: '#cfc3ab', roughness: 0.9 }));
  rim.rotation.x = -PI / 2; rim.scale.set(POND.rx, POND.rz, 1); rim.position.set(POND.x, 0.025, POND.z); C.add(rim);
  rcol(R, POND.x - POND.rx + 0.3, POND.x + POND.rx - 0.3, POND.z - POND.rz + 0.2, POND.z + POND.rz - 0.2);
  for (const [x, z] of [[POND.x - 2.6, POND.z - 1.6], [POND.x + 2.4, POND.z + 1.7], [POND.x + 0.4, POND.z - 2.3]]) put(C, M.makeBush(rand(0.7, 0.9)), x, 0, z); // kamış ve çalı
  const ducks = [0, 1, 2].map((i) => ({ o: put(C, makeDuck(), POND.x, 0, POND.z), a: rand(0, PI * 2), w: rand(0.18, 0.3) * (i % 2 ? 1 : -1), k: rand(0.45, 0.8) }));
  const swings = put(C, makeSwings(), PLAY.x - 1.2, 0, PLAY.z - 0.6); rcol(R, PLAY.x - 2.8, PLAY.x + 0.4, PLAY.z - 1.2, PLAY.z);
  // salıncakta iki çocuk sallanır (oturur, ipleri tutar, bacaklarıyla güç alır); birinin arkasında annesi ya da babası iter
  const KID_COLS = ['#f28db2', '#7fd1c7', '#f2c14e', '#9c8cf0', '#ff8a65'];
  const kids = swings.userData.swings.map((sw) => {
    const k = M.makeCharacter({ ...M.townLook(), shirt: pick(KID_COLS), mustache: false });
    k.scale.setScalar(0.6); k.position.set(0, -2.02, 0.04); sw.add(k);
    for (const a of k.userData.arms) a.rotation.x = -2.5;
    return k;
  });
  const pusher = M.makeCharacter(M.villagerLook()); put(swings, pusher, -0.6, 0, -1.3);
  put(C, makeSlide(), PLAY.x + 2.0, 0, PLAY.z + 0.2, -PI / 2); rcol(R, PLAY.x + 0.9, PLAY.x + 3.2, PLAY.z - 0.3, PLAY.z + 0.7);
  for (const [x, z] of [[-54.2, -38.8], [-37.2, -38.8], [-54.2, -48.6], [-41.6, -49.0], [-49.6, -40.0]]) {
    const bed = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshStandardMaterial({ map: texRep('soil', 1, 1), roughness: 1 }));
    bed.rotation.x = -PI / 2; bed.position.set(x, 0.018, z); C.add(bed);
    for (let k = 0; k < 3; k++) put(C, M.makeFlowers(), x + Math.cos(k * 2.1) * 0.45, 0, z + Math.sin(k * 2.1) * 0.45);
  }
  // çiçekçinin önündeki iki ağaç (-47,0/-43,8, -49,2) kaldırıldı: vitrinin önünü kapatıyordu (2026-10-28 "çiçekçi çok dar")
  // (-53,4/-42,6) parkın doğu-batı yolunun üstündeydi: kaldırıldı (2026-11-01 kullanıcı: "yolda duranları kaldır")
  // bankanın iki yanındakiler banka büyüyünce (2026-11-04, 9,4 m cephe) köşelerine girmesin diye kuzeye ve güneye açıldı (-25,2 / -36,4 idi)
  const trees = [[-55.6, -24.3], [-55.4, -37.3], [-35.6, -25.0], [-35.8, -36.6], [-55.8, -41.2], [-56.0, -46.0], [-36.0, -49.0], [-36.0, -41.0], [-42.0, -40.2]];
  trees.forEach(([x, z], i) => { put(C, M.makeTree(i % 3, rand(0.95, 1.2)), x, 0, z, rand(0, 6)); rcol(R, x - 0.4, x + 0.4, z - 0.4, z + 0.4); });
  // yola bakar. Üçüncüsü göletin doğu kıyısında (yolun üstüne taşıyordu, 2026-11-01); yüzü göletin suyuna döner, sırtı yolda
  // (2026-11-08 kullanıcı: "bank ters duruyor": yola dönükken sırtı göletteydi)
  const parkBenches = [[-48.6, -41.4, PI], [-42.4, -41.4, PI], [-47.45, -45.8, -PI / 2], [-42.0, -45.0, 0]];
  sitOnBench(C, -48.6, -41.4, PI, 2, M.villagerLook); sitOnBench(C, -42.0, -45.0, 0, 1, M.townLook); // (-42,4/-41,4) bankı ağacın arkasında kalıyor
  for (const [x, z, ry] of parkBenches) { put(C, M.makeBench(), x, 0, z, ry); const a = Math.abs(Math.sin(ry)) > 0.5 ? 0.35 : 0.8, b = a === 0.8 ? 0.35 : 0.8; rcol(R, x - a, x + a, z - b, z + b); }
  for (const z of [-38.6, -47.6]) put(C, M.makeLamp(), P.x + 1.6, 0, z);
  put(C, M.makeSign('KASABA MEYDANI VE PARK', '#2f8e88', 4.4, 0.8), P.x - 4.6, 0, -23.7, 0);
  for (const px of [P.x - 6.65, P.x - 2.55]) rcol(R, px - 0.1, px + 0.1, -23.8, -23.6);

  // ---------- canlılar: güvercinler ve gezinen kasabalılar ----------
  const ringPt = (x, z) => { const dx = x - P.x, dz = z - P.z, r = Math.max(3.4, Math.min(6.2, Math.hypot(dx, dz) || 4)), a = Math.atan2(dz, dx); return V(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r); };
  const pigeons = [];
  G.pigeons = pigeons; // kediler (pets.js) sinsice yaklaşır, atılınca güvercinler havalanır
  for (let i = 0; i < 9; i++) { const a = rand(0, PI * 2), r = rand(3.6, 6.0); pigeons.push({ o: put(C, M.makePigeon(), P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r, rand(0, 6)), to: null, t: rand(0, 3), flee: 0, ph: rand(0, 6) }); }
  // yürüyüş ağı: meydanın halkası ve parkın yolları (kenarlar engelsiz), banklarda oturma noktaları
  // meydanın halkası: bankların (r 5) dışında, fenerlerin (r 6,85) içinde; komşu noktalar arası düz yol banka değmez
  const rp = (deg) => V(P.x + Math.cos((deg * PI) / 180) * 6.3, 0, P.z + Math.sin((deg * PI) / 180) * 6.3);
  const N = {
    r30: rp(30), giris: rp(90), r150: rp(150), r210: rp(210), kuzey: rp(270), r330: rp(330),
    orta: V(P.x, 0, -43.2), pBati: V(-55.4, 0, -43.2), pDogu: V(-36.2, 0, -43.2), pKuzey: V(P.x, 0, -48.6),
    b1: V(-48.6, 0, -42.3), b2: V(-42.4, 0, -42.3), b3: V(-46.55, 0, -45.8), b4: V(-42.0, 0, -44.1),
  };
  const E = { r30: ['giris', 'r330'], giris: ['r30', 'r150'], r150: ['giris', 'r210'], r210: ['r150', 'kuzey'], kuzey: ['r210', 'r330', 'orta'], r330: ['kuzey', 'r30'],
    orta: ['kuzey', 'pBati', 'pDogu', 'pKuzey', 'b1', 'b2', 'b3', 'b4'], pBati: ['orta'], pDogu: ['orta'], pKuzey: ['orta'], b1: ['orta'], b2: ['orta'], b3: ['orta'], b4: ['orta'] };
  const SEAT = { b1: [-48.6, -41.35, PI], b2: [-42.4, -41.35, PI], b3: [-47.4, -45.8, PI / 2], b4: [-42.0, -45.05, 0] };
  const taken = {};
  const folks = [];
  for (let i = 0; i < 6; i++) {
    const keys = Object.keys(N).filter((k) => !SEAT[k]), at = pick(keys);
    const o = M.makeCharacter(Math.random() < 0.5 ? M.townLook() : M.villagerLook());
    o.position.copy(N[at]); C.add(o);
    folks.push({ o, at, to: null, t: rand(0, 4), sit: false, spd: rand(1.0, 1.5) });
  }
  const stand = (f) => { f.sit = false; delete taken[f.at]; const u = f.o.userData; for (const l of u.legs) l.rotation.x = 0; f.o.position.y = 0; };

  R.update = (dt) => {
    const t = G.time;
    fountain.userData.tick(t);
    swings.userData.swings.forEach((s, i) => {
      const ph = t * 2.2 + i * 1.7; s.rotation.x = Math.sin(ph) * 0.55;
      for (const l of kids[i].userData.legs) l.rotation.x = -1.35 + Math.cos(ph) * 0.4; // ileri giderken bacaklar uzanır, geri gelirken kıvrılır
    });
    { // iten el: salıncak geriye (iteni) gelince kollar öne uzanır, hafif öne eğilir
      const back = Math.max(0, -Math.sin(t * 2.2)), u = pusher.userData;
      for (const a of u.arms) a.rotation.x = -0.4 - back * 1.2;
      pusher.rotation.x = back * 0.12;
    }
    for (const d of ducks) { d.a += d.w * dt; d.o.position.set(POND.x + Math.cos(d.a) * POND.rx * d.k, 0.03 + Math.sin(t * 2 + d.a) * 0.015, POND.z + Math.sin(d.a) * POND.rz * d.k); d.o.rotation.y = Math.atan2(-Math.sin(d.a) * Math.sign(d.w), Math.cos(d.a) * Math.sign(d.w)); }
    // kaçış: oyuncudan sekerek, atılan kediden (pets.js G.pigeonThreats fast) havalanıp uçarak; sinsi kedi yaklaşınca da sekerler
    const pl = G.player.position, th = G.pigeonThreats || [];
    for (const p of pigeons) {
      const pp = p.o.position;
      let dx = pp.x - pl.x, dz = pp.z - pl.z, dd = Math.hypot(dx, dz) || 1, near = dd < 1.7, fast = false;
      for (const c of th) {
        const q = c.o.position, ex = pp.x - q.x, ez = pp.z - q.z, ed = Math.hypot(ex, ez) || 1;
        if (ed < (c.fast ? 2.8 : 1.2) && (!near || ed < dd)) { dx = ex; dz = ez; dd = ed; near = true; fast = c.fast; }
      }
      p.flee -= dt;
      if (near && p.flee <= 0) {
        p.to = ringPt(pp.x + (dx / dd) * (fast ? 4.6 : 2.4), pp.z + (dz / dd) * (fast ? 4.6 : 2.4)); p.flee = fast ? 1.4 : 0.5;
        p.fly = fast ? Math.hypot(p.to.x - pp.x, p.to.z - pp.z) || 1 : 0;
      }
      if (p.to) {
        const tx = p.to.x - pp.x, tz = p.to.z - pp.z, td = Math.hypot(tx, tz), sp = (p.fly ? 4.4 : p.flee > 0 ? 3.4 : 0.55) * dt;
        if (td <= sp) { pp.x = p.to.x; pp.z = p.to.z; p.to = null; p.fly = 0; p.t = rand(1.2, 4); pp.y = 0; p.o.rotation.z = 0; }
        else {
          pp.x += (tx / td) * sp; pp.z += (tz / td) * sp; p.o.rotation.y = Math.atan2(tx, tz);
          if (p.fly) { pp.y = Math.sin(Math.min(1, 1 - td / p.fly) * PI) * 1.7 + 0.1; p.o.rotation.z = Math.sin(t * 40) * 0.25; } // kanat çırparak yay çizer
          else pp.y = p.flee > 0 ? Math.abs(Math.sin(t * 18)) * 0.28 : Math.abs(Math.sin(t * 14 + p.ph)) * 0.03;
        }
        p.o.userData.head.rotation.x = 0;
      } else {
        p.o.userData.head.rotation.x = Math.max(0, Math.sin(t * 8 + p.ph)) * 0.9;
        p.t -= dt;
        if (p.t <= 0) { const a = rand(0, PI * 2); p.to = ringPt(pp.x + Math.cos(a) * 1.3, pp.z + Math.sin(a) * 1.3); }
      }
    }
    for (const f of folks) {
      if (f.sit) { f.t -= dt; if (f.t <= 0) stand(f); else { M.breathe(f.o, t, 0.6); continue; } } // oturan nefes alır, meydanı seyreder
      if (!f.to) {
        f.t -= dt;
        M.animateCharacter(f.o, 0, dt, false);
        if (f.t > 0) continue;
        const opts = E[f.at].filter((k) => !taken[k]);
        f.to = pick(opts.length ? opts : E[f.at]);
        if (SEAT[f.to]) taken[f.to] = f;
      }
      const g = N[f.to], p = f.o.position, dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz), st = f.spd * dt;
      if (d <= st) {
        p.x = g.x; p.z = g.z; f.at = f.to; f.to = null;
        const s = SEAT[f.at];
        if (s) { f.sit = true; f.t = rand(6, 14); p.set(s[0], 0.12, s[1]); f.o.rotation.y = s[2]; for (const l of f.o.userData.legs) l.rotation.x = -1.35; M.animateCharacter(f.o, 0, dt, false); for (const l of f.o.userData.legs) l.rotation.x = -1.35; }
        else f.t = rand(0.5, 3);
      } else { p.x += (dx / d) * st; p.z += (dz / d) * st; f.o.rotation.y = Math.atan2(dx, dz); M.animateCharacter(f.o, 0.6, dt, false); }
    }
  };
  addBank(R, { put, rcol }); // meydanın batısında banka: muhasebeci kasalardaki parayı buraya yatırır
  R.activate = () => {};
  return R;
}
