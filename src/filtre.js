// Kötü söz süzgeci (2026-11-10 yayın denetimi): canlı sohbet, oyuncu adları, köy adları ve hakkımda yazıları herkese görünüyor.
// temiz(s): uygunsuz sözcükleri yıldızlar (gösterirken ve gönderirken). uygun(s): profil kaydederken reddetmek için.
// Eşleştirme: küçük harf, rakamla yazılan harfler (0→o, 1→i, 3→e, 4→a, 5→s, @→a, $→s), uzatılan harfler tek (yarrrak → yarak),
// harf harf ayrılan yazı birleşir (o.r.o.s.p.u). "götür", "kayarak", "sıkı" gibi masum sözcükler yakalanmasın diye kısa kökler
// yalnız tam sözcük olarak aranır.
const PART0 = ['orospu', 'siktir', 'sikerim', 'sikeyim', 'sikiş', 'sikis', 'amına', 'amınak', 'aminak', 'amcık', 'amcik', 'pezevenk', 'kahpe',
  'yavşak', 'yavsak', 'şerefsiz', 'serefsiz', 'kaltak', 'fahişe', 'fahise', 'dalyarak', 'götveren', 'gotveren', 'yaraği', 'yarağı',
  'fuck', 'motherf', 'bitch', 'asshole', 'nigger', 'nigga', 'faget', 'fagot', 'cunt', 'siktig', 'siktiğ', 'sikic', 'sikiy', 'bullshit', 'shitty'];
const WORD0 = ['amk', 'aq', 'amq', 'mk', 'oç', 'oc', 'piç', 'göt', 'götü', 'götün', 'sik', 'sikik', 'sikim', 'sikem', 'yarak',
  'taşak', 'tasak', 'gavat', 'ibne', 'puşt', 'pust', 'sürtük', 'surtuk', 'şıllık', 'shit', 'dick', 'whore', 'slut', 'retard', 'bastard', 'porno', 'sex', 'seks', 'fck', 'fuk']; // 'amina' yok: Amina bir ad
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };
const norm = (w) => w.replace(/[013457@$!]/g, (c) => LEET[c]).replace(/(.)\1+/g, '$1');
// listeler de aynı sadeleştirmeden geçer: girdideki yinelenen harf teke indiği için çift harfli girişler (asshole, nigger, şıllık) hiç
// eşleşmiyordu (2026-11-10 denetimi)
const PART = PART0.map(norm), WORD = new Set(WORD0.map(norm));
const bad1 = (n) => { if (!n) return false; if (WORD.has(n)) return true; for (const p of PART) if (n.includes(p)) return true; return false; };
// büyük harfle SIKTIR yazılınca Türkçe küçültme "sıktır" verir: büyük I varsa düz küçültme de denenir
const bad = (w) => bad1(norm(w.toLocaleLowerCase('tr'))) || (/I/.test(w) && bad1(norm(w.toLowerCase())));

// o.r.o.s.p.u, f u c k: tek harfler ayraçla dizilmişse birleşik halleri de denetlenir
const SPLIT = /(?:^|\s)((?:[\p{L}\d@$!][\s._*\-+]+){2,}[\p{L}\d@$!])(?=\s|$)/gu;
export function temiz(s) {
  if (typeof s !== 'string' || !s) return s || '';
  let out = s.replace(SPLIT, (m, g) => (bad(g.replace(/[\s._*\-+]/g, '')) ? m.replace(g, '*'.repeat(g.length)) : m));
  out = out.replace(/[\p{L}\d@$!]+/gu, (w) => (bad(w) ? '*'.repeat(w.length) : w));
  return out;
}
export const uygun = (s) => temiz(String(s || '')) === String(s || '');
