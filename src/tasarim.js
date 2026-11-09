// köy bakkalının tasarım seçimi (2026-11-08 kullanıcı: "köy bakkalını geliştirince büyürken zemin değiştiği aşamada zemini ve genel
// geliştirmede kişiselleştirme olsun tasarımı alternatifler yap seçelim"). Dört satır: zemin deseni, duvar ve cephe, tente, tabela.
// Seçim anında dükkâna uygulanır (main.js onCustom → world.js applyCustom → restyle); Tamam kaydeder. Dükkân büyürken kendiliğinden
// açılır (world.js setStage → G.hooks.tasarim), sonra Dükkan menüsünden her zaman ücretsiz değişir (menu.js dukkan sekmesi).
import * as THREE from 'three';
import { G } from './game.js';
import { tex, plasterOf } from './tex.js';
import { shopStyle } from './models.js';

export const ROWS = [
  { k: 'floor', t: 'Zemin', o: { ahsap: 'Ahşap', fayans: 'Fayans', dama: 'Damalı', mermer: 'Mermer', toprak: 'Pişmiş toprak', cini: 'Çini' } },
  { k: 'wallSt', t: 'Duvar', o: { siva: 'Sıva', tugla: 'Tuğla', tas: 'Taş', ahsap: 'Ahşap' } },
  { k: 'awningSt', t: 'Tente', o: { kavis: 'Kavisli', duz: 'Düz fırfırlı', kiremit: 'Kiremit saçak' } },
  { k: 'signSt', t: 'Tabela', o: { boya: 'Boyalı', ahsap: 'Tahta levha', isikli: 'Işıklı', harf: 'Kabartma harf' } },
];
const STYLE_KEY = { floor: 'floor', wallSt: 'wall', awningSt: 'awning', signSt: 'sign' }; // G.custom anahtarı → shopStyle alanı
const FLOOR_TEX = { ahsap: 'wood', fayans: 'tiles', dama: 'dama', mermer: 'mermer', toprak: 'toprak', cini: 'cini' };
const WALL_TEX = { tugla: 'tugla', tas: 'tas', ahsap: 'wood' };

// küçük resimler: doku görüntüsünden ya da elle çizilmiş önden görünüş; renge bağlı olanlar renk değişince yeniden çizilir
const thumbs = new Map();
const cv = () => { const c = document.createElement('canvas'); c.width = c.height = 96; return c; };
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function stripesFill(g, x, y, w, h, n, col) { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#ffffff' : col; g.fillRect(x + (i * w) / n, y, w / n + 0.5, h); } }
function thumb(k, v, c) {
  const col = c.awning || '#e8604c', key = `${k}|${v}|${k === 'wallSt' && v === 'siva' ? c.wall : k === 'awningSt' || k === 'signSt' ? col : ''}`;
  if (thumbs.has(key)) return thumbs.get(key);
  const el = cv(), g = el.getContext('2d');
  if (k === 'floor') {
    g.drawImage(tex(FLOOR_TEX[v]).image, 0, 0, 256, 256, 0, 0, 96, 96);
    if (v === 'ahsap') { g.fillStyle = 'rgba(226,191,143,0.35)'; g.fillRect(0, 0, 96, 96); }
  } else if (k === 'wallSt') {
    if (v === 'siva') g.drawImage(plasterOf(c.wall || '#6fc7bb').image, 0, 0, 256, 256, 0, 0, 96, 96);
    else g.drawImage(tex(WALL_TEX[v]).image, 0, 0, 256, 256, 0, 0, 96, 96);
    if (v === 'ahsap') { g.fillStyle = 'rgba(214,164,106,0.35)'; g.fillRect(0, 0, 96, 96); }
  } else if (k === 'awningSt') { // önden: krem duvar, üstünde tente
    g.fillStyle = '#bfe3f2'; g.fillRect(0, 0, 96, 96);
    g.fillStyle = '#fff3dc'; g.fillRect(6, 30, 84, 66);
    g.fillStyle = '#8fd0c4'; g.fillRect(6, 74, 84, 22);
    if (v === 'kavis') {
      g.save(); g.beginPath(); g.moveTo(2, 34); g.quadraticCurveTo(48, 6, 94, 34); g.lineTo(94, 52); g.quadraticCurveTo(48, 40, 2, 52); g.closePath(); g.clip();
      stripesFill(g, 2, 10, 92, 44, 8, col); g.restore();
    } else if (v === 'duz') {
      stripesFill(g, 4, 30, 88, 16, 8, col);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? col : '#ffffff'; g.beginPath(); g.arc(4 + 5.5 + i * 11, 46, 5.5, 0, Math.PI); g.fill(); }
      g.strokeStyle = '#3d4552'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, 60); g.lineTo(10, 46); g.moveTo(86, 60); g.lineTo(86, 46); g.stroke();
    } else {
      g.fillStyle = '#b8552f'; g.beginPath(); g.moveTo(10, 24); g.lineTo(86, 24); g.lineTo(94, 46); g.lineTo(2, 46); g.closePath(); g.fill();
      g.fillStyle = '#cf6b3f'; for (let j = 0; j < 3; j++) for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(4 + i * 8 + (j % 2) * 4, 30 + j * 6, 4, 0, Math.PI); g.fill(); }
      g.fillStyle = '#8a5a33'; g.fillRect(2, 46, 92, 4);
      g.fillStyle = '#9c4a2a'; g.fillRect(10, 21, 76, 4);
    }
  } else { // tabela (örnek yazı ABC: dil.js tuval yazısını çevirir, "KÖY" İngilizcede taşıyordu)
    g.fillStyle = v === 'harf' ? '#fff3dc' : '#bfe3f2'; g.fillRect(0, 0, 96, 96);
    if (v === 'harf') { g.fillStyle = '#3d4552'; g.fillRect(10, 56, 76, 4); }
    else {
      g.fillStyle = v === 'isikli' ? '#3d4552' : v === 'ahsap' ? '#5e3b1f' : '#ffffff';
      rr(g, 6, 28, 84, 40, 8); g.fill();
      g.fillStyle = v === 'isikli' ? '#fffaf0' : v === 'ahsap' ? '#9a6436' : col;
      rr(g, 10, 32, 76, 32, 6); g.fill();
      if (v === 'ahsap') { g.strokeStyle = 'rgba(80,45,22,0.35)'; g.lineWidth = 1; for (let y = 38; y < 62; y += 6) { g.beginPath(); g.moveTo(12, y); g.lineTo(84, y); g.stroke(); } }
      if (v === 'isikli') { g.shadowColor = col; g.shadowBlur = 10; }
    }
    g.font = "900 22px 'Nunito','Segoe UI',sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (v === 'harf') { g.lineWidth = 5; g.strokeStyle = '#ffffff'; g.lineJoin = 'round'; g.strokeText('ABC', 48, 46); }
    g.fillStyle = v === 'ahsap' ? '#fff1d6' : v === 'boya' ? '#ffffff' : col;
    g.fillText('ABC', 48, 49);
  }
  const url = el.toDataURL();
  thumbs.set(key, url);
  return url;
}

