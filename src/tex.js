// Kodla üretilen dokular (canvas). Hepsi döşenebilir (tileable).
import * as THREE from 'three';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h || w;
  return c;
}

function toTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// Kenarlardan taşan şekli karşı kenarda da çizer (dikişsiz döşeme)
function wrap(size, x, y, r, draw) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    const px = x + ox, py = y + oy;
    if (px + r > 0 && px - r < size && py + r > 0 && py - r < size) draw(px, py);
  }
}

function blobs(g, size, r, n, colors, rmin, rmax, squash = 0.7) {
  for (let i = 0; i < n; i++) {
    const x = r() * size, y = r() * size, s = rmin + r() * (rmax - rmin), a = r() * 3;
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    wrap(size, x, y, s, (px, py) => { g.beginPath(); g.ellipse(px, py, s, s * squash, a, 0, Math.PI * 2); g.fill(); });
  }
}

function dots(g, size, r, n, colors, smin, smax) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = smin + r() * (smax - smin);
    g.fillRect(r() * size, r() * size, s, s);
  }
}

function roundRect(g, x, y, w, h, rad) {
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

const B = {
  grass() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(11);
    g.fillStyle = '#8fd06a'; g.fillRect(0, 0, 256, 256);
    blobs(g, 256, r, 120, ['rgba(176,226,122,0.45)', 'rgba(118,186,84,0.35)', 'rgba(160,214,110,0.4)'], 8, 26);
    g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 700; i++) {
      const x = r() * 256, y = r() * 256;
      g.strokeStyle = r() < 0.5 ? 'rgba(84,158,64,0.5)' : 'rgba(190,236,140,0.55)';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); g.stroke();
    }
    return toTex(c);
  },
  path() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(12);
    g.fillStyle = '#e4cfa2'; g.fillRect(0, 0, 256, 256);
    blobs(g, 256, r, 80, ['rgba(214,190,145,0.5)', 'rgba(240,222,182,0.6)'], 6, 20);
    blobs(g, 256, r, 140, ['#cdb488', '#bfa57a', '#f1e2c0'], 1.5, 4, 0.8);
    return toTex(c);
  },
  soil() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(13);
    g.fillStyle = '#8e5a33'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = 'rgba(62,36,20,0.35)'; g.fillRect(0, y + 20, 256, 9);
      g.fillStyle = 'rgba(182,124,78,0.4)'; g.fillRect(0, y + 4, 256, 7);
    }
    dots(g, 256, r, 900, ['#6f4325', '#a8714a', '#7b4b2a'], 1, 3);
    return toTex(c);
  },
  wood() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(14);
    const cols = ['#cf9460', '#c4874f', '#d79d68', '#bf8049'];
    for (let p = 0; p < 4; p++) {
      g.fillStyle = cols[p]; g.fillRect(0, p * 64, 256, 64);
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = 'rgba(120,70,35,0.22)'; g.lineWidth = 1 + r();
        const y0 = p * 64 + 6 + r() * 52, ph = r() * 6;
        g.beginPath(); g.moveTo(0, y0);
        for (let x = 0; x <= 256; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.0245 * 2 + ph) * 2.2);
        g.stroke();
      }
      g.fillStyle = 'rgba(80,45,22,0.55)'; g.fillRect(0, p * 64, 256, 3);
      g.fillStyle = 'rgba(255,230,190,0.25)'; g.fillRect(0, p * 64 + 3, 256, 2);
      const kx = r() * 256;
      g.fillStyle = 'rgba(110,62,30,0.35)';
      g.beginPath(); g.ellipse(kx, p * 64 + 32, 7, 4, 0, 0, Math.PI * 2); g.fill();
    }
    return toTex(c);
  },
  tiles() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(15);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#fff2db' : '#f4d6ae'; g.fillRect(i * 64, j * 64, 64, 64);
    }
    dots(g, 256, r, 300, ['rgba(255,255,255,0.35)', 'rgba(200,160,110,0.15)'], 1, 3);
    g.fillStyle = '#ddbf95';
    for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1.5, 0, 3, 256); g.fillRect(0, i * 64 - 1.5, 256, 3); }
    return toTex(c);
  },
  sand() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(16);
    g.fillStyle = '#f5dda4'; g.fillRect(0, 0, 256, 256);
    blobs(g, 256, r, 60, ['rgba(236,206,146,0.5)', 'rgba(252,236,196,0.6)'], 10, 30);
    dots(g, 256, r, 2600, ['#e4c587', '#fcebc0', '#d9b878', '#fff6dc'], 1, 2.2);
    return toTex(c);
  },
  desert() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(17);
    g.fillStyle = '#eccb8c'; g.fillRect(0, 0, 256, 256);
    g.lineWidth = 3;
    for (let i = 0; i < 26; i++) {
      const y0 = r() * 256, ph = r() * 6;
      g.strokeStyle = r() < 0.5 ? 'rgba(214,170,104,0.35)' : 'rgba(250,224,170,0.5)';
      g.beginPath();
      for (let x = -8; x <= 264; x += 8) { const y = y0 + Math.sin(x * 0.049 + ph) * 5; if (x < 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    dots(g, 256, r, 1400, ['#d9b06e', '#f7dfaa'], 1, 2);
    return toTex(c);
  },
  water() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(18);
    g.fillStyle = '#46bde6'; g.fillRect(0, 0, 256, 256);
    blobs(g, 256, r, 40, ['rgba(70,170,220,0.6)', 'rgba(110,210,240,0.45)'], 20, 50);
    g.lineWidth = 2.4; g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = r() * 256, y = r() * 256, w = 8 + r() * 16;
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      wrap(256, x, y, w, (px, py) => { g.beginPath(); g.moveTo(px - w, py); g.quadraticCurveTo(px - w / 2, py - 4, px, py); g.quadraticCurveTo(px + w / 2, py + 4, px + w, py); g.stroke(); });
    }
    return toTex(c);
  },
  cobble() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(19);
    g.fillStyle = '#8f887b'; g.fillRect(0, 0, 256, 256);
    const cols = ['#d3cab9', '#c2b9a7', '#ddd5c6', '#b7ad9b', '#cbbfa8'];
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const ox = (j % 2) * 16;
      const x = i * 32 + ox + (r() - 0.5) * 4, y = j * 32 + (r() - 0.5) * 4;
      const col = cols[Math.floor(r() * cols.length)];
      wrap(256, x + 15, y + 15, 18, (px, py) => {
        g.fillStyle = col; roundRect(g, px - 13, py - 13, 26, 26, 9); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.18)'; roundRect(g, px - 11, py - 12, 18, 9, 4); g.fill();
      });
    }
    return toTex(c);
  },
  asphalt() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(20);
    g.fillStyle = '#9a9fa5'; g.fillRect(0, 0, 256, 256);
    dots(g, 256, r, 3000, ['#8a8f95', '#aab0b6', '#7f848a'], 1, 2.5);
    return toTex(c);
  },
  brick() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(21);
    g.fillStyle = '#c9a26b'; g.fillRect(0, 0, 256, 256);
    const cols = ['#e7c793', '#e0bd85', '#ecd2a2', '#dcb57c'];
    for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) {
      const x = i * 64 + (j % 2) * 32 + 2, y = j * 32 + 2;
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      roundRect(g, x, y, 60, 28, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x + 3, y + 3, 54, 5);
      g.fillStyle = 'rgba(120,80,40,0.12)'; g.fillRect(x + 3, y + 21, 54, 5);
    }
    return toTex(c);
  },
  cini() {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#f6f1e6'; g.fillRect(0, 0, 256, 256);
    const star = (cx, cy, s, col) => {
      g.fillStyle = col;
      for (const a of [0, Math.PI / 4]) {
        g.save(); g.translate(cx, cy); g.rotate(a); g.fillRect(-s, -s, s * 2, s * 2); g.restore();
      }
    };
    for (const [x, y] of [[64, 64], [192, 64], [64, 192], [192, 192]]) {
      star(x, y, 40, '#2f6db5'); star(x, y, 26, '#f6f1e6'); star(x, y, 15, '#3aa6a0');
      g.fillStyle = '#c8643b'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#2f6db5';
    for (const [x, y] of [[0, 0], [128, 0], [256, 0], [0, 128], [128, 128], [256, 128], [0, 256], [128, 256], [256, 256]]) {
      g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-12, -12, 24, 24); g.restore();
    }
    return toTex(c);
  },
  roof() {
    const c = canvas(256), g = c.getContext('2d');
    g.fillStyle = '#b8552f'; g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 8; j++) for (let i = -1; i < 9; i++) {
      const x = i * 32 + (j % 2) * 16, y = j * 32;
      g.fillStyle = j % 2 ? '#cf6b3f' : '#c96339';
      g.beginPath(); g.arc(x + 16, y + 8, 16, 0, Math.PI); g.lineTo(x, y - 8); g.lineTo(x + 32, y - 8); g.fill();
      g.strokeStyle = 'rgba(90,35,15,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.arc(x + 16, y + 8, 16, 0, Math.PI); g.stroke();
    }
    return toTex(c);
  },
  plaster() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(22);
    g.fillStyle = '#fff3dc'; g.fillRect(0, 0, 256, 256);
    blobs(g, 256, r, 50, ['rgba(240,226,200,0.5)', 'rgba(255,250,238,0.6)'], 10, 30);
    g.fillStyle = '#6fc7bb'; g.fillRect(0, 176, 256, 80);
    g.fillStyle = '#ffffff'; g.fillRect(0, 170, 256, 8);
    dots(g, 256, r, 200, ['rgba(255,255,255,0.25)'], 1, 3);
    return toTex(c);
  },
  // köy bakkalının tasarım seçenekleri (tasarim.js, 2026-11-08): damalı karo, mermer, pişmiş toprak zemin; taş ve kırmızı tuğla duvar
  dama() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(31);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#2f3a48' : '#f3eee4'; g.fillRect(i * 64, j * 64, 64, 64); }
    dots(g, 256, r, 260, ['rgba(255,255,255,0.16)', 'rgba(0,0,0,0.06)'], 1, 3);
    g.fillStyle = 'rgba(0,0,0,0.14)';
    for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1, 0, 2, 256); g.fillRect(0, i * 64 - 1, 256, 2); }
    return toTex(c);
  },
  mermer() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(32);
    g.fillStyle = '#eceae6'; g.fillRect(0, 0, 256, 256);
    blobs(g, 256, r, 40, ['rgba(214,210,204,0.45)', 'rgba(255,255,255,0.5)'], 14, 40);
    for (let k = 0; k < 7; k++) { // damarlar; levha derzleri dokunun kenarında: dikiş görünmez
      g.strokeStyle = r() < 0.5 ? 'rgba(150,146,140,0.45)' : 'rgba(176,160,140,0.35)'; g.lineWidth = 0.8 + r() * 1.6;
      let x = r() * 256, y = r() * 256, a = r() * 6.28;
      g.beginPath(); g.moveTo(x, y);
      for (let st = 0; st < 14; st++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = 'rgba(160,150,140,0.35)';
    for (let i = 0; i <= 2; i++) { g.fillRect(i * 128 - 1, 0, 2, 256); g.fillRect(0, i * 128 - 1, 256, 2); }
    return toTex(c);
  },
  toprak() { // köşeleri kesik pişmiş toprak karolar, aralarında küçük krem karo
    const c = canvas(256), g = c.getContext('2d'), r = rng(33), s = 64, k = 18;
    g.fillStyle = '#e9dcc4'; g.fillRect(0, 0, 256, 256);
    const cols = ['#c8693f', '#c26238', '#cf7447', '#b95c34'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * s + 2, y = j * s + 2, w = s - 4;
      g.fillStyle = cols[Math.floor(r() * cols.length)];
      g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + w - k, y); g.lineTo(x + w, y + k); g.lineTo(x + w, y + w - k); g.lineTo(x + w - k, y + w); g.lineTo(x + k, y + w); g.lineTo(x, y + w - k); g.lineTo(x, y + k); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,220,180,0.12)'; g.fillRect(x + k, y + 4, w - 2 * k, 6);
    }
    g.fillStyle = '#e4c79a';
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { g.save(); g.translate(i * s, j * s); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore(); }
    dots(g, 256, r, 200, ['rgba(90,40,20,0.12)', 'rgba(255,255,255,0.1)'], 1, 3);
    return toTex(c);
  },
  tas() { // yonu taş duvar: sıra sıra, boyları farklı taşlar; yatayda döşenir
    const c = canvas(256), g = c.getContext('2d'), r = rng(34);
    g.fillStyle = '#b9b0a2'; g.fillRect(0, 0, 256, 256);
    const cols = ['#d8cfbf', '#cfc4b1', '#e0d8ca', '#c6baa5', '#d3c8b4'];
    const stone = (x, y, w, h, col) => {
      g.fillStyle = col; roundRect(g, x + 2, y + 2, w - 4, h - 4, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x + 6, y + 5, w - 12, 4);
      g.fillStyle = 'rgba(90,75,55,0.12)'; g.fillRect(x + 6, y + h - 10, w - 12, 4);
    };
    for (let j = 0, y = 0; j < 5; j++) {
      const h = j === 4 ? 256 - y : 46 + Math.floor(r() * 10), x0 = Math.floor(r() * 40);
      for (let x = x0; x < 256 + x0;) {
        const w = Math.min(44 + Math.floor(r() * 46), 256 + x0 - x), col = cols[Math.floor(r() * cols.length)];
        stone(x, y, w, h, col); if (x + w > 256) stone(x - 256, y, w, h, col);
        x += w;
      }
      y += h;
    }
    return toTex(c);
  },
  tugla() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(35);
    g.fillStyle = '#d9cbb8'; g.fillRect(0, 0, 256, 256);
    const cols = ['#b5503a', '#a9472f', '#bf5a40', '#9e432e', '#c4664a'];
    for (let j = 0; j < 8; j++) for (let i = -1; i < 4; i++) {
      const x = i * 64 + (j % 2) * 32 + 2, y = j * 32 + 2;
      g.fillStyle = cols[Math.floor(r() * cols.length)]; roundRect(g, x, y, 60, 28, 3); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 3, y + 3, 54, 4);
      g.fillStyle = 'rgba(60,20,10,0.15)'; g.fillRect(x + 3, y + 22, 54, 4);
    }
    return toTex(c);
  },
  crops() {
    const c = canvas(256), g = c.getContext('2d'), r = rng(23);
    g.fillStyle = '#9a6a3c'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      g.fillStyle = 'rgba(70,40,20,0.35)'; g.fillRect(0, y + 22, 256, 8);
      for (let x = 0; x < 256; x += 12) {
        g.fillStyle = r() < 0.5 ? '#6fbf4f' : '#86cf5c';
        g.beginPath(); g.ellipse(x + r() * 4, y + 12, 6, 8, 0, 0, Math.PI * 2); g.fill();
      }
    }
    return toTex(c);
  },
  bill() {
    const c = canvas(128, 80), g = c.getContext('2d');
    g.fillStyle = '#4fae55'; roundRect(g, 0, 0, 128, 80, 10); g.fill();
    g.strokeStyle = '#a6e3a0'; g.lineWidth = 5; roundRect(g, 8, 8, 112, 64, 8); g.stroke();
    g.fillStyle = '#e9ffe4'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('₺', 64, 42);
    return toTex(c, false);
  },
};

