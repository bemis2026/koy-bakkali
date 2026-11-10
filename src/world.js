// Dünya: 4 bölge (Köy, Pazar, Sahil, Han), kilit sırası, müşteri davranışları, kervan
import * as THREE from 'three';
import {
  G, ITEMS, makeItem, pick, rand, Station, PlantBed, Generator, Shelf, Register, MoneyPile,
  UnlockPad, PaidSource, Lounger, Converter, Customer, fly, popIn, bounce, floatText, sfx, save, toast, mult, offscreen, Stack, lerpAngle, pileKey,
  priceOf, mineFx, bedKey, PRICE_K, queueStep,
} from './game.js';
import { say } from './texts.js';
import { makeHall } from './salon.js';
import { confetti, ring } from './fx.js';
import { feel } from './his.js';
import { updateTepki } from './tepki.js';
import { tierK, LUNA_PRICE, nice } from './fiyat.js';
import { needOk, needInit, needRefresh, needRows } from './sart.js';
import { updateFinal, legendLevel } from './final.js';
import { updateAlbum } from './album.js';
import { banner } from './ui.js';
import { CarOrders, Otopark, LOT } from './events.js';
import { buildSurroundings, updateSurroundings } from './decor.js';
import { showIntro, registerIntro, introInfo } from './intro.js';
import { expansionUnlocks, expansionDefs } from './expand.js';
import './expand-west.js'; // ana oturumun bölge genişletmeleri
import './expand-east.js'; // diğer oturumun bölge genişletmeleri
import { buildStation, updateStation, addCharging, openStation, setStationRevealed, setStationNamed } from './station.js';
import { buildRoads, openRoad, SILK_ROAD, streetLampsTo, ROAD_BANDS } from './roads.js';
import * as D from './dukkan.js';
import { updateThief } from './thief.js';
import { updateChicks } from './chicks.js';
import { SupplyTruck } from './trucks.js';
import { coastZ, coastSlabGeo, bandGeo, wobble } from './nature.js';
import { makeMotorbike, addHelmet, stableRegion } from './riders.js';
import { bakeryRegion } from './carsi.js';
import { buildPark } from './park.js'; // e-ticaret ofisinin yerinde çocuk parkı (2026-11-09)
import { energyRegion } from './energy.js';
import { initLevel, updateLevel, addXp, titleOf, levelReward } from './level.js';
import { dressWorld } from './dress.js';
import { makeTag } from './tags.js';
import { t as dilT, EN as DIL_EN } from './dil.js';
import { makeAisle, kindOf } from './reyon.js';
import { buildCityGround, cityRegion, cityUnlocks, CITY } from './city.js';
import { speak, setAmbience, settings, saveSettings } from './audio.js';
import { updateAmbience } from './ambience.js';
import { updateBirds } from './birds.js';
import { setupResort } from './resort.js';
import { setupPlaza } from './plaza.js';
import { setupLunapark, LP_RECT, LP_WALK, LP_ENTRY } from './lunapark.js';
import { updateOperators } from './calisan.js';
import { buildPets, updatePets } from './pets.js';
import { dressSections, updateDetay } from './detay.js';
import { makeFlag, updateFlags } from './wind.js';
import { setupFarmland } from './farmland.js';
import { repMul, maybeRush, pat, updateRating } from './rating.js';
import { setupRivals } from './rivals.js';
import { updateAlerts } from './alerts.js';
import { updateRafTakip } from './raftakip.js';
import { updateServices } from './services.js';
import { setupIskele } from './fishing.js';
import { enhanceSea, enableSwim, swimAround } from './sea.js';
import { initBeach, updateBeach, seaPlay } from './beach.js';
import { day, shaded } from './daylight.js';
import { havaBeach, havaKac, havaIslak, havaPlaj } from './hava.js';
import { updateTavla } from './tavla.js';
const UMB = [0.75, 0.8]; // şezlong şemsiyesinin şezlonga göre yeri (x, z): öğle saatlerinde gölgesi yatan müşteriye düşer
// şemsiyesiz şezlonglar (x): müşteri güneşte yatar, gölge bahşişi yok (kullanıcı 2026-11-03: "hepsinin yanında şemsiye olmasın,
// bazıları şemsiyesiz güneşleniyor olsun"). İlk altı şezlongun ikisi, sonradan açılanların üçü
const SUNNY = new Set([-2, 25, 26.25, 48]);
// ikili şezlonglar (2026-11-09 kullanıcı: "bazı şezlonglar 2 kişi olsun 2 şezlong yan yana bazıları tek tek"): şezlong sayısı aynı, sonradan açılan dört
// tanesi (eskiden x 10, 32,5, 36,2, 6,2) buradakilerin 1,25 m doğusuna kondu. İkisi bir şemsiyeyi paylaşır (bahşiş gölgesi x + 0,625 sayılır); çiftler çoğu zaman birlikte gelir
const DOUBLE = new Set([14, 25, 40, 2.5]), MATE_DX = 1.25, DOUBLE_UMB = 0.625, DOUBLE_SIDE = 1.55; // ikilinin ortak şemsiyesi batı yanında: üstlerinde olsa kameradan ikisi de örtülüyordu

// Çöp kutusu: yanlış ürünü elden boşaltmak için
class Trash extends Station {
  constructor(parent, x, z, o = {}) {
    super(x, z + 1.05, 1.8, 1.3, { instant: o.instant });
    const bin = put(parent, M.makeBin(), x, 0, z);
    if (!o.instant) popIn(bin);
    this.col = [x - 0.45, x + 0.45, z - 0.45, z + 0.45];
    G.colliders.push(this.col);
    this.bodyFn = () => [this.col]; // yalnızca kutunun kendisi: yanındaki tezgaha değince elindekiler çöpe gitmesin
    this.top = V(x, 1.1, z);
  }
  update(dt) {
    // üstünden geçerken elindekiler gitmesin: kutunun başında 0,6 sn durunca boşaltır
    this.dwell = this.inside ? (this.dwell || 0) + dt : 0;
    if (!this.inside || this.dwell < 0.6) return;
    this.t += dt;
    if (this.t < 0.1) return;
    const it = G.stack.takeOf('*');
    if (!it) return;
    if (G.hooks.trash) G.hooks.trash(it.type, this.top); // çöpe giden ürünün değeri kasadan düşer (account.js)
    this.t = 0;
    fly(it.obj, this.top, null, 0.25, 0.9, (o) => o.parent && o.parent.remove(o));
    sfx('pop');
  }
}
import * as M from './models.js';
import { workTable } from './mobilya.js';
import { texRep, softEdge } from './tex.js';

const PI = Math.PI;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- yardımcılar ----------
function roundedRect(x, y, w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// bölge zemini: yere gömülü düz yüzey (eski kabartma "ada" ve kenar çizgileri yok). Kenarları yumuşak geçişle alttaki çimene
// karışır; çimen bölgeleri dış çimenle aynı doku hizasında ve tonunda (dikiş görünmez). Kilitliyken üstü griye döner (R.top);
// açılınca top.userData.open rengine döner. Kıyıdaki bölgeler geometriyi nature.js coastSlabGeo ile değiştirir (aynı uv)
const GRASS_TINT = '#d9f0c6', FEATHER = 1.6;
const featherCache = new Map();
function featherTex(w, d) {
  const key = `${Math.round(w)}x${Math.round(d)}`;
  if (featherCache.has(key)) return featherCache.get(key);
  const W = 256, H = Math.max(32, Math.round((256 * d) / w)), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), fx = (FEATHER / w) * W, fz = (FEATHER / d) * H, img = g.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    // köşeleri yuvarlak, kenara yaklaştıkça saydamlaşan maske
    const ex = Math.min(i + 0.5, W - i - 0.5) / fx, ez = Math.min(j + 0.5, H - j - 0.5) / fz;
    let k = Math.min(1, ex, ez);
    if (ex < 1 && ez < 1) k = Math.max(0, 1 - Math.hypot(1 - ex, 1 - ez));
    const a = Math.round(255 * k * k * (3 - 2 * k)), o = (j * W + i) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = a; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  featherCache.set(key, t);
  return t;
}
function slab(rect, texName, tile) {
  const [x0, x1, z0, z1] = rect, w = x1 - x0, d = z1 - z0;
  const map = texRep(texName, w / tile, d / tile);
  if (texName === 'grass') map.offset.set(((x0 + 195) / tile) % 1, ((30.9 - z1) / tile) % 1); // decor.js dış çimenle hizalı
  const top = new THREE.MeshStandardMaterial({ map, alphaMap: featherTex(w, d), transparent: true, depthWrite: false, roughness: 0.95, color: texName === 'grass' ? GRASS_TINT : '#ffffff' });
  top.userData.open = texName === 'grass' ? GRASS_TINT : '#ffffff';
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), top);
  m.rotation.x = -PI / 2; m.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2);
  m.renderOrder = -1; m.receiveShadow = true;
  return { mesh: m, top };
}

function strip(parent, cx, cz, w, d, texName, tile, y = 0.012) {
  const soft = texName === 'path'; // toprak şerit çimene yumuşak geçer (tex.js softEdge)
  if (soft) { w += 0.6; d += 0.6; }
  const t = texRep(texName, w / tile, d / tile);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, ...(soft ? { alphaMap: softEdge(w, d, 0.6), transparent: true, depthWrite: false } : {}) }));
  m.rotation.x = -PI / 2; m.position.set(cx, y, cz); m.receiveShadow = true;
  parent.add(m);
  return m;
}

function put(parent, obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z); obj.rotation.y = ry; parent.add(obj); return obj;
}
// bilgi etiketi: uzaktan kısa başlık; oyuncu yaklaşınca ne işe yaradığını da söyler
// × ile kapatılan kutu yerinde minik simgeye dönüşür, simgeye basınca yeniden açılır; kapalılar yerine göre hatırlanır.
// Ayarlardan hepsi gizlenebilir ya da kapatılanlar geri getirilebilir.
const HINTS_KEY = 'koyBakkali.hints';
const closedHints = new Set((() => { try { return JSON.parse(localStorage.getItem(HINTS_KEY) || '[]'); } catch (e) { return []; } })());
const hintList = [];
const saveClosed = () => { try { localStorage.setItem(HINTS_KEY, JSON.stringify([...closedHints])); } catch (e) { /* yok */ } };
// ipucu kapalıysa ya da seviyesi gelmeyen (gizli) bir bölgenin içindeyse görünmez
const hintHidden = (h) => settings.hints === false || Object.values(G.regions).some((R) => R.hidden && h.x >= R.rect[0] && h.x <= R.rect[1] && h.z >= R.rect[2] && h.z <= R.rect[3]);
export function applyHints() { for (const h of hintList) { h.L.hidden = hintHidden(h); h.el.classList.toggle('mini', closedHints.has(h.id)); } if (hintBtn) hintBtn.sync(); }
// ekrandaki bilgi kutularının hepsini tek dokunuşla gizle / göster: mini haritanın sol üstünde minik düğme. Açınca × ile
// kapattıkların da geri açılır; menüdeki "Bilgi kutuları" ayarıyla aynı şey (settings.hints)
let hintBtn = null;
function hintToggle() {
  const b = document.createElement('button');
  b.id = 'hintTog'; b.type = 'button'; b.className = 'hp'; b.innerHTML = '<span>💬</span>';
  b.sync = () => { const off = settings.hints === false; b.classList.toggle('off', off); b.title = off ? 'Bilgi kutularını göster' : 'Bilgi kutularını gizle'; b.setAttribute('aria-label', b.title); };
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', () => {
    const on = settings.hints === false;
    settings.hints = on;
    if (on) { closedHints.clear(); saveClosed(); }
    saveSettings(); applyHints(); sfx('pop');
  });
  (document.getElementById('hud') || document.body).appendChild(b);
  hintBtn = b; b.sync();
}
export function resetHints() { closedHints.clear(); saveClosed(); applyHints(); }
export const closedHintCount = () => closedHints.size;
function hint(x, y, z, ic, title, sub, near = 6.5) {
  const id = `${Math.round(x * 2)}:${Math.round(z * 2)}`;
  const el = document.createElement('div');
  el.className = 'hint';
  const mini = (ic.match(/<img[^>]*>/) || [ic])[0]; // kapalıyken yalnızca ilk resim (ya da emoji)
  el.innerHTML = `<span class="hi">${ic}</span><span class="hm">${mini}</span><span class="hx"><b>${title}</b><small>${sub}</small></span><button type="button" class="hclose" aria-label="Kapat" title="Kapat">×</button>`;
  const L = G.labels.add(el, (v) => {
    v.set(x, y, z);
    // yaklaşınca açılır, biraz uzaklaşınca kapanır: sınırda açılıp kapanarak titremez
    const p = G.player.position, d = Math.hypot(p.x - x, p.z - z), on = el.classList.contains('near');
    if (on ? d > near + 1 : d < near) el.classList.toggle('near', !on);
  });
  el.querySelector('.hclose').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); closedHints.add(id); saveClosed(); el.classList.add('mini'); });
  el.addEventListener('pointerdown', (e) => { if (!el.classList.contains('mini')) return; e.stopPropagation(); e.preventDefault(); closedHints.delete(id); saveClosed(); el.classList.remove('mini'); });
  el.title = title.replace(/<[^>]+>/g, '');
  L.title = el.querySelector('b');
  hintList.push({ id, L, el, x, z });
  L.hidden = settings.hints === false;
  el.classList.toggle('mini', closedHints.has(id));
  return L;
}
const icon = (k) => `<img src="${G.icons[k]}" alt="">`;
function col(minX, maxX, minZ, maxZ) { const c = [minX, maxX, minZ, maxZ]; G.colliders.push(c); return c; }
function colAround(x, z, hw, hd) { return col(x - hw, x + hw, z - hd, z + hd); }

// bölge nesnesi
function region(id, name, rect, walk, texName, tile, sideCol) {
  const R = { id, name, rect, walk, unlocked: false, content: new THREE.Group(), spawnT: 2, colliders: [] };
  const s = slab(rect, texName, tile, sideCol);
  R.slab = s.mesh; R.top = s.top;
  G.scene.add(R.slab);
  R.content.visible = false;
  G.scene.add(R.content);
  // açılmamış bölge çevresinden ayrılmaz: karartılmaz, kendi zemini (taş, kum, çöl) ve içeriği açılınca gelir; o zamana kadar yerinde
  // çevresinin çayırı ve kıyısı görünür (2026-11-01 kullanıcı: "karartma kötü gözüküyor"; "zeminleri çevresiyle uyumlu olsun, saçma öğeler
  // olmasın, yalnız açılmayı bekleyen boş alanlar")
  R.slab.visible = false;
  const el = document.createElement('div');
  el.className = 'lock';
  el.textContent = `${name} · kilitli`; // açılış kilidi (alma işareti) gelmeyen bölümde adsız: "🔒 Kilitli" (nameAreas)
  R.lockEl = el;
  R.lockArgs = [el, (v) => v.set((rect[0] + rect[1]) / 2, 1.5, (rect[2] + rect[3]) / 2)]; // seviyesi gelince yeniden eklenir
  R.lockLabel = G.labels.add(...R.lockArgs);
  G.regions[id] = R;
  return R;
}

// colliders bölge açılınca etkinleşsin diye bölgeye kaydedilir
function rcol(R, minX, maxX, minZ, maxZ) { const c = [minX, maxX, minZ, maxZ]; R.colliders.push(c); if (R.unlocked) G.colliders.push(c); return c; }

export function walkable(x, z) {
  if (x > 700 && G.isle) return G.isle.walk(x, z); // Martı Adası: kara, iskele, yüzme alanı (adacanli.js)
  for (const id in G.regions) {
    const R = G.regions[id];
    if (!R.unlocked) continue;
    const w = R.walk;
    if (x >= w[0] && x <= w[1] && z >= w[2] && z <= w[3]) return true;
  }
  for (const w of G.walkways || []) if (x >= w[0] && x <= w[1] && z >= w[2] && z <= w[3]) return true; // yollar (roads.js)
  return false;
}

