// Elemanlar (kasiyer, rafçı, tezgahçı, garson, kâhya) ve yükseltme menüsü
import * as THREE from 'three';
import { bankUp } from './bank.js';
import { G, ITEMS, Stack, MoneyPile, sfx, save, toast, popIn, bounce, lerpAngle, rand, fly, floatText, makeItem, PRICE_K } from './game.js';
import * as M from './models.js';
import { heightAt, findRoute, walkable, regionEntry, unlockPrice, tierOf, needsOfArea } from './world.js';
import { nice } from './fiyat.js';
import { expansionDefs } from './expand.js';
import { thiefCaught, makeDog, animateDog } from './thief.js';
import { coastZ } from './nature.js';
import { TERRACE_Z } from './resort.js';
import { banner } from './ui.js';
import { confetti, ring } from './fx.js';
import { feel } from './his.js';
import { fine } from './account.js';
import { say } from './texts.js';
import { staffIdle } from './dukkan.js';
import { litter, collect } from './cop.js';
import { tripWanted, startTrip, tripStep } from './tahsilat.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mps = (v) => `${v.toFixed(1).replace('.', ',')} m/sn`;
const pcs = (v) => `${v} ürün`;

// values[seviye] = o seviyedeki değer, costs[seviye] = bir sonraki seviyenin fiyatı
// req: işe alım için açık olması gereken bölge; hire: sırayla 1., 2., 3. elemanın fiyatı
export const UPG = {
  // oyuncunun kendisi (2026-11-01 kullanıcı: "ilk hızlanma normal, sonrakiler çok daha pahalı, hemen alamamalıyız"): ilk basamak ucuz,
  // sonra her basamak öncekinin 3-5 katı (çarpanla 80 ₺'den 60.000 ₺'ye; hız 200 ₺'den 48.000 ₺'ye). steep: 1 → genel dikleşme uygulanmaz
  // ele 4 ürünle başlar, her seviye +1, en çok 8 (2026-11-02 kullanıcı: "taşıma kapasitesi ile raf kapasitesi uyumsuz, devamlı elde ürün
  // kalıyor, o kadar artmasın": raflar 6-12, makine masaları 6 alıyor; 9 ve 10 kalktı, alanlara parası geri verilir, initUpgrades).
  // 2026-11-09 kullanıcı: "adamın taşıma kapasitesi yükselsin gelişmiş rafçılarla aynı olsun" (seçtiği: başlangıç 4 → 6, en üst 8 → 12, arabalı
  // taşıyıcılar gibi): basamak sayısı ve fiyatlar aynı, kayıttaki seviye yerinde kalır, değeri büyür
  cap:     { name: 'Taşıma kapasitesi', values: [6, 7, 8, 10, 12], costs: [40, 250, 1200, 4500], steep: 1, fmt: pcs },
  spd:     { name: 'Yürüme hızı', values: [1, 1.1, 1.2, 1.3, 1.45], costs: [100, 1000, 6000, 24000], steep: 1, fmt: (v) => `%${Math.round(v * 100)}` },
  // avatar yetenekleri (yetenek.js, 2026-11-07 kullanıcı: "elmas ve çok yüksek parayla"; ödeme seçmeli soruyla: ikisi birden gerekir). Geç oyun hedefi:
  // günde en çok 4 💎 (gorev.js), hepsi 103 💎. flat: fiyat çarpanı ve dikleşme yok, costs ekranda görünen fiyat; gem: o basamağın elması
  jump:    { name: 'Zıplama', icon: '🦘', skill: 1, flat: 1, values: [0, 1], costs: [50000], gem: [8], fmt: (v) => (v ? 'Açık' : 'Kapalı'), desc: 'Boşluk tuşuyla ya da 🦘 düğmesiyle zıplarsın. Eğlencesine: engellerin üstünden geçmez.' },
  sprint:  { name: 'Hızlı Koşu', icon: '⚡', skill: 1, flat: 1, values: [0, 7, 10, 14], costs: [75000, 150000, 300000], gem: [12, 18, 25], fmt: (v) => (v ? `${v} sn enerji` : 'Kapalı'), desc: "Shift'i basılı tut ya da ⚡ düğmesine dokun: %55 daha hızlı koşarsın. Enerji harcar, koşmayınca dolar." },
  magnet:  { name: 'Para Mıknatısı', icon: '🧲', skill: 1, flat: 1, values: [0, 5, 8], costs: [100000, 250000], gem: [15, 25], fmt: (v) => (v ? `${v} m çekim` : 'Kapalı'), desc: 'Yakındaki kasaların parası üstüne basmadan sana uçar.' },
  // ikinci kasiyer ikinci kasa açılınca (world.js kk2): her kasaya bir kasiyer
  cashier: { name: 'Kasiyer', hire: [120, 900], req: 'koy', slots: () => (G.regions.koy.registers || [1]).length, lock: 'İkinci kasa açılınca', desc: 'Köy kasasında ödemeleri senin yerine alır' },
  cashSpd: { name: 'Kasiyer hızı', parent: 'cashier', values: [1.0, 0.8, 0.6, 0.45], costs: [100, 220, 400], fmt: (v) => `müşteri başı ${v.toFixed(2).replace('.', ',')} sn` },
  shelver: { name: 'Rafçı', hire: [180, 420, 800], req: 'koy', desc: 'Rafa gereken her ürünü kaynağından getirir; yoksa makinede ürettirir (ör. sütü küpe taşıyıp yoğurdu dolaba dizer)' },
  shCap:   { name: 'Rafçı kapasitesi', parent: 'shelver', values: [3, 4, 5, 6], costs: [120, 250, 450], fmt: pcs },
  shSpd:   { name: 'Rafçı hızı', parent: 'shelver', values: [2.6, 3.2, 3.8, 4.4], costs: [120, 250, 450], fmt: mps },
  vendor:  { name: 'Tezgahçı', hire: [300, 700], solo: true, req: 'pazar', desc: 'Toptancıdan alıp tezgaha dizer; malı senin kasandan öder' },
  vCap:    { name: 'Tezgahçı kapasitesi', parent: 'vendor', values: [3, 4, 5, 6], costs: [200, 400, 700], fmt: pcs },
  vSpd:    { name: 'Tezgahçı hızı', parent: 'vendor', values: [2.6, 3.2, 3.8, 4.4], costs: [200, 400, 700], fmt: mps },
  waiter:  { name: 'Garson', hire: [500, 950, 1600], req: 'sahil', desc: 'Siparişi büfeden alıp şezlonga götürür' },
  wCap:    { name: 'Garson kapasitesi', parent: 'waiter', values: [2, 3, 4, 5], costs: [300, 550, 900], fmt: pcs },
  wSpd:    { name: 'Garson hızı', parent: 'waiter', values: [2.8, 3.4, 4.0, 4.6], costs: [300, 550, 900], fmt: mps },
  steward: { name: 'Kâhya', hire: [900, 1700], req: 'han', desc: 'Kervan siparişini fırından, kazandan, ambardan taşır' },
  sCap:    { name: 'Kâhya kapasitesi', parent: 'steward', values: [3, 4, 5, 6], costs: [500, 900, 1400], fmt: pcs },
  sSpd:    { name: 'Kâhya hızı', parent: 'steward', values: [2.6, 3.2, 3.8, 4.4], costs: [500, 900, 1400], fmt: mps },
  carrier: { name: 'Taşıyıcı', icon: '🐴', hire: [400, 900], req: 'sahil', desc: 'Eşeğiyle bölgeler arası ne lazımsa taşır: koçan, hasat buğdayı, süt, yün, kilim, koyun sütü, yoğurt, köy sebzesi ve tatil köyü istekleri' },
  cCart:   { name: 'Tekerlekli araba', icon: '🛒', parent: 'carrier', values: [6, 12], costs: [700], fmt: (v) => (v > 6 ? `araba · ${v} yük` : `eşek heybesi · ${v} yük`) },
  cSpd:    { name: 'Taşıyıcı hızı', parent: 'carrier', values: [2.6, 3.1, 3.6], costs: [350, 700], fmt: mps },
};
// makineler: her üretici için hız ve tepsi kapasitesi
const MACHINES = [
  { id: 'misir', name: 'Mısır kazanı', icon: '🌽', region: 'sahil' },
  { id: 'dondurma', name: 'Dondurma makinesi', icon: '🍦', region: 'sahil' },
  { id: 'ekmek', name: 'Fırın', icon: '🍞', region: 'han' },
  { id: 'corba', name: 'Çorba kazanı', icon: '🍲', region: 'han' },
  { id: 'yem', name: 'Yem ambarı', icon: '🌾', region: 'han' },
  { id: 'peynir', name: 'Mandıra', icon: '🧀', region: 'koy' },
  { id: 'saman', name: 'Harman makinesi', icon: '🌾', region: 'atlar' },
  { id: 'havlu', name: 'Çamaşırhane', icon: '🧺', region: 'tatil' },
  { id: 'yun', name: 'Kırkım barakası', icon: '🐑', region: 'mera' },
  { id: 'ksut', name: 'Sağım yeri', icon: '🍼', region: 'mera' },
  { id: 'yogurt', name: 'Yoğurt küpü', icon: '🍶', region: 'mera' },
  { id: 'kilim', name: 'Dokuma tezgahı', icon: '🧶', region: 'atolye' },
  { id: 'fekmek', gen: 'ekmek', name: 'Ekmek fırını', icon: '🍞', region: 'firin' },
  { id: 'simit', name: 'Simit fırını', icon: '🥯', region: 'firin' },
  { id: 'pogaca', name: 'Poğaça fırını', icon: '🥐', region: 'firin' },
  { id: 'izgara', name: 'Izgara', icon: '🐟', region: 'iskele' },
];
// yeni bölümlerin (expand-*.js) üreticisi ve makinesi: menüde bölgesinin "Bölümler" kısmında hız ve tepsi yükseltmesi alır.
// Adı ve simgesi bölümden gelir (render), nesnesi expand.js G.xgens'te
const XMACH = [['xpazar2', 'pazar'], ['xciftlik1', 'ciftlik'], ['xciftlik2', 'ciftlik'], ['xciftlik3', 'ciftlik'], ['xhan2', 'han'], ['xfirin1', 'firin'], ['xfirin2', 'firin'],
  ['xkasaba2', 'kasaba'], ['xsehir2', 'sehir'], ['xmera1', 'mera'], ['xmera2', 'mera'], ['xmera3', 'mera'], ['xatolye1', 'atolye'], ['xatolye2', 'atolye'], ['xatolye3', 'atolye'],
  ['xatlar1', 'atlar'], ['xiskele1', 'iskele'], ['xiskele2', 'iskele'], ['xkoy4', 'pazar'], ['xkoy5', 'kasaba'],
  ['xkoym1', 'koy'], ['xkoym2', 'koy'], ['xkoym3', 'koy'], ['xkoym4', 'koy']]; // köy makineleri büyük köy marketinin doğu şeridinde (koymakine.js); salça kazanı pazarda, kek tezgâhı kasaba kahvesinin arkasında (2026-11-02'ye kadar köy imalathanesinde)
for (const [exp, region] of XMACH) MACHINES.push({ id: `x_${exp}`, exp, region, name: '', icon: '' });
const genOf = (m) => (m.exp ? ((G.xgens || {})[m.exp] || [])[0] : G.regions[m.region].gens && G.regions[m.region].gens[m.gen || m.id]);
// raf takip (raftakip.js): üreticinin menüdeki adı ve simgesi (makine listesi ya da bölümün kendi adı); bilinmiyorsa null
export function genName(g) {
  if (!g) return null;
  const xd = (id) => { const d = expansionDefs().find((x) => x.id === id); return d ? { name: d.title, icon: d.icon } : null; };
  for (const m of MACHINES) {
    let o = null;
    try { o = genOf(m); } catch (e) { o = null; }
    if (o === g) return m.exp ? xd(m.exp) : { name: m.name, icon: m.icon };
  }
  for (const id in G.xgens || {}) if (G.xgens[id].includes(g)) return xd(id);
  return null;
}
const times = (v) => `×${(1 / v).toFixed(2).replace('.', ',')}`;
for (const m of MACHINES) {
  UPG[`ms_${m.id}`] = { name: 'Üretim hızı', machine: m, values: [1, 0.8, 0.65, 0.5], costs: [150, 350, 700], fmt: times };
  UPG[`mc_${m.id}`] = { name: 'Tepsi kapasitesi', machine: m, values: [0, 3, 6, 10], costs: [120, 280, 550], fmt: (v) => `+${v} yer` };
}
// turşucu iki seviye daha hızlanır: ×2,5 ve ×3,33 (2026-11-03 kullanıcı: "turşu üretim hızını da büyütme seçeneği ekle"; ×2'de bitiyordu).
// Menüde fiyatı 6.590 ve 15.370 ₺ (STEEP ve PRICE_K ile); eski kayıttaki 3. seviye yerinde kalır
Object.assign(UPG.ms_x_xpazar2, { values: [1, 0.8, 0.65, 0.5, 0.4, 0.3], costs: [150, 350, 700, 1200, 2000] });
// raflar: kat ekledikçe 8'er yer artar
const SHELVES = [
  { id: 'domates', name: 'Domates rafı', icon: '🍅' },
  { id: 'salatalik', name: 'Salatalık rafı', icon: '🥒' },
  { id: 'yumurta', name: 'Yumurta rafı', icon: '🥚' },
  { id: 'sut', name: 'Süt dolapları', icon: '🥛' },
];
// tek ürünlü raflar iki katla gelir; büyütme üçüncü katı ekler (süt dolabı bütün dolaplara)
for (const s of SHELVES) UPG[`rf_${s.id}`] = { name: s.name, icon: s.icon, shelf: s.id, lock: `${s.name} açılınca`, values: [2, 3], costs: [450], fmt: (v) => `${v} kat · ${v * 6} yer` };
// raf kapasitesi (2026-11-01 kullanıcı: "rafların kapasitesi büyütülebilmeli"): bölgenin bütün raflarında ürünler üst üste istiflenir
// (game.js Shelf.setStack). 1. seviye rafın müşteriye bakan yarısı, 2. seviye bütün raf; sonradan açılan raf da istifli kurulur
const RACKS = [['koy', 400, 900], ['pazar', 700, 1500], ['firin', 900, 2000], ['iskele', 1200, 2600], ['cicekci', 1500, 3200], ['sehir', 2500, 5000]];
for (const [r, c1, c2] of RACKS) UPG[`rk_${r}`] = { name: 'Raf kapasitesi', icon: '📦', rack: r, lock: 'İlk raf açılınca', values: [0, 1, 2], costs: [c1, c2], steep: 1,
  fmt: (v) => ['Tek sıra', 'Ön sıralar üst üste', 'Bütün raf üst üste'][v], desc: 'Ürünler rafta üst üste dizilir: raf daha geç boşalır' };
const racksOf = (r) => G.stations.filter((s) => s.rackKey && s.rackKey() === r);
// raf takip sistemi (raftakip.js, 2026-11-08 kullanıcı: "... buna raf takip sistemi diyelim ve bu sistemi parayla alalım gelliştirme olarak"):
// tek basamak, Köy Bakkalı sekmesinde. Alınınca haritanın üstündeki çubukta 📋 düğmesi çıkar. steep 1: fiyat costs × PRICE_K = 3.000 ₺.
// info: alınmamışken satırda açıklaması görünür (row)
UPG.rafTakip = { name: 'Raf takip sistemi', icon: '📋', info: 1, values: [0, 1], costs: [1500], steep: 1, fmt: (v) => (v ? 'Kurulu · 📋 tuşu haritanın üstünde' : 'Kurulu değil'),
  desc: 'Ekrana 📋 tuşu gelir: hangi rafta kaç ürün, kaç boş yer var tek tabloda; rafa dokununca ürünün nerede, nasıl üretildiği' };
