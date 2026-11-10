// Ses: Kenney örnekleri (CC0) + bölgeye göre değişen, kodla üretilen arka plan müziği
import { ITEM, PAPER } from './sounds.js';
import { loadSound } from './sesyukle.js'; // eski Safari: .ogg yerine .m4a
import { EN } from './dil.js';

const SETS = {
  put: ['drop_001', 'drop_002', 'drop_003'],
  cash: ['chips-stack-1', 'chips-stack-2', 'chips-stack-3'],
  click: ['click_002', 'click_003'],
  open: ['maximize_003'], close: ['minimize_003'],
  buy: ['confirmation_002'], error: ['error_004'], toggle: ['toggle_002'],
  happy: ['select_004', 'select_006'], bad: ['back_002'],
  unlock: ['jingles_PIZZI01', 'jingles_PIZZI04', 'jingles_PIZZI07'],
  region: ['jingles_STEEL02'], caravan: ['jingles_SAX03'], boost: ['jingles_STEEL05'], hire: ['jingles_PIZZI10'],
  finale: ['jingles_SAX06'], bong: ['bong_001'], tick: ['tick_002'], glass: ['glass_002'], chips: ['chips-handle-1', 'chips-handle-2'],
};
// kullanıcının dinleyip seçtiği, kodla üretilen sesler (src/sounds.js): ürün al/koy, para topla, para öde
const RECIPES = { pick: ITEM.merdiven, coin: PAPER.kasa, pay: PAPER.sayma };
let combo = 0, comboT = 0;
// az ama anlamlı ses: tekrarlayan sesler seyrek (ms), olumlu anlar belirgin, olumsuzlar kısık
const GAP = { pick: 80, coin: 1100, pay: 420, cash: 320, happy: 1800, bad: 5000, error: 1500, put: 120 };
const VOL = { finale: 0.85, pick: 0.6, put: 0.35, coin: 0.65, pay: 0.55, cash: 0.42, click: 0.35, unlock: 0.8, region: 0.8, caravan: 0.75, boost: 0.8, hire: 0.75, happy: 0.32, bad: 0.2, error: 0.3, tick: 0.3 };
// oyuncunun doğrudan yaptığı ya da ödül sesleri her zaman çalar; geri kalanı saniyede en fazla 3 tane
const PRIORITY = new Set(['finale', 'level', 'pick', 'click', 'open', 'close', 'toggle', 'buy', 'unlock', 'region', 'caravan', 'boost', 'hire', 'shout']);
// büyük ödül anlarında müzik bir an biraz kısılır, kutlama net duyulur (2026-11-03: %18'e iniyordu, müzik kesiliyor gibiydi; artık %60)
const REWARD = new Set(['finale', 'level', 'unlock', 'region', 'caravan', 'boost', 'hire']);
let recent = [], rewardUntil = 0, voiceUntil = 0;

let AC = null, sfxGain = null, musicGain = null, worldGain = null;
const buffers = {};
const last = {};
export const settings = { sfx: true, music: true, voice: true, amb: true, theme: 'bahar', sfxVol: 1, musicVol: 1, voiceVol: 1, ambVol: 1, quality: 'yuksek' };
// telefonda ilk açılış orta kalite; belleği 4 GB ve altı ucuz telefonda Performans (dusuk). mobQ: main.js bunu yeniden ortaya çekmesin
try { const s = JSON.parse(localStorage.getItem('koyBakkali.settings') || '{}'); Object.assign(settings, s); if (!s.quality && matchMedia('(pointer: coarse)').matches) { settings.quality = navigator.deviceMemory && navigator.deviceMemory <= 4 ? 'dusuk' : 'orta'; settings.mobQ = 1; } } catch (e) { /* varsayılan */ }
export function saveSettings() { try { localStorage.setItem('koyBakkali.settings', JSON.stringify(settings)); } catch (e) { /* yok */ } }

function ensure() {
  if (AC) return true;
  try {
    if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iPhone: sessiz düğmesi açıkken de oyun sesi çalsın
    AC = new (window.AudioContext || window.webkitAudioContext)();
    sfxGain = AC.createGain(); sfxGain.gain.value = sfxLevel(); sfxGain.connect(AC.destination);
    musicGain = AC.createGain(); musicGain.gain.value = musicLevel(); musicGain.connect(AC.destination);
    worldGain = AC.createGain(); worldGain.gain.value = WORLD; worldGain.connect(musicGain); // sokak müziği müzik ayarına bağlı, daha kısık
    voiceGain = AC.createGain(); voiceGain.gain.value = voiceLevel(); voiceGain.connect(AC.destination);
    ambGain = AC.createGain(); ambGain.gain.value = ambLevel(); ambGain.connect(AC.destination);
    loadAll();
    if (settings.voice) loadVoices(); // sesler kapalıysa inmez; açılınca setVoice yükler
    return true;
  } catch (e) { AC = null; return false; }
}