// ---------- yol bulma ----------
// elemanlar ve müşteriler binaların, çitlerin, duvarların içinden geçmesin: önleri kapalıysa ızgarada A* ile dolanırlar
const NAV_C = 0.4, NAV_PAD = 0.38;
let nav = null, navKey = '', base = null, baseKey = '', navDyn = new Set();
// hücreleri en az v yapar (1 = alanı açar); engel payı (2) engelin kendisini (3) geri indirmez
function markGrid({ x0, z0, nx, nz }, cost, r, pad, v) {
  const i0 = Math.max(0, Math.ceil((r[0] - pad - x0) / NAV_C - 0.5)), i1 = Math.min(nx - 1, Math.floor((r[1] + pad - x0) / NAV_C - 0.5));
  const j0 = Math.max(0, Math.ceil((r[2] - pad - z0) / NAV_C - 0.5)), j1 = Math.min(nz - 1, Math.floor((r[3] + pad - z0) / NAV_C - 0.5));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * nx + i; if (v === 1 || (cost[k] && cost[k] < v)) cost[k] = v; }
}
// Park eden araç gibi gelip giden engeller (c.dyn, events.js) bütün ızgarayı yeniden kurdurmaz: sabit ızgaranın kopyasına işlenir.
// Eskiden her park edişte ve çıkışta ızgara baştan kuruluyordu (10-20 ms'lik takılma)
function navGrid() {
  let key = '', h = 0, n = 0, dk = '';
  for (const id in G.regions) if (G.regions[id].unlocked) key += id;
  for (const c of G.colliders) { if (c.dyn) { dk += `${c[0]},${c[2]};`; continue; } n++; h += c[0] * 3 + c[1] * 5 + c[2] * 7 + c[3] * 11; }
  key += `|${n}|${h.toFixed(2)}|${(G.soft || []).length}`;
  if (nav && `${key}#${dk}` === navKey) return nav;
  navKey = `${key}#${dk}`;
  const dyn = new Set(), born = [];
  for (const c of G.colliders) if (c.dyn) { const k = `${c[0]},${c[1]},${c[2]},${c[3]}`; dyn.add(k); if (!navDyn.has(k)) born.push(c); }
  navDyn = dyn;
  if (key !== baseKey) { baseKey = key; base = baseGrid(); ROUTES.clear(); }
  else if (born.length) dropRoutes(born); // yeni park eden: yalnız onun üstünden geçen saklı yollar silinir; kalkanın yeri boşalır, eski yollar geçerli kalır
  const cost = base.cost.slice();
  for (const c of G.colliders) if (c.dyn) markGrid(base, cost, c, NAV_PAD, 2);
  for (const c of G.colliders) if (c.dyn) markGrid(base, cost, c, NAV_C * 0.5, 3);
  return (nav = { ...base, cost });
}
function baseGrid() {
  const rects = Object.values(G.regions).filter((R) => R.unlocked).map((R) => R.walk).concat(G.walkways || []);
  const x0 = Math.min(...rects.map((r) => r[0])), z0 = Math.min(...rects.map((r) => r[2]));
  const nx = Math.ceil((Math.max(...rects.map((r) => r[1])) - x0) / NAV_C), nz = Math.ceil((Math.max(...rects.map((r) => r[3])) - z0) / NAV_C);
  const cost = new Uint8Array(nx * nz); // 0 = alan dışı, 1 = serbest, 2 = engel payı (pahalı ama geçilebilir), 3 = engelin kendisi (geçilmez)
  const mark = (r, pad, v) => markGrid({ x0, z0, nx, nz }, cost, r, pad, v);
  for (const r of rects) mark(r, 0, 1);
  for (const c of G.soft || []) mark(c, 0.1, 2); // tarlalar: hasat için girilir ama üstünden yol geçmez
  for (const c of G.colliders) if (!c.dyn) mark(c, NAV_PAD, 2);
  for (const c of G.colliders) if (!c.dyn) mark(c, NAV_C * 0.5, 3); // engelin kendisi geçilmez: uzun dolambaçta bile duvarın içinden yol çizilmez
  // asfalt (roads.js ROAD_BANDS): yayaya pahalı, araçla gidene serbest; yaya geçitleri ve kaldırım sayılan şeritler hariç
  const road = new Uint8Array(nx * nz);
  const fill = (r, v) => {
    const i0 = Math.max(0, Math.ceil((r[0] - x0) / NAV_C - 0.5)), i1 = Math.min(nx - 1, Math.floor((r[1] - x0) / NAV_C - 0.5));
    const j0 = Math.max(0, Math.ceil((r[2] - z0) / NAV_C - 0.5)), j1 = Math.min(nz - 1, Math.floor((r[3] - z0) / NAV_C - 0.5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) road[j * nx + i] = v;
  };
  for (const B of ROAD_BANDS) {
    fill(B.r, 1);
    for (const o of B.open || []) fill(o.r, 0);
    for (const x of B.cross) fill([x - 1.3, x + 1.3, B.r[2], B.r[3]], 0);
  }
  return { x0, z0, nx, nz, cost, road };
}
// from → to arası yürünecek noktalar; son eleman her zaman `to`
// A* tamponları aramalar arasında yeniden kullanılır. Eskiden her arama ızgara boyunda (~140 bin hücre) diziler ve 8 katı
// büyüklükte yığın ayırıp dolduruyordu (~10 MB): aramanın kendisinden pahalıydı, çöp toplayıcı da oyunu takıltıyordu.
// Hücre değerleri arama numarasıyla (stamp) geçerli sayılır, diziler hiç sıfırlanmaz.
let AS = null;
function astarBuffers(n) {
  if (!AS || AS.n !== n) AS = { n, g: new Float32Array(n), came: new Int32Array(n), seen: new Uint32Array(n), shut: new Uint32Array(n), stamp: 0, hf: new Float32Array(1 << 15), hk: new Int32Array(1 << 15) };
  if (++AS.stamp >= 0xffffffff) { AS.seen.fill(0); AS.shut.fill(0); AS.stamp = 1; }
  return AS;
}
// Müşteriler hep aynı girişlerle istasyonlar arasında gider: aynı başlangıç ve hedef hücresi için bulunan yol bir süre
// saklanır (ızgara değişince, yani yeni bölge açılınca ya da engel eklenince hepsi silinir). Uzun bir A* araması ~6 ms sürüyordu.
// Park eden araç (c.dyn) eskiden saklı yolların hepsini sildiriyordu: hemen ardından gelen A* aramaları telefonda kare takıyordu
const ROUTES = new Map();
// a-b kesiti (pad kadar büyütülmüş) r dikdörtgeninden geçiyor mu
function segHits(ax, az, bx, bz, r, pad) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  if (Math.abs(dx) < 1e-9) { if (ax < r[0] - pad || ax > r[1] + pad) return false; }
  else { let u = (r[0] - pad - ax) / dx, v = (r[1] + pad - ax) / dx; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false; }
  if (Math.abs(dz) < 1e-9) { if (az < r[2] - pad || az > r[3] + pad) return false; }
  else { let u = (r[2] - pad - az) / dz, v = (r[3] + pad - az) / dz; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false; }
  return true;
}
function dropRoutes(cols) {
  const pad = NAV_PAD + NAV_C;
  for (const [k, { a, r }] of ROUTES) {
    let p = a;
    for (const q of r) { if (cols.some((c) => segHits(p.x, p.z, q.x, q.z, c, pad))) { ROUTES.delete(k); break; } p = q; }
  }
}
// veh: bisikletli, motorlu (game.js Customer.riding): asfaltta gider, geçit aramaz
export function findRoute(from, to, veh = false) {
  if (Math.hypot(to.x - from.x, to.z - from.z) < 0.8 || !walkable(from.x, from.z) || !walkable(to.x, to.z)) return [to];
  if (!veh) { const c = viaCrossing(from, to); if (c) return c; }
  const grid = navGrid(), { x0, z0, nx, nz, cost } = grid;
  const rk = `${veh ? 'v' : ''}${Math.floor((from.x - x0) / NAV_C)},${Math.floor((from.z - z0) / NAV_C)}>${Math.floor((to.x - x0) / NAV_C)},${Math.floor((to.z - z0) / NAV_C)}`;
  const hit = ROUTES.get(rk);
  if (hit) { const r = hit.r.map((p) => p.clone()); r[r.length - 1] = to; return r; }
  const r = astar(from, to, grid, !veh);
  if (ROUTES.size > 600) ROUTES.clear();
  ROUTES.set(rk, { a: from.clone(), r: r.map((p) => p.clone()) });
  return r;
}
// yaya yolun karşısına geçecekse önce en yakın yaya geçidine yürür, çizgilerin üstünden geçer, karşı kaldırımdan devam eder.
// Yolun ucunun ötesinden geçen ya da yolun üstünde duran için yok (A* asfaltı pahalı sayar, ilk fırsatta kaldırıma çıkar)
function viaCrossing(from, to) {
  for (const B of ROAD_BANDS) {
    const [x0, x1, z0, z1] = B.r;
    const side = (p) => (p.z < z0 || (B.open || []).some((o) => o.side < 0 && p.x >= o.r[0] && p.x <= o.r[1] && p.z <= o.r[3]) ? -1 : p.z > z1 ? 1 : 0);
    const sf = side(from), st = side(to);
    if (sf * st !== -1) continue;
    const xm = from.x + ((to.x - from.x) * ((z0 + z1) / 2 - from.z)) / (to.z - from.z);
    if (xm < x0 || xm > x1) continue;
    const far = (x) => Math.abs(from.x - x) + Math.abs(to.x - x);
    const cx = B.cross.reduce((a, b) => (far(b) < far(a) ? b : a));
    if (Math.abs(from.x - cx) < 1.2 && Math.abs(to.x - cx) < 1.2) return null; // geçidin üstünde: düz geçer
    const a = V(cx, 0, sf < 0 ? z0 - 0.45 : z1 + 0.45), b = V(cx, 0, sf < 0 ? z1 + 0.45 : z0 - 0.45);
    // 2026-11-08 kullanıcı: "sütçü yoldan karşıya geçiyor bakkala giderken sonra geri tekrar karşıya geçiyor boş yere": geçidin ağzına giden yol
    // yolun ucundan dolanıp zaten karşı kaldırıma çıkıyorsa geçide gitmez; geçitten çıkan bacak geldiği yakaya dönüyorsa baştan geçmez
    const legA = findRoute(from, a), i = legA.findIndex((p) => side(p) === st);
    if (i >= 0) return [...legA.slice(0, i + 1), ...findRoute(legA[i], to)];
    const legB = findRoute(b, to);
    for (let j = legB.length - 1; j >= 0; j--) if (side(legB[j]) === sf) return [...findRoute(from, legB[j]), ...legB.slice(j + 1)];
    return [...legA, b, ...legB];
  }
  return null;
}
function astar(from, to, { x0, z0, nx, nz, cost, road }, pen) {
  const ci = (x) => Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / NAV_C)));
  const cj = (z) => Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / NAV_C)));
  const cc = (n) => { const c = cost[n]; return pen && c === 1 && road[n] ? 2 : c; }; // yayaya asfalt pahalı
  const clear = (ax, az, bx, bz) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (NAV_C * 0.5));
    for (let k = 1; k < n; k++) { const t = k / n; if (cc(cj(az + (bz - az) * t) * nx + ci(ax + (bx - ax) * t)) !== 1) return false; }
    return true;
  };
  if (clear(from.x, from.z, to.x, to.z)) return [to];
  const s = cj(from.z) * nx + ci(from.x), goal = cj(to.z) * nx + ci(to.x), gx = goal % nx, gz = (goal / nx) | 0;
  const A = astarBuffers(nx * nz), { g, came, seen, shut } = A, st = A.stamp;
  const gv = (k) => (seen[k] === st ? g[k] : Infinity);
  // uzaklık tahmini 1,3 katıyla ağırlıklı: yol en kısadan en çok %30 uzun olabilir (pratikte aynı), açılan hücre birkaç kat azalır
  const hf = (k) => { const dx = Math.abs((k % nx) - gx), dz = Math.abs(((k / nx) | 0) - gz); return 1.3 * (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)); };
  // tipli dizilerle ikili yığın (öncelik kuyruğu): dolunca iki katına büyür
  let hfv = A.hf, hkv = A.hk, hn = 0;
  const push = (f, k) => {
    if (hn >= hfv.length) { const a = new Float32Array(hfv.length * 2), b = new Int32Array(hkv.length * 2); a.set(hfv); b.set(hkv); A.hf = hfv = a; A.hk = hkv = b; }
    let i = hn++;
    while (i > 0) { const p = (i - 1) >> 1; if (hfv[p] <= f) break; hfv[i] = hfv[p]; hkv[i] = hkv[p]; i = p; }
    hfv[i] = f; hkv[i] = k;
  };
  const pop = () => {
    const top = hkv[0], f = hfv[--hn], k = hkv[hn];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1; let m = -1, mf = f;
      if (l < hn && hfv[l] < mf) { m = l; mf = hfv[l]; }
      if (r < hn && hfv[r] < mf) m = r;
      if (m < 0) break;
      hfv[i] = hfv[m]; hkv[i] = hkv[m]; i = m;
    }
    hfv[i] = f; hkv[i] = k;
    return top;
  };
  g[s] = 0; seen[s] = st; came[s] = -1; push(hf(s), s);
  // başlangıcın ve hedefin 1,6 m yakınındaki engel payı ucuz sayılır: tezgâhın dibindeki hedefe giderken 25 kat pahalı pay, aramayı
  // çevredeki onlarca metreye yayıp tek aramayı 15-30 ms'ye çıkarıyordu. Payın işi uzun yolu engel kenarından uzak tutmak
  const sx = s % nx, sz = (s / nx) | 0, near = (x, z) => (Math.abs(x - gx) <= 4 && Math.abs(z - gz) <= 4) || (Math.abs(x - sx) <= 4 && Math.abs(z - sz) <= 4);
  let found = false, budget = 60000; // ulaşılamayan hedef bütün alanı taramasın: o durumda da düz gidilir
  while (hn > 0 && --budget > 0) {
    const k = pop();
    if (k === goal) { found = true; break; }
    if (shut[k] === st) continue; // eski kayıt: bu hücre zaten açıldı
    shut[k] = st;
    const kx = k % nx, kz = (k / nx) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = kx + dx, z = kz + dz;
      if ((!dx && !dz) || x < 0 || z < 0 || x >= nx || z >= nz) continue;
      const n = z * nx + x, c = cc(n);
      if ((!c || c === 3) && n !== goal) continue;
      if (dx && dz) { const a = cost[kz * nx + x], b = cost[z * nx + kx]; if (!a || !b || a === 3 || b === 3) continue; } // köşeden kesme yok
      const step = (dx && dz ? Math.SQRT2 : 1) * (c === 1 || near(x, z) ? 1 : 25);
      if (g[k] + step < gv(n)) { g[n] = g[k] + step; seen[n] = st; came[n] = k; push(g[n] + hf(n), n); }
    }
  }
  if (!found) return [to];
  const cells = [];
  for (let k = goal; k !== s && k !== -1; k = came[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map((k) => V(x0 + ((k % nx) + 0.5) * NAV_C, 0, z0 + (((k / nx) | 0) + 0.5) * NAV_C));
  pts[pts.length - 1] = to;
  // köşeleri sadeleştir: görülebilen en uzak noktaya doğrudan git (en çok 40 hücre ileriye bakılır: uzun yolda da hızlı)
  const out = [];
  for (let i = 0, cx = from.x, cz = from.z; i < pts.length;) {
    let far = i;
    for (let m = Math.min(pts.length - 1, i + 40); m > i; m--) if (clear(cx, cz, pts[m].x, pts[m].z)) { far = m; break; }
    out.push(pts[far]); cx = pts[far].x; cz = pts[far].z; i = far + 1;
  }
  return out;
}
G.hooks.route = findRoute;
// atlı müşteriler (riders.js) atı bakımdayken köy marketinde alışveriş yapar
G.hooks.shopKoy = (c, o) => shopKoy(G.regions.koy, c, o);

export function heightAt(x, z) {
  if (x > 700 && G.isle) return G.isle.h(x, z); // Martı Adası'nın tepeleri, iskele, deniz (adacanli.js)
  if (z > 3.7 && z < 9.5 && x > 57.5 && x < 66.5) return 0.34 * Math.min(1, (4.5 - Math.abs(x - 62)) / 1.2); // pazar caddesindeki köprü (kaldırımlarıyla geniş)
  // köy dükkânının 20 cm'lik zemini (models.js makeShopStage): aşamayla büyür, arka duvardan (z −13,2) ön cepheye (zf) kadar.
  // Eskiden ilk dükkânın sabit dikdörtgeniydi; büyük markette doğu ve güney kısımda ayaklar zemine gömülüyordu (2026-11-03)
  const S = G.regions && G.regions.koy && D.STAGES[G.regions.koy.stage || 0];
  if (S && x > S.x0 - 0.2 && x < S.x1 + 0.2 && z > -13.2 && z < S.zf) return 0.2;
  for (const c of G.curbs || []) if (x > c[0] - 0.03 && x < c[1] + 0.03 && z > c[2] - 0.03 && z < c[3] + 0.03) return c[4]; // bordürün üstü (roads.js)
  return 0;
}

export function regionAt(p) {
  for (const id of ['koy', 'pazar', 'sahil', 'han', 'tarla', 'mera', 'meydan', 'atolye', 'yol', 'ciftlik', 'atlar', 'firin', 'tatil', 'kasaba', 'enerji', 'tarlalar', 'iskele', 'lunapark', 'sehir']) { // şehir de (yoksa bölge yazısı son gelinen bölgede kalıyordu)
    const R = G.regions[id];
    const r = R.rect;
    if (p.x >= r[0] && p.x <= r[1] && p.z >= r[2] && p.z <= r[3]) return R;
  }
  return null;
}

function unlockRegion(id, instant) {
  const R = G.regions[id];
  if (R.unlocked) return;
  R.unlocked = true;
  R.top.color.set(R.top.userData.open || '#ffffff');
  R.content.visible = true;
  R.slab.visible = true; // zemin bölümün öğeleriyle birlikte gelir
  G.labels.remove(R.lockLabel);
  for (const c of R.colliders) G.colliders.push(c);
  if (!instant) {
    let d = 0;
    for (const ch of R.content.children) { if (ch.isMesh && ch.geometry.type === 'PlaneGeometry') continue; popIn(ch, d); d += 0.015; }
  }
  openRoad(id, instant); // bölgeyle gelen yol: sahil yolu, İpek Yolu (roads.js)
  R.activate(instant);
}

// =====================================================================
// KÖY BAKKALI
// =====================================================================
// raf reklamları: ürün resmi, adı, fiyatı ve esprili bir slogan
// köy dükkânının tek ürünlü rafları (reyon.js): [x, z, yön, genişlik, aşama]. Hepsi güneye, öndeki kasaya bakar (dukkan-plan.md):
// arka sıra z −10,6 duvara dayalı ve kat alır (dolaplar burada), 2. sıra z −7,2 (bakkal), 3. sıra z −3,9 (köy marketi).
// Batı koridoru (kapıdan girenlerin yolu) boş kalır. Raf, yerinin aşaması açılınca kurulur (reyon.js pending)
const KOY_PLACES = {
  sut: [-2.25, -10.6, 1, 2.0, 1], domates: [0, -10.6, 1, 2.0, 1], salatalik: [2.25, -10.6, 1, 2.0, 1], yumurta: [4.5, -10.6, 1, 2.0, 1],
  peynir: [-4.5, -10.6, 1, 2.0, 2], yogurt: [-6.75, -10.6, 1, 2.0, 2], ksut: [6.75, -10.6, 1, 2.0, 2], lahana: [9.0, -10.6, 1, 2.0, 2],
  biber: [-6.75, -7.2, 1, 2.0, 1], patlican: [-4.5, -7.2, 1, 2.0, 1], karpuz: [-2.25, -7.2, 1, 2.0, 1], tursu: [0, -7.2, 1, 2.0, 2], // manav: 1. aşamada dükkânın önünde (KOY_PLACES1)
  bal: [2.25, -7.2, 1, 2.0, 2], ekmek: [4.5, -7.2, 1, 2.0, 2], simit: [6.75, -7.2, 1, 2.0, 2], pogaca: [9.0, -7.2, 1, 2.0, 2],
  kilim: [-9.0, -3.9, 1, 2.0, 3], yun: [-6.75, -3.9, 1, 2.0, 3],
  // köy makinelerinin ürünleri (koymakine.js; büyük köy marketinin doğu şeridindeki makineler). Eskiden burada imalathanenin salça ve
  // kek rafları vardı; 2026-11-02'de ikisi de dükkândan çıktı (salça pazarda, kek kasabada)
  cekirdek: [-4.5, -3.9, 1, 2.0, 4], salata: [-2.25, -3.9, 1, 2.0, 4], koz: [0, -3.9, 1, 2.0, 4], kabaktatlisi: [2.25, -3.9, 1, 2.0, 4],
};
// köy marketinde (3. aşama, doğuya büyüdü) raflar sıralarında yayılır: aralarında ferah geçit kalır, doğu uç da dolar.
// Sıra ve yön aynı (arka sıra kat alır), yalnız x değişir; batı koridoru (x0 + 1,8) boş kalır
const SPREAD_X = [-10.0, -6.66, -3.31, 0.03, 3.37, 6.71, 10.06, 13.4]; // market köyün doğu ucuna (x 15,4) kadar büyüdü
// köy marketinde sıralar arası 3 m (2026-11-01 kullanıcı: "raflar çok yakın, rahat koşulmuyor"): arka sıra duvarda kalır, orta ve ön
// sıra öne (güneye) kayar; dükkânın önü de o kadar büyüdü (dukkan.js STAGES)
const ROW_Z3 = { [-7.2]: -6.4, [-3.9]: -2.5 };
// ön sıra: eskiden iki raf 6,7 m arayla duruyordu (boşluk); şimdi arka sıralarla aynı aralıkta, batıdan doğuya kilim, yün, çekirdek, salata, köz, kabak tatlısı
const FRONT_X3 = [-6.66, -3.31, 0.03, 3.37, 6.71, 10.06];
const KOY_PLACES3 = (() => {
  const P = {}, rows = {};
  for (const [t, v] of Object.entries(KOY_PLACES)) (rows[v[1]] = rows[v[1]] || []).push([t, v]);
  for (const list of Object.values(rows)) {
    list.sort((a, b) => a[1][0] - b[1][0]);
    const front = list[0][1][1] > -5; // ön sıra (yalnız 3. aşama): ortadan sıkça dizilir; kasa kuyruklarının hizasında, doğusu açık kalır
    list.forEach(([t, v], i) => { P[t] = [front ? FRONT_X3[Math.min(i, FRONT_X3.length - 1)] : SPREAD_X[Math.min(i, SPREAD_X.length - 1)], ROW_Z3[v[1]] ?? v[1], ...v.slice(2)]; });
  }
  return P;
})();
// ilk köy dükkânında (1. aşama, x −6,75…6,75) ikinci sırayı kasanın kuyruğu kaplıyor (dukkan.js queueAt): manav reyonu da arka sıraya girer.
// Yedi raf arka duvar boyunca yan yana, aralıksız (1,9 m): batıda biber, patlıcan, karpuz (bakkalda da manav batıda), doğuda süt, domates,
// salatalık, yumurta. Raflar dükkânın önünde durunca içeri girilemiyordu (2026-11-08 kullanıcı: "manav reyonu diğer raflara gitmemi
// engelliyor bakkaldaki, o yüzden rafları yan yana diz aralıksız başlangıçtaki gibi bakkalda"). Dükkân bakkala büyüyünce raflar
// KOY_PLACES'teki yerlerine kayar (relayout)
const ROW1 = ['biber', 'patlican', 'karpuz', 'sut', 'domates', 'salatalik', 'yumurta'], ROW1_W = 1.9;
const KOY_PLACES1 = { ...KOY_PLACES };
ROW1.forEach((t, i) => { KOY_PLACES1[t] = [-5.7 + i * ROW1_W, -10.6, 1, ROW1_W, 1]; });
const koyPlaces = (n) => (n >= 3 ? KOY_PLACES3 : n >= 2 ? KOY_PLACES : KOY_PLACES1);
// raf kilidinin ödeme yeri: rafın önü (yalnız köy marketinde açılan raf, yayılmış yerinin önünde)
const padAt = (t) => { const p = ((KOY_PLACES[t][4] || 1) >= 3 ? KOY_PLACES3 : KOY_PLACES)[t]; return [p[0], p[1] + 1.4]; };
// ilk dükkânda açılan rafın kilidi o aşamadaki yerinin önünde (KOY_PLACES1), sonra bakkaldaki yerinin önünde
const padNow = (t) => { const K = G.regions.koy; if (K && K.stage >= 2) return padAt(t); const p = KOY_PLACES1[t]; return [p[0], p[1] + 1.4]; };

// kümes, mandıra ve ahır pazarın kuzeyindeki Çiftlik'te: geniş avlu, çitli tavuk avlusu ve inek otlağı.
// istasyonlar ve hayvanlar köyün işçilerine bağlı kalır (R.gens, R.critters köyde)
// harita genişletmesi: çiftlik doğu blokta +7
const COOP_AT = [31.4, -27.2], DAIRY_AT = [38.0, -26.2], BARN_AT = [46.4, -27.4];
const CHICK_YARD = [24.0, 30.0, -37.4, -24.6], CHICK_AREA = [24.7, 29.3, -36.7, -25.3];
const COW_FIELD = [40.8, 52.4, -20.4, -14.8], COW_AREA = [42.9, 50.0, -19.6, -15.6]; // otlağın çitlerinden ve yalağından pay bırakılır


function buildKoy() {
  const R = region('koy', 'Köy Bakkalı', [-16, 16, -14, 12], [-15.6, 16.6, -14.6, 12.6], 'grass', 4, '#9b6a3e');
  const C = R.content;
  strip(C, -14, -1, 3.2, 26, 'path', 3);
  strip(C, 12.5, -7.5, 5, 13, 'path', 3);
  strip(C, 3.5, 0, 25, 3, 'path', 3, 0.011);

  // dükkân aşamaları (dukkan.js): bina, duvar engelleri, banko ve kasa yeri aşamayla değişir; raf yerleri sabit
  R.stage = 0; R.shopCols = [];
  // kasiyer bankonun güneyinde içeri bakar, müşteri kuzeyinde öder, kuyruk doğuya. İkinci kasa (addRegister) aynı düzende doğuda
  const setReg = (reg, pile, ca, cs, col, queue) => {
    reg.zone.x = cs.x; reg.zone.z = cs.z; reg.zone.w = 2.6; reg.zone.d = 1.0; reg.bodyN = -1;
    reg.slotsPos = queue; reg.faceY = 0;
    // bankonun üstü: ürünler batıdaki bantta dizilir, kutulanır (game.js Register); yazar kasa doğuda, para yığını doğu uçta
    reg.top = V(ca.x - 0.6, 1.25, ca.z + 0.05); reg.topDir = V(1, 0, 0);
    pile.zone.x = ca.x + 0.95; pile.zone.z = ca.z; pile.base.position.set(ca.x + 0.95, 1.24, ca.z); pile.bodyFn = () => [col];
    if (reg.cashier) reg.cashier.obj.position.set(cs.x, 0.2, cs.z);
  };
  const placeRegister = (n) => {
    setReg(R.register, R.pile, D.counterAt(n), D.cashierAt(n), D.counterCol(n), D.queueAt(n));
    if (R.register2) setReg(R.register2, R.pile2, D.counter2At(n), D.cashier2At(n), D.counter2Col(n), D.queue2At(n));
  };
  R.setStage = (n, instant) => {
    if (n <= R.stage) return;
    R.stage = n;
    buildShop();
    if (!instant) popIn(R.shop, 0.05);
    // büyürken tasarım seçimi (tasarim.js): zemin karoya döndüğü bakkal aşamasından başlayarak her büyümede seçim kartı açılır
    if (!instant && G.hooks.tasarim) setTimeout(() => G.hooks.tasarim(true), 1600);
    for (const c of R.shopCols) for (const L of [R.colliders, G.colliders]) { const i = L.indexOf(c); if (i >= 0) L.splice(i, 1); }
    R.shopCols = D.shellCols(n).map((c) => rcol(R, ...c));
    const ca = D.counterAt(n);
    if (!R.counter) R.counter = put(C, M.makeCounter(), ca.x, 0.2, ca.z, PI); else R.counter.position.set(ca.x, 0.2, ca.z);
    R.shopCols.push(rcol(R, ...D.counterCol(n)));
    if (R.counter2) { const c2 = D.counter2At(n); R.counter2.position.set(c2.x, 0.2, c2.z); R.shopCols.push(rcol(R, ...D.counter2Col(n))); }
    if (R.register) placeRegister(n);
    if (G.custom && G.custom.awning) M.paintShop(R.shop, G.custom);
    if (R.aisle) R.aisle.relayout(koyPlaces(n)); // köy marketinde raflar yayılır (kurulu raflar yeni yerlerine kayar)
    if (R.aisle) for (const t of [...R.aisle.pending]) R.aisle.ensure(t, instant);
    for (const sh of R.shelves || []) if (sh.applyLook) sh.applyLook(); // raflar dükkânla birlikte güzelleşir
    if (n >= 4) growEast();
    // yeri aşamaya göre değişen yan kilit (Manav Reyonu, def.at alıcısı) eski yerinde kalmasın: alanı süt ve peynir rafının üstünde
    // kalıyor, raf doldururken para sessizce kilide akıyordu (2026-11-10 denetimi). Yeniden kurulur, ödenen kısmı korunur
    const old = sideOpen.kr3;
    if (old) { if (old.paid >= 1) padSave.kr3 = Math.floor(old.paid); old.dispose(); delete sideOpen.kr3; sidePads(); }
  };
  // büyük köy marketi doğuya, köy caddesinin batı bordürüne kadar büyür (dukkan.js 4. aşama): oradaki ağaç kalkar, fenerler yan
  // basamaktan caddenin batı kenarına geçer; bölge sınırı da dükkânla birlikte uzar. Eskiden fenerler basamağın üstünde kalıyordu
  // (2026-11-05 kullanıcı: "kaldırıma taşıyor ... üst üste biniyor")
  const growEast = () => {
    const x1 = D.STAGES[4].x1;
    for (const d of R.eastDeco || []) { d.obj.removeFromParent(); for (const L of [R.colliders, G.colliders]) { const i = L.indexOf(d.col); if (i >= 0) L.splice(i, 1); } }
    R.eastDeco = [];
    streetLampsTo(19.35); // batı bordürü x 18,92-19,08, dükkânın yan basamağı x1 + 0,65'e kadar
    R.rect[1] = Math.max(R.rect[1], x1 + 0.4);
  };
  // bina seçilen biçimlerle kurulur (models.js shopStyle); biçim değişince yerinde yeniden kurulur, eskisinin malzemeleri atılır
  const buildShop = () => {
    if (R.shop) { C.remove(R.shop); M.disposeShop(R.shop); }
    const n = R.stage;
    R.shop = M.makeShopStage(Math.min(3, n), D.STAGES[n], { x: D.doorX(n), w: D.DOOR_W }, G.custom || {}); C.add(R.shop); // 4. aşama 3.'nün görünüşüyle, kendi ölçüsünde
    // arka duvarın üstündeki köy evleri (bakkalev.js, 8 Kasım) 2026-11-09'da kalktı (kullanıcı: "adam görünmüyor sokakta ... eskisi gibi olsun")
  };
  R.restyle = () => { if (!R.shop) return; buildShop(); if (G.custom) M.paintShop(R.shop, G.custom); };
  R.setStage(1, true);
  R.placeRegister = placeRegister;

  // dekor
  // köyün güneybatısında bisiklet parkı var; kuyu ve traktör tarlaya taşındı (arabalar Köy Meydanı'na park eder)
  // köyün güneyi yalnızca bostanlara kaldı: hayvanlar ve mandıra Çiftlik'e taşındı, aralar geniş
  // (-11,-12.3) dükkanın batı duvarına giriyordu, (15.2,-3.8) SEMT PAZARI tabelasının direğine biniyordu: kaldırıldılar
  // (15.3,11) plaja inen koridorun ağzındaydı, içeri alındı; (-11.9,10.9) bisiklet parkının yolundaydı, yerine çalı
  const trees = [[17.2, 5.2, 1], [16.4, -12.6, 0]]; // kuzeydoğu ağacı büyüyen marketin köşesinin dışında; güneydoğudaki (15,2/2,8) market öne büyüyünce köşesine düştü // (-11.4,4.6) batıdaki bostanın üstüne düşüyordu; doğu uç genişleme arsası boş kalır
  R.eastDeco = []; // büyük köy marketinin yerinde kalanlar (growEast kaldırır)
  for (const [x, z, k] of trees) {
    const t = put(C, M.makeTree(k, rand(0.9, 1.15)), x, 0, z, rand(0, 6)), col = rcol(R, x - 0.4, x + 0.4, z - 0.4, z + 0.4);
    if (x > 15.4 && z < 3.4) R.eastDeco.push({ obj: t, col });
  }
  // (-12.4,11.3) köyün batı patikasının üstündeydi: kaldırıldı (2026-11-01 kullanıcı: "yolda duranları kaldır")
  // (-10,6/1,8) çalı ile (9,4/2,4), (4,9/2,5) çiçekleri market öne büyüyünce içinde kaldı; (6,5/10,9), (-6,4/10,9) çalıları kayan yatakların
  // üstüne düştü: kaldırıldılar (2026-11-01)
  for (const [x, z] of [[-10.5, -4], [-2, 7.8]]) put(C, M.makeFlowers(), x, 0, z);
  // bostanla sahil arasındaki çit kaldırıldı (2026-11-01 kullanıcı: "gereksiz duvar çitleri kaldıralım, domates ve salatalık fidelerinden
  // sahile geçişteki gibi"): bakkaldan kumsala her yerden inilir
  for (const [x, z] of [[9.8, 6.2], [-2.6, 8.8], [12.6, 8.4]]) put(C, M.makeFlowers(), x, 0, z); // (4.8,8.6) salatalık sırasına düşüyordu
  // fıskiyeli meydan köyden çıkarıldı: ana yolun kuzeyinde, parkıyla birlikte 'kasaba' bölgesinde (plaza.js)

  // pazarın güneybatı köşesinde, köy caddesinin ve pazar caddesinin birleştiği yerde, kameraya dönük. Eskiden köy marketinin doğu
  // duvarının dibindeydi (sol direği duvarın içinde, markete aitmiş gibi duruyordu; 2026-11-06 kullanıcı: "semt pazarının tabelası yanlış
  // duruyor"). Köyde kurulur: pazar açılmadan da yolu gösterir
  R.pazarSign = put(C, M.makeSign('SEMT PAZARI', '#f6a623', 2.6, 0.8), 24.2, 0, 3.0, 0);

  R.shelves = [];
  R.beds = [];
  R.gens = {};
  R.critters = [];
  R.dolapTypes = ['sut'];
  R.shelfByType = {};
  // tek ürünlü raflar (reyon.js, raf-plan.md): her ürünün dükkânda sabit yeri var. Bir kilit bir ürün grubunu açar;
  // grup sonradan büyürse (mandıra peynir, yoğurt küpü, genişletmelerin ürünleri) yeni ürünün rafı kendiliğinden kurulur
  R.manavTypes = ['karpuz', 'biber', 'patlican'];
  R.imalatTypes = []; // imalathanenin ürünleri (salça, kek): kademe açılınca eklenir (expand-west.js)
  const GROUPS = { sut: () => R.dolapTypes, manav: () => R.manavTypes, kilim: () => ['kilim', 'yun'], firin: () => ['ekmek', 'simit', 'pogaca'], imalat: () => R.imalatTypes };
  const BACK_Z = -10.6, fridge = (t) => kindOf(t) === 'fridge';
  R.aisle = makeAisle(R, {
    content: C, put, rcol, places: koyPlaces(Math.max(1, R.stage)), w: 2.0, tagColor: '#4f9a3f', place: 'koy',
    stageOf: (t) => KOY_PLACES[t][4] || 1, stage: () => R.stage, look: () => R.stage, // yeri açılmamış aşamadaki raf bekler (reyon.js pending)
    back: (t) => (KOY_PLACES[t][1] <= BACK_Z ? 2.4 : 0.5), // arka sıra duvara kadar; orta reyon sırt sırta
    tiers: (t) => (KOY_PLACES[t][1] <= BACK_Z ? Math.max(2, (R.wantTiers || {})[fridge(t) ? 'sut' : t] || 0) : 1),
  });
  R.openGroups = new Set();
  R.addShelf = (key, instant) => {
    R.openGroups.add(key);
    for (const t of (GROUPS[key] || (() => [key]))()) R.aisle.ensure(t, instant);
  };
  const farm = (instant) => { unlockRegion('ciftlik', instant); return G.regions.ciftlik; };
  R.addCoop = (instant) => {
    const F = farm(instant), [x, z] = COOP_AT;
    const coop = put(F.content, M.makeCoop(), x, 0, z); if (!instant) popIn(coop);
    rcol(F, x - 1.3, x + 1.3, z - 1.1, z + 1.1); rcol(F, x - 1.25, x + 1.25, z + 1.6, z + 2.6);
    // yumurta masada değil: kümesin önündeki kuluçka folluğunda, saman yuvalarda (köşede kuluçkaya yatmış tavuk)
    R.gens.yumurta = new Generator(F.content, { type: 'yumurta', interval: 2.5, max: 8, origin: V(x - 0.95, 0.5, z + 2.1), tray: [x + 0.25, 0.36, z + 2.1], zx: x, zz: z + 3.4, zw: 2.6, zd: 1.3, instant });
    R.setChickens(Math.max(3, R.wantChickens || 0), instant);
  };
  // hayvan sayısı yükseltmesi: daha çok hayvan = daha hızlı üretim
  R.setChickens = (n, instant) => {
    R.wantChickens = n;
    if (!R.gens.yumurta) return;
    let have = R.critters.filter((k) => k.kind === 'chicken').length;
    const [a0, a1, b0, b1] = CHICK_AREA;
    while (have < n) {
      const ch = put(G.regions.ciftlik.content, M.makeChicken(), rand(a0, a1), 0, rand(b0, b1), rand(0, 6));
      if (!instant) popIn(ch, 0.1 + have * 0.05);
      R.critters.push({ obj: ch, kind: 'chicken', area: CHICK_AREA, t: rand(0, 2), to: null });
      have++;
    }
    // ikiz kümes (twinCoop) eski ikinci kümesin hızını ekler: 2,6 sn'de bir yumurta, bölüm yükseltmesiyle (coopMk) hızlanır. Toplam üretim eskisiyle aynı
    R.gens.yumurta.interval = 1 / (n / (R.gens.yumurta.baseInterval * 3) + (R.twin ? 1 / (2.6 * (R.coopMk || 1)) : 0));
  };
  // ikinci kümes (expand-east.js xciftlik1; 2026-11-08 kullanıcı: "2.kümesi 1.kümesten ayrı yapma beraber genişlesin açınca"): birincinin
  // arkasına bitişik, folluksuz ikiz bina. Yumurta birincinin folluğuna eskiden iki kümesin ayrı ayrı yaptığı kadar düşer (3 tavukla iki kat),
  // tepsi 14 (eskiden iki tepside 8+8), yemlik 20 yem.
  // Bölümün hız (ms_x_xciftlik1) ve tepsi (mc_x_xciftlik1) yükseltmesi upgrades.js apply'da g.interval / g.max yazar: vekil nesne onları
  // büyüyen kümese çevirir (eskiden ikinci kümesin kendi üreticisiydi)
  R.twinCoop = (c) => {
    const [x, z] = COOP_AT, zt = z - 2.3;
    c.put(M.makeCoop(true), x, 0, zt); c.col(x - 1.3, x + 1.3, zt - 1.1, zt + 0.9);
    R.twin = true;
    const g = R.gens.yumurta;
    if (!g) return;
    g.baseMax = 14; g.max = 14 + (R.coopExtra || 0); g.feedCap = 20; if (g._yem) g._yem.cap = 20;
    R.setChickens(Math.max(3, R.wantChickens || 0), c.instant);
    const px = { baseInterval: 1, baseMax: 0 };
    Object.defineProperty(px, 'interval', { get: () => R.coopMk || 1, set: (v) => { R.coopMk = v; R.setChickens(Math.max(3, R.wantChickens || 0), true); } });
    Object.defineProperty(px, 'max', { get: () => g.max, set: (v) => { R.coopExtra = v; g.max = g.baseMax + v; } });
    (G.xgens.xciftlik1 || (G.xgens.xciftlik1 = [])).push(px);
  };
  const COW_SPOTS = [[44.2, -17.4, 0.6], [47.6, -18.6, -0.5], [49.2, -16.2, 0.2], [45.8, -15.9, -1.2]];
  R.setCows = (n, instant) => {
    R.wantCows = n;
    if (!R.gens.sut) return;
    let have = R.critters.filter((k) => k.kind === 'cow').length;
    // inekler ahırın karşısındaki çitli otlakta gezinip otlar
    while (have < n && have < COW_SPOTS.length) {
      const [x, z, ry] = COW_SPOTS[have];
      const cow = put(G.regions.ciftlik.content, M.makeCow(), x, 0, z, ry);
      if (!instant) popIn(cow, 0.2);
      R.critters.push({ obj: cow, kind: 'cow', t: rand(0, 4), to: null, area: COW_AREA });
      have++;
    }
    R.gens.sut.interval = R.gens.sut.baseInterval * 2 / n;
  };
  R.startCars = (instant) => { R.cars = new CarOrders(R, instant); };
  // ikinci kasa (kilit kk2): kendi bankosu, para yığını ve kuyruğu; müşteri kısa kuyruğu seçer, ikinci kasiyer buraya geçer (upgrades.js)
  R.addRegister = (instant) => {
    if (R.register2) return;
    const n = R.stage, ca = D.counter2At(n), cs = D.cashier2At(n);
    R.counter2 = put(C, M.makeCounter(), ca.x, 0.2, ca.z, PI); if (!instant) popIn(R.counter2);
    if (G.custom && G.custom.awning && M.setLook) M.setLook(R.counter2, Math.max(1, Math.min(3, n)));
    R.shopCols.push(rcol(R, ...D.counter2Col(n)));
    R.pile2 = new MoneyPile(C, ca.x + 0.95, ca.z, 1.24, { instant, desk: false, body: D.counter2Col(n) });
    R.register2 = new Register({ zx: cs.x, zz: cs.z, zw: 2.6, zd: 1.0, my: 0.26, pile: R.pile2, instant, queue: D.queue2At(n) });
    R.registers.push(R.register2);
    placeRegister(n);
  };
  // bisiklet parkı: 4 yer; açılınca bisikletli müşteriler gelir. 2026-11-08 kullanıcı: "bisiklet durağını daha güzel yerleştir ve
  // güzelleştir": meydanın batı ucundaki çayırdan (x -40,6; dükkâna 23 m yürünüyordu) dükkânın batı yanına, köy patikasının batısındaki
  // çimene taşındı (paket servis cebiyle patika arasında). Saksılar engel; demirlerin arası bisikletlilerin
  R.addBikeRack = (instant) => {
    const zc = (BIKE_ZS[0] + BIKE_ZS[BIKE_ZS.length - 1]) / 2, half = ((BIKE_ZS.length - 1) * 0.8 + 1.4) / 2;
    const rack = put(C, M.makeBikeRack(BIKE_ZS.length), BIKE_X, 0, zc, PI / 2); if (!instant) popIn(rack);
    for (const s of [-1, 1]) { const pz = zc - s * (half + 0.05); rcol(R, BIKE_X + 0.5, BIKE_X + 1.0, pz - 0.25, pz + 0.25); }
    R.bikeSlots = BIKE_ZS.map((z) => ({ x: BIKE_X, z, c: null }));
    R.bikeT = instant ? 4 : 1.5;
  };
  // otopark: iki park yeri; arabalılar içeri girip alışveriş eder ya da arabada bekleyip servis ister
  R.addLot = (instant) => {
    unlockRegion('meydan', instant);
    R.lot = new Otopark(R, instant);
  };
  // arabadan inip alışverişe giden sürücü; dönünce arabası yola çıkar
  // dışarıdan gelen köy müşterisi (dolmuş durağı, expand-west.js): verilen yerde iner, markete gider, aynı yere döner
  G.hooks.koyVisitor = (pos) => {
    const c = new Customer(pos.clone(), 'koy', M.villagerLook());
    shopKoy(R, c, { basket: R.shelves.length > 1 && Math.random() < 0.5, exit: () => [...D.leavePts(), pos.clone()], onExit: () => c.destroy() });
    c.state = 'begin';
    return c;
  };
  R.spawnDriver = (pc) => {
    const door = pc.doorPoint();
    const c = new Customer(door, 'koy', pc.car.userData.look); // arabadaki köylünün kendisi iner
    popIn(c.obj);
    shopKoy(R, c, { basket: R.shelves.length > 1 && Math.random() < 0.6, exit: () => [...D.leavePts(), door.clone()], onExit: () => { c.destroy(); pc.driverBack(); } });
    c.state = 'begin';
  };
  R.addBarn = (instant) => {
    const F = farm(instant), [x, z] = BARN_AT;
    const barn = put(F.content, M.makeBarn(), x, 0, z); if (!instant) popIn(barn);
    rcol(F, x - 2.1, x + 2.1, z - 1.5, z + 1.6);
    // süt masada değil: ahırın önünde sağılan ineğin yanında, yerde saman üstünde güğümlerde; tabure ve kova
    const milkAt = put(F.content, new THREE.Group(), x, 0, z); if (!instant) popIn(milkAt);
    M.rbox(1.9, 0.04, 1.1, 0.01, M.mat('#e8c56a', { rough: 1 }), -0.6, 0.02, 2.55, milkAt);
    M.cyl(0.18, 0.18, 0.05, 10, M.mat('#a8703f'), 0.6, 0.32, 2.3, milkAt);
    for (let k = 0; k < 3; k++) { const leg = M.cyl(0.025, 0.025, 0.32, 5, M.mat('#8a5a33'), 0.6 + Math.cos(k * 2.1) * 0.12, 0.15, 2.3 + Math.sin(k * 2.1) * 0.12, milkAt); leg.rotation.z = Math.cos(k * 2.1) * 0.15; }
    M.cyl(0.14, 0.11, 0.24, 12, M.mat('#c9d1d8', { rough: 0.3 }), 0.95, 0.12, 2.75, milkAt);
    const cow = M.makeCow(); cow.position.set(2.0, 0, 2.6); cow.rotation.y = -PI / 2; milkAt.add(cow); R.milkCow = cow;
    rcol(F, x - 1.6, x + 2.9, z + 1.95, z + 3.15);
    R.gens.sut = new Generator(F.content, { type: 'sut', interval: 3.2, max: 8, origin: V(x + 1.6, 0.7, z + 2.6), tray: [x - 0.6, 0.05, z + 2.55], zx: x, zz: z + 3.8, zw: 2.6, zd: 1.3, instant });
    R.setCows(Math.max(2, R.wantCows || 0), instant);
  };
  R.addDairy = (instant) => {
    const F = farm(instant), [x, z] = DAIRY_AT;
    const d = put(F.content, M.makeDairy(), x, 0, z); if (!instant) popIn(d);
    R.paddle = d.getObjectByName('paddle');
    if (d.userData.bina) { const [x0, x1, z0, z1] = d.userData.bina; rcol(F, x + x0, x + x1, z + z0, z + z1); } // arkadaki ahır binası (esya.js)
    rcol(F, x - 0.8, x + 0.8, z - 0.8, z + 0.8); rcol(F, x - 2.7, x - 0.9, z - 0.2, z + 0.8); rcol(F, x + 0.9, x + 2.7, z - 0.2, z + 0.8);
    R.dairy = new Converter(F.content, { inType: 'sut', inCap: 6, ix: x - 1.8, iz: z + 1.55, iw: 2.2, id: 1.3, inTray: [x - 1.8, 0.86, z + 0.3], instant,
      out: { type: 'peynir', interval: 4.0, max: 6, origin: V(x, 1.6, z), tray: [x + 1.8, 0.86, z + 0.3], zx: x + 1.8, zz: z + 1.55, zw: 2.2, zd: 1.3 } });
    R.gens.peynir = R.dairy.out;
    if (!R.dolapTypes.includes('peynir')) R.dolapTypes.push('peynir');
  };

  R.activate = (instant) => {
    new Trash(C, 14.9, 9.4, { instant }); // köyün güneydoğu köşesinde, yolların, meydanın ve bostanların dışında
    const ca = D.counterAt(R.stage), cs = D.cashierAt(R.stage);
    R.pile = new MoneyPile(C, ca.x + 0.95, ca.z, 1.24, { instant, desk: false, body: D.counterCol(R.stage) }); // para bankonun doğu ucunda birikir; kasada sen ya da kasiyer
    R.register = new Register({ zx: cs.x, zz: cs.z, zw: 2.6, zd: 1.0, my: 0.26, pile: R.pile, instant, queue: D.queueAt(R.stage) });
    R.registers = [R.register];
    placeRegister(R.stage);
    R.addShelf('domates', instant);
    addPlot('domates', GARDEN.T1, instant); // köy bahçesi: domatesler batıda, salatalıklar doğuda yan yana
  };

  R.update = (dt) => {
    // kasa bankosu kasiyerle güzelleşir (dukkan-plan.md): 1 tahta tezgah, 2 kasiyerli yazarkasa, 3 hızlı kasiyerle bantlı kasa
    if (R.counter) M.setLook(R.counter, 1 + (G.upg.cashier > 0 ? 1 : 0) + ((G.upg['cashSpd@0'] || 0) >= 2 ? 1 : 0));
    for (const k of R.critters) {
      k.t -= dt;
      if (k.kind === 'chicken') {
        const h = k.obj.userData.head;
        if (k.to) {
          const p = k.obj.position, dx = k.to.x - p.x, dz = k.to.z - p.z, d = Math.hypot(dx, dz);
          if (d < 0.05) k.to = null;
          else { p.x += (dx / d) * 0.9 * dt; p.z += (dz / d) * 0.9 * dt; k.obj.rotation.y = Math.atan2(dx, dz); p.y = Math.abs(Math.sin(G.time * 16)) * 0.04; }
          h.rotation.x = 0;
        } else {
          h.rotation.x = Math.max(0, Math.sin(G.time * 7 + k.obj.id)) * 0.9;
          if (k.t <= 0) { k.t = rand(1.5, 4); k.to = V(rand(k.area[0], k.area[1]), 0, rand(k.area[2], k.area[3])); }
        }
      } else {
        // inek: ağır ağır birkaç adım yürür, varınca başını eğip otlar
        const u = k.obj.userData, p = k.obj.position;
        // oyuncu ineğin içinden geçmez, yanından kayar
        const pp = G.player.position, ox = pp.x - p.x, oz = pp.z - p.z, od = Math.hypot(ox, oz);
        if (od < 0.95 && od > 1e-3) { pp.x = p.x + (ox / od) * 0.95; pp.z = p.z + (oz / od) * 0.95; }
        if (k.to) {
          const dx = k.to.x - p.x, dz = k.to.z - p.z, d = Math.hypot(dx, dz);
          if (d < 0.05) { k.to = null; k.t = rand(4, 10); continue; }
          p.x += (dx / d) * 0.35 * dt; p.z += (dz / d) * 0.35 * dt;
          let da = Math.atan2(dx, dz) - k.obj.rotation.y;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          k.obj.rotation.y += da * Math.min(1, dt * 2.5);
          const w = Math.sin(G.time * 5 + k.obj.id);
          u.legs[0].rotation.x = u.legs[3].rotation.x = w * 0.3;
          u.legs[1].rotation.x = u.legs[2].rotation.x = -w * 0.3;
          u.head.rotation.x += (0.1 - u.head.rotation.x) * Math.min(1, dt * 4);
        } else {
          u.head.rotation.x += (0.5 + Math.sin(G.time * 2 + k.obj.id) * 0.08 - u.head.rotation.x) * Math.min(1, dt * 3);
          for (const l of u.legs) l.rotation.x *= 0.85;
          if (k.t <= 0 && k.area) k.to = V(rand(k.area[0], k.area[1]), 0, rand(k.area[2], k.area[3]));
        }
      }
    }
    if (R.paddle) R.paddle.rotation.y = G.time * 2;
    if (R.milkCow) R.milkCow.userData.head.rotation.x = 0.35 + Math.sin(G.time * 1.3) * 0.12; // sağılırken başını eğip otlar
    if (R.cars) R.cars.update(dt);
    R.animalT = (R.animalT ?? 3) - dt;
    if (R.animalT <= 0) {
      R.animalT = rand(16, 28); // hayvan sesleri arada bir, yalnızca yakındayken
      const near = R.critters.filter((k) => k.obj.position.distanceTo(G.player.position) < 8);
      if (near.length) sfx(pick(near).kind === 'cow' ? 'moo' : 'cluck');
    }
    R.spawnT -= dt * repMul(); // mahalle puanı yüksekse müşteri daha sık gelir
    // yeni açılan ürün grubunun rafları (mandıra, yoğurt küpü, genişletmeler sonradan ürün ekler)
    if ((R.groupT = (R.groupT || 0) - dt) <= 0) { R.groupT = 1; for (const k of R.openGroups) R.addShelf(k, G.time < 3); } // açılışta beklemeden kurulur
    const n = G.customers.filter((c) => c.region === 'koy' && !c.leaving).length;
    const u = Math.min(7, R.shelves.length); // tek ürünlü raflar çoğaldı: müşteri sayısı eski raf sayısı kadar büyür
    // dükkân kalabalığı: raf başına 1 müşteriyle başlar, seviye ilerledikçe 1,9'a çıkar (2026-11-01 kullanıcı: "aşırı müşteri yoğunluğu,
    // zamanla başarılı oldukça gelsinler"; eskiden hep 2,5'ti: 7 rafta 19 kişi)
    if (R.spawnT <= 0 && n < 2 + u * Math.min(1.9, 1.0 + (G.level || 1) * 0.02)) {
      R.spawnT = 5.2 / Math.sqrt(u);
      spawnKoy(R);
    }
    if (R.bikeSlots) { R.bikeT -= dt; if (R.bikeT <= 0) { R.bikeT = rand(8, 13); spawnBiker(R); } }
    if (R.lot) R.lot.update(dt);
  };
  return R;
}

// müşteriler haritanın batısından, tarlalarla otlak arasındaki köy yolundan (z ≈ 11) gelir,
// köy yolunun doğu şeridinden (x = -13.3) dükkana yürür ve aynı yoldan gider; arabalar batı şeridinde (x = -15)
const KOY_FAR = -119; // ormanın içindeki köy yolunda (2026-11-04: eskiden -89'da, haritanın kenarında yok oluyorlardı; giderken yavaşça silinirler, game.js)
const koyExit = () => [...D.leavePts(), V(D.WEST_X, 0, 11.9), V(KOY_FAR, 0, 11.9 + rand(-0.2, 0.2))]; // kapıdan çıkıp dükkânın batısından sahil yoluna
// ---------- köy müşterileri ----------
// sepet: müşterinin önünde; aldıkları küçülüp içine dizilir (2x2 kat)
// alışveriş arabası: tabanında 3×2 dizilir, kat kat yükselir
class TrolleyLoad extends Stack {
  constructor(holder, cap) { super(holder, cap, 0, 0); }
  push(type, obj, dur) { obj.scale.setScalar(0.75); return super.push(type, obj, dur); }
  slot(i) { const k = i % 6; return V(((k % 3) - 1) * 0.16, 0.08 + Math.floor(i / 6) * 0.17, (Math.floor(k / 3) - 0.5) * 0.26); }
  update(dt) { const k = 1 - Math.exp(-12 * dt); this.items.forEach((it, i) => { if (!it.flying) it.obj.position.lerp(this.slot(i), k); }); }
}
class BasketLoad extends Stack {
  constructor(holder, cap) { super(holder, cap, 0, 0); }
  push(type, obj, dur) { obj.scale.setScalar(0.6); return super.push(type, obj, dur); }
  slot(i) { const k = i % 4; return V(((k % 2) - 0.5) * 0.2, 0.13 + Math.floor(i / 4) * 0.15, (Math.floor(k / 2) - 0.5) * 0.15); }
  update(dt) { const k = 1 - Math.exp(-12 * dt); this.items.forEach((it, i) => { if (!it.flying) it.obj.position.lerp(this.slot(i), k); }); }
}
// alışveriş listesi: tek müşteri bir raftan, sepetli müşteri 2-3 farklı raftan alır
function koyPlan(R, basket, first) {
  const want = (shelf) => { const acc = shelf.acc(), present = shelf.types().filter((t) => acc.includes(t)); return present.length ? pick(present) : pick(acc); };
  const need = (t) => (ITEMS[t].price >= 20 ? 1 : basket ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3));
  // çoğunlukla dolu raflara yönelir: raf sayısı arttıkça boş rafın önünde bekleyip küsen müşteri çoğalmasın
  const stocked = R.shelves.filter((s) => s.types().length), pool = stocked.length && Math.random() < 0.85 ? stocked : R.shelves;
  // mevsim ürünü satan raf daha çok seçilir (mevsim.js)
  const si = G.season ? G.season.items : [], hot = pool.filter((s) => s.acc().some((t) => si.includes(t)));
  const shelves = first ? [first.shelf] : [hot.length && Math.random() < 0.35 ? pick(hot) : pick(pool)];
  if (basket) shelves.push(...pool.filter((s) => s !== shelves[0]).sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 1 : 2));
  return shelves.map((shelf, k) => { const w = want(shelf); return { shelf, spot: k === 0 && first ? first.spot : null, want: w, need: need(w), got: 0 }; });
}
// köy müşterisinin dükkandaki akışı: raf(lar) → kasa → yolu. o: { basket, first, entry, exit, onExit }
function shopKoy(R, c, o = {}) {
  const steps = koyPlan(R, o.basket, o.first);
  // çok ürün alan müşteri elinde değil sepette ya da arabada taşır (kullanıcı 2026-10-28): üç raf ya da 4+ ürün arabayla, 2-3 ürün sepetle
  const total = steps.reduce((n, s) => n + s.need, 0);
  if (steps.length >= 3 || total >= 4) {
    const t = M.makeTrolley();
    t.position.set(0, 0, 0.78);
    c.obj.add(t);
    c.stack = new TrolleyLoad(t.userData.bin, 14); c.alwaysCarry = true; c.basketMode = true; c.trolley = c.carrier = t;
  } else if (o.basket || total >= 2) {
    const b = M.makeBasket();
    b.position.set(0, 0.78, 0.36); // karakter %90: kolların hizası
    c.obj.add(b);
    c.stack = new BasketLoad(b, 9); c.alwaysCarry = true; c.basketMode = true; c.carrier = b;
  }
  let i = 0, st = steps[0], inside = false;
  c.got = 0; c.bill = 0;
  const bubble = () => { c.want = st.want; c.setBubble(st.want, Math.max(1, st.need - st.got)); if (c.basketMode) c.bEl.classList.add('basket'); }; // c.want: rafçı bekleyen müşteriyi öne alır
  const leave = () => { c.state = 'leave'; c.leaving = true; c.path = o.exit ? o.exit() : koyExit(); };
  const toQueue = () => {
    c.clearBubble();
    if (!c.got) { c.mood(false); leave(); return; }
    // çalışan kasalardan (kasiyeri olan ya da başında senin durduğun) kuyruğu kısa olanı seçer; hiçbiri çalışmıyorsa birinci kasa
    const regs = R.registers || [R.register], live = regs.filter((r) => r.cashier || r.inside);
    const reg = c.reg = (live.length ? live : [R.register]).reduce((a, b) => (b.queue.length < a.queue.length ? b : a));
    reg.join(c); c.path = [reg.posOf(c).clone()]; c.state = 'toQueue';
  };
  const goStep = () => {
    st = steps[i];
    if (!st) { toQueue(); return; }
    if (!st.spot) { st.spot = st.shelf.spots.find((q) => !q.c); if (st.spot) st.spot.c = c; }
    const enter = inside ? [] : [...(o.entry || []), ...D.enterPts()]; // dükkânın batısından kapıya, kapıdan içeri
    inside = true;
    if (!st.spot) { c.state = 'waitSpot'; c.wait = 0; c.path = [...enter, V(st.shelf.zone.x + rand(-1, 1), 0, st.shelf.zone.z + (st.shelf.faceY === 0 ? -0.9 : 2.2))]; return; }
    c.path = [...enter, st.spot.p.clone()];
    c.state = 'toShelf'; bubble();
  };
  c.onPaid = () => { c.mood(true); c.state = 'leave'; c.leaving = true; c.path = o.exit ? o.exit() : koyExit(); };
  const patience = (o.basket ? 28 : 40) * pat(c); // acele müşterinin sabrı yarı süre
  bubble(); // ne alacağı daha yoldayken baloncukta belli
  c.think = (dt) => {
    const p = c.obj.position;
    p.y = heightAt(p.x, p.z);
    switch (c.state) {
      case 'begin': goStep(); break;
      case 'waitSpot': // raf dolu: yanında bekler, yer açılmazsa sıradaki rafa geçer
        c.walk(dt); c.wait += dt;
        if (c.wait > 0.5) {
          const sp = st.shelf.spots.find((q) => !q.c);
          if (sp) { st.spot = sp; sp.c = c; c.path = [sp.p.clone()]; c.state = 'toShelf'; bubble(); } else if (c.wait > 7 && !c.path.length) { i++; goStep(); }
        }
        break;
      case 'toShelf':
        if (c.walk(dt)) { c.state = 'shelf'; c.wait = 0; c.t = 0; bubble(); }
        break;
      case 'shelf':
        c.face(st.shelf.faceY ?? PI, dt); // orta reyonun kuzey yüzündeki rafa güneye dönerek bakar
        c.wait += dt; c.t += dt;
        c.setPatience(1 - c.wait / patience);
        if (c.t > 0.35) {
          c.t = 0;
          const obj = st.got < st.need && !c.stack.full && st.shelf.takeType(st.want);
          if (obj) { mineFx(c, obj); c.bill += priceOf(st.want, obj); c.stack.push(st.want, obj, 0.3); st.got++; c.got++; bubble(); } // kendi dizdiğin ürün fazla satılır
        }
        if (st.got >= st.need || c.stack.full || c.wait > patience) {
          st.spot.c = null;
          if (!o.basket && !st.got) { c.mood(false); leave(); break; }
          i++;
          if (i >= steps.length || c.stack.full) toQueue(); else goStep();
        }
        break;
      case 'toQueue':
        if (c.walk(dt)) c.state = 'queue';
        break;
      case 'queue': {
        const reg = c.reg || R.register;
        // kasasında kimse kalmadıysa (kasiyer işten çıkarıldı, sen öbür kasaya geçtin) ve çalışan başka kasa varsa 8 sn sonra oraya geçer:
        // eskiden ilk seçtiği kasada sonsuza dek bekliyor, acele müşteri kızıp gidiyordu (2026-11-10 denetimi)
        if (!(reg.cashier || reg.inside) && !(reg.sale && reg.sale.c === c)) {
          if ((c.qDead = (c.qDead || 0) + dt) > 8) {
            c.qDead = 0;
            if ((R.registers || [R.register]).some((r) => r !== reg && (r.cashier || r.inside))) { reg.leave(c); c.atRegister = false; toQueue(); break; }
          }
        } else c.qDead = 0;
        // acele müşteri kasa kuyruğunda da uzun bekleyemez: hesabı gecikirse kızıp gider
        if (c.rush && !(reg.sale && reg.sale.c === c) && (c.qWait = (c.qWait || 0) + dt) > 20) { reg.leave(c); c.atRegister = false; c.mood(false); leave(); break; } // ödemesi başladıysa beklemez sayılır (yoksa tezgâhtaki ürünler silinip ceza kesiliyordu)
        queueStep(c, reg, dt, reg.faceY ?? PI); // yerinde bekler, sıra ilerleyince ağır adımla geçer, uzun sırada sıkılır (game.js)
        break;
      }
      case 'leave':
        if (c.walk(dt)) { if (o.onExit) o.onExit(); else c.destroy(); }
        break;
    }
  };
}
// aile: 1-2 kişi (çoğu çocuk) ebeveynin geçtiği yoldan arkasından yürür
function addFamily(L) {
  L.trail = [L.obj.position.clone()];
  L.family = [];
  const n = Math.random() < 0.55 ? 1 : 2;
  for (let k = 0; k < n; k++) {
    const f = new Customer(L.obj.position.clone(), 'koy', { ...M.villagerLook(), mustache: false }); // ailenin çocukları da köylü, bıyıksız
    f.follower = true; f.leaving = true; // müşteri sayımına girmez
    if (k > 0 || Math.random() < 0.7) f.obj.scale.setScalar(0.7);
    f.gap = 1.05 + k * 0.9;
    f.think = (dt) => trailFollow(f, L, dt);
    L.family.push(f);
  }
  const think = L.think;
  L.think = (dt) => {
    think(dt);
    const p = L.obj.position, t = L.trail;
    if (p.distanceTo(t[t.length - 1]) > 0.12) { t.push(p.clone()); if (t.length > 90) t.shift(); }
  };
  const destroy = L.destroy.bind(L);
  L.destroy = () => { for (const f of L.family) f.destroy(); destroy(); };
}
function trailFollow(f, L, dt) {
  const t = L.trail, p = L.obj.position;
  let need = f.gap, prev = p, at = t[0];
  for (let k = t.length - 1; k >= 0; k--) {
    const d = prev.distanceTo(t[k]);
    if (d >= need) { at = prev.clone().lerp(t[k], need / d); break; }
    need -= d; prev = t[k]; at = t[k];
  }
  const q = f.obj.position, dx = at.x - q.x, dz = at.z - q.z;
  q.x = at.x; q.z = at.z; q.y = heightAt(q.x, q.z);
  if (Math.hypot(dx, dz) > 0.004) { f.moving = true; f.obj.rotation.y = lerpAngle(f.obj.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt)); }
}
// yaya müşteri: batıdaki köy yolundan yürüyerek gelir; bazıları sepetli, bazıları ailecek
function spawnKoy(R) {
  const free = R.shelves.filter((s) => s.spots.some((p) => !p.c));
  if (!free.length) return;
  const shelf = pick(free), spot = shelf.spots.find((p) => !p.c);
  const zIn = 11.2 + rand(-0.2, 0.2);
  const c = new Customer(V(KOY_FAR, 0, zIn), 'koy', M.villagerLook()); // köylü: kasketli bıyıklı ya da yemenili
  maybeRush(c); // arada bir acele müşteri: hızlı yürür, çabuk sıkılır, ailesiz ve sepetsiz gelir
  spot.c = c;
  const multi = R.shelves.length > 1, family = multi && !c.rush && Math.random() < 0.22;
  shopKoy(R, c, { basket: family || (multi && !c.rush && Math.random() < 0.35), first: { shelf, spot }, entry: [V(D.WEST_X, 0, zIn)] });
  c.state = 'begin';
  if (family) addFamily(c);
}
// bisikletli müşteri: köy yolundan bisikletle gelir, parka bırakır, alışverişten sonra bisikletiyle döner
const BIKE_COLS = ['#e8604c', '#3d7dd8', '#3fae6b', '#f6c343', '#9c6cf0', '#ff8a65'];
// bisiklet parkı dükkânın batı yanında (2026-11-08; eskiden meydanın batı ucunda, x -40,6). Bisikletli ana yolun güney şeridinden (z -17,2)
// köy patikasına (BIKE_LANE, x -15) döner, patikadan inip parka girer; dönüşte patikadan yola çıkıp karşı şeride (z -19,8) geçer
const BIKE_X = -19.4, BIKE_ZS = [-5.6, -6.4, -7.2, -8.0], BIKE_LANE = -15.0, BIKE_ROAD_Z = -17.2, BIKE_RET_Z = -19.8;
const BIKE_WALK = [V(-15.2, 0, -4.7)];
export const motoPose = (o) => { for (const l of o.userData.legs || []) l.rotation.x = -1.15; }; // motosiklet sürücüsü: bacaklar öne, ayaklar basamakta
function spawnBiker(R) {
  const slot = R.bikeSlots.find((s) => !s.c);
  if (!slot || !R.shelves.some((s) => s.spots.some((p) => !p.c))) return;
  const zIn = BIKE_ROAD_Z + rand(-0.15, 0.15);
  const c = new Customer(V(KOY_FAR, 0, zIn), 'koy', M.villagerLook());
  slot.c = c;
  const moto = Math.random() < 0.4; // motorlu müşteri: motosikletle gelir, kask takar (riders.js)
  const bike = moto ? makeMotorbike(pick(BIKE_COLS)) : M.makeBicycle(pick(BIKE_COLS));
  if (moto) addHelmet(c.obj, pick(['#2d3e66', '#e8473c', '#1d1f24', '#f6c343']));
  bike.position.set(KOY_FAR, 0, zIn);
  R.content.add(bike);
  const walkSpeed = c.speed;
  // motosiklette pedal çevrilmez (2026-11-01 kullanıcı: "motor kullananlar bisiklet sürer gibi pedal çeviriyor"): bacaklar öne, ayak basamakta
  const ride = (on) => {
    c.riding = on; c.speed = on ? (moto ? 8.5 : 5.5) : walkSpeed; c.pose = on && moto ? motoPose : null;
    if (c.carrier) c.carrier.visible = !on; // sürerken araba ya da sepet gidondan taşmasın; inince yeniden görünür
  };
  // sürerken bisiklet altında: kişi selede, teker döner
  const sync = () => {
    const p = c.obj.position, ry = c.obj.rotation.y, off = moto ? 0.38 : 0.2, bx = p.x + Math.sin(ry) * off, bz = p.z + Math.cos(ry) * off;
    const moved = Math.hypot(bx - bike.position.x, bz - bike.position.z);
    bike.position.set(bx, 0, bz); bike.rotation.y = ry; p.y = moto ? 0.28 : 0.65; // sele yüksekliği (bisiklet ×1,3, motor ×1,25)
    for (const w of bike.userData.wheels) w.rotation.x += moved / (moto ? 0.41 : 0.38); // teker yarıçapı
  };
  shopKoy(R, c, {
    basket: R.shelves.length > 1 && Math.random() < 0.4,
    entry: [V(slot.x + 0.9, 0, slot.z), ...BIKE_WALK.map((p) => p.clone())],
    exit: () => [...D.leavePts(), ...BIKE_WALK.map((p) => p.clone()).reverse(), V(slot.x + 0.9, 0, slot.z)],
    // dönüşte yolun karşı şeridine geçer: aynı şeritte gelen arabalarla burun buruna kilitleniyordu
    onExit: () => { ride(true); slot.c = null; c.state = 'rideAway'; c.path = [V(BIKE_LANE, 0, slot.z), V(BIKE_LANE, 0, BIKE_ROAD_Z - 0.4), V(BIKE_LANE - 1.6, 0, BIKE_RET_Z), V(KOY_FAR, 0, BIKE_RET_Z)]; },
  });
  const core = c.think;
  ride(true);
  c.go(V(BIKE_LANE, 0, zIn), V(BIKE_LANE, 0, slot.z), V(slot.x, 0, slot.z));
  c.state = 'ride';
  c.think = (dt) => {
    if (c.state === 'ride') {
      c.walk(dt); sync();
      if (!c.path.length) { ride(false); bike.position.set(slot.x, 0, slot.z); bike.rotation.y = -PI / 2; c.obj.position.y = 0; c.state = 'begin'; }
      return;
    }
    if (c.state === 'rideAway') { const done = c.walk(dt); sync(); if (done) { c.obj.attach(bike); c.destroy(); } return; } // bisiklet sürücüsüyle birlikte silinir
    core(dt);
  };
}

