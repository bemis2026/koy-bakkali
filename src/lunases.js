// Lunaparkta her eğlencenin kendi sesi (2026-11-04 kullanıcı: "lunaparkta her makinanın kendine ait sesleri olmalı, örneğin
// roller coster da insanlar çığlık atmalı"). Hepsi kodla üretilir, ortam sesi kanalından çalar (Ayarlar: Ortam sesleri) ve
// eğlencenin bulunduğu yerden duyulur: yakında tam, uzaklaştıkça kısılır, sağ-sol kayar. lunapark.js çağırır:
// hız treni: zincirli yokuşta tıkırtı, raylarda gürültü, inişte çığlık, sonda fren · korsan gemisi (gondol): savrulma uğultusu,
// tepede gıcırtı, inişte çığlık · çarpışan arabalar: elektrik vızıltısı, tampon tokuşması, korna · dönme dolap: motor uğultusu,
// gıcırtı · atlıkarınca: orgu calgi.js çalar, burada çocuk gülüşü · her tur başında elektrikli zil
import { G } from './game.js';
import { ambienceBus } from './audio.js';

const rnd = (a, b) => a + Math.random() * (b - a);
let A = null, OUT = null, white = null, brown = null;
function ready() {
  const b = ambienceBus();
  if (!b || b.A.state !== 'running') return false;
  if (A !== b.A) { A = b.A; white = brown = null; }
  OUT = b.out;
  return true;
}
function noiseBuf(kind) {
  if (kind === 'brown' ? brown : white) return kind === 'brown' ? brown : white;
  const n = Math.floor(A.sampleRate * 3), b = A.createBuffer(1, n, A.sampleRate), d = b.getChannelData(0);
  if (kind === 'brown') { let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } brown = b; }
  else { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; white = b; }
  return b;
}
// yerden duyulma: r0'a dek tam ses, r1'de sıfır; sağ-sol oyuncuya göre (kamera güneyden bakar, doğu sağda)
function heard(at, r0, r1) {
  const p = G.player && G.player.position;
  if (!p || !at) return [1, 0];
  const d = Math.hypot(at.x - p.x, at.z - p.z);
  return [d <= r0 ? 1 : Math.max(0, 1 - (d - r0) / (r1 - r0)), Math.max(-0.8, Math.min(0.8, (at.x - p.x) / 14))];
}
function outAt(v, pan) {
  const g = A.createGain(); g.gain.value = v;
  if (A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(OUT); } else g.connect(OUT);
  return g;
}
function osc(type, t, d, out, f0) {
  const o = A.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
  o.connect(out); o.start(t); o.stop(t + d + 0.05);
  return o;
}
function envGain(t, a, peak, hold, d, out) {
  const g = A.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  g.connect(out);
  return g;
}
function noiseHit(t, d, v, type, f, out, q = 1) {
  const s = A.createBufferSource(); s.buffer = noiseBuf('white');
  const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  s.connect(fl).connect(envGain(t, 0.004, v, 0.005, d, out));
  s.start(t, Math.random() * 2); s.stop(t + d + 0.05);
}

