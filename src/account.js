// Hesaba ödeme (banka havalesi): toplanmadan doğrudan hesaba geçen para (bankaya yatırılan, kutusu olmayan yeni gelir).
// Kasalarda biriken para ise yerinde durur, toplanması gerekir (aşağıda)
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, MoneyPile, floatText, sfx, toast, popIn } from './game.js';

export function toAccount(amount, at, icon = '💳') {
  if (!(amount > 0)) return;
  G.money += amount; G.stats.earned += amount;
  if (at) {
    floatText(at, `${icon} +${Math.round(amount)} ₺ hesaba`, 'pos');
    if (G.hooks.coin) G.hooks.coin(at);
    sfx('coin', { at });
  }
}

// ---------- kasalar ----------
// Para her zaman gözle görülür bir yerde birikir: satış tezgahındaki yığında (MoneyPile) ya da tezgahı olmayan işlemlerin
// (enerji santrali, benzinlik ve şarj, otopark) kasa kutusunda. Hesaba geçmesi için oyuncu yanına gidip toplar ya da muhasebeci
// toplayıp bankaya yatırır (upgrades.js); uzaktan "bankaya geçir" yok. Biriken yığın hırsızın da hedefidir (thief.js).
// Kutunun yeri işlemin yanında, yola kapanmayan bir köşe: [x, z, ön]; ön +1 güney, -1 kuzey (muhasebeci o yandan gelir)
const BOX = {
  enerji: { at: [-66.6, -62.4, 1], name: 'Enerji santrali', icon: '⚡' },      // trafonun önü
  istasyon: { at: [-79.4, -6.35, -1], name: 'Benzinlik ve şarj', icon: '⛽' }, // marketin önü, pompa şeridinin batısı (eski yeri şarja dönen arabanın yolundaydı)
  otopark: { at: [-75.6, -34.6, 1], name: 'Otopark', icon: '🅿️' },          // otoparkın arka kenarında iki park otomatının arası (events.js), önü otoparka
};
const PILES = new Map(); // id → kutudaki yığın
const tl = (n) => `${Math.floor(n).toLocaleString('tr-TR')} ₺`;
const CSS = `.kasa { display: flex; align-items: center; gap: 6px; padding: 3px 9px 3px 8px; border-radius: 999px; background: var(--hud-bg); color: var(--hud-ink);
  border: 2px solid var(--line); box-shadow: var(--shadow); font: 14px var(--font-title); white-space: nowrap; pointer-events: none; }
.kasa b { font-weight: normal; color: #2f8f4e; }`;
let ready = false, refreshT = 0;
function kasaBox(id) {
  let P = PILES.get(id);
  if (P) return P;
  const { at: [x, z, f], name, icon } = BOX[id];
  const g = new THREE.Group();
  M.rbox(1.12, 0.86, 1.02, 0.06, M.mat('#5d6b78'), 0, 0.43, 0, g);
  M.rbox(1.18, 0.07, 1.08, 0.03, M.mat('#38424c'), 0, 0.885, 0, g);
  M.rbox(0.56, 0.2, 0.04, 0.02, M.mat('#f6c343'), 0, 0.6, f * 0.52, g); // ön yüzde sarı para levhası
  g.position.set(x, 0, z); G.scene.add(g); popIn(g);
  const body = [x - 0.56, x + 0.56, z - 0.51, z + 0.51];
  G.colliders.push(body);
  P = new MoneyPile(G.scene, x, z, 0.92, { desk: false, body }); // değince toplanır
  P.spot = { x, y: 0, z: z - f, ry: 0 }; // muhasebeci bunun karşı yanından (ön) gelir
  const el = document.createElement('div');
  el.className = 'kasa';
  el.innerHTML = `<span>${icon}</span><span></span><b></b>`;
  el.children[1].textContent = name;
  P.label = G.labels.add(el, (v) => v.set(x, 2.3, z));
  P.label.hidden = true;
  PILES.set(id, P);
  return P;
}
// işlemin kazancı kendi kasasında birikir: at paranın geldiği yer (banknotlar oradan kutuya uçar)
export function toKasa(id, name, amount, at, icon = '💰') {
  if (!(amount > 0)) return;
  if (!BOX[id]) { toAccount(amount, at, icon); return; } // kutusu tanımsız yeni kaynak: doğrudan hesaba
  kasaBox(id).add(amount, at);
  floatText(at, `${icon} +${Math.round(amount)} ₺ kasada`, 'pos');
  sfx('coin', { at });
  refreshT = 0;
}
// kutu etiketleri çeyrek saniyede bir tazelenir (services.js); kutudaki para kayıtta G.stats.kasa'da durur
export function updateKasa(dt) {
  if (!ready) {
    ready = true;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    // eski kayıt: "bankaya geçir" bekleyen hesap bakiyeleri bir kez hesaba geçer
    const old = G.stats.acc;
    if (old && !G.visit) { // komşunun eski bakiyesi ziyaretçinin harçlığına geçmesin
      let s = 0;
      for (const id in old) s += Math.floor(old[id] || 0);
      delete G.stats.acc;
      if (s > 0) { G.money += s; toast(`🏦 Kasa hesaplarında bekleyen ${tl(s)} hesabına geçti. Artık kasalardaki parayı yanına gidip topluyorsun`); }
    }
    const k = G.stats.kasa || (G.stats.kasa = {});
    for (const id in k) if (BOX[id] && k[id] >= 1) { const P = kasaBox(id); P.add(k[id], P.base.position); }
  }
  if ((refreshT -= dt) > 0) return;
  refreshT = 0.25;
  const k = G.stats.kasa;
  for (const [id, P] of PILES) {
    k[id] = Math.floor(P.amount);
    P.label.hidden = P.amount < 1;
    if (!P.label.hidden) P.label.el.querySelector('b').textContent = tl(P.amount);
  }
}
// yığından para eksiltir, banknotlar oranında azalır (ceza, hırsız)
export function takeFromPile(P, amt) {
  const t = Math.min(amt, P.amount);
  if (!(t > 0)) return 0;
  P.amount -= t;
  const keep = P.amount >= 1 ? Math.ceil((P.bills.length * P.amount) / (P.amount + t)) : 0;
  while (P.bills.length > keep) { const b = P.bills.pop(); if (b.parent) b.parent.remove(b); }
  if (P.amount < 1) P.amount = 0;
  return t;
}

