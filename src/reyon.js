// Tek ürünlü raflar (reyonlar): her ürünün kendi rafı olur, bir rafta iki farklı ürün durmaz (raf-plan.md).
// Bir yer, ürünlerin raf yerlerini önceden belirler (places); ürün orada satılabilir olunca ensure(type) o yere rafı kurar.
// Her raf ayrı bir Shelf: kendi bırakma alanı, müşteri yeri, ürün resimli etiketi ve çarpışma kutusu. Raflar R.shelves ve
// R.shelfByType'a eklenir: müşteri, rafçı ve teslimat kodu her rafı ayrı görür.
import * as THREE from 'three';
import { ITEMS, Shelf, popIn } from './game.js';
import * as M from './models.js';
import { makeTag } from './tags.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const STEP = 0.62; // yerler arası: bir ürün genişliği
// dar raf katı: cols sütun × 2 sıra; her kat bir basamak geride ve yukarıda (models.js shelfSlots gibi)
export function narrowSlots(t, cols) {
  const a = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < cols; i++) a.push(V((i - (cols - 1) / 2) * STEP, 0.97 + t * 0.42, 0.2 - j * 0.42 - t * M.TIER_STEP));
  return a;
}
// raf türü: sebze kasası, viyol ve örtülü fırın rafı, soğutucu ya da tahta raf
const KIND = {
  domates: 'produce', salatalik: 'produce', karpuz: 'produce', biber: 'produce', patlican: 'produce', lahana: 'produce', balkabagi: 'produce',
  elma: 'produce', portakal: 'produce', limon: 'produce', aycicek: 'produce',
  yumurta: 'eggs', ekmek: 'eggs', simit: 'eggs', pogaca: 'eggs', pide: 'eggs', tost: 'eggs',
};
const FRIDGE = new Set(['sut', 'peynir', 'yogurt', 'ksut', 'meyvesuyu', 'karpuzsuyu']);
export const kindOf = (t) => (FRIDGE.has(t) ? 'fridge' : KIND[t] || 'wood');
// rafın önü (yön): 1 güney (+z), -1 kuzey, 2 doğu (+x), -2 batı. Yan kenara dayalı raf (köy dükkânının L düzeni) doğuya ya da batıya bakar
export const faceDir = (f) => (f === 2 ? [1, 0] : f === -2 ? [-1, 0] : [0, f < 0 ? -1 : 1]);

/**
 * R: bölge. o: {
 *   content, put(parent, obj, x, y, z, ry), rcol(R, x0, x1, z0, z1),
 *   places: { tür: [x, z, yön, genişlik?, aşama?, arka?] }   yön 1: önü güneye (+z), -1: kuzeye, 2: doğuya, -2: batıya (faceDir)
 *   w (varsayılan genişlik), y (zemin yüksekliği), my (alan yüksekliği), back (arka çarpışma derinliği; sayı ya da back(tür)),
 *   tiers(tür) (kat sayısı; yalnız arkası boş raflar), tagColor, place (dest.js yeri), onAdd(raf),
 *   stageOf(tür) ve stage() (köy dükkânı aşamaları: yeri açılmamış raf A.pending'de bekler), look() (görünüm tabanı 1-3)
 * }
 */