UPG.sulama = { name: 'Bostan sulama', icon: '💧', values: [1, 0.8, 0.65, 0.5], costs: [100, 250, 500], fmt: (v) => `büyüme ${times(v)}` };
UPG.a_tavuk = { name: 'Tavuklar', icon: '🐔', animal: 'yumurta', lock: 'Kümes açılınca', values: [3, 4, 5, 6], costs: [250, 500, 900], fmt: (v) => `${v} tavuk` };
UPG.courier = { name: 'Araba servisçisi', icon: '🛵', hire: [350, 800], req: 'koy', need: ['kc', 'kb'], lock: 'Paket servis ya da otopark açılınca', desc: 'Arabada bekleyen müşterinin siparişini toplayıp arabaya götürür' };
UPG.cvCap = { name: 'Araba servisçisi kapasitesi', parent: 'courier', values: [4, 5, 6, 8], costs: [200, 400, 700], fmt: pcs };
UPG.cvSpd = { name: 'Araba servisçisi hızı', parent: 'courier', values: [3.0, 3.6, 4.2, 4.8], costs: [200, 400, 700], fmt: mps };
// her kuleye bir cankurtaran: alınabilecek sayı kule sayısı kadar
UPG.lifeguard = { name: 'Cankurtaran', icon: '🛟', hire: [600, 800, 1000, 1200], most: 2, req: 'sahil', slots: () => (G.regions.sahil.towers || []).length, lock: 'Yeni cankurtaran kulesi açılınca', desc: 'Kulesinde oturur, boğulan yüzücüyü kurtarır; kurtarılan müşteri bahşiş bırakır' };
UPG.lgSpd = { name: 'Cankurtaran hızı', parent: 'lifeguard', values: [3.4, 4.2, 5.0], costs: [300, 600], fmt: mps };
// bekçi: para yığınlarında devriye gezer, hırsızı kovalar (thief.js); köpek yükseltmesiyle köpeği hırsıza çok daha hızlı yetişir
// çöpçü (cop.js, 2026-11-01): sokaktaki çöpü ve hayvan pisliğini toplar; temizlik arabası bütün çöpçüleri araçlı yapar
UPG.sweeper = { name: 'Çöpçü', icon: '🧹', hire: [600, 1200, 2000], req: 'kasaba', desc: 'Sokaklardaki çöpü ve hayvan pisliğini toplar; sokak temizse mahalle puanı düşmez' };
UPG.swSpd = { name: 'Çöpçü hızı', parent: 'sweeper', values: [2.2, 2.6, 3.0, 3.4], costs: [200, 400, 700], fmt: mps };
UPG.swCart = { name: 'Temizlik arabası', icon: '🚛', values: [0, 1], costs: [2400], req: 'kasaba', fmt: (v) => (v ? 'çöpçüler araçla dolaşır: hızlı, çevresini süpürür' : 'çöpçüler yaya, süpürgeyle') };
UPG.guard = { name: 'Bekçi', icon: '👮', hire: [700, 1400], req: 'koy', need: ['gp'], lock: 'Semt Pazarı açılınca', desc: 'Para yığınlarının başında devriye gezer, hırsızı kovalayıp yakalar' };
UPG.gDog = { name: 'Bekçi köpeği', icon: '🐕', parent: 'guard', values: [0, 1], costs: [600], fmt: (v) => (v ? 'köpek var · hırsıza hızla yetişir' : 'köpek yok') };
UPG.gdSpd = { name: 'Bekçi hızı', parent: 'guard', values: [4.5, 5.1, 5.8], costs: [300, 600], fmt: mps };
// fırıncı: un çuvallarından fırınlara un taşır, pişen simit ve poğaçayı vitrine dizer (carsi.js)
UPG.baker = { name: 'Fırıncı', icon: '🥯', hire: [700, 1300], req: 'firin', desc: 'Unu fırınlara taşır, pişen simit ve poğaçayı vitrine dizer' };
UPG.bkCap = { name: 'Fırıncı kapasitesi', parent: 'baker', values: [4, 5, 6, 8], costs: [250, 450, 750], fmt: pcs };
UPG.bkSpd = { name: 'Fırıncı hızı', parent: 'baker', values: [2.6, 3.2, 3.8, 4.4], costs: [250, 450, 750], fmt: mps };
// seyis: at ahırında samanı yığından yemliklere taşır, tımar isteyen atı tımarlar (riders.js)
UPG.groom = { name: 'Seyis', icon: '🐎', hire: [600, 1200], solo: true, req: 'atlar', desc: 'Tarladan buğdayı harmana taşır, samanı bekleyen atların yemliğine koyar, atları tımar eder' };
UPG.gmCap = { name: 'Seyis kapasitesi', parent: 'groom', values: [2, 3, 4, 5], costs: [250, 450, 750], fmt: pcs };
UPG.gmSpd = { name: 'Seyis hızı', parent: 'groom', values: [2.8, 3.4, 4.0, 4.6], costs: [250, 450, 750], fmt: mps };
// kat görevlisi: tatil köyünde boşalan evi toplar, kirli çamaşırı çamaşırhaneye götürür, havlu isteklerini taşır
UPG.maid = { name: 'Kat görevlisi', icon: '🧹', hire: [700, 1300], solo: true, req: 'tatil', desc: 'Boşalan kabuk evleri toplar, kirli çamaşırı çamaşırhaneye götürür, havlu isteklerini evlere taşır' };
UPG.mdCap = { name: 'Kat görevlisi kapasitesi', parent: 'maid', values: [4, 5, 6, 8], costs: [300, 550, 900], fmt: pcs };
UPG.mdSpd = { name: 'Kat görevlisi hızı', parent: 'maid', values: [2.8, 3.4, 4.0, 4.6], costs: [300, 550, 900], fmt: mps };
// resepsiyonist: tatil köyünün kayıt bankosunda durur, sıradaki misafirin kaydını yapar (resort.js Desk)
UPG.recep = { name: 'Resepsiyonist', icon: '🛎️', hire: [900], req: 'tatil', desc: 'Kayıt bankosunun arkasında durur, sıradaki misafirin kaydını yapıp anahtarını verir' };
UPG.rcSpd = { name: 'Kayıt hızı', parent: 'recep', values: [0.8, 0.6, 0.45, 0.3], costs: [250, 450, 750], fmt: (v) => `kayıt ${String(v).replace('.', ',')} sn` };
// dokumacı: atölyenin tezgahını meradan getirdiği yünle besler
UPG.weaver = { name: 'Dokumacı', icon: '🧶', hire: [600, 1100], req: 'atolye', desc: 'Meradan yünü dokuma tezgahına taşır, tezgah kilim dokur' };
UPG.wvCap = { name: 'Dokumacı kapasitesi', parent: 'weaver', values: [3, 4, 5, 6], costs: [250, 450, 750], fmt: pcs };
UPG.wvSpd = { name: 'Dokumacı hızı', parent: 'weaver', values: [2.6, 3.2, 3.8, 4.4], costs: [250, 450, 750], fmt: mps };
// muhasebeci: kasaları dolaşıp parayı çantasına toplar, kasaba meydanındaki bankaya yatırır (bank.js)
UPG.accountant = { name: 'Muhasebeci', icon: '💼', hire: [800, 1500], req: 'kasaba', need: ['gp'], lock: 'Semt Pazarı açılınca', desc: 'Kasalardaki parayı çantasına toplar, bankaya yatırır; yatırılan para hesabına geçer' };
// 2026-11-02 kullanıcı: "muhasebecinin para toplama kapasitesi çok düşük": kasalarda binlerce lira birikirken 150-900 ₺'lik çantayla
// bankaya mekik dokuyordu. Çanta büyüdü, iki seviye eklendi
UPG.acCap = { name: 'Çanta', parent: 'accountant', values: [600, 1500, 4000, 10000, 25000, 60000], costs: [400, 1200, 3500, 9000, 22000], fmt: (v) => `${v.toLocaleString('tr-TR')} ₺` };
UPG.acSpd = { name: 'Muhasebeci hızı', parent: 'accountant', values: [3.0, 3.6, 4.2, 4.8], costs: [300, 600, 1000], fmt: mps };
// servisçi: başka bölgenin ürününü isteyen müşteriye ürünü getirir (requests.js)
UPG.server = { name: 'Ayakçı', icon: '🍽️', hire: [700, 1300], req: 'koy', need: ['gp'], lock: 'Semt Pazarı açılınca', desc: 'Başka bölgenin ürününü isteyen müşteriye ürünü kaynağından getirir; boşta raflara yardım eder' };
UPG.svCap = { name: 'Ayakçı kapasitesi', parent: 'server', values: [2, 3, 4, 5], costs: [250, 450, 750], fmt: pcs };
UPG.milkman = { name: 'Sütçü', icon: '🥛', hire: [500, 1000], req: 'ciftlik', desc: 'Eşeğiyle çiftliğin sütünü, yumurtasını ve peynirini köydeki dolaba ve raflara, sütü mandıraya ve büfenin dondurma makinesine taşır' };
UPG.mkCap = { name: 'Sütçü arabası', icon: '🛒', parent: 'milkman', values: [6, 12], costs: [700], fmt: (v) => (v > 6 ? `araba · ${v} yük` : `eşek heybesi · ${v} yük`) };
UPG.mkSpd = { name: 'Sütçü hızı', parent: 'milkman', values: [2.8, 3.3, 3.8], costs: [350, 700], fmt: mps };
UPG.svSpd = { name: 'Ayakçı hızı', parent: 'server', values: [3.2, 3.8, 4.4, 5.0], costs: [250, 450, 750], fmt: mps };
// balıkçı: iskeleden olta atar; tekne yükseltmesiyle kayıkla açığa çıkıp ağ atar; tuttuğunu tezgaha dizer (fishing.js)
UPG.fisher = { name: 'Balıkçı', icon: '🎣', hire: [700, 1300], req: 'iskele', desc: 'İskeleden balık tutar, tezgaha dizer; tezgah doluysa buzlu kasaya koyar' };
UPG.fsCap = { name: 'Balıkçı kapasitesi', parent: 'fisher', values: [4, 5, 6, 8], costs: [250, 450, 750], fmt: pcs };
UPG.fsSpd = { name: 'Balıkçı hızı', parent: 'fisher', values: [2.8, 3.4, 4.0, 4.6], costs: [250, 450, 750], fmt: (v) => `${mps(v)} · olta ${(14 / v).toFixed(1).replace('.', ',')} sn` };
UPG.fsBoat = { name: 'Balıkçı teknesi', icon: '🛶', req: 'iskele', mod: true, values: [0, 1], costs: [1500], fmt: (v) => (v ? 'kayıkla açığa çıkar, ağla çok balık getirir' : 'iskeleden olta atar') };
// restoran garsonu: ızgaradan tabağı masaya götürür, boşta ızgarayı buzlu kasadan besler
UPG.rwaiter = { name: 'Restoran garsonu', icon: '🍽️', hire: [700, 1300], req: 'iskele', need: ['b2'], lock: 'Balık restoranı açılınca', desc: 'Izgara balığı masalara götürür, ızgarayı buzlu kasadaki balıkla besler' };
UPG.rwCap = { name: 'Garson kapasitesi', parent: 'rwaiter', values: [2, 3, 4], costs: [300, 600], fmt: pcs };
UPG.rwSpd = { name: 'Garson hızı', parent: 'rwaiter', values: [3.0, 3.6, 4.2, 4.8], costs: [250, 450, 750], fmt: mps };
// bölge geliştirmeleri (mod: değeri G.mods'a yazılır, ilgili dosya oradan okur)
const xf = (pre) => (v) => `${pre} ×${String(v).replace('.', ',')}`;
UPG.enSun = { name: 'Panel verimi', icon: '☀️', req: 'enerji', mod: true, values: [1, 1.2, 1.4, 1.6], costs: [800, 1600, 2800], fmt: xf('güneş üretimi') };
UPG.enWind = { name: 'Türbin verimi', icon: '🌬️', req: 'enerji', mod: true, values: [1, 1.2, 1.4, 1.6], costs: [1000, 2000, 3400], fmt: xf('rüzgâr üretimi') };
UPG.fuelPay = { name: 'Yakıt fiyatı', icon: '⛽', req: 'koy', need: ['e0'], lock: 'Benzinlik açılınca', mod: true, values: [12, 14, 16, 18], costs: [300, 600, 1000], fmt: (v) => `araba başı ${v} ₺` };
UPG.evPay = { name: 'Şarj tarifesi', icon: '⚡', req: 'koy', need: ['e1', 'e2'], lock: 'Şarj noktası açılınca', mod: true, values: [1, 1.15, 1.3, 1.5], costs: [400, 800, 1400], fmt: xf('şarj ücreti') };
UPG.trGrow = { name: 'Gübre', icon: '🌱', req: 'tarlalar', mod: true, values: [1, 1.25, 1.5, 1.8], costs: [500, 1000, 1700], fmt: xf('tarla büyümesi') };
// kamyon kapasitesi (2026-11-04 kullanıcı: "şehir marketine gelen ürünler yetersiz oluyor, gelen ürünleri arttırma seçeneği oluştur"):
// köy kamyonu, hal ve toptancı kamyonu sefer başı bu kadar fazla ürün getirir; depo ve paletler de büyür (city.js truckBonus)
UPG.ctCap = { name: 'Kamyon kapasitesi', icon: '🚚', req: 'sehir', mod: true, values: [0, 6, 12, 20, 28], costs: [1500, 3000, 5000, 8000], fmt: (v) => (v ? `sefer başı +${v} ürün` : 'ek ürün yok'), desc: 'Köy kamyonu, hal ve toptancı kamyonu bir seferde daha çok ürün getirir; depo ve paletler de büyür' };
// bölge kasiyerleri: her para tezgahına ayrı işe alınır; tezgahın arkasında durur, biriken parayı birkaç saniyede bir
// hesaba yatırır (tezgahtar kendiliğinden gelmez; game.js MoneyPile.spot)
const DESKS = [
  { id: 'ka_sahil', area: 'sahil', name: 'Büfe kasadarı', cost: 550, req: 'sahil', pile: () => G.regions.sahil.pile },
  { id: 'ka_han', area: 'han', name: 'Hancı', cost: 650, req: 'han', pile: () => G.regions.han.pile },
  { id: 'ka_iskele', area: 'iskele', name: 'Balıkçı kasadarı', cost: 600, req: 'iskele', pile: () => G.fish && G.fish.pile },
  { id: 'ka_pazar', area: 'pazar', name: 'Pazar kasadarı', cost: 500, req: 'pazar', pile: () => G.regions.pazar.pile }, // 2026-11-06 kullanıcı: "kasasında kasiyer yok"
];
for (const d of DESKS) UPG[d.id] = { name: d.name, icon: '🧾', hire: [d.cost], req: d.req, need: d.need, lock: d.lock, desc: 'Kasadar: tezgahın başında durur, biriken parayı hırsıza karşı korur (hırsız o kasaya gelmez); parayı yine sen ya da muhasebeci toplarsın' };
UPG.a_inek = { name: 'İnekler', icon: '🐄', animal: 'sut', lock: 'Ahır açılınca', values: [2, 3, 4], costs: [500, 1000], fmt: (v) => `${v} inek` };
// şehir marketinin kasası kasiyersiz kurulur; kasiyer burada işe alınır (city.js addCashier)
UPG.mcashier = { name: 'Market kasiyeri', icon: '🧾', hire: [1200, 2400], req: 'sehir', slots: () => (G.regions.sehir.registers || [1]).length, lock: 'İkinci kasa açılınca', desc: 'Şehir marketinin kasasında ödemeleri senin yerine alır' };
// Kasaba Meydanı sahnesi (expand-east.js gösteri): sanatçı yoksa sahne boş kalır; gişe görevlisi yoksa bileti oyuncu gişede satar
UPG.artist = { name: 'Sanatçı', icon: '🎤', hire: [1500, 2400, 3200], req: 'kasaba', need: ['xkasaba3'], lock: 'Konser Alanı açılınca', desc: 'Sahnede konser ve tiyatro verir; her gösteriye seyirci gelir, bilet parası gişede birikir. Her sanatçı seyirciyi ve bileti artırır' };
UPG.ticket = { name: 'Gişe görevlisi', icon: '🎟️', hire: [900], req: 'kasaba', need: ['xkasaba3'], lock: 'Konser Alanı açılınca', desc: 'Gişede bilet satar; yokken bileti sen gişede durarak satarsın' };
// bölüm görevlisi (2026-10-28 kullanıcı: "yeni bölümlerin içi boş kalıyor, çalışan eklenemiyor"): her bölgenin kendi taşıyıcısı.
// [ad, gömlek rengi, ne yapar, gereken bölüm]
const ATT = {
  tarla: ['Tarlacı', '#6aa84f', 'Köy tarlalarının koçanını büfenin kazanına, buğdayını değirmene ve ambara taşır'],
  mera: ['Çoban', '#8a6d3b', 'Meranın yününü, koyun sütünü ve yoğurdunu taşır; mahzeni ve sağımhaneyi besler'],
  atolye: ['Kalfa', '#b23a48', 'Yeni tezgahlara yün ve kilim getirir, dokunanları satış yerine götürür'],
  atlar: ['Ahır çırağı', '#8a5a33', 'Saman tarlasının buğdayını harmana, balkabağını satış yerine taşır'],
  ciftlik: ['Çiftçi', '#3d7dd8', 'Kümeslerin yumurtasını, kovanların balını, ahırın sütünü gerektiği yere taşır'],
  pazar: ['Pazar çırağı', '#f6c343', 'Pazar bostanının sebzesini tezgaha, turşucuya salatalık taşır'],
  han: ['Han çırağı', '#3aa6a0', 'Güveç ocağına ve hanın makinelerine malzeme getirir, ürünü kervana hazırlar'],
  firin: ['Fırın çırağı', '#e8b04a', 'Pide fırınına ve fırınlara un taşır, değirmene buğday getirir'],
  kasaba: ['Çiçekçi', '#e86a9a', 'Bahçeden kesme çiçek toplar, buket masasına bırakır, buketi vitrine dizer', ['xkasaba2']],
  sehir: ['Reyon görevlisi', '#e8604c', 'Tost büfesine ekmek getirir, ürünleri reyonlara taşır', ['xsehir2']],
  iskele: ['Balıkçı çırağı', '#2f6db5', 'İskelenin balığını ızgaraya ve çorba kazanına taşır'],
  tarlalar: ['Rençper', '#9b6a3e', 'Büyük tarlaların hasadını değirmene, kazana ve ambara taşır'],
};
// çırak (bölüm görevlisi) bölgesinin asıl elemanından ucuzdur (2026-11-08 kullanıcı: "çırak tezgahçıdan pahalı olmamalı"; eskiden hepsi 700)
const ATT_HIRE = { tarla: [350, 700], mera: [450, 850], atolye: [450, 850], atlar: [450, 900], ciftlik: [400, 800], pazar: [250, 550], han: [700, 1300], firin: [550, 1000], kasaba: [500, 950], sehir: [900, 1800], iskele: [550, 1000], tarlalar: [450, 850] };
for (const [r, [name, , desc, need]] of Object.entries(ATT)) {
  UPG[`att_${r}`] = { name, icon: '🧺', hire: ATT_HIRE[r], most: 2, req: r, ...(need ? { need, lock: 'Bölüm açılınca' } : {}), desc: `Bölüm görevlisi: ${desc}` };
  UPG[`atC_${r}`] = { name: `${name} kapasitesi`, parent: `att_${r}`, values: [3, 4, 6], costs: [250, 500], fmt: pcs };
  UPG[`atS_${r}`] = { name: `${name} hızı`, parent: `att_${r}`, values: [2.6, 3.1, 3.6], costs: [250, 500], fmt: mps };
}
// zorluk (2026-10-27): işe alım ve eleman yükseltmeleri %30 pahalı; maaş ve tazminat işe alım bedelinden hesaplandığı için onlar da artar
const dear = (v) => Math.round((v * 1.3) / 10) * 10;
for (const u of Object.values(UPG)) {
  if (u.hire) u.hire = [].concat(u.hire).map(dear);
  else if (u.parent && UPG[u.parent].hire && u.costs) u.costs = u.costs.map(dear);
}
const ORDER = Object.keys(UPG);
// kadro: seviyeye göre toplam eleman sınırı; hangi işe kaç kişi alınacağına oyuncu karar verir (aynı işten birden çok da olur)
// 11. seviyeden sonra her seviye +2 kişi: geç oyunda bölge ve kasa sayısı arttıkça kadro da büyür (24. seviyede 52)
const STAFF_CAP = [2, 2, 3, 4, 6, 8, 10, 12, 15, 18, 22, 26];
const hireIds = () => Object.keys(UPG).filter((k) => UPG[k].hire);
const staffCap = () => { const l = G.level || 1, top = STAFF_CAP.length - 1; return (l <= top ? STAFF_CAP[l] : STAFF_CAP[top] + (l - top) * 2) + (G.kadroBonus || 0); }; // + başarım ödülü (menu.js)
const staffCount = () => hireIds().reduce((n, k) => n + (G.upg[k] || 0), 0);
const hireCost = (id, n) => [].concat(UPG[id].hire)[n] || 0;
const fireFee = (id) => Math.round(hireCost(id, Math.max(0, (G.upg[id] || 1) - 1)) / 2); // tazminat: işe alım bedelinin yarısı
// maaş: her eleman dakikada işe alım bedelinin %2,5'i (en az 2 ₺); dakikada bir hesaptan düşer
const wageOf = (k, n) => Math.max(2, Math.round(hireCost(k, n) * 0.025));
const wageTotal = () => hireIds().reduce((t, k) => { for (let n = 0; n < (G.upg[k] || 0); n++) t += wageOf(k, n); return t; }, 0);
// ödenen maaş: işi yokken boşta bekleyen eleman o sürenin yarı maaşını alır (2026-11-02 ekonomi: kadronun boş duran kısmı kazancın
// büyük kısmını yiyordu; gösteri arası sanatçı, çöp yokken çöpçü, kervan yokken kâhya). Kuyruk bekleyen kasiyer, kuledeki cankurtaran boşta sayılmaz
function wagePaid() {
  let t = 0;
  for (const k of hireIds()) {
    const list = G.staff[k] || [];
    for (let n = 0; n < (G.upg[k] || 0); n++) {
      const w = list[n], f = w && w.payT > 0 ? Math.min(1, (w.idleT || 0) / w.payT) : 0;
      t += wageOf(k, n) * (1 - 0.5 * f);
      if (w) w.payT = w.idleT = 0;
    }
  }
  return Math.round(t);
}
let wageT = 0;
// işe alım → { sınıf, kapasite yükseltmesi, hız yükseltmesi } (dosya sonunda doldurulur)
const STAFF = {};

// eleman yükseltmeleri her elemana ayrı: 'shCap@1' = 2. rafçının kapasite seviyesi. Ortak 'shCap' artık kullanılmaz
// (eski kayıtlarda varsa initUpgrades her elemana o seviyeyi verir)
const split = (id) => { const i = id.indexOf('@'); return i < 0 ? [id, -1] : [id.slice(0, i), +id.slice(i + 1)]; };
const def = (id) => UPG[split(id)[0]];
const lvl = (id) => G.upg[id] || 0;
const val = (id) => def(id).values[lvl(id)];
const hireMax = (id) => [].concat(UPG[id].hire).length;
// yeni alımda en çok kaç kişi (solo/most); kayıttan gelen fazlası kalır, kayıt sınırı hireMax
const hireCap = (id) => (UPG[id].solo ? 1 : Math.min(UPG[id].most || 99, hireMax(id)));
const perWorker = (k) => !!(UPG[k].parent && UPG[UPG[k].parent].hire);
const subsOf = (hid) => ORDER.filter((k) => UPG[k].parent === hid);
// işe alınmış her elemanın kendi yükseltme anahtarları
const workerKeys = () => ORDER.filter(perWorker).flatMap((k) => Array.from({ length: G.upg[UPG[k].parent] || 0 }, (_, n) => `${k}@${n}`));
const allIds = () => [...ORDER.filter((k) => !perWorker(k)), ...workerKeys()];
// çok basamaklı yükseltmeler (eleman hızı ve kapasitesi, makine, bölge geliştirmesi) her basamakta ayrıca %40 pahalanır:
// ilk basamak eskisi gibi, üçüncüsü ~2 kat, beşincisi ~3,8 kat (2026-11-01)
const STEEP = 1.4;
// işe alım ücreti (2026-11-08 kullanıcı: "eleman işe alma ücretlerini kontrol et yükselt"): yalnız işe alırken ödenen bedel iki katı. Maaş ve
// tazminat hireCost'tan eski tabanla kalır: maaş da artsaydı gelirin yarısından çoğunu zaten yiyen kadro oyunu sıkardı (fiyat.js ölçümü)
const HIRE_K = 2;
// kademeli fiyat (fiyat.js, 2026-11-05): geç açılan bölgenin elemanı, makinesi ve geliştirmesi o bölgenin kademesiyle pahalanır;
// oyuncunun kendi yükseltmeleri ve köy ×1 (fiyatlar eskisi gibi). Maaş ve tazminat hireCost'tan, çarpansız
const tierUp = (u) => { const p = u.parent ? UPG[u.parent] : u, m = u.machine; return tierOf(m ? m.exp || m.region : u.rack || p.req || 'koy'); };
function cost(id) {
  const u = def(id), l = lvl(id), k = tierUp(u);
  if (u.flat) return l >= u.values.length - 1 ? null : u.costs[l];
  // solo: yeni alımda tek kişi, most: en çok bu kadar (2026-10-28 denetimi: ikinci kişi çoğu zaman boştaydı); eski kayıttakiler kalır
  if (u.hire) return l < hireCap(id) ? (k > 1 ? nice([].concat(u.hire)[l] * PRICE_K * HIRE_K * k) : [].concat(u.hire)[l] * PRICE_K * HIRE_K) : null; // fiyat çarpanı (game.js); maaş hireCost'tan, çarpansız
  if (l >= u.values.length - 1) return null;
  const c = u.costs[l] * PRICE_K * (u.steep ?? STEEP) ** l;
  return k > 1 ? nice(c * k) : Math.round(c / 10) * 10;
}
function available(id) {
  const u = def(id), n = split(id)[1];
  if (u.parent) return n >= 0 && G.upg[u.parent] > n; // yalnızca işe alınmış o eleman için
  if (!areaGate(id)) return false; // sekmesinin bölgesi açılmadan alınmaz
  if (u.slots && G.upg[id] >= u.slots()) return false; // ör. her kuleye bir cankurtaran
  if (u.req) return G.regions[u.req].unlocked && (!u.need || u.need.some((k) => G.unlocked.has(k)));
  if (u.machine) return !!genOf(u.machine);
  if (u.animal) return !!G.regions.koy.gens[u.animal];
  if (u.shelf) return !!G.regions.koy.shelfByType[u.shelf];
  if (u.rack) return racksOf(u.rack).length > 0;
  return true;
}

function apply(id, fresh) {
  const u = def(id);
  if (u.mod) { (G.mods || (G.mods = {}))[id] = val(id); return; } // bölge geliştirmesi: ilgili dosya G.mods'tan okur
  if (u.machine) {
    const g = genOf(u.machine), mid = u.machine.id;
    if (!g) return;
    g.interval = g.baseInterval * UPG[`ms_${mid}`].values[G.upg[`ms_${mid}`]];
    g.max = g.baseMax + UPG[`mc_${mid}`].values[G.upg[`mc_${mid}`]];
    return;
  }
  if (u.shelf) {
    const K = G.regions.koy;
    K.wantTiers = K.wantTiers || {};
    K.wantTiers[u.shelf] = val(id);
    for (const t of u.shelf === 'sut' ? ['sut', 'peynir', 'ksut', 'yogurt'] : [u.shelf]) { const sh = K.shelfByType[t]; if (sh) sh.setTiers(val(id), !fresh); }
    return;
  }
  if (u.rack) { for (const sh of racksOf(u.rack)) sh.setStack(val(id)); return; }
  if (id === 'sulama') { for (const b of G.regions.koy.beds) b.grow = b.baseGrow * val('sulama'); return; }
  if (id === 'a_tavuk') { G.regions.koy.setChickens(val('a_tavuk'), !fresh); return; }
  if (id === 'a_inek') { G.regions.koy.setCows(val('a_inek'), !fresh); return; }
  if (id === 'cap') { G.stack.cap = val('cap'); return; }
  if (id === 'spd') { G.speedMul = val('spd'); return; }
  const s = STAFF[id];
  if (s) {
    if (!G.regions[UPG[id].req].unlocked) return;
    const list = G.staff[id] || (G.staff[id] = []);
    while (list.length < G.upg[id]) {
      const n = list.length;
      list.push(new s.cls(fresh, n));
      for (const k of subsOf(id)) apply(`${k}@${n}`, fresh); // yeni eleman kendi seviyeleriyle başlar
    }
    return;
  }
  const [sub, n] = split(id);
  if (n < 0 || !u.parent) return;
  const hid = u.parent, w = (G.staff[hid] || [])[n];
  if (!w) return;
  if (sub === 'cashSpd') w.interval = val(id);
  else if (sub === 'gDog') w.setDog(val(id) > 0, fresh);
  else if (STAFF[hid].cap === sub) { w.stack.cap = val(id); if (w.setCart) w.setCart(val(id) > 6); }
  else if (STAFF[hid].spd === sub) w.speed = val(id);
}

const CAP_OLD = [40, 250, 1200, 4500, 12000, 30000]; // taşıma kapasitesinin kalkan 9. ve 10. basamaklarının eski fiyatları (iade)
export function initUpgrades(saved) {
  G.hooks.upgCost = cost; // hedef kartı (sart.js)
  G.staff = {};
  const capMax = UPG.cap.values.length - 1;
  if (saved && typeof saved.cap === 'number' && saved.cap > capMax) {
    let back = 0;
    for (let l = capMax; l < Math.min(saved.cap, CAP_OLD.length); l++) back += Math.round((CAP_OLD[l] * PRICE_K) / 10) * 10;
    G.money += back;
    setTimeout(() => toast(`🎒 Taşıma kapasitesi en çok 8 oldu: ${back.toLocaleString('tr-TR')} ₺ iade edildi`), 2500);
  }
  for (const k of ORDER) {
    const max = UPG[k].hire ? hireMax(k) : UPG[k].values.length - 1;
    G.upg[k] = saved && typeof saved[k] === 'number' ? Math.max(0, Math.min(saved[k], max)) : (G.upg[k] || 0);
  }
  for (const k of ORDER.filter(perWorker)) {
    const u = UPG[k], shared = G.upg[k] || 0; // eski kayıt: tek ortak seviye → her elemana aynısı
    for (let n = 0; n < hireMax(u.parent); n++) {
      const key = `${k}@${n}`, s = saved && saved[key];
      G.upg[key] = typeof s === 'number' ? Math.max(0, Math.min(s, u.values.length - 1)) : n < G.upg[u.parent] ? shared : 0;
    }
    G.upg[k] = 0;
  }
  for (const k of ORDER) apply(k, false);
  buildMenu();
}