function loadAll() {
  const names = new Set(Object.values(SETS).flat());
  for (const n of names) {
    loadSound(AC, `assets/sfx/${n}.ogg`).then((buf) => { buffers[n] = buf; }).catch(() => {});
  }
}

export function unlockAudio() {
  if (!ensure()) return;
  if (AC.state !== 'running') AC.resume().catch(() => {}); // iPhone'da askı dışında 'interrupted' da olur (arama, arka plan)
  primeDeck();
  startMusic();
}
// iPhone ve bazı Android tarayıcıları dokunuşun içinde başlatılmayan sesi çalmaz. Şarkı listesi dokunuştan sonra gelir (fetch), şarkı da
// ondan sonra başlar: iki çalar ilk dokunuşta sessiz bir kayıtla bir kez çalınıp açılır, sonraki şarkılar engellenmez
let primed = false, silent = '';
function primeDeck() {
  if (primed) return;
  primed = true;
  if (!deck.length) makeDeck();
  const n = 8000, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(b, 44).fill(128); // 1 sn sessizlik (8 bit, 8 kHz)
  const url = silent = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  for (const d of deck) {
    if (d.el.src) continue; // şarkı zaten yüklenmiş
    d.el.src = url;
    const p = d.el.play();
    if (p) p.then(() => { if (d.el.src === url) d.el.pause(); }).catch(() => {});
  }
}
// Telefonda dokunuşun başı (pointerdown) tarayıcıya kullanıcı izni sayılmıyor; yalnız parmak kalkınca (pointerup, touchend), click ve tuş
// sayılıyor. Oyun sesi yalnız pointerdown'da açmaya çalıştığı için telefonda ses bağlamı askıda kalıyor, müzik hiç başlamıyordu. Bu olaylar
// pencerede yakalanır (düğmelerin stopPropagation'ı engellemez); ses çalarken bir şey yapmaz, kesintiden sonraki ilk dokunuşta yeniden açar
for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, () => {
  if (!AC || AC.state !== 'running') unlockAudio();
  // şarkı ilk dokunuşun başında (pointerdown) başlatılmaya çalışılır, telefon bunu izin saymaz ve çalar duraklamış kalır: ses efektleri
  // çalar, müzik sessizdi (panel parça adını gösterirken). İzin sayılan her olayda duraklamış çalar yeniden denenir (2026-11-10 denetimi)
  const d = deck[cur];
  if (d && d.el.src && d.el.src !== silent && d.el.paused && settings.music && !document.hidden) d.el.play().catch(() => {});
}, { capture: true, passive: true });

