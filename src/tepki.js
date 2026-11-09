// Karakter tepkileri (bitirme planı, 2 Kasım 2026). İki iş yapar:
// 1. Müşteri bedeni: memnun kalınca zıplayıp kollarını kaldırır, kızınca ayak vurup başını sallar, kuyrukta sabrı azalınca
//    kollarını kavuşturup ayağını tıklatır. Yakından geçen oyuncuya arada el sallar. Customer.update her karede animateCharacter'dan
//    sonra G.hooks.react'i çağırır; kuklalar (userData.arms/legs/head/body) o karede bu duruşla ezilir.
// 2. Bank sohbeti: meydan ve parktaki banklarda oturan köylüler birbirine döner, emojiyle konuşur, güler, başını sallar.
//    Balonlarda yalnız emoji var: dil seçiminden bağımsız.
import * as THREE from 'three';
import { G } from './game.js';
import * as M from './models.js';

const PI = Math.PI;
let waveCd = 0; // aynı anda bir kişi el sallasın; ardı ardına sallayan kalabalık yapay duruyor

// kol işaretleri: arms[0] için +z içe, arms[1] için +z dışa (Euler önce z, sonra x uygulanır)
function react(c, dt) {
  if (c.lying || c.riding || c.pose || c.seat) return;
  const u = c.obj.userData;
  if (!u.arms || !u.legs || !u.head) return;
  c.rt = (c.rt || 0) + dt;
  const t = c.rt;
  let hop = 0;
  if (c.joy > 0) { // sevinç: iki kez zıplar, kollar yukarıda
    c.joy -= dt;
    const k = 1 - Math.max(0, c.joy) / 0.9;
    hop = Math.abs(Math.sin(k * PI * 2)) * 0.22;
    for (const [i, a] of u.arms.entries()) { a.rotation.x = -2.75 + Math.sin(t * 18) * 0.12; a.rotation.z = (i ? 1 : -1) * 0.4; }
    u.head.rotation.z = Math.sin(t * 9) * 0.12;
  } else if (c.huff > 0) { // öfke: ayak vurur, yumruklar aşağıda titrer, başını sallar
    c.huff -= dt;
    for (const [i, a] of u.arms.entries()) { a.rotation.x = -0.35 + Math.sin(t * 28 + i) * 0.22; a.rotation.z = (i ? 1 : -1) * 0.28; }
    u.legs[0].rotation.x = -Math.max(0, Math.sin(t * 11)) * 0.45;
    u.head.rotation.y = Math.sin(t * 13) * 0.45;
  } else if (c.wave > 0) { // el sallama: sağ kol havada sağa sola, baş oyuncuya döner
    c.wave -= dt;
    const a = u.arms[1];
    a.rotation.x = -2.9; a.rotation.z = 0.55 + Math.sin(t * 13) * 0.4;
    const p = G.player.position, o = c.obj.position;
    const want = Math.atan2(p.x - o.x, p.z - o.z);
    if (!c.moving) c.face(want, dt * 0.5);
    else u.head.rotation.y = THREE.MathUtils.clamp(((want - c.obj.rotation.y + 3 * PI) % (2 * PI)) - PI, -0.9, 0.9);
  } else if (!c.moving && c.bubble && c.pat != null && c.pat < 0.35) { // sabırsızlık: kollar kavuşur, ayak tıklar, iç çeker
    for (const [i, a] of u.arms.entries()) { a.rotation.x = -1.05; a.rotation.z = (i ? -1 : 1) * 0.72; }
    u.legs[1].rotation.x = -Math.max(0, Math.sin(t * 8)) * 0.22;
    u.head.rotation.z = Math.sin(t * 1.7) * 0.1;
    if (u.body) u.body.scale.y = 1 + Math.max(0, Math.sin(t * 0.9)) * 0.03;
  } else if ((c.waveCdT = (c.waveCdT || 0) - dt) <= 0) {
    // oyuncu yakından geçiyorsa arada bir el sallar (kişi başı en çok 30 sn'de bir, herkes için 5 sn'de bir)
    c.waveCdT = 1;
    const p = G.player.position, o = c.obj.position, d = Math.hypot(p.x - o.x, p.z - o.z);
    if (d < 3.6 && d > 1 && waveCd <= 0 && !(c.waved > G.time - 30) && Math.random() < 0.35) { c.wave = 1.5; c.waved = G.time; waveCd = 5; }
  }
  // zıplama yüksekliği konuma eklenir, bitince geri alınır (yürüyüş y'ye dokunmaz)
  if (hop || c.hop) { c.obj.position.y += hop - (c.hop || 0); c.hop = hop; }
}
G.hooks.react = react;

