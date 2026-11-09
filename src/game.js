// Oyun çekirdeği: ortak durum, taşıma yığını, uçuş animasyonları, istasyonlar, müşteriler
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCharacter, animateCharacter, randomLook, model, makeCucumber, makeHusk, makeWheat, makeWool, makeKilim, makeSheepMilk, makeYogurt, makeHayBale, makeTowel, makeLinen, makeFlourSack, makeSimit, makePogaca, makeMilkCan, makeCashDesk, makeRegister, faceRegister, villagerLook, makeMarker, makeBillMesh, makePlant, makeBed } from './models.js';
import { play, unlockAudio, speak } from './audio.js';
import { say, emoji } from './texts.js';
import { destColor, PLACES } from './dest.js';

const PI = Math.PI;
const V0 = new THREE.Vector3();
const TMPV = new THREE.Vector3();
const OFFV = new THREE.Vector3();
// nokta kameranın görüş alanı dışında mı (harita dışından gelen müşteriler ve araçlar orada hızlanır)
export function offscreen(p, m = 1.12) {
  if (!G.camera) return false;
  OFFV.set(p.x, p.y + 1, p.z).project(G.camera);
  return OFFV.z > 1 || Math.abs(OFFV.x) > m || Math.abs(OFFV.y) > m;
}

export const ITEMS = {
  domates:   { name: 'Domates',   price: 5,  model: 'tomato' },
  salatalik: { name: 'Salatalık', price: 7,  model: null },
  yumurta:   { name: 'Yumurta',   price: 10, model: 'egg' },
  sut:       { name: 'Süt',       price: 14, make: 'milkcan' }, // güğümde köy sütü
  peynir:    { name: 'Peynir',    price: 25, model: 'cheese' },
  karpuz:    { name: 'Karpuz',    price: 16, model: 'watermelon', cost: 8 },
  biber:     { name: 'Biber',     price: 8,  model: 'paprika', cost: 3 },
  patlican:  { name: 'Patlıcan',  price: 9,  model: 'eggplant', cost: 4 },
  kocan:     { name: 'Mısır koçanı', price: 4, make: 'husk', raw: true },
  misir:     { name: 'Mısır',     price: 10, model: 'corn' },
  dondurma:  { name: 'Dondurma',  price: 24, model: 'ice-cream' },
  bugday:    { name: 'Buğday',    price: 3,  make: 'wheat', raw: true },
  ekmek:     { name: 'Ekmek',     price: 8,  model: 'loaf-round' },
  corba:     { name: 'Çorba',     price: 12, model: 'bowl-soup' },
  yem:       { name: 'Yem',       price: 7,  model: 'bag' },
  yun:       { name: 'Yün',       price: 12, make: 'wool' },
  kilim:     { name: 'Kilim',     price: 45, make: 'kilim' },
  ksut:      { name: 'Koyun sütü', price: 12, make: 'smilk' },
  yogurt:    { name: 'Koyun yoğurdu', price: 22, make: 'yogurt' },
  saman:     { name: 'Saman', price: 5, make: 'hay', raw: true }, // ara ürün: satılmaz; atlı müşterinin bakım ücreti ayrı (riders.js PAY_HAY) // at ahırında atlara yedirilir
  un:        { name: 'Un', price: 3, make: 'flour', raw: true },   // fırında simit ve poğaçaya döner (carsi.js)
  simit:     { name: 'Simit', price: 9, make: 'simit' },
  pogaca:    { name: 'Poğaça', price: 11, make: 'pogaca' },
  kirli:     { name: 'Kirli çamaşır', price: 2, make: 'linen', raw: true }, // tatil köyünde boşalan evden toplanır
  havlu:     { name: 'Havlu', price: 12, make: 'towel' }, // çamaşırhanede kirliden yıkanır, misafire götürülür
};

export const G = {
  scene: null, camera: null, player: null, stack: null,
  money: 0, time: 0,
  stations: [], customers: [], flights: [], pops: [],
  labels: null, icons: {}, unlocked: new Set(), regions: {}, colliders: [],
  shout: { t: 0, cool: 0 }, nextPad: null, boost: 0,
  hooks: { coin: null, feel: null, react: null }, // feel: titreşim ve sarsıntı (his.js), react: müşteri beden tepkileri (tepki.js)
  upg: { cap: 0, spd: 0, cashier: 0, cashSpd: 0, shelver: 0, shCap: 0, shSpd: 0 },
  workers: [], speedMul: 1, menuOpen: false,
  custom: { name: 'Köy Bakkalı', awning: '#e8604c', wall: '#6fc7bb', shirt: '#3b8beb', named: false },
  stats: { earned: 0, regEarn: {}, customers: 0, sold: 0, caravans: 0, cars: 0, boosts: 0, time: 0 },
  ach: new Set(), paused: false, lastSave: 0,
};

// Rafta, tezgahta ve elde yüzlerce ürün birden durur. Her tür ilk yapılışta tek parçaya indirilir (parça renkleri köşe rengine
// geçer), sonraki ürünler bu örneğin kopyasıdır ve geometriyi paylaşır: 12 parçalı peynir 1 çizim çağrısı olur.
const PROTO = new Map();
export function makeItem(type) {
  let p = PROTO.get(type);
  if (!p) {
    const d = ITEMS[type];
    const MAKE = { husk: makeHusk, wheat: makeWheat, wool: makeWool, kilim: makeKilim, smilk: makeSheepMilk, yogurt: makeYogurt, hay: makeHayBale, towel: makeTowel, linen: makeLinen, flour: makeFlourSack, simit: makeSimit, pogaca: makePogaca, milkcan: makeMilkCan };
    const g = withDest(d.fn ? d.fn() : d.model ? model(d.model) : MAKE[d.make] ? MAKE[d.make]() : makeCucumber(), type); // fn: ürünü kendi dosyasında çizen (fishing.js)
    g.userData.type = type;
    shine(g);
    try { JSON.stringify(g.userData); } catch { return g; } // parçalarına başvuru tutan ürün kopyalanamaz: her seferinde yeniden çizilir
    p = flattenItem(g);
    PROTO.set(type, p);
  }
  return p.clone();
}
// ürünün gideceği yer (dest.js): tabanında o yerin renginde ince altlık. Yığında katların arasından renkli bant olarak, rafta
// ve tepside ürünün altından görünür; raf önündeki şeritle aynı renk. Ürün bir kabın içine alınır, ölçeği ve yeri bozulmaz
const DISC_GEO = new Map(), DISC_MAT = new Map();
const discGeo = (r, h) => { const k = `${r.toFixed(2)}|${h}`; if (!DISC_GEO.has(k)) DISC_GEO.set(k, new THREE.CylinderGeometry(r, r, h, 20)); return DISC_GEO.get(k); };
const discMat = (c) => { if (!DISC_MAT.has(c)) DISC_MAT.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })); return DISC_MAT.get(c); };
function withDest(g, type) {
  const col = destColor(type);
  if (!col) return g;
  const w = new THREE.Group(); w.add(g); w.userData = g.userData; g.userData = {};
  const b = new THREE.Box3().setFromObject(g);
  const r = Math.min(0.34, Math.max(0.16, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) * 0.4 + 0.07)), h = 0.05;
  const m = new THREE.Mesh(discGeo(r, h), discMat(col)); m.position.set((b.min.x + b.max.x) / 2, b.min.y + h / 2 - 0.012, (b.min.z + b.max.z) / 2); w.add(m);
  return w;
}
// düz renkli parlak parçalar köşe renkli tek geometride, aynı dokuyu paylaşan parçalar kendi aralarında birleşir;
// saydam ya da kendi ışıması olan parça ayrı kalır
const VC_MATS = new Map();
function vcMat(src) {
  const key = `${src.roughness.toFixed(2)}|${src.flatShading ? 1 : 0}|${src.side}`;
  let m = VC_MATS.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: src.roughness, metalness: 0, flatShading: src.flatShading, side: src.side });
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vColor.rgb * 0.2;
        float shineRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
        totalEmissiveRadiance += vec3(1.0, 0.96, 0.86) * shineRim * 0.6;`);
    };
    m.customProgramCacheKey = () => 'shineVC';
    VC_MATS.set(key, m);
  }
  return m;
}
const plainOk = (o) => !o.isSkinnedMesh && !o.isInstancedMesh && !Array.isArray(o.material) && o.material.isMeshStandardMaterial && !o.material.transparent
  && !o.material.vertexColors && o.geometry.attributes.position && o.geometry.attributes.normal && !o.geometry.morphAttributes.position;
const colorOk = (o) => !o.material.map && o.material.emissiveIntensity === 0.2 && o.material.emissive.equals(o.material.color);
const copyAttr = (a, size) => { const out = new Float32Array(a.count * size); for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k); return new THREE.BufferAttribute(out, size); };
function flattenItem(g) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert(), parts = new Map(), rest = [];
  let total = 0;
  g.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    total++;
    const mtx = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld), src = o.geometry, n = src.attributes.position.count;
    const vc = plainOk(o) && colorOk(o), tx = plainOk(o) && !vc && (!o.material.map || src.attributes.uv);
    if (!vc && !tx) { rest.push([o, mtx]); return; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', copyAttr(src.attributes.position, 3));
    geo.setAttribute('normal', copyAttr(src.attributes.normal, 3));
    if (vc) {
      const col = new Float32Array(n * 3), c = o.material.color;
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    } else if (o.material.map) geo.setAttribute('uv', copyAttr(src.attributes.uv, 2));
    const idx = src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i);
    if (mtx.determinant() < 0) for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } // aynalı parçanın yüzleri ters dönmesin
    geo.setIndex(idx);
    geo.applyMatrix4(mtx);
    const m = vc ? vcMat(o.material) : o.material;
    if (!parts.has(m)) parts.set(m, []);
    parts.get(m).push(geo);
  });
  if (parts.size + rest.length >= total) return g; // birleştirecek bir şey yok
  const p = new THREE.Group();
  p.position.copy(g.position); p.quaternion.copy(g.quaternion); p.scale.copy(g.scale);
  p.userData = g.userData;
  for (const [m, list] of parts) {
    const geo = mergeGeometries(list, false);
    for (const l of list) l.dispose();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = mesh.receiveShadow = true; p.add(mesh);
  }
  for (const [o, mtx] of rest) { const c = o.clone(false); mtx.decompose(c.position, c.quaternion, c.scale); p.add(c); }
  return p;
}
// toplanabilir ürün bir tık parlak: tezgahta, rafta ve elde dekordan ayırt edilsin. Malzeme kaynağı başına bir kez
// kopyalanır; aynı malzemeyi kullanan dekor (saman balyası, un çuvalı yığını) eski haliyle kalır
const SHINY = new Map();
function shine(g) {
  const glow = (m) => {
    if (!m || !m.isMeshStandardMaterial) return m;
    let c = SHINY.get(m);
    if (!c) {
      c = m.clone();
      if (m.emissive.getHex() === 0) {
        if (m.map) { c.emissiveMap = m.map; c.emissive.setRGB(1, 1, 1); } else c.emissive.copy(m.color);
        c.emissiveIntensity = 0.2;
      }
      c.roughness = Math.min(m.roughness, 0.5);
      // kenar ışığı: ürünün silueti açık renk bir hareyle zeminden (yeşil tepsideki salatalık gibi) ayrılır
      c.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float shineRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
          totalEmissiveRadiance += vec3(1.0, 0.96, 0.86) * shineRim * 0.6;`);
      };
      c.customProgramCacheKey = () => 'shine';
      SHINY.set(m, c); SHINY.set(c, c);
    }
    return c;
  };
  g.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(glow) : glow(o.material); });
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function lerpAngle(a, b, t) {
  let d = (b - a) % (PI * 2);
  if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2;
  return a + d * t;
}

