// Haritanın dışı: orman, tarlalar, köy evleri, yel değirmeni, otlak, nehir, dağlar, dışarı uzanan yollar
import * as THREE from 'three';
import { G } from './game.js';
import * as M from './models.js';
import { texRep, rng, softEdge } from './tex.js';
import { wobble, coastZ, duneZ, COAST_MIN, bandGeo, ribbonGeo } from './nature.js';
import { expansionRects } from './expand.js';
import { natureParts } from './doga.js';

const PI = Math.PI;
const R = rng(2026);
const rand = (a, b) => a + R() * (b - a);

// oyun bölgeleri (+ kenar payı) ve özel alanlar: buralara ağaç dikilmez
// harita genişletmesi (harita-plan.md): x <= -16 olanlar -7, x >= 16 olanlar +7; köyün iki yanındaki koridorlar da ağaçsız
// çocuk parkı (park.js, 2026-11-09): e-ticaret ofisi [-53, -42.6] ve kalkan genişleme arsaları [-62, -52.6]; arsalar eskiden expansionRects'ten
// geliyordu, aynı kutu burada durur ki ormanın rastgele dizilimi (R sırası) değişmesin
const REGIONS = [[-23, 23, -14, 12], [23, 53, -14, 12], [-23, 53, 12, 32], [-16, 16, -60, -28], [-35, -23, -4, 8.6], [-45, -23, 12.5, 28.5], [-56, -45, 12.6, 25.6], [23, 53, -40, -14], [-59.4, -35.6, -3.6, 8.4], [-53, -42.6, -15.4, -4.6], [-62, -52.6, -15.4, -4.6], [67, 105, 9.4, 31], [-57, -34.5, -50, -23.2], [-84, -63.6, -66.4, -59.8], [23, 53, -68, -40], [-40, -24, 30.6, 44]];
// genişleme payı: oynanan alanın çevresi açık çayır kalır (ileride yeni bölgeler buraya açılır)
const CLEAR = [-53, 57, -70, 32];
const FEATURES = [
  [70, 116, -59, 3.4],  // nehrin ötesindeki lunapark (lunapark.js): çitin içi ağaçsız
  [-100.5, -61, -17, 9.5], // ana yolun batı girişindeki benzinlik (2026-11-01: batı uçtaki ağaçların tepesi yıkama ve batı şeritlerine taşıyordu), şarj istasyonu, güneyindeki şarj ve yıkama arsaları ve giriş şeridi (station.js)
  [-88, -74.4, 13.0, 27], // batı ovasının batı ucu: binicilik pisti (doğusu genişleme arsaları)
  [-64.5, -58, -61, -22], [-86, -58, -61, -55.5], // enerji yolu ve parkın önündeki kol (roads.js)
  [-23, 33, -94, -74], [69, 109, -92, -66], [-89, -49, -96, -70], // uzak mahallelerin önündeki çayır (eski siluet yerleri; ağaç dizilimi kaymasın diye sabit, mahalleler: MAHALLE)
  [55, 75, -160, 40],   // nehir
  [-101, -16, -23.5, -13.6], // ana yol ve kenarındaki eski kervan patikası (tepesi yola taşan ağaç olmasın)
  [-90, -65, -38, -21],   // otopark (kasabanın batısı, events.js LOT): ormanın içinde açıklık
  [-35, -27, -140, -21],  // İpek Yolu: kuzeydeki dağ geçidinden hana (roads.js)
  [-23, 16, -28, -14],    // köy ile han arasındaki yollar
  [-101, -16, 7.6, 15.0], // köy yolu (yaya ve bisikletli müşteriler): kenardaki ağaçların tepesi yola taşmasın
  [53, 132, 3.4, 9.8],  // pazar caddesi (kaldırımlarıyla)
];
// uzak mahalleler: [orta x, sıradaki ev, ön sıra z, cami, patikanın köy tarafındaki ucu z]. İki sıra, önlerinde sokak, ortadan köye inen patika.
// Oyuncu z -72'yi geçemez. Yerler baştan hesaplanır: boş arsadaki ağaç forest()'e gider, çevredeki ormanla aynı yeşilde olur (tek model olarak
// konunca mevsim boyası sonbaharda turuncu yapıyor, orman yeşil kalıyor)
const MAHALLE = [[5, 6, -84, true, -61.5], [95, 5, -83, false, -66], [-69, 5, -84, true, -67]];
const M_GX = 7.4, M_GZ = 11;
const inMahalle = (x, z) => MAHALLE.some(([cx, n, z0]) => Math.abs(x - cx) < (n * M_GX) / 2 + 3 && z < z0 + 6 && z > z0 - M_GZ - 7);
const MP = (() => {
  const Q = rng(1107), pick = (a) => a[Math.floor(Q() * a.length)], jit = (k) => (Q() - 0.5) * k, houses = [], trees = [];
  const WALLS = [['#6fc7bb', '#ffffff'], ['#e8927c', '#fff0e2'], ['#e7b95a', '#fff8ea'], ['#7fa8d9', '#f0f5ff']]; // alt bant ve panjur, duvar tonu
  const ROOFS = ['#ffffff', '#ffffff', '#ecc9b4', '#c9a898']; // kiremit kaplamanın üstüne çarpılır
  for (const [cx, n, z0, cami] of MAHALLE) for (const [j, z] of [z0, z0 - M_GZ].entries()) for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * M_GX + jit(0.8), hz = z + jit(0.8), [band, tint] = pick(WALLS), roof = pick(ROOFS), w = pick([3.8, 4.2, 4.6]), d = pick([3.4, 3.8]);
    const two = Q() < 0.25, side = Q() < 0.5, yard = Q() < 0.6, flower = Q() < 0.6, empty = Q() < 0.14, ry = jit(0.14), ts = 1.1 + Q() * 0.7, pine = Q() < 0.3;
    if (cami && j === 1 && i >= n - 2) continue; // arka sıranın ucu camiye ayrılır
    if (empty) trees.push([x, hz, ts, pine]);
    else houses.push({ x, z: hz, ry, flower, o: { band, tint, roof, w, d, floors: two ? 2 : 1, side, yard } });
  }
  return { houses, trees };
})();
function blocked(x, z, pad = 2.5) {
  if (z > 27) return true;
  if (x > CLEAR[0] && x < CLEAR[1] && z > CLEAR[2] && z < CLEAR[3]) return true;
  for (const r of REGIONS) if (x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad) return true;
  for (const r of FEATURES) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) return true;
  for (const r of expansionRects()) if (x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad) return true; // bölge genişleme arsaları boş kalır
  return false;
}