// satırların HTML'i: hem seçim kartında hem Dükkan menüsünde (data-st / data-v ile tıklanır)
export function rowsHtml() {
  const c = G.custom, K = G.regions.koy, cur = shopStyle(K && K.shop ? K.shop.userData.stage : 1, c);
  return ROWS.map((r) => `<div class="tz-row"><span class="tz-lbl">${r.t}</span><div class="tz-opts">${Object.entries(r.o).map(([v, name]) =>
    `<button type="button" class="tz-opt${cur[STYLE_KEY[r.k]] === v ? ' on' : ''}" data-st="${r.k}" data-v="${v}"><img src="${thumb(r.k, v, c)}" alt=""><small>${name}</small></button>`).join('')}</div></div>`).join('');
}

const CSS = `
#tasarim { position: fixed; left: 0; right: 0; bottom: 0; z-index: 5; display: none; justify-content: center; pointer-events: none; }
#tasarim.open { display: flex; }
#tasarim .tz-card { pointer-events: auto; width: min(720px, calc(100vw - 16px)); box-sizing: border-box; margin-bottom: max(8px, env(safe-area-inset-bottom));
  background: var(--panel-bg, #fffaf0); color: var(--panel-ink, #3a2f25); border: var(--bw, 3px) solid var(--line, #3a2f25); border-radius: calc(var(--radius, 14px) + 6px);
  box-shadow: 0 8px 0 rgba(0,0,0,.25); padding: 10px 12px 12px; animation: pop .32s cubic-bezier(.2,1.6,.4,1); }
#tasarim .tz-head { display: flex; align-items: center; gap: 10px; }
#tasarim .tz-head b { font-size: 18px; }
#tasarim .tz-head small { opacity: .75; flex: 1; }
.tz-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.tz-lbl { width: 54px; flex: none; font-weight: 800; font-size: 13px; }
.tz-opts { display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px 6px; scrollbar-width: thin; }
.tz-opt { flex: none; width: 64px; padding: 3px 3px 4px; border-radius: 12px; border: 3px solid transparent; background: rgba(0,0,0,.05); display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; color: inherit; font: inherit; }
.tz-opt img { width: 50px; height: 50px; border-radius: 8px; display: block; box-shadow: 0 0 0 1px rgba(0,0,0,.15); }
.tz-opt small { font-size: 11px; line-height: 1.1; text-align: center; font-weight: 700; }
.tz-opt.on { border-color: #ffb627; background: rgba(255,182,39,.18); }
#tasarim .tz-ok { flex: none; padding: 8px 18px; border-radius: 12px; border: var(--bw, 3px) solid var(--line, #3a2f25); background: #3fae6b; color: #fff; font-weight: 900; font-size: 15px; cursor: pointer; }
/* kart kaydırılmaz (kaydırılan kart başsız Chrome'da üstündeki oyun görüntüsünü siliyordu); yalnız çok alçak ekranda kayar */
@media (max-height: 560px) { #tasarim .tz-card { max-height: 78vh; max-height: 78dvh; overflow-y: auto; } }
/* geniş ekranda iki sütun: kart alçak kalır, dükkân görünür */
@media (min-width: 1000px) and (min-height: 561px) { #tasarim .tz-card { width: min(1140px, calc(100vw - 16px)); } #tasarim .tz-body { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; } }
@media (max-width: 520px) { .tz-lbl { width: 44px; font-size: 12px; } .tz-opt { width: 60px; } .tz-opt img { width: 48px; height: 48px; } #tasarim .tz-head small { display: none; } }
`;

