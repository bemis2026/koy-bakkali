// Ana menü: oyun durur; genel bakış, yükseltmeler, dükkanım, ürünler, başarımlar, ayarlar, kayıt, nasıl oynanır
import { G, ITEMS, save, saveData, writeSave } from './game.js';
import { settings, saveSettings, setSfx, setMusic, setVoice, setAmb, setSfxVol, setMusicVol, setVoiceVol, setAmbVol, duckMusic, play, nextTrack, musicInfo } from './audio.js';
import { toggleSoundPanel, syncSoundBtn } from './soundpanel.js';
import { applyTheme, banner, PALETTES } from './ui.js';
import { mountUpgrades, unmountUpgrades, toggleMenu, UPG } from './upgrades.js';
import { unlockTotal, goToRegion, applyHints, resetHints, closedHintCount, areasAt } from './world.js';
import { titleOf, xpFor, levelProgress, levelReward } from './level.js';
import { confetti } from './fx.js';
import { needRows } from './sart.js';
import { CAN_VIBRATE, haptic } from './his.js';
import { KINDS, KIND_ORDER, kindKey, FROM, usedIn } from './catalog.js';
import { onlineSections, isOnlineSection, mountOnline } from './online-ui.js';
import { installed, canInstall, promptInstall, canFullscreen, toggleFullscreen } from './install.js';
import { BY, CC0, KENNEY } from './krediler.js';
import { initQuality, detectTier, TIERS, QNAME } from './kalite.js';
import { LANG } from './dil.js';
import { rowsHtml, openTasarim } from './tasarim.js';

const $ = (id) => document.getElementById(id);
const tl = (n) => Math.floor(n).toLocaleString('tr-TR');
const SECTIONS = [
  ['genel', '🏠', 'Genel bakış'], ['upg', '⬆️', 'Yükseltmeler'], ['dukkan', '🎨', 'Dükkanım'], ['urun', '🧺', 'Ürünler'],
  ['basari', '🏆', 'Başarımlar'], ['album', '📔', 'Albüm'], ['ayar', '⚙️', 'Ayarlar'], ['kayit', '💾', 'Kayıt'], ['yardim', '📖', 'Nasıl oynanır'],
];
const REGIONS = [['koy', '🏡'], ['pazar', '🍉'], ['ciftlik', '🐄'], ['sahil', '🏖️'], ['han', '🐫'], ['atlar', '🐎'], ['firin', '🥯'], ['tatil', '🐚'], ['kasaba', '⛲'], ['tarla', '🌽'], ['mera', '🐑'], ['atolye', '🧶'], ['sehir', '🏙️'], ['enerji', '🌬️'], ['tarlalar', '🚜'], ['iskele', '🎣'], ['lunapark', '🎡']];
const STAFF = [['cashier', 'Kasiyer', '🧾'], ['shelver', 'Rafçı', '🧺'], ['courier', 'Araba servisçisi', '🛵'], ['guard', 'Bekçi', '👮'], ['vendor', 'Tezgahçı', '🍉'], ['waiter', 'Garson', '🍦'], ['lifeguard', 'Cankurtaran', '🛟'], ['steward', 'Kâhya', '🐫'], ['groom', 'Seyis', '🐎'], ['maid', 'Kat görevlisi', '🧹'], ['recep', 'Resepsiyonist', '🛎️'], ['weaver', 'Dokumacı', '🧶'], ['milkman', 'Sütçü', '🥛'], ['carrier', 'Taşıyıcı', '🐴'], ['accountant', 'Muhasebeci', '💼'], ['server', 'Ayakçı', '🍽️'], ['fisher', 'Balıkçı', '🎣'], ['rwaiter', 'Restoran garsonu', '🍽️']];
const SRC = {
  elma: ['Şehir', 'Hal kamyoneti → meyve reyonu', () => G.unlocked.has('sc2')], portakal: ['Şehir', 'Hal kamyoneti → meyve reyonu', () => G.unlocked.has('sc2')],
  limon: ['Şehir', 'Hal kamyoneti → meyve reyonu', () => G.unlocked.has('sc2')], meyvesuyu: ['Şehir', 'Hal kamyoneti → meyve reyonu', () => G.unlocked.has('sc2')],
  yun: ['Mera', 'Kırkım barakası (yemliğe lahana, balkabağı, koçan ya da saman) → pazarda ya da köydeki kilim ve yün rafında sat; kilim doku', () => G.unlocked.has('gm')],
  kilim: ['Mera', 'Dokuma atölyesi, köy yolunda (yünden) → pazar tezgahında ya da köydeki kilim ve yün rafında sat; tatil evi', () => G.unlocked.has('m2')],
  ksut: ['Mera', 'Sağım yeri (yemliğe lahana, balkabağı, koçan ya da saman) → köy süt dolabı', () => G.unlocked.has('m1')],
  yogurt: ['Mera', 'Yoğurt küpü (koyun sütünden) → köy süt dolabı', () => G.unlocked.has('m3')],
  havlu: ['Tatil Köyü', 'Çamaşırhane (kirli çamaşırdan) → misafirin evine', () => G.unlocked.has('gk')],
  patlamis: ['Lunapark', 'Patlamış mısır tezgâhı (koçandan) → ziyaretçiler tezgâhtan alır', () => G.unlocked.has('xluna2')],
  pamuk: ['Lunapark', 'Pamuk şeker tezgâhı (kendi şekeriyle) → ziyaretçiler tezgâhtan alır', () => G.unlocked.has('xluna2')],
  kirli: ['Tatil Köyü', 'Misafiri çıkan evi topla → çamaşırhaneye', () => G.unlocked.has('gk')],
  un: ['Köy Fırını', 'Değirmen (köy tarlasının, han bahçesinin ya da büyük tarlanın buğdayından) → fırınlar', () => G.unlocked.has('gf')],
  simit: ['Köy Fırını', 'Simit fırını (undan) → vitrin ve köydeki fırın rafı; tatil evi', () => G.unlocked.has('gf')],
  pogaca: ['Köy Fırını', 'Poğaça fırını (undan) → vitrin ve köydeki fırın rafı; tatil evi', () => G.unlocked.has('gf')],
  saman: ['At Ahırı', 'Harman makinesi (ahırın buğday tarlasından) → bekleyen atların yemliği (atlı müşteri bakım parası öder)', () => G.unlocked.has('gt')],
  domates: ['Köy', 'Bostan', () => true], salatalik: ['Köy', 'Salatalık bostanı', () => G.unlocked.has('k1')],
  yumurta: ['Çiftlik', 'Kümes (yemliğe domates, salatalık ya da koçan)', () => G.unlocked.has('kk')], sut: ['Çiftlik', 'Ahır (yemliğe saman, buğday, koçan ya da karpuz)', () => G.unlocked.has('ka')],
  peynir: ['Çiftlik', 'Mandıra (sütten)', () => G.unlocked.has('km')], karpuz: ['Pazar, Büyük Tarlalar', 'Toptancı kamyonu ya da karpuz tarlası → pazar tezgahı, köydeki manav reyonu ve karpuz suyu tezgâhı', () => G.unlocked.has('gp') || G.unlocked.has('xtarlalar5')],
  biber: ['Pazar, Köy', 'Sebze kamyoneti ya da köy bahçesinin biber bostanı → pazar tezgahı ve köydeki manav reyonu', () => G.unlocked.has('pt3') || G.unlocked.has('xkoy1')], patlican: ['Pazar, Köy', 'Sebze kamyoneti ya da köy bahçesinin patlıcan bostanı → pazar tezgahı ve köydeki manav reyonu', () => G.unlocked.has('pt4') || G.unlocked.has('xkoy1')],
  kocan: ['Köy', 'Köy tarlası → sahildeki kazana', () => G.unlocked.has('gs')], misir: ['Sahil', 'Mısır kazanı (koçandan)', () => G.unlocked.has('gs')],
  dondurma: ['Sahil', 'Dondurma makinesi (sütten)', () => G.unlocked.has('s1')], bugday: ['Köy Tarlaları, Han, At Ahırı', 'Köy tarlaları ve han bahçesi → değirmene, han fırınına ve ambara; ahırda harmana', () => G.unlocked.has('gh') || G.unlocked.has('gt')],
  ekmek: ['Han, Köy Fırını', 'Han fırını (buğdaydan) ya da köy fırını (undan) → vitrin ve köydeki fırın rafı', () => G.unlocked.has('gh') || G.unlocked.has('gf')], corba: ['Han', 'Çorba kazanı (domatesten)', () => G.unlocked.has('h1')], yem: ['Han', 'Yem ambarı (buğdaydan)', () => G.unlocked.has('h2')],
  balik: ['Balıkçı İskelesi', 'Olta yeri ve balıkçı → balık tezgahı; buzlu kasadan ızgaraya', () => G.unlocked.has('gb')],
  izgara: ['Balıkçı İskelesi', 'Izgara (balıktan) → restoran masaları', () => G.unlocked.has('b2')],
  // bölge genişletmelerinin ürünleri (expand-east.js, expand-west.js)
  tursu: ['Pazar', 'Turşucu (salatalıktan) → pazar tezgahı ve köydeki manav reyonu', () => G.unlocked.has('xpazar2')],
  bal: ['Çiftlik', 'Arı kovanları (çiçek ya da ayçiçeği yetişince yemliğe) → köydeki manav reyonu, pazar ve şehir marketi', () => G.unlocked.has('xciftlik2')],
  aycicek: ['Büyük Tarlalar', 'Ayçiçeği tarlası → pazar tezgahı ve şehir marketi', () => G.unlocked.has('xtarlalar2')],
  guvec: ['Han', 'Güveç ocağı (domatesten) → kervan siparişleri', () => G.unlocked.has('xhan2')],
  pide: ['Köy Fırını', 'Pide fırını (undan) → fırının vitrini; şehirde pide rafı', () => G.unlocked.has('xfirin2')],
  cicek: ['Kasaba, Büyük Tarlalar', 'Çiçekçinin tarhları ya da lale tarlası → buket masasına; şehirde hediyelik rafı', () => G.unlocked.has('xkasaba2') || G.unlocked.has('xtarlalar6')],
  buket: ['Kasaba', 'Buket masası (çiçekten) → çiçekçinin vitrini', () => G.unlocked.has('xkasaba2')],
  tost: ['Şehir', 'Tost büfesi (ekmekten) → kahvaltılık reyonu', () => G.unlocked.has('xsehir2')],
  // sahil mutfağı (mutfak.js): her makinenin yanında kendi vitrini, kumsaldakiler alır
  pure: ['Sahil', 'Püre makinesi (iki domatesten) → yanındaki vitrin', () => G.unlocked.has('xmutfak1')],
  karpuzsuyu: ['Sahil', 'Karpuz sıkacağı (bir karpuzdan iki şişe) → yanındaki soğutucu', () => G.unlocked.has('xmutfak2')],
  menemen: ['Sahil', 'Menemen ocağı (yumurta, domates, biber) → yanındaki vitrin', () => G.unlocked.has('xmutfak3')],
  // süpermarket ve hipermarket (supermarket.js): toptancı kamyonu getirir, toptan paletinden alınır
  makarna: ['Şehir', 'Toptancı kamyonu → toptan paleti → paketli gıda reyonu', () => G.unlocked.has('xsehir4')], pirinc: ['Şehir', 'Toptancı kamyonu → toptan paleti → paketli gıda reyonu', () => G.unlocked.has('xsehir4')],
  su: ['Şehir', 'Toptancı kamyonu → toptan paleti → içecek reyonu', () => G.unlocked.has('xsehir4')], gazoz: ['Şehir', 'Toptancı kamyonu → toptan paleti → içecek reyonu', () => G.unlocked.has('xsehir4')],
  deterjan: ['Şehir', 'Toptancı kamyonu → toptan paleti → arka salonda temizlik reyonu', () => G.unlocked.has('xsehir5')], sabun: ['Şehir', 'Toptancı kamyonu → toptan paleti → arka salonda temizlik reyonu', () => G.unlocked.has('xsehir5')],
  kagit: ['Şehir', 'Toptancı kamyonu → toptan paleti → arka salonda temizlik reyonu', () => G.unlocked.has('xsehir5')],
  cips: ['Şehir', 'Toptancı kamyonu → toptan paleti → arka salonda atıştırmalık reyonu', () => G.unlocked.has('xsehir5')], cikolata: ['Şehir', 'Toptancı kamyonu → toptan paleti → arka salonda atıştırmalık reyonu', () => G.unlocked.has('xsehir5')],
  biskuvi: ['Şehir', 'Toptancı kamyonu → toptan paleti → arka salonda atıştırmalık reyonu', () => G.unlocked.has('xsehir5')],
  lahana: ['Köy Tarlaları', 'Lahana bostanı → köydeki manav reyonu, pazar ve şehir marketi', () => G.unlocked.has('xtarla2')],
  balkabagi: ['At Ahırı', 'Balkabağı bostanı → pazar tezgahı ve şehir marketi', () => G.unlocked.has('xatlar2')],
  hali: ['Dokuma Atölyesi', 'Halı tezgahı (kilimden) → pazar tezgahı; şehirde hediyelik rafı', () => G.unlocked.has('xatolye2')],
  balikcorba: ['Balıkçı İskelesi', 'İskele mutfağı (balıktan) → restoran masaları', () => G.unlocked.has('xiskele2')],
};