// =====================================================================
// SEMT PAZARI
// =====================================================================
// Bütün tezgâhlar U biçiminde, gerçek pazar gibi (2026-11-06 kullanıcı: "kasayı raflarımızın yanına al orayı bizim alanımız yap, daha uyumlu gerçek pazar
// gibi u şeklinde yerleştir tüm tezgahları rakiple"): U caddeye (güneye) açılır, müşteri avluda gezer. Kuzeyin ortası Çiftlik yolu (x 36-39,5) açık.
// Kuzeyin batısı ve batı kol rakiplerin (rivals.js), köşede salça kazanı (salçacı kendi satar, expand-west.js) ve akordeoncu.
// Doğu yarı bizim (2026-11-09 kullanıcı: "turşucunun oradaki raflar görünmüyor onların açısını yola paralel yap eski düzendeki gibi. yukarı al bizim tezgahı";
// doğu koldaki tezgâhlar avluya, batıya bakıyordu, çadırın altında yandan görünüyordu): bütün tezgâhlarımız yola (güneye) bakar. Kuzey sıra (k 0-6) kasadan
// batıya uzanır, önündeki ikinci sıra (k 7-12) ek ürünler içindir; kasa kuzey sıranın doğu ucunda, pazar bostanı ve turşucu hemen yanında.
// Karpuz pazarla gelir; domates, salatalık, biber, patlıcan kendi kilidiyle açılır (UNLOCKS pt1-pt4; 2026-11-06 kullanıcı: "sebze kamyoneti var onu açınca biber
// falan rafı geliyor bu saçma o raflar ayrıca tek tek açılsın"), yerleri sabittir ve toplanmazlar. Başka yerden gelen ürünün (kilim, turşu, salça...) tezgâhı mal
// gelince sıranın ucunda kurulur, bir dakika boş kalınca toplanır, sonrakiler boşluğu kapatır ("pazarda boş raf olmasın"). Tezgâha önden de arkadan da değince dizilir
const PZ_W = 1.4, PZ_STEP = 1.5, PZ_N = -11.8, PZ_S = -2.6, PZ_A = 7, PZ_IDLE = 60, PZ_KX = 51.35, PZ_DET = 42.4, PZ_DZ = -8.4;
const PZ_FIXED = ['karpuz', 'domates', 'salatalik', 'biber', 'patlican'], PZ_SLOTN = 13, VEG = ['biber', 'patlican'];
// k. yer: 0-6 kuzey sıra (kasanın batısından batıya), 7-12 ön sıra (doğudan batıya); hepsi güneye bakar, iki sıranın tezgâhları aynı hizada.
// Kuzey sıra Çiftlik yolunun (x 39,5) doğusunda biter. Kasa x 50,6-52,1 (PZ_KX)
const pzSlot = (k) => (k < PZ_A ? { x: 49.7 - PZ_STEP * k, z: PZ_N, ry: 0 } : { x: 51.2 - PZ_STEP * (k - PZ_A), z: PZ_S, ry: 0 });
const pzPad = (k) => { const s = pzSlot(k); return [s.x, s.z]; };
const PZ_SLOTS = M.STALL_ROWS.flatMap(([z, y]) => [-0.31, 0.31].map((x) => new THREE.Vector3(x, y, z))); // arkadan öne dolar, müşteri önden alır
function buildPazar() {
  // yürünen alan kuzeyde biraz geniş: tezgâhların arkasındaki şerit taşın dışına biraz taşar
  const R = region('pazar', 'Semt Pazarı', [23, 53, -14, 12], [22.4, 52.6, -14.6, 12.6], 'cobble', 2.4, '#7d776b');
  const C = R.content;
  // pazar caddesi (kaldırımlı araç yolu ve kamyon park cebi) roads.js'te

  // bizim alan: kasanın ve açık tezgâhların altından arkasına uzanan tahta döşeme. Tezgâhınki tezgâhla gelir: boş tahta alan kalmasın.
  // Eski doğu kol şeridi ve köşedeki süslü kutu (kasalar, çuvallar) 2026-11-09'da kalktı; levha kasanın arkasında
  strip(C, 51.53, PZ_N - 0.65, 2.15, 3.1, 'wood', 2.2, 0.02);
  R.deckN = [];
  for (let k = 0; k < PZ_SLOTN; k++) { const q = pzSlot(k), m = strip(C, q.x, q.z - 0.65, PZ_STEP + 0.02, 3.1, 'wood', 2.2, 0.02); m.visible = false; R.deckN.push(m); }
  const deckSync = () => { R.deckN.forEach((m, i) => { m.visible = R.row.some((s) => s.k === i); }); };
  put(C, M.makeMiniSign('BİZİM TEZGÂHLAR', '#e39b3a', 2.3, 0.56, 2.7), 52.2, 0, -13.3);

  // oyuncunun tezgâhları: her ürünün kendi küçük tezgâhı (raf-plan.md)
  R.stalls = []; R.stallOf = {}; R.row = []; R.rowV = 0; // row: açık tezgâhlar
  // caddeden U'nun ağzına, oradan yerine (rivals.js de). Ön sıranın açık tezgâhı yolu kesiyorsa kuzey sıraya gelen müşteri ön sıranın batı ucundan
  // (PZ_DET şeridi) dolaşır, iki sıranın arasından (PZ_DZ) yerine yürür: tezgâhın içinden geçmez. Dönüşte aynı yoldan çıkar (R.exitPath)
  const behind = (sp) => sp.row === 'A' && R.row.some((s) => s.k >= PZ_A && Math.abs(pzSlot(s.k).x - sp.p.x) < 1.15);
  R.approach = (sp) => (sp.lane != null ? [V(sp.lane, 0, 4.4), V(sp.lane, 0, sp.p.z), sp.p.clone()]
    : behind(sp) ? [V(PZ_DET, 0, 4.4), V(PZ_DET, 0, PZ_DZ), V(sp.p.x, 0, PZ_DZ), sp.p.clone()] : [V(sp.p.x, 0, 4.4), sp.p.clone()]);
  R.exitPath = (sp) => (sp.lane == null && behind(sp) ? [V(sp.p.x, 0, PZ_DZ), V(PZ_DET, 0, PZ_DZ)] : []);
  const dyn = () => R.row.filter((s) => !s.fixed).sort((a, b) => a.k - b.k);
  const tailK = () => Math.max(PZ_FIXED.length - 1, ...dyn().map((s) => s.k)) + 1; // sıranın ucundaki ilk boş yer
  // tezgâhı taşır: model, dizme alanı (arkası, kuzeyi), müşterinin durduğu yer (önü, güneyi) ve engel kutusu birlikte
  const place = (sh, k) => {
    const q = pzSlot(Math.min(k, PZ_SLOTN - 1)), c = sh.col;
    sh.k = k; sh.group.position.set(q.x, 0, q.z); sh.group.rotation.y = q.ry;
    sh.zone.x = q.x; sh.zone.z = q.z - 1.65; sh.zone.w = 1.6; sh.zone.d = 1.4;
    for (const o of sh.spots) { o.p.set(q.x, 0, q.z + 2.1); o.ry = PI; o.lane = null; o.row = k < PZ_A ? 'A' : 'B'; }
    c[0] = q.x - PZ_STEP / 2; c[1] = q.x + PZ_STEP / 2; c[2] = q.z - 0.8; c[3] = q.z + 0.8;
  };
  const pack = (sh) => {
    sh.packed = true; sh.group.visible = false;
    for (const L of [R.colliders, G.colliders]) { const i = L.indexOf(sh.col); if (i >= 0) L.splice(i, 1); }
    const i = R.row.indexOf(sh); if (i >= 0) R.row.splice(i, 1);
  };
  const unpack = (sh, instant) => {
    const k = sh.fixed ? PZ_FIXED.indexOf(sh.type) : tailK();
    sh.packed = false; sh.emptyT = 0; sh.group.visible = true; if (!instant) popIn(sh.group);
    R.colliders.push(sh.col); if (R.unlocked) G.colliders.push(sh.col);
    R.row.push(sh); place(sh, k);
  };
  // müşterisi, elemanı ya da başında oyuncu olan tezgâh yerinden oynamaz
  const busy = (sh) => sh.inside || sh.spots.some((s) => s.c) || G.workers.some((w) => w.target && (w.target === sh || w.target.key === sh));
  R.addStall = (type, instant) => {
    if (R.stallOf[type]) return R.stallOf[type];
    const st = put(C, M.makeMiniStall('#f6c343', PZ_W), 0, 0, 0), it = ITEMS[type];
    const nameTag = makeTag(`${dilT(it.name).toLocaleUpperCase(DIL_EN ? 'en' : 'tr')} ${it.price}₺`, [type], '#e39b3a', PZ_W - 0.06, 0.32); nameTag.position.set(0, 0.4, 0.71); st.add(nameTag);
    // tepede büyük ürün: hangi yandan bakılsa ne satıldığı belli, tezgâh boşken de
    const big = makeItem(type), bb = new THREE.Box3().setFromObject(big), sz = bb.getSize(V(0, 0, 0)), kb = 0.62 / Math.max(sz.x, sz.y, sz.z);
    big.scale.multiplyScalar(kb); big.position.set(0, 2.87 - bb.min.y * kb, -0.66); st.add(big);
    const col = rcol(R, 0, 1, 0, 1); col.dyn = true; col.mm = true; // gelip giden engel: yol ızgarası baştan kurulmaz; küçük haritada çizilir
    const sh = new Shelf({ zx: 0, zz: 0, zw: 1.6, zd: 1.4, accepts: [type], cap: PZ_SLOTS.length, group: st, slots: PZ_SLOTS, instant, spots: [V(0, 0, 0)] });
    sh.type = type; sh.place = 'pazar'; sh.col = col; sh.emptyT = 0; sh.fixed = PZ_FIXED.includes(type);
    sh.fit = Math.min(1, 0.62 / Math.max(sz.x, sz.z)); // iri ürün (turşu kavanozu, halı) tezgâha küçülerek oturur, komşu yerle iç içe geçmez
    for (const a of sh.anchors) a.scale.setScalar(sh.fit);
    if (R.bigStalls) { R.enlarge(sh); if (st.userData.awning) st.userData.awning.visible = false; }
    R.stalls.push(sh); R.stallOf[type] = sh;
    pack(sh); place(sh, sh.fixed ? PZ_FIXED.indexOf(type) : Math.min(tailK(), PZ_SLOTN - 1)); // toplu kurulur; sabit tezgâh hemen açılır
    if (sh.fixed) unpack(sh, instant);
    R.rowV++; tents(); deckSync();
    return sh;
  };
  // kilitle açılan tezgâh: ürün pazar türlerine ve (biber, patlıcan) kamyonetin yüküne girer
  R.openStall = (type, instant) => {
    if (!R.types.includes(type)) R.types.push(type);
    if (R.vegSrc && VEG.includes(type) && !R.vegSrc.types.includes(type)) R.vegSrc.types.push(type);
    return R.addStall(type, instant);
  };
  // sıra düzeni (yarım saniyede bir): mal gelen ya da oyuncunun elindeki ürünün tezgâhı açılır, uzun süre boş kalan toplanır,
  // aradaki boşluk kapanır. Müşterisi ya da elemanı olan tezgâh beklenir, ötesindekiler de onunla bekler. Yer yoksa mal bekler
  R.tidy = (dt) => {
    const p = G.player.position, ours = p.x > 38 && p.x < 54 && p.z > -15.5 && p.z < 4.6;
    const carry = (t) => ours && G.stack && G.stack.count(t) > 0;
    let n = 0;
    for (const sh of R.stalls) {
      if (sh.fixed) continue;
      if (sh.packed) { if ((sh.count() || carry(sh.type)) && tailK() < PZ_SLOTN) { unpack(sh); n++; } }
      else if (sh.count()) sh.emptyT = 0;
      else if ((sh.emptyT += dt) >= PZ_IDLE && !busy(sh)) { pack(sh); n++; }
    }
    let k = PZ_FIXED.length;
    for (const sh of dyn()) { if (sh.k !== k) { if (busy(sh)) break; place(sh, k); n++; } k++; }
    const t = Math.min(tailK(), PZ_SLOTN - 1);
    for (const sh of R.stalls) if (sh.packed && sh.k !== t && !busy(sh)) { place(sh, t); n++; }
    if (!n) return;
    R.rowV++; tents(); deckSync();
    for (const s of G.stations) if (s.zone && s.zone.x > 20 && s.zone.x < 56 && s.zone.z > -16 && s.zone.z < 14) s.bodyN = -1; // gövdeler yeniden bulunur (game.js bodyRects)
  };
  // pazar çadırı (expand-east.js xpazar3): her tezgah bir kat daha ürün alır
  R.enlarge = (sh) => { if (sh.big) return; sh.big = true; sh.addSlots(PZ_SLOTS.map((v) => v.clone().add(V(0, 0.3, 0)))); for (const a of sh.anchors) a.scale.setScalar(sh.fit || 1); };
  // çadır: tezgâhların arkasında uzun gölgelik; kuzey sırada kasadan açık tezgâhların ucuna kadar, ön sırada açık tezgâhlar boyunca. Sıra uzayıp kısaldıkça yeniden kurulur.
  // Oyuncunun yolunu kapatmasın diye direkleri engel değil. 2026-11-09: çadırın ön kenarı tezgâhın arka kenarında (eskiden tezgâhın ortasındaydı, tente
  // kameradan bakınca tezgâhın üst yarısını örtüyordu). Kuzey sıranınki ahır çitine (z -14,8) değmesin diye daha dar (2,7 m yerine 2 m).
  // Uzun çadır yalnız kuzey sırada: ön sıranınki iki sıranın arasında yürüyen oyuncuyu örtüyordu, ön sıra tezgâhları kendi tentesiyle durur
  let tentMake = null, tentN = -1, tentG = [];
  R.setTents = (make, instant) => { tentMake = make; tents(instant, true); };
  const tents = (instant, first) => {
    if (!tentMake) return;
    for (const k of R.stalls) { const a = k.group.userData.awning; if (a) a.visible = k.k >= PZ_A; } // kuzey sıradakinin tentesi uzun çadırın içinde kalır
    const lastA = Math.max(2, ...R.row.filter((s) => s.k < PZ_A).map((s) => s.k)); // en az üç tezgâhlık
    if (lastA === tentN) return;
    tentN = lastA;
    for (const t of tentG) t.removeFromParent();
    const x1 = PZ_KX + 0.75, x0 = pzSlot(lastA).x - PZ_STEP / 2;
    tentG = [put(C, tentMake(x1 - x0), (x0 + x1) / 2, 0, PZ_N - 1.75)];
    tentG[0].scale.z = 0.74;
    if (first && !instant) for (const t of tentG) popIn(t);
  };
  // satın alınan rakip tezgâhın altına da tahta döşeme gelir
  R.claim = (rv) => {
    const sn = Math.abs(Math.sin(rv.ry)), cs = Math.abs(Math.cos(rv.ry));
    strip(C, rv.x - Math.sin(rv.ry) * 0.75, rv.z - Math.cos(rv.ry) * 0.75, cs * 4 + sn * 3.4, sn * 4 + cs * 3.4, 'wood', 2.2, 0.02);
  };
  // üç rakip tezgah: müşteri kapışması, indirim kampanyaları, pazar payı ve satın alma (rivals.js)
  R.rivals = setupRivals(R, { put, rcol, hint });
  // toptancı kamyonu kasası pazara dönük park eder; ürün kasaları arkasında, alım alanının hemen önünde
  // mal bitince yükü almaya gider (trucks.js); kasalar ve kasadaki karpuzlar malı gösterir
  // kamyonlar caddenin güneyindeki park cebinde batıya bakar; kasalar ve alım yeri arka uçlarında (trucks.js)
  R.truck = put(C, M.model('truck'), 28.5, 0, 9.6, -PI / 2); rcol(R, 25.7, 31.3, 8.6, 10.6);
  R.truckCargo = [];
  for (const z of [9.1, 10.1]) R.truckCargo.push(put(C, M.makeCrateOf(['watermelon', 'watermelon', 'watermelon']), 31.9, 0, z, PI / 2));
  for (let i = 0; i < 4; i++) { const w = M.model('watermelon'); w.position.set(29.6 + Math.floor(i / 2) * 0.8, 1.15, 9.2 + (i % 2) * 0.8); C.add(w); R.truckCargo.push(w); }
  rcol(R, 31.5, 32.3, 8.7, 10.5);
  // SAHİL tabelasının yanındaki park etmiş sedan (50,5/10,5) kaldırıldı (2026-11-03 kullanıcı: "sahil tabelasının yanındaki arabayı kaldır")
  for (const [x, z] of [[24, -3], [52.45, -3], [24, 10.8], [52.45, 3.2]]) put(C, M.makeLamp(), x, 0, z); // doğudakiler tahta şeridin dışında
  for (const [x, z] of [[44.4, 8.6], [44.4, 9.6], [44.4, 10.6]]) put(C, M.model('cone'), x, 0, z); // park cebinin doğu ucu
  // pazarın arnavut taşındaki üç ağaç (24,5/-12,5), (51,5/-6), (24,6/2) kaldırıldı (2026-11-04 kullanıcı: "ağaçlar markette ve bazı alakasız
  // yerlerde duruyor, ağaçlar çimen üstünde olacak şekilde yerleştir başka yerdekileri kaldır hem yollar da düzelsin")
  put(C, M.makeSign('SAHİL', '#3ec1b5', 2.2, 0.75), 46.6, 0, 11, 0);

  R.types = ['karpuz']; // öbür tezgâhlar kilitle (R.openStall) ya da mal gelince (R.addStall)
  R.sources = [];
  R.activate = (instant) => {
    // tahta şeridin kuzeydoğu köşesinin dışında, çimende: tezgâhların arkasından geçerken değmez (2026-11-03 kullanıcı: "turşucunun yanındaki çöp tenekesi orada sıkışmış, açık bir alana koy")
    new Trash(C, 53.6, -13.4, { instant });
    // kasa kuzey sıranın doğu ucunda, karpuz tezgâhının yanında: para burada birikir (2026-11-09'a kadar doğu kolun cadde ucundaydı, 49,8 / 2,1).
    // Kasadar işe alınabilir (2026-11-06 kullanıcı: "kasasında kasiyer yok"; upgrades.js DESKS ka_pazar): kasanın arkasında, güneye dönük durur,
    // başında durduğu yığına hırsız gelmez. Tezgâh doğu-batı uzanır: yazarkasa batı ucunda, para ortada, levha doğu köşede
    const ledge = put(C, M.makeCashLedge(0.75, 1.5, 0.9), PZ_KX, 0, PZ_N, PI / 2); if (!instant) popIn(ledge);
    M.faceRegister(ledge.userData.register, PZ_KX, PZ_N - 1.15); // ekran tezgâhın arkasındakine, müşteri önden öder
    const ks = put(C, M.makeMiniSign('KASA', '#3fae6b', 0.9, 0.34, 2.3), PZ_KX + 0.66, 0, PZ_N - 0.32); if (!instant) popIn(ks);
    R.pile = new MoneyPile(C, PZ_KX + 0.25, PZ_N, 0.92, { instant, desk: false, ry: PI / 2, body: rcol(R, PZ_KX - 0.75, PZ_KX + 0.75, PZ_N - 0.38, PZ_N + 0.38), spot: [PZ_KX, PZ_N - 1.15, 0],
      look: { shirt: '#e39b3a', pants: '#4a3a2a', hat: 'cap', hatColor: '#f6c343', skin: '#e0b48a' } });
    const src = new PaidSource({ x: 33.2, z: 9.6, types: ['karpuz'], origin: V(31.9, 1.0, 9.6), instant });
    R.sources.push(src);
    for (const t of R.types) R.addStall(t, instant); // kaynaktan sonra: karpuz tezgahı açık kurulur
    const K = ITEMS.karpuz;
    const h = hint(32.6, 2.3, 9.6, icon('karpuz'), `Toptancı · Karpuz ${K.cost} ₺`, `Kasaların önündeki alanda dur, karpuzlar sırtına yüklenir. Tezgaha götür, tanesi ${K.price} ₺'ye satılır. Mal bitince kamyon yükü almaya gider, biraz sonra döner.`);
    R.trucks = [new SupplyTruck({ obj: R.truck, src, stock: 14, cargo: R.truckCargo, hint: h, name: 'Toptancı' })];
    R.stallHint = hint(46.0, 3.9, -6.8, '🧺', 'Senin tezgahların', 'Tahta döşemeli taraf senin alanın. Ürünü tezgâhına diz, müşteri önden alır, parası kasada birikir.');
    R.rivals.activate(instant);
  };
  R.addVeg = (instant) => {
    const van = put(C, M.model('delivery'), 37.5, 0, 9.6, -PI / 2); if (!instant) popIn(van);
    rcol(R, 35.0, 40.0, 8.6, 10.6);
    const vanCargo = [];
    for (const [z, k] of [[9.1, 'paprika'], [10.1, 'eggplant']]) { const cr = put(C, M.makeCrateOf([k, k, k, k]), 40.9, 0, z, PI / 2); if (!instant) popIn(cr); vanCargo.push(cr); }
    rcol(R, 40.5, 41.3, 8.7, 10.5);
    // kamyonet yalnız tezgâhı açık ürünü yükler (R.openStall ekler); ikisi de kapalıyken "önce tezgâhını aç" der (game.js PaidSource)
    // oyuncu hangi kasanın önünde durursa o ürün yüklenir (2026-11-08 kullanıcı: "patlıcan biber arabasına gidince sadece biber veriyor
    // patlıcana yakın durunca patlıcan versin"): biber kasası z 9,1 (alanın kuzey yarısı), patlıcan kasası z 10,1 (güney yarısı)
    const vsrc = new PaidSource({ x: 42.2, z: 9.6, types: VEG.filter((t) => R.types.includes(t)), origin: V(40.9, 1.0, 9.6), instant, pick: (p) => (p.z < 9.6 ? 'biber' : 'patlican') });
    R.sources.push(vsrc); R.vegSrc = vsrc;
    const vh = hint(41.6, 2.3, 9.6, icon('biber') + icon('patlican'), `Sebze kamyoneti · ${ITEMS.biber.cost}-${ITEMS.patlican.cost} ₺`, `Hangi kasanın önünde durursan o yüklenir: biber (${ITEMS.biber.cost} ₺) ya da patlıcan (${ITEMS.patlican.cost} ₺). Yalnız tezgâhını açtığın ürün gelir; tezgâhta ${ITEMS.biber.price}-${ITEMS.patlican.price} ₺'ye satılır.`);
    (R.trucks || (R.trucks = [])).push(new SupplyTruck({ obj: van, src: vsrc, stock: 12, cargo: vanCargo, hint: vh, name: 'Sebze kamyoneti' }));
  };

  R.update = (dt) => {
    const shouting = G.shout.t > 0;
    R.spawnT -= dt * (shouting ? 2.6 : 1) * repMul();
    const n = G.customers.filter((c) => c.region === 'pazar' && !c.leaving).length;
    if (R.spawnT <= 0 && n < 12) { R.spawnT = 3.0; spawnPazar(R); }
    if (R.pile && (R.stallT = (R.stallT || 0) - dt) <= 0) { R.stallT = 1; for (const t of R.types) R.addStall(t, G.time < 3); } // sonradan eklenen ürünün tezgahı
    if (R.pile && (R.tidyT = (R.tidyT || 0) - dt) <= 0) { R.tidyT = 0.5; R.tidy(0.5); }
    if (R.stallHint) { const n = R.row.reduce((a, s) => a + s.count(), 0), cap = R.row.reduce((a, s) => a + s.cap, 0), t = `Senin tezgahların · ${n}/${cap}`; if (R.stallHint._t !== t) { R.stallHint._t = t; R.stallHint.title.textContent = t; } }
    for (const t of R.trucks || []) t.update(dt); // malı biten kamyon yükü almaya gider
    R.rivals.update(dt); // kampanyalar, rakip bağırışları, satın alma padi
  };
  return R;
}

