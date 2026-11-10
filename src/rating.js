// Mahalle memnuniyeti ve popülerlik. Her müşterinin mutlu ya da kızgın ayrılışı (Customer.mood → G.onMood) tek bir mahalle
// puanını oynatır: 0-100, ekranda 1-5 yıldız. Puan müşterilerin gelme sıklığını (repMul) ve pazarda rakip tezgahlara kayma
// eğilimini (rivals.js) belirler. Müşteri gelmezse puan yavaşça ortaya (55) döner.
// Acele müşteriler: hızlı yürür, sabrı yarı süre, kasa kuyruğunda da bekleyemez. Zamanında hizmet alırsa %50 bahşiş bırakır,
// kızarsa puanı normal müşterinin iki katı düşürür.
import * as M from './models.js';
import { G, ITEMS, MoneyPile, floatText } from './game.js';
import { havaMul } from './hava.js';

const START = 60, REST = 55;
export const rep = () => G.stats.rep ?? START;
export const stars = () => 1 + (rep() / 100) * 4;
// oyun geneli müşteri sıklığı: bütün bölgelerin müşteri, araba ve istasyon gelişleri bununla çarpılır. 2026-11-01 0,8 → 0,62
// (kullanıcı: "bazı saatlerde aşırı müşteri yoğunluğu oluyor, genel yoğunluğu azalt, zamanla başarılı oldukça gelsinler")
export const CUST_RATE = 0.62;
// kalabalık tavanı başarıyla büyür: seviye ve mahalle puanı yükseldikçe aynı anda daha çok müşteri gezer (6. seviyede ~30, 40. seviyede
// ~60). Gezen müşteri tavanın %70'ini geçince yeni gelişler yavaşlar, tavanda dörtte bire iner: öğlen sıcağı, bağırma, kampanya üst
// üste binse de sahne taşmaz. Sayım saniyede bir yapılır (repMul her karede birçok bölgeden çağrılır)
let crowdAt = -9, crowdK = 1;
export const crowdCap = () => (20 + Math.min(60, G.level || 1)) * (0.7 + (0.6 * rep()) / 100);
function crowd() {
  if (Math.abs(G.time - crowdAt) < 1) return crowdK;
  crowdAt = G.time;
  const n = (G.customers || []).filter((c) => !c.leaving && !c.follower).length, cap = crowdCap();
  crowdK = Math.max(0.25, Math.min(1, 1 - (n - cap * 0.7) / (cap * 0.4)));
  return crowdK;
}
// müşteri sıklığı çarpanı: başarıya daha bağlı: 1★ 0,5 · 3★ 1,0 · 5★ 1,5 (CUST_RATE ve kalabalık tavanıyla)
// yağmurda, karda, fırtınada müşteri azalır, hava açınca bekleyenler akın eder (hava.js)
export const repMul = () => CUST_RATE * (0.5 + rep() / 100) * crowd() * havaMul();

// ---------- acele müşteri ----------
const RUSH_P = { koy: 0.13, pazar: 0.16, firin: 0.18 };
export const pat = (c) => (c.rush ? 0.5 : 1);
export function maybeRush(c, p) {
  if (Math.random() >= (p ?? RUSH_P[c.region] ?? 0)) return false;
  c.rush = true;
  c.speed *= 1.6;
  // elinde evrak çantası, başının üstünde saat rozeti
  const bag = M.rbox(0.34, 0.25, 0.09, 0.03, M.mat('#5a3a22'), 0.3, 0.5, 0.06, c.obj);
  M.rbox(0.12, 0.05, 0.03, 0.01, M.mat('#c9a35a'), 0.3, 0.65, 0.06, c.obj);
  bag.castShadow = true;
  const el = document.createElement('div');
  el.className = 'rushb'; el.textContent = '⏱️'; el.title = 'Acele müşteri';
  const L = G.labels.add(el, (v) => v.copy(c.obj.position).setY(c.obj.position.y + 2.05));
  const destroy = c.destroy.bind(c);
  c.destroy = () => { G.labels.remove(L); destroy(); };
  c.rushL = L;
  return true;
}

// ---------- puan ----------
const log = []; // son olaylar: { happy, rush, region }
function noteMood(c, happy) {
  if (c.follower) return;
  let r = rep();
  // puan uzun soluklu: tek müşteri az oynatır, yön ancak birçok müşteriyle döner (eskiden 0,035 / 0,07)
  if (happy) r += (100 - r) * 0.012 * (c.rush ? 1.5 : 1);
  else r -= r * 0.024 * (c.rush ? 2 : 1);
  G.stats.rep = Math.max(0, Math.min(100, r));
  if (happy && c.rush) tip(c);
  if (c.rushL) { G.labels.remove(c.rushL); c.rushL = null; }
  log.unshift({ happy, rush: !!c.rush, region: c.region });
  if (log.length > 10) log.length = 10;
  pulse(happy);
}
G.onMood = noteMood;

const nearestPile = (p) => {
  let best = null, bd = 14;
  for (const s of G.stations) if (s instanceof MoneyPile) { const d = Math.hypot(s.zone.x - p.x, s.zone.z - p.z); if (d < bd) { bd = d; best = s; } }
  return best;
};
function tip(c) {
  const base = c.bill || (c.want && ITEMS[c.want] ? ITEMS[c.want].price * Math.max(1, c.got || 1) : 6);
  const amt = Math.max(2, Math.round(base * 0.5));
  const pile = nearestPile(c.obj.position);
  if (pile) pile.add(amt, c.obj.position); else G.money += amt;
  floatText(c.obj.position, `⏱️ +${amt} ₺ bahşiş`, 'pos');
}