// yeteneğin bu basamağının elması (yoksa 0)
const gemOf = (id) => { const u = def(id); return (u.gem && u.gem[lvl(id)]) || 0; };
const gemsHave = () => G.stats.elmas || 0;
function buy(id) {
  const c = cost(id), g = gemOf(id);
  if (c == null || !available(id) || G.money < c || G.visit) { sfx('bad'); feel('bad'); return; }
  if (gemsHave() < g) { sfx('bad'); feel('bad'); toast(`💎 ${g} elmas gerekiyor, sende ${gemsHave()} var. Elmas günlük görevlerden gelir.`); return; }
  if (def(id).hire && staffCount() >= staffCap()) { sfx('bad'); toast(`👥 Kadro dolu (${staffCount()}/${staffCap()}): seviye atla ya da birini işten çıkar`); return; }
  G.money -= c;
  if (g) { G.stats.elmas -= g; floatText(G.player.position.clone().setY(2.4), `💎 -${g}`, 'neg'); }
  G.upg[id] = lvl(id) + 1;
  apply(id, true);
  if (id === 'rafTakip') { banner('YENİ SİSTEM', '📋 Raf takip sistemi'); G.rtNew = true; } // raftakip.js düğmeyi parlatır, nerede olduğunu söyler
  if (def(id).skill) banner('YENİ YETENEK', `${def(id).icon} ${def(id).name}${lvl(id) > 1 ? ` · ${lvl(id)}. seviye` : ''}`);
  if (def(id).hire) {
    banner(say('hire').toLocaleUpperCase('tr'), `${UPG[id].name}${G.upg[id] > 1 ? ` ${G.upg[id]}` : ''} işe başladı`);
    sfx('hire');
    const list = G.staff[id], w = list && list[list.length - 1];
    if (w) confetti(w.obj.position, 30);
    feel('hire');
  } else { sfx('buy'); feel('buy', G.player.position); }
  save();
  render();
}
// işten çıkarma: en son işe alınan ayrılır, tazminatı (işe alım bedelinin yarısı) hesaptan ödenir; yeri kadroda boşalır
function fire(id) {
  const n = G.upg[id] || 0;
  if (!n) return;
  const fee = fireFee(id);
  if (G.money < fee) { sfx('bad'); toast(`Tazminat için ${fee} ₺ gerekiyor`); return; }
  G.money -= fee; G.stats.lost = (G.stats.lost || 0) + fee;
  const w = (G.staff[id] || []).pop();
  if (w) w.dispose();
  for (const k of subsOf(id)) G.upg[`${k}@${n - 1}`] = 0;
  G.upg[id] = n - 1;
  banner('İŞTEN ÇIKARILDI', `${UPG[id].name}${n > 1 ? ` ${n}` : ''} · tazminat ${fee} ₺`);
  sfx('bad');
  save();
  render();
}

// ---------- elemanlar ----------
// Tezgahta biriken parayı elemanlar hesaba aktarmaz: oyuncu yanına gidip toplar ya da muhasebeci toplayıp bankaya yatırır (account.js)

class Worker {
  constructor(look, tag, pos, fresh, cap) {
    this.obj = M.makeCharacter(look);
    this.obj.position.copy(pos);
    G.scene.add(this.obj);
    if (fresh) popIn(this.obj);
    this.moving = false; this.state = 'decide'; this.t = 0; this.path = []; this.target = null;
    if (cap) this.stack = new Stack(this.obj, cap, 0.95, 0.45);
    const el = document.createElement('div');
    el.className = 'staff';
    el.textContent = tag;
    this.tag = G.labels.add(el, (v) => v.copy(this.obj.position).setY(this.obj.position.y + 2.3));
    G.workers.push(this);
  }
  walkTo(d, dt, speed) {
    const p = this.obj.position;
    const dx = d.x - p.x, dz = d.z - p.z, dist = Math.hypot(dx, dz);
    const st = speed * dt * (this.riding && G.hooks.crossK && dist > 0.01 ? G.hooks.crossK(p, dx / dist, dz / dist) : 1); // motorlu kurye geçitte (roads.js)
    if (dist <= st) { p.x = d.x; p.z = d.z; return true; }
    p.x += (dx / dist) * st; p.z += (dz / dist) * st;
    this.obj.rotation.y = lerpAngle(this.obj.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
    this.moving = true;
    return false;
  }
  // yol noktalarını sırayla yürür, önü kapalıysa (bina, çit, duvar) dolanır; bitince true
  walkPath(dt, speed) {
    while (this.path.length) {
      if (this.path[0] !== this.leg) {
        const r = findRoute(this.obj.position, this.path[0]);
        if (r.length > 1) { r.pop(); this.path.unshift(...r); }
        this.leg = this.path[0];
      }
      if (!this.walkTo(this.path[0], dt, speed)) return false;
      this.path.shift();
    }
    return true;
  }
  go(state, target, ...pts) { this.state = state; this.target = target; this.path = pts; this.t = 0; }
  // boşta bekleme: birkaç rastgele noktadan diğer elemanlara en uzak olanı seçer, üst üste durmazlar.
  // Alanın içindeyse çoğu zaman yerinde bekler; yürürse süre varınca başlar. 2026-11-04 kullanıcı: "çiçekçi 2 takılmış etrafında
  // dönüp duruyor": süre yürürken doluyordu, eleman varmadan yeni nokta seçip küçük alanda durmadan dönüyordu
  idle(x0, x1, z0, z1, secs = 1.5) {
    const p = this.obj.position, near = (q) => G.workers.some((w) => w !== this && Math.hypot(w.obj.position.x - q.x, w.obj.position.z - q.z) < 1.1);
    if (p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1 && !near(p) && Math.random() < 0.75) { this.go('idle', null); this.t = secs; return; }
    let best = null, bd = -1;
    for (let k = 0; k < 6; k++) {
      const q = V(rand(x0, x1), 0, rand(z0, z1));
      const d = G.workers.reduce((m, w) => (w === this ? m : Math.min(m, Math.hypot(w.obj.position.x - q.x, w.obj.position.z - q.z))), 9);
      if (d > bd) { bd = d; best = q; }
    }
    this.go('idle', null, best); this.t = secs + Math.hypot(best.x - p.x, best.z - p.z) / (this.speed * 0.6);
  }
  // işten çıkarılınca sahneden ve üstlendiği işlerden ayrılır; yarım kalan işi başkası alır
  dispose() {
    if (this.stack) for (const it of this.stack.items) if (it.obj.parent) it.obj.parent.remove(it.obj);
    G.scene.remove(this.obj); G.labels.remove(this.tag);
    if (this.dog) G.scene.remove(this.dog);
    if (this.donkey) G.scene.remove(this.donkey);
    if (this.bike) G.scene.remove(this.bike);
    if (this.bag > 0) { G.money += Math.floor(this.bag); this.bag = 0; } // muhasebecinin taşıdığı para kaybolmaz
    if (this.col) { const i = G.colliders.indexOf(this.col); if (i >= 0) G.colliders.splice(i, 1); }
    const i = G.workers.indexOf(this); if (i >= 0) G.workers.splice(i, 1);
    const K = G.regions.koy, T = G.regions.tatil;
    for (const r of K.registers || [K.register]) if (r && r.cashier === this) r.cashier = null;
    for (const q of G.requests || []) if (q.by === this) q.by = null;
    for (const c of G.customers) if (c.rescuer === this) c.rescuer = null;
    for (const st of G.stations) if (st.clerk === this.obj) st.clerk = null;
    if (T && T.houses) for (const h of T.houses) if (h.cleaner === this) h.cleaner = null;
    if (G.fish && G.fish.boat && G.fish.boat.busy === this) G.fish.boat.busy = null;
    this.gone = true;
  }
  // makine besleme: elindeki ham maddeyi makinenin masasına koyar; yoksa girdisi azalan makine için tarladan/ahırdan toplar
  feed(jobs) {
    jobs = jobs.filter((j) => j.conv);
    const put = jobs.find((j) => this.stack.count(j.conv.inType) > 0 && j.conv.input.length < j.conv.cap);
    if (put) { this.go('feed', put.conv, V(put.conv.zone.x + rand(-0.4, 0.4), 0, put.conv.zone.z)); return true; }
    if (this.stack.full) return false;
    const p = this.obj.position, d = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
    const busy = (c) => G.workers.some((w) => w !== this && w.state === 'harvest' && w.feedConv === c);
    for (const j of jobs.sort((a, b) => a.conv.input.length - b.conv.input.length)) {
      if (j.conv.input.length >= j.conv.cap - 1 || busy(j.conv)) continue;
      const src = j.srcs.filter((s) => s && s.avail() > 0).sort((a, b) => d(a) - d(b))[0];
      if (!src) continue;
      this.feedType = j.conv.inType; this.feedConv = j.conv;
      this.feedN = this.stack.count(this.feedType) + Math.min(j.conv.cap - j.conv.input.length, this.stack.cap - this.stack.items.length);
      this.go('harvest', src, V(src.zone.x + rand(-0.6, 0.6), 0, src.zone.z + rand(-0.3, 0.3)));
      return true;
    }
    return false;
  }
  // ortak durumlar: hedefe yürü → her `every` saniyede `act` çağır, false dönünce karar ver
  step(dt, acts) {
    if (this.state === 'decide') { this.decide(); return; }
    if (this.state === 'idle') {
      this.walkPath(dt, this.speed * 0.6);
      this.t -= dt;
      if (this.t <= 0) this.state = 'decide';
      return;
    }
    const a = acts[this.state];
    if (!a) { this.state = 'decide'; return; }
    if (this.path.length) { this.walkPath(dt, this.speed); return; }
    this.t += dt;
    if (this.t >= a.every) { this.t = 0; if (!a.act()) this.state = 'decide'; }
  }
  finish(dt) {
    const p = this.obj.position, lp = this.lp || (this.lp = p.clone());
    const v = dt > 0 ? Math.hypot(p.x - lp.x, p.z - lp.z) / dt : 0; lp.copy(p);
    p.y += (heightAt(p.x, p.z) - p.y) * Math.min(1, dt * 12);
    // adım hızı yürüyüş hızına göre (2,6 m/sn tam adım): boşta yavaş yürürken ayaklar kaymasın
    M.animateCharacter(this.obj, this.moving ? Math.max(0.1, Math.min(1, (v / 2 - 0.6) / 0.7)) : 0, dt, !!this.stack && this.stack.items.length > 0);
    if (this.stack) this.stack.update(dt);
  }
  update(dt) {
    this.moving = false;
    this.step(dt, this.acts);
    this.finish(dt);
  }
}

const freeReg = () => { const K = G.regions.koy; return (K.registers || [K.register]).find((r) => r && !r.cashier); };
class Cashier extends Worker {
  constructor(fresh) {
    // boş kasaya geçer (ikinci kasa açıksa ikinci kasiyer oraya); bankonun güneyinde, içeri (raflara) bakar; dükkân büyüyünce yeri
    // taşınır (world.js placeRegister)
    const K = G.regions.koy, reg = freeReg() || K.register, z = reg.zone;
    super({ shirt: '#f28db2', pants: '#4a5568', hat: 'cap', hatColor: '#e8604c', skin: '#eec39a' }, 'Kasiyer', V(z.x, 0.2, z.z), fresh);
    this.interval = 1.0;
    this.reg = reg; reg.cashier = this;
  }
  update(dt) {
    // kayıt açılırken ikinci kasa sonradan kurulursa (kilit kk2), birinci kasada açıkta kalan kasiyer boş kasaya geçer
    if (this.reg.cashier !== this) { const r = freeReg(); if (r) { this.reg = r; r.cashier = this; this.obj.position.set(r.zone.x, 0.2, r.zone.z); } }
    this.obj.rotation.y = lerpAngle(this.obj.rotation.y, Math.PI, Math.min(1, dt * 6));
    M.animateCharacter(this.obj, 0, dt, false);
    M.workMotion(this.obj, 'kasa', dt, this.reg.queue && this.reg.queue.length > 0); // yazarkasaya basar, parayı sayar
  }
}
// şehir marketinin kasiyeri: kasada durur, yürümez; modelini ve kasayı city.js kurar ve canlandırır
class MarketCashier {
  constructor(fresh) { this.R = G.regions.sehir; this.e = this.R.addCashier(!fresh); this.obj = this.e.o; }
  dispose() { this.R.removeCashier(this.e); this.gone = true; }
}

// Köy: bostan, kümes, ahır, mandıra → raflar ve mandıra girdisi
class Shelver extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#9c8cf0', pants: '#3d4f7a', hat: 'cap', hatColor: '#ffffff', skin: '#f6d2b0' }, n ? `Rafçı ${n + 1}` : 'Rafçı', V(2.5 + n * 1.2, 0, -2.8), fresh, 3);
    this.speed = 2.6;
    this.acts = {
      take: { every: 0.25, act: () => (this.takeMax == null || this.stack.count(this.target.type) < this.takeMax) && this.target.give(this.stack) },
      put: { every: 0.22, act: () => this.target.putFrom(this.stack) },
      car: { every: 0.15, act: () => this.target.deliverFrom(this.stack) },
      // üretim (Worker.feed): makinenin ham maddesini toplar, makineye bırakır
      harvest: { every: 0.25, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
      feed: { every: 0.2, act: () => this.target.putFrom(this.stack) },
    };
  }
  // rafların yer ayırdığı ürünler → raftaki adet (yalnızca yeri olanlar)
  shelfNeeds() {
    const R = G.regions.koy, n = {};
    for (const t in ITEMS) if (R.shelves.some((s) => s.hasSpaceFor(t))) n[t] = R.shelves.reduce((k, s) => k + s.count(t), 0);
    return n;
  }
  // rafta azalan ve hazırı hiçbir yerde olmayan ürün bir makinede yapılıyorsa (yoğurt küpü, mandıra) ham maddesini
  // kaynağından toplayıp makineye götürür; ürün çıkınca sourceFor onu rafa taşır
  produce() {
    if (this.stack.full) return false;
    const need = this.shelfNeeds(), ready = (t) => srcFor(t).some((s) => s && !s.paid && s.avail() > 0);
    for (const t of Object.keys(need).sort((a, b) => need[a] - need[b])) {
      if (need[t] >= 2 || this.stack.count(t) || ready(t)) continue;
      const conv = G.stations.find((s) => s.out && s.inType && s.out.type === t);
      if (!conv || conv.input.length >= 2 || (G.staff.shelver || []).some((w) => w !== this && w.prod)) continue; // ekipten yalnız biri üretime gider
      if (G.staff.baker && G.staff.baker.length && ownedByBaker(conv)) continue; // fırının ununu fırıncı taşır
      this.prod = conv;
      if (this.feed([{ conv, srcs: srcFor(conv.inType).filter((s) => s && !s.paid) }])) return true;
      this.prod = null;
    }
    return false;
  }
  // arabada bekleyen sipariş (paket servis ya da otopark): eksikleri, başka rafçının elindekiler düşülerek
  carJob() {
    const R = G.regions.koy, p = this.obj.position, jobs = [];
    if (R.cars && R.cars.state === 'wait') jobs.push({ order: R.cars.order, target: R.cars.drop, zone: R.cars.drop.zone });
    if (R.lot) for (const s of R.lot.spots) if (s.pc && s.pc.state === 'service') jobs.push({ order: s.pc.order, target: s.pc, zone: s.pc.drop.zone });
    jobs.sort((a, b) => Math.hypot(a.zone.x - p.x, a.zone.z - p.z) - Math.hypot(b.zone.x - p.x, b.zone.z - p.z));
    for (const j of jobs) {
      j.left = {};
      for (const k in j.order) j.left[k] = j.order[k].need - j.order[k].got;
      for (const w of [...(G.staff.shelver || []), ...(G.staff.courier || [])]) {
        if (w === this) continue;
        if (w.state === 'take' && w.carTarget === j.target && j.left[w.carType] > 0) { j.left[w.carType] = Math.max(0, j.left[w.carType] - w.carN); continue; }
        if (w.state !== 'car' || w.target !== j.target) continue;
        for (const it of w.stack.items) if (j.left[it.type] > 0) j.left[it.type]--;
      }
      if (Object.values(j.left).some((n) => n > 0)) return j;
    }
    return null;
  }
  // süt önce mandırayı besler (peynir daha değerli), sonra dolaba gider
  sinkFor(types) {
    const R = G.regions.koy, d = R.dairy;
    if (d && types.includes(d.inType) && d.input.length < 3) return d;
    const p = this.obj.position, far = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
    let best = null; // elindeki ürünlerden birine yeri olan en yakın raf: karışık yükü sırayla, geri dönmeden dizer
    for (const s of R.shelves) if (types.some((t) => s.hasSpaceFor(t)) && (!best || far(s) < far(best))) best = s;
    return best || (d && types.some((t) => d.hasSpaceFor(t)) ? d : null);
  }
  // en yakın değil en çok ihtiyaç duyulan: bekleyen müşteri öne alınır, dolu raf ve aynı ürünü üst üste taşımak geri itilir
  sourceFor() {
    const R = G.regions.koy, p = this.obj.position;
    const waiting = {};
    for (const c of G.customers) if (c.region === 'koy' && c.state === 'shelf') waiting[c.want] = (waiting[c.want] || 0) + 1;
    const fill = (t) => R.shelves.reduce((n, s) => n + s.count(t), 0);
    // başka rafçının gittiği kaynak geri itilir: ekip aynı bostana yığılmasın
    const taken = (s) => (G.staff.shelver || []).filter((w) => w !== this && w.state === 'take' && w.target === s).length;
    const score = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z) - (waiting[s.type] || 0) * 8 + fill(s.type) * 3 - (fill(s.type) ? 0 : 12) - ITEMS[s.type].price * 0.4 + (s.type === this.last ? 4 : 0) + taken(s) * 6 + (s.paid ? 10 : 0); // rafta hiç kalmayan ve değerli ürün öne (uzaktaki kilim de sıra bulur), parayla alınan geride
    const remote = [];
    for (const t of Object.keys(this.shelfNeeds())) for (const s of srcFor(t)) {
      if (!s) continue;
      if (!s.paid) { if (s.type) remote.push(s); } else if (G.money > 200) remote.push({ ...s, type: t }); // toptancıdan alıp rafta satar (yalnızca para varken)
    }
    const srcs = [...new Set([...R.beds, ...Object.values(R.gens), ...remote])].filter((s) => s.avail() > 0 && this.sinkFor([s.type]));
    srcs.sort((a, b) => score(a) - score(b));
    if (srcs[0]) this.last = srcs[0].type;
    return srcs[0];
  }
  // 4 m içindeki, elde olmayan, rafında yeri olan ve başka rafçının gitmediği ürün kaynağı (parayla alınan hariç)
  nearbySource(types) {
    const R = G.regions.koy, p = this.obj.position;
    const busy = (s) => (G.staff.shelver || []).some((w) => w !== this && w.state === 'take' && w.target === s);
    let best = null, bd = 4;
    for (const s of [...R.beds, ...Object.values(R.gens)]) {
      if (!s || !s.type || types.includes(s.type) || s.avail() < 2 || busy(s)) continue;
      const d = Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
      if (d < bd && R.shelves.some((sh) => sh.hasSpaceFor(s.type) && sh.slots.filter((x) => !x).length >= 2)) { bd = d; best = s; }
    }
    return best;
  }
  // arabada bekleyen müşteri önce gelir: siparişin ürünü eldeyse arabaya götür, yoksa kaynağından al. İş varsa true
  carStep() {
    const job = this.carJob();
    if (!job) return false;
    if (this.stack.items.some((i) => job.left[i.type] > 0)) { this.go('car', job.target, V(job.zone.x + rand(-0.3, 0.3), 0, job.zone.z + rand(-0.3, 0.3))); return true; }
    if (this.stack.full) return false;
    const R = G.regions.koy, p = this.obj.position, d = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
    const src = [...R.beds, ...Object.values(R.gens)].filter((s) => job.left[s.type] > 0 && s.avail() > 0).sort((a, b) => d(a) - d(b))[0];
    if (!src) return false;
    // yalnızca siparişin eksiği kadar alır; takım arkadaşı aynı eksik için yola çıkmasın diye işaretlenir
    this.carTarget = job.target; this.carType = src.type; this.carN = Math.min(job.left[src.type], this.stack.cap - this.stack.items.length);
    this.takeMax = this.stack.count(src.type) + this.carN;
    this.go('take', src, V(src.zone.x + rand(-0.6, 0.6), 0, src.zone.z + rand(-0.3, 0.3)));
    return true;
  }
  decide() {
    // servis elemanı varsa arabalar onun işi; rafçı raflara bakar
    this.takeMax = null; this.carTarget = null;
    if (!(G.staff.courier && G.staff.courier.length) && this.carStep()) return;
    // üretimdeyse elindeki ham maddeyi (ör. koyun sütü) makineye bırakır
    const P = this.prod;
    if (P && this.stack.count(P.inType) && P.input.length < P.cap) return this.go('feed', P, V(P.zone.x + rand(-0.4, 0.4), 0, P.zone.z));
    this.prod = null;
    const types = this.stack.items.map((i) => i.type);
    // elinde rafa gidecek ürün varken üretime (uzaktaki makineye) gitmez: ürün yolda gezmesin
    if ((!types.length || !this.sinkFor(types)) && this.produce()) return;
    // eli yarım doluysa birkaç adım ötedeki başka ürünü de alır (yan yana bostanlar): rafa tek seferde götürür
    const nb = types.length && this.stack.cap - types.length >= 2 && this.sinkFor(types) && this.nearbySource(types);
    if (nb) return this.go('take', nb, V(nb.zone.x + rand(-0.5, 0.5), 0, nb.zone.z + rand(-0.3, 0.3)));
    const src = this.stack.full ? null : this.sourceFor();
    // elindekini bırakmadan yalnızca aynı üründen tamamlar; başka ürün için önce elindekini rafa koyar (uzaktan getirilen kilim elde kalmasın)
    if (src && (!types.length || !this.sinkFor(types) || (src.avail() >= 2 && types.includes(src.type)))) {
      const big = src.zone.w > 3;
      return this.go('take', src, V(src.zone.x + rand(-0.8, 0.8) * (big ? 1 : 0.6), 0, src.zone.z + rand(-0.4, 0.4)));
    }
    const sk = types.length && this.sinkFor(types);
    if (sk) {
      const dest = V(sk.zone.x + rand(-0.6, 0.6), 0, sk.zone.z);
      return this.go('put', sk, dest);
    }
    this.idle(...staffIdle()); // dükkânın ön koridorunun doğu ucu (kuyruğun güneyi)
  }
}

