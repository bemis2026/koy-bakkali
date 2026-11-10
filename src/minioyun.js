// Lunapark mini oyunları (2026-11-01, kullanıcı: "oyun çadırlarına girip oynayalım"; seçimler: 3D sahnede kamera yaklaşır,
// ödül para + XP, oyun 100 ₺). Çadırın önündeki pede gelince "Oyna" düğmesi çıkar; basınca ücret ödenir, kamera çadıra yaklaşır
// (main.js G.mini), oyuncu ve ekran göstergeleri gizlenir, ekrana dokununca (fareyle tıklayınca) atış yapılır.
// Atış poligonu: 8 atış, kayan ördeklere dokun. Balon patlat: 6 dart, sallanan balonlara dokun. Halka at: 5 halka, şişelerin
// üstünde gidip gelen halka bir şişenin boynuna gelince dokun. Çekiç gücü: 3 vuruş, güç çubuğu tepedeyken dokun; zil çalarsa büyük
// ödül. Skora göre küçük 200, orta 500, büyük 1.000 ₺ ve XP. Oyun sürerken ziyaretçiler o tezgâha gelmez.
import * as THREE from 'three';
import { G, Station, floatText, sfx, toast } from './game.js';
import { addXp } from './level.js';
import { confetti } from './fx.js';
import { banner } from './ui.js';

const FEE = 100, PRIZE = [0, 200, 500, 1000], XP = [0, 10, 25, 50], TIER = ['', 'Küçük ödül', 'Orta ödül', 'BÜYÜK ÖDÜL'];
const GAMES = {
  atis: { shots: 8, time: 16, rule: 'Kayan ördeklere dokun!', stat: (c) => `Atış ${c.left} · Vurulan ${c.score}`, res: (c) => `${c.score}/8 ördek`, tier: (s) => (s >= 7 ? 3 : s >= 5 ? 2 : s >= 3 ? 1 : 0) },
  balon: { shots: 6, time: 15, rule: 'Sallanan balonlara dokun!', stat: (c) => `Dart ${c.left} · Patlayan ${c.score}`, res: (c) => `${c.score}/6 balon`, tier: (s) => (s >= 6 ? 3 : s >= 4 ? 2 : s >= 2 ? 1 : 0) },
  halka: { shots: 5, time: 24, rule: 'Halka bir şişenin boynuna gelince dokun!', stat: (c) => `Halka ${c.left} · Geçen ${c.score}`, res: (c) => `${c.score}/5 halka`, tier: (s) => (s >= 3 ? 3 : s >= 2 ? 2 : s >= 1 ? 1 : 0) },
  cekic: { shots: 3, time: 18, rule: 'Güç çubuğu en tepedeyken dokun!', stat: (c) => `Vuruş ${c.left} · En iyi %${Math.round(c.score * 100)}`, res: (c) => `%${Math.round(c.score * 100)} güç`, tier: (s) => (s >= 0.95 ? 3 : s >= 0.8 ? 2 : s >= 0.6 ? 1 : 0) },
};
const CSS = `#miniBtn { position: fixed; left: 50%; bottom: 128px; transform: translateX(-50%); z-index: 3; display: none; align-items: center; gap: 10px; padding: 10px 22px; border-radius: 999px;
  border: var(--bw) solid var(--line); background: var(--btn); color: var(--btn-ink); font: 20px var(--font-title); box-shadow: 0 5px 0 var(--btn-dark); cursor: pointer; white-space: nowrap; }
#miniBtn.on { display: flex; animation: miniPulse .9s ease-in-out infinite alternate; }
#miniBtn small { font: 800 13px var(--font-body); opacity: .85; }
@keyframes miniPulse { to { scale: calc(var(--ls, 1) * 1.05); } } /* yan ekranda düğme küçük (index.html --ls): nabız o boydan */
#miniHud { position: fixed; left: 50%; top: 10px; transform: translateX(-50%); z-index: 3; display: none; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 2px 12px;
  width: min(440px, calc(100vw - 20px)); box-sizing: border-box; padding: 8px 10px 8px 16px; border-radius: 18px; background: var(--panel-bg); color: var(--panel-ink);
  border: var(--bw) solid var(--line); box-shadow: 0 4px 0 rgba(0,0,0,.2); }
#miniHud.on { display: grid; }
#miniHud .mt { font: 20px var(--font-title); }
#miniHud .mr { grid-column: 1; font: 800 12px var(--font-body); opacity: .8; }
#miniHud .ms { grid-column: 1; font: 17px var(--font-title); }
#miniHud .mtm { grid-column: 2; grid-row: 1 / 3; justify-self: end; font: 30px var(--font-title); min-width: 46px; text-align: center; }
#miniHud .mx { grid-column: 2; justify-self: end; border: 2px solid var(--line); border-radius: 999px; background: var(--red); color: #fff; font: 800 13px var(--font-body); padding: 4px 12px; cursor: pointer; }
#miniMeter { position: fixed; right: 18px; top: 24%; height: 44vh; width: 34px; z-index: 3; display: none; border: 3px solid #fff; border-radius: 18px; overflow: hidden;
  background: linear-gradient(#e8473c 0 6%, #ff8a3d 6% 20%, #ffd23f 20% 40%, #9ccc3c 40% 65%, #3fae6b 65%); box-shadow: 0 4px 0 rgba(0,0,0,.25); }
#miniMeter.on { display: block; }
#miniMeter i { position: absolute; left: 0; right: 0; height: 8px; margin-top: -4px; background: #2a2d33; border-top: 2px solid #fff; border-bottom: 2px solid #fff; }
@media (max-width: 640px) { #miniBtn { bottom: 194px; font-size: 17px; padding: 8px 16px; gap: 8px; } #miniBtn small { font-size: 12px; } } /* sol alttaki rozetlerin üstünde, öğretici yazının altında */
.minipad { font: 14px var(--font-title); background: rgba(255,255,255,.92); color: #3b2a6b; padding: 2px 10px; border-radius: 999px; border: 2px solid #3b2a6b; white-space: nowrap; }
body.mini-on #hud, body.mini-on #labels { visibility: hidden; }
body.mini-on #hud #toast, body.mini-on #hud #banner { visibility: visible; }`;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = V(0, 0, 0);
let list = [], cur = null, near = null, ui = null, REG = null;

