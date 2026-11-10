// Hayvan yemlikleri (2026-11-05 kullanıcı: "domates'i ... yem olarak tavuklara vermek gereksin ... hem elimizde kalmayı azaltırız hem de
// zorlaştırırız oyunu bazı şeyler otomatik üretilmemiş olur"). Kümesin, ahırın, kırkım barakasının, sağım yerinin ve arı kovanlarının
// üreticisinin yanına bir yemlik konur: yemlik boşken üretim tamamen durur, her ürün bir yem yer (1 yem → 1 ürün). Yemliği oyuncu ve
// elemanlar doldurur (G.xsink → upgrades.js carrierJobs). Yemlikler boş başlar, içindeki yem kayda yazılır (G.stats.yem).
// Hayvan açıldığında yemi henüz yetişmiyorsa üretim kilitlenmesin diye her hayvanın o anda bulunan bir yemi de var: inek koçan ve karpuz
// da yer (saman ve buğday 6-7. seviyede gelir), koyun koçan ve saman da yer (lahana ve balkabağı isteğe bağlı bostanlarda). Arının
// yemliği ancak çiçek ya da ayçiçeği yetişince gelir; o zamana dek kır çiçeklerinden bal yapar
import * as THREE from 'three';
import * as M from './models.js';
import { G, Station, Generator, makeItem, fly, bounce, sfx, floatText, popIn } from './game.js';
import { walkable } from './world.js';

const FEED = {
  yumurta: { feeds: ['domates', 'salatalik', 'kocan'], icon: '🐔' },
  sut: { feeds: ['saman', 'bugday', 'kocan', 'karpuz'], icon: '🐄' },
  yun: { feeds: ['lahana', 'balkabagi', 'kocan', 'saman'], icon: '🐑' },
  ksut: { feeds: ['lahana', 'balkabagi', 'kocan', 'saman'], icon: '🐑' },
  bal: { feeds: ['cicek', 'aycicek'], icon: '🐝', when: () => G.unlocked.has('xtarlalar2') || G.unlocked.has('xkasaba2') },
};
const CAP = 10;
// yemliğin yeri: üreticinin ön alanının yanında (x farkı). Headless taramayla seçildi (yürünebilir, engelsiz); listede olmayan batıda
const SIDE = { 'ksut@-40,19': 2.8, 'ksut@-20,27': 2.8 };
const keyOf = (g) => `${g.type}@${Math.round(g.zone.x)},${Math.round(g.zone.z)}`;
const CSS = 'font:13px var(--font-title);background:rgba(255,255,255,.92);color:#5a3a1a;padding:2px 8px;border-radius:999px;border:2px solid #8a5a33;white-space:nowrap;display:flex;align-items:center;gap:3px';
const img = (t) => `<img src="${G.icons[t]}" alt="" style="height:16px">`;
const wood = () => M.mat('#9a6a3f'), dark = () => M.mat('#6b4426');

// ahşap yemlik: dört ayaklı uzun tekne; arınınki sarı boyalı çiçek sehpası
function makeTrough(bee) {
  const g = new THREE.Group(), w = bee ? M.mat('#e8b93a') : wood(), d = dark();
  for (const x of [-0.92, 0.92]) for (const z of [-0.24, 0.24]) M.rbox(0.08, 0.36, 0.08, 0.02, d, x, 0.18, z, g);
  M.rbox(2.0, 0.06, 0.6, 0.02, w, 0, 0.36, 0, g); // taban
  for (const z of [-0.28, 0.28]) M.rbox(2.0, 0.2, 0.05, 0.02, w, 0, 0.46, z, g); // yan tahtalar
  for (const x of [-0.98, 0.98]) M.rbox(0.05, 0.2, 0.6, 0.02, w, x, 0.46, 0, g); // uç tahtalar
  return g;
}

