// Açılış sinematiği: yeni bölge açılınca 8-10 saniyelik tanıtım. Ekran sinema şeritlerine bürünür, oyun durmaz (hayvanlar, müşteriler
// yaşamaya devam eder), yalnızca oyuncu kıpırdamaz. Çekimler:
//   1. Kuşbakışı açılış: kamera bölgenin üstünde yarım tur dönerek alçalır; ortada bölgenin adı ve kısa tanıtımı belirir.
//   2. Alçak geçiş: göz hizasına yakın, bölgenin bir ucundan öbürüne kayar (nesneler önden geçer, derinlik hissi).
//   3. Görevler: kamera sırayla topla → işle → sat noktalarına gider; her birinin üstünde numaralı etiket çıkar, altta
//      tanıtım kartının adımları altyazı olarak akar.
//   4. Dönüş: kamera süzülerek oyuncunun arkasına iner, ardından tanıtım kartı açılır (intro.js).
// Yeni bölüm (genişletme, o.mini): kısa sürüm, 5-6 sn. Arsanın üstünde yarım daire çizip alçalır, en çok iki iş noktasına bakar.
// Yalnız "Geç" düğmesi, Enter ya da Esc sinematiği geçer (ekrana dokunmak ve Boşluk/zıplama geçmez: yürümek için dokunan oyuncu
// turu yarıda kesiyordu, 2026-11-08). main.js updateCamera her karede cineCamera'yı çağırır.
import * as THREE from 'three';
import { G, ITEMS, Generator, PlantBed, Converter, Shelf, MoneyPile, PaidSource, Lounger } from './game.js';
import { play } from './audio.js';
import { introInfo } from './intro.js';

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const A_T = 3.0, B_T = 2.6, TASK_T = 1.35, PUSH_T = 2.2, IN_T = 0.8, OUT_T = 1.1, MINI_T = 2.2;
let C = null, ui = null;

export const cineActive = () => !!C;

const icon = (k) => (ITEMS[k] && G.icons[k] ? `<img src="${G.icons[k]}" alt="">` : k);
// bölgedeki iş noktaları: önce kaynak (topla), sonra makine (işle), sonra satış yeri (sat), en son para; her türden en
// merkeze yakını, en çok üç tane
function pickTasks(rect) {
  const [x0, x1, z0, z1] = rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const outs = new Set(G.stations.filter((s) => s instanceof Converter).map((s) => s.out)); // makinenin çıkış tepsisi kaynak sayılmaz
  const inside = G.stations.filter((s) => s.zone && !outs.has(s) && s.zone.x > x0 - 1 && s.zone.x < x1 + 1 && s.zone.z > z0 - 1 && s.zone.z < z1 + 1);
  const near = (list) => list.sort((a, b) => Math.hypot(a.zone.x - cx, a.zone.z - cz) - Math.hypot(b.zone.x - cx, b.zone.z - cz))[0];
  const kinds = [
    [(s) => s instanceof PlantBed, (s) => ['Hasat et', icon(s.type)]],
    [(s) => s instanceof Generator, (s) => ['Topla', icon(s.type)]],
    [(s) => s instanceof PaidSource, (s) => ['Satın al', (s.types || []).slice(0, 2).map(icon).join('')]],
    [(s) => s instanceof Converter, (s) => ['İşle', `${icon(s.inType)}<i>→</i>${icon(s.out && s.out.type)}`]],
    [(s) => s instanceof Shelf, (s) => ['Diz ve sat', (s.acc() || []).slice(0, 2).map(icon).join('')]],
    [(s) => s instanceof Lounger, () => ['Siparişi götür', '⛱️']],
    [(s) => s instanceof MoneyPile, () => ['Parayı topla', '💰']],
  ];
  const out = [];
  for (const [is, label] of kinds) {
    if (out.length >= 3) break;
    const s = near(inside.filter(is));
    if (s) out.push({ s, label: label(s) });
  }
  // kaynak ve makine ikisi birden bulunduysa satış yeri de olsun diye en fazla bir kaynak
  return out.filter((t, i) => !(i > 0 && (t.s instanceof Generator || t.s instanceof PlantBed) && (out[0].s instanceof Generator || out[0].s instanceof PlantBed))).slice(0, 3);
}

