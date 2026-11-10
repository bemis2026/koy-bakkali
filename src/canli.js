// Canlı ziyaret: aynı köyde en çok 4 oyuncu birbirini canlı görür, emoji, hazır cümle ya da kısa yazıyla konuşur. Her
// oyuncunun oyunu köyü kendi işletir; kişiler, yazışma ve misafirin emeği paylaşılır.
// Birlikte çalışma: ev sahibi o an oyundaysa misafirin yardım vardiyasında dizdiği ürün ev sahibinin aynı rafına uçar,
// topladığı para ev sahibine anında geçer (rooms/{sahip}/acts; ev sahibi uygular ve siler). Ev sahibi yoksa eskisi gibi
// vardiya bitince gelen kutusuna gider; canlı giden para ikinci kez gitmez (online.js finishHelp).
// Oda = köyün sahibinin kimliği. Üye olan oyuncu kendi köyündeyken odası açıktır (ev sahibi); komşu ziyaretinde (online-ui.js
// G.visit) ziyaret edilen köyün odasına girer. Herkes kendi konumunu en çok saniyede 6 kez yazar (yerinde dururken 5 sn'de
// bir); ötekiler karakter olarak görünür ve konumuna yumuşakça yürür. Sayfa kapanınca sunucu kişiyi odadan siler.
// Arka uç: Firebase Realtime Database (rooms/{sahip}/players/{uid}, rooms/{sahip}/chat; kurallar database.rules.json).
// Yerel denemede (?deneme=1) aynı arayüz tarayıcı kanalıyla (BroadcastChannel) çalışır.
import { G, ITEMS, Shelf, makeItem, fly, floatText, toast } from './game.js';
import * as M from './models.js';
import { ON, signedIn, liveDb, sendFeedback } from './online.js';
import { temiz } from './filtre.js'; // kötü söz süzgeci: adlar ve yazışma yıldızlanır

const MAX = 4, SEND = 1 / 6, IDLE = 5, STALE = 20000;
const EMOJI = ['👋', '👍', '❤️', '😂', '🎉', '🙏', '😮', '🔥'];
const PHRASES = ['Merhaba!', 'Köyün çok güzel!', 'Kasaya bakıyorum', 'Rafları dolduruyorum', 'Şehre gidiyorum', 'Görüşürüz!'];
let room = null, me = null, others = new Map(), sendT = 0, idleT = 0, last = null, ui = null, log = [];

// ---------- arka uçlar ----------
async function firebaseRoom(host, uid) {
  const L = await liveDb();
  if (!L || L.mock) return L && L.mock ? mockRoom(host, uid) : null;
  const { D, db } = L, base = `rooms/${host}`;
  const meRef = D.ref(db, `${base}/players/${uid}`);
  D.onDisconnect(meRef).remove();
  return {
    count: async () => { const s = await D.get(D.ref(db, `${base}/players`)); return s.exists() ? Object.keys(s.val()).length : 0; },
    put: (data) => D.set(meRef, data).catch(() => {}),
    onPlayers: (cb) => D.onValue(D.ref(db, `${base}/players`), (s) => cb(s.val() || {})),
    say: (text) => D.push(D.ref(db, `${base}/chat`), { uid, name: me.name, text, t: Date.now() }).catch(() => {}),
    onChat: (cb) => D.onChildAdded(D.query(D.ref(db, `${base}/chat`), D.limitToLast(8)), (s) => cb(s.val(), s.key)),
    trim: async () => { // ev sahibi eski yazışmayı siler (son 20 kalır)
      const s = await D.get(D.ref(db, `${base}/chat`)); if (!s.exists()) return;
      const keys = Object.keys(s.val()); for (const k of keys.slice(0, Math.max(0, keys.length - 20))) D.remove(D.ref(db, `${base}/chat/${k}`)).catch(() => {});
    },
    act: (a) => D.push(D.ref(db, `${base}/acts`), { ...a, uid, t: Date.now() }).catch(() => {}),
    onAct: (cb) => D.onChildAdded(D.ref(db, `${base}/acts`), (s) => { cb(s.val()); D.remove(s.ref).catch(() => {}); }), // yalnız ev sahibi
    leave: () => { D.remove(meRef).catch(() => {}); D.off(D.ref(db, `${base}/players`)); },
  };
}
// yerel deneme: aynı tarayıcının sekmeleri arasında kanal; kişi 5 sn ses vermezse düşer
function mockRoom(host, uid) {
  const ch = new BroadcastChannel(`koyBakkali.canli.${host}`), seen = {}, ps = {};
  let onP = () => {}, onC = () => {}, onA = () => {};
  ch.onmessage = (e) => {
    const m = e.data;
    if (m.k === 'p') { ps[m.uid] = m.d; seen[m.uid] = Date.now(); onP({ ...ps }); }
    else if (m.k === 'x') { delete ps[m.uid]; onP({ ...ps }); }
    else if (m.k === 'c') onC(m.msg, `${m.msg.t}${m.msg.uid}`);
    else if (m.k === 'a') onA(m.a);
  };
  setInterval(() => { const now = Date.now(); let ch2 = false; for (const k in seen) if (now - seen[k] > 5000) { delete ps[k]; delete seen[k]; ch2 = true; } if (ch2) onP({ ...ps }); }, 1000);
  addEventListener('pagehide', () => ch.postMessage({ k: 'x', uid }));
  return {
    count: async () => Object.keys(ps).length,
    put: (d) => { ps[uid] = d; ch.postMessage({ k: 'p', uid, d }); onP({ ...ps }); },
    onPlayers: (cb) => { onP = cb; },
    say: (text) => { const msg = { uid, name: me.name, text, t: Date.now() }; ch.postMessage({ k: 'c', msg }); onC(msg, `${msg.t}${uid}`); },
    onChat: (cb) => { onC = cb; },
    trim: () => {},
    act: (a) => ch.postMessage({ k: 'a', a: { ...a, uid, t: Date.now() } }),
    onAct: (cb) => { onA = cb; },
    leave: () => { ch.postMessage({ k: 'x', uid }); ch.close(); },
  };
}