// pazar müşterileri doğudan, köprüden geçen caddeden gelir: kuzey şeritte batıya yürüyüp tezgahları gezer,
// güney şeritten aynı yoldan geri döner
const PAZAR_FAR = 133, PAZAR_END = 25.6; // FAR ormanın içindeki caddede (eskiden 103)
function spawnPazar(R) {
  const z = 4.2 + rand(-0.25, 0.25), zBack = 4.7 + rand(-0.15, 0.15); // kuzey kaldırım: araç yolunun (z 5-8,2) dışında
  const c = new Customer(V(PAZAR_FAR, 0, z), 'pazar', Math.random() < 0.5 ? M.villagerLook() : M.townLook()); // köylü ve kasabalı karışık
  maybeRush(c);
  c.go(V(PAZAR_END, 0, z));
  c.state = 'walk';
  // ne alacağı pazara girerken belli: çoğunlukla tezgahta olan, yoksa toptancıdan alınabilen bir ürün
  const onStall = R.stalls.filter((s) => s.count()).map((s) => s.type);
  const shopT = R.rivals.shops.filter((s) => s.has()).map((s) => s.type); // salçacının kavanozu (rivals.js shops): tepside varken gelenlerin bir kısmı salça ister
  const can = R.types.filter((t) => t === 'domates' || (t === 'salatalik' && G.unlocked.has('k1')) || (t === 'yun' && G.unlocked.has('gm')) || (t === 'kilim' && G.unlocked.has('m2')) || R.sources.some((s) => s.types.includes(t)));
  c.want = shopT.length && Math.random() < 0.18 ? pick(shopT) : onStall.length && Math.random() < 0.6 ? pick(onStall) : pick(can);
  c.need = Math.random() < 0.4 ? 2 : 1; c.got = 0;
  c.setBubble(c.want, c.need);
  const away = () => { // yan koldaki müşteri önce şeridine çıkar: yanındakilerin içinden geçmesin
    const q = c.obj.position, sp = c.state === 'rival' ? c.rvSpot : c.spot, lane = sp?.lane ?? null, ex = sp && R.exitPath ? R.exitPath(sp) : []; // ön sıranın arkasından dolaşarak
    const lx = ex.length ? ex[ex.length - 1].x : lane ?? q.x;
    c.clearBubble(); c.leaving = true; c.path = [...(lane != null ? [V(lane, 0, q.z)] : []), ...ex, V(lx, 0, zBack), V(PAZAR_FAR, 0, zBack)]; c.state = 'walk2';
  };
  // BAĞIR (doShout): caddeden geçen, rakibe yürüyen ya da hiçbir şey almadan dönen müşteri sesi duyup senin tezgahına gelir.
  // Tezgahında bekleyip kızan (spot almış) ve başka yerden alışveriş etmiş olan dönmez; tezgahta yer yoksa kimse dönmez
  c.lure = (sh) => {
    const passing = c.state === 'walk' || (c.state === 'rival' && c.rvState === 'go') || (c.state === 'walk2' && !c.spot && !c.stack.items.length);
    if (c.myStall || !passing) return false;
    const spot = sh.spots.find((s) => !s.c);
    if (!spot) return false;
    if (c.state === 'rival') { if (c.rvSpot) c.rvSpot.c = null; c.rv = null; c.rvSpot = null; }
    spot.c = c; c.spot = spot; c.myStall = sh; c.d1 = true; c.leaving = false;
    if (c.want !== sh.type) { c.want = sh.type; c.need = 1; }
    c.got = 0; c.setBubble(c.want, c.need);
    c.path = R.approach(spot); c.state = 'toStall';
    return true;
  };
  c.think = (dt) => {
    c.obj.position.y = heightAt(c.obj.position.x, c.obj.position.z);
    switch (c.state) {
      case 'walk': {
        c.walk(dt);
        // pazara girerken karar verir: senin tezgahın, bir rakip ya da hiçbiri (ürün, mahalle puanı, kampanya, BAĞIR; rivals.js)
        if (!c.d1 && c.obj.position.x < 52) {
          c.d1 = true;
          const ch = R.rivals.choose(c);
          if (ch === 'me') { const mine = R.stallOf[c.want], spot = mine.spots.find((s) => !s.c); spot.c = c; c.spot = spot; c.myStall = mine; c.path = R.approach(spot); c.state = 'toStall'; break; } // istediği ürünün tezgahına
          c.clearBubble();
          if (ch) { R.rivals.send(c, ch, away); break; }
        }
        if (!c.path.length) { c.clearBubble(); c.leaving = true; c.path = [V(PAZAR_END, 0, zBack), V(PAZAR_FAR, 0, zBack)]; c.state = 'walk2'; }
        break;
      }
      case 'rival':
        R.rivals.think(c, dt);
        break;
      case 'toStall':
        if (c.walk(dt)) { c.state = 'stall'; c.wait = 0; c.t = 0; c.setBubble(c.want, c.need); }
        break;
      case 'stall':
        c.face(c.spot.ry, dt);
        c.wait += dt; c.t += dt;
        c.setPatience(1 - c.wait / (25 * pat(c)));
        if (c.t > 0.4) {
          c.t = 0;
          const obj = c.myStall.takeType(c.want);
          if (obj) { mineFx(c, obj); const pay = Math.round(priceOf(c.want, obj) * mult()); c.stack.push(c.want, obj, 0.3); c.got++; G.stats.sold++; if (c.got === 1) G.stats.customers++; R.pile.add(pay, c.obj.position); floatText(c.obj.position, `+${pay} ₺`, G.boost > 0 ? 'pos x2' : 'pos'); sfx('cash', { at: c.obj.position }); c.setBubble(c.want, c.need - c.got); }
        }
        if (c.got >= c.need || c.wait > 25 * pat(c)) { c.spot.c = null; if (c.got) R.rivals.note(true); away(); c.mood(c.got > 0); } // önce yola çıkar (balonu siler), sonra memnuniyetini gösterir
        break;
      case 'walk2':
        if (c.walk(dt)) c.destroy();
        break;
    }
  };
}

