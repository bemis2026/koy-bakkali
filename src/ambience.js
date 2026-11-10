// Ortam sesleri: her bölgenin kendine özgü, kodla üretilen hafif arka planı. Bölgeler oyuncunun konumuna göre
// yumuşakça karışır (sınırın iki yanında 6 m geçiş, ~1,5 sn yumuşatma). Her katmanda sürekli bir zemin (rüzgar,
// kalabalık uğultusu, cırcır böceği, çeşme) ve ara sıra olaylar (kuş, koyun çanı, inek, araba geçişi, tezgah tıkırtısı).
// Kilitli bölge doğa sesi verir. Martı çığlıkları birds.js'teki görünen martılardan gelir. Ses ayarı: Ortam sesleri.
// Kuş cıvıltısı, tavuk, horoz, inek, köpek, kedi ve yaprak hışırtısı gerçek kayıt (hayvanses.js); geçen araba, korna, araç motorları ve bisiklet zili de (aracses.js).
import { G } from './game.js';
import { loadSound } from './sesyukle.js'; // eski Safari: .ogg yerine .m4a
import { ambienceBus } from './audio.js';
import { realBird, updateVoices } from './hayvanses.js';
import { havaW } from './hava.js';
import { realPass, realHorn, updateVehicles } from './aracses.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const FADE = 6;
let A = null, OUT = null;
const bufs = {};

// ---------- hazır döngüler (ilk gerektiğinde bir kez üretilir) ----------
function buf(name) {
  if (bufs[name]) return bufs[name];
  const sr = A.sampleRate, sec = { babble: 8, crickets: 4, bubbles: 4 }[name] || 6, n = Math.floor(sr * sec);
  const b = A.createBuffer(1, n, sr), d = b.getChannelData(0);
  if (name === 'white') for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  else if (name === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
  } else if (name === 'brown') {
    let l = 0;
    for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
  } else if (name === 'babble') {
    // uzak kalabalık: birkaç "ses", hece hece değişen formantlı gürültü + hafif vızıltı, aralarda duraklar
    for (let v = 0; v < 7; v++) {
      let i = Math.floor(Math.random() * sr * 0.6), y1 = 0, y2 = 0, x1 = 0, x2 = 0;
      const pitch = rnd(110, 240);
      while (i < n) {
        const syl = Math.floor(sr * rnd(0.09, 0.22)), f0 = rnd(350, 1150), q = rnd(3, 6), amp = rnd(0.4, 1);
        const w0 = (2 * Math.PI * f0) / sr, al = Math.sin(w0) / (2 * q), a0 = 1 + al;
        const c0 = al / a0, c2 = -al / a0, a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - al) / a0;
        for (let k = 0; k < syl && i < n; k++, i++) {
          const x = (Math.random() * 2 - 1) * 0.6 + (((i * pitch) / sr) % 1 < 0.5 ? 0.4 : -0.4);
          const y = c0 * x + c2 * x2 - a1 * y1 - a2 * y2;
          x2 = x1; x1 = x; y2 = y1; y1 = y;
          d[i] += y * Math.sin((Math.PI * k) / syl) * amp * 0.25;
        }
        if (Math.random() < 0.25) i += Math.floor(sr * rnd(0.2, 0.7));
      }
    }
  } else if (name === 'crickets') {
    // üç cırcır böceği, farklı perde ve hızda: her ötüş üç kısa vuruş
    for (const [f, rate, gv] of [[4300, 0.62, 1], [4700, 0.85, 0.7], [3900, 1.1, 0.5]]) {
      for (let t = Math.random() * rate; t < sec; t += rate * rnd(0.9, 1.1)) {
        for (let p = 0; p < 3; p++) {
          const s0 = Math.floor((t + p * 0.035) * sr), len = Math.floor(0.022 * sr);
          for (let k = 0; k < len && s0 + k < n; k++) d[s0 + k] += Math.sin((2 * Math.PI * f * k) / sr) * Math.sin((Math.PI * k) / len) * 0.3 * gv;
        }
      }
    }
  } else if (name === 'bubbles') {
    // çeşme: suya düşen damlaların kabarcıkları (perdesi yükselen kısa tonlar) ve hafif şırıltı
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.05;
    for (let k = 0; k < 170; k++) {
      const s0 = Math.floor(Math.random() * n), len = Math.floor(sr * rnd(0.015, 0.05)), f0 = rnd(500, 1600), a = rnd(0.1, 0.3);
      let ph = 0;
      for (let j = 0; j < len && s0 + j < n; j++) { ph += (2 * Math.PI * f0 * (1 + (1.5 * j) / len)) / sr; d[s0 + j] += Math.sin(ph) * Math.exp((-5 * j) / len) * a; }
    }
  }
  let m = 0;
  for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < n; i++) d[i] /= m * 1.1;
  return (bufs[name] = b);
}