// ---------- kişiler ----------
function avatar(uid, d) {
  const o = M.makeCharacter({ shirt: d.c || '#3b8beb', pants: '#2d3e66', hat: 'cap', hatColor: '#ffd23f', skin: '#f3cfae' });
  o.position.set(d.x, 0, d.z); o.rotation.y = d.r || 0;
  G.scene.add(o);
  const el = document.createElement('div'); el.className = 'staff live'; el.textContent = `${d.a || '🧑‍🌾'} ${temiz(d.n) || 'Komşu'}`;
  const tag = G.labels.add(el, (v) => v.copy(o.position).setY(o.position.y + 2.5));
  return { uid, o, tag, el, d, tx: d.x, tz: d.z, tr: d.r || 0, bub: null, bubT: 0 };
}
function drop(p) { G.scene.remove(p.o); G.labels.remove(p.tag); if (p.bub) G.labels.remove(p.bub); others.delete(p.uid); }
function players(map) {
  const now = Date.now();
  for (const [uid, p] of others) if (!map[uid] || now - (map[uid].t || 0) > STALE) drop(p);
  for (const uid in map) {
    if (uid === me.uid) continue;
    const d = map[uid];
    if (now - (d.t || 0) > STALE || (d.w || 'koy') !== (G.world || 'koy')) { const p = others.get(uid); if (p) drop(p); continue; } // başka dünyada (şehir) olan görünmez
    let p = others.get(uid);
    if (!p) { p = avatar(uid, d); others.set(uid, p); toast(`${d.a || '🧑‍🌾'} ${temiz(d.n) || 'Bir komşu'} köyde`); }
    p.d = d; p.tx = d.x; p.tz = d.z; p.tr = d.r || 0;
  }
  if (ui) ui.btn.style.display = others.size ? 'flex' : 'none';
  if (G.visit) { // misafir: ev sahibi şu an oyunda mı (kendi köyünde)
    const h = map[G.visit.uid], live = !!(h && now - (h.t || 0) < STALE);
    if (live && !hostLive) toast(`🔴 ${G.visit.name} şu an oyunda: dizdiğin ürünler ve topladığın para ona anında gidiyor`);
    hostLive = live;
  }
}
function bubble(uid, text) {
  const p = uid === me.uid ? { o: G.player } : others.get(uid);
  if (!p || !p.o) return;
  if (p.bub) G.labels.remove(p.bub);
  const el = document.createElement('div'); el.className = 'bubble livesay'; el.textContent = text;
  p.bub = G.labels.add(el, (v) => v.copy(p.o.position).setY(p.o.position.y + 3.1), 6);
}