const sfxLevel = () => (settings.sfx ? 0.9 * (settings.sfxVol ?? 1) : 0);
const musicLevel = () => (settings.music ? 0.32 * (settings.musicVol ?? 1) : 0);
function applyLevels() {
  if (sfxGain) sfxGain.gain.value = sfxLevel();
  if (ambGain) ambGain.gain.setTargetAtTime(ambLevel(), AC.currentTime, 0.3);
  if (voiceGain) voiceGain.gain.value = voiceLevel();
  // kutlama melodisi sırasında müzik biraz kısılır; konuşmada kısılmaz (2026-11-03 kullanıcı: "oyunun ana müziği kısılıp açılıyor")
  const now = performance.now();
  if (musicGain) musicGain.gain.setTargetAtTime(musicLevel() * (ducked ? 0.45 : 1) * (now < rewardUntil ? 0.6 : 1), AC.currentTime, 0.12);
}
let ducked = false;
export function setSfx(on) { settings.sfx = on; saveSettings(); applyLevels(); }
// ortam sesleri (ambience.js): bölgelerin arka plan sesleri, dalgalar, martılar ve kuşlar
let ambGain = null;
// 2026-11-03 kullanıcı: "ortam sesleri daha kısık tonda olmalı" (0,75 → 0,45)
const ambLevel = () => (settings.amb !== false ? 0.45 * (settings.ambVol ?? 1) : 0);
export function setAmb(on) { settings.amb = on; saveSettings(); applyLevels(); }
export function setAmbVol(v) { settings.ambVol = v; saveSettings(); applyLevels(); }
export const ambienceBus = () => (AC && ambGain ? { A: AC, out: ambGain } : null);
// dünyadan gelen müzik (calgi.js): çalgıcılar, org, radyo ve DJ kendi kısık kanalından (worldGain) müzik kanalına çalar. Şarkı artık
// kısılmaz (2026-11-03 kullanıcı: "sokak sanatçılarının müzikleri daha kısık tonda olmalı ve oyun müziğini kesmemeli; ana müzik kısılıp
// açılıyor"): eskiden çalgıcının yanında şarkı %72'ye kadar kısılıyordu, köyde yürürken sürekli inip çıkıyordu. WORLD: çalgı dibinde
// şarkının ~yarısından az (ölçüm: şarkı ≈ 0,076; çalgı dibinde 0,04-0,05 × 0,5 ≈ 0,02-0,025)
const WORLD = 0.5;
export const musicOut = () => (AC && worldGain ? { A: AC, out: worldGain } : null);
const songLevel = () => 1.7;
export function duckSongs() { /* calgi.js çağırır; şarkı kısılmaz */ }
export function setMusic(on) {
  settings.music = on; saveSettings(); applyLevels(); syncDeck();
}
function syncDeck() {
  const d = deck[cur];
  if (d && d.el.src) { if (settings.music && !document.hidden) d.el.play().catch(() => {}); else for (const x of deck) x.el.pause(); }
}
// Oyun birden çok sekmede açıksa: bir sekmede ses ayarı değişince ötekiler de uyar,
// arka plandaki sekme tamamen susar. Yoksa kapatılan müzik başka sekmeden çalmaya devam eder.
addEventListener('storage', (e) => {
  if (e.key !== 'koyBakkali.settings' || !e.newValue) return;
  try { Object.assign(settings, JSON.parse(e.newValue)); } catch (err) { return; }
  applyLevels(); syncDeck();
});
document.addEventListener('visibilitychange', () => {
  if (!AC) return;
  if (document.hidden) AC.suspend(); else AC.resume().catch(() => {});
  syncDeck();
});
// test kancası: müzik gerçekten susuyor mu
window.__audio = () => ({ ac: AC && AC.state, music: settings.music, gain: musicGain && +musicGain.gain.value.toFixed(3), playing: deck.map((d) => !d.el.paused), src: deck.map((d) => decodeURIComponent(d.el.src.split('/').pop())), hidden: document.hidden });
export function setSfxVol(v) { settings.sfxVol = v; saveSettings(); applyLevels(); }
export function setMusicVol(v) { settings.musicVol = v; saveSettings(); applyLevels(); }
// menü açıkken müzik kısılır
export function duckMusic(on) { ducked = on; applyLevels(); }
export function setVoice(on) { settings.voice = on; saveSettings(); applyLevels(); if (on && AC) loadVoices(); }
export function setVoiceVol(v) { settings.voiceVol = v; saveSettings(); applyLevels(); }

