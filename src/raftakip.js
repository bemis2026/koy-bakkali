// Raf takip sistemi (2026-11-08 kullanıcı: "böyle bir tuş olsun ekranda, basınca hangi rafta kaç ürün var kaç boş var güzel bir tabloda
// göstersin o rafa basınca ürünü nerde olduğunu nasıl üretildiğini göstersin ipucu gibi kolay anlık ordan kontrol yapabilelim. buna raf
// takip sistemi diyelim ve bu sistemi parayla alalım gelliştirme olarak"). Yükselt menüsünde Köy Bakkalı sekmesinden alınır
// (upgrades.js UPG.rafTakip). Alınınca haritanın üstündeki çubukta (hudmenu.js #mmBar) 📋 düğmesi çıkar; köşesindeki kırmızı sayı boş
// raf sayısı. Dokununca açılan tabloda açık bölgelerin bütün rafları: doluluk çubuğu, dolu/kapasite, boş yer; bölge içinde en boş raf
// üstte (sıra panel açılırken kurulur). Rafa dokununca altında ipucu açılır: raftaki her ürünün kaynağı (bostan, tarla, makine, kümes ve
// ahır, toptancı, şehir deposu), nasıl üretildiği (makinenin girdisi ve onun kaynağı), uzaklığı ve "Oraya git" (main.js G.hooks.goTo:
// karakter kendi koşar). Panel açıkken sayılar saniyede iki kez yerinde yenilenir; satırlar yeniden kurulmaz, dokunuş kaybolmaz.
// Yazılar ayrı öğelerde: İngilizcede her parça sözlükten ayrı çevrilir (dil.js)
import { G, ITEMS, Shelf, Converter, Generator, PlantBed, PaidSource, toast } from './game.js';
import { UPG, genName } from './upgrades.js';

