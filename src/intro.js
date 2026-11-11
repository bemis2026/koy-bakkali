// Tanıtım kartı: yeni açılan bölge, makine ya da rafın ne işe yaradığını adım adım anlatır; açıkken oyun durur
import { G, ITEMS } from './game.js';
import { play, duckMusic } from './audio.js';
import './city.js'; // şehir ürünleri (elma, portakal, limon, meyve suyu) ITEMS'e city.js'te eklenir: metinler fiyatı okumadan önce yüklensin

const P = (k) => ITEMS[k].price, C = (k) => ITEMS[k].cost;

// her kilit için: kısa açıklama ve adımlar ([simge, metin]; simge ürün adıysa resmi gösterilir). Açılış sinematiği
// (cinema.js) de bunları altyazı olarak kullanır
export const introInfo = (id) => INFO[id];
// başka dosyaların kilitleri (bölge genişletmeleri, expand.js) kendi tanıtım metnini ekler
export function registerIntro(id, info) { INFO[id] = info; }
const INFO = {
  k1: { text: 'Bahçenin doğusuna salatalık geldi. Bostan kendi kendine büyür, sen sadece toplarsın.', steps: [
    ['salatalik', 'Bostanın içinde yürü, olgun salatalıklar sırtına yığılır.'],
    ['🧺', 'Sıradaki hedef Salatalık Rafı. Onu açınca salatalık da satabilirsin.'],
  ] },
  k2: { text: 'Salatalıklar artık dükkanda. Müşteriler salatalık için de gelecek.', steps: [
    ['salatalik', `Bostandan topladığın salatalığı bu rafa diz. Tanesi ${P('salatalik')} ₺.`],
    ['💬', 'Her müşterinin ne istediği daha kapıdan girerken başının üstündeki baloncukta yazar.'],
  ] },
  k3: { text: 'İkinci domates sırası ilkinin yanına dikildi: daha çok domates, hep dolu raf.', steps: [
    ['domates', 'Domatesler yan yana: iki sırayı art arda dolaş, sırtın dolunca rafa koş.'],
    ['🌱', 'Bahçenin boş yerlerine yeni domates ve salatalık sıraları ekleyebilirsin.'],
    ['⬆️', 'Taşıma kapasitesini yükseltirsen tek seferde daha çok taşırsın.'],
  ] },
  gp: { text: 'Pazarda ürünü toptancıdan ucuza alır, tezgahında kârına satarsın.', steps: [
    ['karpuz', `Toptancı kamyonunun arkasındaki kasaların önünde dur: karpuz sırtına yüklenir, tanesi ${C('karpuz')} ₺.`],
    ['🧺', 'Tahta döşemeli doğu taraf senin alanın: sarı tenteli tezgâhların ve kasan orada. Ürünü tezgâhına diz, müşteri önden alır.'],
    ['💬', 'Gelen müşterinin ne istediği baloncukta. İstediği tezgahta varsa uğrar.'],
    ['📣', 'Üç rakip tezgah müşteri kapar, arada indirim yapar. İndirim olunca BAĞIR, müşteriler sana koşsun.'],
    ['🤝', 'Pazar payın yükselince rakibin tezgahını satın alabilirsin: senin adına satar, parası kasana düşer.'],
    ['⭐', 'Mutlu müşteri mahalle puanını yükseltir, ⏱️ acele müşteriyi bekletme. Puan yüksekse müşteri çoğalır.'],
    ['domates', 'Domates ve salatalık tezgâhlarını tek tek açınca köyden getirdiğini de burada satarsın.'],
  ] },
  pt1: { text: 'Domates tezgâhın kuruldu.', steps: [['domates', `Köyden topladığın domatesi bu tezgâha diz, tanesi ${P('domates')} ₺'ye satılır.`]] },
  pt2: { text: 'Salatalık tezgâhın kuruldu.', steps: [['salatalik', `Köyden topladığın salatalığı bu tezgâha diz, tanesi ${P('salatalik')} ₺'ye satılır.`]] },
  p1: { text: 'Sebze kamyoneti geldi: biber ve patlıcan toptan buradan alınır.', steps: [
    ['🔒', 'Önce tezgâhını aç: kamyonet yalnız tezgâhı açık olan ürünü yükler. Sıradaki kilit biber tezgâhı, sonra patlıcan.'],
    ['biber', `Kamyonetin arkasındaki kasaların önünde dur: biber ${C('biber')} ₺, patlıcan ${C('patlican')} ₺. Sırayla yüklenir.`],
  ] },
  pt3: { text: 'Biber tezgâhın kuruldu.', steps: [['biber', `Kamyonetten ${C('biber')} ₺'ye al, tezgâhta ${P('biber')} ₺'ye sat.`]] },
  pt4: { text: 'Patlıcan tezgâhın kuruldu.', steps: [['patlican', `Kamyonetten ${C('patlican')} ₺'ye al, tezgâhta ${P('patlican')} ₺'ye sat.`]] },
  kk: { text: 'Pazarın kuzeyinde Çiftlik açıldı, tavuklar yumurtlamaya başladı.', steps: [
    ['yumurta', 'Çiftlik yolundaki kümesin önündeki tepsiye yürü, yumurtaları topla.'],
    ['🧺', 'Yumurta rafını açınca dükkanda satarsın.'],
    ['🐔', 'Yükseltmeler → Hayvanlar ile tavuk sayısını artır, daha hızlı yumurta gelir.'],
  ] },
  ky: { text: `Yumurtalar artık dükkanda. Tanesi ${P('yumurta')} ₺.`, steps: [
    ['yumurta', 'Kümesten topladığın yumurtaları bu rafa diz.'],
    ['🧑‍🌾', 'Rafçı alırsan rafları senin yerine o doldurur.'],
  ] },
  gs: { text: 'Plajdaki misafirler şezlongdan kalkmaz, siparişi ayağına götürürsün.', steps: [
    ['kocan', 'Köyün batısındaki tarla da açıldı: mısır koçanları orada büyür. Topla, büfeye getir.'],
    ['misir', 'Koçanı kazanın soldaki masasına bırak. Kazan haşlar, sıcak mısırı sağdaki tepsiden al.'],
    ['💬', 'Şezlonga yürüyen misafirin ne istediği baloncukta yazar.'],
    ['⛱️', 'Siparişi şezlonga götür, üstünde dur. Para büfenin yanında birikir.'],
    ['⏱️', 'Halka bitmeden ne kadar çabuk götürürsen o kadar bahşiş!'],
    ['🐴', 'Yükseltmeler → Elemanlar → Taşıyıcı: eşeğiyle koçanı ve sütü senin yerine taşır.'],
  ] },
  s1: { text: 'Dondurma köyün taze sütünden yapılır.', steps: [
    ['sut', 'Çiftlikteki ahırdan sütü al, dondurma makinesinin soldaki masasına bırak.'],
    ['dondurma', `Makine sütü dondurmaya çevirir; sağdaki tepsiden al. Tanesi ${P('dondurma')} ₺.`],
    ['💬', 'Misafirler artık dondurma da ister; baloncuğa bakıp doğrusunu götür.'],
  ] },
  s2: { text: 'Plaj büyüdü: daha çok şezlong, daha çok misafir.', steps: [
    ['⛱️', 'Yeni şezlonglar hemen dolar. Garson alırsan siparişleri o taşır.'],
  ] },
  ka: { text: 'İnekler ahırda, süt hazır.', steps: [
    ['sut', 'Ahırın önündeki tepsiden sütü topla.'],
    ['🧺', 'Süt ve Peynir Dolabını açınca dükkanda satarsın.'],
    ['🍦', 'Süt sahildeki dondurma makinesine de gider.'],
    ['🧀', 'İleride mandıra açılınca sütten peynir yapacaksın.'],
  ] },
  kd: { text: 'Süt dolabı dükkanda. Her süt ürününün kendi dolabı olur.', steps: [
    ['sut', `Sütü kendi dolabına diz. Tanesi ${P('sut')} ₺.`],
    ['peynir', 'Mandırayı açınca peynirin dolabı da kurulur; koyun sütü ve yoğurt da öyle. Yerleri dükkân büyüyünce açılır.'],
  ] },
  kS2: { text: 'Dükkân büyüdü, artık bir bakkal: karo zemin, sıvalı duvarlar, yeni raf sırası ve yazarkasalı banko.', steps: [
    ['🏪', 'Arka duvarda dolaplara, kasanın karşısındaki ikinci sırada manav ve fırın raflarına yer açıldı.'],
    ['💰', 'Kasa girişin yanına taşındı; kuyruk içeride, kapıya doğru değil raflara doğru uzar.'],
  ] },
  kS3: { text: 'Köy marketi açıldı: camlı vitrin, ışıklı tabela, metal market rafları.', steps: [
    ['🏬', 'Üçüncü raf sırası ve yeni dolap yerleri açıldı. Raflar ve dolaplar daha güzel göründü.'],
    ['🧺', 'Raf büyütmesi (kat) alan raf ve dolap bir kademe daha güzelleşir; kasa da kasiyer hızlandıkça yenilenir.'],
  ] },
  kc: { text: "Köy Meydanı'ndaki paket servis cebine arabalar gelir, paket sipariş verir.", steps: [
    ['🚗', 'Arabanın üstündeki kartta ne istediği ve süresi yazar.'],
    ['domates', 'Ürünleri arabanın yanındaki alana götür, tek tek teslim edilir.'],
    ['💰', 'Siparişi süresi bitmeden tamamlarsan 1,8 kat ödeme alırsın.'],
  ] },
  gh: { text: 'Uzak diyarlardan kervanlar gelir, toplu sipariş verir.', steps: [
    ['bugday', 'Avludaki tarlada buğday büyür. Topla, fırının soldaki masasına bırak.'],
    ['ekmek', 'Fırın buğdaydan ekmek pişirir; sağdaki tepsiden al.'],
    ['🐫', 'Kervanın kartındaki siparişi teslim alanına götür.'],
    ['⏱️', 'Süre bitmeden hepsini getirirsen ödeme 1,5 katına çıkar.'],
    ['🧑‍💼', 'Kâhya alırsan kervanlarla o ilgilenir.'],
  ] },
  h1: { text: 'Kervancılar sıcak çorba ister.', steps: [
    ['domates', 'Avluya domates bahçesi geldi. Domatesi kazanın soldaki masasına bırak; köyden getirdiğin domates de olur.'],
    ['corba', `Kazan çorba yapar; sağdaki tepsiden al. Tanesi ${P('corba')} ₺.`],
    ['🐫', 'Kervan siparişlerinde artık çorba da çıkar.'],
  ] },
  h2: { text: 'Develer de acıkır!', steps: [
    ['bugday', 'Yeni bir buğday tarlası açıldı. Buğdayı ambarın soldaki masasına bırak.'],
    ['yem', 'Ambar buğdaydan deve yemi hazırlar; sağdaki tepsiden al.'],
    ['🐫', 'Kervan siparişlerinde artık yem de olur.'],
  ] },
  kb: { text: "Köy Meydanı açıldı: bisikletliler ve arabalılar gelmeye başladı!", steps: [
    ['🚲', 'Bisikletliler ana yoldan gelir, dükkânın batı yanındaki parka bırakıp içeri yürür. Bazıları sepetle birkaç raftan alır.'],
    ['🚗', 'Kimi arabasından inip dükkana yürür, sepetiyle alışveriş yapar.'],
    ['📋', 'Kimi arabada bekleyip sipariş verir; kartta ne istediği ve süresi yazar.'],
    ['📦', 'Ürünleri arabanın kaldırıma bakan önündeki alana götür. Tam teslimde 1,5 kat ödeme.'],
  ] },
  km: { text: 'Mandıra sütü peynire çevirir. Peynir dükkanın en pahalı ürünü.', steps: [
    ['sut', 'Sütü mandıranın soldaki giriş tepsisine bırak.'],
    ['peynir', `Biraz sonra sağdaki tepsiden peyniri al. Tanesi ${P('peynir')} ₺.`],
    ['🧺', 'Peyniri süt ve peynir dolabına diz.'],
  ] },
  gm: { text: 'Koyunlar artık senin! Merada otlarlar, yünlerini kırkım barakası toplar.', steps: [
    ['yun', 'Barakanın önündeki tepsiye yürü, yün yumakları sırtına yığılır.'],
    ['🍉', `Yünü pazardaki tezgahına götür, tanesi ${P('yun')} ₺.`],
    ['kilim', `Meranın yanına, köy yoluna bakan bir dokuma atölyesi kurabilirsin: yün kilime döner, kilim ${P('kilim')} ₺!`],
    ['ksut', 'Sağım yeri açılınca koyun sütü, yoğurt küpüyle de yoğurt yaparsın.'],
  ] },
  m1: { text: 'Koyunlar sağılıyor: taze koyun sütü.', steps: [
    ['ksut', 'Sağım yerinin önündeki tepsiden şişeleri topla.'],
    ['🧺', `Köydeki süt ve peynir dolabına diz. Tanesi ${P('ksut')} ₺.`],
    ['yogurt', 'Sırada yoğurt küpü var: sütü yoğurda çevirir, daha değerli.'],
  ] },
  m2: { text: 'Köy yolunun kenarında dokuma atölyesi açıldı: yün artık kilim oluyor.', steps: [
    ['yun', 'Kırkım barakasından yünü al, meranın kuzey kapısından yola çık, kaldırımdan atölyeye gir. Tezgahın soldaki masasına bırak.'],
    ['kilim', 'Tezgah kilimi dokur, sağdaki masadan al.'],
    ['🍉', `Kilimi pazardaki tezgahına diz. Tanesi ${P('kilim')} ₺, yünün neredeyse dört katı!`],
  ] },
  m3: { text: 'Yoğurt küpü kuruldu: koyun sütü mayalanıyor.', steps: [
    ['ksut', 'Koyun sütünü küpün soldaki masasına bırak.'],
    ['yogurt', 'Küp yoğurdu mayalar, sağdaki masadan al.'],
    ['🧺', `Köydeki süt dolabına diz. Tanesi ${P('yogurt')} ₺.`],
  ] },
  e0: { text: 'Köy yolunun sonunda benzinlik açıldı.', steps: [
    ['⛽', 'Pompalar, market ve geniş bir avlu kuruldu. Arabalar pompalarda yakıt alır; para marketin yanındaki kasa kutusunda birikir, gidip toplarsın (muhasebeci de toplar).'],
    ['🚶', 'Köy yolundan ya da sahil yolundan yürüyerek gelebilirsin.'],
    ['⚡', 'Avludaki yeşil yerlere şarj istasyonu kurabilirsin. Elektrikli arabalar gelir, şarj olur, parasını bırakır.'],
  ] },
  e1: { text: 'Benzinlikte DC hızlı şarj istasyonu kuruldu: arabalar artık daha çabuk şarj olur, daha çok öder.', steps: [
    ['🚗', 'Arabalar köy yolundan gelir, yeşil park yerinde hızlı şarj cihazına bağlanır.'],
    ['⚡', 'Şarj bitince araba başına 28 ₺ öder; para benzinliğin kasa kutusunda birikir, gidip topla.'],
  ] },
  gt: { text: 'At ahırı açıldı! Atlı müşteriler köy yolundan gelip atlarını bakıma bırakır.', steps: [
    ['🐎', 'Atlı gelir, atını boş bölmeye bırakır, bankta bekler. Atın üstündeki balon ne istediğini gösterir.'],
    ['bugday', 'Ahırın yanındaki tarladan buğdayı topla, harman makinesinin masasına bırak: saman çıkar.'],
    ['saman', 'Samanı masadan al, atın bölmesinin önüne götür: yemliğe konur, at yer.'],
    ['✨', 'Parıltı işareti varsa bölmenin önünde biraz dur, at tımar edilir.'],
    ['💰', 'Bakım bitince atlı parayı kapının yanındaki yığına bırakır. Yükseltmeler menüsünden seyis tutarsan bu işleri o yapar.'],
  ] },
  at1: { text: 'İki yeni at bölmesi açıldı: aynı anda dört at bakılabilir.', steps: [
    ['🐴', 'Daha çok atlı gelir, harman makinesini buğdaysız bırakma.'],
  ] },
  gk: { text: "Kabuk Tatil Köyü açıldı! Nehrin doğusunda, deniz kenarındaki kabuk evlere misafir geliyor.", steps: [
    ['🛎️', 'Misafir resepsiyonda bekler: tezgaha git, kaydını yap. Gecelik ücreti öder.'],
    ['havlu', 'Kaldığı sürece istekte bulunur: istediğini evinin terasına götür, bahşiş bırakır.'],
    ['🧹', 'Misafir çıkınca evin terasında bekle, ev toplanır. Kirli çamaşır sırtına yüklenir.'],
    ['kirli', 'Kirli çamaşırı çamaşırhanenin soldaki masasına bırak, sağdan temiz havlu al.'],
    ['⭐', 'Misafirler puan verir: puan yükseldikçe gecelik ücret artar, misafir daha sık gelir.'],
  ] },
  tk1: { text: 'Yeni kabuk ev hazır: aynı anda bir misafir daha ağırlarsın.', steps: [['🐚', 'Ev boşaldıkça toplamayı unutma, kirli evde kimse kalmaz.']] },
  tk2: { text: 'Dördüncü kabuk ev hazır.', steps: [['🐚', 'Çamaşırhanede temiz havlu biriktir: istekler çoğalır.']] },
  gy: { text: 'Büyük Tarlalar açıldı! Traktör kendi kendine çalışıyor: boş parseli eker, olgunlaşanı biçer.', steps: [
    ['🚜', 'Traktör biçtiği mısırı ve buğdayı tarla girişindeki hasat yığınlarına boşaltır.'],
    ['kocan', 'Koçanı sahildeki mısır kazanına, buğdayı handaki fırına ya da ahırdaki harmana götür.'],
    ['💡', 'Taşıyıcı tutarsan hasadı eşeğiyle nereye lazımsa o taşır.'],
  ] },
  gb: { text: 'Balıkçı İskelesi açıldı! Denize uzanan iskelede balık tutup satıyorsun.', steps: [
    ['🎣', 'İskelenin ucundaki olta yerinde dur: şamandıra suya iner, tuttuğun balık sırtına gelir.'],
    ['balik', 'Balığı buzlu tezgahın arkasından diz; müşteri önden alır, parası yandaki kasaya düşer.'],
    ['🛶', 'Balıkçı tutarsan o tutar ve tezgaha dizer. Tekne yükseltmesiyle kayıkla açığa çıkıp ağla çok balık getirir.'],
  ] },
  b2: { text: 'Balık restoranı açıldı: iskelede dört masa ve ızgara.', steps: [
    ['balik', 'Balığı ızgaranın soldaki masasına bırak, ızgara pişirir.'],
    ['izgara', 'Tabağı sağdaki masadan al, bekleyen müşterinin masasına götür. Yiyip öder.'],
    ['🍽️', 'Restoran garsonu tutarsan tabakları o taşır, ızgarayı da buzlu kasadan besler.'],
  ] },
  tk3: { text: 'Beşinci kabuk ev hazır, tatil köyü tam kapasite!', steps: [['⭐', 'Yüksek puan, daha çok misafir ve daha yüksek gecelik demek.']] },
  gf: { text: 'Köy fırını açıldı: taş fırınlarda ekmek, simit ve poğaça pişiyor.', steps: [
    ['un', 'Un çuvallarından unu al, fırınların soldaki masasına bırak.'],
    ['ekmek', 'Pişen ekmeği, simidi ve poğaçayı sağdaki masalardan al. Her ürünün kendi vitrini var: arkasından diz.'],
    ['💰', 'Köylüler ana yoldan gelip vitrinden alır, parası vitrinlerin doğusundaki kasaya düşer. Fırıncı tutarsan bu işleri o yapar.'],
  ] },
  kr1: { text: 'Fırın rafları kuruldu: ekmek, simit ve poğaçanın köy bakkalında da kendi rafı var.', steps: [
    ['ekmek', 'Fırından ürünü getirip kasanın karşısındaki raf sırasında, kendi rafına diz. Rafçı da fırından getirir.'],
  ] },
  kr2: { text: 'Kilim ve yün rafları kuruldu: atölyenin kilimi köyde de alıcı bulur.', steps: [
    ['kilim', 'Kilim ve yün pahalı satılır. Atölyeden ya da meradan getirip her birini kendi rafına diz; rafçı da getirir.'],
  ] },
  kr3: { text: 'Manav rafları kuruldu: karpuz, biber ve patlıcanın köy bakkalında da kendi rafı var.', steps: [
    ['karpuz', 'Pazardaki toptancıdan alıp her ürünü kendi rafına diz. Rafçı da parası yettikçe toptancıdan alıp getirir.'],
  ] },
  gw: { text: 'Enerji Parkı açıldı! Trafo ve ilk güneş paneli dizisi elektrik üretmeye başladı.', steps: [
    ['☀️', 'Paneller güneşten, türbinler rüzgârdan elektrik üretir. Trafo şebekeye satar; kazanç trafonun önündeki kasa kutusunda birikir, gidip topla ya da muhasebeci toplasın.'],
    ['🌬️', 'Yeni panel dizileri ve rüzgâr türbinleri pahalıdır ama kendi kendine para kazandırır. Rüzgâr güçlendikçe türbinler hızlanır.'],
    ['💰', 'Trafonun üstündeki pano dakikalık kazancı gösterir.'],
  ] },
  w3: { text: 'İlk rüzgâr türbini dönmeye başladı!', steps: [
    ['🌬️', 'Türbin rüzgâra göre hızlanıp yavaşlar; ortalamada bir panel dizisinden çok daha fazla üretir.'],
  ] },
  e2: { text: 'Benzinlikte iki AC şarj noktası kuruldu: elektrikli arabalar şarj olmaya geliyor.', steps: [
    ['🔌', 'Arabalar istasyonun güney kenarındaki duvar tipi şarj cihazlarına bağlanır. Sonra DC hızlı şarj istasyonu gelir.'],
    ['💰', 'Her AC şarjı 16 ₺ getirir; o da benzinliğin kasa kutusuna düşer.'],
  ] },
  h3: { text: 'Han şenlendi, kervanlar daha cömert!', steps: [
    ['💰', 'Tam teslim edilen kervan siparişleri artık 2 kat ödenir.'],
    ['🏆', 'Ana yol tamam! Haritada kalan yan kilitleri ve yeni bölümleri açmaya devam et.'],
  ] },
  // Şehir Marketi (city.js): şehir ürünlerinin fiyatları city.js'te tanımlanır, bu dosya ondan önce yüklenebildiği için metinde sabit
  gc: { text: 'Şehirde mahalle marketin açıldı! Köy sen yokken de çalışmaya devam eder.', steps: [
    ['🚌', 'Köyde ana yolun kenarındaki otobüs durağında bir an dur: 50 ₺ bilet, otobüs seni şehre götürür. Şehir durağından aynı şekilde dönersin.'],
    ['domates', 'Şehirde köy ürünleri 1,5 katına satılır. Köyden getirdiğini reyonlara diz.'],
    ['🚚', 'Köy kamyonu arada köyün fazlasını (tepside bekleyen süt, peynir, yumurta, sebze, fırın ürünü) marketin önündeki palete getirir.'],
    ['🧾', 'Müşteri kasada öder; kasanın başında dur. Kasiyeri Yükseltmeler → Şehir Marketi bölümünden işe alırsın. Para tezgahta birikir, yanına gidip toplarsın.'],
  ] },
  gc1: { text: 'Şehir yolu ve durak hazır.', steps: [
    ['🛣️', 'Otobüs henüz kalkmıyor: önce şehirde dükkân tut (seviye 12), sonra ruhsatı alıp marketi aç (seviye 14).'],
  ] },
  gc2: { text: 'Şehirde dükkân tuttun.', steps: [
    ['🔑', 'Son adım market ruhsatı ve açılış (seviye 14). Market açılınca otobüs seni şehre götürür.'],
  ] },
  sc1: { text: 'Kahvaltılık rafları kuruldu.', steps: [
    ['yumurta', 'Yumurta, ekmek, simit ve poğaçanın her birinin arka duvarda kendi rafı var. Köyden getir ya da köy kamyonunun getirdiklerini paletten al.'],
  ] },
  sc2: { text: 'Meyve rafları ve şehrin hal tezgahı açıldı.', steps: [
    ['elma', `Hal tezgahında dur: elma ${C('elma')} ₺, portakal ${C('portakal')} ₺, limon ${C('limon')} ₺, meyve suyu ${C('meyvesuyu')} ₺. Sırayla sırtına yüklenir.`],
    ['meyvesuyu', `Her meyvenin kendi rafı var: elma ${P('elma')} ₺, portakal ${P('portakal')} ₺, limon ${P('limon')} ₺, meyve suyu ${P('meyvesuyu')} ₺. Alış fiyatının iki katı!`],
  ] },
  sc6: { text: 'Market rafçısı işe başladı.', steps: [
    ['🧺', 'Rafçı paletteki köy malını ve halın meyvesini boşalan reyonlara taşır.'],
  ] },
  sc3: { text: 'Köy kamyonu büyüdü.', steps: [
    ['🚚', 'Büyük kamyon her seferde iki kat mal getirir ve daha sık gelir.'],
  ] },
  sc4: { text: 'Hediyelik rafları açıldı.', steps: [
    ['kilim', 'Kilim ve yünün kendi rafı var, şehirde hediyelik olarak satılır. Atölyeden ve meradan getir.'],
  ] },
};

