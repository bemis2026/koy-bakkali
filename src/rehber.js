// İlk adımlar rehberi: yeni oyunda ilk iki kilit açılana kadar yer oku ve hedef kartı sıradaki işi gösterir
// (topla → rafa diz → kasada sat → parayı topla → kilidi aç). Döngüyü yazıyla anlatmaz, yürüterek öğretir.
// G.guide = { zone, icon, text, key } ya da null (para yetiyor: ok kilide döner). main.js oku, ui.js hedef kartını buna göre çizer.
import { G, ITEMS, PlantBed, Generator, Shelf, MoneyPile, Register } from './game.js';

const ICON = { domates: '🍅', salatalik: '🥒', yumurta: '🥚', sut: '🥛', peynir: '🧀', karpuz: '🍉', biber: '🫑', patlican: '🍆', misir: '🌽' };
const TXT = {
  topla: (t) => `${ITEMS[t].name} topla`,
  diz: (t) => `${ITEMS[t].name} rafa diz`,
  kasa: 'Kasaya geç, satışı yap',
  para: 'Parayı topla',
  yetis: (t) => `${ITEMS[t].name} yetişiyor…`,
  bekle: 'Müşteri geliyor…',
};
const NEAR = 45; // yalnız oyuncunun çevresindeki istasyonlar
let on = null, t = 0;

const dist = (s, p) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
const at = (s, icon, text, key) => ({ zone: s.zone, icon, text, key });

function pick() {
  const p = G.player.position, pad = G.nextPad;
  const need = pad ? Math.max(1, pad.def.price - pad.paid) : Infinity;
  if (G.money >= need) return null;
  let piles = 0, pile = null, reg = null;
  const shelves = [], src = [], grow = [];
  for (const s of G.stations) {
    if (!s.zone || dist(s, p) > NEAR) continue;
    if (s instanceof MoneyPile) { if (s.amount > 0) { piles += s.amount; if (!pile || s.amount > pile.amount) pile = s; } }
    else if (s instanceof Register) { if (s.queue.length && (!reg || dist(s, p) < dist(reg, p))) reg = s; }
    else if (s instanceof Shelf) shelves.push(s);
    else if ((s instanceof PlantBed && s.ripeCount() > 0) || (s instanceof Generator && s.items.length > 0)) src.push(s);
    else if (s instanceof PlantBed || s instanceof Generator) grow.push(s);
  }
  // sırayla: bekleyen müşteri, kilide yetecek ya da birikmiş para, elindekini rafa dizmek, rafın istediğini toplamak
  if (reg) return at(reg, '🧾', TXT.kasa, 'kasa');
  if (pile && (G.money + piles >= need || piles >= 20)) return at(pile, '💰', TXT.para, 'para');
  const near = (a) => a.sort((x, y) => dist(x, p) - dist(y, p))[0];
  for (const it of G.stack.items) {
    const sh = near(shelves.filter((s) => s.hasSpaceFor(it.type)));
    if (sh) return at(sh, ICON[it.type] || '🧺', TXT.diz(it.type), 'diz:' + it.type);
  }
  if (!G.stack.full) {
    src.sort((x, y) => dist(x, p) - dist(y, p));
    for (const s of src) if (shelves.some((sh) => sh.hasSpaceFor(s.type))) return at(s, ICON[s.type] || '🧺', TXT.topla(s.type), 'topla:' + s.type);
  }
  if (pile) return at(pile, '💰', TXT.para, 'para');
  // raf boşken ürün daha olmamış: oyuncu bostanın başında beklesin
  if (!G.stack.items.length) { const s = near(grow.filter((s) => shelves.some((sh) => sh.hasSpaceFor(s.type)))); if (s) return at(s, '🌱', TXT.yetis(s.type), 'yetis:' + s.type); }
  return { zone: null, icon: '⏳', text: TXT.bekle, key: 'bekle' };
}

export function updateRehber(dt) {
  if (on === false || !G.player || !G.stats) return;
  if (on === null) {
    on = !G.stats.rehber && G.unlocked.size === 0 && (G.stats.time || 0) < 300;
    if (!on) return;
  }
  if (G.unlocked.size >= 2) { on = false; G.guide = null; G.guideOn = false; G.stats.rehber = 1; return; }
  G.guideOn = true;
  t -= dt; if (t > 0) return; t = 0.25;
  G.guide = pick();
}