const CSS = `
#rtBtn em { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; box-sizing: border-box; padding: 0 4px; border-radius: 9px; display: none;
  background: #e8504c; color: #fff; border: 2px solid #fff; font: 900 10px/13px var(--font-body); font-style: normal; text-align: center; }
#rtBtn em.on { display: block; }
#hud #mmBar > #rtBtn.new { animation: rtPulse 1s ease-in-out 8; }
@keyframes rtPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.28); box-shadow: 0 0 0 6px rgba(255,210,63,.65); } }
#rtPanel { position: absolute; right: 14px; top: 64px; bottom: 14px; width: min(430px, calc(100vw - 28px)); box-sizing: border-box; display: none; flex-direction: column;
  background: var(--hud-bg); color: var(--hud-ink); border: var(--bw) solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow), 0 12px 30px rgba(0,0,0,.25);
  pointer-events: auto; z-index: 9; font-family: var(--font-body); overflow: hidden; } /* sol alttaki göstergeler (💎 keyif) üstüne binmesin */
#rtPanel.open { display: flex; animation: rtIn .2s ease both; }
@keyframes rtIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
#rtPanel .rhd { display: flex; align-items: center; gap: 8px; padding: 10px 10px 6px 14px; }
#rtPanel .rhd > b { flex: 1; font: 23px var(--font-title); }
#rtPanel .rx { width: 34px; height: 34px; flex: none; border-radius: 50%; border: 2px solid #fff; background: var(--red); color: #fff; font: 900 17px/1 var(--font-body); cursor: pointer; padding: 0; box-shadow: 0 2px 0 rgba(0,0,0,.2); }
#rtPanel .rsum { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; padding: 0 10px 8px; }
#rtPanel .rtc { display: flex; flex-direction: column; align-items: center; padding: 5px 4px 4px; border-radius: 12px; background: rgba(59,42,107,.08); }
#rtPanel .rtc b { font: 21px/1.1 var(--font-title); }
#rtPanel .rtc small { font: 800 11px/1.2 var(--font-body); opacity: .75; text-align: center; }
#rtPanel .rtc.bad b { color: #d9443a; }
#rtPanel .rflt { display: flex; gap: 6px; padding: 0 10px 8px; }
#rtPanel .rflt button { flex: 1; padding: 6px 4px; border-radius: 999px; border: 2px solid rgba(59,42,107,.35); background: #fff; color: #3b2a6b; font: 800 12px var(--font-body); cursor: pointer; }
#rtPanel .rflt button.on { background: #3b2a6b; border-color: #3b2a6b; color: #fff; }
#rtPanel .rbody { flex: 1; overflow-y: auto; padding: 0 10px 12px; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
#rtPanel .rth { display: flex; align-items: center; gap: 6px; margin: 10px 2px 5px; }
#rtPanel .rth .rhi { font-size: 18px; }
#rtPanel .rth b { font: 16px var(--font-title); }
#rtPanel .rth small { margin-left: auto; font: 800 11px var(--font-body); opacity: .75; white-space: nowrap; }
#rtPanel .rtr { display: grid; grid-template-columns: 44px minmax(0, 1fr) 88px 38px; align-items: center; gap: 6px; padding: 6px 7px; margin-bottom: 5px; border-radius: 14px;
  background: var(--row-bg); color: var(--row-ink); border: 2px solid rgba(59,42,107,.16); cursor: pointer; user-select: none; }
#rtPanel .rtr:active { transform: scale(.985); }
#rtPanel .rtr.e0 { border-color: #e8504c; }
#rtPanel .rtr.op { border-color: #f0b429; border-radius: 14px 14px 4px 4px; margin-bottom: 0; }
#rtPanel .rti { display: flex; align-items: center; }
#rtPanel .rti img { width: 24px; height: 24px; margin-right: -9px; filter: drop-shadow(0 1px 0 rgba(0,0,0,.2)); }
#rtPanel .rti .rmore { font: 900 10px var(--font-body); margin-left: 10px; opacity: .7; }
#rtPanel .rtn { min-width: 0; }
#rtPanel .rtn b { display: block; font: 900 14px/1.15 var(--font-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#rtPanel .rtn small { display: block; font: 700 11px/1.25 var(--font-body); opacity: .72; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#rtPanel .rtb { display: flex; flex-direction: column; gap: 3px; }
#rtPanel .rtf { height: 10px; border-radius: 6px; background: rgba(0,0,0,.13); overflow: hidden; }
#rtPanel .rtf i { display: block; height: 100%; width: 0; border-radius: 6px; background: #3fae6b; transition: width .35s ease, background-color .35s; }
#rtPanel .rtr.l1 .rtf i { background: #f0b429; }
#rtPanel .rtr.l2 .rtf i { background: #e8504c; }
#rtPanel .rtb em { font: 900 12px/1 var(--font-body); font-style: normal; text-align: center; }
#rtPanel .rte { display: flex; flex-direction: column; align-items: center; line-height: 1; }
#rtPanel .rte b { font: 19px/1 var(--font-title); }
#rtPanel .rte small { font: 800 10px var(--font-body); opacity: .7; }
#rtPanel .rtr.e0 .rte b { color: #d9443a; }
#rtPanel.low .rtr.hi, #rtPanel.low .rth.hi, #rtPanel.low .rtip.hi { display: none; }
#rtPanel .rnone { margin: 18px 4px; text-align: center; font: 800 14px var(--font-body); opacity: .75; }
#rtPanel.low .rbody:not(:has(.rtr:not(.hi))) .rallok { display: block; }
#rtPanel .rallok { display: none; margin: 18px 4px; text-align: center; font: 800 14px var(--font-body); }
#rtPanel .rtip { margin: 0 0 8px; padding: 8px 10px 6px; border-radius: 4px 4px 14px 14px; background: #fff8dc; color: #4a3500; border: 2px solid #f0b429; border-top-width: 1px; font: 700 13px/1.35 var(--font-body); }
#rtPanel .rtip[hidden] { display: none; }
#rtPanel .rpt { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
#rtPanel .rpt small { opacity: .75; }
#rtPanel .rpp { display: flex; align-items: center; gap: 6px; margin: 8px 0 4px; padding-top: 6px; border-top: 1px dashed rgba(74,53,0,.25); }
#rtPanel .rpp img { width: 26px; height: 26px; }
#rtPanel .rpp > b { font: 900 15px var(--font-body); }
#rtPanel .rpp .rpn { display: inline-flex; align-items: baseline; gap: 3px; padding: 1px 7px; border-radius: 999px; background: rgba(74,53,0,.1); }
#rtPanel .rpp .rpn em { font: 900 13px var(--font-body); font-style: normal; }
#rtPanel .rpp .rpn small { font: 800 11px var(--font-body); opacity: .8; }
#rtPanel .rpp .rpr { margin-left: auto; font: 900 12px var(--font-body); color: #2b7f37; }
#rtPanel .rsrc { margin: 4px 0 6px 6px; padding-left: 8px; border-left: 3px solid rgba(240,180,41,.7); }
#rtPanel .rsh { display: flex; align-items: center; gap: 6px; }
#rtPanel .rsi { font-size: 18px; }
#rtPanel .rsn { display: flex; flex-direction: column; min-width: 0; line-height: 1.15; }
#rtPanel .rsn b { font: 900 13px var(--font-body); }
#rtPanel .rsn small { font: 700 11px var(--font-body); opacity: .75; }
#rtPanel .rhow { margin: 3px 0 0; font: 700 12px/1.35 var(--font-body); opacity: .9; }
#rtPanel .rcv, #rtPanel .rin { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 4px 0 0; font: 800 12px/1.3 var(--font-body); }
#rtPanel .rci { display: inline-flex; align-items: center; gap: 2px; padding: 1px 6px 1px 2px; border-radius: 999px; background: #fff; border: 1px solid rgba(74,53,0,.2); }
#rtPanel .rci img { width: 18px; height: 18px; }
#rtPanel .rci i { font-style: normal; opacity: .7; }
#rtPanel .rcv > small, #rtPanel .rin > small { opacity: .7; }
#rtPanel small.rar { font: 900 15px/1 Arial, 'Segoe UI Symbol', sans-serif; opacity: .85; } /* ok ve artı: yazı yüzünde küçük çizgi gibi kalıyordu */
#rtPanel .rno { margin: 2px 0 4px 6px; font: 700 12px var(--font-body); opacity: .8; }
#rtPanel .rgo { margin-left: auto; flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px; border: 2px solid #2b7f37;
  background: #3fb34f; color: #fff; font: 900 12px var(--font-body); cursor: pointer; white-space: nowrap; }
#rtPanel .rgo i { font-style: normal; opacity: .85; font-weight: 800; }
#rtPanel .rgo.sm { padding: 2px 7px; font-size: 11px; }
#rtPanel span.rgo { background: #c9c3d9; border-color: #a49cbb; cursor: default; }
#rtPanel .rfill { margin: 8px 0 2px; padding: 6px 8px; border-radius: 10px; font: 800 12px/1.35 var(--font-body); display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
#rtPanel .rfill.ok { background: rgba(63,174,107,.15); }
#rtPanel .rfill.no { background: rgba(232,80,76,.12); }
#rtPanel .rfill i { font-style: normal; opacity: .75; }
@media (max-width: 640px) {
  #hud #rtPanel { left: 8px; right: 8px; top: 50px; bottom: 8px; width: auto; }
  #rtPanel .rtr { grid-template-columns: 38px minmax(0, 1fr) 76px 34px; gap: 5px; padding: 6px; }
  #rtPanel .rti img { width: 22px; height: 22px; }
}`;

