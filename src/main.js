// Giriş: render, kamera, ışık, kontrol, oyun döngüsü
import * as THREE from 'three';
import { initLang } from './dil.js';
import { G, ITEMS, Labels, Stack, makeItem, initAudio, updateCore, save, loadSave, clearSave, writeSave, lerpAngle, toast, updateFading, VIEW } from './game.js';
import { pickSave, applyFlag, markNewGame, diskSave } from './persist.js';
import { onlineGate, onlineStart, cloudNewer } from './online-ui.js';
import { initOnline } from './online.js';
import { tekSekme, kaliciDepo, ekranKarti, hataRaporu, hata } from './koruma.js'; // tek sekme, yedek, ekran kartı, hata raporu
hataRaporu();
import { initInstall } from './install.js';
import * as M from './models.js';
import { buildWorld, updateWorld, walkable, heightAt, regionAt, doShout, applyCustom } from './world.js';
import { updateYemlik } from './yemlik.js';
import { updateMutfak } from './mutfak.js';
import { updateKano } from './kano.js';
import { updatePark } from './park.js'; // e-ticaret ofisinin yerinde çocuk parkı (2026-11-09)
import { updateCityLife } from './sehirhayat.js';
import { updateTahsilat } from './tahsilat.js';
import { startRun, stopRun, steer as runSteer, running } from './autorun.js';
import { playCinema, playShots, cineActive, cineCamera } from './cinema.js';
import { alignGroundUV } from './tex.js';
import { renderDof } from './dof.js';
import { initUpgrades, updateUpgrades, toggleMenu } from './upgrades.js';
import { initUI, updateUI, setTip, initCustomize, openCustomize } from './ui.js';
import { updateRehber } from './rehber.js';
import { needsReady, needTick } from './sart.js';
import { updateCalgi } from './calgi.js';
import { initMenu, updateMenu, openMenu, closeMenu, isMenuOpen } from './menu.js';
import { initTasarim } from './tasarim.js';
import { initCursor, updateCursor } from './cursor.js';
import { openGround } from './nature.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { updateGround } from './zfix.js';
import { updateFx, smoke, ring } from './fx.js';
import { J, hasJump, tryJump, stepJump, runSpeed, updateYetenek } from './yetenek.js';
import { setMusicRegion, setMusicStage, settings, saveSettings } from './audio.js';
import { initEvents, updateEvents } from './events.js';
import { say } from './texts.js';
import { sweepSizes, layerMask, bakeTick, bakeStats, setArmShadows } from './perf.js';
import { initDaylight, updateDaylight } from './daylight.js';
import { initGorev, updateGorev } from './gorev.js';
import { initMevsim, updateMevsim } from './mevsim.js';
import { initCanli, updateCanli } from './canli.js';
import { updateSincap } from './sincap.js'; // ağaçlarda ve ağaç diplerinde sincaplar
import { updateHoca } from './hoca.js'; // sürpriz: eşeğine ters binen Nasreddin Hoca
import { updateColFit, shapeOf, pushPoly, inPoly, OUT as COL_OUT } from './colfit.js'; // engel kutuları nesnenin gerçek izine uyar
import { TIERS, QNAME, tierOf, initQuality } from './kalite.js';

const canvas = document.getElementById('c');
const TOUCH = matchMedia('(pointer: coarse)').matches;
// görüntü kalitesi oyun kurulmadan seçilir (kalite.js): kodla çizilen şekillerin ayrıntısı ve kenar yumuşatma buna göre. Kenar yumuşatma
// yalnız masaüstünde Yüksek/Orta'da (telefonda yüksek piksel yoğunluğunda farkı az, yükü çok); sonradan değişirse yeniden açılışta uygulanır
const Q0 = initQuality();
M.setDetail(tierOf(Q0).detail);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH && tierOf(Q0).pr >= 1.5 });
ekranKarti(canvas); // bağlam düşerse kayıt yazılır, yeniden aç perdesi (koruma.js)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // gölge haritası renderFrame'de yenilenir: uzaktan bakarken her karede değil
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
G.renderer = renderer; // albümün bölge kartpostalı kendi kamerasıyla çizer (album.js)

const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfe6ff');
scene.fog = new THREE.Fog('#bfe6ff', 80, 240);
const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 400);
G.scene = scene; G.camera = camera;

