// Sahne taramasının hızlı yolu (2026-11-10 yayın denetimi). Ölçüm: oyun sonunda sahnede 38 bin düğüm var. three her çizimde hepsinin
// yerel matrisini baştan kurup dünya matrisini çarpıyor (hızlı bilgisayarda karede 7 ms), sonra çizilecekleri bulmak için hepsini bir,
// gölge için bir kez daha geziyordu (5 + 3 ms). Düğümlerin 20 bini birleşmiş parçaların gizli asılları (perf.js), 7 bini kımıldamayan grup.
//
// Burada her düğümün yanında küçük bir kayıt (_w) durur; sahne o kayıtlar üstünden gezilir:
// - Yerel matris yalnız konum, dönüş ya da ölçek değiştiyse kurulur; dünya matrisi yalnız kendisi ya da bir atası değiştiyse (ya da
//   düğüm başka ataya bağlandıysa) çarpılır. Sonuç three'ninkiyle aynıdır.
// - Donmuş gizli asıl (noDraw, matrisi kapalı, çocuksuz) hiç gezilmez: kayıtların "live" listesinde yoktur.
// - Çizim taraması için her düğümün "drawKids" listesi tutulur: gizli asıllar ve çizilecek hiçbir şeyi kalmamış gruplar (dead) o
//   listede yoktur. three'nin projectObject'i ve gölge taraması children yerine bu listeyi gezer (lib/three.module.js, iki satır).
// Listeler add/remove/attach ile (aşağıda sarılı) ve perf.js / donuk.js'in refresh çağrısıyla kirlenir, tarama o düğüme gelince yenilenir.
// - Uyku: bir dal (düğüm ve bütün alt düğümleri) CALM tarama boyunca (~1,5 sn) hiç değişmediyse uyur; her karede değil dört karede bir
//   yoklanır (telefonda asıl maliyet her düğümün konum, dönüş, ölçek nesnelerine bellekten erişmekti: 17 bin düğümün 14 bini hiç
//   kımıldamıyor). Ekleme, çıkarma, attach, refresh ve three'nin updateMatrix'i dalı anında uyandırır; yalnız "sessiz" bir konum
//   yazımı (o.position.x = ...) en çok üç kare geç görülür: uzun süredir duran bir nesne kımıldamaya başlarken ilk üç kare eski
//   yerinde kalır, sonra yerine oturur. Gizli (visible=false) düğümler ve altları hiç uyumaz: gizliyken taşınıp sonra gösterilen
//   nesne eski yerinde görünmez. Atası kımıldayan dal uyumaz (dünya matrisi hemen yenilenir). ?uykusuz=1 uykuyu kapatır.
// - Sınır küresi: uyuyan dalın çizilebilir parçalarının dünya kürelerinin birleşimi dalın köküne yazılır (kbSphere). three çizim
//   ve gölge taramasında küre görüş alanının dışındaysa dalı hiç gezmez (lib/three.module.js, iki yer). three'nin parça parça yaptığı
//   sınamanın dal düzeyindeki eşidir: küre bütün parçaları kapsar, dal uyandığı an küre silinir. Örnekli çizimler (InstancedMesh),
//   ışıklar, yazı levhaları (Sprite), elenmesi kapalı parçalar dalı "sınırsız" yapar: o dal ve ataları elenmez. ?kuresiz=1 kapatır.
//
// three'nin updateMatrixWorld'üyle aynı davranış için kurallar:
// - matrixAutoUpdate kapalı düğümde three gibi davranılır: matris elle yazılır, matrixWorldNeedsUpdate ya da atası tetikler.
// - updateMatrixWorld'ü kendisi tanımlayan düğüm (iskeletli parça, ses, donuk.js'in dondurduğu kök) kendi yöntemiyle güncellenir, altı
//   three'nin yoluyla gezilir.
// - three'nin updateMatrix'i (lookAt, getWorldPosition, elle çağrı) matrisi yeni değerle kurunca kayıt da yenilenir, düğüm işaretlenir:
//   konumu değiştirip ölçüm alan, sonra geri koyan kod (A → B → A) eski matrisle kalmaz. three'nin kendi bayrağına
//   (matrixWorldNeedsUpdate) bakılmaz: oyun kodu bir nesnenin dünya konumunu her sorduğunda atalarının hepsinde, sahnenin kendisinde
//   bile updateMatrix çağrılır; bayrağa bakılsaydı her karede bütün sahne "değişti" sayılırdı.
// Sınama: ?matrisdenet=1 her çizimde bütün sahneyi three'nin kuralıyla baştan hesaplayıp karşılaştırır (window.__mtxBad),
// ?eskimatris=1 bu dosyayı devre dışı bırakır (three'nin kendi yolu).
import * as THREE from 'three';

