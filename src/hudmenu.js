// Yan menü (sol üstteki ⋮): ekrandaki göstergeleri gizle / göster, telefonda 🌍 düğmesi de burada (ses düğmesi ekranda, Menü'nün solunda).
// Seçimler bu cihazda saklanır (koyBakkali.hud). Gizlenen gösterge body sınıfıyla saklanır: sonradan kurulan modül öğesi de gizli doğar.
// Telefon yerleşimi (≤640 px): düğmeler küçük, köşelere toplu; mini harita sağ altta, köşesindeki − ile küçülür (minimap.js)
import { canFullscreen, toggleFullscreen } from './install.js';
import { G } from './game.js';

const KEY = 'koyBakkali.hud';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const store = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* özel pencere */ } };
// göster / gizle listesi: öğe kimliği → menüdeki adı
const PARTS = [
  ['dayChip', '🕒 Saat ve gün'], ['taskChip', '📋 Günlük görev'], ['rep', '⭐ Mahalle puanı'], ['lvl', '🏅 Mertebe'],
  ['region', '📍 Bölge adı'], ['carryDest', '🎒 Elindekiler'], ['alerts', '🔔 Bildirimler'], ['minimap', '🗺️ Mini harita'],
  ['kbMins', '➖ Küçült düğmeleri'],
];
// küçültülebilen göstergeler: kimlik → küçükken görünen simge
const MINS = [['region', '📍'], ['lvl', '🏅'], ['rep', '⭐'], ['dayChip', '🕒'], ['taskChip', '📋'], ['tatilChip', '💎'], ['money', '💰'],
  ['goal', '🎯'], ['carryDest', '🎒'], ['help', '❔'], ['upgBtn', '⬆️']];
// küçült düğmesi bunların üstüne konmaz
const OBST = ['menuBtn', 'musicBtn', 'onlineBtn', 'kbDTab', 'alerts', 'minimap', 'mmBar', 'chatBtn', 'shout', 'boost'];
// telefonda menüye taşınan düğmeler (kendi modülleri kurar; dinleyicileri taşınınca da çalışır)
// bilgi kutuları düğmesi (hintTog) taşınmaz: telefonda mini haritanın üstünde (2026-10-28 kullanıcı isteği). Ses düğmesi de taşınmaz, telefonda
// Menü'nün solunda (2026-11-01 kullanıcı: "mobilde ses açma tuşu yok ekranda")
const MOVE = [['onlineBtn', 'Köyler']];
const phone = matchMedia('(max-width: 640px)');