// ---------- birlikte çalışma ----------
let hostLive = false, paraT = 0, greeted = new Set();
const skey = (st) => `${Math.round(st.zone.x * 10)}:${Math.round(st.zone.z * 10)}`; // raf iki oyunda da aynı yerde kurulur
const V3 = () => G.player.position.clone().set(0, 0, 0);
// misafir: dizdiği her ürün (game.js Shelf.update kancası)
function stocked(shelf, type) {
  const V = G.visit;
  if (!V || V.ended) return;
  V.stocked = (V.stocked || 0) + 1;
  if (hostLive && room) room.act({ k: 'stock', key: skey(shelf), type });
}
// ev sahibi: misafirin emeğini kendi köyüne uygular
function applyAct(a) {
  if (!a || a.uid === me.uid) return;
  const who = others.get(a.uid), name = (who && who.d.n) || 'Komşu', from = who ? who.o.position : G.player.position;
  if (!greeted.has(a.uid)) { greeted.add(a.uid); toast(`🤝 ${name} yardım ediyor: dizdiği ürünler ve topladığı para sana geliyor`); }
  if (a.k === 'para' && a.n > 0) {
    const n = Math.min(50000, Math.floor(a.n));
    G.money += n;
    floatText(from, `🤝 +${n.toLocaleString('tr-TR')} ₺`, 'pos');
  } else if (a.k === 'stock' && ITEMS[a.type]) {
    const sh = G.stations.find((s) => s instanceof Shelf && skey(s) === a.key);
    if (!sh || !sh.hasSpaceFor(a.type)) return; // rafı doluysa emek boşa gitmez sayılmaz: misafirin puanı yine yazılır
    const i = sh.slots.indexOf(null), obj = makeItem(a.type);
    obj.position.copy(from).setY(1.4); G.scene.add(obj);
    sh.slots[i] = { type: a.type, obj };
    fly(obj, sh.anchors[i], V3(), 0.45, 1.3);
  }
}

// ---------- yazışma ----------
const CSS = `#chatBtn { position: absolute; right: 22px; bottom: 236px; width: 52px; height: 52px; border-radius: 50%; display: none; place-items: center; font-size: 26px; cursor: pointer; }
#chatPan { position: absolute; right: 22px; bottom: 296px; width: min(320px, calc(100vw - 28px)); padding: 10px 12px; border-radius: 16px; display: none; z-index: 31; font: 14px/1.35 var(--font-body); }
#chatPan.on { display: block; }
#chatPan .em, #chatPan .ph { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
#chatPan button { border: 0; border-radius: 10px; padding: 5px 8px; background: rgba(0,0,0,.07); font: inherit; cursor: pointer; }
#chatPan .em button { font-size: 20px; padding: 3px 6px; }
#chatPan form { display: flex; gap: 6px; } #chatPan input { flex: 1; min-width: 0; border-radius: 10px; border: 1px solid rgba(0,0,0,.2); padding: 6px 8px; font: inherit; }
#chatPan .log { max-height: 110px; overflow: auto; margin-bottom: 8px; } #chatPan .log p { margin: 2px 0; } #chatPan .log b { font-weight: 800; }
.staff.live { background: #3b8beb; color: #fff; }
.bubble.livesay { max-width: 180px; white-space: normal; text-align: center; }
@media (max-width: 640px) { #chatBtn { right: 14px; bottom: 262px; width: 46px; height: 46px; } #chatPan { right: 14px; bottom: 314px; } }`;
function buildUi() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const hud = document.getElementById('hud') || document.body;
  const btn = document.createElement('div'); btn.id = 'chatBtn'; btn.className = 'hp'; btn.textContent = '💬'; btn.title = 'Köydekilerle yazış';
  const pan = document.createElement('div'); pan.id = 'chatPan'; pan.className = 'hp';
  pan.innerHTML = `<div class="log"></div><div class="em">${EMOJI.map((e) => `<button type="button" data-t="${e}">${e}</button>`).join('')}</div>
<div class="ph">${PHRASES.map((p) => `<button type="button" data-t="${p}">${p}</button>`).join('')}</div>
<form><input maxlength="80" placeholder="Bir şey yaz…" autocomplete="off"><button type="submit">Gönder</button></form>`;
  btn.onclick = (e) => { e.stopPropagation(); pan.classList.toggle('on'); };
  pan.addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) send(b.dataset.t); });
  const inp = pan.querySelector('input');
  inp.addEventListener('keydown', (e) => e.stopPropagation()); // yazarken WASD oyuncuyu yürütmesin
  pan.querySelector('form').onsubmit = (e) => { e.preventDefault(); send(inp.value); inp.value = ''; };
  hud.append(btn, pan);
  ui = { btn, pan, log: pan.querySelector('.log') };
}
function send(text) {
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!text || !room) return;
  room.say(temiz(text));
}
let joined = 0;
function heard(msg) {
  if (!msg || typeof msg.text !== 'string' || muted().includes(msg.uid)) return;
  msg = { ...msg, name: temiz(String(msg.name || 'Komşu')), text: temiz(msg.text) };
  if ((msg.t || 0) > joined - 30000) bubble(msg.uid, msg.text); // girişten önceki eski yazılar balon olmaz, yalnız listede
  log.push(msg); if (log.length > 6) log.shift();
  drawLog();
}
// susturma ve bildirme (2026-11-10): başkasının satırına dokununca 🔇 Sustur / 🚩 Bildir çıkar. Susturulan oyuncunun yazısı
// bu cihazda bir daha görünmez; bildirim öneri kutusuna 'sikayet' olarak gider (yalnız yönetici okur)
const MUTE = 'koyBakkali.sustur';
const muted = () => { try { return JSON.parse(localStorage.getItem(MUTE) || '[]'); } catch (e) { return []; } };
let openRow = -1;
function drawLog() {
  if (!ui) return;
  ui.log.innerHTML = '';
  log.forEach((m, i) => {
    const p = document.createElement('p'); const b = document.createElement('b'); b.textContent = `${m.name}: `; p.append(b, m.text);
    if (m.uid !== me.uid) {
      p.style.cursor = 'pointer';
      p.onclick = (e) => { e.stopPropagation(); if (e.target.closest('button')) return; openRow = openRow === i ? -1 : i; drawLog(); };
      if (openRow === i) {
        const row = document.createElement('span'); row.style.cssText = 'display:flex;gap:6px;margin:3px 0 4px';
        const mute = document.createElement('button'); mute.type = 'button'; mute.textContent = '🔇 Sustur';
        mute.onclick = () => { const l = muted(); if (!l.includes(m.uid)) l.push(m.uid); try { localStorage.setItem(MUTE, JSON.stringify(l.slice(-200))); } catch (err) { /* yok */ } for (let k = log.length - 1; k >= 0; k--) if (log[k].uid === m.uid) log.splice(k, 1); openRow = -1; drawLog(); toast(`🔇 ${m.name} susturuldu`); };
        const rep = document.createElement('button'); rep.type = 'button'; rep.textContent = '🚩 Bildir';
        rep.onclick = () => { sendFeedback('sikayet', `uid ${m.uid} · ${m.name}: ${m.text} · köy ${G.visit ? G.visit.uid : me.uid}`).catch(() => {}); openRow = -1; drawLog(); toast('🚩 Bildirildi, teşekkürler'); };
        row.append(mute, rep); p.append(row);
      }
    }
    ui.log.append(p);
  });
}

