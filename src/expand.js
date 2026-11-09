// Bölge genişletmeleri (genisleme-plan.md): her bölgenin yanında üç kademe genişleme arsası. 1. kademe kapasite, 2. kademe
// yeni iş ya da ürün, 3. kademe büyük kapasite. Arsalar baştan boştur (orman ve süs oraya konmaz: decor.js expansionRects).
// Kilidi görünen arsanın köşelerinde kazık, çevresinde kırmızı-beyaz şerit ve "GENİŞLEME ALANI" tabelası durur. Satın alınınca
// arsa bölgenin zeminine katılır, yürünür olur, mini haritada bölgenin rengiyle çizilir, ortam sesi bölgeninkine katılır;
// kamera arsaya bakar, ardından kademenin build(ctx) işlevi içeriği kurar.
// İçerik dosyaları defineExpansion ile kademe tanımlar (expand-west.js, expand-east.js); world.js bunları UNLOCKS'a ekler.
// Yeni kaynak ve makineler G.xsrc / G.xsink ile elemanlara (srcFor, carrierJobs), yeni ürünler G.xsell ile satış yerlerine bağlanır.
import * as THREE from 'three';
import * as M from './models.js';
import { workTable } from './mobilya.js';
import { G, PlantBed, Generator, Converter, popIn, sfx, PRICE_K } from './game.js';
import { texRep, alignGroundUV } from './tex.js';
import { confetti } from './fx.js';

const DEFS = [];
// bölgenin kendi kilidi: 1. kademe ondan sonra açılır (kasaba baştan açık: yalnızca seviye şartı)
const REQ = { koy: 'k1', tarla: 'gs', mera: 'gm', atolye: 'm2', atlar: 'gt', benzin: 'e1', enerji: 'gw', meydan: 'kb', iskele: 'gb',
  pazar: 'gp', ciftlik: 'kk', tarlalar: 'gy', han: 'gh', firin: 'gf', sahil: 'gs', tatil: 'gk', kasaba: null, sehir: 'gc', lunapark: 'gl' };
// d: { id, region, tier (1-3), title, icon, price, rect ([x0,x1,z0,z1] ya da null: yerinde yükseltme), at ([x,z]),
//      tex ('grass' | 'cobble' | 'path' | 'sand' | 'asphalt' | 'wood'), tile, lvl, info: { text, steps }, build(ctx),
//      chain (bölgenin içinde ayrı kademe sırası; ör. köy imalathanesi bahçe kademelerini beklemez),
//      req (sıradaki kademe yerine kendi şartı; ör. kek tezgâhı kasaba kahvesini ister) }
export function defineExpansion(d) { d.price = Math.round((d.price * PRICE_K) / 10) * 10; DEFS.push(d); } // fiyat çarpanı (game.js): bölüm genişlemeleri iki kat
export const expansionRects = () => DEFS.filter((d) => d.rect).map((d) => d.rect);
export const expansionDefs = () => DEFS;

let H = null; // world.js yardımcıları: hint, icon
const GROUP = new THREE.Group();
export function expansionUnlocks(helpers) {
  H = helpers;
  GROUP.name = 'expansions';
  if (!GROUP.parent && G.scene) G.scene.add(GROUP);
  G.xsrc = G.xsrc || {}; G.xsink = G.xsink || []; G.xsell = G.xsell || []; G.annexes = G.annexes || []; G.xgens = G.xgens || {}; // xgens: bölümün üreticileri (menüde hız/kapasite, upgrades.js)
  const byRegion = {};
  for (const d of DEFS) { const k = d.chain || d.region; (byRegion[k] || (byRegion[k] = [])).push(d); }
  const out = [];
  for (const list of Object.values(byRegion)) {
    list.sort((a, b) => a.tier - b.tier);
    list.forEach((d, i) => {
      // emekli kademe zinciri kesmesin: sonraki kademe, emekli olmayan bir önceki kademeyi (yoksa bölgeyi) ister
      let j = i - 1; while (j >= 0 && list[j].retired && !d.retired) j--;
      const req = 'req' in d ? d.req : j < 0 ? REQ[d.region] : list[j].id;
      if (d.info && helpers.registerIntro) helpers.registerIntro(d.id, d.info);
      out.push({ id: d.id, icon: d.icon, title: d.title, price: d.price, at: d.at, side: true, ...(req ? { req } : {}), ...(d.lvl ? { lvl: d.lvl } : {}), ...(d.y != null ? { y: d.y } : {}), ...(d.size ? { size: d.size } : {}), ...(d.retired ? { retired: true } : {}), expansion: true, build: (inst) => openExpansion(d, inst) });
    });
  }
  return out;
}