const hemi = new THREE.HemisphereLight('#ffffff', '#9cc27e', 1.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e2', 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 90;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

const FOOD = [['tomato', 0.42], ['paprika', 0.42], ['eggplant', 0.5], ['watermelon', 0.62], ['corn', 0.55], ['ice-cream', 0.5], ['loaf-round', 0.5], ['bowl-soup', 0.5], ['bag', 0.55], ['barrel', 0.95], ['cheese', 0.42], ['pot-stew', 0.6], ['carton', 0.42], ['egg', 0.3], ['cabbage', 0.42], ['pumpkin', 0.5], ['apple', 0.2], ['orange', 0.2], ['lemon', 0.18]];
const CARS = [['truck', 5.6], ['delivery', 5.0], ['van', 4.6], ['sedan', 4.4], ['taxi', 4.4], ['tractor', 3.4], ['cone', 0.6], ['suv', 4.6]];
const MODEL_LIST = FOOD.map(([k, s]) => [k, `assets/food/${k}.glb`, s]).concat(CARS.map(([k, s]) => [k, `assets/cars/${k}.glb`, s]));

// ---------- ürün simgeleri (balonlar için) ----------
// Simgeler bu cihazda saklanır (koyBakkali.icons): açılışta ikinci bir çizim bağlamı kurup her ürünü yeniden çizmek telefonda
// yarım saniyeden uzun sürüyordu. Ürünün görünüşü değişirse (parça sayısı, köşe sayısı, renkler) parmak izi tutmaz, yeniden çizilir
const ICON_KEY = 'koyBakkali.icons';
function iconPrint(o) {
  let n = 0, str = '';
  o.traverse((c) => { if (!c.isMesh) return; n++; const a = c.geometry && c.geometry.attributes.position; str += `${a ? a.count : 0}:${[].concat(c.material).map((m) => (m && m.color ? m.color.getHexString() : '')).join('')};`; });
  let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return `${n}.${h}`;
}
function makeIcons() {
  let cache = {}; try { cache = JSON.parse(localStorage.getItem(ICON_KEY)) || {}; } catch (e) { cache = {}; }
  const next = {}; let r = null, s, cam, drawn = 0;
  const v = new THREE.Vector3();
  for (const type of Object.keys(ITEMS)) {
    const m = makeItem(type), f = iconPrint(m), hit = cache[type];
    if (hit && hit.f === f && hit.u) { G.icons[type] = hit.u; next[type] = hit; continue; }
    if (!r) {
      r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
      r.setSize(96, 96);
      r.toneMapping = THREE.NeutralToneMapping;
      s = new THREE.Scene();
      s.add(new THREE.HemisphereLight('#ffffff', '#999999', 2.4));
      const d = new THREE.DirectionalLight('#ffffff', 2.2); d.position.set(2, 4, 4); s.add(d);
      cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    }
    s.add(m);
    const box = new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(v).length();
    cam.position.set(c.x + size * 0.35, c.y + size * 0.7, c.z + size * 1.55);
    cam.lookAt(c);
    r.render(s, cam);
    const w = r.domElement.toDataURL('image/webp', 0.92); // webp küçük; desteklemeyen tarayıcı png verir
    G.icons[type] = w.startsWith('data:image/webp') ? w : r.domElement.toDataURL('image/png');
    next[type] = { f, u: G.icons[type] }; drawn++;
    s.remove(m);
  }
  if (r) { r.dispose(); r.forceContextLoss(); }
  if (drawn || Object.keys(cache).length !== Object.keys(next).length) try { localStorage.setItem(ICON_KEY, JSON.stringify(next)); } catch (e) { /* yer yoksa her açılışta çizilir */ }
}
// uzun açılış adımları arasında tarayıcıya nefes aldırır: yükleme çubuğu ve ipucu donmuş görünmesin
const breathe = () => new Promise((res) => setTimeout(res, 0));

// ---------- kontrol ----------
const keys = new Set();
// fare ve dokunmatik aynı: basılan yerde joystick çıkar, karakter sürüklenen yöne koşar (2026-11-01 kullanıcı: "mouse ile
// bastığımız yere doğru değil, mouse'u tutup çevirdiğimiz yöne doğru koşmalı"); iki parmakla yakınlaştırma
const joy = { on: false, ox: 0, oy: 0, x: 0, y: 0, id: null, dx: 0, dy: 0, dirty: false };
// 2026-11-08 kullanıcı: "telefonda parmak ile sağa sola çekme ile hareketi daha hassaslaştır ... hareket çok önemli akıcı olmalı".
// Halka 42 px'ten 30 px'e indi: ters yöne dönmek için parmağı ~50 px yerine ~33 px geri çekmek yeter; ölü bölge 4 px, tam koşu
// 19 px'te (eskiden 34 px). Halka ve düğme parmak her kıpırdadığında değil karede bir kez, transform ile çizilir (sayfa düzeni hesaplanmaz)
const JOY_R = 30, JOY_DEAD = 0.12, JOY_FULL = 0.62;
function drawJoy() {
  joy.dirty = false;
  joyEl.style.transform = `translate3d(${joy.ox}px, ${joy.oy}px, 0)`;
  knobEl.style.transform = `translate3d(${joy.dx}px, ${joy.dy}px, 0)`;
}
const joyEl = document.getElementById('joy'), knobEl = document.getElementById('knob');
const touches = new Map();
let pinch = 0, zoom = 1, zoomT = 1;
const ZOOM_MAX = 4.2; // tekerlekle ne kadar uzaklaşılabilir
const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
const isOpen = (id) => document.getElementById(id).classList.contains('open');
addEventListener('keydown', (e) => {
  if (typing(e)) { if (e.code === 'Escape') e.target.blur(); return; }
  keys.add(e.code); initAudio();
  // Boşluk: zıplama alındıysa zıplar (yetenek.js), yoksa pazarda bağırır. Q hep bağırır
  if (e.code === 'Space') { e.preventDefault(); if (!G.paused) { if (!hasJump()) tryShout(); else if (!e.repeat) tryJump(); } }
  if (e.code === 'KeyQ' && !e.repeat && !G.paused) tryShout();
  // E: yükseltmeler · M: ana menü · Esc: açık pencereyi kapatır, yoksa menüyü açar
  if (e.code === 'KeyE' && !e.repeat) { if (isMenuOpen()) openMenu('upg'); else if (!isOpen('welcome')) toggleMenu(); }
  if (e.code === 'KeyM' && !e.repeat) { if (isMenuOpen()) closeMenu(); else if (!isOpen('welcome')) openMenu(); }
  if (e.code === 'Escape' && !e.repeat) { if (isMenuOpen()) closeMenu(); else if (isOpen('upg')) toggleMenu(false); else if (!isOpen('welcome')) openMenu(); }
  if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomT = Math.max(0.55, zoomT * 0.9);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomT = Math.min(ZOOM_MAX, zoomT * 1.1);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', (e) => {
  if (G.menuOpen) return;
  e.preventDefault();
  zoomT = THREE.MathUtils.clamp(zoomT * (e.deltaY > 0 ? 1.1 : 1 / 1.1), 0.55, ZOOM_MAX);
}, { passive: false });
// orta tuş (tekerlek) basılıyken sürükle: yukarı-aşağı kamera eğimi (ufka bakış ↔ kuşbakışı),
// sağa-sola oyuncunun çevresinde dönüş. Orta tuşa tıklamak açıyı değiştirmez (kullanıcı istemedi).
// Joystick dinleyicilerinden önce kayıtlı ki onlara ulaşmasın.
const PITCH_DEF = Math.atan2(18.5, 15), PITCH_MIN = 0.3, PITCH_MAX = 1.5, TAU = Math.PI * 2;
let pitch = THREE.MathUtils.clamp(settings.camPitch ?? PITCH_DEF, PITCH_MIN, PITCH_MAX), pitchT = pitch;
let yaw = settings.camYaw ?? 0, yawT = yaw; // 0 = kamera güneyde, kuzeye bakar
let lastLz = 0, lastAz = 0;
const tilt = { on: false, id: null, x: 0, y: 0, moved: 0 };
canvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // tarayıcının otomatik kaydırması açılmasın
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 1) return;
  e.preventDefault(); e.stopImmediatePropagation();
  Object.assign(tilt, { on: true, id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sentetik olay */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!tilt.on || e.pointerId !== tilt.id) return;
  e.stopImmediatePropagation();
  const dx = e.clientX - tilt.x, dy = e.clientY - tilt.y;
  tilt.x = e.clientX; tilt.y = e.clientY; tilt.moved += Math.abs(dx) + Math.abs(dy);
  pitchT = THREE.MathUtils.clamp(pitchT + dy * 0.005, PITCH_MIN, PITCH_MAX);
  yawT -= dx * 0.006; // dünyayı tutup çevirir gibi: fare sağa → sahne sağa döner
});
const endTilt = (e) => {
  if (!tilt.on || e.pointerId !== tilt.id) return;
  tilt.on = false;
  settings.camPitch = +pitchT.toFixed(3);
  settings.camYaw = +(Math.atan2(Math.sin(yawT), Math.cos(yawT))).toFixed(3);
  saveSettings();
};
canvas.addEventListener('pointerup', endTilt);
canvas.addEventListener('pointercancel', endTilt);
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (G.mini) { if (e.button === 0) G.mini.tap(e.clientX, e.clientY); return; } // mini oyunda dokunmak atıştır, joystick çıkmaz
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); endJoy({ pointerId: joy.id }); return; }
    if (touches.size > 2) return;
  }
  joy.on = true; joy.id = e.pointerId;
  joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = joy.dx = joy.dy = 0;
  drawJoy(); joyEl.style.display = 'block';
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sentetik olay */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinch) {
      const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomT = THREE.MathUtils.clamp(zoomT * (pinch / d), 0.55, ZOOM_MAX);
      pinch = d;
      return;
    }
  }
  if (!joy.on || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  // parmak halkanın dışına çıkınca halka parmağın peşinden gelir (yüzen joystick): yön değiştirmek için parmağı başa döndürmek
  // gerekmez, ters yöne birkaç milimetre kaydırmak yeter (index.html #joy 64 px)
  const d = Math.hypot(dx, dy), R = JOY_R;
  if (d > R) {
    const k = (d - R) / d;
    joy.ox += dx * k; joy.oy += dy * k; dx -= dx * k; dy -= dy * k;
  }
  joy.x = dx / R; joy.y = dy / R; joy.dx = dx; joy.dy = dy; joy.dirty = true;
});
function endJoy(e) { if (e.pointerId !== joy.id) return; joy.on = false; joy.x = joy.y = 0; joy.sx = joy.sy = undefined; joyEl.style.display = 'none'; }
const endPointer = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinch = 0; endJoy(e); };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
// ekrana kısa dokunmak karakteri yürütmez: joystick ölü bölgesini aşan sürükleme gerekir (kullanıcı isteği). Bir yere kendi kendine
// koşma menüden ("Oraya git"), büyük mini haritadan ya da bildirimden başlar (G.hooks.goTo, autorun.js)

