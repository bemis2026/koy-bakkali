// Meyve bahçesi (2026-11-11 kullanıcı: "Adamın zıplamasının bir mantığı olmalı. Meyve ağaçları yapabiliriz ve adam meyveleri zıplayarak
// toplayıp satabilir ileri aşamalarda"). Çiftlik koridorunda, arı kovanlarıyla karpuz tarlası arasında altı ağaç: üç elma, iki portakal,
// bir limon. Meyveler dalda, elin yetmediği yükseklikte: oyuncu ağacın dibinde zıplayınca (yetenek.js J, Zıplama yeteneği) her
// zıplayışta en yakın ağaçtan üç olgun meyve kopar. Elemanlar ve köy kamyonu toplamaz (kaynak olarak kaydolmaz: merdiven yok).
// Toplama tarlalarının kademeleri buraya da işler (tarla.js WalkField: Damla Sulama yeniden yetişmeyi kısaltır, Arı Kovanları her
// meyveyi iki yapar). Meyve Semt Pazarı'nda (oyuncu getirince tezgâhı açılır) ve şehrin meyve reyonunda satılır. Tanım expand-east.js'ten yüklenir.
import * as THREE from 'three';
import * as M from './models.js';
import { G, makeItem, rand, sfx, floatText } from './game.js';
import { WalkField } from './tarla.js';
import { J, hasJump } from './yetenek.js';
import { defineExpansion } from './expand.js';
import './city.js'; // elma, portakal, limon ITEMS'e city.js'te eklenir

export const BAHCE = [16.8, 23.0, -43.6, -35.2]; // ağaçların alanı; arsa biraz daha geniş (karpuz tarlası z −44'te başlar, kovanlar z −34,3'te)
// [x, z, meyve]: iki sütun, üç sıra; aralarından yürünür
export const TREES = [[18.2, -42.3, 'elma'], [21.6, -42.3, 'portakal'], [18.2, -39.4, 'limon'], [21.6, -39.4, 'elma'], [18.2, -36.5, 'portakal'], [21.6, -36.5, 'elma']];
const CY = 2.25, CR = 1.12, CH = 0.92; // taç: merkez yüksekliği, yatay ve dikey yarıçap
const PER_JUMP = 3, REACH_T = 1.8, LOW = 0.3; // bir zıplayışta en çok üç meyve; gövdeden 1,8 m'ye kadar; ayak yerden 0,3 m kalkınca el dala yeter
const HAM = new THREE.Color('#86b84f');
const RIPE = { elma: new THREE.Color('#d62f3a'), portakal: new THREE.Color('#f28a1e'), limon: new THREE.Color('#f2d43a') };
const LEAF = ['#4f9a3f', '#5aa846', '#3f8a35'];