// ---------- arsa zemini ----------
// kenarları yumuşak geçişli düzlem (bölge zemini gibi), bölge zeminiyle aynı doku
function featherAlpha(w, d) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d'), fx = Math.min(0.5, 1.2 / w) * 64, fz = Math.min(0.5, 1.2 / d) * 64;
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
  const grad = (x0, y0, x1, y1) => { const l = g.createLinearGradient(x0, y0, x1, y1); l.addColorStop(0, '#000'); l.addColorStop(1, '#fff'); return l; };
  g.fillStyle = '#fff'; g.fillRect(fx, fz, 64 - 2 * fx, 64 - 2 * fz);
  g.fillStyle = grad(0, 0, fx, 0); g.fillRect(0, fz, fx, 64 - 2 * fz);
  g.fillStyle = grad(64, 0, 64 - fx, 0); g.fillRect(64 - fx, fz, fx, 64 - 2 * fz);
  g.fillStyle = grad(0, 0, 0, fz); g.fillRect(fx, 0, 64 - 2 * fx, fz);
  g.fillStyle = grad(0, 64, 0, 64 - fz); g.fillRect(fx, 64 - fz, 64 - 2 * fx, fz);
  const t = new THREE.CanvasTexture(c); return t;
}
const GRASS = '#bfe3a0';
function ground(d) {
  const [x0, x1, z0, z1] = d.rect, w = x1 - x0, dd = z1 - z0, tile = d.tile || (d.tex === 'cobble' ? 2.4 : 3);
  const map = texRep(d.tex || 'grass', w / tile, dd / tile);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, dd), new THREE.MeshStandardMaterial({ map, alphaMap: featherAlpha(w, dd), transparent: true, depthWrite: false, roughness: 0.95, color: (d.tex || 'grass') === 'grass' ? GRASS : '#ffffff' }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2); m.renderOrder = -1; m.receiveShadow = true;
  GROUP.add(m);
  return m;
}

