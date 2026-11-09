// Bemis Enerji Parkı: haritanın kuzeybatı köşesinde, köyden uzakta; ana yoldan elektrik direkleri boyunca giden servis yoluyla
// ulaşılır (roads.js energyRoad). Güneş panelleri ve rüzgâr türbinleri elektrik
// üretir, trafo şebekeye satar; kazanç trafonun önündeki para yığınına düşer. Pahalı ama kendi kendine çalışan yatırım:
// bölge açılınca trafo ve ilk panel dizisi kurulur, öbür panel dizileri ve türbinler ayrı kilitlerle alınır (world.js w1-w5).
import * as THREE from 'three';
import * as M from './models.js';
import { G, popIn, mult } from './game.js';
import { toKasa } from './account.js';
import { textTex } from './tex.js';

const PI = Math.PI;
const RED = '#c8102e';
// birim yerleri: panel dizileri yola yakın sırada, türbinler arkada (kuzeyde); 0. sıradaki trafoya en yakın olan
const SUN_X = [-71.2, -76.4, -81.6], WIND_X = [-71.2, -76.4, -81.6];
const SUN_Z = -61.6, WIND_Z = -64.8, TRAFO = [-66.6, -65.0];
const SUN_RATE = 0.9, WIND_RATE = 1.6; // ₺/sn: panel dizisi sabite yakın, türbin rüzgâra göre (ortalama)

// panel yüzeyi: lacivert hücreler, ince gümüş ızgara, dört panel arasında boşluk
let panelTex = null;
function panelMap() {
  if (panelTex) return panelTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#d9dde2'; g.fillRect(0, 0, 512, 128);
  for (let p = 0; p < 4; p++) {
    const x0 = 4 + p * 127;
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#2b4f8c'); gr.addColorStop(1, '#16294f');
    g.fillStyle = gr; g.fillRect(x0, 4, 119, 120);
    g.strokeStyle = 'rgba(200,215,235,0.55)'; g.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x0 + (i * 119) / 6, 4); g.lineTo(x0 + (i * 119) / 6, 124); g.stroke(); }
    for (let j = 1; j < 3; j++) { g.beginPath(); g.moveTo(x0, 4 + (j * 120) / 3); g.lineTo(x0 + 119, 4 + (j * 120) / 3); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0 + 6, 8, 40, 112); // parlama
  }
  panelTex = new THREE.CanvasTexture(c); panelTex.colorSpace = THREE.SRGBColorSpace; panelTex.anisotropy = 4;
  return panelTex;
}
// güneş paneli dizisi: dört panel yan yana, güneye (kameraya) eğik; önde kısa, arkada uzun ayaklar
function makeSolarArray() {
  const g = new THREE.Group(), steel = M.mat('#9aa3ad', { rough: 0.35 });
  for (const x of [-1.7, 0, 1.7]) {
    M.cyl(0.05, 0.05, 0.62, 6, steel, x, 0.31, 0.5, g);
    M.cyl(0.05, 0.05, 1.22, 6, steel, x, 0.61, -0.5, g);
  }
  const tilt = new THREE.Group(); tilt.position.set(0, 0.92, 0); tilt.rotation.x = 0.5; g.add(tilt);
  M.rbox(4.3, 0.07, 1.55, 0.02, M.mat('#c9ced4'), 0, -0.02, 0, tilt); // alüminyum çerçeve
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.45), new THREE.MeshStandardMaterial({ map: panelMap(), roughness: 0.38, metalness: 0.15 }));
  face.rotation.x = -PI / 2; face.position.y = 0.02; tilt.add(face);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// rüzgâr türbini: beyaz konik kule, gövde, burun; üç kanat uçları kırmızı şeritli. Rotor kameraya bakar (userData.rotor)
