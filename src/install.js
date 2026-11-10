// Uygulama olarak kurma: telefonda ana ekrana, bilgisayarda masaüstüne. Kurulunca oyun tarayıcı çubuğu olmadan, tam ekran açılır.
// Chrome/Edge/Android: tarayıcının kendi kurulum penceresi (index.html beforeinstallprompt olayını window.__bip'te saklar).
// iPhone/iPad ve kurulum olayı vermeyen telefon tarayıcıları: adım adım "Ana ekrana ekle" kartı. Kuruluysa hiçbir şey çıkmaz.
// Açılıştan birkaç saniye sonra küçük bir davet kartı çıkar; "Sonra" denirse iki gün sorulmaz. Menü → Ayarlar'da her zaman düğme var.
import { G } from './game.js';
import { signedIn } from './online.js';

const SNOOZE = 'koyBakkali.installSnooze';
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const ua = navigator.userAgent;
const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const touch = matchMedia('(pointer: coarse)').matches;
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]sw=1/.test(location.search);

export const installed = () => (!document.fullscreenElement && ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches)) || navigator.standalone === true; // tarayıcının tam ekran kipi kurulu sayılmaz
export const canInstall = () => !installed() && (!!window.__bip || touch);
export const canFullscreen = () => !installed() && !ios && !!document.fullscreenEnabled;
export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

const SHARE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const CSS = `
body:has(.modal.open) .kbi { opacity: 0 !important; pointer-events: none; } /* menü ya da yükseltmeler açıkken üstlerini kapatmasın */
.kbi { position: fixed; left: 50%; top: 70px; transform: translate(-50%, -12px); opacity: 0; z-index: 7; width: min(92vw, 390px); box-sizing: border-box;
  display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 12px; border-radius: var(--radius); background: var(--hud-bg); color: var(--hud-ink);
  border: var(--bw) solid var(--line); box-shadow: var(--shadow), 0 10px 26px rgba(0,0,0,.18); font-family: var(--font-body); transition: opacity .35s, transform .35s; }
.kbi.on { opacity: 1; transform: translate(-50%, 0); }
.kbi img { width: 46px; height: 46px; border-radius: 12px; flex: none; }
.kbi .tx { flex: 1; min-width: 0; line-height: 1.2; }
.kbi .tx b { display: block; font: 800 16px var(--font-body); }
.kbi .tx small { display: block; font: 700 12.5px var(--font-body); color: var(--hud-soft); margin-top: 2px; }
.kbi-go { border: 0; border-radius: 999px; padding: 10px 18px; background: var(--btn); color: var(--btn-ink); font: 800 15px var(--font-body); box-shadow: 0 3px 0 var(--btn-dark); cursor: pointer; }
.kbi-x { border: 0; background: none; color: var(--hud-soft); font: 800 18px var(--font-body); padding: 6px; cursor: pointer; }
.kbi-ov { position: fixed; inset: 0; z-index: 55; display: flex; align-items: center; justify-content: center; background: var(--overlay); font-family: var(--font-body); }
.kbi-ov .box { width: min(92vw, 400px); box-sizing: border-box; padding: 20px 20px 18px; border-radius: var(--radius); background: var(--hud-bg); color: var(--hud-ink); border: var(--bw) solid var(--line); box-shadow: var(--shadow); }
.kbi-ov h3 { margin: 0 0 10px; font: 26px var(--font-title); display: flex; align-items: center; gap: 10px; }
.kbi-ov h3 img { width: 42px; height: 42px; border-radius: 10px; }
.kbi-ov ol { margin: 0 0 10px; padding-left: 22px; font: 700 15px/1.45 var(--font-body); }
.kbi-ov li { margin: 6px 0; }
.kbi-ov li svg { vertical-align: -4px; color: #2f7ff0; }
.kbi-ov p { margin: 6px 0; font: 700 13.5px/1.35 var(--font-body); color: var(--hud-soft); }
.kbi-ov .kbi-go { display: block; width: 100%; margin-top: 12px; }
`;
let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
const SYNC = () => (signedIn() ? '' : '<p>💾 Üye girişi yaparsan ilerlemen telefonla bilgisayar arasında ortak olur, ikisinden de kaldığın yerden devam edersin.</p>');

