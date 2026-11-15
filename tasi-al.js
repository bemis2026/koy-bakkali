/* Kayıt taşıma, alan taraf (2026-11-14, y60): eski adresteki "Kaydımla geç" kartı (src/tasi.js) bu adrese #tasi=<base64url JSON> ile gelir.
   index.html'de oyun modüllerinden ÖNCE çalışan düz betik: paketli sürümde ortak parça (audio.js ayarları vb.) main.js'ten önce
   değerlendirildiği için bu iş modülde olamaz; burada oyun kodunun hiçbir parçası ayarı, dili ya da kaydı okumadan yazılır.
   Parça sunucuya gitmez. Elle yazılmış bağlantıya karşı: eski adresten gelmiyorsa ya da burada oynanmış kayıt varsa sorar, daha ileri
   kaydın üstüne yazmaz, eskisini koyBakkali.v1.tasiOnce'ye yedekler. Anahtar listesi src/tasi.js ile aynı tutulmalı. */
(function () {
  var P = 'koyBakkali.', NOTE = 'koyBakkali.tasiNot';
  var KEYS = ['v1', 'settings', 'lang', 'guest', 'owner', 'remember', 'lastId', 'hints', 'sustur', 'hud', 'icons', 'mmMini', 'alertsOpen', 'kart', 'helpDay', 'giftDay', 'recv'];
  var OLD = ['bemis2026.github.io', 'koy-bakkali.web.app', 'koy-bakkali.firebaseapp.com'];
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
  function good(d) { return !!(d && Array.isArray(d.unlocked) && typeof d.money === 'number'); }
  function time(d) { return (d && d.stats && d.stats.time) || 0; }
  function note(s) { try { sessionStorage.setItem(NOTE, s); } catch (e) { /* gizli pencere */ } }
  function dec(s) {
    var x = atob(s.replace(/-/g, '+').replace(/_/g, '/')), b = new Uint8Array(x.length);
    for (var i = 0; i < x.length; i++) b[i] = x.charCodeAt(i);
    return new TextDecoder().decode(b);
  }
  try {
    var m = /(?:^#|&)tasi=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return;
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* yok */ }
    var pk = null;
    try { pk = JSON.parse(dec(m[1])); } catch (e) { pk = null; }
    var k = pk && pk.k && typeof pk.k === 'object' ? pk.k : null;
    var inc = k && parse(k[P + 'v1']);
    if (!good(inc)) { note('📦 Taşınan kayıt okunamadı: eski adreste Menü › Kaydı indir, burada Kayıt yükle'); return; }
    var cur = parse(get(P + 'v1'));
    if (good(cur) && time(cur) > time(inc)) { note('📦 Bu adreste daha ileri bir kaydın vardı: o açıldı'); return; }
    var ref = '';
    try { ref = new URL(document.referrer).hostname; } catch (e) { /* doğrudan açıldı */ }
    var fromOld = OLD.indexOf(ref) >= 0;
    if (!fromOld || (good(cur) && time(cur) > 120)) {
      var en = (k[P + 'lang'] || get(P + 'lang') || '') === 'en';
      var dur = function (d) { var mm = Math.floor(time(d) / 60); return en ? Math.floor(mm / 60) + ' h ' + (mm % 60) + ' min' : Math.floor(mm / 60) + ' sa ' + (mm % 60) + ' dk'; };
      var tl = function (d) { return Math.floor(d.money).toLocaleString('tr-TR') + ' ₺'; };
      var msg = en
        ? 'Load the save moved from the old address into this browser?\n\nIncoming: ' + tl(inc) + ' · ' + dur(inc) + ' played'
          + (good(cur) ? '\nHere now: ' + tl(cur) + ' · ' + dur(cur) + ' played (kept as a backup)' : '')
          + (fromOld ? '' : '\n\nIf you did not open this link yourself, press Cancel.')
        : 'Eski adresten gelen kayıt bu tarayıcıya yüklensin mi?\n\nGelen: ' + tl(inc) + ' · ' + dur(inc) + ' oynanmış'
          + (good(cur) ? '\nBuradaki: ' + tl(cur) + ' · ' + dur(cur) + ' oynanmış (yedeğe alınır)' : '')
          + (fromOld ? '' : '\n\nBu bağlantıyı kendin açmadıysan İptal\'e bas.');
      if (!confirm(msg)) { note('📦 Taşıma iptal edildi'); return; }
    }
    if (good(cur)) put(P + 'v1.tasiOnce', JSON.stringify(cur));
    for (var i = 0; i < KEYS.length; i++) { var v = k[P + KEYS[i]]; if (typeof v === 'string' && v.length < 500000) put(P + KEYS[i], v); }
    note('📦 Kaydın taşındı: kaldığın yerden devam!');
  } catch (e) { try { console.warn('kayıt taşıma', e); } catch (e2) { /* yok */ } }
})();