function flat(parent, cx, cz, w, d, texName, tile, y = -0.04, color = '#ffffff') {
  const soft = texName === 'path'; // toprak yolun kenarı çimene yumuşak geçer
  if (soft) { w += 0.7; d += 0.7; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: texRep(texName, w / tile, d / tile), color, roughness: 0.95,
    ...(soft ? { alphaMap: softEdge(w, d, 0.7), transparent: true, depthWrite: false } : {}) }));
  m.rotation.x = -PI / 2; m.position.set(cx, y, cz); m.receiveShadow = true;
  parent.add(m);
  return m;
}

function forest(parent) {
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.2, 6);
  const pineGeo = new THREE.ConeGeometry(1, 2.4, 8);
  const pts = [];
  for (let x = -90; x <= 120; x += 3.1) for (let z = -105; z <= 27; z += 3.1) {
    const ox = x + rand(-1.3, 1.3), pz = z + rand(-1.3, 1.3);
    const px = ox <= -16 ? ox - 7 : ox >= 16 ? ox + 7 : ox; // aynı orman, bloklarla birlikte kayar; koridorlara ağaç düşmez
    if (blocked(px, pz)) continue;
    const dense = 0.45 + 0.4 * Math.sin(ox * 0.07) * Math.cos(pz * 0.06);
    if (R() > dense + 0.25) continue;
    const t = [px, pz, rand(0.8, 1.6) * 1.2, R() < 0.3]; // karaktere göre orantılı orman
    if (!inMahalle(px, pz)) pts.push(t); // sayılar yine çekilir: R sırası bozulmasın
  }
  pts.push(...MP.trees);
  G.trees = pts.filter(([x, z]) => x > -89 && x < 109 && z > -74); // serbest yürüyüşte oyuncu gövdelere çarpar (nature.js openGround)
  // tür çeşitliliği (2026-11-04 kullanıcı: "ağaçlardan meşe ve kavak ve seçtiğin 1-2si eklenebilir oyun ile uyumlu olsun"): yuvarlak
  // ağaçların ~%45'i meşe, kavak, zeytin ya da salkım söğüt (nehir kıyısında çoğu söğüt). Türün her parçası tek InstancedMesh.
  // Tür seçimi ayrı tohumla: R'nin sırası (köy evleri, tarlalar) bozulmasın
  const RS = rng(1104), SP = [['mese', 0.45, 1], ['kavak', 0.25, 1], ['zeytin', 0.2, 1], ['sogut', 0.1, 0.75]].map(([k, w, z]) => ({ k, w, z, p: natureParts(k), n: 0, ims: [] })).filter((t) => t.p); // z: boy çarpanı (söğüt geniş)
  const m4 = new THREE.Matrix4(), SG = SP.findIndex((t) => t.k === 'sogut'), wSum = SP.reduce((a, t) => a + t.w, 0);
  const pick = (x) => {
    if (!SP.length) return -1;
    const r = RS();
    if (SG >= 0 && x > 50 && x < 82 && r < 0.55) return SG; // nehir kıyısı
    if (r > 0.45) return -1;
    let u = RS() * wSum;
    for (let i = 0; i < SP.length; i++) if ((u -= SP[i].w) <= 0) return i;
    return SP.length - 1;
  };
  const sp = pts.map(([x, , , pine]) => (pine ? -1 : pick(x)));
  for (const i of sp) if (i >= 0) SP[i].n++;
  // örnekli ağaç, köydeki GLB ağaçla aynı malzemeyi paylaşmaz: three ikisini sırayla çizerken her karede gölgelendiriciyi yeniden seçiyordu
  const own = new Map(), mine = (m) => { let c = own.get(m); if (!c) { const ud = m.userData; m.userData = {}; c = m.clone(); m.userData = ud; own.set(m, c); } return c; };
  for (const t of SP) { t.ims = t.p.parts.map((q) => new THREE.InstancedMesh(q.geo, mine(q.mat), Math.max(1, t.n))); t.n = 0; }
  const rounds = pts.filter((p, i) => !p[3] && sp[i] < 0), pines = pts.filter((p) => p[3]), plain = sp.filter((i) => i < 0).length;
  // yapraklar yumuşak gölgeli üç topak: köydeki GLB ağacın (doga.js agac) yuvarlak tepesine benzer, ağaç başına ~250 üçgen kalır
  const leaf = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const crowns = new THREE.InstancedMesh(crownGeo, leaf, rounds.length * 3);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.9 }), plain);
  const cones = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), pines.length * 2);
  const o = new THREE.Object3D(), col = new THREE.Color();
  const greens = ['#5dbb63', '#72cc6c', '#4fae58', '#7cc76a', '#8fd36f', '#64b85a'];
  let ci = 0, ti = 0, pi = 0;
  pts.forEach(([x, z, s, pine], i) => {
    if (sp[i] >= 0) { // yeni tür: gövdesiyle birlikte modelin kendisi; R yine aynı sayıda çekilir
      for (let k = 0; k < 8; k++) R();
      const t = SP[sp[i]];
      o.position.set(x, -0.06, z); o.rotation.set(0, RS() * PI * 2, 0); o.scale.setScalar((s / 1.2) * t.z * (0.9 + RS() * 0.2)); o.updateMatrix();
      col.setScalar(0.86 + RS() * 0.14);
      t.p.parts.forEach((q, j) => { t.ims[j].setMatrixAt(t.n, m4.multiplyMatrices(o.matrix, q.mx)); t.ims[j].setColorAt(t.n, col); });
      t.n++;
      return;
    }
    o.position.set(x, 0.6 * s - 0.06, z); o.rotation.set(0, 0, 0); o.scale.setScalar(s); o.updateMatrix();
    trunks.setMatrixAt(ti++, o.matrix);
    if (!pine) {
      const a = R() * PI * 2, g = greens[Math.floor(R() * greens.length)];
      for (let k = 0; k < 3; k++) {
        const d = k ? 0.55 * s : 0, ak = a + (k === 2 ? PI * 0.9 : 0);
        o.position.set(x + Math.cos(ak) * d, (k === 0 ? 2.05 : k === 1 ? 1.65 : 1.8) * s, z + Math.sin(ak) * d);
        o.scale.setScalar(s * (k === 0 ? 0.92 : k === 1 ? 0.74 : 0.66));
        o.rotation.set(R() * 3, R() * 3, 0);
        o.updateMatrix();
        crowns.setMatrixAt(ci, o.matrix);
        crowns.setColorAt(ci++, col.set(g).offsetHSL(0, 0, k === 1 ? -0.04 : k === 2 ? 0.03 : 0)); // aynı ağacın topakları aynı yeşilde, alttaki biraz koyu
      }
    } else {
      for (let k = 0; k < 2; k++) {
        o.position.set(x, (1.9 + k * 1.0) * s, z); o.rotation.set(0, R() * 3, 0); o.scale.set(s * (1 - k * 0.3), s * (1 - k * 0.25), s * (1 - k * 0.3));
        o.updateMatrix();
        cones.setMatrixAt(pi, o.matrix);
        cones.setColorAt(pi++, col.set(k ? '#4f9e5a' : '#3f8a4c'));
      }
    }
  });
  // Her türün tek InstancedMesh'i bütün haritayı kaplıyordu: sınır küresi hiç görüş dışına çıkmadığı için kamera dükkânın içine baksa da
  // ormanın tamamı (yaklaşık 200 bin üçgen) her karede, gölgeli kademelerde iki kez çiziliyordu (2026-11-10 denetimi). Örnekler 56 m'lik
  // karelere dağıtılır: yalnız görünen kareler çizilir. Yukarıdaki çekiliş sırası (R, RS) aynı kalır, ağaçların yeri değişmez
  for (const im of [crowns, trunks, cones, ...SP.flatMap((t) => t.ims)]) { im.castShadow = true; for (const cell of splitCells(im)) parent.add(cell); }
}
function splitCells(im, size = 56) {
  const e = im.instanceMatrix.array, c = im.instanceColor ? im.instanceColor.array : null, cells = new Map();
  for (let i = 0; i < im.count; i++) {
    const k = Math.floor(e[i * 16 + 12] / size) + ',' + Math.floor(e[i * 16 + 14] / size);
    let L = cells.get(k);
    if (!L) cells.set(k, (L = []));
    L.push(i);
  }
  const out = [];
  for (const L of cells.values()) {
    const m = new THREE.InstancedMesh(im.geometry, im.material, L.length);
    L.forEach((i, j) => m.instanceMatrix.array.set(e.subarray(i * 16, i * 16 + 16), j * 16));
    if (c) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(L.length * 3), 3); L.forEach((i, j) => m.instanceColor.array.set(c.subarray(i * 3, i * 3 + 3), j * 3)); }
    m.castShadow = im.castShadow; m.receiveShadow = im.receiveShadow; m.name = 'orman';
    m.computeBoundingSphere();
    out.push(m);
  }
  im.dispose(); // boşalan asıl örnek tamponu bırakılır (geometri ve malzeme ortak, onlara dokunulmaz)
  return out;
}

