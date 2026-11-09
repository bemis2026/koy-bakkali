// Firebase web uygulaması ayarları (Firebase konsolu → Proje ayarları → Uygulamalarınız → Köy Bakkalı → Config).
// Bu anahtarlar gizli değildir: tarayıcıya zaten gider; erişimi firestore.rules korur. null yapılırsa oyun çevrimdışı açılır.
export const FIREBASE = {
  apiKey: 'AIzaSyAjHaVhpTBk1uBUkKpQ5J3OoW9O5Wpa18g',
  authDomain: 'koy-bakkali.firebaseapp.com',
  projectId: 'koy-bakkali',
  storageBucket: 'koy-bakkali.firebasestorage.app',
  messagingSenderId: '938488408785',
  appId: '1:938488408785:web:763333ab996865916bb3f0',
  databaseURL: 'https://koy-bakkali-default-rtdb.europe-west1.firebasedatabase.app', // canlı ziyaret (canli.js, database.rules.json)
};
// Google girişi sitenin kendi alan adından yürüsün (iPhone, kurulu uygulama ve yönlendirmeli giriş için şart). Önce Google Cloud
// konsolunda → API'ler → Kimlik bilgileri → "Web client (auto created by Google Service)" → Yetkili yönlendirme URI'leri'ne
// https://koy-bakkali.web.app/__/auth/handler eklenmeli; eklenmeden true yapılırsa Google "redirect_uri_mismatch" verir.
// 2026-10-27: adres ve https://koy-bakkali.web.app kaynağı eklendi, Google kabul ediyor.
export const AUTH_SAME_SITE = true;