// ---------- ses ----------
export function initAudio() { unlockAudio(); }
const SFX_MAP = { pop: 'pick' };
// ses kuralı: oyuncunun kendi işi duyulur. Elemanların ve müşterilerin işi sessizdir (npc).
// Olaylar (at: konum) yakındaysa duyulur; 6 birimden sonra kısılır, 16 birimden uzakta hiç çalmaz.
export function sfx(name, o = {}) {
  if (o.npc) return;
  let vol = o.vol ?? 1;
  if (o.at && G.player) {
    const d = Math.hypot(o.at.x - G.player.position.x, o.at.z - G.player.position.z);
    if (d > 16) return;
    if (d > 6) vol *= 1 - (d - 6) / 10;
  }
  play(SFX_MAP[name] || name, { ...o, vol });
}
// konuşma da yalnızca yakındaki müşteriden duyulur
const near = (pos, r) => G.player && Math.hypot(pos.x - G.player.position.x, pos.z - G.player.position.z) < r;

// efsane bonusu (final.js): bütün kilitler açıldıktan sonraki her seviye kalıcı +%2 gelir, en çok +%100. Sıfırlama yok, oyun sürer
export const LEGEND = { per: 0.02, max: 1 };
export const legendK = () => (G.stats && G.stats.legendLv ? 1 + Math.min(LEGEND.max, LEGEND.per * Math.max(0, (G.level || 0) - G.stats.legendLv)) : 1);
// Bereket sandığı açıkken kazanç 2 kat
export const mult = () => (G.boost > 0 ? 2 : 1) * legendK();

// ---------- kayıt ----------
const KEY = 'koyBakkali.v1';
export function save() {
  if (G.visit) return; // komşunun köyündeyken kendi kaydının üstüne yazılmaz (online-ui.js)
  try {
    localStorage.setItem(KEY, JSON.stringify(saveData()));
    G.lastSave = Date.now();
  } catch (e) { /* kayıt yok */ }
}
// yerdeki para yığını konumundan tanınır (bölgeler her açılışta aynı yere kurar)
export const pileKey = (s) => `${Math.round(s.zone.x * 10)}:${Math.round(s.zone.z * 10)}`;
export function saveData() {
  // yarım ödenmiş kilitler ve toplanmamış para yığınları da kaydedilir: sayfa yenilenince para kaybolmasın
  const pads = {}, piles = {};
  for (const s of G.stations) {
    if (s instanceof UnlockPad && s.paid >= 1) pads[s.def.id] = Math.floor(s.paid);
    else if (s instanceof MoneyPile && s.amount >= 1) piles[pileKey(s)] = (piles[pileKey(s)] || 0) + Math.floor(s.amount);
  }
  return { v: 2, pzV: 1, money: Math.floor(G.money), xp: Math.floor(G.xp || 0), unlocked: [...G.unlocked], upg: G.upg, custom: G.custom, stats: G.stats, ach: [...G.ach], pads, piles, ...(G.fide ? { fide: G.fide } : {}) }; // fide: bostanların fide sayısı
}
export function writeSave(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}
export function loadSave() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* yok */ } }

// ---------- HTML etiketleri ----------
// pencerenin boyu: karede innerWidth/innerHeight okumak, aynı karede değişen yazılar yüzünden tarayıcıya bütün sayfanın yerleşimini kare
// ortasında yeniden hesaplatıyordu (2026-11-05 denetimi: telefonda kamera ve bildirim okları oyun karesinin ~%15'i). Boy yalnız pencere
// değişince okunur
export const VIEW = { w: innerWidth, h: innerHeight };
addEventListener('resize', () => { VIEW.w = innerWidth; VIEW.h = innerHeight; });
const LABEL_TILT = Math.cos(Math.atan2(18.5, 15)); // varsayılan kamera açısında dikey yüksekliğin ekrandaki payı
export class Labels {
  constructor(root) { this.root = root; this.list = []; this.v = new THREE.Vector3(); this.meas = []; }
  // boyu ölçülecek etiketler karenin başında (sayfa yerleşimi henüz temizken, main.js tick) topluca ölçülür: döngünün içinde okumak,
  // önceki etiketlere yazılan konum yüzünden her ölçümde yerleşimi yeniden hesaplatıyordu
  measure() { for (const L of this.meas) { L.mq = false; if (L.el.isConnected) L.sz = [L.el.offsetWidth, L.el.offsetHeight]; } this.meas.length = 0; }
  add(el, fn, life) {
    this.root.appendChild(el);
    const L = { el, fn, life, hidden: false };
    this.list.push(L);
    return L;
  }
  remove(L) {
    if (!L) return;
    L.el.remove();
    const i = this.list.indexOf(L);
    if (i >= 0) this.list.splice(i, 1);
  }
  // Etiketin yerdeki dayanağı ekrana izdüşürülür, yüksekliği ise kamera açısından bağımsız sabit bir ekran payı
  // olarak eklenir: kamera eğilip dönünce etiket nesnesinin üstünde aynı yerde kalır, yakınlaşınca orantılı büyür.
  update(camera, w, h, dt) {
    const v = this.v, b = this.b || (this.b = new THREE.Vector3()), c = this.c || (this.c = new THREE.Vector3());
    const k = (h / 2) / Math.tan((camera.fov * PI) / 360); // 1 birimlik yüksekliğin 1 birim uzaklıktaki piksel karşılığı
    // tüm yazılar kapalıyken (hudmenu.js 🏷️) yer hesabı yapılmaz; yalnız süreli yazıların (yüzen para) ömrü işler
    if (G.labelsOff) { for (let i = this.list.length - 1; i >= 0; i--) { const L = this.list[i]; if (L.life !== undefined && (L.life -= dt) <= 0) this.remove(L); } return; }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const L = this.list[i];
      if (L.life !== undefined) { L.life -= dt; if (L.life <= 0) { this.remove(L); continue; } }
      if (L.hidden) { hideL(L); continue; }
      L.fn(v);
      b.set(v.x, 0, v.z);
      const depth = -c.copy(b).applyMatrix4(camera.matrixWorldInverse).z;
      b.project(camera);
      if (depth < 1 || b.z > 1 || b.x < -1.3 || b.x > 1.3 || b.y < -1.4 || b.y > 1.3) { hideL(L); continue; }
      // çok uzaklaşınca ipuçları gizlenir (yakındaki açık ipucu kalır): harita etiket yığınına dönmesin
      if (G.farLabels && L.el.classList.contains('hint') && !L.el.classList.contains('near')) { hideL(L); continue; }
      if (L.off !== false) { L.off = false; L.el.style.display = ''; }
      const px = (b.x * 0.5 + 0.5) * w, py = (-b.y * 0.5 + 0.5) * h - (v.y * LABEL_TILT * k) / depth;
      // kendi ölçeğini taşımayan etiketler (ipucu, kilit, fiyat, yüzen yazı) uzaklaştıkça dünyayla birlikte küçülür (main.js G.labelScale);
      // balon, eleman adı ve sipariş kutusu zaten --az / --lz ile ölçekleniyor
      if (L.own === undefined) L.own = L.el.matches('.bubble, .staff, .order');
      const s = L.own ? 1 : G.labelScale || 1;
      let qx = px, qy = py;
      // bilgi kutusu, olgunluk rozeti, kilit ve fiyat ekranın içinde tutulur (telefonda kenara gelince yarısı dışarıda kalıyordu).
      // Yalnız dayanağı ekranda olan içeri çekilir (ekranın üstündeki nesnelerin kutuları tepeye yığılmasın). Boyu saniyede bir
      // ölçülür; görünen kutunun ortası (px, py - yükseklik/2), yarı boyları ölçekle küçülür
      if (L.keep === undefined) L.keep = L.el.matches('.hint, .ripe, .pad, .lock');
      if (L.keep && px >= 0 && px <= w && py >= 0 && py <= h) {
        if ((!L.sz || (L.szT -= dt) <= 0) && !L.mq) { L.mq = true; L.szT = 1; this.meas.push(L); } // ölçüm bir sonraki karenin başında
        const [ew, eh] = L.sz || [0, 0], hw = (ew * s) / 2, hh = (eh * s) / 2, top = w <= 640 ? 46 : 8, cy = py - eh / 2;
        if (ew && w > 2 * hw + 16) qx = Math.min(w - 8 - hw, Math.max(8 + hw, px));
        if (eh && h > 2 * hh + top + 8) qy = Math.min(h - 8 - hh, Math.max(top + hh, cy)) + eh / 2;
      }
      // yer ve ölçek değişmediyse yazılmaz (kamera dururken etiketlerin çoğu yerinde kalır)
      const tx = Math.round(qx * 10), ty = Math.round(qy * 10), ts = s < 0.995 ? Math.round(s * 1000) : 1000;
      if (tx !== L.tx || ty !== L.ty || ts !== L.ts) {
        L.tx = tx; L.ty = ty; L.ts = ts;
        L.el.style.transform = `translate(${(tx / 10).toFixed(1)}px,${(ty / 10).toFixed(1)}px) translate(-50%,-100%)${ts < 1000 ? ` scale(${(ts / 1000).toFixed(3)})` : ''}`;
      }
    }
  }
}

function hideL(L) { if (!L.off) { L.off = true; L.el.style.display = 'none'; } } // görünürlük değişmedikçe yazılmaz

export function floatText(pos, text, cls = '') {
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.textContent = text;
  const p = pos.clone();
  const t0 = G.time;
  G.labels.add(el, (v) => v.set(p.x, p.y + 2.2 + (G.time - t0) * 1.6, p.z), 1.0);
}

export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// ---------- uçuş ve zıplama animasyonları ----------
export function fly(obj, target, local, dur = 0.28, arc = 1.1, onDone) {
  for (let i = G.flights.length - 1; i >= 0; i--) if (G.flights[i].obj === obj) G.flights.splice(i, 1);
  G.scene.attach(obj);
  const f = { obj, target, local: local ? local.clone() : null, t: 0, dur, arc, from: obj.position.clone(), onDone };
  G.flights.push(f);
  return f;
}

const easeBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export function popIn(obj, delay = 0) {
  const base = obj.scale.x || 1;
  obj.scale.setScalar(0.0001);
  G.pops.push({ obj, t: -delay, mode: 'in', base });
}
export function bounce(obj, amt = 0.15) {
  if (G.pops.some((p) => p.obj === obj)) return;
  G.pops.push({ obj, t: 0, mode: 'b', base: obj.scale.x || 1, amt });
}