// ---------- başarımlar ----------
// odul: [₺, kadro]. Para başarım açıldığı an ödenir (eski kayıtta sessizce açılanlara ödenmez); kadro ödülü kalıcıdır,
// açık başarımlardan hesaplanır (G.kadroBonus → upgrades.js staffCap). Ayrıca her başarım 25 XP (level.js).
const regionsOpen = () => REGIONS.filter(([id]) => G.regions[id].unlocked).length;
const staffCount = () => STAFF.filter(([id]) => G.upg[id]).length;
// para ödülleri kilit fiyatlarıyla birlikte 2,5 kat (×2 PRICE_K ×1,25 zorluk); uzun oyuna yeni kademeler (2026-11-01, kullanıcı:
// "başarımlar görevler de fiyatlara paralel revize olmalı, ilerlemeli"). Eski kayıtta hak edilmiş yeni kademe sessizce açılır, ödenmez
const has = (id) => G.unlocked.has(id);
const ACH = [
  { id: 'first', odul: [125, 0], icon: '🛒', name: 'Siftah!', desc: 'İlk müşteriye satış yap', goal: 1, val: () => G.stats.customers },
  { id: 'c50', odul: [400, 0], icon: '👥', name: 'Mahallenin bakkalı', desc: '50 müşteriye hizmet et', goal: 50, val: () => G.stats.customers },
  { id: 'c300', odul: [1250, 1], icon: '🏘️', name: 'Herkes seni tanıyor', desc: '300 müşteriye hizmet et', goal: 300, val: () => G.stats.customers },
  { id: 'c2000', odul: [7500, 1], icon: '🎖️', name: 'Kasaba efsanesi', desc: '2.000 müşteriye hizmet et', goal: 2000, val: () => G.stats.customers },
  { id: 'c5000', odul: [15000, 0], icon: '🎗️', name: 'Bölgenin bakkalı', desc: '5.000 müşteriye hizmet et', goal: 5000, val: () => G.stats.customers },
  { id: 'c20000', odul: [45000, 0], icon: '👑', name: 'Halkın sevgilisi', desc: '20.000 müşteriye hizmet et', goal: 20000, val: () => G.stats.customers },
  { id: 'c50000', odul: [110000, 1], icon: '🌟', name: 'Efsane bakkal', desc: '50.000 müşteriye hizmet et', goal: 50000, val: () => G.stats.customers },
  { id: 'e1k', odul: [250, 0], icon: '💰', name: 'İlk bin', desc: 'Toplam 1.000 ₺ kazan', goal: 1000, val: () => G.stats.earned },
  { id: 'e10k', odul: [2500, 0], icon: '💎', name: 'Köyün zengini', desc: 'Toplam 10.000 ₺ kazan', goal: 10000, val: () => G.stats.earned },
  { id: 'e100k', odul: [12500, 0], icon: '🏦', name: 'Sermayedar', desc: 'Toplam 100.000 ₺ kazan', goal: 100000, val: () => G.stats.earned },
  { id: 'e500k', odul: [30000, 0], icon: '💼', name: 'Yarım milyon', desc: 'Toplam 500.000 ₺ kazan', goal: 500000, val: () => G.stats.earned },
  { id: 'e2m', odul: [75000, 0], icon: '🏛️', name: 'Milyoner', desc: 'Toplam 2.000.000 ₺ kazan', goal: 2000000, val: () => G.stats.earned },
  { id: 'e5m', odul: [160000, 1], icon: '💠', name: 'Holding', desc: 'Toplam 5.000.000 ₺ kazan', goal: 5000000, val: () => G.stats.earned },
  { id: 's500', odul: [1000, 0], icon: '📦', name: 'Tezgah taşıyor', desc: '500 ürün sat', goal: 500, val: () => G.stats.sold },
  { id: 's5000', odul: [10000, 0], icon: '🚚', name: 'Toptancı', desc: '5.000 ürün sat', goal: 5000, val: () => G.stats.sold },
  { id: 's50000', odul: [60000, 0], icon: '🏭', name: 'Ürün imparatoru', desc: '50.000 ürün sat', goal: 50000, val: () => G.stats.sold },
  { id: 'reg', odul: [5000, 2], icon: '🗺️', name: 'Kaşif', desc: `${REGIONS.length} bölgenin hepsini aç`, goal: REGIONS.length, val: regionsOpen },
  { id: 'staff', odul: [750, 0], icon: '🤝', name: 'Patron', desc: 'Altı farklı işe eleman al', goal: 6, val: staffCount },
  { id: 'car', odul: [750, 0], icon: '🚗', name: 'Paket ustası', desc: '10 paket siparişi teslim et', goal: 10, val: () => G.stats.cars },
  { id: 'car100', odul: [12000, 0], icon: '🚙', name: 'Kargo ustası', desc: '100 paket siparişi teslim et', goal: 100, val: () => G.stats.cars },
  { id: 'car500', odul: [45000, 0], icon: '🚛', name: 'Lojistik devi', desc: '500 paket siparişi teslim et', goal: 500, val: () => G.stats.cars },
  { id: 'kervan', odul: [1250, 0], icon: '🐫', name: 'İpek Yolu dostu', desc: '5 kervanı memnun et', goal: 5, val: () => G.stats.caravans },
  { id: 'kervan100', odul: [18000, 0], icon: '🐪', name: 'Kervanbaşı', desc: '100 kervanı memnun et', goal: 100, val: () => G.stats.caravans },
  { id: 'kervan300', odul: [50000, 0], icon: '🏜️', name: 'İpek Yolu efsanesi', desc: '300 kervanı memnun et', goal: 300, val: () => G.stats.caravans },
  { id: 'shelf', odul: [500, 0], icon: '🧺', name: 'Dolu dolu', desc: 'Bir rafı 3 kata çıkar', goal: 3, val: () => Math.max(0, ...['domates', 'salatalik', 'yumurta', 'sut'].map((k) => { const u = UPG[`rf_${k}`]; return u ? u.values[G.upg[`rf_${k}`] || 0] : 0; })) }, // rafın kat sayısı (upgrades.js rf_ values)
  { id: 'boost', odul: [250, 0], icon: '✨', name: 'Şanslı gün', desc: 'Bir bereket sandığı kap', goal: 1, val: () => G.stats.boosts },
  { id: 'city', odul: [5000, 0], icon: '🏙️', name: 'Şehirli', desc: "Şehir Marketi'ni aç", goal: 1, val: () => (G.unlocked.has('gc') ? 1 : 0) },
  { id: 'shade', odul: [2000, 0], icon: '☂️', name: 'Gölge ustası', desc: 'Öğlen 25 müşteriye şemsiye gölgesinde servis yap', goal: 25, val: () => G.stats.shade || 0 },
  { id: 'daily10', odul: [3750, 1], icon: '📋', name: 'Görev adamı', desc: '10 günlük görev tamamla', goal: 10, val: () => G.stats.dailyDone || 0 },
  { id: 'daily50', odul: [20000, 0], icon: '🗓️', name: 'Disiplinli esnaf', desc: '50 günlük görev tamamla', goal: 50, val: () => G.stats.dailyDone || 0 },
  { id: 'luna', odul: [25000, 0], icon: '🎡', name: 'Lunaparkçı', desc: 'Lunaparkı aç', goal: 1, val: () => (has('gl') ? 1 : 0) },
  { id: 'lunaAll', odul: [90000, 1], icon: '🎢', name: 'Eğlence kralı', desc: 'Lunaparkın altı eğlencesinin hepsini aç', goal: 6, val: () => [1, 2, 3, 4, 5, 6].filter((k) => has(`xluna${k}`)).length },
  { id: 'all', odul: [100000, 2], icon: '🏆', name: 'Köy Efsanesi', desc: 'Bütün kilitleri aç, köyün efsanesi ol', goal: 0, val: () => G.unlocked.size },
];