// ---------- satın alınmamış arsanın işareti ----------
let ribbonTex = null;
function ribbonMap() {
  if (ribbonTex) return ribbonTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e8473c'; g.fillRect(i * 8, 0, 8, 8); }
  ribbonTex = new THREE.CanvasTexture(c); ribbonTex.wrapS = THREE.RepeatWrapping; ribbonTex.colorSpace = THREE.SRGBColorSpace;
  return ribbonTex;
}
function makePlotMarker(d) {
  const [x0, x1, z0, z1] = d.rect, g = new THREE.Group(), wood = M.mat('#b07a45');
  const tint = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color: '#fff2a8', transparent: true, opacity: 0.16, depthWrite: false }));
  tint.rotation.x = -Math.PI / 2; tint.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2); g.add(tint);
  const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  for (const [x, z] of corners) { M.cyl(0.06, 0.07, 0.95, 6, wood, x, 0.47, z, g); M.cyl(0.08, 0.08, 0.08, 6, M.mat('#e8473c'), x, 0.96, z, g); }
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4], L = Math.hypot(bx - ax, bz - az);
    const map = ribbonMap().clone(); map.needsUpdate = true; map.repeat.set(L / 1.2, 1);
    const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.015), new THREE.MeshStandardMaterial({ map, roughness: 0.7 }));
    r.position.set((ax + bx) / 2, 0.82, (az + bz) / 2); r.rotation.y = -Math.atan2(bz - az, bx - ax); g.add(r);
  }
  const s = M.makeSign('GENİŞLEME ALANI', '#e8604c', 2.6, 0.62); s.scale.setScalar(0.75); s.position.set(x0 + 1.2, 0, z0 + 0.25); g.add(s);
  g.traverse((o) => { if (o.isMesh && o.geometry.type !== 'PlaneGeometry') o.castShadow = true; });
  return g;
}
const markers = new Map();
let markT = 0;
// kilidi görünen arsalar işaretlenir; satın alınınca ya da kilit gizliyken işaret kalkar
export function updateExpansions(dt) {
  if ((markT -= dt) > 0) return;
  markT = 0.5;
  if (!GROUP.parent && G.scene) G.scene.add(GROUP); // kilit listesi sahne kurulmadan hazırlanır: grup ilk karede eklenir
  const pads = new Set(G.stations.filter((s) => s.def && s.def.expansion).map((s) => s.def.id));
  for (const d of DEFS) {
    if (!d.rect) continue;
    const show = pads.has(d.id) && !G.unlocked.has(d.id);
    let mk = markers.get(d.id);
    if (show && !mk) { mk = makePlotMarker(d); GROUP.add(mk); popIn(mk); markers.set(d.id, mk); }
    else if (!show && mk) { GROUP.remove(mk); markers.delete(d.id); }
  }
  // yeni ürünlerin satış yerleri: raf sonradan açılsa da ürünü kabul etsin
  for (const s of G.xsell || []) {
    const shelf = s.shelf && s.shelf();
    if (shelf && Array.isArray(shelf.accepts) && !shelf.accepts.includes(s.type)) shelf.accepts.push(s.type);
    if (s.list) { const l = s.list(); if (l && !l.includes(s.type)) l.push(s.type); }
  }
}

// ---------- satın alma ----------
function openExpansion(d, instant) {
  const R = G.regions[d.region] || null;
  if (!GROUP.parent && G.scene) G.scene.add(GROUP);
  if (d.rect) {
    const gm = d.noGround ? { material: {}, userData: {} } : ground(d);
    if (!instant) { gm.material.opacity = 0; gm.userData.fadeIn = 0; }
    G.walkways.push(d.rect);
    G.annexes.push({ region: d.region, rect: d.rect });
    if (G.hooks.ambRect) G.hooks.ambRect(d.region, d.rect);
    const mk = markers.get(d.id); if (mk) { GROUP.remove(mk); markers.delete(d.id); }
  }
  const ctx = makeCtx(d, R, instant);
  d.build(ctx);
  alignGroundUV(ctx.group || G.scene); alignGroundUV(GROUP); // zemin ve güverte dokuları komşularıyla aynı hizada (tex.js)
  if (!instant) {
    const [x, z] = d.rect ? [(d.rect[0] + d.rect[1]) / 2, (d.rect[2] + d.rect[3]) / 2] : d.at;
    G.camFocus = { pos: new THREE.Vector3(x, 0, z), until: G.time + 2.6 };
    confetti(new THREE.Vector3(x, 0.5, z), 60);
    sfx('region');
  }
}
// zemin yavaşça belirir (her kare: services.js updateExpansions çağırmaz; burada küçük bir zamanlayıcı)
setInterval(() => { for (const m of GROUP.children) if (m.userData.fadeIn !== undefined) { m.userData.fadeIn = Math.min(1, m.userData.fadeIn + 0.08); m.material.opacity = m.userData.fadeIn; if (m.userData.fadeIn >= 1) delete m.userData.fadeIn; } }, 50);

