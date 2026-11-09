// Dünyadan gelen müzik: şarkılar bölüme göre çalmaya devam eder (audio.js); bazı bölgelerin kendi çalgısı vardır, yaklaşınca
// duyulur: lunaparkta atlıkarınca orgu, handa çeşmenin basamağında udcu (2026-11-05'ten beri susuyor), pazar girişinde akordeoncu, tatil köyünde kumda
// plaj radyosu, beach club'da DJ. Ses kaynağın yerinden gelir (kameraya göre sağ-sol), yanındayken şarkı kısılır, uzaklaşınca kaybolur.
// Ezgiler bu dosyada yazılı ve özgündür, kodla çalınır; akordeoncu gerçek kayıttan çalar (rec). Müzik ayarına (açık/kapalı, ses) bağlıdır.
// 2026-11-05 kullanıcı: "pazar yerinde akordiyon çalan müzisyende kötü duyuluyor onuda iyileştir": kodla çalınan polka yerine Kevin MacLeod'un
// "Duet Musette" kaydı (CC BY 3.0, Wikimedia Commons; iki sessizlik arası 46,6 sn, dikişsiz döngü, KoyBakkali-araclar/ses/kes2.py)
// 2026-11-02 kullanıcı seçimi: "Dünyadan gelen müzik" (şarkılar bölüme göre kalsın, bölgenin kendi müziği yerinden duyulsun)
import * as THREE from 'three';
import { G } from './game.js';
import * as M from './models.js';
import { musicOut, duckSongs } from './audio.js';

