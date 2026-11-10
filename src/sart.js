// Yeni bölge açılış şartları (2026-11-06 kullanıcı: "hemen semt pazarı açmaya geçiyoruz, onun yerine biraz daha bakkalı büyütmemiz
// gereksin ... o açılan bölümü biraz yaşayalım"). Seviye şartından ayrıdır: seviye fiyat kademesini de belirler (world.js TIER_LV),
// bu liste yalnız kilidin çıkmasını geciktirir. Bölge kilidi, listesindeki işler bitmeden haritada çıkmaz; hedef kartı ilk bitmemiş işi yazar.
// u: o kilit açılmış olmalı; hire: eleman işe alınmış olmalı; up: o yükseltme en az lv basamağında (varsayılan 1); earn: o bölgenin kasasına giren para (satış anında sayılır, game.js MoneyPile.add).
// Sıra önemli: listedeki kilit, beklediği bölgeden sonra gelen bir kilide bağlı olamaz (ana sıra tıkanır)
import * as THREE from 'three';
import { G, toast, sfx } from './game.js';
import { placeName } from './dest.js';

export const NEEDS = {
  gp: [{ u: 'k4' }, { u: 'k6' }, { up: 'rk_koy' }, { hire: 'cashier' }, { hire: 'shelver' }, { earn: 'koy', n: 3000 }], // Semt Pazarı: önce bakkal büyür (3. domates sırası yerine raf kapasitesi, 2026-11-08)
  kk: [{ hire: 'vendor' }, { earn: 'pazar', n: 1000 }], // Çiftlik: pazar bir süre çalışsın
  kb: [{ u: 'k7' }, { earn: 'koy', n: 4500 }], // Meydan
  gs: [{ u: 'kS2' }, { hire: 'ka_pazar' }, { earn: 'pazar', n: 3500 }], // Sahil: dükkân büyümüş, pazarın kasası oturmuş olmalı
  kc: [{ earn: 'sahil', n: 1500 }],
  gh: [{ u: 'lt1' }, { earn: 'sahil', n: 4000 }], // Han
  gk: [{ u: 'xhan1' }, { earn: 'han', n: 3000 }], // Tatil köyü
  gm: [{ earn: 'sahil', n: 800 }], // Mera
  m2: [{ u: 'm1' }], // Dokuma: önce mera çalışsın
  gb: [{ u: 's2' }, { earn: 'sahil', n: 3000 }], // İskele
  gt: [{ earn: 'koy', n: 7000 }], // At ahırı
  e0: [{ earn: 'koy', n: 9000 }], // Benzinlik
  gf: [{ earn: 'han', n: 1200 }], // Fırın
  gy: [{ u: 'km' }, { earn: 'pazar', n: 6000 }], // Büyük tarlalar
  gw: [{ u: 'e2' }, { u: 'e1' }], // Enerji parkı
  gc1: [{ u: 'kS3' }, { earn: 'koy', n: 20000 }], // Şehir yolu
};
const WHERE = { koy: 'Bakkalda', pazar: 'Pazarda', sahil: 'Büfede', han: 'Handa' };
const HIRE = { cashier: 'Kasiyer', shelver: 'Rafçı', vendor: 'Tezgahçı', ka_pazar: 'Pazar kasadarı' };
const HIRE_TAB = { cashier: 'Köy', shelver: 'Köy', vendor: 'Semt Pazarı', ka_pazar: 'Semt Pazarı' };
const UPN = { rk_koy: ['📦', 'Köy raflarını büyüt', 'Köy'] }; // up şartı: simge, hedef kartındaki yazı, Yükselt menüsünün sekmesi
const tl = (n) => Math.ceil(n).toLocaleString('tr-TR');

let defs = [], ready = false, seen = new Set(), tk = 0;
const padOf = (id) => G.stations.find((s) => s.def && s.def.id === id);
const have = (q) => (G.stats.regEarn && G.stats.regEarn[q.earn]) || 0;
const met = (q) => (q.u ? G.unlocked.has(q.u) : q.hire ? (G.upg[q.hire] || 0) > 0 : q.up ? (G.upg[q.up] || 0) >= (q.lv || 1) : have(q) >= q.n);

// kayıt yüklenirken (G.upg, G.stats daha gelmemişken) şartlı kilit çıkmaz; needsReady sonra açar
export function needOk(def) {
  const L = NEEDS[def.id];
  if (!L) return true;
  return ready && ((G.stats.needWaived || []).includes(def.id) || L.every(met));
}
export function needInit(unlocks) { defs = unlocks; }

