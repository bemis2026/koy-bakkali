// Çevrimiçi ekranlar: açılıştaki giriş/üye ol kapısı, menüde Köyler (sıralama, oyuncu kartı, ziyaret, hediye), Profil ve
// Öneri kutusu bölümleri, komşunun köyündeki yardım vardiyası çubuğu, evde gelen kutusu. Arka uç online.js'te.
import * as THREE from 'three';
import { G, ITEMS, Shelf, makeItem, fly, sfx, toast, save, saveData, writeSave } from './game.js';
import { EN } from './dil.js';
import { banner } from './ui.js';
import { canInstall, promptInstall } from './install.js';
import { confetti } from './fx.js';
import { temiz } from './filtre.js';
import {
  ON, initOnline, signIn, signUp, signInGoogle, chooseName, signOut, playGuest, isGuest, signedIn, loadCloud, getProfile, saveProfile,
  board, weeklyAward, helpedToday, finishHelp, takePendingHelp, giftsLeft, sendGift, inbox, dropInbox, sendFeedback, listFeedback, dropFeedback,
  errText, computeScore, weekScore, publishScore, saveCloud, setOwner, localOwner, myKey, cleanName, setPassword, rememberMe, lastLogin, deleteAccount,
  cloudReady, cloudIsReady,
} from './online.js';