const cache = {};
// yumuşak kenar maskesi (alphaMap): ortası dolu, kenara yaklaştıkça saydamlaşır, köşeler yuvarlak. Toprak patikalar
// çimene sert çizgiyle değil yumuşak geçişle karışır (kullanıcı 2026-10-28: "yüzeyler arası geçişleri soft yap")
const softCache = new Map();
export function softEdge(w, d, f = 0.6) {
  const key = `${Math.round(w * 4)}x${Math.round(d * 4)}x${f}`;
  if (softCache.has(key)) return softCache.get(key);
  const W = Math.max(16, Math.min(256, Math.round(w * 12))), H = Math.max(16, Math.min(256, Math.round(d * 12)));
  const c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), fx = (f / w) * W, fz = (f / d) * H;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const ex = Math.min(i + 0.5, W - i - 0.5) / fx, ez = Math.min(j + 0.5, H - j - 0.5) / fz;
    let k = Math.min(1, ex, ez);
    if (ex < 1 && ez < 1) k = Math.max(0, 1 - Math.hypot(1 - ex, 1 - ez));
    const a = Math.round(255 * k * k * (3 - 2 * k)), o = (j * W + i) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = a; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  softCache.set(key, t);
  return t;
}
export function tex(name) { return cache[name] || (cache[name] = B[name]()); }