// bölge simgeleri (album.js ile aynı)
const REG_IC = { koy: '🏡', pazar: '🍉', ciftlik: '🐄', sahil: '🏖️', han: '🐫', atlar: '🐎', firin: '🥯', kargo: '📦', tatil: '🐚', kasaba: '⛲', tarla: '🌽', mera: '🐑',
  atolye: '🧶', sehir: '🏙️', enerji: '🌬️', tarlalar: '🚜', iskele: '🎣', lunapark: '🎡', meydan: '🅿️' };
// makine olmayan üreticiler: [simge, ad, nasıl]; menüde adı olan (upgrades.js genName) önce o adı alır
const ANIM = {
  yumurta: ['🐔', 'Kümes', 'Tavuklar yumurtlar; kümesin önündeki tepsiden al.'],
  sut: ['🐄', 'İnek ahırı', 'İnekler sağılır; güğümleri ahırın önündeki tepsiden al.'],
  yun: ['🐑', 'Kırkım barakası', 'Koyunlar kırkılır; yünü barakanın önündeki tepsiden al.'],
  ksut: ['🍼', 'Sağım yeri', 'Koyunlar sağılır; sütü sağım yerinin tepsisinden al.'],
  balik: ['🧊', 'Buzlu balık kasası', 'Balıkçı ve teknesi tutup buzlu kasaya koyar; oradan al.'],
  kocan: ['🚜', 'Tarla ambarı', 'Traktör biçip ambara yığar; oradan al.'],
  bugday: ['🚜', 'Tarla ambarı', 'Traktör biçip ambara yığar; oradan al.'],
};
const FROM = { kirli: 'Misafirlerden gelir' }; // makinenin kaynağı istasyon olmayan girdisi
// menüde adı olmayan makineler (alerts.js ile aynı): ürün → makine
const MACH = { misir: 'Mısır kazanı', dondurma: 'Dondurma makinesi', ekmek: 'Fırın', yem: 'Yem ambarı', corba: 'Çorba kazanı', kilim: 'Dokuma tezgahı',
  yogurt: 'Yoğurt küpü', peynir: 'Mandıra', saman: 'Harman makinesi', simit: 'Simit fırını', pogaca: 'Poğaça fırını', un: 'Değirmen', izgara: 'Izgara', havlu: 'Çamaşırhane',
  tursu: 'Turşu fıçısı', guvec: 'Güveç ocağı', pide: 'Pide fırını', tost: 'Tost makinesi', hali: 'Halı tezgahı', balikcorba: 'Çorba kazanı',
  pure: 'Püre makinesi', karpuzsuyu: 'Karpuz sıkacağı', menemen: 'Menemen ocağı' };