const VISIT_T = 240, PURSE = 300; // yardım vardiyası: 4 dakika, komşu 300 ₺ harçlık verir (malzeme alımı için)
const $ = (id) => document.getElementById(id);
const tl = (n) => `${Math.floor(n || 0).toLocaleString('tr-TR')} ₺`;
const num = (n) => Math.floor(n || 0).toLocaleString('tr-TR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// başka oyuncunun profilindeki renk style içine girer: yalnız onaltılık renk kodu kabul edilir (url(...) ile dışarıya istek attırılamasın)
const hue = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#eeeeee');
const AVATARS = ['🧑‍🌾', '👩‍🌾', '👨‍🍳', '👩‍🍳', '🧔', '👵', '👴', '🧒', '🐄', '🐔', '🐑', '🐴', '🌻', '🍉', '🧀', '🥖'];
const COLORS = ['#3b8beb', '#e8604c', '#3fae6b', '#f6c343', '#9c6cf0', '#ff6fa8', '#2fb5a8', '#7a5230'];
const BADGE = { 1: '🥇', 2: '🥈', 3: '🥉' };
// Türkçe ekler: Ali'nin, Ayşe'nin, Mert'in; Ali'ye, Mert'e (son ünlüye ve ünlüyle bitip bitmediğine göre)
const VOW = 'aeıioöuüAEIİOÖUÜ';
function lastVowel(s) { for (let i = s.length - 1; i >= 0; i--) if (VOW.includes(s[i])) return s[i].toLocaleLowerCase('tr'); return 'e'; }
const endsVowel = (s) => VOW.includes(s.slice(-1));
// İngilizcede ek yok: sözlük kalıbı "{0}'s village" çıplak adı bekler
export function gen(n) { if (EN) return n; const v = lastVowel(n), h = 'ei'.includes(v) ? 'i' : 'aı'.includes(v) ? 'ı' : 'ou'.includes(v) ? 'u' : 'ü'; return `${n}'${endsVowel(n) ? 'n' : ''}${h}n`; }
export function dat(n) { if (EN) return n; const h = 'eiöü'.includes(lastVowel(n)) ? 'e' : 'a'; return `${n}'${endsVowel(n) ? 'y' : ''}${h}`; }
const badgeText = (b) => { const m = /^hafta:(\d+)-H(\d+):(\d)$/.exec(b); return m ? `${BADGE[m[3]]} ${m[2]}. hafta ${m[3]}.si` : b; };

const CSS = `
#og { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: 14px; background: rgba(28,18,58,.5); backdrop-filter: blur(3px); pointer-events: auto; }
#og .mcard { width: min(430px, 100%); }
.og-top { display: flex; align-items: center; gap: 12px; }
.og-top img { width: 58px; height: 58px; border-radius: 14px; }
.og-top small { display: block; font: 800 13px var(--font-body); opacity: .8; }
.og-mock { margin: 10px 0 0; padding: 6px 10px; border-radius: 10px; background: #fff3c4; color: #6b4a00; font: 800 12px var(--font-body); }
.og-tabs, .ob-tabs { display: flex; gap: 6px; margin-top: 12px; flex-wrap: wrap; }
.og-tabs button, .ob-tabs button, .ob-chip { flex: 1; border: var(--bw) solid var(--line); border-radius: 999px; padding: 7px 12px; background: var(--row-bg); color: var(--row-ink); font: 16px var(--font-title); cursor: pointer; white-space: nowrap; }
.og-tabs button.on, .ob-tabs button.on, .ob-chip.on { background: var(--btn); color: var(--btn-ink); box-shadow: 0 3px 0 var(--btn-dark); }
.ob-tabs button { flex: none; }
.og-alt { width: 100%; margin-top: 10px; border: var(--bw) solid var(--line); border-radius: 999px; background: #ffffff; color: #3b3b3b; font: 18px var(--font-title); padding: 9px; cursor: pointer; }
.og-prev { display: block; min-height: 15px; margin-top: 4px; font: 800 12.5px var(--font-body); color: #2f8a4a; }
.og-keep { display: flex; align-items: center; gap: 8px; margin: 10px 2px 2px; font: 800 14px var(--font-body); cursor: pointer; }
.og-keep input { width: 20px; height: 20px; accent-color: #3fae6b; }
.og-keep small { font-weight: 700; opacity: .7; }
.og-err { min-height: 18px; margin: 8px 0 0; color: #d23c3c; font: 800 13px var(--font-body); }
.og-link { display: block; margin: 6px auto 0; border: 0; background: none; color: inherit; opacity: .75; font: 800 13px var(--font-body); text-decoration: underline; cursor: pointer; }
.fld i { font-style: normal; font: 800 12px var(--font-body); opacity: .7; }
.fld textarea, .fld select { font: 700 16px var(--font-body); padding: 10px 12px; border-radius: 14px; border: var(--bw) solid var(--line); background: var(--row-bg); color: var(--row-ink); outline: none; }
.fld textarea { min-height: 110px; resize: vertical; }
.ob-list { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.ob-row { display: grid; grid-template-columns: 34px 38px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px 12px; border: var(--bw) solid var(--line); border-radius: 14px; background: var(--row-bg); color: var(--row-ink); cursor: pointer; text-align: left; font: inherit; }
.ob-row.me { outline: 3px solid #ffb627; }
.ob-row .rk { font: 20px var(--font-title); text-align: center; }
.ob-row .av { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; background: rgba(0,0,0,.06); }
.ob-row b { display: block; font: 18px var(--font-title); font-weight: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-row small { display: block; font: 800 12px var(--font-body); opacity: .75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob-row .val { font: 18px var(--font-title); text-align: right; white-space: nowrap; }
.ob-row .val small { text-align: right; }
.ob-card { display: flex; align-items: center; gap: 14px; padding: 14px; border: var(--bw) solid var(--line); border-radius: 16px; background: var(--row-bg); color: var(--row-ink); }
.ob-card .av { width: 64px; height: 64px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 36px; }
.ob-card b { display: block; font: 26px var(--font-title); font-weight: normal; }
.ob-card small { display: block; font: 800 13px var(--font-body); opacity: .8; }
.ob-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ob-badges span { padding: 3px 10px; border-radius: 999px; background: var(--gold); color: var(--gold-ink); font: 14px var(--font-title); }
.ob-pick { display: flex; flex-wrap: wrap; gap: 6px; }
.ob-pick button { width: 44px; height: 44px; border-radius: 12px; border: var(--bw) solid var(--line); background: var(--row-bg); font-size: 22px; cursor: pointer; }
.ob-pick button.on { outline: 3px solid #ffb627; }
.ob-pick.col button { width: 34px; height: 34px; border-radius: 50%; }
.ob-back { border: 0; background: none; color: inherit; font: 17px var(--font-title); cursor: pointer; padding: 0; margin-bottom: 8px; }
.ob-note { margin-top: 8px; font: 800 13px var(--font-body); opacity: .8; }
.ob-fb { padding: 10px 12px; border: var(--bw) solid var(--line); border-radius: 14px; background: var(--row-bg); color: var(--row-ink); }
.ob-fb small { display: flex; justify-content: space-between; gap: 8px; font: 800 12px var(--font-body); opacity: .75; }
.ob-fb p { margin: 4px 0 0; font: 700 15px var(--font-body); white-space: pre-wrap; }
.ob-fb button { border: 0; background: none; color: #d23c3c; font: 800 12px var(--font-body); cursor: pointer; }
#onlineBtn { position: absolute; top: 136px; right: 14px; width: 50px; height: 50px; border-radius: 50%; pointer-events: auto; cursor: pointer; display: grid; place-items: center; padding: 0; font-size: 24px; }
#visitBar { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; border-radius: 999px; background: var(--hud-bg); color: var(--hud-ink); border: 2px solid var(--line); box-shadow: var(--shadow); font: 17px var(--font-title); white-space: nowrap; pointer-events: auto; z-index: 3; }
#visitBar button { border: 0; border-radius: 999px; padding: 6px 14px; background: var(--btn); color: var(--btn-ink); font: 16px var(--font-title); cursor: pointer; box-shadow: 0 3px 0 var(--btn-dark); }
body.has-online #alerts { top: 194px; } /* bildirimler 🌍 düğmesinin altından başlar */
#og .fld input { font-size: 19px; padding: 9px 12px; } #og .fld { margin-top: 9px; }
@media (max-width: 640px) { body.has-online #alerts { top: 168px; } #onlineBtn { top: 116px; width: 44px; height: 44px; font-size: 21px; } #visitBar { top: 64px; font-size: 14px; gap: 6px; } .ob-row { grid-template-columns: 28px 32px minmax(0, 1fr) auto; } }`;
let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
function overlay(html) { css(); const ov = document.createElement('div'); ov.id = 'og'; ov.innerHTML = `<div class="mcard">${html}</div>`; document.body.appendChild(ov); return ov; }
const busy = (btn, on) => { if (btn) { btn.disabled = on; btn.style.opacity = on ? 0.6 : ''; } };

// =====================================================================
// açılış kapısı: kayıt seçiminden önce (main.js); çevrimdışıysa hemen geçer
// =====================================================================
// Firebase kitaplığı (gstatic) ve oturum yoklaması ağdan gelir: bağlantı yavaşsa ya da takılırsa oyun onu süresiz beklemez. Eskiden
// yükleme ekranı kitaplık inene kadar duruyordu; denetim botu bunu yakaladı (2026-11-10: kitaplık 5 dakikada inmedi, oyun açılmadı).
// Misafir 3 sn, öbürleri 12 sn bekler; yetişmezse bu açılış çevrimdışı sürer, kitaplık arkada yüklenir ve gelince çevrimiçi düğmeler kurulur
let startedOnce = false;
export async function onlineGate() {
  const guest = isGuest() && !visitId();
  const late = await Promise.race([initOnline().then(() => false, () => false), new Promise((r) => setTimeout(() => r(true), guest ? 3000 : 12000))]);
  if (late) {
    console.warn('çevrimiçi bağlantı gecikti: oyun çevrimdışı açılıyor');
    initOnline().then(() => { if (startedOnce) onlineStart(); }).catch(() => {});
    return;
  }
  if (ON.mode === 'off') return;
  if (ON.user && ON.needName) await nameStep();
  if (signedIn()) return;
  if (isGuest() && !visitId()) return;
  await loginStep();
}
function loginStep() {
  return new Promise((resolve) => {
    let mode = 'in';
    const ov = overlay('');
    const card = ov.firstChild;
    const render = () => {
      card.innerHTML = `
        <div class="og-top"><img src="assets/logo.webp" alt=""><div><b class="mtitle">Köy Bakkalı</b><small>Köyünü kur, arkadaşlarınla yarış, komşuna yardım et</small></div></div>
        ${ON.mode === 'mock' ? '<p class="og-mock">Deneme sunucusu: hesaplar yalnızca bu tarayıcıda tutulur</p>' : ''}
        <div class="og-tabs"><button type="button" data-m="in" class="${mode === 'in' ? 'on' : ''}">Giriş yap</button><button type="button" data-m="up" class="${mode === 'up' ? 'on' : ''}">Üye ol</button></div>
        ${mode === 'in' ? `
          <label class="fld"><span>Kullanıcı adı ya da e-posta</span><input name="id" autocomplete="username" autocapitalize="none" value="${esc(lastLogin())}"></label>
          <label class="fld"><span>Şifre</span><input name="pw" type="password" autocomplete="current-password"></label>
          <button type="button" class="go" data-a="in">Giriş yap</button>` : `
          <label class="fld"><span>Kullanıcı adı <i>(a-z, 0-9, _ · 3-16 harf)</i></span><input name="un" maxlength="20" placeholder="ali_42" autocomplete="username" autocapitalize="none"><small class="og-prev"></small></label>
          <label class="fld"><span>Görünen ad</span><input name="nm" maxlength="20" placeholder="Ali"></label>
          <label class="fld"><span>Şifre <i>(en az 6)</i></span><input name="pw" type="password" autocomplete="new-password"></label>
          <label class="fld"><span>E-posta <i>(isteğe bağlı: yazarsan girişte e-postanı kullanırsın, şifre sıfırlanabilir)</i></span><input name="em" type="email" autocomplete="email"></label>
          <button type="button" class="go" data-a="up">Üye ol ve başla</button>`}
        <label class="og-keep"><input type="checkbox" name="keep" ${rememberMe() ? 'checked' : ''}> Açık kal <small>(çıkış yapana kadar bu cihazda girili kalırsın)</small></label>
        <button type="button" class="og-alt" data-a="google">G Google ile ${mode === 'in' ? 'gir' : 'üye ol'}</button>
        <p class="og-err">${ON.authErr ? esc(errText(ON.authErr)) : ''}</p>
        <p class="ob-note" style="text-align:center;margin:4px 0 0">Girerek ya da üye olarak <a href="gizlilik.html" target="_blank" rel="noopener">gizlilik ve kullanım şartlarını</a> kabul edersin.</p>
        <button type="button" class="og-link" data-a="guest">Üye olmadan oyna (kayıt bu cihazda kalır, sıralamaya girmez)</button>
        ${canInstall() ? '<button type="button" class="og-link" data-a="install">📲 Uygulama olarak kur: ana ekrandan tam ekran açılır</button>' : ''}`;
      const f = [...card.querySelectorAll('input[name]')].find((i) => i.type !== 'checkbox' && !i.value); if (f) setTimeout(() => f.focus(), 50); // kullanıcı adı hatırlandıysa şifreye odaklanır
    };
    const val = (n) => { const i = card.querySelector(`[name="${n}"]`); return i ? i.value : ''; };
    const err = (t) => { card.querySelector('.og-err').textContent = t; sfx('bad'); };
    // giriş tamam: Google ile ilk girişte kullanıcı adı seçilir; orada "başka hesap" denirse giriş ekranı geri gelir
    const done = async () => { ov.remove(); if (ON.needName) await nameStep(); if (signedIn()) { resolve(); return; } document.body.appendChild(ov); render(); };
    ov.addEventListener('input', (e) => { if (e.target.name === 'un') namePreview(e.target); });
    ov.addEventListener('change', (e) => { if (e.target.name === 'keep') rememberMe(e.target.checked); }); // açık kal kutusu
    render();
    ov.addEventListener('pointerdown', (e) => e.stopPropagation());
    ov.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const g = card.querySelector('.go'); if (g) g.click(); } });
    ov.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.m) { mode = b.dataset.m; render(); return; }
      const a = b.dataset.a;
      if (a === 'guest') { playGuest(); ov.remove(); resolve(); return; }
      if (a === 'install') { promptInstall(); return; }
      busy(b, true);
      try {
        if (a === 'in') await signIn(val('id'), val('pw'));
        else if (a === 'up') await signUp({ username: val('un'), name: val('nm'), password: val('pw'), email: val('em') });
        else if (a === 'google') await signInGoogle();
        await done();
      } catch (x) { err(errText(x)); }
      busy(b, false);
    });
  });
}
// Google ile ilk girişte kullanıcı adı seçilir
// kullanıcı adı yazılırken sadeleşmiş hali gösterilir ("kgunes 97" → kgunes97)
function namePreview(inp) {
  const p = inp.parentElement.querySelector('.og-prev'), v = inp.value.trim(), c = cleanName(v);
  if (p) p.textContent = v && c !== v ? (c.length >= 3 ? `Kullanıcı adın: ${c}` : 'En az 3 harf ya da rakam') : '';
}
// Google ile ilk girişte: kullanıcı adı (Google e-postasından önerilir), görünen ad ve isteğe bağlı şifre
function nameStep() {
  return new Promise((resolve) => {
    const u = ON.user || {}, sug = cleanName(String(u.email || '').split('@')[0]).slice(0, 16), nm = String(u.displayName || '').slice(0, 20);
    const ov = overlay(`
      <b class="mtitle">Kullanıcı adını seç</b>
      <p class="wtxt">Arkadaşların seni bu adla bulur. Görünen adını sonra profilinden değiştirebilirsin.</p>
      <label class="fld"><span>Kullanıcı adı <i>(a-z, 0-9, _ · boşluk ve Türkçe harf kendiliğinden düzelir)</i></span><input name="un" maxlength="20" autocapitalize="none" value="${esc(sug)}"><small class="og-prev"></small></label>
      <label class="fld"><span>Görünen ad</span><input name="nm" maxlength="20" value="${esc(nm)}"></label>
      <label class="fld"><span>Şifre <i>(isteğe bağlı, en az 6: kullanıcı adın ve şifrenle de girebilirsin)</i></span><input name="pw" type="password" autocomplete="new-password"></label>
      <button type="button" class="go">Devam</button><p class="og-err"></p>
      <button type="button" class="og-link" data-a="out">Başka hesapla gir</button>`);
    const c = ov.firstChild, go = c.querySelector('.go'), val = (n) => c.querySelector(`[name=${n}]`).value;
    ov.addEventListener('pointerdown', (e) => e.stopPropagation());
    ov.addEventListener('input', (e) => { if (e.target.name === 'un') namePreview(e.target); });
    ov.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); });
    c.querySelector('[data-a=out]').addEventListener('click', async () => { try { await signOut(); } catch (e) { /* yok */ } ov.remove(); resolve(); });
    go.addEventListener('click', async () => {
      busy(go, true);
      try { await chooseName(val('un'), val('nm'), val('pw')); ov.remove(); resolve(); }
      catch (x) { c.querySelector('.og-err').textContent = errText(x); sfx('bad'); }
      busy(go, false);
    });
  });
}

