// Zemin titremesi (z-fighting): yol, tarla, bostan, şerit ve bölge zemini gibi düz parçalar birbirinin birkaç mm yakınında
// üst üste durunca derinlik tamponu hangisinin önde olduğuna karar veremez; kamera kayınca yamalar yanıp söner.
// Burada üst üste binen ve yükseklikleri 6 mm'den yakın olan düz parçalar sıralanır (alçaktaki altta, aynı yükseklikte büyük olan
// altta, küçük olan üstte) ve üstteki en az 6 mm yukarı kaldırılır. Gözle fark edilmez, oyun mantığına (engeller) dokunmaz.
// Yeni bölge açılınca eklenen parçalar için birkaç saniyede bir yeniden bakılır.
import * as THREE from 'three';
import { G } from './game.js';

const GAP = 0.006, FLAT = 0.012, TOP = 0.5, MIN_AREA = 0.3;
const box = new THREE.Box3(), va = new THREE.Vector3(), vb = new THREE.Vector3();
let seen = 0, t = 0, found = false;
const list = [], stack = [];

function flatMesh(o) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.zfix !== undefined) return false;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  // saydam şerit de sayılır (derinlik yazmasa da derinlik sınaması yapar): köyde dükkân önündeki yarı saydam şerit, beyaz giriş
  // zeminiyle aynı yükseklikte titriyordu
  if (!m || m.polygonOffset) return false;
  return true;
}
// sahnedeki yeni düz parçaları listeye ekler (found). Tarama kareler arasına yayılır, kaldığı yerden sürer: 21 bin düğümü tek
// karede gezmek (bütün sahnenin matrisleri ve her parçada ebeveyn zinciri) 3 sn'de bir 25-40 ms'lik takılma yapıyordu. Tur bitince true
function collect() {
  if (!stack.length) stack.push(G.scene);
  const t0 = performance.now();
  for (let n = 1; stack.length; n++) {
    if ((n & 63) === 0 && performance.now() - t0 > 1) return false;
    const o = stack.pop();
    if (!o.visible || (o !== G.scene && !o.parent)) continue; // gizli dal (açılmamış bölge) görünür olunca bakılır
    for (let i = 0; i < o.children.length; i++) stack.push(o.children[i]);
    if (!flatMesh(o)) continue;
    o.updateWorldMatrix(true, false);
    box.setFromObject(o);
    o.userData.zfix = null; // bir kez bakılır (düz değilse de)
    if (box.isEmpty() || box.max.y - box.min.y > FLAT || box.max.y > TOP) continue;
    const area = (box.max.x - box.min.x) * (box.max.z - box.min.z);
    if (area < MIN_AREA) continue;
    o.userData.zfix = { y0: (box.max.y + box.min.y) / 2, x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z, area, lift: 0 };
    list.push(o); found = true;
  }
  return true;
}
// alttan üste sıralayıp her parçayı altındaki yakın parçaların en az GAP üstüne koyar (asıl yüksekliklerden yeniden hesaplanır)
function layer() {
  const L = list.filter((o) => o.parent);
  list.length = 0; list.push(...L);
  L.sort((a, b) => a.userData.zfix.y0 - b.userData.zfix.y0 || b.userData.zfix.area - a.userData.zfix.area);
  const ny = new Map();
  let moved = 0;
  for (let i = 0; i < L.length; i++) {
    const a = L[i].userData.zfix;
    let y = a.y0;
    for (let j = 0; j < i; j++) {
      const b = L[j].userData.zfix;
      if (a.y0 - b.y0 >= GAP || b.x1 <= a.x0 || b.x0 >= a.x1 || b.z1 <= a.z0 || b.z0 >= a.z1) continue;
      y = Math.max(y, ny.get(L[j]) + GAP);
    }
    ny.set(L[i], y);
    const lift = y - a.y0, d = lift - a.lift;
    if (Math.abs(d) < 1e-5) continue;
    // dünya yukarısını ebeveynin yerel eksenine çevirip kaydırır (dönük ya da ölçekli gruplarda da doğru)
    const o = L[i];
    if (o.parent) {
      o.getWorldPosition(va); vb.copy(va); vb.y += d;
      o.parent.worldToLocal(va); o.parent.worldToLocal(vb);
      o.position.add(vb.sub(va)); o.updateMatrixWorld();
    }
    a.lift = lift; moved++;
  }
  return moved;
}
export function updateGround(dt) {
  if ((t -= dt) > 0 || !collect()) return; // tur sürüyorsa sonraki karede kaldığı yerden
  t = 3;
  const n = G.scene.children.length;
  if (found || n !== seen) layer();
  found = false; seen = n;
}
// test kancası: kaç düz parça, kaçı kaldırıldı
window.__zfix = () => ({ flat: list.length, lifted: list.filter((o) => o.userData.zfix && o.userData.zfix.lift > 0).length });
// test kancası: kaldırılanları eski yerine indirir / yeniden kaldırır (titreme ölçümünde karşılaştırma için)
window.__zfixSet = (on) => {
  for (const o of list) {
    const z = o.userData.zfix; if (!z || !o.parent) continue;
    const want = on ? z.lift : 0, cur = z.cur ?? z.lift, d = want - cur;
    if (!d) continue;
    o.getWorldPosition(va); vb.copy(va); vb.y += d; o.parent.worldToLocal(va); o.parent.worldToLocal(vb); o.position.add(vb.sub(va)); o.updateMatrixWorld();
    z.cur = want;
  }
};