// ---------- giriş ve her kare ----------
export async function initCanli() {
  if (ON.mode === 'off' || !signedIn()) return;
  const host = G.visit ? G.visit.uid : ON.user.uid, P = ON.profile;
  me = { uid: ON.user.uid, name: (P && (P.name || P.username)) || 'Oyuncu', avatar: (P && P.avatar) || '🧑‍🌾', color: (P && P.color) || G.custom.shirt };
  try { room = ON.mode === 'mock' ? mockRoom(host, me.uid) : await firebaseRoom(host, me.uid); } catch (e) { console.warn('canlı ziyaret açılamadı', e); room = null; }
  if (!room) return;
  if (G.visit && (await room.count()) >= MAX) { toast('👥 Bu köy şu an dolu (4 kişi): canlı görünmeden ziyaret ediyorsun'); room = null; return; }
  joined = Date.now();
  buildUi();
  room.onPlayers(players);
  room.onChat(heard);
  if (G.visit) G.hooks.stocked = stocked; else room.onAct(applyAct); // birlikte çalışma
  if (!G.visit) room.trim();
  addEventListener('pagehide', () => room && room.leave());
}
export function updateCanli(dt) {
  if (!room || !G.player) return;
  const p = G.player.position, r = G.player.rotation.y, w = G.world || 'koy';
  sendT -= dt; idleT -= dt;
  const moved = !last || Math.abs(p.x - last.x) + Math.abs(p.z - last.z) > 0.05 || Math.abs(r - last.r) > 0.1 || w !== last.w;
  if ((moved && sendT <= 0) || idleT <= 0) {
    sendT = SEND; idleT = IDLE; last = { x: p.x, z: p.z, r, w };
    room.put({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, r: Math.round(r * 100) / 100, w, n: me.name, a: me.avatar, c: me.color, t: Date.now() });
  }
  if (G.visit && hostLive && !G.visit.ended && (paraT -= dt) <= 0) { // misafirin topladığı net para ev sahibine (5 ₺'den küçükse birikir)
    paraT = 1;
    const V = G.visit, net = Math.max(0, Math.floor(G.money - V.purse)), d = net - (V.liveSent || 0);
    if (d >= 5) { V.liveSent = net; room.act({ k: 'para', n: d }); }
  }
  const k = Math.min(1, dt * 8);
  for (const q of others.values()) {
    const o = q.o, dx = q.tx - o.position.x, dz = q.tz - o.position.z, far = Math.hypot(dx, dz);
    if (far > 12) o.position.set(q.tx, 0, q.tz); // çok gerideyse (otobüs, ışınlanma) atlar
    else { o.position.x += dx * k; o.position.z += dz * k; }
    let dr = q.tr - o.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); o.rotation.y += dr * k;
    M.animateCharacter(o, far > 0.08 ? 1 : 0, dt, false);
  }
}