// =====================================================================
// kayıt seçimi (persist.js): hesabın bulut kaydı da tartılır; ziyarette komşunun kaydı yüklenir
// =====================================================================
export const visitId = () => new URLSearchParams(location.search).get('ziyaret');
const playTime = (s) => (s && s.stats && s.stats.time) || 0;
// uygulama ya da sekme geri açılınca: başka cihazda daha uzun oynanmış bulut kaydı varsa onu döndürür (telefonda oynayıp
// bilgisayara dönünce kaldığın yerden devam)
export async function cloudNewer(time) {
  if (!signedIn() || G.visit) return null;
  const c = await loadCloud().catch(() => null), mine = (G.stats && G.stats.resetAt) || 0;
  if (!c || !c.unlocked || resetOf(c) < mine) return null; // bu cihazda daha yeni bir "yeni oyun" var
  return resetOf(c) > mine || playTime(c) > time + 5 ? c : null;
}
const resetOf = (s) => (s && s.stats && s.stats.resetAt) || 0;
export async function visitSave() {
  const uid = visitId();
  if (!uid || !signedIn() || uid === ON.user.uid) return null;
  const [data, prof] = await Promise.all([loadCloud(uid).catch(() => null), getProfile(uid).catch(() => null)]);
  if (!data) return null;
  if (!data || typeof data !== 'object') return null;
  // komşunun kaydı onun serbestçe yazabildiği veridir: içindeki yazılardan HTML işaretleri atılır (görev satırı, rozetler sayfaya
  // innerHTML ile giriyor), günlük ve mevsim görevi taşınmaz (ziyaretçiye yenisi kurulur)
  const scrub = (v, d = 0) => (typeof v === 'string' ? v.replace(/[<>&"'`]/g, '') : d > 12 ? null : Array.isArray(v) ? v.map((x) => scrub(x, d + 1))
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !/[<>&"'`]|^__proto__$|^constructor$/.test(k)).map(([k, x]) => [k, scrub(x, d + 1)])) : v);
  for (const k of Object.keys(data)) data[k] = scrub(data[k]);
  if (data.stats && typeof data.stats === 'object') { delete data.stats.daily; delete data.stats.season; delete data.stats.trip; }
  if (data.custom) for (const k in data.custom) if (typeof data.custom[k] === 'string') data.custom[k] = temiz(data.custom[k]); // tabela ve dükkân adı (filtre.js)
  G.visit = { uid, name: prof ? prof.name : 'Komşu', avatar: prof ? prof.avatar : '🧑‍🌾', t: VISIT_T, purse: PURSE, first: !helpedToday(uid) };
  return data;
}
// yerel/disk kaydının sahibi bu hesapsa o da yarışır; süresi uzun olan kazanır (yeni oyun ya da içe aktarma seçildiyse yerel)
export async function cloudPick(pick, flag) {
  if (!signedIn()) return pick;
  const uid = ON.user.uid, owner = localOwner();
  let best = !owner || owner === uid ? pick : null;
  if (flag) cloudReady(true); // yeni oyun ya da içe aktarma bilerek seçildi: bulutun üstüne yazılır
  else {
    let cloud = null;
    try { cloud = await loadCloud(); cloudReady(true); } catch (e) { console.warn('bulut kaydı okunamadı: bu oturumda üstüne yazılmayacak', e); } // cloudTick yeniden dener
    // başka cihazda yeni oyuna başlandıysa (daha yeni resetAt) o geçer; yoksa uzun oynanmış kayıt
    if (cloud && cloud.unlocked && (resetOf(cloud) > resetOf(best) || (resetOf(cloud) === resetOf(best) && playTime(cloud) > playTime(best)))) best = cloud;
  }
  setOwner(uid);
  return best;
}

// =====================================================================
// oyun açıldıktan sonra (main.js): evde gelen kutusu ve haftalık ödül; ziyarette yardım vardiyası
// =====================================================================
export async function onlineStart() {
  startedOnce = true;
  if (ON.mode === 'off') return;
  css();
  if (G.visit) { startVisit(); return; }
  hudButton();
  if (!signedIn()) return;
  const p = takePendingHelp();
  if (p && (p.pts || p.reward)) {
    G.stats.helpPts = (G.stats.helpPts || 0) + p.pts;
    if (p.reward) dropMoney(p.reward);
    setTimeout(() => banner('KOMŞULUK', `+${p.pts} yardım puanı${p.reward ? ` · ${tl(p.reward)} harçlık kasada` : ''}`), 1200);
  }
  try { applyInbox(await inbox()); } catch (e) { console.warn('gelen kutusu', e); }
  try { const aw = await weeklyAward(); if (aw) setTimeout(() => { banner('HAFTALIK YARIŞ', `${BADGE[aw.place]} Geçen hafta ${aw.place}. oldun!`); confetti(G.player.position, 60); }, 2600); } catch (e) { /* yok */ }
  publishScore(true);
}
// bulut kaydı ve puan: persist.js diskSave'den (60 sn'de bir, çıkışta hemen)
export function cloudTick(exit) {
  if (!signedIn() || G.visit) return;
  if (cloudIsReady()) saveCloud(saveData(), exit); else cloudRetry();
}
// açılışta bulut okunamadıysa dakikada bir yeniden denenir: buluttaki kayıt daha ilerideyse o yüklenir (cloudNewer gibi), değilse yazmaya başlanır
let retryAt = 0;
async function cloudRetry() {
  if (Date.now() - retryAt < 60000) return;
  retryAt = Date.now();
  // bu cihazdaki kayıt başka bir hesabınsa (oturum geç geldi, oyun yerel kayıtla açıldı) o kayıt bu hesabın bulutuna yazılmaz
  const own = localOwner();
  if (own && own !== ON.user.uid) return;
  let c;
  try { c = await loadCloud(); } catch (e) { return; }
  const mine = (G.stats && G.stats.resetAt) || 0;
  if (c && c.unlocked && resetOf(c) >= mine && (resetOf(c) > mine || playTime(c) > ((G.stats && G.stats.time) || 0) + 5)) {
    G.tabStop = true; // bu oturumun kaydı artık yazılmaz (game.js save, persist.js diskSave)
    writeSave(c); toast('☁️ Buluttaki kaydın daha ileride: o yükleniyor'); setTimeout(() => location.reload(), 1200);
    return;
  }
  setOwner(ON.user.uid);
  cloudReady(true);
}

function hudButton() {
  if ($('onlineBtn')) return;
  const b = document.createElement('button');
  b.id = 'onlineBtn'; b.className = 'hp'; b.type = 'button'; b.title = 'Köyler: sıralama, komşular'; b.textContent = '🌍';
  document.body.classList.add('has-online');
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); import('./menu.js').then((m) => m.openMenu('koyler')); });
  ($('hud') || document.body).appendChild(b);
}
// komşudan gelen para köy bakkalının kasasına (tezgahtaki yığına) düşer: oyuncu ya da muhasebeci toplar
function dropMoney(amount) {
  const P = G.regions.koy && G.regions.koy.pile;
  if (P) P.add(amount, P.base.position.clone().setY(3)); else G.money += amount;
}
// hediye ürünler köydeki uygun raflara dizilir; sığmayanın parası kasaya
function placeGoods(type, n) {
  const shelves = G.stations.filter((s) => s instanceof Shelf && s.zone.x < 300 && s.acc().includes(type));
  let put = 0;
  for (const sh of shelves) {
    while (put < n) {
      const i = sh.slots.indexOf(null);
      if (i < 0) break;
      const o = makeItem(type); o.position.set(sh.zone.x, 4, sh.zone.z); G.scene.add(o);
      sh.slots[i] = { type, obj: o };
      fly(o, sh.anchors[i], new THREE.Vector3(), 0.5 + put * 0.04, 1.6);
      put++;
    }
  }
  if (put < n) dropMoney((n - put) * ((ITEMS[type] && ITEMS[type].price) || 5));
  return put;
}
const RECV = () => myKey('koyBakkali.recv'); // son gelenler, hesaba göre
const recent = () => { try { return JSON.parse(localStorage.getItem(RECV()) || '[]'); } catch (e) { return []; } };
async function applyInbox(items) {
  if (!items || !items.length) return;
  const lines = [];
  let total = 0;
  for (const it of items.sort((a, b) => a.ts - b.ts)) {
    try { await dropInbox(it.id); } catch (e) { continue; } // önce silinir: iki kez alınmasın
    const who = `${it.avatar || '🧑‍🌾'} ${it.fromName || 'Komşu'}`;
    // kayıt başkasının yazdığı veridir: sayılar sınırlanır, ürün türü yalnız gerçek bir ürünse kabul edilir ('__proto__' gibi bir tür
    // döngüyü hatayla kesiyordu; 2026-11-10 denetimi)
    it.money = Math.max(0, Math.min(100000, Math.floor(+it.money) || 0)); it.items = Math.max(0, Math.min(10000, Math.floor(+it.items) || 0));
    if (it.goods && !(typeof it.goods.type === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, it.goods.type))) it.goods = null;
    if (it.goods) it.goods.n = Math.max(1, Math.min(10, Math.floor(+it.goods.n) || 1));
    if (it.money > 0) { dropMoney(it.money); total += it.money; }
    if (it.kind === 'help') lines.push(`${who} köyüne yardım etti: ${tl(it.money)}, ${it.items || 0} satış`);
    else {
      let g = '';
      if (it.goods && ITEMS[it.goods.type]) { const k = placeGoods(it.goods.type, it.goods.n); g = `${it.goods.n} ${ITEMS[it.goods.type].name.toLocaleLowerCase('tr')}${k ? ' rafa dizildi' : ''}`; }
      lines.push(`${who} hediye gönderdi: ${[it.money > 0 ? tl(it.money) : '', g].filter(Boolean).join(' + ')}${it.note ? ` · "${it.note}"` : ''}`);
    }
  }
  if (!lines.length) return;
  try { localStorage.setItem(RECV(), JSON.stringify([...lines.map((t) => ({ t, ts: Date.now() })), ...recent()].slice(0, 15))); } catch (e) { /* yok */ }
  setTimeout(() => {
    banner('GELEN KUTUSU', lines.length === 1 ? lines[0] : `${lines.length} komşudan ${tl(total)} kasada`);
    for (const [i, t] of lines.slice(0, 4).entries()) setTimeout(() => toast(`📬 ${t}`), 900 + i * 1600);
    sfx('cash');
  }, 1800);
}