// ---------- bank sohbeti ----------
const TALK = ['☕', '😂', '🌾', '🐑', '🐄', '🍅', '☀️', '🌧️', '💰', '👍', '🤔', '😄', '🧺', '🍉', '⚽', '🎣', '🐟', '🥖'];
const benches = [];
// bench: makeBench ile aynı yere ve yöne konan iki kişi. look: köylü ya da kasabalı görünüşü
export function sitOnBench(parent, x, z, ry, n = 2, look = M.villagerLook) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; parent.add(g);
  const people = [];
  const xs = n === 1 ? [0.15] : [-0.38, 0.38];
  for (const sx of xs) {
    const o = M.makeCharacter(look());
    const u = o.userData;
    o.position.set(sx, 0.48 - 0.62, 0.02); // kalça oturağın üstünde (bank oturağı 0,46)
    for (const l of u.legs) l.rotation.x = -1.15; // tek parça bacak: öne ve aşağı, ayak yere yakın
    for (const a of u.arms) a.rotation.x = -0.35;
    o.traverse((m) => { m.userData.bkNo = true; }); // birleştirmeye girmez: baş ve kollar oynar (perf.js)
    g.add(o);
    people.push({ o, u, sx, talk: 0, nod: 0, laugh: 0, bubble: null });
  }
  benches.push({ g, people, t: 1 + Math.random() * 3, who: 0 });
  return g;
}

function say(b, p) {
  if (p.bubble) G.labels.remove(p.bubble);
  const el = document.createElement('div');
  el.className = 'bubble txt';
  el.innerHTML = `<b>${TALK[(Math.random() * TALK.length) | 0]}${Math.random() < 0.3 ? TALK[(Math.random() * TALK.length) | 0] : ''}</b>`;
  const v0 = new THREE.Vector3();
  p.bubble = G.labels.add(el, (v) => { p.o.getWorldPosition(v0); v.copy(v0).setY(v0.y + 2.15); });
  p.talk = 1.8;
}

const near = (o, r) => { const p = G.player.position, w = o.position; return Math.abs(p.x - w.x) < r && Math.abs(p.z - w.z) < r; };
export function updateTepki(dt) {
  waveCd -= dt;
  for (const b of benches) {
    if (!b.g.parent || !near(b.g, 26)) { for (const p of b.people) if (p.bubble) { G.labels.remove(p.bubble); p.bubble = null; } continue; }
    const two = b.people.length > 1;
    if ((b.t -= dt) <= 0) { // sıradaki konuşur; ötekisi dinler, arada güler ya da başını sallar
      b.t = 2.6 + Math.random() * 2.8;
      const sp = b.people[b.who % b.people.length]; b.who++;
      say(b, sp);
      const ls = two ? b.people[b.who % b.people.length] : null;
      if (ls) { if (Math.random() < 0.35) { ls.laugh = 1.4; sp.laugh = 1.2; } else ls.nod = 1.2; }
    }
    for (const [i, p] of b.people.entries()) {
      const u = p.u, t = G.time + i * 1.7;
      if (p.talk > 0) { p.talk -= dt; if (p.talk <= 0 && p.bubble) { G.labels.remove(p.bubble); p.bubble = null; } }
      p.nod = Math.max(0, p.nod - dt); p.laugh = Math.max(0, p.laugh - dt);
      // birbirine döner; tek kişi meydana bakar
      const look = (two ? (p.sx < 0 ? 0.75 : -0.75) : Math.sin(t * 0.3) * 0.5) + Math.sin(t * 0.37) * 0.18; // dinleyen de arada bakınır
      if (u.body) u.body.scale.y = 1 + Math.sin(t * 2.1) * 0.02; // nefes
      u.head.rotation.y += (look - u.head.rotation.y) * Math.min(1, dt * 3);
      u.head.rotation.x = p.nod > 0 ? Math.sin(p.nod * 14) * 0.18 : 0;
      if (u.body) u.body.rotation.x = p.laugh > 0 ? -0.12 + Math.sin(p.laugh * 22) * 0.06 : 0;
      // konuşan el kol yapar; ötekisi elleri dizinde
      const g0 = p.talk > 0 ? Math.sin(t * 7) * 0.25 : 0;
      u.arms[0].rotation.x = -0.35 - (p.talk > 0 ? 0.55 + g0 : 0);
      u.arms[1].rotation.x = -0.35 - (p.talk > 0 ? 0.2 - g0 * 0.5 : Math.max(0, Math.sin(t * 0.5)) * 0.25); // dinlerken eli dizinde kıpırdar
      if (p.laugh > 0) u.head.rotation.z = Math.sin(p.laugh * 20) * 0.08; else u.head.rotation.z = 0;
    }
  }
}
