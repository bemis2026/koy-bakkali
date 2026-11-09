// Uzak istekler: arada bir bir bölgeye, başka bölgenin ürününü isteyen müşteri gelir (sahilde simit, handa yumurta,
// pazarda yoğurt...). Bölgedeki bekleme yerinde durur, baloncuğunda ürün ve 🚚 işareti. Oyuncu ya da servisçi
// (upgrades.js Servisci) ürünü kaynağından getirip müşteriye değer; müşteri iki katını öder. Uzun bekler (90 sn),
// bekletilirse kızıp gider. Kayıt tutulmaz: o an bekleyen istekler G.requests'te.
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, Station, Customer, Generator, Converter, PlantBed, PaidSource, MoneyPile, fly, floatText, sfx, rand, pick } from './game.js';
import { walkable } from './world.js';
import { repMul } from './rating.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PAT = 90, PAY = 2;
// ürünün geldiği bölge: istek o bölgenin dışından gelir
const HOME = { domates: 'koy', salatalik: 'koy', yumurta: 'ciftlik', sut: 'ciftlik', peynir: 'ciftlik', karpuz: 'pazar', biber: 'pazar', patlican: 'pazar',
  misir: 'sahil', dondurma: 'sahil', balik: 'iskele', izgara: 'iskele', ekmek: 'han', corba: 'han', simit: 'firin', pogaca: 'firin', yun: 'mera', ksut: 'mera', yogurt: 'mera', kilim: 'atolye' };
// bölgelerin bekleme yerleri (ilk kullanımda engel ve yürünebilirlik denetlenir)
const SPOTS = {
  koy: [[-11.4, 0.4], [9.4, 1.6]], pazar: [[41.4, 3.4], [31.2, 3.2]], sahil: [[8, 17.4], [37.1, 18.6]], han: [[-3.6, -41.6], [3.6, -35.4]],
  firin: [[-6, -24.4], [4, -24.4], [-12.5, -22.4], [8.5, -22.4], [0, -21.4]], kasaba: [[-40.0, -27.0], [-50.8, -34.4]], tatil: [[78, 15.6], [91, 14.6]], atlar: [[-48, 1.6]], mera: [[-31, 19.4]],
};
const ENTRY = [V(-96.5, 0, -15.1), V(-89, 0, 11.2), V(105, 0, 4.4)]; // harita genişletmesi; ana yolda ve pazar caddesinde kaldırımdan (2026-11-02)
let nextT = 30;
const REQS = (G.requests = []);

const live = (R) => R && R.unlocked && !R.hidden;
function regionOf(x, z) { for (const id in G.regions) { const r = G.regions[id].rect; if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) return G.regions[id]; } return null; }
// bekleme yeri o an boş ve yürünebilir mi (kilitli bölge, sonradan kurulan bina)
const free = ([x, z]) => walkable(x, z) && !G.colliders.some((c) => x > c[0] - 0.7 && x < c[1] + 0.7 && z > c[2] - 0.7 && z < c[3] + 0.7);
// ürün şu an elemanların da alabileceği bir yerden geliyor mu: üreteç, makine, bostan ya da tek ürünlü toptancı
// (upgrades.js srcFor ile aynı kaynaklar; iki ürünlü sebze kamyoneti ve raflar sayılmaz)
// 2: şu an stokta (servisçi hemen getirir), 1: üreticisi var ama stok yok, 0: yok
function obtainable(t) {
  let best = 0;
  for (const s of G.stations) {
    const z = s.zone; if (!z) continue;
    const src = (s instanceof Generator && s.type === t) ? s : (s instanceof Converter && s.out && s.out.type === t) ? s.out
      : (s instanceof PlantBed && s.type === t) || (s instanceof PaidSource && s.types.includes(t)) ? s : null;
    if (!src || !live(regionOf(z.x, z.z))) continue;
    const stock = src instanceof PaidSource ? (src.stock ?? 1) > 0 : src.avail ? src.avail() > 0 : src.items && src.items.length > 0;
    best = Math.max(best, stock ? 2 : 1);
    if (best === 2) return 2;
  }
  return best;
}

// müşterinin yanına gelinince ürün teslim alınır (oyuncu değince ya da servisçi putFrom ile)
class ReqDrop extends Station {
  constructor(q) {
    const p = q.c.obj.position;
    super(p.x, p.z, 1.6, 1.6, {});
    this.q = q;
    this.bodyFn = () => { const o = q.c.obj.position; return [[o.x - 0.4, o.x + 0.4, o.z - 0.4, o.z + 0.4]]; };
  }
  putFrom(stack) {
    const q = this.q;
    if (q.done) return false;
    const it = stack.takeOf([q.type]);
    if (!it) return false;
    fly(it.obj, q.c.obj, V(0, 1.1, 0.35), 0.25, 0.8, (o) => o.parent && o.parent.remove(o));
    sfx('pop', { npc: stack !== G.stack });
    finish(q, true);
    return true;
  }
  update(dt) {
    if (!this.inside || this.q.done) return;
    this.t += dt;
    if (this.t >= 0.2) { this.t = 0; this.putFrom(G.stack); }
  }
}