// fırın bölgesinin makineleri (fırınlar ve değirmen): fırıncı varken onların işi
function ownedByBaker(conv) { const F = G.regions.firin; return !!(F && (bakerOvens().includes(conv) || F.mill === conv)); }
// fırıncının beslediği fırınlar: köy fırınının taş fırınları ve fırının batısındaki genişletme fırınları (unla çalışan makineler).
// Eskiden genişletme fırınlarına kimse un götürmüyordu, yolun kenarında süs gibi boş duruyorlardı
function bakerOvens() {
  const F = G.regions.firin;
  if (!F || !F.ovens) return [];
  // fırın çırağı (bölüm görevlisi) varsa genişletme fırınlarına unu o taşır: ikisi aynı fırına yığılmasın
  if ((G.staff.att_firin || []).length) return F.ovens.slice();
  const extra = G.stations.filter((s) => s.inType === 'un' && s.out && Array.isArray(s.input) && s !== F.mill && !F.ovens.includes(s)
    && s.zone.x > -31 && s.zone.x < 12 && s.zone.z > -32 && s.zone.z < -19);
  return [...F.ovens, ...extra];
}

// Pazar: toptancı → tezgah
class Vendor extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#f6c343', pants: '#6b4e3d', hat: 'straw', skin: '#d9a67c' }, n ? `Tezgahçı ${n + 1}` : 'Tezgahçı', V(51.5, 0, -6.6 - n * 1.0), fresh, 3); // iki tezgâh sırasının arasında, doğu ucta (world.js pzSlot)
    this.speed = 2.6; this.k = n;
    this.acts = {
      buy: { every: 0.3, act: () => this.roomFor(this.wantType) > 0 && this.target.buyTo(this.stack, this.wantType) === 'ok' },
      put: { every: 0.22, act: () => this.target.putFrom(this.stack) },
    };
  }
  // her ürünün kendi tezgahı: o tezgahtaki boş yer, tezgahçıların elindeki aynı ürün düşülerek
  roomFor(t) {
    const s = G.regions.pazar.stallOf && G.regions.pazar.stallOf[t];
    return s ? s.slots.filter((x) => !x).length - (G.staff.vendor || []).reduce((a, w) => a + w.stack.count(t) + (w !== this && w.state === 'buy' && w.wantType === t ? w.stack.cap - w.stack.items.length : 0), 0) : 0;
  }
  decide() {
    const R = G.regions.pazar, n = this.stack.items.length;
    const p = this.obj.position, far = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
    const put = n && (R.stalls || []).filter((s) => this.stack.count(s.type) && s.slots.includes(null)).sort((a, b) => far(a) - far(b))[0];
    const stocked = R.sources.filter((s) => s.stock > 0); // malı biten kamyon yükü almaya gitmiştir
    const buy = this.stack.full ? [] : stocked.flatMap((s) => s.types.filter((t) => this.roomFor(t) > 0 && G.money >= ITEMS[t].cost).map((t) => [s, t]));
    // eli yarım ve alınacak tek parça kaldıysa önce elindekini dizer (bir tane için kamyona dönmez)
    const worth = buy.filter(([, t]) => !n || this.roomFor(t) >= 2);
    if (put && !worth.length) return this.go('put', put, V(put.zone.x + rand(-0.3, 0.3), 0, put.zone.z));
    if (worth.length) {
      // en çok boşalan tezgah önce, eşitse yakındaki kamyon; elde olan ürün ve aynı kamyon öne (tek durakta tamamlar)
      const sc = ([s, t]) => -this.roomFor(t) * 2 + far(s) * 0.15 - (this.stack.count(t) ? 3 : 0);
      const [src, t] = worth.sort((a, b) => sc(a) - sc(b))[0]; this.wantType = t;
      return this.go('buy', src, V(src.zone.x + rand(-0.6, 0.6), 0, src.zone.z));
    }
    this.idle(50.8, 52.0, -8.0, -5.4); // iki tezgâh sırasının arasında, doğu ucta (world.js pzSlot; turşucunun masasına girmez)
  }
}

// Sahil: büfe → şezlong
class Waiter extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#ffffff', pants: '#2a2a2a', hat: 'hair', hatColor: '#2a2a2a', skin: '#f3cfae' }, n ? `Garson ${n + 1}` : 'Garson', V(33 + n * 1.2, 0, 24), fresh, 2);
    this.speed = 2.8;
    this.acts = {
      take: { every: 0.15, act: () => this.stack.count(this.want) < this.wantN && this.target.takeTo(this.stack) },
      deliver: { every: 0.15, act: () => { this.target.deliverFrom(this.stack); return false; } },
      harvest: { every: 0.25, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
      feed: { every: 0.2, act: () => this.target.putFrom(this.stack) },
    };
  }
  decide() {
    const R = G.regions.sahil;
    const orders = R.loungers.filter((l) => l.c && l.c.state === 'order');
    const mates = (G.staff.waiter || []).filter((w) => w !== this);
    const claimed = (t) => mates.reduce((a, w) => a + w.stack.count(t) + (w.state === 'take' && w.want === t ? Math.max(0, w.wantN - w.stack.count(t)) : 0), 0);
    // götürdüğü siparişlerden öbür garsonların gitmediğini seçer
    const mine = orders.find((l) => this.stack.count(l.c.order) > 0 && !mates.some((w) => w.state === 'deliver' && w.target === l)) || orders.find((l) => this.stack.count(l.c.order) > 0);
    if (mine) return this.go('deliver', mine, V(mine.x + 0.9, 0, mine.z + 1.7));
    if (!this.stack.full && orders.length) {
      const need = {};
      for (const l of orders) need[l.c.order] = (need[l.c.order] || 0) + 1;
      for (const t in need) need[t] -= this.stack.count(t) + claimed(t);
      const type = Object.keys(need).find((t) => need[t] > 0 && R.gens[t] && R.gens[t].items.length);
      if (type) { this.want = type; this.wantN = this.stack.count(type) + need[type]; const g = R.gens[type]; return this.go('take', g, V(g.zone.x + rand(-0.6, 0.6), 0, g.zone.z)); }
    }
    // sipariş yokken boş durmaz: mısır kazanını tarladan koçanla, dondurma makinesini ahırdan sütle besler
    if (this.feed([{ conv: R.cornPot, srcs: srcFor('kocan') }, { conv: R.iceMachine, srcs: srcFor('sut').filter((s) => s && !s.paid) }])) return;
    this.idle(30, 36, 23.6, 24.6);
  }
}

// Han: üreticiler → kervan (kapıdan geçerek)
const GATE_IN = V(0, 0, -38.2), GATE_OUT = V(0, 0, -34.8); // han kuzeye taşındı (kapı z -36,5)
class Steward extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#3aa6a0', pants: '#5a3b2a', hat: 'turban', hatColor: '#e0b04a', skin: '#d9a67c' }, n ? `Kâhya ${n + 1}` : 'Kâhya', V(n * 1.4, 0, -39.5), fresh, 3);
    this.speed = 2.6;
    this.acts = {
      take: { every: 0.15, act: () => this.stack.count(this.want) < this.wantN && this.target.takeTo(this.stack) },
      deliver: { every: 0.12, act: () => this.target.deliverFrom(this.stack) },
      harvest: { every: 0.25, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
      feed: { every: 0.2, act: () => this.target.putFrom(this.stack) },
    };
  }
  inside() { return this.obj.position.z < -36.5; }
  decide() {
    const R = G.regions.han, car = R.caravan;
    const waiting = car && car.state === 'wait';
    const left = {};
    const mates = (G.staff.steward || []).filter((w) => w !== this);
    const claimed = (t) => mates.reduce((a, w) => a + w.stack.count(t) + (w.state === 'take' && w.want === t ? Math.max(0, w.wantN - w.stack.count(t)) : 0), 0);
    if (waiting) for (const t in car.order) left[t] = car.order[t].need - car.order[t].got - this.stack.count(t) - claimed(t);
    const carrying = waiting && this.stack.items.some((i) => car.order[i.type] && car.order[i.type].got < car.order[i.type].need);
    const type = waiting && !this.stack.full && Object.keys(left).find((t) => left[t] > 0 && R.gens[t] && R.gens[t].items.length);
    if (carrying && (this.stack.full || !type)) {
      const drop = V(0.6 + rand(-0.8, 0.8), 0, -32.2 + rand(-0.5, 0.5));
      return this.go('deliver', car.drop, ...(this.inside() ? [GATE_IN, GATE_OUT, drop] : [drop]));
    }
    if (type) {
      const g = R.gens[type];
      this.want = type; this.wantN = this.stack.count(type) + left[type];
      const at = V(g.zone.x + rand(-0.6, 0.6), 0, g.zone.z);
      return this.go('take', g, ...(this.inside() ? [at] : [GATE_OUT, GATE_IN, at]));
    }
    // kervan işi yoksa: fırını ve ambarı buğday tarlasından, çorba kazanını domates bahçesinden besler
    const wheat = R.fields.filter((f) => f.type === 'bugday'), tom = R.fields.filter((f) => f.type === 'domates');
    if (this.feed([{ conv: R.ovenConv, srcs: wheat }, { conv: R.soupConv, srcs: tom }, { conv: R.granaryConv, srcs: wheat }])) return;
    if (this.inside()) this.idle(-3, 3, -40, -38.6, 2); else this.idle(2, 5, -33.6, -31.2, 2);
  }
}

// Köy: servis elemanı — paket servis cebindeki ve meydandaki otoparkta bekleyen arabaların siparişini
// bostandan, kümesten, ahırdan toplayıp arabaya götürür; elinde artan ürünü rafa bırakır
class Courier extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#ff8a3d', pants: '#2d3e66', hat: 'cap', hatColor: '#2d3e66', skin: '#eec39a' }, n ? `Araba servisçisi ${n + 1}` : 'Araba servisçisi', V(-13.8 + n * 0.8, 0, -4.4), fresh, 4);
    this.speed = 3.0;
    this.acts = {
      take: { every: 0.25, act: () => (this.takeMax == null || this.stack.count(this.target.type) < this.takeMax) && this.target.give(this.stack) },
      put: { every: 0.22, act: () => this.target.putFrom(this.stack) },
      car: { every: 0.15, act: () => this.target.deliverFrom(this.stack) },
    };
  }
  decide() {
    this.takeMax = null; this.carTarget = null;
    if (this.carStep()) return;
    const types = this.stack.items.map((i) => i.type);
    const sk = types.length && this.sinkFor(types);
    if (sk) return this.go('put', sk, V(sk.zone.x + rand(-0.6, 0.6), 0, sk.zone.z));
    const j = restockJob(this); // araba yokken boş durmaz: en boş köy rafının ürününü getirir
    if (j) { this.takeMax = j.n; return this.go('take', j.src, V(j.src.zone.x + rand(-0.5, 0.5), 0, j.src.zone.z + rand(-0.3, 0.3))); }
    this.idle(-15.5, -14.6, -6.2, -2.8, 2); // köyün batı kenarında, dükkân duvarının dışında arabaları bekler
  }
}
for (const k of ['carJob', 'carStep', 'sinkFor']) Courier.prototype[k] = Shelver.prototype[k];
STAFF.courier = { cls: Courier, cap: 'cvCap', spd: 'cvSpd' };

// Sahil: her cankurtaran kendi kulesinin tepesinde oturup denizi gözler. Biri boğulunca en yakın boştaki cankurtaran
// iner, kıyıya koşar, yüzüp yanına gider, kıyıya çeker, sonra kulesine geri tırmanır
const SEAT_Y = 2.28 - 0.62 * M.CHAR_S; // platformun üstü eksi kalça yüksekliği (gövde %90): oturunca kalça platformda
class Lifeguard extends Worker {
  constructor(fresh, n = 0) {
    const S = G.regions.sahil, t = (S.towers && S.towers[n]) || { x: 51, z: 27 };
    super({ shirt: '#e8473c', pants: '#ffd23f', hat: 'cap', hatColor: '#ffd23f', skin: '#d9a67c' }, n ? `Cankurtaran ${n + 1}` : 'Cankurtaran', V(t.x, SEAT_Y, t.z + 0.25), fresh);
    this.seat = V(t.x, SEAT_Y, t.z + 0.25); this.base = V(t.x + 1.3, 0, t.z + 1.0);
    this.speed = 3.4; this.state = 'watch'; this.who = null; this.k = 0;
  }
  // boğulana en yakın, kulesinde oturan cankurtaran ben miyim
  nearest(v) {
    const d = (w) => Math.abs(w.seat.x - v.obj.position.x);
    return (G.staff.lifeguard || []).filter((w) => w.state === 'watch').sort((a, b) => d(a) - d(b))[0] === this;
  }
  update(dt) {
    this.moving = false;
    const p = this.obj.position, S = G.regions.sahil, SHORE = (x) => coastZ(x) - 1.0; // girintili kıyı
    let sitting = false;
    switch (this.state) {
      case 'watch': {
        p.copy(this.seat);
        this.obj.rotation.y = lerpAngle(this.obj.rotation.y, 0, Math.min(1, dt * 4)); // denize bakar
        sitting = true;
        const v = S.drowning;
        if (v && !v.rescuer && this.nearest(v)) { this.who = v; v.rescuer = this; this.state = 'down'; this.k = 0; }
        break;
      }
      case 'down': // kuleden atlar
        this.k = Math.min(1, this.k + dt * 1.8);
        p.lerpVectors(this.seat, this.base, this.k); p.y += Math.sin(this.k * Math.PI) * 0.6;
        if (this.k >= 1) { this.state = 'run'; this.to = V(this.who.obj.position.x, 0, SHORE(this.who.obj.position.x)); }
        this.obj.rotation.y = lerpAngle(this.obj.rotation.y, Math.atan2(this.base.x - this.seat.x, this.base.z - this.seat.z), Math.min(1, dt * 8));
        M.animateCharacter(this.obj, 0, dt, false);
        return;
      case 'run':
        if (this.walkTo(this.to, dt, this.speed)) this.state = 'swim';
        break;
      case 'swim': {
        const t = this.who.obj.position;
        if (this.walkTo(V(t.x, 0, t.z - 0.9), dt, this.speed * 0.55)) { this.state = 'tow'; this.who.rescued(); }
        break;
      }
      case 'tow': {
        const w = this.who.obj.position;
        w.x += (p.x + 0.6 - w.x) * Math.min(1, dt * 6); w.z += (p.z + 0.7 - w.z) * Math.min(1, dt * 6);
        if (this.walkTo(V(p.x, 0, SHORE(p.x)), dt, this.speed * 0.45)) { this.who.landed(); this.who = null; this.state = 'back'; }
        break;
      }
      case 'back':
        if (this.walkTo(this.base, dt, this.speed * 0.8)) { this.state = 'up'; this.k = 0; }
        break;
      case 'up': // kulesine tırmanır
        this.k = Math.min(1, this.k + dt * 1.2);
        p.lerpVectors(this.base, this.seat, this.k);
        M.animateCharacter(this.obj, 0.6, dt, false);
        if (this.k >= 1) this.state = 'watch';
        return;
    }
    if (sitting) {
      // otururken bacaklar öne, denize sarkık
      M.animateCharacter(this.obj, 0, dt, false);
      for (const l of this.obj.userData.legs) l.rotation.x = -Math.PI / 2 + Math.sin(G.time * 1.5 + l.id) * 0.12;
      return;
    }
    // denizdeyken gövde suyun içinde, dalgayla iner kalkar
    const y = p.z > coastZ(p.x) - 0.3 ? -0.75 + Math.sin(G.time * 4) * 0.05 : heightAt(p.x, p.z);
    p.y += (y - p.y) * Math.min(1, dt * 8);
    M.animateCharacter(this.obj, this.moving ? 1 : 0, dt, false);
  }
}
STAFF.lifeguard = { cls: Lifeguard, spd: 'lgSpd' };

// Bekçi: para yığınlarının arasında devriye gezer; hırsız gelince kovalar ve dokununca yakalar (para yığına döner).
// Köpeği varsa köpek hırsıza bekçiden çok daha hızlı koşar; boştayken bekçinin yanında yürür
class Guard extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#2d3e66', pants: '#1f2a44', hat: 'cap', hatColor: '#1f2a44', skin: '#e0b48c', mustache: true }, n ? `Bekçi ${n + 1}` : 'Bekçi', V(-3 + n * 1.4, 0, -2.6), fresh);
    this.speed = 3.8; this.t = 0; this.chaseT = 0; this.dog = null; this.dogPath = []; this.dogT = 0;
    this.setDog((G.upg[`gDog@${n}`] || 0) > 0, false); // köpek her bekçiye ayrı alınır
  }
  setDog(on, fresh) {
    if (!on || this.dog) return;
    this.dog = makeDog();
    this.dog.position.copy(this.obj.position).add(V(0.9, 0, 0.5));
    G.scene.add(this.dog);
    if (fresh) popIn(this.dog);
  }
  update(dt) {
    this.moving = false;
    const A = G.arrest;
    if (A && A.guard === this) { if (this.dog && !A.dogHold) this.updateDog(dt, null); return; } // yakalama ve teslim sahnesi bekçiyi sürer (polis.js)
    const th = G.thief, p = this.obj.position;
    const live = th && (th.state === 'sneak' || th.state === 'grab' || th.state === 'flee');
    if (live) {
      const tp = th.obj.position;
      this.chaseT -= dt;
      if (this.chaseT <= 0) { this.chaseT = 0.5; this.path = [V(tp.x, 0, tp.z)]; this.leg = null; } // yol bulma yarım saniyede bir
      if (Math.hypot(tp.x - p.x, tp.z - p.z) < 3) { this.path = []; this.walkTo(tp, dt, this.speed); } else this.walkPath(dt, this.speed);
      if (Math.hypot(tp.x - p.x, tp.z - p.z) < 1.0) thiefCaught('guard', this);
      this.t = 0;
    } else {
      // devriye: rastgele bir para yığınının başına gidip biraz bekler
      this.t -= dt;
      if (!this.path.length && this.t <= 0) {
        const piles = G.stations.filter((s) => s instanceof MoneyPile && s.zone.x < 300 && walkable(s.zone.x, s.zone.z)); // şehir ayrı dünya
        const s = piles[Math.floor(Math.random() * piles.length)];
        if (s) { const q = V(s.zone.x + rand(-0.8, 0.8), 0, s.zone.z + rand(-0.8, 0.8)); this.path = [walkable(q.x, q.z) ? q : V(s.zone.x, 0, s.zone.z)]; this.leg = null; }
        this.t = rand(4, 7);
      }
      if (this.path.length) this.walkPath(dt, this.speed * 0.6);
    }
    if (this.dog) this.updateDog(dt, live && th);
    this.finish(dt);
  }
  updateDog(dt, th) {
    const d = this.dog, dp = d.position;
    let speed;
    if (th) {
      this.dogT -= dt;
      if (this.dogT <= 0 || !this.dogPath.length) { this.dogT = 0.4; this.dogPath = findRoute(dp, V(th.obj.position.x, 0, th.obj.position.z)); }
      speed = 7.6;
    } else {
      // bekçinin yanında, biraz arkasında yürür
      const a = this.obj.rotation.y, p = this.obj.position;
      this.dogPath = [V(p.x + Math.cos(a) * 0.9 - Math.sin(a) * 0.5, 0, p.z - Math.sin(a) * 0.9 - Math.cos(a) * 0.5)];
      speed = Math.min(7, Math.hypot(this.dogPath[0].x - dp.x, this.dogPath[0].z - dp.z) * 3);
    }
    let moved = 0, step = speed * dt;
    while (this.dogPath.length && step > 0) {
      const q = this.dogPath[0], dx = q.x - dp.x, dz = q.z - dp.z, dist = Math.hypot(dx, dz);
      if (dist > 1e-3) d.rotation.y = lerpAngle(d.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-14 * dt));
      if (dist > step) { dp.x += (dx / dist) * step; dp.z += (dz / dist) * step; moved += step; break; }
      dp.x = q.x; dp.z = q.z; moved += dist; step -= dist; this.dogPath.shift();
    }
    animateDog(d, Math.min(1, moved / Math.max(1e-4, dt) / 5), dt);
    if (th && Math.hypot(th.obj.position.x - dp.x, th.obj.position.z - dp.z) < 0.9) thiefCaught('dog', this);
  }
}
STAFF.guard = { cls: Guard, spd: 'gdSpd' };

// Seyis: bekleyen atın samanını yığından alıp yemliğine koyar; saman bitince tımar isteyen atı tımarlar
class Seyis extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#8a5a33', pants: '#3a2a1a', hat: 'straw', skin: '#d9a67c', mustache: true }, n ? `Seyis ${n + 1}` : 'Seyis', V(-48 + n * 1.2, 0, 4.2), fresh, 2);
    this.speed = 2.8;
    this.acts = {
      take: { every: 0.25, act: () => this.stack.items.length < this.want && this.target.give(this.stack) },
      hay: { every: 0.3, act: () => this.target.feedFrom(this.stack) },
      brush: { every: 0.2, act: () => this.target.groomTick(0.2) },
      harvest: { every: 0.25, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
      feed: { every: 0.2, act: () => this.target.putFrom(this.stack) },
    };
  }
  decide() {
    const R = G.regions.atlar, p = this.obj.position;
    if (!R || !R.unlocked || !R.gens) return this.idle(-51, -47, 3.4, 6.4, 2);
    const d = (s) => Math.hypot(s.x - p.x, 1.75 - p.z);
    const hungry = R.stalls.filter((s) => s.ready() && s.need > 0).sort((a, b) => d(a) - d(b));
    const hay = this.stack.count('saman');
    if (hay && hungry.length) return this.go('hay', hungry[0], V(hungry[0].x + rand(-0.6, 0.6), 0, 1.9));
    // elinde buğday kaldıysa önce harmana bırakır (yoksa eli dolu kalır, saman alamaz)
    const H = R.harman;
    if (H && this.stack.count('bugday') && H.input.length < H.cap) return this.go('feed', H, V(H.zone.x + rand(-0.4, 0.4), 0, H.zone.z));
    const need = hungry.reduce((n, s) => n + s.need, 0) - (G.staff.groom || []).filter((w) => w !== this).reduce((n, w) => n + w.stack.count('saman'), 0);
    const gen = R.gens.saman;
    if (need > 0 && gen.avail() > 0 && !this.stack.full) { this.want = Math.min(this.stack.cap, this.stack.items.length + need); return this.go('take', gen, V(gen.zone.x + rand(-0.6, 0.6), 0, gen.zone.z)); }
    const busy = (s) => (G.staff.groom || []).some((w) => w !== this && w.state === 'brush' && w.target === s);
    const brush = R.stalls.find((s) => s.ready() && s.groom > 0 && !busy(s));
    if (brush) return this.go('brush', brush, V(brush.x - 0.8, 0, 1.9));
    if (R.harman && this.feed([{ conv: R.harman, srcs: [R.field] }])) return; // boşta tarladan buğday toplayıp harmanı besler
    this.idle(-51, -47, 3.4, 6.4, 2); // saman yığınının yanında bekler
  }
}
STAFF.groom = { cls: Seyis, cap: 'gmCap', spd: 'gmSpd' };