const CSS = `#cine { position: fixed; inset: 0; z-index: 60; pointer-events: auto; cursor: pointer; }
#cine .lb { position: absolute; left: 0; right: 0; height: 11vh; background: #0b0b10; transition: transform .7s cubic-bezier(.2,.8,.2,1); }
#cine .lb.top { top: 0; transform: translateY(-100%); } #cine .lb.bot { bottom: 0; transform: translateY(100%); }
#cine.on .lb { transform: none; }
#cine .ct { position: absolute; left: 50%; top: 22vh; transform: translate(-50%, 10px) scale(.92); opacity: 0; text-align: center; color: #fff;
  transition: opacity .6s, transform .9s cubic-bezier(.2,.8,.2,1); text-shadow: 0 3px 0 rgba(0,0,0,.35), 0 0 24px rgba(0,0,0,.45); pointer-events: none; }
#cine .ct.show { opacity: 1; transform: translate(-50%, 0) scale(1); }
#cine .ct small { display: block; font: 15px var(--font-title); letter-spacing: .32em; opacity: .9; }
#cine .ct b { display: block; font: clamp(34px, 6.4vw, 74px) var(--font-title); font-weight: normal; line-height: 1.05; margin: 4px 0; }
#cine .ct span { display: block; font-size: clamp(34px, 5vw, 56px); }
#cine .ct p { margin: 6px auto 0; max-width: min(620px, 86vw); font: 17px var(--font-title); opacity: .95; }
#cine .cap { position: absolute; left: 50%; bottom: calc(11vh + 18px); transform: translate(-50%, 8px); opacity: 0; display: flex; align-items: center; gap: 10px;
  max-width: min(760px, 92vw); padding: 8px 18px 8px 10px; border-radius: 16px; background: rgba(14,14,22,.62); color: #fff; font: 17px var(--font-title);
  transition: opacity .35s, transform .35s; pointer-events: none; }
#cine .cap.show { opacity: 1; transform: translate(-50%, 0); }
#cine .cap .ci { flex: none; width: 40px; height: 40px; display: grid; place-items: center; font-size: 26px; }
#cine .cap .ci img { width: 40px; height: 40px; object-fit: contain; }
#cine .skip { position: absolute; right: 18px; bottom: calc(11vh + 14px); border: 0; border-radius: 999px; padding: 7px 16px; background: rgba(255,255,255,.88);
  color: #3b2a6b; font: 15px var(--font-title); cursor: pointer; opacity: .85; }
#cine .bar { position: absolute; left: 0; bottom: 0; height: 4px; background: #ffd23f; width: 0; }
body.cine #hud, body.cine #banner { opacity: 0 !important; transition: opacity .4s; pointer-events: none !important; }
body.cine #labels { visibility: hidden; }
.cine-tag { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 6px; padding: 5px 12px 5px 5px; border-radius: 999px; background: #fffaf0; color: #3b2a6b;
  border: 3px solid #ffd23f; box-shadow: 0 4px 0 rgba(0,0,0,.25); font: 18px var(--font-title); white-space: nowrap; pointer-events: none; }
.cine-tag .n { width: 30px; height: 30px; border-radius: 50%; background: #ffd23f; display: grid; place-items: center; font-size: 18px; color: #3b2a6b; }
.cine-tag img { width: 30px; height: 30px; object-fit: contain; } .cine-tag i { font-style: normal; margin: 0 2px; }
.cine-tag > b { display: flex; align-items: center; gap: 6px; font-weight: normal; animation: cineTag .45s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes cineTag { from { opacity: 0; transform: translateY(14px) scale(.6); } to { opacity: 1; transform: none; } }
@media (max-width: 640px) { #cine .ct p { font-size: 14px; } #cine .cap { font-size: 14px; } .cine-tag { font-size: 14px; } }`;