// =====================================================================
// SAHİL BÜFESİ
// =====================================================================
function buildSahil() {
  const R = region('sahil', 'Sahil Büfesi', [-16, 53, 12, 32], [-15.6, 52.6, 11.4, 30.5], 'sand', 3, '#d2a965');
  R.slab.geometry.dispose(); R.slab.geometry = coastSlabGeo(R.rect, (x) => coastZ(x) - 0.2); // denize bakan kenar kıyı çizgisini izler
  const C = R.content;
  strip(C, 18.5, 14, 69, 2.4, 'wood', 2.2); // harita genişletmesi: sahil doğuya 7 uzadı (x 16 ve ötesi +7)
  put(C, M.makeBeachBar(), 33, 0, 18.5);
  rcol(R, 30.4, 35.6, 16.5, 19.7); // barın tamamı tek engel: içinden kimse geçmez, kasadar içeride durur
  for (const [x, z, s] of [[23, 19.5, 1], [42, 18.8, 1.1], [48, 22, 0.95], [8, 20, 1.05], [-4, 18, 1], [-12, 24, 1.1], [0.2, 28.4, 0.9]]) { put(C, M.makePalm(s, rand(0.15, 0.35)), x, 0, z, rand(0, 6)); rcol(R, x - 0.35, x + 0.35, z - 0.35, z + 0.35); }
  put(C, M.makeLifeguard(), 51, 0, 27); rcol(R, 50.2, 51.8, 26.2, 27.8);
  // cankurtaran kuleleri: ilki sahille gelir, diğerleri zamanla açılır; her kuleye bir cankurtaran oturur
  R.towers = [{ x: 51, z: 27 }];
  R.addTower = (x, z, instant) => {
    const t = put(C, M.makeLifeguard(), x, 0, z); if (!instant) popIn(t);
    rcol(R, x - 0.8, x + 0.8, z - 0.8, z + 0.8);
    R.towers.push({ x, z });
  };
  put(C, M.makeSandCastle(), 8.6, 0, 29.8); rcol(R, 7.9, 9.3, 29.1, 30.5); // şezlongun (x 10) alanından uzak: yakınlıkta şezlong sayılmasın
  put(C, M.makeSandCastle(), -5.4, 0, 27.8, 0.6); rcol(R, -6.1, -4.7, 27.1, 28.5); // şemsiyenin gölgesinden uzakta
  const ball = M.sph(0.35, M.mat('#ffffff', { map: texRep('cini', 1, 1) }), 0, 0.35, 0); put(C, ball, 37, 0, 28.5);
  // batı ucundaki şemsiyeli şezlonglar süs değil: sahil açılınca R.addLoungers ile müşterilere açılır
  put(C, M.makeSign('BÜFE →', '#ff6f61', 2.4, 0.75), 12.5, 0, 16.6, 0);

  R.menu = ['misir'];
  R.loungers = [];
  R.gens = {};
  R.addLoungers = (xs, instant) => {
    const cols = ['#ff6f61', '#4fc3e8', '#f9c74f', '#7fd1c7', '#c77dd8', '#ff9f43'];
    for (const x of xs) {
      const cc = cols[R.loungers.length % cols.length];
      const mate = R.loungers.find((l) => Math.abs(l.x + MATE_DX - x) < 0.01), ux = DOUBLE.has(x) ? DOUBLE_UMB : UMB[0];
      const lo = put(C, M.makeLounger(cc), x, 0, 26.5), umb = !SUNNY.has(x);
      const um = umb && !mate ? put(C, M.makeUmbrella(cc), DOUBLE.has(x) ? x - DOUBLE_SIDE : x + ux, 0, 26.5 + (DOUBLE.has(x) ? 0.5 : UMB[1])) : null; // tekli: ayak ucunun yanında, gölgesi 10.00-15.00 arası yatana düşer (daylight.js)
      if (!instant) { popIn(lo); if (um) popIn(um, 0.1); }
      const L = new Lounger(x, 26.5, { instant }); L.umb = umb; L.ux = ux;
      if (mate) { L.mate = mate; mate.mate = L; L.shade = mate; } // yandaki ikizin şemsiyesini paylaşır
      R.loungers.push(L);
    }
  };
  // dondurma makinesi: köydeki ahırdan getirilen süt soldaki masaya bırakılır, sağdaki tepsiye dondurma çıkar
  R.addFreezer = (instant) => {
    const f = put(C, M.makeFreezer(), 37.4, 0, 21.0); if (!instant) popIn(f);
    rcol(R, 35.1, 39.9, 20.4, 21.6);
    R.menu.push('dondurma');
    R.iceMachine = new Converter(C, { inType: 'sut', inCap: 10, ix: 35.85, iz: 22.6, iw: 1.8, id: 1.3, inTray: [35.85, 0.88, 21.0], instant,
      out: { type: 'dondurma', interval: 2.6, max: 8, origin: V(37.4, 1.5, 21), tray: [39.05, 0.88, 21], zx: 39.0, zz: 22.6, zw: 2.4, zd: 1.3 } });
    R.gens.dondurma = R.iceMachine.out;
    hint(35.85, 2.2, 21.0, `${icon('sut')}→${icon('dondurma')}`, 'Dondurma makinesi', 'Çiftlikteki ahırdan sütü getir, soldaki masaya bırak. Makine dondurma yapar, sağdaki tepsiden al.', 3.4); // yalnızca dibine gelince açılır, yan yana etiketler çakışmasın
  };
  // mısır: tarlada koçan büyür; koçan kazanın soldaki masasına bırakılır, haşlanmış mısır sağdaki tepsiye çıkar
  R.activate = (instant) => {
    new Trash(C, -13.4, 17.6, { instant }); // sahilin batı köşesinde: köy kapısından kazana giden yolun dışında
    // kasa büfenin tezgahında: doğu ucunda yazarkasa, para tezgahta birikir; büfeci (kasiyer) yanında durur
    R.pile = new MoneyPile(C, 34.7, 19.25, 1.22, { instant, desk: false, register: [0.75, 0.04, -0.1], body: [33.4, 35.6, 17.3, 19.7], spot: [34.7, 18.15, 0], look: { shirt: '#ffffff', pants: '#3a4a6b', hat: 'cap', hatColor: '#3ec1b5', skin: '#e0b48a' } });
    const pot = put(C, M.makeCornPot(), 30.6, 0, 21.0); if (!instant) popIn(pot);
    rcol(R, 28.6, 32.6, 20.4, 21.6);
    unlockRegion('tarla', instant); // koçan köyün batısındaki tarlalarda büyür
    R.cornPot = new Converter(C, { inType: 'kocan', inCap: 10, ix: 29.3, iz: 22.6, iw: 1.6, id: 1.3, inTray: [29.35, 0.88, 21.0], instant,
      out: { type: 'misir', interval: 4.4, max: 6, origin: V(30.6, 1.3, 21), tray: [31.7, 0.88, 21], zx: 31.5, zz: 22.6, zw: 2.2, zd: 1.3 } }); // kullanıcı 2026-10-28: "aşırı hızlı veriyor" → yarı hızda (2,2 → 4,4 sn), tepside en çok 6
    R.gens.misir = R.cornPot.out;
    hint(29.35, 2.2, 21.0, `${icon('kocan')}→${icon('misir')}`, 'Mısır kazanı', 'Köyün batısındaki tarladan koçan getir, soldaki masaya bırak. Sıcak mısırı sağdaki tepsiden al.', 3.4);
    R.addLoungers([14, 25, 40, 2.5, -2, -9], instant);
    initBeach(instant); // denizde şişme yatak, simit, top; şamandıra ipi, deniz bisikleti; kumda matkot ve çocuk (beach.js)
  };
  R.drowning = null; R.dCool = 25; R.scare = 0;
  R.update = (dt) => {
    updateBeach(dt);
    updateTavla(R, dt);
    R.spawnT -= dt * repMul() * havaBeach(); // yağmurda, karda sahil ayrıca boşalır (hava.js); yağış sürerken hiç gelmez (havaIslak)
    R.dCool -= dt; R.scare -= dt;
    const free = R.loungers.filter((l) => !l.c);
    // biri boğulup kurtarılamadıysa plaj bir süre çekingen: yeni müşteri gelmez
    if (R.spawnT <= 0 && free.length && R.scare <= 0 && !havaIslak()) { R.spawnT = 3.6 / ((0.9 + 0.35 * day.heat) * (G.season ? G.season.beach : 1)); const L = pick(free), x0 = spawnSahil(R, L); if (L.mate && !L.mate.c && Math.random() < 0.8) spawnSahil(R, L.mate, x0); } // öğlen sıcağında ve yazın plaj kalabalık (mevsim.js)
  };
  return R;
}

// ---------- denizde yüzme, boğulma, kurtarma ----------
// kıyı girintili (nature.js): suya giriş ve derinlik her x'te kıyı çizgisine göre
const shoreZ = (x) => coastZ(x) - 1.0, seaZ = (x) => coastZ(x) - 0.3;
// denizden çıkış: kıyı noktası yürüme alanının dışında (findRoute orada düz çizgi verir, müşteri büfenin içinden geçiyordu); kumsala giren bir ara nokta yolu bulmayı açar
const onSand = (x) => V(x, 0, Math.min(30, shoreZ(x)));
// suda gövde suyun içinde ve dalgayla iner kalkar; karada zemin hizasında
function swimY(c, dt, k = 1) {
  const p = c.obj.position;
  const y = p.z > seaZ(p.x) ? -0.72 + Math.sin(G.time * 3 + c.obj.id) * 0.06 * k : 0;
  p.y += (y - p.y) * Math.min(1, dt * 6);
}
function goSwim(R, c, x0, zOut) {
  const sx = THREE.MathUtils.clamp(c.obj.position.x + rand(-3, 3), -12, 49), sz = coastZ(sx) + rand(1.8, 4.8);
  c.path = [V(c.obj.position.x, 0, shoreZ(c.obj.position.x)), V(sx, 0, sz)];
  c.state = 'toSwim'; c.swim = { x0, zOut, t: rand(14, 24), cx: sx };
  enableSwim(c); // suda yatıp kulaç atar
}
function startDrown(R, c) {
  R.drowning = c; c.state = 'drown'; c.timer = 22; c.rescuer = null; c.splashT = 0;
  c.setBubbleText('🆘 İmdat!', 'angry');
  sfx('bong', { at: c.obj.position });
  if (!(G.staff && G.staff.lifeguard && G.staff.lifeguard.length) && !R.toldLife) {
    R.toldLife = true;
    toast('🆘 Biri boğuluyor! Kıyıda hizasına koş, ya da cankurtaran al');
  }
  // kurtarıcı (oyuncu ya da cankurtaran) yanına ulaştı: artık kıyıya çekiliyor
  c.rescued = () => { c.state = 'towed'; c.setBubbleText('😮‍💨 Kurtarıldım!', 'happy'); };
  // kıyıya çıktı: teşekkür eder, bahşiş bırakır
  c.landed = () => {
    R.drowning = null; R.dCool = rand(28, 45);
    const tip = Math.round(30 * mult());
    R.pile.add(tip, c.obj.position);
    floatText(c.obj.position, `Hayatımı kurtardın! +${tip} ₺`, 'pos');
    confetti(c.obj.position, 24);
    c.mood(true);
    c.path = [onSand(c.obj.position.x), V(c.obj.position.x, 0, c.swim.zOut), ...viaBridge(c.obj.position.x, c.swim.x0, c.swim.zOut), V(c.swim.x0, 0, c.swim.zOut)];
    c.leaving = true; c.state = 'leave';
  };
}
// sahil müşterisinin denizdeki halleri; true dönerse bu karede durum işlendi
function seaThink(R, c, dt) {
  const p = c.obj.position;
  switch (c.state) {
    case 'toSwim':
      if (c.walk(dt)) c.state = 'swim';
      swimY(c, dt);
      return true;
    case 'swim':
      c.swim.t -= dt;
      if (havaKac(dt) || havaPlaj(dt)) c.swim.t = 0; // yağışta denizden çıkar (oyuncaktaki de bırakır: beach.js seaPlay)
      swimY(c, dt);
      if (seaPlay(c, dt)) return true; // yatakta, simitte ya da top oynarken (beach.js): dolaşmaz, boğulmaz
      swimAround(c, dt); // yerinde durmaz, çevresinde kulaç atarak dolaşır (sea.js)
      if (!R.drowning && R.dCool <= 0 && !havaIslak() && Math.random() < dt * 0.05) { startDrown(R, c); return true; }
      if (c.swim.t <= 0) { c.path = [V(p.x, 0, shoreZ(p.x)), onSand(p.x), V(p.x, 0, c.swim.zOut), ...viaBridge(p.x, c.swim.x0, c.swim.zOut), V(c.swim.x0, 0, c.swim.zOut)]; c.leaving = true; c.state = 'leave'; }
      return true;
    case 'drown': {
      c.timer -= dt;
      p.y = -0.85 + Math.abs(Math.sin(G.time * 7)) * 0.35; // çırpınır
      c.obj.rotation.y += dt * 2;
      c.splashT -= dt;
      if (c.splashT <= 0) { c.splashT = 0.5; ring(V(p.x, 0.05, p.z), '#ffffff', 1.3); }
      if (Math.floor(c.timer) !== c.shown) { c.shown = Math.floor(c.timer); c.setBubbleText(`🆘 İmdat! ${Math.max(0, c.shown)}`, 'angry'); }
      // oyuncu kıyıda, hizasında: kurtarır (cankurtaran zaten yoldaysa ona bırakır)
      const pp = G.player.position;
      if (!c.rescuer && pp.z > shoreZ(pp.x) - 2 && Math.abs(pp.x - p.x) < 3.2) { c.rescuer = 'player'; c.rescued(); c.path = [V(p.x, 0, shoreZ(p.x))]; return true; }
      if (c.timer <= 0 && !c.rescuer) {
        // kurtarılamadı: kendi kendine güçlükle kıyıya döner, plaj bir süre çekingen olur
        R.drowning = null; R.dCool = rand(30, 45); R.scare = 25;
        floatText(p, 'Kimse kurtarmadı… plaj korktu', 'neg');
        c.mood(false);
        c.speed *= 0.5;
        c.path = [V(p.x, 0, shoreZ(p.x)), onSand(p.x), V(p.x, 0, c.swim.zOut), ...viaBridge(p.x, c.swim.x0, c.swim.zOut), V(c.swim.x0, 0, c.swim.zOut)];
        c.leaving = true; c.state = 'leave';
      }
      return true;
    }
    case 'towed':
      // oyuncu kurtardıysa kendi kıyıya yüzer; cankurtaran kurtardıysa o çeker (upgrades.js)
      if (!c.rescuer) { c.rescuer = 'player'; c.path = [V(p.x, 0, shoreZ(p.x))]; } // cankurtaran çekerken işten çıkarıldı: sonsuza dek suda kalmasın
      if (c.rescuer === 'player' && c.walk(dt)) c.landed();
      swimY(c, dt, 0.5);
      return true;
    case 'leave':
      if (p.z > shoreZ(p.x) - 0.5 || p.y < -0.05) swimY(c, dt);
      return false;
  }
  return false;
}

// sahil müşterileri tahta yürüyüş yolunun harita dışındaki uçlarından gelir, çoğu yakın uçtan
const SAHIL_FAR = [-105, 162]; // iki ucu da ormanın içinde (eskiden -65 ve 132)
// Doğudan gelen ve doğuya giden müşteri dereyi (x 57-63) pazar caddesinin köprüsünden geçer: z 14'teki iskele köprü 2026-11-06'da kalkınca
// müşteriler suyun üstünden yürüyordu (2026-11-10 denetimi). Köprünün iki ucu açık, kenarları korkuluklu: uçlarından girilir
const CREEK_W = 51.6, CREEK_E = 68.6, CREEK_Z = 8.7; // dere x 57,5-64,5; iki yanında 4-5 m çimen kıyı: dönüşler yürünen zeminde (2026-11-10 ölçümü)
const viaBridge = (fromX, toX, z) => ((fromX > 62) === (toX > 62) ? [] : fromX > toX
  ? [V(CREEK_E, 0, z), V(CREEK_E, 0, CREEK_Z), V(CREEK_W, 0, CREEK_Z), V(CREEK_W, 0, z)]
  : [V(CREEK_W, 0, z), V(CREEK_W, 0, CREEK_Z), V(CREEK_E, 0, CREEK_Z), V(CREEK_E, 0, z)]);
function spawnSahil(R, L, from) {
  const near = L.x < 30 ? 0 : 1;
  // mera açıkken iskelenin batı ucu meranın içinden geçer (baraka, çit): müşteriler doğudan gelir. from: ikili şezlongda eşiyle aynı uçtan gelir
  const x0 = from ?? (G.regions.mera && G.regions.mera.unlocked ? SAHIL_FAR[1] : SAHIL_FAR[Math.random() < 0.75 ? near : 1 - near]);
  const zIn = 13.6 + rand(-0.2, 0.2), zOut = 14.4 + rand(-0.2, 0.2);
  const c = new Customer(V(x0, 0, zIn), 'sahil', M.touristLook()); // tatilci: açık renk, güneş şapkası, gözlük
  L.c = c;
  c.go(...viaBridge(x0, L.x, zIn), V(L.x, 0, zIn), V(L.x, 0, 24.6));
  c.state = 'toL';
  c.seat = V(L.x, 0.45, L.z);
  c.order = R.menu.includes('dondurma') && Math.random() < 0.6 * day.heat ? 'dondurma' : pick(R.menu); // siparişi şezlonga yürürken baloncukta görünür; sıcakta dondurma
  // bazıları yalnızca denize girmeye gelir: biraz güneşlenir, sonra yüzer
  c.swimmer = Math.random() < 0.35;
  if (c.swimmer) c.setBubbleText('🏊'); else c.setBubble(c.order, 1);
  const getUp = () => {
    c.lying = false;
    c.obj.rotation.set(0, PI, 0);
    c.obj.position.set(L.x, 0, 24.6);
    L.c = null;
    c.path = [V(L.x, 0, zOut), ...viaBridge(L.x, x0, zOut), V(x0, 0, zOut)];
    c.leaving = true;
    c.state = 'leave';
  };
  c.served = () => {
    const price = ITEMS[c.order].price;
    // öğlen sıcağında şemsiyenin gölgesinde yatan müşteri sıcaklık oranında fazla bahşiş bırakır (en çok iki katı)
    const SH = L.shade || L, cool = L.umb && day.heat > 0.3 && shaded(SH.x, SH.z, SH.x + SH.ux, SH.z + UMB[1]);
    const tip = Math.round(price * 0.6 * Math.max(0, c.timer) / 30 * (cool ? 1 + day.heat : 1));
    if (cool) G.stats.shade = (G.stats.shade || 0) + 1; // günlük görev ve başarım sayacı (gorev.js, menu.js)
    const m = mult();
    G.stats.customers++; G.stats.sold++;
    G.regions.sahil.pile.add((price + tip) * m, c.seat);
    floatText(c.seat, tip > 0 ? `+${price * m} ₺  ${cool ? '☂️ ' : ''}bahşiş +${tip * m}` : `+${price * m} ₺`, m > 1 ? 'pos x2' : 'pos');
    sfx('cash', { at: c.seat });
    c.state = 'enjoy'; c.t = 0;
    c.mood(true);
  };
  c.think = (dt) => {
    if (c.leaving && c.obj.position.z < 23.5) M.setSwimwear(c.obj, false); // kumsaldan çıkarken yeniden giyinir
    if (seaThink(R, c, dt)) return;
    switch (c.state) {
      case 'toL':
        if (c.walk(dt)) {
          c.lying = true; c.state = 'lie'; c.t = 0;
          c.obj.position.set(L.x, 0.5, L.z + 0.85);
          c.obj.rotation.set(-1.25, 0, 0);
          M.setSwimwear(c.obj, true); // güneşlenirken üstünü çıkarır, mayoyla uzanır (denize de mayoyla girer)
        }
        break;
      case 'lie':
        c.t += dt;
        if (c.swimmer) { if (c.t > 3) { c.clearBubble(); getUp(); if (!havaIslak()) { c.leaving = false; goSwim(R, c, x0, zOut); } } break; } // yağışta denize girmez
        if (c.t > 0.6) { if (havaIslak()) { getUp(); break; } c.timer = 30; c.state = 'order'; c.setBubble(c.order, 1); } // yağış başladıysa uzanmaz, gider
        break;
      case 'order':
        c.timer -= dt;
        c.setPatience(c.timer / 30);
        if (c.timer <= 0) { c.mood(false); getUp(); }
        else if (havaKac(dt) || havaPlaj(dt)) { c.clearBubble(); getUp(); } // yağışta siparişini beklemeden kalkar, kızmaz
        break;
      case 'enjoy':
        c.t += dt;
        // keyfini yapan müşterinin yarısı kalkıp denize girer
        if (c.t > 4 || havaKac(dt) || havaPlaj(dt)) { getUp(); if (Math.random() < 0.5 && !havaIslak()) { c.leaving = false; goSwim(R, c, x0, zOut); } }
        break;
      case 'leave':
        if (c.walk(dt)) c.destroy();
        break;
    }
  };
  return x0;
}

// =====================================================================
// KÖY TARLALARI: köyün batısında mısır tarlası; sahil açılınca açılır
// =====================================================================
function buildTarla() {
  const R = region('tarla', 'Köy Tarlaları', [-35, -23, -4, 8.6], [-34.6, -15.4, -3.6, 8.2], 'grass', 4, '#9b6a3e');
  const C = R.content;
  // kuzey kenarında çit, köşede korkuluk, saman ve eşeklerin suluğu. Batı çiti kaldırıldı: at ahırının çitiyle (riders.js x -35,75) yan yana
  // ikinci bir çitti (2026-11-01 kullanıcı: "gereksiz duvar çitleri kaldıralım")
  put(C, M.makeFence(11.0, 'x'), -28.7, 0, -3.3); rcol(R, -34.6, -23.2, -3.6, -3.0);
  // kuzey çiti üçüncü sütunu da kapsar (genişletme yatakları tarlanın içinde, expand-west.js xtarla); kuyu iki sütunun arasında kalır
  put(C, M.makeFence(5.0, 'x'), -20.6, 0, -3.3); rcol(R, -23.1, -18.1, -3.6, -3.0);
  // tarım kuşağı (dukkan/tarla düzeni 2026-10-28): doğu sütunu mısır, batı sütunu buğday (fırının değirmeni ve hanın ambarı için);
  // korkuluk iki sütunun arasında, saman balyası ve traktör güney kenarında, kuyu kuzeydoğu köşesinde
  put(C, M.makeScarecrow(), -29.0, 0, 2.6, 0.4); rcol(R, -29.2, -28.8, 2.4, 2.8);
  put(C, M.makeHay(), -32.6, 0, 7.6, 0.3); rcol(R, -33.3, -31.9, 6.9, 8.3);
  const trough = put(C, M.rbox(1.4, 0.4, 0.6, 0.08, M.mat('#8b5a2b')), -32.6, 0.2, -1.7);
  M.rbox(1.2, 0.05, 0.42, 0.02, M.mat('#7fc4e8', { rough: 0.2 }), 0, 0.21, 0, trough);
  rcol(R, -33.4, -31.8, -2.1, -1.3);
  put(C, M.makeSign('KÖY TARLALARI', '#6aa84f', 3.0, 0.7), -28.7, 0, -2.7, 0);
  put(C, M.model('tractor'), -26.0, 0, 7.6, PI / 2); rcol(R, -27.6, -24.4, 6.9, 8.3);
  put(C, M.makeWell(), -24.0, 0, -2.3); rcol(R, -24.9, -23.1, -3.2, -1.4);
  R.fields = []; // mısır (upgrades.js srcFor 'kocan')
  R.wheat = []; // buğday (srcFor 'bugday'): fırın açılınca bir, han ambarı açılınca bir tarla
  R.activate = (instant) => {
    for (const z of [0.4, 4.9]) {
      R.fields.push(new PlantBed(C, -26.4, z, 'kocan', 4.5, { instant })); // toprak yatağı PlantBed kendisi koyar
      M.fieldMarks(C, -26.4, z, 'kocan');
    }
    hint(-26.4, 2.3, 2.6, icon('kocan'), 'Mısır tarlası', 'Koçanları topla, sahildeki büfenin mısır kazanına götür. Taşıyıcı alırsan eşeğiyle o taşır.', 4.5);
  };
  // buğday tarlası (k: 0 fırın, 1 han ambarı): batı sütununda; bölge kapalıysa açılır (tarla binaların avlusunda değil)
  R.addWheat = (k, instant) => {
    if (R.wheat[k]) return R.wheat[k];
    if (!R.unlocked) unlockRegion('tarla', instant);
    const z = [0.4, 4.9][k];
    R.wheat[k] = new PlantBed(C, -31.6, z, 'bugday', 4, { instant });
    M.fieldMarks(C, -31.6, z, 'bugday');
    if (k === 0) hint(-31.6, 2.3, 0.4, icon('bugday'), 'Buğday tarlası', 'Buğdayı topla: fırının değirmeninde un, hanın ambarında yem olur. Taşıyıcı da götürür.', 4.5);
    return R.wheat[k];
  };
  return R;
}

// =====================================================================
// KOYUN MERASI: sahilin batısında çitli otlak. Koyunlar kilitliyken de otlar;
// açılınca kırkım barakası yün verir, yün pazarda satılır
// =====================================================================
const flock = [];
const MERA_AREA = [-43.4, -24.6, 14.4, 27.4];
// koyunlar barakaların, makinelerin ve önlerindeki tepsilerin içine girmez
const MERA_KEEP = [[-31.2, -24, 13, 20.4], [-43.2, -37.8, 13, 20.4], [-42.6, -34.4, 23.2, 28.4]];
function grazeSpot() {
  for (;;) {
    const x = rand(MERA_AREA[0], MERA_AREA[1]), z = rand(MERA_AREA[2], MERA_AREA[3]);
    if (!MERA_KEEP.some((b) => x > b[0] && x < b[1] && z > b[2] && z < b[3])) return V(x, 0, z);
  }
}
function buildMera() {
  const R = region('mera', 'Koyun Merası', [-45, -23, 12.5, 28.5], [-44.6, -15.6, 12.9, 28.1], 'grass', 4, '#7d9a4a');
  const C = R.content;
  // çit ve koyunlar kilitliyken de görünür: kapı doğuda, sahile açılır (z 14-19)
  const out = new THREE.Group();
  G.scene.add(out);
  // kuzey çitinde kapı (x -31..-28): köy yolu kaldırımına, oradan dokuma atölyesine çıkılır
  put(out, M.makeFence(7, 'x'), -41.5, 0, 12.8); rcol(R, -45, -38, 12.65, 12.95);
  put(out, M.makeFence(12, 'x'), -29, 0, 12.8); rcol(R, -35, -23, 12.65, 12.95);
  put(out, M.makeFence(22, 'x'), -34, 0, 28.2); rcol(R, -45, -23, 28.05, 28.35);
  // batı çiti kapalı: dokuma atölyesi bu duvara sırtını verir
  put(out, M.makeFence(15.4, 'z'), -44.7, 0, 20.5); rcol(R, -44.85, -44.55, 12.8, 28.2);
  put(out, M.makeFence(9.2, 'z'), -23.3, 0, 23.6); rcol(R, -23.45, -23.15, 19, 28.2);
  // 2026-11-06 kullanıcı: "koyun merası açılmadan önce çitleri açık duruyor kapat koyunlar kaçar yoksa": kilitliyken iki kapı yeri de çitli
  // ve çit engel olur (oyuncu çimende her yere yürür, nature.js openGround); açılınca kapı çitleri kalkar, engeli R.colliders devralır
  const gate = new THREE.Group();
  out.add(gate);
  put(gate, M.makeFence(3, 'x'), -36.5, 0, 12.8);
  put(gate, M.makeFence(6.2, 'z'), -23.3, 0, 15.9);
  const shut = [[-45, -23, 12.65, 12.95], [-45, -23, 28.05, 28.35], [-44.85, -44.55, 12.8, 28.2], [-23.45, -23.15, 12.8, 28.2]];
  G.colliders.push(...shut);
  for (let i = 0; i < 7; i++) {
    const s = M.makeSheep(i === 3 ? '#e9e2d6' : '#fbf6ec');
    const p = grazeSpot();
    put(out, s, p.x, 0, p.z, rand(0, 6));
    flock.push({ obj: s, to: null, t: rand(0, 5), ph: rand(0, 6) });
  }
  put(C, M.makeSign('KOYUN MERASI', '#7d9a4a', 3, 0.75), -25.2, 0, 13.4, 0);

  R.activate = (instant) => {
    out.remove(gate);
    for (const c of shut) { const i = G.colliders.indexOf(c); if (i >= 0) G.colliders.splice(i, 1); }
    const shed = put(C, M.makeShearShed(), -28, 0, 15.2); if (!instant) popIn(shed);
    rcol(R, -30.1, -25.9, 13.8, 16.6); rcol(R, -28.9, -27.1, 16.9, 17.9);
    put(C, M.rbox(1.9, 0.03, 1.1, 0.01, M.mat('#d9c7a0', { rough: 1 })), -28, 0.015, 17.4); // kırkılan yün yerde muşamba üstünde birikir (havada değil)
    R.gen = new Generator(C, { type: 'yun', interval: 3.4, max: 8, origin: V(-28, 1.0, 15.8), tray: [-28, 0.05, 17.4], zx: -28, zz: 18.7, zw: 2.6, zd: 1.3, instant });
    R.gens = { ...(R.gens || {}), yun: R.gen }; // makine yükseltmesi (upgrades.js MACHINES)
    hint(-28, 2.7, 17.4, icon('yun'), `Kırkım barakası · Yün ${ITEMS.yun.price} ₺`, 'Tepsinin önünde dur, yün yumakları sırtına yığılır. Pazardaki tezgahında sat ya da dokuma tezgahında kilime çevir.');
    sellAt('pazar', 'yun');
  };
  const machine = (...a) => machineAt(R, C, ...a);
  // sağım yeri: kuzeybatıda, kırkım barakasının eşi; koyun sütü verir
  R.addMilking = (instant) => {
    const shed = put(C, M.makeShearShed(), -40.5, 0, 15.2); if (!instant) popIn(shed);
    for (const dx of [-1.2, 0, 1.1]) M.cyl(0.22, 0.18, 0.4, 12, M.mat('#c9d1d8', { rough: 0.35 }), -40.5 + dx, 0.2, 16.1, C); // süt güğümleri
    rcol(R, -42.6, -38.4, 13.8, 16.6); rcol(R, -41.4, -39.6, 16.9, 17.9);
    put(C, M.rbox(1.9, 0.03, 1.1, 0.01, M.mat('#e8c56a', { rough: 1 })), -40.5, 0.015, 17.4); // sağılan süt şişeleri güğümlerin önünde, yerde saman üstünde
    R.milk = new Generator(C, { type: 'ksut', interval: 3.6, max: 8, origin: V(-40.5, 1.0, 15.8), tray: [-40.5, 0.05, 17.4], zx: -40.5, zz: 18.7, zw: 2.6, zd: 1.3, instant });
    R.gens = { ...(R.gens || {}), ksut: R.milk };
    hint(-40.5, 2.7, 17.4, icon('ksut'), `Sağım yeri · Koyun sütü ${ITEMS.ksut.price} ₺`, 'Tepsinin önünde dur, şişeler sırtına yığılır. Köydeki süt dolabına diz ya da yoğurt küpüne götür.');
    sellAt('koy', 'ksut');
  };
  // yoğurt küpü: koyun sütü → yoğurt
  R.addYogurt = (instant) => {
    R.yogurt = machine(M.makeYogurtJar(), -38.5, 24.2, 'ksut', 'yogurt', 4.5, instant);
    R.gens = { ...(R.gens || {}), yogurt: R.yogurt.out };
    hint(-38.5, 2.6, 25.4, `${icon('ksut')}→${icon('yogurt')}`, `Yoğurt küpü · Yoğurt ${ITEMS.yogurt.price} ₺`, 'Koyun sütünü soldaki masaya bırak, küp mayalar, sağdaki masadan yoğurdu al. Köydeki süt dolabında sat.', 3.6);
    sellAt('koy', 'yogurt');
  };
  R.update = () => {};
  return R;
}
// ürünün satılacağı yer: yün ve kilim pazar tezgahında, koyun sütü ve yoğurt köydeki süt dolabında
function sellAt(where, type) {
  const list = where === 'pazar' ? G.regions.pazar.types : G.regions.koy.dolapTypes;
  if (!list.includes(type)) list.push(type);
}
// makine: ortada model, solda girdi masası, sağda çıktı masası; oyuncu masaların önünde (güneyinde) durur
function machineAt(R, C, mdl, x, z, inType, outType, interval, instant) {
  const m = put(C, mdl, x, 0, z); if (!instant) popIn(m);
  const wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
  for (const dx of [-2, 2]) { const t = put(C, workTable(1.2, 0.8, 0.8, wood), x + dx, 0.4, z + 1.2); if (!instant) popIn(t); }
  rcol(R, x - 2.7, x + 2.7, z - 0.9, z + 1.7);
  return new Converter(C, { inType, inCap: 6, ix: x - 2, iz: z + 2.4, iw: 2.2, id: 1.3, inTray: [x - 2, 0.86, z + 1.2], instant,
    out: { type: outType, interval, max: 6, origin: V(x, 1.4, z + 0.3), tray: [x + 2, 0.86, z + 1.2], zx: x + 2, zz: z + 2.4, zw: 2.2, zd: 1.3 } });
}