function nearestPile(p, max = 18) {
  let best = null, bd = max;
  for (const s of G.stations) if (s instanceof MoneyPile) { const d = Math.hypot(s.zone.x - p.x, s.zone.z - p.z); if (d < bd) { bd = d; best = s; } }
  return best;
}
function finish(q, ok) {
  if (q.done) return;
  q.done = true;
  const c = q.c;
  if (q.drop) { q.drop.remove(); q.drop = null; }
  if (ok) {
    const pay = ITEMS[q.type].price * PAY, pile = nearestPile(c.obj.position);
    if (pile) pile.add(pay, c.obj.position); else G.money += pay;
    floatText(c.obj.position, `+${pay} ₺`, 'pos'); sfx('cash', { at: c.obj.position });
    G.stats.sold++;
  }
  c.mood(ok);
  c.leaving = true; c.state = 'leave';
  c.path = [q.entry.clone()];
}

function spawn() {
  const regs = Object.keys(SPOTS).filter((id) => live(G.regions[id]) && SPOTS[id].some(free));
  if (regs.length < 2) return false;
  const rid = pick(regs);
  const cand = Object.keys(HOME).filter((t) => HOME[t] !== rid && live(G.regions[HOME[t]])).map((t) => [t, obtainable(t)]).filter((x) => x[1]);
  const ready = cand.filter((x) => x[1] === 2).map((x) => x[0]);
  const types = ready.length && Math.random() < 0.85 ? ready : cand.map((x) => x[0]); // çoğunlukla stokta olan ürün istenir
  if (!types.length) return false;
  const used = REQS.filter((q) => q.region === rid).map((q) => q.spot);
  const spots = SPOTS[rid].filter((s) => !used.includes(s) && free(s));
  if (!spots.length) return false;
  const spot = pick(spots), type = pick(types), to = V(spot[0], 0, spot[1]);
  const entry = ENTRY.slice().sort((a, b) => a.distanceTo(to) - b.distanceTo(to))[0];
  const c = new Customer(entry.clone(), rid, Math.random() < 0.5 ? M.townLook() : M.villagerLook());
  const q = { c, type, region: rid, spot, entry, drop: null, by: null, done: false };
  c.go(to);
  c.state = 'come';
  c.think = (dt) => {
    switch (c.state) {
      case 'come':
        if (c.walk(dt)) {
          c.state = 'wait'; c.wait = 0;
          c.setBubble(type, 1);
          if (c.bEl) c.bEl.insertAdjacentHTML('beforeend', '<i class="rqb" title="Başka bölgenin ürünü">🚚</i>');
          q.drop = new ReqDrop(q);
        }
        break;
      case 'wait': {
        c.face(Math.atan2(G.player.position.x - c.obj.position.x, G.player.position.z - c.obj.position.z), dt * 0.3);
        c.wait += dt;
        c.setPatience(1 - c.wait / PAT);
        if (q.drop) { q.drop.zone.x = c.obj.position.x; q.drop.zone.z = c.obj.position.z; }
        if (c.wait > PAT) finish(q, false);
        break;
      }
      case 'leave':
        if (c.walk(dt)) { const i = REQS.indexOf(q); if (i >= 0) REQS.splice(i, 1); c.destroy(); }
        break;
    }
  };
  REQS.push(q);
  return true;
}

let styled = false;
export function updateRequests(dt) {
  if (!G.player) return;
  if (!styled) { styled = true; const st = document.createElement('style'); st.textContent = '.bubble .rqb { position: absolute; right: -8px; top: -8px; font-style: normal; font-size: 14px; background: #fff3b0; border: 2px solid #b07a00; border-radius: 50%; width: 22px; height: 22px; display: grid; place-items: center; }'; document.head.appendChild(st); }
  if ((G.level || 1) < 3) return; // yeni oyuncu önce temel döngüyü öğrensin
  nextT -= dt * repMul();
  const max = Object.keys(SPOTS).filter((id) => live(G.regions[id])).length >= 6 ? 3 : 2;
  if (nextT <= 0) { nextT = rand(45, 80); if (REQS.filter((q) => !q.done).length < max) spawn(); }
}
export const HOME_OF = HOME;
G.hooks.request = spawn; // test kancası: hemen bir uzak istek müşterisi getirir