function kadroBonus() { G.kadroBonus = ACH.reduce((n, a) => n + (G.ach.has(a.id) && a.odul ? a.odul[1] : 0), 0); }

let open = false, section = 'genel', onReset = () => {}, hooks = {}, achT = 0, liveT = 0, qBusy = false, gfxTimer = 0;

export function initMenu(o) {
  onReset = o.onReset; hooks = o;
  ACH.find((a) => a.id === 'all').goal = unlockTotal();
  SECTIONS.splice(SECTIONS.length - 2, 0, ...onlineSections()); // çevrimiçiyse Köyler, Profil, Öneri kutusu (online-ui.js)
  const nav = $('mmNav');
  nav.innerHTML = SECTIONS.map(([id, ic, name]) => `<button type="button" data-s="${id}"><span class="ic">${ic}</span><span class="t">${name}</span><i class="nb"></i></button>`).join('') +
    '<button type="button" class="sifirla" data-s="reset"><span class="ic">🔄</span><span class="t">Oyunu sıfırla</span></button>' +
    '<button type="button" class="resume" data-s="close"><span class="ic">▶️</span><span class="t">Oyuna dön</span></button>';
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-s]');
    if (!b) return;
    if (b.dataset.s === 'close') closeMenu(); else if (b.dataset.s === 'reset') askReset(); else show(b.dataset.s);
  });
  $('menuBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); open ? closeMenu() : openMenu(); });
  // ekranın kenarındaki bilgi rozetleri de tuş: bölge adı ve para genel bakışı (Oraya git), mertebe başarımları açar
  for (const [id, sec] of [['region', 'genel'], ['lvl', 'basari'], ['money', 'genel']]) {
    const el = $(id); if (!el) continue;
    el.style.pointerEvents = 'auto'; el.style.cursor = 'pointer';
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); open ? closeMenu() : openMenu(sec); });
  }
  $('musicBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleSoundPanel(); });
  syncMusic();
  $('mainMenu').addEventListener('pointerdown', (e) => { if (e.target.id === 'mainMenu') closeMenu(); e.stopPropagation(); });
  // telefonda ☰ ile × üst üste: menüyü açan dokunuşun parmak kalkınca gelen tıklaması ×'e düşüp menüyü hemen kapatmasın
  $('mainMenu').querySelector('.mclose').addEventListener('click', () => { if (performance.now() - openedAt > 350) closeMenu(); });
  $('mmBody').addEventListener('click', onBodyClick);
  $('mmBody').addEventListener('input', onBodyInput);
  $('mmBody').addEventListener('change', onBodyChange);
  for (const a of ACH) if (a.val() >= a.goal) G.ach.add(a.id); // eski kayıtlarda hak edilenler sessizce açılır
  kadroBonus();
  G.seenAch = new Set(G.ach);
}

export const isMenuOpen = () => open;