// ---------- insan sesleri ----------
// Edge Türkçe sinir ağı sesleri (assets/voice): a_ doğal sözler, d_ kısa nidalar; "hayvanca" a_ dosyalarının hızlı ve tiz çalınması.
// Kısık ve seyrek: yalnızca özel anlarda, iki konuşma arasında birkaç saniye boşluk.
let voiceGain = null, voiceT = 0;
const vbuf = {};
// mutluluk odaklı: memnun müşteri ara sıra konuşur, kızgın olan nadiren söylenir. 2026-11-01 kullanıcı: pazarda her müşteri konuşuyor,
// sesler tekrar ediyor. Olasılık düşük, ara uzun; yakında ne kadar çok müşteri varsa (son 30 sn'deki olay) tek tek konuşma o kadar seyrek.
// Aynı söz son 8 konuşmada yeniden çalmaz
const RARE = { happy: [0.08, 20], angry: [0.05, 26], shout: [1, 4], unlock: [1, 2] }; // [olasılık, sonraki konuşmaya kadar sn]
let moodLog = [];
const lastKeys = [];
const voiceLevel = () => (settings.voice ? 0.45 * (settings.voiceVol ?? 1) : 0);
// list.json: üretilmiş dosyaların adları (ör. "a_happy2_kiz"); listede olmayan karakter/söz yalnızca çalmaz
let voicesAsked = false;
function loadVoices() {
  if (voicesAsked) return; // bir kez
  voicesAsked = true;
  fetch('assets/voice/list.json').then((r) => r.json()).then((names) => {
    for (const key of names) {
      fetch(`assets/voice/${key}.mp3`).then((r) => r.arrayBuffer()).then((b) => AC.decodeAudioData(b)).then((buf) => {
        const d = buf.getChannelData(0);
        let i = 0;
        while (i < d.length && Math.abs(d[i]) < 0.01) i++;
        buf.lead = Math.max(0, i / buf.sampleRate - 0.01); // baştaki sessizlik atlanır
        vbuf[key] = buf;
      }).catch(() => {});
    }
  }).catch(() => {});
}
// ---------- ortam: sahil dalgaları ----------
// kodla üretilen dalga: pembe gürültü, birkaç saniyede bir kabarıp kıyıya vurur ve çekilir. Efekt ayarına bağlı.
let waveGain = null, ambLast = -1;
function startWaves() {
  const len = AC.sampleRate * 4, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
  }
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
  const swell = AC.createGain(); swell.gain.value = 0.3;
  waveGain = AC.createGain(); waveGain.gain.value = 0;
  src.connect(lp).connect(swell).connect(waveGain).connect(ambGain); // dalgalar ortam sesi ayarına bağlı
  src.start();
  const surge = () => {
    const t = AC.currentTime, up = 1.6 + Math.random(), down = 2.6 + Math.random() * 1.5;
    for (const [p, hi, lo] of [[swell.gain, 1, 0.25], [lp.frequency, 1500, 550]]) {
      p.cancelScheduledValues(t); p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(hi, t + up); p.linearRampToValueAtTime(lo, t + up + down);
    }
    setTimeout(surge, (up + down + Math.random() * 1.5) * 1000);
  };
  surge();
}
// level 0-1: oyuncu kıyıya ne kadar yakın (her karede çağrılır, yalnızca değişince ayarlanır)
export function setAmbience(level) {
  if (!AC || Math.abs(level - ambLast) < 0.02) return;
  if (!waveGain) startWaves();
  ambLast = level;
  waveGain.gain.setTargetAtTime(level * 0.55, AC.currentTime, 0.4);
}

// mood: happy | angry | shout | unlock. Konuştuysa true döner
export function speak(mood) {
  if (!AC || !settings.voice || !RARE[mood]) return false;
  const [p, cool] = RARE[mood], now = performance.now(), crowd = mood === 'happy' || mood === 'angry';
  let pp = p;
  if (crowd) { moodLog = moodLog.filter((t) => now - t < 30000); moodLog.push(now); pp = p * Math.min(1, 4 / moodLog.length); }
  if (now < voiceT || Math.random() > pp) return false;
  // karışım: kısa nida, doğal söz ya da hayvanca (aynı söz hızlı ve tiz)
  const r = Math.random();
  // İngilizcede Türkçe söz anlaşılmasın: yalnız nida, hep hayvanca
  const st = EN ? 'a' : crowd ? (r < 0.45 ? 'd' : 'a') : (r < 0.6 ? 'a' : 'd');
  const fast = EN || (crowd && st === 'a' && r > 0.72);
  const all = Object.keys(vbuf).filter((k) => k.startsWith(`${st}_${mood}`)), fresh = all.filter((k) => !lastKeys.includes(k)), keys = fresh.length ? fresh : all;
  if (!keys.length) return false;
  const key = keys[Math.floor(Math.random() * keys.length)], buf = vbuf[key];
  lastKeys.push(key); if (lastKeys.length > 8) lastKeys.shift();
  const src = AC.createBufferSource();
  src.buffer = buf;
  // hafif çizgi film tonu: biraz hızlı ve tiz; hayvanca çok daha hızlı
  src.playbackRate.value = fast ? 1.6 + Math.random() * 0.2 : 1.04 + Math.random() * 0.06;
  src.connect(voiceGain);
  src.start(AC.currentTime + 0.02, buf.lead);
  voiceT = now + cool * 1000;
  // edge-tts dosyalarının sonunda ~1 sn sessizlik var; konuşma süresi kabaca bunun dışı
  const talk = Math.max(0.4, (buf.duration - buf.lead - 0.9) / src.playbackRate.value);
  voiceUntil = now + talk * 1000;
  applyLevels(); setTimeout(applyLevels, talk * 1000 + 50);
  return true;
}