function makeTurbine() {
  const g = new THREE.Group(), white = M.mat('#f4f5f6', { rough: 0.4 }), red = M.mat(RED);
  M.cyl(0.62, 0.7, 0.14, 14, M.mat('#b9bec4'), 0, 0.07, 0, g); // beton kaide
  M.cyl(0.16, 0.32, 6.4, 12, white, 0, 3.3, 0, g);
  M.rbox(0.52, 0.48, 1.15, 0.12, white, 0, 6.6, -0.12, g); // gövde (nacelle)
  M.rbox(0.54, 0.08, 0.5, 0.02, red, 0, 6.6, -0.5, g); // gövdede kırmızı şerit
  const rotor = new THREE.Group(); rotor.position.set(0, 6.6, 0.52); g.add(rotor);
  const nose = M.cyl(0.02, 0.2, 0.36, 12, white, 0, 0, 0.12, rotor); nose.rotation.x = PI / 2;
  for (let k = 0; k < 3; k++) {
    const arm = new THREE.Group(); arm.rotation.z = (k * 2 * PI) / 3; rotor.add(arm);
    M.rbox(0.24, 2.6, 0.06, 0.03, white, 0.04, 1.45, 0, arm);
    M.rbox(0.18, 0.3, 0.065, 0.02, red, 0.04, 2.6, 0, arm); // kanat ucu
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.rotor = rotor;
  return g;
}
// trafo binası: beyaz kutu, kırmızı bant, BEMIS ENERJİ tabelası, yüksek gerilim levhası ve çatıda izolatörler
function makeTrafo() {
  const g = new THREE.Group();
  M.rbox(2.6, 2.0, 1.9, 0.08, M.mat('#eef0f2'), 0, 1.0, 0, g);
  M.rbox(2.64, 0.28, 1.94, 0.04, M.mat(RED), 0, 1.75, 0, g);
  M.rbox(0.8, 1.3, 0.05, 0.03, M.mat('#8a9097'), -0.6, 0.68, 0.96, g); // kapı
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.42), new THREE.MeshBasicMaterial({ map: textTex('BEMIS ENERJİ', { bg: RED, fg: '#ffffff', w: 512, h: 90 }) }));
  sign.position.set(0, 2.35, 0.2); g.add(sign);
  M.rbox(2.5, 0.5, 0.06, 0.02, M.mat('#ffffff'), 0, 2.35, 0.16, g);
  for (const x of [-1.0, 1.0]) M.cyl(0.04, 0.04, 0.5, 6, M.mat('#8a9097'), x, 2.1, 0.12, g);
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: textTex('⚡', { bg: '#ffd23f', fg: '#1d1d24', w: 128, h: 128, r: 20 }) }));
  warn.position.set(0.55, 1.0, 0.962); g.add(warn);
  for (const x of [-0.7, 0, 0.7]) { M.cyl(0.07, 0.09, 0.42, 8, M.mat('#7a5a3a'), x, 2.21, -0.4, g); M.cyl(0.02, 0.02, 0.2, 5, M.mat('#b9bec4'), x, 2.52, -0.4, g); }
  g.traverse((o) => { if (o.isMesh && !(o.material instanceof THREE.MeshBasicMaterial)) o.castShadow = true; });
  return g;
}

