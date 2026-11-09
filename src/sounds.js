// Kodla üretilen, kullanıcının dinleyip seçtiği sesler: ürün al/koy, para topla (yazar kasa), para öde (para sayma)
// Her tarif (ac, out, t, i): AudioContext, çıkış düğümü, başlama zamanı, art arda kaçıncı tekrar (perde merdiveni için)

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const hz = (base, semi) => base * Math.pow(2, semi / 12);
let noiseBuf = null;
function noise(ac) {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function tone(ac, out, t, f, dur, v, type = 'sine', attack = 0.004) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}
function burst(ac, out, t, dur, v, type, freq) {
  const s = ac.createBufferSource(); s.buffer = noise(ac);
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(out);
  s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
}
// çarpılan metal çan: uyumsuz kısmi tonlar, her biri kendi hızında söner
function ring(ac, out, t, f, v, len = 1) {
  for (const [r, d, g] of [[1, 0.34, 1], [2.08, 0.2, 0.5], [3.39, 0.12, 0.3], [4.86, 0.07, 0.16]]) tone(ac, out, t, f * r, d * len, v * g, 'sine', 0.0015);
}

// ürün al/koy · ksilofon merdiveni: art arda alınca nota nota yükselir
export const ITEM = {
  merdiven(ac, out, t, i = 0) {
    const f = hz(262, PENTA[Math.min(i, PENTA.length - 1)]);
    tone(ac, out, t, f, 0.22, 0.24, 'triangle');
    tone(ac, out, t, f * 2, 0.1, 0.06);
  },
};

export const PAPER = {
  // para sayma: üç banknot parmakla "fırrt" diye sayılır (kilit alanına öderken)
  sayma(ac, out, t) {
    for (let k = 0; k < 3; k++) {
      const tt = t + k * 0.055;
      burst(ac, out, tt, 0.03, 0.2 - k * 0.03, 'highpass', 1800);
      tone(ac, out, tt, 170, 0.035, 0.07);
    }
  },
  // yazar kasa: mekanik "ka" ve ardından çan "çiiing" (para yığınını toplarken)
  kasa(ac, out, t) {
    burst(ac, out, t, 0.05, 0.25, 'lowpass', 700);
    tone(ac, out, t, 120, 0.07, 0.15);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.connect(out);
    ring(ac, lp, t + 0.07, 2100, 0.1, 1.6);
    ring(ac, lp, t + 0.1, 2650, 0.07, 1.4);
  },
};