// ---------- komşunun köyünde yardım vardiyası ----------
let visitIv = 0;
function startVisit() {
  const V = G.visit;
  G.money = V.purse; V.sold0 = G.stats.sold || 0;
  for (const id of ['menuBtn', 'upgBtn']) { const e = $(id); if (e) e.style.display = 'none'; }
  const bar = document.createElement('div');
  bar.id = 'visitBar';
  bar.innerHTML = '<span class="vt"></span><button type="button">Bitir, evime dön</button>';
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  bar.querySelector('button').addEventListener('click', endVisit);
  ($('hud') || document.body).appendChild(bar);
  const txt = bar.querySelector('.vt');
  const tick = () => {
    if (!document.hidden && !G.paused) V.t -= 0.25;
    const m = Math.max(0, Math.floor(G.money - V.purse)), s = Math.max(0, (G.stats.sold || 0) - V.sold0), t = Math.max(0, Math.ceil(V.t));
    txt.textContent = `${V.avatar} ${gen(V.name)} köyünde · ⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} · 💰 ${tl(m)} · 🛒 ${s}`;
    if (V.t <= 0) endVisit();
  };
  tick(); visitIv = setInterval(tick, 250);
  setTimeout(() => banner('YARDIM VARDİYASI', `${gen(V.name)} köyündesin: kasaları topla, rafları doldur`), 800);
  toast(`🤝 ${VISIT_T / 60} dakika yardım et: topladığın para ve yaptığın satışlar ${dat(V.name)} gider${V.first ? '' : ' (bugün ona zaten yardım ettin: puan yok)'}`);
}
async function endVisit() {
  const V = G.visit;
  if (!V || V.ended) return;
  V.ended = true; clearInterval(visitIv);
  G.paused = true;
  const money = Math.max(0, Math.floor(G.money - V.purse)), items = Math.max(0, (G.stats.sold || 0) - V.sold0);
  let r = null, error = '';
  try { r = await finishHelp(V.uid, money, items, V.liveSent || 0, V.stocked || 0); } catch (e) { error = errText(e); } // canlıda gönderilen para gelen kutusuna ikinci kez gitmez (canli.js)
  const ov = overlay(`
    <b class="mtitle">Vardiya bitti 🤝</b>
    <p class="wtxt">${esc(gen(V.name))} köyüne <b>${tl(money)}</b> ve <b>${items}</b> satış kazandırdın. ${money || items ? 'Bir dahaki girişinde kasasında bulacak.' : 'Bu sefer kasalara ve raflara yetişemedin.'}</p>
    ${r ? `<p class="wtxt">Komşuluk puanın <b>+${r.pts}</b>${r.reward ? `, harçlığın <b>${tl(r.reward)}</b> (köy kasanda seni bekliyor)` : ''}.</p>` : ''}
    ${error ? `<p class="og-err">${esc(error)}</p>` : ''}
    <button type="button" class="go">Evime dön</button>`);
  ov.querySelector('.go').addEventListener('click', () => { location.href = location.pathname; });
  if (money || items) confetti(G.player.position, 50);
}