let el = null, apply = null, isOpen = false, prevPause = false, prevK = 1, camSet = false, tries = 0;
function mount() {
  if (el) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'tasarim';
  el.innerHTML = '<div class="tz-card"><div class="tz-head"><b>🎨 Dükkânının tasarımı</b><small>Beğendiğine dokun, dükkâna hemen uygulanır. Sonra Dükkan menüsünden de değiştirebilirsin.</small><button type="button" class="tz-ok">Tamam</button></div><div class="tz-body"></div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.classList.contains('tz-ok')) { closeTasarim(); return; }
    if (t.dataset.st) { pick(t.dataset.st, t.dataset.v); render(); }
  });
}
const render = () => { el.querySelector('.tz-body').innerHTML = rowsHtml(); };
// seçim G.custom'a yazılır; dükkân yeniden kurulur (aynı biçimse yalnız boyanır)
export function pick(k, v) { if (!ROWS.some((r) => r.k === k && v in r.o)) return; G.custom[k] = v; if (apply) apply(false); }

// grow: dükkân büyüdü (kendiliğinden açılış). Başka pencere ya da sinematik açıksa biraz sonra yeniden denenir
export function openTasarim(grow = false) {
  if (isOpen) return;
  if (G.menuOpen || G.cine || G.mini || document.querySelector('.modal.open')) { if (grow && tries++ < 20) setTimeout(() => openTasarim(true), 2000); return; }
  tries = 0; mount(); render();
  isOpen = true; G.menuOpen = true; prevPause = G.paused; G.paused = true;
  el.classList.add('open');
  const K = G.regions.koy, s = K && K.shop;
  if (s) { // kamera dükkâna döner ve biraz uzaklaşır; kart ekranın altını kapladığı için odak dükkânın önünde (dükkân üst yarıda görünür)
    const b = new THREE.Box3().setFromObject(s), cx = (b.min.x + b.max.x) / 2;
    const tall = el.querySelector('.tz-card').offsetHeight > innerHeight * 0.45; // telefonda kart yüksek: dükkân daha yukarıda kalmalı
    const focus = { pos: new THREE.Vector3(cx, 0, tall ? -3 : -5.5), until: Infinity };
    prevK = G.camK || 1; G.camK = prevK * (b.max.x - b.min.x > 24 ? 1.35 : 1.15); camSet = true;
    // oyun duraklıyken hız güncellenmez: açılışta koşuyorsa kamera odağı hemen düşerdi (main.js updateCamera); kart açıkken her karede yenilenir
    const keep = () => { if (!isOpen) return; G.camFocus = focus; requestAnimationFrame(keep); };
    keep();
  }
}
export function closeTasarim() {
  if (!isOpen) return;
  isOpen = false; el.classList.remove('open');
  G.menuOpen = false; G.paused = prevPause;
  if (G.camFocus && G.camFocus.until === Infinity) G.camFocus = null;
  if (camSet) { G.camK = prevK; camSet = false; }
  if (apply) apply(true); // kaydet
}
export const tasarimOpen = () => isOpen;

export function initTasarim(onCustom) {
  apply = onCustom;
  G.hooks.tasarim = openTasarim;
  addEventListener('keydown', (e) => { if (isOpen && (e.code === 'Escape' || e.code === 'Enter')) { e.preventDefault(); closeTasarim(); } });
}
