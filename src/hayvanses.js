// Gerçek hayvan ve doğa sesleri. 2026-11-05 kullanıcı: "Tıpkı at sesi gibi, oyunda başka gerçek seslerde olsun. Örneğin tavuk sesi,
// horoz sesi, inek sesi, köpek havlaması, kuş sesleri, ağaç hışırtı sesleri ... kedi miyavlaması olabilir. Bunlar arka fonda duyulacak
// şekilde harmonize edilsin ve sesi çıkaran hayvanlara yaklaşınca duyalım."
// Kayıtlar Wikimedia Commons'tan (kamu malı, CC0, CC BY, CC BY-SA; kaynakları assets/sfx/hayvan/License.txt, kredisi menu.js ve
// final.js). Temiz parçaları kesilip ses düzeyleri eşitlendi, her tür tek dosyada toplandı (KoyBakkali-araclar/ses/kes.py); SES.p o
// dosyadaki [başlangıç sn, süre sn] listesi. Dosya o ses ilk gerektiğinde bir kez yüklenir; yüklenene dek kuşlar eski kodla öter.
// Hayvan sesi sahnedeki hayvandan çıkar (models.js VOICED): dibinde net, uzaklaştıkça kısılır ve boğuklaşır (süzgeç kapanır), 60 m
// ötesi susar; uzaktan arka fonda hafif duyulur, yanına gidince belirginleşir. Sağ-sol kameraya göre. Yakında o türden çok hayvan
// varsa daha sık ses gelir. Aynı anda en çok 3 hayvan sesi. Horoz sabah (08.00-09.30) ve yeni sabaha geçişte sık, gün içinde seyrek öter.
// Kuş cıvıltısı (ambience.js birdsong) gerçek kayıttan çalar. Yapraklı ağaçların dibinde yaprak hışırtısı: yakındaki ağaçların sayısı
// ve uzaklığıyla artar, rüzgâr gibi kabarıp söner.
import { G } from './game.js';
import { ambienceBus } from './audio.js';
import { VOICED } from './models.js';
import { day } from './daylight.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const SES = {
  tavuk: { f: 'tavuk.ogg', p: [[0, 1.15], [1.4, 1.35], [3, 1.1], [4.35, 2.05], [6.65, 1.25]] },
  horoz: { f: 'horoz.ogg', p: [[0, 2.75], [3, 1.8]] },
  inek: { f: 'inek.ogg', p: [[0, 1.02], [1.27, 2.95]] },
  kopek: { f: 'kopek.ogg', p: [[0, 2.1], [2.35, 1.05], [3.65, 1.55], [5.45, 0.57], [6.27, 1.8], [8.32, 0.88], [9.45, 0.55]] },
  kedi: { f: 'kedi.ogg', p: [[0, 1.7], [1.95, 1.9], [4.1, 1.3], [5.65, 2.6], [8.5, 1.3], [10.05, 1], [11.3, 1.4]] },
  kus: { f: 'kus.ogg', p: [[0, 1.5], [1.75, 1.7], [3.7, 2.2], [6.15, 1.3], [7.7, 1.8], [9.75, 1.4], [11.4, 1.3], [12.95, 1.1], [14.3, 2.8], [17.35, 3], [20.6, 2.9], [23.75, 4.65], [28.65, 2.75], [31.65, 2.7], [34.6, 3.7]] },
  yaprak: { f: 'yaprak.ogg', p: [[0, 11.1]] },
};
// ses, hayvan türü, dipteki ses, en az / en çok sn aralık. Ölçüm (2026-11-05, ortam ses düzeyi varsayılanken): dipte hayvan ≈ 0,009
// RMS, zemin (rüzgâr, kuş) ≈ 0,004; 30 m'de hayvan ≈ 0,001 (arka fon)
const KIND = [
  ['tavuk', 'tavuk', 0.15, 6, 14],
  ['horoz', 'tavuk', 0.12, 45, 100],
  ['inek', 'inek', 0.12, 14, 30],
  ['kopek', 'kopek', 0.11, 14, 32],
  ['kedi', 'kedi', 0.12, 18, 40],
].map(([s, k, v, a, b]) => ({ S: SES[s], s, k, v, a, b, t: rnd(a, b) * 0.4 }));
const MAXD = 60, REF = 7, MAXLIVE = 3;
const KUS = 1.2; // kuş kaydının çarpanı: arka fonda, zemin düzeyinde (köyde ≈ 0,008 RMS)
const YAPRAK = 0.22, TREE_R = 16;
let A = null, OUT = null, live = 0;

function ready() { const b = ambienceBus(); if (!b) return false; A = b.A; OUT = b.out; return true; }
function load(S) {
  if (S.buf) return true;
  if (!S.loading && !(S.failAt && performance.now() - S.failAt < 60000)) { S.loading = true; fetch('assets/sfx/hayvan/' + S.f).then((r) => r.arrayBuffer()).then((b) => A.decodeAudioData(b)).then((b) => { S.buf = b; }).catch(() => { S.loading = false; S.failAt = performance.now(); }); } // inmeyen dosya bir dakika sonra yeniden denenir (eskiden her çağrıda, saniyede onlarca istek)
  return false;
}
// bir parça çalar; lp alçak geçiren (uzaklık boğukluğu), hp yüksek geçiren (Hz, 0 yok)
function play(S, t, v, pan, lp, hp, animal) {
  if (!load(S)) return false;
  let i = Math.floor(Math.random() * S.p.length); if (S.p.length > 1 && i === S.last) i = (i + 1) % S.p.length; S.last = i;
  const [o, d] = S.p[i], s = A.createBufferSource(); s.buffer = S.buf; s.playbackRate.value = rnd(0.95, 1.05);
  let n = s;
  for (const [type, f] of [['lowpass', lp], ['highpass', hp]]) if (f) { const b = A.createBiquadFilter(); b.type = type; b.frequency.value = f; n.connect(b); n = b; }
  const g = A.createGain(); g.gain.value = v; n.connect(g);
  if (A.createStereoPanner) { const pn = A.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(pn).connect(OUT); } else g.connect(OUT);
  s.start(t, o, d);
  if (animal) { live++; s.onended = () => { live--; }; }
  return true;
}

