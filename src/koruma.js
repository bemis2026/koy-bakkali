// Yayın öncesi koruma (2026-11-10 denetimi): kayıt kaybolmasın, oyun sessizce kırılmasın.
// 1) Tek sekme: oyun iki sekmede açıkken ikisi de aynı kaydın üstüne sırayla yazıyor, yeni sekme eski ilerlemeyi geri alıyordu.
//    Açılan sekme öbürlerine "açık mısın" diye sorar; cevap gelirse perde çıkar, "Burada oyna" denince eski sekme son halini
//    yazar ve bir daha kaydetmez (G.tabStop: game.js save, persist.js diskSave).
// 2) Kalıcı depo: tarayıcı yer açarken (iOS'ta 7 gün kuralı gibi) misafir kaydını silmesin diye navigator.storage.persist istenir.
// 3) Ekran kartı bağlamı düşerse (telefonda arka plana alınınca, sürücü sıfırlanınca) siyah ekranda kalınmaz: kayıt yazılır, perde çıkar.
// 4) Hata raporu: yayındaki sitede yakalanmayan hatalar öneri kutusuna 'hata' türüyle gider (oturumda en çok 3, aynısı bir kez).
//    Kişisel veri yok: hata yazısı, dosya:satır, tarayıcı adı, oyun süresi.
import { G, save } from './game.js';
import { diskSave } from './persist.js';
import { sendFeedback } from './online.js';

const flush = () => { try { save(); diskSave(true); } catch (e) { /* yazılamadı */ } };

// tam ekran perde: oyunun her penceresinin ve yükleme ekranının üstünde
export function perde(title, text, btn, onClick) {
  let el = document.getElementById('koruPerde');
  if (!el) {
    el = document.createElement('div'); el.id = 'koruPerde'; el.className = 'modal open'; el.style.zIndex = '9999';
    el.innerHTML = '<div class="mcard" style="text-align:center"><b class="mtitle ttl"></b><p class="wtxt"></p><button type="button" class="go"></button></div>';
    document.body.appendChild(el);
  }
  el.classList.add('open');
  el.querySelector('b').textContent = title;
  el.querySelector('p').textContent = text;
  const b = el.querySelector('button'); b.textContent = btn;
  b.onclick = () => { el.classList.remove('open'); onClick(); };
}

// ---------- tek sekme ----------
// Sahiplik jetonu (localStorage 'koyBakkali.sekme'): oyunu alan sekme kimliğini yazar. Açılıştaki yoklamaya cevap veremeyen sekme
// (tarayıcının dondurduğu arka plan sekmesi) sonradan uyanınca jetonun başkasına geçtiğini görür ve kaydetmeyi bırakır; eskiden
// eski halini üç saniyede bir yeni sekmenin ilerlemesinin üstüne yazıyordu (2026-11-10 denetimi). main.js kayıt zamanlayıcısı çağırır
const TOK = 'koyBakkali.sekme', ME = Math.random().toString(36).slice(2);
let owner = false;
function claim() { try { localStorage.setItem(TOK, ME); owner = true; } catch (e) { /* depo yok */ } }
export function sekmeNobet() {
  if (!owner || G.tabStop) return;
  let t = null;
  try { t = localStorage.getItem(TOK); } catch (e) { return; }
  if (t === null || t === ME) return;
  owner = false; G.tabStop = true;
  perde('Oyun başka sekmede açıldı', 'İlerlemen orada sürüyor. Bu sekmeyi kapatabilirsin.', 'Burada oyna', () => location.reload());
}
export function tekSekme() {
  if (typeof BroadcastChannel === 'undefined' || /[?&](ziyaret|deneme)=/.test(location.search)) return Promise.resolve();
  const ch = new BroadcastChannel('koyBakkali.tek'), me = ME;
  let mine = false, wait = null;
  ch.onmessage = (e) => {
    const m = e.data || {};
    if (m.to && m.to !== me) return;
    if (wait) { wait(m); return; }
    if (!mine) return;
    if (m.k === 'kim') ch.postMessage({ k: 'ben', to: m.from });
    else if (m.k === 'al') {
      flush(); G.tabStop = true; mine = false; owner = false;
      ch.postMessage({ k: 'tamam', to: m.from });
      perde('Oyun başka sekmede açıldı', 'İlerlemen orada sürüyor. Bu sekmeyi kapatabilirsin.', 'Burada oyna', () => location.reload());
    }
  };
  const ask = (k, ms, want) => new Promise((res) => {
    const t = setTimeout(() => { wait = null; res(false); }, ms);
    wait = (m) => { if (m.k === want) { clearTimeout(t); wait = null; res(true); } };
    ch.postMessage({ k, from: me });
  });
  return (async () => {
    if (await ask('kim', 600, 'ben')) {
      await new Promise((go) => perde('Oyun başka sekmede açık', 'İki sekmede birden oynarsan ilerlemen kaybolabilir. Burada oynamak istersen öbür sekme durur.', 'Burada oyna', go));
      await ask('al', 2500, 'tamam');
    }
    mine = true; claim();
  })();
}

// ---------- kalıcı depo ----------
export function kaliciDepo() {
  const s = navigator.storage;
  if (!s || !s.persist || /Firefox\//.test(navigator.userAgent)) return; // Firefox izin penceresi açar: sormuyoruz
  setTimeout(() => s.persisted().then((p) => p || s.persist()).catch(() => {}), 120000);
}

// ---------- ekran kartı ----------
export function ekranKarti(canvas) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); flush();
    perde('Ekran kartı bir an durdu', 'Oyunun kaydedildi. Kaldığın yerden devam etmek için yeniden aç.', 'Yeniden aç', () => location.reload());
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
}

// ---------- hata raporu ----------
// yerel sunucu ve test tarayıcısı (nodisk: pz.mjs, bot3.mjs) rapor göndermez
const PROD = !/^(localhost\.?|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && (() => { try { return localStorage.getItem('koyBakkali.nodisk') !== '1'; } catch (e) { return true; } })();
const SKIP = /ResizeObserver|^Script error|extension:\/\/|Load failed|Failed to fetch|NetworkError|network-request-failed|QuotaExceeded|AbortError/i;
const seen = new Set();
let sent = 0;
export function hata(msg, where = '', stack = '') {
  const key = String(msg).slice(0, 160);
  if (!PROD || sent >= 3 || seen.has(key) || SKIP.test(`${key} ${where}`)) return;
  seen.add(key); sent++;
  const text = [key, where, String(stack || '').split('\n').slice(0, 6).join('\n'), navigator.userAgent,
    `süre ${Math.round((G.stats && G.stats.time) || 0)} sn · seviye ${G.level || 1} · ${G.world || 'koy'}`].join('\n');
  setTimeout(() => sendFeedback('hata', text).catch(() => {}), 1500);
}
export function hataRaporu() {
  addEventListener('error', (e) => {
    if (e.filename && !e.filename.startsWith(location.origin)) return; // eklentilerin ve dış betiklerin hatası bizim değil
    hata(e.message, `${(e.filename || '').replace(location.origin, '')}:${e.lineno}:${e.colno}`, e.error && e.error.stack);
  });
  addEventListener('unhandledrejection', (e) => { const r = e.reason; hata((r && r.message) || String(r), 'promise', r && r.stack); });
}