const P = THREE.Object3D.prototype, STOCK = P.updateMatrixWorld, ADD = P.add, REMOVE = P.remove, ATTACH = P.attach;
const NONE = [];
const fresh = () => { const t = new Float64Array(10); t[0] = NaN; return t; };
const isLeaf = (o) => o.noDraw === true && o.children.length === 0; // birleşmiş parçanın gizli aslı
function make(o) {
  const auto = o.matrixAutoUpdate === true, custom = o.updateMatrixWorld !== STOCK;
  return (o._w = {
    o, p: o.position, q: o.quaternion, s: o.scale, t: auto ? fresh() : null, auto, wauto: o.matrixWorldAutoUpdate === true, custom,
    plain: !custom && (o.isGroup === true || o.type === 'Object3D'), // yalnız taşıyıcı: kendisi çizilmez
    live: NONE, kd: true, dead: false, force: true, md: false, calm: 0, slot: slots++, cu: false, bs: null,
  });
}
let slots = 0;
// dalda bir şey değişti (yapı, donma, three yoluyla yeni matris): düğüm ve uyuyan ataları uyanır
function stir(o) {
  for (let a = o; a !== null; a = a.parent) {
    const w = a._w;
    if (w === undefined) continue;
    if (w.calm === 0) break;
    w.calm = 0;
    if (w.bs !== null) { w.bs = null; a.kbSphere = undefined; }
  }
}
// ---------- sınır küresi ----------
// bs: null (hesaplanmadı / uyanık), EMPTY (çizilecek şey yok), OPEN (sınırsız: elenemez) ya da THREE.Sphere (dünya uzayında)
const EMPTY = { empty: true }, OPEN = { open: true };
let SPHERES = true, sphered = 0;
function sphereOf(w) {
  const o = w.o;
  let S = EMPTY;
  if (o.isMesh === true || o.isLine === true || o.isPoints === true) {
    if (isLeaf(o)) S = EMPTY; // gizli asıl çizilmez
    else if (o.frustumCulled === false || o.isInstancedMesh === true || o.isBatchedMesh === true || o.isSkinnedMesh === true) S = OPEN;
    else {
      const g = o.geometry;
      if (g.boundingSphere === null) g.computeBoundingSphere();
      S = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
      S.radius = S.radius * 1.1 + 0.3; // pay: geometrisi sonradan az büyüyen parça (büyüyen ekin) kenarda kesilmesin
    }
  } else if (w.plain !== true) S = OPEN; // ışık, yazı levhası, LOD, ses...: elenmez
  if (S !== OPEN) {
    const ch = o.children;
    for (let i = 0, l = ch.length; i < l; i++) {
      const c = ch[i];
      if (isLeaf(c)) continue;
      const cw = c._w, b = cw !== undefined && cw.custom !== true ? cw.bs : OPEN;
      if (b === EMPTY) continue;
      if (b === null || b === OPEN) { S = OPEN; break; } // çocuğun küresi yok (uyanık ya da sınırsız)
      S = S === EMPTY ? b.clone() : S.union(b);
    }
  }
  w.bs = S;
  o.kbSphere = S !== OPEN && S !== EMPTY && SPHERES === true ? S : undefined;
  sphered++;
}
// çizilebilir bir şey kazanan düğümün ölü sayılan ataları hemen dirilir (yoksa yeni parça birkaç kare görünmezdi)
function wake(o) {
  for (let a = o; a !== null; a = a.parent) {
    const w = a._w, out = w === undefined || w.dead || a.noDraw === true;
    if (w !== undefined) w.dead = false;
    if (!out) break;
    const pw = a.parent !== null ? a.parent._w : undefined;
    if (pw !== undefined) pw.kd = true;
  }
}
P.add = function (object) {
  ADD.apply(this, arguments);
  const w = this._w;
  if (w !== undefined) { w.kd = true; if (w.dead || this.noDraw === true) wake(this); }
  for (let i = 0; i < arguments.length; i++) { const c = arguments[i]; if (c && c._w !== undefined) c._w.force = true; } // yeni atasıyla dünya matrisi
  stir(this);
  return this;
};
P.remove = function (object) {
  REMOVE.apply(this, arguments);
  if (this._w !== undefined) this._w.kd = true;
  stir(this);
  return this;
};
// attach çocuğu add çağırmadan, children'a doğrudan ekler (three r171): ürün tepsiye, ele, rafa böyle geçer
P.attach = function (object) {
  ATTACH.call(this, object);
  const w = this._w;
  if (w !== undefined) { w.kd = true; if (w.dead || this.noDraw === true) wake(this); }
  if (object && object._w !== undefined) object._w.force = true;
  stir(this);
  return this;
};
P.updateMatrix = function () {
  const w = this._w, p = this.position, q = this.quaternion, s = this.scale;
  if (w !== undefined && w.t !== null) {
    const t = w.t;
    if (t[0] !== p.x || t[1] !== p.y || t[2] !== p.z || t[3] !== q._x || t[4] !== q._y || t[5] !== q._z || t[6] !== q._w || t[7] !== s.x || t[8] !== s.y || t[9] !== s.z) {
      t[0] = p.x; t[1] = p.y; t[2] = p.z; t[3] = q._x; t[4] = q._y; t[5] = q._z; t[6] = q._w; t[7] = s.x; t[8] = s.y; t[9] = s.z;
      w.md = true;
      if (w.calm !== 0) stir(this);
    }
  }
  this.matrix.compose(p, q, s);
  this.matrixWorldNeedsUpdate = true;
};
// Görüş alanının dışındaki kişi ya da araç (perf.js syncChars): kökünün matrisi güncellenir (yeri bilinsin), altındaki düğümler
// (kalça, kollar, kafa, taşıdığı sepet) gezilmez. Kalabalığın çoğu ekran dışında yürür: her karede 4 bin dünya matrisi boşuna
// çarpılıyordu. Görüşe girince bütün dalı o kare yenilenir. kbCull işareti nesnenin üstünde de durur: perf.js ürünleri ve
// bindirilen kişiyi buna bakarak kapatır
export function setCull(o, cull) {
  o.kbCull = cull;
  const w = o._w;
  if (w === undefined || w.cu === cull) return;
  w.cu = cull;
  if (!cull) w.force = true;
  stir(o);
}
// uzun süredir duran bir nesnede canlandırma başlarken (game.js popIn, bounce) çağrılır: uyuyan dal hemen uyanır, ilk kareler kaçmaz
export function poke(o) { stir(o); }
// düğümün gizliliği, donması ya da kendi updateMatrixWorld'ü değişince (perf.js hide/restore, donuk.js) çağrılır
export function refresh(o) {
  const w = o._w, par = o.parent;
  if (par !== null && par._w !== undefined) par._w.kd = true;
  if (o.noDraw !== true && par !== null) wake(par);
  if (w === undefined) { if (par !== null) stir(par); return; }
  w.auto = o.matrixAutoUpdate === true; w.wauto = o.matrixWorldAutoUpdate === true; w.custom = o.updateMatrixWorld !== STOCK;
  w.plain = !w.custom && (o.isGroup === true || o.type === 'Object3D');
  if (w.auto) { if (w.t === null) w.t = fresh(); else w.t[0] = NaN; }
  w.force = true;
  stir(o);
}

