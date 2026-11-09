// Oyun sonu (bitirme planı, 2 Kasım 2026). Bütün kilitler açılınca oyuncu "Köy Efsanesi" olur; oyun bitmez, sürer.
// 1. Son görev: ana sıra bitip yalnız yan kilitler kalınca HUD hedef kartı kalan kilitleri sayar (ui.js), ok en yakın açık pede
//    döner (main.js G.finalPad).
// 2. Sinematik tur: kamera bölgeleri sırayla dolaşır (cinema.js playShots); her bölgede havai fişek atılır, köylüler zıplayıp
//    sevinir. Sonda bütün köy kuşbakışı, gökyüzü fişekle dolar; ardından istatistik kartı ve kredi akışı.
// 3. Sıfırlama yok: efsane olduktan sonra her yeni seviye kalıcı +%2 gelir verir (game.js mult, en çok +%100). Para yeni
//    güncellemelerin bölgelerine birikir.
// Kayıt: G.stats.legend (efsane olunan oyun saniyesi), G.stats.legendLv (o andaki seviye). Başarım: menu.js ACH 'efsane'.
// world.js ile karşılıklı içe aktarma var: buradaki world.js adları yalnız fonksiyon içinde, oyun kurulduktan sonra okunur.
import * as THREE from 'three';
import { G, UnlockPad, floatText, toast, save, legendK, LEGEND } from './game.js';
import { unlockLeft, unlockTotal } from './world.js';
import { playShots } from './cinema.js';
import { play, duckMusic } from './audio.js';
import { BY, CC0, KENNEY } from './krediler.js';
import { shake, haptic } from './his.js';
import { titleOf } from './level.js';

const PI = Math.PI;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tl = (n) => Math.floor(n).toLocaleString('tr-TR');

const BONUS_PER_LV = LEGEND.per, BONUS_MAX = LEGEND.max; // efsane bonusu game.js legendK'de (mult okur)
const pct = () => Math.round((legendK() - 1) * 100);