// ekran yönü (sağ, aşağı) → dünya yönü: kamera döndükçe "yukarı" hep ekranın yukarısıdır
function screenToWorld(x, z) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { x: x * c + z * s, z: -x * s + z * c };
}
// otomatik koşunun hedef işareti: yerde yeşil halka
const marker = new THREE.Group();
{
  const m = new THREE.MeshBasicMaterial({ color: '#56c27e', transparent: true, opacity: 0.9, depthWrite: false });
  const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.46, 32), m); r.rotation.x = -Math.PI / 2; marker.add(r);
  const d = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), m); d.rotation.x = -Math.PI / 2; marker.add(d);
  marker.visible = false; scene.add(marker);
}
// seçilen yere otomatik koşu: yol gövdeye göre planlanır (autorun.js); bulunamazsa false döner (çağıran ışınlayabilir)
G.hooks.goTo = (x, z) => {
  if (!startRun(x, z)) return false;
  const t = G.runGoal;
  if (settings.mouseMark !== false) { marker.position.set(t.x, heightAt(t.x, t.z) + 0.04, t.z); marker.visible = true; ring(marker.position.clone(), '#56c27e', 0.9); }
  return true;
};
const endRun = () => { if (running()) stopRun(); marker.visible = false; };
function inputVec(dt) {
  if (joy.dirty) drawJoy();
  if (G.menuOpen || G.cine || G.mini) return { x: 0, z: 0 }; // açılış sinematiğinde ve mini oyunda oyuncu kıpırdamaz (cinema.js, minioyun.js)
  let x = 0, z = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  if (x || z) { endRun(); const l = Math.hypot(x, z); return screenToWorld(x / l, z / l); }
  if (joy.on) {
    // parmak titremesi yönü oynatmasın: kısa bir süzgeç (~22 ms); ölü bölgeden sonra hız yumuşak artar, halkanın %62'sinde tam koşu
    const f = 1 - Math.exp(-45 * dt);
    joy.sx = (joy.sx ?? joy.x) + (joy.x - (joy.sx ?? joy.x)) * f; joy.sy = (joy.sy ?? joy.y) + (joy.y - (joy.sy ?? joy.y)) * f;
    const l = Math.hypot(joy.sx, joy.sy);
    if (l > JOY_DEAD) {
      endRun();
      const m = Math.min(1, (l - JOY_DEAD) / (JOY_FULL - JOY_DEAD)), w = screenToWorld(joy.sx / l, joy.sy / l);
      return { x: w.x * (0.4 + 0.6 * m), z: w.z * (0.4 + 0.6 * m) }; // en yavaşta yürür, biraz itince koşar
    }
  }
  // otomatik koşu: planlanan yolu izler, varınca işaret kaybolur
  if (running()) { const d = runSteer(dt); if (d.done) marker.visible = false; return d; }
  return { x: 0, z: 0 };
}