// Hataların bedeli: hesaptan düşer (eksiye inmez), istatistikte kayıp olarak tutulur
export function fine(amount, at, icon = '💸', label = '') {
  if (G.visit) return 0; // komşunun köyünde ceza ve maaş yardımcının harçlığından düşmez
  let need = Math.round(amount);
  const m = Math.min(need, Math.floor(G.money));
  G.money -= m; need -= m;
  // para tezgahlarda bekletilse de ceza ve maaş ödenir: eksik kalan kısım yığınlardan düşer
  for (const s of G.stations) { if (need <= 0) break; if (s instanceof MoneyPile && s.amount >= 1) need -= takeFromPile(s, Math.min(need, Math.floor(s.amount))); }
  const a = Math.round(amount) - need;
  if (!(a > 0)) return 0;
  G.stats.lost = (G.stats.lost || 0) + a;
  if (at) { floatText(at, `${icon} -${a} ₺${label ? ` ${label}` : ''}`, 'neg'); sfx('bad', { at }); }
  return a;
}
const lv = () => G.level || 1;
// diğer dosyalar import etmeden G.hooks üzerinden çağırır:
// sabrı taşıp alışveriş yapmadan giden müşteri (game.js Customer.mood): seviyeyle büyüyen küçük ceza, müşteri başına bir kez
G.hooks.angry = (c, at) => { if (c.fined) return; c.fined = true; fine(2 + 2 * Math.min(lv(), 8), at, '😠', 'kaçan müşteri'); };
// süresi dolan sipariş (paket servis, otopark, kervan, tatil evi): eksik kalan ürünlerin değerinin yarısı tazminat, en az 5 ₺
G.hooks.fineOrder = (order, at) => {
  let miss = 0;
  for (const k in order) { const o = order[k]; miss += ((ITEMS[k] && ITEMS[k].price) || 5) * Math.max(0, o.need - o.got); }
  if (miss > 0) fine(Math.max(5, miss * 0.5), at, '📦', 'tazminat');
};
// çöpe atılan ürün: değeri kadar zarar
G.hooks.trash = (type, at) => fine((ITEMS[type] && ITEMS[type].price) || 1, at, '🗑️');