const CSS = `
#kbDTab { position: absolute; left: 8px; top: 46px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; pointer-events: auto;
  background: var(--hud-bg); color: var(--hud-ink); border: var(--bw) solid var(--line); box-shadow: var(--shadow); font: 900 20px/1 var(--font-body); padding: 0; z-index: 4; }
#kbDTab.on { background: #3b2a6b; color: #fff; }
#kbDrawer { position: absolute; left: 8px; top: 88px; width: min(250px, calc(100vw - 16px)); max-height: calc(100% - 100px); overflow-y: auto; box-sizing: border-box;
  padding: 10px 10px 8px; border-radius: var(--radius); background: var(--hud-bg); color: var(--hud-ink); border: var(--bw) solid var(--line);
  box-shadow: var(--shadow), 0 10px 26px rgba(0,0,0,.2); pointer-events: auto; z-index: 6; font-family: var(--font-body);
  transform: translateX(calc(-100% - 20px)); opacity: 0; transition: transform .22s ease, opacity .22s ease; visibility: hidden; }
#kbDrawer.open { transform: none; opacity: 1; visibility: visible; }
#kbDrawer.side-r { left: auto; right: 14px; transform: translateX(calc(100% + 20px)); }
#kbDrawer.side-r.open { transform: none; }
#kbDrawer h4 { margin: 2px 2px 6px; font: 15px var(--font-title); opacity: .8; }
#kbDrawer .dbtns { display: none; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
#kbDrawer .dbtns.has { display: flex; }
#kbDrawer .dbtn { display: flex; flex-direction: column; align-items: center; gap: 3px; font: 800 11px var(--font-body); width: 64px; }
#hud #kbDrawer .dbtn > button, #hud #kbDrawer .dbtn > div { position: relative !important; inset: auto !important; transform: none !important; margin: 0 !important;
  width: 42px !important; height: 42px !important; display: grid !important; place-items: center; }
#kbDrawer label { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 4px; font: 800 14px var(--font-body); cursor: pointer; border-top: 1px solid rgba(59,42,107,.12); }
#kbDrawer label input { width: 38px; height: 22px; appearance: none; -webkit-appearance: none; border-radius: 999px; background: #c9c3d9; position: relative; margin: 0; flex: none; transition: background .15s; cursor: pointer; }
#kbDrawer label input::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
#kbDrawer label input:checked { background: #3fae6b; }
#kbDrawer label input:checked::after { transform: translateX(16px); }
#kbDrawer .dfoot { display: flex; gap: 6px; margin-top: 6px; }
#kbDrawer .dfoot button { flex: 1; padding: 7px 6px; border-radius: 12px; border: 2px solid var(--line); background: #fff; color: var(--hud-ink); font: 800 12px var(--font-body); cursor: pointer; }
${PARTS.map(([id]) => `body.hh-${id} #hud #${id}`).join(', ')} { display: none !important; }
#minimap .mms { position: absolute; left: 6px; top: 6px; width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,.92); color: #3b2a6b;
  font: 900 18px/22px var(--font-body); text-align: center; box-shadow: 0 2px 0 rgba(0,0,0,.15); }
#minimap.big .mms, #minimap.mini .mms, #minimap.mini .mmz, #minimap.mini .mmn { display: none; }
#minimap.mini { width: 72px; height: 72px; border-radius: 16px; }
/* harita çubuğu (2026-11-03, kullanıcı: "mini map üstündeki aç kapat tuşlarını haritanın üstüne daha güzel oturt"): mini haritanın üst
   kenarında, sağına yaslı tek hap. Sırası: 💬 bilgi kutuları, 👁️ temiz görünüm, 🏷️ tüm yazılar; telefonda ⋮ da burada. Yeri haritanın
   boyundan ölçülür (küçülünce, gizlenince iner), harita büyüyünce gizlenir. Kapalı olan düğme soluk ve çizgili */
#mmBar { position: absolute; right: 14px; bottom: 234px; display: flex; gap: 2px; padding: 3px; border-radius: 999px; pointer-events: auto; z-index: 3; }
#hud #mmBar > button { position: relative; inset: auto; transform: none; margin: 0; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; box-shadow: none; color: inherit; display: grid; place-items: center; font: 900 18px/1 var(--font-body); }
#hud #mmBar > button:hover { background: rgba(0,0,0,.08); }
#hud #mmBar > button.on { background: #3b2a6b; color: #fff; }
#mmBar > button span { transition: opacity .2s, filter .2s; }
#mmBar > button.off span { opacity: .45; filter: grayscale(1); }
#mmBar > button.off::after { content: ''; position: absolute; width: 24px; height: 3px; border-radius: 2px; background: #e8504c; transform: rotate(-45deg); }
#hud > #hintTog { visibility: hidden; } /* world.js kurar; çubuğa taşınana dek görünmez */
/* temiz görünüm (👁️): bölgelerin ve öğelerin üstündeki yazılar gizlenir (bilgi kutusu, kilitli yazısı, isim etiketi, olgun ürün rozeti,
   kilit pedinin fiyatı, kasa adı, oyun pedi). Müşteri balonu, sipariş kutusu ve para yazısı oyun için kalır */