// ---------- yardımcılar ----------
function loop(name, filters, vol, out) {
  const s = A.createBufferSource(); s.buffer = buf(name); s.loop = true;
  let node = s;
  const fs = filters.map(([type, f, q]) => { const b = A.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; node.connect(b); node = b; return b; });
  const g = A.createGain(); g.gain.value = vol; node.connect(g).connect(out);
  s.start(0, Math.random() * s.buffer.duration);
  return { g, fs };
}
function lfo(param, hz, depth) { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g).connect(param); o.start(A.currentTime + Math.random()); }
function outNode(v, pan) {
  const g = A.createGain(); g.gain.value = v;
  if (A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p).connect(OUT); } else g.connect(OUT);
  return g;
}
function voice(type, t, d, out, freq, gainEnv, filter) {
  const o = A.createOscillator(); o.type = type; freq(o.frequency);
  const g = A.createGain(); gainEnv(g.gain);
  let n = o;
  if (filter) { const f = A.createBiquadFilter(); f.type = filter[0]; f.frequency.value = filter[1]; f.Q.value = filter[2] || 1; if (filter[3]) filter[3](f.frequency); n.connect(f); n = f; }
  n.connect(g).connect(out); o.start(t); o.stop(t + d + 0.05);
  return o;
}
const env = (a, peak, hold, d) => (p) => { const t = p.t0; p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(peak, t + a); p.setValueAtTime(peak, t + hold); p.exponentialRampToValueAtTime(0.0001, t + d); };
const at = (t, f) => (p) => { p.t0 = t; f(p); };

