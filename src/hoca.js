// Sürpriz: eşeğine ters binen Nasreddin Hoca (2026-11-08 kullanıcı: "oyuna özel easter egg ne eklenebilir" → "Ters binen Hoca").
// Ara sıra (oyun saatiyle 4-8 dakikada bir, sonra 7-13 dakikada bir) açık bölgelerin birinin girişinden başka birine eşeğiyle
// yavaşça geçer; yüzü eşeğin kuyruğuna dönük. Oyuncu yanına gelince eşeği çevirip oyuncuya yüzünü döner, kısa bir fıkra anlatır
// ve bir elmas verir (her geçişte bir kez), sonra yoluna devam eder. Fıkralar sırayla anlatılır (G.stats.hoca: kaç kez tanışıldı).
import * as THREE from 'three';
import * as M from './models.js';
import { G, sfx, toast, popIn, lerpAngle, rand } from './game.js';
import { heightAt, findRoute, regionEntry, walkable } from './world.js';
import { addGems } from './tatil.js';

// [giriş, can alıcı söz]: halk fıkraları, kısaltılmış
const FIKRA = [
  ['Göle maya çalıyorum evlat.', 'Ya tutarsa!'],
  ['Neden eşeğe ters biniyorum?', 'Yolu eşek biliyor, ben de arkamdakilere sırtımı dönmeyeyim!'],
  ['Komşuya "Kazanın doğurdu" dedim, inandı.', '"Kazanın öldü" deyince inanmadı. Doğurduğuna inanan öldüğüne de inanır!'],
  ['Düğüne eski cübbemle gittim, kimse yer vermedi.', 'Kürkle dönünce baş köşeye oturttular. Ye kürküm ye!'],
  ['Dünyanın ortası neresi mi?', 'Eşeğimin bastığı yer! İnanmazsan ölç.'],
  ['Herkes düdük ısmarladı, parayı bir tek çocuk verdi.', 'Ona düdük getirdim: parayı veren düdüğü çalar!'],
  ['Eşeğimi kaybettim, şükrettim.', 'Ya ben de üstünde olsaydım!'],
];
const PLACES = ['koy', 'pazar', 'han', 'tarla', 'firin', 'ciftlik', 'kasaba', 'atlar', 'mera'];
const SPEED = 1.15, MEET = 3.0;

let D = null, H = null, st = 'wait', wait = 0, path = [], bub = null, talkT = 0, met = false, hinted = false, fadeT = 0, fik = 0;
const pv = new THREE.Vector3();

function build() {
  D = M.makeDonkey();
  H = M.makeCharacter({ shirt: '#5f7f3e', pants: '#6b4a2a', hat: 'turban', hatColor: '#ffffff', skin: '#e0b48a', mustache: true });
  const u = H.userData, face = u.face || u.head;
  const beard = M.sph(0.15, M.mat('#f2efe8'), 0, -0.2, 0.2, face, 12, 10); beard.scale.set(1.15, 1.35, 0.75); // ak sakal
  H.updateMatrixWorld(true);
  const hip = u.legs[0].getWorldPosition(new THREE.Vector3());
  const sad = D.userData.saddle.getWorldPosition(new THREE.Vector3()); // eşek sahnede değil: kendi koordinatında
  H.position.set(0, sad.y - hip.y + 0.04, sad.z);
  H.rotation.y = Math.PI; // ters biner: yüzü eşeğin kuyruğuna
  D.add(H);
  // sahnede yokken eşek anırmaz (hayvanses.js sahnedeki hayvanı dinler): geçerken sahneye eklenir, bitince çıkarılır
  const css = document.createElement('style');
  css.textContent = '.bubble.hoca { max-width: calc(250px * var(--s, 1)); white-space: normal; text-align: center; line-height: 1.25; }';
  document.head.appendChild(css);
}

// bacaklar eşeğin iki yanında sarkar, adımla sallanır; konuşurken sağ eliyle anlatır
function pose(dt, walk, talk) {
  const u = H.userData;
  M.animateCharacter(H, 0, dt, false);
  const sw = Math.sin(D.userData.walk || 0) * 0.08 * walk;
  u.legs[0].rotation.set(-0.35 + sw, 0, -0.55); u.legs[1].rotation.set(-0.35 - sw, 0, 0.55);
  u.arms[0].rotation.x = -0.5; u.arms[1].rotation.x = talk ? -1.9 + Math.sin(G.time * 6) * 0.35 : -0.5;
}

function say(text) {
  if (bub) G.labels.remove(bub);
  const el = document.createElement('div'); el.className = 'bubble txt hoca'; el.textContent = text;
  bub = G.labels.add(el, (v) => v.copy(D.position).setY(D.position.y + 3.0));
}
const hush = () => { if (bub) { G.labels.remove(bub); bub = null; } };