export function updateCore(dt) {
  const tmp = new THREE.Vector3();
  for (let i = G.flights.length - 1; i >= 0; i--) {
    const f = G.flights[i];
    f.t += dt / f.dur;
    const t = Math.min(1, f.t);
    const to = f.target.isObject3D ? f.target.localToWorld(tmp.copy(f.local)) : f.target;
    const e = 1 - Math.pow(1 - t, 3); // hızlı kalkar, yumuşak iner
    f.obj.position.lerpVectors(f.from, to, e);
    f.obj.position.y += Math.sin(PI * t) * f.arc;
    if (t >= 1) {
      G.flights.splice(i, 1);
      if (f.target.isObject3D) { f.target.attach(f.obj); f.obj.position.copy(f.local); f.obj.rotation.set(0, 0, 0); }
      if (f.onDone) f.onDone(f.obj);
    }
  }
  for (let i = G.pops.length - 1; i >= 0; i--) {
    const p = G.pops[i];
    p.t += dt / 0.45;
    if (p.t < 0) continue;
    const t = Math.min(1, p.t);
    const s = p.mode === 'in' ? easeBack(t) : 1 + Math.sin(t * PI) * p.amt;
    p.obj.scale.setScalar(Math.max(0.0001, p.base * s));
    if (t >= 1) { p.obj.scale.setScalar(p.base); G.pops.splice(i, 1); }
  }
}

// ---------- taşıma yığını ----------
// ürünün kendi ekseninde arka yarı derinliği (ölçeksiz): yığında kafaya ne kadar yaklaştığı (Stack.update)
const DB = new THREE.Box3(), DM = new THREE.Box3(), DX = new THREE.Matrix4(), DY = new THREE.Matrix4(), HEADV = new THREE.Vector3();
function backDepth(o) {
  DB.makeEmpty(); o.updateMatrixWorld(true); DX.copy(o.matrixWorld).invert();
  o.traverse((m) => { if (!m.isMesh) return; if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); DB.union(DM.copy(m.geometry.boundingBox).applyMatrix4(DY.multiplyMatrices(DX, m.matrixWorld))); });
  return DB.isEmpty() ? 0.15 : Math.max(0, -DB.min.z);
}
export class Stack {
  constructor(holder, cap, y = 0.95, z = 0.5) {
    this.holder = holder; this.cap = cap; this.items = [];
    this.anchor = new THREE.Group();
    const k = holder.userData && holder.userData.rig ? holder.userData.rig.scale.x : 1; // küçük gövdeli karakterde kolların hizası
    this.anchor.position.set(0, y * k, z * k);
    holder.add(this.anchor);
    this.head = (holder.userData && holder.userData.head) || null; this.hr = 0.31 * k + 0.02; // kafa küresi (models.js makeCharacter, yarıçap 0,31) ve 2 cm pay
  }
  get full() { return this.items.length >= this.cap; }
  count(type) { let n = 0; for (const i of this.items) if (i.type === type) n++; return n; }
  slot(i) { let y = 0; for (let k = 0; k < i; k++) y += this.items[k].h; return new THREE.Vector3(0, y, 0); }
  push(type, obj, dur = 0.18) {
    const it = { type, obj, h: (obj.userData.h || 0.3) * 0.92, flying: true };
    this.items.push(it);
    if (G.hooks.got) G.hooks.got(type, this); // koleksiyon albümü ve haftalık etkinlik (album.js)
    fly(obj, this.anchor, this.slot(this.items.length - 1), dur, 0.7, (o) => { it.flying = false; bounce(o, 0.16); }); // yığına oturunca hafif sekme
    return it;
  }
  takeOf(types) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.flying) continue;
      if (types === '*' || types.includes(it.type)) {
        this.items.splice(i, 1);
        G.scene.attach(it.obj);
        return it;
      }
    }
    return null;
  }
  // yığın, taşıyanın hızına göre yay gibi sallanır; durunca hafifçe salınıp oturur. Kafa hizasındaki kat kafanın önünde kalır
  // (2026-11-06 kullanıcı: "bazı ürünleri taşırken koşarken kafasının içine giriyor ürünler"): büyük ürünler (turşu fıçısı, halı,
  // karpuz, güveç) dururken, orta boylar koşarken yığın geriye sallanınca kafaya giriyordu. Kafaya değen kat öne itilir, üstündeki
  // kule de onunla birlikte kayar; sallanmanın biçimi kalır
  update(dt) {
    const hp = this.holder.getWorldPosition(TMPV);
    if (!this.prev) this.prev = hp.clone();
    const idt = 1 / Math.max(dt, 1e-4);
    // hız süzülür: telefonda kare süreleri dalgalanınca ölçülen hız sıçrıyor, yığın ileri geri sallanıyordu (2026-11-01)
    const cl = (v) => Math.max(-12, Math.min(12, v)), kf = 1 - Math.exp(-10 * dt);
    this.fvx = (this.fvx || 0) + (cl((hp.x - this.prev.x) * idt) - (this.fvx || 0)) * kf;
    this.fvz = (this.fvz || 0) + (cl((hp.z - this.prev.z) * idt) - (this.fvz || 0)) * kf;
    const vx = this.fvx, vz = this.fvz;
    this.prev.copy(hp);
    const ry = this.holder.rotation.y, c = Math.cos(ry), s = Math.sin(ry);
    const lx = vx * c - vz * s, lz = vx * s + vz * c;
    const k = 1 - Math.exp(-18 * dt), n = this.items.length, hd = n ? this.head : null, R = this.hr;
    let y = 0, hy = 0, hz = 0, push = 0;
    if (hd) { this.holder.worldToLocal(hd.getWorldPosition(HEADV)); hy = HEADV.y - this.anchor.position.y; hz = HEADV.z - this.anchor.position.z; } // kafanın merkezi, çıpaya göre
    for (let i = 0; i < n; i++) {
      const it = this.items[i];
      if (!it.flying) {
        const f = (i + 1) / Math.max(5, n);
        const tx = Math.max(-0.35, Math.min(0.35, -lx * 0.035 * f)), tz = Math.max(-0.35, Math.min(0.35, -lz * 0.035 * f));
        it.vx = (it.vx || 0) + ((tx - (it.sx || 0)) * 170 - (it.vx || 0) * 15) * dt; it.sx = (it.sx || 0) + it.vx * dt;
        it.vz = (it.vz || 0) + ((tz - (it.sz || 0)) * 170 - (it.vz || 0) * 15) * dt; it.sz = (it.sz || 0) + it.vz * dt;
        let z = it.sz, zmin = -Infinity;
        if (hd) {
          if (it.bz == null) it.bz = backDepth(it.obj);
          const dy = Math.max(0, y - hy, hy - y - it.h); // kafanın merkezinden bu katın boyuna dikey uzaklık
          if (dy < R) { zmin = hz + Math.sqrt(R * R - dy * dy) + it.bz * it.obj.scale.z; push = Math.max(push, zmin - z); }
          z += push;
        }
        it.obj.position.x += (it.sx - it.obj.position.x) * Math.min(1, k * 2.5);
        it.obj.position.z = Math.max(zmin, it.obj.position.z + (z - it.obj.position.z) * Math.min(1, k * 2.5));
        it.obj.position.y += (y - it.obj.position.y) * k;
      }
      y += it.h;
    }
  }
}

// ---------- istasyonlar ----------
export class Zone {
  constructor(x, z, w, d) { this.x = x; this.z = z; this.w = w; this.d = d; }
  has(p) { return Math.abs(p.x - this.x) <= this.w / 2 && Math.abs(p.z - this.z) <= this.d / 2; }
}

// Etkileşim yerde kutuyla değil nesnenin çevresiyle: oyuncunun gövdesi istasyonun nesnesine (ön alanına bitişik
// masa, tepsi, raf, bina engelleri) her yönden değince başlar. Eski ön alan da geçerli kalır, elemanlar orada durur.
// Yerde yalnızca kilit alanlarının kesikli çerçevesi çizilir.
const REACH = 0.8, NEAR_GAP = 0.45, CHAIN_GAP = 0.6, BODY_MAX = 6, BODY_CLIP = 4.6;
// toplanan kaynaklar (bostan, kümes, tepsi): bir tık daha yakına gelmek ve kısa bir an durmak gerekir, yanından geçerken yanlışlıkla toplanmaz
const PICK_REACH = 0.66, PICK_DWELL = 0.16; // 2026-11-08: 0,58'den (kullanıcı: "bir tık kolaylaştır ... hafif rahatlat")
// bostanda oyuncu yalnız üstünden geçtiği fideyi toplar (2026-11-05 kullanıcı: "salatalık tarlasından geçerken üstünden geçtiğim
// salatalıkları alsın geçmediklerimi almasın"): eskiden bostana girince olgun olan hangisiyse alınıyordu. Fideler 2 m × 1,4 m arayla.
// 2026-11-08 kullanıcı: "tarlalarda tek tek yapışmam lazım gibi olmuş onu rahatlat eskisine yaklaş ... ama eskisi kadar kolay yapma": 0,8'den 1,3'e.
// Ortadan geçen dördünü de alır, tek sıranın üstünden geçen yalnız o sırayı (sıralar arası 1,4 m), yatağın köşesini sıyıran yakınındakini
// Aynı gün ikinci kez: "tam üstünde olmadan da toplasın hafif rahatlat": 1,6 ve toplama alanı yatağın kenarından 0,2 m taşar (PlantBed)
const BED_PICK = 1.6;
const touch = (c, a, g) => c[0] - g <= a[1] && c[1] + g >= a[0] && c[2] - g <= a[3] && c[3] + g >= a[2];
const zoneDist = (z, p) => Math.hypot(Math.max(Math.abs(p.x - z.x) - z.w / 2, 0), Math.max(Math.abs(p.z - z.z) - z.d / 2, 0));
function autoBody(z) {
  const r = [z.x - z.w / 2, z.x + z.w / 2, z.z - z.d / 2, z.z + z.d / 2];
  const clip = [r[0] - BODY_CLIP, r[1] + BODY_CLIP, r[2] - BODY_CLIP, r[3] + BODY_CLIP];
  // duvar ve çit gibi uzun engeller gövde sayılmaz: duvarın arkasından ya da çitin öbür ucundan etkileşim olmasın
  const wallish = (c) => { const a = c[1] - c[0], b = c[3] - c[2]; return Math.max(a, b) > BODY_MAX || (Math.min(a, b) < 0.7 && Math.max(a, b) > 2.4); };
  const pool = G.colliders.filter((c) => !wallish(c) && touch(c, clip, 0));
  // ön alana değen engeller ve onlara bitişik olanlar (masa → bina); zincir tek adım: varilden ağaca, ağaçtan duvar dışına taşmasın
  const first = pool.filter((c) => touch(c, r, NEAR_GAP)), out = [...first];
  for (const a of first) for (const c of pool) if (!out.includes(c) && touch(c, a, CHAIN_GAP)) out.push(c);
  return out;
}