export function play(name, o = {}) {
  if (!AC || !settings.sfx) return;
  const now = performance.now();
  const gap = o.gap ?? GAP[name] ?? 45;
  if (last[name] && now - last[name] < gap) return;
  if (!PRIORITY.has(name)) {
    recent = recent.filter((t) => now - t < 1000);
    if (recent.length >= 3) return;
    recent.push(now);
  }
  last[name] = now;
  if (REWARD.has(name)) { rewardUntil = now + 2200; applyLevels(); setTimeout(applyLevels, 2250); }
  if (RECIPES[name]) {
    // ürün alırken art arda gelen sesler nota nota yükselir, 0,7 sn ara verince baştan başlar
    if (name === 'pick') { combo = now - comboT < 700 ? combo + 1 : 0; comboT = now; }
    const g = AC.createGain();
    g.gain.value = (o.vol ?? 1) * (VOL[name] ?? 0.5);
    g.connect(sfxGain);
    RECIPES[name](AC, g, AC.currentTime + 0.005, name === 'pick' ? combo : 0);
    return;
  }
  const set = SETS[name];
  if (!set) return synth(name, o.vol ?? 1);
  const buf = buffers[set[Math.floor(Math.random() * set.length)]];
  if (!buf) return synth(name, o.vol ?? 1);
  const src = AC.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = o.rate ?? (name === 'unlock' || name === 'region' || name === 'caravan' || name === 'boost' || name === 'hire' ? 1 : 0.94 + Math.random() * 0.14);
  const g = AC.createGain();
  g.gain.value = (o.vol ?? 1) * (VOL[name] ?? 0.5);
  src.connect(g).connect(sfxGain);
  src.start();
}

