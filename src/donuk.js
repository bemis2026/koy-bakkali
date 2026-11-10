// İskeletli modellerin (karakter.js, hayvan.js) ekran dışındayken dondurulması. Sahnede ~200 karakter ve onlarca hayvan var; her birinin
// 30-40 kemiği her karede matris güncellemesinden (updateMatrixWorld) ve çizim taramasından (projectObject) geçiyordu: telefonda işlemcinin
// en büyük yükü buydu. Üç çizimdir görünmeyen modelin kemik ağacı gizlenir ve güncellenmez (kafaya, ele takılanlar da onunla gizlenir),
// gölgesi kapanır (eski duruşuyla yanlış yere gölge düşmesin). Yeniden göründüğü ilk çizimde kemikler o anki yerine ve duruşuna gelir.
import * as THREE from 'three';
import { settings } from './audio.js';
import { refresh } from './matris.js'; // dondurulan kökün tarama kaydı yenilenir

const live = new Set(), skip = () => {};
let frame = 0, lastR = null, lastF = -1;
function set(s, on) {
  s.frozen = on;
  for (const r of s.roots) { r.visible = !on; if (on) r.updateMatrixWorld = skip; else delete r.updateMatrixWorld; refresh(r); }
  s.meshes.forEach((m, i) => { m.castShadow = !on && s.cast[i]; });
  if (on) live.delete(s); else live.add(s);
}

// roots: kemik ağacının kökleri, meshes: iskeletli parçalar, skels: iskeletler
export function track(roots, meshes, skels) {
  const s = { roots, meshes, skels, cast: meshes.map((m) => m.castShadow), seen: frame, frozen: false, thaw: false, k: 0, px: 0 };
  live.add(s);
  return s;
}

// her çizimden (onBeforeRender) çağrılır. false: aynı çizimde ikinci parça, duruş yeniden hesaplanmaz. Kare, çizicinin kendi sayacından
// (zamandan değil: yavaş telefonda tek çizim 4 ms'yi aşar, karakter aynı karede yeniden donardı). Üç çizimdir görünmeyen donar
export function seen(s, r) {
  const f = r.info.render.frame;
  if (r !== lastR || f !== lastF) { lastR = r; lastF = f; frame++; for (const o of live) if (frame - o.seen > 3) set(o, true); }
  if (s.seen === frame) return false;
  s.seen = frame;
  if (s.frozen) { set(s, false); s.thaw = true; }
  return true;
}

// donmadan yeni çıkan modelin kemikleri bu çizimden önce güncellenir (yoksa ilk karede eski yerinde çizilirdi)
export function thawed(s) {
  if (!s.thaw) return;
  s.thaw = false;
  for (const r of s.roots) r.updateMatrixWorld(true);
  for (const k of s.skels) k.update();
}

// uzaktaki küçük modelin duruşu her karede değil 2-3 karede bir hesaplanır: boyu ekranda 40 pikselden kısaysa (telefonda oyuncu
// varsayılan yakınlıkta ~56 piksel). Performans kalitesinde eşikler biraz yüksek. h: modelin kendi birimindeki boyu
const _sz = new THREE.Vector2();
export const perfMode = () => settings.quality === 'dusuk' || settings.quality === 'pil'; // ayarlardaki Performans ve Pil tasarrufu
export function busy(s, g, h, r, cam) {
  const e = g.matrixWorld.elements, c = cam.matrixWorld.elements;
  const d = Math.hypot(e[12] - c[12], e[13] - c[13], e[14] - c[14]) || 1;
  const px = s.px = (h * Math.hypot(e[4], e[5], e[6]) * cam.projectionMatrix.elements[5] / d) * r.getSize(_sz).y / 2; // ekrandaki boy
  if (s.thaw) return false;
  const k = settings.quality === 'pil' ? 1.35 : settings.quality === 'dusuk' ? 1.15 : 1, every = px < 20 * k ? 3 : px < 40 * k ? 2 : 1;
  if (++s.k < every) return true;
  s.k = 0;
  return false;
}