// ---------- olaylar: (t, ses, sağ-sol) ----------
function birdsong(t, v, pan) {
  if (havaW() > 0.4) return; // yağmurda, karda kuşlar susar (hava.js)
  if (realBird(t, v, pan)) return; // gerçek kuş kaydı (hayvanses.js); yüklenene dek kodla
  const o = outNode(v, pan), kind = Math.floor(Math.random() * 3), base = rnd(2400, 4200);
  const n = kind === 0 ? 6 + Math.floor(Math.random() * 6) : 2 + Math.floor(Math.random() * 4);
  let tt = t;
  for (let i = 0; i < n; i++) {
    const d = kind === 0 ? rnd(0.035, 0.06) : rnd(0.08, 0.18);
    const f0 = kind === 2 ? base * rnd(1.1, 1.3) : base * rnd(0.9, 1.1), f1 = kind === 2 ? base * 0.7 : kind === 1 ? base * rnd(1.15, 1.4) : f0 * 1.05;
    voice('sine', tt, d, o, (p) => { p.setValueAtTime(f0, tt); p.exponentialRampToValueAtTime(f1, tt + d); }, at(tt, env(d * 0.25, 1, d * 0.3, d)));
    tt += d + (kind === 0 ? rnd(0.02, 0.04) : rnd(0.05, 0.14));
  }
}
export function gullCall(v, pan) {
  if (!ready()) return;
  const t = A.currentTime + 0.02, o = outNode(v, pan), n = 1 + Math.floor(Math.random() * 4), f = rnd(1150, 1450);
  for (let k = 0; k < n; k++) {
    const t0 = t + k * rnd(0.2, 0.3), d = k === 0 && Math.random() < 0.6 ? 0.42 : rnd(0.13, 0.18), ff = f * (1 - k * 0.03);
    const osc = voice('sawtooth', t0, d, o, (p) => { p.setValueAtTime(ff * 0.72, t0); p.linearRampToValueAtTime(ff, t0 + d * 0.25); p.exponentialRampToValueAtTime(ff * 0.62, t0 + d); },
      at(t0, env(0.03, 0.9, d * 0.6, d)), ['bandpass', ff * 1.4, 2.2]);
    const vib = A.createOscillator(), vg = A.createGain(); vib.frequency.value = 28; vg.gain.value = ff * 0.025;
    vib.connect(vg).connect(osc.frequency); vib.start(t0); vib.stop(t0 + d + 0.05);
  }
}
function bell(t, v, pan) {
  const o = outNode(v, pan), n = 1 + Math.floor(Math.random() * 3), f = rnd(1500, 2300);
  for (let k = 0; k < n; k++) {
    const t0 = t + k * rnd(0.12, 0.3), d = rnd(0.5, 0.9), fc = f * rnd(0.97, 1.03);
    const c = voice('sine', t0, d, o, (p) => p.setValueAtTime(fc, t0), at(t0, env(0.005, 0.6, 0.01, d)));
    const m = A.createOscillator(), mg = A.createGain(); m.frequency.value = fc * 1.41;
    mg.gain.setValueAtTime(fc * 1.2, t0); mg.gain.exponentialRampToValueAtTime(1, t0 + d);
    m.connect(mg).connect(c.frequency); m.start(t0); m.stop(t0 + d + 0.05);
  }
}
function baa(t, v, pan) {
  const o = outNode(v, pan), d = rnd(0.55, 0.9), f = rnd(250, 330);
  const osc = A.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f, t); osc.frequency.linearRampToValueAtTime(f * 0.9, t + d);
  const am = A.createGain(); am.gain.value = 0.55; lfoOnce(am.gain, rnd(18, 24), 0.45, t, d);
  const amp = A.createGain(); amp.gain.t0 = t; env(0.06, 0.7, d * 0.7, d)(amp.gain);
  osc.connect(am);
  for (const [f1, q] of [[950, 3], [2500, 4]]) { const b = A.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f1; b.Q.value = q; am.connect(b).connect(amp); }
  amp.connect(o); osc.start(t); osc.stop(t + d + 0.05);
}
function lfoOnce(param, hz, depth, t, d) { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g).connect(param); o.start(t); o.stop(t + d + 0.05); }
function camel(t, v, pan) {
  const d = rnd(0.7, 1.1), f = rnd(62, 80), o = outNode(v, pan);
  const osc = voice('sawtooth', t, d, o, (p) => { p.setValueAtTime(f, t); p.linearRampToValueAtTime(f * 0.8, t + d); }, at(t, env(0.08, 0.9, d * 0.6, d)), ['lowpass', 520, 2]);
  const am = A.createOscillator(), ag = A.createGain(); am.frequency.value = 9; ag.gain.value = f * 0.15; am.connect(ag).connect(osc.frequency); am.start(t); am.stop(t + d + 0.05);
}
function crow(t, v, pan) {
  const o = outNode(v, pan), n = 2 + Math.floor(Math.random() * 2);
  for (let k = 0; k < n; k++) { const t0 = t + k * rnd(0.32, 0.42), d = 0.22, f = rnd(480, 560); voice('sawtooth', t0, d, o, (p) => { p.setValueAtTime(f, t0); p.linearRampToValueAtTime(f * 0.82, t0 + d); }, at(t0, env(0.02, 0.8, d * 0.5, d)), ['bandpass', 1100, 1.6]); }
}
function creak(t, v, pan) {
  const d = rnd(0.7, 1.0), f = rnd(78, 95);
  const osc = voice('sawtooth', t, d, outNode(v, pan), (p) => { p.setValueAtTime(f, t); p.linearRampToValueAtTime(f * 1.15, t + d); }, at(t, env(0.1, 0.7, d * 0.7, d)), ['bandpass', 650, 5]);
  const j = A.createOscillator(), jg = A.createGain(); j.type = 'square'; j.frequency.value = 31; jg.gain.value = f * 0.2; j.connect(jg).connect(osc.frequency); j.start(t); j.stop(t + d + 0.05);
}
function clink(t, v, pan) {
  const o = outNode(v, pan), n = 2 + Math.floor(Math.random() * 2);
  for (let k = 0; k < n; k++) { const t0 = t + k * rnd(0.06, 0.12), f = rnd(2600, 4200); voice('sine', t0, 0.14, o, (p) => p.setValueAtTime(f, t0), at(t0, env(0.003, 0.5, 0.005, 0.14))); }
}
function carPass(t, v, pan) {
  if (realPass(t, v, pan)) return; // gerçek geçen araba kaydı (aracses.js); yüklenene dek kodla
  const d = rnd(2.6, 3.6), dir = Math.random() < 0.5 ? -1 : 1;
  const s = A.createBufferSource(); s.buffer = buf('brown');
  const f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(250, t); f.frequency.linearRampToValueAtTime(950, t + d / 2); f.frequency.linearRampToValueAtTime(250, t + d);
  const g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 1.4, t + d / 2); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(g);
  if (A.createStereoPanner) { const p = A.createStereoPanner(); p.pan.setValueAtTime(-0.85 * dir, t); p.pan.linearRampToValueAtTime(0.85 * dir, t + d); g.connect(p).connect(OUT); } else g.connect(OUT);
  s.start(t, Math.random() * 3); s.stop(t + d + 0.05);
}
function horn(t, v, pan) { if (realHorn(t, v, pan)) return; const o = outNode(v, pan); for (const [f, dl] of [[330, 0], [392, 0.02]]) voice('square', t + dl, 0.3, o, (p) => p.setValueAtTime(f, t), at(t + dl, env(0.01, 0.35, 0.22, 0.3)), ['lowpass', 1400, 1]); }
function loom(t, v, pan) {
  const o = outNode(v, pan);
  for (const [dt, k] of [[0, 1], [0.24, 0.6]]) {
    const t0 = t + dt;
    voice('sine', t0, 0.07, o, (p) => { p.setValueAtTime(190, t0); p.exponentialRampToValueAtTime(120, t0 + 0.07); }, at(t0, env(0.002, 0.9 * k, 0.004, 0.07)));
    const s = A.createBufferSource(); s.buffer = buf('white');
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(750, 950); f.Q.value = 3;
    const g = A.createGain(); g.gain.setValueAtTime(0.7 * k, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    s.connect(f).connect(g).connect(o); s.start(t0, Math.random()); s.stop(t0 + 0.07);
  }
}
// tatil köyü: verandada rüzgar çanı (tiz, yumuşak, art arda birkaç tını)
function chimes(t, v, pan) {
  const o = outNode(v, pan), base = [1568, 1760, 2093, 2349, 2637];
  for (let k = 0, n = 3 + Math.floor(Math.random() * 4); k < n; k++) { const t0 = t + k * rnd(0.12, 0.35), f = base[Math.floor(Math.random() * base.length)], d = rnd(1.2, 2); voice('sine', t0, d, o, (p) => p.setValueAtTime(f, t0), at(t0, env(0.004, 0.5, 0.01, d))); }
}
function beep(t, v, pan) { const o = outNode(v, pan); for (const dt of [0, 0.16]) voice('sine', t + dt, 0.08, o, (p) => p.setValueAtTime(1800, t), at(t + dt, env(0.004, 0.5, 0.05, 0.08))); }
// başın üstünden geçen sürü: kanat pırpırı ve birkaç cıvıltı
export function flockSound(v, pan) {
  if (!ready()) return;
  const t = A.currentTime + 0.02, o = outNode(v, pan);
  for (let k = 0; k < 10; k++) {
    const t0 = t + k * rnd(0.06, 0.11), s = A.createBufferSource(); s.buffer = buf('white');
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(700, 1400); f.Q.value = 1.2;
    const g = A.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    s.connect(f).connect(g).connect(o); s.start(t0, Math.random() * 2); s.stop(t0 + 0.08);
  }
  birdsong(t + 0.3, v * 0.8, pan); if (Math.random() < 0.6) birdsong(t + 0.9, v * 0.6, pan * 0.6);
}

// ---------- pazar: gerçek insan sesleri ----------
// Kodla üretilen uğultu pazar gibi duyulmuyordu. Oyunun kayıtlı insan seslerinden (assets/voice) kalabalık
// uğultusu karılır: onlarca cümle farklı hızlarda üst üste, kısık ve boğuk. Üstüne ara sıra uzaktan satıcı
// bağırışı, poşet hışırtısı, kasa tıkırtısı ve bozuk para şıngırtısı. 2026-11-01 kullanıcı: pazarda çok konuşma var, sesler tekrar ediyor.
// Uğultu 12 sn yerine 30 sn'de bir döner, içinde bağırış yok, daha kısık ve boğuk (sözler seçilmez); satıcı 14-30 sn'de bir bağırır, aynı
// bağırış art arda gelmez
let voices = null, loadingV = false;
function loadVoices() {
  if (voices || loadingV) return;
  loadingV = true;
  fetch('assets/voice/list.json').then((r) => r.json()).then(async (names) => {
    const out = { shout: [], talk: [] };
    await Promise.all(names.filter((n) => n.startsWith('a_')).map((n) => fetch(`assets/voice/${n}.mp3`).then((r) => r.arrayBuffer())
      .then((b) => A.decodeAudioData(b)).then((b) => (n.includes('shout') ? out.shout : out.talk).push(b)).catch(() => {})));
    voices = out;
  }).catch(() => { loadingV = false; });
}
function crowdBuf() {
  if (bufs.crowd) return bufs.crowd;
  if (!voices || voices.talk.length + voices.shout.length < 4) return null;
  const sr = A.sampleRate, n = sr * 30, b = A.createBuffer(1, n, sr), d = b.getChannelData(0), all = voices.talk.length >= 4 ? voices.talk : [...voices.talk, ...voices.shout];
  for (let k = 0; k < 64; k++) {
    const s = all[Math.floor(Math.random() * all.length)].getChannelData(0), rate = rnd(0.82, 1.15), len = Math.floor(s.length / rate);
    const start = Math.floor(Math.random() * n), g = rnd(0.2, 0.65);
    for (let i = 0; i < len; i++) { const j = i * rate, j0 = j | 0, v = s[j0] + ((s[j0 + 1] ?? s[j0]) - s[j0]) * (j - j0); d[(start + i) % n] += v * g; } // başa sarar: döngü dikişsiz
  }
  let m = 0;
  for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < n; i++) d[i] /= m * 1.1;
  return (bufs.crowd = b);
}
function crowdInto(out, vol) {
  loadVoices();
  const go = () => {
    const b = crowdBuf();
    if (!b) { setTimeout(go, 600); return; }
    const s = A.createBufferSource(); s.buffer = b; s.loop = true;
    const hp = A.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 170;
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const g = A.createGain(); g.gain.value = vol;
    s.connect(hp).connect(lp).connect(g).connect(out);
    s.start(0, rnd(0, 30));
    lfo(g.gain, 0.07, vol * 0.25); // kalabalık dalga dalga
  };
  go();
}
window.__amb = () => ({ voices: voices && [voices.talk.length, voices.shout.length], crowd: bufs.crowd ? Math.round(bufs.crowd.duration) : 0, vendor: vendN }); // test kancası
let vendLast = -1, vendN = 0;
function vendor(t, v, pan) {
  if (!voices || !voices.shout.length) return;
  const n = voices.shout.length;
  let i = Math.floor(Math.random() * n);
  if (n > 1 && i === vendLast) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
  vendLast = i; vendN++;
  const s = A.createBufferSource(); s.buffer = voices.shout[i];
  s.playbackRate.value = rnd(0.94, 1.06);
  const f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = rnd(1800, 3000);
  s.connect(f).connect(outNode(v, pan)); s.start(t);
}
function rustle(t, v, pan) {
  const o = outNode(v, pan);
  for (let k = 0, n = 4 + Math.floor(Math.random() * 5); k < n; k++) {
    const t0 = t + k * rnd(0.03, 0.09), s = A.createBufferSource(); s.buffer = buf('white');
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = rnd(2500, 5500); f.Q.value = 0.8;
    const g = A.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(rnd(0.3, 0.7), t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + rnd(0.03, 0.07));
    s.connect(f).connect(g).connect(o); s.start(t0, Math.random() * 3); s.stop(t0 + 0.1);
  }
}
function thump(t, v, pan) { voice('sine', t, 0.16, outNode(v, pan), (p) => { p.setValueAtTime(115, t); p.exponentialRampToValueAtTime(55, t + 0.16); }, at(t, env(0.004, 0.9, 0.01, 0.16))); }
// at ahırı: kişneme, burun horultusu, nal tıkırtısı
// Kişneme gerçek kayıt (2026-11-04 kullanıcı: "At kişneme sesi çok kötü daha gerçekçi bir ses olsun"; eskiden kodla üretilen titreşimli
// testere sesiydi): assets/sfx/at_kisneme.ogg, aygır kişnemesi, Lemasson ve ark. 2015, PLOS ONE, CC BY 4.0 (Wikimedia Commons; kredisi
// menu.js ve final.js). İlk kişnemede bir kez yüklenir; 0,55-3,15 sn arası çalar (öndeki sessizlik atlanır, sondaki burun üflemesi kalır),
// perdesi her seferinde biraz oynar. Ortalama gücü eski sesle aynı (ölçüm: eski 0,13, kayıt 0,16 RMS; çarpan 0,7)
let neighBuf = null, neighLoad = false;
function neigh(t, v, pan) {
  if (!neighBuf) {
    if (!neighLoad) { neighLoad = true; loadSound(A, 'assets/sfx/at_kisneme.ogg').then((b) => { neighBuf = b; neigh(A.currentTime + 0.02, v, pan); }).catch(() => { neighLoad = false; }); }
    return;
  }
  const s = A.createBufferSource(), g = A.createGain(); s.buffer = neighBuf; s.playbackRate.value = rnd(0.92, 1.06); g.gain.value = 0.7;
  s.connect(g).connect(outNode(v, pan)); s.start(t, 0.55, 2.6);
}
function snort(t, v, pan) {
  const o = outNode(v, pan);
  for (let k = 0, n = 1 + Math.floor(Math.random() * 2); k < n; k++) {
    const t0 = t + k * rnd(0.18, 0.3), d = rnd(0.18, 0.3), s = A.createBufferSource(); s.buffer = buf('white');
    const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(rnd(600, 900), t0); f.frequency.linearRampToValueAtTime(rnd(250, 400), t0 + d); f.Q.value = 1.4;
    const g = A.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(f).connect(g).connect(o); s.start(t0, Math.random() * 3); s.stop(t0 + d + 0.05);
  }
}
function clops(t, v, pan) {
  const o = outNode(v, pan);
  for (let k = 0, n = 4 + Math.floor(Math.random() * 5); k < n; k++) {
    const t0 = t + k * 0.21 + (k % 2) * 0.05, f = k % 2 ? 640 : 820;
    voice('triangle', t0, 0.05, o, (p) => { p.setValueAtTime(f, t0); p.exponentialRampToValueAtTime(f * 0.6, t0 + 0.05); }, at(t0, env(0.002, 0.8, 0.004, 0.05)), ['bandpass', 1200, 2]);
  }
}
// havuz: suya atlayan, su sıçratan çocuklar (kısa gürültü patlaması ve damlalar)
function splash(t, v, pan) {
  const o = outNode(v, pan), s = A.createBufferSource(); s.buffer = buf('white');
  const f = A.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.6);
  const g = A.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  s.connect(f).connect(g).connect(o); s.start(t, Math.random() * 3); s.stop(t + 0.75);
  for (let k = 0; k < 6; k++) { const t0 = t + 0.2 + Math.random() * 0.6, f0 = rnd(700, 1600); voice('sine', t0, 0.05, o, (p) => { p.setValueAtTime(f0, t0); p.exponentialRampToValueAtTime(f0 * 1.6, t0 + 0.05); }, at(t0, env(0.004, 0.35, 0.005, 0.05))); }
}
// civciv cikcikleri: tiz, aşağı kayan kısa ötüşler
// eğlenceden uzak sevinç çığlıkları: iki üç ses "hiii" diye yükselip iner (lunapark)
function whee(t, v, pan) {
  const o = outNode(v, pan);
  for (let k = 0, n = 2 + Math.floor(Math.random() * 2); k < n; k++) {
    const t0 = t + rnd(0, 0.25), f0 = rnd(480, 720), d = rnd(0.7, 1.1);
    voice('sawtooth', t0, d, o, (p) => { p.setValueAtTime(f0, t0); p.exponentialRampToValueAtTime(f0 * 1.7, t0 + d * 0.35); p.exponentialRampToValueAtTime(f0 * 1.15, t0 + d); }, at(t0, env(0.06, 0.3, d * 0.5, d)), ['bandpass', 1300, 2.5]);
  }
}
function cheep(t, v, pan) {
  const o = outNode(v, pan);
  for (let k = 0, n = 2 + Math.floor(Math.random() * 4); k < n; k++) { const t0 = t + k * rnd(0.09, 0.16), f = rnd(3600, 4600), d = rnd(0.05, 0.08); voice('sine', t0, d, o, (p) => { p.setValueAtTime(f, t0); p.exponentialRampToValueAtTime(f * 0.75, t0 + d); }, at(t0, env(0.005, 0.7, d * 0.4, d))); }
}