body.clean-view #labels > .hint, body.clean-view #labels > .lock, body.clean-view #labels > .staff, body.clean-view #labels > .ripe, body.clean-view #labels > .pad,
body.clean-view #labels > .minipad, body.clean-view #labels > .kasa, body.clean-view #labels > .promo, body.clean-view #labels > .rushb { display: none !important; }
/* tüm yazılar (🏷️, 2026-11-03 kullanıcı: "tüm ek açıklamaları kapatan, oyunda öğe açıklaması kalmasın"): yerdeki yazı katmanının hepsi
   kapanır: bilgi kutusu, ad, rozet, fiyat, müşteri balonu, sipariş kutusu, yüzen para yazısı. Kapalıyken yerleri de hesaplanmaz (game.js) */
body.no-labels #labels { display: none !important; }
/* küçült (2026-11-03, kullanıcı: "ekrandaki sabit tuşların, göstergelerin yanında minik küçült tuşu olsun"): göstergenin yanındaki
   minik − onu yerinde simgesine indirir, simgeye dokununca geri açılır. Bu cihazda saklanır; − düğmeleri ⋮ menüsünden topluca gizlenir */
#kbMins { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
#kbMins button { position: absolute; left: 0; top: 0; width: 18px; height: 18px; box-sizing: border-box; padding: 0; border-radius: 50%; pointer-events: auto; display: none;
  place-items: center; background: var(--hud-bg); color: var(--hud-ink); border: 1.5px solid var(--line); box-shadow: 0 1px 0 rgba(0,0,0,.18); font: 900 14px/1 var(--font-body); opacity: .72; }
#kbMins button::before { content: ''; position: absolute; inset: -6px; border-radius: 50%; } /* parmak için geniş dokunma alanı */
#kbMins button:hover { opacity: 1; }
#hud .kbm { width: 34px !important; height: 34px !important; min-width: 0 !important; max-width: none !important; box-sizing: border-box !important; padding: 0 !important;
  border-radius: 50% !important; overflow: hidden !important; font-size: 0 !important; pointer-events: auto !important; cursor: pointer; animation: none !important; }
#hud .kbm > * { display: none !important; }
#hud .kbm::before { content: attr(data-kbi); position: absolute; inset: 0; display: grid; place-items: center; font: 18px/1 var(--font-body); }
#hud #carryDest.kbm { background: var(--hud-bg); border: var(--bw) solid var(--line); box-shadow: var(--shadow); }
#hud #upgBtn.kbm { --s: 46px; width: var(--s) !important; height: var(--s) !important; }
#hud #upgBtn.kbm > svg { display: block !important; width: 26px; height: 26px; }
#hud #upgBtn.kbm::before { content: none; }

/* telefon: düğmeler küçük, ekranın ortası açık. Üst: saat solda, para ortada, Menü sağda; altında bildirimler.
   Sol alt sütun: Yükselt, bölge, mertebe, puan, görev. Sağ alt: mini harita; üstünde ⋮, 💬 ve yazışma, onların üstünde BAĞIR.
   Alt orta: elindekiler */
