// Avatar yetenekleri (2026-11-07 kullanıcı: "avatarımıza elmas ve çok yüksek parayla bazı özellikler ekleyebilelim. örnek zıplama. shift ile
// hızlı koşma ... shift enerjisi olsun. bunu mobile göre de uyarla"). Fiyat ve seviyeler upgrades.js UPG'de (jump, sprint, magnet).
// Zıplama: yükseklik J.y, main.js updatePlayer ekler. Yatay çarpışma aynı kalır, engelleri aşmaz: kilitli bölgenin çiti kapalı kalsın.
// Hızlı koşu: Shift basılıyken ya da ⚡ düğmesi açıkken. Enerji koşarken azalır, koşmayınca dolar; bitince %20 dolmadan yeniden başlamaz.
// Telefonda düğmeye dokunmak aç-kapa (joystick parmağı yerindeyken ikinci parmağı tutmak gerekmez), enerji bitince kendiliğinden kapanır.
// Para Mıknatısı: yakındaki MoneyPile'a pull verir (game.js), üstüne basmadan toplanır.
import { G, MoneyPile, sfx, floatText, bounce, initAudio } from './game.js';
import { UPG } from './upgrades.js';
import { smoke } from './fx.js';
import { t } from './dil.js';

const RUN_K = 1.55, RUN_MAX = 15.5, REFILL = 12, WAKE = 0.2, GRAV = 20, HOP = 6.6;
export const J = { y: 0, v: 0, run: false };
let en = 1, tired = false, rest = 0, toggle = false;

const lv = (k) => (G.upg && G.upg[k]) || 0;
const tank = () => UPG.sprint.values[lv('sprint')] || 0;
const busy = () => G.paused || G.menuOpen || G.cine || G.mini || G.onRide;
export const hasJump = () => lv('jump') > 0;
// tatil keyfi dolu dönüş: Shift enerjisi tam (tatil.js)
G.hooks = G.hooks || {};
G.hooks.fillEnergy = () => { en = 1; tired = false; };

export function tryJump() {
  if (!hasJump() || busy() || J.y > 0 || J.v !== 0) return false;
  J.v = HOP;
  smoke(G.player.position, { size: 0.26, grow: 2, alpha: 0.4 });
  sfx('put');
  return true;
}
// karenin yüksekliği; inişte toz ve küçük bir ezilme
export function stepJump(dt) {
  if (J.y === 0 && J.v === 0) return 0;
  J.v -= GRAV * dt; J.y += J.v * dt;
  if (J.y <= 0) {
    J.y = 0; J.v = 0;
    for (let i = 0; i < 2; i++) smoke(G.player.position, { size: 0.3, grow: 2.4, alpha: 0.45 });
    bounce(G.player, 0.1);
    sfx('put');
  }
  return J.y;
}
// bu karenin yürüyüş hızı. moving: oyuncu gerçekten ilerliyor (duvara dayanınca enerji gitmesin)
export function runSpeed(base, held, moving, dt) {
  const cap = tank();
  J.run = cap > 0 && (held || toggle) && moving && !tired && en > 0 && !busy();
  if (J.run) {
    en = Math.max(0, en - (dt * (G.dinc ? 0.5 : 1)) / cap); rest = 0.5; // tatilden dinç dönünce yarı hızda biter (tatil.js G.dinc)
    if (en === 0) { tired = true; toggle = false; floatText(G.player.position.clone().setY(2.4), '⚡ Enerji bitti', 'neg'); }
    return Math.min(base * RUN_K, RUN_MAX);
  }
  rest -= dt;
  if (rest <= 0) en = Math.min(1, en + dt / REFILL);
  if (tired && en >= WAKE) tired = false;
  return base;
}