export class Station {
  constructor(x, z, w, d, o = {}) {
    this.zone = new Zone(x, z, w, d);
    this.t = 0; this.inside = false;
    if (o.dashed && !o.noMarker) {
      this.marker = makeMarker(w, d, !!o.dashed);
      this.marker.position.set(x, o.y ?? 0.05, z);
      G.scene.add(this.marker);
      if (!o.instant) popIn(this.marker);
    }
    G.stations.push(this);
  }
  // gövde: hareketli nesnede (araba, kervan) bodyFn, yoksa ön alana bitişik engellerden kendiliğinden (engel sayısı değişince yenilenir)
  bodyRects() {
    if (this.bodyFn) return this.bodyFn() || [];
    if (this.bodyN !== G.colliders.length) { this.bodyN = G.colliders.length; this.bodyC = autoBody(this.zone); }
    return this.bodyC;
  }
  near(p) {
    const z = this.zone;
    if (z.has(p)) return !this.yields(p);
    const own = !!this.bodyFn, x0 = z.x - z.w / 2 - BODY_CLIP, x1 = z.x + z.w / 2 + BODY_CLIP, z0 = z.z - z.d / 2 - BODY_CLIP, z1 = z.z + z.d / 2 + BODY_CLIP;
    for (const c of this.bodyRects()) {
      // büyük binanın ön alandan uzak kısmı istasyonu tetiklemez
      const b0 = own ? c[0] : Math.max(c[0], x0), b1 = own ? c[1] : Math.min(c[1], x1), b2 = own ? c[2] : Math.max(c[2], z0), b3 = own ? c[3] : Math.min(c[3], z1);
      const dx = Math.max(b0 - p.x, 0, p.x - b1), dz = Math.max(b2 - p.z, 0, p.z - b3);
      const r = this.reach ?? REACH;
      if (dx * dx + dz * dz <= r * r && !this.yields(p, c)) return true;
    }
    return false;
  }
  // yan yana alım ve bırakım (makinenin girdisi ile çıktısı, tepsi ile raf) aynı gövdeyi paylaşınca gövdeye değmek ikisini birden
  // tetikliyordu (2026-11-03 kullanıcı: "sahil büfesine mısır bırakırken otomatik pişmiş olanları veriyor"). Ortak gövdede ön alanı
  // oyuncuya daha yakın olan karşı rol (role: 'give' veren, 'take' alan) kazanır; ön alanlar üst üste binmişse (yan yana dokuma
  // tezgahları) merkezi daha yakın olan. Eşitlikte veren çekilir
  yields(p, c) {
    if (!this.role) return false;
    const give = this.role === 'give', wins = (a, b) => a < b || (give && a === b);
    const zc = (z) => Math.hypot(p.x - z.x, p.z - z.z), d = c ? zoneDist(this.zone, p) : zc(this.zone);
    for (const o of G.stations) {
      if (o === this || !o.role || o.role === this.role) continue;
      if (c ? wins(zoneDist(o.zone, p), d) && o.bodyRects().includes(c) : o.zone.has(p) && wins(zc(o.zone), d)) return true;
    }
    return false;
  }
  setInside(v) {
    if (v === this.inside) return;
    this.inside = v;
    if (this.marker) this.marker.material.opacity = v ? 1 : 0.7;
    if (!v) this.t = 0;
  }
  update() {}
  remove() {
    if (this.marker) G.scene.remove(this.marker);
    const i = G.stations.indexOf(this);
    if (i >= 0) G.stations.splice(i, 1);
  }
}

// Bostan: 4 fide, olgunlaşan ürünü oyuncu toplar
// fide fide açılan bostan (2026-10-28 kullanıcı: "4'lü açılmasın, tek tek slot slot açılsın"): o.fide verilen bostan (köy bahçesi,
// bölümlerin bostanları) o.start fideyle (1) açılır; sıradaki fidenin yerinde küçük kilit durur, ödenince fide dikilir (en çok 4).
// Fide sayısı kayıtta G.fide[anahtar]; eski kayıtta (G.fide null) açılmış bostanlar dolu (4) gelir. o.fide: fide fiyatının tabanı
const FIDE_AT = [[-1, 0.7], [1, 0.7], [-1, -0.7], [1, -0.7]]; // önce ön sıra
const FIDE_PRICE = [0, 0, 0.35, 0.5, 0.7]; // 2., 3., 4. fide: tabanın payı
export const bedKey = (type, x, z) => `${type}@${Math.round(x * 10)}:${Math.round(z * 10)}`;
export class PlantBed extends Station {
  constructor(parent, x, z, type, grow, o = {}) {
    super(x, z, 4.4, 3.4, { y: 0.03, instant: o.instant }); // toplama alanı yatağın (4×3) kenarından 0,2 m taşar: yanından yürürken de toplanır (2026-11-08; eskiden 3,5×2,5 içindeydi)
    this.type = type; this.grow = grow; this.baseGrow = grow; this.plants = [];
    this.parent = parent; this.x = x; this.z = z; this.fide = o.fide || 0; this.key = bedKey(type, x, z);
    (G.soft || (G.soft = [])).push([x - 2.0, x + 2.0, z - 1.5, z + 1.5]); // yürüyenler tarlanın içinden geçmez, dolanır (oyuncu içinde gezer)
    const bed = makeBed(4.0, 3.0); bed.position.set(x, 0, z); parent.add(bed); if (!o.instant) popIn(bed); // düz toprak: kenar ve çıkıntı yok, içinde yürünür
    this.bodyFn = () => null; // bostanın alanı yatağın kendisi; yandaki traktör ya da ağaç bostan sayılmaz
    const n = !this.fide || !G.fide ? 4 : Math.max(1, Math.min(4, G.fide[this.key] ?? o.start ?? 1));
    for (let i = 0; i < n; i++) this.addPlant(o.instant);
    if (this.fide && G.fide) { G.fide[this.key] = n; this.padNext(); }
  }
  addPlant(instant) {
    const [px, pz] = FIDE_AT[this.plants.length], p = makePlant(this.type);
    p.position.set(this.x + px, 0.02, this.z + pz); // fide doğrudan toprağa dikili
    p.rotation.y = Math.random() * PI * 2;
    const fr = p.userData.front; // meyve fide dönse de hep önde (kameraya bakan yanda) dursun: yeri ve yönü dönüşün tersine
    if (fr) { const a = p.rotation.y; p.userData.fruit.position.set(fr[0] * Math.cos(a) - fr[2] * Math.sin(a), fr[1], fr[0] * Math.sin(a) + fr[2] * Math.cos(a)); p.userData.fruit.rotation.y = -a + (Math.random() - 0.5) * 0.6; }
    this.parent.add(p);
    if (!instant) popIn(p, 0.1 + Math.random() * 0.2);
    this.plants.push({ obj: p, anchor: p.userData.fruit, fruit: null, t: this.grow * (0.4 + Math.random() * 0.6), x: this.x + px, z: this.z + pz });
  }
  // sıradaki fidenin yerinde küçük kilit: üstünde durunca para akar, dolunca fide dikilir ve bir sonrakinin kilidi çıkar
  padNext() {
    const n = this.plants.length;
    if (n >= 4) return;
    const [px, pz] = FIDE_AT[n], price = Math.max(15, Math.round((this.fide * FIDE_PRICE[n + 1]) / 5) * 5);
    const def = { id: `fide:${this.key}:${n + 1}`, at: [this.x + px, this.z + pz], title: `${n + 1}. fide`, icon: '🌱', price, size: 1.3, y: 0.04 };
    this.pad = new UnlockPad(def, () => {
      this.pad = null; this.addPlant(false); sfx('unlock');
      G.fide[this.key] = this.plants.length; save();
      this.padNext();
    });
  }
  update(dt) {
    for (const p of this.plants) {
      if (!p.fruit) {
        p.t += dt;
        if (p.t >= this.grow) { p.fruit = makeItem(this.type); p.fruit.scale.setScalar(0.05); p.anchor.add(p.fruit); }
      } else if (p.fruit.scale.x < 1) p.fruit.scale.setScalar(Math.min(1, p.fruit.scale.x + dt * 2));
    }
    this.dwell = this.inside ? (this.dwell || 0) + dt : 0;
    if (!this.inside || this.dwell < PICK_DWELL) return;
    this.t += dt;
    if (this.t >= 0.07 && this.harvestTo(G.stack, G.player.position)) this.t = 0;
  }
  // elemanlar için ortak kaynak arayüzü: avail() / give(stack)
  avail() { return this.ripeCount(); }
  give(stack) { return this.harvestTo(stack); }
  ripeCount() { let n = 0; for (const p of this.plants) if (p.fruit && p.fruit.scale.x >= 1) n++; return n; }
  // at: oyuncunun yeri, yalnız altındaki fideden alır; eleman ve köy kamyonu (at yok) herhangi bir olgun fideden
  harvestTo(stack, at) {
    if (stack.full) return false;
    let p = null, bd = BED_PICK;
    for (const q of this.plants) {
      if (!q.fruit || q.fruit.scale.x < 1) continue;
      if (!at) { p = q; break; }
      const d = Math.hypot(q.x - at.x, q.z - at.z);
      if (d < bd) { p = q; bd = d; }
    }
    if (!p) return false;
    stack.push(this.type, p.fruit); p.fruit = null; bounce(p.obj, 0.12); sfx('pop', { npc: stack !== G.stack });
    p.t = -this.grow * Math.random() * 0.4; // fideler hep birlikte değil, ayrı ayrı olgunlaşır: ürün bir anda yığılmaz
    return true;
  }
}

// Üretici: belirli aralıkla ürün üretip tepsiye dizer (mısır kazanı, fırın...)
export class Generator extends Station {
  constructor(parent, o) {
    super(o.zx, o.zz, o.zw ?? 2.6, o.zd ?? 1.5, { y: o.my, instant: o.instant });
    this.type = o.type; this.interval = o.interval; this.max = o.max; this.origin = o.origin;
    this.baseInterval = o.interval; this.baseMax = o.max;
    this.items = []; this.gt = 0; this.reach = PICK_REACH; this.role = 'give';
    this.tray = new THREE.Group();
    this.tray.position.set(o.tray[0], o.tray[1], o.tray[2]);
    parent.add(this.tray);
  }
  slot(i) {
    const c = i % 6, l = Math.floor(i / 6);
    const h = makeItemHeight(this.type);
    return new THREE.Vector3(-0.5 + (c % 3) * 0.5, l * h * 0.9, -0.18 + Math.floor(c / 3) * 0.38);
  }
  avail() { return this.items.length; }
  give(stack) { return this.takeTo(stack); }
  update(dt) {
    this.gt = Math.min(this.gt + dt, this.interval);
    if (this.items.length < this.max && this.gt >= this.interval && (!this.canMake || this.canMake())) {
      this.gt = 0;
      if (this.onMake) this.onMake();
      const it = makeItem(this.type);
      it.position.copy(this.origin);
      G.scene.add(it);
      this.items.push(it);
      fly(it, this.tray, this.slot(this.items.length - 1), 0.4, 0.9);
    }
    this.dwell = this.inside ? (this.dwell || 0) + dt : 0;
    if (!this.inside || this.dwell < PICK_DWELL) return;
    this.t += dt;
    if (this.t >= 0.07 && this.takeTo(G.stack)) this.t = 0;
  }
  takeTo(stack) {
    if (stack.full || !this.items.length) return false;
    stack.push(this.type, this.items.pop());
    sfx('pop', { npc: stack !== G.stack });
    return true;
  }
}
const hcache = {};
function makeItemHeight(type) {
  if (hcache[type] === undefined) hcache[type] = makeItem(type).userData.h || 0.3;
  return hcache[type];
}