const shoutBtn = document.getElementById('shout');
shoutBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); initAudio(); tryShout(); });
function tryShout() {
  const R = regionAt(G.player.position);
  if (R && R.id === 'pazar') doShout();
}
let resetting = false;
function doReset() {
  clearSave();
  try { localStorage.removeItem('koyBakkali.hints'); } catch (e) { /* yok */ } // kapattığın bilgi kutuları yeniden açık
  markNewGame(); // açıkça yeni oyun: diskteki eski oyunun yerine geçebilir (persist.js)
  G.unlocked.clear(); G.money = 0;
  for (const k in G.upg) G.upg[k] = 0;
  resetting = true;
  location.reload();
}
// grafik kalitesi (kalite.js kademeleri): çözünürlük, gölge, alan derinliği, kare hızı sınırı, görüş uzaklığı, şekil ayrıntısı
let fpsCap = 60, fogK = 1;
// dönüş: gölge açılıp kapandı mı (bütün malzemeler yeniden derlenecek demek)
function applyQuality(q) {
  const T = tierOf(q), sh = T.shadow > 0, flip = renderer.shadowMap.enabled !== sh;
  prMax = prNow = Math.min(window.devicePixelRatio, T.pr); prMin = Math.min(prMax, T.prMin); slowT = fastT = 0;
  renderer.setPixelRatio(prNow);
  if (renderer.shadowMap.enabled !== sh) {
    renderer.shadowMap.enabled = sh;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }
  if (!sh && sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } // gölgesiz kademede harita ekran kartı belleğinde boş durmasın (2048'lik 16 MB)
  if (sh && sun.shadow.mapSize.x !== T.shadow) { sun.shadow.mapSize.set(T.shadow, T.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  dofOn = T.dof || (q === 'orta' && !TOUCH); // alan derinliği: Yüksek'te, masaüstünde Orta'da da (dof.js)
  shadowMin = T.shadowEvery; setArmShadows(T.shadowEvery === 1); // Orta: gölge haritası en sık 2 karede bir, kollar gölgesiz (perf.js)
  fpsCap = T.fps; fogK = T.fog; M.setDetail(T.detail); slowFor = 0;
  resize();
  return flip;
}
// kalite geçişi (2026-11-02 kullanıcı: "grafik kalitesi geçişlerinde çok takılıyor ve sayfanın başına atıyor, geçiş hissini versin"):
// gölge açılıp kapanınca sahnedeki bütün malzemelerin gölgelendiricisi yeniden derlenir; eskiden hepsi kalitenin uygulandığı karede
// birden derlenip oyun donuyordu. Şimdi ekran yumuşak bir perdeyle örtülür (#qVeil), değişiklik onun arkasında uygulanır,
// gölgelendiriciler compileAsync ile hazırlanır (destekleyen tarayıcıda arka planda; bu sırada çizim bekler, son kare ekranda kalır),
// alan derinliğinin hedefi kurulur, yeni görüntünün ilk karesi çizilince perde açılır. quiet: oyun kendiliğinden hafiflerken perde yok.
// Ölçüm (2 Kasım): eski yolda gölge kapanırken 1,17 sn, açılırken 0,54 sn donma. compileAsync'in kendisi de sahneyi gezerken ~0,47 sn
// sürüyor, bu yüzden yalnız gölge açılıp kapanınca çağrılır (gölgelendiriciler ilk geçişten sonra önbellekte). Perdenin dönen simgesi ve
// solması CSS'le tarayıcının ayrı iş parçacığında oynar, ana iş parçacığı meşgulken de akıcı kalır
let qChain = Promise.resolve(), holdDraw = false;
const qFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const qWait = (ms) => new Promise((r) => setTimeout(r, ms));
function switchQuality(q, quiet = false) {
  qChain = qChain.then(async () => {
    const veil = quiet ? null : document.getElementById('qVeil'), t0 = performance.now();
    if (veil) {
      veil.querySelector('b').textContent = QNAME[q] || q;
      veil.classList.add('on');
      await qFrame(); await qWait(240); // perde inip ekrana çizilsin, derleme onun arkasında kalsın
    }
    holdDraw = true;
    try {
      if (applyQuality(q)) await Promise.race([renderer.compileAsync(scene, camera), qWait(4000)]);
      if (dofOn) renderDof(renderer, scene, camera, dofS, dofF);
    } catch (e) { /* eski tarayıcı: ilk karede derlenir */ }
    holdDraw = false;
    renderFrame(); await qFrame();
    if (veil) { await qWait(Math.max(0, 560 - (performance.now() - t0))); veil.classList.remove('on'); } // çok kısa yanıp sönmesin
  });
  return qChain;
}

// otomatik çözünürlük: kare süresi 20 ms'yi (50 kare/sn) aşınca çizim çözünürlüğü kademe kademe 1'e kadar iner, akıcılık
// dönünce ayarın üst sınırına çıkar. Yavaş ekran kartında kasmayı keser; hızlı makinede görüntü değişmez.
// Her düşüşten sonra yeniden çıkmak için daha uzun beklenir, iki değer arasında gidip gelmez.
let prMax = 2, prNow = 2, prMin = 1, slowT = 0, fastT = 0, frameAvg = 1 / 60, drops = 0;
function adaptResolution(raw) {
  if (document.hidden || raw > 0.25) return; // arka plandan dönüş ve yükleme takılmaları sayılmaz
  frameAvg += (raw - frameAvg) * 0.05;
  const slowAt = fpsCap < 60 ? 0.04 : 0.02, fastAt = fpsCap < 60 ? 0.036 : 0.0175; // 30 karede sınır: kare süresi 33 ms olağan
  if (frameAvg > slowAt && prNow > prMin) {
    fastT = 0;
    if ((slowT += raw) > 1.5) { slowT = 0; drops++; prNow = Math.max(prMin, prNow - 0.25); renderer.setPixelRatio(prNow); } // Performans'ta 1'in altına da iner
  } else if (frameAvg < fastAt && prNow < prMax) {
    slowT = 0;
    if ((fastT += raw) > 8 + 20 * drops) { fastT = 0; prNow = Math.min(prMax, prNow + 0.25); renderer.setPixelRatio(prNow); }
  } else slowT = fastT = 0;
}
// kademeli kendiliğinden düşürme: oyuncu kaliteyi elle seçmediyse oyun 6 sn boyunca saniyede 28 karenin altında kalırsa (çözünürlük
// düşürmesi de yetmediyse) kalite bir kademe iner: Yüksek → Orta → Performans → Pil tasarrufu. İlk 15 sn ve arka plan sayılmaz
let slowFor = 0, watchFrom = 15;
function watchSpeed(raw) {
  if (settings.autoQ || document.hidden || raw > 0.25 || (watchFrom -= raw) > 0) return;
  slowFor = raw > 1 / 28 ? slowFor + raw : Math.max(0, slowFor - raw / 2);
  if (slowFor < 6) return;
  slowFor = 0; watchFrom = 12;
  const i = TIERS.indexOf(settings.quality);
  if (i < 0 || i >= TIERS.length - 1) return;
  settings.quality = TIERS[i + 1]; saveSettings(); switchQuality(settings.quality, true);
  toast(`⚙️ Oyun akıcı olsun diye grafik hafifledi: ${QNAME[settings.quality]} (Ayarlar › Grafik)`);
}

// ---------- oyuncu ----------
const vel = new THREE.Vector3();
const PR = 0.38;
// daire–dikdörtgen çarpışma: engelin en yakın noktasından dışarı itilir; köşelerde yuvarlanır, kenar boyunca kayar, takılmaz
// skip: oyuncunun zaten içinde kaldığı engeller (sonradan üstüne kurulan: park eden araba, açılan bina). Onlardan itilerek değil
// yürüyerek çıkılır; eskiden kutunun en yakın kenarına bir anda atılıyordu ("ışınlanma")
function resolve(x, z, skip) {
  for (let it = 0; it < 4; it++) {
    let pushed = false;
    for (const c of G.colliders) {
      if (skip && skip.includes(c)) continue;
      if (x < c[0] - PR || x > c[1] + PR || z < c[2] - PR || z > c[3] + PR) continue;
      const S = shapeOf(c); // nesnenin izine uydurulmuş çokgenler (colfit.js): yuvarlak, yan dönmüş, aralıklı nesneler
      if (S) { for (const H of S) if (pushPoly(H, x, z, PR)) { x = COL_OUT[0]; z = COL_OUT[1]; pushed = true; } continue; }
      const cx = Math.max(c[0], Math.min(c[1], x)), cz = Math.max(c[2], Math.min(c[3], z));
      const ox = x - cx, oz = z - cz, d2 = ox * ox + oz * oz;
      if (d2 >= PR * PR) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (PR - d) / d; x += ox * k; z += oz * k; }
      else { // merkez kutunun içinde kaldıysa en yakın kenardan çıkar
        const l = x - c[0], r = c[1] - x, t = z - c[2], b = c[3] - z, m = Math.min(l, r, t, b);
        if (m === l) x = c[0] - PR; else if (m === r) x = c[1] + PR; else if (m === t) z = c[2] - PR; else z = c[3] + PR;
      }
      pushed = true;
    }
    if (!pushed) break;
  }
  return [x, z];
}
// oyuncu bölge ve yol dışındaki çimenlerde de yürür (deniz, nehir, ağaç gövdesi ve dekor köyü hariç; nature.js)
const roam = (x, z) => walkable(x, z) || openGround(x, z);
function tryStep(p, dx, dz, skip) {
  let q = resolve(p.x + dx, p.z + dz, skip);
  if (!roam(q[0], q[1])) { // yürünemeyen yerin kıyısında: kıyı boyunca kay
    const a = resolve(p.x + dx, p.z, skip), b = resolve(p.x, p.z + dz, skip), oa = roam(a[0], a[1]), ob = roam(b[0], b[1]);
    if (oa && (!ob || Math.abs(dx) >= Math.abs(dz))) q = a; else if (ob) q = b; else return null;
  }
  return q;
}
// takılınca sapma (2026-11-08 kullanıcı: "bazı nesnelerin etrafından geçerken takılıyorum"): adım istenen yönde %30'dan az ilerlediyse
// 25° ve 50° sağa sola sapılarak denenir, istenen yönde belirgin daha çok ilerleten seçilir. Direğe, köşeye kafa kafaya gelince ve iki
// engelin arasındaki dar oyukta durmaz, kenarından akar; düz duvara dik yürüyünce sapmanın ilerletmesi olmadığından yine durur
let STEER = true;
const STEER_A = [0.45, -0.45, 0.9, -0.9];
function slideStep(p, dx, dz, skip) {
  let q = tryStep(p, dx, dz, skip);
  const L2 = dx * dx + dz * dz;
  let pr = q ? (q[0] - p.x) * dx + (q[1] - p.z) * dz : -1;
  if (STEER && L2 > 1e-6 && pr < 0.3 * L2) {
    for (const a of STEER_A) {
      const c = Math.cos(a), s = Math.sin(a), r = tryStep(p, dx * c + dz * s, dz * c - dx * s, skip);
      if (!r) continue;
      const pr2 = (r[0] - p.x) * dx + (r[1] - p.z) * dz;
      if (pr2 > pr + 0.15 * L2) { pr = pr2; q = r; }
    }
  }
  if (!q) return;
  p.x = q[0]; p.z = q[1];
}
const inside = []; // oyuncunun içinde kaldığı engeller (her karede yeniden)
function moveSlide(p, dx, dz) {
  inside.length = 0;
  const h = -0.03; // oyuncunun merkezi kutunun içindeyse kutu sonradan üstüne kurulmuştur (yürüyerek çıkar); iki kutu arasına sıkışmak bunu tetiklemez, raf ve tezgahın içinden geçilmez
  for (const c of G.colliders) if (p.x > c[0] - h && p.x < c[1] + h && p.z > c[2] - h && p.z < c[3] + h) { const S = shapeOf(c); if (!S || S.some((H) => inPoly(H, p.x, p.z, -h))) inside.push(c); }
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.25)); // hızlıyken ince engellerin içinden geçmesin
  for (let i = 0; i < n; i++) slideStep(p, dx / n, dz / n, inside.length ? inside : null);
}
// test kancası (colfit karşılaştırması): (x, z)'den ang yönüne secs saniye koşu; ilerleme ve takılan kare sayısı
window.__slideRun = (x, z, ang, secs = 1.5, sp = 6.6, steer = true) => {
  const p = new THREE.Vector3(x, 0, z), dt = 1 / 30, dx = Math.sin(ang) * sp * dt, dz = Math.cos(ang) * sp * dt, was = STEER;
  let prog = 0, stuck = 0;
  STEER = steer;
  for (let t = 0; t < secs; t += dt) { const ox = p.x, oz = p.z; moveSlide(p, dx, dz); const d = Math.hypot(p.x - ox, p.z - oz); prog += d; if (d < sp * dt * 0.3) stuck++; }
  STEER = was;
  return [prog, stuck, p.x, p.z];
};
let moved = false, dustT = 0, lastSp = 0, stepL = false;
function updatePlayer(dt) {
  // eğlenceye binmişken (lunapark.js G.onRide) oyuncuyu eğlence taşır: yürüyüş, toz ve eğilme yok; yön tuşları eğlenceye gider
  // (çarpışan arabayı sürer)
  if (G.onRide) { vel.set(0, 0, 0); J.y = J.v = 0; J.run = false; G.onRide(dt, inputVec(dt)); G.stack.update(dt); return; }
  const p = G.player.position;
  const inp = inputVec(dt);
  const speed = runSpeed(6.6 * G.speedMul, keys.has('ShiftLeft') || keys.has('ShiftRight'), Math.hypot(inp.x, inp.z) > 0.6 && lastSp > 1, dt); // hızlı koşu ve enerji (yetenek.js)
  // tepki seri: hız hedefe hızlı ulaşır, karakter basılan yöne hemen döner
  vel.x += (inp.x * speed - vel.x) * (1 - Math.exp(-22 * dt));
  vel.z += (inp.z * speed - vel.z) * (1 - Math.exp(-22 * dt));
  const ox = p.x, oz = p.z;
  moveSlide(p, vel.x * dt, vel.z * dt);
  // duvara dayanınca hız gerçekten gidilen yöne döner: karakter kayarken o yöne bakar, yerinde koşmaz
  if (dt > 0) {
    vel.x = (p.x - ox) / dt; vel.z = (p.z - oz) / dt;
    // engelden itilme hıza dönmesin: yoksa itme bir sonraki karede daha büyük adıma, kamera da ileri atlamaya döner
    const v = Math.hypot(vel.x, vel.z); if (v > speed) vel.multiplyScalar(speed / v);
  }
  if (marker.visible) marker.scale.setScalar(1 + Math.sin(G.time * 6) * 0.12);
  p.y -= J.y; // zıplama payı ayrı tutulur: zemin takibi aynı kalır
  p.y += (heightAt(p.x, p.z) - p.y) * Math.min(1, dt * 14);
  p.y += stepJump(dt);
  const sp = Math.hypot(vel.x, vel.z), il = Math.hypot(inp.x, inp.z), k01 = Math.min(1, sp / speed);
  const R = G.player.rotation;
  if (R.order !== 'YXZ') R.order = 'YXZ'; // önce yön, sonra öne eğilme
  if (il > 0.2 || sp > 0.4) {
    const want = il > 0.2 ? Math.atan2(inp.x, inp.z) : Math.atan2(vel.x, vel.z);
    const turn = Math.abs(Math.atan2(Math.sin(want - R.y), Math.cos(want - R.y)));
    if (turn > 1.9 && sp > 3 && dustT < 0.05 && J.y === 0) { for (let i = 0; i < 3; i++) smoke(p, { size: 0.36, grow: 3.0, alpha: 0.55, v: new THREE.Vector3(vel.x * 0.18, 0, vel.z * 0.18) }); dustT = 0.12; } // sert dönüşte toz bulutu savrulur
    R.y = lerpAngle(R.y, want, 1 - Math.exp(-32 * dt));
  }
  if (!moved && sp > 1) { moved = true; document.getElementById('help').classList.add('hide'); }
  // aceleci koşu: hızlanırken daha çok, koşarken hafif öne eğilir; arkasında ayak tozu
  const lean = k01 * (J.run ? 0.34 : 0.2) + Math.max(0, (sp - lastSp) / Math.max(dt, 1e-3)) * 0.004;
  R.x += (Math.min(J.run ? 0.42 : 0.3, lean) - R.x) * (1 - Math.exp(-10 * dt));
  lastSp = sp;
  dustT -= dt;
  if (sp > 3 && dustT <= 0 && J.y === 0) {
    // ayak tozu: adım adım arkada bir bulutçuk; hızlı koşuda daha sık ve büyük, geriye doğru savrulur. Eskiden iki kat sık ve koyuydu
    // (2026-11-05 kullanıcı: "arkamızdan çıkan koşarken toz dumanı biraz azalt")
    dustT = 0.085 - k01 * 0.015;
    const d = 0.36 / sp, side = (stepL = !stepL) ? 0.14 : -0.14;
    smoke({ x: p.x - vel.x * d + vel.z / sp * side, y: p.y, z: p.z - vel.z * d - vel.x / sp * side }, { size: 0.24 + k01 * 0.1, grow: 2.1 + k01 * 0.4, alpha: 0.5 + k01 * 0.15, life: 0.7, v: new THREE.Vector3(-vel.x * 0.07, 0, -vel.z * 0.07) });
  }
  M.animateCharacter(G.player, J.y > 0 ? 0.2 : k01, J.run ? dt * 1.4 : dt, G.stack.items.length > 0, true);
  G.stack.anchor.rotation.x = -R.x - Math.min(0.1, sp * 0.012); // yığın eğilmeye rağmen dik durur, koşarken biraz geride sallanır
  G.stack.update(dt);
}

