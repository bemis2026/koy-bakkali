// Arayüz: para sayacı, hedef kartı, kutlama afişi, uçan paralar, dükkan kurulumu ve tema
import * as THREE from 'three';
import { G } from './game.js';
import { levelProgress, titleOf, xpFor } from './level.js';
import { settings, saveSettings, play } from './audio.js';
import { EN } from './dil.js';

const $ = (id) => document.getElementById(id);
const REGION_ICON = { koy: '🏡', pazar: '🍉', sahil: '🏖️', han: '🐫', tarla: '🌽', mera: '🐑', meydan: '🅿️', ciftlik: '🐄', atolye: '🧶', yol: '🛤️', atlar: '🐎', firin: '🥯', kargo: '📦', tatil: '🐚', lunapark: '🎡', kasaba: '⛲', enerji: '🌬️', tarlalar: '🚜', iskele: '🎣', sehir: '🏙️' };
let shown = 0, lastRegion = null, lastName = '', goalDef = null, coinT = 0, lastLv = 0;
const v = new THREE.Vector3();

export function applyTheme(t) {
  document.body.dataset.theme = t;
  settings.theme = t;
  saveSettings();
  for (const b of document.querySelectorAll('.th')) b.classList.toggle('on', b.dataset.t === t);
}

export function initUI() {
  applyTheme(settings.theme || 'bahar');
  shown = Math.floor(G.money);
  $('moneyv').textContent = shown.toLocaleString('tr-TR');
  document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('button')) play('click', { gap: 30 }); }, true);
  G.hooks.coin = coinFly;
}