export class MeyveField extends WalkField {
  constructor(C) {
    const pl = [];
    TREES.forEach(([x, z, type], ti) => {
      for (let i = 0; i < 9; i++) { // tacın alt yarısında, yüzeyinde: 1,8-2,4 m
        const a = i * 2.39996 + ti * 0.7, y = 1.8 + (i % 3) * 0.28 + rand(-0.05, 0.05);
        const r = CR * Math.sqrt(Math.max(0.1, 1 - ((y - CY) / CH) ** 2)) + 0.06;
        pl.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, h: y, tree: ti, type, s: rand(0.9, 1.1), sp: rand(0.8, 1.25), r: Math.random() < 0.75 ? 1 : rand(0.1, 0.9) });
      }
    });
    super(C, BAHCE, 'elma', pl, 60);
    this.got = 0; this.pt = 0; this.tip = 2;
    const n = TREES.length, o3 = this.o3, col = this.col;
    const trunk = this.inst(new THREE.CylinderGeometry(0.11, 0.17, 1.8, 7).translate(0, 0.9, 0), M.mat('#7a5a3a'), n);
    const crown = this.inst(new THREE.IcosahedronGeometry(1, 1), M.mat('#ffffff', { flat: true }), n * 2);
    TREES.forEach(([x, z], i) => {
      o3.rotation.set(0, rand(0, 6.3), 0);
      o3.position.set(x, 0, z); o3.scale.setScalar(1); o3.updateMatrix(); trunk.setMatrixAt(i, o3.matrix);
      o3.position.set(x, CY, z); o3.scale.set(CR, CH, CR); o3.updateMatrix(); crown.setMatrixAt(2 * i, o3.matrix); crown.setColorAt(2 * i, col.set(LEAF[i % 3]));
      o3.position.set(x + 0.3, CY + 0.72, z - 0.2); o3.scale.set(0.72, 0.62, 0.72); o3.updateMatrix(); crown.setMatrixAt(2 * i + 1, o3.matrix); crown.setColorAt(2 * i + 1, col.set(LEAF[(i + 1) % 3]));
    });
    this.fr = this.inst(new THREE.SphereGeometry(0.12, 10, 7), M.mat('#ffffff'), pl.length);
    this.fr.castShadow = false;
    // damla sulama: her sütunun yanında hortum, ağaç diplerinde ıslak toprak; arı kovanları bahçenin hemen güneyinde zaten var
    this.hoses = [18.2, 21.6].map((x) => [x + 0.55, BAHCE[2] + 0.4, x + 0.55, BAHCE[3] - 0.3]);
    this.wets = TREES.map(([x, z]) => [x, z, 0.85]);
    this.hives = []; this.beeN = 8;
    this.tier();
  }
  draw() {
    const { o3, col } = this, big = this.big;
    o3.rotation.set(0, 0, 0);
    this.pl.forEach((p, i) => {
      const k = (p.r >= 1 ? big : 0.35 + 0.5 * p.r) * p.s, lim = p.type === 'limon';
      o3.position.set(p.x, p.h, p.z); o3.scale.set(k, k * (lim ? 0.85 : 1), k * (lim ? 1.25 : 1)); o3.updateMatrix();
      this.fr.setMatrixAt(i, o3.matrix); this.fr.setColorAt(i, col.copy(HAM).lerp(RIPE[p.type], p.r >= 1 ? 1 : p.r * 0.5));
    });
    this.fr.instanceMatrix.needsUpdate = true; this.fr.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
  // gövdesi yakın ağaçların olgun meyveleri arasında oyuncuya en yakını
  ripeAt(at) {
    let best = null, bd = 1e9;
    for (const p of this.pl) {
      if (p.r < 1) continue;
      const t = TREES[p.tree];
      if (Math.hypot(t[0] - at.x, t[1] - at.z) > REACH_T) continue;
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d < bd) { best = p; bd = d; }
    }
    return best;
  }
  pick(stack, at) {
    const p = this.ripeAt(at);
    if (!p) return false;
    const it = makeItem(p.type); it.position.set(p.x, p.h, p.z); G.scene.add(it);
    stack.push(p.type, it); sfx('pop');
    if (--p.left <= 0) { p.r = 0; p.left = 0; }
    this.dirty = true;
    return true;
  }
  update(dt) {
    if ((this.gt += dt) >= 0.25) {
      const k = this.gt; this.gt = 0;
      for (const p of this.pl) if (p.r < 1) { p.r = Math.min(1, p.r + (k * p.sp) / this.gtime); if (p.r >= 1) p.left = this.big > 1 ? 2 : 1; this.dirty = true; }
    }
    const P = G.player && G.player.position;
    if (this.inside && P && G.stack) {
      const air = J.y > LOW;
      if (J.y <= 0.001 && J.v === 0) this.got = 0; // yere indi: yeni zıplayış
      if (air && this.got < PER_JUMP && !G.stack.full && (this.pt -= dt) <= 0 && this.pick(G.stack, P)) { this.got++; this.pt = 0.05; }
      // dalın altında olgun meyve varken yerde duran oyuncuya ipucu (seyrek)
      if (!air && (this.tip -= dt) <= 0) {
        this.tip = 1;
        if (this.ripeAt(P)) { this.tip = 9; floatText(P, hasJump() ? '🦘 Zıpla, meyveyi kopar!' : '🦘 Meyveler yüksekte: Zıplama gerekir (Yükselt → Bakkal (sen))', ''); }
      }
    }
    if (this.bees) this.buzz();
    if (this.dirty) this.draw();
  }
}

defineExpansion({ id: 'xciftlik4', region: 'ciftlik', tier: 4, lvl: 14, icon: '🍎', title: 'Meyve Bahçesi', price: 8000, rect: [16.6, 23.2, -43.8, -35.0], at: [19.9, -39.4], tex: 'grass',
  info: { text: 'Yeni bahçe: meyve ağaçları!', steps: [['elma', 'Meyveler dalda, elin yetmez: ağacın dibinde zıpla (🦘 Zıplama yeteneği), her zıplayışta üç meyve koparırsın.'], ['🧺', 'Elma, portakal ve limon Semt Pazarı tezgâhında ve şehrin meyve reyonunda satılır.']] },
  build: (c) => {
    const f = new MeyveField(c.group);
    for (const [x, z] of TREES) c.col(x - 0.22, x + 0.22, z - 0.22, z + 0.22);
    for (const t of ['elma', 'portakal', 'limon']) { c.sell(t, 'pazar'); c.sell(t, 'sehir'); }
    c.hint(BAHCE[0] + 1.4, 3.6, BAHCE[3] + 0.4, c.icon('elma'), 'Meyve bahçesi', 'Ağacın dibinde zıpla: daldaki olgun meyveler sırtına gelir. Elemanlar toplayamaz, merdiven yok!');
    G.meyve = f;
  } });

// test kancası: olgun meyve sayısı ve son zıplayışta koparılan
if (typeof window !== 'undefined') window.__meyve = () => (G.meyve ? { olgun: G.meyve.avail(), got: G.meyve.got, inside: G.meyve.inside } : null);
