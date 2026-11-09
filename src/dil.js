// Dil seçimi: Türkçe (kaynak metin) ya da İngilizce. Metinler kaynakta Türkçe yazılır; İngilizcede ekrana çıkarken çevrilir:
// HTML metin düğümleri ve title/placeholder/aria-label (MutationObserver), tuval yazısı (fillText/strokeText/measureText: tabelalar,
// küçük harita, afişler), confirm/alert ve sekme adı. Sözlük dil-en.js (Türkçe → İngilizce); {0},{1} yer tutuculu kalıplar şablon
// metinler içindir, yerine gelen değer (ürün, bölge adı) de ayrıca çevrilir. Dil değişince sayfa yenilenir (kayıt beforeunload'da yazılır).
// İlk açılışta tarayıcı Türkçeyse Türkçe, değilse İngilizce. translate="no" taşıyan öğenin içi çevrilmez (oyuncu adları, dil düğmeleri).
const KEY = 'koyBakkali.lang';
const pick = () => {
  try { const v = localStorage.getItem(KEY); if (v === 'tr' || v === 'en') return v; } catch (e) { /* gizli pencere: tarayıcı diline göre */ }
  return /^tr\b/i.test(navigator.language || '') ? 'tr' : 'en';
};
export const LANG = pick();
export const EN = LANG === 'en';

export function setLang(l) {
  if (l !== 'tr' && l !== 'en') return;
  try { localStorage.setItem(KEY, l); } catch (e) { /* kaydedilemese de bu açılışta geçer */ }
  if (l !== LANG) location.reload();
}

const LETTER = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
const dict = new Map(), cache = new Map(), done = new Set();
let pats = [], frag = null, ready = false, spent = 0;
export const dilStats = () => ({ ms: spent, cache: cache.size, pats: pats.length }); // test: gözlemcinin harcadığı toplam süre

// bir metni çevirir; bilinmiyorsa olduğu gibi döner. Baştaki ve sondaki boşluk korunur
export function t(s) {
  if (!ready || typeof s !== 'string' || !(LETTER.test(s) || s.includes('%')) || done.has(s)) return s; // "%100 → %110" harfsiz ama çevrilir
  let r = cache.get(s);
  if (r !== undefined) return r;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  r = m[1] + conv(m[2].replace(/\s+/g, ' ')) + m[3];
  if (cache.size > 8000) { cache.clear(); done.clear(); } // sayılı metinler (Yün 12 ₺) birikmesin
  cache.set(s, r); done.add(r);
  return r;
}