// ---------- havai fişek ----------
// her fişek tek bir Points. Kıvılcımların hızı geometride durur, konumu gölgelendirici zamandan hesaplar: yükselirken hepsi roketin
// başında parlak bir nokta, patlayınca küre biçiminde saçılır, sürtünme ve yerçekimiyle düşüp söner. Karede yalnız uniform
// değişir (onBeforeRender): three.js geometriyi onBeforeRender'dan önce yüklediği için konumu orada yazmak bir kare geride kalıyordu
// gündüz göğünde okunsun diye doygun renkler, normal karışım (toplamalı karışım açık zeminde soluk kalıyordu), beyaz sıcak çekirdek
const COLS = ['#ff2d55', '#2f80ff', '#a24bff', '#19c37d', '#ff7a00', '#ff3fa4', '#00b8d9', '#ffc400'];
// lag: kuyruk. Her kıvılcımın iki gölgesi biraz geriden gelir (0,05 ve 0,1 sn), küçülüp solar: patlama çizgi çizgi açılır
const VS = `attribute vec3 vel; attribute vec3 tint; attribute float lag; uniform vec3 uOff; uniform float uS, uK, uG, uG2, uSize, uScale; varying vec3 vC; varying float vA;
void main() { float s = max(uS - lag, 0.0), d = (1.0 - exp(-uK * s)) / uK; vec3 p = uOff + vel * d; p.y -= uG * (s / uK - d / uK) + uG2 * s * s;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = uSize * (1.0 - lag * 4.0) * uScale / -mv.z; gl_Position = projectionMatrix * mv; vC = tint; vA = 1.0 - lag * 6.0; }`;
const FS = `uniform float uOp; varying vec3 vC; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.0, 0.32, d); gl_FragColor = vec4(mix(vC, vec3(1.0), core * 0.7), (1.0 - smoothstep(0.6, 1.0, d)) * uOp * vA); }`;
const bufSize = new THREE.Vector2();
// at: patlama noktası. k: ölçek (uzak çekimde kıvılcımlar büyük ve geniş saçılır, ekranda aynı boyda görünür)
export function firework(at, k = 1, col = COLS[(Math.random() * COLS.length) | 0], quiet = false) {
  const N = 80, L = 3, RISE = 0.75 + Math.random() * 0.25, LIFE = 2.0, h = at.y;
  const vel = new Float32Array(N * L * 3), tint = new Float32Array(N * L * 3), lag = new Float32Array(N * L);
  const c1 = new THREE.Color(col), c2 = new THREE.Color(COLS[(Math.random() * COLS.length) | 0]), sp = (7 + Math.random() * 3) * k;
  for (const c of [c1, c2]) c.convertLinearToSRGB(); // gölgelendirici rengi doğrudan ekrana yazar: sRGB değeri; dörtte biri ikinci renk
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * PI * 2, r = Math.sqrt(1 - u * u), s = sp * (0.8 + Math.random() * 0.3), c = i % 4 === 0 ? c2 : c1;
    for (let j = 0; j < L; j++) {
      const q = (i * L + j) * 3;
      vel[q] = r * Math.cos(a) * s; vel[q + 1] = u * s; vel[q + 2] = r * Math.sin(a) * s;
      tint[q] = c.r; tint[q + 1] = c.g; tint[q + 2] = c.b; lag[i * L + j] = j * 0.05;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * L * 3), 3));
  geo.setAttribute('vel', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geo.setAttribute('lag', new THREE.BufferAttribute(lag, 1));
  const U = { uOff: { value: new THREE.Vector3(0, -h, 0) }, uS: { value: -1 }, uK: { value: 1.7 }, uG: { value: 3.2 * k }, uG2: { value: 0.4 * k },
    uSize: { value: 0.6 * k }, uScale: { value: 400 }, uOp: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false });
  const p = new THREE.Points(geo, mat);
  p.position.copy(at);
  p.frustumCulled = false; p.renderOrder = 5; p.userData.sd = true; p.userData.bkNo = true; // boy taraması ve birleştirme dokunmasın (perf.js)
  const t0 = performance.now();
  let boomed = false;
  const kill = () => { if (!p.parent) return; p.parent.remove(p); geo.dispose(); mat.dispose(); };
  p.onBeforeRender = (r) => {
    const t = (performance.now() - t0) / 1000;
    if (t >= RISE + LIFE) { kill(); return; }
    r.getDrawingBufferSize(bufSize); U.uScale.value = bufSize.y * 0.5;
    if (t < RISE) { // roket: yerden hafif yalpalayarak yükselir
      const e = 1 - (1 - t / RISE) ** 2;
      U.uOff.value.set(Math.sin(t * 9) * 0.12 * k, e * h - h, 0); U.uS.value = -1; U.uSize.value = 0.6 * k; U.uOp.value = 1;
    } else {
      if (!boomed) { boomed = true; if (!quiet) play('boom'); }
      const s = t - RISE, u = s / LIFE;
      U.uOff.value.set(0, 0, 0); U.uS.value = s;
      U.uOp.value = (1 - u) ** 1.1 * (u > 0.55 ? 0.7 + 0.3 * Math.sin(s * 40) : 1); // sonda pırıldar
      U.uSize.value = 1.0 * k * (1 - u * 0.45);
    }
  };
  G.scene.add(p);
  if (!quiet) play('launch');
  setTimeout(kill, (RISE + LIFE) * 1000 + 300);
}

// nişan: çekimin ortasındaki kameradan ekranın (nx, ny) noktasına giden ışında, bakılan yere uzaklığın f katı kadar ileride.
// Fişek böylece hep kadrajın üst yarısında patlar; ölçek uzaklığa göre
const aimCam = new THREE.PerspectiveCamera();
function aim([pos, look], nx, ny, f) {
  aimCam.fov = G.camera.fov; aimCam.aspect = G.camera.aspect; aimCam.near = 0.1; aimCam.far = 2000; aimCam.updateProjectionMatrix();
  aimCam.position.copy(pos); aimCam.lookAt(look); aimCam.updateMatrixWorld();
  const dir = V(nx, ny, 0.5).unproject(aimCam).sub(pos).normalize(), d = pos.distanceTo(look) * f;
  const p = pos.clone().addScaledVector(dir, d);
  p.y = Math.max(p.y, 5);
  return [p, Math.max(1, d / 24)];
}
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- sevinç ----------
// dikdörtgendeki müşteriler zıplayıp kollarını kaldırır (tepki.js 'joy'); tur sürdükçe arada bir yinelenir
function cheer(rect, m = 4) {
  const [x0, x1, z0, z1] = rect;
  for (const c of G.customers) {
    const o = c.obj && c.obj.position;
    if (!o || o.x < x0 - m || o.x > x1 + m || o.z < z0 - m || o.z > z1 + m) continue;
    if (!(c.joy > 0) && Math.random() < 0.7) c.joy = 0.9;
  }
}