// Fırıncı: unu fırınlara taşır, pişen simit ve poğaçayı vitrine dizer
class Firinci extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#ffffff', pants: '#3a4a6b', hat: 'cap', hatColor: '#ffffff', skin: '#e0b48a' }, n ? `Fırıncı ${n + 1}` : 'Fırıncı', V(-2 + n * 1.2, 0, -23.2), fresh, 4);
    this.speed = 2.6;
    this.acts = {
      take: { every: 0.25, act: () => !this.stack.full && this.goods() < this.room && this.target.give(this.stack) },
      put: { every: 0.22, act: () => this.target.putFrom(this.stack) },
      harvest: { every: 0.25, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
      feed: { every: 0.2, act: () => this.target.putFrom(this.stack) },
    };
  }
  goods() { return this.stack.items.filter((i) => ['simit', 'pogaca', 'ekmek', 'pide'].includes(i.type)).length; }
  decide() {
    const R = G.regions.firin;
    if (!R || !R.unlocked || !R.vitrins || !R.vitrins.length) return this.idle(-4, 0, -23.4, -23.0, 2);
    // her ürünün kendi vitrini: elindekini o ürünün vitrinine dizer
    const room = (t) => { const v = R.vitrinOf[t]; return v ? v.slots.filter((s) => !s).length : 0; }, goods = this.goods();
    const put = R.vitrins.find((v) => this.stack.count(v.type) && v.slots.includes(null));
    if (put) return this.go('put', put, V(put.zone.x + rand(-0.4, 0.4), 0, put.zone.z));
    const ovens = bakerOvens(); // köy fırınının üç taş fırını ve genişletmedeki küçük fırınlar (ikinci simit, pide)
    for (const o of ovens) if (!R.vitrinOf[o.out.type] && R.addVitrin) R.addVitrin(o.out.type, false); // pidenin vitrini yoksa kurulur
    const ready = ovens.map((o) => o.out).filter((g) => g.avail() > 0 && room(g.type) > 0).sort((a, b) => b.avail() - a.avail())[0];
    if (ready) { this.room = goods + room(ready.type); return this.go('take', ready, V(ready.zone.x + rand(-0.5, 0.5), 0, ready.zone.z)); }
    // unu az olan fırına önce: iki fırın da çalışsın (simit ve poğaça)
    const shown = (t) => (R.vitrinOf[t] ? R.vitrinOf[t].count() : 0);
    const lack = (o) => o.input.length * 10 + o.out.items.length + shown(o.out.type); // unu ve ürünü az olan önce
    const jobs = ovens.slice().sort((a, b) => lack(a) - lack(b)).map((o) => ({ conv: o, srcs: [R.flour] }));
    if (R.mill) { const mill = { conv: R.mill, srcs: srcFor('bugday') }; if (R.flour.avail() < 3) jobs.unshift(mill); else jobs.push(mill); } // un azsa önce değirmene buğday
    if (this.feed(jobs)) return;
    this.idle(-4, 0, -23.4, -23.0, 2); // vitrinin arkasında bekler
  }
}
STAFF.baker = { cls: Firinci, cap: 'bkCap', spd: 'bkSpd' };

// Kat görevlisi: önce elindekini bitirir (havluyu isteyen eve, kirli çamaşırı çamaşırhaneye), sonra boşalan evi toplar,
// sonra havlu isteği varsa çamaşırhaneden havlu alır. İki görevli aynı evi toplamaz, aynı havlu isteğine yığılmaz.
class KatGorevlisi extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#3ec1b5', pants: '#f4f4f4', hat: 'cap', hatColor: '#ffffff', skin: '#e0b48a' }, n ? `Kat görevlisi ${n + 1}` : 'Kat görevlisi', V(91 + n * 1.2, 0, 13.4), fresh, 4);
    this.speed = 2.8;
    this.acts = {
      tidy: { every: 0.2, act: () => {
        const h = this.target;
        if (h.state !== 'kirli') { h.cleaner = null; return false; }
        h.cleaner = this; h.clean += 0.2 / 3.0; h.R.drawLabel(h); // oyuncudan biraz yavaş toplar
        if (h.clean >= 1) { h.R.tidy(h, this.stack); return false; }
        return true;
      } },
      feed: { every: 0.15, act: () => this.target.putFrom(this.stack) },
      take: { every: 0.25, act: () => this.stack.count('havlu') < this.want && this.target.give(this.stack) },
      desk: { every: 0.6, act: () => { const c = this.target.queue[0]; if (c && c.state === 'desk') G.regions.tatil.checkIn(c); return false; } },
      // ofis deposundan istenen ürünü alır
      fetch: { every: 0.25, act: () => {
        if (this.stack.full || this.stack.count(this.wantType) >= this.want) return false;
        const o = this.target.takeType(this.wantType);
        if (!o) return false;
        this.stack.push(this.wantType, o, 0.3);
        return true;
      } },
      serve: { every: 0.2, act: () => !!this.target.order && this.target.drop.deliver(this.stack) },
    };
  }
  decide() {
    const R = G.regions.tatil, p = this.obj.position;
    if (!R || !R.unlocked || !R.laundry) return this.idle(90, 96, 12.9, 13.7, 2);
    for (const h of R.houses) if (h.cleaner === this) h.cleaner = null; // yarım kalan toplama oyuncuya kalır
    // çamaşırhane girdisi doluyken eli kirli çamaşırla dolduysa fazlası bırakılır (yoksa hiçbir işe yer kalmaz)
    if (this.stack.full && !this.stack.count('havlu') && R.laundry.input.length >= R.laundry.cap) while (this.stack.count('kirli')) { const it = this.stack.takeOf(['kirli']); if (!it) break; if (it.obj.parent) it.obj.parent.remove(it.obj); }
    // oyuncu resepsiyonda değilse sıradaki misafirin kaydını yapar
    const q = R.desk && R.desk.queue[0];
    if (q && q.state === 'desk' && !R.desk.inside && !(G.staff.recep || []).length && !(G.staff.maid || []).some((w) => w !== this && w.state === 'desk')) return this.go('desk', R.desk, V(R.desk.zone.x + rand(-0.4, 0.4), 0, R.desk.zone.z));
    const mates = (G.staff.maid || []).filter((w) => w !== this), d = (h) => Math.hypot(h.x - p.x, TERRACE_Z - p.z);
    const left = (h, k) => (h.order && h.order[k] ? h.order[k].need - h.order[k].got : 0);
    // elindeki ürünlerden birini bekleyen en yakın ev (havlu da, depodan alınan her ürün de)
    const mine = (h) => this.stack.items.some((i) => left(h, i.type) > 0);
    const asked = R.houses.filter((h) => mine(h) && !mates.some((w) => w.state === 'serve' && w.target === h)).sort((a, b) => d(a) - d(b));
    const at = (h) => V(h.x + rand(-0.8, 0.8), 0, TERRACE_Z + 0.3);
    if (asked.length) return this.go('serve', asked[0], at(asked[0]));
    if (this.stack.count('kirli') && R.laundry.input.length < R.laundry.cap) return this.go('feed', R.laundry, V(R.laundry.zone.x + rand(-0.4, 0.4), 0, R.laundry.zone.z));
    const dirty = R.houses.filter((h) => h.state === 'kirli' && !mates.some((w) => w.state === 'tidy' && w.target === h)).sort((a, b) => d(a) - d(b));
    if (dirty.length) return this.go('tidy', dirty[0], at(dirty[0])); // yer yoksa da toplar: çamaşırhane dolu diye ev kirli kalmasın
    // bekleyen istekler: havlu çamaşırhaneden, öbür her şey ofis deposundan
    const need = R.needs ? R.needs() : {};
    const gen = R.gens.havlu, D = R.depot;
    if (!this.stack.full) for (const k in need) {
      const want = need[k] - this.stack.count(k);
      if (want <= 0) continue;
      if (k === 'havlu') { if (gen.avail() > 0) { this.want = Math.min(this.stack.cap, this.stack.count('havlu') + want); return this.go('take', gen, V(gen.zone.x + rand(-0.6, 0.6), 0, gen.zone.z)); } }
      else if (D && D.count(k) > 0) { this.wantType = k; this.want = Math.min(this.stack.cap, this.stack.count(k) + want); return this.go('fetch', D, V(D.zone.x + rand(-0.7, 0.7), 0, D.zone.z)); }
    }
    this.idle(90, 96, 12.9, 13.7, 2); // çamaşırhanenin önünde, tahta yolda bekler
  }
}
STAFF.maid = { cls: KatGorevlisi, cap: 'mdCap', spd: 'mdSpd' };

// Resepsiyonist: bankonun arkasında durur, sıradaki misafir bankoya gelince kaydını yapar (speed = bir kaydın süresi)
class Resepsiyonist extends Worker {
  constructor(fresh) {
    super({ shirt: '#3ec1b5', pants: '#2b3a4a', hat: 'hair', hatColor: '#3a2416', skin: '#e9b98f' }, 'Resepsiyonist', V(76.5, 0, 10.8), fresh); // tezgahın hemen arkası: kabuk tentenin ağzından görünür
    this.speed = 1.4;
  }
  update(dt) {
    this.obj.rotation.y = lerpAngle(this.obj.rotation.y, 0, Math.min(1, dt * 6));
    M.animateCharacter(this.obj, 0, dt, false);
    const R = G.regions.tatil, c = R && R.desk && R.desk.queue[0];
    M.workMotion(this.obj, 'yaz', dt, !!c && c.state === 'desk'); // kayıt defterine yazar
    if (!c || c.state !== 'desk') { this.t = 0; return; }
    this.t += dt;
    if (this.t >= this.speed) { this.t = 0; R.checkIn(c); bounce(this.obj, 0.1); }
  }
}
STAFF.recep = { cls: Resepsiyonist, spd: 'rcSpd' };

// Bölge kasadarı: kendi bölgesinin para tezgahının arkasında durur, başında durduğu yığına hırsız gelmez (thief.js P.clerk).
// Parayı hesaba aktarmaz; arada bir yığına göz atar. Görünüşü tezgahı kuran yerin verdiği kıyafet
class KasaGorevlisi extends Worker {
  constructor(fresh, n, desk) {
    const P = desk.pile(), sp = P && P.spot;
    super((sp && sp.look) || M.villagerLook(), desk.name, sp ? V(sp.x, sp.y, sp.z) : V(0, -50, 0), fresh);
    this.desk = desk; this.t = 0;
    if (sp) { this.obj.rotation.y = sp.ry; P.clerk = this.obj; G.colliders.push(this.col = [sp.x - 0.28, sp.x + 0.28, sp.z - 0.28, sp.z + 0.28]); }
  }
  update(dt) {
    M.animateCharacter(this.obj, 0, dt, false);
    const P = this.desk.pile();
    M.workMotion(this.obj, 'kasa', dt, !!P && P.amount > 0); // parayı sayar, yazarkasaya basar
    if (!P || P.clerk !== this.obj) return;
    this.t += dt;
    if (this.t < 4 || P.amount < 1) return;
    this.t = 0;
    bounce(this.obj, 0.06); // yığına göz atar
  }
}
for (const d of DESKS) STAFF[d.id] = { cls: class extends KasaGorevlisi { constructor(f, n) { super(f, n, d); } } };

// Dokumacı: atölyenin tezgahını meradan getirdiği yünle besler; kilim tezgahın tepsisinde birikir
class Dokumaci extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#b23a48', pants: '#3a2a4a', hat: 'scarf', hatColor: '#e0b04a', skin: '#e9b98f' }, n ? `Dokumacı ${n + 1}` : 'Dokumacı', V(-51 + n * 1.2, 0, 23.4), fresh, 3);
    this.speed = 2.6;
    this.acts = {
      harvest: { every: 0.25, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
      feed: { every: 0.2, act: () => this.target.putFrom(this.stack) },
      take: { every: 0.25, act: () => this.stack.count('kilim') < this.want && this.target.give(this.stack) },
      sell: { every: 0.2, act: () => this.target.putFrom(this.stack) },
    };
  }
  // kilimin satıldığı yer: köydeki kilim ve yün rafı, yoksa pazar tezgahı
  kilimSink() {
    const K = G.regions.koy, P = G.regions.pazar;
    return (K.shelves || []).find((s) => s.hasSpaceFor('kilim')) || (P && P.unlocked && P.stallOf && P.stallOf.kilim && P.stallOf.kilim.hasSpaceFor('kilim') ? P.stallOf.kilim : null);
  }
  decide() {
    const A = G.regions.atolye;
    if (!A || !A.unlocked || !A.loom) return this.idle(-53, -50, 22.6, 23.8, 2);
    const sink = this.kilimSink();
    if (this.stack.count('kilim') && sink) return this.go('sell', sink, V(sink.zone.x + rand(-0.6, 0.6), 0, sink.zone.z));
    if (this.feed([{ conv: A.loom, srcs: srcFor('yun').filter((s) => s && !s.paid) }])) return;
    // tezgah beslenemiyorsa (yün yok ya da tepsi dolu) boş durmaz: biriken kilimleri satış yerine taşır
    const out = A.loom.out;
    if (sink && out && out.avail() > 0 && !this.stack.full) { this.want = Math.min(this.stack.cap, this.stack.count('kilim') + out.avail()); return this.go('take', out, V(out.zone.x + rand(-0.5, 0.5), 0, out.zone.z)); }
    this.idle(-53, -50, 22.6, 23.8, 2);
  }
}
STAFF.weaver = { cls: Dokumaci, cap: 'wvCap', spd: 'wvSpd' };

STAFF.shelver = { cls: Shelver, cap: 'shCap', spd: 'shSpd' };
STAFF.cashier = { cls: Cashier };
STAFF.mcashier = { cls: MarketCashier };

// sahnedeki sanatçılar (expand-east.js makeStage: sahne x −38,25, z −58,4, üstü y 0,6): solist ortada mikrofonda, gitarist solda,
// davulcu arkada davulda. G.show: konserde çalarlar, tiyatroda sahnede gezip oynarlar. Gösteri yokken sahnede durmazlar: kasaba
// meydanında gezinir, dinlenirler; gösteriye 14 sn kala sahneye yürür, gösteri bitince iner (2026-11-01 kullanıcı: "etkinlik yokken
// sanatçılar da gözükmesin, hayata karışsın, sonra işi olunca gelsin")
const STAGE_AT = [[-38.25, -57.85, 'solist'], [-39.95, -58.15, 'gitar'], [-36.55, -59.25, 'davul']];
const STAGE_FRONT = -55.4; // sahnenin önü (yerde): sanatçı buradan çıkıp iner
class Artist extends Worker {
  constructor(fresh, n = 0) {
    const [x, z, role] = STAGE_AT[Math.min(n, 2)];
    super({ ...M.townLook(), mustache: role === 'davul' }, n ? `Sanatçı ${n + 1}` : 'Sanatçı', V(x, 0.6, z), fresh);
    this.role = role; this.home = V(x, 0.6, z); this.ph = n * 1.7; this.mode = 'stage';
    if (role === 'gitar') {
      const gt = new THREE.Group(); gt.position.set(0.05, 1.0, 0.22); gt.rotation.z = 0.9; this.obj.add(gt); this.guitar = gt;
      M.rbox(0.42, 0.5, 0.1, 0.08, M.mat('#c96f4a'), 0, 0, 0, gt); M.rbox(0.07, 0.62, 0.05, 0.02, M.mat('#4a2d1a'), 0, 0.55, 0, gt);
    }
  }
  update(dt) {
    const S = G.show || {}, on = S.on > 0, t = G.time + this.ph, u = this.obj.userData, A = u.arms, p = this.obj.position;
    if (this.guitar) this.guitar.visible = !(on && S.kind === 'tiyatro');
    this.moving = false;
    const need = on || S.gather > 0 || (S.t != null && S.t < 14);
    if (!need || this.mode !== 'stage') { this.offStage(dt, need); return; }
    if (on && S.kind === 'tiyatro') { // sahnenin önünde gezip oynar
      const sw = Math.sin(t * 0.8), x = -38.25 + sw * 2.2 + (this.home.x + 38.25) * 0.3;
      p.set(x, 0.6, -57.5 + Math.sin(t * 0.5) * 0.3); this.obj.rotation.y = Math.cos(t * 0.8) > 0 ? Math.PI / 2 : -Math.PI / 2;
      A[0].rotation.x = -1.7 + Math.sin(t * 2.1) * 0.7; A[1].rotation.x = -0.4 - Math.max(0, Math.sin(t * 1.3)) * 1.8;
      for (const [i, l] of u.legs.entries()) l.rotation.x = Math.sin(t * 6 + i * Math.PI) * 0.4;
      return;
    }
    p.copy(this.home); this.obj.rotation.y = 0; this.obj.rotation.x = 0; for (const l of u.legs) l.rotation.x = 0;
    const k = on ? 1 : 0.25;
    if (this.role === 'solist') { A[0].rotation.x = -1.9 + Math.sin(t * 2.3) * 0.25; A[1].rotation.x = -0.4 - Math.max(0, Math.sin(t * 1.1)) * 1.9 * k; this.obj.rotation.z = Math.sin(t * 2.6) * 0.08 * k; }
    else if (this.role === 'gitar') { A[0].rotation.x = -1.1 + Math.sin(t * 14) * 0.3 * k; A[1].rotation.x = -1.5; this.obj.rotation.x = Math.sin(t * 5.2) * 0.07 * k; }
    else { A[0].rotation.x = -1.2 + Math.sin(t * 16) * 0.45 * k; A[1].rotation.x = -1.2 + Math.sin(t * 16 + Math.PI) * 0.45 * k; }
  }
  // sahne dışı: gösteri yaklaşınca sahnenin önüne yürüyüp çıkar; yoksa iner ve kasaba meydanında gezinir
  offStage(dt, need) {
    const p = this.obj.position, front = V(this.home.x, 0, STAGE_FRONT);
    this.obj.rotation.x = 0; this.obj.rotation.z = 0;
    if (need) {
      if (this.mode !== 'up') { if (this.mode !== 'toStage') { this.mode = 'toStage'; this.path = [front]; this.leg = null; } if (this.walkPath(dt, 3.0)) this.mode = 'up'; this.finish(dt); return; }
      // basamaktan çıkar: yerine yürürken sahnenin yüksekliğine yükselir
      const there = this.walkTo(this.home, dt, 1.8); p.y = Math.min(0.6, p.y + dt * 1.6);
      M.animateCharacter(this.obj, there ? 0 : 1, dt, false);
      if (there && p.y >= 0.6) { this.mode = 'stage'; this.obj.rotation.y = 0; }
      return;
    }
    if (this.mode === 'stage' || this.mode === 'up' || this.mode === 'toStage') { this.mode = 'down'; this.path = []; }
    if (this.mode === 'down') {
      const there = this.walkTo(front, dt, 1.8); p.y = Math.max(0, p.y - dt * 1.6);
      M.animateCharacter(this.obj, 1, dt, false);
      if (there && p.y <= 0.01) { this.mode = 'town'; this.t = 0; }
      return;
    }
    // kasaba meydanının çevresinde ve parkın yollarında gezinir, arada durup dinlenir
    this.t -= dt;
    if (!this.path.length && this.t <= 0) this.idle(-52, -39, -37.5, -26.5, rand(3, 7));
    if (this.path.length) this.walkPath(dt, 1.5);
    this.finish(dt);
  }
}
STAFF.artist = { cls: Artist };

// Çöpçü (cop.js): en yakın, başkasının almadığı çöpe gider, süpürüp toplar; çöp yokken kasaba meydanında bekler. Temizlik arabası
// (swCart) alınınca küçük süpürge arabasıyla dolaşır: daha hızlı gider, çevresindeki çöpleri de bir seferde toplar
class Sweeper extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#ff8a1e', pants: '#2d3e66', hat: 'cap', hatColor: '#ff8a1e', skin: '#e0b48c' }, n ? `Çöpçü ${n + 1}` : 'Çöpçü', V(-44 + n * 1.3, 0, -26.5), fresh);
    this.speed = 2.2; this.target = null; this.sweepT = 0; this.cart = null; this.t = 0;
    const br = new THREE.Group(); // süpürge: sap ve sarı çalı
    M.cyl(0.03, 0.03, 1.3, 6, M.mat('#8a5a33'), 0, 0, 0, br); M.rbox(0.36, 0.12, 0.14, 0.03, M.mat('#d9b44a'), 0, -0.66, 0, br);
    br.position.set(0.32, 0.72, 0.28); br.rotation.x = 0.55; this.obj.add(br); this.broom = br;
  }
  // temizlik arabası: yeşil gövde, önde dönen fırçalar, arkada çöp kutusu; çöpçü içinde oturur
  makeCart() {
    const g = new THREE.Group(), body = M.mat('#3fae6b'), dark = M.mat('#2a2f36');
    M.rbox(1.0, 0.5, 1.5, 0.12, body, 0, 0.45, 0, g); M.rbox(0.9, 0.55, 0.6, 0.08, M.mat('#2f8f57'), 0, 0.95, -0.4, g);
    M.rbox(0.92, 0.06, 0.9, 0.03, M.mat('#f6c343'), 0, 1.25, 0.15, g); // sarı ikaz lambası şeridi
    for (const [x, z] of [[-0.45, 0.5], [0.45, 0.5], [-0.45, -0.5], [0.45, -0.5]]) M.cyl(0.18, 0.18, 0.12, 12, dark, x, 0.18, z, g).rotation.z = Math.PI / 2;
    const brushes = [];
    for (const x of [-0.42, 0.42]) { const b = M.cyl(0.24, 0.24, 0.06, 10, M.mat('#d9b44a'), x, 0.06, 0.85, g); brushes.push(b); }
    g.userData.brushes = brushes;
    return g;
  }
  update(dt) {
    this.moving = false;
    const onCart = (G.upg.swCart || 0) > 0, p = this.obj.position;
    if (onCart && !this.cart) { this.cart = this.makeCart(); G.scene.add(this.cart); popIn(this.cart); this.broom.visible = false; }
    const sp = this.speed * (onCart ? 1.8 : 1), reach = onCart ? 1.8 : 0.9;
    // çöpe giderken ve süpürürken iş başında sayılır (maaş ve denetim state'e bakar); eskiden bir kez beklemeye geçince hep 'idle'
    // kalıyordu: zamanın yarısından çoğunda çöp toplayan çöpçü %100 boşta görünüp yarım maaş alıyordu (2026-11-02 ölçümü)
    if (this.sweepT > 0 || (this.target && litter.includes(this.target))) this.state = 'sweep';
    if (this.sweepT > 0) { // süpürür
      this.sweepT -= dt;
      this.broom.rotation.z = Math.sin(G.time * 18) * 0.5;
      if (this.sweepT <= 0) { this.broom.rotation.z = 0; for (const L of litter.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) <= reach)) collect(L, this); this.target = null; }
    } else if (this.target && litter.includes(this.target)) {
      if (Math.hypot(this.target.x - p.x, this.target.z - p.z) <= reach * 0.8) { this.path = []; this.sweepT = onCart ? 0.3 : 0.7; }
      else { if (!this.path.length) { this.path = [V(this.target.x, 0, this.target.z)]; this.leg = null; } this.walkPath(dt, sp); }
    } else {
      // en yakın çöp: başka çöpçünün 20 sn içinde almaya gittiği çöpü almaz
      this.target = null;
      let best = null, bd = 1e9;
      for (const L of litter) { if (L.by && L.by !== this && G.time - L.byT < 20) continue; const d = Math.hypot(L.x - p.x, L.z - p.z); if (d < bd) { bd = d; best = L; } }
      if (best) { best.by = this; best.byT = G.time; this.target = best; this.path = [V(best.x, 0, best.z)]; this.leg = null; this.state = 'sweep'; }
      else { this.t -= dt; if (!this.path.length && this.t <= 0) this.idle(-50, -41, -29, -25.2, rand(3, 6)); if (this.path.length) this.walkPath(dt, sp * 0.6); }
    }
    const mv = this.moving; if (this.cart) this.moving = false; // araçtayken yürüme adımı atmaz
    this.finish(dt); this.moving = mv;
    if (this.cart) { // araç çöpçünün altında, onunla döner; fırçalar dönerken
      this.cart.position.set(p.x, 0, p.z); this.cart.rotation.y = this.obj.rotation.y;
      for (const b of this.cart.userData.brushes) b.rotation.y += dt * (this.moving || this.sweepT > 0 ? 14 : 2);
      p.y = 0.55; // koltukta oturur
    }
  }
  dispose() { if (this.cart) G.scene.remove(this.cart); super.dispose(); }
}
STAFF.sweeper = { cls: Sweeper, spd: 'swSpd' };
// gişe görevlisi: gişenin arkasında durur, bileti o satar (expand-east.js GISE x −41, z −50,6)
class TicketClerk extends Worker {
  constructor(fresh) { super({ shirt: '#9c6cf0', pants: '#2d3e66', hat: 'hair', hatColor: '#4a3020', skin: '#f3cfae' }, 'Gişe görevlisi', V(-41.0, 0, -51.25), fresh); }
  update(dt) {
    this.obj.rotation.y = lerpAngle(this.obj.rotation.y, 0, Math.min(1, dt * 6)); M.animateCharacter(this.obj, 0, dt, false);
    M.workMotion(this.obj, 'kasa', dt, !!(G.show && G.show.pile && G.show.pile.amount > 0)); // bilet keser, parayı sayar
  }
}
STAFF.ticket = { cls: TicketClerk };
STAFF.vendor = { cls: Vendor, cap: 'vCap', spd: 'vSpd' };
STAFF.waiter = { cls: Waiter, cap: 'wCap', spd: 'wSpd' };
STAFF.steward = { cls: Steward, cap: 'sCap', spd: 'sSpd' };