function buildUI() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  ui = document.createElement('div'); ui.id = 'cine';
  ui.innerHTML = '<i class="lb top"></i><i class="lb bot"></i><div class="ct"><small>YENİ BÖLGE</small><span></span><b></b><p></p></div><div class="cap"><span class="ci"></span><span class="ctx"></span></div><button type="button" class="skip">Geç ⏭</button><i class="bar"></i>';
  // dokunuş oyuna geçmez (oyuncu zaten kıpırdamaz); yalnız Geç düğmesine dokunmak sinematiği geçer
  ui.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (e.target.closest && e.target.closest('.skip')) skip(); });
  addEventListener('keydown', (e) => {
    if (!C) return;
    e.stopImmediatePropagation();
    if (['Enter', 'Escape', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); skip(); }
  }, true);
}
function skip() { if (C && C.t < C.T - OUT_T) C.t = C.T - OUT_T; }

// o: { rect, title, icon, id, region, onEnd, mini }
export function playCinema(o) {
  if (C || !G.player) return false;
  if (!ui) buildUI();
  const [x0, x1, z0, z1] = o.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0, S = Math.max(W, D);
  const info = introInfo(o.id) || {};
  const tasks = pickTasks(o.rect).slice(0, o.mini ? 2 : 3);
  const shots = [];
  if (o.mini) { // yeni bölüm: arsanın güneyinden yarım daire çizerek alçalır
    shots.push({ T: MINI_T, at: (u) => {
      const e = ease(u), a = lerp(-0.6, 0.35, e), r = lerp(S * 0.9 + 16, S * 0.6 + 8, e), h = lerp(S * 0.6 + 15, S * 0.4 + 7.5, e);
      return [V(cx + Math.sin(a) * r, h, cz + Math.cos(a) * r), V(cx, 0, cz)];
    } });
  } else {
  // 1. kuşbakışı: güneybatıdan güneydoğuya yarım tur, alçalarak
  shots.push({ T: A_T, at: (u) => {
    const e = ease(u), a = lerp(-0.8, 0.3, e), r = lerp(S * 1.05 + 24, S * 0.72 + 12, e), h = lerp(S * 0.75 + 28, S * 0.42 + 13, e);
    return [V(cx + Math.sin(a) * r, h, cz + Math.cos(a) * r), V(cx, 0, cz)];
  } });
  // 2. alçak geçiş: güney kenarı boyunca batıdan doğuya, göz hizasının biraz üstünde
  shots.push({ T: B_T, at: (u) => {
    const e = ease(u), dz = D * 0.5 + 6;
    return [V(lerp(x0 + W * 0.05, x1 - W * 0.05, e), lerp(6.2, 5.0, e), cz + lerp(dz + 1.5, dz, e)), V(lerp(x0 + W * 0.3, x1 - W * 0.3, e), 1.0, cz)];
  } });
  }
  // 3. görevler ya da (iş noktası yoksa) bölgenin ortasına yavaşça yaklaşma
  let prev = shots[shots.length - 1].at(1);
  if (tasks.length) {
    for (const [i, t] of tasks.entries()) {
      const p = t.s.zone, from = prev, to = [V(p.x - 1.4, 7.6, p.z + 6.6), V(p.x, 0.9, p.z)]; // şemsiye ve tentelerin üstünden bakar
      shots.push({ T: TASK_T, task: i, at: (u) => { const e = ease(Math.min(1, u / 0.5)); return [from[0].clone().lerp(to[0], e), from[1].clone().lerp(to[1], e)]; } });
      prev = to;
    }
  } else {
    const from = prev, to = [V(cx, S * 0.35 + 9, cz + S * 0.45 + 7), V(cx, 0, cz)];
    shots.push({ T: o.mini ? 1.6 : PUSH_T, at: (u) => { const e = ease(u); return [from[0].clone().lerp(to[0], e), from[1].clone().lerp(to[1], e)]; } });
  }
  // altyazılar: tanıtım metni ve kartın ilk adımları, geçiş ve görev çekimlerine yayılır
  const caps = [];
  if (info.text) caps.push(['✨', info.text]);
  for (const s of (info.steps || []).slice(0, Math.max(2, tasks.length))) caps.push([icon(s[0]), s[1]]);
  if (o.mini) caps.length = Math.min(caps.length, 2); // kısa çekimde iki altyazı
  const capStart = shots[0].T, capLen = Math.max(1.6, (shots.slice(1).reduce((n, s) => n + s.T, 0)) / Math.max(1, caps.length));
  const T = shots.reduce((n, s) => n + s.T, 0) + OUT_T;
  C = { t: 0, T, shots, tasks, caps, capStart, capLen, cap: -1, tags: [], titleOn: false, onEnd: o.onEnd, last: shots[shots.length - 1].at(1), titleT: shots[0].T };
  // başlık kartı
  ui.querySelector('.ct small').textContent = o.mini ? `YENİ BÖLÜM${o.region ? ` · ${o.region.toLocaleUpperCase('tr')}` : ''}` : o.region && o.region !== o.title ? o.region.toLocaleUpperCase('tr') : 'YENİ BÖLGE';
  ui.querySelector('.ct span').textContent = o.icon || '✨';
  ui.querySelector('.ct b').textContent = o.title;
  ui.querySelector('.ct p').textContent = '';
  document.body.appendChild(ui);
  void ui.offsetWidth; ui.classList.add('on');
  document.body.classList.add('cine');
  G.cine = true;
  play('whoosh');
  return true;
}