// içerik kurarken kullanılan yardımcılar
function makeCtx(d, R, instant) {
  const C = new THREE.Group(); GROUP.add(C);
  const ctx = {
    R, rect: d.rect, instant, group: C,
    put: (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; C.add(o); if (!instant) popIn(o); return o; },
    col: (x0, x1, z0, z1) => { const c = [x0, x1, z0, z1]; G.colliders.push(c); if (R) R.colliders.push(c); return c; },
    hint: (...a) => H && H.hint(...a),
    icon: (k) => `<img src="${G.icons[k]}" alt="">`,
    src: (type, st) => { (G.xsrc[type] || (G.xsrc[type] = [])).push(st); return st; },
    // bostan: düz toprak yatak, olgun ürün toplanır; elemanlar kaynak olarak görür. Fide fide açılır (game.js PlantBed), buğday ve mısır tarlası dolu
    bed: (x, z, type, grow = 6) => { const b = new PlantBed(C, x, z, type, grow, { instant, ...(type === 'bugday' || type === 'kocan' ? {} : { fide: d.price * 0.25 }) }); ctx.src(type, b); if (M.isFieldCrop(type)) M.fieldMarks(C, x, z, type); if (R && R.beds && (type === 'domates' || type === 'salatalik')) R.beds.push(b); return b; },
    // üretici: model (kümes, baraka...) ve önündeki tepside biriken ürün
    gen: (model, x, z, type, o = {}) => {
      if (model) ctx.put(model, x, 0, z, o.ry || 0);
      const tz = z + (o.trayDz ?? 2.2);
      const g = new Generator(C, { type, interval: o.interval ?? 3.6, max: o.max ?? 8, origin: new THREE.Vector3(x, 1.0, z + Math.sign(o.trayDz ?? 1) * 0.6), tray: [x, o.trayY ?? 0.05, tz], zx: x, zz: tz + (o.zoneDz ?? 1.3), zw: 2.6, zd: 1.3, instant });
      (G.xgens[d.id] || (G.xgens[d.id] = [])).push(g);
      return ctx.src(type, g);
    },
    // makine: ortada model, solda girdi masası, sağda çıktı masası (world.js machineAt ile aynı yerleşim)
    machine: (model, x, z, inType, outType, interval, o = {}) => {
      if (model) ctx.put(model, x, 0, z);
      const wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
      for (const dx of [-2, 2]) ctx.put(workTable(1.2, 0.8, 0.8, wood), x + dx, 0.4, z + 1.2);
      ctx.col(x - 2.7, x + 2.7, z - 0.9, z + 1.7);
      const conv = new Converter(C, { inType, inCap: o.inCap ?? 6, per: o.per, need: o.need, ix: x - 2, iz: z + 2.4, iw: 2.2, id: 1.3, inTray: [x - 2, 0.86, z + 1.2], instant,
        out: { type: outType, interval, max: 6, origin: new THREE.Vector3(x, 1.4, z + 0.3), tray: [x + 2, 0.86, z + 1.2], zx: x + 2, zz: z + 2.4, zw: 2.2, zd: 1.3 } });
      G.xsink.push({ type: inType, conv, pri: o.pri ?? 3 });
      ctx.src(outType, conv.out);
      (G.xgens[d.id] || (G.xgens[d.id] = [])).push(conv.out);
      return conv;
    },
    // yeni ürünün satış yeri: pazar tezgahı türleri, köy manav rafı, şehir manavı ya da verilen raf
    sell: (type, where) => {
      const P = () => G.regions.pazar, K = () => G.regions.koy, S = () => G.regions.sehir;
      const map = {
        pazar: { list: () => P() && P().types, shelf: () => P() && P().stallOf && P().stallOf[type] }, // pazarda kendi tezgahı
        manav: { list: () => K() && K().manavTypes, shelf: () => K() && K().shelfByType && K().shelfByType[type] }, // köyde kendi rafı (reyon.js)
        sehir: { list: () => S() && S().groups && S().groups.taze, shelf: () => S() && S().shelfByType && S().shelfByType[type] }, // şehirde kendi rafı
        hediye: { list: () => S() && S().groups && S().groups.hediye, shelf: () => S() && S().shelfByType && S().shelfByType[type] },
      }[where];
      if (map) G.xsell.push({ type, ...map });
    },
  };
  return ctx;
}