// =====================================================================
// menü bölümleri (menu.js): Köyler, Profil, Öneri kutusu
// =====================================================================
export const onlineSections = () => (ON.mode === 'off' ? [] : [['koyler', '🌍', 'Köyler'], ['profil', '👤', 'Profil'], ['oneri', '💡', 'Öneri kutusu']]);
export const isOnlineSection = (s) => s === 'koyler' || s === 'profil' || s === 'oneri';
export function mountOnline(sec, body) { css(); ({ koyler: mountBoard, profil: mountProfile, oneri: mountFeedback })[sec](body); }
function loginPrompt(body, why) {
  body.innerHTML = `<p class="mm-lead">${why}</p><button type="button" class="go" data-o="login">Giriş yap ya da üye ol</button>`;
  body.querySelector('[data-o=login]').addEventListener('click', () => { try { localStorage.removeItem('koyBakkali.guest'); } catch (e) { /* yok */ } save(); location.reload(); });
}

// ---------- Köyler: sıralama sekmeleri ----------
const TABS = [['koy', '🏆', 'Köy puanı'], ['week', '📅', 'Bu hafta'], ['earned', '💰', 'Kazanç'], ['level', '⭐', 'Seviye'], ['help', '🤝', 'Yardımsever']];
let tab = 'koy';
function valueOf(kind, r) {
  if (kind === 'week') return `${num(r.score)} puan<small>${tl(r.earned)} · yardım ${num(r.help)}</small>`;
  const s = r.score || {};
  if (kind === 'koy') return `${num(s.koy)}<small>puan</small>`;
  if (kind === 'earned') return `${tl(s.earned)}<small>toplam kazanç</small>`;
  if (kind === 'level') return `Sv ${num(s.level)}<small>${num(s.xp)} XP</small>`;
  return `${num(s.help)}<small>yardım puanı</small>`;
}
function mountBoard(body) {
  if (!signedIn()) { loginPrompt(body, 'Köyler sıralamasını görmek, komşulara gidip yardım etmek ve hediye göndermek için üye ol.'); return; }
  const me = computeScore(), wk = weekScore();
  body.innerHTML = `
    <p class="mm-lead">Köy puanı: seviye, açtığın yerler, memnuniyet yıldızı, şehir marketi, komşu yardımı ve kazancın birlikte. Senin köyün: <b>${num(me.koy)}</b> puan · bu hafta <b>${num(wk.score)}</b>.</p>
    <div class="ob-tabs">${TABS.map(([k, ic, n]) => `<button type="button" data-t="${k}" class="${k === tab ? 'on' : ''}">${ic} ${n}</button>`).join('')}</div>
    <div class="ob-list"><p class="mm-lead">Yükleniyor…</p></div>`;
  const list = body.querySelector('.ob-list');
  const load = async () => {
    list.innerHTML = '<p class="mm-lead">Yükleniyor…</p>';
    publishScore(true);
    try {
      const rows = await board(tab);
      if (!rows.length) { list.innerHTML = `<p class="mm-lead">${tab === 'week' ? 'Bu hafta henüz kimse puan almadı. İlk sen ol!' : 'Henüz kimse yok.'}</p>`; return; }
      list.innerHTML = rows.map((r, i) => {
        return `<button type="button" class="ob-row${r.id === ON.user.uid ? ' me' : ''}" data-u="${esc(r.id)}">
          <span class="rk">${BADGE[i + 1] || i + 1}</span><span class="av" style="background:${hue(r.color)}33">${esc(r.avatar || '🧑‍🌾')}</span>
          <span><b>${esc(r.name || r.username)}</b><small>${esc(r.village || '')} · @${esc(r.username || '')}</small></span>
          <span class="val">${valueOf(tab, r)}</span></button>`;
      }).join('');
    } catch (e) { list.innerHTML = `<p class="og-err">${esc(errText(e))}</p>`; }
  };
  body.querySelector('.ob-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; for (const x of body.querySelectorAll('[data-t]')) x.classList.toggle('on', x === b); load(); });
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-u]'); if (b) showPlayer(body, b.dataset.u); });
  load();
}
// oyuncu kartı: puanları, rozetleri; ziyaret ve hediye
async function showPlayer(body, uid) {
  body.innerHTML = '<p class="mm-lead">Yükleniyor…</p>';
  let p = null;
  try { p = await getProfile(uid); } catch (e) { /* yok */ }
  if (!p) { body.innerHTML = '<p class="og-err">Oyuncu bulunamadı</p>'; return; }
  const me = uid === ON.user.uid, s = p.score || {}, helped = helpedToday(uid);
  body.innerHTML = `
    <button type="button" class="ob-back">← Köyler</button>
    <div class="ob-card"><span class="av" style="background:${hue(p.color)}33">${esc(p.avatar || '🧑‍🌾')}</span>
      <span><b>${esc(p.name)}</b><small>@${esc(p.username)} · ${esc(p.village || '')}</small>${p.bio ? `<small>${esc(p.bio)}</small>` : ''}
      ${(p.badges || []).length ? `<span class="ob-badges">${p.badges.map((b) => `<span>${esc(badgeText(b))}</span>`).join('')}</span>` : ''}</span></div>
    <div class="mm-tiles">
      <div class="mm-tile"><span class="ic">🏆</span><span><small>Köy puanı</small><b>${num(s.koy)}</b></span></div>
      <div class="mm-tile"><span class="ic">⭐</span><span><small>Seviye</small><b>${num(s.level)}</b></span></div>
      <div class="mm-tile"><span class="ic">😊</span><span><small>Memnuniyet</small><b>${s.stars || 1} ★</b></span></div>
      <div class="mm-tile"><span class="ic">🤝</span><span><small>Yardım puanı</small><b>${num(s.help)}</b></span></div>
      <div class="mm-tile"><span class="ic">💰</span><span><small>Toplam kazanç</small><b>${tl(s.earned)}</b></span></div>
      <div class="mm-tile"><span class="ic">🗺️</span><span><small>Açılan yer</small><b>${num(s.regions)}</b></span></div>
    </div>
    ${me ? '<p class="ob-note">Bu senin köyün. Profilini menüdeki Profil bölümünden düzenleyebilirsin.</p>' : `
    <button type="button" class="go" data-o="visit">🚌 Köyüne git, ${VISIT_T / 60} dakika yardım et</button>
    <p class="ob-note">${helped ? 'Bugün ona zaten yardım ettin: yine gidebilirsin ama puan ve harçlık almazsın.' : 'Topladığın para ve yaptığın satışlar ona gider; sen komşuluk puanı ve harçlık alırsın (her komşuya günde bir kez).'}</p>
    <button type="button" class="og-alt" data-o="gift">🎁 Hediye gönder <small>(bugün ${giftsLeft()} hakkın var)</small></button>`}`;
  body.querySelector('.ob-back').addEventListener('click', () => mountBoard(body));
  const v = body.querySelector('[data-o=visit]');
  if (v) v.addEventListener('click', async () => { busy(v, true); save(); try { await saveCloud(saveData(), true); } catch (e) { /* yok */ } location.href = `${location.pathname}?ziyaret=${encodeURIComponent(uid)}`; });
  const g = body.querySelector('[data-o=gift]');
  if (g) g.addEventListener('click', () => giftForm(body, p));
}
// hediye: para (en çok paranın beşte biri) ya da kendi raflarında satılan bir üründen 5-10 tane (bedeli senden düşer)
function giftForm(body, p) {
  const goods = [...new Set(G.stations.filter((s) => s instanceof Shelf && s.zone.x < 300).flatMap((s) => s.acc()))].filter((t) => ITEMS[t]);
  const cap = Math.floor(G.money / 5);
  let money = 0, type = '', n = 5;
  body.innerHTML = `
    <button type="button" class="ob-back">← ${esc(p.name)}</button>
    <p class="mm-lead">${esc(dat(p.name))} hediye: para köy kasasına düşer, ürünler raflarına dizilir. Bedeli senin hesabından çıkar. Bugün ${giftsLeft()} hakkın var.</p>
    <div class="fld"><span>Para <i>(en çok ${tl(cap)})</i></span><div class="ob-tabs" data-k="money">${[0, 100, 250, 500, 1000].map((m) => `<button type="button" class="ob-chip${m === 0 ? ' on' : ''}" data-v="${m}" ${m > cap ? 'disabled style="opacity:.4"' : ''}>${m ? tl(m) : 'Yok'}</button>`).join('')}</div></div>
    <label class="fld"><span>Ürün</span><select name="type"><option value="">Ürün yok</option>${goods.map((t) => `<option value="${t}">${esc(ITEMS[t].name)} (${ITEMS[t].price} ₺)</option>`).join('')}</select></label>
    <div class="fld"><span>Kaç tane</span><div class="ob-tabs" data-k="n">${[5, 10].map((k) => `<button type="button" class="ob-chip${k === 5 ? ' on' : ''}" data-v="${k}">${k}</button>`).join('')}</div></div>
    <label class="fld"><span>Not <i>(isteğe bağlı)</i></span><input name="note" maxlength="80" placeholder="Kolay gelsin komşu!"></label>
    <button type="button" class="go" data-o="send">Gönder</button><p class="og-err"></p>`;
  const cost = () => money + (type ? ITEMS[type].price * n : 0);
  const go = body.querySelector('[data-o=send]'), err = body.querySelector('.og-err');
  const refresh = () => { go.textContent = cost() ? `Gönder (${tl(cost())})` : 'Gönder'; };
  body.querySelector('.ob-back').addEventListener('click', () => showPlayer(body, p.id));
  for (const box of body.querySelectorAll('[data-k]')) box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b || b.disabled) return;
    for (const x of box.querySelectorAll('[data-v]')) x.classList.toggle('on', x === b);
    if (box.dataset.k === 'money') money = +b.dataset.v; else n = +b.dataset.v;
    refresh();
  });
  body.querySelector('[name=type]').addEventListener('change', (e) => { type = e.target.value; refresh(); });
  go.addEventListener('click', async () => {
    const c = cost();
    if (!c) { err.textContent = 'Para ya da ürün seç'; return; }
    if (G.money < c) { err.textContent = 'Paran yetmiyor'; return; }
    busy(go, true);
    G.money -= c;
    try {
      await sendGift(p.id, { money, goods: type ? { type, n } : null, note: body.querySelector('[name=note]').value });
      sfx('cash'); confetti(G.player.position, 30);
      body.innerHTML = `<p class="mm-lead">🎁 Hediyen yola çıktı! ${esc(p.name)} oyuna girince kasasında ve raflarında bulacak.</p><button type="button" class="og-alt">← Köyler</button>`;
      body.querySelector('.og-alt').addEventListener('click', () => mountBoard(body));
    } catch (e) { G.money += c; err.textContent = errText(e); busy(go, false); }
  });
  refresh();
}

