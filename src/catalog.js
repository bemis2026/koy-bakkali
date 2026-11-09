// Ürün sınıfları: her ürün ham madde mi, toptan mı, neyden işlenmiş mi. Menüdeki ürün rehberi buradan okur.
// Yeni ürün eklenirse KIND_OF'a yazılmasa da FROM'da tarifi varsa işlenmiş, yoksa ham madde sayılır
import { ITEMS } from './game.js';

export const KINDS = {
  ham:      { name: 'Ham madde',        icon: '🌱', desc: 'Tarladan, hayvandan ya da denizden doğrudan toplanır; kimi olduğu gibi satılır, kimi yalnızca işlenir' },
  toptan:   { name: 'Toptan ürün',      icon: '🚚', desc: 'Toptancı kamyonuyla hazır gelir; işlenmeden tezgaha konur' },
  islenmis: { name: 'İşlenmiş ürün',    icon: '⚙️', desc: 'Ham maddeden makinede, fırında ya da kazanda yapılır; ham maddesinden pahalı satılır' },
  ara:      { name: 'Ara ürün',         icon: '🔧', desc: 'İşlenmiş ama müşteriye satılmaz; fırına ya da hayvana girdi olur' },
  hizmet:   { name: 'Hizmet malzemesi', icon: '🛎️', desc: 'Tezgahta satılmaz; tatil köyünde misafir hizmetinde dolaşır' },
};
export const KIND_ORDER = ['ham', 'toptan', 'islenmis', 'ara', 'hizmet'];

export const KIND_OF = {
  domates: 'ham', salatalik: 'ham', yumurta: 'ham', sut: 'ham', ksut: 'ham', yun: 'ham', bugday: 'ham', kocan: 'ham', balik: 'ham',
  karpuz: 'toptan', biber: 'toptan', patlican: 'toptan', elma: 'toptan', portakal: 'toptan', limon: 'toptan', meyvesuyu: 'toptan', // son dördü şehrin halinden (city.js)
  peynir: 'islenmis', dondurma: 'islenmis', misir: 'islenmis', yogurt: 'islenmis', kilim: 'islenmis', ekmek: 'islenmis',
  simit: 'islenmis', pogaca: 'islenmis', corba: 'islenmis', yem: 'islenmis', izgara: 'islenmis',
  un: 'ara', saman: 'ara',
  lahana: 'ham', balkabagi: 'ham', hali: 'islenmis', balikcorba: 'islenmis', // bölge genişletmeleri
  bal: 'ham', aycicek: 'ham', cicek: 'ham', buket: 'islenmis', tursu: 'islenmis', guvec: 'islenmis', pide: 'islenmis', tost: 'islenmis', // (expand-east.js)
  salca: 'islenmis', kek: 'islenmis', // salça kazanı pazarda (expand-west.js), kek tezgâhı kasabada (expand-east.js)
  pure: 'islenmis', karpuzsuyu: 'islenmis', menemen: 'islenmis', // sahil mutfağı (mutfak.js)
  kirli: 'hizmet', havlu: 'hizmet',
};

// neyden yapılır (birden çoksa herhangi biri yeter) ve nerede
export const FROM = {
  tursu: [['salatalik'], 'pazardaki turşu fıçısında'], guvec: [['domates'], 'handaki güveç ocağında'], pide: [['un'], 'fırının pide fırınında'], tost: [['ekmek'], 'şehirdeki tost büfesinde'], // (expand-east.js)
  peynir: [['sut'], 'mandırada'], dondurma: [['sut'], 'dondurma makinesinde'], misir: [['kocan'], 'mısır kazanında'],
  yogurt: [['ksut'], 'yoğurt küpünde'], kilim: [['yun'], 'dokuma tezgahında'], ekmek: [['bugday', 'un'], 'han fırınında ya da köy fırınında'],
  simit: [['un'], 'simit fırınında'], pogaca: [['un'], 'poğaça fırınında'], corba: [['domates'], 'çorba kazanında'],
  yem: [['bugday'], 'yem ambarında'], izgara: [['balik'], 'iskele restoranının ızgarasında'], un: [['bugday'], 'değirmende'], saman: [['bugday'], 'harman makinesinde'],
  havlu: [['kirli'], 'çamaşırhanede'],
  hali: [['kilim'], 'halı tezgahında'], balikcorba: [['balik'], 'iskele mutfağında'],
  buket: [['cicek'], 'çiçekçinin buket masasında'],
  pure: [['domates'], 'sahildeki püre makinesinde (iki domatesten bir kutu)'], karpuzsuyu: [['karpuz'], 'sahildeki karpuz sıkacağında (bir karpuzdan iki şişe)'],
  menemen: [['yumurta', 'domates', 'biber'], 'sahildeki menemen ocağında (üçü birden)'],
  salca: [['domates'], 'semt pazarının salça kazanında'], kek: [['un', 'yumurta', 'sut'], 'kasaba kahvesinin arkasındaki kek tezgâhında (üçü birden)'],
};

export const kindKey = (t) => KIND_OF[t] || (FROM[t] ? 'islenmis' : 'ham');
export const kindOf = (t) => KINDS[kindKey(t)];
// bu ürün hangi ürünlere girdi olur (süt → peynir, dondurma)
export const usedIn = (t) => Object.keys(FROM).filter((k) => ITEMS[k] && FROM[k][0].includes(t));