// sırayla: birebir (küçük harfli, BÜYÜK HARFLİ, sonu sayılı, başı simgeli hali de), kalıp ({0} yerine gelen değer de
// çevrilir), en son metnin içindeki bilinen parçalar
const SEP = / [·→] /, SEPS = /( [·→] )/;
function conv(c) {
  const d = whole(c);
  if (d !== undefined) return dec(d);
  const p = pat(c);
  if (p != null) return dec(p);
  // " · " ya da " → " ile birleşmiş parçalar (aşama ödülü listesi, "4 ürün → 5 ürün"): her parça ayrı çevrilir
  if (SEP.test(c)) return c.split(SEPS).map((x, i) => (i % 2 ? x : t(x))).join('');
  return dec(frag ? c.replace(frag, (all, pre, w) => pre + (dict.get(w) ?? w)) : c);
}
const cap = (w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1);
function whole(c) {
  const d = dict.get(c);
  if (d !== undefined) return d;
  // kaynakta küçültülmüş ad ("Bir sütçü daha"): sözlükteki büyük harfli hali
  if (cap(c) !== c && dict.has(cap(c))) return dict.get(cap(c)).toLowerCase();
  // tabeladaki büyük harfli ad (DOMATES, KOYUN YOĞURDU): sözlükteki "Domates", "Koyun yoğurdu" ya da "Koyun Yoğurdu"
  if (c === c.toLocaleUpperCase('tr') && c !== c.toLocaleLowerCase('tr')) {
    const lo = c.toLocaleLowerCase('tr'), hit = dict.get(cap(lo)) ?? dict.get(lo.split(' ').map(cap).join(' '));
    if (hit !== undefined) return hit.toUpperCase();
  }
  // numaralı eleman ("Balıkçı çırağı 2"): genel "Balıkçı {0}" kalıbından önce adın kendisi
  const nm = /^(.*\S) (\d+)$/.exec(c);
  if (nm && dict.has(nm[1])) return dict.get(nm[1]) + ' ' + nm[2];
  // başında ya da sonunda simge ("⚙️ İşlenmiş ürün", "Domates ✓")
  const sm = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}.!?…)]*)$/u.exec(c);
  if (sm && (sm[1] || sm[3]) && sm[2] && dict.has(sm[2])) return sm[1] + dict.get(sm[2]) + sm[3];
  return undefined;
}
// ondalık virgül (kaynakta 3,0 m/s; × 1,5): İngilizcede nokta. Binlik ayıracı üç hanelidir, ona dokunmaz
const dec = (s) => s.replace(/(\d),(\d{1,2})(?!\d)/g, '$1.$2').replace(/%(\d+(?:\.\d+)?)/g, '$1%'); // 3,5 → 3.5 · %145 → 145%
function pat(c) {
  for (const p of pats) {
    const mm = p.re.exec(c);
    if (mm) return p.en.replace(/\{(\d+)\}/g, (_, i) => t(mm[p.g[i]] ?? ''));
  }
  return null;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function build(src) {
  const fr = [];
  for (const [k0, v0] of Object.entries(src)) {
    if (v0 == null) continue;
    const k = k0.trim().replace(/\s+/g, ' '), v = v0.trim();
    if (!k || dict.has(k)) continue;
    dict.set(k, v);
    if (/\{\d+\}/.test(k)) {
      const lit = k.replace(/\{\d+\}/g, '');
      if ((lit.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length < 2) continue; // "{0} ₺" gibi her şeye uyan kalıp olmasın
      // yer tutucu boş da olabilir ("Bekçi hırsızı yakaladı${back}") ama " → " aşamaz ("4 ürün → 5 ürün" "{0} ürün"e uymasın)
      const g = {}; let n = 0;
      const re = '^' + k.split(/(\{\d+\})/).map((x) => { const ph = /^\{(\d+)\}$/.exec(x); if (ph) { g[ph[1]] = ++n; return '((?:(?! → )[^])*?)'; } return esc(x); }).join('') + '$';
      pats.push({ re: new RegExp(re, 's'), en: v, g, w: lit.length });
    } else if (k.length >= 3) fr.push(k);
  }
  pats.sort((a, b) => b.w - a.w);
  fr.sort((a, b) => b.length - a.length);
  try { frag = new RegExp('(^|[^\\p{L}\\p{N}])(' + fr.map(esc).join('|') + ')(?![\\p{L}\\p{N}])', 'gu'); } catch (e) { frag = null; }
  ready = true;
}

// ---------- ekrana çıkan yerler ----------
const ATTRS = ['title', 'placeholder', 'aria-label'];
const off = (el) => !el || el.nodeName === 'SCRIPT' || el.nodeName === 'STYLE' || el.nodeName === 'TEXTAREA' || (el.closest && el.closest('[translate="no"]'));
function textNode(n) {
  const v = n.data, r = t(v);
  if (r !== v && !off(n.parentElement)) n.data = r;
}
function attrOf(el, a) {
  const v = el.getAttribute(a);
  if (!v) return;
  const r = t(v);
  if (r !== v && !(el.closest && el.closest('[translate="no"]'))) el.setAttribute(a, r); // textarea'nın placeholder'ı da çevrilir
}
// şablonun ${} kısmı HTML üretmişse (Bu modeller <a>CC BY 3.0</a> lisansıyla…) cümle birkaç metin düğümüne bölünür; öğenin
// çocuk öğeleri işaretle yer tutucu yapılıp cümle bütün olarak sözlükte aranır, bulununca metin düğümleri yeniden dizilir
const MK = '\uE000', mixCache = new Map(); // denenmiş cümle → çeviri ya da null (her karede yeniden aranmasın)
function mixed(el) {
  const kids = el.childNodes;
  if (kids.length < 2 || kids.length > 16) return false;
  const els = [];
  let s = '', turk = false;
  for (const k of kids) {
    if (k.nodeType === 3) { s += k.data; if (LETTER.test(k.data)) turk = true; }
    else if (k.nodeType === 1) { els.push(k); s += MK + (els.length - 1) + MK; }
  }
  if (!turk || !els.length) return false;
  const core = s.trim().replace(/\s+/g, ' ');
  let en = mixCache.get(core);
  if (en === undefined) {
    en = whole(core.replace(/\uE000(\d+)\uE000/g, '{$1}'));
    if (en !== undefined) en = en.replace(/\{(\d+)\}/g, (_, i) => MK + i + MK);
    else en = pat(core);
    if (mixCache.size > 3000) mixCache.clear();
    mixCache.set(core, en);
  }
  if (en == null) return false;
  const f = document.createDocumentFragment(), parts = dec(en).split(/\uE000(\d+)\uE000/);
  parts.forEach((p, i) => { if (i % 2) { if (els[+p]) f.appendChild(els[+p]); } else if (p) { const n = document.createTextNode(p); done.add(p); f.appendChild(n); } });
  if (/^\s/.test(s)) f.prepend(' ');
  if (/\s$/.test(s)) f.append(' ');
  el.replaceChildren(f);
  return true;
}
const hasMix = (el) => { let tx = false, ch = false; for (const k of el.childNodes) { if (k.nodeType === 1) ch = true; else if (k.nodeType === 3 && LETTER.test(k.data)) tx = true; } return tx && ch; };
function walk(root) {
  if (root.nodeType === 3) { textNode(root); if (root.parentElement && t(root.data) === root.data && hasMix(root.parentElement)) mixed(root.parentElement); return; }
  if (root.nodeType !== 1 || off(root)) return;
  for (const a of ATTRS) if (root.hasAttribute(a)) attrOf(root, a);
  if (hasMix(root)) mixed(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) { const p = n.parentNode; if (p && p.nodeName !== 'SCRIPT' && p.nodeName !== 'STYLE') textNode(n); }
    else {
      for (const a of ATTRS) if (n.hasAttribute(a)) attrOf(n, a);
      if (n.nodeName !== 'SCRIPT' && n.nodeName !== 'STYLE' && hasMix(n) && !off(n)) mixed(n);
    }
  }
}

function hookCanvas(C) {
  if (!C) return;
  for (const k of ['fillText', 'strokeText', 'measureText']) {
    const f = C[k];
    C[k] = function (s, ...a) { return f.call(this, typeof s === 'string' ? t(s) : s, ...a); };
  }
}

export async function initLang() {
  // dil düğmeleri (Ayarlar ve ilk açılış penceresi): her iki dilde çalışır
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
  for (const b of document.querySelectorAll('[data-lang]')) b.classList.toggle('on', b.dataset.lang === LANG);
  if (!EN) return;
  document.documentElement.lang = 'en';
  try { build((await import('./dil-en.js')).default); } catch (e) { console.warn('İngilizce sözlük yüklenemedi', e); return; }
  const man = document.querySelector('link[rel="manifest"]');
  if (man) man.href = 'manifest-en.webmanifest';
  hookCanvas(window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype);
  hookCanvas(window.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype);
  // sayılar ve saat: kaynakta toLocaleString('tr-TR') (192.413); İngilizcede 192,413 ve 24 saatlik saat
  const nl = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function (loc, o) { return nl.call(this, loc === 'tr-TR' || loc === 'tr' ? 'en-US' : loc, o); };
  for (const k of ['toLocaleString', 'toLocaleTimeString', 'toLocaleDateString']) {
    const f = Date.prototype[k];
    Date.prototype[k] = function (loc, o) { return f.call(this, loc === 'tr-TR' || loc === 'tr' ? 'en-GB' : loc, o); };
  }
  const oc = window.confirm.bind(window), oa = window.alert.bind(window);
  window.confirm = (m) => oc(t(String(m)));
  window.alert = (m) => oa(t(String(m)));
  walk(document.documentElement);
  new MutationObserver((ms) => {
    const t0 = performance.now();
    for (const m of ms) {
      if (m.type === 'characterData') walk(m.target);
      else if (m.type === 'attributes') attrOf(m.target, m.attributeName);
      else for (const n of m.addedNodes) walk(n);
    }
    spent += performance.now() - t0;
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
