// Raf ve tezgah etiketi: ne satıldığı uzaktan belli olsun diye ön yüzde ürün resimleri ve adıyla şerit
// (duvar raflarının reklam şeridiyle aynı üslup). items bir dizi ya da dizi döndüren fonksiyon: fonksiyonsa
// yeni ürün açıldıkça etiket kendini yeniden çizer (pazar tezgahı)
import * as THREE from 'three';
import { G } from './game.js';

const IMGS = {};
// ürün simgesi (main.js makeIcons); simgeler henüz yoksa ya da yükleniyorsa biraz sonra yeniden çizilir
function icon(k, again) {
  const im = IMGS[k];
  if (im) return im.complete && im.naturalWidth ? im : (im.addEventListener('load', again, { once: true }), null);
  if (!G.icons[k]) { setTimeout(again, 500); return null; }
  const n = new Image(); n.addEventListener('load', again, { once: true }); n.src = G.icons[k]; IMGS[k] = n;
  return null;
}

export function makeTag(title, items, color, w = 2.8, h = 0.44) {
  // doku genişliği etiket boyuyla orantılı: dar raf etiketleri (60'tan fazla) yarı belleğe sığar, yazı yüksekliği aynı kalır
  const W = Math.round(Math.min(768, (768 * w) / 2.8)), H = Math.round((W * h) / w);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  const list = () => (typeof items === 'function' ? items() : items);
  let shown = '';
  const paint = () => {
    const l = list(); shown = l.join();
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(0, 0, W, H, 20); g.fill();
    g.fillStyle = color; g.beginPath(); g.roundRect(7, 7, W - 14, H - 14, 15); g.fill();
    // sağda ürün resimleri yan yana (çok ürün varsa üst üste biner), solda raf adı
    const s = H - 10, room = W * 0.58, step = l.length > 1 ? Math.min(s * 0.92, (room - s) / (l.length - 1)) : 0, x0 = W - 12 - s - step * (l.length - 1);
    l.forEach((k, i) => { const im = icon(k, paint); if (im) g.drawImage(im, x0 + i * step, 5, s, s); });
    g.fillStyle = '#ffffff'; g.textAlign = 'left';
    g.font = `${Math.round(H * 0.5)}px 'Lilita One','Baloo 2',sans-serif`;
    g.fillText(title, 26, H * 0.68, x0 - 40);
    tex.needsUpdate = true;
  };
  paint();
  if (document.fonts) document.fonts.ready.then(paint); // başlık yazı tipi geç yüklenirse
  if (typeof items === 'function') mesh.userData.timer = setInterval(() => { if (list().join() !== shown) paint(); }, 1500);
  return mesh;
}