// ---------- olaylar ----------
// çığlık: kadın, çocuk, erkek sesleri; "aaaa" ünlüsü (üç formant süzgeci), hızla tize çıkar, titreyerek uzar, sonda düşer
export function scream(at, n = 3, big = 1) {
  if (!ready()) return;
  const [k, pan] = heard(at, 6, 48);
  if (k <= 0) return;
  const out = outAt(0.16 * k * big, pan), t0 = A.currentTime + 0.02;
  for (let i = 0; i < n; i++) {
    const t = t0 + rnd(0, 0.35), d = rnd(1.1, 2.0) * (0.8 + 0.25 * big), man = Math.random() < 0.25, f0 = man ? rnd(230, 330) : rnd(480, 760);
    const bus = envGain(t, 0.07, 1, d * 0.7, d, out);
    for (const [f, q, g] of [[man ? 750 : 950, 6, 1], [man ? 1200 : 1450, 7, 0.7], [2800, 8, 0.35]]) { // "a" ünlüsü
      const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * rnd(0.92, 1.08); bp.Q.value = q;
      const gg = A.createGain(); gg.gain.value = g * 2.2; bp.connect(gg).connect(bus);
      const o = osc('sawtooth', t, d, bp, f0);
      const fr = o.frequency; fr.setValueAtTime(f0, t); fr.exponentialRampToValueAtTime(f0 * rnd(1.45, 1.7), t + 0.12);
      fr.setValueAtTime(f0 * 1.6, t + d * 0.55); fr.exponentialRampToValueAtTime(f0 * rnd(1.0, 1.2), t + d);
      const vib = A.createOscillator(), vg = A.createGain(); vib.frequency.value = rnd(5.5, 7.5); vg.gain.value = f0 * 0.035;
      vib.connect(vg).connect(fr); vib.start(t); vib.stop(t + d + 0.05);
    }
    noiseHit(t, d * 0.8, 0.08, 'bandpass', 2600, bus, 1.5); // nefes
  }
}
// çocuk gülüşü (atlıkarınca): "ha-ha-ha", perdesi hece hece iner
export function laugh(at) {
  if (!ready()) return;
  const [k, pan] = heard(at, 5, 28);
  if (k <= 0) return;
  const out = outAt(0.08 * k, pan), f0 = rnd(380, 520);
  let t = A.currentTime + 0.02;
  for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) {
    const d = rnd(0.08, 0.11), f = f0 * (1 - i * 0.04);
    const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3;
    bp.connect(envGain(t, 0.01, 1, d * 0.4, d, out));
    osc('sawtooth', t, d, bp, f);
    noiseHit(t, d * 0.6, 0.25, 'bandpass', 1800, out, 2);
    t += d + rnd(0.05, 0.08);
  }
}
// elektrikli zil: tur başlarken "zırrrr" (çekiç zile saniyede 25 kez vurur)
export function bell(at) {
  if (!ready()) return;
  const [k, pan] = heard(at, 6, 40);
  if (k <= 0) return;
  const t = A.currentTime + 0.02, d = 1.3, out = outAt(0.05 * k, pan);
  const am = A.createGain(); am.gain.value = 0.5; am.connect(envGain(t, 0.01, 1, d - 0.15, d, out));
  const lfo = A.createOscillator(), lg = A.createGain(); lfo.type = 'square'; lfo.frequency.value = 25; lg.gain.value = 0.5;
  lfo.connect(lg).connect(am.gain); lfo.start(t); lfo.stop(t + d + 0.05);
  for (const [f, g] of [[1180, 1], [2950, 0.45], [4100, 0.2]]) { const gg = A.createGain(); gg.gain.value = g; gg.connect(am); osc('sine', t, d, gg, f); }
}
// zincirli yokuşta tıkırtı: "tak"
export function clack(at) {
  if (!ready()) return;
  const [k, pan] = heard(at, 5, 30);
  if (k <= 0) return;
  const t = A.currentTime + 0.01, out = outAt(0.08 * k, pan);
  noiseHit(t, 0.03, 0.9, 'bandpass', 1900, out, 2);
  const o = osc('triangle', t, 0.05, envGain(t, 0.002, 0.6, 0.004, 0.05, out), 170);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.05);
}
// tampon tokuşması: kauçuk "bom" ve plastik takırtı
export function bump(at) {
  if (!ready()) return;
  const [k, pan] = heard(at, 5, 26);
  if (k <= 0) return;
  const t = A.currentTime + 0.01, out = outAt(0.09 * k * rnd(0.7, 1), pan);
  const o = osc('sine', t, 0.2, envGain(t, 0.003, 1, 0.01, 0.2, out), rnd(140, 170));
  o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
  noiseHit(t, 0.08, 0.6, 'lowpass', 500, out);
  noiseHit(t + 0.005, 0.03, 0.25, 'bandpass', 1100, out, 3);
}
// çarpışan araba kornası: "düt düt"
export function honk(at) {
  if (!ready()) return;
  const [k, pan] = heard(at, 5, 26);
  if (k <= 0) return;
  const out = outAt(0.035 * k, pan), lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.connect(out);
  const n = Math.random() < 0.5 ? 1 : 2;
  for (let i = 0; i < n; i++) { const t = A.currentTime + 0.02 + i * 0.24; for (const f of [415, 523]) osc('square', t, 0.17, envGain(t, 0.008, 0.5, 0.14, 0.17, lp), f); }
}
// gıcırtı: demir eklem (gemi tepede, dolap dönerken)
export function creak(at, v = 1) {
  if (!ready()) return;
  const [k, pan] = heard(at, 5, 26);
  if (k <= 0) return;
  const t = A.currentTime + 0.02, d = rnd(0.35, 0.6), f = rnd(140, 220);
  const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rnd(600, 900); bp.Q.value = 6;
  bp.connect(envGain(t, 0.05, 1, d * 0.6, d, outAt(0.05 * k * v, pan)));
  const o = osc('sawtooth', t, d, bp, f); o.frequency.linearRampToValueAtTime(f * rnd(1.1, 1.3), t + d);
}
// fren: hava basıncı "pşşş"
export function brake(at) {
  if (!ready()) return;
  const [k, pan] = heard(at, 5, 30);
  if (k <= 0) return;
  const t = A.currentTime + 0.02;
  noiseHit(t, 0.9, 0.5, 'highpass', 2600, outAt(0.06 * k, pan));
}