// komşu köyler: oynanan alandan uzakta, çevresi çitle kapalı (oraya gidilmez, manzaradır)
function hamlet(parent, cx, cz, w, d, gap = 7) {
  const walls = ['#fff3dc', '#fde2c4', '#e7f1fb', '#f4d9d9', '#e9f2d8', '#fff8e8'];
  const roofs = ['#c8643b', '#b5553a', '#8f4a2f', '#d9774a', '#3d7dd8'];
  flat(parent, cx, cz, 2.6, d - 2, 'path', 3, -0.03);
  for (let x = cx - w / 2 + 3.5; x <= cx + w / 2 - 3.5; x += gap) {
    for (let z = cz - d / 2 + 3.5; z <= cz + d / 2 - 3.5; z += gap) {
      if (Math.abs(x - cx) < 2.5 || R() < 0.2) continue; // ortadaki yol ve birkaç boş bahçe
      const h = M.makeHouse(walls[Math.floor(R() * walls.length)], roofs[Math.floor(R() * roofs.length)], rand(2.8, 3.8), rand(2.4, 3.0));
      h.position.set(x + rand(-0.8, 0.8), -0.06, z + rand(-0.8, 0.8)); h.rotation.y = x < cx ? PI / 2 + rand(-0.2, 0.2) : -PI / 2 + rand(-0.2, 0.2);
      h.scale.setScalar(1.3); // köy evi karaktere göre küçük kalıyordu
      parent.add(h);
      const fl = M.makeFlowers(R); fl.position.set(x + (x < cx ? 2.8 : -2.8), -0.06, z + 2.2); parent.add(fl);
    }
  }
  const well = M.makeWell(); well.position.set(cx + 2.2, -0.06, cz); parent.add(well);
  // çevre çiti: güneyde kapı aralığı, ortadaki yol oradan yola iner (çıkmaz sokak olmasın)
  { const f = M.makeFence(w, 'x'); f.position.set(cx, -0.06, cz - d / 2); parent.add(f); }
  for (const [a, b] of [[cx - w / 2, cx - 1.6], [cx + 1.6, cx + w / 2]]) { const f = M.makeFence(b - a, 'x'); f.position.set((a + b) / 2, -0.06, cz + d / 2); parent.add(f); }
  if (parent.userData.hamletLink) flat(parent, cx, (cz + d / 2 + parent.userData.hamletLink) / 2, 2.6, parent.userData.hamletLink - (cz + d / 2) + 1, 'path', 3, -0.03);
  for (const x of [cx - w / 2, cx + w / 2]) { const f = M.makeFence(d, 'z'); f.position.set(x, -0.06, cz); parent.add(f); }
}
function village(parent) {
  // nehrin ötesindeki süs köyü kaldırıldı: yerinde lunapark var (lunapark.js)
}