// hazır çekim listesiyle sinematik (final.js oyun sonu turu). o: { shots: [{ T, at(u) → [konum, bakış] }], caps: [[ikon, yazı]],
// capStart, capLen, small, icon, title, text, onShot(k), onEnd }. Şeritler, başlık kartı, altyazı, geçme ve dönüş playCinema ile aynı
export function playShots(o) {
  if (C || !G.player || !o.shots.length) return false;
  if (!ui) buildUI();
  const T = o.shots.reduce((n, s) => n + s.T, 0) + OUT_T;
  C = { t: 0, T, shots: o.shots, tasks: [], caps: o.caps || [], capStart: o.capStart ?? o.shots[0].T, capLen: o.capLen || 2, cap: -1, tags: [], titleOn: false,
    onEnd: o.onEnd, onShot: o.onShot, k: -1, last: o.shots[o.shots.length - 1].at(1), titleT: o.shots[0].T };
  ui.querySelector('.ct small').textContent = o.small || '';
  ui.querySelector('.ct span').textContent = o.icon || '✨';
  ui.querySelector('.ct b').textContent = o.title || '';
  ui.querySelector('.ct p').textContent = o.text || '';
  document.body.appendChild(ui);
  void ui.offsetWidth; ui.classList.add('on');
  document.body.classList.add('cine');
  G.cine = true;
  return true;
}

function setCap(i) {
  const el = ui.querySelector('.cap');
  if (i < 0 || i >= C.caps.length) { el.classList.remove('show'); return; }
  el.classList.remove('show');
  setTimeout(() => {
    if (!C) return;
    el.querySelector('.ci').innerHTML = C.caps[i][0]; el.querySelector('.ctx').textContent = C.caps[i][1];
    el.classList.add('show');
  }, 160);
}
function end() {
  const done = C.onEnd;
  for (const tg of C.tags) if (tg) tg.el.remove();
  C = null;
  ui.classList.remove('on');
  ui.querySelector('.ct').classList.remove('show'); ui.querySelector('.cap').classList.remove('show');
  setTimeout(() => { if (!C && ui.parentNode) ui.remove(); }, 700);
  document.body.classList.remove('cine');
  G.cine = false;
  if (done) setTimeout(done, 250);
}