// Aynı görüntüyü farklı tekrar sayısıyla kullanmak için klon. rep etiketiyle models.js mat() aynı görüntü ve tekrardaki klonlara tek
// malzeme verir: her araç, kasa, tezgâh yapılışında yeni malzeme açılıp önbellekte ve toplu çizimde birikmesin (perf.js)
export function texRep(name, rx, ry) {
  const t = tex(name).clone();
  t.repeat.set(rx, ry ?? rx);
  t.needsUpdate = true;
  t.userData.rep = `${name}|${rx}|${ry ?? rx}`;
  return t;
}

// Dükkan duvarı: krem sıva + alt bant (kişiselleştirme rengi)
export function plasterOf(color, rx = 1, ry = 1) {
  const key = `pl_${color}`;
  if (!cache[key]) {
    const c = canvas(256), g = c.getContext('2d'), r = rng(22);
    g.fillStyle = '#fff3dc'; g.fillRect(0, 0, 256, 256);
    blobs(g, 256, r, 50, ['rgba(240,226,200,0.5)', 'rgba(255,250,238,0.6)'], 10, 30);
    g.fillStyle = color; g.fillRect(0, 176, 256, 80);
    g.fillStyle = '#ffffff'; g.fillRect(0, 170, 256, 8);
    dots(g, 256, r, 200, ['rgba(255,255,255,0.25)'], 1, 3);
    cache[key] = toTex(c);
  }
  const t = cache[key].clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

// Tente / şemsiye şeritleri: görüntüde yatay bantlar
export function stripes(c1, c2, n = 8) {
  const key = `st_${c1}_${c2}_${n}`;
  if (cache[key]) return cache[key];
  const c = canvas(64, 256), g = c.getContext('2d');
  const h = 256 / n;
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(0, i * h, 64, h); }
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < n; i++) g.fillRect(0, i * h + h - 3, 64, 3);
  return (cache[key] = toTex(c));
}