// açık bölgelerin girişlerinden oyuncuya 15-45 m uzaktaki biri başlangıç, oyuncunun öbür yanındaki biri varış
function start() {
  const p = G.player.position, pts = PLACES.filter((id) => G.regions[id] && G.regions[id].unlocked).map((id) => regionEntry(id)).filter(Boolean)
    .map((e) => new THREE.Vector3(e[0], 0, e[2]));
  const near = pts.filter((q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); return d > 15 && d < 45; });
  if (!near.length || pts.length < 2) return false;
  const a = near[Math.floor(Math.random() * near.length)];
  const b = pts.filter((q) => q !== a).sort((q, r) => score(r, a, p) - score(q, a, p))[0];
  return go(a, b);
}
const score = (q, a, p) => -((q.x - p.x) * (a.x - p.x) + (q.z - p.z) * (a.z - p.z)) / (1 + Math.hypot(q.x - a.x, q.z - a.z) * 0.02); // a'nın tersi yönde
function go(a, b) {
  if (!walkable(a.x, a.z) || !walkable(b.x, b.z)) return false;
  const r = findRoute(a, b);
  if (!r || !r.length) return false;
  path = r; D.position.set(a.x, heightAt(a.x, a.z), a.z);
  D.rotation.y = Math.atan2(path[0].x - a.x, path[0].z - a.z);
  if (D.parent !== G.scene) G.scene.add(D);
  D.visible = true; popIn(D, 0.1);
  st = 'walk'; met = false; hinted = false;
  return true;
}
function leave() { st = 'fade'; fadeT = 0.6; hush(); }

export function updateHoca(dt) {
  if (!G.player || !G.regions || !G.regions.koy) return;
  if (!D) { build(); wait = 240 + rand(0, 240); }
  const p = G.player.position;
  if (st === 'wait') {
    if (G.time < 60 || G.cine || G.mini) return;
    if ((wait -= dt) > 0) return;
    if (!start()) wait = 30; // uygun yol yok: biraz sonra
    return;
  }
  const dx = p.x - D.position.x, dz = p.z - D.position.z, dist = Math.hypot(dx, dz);
  if (st === 'walk') {
    if (!hinted && dist < 26) { hinted = true; toast('🫏 Biri eşeğine ters binmiş geçiyor… Yanına git!'); }
    if (!met && dist < MEET && !G.onRide) { // eşeği çevirip oyuncuya yüzünü döner (yüzü eşeğin arkasında)
      st = 'talk'; talkT = 0; met = true; fik = (G.stats.hoca || 0) % FIKRA.length; say(FIKRA[fik][0]); sfx('happy');
    } else {
      const q = path[0];
      if (!q) { leave(); return; }
      const ax = q.x - D.position.x, az = q.z - D.position.z, L = Math.hypot(ax, az);
      if (L < 0.3) { path.shift(); if (!path.length) leave(); }
      else {
        const s = Math.min(L, SPEED * dt);
        D.position.x += (ax / L) * s; D.position.z += (az / L) * s;
        D.rotation.y = lerpAngle(D.rotation.y, Math.atan2(ax, az), 1 - Math.exp(-5 * dt));
      }
      D.position.y = heightAt(D.position.x, D.position.z);
      M.animateDonkey(D, 1, dt); pose(dt, 1, false);
    }
    return;
  }
  if (st === 'talk') {
    talkT += dt;
    D.rotation.y = lerpAngle(D.rotation.y, Math.atan2(-dx, -dz), 1 - Math.exp(-4 * dt)); // kuyruk oyuncuya: Hoca yüz yüze
    M.animateDonkey(D, 0, dt); pose(dt, 0, true);
    if (talkT > 3.6 && talkT - dt <= 3.6) say(FIKRA[fik][1]);
    if (talkT > 8.2 && talkT - dt <= 8.2) { G.stats.hoca = (G.stats.hoca || 0) + 1; addGems(1, 'Hoca'); sfx('hire'); say('Haydi eyvallah, bereketli kazançlar!'); }
    if (talkT > 11.5) { hush(); st = 'walk'; }
    return;
  }
  if (st === 'fade') {
    fadeT -= dt; D.scale.setScalar(Math.max(0.01, fadeT / 0.6));
    if (fadeT <= 0) { G.scene.remove(D); D.scale.setScalar(1); st = 'wait'; wait = 420 + rand(0, 360); }
  }
}

// test kancası: __hoca('gel') oyuncunun 8 m önünden geçirir; __hoca() durum
if (typeof window !== 'undefined') window.__hoca = (cmd) => {
  if (cmd === 'gel' && D) { // oyuncunun iki yanında yürünebilir iki nokta
    const p = G.player.position;
    for (const dz of [1.5, -1.5, 3, -3, 5]) for (const k of [1, 0.7, 1.3]) {
      const a = new THREE.Vector3(p.x - 8 * k, 0, p.z + dz), b = new THREE.Vector3(p.x + 12 * k, 0, p.z + dz);
      hush(); if (go(a, b)) return 'yolda';
    }
    return 'yol yok';
  }
  if (cmd === 'basla' && D) { hush(); return start() ? 'yolda' : 'uygun giriş yok'; }
  return JSON.stringify({ st, wait: Math.round(wait), met, path: path.length, pos: D ? [+D.position.x.toFixed(1), +D.position.z.toFixed(1)] : null, n: G.stats.hoca || 0, bub: bub ? bub.el.textContent : '' });
};
