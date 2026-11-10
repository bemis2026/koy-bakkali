// Semt pazarındaki rakipler. Üç rakip tezgah müşteri kapışır: pazara giren müşteri senin tezgahın, rakipler ya da hiçbiri
// arasında seçer. Seçimi istediği ürünün tezgahta olup olmaması, mahalle puanın (rating.js), rakibin indirim kampanyası,
// BAĞIR düğmesi ve boş yer belirler. Son 30 alışverişten pazar payın hesaplanır. Pay yükselince sıradaki rakibin tezgahı
// satın alınabilir olur: satın aldığın tezgah senin adına satar (tentesi senin rengine döner, satıcısı senin gömleğini
// giyer), satışın %60'ı pazar kasana düşer. Kayıt: G.stats.pz (pay geçmişi), pzOwned, pzShown.
// shops: kendi satıcısı olan bizim yerler (salça kazanının salçacısı, expand-west.js): müşteri satıcının önüne gelir, gerçek ürünü tepsiden alır,
// parasının tamamı pazar kasasına düşer. Bir alanları: type, sells, vendor, spots (lane'li), has(), take()
import * as THREE from 'three';
import * as M from './models.js';
import { G, ITEMS, UnlockPad, makeItem, floatText, bounce, sfx, rand, pick, popIn, loadSave, mult } from './game.js';
import { say } from './texts.js';
import { rep } from './rating.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
const HIST = 30, CUT = 0.6, PROMO_T = 20;
const RIVALS = [
  // U düzeninde (world.js): Hasan kuzeyin batı yarısında, Çiftlik yolunun öbür yanında; Ayşe Teyze ve Rıza batı kolda, avluya bakar.
  // Sıra bizim alandan uzaklaşır: satın aldıkça alanımız U boyunca büyür. ry: tezgâhın baktığı yön, lane: yan kolda müşterinin yürüdüğü şerit
  { id: 'r1', name: "Hasan'ın Sebzeleri", x: 34, z: -11.8, ry: 0, lane: 35.6, col: '#e8604c', look: { shirt: '#5b6770', hat: 'cap', hatColor: '#e8604c', skin: '#d9a67c', mustache: true },
    sells: ['karpuz', 'domates', 'biber', 'patlican'], appeal: 0.38, every: [80, 130], need: 45, price: 1500, pad: [34, -8.1], line: 'Bizim domates kokar!' },
  { id: 'r2', name: "Ayşe Teyze'nin Bahçesi", x: 31, z: -5, ry: PI / 2, lane: 34.8, col: '#3d7dd8', look: { shirt: '#7a3b6e', pants: '#5a3b6b', hat: 'scarf', hatColor: '#ffffff', skin: '#e0b48a', fem: true },
    sells: ['domates', 'salatalik', 'biber'], appeal: 0.32, every: [100, 160], need: 55, price: 2400, pad: [34.7, -5], line: 'Kendi bahçemden, ilaçsız!' },
  { id: 'r3', name: 'Ucuzcu Rıza', x: 31, z: -0.4, ry: PI / 2, lane: 34.8, col: '#3fae6b', look: { shirt: '#e8a33c', pants: '#3a3a3a', hat: 'cap', hatColor: '#2a2a2a', skin: '#c68e5f', mustache: true },
    sells: ['karpuz', 'patlican', 'salatalik', 'domates'], appeal: 0.42, every: [55, 95], need: 62, price: 3400, pad: [34.7, -0.4], line: 'Pazarın en ucuzu bende!' },
];

const CSS = `.promo { position: absolute; left: 0; top: 0; padding: 4px 10px; border-radius: 999px; background: #e8604c; color: #fff; border: 2px solid #fff; font: 15px var(--font-title); white-space: nowrap; box-shadow: 0 3px 0 rgba(0,0,0,.25); pointer-events: none; animation: promoB .5s ease-in-out infinite alternate; }
@keyframes promoB { from { filter: none; } to { filter: brightness(1.2); } }`;