// ---------- tur ----------
const TOUR = [
  ['koy', '🏪', 'Her şey bu tezgâhta başladı'],
  ['pazar', '🍉', 'Pazarın sesi senin sesin'],
  ['ciftlik', '🐄', 'Yumurta, süt, peynir, bal'],
  ['mera', '🐑', 'Yün, kilim, koyun yoğurdu'],
  ['firin', '🥖', 'Simit ve poğaça kokusu'],
  ['han', '🐫', 'Kervanlar senin ekmeğini yedi'],
  ['sahil', '🏖️', 'Mısır, dondurma, deniz'],
  ['iskele', '🎣', 'Izgara balık, dolu masalar'],
  ['tatil', '🐚', 'Misafirler memnun ayrılıyor'],
  ['lunapark', '🎡', 'Dönme dolap senin eserin'],
  ['sehir', '🏙️', 'Köyün ürünleri şehir rafında'],
];
const SHOT_T = 2.3, OPEN_T = 4.2, SKY_T = 6.2;
let playing = false, pending = 0, cheerT = 0, cheerRect = null, skyTimer = 0;

function rectOf(id) { const R = G.regions[id]; return R && R.unlocked && R.rect ? R.rect : null; }
// köyün bütün açık bölgelerini (şehir hariç: uzakta ayrı alan) kapsayan dikdörtgen
function villageRect() {
  let r = null;
  for (const [id, R] of Object.entries(G.regions)) {
    if (id === 'sehir' || !R.unlocked || !R.rect) continue;
    const [a, b, c, d] = R.rect;
    r = r ? [Math.min(r[0], a), Math.max(r[1], b), Math.min(r[2], c), Math.max(r[3], d)] : [a, b, c, d];
  }
  return r || [-30, 30, -30, 30];
}

export function playFinale() {
  if (playing || !G.player) return false;
  const shots = [], caps = [], beats = [];
  // açılış: köyün üstünde yüksekten yavaş dönüş, başlık kartı
  const VR = villageRect(), vx = (VR[0] + VR[1]) / 2, vz = (VR[2] + VR[3]) / 2, VS = Math.max(VR[1] - VR[0], VR[3] - VR[2]);
  const kr = rectOf('koy') || [-10, 10, -10, 10], kx = (kr[0] + kr[1]) / 2, kz = (kr[2] + kr[3]) / 2;
  shots.push({ T: OPEN_T, at: (u) => {
    const e = ease(u), a = lerp(-0.5, 0.15, e), r = lerp(70, 44, e), h = lerp(52, 30, e);
    return [V(kx + Math.sin(a) * r, h, kz + Math.cos(a) * r), V(lerp(vx, kx, e), 0, lerp(vz, kz, e))];
  } });
  beats.push({ rect: kr, n: 3 });
  // bölgeler: her biri kısa bir süzülüş; yön her bölgede değişir
  let dir = 1;
  for (const [id, icon, line] of TOUR) {
    const rc = rectOf(id);
    if (!rc) continue;
    const [x0, x1, z0, z1] = rc, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, S = Math.max(x1 - x0, z1 - z0), d = dir;
    const a0 = -0.35 * d, a1 = 0.35 * d, R0 = S * 0.62 + 12, R1 = S * 0.5 + 9, H0 = S * 0.42 + 11, H1 = S * 0.34 + 8;
    shots.push({ T: SHOT_T, at: (u) => {
      const e = ease(u), a = lerp(a0, a1, e), r = lerp(R0, R1, e), h = lerp(H0, H1, e);
      return [V(cx + Math.sin(a) * r, h, cz + Math.cos(a) * r), V(cx, 0.5, cz)];
    } });
    caps.push([icon, `${G.regions[id].name}: ${line}`]);
    beats.push({ rect: rc, n: 2 });
    dir = -dir;
  }
  // final: bütün köy kuşbakışı, yavaşça yaklaşır; gökyüzü fişekle dolar
  shots.push({ T: SKY_T, at: (u) => {
    const e = ease(u), r = lerp(VS * 0.95 + 30, VS * 0.75 + 22, e), h = lerp(VS * 0.6 + 30, VS * 0.5 + 22, e);
    return [V(vx, h, vz + r), V(vx, 0, vz - 6)];
  } });
  caps.push(['🎆', 'Bütün köy senin emeğinle kuruldu']);
  beats.push({ rect: VR, sky: true });
  const ok = playShots({
    shots, caps, capStart: OPEN_T, capLen: SHOT_T,
    small: 'TEBRİKLER', icon: '🏆', title: 'Köy Efsanesi', text: 'Bütün kilitleri açtın. Köyün her köşesi senin emeğin.',
    onShot: (k) => onBeat(beats[k], k, shots[k]),
    onEnd: () => { stopSky(); cheerRect = null; playing = false; showCard(); },
  });
  if (!ok) return false;
  playing = true;
  play('region');
  haptic([40, 60, 40, 60, 120], 0);
  return true;
}

