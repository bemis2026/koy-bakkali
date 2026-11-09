// Araç sesleri. 2026-11-05 kullanıcı: "araçların seslerinide az da olsa duyalım mesela bisiklet zili motor sesi. Otomobil kamyonet
// traktör sesi. Bu seslerde gerçeğe en yakın şekilde olsun."
// Kayıtlar Wikimedia Commons'tan (kamu malı, CC0, CC BY 4.0; kaynakları assets/sfx/arac/License.txt, kredisi menu.js ve final.js),
// kesilip düzeyleri eşitlendi (KoyBakkali-araclar/ses/kes2.py). Motor sesi giden aracın kendisinden çıkar: yanında belirgin, uzaklaştıkça
// kısılır ve boğuklaşır, 50 m ötesi susar; hızlandıkça devir (çalma hızı) artar, yaklaşırken biraz tizleşir (Doppler). Park etmiş araç
// susar, traktör durunca rölantide kalır. Aynı anda en yakın 3 motor. Bisikletli müşteri ara sıra, oyuncu önündeyse hemen zil çalar.
// Ortam olayları (ambience.js carPass, horn) ve sfx('honk') de gerçek kayıttan; kayıt yüklenene dek eski kodla çalar.
import { G } from './game.js';
import { ambienceBus, sfxHook } from './audio.js';

const rnd = (a, b) => a + Math.random() * (b - a);
// kısa sesler: p [başlangıç sn, süre sn]; döngüler bütün dosya
const SES = {
  zil: { f: 'zil.ogg', p: [[0, 1.483], [1.733, 1.472], [3.455, 0.552]] },
  korna: { f: 'korna.ogg', p: [[0, 0.7], [0.95, 0.8], [2, 0.9], [3.15, 0.9], [4.3, 1.8]] },
  gecis: { f: 'gecis.ogg', p: [[0, 6], [6.25, 5.5], [12, 5.5], [17.75, 4.5], [22.5, 5], [27.75, 9.5], [37.5, 8.5]] },
  motor: { f: 'motosiklet.ogg' }, araba: { f: 'otomobil.ogg' }, kamyonet: { f: 'kamyonet.ogg' }, kamyon: { f: 'kamyon.ogg' }, traktor: { f: 'traktor.ogg' },
};
// motor: dipteki ses (ölçüm 2026-11-05: 4 m'de motor ≈ 0,007 RMS, tarla/meydan zemini ≈ 0,005), en yüksek hız (m/sn), çalma hızı aralığı (durgun → tam hız), duyulduğu en uzak yer, durunca rölantide kalır mı
const ENG = {
  motor: { v: 0.13, top: 8.5, r: [0.85, 1.15], maxd: 45 },
  araba: { v: 0.13, top: 9, r: [0.9, 1.3], maxd: 45 },
  kamyonet: { v: 0.14, top: 9, r: [0.85, 1.12], maxd: 50 },
  kamyon: { v: 0.16, top: 12, r: [0.85, 1.2], maxd: 55 },
  traktor: { v: 0.16, top: 4.2, r: [0.9, 1.12], maxd: 45, idle: true },
};
// model / köy arabası türü → motor sesi (eşek arabası sessiz)
const KIND = { classic: 'araba', sedan: 'araba', taxi: 'araba', suv: 'araba', pickup: 'kamyonet', minibus: 'kamyonet', van: 'kamyonet', delivery: 'kamyonet', truck: 'kamyon', tractor: 'traktor' };
const MAXV = 3, REF = 6, ZIL = 0.09, ZIL_D = 30, KORNA = 0.5, GECIS = 0.7, HONK = 0.3;
let A = null, OUT = null;