const FIELD_HOW = 'Tarlada yetişir; olgunlaşınca tarlanın içinden yürüyüp topla.';
// rafları dolduran elemanlar (Yükselt menüsünde alınır): ilk sıradaki önerilir
const FILL = { koy: ['shelver'], pazar: ['vendor', 'att_pazar'], firin: ['baker', 'att_firin'], iskele: ['fisher', 'att_iskele'], sehir: ['att_sehir'], kasaba: ['att_kasaba'], tatil: ['maid', 'carrier'] };
const KIND = { manav: 'Manav reyonu', kilim: 'Kilim ve yün rafı', firin: 'Fırın rafı' };

let btn = null, badge = null, panel = null, body = null, sumEl = null, open = false, scanT = 0, sig = '', openKey = null, onlyLow = false;
const rows = new Map(); // anahtar → { s, R, name, el, tip, fill, cnt, emp }
const heads = []; // { el, txt, R, keys }
const regOf = new WeakMap(), ids = new WeakMap();
let nextId = 1;
const idOf = (o) => { if (!ids.has(o)) ids.set(o, nextId++); return ids.get(o); };
const nm = (t) => (ITEMS[t] ? ITEMS[t].name : t);
const img = (t) => (G.icons && G.icons[t] ? `<img src="${G.icons[t]}" alt="">` : '📦');
const city = (x) => x > 300; // şehir dünyası (otobüsle gidilir)
try { onlyLow = localStorage.getItem('koyBakkali.rtLow') === '1'; } catch (e) { /* gizli pencere */ }

function regionOf(st) {
  if (regOf.has(st)) return regOf.get(st);
  const x = st.zone.x, z = st.zone.z;
  let R = null;
  for (const id in G.regions) { const r = G.regions[id].rect; if (r && x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) { R = G.regions[id]; break; } }
  regOf.set(st, R);
  return R;
}
const live = (R) => !!(R && R.unlocked && !R.hidden);

function baseName(s, R) {
  const acc = s.acc() || [];
  if (KIND[s.type]) return KIND[s.type];
  if (R.id === 'pazar') return 'Pazar tezgahı';
  if (R.id === 'iskele') return 'Balık tezgahı';
  if (R.id === 'firin') return 'Vitrin';
  if (R.id === 'tatil') return 'Misafir deposu';
  if (acc.some((t) => t === 'sut' || t === 'ksut' || t === 'peynir' || t === 'yogurt')) return 'Süt dolabı';
  return acc.length === 1 ? `${nm(acc[0])} rafı` : 'Karışık raf';
}

// açık bölgelerin satış rafları, bölge bölge (toplanmış pazar tezgahı sayılmaz)
function collect() {
  const per = new Map();
  for (const s of G.stations) {
    if (!(s instanceof Shelf) || s.packed || !s.slots.length) continue;
    const R = regionOf(s);
    if (!live(R)) continue;
    if (!per.has(R)) per.set(R, []);
    per.get(R).push(s);
  }
  return per;
}
const sigOf = (per) => [...per.values()].flat().map(idOf).join(',');
const fillOf = (s) => (s.slots.length ? s.count() / s.slots.length : 0);