function onBeat(b, k, sh) {
  if (!b) return;
  cheerRect = b.rect; cheerT = 0;
  if (b.sky) { startSky(sh); play('finale'); shake(0.18, 0.6); return; }
  if (k > 0 && k % 4 === 0) play('boost');
  // çekimin ortasındaki kadraja göre: soldan sağa sırayla, üst yarıda
  const pose = sh.at(0.55);
  for (let i = 0; i < b.n; i++) {
    const nx = b.n === 1 ? 0 : lerp(-0.55, 0.55, i / (b.n - 1)) + rnd(-0.12, 0.12);
    setTimeout(() => { if (playing) { const [p, sc] = aim(pose, nx, rnd(0.25, 0.55), rnd(0.75, 0.95)); firework(p, sc, undefined, i > 0); } }, 200 + i * 480);
  }
}
// final çekimi: kadrajın dört bir yanında art arda fişek
function startSky(sh) {
  let n = 0;
  stopSky();
  skyTimer = setInterval(() => {
    if (!playing || n++ > 26) { stopSky(); return; }
    const pose = sh.at(Math.min(1, n / 27));
    for (let i = 0; i < 2; i++) { const [p, sc] = aim(pose, rnd(-0.85, 0.85), rnd(0.0, 0.6), rnd(0.55, 0.95)); firework(p, sc, undefined, i > 0 || n % 2 === 1); }
  }, 230);
}
function stopSky() { if (skyTimer) clearInterval(skyTimer); skyTimer = 0; }