// batı ovası: köy yolunun iki yanında çitli ekin tarlaları, saman balyaları ve yel değirmeni; at ahırı, köy tarlası, mera ve
// dokuma atölyesiyle birlikte çiftlik kuşağı olur (benzinlik ana yolda, enerji parkı kuzeybatıda: ovada yalnız tarım var)
function fields(parent) {
  // batı uçtaki iki süs tarlası kalktı: yerinde binicilik pisti (expand-west.js xatlar3; 2026-11-03 kullanıcı: "binicilik eğitim alanını
  // 2 katına çıkar, ahırın arkasına değil sahile yakın tarafa al"). Değirmen pistin güneybatısına, ormanın kıyısına kaydı
  for (const [x, z, r] of [[-74.0, 14.6, 0.4], [-87.6, 15.0, 2.6], [-87.6, 18.6, 1.1]]) { const h = M.makeHay(); h.position.set(x, -0.06, z); h.rotation.y = r; parent.add(h); }
  const wm = M.makeWindmill(); wm.position.set(-88.8, -0.06, 28.7); wm.rotation.y = 0.35; parent.add(wm);
  return wm;
}

// Uzak mahalleler (2026-11-07 kullanıcı: "köyün uzağındaki evler gri renk dokusuz onlara doku ver ve biraz daha uzağa taşı oyun ile uyumlu
// hale getir. sanki müşterilerin evleri gibi onlar"): eskiden üst üste binen gri kutu ve koniler. Şimdi sıvalı, kiremitli, bahçeli evler (models.js)
function mahalleler(parent) {
  for (let i = 0; i < 205; i++) R(); // eski 41 kutunun çektiği sayılar: dağlar ve kayalar yerinde kalsın
  const F = rng(1108);
  for (const h of MP.houses) {
    const e = M.makeMahalleEvi(h.o); e.position.set(h.x, -0.06, h.z); e.rotation.y = h.ry; parent.add(e);
    if (h.o.yard && h.flower) { const f = M.makeFlowers(F); f.position.set(h.x - h.o.w * 0.28, -0.06, h.z + h.o.d / 2 + 0.8); parent.add(f); }
  }
  for (const [cx, n, z0, cami, ze] of MAHALLE) {
    const laneX = n % 2 ? cx + M_GX / 2 : cx, zs = z0 - M_GZ + 4.6; // patika arka sokaktan köye doğru, ucu çimene karışır
    for (const z of [z0, z0 - M_GZ]) flat(parent, cx, z + 4.6, n * M_GX, 2.2, 'path', 3, -0.03);
    flat(parent, laneX, (zs + ze) / 2, 2.2, ze - zs, 'path', 3, -0.031);
    if (cami) { const c = M.makeMahalleCami(); c.position.set(cx + (n / 2 - 1) * M_GX, -0.06, z0 - M_GZ - 0.4); parent.add(c); }
  }
}