function ensureUI() {
  if (panel) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  panel = document.createElement('div'); panel.id = 'rtPanel';
  panel.innerHTML = `<div class="rhd"><b>📋 Raf takip</b><button type="button" class="rx" title="Kapat" aria-label="Kapat">✕</button></div>
    <div class="rsum"></div>
    <div class="rflt"><button type="button" data-f="all">Tüm raflar</button><button type="button" data-f="low">⚠️ Azalanlar</button></div>
    <div class="rbody"></div>`;
  body = panel.querySelector('.rbody'); sumEl = panel.querySelector('.rsum');
  for (const ev of ['pointerdown', 'touchstart', 'wheel']) panel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // oyunda yürüme ve yakınlaştırma başlamasın
  panel.addEventListener('click', onClick);
  (document.getElementById('hud') || document.body).appendChild(panel);
  setFilter(onlyLow);
}

function placeBtn() {
  const bar = document.getElementById('mmBar');
  if (!bar) return;
  if (!btn) {
    btn = document.createElement('button'); btn.id = 'rtBtn'; btn.type = 'button';
    btn.title = 'Raf takip: hangi rafta kaç ürün var'; btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = '<span>📋</span><em></em>';
    badge = btn.querySelector('em');
    btn.addEventListener('click', () => setOpen(!open));
  }
  const at = document.getElementById('cleanTog');
  if (at && at.parentNode === bar) bar.insertBefore(btn, at); else bar.appendChild(btn);
  if (G.rtNew) {
    btn.classList.add('new');
    toast('📋 Raf takip tuşu haritanın üstünde: dokun, bütün raflar tek tabloda');
    G.rtNew = false;
  }
}

function setOpen(v) {
  open = v;
  ensureUI();
  panel.classList.toggle('open', v);
  if (btn) { btn.classList.toggle('on', v); if (v) btn.classList.remove('new'); }
  if (v) { openKey = null; build(collect()); tick(); body.scrollTop = 0; scanT = 0.5; }
}

function setFilter(low) {
  onlyLow = low;
  try { localStorage.setItem('koyBakkali.rtLow', low ? '1' : '0'); } catch (e) { /* gizli pencere */ }
  panel.classList.toggle('low', low);
  for (const b of panel.querySelectorAll('.rflt button')) b.classList.toggle('on', (b.dataset.f === 'low') === low);
}

// tablo: bölgeler sırasıyla (G.regions), bölge içinde en boş raf üstte. Aynı adlı raflar numaralanır (soldan sağa)
function build(per) {
  sig = sigOf(per); rows.clear(); heads.length = 0;
  const order = Object.keys(G.regions).map((k) => G.regions[k]).filter((R) => per.has(R));
  let h = '';
  for (const R of order) {
    const list = per.get(R), names = new Map();
    for (const s of list.slice().sort((a, b) => a.zone.x - b.zone.x || a.zone.z - b.zone.z)) {
      const b = baseName(s, R), n = (names.get(b) || 0) + 1;
      names.set(b, n); s.rtName = b; s.rtNo = n;
    }
    const keys = [];
    h += `<div class="rth" data-r="${R.id}"><span class="rhi">${REG_IC[R.id] || '📍'}</span><b>${R.name}</b><small><span class="rn"></span> · <span class="rp"></span></small></div>`;
    for (const s of list.slice().sort((a, b) => fillOf(a) - fillOf(b))) {
      const k = String(idOf(s)), acc = [...new Set(s.acc() || [])];
      const name = (names.get(s.rtName) > 1 ? `${s.rtName} ${s.rtNo}` : s.rtName);
      const ic = acc.slice(0, 3).map(img).join('') + (acc.length > 3 ? `<span class="rmore">+${acc.length - 3}</span>` : '');
      const prod = acc.slice(0, 4).map(nm).join(' · ') + (acc.length > 4 ? ` · +${acc.length - 4}` : '');
      h += `<div class="rtr" data-k="${k}" role="button" tabindex="0"><span class="rti">${ic}</span><span class="rtn"><b>${name}</b><small>${prod}</small></span>`
        + `<span class="rtb"><span class="rtf"><i></i></span><em></em></span><span class="rte"><b></b><small>boş</small></span></div><div class="rtip" data-k="${k}" hidden></div>`;
      rows.set(k, { s, R, name });
      keys.push(k);
    }
    heads.push({ R, keys });
  }
  body.innerHTML = h ? h + '<p class="rallok">✅ Bütün raflar yarıdan dolu</p>' : '<p class="rnone">Henüz açık bir raf yok.</p>';
  for (const [k, r] of rows) {
    r.el = body.querySelector(`.rtr[data-k="${k}"]`); r.tip = r.el.nextElementSibling;
    r.fill = r.el.querySelector('.rtf i'); r.cnt = r.el.querySelector('.rtb em'); r.emp = r.el.querySelector('.rte b');
  }
  heads.forEach((hd, i) => { hd.el = body.querySelectorAll('.rth')[i]; hd.n = hd.el.querySelector('.rn'); hd.p = hd.el.querySelector('.rp'); });
}