// ---------- dükkanını kur / düzenle ----------
export const PALETTES = {
  awning: ['#e8604c', '#3d7dd8', '#3fae6b', '#f6a623', '#9c5bd6', '#e85d9a', '#2f8e88', '#5a3b2a'],
  wall: ['#6fc7bb', '#f2a65a', '#9fc5f0', '#c9e6a0', '#f4b6c2', '#d9c3f0', '#e8d9b0', '#b8c2cc'],
  shirt: ['#3b8beb', '#e8604c', '#3fae6b', '#f6c343', '#9c8cf0', '#ff8a65', '#2a2a2a', '#ffffff'],
};
let onCustom = () => {};
export function initCustomize(apply) {
  onCustom = apply;
  const W = $('welcome');
  for (const box of W.querySelectorAll('.sw')) {
    const k = box.dataset.k;
    box.innerHTML = PALETTES[k].map((c) => `<button type="button" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-c]');
      if (!b) return;
      G.custom[k] = b.dataset.c;
      markSwatches();
      onCustom();
    });
  }
  $('shopName').addEventListener('input', () => { G.custom.name = $('shopName').value.trim() || 'Köy Bakkalı'; onCustom(); });
  // karakterin adı: başının üstünde görünür (world.js applyCustom); boş bırakılırsa ad etiketi çıkmaz
  $('playerName').addEventListener('input', () => { G.custom.player = $('playerName').value.trim().slice(0, 14); onCustom(); });
  W.addEventListener('pointerdown', (e) => e.stopPropagation());
  $('welcomeGo').addEventListener('click', () => {
    const first = !G.custom.named;
    G.custom.named = true;
    W.classList.remove('open');
    G.menuOpen = false;
    onCustom(true);
    play(first ? 'region' : 'buy');
    if (first) banner('HAYIRLI OLSUN!', `${G.custom.name} açıldı`);
  });
}
function markSwatches() {
  for (const box of document.querySelectorAll('#welcome .sw')) for (const b of box.querySelectorAll('button')) b.classList.toggle('on', b.dataset.c === G.custom[box.dataset.k]);
}
export function openCustomize(first) {
  $('welcomeTitle').textContent = first ? 'Dükkanını kur!' : 'Dükkanını düzenle';
  $('welcomeGo').textContent = first ? 'Dükkanı aç! 🎉' : 'Kaydet';
  const def = G.custom.name === 'Köy Bakkalı';
  $('shopName').value = def && first ? '' : def && EN ? 'Village Grocer' : G.custom.name;
  $('playerName').value = G.custom.player || '';
  markSwatches();
  G.menuOpen = true;
  $('welcome').classList.add('open');
  play('open');
}

export function banner(small, big) {
  const el = $('banner');
  $('bannerSmall').textContent = small;
  $('bannerBig').textContent = big;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

export function setTip(t) { $('tip').textContent = t; }

function bump() { const m = $('money'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); }

// dünyadaki para yığınından üstteki sayaca uçan madeni para
let coinR = null, coinRT = 0;
export function coinFly(pos) {
  const now = performance.now();
  if (now - coinT < 70) return;
  coinT = now;
  v.set(pos.x, pos.y + 1, pos.z).project(G.camera);
  if (v.z > 1) return;
  const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
  // para simgesinin yeri saniyede bir ölçülür (her parada ölçmek zorunlu yerleşim hesabıydı)
  if (!coinR || now - coinRT > 1000) { coinR = $('money').querySelector('.coin').getBoundingClientRect(); coinRT = now; }
  const r = coinR, tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  const mx = (x + tx) / 2 + (Math.random() - 0.5) * 140, my = Math.min(y, ty) + 40;
  const el = document.createElement('i');
  el.className = 'cf';
  $('coins').appendChild(el);
  const a = el.animate([
    { transform: `translate(${x}px, ${y}px) scale(.5)` },
    { transform: `translate(${mx}px, ${my}px) scale(1.15)`, offset: 0.45 },
    { transform: `translate(${tx}px, ${ty}px) scale(.8)` },
  ], { duration: 650, easing: 'cubic-bezier(.5,0,.7,1)' });
  a.onfinish = () => { el.remove(); bump(); };
}

export function updateUI(dt, region) {
  const target = Math.floor(G.money);
  if (shown !== target) {
    const d = target - shown;
    shown += Math.abs(d) <= 2 ? d : Math.round(d * Math.min(1, dt * 9)) || Math.sign(d);
    $('moneyv').textContent = shown.toLocaleString('tr-TR');
  }
  if (region && (region !== lastRegion || region.name !== lastName)) {
    lastRegion = region; lastName = region.name;
    $('region').querySelector('.ri').textContent = REGION_ICON[region.id];
    const rn = $('region').querySelector('.rn');
    // oyuncunun koyduğu dükkân adı İngilizcede sözlükten geçmesin ("Bahar" → "Spring"); varsayılan ad çevrilir
    if (region.id === 'koy' && region.name !== 'Köy Bakkalı') rn.setAttribute('translate', 'no'); else rn.removeAttribute('translate');
    rn.textContent = region.name;
  }
  // mertebe rozeti: seviye, unvan, XP çubuğu; seviye atlayınca zıplar
  if (G.level) {
    const lv = $('lvl');
    if (G.level !== lastLv) { if (lastLv) { lv.classList.remove('up'); void lv.offsetWidth; lv.classList.add('up'); } lastLv = G.level; $('lvlN').textContent = G.level; $('lvlT').textContent = titleOf(G.level); }
    const lw = `${(levelProgress() * 100).toFixed(1)}%`;
    if (lv._bw !== lw) { lv._bw = lw; $('lvlBar').style.width = lw; }
  }
  const pad = G.nextPad, goal = $('goal'), wait = !pad && G.nextWait;
  // Hedef kartının fiyatı, ipucu ve çubuğu her karede yazılıyordu: textContent aynı yazıyla da metin düğümünü değiştirir (stil ve
  // yerleşim yeniden hesaplanır, İngilizcede çeviri gözlemcisi her karede çalışır), fiyat her karede toLocaleString ile kuruluyordu
  // (2026-11-10 denetimi). Anahtar değişmedikçe yazılmaz
  const price = (k, make) => { if (goal._pk !== k) { goal._pk = k; $('goalPrice').textContent = make(); } };
  const tipOf = (k, make) => { if (goal._tk !== k) { goal._tk = k; goal.title = make(); } };
  const bar = (f) => { const w = `${(f * 100).toFixed(1)}%`; if (goal._bw !== w) { goal._bw = w; $('goalBar').style.width = w; } };
  if (wait && G.needGoal) {
    // bölge şartı bekleniyor (sart.js): kart sıradaki işi yazar, çubuk o işin ilerlemesi
    const q = G.needGoal;
    goal.classList.remove('done');
    if (q.key !== goalDef) { goalDef = q.key; $('goalName').textContent = q.text; goal.querySelector('.gi').textContent = q.icon; goal.querySelector('small').textContent = q.small; }
    bar(q.frac);
    price('n' + q.right, () => q.right);
    goal.classList.toggle('ready', q.ready);
    tipOf('n' + q.small, () => q.small);
  } else if (wait) {
    // sıradaki bölümün seviyesi gelmedi: adı gizli kalır, çubuk XP'yi gösterir
    goal.classList.remove('done', 'ready');
    if (wait !== goalDef) { goalDef = wait; $('goalName').textContent = 'Yeni bölüm'; goal.querySelector('.gi').textContent = '❓'; goal.querySelector('small').textContent = `⭐ Seviye ${wait.lvl} gerekli`; }
    const a = xpFor(G.nextWaitFrom || G.level), b = xpFor(wait.lvl); // hedef seviyeye ne kadar kaldı (seviye atlayınca sıfırlanmaz)
    bar(Math.max(0, Math.min(1, (G.xp - a) / (b - a))));
    price('w' + wait.lvl, () => `⭐ ${wait.lvl}`);
    const xpLeft = Math.max(0, Math.ceil(b - G.xp));
    tipOf(`w${wait.lvl}:${xpLeft}`, () => `Seviye ${wait.lvl} için ${xpLeft.toLocaleString('tr-TR')} XP kaldı`);
  } else if (!pad && G.finalQuest) {
    // son görev (final.js): ana sıra bitti, yan kilitler kaldı; çubuk açılan kilitlerin oranı, ok en yakın açık kilidi gösterir
    const q = G.finalQuest;
    goal.classList.remove('done', 'ready');
    if (goalDef !== 'final') { goalDef = 'final'; $('goalName').textContent = 'Köy Efsanesi'; goal.querySelector('.gi').textContent = '🏆'; goal.querySelector('small').textContent = 'Son görev'; }
    bar((q.total - q.left) / q.total);
    price('f' + q.left, () => `${q.left} kilit`);
    tipOf('f' + q.left, () => `Köy Efsanesi olmak için ${q.left} kilit kaldı`);
  } else if (!pad) goal.classList.add('done');
  else {
    goal.classList.remove('done');
    // ilk adımlar rehberi (rehber.js): kart sıradaki işi yazar, para yetince kilidin adına döner; çubuk ve fiyat kilidinki kalır
    const g = G.guide, key = g ? 'g:' + g.key : G.guideOn ? 'r:' + pad.def.title : pad.def;
    if (key !== goalDef) {
      goalDef = key;
      $('goalName').textContent = g ? g.text : pad.def.title;
      goal.querySelector('.gi').textContent = g ? g.icon : pad.def.icon || '🎯';
      goal.querySelector('small').textContent = g ? 'İlk adımlar' : G.guideOn ? 'Kilidin üstünde dur' : 'Sıradaki hedef';
    }
    const left = Math.max(1, pad.def.price - pad.paid);
    bar(Math.min(1, G.money / left));
    price('p' + Math.ceil(left), () => `${Math.ceil(left).toLocaleString('tr-TR')} ₺`);
    goal.classList.toggle('ready', G.money >= left);
  }
  const b = $('boost');
  if (G.boost > 0) {
    b.classList.add('on');
    const s = Math.ceil(G.boost);
    if (b._s !== s) { b._s = s; $('boostT').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; } // saniyede bir
  } else b.classList.remove('on');
}