// ---------- zeminler ----------
function breeze(vol, out) { const b = loop('brown', [['lowpass', 450]], vol, out); lfo(b.g.gain, 0.05, vol * 0.5); }
const BEDS = {
  koy: (o) => { breeze(0.065, o); },
  tatil: (o) => { loop('pink', [['highpass', 300], ['lowpass', 1200]], 0.025, o); breeze(0.03, o); },
  pazar: (o) => { crowdInto(o, 0.13); loop('pink', [['lowpass', 500]], 0.025, o); },
  sahil: (o) => { loop('pink', [['highpass', 300], ['lowpass', 1200]], 0.025, o); },
  han: (o) => { const w = loop('pink', [['bandpass', 650, 1.6]], 0.08, o); lfo(w.fs[0].frequency, 0.07, 380); lfo(w.g.gain, 0.045, 0.035); },
  kasaba: (o) => { breeze(0.05, o); loop('babble', [['lowpass', 700]], 0.02, o); },
  fiskiye: (o) => { loop('bubbles', [['highpass', 300]], 0.11, o); loop('white', [['bandpass', 2600, 0.5]], 0.035, o); },
  cesme: (o) => { loop('bubbles', [['highpass', 350]], 0.09, o); loop('white', [['bandpass', 3000, 0.6]], 0.025, o); },
  tarla: (o) => { loop('crickets', [['highpass', 3000]], 0.05, o); const r = loop('white', [['bandpass', 2500, 0.5]], 0.025, o); lfo(r.g.gain, 0.15, 0.015); },
  mera: (o) => { breeze(0.045, o); },
  ciftlik: (o) => { breeze(0.04, o); },
  tarlalar: (o) => { breeze(0.065, o); const r = loop('white', [['bandpass', 1800, 0.4]], 0.02, o); lfo(r.g.gain, 0.12, 0.012); }, // açık tarlada rüzgâr, ekin hışırtısı
  iskele: (o) => { const w = loop('pink', [['lowpass', 520]], 0.05, o); lfo(w.g.gain, 0.18, 0.03); breeze(0.04, o); }, // iskele kazıklarına vuran su
  meydan: (o) => { loop('brown', [['lowpass', 220]], 0.06, o); },
  atolye: (o) => { loop('babble', [['lowpass', 900]], 0.045, o); },
  atlar: (o) => { breeze(0.04, o); loop('pink', [['lowpass', 400]], 0.015, o); },
  ipek: (o) => { const w = loop('pink', [['bandpass', 520, 1.4]], 0.05, o); lfo(w.fs[0].frequency, 0.06, 260); lfo(w.g.gain, 0.04, 0.02); breeze(0.03, o); }, // bozkır rüzgarı, uzaktan deve çanı
  firin: (o) => { breeze(0.04, o); const f = loop('brown', [['lowpass', 300]], 0.03, o); lfo(f.g.gain, 0.3, 0.012); }, // fırın gürlemesi
  enerji: (o) => { breeze(0.08, o); const s = A.createOscillator(); s.frequency.value = 100; const g = A.createGain(); g.gain.value = 0.008; s.connect(g).connect(o); s.start(); }, // açıkta rüzgâr, trafo uğultusu
  benzin: (o) => { for (const [f, v] of [[100, 0.012], [200, 0.006]]) { const s = A.createOscillator(); s.frequency.value = f; const g = A.createGain(); g.gain.value = v; s.connect(g).connect(o); s.start(); } breeze(0.03, o); },
  sehir: (o) => { const t = loop('brown', [['lowpass', 260]], 0.06, o); lfo(t.g.gain, 0.08, 0.02); loop('babble', [['lowpass', 800]], 0.03, o); }, // cadde uğultusu, kalabalık
  lunapark: (o) => { crowdInto(o, 0.12); loop('babble', [['lowpass', 900]], 0.03, o); breeze(0.025, o); }, // kalabalık; org calgi.js'ten
  doga: (o) => { breeze(0.06, o); },
};
const unlocked = (id) => () => !!(G.regions[id] && G.regions[id].unlocked);
// bölge genişleyince arsası bölgenin ortam sesine katılır (expand.js)
G.hooks.ambRect = (id, rect) => { const L = LAYERS.find((l) => l.id === id); if (L) L.rects.push(rect); };
// rects: [minX, maxX, minZ, maxZ]; ev: [olay, ses, en az sn, en çok sn]
// traktörün yeri: farmland.js her karede bu dikdörtgeni traktörün üstüne taşır (motor sesi artık traktörün kendisinden, aracses.js)
export const TRACTOR = [[0, 0, -999, -999]];
const LAYERS = [
  { id: 'koy', rects: [[-16, 16, -14, 12]], on: () => true, ev: [[birdsong, 0.065, 2, 5.5]] },
  { id: 'tatil', rects: [[67, 105, 9.4, 31]], on: unlocked('tatil'), ev: [[chimes, 0.03, 4, 9], [birdsong, 0.035, 6, 12], [splash, 0.03, 6, 13]] },
  { id: 'pazar', rects: [[23, 53, -14, 12], [53, 79, 3.5, 9.5]], on: unlocked('pazar'), ev: [[vendor, 0.06, 14, 30], [rustle, 0.035, 3, 7], [thump, 0.05, 5, 12], [clink, 0.035, 4, 9]] },
  { id: 'sahil', rects: [[-16, 53, 12, 32]], on: unlocked('sahil'), ev: [] },
  { id: 'han', rects: [[-16, 16, -60, -28]], on: unlocked('han'), ev: [[camel, 0.05, 14, 28]] },
  { id: 'cesme', rects: [[-1, 1, -45, -43]], fade: 11, on: unlocked('han'), ev: [], addOn: true },
  { id: 'fiskiye', rects: [[-46.3, -44.7, -31.4, -29.8]], fade: 11, on: unlocked('kasaba'), ev: [], addOn: true }, // kasaba meydanının fıskiyesi
  { id: 'kasaba', rects: [[-57, -34.5, -50, -23.2]], on: unlocked('kasaba'), ev: [[birdsong, 0.07, 1.5, 4], [chimes, 0.015, 14, 26]] }, // park: bol kuş, uzaktan çan
  { id: 'tarla', rects: [[-35, -23, -4, 8.6]], on: unlocked('tarla'), ev: [[crow, 0.035, 10, 22]] },
  { id: 'mera', rects: [[-45, -23, 12.5, 28.5]], on: unlocked('mera'), ev: [[bell, 0.035, 1.5, 4], [baa, 0.05, 6, 14]] },
  { id: 'iskele', rects: [[-40, -24, 30.6, 44]], on: unlocked('iskele'), ev: [[(t, v, pan) => gullCall(v, pan), 0.05, 4, 9], [creak, 0.03, 5, 11], [splash, 0.03, 6, 12]] },
  { id: 'tarlalar', rects: [[16.4, 53, -68, -40]], on: unlocked('tarlalar'), ev: [[crow, 0.035, 9, 20], [birdsong, 0.04, 4, 9]] },
  { id: 'ciftlik', rects: [[23, 53, -40, -14]], on: unlocked('ciftlik'), ev: [[cheep, 0.03, 2.5, 6], [creak, 0.025, 6, 11], [birdsong, 0.04, 5, 10]] }, // tavuk, horoz ve inek sesi gerçek kayıttan, hayvanların kendisinden (hayvanses.js)
  // otopark kasabanın batısında (2026-11-01), eski yerinde paket servis cebi kaldı
  { id: 'meydan', rects: [[-87, -68, -35.6, -21.9], [-39, -23, -16, -4.2], [-97, -16, -23, -14.5]], on: unlocked('meydan'), ev: [[carPass, 0.05, 7, 15], [horn, 0.02, 30, 60]] },
  { id: 'atolye', rects: [[-56, -45, 12.6, 25.6]], on: unlocked('atolye'), ev: [[loom, 0.035, 0.9, 1.4]] },
  { id: 'atlar', rects: [[-59.4, -35.6, -3.6, 8.4]], on: unlocked('atlar'), ev: [[neigh, 0.05, 9, 18], [snort, 0.04, 5, 10], [clops, 0.03, 6, 13], [birdsong, 0.03, 6, 12]] },
  { id: 'ipek', rects: [[-34, -28, -140, -21], [-34, -16, -35, -30]], on: () => true, ev: [[bell, 0.03, 4, 9], [camel, 0.035, 14, 28]] },
  { id: 'firin', rects: [[-23, 11, -27.8, -20.6]], on: unlocked('firin'), ev: [[thump, 0.04, 4, 9], [clink, 0.03, 5, 11], [birdsong, 0.035, 5, 10]] },
  { id: 'enerji', rects: [[-84, -63.6, -66.4, -59.8]], on: unlocked('enerji'), ev: [[creak, 0.02, 7, 15], [beep, 0.012, 14, 28]] },
  { id: 'sehir', rects: [[413, 447, -12, 10], [400, 460, 10, 21]], on: unlocked('sehir'), ev: [[carPass, 0.05, 6, 13], [horn, 0.02, 20, 45], [beep, 0.02, 4, 9], [chimes, 0.015, 12, 24]] }, // Şehir Marketi ve caddesi: trafik, korna, kasa bipi, kapı zili
  { id: 'lunapark', rects: [[73, 113, -56, 1.5]], on: unlocked('lunapark'), ev: [[whee, 0.05, 6, 14], [thump, 0.035, 3, 8], [chimes, 0.02, 10, 20], [clink, 0.02, 5, 10]] }, // lunapark.js LP_RECT: kalabalık, çığlıklar, çarpışan arabalar, zil
  { id: 'benzin', rects: [[-85, -62, -15, -1.5]], on: () => !!G.stationOpen, ev: [[carPass, 0.04, 10, 20], [beep, 0.015, 12, 25]] },
];
const NATURE = { id: 'doga', ev: [[birdsong, 0.045, 2, 6]] };