// ---------- Profil ----------
function mountProfile(body) {
  if (!signedIn()) { loginPrompt(body, 'Profil, bulut kaydı ve sıralama için üye ol. Şu an misafir oynuyorsun: kayıt yalnızca bu cihazda.'); return; }
  const P = ON.profile, s = computeScore(), wk = weekScore();
  let avatar = P.avatar || AVATARS[0], color = P.color || COLORS[0];
  const rec = recent();
  body.innerHTML = `
    <div class="ob-card"><span class="av" style="background:${hue(color)}33">${esc(avatar)}</span>
      <span><b>${esc(P.name)}</b><small>@${esc(P.username)} · ${esc((G.custom && G.custom.name) || P.village || '')}</small>
      ${(P.badges || []).length ? `<span class="ob-badges">${P.badges.map((b) => `<span>${esc(badgeText(b))}</span>`).join('')}</span>` : ''}</span></div>
    <div class="mm-tiles">
      <div class="mm-tile"><span class="ic">🏆</span><span><small>Köy puanı</small><b>${num(s.koy)}</b></span></div>
      <div class="mm-tile"><span class="ic">📅</span><span><small>Bu hafta</small><b>${num(wk.score)}</b></span></div>
      <div class="mm-tile"><span class="ic">🤝</span><span><small>Yardım puanı</small><b>${num(s.help)}</b></span></div>
      <div class="mm-tile"><span class="ic">🎁</span><span><small>Bugünkü hediye hakkı</small><b>${giftsLeft()}</b></span></div>
    </div>
    <label class="fld"><span>Görünen ad</span><input name="name" maxlength="20" value="${esc(P.name)}"></label>
    <div class="fld"><span>Simge</span><div class="ob-pick" data-k="avatar">${AVATARS.map((a) => `<button type="button" data-v="${a}" class="${a === avatar ? 'on' : ''}">${a}</button>`).join('')}</div></div>
    <div class="fld"><span>Renk</span><div class="ob-pick col" data-k="color">${COLORS.map((c) => `<button type="button" data-v="${c}" class="${c === color ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div></div>
    <label class="fld"><span>Hakkında <i>(120 harf)</i></span><input name="bio" maxlength="120" value="${esc(P.bio || '')}" placeholder="Domatesim köyün en kırmızısı"></label>
    <button type="button" class="go" data-o="save">Profili kaydet</button><p class="og-err"></p>
    <p class="ob-note">Köyünün adı ve renkleri Dükkanım bölümünden değişir; sıralamada o ad görünür.</p>
    ${rec.length ? `<div class="fld"><span>Son gelenler</span><div class="ob-list">${rec.map((r) => `<div class="ob-fb"><small><span>${new Date(r.ts).toLocaleDateString('tr-TR')}</span></small><p>${esc(r.t)}</p></div>`).join('')}</div></div>` : ''}
    <label class="fld"><span>🔑 Şifre <i>(@${esc(P.username)} ve bu şifreyle her cihazdan girersin; en az 6 harf)</i></span><input name="pw" type="password" autocomplete="new-password" placeholder="Yeni şifre"></label>
    <button type="button" class="og-alt" data-o="pw">Şifreyi kaydet</button><p class="og-err pwerr"></p>
    <button type="button" class="og-alt" data-o="out">Çıkış yap</button>
    <button type="button" class="og-alt" data-o="del" style="color:#d23c3c;font-size:15px">Hesabımı sil</button><p class="og-err delerr"></p>
    <p class="ob-note"><a href="gizlilik.html" target="_blank" rel="noopener">Gizlilik ve kullanım şartları</a></p>
    ${ON.mode === 'mock' ? '<p class="og-mock">Deneme sunucusu açık</p>' : ''}`;
  for (const box of body.querySelectorAll('.ob-pick')) box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    for (const x of box.querySelectorAll('[data-v]')) x.classList.toggle('on', x === b);
    if (box.dataset.k === 'avatar') avatar = b.dataset.v; else color = b.dataset.v;
    const av = body.querySelector('.ob-card .av'); av.textContent = avatar; av.style.background = `${color}33`;
  });
  const go = body.querySelector('[data-o=save]');
  go.addEventListener('click', async () => {
    busy(go, true);
    try {
      const name = body.querySelector('[name=name]').value.trim() || P.username;
      await saveProfile({ name, avatar, color, bio: body.querySelector('[name=bio]').value.trim(), village: (G.custom && G.custom.name) || P.village });
      publishScore(true); sfx('buy'); toast('👤 Profil kaydedildi');
      mountProfile(body);
    } catch (e) { body.querySelector('.og-err').textContent = errText(e); busy(go, false); }
  });
  const pw = body.querySelector('[data-o=pw]');
  pw.addEventListener('click', async () => {
    const inp = body.querySelector('[name=pw]'), err = body.querySelector('.pwerr');
    busy(pw, true); err.textContent = '';
    try { await setPassword(inp.value); inp.value = ''; sfx('buy'); toast(`🔑 Şifre kaydedildi: artık @${P.username} ve bu şifreyle girebilirsin`); }
    catch (e) { err.textContent = errText(e); }
    busy(pw, false);
  });
  body.querySelector('[data-o=out]').addEventListener('click', async () => { save(); try { await saveCloud(saveData(), true); } catch (e) { /* yok */ } await signOut(); location.reload(); });
  // hesabı sil: ilk basış uyarır, ikinci basış siler (online.js deleteAccount)
  const del = body.querySelector('[data-o=del]'), derr = body.querySelector('.delerr');
  let armed = false;
  del.addEventListener('click', async () => {
    if (!armed) { armed = true; del.textContent = 'Emin misin? Silmek için yeniden bas'; derr.textContent = 'Profilin, buluttaki kaydın ve sıralamadaki adın kalıcı olarak silinir. Bu cihazdaki oyunun misafir olarak sürer.'; return; }
    busy(del, true);
    try { await deleteAccount(); toast('🗑️ Hesabın ve buluttaki verilerin silindi'); setTimeout(() => location.reload(), 1500); }
    catch (e) { derr.textContent = errText(e); busy(del, false); armed = false; del.textContent = 'Hesabımı sil'; }
  });
}

// ---------- Öneri kutusu ----------
function mountFeedback(body) {
  let kind = 'oneri';
  const KINDS = [['oneri', '💡 Öneri'], ['hata', '🐞 Hata'], ['begendim', '❤️ Beğendim']];
  body.innerHTML = `
    <p class="mm-lead">Aklına gelen her şeyi yaz: yeni bölüm, denge, hata, beğendiğin şey. Doğrudan bize gelir.</p>
    <div class="ob-tabs" data-k="kind">${KINDS.map(([k, n]) => `<button type="button" class="ob-chip${k === kind ? ' on' : ''}" data-v="${k}">${n}</button>`).join('')}</div>
    <label class="fld"><span>Mesajın</span><textarea name="text" maxlength="1000" placeholder="Mesela: çiftliğe arı kovanı gelsin, bal satalım"></textarea></label>
    <button type="button" class="go" data-o="send">Gönder</button><p class="og-err"></p>
    ${ON.profile && ON.profile.admin ? '<div class="fld"><span>Gelen öneriler (yönetici)</span><div class="ob-list" data-o="list"><p class="mm-lead">Yükleniyor…</p></div></div>' : ''}`;
  body.querySelector('[data-k=kind]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    kind = b.dataset.v; for (const x of body.querySelectorAll('[data-k=kind] [data-v]')) x.classList.toggle('on', x === b);
  });
  const go = body.querySelector('[data-o=send]'), err = body.querySelector('.og-err');
  go.addEventListener('click', async () => {
    busy(go, true);
    try { await sendFeedback(kind, body.querySelector('[name=text]').value); body.querySelector('[name=text]').value = ''; err.textContent = ''; toast('💌 Teşekkürler, önerin bize ulaştı!'); sfx('happy'); }
    catch (e) { err.textContent = errText(e); }
    busy(go, false);
  });
  const list = body.querySelector('[data-o=list]');
  if (!list) return;
  const load = async () => {
    try {
      const rows = await listFeedback();
      const icon = Object.fromEntries(KINDS.map(([k, n]) => [k, n.split(' ')[0]]));
      list.innerHTML = rows.length ? rows.map((r) => `<div class="ob-fb"><small><span>${icon[r.kind] || '💬'} ${esc(r.name)} · Sv ${Number(r.level) || 1} · ${new Date(r.ts).toLocaleString('tr-TR')}</span><button type="button" data-d="${esc(r.id)}">sil</button></small><p>${esc(r.text)}</p></div>`).join('') : '<p class="mm-lead">Henüz öneri yok.</p>';
    } catch (e) { list.innerHTML = `<p class="og-err">${esc(errText(e))}</p>`; }
  };
  list.addEventListener('click', async (e) => { const b = e.target.closest('[data-d]'); if (!b) return; await dropFeedback(b.dataset.d).catch(() => {}); load(); });
  load();
}