// oyunu sıfırla: menünün kenarındaki düğmeden ve Kayıt bölümünden (2026-11-08 kullanıcı: "üst menüden de oyunu sıfırlama olsun bir
// yerde. istersek baştan köyü resetleyebilelim"). Tarayıcının kaba onay kutusu yerine oyunun kendi penceresi; ayarlar silinmez (main.js doReset)
function askReset() {
  if ($('resetAsk')) return;
  const el = document.createElement('div');
  el.id = 'resetAsk'; el.setAttribute('role', 'alertdialog');
  el.innerHTML = `<div class="ra-card"><div class="ra-ic">🔄</div><b class="ra-t">Köyü baştan başlat?</b>
    <p>Paran, açtığın bölgeler, yükseltmeler ve elemanların silinir; köyün ilk günkü gibi baştan başlar. Bu geri alınamaz.</p>
    <p class="ra-keep">Ses ve grafik ayarların kalır.</p>
    <div class="ra-btns"><button type="button" class="ra-no">Vazgeç</button><button type="button" class="ra-yes">Evet, sıfırla</button></div></div>`;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('.ra-no')) el.remove();
    else if (e.target.closest('.ra-yes')) { el.remove(); onReset(); }
  });
  $('mainMenu').appendChild(el);
}

let openedAt = 0;
// Telefonun Geri tuşu (ve tarayıcının geri hareketi) açık menüyü kapatır: menü açılırken geçmişe bir adım eklenir, Geri o adımı
// geri alır. Eskiden Geri oyundan çıkıyor, kurulu uygulamayı kapatıyordu (2026-11-10 denetimi). Menü düğmeyle kapanınca adım geri alınır
let histOn = false;
addEventListener('popstate', () => { if (!histOn) return; histOn = false; closeMenu(); });
export function openMenu(sec) {
  if (G.visit) return; // komşunun köyünde menü yok (online-ui.js yardım vardiyası)
  if (open) { show(sec || section); return; }
  if ($('upg').classList.contains('open')) toggleMenu(false);
  if (G.menuOpen) return; // dükkan kurulum penceresi açık
  if (G.custom.name && G.custom.name !== 'Köy Bakkalı') $('mmShop').setAttribute('translate', 'no'); else $('mmShop').removeAttribute('translate');
  $('mmShop').textContent = G.custom.name;
  open = true; G.menuOpen = true; G.paused = true; openedAt = performance.now();
  if (!histOn) try { history.pushState({ kbMenu: 1 }, ''); histOn = true; } catch (e) { /* geçmişe yazılamadı: Geri eskisi gibi */ }
  $('mainMenu').classList.add('open');
  duckMusic(true);
  play('open');
  show(sec || section);
}

export function closeMenu() {
  if (!open) return;
  if (section === 'upg') unmountUpgrades();
  open = false; G.menuOpen = false; G.paused = false;
  if (histOn) { histOn = false; try { history.back(); } catch (e) { /* yok */ } } // menü için eklenen geçmiş adımı geri alınır
  $('mainMenu').classList.remove('open');
  $('resetAsk')?.remove();
  duckMusic(false);
  play('close');
}

// keep: aynı bölümü yeniden çiz (tema, renk, albüm sekmesi); kaydırma yerinde kalır, giriş animasyonu oynamaz.
// 2026-11-02 kullanıcı: "sayfanın başına atıyor": her seçimde sayfa en üste dönüp yeniden beliriyordu
function show(sec, keep = false) {
  if (section === 'upg' && sec !== 'upg') unmountUpgrades();
  const top = keep && sec === section ? $('mmBody').scrollTop : 0;
  section = sec;
  for (const b of $('mmNav').querySelectorAll('button[data-s]')) {
    b.classList.toggle('on', b.dataset.s === sec);
    if (b.dataset.s === sec) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); // telefonda yatay şeritte seçili bölüm görünsün
  }
  const body = $('mmBody');
  body.innerHTML = '';
  body.scrollTop = 0;
  const title = SECTIONS.find((s) => s[0] === sec);
  $('mmTitle').textContent = title ? `${title[1]} ${title[2]}` : '';
  if (sec === 'upg') { body.innerHTML = '<p class="mm-lead">Paranı hız, taşıma kapasitesi, eleman, raf ve makinelere yatır. Kırmızı nokta alınabilecek bir şey var demek.</p>'; mountUpgrades(body); }
  else if (isOnlineSection(sec)) mountOnline(sec, body);
  else body.innerHTML = RENDER[sec]();
  if (top) body.scrollTop = top;
  else { body.style.animation = 'none'; void body.offsetWidth; body.style.animation = ''; }
  refreshBadges();
  clearInterval(gfxTimer);
  if (sec === 'ayar') { markQuality(); gfxTimer = setInterval(() => (open && section === 'ayar' ? gfxLive() : clearInterval(gfxTimer)), 500); }
}

// ---------- grafik kalitesi kartları ----------
// [simge, açıklama, görüntü 1-4, hafiflik 1-4]; seçimde sayfa yeniden çizilmez, yalnız kartların durumu değişir
const QINFO = {
  yuksek: ['💎', 'Tam gölge, bulanık arka plan, en keskin görüntü', 4, 1],
  orta: ['⚖️', 'Hafif gölge, keskin görüntü; çoğu cihaza uygun', 3, 2],
  dusuk: ['⚡', 'Gölgesiz, sade şekiller, uzak yerler sisli', 2, 3],
  pil: ['🔋', 'Saniyede 30 kare, düşük çözünürlük; telefon ısınmaz', 1, 4],
};
const dots = (n) => `<span class="q-d">${[1, 2, 3, 4].map((i) => `<u${i <= n ? ' class="f"' : ''}></u>`).join('')}</span>`;
function qualityHTML() {
  const rec = detectTier();
  const cards = TIERS.map((k) => {
    const [ic, desc, look, light] = QINFO[k];
    return `<button type="button" class="q-card" data-q="${k}"><span class="q-top"><span class="ic">${ic}</span><b>${QNAME[k]}</b>${k === rec ? '<em>Önerilen</em>' : ''}</span>
      <small>${desc}</small><span class="q-m"><i>Görüntü</i>${dots(look)}</span><span class="q-m"><i>Hafiflik</i>${dots(light)}</span><span class="q-ck">✓</span></button>`;
  }).join('');
  return `<div class="q-box">
      <div class="q-now"><span>🖼️ Görüntü kalitesi</span><small id="mmQNow"></small></div>
      <button type="button" class="q-card q-auto" data-q="auto"><span class="q-top"><span class="ic">✨</span><b>Otomatik</b></span><small>Cihazına göre seçer; oyun takılırsa kendiliğinden bir kademe hafifletir</small><span class="q-ck">✓</span></button>
      <div class="q-grid">${cards}</div>
      <p class="q-note" id="mmQNote" hidden><span>Şekil ayrıntısı ve kenar yumuşatma oyunu yeniden açınca bu kademeye geçer.</span><button type="button" class="mini" data-act="reopen">Yeniden aç</button></p>
    </div>`;
}
// seçili kart, otomatiğin o an seçtiği kademe (cur), uygulanırken dönen kart (busy)
function markQuality(busy) {
  const body = $('mmBody');
  if (!body) return;
  const auto = !settings.autoQ;
  for (const el of body.querySelectorAll('[data-q]')) {
    const k = el.dataset.q;
    el.classList.toggle('on', k === 'auto' ? auto : !auto && settings.quality === k);
    el.classList.toggle('cur', auto && k === settings.quality);
    el.classList.toggle('busy', el === busy);
  }
  const n = $('mmQNote');
  if (n) n.hidden = !hooks.bootQuality || settings.quality === hooks.bootQuality;
  gfxLive();
}
// canlı satır: kademe, saniyedeki kare, çözünürlük, gölge
function gfxLive() {
  const el = $('mmQNow');
  if (!el || !hooks.gfx) return;
  const g = hooks.gfx();
  el.textContent = `${QNAME[settings.quality] || 'Orta'} · ${g.fps} kare/sn · ${g.pr.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}× çözünürlük · ${g.shadow ? 'gölgeli' : 'gölgesiz'}`;
}