class MiniPad extends Station {
  constructor(m, instant) {
    super(m.pad.x, m.pad.z, 1.4, 1.4, { dashed: true, instant });
    this.m = m;
    const el = document.createElement('div'); el.className = 'minipad'; el.textContent = `${m.icon} Oyna · ${FEE} ₺`;
    G.labels.add(el, (v) => v.set(m.pad.x, 0.7, m.pad.z));
  }
}
const titleOf = (m) => `${m.icon} ${m.name.charAt(0)}${m.name.slice(1).toLocaleLowerCase('tr')}`;

export function setupMinigames(R, minis, instant) {
  R.minis = minis; list = minis; REG = R;
  for (const m of minis) m.padSt = new MiniPad(m, instant);
  if (ui) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'miniBtn'; btn.type = 'button';
  btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (near) start(near); });
  const hud = document.createElement('div'); hud.id = 'miniHud';
  hud.innerHTML = '<b class="mt"></b><span class="mtm"></span><small class="mr"></small><span class="ms"></span><button type="button" class="mx">Çık ✕</button>';
  hud.querySelector('.mx').addEventListener('pointerdown', (e) => { e.stopPropagation(); finish(true); });
  const meter = document.createElement('div'); meter.id = 'miniMeter'; meter.innerHTML = '<i></i>';
  document.body.append(btn, hud, meter);
  ui = { btn, hud, meter, title: hud.querySelector('.mt'), rule: hud.querySelector('.mr'), stat: hud.querySelector('.ms'), time: hud.querySelector('.mtm'), mark: meter.querySelector('i') };
  addEventListener('keydown', (e) => { if (e.code === 'Enter' && near && !cur && !G.menuOpen) start(near); });
}

