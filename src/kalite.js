// Görüntü kalitesi kademeleri ve cihaza göre otomatik seçim (2026-11-02 kullanıcı: "telefonda performansı geliştir, gereksiz yormasın,
// her telefonda çalışsın; ayarlardan görüntü kalitesi seçilebilsin, her telefona uygun ayarla açılsın, kasma olmasın").
// yuksek: tam gölge, alan derinliği, kenar yumuşatma (masaüstü); orta: hafif gölge (2 karede bir), çözünürlük en çok 1,5;
// dusuk (Performans): gölge ve bulanıklık yok, çözünürlük 1, sade şekiller, kısa görüş; pil (Pil tasarrufu): Performans gibi, ayrıca
// saniyede 30 kare ve daha düşük çözünürlük: ucuz telefonda ısınmayı ve pili korur.
// detail: kodla çizilen küre, kapsül ve silindirlerin bölüm oranı (models.js setDetail; yeni çizilen parçalara uygulanır).
// fog: sis ve görüş uzaklığı oranı (main.js): uzaktaki parçalar çizilmez
import { settings, saveSettings } from './audio.js';

export const TIERS = ['yuksek', 'orta', 'dusuk', 'pil'];
export const QNAME = { yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Performans', pil: 'Pil tasarrufu' };
export const TIER = {
  yuksek: { pr: 2, shadow: 2048, shadowEvery: 1, dof: true, detail: 1, fog: 1, fps: 60, prMin: 1 },
  orta: { pr: 1.5, shadow: 1024, shadowEvery: 2, dof: false, detail: 0.75, fog: 0.88, fps: 60, prMin: 1 },
  dusuk: { pr: 1, shadow: 0, shadowEvery: 1, dof: false, detail: 0.55, fog: 0.72, fps: 60, prMin: 0.75 },
  pil: { pr: 0.8, shadow: 0, shadowEvery: 1, dof: false, detail: 0.45, fog: 0.62, fps: 30, prMin: 0.6 },
};
export const tierOf = (q) => TIER[q] || TIER.orta;

// cihazı tanır: ekran kartının adı, bellek, çekirdek sayısı, dokunmatik ekran. Telefon ve tablet hiç Yüksek'le açılmaz (ısınma, pil)
// sonuç saklanır: her çağrıda yeni WebGL bağlamı açılmasın (ayarlar sayfası "Önerilen" rozeti için de soruyor)
let detected = null;
export function detectTier() {
  if (detected) return detected;
  return (detected = detectOnce());
}
function detectOnce() {
  const touch = matchMedia('(pointer: coarse)').matches, mem = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 4;
  let gpu = '';
  try {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) {
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    }
  } catch (e) { /* bilinmiyor: bellek ve çekirdeğe göre */ }
  const g = gpu.toLowerCase();
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) return 'pil'; // ekran kartı yok, yazılımla çiziliyor
  if (!touch) {
    if (!g) return 'orta'; // kart adı okunamadı: temkinli başla
    if (/intel/.test(g) && /(hd|uhd) graphics/.test(g) && !/iris|arc/.test(g)) return mem && mem <= 4 ? 'dusuk' : 'orta'; // eski tümleşik kart
    return 'yuksek';
  }
  // Safari çekirdek sayısını gizlilik için kısar (iPhone'da 4'ün altında bildirir), bellek hiç bildirmez: çekirdek kuralı bütün
  // iPhone'ları Pil tasarrufuna (30 kare, düşük çözünürlük) düşürüyordu (2026-11-10 denetimi). Apple kartı Orta'yla açılır; zorlanan
  // eski cihazda oyun kendiliğinden hafifler (main.js watchSpeed)
  if (/apple/.test(g)) return 'orta';
  if ((mem && mem <= 2) || cores <= 4) return 'pil';
  if (/powervr|\bimg\b|ge8\d{3}/.test(g)) return 'pil';
  let strong = /xclipse|immortalis/.test(g);
  const adreno = g.match(/adreno[^0-9]*(\d{3})/), mali = g.match(/mali-?([gt])?(\d{2,3})/);
  if (adreno) { const n = +adreno[1]; if (n < 600) return mem >= 6 ? 'dusuk' : 'pil'; strong = n >= 640; }
  if (mali) {
    const t = mali[1], n = +mali[2];
    if (t !== 'g' || n < 52) return 'pil'; // Mali-400, T serisi
    strong = n >= 710 || (n >= 76 && n < 100); // G76-G78, G710 ve üstü
  }
  if (mem && mem <= 3) return 'pil';
  if (mem && mem <= 4) return 'dusuk';
  return strong ? 'orta' : 'dusuk';
}

// ilk açılışta (ya da ayarlarda Otomatik seçilince) kaliteyi cihaza göre kurar. Oyuncu elle seçtiyse (autoQ) dokunulmaz.
// qv: kademe sürümü; eski kayıtların otomatik ayarı bir kez yeniden ölçülür. Yavaş giden oyunda main.js kaliteyi kademe kademe düşürür,
// düşen ayar kalıcıdır (bir sonraki açılışta yeniden yükseltilmez)
const QV = 3; // 3 (2026-11-10): iPhone kuralı düzeldi, sahne taraması hızlandı (matris.js): kendiliğinden düşmüş ayarlar bir kez yeniden ölçülür
export function initQuality(force = false) {
  if (force || (!settings.autoQ && settings.qv !== QV)) { settings.quality = detectTier(); settings.qv = QV; settings.autoQ = 0; saveSettings(); }
  else if (settings.qv !== QV) { settings.qv = QV; saveSettings(); }
  if (!TIER[settings.quality]) settings.quality = 'orta';
  return settings.quality;
}
