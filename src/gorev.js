// Günlük görevler: her oyun günü (gün döngüsünün bir turu, 12 dk; daylight.js) üç küçük görev gelir. İkisi her oyuncuya
// açık işlerden (müşteri, satış, kazanç), biri açık bölgelere göre (kervan, paket, şemsiye gölgesi). Hedefler oyuncunun kendi
// hızına göre: ömür boyu ortalamasıyla bir günde yapacağının yarısı kadar. Görev yalnız oynarken akan oyun saatiyle yenilenir:
// oyunu kapatınca kaybolmaz. Her görev para ve XP verir; üçü birden bitince ek ödül. Ekranda saatin altında 📋 2/3 rozeti,
// dokununca liste açılır. Sayaçlar G.stats'ta (daily, dailyDone), kayıtla gider.
import { G, toast, sfx } from './game.js';
import { banner } from './ui.js';
import { addXp } from './level.js';
import { addGems } from './tatil.js';
import { DAY } from './daylight.js';
import { seasonHTML } from './mevsim.js';

const r5 = (v) => Math.max(5, Math.round(v / 5) * 5);
const per = (v) => (G.stats.time > 600 ? (v / G.stats.time) * DAY * 0.5 : 0); // ömür boyu hızla bir günün yarısı
// k: görev türü. val: sayaç, goal: hedef, ok: bu oyuncuya açık mı
const KINDS = {
  mus: { icon: '👥', text: (n) => `${n} müşteriye hizmet et`, val: () => G.stats.customers, goal: () => r5(Math.max(12 + 1.5 * G.level, per(G.stats.customers))) },
  sat: { icon: '📦', text: (n) => `${n} ürün sat`, val: () => G.stats.sold, goal: () => r5(Math.max(20 + 2.5 * G.level, per(G.stats.sold))) },
  kaz: { icon: '💰', text: (n) => `${n.toLocaleString('tr-TR')} ₺ kazan`, val: () => G.stats.earned, goal: () => Math.max(200, Math.round(per(G.stats.earned) / 100) * 100) },
  kervan: { icon: '🐫', text: (n) => `${n} kervanı memnun et`, val: () => G.stats.caravans, goal: () => 2 + Math.floor(G.level / 10), ok: () => G.unlocked.has('gh') },
  paket: { icon: '🚗', text: (n) => `${n} paket siparişi teslim et`, val: () => G.stats.cars, goal: () => 3 + Math.floor(G.level / 8), ok: () => G.unlocked.has('kc') },
  golge: { icon: '☂️', text: (n) => `Öğlen ${n} müşteriye şemsiye gölgesinde servis yap`, val: () => G.stats.shade || 0, goal: () => 3 + Math.floor(G.level / 8), ok: () => G.unlocked.has('gs') },
};
// görev başına ₺: fiyatlar arttıkça ödül de 1,5 kat (2026-11-01); tam 2,5 kat günlük kazancın yarısını aşıyordu
const reward = () => Math.round((75 + 60 * (G.level || 1)) / 5) * 5;

let chip = null, pop = null, shownTxt = '', checkT = 0;

function newDay(n) {
  const base = ['mus', 'sat', 'kaz'].sort(() => Math.random() - 0.5).slice(0, 2);
  const extra = ['kervan', 'paket', 'golge'].filter((k) => KINDS[k].ok());
  const ks = extra.length ? [...base, extra[Math.floor(Math.random() * extra.length)]] : ['mus', 'sat', 'kaz'];
  G.stats.daily = { day: n, list: ks.map((k) => ({ k, goal: KINDS[k].goal(), from: KINDS[k].val(), done: false })), all: false };
}
const prog = (t) => Math.min(t.goal, Math.max(0, KINDS[t.k].val() - t.from));