// ---------- kamera ----------
const camT = new THREE.Vector3(), camGoal = new THREE.Vector3(), miniLook = new THREE.Vector3();
let miniK = 0, miniLast = null;
function updateCamera(dt, snap) {
  const p = G.player.position;
  if (G.camSnap) { G.camSnap = false; snap = true; } // ışınlanınca kamera süzülmeden yerine geçer (adacanli.js gemi yolculuğu)
  // hareket yönüne hafif önden bakış
  // hırsız para çalınca kamera birkaç saniye ona döner (thief.js G.camFocus), sonra oyuncuya geri gelir
  // oyuncu koşuyorsa odak atlanır: kamera başka yere kayıp geri gelince "ışınlandım" sanılıyordu
  if (G.camFocus && Math.hypot(vel.x, vel.z) > 1.5) G.camFocus = null;
  const cf = G.camFocus;
  if (cf && G.time < cf.until) camGoal.set(cf.pos.x, 0, cf.pos.z);
  else camGoal.set(p.x + vel.x * 0.28, p.y - J.y, p.z + vel.z * 0.22); // zıplarken kamera sıçramaz
  if (snap) camT.copy(p); else camT.lerp(camGoal, 1 - Math.exp(-5 * dt));
  zoom += (zoomT - zoom) * (1 - Math.exp(-8 * dt));
  const a = VIEW.w / VIEW.h; // pencere değişince güncellenir (game.js VIEW): burada okumak sayfa yerleşimini kare ortasında hesaplatıyordu
  const f = (a < 0.75 ? 1.55 : a < 1.2 ? 1.25 : 1) * zoom * (G.camK || 1); // G.camK: gemi yolculuğunda ve zirvede uzaklaşır (adacanli.js)
  const k = snap ? 1 : 1 - Math.exp(-10 * dt);
  // sipariş kutuları uzaklaştıkça küçülür (index.html .order --lz)
  const lz = THREE.MathUtils.clamp(0.85 / Math.pow(zoom, 0.8), 0.62, 1.05);
  if (Math.abs(lz - lastLz) > 0.01) { lastLz = lz; document.documentElement.style.setProperty('--lz', lz.toFixed(3)); }
  // avatarların üstündeki balonlar ve ad etiketleri dünyayla aynı oranda büyüyüp küçülür: uzaklaşınca avatara göre büyümez (index.html --az)
  const az = THREE.MathUtils.clamp(1 / zoom, 0.2, 1.4);
  if (Math.abs(az - lastAz) > 0.01) { lastAz = az; document.documentElement.style.setProperty('--az', az.toFixed(3)); }
  // ipucu, kilit ve fiyat etiketleri de uzaklaştıkça küçülür, yakınlaşınca büyümez; çok uzakta ipuçları gizlenir (game.js Labels)
  G.labelScale = THREE.MathUtils.clamp(1 / zoom, 0.42, 1); G.farLabels = zoom > 1.9;
  pitch += (pitchT - pitch) * k;
  yaw += (yawT - yaw) * k;
  const dist = 23.8 * f, h = Math.cos(pitch) * dist; // varsayılan açıda eski (0, 18.5, 15) ofsetiyle aynı
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  camera.position.set(camT.x + sy * h, camT.y + Math.sin(pitch) * dist, camT.z + cy * h);
  camera.lookAt(camT.x - sy * 1.2, camT.y + 0.4, camT.z - cy * 1.2);
  // lunapark mini oyunu: kamera süzülerek çadırın önüne geçer, bitince oyuncuya döner (minioyun.js G.mini)
  if (G.mini) miniLast = G.mini;
  miniK = THREE.MathUtils.clamp(miniK + (G.mini ? dt : -dt) * 2.4, 0, 1);
  if (miniK > 0 && miniLast) {
    const e = miniK * miniK * (3 - 2 * miniK);
    camera.position.lerp(miniLast.cam, e);
    camera.lookAt(miniLook.set(camT.x - sy * 1.2, camT.y + 0.4, camT.z - cy * 1.2).lerp(miniLast.look, e));
  }
  camera.updateMatrixWorld(); // etiketler bu karenin kamerasına göre yerleşsin, bir kare geriden gelip titremesin
  camera.layers.mask = layerMask(miniK > 0 ? 1 : zoom); // uzaklaştıkça minik ve küçük parçalar çizilmez (perf.js); mini oyunda hepsi
  // çok uzaklaşınca sis de geri çekilir, kamera uzak düzlemi sisin ötesine kadar çizer
  // düşük kalitede sis yakına gelir, uzak düzlem de onunla: sisin ardındaki parçalar hiç çizilmez (fogK, applyQuality)
  const fx = Math.max(0, dist - 24), fn = (80 + fx * 0.9) * fogK, ff = (240 + fx * 1.6) * fogK;
  if (Math.abs(scene.fog.far - ff) > 2) { scene.fog.near = fn; scene.fog.far = ff; camera.far = Math.max(400 * fogK, ff + 40); camera.updateProjectionMatrix(); }
  // derinlik hassasiyeti: yakın düzlem kamera uzaklaştıkça büyür. 0,5 m sabitken uzaktan bakınca üst üste binen ince zeminler
  // (yol, kaldırım, bölge zemini) kenarlarda titriyordu (2026-11-04). Mini oyunda ve sinematikte kamera yakına iner: 0,5 kalır
  const nr = miniK > 0 || cineActive() ? 0.5 : THREE.MathUtils.clamp(dist * 0.05, 0.5, 6);
  if (Math.abs(camera.near - nr) > 0.05) { camera.near = nr; camera.updateProjectionMatrix(); }
  // yeni bölgenin açılış sinematiği kamerayı devralır, sonunda oyuncuya süzülerek geri verir (cinema.js)
  if (cineActive()) cineCamera(camera, cineTgt.set(camT.x - sy * 1.2, camT.y + 0.4, camT.z - cy * 1.2), dt, scene);
  // alan derinliği: yakınlaştıkça ve kamera yataya indikçe güçlenir, odak oyuncuda (dof.js); varsayılan görünümde kapalı
  const dz = THREE.MathUtils.clamp((0.98 - zoom) / 0.4, 0, 1), dp = THREE.MathUtils.clamp((PITCH_DEF - 0.05 - pitch) / 0.45, 0, 1);
  dofS = cineActive() || miniK > 0 ? 0 : Math.min(1, dp + dz * 0.65);
  dofF = camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion).dot(sRel.copy(camT).sub(camera.position));
  fitShadow();
}
const cineTgt = new THREE.Vector3(), camFwd = new THREE.Vector3();
let dofOn = true, dofS = 0, dofF = 20;
G.hooks.cinema = (o) => playCinema(o);
G.hooks.cineShots = (o) => playShots(o); // birkaç yeri sırayla gösteren açılış (world.js kbTour)
// gölge kutusu yalnızca ekranda görünen alanı kaplar: kameranın zemindeki görüş dörtgeni (ve 4 m yükseklikteki kesiti) ışık
// yönünde izdüşürülür. Eskiden oyuncunun çevresinde 66 m'lik kare vardı; ekran dışındaki yüzlerce nesne de gölge çiziyordu.
// LD (güneş yönü) ve eksenleri gün döngüsüyle her karede değişir (daylight.js)
const LD = new THREE.Vector3(-14, 28, 12).normalize(), LX = new THREE.Vector3(0, 1, 0).cross(LD).normalize(), LY = LD.clone().cross(LX);
const NDC = [[-1, -1], [1, -1], [1, 1], [-1, 1]], sRay = new THREE.Vector3(), sRel = new THREE.Vector3();
function fitShadow() {
  const T = sun.target.position.set(camT.x, 0, camT.z);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, d0 = Infinity, d1 = -Infinity;
  for (const [nx, ny] of NDC) {
    sRay.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    for (const hy of [0, 4]) {
      const t = sRay.y < -0.02 ? Math.min(150, (hy - camera.position.y) / sRay.y) : 150; // ufka bakan köşe 150 m'de kesilir
      sRel.copy(camera.position).addScaledVector(sRay, t).sub(T);
      const lx = sRel.dot(LX), ly = sRel.dot(LY), ld = sRel.dot(LD);
      x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); y0 = Math.min(y0, ly); y1 = Math.max(y1, ly); d0 = Math.min(d0, ld); d1 = Math.max(d1, ld);
    }
  }
  // güneş görüş alanının ışığa en yakın noktasından 12 m geride durur (uzun nesnelerin tepesi kesilmesin)
  const back = Math.max(33.5, d1 + 12), far = Math.ceil((back - d0 + 4) / 4) * 4, m = 2;
  // gölge titremesin: kutu 4 m'lik adımlarla büyüyüp küçülür, merkezi ışık düzleminde gölge pikseline oturur. Böylece kamera
  // kayarken gölge pikselleri yerinde kalır, kenarlar kıpırdamaz (eskiden kutu her karede kayıp boyut değiştiriyordu)
  const Q = 4, l = Math.max(-112, Math.floor((x0 - m) / Q) * Q), r = Math.min(112, Math.ceil((x1 + m) / Q) * Q), b = Math.max(-112, Math.floor((y0 - m) / Q) * Q), tp = Math.min(112, Math.ceil((y1 + m) / Q) * Q);
  const px = (r - l) / sun.shadow.mapSize.x, py = (tp - b) / sun.shadow.mapSize.y, ox = T.dot(LX), oy = T.dot(LY);
  T.addScaledVector(LX, Math.round(ox / px) * px - ox).addScaledVector(LY, Math.round(oy / py) * py - oy);
  sun.position.copy(T).addScaledVector(LD, back);
  if (Math.abs(sc.left - l) + Math.abs(sc.right - r) + Math.abs(sc.bottom - b) + Math.abs(sc.top - tp) + Math.abs(sc.far - far) > 0.1) {
    sc.left = l; sc.right = r; sc.bottom = b; sc.top = tp; sc.far = far; sc.updateProjectionMatrix();
    sun.shadow.bias = -0.037 / (far - sc.near); // derinlik aralığı değişse de dünyadaki sapma aynı kalsın (gölge lekesi çıkmasın)
  }
}
// uzaktan bakarken gölge kutusu büyür, yüzlerce nesne gölge çizer: harita 2-3 karede bir yenilenir. Yakında her karede
// ('orta' kalitede en sık 2 karede bir: shadowMin, applyQuality)
let shadowTurn = 0, sizeT = 0, shadowMin = 1;
function renderFrame() {
  const every = Math.max(shadowMin, zoom > 2.6 ? 3 : zoom > 1.6 ? 2 : 1);
  if (++shadowTurn >= every) { shadowTurn = 0; renderer.shadowMap.needsUpdate = true; }
  if (dofOn) renderDof(renderer, scene, camera, dofS, dofF); else renderer.render(scene, camera);
}