// Taşıyıcı: eşeğiyle (sonra tekerlekli arabayla) bölgeler arası taşır. Eşek arkasından yürür, yük eşeğin/arabanın üstünde durur.
// yük ızgara gibi dizilir: eşekte 2x2, arabada 3x2 katlar
class Load extends Stack {
  constructor(holder, cap) { super(holder, cap, 0, 0); this.cols = 2; this.rows = 2; }
  slot(i) {
    const per = this.cols * this.rows, k = i % per;
    return V(((k % this.cols) - (this.cols - 1) / 2) * 0.34, Math.floor(i / per) * 0.3, (Math.floor(k / this.cols) - (this.rows - 1) / 2) * 0.34);
  }
  update(dt) {
    const k = 1 - Math.exp(-12 * dt);
    this.items.forEach((it, i) => { if (!it.flying) it.obj.position.lerp(this.slot(i), k); });
  }
}
// bölgeler arası işler: tarladaki koçan → sahildeki kazan, köydeki ahırın sütü → dondurma makinesi
// bölgeler arası işler: { type, sink: { key, zone, room(), put(stack) }, srcs: [{ zone, avail(), give(stack) }], pri }
// yüksek öncelik önce: tatil köyü isteği (süreli) > makine girdisi > satış yeri dolumu
const on = (R) => !!(R && R.unlocked);
// karışım makinesinde (kek: un, yumurta, süt) yer her malzeme için ayrı: 2026-11-04 kullanıcı "kek tezgâhında elemanlar takılıp kilitlenmiş":
// masada 3 un varken toplam yer (9) boş görünüyordu, unlu eleman masaya gidip bırakamıyor, karar verip yine gidiyordu
const convSink = (c, t) => ({ key: c, zone: c.zone, room: () => (t && c.roomFor ? c.roomFor(t) : c.cap - c.input.length), put: (st) => c.putFrom(st) });
const shelfSink = (sh) => ({ key: sh, zone: sh.zone, room: () => sh.slots.filter((s) => !s).length, put: (st) => sh.putFrom(st) });
// ürünün bölgeler arası kaynağı: üreteç, tarla, ya da (karpuz) parası ödenerek toptancı
// boştaki yardımcıların raf işi (servisçi, servis elemanı): elindekine yer olan köy rafı ya da en boş rafın ürününün
// bedava kaynağı (bostan, kümes, makine); ücretli toptancıdan almaz
// elde kalan ürün silinmez: en yakın, yeri olan raf ya da tezgah (köy rafları, pazar tezgahı, fırın vitrini, süt dolabı)
function sinkNear(w) {
  const p = w.obj.position, types = w.stack.items.map((i) => i.type);
  return G.stations.filter((s) => typeof s.acc === 'function' && Array.isArray(s.slots) && types.some((t) => s.hasSpaceFor(t)))
    .sort((a, b) => Math.hypot(a.zone.x - p.x, a.zone.z - p.z) - Math.hypot(b.zone.x - p.x, b.zone.z - p.z))[0] || null;
}
// hiçbir yerde yer kalmamışsa (çok nadir) eli boşaltır: yoksa eleman hiçbir işe yeniden başlayamaz
function dropAll(stack) { while (stack.items.length) { const it = stack.takeOf([stack.items[0].type]); if (!it) break; if (it.obj.parent) it.obj.parent.remove(it.obj); } }
function koyShelves() { return (G.regions.koy.shelves || []).filter((sh) => sh.slots.includes(null)); }
function shelfFor(stack) { return koyShelves().find((sh) => stack.items.some((i) => sh.hasSpaceFor(i.type))) || null; }
function restockJob(w) {
  if (!w.stack || w.stack.full) return null;
  const p = w.obj.position;
  // başka elemanın gittiği kaynak geri itilir: yardımcılar aynı bostana yığılmasın
  const d = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z) + 8 * G.workers.filter((o) => o !== w && o.target === s).length;
  for (const sh of koyShelves().sort((a, b) => a.count() / a.cap - b.count() / b.cap)) {
    const free = sh.slots.filter((x) => !x).length;
    for (const k of sh.acc()) {
      const src = srcFor(k).filter((s) => s && !s.paid && s.avail() > 0).sort((a, b) => d(a) - d(b))[0];
      if (src) return { src, type: k, n: Math.min(w.stack.cap, free) };
    }
  }
  return null;
}
// genişletmelerin yeni kaynakları (expand.js G.xsrc) de sayılır
function srcFor(type) { return [...srcFor0(type), ...((G.xsrc && G.xsrc[type]) || [])]; }
function srcFor0(type) {
  if (type === 'bugday') { const H = G.regions.han, B = G.regions.tarlalar, T = G.regions.tarla; return [...(on(T) && T.wheat ? T.wheat : []), on(B) && B.gens && B.gens.bugday, ...(on(H) && H.fields ? H.fields.filter((f) => f.type === 'bugday') : [])].filter(Boolean); } // köy tarlasının buğdayı (tarım kuşağı), büyük tarla, han bahçesi
  if (type === 'kocan') { const T = G.regions.tarla, B = G.regions.tarlalar; return [on(B) && B.gens && B.gens.kocan, ...(on(T) ? T.fields || [] : [])].filter(Boolean); } // köy tarlası da büyük tarla da
  const K = G.regions.koy, S = G.regions.sahil, H = G.regions.han, Me = G.regions.mera, P = G.regions.pazar;
  const gen = { misir: S.gens && S.gens.misir, dondurma: S.gens && S.gens.dondurma, yumurta: K.gens.yumurta, peynir: K.gens.peynir, sut: K.gens.sut,
    ekmek: (on(H) && H.gens && H.gens.ekmek) || (on(G.regions.firin) && G.regions.firin.gens && G.regions.firin.gens.ekmek), corba: on(H) && H.gens && H.gens.corba, un: on(G.regions.firin) && G.regions.firin.flour, simit: on(G.regions.firin) && G.regions.firin.gens && G.regions.firin.gens.simit, pogaca: on(G.regions.firin) && G.regions.firin.gens && G.regions.firin.gens.pogaca, yogurt: on(Me) && Me.yogurt && Me.yogurt.out, ksut: on(Me) && Me.milk, yun: on(Me) && Me.gen, kilim: on(G.regions.atolye) && G.regions.atolye.loom && G.regions.atolye.loom.out,
    kocan: on(G.regions.tarlalar) && G.regions.tarlalar.gens.kocan, bugday: on(G.regions.tarlalar) && G.regions.tarlalar.gens.bugday,
    balik: on(G.regions.iskele) && G.fish && G.fish.crate, izgara: on(G.regions.iskele) && G.fish && G.fish.grill && G.fish.grill.out }[type];
  if (gen) return [gen];
  if (type === 'domates' || type === 'salatalik') return K.beds.filter((b) => b.type === type);
  const ps = on(P) && (P.sources || []).find((s) => s.types.includes(type)); // sebze kamyoneti biber de patlıcan da verir
  if (ps) return [{ paid: true, zone: ps.zone, avail: () => ((ps.stock ?? 1) > 0 && G.money >= (ITEMS[type].cost || 0) ? 1 : 0), give: (st) => ps.buyTo(st, type) === 'ok' }];
  return [];
}
function carrierJobs() {
  const S = G.regions.sahil, K = G.regions.koy, T = G.regions.tarla, Me = G.regions.mera, A = G.regions.atolye, P = G.regions.pazar, R = G.regions.tatil;
  const jobs = [];
  const add = (type, sink, srcs, pri) => { if (sink) jobs.push({ type, sink, srcs: srcs.filter(Boolean), pri }); };
  // tatil köyü: istenen ürün başka bölgeden ofis deposuna (kat görevlisi oradan evlere dağıtır).
  // İstek yokken depoda her üründen 2 tane hazır tutulur (düşük öncelik)
  if (on(R) && R.depot) {
    const D = R.depot, need = R.needs();
    for (const k of R.wantTypes()) {
      const target = need[k] > 0 ? () => Math.max(0, R.needs()[k] || 0) : () => 2;
      add(k, { key: D, zone: D.zone, room: () => Math.min(D.free(), target() - D.count(k)), put: (st) => D.putType(st, k) }, srcFor(k).filter((src) => need[k] > 0 || !src.paid), need[k] > 0 ? 4 : 1); // boşta stok için para harcanmaz
    }
  }
  const At = G.regions.atlar;
  // büyük tarlaların hasat yığınları: traktörün biçtiği koçan ve buğday
  const Ty = G.regions.tarlalar, yigin = (t) => (on(Ty) ? [Ty.gens[t]] : []);
  if (on(At) && At.harman) add('bugday', convSink(At.harman), [At.field, ...yigin('bugday')], 2);
  const Hn = G.regions.han;
  if (on(Hn) && on(Ty)) for (const c of [Hn.ovenConv, Hn.granaryConv]) if (c) add('bugday', convSink(c), yigin('bugday'), 2);
  const Fr = G.regions.firin;
  if (on(Fr) && Fr.mill) add('bugday', convSink(Fr.mill), srcFor('bugday'), 3); // köy fırınının değirmeni
  // taş fırınların unu fırıncının işi; fırıncı yetişemeyip fırın boş kalınca fırın çırağı ve taşıyıcı da götürür (2026-11-02 denetim: fırın girdisi %63 boştu)
  if (on(Fr) && Fr.ovens && Fr.flour) for (const o of Fr.ovens) if (!o.input.length) add('un', convSink(o), [Fr.flour], 2);
  // üretim zincirleri: tarladan koçan → mısır kazanı, ahırdan süt → dondurma makinesi, meradan yün → dokuma tezgahı
  if (S.cornPot && (on(T) || on(Ty))) add('kocan', convSink(S.cornPot), [...(on(T) ? T.fields : []), ...yigin('kocan')], 3);
  if (S.iceMachine) add('sut', convSink(S.iceMachine), srcFor('sut'), 3);
  if (on(A) && A.loom && on(Me)) add('yun', convSink(A.loom), srcFor('yun'), 3);
  // satış yerleri: kilim, yün, köy sebzesi pazar tezgahına; koyun sütü ve yoğurt köydeki süt dolabına
  if (on(P) && P.stallOf) for (const t of ['kilim', 'yun', 'domates', 'salatalik']) if (P.stallOf[t]) add(t, shelfSink(P.stallOf[t]), srcFor(t), 1); // her ürünün kendi tezgahı
  const dolap = (t) => K.shelfByType && K.shelfByType[t]; // her ürünün kendi dolabı
  for (const t of ['ksut', 'yogurt']) if (dolap(t)) add(t, shelfSink(dolap(t)), srcFor(t), 1);
  // meranın yoğurt küpü koyun sütüyle beslenir (yoğurt sütten değerli). Eskiden iş listesinde yoktu, küp %96 boş duruyordu (2026-11-02 denetim)
  if (on(Me) && Me.yogurt) add('ksut', convSink(Me.yogurt), srcFor('ksut'), 2);
  // iskele: buzlu kasadaki balık ızgaraya (balıkçı çırağı; eskiden yalnız boştaki restoran garsonu taşıyordu: kasa dolunca balıkçılar
  // %50 boşta bekliyor, ızgara boş kalıyor, iskele müşterisinin %29'u kızıyordu. 2026-11-02 denetim)
  const Fi = G.fish;
  if (Fi && Fi.grill && Fi.crate) add('balik', convSink(Fi.grill), [Fi.crate], 3);
  // çiftlik uzakta: süt, peynir ve yumurtayı eşek toplu taşır (rafçılar köy içine yetişir), mandıraya da süt
  for (const t of ['sut', 'peynir']) if (dolap(t)) add(t, shelfSink(dolap(t)), srcFor(t), 2);
  const yr = K.shelfByType && K.shelfByType.yumurta;
  if (yr) add('yumurta', shelfSink(yr), srcFor('yumurta'), 2);
  if (K.dairy) add('sut', convSink(K.dairy), srcFor('sut'), 2);
  // genişletmelerin makineleri (girdi masası) ve yeni ürünlerin satış yerleri (expand.js G.xsink, G.xsell)
  for (const x of G.xsink || []) add(x.type, convSink(x.conv, x.type), srcFor(x.type), x.pri || 3);
  for (const x of G.xsell || []) { const sh = x.shelf && x.shelf(); if (sh && sh.acc && sh.acc().includes(x.type)) add(x.type, shelfSink(sh), srcFor(x.type), 1); }
  return jobs;
}
class Carrier extends Worker {
  constructor(fresh, n = 0, o = {}) {
    super(o.look || { shirt: '#8d6e63', pants: '#4e5d6c', hat: 'straw', skin: '#e0b48a' }, o.name || (n ? `Taşıyıcı ${n + 1}` : 'Taşıyıcı'), o.pos || V(-31 + n * 1.5, 0, -0.2), fresh);
    this.role = o.role || 'carrier';
    this.speed = 2.6;
    this.donkey = M.makeDonkey();
    this.donkey.position.set(this.obj.position.x, 0, this.obj.position.z - 1.2);
    G.scene.add(this.donkey);
    if (fresh) popIn(this.donkey, 0.1);
    this.stack = new Load(this.donkey.userData.saddle, 6);
    this.trail = [this.obj.position.clone()];
    this.acts = {
      harvest: { every: 0.2, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
      deliver: { every: 0.15, act: () => this.target.room() > 0 && this.target.put(this.stack) },
    };
  }
  // araba yükseltmesi: eşek arkasına iki tekerlekli araba bağlanır, yük arabaya geçer
  setCart(on) {
    if (!on || this.cart) return;
    this.cart = M.makeCart();
    this.cart.position.set(0, 0, -1.25);
    this.donkey.add(this.cart);
    popIn(this.cart);
    this.cart.userData.bed.add(this.stack.anchor);
    this.stack.cols = 3;
  }
  // bölgeler arası ne lazımsa: önce elindekini ihtiyacı olan yere götürür (yük eksikse tamamlar), sonra en öncelikli
  // ve kaynağı dolu işe başlar. Başka taşıyıcının üstlendiği miktar düşülür: iki eşek aynı işe yığılmaz
  decide() {
    const jobs = this.jobs(), p = this.obj.position, mates = (G.staff[this.role] || []).filter((w) => w !== this);
    const claimed = (j) => mates.reduce((n, w) => n + (w.job && w.job.sink.key === j.sink.key && w.job.type === j.type ? Math.max(w.stack.count(j.type), w.feedN || 0) : 0), 0);
    const need = (j) => j.sink.room() - claimed(j);
    const d = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z), at = (s) => V(s.zone.x + rand(-0.5, 0.5), 0, s.zone.z + rand(-0.3, 0.3));
    const nearest = (j) => j.srcs.filter((s) => s.avail() > 0).sort((a, b) => d(a) - d(b))[0];
    for (const j of jobs.filter((x) => this.stack.count(x.type) > 0).sort((a, b) => b.pri - a.pri)) {
      const n = this.stack.count(j.type), room = need(j);
      if (room <= 0) continue;
      this.job = j;
      const src = !this.stack.full && n < room && nearest(j);
      if (src) { this.feedType = j.type; this.feedN = Math.min(this.stack.cap, room); return this.go('harvest', src, at(src)); }
      this.feedN = 0;
      return this.go('deliver', j.sink, at(j.sink));
    }
    if (!this.stack.full) for (const j of jobs.sort((a, b) => b.pri - a.pri || need(b) - need(a))) {
      const room = need(j), src = room > 0 && nearest(j);
      if (!src) continue;
      this.job = j; this.feedType = j.type;
      this.feedN = this.stack.count(j.type) + Math.min(room, this.stack.cap - this.stack.items.length);
      return this.go('harvest', src, at(src));
    }
    this.job = null; this.feedN = 0;
    this.idleBox();
  }
  jobs() { return carrierJobs(); }
  idleBox() { this.idle(-32, -30, -0.8, 0.6, 2); } // tarladaki suluğun başında bekler
  update(dt) {
    this.moving = false;
    this.step(dt, this.acts);
    const p = this.obj.position;
    p.y += (heightAt(p.x, p.z) - p.y) * Math.min(1, dt * 12);
    M.animateCharacter(this.obj, this.moving ? 1 : 0, dt, false);
    this.followDonkey(dt);
    this.stack.update(dt);
  }
  // eşek sahibinin geçtiği yoldan 1,2 m geriden yürür: köşeleri kesip duvara girmez
  followDonkey(dt) {
    const p = this.obj.position, t = this.trail;
    if (p.distanceTo(t[t.length - 1]) > 0.12) { t.push(p.clone()); if (t.length > 60) t.shift(); }
    let need = this.cart ? 1.35 : 1.15, at = t[0];
    let prev = p;
    for (let i = t.length - 1; i >= 0; i--) {
      const d = prev.distanceTo(t[i]);
      if (d >= need) { at = prev.clone().lerp(t[i], need / d); break; }
      need -= d; prev = t[i]; at = t[i];
    }
    const D = this.donkey, moved = Math.hypot(at.x - D.position.x, at.z - D.position.z);
    D.position.x = at.x; D.position.z = at.z; D.position.y = heightAt(at.x, at.z);
    const ax = p.x - D.position.x, az = p.z - D.position.z;
    if (Math.hypot(ax, az) > 0.3) D.rotation.y = lerpAngle(D.rotation.y, Math.atan2(ax, az), 1 - Math.exp(-8 * dt));
    M.animateDonkey(D, Math.min(1, moved / Math.max(1e-4, dt * this.speed)), dt);
    if (this.cart) for (const w of this.cart.userData.wheels) w.rotation.x += moved / 0.4;
  }
}
STAFF.carrier = { cls: Carrier, cap: 'cCart', spd: 'cSpd' };

// Sütçü: çiftliğin eşekli dağıtıcısı. Taşıyıcının işlerinden yalnızca çiftlik ürünlerini alır: süt, yumurta ve peyniri
// köydeki dolaba ve raflara, sütü mandıraya ve büfenin dondurma makinesine götürür; boşta ahırın önünde bekler
const DAIRY = ['sut', 'yumurta', 'peynir'];
class Sutcu extends Carrier {
  constructor(fresh, n = 0) {
    super(fresh, n, { role: 'milkman', name: n ? `Sütçü ${n + 1}` : 'Sütçü', pos: V(38 + n * 1.5, 0, -21),
      look: { shirt: '#f4f4f4', pants: '#3d7dd8', hat: 'cap', hatColor: '#3d7dd8', skin: '#e0b48a', mustache: true } });
    this.speed = 2.8;
  }
  // önce köydeki dolap ve raflar, sonra mandıra, en son büfenin dondurma makinesi (onu garsonlar ve taşıyıcı da besler). Makinede süt
  // de dondurma da 3'ün altına inince dondurma en öne geçer: sahil müşterisi dondurma bekleyip kızgın gidiyordu (2026-11-05 denetimi:
  // oyuncu başka yerdeyken sahildekilerin yarısı; kullanıcı seçimi "yalnız sütçü önceliği")
  jobs() {
    const ice = G.regions.sahil.iceMachine, low = ice && ice.input.length < 3 && ice.out.avail() < 3;
    return carrierJobs().filter((j) => DAIRY.includes(j.type)).map((j) => ({ ...j, pri: j.sink.key === ice ? (low ? 5 : 1) : Array.isArray(j.sink.key.slots) ? 4 : 3 }));
  }
  idleBox() { this.idle(36, 41, -22, -20, 2); }
}
STAFF.milkman = { cls: Sutcu, cap: 'mkCap', spd: 'mkSpd' };