function river(parent) {
  const pts = [[77, -160], [73, -110], [67, -70], [64, -35], [62, -5], [60, 18], [59, 34]]; // dere +7 (nature.js ile aynı)
  // yumuşak kıvrımlı yatak, iki kıyısı ayrı ayrı girintili çıkıntılı (nature.js); köprülerin altında genişlik sabite yakın
  const water = new THREE.MeshStandardMaterial({ map: texRep('water', 2, 1), color: '#bfe9ff', roughness: 0.2, side: THREE.DoubleSide });
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const len = curve.getLength(), zAt = (s) => curve.getPointAt(Math.min(1, Math.max(0, s / len))).z;
  const calm = (s) => { const z = zAt(s); return z > -2 && z < 19 ? 0.25 : 1; }; // köprü boyunca (z 6,5)
  const bank = (base, amp, seed) => (s) => base + amp * calm(s) * wobble(s, seed, [0.07, 0.19, 0.5], [0.55, 0.3, 0.15]);
  for (const [geo, y, m] of [[ribbonGeo(curve, 320, bank(4.6, 1.6, 11), bank(4.6, 1.6, 13)), -0.045, M.mat('#e9cf8e', { side: THREE.DoubleSide })], [ribbonGeo(curve, 320, bank(3, 1.0, 7), bank(3, 1.0, 9), 6), -0.03, water]]) {
    const s = new THREE.Mesh(geo, m);
    s.position.y = y; s.receiveShadow = true;
    parent.add(s);
  }
  // pazar caddesinin geçtiği tahta köprü: ortası 0,34 m yüksek, iki ucu yürüyüşle aynı eğimde rampa (world.js heightAt)
  parent.add(makeBridge(4.5, 1.2, 0.34, 5.8, 62, 6.6)); // araç yolu ve iki kaldırım
  // 2026-11-06 kullanıcı: "köprüyü 2 ye düşür ortadaki köprüyü kaldır": z 14'teki alçak iskele köprü kalktı; dereyi pazar caddesi ve plaj köprüsü (roads.js beachBridge) geçer
  return water.map;
}