// Raf / tezgah: oyuncu ürün koyar, müşteri alır
// kendi elinle bonusu: senin dizdiğin ürünü alan müşteri %20 fazla öder, kasada sen servis edince %15 bahşiş bırakır.
// Elemanların dizdiği ürün ve kasiyerin servisi normal fiyat
export const MINE = 1.2, MINE_TIP = 0.15;
// fiyat çarpanı (2026-10-28 kullanıcı: "çok kolay olmasın, koşmamız gereksin"): yükseltme, işe alım, kilit, bölüm genişlemesi ve
// fide fiyatları iki kat. Maaş ve tazminat eski işe alım bedelinden hesaplanır (upgrades.js hireCost): koşu artsın, gider patlamasın
export const PRICE_K = 2;
export function priceOf(type, obj, base = ITEMS[type].price) {
  if (!obj || !obj.userData.mine) return base;
  delete obj.userData.mine;
  G.stats.mineSold = (G.stats.mineSold || 0) + 1;
  return Math.round(base * MINE);
}
// müşterinin üstünde bir kez "✋ +%20": oyuncu bonusun nereden geldiğini görsün
export function mineFx(c, obj) {
  if (!obj || !obj.userData.mine || c.mineShown) return;
  c.mineShown = true;
  floatText(c.obj.position, '✋ Kendi elinden +%20', 'pos');
}
export class Shelf extends Station {
  constructor(o) {
    super(o.zx, o.zz, o.zw ?? 2.6, o.zd ?? 1.4, { y: o.my, instant: o.instant });
    this.accepts = o.accepts; this.cap = o.cap; this.group = o.group; this.role = 'take';
    this.slots = new Array(o.cap).fill(null);
    this.anchors = o.slots.slice(0, o.cap).map((s) => { const a = new THREE.Object3D(); a.position.copy(s); o.group.add(a); return a; });
    this.spots = o.spots.map((p) => ({ p, c: null }));
  }
  acc() { return typeof this.accepts === 'function' ? this.accepts() : this.accepts; }
  // raf büyüyünce yeni yerler eklenir. İstif yerinin (setStack) üstüne gelen yeni yer o istifi devralır (pazar tezgahı büyütmesi)
  addSlots(list) {
    for (const s of list) {
      const tw = this.anchors.find((a) => a.userData.stk && Math.abs(a.position.x - s.x) < 0.05 && Math.abs(a.position.z - s.z) < 0.05 && Math.abs(a.position.y - s.y) < 0.2);
      if (tw) { tw.userData.stk = false; tw.position.copy(s); continue; }
      const a = new THREE.Object3D(); a.position.copy(s); this.group.add(a); this.anchors.push(a); this.slots.push(null);
    }
    this.cap = this.slots.length;
    if (this.stackLv) this.setStack(this.stackLv);
  }
  // raf kapasitesi yükseltmesi (upgrades.js rk_*; 2026-11-01 kullanıcı: "rafların kapasitesi büyütülebilmeli"): ürünler üst üste
  // istiflenir. Seviye 1 rafın müşteriye bakan yarısına, seviye 2 bütün yerlere bir istif ekler; üstünde yer olan yere istif konmaz.
  // İstif yerleri listenin sonunda: raf önce alttan dolar, müşteri önce üsttekini alır (takeType sondan arar)
  setStack(lv) {
    this.stackLv = lv;
    if (!lv || !this.group) return;
    const g = this.group, same = (a, b) => Math.abs(a.position.x - b.position.x) < 0.05 && Math.abs(a.position.z - b.position.z) < 0.05;
    g.updateWorldMatrix(true, false);
    const f = g.worldToLocal(new THREE.Vector3(this.zone.x, 0, this.zone.z));
    const base = this.anchors.filter((a) => !a.userData.stk && !this.anchors.some((b) => b !== a && !b.userData.stk && same(a, b) && b.position.y > a.position.y + 0.05));
    const free = base.filter((a) => !this.anchors.some((b) => b.userData.stk && same(a, b)));
    let need = (lv >= 2 ? base.length : Math.ceil(base.length / 2)) - (base.length - free.length);
    if (need <= 0) return;
    const h = Math.max(0.2, ...this.acc().map((t) => (ITEMS[t] ? makeItem(t).userData.h || 0.3 : 0.3))) * 0.92;
    const d = (a) => Math.hypot(a.position.x - f.x, a.position.z - f.z);
    for (const a of free.sort((p, q) => d(p) - d(q))) {
      if (need-- <= 0) break;
      const t = new THREE.Object3D(); t.position.copy(a.position); t.position.y += h; t.userData.stk = true;
      g.add(t); this.anchors.push(t); this.slots.push(null);
    }
    this.cap = this.slots.length;
  }
  // kapasite yükseltmesinin anahtarı: rafın yeri (koy, pazar, sehir, cicekci) ya da içinde durduğu bölge (firin, iskele)
  rackKey() {
    if (this.rk === undefined) {
      this.rk = this.place || null;
      for (let p = this.group; p && !this.rk; p = p.parent) for (const k in G.regions) if (G.regions[k].content === p) { this.rk = k; break; }
    }
    return this.rk;
  }
  hasSpaceFor(t) { return this.slots.includes(null) && this.acc().includes(t); }
  count(type) { return this.slots.filter((s) => s && (!type || s.type === type)).length; }
  types() { return [...new Set(this.slots.filter(Boolean).map((s) => s.type))]; }
  update(dt) {
    if ((this.railT = (this.railT || 0) - dt) <= 0) { this.railT = 2; if (railColors(this).join() !== this.railKey) this.addRail(); } // açılan ürünle şerit değişir
    if ((this.stkT = (this.stkT || 0) - dt) <= 0) { this.stkT = 1.5; const lv = G.upg[`rk_${this.rackKey()}`] || 0; if (lv !== (this.stackLv || 0)) this.setStack(lv); } // sonradan kurulan raf da istiflenir
    if (!this.inside) return;
    this.t += dt;
    if (this.t < 0.06) return; // raf hızlı dolar: ürünler peş peşe uçar
    const t = this.putFrom(G.stack);
    if (t) { this.t = 0; if (G.hooks.stocked) G.hooks.stocked(this, t); } // canlı ziyarette misafirin dizdiği ürün ev sahibine (canli.js)
  }
  // rafın önünde, en alt sıranın kenarında renk şeridi: rafın aldığı ürünlerin altlık renkleri (dest.js). Birden çok yerin
  // ürününü alan raf (pazar tezgahı: pazar ve köy ürünleri) parça parça çok renkli. Ön yüz, oyuncunun durduğu alana bakan taraftır
  addRail() {
    const cols = railColors(this), g = this.group;
    this.railKey = cols.join();
    if (this.rail) { this.rail.removeFromParent(); this.rail.traverse((o) => o.geometry && o.geometry.dispose()); }
    this.rail = null;
    if (!cols.length || !g || !this.anchors.length) return;
    g.updateWorldMatrix(true, false);
    const f = g.worldToLocal(new THREE.Vector3(this.zone.x, 0, this.zone.z)), b = new THREE.Box3();
    for (const a of this.anchors) b.expandByPoint(a.position);
    const c = b.getCenter(new THREE.Vector3()), ax = Math.abs(f.x - c.x) > Math.abs(f.z - c.z) ? 'x' : 'z', o = ax === 'x' ? 'z' : 'x';
    const s = Math.sign(f[ax] - c[ax]) || 1, front = s > 0 ? b.max[ax] : b.min[ax];
    const y = Math.min(...this.anchors.filter((a) => Math.abs(a.position[ax] - front) < 0.2).map((a) => a.position.y));
    const len = b.max[o] - b.min[o] + 0.6, seg = len / cols.length, rail = new THREE.Group();
    // beyaz zemin üstünde renkli şerit: aynı renkli rafta da (köyün yeşil manav tezgahı) seçilsin. Başka yerin rafında
    // (place: şehir marketi köy ürünü de satar) zemin o yerin renginde, daha geniş çerçeve; ürün renkleri yine eşleşir
    const frame = this.place && PLACES[this.place] ? PLACES[this.place].color : null;
    const back = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? 0.04 : len + 0.08, frame ? 0.2 : 0.14, ax === 'x' ? len + 0.08 : 0.04), railMat(frame || '#ffffff'));
    back.position[ax] = -s * 0.012; rail.add(back);
    cols.forEach((col, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ax === 'x' ? 0.05 : seg, 0.09, ax === 'x' ? seg : 0.05), railMat(col));
      m.position[o] = -len / 2 + seg * (i + 0.5); m.position[ax] = s * 0.012; rail.add(m);
    });
    rail.position[ax] = front + s * 0.26; rail.position[o] = c[o]; rail.position.y = y - 0.02;
    g.add(rail); this.rail = rail;
  }
  putFrom(stack) {
    const i = this.slots.indexOf(null);
    if (i < 0) return false;
    const it = stack.takeOf(this.acc());
    if (!it) return false;
    if (stack === G.stack) it.obj.userData.mine = true; else delete it.obj.userData.mine; // kendi elinle dizdiğin ürün fazla satılır (priceOf)
    this.slots[i] = { type: it.type, obj: it.obj };
    fly(it.obj, this.anchors[i], V0, 0.17, 0.55, (o) => bounce(o, 0.22)); // rafa oturunca küçük sekme
    sfx('pop', { npc: stack !== G.stack });
    return it.type; // dizilen ürünün türü (doğru değer: çağıranlar yine "dizildi mi" diye bakar)
  }
  takeType(type) {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s && s.type === type && !G.flights.some((f) => f.obj === s.obj)) { this.slots[i] = null; G.scene.attach(s.obj); return s.obj; }
    }
    return null;
  }
}

// rafın aldığı ürünlerin gideceği yer renkleri, en çok ürünü olan önce
function railColors(sh) {
  const n = new Map();
  for (const t of sh.acc() || []) { const c = destColor(t); if (c) n.set(c, (n.get(c) || 0) + 1); }
  return [...n.keys()].sort((a, b) => n.get(b) - n.get(a));
}
const RAIL_MAT = new Map();
const railMat = (c) => { if (!RAIL_MAT.has(c)) RAIL_MAT.set(c, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, roughness: 0.5 })); return RAIL_MAT.get(c); };