const queue = [];
let el = null, cur = null;

function build() {
  el = document.createElement('div');
  el.id = 'intro';
  el.className = 'modal';
  el.setAttribute('role', 'dialog');
  el.innerHTML = '<div class="mcard in-card"><div class="in-top"><span class="in-ic"></span><span><small>YENİ AÇILDI</small><b class="mtitle ttl"></b></span></div><p class="in-text"></p><ol class="in-steps"></ol><button type="button" class="go">Anladım, hadi! 👍</button></div>';
  document.body.appendChild(el);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.querySelector('.go').addEventListener('click', close);
  // açıkken Enter / Boşluk / Esc kartı kapatır, oyuna geçmez
  addEventListener('keydown', (e) => {
    if (!cur) return;
    e.stopImmediatePropagation();
    if (['Enter', 'Space', 'Escape', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); close(); }
  }, true);
}

const pic = (k) => (ITEMS[k] ? `<img src="${G.icons[k]}" alt="">` : k);

function next() {
  if (cur || !queue.length) return;
  // başka bir pencere açıksa (menü, yükseltmeler) kapanmasını bekle
  if (G.menuOpen) { setTimeout(next, 500); return; }
  const def = queue.shift(), info = INFO[def.id];
  if (!info) { next(); return; }
  if (!el) build();
  cur = def;
  el.querySelector('.in-ic').textContent = def.icon || '✨';
  el.querySelector('.mtitle').textContent = def.title;
  el.querySelector('.in-text').textContent = info.text;
  el.querySelector('.in-steps').innerHTML = info.steps.map(([k, t]) => `<li><span class="si">${pic(k)}</span><span>${t}</span></li>`).join('');
  el.classList.add('open');
  G.menuOpen = true; G.paused = true;
  duckMusic(true);
  play('open');
}

function close() {
  if (!cur) return;
  cur = null;
  el.classList.remove('open');
  G.menuOpen = false; G.paused = false;
  duckMusic(false);
  play('close');
  setTimeout(next, 300);
}

// kilit açılınca çağrılır; kutlama afişi bitsin diye biraz bekler
export function showIntro(def) {
  queue.push(def);
  setTimeout(next, 1400);
}