let A = null, OUT = null, NOISE = null, built = false, lastDuck = -1;
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- sesler ----------
function env(t, a, peak, hold, rel, out) {
  const g = A.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
  if (hold > a) g.gain.setValueAtTime(peak, t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(hold, a) + rel);
  g.connect(out);
  return g;
}
function osc(type, f, t, end, out) { const o = A.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(out); o.start(t); o.stop(end); return o; }
function filt(type, f, q, out) { const b = A.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; b.connect(out); return b; }
function noise(t, d, v, type, f, q, out) {
  const s = A.createBufferSource(); s.buffer = NOISE;
  s.connect(filt(type, f, q, env(t, 0.002, v, 0.002, d, out)));
  s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
}
// org borusu: kare dalga + oktav üstü, titrek (vibrato)
function calliope(t, f, d, v, out) {
  const end = t + d * 0.85 + 0.12, lp = filt('lowpass', 3200, 0, env(t, 0.015, v, d * 0.85, 0.07, out));
  const o1 = osc('square', f, t, end, lp), g2 = A.createGain(); g2.gain.value = 0.5; g2.connect(lp);
  const o2 = osc('sine', f * 2, t, end, g2);
  const vib = A.createOscillator(); vib.frequency.value = 6.2; const vg = A.createGain(); vg.gain.value = f * 0.007;
  vib.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency); vib.start(t); vib.stop(end);
}
function pipeBass(t, f, d, v, out) { const g = env(t, 0.01, v, d * 0.55, 0.09, out), end = t + d * 0.55 + 0.15; osc('triangle', f, t, end, g); osc('sine', f, t, end, g); }
// ud: çift telli, mızrapla vurulur; parlak başlar, çabuk söner
function oud(t, f, d, v, out) {
  const dec = Math.min(1.1, 0.28 + d * 0.55), g = A.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); g.connect(out);
  const lp = filt('lowpass', 3200, 4, g); lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(650, t + dec * 0.7);
  const o = osc('sawtooth', f * 1.012, t, t + dec + 0.05, lp); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
  const g2 = A.createGain(); g2.gain.value = 0.6; g2.connect(lp); osc('sawtooth', f * 1.003, t, t + dec + 0.05, g2);
}
// def: düm (pes, göğüsten) ve tek (kenardan, tiz)
function dum(t, v, out) { const g = env(t, 0.003, v, 0.003, 0.3, out), o = osc('sine', 95, t, t + 0.35, g); o.frequency.exponentialRampToValueAtTime(50, t + 0.22); }
const tek = (t, v, out) => noise(t, 0.07, v, 'bandpass', 2600, 1.2, out);
// radyo: vibrafon, ukulele, bas ve marakas
function vibes(t, f, d, v, out) {
  const dec = Math.min(1.6, 0.5 + d * 0.5), g = A.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); g.connect(out);
  osc('sine', f, t, t + dec + 0.05, g);
  const g4 = env(t, 0.003, v * 0.25, 0.003, 0.25, out); osc('sine', f * 4, t, t + 0.3, g4);
}
function uke(t, notes, v, out) {
  notes.forEach((n, i) => { const t0 = t + i * 0.018, g = env(t0, 0.004, v, 0.004, 0.42, out); osc('triangle', mf(n), t0, t0 + 0.5, filt('lowpass', 2500, 0, g)); });
}
function bassR(t, f, d, v, out) { const g = env(t, 0.006, v, d * 0.5, 0.12, out); osc('triangle', f, t, t + d * 0.5 + 0.2, g); }
const shaker = (t, v, out) => noise(t, 0.045, v, 'highpass', 5200, 0, out);
// kulüp: house davul (tok bas davul, el çırpma, hi-hat), ofbit testere bas, akor vuruşları, pluck ezgi, ölçü sonu yükselen hışırtı
function kick(t, v, out) { const g = env(t, 0.002, v, 0.002, 0.28, out), o = osc('sine', 160, t, t + 0.32, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); }
const clap = (t, v, out) => { noise(t, 0.11, v, 'bandpass', 1500, 0.9, out); noise(t + 0.012, 0.09, v * 0.7, 'bandpass', 1900, 0.9, out); };
const hat = (t, d, v, out) => noise(t, d, v, 'highpass', 7600, 0, out);
function sawBass(t, f, d, v, out) {
  const g = env(t, 0.004, v, d * 0.6, 0.06, out), lp = filt('lowpass', 900, 6, g), end = t + d + 0.1;
  lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(260, t + d * 0.8);
  osc('sawtooth', f, t, end, lp); osc('sine', f / 2, t, end, g); // alt bas: telefonda duyulmaz, büyük hoparlörde gövde verir
}
function stab(t, notes, d, v, out) {
  const g = env(t, 0.004, v, d * 0.4, 0.12, out), lp = filt('lowpass', 2600, 2, g), end = t + d + 0.2;
  lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.25);
  for (const n of notes) { osc('sawtooth', mf(n) * 1.004, t, end, lp); osc('sawtooth', mf(n) * 0.996, t, end, lp); }
}
function pluck(t, f, d, v, out) {
  const dec = Math.min(0.5, 0.18 + d * 0.4), g = A.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); g.connect(out);
  const lp = filt('lowpass', 4200, 3, g); lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(900, t + dec);
  osc('square', f, t, t + dec + 0.05, lp); osc('triangle', f * 2, t, t + dec + 0.05, lp);
}
function riser(t, d, v, out) {
  const s = A.createBufferSource(); s.buffer = NOISE; s.loop = true;
  const g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05); g.connect(out);
  const bp = filt('bandpass', 400, 2, g); bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(7000, t + d);
  s.connect(bp); s.start(t); s.stop(t + d + 0.1);
}

// ---------- ezgiler ----------
// olay: [vuruş, (t, saniye/vuruş, çıkış) => çal]; ezgi [nota (MIDI, 0 = sus), vuruş]
function mel(list, fn, v, b0 = 0) {
  const ev = []; let b = b0;
  for (const [n, d] of list) { if (n) ev.push([b, (t, s, o) => fn(t, mf(n), d * s, v, o)]); b += d; }
  return ev;
}
const song = (bpm, len, ev) => ({ spb: 60 / bpm, len, ev: ev.sort((a, b) => a[0] - b[0]) });