// h: world.js'ten { rcol, hint, icon }
export function energyRegion(R, h) {
  const C = R.content;
  const put = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; C.add(o); return o; };
  put(makeTrafo(), TRAFO[0], 0, TRAFO[1]); h.rcol(TRAFO[0] - 1.35, TRAFO[0] + 1.35, TRAFO[1] - 1.0, TRAFO[1] + 1.0);
  R.units = []; R.t = 0; R.payT = 4; R.boardT = 0;
  // 'sun' ya da 'wind' birimi k. yerine kurulur (kilit açılınca ya da kayıttan)
  R.addUnit = (kind, k, instant) => {
    if (R.units.some((u) => u.kind === kind && u.k === k)) return;
    const sun = kind === 'sun', x = sun ? SUN_X[k] : WIND_X[k], z = sun ? SUN_Z : WIND_Z;
    const obj = put(sun ? makeSolarArray() : makeTurbine(), x, 0, z);
    if (!instant) popIn(obj);
    if (sun) h.rcol(x - 2.15, x + 2.15, z - 0.8, z + 0.8);
    else h.rcol(x - 0.36, x + 0.36, z - 0.36, z + 0.36);
    R.units.push({ kind, k, x, z, obj, acc: 0 });
  };
  // genişletme arsalarına (expand-west.js) konumu verilen panel ya da türbin; key aynı üniteyi iki kez kurmaz
  R.addUnitAt = (kind, key, x, z, instant) => {
    if (R.units.some((u) => u.key === key)) return;
    const sun = kind === 'sun', obj = put(sun ? makeSolarArray() : makeTurbine(), x, 0, z);
    if (!instant) popIn(obj);
    if (sun) h.rcol(x - 2.15, x + 2.15, z - 0.8, z + 0.8); else h.rcol(x - 0.36, x + 0.36, z - 0.36, z + 0.36);
    R.units.push({ kind, k: -1, key, x, z, obj, acc: 0 });
  };
  R.payAt = () => new THREE.Vector3(TRAFO[0], 2.6, TRAFO[1]);
  R.activate = (instant) => {
    R.live = true;
    R.addUnit('sun', 0, instant);
    // üretim panosu: trafonun üstünde anlık kazanç
    R.board = document.createElement('div');
    R.board.className = 'hint near';
    R.board.innerHTML = '<span class="hi">⚡</span><span class="hx"><b>Bemis Enerji Parkı</b><small></small></span>';
    G.labels.add(R.board, (v) => v.set(TRAFO[0], 4.0, TRAFO[1]));
    h.hint(TRAFO[0], 2.6, TRAFO[1] + 1.2, '🏦', 'Enerji satışı', 'Paneller ve türbinler elektrik üretir, trafo şebekeye satar. Kazanç önündeki kasa kutusunda birikir: gidip topla ya da muhasebeci toplasın.', 3.0);
  };
  R.update = (dt) => {
    R.t += dt;
    // rüzgâr yavaşça güçlenip zayıflar (0,35-1,65), güneşi arada bulut kısar (0,84-1)
    const t = R.t, wind = 1 + 0.45 * Math.sin(t * 0.11) + 0.2 * Math.sin(t * 0.37 + 1.3), sun = 0.92 + 0.08 * Math.sin(t * 0.05 + 2);
    R.wind = wind; R.sun = sun;
    let rate = 0;
    for (const u of R.units) {
      const r = u.kind === 'sun' ? SUN_RATE * sun * ((G.mods && G.mods.enSun) || 1) : WIND_RATE * wind * ((G.mods && G.mods.enWind) || 1); // verim yükseltmeleri
      u.acc += r * dt; rate += r;
      if (u.kind === 'wind') u.obj.userData.rotor.rotation.z -= dt * (0.6 + 1.9 * wind);
    }
    // birikeni birkaç saniyede bir şebekeye satar: para trafonun önündeki kasa kutusunda birikir (account.js)
    R.payT -= dt;
    if (R.payT <= 0 && R.live) {
      R.payT = 5;
      let sum = 0;
      for (const u of R.units) { const n = Math.floor(u.acc); if (n >= 1) { u.acc -= n; sum += n; } }
      if (sum) toKasa('enerji', 'Enerji santrali', Math.round(sum * mult()), new THREE.Vector3(TRAFO[0], 2.6, TRAFO[1]), '⚡'); // santralin kasasında birikir (account.js)
    }
    R.boardT -= dt;
    if (R.board && R.boardT <= 0) {
      R.boardT = 0.5;
      const ns = R.units.filter((u) => u.kind === 'sun').length, nw = R.units.length - ns;
      const kw = Math.round(ns * 120 * sun + nw * 420 * wind);
      R.board.querySelector('small').textContent = `☀️ ${ns} · 🌬️ ${nw} · ${kw} kW · +${Math.round(rate * mult() * 60)} ₺/dk`;
    }
  };
  return R;
}