function tone(f, d, type = 'sine', v = 0.05, slide = 0, delay = 0, out = sfxGain) {
  const t0 = AC.currentTime + delay;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + d);
  g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g).connect(out); o.start(t0); o.stop(t0 + d + 0.02);
}
// gerçek kayıtla çalınan sesler (aracses.js honk): kayıt yüklüyse out'a çalıp true döner, yoksa kodla çalınır
export const sfxHook = {};
// k: uzaklığa göre seviye (sfx'in 'at' seçeneğinden)
function synth(name, k = 1) {
  const out = AC.createGain();
  out.gain.value = k;
  out.connect(sfxGain);
  if (sfxHook[name] && sfxHook[name](AC, out)) return;
  if (name === 'shout') { tone(330, 0.3, 'sawtooth', 0.03, 220, 0, out); tone(440, 0.3, 'sawtooth', 0.02, 220, 0.12, out); }
  else if (name === 'honk') { tone(392, 0.16, 'square', 0.025, 0, 0, out); tone(392, 0.22, 'square', 0.025, 0, 0.2, out); }
  else if (name === 'cluck') { tone(900, 0.06, 'square', 0.012, 300, 0, out); tone(1100, 0.05, 'square', 0.01, 200, 0.08, out); }
  else if (name === 'moo') { tone(150, 0.6, 'sawtooth', 0.016, -40, 0, out); }
  else if (name === 'whoosh') { noise(0.25, 0.04, 1200, 0, out); }
  // bekçi ve polis (polis.js): bekçi düdüğü (titrek tiz iki öttürme), kelepçe (madeni çıt ve cırcır), siren (yükselip alçalan iki uluma),
  // araba kapısı (boğuk gümleme; yere düşüşte de), telsiz (cızırtı ve iki bip)
  else if (name === 'whistle') {
    for (const [d0, len] of [[0, 0.28], [0.36, 0.55]]) {
      const t0 = AC.currentTime + d0, o = AC.createOscillator(), lfo = AC.createOscillator(), lg = AC.createGain(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = 2750; lfo.frequency.value = 34; lg.gain.value = 160;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.025); g.gain.setValueAtTime(0.045, t0 + len - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g).connect(out); o.start(t0); lfo.start(t0); o.stop(t0 + len + 0.02); lfo.stop(t0 + len + 0.02);
    }
  }
  else if (name === 'cuff') { tone(2600, 0.035, 'square', 0.02, 0, 0, out); for (let i = 0; i < 5; i++) noise(0.014, 0.03, 5000, 0.06 + i * 0.028, out); tone(1900, 0.05, 'square', 0.018, 0, 0.22, out); }
  else if (name === 'siren') {
    const t0 = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
    o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 2200;
    o.frequency.setValueAtTime(620, t0);
    for (let i = 0; i < 2; i++) { o.frequency.linearRampToValueAtTime(1350, t0 + i * 1.1 + 0.55); o.frequency.linearRampToValueAtTime(620, t0 + i * 1.1 + 1.1); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.08); g.gain.setValueAtTime(0.03, t0 + 2.0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    o.connect(lp).connect(g).connect(out); o.start(t0); o.stop(t0 + 2.25);
  }
  else if (name === 'door') { tone(120, 0.16, 'sine', 0.09, -50, 0, out); noise(0.07, 0.035, 700, 0, out); }
  else if (name === 'radio') { noise(0.22, 0.016, 1800, 0, out); tone(1250, 0.07, 'square', 0.012, 0, 0.24, out); tone(1250, 0.07, 'square', 0.012, 0, 0.36, out); }
  // havai fişek (final.js): ıslıkla yükselen roket; patlamada boğuk gümbürtü ve ardından çıtırtı
  // seviye atlama: yükselen arpej, sonda parlak akor ve çıngırak (eskiden bölge açılışının sesini çalıyordu)
  else if (name === 'level') {
    [523, 659, 784].forEach((f, i) => { tone(f, 0.22, 'triangle', 0.07, 0, i * 0.09, out); tone(f * 2, 0.12, 'sine', 0.02, 0, i * 0.09, out); });
    for (const f of [523, 659, 784, 1047]) tone(f, 1.1, 'triangle', 0.045, 0, 0.3, out);
    tone(2094, 0.6, 'sine', 0.02, 0, 0.3, out);
    for (let i = 0; i < 5; i++) tone(2093 + i * 260, 0.18, 'sine', 0.012, 0, 0.36 + i * 0.06, out);
  }
  else if (name === 'launch') { tone(520, 0.7, 'sine', 0.01, 900, 0, out); noise(0.45, 0.012, 3000, 0, out); }
  else if (name === 'boom') { tone(95, 0.5, 'sine', 0.07, -45, 0, out); noise(0.55, 0.05, 350, 0, out); for (let i = 0; i < 6; i++) noise(0.035, 0.018, 5000, 0.22 + i * 0.07 + Math.random() * 0.04, out); }
}
function noise(d, v, hp = 6000, delay = 0, out = sfxGain) {
  const t0 = AC.currentTime + delay;
  const len = Math.floor(AC.sampleRate * d);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = AC.createGain(); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  src.connect(f).connect(g).connect(out); src.start(t0);
}

// ---------- müzik klasörü ----------
// Masaüstü\Köy bakkalı music, oyun klasöründeki "music" bağlantısıyla sunulur. Her alt klasör bir bölüm
// (adındaki sayı: "1.bölümler", "bölüm 3"); oyun ilerledikçe bir sonraki bölümün şarkıları çalar.
// Yayında (telefonda) klasör yok: assets/music/list.json'daki sıkıştırılmış kopyalar çalar (AAC 96k, 439 MB → 30 MB;
// KoyBakkali-araclar/muzik_cevir.py klasörden üretir; yeni şarkı eklenince yeniden çalıştırılıp yüklenir). 2026-11-02 kullanıcı:
// "mobilde müzik hâlâ yok": şarkılar yalnız yerel sunucuda çalıyordu. İkisi de yoksa kodla üretilen müzik çalar.
let tracks = null, fileBus = null, deck = [], cur = 0, nowName = '';
export function setMusicStage() {} // eskiden şarkı bölüme göre seçilirdi (main.js hâlâ çağırıyor)
async function listDir(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return [];
  return [...(await r.text()).matchAll(/href="([^"?#]+)"/g)].map((m) => m[1]);
}
const tracksReady = (async () => {
  // klasör listesi yalnız yerel sunucuda (serve.py); yerelde ?muzik=liste yayındaki listeyi dener
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]muzik=liste/.test(location.search);
  try {
    if (local) {
      const t = {};
      for (const d of (await listDir('music/')).filter((h) => h.endsWith('/'))) {
        const n = parseInt((decodeURIComponent(d).match(/\d+/) || [])[0], 10);
        if (!n) continue;
        const files = (await listDir(`music/${d}`)).filter((h) => /\.(wav|mp3|ogg|m4a|flac)$/i.test(h));
        if (files.length) t[n] = files.map((f) => `music/${d}${f}`);
      }
      if (Object.keys(t).length) { tracks = t; return; }
    }
    const r = await fetch('assets/music/list.json', { cache: 'no-cache' });
    const j = r.ok ? await r.json() : null;
    tracks = j && Object.keys(j).length ? j : null;
  } catch (e) { tracks = null; }
})();
// 2026-11-02 kullanıcı: "arka arkaya aynı parçalar çalmasın ... açılış müziğimiz olsun, sonra hep farklı sırayla çalsın".
// Eskiden şarkı bölüme bağlıydı: 4. ve 5. klasörde tek parça olduğu için aynı parça sonsuza dek dönüyordu, 6-8 hiç çalmıyordu.
// Artık her açılışta önce açılış parçası, sonra bütün klasörlerin şarkıları karışık sırayla; hepsi bitince yeni karışık tur.
// Aynı şarkının sürümleri ("Fresh Produce Groove (1)", "(2)") art arda gelmez.
const OPENING = 'greens & groceries';
let queue = [], opened = false;
const fileTitle = (u) => decodeURIComponent(u.split('/').pop()).replace(/\.\w+$/, '').trim().toLowerCase();
function shuffled(list, prev) {
  let best = list, worst = Infinity;
  for (let k = 0; k < 300 && worst; k++) {
    const q = list.slice();
    for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
    let bad = prev && titleOf(q[0]) === titleOf(prev) ? 1 : 0;
    for (let i = 1; i < q.length; i++) if (titleOf(q[i]) === titleOf(q[i - 1])) bad++;
    if (bad < worst) { best = q; worst = bad; }
  }
  return best;
}
function nextUrl() {
  const all = [...new Set(Object.values(tracks).flat())];
  if (!opened) {
    opened = true;
    const o = all.find((u) => fileTitle(u) === OPENING);
    if (o) { queue = shuffled(all.filter((u) => u !== o), o); return o; } // ilk tur açılış parçasını tekrar çalmaz
  }
  if (!queue.length) queue = shuffled(all, nowUrl);
  return queue.shift();
}
// 2026-11-09: Firebase ücretsiz kotası (ayda 10 GB indirme) doldu, en büyük kalem şarkılardı. assets/music'te her şarkının Opus
// 48 kbps kopyası da var (.webm, m4a'nın ~%57'si; muzik_cevir.py üretir): tarayıcı Opus çalabiliyorsa o istenir, çalamıyorsa ya da
// dosya açılmazsa (eski iPhone/Safari) m4a'ya dönülür. Müzik kapalıyken şarkı indirilmez (preload 'none'); açılınca iner.
let OPUS = (() => { try { return new Audio().canPlayType('audio/webm; codecs="opus"') === 'probably'; } catch (e) { return false; } })();
const songSrc = (url) => (OPUS && /^assets\/music\/.+\.m4a$/.test(url) ? url.replace(/\.m4a$/, '.webm') : url);
function makeDeck() {
  fileBus = AC.createGain(); fileBus.gain.value = songLevel(); fileBus.connect(musicGain);
  for (let i = 0; i < 2; i++) {
    const el = new Audio();
    // 2026-11-09: web.app'te assets/ GitHub Pages'e yönlendirilir (firebase.json redirects). İzinsiz (CORS'suz) gelen başka adres sesi
    // createMediaElementSource'a bağlanınca tarayıcı sessizlik verir; 'anonymous' ile CORS isteği gider, Pages ACAO * döndürür
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    const g = AC.createGain(); g.gain.value = 0;
    AC.createMediaElementSource(el).connect(g).connect(fileBus);
    const d = { el, g };
    el.addEventListener('ended', () => { if (deck[cur] === d && el.src !== silent) nextTrack(); }); // açılış sessizliği bitince şarkı atlanmaz
    el.addEventListener('error', () => { // Opus kopyası açılmadı: bundan sonra hep m4a
      if (!/\.webm$/.test(el.src)) {
        // m4a da açılmadı (bağlantı koptu, dosya inmedi): biraz bekleyip sıradaki parça denenir; art arda dört hatadan sonra vazgeçilir.
        // Eskiden hiçbir şey olmuyor, "bitti" olayı da gelmediği için müzik oturum boyunca susuyordu
        if (deck[cur] !== d || el.src === silent || ++songFails > 4) return;
        setTimeout(() => { if (deck[cur] === d && settings.music) nextTrack(); }, 4000 * songFails);
        return;
      }
      OPUS = false; el.src = el.src.replace(/\.webm$/, '.m4a');
      if (deck[cur] === d && settings.music && !document.hidden) el.play().catch(() => {});
    });
    el.addEventListener('playing', () => { songFails = 0; });
    deck.push(d);
  }
}
let songFails = 0;
// iki çalar arasında 2 sn yumuşak geçiş
function playUrl(url) {
  if (!deck.length) makeDeck();
  const old = deck[cur];
  cur = 1 - cur;
  const d = deck[cur], t = AC.currentTime;
  d.el.preload = settings.music && !document.hidden ? 'auto' : 'none'; // müzik kapalıyken şarkı inmez; açılınca play() indirir
  d.el.src = songSrc(url);
  if (settings.music && !document.hidden) d.el.play().catch(() => {});
  d.g.gain.cancelScheduledValues(t); d.g.gain.setValueAtTime(0.0001, t); d.g.gain.linearRampToValueAtTime(1, t + 2);
  old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + 2);
  setTimeout(() => { if (deck[cur] !== old) old.el.pause(); }, 2200);
  nowName = decodeURIComponent(url.split('/').pop()).replace(/\.\w+$/, '');
  nowUrl = url;
}
let nowUrl = '';
// "Fresh Produce Groove (2)" ile "Fresh Produce Groove" aynı parçanın kopyası sayılır
const titleOf = (u) => decodeURIComponent(u.split('/').pop()).replace(/\.\w+$/, '').replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase();
// şarkı bitince ya da oyuncu "sonraki" deyince karışık sıradaki parça
export function nextTrack() {
  if (!tracks || !AC) return;
  playUrl(nextUrl());
}
// stage: çalan parçanın klasör numarası (menüde "Bölüm N")
export function musicInfo() { return { files: !!tracks, name: nowName, stage: tracks ? +(Object.keys(tracks).find((k) => tracks[k].includes(nowUrl)) || 0) : 0 }; }
function startSongs() { if (!nowUrl) playUrl(nextUrl()); }

// ---------- kodla üretilen müzik ----------
// 100 bpm, sekizlik adımlar; I–V–vi–IV (han'da hicaz makamında dem)
const STYLES = {
  koy:   { lead: 'pluck', arp: 'pluck', scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]] },
  pazar: { lead: 'accordion', arp: 'pluck', scale: [0, 2, 4, 5, 7, 9], prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]] },
  sahil: { lead: 'steel', arp: 'steel', scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]] },
  han:   { lead: 'oud', arp: 'oud', scale: [0, 1, 4, 5, 7, 8, 10], prog: [[0, 7, 12], [0, 7, 12], [5, 8, 12], [0, 7, 12]] },
};
let regionOf = () => 'koy';
export function setMusicRegion(fn) { regionOf = fn; }
let nextT = 0, step = 0, timer = null, seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);