// lunapark: atlıkarınca valsi, Do majör, 3/4
const WALTZ = (() => {
  const m = [[67, 1], [72, 1], [76, 1], [79, 2], [76, 1], [77, 1], [76, 1], [74, 1], [71, 2], [67, 1],
    [74, 1], [77, 1], [79, 1], [79, 2], [77, 1], [76, 1], [74, 1], [72, 1], [67, 3],
    [69, 1], [72, 1], [77, 1], [81, 2], [77, 1], [79, 1], [76, 1], [72, 1], [76, 3],
    [77, 1], [76, 1], [74, 1], [71, 1], [74, 1], [79, 1], [76, 2], [74, 1], [72, 3]];
  const C = [36, [55, 60, 64]], G7 = [43, [53, 59, 62]], F = [41, [57, 60, 65]], Am = [45, [57, 60, 64]], Dm = [38, [57, 62, 65]];
  const bars = [C, C, G7, G7, G7, G7, C, C, F, F, C, Am, Dm, G7, C, C];
  const ev = mel(m, calliope, 0.05);
  bars.forEach(([r, ch], i) => {
    ev.push([i * 3, (t, s, o) => pipeBass(t, mf(r + 12), s, 0.11, o)]);
    for (const b of [1, 2]) ev.push([i * 3 + b, (t, s, o) => { for (const n of ch) calliope(t, mf(n), s * 0.45, 0.018, o); }]);
  });
  return song(168, 48, ev);
})();
// han: hicaz makamında ud, sofyan usulünde def
const HICAZ = (() => {
  const m = [[69, 1], [70, 0.5], [69, 0.5], [66, 1], [67, 1], [69, 2], [66, 0.5], [63, 0.5], [62, 1],
    [62, 0.5], [63, 0.5], [66, 1], [67, 0.5], [69, 0.5], [70, 1], [72, 1], [70, 0.5], [69, 0.5], [69, 2],
    [74, 1], [72, 0.5], [70, 0.5], [69, 1], [67, 1], [66, 1], [67, 0.5], [66, 0.5], [63, 2],
    [63, 0.5], [66, 0.5], [67, 0.5], [66, 0.5], [63, 1], [62, 1], [62, 4]];
  const ev = [];
  // uzun notalar mızrapla yeniden vurulur (tremolo)
  let b = 0;
  for (const [n, d] of m) {
    for (let k = 0; k < Math.max(1, d / 0.5); k++) { const bb = b + k * 0.5, v = k ? 0.05 : 0.075; ev.push([bb, (t, s, o) => oud(t, mf(n), (d >= 1 ? 0.5 : d) * s, v, o)]); }
    b += d;
  }
  for (let bar = 0; bar < 8; bar++) {
    ev.push([bar * 4, (t, s, o) => { oud(t, mf(50), 2 * s, 0.05, o); dum(t, 0.1, o); }]);
    ev.push([bar * 4 + 2, (t, s, o) => tek(t, 0.05, o)]);
    ev.push([bar * 4 + 3, (t, s, o) => tek(t, 0.035, o)]);
    ev.push([bar * 4 + 3.5, (t, s, o) => tek(t, 0.02, o)]);
  }
  return song(84, 32, ev);
})();
// tatil köyü: radyoda hafif bir bossa, Fa majör
const BOSSA = (() => {
  const m = [[76, 1.5], [74, 0.5], [72, 1], [69, 1], [72, 1.5], [69, 0.5], [65, 2], [74, 1], [77, 1], [74, 1], [70, 1], [72, 3], [0, 1],
    [76, 1.5], [77, 0.5], [79, 1], [76, 1], [77, 1.5], [74, 0.5], [69, 2], [70, 1], [74, 1], [77, 1], [76, 1], [77, 3], [0, 1]];
  const ch = [[53, [60, 64, 65, 69]], [50, [60, 62, 65, 69]], [55, [62, 65, 67, 70]], [48, [58, 60, 64, 67]]];
  const ev = mel(m, vibes, 0.05);
  for (let i = 0; i < 8; i++) {
    const [r, c] = ch[i % 4];
    ev.push([i * 4, (t, s, o) => bassR(t, mf(r), 1.5 * s, 0.1, o)]);
    ev.push([i * 4 + 2, (t, s, o) => bassR(t, mf(r + 7), 1.5 * s, 0.08, o)]);
    for (const b of i % 2 ? [1, 2.5] : [0, 1.5, 3]) ev.push([i * 4 + b, (t, s, o) => uke(t, c, 0.022, o)]);
    for (let k = 0; k < 8; k++) ev.push([i * 4 + k * 0.5, (t, s, o) => shaker(t, k % 2 ? 0.02 : 0.01, o)]);
  }
  return song(104, 32, ev);
})();
// beach club: house, La minör, Am-F-C-G; ilk dört ölçü davul, bas ve akor vuruşları, son dördünde pluck ezgi de girer
const HOUSE = (() => {
  const ch = [[45, [57, 60, 64]], [41, [57, 60, 65]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
  const m = [[76, 0.5], [0, 0.25], [74, 0.25], [72, 0.5], [69, 0.5], [72, 0.5], [74, 0.5], [76, 1], [77, 0.5], [76, 0.5], [72, 0.5], [69, 0.5], [0, 2],
    [76, 0.5], [0, 0.25], [74, 0.25], [72, 0.5], [69, 0.5], [67, 0.5], [69, 0.5], [72, 1], [74, 0.5], [72, 0.5], [71, 0.5], [67, 0.5], [0, 2]];
  const ev = mel(m, pluck, 0.035, 16);
  for (let bar = 0; bar < 8; bar++) {
    const [r, c] = ch[bar % 4], b0 = bar * 4;
    for (let k = 0; k < 4; k++) {
      ev.push([b0 + k, (t, s, o) => kick(t, 0.16, o)]);
      ev.push([b0 + k + 0.5, (t, s, o) => { hat(t, 0.09, 0.035, o); sawBass(t, mf(r), 0.4 * s, 0.07, o); }]);
      for (const q of [0.25, 0.75]) ev.push([b0 + k + q, (t, s, o) => hat(t, 0.025, 0.012, o)]);
      if (k % 2) ev.push([b0 + k, (t, s, o) => clap(t, 0.05, o)]);
    }
    if (bar % 2) ev.push([b0 + 3.75, (t, s, o) => sawBass(t, mf(r + 12), 0.2 * s, 0.05, o)]);
    for (const q of [0.5, 1.75, 2.5]) ev.push([b0 + q, (t, s, o) => stab(t, c, 0.3 * s, 0.011, o)]);
  }
  ev.push([30, (t, s, o) => riser(t, 2 * s, 0.03, o)]);
  return song(124, 32, ev);
})();

// ---------- kaynaklar ----------
// r0: tam ses yarıçapı, r1: duyulmaz olduğu yer; ry: çalgıcının baktığı yön. vol: dibindeyken kısılmış şarkının ~2 katı, tam şarkının
// biraz altında (ölçüm: şarkı RMS 0,14 × 1,7 × 0,32 ≈ 0,076; kısılınca 0,021; çalgı dibinde ≈ 0,04-0,05)
const SRC = [
  { id: 'luna', region: 'lunapark', x: 93, z: -11, r0: 8, r1: 36, vol: 3.6, song: WALTZ, gate: () => 0.5 + 0.5 * Math.min(1, (G.carouselW || 0) / 0.5) },
  // 2026-11-05 kullanıcı: "Kervansaraya gidince kötü bir sinyal sesi geliyor ... onu iptal et": udcu çalmaz, çeşmede udu kucağında dinlenir
  { id: 'han', region: 'han', x: -1.05, z: -42.85, ry: -0.39, r0: 4, r1: 22, vol: 9.5, song: HICAZ, mute: true },
  { id: 'pazar', region: 'pazar', x: 38.2, z: -5.2, ry: 0, r0: 4, r1: 24, vol: 3, song: { spb: 60 / 188 }, rec: 'assets/sfx/calgi/akordeon.ogg' }, // spb: kaydın temposu (körük ve baş sallama); vol: dibinde ≈ 0,04 (radyoyla eşit, ölçüm 2026-11-05)
  { id: 'tatil', region: 'tatil', x: 99, z: 28.6, ry: 0.35, r0: 3.5, r1: 20, vol: 6, song: BOSSA, radio: true },
  { id: 'club', region: 'tatil', need: 'xtatil4', x: 119.5, z: 22.5, r0: 7, r1: 34, vol: 5, song: HOUSE }, // beach club DJ'i (club.js), alınınca çalar
  // Martı Adası (adacanli.js yerlerini yazar, çalanları kendisi çizer): ateş başında gitar, kumsalda DJ kabini
  { id: 'adaGitar', region: 'ada', x: 0, z: 0, r0: 4, r1: 22, vol: 6.5, song: BOSSA, on: () => G.world === 'ada' },
  { id: 'adaDJ', region: 'ada', x: 0, z: 0, r0: 7, r1: 32, vol: 5, song: HOUSE, on: () => G.world === 'ada' },
];
function setupSrc(S) {
  S.g = A.createGain(); S.g.gain.value = 0; S.w = 0;
  let node = S.g;
  if (A.createStereoPanner) { S.pan = A.createStereoPanner(); S.g.connect(S.pan).connect(OUT); } else S.g.connect(OUT);
  if (S.radio) { // küçük radyo hoparlörü: pes ve tiz kesik, hafif cızırtı
    const lp = filt('lowpass', 3400, 0.7, S.g), hp = filt('highpass', 280, 0.7, lp);
    const hiss = A.createBufferSource(); hiss.buffer = NOISE; hiss.loop = true;
    const hg = A.createGain(); hg.gain.value = 0.004; hiss.connect(filt('bandpass', 5000, 0.8, hg)); hg.connect(S.g); hiss.start();
    node = hp;
  }
  S.inp = node;
}
// şarkı dünyada hep çalıyormuş gibi: konum mutlak zamandan; yaklaşınca ortasından duyulur
function pump(S, now) {
  const sg = S.song, s = sg.spb, L = sg.len * s;
  if (S.loop0 == null || now - (S.loop0 + sg.ev[S.i][0] * s) > 1) {
    const pos = now % L; S.loop0 = now - pos;
    S.i = sg.ev.findIndex((e) => e[0] * s >= pos + 0.05);
    if (S.i < 0) { S.i = 0; S.loop0 += L; }
  }
  for (let k = 0; k < 400; k++) {
    const e = sg.ev[S.i], t = S.loop0 + e[0] * s;
    if (t > now + 0.25) break;
    if (t > now - 0.05) e[1](t, s, S.inp);
    if (++S.i >= sg.ev.length) { S.i = 0; S.loop0 += L; }
  }
}

// kayıttan çalan çalgı: dosya bir kez yüklenir; dünyada hep çalıyormuş gibi mutlak zamana göre ortasından başlar, döngüde döner
function recPump(S) {
  if (S.src) return;
  if (!S.buf) { if (!S.loading) { S.loading = true; fetch(S.rec).then((r) => r.arrayBuffer()).then((b) => A.decodeAudioData(b)).then((b) => { S.buf = b; }).catch(() => { S.loading = false; }); } return; }
  const t = A.currentTime + 0.02, pos = t % S.buf.duration, s = A.createBufferSource();
  s.buffer = S.buf; s.loop = true; s.connect(S.inp); s.start(t, pos); S.src = s; S.loop0 = t - pos;
}

// ---------- çalgıcılar ----------
function col(R, x0, x1, z0, z1) { const c = [x0, x1, z0, z1]; R.colliders.push(c); if (R.unlocked) G.colliders.push(c); }
const still = (o) => { o.traverse((m) => { m.userData.bkNo = true; if (m.isMesh) m.castShadow = true; }); return o; }; // birleştirmeye girmez (perf.js): oynar
function makeOud() {
  const g = new THREE.Group(), wood = M.mat('#7a4a22'), top = M.mat('#d2a466'), dark = M.mat('#3b2412');
  const b = M.sph(0.5, wood, 0, 0, -0.02, g); b.scale.set(0.38, 0.5, 0.2);
  const t = M.cyl(0.5, 0.5, 0.02, 20, top, 0, 0, 0.06, g); t.rotation.x = Math.PI / 2; t.scale.set(0.34, 1, 0.46);
  const h = M.cyl(0.035, 0.035, 0.012, 12, dark, 0, 0.05, 0.072, g); h.rotation.x = Math.PI / 2;
  M.rbox(0.06, 0.3, 0.035, 0.01, dark, 0, 0.36, 0.03, g);
  const p = M.rbox(0.055, 0.15, 0.035, 0.01, dark, 0, 0.53, -0.02, g); p.rotation.x = -0.9;
  return g;
}
function makeAccordion() {
  const g = new THREE.Group(), red = M.mat('#b8262e', { rough: 0.5 }), cream = M.mat('#f1e6cc'), black = M.mat('#222222'), gold = M.mat('#e2b23c', { rough: 0.4 });
  const L = M.rbox(0.13, 0.32, 0.24, 0.02, red, -0.2, 0, 0, g), R = M.rbox(0.13, 0.32, 0.24, 0.02, red, 0.2, 0, 0, g);
  // klavye sağ elde (karakter +z'ye bakar, sağı -x): ön yüzünde krem tuşlar; sol yanda bas düğmeleri
  M.rbox(0.1, 0.28, 0.012, 0.004, cream, 0, 0, 0.122, L);
  for (let i = 0; i < 6; i++) M.rbox(0.05, 0.022, 0.01, 0.003, black, 0.02, -0.11 + i * 0.045, 0.13, L);
  for (const [bx, by] of [[-0.03, 0.08], [0.03, 0.08], [-0.03, 0.02], [0.03, 0.02], [0, -0.05]]) M.cyl(0.018, 0.018, 0.012, 8, cream, bx, by, 0.124, R).rotation.x = Math.PI / 2;
  M.cyl(0.03, 0.03, 0.01, 10, gold, 0, -0.11, 0.124, R).rotation.x = Math.PI / 2;
  const bel = new THREE.Group(); g.add(bel);
  for (let i = 0; i < 7; i++) M.rbox(0.03, 0.3, 0.22, 0.004, i % 2 ? black : red, -0.105 + i * 0.035, 0, 0, bel);
  g.userData = { L, R, bel };
  return g;
}
function makeRadio() {
  const g = new THREE.Group(), body = M.mat('#d8402f', { rough: 0.5 }), dark = M.mat('#262626'), grey = M.mat('#9aa0a6', { rough: 0.4 });
  M.rbox(0.52, 0.28, 0.16, 0.03, body, 0, 0.14, 0, g);
  const cones = [];
  for (const s of [-1, 1]) {
    const c = M.cyl(0.085, 0.085, 0.02, 16, dark, s * 0.15, 0.13, 0.082, g); c.rotation.x = Math.PI / 2;
    const d = M.cyl(0.03, 0.04, 0.02, 12, grey, s * 0.15, 0.13, 0.092, g); d.rotation.x = Math.PI / 2; cones.push(d);
  }
  M.rbox(0.12, 0.05, 0.02, 0.01, grey, 0, 0.21, 0.082, g);
  M.rbox(0.4, 0.025, 0.03, 0.01, dark, 0, 0.33, 0, g);
  for (const s of [-1, 1]) M.rbox(0.025, 0.06, 0.03, 0.008, dark, s * 0.19, 0.3, 0, g);
  const ant = M.cyl(0.006, 0.006, 0.55, 6, grey, 0.2, 0.52, -0.04, g); ant.rotation.z = -0.35;
  g.userData.cones = cones;
  return g;
}
function seat(o, legX, armX = -0.35) { const u = o.userData; for (const l of u.legs) l.rotation.x = legX; for (const a of u.arms) a.rotation.x = armX; }
function build() {
  if (!G.regions || !G.regions.han || !M.makeCharacter) return;
  built = true;
  const R = (id) => G.regions[id];
  for (const S of SRC) {
    const Rg = R(S.region); if (!Rg || !Rg.content) continue;
    if (S.id === 'han') { // çeşmenin basamağında (0,7 m) oturmuş, udu kucağında
      const o = M.makeCharacter(M.villagerLook()); seat(o, -1.25);
      o.position.set(S.x, 0.72 - 0.62, S.z); o.rotation.y = S.ry;
      const ins = makeOud(); ins.position.set(0.04, 0.88, 0.27); ins.rotation.z = -1.22; ins.rotation.y = 0.15; o.add(ins);
      Rg.content.add(still(o)); S.who = o;
    } else if (S.id === 'pazar') { // ayakta akordeoncu, önünde açık çalgı kutusu
      const o = M.makeCharacter(M.villagerLook());
      o.position.set(S.x, 0, S.z); o.rotation.y = S.ry;
      const ins = makeAccordion(); ins.position.set(0, 1.0, 0.32); ins.scale.setScalar(1.2); o.add(ins);
      Rg.content.add(still(o)); S.who = o; S.ins = ins;
      const fx = Math.sin(S.ry), fz = Math.cos(S.ry), cs = new THREE.Group();
      M.rbox(0.62, 0.1, 0.3, 0.02, M.mat('#3a2a1e'), 0, 0.05, 0, cs); M.rbox(0.56, 0.02, 0.24, 0.01, M.mat('#8e1f2a'), 0, 0.1, 0, cs);
      for (const [cx, cz] of [[-0.12, 0.03], [0.05, -0.05], [0.16, 0.06]]) { const c = M.cyl(0.035, 0.035, 0.012, 10, M.mat('#e2b23c', { rough: 0.4 }), cx, 0.115, cz, cs); c.rotation.x = 0.1; }
      cs.position.set(S.x + fx * 0.85, 0, S.z + fz * 0.85); cs.rotation.y = S.ry; Rg.content.add(cs);
      col(Rg, S.x - 0.45, S.x + 0.45, S.z - 0.45, S.z + 0.45);
    } else if (S.id === 'tatil') { // kumda çizgili havlu, köşesinde radyo
      const tw = new THREE.Group();
      ['#ff8a5c', '#ffffff', '#3fa7d6', '#ffffff', '#ff8a5c'].forEach((c, i) => M.rbox(1.7, 0.02, 0.18, 0.005, M.mat(c), 0, 0.012, -0.36 + i * 0.18, tw));
      tw.position.set(S.x - 0.5, 0, S.z); tw.rotation.y = S.ry; Rg.content.add(tw);
      const r = makeRadio(); r.position.set(S.x, 0.02, S.z); r.rotation.y = S.ry + 0.4; Rg.content.add(still(r)); S.radioObj = r;
      col(Rg, S.x - 0.32, S.x + 0.32, S.z - 0.25, S.z + 0.25);
    }
  }
}
function animate(S, k) {
  const sg = S.song, beat = A && S.loop0 != null ? (A.currentTime - S.loop0) / sg.spb : G.time / sg.spb, ph = beat * Math.PI;
  const on = 1; // ses kapalıyken de çalıyormuş gibi oynar
  if (S.who) {
    const u = S.who.userData, a = u.arms;
    u.head.rotation.z = Math.sin(ph) * 0.07 * on;
    if (S.id === 'han') {
      u.head.rotation.x = 0.18;
      a[0].rotation.x = -0.8; a[0].rotation.z = 0.35 + Math.sin(beat * Math.PI * 4) * 0.06 * on; // mızrap eli (sağ)
      a[1].rotation.x = -1.05; a[1].rotation.z = 0.55 + Math.sin(beat * 1.3) * 0.04; // sap eli (sol)
    } else if (S.id === 'pazar') {
      const w = 0.2 + Math.sin(ph / 2) * 0.06 * on, B = S.ins.userData; // körük açılıp kapanır
      B.bel.scale.x = w / 0.245; B.L.position.x = -w / 2 - 0.065; B.R.position.x = w / 2 + 0.065;
      a[0].rotation.x = -0.95; a[0].rotation.z = 0.12 - (w - 0.2) * 1.2;
      a[1].rotation.x = -0.95; a[1].rotation.z = -0.12 + (w - 0.2) * 1.2;
      u.head.rotation.y = Math.sin(beat * 0.25) * 0.3;
      S.who.position.y = Math.abs(Math.sin(ph)) * 0.03 * on; // tempoyla yaylanır
    }
  }
  if (S.radioObj) { const p = 1 + Math.max(0, Math.cos(ph)) * 0.25 * on; for (const c of S.radioObj.userData.cones) c.scale.set(p, 1, p); }
}

export function updateCalgi() {
  if (!built) build(); // çalgıcılar ses açılmadan da yerinde durur
  if (!A) { const m = musicOut(); if (m) { A = m.A; OUT = m.out; } }
  if (A && !NOISE) { NOISE = A.createBuffer(1, A.sampleRate, A.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  if (!G.player) return;
  const live = !!A && A.state === 'running';
  const p = G.player.position, e = G.camera ? G.camera.matrixWorld.elements : [1, 0, 0];
  let duck = 0;
  for (const S of SRC) {
    const R = G.regions[S.region], on = !S.mute && (S.on ? S.on() : !!(R && R.unlocked) && (!S.need || !!(G.unlocked && G.unlocked.has(S.need))));
    const dx = S.x - p.x, dz = S.z - p.z, d = Math.hypot(dx, dz);
    const k = on ? Math.max(0, Math.min(1, (S.r1 - d) / (S.r1 - S.r0))) : 0;
    const w = k * k * S.vol * (S.gate ? S.gate() : 1);
    duck = Math.max(duck, k * k);
    if (on && d < S.r1 + 10) animate(S, live ? w : 0);
    if (!live) continue;
    if (!S.g) { if (w < 0.001) continue; setupSrc(S); }
    if (Math.abs(w - S.w) > 0.003) { S.g.gain.setTargetAtTime(w, A.currentTime, 0.3); S.w = w; }
    if (S.pan) S.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, ((dx * e[0] + dz * e[2]) / Math.max(d, 1)) * Math.min(1, d / 5) * 0.85)), A.currentTime, 0.2);
    if (S.w > 0.001) { if (S.rec) recPump(S); else pump(S, A.currentTime); } else { S.loop0 = null; if (S.src) { S.src.stop(A.currentTime + 1.5); S.src = null; } }
  }
  if (live && Math.abs(duck - lastDuck) > 0.02) { lastDuck = duck; duckSongs(duck); }
}
// kaynağın şu anki vuruşu (çalan şarkıyla aynı saat): dansçılar ve ışıklar tempoya uyar; ses kapalıyken oyun saatinden
export function beatOf(id) {
  const S = SRC.find((q) => q.id === id); if (!S) return G.time * 2;
  return A && S.loop0 != null ? (A.currentTime - S.loop0) / S.song.spb : G.time / S.song.spb;
}
export function calgiSrc(id) { return SRC.find((S) => S.id === id); }
window.__calgi = (id) => (id ? SRC.find((S) => S.id === id) : SRC.map((S) => ({ id: S.id, w: +(S.w || 0).toFixed(3), on: !!(G.regions[S.region] && G.regions[S.region].unlocked) && (!S.need || G.unlocked.has(S.need)), who: !!(S.who || S.radioObj || S.id === 'luna') }))); // test kancası