// sayılar yerinde: doluluk çubuğu, dolu/kapasite, boş yer, bölge ve genel özet
function tick() {
  let all = 0, cap = 0, emptyShelves = 0;
  for (const r of rows.values()) {
    const n = r.s.count(), c = r.s.slots.length, f = c ? n / c : 0;
    all += n; cap += c; if (!n) emptyShelves++;
    r.fill.style.width = `${Math.round(f * 100)}%`;
    r.cnt.textContent = `${n}/${c}`;
    r.emp.textContent = c - n;
    r.el.classList.toggle('e0', !n);
    r.el.classList.toggle('l1', f > 0 && f < 0.5 && f >= 0.25);
    r.el.classList.toggle('l2', f < 0.25);
    r.el.classList.toggle('hi', f >= 0.5);
    r.tip.classList.toggle('hi', f >= 0.5);
    r.f = f;
  }
  for (const hd of heads) {
    let n = 0, c = 0;
    for (const k of hd.keys) { const r = rows.get(k); n += r.s.count(); c += r.s.slots.length; }
    hd.n.textContent = `${hd.keys.length} raf`;
    hd.p.textContent = `%${c ? Math.round((n / c) * 100) : 0} dolu`;
    hd.el.classList.toggle('hi', hd.keys.every((k) => rows.get(k).f >= 0.5));
  }
  sumEl.innerHTML = `<span class="rtc"><b>${all.toLocaleString('tr-TR')}</b><small>Rafta ürün</small></span>`
    + `<span class="rtc"><b>${(cap - all).toLocaleString('tr-TR')}</b><small>Boş yer</small></span>`
    + `<span class="rtc${emptyShelves ? ' bad' : ''}"><b>${emptyShelves}</b><small>Boş raf</small></span>`;
  // açık ipucundaki raf sayıları
  const r = openKey && rows.get(openKey);
  if (r) for (const em of r.tip.querySelectorAll('em[data-t]')) em.textContent = r.s.count(em.dataset.t);
}

