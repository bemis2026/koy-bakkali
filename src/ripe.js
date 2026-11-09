// Hazır ürün belirtisi: bostanda olgunlaşan ve tepside biriken ürün uzaktan belli olsun.
// - Bostan (PlantBed): olgun meyve dalında hafifçe zıplar ve nabız gibi büyüyüp küçülür (en küçük hali tam boy; hasat şartı bozulmaz).
// - Rozet: bostanın, üretim tepsisinin (Generator: kümes, ahır, kırkım, kazan, makine çıkışı) üstünde ürün resmi ve hazır sayısı
//   (×3). Hiç yoksa rozet yok; tepsi ya da bostan doluysa rozet sarı "DOLU" olur ve nabız gibi atar.
// Oyuncunun 36 m çevresindekiler gösterilir; oyuncu bostanın ya da tepsinin içindeyken (topluyorken) rozet gizlenir.
import { G, PlantBed, Generator } from './game.js';

const NEAR = 36, CSS = `.ripe { pointer-events: none; }
.ripe .rb { display: flex; align-items: center; gap: 4px; padding: 2px 9px 2px 3px; border-radius: 999px; background: #3fae6b; color: #fff;
  border: 2px solid #fff; box-shadow: 0 3px 0 rgba(0,0,0,.22); font: 15px var(--font-title); white-space: nowrap; }
.ripe img { width: 24px; height: 24px; object-fit: contain; filter: drop-shadow(0 1px 0 rgba(0,0,0,.25)); }
.ripe.full .rb { background: #f6a623; animation: ripePulse 1.1s ease-in-out infinite; }
.ripe.full em { font-style: normal; font-size: 12px; letter-spacing: .06em; margin-left: 2px; }
@keyframes ripePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.14); } }
@media (max-width: 640px) { .ripe .rb { font-size: 12px; padding: 1px 7px 1px 2px; gap: 3px; border-width: 1.5px; } .ripe img { width: 18px; height: 18px; } .ripe.full em { font-size: 10px; } } /* telefonda ekranı kaplamasın */`;
const BADGES = new Map(); // istasyon → { L, el, key }
let ready = false, t = 0;

function badge(s) {
  let b = BADGES.get(s);
  if (b) return b;
  const el = document.createElement('div');
  el.className = 'ripe';
  const z = s.zone, y = s instanceof PlantBed ? 1.9 : 1.5;
  // rozetin içi: animasyon iç elemanda (Labels kökün transform'unu konum için kullanır)
  el.innerHTML = '<span class="rb"></span>';
  const at = (v) => { if (s.tray) { s.tray.getWorldPosition(v); v.y = y; } else v.set(z.x, y, z.z); }; // tepsinin üstü, bostanın ortası
  b = { el, inner: el.firstChild, key: '', L: G.labels.add(el, at) };
  b.L.hidden = true;
  BADGES.set(s, b);
  return b;
}
export function updateRipe(dt) {
  if (!G.player) return;
  if (!ready) { ready = true; const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  // olgun meyveler her karede zıplar
  const tm = G.time;
  for (const s of G.stations) {
    if (!(s instanceof PlantBed)) continue;
    for (const [i, p] of s.plants.entries()) {
      if (!p.fruit || p.fruit.scale.x < 1) continue;
      const w = Math.sin(tm * 3.2 + i * 1.7);
      p.fruit.position.y = 0.04 + Math.max(0, w) * 0.07;
      p.fruit.scale.setScalar(1 + (0.5 + 0.5 * w) * 0.12);
    }
  }
  if ((t -= dt) > 0) return;
  t = 0.25;
  const pp = G.player.position;
  for (const s of G.stations) {
    const bed = s instanceof PlantBed;
    if (!bed && !(s instanceof Generator)) continue;
    const z = s.zone, far = Math.hypot(z.x - pp.x, z.z - pp.z) > NEAR;
    const n = bed ? s.ripeCount() : s.items.length, max = bed ? s.plants.length : s.max;
    if (!BADGES.has(s) && (n < 1 || far)) continue;
    const b = badge(s);
    const show = n >= 1 && !far && !s.inside && !s.hidden;
    b.L.hidden = !show;
    if (!show) continue;
    const full = n >= max, key = `${n}|${full}`;
    if (key === b.key) continue;
    b.key = key;
    b.el.classList.toggle('full', full);
    const img = G.icons[s.type] ? `<img src="${G.icons[s.type]}" alt="">` : '';
    b.inner.innerHTML = `${img}×${n}${full ? '<em>DOLU</em>' : ''}`;
  }
}
