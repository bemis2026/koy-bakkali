// Tatil (2026-11-02 kullanıcı: "para harcanarak çok yüksek bedellere avatar kendine tatil alabilsin ve gidip tatil yapalım orda; ara ara
// çalışmaktan sıkılsın, çok çalışınca sıkılsın, tatile gitmesi gereksin; tatiller elmas gibi özel parayla da alınabilsin").
// Kararlar (seçmeli soru): sıkılan avatar yavaşlar ve az taşır; elmas günlük görevlerden (gorev.js) ve reklam izleyerek gelir;
// tatil ayrı bir adada (Martı Adası, x 900) geçer; adada istediğin kadar kalırsın, en az 1 dakika kalınca sıkılma sıfırlanır,
// dönüşte 10 dakika dinçsin (hızlı yürür, çok taşırsın). 2026-11-08: dinlenme süreyle değil adadaki "Tatil keyfi" barıyla ölçülür (aşağıda).
// Keyif: oyuncu ürün aldıkça ve bıraktıkça sıkılma artar (G.stats.sik, 0-100; seviye 10'dan önce artmaz: erken oyun etkilenmez).
// Hız ve taşıma kapasitesi main.js ve upgrades.js'e dokunmadan G.speedMul ve G.stack.cap okuyucularıyla ayarlanır.
// Tatil acentesi İpek Yolu kapısının yanında, seviye 10'da gelir (openAgency); tekne iskelenin ucundan kalkar. Köy sen yokken elemanlarla çalışır.
import * as THREE from 'three';
import * as M from './models.js';
import { G, Station, floatText, sfx, toast, rand, popIn } from './game.js';
import { buildIsle, updateIsle, voyage, isleSpeedK, isleRelaxK, fun } from './adacanli.js';
import { JETTY } from './ada.js';
import { textTex } from './tex.js';

const AGENCY = { x: -22.4, z: -41.2 }; // köydeki acente: İpek Yolu kapısının yanında, kervansarayın batısındaki çimende (2026-11-03'e kadar sahilde nehir ağzındaydı, büfe ve şemsiyeler arasında sıkışıktı)
export const LEVEL0 = 10; // sıkılma bu seviyeden sonra başlar
let agency = null, agencyOn = false;
const WORK = 0.1; // ürün başına sıkılma (dakikada ~30 ürünle ~30 dakikada dolar)
// tatil keyfi barı (2026-11-08 kullanıcı: "tatil adasında dinlenme eğlenme gibi bir barı dolduralım o dolunca tam enerjiyle dönelim bunu
// göster bu mekaniği optimize et"). Bar her yolculukta sıfırdan dolar (%/sn): şezlongda ve hamakta en hızlı, denizde, masada, dansta,
// araçta hızlı, gezerken yavaş; adada yapılan her yeni şey +%8, yemek, gol, paraşüt inişi gibi anlar da ekler (adacanli.js relax).
// Sıkılma barla birlikte azalır, dolunca sıfır. Dolunca tam enerji: dönüşte 20 dk dinçlik ve dolu Shift enerjisi (dinçken yarı hızda biter,
// yetenek.js G.dinc); barda "Köye dön" düğmesi çıkar, iskeleye yürümek gerekmez. Yarım barla dönülürse dinçlik barla orantılı (%25'ten azsa yok).
// Ölçü: yalnız şezlongda ~75 sn, etkinliklerle ~1 dk, yalnız gezerek ~5 dk.
const FILL = { lie: 1.35, act: 0.75, walk: 0.32 };
const NEW_FUN = 8, FULL_MIN = 20, MIN_PART = 25;
export const GEM_PRICE = 6;
export const tripPrice = () => Math.round((20000 + 4000 * (G.level || 1)) / 1000) * 1000; // çok yüksek: seviye 20'de 100.000 ₺
// reklamla elmas: Google AdSense H5 oyun reklamları (ödüllü reklam). Hesap kimliği (ca-pub-...) girilince açılır; boşken düğme görünmez
const ADS_CLIENT = '';
const ADS_PER_DAY = 3;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const S = () => G.stats;
export const onIsle = () => !!(G.player && G.player.position.x > 700);
const dinc = () => (S().dincUntil || 0) > (S().time || 0);
// sıkılmanın etkisi: %70'te biraz, tam doluyken çok yavaş ve az taşır; dinçken hızlı ve çok taşır
const spdK = () => (onIsle() ? isleSpeedK() : dinc() ? 1.25 : (S().sik || 0) >= 100 ? 0.72 : (S().sik || 0) >= 70 ? 0.9 : 1);
const capK = () => (onIsle() || dinc() ? 1 : (S().sik || 0) >= 100 ? 0.6 : (S().sik || 0) >= 70 ? 0.85 : 1);
const capAdd = () => (dinc() && !onIsle() ? 1 : 0); // 2 idi; taşıma en çok 8 (upgrades.js cap), dinçken 9

