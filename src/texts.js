// Oyunun sesi: esprili Türkçe metin havuzları
const T = {
  happy: ['Kolay gelsin!', 'Eline sağlık!', 'Bereket versin!', 'Mis gibi!', 'Yine gelirim!', 'Taptaze!', 'Sağ ol komşu!', 'Hayırlı işler!'],
  angry: ['Of ya!', 'Bekle bekle...', 'Başka yere giderim!', 'Hani nerede?', 'Pes doğrusu!', 'Kök saldım burada!'],
  shout: ['Taze karpuz! Gel gel!', 'Domatesin kralı burada!', 'Bal gibi karpuz!', 'Gel abla gel, kaçırma!', 'Kesmece karpuz!', 'Yok böyle fiyat!'],
  rival: ['Bizde ucuz!', 'Gel abla gel!', 'Taze taze!', 'Bir lira eksiğine!', 'Ordan değil burdan!'],
  caravanHi: ['Selamün aleyküm!', 'Yolumuz uzun, çabuk ol!', 'Develer acıktı!'],
  caravanDone: ['Allah razı olsun!', 'Bereketli olsun!', 'Kervan yoluna devam!'],
  caravanLate: ['Kervan beklemez...', 'Başka hana gidiyoruz!'],
  carHi: ['Acelem var!', 'Paket olsun lütfen!', 'Korna çaldım, duydun mu?'],
  carDone: ['Süpersin!', 'Üstü kalsın!', 'Yine gelirim!'],
  carLate: ['Geç kaldın kardeş!', 'Neyse, başka sefere.'],
  unlock: ['Hayırlı olsun!', 'Bereketli olsun!', 'Dükkan büyüyor!', 'Maşallah!', 'Yeni kapı, yeni rızık!'],
  region: ['Yeni bölge!', 'Ufuk açıldı!', 'Hayırlı olsun!'],
  hire: ['Hoş geldin, çalışkan arkadaş!', 'Ekibe yeni biri katıldı!', 'İşler hızlanıyor!'],
  noMoney: ['Cep delik!', 'Para yetmiyor', 'Kasa boş kardeş'],
  boost: ['Bereket yağıyor!', 'Kazanç iki katına çıktı!', 'Şans kapıyı çaldı!'],
  tips: [
    'Kasada durursan müşteriler daha hızlı öder.',
    'Pazarda BAĞIR, müşteriler koşa koşa gelsin.',
    'Elemanlar sen yokken de çalışır.',
    'Yanlış ürün mü taşıyorsun? Çöp kutusuna at.',
    'Bereket sandığını kap, kazancın iki katına çıksın!',
    'Peynir mandırada sütten yapılır, en değerli ürün odur.',
    'Kervanın siparişini tamamlarsan ödeme katlanır.',
    'E tuşu yükseltme menüsünü açar.',
  ],
};

export function say(k) { const a = T[k]; return a[Math.floor(Math.random() * a.length)]; }
export const EMOJI = { happy: ['😊', '😍', '🤩', '😋'], angry: ['😠', '😤', '🙄'] };
export function emoji(k) { const a = EMOJI[k]; return a[Math.floor(Math.random() * a.length)]; }