let visited = 0, composed = 0, multiplied = 0, rebuilt = 0, slept = 0, late = 0; // test kancası (window.__mtx)
const CALM = 90, EVERY = 3; // 90 tarama (~1,5 sn) değişmeyen dal uyur; uyuyan dal dört karede bir (maske 3) yoklanır
let F = 0, SLEEP = true;
function rebuild(w) {
  rebuilt++;
  w.kd = false;
  const o = w.o, ch = o.children, live = [], draw = [];
  let cut = false;
  for (let i = 0, l = ch.length; i < l; i++) {
    const c = ch[i];
    let cw = c._w;
    if (cw === undefined) cw = make(c);
    const leaf = isLeaf(c);
    if (!leaf || cw.auto) live.push(cw); // donmuş gizli asılın matrisi gezilmez (kımıldayan ürün parçası gezilir: perf.js syncItems okur)
    if (leaf || cw.dead) cut = true; else draw.push(c);
  }
  w.live = live;
  o.drawKids = cut ? draw : undefined;
  const dead = w.plain && draw.length === 0;
  if (dead !== w.dead) { w.dead = dead; const pw = o.parent !== null ? o.parent._w : undefined; if (pw !== undefined) pw.kd = true; }
}
// dönüş: bu dalda (düğüm ya da altları) bir şey değişti mi. hid: düğüm ya da bir atası gizli (uyku yok). full: uyuyan bir dalın
// yoklaması sürüyor: altındakiler de uyku sırasına bakılmadan gezilir (gecikme derinlikle katlanmasın)
function walk(w, force, hid, full) {
  visited++;
  const o = w.o;
  let any = force;
  if (w.force === true) { w.force = false; force = true; any = true; }
  if (w.auto === true) {
    const p = w.p, q = w.q, s = w.s, t = w.t;
    if (t[0] !== p.x || t[1] !== p.y || t[2] !== p.z || t[3] !== q._x || t[4] !== q._y || t[5] !== q._z || t[6] !== q._w || t[7] !== s.x || t[8] !== s.y || t[9] !== s.z) {
      t[0] = p.x; t[1] = p.y; t[2] = p.z; t[3] = q._x; t[4] = q._y; t[5] = q._z; t[6] = q._w; t[7] = s.x; t[8] = s.y; t[9] = s.z;
      o.matrix.compose(p, q, s); force = true; any = true; composed++;
      if (full === true) { late++; if (window.__lateLog !== undefined) window.__lateLog.push(o); }
    } else if (w.md === true) { force = true; any = true; } // three'nin yolu arada yeni değerle kurmuş
    w.md = false;
  } else if (o.matrixWorldNeedsUpdate === true) { o.matrixWorldNeedsUpdate = false; force = true; any = true; } // matrisi elle yazılan düğüm
  if (force === true && w.wauto === true) {
    const par = o.parent;
    if (par === null) o.matrixWorld.copy(o.matrix); else o.matrixWorld.multiplyMatrices(par.matrixWorld, o.matrix);
    multiplied++;
  }
  if (w.kd === true) { rebuild(w); any = true; }
  if (w.cu === true) { w.calm = 0; if (w.bs !== null) { w.bs = null; o.kbSphere = undefined; } return true; } // görüş dışındaki kişi: altı gezilmez (setCull)
  if (hid === false && o.visible === false) hid = true;
  if (hid === true) any = true; // gizli dal uyumaz
  const L = w.live;
  for (let i = 0, l = L.length; i < l; i++) {
    const c = L[i];
    if (c.custom === true) { const f = force || c.force; c.force = false; c.o.updateMatrixWorld(f); any = true; continue; }
    let deep = full;
    if (c.calm >= CALM && SLEEP === true) {
      if (force === false && full === false && hid === false && ((F + c.slot) & EVERY) !== 0) { slept++; continue; }
      deep = true;
    }
    if (walk(c, force, hid, deep) === true) any = true;
  }
  if (any === true) { w.calm = 0; if (w.bs !== null) { w.bs = null; o.kbSphere = undefined; } }
  else if (++w.calm === CALM) sphereOf(w); // çocuklar bu taramada ya da daha önce uyudu: küreleri hazır
  return any;
}