// ---------- kasa kuyruğu ----------
// köy dükkânı ve şehir marketi kuyruğu: müşteri yerinde durur, yalnız sıra ilerleyince yavaş adımla bir yer öne geçer (2026-11-01
// kullanıcı: "sırada bekleyenler koşuyor gibi olmasın, düzgün beklesinler"; eskiden her karede yürüme adımı atıyordu). Sıra uzunsa
// (3+ kişi) arkada bekleyenler sıkılır: saatine bakar, iç çeker, ayağıyla tempo tutar, etrafa bakınır, kollarını kavuşturur;
// arada başında kısa bir sıkılma simgesi belirir. Dönen değer: müşteri yerinde mi
const BORED = ['⌚', '😒', '😮‍💨', '🥱', '😤', '🙄'];
function boredPose(o) {
  const u = o.userData, t = G.time - (u.fid0 || 0);
  if (!u.head || !u.arms) return;
  const e = Math.min(1, t * 3) * Math.min(1, Math.max(0, (2.4 - t) * 3)); // yumuşak girer ve çıkar (~2,4 sn)
  switch (u.fidget) {
    case 'watch': u.arms[0].rotation.x = -1.35 * e; u.arms[0].rotation.z = 0.55 * e; u.head.rotation.x = 0.35 * e; break; // saatine bakar
    case 'look': u.head.rotation.y = Math.sin(t * 2.2) * 0.8 * e; break; // etrafa bakınır
    case 'sigh': u.head.rotation.x = -0.28 * e * (0.5 + 0.5 * Math.sin(t * 3)); break; // başını geriye atıp iç çeker
    case 'tap': if (u.legs && u.legs[1]) u.legs[1].rotation.x = -Math.abs(Math.sin(t * 9)) * 0.35 * e; u.head.rotation.x = 0.15 * e; break; // ayağıyla tempo tutar
    case 'arms': u.arms.forEach((a, i) => { a.rotation.x = -0.95 * e; a.rotation.z = (i ? 0.75 : -0.75) * e; }); break; // kollarını kavuşturur
  }
}
function calm(c) {
  if (c.pose !== boredPose) return;
  c.pose = null;
  const u = c.obj.userData; if (u.head) u.head.rotation.x = 0;
}
function bored(c, reg, dt) {
  c.bored = (c.bored || 0) + dt;
  if (reg.queue.length < 3 || c.bored < 5) { calm(c); return; }
  if ((c.fidgetT = (c.fidgetT || 0) - dt) <= 0) {
    const u = c.obj.userData, full = c.stack.items.length > 0 || c.alwaysCarry; // elleri doluyken saatine bakmaz, kol kavuşturmaz
    u.fidget = pick(full ? ['look', 'sigh', 'tap'] : ['watch', 'look', 'sigh', 'tap', 'arms']); u.fid0 = G.time;
    c.fidgetT = rand(2.8, 4.6);
    if (Math.random() < 0.55) {
      c.setBubbleText(pick(BORED), 'bored');
      clearTimeout(c.boredT); c.boredT = setTimeout(() => { if (c.bEl && c.bEl.className.includes('bored')) c.clearBubble(); }, 1500);
    }
  }
  c.pose = boredPose;
}
export function queueStep(c, reg, dt, faceY = Math.PI) {
  const k = reg.queue.indexOf(c), slot = reg.posOf(c), p = c.obj.position;
  const far = Math.hypot(slot.x - p.x, slot.z - p.z) > 0.08;
  if (far) {
    if (c.qSlot !== slot || !c.path.length) { c.qSlot = slot; c.path = [slot.clone()]; }
    calm(c); c.bored = 0;
    const sp = c.speed; c.speed = Math.min(sp, 1.3); c.animK = 0.6; c.walk(dt); c.speed = sp; // sırada koşmaz, adım adım ilerler
  } else { c.path.length = 0; c.animK = 0; c.face(faceY, dt); }
  c.atRegister = k === 0 && !far;
  if (c.atRegister) { calm(c); c.setBubbleText(`${c.bill} ₺`, 'pay'); }
  else if (!far) bored(c, reg, dt);
  return !far;
}

// Dönüştürücü (mandıra): girdi tepsisine konan ürünü sırayla çıktıya çevirir
export class Converter extends Station {
  constructor(parent, o) {
    super(o.ix, o.iz, o.iw ?? 2.4, o.id ?? 1.3, { instant: o.instant, y: o.my });
    this.inType = o.inType; this.cap = o.inCap ?? 6; this.input = []; this.role = 'take';
    this.inTray = new THREE.Group();
    this.inTray.position.set(o.inTray[0], o.inTray[1], o.inTray[2]);
    parent.add(this.inTray);
    this.out = new Generator(parent, { ...o.out, instant: o.instant });
    // per: bir girdiden kaç ürün (değirmen: bir buğday üç un); need: bir ürün için kaç girdi (turşu, güveç, pide, buket, salça: ikiden
    // bir). Eskiden "iki X bir Y" yazan makineler per: 2 ile tersini yapıyordu, bir girdiden iki ürün çıkıyordu (2026-11-01 denetim)
    this.per = o.per || 1; this.need = o.need || 1; this.made = 0;
    this.out.canMake = () => this.input.length >= this.need;
    this.out.onMake = () => {
      if (++this.made % this.per) return; // girdi her `per` üründe bir tükenir
      for (let k = 0; k < this.need; k++) { const m = this.input.pop(); if (m) fly(m, this.out.origin.clone(), null, 0.3, 0.6, (x) => x.parent && x.parent.remove(x)); }
    };
  }
  slot(i) { return new THREE.Vector3(-0.5 + (i % 3) * 0.5, Math.floor(i / 3) * 0.42, 0); }
  hasSpaceFor(t) { return t === this.inType && this.input.length < this.cap; }
  putFrom(stack) {
    if (this.input.length >= this.cap) return false;
    const it = stack.takeOf([this.inType]);
    if (!it) return false;
    this.input.push(it.obj);
    fly(it.obj, this.inTray, this.slot(this.input.length - 1), 0.18, 0.6, (o) => bounce(o, 0.2));
    sfx('pop', { npc: stack !== G.stack });
    return true;
  }
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.07 && this.putFrom(G.stack)) this.t = 0;
  }
}

// Para yığını
// Para yığını: para yerde değil kasa tezgahının üstünde birikir, başında tezgahtar durur (özel durumda o.desk = false).
// o.ry: tezgahın önünün baktığı yön (0: güney), o.clerk = false: tezgahtar yok (ör. kasanın yanı), o.look: tezgahtarın görünüşü
export class MoneyPile extends Station {
  constructor(parent, x, z, y = 0, o = {}) {
    super(x, z, 2.0, 2.0, { y: y + 0.06, instant: o.instant });
    this.amount = 0; this.bills = [];
    this.base = new THREE.Group();
    if (o.desk === false) {
      // tek parça kasa: para satış tezgahının üstünde birikir (y tezgah üstü). register: yazarkasanın paraya göre yeri,
      // body: değince para toplanan tezgah, spot: kasiyerin duracağı yer [x, z, ry]
      this.base.position.set(x, y, z); this.base.rotation.y = o.ry || 0;
      if (o.register) { const r = makeRegister(); r.position.set(o.register[0], o.register[1], o.register[2]); this.base.add(r); this.reg = r; }
      if (o.body) this.bodyFn = () => [o.body];
      if (o.spot) this.spot = { x: o.spot[0], y: 0, z: o.spot[1], ry: o.spot[2], look: o.look };
    }
    else {
      const ry = o.ry || 0, c = Math.cos(ry), s = Math.sin(ry);
      const desk = makeCashDesk(); desk.position.set(x, y, z); desk.rotation.y = ry; parent.add(desk); if (!o.instant) popIn(desk);
      const hw = Math.abs(c) * 0.8 + Math.abs(s) * 0.45, hd = Math.abs(s) * 0.8 + Math.abs(c) * 0.45;
      this.col = [x - hw, x + hw, z - hd, z + hd]; G.colliders.push(this.col);
      this.bodyFn = () => [this.col]; // tezgaha değince para toplanır
      this.base.position.set(x - 0.2 * c, y + 0.97, z + 0.2 * s); this.base.rotation.y = ry;
      // tezgahın arkası: tezgahtar kendiliğinden gelmez; o bölgenin kasiyeri işe alınınca burada durur (upgrades.js KasaGorevlisi)
      if (o.clerk !== false) this.spot = { x: x - 0.85 * s, y, z: z - 0.85 * c, ry, look: o.look };
    }
    parent.add(this.base);
    // yazarkasa tezgahın arkasındaki elemana döner (face: [x, z], yoksa kasiyer yeri)
    const f = o.face || o.spot;
    if (this.reg && f) faceRegister(this.reg, f[0], f[1]);
  }
  // 2x3 deste katman katman yükselir (en çok 180 deste ≈ 2,2 m)
  slot(i) { const l = Math.floor(i / 6), c = i % 6; return new THREE.Vector3(-0.27 + (c % 2) * 0.54, 0.04 + l * 0.072, -0.34 + Math.floor(c / 2) * 0.34); }
  add(amount, from) {
    this.amount += amount;
    if (G.hooks.earn) G.hooks.earn(this, amount); // bölgenin kazancı (sart.js); kayıttan geri gelen para sayılmaz, kanca yüklemeden sonra takılır
    const n = Math.min(Math.max(1, Math.round(amount / 5)), 14);
    for (let k = 0; k < n && this.bills.length < 180; k++) {
      const b = makeBillMesh();
      b.position.set(from.x, from.y + 1.3, from.z);
      G.scene.add(b);
      this.bills.push(b);
      fly(b, this.base, this.slot(this.bills.length - 1), 0.35 + k * 0.05, 1.2);
    }
  }
  update(dt) {
    if (!(this.inside || this.pull) || this.amount <= 0) return; // pull: Para Mıknatısı (yetenek.js)
    this.t += dt;
    const step = this.bills.length > 60 ? 0.012 : this.bills.length > 24 ? 0.022 : 0.035; // büyük yığın hızlı toplanır
    while (this.t >= step && this.amount > 0) {
      this.t -= step;
      const n = this.bills.length;
      const take = Math.min(this.amount, n ? Math.ceil(this.amount / n) : this.amount);
      this.amount -= take; G.money += take; G.stats.earned += take;
      if (n) {
        const b = this.bills.pop();
        fly(b, G.player, new THREE.Vector3(0, 1.5, 0), 0.22, 0.6, (o) => o.parent && o.parent.remove(o));
      }
      if (G.hooks.coin) G.hooks.coin(this.base.position);
      if (G.hooks.feel) G.hooks.feel('coin');
      sfx('coin');
    }
    if (this.amount < 0.5) { this.amount = 0; }
  }
}