// ---------- keyif ----------
let warned = 0, yawnT = 6;
function work() {
  if (!agencyOn || onIsle() || dinc()) return; // acente yokken sıkılma da yok
  const before = S().sik || 0;
  S().sik = Math.min(100, before + WORK);
  if (before < 70 && S().sik >= 70 && warned < 1) { warned = 1; toast('😐 Avatarın çalışmaktan sıkılmaya başladı: biraz yavaşladı. İpek Yolu kapısındaki 🏝️ Tatil Acentesi iyi gelir'); }
  if (before < 100 && S().sik >= 100 && warned < 2) { warned = 2; toast('😩 Çok sıkıldın: yavaş yürüyor, az taşıyorsun. Tatile git! 🏝️ İpek Yolu kapısındaki Tatil Acentesi'); sfx('bad'); }
}
let hooked = false;
function hook() {
  const st = G.stack;
  if (hooked || !st) return;
  hooked = true;
  // hız ve kapasite: yükseltmeler temel değeri yazar, oyun keyfe göre ayarlanmışını okur
  let baseSpd = G.speedMul ?? 1, baseCap = st.cap;
  Object.defineProperty(G, 'speedMul', { configurable: true, get: () => baseSpd * spdK(), set: (v) => { baseSpd = v; } });
  Object.defineProperty(st, 'cap', { configurable: true, get: () => Math.max(2, Math.round(baseCap * capK()) + capAdd()), set: (v) => { baseCap = v; } });
  const push = st.push.bind(st), takeOf = st.takeOf.bind(st);
  st.push = (...a) => { const r = push(...a); work(); return r; };
  st.takeOf = (...a) => { const r = takeOf(...a); if (r) work(); return r; };
}