export function setupRivals(R, T) {
  const C = R.content, { put, rcol, hint } = T;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const list = RIVALS.map((d) => {
    const rv = { ...d, owned: false, promo: 0, promoT: rand(d.every[0] * 0.4, d.every[1] * 0.6), pad: null, padAt: d.pad };
    const sn = Math.sin(d.ry), cs = Math.cos(d.ry);
    rv.stall = put(C, M.makeStall(d.col, { label: d.name, ry: d.ry }), d.x, 0, d.z, d.ry);
    const hx = Math.abs(cs) * 1.8 + Math.abs(sn) * 0.8, hz = Math.abs(sn) * 1.8 + Math.abs(cs) * 0.8;
    rcol(R, d.x - hx, d.x + hx, d.z - hz, d.z + hz);
    // ürünler sütun sütun: ne sattığı uzaktan okunur (eskiden dokuz yer karışıktı)
    M.STALL_SLOTS.forEach((s, i) => {
      const m = makeItem(d.sells[Math.floor(i / M.STALL_ROWS.length) % d.sells.length]);
      m.position.copy(s); m.userData.good = true; rv.stall.add(m);
    });
    rv.vendor = put(C, M.makeCharacter(d.look), d.x - sn * 1.7, 0, d.z - cs * 1.7, d.ry);
    // müşterinin durduğu üç yer tezgâhın önünde; yüzü tezgâha (ry + PI)
    rv.spots = [-1.1, 0, 1.1].map((dx) => ({ p: V(d.x + cs * dx + sn * 2.1, 0, d.z - sn * dx + cs * 2.1), c: null, ry: d.ry + PI, lane: d.lane ?? null }));
    return rv;
  });
  const owned = () => G.stats.pzOwned || (G.stats.pzOwned = []);
  const shown = () => G.stats.pzShown || (G.stats.pzShown = []);
  const hist = () => G.stats.pz || (G.stats.pz = []);
  let started = false, shoutT = 4, shareHint = null;

  function share() { const h = hist(); return h.length < 6 ? null : Math.round((100 * h.reduce((a, b) => a + b, 0)) / h.length); }
  function note(mine) { const h = hist(); h.push(mine ? 1 : 0); if (h.length > HIST) h.splice(0, h.length - HIST); }

  // satın alınan tezgah: tente senin renginde yeniden kurulur, ürünler yeni tezgaha geçer, satıcı senin gömleğini giyer
  function buy(rv, instant) {
    rv.owned = true;
    if (!owned().includes(rv.id)) owned().push(rv.id);
    const old = rv.stall, nst = M.makeStall('#f6c343', { label: rv.name, ry: rv.ry }); // bizim tezgâhların sarısı (world.js R.addStall)
    nst.position.copy(old.position); nst.rotation.copy(old.rotation);
    for (const ch of [...old.children]) if (ch.userData.good) nst.add(ch);
    old.parent.add(nst); old.parent.remove(old); rv.stall = nst;
    const shirt = new THREE.MeshStandardMaterial({ color: (G.custom && G.custom.shirt) || '#3b8beb', roughness: 0.85 });
    for (const s of rv.vendor.userData.shirtMeshes || []) s.material = shirt;
    rv.promo = 0; if (rv.promoL) rv.promoL.hidden = true;
    if (rv.hint) { rv.hint.title.textContent = `${rv.name} · artık senin`; const sm = rv.hint.el.querySelector('small'); if (sm) sm.textContent = 'Senin adına satar; satışın %60\'ı pazar kasana düşer. Rakip sayısı azaldı, pazar payın arttı.'; rv.hint.el.querySelector('.hi').textContent = '🤝'; }
    if (R.claim) R.claim(rv); // tahta döşeme altına da gelir: alanımız büyür
    if (rv.pad) { rv.pad.dispose(); rv.pad = null; }
    if (!instant) { popIn(nst); bounce(rv.vendor, 0.3); floatText(rv.vendor.position, `${rv.name} artık senin!`, 'pos'); sfx('unlock'); }
  }
  function showPad(rv, paid = 0) {
    if (rv.pad || rv.owned) return;
    if (!shown().includes(rv.id)) shown().push(rv.id);
    rv.pad = new UnlockPad({ id: rv.id, icon: '🤝', title: `${rv.name} · satın al`, price: rv.price, at: rv.padAt }, () => { rv.pad = null; buy(rv, false); });
    if (paid > 0) { rv.pad.paid = Math.min(paid, rv.price - 1); rv.pad.refresh(); }
  }

  const API = {
    list, share, note, shops: [],
    activate() {
      shareHint = hint(40.6, 2.6, 3.4, '📊', 'Pazar payın', 'Müşterilerin kaçta kaçı senden alıyor. Tezgahını dolu, puanını yüksek tut; rakip indirime girince BAĞIR. Pay yükselince rakip tezgahları satın alabilirsin.', 6);
      for (const rv of list) {
        rv.hint = hint(rv.x, 3.9, rv.z - 0.2, '😤', rv.name, `Rakip tezgah: müşterilerini kapar. Arada indirim yapar, o zaman BAĞIR. Pazar payın %${rv.need} olunca satın alabilirsin.`, 3.4);
        const el = document.createElement('div'); el.className = 'promo'; el.textContent = '🔥 %20 İNDİRİM';
        rv.promoL = G.labels.add(el, (v) => v.set(rv.x, 3.3, rv.z)); rv.promoL.hidden = true;
      }
    },
    // pazara giren müşterinin seçimi: 'me', bir rakip ya da null (hiçbiri, geçip gider)
    choose(c) {
      const S = rep() / 100, shout = G.shout.t > 0, opts = [];
      const mine = R.stallOf && R.stallOf[c.want]; // istediği ürünün senin tezgahın
      if (mine && !mine.packed && mine.spots.some((s) => !s.c)) { // toplu tezgaha müşteri gelmez (world.js R.tidy)
        const has = mine.count() > 0;
        opts.push(['me', (has ? 1.3 : 0.18) * (0.45 + 1.1 * S) * (shout ? 3 : 1)]);
      }
      for (const rv of list) {
        if (!rv.sells.includes(c.want) || !rv.spots.some((s) => !s.c)) continue;
        opts.push([rv, rv.owned ? 0.55 : rv.appeal * (rv.promo > 0 ? 1.9 : 1) * (1.25 - 0.7 * S) * (shout ? 0.25 : 1)]);
      }
      for (const sh of API.shops) if (sh.sells.includes(c.want) && sh.has() && sh.spots.some((s) => !s.c)) opts.push([sh, 1.1 * (0.45 + 1.1 * S)]);
      opts.push([null, 0.12]);
      let r = Math.random() * opts.reduce((a, o) => a + o[1], 0);
      for (const [k, w] of opts) { r -= w; if (r <= 0) return k; }
      return null;
    },
    send(c, rv, away) {
      const sp = rv.spots.find((s) => !s.c); sp.c = c;
      c.rv = rv; c.rvSpot = sp; c.away = away; c.rvState = 'go'; c.t = 0;
      c.path = R.approach(sp);
      c.state = 'rival';
    },
    think(c, dt) {
      if (c.rvState === 'go') { if (c.walk(dt)) { c.rvState = 'buy'; c.t = 0; } return; }
      c.face(c.rvSpot.ry, dt); c.t += dt;
      if (c.t < 1.8) return;
      const rv = c.rv, t = c.want;
      if (rv.shop) { // salçacı: tepsideki kavanozu verir; kavanoz yoksa biraz bekler (kazan yenisini yapıyordur)
        if (!rv.has() && c.t < 9) return;
        const it = rv.has() ? rv.take() : null;
        if (it) {
          c.stack.push(t, it, 0.3); bounce(rv.vendor, 0.12); note(true);
          const pay = Math.max(1, Math.round(ITEMS[t].price * mult()));
          R.pile.add(pay, c.obj.position); floatText(c.obj.position, `+${pay} ₺`, G.boost > 0 ? 'pos x2' : 'pos'); sfx('cash', { at: c.obj.position });
          G.stats.sold++; G.stats.customers++;
        }
        c.rvSpot.c = null; c.away(); return;
      }
      const it = makeItem(t); it.position.set(rv.x + Math.sin(rv.ry) * 0.3, 1.2, rv.z + Math.cos(rv.ry) * 0.3); G.scene.add(it); c.stack.push(t, it, 0.3);
      bounce(rv.vendor, 0.12);
      note(rv.owned);
      if (rv.owned) {
        const pay = Math.max(1, Math.round(ITEMS[t].price * CUT * mult()));
        R.pile.add(pay, c.obj.position); floatText(c.obj.position, `+${pay} ₺`, 'pos'); sfx('cash', { at: c.obj.position });
        G.stats.sold++;
      }
      c.rvSpot.c = null; c.away();
    },
    update(dt) {
      if (!started) {
        // kayıttan dönüş: G.stats ilk karede hazır. Satın alınanlar kurulur, görünmüş satın alma padleri yarım ödemesiyle geri gelir
        started = true;
        const pads = G.pads0 || (loadSave() || {}).pads || {}; // açılıştaki kayıt (world.js): arka sekmede ilk kareden önce yazılan kayıt yarım ödemeyi silmesin
        for (const rv of list) { if (owned().includes(rv.id)) buy(rv, true); else if (shown().includes(rv.id)) showPad(rv, pads[rv.id] || 0); }
      }
      const s = share();
      if (shareHint) { const t = s === null ? 'Pazar payın · ölçülüyor' : `Pazar payın · %${s}`; if (shareHint.title.textContent !== t) shareHint.title.textContent = t; }
      // sıradaki rakip: bir öncekini almadan sonrakine geçilmez
      const next = list.find((rv) => !rv.owned);
      if (next && !next.pad && s !== null && hist().length >= 10 && s >= next.need) {
        showPad(next);
        floatText(next.vendor.position, 'Tezgahımı satın alır mısın?', 'rival');
      }
      // satıcılar tezgâhını düzeltir, arada el edip müşteri çağırır (2026-11-04: heykel gibi duruyorlardı); kampanyada daha hızlı
      const pl = G.player.position;
      for (const rv of list) if (Math.abs(rv.x - pl.x) < 40 && Math.abs(rv.z - pl.z) < 40) { M.animateCharacter(rv.vendor, 0, dt, false); M.workMotion(rv.vendor, 'sat', dt, rv.promo > 0 || rv.spots.some((q) => q.c)); }
      for (const sh of API.shops) if (Math.abs(sh.x - pl.x) < 40 && Math.abs(sh.z - pl.z) < 40) { const on = sh.spots.some((q) => q.c); M.animateCharacter(sh.vendor, 0, dt, false); M.workMotion(sh.vendor, on ? 'sat' : 'karistir', dt, true); } // müşteri yokken kazanı karıştırır
      for (const rv of list) {
        if (rv.owned) continue;
        if (rv.promo > 0) {
          rv.promo -= dt;
          if (rv.promo <= 0) { rv.promoL.hidden = true; rv.promoT = rand(rv.every[0], rv.every[1]); }
        } else if ((rv.promoT -= dt) <= 0) {
          rv.promo = PROMO_T; rv.promoL.hidden = false;
          floatText(rv.vendor.position, 'İndirim var, indirim!', 'rival'); bounce(rv.vendor, 0.25);
        }
      }
      // rakipler bağırır: kampanyadaki daha sık
      shoutT -= dt;
      const loud = list.filter((rv) => !rv.owned);
      if (shoutT <= 0 && loud.length) {
        const promo = loud.filter((rv) => rv.promo > 0), rv = promo.length && Math.random() < 0.7 ? pick(promo) : pick(loud);
        shoutT = rand(5, 9);
        floatText(rv.vendor.position, Math.random() < 0.3 ? rv.line : say('rival'), 'rival'); bounce(rv.vendor, 0.1);
      }
    },
  };
  return API;
}
