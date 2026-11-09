// Bölüm ayrıntıları (2026-10-28 kullanıcı: "her bölüme bakkal gibi odak ver, kontrol et, detaylandır"; seçtiği on bölüm):
// e-ticaret ofisi, şehir marketi, semt pazarı, sahil büfesi, koyun merası, dokuma atölyesi, kervansaray hanı, at ahırı binası,
// balıkçı iskelesi, tatil köyü. Her bölümde işin akışını anlatan eşyalar ve canlılık, kameranın gördüğü (güney) yanlarda.
// Hepsi bölgenin içeriğine (R.content) eklenir: bölge kapalıyken görünmez. Büyük eşyalar çarpışma alır; yürüyüş yolları, iş
// alanları (istasyon bölgeleri) ve kapılar boş kalır (yerler denetim/bd_duzen.json dökümüne göre seçildi).
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, makeItem } from './game.js';
import { texRep, textTex } from './tex.js';
import { day } from './daylight.js';

const PI = Math.PI;
const wood = () => M.mat('#ffffff', { map: texRep('wood', 0.6, 0.4) });
const anim = []; // updateDetay: { o, f(o, t, dt), R }; bölge kapalıyken oynamaz
export const ADDED = []; // eklenen çarpışma kutuları (test: denetim yolları kesiyor mu)

function shadow(o) { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }
function put(R, o, x, z, ry = 0, y = 0) { o.position.set(x, y, z); o.rotation.y = ry; R.content.add(o); return shadow(o); }
// çarpışma: bölge açıksa hemen, kapalıysa açılınca (world.js unlockRegion R.colliders'ı ekler)
function col(R, x0, x1, z0, z1) { const c = [x0, x1, z0, z1]; R.colliders.push(c); ADDED.push(c); if (R.unlocked) G.colliders.push(c); }