// kamera: hedeflerin hepsi ekrana sığacak uzaklıkta (dik telefonda daha geriden), çadırın önünden ya da kulenin yanından bakar.
// Üstteki oyun panosu hedefleri örtmesin diye bakış noktası biraz yukarıda (sahne aşağı kayar); kamera uzaklaştıkça yükselir,
// aradaki lamba ve flamaların üstünden bakar
function camFor(m) {
  const t = Math.tan(THREE.MathUtils.degToRad(G.camera.fov) / 2), a = innerWidth / innerHeight;
  const d = Math.max((m.half[1] * 1.2) / t, m.half[0] / (t * a)) + 0.5;
  const look = m.look.clone().setY(m.look.y + m.half[1] * 0.14);
  const cam = look.clone().addScaledVector(m.dir.clone().setY(0).normalize(), d);
  cam.y += 0.15 + Math.max(0, d - 3.5) * 0.42;
  return { cam, look };
}
// ekranda en yakın hedef: dokunuş hedefin görünen boyutunun biraz dışında da sayılır (telefonda küçük, kayan hedefe dokunmak zor)
function nearest(items, centerOf, r, cx, cy) {
  const t = Math.tan(THREE.MathUtils.degToRad(G.camera.fov) / 2), H = innerHeight, W = innerWidth;
  let best = null, bd = Infinity;
  for (const it of items) {
    const p = centerOf(it), v = p.clone().project(G.camera), d = G.camera.position.distanceTo(p);
    const dd = Math.hypot((v.x + 1) / 2 * W - cx, (1 - v.y) / 2 * H - cy), lim = (r / d / t) * (H / 2) * 1.35 + 10;
    if (dd < lim && dd < bd) { bd = dd; best = it; }
  }
  return best && { it: best, point: centerOf(best) };
}
const rowsOf = (necks) => [...new Set(necks.map((n) => n.row))];
// kamerayla hedef arasında kalan küçük süsler (lamba, bank, kulübe...) oyun süresince gizlenir; çadırın kendisi ve büyük zeminler değil
const box = new THREE.Box3(), sph = new THREE.Sphere(), rel = V(0, 0, 0), dirV = V(0, 0, 0);
function occluders(cam, look) {
  const out = [], L = dirV.copy(look).sub(cam).length();
  dirV.normalize();
  for (const o of REG.content.children) {
    if (!o.visible) continue;
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getBoundingSphere(sph);
    if (sph.radius > 6) continue;
    rel.copy(sph.center).sub(cam);
    const t = rel.dot(dirV);
    if (t < 0.3 || t > L - 2.6) continue;
    if (rel.addScaledVector(dirV, -t).length() < sph.radius + 0.35) out.push(o);
  }
  return out;
}

function start(m) {
  if (cur) return;
  if (G.money < FEE) { toast(`💸 Oynamak için ${FEE} ₺ gerekli`); return; }
  G.money -= FEE; sfx('cash');
  G.stats.miniPlays = (G.stats.miniPlays || 0) + 1;
  for (const s of m.spots) s.locked = true; // ziyaretçi bu tezgâha yeni gelmez
  const view = camFor(m);
  const hidden = [...m.hide, ...occluders(view.cam, view.look)].filter((o) => o && o.visible);
  for (const o of hidden) o.visible = false;
  cur = { m, hidden, kind: m.kind, t: 0, left: GAMES[m.kind].shots, score: 0, wait: 0.4, endAt: null, p: 0 };
  const a = m.api;
  if (m.kind === 'halka') {
    a.clear();
    cur.ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.032, 8, 20), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ff9a1f', emissiveIntensity: 0.4 }));
    cur.ring.rotation.x = Math.PI / 2; a.back.add(cur.ring);
    cur.row = rowsOf(a.necks)[0];
  }
  if (m.kind === 'balon') for (const b of a.balloons) { b.t = 0; b.m.scale.set(1, 1.15, 0.8); }
  G.mini = { ...view, tap };
  G.player.visible = false;
  document.body.classList.add('mini-on');
  ui.btn.classList.remove('on');
  ui.title.textContent = titleOf(m); ui.rule.textContent = GAMES[m.kind].rule;
  ui.hud.classList.add('on'); ui.meter.classList.toggle('on', m.kind === 'cekic');
}

function tap(cx, cy) {
  const c = cur;
  if (!c || c.endAt != null || c.left <= 0 || c.wait > 0) return;
  const m = c.m, a = m.api;
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, G.camera);
  c.left--;
  const missAt = () => ray.ray.at(G.camera.position.distanceTo(m.look), tmp).clone();
  if (c.kind === 'atis') {
    const hit = nearest(a.ducks.filter((d) => d.flip <= 0), (d) => d.g.localToWorld(V(0, 0.15, 0)), 0.17, cx, cy);
    if (hit) { hit.it.flip = 0.9; c.score++; floatText(hit.point, '🎯', 'pos'); sfx('pop'); } else floatText(missAt(), 'Iska', 'neg');
    c.wait = 0.22;
  } else if (c.kind === 'balon') {
    const hit = nearest(a.balloons.filter((b) => b.t <= 0), (b) => b.m.getWorldPosition(V(0, 0, 0)), 0.16, cx, cy);
    if (hit) { hit.it.t = 4.2; c.score++; floatText(hit.point, '💥', 'pos'); sfx('pop'); } else floatText(missAt(), 'Iska', 'neg');
    c.wait = 0.28;
  } else if (c.kind === 'halka') {
    // halka şimdi nerede: sıranın en yakın şişe boynuna 8,5 cm'den yakınsa geçer
    const x = c.ring.position.x, row = a.necks.filter((n) => n.row === c.row);
    const n = row.reduce((b, q) => (Math.abs(q.x - x) < Math.abs(b.x - x) ? q : b), row[0]);
    const at = c.ring.getWorldPosition(V(0, 0, 0));
    if (Math.abs(n.x - x) < 0.085) { a.ringAt(n); c.score++; floatText(at, '⭕', 'pos'); sfx('pop'); } else floatText(at, 'Iska', 'neg');
    const rows = rowsOf(a.necks); c.row = rows[(rows.indexOf(c.row) + 1) % rows.length];
    c.wait = 0.5;
  } else if (c.kind === 'cekic') {
    a.hit(c.p); c.score = Math.max(c.score, c.p);
    floatText(m.look.clone().setY(1.2), `%${Math.round(c.p * 100)}`, c.p >= 0.8 ? 'pos' : '');
    c.wait = 1.7;
  }
  if (c.left <= 0) c.endAt = c.kind === 'cekic' ? 1.8 : 0.9; // son atışın sonucu görünsün
}

