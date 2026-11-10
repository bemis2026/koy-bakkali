// Kayıt diske de yazılır (serve.py POST /kayit → kayit/kayit.json): Chrome profili ya da tarayıcı değişse, sekme
// kaydetmeden kapansa da oyun kaldığı yerden açılır. Açılışta yerel kayıtla disk kaydından oyun süresi uzun olan seçilir;
// yalnızca menüden yeni oyun ya da kayıt içe aktarma açıkça seçildiyse yerel kayıt kazanır (stats.resetAt). Sunucu daha
// uzun oynanmış kaydın üstüne kısa kayıt yazmaz ve eskisini kayit/yedek'e yedekler.
// Test sekmesinde localStorage 'koyBakkali.nodisk'='1' diski tamamen kapatır (okuma da yazma da yok).
import { G, saveData, loadSave, writeSave } from './game.js';
import { visitId, visitSave, cloudPick, cloudTick } from './online-ui.js';

const FLAG = 'koyBakkali.newgame';
const time = (s) => (s && s.stats && s.stats.time) || 0;
const ls = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); // disk kaydı yalnız serve.py ile (yayındaki sitede yok)

// açılış kaydı: yerel ya da disk (await edilir)
export async function pickSave() {
  // komşu ziyareti (?ziyaret=uid): komşunun bulut kaydı yüklenir, hiçbir yere yazılmaz (online-ui.js)
  if (visitId()) { const v = await visitSave(); if (v) return { saved: v, flag: 0 }; location.replace(location.pathname); return new Promise(() => {}); }
  const local = loadSave();
  if (ls('koyBakkali.nodisk') === '1' || !LOCAL) { const flag = +ls(FLAG) || 0; return { saved: await cloudPick(local, flag), flag }; } // test: yalnızca yerel kayıt (ve hesabın bulut kaydı)
  let disk = null;
  try { const r = await fetch('kayit/kayit.json', { cache: 'no-store' }); if (r.ok) disk = await r.json(); } catch (e) { /* sunucu eski ya da kayıt yok */ }
  const flag = +ls(FLAG) || 0, reset = (local && local.stats && local.stats.resetAt) || 0;
  let pick = local;
  if (!flag && !(reset && disk && reset > (disk.ts || 0)) && disk && disk.unlocked && time(disk) > time(local)) pick = disk;
  pick = await cloudPick(pick, flag); // üye girdiyse buluttaki kayıt da tartılır; başka hesabın yerel kaydı alınmaz
  if (pick && pick !== local) writeSave(pick);
  return { saved: pick, flag };
}
// yeni oyun ya da içe aktarma sonrası ilk açılış: bu oyun açıkça seçildi, diskteki eski oyunun yerine geçebilir
export function applyFlag(flag) {
  if (!flag) return;
  G.stats.resetAt = flag;
  try { localStorage.removeItem(FLAG); } catch (e) { /* yok */ }
}
export function markNewGame() { try { localStorage.setItem(FLAG, String(Date.now())); } catch (e) { /* yok */ } }

let last = 0;
export function diskSave(exit = false) {
  if (!G.player || G.visit || G.tabStop) return; // komşu ziyaretinde ya da oyun başka sekmeye geçtiyse hiçbir kayıt yazılmaz (koruma.js)
  cloudTick(exit); // üyeyse buluta da (60 sn'de bir, çıkışta hemen)
  if (ls('koyBakkali.nodisk') === '1' || !LOCAL) return;
  const now = Date.now();
  if (!exit && now - last < 10000) return;
  last = now;
  const d = saveData(); d.ts = now;
  const txt = JSON.stringify(d);
  try {
    if (exit && navigator.sendBeacon) navigator.sendBeacon('kayit', new Blob([txt], { type: 'application/json' }));
    else fetch('kayit', { method: 'POST', body: txt, headers: { 'Content-Type': 'application/json' }, keepalive: txt.length < 60000 }).catch(() => {});
  } catch (e) { /* sunucu yok */ }
}