const CSS = `#abil { position: absolute; right: 342px; bottom: 30px; display: none; gap: 12px; align-items: flex-end; }
#abil button { position: relative; width: 72px; height: 72px; padding: 0; border-radius: 50%; border: var(--bw) solid var(--line); color: #fff; font: 30px/1 var(--font-title); display: none; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; box-shadow: 0 4px 0 rgba(0,0,0,.28); }
#abil button:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,.28); }
#abJump { background: #4c9be8; }
#abRun { background: conic-gradient(#ffd23f calc(var(--e, 1) * 1turn), rgba(0,0,0,.38) 0); }
#abRun::before { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: #3a2b78; }
#abRun.on::before { background: #6a48d8; box-shadow: 0 0 12px #ffd23f; }
#abRun.tired { filter: grayscale(.75); }
#abil b { position: relative; font-weight: normal; }
#abil kbd { position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%); padding: 0 6px; border-radius: 8px; background: #fff; color: #333; font: 11px/16px var(--font-body); white-space: nowrap; }
.enbar { width: 48px; height: 8px; border-radius: 5px; background: rgba(0,0,0,.45); border: 1.5px solid #fff; overflow: hidden; pointer-events: none; }
.enbar i { display: block; height: 100%; background: #ffd23f; }
.enbar.low i { background: #e8473c; }
.urow button .ugem { margin-left: 8px; white-space: nowrap; }
@media (max-width: 640px) { .urow button:has(.ugem) { font-size: 15px; padding-right: 10px; } .urow button:has(.ugem) .coin { width: 24px; height: 24px; font-size: 12px; } .urow button .ugem { margin-left: 5px; } }
@media (pointer: coarse) { #abil kbd { display: none; } }
@media (max-width: 640px) { #hud #abil { right: 8px; bottom: 218px; flex-direction: column-reverse; gap: 8px; } #abil button { width: 60px; height: 60px; font-size: 25px; } }`;

let el = null, bJ = null, bR = null, bar = null, fill = null, label = null, lastE = -1, lastJ = false, lastR = false, lastShow = null, magT = 0, mapEl = null, placeT = 0;
const PHONE = matchMedia('(max-width: 640px)');
function press(btn, fn) {
  btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); initAudio(); fn(); });
  btn.addEventListener('mousedown', (e) => e.preventDefault()); // odak almasın: Boşluk düğmeye tıklamasın
}
function ui() {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'abil';
  el.innerHTML = '<button type="button" id="abJump" tabindex="-1" aria-label="Zıpla (Boşluk)"><b>🦘</b><kbd>Boşluk</kbd></button><button type="button" id="abRun" tabindex="-1" aria-label="Hızlı koş (Shift)"><b>⚡</b><kbd>Shift</kbd></button>';
  hud.appendChild(el);
  bJ = el.querySelector('#abJump'); bR = el.querySelector('#abRun');
  press(bJ, tryJump);
  press(bR, () => { if (!busy() && tank() > 0) toggle = !toggle; });
  bar = document.createElement('div'); bar.className = 'enbar'; bar.innerHTML = '<i></i>'; fill = bar.firstChild;
  label = G.labels.add(bar, (v) => v.copy(G.player.position).setY(G.player.position.y + 2.55));
  label.hidden = true;
}
function magnet(dt) {
  const r = UPG.magnet.values[lv('magnet')];
  if (!r) return;
  magT -= dt;
  if (magT > 0) return;
  magT = 0.15;
  const p = G.player.position, off = G.onRide || G.cine || G.mini;
  for (const s of G.stations) if (s instanceof MoneyPile) s.pull = !off && s.amount > 0 && Math.hypot(s.zone.x - p.x, s.zone.z - p.z) <= r;
}
export function updateYetenek(dt) {
  if (!el) ui();
  if (!el) return;
  magnet(dt);
  if (!mapEl) mapEl = document.getElementById('minimap');
  const j = hasJump(), r = tank() > 0, show = (j || r) && !busy() && !(mapEl && mapEl.classList.contains('big')); // büyük haritada düğmeler ✕'in üstüne biniyordu
  if (show !== lastShow) { lastShow = show; el.style.display = show ? 'flex' : 'none'; }
  // telefonda BAĞIR'ın yerini hudmenu.js mini harita çubuğuna göre JS ile kurar (64 px boy): düğmeler onun 8 px üstünde durur
  placeT -= dt;
  if (placeT <= 0) {
    placeT = 0.4;
    const s = document.getElementById('shout'), b = PHONE.matches && s ? parseFloat(s.style.bottom) : 0;
    el.style.bottom = b ? `${Math.round(b + 72)}px` : '';
  }
  if (j !== lastJ) {
    lastJ = j; bJ.style.display = j ? 'flex' : 'none';
    const s = document.getElementById('shout'); if (s) s.setAttribute('aria-label', t(j ? 'Bağır (Q)' : 'Bağır (Boşluk)'));
  }
  if (r !== lastR) { lastR = r; bR.style.display = r ? 'flex' : 'none'; }
  if (!r) return;
  if (Math.abs(en - lastE) > 0.004 || (en === 1 && lastE !== 1)) {
    lastE = en;
    bR.style.setProperty('--e', en.toFixed(3));
    fill.style.width = `${Math.round(en * 100)}%`;
    bar.classList.toggle('low', en < 0.25);
  }
  bR.classList.toggle('on', toggle || J.run);
  bR.classList.toggle('tired', tired);
  label.hidden = en >= 1 && !J.run;
}
window.__yetenek = () => ({ en, tired, toggle, ...J }); // test kancası