// Bölüm görevlisi: elinde taşır (eşeksiz). Taşıyıcının işlerinden yalnızca kendi bölgesine (ve açılan bölümlerine) dokunanları
// alır: makinesi ya da satış yeri bölgedeyse iş onundur; değilse yalnız bölgedeki kaynaklardan götürür. Parayla alınan
// mal (kamyon, toptancı) almaz. Boşta bölgenin girişinde bekler
class BolumGorevlisi extends Worker {
  constructor(fresh, n, r) {
    const [name, shirt] = ATT[r], e = regionEntry(r) || [0, 0, 0];
    super({ shirt, pants: '#3a4a5a', hat: 'cap', hatColor: '#ffffff', skin: n % 2 ? '#c99a6e' : '#e0b48a' }, n ? `${name} ${n + 1}` : name, V(e[0] + n * 1.2, 0, e[2]), fresh, 3);
    this.role = `att_${r}`; this.region = r; this.speed = 2.6;
    this.acts = {
      harvest: { every: 0.22, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
      deliver: { every: 0.18, act: () => this.target.room() > 0 && this.target.put(this.stack) },
    };
  }
  decide() { return Carrier.prototype.decide.call(this); }
  jobs() {
    const r = this.region, rects = [G.regions[r].rect, ...(G.annexes || []).filter((a) => a.region === r).map((a) => a.rect)];
    const inside = (st) => st && st.zone && rects.some((q) => st.zone.x >= q[0] - 1 && st.zone.x <= q[1] + 1 && st.zone.z >= q[2] - 1 && st.zone.z <= q[3] + 1);
    // bölümün ürününü dışarıya en çok 200 m götürür: şehir köyden ~400 m uzakta, oraya kamyon taşır (city.js). 2026-11-04: Çiçekçi
    // çiçeği şehrin hediyelik dükkânına, rençper ayçiçeğini şehir marketine yürüyerek götürüyor, dakikalarca bölümünden ayrılıyordu
    const e = regionEntry(r) || [0, 0, 0], near = (st) => Math.hypot(st.zone.x - e[0], st.zone.z - e[2]) < 200;
    return carrierJobs().flatMap((j) => {
      const srcs = j.srcs.filter((st) => !st.paid);
      if (inside(j.sink)) return srcs.length ? [{ ...j, srcs }] : [];
      if (!j.sink.zone || !near(j.sink)) return [];
      const own = srcs.filter(inside);
      return own.length ? [{ ...j, srcs: own }] : [];
    });
  }
  idleBox() { const e = regionEntry(this.region) || [0, 0, 0]; this.idle(e[0] - 2, e[0] + 2, e[2] - 1.2, e[2] + 1.2, 2); }
}
for (const r of Object.keys(ATT)) STAFF[`att_${r}`] = { cls: class extends BolumGorevlisi { constructor(f, n) { super(f, n, r); } }, cap: `atC_${r}`, spd: `atS_${r}` };

// ---------- menü ----------
const ICONS = {
  cap: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="9" y="20" width="14" height="7" rx="2" fill="#e8604c"/><rect x="10" y="12" width="12" height="7" rx="2" fill="#f6c343"/><rect x="11" y="4" width="10" height="7" rx="2" fill="#56c27e"/></svg>',
  spd: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18 3 7 18h7l-2 11 11-15h-7z" fill="#ffb627" stroke="#c97a00" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  person: (c, h) => `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="10" r="6" fill="#f3cfae"/><path d="M6 29c0-7 4.5-11 10-11s10 4 10 11z" fill="${c}" stroke="#d8d0c0" stroke-width="${c === '#ffffff' ? 1 : 0}"/><path d="M9.6 9.5a6.4 6.4 0 0 1 12.8 0z" fill="${h}"/></svg>`,
};
// Muhasebeci: dolan kasaları dolaşıp parayı çantasına toplar; çanta dolunca ya da toplanacak kasa kalmayınca kasaba
// meydanındaki bankaya yatırır (bank.js G.bank), yatırılan para hesabına geçer. Arkadaşının gittiği kasaya gitmez.
// 2026-11-08 kullanıcı: "Muhasebecinin rotasında şehir marketi yoksa ekle. Kendi arabasıyla gidip gelsin tahsilata": şehir marketinin
// kasalarında para birikince biri bankanın arkasındaki arabasıyla şehre gider, kasaları boşaltıp döner (tahsilat.js)
class Muhasebeci extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#f4f4f4', pants: '#2d3e66', hat: 'hair', hatColor: '#3a2a1a', skin: '#e9b98f', mustache: n % 2 === 0 }, n ? `Muhasebeci ${n + 1}` : 'Muhasebeci', V(-51.2 + n * 1.2, 0, -29.4), fresh);
    this.name = n ? `Muhasebeci ${n + 1}` : 'Muhasebeci';
    this.speed = 3.0; this.bag = 0; this.bagCap = 600;
    // çanta yükseltmesi apply'da stack.cap'e yazılır: para ayrı tutulur, sırtında ürün taşımaz
    const self = this;
    this.stack = { items: [], update() {}, get cap() { return self.bagCap; }, set cap(v) { self.bagCap = v; } };
    M.rbox(0.36, 0.26, 0.1, 0.03, M.mat('#3a2a1a'), 0.32, 0.5, 0.06, this.obj); // evrak çantası
    // topladığı para kollarında deste deste taşınır: bankaya giderken görünür (20 ₺'ye bir deste, en çok 12)
    this.cash = new THREE.Group(); this.cash.position.set(0, 0.98, 0.42); this.obj.add(this.cash); this.shown = -1;
    this.acts = { collect: { every: 0.05, act: () => this.collect() }, deposit: { every: 0.4, act: () => this.deposit() } };
  }
  // kasanın müşteri tarafı: tezgahtarın karşısı
  front(pile) {
    const z = pile.zone;
    const k = pile.clerk ? pile.clerk.position : pile.spot;
    if (!k) return V(z.x + rand(-0.4, 0.4), 0, z.z + 1.3);
    const dx = z.x - k.x, dz = z.z - k.z, d = Math.hypot(dx, dz) || 1;
    return V(z.x + (dx / d) * 1.3, 0, z.z + (dz / d) * 1.3);
  }
  collect() {
    const p = this.target;
    if (!p || p.amount <= 0 || this.bag >= this.bagCap) return false;
    const n = p.bills.length, take = Math.min(p.amount, n ? Math.ceil(p.amount / n) : p.amount, this.bagCap - this.bag);
    p.amount -= take; this.bag += take;
    if (p.amount < 0.5) p.amount = 0;
    if (n) { const b = p.bills.pop(); fly(b, this.obj, V(0, 1.1, 0.42), 0.22, 0.6, (o) => o.parent && o.parent.remove(o)); }
    return true;
  }
  deposit() {
    if (G.bank && this.bag > 0) {
      for (const [i, b] of this.cash.children.slice().entries()) fly(b, G.regions.kasaba.bankObj, V(1.9, 0.6, 0), 0.2 + i * 0.04, 0.5, (o) => o.parent && o.parent.remove(o));
      G.bank.deposit(this.bag, this.obj); this.bag = 0; this.shown = 0;
    }
    return false;
  }
  showCash() {
    const n = this.bag > 0 ? Math.min(12, Math.ceil(this.bag / 20)) : 0;
    if (n === this.shown) return;
    while (this.cash.children.length > n) this.cash.remove(this.cash.children[this.cash.children.length - 1]);
    while (this.cash.children.length < n) { const b = M.makeBillMesh(); b.position.set(0, this.cash.children.length * 0.072, 0); b.rotation.y = (this.cash.children.length % 2) * 0.12; this.cash.add(b); }
    this.shown = n;
    this.tag.el.textContent = this.bag > 0 ? `${this.name} · 💼 ${Math.floor(this.bag)} ₺` : this.name;
  }
  update(dt) {
    if (this.trip) { // şehir tahsilatı: arabaya yürür, gider, kasaları boşaltır, döner (tahsilat.js)
      tripStep(this, dt); this.showCash();
      if (this.bag > 0 && this.obj.visible) { const u = this.obj.userData; u.arms[0].rotation.x = u.arms[1].rotation.x = -1.25; }
      return;
    }
    super.update(dt);
    this.showCash();
    if (this.bag > 0) { const u = this.obj.userData; u.arms[0].rotation.x = u.arms[1].rotation.x = -1.25; } // parayı önünde taşır
  }
  decide() {
    const B = G.bank;
    if (!B) return this.idle(-51.6, -50.4, -32, -29, 3);
    const mates = (G.staff.accountant || []).filter((w) => w !== this), p = this.obj.position, d = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
    const piles = G.stations.filter((s) => s instanceof MoneyPile && s.amount >= 25 && s.zone.x < 300 && !mates.some((w) => w.target === s && w.state === 'collect')); // şehirdeki kasalara yürüyerek gitmez: arabasıyla gider
    if (this.bag >= this.bagCap * 0.9 || (this.bag > 0 && !piles.length)) return this.go('deposit', null, V(B.door.x + 0.5, 0, B.door.z + rand(-0.5, 0.5)));
    if (tripWanted(this, piles)) return startTrip(this); // şehir marketinin kasaları köydekinden doluysa arabasıyla tahsilata
    const best = piles.sort((a, b) => b.amount - d(b) * 1.5 - (a.amount - d(a) * 1.5))[0];
    if (best) return this.go('collect', best, this.front(best));
    this.idle(-51.6, -50.2, -32.4, -28.8, 3); // bankanın önünde bekler
  }
}
STAFF.accountant = { cls: Muhasebeci, cap: 'acCap', spd: 'acSpd' };

// Servisçi: başka bölgenin ürününü isteyen müşterinin (requests.js G.requests) ürününü kaynağından alıp götürür.
// Arkadaşının üstlendiği isteğe girmez
class Servisci extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#ffffff', pants: '#2f6b4a', hat: 'cap', hatColor: '#3fae6b', skin: '#e0b48a' }, n ? `Ayakçı ${n + 1}` : 'Ayakçı', V(-11.2 + n * 1.0, 0, -1.4), fresh, 2);
    this.speed = 3.2;
    this.acts = {
      take: { every: 0.25, act: () => !this.stack.full && this.stack.count(this.wantType) < this.want && this.target.give(this.stack) },
      give: { every: 0.2, act: () => !!this.job && !this.job.done && this.target.putFrom(this.stack) },
      put: { every: 0.2, act: () => this.stack.items.some((i) => this.target.putType(this.stack, i.type)) },
      shelf: { every: 0.2, act: () => this.target.putFrom(this.stack) },
    };
  }
  decide() {
    const reqs = (G.requests || []).filter((q) => !q.done && q.drop);
    const mates = (G.staff.server || []).filter((w) => w !== this), p = this.obj.position, d = (s) => Math.hypot(s.zone.x - p.x, s.zone.z - p.z);
    // elinde bekleyen müşterinin ürünü varsa ona götürür
    const q = reqs.find((r) => this.stack.count(r.type) > 0 && (!r.by || r.by === this));
    if (q) { q.by = this; this.job = q; const c = q.c.obj.position; return this.go('give', q.drop, V(c.x + rand(-0.4, 0.4), 0, c.z + 0.9)); }
    // raf için getirdiğini ya da artık istenmeyeni silmez: en yakın, yeri olan rafa ya da tezgaha dizer
    if (this.stack.items.length) { const sh = sinkNear(this); if (sh) return this.go('shelf', sh, V(sh.zone.x + rand(-0.6, 0.6), 0, sh.zone.z)); if (this.stack.full) dropAll(this.stack); }
    this.job = null;
    const fetch = (k, n) => {
      const src = srcFor(k).filter((s) => s && s.avail() > 0 && (!s.paid || G.money > 200)).sort((a, b) => d(a) - d(b))[0];
      if (!src) return false;
      this.wantType = k; this.want = Math.min(this.stack.cap, n);
      this.go('take', src, V(src.zone.x + rand(-0.5, 0.5), 0, src.zone.z + rand(-0.3, 0.3)));
      return true;
    };
    for (const r of reqs) { if (r.by && r.by !== this && mates.includes(r.by)) continue; r.by = this; if (fetch(r.type, 1)) return; r.by = null; }
    const j = restockJob(this); // istek yokken boş durmaz: rafçıya yardım edip en boş köy rafını doldurur
    if (j) { this.wantType = j.type; this.want = j.n; return this.go('take', j.src, V(j.src.zone.x + rand(-0.5, 0.5), 0, j.src.zone.z + rand(-0.3, 0.3))); }
    this.idle(...staffIdle(), 2);
  }
}
STAFF.server = { cls: Servisci, cap: 'svCap', spd: 'svSpd' };

// Balıkçı: iskelenin ucundan olta atar; tekne yükseltmesiyle (G.mods.fsBoat) kayıkla açığa çıkıp ağ atar, yükü doldurup
// döner. Tuttuğunu balık tezgahına dizer; restoran açıksa ve buzlu kasa azsa önce kasaya koyar (fishing.js G.fish)
class Balikci extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#f2c14e', pants: '#2d3e66', hat: 'cap', hatColor: '#2f6db5', skin: '#c68e5f', mustache: true }, n ? `Balıkçı ${n + 1}` : 'Balıkçı', G.fish ? G.fish.rodAt(n) : V(-33.4, 0, 42.6), fresh, 4);
    this.n = n; this.speed = 2.8; this.trip = null; this.catchT = 0;
    this.rod = M.cyl(0.015, 0.022, 1.8, 6, M.mat('#5a3a22'), 0.25, 1.15, 0.6, this.obj); this.rod.rotation.x = 0.85; this.rod.visible = false;
    this.acts = {
      put: { every: 0.2, act: () => this.target.putFrom(this.stack) },
      fish: { every: 0.25, act: () => this.fishTick() },
    };
  }
  // oltayla: kendi hızına göre birkaç saniyede bir balık; elinde birkaç tane olunca götürür
  fishTick() {
    this.rod.visible = true;
    this.obj.rotation.y = lerpAngle(this.obj.rotation.y, 0, 0.3);
    this.catchT += 0.25;
    if (this.catchT < 14 / this.speed) return true;
    this.catchT = 0;
    const p = this.obj.position, it = makeItem('balik'); it.position.set(p.x, -0.1, p.z + 2.4); G.scene.add(it);
    this.stack.push('balik', it, 0.45);
    return this.stack.items.length < this.stack.cap; // kapasite yükseltmesi oltada da işe yarar
  }
  decide() {
    const F = G.fish;
    this.rod.visible = false;
    if (!F || !F.stall) return this.idle(-34, -32.8, 41.8, 42.6, 2);
    if (this.stack.items.length) {
      const crateFirst = F.grill && F.crate.items.length < 6;
      const toStall = F.stall.hasSpaceFor('balik'), toCrate = F.crate.items.length < F.crate.max;
      if (toCrate && (crateFirst || !toStall)) return this.go('put', F.crate, V(F.crate.zone.x + rand(-0.4, 0.4), 0, F.crate.zone.z));
      if (toStall) return this.go('put', F.stall, V(F.stall.zone.x + rand(-0.8, 0.8), 0, F.stall.zone.z));
      return this.idle(-34, -32.8, 41.8, 42.6, 3); // tezgah da kasa da dolu: bekler
    }
    if (G.mods && G.mods.fsBoat && F.boat && !F.boat.busy) { F.boat.busy = this; this.state = 'boat'; this.trip = { step: 'board' }; return; }
    this.go('fish', null, F.rodAt(this.n));
  }
  // kayık: iskeleden iner, açığa kürek çeker, ağ atar, yükü doldurup döner
  boatStep(dt) {
    const F = G.fish, B = F.boat, tr = this.trip, p = this.obj.position;
    const seat = () => { const s = B.userData.seat, c = Math.cos(B.rotation.y), sn = Math.sin(B.rotation.y); p.set(B.position.x + s.x * c + s.z * sn, B.position.y + s.y, B.position.z - s.x * sn + s.z * c); this.obj.rotation.y = B.rotation.y; };
    const row = (to, sp) => { const dx = to.x - B.position.x, dz = to.z - B.position.z, d = Math.hypot(dx, dz); B.rotation.y = lerpAngle(B.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-2 * dt)); if (d < 0.3) return true; B.position.x += (dx / d) * Math.min(d, sp * dt); B.position.z += (dz / d) * Math.min(d, sp * dt); return false; };
    B.position.y = -0.18 + Math.sin(G.time * 1.4) * 0.05;
    switch (tr.step) {
      case 'board': if (this.walkTo(F.board, dt, this.speed)) { tr.step = 'out'; tr.to = F.seaSpot(); } break;
      case 'out': seat(); if (row(tr.to, 2.6)) { tr.step = 'net'; tr.t = 4; } break;
      case 'net':
        seat(); tr.t -= dt;
        if (Math.floor(tr.t * 2) !== tr.k) { tr.k = Math.floor(tr.t * 2); ring(V(B.position.x + 1.0, -0.15, B.position.z), '#ffffff', 1.1); }
        if (tr.t <= 0) {
          while (!this.stack.full) { const it = makeItem('balik'); it.position.set(B.position.x + 1.0, -0.1, B.position.z); G.scene.add(it); this.stack.push('balik', it, 0.5); }
          tr.step = 'back';
        }
        break;
      case 'back': seat(); if (row(F.boatHome, 2.6)) { B.rotation.y = 0; p.set(F.board.x, 0, F.board.z); B.busy = null; this.trip = null; this.state = 'decide'; } break;
    }
  }
  update(dt) {
    if (this.state !== 'boat') { super.update(dt); return; }
    this.moving = false;
    this.boatStep(dt);
    const inBoat = this.trip && this.trip.step !== 'board', y = this.obj.position.y;
    this.finish(dt);
    if (inBoat) { this.obj.position.y = y; for (const l of this.obj.userData.legs) l.rotation.x = -1.35; this.obj.userData.arms[0].rotation.x = this.obj.userData.arms[1].rotation.x = -1.0 + Math.sin(G.time * 4) * 0.5; }
  }
}
STAFF.fisher = { cls: Balikci, cap: 'fsCap', spd: 'fsSpd' };

// Restoran garsonu: ızgaradan tabağı alıp bekleyen masaya götürür; boşta ızgarayı buzlu kasadan balıkla besler
class Garson extends Worker {
  constructor(fresh, n = 0) {
    super({ shirt: '#ffffff', pants: '#1d1f24', hat: 'hair', hatColor: '#2a2a2a', skin: '#e9b98f' }, n ? `Restoran garsonu ${n + 1}` : 'Restoran garsonu', V(-28.6 + n * 0.9, 0, 36.2), fresh, 2);
    this.speed = 3.0;
    this.acts = {
      take: { every: 0.25, act: () => this.stack.count(this.wantType || 'izgara') < this.want && this.target.give(this.stack) },
      serve: { every: 0.2, act: () => this.target.putFrom(this.stack) },
      feed: { every: 0.2, act: () => this.target.putFrom(this.stack) },
      harvest: { every: 0.2, act: () => this.stack.count(this.feedType) < this.feedN && this.target.give(this.stack) },
    };
  }
  // Masadaki müşteri ızgara ya da balık çorbası ister (fishing.js c.want). Garson elindekini yalnız onu isteyen masaya götürür, eksik
  // yemeği türüne göre alır: ızgarayı ızgaradan, çorbayı kazandan (expand-west.js xiskele2). 2026-11-02 kullanıcı: "balıkçıda garsonlar
  // takılıyor, müşteriler hizmet alamıyor": eskiden yalnız ızgara taşıyordu, çorba isteyen masaya ızgarayla gidip bırakamıyor, aynı masayı
  // yeniden seçip orada kalıyordu; ızgara bekleyen masalar da sıra alamıyordu
  decide() {
    const F = G.fish;
    if (!F || !F.grill) return this.idle(-29.2, -27.8, 35.6, 36.6, 2);
    const p = this.obj.position, d = (s) => Math.hypot(s.x - p.x, s.z - p.z);
    const seats = F.tables.flatMap((t) => t.waiting().map((s) => ({ t, type: s.c.want || 'izgara' })));
    const mine = seats.filter((s) => this.stack.count(s.type) > 0);
    if (mine.length) { const t = mine.sort((a, b) => d(a.t) - d(b.t))[0].t; return this.go('serve', t, t.servePoint()); }
    // isteyeni gitmiş yemek elde yer tutmasın (soğudu, mutfağa döndü): eli doluyken ve başka yemek bekleniyorsa biri bırakılır
    if (this.stack.full && seats.length) { const it = this.stack.takeOf([this.stack.items[0].type]); if (it && it.obj.parent) it.obj.parent.remove(it.obj); }
    const mates = (G.staff.rwaiter || []).filter((w) => w !== this);
    const srcOf = (type) => (type === 'izgara' ? (F.grill.out.items.length ? F.grill.out : null) : srcFor(type).find((s) => s && s.avail && s.avail() > 0) || null);
    for (const type of [...new Set(seats.map((s) => s.type))]) {
      const need = seats.filter((s) => s.type === type).length - mates.reduce((n, w) => n + w.stack.count(type), 0) - this.stack.count(type);
      const o = need > 0 && srcOf(type);
      if (o) { this.wantType = type; this.want = Math.min(this.stack.cap, this.stack.count(type) + need); return this.go('take', o, V(o.zone.x + rand(-0.3, 0.3), 0, o.zone.z)); }
    }
    if (this.stack.items.some((i) => !['izgara', 'balikcorba', 'balik'].includes(i.type))) while (this.stack.items.length) { const it = this.stack.takeOf([this.stack.items[0].type]); if (!it) break; if (it.obj.parent) it.obj.parent.remove(it.obj); }
    // ızgara buzlu kasadaki balıkla beslenir; ızgara doluysa elde kalan balık iskeledeki çorba kazanına (xiskele2) gider
    const pots = (G.xsink || []).filter((x) => x.type === 'balik' && x.conv && x.conv.zone.z > 30 && x.conv.zone.x < -15).map((x) => ({ conv: x.conv, srcs: [F.crate] }));
    if (this.feed([{ conv: F.grill, srcs: [F.crate] }, ...pots])) return;
    this.idle(-29.2, -27.8, 35.6, 36.6, 2);
  }
}
STAFF.rwaiter = { cls: Garson, cap: 'rwCap', spd: 'rwSpd' };

const ICON_OF = {
  cap: ICONS.cap, spd: ICONS.spd,
  cashier: ICONS.person('#f28db2', '#e8604c'), shelver: ICONS.person('#9c8cf0', '#ffffff'),
  vendor: ICONS.person('#f6c343', '#f0d38a'), waiter: ICONS.person('#ffffff', '#2a2a2a'), steward: ICONS.person('#3aa6a0', '#e0b04a'),
  lifeguard: ICONS.person('#e8473c', '#ffd23f'), courier: ICONS.person('#ff8a3d', '#2d3e66'), guard: ICONS.person('#2d3e66', '#1f2a44'), groom: ICONS.person('#8a5a33', '#f0d38a'), baker: ICONS.person('#ffffff', '#f6c343'),
  maid: ICONS.person('#3ec1b5', '#ffffff'), recep: ICONS.person('#3ec1b5', '#3a2416'),
  weaver: ICONS.person('#b23a48', '#e0b04a'),
  accountant: ICONS.person('#f4f4f4', '#3a2a1a'), server: ICONS.person('#ffffff', '#3fae6b'),
  fisher: ICONS.person('#f2c14e', '#2f6db5'), rwaiter: ICONS.person('#ffffff', '#2a2a2a'), sweeper: ICONS.person('#ff8a1e', '#2d3e66'),
  artist: ICONS.person('#9c6cf0', '#2a2a2a'), ticket: ICONS.person('#9c6cf0', '#4a3020'),
};
for (const d of DESKS) ICON_OF[d.id] = ICONS.person('#f28db2', '#3a2416');
ICON_OF.milkman = ICONS.person('#f4f4f4', '#3d7dd8');
for (const [r, [, shirt]] of Object.entries(ATT)) ICON_OF[`att_${r}`] = ICONS.person(shirt, '#ffffff');
const iconOf = (id) => ICON_OF[id] || UPG[id].icon || (UPG[id].fmt === pcs || id.startsWith('mc_') ? ICONS.cap : ICONS.spd);

let menuEl, listEl, btnEl, tabsEl, tab = 'oyuncu', refreshT = 0;