// oyun kamerasının bu karedeki yerini (camera.position) ve baktığı noktayı (target) alır, çekimle harmanlar
export function cineCamera(camera, target, dt, scene) {
  if (!C) return false;
  C.t += Math.min(dt, 0.1);
  const t = C.t;
  if (t >= C.T) { end(); return false; }
  // hangi çekim
  let k = 0, s0 = 0;
  while (k < C.shots.length - 1 && t > s0 + C.shots[k].T) { s0 += C.shots[k].T; k++; }
  const sh = C.shots[k], u = Math.min(1, (t - s0) / sh.T), [pos, look] = t >= C.T - OUT_T ? C.last : sh.at(u);
  if (k !== C.k) { C.k = k; if (C.onShot) C.onShot(k); }
  // başlık kartı ilk çekimde, görev etiketleri kamera varınca
  const ct = ui.querySelector('.ct');
  if (!C.titleOn && t > 0.35) { C.titleOn = true; ct.classList.add('show'); }
  if (C.titleOn && t > C.titleT - 0.35 && ct.classList.contains('show')) ct.classList.remove('show');
  if (sh.task !== undefined && u > 0.4 && !C.tags[sh.task]) {
    const ts = C.tasks[sh.task], z = ts.s.zone, el = document.createElement('div');
    el.className = 'cine-tag';
    el.innerHTML = `<b><span class="n">${sh.task + 1}</span>${ts.label[1]}<span>${ts.label[0]}</span></b>`;
    ui.insertBefore(el, ui.querySelector('.cap'));
    C.tags[sh.task] = { el, at: V(z.x, 1.3, z.z) };
    play('tick');
  }
  const ci = t < C.capStart ? -1 : Math.min(C.caps.length - 1, Math.floor((t - C.capStart) / C.capLen));
  if (ci !== C.cap && t < C.T - OUT_T) { C.cap = ci; setCap(ci); }
  if (t >= C.T - OUT_T && C.cap !== -2) { C.cap = -2; setCap(-1); ui.classList.remove('on'); }
  ui.querySelector('.bar').style.width = `${(t / C.T) * 100}%`;
  // oyun kamerasından çekime girer (havalanma), sonda oyuncuya süzülerek döner
  const w = t < IN_T ? ease(t / IN_T) : t > C.T - OUT_T ? 1 - ease((t - (C.T - OUT_T)) / OUT_T) : 1;
  camera.position.lerp(pos, w);
  const tg = target.clone().lerp(look, w);
  camera.lookAt(tg);
  camera.updateMatrixWorld();
  camera.layers.enable(1); camera.layers.enable(2); // yakın çekimde minik parçalar da görünsün
  // görev etiketleri bu karenin kamerasıyla izdüşürülür (oyun etiketleri sinematikte gizli)
  for (const tg2 of C.tags) {
    if (!tg2) continue;
    const q = tg2.at.clone().project(camera), on = q.z < 1 && Math.abs(q.x) < 1.2 && Math.abs(q.y) < 1.2;
    tg2.el.style.display = on ? '' : 'none';
    if (on) tg2.el.style.transform = `translate(${((q.x + 1) / 2) * innerWidth}px, ${((1 - q.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
  }
  const dist = camera.position.distanceTo(tg), fx = Math.max(0, dist - 24), ff = 240 + fx * 1.6;
  if (scene.fog && scene.fog.far < ff) { scene.fog.near = 80 + fx * 0.9; scene.fog.far = ff; camera.far = Math.max(camera.far, ff + 40); camera.updateProjectionMatrix(); }
  return true;
}
