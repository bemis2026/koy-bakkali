// Telefonun Geri tuşu (ve tarayıcının geri hareketi) açık pencereyi kapatır (2026-11-10 ana menü, 2026-11-11 yükseltmeler de).
// Pencere açılınca geçmişe kendi işaretli adımımız ({ kb: 1 }) eklenir; Geri o adımı geri alır ve pencere kapanır. Pencere düğmeyle
// kapanınca adım geri alınır, ama bir pencereden ötekine geçerken (yükseltmelerden ana menüye) aynı adım kalır: kapanış bir sonraki
// görev adımında bakar. Geri almayı yalnız kendi adımımızın üstündeyken yaparız: art arda aç-kapa yarışında bile sayfadan çıkılmaz
// (ilk sürümde bot pencereyi aynı anda açıp kapayınca geri alma yeni adımla yarışıp sayfayı önceki adrese götürebiliyordu).
let closer = null, backing = false, pend = false, backTok = 0;
const onKb = () => !!(history.state && history.state.kb);
const push = () => { try { history.pushState({ kb: 1 }, ''); } catch (e) { /* geçmişe yazılamadı: Geri eskisi gibi */ } };
// sayfa bizim adımımızın üstündeyken yenilendiyse o adım taban sayılır (yoksa kapanışta önceki belgeye dönülüp oyun yeniden yüklenirdi)
if (onKb()) try { history.replaceState(null, ''); } catch (e) { /* yok */ }
addEventListener('popstate', () => {
  if (backing) { backing = false; if (closer && !onKb()) push(); return; } // kendi geri almamız; bu arada pencere açıldıysa adım yeniden
  if (onKb()) return;
  const c = closer; closer = null;
  if (c) c();
});
export function backOpen(close) {
  closer = close;
  if (!backing && !onKb()) push();
}
export function backClose(close) {
  if (closer === close) closer = null;
  if (pend) return;
  pend = true;
  setTimeout(() => {
    pend = false;
    if (closer || backing || !onKb()) return; // başka pencere açıldı, geri alma sürüyor ya da adım zaten yok
    backing = true;
    const tok = ++backTok;
    try { history.back(); } catch (e) { backing = false; return; }
    setTimeout(() => { if (backTok === tok) backing = false; }, 2000); // geri alma hiç sonuçlanmazsa kilit kalmasın
  }, 0);
}
