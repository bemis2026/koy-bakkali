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

/**
 * R: bölge. o: {
 *   content, put(parent, obj, x, y, z, ry), rcol(R, x0, x1, z0, z1),
 *   places: { tür: [x, z, yön, genişlik?] }   yön 1: önü güneye (+z), -1: önü kuzeye
 *   w (varsayılan genişlik), y (zemin yüksekliği), my (alan yüksekliği), back (arka çarpışma derinliği; sayı ya da back(tür)),
 *   tiers(tür) (kat sayısı; yalnız arkası boş raflar), tagColor, place (dest.js yeri), onAdd(raf),
 *   stageOf(tür) ve stage() (köy dükkânı aşamaları: yeri açılmamış raf A.pending'de bekler), look() (görünüm tabanı 1-3)
 * }
 */
export function makeAisle(R, o) {
  R.shelves = R.shelves || []; R.shelfByType = R.shelfByType || {};
  // stageOf(tür)/stage(): yeri dükkânın henüz açılmamış aşamasındaki raf beklemeye alınır (pending), aşama açılınca kurulur
  const A = { list: [], places: o.places, pending: new Set(), stageOf: o.stageOf || (() => 1) };
  A.ensure = (type, instant) => {
    if (R.shelfByType[type]) return R.shelfByType[type];
    const at = A.places[type];
    if (!at || !ITEMS[type]) { console.warn('raf yeri yok', type); return null; }
    if (o.stage && A.stageOf(type) > o.stage()) { A.pending.add(type); return null; }
    A.pending.delete(type);
    const [x, z, face = 1, wide] = at, w = wide || o.w || 2.0, kind = kindOf(type);
    const cols = Math.max(2, Math.round((w - 0.2) / STEP)), y = o.y ?? 0.2;
    const unit = kind === 'fridge' && !o.shallow ? M.makeFridge(w) : M.makeShelfUnit(w, kind); // shallow: duvarsız yerde sığ soğutucu (1 m)
    o.put(o.content, unit, x, y, z, face > 0 ? 0 : Math.PI);
    if (!instant) popIn(unit);
    const slots = narrowSlots(0, cols);
    M.addShelfMarkers(unit, slots, kind);
    const col = typeof o.tagColor === 'function' ? o.tagColor(type) : o.tagColor;
    const tag = makeTag(ITEMS[type].name.toLocaleUpperCase('tr'), [type], col || '#4f9a3f', Math.min(w - 0.12, 2.1), 0.4);
    tag.position.set(0, 0.5, 0.512); unit.add(tag);
    // çarpışma: önü 0,55; arkası duvara ya da sırt sırta rafa kadar
    const back = (typeof o.back === 'function' ? o.back(type) : o.back) ?? 0.55, z0 = face > 0 ? z - back : z - 0.55, z1 = face > 0 ? z + 0.55 : z + back;
    const box = o.rcol(R, x - w / 2 - 0.13, x + w / 2 + 0.13, z0, z1); // komşu rafın kutusuna değer: aradan sıkışıp geçilmez
    const sh = new Shelf({ zx: x, zz: z + face * 1.4, zw: w, zd: o.zd ?? 1.1, my: o.my ?? 0.26, accepts: [type], cap: slots.length, group: unit, slots,
      spots: (w >= 1.85 ? [-0.5, 0.5] : [0]).map((dx) => V(x + dx, y, z + face * 1.3)), instant }); // geniş rafın (köy dükkânında 1,9 m) önünde iki müşteri
    sh.type = type; sh.tiers = 1; sh.faceY = face > 0 ? Math.PI : 0; sh.unit = unit; sh.box = box;
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
      if (face > 0) box[2] = Math.min(box[2], sh.unit.position.z - 0.55 - (sh.tiers - 1) * M.TIER_STEP); // relayout rafı kaydırmış olabilir
      sh.applyLook();
    };
    const t0 = o.tiers ? o.tiers(type) : 1;
    if (t0 > 1) sh.setTiers(t0, true); else sh.applyLook();
    R.shelves.push(sh); R.shelfByType[type] = sh; A.list.push(sh);
    if (o.onAdd) o.onAdd(sh);
    return sh;
  };
  // yerleşim değişince (köy dükkânı büyüyüp raflar yayılınca, sıralar arası açılınca) kurulu raflar yeni yerlerine kayar: gövde,
  // ürünler, etiket, müşterinin durduğu yerler ve çarpışma kutusu birlikte (yol ızgarası kutu değişince kendiliğinden yenilenir)
  A.relayout = (places) => {
    if (places) A.places = places;
    for (const sh of A.list) {
      const at = A.places[sh.type];
      if (!at) continue;
      const dx = at[0] - sh.unit.position.x, dz = at[1] - sh.unit.position.z;
      if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) continue;
      sh.unit.position.x += dx; sh.unit.position.z += dz; sh.unit.updateMatrixWorld(true);
      sh.zone.x += dx; sh.zone.z += dz;
      for (const s of sh.spots) { s.p.x += dx; s.p.z += dz; }
      if (sh.box) { sh.box[0] += dx; sh.box[1] += dx; sh.box[2] += dz; sh.box[3] += dz; }
    }
  };
  return A;
}
