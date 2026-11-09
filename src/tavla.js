// Sahildeki masalarda tavla (2026-11-09 kullanıcı: "sahilde masa sandalye var ters duruyo orda tavla oynayanlar olsun gelip arada").
// İki yerli tahta yürüyüş yolundan gelir, masanın iki yanındaki sandalyelere oturur, tavlayı masaya açar, sırayla pul oynar, sonra kalkıp gider.
// Masa bir süre boş kalır, sonra yeni bir çift gelir. Yağışta gelmezler, oynayanlar kalkar. Sipariş vermezler, para ve memnuniyete dokunmazlar.
// Masa listesi R.tavla (detay.js sahil), kare güncellemesi world.js R.update.
import * as THREE from 'three';
import { G, Customer } from './game.js';
import * as M from './models.js';
import { havaIslak } from './hava.js';

const PI = Math.PI, LANE = 13.6, LANE_OUT = 14.4, SIDE = 1.3, SEAT = 0.75, TOP = 0.765;
const FIRST = [6, 26], PLAY = [55, 110], REST = [40, 110], FROM = [48, 70];
const V = (x, z) => new THREE.Vector3(x, 0, z), rand = (a, b) => a + Math.random() * (b - a);

// tavla: koyu ahşap kasa, üstünde tek dokuda 24 hane, orta bant ve pullar
let B = null;
function boardParts() {
  if (B) return B;
  const c = document.createElement('canvas'); c.width = 320; c.height = 216;
  const x = c.getContext('2d'), W = 320, H = 216, m = 12, bar = 18, cw = (W - m * 2 - bar) / 12;
  x.fillStyle = '#6b3f22'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#e2c79a'; x.fillRect(m, m, W - m * 2, H - m * 2);
  x.fillStyle = '#6b3f22'; x.fillRect(W / 2 - bar / 2, 0, bar, H);
  for (let i = 0; i < 12; i++) {
    const cx = m + cw * i + (i >= 6 ? bar : 0);
    for (const up of [true, false]) {
      x.fillStyle = (i + (up ? 1 : 0)) % 2 ? '#8e2f25' : '#2f5a4a';
      x.beginPath(); x.moveTo(cx, up ? m : H - m); x.lineTo(cx + cw, up ? m : H - m); x.lineTo(cx + cw / 2, up ? H * 0.43 : H * 0.57); x.fill();
    }
  }
  const pul = (i, up, n, col) => {
    for (let k = 0; k < n; k++) {
      const px = m + cw * (i + 0.5) + (i >= 6 ? bar : 0), py = up ? m + 9 + k * 15 : H - m - 9 - k * 15;
      x.fillStyle = col; x.beginPath(); x.arc(px, py, 8, 0, PI * 2); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1.5; x.stroke();
    }
  };
  for (const [i, up, n, col] of [[0, true, 2, '#f5efe2'], [5, false, 5, '#f5efe2'], [7, false, 3, '#f5efe2'], [11, true, 5, '#f5efe2'], [0, false, 2, '#2a2320'], [5, true, 5, '#2a2320'], [7, true, 3, '#2a2320'], [11, false, 5, '#2a2320']]) pul(i, up, n, col);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  B = { box: new THREE.BoxGeometry(0.62, 0.04, 0.42), top: new THREE.PlaneGeometry(0.6, 0.4).rotateX(-PI / 2), mBox: M.mat('#5a3419'), mTop: new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }) };
  return B;
}
function makeBoard(T) {
  const P = boardParts(), g = new THREE.Group(), box = new THREE.Mesh(P.box, P.mBox), top = new THREE.Mesh(P.top, P.mTop);
  box.position.y = 0.02; box.castShadow = true; top.position.y = 0.0415; g.add(box, top);
  g.position.set(T.x, TOP, T.z); g.rotation.y = PI / 2; // uzun kenarı oyuncuların arasında kalır, hanelere iki taraftan da uzanılır
  return g;
}

function player(R, T, sx, x0) {
  const sp = V(T.x + sx * SIDE, T.z), ry = sx > 0 ? -PI / 2 : PI / 2;
  const c = new Customer(V(x0, LANE + rand(-0.2, 0.2)), 'sahil', M.villagerLook());
  c.go(V(sp.x, LANE), sp);
  c.state = 'come'; c.t = 0; c.ph = rand(0, 6);
  const stand = () => { c.sit = false; c.obj.position.set(sp.x, 0, sp.z); c.clearBubble(); c.path = [V(sp.x, LANE_OUT), V(x0, LANE_OUT)]; c.leaving = true; c.state = 'leave'; };
  c.rise = () => { if (c.state === 'come') { c.path = [V(x0, LANE_OUT)]; c.leaving = true; c.state = 'leave'; } else if (c.state === 'sit') stand(); };
  // oturuş taban güncellemesinden sonra: sırası gelen tahtaya uzanır, öbürü seyreder
  const base = c.update.bind(c);
  c.update = (dt) => {
    base(dt);
    if (!c.sit) return;
    c.obj.position.y = 0.12; c.obj.rotation.y = ry;
    const u = c.obj.userData, my = T.turn === sx;
    for (const l of u.legs) l.rotation.x = -1.35;
    const t = G.time + c.ph, bob = my ? Math.max(0, Math.sin(t * 5)) * 0.22 : Math.sin(t * 0.8) * 0.04;
    u.arms[0].rotation.x = (my ? -1.3 : -0.85) - bob; u.arms[1].rotation.x = -0.85;
    u.head.rotation.x = my ? 0.4 : 0.25; u.head.rotation.y = my ? 0 : Math.sin(t * 0.4) * 0.25;
  };
  c.think = (dt) => {
    if (c.state === 'come' && c.walk(dt)) { c.state = 'sit'; c.sit = true; c.obj.position.set(T.x + sx * SEAT, 0.12, T.z); }
    else if (c.state === 'leave' && c.walk(dt)) c.destroy();
  };
  return c;
}

function clearTable(R, T) {
  if (T.board) { T.board.removeFromParent(); T.board = null; }
  T.cs = []; T.t = rand(REST[0], REST[1]);
}
function say(c, s) { c.setBubbleText(s); clearTimeout(c.sayT); c.sayT = setTimeout(() => c.clearBubble(), 1300); }

export function updateTavla(R, dt) {
  if (!R.tavla) return;
  const wet = havaIslak();
  for (const T of R.tavla) {
    if (T.t === undefined) { T.t = rand(FIRST[0], FIRST[1]); T.cs = []; T.board = null; T.turn = -1; }
    if (!T.cs.length) {
      if (!wet && (T.t -= dt) <= 0) {
        const x0 = T.x + (T.x < 30 ? -1 : 1) * rand(FROM[0], FROM[1]);
        T.play = rand(PLAY[0], PLAY[1]);
        T.cs = [player(R, T, -1, x0), player(R, T, 1, x0 + 1.2)];
      }
      continue;
    }
    if (T.cs.every((c) => c.state === 'leave')) { clearTable(R, T); continue; }
    if (wet) { for (const c of T.cs) c.rise(); continue; }
    if (T.cs.some((c) => c.sit) && !T.board) R.content.add((T.board = makeBoard(T)));
    if (!T.cs.every((c) => c.sit)) continue;
    T.play -= dt;
    if ((T.next = (T.next || 0) - dt) <= 0) { // sıra karşıya geçer, zar atan kişinin üstünde 🎲
      T.next = rand(3.5, 7); T.turn = -T.turn;
      if (Math.random() < 0.3) say(T.cs[T.turn > 0 ? 1 : 0], '🎲');
    }
    if (T.play <= 0) for (const c of T.cs) c.rise();
  }
}