export function makeAisle(R, o) {
  R.shelves = R.shelves || []; R.shelfByType = R.shelfByType || {};
  // stageOf(tür)/stage(): yeri dükkânın henüz açılmamış aşamasındaki raf beklemeye alınır (pending), aşama açılınca kurulur
  const A = { list: [], places: o.places, pending: new Set(), stageOf: o.stageOf || (() => 1) };
  // yerin geometrisi: gövdenin dönüşü, çarpışma kutusu (önü 0,55; arkası duvara ya da sırt sırta rafa kadar, komşu rafın kutusuna değer:
  // aradan sıkışıp geçilmez), bırakma alanı ve müşterinin durduğu yerler. Yana bakan rafta en ile derinlik yer değiştirir
  const geo = (type, at) => {
    const [x, z, face = 1, wide] = at, w = wide || o.w || 2.0, [fx, fz] = faceDir(face), side = fx !== 0, y = o.y ?? 0.2;
    const back = at[5] ?? (typeof o.back === 'function' ? o.back(type) : o.back) ?? 0.55, hw = w / 2 + 0.13, zd = o.zd ?? 1.1;
    const lo = (c, f) => (f > 0 ? c - back : c - 0.55), hi = (c, f) => (f > 0 ? c + 0.55 : c + back), r = Math.atan2(fx, fz);
    return { x, z, w, fx, fz, r, faceY: r > 0 ? r - Math.PI : r + Math.PI, // faceY: müşteri rafa dönük (güneye bakan rafa kuzeye)
      box: side ? [lo(x, fx), hi(x, fx), z - hw, z + hw] : [x - hw, x + hw, lo(z, fz), hi(z, fz)],
      zone: [x + fx * 1.4, z + fz * 1.4, side ? zd : w, side ? w : zd],
      spots: (w >= 1.85 ? [-0.5, 0.5] : [0]).map((d) => V(x + fx * 1.3 + (side ? 0 : d), y, z + fz * 1.3 + (side ? d : 0))) }; // geniş rafın önünde iki müşteri
  };
  // katlar arkaya doğru basamaklanır: kutunun arka kenarı da uzar
  const tierBack = (sh) => {
    const g = sh.geo, p = sh.unit.position, e = 0.55 + (sh.tiers - 1) * M.TIER_STEP, b = sh.box;
    if (g.fz > 0) b[2] = Math.min(b[2], p.z - e); else if (g.fz < 0) b[3] = Math.max(b[3], p.z + e);
    else if (g.fx > 0) b[0] = Math.min(b[0], p.x - e); else b[1] = Math.max(b[1], p.x + e);
  };
  A.ensure = (type, instant) => {
    if (R.shelfByType[type]) return R.shelfByType[type];
    const at = A.places[type];
    if (!at || !ITEMS[type]) { console.warn('raf yeri yok', type); return null; }
    if (o.stage && A.stageOf(type) > o.stage()) { A.pending.add(type); return null; }
    A.pending.delete(type);
    const g = geo(type, at), { x, z, w } = g, kind = kindOf(type);
    const cols = Math.max(2, Math.round((w - 0.2) / STEP)), y = o.y ?? 0.2;
    const unit = kind === 'fridge' && !o.shallow ? M.makeFridge(w) : M.makeShelfUnit(w, kind); // shallow: duvarsız yerde sığ soğutucu (1 m)
    o.put(o.content, unit, x, y, z, g.r);
    if (!instant) popIn(unit);
    const slots = narrowSlots(0, cols);
    M.addShelfMarkers(unit, slots, kind);
    const col = typeof o.tagColor === 'function' ? o.tagColor(type) : o.tagColor;
    const tag = makeTag(ITEMS[type].name.toLocaleUpperCase('tr'), [type], col || '#4f9a3f', Math.min(w - 0.12, 2.1), 0.4);
    tag.position.set(0, 0.5, 0.512); unit.add(tag);
    const box = o.rcol(R, ...g.box);
    const sh = new Shelf({ zx: g.zone[0], zz: g.zone[1], zw: g.zone[2], zd: g.zone[3], my: o.my ?? 0.26, accepts: [type], cap: slots.length, group: unit, slots,
      spots: g.spots, instant });
    sh.type = type; sh.tiers = 1; sh.faceY = g.faceY; sh.geo = g; sh.builtW = w; sh.unit = unit; sh.box = box;
    // raf doluyken müşteri önünde biraz geride bekler (güneye bakan rafın önü geniş, kuzeye bakanınki dar)
    sh.waitAt = () => { const q = sh.geo, k = q.fz > 0 ? 2.2 : q.fz < 0 ? 0.9 : 1.6, j = Math.random() * 2 - 1; return V(sh.zone.x + q.fx * k + (q.fx ? 0 : j), 0, sh.zone.z + q.fz * k + (q.fx ? j : 0)); };
    // görünüm kademesi (dukkan-plan.md): yerin tabanı (köyde dükkân aşaması, şehirde 3) + kendi kat büyütmesi
    sh.applyLook = () => { M.setLook(unit, Math.max(1, Math.min(3, (o.look ? o.look() : 3) + (sh.tiers >= 3 ? 1 : 0)))); M.placeHeader(unit, sh.tiers); };
    if (o.place) sh.place = o.place;
    // raf büyütme: her kat cols × 2 yer ekler, kat geriye doğru basamaklanır (yalnız arkası boş raflarda)
    sh.setTiers = (n, inst) => {
      while (sh.tiers < n) {
        const t = sh.tiers, tier = M.addShelfTier(unit, t, kind, w);
        if (!inst) popIn(tier);
        const sl = narrowSlots(t, cols);
        M.addShelfMarkers(unit, sl, kind);
        sh.addSlots(sl);
        sh.tiers++;
      }
      tierBack(sh); // relayout rafı kaydırmış olabilir
      sh.applyLook();
    };
    const t0 = o.tiers ? o.tiers(type) : 1;
    if (t0 > 1) sh.setTiers(t0, true); else sh.applyLook();
    R.shelves.push(sh); R.shelfByType[type] = sh; A.list.push(sh);
    if (o.onAdd) o.onAdd(sh);
    return sh;
  };
  // yerleşim değişince (köy dükkânı büyüyünce raflar duvar boyunca yeniden dizilir) kurulu raflar yeni yerlerine kayar ve döner: gövde,
  // ürünler, etiket, bırakma alanı, müşterinin durduğu yerler ve çarpışma kutusu birlikte (yol ızgarası kutu değişince kendiliğinden
  // yenilenir). Yeni yer biraz dar ya da genişse gövde enine o kadar daralır/genişler (eski kayıttaki 2 m'lik raf 1,9 m'lik yerde)
  A.relayout = (places) => {
    if (places) A.places = places;
    for (const sh of A.list) {
      const at = A.places[sh.type];
      if (!at) continue;
      const g = geo(sh.type, at), u = sh.unit, sx = g.w / (sh.builtW || g.w);
      if (Math.abs(g.x - u.position.x) < 0.01 && Math.abs(g.z - u.position.z) < 0.01 && Math.abs(g.r - u.rotation.y) < 0.01 && Math.abs(sx - u.scale.x) < 0.01) continue;
      u.position.x = g.x; u.position.z = g.z; u.rotation.y = g.r; u.scale.x = sx; u.updateMatrixWorld(true);
      Object.assign(sh.zone, { x: g.zone[0], z: g.zone[1], w: g.zone[2], d: g.zone[3] });
      sh.spots.forEach((s, i) => s.p.copy(g.spots[Math.min(i, g.spots.length - 1)]));
      if (sh.box) { for (let i = 0; i < 4; i++) sh.box[i] = g.box[i]; }
      sh.geo = g; sh.faceY = g.faceY;
      if (sh.box) tierBack(sh);
      sh.bodyN = -1; // istasyon gövdesi yeniden kurulsun (game.js Station.bodyRects)
    }
  };
  return A;
}