// =====================================================================
// DOKUMA ATÖLYESİ: meranın batı kapısının dışında; yün buraya getirilir, kilim dokunur
// =====================================================================
function buildAtolye() {
  const R = region('atolye', 'Dokuma Atölyesi', [-56, -45, 12.6, 25.6], [-55.6, -45.2, 12.4, 25.2], 'cobble', 2.4, '#7d776b');
  const C = R.content;
  // açık salon (salon.js, 2026-11-04): eskiden doğu kenarda küçük bir ev, tezgâh ve sedir çitli avludaydı. Şimdi avlunun yerinde dokuma
  // salonu: arka duvar kuzeyde, köy yoluna açılan kapıyla (x −52..−49, tabela kapının üstünde kemer gibi); önü açık (2026-11-05 kullanıcı:
  // "kilim dokuma tezgahlarının olduğu kısımların önüne duvar yapmışsın onları kaldır"; alçak ön duvar kalktı, köşelerde saksı).
  // 2026-11-09 kullanıcı: "Halı dokuma yün tezgahlarının duvarlarını kaldıracaktın": iki salonun arka ve yan duvarları da kalktı (walls: false),
  // ahşap döşeme, tabela ve köşelerdeki saksılar kaldı; duvara asılı kilimler ve yün rafları da gitti (detay.js)
  const hall = makeHall({ x0: -55.8, x1: -45.4, zb: 12.8, zf: 25.4, walls: false, band: '#c8463a', floor: ['wood', '#e2bf8f', 2.4] });
  C.add(hall.g); for (const c of hall.cols) rcol(R, ...c);
  put(C, M.makeSign('DOKUMA ATÖLYESİ', '#c8463a', 3.0, 0.7), -50.5, 0, 12.9, 0);
  // patikanın batısındaki genişleme arsaları (expand-west.js xatolye: iki dokuma, bir halı tezgahı, çıkrık) ikinci bir salonda: doğusu
  // patikaya, önü güneye açık
  const west = makeHall({ x0: -74.6, x1: -59.6, zb: 13.0, zf: 26.6, walls: false, band: '#c8463a', floor: ['wood', '#e2bf8f', 2.4] });
  C.add(west.g); for (const c of west.cols) rcol(R, ...c);
  // eski evin yerinde: yün çuvalları ve yün yumakları sepeti (süs)
  const sedir = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
  put(C, M.rbox(1.0, 0.4, 2.4, 0.05, sedir), -46.3, 0.2, 18.4); rcol(R, -46.85, -45.6, 17.15, 19.65);
  for (let i = 0; i < 5; i++) { const y = makeItem('yun'); y.position.set(-46.3 + (i % 2 ? 0.2 : -0.2), 0.42 + Math.floor(i / 3) * 0.3, 17.6 + (i % 3) * 0.75); C.add(y); }
  for (const x of [-51.85, -49.15]) rcol(R, x - 0.12, x + 0.12, 12.78, 13.02); // tabela direkleri
  // satışa hazır kilimler: kapının içinde alçak bir sedirin üstünde
  const wood = M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
  put(C, M.rbox(1.6, 0.4, 0.8, 0.05, wood), -54.0, 0.2, 14.6); rcol(R, -54.8, -53.2, 14.2, 15.0);
  for (let i = 0; i < 3; i++) { const k = M.makeKilim(); k.position.set(-54.0, 0.4 + i * 0.22, 14.6 + (i % 2 ? 0.1 : -0.1)); k.rotation.y = 0.1 * i; C.add(k); }
  R.activate = (instant) => {
    R.loom = machineAt(R, C, M.makeLoom(), -52.6, 21.2, 'yun', 'kilim', 6.0, instant);
    R.gens = { ...(R.gens || {}), kilim: R.loom.out };
    hint(-52.6, 2.6, 22.4, `${icon('yun')}→${icon('kilim')}`, `Dokuma tezgahı · Kilim ${ITEMS.kilim.price} ₺`, 'Meranın kuzey kapısından çık, yoldan atölyeye gel. Yünü soldaki masaya bırak, kilimi sağdaki masadan al. Kilimi pazarda sat.', 3.6);
    sellAt('pazar', 'kilim');
  };
  return R;
}
// FIRIN: köyün kuzeyinde, han yolunun kenarındaki arsa; köylüler ana yoldan gelip vitrinden alır (carsi.js)
function buildFirin() {
  const R = region('firin', 'Köy Fırını', [-23, 11, -27.8, -20.6], [-22.6, 10.6, -27.6, -20.3], 'cobble', 2.4, '#9b7a5a'); // batıda koridora uzanan avlu (buğday tarlası 2026-10-28'den beri Köy Tarlaları'nda: buildTarla addWheat)
  return bakeryRegion(R, { rcol: (...a) => rcol(R, ...a), hint, icon });
}
// ŞEHİR MARKETİ: köyün çok uzağında (x ≈ 430) ikinci dünya; köydeki otobüs durağından gidilir (city.js)
function buildSehir() {
  const R = region('sehir', 'Şehir Marketi', CITY.rect, CITY.walk, 'cobble', 2.4, '#8a8478');
  return cityRegion(R, { rcol: (...a) => rcol(R, ...a), hint, icon });
}
// BEMIS ENERJİ PARKI: köy yolunun kuzeyinde, benzinliğin karşısında; güneş panelleri ve rüzgâr türbinleri (energy.js)
function buildEnerji() {
  const R = region('enerji', 'Bemis Enerji Parkı', [-84, -63.6, -66.4, -59.8], [-83.7, -63.9, -66.1, -59.4], 'grass', 4, '#6d8a4a'); // kuzeybatı köşesi, servis yolunun ucunda
  return energyRegion(R, { rcol: (...a) => rcol(R, ...a), hint, icon });
}
// AT AHIRI: köy yolunun güneyinde, tarlaların batısında; içerisi riders.js'te
function buildAhir() {
  const R = region('atlar', 'At Ahırı', [-59.4, -35.6, -3.6, 8.4], [-59.1, -35.9, -3.3, 8.6], 'path', 3, '#9b6a3e');
  return stableRegion(R, { rcol: (...a) => rcol(R, ...a), hint, icon });
}
// köy yolu kaldırımı: dokuma atölyesiyle birlikte açılır; köyden ve meranın kuzey kapısından atölyeye yürünür
function buildYol() {
  const R = region('yol', 'Köy Yolu', [-56, -23, 11.2, 12.5], [-55.6, -15.0, 11.0, 13.0], 'cobble', 2.4, '#8a8478');
  R.slab.visible = false; // kilitliyken görünmez, gri şerit olmasın
  G.labels.remove(R.lockLabel);
  R.activate = () => { R.slab.visible = true; };
  return R;
}
// koyunlar: yavaşça yeni bir otlama yerine yürür, varınca başını eğip birkaç saniye otlar
function updateFlock(dt) {
  for (const s of flock) {
    const u = s.obj.userData, p = s.obj.position;
    s.t -= dt;
    if (s.to) {
      const dx = s.to.x - p.x, dz = s.to.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { s.to = null; s.t = rand(3, 9); continue; }
      p.x += (dx / d) * 0.55 * dt; p.z += (dz / d) * 0.55 * dt;
      let da = Math.atan2(dx, dz) - s.obj.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      s.obj.rotation.y += da * Math.min(1, dt * 3);
      const w = Math.sin(G.time * 7 + s.ph);
      u.legs[0].rotation.x = u.legs[3].rotation.x = w * 0.35;
      u.legs[1].rotation.x = u.legs[2].rotation.x = -w * 0.35;
      u.body.position.y = 0.62 + Math.abs(w) * 0.03;
      u.head.rotation.x += (0.05 - u.head.rotation.x) * Math.min(1, dt * 5);
    } else {
      // otlarken baş aşağıda, arada çiğner
      u.head.rotation.x += (0.85 + Math.sin(G.time * 5 + s.ph) * 0.07 - u.head.rotation.x) * Math.min(1, dt * 3);
      for (const l of u.legs) l.rotation.x *= 0.85;
      if (s.t <= 0) s.to = grazeSpot();
    }
  }
}

// =====================================================================
// KÖY MEYDANI: ana yoldan arabaların girdiği meydan; paket servis cebi ve otopark (paket servisle açılır)
// =====================================================================
// =====================================================================
// ÇİFTLİK (pazarın kuzeyi): kümes açılınca gelir. Ortada çiftlik yolu; yolun kuzeyinde kümes, mandıra ve ahır
// yola bakar (tepsileri yoldan alınır), güneyinde girişin iki yanı: batıda traktörlü çayır, doğuda çitli inek otlağı
// =====================================================================
function buildCiftlik() {
  const R = region('ciftlik', 'Çiftlik', [23, 53, -40, -14], [23.8, 52.6, -39.6, -13.4], 'grass', 4, '#9b6a3e');
  const C = R.content;
  strip(C, 33.3, -22.0, 38.2, 3.0, 'path', 3); // köy-han yolundan (x 14) koridoru geçip çiftliğin içine
  strip(C, 37.7, -17.2, 4.2, 7.0, 'path', 3, 0.011);
  put(C, M.makeSign('ÇİFTLİK', '#5fae4f', 2.6, 0.8), 33.8, 0, -14.6, 0); // doğu direği patikanın kenarına biniyordu
  const fenceBox = (r, R2) => {
    const [x0, x1, z0, z1] = r, w = x1 - x0, d = z1 - z0;
    for (const z of [z0, z1]) { put(C, M.makeFence(w, 'x'), (x0 + x1) / 2, 0, z); rcol(R2, x0, x1, z - 0.15, z + 0.15); }
    for (const x of [x0, x1]) { put(C, M.makeFence(d, 'z'), x, 0, (z0 + z1) / 2); rcol(R2, x - 0.15, x + 0.15, z0, z1); }
  };
  // tavuk avlusu kümesin batısında; inek otlağı ahırın karşısında, yolun güneyinde
  fenceBox(CHICK_YARD, R);
  fenceBox(COW_FIELD, R);
  const wood = M.mat('#ffffff', { map: texRep('wood', 1, 0.5) });
  const trough = new THREE.Group();
  M.rbox(0.7, 0.42, 2.0, 0.06, wood, 0, 0.21, 0, trough);
  M.rbox(0.5, 0.04, 1.8, 0.02, M.mat('#5fb6e0', { rough: 0.2 }), 0, 0.41, 0, trough);
  put(C, trough, 51.4, 0, -17.6);
  for (const [x, z, r] of [[41.7, -15.7, 0.4], [41.7, -19.4, 1.2]]) put(C, M.makeHay(), x, 0, z, r);
  for (const [x, z] of [[25.2, -26.2], [28.8, -36.2]]) put(C, M.makeHay(), x, 0, z, 0.6);
  // batı çayırı: traktör ve saman balyaları, kenarlarda ağaçlar
  put(C, M.model('tractor'), 27.6, 0, -17.2, 0.5); rcol(R, 26.3, 28.9, -18.6, -15.8);
  put(C, M.makeHay(), 31.6, 0, -16.0, 0.3); put(C, M.makeHay(), 32.4, 0, -17.4, 1.3); rcol(R, 30.9, 33.1, -18.0, -15.4);
  // kuzey: yel değirmeni, kuyu ve ağaçlar (binaların arkası yürünebilir kalır)
  const wm = put(C, M.makeWindmill(), 38.0, 0, -35.6, 0.3); wm.scale.setScalar(0.8); rcol(R, 36.9, 39.1, -36.7, -34.5);
  put(C, M.makeWell(), 43.4, 0, -32.0); rcol(R, 42.5, 44.3, -32.9, -31.1);
  for (const [x, z, k] of [[24.6, -20.0, 0], [24.8, -15.8, 2], [29.2, -38.4, 1], [47.0, -38.6, 0], [51.4, -38.0, 2], [51.6, -30.4, 1], [51.6, -24.6, 0], [34.2, -31.6, 2]]) {
    put(C, M.makeTree(k, rand(0.9, 1.15)), x, 0, z, rand(0, 6)); rcol(R, x - 0.4, x + 0.4, z - 0.4, z + 0.4);
  }
  for (const [x, z] of [[34.4, -20.2], [42.2, -23.8]]) put(C, M.makeLamp(), x, 0, z);
  for (const [x, z] of [[35.6, -28.8], [41.6, -28.6], [40.0, -13.9]]) put(C, M.makeFlowers(), x, 0, z);
  R.activate = () => {};
  R.update = (dt) => { wm.userData.hub.rotation.z += dt * 0.9; };
  return R;
}

// =====================================================================
// KABUK TATİL KÖYÜ (nehrin doğusu, deniz kenarı): kiralık kabuk evler, resepsiyon, çamaşırhane (resort.js)
// =====================================================================
// lunapark: nehrin ötesinde, kuzeydoğuda; oyunun sonlarına doğru açılan en büyük alan (lunapark.js)
function buildLunapark() {
  const R = region('lunapark', 'Lunapark', LP_RECT, LP_WALK, 'grass', 4, '#6f9e45');
  return setupLunapark(R, { put, strip, rcol, hint, icon, registerIntro });
}
function buildTatil() {
  const R = region('tatil', 'Kabuk Tatil Köyü', [67, 105, 9.4, 31], [67.4, 104.6, 8.0, 30.8], 'sand', 3, '#d2a965');
  R.slab.geometry.dispose(); R.slab.geometry = coastSlabGeo(R.rect, (x) => coastZ(x) - 0.2); // denize bakan kenar kıyı çizgisini izler
  return setupResort(R, { put, strip, rcol, hint, icon });
}

// =====================================================================
// KASABA MEYDANI VE PARK (ana yolun kuzeyi, İpek Yolu'nun batısı): fıskiyeli büyük meydan ve park (plaza.js); baştan açık
// =====================================================================
function buildKasaba() {
  const R = region('kasaba', 'Kasaba Meydanı', [-57, -34.5, -50, -23.2], [-56.6, -32.8, -49.6, -22.4], 'grass', 4, '#9b6a3e');
  return setupPlaza(R, { put, strip, rcol });
}

// =====================================================================
// BÜYÜK TARLALAR (çiftliğin kuzeyi): dört parsel mısır ve buğday, kendi kendine eken ve biçen traktör (farmland.js)
// =====================================================================
function buildTarlalar() {
  // batı kenarındaki tarh koridoru (buğday parselleri, ayçiçeği tarlası, expand-east.js xtarlalar) bölgenin içinde (2026-11-02 kullanıcı:
  // "tarhları içeri al"): sınır x 23'ten 16,4'e uzadı
  const R = region('tarlalar', 'Büyük Tarlalar', [16.4, 53, -68, -40], [17.2, 52.6, -67.6, -39.4], 'grass', 4, '#9b6a3e');
  return setupFarmland(R, { put, strip, rcol, hint, icon });
}

// =====================================================================
// BALIKÇI İSKELESİ (sahil yolunun güneyi, sahil büfesinin batısı): denize uzanan iskele, balık tezgahı, balıkçı, restoran (fishing.js)
// =====================================================================
function buildIskele() {
  const R = region('iskele', 'Balıkçı İskelesi', [-40, -24, 30.6, 44], [-39.6, -24.4, 30.6, 31.0], 'sand', 3, '#d2a965');
  R.slab.geometry.dispose(); R.slab.geometry = coastSlabGeo(R.rect, (x) => coastZ(x) - 0.2); // kara yalnızca kıyıya kadar, iskele suyun üstünde
  return setupIskele(R, { put, strip, rcol, hint, icon });
}

function buildMeydan() {
  // otopark kasabanın batısında, ana yolun kuzeyinde, enerji yolunun batısındaki ormanlık alanda (2026-11-01 kullanıcı: "otoparkı daha
  // büyüt ve yerini biraz daha dışarı taşı"). Eski yeri (köyün batısı) çayır kaldı; orada yalnız paket servis cebi (events.js) ve
  // bisiklet parkı var. Ölçüler events.js LOT'tan: doğu giriş şeridi, ortada koridor, batı çıkış şeridi, iki sıra park yeri
  const [x0, x1, z0, z1] = LOT.rect, A = LOT.aisle;
  const R = region('meydan', 'Otopark', LOT.rect, [x0 + 0.4, x1 - 0.4, z0 + 0.4, z1 - 0.3], 'cobble', 2.4, '#7d776b');
  const C = R.content;
  strip(C, LOT.east, (z1 + A - 1.2) / 2, 2.6, z1 - A + 1.2, 'asphalt', 3, 0.014);
  strip(C, LOT.west, (z1 + A - 1.2) / 2, 2.4, z1 - A + 1.2, 'asphalt', 3, 0.014);
  strip(C, (LOT.west - 1.2 + LOT.east + 1.3) / 2, A, LOT.east + 1.3 - LOT.west + 1.2, 2.4, 'asphalt', 3, 0.015);
  const white = M.mat('#ffffff');
  const line = (x, z, w, d) => { const m = M.rbox(w, 0.02, d, 0.01, white); m.position.set(x, 0.03, z); C.add(m); };
  for (const z of [LOT.north, LOT.south]) for (const x of [...LOT.xs.map((v) => v - 1.65), LOT.xs[2] + 1.65]) line(x, z, 0.12, 4.4); // park yeri çizgileri
  for (const x of [-82.2, -78.2, -74.2, -71.2]) line(x, A, 1.0, 0.12); // koridorda kesik çizgi
  for (const x of [LOT.east, LOT.west]) for (const z of [-23.6, -25.8]) line(x, z, 0.12, 1.0);
  // tabelalar arka (kuzey) kenarda kameraya dönük; giriş şeridinin doğusunda mavi P levhası. Enerji yolunun tabelası (roads.js) köşede
  put(C, M.makeSign('🅿️ OTOPARK', '#2f6db5', 3.2, 0.75), -78.4, 0, -35.3, 0);
  put(C, M.makeSign('P', '#2f6db5', 0.9, 0.9), -67.4, 0, -27.0, 0); rcol(R, -67.9, -66.9, -27.1, -26.9);
  for (const [x, z] of [[-87.4, -22.4], [-67.8, -22.4], [-87.4, -35.0], [-67.8, -35.0]]) put(C, M.makeLamp(), x, 0, z);
  R.activate = () => {};
  return R;
}

// =====================================================================
// KERVANSARAY HANI
// =====================================================================
function buildHan() {
  // köyden uzakta, kuzeyde: önündeki meydana kervan İpek Yolu'ndan gelir (roads.js); köye ve ana yola yollarla bağlı
  const R = region('han', 'Kervansaray Hanı', [-16, 16, -60, -28], [-15.6, 15.6, -59.6, -27.4], 'desert', 3, '#c79a5a');
  const C = R.content;
  strip(C, -8, -32.2, 16.5, 3.2, 'path', 3); // kervanın beklediği şerit: İpek Yolu'nun ucu
  strip(C, 12.6, -30, 3, 4, 'path', 3, 0.011); // köyden gelen yol
  strip(C, -14.6, -33.2, 2.8, 6.8, 'path', 3, 0.011); // batı ağzı: İpek Yolu'nu karşılar
  strip(C, 0, -45.5, 20.4, 17.4, 'cobble', 2.4, 0.013);

  const north = M.makeArchWall(22, 4.2, 0.8, [[-8, 2, 2.8], [-4, 2, 2.8], [0, 2, 2.8], [4, 2, 2.8], [8, 2, 2.8]]);
  put(C, north, 0, 0, -54.6);
  put(C, M.rbox(22, 3, 0.6, 0.05, M.mat('#3a2516')), 0, 1.5, -55.3);
  for (const sx of [-1, 1]) {
    const w = M.makeArchWall(18, 3, 0.8, [[-5, 1.7, 2.2], [0, 1.7, 2.2], [5, 1.7, 2.2]]);
    put(C, w, sx * 10.6, 0, -45.5, PI / 2);
    put(C, M.rbox(0.6, 2.4, 18, 0.05, M.mat('#3a2516')), sx * 11.3, 1.2, -45.5);
    const low = M.makeArchWall(8.4, 1.6, 0.8, []);
    put(C, low, sx * 6.8, 0, -36.5);
  }
  const gate = M.makeArchWall(5.2, 4.8, 1.2, [[0, 3.2, 3.6]]);
  put(C, gate, 0, 0, -36.5);
  put(C, M.rbox(5.4, 0.6, 1.3, 0.05, M.mat('#ffffff', { map: texRep('cini', 4, 0.5) })), 0, 4.4, -36.5);
  put(C, M.rbox(5.6, 0.25, 1.4, 0.05, M.mat('#c8643b')), 0, 4.85, -36.5);
  put(C, M.makeSign('KERVANSARAY', '#2f6db5', 4.2, 0.8), 0, 3.2, -35.6);
  for (const [x, z, h] of [[-10.6, -54.6, 5.6], [10.6, -54.6, 5.6], [-10.6, -36.5, 3.8], [10.6, -36.5, 3.8]]) { put(C, M.makeTower(1.25, h, h > 5 ? '#3aa6a0' : '#2f6db5'), x, 0, z); rcol(R, x - 1.3, x + 1.3, z - 1.3, z + 1.3); }
  // kulelerin kubbesinde rüzgârda dalgalanan bayraklar: arkadaki yüksek kulelerde al bayrak, kapıdakilerde kervan sancağı (wind.js)
  for (const [x, z, h] of [[-10.6, -54.6, 5.6], [10.6, -54.6, 5.6], [-10.6, -36.5, 3.8], [10.6, -36.5, 3.8]]) put(C, h > 5 ? makeFlag('tr', 3.6, 2.3, 1.5) : makeFlag('han', 3.0, 1.8, 1.15), x, h + 1.45, z);
  put(C, M.makeFountain(), 0, 0, -44);
  rcol(R, -2.1, 2.1, -46.1, -41.9);
  rcol(R, -11.7, 11.7, -55.7, -54.0); rcol(R, -11.7, -10.0, -55.7, -36); rcol(R, 10.0, 11.7, -55.7, -36);
  rcol(R, -11, -2.6, -36.9, -36.1); rcol(R, 2.6, 11, -36.9, -36.1);
  rcol(R, -2.7, -1.6, -37.1, -35.9); rcol(R, 1.6, 2.7, -37.1, -35.9);
  for (const [x, z, c] of [[-8, -52.6, '#b23a48'], [4, -52.6, '#2f6db5']]) put(C, M.makeRug(c), x, 0.02, z);
  for (const [x, z] of [[-9.3, -38.2], [-8.6, -38], [9.2, -52.8], [-1.5, -53.2]]) put(C, M.makeAmphora(pick(['#c8643b', '#b5553a', '#d9a066'])), x, 0, z);
  // kervansarayın çevresindeki kum yoldaki 5 servi kaldırıldı (2026-11-04: ağaçlar yalnız çimende)
  for (const [x, z] of [[-11.4, -29.0], [-14.5, -52]]) put(C, M.makeRock(rand(0.8, 1.3), '#cfa86e'), x, 0, z, rand(0, 6));
  // han kapısının önündeki kumdaki palmiye (-13,5/-38,5) kaldırıldı (2026-11-04: ağaçlar yalnız çimende, palmiyeler yalnız sahilde)

  R.menu = ['ekmek'];
  R.bonus = 1.5;
  R.gens = {};
  // handaki tarlalar: buğday fırına ve ambara, domates çorba kazanına gider
  R.fields = [];
  R.addField = (x, z, type, instant) => {
    const f = new PlantBed(C, x, z, type, type === 'bugday' ? 4 : 5, { instant });
    R.fields.push(f);
    if (M.isFieldCrop(type)) M.fieldMarks(C, x, z, type);
    hint(x, 2.0, z, icon(type), type === 'bugday' ? 'Buğday tarlası' : 'Domates bahçesi', type === 'bugday' ? 'Buğdayı topla: fırında ekmek, ambarda deve yemi olur.' : 'Domatesi topla, çorba kazanının soldaki masasına bırak.', 3.4);
    return f;
  };
  R.activate = (instant) => {
    new Trash(C, 9.2, -51.6, { instant }); // avlunun kuzeydoğu köşesi
    const oven = put(C, M.makeOven(), -6.2, 0, -49.2); if (!instant) popIn(oven);
    rcol(R, -9.4, -4.8, -50.4, -48.0); rcol(R, -4.8, -3.0, -49.4, -48.4);
    R.addField(7.6, -32.9, 'bugday', instant); // hanın ön bahçesi: kapının doğusu, avlunun dışında
    R.ovenConv = new Converter(C, { inType: 'bugday', inCap: 6, ix: -8.5, iz: -47.3, iw: 1.8, id: 1.4, inTray: [-8.5, 0.82, -48.9], instant,
      out: { type: 'ekmek', interval: 2.4, max: 10, origin: V(-6.2, 1.0, -48.3), tray: [-3.9, 0.82, -48.9], zx: -3.9, zz: -47.3, zw: 2.6, zd: 1.4 } });
    R.gens.ekmek = R.ovenConv.out;
    hint(-8.5, 2.2, -48.9, `${icon('bugday')}→${icon('ekmek')}`, 'Fırın', 'Buğdayı soldaki masaya bırak, fırın ekmek pişirir. Ekmeği sağdaki tepsiden al.', 3.4);
    R.pile = new MoneyPile(C, 2.9, -32.3, 0, { instant, look: { shirt: '#6b3fa0', pants: '#3a2a1a', hat: 'turban', hatColor: '#ffffff', skin: '#d9a67c', mustache: true } }); // hancı
    R.caravan = new Caravan(R);
  };
  R.addCauldron = (instant) => {
    const ca = put(C, M.makeCauldron(), 3.0, 0, -50.2); if (!instant) popIn(ca);
    R.fire = ca.getObjectByName('fire');
    rcol(R, 2.0, 4.0, -51.2, -49.2); rcol(R, 4.1, 5.9, -50.4, -49.4); rcol(R, 0.1, 1.9, -50.4, -49.4);
    R.menu.push('corba');
    R.addField(7.6, -29.5, 'domates', instant); // ön bahçe, buğdayın güneyi
    R.soupConv = new Converter(C, { inType: 'domates', inCap: 6, ix: 1.0, iz: -48.3, iw: 1.8, id: 1.4, inTray: [1.0, 0.82, -49.9], instant,
      out: { type: 'corba', interval: 3.0, max: 8, origin: V(3.0, 1.6, -50.2), tray: [5.0, 0.82, -49.9], zx: 5.0, zz: -48.3, zw: 2.6, zd: 1.4 } });
    R.gens.corba = R.soupConv.out;
    hint(1.0, 2.2, -49.9, `${icon('domates')}→${icon('corba')}`, 'Çorba kazanı', 'Domatesi (bahçeden ya da köyden) soldaki masaya bırak, kazan çorba yapar.', 3.4);
  };
  R.addGranary = (instant) => {
    const gr = put(C, M.makeGranary(), -6.6, 0, -41.0); if (!instant) popIn(gr);
    rcol(R, -7.8, -5.4, -42.0, -40.0); rcol(R, -5.3, -3.5, -41.2, -40.2); rcol(R, -9.7, -7.9, -41.2, -40.2);
    if (gr.userData.bina) { const [x0, x1, z0, z1] = gr.userData.bina; rcol(R, -6.6 + x0, -6.6 + x1, -41.0 + z0, -41.0 + z1); } // arkadaki silolu ambar (esya.js)
    R.menu.push('yem');
    G.regions.tarla.addWheat(1, instant); // ambarın buğdayı Köy Tarlaları'nda (tarım kuşağı)
    R.granaryConv = new Converter(C, { inType: 'bugday', inCap: 6, ix: -8.8, iz: -39.2, iw: 1.8, id: 1.3, inTray: [-8.8, 0.82, -40.7], instant,
      out: { type: 'yem', interval: 2.0, max: 10, origin: V(-6.6, 1.0, -41), tray: [-4.4, 0.82, -40.7], zx: -4.4, zz: -39.2, zw: 2.6, zd: 1.3 } });
    R.gens.yem = R.granaryConv.out;
    hint(-8.8, 2.2, -40.7, `${icon('bugday')}→${icon('yem')}`, 'Yem ambarı', 'Buğdayı soldaki masaya bırak, ambar deve yemi hazırlar.', 3.4);
  };
  R.addDecor = (instant) => {
    R.bonus = 2.0;
    const items = [];
    for (const [x, z] of [[-6, -37.6], [6, -37.6], [-9.4, -46], [9.4, -46]]) items.push(put(C, M.makeLamp('#7a4a2e'), x, 0, z));
    for (let i = 0; i < 9; i++) { const f = M.rbox(0.5, 0.35, 0.03, 0.01, M.mat(['#e8604c', '#f6c343', '#3aa6a0', '#2f6db5'][i % 4])); items.push(put(C, f, -4 + i, 4.25, -54.15)); }
    items.push(put(C, M.makeRug('#e0b04a'), 0, 0.03, -39.4));
    if (!instant) items.forEach((o, i) => popIn(o, i * 0.03));
  };
  R.update = (dt) => {
    if (R.caravan) R.caravan.update(dt);
    if (R.fire) { const s = 0.85 + Math.sin(G.time * 18) * 0.12 + Math.random() * 0.06; R.fire.scale.set(s, 0.9 + Math.sin(G.time * 13) * 0.2, s); }
  };
  return R;
}