// Kasa: sıradaki müşteriden parayı alır (oyuncu kasadayken)
// kasada paketlenen kutu: karton gövde, bant şeridi (geometri ve malzeme ortak)
let PARCEL = null;
function makeParcel(n) {
  if (!PARCEL) PARCEL = { geo: new THREE.BoxGeometry(0.46, 0.28, 0.34), tape: new THREE.BoxGeometry(0.48, 0.02, 0.08), side: new THREE.BoxGeometry(0.08, 0.29, 0.35),
    card: new THREE.MeshStandardMaterial({ color: '#c8955a', roughness: 0.9 }), tapeM: new THREE.MeshStandardMaterial({ color: '#f1e2b8', roughness: 0.6 }) };
  const g = new THREE.Group(), k = Math.min(1.35, 0.8 + n * 0.1);
  const b = new THREE.Mesh(PARCEL.geo, PARCEL.card); b.position.y = 0.14; b.castShadow = true; g.add(b);
  const t = new THREE.Mesh(PARCEL.tape, PARCEL.tapeM); t.position.y = 0.285; g.add(t);
  const s = new THREE.Mesh(PARCEL.side, PARCEL.tapeM); s.position.y = 0.14; s.scale.set(0.3, 1, 1); g.add(s);
  g.scale.setScalar(k);
  return g;
}
export class Register extends Station {
  constructor(o) {
    super(o.zx, o.zz, o.zw, o.zd, { y: o.my, instant: o.instant });
    this.slotsPos = o.queue; this.queue = []; this.pile = o.pile;
    // yalnız kasiyerin durduğu taraf (alan) sayılır: bankonun müşteri tarafından ödeme alınmaz (kullanıcı: "doğru tarafa geçmemiz gereksin")
    this.reach = 0;
    this.top = o.top || null; // bankonun üstü: ürünler buraya dizilir, kutulanır (world.js / city.js)
    this.topDir = o.topDir || null; // ürünlerin dizildiği yön (bankonun boyu)
  }
  join(c) { this.queue.push(c); }
  leave(c) { const i = this.queue.indexOf(c); if (i >= 0) this.queue.splice(i, 1); calm(c); }
  posOf(c) { const i = this.queue.indexOf(c); return this.slotsPos[Math.min(Math.max(i, 0), this.slotsPos.length - 1)]; }
  // kasa: müşterinin aldıkları tek tek bankoya çıkar, sonra kutuya girer, kutu müşteriye verilir ve öder. Oyuncu kasadaysa
  // oyuncunun hızında, yoksa kasiyer kendi hızında (kasiyer hızı yükseltmesi kısaltır). Eskiden ödeme 0,45 sn'de tek seferdeydi
  // ürünler bankonun bant tarafına dörderli dizilir, fazlası üstüne ikinci sıra: yazar kasanın ve para yığınının üstüne binmez
  // (2026-11-01 kullanıcı: "kasada ürün paketleme animasyonu yazar kasa ile üst üste biniyor")
  counterAt(i) {
    const z = this.zone, q = this.slotsPos[0], c = this.top || new THREE.Vector3((z.x + q.x) / 2, 1.05, (z.z + q.z) / 2);
    let ux, uz;
    if (this.topDir) { ux = this.topDir.x; uz = this.topDir.z; }
    else { const dx = q.z - z.z, dz = -(q.x - z.x), l = Math.hypot(dx, dz) || 1; ux = dx / l; uz = dz / l; } // bankonun boyu: kasa ile müşteri arasındaki çizgiye dik
    const o = -0.42 + (i % 4) * 0.28;
    return new THREE.Vector3(c.x + ux * o, c.y + Math.floor(i / 4) * 0.22, c.z + uz * o);
  }
  update(dt) {
    if (!this.queue.length || (!this.inside && !this.cashier)) return;
    const c = this.queue[0];
    if (this.sale && this.sale.c !== c) { for (const o of this.sale.on) if (o.parent) o.parent.remove(o); if (this.sale.box && this.sale.box.parent) this.sale.box.parent.remove(this.sale.box); this.sale = null; }
    if (!c.atRegister) return;
    const k = this.inside ? 1 : Math.max(0.6, this.cashier.interval / 0.6);
    this.t += dt / k;
    const S = this.sale || (this.sale = { c, phase: 'unload', on: [], box: null, n: 0 });
    if (S.phase === 'unload') {
      if (this.t < 0.32) return;
      this.t = 0;
      const top = c.stack.items[c.stack.items.length - 1];
      const it = top && !top.flying && c.stack.takeOf([top.type]);
      if (it) {
        it.obj.scale.setScalar(1); // sepetteki küçültülmüş ürün bankoda gerçek boyunda
        const p = this.counterAt(S.n++);
        fly(it.obj, p, null, 0.24, 0.45);
        S.on.push(it.obj); sfx('pop', { at: p });
        return;
      }
      if (top) return; // elindeki ürün henüz yerine oturmadı
      S.phase = 'box';
      const p = this.counterAt(Math.max(0, Math.floor((S.n - 1) / 2)));
      S.box = makeParcel(S.n); S.box.position.set(p.x, p.y + 0.02, p.z); G.scene.add(S.box); popIn(S.box);
      return;
    }
    if (S.phase === 'box') {
      if (this.t < 0.16) return;
      this.t = 0;
      const o = S.on.shift();
      if (o) { fly(o, S.box, new THREE.Vector3(0, 0.12, 0), 0.16, 0.35, (x) => x.parent && x.parent.remove(x)); return; }
      S.phase = 'give'; bounce(S.box, 0.2); sfx('pop', { at: S.box.position });
      return;
    }
    if (S.phase === 'give' && this.t >= 0.35) {
      this.t = 0;
      const box = S.box, hold = c.basketMode && c.stack.holder ? c.stack.holder : c.obj;
      fly(box, hold, c.basketMode ? new THREE.Vector3(0, 0.22, 0) : new THREE.Vector3(0, 0.95, 0.42), 0.3, 0.55);
      c.parcel = box; c.alwaysCarry = true; // kutuyu kucağında taşıyarak çıkar
      this.sale = null;
      this.queue.shift();
      // kasada sen servis edince müşteri bahşiş bırakır (kendi elinle bonusu; kasiyerin servisi normal)
      const tip = this.inside ? Math.max(1, Math.round(c.bill * MINE_TIP)) : 0, pay = (c.bill + tip) * mult();
      G.stats.customers++; G.stats.sold += c.got || 0;
      this.pile.add(pay, c.obj.position);
      floatText(c.obj.position, tip ? `+${pay} ₺ · 💝 bahşiş` : `+${pay} ₺`, mult() > 1 ? 'pos x2' : 'pos');
      c.onPaid();
      if (this.cashier) bounce(this.cashier.obj, 0.08);
      sfx('cash', { at: c.obj.position });
    }
  }
}

// bekleme halkası: üstünde durulunca dolan çember (adım adım önbellekli geometri)
const RING_STEPS = [];
function ringGeo(k) {
  const i = Math.max(1, Math.min(32, Math.round(k * 32)));
  return RING_STEPS[i] || (RING_STEPS[i] = new THREE.RingGeometry(1.5, 1.72, 48, 1, PI / 2, -(i / 32) * PI * 2));
}
export const DWELL = 0.7;

// Kilit alanı: üstünde bir süre (DWELL) durunca para akar, dolunca yeni alan açılır
export class UnlockPad extends Station {
  constructor(def, onDone) {
    const y = def.y ?? 0.05, S = def.size || 2.8, k = S / 2.8; // fide kilidi küçük (1,3 m)
    super(def.at[0], def.at[1], S, S, { dashed: true, y });
    this.def = def; this.paid = 0; this.onDone = onDone; this.ct = 0; this.dwell = 0;
    this.ring = new THREE.Mesh(ringGeo(0.01), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }));
    this.ring.rotation.x = -PI / 2;
    this.ring.position.set(def.at[0], y + 0.02, def.at[1]);
    this.ring.renderOrder = 4;
    this.ring.scale.set(k, k, 1);
    this.ring.visible = false;
    G.scene.add(this.ring);
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(2.5 * k, 2.5 * k), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.75, depthWrite: false }));
    this.fill.rotation.x = -PI / 2;
    this.fill.position.set(def.at[0], y + 0.01, def.at[1]);
    this.fill.scale.set(0.0001, 0.0001, 1);
    this.fill.renderOrder = 3;
    G.scene.add(this.fill);
    const el = document.createElement('div');
    el.className = 'pad';
    el.innerHTML = `<span class="pt"></span><span class="pp"><i class="coin">₺</i><b></b></span>`;
    el.querySelector('.pt').textContent = `${def.icon ? def.icon + ' ' : ''}${def.title}`;
    this.priceEl = el.querySelector('b');
    this.label = G.labels.add(el, (v) => v.set(def.at[0], y + 0.9 + Math.sin(G.time * 3) * 0.08, def.at[1]));
    this.refresh();
  }
  refresh() { this.priceEl.textContent = Math.ceil(this.def.price - this.paid).toLocaleString('tr-TR'); }
  update(dt) {
    const price = this.def.price;
    this.dwell = this.inside ? Math.min(DWELL, this.dwell + dt) : 0;
    this.ring.visible = this.inside && this.dwell < DWELL && G.money >= 0.5;
    if (this.ring.visible) this.ring.geometry = ringGeo(this.dwell / DWELL);
    if (this.inside && this.dwell >= DWELL && G.money >= 0.5 && this.paid < price && !G.visit) { // komşunun köyünde kilit açılmaz
      const d = Math.min(Math.max(30, price * 0.7) * dt, G.money, price - this.paid);
      this.paid += d; G.money -= d;
      this.ct += dt;
      if (this.ct > 0.07) {
        this.ct = 0;
        const b = makeBillMesh();
        b.position.copy(G.player.position).add(new THREE.Vector3(0, 1.6, 0));
        G.scene.add(b);
        fly(b, new THREE.Vector3(this.zone.x, 0.2, this.zone.z), null, 0.25, 0.8, (o) => o.parent && o.parent.remove(o));
        sfx('pay');
        if (G.hooks.feel) G.hooks.feel('pay');
      }
      this.refresh();
      if (this.paid >= price - 0.01) { this.complete(); return; }
    }
    const k = Math.max(0.0001, this.paid / price);
    this.fill.scale.set(k, k, 1);
  }
  complete() {
    G.scene.remove(this.fill, this.ring);
    G.labels.remove(this.label);
    this.remove();
    this.onDone();
  }
  dispose() { G.scene.remove(this.fill, this.ring); G.labels.remove(this.label); this.remove(); }
}