// köprü: yarı boy hl, rampa boyu rl (0 ise düz iskele), yükseklik h, en w. Güverte tahta, korkuluklar ve su içinde ayaklar
function makeBridge(hl, rl, h, w, x, z) {
  const g = new THREE.Group();
  const deck = M.mat('#ffffff', { map: texRep('wood', hl, w / 2) }), beam = M.mat('#8a5a33'), stone = M.mat('#b9b3a8', { flat: true });
  const top = (px) => (Math.abs(px) <= hl - rl ? h : h * Math.max(0, (hl - Math.abs(px)) / rl)); // güvertenin üst yüzü
  const T = 0.18, flat = hl - rl;
  M.rbox(flat * 2, T, w, 0.04, deck, 0, h - T / 2, 0, g);
  if (rl > 0) {
    const a = Math.atan2(h, rl), L = Math.hypot(h, rl);
    for (const s of [-1, 1]) { const r = M.rbox(L, T, w, 0.04, deck, s * (flat + rl / 2), h / 2 - T / 2 / Math.cos(a), 0, g); r.rotation.z = -s * a; }
  }
  // korkuluklar: dikmeler güverteye basar, üst tırabzan eğimi izler
  const post = 0.75, ends = rl > 0 ? hl - 0.15 : hl - 0.1;
  for (const sz of [-1, 1]) {
    const pz = sz * (w / 2 - 0.08);
    const xs = []; for (let px = -ends; px <= ends + 1e-6; px += (2 * ends) / Math.max(2, Math.round((2 * ends) / 1.1))) xs.push(px);
    for (const px of xs) M.rbox(0.12, post, 0.12, 0.03, beam, px, top(px) + post / 2, pz, g);
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], y0 = top(x0) + post, y1 = top(x1) + post;
      const r = M.rbox(Math.hypot(x1 - x0, y1 - y0) + 0.06, 0.1, 0.1, 0.03, beam, (x0 + x1) / 2, (y0 + y1) / 2, pz, g);
      r.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    }
  }
  // ayaklar: güvertenin altından suya inen taş ve kirişler
  for (const px of [-flat * 0.55, flat * 0.55]) for (const sz of [-1, 1]) M.cyl(0.18, 0.24, 0.9, 8, stone, px, h - 0.6, sz * (w / 2 - 0.35), g);
  for (const px of [-flat * 0.55, flat * 0.55]) M.rbox(0.2, 0.16, w - 0.4, 0.03, beam, px, h - T - 0.07, 0, g);
  g.position.set(x, 0, z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

const MOUNTS = []; // [x, z, r]: kuşak orman dağların içine ağaç dikmez
function mountains(parent) {
  const rock = M.mat('#9aa6a0', { flat: true }), rock2 = M.mat('#8a978f', { flat: true }), snow = M.mat('#ffffff', { flat: true });
  for (let i = 0; i < 14; i++) {
    const x = -110 + i * 17 + rand(-5, 5), z = rand(-160, -125), r = rand(14, 24), h = rand(18, 34);
    const m = M.mesh(new THREE.ConeGeometry(r, h, 7), i % 2 ? rock : rock2, x, h / 2 - 1, z, parent); MOUNTS.push([x, z, r]);
    m.castShadow = false; m.rotation.y = R() * 3;
    const s = M.mesh(new THREE.ConeGeometry(r * 0.36, h * 0.36, 7), snow, x, h - h * 0.18 - 0.6, z, parent);
    s.castShadow = false; s.rotation.y = m.rotation.y;
  }
}

let windmill = null, riverTex = null;
export function buildSurroundings() {
  const g = new THREE.Group();
  g.name = 'decor'; // main.js açılışta kımıldamayan parçaları birleştirir (perf.js bakeStatic)
  G.scene.add(g);
  // zemin: oyun alanıyla aynı hizada çimen; kıyı çizgisine (z = 31.6) kadar
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 360), new THREE.MeshStandardMaterial({ map: texRep('grass', 105, 90), color: '#d9f0c6', roughness: 1 }));
  ground.rotation.x = -PI / 2; ground.position.set(15, -0.06, COAST_MIN - 0.1 - 180); // girintili kıyının en içine kadar; ötesi kumsal
  ground.receiveShadow = true;
  g.add(ground);
  // kumsal: iç kenarı kumul gibi dalgalı, deniz kenarı girintili çıkıntılı (nature.js); suyun kıyısında ıslak kum
  const beach = new THREE.Mesh(bandGeo(-200, 230, duneZ, coastZ), new THREE.MeshStandardMaterial({ map: texRep('sand', 1, 1), roughness: 0.95 }));
  beach.position.y = -0.05; beach.receiveShadow = true; g.add(beach);
  const wet = new THREE.Mesh(bandGeo(-200, 230, (x) => coastZ(x) - 0.8 - 0.3 * wobble(x, 3, [0.4, 0.9], [0.6, 0.4]), coastZ), new THREE.MeshStandardMaterial({ color: '#b8935a', roughness: 0.9, transparent: true, opacity: 0.45, depthWrite: false }));
  wet.position.y = -0.048; g.add(wet);
  // ana yol: batıdan Köy Meydanı'na uzanan asfalt; ortası kesik çizgili, güney kenarında lambalar, kuzeyinde kervan patikası
  // yollar haritanın dışındaki ormanın içine uzanır (2026-11-04): ana yol ve köy yolu batıda, pazar caddesi ve sahil yolu doğuda zeminin kenarına
  flat(g, -86.25, -18.6, 217.5, 5.6, 'asphalt', 3, -0.03); // -195..22.5: köyün kuzeyinden geçip çiftlik köşesinde köy caddesine bağlanır
  for (let x = -194; x < 13; x += 3) { const m = M.rbox(1.4, 0.02, 0.14, 0.01, M.mat('#ffffff')); m.position.set(x, -0.02, -18.6); g.add(m); }
  // şerit okları (2026-11-04 kullanıcı: "yollarda taşıtların geliş gidiş yönleri belli değil"): sağdan gidilir; güney şerit doğuya (köye),
  // kuzey şerit batıya (ormana) gider. Taşıtlar batıdaki ormandan gelip oraya döner (events.js ROAD_FAR); yaya geçitlerine denk gelmez
  { const sh = new THREE.Shape([[-1.3, -0.14], [0.35, -0.14], [0.35, -0.45], [1.3, 0], [0.35, 0.45], [0.35, 0.14], [-1.3, 0.14]].map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ShapeGeometry(sh).rotateX(-PI / 2), mat = M.mat('#ffffff');
    for (const [x, z, ry] of [...[-130, -108, -52, -33, -2].map((x) => [x, -17.4, 0]), ...[-125, -103, -56, -8, 3].map((x) => [x, -19.8, PI])]) { const m = new THREE.Mesh(geo, mat); m.position.set(x, -0.02, z); m.rotation.y = ry; m.receiveShadow = true; g.add(m); } }
  for (const x of [-94, -88, -64.2, -55, -43, -6, 6]) { const l = M.makeLamp(); l.position.set(x, -0.06, -14.6); g.add(l); } // benzinliğin giriş şeritlerinde lamba yok; kaldırımın dış kenarında, -61'deki yaya geçidinin ağzında değil (roads.js)
  { const s = M.makeSign('KÖY BAKKALI →', '#e8604c', 3.4, 0.8); s.position.set(-91, -0.06, -14.7); g.add(s); } // haritanın batı girişinde (e-ticaret ofisinin batısı genişleme arsası)
  flat(g, -105.5, 10.7, 179, 3.8, 'path', 3, -0.03);            // köy yolu batıya: yaya ve bisikletli müşteriler buradan gelir
  // pazar caddesi köprüyle dereyi geçer, suyun üstünde düzlem yok (titreşme olmasın); tahta yol derenin doğusunda başlar
  flat(g, 55.3, 6.5, 4.6, 3.6, 'path', 3, -0.03); flat(g, 145.7, 6.5, 158.6, 3.6, 'path', 3, -0.03);
  flat(g, 146, 14, 158, 2.4, 'wood', 2.2, -0.03);
  forest(g);
  village(g);
  windmill = fields(g);
  mahalleler(g);
  riverTex = river(g);
  mountains(g);
  for (let i = 0; i < 26; i++) {
    const x = rand(-87, 117), z = rand(-100, 26);
    if (blocked(x, z, 1)) continue;
    const r = M.makeRock(rand(0.6, 1.6), R() < 0.5 ? '#b9b3a8' : '#a9a397'); r.position.set(x, -0.06, z);
    if (!inMahalle(x, z)) g.add(r); // evin içine kaya düşmesin (sayılar yine çekilir)
  }
  farForest(g); // en sonda ve kendi tohumuyla: R'nin dizilimini (köyler, kayalar) kaydırmaz
}