class CaravanDrop extends Station {
  constructor(car) { super(0.6, -32.2, 2.8, 2.6); this.car = car; this.bodyFn = () => (car.state === 'wait' ? [[car.members[0].position.x - 9.4, car.members[0].position.x + 0.4, -32.9, -31.5]] : null); }
  update(dt) {
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.12 && this.deliverFrom(G.stack)) this.t = 0;
  }
  deliverFrom(stack) {
    const car = this.car;
    if (car.state !== 'wait') return false;
    const need = Object.keys(car.order).filter((k) => car.order[k].got < car.order[k].need);
    const it = stack.takeOf(need);
    if (!it) return false;
    car.order[it.type].got++;
    const camel = car.members[1 + Math.floor(Math.random() * 3)];
    fly(it.obj, camel, V(0, 2.4, 0), 0.32, 1.2, (o) => o.parent && o.parent.remove(o));
    sfx('pop', { npc: stack !== G.stack });
    car.refresh();
    if (Object.values(car.order).every((o) => o.got >= o.need)) car.finish(true);
    return true;
  }
}

// İpek Yolu (roads.js SILK_ROAD): kervan kuzeydeki dağ geçidinden iner, x -24 boyunca güneye gelir, hanın önündeki meydana döner
const SILK_LEN = [];
{ let a = 0; SILK_LEN.push(0); for (let i = 1; i < SILK_ROAD.length; i++) { a += SILK_ROAD[i].distanceTo(SILK_ROAD[i - 1]); SILK_LEN.push(a); } }
const SILK_END = SILK_LEN[SILK_LEN.length - 1];
// yolun d metresindeki nokta ve o noktadaki ilerleme yönü
function silkAt(d) {
  d = Math.max(0, Math.min(SILK_END, d));
  let i = 1;
  while (i < SILK_ROAD.length - 1 && SILK_LEN[i] < d) i++;
  const a = SILK_ROAD[i - 1], b = SILK_ROAD[i], k = (d - SILK_LEN[i - 1]) / (SILK_LEN[i] - SILK_LEN[i - 1] || 1);
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, ry: Math.atan2(b.x - a.x, b.z - a.z) };
}
class Caravan {
  constructor(R) {
    this.R = R;
    this.members = [M.makeCharacter({ shirt: '#6b3fa0', hat: 'turban', hatColor: '#ffffff', skin: '#d9a67c' })];
    for (const l of ['#b23a48', '#2f6db5', '#3aa6a0']) this.members.push(M.makeCamel(l));
    for (const m of this.members) { R.content.add(m); m.visible = false; }
    this.state = 'away'; this.t = 2; this.d = 0; this.dir = 1;
    this.drop = new CaravanDrop(this);
    const el = document.createElement('div');
    el.className = 'order caravan'; // diğer sipariş kutularıyla aynı görünüm (index.html .order): küçük simge, altında got/need
    this.el = el;
    this.label = G.labels.add(el, (v) => v.set(this.members[0].position.x - 2.2, 4.2, this.members[0].position.z));
    this.label.hidden = true;
  }
  // bütün kervan ekran dışındayken hızlı yürür
  boost() { return this.members.every((m) => offscreen(m.position)) ? 4 : 1; }
  layout(dt) {
    const speed = this.state === 'arrive' || this.state === 'leave' ? 1 : 0;
    this.members.forEach((m, i) => {
      const off = i === 0 ? 0 : 1.9 + (i - 1) * 3.0; // develer büyüdü (models.js rawCamel ×1,15): burun öndekinin kuyruğuna girmesin
      const q = silkAt(this.d - off * this.dir); // develer yolda önderin arkasından gelir
      m.position.set(q.x, 0, q.z + (i === 0 ? 0.2 : 0));
      m.rotation.y = this.dir > 0 ? q.ry : q.ry + PI;
      m.visible = this.state !== 'away';
      if (i === 0) M.animateCharacter(m, speed, dt, false); else M.animateCamel(m, speed, dt);
    });
  }
  start() {
    this.order = {};
    const menu = this.R.menu;
    for (const t of menu) this.order[t] = { need: 2 + Math.floor(Math.random() * (menu.length > 1 ? 3 : 4)), got: 0 };
    this.timer = this.total = 60 + 20 * menu.length;
    this.refresh();
    this.label.hidden = false;
    floatText(this.members[0].position, say('caravanHi'), 'rival');
    sfx('bong', { at: this.members[0].position });
  }
  refresh() {
    const rows = Object.keys(this.order).map((k) => {
      const o = this.order[k];
      return `<span class="row${o.got >= o.need ? ' ok' : ''}"><img src="${G.icons[k]}" alt=""><b>${o.got}/${o.need}</b></span>`;
    }).join('');
    this.el.innerHTML = `<span class="ct">🐫 Kervan siparişi</span><span class="rows">${rows}</span><span class="bar"><i></i></span>`;
    this.barEl = this.el.querySelector('.bar i');
  }
  finish(done) {
    let pay = 0;
    for (const k in this.order) { const o = this.order[k]; pay += ITEMS[k].price * (done ? o.need : o.got); }
    pay = Math.round(pay * (done ? this.R.bonus : 1) * mult());
    if (pay > 0) { this.R.pile.add(pay, this.members[2].position); floatText(this.members[0].position, done ? `${say('caravanDone')} +${pay} ₺` : `+${pay} ₺`, 'pos'); if (!done) sfx('cash', { at: this.members[0].position }); }
    else { floatText(this.members[0].position, say('caravanLate'), 'neg'); sfx('bad', { at: this.members[0].position }); }
    // tam teslim: tek bir kutlama müziği (kâhya teslim ettiyse ve uzaktaysan duyulmaz)
    if (done) { confetti(this.members[1].position, 40); sfx('caravan', { at: this.members[0].position }); G.stats.caravans++; }
    else if (G.hooks.fineOrder) G.hooks.fineOrder(this.order, this.members[0].position); // yetişmeyen sipariş tazminatı
    for (const k in this.order) G.stats.sold += this.order[k].got;
    this.label.hidden = true;
    this.state = 'leave'; this.dir = -1;
  }
  update(dt) {
    switch (this.state) {
      case 'away':
        this.t -= dt;
        if (this.t <= 0) { this.state = 'arrive'; this.dir = 1; this.d = 0; }
        break;
      case 'arrive':
        this.d += 2.4 * dt * this.boost();
        if (this.d >= SILK_END) { this.d = SILK_END; this.state = 'wait'; this.start(); }
        break;
      case 'wait':
        this.timer -= dt;
        if (this.barEl) this.barEl.style.width = `${Math.max(0, this.timer / this.total) * 100}%`;
        if (this.timer <= 0) this.finish(false);
        break;
      case 'leave':
        this.d -= 2.4 * dt * this.boost();
        if (this.d <= 0) { this.state = 'away'; this.t = 4; }
        break;
    }
    this.layout(dt);
  }
}

// =====================================================================
// KİLİT SIRASI
// =====================================================================
// köy bahçesi: dükkanın güneyinde iki sıra düz toprak bostan. Domatesler batıda, salatalıklar doğuda yan yana;
// ortadaki geçit sahile inen kapıyla (x -4..-1) aynı hizada. Yeni sıralar kilitle açılır (k4-k8)
// bostanların arası açık (2026-10-28 kullanıcı: "bostanların arası açılsın"): yan yana yataklar arası 0,6 m'den 1,4-1,6 m'ye,
// sıralar arası 0,9 m'den 1,6 m'ye çıktı; yanından toplamadan rahat geçilir. Batı uç patikaya, doğu uç bahçe genişlemesine dayalı
// 2026-11-01 köy marketi öne büyüdü (dukkan.js): yatak sıraları güneye kaydı (4,4 → 5,7, 9,0 → 9,9), arası 1,2 m
const GARDEN = { T1: [-4.9, 5.7], T2: [-10.5, 5.7], T3: [-4.9, 9.9], T4: [-10.5, 9.9], C1: [1.7, 5.7], C2: [7.1, 5.7], C3: [1.7, 9.9], C4: [7.1, 9.9] };
// eski yerler: kayıttaki fide sayısı yatağın yerine bağlı (game.js bedKey), yeni yerine aktarılır (en eskisi önce)
const GARDEN_OLD = [{ T1: [-5.9, 4.4], T2: [-10.5, 4.4], T3: [-5.9, 8.3], T4: [-10.5, 8.3], C1: [0.9, 4.4], C2: [5.5, 4.4], C3: [0.9, 8.3], C4: [5.5, 8.3] },
  { T1: [-4.9, 4.4], T2: [-10.5, 4.4], T3: [-4.9, 9.0], T4: [-10.5, 9.0], C1: [1.7, 4.4], C2: [7.1, 4.4], C3: [1.7, 9.0], C4: [7.1, 9.0] }];
// fide fide açılır (game.js PlantBed o.fide): fide fiyatı sıranın kilit fiyatından; ilk domates sırası (kilitsiz) 2 fideyle başlar
function addPlot(type, pos, instant) {
  const K = G.regions.koy, [x, z] = pos, u = UNLOCKS.find((d) => d.at === pos);
  const name = Object.keys(GARDEN).find((k) => GARDEN[k] === pos);
  if (name && G.fide) for (const L of GARDEN_OLD) { const old = L[name], ok = bedKey(type, old[0], old[1]), nk = bedKey(type, x, z); if (G.fide[ok] != null && G.fide[nk] == null) { G.fide[nk] = G.fide[ok]; delete G.fide[ok]; } }
  K.beds.push(new PlantBed(K.content, x, z, type, (type === 'salatalik' ? 6 : 5) / ((G.mods && G.mods.koySera) || 1), { instant, fide: Math.max(60 * PRICE_K, u ? u.base : 60 * PRICE_K), start: u ? 1 : 2 })); // bahçe serası (genişletme) hızlandırır
}
const UNLOCKS = [
  { id: 'k1', icon: '🥒', title: 'Salatalık Bostanı', price: 40, at: GARDEN.C1, build: (i) => addPlot('salatalik', GARDEN.C1, i) },
  { id: 'k2', icon: '🧺', title: 'Salatalık Rafı', price: 80, get at() { return padNow('salatalik'); }, y: 0.26, build: (i) => G.regions.koy.addShelf('salatalik', i) },
  { id: 'k3', icon: '🍅', title: 'İkinci Domates Bostanı', price: 150, at: GARDEN.T2, build: (i) => addPlot('domates', GARDEN.T2, i) },
  // bahçe büyür: her türün yanına yeni sıra
  { id: 'k4', icon: '🥒', title: 'İkinci Salatalık Sırası', price: 250, at: GARDEN.C2, side: true, req: 'k1', build: (i) => addPlot('salatalik', GARDEN.C2, i) },
  { id: 'k5', icon: '🍅', title: 'Üçüncü Domates Sırası', price: 300, at: GARDEN.T3, side: true, req: 'k3', build: (i) => addPlot('domates', GARDEN.T3, i) },
  { id: 'k6', icon: '🥒', title: 'Üçüncü Salatalık Sırası', price: 400, at: GARDEN.C3, side: true, req: 'k4', build: (i) => addPlot('salatalik', GARDEN.C3, i) },
  { id: 'k7', icon: '🍅', title: 'Dördüncü Domates Sırası', price: 450, at: GARDEN.T4, side: true, req: 'k5', build: (i) => addPlot('domates', GARDEN.T4, i) },
  { id: 'k8', icon: '🥒', title: 'Dördüncü Salatalık Sırası', price: 550, at: GARDEN.C4, side: true, req: 'k6', build: (i) => addPlot('salatalik', GARDEN.C4, i) },
  { id: 'gp', lvl: 2, icon: '🍉', title: 'Semt Pazarı', price: 250, at: [13.6, 0], build: (i) => unlockRegion('pazar', i) },
  // pazarın tezgâhları tek tek, kendi yerlerinde; kamyonet park edeceği yerde açılır
  { id: 'pt1', icon: '🍅', title: 'Domates Tezgâhı', price: 120, at: pzPad(1), size: 1.9, build: (i) => G.regions.pazar.openStall('domates', i) },
  { id: 'pt2', icon: '🥒', title: 'Salatalık Tezgâhı', price: 160, at: pzPad(2), size: 1.9, build: (i) => G.regions.pazar.openStall('salatalik', i) },
  { id: 'p1', icon: '🚚', title: 'Sebze Kamyoneti', price: 200, at: [37.5, 9.6], build: (i) => G.regions.pazar.addVeg(i) },
  { id: 'pt3', icon: '🫑', title: 'Biber Tezgâhı', price: 220, at: pzPad(3), size: 1.9, build: (i) => G.regions.pazar.openStall('biber', i) },
  { id: 'pt4', icon: '🍆', title: 'Patlıcan Tezgâhı', price: 260, at: pzPad(4), size: 1.9, build: (i) => G.regions.pazar.openStall('patlican', i) },
  { id: 'kk', lvl: 3, icon: '🐔', title: 'Çiftlik ve Kümes', price: 300, at: [37.7, -12.4], build: (i) => G.regions.koy.addCoop(i) },
  { id: 'ky', icon: '🥚', title: 'Yumurta Rafı', price: 200, get at() { return padNow('yumurta'); }, y: 0.26, build: (i) => G.regions.koy.addShelf('yumurta', i) },
  // meydan tek kilitle açılır: bisiklet parkı ve otopark birlikte (eskiden otopark ayrı kilitti, 'ko'; eski kayıtta kb ikisini de kurar)
  { id: 'kb', lvl: 3, icon: '🅿️', title: 'Bisiklet Parkı ve Otopark', price: 600, at: [-13.8, -4.6], build: (i) => { unlockRegion('meydan', i); G.regions.koy.addBikeRack(i); G.regions.koy.addLot(i); } },
  { id: 'ka', icon: '🐄', title: 'Ahır', price: 450, at: [46.4, -26.0], build: (i) => G.regions.koy.addBarn(i) },
  { id: 'kd', icon: '🥛', title: 'Süt Dolapları', price: 300, get at() { return padNow('sut'); }, y: 0.26, build: (i) => G.regions.koy.addShelf('sut', i) }, // süt, sonra peynir, koyun sütü, yoğurt: her biri ayrı dolap
  // dükkân büyür (dukkan.js aşamaları): ödeme yeri o anki ön duvarın dışında; büyüyünce yeni raf yerleri açılır
  { id: 'kS2', lvl: 3, icon: '🏪', title: 'Dükkânı Büyüt: Bakkal', price: 800, at: [3.2, -3.2], side: true, req: 'kd', build: (i) => G.regions.koy.setStage(2, i) },
  { id: 'kS3', lvl: 6, icon: '🏬', title: 'Köy Marketi', price: 2400, at: [3.2, 0.4], side: true, req: 'kS2', build: (i) => G.regions.koy.setStage(3, i) },
  // büyük köy marketi (2026-11-02): doğuya, köy caddesine büyür; ödeme yeri marketin doğu kenarının ötesinde, caddenin batı yarısında
  { id: 'kS4', lvl: 12, icon: '🏬', title: 'Büyük Köy Marketi', price: 6000, at: [17.4, -1.2], side: true, req: 'kS3', build: (i) => G.regions.koy.setStage(4, i) },
  // dükkânın ortasındaki çift yüzlü reyon ve arka sıranın doğu ucu: başka bölgelerin ürünleri köyde de satılır (rafçı uzaktan getirir)
  // manav reyonu biber tezgâhıyla açılır, dükkân hangi aşamada olursa olsun (1. aşamada arka sıranın batısında: KOY_PLACES1)
  { id: 'kr3', icon: '🍉', title: 'Manav Reyonu', price: 350, get at() { return (G.regions.koy && G.regions.koy.stage >= 2) ? padAt('karpuz') : padNow('patlican'); }, y: 0.26, side: true, req: 'pt3', build: (i) => G.regions.koy.addShelf('manav', i) },
  { id: 'kr2', icon: '🧶', title: 'Kilim ve Yün Rafları', price: 450, at: padAt('kilim'), y: 0.26, side: true, req: 'm2', stage: 3, build: (i) => G.regions.koy.addShelf('kilim', i) },
  { id: 'kr1', icon: '🥖', title: 'Fırın Rafları', price: 500, at: padAt('ekmek'), y: 0.26, side: true, req: 'gf', stage: 2, build: (i) => G.regions.koy.addShelf('firin', i) },
  { id: 'gs', lvl: 4, icon: '🏖️', title: 'Sahil Büfesi', price: 500, at: [47.5, 10.6], build: (i) => unlockRegion('sahil', i) }, // kamyon park cebinin doğusunda: kamyon padi örtmesin
  // balıkçı iskelesi: sahil yolunun güneyinde denize uzanan iskele; sonra iskelede balık restoranı (fishing.js)
  { id: 'gb', lvl: 6, icon: '🎣', title: 'Balıkçı İskelesi', price: 1400, at: [-38.6, 29.7], side: true, req: 'gs', build: (i) => unlockRegion('iskele', i) },
  { id: 'b2', lvl: 7, icon: '🐟', title: 'Balık Restoranı', price: 1800, at: [-36.6, 36.2], side: true, req: 'gb', build: (i) => G.regions.iskele.addRestaurant(i) },
  { id: 's1', icon: '🍦', title: 'Dondurma Makinesi', price: 400, at: [37.4, 22.8], build: (i) => G.regions.sahil.addFreezer(i) },
  { id: 's2', icon: '⛱️', title: 'Yeni Şezlonglar', price: 450, at: [44, 26.8], build: (i) => G.regions.sahil.addLoungers([44, 48, 15.25], i) },
  { id: 'kc', lvl: 5, icon: '🚗', title: 'Paket Servis', price: 450, at: [-12.6, -7.2], build: (i) => { unlockRegion('meydan', i); G.regions.koy.startCars(i); } },
  // ikinci kasa (2026-11-01 kullanıcı: "yeni kasa ekleme alma opsiyonumuz da olsun"): ödeme yeri köy marketindeki yerinin önünde
  { id: 'kk2', lvl: 6, icon: '🧾', title: 'İkinci Kasa', price: 1500, at: [D.counter2At(3).x, D.queue2At(3)[0].z], y: 0.26, side: true, stage: 2, build: (i) => G.regions.koy.addRegister(i) },
  { id: 'gm', lvl: 5, icon: '🐑', title: 'Koyun Merası', price: 650, at: [-20.0, 16.0], side: true, req: 'gs', build: (i) => unlockRegion('mera', i) },
  { id: 'lt1', icon: '🛟', title: 'Cankurtaran Kulesi 2', price: 500, at: [31, 28.4], side: true, req: 'gs', build: (i) => G.regions.sahil.addTower(31, 28.6, i) },
  { id: 'lt2', icon: '🛟', title: 'Cankurtaran Kulesi 3', price: 800, at: [6, 28.4], side: true, req: 'lt1', build: (i) => G.regions.sahil.addTower(6, 28.6, i) },
  { id: 'lt3', icon: '🛟', title: 'Cankurtaran Kulesi 4', price: 1100, at: [-12, 28.4], side: true, req: 'lt2', build: (i) => G.regions.sahil.addTower(-12, 28.6, i) },
  { id: 'm2', lvl: 6, icon: '🧶', title: 'Dokuma Atölyesi', price: 600, at: [-43.2, 20.1], side: true, req: 'gm', build: (i) => { unlockRegion('yol', i); unlockRegion('atolye', i); } },
  { id: 'm1', icon: '🍼', title: 'Sağım Yeri', price: 500, at: [-39.6, 21.4], side: true, req: 'gm', build: (i) => G.regions.mera.addMilking(i) },
  { id: 'm3', icon: '🍶', title: 'Yoğurt Küpü', price: 800, at: [-38.2, 21.4], side: true, req: 'm1', build: (i) => G.regions.mera.addYogurt(i) },
  // köy yolunun sonunda Bemis benzinlik (e0), sonra şarj üniteleri: elektrikli arabalar şarj olur, parası yığına düşer
  { id: 'e0', lvl: 6, icon: '⛽', title: 'Bemis Benzinlik', price: 700, at: [-74, -13.6], side: true, req: 'kc', build: (i) => openStation(i) },
  // şarj küçükten büyüğe: önce iki AC noktası, sonra DC hızlı şarj; genişletmeler (Süper Şarj, Ekspres Şarj) DC'den sonra (expand.js REQ).
  // Kimlikler eski kayıtlar bozulmasın diye aynı: e2 AC, e1 DC
  { id: 'e2', icon: '🔌', title: 'AC Şarj Noktaları', price: 700, at: [-73.9, -4.4], side: true, req: 'e0', build: (i) => addCharging('ac', i) },
  { id: 'e1', icon: '⚡', title: 'Bemis DC Hızlı Şarj', price: 1200, at: [-68.5, -9.0], side: true, req: 'e2', build: (i) => addCharging('dc', i) },
  // Bemis Enerji Parkı: benzinliğin karşısında. Trafo ve ilk panel dizisiyle açılır; öbür paneller ve türbinler pahalı,
  // kendi kendine para kazandıran yatırımlar (energy.js)
  { id: 'gw', lvl: 10, icon: '🌬️', title: 'Bemis Enerji Parkı', price: 1000, at: [-73.6, -58.2], side: true, req: 'e0', build: (i) => unlockRegion('enerji', i) },
  { id: 'w1', icon: '☀️', title: 'Güneş Paneli Dizisi 2', price: 1500, at: [-76.4, -61.6], side: true, req: 'gw', build: (i) => G.regions.enerji.addUnit('sun', 1, i) },
  { id: 'w2', icon: '☀️', title: 'Güneş Paneli Dizisi 3', price: 1500, at: [-81.6, -61.6], side: true, req: 'w1', build: (i) => G.regions.enerji.addUnit('sun', 2, i) },
  { id: 'w3', icon: '🌬️', title: 'Rüzgâr Türbini 1', price: 2600, at: [-71.2, -64.8], side: true, req: 'gw', build: (i) => G.regions.enerji.addUnit('wind', 0, i) },
  { id: 'w4', icon: '🌬️', title: 'Rüzgâr Türbini 2', price: 2600, at: [-76.4, -64.8], side: true, req: 'w3', build: (i) => G.regions.enerji.addUnit('wind', 1, i) },
  { id: 'w5', icon: '🌬️', title: 'Rüzgâr Türbini 3', price: 2600, at: [-81.6, -64.8], side: true, req: 'w4', build: (i) => G.regions.enerji.addUnit('wind', 2, i) },
  // at ahırı: köy yolunun tarlalar tarafında; atlı müşteriler atını bakıma bırakır (riders.js)
  { id: 'gt', lvl: 6, icon: '🐎', title: 'At Ahırı', price: 900, at: [-45, 10.2], side: true, req: 'kc', build: (i) => unlockRegion('atlar', i) },
  // köy fırını han yolunda (e-ticaret ofisi 2026-11-09'da kalktı, yerinde çocuk parkı: park.js)
  { id: 'gf', lvl: 7, icon: '🥯', title: 'Köy Fırını', price: 900, at: [-2, -19.2], side: true, req: 'gh', build: (i) => unlockRegion('firin', i) },
  { id: 'at1', icon: '🐴', title: 'Yeni At Bölmeleri', price: 750, at: [-41.7, 1.75], side: true, req: 'gt', build: (i) => G.regions.atlar.addStalls(2, i) },
  { id: 'gh', lvl: 7, icon: '🐫', title: 'Kervansaray Hanı', price: 800, at: [12.6, -25.5], build: (i) => unlockRegion('han', i) },
  { id: 'h1', icon: '🍲', title: 'Çorba Kazanı', price: 600, at: [5.0, -48.3], build: (i) => G.regions.han.addCauldron(i) },
  { id: 'h2', icon: '🌾', title: 'Yem Ambarı', price: 800, at: [-5.2, -39.2], build: (i) => G.regions.han.addGranary(i) },
  { id: 'km', icon: '🧀', title: 'Mandıra', price: 700, side: true, req: 'kd', at: [38.0, -25.4], build: (i) => G.regions.koy.addDairy(i) },
  // büyük tarlalar: çiftliğin kuzeyinde; traktör kendi kendine eker, biçer, hasadı yığına boşaltır (farmland.js)
  { id: 'gy', lvl: 8, icon: '🚜', title: 'Büyük Tarlalar', price: 1100, at: [38.0, -38.6], side: true, req: 'kk', build: (i) => unlockRegion('tarlalar', i) },
  { id: 'gk', lvl: 9, icon: '🐚', title: 'Kabuk Tatil Köyü', price: 1200, at: [70.4, 6.5], build: (i) => unlockRegion('tatil', i) },
  // lunapark: taban 10.910 → ×2 (PRICE_K) ×1,25 (zorluk) ×2,2 (bölüm çarpanı, 11. seviyeden sonra sabit) = ekranda 60.000 ₺; 2026-11-05'ten beri kapı 1.000.000 ₺ (fiyat.js LUNA_PRICE)
  { id: 'gl', lvl: 38, icon: '🎡', title: 'Lunapark', price: 10910, at: [93, 5.6], build: (i) => unlockRegion('lunapark', i) },
  { id: 'tk1', icon: '🐚', title: 'Kabuk Ev 3', price: 700, at: [86.5, 21], side: true, req: 'gk', build: (i) => G.regions.tatil.addHouse(2, i) },
  { id: 'tk2', icon: '🐚', title: 'Kabuk Ev 4', price: 1000, at: [94, 21], side: true, req: 'tk1', build: (i) => G.regions.tatil.addHouse(3, i) },
  { id: 'tk3', icon: '🐚', title: 'Kabuk Ev 5', price: 1400, at: [101.5, 21], side: true, req: 'tk2', build: (i) => G.regions.tatil.addHouse(4, i) },
  { id: 'h3', icon: '✨', title: 'Han Süslemesi', price: 1500, at: [6, -52.6], build: (i) => G.regions.han.addDecor(i) },
];
UNLOCKS.push(...cityUnlocks({ unlockRegion })); // şehir: gc1, gc2, gc (seviye 10-14, köydeki durak) ve marketin yan kilitleri (city.js)
UNLOCKS.push(...expansionUnlocks({ hint, icon, registerIntro })); // bölge genişletmeleri: her bölgeye üç kademe arsa (expand.js)
// fiyat çarpanı (game.js PRICE_K): bölge, raf, dükkân büyütme ve şehir kilitleri iki kat; genişlemeler expand.js'te zaten çarpıldı.
// Fide fiyatı kilit fiyatından gelir (addPlot), o da iki kat olur
for (const u of UNLOCKS) if (!u.expansion) u.price = Math.round((u.price * PRICE_K) / 10) * 10;
// zorluk (2026-10-27): kilitler %25, şehir marketinin iç kilitleri (sc) %50 pahalı. Şehre gidiş kademeleri (gc1, gc2, gc)
// sabit fiyatlıdır: ne bu çarpanı ne de aşağıdaki seviye çarpanını alır
const isCity = (u) => /^gc/.test(u.id);
for (const u of UNLOCKS) if (!isCity(u)) u.price = Math.round((u.price * (/^sc\d/.test(u.id) ? 1.5 : 1.25)) / 10) * 10;

// bölüm kilitleri (id 'g' ile başlar) oyun ilerledikçe pahalanır: açılmış her bölüm, açılmamış bölümlerin fiyatını
// taban fiyatın %20'si kadar artırır. Pad fiyatı canlı okunur; bölüm açılınca bekleyen padlerin yazısı tazelenir
const isBolum = (u) => u.id[0] === 'g' && !isCity(u);
// bölüm fiyatı oyuncunun seviyesiyle artar (seviye başına %12, 11. seviyede durur); hangi bölümün önce açıldığı fiyatı değiştirmez
const katAt = (lv) => 1 + 0.12 * (Math.min(lv, 11) - 1);
function bolumKat() { return katAt(G.level || 1); }
const padDef = (u) => (isBolum(u) ? Object.create(u, { price: { get: () => Math.round((u.price * bolumKat()) / 50) * 50 } }) : u);
// kademeli fiyat (fiyat.js): kilidin göründüğü seviye; şartı (req) ya da ana sırada önündekiler daha geç geliyorsa onların seviyesi.
// Lunapark (sv 38) ana sıranın seviyesini yükseltmez: arkasındaki han süslemesi kendi kademesinde kalır. Şart sonradan tanımlanmış olabilir (e1 → e2)
const TIER_LV = {};
for (let pass = 0; pass < 4; pass++) {
  let chain = 1;
  for (const u of UNLOCKS) {
    const own = Math.max(u.lvl || 1, u.req ? TIER_LV[u.req] || 1 : 1, !u.side && !u.req ? chain : 1);
    TIER_LV[u.id] = own;
    if (!u.side && own < 20) chain = Math.max(chain, own);
  }
}
for (const u of UNLOCKS) {
  u.base = u.price; // kilidin verdiği XP ve köy bostanının fidesi eski fiyattan (finishUnlock, addPlot)
  const k = tierK(TIER_LV[u.id]);
  if (u.id === 'gl') u.price = LUNA_PRICE / katAt(11); else if (k > 1) u.price = nice(u.price * k); // lunapark ekranda tam 1.000.000 (38. seviyede bölüm çarpanı ×2,2)
}