function rectW(r, x, z, fade) {
  const dx = Math.max(r[0] - x, 0, x - r[1]), dz = Math.max(r[2] - z, 0, z - r[3]);
  return Math.max(0, 1 - Math.hypot(dx, dz) / fade);
}
function ready() {
  const bus = ambienceBus();
  if (!bus) return false;
  A = bus.A; OUT = bus.out;
  return true;
}
function setup(L) {
  L.g = A.createGain(); L.g.gain.value = 0; L.g.connect(OUT);
  BEDS[L.id](L.g);
  L.w = 0; L.t = L.ev.map(([, , a, b]) => rnd(a, b) * 0.5);
}

export function updateAmbience(dt) {
  if (!ready() || A.state !== 'running') return;
  updateVoices(dt);
  updateVehicles(dt);
  const p = G.player.position;
  let sum = 0;
  for (const L of LAYERS) {
    let w = 0;
    if (L.on()) for (const r of L.rects) w = Math.max(w, rectW(r, p.x, p.z, L.fade || FADE));
    L.raw = w;
    if (!L.addOn) sum += w; // çeşme ve fıskiye bölgenin üstüne eklenir, doğa payını azaltmaz
  }
  NATURE.raw = Math.max(0, 1 - sum);
  const norm = Math.max(1, sum);
  for (const L of [...LAYERS, NATURE]) {
    const w = L.addOn ? L.raw : L.raw / norm;
    if (!L.g) { if (w < 0.01) continue; setup(L); }
    if (Math.abs(w - L.w) > 0.01) { L.g.gain.setTargetAtTime(w, A.currentTime, 1.5); L.w = w; }
    if (L.w < 0.05) continue;
    L.ev.forEach(([fn, v, a, b], i) => {
      L.t[i] -= dt;
      if (L.t[i] > 0) return;
      L.t[i] = rnd(a, b);
      fn(A.currentTime + 0.02, v * L.w, rnd(-0.7, 0.7));
    });
  }
}
