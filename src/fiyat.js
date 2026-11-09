// Kademeli fiyat. 2026-11-05 kullanıcı: "Oyun ilerledikçe açılan şeylerin geliştirme ve yeni seviyelerdeki açılanların fiyatları daha
// yüksek olmalı çünkü otomatiğe alınabilen sistemler bir süre sonra çok gelir getirmeye başlıyor ... oyuncuyu da sıkmayacak bir dengede";
// üç eğriden "Dengeli"yi seçti, lunapark kapısı onun rakamı (1.000.000 ₺).
// Kilidin kademesi göründüğü seviyedir (world.js TIER_LV: kendi seviyesi, şartının seviyesi ya da ana sırada önündekilerin seviyesi).
// Kilit, genişleme ve o bölgenin eleman ve geliştirmeleri bu çarpanla pahalanır; maaş, tazminat, fide ve kilidin verdiği XP eski fiyattan.
// Ölçüm (2026-11-05, kullanıcı kaydı sv 40, oyuncu yokken): gelir ≈ 4.000 ₺/dk, maaş ≈ 2.300 ₺/dk; 6. seviyedeki yeni oyuncu toplam ≈ 11.500 ₺ kazanmış.
export const LUNA_PRICE = 1000000;
export function tierK(lvl) {
  if (lvl <= 3) return 1; // köy, pazar, çiftlik, otopark: ilk yarım saat değişmedi
  if (lvl <= 5) return 1.6; // sahil, mera, paket servis
  if (lvl <= 6) return 2.5; // iskele, at ahırı, atölye, benzinlik, köy marketi
  if (lvl <= 8) return 3.5; // kervansaray, fırın, e-ticaret, büyük tarlalar
  if (lvl <= 9) return 5; // tatil köyü, beach club
  if (lvl <= 12) return 6; // enerji parkı, şehir yolu, çiçekçi, büyük köy marketi
  if (lvl <= 15) return 7; // şehir marketi
  return 8; // lunapark bölümleri
}
export const nice = (p) => (p >= 1000 ? Math.round(p / 50) * 50 : Math.round(p / 10) * 10);