// ---------- ekran: elmas ve keyif rozeti (görev rozetinin yanında), dokununca açıklama ----------
let chip = null, pop = null, posT = 0;
const CSS = `#tatilChip { position: absolute; display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px; border-radius: 999px; font: 15px var(--font-title); cursor: pointer; white-space: nowrap; pointer-events: auto; z-index: 6; }
#tatilChip .mood { width: 34px; height: 7px; border-radius: 4px; background: rgba(0,0,0,.14); overflow: hidden; }
#tatilChip .mood i { display: block; height: 100%; border-radius: 4px; background: #4cc26b; transition: width .4s, background .4s; }
#tatilChip.dinc { box-shadow: 0 0 0 2px #ffd23f inset; }
#tatilPop { position: absolute; width: min(300px, calc(100vw - 28px)); padding: 10px 12px; border-radius: 16px; display: none; z-index: 30; font: 14px/1.4 var(--font-body); pointer-events: auto; }
#tatilPop.on { display: block; }
#tatilPop h5 { margin: 0 0 6px; font: 17px var(--font-title); font-weight: normal; }
#tatilPop .row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
#tatilPop button { flex: 1; min-width: 120px; padding: 7px 8px; border-radius: 12px; border: none; font: 15px var(--font-title); cursor: pointer; background: #4cc26b; color: #fff; }
#tatilPop button.gem { background: #6c8cff; }
#tatilPop button.ad { background: #f2a33a; }
#tatilPop button:disabled { opacity: .45; cursor: default; }
@media (max-width: 640px) { #tatilChip { font-size: 13px; padding: 2px 8px 2px 6px; gap: 4px; } #tatilChip .mood { width: 26px; height: 6px; } }`;
function ui() {
  if (chip) return;
  const hud = document.getElementById('hud') || document.body;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  chip = document.createElement('div'); chip.id = 'tatilChip'; chip.className = 'hp';
  chip.innerHTML = '<span class="gem">💎 <b>0</b></span><span class="face">🙂</span><span class="mood"><i></i></span>';
  pop = document.createElement('div'); pop.id = 'tatilPop'; pop.className = 'hp';
  hud.append(chip, pop);
  chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); showPop(!pop.classList.contains('on'), false); });
  pop.addEventListener('pointerdown', (e) => e.stopPropagation());
}
function mood() { const k = S().sik || 0; return k >= 100 ? '😩' : k >= 70 ? '😐' : dinc() ? '⚡' : '🙂'; }
function place() {
  const tc = document.getElementById('taskChip');
  if (!chip) return;
  if (tc && tc.offsetParent) { const r = tc.getBoundingClientRect(), h = chip.parentElement.getBoundingClientRect(); chip.style.left = `${r.right - h.left + 6}px`; chip.style.top = `${r.top - h.top}px`; chip.style.bottom = 'auto'; }
  else { chip.style.left = '14px'; chip.style.top = '230px'; }
  const cr = chip.getBoundingClientRect(), h = chip.parentElement.getBoundingClientRect();
  const below = cr.top - h.top + cr.height + 6, above = h.bottom - cr.top + 6;
  if (cr.top - h.top > h.height / 2) { pop.style.top = 'auto'; pop.style.bottom = `${above}px`; } else { pop.style.bottom = 'auto'; pop.style.top = `${below}px`; }
  pop.style.left = `${Math.max(8, Math.min(cr.left - h.left, h.width - (pop.offsetWidth || 324) - 8))}px`; // ekrandan taşmaz
}
function refresh() {
  if (!chip) return;
  chip.querySelector('b').textContent = (S().elmas || 0).toLocaleString('tr-TR');
  chip.querySelector('.face').textContent = mood();
  const k = S().sik || 0, bar = chip.querySelector('.mood i');
  bar.style.width = `${100 - k}%`; bar.style.background = k >= 100 ? '#e8473c' : k >= 70 ? '#f2a33a' : '#4cc26b';
  chip.classList.toggle('dinc', dinc());
}
// açıklama ya da (acentede) tatil satın alma penceresi
let shop = false;
function showPop(on, atAgency) {
  shop = on && atAgency;
  pop.classList.toggle('on', on);
  if (!on) return;
  const k = Math.round(S().sik || 0), price = tripPrice(), gems = S().elmas || 0;
  const left = dinc() ? Math.ceil(((S().dincUntil || 0) - (S().time || 0)) / 60) : 0;
  const ad = adsOn() && adsLeft() > 0;
  pop.innerHTML = `<h5>${atAgency ? '🏝️ Tatil Acentesi' : `${mood()} Keyif ve elmas`}</h5>
    <div>Sıkılma: <b>%${k}</b>${(G.level || 1) < LEVEL0 ? ` (seviye ${LEVEL0}'dan sonra başlar)` : ''}. Çok çalışınca sıkılırsın: %70'te biraz, %100'de çok yavaş yürür ve az taşırsın.</div>
    ${left ? `<div>⚡ Dinçsin: ${left} dk daha hızlı yürür, 1 ürün fazla taşırsın.</div>` : ''}
    <div>💎 Elmas: <b>${gems}</b>. Günlük görevlerden kazanılır${adsOn() ? ', reklam izleyerek de' : ''}.</div>
    ${atAgency ? `<div style="margin-top:6px">Martı Adası'na büyük cruise gemisiyle gidersin: denize gir, şezlongda uzan, voleybol ve futbol oyna, jetski ya da yunus turu, dağa tırman. Adada 🌴 Tatil keyfi barını doldur: şezlongda ve hamakta en hızlı, denizde, oyunda, dansta da dolar; her yeni etkinlik +%8. Dolunca köye tam enerjiyle dönersin: 20 dakika hızlı yürür, 1 ürün fazla taşırsın. Köy sen yokken elemanlarla çalışır.</div>
    <div class="row"><button type="button" data-go="tl" ${G.money < price ? 'disabled' : ''}>${price.toLocaleString('tr-TR')} ₺ ile git</button><button type="button" class="gem" data-go="gem" ${gems < GEM_PRICE ? 'disabled' : ''}>${GEM_PRICE} 💎 ile git</button></div>`
    : `<div style="margin-top:6px">${agencyOn ? '🏝️ Tatil Acentesi İpek Yolu kapısının yanında.' : `🏝️ Tatil Acentesi ${LEVEL0}. seviyede, Kervansaray açıkken gelir.`}</div>`}
    ${ad ? `<div class="row"><button type="button" class="ad" data-ad="1">📺 Reklam izle, +1 💎 (bugün ${adsLeft()})</button></div>` : ''}`;
  for (const b of pop.querySelectorAll('[data-go]')) b.addEventListener('click', () => buy(b.dataset.go));
  const ab = pop.querySelector('[data-ad]'); if (ab) ab.addEventListener('click', () => watchAd());
}

// ---------- reklam (ödüllü) ----------
const adsOn = () => !!ADS_CLIENT && typeof window.adBreak === 'function';
const today = () => Math.floor(Date.now() / 864e5);
const adsLeft = () => (S().adDay === today() ? ADS_PER_DAY - (S().adN || 0) : ADS_PER_DAY);
function initAds() {
  if (!ADS_CLIENT || document.getElementById('adsbygoogle-js')) return;
  const s = document.createElement('script'); s.id = 'adsbygoogle-js'; s.async = true; s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;
  s.dataset.adFrequencyHint = '30s';
  document.head.appendChild(s);
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = (o) => window.adsbygoogle.push(o);
}
function watchAd() {
  if (!adsOn() || adsLeft() <= 0) return;
  window.adBreak({ type: 'reward', name: 'elmas', beforeReward: (show) => show(), adViewed: () => {
    if (S().adDay !== today()) { S().adDay = today(); S().adN = 0; }
    S().adN = (S().adN || 0) + 1; addGems(1, 'reklam');
    showPop(pop.classList.contains('on'), shop);
  }, adDismissed: () => toast('📺 Reklam yarıda kaldı, elmas verilmedi'), adBreakDone: () => {} });
}
export function addGems(n, from = '') {
  S().elmas = (S().elmas || 0) + n;
  if (G.player) floatText(G.player.position.clone().setY(2.6), `💎 +${n}${from ? ` ${from}` : ''}`, 'pos');
  refresh();
}

// ---------- köydeki acente ----------
class Agency extends Station {
  // işaret taş meydancığın (üstü 0,05) üstünde: 0,04'teyken taşın altında kalıyor, durulacak yer görünmüyordu (2026-11-04 kullanıcı)
  constructor(x, z) { super(x, z, 2.2, 1.6, { dashed: true, y: 0.075 }); this.dwell = 0; }
  update(dt) {
    const sp = this.lp ? Math.hypot(G.player.position.x - this.lp.x, G.player.position.z - this.lp.z) / Math.max(dt, 1e-3) : 0;
    this.lp = { x: G.player.position.x, z: G.player.position.z };
    this.dwell = this.inside && sp < 0.8 ? this.dwell + dt : 0;
    if (this.dwell > 0.5 && !shop) showPop(true, true);
    if (!this.inside && shop) showPop(false, false);
  }
}
class Return extends Station {
  constructor(x, z) { super(x, z, 2.2, 1.6, { dashed: true, y: JETTY.y + 0.03 }); this.dwell = 0; }
  update(dt) {
    this.dwell = this.inside ? this.dwell + dt : 0;
    if (this.dwell > 1.2 && !busy) { this.dwell = 0; travel(false); }
  }
}
// 2026-11-04 kullanıcı: "tatile gitme yerini geliştir" (seçim: köydeki acente de ada da). Büfe yerine badanalı küçük bir seyahat bürosu:
// camında Martı Adası afişi, çizgili tente, çatıda tabela ve bayrak; önünde sefer panosu, bavullu bekleme bankı, döner dünya küresi
let globe = null, flag = null;
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const FONT = (n, px) => `${n} ${px}px 'Nunito','Segoe UI',sans-serif`;
const posterTex = () => canvasTex(512, 352, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, '#5ec8f2'); sky.addColorStop(1, '#c4ecff'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(w * 0.82, h * 0.22, 32, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1f9fd6'; g.fillRect(0, h * 0.58, w, h * 0.42);
  g.fillStyle = '#5bb04a'; g.beginPath(); g.ellipse(w * 0.4, h * 0.6, w * 0.3, h * 0.17, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#8a8f78'; g.beginPath(); g.moveTo(w * 0.28, h * 0.6); g.lineTo(w * 0.4, h * 0.34); g.lineTo(w * 0.53, h * 0.6); g.fill();
  g.fillStyle = '#f2dc9a'; g.beginPath(); g.ellipse(w * 0.4, h * 0.62, w * 0.33, h * 0.045, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(w * 0.62, h * 0.66); g.lineTo(w * 0.96, h * 0.66); g.lineTo(w * 0.93, h * 0.74); g.lineTo(w * 0.65, h * 0.74); g.fill();
  g.fillRect(w * 0.69, h * 0.6, w * 0.19, h * 0.06); g.fillStyle = '#2fb5a8'; g.fillRect(w * 0.83, h * 0.54, w * 0.04, h * 0.06);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h * 0.8, w, h * 0.2);
  g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = FONT(900, 46); g.fillText('MARTI ADASI', w / 2, h * 0.935);
  g.fillStyle = '#16465e'; g.font = FONT(900, 30); g.fillText('Cruise ile tatil!', w / 2, h * 0.13);
});
const boardTex = () => canvasTex(384, 256, (g, w, h) => {
  g.fillStyle = '#16303f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2fb5a8'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.textAlign = 'left'; g.fillStyle = '#ffd34d'; g.font = FONT(900, 34); g.fillText('🚢 SEFERLER', 24, 54);
  g.font = FONT(800, 27); g.fillStyle = '#ffffff'; g.fillText('Martı Adası', 24, 112); g.fillText('Her gün', 24, 160);
  g.textAlign = 'right'; g.fillStyle = '#7dffb0'; g.fillText('HAZIR', w - 24, 112); g.fillText('✓', w - 24, 160);
  g.textAlign = 'left'; g.fillStyle = '#9fc7d6'; g.font = FONT(700, 22); g.fillText('Bilet: ₺ ya da 💎', 24, 216);
});
const stripeTex = () => canvasTex(256, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#2fb5a8'; g.fillRect((i * w) / 8, 0, w / 8, h); } });
const globeTex = () => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#2f86c9'; g.fillRect(0, 0, w, h); g.fillStyle = '#6fbf5a';
  for (const [x, y, rx, ry] of [[40, 40, 26, 18], [62, 78, 14, 26], [120, 36, 30, 16], [134, 70, 16, 22], [190, 46, 34, 20], [214, 92, 14, 10], [100, 108, 40, 6]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2); g.fill(); }
});
const flagTex = () => canvasTex(96, 64, (g) => {
  g.fillStyle = '#e30a17'; g.fillRect(0, 0, 96, 64); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(36, 32, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e30a17'; g.beginPath(); g.arc(40, 32, 12.8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffffff'; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.4 : 8; g.lineTo(55 + Math.cos(a - Math.PI / 2) * r, 32 + Math.sin(a - Math.PI / 2) * r); } g.fill();
});
function buildAgency(scene) {
  const g = new THREE.Group(); g.name = 'tatil-acente'; g.visible = false; scene.add(g); // seviyesi gelene kadar gizli (openAgency)
  const X = AGENCY.x, Z = AGENCY.z, F = Z + 0.55, CZ = Z - 1.15; // ön cephe güneye (+z), arkası kuzeye
  const wall = M.mat('#f4efe4'), teal = M.mat('#2fb5a8'), base = M.mat('#c9bfae'), dark = M.mat('#2c3a44');
  M.rbox(5.2, 3.0, 3.4, 0.05, wall, X, 1.5, CZ, g);
  M.rbox(5.4, 0.3, 3.6, 0.03, base, X, 0.15, CZ, g);
  M.rbox(5.5, 0.24, 3.7, 0.04, teal, X, 3.1, CZ, g);
  // vitrin: Martı Adası afişi, koyu çerçeve, pencere önü
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.55), new THREE.MeshStandardMaterial({ map: posterTex(), roughness: 0.35 }));
  win.position.set(X - 1.05, 1.55, F + 0.012); g.add(win);
  for (const [w, h, x, y] of [[2.5, 0.1, X - 1.05, 2.37], [2.5, 0.1, X - 1.05, 0.73], [0.1, 1.74, X - 2.25, 1.55], [0.1, 1.74, X + 0.15, 1.55]]) M.rbox(w, h, 0.08, 0.02, dark, x, y, F + 0.03, g);
  M.rbox(2.6, 0.08, 0.3, 0.02, base, X - 1.05, 0.66, F + 0.12, g);
  // kapı: camlı üst yarı, pirinç kol
  M.rbox(1.0, 2.15, 0.08, 0.02, M.mat('#1f7f78'), X + 1.45, 1.13, F + 0.03, g);
  M.rbox(0.7, 0.8, 0.02, 0.01, M.mat('#bfe6ee', { rough: 0.2 }), X + 1.45, 1.6, F + 0.075, g);
  M.rbox(1.2, 0.1, 0.12, 0.02, dark, X + 1.45, 2.25, F + 0.04, g);
  M.cyl(0.035, 0.035, 0.18, 8, M.mat('#d8b24a', { rough: 0.3 }), X + 1.12, 1.05, F + 0.1, g).rotation.x = Math.PI / 2;
  // çizgili tente ve sarkan saçağı
  const st = M.mat('#ffffff', { map: stripeTex() });
  M.rbox(5.0, 0.05, 1.15, 0.02, st, X, 2.62, F + 0.5, g).rotation.x = 0.32;
  M.rbox(5.0, 0.22, 0.03, 0.01, st, X, 2.32, F + 1.05, g);
  // çatıda tabela ve bayrak
  M.rbox(4.4, 0.72, 0.12, 0.06, M.mat('#ffffff', { map: textTex('MARTI TUR · SEYAHAT ACENTESİ', { bg: '#2fb5a8', border: '#ffffff', w: 768, h: 126 }) }), X, 3.75, F - 0.3, g);
  for (const sx of [-1.6, 1.6]) M.cyl(0.04, 0.04, 0.5, 6, dark, X + sx, 3.35, F - 0.36, g);
  M.cyl(0.03, 0.03, 2.2, 6, M.mat('#dddddd'), X - 2.3, 4.3, CZ - 1.3, g);
  flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide, roughness: 0.8 }));
  flag.geometry.translate(0.45, 0, 0); flag.position.set(X - 2.3, 5.05, CZ - 1.3); g.add(flag);
  // kapının iki yanında saksıda çalı
  for (const sx of [0.72, 2.18]) { M.cyl(0.2, 0.15, 0.36, 10, M.mat('#b5653a'), X + sx, 0.18, F + 0.3, g); const b = M.makeBush(0.45); b.position.set(X + sx, 0.32, F + 0.3); g.add(b); }
  // sefer panosu
  for (const sx of [-0.55, 0.55]) M.cyl(0.05, 0.05, 1.6, 8, dark, X - 2.35 + sx, 0.8, Z + 1.5, g);
  M.rbox(1.45, 1.0, 0.08, 0.03, dark, X - 2.35, 1.72, Z + 1.5, g);
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.88), new THREE.MeshBasicMaterial({ map: boardTex() })); bd.position.set(X - 2.35, 1.72, Z + 1.545); g.add(bd);
  // dünya küresi: ayakta döner
  M.cyl(0.22, 0.3, 0.9, 12, base, X + 2.35, 0.45, Z + 1.5, g);
  globe = new THREE.Group(); globe.position.set(X + 2.35, 1.38, Z + 1.5); globe.rotation.z = 0.41; g.add(globe);
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 16), new THREE.MeshStandardMaterial({ map: globeTex(), roughness: 0.5 })));
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 32), M.mat('#c9a04a', { rough: 0.3 })); meridian.position.copy(globe.position); meridian.rotation.set(0, Math.PI / 2, 0.41); g.add(meridian);
  // bekleme bankı ve bavullar
  const bench = M.makeBench(); bench.position.set(X - 4.5, 0, Z + 1.0); g.add(bench);
  for (const [sx, c, h] of [[-3.55, '#d9534f', 0.62], [-5.45, '#3f7fbf', 0.5]]) {
    M.rbox(0.42, h, 0.26, 0.05, M.mat(c), X + sx, h / 2 + 0.06, Z + 1.05, g);
    M.rbox(0.2, 0.05, 0.05, 0.01, dark, X + sx, h + 0.1, Z + 1.05, g);
    for (const dx of [-0.13, 0.13]) M.cyl(0.04, 0.04, 0.04, 8, dark, X + sx + dx, 0.04, Z + 1.05, g).rotation.z = Math.PI / 2;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const stone = M.mat('#d8c39b'); // önündeki taş meydancık ve İpek Yolu'na bağlanan patika
  M.rbox(9.6, 0.05, 6.2, 0.02, stone, X - 1.6, 0.025, Z + 1.9, g);
  M.rbox(X - 6.4 + 28.6, 0.05, 1.8, 0.02, stone, (X - 6.4 - 28.6) / 2, 0.025, Z + 3.4, g);
  const cols = [[X - 2.75, X + 2.75, CZ - 1.85, F + 0.15], [X - 3.0, X - 1.7, Z + 1.35, Z + 1.65], [X + 2.0, X + 2.7, Z + 1.15, Z + 1.85], [X - 5.7, X - 3.3, Z + 0.7, Z + 1.3]];
  agency = { g, cols, walk: [-28.8, X + 3.4, Z - 1.4, Z + 5.2], at: [X, Z + 3.2] }; // patika ve meydancık yürünür (çimen bölge dışında kalıyordu)
  // durulacak yer: kesik çizgili işaretin altında turkuaz zemin ve ada simgesi (bej taşın üstünde beyaz çizgi tek başına seçilmiyordu)
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshBasicMaterial({ map: canvasTex(220, 160, (c, w, h) => {
    c.fillStyle = 'rgba(47,181,168,0.45)'; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, 22); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = FONT(900, 64); c.fillText('🏝️', w / 2, h / 2 - 6);
  }), transparent: true, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(X, 0.07, Z + 3.2); pad.renderOrder = 1; g.add(pad);
}
// 2026-11-06 kullanıcı: "acenta da ilerleyen levellerde açılmalı": sıkılmanın başladığı seviyede gelir; patikası İpek Yolu'na çıktığı için
// Kervansaray da açık olmalı (roads.js openRoad)
const agencyDue = () => (G.level || 1) >= LEVEL0 && G.regions.han && G.regions.han.unlocked;
function openAgency(instant) {
  agencyOn = true; agency.g.visible = true;
  G.colliders.push(...agency.cols);
  (G.walkways || (G.walkways = [])).push(agency.walk);
  new Agency(...agency.at);
  if (instant) return;
  let d = 0;
  for (const ch of agency.g.children) { if (ch.isMesh && ch.geometry.type === 'PlaneGeometry') continue; popIn(ch, d); d += 0.01; }
  toast('🏝️ Seyahat acentesi açıldı: İpek Yolu kapısının yanında. Sıkılınca tatile buradan gidersin');
}

// ---------- Martı Adası (karası ada.js, canlıları ve hizmetleri adacanli.js) ----------
function isleWorld(scene) {
  buildIsle(scene);
  const x = JETTY.x0 + 28, sg = M.makeSign('🚢 KÖYE DÖNÜŞ', '#2fb5a8', 2.6, 0.65);
  sg.position.set(x + 2.4, JETTY.y, JETTY.z + 0.9); G.scene.add(sg);
  new Return(x, JETTY.z); // geminin yanındaki iskele başı
}

// ---------- yolculuk ----------
let busy = false, fadeEl = null;
function fade() {
  if (fadeEl) return fadeEl;
  fadeEl = document.createElement('div');
  fadeEl.style.cssText = 'position:fixed;inset:0;z-index:50;background:#1d4f66;opacity:0;pointer-events:none;transition:opacity .45s ease;display:grid;place-items:center;color:#fff;font:28px var(--font-title);text-align:center';
  fadeEl.innerHTML = '<b></b>';
  document.body.appendChild(fadeEl);
  return fadeEl;
}
function buy(how) {
  if (busy) return;
  if (how === 'gem') { if ((S().elmas || 0) < GEM_PRICE) return; S().elmas -= GEM_PRICE; floatText(G.player.position.clone().setY(2.4), `💎 -${GEM_PRICE}`, 'neg'); }
  else { const p = tripPrice(); if (G.money < p) return; G.money -= p; floatText(G.player.position.clone().setY(2.4), `🏝️ -${p.toLocaleString('tr-TR')} ₺`, 'neg'); }
  showPop(false, false);
  travel(true);
}
const trip = { t: 0, keyif: 0, sik0: 0, full: false, rate: 'walk' };
function travel(go) {
  busy = true;
  const el = fade();
  el.querySelector('b').innerHTML = go ? "🚢 Cruise gemisi Martı Adası'na kalkıyor…<br><small>Köy sen yokken çalışmaya devam eder</small>" : '🚢 Gemiye biniliyor…';
  el.style.opacity = '1';
  sfx('open');
  setTimeout(() => {
    if (go) {
      if (M.setSwimwear) M.setSwimwear(G.player, true); // adada mayoyla gezer
      trip.t = 0; trip.keyif = 0; trip.full = false; trip.sik0 = S().sik || 0; G.world = 'ada';
      voyage(true, () => { busy = false; });
    } else voyage(false, () => { // gemi açılınca köye geçilir
      el.querySelector('b').innerHTML = '🚢 Köye dönülüyor…';
      el.style.opacity = '1';
      setTimeout(() => {
        if (M.setSwimwear) M.setSwimwear(G.player, false);
        G.player.position.set(AGENCY.x - 3.6, 0, AGENCY.z + 3.4); G.player.rotation.set(0, -Math.PI / 2, 0); G.world = 'koy'; G.camSnap = true; // acentenin önü, istasyonun hemen dışı
        const kf = Math.round(trip.keyif), min = trip.full ? FULL_MIN : kf >= MIN_PART ? Math.round((FULL_MIN * kf) / 100) : 0;
        if (min) S().dincUntil = (S().time || 0) + 60 * min;
        if (trip.full) { if (G.hooks.fillEnergy) G.hooks.fillEnergy(); toast(`⚡ Tam enerjiyle döndün: ${FULL_MIN} dakika hızlı yürür, 1 ürün fazla taşırsın`); }
        else if (min) toast(`⚡ Tatil keyfi %${kf}: ${min} dakika dinçsin. Barı doldursaydın ${FULL_MIN} dakika olurdu`);
        else toast(`🌴 Az dinlendin: dinç dönmek için tatil keyfini en az %${MIN_PART} doldurmalısın`);
        showBar(false);
        setTimeout(() => { el.style.opacity = '0'; busy = false; }, 900);
      }, 480);
    });
    setTimeout(() => { el.style.opacity = '0'; }, 700);
  }, 480);
}
function updateTrip(dt) {
  trip.t += dt;
  if (busy) return; // gemi yanaşırken dolmaz
  const k = isleRelaxK(); // şezlong 3, deniz/masa/dans/araç 1,6, gezmek 0,8 (adacanli.js)
  trip.rate = k >= 3 ? 'lie' : k >= 1.6 ? 'act' : 'walk';
  addKeyif(FILL[trip.rate] * dt);
  if ((barT -= dt) <= 0) { barT = 0.15; drawBar(); }
}
// bar dolar, sıkılma barla azalır; ilk dolduğunda tam enerji
function addKeyif(n) {
  if (!onIsle() || trip.full) return;
  trip.keyif = Math.min(100, trip.keyif + n);
  S().sik = trip.sik0 * (1 - trip.keyif / 100);
  if (trip.keyif < 100) return;
  trip.full = true; S().sik = 0;
  toast(`⚡ Tatil keyfi doldu: tam enerji! Köye dönünce ${FULL_MIN} dakika dinçsin. Bardaki 🚢 düğmesiyle dönebilirsin`); sfx('unlock');
  if (G.player) floatText(G.player.position.clone().setY(2.6), '⚡ TAM ENERJİ', 'pos');
  drawBar();
}

// ---------- adada ekran: tatil keyfi barı (altta ortada, yardım satırının üstünde; üstteki bildirim satırını kapatmaz) ----------
let bar = null, barT = 0; const drawn = ['', ''];
const BAR_CSS = `#keyifBar { position: absolute; left: 50%; transform: translateX(-50%); width: min(360px, calc(100vw - 150px)); padding: 6px 12px 8px; border-radius: 16px; display: none; z-index: 6; pointer-events: auto; text-align: center; }
#keyifBar.on { display: block; }
#keyifBar .t { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font: 16px var(--font-title); }
#keyifBar .t small { font: 13px var(--font-body); opacity: .75; }
#keyifBar .bar { position: relative; height: 13px; border-radius: 7px; background: rgba(0,0,0,.14); overflow: hidden; margin-top: 4px; }
#keyifBar .bar i { display: block; height: 100%; width: 0; border-radius: 7px; background: linear-gradient(90deg, #4cc6e8, #56c27e); transition: width .25s linear; }
#keyifBar .bar b { position: absolute; top: 0; bottom: 0; left: ${MIN_PART}%; width: 2px; background: rgba(0,0,0,.25); }
#keyifBar .now { font: 13px/1.3 var(--font-body); opacity: .85; margin-top: 4px; }
#keyifBar .now .b:not(:empty)::before { content: ' · '; }
#keyifBar.full { box-shadow: 0 0 0 3px #ffd23f inset, 0 0 18px rgba(255,210,63,.6); }
#keyifBar.full .bar i { background: linear-gradient(90deg, #ffd23f, #ffb627); }
#keyifBar button { display: none; margin-top: 6px; padding: 6px 16px; border-radius: 12px; border: none; background: #2fb5a8; color: #fff; font: 16px var(--font-title); cursor: pointer; }
#keyifBar.full button { display: inline-block; }
@media (max-width: 640px) { #keyifBar { width: calc(100vw - 120px); padding: 4px 8px 6px; } #keyifBar .t { font-size: 14px; } #keyifBar .now { font-size: 12px; } }`;
const NOW = { lie: '😎 Uzanıyorsun: en hızlı doluyor', act: '🌊 Eğleniyorsun: hızlı doluyor', walk: '🚶 Gezerken yavaş dolar. Şezlong, hamak, deniz, oyun, dans daha hızlı' };
function showBar(on) {
  if (!bar) {
    const st = document.createElement('style'); st.textContent = BAR_CSS; document.head.appendChild(st);
    bar = document.createElement('div'); bar.id = 'keyifBar'; bar.className = 'hp';
    bar.innerHTML = '<div class="t"><span>🌴 Tatil keyfi</span><span><b class="pc">%0</b> <small class="fn"></small></span></div><div class="bar"><i></i><b></b></div><div class="now"><span class="a"></span><span class="b"></span></div><button type="button">🚢 Köye dön</button>';
    (document.getElementById('hud') || document.body).appendChild(bar);
    bar.addEventListener('pointerdown', (e) => e.stopPropagation());
    bar.querySelector('button').addEventListener('click', () => { if (!busy && onIsle()) travel(false); });
  }
  bar.classList.toggle('on', on);
  if (on) { placeBar(); drawBar(); }
}
function drawBar() {
  if (!bar || !bar.classList.contains('on')) return;
  const k = Math.floor(trip.keyif);
  bar.querySelector('.bar i').style.width = `${trip.keyif}%`;
  bar.querySelector('.pc').textContent = `%${k}`;
  bar.querySelector('.fn').textContent = fun.size ? `✨ ${fun.size}` : '';
  bar.classList.toggle('full', trip.full);
  const min = trip.full ? FULL_MIN : k >= MIN_PART ? Math.round((FULL_MIN * k) / 100) : 0;
  const a = trip.full ? `⚡ Tam enerji! Köye dönünce ${FULL_MIN} dk dinçsin` : NOW[trip.rate];
  const b = trip.full ? '' : min ? `şimdi dönersen ${min} dk dinç` : `en az %${MIN_PART} doldur`;
  if (a !== drawn[0]) { drawn[0] = a; bar.querySelector('.now .a').textContent = a; } // yalnız değişince: dil.js her yazımı çevirir
  if (b !== drawn[1]) { drawn[1] = b; bar.querySelector('.now .b').textContent = b; }
}
function placeBar() { // yardım satırı görünüyorsa onun üstünde, yoksa en altta
  if (!bar) return;
  const hp = document.getElementById('help'), r = hp && hp.offsetParent ? hp.getBoundingClientRect() : null;
  bar.style.bottom = `${r && r.height ? Math.max(16, innerHeight - r.top + 8) : 16}px`;
}

// ---------- kurulum ve her kare ----------
// test kancası: __tatil('git') ücretsiz adaya götürür, __tatil('doldur', n) barı n puan doldurur, __tatil() durum
if (typeof window !== 'undefined') window.__tatil = (cmd, n) => {
  if (cmd === 'git' && !busy) { travel(true); return 'gidiyor'; }
  if (cmd === 'don' && !busy && onIsle()) { travel(false); return 'dönüyor'; }
  if (cmd === 'doldur') { addKeyif(n || 10); drawBar(); }
  return JSON.stringify({ ada: onIsle(), world: G.world, busy, keyif: +trip.keyif.toFixed(1), full: trip.full, rate: trip.rate, sik: +(S().sik || 0).toFixed(1), dinc: dinc() ? Math.round(((S().dincUntil || 0) - (S().time || 0)) / 60) : 0, fun: fun.size, bar: !!(bar && bar.classList.contains('on')) });
};
G.hooks = G.hooks || {};
G.hooks.isleFun = () => addKeyif(NEW_FUN); // adada yeni etkinlik (adacanli.js memory)
G.hooks.isleRelax = (n) => addKeyif(n * 0.5); // yemek, gol, paraşüt inişi (adacanli.js relax)

export function setupTatil(scene) {
  if (G.stats && G.stats.sik == null) G.stats.sik = 0;
  buildAgency(scene);
  isleWorld(scene);
  initAds();
}
let built = false;
export function updateTatil(dt) {
  if (!G.player || !G.stats || !G.scene) return;
  if (!built) { built = true; setupTatil(G.scene); if (agencyDue()) openAgency(true); } // ilk karede kurulur (services.js her kare çağırır)
  hook();
  ui();
  if ((posT -= dt) <= 0) {
    posT = 0.5; place(); refresh(); if (!agencyOn && agencyDue()) openAgency(false);
    G.dinc = dinc() && !onIsle(); // dinçken Shift enerjisi yarı hızda biter (yetenek.js)
    const want = onIsle() && G.world === 'ada' && !G.cine; // gemi yolculuğunda gizli
    if (want !== !!(bar && bar.classList.contains('on'))) showBar(want); else if (want) placeBar();
  }
  updateIsle(dt); // adadan çıkınca da kamerayı ve kuşları toparlar
  if (onIsle()) { updateTrip(dt); return; }
  if (globe) { globe.rotation.y += dt * 0.5; flag.rotation.y = Math.sin(G.time * 1.7) * 0.25; }
  // sıkılmış avatar arada esner
  if ((S().sik || 0) >= 70 && (yawnT -= dt) <= 0) { yawnT = (S().sik >= 100 ? rand(5, 9) : rand(10, 16)); floatText(G.player.position.clone().setY(2.5), '🥱', 'neg'); }
}