export function initGorev() {
  G.stats.dailyDone = G.stats.dailyDone || 0;
  if (!G.stats.daily || !Array.isArray(G.stats.daily.list) || G.stats.daily.list.some((t) => !t || !KINDS[t.k] || typeof t.goal !== 'number')) newDay(G.stats.dayN || 0);
  G.hooks.newDay = (n) => { G.stats.dayN = n; newDay(n); if (G.player) toast('📋 Yeni gün, yeni görevler: saatin altındaki rozete dokun'); };
  const st = document.createElement('style');
  st.textContent = `#taskChip { position: absolute; top: 194px; left: 14px; padding: 4px 12px 4px 8px; border-radius: 999px; font: 16px var(--font-title); cursor: pointer; white-space: nowrap; pointer-events: auto; }
#taskChip.all { background: #d9f7c8; }
#taskPop { position: absolute; top: 234px; left: 14px; width: min(300px, calc(100vw - 28px)); padding: 10px 12px; border-radius: 16px; display: none; z-index: 30; font: 14px/1.35 var(--font-body); pointer-events: auto; }
#taskPop.on { display: block; }
#taskPop h5 { margin: 0 0 6px; font: 17px var(--font-title); font-weight: normal; }
#taskPop .t { display: grid; grid-template-columns: 26px 1fr auto; gap: 6px; align-items: center; margin: 6px 0; }
#taskPop .t i { font-style: normal; font-size: 18px; }
#taskPop .t .bar { grid-column: 2 / 4; height: 6px; border-radius: 4px; background: rgba(0,0,0,.12); overflow: hidden; }
#taskPop .t .bar u { display: block; height: 100%; background: linear-gradient(90deg, #7ed957, #3fae6b); }
#taskPop .t.done b { text-decoration: line-through; opacity: .6; }
#taskPop small { display: block; margin-top: 6px; opacity: .75; }
#taskPop .sz { margin: 0 0 4px; font-size: 13px; opacity: .85; } #taskPop hr { border: 0; border-top: 1px dashed rgba(0,0,0,.2); margin: 10px 0; }
@media (max-width: 640px) { #taskChip { top: auto; bottom: 256px; left: 14px; font-size: 14px; } #taskPop { top: auto; bottom: 292px; } } /* mahalle puanının (#rep) üstünde */`;
  document.head.appendChild(st);
  const hud = document.getElementById('hud') || document.body;
  chip = document.createElement('div'); chip.id = 'taskChip'; chip.className = 'hp'; chip.title = 'Bugünün görevleri';
  pop = document.createElement('div'); pop.id = 'taskPop'; pop.className = 'hp';
  chip.onclick = (e) => { e.stopPropagation(); pop.classList.toggle('on'); renderPop(); };
  pop.onclick = () => pop.classList.remove('on');
  hud.append(chip, pop);
}

function renderPop() {
  if (!pop.classList.contains('on')) return;
  const d = G.stats.daily;
  pop.innerHTML = `${seasonHTML()}${G.hooks.weekHTML ? G.hooks.weekHTML() : ''}<h5>📋 Bugünün görevleri</h5>${d.list.map((t) => {
    const K = KINDS[t.k], p = prog(t);
    return `<div class="t${t.done ? ' done' : ''}"><i>${t.done ? '✅' : K.icon}</i><b>${K.text(t.goal)}</b><span>${p.toLocaleString('tr-TR')}/${t.goal.toLocaleString('tr-TR')}</span><span class="bar"><u style="width:${(p / t.goal) * 100}%"></u></span></div>`;
  }).join('')}<small>Her görev ${reward().toLocaleString('tr-TR')} ₺, 15 XP ve 💎 1 elmas; üçü bitince ${(reward() * 2).toLocaleString('tr-TR')} ₺ ve 💎 1 daha (elmasla tatile gidilir). Görevler yeni günde (🌅) yenilenir.</small>`;
}

export function updateGorev(dt) {
  if (!chip || (checkT -= dt) > 0) return;
  checkT = 0.5;
  const d = G.stats.daily;
  for (const t of d.list) {
    if (t.done || prog(t) < t.goal) continue;
    t.done = true; G.stats.dailyDone++;
    const m = reward(); if (!G.visit) G.money += m; addXp(15); addGems(1); // ödül kazanca sayılmaz: kazanç görevi kendini beslemesin; elmas tatil içindir (tatil.js)
    banner('GÖREV TAMAM', `${KINDS[t.k].icon} +${m.toLocaleString('tr-TR')} ₺ · 💎 +1`); sfx('buy');
  }
  if (!d.all && d.list.every((t) => t.done)) {
    d.all = true; const m = reward() * 2; if (!G.visit) G.money += m; addGems(1);
    banner('GÜNÜN GÖREVLERİ TAMAM', `🎁 +${m.toLocaleString('tr-TR')} ₺ · 💎 +1`); sfx('hire');
  }
  const n = d.list.filter((t) => t.done).length, txt = `📋 ${n}/${d.list.length}`;
  if (txt !== shownTxt) { shownTxt = txt; chip.textContent = txt; chip.classList.toggle('all', d.all); }
  renderPop();
}