function voice(kind, f, t, dur, v) {
  const o = AC.createOscillator(), g = AC.createGain();
  let out = g;
  if (kind === 'pluck') { o.type = 'triangle'; }
  else if (kind === 'accordion') { o.type = 'square'; v *= 0.5; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; g.connect(lp); out = lp; }
  else if (kind === 'steel') { o.type = 'sine'; const o2 = AC.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2.01, t); const g2 = AC.createGain(); g2.gain.setValueAtTime(v * 0.35, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6); o2.connect(g2).connect(musicGain); o2.start(t); o2.stop(t + dur); }
  else if (kind === 'oud') { o.type = 'sawtooth'; v *= 0.55; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 3; g.connect(lp); out = lp; }
  else if (kind === 'bass') { o.type = 'sine'; }
  o.frequency.setValueAtTime(f, t);
  if (kind === 'steel') o.frequency.exponentialRampToValueAtTime(f * 0.995, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (kind === 'accordion' ? 0.04 : 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  out.connect(musicGain);
  o.start(t); o.stop(t + dur + 0.05);
}

function schedule(s, t) {
  const st = STYLES[regionOf()] || STYLES.koy;
  const bar = Math.floor(s / 8) % 4, b = s % 8;
  const ch = st.prog[bar];
  const root = 60;
  if (b % 4 === 0) voice('bass', mf(root - 24 + ch[0]), t, 0.45, 0.22);
  if (b === 6 && bar % 2 === 1) voice('bass', mf(root - 24 + ch[1]), t, 0.3, 0.16);
  voice(st.arp, mf(root + ch[b % 3]), t, 0.22, b % 2 ? 0.05 : 0.07);
  if (b % 2 === 1) noise(0.04, 0.012, 7000, t - AC.currentTime, musicGain);
  if (rnd() < (b % 2 ? 0.25 : 0.45)) {
    const n = st.scale[Math.floor(rnd() * st.scale.length)];
    voice(st.lead, mf(root + 12 + n), t, 0.34, 0.06);
  }
}

function startMusic() {
  if (timer || !AC) return;
  nextT = AC.currentTime + 0.1;
  let listed = false;
  tracksReady.then(() => { listed = true; nextT = AC.currentTime + 0.1; if (tracks) startSongs(); });
  timer = setInterval(() => {
    // klasör okunmadan kod müziği başlamasın; yoksa birkaç saniye iki müzik üst üste çalar
    if (AC.state !== 'running' || !listed) return;
    if (tracks) { if (deck.length) startSongs(); return; }
    const stepDur = 60 / 100 / 2;
    while (nextT < AC.currentTime + 0.15) { schedule(step, nextT); step++; nextT += stepDur; }
  }, 30);
}