// ---------- arayüz ----------
let arrow = null;
function updateHud(dt) {
  const R = regionAt(G.player.position);
  updateUI(dt, R);
  const inPazar = R && R.id === 'pazar' && R.unlocked;
  shoutBtn.style.display = inPazar ? 'flex' : 'none';
  if (inPazar) shoutBtn.style.setProperty('--c', (G.shout.cool / 14).toFixed(3));
  shoutBtn.classList.toggle('active', G.shout.t > 0);
  // sonraki kilit alanını gösteren ok
  // ilk adımlar rehberi (rehber.js) varken ok sıradaki işi gösterir; işin yeri yoksa (müşteri bekleniyor) ok gizlenir
  const g = G.guide, pad = g ? g.zone && g : G.nextPad || G.needPad || G.finalPad; // bölge şartı bekleniyorsa o işin yeri (sart.js); son görevde en yakın açık yan kilit (final.js)
  if (pad) {
    const dx = pad.zone.x - G.player.position.x, dz = pad.zone.z - G.player.position.z, d = Math.hypot(dx, dz);
    arrow.visible = d > (g ? 2.4 : 6) && !(G.thief && G.thief.loot > 0); // hırsız kaçarken kırmızı ok onu gösterir (thief.js)
    if (arrow.visible) {
      arrow.position.set(G.player.position.x + (dx / d) * 1.5, G.player.position.y + 0.18 + Math.sin(G.time * 5) * 0.05, G.player.position.z + (dz / d) * 1.5);
      arrow.rotation.y = Math.atan2(dx, dz);
    }
  } else arrow.visible = false;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- başlat ----------
async function start() {
  await initLang(); // İngilizcede sözlük gelir, ekrana çıkan metinler çevrilir (dil.js)
  const tekP = tekSekme(); // oyun başka sekmede açık mı: cevap modeller inerken gelir (koruma.js)
  const loadEl = document.getElementById('loading');
  setTip(`İpucu: ${say('tips')}`);
  initOnline().catch(() => {}); // Firebase SDK ve oturum modellerle birlikte iner (hata olursa kapı yine görür)
  await M.loadModels(MODEL_LIST, (p) => { loadEl.querySelector('b').style.width = `${Math.round(p * 100)}%`; });
  await breathe();
  makeIcons();
  await breathe();
  G.labels = new Labels(document.getElementById('labels'));
  const player = M.makeCharacter({ shirt: '#3b8beb', pants: '#2d3e66', hat: 'cap', hatColor: '#ffd23f', skin: '#f3cfae' });
  player.position.set(-2, 0, -1);
  player.rotation.y = PI_;
  scene.add(player);
  G.player = player;
  G.stack = new Stack(player, 8, 0.98, 0.5);
  arrow = M.makeArrow();
  scene.add(arrow);
  await onlineGate(); // çevrimiçiyse giriş/üye ol kapısı (online-ui.js); çevrimdışıysa hemen geçer
  await tekP;
  const { saved, flag } = await pickSave(); // yerel kayıt ya da disk kaydı: oyun süresi uzun olan (persist.js)
  await breathe();
  buildWorld(saved);
  alignGroundUV(scene); // yol, kaldırım, bölge zemini ve güverte dokuları dünyaya hizalı: dikişlerde kaymaz (tex.js)
  await breathe();
  if (saved && saved.custom) Object.assign(G.custom, saved.custom);
  if (saved && saved.stats) Object.assign(G.stats, saved.stats);
  applyFlag(flag);
  if (saved && Array.isArray(saved.ach)) for (const a of saved.ach) G.ach.add(a);
  applyCustom();
  initUpgrades(saved && saved.upg);
  needsReady(saved); // bölge kilitlerinin şartı elemanlara ve kazanca bakar (sart.js)
  initUI();
  const onCustom = (done) => { applyCustom(); if (done) save(); };
  initCustomize(onCustom);
  initEvents();
  initMenu({
    onReset: doReset, onCustom, quality: switchQuality, bootQuality: Q0,
    gfx: () => ({ fps: Math.round(1 / frameAvg), pr: prNow, shadow: renderer.shadowMap.enabled }), // ayarlardaki canlı satır
    getZoom: () => zoomT, setZoom: (v) => { zoomT = THREE.MathUtils.clamp(v, 0.55, ZOOM_MAX); },
    snapCamera: () => updateCamera(0, true), beforeImport: () => { resetting = true; markNewGame(); },
  });
  initTasarim(onCustom); // dükkân tasarımı seçimi: büyürken açılır, Dükkan menüsünden de (tasarim.js). Menüden sonra: Esc önce menüye düşmesin
  applyQuality(settings.quality); // ilk açılışta cihaza göre seçildi (kalite.js initQuality)
  initDaylight({ scene, sun, hemi, LD, LX, LY }); // gün döngüsü: güneşin yönü ve rengi, gök, sis, fenerler (daylight.js)
  initGorev(); // her oyun gününe üç görev (gorev.js)
  initMevsim(); // 7 günde bir mevsim: renkler, sıcak, mevsim ürünleri ve görevi (mevsim.js)
  initCursor(canvas);
  initMinimap();
  setMusicRegion(() => (regionAt(G.player.position) || { id: 'koy' }).id);
  // müzik klasöründeki bölüm: pazar 2, sahil 3, han 4, bütün kilitler açılınca 5
  setMusicStage(() => (!G.nextPad && !G.nextWait ? 5 : G.unlocked.has('gh') ? 4 : G.unlocked.has('gs') ? 3 : G.unlocked.has('gp') ? 2 : 1));
  resize();
  updateCamera(0, true);
  // gölgelendiriciler yükleme ekranı açıkken derlenir (tarayıcı destekliyorsa arka planda): eskiden oyun göründükten sonraki ilk
  // karede hepsi birden derlenip ekran bir saniye kadar donuyordu. En çok 5 sn beklenir
  try { await Promise.race([renderer.compileAsync(scene, camera), new Promise((res) => setTimeout(res, 5000))]); } catch (e) { /* eski tarayıcı: ilk karede derlenir */ }
  // alan derinliğinin çizim hedefi ve gölgelendiricisi de yükleme ekranında kurulur: ilk yakınlaşmada takılmasın (dof.js)
  if (dofOn) try { renderDof(renderer, scene, camera, 1, 20); } catch (e) { /* desteklemeyen cihaz: kalite ayarında kapanır */ }
  loadEl.classList.add('hide');
  kaliciDepo(); // tarayıcı yer açarken kaydı silmesin (koruma.js)
  if (G.fromBackup) toast('💾 Son kayıt okunamadı: 5 dakika önceki yedekten devam ediyorsun');
  if (!G.custom.named) setTimeout(() => openCustomize(true), 500);
  onlineStart(); // gelen kutusu, haftalık ödül; komşu ziyaretinde yardım vardiyası (online-ui.js)
  initCanli(); // canlı ziyaret: aynı köydeki oyuncular birbirini görür, yazışır (canli.js)
  setInterval(() => { if (!resetting) { save(); diskSave(); } }, 3000); // diske 10 sn'de bir
  watchForUpdates();
  // sekme ya da tarayıcı kaydetmeden kapanınca da son hal diske gider
  addEventListener('beforeunload', () => { if (!resetting) { save(); diskSave(true); } });
  // geri dönünce: başka cihazda (telefon/bilgisayar) daha ileri oynandıysa o kayıt yüklenir; bu cihazın eski hali buluta yazılmaz
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); if (!resetting) { save(); diskSave(true); } return; }
    if (hiddenAt && Date.now() - hiddenAt > 15000) cloudNewer(G.stats.time).then((d) => { if (d && !resetting) { resetting = true; writeSave(d); location.reload(); } });
  });
  initInstall(); // uygulama olarak kurma daveti (install.js)
  if (TOUCH) document.getElementById('help').textContent = 'Yürümek için basılı tut, sürükle';
  let last = performance.now();
  const tick = (dt) => {
    G.labels.measure(); // etiket boyları karenin başında, sayfa yerleşimi temizken ölçülür (game.js Labels)
    G.time += dt;
    G.stats.time += dt;
    updatePlayer(dt);
    updateYetenek(dt); // düğmeler, enerji çubuğu, para mıknatısı
    for (const s of G.stations.slice()) { s.setInside(!G.onRide && s.near(G.player.position)); s.update(dt); } // eğlencedeyken altından geçtiği yer tetiklenmez
    updateWorld(dt);
    updateYemlik(dt); // hayvan yemlikleri: boşken üretim durur (yemlik.js)
    updateMutfak(dt); // sahil mutfağının vitrin müşterileri (mutfak.js)
    updateKano(dt); // derede kanolar ve kano iskelesinin müşterileri (kano.js)
    updatePark(dt); // çocuk parkında oynayan çocuklar (park.js)
    updateCityLife(dt); // şehir caddesinde yayalar, araba, motor, bisiklet (sehirhayat.js)
    updateTahsilat(); // muhasebecinin arabası (tahsilat.js)
    updateRehber(dt);
    needTick(dt);
    updateCalgi(dt); // dünyadan gelen müzik: çalgıcılar ve atlıkarınca orgu (calgi.js)
    updateGround(dt); // üst üste düz zemin parçaları titremesin (zfix.js)
    for (const c of G.customers.slice()) c.update(dt);
    updateFading(dt); // giden müşteri yavaşça silinir (game.js)
    updateUpgrades(dt);
    updateEvents(dt);
    updateCore(dt);
    updateFx(dt);
    updateDaylight(dt); // güneş döner: fitShadow (updateCamera) yeni yönü okur
    updateGorev(dt);
    updateMevsim(dt);
    updateSincap(dt);
    updateHoca(dt);
    updateColFit();
    updateCanli(dt);
    updateCamera(dt);
    updateHud(dt);
    updateMenu(dt);
    updateCursor(dt);
    updateMinimap(dt);
    G.labels.update(camera, VIEW.w, VIEW.h, dt);
    if ((sizeT -= dt) <= 0) { sizeT = 2; sweepSizes(scene); } // sonradan eklenen parçalar da boyuna göre ayrılır (perf.js)
    bakeTick(dt, scene); // kımıldamayan parçalar birleşir, değişen olursa geri ayrılır (perf.js)
  };
  const loopErr = new Set();
  const loop = (now) => {
    // kare hızı sınırı (Pil tasarrufu: 30): erken gelen kare atlanır, ekran kartı ve işlemci yarı yarıya dinlenir
    if (fpsCap < 60 && now - last < 1000 / fpsCap - 3) { requestAnimationFrame(loop); return; }
    if (holdDraw) { last = now; requestAnimationFrame(loop); return; } // kalite geçişinde gölgelendiriciler hazırlanırken çizilmez
    const raw = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, raw); // ilk karede rAF zamanı last'tan geride kalabilir: oyun zamanı eksiye düşmesin
    last = now;
    adaptResolution(raw);
    watchSpeed(raw);
    // menü açıkken oyun durur; kamera yalnızca yakınlık ayarını göstermek için çalışır
    // bir karede çıkan hata oyunu kalıcı dondurmasın: o karenin kalanı atlanır, döngü ve çizim sürer (aynı hata bir kez yazılır)
    try { if (G.paused) { updateCamera(dt); G.labels.measure(); G.labels.update(camera, VIEW.w, VIEW.h, 0); } else tick(dt); }
    catch (e) { const k = String(e); if (!loopErr.has(k)) { loopErr.add(k); console.error(e); hata(k, 'kare', e && e.stack); } }
    renderFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // test kancası: oyunu elle ileri sarar (sekme arka plandayken doğrulama için)
  window.__G = G;
  window.__R = renderer; // test kancası: çizim istatistikleri (renderer.info)
  window.__q = { switchQuality, applyQuality, scene, camera }; // test kancası: kalite geçişini ölçmek için (eski yol: applyQuality)
  window.__bake = bakeStats;
  window.__cam = (z, p, y, dof) => { zoom = zoomT = z; pitch = pitchT = p ?? PITCH_DEF; if (y != null) yaw = yawT = y; if (dof != null) dofOn = dof; return { dofS, dofF }; }; // test: yakınlık, eğim, dönüş, alan derinliği
  window.__step = (seconds, dt = 1 / 30, draw = true) => { for (let t = 0; t < seconds; t += dt) tick(dt); if (draw) renderFrame(); }; // draw=false: denetim botu için hızlı
  window.__keys = keys;
  window.__mk = makeItem;
}
// yerel sunucuda oynarken: oyun dosyaları değişince kaydedip yeni sürümle kaldığı yerden devam eder
const WATCH = ['index.html', 'src/main.js', 'src/game.js', 'src/world.js', 'src/models.js', 'src/ui.js', 'src/upgrades.js', 'src/events.js', 'src/decor.js', 'src/audio.js', 'src/fx.js', 'src/texts.js', 'src/tex.js', 'src/menu.js', 'src/intro.js', 'src/sounds.js', 'src/soundpanel.js', 'src/cursor.js', 'src/minimap.js', 'src/station.js', 'src/roads.js', 'src/ambience.js', 'src/birds.js', 'src/thief.js', 'src/riders.js', 'src/chicks.js', 'src/resort.js', 'src/plaza.js', 'src/trucks.js', 'src/nature.js', 'src/carsi.js', 'src/energy.js', 'src/level.js', 'src/dress.js', 'src/wind.js', 'src/farmland.js', 'src/rating.js', 'src/rivals.js', 'src/alerts.js', 'src/avatar.js', 'src/bank.js', 'src/requests.js', 'src/services.js', 'src/fishing.js', 'src/sea.js', 'src/persist.js', 'src/perf.js', 'src/account.js', 'src/dest.js', 'src/autorun.js', 'src/cinema.js', 'src/expand.js', 'src/expand-west.js', 'src/expand-east.js', 'src/city.js', 'src/beach.js', 'src/catalog.js', 'src/ripe.js', 'src/online.js', 'src/online-ui.js', 'src/firebase-config.js', 'src/install.js', 'src/reyon.js', 'src/daylight.js', 'src/gorev.js', 'src/mevsim.js', 'src/canli.js'];
function watchForUpdates() {
  if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
  let stamp = null, changedAt = 0;
  const check = async () => {
    try {
      const marks = await Promise.all(WATCH.map((f) => fetch(f, { method: 'HEAD', cache: 'no-store' }).then((r) => r.headers.get('Last-Modified') || '')));
      const key = marks.join('|');
      if (stamp === null) stamp = key;
      else if (key !== stamp) { stamp = key; changedAt = performance.now(); }
    } catch (e) { /* sunucu kapalı */ }
    // dosyalar 3 sn sabit kalınca (yazım bitti) yenile; açık pencere varken bekle. src/.bakim varken (büyük değişiklik sürüyor)
    // yenilemez: yarım kalmış haritayı göstermez, bakım bitince tek seferde yenilenir
    if (changedAt && performance.now() - changedAt > 3000 && !G.menuOpen && !resetting) {
      const hold = await fetch('src/.bakim', { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false);
      if (hold) return;
      changedAt = 0;
      save(); diskSave(true);
      document.getElementById('tip').textContent = 'Yeni sürüm yükleniyor, kaldığın yerden devam…';
      document.getElementById('loading').classList.remove('hide');
      document.getElementById('loading').style.display = '';
      setTimeout(() => location.reload(), 300);
    }
  };
  setInterval(check, 2500);
}

const PI_ = Math.PI;
start().catch((e) => {
  console.error(e);
  const el = document.getElementById('loading');
  el.querySelector('span').textContent = 'Yüklenemedi: ' + e.message;
});