// ---------- sınama (?matrisdenet=1) ----------
const _m = new THREE.Matrix4(), _wm = new THREE.Matrix4(), _as = new THREE.Sphere();
const drawable = (o) => (o.isMesh || o.isLine || o.isPoints || o.isSprite || o.isLight || o.isLOD) && !isLeaf(o);
function anyDraw(o) { if (drawable(o) || o.updateMatrixWorld !== STOCK) return true; for (const c of o.children) if (!isLeaf(c) && anyDraw(c)) return true; return false; }
const pend = new Map(); // uyuşmazlık → ilk görüldüğü tarama
function audit(scene) {
  const bad = [];
  const eq = (a, b) => { for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-7 * (1 + Math.abs(b[i]))) return false; return true; };
  const go = (o) => {
    if (o.matrixAutoUpdate && !eq(o.matrix.elements, _m.compose(o.position, o.quaternion, o.scale).elements)) bad.push(['yerel', o.name || o.type, o.id]);
    if (o.matrixWorldAutoUpdate) {
      if (o.parent === null) _wm.copy(o.matrix); else _wm.multiplyMatrices(o.parent.matrixWorld, o.matrix);
      if (!eq(o.matrixWorld.elements, _wm.elements)) bad.push(['dünya', o.name || o.type, o.id, o.parent && (o.parent.name || o.parent.type)]);
    }
    if (o.drawKids !== undefined) for (const c of o.children) if (!o.drawKids.includes(c) && !isLeaf(c) && anyDraw(c)) bad.push(['çizim', c.name || c.type, c.id]);
    if (o.kbSphere !== undefined) {
      const K = o.kbSphere;
      o.traverseVisible((m) => {
        if (!(m.isMesh || m.isLine || m.isPoints) || isLeaf(m)) return;
        if (m.isInstancedMesh || m.isBatchedMesh || m.isSkinnedMesh || m.frustumCulled === false) { bad.push(['küre: sınırsız parça', m.name || m.type, m.id]); return; }
        const g = m.geometry; if (g.boundingSphere === null) g.computeBoundingSphere();
        _as.copy(g.boundingSphere).applyMatrix4(m.matrixWorld);
        if (_as.center.distanceTo(K.center) + _as.radius > K.radius + 1e-3) bad.push(['küre: dışarı taşan', m.name || m.type, m.id, +(_as.center.distanceTo(K.center) + _as.radius - K.radius).toFixed(3)]);
      });
    }
    if (o._w !== undefined && o._w.cu === true) return; // görüş dışındaki kişi: altı bilerek güncellenmez
    for (const c of o.children) { if (c.updateMatrixWorld !== STOCK) continue; if (isLeaf(c) && !c.matrixAutoUpdate) continue; go(c); }
  };
  go(scene);
  // uyku gecikmesi: aynı düğüm altı taramadan uzun bozuk kalırsa gerçek hata
  const now = new Set(), real = [];
  for (const b of bad) { const k = b[0] + b[2]; now.add(k); if (!pend.has(k)) pend.set(k, F); else if (F - pend.get(k) > 6) real.push(b); }
  for (const k of pend.keys()) if (!now.has(k)) pend.delete(k);
  return real;
}

// sahnenin kendi updateMatrixWorld'ü değişir: çizici (renderer.render) her çizimde bunu çağırır
export function fastMatrices(scene) {
  const root = make(scene), check = /[?&]matrisdenet=/.test(location.search);
  window.__mtxBad = [];
  SLEEP = !/[?&]uykusuz=/.test(location.search); SPHERES = !/[?&]kuresiz=/.test(location.search);
  scene.updateMatrixWorld = function (force) {
    F++;
    walk(root, force === true, false, false);
    if (check) { const b = audit(this); if (b.length) { window.__mtxBad.push(...b.slice(0, 5)); if (window.__mtxBad.length > 200) window.__mtxBad.length = 200; } }
  };
  window.__mtx = () => { const r = { visited, composed, multiplied, rebuilt, slept, late, sphered }; visited = composed = multiplied = rebuilt = slept = late = sphered = 0; return r; };
  window.__mtxAudit = () => audit(scene);
}