function ready() { const b = ambienceBus(); if (!b) return false; A = b.A; OUT = b.out; return true; }
function load(S) {
  if (S.buf) return true;
  if (!S.loading) { S.loading = true; fetch('assets/sfx/arac/' + S.f).then((r) => r.arrayBuffer()).then((b) => A.decodeAudioData(b)).then((b) => { S.buf = b; }).catch(() => { S.loading = false; }); }
  return false;
}
// kısa ses: rastgele parça (bir önceki tekrarlanmaz); pan sayı ya da [baş, son] (geçen araba soldan sağa)
function part(S, t, v, pan, lp, out = OUT) {
  if (!load(S)) return false;
  let i = Math.floor(Math.random() * S.p.length); if (S.p.length > 1 && i === S.last) i = (i + 1) % S.p.length; S.last = i;
  const [o, d] = S.p[i], s = A.createBufferSource(); s.buffer = S.buf; s.playbackRate.value = rnd(0.96, 1.04);
  let n = s;
  if (lp) { const f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; n.connect(f); n = f; }
  const g = A.createGain(); g.gain.value = v; n.connect(g); n = g;
  if (pan != null && A.createStereoPanner) {
    const pn = A.createStereoPanner(), cl = (x) => Math.max(-1, Math.min(1, x));
    if (Array.isArray(pan)) { pn.pan.setValueAtTime(cl(pan[0]), t); pn.pan.linearRampToValueAtTime(cl(pan[1]), t + d); } else pn.pan.value = cl(pan);
    n.connect(pn); n = pn;
  }
  n.connect(out); s.start(t, o, d);
  return true;
}
// ambience.js: yüklendiyse gerçek kayıt çalar (true), yoksa eski kod
export function realPass(t, v, pan) { if (!ready()) return false; const dir = Math.random() < 0.5 ? -1 : 1; return part(SES.gecis, t, v * GECIS, [-0.85 * dir, 0.85 * dir], 0); }
export function realHorn(t, v, pan) { return ready() && part(SES.korna, t, v * KORNA, pan, 0); }
// sfx('honk'): paket ve otopark arabası gelince; uzaklık payı out'ta (game.js sfx)
sfxHook.honk = (AC, out) => { if (!ready()) return false; return part(SES.korna, AC.currentTime + 0.01, HONK, null, 0, out); };

// ---------- sahnedeki araçlar ----------
function onScene(o) { for (let q = o; q; q = q.parent) if (q === G.scene) return true; return false; }
function vehicles() {
  const L = [], add = (o, k) => { if (o && k && o.visible !== false && onScene(o)) L.push([o, k]); }, R = G.regions || {};
  for (const o of G.traffic || []) add(o, KIND[o.userData.kind || o.userData.mk]); // paket, otopark, benzinlik, kargo, dolmuş (events.js gapK)
  for (const t of (R.pazar && R.pazar.trucks) || []) add(t.obj, KIND[t.obj && t.obj.userData.mk] || 'kamyon');
  const S = R.sehir;
  if (S) for (const t of [S.truck, S.halTruck, S.toptanTruck]) if (t && t.obj) add(t.obj, KIND[t.obj.userData.mk] || 'kamyon');
  if (R.tarlalar && R.tarlalar.unlocked && R.tarlalar.farm) add(R.tarlalar.farm.tr, 'traktor');
  for (const c of G.customers) if (c.riding) add(c.obj, c.speed > 7 ? 'motor' : 'bisiklet'); // world.js: motosiklet 8,5, bisiklet 5,5 m/sn
  return L;
}
const last = new WeakMap(), live = new Map(), zilT = new WeakMap();
let tickT = 0, zilCool = 0;
const fall = (d, maxd) => Math.min(1, (REF / Math.max(d, 0.5)) ** 1.2) * Math.max(0, 1 - (d / maxd) ** 2);
function startVoice(k) {
  const S = SES[k]; if (!load(S)) return null;
  const s = A.createBufferSource(), lp = A.createBiquadFilter(), g = A.createGain();
  s.buffer = S.buf; s.loop = true; lp.type = 'lowpass'; lp.frequency.value = 8000; g.gain.value = 0;
  s.connect(lp).connect(g);
  let pn = null;
  if (A.createStereoPanner) { pn = A.createStereoPanner(); g.connect(pn).connect(OUT); } else g.connect(OUT);
  s.start(A.currentTime + 0.02, Math.random() * S.buf.duration);
  return { s, lp, g, pn, k };
}
function stopVoice(V) { const t = A.currentTime; V.g.gain.setTargetAtTime(0, t, 0.25); V.s.stop(t + 1.5); }