// ---------- bölümler ----------
// mertebe kartı ve yolu: geçilen seviyelerin açtıkları, sıradakinin ödülü; daha ilerisi gizli bölüm olarak görünür
function mertebe() {
  const lv = G.level || 1, road = [];
  // geçilen seviyeler tek satırda özetlenir; son ikisi, sıradaki ve sonraki iki gizli seviye açık durur (40 satırlık liste kısaldı)
  const from = lv >= 6 ? lv - 1 : 2;
  if (from > 2) road.push(`<div class="mm-lv got"><span class="n">✓</span><span><b>Seviye 2–${from - 1} geçildi</b><small>Bu seviyelerin bölümleri açıldı, ödülleri alındı</small></span><span class="st">✓</span></div>`);
  for (let n = from; n <= Math.max(6, lv + 3); n++) {
    const areas = areasAt(n), got = n <= lv, next = n === lv + 1;
    const what = (areas.length ? (got || next ? areas.map((u) => `${u.icon} ${u.title}`) : areas.map(() => '❓ Gizli bölüm')) : []).concat(`💰 ${tl(levelReward(n))} ₺ ödül`).join(' · ');
    road.push(`<div class="mm-lv${got ? ' got' : next ? ' next' : ''}"><span class="n">${n}</span><span><b>${titleOf(n)}</b><small>${what}</small></span><span class="st">${got ? '✓' : next ? '⭐' : '🔒'}</span></div>`);
  }
  return `<div class="mm-next"><span class="ic">⭐</span><span><small>Seviye ${lv}</small><b>${titleOf(lv)}</b></span><b class="pr">${tl(Math.floor(G.xp || 0))} / ${tl(xpFor(lv + 1))} XP</b></div>
    <div class="mm-prog"><span class="bar"><i style="width:${levelProgress() * 100}%"></i></span><b>Sonraki: ${titleOf(lv + 1)}</b></div>
    <p class="muted">Satış, müşteri, açtığın her kilit ve başarımlar XP kazandırır. Yeni bölümler belli seviyelerde ortaya çıkar; açmak için önce bulunduğun yeri büyütmen gerekir.</p>
    <div class="mm-road">${road.join('')}</div>`;
}
const fmtTime = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} sa ${m} dk` : `${m} dk`; };
function tile(icon, label, value, id) { return `<div class="mm-tile"><span class="ic">${icon}</span><span><small>${label}</small><b ${id ? `id="${id}"` : ''}>${value}</b></span></div>`; }

const RENDER = {
  album: () => (G.hooks.albumHTML ? G.hooks.albumHTML() : ''), // koleksiyon albümü (album.js)
  genel() {
    const total = unlockTotal(), done = G.unlocked.size, pad = G.nextPad;
    const regions = REGIONS.filter(([id]) => !G.regions[id].hidden).map(([id, ic]) => { // seviyesi gelmeyen bölüm listede yok
      const R = G.regions[id];
      return `<div class="mm-reg${R.unlocked ? '' : ' locked'}"><span class="ic">${ic}</span><b>${R.name}</b>${R.unlocked ? `<button type="button" class="mini" data-go="${id}">Oraya git</button>` : '<span class="lk">🔒 Kilitli</span>'}</div>`;
    }).join('');
    const staff = STAFF.filter(([id]) => G.upg[id]).map(([id, n, ic]) => `<span class="chip">${ic} ${n}${G.upg[id] > 1 ? ` ×${G.upg[id]}` : ''}</span>`).join('') || '<span class="muted">Henüz eleman yok. Yükseltmeler → Elemanlar.</span>';
    return `
      <div class="mm-hero"><div><small>Dükkanın</small><b class="mm-name">${escapeHtml(G.custom.name)}</b></div><div class="mm-money"><i class="coin">₺</i><b id="mmMoney">${tl(G.money)}</b></div></div>
      <div class="mm-tiles">
        ${tile('💰', 'Toplam kazanç', `${tl(G.stats.earned)} ₺`, 'mmEarned')}
        ${tile('👥', 'Müşteri', tl(G.stats.customers), 'mmCust')}
        ${tile('📦', 'Satılan ürün', tl(G.stats.sold), 'mmSold')}
        ${tile('⏱️', 'Oynama süresi', fmtTime(G.stats.time), 'mmTime')}
        ${tile('🚗', 'Paket sipariş', tl(G.stats.cars))}
        ${tile('🐫', 'Memnun kervan', tl(G.stats.caravans))}
      </div>
      <h3>Mertebe</h3>${mertebe()}
      <h3>İlerleme</h3>
      <div class="mm-prog"><span class="bar"><i style="width:${(done / total) * 100}%"></i></span><b>${done} / ${total} kilit</b></div>
      ${pad ? `<div class="mm-next"><span class="ic">${pad.def.icon || '🎯'}</span><span><small>Sıradaki hedef</small><b>${pad.def.title}</b></span><b class="pr">${tl(pad.def.price - pad.paid)} ₺</b></div>` : G.nextWait && G.needGoal ? needRows(G.nextWait).map((r) => `<div class="mm-next"><span class="ic">${r.done ? '✅' : r.icon}</span><span><small>${r.small}</small><b>${r.text}</b></span><b class="pr">${r.done ? '✓' : r.sub.includes('/') ? r.sub : r.right}</b></div>`).join('') : G.nextWait ? `<div class="mm-next"><span class="ic">❓</span><span><small>Sıradaki hedef</small><b>Yeni bölüm</b></span><b class="pr">⭐ Seviye ${G.nextWait.lvl}</b></div>` : '<div class="mm-next"><span class="ic">🏆</span><b>Bütün kilitler açık. Tebrikler!</b></div>'}
      ${G.boost > 0 ? `<div class="mm-next boost"><span class="ic">✨</span><b>2× Bereket aktif: ${Math.ceil(G.boost)} sn</b></div>` : ''}
      <h3>Bölgeler</h3><div class="mm-regs">${regions}</div>
      <h3>Ekibin</h3><div class="chips">${staff}</div>`;
  },
  dukkan() {
    const sw = (k) => PALETTES[k].map((c) => `<button type="button" data-sw="${k}" data-c="${c}" class="${G.custom[k] === c ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('');
    return `<p class="mm-lead">Bakkalına kendi adını ve renklerini ver. Değişiklikler hemen dükkana uygulanır.</p>
      <label class="fld"><span>Bakkalının adı</span><input id="mmName" maxlength="18" value="${escapeHtml(LANG === 'en' && G.custom.name === 'Köy Bakkalı' ? 'Village Grocer' : G.custom.name)}" autocomplete="off"></label>
      <div class="fld"><span>Tente ve tabela</span><div class="sw">${sw('awning')}</div></div>
      <div class="fld"><span>Duvar bandı</span><div class="sw">${sw('wall')}</div></div>
      <div class="fld"><span>Kıyafetin</span><div class="sw">${sw('shirt')}</div></div>
      <h3>Dükkânın tasarımı</h3>
      <p class="mm-lead">Zemin, duvar, tente ve tabela biçimi. Ücretsiz, istediğin zaman değişir. <button type="button" class="go sm" data-act="tasarim">🎨 Dükkânın önünde seç</button></p>
      <div class="tz-menu">${rowsHtml()}</div>
      <div class="mm-note">💡 İpucu: Tabeladaki ad, sol üstteki bölge çipinde de görünür.</div>`;
  },
  urun() {
    // ürünler sınıflarına göre gruplanır (catalog.js): ham madde → işlenmiş ürün zinciri "neyden / nereye" sütununda
    const ic = (k) => `<span class="ri"><img class="ic-s" src="${G.icons[k]}" alt="">${ITEMS[k].name}</span>`;
    const groups = KIND_ORDER.map((id) => {
      const K = KINDS[id], keys = Object.keys(ITEMS).filter((k) => kindKey(k) === id);
      if (!keys.length) return '';
      const rows = keys.map((k) => {
        const d = ITEMS[k], s = SRC[k] || ['—', '', () => true], ok = s[2](), f = FROM[k], u = usedIn(k);
        const rec = f ? `<span class="rec"><i>←</i>${f[0].filter((x) => ITEMS[x]).map(ic).join('<i>ya da</i>')}<small>${f[1]}</small></span>`
          : u.length ? `<span class="rec"><i>→</i>${u.map(ic).join(' ')}</span>` : '<small>—</small>';
        return `<tr class="k-${id}${ok ? '' : ' locked'}"><td><img src="${G.icons[k]}" alt=""></td><td><b>${d.name}</b><small>${s[1]}</small></td><td>${rec}</td><td><span class="chip sm">${s[0]}</span></td><td class="num">${d.raw ? '<small>satılmaz</small>' : `${d.price} ₺${d.cost ? `<small>alış ${d.cost} ₺</small>` : ''}`}</td><td>${ok ? '<span class="ok">✓ Açık</span>' : '<span class="lk">🔒</span>'}</td></tr>`;
      }).join('');
      return `<tr class="grp k-${id}"><td colspan="6"><b>${K.icon} ${K.name}</b><small>${K.desc}</small></td></tr>${rows}`;
    }).join('');
    const legend = KIND_ORDER.map((id) => `<span class="kind k-${id}">${KINDS[id].icon} ${KINDS[id].name}</span>`).join('');
    return `<p class="mm-lead">Ürünler sınıflarına göre: domates gibi ham maddeler doğrudan toplanır, peynir gibi işlenmiş ürünler ham maddeden yapılır ve daha pahalı satılır. "←" neyden yapıldığını, "→" hangi ürüne girdi olduğunu gösterir. Tezgahta ve rafta parlayan her ürün toplanabilir.</p>
      <div class="kinds">${legend}</div>
      <table class="mm-table urun"><thead><tr><th></th><th>Ürün</th><th>Neyden / Nereye</th><th>Bölge</th><th class="num">Fiyat</th><th>Durum</th></tr></thead><tbody>${groups}</tbody></table>`;
  },
  basari() {
    const got = ACH.filter((a) => G.ach.has(a.id)).length;
    const cards = ACH.map((a) => {
      const v = Math.min(a.goal, a.val()), done = G.ach.has(a.id);
      return `<div class="mm-ach${done ? ' done' : ''}"><span class="ic">${done ? a.icon : '🔒'}</span><span class="tx"><b>${a.name}</b><small>${a.desc}</small><span class="bar"><i style="width:${(v / a.goal) * 100}%"></i></span></span><span class="cnt">${done ? '✓' : `${tl(v)}/${tl(a.goal)}`}${a.odul ? `<small class="odl">🎁 ${tl(a.odul[0])} ₺${a.odul[1] ? ` · 👥+${a.odul[1]}` : ''}</small>` : ''}</span></div>`;
    }).join('');
    return `<div class="mm-prog"><span class="bar"><i style="width:${(got / ACH.length) * 100}%"></i></span><b>${got} / ${ACH.length} başarım</b></div><div class="mm-achs">${cards}</div>`;
  },
  ayar() {
    const th = [['bahar', 'Bahar'], ['seker', 'Şeker'], ['cini', 'Çini'], ['ahsap', 'Ahşap']].map(([t, n]) => `<button type="button" class="th${settings.theme === t ? ' on' : ''}" data-t="${t}"><span class="pv"><i></i><u>Al</u></span>${n}</button>`).join('');
    return `<h3 translate="no">🌐 Dil · Language</h3>
      <div class="segs" translate="no" style="margin:2px 0 10px">${[['tr', 'Türkçe'], ['en', 'English']].map(([k, n]) => `<button type="button" class="seg${LANG === k ? ' on' : ''}" data-lang="${k}">${n}</button>`).join('')}</div>
      <h3>Ses</h3>
      <div class="srow"><span>🔊 Ses efektleri</span><input type="range" min="0" max="100" value="${Math.round((settings.sfxVol ?? 1) * 100)}" data-vol="sfx"><button class="tog${settings.sfx ? ' on' : ''}" type="button" data-tog="sfx" aria-label="Ses efektleri"></button></div>
      <div class="srow"><span>🎵 Müzik</span><input type="range" min="0" max="100" value="${Math.round((settings.musicVol ?? 1) * 100)}" data-vol="music"><button class="tog${settings.music ? ' on' : ''}" type="button" data-tog="music" aria-label="Müzik"></button></div>
      <div class="srow"><span>🗣️ Özel sesler</span><input type="range" min="0" max="100" value="${Math.round((settings.voiceVol ?? 1) * 100)}" data-vol="voice"><button class="tog${settings.voice ? ' on' : ''}" type="button" data-tog="voice" aria-label="Özel sesler"></button></div>
      <div class="srow"><span>🌿 Ortam sesleri</span><input type="range" min="0" max="100" value="${Math.round((settings.ambVol ?? 1) * 100)}" data-vol="amb"><button class="tog${settings.amb !== false ? ' on' : ''}" type="button" data-tog="amb" aria-label="Ortam sesleri"></button></div>
      ${musicInfo().files ? `<div class="srow mm-now"><span>💿</span><b id="mmTrack">${escapeHtml(musicInfo().name || 'Başlıyor…')}</b><small>Bölüm ${musicInfo().stage || 1}</small><button type="button" class="mini" data-act="next">⏭ Sonraki</button></div>` : ''}
      <h3>Uygulama</h3>
      ${installed() ? '<p class="mm-note">📲 Köy Bakkalı uygulama olarak açık.</p>' : ''}
      ${canInstall() ? '<div class="srow"><span>📲 Uygulama olarak kur</span><button type="button" class="mini" data-act="install">Kur</button></div>' : ''}
      ${canFullscreen() ? `<div class="srow"><span>⛶ Tam ekran</span><button type="button" class="mini" data-act="full">${document.fullscreenElement ? 'Çık' : 'Aç'}</button></div>` : ''}
      ${!installed() && !canInstall() ? '<p class="mm-note">Telefonda bu sayfayı açıp ana ekrana eklersen oyun uygulama gibi tam ekran açılır.</p>' : ''}
      <h3>Kontroller</h3>
      ${matchMedia('(pointer: coarse)').matches ? '<p class="mm-note">📱 Ekrana basılı tutup parmağını sürükle, karakter o yöne koşar. İki parmakla yakınlaştır / uzaklaştır.</p>' : ''}
      ${matchMedia('(pointer: coarse)').matches ? '' : `<p class="mm-note">🖱️ Fareye basılı tutup sürükle: bastığın yerde joystick çıkar, karakter sürüklediğin yöne koşar; kısa tıklamak yürütmez. Menüde "Oraya git", büyük mini harita ya da bir bildirim seçince karakter oraya engellerin etrafından kendi koşar.</p>`}
      ${[['mouseMark', '📍 Gideceğin yeri işaretle'], ...(CAN_VIBRATE ? [['haptic', '📳 Titreşim']] : [])].map(([k, l]) => `<div class="srow"><span>${l}</span><button class="tog${settings[k] !== false ? ' on' : ''}" type="button" data-tog="${k}" aria-label="${l}"></button></div>`).join('')}
      <h3>Ekran</h3>
      <div class="srow"><span>💬 Bilgi kutuları</span><button class="tog${settings.hints !== false ? ' on' : ''}" type="button" data-tog="hints" aria-label="Bilgi kutuları"></button></div>
      <div class="srow"><span>↩️ Kapattığın kutular <small id="mmHintN">${closedHintCount()}</small></span><button type="button" class="mini" data-act="hints">Geri getir</button></div>
      <h3>Grafik</h3>
      ${qualityHTML()}
      <div class="srow"><span>🎥 Kamera uzaklığı</span><input type="range" min="55" max="260" value="${Math.round((hooks.getZoom ? hooks.getZoom() : 1) * 100)}" data-zoom="1"></div>
      <h3>Tema</h3><div class="themes">${th}</div>`;
  },
  kayit() {
    const last = G.lastSave ? new Date(G.lastSave).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
    return `<p class="mm-lead">Oyun her 3 saniyede kendiliğinden kaydedilir. Kaydını dosyaya indirip başka bir tarayıcıda devam edebilirsin.</p>
      <div class="mm-save"><span class="ic">💾</span><span><small>Son kayıt</small><b id="mmLast">${last}</b></span><button type="button" class="go sm" data-act="save">Şimdi kaydet</button></div>
      <div class="mm-btns">
        <button type="button" class="big2" data-act="export"><span class="ic">⬇️</span><b>Kaydı indir</b><small>.json dosyası olarak</small></button>
        <button type="button" class="big2" data-act="import"><span class="ic">⬆️</span><b>Kayıt yükle</b><small>indirdiğin dosyadan</small></button>
      </div>
      <input type="file" id="mmFile" accept=".json,application/json" hidden>
      <h3>Tehlikeli bölge</h3>
      <button type="button" class="danger" data-act="reset">🗑️ Yeni oyun (kaydı sil)</button>`;
  },
  yardim() {
    const keys = [['WASD / ok tuşları', 'Yürü'], ['Fareyle basılı tut', 'İmlecin peşinden koş'], ['Mini harita, Oraya git, bildirim', 'Seçtiğin yere kendin koşarsın'], ['Ekranı sürükle', 'Dokunmatikte joystick'], ['Fare tekerleği, + / −', 'Yakınlaştır / uzaklaştır'], ['Orta tuşla sürükle', 'Yukarı-aşağı: kamera açısı · sağa-sola: döndür (tıklayınca sıfırlanır)'], ['M veya Esc', 'Ana menü'], ['E', 'Yükseltmeler'], ['Boşluk', G.upg.jump ? 'Zıpla' : 'Pazarda bağır'], ['Q', 'Pazarda bağır'], ['Shift', 'Basılı tut: hızlı koş (yetenek)']];
    const steps = [
      ['🍅', 'Topla', 'Bostana, kümese, ahıra ya da makinenin tepsisine yürü; ürünler sırtına yığılır.'],
      ['🧺', 'Diz', 'Rafa, tezgaha ya da dolaba yürü; ürünler boş yerlere dizilir.'],
      ['🧾', 'Sat', 'Müşteri raftan alıp kasaya gider. Kasada durursan hızlı öder; kasiyer alırsan o öder.'],
      ['💰', 'Topla', 'Para kasanın yanında birikir. Üstüne basınca hesabına geçer.'],
      ['🔓', 'Aç', 'Kesik çizgili kilit alanında 0,7 saniye dur; para akar, yeni alan açılır.'],
      ['⬆️', 'Büyüt', 'Yükseltmelerle hızlan, daha çok taşı, eleman al, rafları ve makineleri büyüt.'],
    ];
    return `<h3>Nasıl oynanır</h3><div class="mm-steps">${steps.map(([ic, t, d], i) => `<div class="mm-step"><span class="n">${i + 1}</span><span class="ic">${ic}</span><span><b>${t}</b><small>${d}</small></span></div>`).join('')}</div>
      <h3>Bölgeler</h3>
      <ul class="mm-list"><li>🍉 <b>Semt Pazarı:</b> toptancıdan al, tezgahta sat, BAĞIR ile müşteri çek.</li><li>🏖️ <b>Sahil Büfesi:</b> siparişi şezlongdaki müşteriye götür, çabuk gidene bahşiş.</li><li>🐫 <b>Kervansaray:</b> kervanın siparişini süresi bitmeden tamamla, ödeme katlanır.</li><li>🚗 <b>Paket servis:</b> Köy Meydanı'ndaki paket servis cebinde bekleyen arabanın siparişini getir.</li><li>✨ <b>Bereket sandığı:</b> yakında belirince kap, 60 saniye kazanç 2 kat.</li></ul>
      <h3>Tuşlar</h3><table class="mm-table keys"><tbody>${keys.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</tbody></table>
      <h3>Emeği geçenler</h3>${credits()}
      <p><a href="gizlilik.html" target="_blank" rel="noopener">Gizlilik ve kullanım şartları</a></p>`;
  },
};