// ---------- mertebe ----------
// bölümün seviyesi gelmeden alanı görünmez: zemini, kilit yazısı ve haritadaki yeri gizli; seviyesi gelince ortaya çıkar
const AREA_OF = { lunapark: 'gl', pazar: 'gp', ciftlik: 'kk', meydan: 'kb', sahil: 'gs', tarla: 'gs', mera: 'gm', atolye: 'm2', yol: 'm2', atlar: 'gt', han: 'gh', firin: 'gf', tarlalar: 'gy', tatil: 'gk', enerji: 'gw', iskele: 'gb', sehir: 'gc1' };
// eleman ve geliştirmelerin kademesi bölgenin açılış kilidinden (upgrades.js cost): bölge adı ya da genişleme kimliği; köy ×1
const TIER_AREA = { sehir: 'gc', kasaba: 'xkasaba1', cicekci: 'xkasaba2' };
export const tierOf = (key) => tierK(TIER_LV[TIER_AREA[key] || AREA_OF[key] || key] || 1);
export const needsOfArea = (id) => { const u = UNLOCKS.find((d) => d.id === (id === 'benzin' ? 'e0' : AREA_OF[id])); return u && !G.unlocked.has(u.id) ? needRows(u) : []; }; // kapalı bölgenin açılış şartları (upgrades.js)
export const areasAt = (n) => UNLOCKS.filter((u) => u.lvl === n && !u.retired);
// haritadaki kilidin istediği fiyat (zorluk ve bölüm çarpanlarıyla); menü bunu gösterir (upgrades.js bolumCard)
export const unlockPrice = (id) => { const u = UNLOCKS.find((x) => x.id === id); return u ? padDef(u).price : null; };
// bölümün adı yalnız açılış kilidi (alma işareti) yerinde durunca ya da açılınca görünür: kilit yazısı o zamana kadar "🔒 Kilitli",
// haritada adı yazmaz (minimap.js R.named). Önden ne geleceği bilinmesin (2026-11-08 kullanıcı: "mini mapte ve harita üstünde açılmamış
// yerlerin isimleri yazmasın ... o bölümü açma geldiğinde yazsın alma işareti olunca"). Kilit ana sırada (G.nextPad) ya da yan kilit (sideOpen)
const padUp = (uid) => !!((G.nextPad && G.nextPad.def.id === uid) || sideOpen[uid]);
let nameT = 0;
function nameAreas(dt) {
  if ((nameT -= dt) > 0) return;
  nameT = 0.25;
  for (const id in AREA_OF) {
    const R = G.regions[id];
    if (!R || !R.lockEl) continue;
    const on = R.unlocked || padUp(AREA_OF[id]);
    if (R.named === on) continue;
    R.named = on;
    R.lockEl.textContent = on ? `${R.name} · kilitli` : '🔒 Kilitli';
  }
  setStationNamed(G.unlocked.has('e0') || padUp('e0'));
}
function revealAreas(instant) {
  for (const id in AREA_OF) {
    const R = G.regions[id], u = UNLOCKS.find((d) => d.id === AREA_OF[id]);
    if (!R || !u || R.unlocked) continue;
    const show = (u.lvl || 1) <= G.level;
    if (show === !R.hidden) continue;
    R.hidden = !show;
    if (id === 'yol') continue; // kaldırım zaten açılınca görünür
    // zemin bölge açılınca gelir (region); seviyesi gelen bölümün kilit yazısı ve haritadaki yeri burada çıkar
    if (show) R.lockLabel = G.labels.add(...R.lockArgs); else G.labels.remove(R.lockLabel);
  }
  setStationRevealed((UNLOCKS.find((d) => d.id === 'e0').lvl || 1) <= G.level, instant);
  applyHints(); // gizli bölgelerin kurulumda eklenen ipuçları da saklanır / açılır
}
// seviye atlayınca: kutlama, para ödülü; o seviyenin bölümleri ortaya çıkar, kamera ilkine döner
function levelUp(lv, old) {
  const fresh = UNLOCKS.filter((u) => u.lvl > old && u.lvl <= lv && needOk(u)); // şartı bitmemiş bölge sonra haber verilir (sart.js)
  revealAreas(false);
  for (const s of G.stations) if (s instanceof UnlockPad && isBolum(s.def)) s.refresh(); // bölüm fiyatları yeni seviyeye göre
  if (!G.nextPad) nextPad(); else sidePads();
  const reward = levelReward(lv);
  if (!G.visit) G.money += reward; // ziyarette komşunun seviye ödülü yardım parasına karışmasın
  banner(`SEVİYE ${lv}`, `⭐ ${titleOf(lv)}`);
  confetti(G.player.position, 90);
  feel('level');
  sfx('level');
  floatText(G.player.position, `⭐ Seviye ödülü +${reward} ₺`, 'pos');
  legendLevel(lv); // efsane olduysa kalıcı gelir bonusu büyür (final.js)
  if (fresh.length) {
    const u = fresh.find((f) => G.nextPad && G.nextPad.def === f) || fresh.find((f) => G.stations.some((s) => s.def === f)); // kamera yalnızca haritada duran yeni pede döner
    if (u) G.camFocus = { pos: V(u.at[0], 0, u.at[1]), until: G.time + 3.2 };
    const open = fresh.filter((f) => G.stations.some((s) => s.def && s.def.id === f.id)); // yalnız kilidi haritada duranlar: sırası gelmeyen bölüm için haber yok
    if (open.length) setTimeout(() => toast(`🗺️ Yeni bölüm: ${open.map((f) => `${f.icon} ${f.title}`).join(' · ')}`), 2400);
  }
  save();
}

// Bisiklet Parkı ve Otopark açılınca kamera iki yeri sırayla gösterir (2026-11-08 kullanıcı: "bisiklet otopark açılınca orayı göstermedi
// göstersin"; eskiden sinematiği yoktu): önce dükkânın yanındaki bisiklet parkı, sonra kasabanın batısındaki otopark. İkisi 55 m arayla
// ayrı yerde, tek arsa çekimi (cinema.js playCinema) ikisini birden göstermez; çekimler cinema.js playShots ile (main.js G.hooks.cineShots)
function kbTour(def) {
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)), mix = (a, b, e) => a.clone().lerp(b, e);
  const bz = (BIKE_ZS[0] + BIKE_ZS[BIKE_ZS.length - 1]) / 2, bikeAt = V(BIKE_X, 0.4, bz), bikeCam = V(BIKE_X + 2.4, 6.4, bz + 7.4);
  const [x0, x1, z0, z1] = LOT.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lotAt = V(cx, 0, cz), lotHi = V(cx + 10, 20, cz + 22), lotLo = V(cx + 2, 12.5, cz + 15);
  const shots = [
    { T: 2.4, at: (u) => [mix(V(bikeCam.x + 5, 13, bikeCam.z + 6), bikeCam, ease(u)), bikeAt] },
    { T: 2.8, at: (u) => { const e = ease(u); return [mix(bikeCam, lotHi, e), mix(bikeAt, lotAt, e)]; } },
    { T: 2.4, at: (u) => [mix(lotHi, lotLo, ease(u)), lotAt] },
  ];
  const info = introInfo(def.id) || {}, st = info.steps || [];
  const caps = st.slice(0, 3).map((s) => [s[0], s[1]]);
  return G.hooks.cineShots({ shots, caps, capStart: 0.6, capLen: 2.5, small: 'YENİ BÖLGE', icon: def.icon, title: def.title, text: info.text || '', onEnd: () => showIntro(def) });
}
// açılış sinematiği (cinema.js) hangi alanı gösterir: kilitle yeni açılan bölge; benzinlik bölge değil, kendi arsası.
// Köy yolu kaldırımı sinematik almaz; bisiklet parkıyla gelen otoparkı kbTour gösterir
function cineTarget(def, fresh) {
  // yeni bölüm (genişletme): kısa çekim, arsanın üstünde süzülüp iş noktalarına bakar (cinema.js mini)
  if (def.expansion) {
    const d = expansionDefs().find((x) => x.id === def.id);
    if (!d) return null;
    const rect = d.rect || [d.at[0] - 4, d.at[0] + 4, d.at[1] - 4, d.at[1] + 4];
    return { rect, title: def.title, icon: def.icon, id: def.id, region: (G.regions[d.region] && G.regions[d.region].name) || '', mini: true };
  }
  if (def.id === 'e0') return { rect: [-84.5, -63.5, -14.8, -1.8], title: def.title, icon: def.icon, id: def.id };
  const id = fresh.find((k) => k !== 'yol' && !(k === 'meydan' && def.id === 'kb'));
  if (!id) return null;
  const R = G.regions[id];
  return { rect: R.rect, title: def.title, icon: def.icon, id: def.id, region: R.name };
}
// kilit açılınca ortak kutlama
function finishUnlock(def) {
  G.unlocked.add(def.id);
  addXp(10 + (def.base ?? def.price) * (isBolum(def) ? bolumKat() : 1) / 25); // kilit açmak da mertebe kazandırır; kademe çarpanı XP'yi büyütmez (fiyat.js)
  if (isBolum(def)) {
    const left = G.stations.filter((s) => s instanceof UnlockPad && isBolum(s.def));
    for (const s of left) s.refresh();
  }
  const before = Object.keys(G.regions).filter((k) => G.regions[k].unlocked);
  def.build(false);
  const fresh = Object.keys(G.regions).filter((k) => G.regions[k].unlocked && !before.includes(k));
  const region = def.id[0] === 'g';
  confetti(V(def.at[0], def.y || 0, def.at[1]), region ? 70 : 46);
  feel(region ? 'region' : 'unlock', V(def.at[0], def.y || 0, def.at[1]));
  banner(say(region ? 'region' : 'unlock').toLocaleUpperCase('tr'), `${def.icon || ''} ${def.title}`);
  sfx(region ? 'region' : 'unlock');
  speak('unlock');
  save();
  // yeni bölge: kutlama afişinden sonra açılış sinematiği, bitince tanıtım kartı
  const cine = cineTarget(def, fresh);
  if (def.id === 'kb' && G.hooks.cineShots) setTimeout(() => { if (!kbTour(def)) showIntro(def); }, 900);
  else if (cine && G.hooks.cinema) setTimeout(() => { if (!G.hooks.cinema({ ...cine, onEnd: () => showIntro(def) })) showIntro(def); }, 900);
  else showIntro(def);
}
// kayıttan: yarım ödenmiş kilitler kaldığı yerden devam eder
let padSave = {};
function resume(pad) { const p = padSave[pad.def.id]; if (p) { pad.paid = Math.min(p, pad.def.price - 1); pad.refresh(); delete padSave[pad.def.id]; } return pad; }
function nextPad() {
  const def = UNLOCKS.find((u) => !u.side && !G.unlocked.has(u.id));
  const ok = def && (def.lvl || 1) <= G.level && needOk(def); // seviye ve bölge şartı (sart.js)
  G.nextWait = def && !ok ? def : null; // sıradaki kilidin seviyesi henüz gelmedi (HUD XP'yi gösterir)
  // hedef kartının çubuğu bekleyişin başladığı seviyeden (sırada bir önceki seviyeli kilit) hedef seviyeye dolar, her seviyede sıfırlanmaz
  if (G.nextWait) {
    let from = 1;
    for (let j = UNLOCKS.indexOf(def) - 1; j >= 0; j--) if (!UNLOCKS[j].side && UNLOCKS[j].lvl) { from = UNLOCKS[j].lvl; break; }
    G.nextWaitFrom = Math.min(from, G.level);
  }
  G.nextPad = ok ? resume(new UnlockPad(padDef(def), () => { finishUnlock(def); nextPad(); })) : null;
  needRefresh();
  sidePads();
}
// yan kilitler (side): ana sıradan bağımsız; şartı (req) açılınca kendi yerinde hep açılmayı bekler,
// sıraya sonradan eklenen kilitler onları geciktirmez
const sideOpen = {};
function sidePads() {
  for (const u of UNLOCKS) {
    if (!u.side || u.retired || G.unlocked.has(u.id) || sideOpen[u.id] || (u.req && !G.unlocked.has(u.req)) || (u.lvl || 1) > G.level || !needOk(u)) continue;
    if (u.stage && G.regions.koy.stage < u.stage) continue; // raf yeri dükkânın henüz açılmamış aşamasında
    sideOpen[u.id] = resume(new UnlockPad(padDef(u), () => { delete sideOpen[u.id]; finishUnlock(u); sidePads(); }));
  }
}

// ---------- deniz ----------
let sea = null;
function buildSea() {
  const t = texRep('water', 40, 20);
  sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, transparent: true, opacity: 0.94 }));
  sea.rotation.x = -PI / 2;
  sea.position.set(15, -0.25, 131);
  enhanceSea(sea); // dalgalar ve kıyıya koşan köpük (sea.js)
  G.scene.add(sea);
  // köpük girintili kıyıyı izler, eni de yer yer değişir (nature.js)
  const foam = new THREE.Mesh(bandGeo(-200, 230, (x) => coastZ(x) - 0.05, (x) => coastZ(x) + 0.85 + 0.4 * wobble(x, 8, [0.3, 0.8], [0.6, 0.4])), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
  foam.position.y = -0.2;
  G.scene.add(foam);
  sea.userData.foam = foam;
}

export function buildWorld(saved) {
  G.fide = saved ? saved.fide || null : {}; // bostanların fide sayısı (game.js PlantBed); eski kayıtta null: açık bostanlar dolu kurulur
  hintToggle(); // bilgi kutuları düğmesi
  buildSea();
  buildSurroundings();
  buildStation(); // ana yolun batı girişinde benzinlik; Bemis şarj üniteleri kilitle açılır (e1, e2)
  buildRoads(); // yollar ve sahil yolu yürünür
  // harita genişletmesi: köyün iki yanında açılan 7 birimlik koridorlar çimenlik ama yürünür (elemanlar ve müşteriler bölgeler
  // arasında dolaşabilsin); köy ile pazar arasında toprak patika
  G.walkways.push([15.6, 23.4, -14.4, 12.4], [14.0, 23.4, -40.4, -14.0], [14.0, 23.4, -68.0, -40.0], [-23.4, -15.6, -16.4, 12.6]);
  strip(G.scene, 19.5, -1.5, 8.6, 2.6, 'path', 3, 0.01);
  buildKoy(); buildPazar(); buildSahil(); buildHan(); buildTarla(); buildMera(); buildMeydan(); buildCiftlik(); buildAtolye(); buildYol(); buildAhir(); buildFirin(); buildTatil(); buildKasaba(); buildEnerji(); buildTarlalar(); buildIskele(); buildLunapark();
  dressWorld(); // süsleme: bayraklar, saksılar, kulübe, kilimler, çiçeklikler (dress.js)
  buildPark(); // e-ticaret ofisinin yerinde çocuk parkı, baştan açık (park.js)
  buildCityGround(); buildSehir(); // şehir: köyün çok uzağında ayrı alan, köyden görünmez (city.js)
  const K = G.regions.koy;
  K.unlocked = true; K.slab.visible = true; K.top.color.set(K.top.userData.open || '#ffffff'); K.content.visible = true;
  G.labels.remove(K.lockLabel);
  for (const c of K.colliders) G.colliders.push(c);
  K.activate(true);
  unlockRegion('kasaba', true); // meydan ve park herkese açık
  if (saved) {
    G.money = saved.money || 0;
    // şehri eski tek kilitle (gc) açmış kayıtta yol ve kira kademeleri de açık sayılır; eski "Market kasiyeri" kilidi (sc5)
    // eleman olarak işe alınmış sayılır (upgrades.js mcashier)
    const had = saved.unlocked || [];
    if (had.includes('gc')) for (const id of ['gc1', 'gc2']) if (!had.includes(id)) had.push(id);
    if (had.includes('sc5')) { saved.upg = saved.upg || {}; if (saved.upg.mcashier == null) saved.upg.mcashier = 1; }
    // pazar tezgâhları 2026-11-06'dan önce kilitsizdi: eski kayıtta domates ve salatalık, kamyonet açıksa biber ve patlıcan da açık sayılır (pzV: game.js saveData)
    if (!saved.pzV && had.includes('gp')) for (const id of ['pt1', 'pt2', ...(had.includes('p1') ? ['pt3', 'pt4'] : [])]) if (!had.includes(id)) had.push(id);
    // eve paket servisi 2026-11-03'te kaldırıldı (kullanıcı: "eve paketi komple kaldır"): açılış, motorlu kurye ve motor hızı parası geri verilir
    if (had.includes('kp')) {
      const u = saved.upg || {}, ky = [390, 780, 1300]; // eski fiyatlar: açılış 600, kurye 780/1560, motor hızı 390/780/1300 (zam ve kademe çarpanı öncesi)
      let back = Math.round((600 * PRICE_K) / 10) * 10;
      for (let n = 0; n < Math.min(u.kurye || 0, 2); n++) {
        back += [780, 1560][n];
        for (let l = 0; l < Math.min(u[`kySpd@${n}`] ?? u.kySpd ?? 0, 3); l++) back += Math.round((ky[l] * PRICE_K * 1.4 ** l) / 10) * 10;
      }
      G.money += back;
      setTimeout(() => toast(`🏠 Eve paket servisi kaldırıldı: ${back.toLocaleString('tr-TR')} ₺ iade edildi`), 3500);
    }
    // e-ticaret ofisi 2026-11-09'da kaldırıldı (kullanıcı: "e ticaret komple kaldır. o alanı değerlendir çocuk parkı olabilir"); yerinde çocuk
    // parkı var (park.js). Açılışın, genişlemelerin, paketçilerin ve geliştirmelerinin bugünkü fiyatı ile kasalarındaki para geri verilir.
    // Eski fiyatlar: açılış 1100 (kademe 8, bölüm çarpanı 8. seviyeden), Sipariş Masası 1800, Ekspres Kargo 3000, Paket Bandı 4400,
    // paketçi 700/1300 (işe alım ×2), kapasite ve hız 250/450/750, sipariş sıklığı 400/800/1400, kargo payı 500/1000/1800
    if (had.includes('ge')) {
      const u = saved.upg || {}, k = tierK(8), r10 = (p) => Math.round(p / 10) * 10, lockP = (p) => nice(r10(r10(p * PRICE_K) * 1.25) * k);
      const step = (c, l) => nice(c * PRICE_K * 1.4 ** l * k);
      let back = Math.round((lockP(1100) * katAt(8)) / 50) * 50;
      for (const [id, p] of [['xkargo1', 1800], ['xkargo2', 3000], ['xkargo3', 4400]]) if (had.includes(id)) back += lockP(p);
      for (let n = 0; n < Math.min(u.packer || 0, 2); n++) {
        back += nice([700, 1300][n] * PRICE_K * 2 * k);
        for (const s of ['pkCap', 'pkSpd']) for (let l = 0; l < Math.min(u[`${s}@${n}`] ?? u[s] ?? 0, 3); l++) back += step([250, 450, 750][l], l);
      }
      for (const [s, c] of [['kgRate', [400, 800, 1400]], ['kgFee', [500, 1000, 1800]]]) for (let l = 0; l < Math.min(u[s] || 0, 3); l++) back += step(c[l], l);
      if (saved.piles) for (const key of ['-486:-72', '-488:-122']) { back += saved.piles[key] || 0; saved.piles[key] = 0; } // masanın kasası ve eski yerdeki kasa
      G.money += back;
      setTimeout(() => toast(`📦 E-ticaret ofisi kaldırıldı, yerinde çocuk parkı var: ${back.toLocaleString('tr-TR')} ₺ iade edildi`), 4500);
    }
    // sıradan bağımsız: listeye sonradan eklenen kilitler eski kayıtları bozmaz
    for (const u of UNLOCKS) {
      if (!saved.unlocked || !saved.unlocked.includes(u.id)) continue;
      G.unlocked.add(u.id);
      u.build(true);
    }
    // eski kayıt: açık rafların yeri dükkânın sonraki aşamasındaysa o aşama kendiliğinden açık sayılır (dukkan-plan.md)
    const KS = G.regions.koy;
    for (const [id, n] of [['kS2', 2], ['kS3', 3]]) {
      if (G.unlocked.has(id) || ![...KS.aisle.pending].some((t) => KS.aisle.stageOf(t) >= n)) continue;
      G.unlocked.add(id); KS.setStage(n, true);
    }
    padSave = { ...(saved.pads || {}) };
    G.pads0 = saved.pads || {}; // rakip tezgâh kilitleri ilk karede buradan okur (rivals.js)
    // bu noktadan önce kurulmuş kilitler (bostanların fide kilitleri) yarım ödemesini geri alır: resume yalnız sonradan kurulanlarda
    // çağrılıyordu, fideye dökülen para yenilemede kayboluyordu (2026-11-10 denetimi)
    for (const s of G.stations) if (s instanceof UnlockPad && s.def && padSave[s.def.id] > 0) resume(s);
    // kaldırılan bölümlerin (e-ticaret, kargo) yarım ödemesi oyuncuya döner
    for (const id of ['ge', 'kp', 'xkargo1', 'xkargo2', 'xkargo3']) if (padSave[id] > 0) { G.money += padSave[id]; delete padSave[id]; }
    // toplanmamış para yığınları yerinde durur (komşu ziyaretinde değil: komşunun kasasındaki para onun kaydında duruyor; ziyaretçi
    // toplayıp "yardım" diye geri gönderince ikiye katlanıyordu)
    if (saved.piles && !G.visit) for (const s of G.stations) if (s instanceof MoneyPile && saved.piles[pileKey(s)] > 0) { s.add(saved.piles[pileKey(s)], s.base.position); saved.piles[pileKey(s)] = 0; }
    // yeri değişen kasaların kayıttaki parası yeni kasaya: deniz bisikleti kiralamanın dere kenarındaki kasası (54,9/21,6) 2026-11-03'te büfeye katıldı
    const MOVED_PILES = { '549:216': () => G.regions.sahil && G.regions.sahil.pile, '493:8': () => G.regions.pazar && G.regions.pazar.pile, '498:24': () => G.regions.pazar && G.regions.pazar.pile }; // pazar kasası 2026-11-06'da U düzeninde, 2026-11-09'da kuzey sıranın ucuna taşındı
    if (saved.piles && !G.visit) for (const [k, to] of Object.entries(MOVED_PILES)) { const P = to(); if (P && saved.piles[k] > 0) { P.add(saved.piles[k], P.base.position); saved.piles[k] = 0; } }
  }
  // mertebe: kayıttaki XP (eski kayıtta açık bölümlerin seviyesi garanti); seviyesi gelmeyen bölümler gizlenir
  initLevel(saved, Math.max(1, ...UNLOCKS.filter((u) => G.unlocked.has(u.id)).map((u) => u.lvl || 1)));
  G.hooks.levelUp = levelUp;
  G.hooks.padsCheck = () => { if (!G.nextPad) nextPad(); else sidePads(); };
  needInit(UNLOCKS);
  revealAreas(true);
  nextPad();
  buildPets({ walkable }); // meydanda, köyde ve pazarda kediler, köpekler (pets.js)
  dressSections(); // on bölümün ayrıntıları: tabelalar, eşyalar, develer, martılar (detay.js)
  if (!G.fide) { G.fide = {}; for (const s of G.stations) if (s instanceof PlantBed && s.fide) G.fide[s.key] = s.plants.length; } // eski kayıt: bundan sonra fide sayısı kayda geçer
}

// menü için: toplam kilit sayısı ve açık bölgeye ışınlanma
export const unlockLeft = () => UNLOCKS.filter((u) => !u.retired && !G.unlocked.has(u.id)); // oyun sonu: açılmayı bekleyen kilitler (final.js)
export const unlockTotal = () => UNLOCKS.filter((u) => !u.retired || G.unlocked.has(u.id)).length; // emekli kilit yalnız açmış olanda sayılır
const ENTRY = { lunapark: LP_ENTRY, koy: [0, 0, -2], pazar: [31, 0, -2.2], sahil: [31, 0, 24], han: [0, 0, -33], tarla: [-25, 0, 2.5], mera: [-25.5, 0, 17], atolye: [-48, 0, 23.6], ciftlik: [37.7, 0, -18.4], atlar: [-45, 0, 6.2], firin: [-2, 0, -20.6], tatil: [73, 0, 12.4], kasaba: [-45.5, 0, -24.4], enerji: [-73.6, 0, -58.4], tarlalar: [36.0, 0, -41.0], iskele: [-38.6, 0, 31.6], sehir: CITY.entry };
export const regionEntry = (id) => ENTRY[id]; // bölgenin girişi (upgrades.js bölüm görevlisinin durduğu yer)
export function teleportTo(id) {
  const R = G.regions[id];
  if (!R || !R.unlocked) return false;
  G.player.position.set(...ENTRY[id]);
  return true;
}
// menüden "Oraya git": karakter bölgenin girişine kendi koşar (main.js G.hooks.goTo, autorun.js); yol bulunamazsa (şehir gibi
// ayrı alan) ışınlanır. 'run', 'tp' ya da false döner
export function goToRegion(id) {
  const R = G.regions[id];
  if (!R || !R.unlocked) return false;
  // adadayken (ya da gemi yolundayken) gidilmez: köye dönüş gemiyle olur (mayo, tatil keyfi ve harita tatil.js'in dönüşünde toparlanır)
  if (G.player.position.x > 700 || G.world === 'ada') { toast('🚢 Adadan köye gemiyle dönülür: tatil keyfi barındaki gemi düğmesine bas'); return false; }
  const e = ENTRY[id];
  if (!e) return false;
  if (G.hooks.goTo && G.hooks.goTo(e[0], e[2])) return 'run';
  return teleportTo(id) ? 'tp' : false;
}

// kişiselleştirme: tabela adı, tente/duvar rengi, oyuncu kıyafeti
export function applyCustom() {
  const c = G.custom, K = G.regions.koy;
  const st = M.shopStyle(K.shop.userData.stage, c), was = K.shop.userData.style;
  if (was && Object.keys(st).some((k) => st[k] !== was[k])) K.restyle(); else M.paintShop(K.shop, c); // biçim değiştiyse bina yeniden kurulur
  // adlar temizlenir: içe aktarılan (başkasının paylaştığı) kayıttaki HTML işaretleri menü, raf takip ve albümde sayfaya giriyordu
  const tidy = (s, n) => String(s || '').replace(/[<>&"'`]/g, '').slice(0, n);
  c.name = tidy(c.name, 24); if (c.player != null) c.player = tidy(c.player, 24);
  K.name = c.name || 'Köy Bakkalı';
  const m = new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.85 });
  for (const s of G.player.userData.shirtMeshes) s.material = m;
  // oyuncunun adı başının üstünde (Özelleştir → Karakterinin adı); elemanların ad etiketiyle aynı görünüm, biraz daha belirgin
  const nm = (c.player || '').trim();
  if (nm && !playerTag) { const el = document.createElement('div'); el.className = 'staff me'; el.setAttribute('translate', 'no'); playerTag = { el, h: G.labels.add(el, (v) => v.copy(G.player.position).setY(G.player.position.y + 2.3)) }; }
  if (playerTag) { playerTag.el.textContent = nm ? `⭐ ${nm}` : ''; playerTag.el.style.display = nm ? '' : 'none'; }
}
let playerTag = null;

export function updateWorld(dt) {
  for (const id in G.regions) { const R = G.regions[id]; if (R.unlocked && R.update) R.update(dt); }
  updateFlock(dt); // mera kilitliyken de koyunlar otlar
  updateStation(dt);
  updateThief(dt); // arada bir para yığınına hırsız gelir
  updateChicks(dt); // tavukların peşinde civcivler
  updatePets(dt); // kediler ve köpekler: gezinir, uyur, güvercin ve kedi kovalar
  updateFinal(dt); // oyun sonu: son görev, bütün kilitler açılınca sinematik tur (final.js)
  updateAlbum(dt); // koleksiyon albümü ve haftalık etkinlik (album.js)
  updateDetay(dt); // bölüm ayrıntılarının küçük hareketleri
  updateTepki(dt); // bankta sohbet edenler (tepki.js)
  updateOperators(dt); // makinelerin başındaki çalışanlar (calisan.js)
  updateLevel(); // XP: satış, müşteri, başarım
  nameAreas(dt); // açılış kilidi gelmeyen bölümün adı yazmaz (kilit yazısı, harita)
  // kıyı z ≈ 31.6: yaklaştıkça dalga sesi açılır (z 28'de tam, 14'te sessiz)
  setAmbience(G.player.position.x > 300 && G.player.position.x < 700 ? 0 : THREE.MathUtils.clamp((G.player.position.z - 14) / 14, 0, 1)); // şehirde (x 300-700) deniz yok
  updateAmbience(dt); // bölgelerin arka plan sesleri, sınırlarda yumuşak geçiş
  updateBirds(dt); // gökyüzünde kuş sürüleri, deniz üstünde martılar
  updateFlags(G.time, G.player.position); // kule bayrakları rüzgârda dalgalanır (uzaktakiler durur)
  updateRating(dt); // mahalle memnuniyeti: puanın yavaş dönüşü ve üstteki yıldız göstergesi
  updateAlerts(dt); // eksik bildirimleri (boş raf, bekleyen müşteri, boşta makine) ve yönlendirme oku
  updateRafTakip(dt); // raf takip sistemi (alınmışsa): haritanın üstünde 📋 düğmesi ve raf tablosu
  updateServices(dt); // avatar işareti, uzak istek müşterileri, banka
  updateSurroundings(dt);
  if (sea) { sea.material.map.offset.x += dt * 0.01; sea.material.map.offset.y += dt * 0.006; sea.userData.foam.material.opacity = 0.55 + Math.sin(G.time * 1.6) * 0.2; }
  G.shout.t = Math.max(0, G.shout.t - dt);
  G.shout.cool = Math.max(0, G.shout.cool - dt);
}

// BAĞIR'ın anlık etkisi: 20 m içinden geçen müşterilerin her biri %60 olasılıkla dönüp malı olan tezgahına gelir (en çok 3).
// İstediği ürün tezgahta varsa ona, yoksa sana en yakın dolu tezgaha. Üstünde ❗ çıkar: bağırmanın işe yaradığı görünsün
function shoutLure() {
  const P = G.regions.pazar, p = G.player.position;
  if (!P || !P.stalls) return 0;
  const far = (q) => Math.hypot(q.x - p.x, q.z - p.z);
  const open = () => P.stalls.filter((s) => s.count() > 0 && s.spots.some((x) => !x.c));
  const near = G.customers.filter((c) => c.region === 'pazar' && c.lure && far(c.obj.position) < 20).sort((a, b) => far(a.obj.position) - far(b.obj.position));
  let n = 0;
  for (const c of near) {
    const list = open();
    if (n >= 3 || !list.length) break;
    if (Math.random() > 0.6) continue;
    const sh = list.find((s) => s.type === c.want) || list.sort((a, b) => far(a.zone) - far(b.zone))[0];
    if (c.lure(sh)) { n++; floatText(c.obj.position, '❗', 'pos'); }
  }
  return n;
}
export function doShout() {
  if (G.shout.cool > 0) return false;
  G.shout.t = 6; G.shout.cool = 14;
  floatText(G.player.position, say('shout'), 'shout');
  shoutLure();
  ring(G.player.position, '#ffe14d', 6);
  if (!speak('shout')) sfx('shout'); // pazarcı sesi çıktıysa ayrıca vızıltı çalmaz
  bounce(G.player, 0.2);
  return true;
}