// ---------- gösterge: üstte yıldızlar, tıklayınca ayrıntı ----------
const CSS = `
#rep { position: absolute; top: 118px; left: 14px; display: flex; align-items: center; gap: 8px; padding: 4px 14px 4px 6px; border-radius: 999px; cursor: pointer; pointer-events: auto; user-select: none; transition: box-shadow .3s; }
#rep .rs { position: relative; font-size: 17px; line-height: 1; letter-spacing: 1px; color: rgba(0,0,0,.18); }
#rep .rs i { position: absolute; left: 0; top: 0; overflow: hidden; white-space: nowrap; color: #ffc928; font-style: normal; text-shadow: 0 1px 0 #b07a00; }
#rep b { font: 17px var(--font-title); line-height: 1; }
#rep small { font: 800 11px var(--font-body); opacity: .75; }
#rep.up { box-shadow: 0 0 0 4px rgba(126,217,87,.85), var(--shadow); }
#rep.down { box-shadow: 0 0 0 4px rgba(232,96,76,.9), var(--shadow); }
#repPanel { position: absolute; top: 166px; left: 14px; width: min(290px, 80vw); padding: 12px 14px; border-radius: 18px; display: none; pointer-events: auto; font: 800 13px/1.35 var(--font-body); z-index: 5; }
#repPanel.open { display: block; }
#repPanel h4 { margin: 0 0 6px; font: 18px var(--font-title); }
#repPanel .rr { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; }
#repPanel .rl { font-size: 18px; letter-spacing: 2px; margin: 4px 0 6px; }
#repPanel p { margin: 6px 0 0; opacity: .8; font-weight: 700; }
.rushb { position: absolute; left: 0; top: 0; font-size: 15px; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; background: #fff3b0; border: 2px solid #b07a00; box-shadow: 0 2px 0 rgba(0,0,0,.2); pointer-events: none; animation: rushb .6s ease-in-out infinite alternate; }
@keyframes rushb { from { transform-origin: center; filter: none; } to { filter: brightness(1.15); } }
@media (max-width: 640px) {
  #rep { top: auto; bottom: 220px; }
  #repPanel { top: auto; bottom: 266px; }
}`;
let box = null, panel = null, starI = null, numB = null, shareS = null, uiT = 0, pulseT = 0;
function ensureUI() {
  if (box) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const hud = document.getElementById('hud') || document.body;
  box = document.createElement('div');
  box.id = 'rep'; box.className = 'hp'; box.title = 'Mahalle memnuniyeti';
  box.innerHTML = '<span class="rs">★★★★★<i>★★★★★</i></span><b></b><small>Mahalle</small>';
  starI = box.querySelector('i'); numB = box.querySelector('b'); shareS = box.querySelector('small');
  panel = document.createElement('div');
  panel.id = 'repPanel'; panel.className = 'hp';
  hud.appendChild(box); hud.appendChild(panel);
  const toggle = (e) => { e.stopPropagation(); e.preventDefault(); panel.classList.toggle('open'); if (panel.classList.contains('open')) fillPanel(); };
  box.addEventListener('pointerdown', toggle);
  panel.addEventListener('pointerdown', (e) => { e.stopPropagation(); panel.classList.remove('open'); });
}
function pulse(up) {
  if (!box) return;
  box.classList.toggle('up', up); box.classList.toggle('down', !up);
  pulseT = 0.7;
}
function fillPanel() {
  const P = G.regions.pazar, share = P && P.unlocked && P.rivals ? P.rivals.share() : null;
  const events = log.length ? log.map((e) => (e.happy ? (e.rush ? '⏱️😊' : '😊') : e.rush ? '⏱️😡' : '😡')).join(' ') : 'henüz yok';
  panel.innerHTML = `<h4>⭐ ${stars().toFixed(1)} · Mahalle puanı</h4>
    <div class="rr"><span>Müşteri sıklığı</span><b>×${repMul().toFixed(2)}</b></div>
    ${share !== null ? `<div class="rr"><span>Pazar payın</span><b>%${share}</b></div>` : ''}
    <div class="rr"><span>Son müşteriler</span></div><div class="rl">${events}</div>
    <p>Mutlu müşteri puanı yükseltir, kızgın müşteri düşürür; ⏱️ acele müşteri iki kat etkiler ama zamanında hizmete bahşiş bırakır. Puan yüksekken daha çok müşteri gelir, pazarda rakiplere kaçan azalır.</p>`;
}
export function updateRating(dt) {
  ensureUI();
  if (G.stats.rep !== undefined) G.stats.rep += (REST - G.stats.rep) * dt * 0.0008; // müşteri gelmezse yavaşça ortaya döner
  if (pulseT > 0) { pulseT -= dt; if (pulseT <= 0) box.classList.remove('up', 'down'); }
  uiT -= dt;
  if (uiT > 0) return;
  uiT = 0.3;
  const s = stars();
  starI.style.width = `${(s / 5) * 100}%`;
  const t = s.toFixed(1);
  if (numB._t !== t) { numB._t = t; numB.textContent = t; }
  const P = G.regions.pazar, share = P && P.unlocked && P.rivals ? P.rivals.share() : null;
  const sub = share !== null ? `Mahalle · pazar %${share}` : 'Mahalle';
  if (shareS._t !== sub) { shareS._t = sub; shareS.textContent = sub; } // ekrandaki metin İngilizcede çevrilmiş olur: kaynak metinle karşılaştırılır
  if (panel.classList.contains('open')) fillPanel();
}
