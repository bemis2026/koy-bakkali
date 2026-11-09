// Makinelerin başındaki çalışanlar (2026-11-01, kullanıcı: "sahilde mısırların başında pişiren mısırcı, dondurmada dondurmacı
// olmalı; tezgâh ve raflar otomatik olamaz, genel evrende kontrol et"). Üretim yapan her makinenin (Converter) çıktı tepsisinin
// arkasında, müşteriye (tepsinin önündeki alana) bakan bir çalışan durur; görünüşü ürüne göre (mısırcı, dondurmacı, fırıncı, aşçı...).
// Kendi görevlisi olanlar atlanır: dokuma tezgâhlarındaki kadınlar, lunaparkın tezgâhları. Makine sahneye gelince (bölüm açılınca)
// kendiliğinden eklenir; bölge gizliyken çalışan da gizlidir (makinenin grubunda durur).
import * as THREE from 'three';
import * as M from './models.js';
import { G, Converter } from './game.js';

const W = '#ffffff', P = '#3a4a6b';
const chef = { shirt: W, pants: P, hat: 'cap', hatColor: W };
const LOOK = {
  misir: { shirt: '#ffd23f', pants: P, hat: 'cap', hatColor: '#e8473c', mustache: true }, // mısırcı
  dondurma: { shirt: '#ff9fd0', pants: W, hat: 'cap', hatColor: W }, // dondurmacı
  peynir: chef, yogurt: chef, ekmek: chef, simit: chef, pogaca: chef, pide: chef,
  corba: chef, guvec: chef, balikcorba: chef, izgara: chef, pure: chef, menemen: chef, karpuzsuyu: chef,
  un: { shirt: '#c9a46a', pants: '#5a4632', hat: 'cap', hatColor: '#f4ecd8', mustache: true }, // değirmenci
  tursu: { shirt: '#5aa84a', pants: P, hat: 'cap', hatColor: W },
  tost: { shirt: '#ff8a3d', pants: P, hat: 'cap', hatColor: '#3b2a6b' },
  buket: { shirt: '#ff7eb6', pants: W, hat: 'none', fem: true }, // çiçekçi
  saman: { shirt: '#c98b52', pants: '#3a4a6b', hat: 'straw', mustache: true }, // harmancı
  havlu: { shirt: '#2fb5a8', pants: W, hat: 'none', fem: true }, // çamaşırcı
  salata: chef, koz: chef, kabaktatlisi: chef, // köy dükkânının makineleri (koymakine.js)
  cekirdek: { shirt: '#c98b52', pants: P, hat: 'cap', hatColor: '#3d4552', mustache: true }, // çekirdekçi
};
const DEF = { shirt: '#3d7dd8', pants: P, hat: 'cap', hatColor: W };
// işine uygun el kol hareketi (models.js workMotion); listede olmayan ürün tezgâha dizip düzeltir (diz)
const JOB = {
  ekmek: 'yogur', simit: 'yogur', pogaca: 'yogur', pide: 'yogur', kek: 'yogur', peynir: 'yogur',
  corba: 'karistir', guvec: 'karistir', balikcorba: 'karistir', yogurt: 'karistir', salca: 'karistir', recel: 'karistir', pure: 'karistir', menemen: 'karistir', karpuzsuyu: 'kepce',
  izgara: 'cevir', tost: 'cevir', koz: 'cevir', cekirdek: 'cevir', salata: 'karistir', kabaktatlisi: 'karistir', misir: 'cevir', dondurma: 'kepce', un: 'tasi', saman: 'tirmik', havlu: 'katla',
};
const SKIP = new Set(['kilim', 'hali']); // dokuma tezgâhı: başında kendi dokumacıları var (models.js animateLooms)
// makinenin arkasında duranlar: tost makinesi tezgâhın ortasında, iki yanında masalar (expand.js machine). 2026-11-02 kullanıcı:
// "tostçu tost makinasının başında durmuyor": makineyle sağdaki masanın arasında, yana bakar gibi kalıyordu
const BEHIND = new Set(['tost']);
const ops = [];
const tray = new THREE.Vector3(), pos = new THREE.Vector3();
let scanT = 0;

const inRect = (r, p) => p.x >= r[0] && p.x <= r[1] && p.z >= r[2] && p.z <= r[3];
const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };

function scan() {
  for (const s of G.stations) {
    if (!(s instanceof Converter) || s.op) continue;
    s.op = true;
    const out = s.out, parent = out.tray.parent;
    if (SKIP.has(out.type) || !parent) continue;
    out.tray.getWorldPosition(tray);
    const L = G.regions.lunapark;
    if (L && inRect(L.rect, tray)) continue; // lunaparkın tezgâhlarında satıcılar var
    // müşterinin geldiği yön: tepsiden tepsinin önündeki alana; çalışan tepsinin arkasında, makineye doğru biraz kayık
    const dx = out.zone.x - tray.x, dz = out.zone.z - tray.z, d = Math.hypot(dx, dz);
    if (d < 0.1) continue;
    const ux = dx / d, uz = dz / d, o = out.origin;
    pos.set(tray.x + (o.x - tray.x) * 0.35 - ux * 0.85, 0, tray.z + (o.z - tray.z) * 0.35 - uz * 0.85);
    if (BEHIND.has(out.type)) pos.set(o.x - ux * 1.15, 0, o.z - uz * 1.15); // makinenin arkası, müşteriye ve makineye bakar
    const n = M.makeCharacter(LOOK[out.type] || DEF);
    parent.worldToLocal(n.position.copy(pos)); n.position.y = s.opY || 0; // opY: yükseltilmiş zemindeki makine (köy dükkânı 20 cm, koymakine.js)
    n.rotation.y = Math.atan2(ux, uz);
    parent.add(n);
    n.userData.job = JOB[out.type] || 'diz'; n.userData.gen = out;
    ops.push(n);
  }
}

// yalnız oyuncunun yakınındakiler (30 m) canlanır ve işini yapar, her biri saniyede ~12 kez (telefonda 27 iskeletli karakteri her karede
// oynatmak boşa yük: uzaktakiler zaten kıpırtısız görünür)
let tick = 0;
export function updateOperators(dt) {
  if ((scanT -= dt) <= 0) { scanT = 1.5; scan(); }
  const p = G.player && G.player.position;
  tick++;
  ops.forEach((n, i) => {
    n.userData.opDt = (n.userData.opDt || 0) + dt;
    if ((tick + i) % 5 || !n.parent || !shown(n)) return;
    if (p) { n.getWorldPosition(tray); if (Math.abs(tray.x - p.x) > 30 || Math.abs(tray.z - p.z) > 30) { n.userData.opDt = 0; return; } }
    const d = Math.min(n.userData.opDt, 0.25), out = n.userData.gen;
    M.animateCharacter(n, 0, d, false); n.userData.opDt = 0;
    M.workMotion(n, n.userData.job, d, out.items.length < out.max && (!out.canMake || out.canMake())); // makine üretirken hızlı, boşta ağır
  });
}