// Düz tentenin fırfırı: üstte iki renkli dikey bantlar, altta yarım daire dilimler (dilimlerin arası saydam: alphaTest)
export function scallop(c1, c2, n = 8) {
  const key = `sc_${c1}_${c2}_${n}`;
  if (cache[key]) return cache[key];
  const c = canvas(256, 64), g = c.getContext('2d'), w = 256 / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * w, 0, w, 34);
    g.beginPath(); g.arc(i * w + w / 2, 34, w / 2, 0, Math.PI); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 30, 256, 4);
  return (cache[key] = toTex(c));
}

// Dikey bantlar (koni/şemsiye için)
export function vstripes(c1, c2, n = 8) {
  const key = `vs_${c1}_${c2}_${n}`;
  if (cache[key]) return cache[key];
  const c = canvas(256, 64), g = c.getContext('2d');
  const w = 256 / n;
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(i * w, 0, w, 64); }
  return (cache[key] = toTex(c));
}

export function textTex(text, o = {}) {
  const w = o.w || 512, h = o.h || 128;
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = o.bg || '#e8604c';
  if (o.bg !== 'none') { roundRect(g, 0, 0, w, h, o.r ?? 24); g.fill(); } // 'none': yalnız harfler (kabartma harf tabela)
  if (o.grain) { g.save(); roundRect(g, 0, 0, w, h, o.r ?? 24); g.clip(); g.globalAlpha = 0.45; for (let x = 0; x < w; x += 256) for (let y = 0; y < h; y += 256) g.drawImage(tex('wood').image, x, y); g.restore(); } // tahta levha tabela
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = 10; roundRect(g, 8, 8, w - 16, h - 16, (o.r ?? 24) - 6); g.stroke(); }
  g.fillStyle = o.fg || '#ffffff';
  let size = o.size || Math.round(h * 0.55);
  g.font = `900 ${size}px 'Nunito','Segoe UI',sans-serif`;
  // uzun yazı tabeladan taşmasın: çerçevenin içine sığana kadar küçülür
  const room = w - (o.border ? 56 : 32), tw = g.measureText(text).width;
  if (tw > room) { size = Math.floor((size * room) / tw); g.font = `900 ${size}px 'Nunito','Segoe UI',sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = Math.max(4, size * 0.16); g.strokeStyle = o.stroke; g.strokeText(text, w / 2, h / 2 + 4); }
  g.fillText(text, w / 2, h / 2 + 4);
  return toTex(c, false);
}

// Zemin işaretleri: yuvarlak köşeli çerçeve (dolu veya kesik çizgili)
export function markerTex(w, d, dashed) {
  const key = `mk_${w}_${d}_${dashed ? 1 : 0}`;
  if (cache[key]) return cache[key];
  const ppm = 64, cw = Math.round(w * ppm), ch = Math.round(d * ppm);
  const c = canvas(cw, ch), g = c.getContext('2d');
  const lw = 0.16 * ppm, rad = 0.45 * ppm;
  g.fillStyle = dashed ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)';
  roundRect(g, lw / 2, lw / 2, cw - lw, ch - lw, rad); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = lw;
  if (dashed) g.setLineDash([0.42 * ppm, 0.26 * ppm]);
  roundRect(g, lw / 2, lw / 2, cw - lw, ch - lw, rad); g.stroke();
  return (cache[key] = toTex(c, false));
}

// Zemin dokuları dünyaya hizalı (2026-11-04 kullanıcı: "yolların çizgileri tam uyuşmuyor, zeminlerde hiza ve kaymalar var"):
// texRep her parçada dokuyu kendi köşesinden başlatıyordu; yan yana duran aynı dokulu parçalarda (kaldırım, yol, tahta iskele)
// taş ve tahta çizgileri dikişte kayıyordu. Yere yatık PlaneGeometry ile BoxGeometry'nin dokusu dünya koordinatından başlar.
// Yalnız döndürülmemiş (eksenleri x ve z'ye bakan) ve dokusu (texRep kopyası) tek parçada kullanılanlar
const _ab = new THREE.Box3();
export function alignGroundUV(root) {
  const uses = new Map(), list = [];
  root.traverse((o) => {
    const m = o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material) ? o.material : null;
    if (!m || !m.map || !m.map.userData.rep) return;
    uses.set(m.map, (uses.get(m.map) || 0) + 1);
    const t = o.geometry.type;
    if (t === 'PlaneGeometry' || t === 'BoxGeometry') list.push(o);
  });
  const ok = (a, b) => Math.abs(a - b) < 1e-3;
  for (const o of list) {
    const t = o.material.map;
    if (uses.get(t) !== 1 || t.rotation) continue;
    o.updateWorldMatrix(true, false);
    const e = o.matrixWorld.elements, sx = Math.hypot(e[0], e[1], e[2]);
    if (!(sx > 0) || !ok(e[0] / sx, 1)) continue; // yerel x dünya +x'e bakmalı
    if (o.geometry.type === 'PlaneGeometry') { const sy = Math.hypot(e[4], e[5], e[6]); if (!(sy > 0) || !ok(e[6] / sy, -1)) continue; } // yere yatık (yerel y dünya −z)
    else { const sz = Math.hypot(e[8], e[9], e[10]); if (!(sz > 0) || !ok(e[10] / sz, 1)) continue; }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    _ab.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    const tx = (_ab.max.x - _ab.min.x) / t.repeat.x, tz = (_ab.max.z - _ab.min.z) / t.repeat.y;
    if (!(tx > 0.05) || !(tz > 0.05)) continue;
    const u = _ab.min.x / tx, v = -_ab.max.z / tz;
    t.offset.set(u - Math.floor(u), v - Math.floor(v));
  }
}