// ---------- ortak modeller ----------
// tebeşir tahtası (ayaklı): başlık ve satırlar canvas'tan
function menuBoard(title, lines, w = 1.1, h = 1.2) {
  const g = new THREE.Group(), c = document.createElement('canvas'); c.width = 256; c.height = Math.round((256 * h) / w);
  const x = c.getContext('2d');
  x.fillStyle = '#2f3a32'; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#a8743f'; x.lineWidth = 14; x.strokeRect(7, 7, c.width - 14, c.height - 14);
  x.fillStyle = '#ffe9a8'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(title, c.width / 2, 48);
  x.fillStyle = '#ffffff'; x.font = 'bold 22px sans-serif'; x.textAlign = 'left';
  lines.forEach((l, i) => x.fillText(l, 24, 92 + i * 34));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  face.position.set(0, 0.25 + h / 2, 0.04); g.add(face);
  M.rbox(w + 0.08, h + 0.08, 0.06, 0.02, M.mat('#8a5a33'), 0, 0.25 + h / 2, 0, g);
  for (const sx of [-1, 1]) M.rbox(0.06, 0.3, 0.06, 0.02, M.mat('#8a5a33'), sx * (w / 2 - 0.05), 0.15, -0.02, g);
  return g;
}
// ayaksız pano (duvara ya da tavana; models.js makeSign'in yere inen direkleri var)
function board(text, bg, w, h = 0.55) { return M.rbox(w, h, 0.1, 0.05, M.mat('#ffffff', { map: textTex(text, { bg, border: '#ffffff', w: 640, h: Math.round((640 * h) / w) }) })); }
// asılı tabela (tavandan iki iple)
function hangSign(text, bg, w, y = 3.0) {
  const g = new THREE.Group(), b = board(text, bg, w);
  b.position.y = y; g.add(b);
  for (const sx of [-1, 1]) M.cyl(0.012, 0.012, 1.2, 4, M.mat('#555'), sx * (w / 2 - 0.2), y + 0.87, 0, g);
  return g;
}
// renkli desenli halı dokusu (asılı kilim için)
function rugTex(a, b, c) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = a; x.fillRect(0, 0, 64, 128);
  x.fillStyle = b; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(32, 14 + i * 28); x.lineTo(50, 28 + i * 28); x.lineTo(32, 42 + i * 28); x.lineTo(14, 28 + i * 28); x.fill(); }
  x.fillStyle = c; x.fillRect(0, 0, 64, 6); x.fillRect(0, 122, 64, 6); x.fillRect(0, 0, 5, 128); x.fillRect(59, 0, 5, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function bucket(col = '#9aa3ab', water = true) {
  const g = new THREE.Group();
  M.cyl(0.17, 0.13, 0.3, 12, M.mat(col, { rough: 0.4 }), 0, 0.15, 0, g, true);
  if (water) M.cyl(0.155, 0.155, 0.01, 12, M.mat('#7fc4e8', { rough: 0.2 }), 0, 0.26, 0, g);
  return g;
}
function trough(w = 2.0) {
  const g = new THREE.Group();
  M.rbox(w, 0.45, 0.6, 0.06, wood(), 0, 0.23, 0, g);
  M.rbox(w - 0.14, 0.04, 0.46, 0.02, M.mat('#7fc4e8', { rough: 0.2 }), 0, 0.42, 0, g);
  return g;
}
function hayRack() { // tahta yemlik, içinde saman
  const g = new THREE.Group(), w = wood();
  for (const sx of [-1, 1]) M.rbox(0.08, 1.0, 0.08, 0.02, w, sx * 0.75, 0.5, 0, g);
  for (let i = -3; i <= 3; i++) { const s = M.rbox(0.04, 0.7, 0.04, 0.01, w, i * 0.22, 0.65, 0.12, g); s.rotation.x = -0.35; }
  M.rbox(1.6, 0.08, 0.5, 0.02, w, 0, 0.32, 0, g);
  const hay = M.rbox(1.4, 0.35, 0.4, 0.15, M.mat('#e8c45a'), 0, 0.52, 0, g); hay.scale.y = 0.9;
  return g;
}
// kasaya oyunun ürün adı verilir (karpuz, domates...), kasa ürün modelinin adını ister (watermelon, tomato...). Eşlenmeyince pazar
// süslemesinin hepsi (kasalar, çuvallar, kantar, el arabası) hata verip çizilmiyordu
const CRATE_MODEL = { karpuz: 'watermelon', domates: 'tomato', biber: 'paprika', patlican: 'eggplant', salatalik: 'cucumber' };
function crateStack(kinds) { kinds = kinds.map((k) => CRATE_MODEL[k] || k); const g = new THREE.Group(); const a = M.makeCrateOf(kinds.slice(0, 2)); g.add(a); const b = M.makeCrateOf(kinds.slice(2, 4)); b.position.set(0.12, 0.46, 0.04); b.rotation.y = 0.2; g.add(b); return g; }
function stool() { const g = new THREE.Group(); M.cyl(0.18, 0.18, 0.06, 12, M.mat('#e8604c'), 0, 0.72, 0, g); M.cyl(0.03, 0.04, 0.7, 6, M.mat('#c9ccd0'), 0, 0.36, 0, g); M.cyl(0.16, 0.16, 0.03, 10, M.mat('#c9ccd0'), 0, 0.02, 0, g); return g; }
function bistro(col) { // yuvarlak masa, iki sandalye, şemsiye
  const g = new THREE.Group();
  M.cyl(0.42, 0.42, 0.05, 14, M.mat('#ffffff'), 0, 0.74, 0, g); M.cyl(0.04, 0.05, 0.72, 6, M.mat('#8b939c'), 0, 0.37, 0, g);
  for (const sx of [-1, 1]) { const c = new THREE.Group(); c.position.set(sx * 0.75, 0, 0); c.rotation.y = -sx * PI / 2; g.add(c); M.rbox(0.42, 0.05, 0.42, 0.02, M.mat(col), 0, 0.45, 0, c); M.rbox(0.42, 0.45, 0.05, 0.02, M.mat(col), 0, 0.68, -0.19, c); for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) M.cyl(0.02, 0.02, 0.44, 4, M.mat('#8b939c'), x, 0.22, z, c); }
  // şemsiye masanın arkasında (kuzey): ortadaki direk masaya açılan tavlanın üstündeydi, kubbe de oynayanları kameradan örtüyordu
  const u = M.makeUmbrella(col); u.scale.setScalar(0.7); u.position.z = -1.05; g.add(u);
  return g;
}
function lookAt(o, x, z) { o.rotation.y = Math.atan2(x - o.position.x, z - o.position.z); }

