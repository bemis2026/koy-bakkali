// Çevrimiçi katman: üyelik, bulut kaydı, profil, köyler sıralaması, haftalık yarış, komşu ziyareti ve yardımı, hediye,
// öneri kutusu. Arka uç Firebase (firebase-config.js doluysa); yerelde denemek için aynı arayüzü localStorage'da taklit
// eden deneme sunucusu (localhost'ta ?deneme=1 ya da localStorage 'koyBakkali.mock'='1'). İkisi de yoksa oyun eskisi gibi
// çevrimdışı açılır (ON.mode 'off'). Arayüz online-ui.js'te; kayıt seçimi persist.js'te.
import { G } from './game.js';
import { stars } from './rating.js';
import { FIREBASE, AUTH_SAME_SITE, AUTH_GITHUB } from './firebase-config.js';
import { temiz, uygun } from './filtre.js';
// başkasından gelen ad, köy adı ve hakkımda yazısı gösterilmeden önce süzülür (filtre.js)
const cleanRow = (r) => { if (r) for (const k of ['name', 'village', 'bio', 'fromName', 'note']) if (typeof r[k] === 'string') r[k] = temiz(r[k]); return r; };

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const MAIL = 'oyuncu.koybakkali.app'; // kullanıcı adıyla üye olanın sahte e-postası: ad@oyuncu.koybakkali.app
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
export const ON = { mode: 'off', user: null, profile: null, needName: false, authErr: null };
let B = null; // etkin arka uç