// ana menünün "Yükseltmeler" bölümü aynı paneli kendi içine alır
export function mountUpgrades(container) { container.appendChild(tabsEl); container.appendChild(listEl); render(); }
export function unmountUpgrades() { const card = menuEl.querySelector('.mcard'); card.appendChild(tabsEl); card.appendChild(listEl); }
// menü bölgelere ayrılır: solda bölge listesi, sağda o bölgenin elemanları, makineleri ve geliştirmeleri kartlarla.
// Seviyesi gelmeyen (gizli) bölge listede yok; görünen ama açılmamış bölge soluk durur
// köy raflarını dört rol doldurur: bilerek yedekli. Menüde farkları anlatılır (denetim raporu: rol farkları kartı)
const ROLES = [
  ['🧺', 'Rafçı', 'Köy dükkânının raflarını doldurur: ürünü bostandan, kümesten, ahırdan getirir; gerekirse makinede ürettirir.'],
  ['🛵', 'Araba servisçisi', 'Otoparkta arabada bekleyen müşterinin siparişini toplar; sipariş yokken rafa yardım eder.'],
  ['🍽️', 'Ayakçı', 'Başka bölgenin ürününü isteyen müşteriye ürünü kaynağından getirir; boşta raflara yardım eder.'],
  ['🐴', 'Taşıyıcı', 'Bölgeler arası toptan taşır: koçan, buğday, süt, yün, kilim. Uzak bölgedeki makineyi ve rafı besler.'],
].map(([i, n, d]) => `<p><b>${i} ${n}</b> ${d}</p>`).join('') + '<p class="unote">İpucu: önce Rafçı al. Araba servisçisi otopark, Ayakçı uzak istekler, Taşıyıcı bölgeler arası mal için.</p>';
const AREAS = [
  { id: 'oyuncu', icon: '🧑‍🌾', name: 'Bakkal (sen)', desc: 'Sırtında taşıdığın ürün sayısı, yürüme hızın ve yeteneklerin', ups: ['cap', 'spd'], skills: ['jump', 'sprint', 'magnet'] },
  { id: 'koy', icon: '🏡', name: 'Köy Bakkalı', region: 'koy', roles: true, desc: 'Dükkanın, rafların ve bahçen', staff: ['cashier', 'shelver', 'courier', 'guard'], ups: ['rafTakip', 'rk_koy', 'rf_domates', 'rf_salatalik', 'rf_yumurta', 'rf_sut', 'sulama'] },
  { id: 'ciftlik', icon: '🐄', name: 'Çiftlik', region: 'ciftlik', desc: 'Kümes, ahır ve mandıra', staff: ['milkman'], machines: ['peynir'], ups: ['a_tavuk', 'a_inek'] },
  { id: 'pazar', icon: '🍉', name: 'Semt Pazarı', region: 'pazar', desc: 'Tezgahın, toptancı ve sebze kamyoneti', staff: ['vendor'], ups: ['rk_pazar'] },
  { id: 'sahil', icon: '🏖️', name: 'Sahil Büfesi', region: 'sahil', desc: 'Mısır kazanı, dondurma, şezlonglar ve kuleler', staff: ['waiter', 'lifeguard'], machines: ['misir', 'dondurma'] },
  { id: 'mera', icon: '🐑', name: 'Koyun Merası', region: 'mera', desc: 'Yün, koyun sütü ve yoğurt', machines: ['yun', 'ksut', 'yogurt'] },
  { id: 'atolye', icon: '🧶', name: 'Dokuma Atölyesi', region: 'atolye', desc: 'Dokumacı kadınlar yünü tezgahta kilime dokur', staff: ['weaver'], machines: ['kilim'] },
  { id: 'han', icon: '🐫', name: 'Kervansaray Hanı', region: 'han', desc: 'Kervan siparişleri: ekmek, çorba, yem', staff: ['steward'], machines: ['ekmek', 'corba', 'yem'] },
  { id: 'atlar', icon: '🐎', name: 'At Ahırı', region: 'atlar', desc: 'Atlı müşterilerin bakımı', staff: ['groom'], machines: ['saman'] },
  { id: 'firin', icon: '🥯', name: 'Köy Fırını', region: 'firin', desc: 'Ekmek, simit, poğaça ve vitrin', staff: ['baker'], machines: ['fekmek', 'simit', 'pogaca'], ups: ['rk_firin'] },
  { id: 'tatil', icon: '🐚', name: 'Kabuk Tatil Köyü', region: 'tatil', desc: 'Kabuk evler, misafirler ve çamaşırhane', staff: ['recep', 'maid'], machines: ['havlu'] },
  { id: 'benzin', icon: '⛽', name: 'Bemis Benzinlik', desc: 'Yakıt alan arabalar ve elektrikli araç şarjı', show: () => !!(G.stationRevealed || G.stationOpen), open: () => !!G.stationOpen, ups: ['fuelPay', 'evPay'] },
  { id: 'enerji', icon: '🌬️', name: 'Bemis Enerji Parkı', region: 'enerji', desc: 'Güneş panelleri ve rüzgâr türbinleri', ups: ['enSun', 'enWind'] },
  { id: 'tarlalar', icon: '🚜', name: 'Büyük Tarlalar', region: 'tarlalar', desc: 'Traktörün biçip ektiği koçan ve buğday', ups: ['trGrow'] },
  { id: 'iskele', icon: '🎣', name: 'Balıkçı İskelesi', region: 'iskele', desc: 'Balık tezgahı, balıkçı ve teknesi, balık restoranı', staff: ['fisher', 'rwaiter'], machines: ['izgara'], ups: ['fsBoat', 'rk_iskele'] },
  { id: 'lunapark', icon: '🎡', name: 'Lunapark', region: 'lunapark', desc: 'Gişe, atlıkarınca, dönme dolap, tezgâhlar, çarpışan arabalar, oyun çadırları, korsan gemisi ve hız treni' },
  { id: 'sehir', icon: '🏙️', name: 'Şehir Marketi', region: 'sehir', desc: 'Mahalle marketinin kasası, rafları ve kamyonları', staff: ['mcashier'], ups: ['ctCap', 'rk_sehir'] },
  { id: 'kasaba', icon: '🎭', name: 'Kasaba Meydanı', region: 'kasaba', desc: 'Kahve, konser ve tiyatro sahnesi, gişe', staff: ['artist', 'ticket'] },
  // temizlik (cop.js, 2026-11-01): sokak çöpünü ve hayvan pisliğini toplayan çöpçüler, temizlik arabası
  { id: 'temizlik', icon: '🧹', name: 'Temizlik', region: 'kasaba', desc: 'Sokaklardaki çöpü ve hayvan pisliğini toplayan çöpçüler; kasaba büyüdükçe çöp artar', staff: ['sweeper'], ups: ['swCart'] },
  // çiçekçinin kendi sekmesi (2026-10-28 kullanıcı: "çiçekçi çalışan alımı yok"; görevlisi Kasaba Meydanı'nda kalınca bulunamıyordu):
  // görevlisi, taşıma kapasitesi ve hızı, buket masasının üretim hızı ve tepsisi burada
  { id: 'cicekci', icon: '🌷', name: 'Çiçekçi', xbolum: 'xkasaba2', desc: 'Kesme çiçek tarhları, buket masası ve parka bakan vitrin',
    show: () => !!(G.regions.kasaba && !G.regions.kasaba.hidden), open: () => G.unlocked.has('xkasaba2'), ups: ['rk_cicekci'] },
  { id: 'banka', icon: '🏦', name: 'Banka', show: bankUp, open: bankUp, desc: 'Kasalardaki parayı toplayıp bankaya yatıran muhasebeci', staff: ['accountant'] },
  { id: 'tasima', icon: '🐴', name: 'Bölgeler arası taşıma', roles: true, desc: 'Ürünü bölgeden bölgeye taşıyan eşek ve arabalar, uzak istekleri getiren ayakçı', staff: ['carrier', 'server'] },
];
for (const d of DESKS) { const a = AREAS.find((x) => x.id === d.area); a.staff = [...(a.staff || []), d.id]; } // her bölümde kendi kasiyeri
// sekmesi olmayan bölgeler (2026-10-28: "tüm yeni bölümler menüde olsun"): köy tarlaları ve otopark
AREAS.push({ id: 'tarla', icon: '🌽', name: 'Köy Tarlaları', region: 'tarla', desc: 'Mısır ve buğday tarlaları, yeni yataklar ve lahana bostanı' },
  { id: 'meydan', icon: '🅿️', name: 'Otopark', region: 'meydan', desc: 'Park yerleri, dolmuş durağı ve şarjlı otopark' });
AREAS.find((a) => a.id === 'benzin').xregion = 'benzin'; // benzinliğin bölümleri (bölge değil, kendi arsası)
const ATT_AREA = { kasaba: 'cicekci' }; // kasabanın görevlisi çiçekçidir: kendi sekmesinde
for (const r of Object.keys(ATT)) { const a = AREAS.find((x) => x.id === (ATT_AREA[r] || r)); a.staff = [...(a.staff || []), `att_${r}`]; } // bölüm görevlisi
// menü sekmeleri başlıklar altında (kullanıcı: "her yeni bölge menüde olsun, çatı altında toplanabilir")
const GROUPS = [['Köy', ['oyuncu', 'koy', 'ciftlik', 'firin', 'tasima']], ['Tarla ve mera', ['tarla', 'tarlalar', 'mera', 'atolye', 'atlar']],
  ['Pazar ve sahil', ['pazar', 'sahil', 'iskele', 'tatil', 'lunapark']], ['Kasaba ve yol', ['kasaba', 'temizlik', 'cicekci', 'banka', 'han', 'meydan', 'benzin', 'enerji']], ['Şehir', ['sehir']]];
const groupOf = (id) => { const k = GROUPS.findIndex(([, l]) => l.includes(id)); return k < 0 ? GROUPS.length : k; };
const areaOn = (a) => (a.region ? G.regions[a.region] && !G.regions[a.region].hidden : a.show ? a.show() : true);
const areaOpen = (a) => (a.region ? G.regions[a.region].unlocked : a.open ? a.open() : true);
// her satır durduğu sekmenin bölgesine bağlı (2026-11-05 kullanıcı: "henüz açılmamış bölgeler menü ve yükseltmelerde kapalı olsun önce
// bölgenin açılması gereksin"): bölgesi açılmamış sekmenin elemanı, makinesi ve geliştirmesi alınmaz. Eskiden yalnız req'i olanlar
// kilitliydi; req'siz geliştirmeler (kargo, enerji, şehir, benzinlik...) bölge açılmadan alınabiliyordu
let areaById = null;
function areaOfId(id) {
  if (!areaById) {
    areaById = new Map();
    for (const a of AREAS) for (const k of [...(a.staff || []), ...(a.ups || []), ...(a.skills || []), ...(a.machines || []).flatMap((m) => [`ms_${m}`, `mc_${m}`])]) if (!areaById.has(k)) areaById.set(k, a);
  }
  return areaById.get(id) || null;
}
function areaGate(id) { const a = areaOfId(id); return !a || areaOpen(a); }
// sekmenin bölümleri (expand-*.js): emekli olanlar yalnız açılmışsa; banka sekmesi kasabanınkini tekrarlamaz.
// Kendi sekmesi olan bölüm (xbolum: çiçekçi) yalnız orada görünür
const ownTab = (id) => AREAS.some((x) => x.xbolum === id);
const bolumsOf = (a) => {
  if (a.xbolum) return expansionDefs().filter((d) => d.id === a.xbolum);
  const r = a.xregion || (a.region === a.id ? a.region : null);
  return r ? expansionDefs().filter((d) => d.region === r && !ownTab(d.id) && (!d.retired || G.unlocked.has(d.id))).sort((x, y) => x.tier - y.tier) : [];
};
const xmachOf = (d) => MACHINES.find((m) => m.exp === d.id);
const areaIds = (a) => [
  ...(a.staff || []).flatMap((h) => [h, ...subsOf(h).flatMap((k) => Array.from({ length: G.upg[h] || 0 }, (_, n) => `${k}@${n}`))]),
  ...(a.ups || []), ...(a.skills || []), ...(a.machines || []).flatMap((m) => [`ms_${m}`, `mc_${m}`]),
  ...bolumsOf(a).map(xmachOf).filter((m) => m && genOf(m)).flatMap((m) => [`ms_${m.id}`, `mc_${m.id}`]),
];
const affordable = (id) => { const c = cost(id); return c != null && available(id) && G.money >= c && gemsHave() >= gemOf(id) && !(def(id).hire && staffCount() >= staffCap()); };

function buildMenu() {
  btnEl = document.getElementById('upgBtn');
  menuEl = document.getElementById('upg');
  listEl = menuEl.querySelector('.ulist');
  tabsEl = menuEl.querySelector('.tabs');
  tabsEl.classList.add('utabs'); // telefonda bölüm seçici (index.html .utabs)
  if (!btnEl.dataset.bound) {
    btnEl.dataset.bound = '1';
    btnEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleMenu(); });
    menuEl.querySelector('.mclose').addEventListener('click', () => toggleMenu(false));
    menuEl.addEventListener('pointerdown', (e) => { if (e.target === menuEl) toggleMenu(false); e.stopPropagation(); });
    listEl.addEventListener('click', (e) => { const f = e.target.closest('button[data-fire]'); if (f) return fire(f.dataset.fire); const b = e.target.closest('button[data-id]'); if (b) buy(b.dataset.id); });
    tabsEl.addEventListener('click', (e) => {
      if (e.target.closest('.tpick')) { tabsEl.classList.toggle('open'); return; } // telefonda bölüm listesini aç / kapat
      const b = e.target.closest('button[data-tab]'); if (b) { tab = b.dataset.tab; tabsEl.classList.remove('open'); render(); }
    });
  }
  G.hooks.openUpg = () => { if (!G.menuOpen) toggleMenu(true); };
  render();
}

export function toggleMenu(force) {
  if (G.visit && force !== false) return; // komşunun köyünde yükseltme yok
  G.menuOpen = force ?? !G.menuOpen;
  menuEl.classList.toggle('open', G.menuOpen);
  sfx(G.menuOpen ? 'open' : 'close');
  if (G.menuOpen) render();
}

function lockText(u, id) {
  const a = id && areaOfId(id);
  if (a && !areaOpen(a)) return `🔒 ${a.name} açılınca`;
  if ((u.need || u.slots) && u.lock && G.regions[u.req].unlocked) return u.lock; // bölge açık ama gereken kilit/kule henüz yok
  if (u.req) return `${G.regions[u.req].name} açılınca`;
  if (u.lock) return u.lock;
  return 'Kilitli';
}

function row(id, title) {
  const u = def(id), l = lvl(id), c = cost(id);
  let sub, pips = '';
  if (u.hire) sub = l ? `Ekipte ${l}/${Math.max(l, hireCap(id))} kişi` : `${u.desc}${hireCap(id) > 1 ? ` · ${hireCap(id)} kişiye kadar` : ''}`;
  else if ((u.skill || u.info) && !l) pips = `<span class="pips">${u.values.slice(1).map(() => '<i></i>').join('')}</span>`, sub = u.desc;
  else {
    sub = c == null ? `${u.fmt(u.values[l])} · en üst seviye` : `${u.fmt(u.values[l])} → ${u.fmt(u.values[l + 1])}`;
    pips = `<span class="pips">${u.values.slice(1).map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</span>`;
  }
  let btn;
  if (!available(id)) btn = `<span class="ulock">${lockText(u, id)}</span>`;
  else if (c == null) btn = '<span class="umax">Tamam</span>';
  else if (u.hire && staffCount() >= staffCap()) btn = '<span class="ulock" title="Seviye atla ya da birini işten çıkar">👥 Kadro dolu</span>';
  else { const g = gemOf(id); btn = `<button type="button" data-id="${id}" data-c="${c}" data-g="${g}" class="${G.money >= c && gemsHave() >= g ? '' : 'poor'}">${u.hire ? '<span class="hire">İşe al</span>' : ''}<i class="coin">₺</i>${c.toLocaleString('tr-TR')}${g ? `<span class="ugem">💎 ${g}</span>` : ''}</button>`; }
  return `<div class="urow${!available(id) ? ' locked' : ''}"><span class="uic">${iconOf(split(id)[0])}</span><span class="ut"><b>${title || u.name}</b><span>${sub}</span>${pips}</span>${btn}</div>`;
}

function staffCard(hireId) {
  const n = G.upg[hireId], max = hireCap(hireId);
  if (!n) return row(hireId);
  const subs = subsOf(hireId), name = UPG[hireId].name;
  const more = n < max ? row(hireId, `Bir ${name.toLocaleLowerCase('tr')} daha`) : '';
  // her eleman kendi kutusunda, kendi seviyeleriyle (başının üstündeki adla aynı: Rafçı, Rafçı 2...)
  const label = (k) => (UPG[k].fmt === pcs ? 'Taşıma kapasitesi' : UPG[k].fmt === mps ? 'Yürüme hızı' : UPG[k].name);
  const people = Array.from({ length: n }, (_, i) => `<div class="uperson"><span class="upn">${name}${i ? ` ${i + 1}` : ''}</span>${subs.map((k) => row(`${k}@${i}`, label(k))).join('')}</div>`).join('');
  const fireBtn = `<button type="button" class="ufire" data-fire="${hireId}" title="En son işe alınanı tazminatını ödeyip çıkar">Çıkar · ${fireFee(hireId)} ₺</button>`;
  return `<div class="ustaff"><span class="usn"><span class="uic">${iconOf(hireId)}</span>${name}${max > 1 || n > 1 ? ` ×${n}` : ''}<em>çalışıyor</em>${fireBtn}</span>${people}${more}</div>`;
}

// yeni bölüm: açıksa (üreticisi varsa) hız ve tepsi yükseltmesi; kapalıysa haritadaki fiyatı ve seviyesi
function bolumCard(d, shut) {
  const m = xmachOf(d), info = (d.info && d.info.text) || '';
  if (shut && !G.unlocked.has(d.id)) return `<div class="urow locked"><span class="uic">${d.icon}</span><span class="ut"><b>${d.title}</b><span>Önce ${shut.name} açılmalı</span></span><span class="ulock">🔒 Kilitli</span></div>`;
  if (!G.unlocked.has(d.id)) return `<div class="urow locked"><span class="uic">${d.icon}</span><span class="ut"><b>${d.title}</b><span>Haritadaki arsada açılır${d.lvl ? ` · ${d.lvl}. seviye` : ''}</span></span><span class="ulock">${(unlockPrice(d.id) ?? d.price).toLocaleString('tr-TR')} ₺</span></div>`;
  if (m && genOf(m)) { m.name = d.title; m.icon = d.icon; return `<div class="ustaff"><span class="usn"><span class="uic">${d.icon}</span>${d.title}<em>açık</em></span>${row(`ms_${m.id}`)}${row(`mc_${m.id}`)}</div>`; }
  return `<div class="urow"><span class="uic">${d.icon}</span><span class="ut"><b>${d.title}</b><span>${info || 'Açık'}</span></span><span class="umax">Açık</span></div>`;
}

function machineCard(m) {
  if (!genOf(m)) return `<div class="urow locked"><span class="uic">${m.icon}</span><span class="ut"><b>${m.name}</b><span>Henüz açılmadı</span></span><span class="ulock">Kilitli</span></div>`;
  return `<div class="ustaff"><span class="usn"><span class="uic">${m.icon}</span>${m.name}</span>${row(`ms_${m.id}`)}${row(`mc_${m.id}`)}</div>`;
}

function render() {
  if (!listEl) return;
  const areas = AREAS.filter(areaOn);
  if (!areas.some((a) => a.id === tab)) tab = areas[0].id;
  // sekmeler: önce açık bölümler, sonra kilitliler (2026-11-01 kullanıcı: "açık olanlar sırada önce gösterilsin"); ikisinde de grup
  // sırasıyla, her grubun başında küçük başlık. Telefonda üstte "Bölüm seç" düğmesi listeyi açıp kapatır (yana kaydırma anlaşılmıyordu)
  const sorted = areas.slice().sort((x, y) => (areaOpen(y) - areaOpen(x)) || (groupOf(x.id) - groupOf(y.id)));
  let lastG = -1, lastOpen = true;
  const cur = AREAS.find((x) => x.id === tab), nOpen = areas.filter(areaOpen).length;
  tabsEl.innerHTML = `<button type="button" class="tpick${anyAffordable() ? ' has' : ''}"><span class="ti">${cur.icon}</span><b>${cur.name}</b><small>Bölüm seç · ${nOpen} açık ▾</small></button>` + sorted.map((a) => { const op = areaOpen(a), gi = groupOf(a.id); let head = ''; if (!op && lastOpen) { head = '<span class="tgrp tlk">🔒 Kilitli bölümler</span>'; lastG = -1; } lastOpen = op; if (gi !== lastG && GROUPS[gi]) head += `<span class="tgrp">${GROUPS[gi][0]}</span>`; lastG = gi; return head + `<button type="button" data-tab="${a.id}" class="${a.id === tab ? 'on' : ''}${areaOpen(a) ? '' : ' lk'}${areaIds(a).some(affordable) ? ' has' : ''}"><span class="ti">${a.icon}</span><span class="tn">${a.name}</span></button>`; }).join('');
  const a = AREAS.find((x) => x.id === tab), open = areaOpen(a);
  const cell = (h) => `<div class="ucell">${h}</div>`, sec = (t, body) => (body ? `<h4 class="usec">${t}</h4><div class="ugrid">${body}</div>` : '');
  listEl.innerHTML = `<div class="uhero${open ? '' : ' lk'}"><span class="hi">${a.icon}</span><span><b>${a.name}</b><small>${open ? a.desc : `🔒 Henüz açılmadı · ${a.desc}`}</small></span></div>` +
    (open ? '' : sec('🔒 Açılması için', needsOfArea(a.region || a.id).map((q) => cell(`<div class="urow${q.done ? '' : ' locked'}"><span class="uic">${q.done ? '✅' : q.icon}</span><span class="ut"><b>${q.text}</b><span>${q.sub}</span></span><span class="${q.done ? 'umax' : 'ulock'}">${q.done ? '✓' : q.right}</span></div>`)).join(''))) +
    sec(`👷 Elemanlar <span class="ucap${staffCount() >= staffCap() ? ' full' : ''}">Kadro ${staffCount()}/${staffCap()} · Maaşlar ${wageTotal()} ₺/dk · boştaki yarım alır</span>`, (a.staff || []).map((h) => cell(staffCard(h))).join('')) +
    sec('⚙️ Makineler', (a.machines || []).map((m) => cell(machineCard(MACHINES.find((x) => x.id === m)))).join('')) +
    sec('⬆️ Geliştirmeler', (a.ups || []).map((id) => cell(row(id))).join('')) +
    sec(`✨ Yetenekler <span class="ucap">Sende ${gemsHave()} 💎</span>`, (a.skills || []).map((id) => cell(row(id))).join('')) +
    sec('🧩 Bölümler', bolumsOf(a).map((d) => cell(bolumCard(d, open ? null : a))).join('')) +
    (a.roles ? `<details class="uroles"><summary>🧭 Kim ne yapar? Aynı rafa giden roller</summary>${ROLES}</details>` : '');
  listEl.style.animation = 'none'; void listEl.offsetWidth; listEl.style.animation = '';
}
function anyAffordable() {
  return allIds().some(affordable);
}

export function updateUpgrades(dt) {
  for (const w of [...G.workers]) { w.update(dt); w.payT = (w.payT || 0) + dt; if (w.state === 'idle') w.idleT = (w.idleT || 0) + dt; }
  M.animateLooms(G.time); // atölyede tezgah başındaki dokumacı kadınlar (models.js)
  wageT += dt;
  if (wageT >= 60) { wageT -= 60; const w = wagePaid(); if (w > 0) fine(w, G.player.position, '💼', 'maaşlar'); }
  refreshT -= dt;
  if (refreshT <= 0 && btnEl) {
    refreshT = 0.3;
    btnEl.classList.toggle('dot', anyAffordable());
    apply('sulama');
    if (G.menuOpen) {
      for (const b of listEl.querySelectorAll('button[data-id]')) b.classList.toggle('poor', G.money < +b.dataset.c || gemsHave() < +(b.dataset.g || 0));
      for (const b of tabsEl.querySelectorAll('button')) { const a = AREAS.find((x) => x.id === b.dataset.tab); if (a) b.classList.toggle('has', areaIds(a).some(affordable)); }
    }
  }
}