export function updateMinigames(dt) {
  if (!ui) return;
  if (!cur) {
    near = list.find((m) => m.padSt.inside) || null;
    const show = !!near && !G.menuOpen && !G.cine;
    if (show && ui.btn.dataset.k !== near.kind) { ui.btn.dataset.k = near.kind; ui.btn.innerHTML = `${titleOf(near)} <small>Oyna · ${FEE} ₺</small>`; }
    ui.btn.classList.toggle('on', show);
    return;
  }
  const c = cur, g = GAMES[c.kind], a = c.m.api;
  c.t += dt; c.wait = Math.max(0, c.wait - dt);
  if (c.kind === 'balon') a.balloons.forEach((b, i) => { if (b.t <= 0) b.m.position.set(b.base.x + Math.sin(c.t * 1.9 + i * 1.3) * 0.14, b.base.y + Math.cos(c.t * 1.4 + i) * 0.07, b.base.z); });
  if (c.kind === 'halka') {
    const row = a.necks.filter((n) => n.row === c.row), x0 = Math.min(...row.map((n) => n.x)), x1 = Math.max(...row.map((n) => n.x));
    c.ring.position.set((x0 + x1) / 2 + Math.sin(c.t * (2.0 + c.row * 0.35)) * ((x1 - x0) / 2 + 0.12), row[0].y + 0.05, row[0].z);
  }
  if (c.kind === 'cekic') { c.p = (1 - Math.cos(c.t * 3.4)) / 2; ui.mark.style.top = `${(1 - c.p) * 100}%`; }
  const left = Math.max(0, g.time - c.t);
  const tm = Math.ceil(left), st = g.stat(c); // değişince yazılır (her karede yazım + İngilizcede çeviri)
  if (ui.time._t !== tm) { ui.time._t = tm; ui.time.textContent = tm; }
  if (ui.stat._t !== st) { ui.stat._t = st; ui.stat.textContent = st; }
  if (c.endAt != null) { if ((c.endAt -= dt) <= 0) finish(false); } else if (left <= 0) c.endAt = 0.4;
}

function finish(quit) {
  const c = cur;
  if (!c) return;
  cur = null;
  const m = c.m, g = GAMES[c.kind], tier = quit ? 0 : g.tier(c.score);
  for (const s of m.spots) s.locked = false;
  for (const o of c.hidden) o.visible = true;
  if (c.ring) { c.ring.removeFromParent(); c.ring.geometry.dispose(); }
  if (c.kind === 'balon') for (const b of m.api.balloons) b.m.position.copy(b.base);
  G.mini = null; G.player.visible = true;
  document.body.classList.remove('mini-on');
  ui.hud.classList.remove('on'); ui.meter.classList.remove('on');
  if (quit) return;
  if (tier) {
    const prize = PRIZE[tier];
    G.money += prize; addXp(XP[tier]); // ödül kazanca sayılmaz (günlük görevler gibi)
    G.stats.miniWins = (G.stats.miniWins || 0) + 1;
    banner(`${m.icon} ${TIER[tier]}`, `${g.res(c)} · +${prize.toLocaleString('tr-TR')} ₺`);
    floatText(G.player.position.clone().setY(2.2), `+${prize} ₺`, 'pos');
    confetti(G.player.position.clone().setY(1.6), 12 + tier * 14);
    sfx(tier === 3 ? 'unlock' : 'happy');
  } else { toast(`${m.icon} Bu sefer olmadı (${g.res(c)}). Bir daha dene!`); sfx('bad'); }
}