export function updateVehicles(dt) {
  if (!ready() || !G.camera || !G.player) return;
  if ((tickT -= dt) > 0) return;
  const step = 0.2 - tickT; tickT = 0.2; zilCool -= step;
  const p = G.player.position, e = G.camera.matrixWorld.elements, now = A.currentTime, cand = [];
  for (const [o, k] of vehicles()) {
    const m = o.matrixWorld.elements, x = m[12], z = m[14], dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    const q = last.get(o); last.set(o, [x, z]);
    let v = 0, vx = 0, vz = 0;
    if (q) { vx = (x - q[0]) / step; vz = (z - q[1]) / step; v = Math.hypot(vx, vz); if (v > 40) v = vx = vz = 0; } // yeniden belirdi: sıçrama hız sayılmaz
    if (k === 'bisiklet') { bell(o, d, dx, dz, vx, vz, v, e); continue; }
    const E = ENG[k];
    if (d > E.maxd || (v < 0.4 && !E.idle)) continue;
    cand.push({ o, k, E, d, dx, dz, v, vr: d > 0.5 ? -(vx * dx + vz * dz) / d : 0 }); // vr: bize doğru hız
  }
  cand.sort((a, b) => a.d - b.d);
  const keep = new Set(cand.slice(0, MAXV).map((c) => c.o));
  for (const [o, V] of live) if (!keep.has(o)) { stopVoice(V); live.delete(o); }
  for (const c of cand.slice(0, MAXV)) {
    let V = live.get(c.o);
    if (!V) { V = startVoice(c.k); if (!V) continue; live.set(c.o, V); }
    const { E } = c, run = c.v >= 0.4, f = Math.min(1, c.v / E.top);
    const rate = (run ? E.r[0] + (E.r[1] - E.r[0]) * f : E.r[0] * 0.92) * (343 / (343 - Math.max(-30, Math.min(30, c.vr))));
    V.s.playbackRate.setTargetAtTime(rate, now, 0.3);
    V.g.gain.setTargetAtTime(E.v * fall(c.d, E.maxd) * (run ? 1 : 0.6), now, 0.25);
    V.lp.frequency.setTargetAtTime(16000 / (1 + c.d / 12), now, 0.25);
    if (V.pn) V.pn.pan.setTargetAtTime(c.d > 0.5 ? ((c.dx * e[0] + c.dz * e[2]) / c.d) * 0.8 : 0, now, 0.2);
  }
}
// bisiklet zili: yakındaki giden bisikletli 12-30 sn'de bir çalar; oyuncu 9 m önündeyse (yolunda) hemen
function bell(o, d, dx, dz, vx, vz, v, e) {
  if (d > ZIL_D || v < 1) return;
  let t = zilT.get(o); if (t == null) t = rnd(3, 15);
  t -= 0.2;
  const ahead = d < 9 && -(vx * dx + vz * dz) / (v * d) > 0.85; // oyuncu bisikletin önünde
  if ((t <= 0 || (ahead && t < 10)) && zilCool <= 0) {
    if (part(SES.zil, A.currentTime + 0.02, ZIL * fall(d, ZIL_D), d > 0.5 ? ((dx * e[0] + dz * e[2]) / d) * 0.8 : 0, 16000 / (1 + d / 10))) { t = rnd(12, 30); zilCool = 2.5; }
  }
  zilT.set(o, t);
}
window.__arac = () => ({ live: [...live.values()].map((V) => V.k), n: vehicles().length }); // test kancası
