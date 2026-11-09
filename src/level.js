// Mertebe (seviye) sistemi: XP satıştan, müşteriden, kilit açmaktan ve başarımlardan gelir. Her seviyenin bir unvanı
// var; belli seviyelerde yeni bölümler ortaya çıkar (world.js UNLOCKS lvl). Seviyesi gelmeyen bölüm dünyada ve
// haritada görünmez; seviye atlanınca kamera yeni bölüme döner, küçük bir para ödülü verilir (world.js levelUp).
import { G } from './game.js';

export const TITLES = ['Çırak', 'Kalfa', 'Usta', 'Esnaf', 'Dükkân Sahibi', 'Tüccar', 'Kervan Ağası', 'Han Beyi', 'Kasaba Eşrafı', 'Bölge Patronu', 'Efsane Esnaf'];
// seviyeye ulaşmak için gereken toplam XP: ilk seviyeler çabuk gelir, sonra aralar açılır
const NEED = [0, 0, 60, 180, 380, 700, 1150, 1750, 2500, 3450, 4600];
export function xpFor(n) {
  if (n < NEED.length) return NEED[n];
  const k = n - NEED.length + 1; // 11. seviyeden sonra her basamak öncekinden 150 XP uzun
  return NEED[NEED.length - 1] + 1400 * k + 75 * k * (k - 1);
}
// seviye ödülü: kilit fiyatları ×2 (PRICE_K) ×1,25 (zorluk) arttığı için ödül de 2,5 kat (eskiden seviye × 100 ₺; 2026-11-01)
export const levelReward = (n) => n * 250;
export const titleOf = (n) => (n <= TITLES.length ? TITLES[n - 1] : `${TITLES[TITLES.length - 1]} ${n - TITLES.length + 1}`);
export function levelOf(xp) { let n = 1; while (xpFor(n + 1) <= xp) n++; return n; }
export function levelProgress() { const a = xpFor(G.level), b = xpFor(G.level + 1); return Math.max(0, Math.min(1, (G.xp - a) / (b - a))); }

let last = null;
// kayıttan: eski kayıtta xp yoksa açık bölümlerin en yükseğine yetecek kadar XP verilir (hiçbir yer kaybolmasın)
export function initLevel(saved, minLevel = 1) {
  G.xp = saved && saved.xp > 0 ? saved.xp : 0;
  if (G.xp < xpFor(minLevel)) G.xp = xpFor(minLevel);
  G.level = levelOf(G.xp);
  last = null;
}
export function addXp(n) {
  if (!(n > 0) || G.level == null) return;
  G.xp += n;
  const lv = levelOf(G.xp);
  if (lv > G.level) { const old = G.level; G.level = lv; if (G.hooks.levelUp) G.hooks.levelUp(lv, old); }
}
// istatistik değişimlerinden XP: kazanılan her 10 ₺ 1 XP, her müşteri 1 XP, her başarım 25 XP (kilit açma world.js'te)
export function updateLevel() {
  const s = G.stats, now = { e: s.earned, c: s.customers, a: G.ach.size };
  if (!last) { last = now; return; }
  const xp = (now.e - last.e) / 10 + (now.c - last.c) + (now.a - last.a) * 25;
  last = now;
  if (xp > 0) addXp(xp);
}