@keyframes toastL { 0% { opacity: 0; transform: translateY(-10px); } 10%, 85% { opacity: 1; transform: none; } 100% { opacity: 0; } }
@media (max-width: 640px) {
  #hud #dayChip { top: 8px; left: 8px; transform: scale(.88); transform-origin: left top; }
  /* ⋮ mini haritanın üstündeki çubukta, sağ uçta (kullanıcı: "kutuları aç kapa tuşunu eskisi gibi minimap üstüne koy"); menü çubuğun
     üstünden açılır (yüksekliği JS ile çubuğa göre) */
  #hud #mmBar > button { width: 30px; height: 30px; font-size: 16px; }
  #hud #mmBar > #kbDTab { font-size: 19px; }
  #hud #kbDrawer { top: auto; left: auto; right: 8px; bottom: 170px; max-height: calc(100% - 230px); }
  #hud #money { top: 6px; font-size: 19px; padding: 2px 12px 2px 3px; } #hud #money .coin { width: 24px; height: 24px; }
  #hud #menuBtn { top: 6px; right: 8px; height: 38px; padding: 0 10px; } #hud #menuBtn span { display: none; } #hud #menuBtn svg { width: 22px; height: 22px; }
  #hud #musicBtn { top: 6px; right: 60px; width: 38px; height: 38px; } #hud #musicBtn svg { width: 22px; height: 22px; }
  #sndPanel { top: 50px; right: 8px; width: min(330px, calc(100vw - 16px)); }
  /* üst sütun alt alta, hiçbiri birbirinin üstüne binmez (2026-11-01 kullanıcı: "hedef göstergesi üstüne bildirimler geliyor"):
     hedef tam genişlik; altında solda-ortada bildirim, sağda uyarılar; bereket rozeti bildirimin altında. Hedef bitince hepsi yukarı kayar */
  #hud #goal { top: 46px; left: 8px; right: 8px; width: auto; box-sizing: border-box; }
  #hud #toast { top: 118px; left: 8px; transform: none; text-align: left; max-width: calc(100vw - 204px); }
  #hud #toast.show { animation-name: toastL; }
  body:not(:has(#alerts .al)) #hud #toast { max-width: calc(100vw - 70px); } /* sağda bildirim yokken dar sütuna sıkışmasın */
  #hud #alerts { top: 118px; right: 8px; width: min(180px, 46vw); }
  #hud #boost { top: 160px; }
  body:has(#goal.done) #hud #toast, body:has(#goal.done) #hud #alerts { top: 50px; }
  body:has(#goal.done) #hud #boost { top: 92px; }
  #hud #upgBtn { left: 8px; bottom: 8px; --s: 58px; } /* ok ve yazı çapla ölçeklenir (index.html #upgBtn) */
  #hud #region { bottom: 70px; left: 8px; font-size: 12px; padding: 1px 9px 1px 2px; } #hud #region .ri { width: 21px; height: 21px; font-size: 12px; }
  #hud #lvl { bottom: 98px; left: 8px; padding: 1px 9px 1px 2px; } #hud #lvl .ln { width: 21px; height: 21px; font-size: 11px; }
  #hud #lvl .lt { min-width: 74px; } #hud #lvl .lt b { font-size: 11px; } #hud #lvl .bar { height: 4px; }
  #hud #rep { bottom: 128px; left: 8px; padding: 1px 8px 1px 4px; } #hud #rep .rs { font-size: 11px; } #hud #rep b { font-size: 12px; }
  #hud #repPanel { bottom: 150px; }
  #hud #taskChip { bottom: 150px; left: 8px; font-size: 12px; padding: 1px 8px 1px 5px; }
  #hud #taskPop { bottom: 176px; }
  #hud #minimap { right: 8px; bottom: 8px; width: 104px; height: 104px; border-radius: 16px; }
  #hud #minimap.mini { width: 58px; height: 58px; border-radius: 14px; }
  #hud #minimap.big { width: 74vw; height: 74vw; }
  /* mini haritanın üstünde çubuk, solunda yazışma; pazarda BAĞIR çubuğun üstünde (ikisinin de yüksekliği JS ile çubuğa göre) */
  #hud #shout { right: 8px; bottom: 170px; width: 64px; height: 64px; font-size: 12px; }
  #hud #chatBtn { width: 34px; height: 34px; }
  body.mm-mini #hud #carryDest { right: 70px; }
  #hud #chatPan { bottom: 120px; }
  #hud #carryDest { left: 70px; right: 116px; bottom: 10px; }
  #hud #help { bottom: 236px; font-size: 11px; }
  /* küçülen gösterge telefonda sol sütunun satır boyunda: alttan dayalı olanlar büyüyüp üstteki satıra binmez */
  #hud .kbm { width: 22px !important; height: 22px !important; } #hud .kbm::before { font-size: 13px; } #hud #upgBtn.kbm { --s: 40px; }
}
`;

let tab, box, btns;
export function initHudMenu() {
  const hud = document.getElementById('hud');
  if (!hud || document.getElementById('kbDTab')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const s = load(), hide = new Set(s.hide || []);
  const apply = () => { for (const [id] of PARTS) document.body.classList.toggle('hh-' + id, hide.has(id)); };
  apply();
  tab = document.createElement('button');
  tab.id = 'kbDTab'; tab.type = 'button'; tab.className = 'hp'; tab.textContent = '⋮'; tab.title = 'Ekran: göstergeleri gizle / göster';
  box = document.createElement('div'); box.id = 'kbDrawer';
  box.innerHTML = `<h4>Ekran</h4><div class="dbtns"></div>`
    + PARTS.map(([id, name]) => `<label>${name}<input type="checkbox" data-id="${id}" ${hide.has(id) ? '' : 'checked'}></label>`).join('')
    + `<div class="dfoot"><button type="button" data-a="all">Hepsini göster</button>${canFullscreen() ? '<button type="button" data-a="fs">Tam ekran</button>' : ''}</div>`;
  btns = box.querySelector('.dbtns');
  hud.appendChild(tab); hud.appendChild(box);
  // harita çubuğu: 👁️ temiz görünüm ve 🏷️ tüm yazılar burada kurulur; 💬 (world.js) ve telefonda ⋮ buraya taşınır. Seçimler bu cihazda saklanır
  const bar = document.createElement('div'); bar.id = 'mmBar'; bar.className = 'hp';
  bar.addEventListener('pointerdown', (e) => e.stopPropagation()); // oyunda yürüme başlamasın
  const tog = (id, ic, key, cls, onT, offT, fx) => {
    const b = document.createElement('button'); b.id = id; b.type = 'button'; b.innerHTML = `<span>${ic}</span>`;
    const sync = () => { const on = !!load()[key]; document.body.classList.toggle(cls, on); b.classList.toggle('off', on); b.title = on ? onT : offT; b.setAttribute('aria-label', b.title); if (fx) fx(on); };
    b.addEventListener('click', () => { store({ ...load(), [key]: !load()[key] }); sync(); });
    bar.appendChild(b); sync();
  };
  tog('cleanTog', '👁️', 'clean', 'clean-view', 'Ekrandaki yazıları göster', 'Ekrandaki yazıları gizle (temiz görünüm)');
  tog('labTog', '🏷️', 'labs', 'no-labels', 'Oyundaki tüm yazıları göster', 'Oyundaki tüm yazıları gizle (balon, sipariş, ad, bilgi kutusu)', (on) => { G.labelsOff = on; });
  hud.appendChild(bar);
  // küçült: göstergenin yanındaki minik −; küçülen gösterge yerinde simgesine iner, simgesine dokununca açılır
  const mins = new Set(s.mins || []), lay = document.createElement('div'), mbtn = {};
  lay.id = 'kbMins'; hud.appendChild(lay);
  const setMin = (id, v) => {
    if (v) mins.add(id); else mins.delete(id);
    const el = document.getElementById(id); if (el) el.classList.toggle('kbm', v);
    store({ ...load(), mins: [...mins] }); seatMins();
  };
  for (const [id] of MINS) {
    const b = mbtn[id] = document.createElement('button'); b.type = 'button'; b.textContent = '−'; b.title = 'Küçült'; b.setAttribute('aria-label', 'Küçült');
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', () => setMin(id, true));
    lay.appendChild(b);
  }
  // − göstergenin yanına konur (sağ yarıdakilerde soluna); orada başka bir şey varsa köşelerinden boş olana. Göstergeler kayınca izler (300 ms)
  const seatMins = () => {
    const hr = hud.getBoundingClientRect(), W = hr.width, H = hr.height, S = 18;
    const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - hr.left, t: r.top - hr.top, r: r.right - hr.left, b: r.bottom - hr.top }; };
    const seen = (el) => el && el.offsetParent && +getComputedStyle(el).opacity > 0.1;
    const busy = [], live = [];
    for (const id of OBST) { const el = document.getElementById(id); if (seen(el)) busy.push(rect(el)); }
    for (const [id, ic] of MINS) {
      const el = document.getElementById(id), on = mins.has(id);
      mbtn[id].style.display = '';
      if (!el) continue;
      if (el.dataset.kbi !== ic) el.dataset.kbi = ic;
      if (el.classList.contains('kbm') !== on) el.classList.toggle('kbm', on); // sonradan kurulan ya da sınıfı yenilenen gösterge
      if (!seen(el)) continue;
      const r = rect(el); busy.push(r);
      if (!on) live.push([mbtn[id], r]);
    }
    if (document.body.classList.contains('hh-kbMins')) return;
    const hit = (x, y, own) => x < 2 || y < 2 || x + S > W - 2 || y + S > H - 2 || busy.some((q) => q !== own && x < q.r && x + S > q.l && y < q.b && y + S > q.t);
    for (const [b, r] of live) {
      const y = (r.t + r.b - S) / 2, side = [[r.r + 4, y], [r.l - S - 4, y]];
      if ((r.l + r.r) / 2 > W * 0.6) side.reverse();
      const c = [...side, [r.r - S + 5, r.t - S + 7], [r.r - S + 5, r.b - 7], [r.r - S - 2, r.t + 2]]; // yan, üst köşe, alt köşe, iç köşe
      const p = c.find(([x, cy], i) => !hit(x, cy, i > 1 ? r : null)) || c[4];
      b.style.display = 'grid'; b.style.transform = `translate(${Math.round(p[0])}px,${Math.round(p[1])}px)`;
      busy.push({ l: p[0], t: p[1], r: p[0] + S, b: p[1] + S });
    }
  };
  // küçük göstergeye dokunmak onu açar; dokunuş göstergenin kendi işine (panel açma, yükseltme menüsü) gitmez
  let eat = null, eatT = 0;
  hud.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('.kbm');
    if (!el) return;
    e.stopPropagation(); e.preventDefault(); eat = el; eatT = performance.now() + 700;
    setMin(el.id, false);
  }, true);
  for (const t of ['pointerup', 'click']) hud.addEventListener(t, (e) => {
    if (eat && performance.now() < eatT && eat.contains(e.target)) { e.stopPropagation(); e.preventDefault(); if (t === 'click') eat = null; }
  }, true);
  const open = (v) => { box.classList.toggle('open', v); tab.classList.toggle('on', v); };
  for (const el of [tab, box]) el.addEventListener('pointerdown', (e) => e.stopPropagation()); // oyunda yürüme başlamasın
  tab.addEventListener('click', () => open(!box.classList.contains('open')));
  box.addEventListener('change', (e) => {
    const id = e.target.dataset && e.target.dataset.id;
    if (!id) return;
    if (e.target.checked) hide.delete(id); else hide.add(id);
    apply(); store({ ...load(), hide: [...hide] }); seatMins();
  });
  box.addEventListener('click', (e) => {
    const a = e.target.closest('button[data-a]');
    if (!a) return;
    if (a.dataset.a === 'fs') { toggleFullscreen(); open(false); }
    if (a.dataset.a === 'all') { // gizlenenler ve küçültülenler açılır
      hide.clear(); mins.clear(); apply(); store({ ...load(), hide: [], mins: [] });
      for (const i of box.querySelectorAll('input[data-id]')) i.checked = true;
      seatMins();
    }
  });
  // menünün dışına dokununca kapanır
  addEventListener('pointerdown', (e) => { if (box.classList.contains('open') && !box.contains(e.target) && e.target !== tab) open(false); }, true);
  // çubuk haritanın üst kenarına oturur; yazışma çubuğun soluna, telefonda BAĞIR ve ⋮ menüsü üstüne. Harita büyükken çubuk gizli
  const seat = () => {
    const mm = document.getElementById('minimap'), big = !!mm && mm.classList.contains('big');
    bar.style.display = big ? 'none' : '';
    if (big) return;
    const hr = hud.getBoundingClientRect(), r = mm && mm.offsetParent ? mm.getBoundingClientRect() : null;
    const right = r ? hr.right - r.right : phone.matches ? 8 : 14;
    const bottom = r ? hr.bottom - r.top + 6 + (parseFloat(getComputedStyle(mm).outlineWidth) || 0) : phone.matches ? 8 : 16;
    bar.style.right = `${Math.round(right)}px`; bar.style.bottom = `${Math.round(bottom)}px`;
    const top = bottom + bar.offsetHeight; // çubuğun üst kenarının alttan uzaklığı
    const chat = document.getElementById('chatBtn');
    if (chat) Object.assign(chat.style, { right: `${Math.round(right + bar.offsetWidth + 6)}px`, bottom: `${Math.round(bottom + (bar.offsetHeight - (chat.offsetHeight || 34)) / 2)}px` });
    const sh = document.getElementById('shout');
    if (sh) sh.style.bottom = phone.matches ? `${Math.round(top + 8)}px` : '';
    box.style.bottom = phone.matches ? `${Math.round(top + 8)}px` : '';
  };
  // telefonda 🌍 düğmesi menüye; ekran genişleyince (yan çevirme, masaüstü) yerlerine döner.
  // Düğmeler modüllerince sonradan kurulur: saniyede bir bakılır
  const place = () => {
    // 💬 çubuğun başına; ⋮ telefonda çubuğun sonuna, bilgisayarda Menü düğmesinin soluna (menü sağdan açılır; sol sütunda bölge, mertebe, puan var)
    const hint = document.getElementById('hintTog');
    if (hint && hint.parentNode !== bar) bar.insertBefore(hint, bar.firstChild);
    if (phone.matches) { if (tab.parentNode !== bar) bar.appendChild(tab); } else if (tab.parentNode === bar) hud.insertBefore(tab, box);
    const mb = document.getElementById('menuBtn');
    if (!phone.matches && mb) {
      const r = mb.getBoundingClientRect(), hr = hud.getBoundingClientRect();
      Object.assign(tab.style, { left: 'auto', right: `${Math.round(hr.right - r.left + 10)}px`, top: `${Math.round(r.top - hr.top + (r.height - 34) / 2)}px` });
      box.classList.add('side-r'); box.style.top = `${Math.round(r.bottom - hr.top + 10)}px`;
    } else { tab.style.left = tab.style.right = tab.style.top = ''; box.classList.add('side-r'); box.style.top = ''; } // telefonda da sağdan açılır
    for (const [id, name] of MOVE) {
      const el = document.getElementById(id);
      if (!el) continue;
      const slot = btns.querySelector(`[data-for="${id}"]`);
      if (phone.matches && !slot) {
        const w = document.createElement('div'); w.className = 'dbtn'; w.dataset.for = id;
        w.appendChild(el); w.appendChild(Object.assign(document.createElement('span'), { textContent: name }));
        btns.appendChild(w);
      } else if (!phone.matches && slot) { hud.insertBefore(el, tab); slot.remove(); }
    }
    btns.classList.toggle('has', !!btns.children.length);
    seat();
  };
  place(); setInterval(place, 1000); setInterval(seatMins, 300);
  if (phone.addEventListener) phone.addEventListener('change', place);
  addEventListener('resize', () => { seat(); seatMins(); });
  if (window.ResizeObserver) new ResizeObserver(seat).observe(document.getElementById('minimap')); // küçülürken, büyürken çubuk izler
}