class Yemlik extends Station {
  constructor(gen, x, z, def, instant) {
    super(x, z, 2.4, 1.3, { dashed: true, instant });
    this.gen = gen; this.key = keyOf(gen); this.feeds = def.feeds; this.cap = gen.feedCap || CAP; this.input = []; this.role = 'take'; // feedCap: büyüyen kümes 20 (world.js twinCoop). 2026-11-10: role satırı yorumun içinde kalmıştı, yemlik rolsüzdü
    this.obj = makeTrough(gen.type === 'bal'); this.obj.position.set(x, 0, z - 1.3); G.scene.add(this.obj); if (!instant) popIn(this.obj);
    this.tray = new THREE.Group(); this.tray.position.set(0, 0.4, 0); this.obj.add(this.tray);
    this.col = [x - 1.05, x + 1.05, z - 1.62, z - 0.98]; G.colliders.push(this.col);
    this.el = document.createElement('div'); this.el.style.cssText = CSS; this.icon = def.icon; this.shown = -1;
    G.labels.add(this.el, (v) => v.set(x, 1.15, z - 1.3));
    // üretim: yemlik boşken durur, her ürün bir yem yer
    gen.canMake = () => this.input.length > 0;
    const prev = gen.onMake;
    gen.onMake = () => { if (prev) prev(); this.eat(); };
    gen._yem = this;
    G.xsink = G.xsink || [];
    for (const t of this.feeds) G.xsink.push({ type: t, conv: this, pri: t === 'karpuz' ? 1 : 3 }); // karpuzu toptancıdan parayla alır: en son
    for (const t of (G.stats.yem && G.stats.yem[this.key]) || []) this.push(t, makeItem(t), true);
  }
  slot(i) { return new THREE.Vector3(-0.76 + (i % 5) * 0.38, Math.floor(i / 10) * 0.2, Math.floor(i / 5) % 2 ? 0.12 : -0.12); }
  roomFor(t) { return this.feeds.includes(t) ? this.cap - this.input.length : 0; }
  hasSpaceFor(t) { return this.roomFor(t) > 0; }
  push(type, obj, now) {
    this.input.push({ type, obj });
    const s = this.slot(this.input.length - 1);
    if (now) { obj.position.copy(s); this.tray.add(obj); } else fly(obj, this.tray, s, 0.18, 0.6, (o) => bounce(o, 0.2));
    this.save();
  }
  putFrom(stack) {
    if (this.input.length >= this.cap) return false;
    const it = stack.takeOf(this.feeds);
    if (!it) return false;
    this.push(it.type, it.obj, false);
    sfx('pop', { npc: stack !== G.stack });
    return true;
  }
  eat() {
    const e = this.input.pop();
    if (e) fly(e.obj, this.gen.origin.clone(), null, 0.3, 0.6, (x) => x.parent && x.parent.remove(x));
    this.save();
    const P = G.player.position; // yalnız oyuncu yakındaysa: sekiz yemlik sık sık boşalır, yazı haritaya yağmasın
    if (!this.input.length && Math.hypot(P.x - this.zone.x, P.z - this.zone.z) < 16) floatText(new THREE.Vector3(this.zone.x, 2.0, this.zone.z - 1.3), `${this.icon} Yem bitti!`, '');
  }
  save() { (G.stats.yem || (G.stats.yem = {}))[this.key] = this.input.map((e) => e.type); }
  label() {
    const n = this.input.length;
    if (n === this.shown) return;
    this.shown = n;
    const empty = !n;
    this.el.style.background = empty ? 'rgba(255,226,220,.95)' : 'rgba(255,255,255,.92)';
    this.el.style.borderColor = empty ? '#c8432f' : '#8a5a33';
    this.el.innerHTML = `${this.icon} <span>${empty ? 'Yem yok' : 'Yemlik'}</span> ${this.feeds.map(img).join('')} <b>${n}/${this.cap}</b>`;
  }
  update(dt) {
    this.label();
    if (!this.inside) return;
    this.t += dt;
    if (this.t >= 0.07 && this.putFrom(G.stack)) this.t = 0;
  }
}

// yeni açılan üreticiler (kümes, ahır, genişletmeler) saniyede bir taranır; ilk taramada (açılış) kurulanlar anında belirir
let scanT = 1, booted = false;
function place(gen) {
  const z = gen.zone, pref = SIDE[keyOf(gen)] ?? -2.8;
  for (const off of [pref, -pref]) {
    const x = z.x + off, Z = [x - 1.2, x + 1.2, z.z - 1.6, z.z + 0.65];
    if (![[Z[0], Z[2]], [Z[1], Z[2]], [Z[0], Z[3]], [Z[1], Z[3]]].every(([a, b]) => walkable(a, b))) continue;
    if (G.colliders.some((c) => c[0] < Z[1] && c[1] > Z[0] && c[2] < Z[3] && c[3] > Z[2])) continue;
    return x;
  }
  return z.x + pref;
}
export function updateYemlik(dt) {
  if ((scanT += dt) < 1) return;
  scanT = 0;
  for (const s of G.stations.slice()) {
    const def = s.type && FEED[s.type];
    if (!def || s._yem || s.canMake || !(s instanceof Generator) || (def.when && !def.when())) continue;
    const x = place(s);
    new Yemlik(s, x, s.zone.z, def, !booted);
    if (booted) floatText(new THREE.Vector3(x, 2.0, s.zone.z - 1.3), `${def.icon} Yem ister!`, 'pos');
  }
  booted = true;
}