// Haritanın dışındaki boş çayırlar orman (2026-11-04 kullanıcı: "köy çevresini ağaç kapla, boş haritanın dışındaki yeşil alanları
// orman yap, yol oralara devam ediyor gibi gitsin"): batı ve doğu kuşağı (eski ormanın ötesi, zeminin kenarına kadar) ile dağların önü.
// Kumsal, nehir, İpek Yolu'nun dağ geçidi ve dışarı uzanan yollar açık kalır. Uzakta olduğu için az üçgenli (ağaç başına ~45 üçgen),
// gölgesiz; 80 m'lik parçalara bölünür, ekranda olmayan parça çizilmez
const ROADS_OUT = [[-18.6, 6], [10.7, 5], [6.5, 4.5], [14, 3.5]]; // [z, açık kuşağın yarısı]: ana yol, köy yolu, pazar caddesi, sahil yolu
const RIVER_PTS = [[77, -160], [73, -110], [67, -70], [64, -35], [62, -5], [60, 18], [59, 34]];
function riverAt(z) {
  for (let i = 1; i < RIVER_PTS.length; i++) {
    const [x0, z0] = RIVER_PTS[i - 1], [x1, z1] = RIVER_PTS[i];
    if (z <= z1) return x0 + ((x1 - x0) * Math.max(0, z - z0)) / (z1 - z0);
  }
  return RIVER_PTS[RIVER_PTS.length - 1][0];
}
function farForest(parent) {
  const Q = rng(4242), rq = (a, b) => a + Q() * (b - a);
  const crownGeo = new THREE.IcosahedronGeometry(1, 0), trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.2, 5, 1, true), pineGeo = new THREE.ConeGeometry(1, 2.4, 6, 1, true);
  const leaf = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), bark = new THREE.MeshStandardMaterial({ color: '#7a4f27', roughness: 0.9 });
  const needle = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
  const greens = ['#5dbb63', '#72cc6c', '#4fae58', '#7cc76a', '#64b85a', '#56a85a'], chunks = new Map();
  for (let x = -193; x <= 223; x += 4.2) for (let z = -200; z <= 26; z += 4.2) {
    const px = x + rq(-1.7, 1.7), pz = z + rq(-1.7, 1.7), s = rq(0.9, 1.7) * 1.25, pine = Q() < 0.3, keep = Q(), a = Q() * PI * 2, gi = Q();
    if (px > -97 && px < 127 && pz > -108) continue; // eski orman ve oyun alanı
    if (pz > duneZ(px) - 2.5) continue; // kumsal açık kalır
    if ((px < -95 || px > 125) && ROADS_OUT.some(([rz, w]) => Math.abs(pz - rz) < w)) continue;
    if (px > -37 && px < -25 && pz < -100) continue; // İpek Yolu'nun dağ geçidi
    if (Math.abs(px - riverAt(pz)) < 8) continue;
    if (MOUNTS.some(([mx, mz, r]) => Math.hypot(px - mx, pz - mz) < r * 0.8)) continue;
    if (keep > 0.62 + 0.25 * Math.sin(px * 0.05) * Math.cos(pz * 0.045)) continue; // yer yer seyrek, yer yer sık
    const key = Math.floor((px + 200) / 80) + ',' + Math.floor((pz + 210) / 80);
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push([px, pz, s, pine, a, gi]);
  }
  const o = new THREE.Object3D(), col = new THREE.Color();
  for (const pts of chunks.values()) {
    const rounds = pts.filter((p) => !p[3]), pines = pts.filter((p) => p[3]);
    const crowns = new THREE.InstancedMesh(crownGeo, leaf, rounds.length * 2), trunks = new THREE.InstancedMesh(trunkGeo, bark, pts.length), cones = new THREE.InstancedMesh(pineGeo, needle, pines.length * 2);
    let ci = 0, ti = 0, pi = 0;
    for (const [x, z, s, pine, a, gi] of pts) {
      o.position.set(x, 0.6 * s - 0.06, z); o.rotation.set(0, 0, 0); o.scale.setScalar(s); o.updateMatrix(); trunks.setMatrixAt(ti++, o.matrix);
      if (!pine) {
        const g = greens[Math.floor(gi * greens.length)];
        for (let k = 0; k < 2; k++) {
          o.position.set(x + (k ? Math.cos(a) * 0.5 * s : 0), (k ? 1.7 : 2.1) * s, z + (k ? Math.sin(a) * 0.5 * s : 0));
          o.scale.setScalar(s * (k ? 0.75 : 0.95)); o.rotation.set(a, a * 1.7, 0); o.updateMatrix();
          crowns.setMatrixAt(ci, o.matrix); crowns.setColorAt(ci++, col.set(g).offsetHSL(0, 0, k ? -0.05 : -0.02));
        }
      } else {
        for (let k = 0; k < 2; k++) {
          o.position.set(x, (1.9 + k * 1.0) * s, z); o.rotation.set(0, a, 0); o.scale.set(s * (1 - k * 0.3), s * (1 - k * 0.25), s * (1 - k * 0.3)); o.updateMatrix();
          cones.setMatrixAt(pi, o.matrix); cones.setColorAt(pi++, col.set(k ? '#4f9e5a' : '#3f8a4c'));
        }
      }
    }
    for (const im of [crowns, trunks, cones]) {
      if (!im.count) continue;
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.name = 'uzak-orman'; parent.add(im);
    }
  }
}

export function updateSurroundings(dt) {
  if (windmill) windmill.userData.hub.rotation.z += dt * 0.9;
  if (riverTex) riverTex.offset.y -= dt * 0.08;
}
