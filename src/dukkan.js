// Köy bakkalının büyüme aşamaları (dukkan-plan.md): her aşamanın zemini, kapısı, kasa bankosu ve müşteri yolu.
// Arka duvar sabit (kuzeyde ana yol); dükkân güneye ve iki yana büyür. Kasa önde, kasiyer içeri (raflara) bakar,
// müşteri bankonun kuzeyinde öder ve kuyruğu doğuya uzanır; kapı ön duvarın batı ucunda.
import * as THREE from 'three';
import { G } from './game.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const BACK_IN = -13.0; // arka duvarın iç yüzü (duvar ortası −13,2)
export const STAGES = [null,
  { x0: -6.75, x1: 6.75, zf: -5.2, name: 'Köy dükkânı' },
  { x0: -10.5, x1: 10.5, zf: -1.6, name: 'Bakkal' },
  // köy bölgesinin doğu ucuna kadar büyüdü (2026-10-28); 2026-11-01 öne (güneye) 1,6 m daha büyüdü: raf sıraları arası 3 m
  // (kullanıcı: "markette raflar çok yakın birbirine, rahat koşulmuyor, aralarını aç"); bahçe yatakları güneye kaydı (world.js GARDEN)
  { x0: -13, x1: 15.4, zf: 2.8, name: 'Köy marketi' },
  // büyük köy marketi (2026-11-02 kullanıcı: "bakkala ayrılan alanı büyüt"; seçimi: doğuya, bahçe yerinde kalsın): doğuya 2,8 m, yan
  // basamağı köy caddesinin batı bordürüne dayanır. Eskiden 4,7 m büyüyüp caddenin yarısını alıyordu (2026-11-05 kullanıcı: "en son
  // büyütmede kaldırıma taşıyor ... üst üste biniyor"; seçimi: caddeden geri çek). Açılan doğu şeridinde dört makine (koymakine.js)
  { x0: -13, x1: 18.2, zf: 2.8, name: 'Büyük köy marketi' },
];
export const DOOR_W = 2.4;
export const WEST_X = -14.4; // dükkânın batısında müşterilerin kuzey-güney yürüdüğü şerit (son aşamanın duvarının dışında)
export const shopStage = () => (G.regions && G.regions.koy && G.regions.koy.stage) || 1;
const S = (n) => STAGES[n || shopStage()];
export const doorX = (n) => S(n).x0 + 2.0;
export const counterAt = (n) => ({ x: S(n).x0 + 5.0, z: S(n).zf - 1.45 });
export const cashierAt = (n) => ({ x: counterAt(n).x - 0.4, z: S(n).zf - 0.55 });
export const payZ = (n) => S(n).zf - 2.5;
// kuyruk: doğuya 7 kişi, uzarsa U çizip bir sıra güneyde batıya döner (5 kişi daha; eskiden fazlası son yerde üst üste biniyordu)
const snake = (x, z, a, b) => [...Array.from({ length: a }, (_, i) => V(x + i * 1.2, 0, z)), ...Array.from({ length: b }, (_, i) => V(x + (a - 1 - i) * 1.2, 0, z + 1.0))];
export const queueAt = (n) => snake(counterAt(n).x, payZ(n), 7, 5);
export const doorIn = (n) => V(doorX(n), 0, S(n).zf - 1.2);
// kapının önü: köy marketinde bahçe yataklarına yakın, ön basamakla yatak arasındaki şeritte
const outZ = (n) => S(n).zf + ((n || shopStage()) >= 3 ? 0.8 : 1.4);
export const doorOut = (n) => V(doorX(n), 0, outZ(n));
// müşteri kapıları (2026-11-11 kullanıcı: "müşteriler bakkala tek yönden geliyor, onu da çeşitlendir, tek yolda kuyruklar oluşmasın"):
// batı kapısı (köy yolundan; eskiden tek giriş), güney kapısı (sahil yolundan bahçelerin ortasındaki geçitten gelir, ön koridordan ikinci
// kasanın kuyruğunun doğusundan girer) ve doğu yanı (pazar caddesinden köy caddesine döner). Dükkânın önü ve yanları açık: kapı yürüme
// yolunun içeride bittiği yer. İlk küçük dükkânın önü kuyrukla dolu: orada yalnız batı kapısı
export const GARDEN_GAP_X = -1.6; // bahçe yataklarının ortadaki geçidi (world.js GARDEN: -2,7…-0,5)
const southX = (n) => (n >= 3 ? 7.3 : 9.7), eastZ = (n) => (n >= 3 ? 0.4 : -3.0);
export const doors = (n) => ((n || shopStage()) >= 2 ? ['bati', 'guney', 'dogu'] : ['bati']);
export function doorPts(door, n) {
  const k = n || shopStage(), s = S(k), oz = outZ(k);
  if (door === 'guney') return [V(GARDEN_GAP_X, 0, oz), V(southX(k), 0, oz), V(southX(k), 0, s.zf - 1.2)];
  if (door === 'dogu') return [V(s.x1 + 0.9, 0, eastZ(k)), V(s.x1 - 1.4, 0, eastZ(k))];
  return [V(WEST_X, 0, oz), doorOut(k), doorIn(k)];
}
// dükkân içi yürüyüş: girişte kapıdan, çıkışta kapıya (batı kapısı kasanın batısında)
export const enterPts = (n, door = 'bati') => doorPts(door, n);
export const leavePts = (n, door = 'bati') => doorPts(door, n).reverse();
// ikinci kasa (world.js addRegister, 2026-11-01 kullanıcı: "yeni kasa ekleme alma opsiyonumuz da olsun"): birinci kasanın kuyruğunun
// doğu ucunun ötesinde, aynı hizada; kuyruğu da doğuya uzanır (5 kişi). Bakkal aşamasından itibaren dükkânın içinde kalır
export const counter2At = (n) => ({ x: counterAt(n).x + 9.6, z: counterAt(n).z });
export const cashier2At = (n) => ({ x: counter2At(n).x - 0.4, z: S(n).zf - 0.55 });
export const queue2At = (n) => snake(counter2At(n).x, payZ(n), 5, 3);
export function counter2Col(n) { const c = counter2At(n); return [c.x - 1.35, c.x + 1.35, c.z - 0.55, c.z + 0.55]; }
// eleman bekleme yeri: ön koridorun doğu ucu (kuyruğun güneyi, kapıdan uzak). Büyük köy marketinde orada makine ürünlerinin rafları
// var (world.js KOY_LAYOUT), doğu kapısının yolu da makine şeridinin güney ucundan geçer: elemanlar içeride, ilk makinenin batısında bekler
export const staffIdle = (n) => { const k = n || shopStage(), s = S(k); return k >= 4 ? [s.x1 - 6.0, s.x1 - 3.6, -2.2, -1.0] : [s.x1 - 5.2, s.x1 - 1.6, s.zf - 1.1, s.zf - 0.6]; };
// dükkânın duvar engelleri (dünya koordinatı): yalnız arka duvar. Ön ve yanlar açık (kullanıcı 2026-10-28: "öndeki duvarlar
// da komple kalksın"): her yönden girilir; müşteriler yine kapının yerinden (doorX) girip çıkar
export function shellCols(n) {
  const s = S(n);
  return [[s.x0 - 0.4, s.x1 + 0.4, -13.5, -12.9]];
}
export function counterCol(n) { const c = counterAt(n); return [c.x - 1.35, c.x + 1.35, c.z - 0.55, c.z + 0.55]; }