// ---------- bölümler ----------
// ---------- duvar süsleri (2026-11-05 kullanıcı: "oyundaki tüm mekanları dekoratif anlamda gözden geçir ... ayak altı olmayacak
// şekilde daha detaylı objeler ekleyebilirsin"): hepsi duvara asılı, başın üstünde; çarpışma almaz, yürüyüşe karışmaz ----------
// duvar saati: akrep ve yelkovan oyunun saatini gösterir (daylight.js day.hour)
function wallClock(r = 0.32) {
  const g = new THREE.Group(), ink = M.mat('#2f3a32');
  M.cyl(r, r, 0.08, 24, ink, 0, 0, 0, g).rotation.x = PI / 2;
  M.cyl(r - 0.04, r - 0.04, 0.02, 24, M.mat('#fffaf0'), 0, 0, 0.045, g).rotation.x = PI / 2;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; M.rbox(0.025, i % 3 ? 0.04 : 0.08, 0.01, 0, ink, Math.sin(a) * (r - 0.1), Math.cos(a) * (r - 0.1), 0.06, g).rotation.z = -a; }
  const hand = (len, w, z) => { const p = new THREE.Group(); p.position.z = z; M.rbox(w, len, 0.012, 0, ink, 0, len / 2 - 0.03, 0, p); g.add(p); return p; };
  const hh = hand(r * 0.5, 0.035, 0.065), mh = hand(r * 0.75, 0.022, 0.075);
  M.sph(0.025, M.mat('#c8463a'), 0, 0, 0.085, g, 8, 6);
  anim.push({ o: g, f: () => { const h = day.hour % 12; hh.rotation.z = -(h / 12) * PI * 2; mh.rotation.z = -(h % 1) * PI * 2; } });
  return g;
}
// Şehir marketi: yan duvarlarda kampanya afişleri (soğutucuların ve reyonların üstünde), arka duvarın ortasında saat.
// 2026-11-08 market tek salon oldu (city.js CITY.rect [407,5, 452,5, -10,5, 10]): duvarların iç yüzleri x 407,9 / 452,1, arka z -10,1
function sehirDuvar(R) {
  const [x0, x1] = [407.9, 452.1];
  for (const [x, ry, list] of [[x0 + 0.06, PI / 2, [['🥕 TAZE SEBZE', '#3fae6b', -7], ['🍞 SICAK EKMEK', '#d8843a', -1], ['🌷 ÇİÇEK', '#c94f8a', 5]]],
    [x1 - 0.06, -PI / 2, [['❄️ DONDURMA', '#3d7dd8', -7], ['🎁 HEDİYELİK', '#9c4fd6', -1], ['💳 KARTLA ÖDE', '#2f6db5', 5]]]]) {
    for (const [t, bg, z] of list) put(R, board(t, bg, 2.2, 0.62), x, z, ry, 2.55);
  }
  put(R, wallClock(0.4), 430, -10.04, 0, 2.75);
}
// Şehir marketi: reyon tabelaları (tavandan), kasa önünde kuyruk şeridi ve KASA tabelası, girişte sepet ve arabalar,
// köşelerde saksılar
function sehir(R) {
  // raflar 3 m aralıklı (city.js CITY_PLACES; 2026-11-08 akış düzeni): tabelalar raf gruplarının üstünde. Manav orta reyonun batı
  // yarısının kuzey yüzünde (domatesten turşuya), sebze ayrı tabelası kalktı
  for (const [t, bg, x0, x1, z] of [['🥬 MANAV', '#3fae6b', 410.0, 427.0, -5.6], ['🧀 SÜT ÜRÜNLERİ', '#3d7dd8', 412.0, 424.0, -7.5], ['🍎 MEYVE', '#e8604c', 424.0, 436.0, -7.5], ['🥖 FIRIN', '#c8873a', 436.0, 448.0, -7.5]]) {
    const w = Math.min(4.2, x1 - x0 - 0.6); put(R, hangSign(t, bg, w, 3.3), (x0 + x1) / 2, z + 0.2);
  }
  put(R, hangSign('🧾 KASA', '#9c4fd6', 2.0, 3.3), 441, 2.6);
  const tapeM = M.mat('#f6c343');
  for (const x of [439.4, 442.6]) { const s = M.rbox(0.08, 0.012, 4.2, 0, tapeM, x, 0.015, 6.4, R.content); s.receiveShadow = true; } // kuyruk şeridi
  for (const x of [439.4, 442.6]) for (const zz of [4.6, 8.2]) { M.cyl(0.05, 0.08, 0.9, 8, M.mat('#c9ccd0'), x, 0.45, zz, R.content); } // şerit direkleri
  for (const x of [439.4, 442.6]) { const b = M.rbox(0.04, 0.06, 3.6, 0.01, M.mat('#e8473c'), x, 0.85, 6.4, R.content); b.castShadow = true; }
  const carts = new THREE.Group(); // girişin doğusunda alışveriş arabaları ve sepetler
  for (let i = 0; i < 3; i++) { const c = new THREE.Group(); c.position.set(i * 0.28, 0, 0); carts.add(c); M.rbox(0.55, 0.42, 0.8, 0.03, M.mat('#9aa3ab', { rough: 0.3 }), 0, 0.62, 0, c); M.cyl(0.015, 0.015, 0.4, 4, M.mat('#555'), 0, 1.0, 0.4, c).rotation.z = PI / 2; for (const [x, zz] of [[-0.22, -0.32], [0.22, -0.32], [-0.22, 0.32], [0.22, 0.32]]) M.sph(0.05, M.mat('#2a2a2a'), x, 0.05, zz, c, 8, 6); }
  put(R, carts, 434.6, 8.2, PI); col(R, 434.0, 435.8, 7.7, 8.7);
  for (let i = 0; i < 4; i++) { const b = M.makeBasket(); b.scale.setScalar(1.3); b.position.set(436.6, i * 0.2, 8.5); b.rotation.y = i * 0.15; b.children.forEach((m) => { if (m.material && m.material.color) m.material = M.mat('#e8473c'); }); R.content.add(shadow(b)); }
  for (const [x, zz] of [[410.2, 9.0], [449.8, 9.0], [450.8, -7.9], [408.6, 2.6]]) put(R, M.makeBush(0.8, '#5cb85c'), x, zz);
  // ön yarı (kasa ile giriş arası) boş kalıyordu. Duvar diplerine kampanya paletleri, dondurma dolabı, içecek dolapları; girişe paspas,
  // arka duvara afiş. Hepsi müşteri yolunun (kapı x 427-433 → raflar → kasa) ve ileride açılacak orta sıranın (x 434-446) dışında
  // kasa modelleri yalnız CRATE_MODEL'deki sebzeler için var (meyve modeli yok)
  // kampanya paletleri batı duvarının dibinde (hal paleti 2026-11-08'de deponun batısına, x 412,5 z 4,4'e geldi)
  for (const [x, zz, kinds, txt] of [[408.9, 5.6, ['karpuz', 'domates', 'biber', 'salatalik'], '%20 İNDİRİM'], [408.9, 8.0, ['patlican', 'domates', 'karpuz', 'biber'], 'KÖYDEN TAZE']]) {
    const g = new THREE.Group(); // palet, üstünde ürün kasaları, önünde ayaklı indirim tabelası
    M.rbox(1.4, 0.14, 1.1, 0.02, M.mat('#c9955a'), 0, 0.07, 0, g);
    const st = crateStack(kinds); st.position.y = 0.14; g.add(st);
    const sg = board(txt, '#e8473c', 0.9, 0.36); sg.position.set(0.95, 0.6, 0.35); sg.rotation.set(-0.5, -0.35, 0, 'YXZ'); g.add(sg); // geriye yaslı: yazı yukarıdan bakan kameraya döner
    for (const dx of [-0.36, 0.36]) M.cyl(0.02, 0.02, 0.45, 4, M.mat('#c9ccd0'), 0.95 + dx * 0.94, 0.22, 0.35 - dx * 0.34, g);
    put(R, g, x, zz); col(R, x - 0.75, x + 1.3, zz - 0.6, zz + 0.6);
  }
  const fr = new THREE.Group(); // dondurma dolabı: beyaz gövde, mavi şerit, camın altında renkli kaplar
  M.rbox(1.8, 0.8, 0.9, 0.06, M.mat('#f4f6f8'), 0, 0.4, 0, fr);
  M.rbox(1.82, 0.12, 0.92, 0.04, M.mat('#3d7dd8'), 0, 0.12, 0, fr);
  ['#f6c343', '#e8604c', '#8b5a2b', '#f2a1c2', '#7fc97f', '#ffffff'].forEach((c, i) => M.cyl(0.13, 0.13, 0.08, 10, M.mat(c), -0.55 + (i % 3) * 0.55, 0.79, i < 3 ? -0.18 : 0.18, fr));
  M.rbox(1.7, 0.03, 0.8, 0.01, M.mat('#bfe6ff', { opacity: 0.45, rough: 0.1 }), 0, 0.83, 0, fr);
  const fs = board('🍦 DONDURMA', '#3d7dd8', 1.2, 0.3); fs.position.set(0, 0.52, 0.47); fr.add(fs);
  put(R, fr, 408.45, 0.4, PI / 2); col(R, 408.0, 408.9, -0.5, 1.3); // batı duvarına yaslı, yüzü içeri
  for (const zz of [1.6, 4.0, 6.4]) { // içecek dolapları sağ duvarda, ön yüzleri içeri bakar: camın arkasında raf raf şişeler
    const d = new THREE.Group(), body = M.mat('#dfe5ea');
    M.rbox(0.1, 2.1, 2.2, 0.03, body, 0.35, 1.05, 0, d);
    for (const sz of [-1, 1]) M.rbox(0.8, 2.1, 0.08, 0.03, body, 0, 1.05, sz * 1.06, d);
    M.rbox(0.8, 0.14, 2.2, 0.03, M.mat('#e8473c'), 0, 2.03, 0, d);
    M.rbox(0.8, 0.3, 2.2, 0.03, body, 0, 0.15, 0, d);
    for (let r = 0; r < 3; r++) {
      M.rbox(0.6, 0.03, 2.0, 0.01, M.mat('#c9ccd0'), 0, 0.42 + r * 0.5, 0, d);
      for (let k = 0; k < 6; k++) M.rbox(0.12, 0.3, 0.12, 0.03, M.mat(['#e8473c', '#f6c343', '#3fae6b', '#3d7dd8', '#ff8a3d'][(r + k + Math.round(zz)) % 5]), -0.08, 0.59 + r * 0.5, -0.8 + k * 0.32, d);
    }
    M.rbox(0.03, 1.7, 2.0, 0.01, M.mat('#bfe6ff', { opacity: 0.3, rough: 0.1 }), -0.41, 1.12, 0, d);
    put(R, d, 451.7, zz); col(R, 451.25, 452.1, zz - 1.1, zz + 1.1); // doğu duvarına yaslı (market 1,5 m genişledi)
  }
  const wm = board('🛒 HOŞ GELDİNİZ', '#3fae6b', 4.0, 0.9); wm.rotation.x = -PI / 2; put(R, wm, 430, 9.0, 0, -0.035); wm.castShadow = false;
  for (const [x, t, bg] of [[418, '🥬 TAZE VE YERLİ', '#3fae6b'], [430, '⭐ HER GÜN UCUZ', '#e8473c'], [442, '🧺 KÖYDEN GELDİ', '#c8873a']]) {
    const b = board(t, bg, 3.2, 0.5); put(R, b, x, -10.04, 0, 2.75); b.castShadow = false;
  }
  put(R, M.makeBush(0.6, '#5cb85c'), 425.6, 9.1);
}
// Semt pazarı: tezgah sırasının iki ucunda ürün kasaları ve çuvallar
function pazar(R) {
  // tezgah sırasının iki ucundaki kasa yığınları (23,6/0,4 ve 48/-3,2) kaldırıldı (2026-11-03 kullanıcı: "buna benzer bir obje semt
  // pazarında da var, onu da kaldır"): tezgahın ucundan geçerken takılınıyordu
  for (let i = 0; i < 3; i++) { const s = M.makeFlourSack(); s.scale.setScalar(1.6); put(R, s, 23.4 + i * 0.5, -3.0 + (i % 2) * 0.3, i); }
  // kasanın yanındaki kantar (50,6/1,9) kaldırıldı (2026-11-02 kullanıcı: "kasanın orada meydanda bir obje var, adam takılıp duruyor")
  // el arabası (47,2/4,2) pazar caddesinin kaldırımını kapatıyordu: kaldırıldı (2026-11-01)
}
// Sahil büfesi: menü tahtası, içecek dolabı, iki masa ve tabureler (şemsiyeli)
function sahil(R) {
  const p = (k) => (ITEMS[k] ? ITEMS[k].price : '?');
  const mb = menuBoard('BÜFE', [`🌽 Mısır ........ ${p('misir')} ₺`, `🍦 Dondurma .... ${p('dondurma')} ₺`, '🥤 Soğuk içecek', '☀️ Güneşte serinle!']);
  put(R, mb, 27.6, 20.4, 0.25); col(R, 27.0, 28.2, 20.1, 20.7);
  // içecek dolabı artık barın içinde (models.js makeBeachBar)
  put(R, bistro('#3ec1b5'), 24.8, 23.4); col(R, 24.0, 25.6, 22.9, 23.9); col(R, 24.68, 24.92, 22.23, 22.47); // şemsiye direği
  put(R, bistro('#f6a623'), 44.6, 23.6); col(R, 43.8, 45.4, 23.1, 24.1); col(R, 44.48, 44.72, 22.43, 22.67);
  R.tavla = [{ x: 24.8, z: 23.4 }, { x: 44.6, z: 23.6 }]; // iki yanda oturup tavla oynayanlar (tavla.js)
  for (const x of [30.9, 31.9]) put(R, stool(), x, 20.05, 0); // bar tezgâhının önünde tabureler
}
// Koyun merası: su yalağı, yemlik, sağım yerinde güğümler, kırkımın yanında yün yığını
function mera(R) {
  put(R, trough(2.0), -31.5, 26.2); col(R, -32.6, -30.4, 25.9, 26.5);
  put(R, hayRack(), -24.6, 23.0, -PI / 2); col(R, -25.0, -24.2, 22.2, 23.8);
  for (let i = 0; i < 3; i++) put(R, M.makeMilkCan(), -43.7 + (i % 2) * 0.3, 17.2 + i * 0.32, i);
  for (let i = 0; i < 5; i++) { const w = M.makeWool(); w.scale.setScalar(1.4); put(R, w, -25.2 + (i % 3) * 0.35, 18.0 + Math.floor(i / 3) * 0.35, i, (i > 2 ? 0.25 : 0)); }
  put(R, bucket(), -42.9, 18.2);
}
// Dokuma atölyesi: batı çitinde asılı kilim ve halı sergisi, yün sepetleri, boya kazanları, satış masasında katlı kilimler
function atolye(R) {
  const rack = new THREE.Group(), w = wood();
  for (const sx of [-1.5, 0, 1.5]) M.rbox(0.1, 2.2, 0.1, 0.03, w, sx, 1.1, 0, rack);
  M.rbox(3.2, 0.08, 0.1, 0.02, w, 0, 2.15, 0, rack);
  [['#b23a48', '#f0c35a', '#2d3e66'], ['#2d6a8a', '#f4e6c8', '#b23a48'], ['#d8843a', '#3a2416', '#f0c35a']].forEach(([a, b, c], i) => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.7), new THREE.MeshStandardMaterial({ map: rugTex(a, b, c), side: THREE.DoubleSide, roughness: 0.95 }));
    r.position.set(-1.0 + i * 1.0, 1.25, 0.06); rack.add(r);
  });
  put(R, rack, -54.0, 19.4, 0); col(R, -55.7, -52.3, 19.2, 19.6); // güneye bakar: kapıdan girenin karşısında
  for (let i = 0; i < 3; i++) { const b = M.makeBasket(); b.scale.setScalar(1.6); const g = put(R, b, -46.3 + i * 0.0, 13.5 + i * 0.6, i * 0.5); for (let k = 0; k < 4; k++) M.sph(0.08, M.mat(['#b23a48', '#f0c35a', '#2d6a8a', '#f4f4f4'][(k + i) % 4]), -0.1 + (k % 2) * 0.16, 0.36, -0.05 + Math.floor(k / 2) * 0.1, g, 8, 6); }
  col(R, -46.8, -45.8, 13.1, 15.0);
  ['#b23a48', '#2d6a8a', '#e0b03a'].forEach((c, i) => { // boya kazanları: buğusu tüter
    const g = new THREE.Group(); M.cyl(0.4, 0.32, 0.5, 14, M.mat('#b8733a', { rough: 0.35 }), 0, 0.25, 0, g, true); M.cyl(0.38, 0.38, 0.03, 14, M.mat(c, { rough: 0.15 }), 0, 0.46, 0, g);
    const skein = M.rbox(0.12, 0.5, 0.05, 0.04, M.mat(c), 0, 1.25, 0, g); skein.castShadow = true; // üstteki ipte kuruyan çile
    const st = M.sph(0.14, M.mat('#ffffff', { opacity: 0.35 }), 0, 0.8, 0, g, 8, 6); anim.push({ o: st, f: (o, t) => { const k = (t * 0.5 + i * 0.33) % 1; o.position.y = 0.7 + k * 0.8; o.scale.setScalar(0.6 + k); o.material.opacity = 0.35 * (1 - k); } });
    put(R, g, -46.6, 22.6 + i * 0.85);
  });
  col(R, -47.0, -46.2, 22.2, 24.6);
  M.cyl(0.015, 0.015, 2.0, 4, M.mat('#8a5a33'), -46.6, 1.52, 23.45, R.content).rotation.x = PI / 2; // çile ipi
  for (const zz of [22.3, 24.6]) M.rbox(0.06, 1.55, 0.06, 0.02, wood(), -46.6, 0.78, zz, R.content);
  const tb = new THREE.Group(); M.rbox(1.6, 0.8, 0.7, 0.05, w, 0, 0.4, 0, tb); // satış masası: katlı kilimler
  for (let i = 0; i < 3; i++) { const k = M.rbox(0.6, 0.08, 0.5, 0.02, new THREE.MeshStandardMaterial({ map: rugTex(['#b23a48', '#2d6a8a', '#d8843a'][i], '#f0c35a', '#3a2416'), roughness: 0.95 }), -0.35 + (i % 2) * 0.7, 0.84 + Math.floor(i / 2) * 0.08, 0, tb); k.rotation.y = i * 0.1; }
  put(R, tb, -46.4, 15.9 + 0.0, 0); col(R, -47.2, -45.6, 15.5, 16.3);
  put(R, M.makeSign('🧶 EL DOKUMASI', '#b23a48', 2.4, 0.5), -46.4, 16.45, 0, 0).scale.setScalar(0.7);
}
// Kervansaray hanı: avlunun doğusunda yükünü indirmiş develer ve sandıklar, batı köşede kilimli sedir, kapıda hancı karşılar
function han(R) {
  for (const [x, z, ry] of [[6.6, -40.4, -2.3]]) { // ikinci deve güveç ocağına yer açtı (expand-east.js xhan2, 2026-11-02)
    const c = M.makeCamel(false); put(R, c, x, z, ry); col(R, x - 0.9, x + 0.9, z - 0.9, z + 0.9);
    const head = c.children[3]; if (head) anim.push({ o: head, f: (o, t) => { o.rotation.z = Math.sin(t * 0.8 + x) * 0.08; } }); // geviş getirir gibi
  }
  for (const [x, z] of [[8.6, -38.0], [9.2, -38.9], [5.8, -37.6]]) { const cr = M.makeCrate(); put(R, cr, x, z, x); }
  col(R, 5.3, 9.7, -39.4, -37.2);
  put(R, M.makeAmphora('#c8643b'), 9.4, -46.6); put(R, M.makeAmphora('#d8a04a'), 9.6, -47.3);
  const sedir = new THREE.Group(); // alçak sedir, minderler, önünde kilim ve sini
  M.rbox(2.2, 0.35, 0.7, 0.06, wood(), 0, 0.18, 0, sedir); M.rbox(2.2, 0.12, 0.66, 0.06, M.mat('#b23a48'), 0, 0.41, 0, sedir);
  for (const x of [-0.7, 0, 0.7]) { const m = M.rbox(0.55, 0.42, 0.14, 0.07, M.mat(['#f0c35a', '#2d6a8a', '#f0c35a'][Math.round(x + 1)]), x, 0.66, -0.24, sedir); m.rotation.x = -0.2; }
  put(R, sedir, -6.4, -37.6, 0); col(R, -7.5, -5.3, -38.0, -37.2);
  const rug = M.makeRug('#2d6a8a'); rug.scale.set(0.9, 1, 0.55); put(R, rug, -6.4, -38.9, PI / 2);
  const tray = M.cyl(0.32, 0.32, 0.04, 14, M.mat('#d8b04a', { rough: 0.3 }), -6.4, 0.06, -38.9, R.content); tray.castShadow = true;
  const h = M.makeCharacter({ shirt: '#7a3b2e', pants: '#3a2a1a', hat: 'cap', hatColor: '#b23a48', skin: '#d9a87a', mustache: true }); // hancı kapıda
  put(R, h, -2.6, -34.4, 0);
  anim.push({ o: h, f: (o, t, dt) => { M.animateCharacter(o, 0, dt, false); const u = o.userData, wave = Math.max(0, Math.sin(t * 0.9)); if (u.arms && u.arms[1]) { u.arms[1].rotation.x = -2.6 * wave; u.arms[1].rotation.z = -0.3 - Math.sin(t * 8) * 0.3 * wave; } } });
}
// At ahırı binası: her bölmede su kovası ve saman, ön duvarda nal panosu, uçta eyer askısı
function ahir(R) {
  for (const x of [-49.6, -45.6, -41.7, -37.8]) { put(R, bucket('#8a5a33'), x - 1.3, -2.7); const hb = M.makeHayBale(); hb.scale.setScalar(1.6); put(R, hb, x + 1.2, -2.8, 0.3); }
  const nal = new THREE.Group(); M.rbox(1.6, 0.9, 0.06, 0.03, wood(), 0, 0, 0, nal);
  for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12, PI * 1.5), M.mat('#8b939c', { rough: 0.3 })); t.position.set(-0.6 + (i % 3) * 0.6, 0.2 - Math.floor(i / 3) * 0.4, 0.05); t.rotation.z = PI * 0.75; nal.add(t); }
  put(R, nal, -43.7, 0.86, 0, 2.3);
  const er = new THREE.Group(); M.rbox(0.08, 1.1, 0.08, 0.02, wood(), 0, 0.55, 0, er); M.rbox(0.9, 0.08, 0.08, 0.02, wood(), 0, 1.05, 0, er);
  for (const sx of [-0.25, 0.25]) { const s = M.rbox(0.36, 0.14, 0.5, 0.07, M.mat('#7a4a22'), sx, 1.16, 0, er); s.rotation.z = sx * 0.6; }
  put(R, er, -52.6, 0.4, 0); col(R, -53.1, -52.1, 0.1, 0.7);
}
// Balıkçı iskelesi: tezgahın yanında buzlu balık kasası, korkulukta ağ ve şamandıralar, iskeleye bağlı kayık, restoranda menü,
// direklerde martılar
function iskele(R) {
  const ice = new THREE.Group(); M.rbox(1.1, 0.5, 0.7, 0.05, M.mat('#3d7dd8'), 0, 0.25, 0, ice); M.rbox(1.0, 0.06, 0.6, 0.02, M.mat('#eaf6ff', { rough: 0.2 }), 0, 0.5, 0, ice);
  for (let i = 0; i < 4; i++) { const f = makeItem('balik'); f.scale.setScalar(0.8); f.position.set(-0.3 + (i % 2) * 0.55, 0.56, -0.14 + Math.floor(i / 2) * 0.26); f.rotation.y = 0.3 + i; ice.add(f); }
  put(R, ice, -37.7, 33.8, 0.2); col(R, -38.3, -37.1, 33.4, 34.2);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.9), new THREE.MeshStandardMaterial({ color: '#c9b48a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 1, wireframe: true }));
  // ağ ve şamandıralar güney korkuluğunda, kayığa inilen yerin doğusunda (2026-11-04: batı korkuluğundaydılar, Restoran Terası
  // orayı açınca geçidin ortasında havada kalıyorlardı)
  net.scale.x = 0.8; net.position.set(-27.35, 0.75, 43.58); R.content.add(net);
  for (const [x, c] of [[-28.4, '#e8473c'], [-27.7, '#ffffff'], [-27.0, '#e8473c'], [-26.3, '#f6c343']]) M.sph(0.13, M.mat(c), x, 0.95, 43.62, R.content, 10, 8);
  const boat = M.makeBoat(); boat.scale.setScalar(0.8); put(R, boat, -31.0, 45.4, 0.15); // iskelenin güneyinde, suda
  anim.push({ o: boat, f: (o, t) => { o.position.y = Math.sin(t * 1.3) * 0.05 - 0.1; o.rotation.z = Math.sin(t * 1.1) * 0.04; } });
  const mb = menuBoard('BALIK RESTORANI', [`🐟 Izgara balık .. ${ITEMS.izgara ? ITEMS.izgara.price : '?'} ₺`, `🍲 Balık çorbası .. ${ITEMS.balikcorba ? ITEMS.balikcorba.price : '?'} ₺`, '⚓ Taze, iskeleden!'], 1.4, 1.0);
  put(R, mb, -37.9, 36.4, PI / 2.6); col(R, -38.3, -37.5, 36.0, 36.8);
  for (const [x, z] of [[-38.7, 43.55], [-25.7, 43.4]]) { // martı: direğin tepesinde başını çevirir
    const g = new THREE.Group(); const b = M.sph(0.16, M.mat('#ffffff'), 0, 0.14, 0, g, 10, 8); b.scale.set(0.8, 0.8, 1.3);
    const hd = new THREE.Group(); hd.position.set(0, 0.3, 0.14); g.add(hd); M.sph(0.08, M.mat('#ffffff'), 0, 0, 0, hd, 8, 6); M.cyl(0, 0.03, 0.1, 5, M.mat('#f6c343'), 0, -0.01, 0.1, hd).rotation.x = PI / 2;
    for (const sx of [-1, 1]) { const wg = M.rbox(0.06, 0.04, 0.3, 0.01, M.mat('#9aa3ab'), sx * 0.13, 0.18, -0.02, g); wg.rotation.z = sx * 0.2; }
    put(R, g, x, z, 0, 1.15);
    anim.push({ o: hd, f: (o, t) => { o.rotation.y = Math.sin(t * 0.7 + x) * 0.9 * (Math.sin(t * 0.3 + z) > 0 ? 1 : 0.2); } });
  }
}
// Kabuk tatil köyü: resepsiyon tabelası, bavul arabası, havuz başı bar ve tabureler, çamaşırhanenin yanında havlu arabası,
// evlerin arasında çiçekli çalılar
function tatil(R) {
  const s = board('🐚 RESEPSİYON', '#14c4c4', 2.4, 0.5); s.position.set(76.5, 2.6, 12.0); R.content.add(shadow(s));
  const lc = new THREE.Group(); // bavul arabası
  M.rbox(0.9, 0.06, 0.6, 0.02, M.mat('#d8b04a', { rough: 0.3 }), 0, 0.25, 0, lc); for (const sx of [-1, 1]) M.cyl(0.02, 0.02, 1.3, 6, M.mat('#d8b04a', { rough: 0.3 }), sx * 0.42, 0.9, 0, lc);
  M.cyl(0.02, 0.02, 0.86, 6, M.mat('#d8b04a'), 0, 1.55, 0, lc).rotation.z = PI / 2;
  for (const [x, y, c, h] of [[-0.2, 0.5, '#e8473c', 0.45], [0.22, 0.45, '#3d7dd8', 0.36], [0, 0.85, '#f6c343', 0.28]]) M.rbox(0.36, h, 0.5, 0.05, M.mat(c), x, y, 0, lc);
  for (const [x, z] of [[-0.38, -0.25], [0.38, -0.25], [-0.38, 0.25], [0.38, 0.25]]) M.sph(0.06, M.mat('#2a2a2a'), x, 0.06, z, lc, 8, 6);
  put(R, lc, 72.4, 13.4, 0.4); col(R, 71.8, 73.0, 13.0, 13.8);
  const bar = new THREE.Group(); // havuz başı bar: hasır çatılı tezgah
  M.rbox(2.0, 1.0, 0.7, 0.06, wood(), 0, 0.5, 0, bar); M.rbox(2.2, 0.08, 0.9, 0.03, M.mat('#f4e6c8'), 0, 1.04, 0, bar);
  for (const sx of [-1, 1]) M.cyl(0.05, 0.05, 2.3, 6, wood(), sx * 0.9, 1.15, -0.25, bar);
  const roof = M.cyl(0.05, 1.6, 0.6, 10, M.mat('#d8b46a', { flat: true }), 0, 2.55, -0.1, bar); roof.scale.z = 0.7;
  for (let i = 0; i < 3; i++) M.cyl(0.05, 0.04, 0.2, 8, M.mat(['#f6a623', '#3ec1b5', '#e8604c'][i]), -0.5 + i * 0.5, 1.18, 0.1, bar);
  put(R, bar, 73.2, 28.6, PI); col(R, 72.1, 74.3, 28.2, 29.0);
  for (const x of [72.6, 73.8]) put(R, stool(), x, 27.5);
  const tc = new THREE.Group(); M.rbox(0.9, 0.7, 0.55, 0.05, M.mat('#f4f5f6'), 0, 0.5, 0, tc); // havlu arabası
  for (let i = 0; i < 3; i++) M.rbox(0.7, 0.12, 0.45, 0.04, M.mat(['#3ec1b5', '#ffffff', '#f6a623'][i]), 0, 0.92 + i * 0.12, 0, tc);
  for (const [x, z] of [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]]) M.sph(0.05, M.mat('#2a2a2a'), x, 0.05, z, tc, 8, 6);
  put(R, tc, 97.4, 12.4, 0); col(R, 96.9, 97.9, 12.0, 12.8);
  // evlerin arasından sahile inen patikaların ortasındaki çalı ve çiçekler kaldırıldı (2026-11-01 kullanıcı: "yolda duranları kaldır")
}

const BUILD = { sehir, pazar, sahil, mera, atolye, han, atlar: ahir, iskele, tatil };
const WALLS = { sehir: sehirDuvar }; // dokuma atölyesinin ve e-ticaret ofisinin duvarları 2026-11-09'da kalktı, süsleri de
export function dressSections() {
  for (const [id, f] of Object.entries(BUILD)) {
    const R = G.regions[id];
    if (!R) continue;
    try { f(R); } catch (e) { console.warn('detay', id, e); }
    for (const a of anim) if (!a.R) a.R = R;
  }
  for (const [id, f] of Object.entries(WALLS)) { // duvar süsleri (ikinci tur)
    const R = G.regions[id];
    if (!R) continue;
    try { f(R); } catch (e) { console.warn('detay duvar', id, e); }
    for (const a of anim) if (!a.R) a.R = R;
  }
  window.__detay = { ADDED, anim: anim.length }; // test kancası
}
let T = 0, tagT = 3;
export function updateDetay(dt) {
  T += dt;
  for (const a of anim) { if (!a.R.unlocked || !a.R.content.visible) continue; a.f(a.o, T, dt); }
}