// ---------- yardımcılar ----------
// kullanıcı adı: küçük harf, Türkçe harfler sadeleşir, boşluk ve izin dışı işaretler atılır ("Kgüneş 97" → kgunes97);
// üye olurken de girişte de aynı sadeleştirme yapılır
const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
export const cleanName = (s) => String(s || '').trim().toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => TR[c]).replace(/[^a-z0-9_]/g, '');
export const validName = (s) => /^[a-z0-9_]{3,16}$/.test(s);
export const today = (d = new Date()) => d.toISOString().slice(0, 10);
// haftalık yarışın kimliği: ISO hafta (2026-H44), pazartesi başlar
export function weekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-H${String(w).padStart(2, '0')}`;
}
export const lastWeekId = () => weekId(new Date(Date.now() - 7 * 86400000));
const ERR = {
  'auth/invalid-credential': 'Kullanıcı adı ya da şifre yanlış', 'auth/wrong-password': 'Şifre yanlış', 'auth/user-not-found': 'Böyle bir oyuncu yok',
  'auth/invalid-login-credentials': 'Kullanıcı adı ya da şifre yanlış', 'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı. Google ile açtıysan "Google ile gir"e bas, yoksa Giriş yap.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı', 'auth/invalid-email': 'E-posta geçersiz', 'auth/too-many-requests': 'Çok deneme yapıldı, biraz bekle',
  'auth/popup-closed-by-user': 'Google penceresi kapandı', 'auth/popup-blocked': 'Tarayıcı Google penceresini engelledi', 'auth/network-request-failed': 'İnternet bağlantısı yok',
  'auth/unauthorized-domain': 'Bu adres Firebase\'de izinli değil (Authentication → Ayarlar → Yetkili alan adları)',
  'auth/operation-not-supported-in-this-environment': 'Bu tarayıcı Google penceresini açamadı', 'auth/cancelled-popup-request': 'Google penceresi zaten açık',
  'auth/requires-recent-login': 'Güvenlik için çıkış yapıp yeniden gir, sonra tekrar dene', 'auth/provider-already-linked': 'Bu hesabın zaten şifresi var',
  'auth/credential-already-in-use': 'Bu kullanıcı adı başka bir hesapta', 'auth/account-exists-with-different-credential': 'Bu e-posta başka bir yolla kayıtlı: e-posta ve şifreyle gir',
  'auth/internal-error': 'Google girişi tamamlanamadı, tekrar dene', 'auth/user-disabled': 'Bu hesap kapatılmış',
  'permission-denied': 'İzin yok (Firestore kuralları)', unavailable: 'Sunucuya ulaşılamadı',
};
export const errText = (e) => ERR[e && e.code] || (e && e.message) || String(e);
const fail = (code, message) => Object.assign(new Error(message || ERR[code] || code), { code });

// köy puanı: yalnız para değil, köyü iyi işletmek de sayılır (sıralamanın ana sekmesi)
// seviye ×100 + açılan kilit ×15 + memnuniyet yıldızı ×200 + şehir marketi 300 + komşu yardımı + √(toplam kazanç)
export function computeScore() {
  const st = G.stats || {}, help = st.helpPts || 0, earned = Math.floor(st.earned || 0);
  const koy = Math.round((G.level || 1) * 100 + G.unlocked.size * 15 + stars() * 200 + (G.unlocked.has('gc') ? 300 : 0) + help + Math.sqrt(earned));
  return { koy, earned, level: G.level || 1, xp: Math.floor(G.xp || 0), help, stars: Math.round(stars() * 10) / 10, regions: G.unlocked.size };
}
// bu haftanın puanı: hafta başından beri kazanç/50 + yardım puanı; hafta değişince taban yenilenir (G.stats.week)
export function weekScore() {
  const st = G.stats, wk = weekId();
  if (!st.week || st.week.id !== wk) st.week = { id: wk, earned0: Math.floor(st.earned || 0), help0: st.helpPts || 0 };
  const earned = Math.max(0, Math.floor(st.earned || 0) - st.week.earned0), help = Math.max(0, (st.helpPts || 0) - st.week.help0);
  return { id: wk, earned, help, score: Math.floor(earned / 50) + help };
}

// ---------- başlat ----------
// açılışta modellerle aynı anda başlar (main.js); giriş kapısı aynı sözü bekler, SDK modellerin ardından inmez
let initP = null;
export const initOnline = () => initP || (initP = initOnline0());
async function initOnline0() {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local && (new URLSearchParams(location.search).has('deneme') || ls('koyBakkali.mock') === '1')) { ls('koyBakkali.mock', '1'); B = mockBackend(); ON.mode = 'mock'; }
  else if (FIREBASE && FIREBASE.apiKey) {
    try { B = await firebaseBackend(FIREBASE); ON.mode = 'firebase'; } catch (e) { console.warn('Firebase açılamadı, çevrimdışı', e); return ON; }
  } else return ON;
  const u = await B.current();
  // açılışta profil okunamazsa (günlük kota doldu, reklam engelleyici, bağlantı yok) oyun yine açılır: bu cihazdaki son profil kopyasıyla;
  // o da yoksa giriş kapısı gösterilir. Eskiden hata yukarı çıkıyor, üyeler "Yüklenemedi" ekranında kalıyordu (2026-11-10 denetimi)
  if (u) { try { await afterLogin(u, true); } catch (e) { console.warn('profil okunamadı', e); ON.user = null; ON.profile = null; } }
  return ON;
}
async function afterLogin(u, boot = false) {
  const key = `koyBakkali.prof.${u.uid}`;
  let p;
  try { p = await B.get('users', u.uid); if (p) ls(key, JSON.stringify(p)); }
  catch (e) {
    if (!boot) throw e;
    try { p = JSON.parse(ls(key) || 'null'); } catch (e2) { p = null; }
    if (!p) throw e;
    console.warn('profil buluttan okunamadı, cihazdaki kopya kullanılıyor', e);
  }
  ON.user = u;
  ON.profile = p;
  ON.needName = !ON.profile; // Google ile ilk giriş: kullanıcı adı seçilmeli
  ls('koyBakkali.guest', null);
}
// kullanıcı adıyla ya da e-postayla üye ol; kullanıcı adı herkese tekil
export async function signUp({ username, password, email, name }) {
  const un = cleanName(username);
  if (!validName(un)) throw fail('name', 'Kullanıcı adı 3-16 harf olmalı: a-z, 0-9 ve _');
  if (!uygun(un) || !uygun(name)) throw fail('name', 'Bu ad kullanılamaz, başka bir ad seç');
  if (await B.get('usernames', un)) throw fail('name', 'Bu kullanıcı adı alınmış');
  const mail = email ? email.trim() : `${un}@${MAIL}`;
  await keep();
  let u;
  try { u = await B.create(mail, password); } catch (e) {
    if (e.code !== 'auth/email-already-in-use') throw e;
    // yarım kalmış üyelik (hesap açıldı, profil yazılamadı): aynı şifreyle girip tamamlanır
    u = await B.login(mail, password).catch(() => { throw email ? e : fail('name', 'Bu kullanıcı adı alınmış'); });
    if (await B.get('users', u.uid)) { await afterLogin(u); return; }
  }
  await claimName(u, un, name);
  await afterLogin(u);
}
// Google ile ilk girişte ya da profili yarım kalan için. Şifre verilirse hesaba bağlanır: kullanıcı adı + şifreyle de girilir
export async function chooseName(username, name, password) {
  const un = cleanName(username);
  if (!validName(un)) throw fail('name', 'Kullanıcı adı 3-16 harf olmalı: a-z, 0-9 ve _');
  if (!uygun(un) || !uygun(name)) throw fail('name', 'Bu ad kullanılamaz, başka bir ad seç');
  const own = await B.get('usernames', un);
  if (own && own.uid !== ON.user.uid) throw fail('name', 'Bu kullanıcı adı alınmış'); // kendi yarım kalan adı geri alınır
  if (password) {
    try { await B.linkPassword(`${un}@${MAIL}`, password); } catch (e) {
      if (e.code === 'auth/email-already-in-use') throw fail('name', 'Bu kullanıcı adı alınmış');
      if (e.code !== 'auth/provider-already-linked') throw e;
    }
  }
  await claimName(ON.user, un, name, !!own);
  await afterLogin(ON.user);
}
async function claimName(u, un, name, owned = false) {
  if (!owned) await B.set('usernames', un, { uid: u.uid });
  await B.set('users', u.uid, { username: un, name: (name || un).slice(0, 20), avatar: '🧑‍🌾', color: '#3b8beb', bio: '', village: (G.custom && G.custom.name) || 'Köy Bakkalı', badges: [], created: Date.now(), score: { koy: 0, earned: 0, level: 1, xp: 0, help: 0, stars: 1, regions: 0 } });
}
export async function signIn(id, password) {
  const s = String(id || '').trim(), byMail = s.includes('@');
  await keep();
  let u;
  try { u = await B.login(byMail ? s : `${cleanName(s)}@${MAIL}`, password); } catch (e) {
    if (!/invalid-credential|invalid-login|user-not-found|wrong-password/.test(e.code || '')) throw e;
    // neden girilemediği: Google ile açılan hesabın şifresi yoktur; e-postayla açılan hesaba kullanıcı adıyla girilemez
    if (byMail) throw fail('login', 'E-posta ya da şifre yanlış. Bu e-postayla Google üzerinden açtıysan "Google ile gir"e bas.');
    const known = await B.get('usernames', cleanName(s)).catch(() => null);
    throw fail('login', known ? 'Şifre yanlış. Unuttuysan hesabına bağlı Google hesabıyla "Google ile gir"e bas, sonra Menü → Profil\'den yeni şifre belirle.' : 'Bu kullanıcı adıyla üye yok. Google ile açtıysan "Google ile gir"e bas, yoksa Üye ol.');
  }
  ls('koyBakkali.lastId', s);
  await afterLogin(u);
}
// şifre belirle / değiştir (Profil): Google ile giren de kullanıcı adı + şifreyle girebilir; şifresini unutan Google ile girip yeniler
export async function setPassword(pw) {
  if (!signedIn()) throw fail('login', 'Önce giriş yap');
  if (String(pw || '').length < 6) throw fail('auth/weak-password');
  await B.setPassword(`${ON.profile.username}@${MAIL}`, pw);
}
// Google penceresi dokunuşla aynı anda açılmalı: önce kalıcılık (IndexedDB) beklenirse telefon tarayıcısı dokunuşu saymaz, pencereyi
// engeller, yönlendirmeye düşülür (2026-11-11 kullanıcı: "google ile gir çalışmıyor"). Kalıcılık girişten sonra ayarlanır
export async function signInGoogle() { const u = await B.google(); await keep(); if (u) await afterLogin(u); }
// çıkışta yerel kaydın sahibi silinmez: başka hesap girerse bu kaydı devralmasın (kendi bulut kaydı ya da yeni oyun)
export const myKey = (k) => mine(k);
export async function signOut() { await B.logout(); ON.user = null; ON.profile = null; }
// hesabı sil (2026-11-10, KVKK/mağaza şartı): bulut kaydı, profil, kullanıcı adı, gelen kutusu, son 12 haftanın sıralama satırları,
// kendi köy odasının yazışması ve giriş hesabı silinir. Firebase hesabı silmek için yakın zamanda girilmiş olmayı ister:
// 5 dakikadan eski oturumda önce yeniden giriş istenir (yoksa veri silinip hesap kalabilirdi). Bu cihazdaki oyun misafir olarak sürer
export async function deleteAccount() {
  if (!signedIn()) throw fail('login', 'Önce giriş yap');
  const u = ON.user, uid = u.uid, un = ON.profile.username;
  const t = Date.parse((u.metadata && u.metadata.lastSignInTime) || '') || 0;
  if (ON.mode === 'firebase' && Date.now() - t > 280000) throw fail('login', 'Güvenlik için önce çıkış yapıp yeniden gir, sonra hemen hesabını sil');
  const off = () => {};
  let bad = 0; const miss = () => { bad++; };
  closing = true; // silme sürerken bulut kaydı ve puan yazılmaz (az önce silinen belgeler yeniden yaratılıyordu)
  try {
  for (let i = 0; i < 12; i++) await B.remove(`weekly/${weekId(new Date(Date.now() - i * 7 * 86400000))}/scores`, uid).catch(off);
  for (const it of await B.list(`inbox/${uid}/items`).catch(() => { bad++; return []; })) await B.remove(`inbox/${uid}/items`, it.id).catch(miss);
  await B.remove('villages', uid).catch(miss);
  try { const L = await liveDb(); if (L) { const c = await L.D.get(L.D.ref(L.db, `rooms/${uid}/chat`)); if (c.exists()) for (const k of Object.keys(c.val())) await L.D.remove(L.D.ref(L.db, `rooms/${uid}/chat/${k}`)).catch(off); } } catch (e) { /* oda yok */ } // kurallar yazıları tek tek siler (database.rules.json)
  if (un) await B.remove('usernames', un).catch(off);
  await B.remove('users', uid).catch(miss);
  // kişisel veri (bulut kaydı, gelen kutusu, profil) silinemediyse giriş hesabı silinmez: yoksa sahipsiz veri kalırdı
  if (bad) throw fail('del', 'Bazı veriler silinemedi. Bağlantını kontrol edip yeniden dene');
  await B.deleteUser();
  ls(`koyBakkali.prof.${uid}`, null);
  ON.user = null; ON.profile = null;
  ls('koyBakkali.owner', null); ls('koyBakkali.lastId', null); playGuest();
  } finally { closing = false; }
}
export const playGuest = () => ls('koyBakkali.guest', '1');
export const isGuest = () => ls('koyBakkali.guest') === '1';
export const signedIn = () => !!(ON.user && ON.profile);
// açık kal (giriş ekranındaki kutu): işaretliyse oturum çıkış yapılana kadar sürer, değilse tarayıcı kapanınca biter.
// Son girilen kullanıcı adı hatırlanır, giriş kutusuna hazır gelir
export const rememberMe = (v) => { if (v === undefined) return ls('koyBakkali.remember') !== '0'; ls('koyBakkali.remember', v ? '1' : '0'); };
export const lastLogin = () => ls('koyBakkali.lastId') || '';
const keep = async () => { if (B && B.remember) await B.remember(rememberMe()); };

// ---------- kayıt ----------
// yerel kayıt kimin: başka hesapla girilince o kayıt yeni oyuncuya geçmesin
export const localOwner = () => ls('koyBakkali.owner');
export const setOwner = (uid) => ls('koyBakkali.owner', uid);
export async function loadCloud(uid = ON.user && ON.user.uid) {
  if (!uid) return null;
  const v = await B.get('villages', uid);
  try { return v && v.data ? JSON.parse(v.data) : null; } catch (e) { return null; }
}
// Bulut kaydı kuralları (2026-11-10 denetimi):
  // - cloudOk: açılışta buluttaki kayıt okunabildiyse (ya da bilerek yeni oyun seçildiyse) yazılır. Okuma hata verdiyse yazılmaz:
  //   eskiden hata "kayıt yok" sayılıyor, 3 sn sonra yerel (belki eski) kayıt buluttaki ilerlemenin üstüne yazılıyordu.
  // - gizli sekme yazmaz, oyun süresi ilerlemediyse yazılmaz: açık unutulan sekme başka cihazdaki ilerlemeyi geri almaz, kota yemez.
  // - 3 dakikada bir (eskiden 1): ücretsiz planın günlük yazma kotası. Sekme gizlenirken ve çıkışta yine hemen yazılır.
let cloudT = 0, cloudBusy = false, cloudOk = false, cloudLast = -1, closing = false;
export const cloudReady = (v) => { cloudOk = !!v; };
export const cloudIsReady = () => cloudOk;
export function saveCloud(data, force = false) {
  if (!signedIn() || G.visit || cloudBusy || !cloudOk || closing) return Promise.resolve();
  const now = Date.now(), time = (data.stats && data.stats.time) || 0;
  if (time === cloudLast) return Promise.resolve(); // son yazılandan beri oynanmadı
  if (!force && (document.hidden || now - cloudT < 180000)) return Promise.resolve();
  cloudT = now; cloudLast = time; cloudBusy = true;
  const s = computeScore();
  const p = B.set('villages', ON.user.uid, { data: JSON.stringify(data), ts: now, time: (data.stats && data.stats.time) || 0, name: ON.profile.name, village: (data.custom && data.custom.name) || '', level: s.level })
    .catch((e) => { cloudLast = -1; console.warn('bulut kaydı', e); }).finally(() => { cloudBusy = false; });
  publishScore(false);
  return p;
}
// sıralama: kullanıcı belgesindeki puanlar ve bu haftanın puan satırı (iki dakikada bir)
let pubT = 0;
export function publishScore(force = false) {
  if (!signedIn() || G.visit || closing) return;
  const now = Date.now();
  if (!force && now - pubT < 300000) return; // 5 dakikada bir (eskiden 2): iki belgeye yazılıyor
  pubT = now;
  const score = computeScore(), wk = weekScore(), P = ON.profile, village = (G.custom && G.custom.name) || P.village;
  Object.assign(P, { score, village });
  B.update('users', ON.user.uid, { score, village, seen: now }).catch((e) => console.warn('puan', e));
  B.set(`weekly/${wk.id}/scores`, ON.user.uid, { name: P.name, username: P.username, avatar: P.avatar, village, score: wk.score, earned: wk.earned, help: wk.help, ts: now }).catch(() => {});
}

// ---------- profil ----------
export async function saveProfile(patch) {
  const p = {};
  for (const k of ['name', 'avatar', 'color', 'bio', 'village']) if (patch[k] !== undefined) p[k] = String(patch[k]).slice(0, k === 'bio' ? 120 : 24);
  for (const k of ['name', 'bio', 'village']) if (p[k] && !uygun(p[k])) throw fail('name', 'Yazdıklarında uygun olmayan bir sözcük var');
  await B.update('users', ON.user.uid, p);
  Object.assign(ON.profile, p);
}
export const getProfile = (uid) => B.get('users', uid).then(cleanRow);
export async function addBadge(b) {
  const list = ON.profile.badges || [];
  if (list.includes(b)) return;
  list.push(b); ON.profile.badges = list;
  await B.update('users', ON.user.uid, { badges: list });
}

// ---------- sıralamalar ----------
// kind: koy | earned | level | help → kullanıcı belgelerinden; week → haftalık tablodan
export async function board(kind, n = 50) {
  if (kind === 'week') return (await B.top(`weekly/${weekId()}/scores`, 'score', n)).map((r) => cleanRow({ ...r, value: r.score }));
  const rows = await B.top('users', `score.${kind}`, n);
  return rows.map((r) => cleanRow({ ...r, value: r.score ? r.score[kind] : 0 }));
}
// geçen haftanın ilk üçü rozet alır (yeni haftada ilk açılışta, kendi rozetini kendisi işler)
export async function weeklyAward() {
  if (!signedIn()) return null;
  const wk = lastWeekId(), key = `hafta:${wk}`;
  if ((ON.profile.badges || []).some((b) => b.startsWith(key))) return null;
  const top = await B.top(`weekly/${wk}/scores`, 'score', 3);
  const i = top.findIndex((r) => r.id === ON.user.uid);
  if (i < 0) return null;
  await addBadge(`${key}:${i + 1}`);
  return { place: i + 1, week: wk };
}

// ---------- komşu: ziyaret, yardım, hediye ----------
// günlük sayaçlar ve bekleyen harçlık hesaba göre ayrı tutulur (aynı cihazda iki hesap karışmasın)
const mine = (k) => `${k}.${ON.user ? ON.user.uid : 'misafir'}`;
const HELP_DAY = 'koyBakkali.helpDay'; // { tarih, [uid] }: her komşuya günde bir ödüllü ziyaret
export function helpedToday(uid) {
  try { const d = JSON.parse(ls(mine(HELP_DAY)) || '{}'); return d.day === today() && (d.ids || []).includes(uid); } catch (e) { return false; }
}
function markHelped(uid) {
  let d; try { d = JSON.parse(ls(mine(HELP_DAY)) || '{}'); } catch (e) { d = {}; }
  if (d.day !== today()) d = { day: today(), ids: [] };
  d.ids.push(uid); ls(mine(HELP_DAY), JSON.stringify(d));
}
// yardım vardiyası bitti: emeğin karşılığı komşunun gelen kutusuna, yardım puanı ve harçlık bekleyen olarak kendine
// sentLive: ev sahibi oyundayken canlı ziyarette anında gönderilen para (canli.js); gelen kutusuna yalnız kalanı gider.
// stocked: misafirin dizdiği ürün sayısı, puana sayılır
export async function finishHelp(to, money, items, sentLive = 0, stocked = 0) {
  const first = !helpedToday(to); // aynı komşuya günün ikinci ziyareti: emek ona gider, puan ve harçlık yok
  const pts = first ? Math.min(200, Math.round(money / 20 + items * 2 + stocked)) : 0;
  const reward = first ? Math.round(money * 0.1) : 0;
  const me = ON.profile;
  const rest = Math.max(0, Math.round(money - sentLive));
  if (rest > 0 || items > 0) await B.add(`inbox/${to}/items`, { from: ON.user.uid, fromName: me.name, avatar: me.avatar, kind: 'help', money: Math.min(100000, rest), items, ts: Date.now() }); // kural üst sınırı: aşarsa bütün vardiya reddedilirdi
  if (first) markHelped(to);
  ls(mine('koyBakkali.pendingHelp'), JSON.stringify({ pts, reward, ts: Date.now() }));
  return { pts, reward };
}
// evde ilk açılışta: ziyaretten kalan yardım puanı ve harçlık
export function takePendingHelp() {
  let p = null; try { p = JSON.parse(ls(mine('koyBakkali.pendingHelp')) || 'null'); } catch (e) { /* yok */ }
  ls(mine('koyBakkali.pendingHelp'), null);
  return p;
}
const GIFT_DAY = 'koyBakkali.giftDay';
export function giftsLeft() {
  try { const d = JSON.parse(ls(mine(GIFT_DAY)) || '{}'); return d.day === today() ? Math.max(0, 3 - d.n) : 3; } catch (e) { return 3; }
}
export async function sendGift(to, gift) {
  if (giftsLeft() <= 0) throw fail('gift', 'Bugünlük hediye hakkın bitti (günde 3)');
  const me = ON.profile;
  await B.add(`inbox/${to}/items`, { from: ON.user.uid, fromName: me.name, avatar: me.avatar, kind: 'gift', money: Math.round(gift.money || 0), goods: gift.goods || null, note: String(gift.note || '').slice(0, 80), ts: Date.now() });
  let d; try { d = JSON.parse(ls(mine(GIFT_DAY)) || '{}'); } catch (e) { d = {}; }
  if (d.day !== today()) d = { day: today(), n: 0 };
  d.n++; ls(mine(GIFT_DAY), JSON.stringify(d));
}
export const inbox = () => B.list(`inbox/${ON.user.uid}/items`).then((l) => l.map(cleanRow));
export const dropInbox = (id) => B.remove(`inbox/${ON.user.uid}/items`, id);

// ---------- öneri kutusu ----------
export async function sendFeedback(kind, text) {
  const t = String(text || '').trim();
  if (t.length < 3) throw fail('fb', 'Biraz daha yaz');
  const anon = kind === 'hata'; // hata raporu kimlik taşımaz (gizlilik.html)
  await B.add('feedback', { uid: !anon && ON.user ? ON.user.uid : null, name: anon ? 'hata' : ON.profile ? ON.profile.name : 'misafir', kind, text: t.slice(0, 1000), ts: Date.now(), level: G.level || 1, host: location.host });
}
export const listFeedback = () => B.top('feedback', 'ts', 100);
// canlı ziyaret (canli.js): anlık veritabanı bağlantısı; çevrimdışıysa null
export const liveDb = () => (B && B.live ? B.live() : Promise.resolve(null));
export const dropFeedback = (id) => B.remove('feedback', id);

// =====================================================================
// Firebase arka ucu: SDK gstatic'ten modül olarak gelir (derleme yok)
// =====================================================================
// ana ekrandan açılan kurulu uygulama (tam ekran ya da tek pencere; iPhone'da navigator.standalone)
const appMode = () => ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches) || navigator.standalone === true;
async function firebaseBackend(cfg) {
  const [A, U, F] = await Promise.all([import(`${SDK}firebase-app.js`), import(`${SDK}firebase-auth.js`), import(`${SDK}firebase-firestore.js`)]);
  const conf = { ...cfg };
  if (AUTH_SAME_SITE && /\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) conf.authDomain = location.host;
  // GitHub Pages: giriş yardımcısı (__/auth/handler, iframe) oyunla aynı adreste, alt klasörde durur. Google'dan dönüş başka alan adına
  // giderse telefon tarayıcısı ve kurulu uygulama oturumu okuyamıyordu (üçüncü taraf depolama bölünmesi): "girişsiz geri dönüyor"
  else if (AUTH_GITHUB && /\.github\.io$/.test(location.hostname)) conf.authDomain = location.host + location.pathname.replace(/\/[^/]*$/, '');
  const app = A.initializeApp(conf), auth = U.getAuth(app), db = F.getFirestore(app);
  const ref = (col, id) => F.doc(db, col, id);
  const gp = () => { const p = new U.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; };
  return {
    // açılışta önce Google yönlendirmesinden dönüş alınır (pencere açılamayan tarayıcılar), sonra kayıtlı oturum
    current: async () => {
      try { const r = await U.getRedirectResult(auth); if (r && r.user) return r.user; } catch (e) { console.warn('Google dönüşü', e); ON.authErr = e; }
      return new Promise((res) => { const off = U.onAuthStateChanged(auth, (u) => { off(); res(u); }); });
    },
    create: async (email, pw) => (await U.createUserWithEmailAndPassword(auth, email, pw)).user,
    login: async (email, pw) => (await U.signInWithEmailAndPassword(auth, email, pw)).user,
    remember: (on) => U.setPersistence(auth, on ? U.browserLocalPersistence : U.browserSessionPersistence),
    // Google: önce pencere; açılamazsa (engelleyici, kurulu uygulama) aynı sekmede Google'a gidilir, dönüşü current() alır.
    // Ana ekrana kurulu uygulamada pencere ayrı bir tarayıcı sekmesinde açılır ve sonucu uygulamaya geri dönemez: doğrudan yönlendirme
    google: async () => {
      if (appMode()) { await U.signInWithRedirect(auth, gp()); return null; }
      try { return (await U.signInWithPopup(auth, gp())).user; } catch (e) {
        if (!['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) throw e;
        await U.signInWithRedirect(auth, gp());
        return null;
      }
    },
    linkPassword: async (email, pw) => (await U.linkWithCredential(auth.currentUser, U.EmailAuthProvider.credential(email, pw))).user,
    // şifresi varsa değiştirir, yoksa kullanıcı adının e-postasıyla bağlar; giriş eskiyse Google'la yeniden doğrulanır
    setPassword: async (email, pw) => {
      const u = auth.currentUser;
      const run = async () => {
        if (u.providerData.some((p) => p.providerId === 'password')) return U.updatePassword(u, pw);
        try { return await U.linkWithCredential(u, U.EmailAuthProvider.credential(email, pw)); } catch (e) {
          if (e.code === 'auth/provider-already-linked') return U.updatePassword(u, pw);
          throw e;
        }
      };
      try { await run(); } catch (e) {
        if (e.code !== 'auth/requires-recent-login' || !u.providerData.some((p) => p.providerId === 'google.com')) throw e;
        await U.reauthenticateWithPopup(u, gp());
        await run();
      }
    },
    logout: () => U.signOut(auth),
    deleteUser: () => U.deleteUser(auth.currentUser),
    get: async (col, id) => { const s = await F.getDoc(ref(col, id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
    set: (col, id, data) => F.setDoc(ref(col, id), data),
    update: (col, id, data) => F.updateDoc(ref(col, id), data),
    add: (col, data) => F.addDoc(F.collection(db, col), data),
    remove: (col, id) => F.deleteDoc(ref(col, id)),
    list: async (col) => (await F.getDocs(F.collection(db, col))).docs.map((d) => ({ id: d.id, ...d.data() })),
    top: async (col, field, n) => (await F.getDocs(F.query(F.collection(db, col), F.orderBy(field, 'desc'), F.limit(n)))).docs.map((d) => ({ id: d.id, ...d.data() })),
    // canlı ziyaret (canli.js): anlık veritabanı aynı uygulama ve oturumla; yalnız gerekince yüklenir
    live: async () => { const D = await import(`${SDK}firebase-database.js`); return { D, db: D.getDatabase(app, cfg.databaseURL) }; },
  };
}

// =====================================================================
// Deneme sunucusu: Firebase'siz yerel deneme. Bütün "sunucu" localStorage'da bir JSON; birden çok hesap açılıp
// birbirinin köyü ziyaret edilebilir. Şifreler düz tutulur: yalnızca deneme içindir
// =====================================================================
function mockBackend() {
  const KEY = 'koyBakkali.mockdb';
  const load = () => { try { return JSON.parse(ls(KEY) || '{}'); } catch (e) { return {}; } };
  const store = (db) => ls(KEY, JSON.stringify(db));
  const col = (db, c) => (db[c] || (db[c] = {}));
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const later = (v) => new Promise((r) => setTimeout(() => r(v), 60)); // ağ gecikmesi gibi
  const session = () => { const uid = ls('koyBakkali.mockuid'); return uid ? { uid } : null; };
  return {
    current: async () => later(session()),
    live: async () => ({ mock: true }), // canlı ziyaret yerelde tarayıcı kanalıyla (canli.js)
    create: async (email, pw) => {
      const db = load(), acc = col(db, '_auth');
      if (Object.values(acc).some((a) => a.email === email)) throw fail('auth/email-already-in-use');
      if (String(pw).length < 6) throw fail('auth/weak-password');
      const uid = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      acc[uid] = { email, pw }; store(db); ls('koyBakkali.mockuid', uid);
      return later({ uid });
    },
    login: async (email, pw) => {
      const acc = col(load(), '_auth'), e = Object.entries(acc).find(([, a]) => (a.email === email && a.pw === pw) || (a.alt === email && a.altPw === pw));
      if (!e) throw fail('auth/invalid-credential');
      ls('koyBakkali.mockuid', e[0]);
      return later({ uid: e[0] });
    },
    // Google taklidi: hep aynı deneme Google hesabı (şifresiz)
    google: async () => {
      const db = load(), acc = col(db, '_auth');
      let id = Object.keys(acc).find((k) => acc[k].google);
      if (!id) { id = `g${Date.now().toString(36)}`; acc[id] = { email: 'deneme.oyuncu@gmail.com', google: true }; store(db); }
      ls('koyBakkali.mockuid', id);
      return later({ uid: id, email: 'deneme.oyuncu@gmail.com', displayName: 'Deneme Oyuncu' });
    },
    setPassword: async (email, pw) => {
      const db = load(), acc = col(db, '_auth'), a = acc[ls('koyBakkali.mockuid')];
      if (a.google) { a.alt = email; a.altPw = pw; } else a.pw = pw;
      store(db); return later();
    },
    linkPassword: async (email, pw) => {
      const db = load(), acc = col(db, '_auth'), uid = ls('koyBakkali.mockuid');
      if (String(pw).length < 6) throw fail('auth/weak-password');
      if (acc[uid].alt) throw fail('auth/provider-already-linked');
      if (Object.values(acc).some((a) => a.email === email || a.alt === email)) throw fail('auth/email-already-in-use');
      acc[uid].alt = email; acc[uid].altPw = pw; store(db);
      return later({ uid });
    },
    logout: async () => { ls('koyBakkali.mockuid', null); },
    deleteUser: async () => { ls('koyBakkali.mockuid', null); },
    get: async (c, id) => { const d = col(load(), c)[id]; return later(d ? { id, ...JSON.parse(JSON.stringify(d)) } : null); },
    set: async (c, id, data) => { const db = load(); col(db, c)[id] = data; store(db); return later(); },
    update: async (c, id, data) => { const db = load(), d = col(db, c)[id]; if (!d) throw fail('not-found', 'Belge yok'); Object.assign(d, data); store(db); return later(); },
    add: async (c, data) => { const db = load(), id = Math.random().toString(36).slice(2, 10); col(db, c)[id] = data; store(db); return later({ id }); },
    remove: async (c, id) => { const db = load(); delete col(db, c)[id]; store(db); return later(); },
    list: async (c) => later(Object.entries(col(load(), c)).map(([id, d]) => ({ id, ...d }))),
    top: async (c, field, n) => later(Object.entries(col(load(), c)).map(([id, d]) => ({ id, ...d })).sort((a, b) => (get(b, field) || 0) - (get(a, field) || 0)).slice(0, n)),
  };
}