// ---------- sürekli sesler: eğlence çalışırken; seviye (0-1) her karede verilir ----------
// rumble: hız treninin rayda tekerlek gürültüsü · buzz: çarpışan arabaların elektrik vızıltısı · whoosh: gemi savrulurken rüzgâr ·
// motor: dönme dolabın motoru
const LOOPS = {};
function makeLoop(kind) {
  const L = { g: A.createGain(), pan: A.createStereoPanner ? A.createStereoPanner() : null, v: 0 };
  L.g.gain.value = 0;
  if (L.pan) L.g.connect(L.pan).connect(OUT); else L.g.connect(OUT);
  const src = (buf) => { const s = A.createBufferSource(); s.buffer = noiseBuf(buf); s.loop = true; s.start(0, Math.random() * 2); return s; };
  const filt = (node, type, f, q = 1) => { const b = A.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; node.connect(b); return b; };
  const mix = (node, v) => { const g = A.createGain(); g.gain.value = v; node.connect(g).connect(L.g); };
  if (kind === 'rumble') {
    mix(filt(src('brown'), 'lowpass', 260), 1.0);
    mix(filt(src('white'), 'bandpass', 950, 2), 0.12); // ray birleşimi takırtısı
  } else if (kind === 'buzz') {
    const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 100; o.start();
    mix(filt(o, 'lowpass', 520), 0.35);
    mix(filt(src('white'), 'highpass', 5200), 0.05); // tavandaki tel kıvılcımı
    mix(filt(src('brown'), 'lowpass', 300), 0.6); // tekerlekler
  } else if (kind === 'whoosh') {
    mix(filt(src('white'), 'bandpass', 700, 0.8), 0.5);
  } else { // motor
    const o = A.createOscillator(); o.type = 'triangle'; o.frequency.value = 52; o.start();
    mix(filt(o, 'lowpass', 300), 0.6);
    mix(filt(src('brown'), 'lowpass', 180), 0.5);
  }
  return L;
}
const LOOP_VOL = { rumble: 0.13, buzz: 0.05, whoosh: 0.07, motor: 0.04 };
// key: eğlence (aynı türden birden çok olabilir), kind: ses türü, at: yer, level: 0-1
export function loopLevel(key, kind, at, level) {
  if (!ready()) return;
  let L = LOOPS[key];
  if (!L || L.A !== A) { if (level <= 0.001) return; L = LOOPS[key] = makeLoop(kind); L.A = A; }
  const [k, pan] = heard(at, 6, 36), v = Math.max(0, level) * k * LOOP_VOL[kind];
  if (Math.abs(v - L.v) > 0.002 || (v === 0 && L.v !== 0)) { L.g.gain.setTargetAtTime(v, A.currentTime, 0.12); L.v = v; }
  if (L.pan) L.pan.pan.setTargetAtTime(pan, A.currentTime, 0.2);
}
