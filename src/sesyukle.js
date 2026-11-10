// Örnek seslerin yüklenmesi (2026-11-11). Sesler .ogg (Vorbis); eski Safari (iOS 16 - 18.3) Ogg çözemez, iPhone'da tık, kasa,
// hayvan ve yağmur sesleri sessiz kalıyordu. Ogg'u tanımayan tarayıcıya aynı adın .m4a (AAC) kopyası verilir
// (KoyBakkali-araclar/ses_m4a.py üretir); tanıdığını söyleyip çözemeyen tarayıcıda da bir kez .m4a denenir.
let noOgg = null;
const oggOk = () => {
  if (noOgg === null) { try { noOgg = !new Audio().canPlayType('audio/ogg; codecs="vorbis"'); } catch (e) { noOgg = false; } }
  return !noOgg;
};
const get = (A, u) => fetch(u).then((r) => { if (!r.ok) throw new Error('ses ' + r.status); return r.arrayBuffer(); }).then((b) => A.decodeAudioData(b));
export function loadSound(A, url) {
  if (!/\.ogg$/.test(url)) return get(A, url);
  const m4a = url.replace(/\.ogg$/, '.m4a');
  return oggOk() ? get(A, url).catch(() => get(A, m4a)) : get(A, m4a);
}