function view(w, q) {
  const small = `🔒 ${(w.lvl || 1) <= G.level ? w.title : 'Yeni bölüm'} için`;
  if (q.u) {
    const d = defs.find((u) => u.id === q.u), pad = padOf(q.u), left = Math.max(1, pad ? pad.def.price - pad.paid : d.price);
    return { key: `u:${q.u}`, icon: d.icon || '🎯', text: d.title, small, sub: 'Haritadaki arsada açılır', frac: Math.min(1, G.money / left), right: `${tl(left)} ₺`, ready: !!pad && G.money >= left };
  }
  if (q.hire) {
    const c = G.hooks.upgCost ? G.hooks.upgCost(q.hire) : null;
    return { key: `h:${q.hire}`, icon: '👷', text: `${HIRE[q.hire]} işe al (Yükselt)`, small, sub: `Yükselt · ${HIRE_TAB[q.hire]}`, frac: c ? Math.min(1, G.money / c) : 0, right: c ? `${tl(c)} ₺` : '', ready: c != null && G.money >= c };
  }
  if (q.up) {
    const c = G.hooks.upgCost ? G.hooks.upgCost(q.up) : null, [ic, tx, tab] = UPN[q.up] || ['⬆️', q.up, 'Köy'];
    return { key: `p:${q.up}`, icon: ic, text: `${tx} (Yükselt)`, small, sub: `Yükselt · ${tab}`, frac: c ? Math.min(1, G.money / c) : 0, right: c ? `${tl(c)} ₺` : '', ready: c != null && G.money >= c };
  }
  const a = have(q);
  return { key: `e:${q.earn}:${q.n}`, icon: '💰', text: `${WHERE[q.earn]} ${tl(q.n)} ₺ kazan`, small, sub: `${tl(Math.min(a, q.n))} / ${tl(q.n)} ₺`, frac: Math.min(1, a / q.n), right: `${tl(Math.max(0, q.n - a))} ₺`, ready: false };
}
// menülerdeki liste: bitenler ✓ ile
export function needRows(def) {
  return (NEEDS[def.id] || []).map((q) => { const r = view(def, q), done = met(q); return { ...r, done, sub: done ? 'Tamam' : r.sub }; });
}
// ok ve küçük harita: kilidin yeri ya da kazanılacak bölgenin kasası. Kasa boşken de oyuncu o bölgenin dışındaysa ok kasayı
// gösterir (eskiden ok hiç çıkmıyor, nereye gidileceği belli olmuyordu; 2026-11-10 denetimi); bölgenin içindeyken boş kasaya ok yok
function target(q) {
  if (q.u) return padOf(q.u) || null;
  if (!q.earn) return null;
  const R = G.regions[q.earn], P = R && R.pile;
  if (!P || !P.zone) return null;
  return P.amount >= 1 || (G.player && placeName(G.player.position) !== q.earn) ? { zone: P.zone, def: { at: [P.zone.x, P.zone.z] } } : null;
}
export function needRefresh() {
  const w = !G.nextPad && G.nextWait, L = w && ready && !needOk(w) ? NEEDS[w.id] : null, q = L && L.find((x) => !met(x));
  G.needGoal = q ? view(w, q) : null;
  G.needPad = q ? target(q) : null;
}

const regOf = (p) => {
  if (p.regId !== undefined) return p.regId;
  for (const id in G.regions) { const R = G.regions[id]; if (R.pile === p || R.pile2 === p) return (p.regId = id); }
  return (p.regId = placeName(p.zone));
};
function onEarn(pile, amount) {
  const id = regOf(pile);
  if (id) G.stats.regEarn[id] = (G.stats.regEarn[id] || 0) + amount;
}

// kayıt ve elemanlar yüklendikten sonra (main.js). Eski kayıtta bölge bazında sayaç yok: açık bölgeler toplam kazançla başlar, o an haritada
// duran bölge kilidi şartsız kalır (oyuncunun gördüğü kilit kaybolmasın). Parası yarım ödenmiş kilit de kaybolmaz (kayıttaki pads)
export function needsReady(saved) {
  const st = G.stats;
  if (saved && !(saved.stats && saved.stats.regEarn)) {
    st.regEarn = {};
    for (const id in G.regions) if (G.regions[id].unlocked) st.regEarn[id] = st.earned || 0;
    const main = defs.find((u) => !u.side && !G.unlocked.has(u.id));
    st.needWaived = defs.filter((u) => NEEDS[u.id] && !G.unlocked.has(u.id) && (u.lvl || 1) <= G.level && (u.side ? !u.req || G.unlocked.has(u.req) : u === main)).map((u) => u.id);
  }
  if (saved && saved.pads) for (const id in saved.pads) if (NEEDS[id] && saved.pads[id] >= 1 && !(st.needWaived || []).includes(id)) (st.needWaived = st.needWaived || []).push(id);
  ready = true;
  G.hooks.earn = onEarn;
  for (const u of defs) if (NEEDS[u.id] && needOk(u)) seen.add(u.id);
  G.hooks.padsCheck();
  needRefresh();
}
// şart bitince kilit çıkar: kamera döner, haber verilir (seviyesi henüz gelmediyse seviye atlayınca world.js levelUp söyler)
export function needTick(dt) {
  if (!ready || (tk -= dt) > 0) return;
  tk = 0.4;
  const fresh = defs.filter((u) => NEEDS[u.id] && !seen.has(u.id) && !G.unlocked.has(u.id) && needOk(u));
  if (fresh.length) {
    for (const u of fresh) seen.add(u.id);
    G.hooks.padsCheck();
    const open = fresh.filter((u) => padOf(u.id));
    if (open.length) {
      const at = open[0].at;
      G.camFocus = { pos: new THREE.Vector3(at[0], 0, at[1]), until: G.time + 3.2 };
      toast(`🗺️ Yeni bölüm: ${open.map((u) => `${u.icon} ${u.title}`).join(' · ')}`);
      sfx('level');
    }
  }
  needRefresh();
}