// ---------- istatistik kartı ve krediler ----------
const CSS = `#finale .mcard { width: min(520px, calc(100vw - 24px)); text-align: center; }
#finale .fn-ic { font-size: 54px; line-height: 1; margin-top: 2px; }
#finale small.k { display: block; font: 900 12px var(--font-body); letter-spacing: .16em; opacity: .75; margin-top: 4px; }
#finale .fn-sub { margin: 4px 0 10px; font: 700 15px var(--font-body); opacity: .85; }
#finale .fn-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
#finale .fn-grid div { background: rgba(255,255,255,.55); border: 2px solid var(--line); border-radius: 14px; padding: 7px 4px; }
#finale .fn-grid b { display: block; font: 21px var(--font-title); line-height: 1.1; }
#finale .fn-grid span { display: block; font: 800 11px var(--font-body); opacity: .75; }
#finale .fn-note { margin: 10px 0 0; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.4); font: 700 14px/1.4 var(--font-body); text-align: left; }
#finale .fn-row { display: flex; gap: 10px; } #finale .fn-row .go { margin-top: 14px; }
#finale .go.alt { background: var(--gold); color: var(--gold-ink); box-shadow: 0 4px 0 var(--gold-dark); }
@media (max-width: 420px) { #finale .fn-grid { grid-template-columns: repeat(2, 1fr); } #finale .fn-grid b { font-size: 18px; } }
#roll { position: fixed; inset: 0; z-index: 70; background: radial-gradient(ellipse at 50% 120%, #2b1d5c 0%, #0d0a1c 70%); color: #fff; overflow: hidden; cursor: pointer; pointer-events: auto; }
#roll .in { position: absolute; left: 50%; top: 100%; width: min(640px, 88vw); transform: translateX(-50%); text-align: center; font: 600 16px/1.5 var(--font-body); }
#roll h1 { font: 52px var(--font-title); font-weight: normal; margin: 0; color: #ffd23f; text-shadow: 0 4px 0 rgba(0,0,0,.4); }
#roll h2 { font: 24px var(--font-title); font-weight: normal; margin: 46px 0 8px; color: #ffd23f; }
#roll p { margin: 4px 0; opacity: .92; } #roll .who { font: 19px var(--font-title); margin-top: 14px; opacity: 1; } #roll .sm { font-size: 13px; opacity: .7; }
#roll .end { margin-top: 70vh; font: 30px var(--font-title); }
#roll .x { position: absolute; right: 16px; top: 14px; border: 0; border-radius: 999px; padding: 7px 16px; background: rgba(255,255,255,.88); color: #3b2a6b; font: 15px var(--font-title); cursor: pointer; }`;
let card = null, roll = null, styled = false;
function style() { if (styled) return; styled = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} sa ${m} dk` : `${m} dk`; };

function showCard() {
  // efsane bu anda kaydedilir: tur yarıda kapanırsa bir sonraki açılışta yeniden oynar
  if (!G.stats.legend) { G.stats.legend = Math.floor(G.stats.time || 1); G.stats.legendLv = G.level; save(); }
  style();
  if (!card) {
    card = document.createElement('div'); card.id = 'finale'; card.className = 'modal'; card.setAttribute('role', 'dialog');
    card.addEventListener('pointerdown', (e) => e.stopPropagation());
    card.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.k === 'roll') showRoll(); else closeCard(); });
    addEventListener('keydown', (e) => {
      if (!card.classList.contains('open') || roll) return;
      e.stopImmediatePropagation();
      if (['Enter', 'Space', 'Escape', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); closeCard(); }
    }, true);
    document.body.appendChild(card);
  }
  const s = G.stats, regions = Object.values(G.regions).filter((R) => R.unlocked).length, staff = G.workers ? G.workers.length : 0;
  const tile = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  card.innerHTML = `<div class="mcard"><div class="fn-ic">🏆</div><small class="k">TEBRİKLER</small><b class="mtitle">Köy Efsanesi</b>
    <p class="fn-sub">${esc(G.custom.name)} · ⭐ Seviye ${G.level} · ${esc(titleOf(G.level))}</p>
    <div class="fn-grid">${tile(fmtTime(s.time), 'oynama süresi')}${tile(`${tl(s.earned)} ₺`, 'toplam kazanç')}${tile(tl(s.customers), 'müşteri')}
      ${tile(tl(s.sold), 'satılan ürün')}${tile(`${G.unlocked.size}`, 'açılan kilit')}${tile(regions, 'bölge')}
      ${tile(staff, 'eleman')}${tile(tl(s.caravans || 0), 'memnun kervan')}${tile(G.ach.size, 'başarım')}</div>
    <p class="fn-note">🎉 Hikâye burada bitmiyor: dükkânın açık, köy yaşamaya devam ediyor.<br>⭐ Bundan sonra her yeni seviye <b>kalıcı +%${Math.round(BONUS_PER_LV * 100)} gelir</b> verir (en çok +%${BONUS_MAX * 100}).<br>💰 Paranı biriktir: yeni bölgeler güncellemelerle gelecek.</p>
    <div class="fn-row"><button type="button" class="go alt" data-k="roll">🎬 Krediler</button><button type="button" class="go" data-k="go">Oynamaya devam</button></div></div>`;
  card.classList.add('open');
  G.menuOpen = true; G.paused = true;
  duckMusic(true);
  play('open');
}
function closeCard() {
  if (!card || !card.classList.contains('open')) return;
  card.classList.remove('open');
  G.menuOpen = false; G.paused = false;
  duckMusic(false);
  play('close');
  setTimeout(() => toast(`🏆 Köy Efsanesi oldun! Her yeni seviye kalıcı +%${Math.round(BONUS_PER_LV * 100)} gelir`), 400);
}

// kredi akışı: yukarı kayan yazılar; tıklama, Esc ya da sonuna gelmek kapatır
export function showRoll() {
  style();
  if (roll) return;
  roll = document.createElement('div'); roll.id = 'roll';
  const models = BY.map(([who, list]) => `<p class="who">${esc(who)}</p><p class="sm">${list.map(([t]) => esc(t)).join(' · ')}</p>`).join('');
  roll.innerHTML = `<button type="button" class="x">Kapat ✕</button><div class="in">
    <h1>Köy Bakkalı</h1><p>Oynadığın için teşekkürler!</p>
    <h2>Senin dükkânın</h2><p class="who">${esc(G.custom.name)}</p><p>${fmtTime(G.stats.time)} emek · ${tl(G.stats.customers)} mutlu müşteri</p>
    <h2>Modeller (CC BY 3.0, poly.pizza)</h2>${models}
    <h2>Kamu malı modeller (CC0)</h2><p>${CC0.map(([w, n]) => `${esc(w)} (${n})`).join(' · ')}</p><p>Kenney: ${KENNEY.model.map(esc).join(', ')}</p>
    <h2>Sesler</h2><p>Kenney: ${KENNEY.ses.map(esc).join(', ')} (CC0)</p><p>At kişnemesi: Lemasson ve ark. 2015, PLOS ONE (CC BY 4.0, kısaltıldı)</p><p>Hayvan ve doğa sesleri: Wikimedia Commons; alys, Heismark, Oona Räisänen (kamu malı), Gasybeaugosse2020 (CC0), Diana Tudor, Gravity Sound (CC BY 4.0), Dengis Chantal (CC BY 3.0), Amada44, Jonathon Jongsma (CC BY-SA 3.0), MichaeltheFox8621, Armartinell (CC BY-SA 4.0); kesildi</p><p>Araç sesleri ve akordeon: Wikimedia Commons; Kevin MacLeod, "Duet Musette" (CC BY 3.0), Work With Sounds: Technical Museum of Slovenia, Museum of Municipal Engineering, Werstas (CC BY 4.0), stephan, Dsw4 (kamu malı), Soundscape_Leuphana, bsumusictech, marcolo91 (CC0); kesildi</p><p>Yağmur ve gök gürültüsü: Wikimedia Commons; ezwa (kamu malı), Sage Ross (CC BY-SA 3.0), Amuzujoe, Jud McCranie (CC BY-SA 4.0); kesildi</p><p>Müzik ve küçük sesler kodla üretildi</p>
    <h2>Yazı tipleri</h2><p>Google Fonts (OFL)</p>
    <h2>Motor</h2><p>three.js (MIT)</p>
    <p class="end">Köy seni bekliyor 🌾</p></div>`;
  document.body.appendChild(roll);
  const inner = roll.querySelector('.in'), H = inner.offsetHeight + innerHeight, dur = Math.max(28, H / 55);
  const anim = inner.animate([{ transform: 'translate(-50%, 0)' }, { transform: `translate(-50%, ${-H}px)` }], { duration: dur * 1000, easing: 'linear', fill: 'forwards' });
  const close = () => { if (!roll) return; anim.cancel(); roll.remove(); roll = null; removeEventListener('keydown', key, true); };
  const key = (e) => { e.stopImmediatePropagation(); if (['Escape', 'Enter', 'Space'].includes(e.code)) { e.preventDefault(); close(); } };
  anim.onfinish = close;
  roll.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); close(); });
  addEventListener('keydown', key, true);
}

// ---------- her kare ----------
let checkT = 0;
export function updateFinal(dt) {
  if (playing) {
    if (cheerRect && (cheerT -= dt) <= 0) { cheerT = 1.1; cheer(cheerRect); }
    return;
  }
  if ((checkT -= dt) > 0 || !G.player || G.level == null) return;
  checkT = 1;
  const left = unlockLeft();
  // son görev: ana sıra bitince ok en yakın açık yan kilide döner; HUD kartı kalan sayıyı gösterir (ui.js)
  if (left.length && !G.nextPad && !G.nextWait) {
    const ids = new Set(left.map((u) => u.id)), p = G.player.position;
    let best = null, bd = 1e9;
    for (const s of G.stations) {
      if (!(s instanceof UnlockPad) || !s.def || !ids.has(s.def.id) || !s.zone) continue;
      const d = Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
      if (d < bd) { bd = d; best = s; }
    }
    G.finalPad = best;
    G.finalQuest = { left: left.length, total: unlockTotal() };
  } else { G.finalPad = null; G.finalQuest = null; }
  // bütün kilitler açık: kutlama bitip pencereler kapanınca tur başlar (eski kayıtta açılıştan birkaç saniye sonra)
  if (left.length || G.stats.legend) { pending = 0; return; }
  if (G.cine || G.menuOpen || G.paused || G.mini || G.time < 8) { pending = 0; return; }
  if ((pending += 1) >= 2) { pending = 0; playFinale(); }
}

// efsane olduktan sonra seviye atlayınca: kalıcı gelir bonusu (world.js levelUp çağırır)
export function legendLevel(lv) {
  if (!G.stats.legendLv || lv <= G.stats.legendLv) return;
  setTimeout(() => floatText(G.player.position, `🏆 Efsane bonusu: kalıcı +%${pct()} gelir`, 'pos'), 1300);
}