// ambience.js birdsong: kayıt yüklendiyse gerçek kuş öter (true), yoksa eski kod
export function realBird(t, v, pan) { return ready() && play(SES.kus, t, v * KUS, pan, 0, 0, false); }

// ---------- sahnedeki hayvanlar ----------
function onScene(o) { for (let q = o; q; q = q.parent) if (q === G.scene) return true; return false; }
let pruneT = 0;
function prune(dt) { // sahneden çıkıp 30 sn dönmeyen hayvan listeden düşer (album.js ile aynı)
  if ((pruneT -= dt) > 0) return;
  pruneT = 1;
  for (let i = VOICED.length - 1; i >= 0; i--) { const a = VOICED[i]; if (onScene(a[0])) a[2] = 0; else if (++a[2] > 30) VOICED.splice(i, 1); }
}
function voice(K, p) {
  const e = G.camera.matrixWorld.elements, cand = [];
  let n30 = 0, wsum = 0;
  for (const a of VOICED) {
    if (a[1] !== K.k || a[2]) continue;
    const m = a[0].matrixWorld.elements, dx = m[12] - p.x, dz = m[14] - p.z, d = Math.hypot(dx, dz);
    if (d > MAXD) continue;
    if (d < 30) n30++;
    const w = 1 / (d + 4); wsum += w; cand.push([w, d, dx, dz]);
  }
  if (!cand.length) return -1;
  let r = Math.random() * wsum, c = cand[0];
  for (const x of cand) if ((r -= x[0]) <= 0) { c = x; break; }
  const [, d, dx, dz] = c, g = Math.min(1, (REF / Math.max(d, 0.5)) ** 1.2) * (1 - (d / MAXD) ** 2);
  const pan = d > 0.5 ? ((dx * e[0] + dz * e[2]) / d) * 0.8 : 0;
  play(K.S, A.currentTime + 0.02, K.v * g, pan, 16000 / (1 + d / 10), 0, true);
  return n30;
}

// ---------- yaprak hışırtısı ----------
let leafy = null, leafKey = '', leafT = 5, rust = null, gustT = 0, nearT = 0;
function leafList() { // yapraklı ağaçlar: orman (decor.js G.trees, çam hariç) ve makeTree'nin yapraklıları; bölge açılınca tazelenir
  const key = Object.values(G.regions).filter((r) => r.unlocked).length + '|' + (G.unlocked ? G.unlocked.size : 0);
  if (leafy && key === leafKey) return;
  leafKey = key; leafy = [];
  for (const t of G.trees || []) if (!t[3]) leafy.push([t[0], t[1]]);
  G.scene.traverse((o) => { if (o.userData.leafTree) { const m = o.matrixWorld.elements; leafy.push([m[12], m[14]]); } });
}
function rustle(dt, p) {
  if ((leafT -= dt) > 0) return;
  leafT = 0.5;
  if ((nearT -= 0.5) <= 0) { nearT = 10; leafList(); }
  let w = 0;
  for (const [x, z] of leafy) { const dx = x - p.x, dz = z - p.z; if (Math.abs(dx) > TREE_R || Math.abs(dz) > TREE_R) continue; const d = Math.hypot(dx, dz); if (d < TREE_R) w += 1 - d / TREE_R; }
  const lvl = Math.min(1, w / 2.5);
  if (!rust) {
    if (lvl < 0.05 || !load(SES.yaprak)) return;
    const s = A.createBufferSource(), h = A.createBiquadFilter(), g = A.createGain();
    s.buffer = SES.yaprak.buf; s.loop = true; h.type = 'highpass'; h.frequency.value = 300; g.gain.value = 0;
    s.connect(h).connect(g).connect(OUT); s.start(A.currentTime + 0.05, Math.random() * 10);
    rust = { g, gust: 0.8 };
  }
  if ((gustT -= 0.5) <= 0) { gustT = rnd(1.5, 4); rust.gust = rnd(0.45, 1); } // rüzgâr kabarır, söner
  rust.g.gain.setTargetAtTime(YAPRAK * lvl * rust.gust, A.currentTime, 1.2);
}

export function updateVoices(dt) {
  if (!ready() || !G.camera || !G.player) return;
  const p = G.player.position;
  prune(dt);
  rustle(dt, p);
  const dawn = day.fading || day.hour < 9.5;
  for (const K of KIND) {
    if ((K.t -= dt) > 0) continue;
    if (live >= MAXLIVE) { K.t = rnd(1, 3); continue; }
    const n = voice(K, p);
    if (n < 0) { K.t = rnd(2, 4); continue; } // yakında bu türden hayvan yok: az sonra yine bak
    const a = K.s === 'horoz' && dawn ? 8 : K.a, b = K.s === 'horoz' && dawn ? 18 : K.b;
    K.t = rnd(a, b) / Math.min(2, 1 + n / 6);
  }
}