// lisans gereği: CC BY modellerin adı, yazarı, bağlantısı ve lisansı oyunda görünür (liste krediler.js, KoyBakkali-araclar/kredi_yap.py üretir)
function credits() {
  const ln = (t, u) => `<a href="${u}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`;
  return `<p class="mm-note mm-kredi">Bu modeller ${ln('CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0/')} lisansıyla kullanıldı (kaynak: poly.pizza). Oyuna uysunlar diye küçültüldü, sadeleştirildi, renkleri değiştirildi.</p>
    <ul class="mm-list mm-kredi">${BY.map(([who, list]) => `<li><b>${escapeHtml(who)}</b><br>${list.map(([t, u]) => ln(t, u)).join(', ')}</li>`).join('')}</ul>
    <p class="mm-note mm-kredi">Kamu malı (CC0) modeller: ${CC0.map(([w, n]) => `${escapeHtml(w)} (${n})`).join(', ')}, Kenney ${KENNEY.model.join(', ')}. Sesler: Kenney ${KENNEY.ses.join(', ')} (CC0). Yazı tipleri: Google Fonts (OFL). Motor: ${ln('three.js', 'https://threejs.org')} (MIT).</p>
    <p class="mm-note mm-kredi">At kişnemesi: ${ln('Lemasson ve ark. 2015, PLOS ONE', 'https://commons.wikimedia.org/wiki/File:Mares-Prefer-the-Voices-of-Highly-Fertile-Stallions-pone.0118468.s003.oga')} kaydı, ${ln('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/')} lisansıyla; kısaltıldı.</p>
    <p class="mm-note mm-kredi">Hayvan ve doğa sesleri (Wikimedia Commons, kesildi, düzeyleri eşitlendi): ${SESLER.map(([t, w, l, u]) => `${ln(t, u)} (${escapeHtml(w)}, ${l})`).join(', ')}.</p>
    <p class="mm-note mm-kredi">Araç sesleri ve akordeon (Wikimedia Commons, kesildi, düzeyleri eşitlendi): ${ARACSES.map(([t, w, l, u]) => `${ln(t, u)} (${escapeHtml(w)}, ${l})`).join(', ')}.</p>
    <p class="mm-note mm-kredi">Yağmur ve gök gürültüsü (Wikimedia Commons, kesildi, düzeyleri eşitlendi): ${HAVASES.map(([t, w, l, u]) => `${ln(t, u)} (${escapeHtml(w)}, ${l})`).join(', ')}.</p>
    <p class="mm-note mm-kredi">Arka plan müziği: Suno ile üretildi (ücretli plan, ticari kullanım hakkıyla).</p>`;
}
// hayvanses.js kayıtları: [ne, kimden, lisans, kaynak] (assets/sfx/hayvan/License.txt)
const SESLER = [
  ['Tavuk ve horoz', 'alys', 'kamu malı', 'https://commons.wikimedia.org/wiki/File:Hen_announcing_shes_lain_an_egg.ogg'],
  ['İnek', 'Gasybeaugosse2020', 'CC0', 'https://commons.wikimedia.org/wiki/File:Cow_in_Vezo.ogg'],
  ['İnek', 'MichaeltheFox8621', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Single_Cow_Moo.ogg'],
  ['Köpek', 'Amada44', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Barking_of_a_dog.ogg'],
  ['Köpek', 'Armartinell', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Perro_ladrando.ogg'],
  ['Kedi', 'Heismark', 'kamu malı', 'https://commons.wikimedia.org/wiki/File:Meow_of_a_pleading_cat.oga'],
  ['Karatavuk', 'Diana Tudor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Common_Blackbird_song_(Turdus_merula).ogg'],
  ['İspinoz', 'Oona Räisänen', 'kamu malı', 'https://commons.wikimedia.org/wiki/File:Fringilla_coelebs.ogg'],
  ['Büyük baştankara', 'Dengis Chantal', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Parus_major_15mars2011.ogg'],
  ['Serçe', 'Jonathon Jongsma', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Passer_domesticus_-_House_Sparrow_-_XC86749.ogg'],
  ['Yaprak hışırtısı', 'Gravity Sound', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Rustling_leaves_(Gravity_Sound).wav'],
];
// araç sesleri ve akordeoncu (aracses.js, calgi.js; kaynaklar assets/sfx/arac ve assets/sfx/calgi License.txt)
const ARACSES = [
  ['Akordeon: Duet Musette', 'Kevin MacLeod', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Duet_Musette_(ISRC_USUAN1100250).mp3'],
  ['Bisiklet zili', 'Soundscape_Leuphana', 'CC0', 'https://commons.wikimedia.org/wiki/File:Bicycle-bell-1.wav'],
  ['Bisiklet zili', 'bsumusictech', 'CC0', 'https://commons.wikimedia.org/wiki/File:Bsumusictech_bike-bell.wav'],
  ['Bisiklet zili', 'marcolo91', 'CC0', 'https://commons.wikimedia.org/wiki/File:156064_marcolo91_bicycle-bell.wav'],
  ['Mopet', 'stephan', 'kamu malı', 'https://commons.wikimedia.org/wiki/File:Moped_driving_by.ogg'],
  ['Otomobil', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_CarPrinzNSU1200Cengine.ogg'],
  ['Korna', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_CarPrinzNSU1200C8211horn.ogg'],
  ['Kamyonet', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_FSRTarpan239Dvandriving.ogg'],
  ['Kamyon', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_CityBusMANSG220engine.ogg'],
  ['Traktör', 'Work With Sounds / Werstas', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_JohnDeereTractor.ogg'],
  ['Geçen arabalar', 'Dsw4', 'kamu malı', 'https://commons.wikimedia.org/wiki/File:Cars_passing_over_bridge.ogg'],
];
// yağmur, sağanak ve gök gürültüsü (hava.js; kaynaklar assets/sfx/hava/License.txt)
const HAVASES = [
  ['Yağmur', 'ezwa', 'kamu malı', 'https://commons.wikimedia.org/wiki/File:Rain_(1).ogg'],
  ['Sağanak', 'Sage Ross', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Heavy_rain_in_Glenshaw,_PA.ogg'],
  ['Gök gürültüsü', 'Amuzujoe', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Thunder_01.ogg'],
  ['Gök gürültüsü', 'Jud McCranie', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Thunder_crack_2B.ogg'],
];

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- etkileşim ----------
function onBodyClick(e) {
  const t = e.target.closest('button, [data-go]');
  if (!t) return;
  if (t.dataset.alb) { if (G.hooks.albumTab) G.hooks.albumTab(t.dataset.alb); show('album', true); return; }
  if (t.dataset.go) { const r = goToRegion(t.dataset.go); if (r) { closeMenu(); if (r === 'tp' && hooks.snapCamera) hooks.snapCamera(); } return; }
  if (t.dataset.sw) { G.custom[t.dataset.sw] = t.dataset.c; hooks.onCustom(true); show('dukkan', true); return; }
  if (t.dataset.st) { G.custom[t.dataset.st] = t.dataset.v; hooks.onCustom(true); show('dukkan', true); return; } // dükkân tasarımı (tasarim.js)
  if (t.dataset.tog === 'haptic') { settings.haptic = settings.haptic === false; saveSettings(); t.classList.toggle('on', settings.haptic); if (settings.haptic) haptic(30, 0); return; }
  if (t.dataset.tog === 'mouseMark') { const k = t.dataset.tog; settings[k] = settings[k] === false; saveSettings(); t.classList.toggle('on', settings[k]); return; }
  if (t.dataset.tog === 'hints') { settings.hints = settings.hints === false; saveSettings(); applyHints(); t.classList.toggle('on', settings.hints); return; }
  if (t.dataset.tog) { const on = !settings[t.dataset.tog]; if (t.dataset.tog === 'sfx') setSfx(on); else if (t.dataset.tog === 'voice') setVoice(on); else if (t.dataset.tog === 'amb') setAmb(on); else setMusic(on); t.classList.toggle('on', on); syncMusic(); return; }
  if (t.dataset.t) { applyTheme(t.dataset.t); show('ayar', true); return; }
  if (t.dataset.q) {
    if (qBusy) return;
    let q = t.dataset.q;
    if (q === 'auto') q = initQuality(true); // cihaza göre yeniden seçer
    else { settings.quality = q; settings.autoQ = 1; saveSettings(); }
    qBusy = true; markQuality(t);
    Promise.resolve(hooks.quality && hooks.quality(q)).finally(() => { qBusy = false; markQuality(); });
    return;
  }
  const act = t.dataset.act;
  if (act === 'tasarim') { closeMenu(); setTimeout(() => openTasarim(), 60); return; } // menü kapanır, kamera dükkâna döner
  if (act === 'save') { save(); $('mmLast').textContent = new Date().toLocaleTimeString('tr-TR'); banner('KAYDEDİLDİ', 'Oyunun güvende ✓'); play('buy'); }
  if (act === 'next') { nextTrack(true); setTimeout(() => { const el = $('mmTrack'); if (el) el.textContent = musicInfo().name; }, 50); }
  if (act === 'hints') { resetHints(); const n = $('mmHintN'); if (n) n.textContent = '0'; }
  if (act === 'install') promptInstall();
  if (act === 'full') { toggleFullscreen(); setTimeout(() => show('ayar', true), 300); }
  if (act === 'reopen') { save(); location.reload(); } // şekil ayrıntısı ve kenar yumuşatma açılışta kurulur
  if (act === 'export') exportSave();
  if (act === 'import') $('mmFile').click();
  if (act === 'reset') askReset();
}
function onBodyInput(e) {
  const t = e.target;
  if (t.id === 'mmName') { G.custom.name = t.value.trim() || 'Köy Bakkalı'; $('mmShop').textContent = G.custom.name; hooks.onCustom(true); }
  if (t.dataset.vol) { const v = +t.value / 100; if (t.dataset.vol === 'sfx') setSfxVol(v); else if (t.dataset.vol === 'voice') setVoiceVol(v); else if (t.dataset.vol === 'amb') setAmbVol(v); else setMusicVol(v); }
  if (t.dataset.zoom && hooks.setZoom) hooks.setZoom(+t.value / 100);
}
function onBodyChange(e) {
  if (e.target.id !== 'mmFile' || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.unlocked) || typeof d.money !== 'number') throw new Error('biçim');
      if (!confirm('Bu kayıt yüklensin mi? Şu anki oyunun üzerine yazılacak.')) return;
      hooks.beforeImport && hooks.beforeImport();
      writeSave(d);
      location.reload();
    } catch (err) { banner('HATA', 'Bu dosya bir Köy Bakkalı kaydı değil'); play('error'); }
  };
  r.readAsText(e.target.files[0]);
}
function exportSave() {
  save();
  const blob = new Blob([JSON.stringify(saveData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `koy-bakkali-kayit-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  play('buy');
}

// sağ üstteki ses düğmesi ayarla aynı durumda kalır
const syncMusic = syncSoundBtn;

function refreshBadges() {
  if (section === 'basari' && open) G.seenAch = new Set(G.ach);
  const newAch = ACH.some((a) => G.ach.has(a.id) && !G.seenAch?.has(a.id));
  for (const b of $('mmNav').querySelectorAll('button[data-s]')) {
    if (b.dataset.s === 'basari') b.classList.toggle('dot', newAch);
    if (b.dataset.s === 'album') b.classList.toggle('dot', !!G.albumNew && section !== 'album');
    if (b.dataset.s === 'upg') b.classList.toggle('dot', $('upgBtn').classList.contains('dot'));
  }
  $('menuBtn').classList.toggle('dot', newAch);
}

export function updateMenu(dt) {
  achT -= dt;
  if (achT <= 0) {
    achT = 1;
    for (const a of ACH) {
      if (G.ach.has(a.id) || a.val() < a.goal) continue;
      G.ach.add(a.id);
      const [para, kadro] = a.odul || [0, 0];
      if (para) G.money += para;
      kadroBonus();
      banner(`BAŞARIM: ${a.icon}`, `${a.name}${para ? ` · 🎁 ${tl(para)} ₺` : ''}${kadro ? ` · 👥 +${kadro} kadro` : ''}`);
      play('hire');
      confetti(G.player.position, 30);
      save();
    }
    refreshBadges();
  }
  if (!open || section !== 'genel') return;
  liveT -= dt;
  if (liveT > 0) return;
  liveT = 0.5;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('mmMoney', tl(G.money));
  set('mmEarned', `${tl(G.stats.earned)} ₺`);
  set('mmCust', tl(G.stats.customers));
  set('mmSold', tl(G.stats.sold));
  set('mmTime', fmtTime(G.stats.time));
}