// Toptancıdan para karşılığı mal alma (pazar)
export class PaidSource extends Station {
  constructor(o) {
    super(o.x, o.z, 2.6, 2.0, { instant: o.instant });
    this.types = o.types; this.origin = o.origin; this.k = 0; this.warn = 0; this.role = 'give';
    this.stock = o.stock ?? Infinity; // kamyonun malı (trucks.js); bitince kamyon yükü almaya gider
    this.pick = o.pick || null; // (konum) → tür: oyuncunun durduğu yere göre ürün (sebze kamyoneti: biber kasası / patlıcan kasası)
  }
  update(dt) {
    this.warn -= dt;
    this.dwell = this.inside ? (this.dwell || 0) + dt : 0;
    if (!this.inside || this.dwell < 0.45) return; // üstünden geçerken yanlışlıkla satın alma olmasın
    this.t += dt;
    if (this.t < 0.22) return;
    this.t = 0;
    const want = this.pick ? this.pick(G.player.position) : null;
    if (want && !this.types.includes(want)) { // o kasanın ürünü henüz satılamıyor
      if (this.warn <= 0) { floatText(G.player.position, `🔒 Önce ${ITEMS[want].name.toLocaleLowerCase('tr')} tezgâhını aç`, 'neg'); this.warn = 2.5; }
      return;
    }
    const r = this.buyTo(G.stack, want);
    if (r === 'poor' && this.warn <= 0) { floatText(G.player.position, say('noMoney'), 'neg'); sfx('error'); this.warn = 1.6; }
    if (r === 'empty' && this.warn <= 0) { floatText(G.player.position, '🚚 Kamyon yükü almaya gitti', 'neg'); this.warn = 2.5; }
    if (r === 'closed' && this.warn <= 0) { floatText(G.player.position, '🔒 Önce bu ürünün tezgâhını aç', 'neg'); this.warn = 2.5; }
  }
  // sonuç: 'ok' | 'full' | 'poor' | 'empty' | 'closed' (satacağı tezgâh henüz yok: sebze kamyoneti, tezgâhı açılan ürünü yükler)
  buyTo(stack, want) {
    if (!this.types.length) return 'closed';
    if (stack.full) return 'full';
    if (this.stock <= 0) return 'empty';
    const type = want && this.types.includes(want) ? want : this.types[this.k % this.types.length]; // eleman istediği türü alır
    const free = G.visit && stack !== G.stack; // komşunun köyünde elemanların aldığı malı yardımcının harçlığı ödemez
    const cost = free ? 0 : ITEMS[type].cost;
    if (G.money < cost) return 'poor';
    if (stack === G.stack) bounce(G.player, 0.04);
    this.k++; this.stock--;
    G.money -= cost;
    const it = makeItem(type);
    it.position.copy(this.origin);
    G.scene.add(it);
    stack.push(type, it, 0.32);
    floatText(this.origin, `-${cost} ₺`, 'neg');
    sfx('pop', { npc: stack !== G.stack });
    return 'ok';
  }
}

// Şezlong: oyuncu siparişi getirince teslim edilir
export class Lounger extends Station {
  constructor(x, z, o = {}) {
    super(x, z + 0.3, 2.4, 3.0, { instant: o.instant });
    this.x = x; this.z = z; this.c = null;
  }
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.15 && this.deliverFrom(G.stack)) this.t = 0;
  }
  deliverFrom(stack) {
    const c = this.c;
    if (!c || c.state !== 'order') return false;
    const it = stack.takeOf([c.order]);
    if (!it) return false;
    fly(it.obj, c.obj, new THREE.Vector3(0, 1.2, 0.3), 0.3, 1, (o) => o.parent && o.parent.remove(o));
    c.served();
    return true;
  }
}

// ---------- müşteri ----------
// Müşteri yavaşça belirir ve silinir (2026-11-04 kullanıcı: "insanlar hemen yok olmasın, biraz daha uzaklaşsın, kaybolurken yavaş
// animasyonla kaybolsun"). Ekranda doğan 1 sn'de belirir; ekrandayken giden 1,6 sn'de saydamlaşır, harita dışındaysa (ormanın içine
// uzanan yollarda, decor.js) yürümeyi sürdürür. Saydamlık süresince karakterin malzemeleri kopyalanır, bitince eskisi geri gelir
const FADE_IN = 1.0, FADE_OUT = 1.6, FADES = [];
const outside = (p) => p.x < -100 || p.x > 128;
function seeThrough(o, on) {
  const tr = (m) => { const c = m.clone(); c.transparent = true; c.userData.op0 = m.opacity; return c; };
  o.traverse((m) => {
    if (!m.isMesh) return;
    if (on && !m.userData.mat0) { m.userData.mat0 = m.material; m.material = Array.isArray(m.material) ? m.material.map(tr) : tr(m.material); }
    else if (!on && m.userData.mat0) { for (const c of [].concat(m.material)) c.dispose(); m.material = m.userData.mat0; delete m.userData.mat0; }
  });
}
function opacity(o, k) { o.traverse((m) => { if (m.isMesh && m.userData.mat0) for (const c of [].concat(m.material)) c.opacity = c.userData.op0 * k; }); }
// silinmekte olan müşteriler (G.customers'tan çıkmışlardır): main.js her karede çağırır
export function updateFading(dt) {
  for (let i = FADES.length - 1; i >= 0; i--) {
    const c = FADES[i], p = c.obj.position;
    c.fadeT += dt;
    if (c.fadeGo) { const a = c.obj.rotation.y, st = c.speed * dt; p.x += Math.sin(a) * st; p.z += Math.cos(a) * st; }
    animateCharacter(c.obj, c.fadeGo && !c.pose ? c.animK || 1 : 0, dt, (c.stack.items.length > 0 || c.alwaysCarry || c.riding) && !c.lying);
    if (c.pose) c.pose(c.obj);
    c.stack.update(dt);
    const k = 1 - c.fadeT / FADE_OUT;
    if (k <= 0 || offscreen(p, 1.3)) { FADES.splice(i, 1); c.gone(); } else opacity(c.obj, k);
  }
}
export class Customer {
  constructor(spawn, region, look) {
    this.obj = makeCharacter(look || randomLook());
    this.obj.position.copy(spawn);
    G.scene.add(this.obj); // çoğu harita dışında, ormanın içindeki yolda doğar; ekranda doğan yavaşça belirir
    if (G.camera && !offscreen(spawn)) { this.fadeIn = 0; seeThrough(this.obj, true); opacity(this.obj, 0); }
    this.region = region;
    this.path = []; this.speed = rand(2.6, 3.3);
    this.stack = new Stack(this.obj, 6, 0.95, 0.42);
    this.state = ''; this.t = 0; this.wait = 0; this.moving = false;
    this.bubble = null; this.think = () => {};
    G.customers.push(this);
  }
  go(...pts) { for (const p of pts) this.path.push(p.clone()); }
  walk(dt) {
    if (!this.path.length) return true;
    // önü kapalıysa (bina, çit, duvar) dolanarak yürür
    if (this.path[0] !== this.leg && G.hooks.route) {
      const r = G.hooks.route(this.obj.position, this.path[0], !!this.riding); // bisikletli, motorlu: asfaltta gider
      if (r.length > 1) { r.pop(); this.path.unshift(...r); }
      this.leg = this.path[0];
    }
    const p = this.obj.position, t = this.path[0];
    const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
    const yieldK = this.riding && G.hooks.crossK && d > 0.01 ? G.hooks.crossK(p, dx / d, dz / d) : 1; // yaya geçidinde yavaşlar, yaya varsa durur (roads.js)
    // bisikletli ve motorlu müşteri trafiğe katılır: önündeki taşıta göre yavaşlar, arabalar da onu görüp arkasında yavaşlar (events.js
    // gapK); inince trafikten düşer. Eskiden arabalarla aynı şeritte birbirlerinin içinden geçiyorlardı (2026-11-05 kullanıcı: "trafikteki
    // diğer taşıtlar da birbirlerinin içinden geçmesin")
    let gapK = 1;
    if (this.riding && G.hooks.gapK) { this.obj.userData.tLen = 2.0; gapK = G.hooks.gapK(this.obj, this.path); }
    else if (G.traffic && G.traffic.has(this.obj)) G.traffic.delete(this.obj);
    const st = this.speed * dt * (offscreen(p) ? 4 : 1) * yieldK * gapK;
    if (d <= st) { p.x = t.x; p.z = t.z; this.path.shift(); }
    else { p.x += (dx / d) * st; p.z += (dz / d) * st; }
    if (d > 0.02) this.obj.rotation.y = lerpAngle(this.obj.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
    this.moving = true;
    return !this.path.length;
  }
  face(a, dt = 1) { this.obj.rotation.y = lerpAngle(this.obj.rotation.y, a, Math.min(1, dt * 10)); }
  ensureBubble() {
    if (this.bubble) return;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.innerHTML = '<span class="ring"><img alt=""></span><b></b>';
    this.bEl = el; this.bImg = el.querySelector('img'); this.bTxt = el.querySelector('b'); this.bRing = el.querySelector('.ring');
    this.bubble = G.labels.add(el, (v) => { if (this.lying) v.copy(this.seat).setY(this.seat.y + 1.5); else v.copy(this.obj.position).setY(this.obj.position.y + 2.2); });
  }
  setBubble(type, n) {
    this.ensureBubble();
    this.bEl.className = 'bubble';
    this.bImg.style.display = '';
    if (this.bImg.dataset.t !== type) { this.bImg.src = G.icons[type]; this.bImg.dataset.t = type; }
    this.bTxt.textContent = n > 1 ? `×${n}` : '';
  }
  setBubbleText(text, cls = '') {
    this.ensureBubble();
    this.bEl.className = 'bubble txt ' + cls;
    this.bImg.style.display = 'none';
    this.bTxt.textContent = text;
  }
  setPatience(p) { this.pat = p; if (this.bRing) this.bRing.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3)); }
  clearBubble() { if (this.bubble) { G.labels.remove(this.bubble); this.bubble = null; } }
  mood(happy) {
    if (G.onMood) G.onMood(this, happy); // mahalle memnuniyeti (rating.js)
    this.setBubbleText(`${emoji(happy ? 'happy' : 'angry')} ${say(happy ? 'happy' : 'angry')}`, happy ? 'happy' : 'angry');
    if (happy) this.joy = 0.9; else this.huff = 1.0; // beden tepkisi: zıplar ya da ayak vurur (tepki.js)
    this.pat = null;
    const at = this.lying ? this.seat : this.obj.position;
    if (!happy && G.hooks.angry) G.hooks.angry(this, at); // kaçan müşterinin cezası (account.js)
    sfx(happy ? 'happy' : 'bad', { at });
    if (near(at, 10)) speak(happy ? 'happy' : 'angry'); // arada bir sesli de söyler
    clearTimeout(this.moodT);
    this.moodT = setTimeout(() => this.clearBubble(), 1400);
  }
  update(dt) {
    if (this.fadeIn != null) { this.fadeIn += dt; if (this.fadeIn < FADE_IN) opacity(this.obj, this.fadeIn / FADE_IN); else { seeThrough(this.obj, false); this.fadeIn = null; } }
    this.moving = false;
    this.think(dt);
    // sepetli ya da bisikletli müşteri kollarını hep önde tutar
    animateCharacter(this.obj, this.moving && !this.pose ? this.animK || 1 : 0, dt, (this.stack.items.length > 0 || this.alwaysCarry || this.riding) && !this.lying); // animK: kuyrukta ağır adım
    if (this.pose) this.pose(this.obj); // sabit duruş: motosiklette ayaklar pedalda değil, öne uzanık (world.js spawnBiker)
    else if (G.hooks.react) G.hooks.react(this, dt); // sevinç, öfke, sabırsızlık, el sallama (tepki.js)
    this.stack.update(dt);
  }
  destroy() {
    clearTimeout(this.moodT);
    this.clearBubble();
    const i = G.customers.indexOf(this);
    if (i >= 0) G.customers.splice(i, 1);
    if (FADES.includes(this)) return;
    if (!G.camera || offscreen(this.obj.position)) { this.gone(); return; }
    this.fadeIn = null; this.fadeT = 0; this.fadeGo = outside(this.obj.position);
    seeThrough(this.obj, true); FADES.push(this);
  }
  gone() { seeThrough(this.obj, false); this.obj.removeFromParent(); }
}