// kurulum: tarayıcının penceresi varsa o, yoksa adımlar
export async function promptInstall() {
  const e = window.__bip;
  if (e) {
    window.__bip = null; hideCard();
    try { e.prompt(); const r = await e.userChoice; if (r && r.outcome !== 'accepted') ls(SNOOZE, String(Date.now())); } catch (err) { steps(); }
    return;
  }
  hideCard(); steps();
}
function steps() {
  css();
  document.getElementById('kbIos')?.remove();
  const and = !ios;
  const list = ios
    ? `<li>${SHARE} <b>Paylaş</b> düğmesine dokun <small>(Safari'de altta, Chrome'da adres çubuğunda)</small></li><li>Listeyi kaydırıp <b>Ana Ekrana Ekle</b>'yi seç</li><li>Sağ üstte <b>Ekle</b>'ye dokun</li>`
    : `<li>Tarayıcının <b>⋮</b> menüsünü aç</li><li><b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b>'yi seç</li><li><b>Yükle</b>'ye dokun</li>`;
  const ov = document.createElement('div');
  ov.id = 'kbIos'; ov.className = 'kbi-ov';
  ov.innerHTML = `<div class="box"><h3><img src="icon-192.png" alt="">Ana ekrana ekle</h3><ol>${list}</ol>
    <p>📲 Ana ekrandaki Köy Bakkalı simgesi oyunu ${and ? 'tam ekran' : 'tarayıcı çubuğu olmadan'}, uygulama gibi açar.</p>${SYNC()}<button type="button" class="kbi-go">Tamam</button></div>`;
  ov.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); if (ev.target === ov || ev.target.closest('.kbi-go')) ov.remove(); });
  document.body.appendChild(ov);
}

let card = null;
function hideCard() { if (!card) return; const c = card; card = null; c.classList.remove('on'); setTimeout(() => c.remove(), 400); }
function showCard() {
  if (card || !canInstall()) return;
  css();
  card = document.createElement('div');
  card.className = 'kbi';
  card.innerHTML = `<img src="icon-192.png" alt=""><span class="tx"><b>Köy Bakkalı'nı kur</b><small>${touch ? 'Ana ekrandan tek dokunuşla, tam ekran oyun gibi açılır.' : 'Masaüstünden tek tıkla, kendi penceresinde açılır.'}</small></span><button type="button" class="kbi-go">Kur</button><button type="button" class="kbi-x" aria-label="Sonra">✕</button>`;
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  card.querySelector('.kbi-go').addEventListener('click', promptInstall);
  card.querySelector('.kbi-x').addEventListener('click', () => { ls(SNOOZE, String(Date.now())); hideCard(); });
  document.body.appendChild(card);
  setTimeout(() => card && card.classList.add('on'), 60);
  setTimeout(() => { if (card) ls(SNOOZE, String(Date.now())); hideCard(); }, 30000); // kendiliğinden kapanınca da iki gün ertelenir (yoksa her açılışta çıkıyordu)
}
// açılıştan sonra davet: sinematik, menü, ilk dükkân kurulumu ya da ilk adımlar rehberi (rehber.js) açıkken beklenir;
// kart hedef kartının üstüne açılır, yeni oyuncu ilk iki kilidi açmadan rehberin yazısını kapatmasın
function invite(delay) {
  if (local || G.visit || installed() || Date.now() - (+ls(SNOOZE) || 0) < 2 * 864e5) return;
  setTimeout(function tryShow() {
    if (!canInstall()) return;
    if (G.cine || G.menuOpen || G.guideOn || document.querySelector('#og, .kbi-ov, .modal.open')) { setTimeout(tryShow, 5000); return; }
    showCard();
  }, delay);
}
export function initInstall() {
  addEventListener('kb-installable', () => invite(1500));
  addEventListener('appinstalled', () => { window.__bip = null; hideCard(); ls(SNOOZE, String(Date.now())); });
  invite(9000);
}