// ---------- ipucu: ürünün kaynağı ve nasıl üretildiği ----------
// inCity: açıklanan raf ya da makine şehirde mi. Köydeki rafa şehrin kaynağı gösterilmez; şehirdeki rafa önce şehrin kaynağı (depo,
// hal), sonra ürünün köydeki asıl kaynağı (otobüsle)
function sources(t, conv, inCity) {
  const out = [];
  for (const s of G.stations) {
    if (!s.zone || s instanceof Shelf) continue;
    if (s instanceof Generator) { if (s.type === t) out.push(conv.has(s) ? { kind: 'conv', st: s, c: conv.get(s) } : { kind: 'gen', st: s }); }
    else if (s instanceof PlantBed) { if (s.type === t) out.push({ kind: 'bed', st: s }); }
    else if (s instanceof PaidSource) { if (s.types && s.types.includes(t)) out.push({ kind: 'paid', st: s }); }
    else if (s.type === t && !(s instanceof Converter) && (s.pl || typeof s.avail === 'function')) out.push({ kind: 'field', st: s }); // tarla.js toplama tarlaları, köy tarlaları
  }
  const C = G.regions.sehir; // şehir marketinin toptan olmayan malı köy kamyonuyla depoya gelir (city.js)
  if (inCity && live(C) && C.depot && C.depot.zone && ITEMS[t] && !ITEMS[t].cost && (C.shelves || []).some((sh) => (sh.acc() || []).includes(t))) out.push({ kind: 'depot', st: C.depot });
  const p = G.player.position;
  const at = (o) => o.st.zone; // makinede çıkış tepsisi (o.st: makinenin üreticisi)
  return out.filter((o) => { const R = regionOf(o.st); return (!R || live(R)) && (inCity || !city(at(o).x)); })
    .sort((a, b) => (city(at(a).x) !== inCity) - (city(at(b).x) !== inCity) || Math.hypot(at(a).x - p.x, at(a).z - p.z) - Math.hypot(at(b).x - p.x, at(b).z - p.z));
}
function nameOf(st) { try { return genName(st); } catch (e) { return null; } }
function describe(o, t) {
  const st = o.st;
  if (o.kind === 'bed') {
    const R = regionOf(st);
    if (t === 'bugday' || t === 'kocan' || (R && /tarla/.test(R.id))) return { icon: '🌾', name: 'Tarla', how: FIELD_HOW }; // köy tarlasının buğday ve koçan yatakları
    return { icon: '🌱', name: 'Bostan', how: 'Bostanda kendiliğinden yetişir; olgunlaşınca fidenin üstünden geçip topla.' };
  }
  if (o.kind === 'field') return { icon: '🌾', name: 'Tarla', how: FIELD_HOW };
  if (o.kind === 'depot') return { icon: '🚚', name: 'Şehir deposu', how: 'Köy kamyonu getirip depo paletine yığar; oradan al.' };
  if (o.kind === 'paid') { const R = regionOf(st); return { icon: '🚚', name: R && R.id === 'sehir' ? 'Hal paleti' : st.types.length > 1 ? 'Sebze kamyoneti' : 'Toptancı', how: `Satın alınır · tanesi ${(ITEMS[t] && ITEMS[t].cost) || 0} ₺` }; }
  const g = nameOf(st), a = ANIM[t];
  if (o.kind === 'conv') return { icon: (g && g.icon) || '⚙️', name: (g && g.name) || MACH[t] || `${nm(t)} makinesi`, how: 'Malzemeyi makinenin tepsisine koy; ürün çıkış tepsisine dizilir, oradan al.' };
  return { icon: (g && g.icon) || (a && a[0]) || '📦', name: (g && g.name) || (a && a[1]) || 'Üretim tepsisi', how: (a && a[2]) || 'Kendiliğinden üretilir; tepsisinden al.' };
}
function goBtn(z, label, small) {
  if (city(z.x) !== (G.world === 'sehir')) return `<span class="rgo${small ? ' sm' : ''}">🚌 <span>Otobüsle</span></span>`;
  const p = G.player.position, d = Math.round(Math.hypot(z.x - p.x, z.z - p.z));
  return `<button type="button" class="rgo${small ? ' sm' : ''}" data-x="${z.x.toFixed(2)}" data-z="${z.z.toFixed(2)}">➤${label ? ` <span>${label}</span>` : ''} <i>${d} m</i></button>`;
}
function recipe(c, t, conv) {
  const ins = new Map();
  for (const it of c.recipe || Array(c.need || 1).fill(c.inType)) ins.set(it, (ins.get(it) || 0) + 1);
  const chip = (it, n) => `<span class="rci">${img(it)}<i>${n}×</i><b>${nm(it)}</b></span>`;
  let h = `<p class="rcv">${[...ins].map(([it, n]) => chip(it, n)).join('<small class="rar">+</small>')}<small class="rar">→</small>${chip(t, c.per || 1)}</p>`;
  for (const it of [...ins.keys()].slice(0, 3)) {
    const s2 = FROM[it] ? null : sources(it, conv, city(c.zone.x))[0];
    if (!s2) { h += `<p class="rin"><small>Girdi</small><b>${nm(it)}</b><small>·</small><span>${FROM[it] || 'Kaynağı henüz açılmadı'}</span></p>`; continue; }
    const d2 = describe(s2, it), R2 = regionOf(s2.st);
    h += `<p class="rin"><small>Girdi</small><b>${nm(it)}</b><small class="rar">←</small><span>${d2.icon}</span><b>${d2.name}</b>${R2 ? `<small>${R2.name}</small>` : ''}${goBtn(s2.st.zone, '', true)}</p>`;
  }
  return h;
}
function fillHint(R) {
  const ks = (FILL[R.id] || [`att_${R.id}`]).filter((k) => UPG[k]);
  if (!ks.length) return '';
  const have = ks.filter((k) => (G.upg[k] || 0) > 0);
  if (have.length) return `<p class="rfill ok">✅ ${have.map((k) => `<b>${UPG[k].name}</b>${G.upg[k] > 1 ? `<i>×${G.upg[k]}</i>` : ''}`).join('<i>·</i>')} <span>bu rafları dolduruyor</span></p>`;
  return `<p class="rfill no">💡 <b>${UPG[ks[0]].name}</b> <span>alırsan bu rafları senin yerine doldurur (Yükselt menüsü)</span></p>`;
}
function tipHTML(r) {
  const { s, R } = r, acc = [...new Set(s.acc() || [])], conv = new Map(), inCity = city(s.zone.x);
  for (const st of G.stations) if (st instanceof Converter && st.out) conv.set(st.out, st);
  let h = `<div class="rpt"><small>📍</small><b>${R.name}</b>${goBtn(s.zone, 'Rafa git')}</div>`;
  for (const t of acc.slice(0, 8)) {
    h += `<div class="rpp">${img(t)}<b>${nm(t)}</b><span class="rpn"><em data-t="${t}">${s.count(t)}</em><small>rafta</small></span><span class="rpr">${ITEMS[t] ? ITEMS[t].price : ''} ₺</span></div>`;
    const src = sources(t, conv, inCity);
    if (!src.length) { h += `<p class="rno">🔒 <span>Kaynağı henüz açılmadı</span></p>`; continue; }
    for (const o of src.slice(0, 2)) {
      const d = describe(o, t), R2 = regionOf(o.st);
      h += `<div class="rsrc"><div class="rsh"><span class="rsi">${d.icon}</span><span class="rsn"><b>${d.name}</b>${R2 ? `<small>${R2.name}</small>` : ''}</span>${goBtn(o.st.zone, 'Oraya git')}</div>`
        + (o.kind === 'conv' ? recipe(o.c, t, conv) : '') + `<p class="rhow">${d.how}</p></div>`;
    }
  }
  return h + fillHint(R);
}
function toggleTip(k) {
  const prev = openKey && rows.get(openKey);
  if (prev) { prev.tip.hidden = true; prev.tip.innerHTML = ''; prev.el.classList.remove('op'); }
  if (openKey === k) { openKey = null; return; }
  const r = rows.get(k);
  if (!r) { openKey = null; return; }
  openKey = k;
  r.tip.innerHTML = tipHTML(r); r.tip.hidden = false; r.el.classList.add('op');
  r.tip.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function onClick(e) {
  const go = e.target.closest('button.rgo');
  if (go) {
    const ok = G.hooks.goTo && G.hooks.goTo(+go.dataset.x, +go.dataset.z);
    if (ok) setOpen(false); else toast('🧭 Oraya yol bulunamadı');
    return;
  }
  if (e.target.closest('.rx')) { setOpen(false); return; }
  const f = e.target.closest('.rflt button');
  if (f) { setFilter(f.dataset.f === 'low'); return; }
  const row = e.target.closest('.rtr');
  if (row) toggleTip(row.dataset.k);
}

export function updateRafTakip(dt) {
  if (!G.player || !G.upg) return;
  if (!G.upg.rafTakip || G.visit) { // alınmadıysa (ya da oyun sıfırlandıysa) ve komşunun köyündeyken düğme yok
    if (btn) { btn.remove(); btn = null; badge = null; }
    if (open) setOpen(false);
    return;
  }
  ensureUI();
  if (!btn || !btn.isConnected) placeBtn();
  if ((scanT -= dt) > 0) return;
  scanT = open ? 0.5 : 1;
  const per = collect();
  if (badge) {
    let empty = 0;
    for (const list of per.values()) for (const s of list) if (!s.count()) empty++;
    badge.textContent = empty; badge.classList.toggle('on', empty > 0);
  }
  if (open) { if (sigOf(per) !== sig) { const k = openKey; build(per); openKey = null; if (k && rows.has(k)) toggleTip(k); } tick(); }
}
// test kancası: paneli aç/kapat, satıra dokun
window.__rafTakip = { open: () => setOpen(true), close: () => setOpen(false), tip: (i) => { const k = [...rows.keys()][i || 0]; if (k) toggleTip(k); return k; }, rows: () => rows.size };
