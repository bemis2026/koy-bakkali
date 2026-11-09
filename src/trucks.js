// Pazarın tedarik kamyonları: sınırlı malı var. Mal bitince kamyon geri geri çıkar, pazarın doğusundan
// pazar caddesine ve köprüden dışarı gider, bir süre sonra yükle dönüp yerine park eder; mallar yeniden dizilir.
import * as THREE from 'three';
import { G, floatText, popIn, lerpAngle, rand } from './game.js';
import { heightAt } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
// pazar caddesi: batıya giden şerit z 5.8, doğuya giden z 7.4; park cebi z 9.6 (araç yolunun güneyinde), dönüş noktası pazarın batı ucunda,
// köy caddesinin ağzında. Cadde 3,2 m (z 5-8,2): park cebinin önünden yolun ortasından (PASS_Z) geçer, yoksa cepteki öbür aracın
// yanına sürtüyordu; dönüş de eskiden x 24,6'daydı, dönen araç cepteki kamyonun burnuna giriyordu (2026-11-05 kullanıcı: "trafikteki
// diğer taşıtlar da birbirlerinin içinden geçmesin"). Pazarda aynı anda tek tedarik aracı yola çıkar (moving)
const LANE_W = 5.8, LANE_E = 7.4, PASS_Z = 6.6, BAY_Z = 9.6, TURN_X = 21.0, FAR_X = 132; // harita genişletmesi: doğu blok +7
const ALL = [];
const moving = (me) => ALL.some((t) => t !== me && (t.state === 'out' || t.state === 'in'));
// park cebindeki kamyonun ve arkasındaki kasaların engelleri (world.js rcol): kamyon gidince kalkar, dönünce geri gelir
// (2026-11-01 kullanıcı: "pazar yerinin yanında araçların durduğu yerde araç olmayınca da takılıyor, geçilmiyor")
const inBay = (c, x) => c[0] >= x - 3.4 && c[1] <= x + 4.0 && c[2] >= BAY_Z - 1.3 && c[3] <= BAY_Z + 1.3;

export class SupplyTruck {
  // o: { obj, src (PaidSource), stock, cargo: [görünen mal nesneleri], hint: hint etiketi, name }
  constructor(o) {
    this.obj = o.obj; this.src = o.src; this.max = o.stock; this.cargo = o.cargo || []; this.hint = o.hint; this.name = o.name;
    this.src.stock = o.stock;
    this.park = o.obj.position.clone(); this.x = this.park.x;
    this.title = this.hint && this.hint.title ? this.hint.title.textContent : '';
    this.state = 'parked'; this.path = []; this.t = 0;
    ALL.push(this);
  }
  // mal azaldıkça kasalar ve kasadaki karpuzlar teker teker kaybolur
  showCargo(pop) {
    const n = Math.ceil((this.src.stock / this.max) * this.cargo.length);
    this.cargo.forEach((m, i) => { const v = i < n; if (v && !m.visible && pop) popIn(m, i * 0.05); m.visible = v; });
  }
  setTitle(t) { if (this.hint && this.hint.title) this.hint.title.textContent = t; }
  // yol noktalarına sürer; back: geri geri (burnu dönmez)
  drive(dt, back = false) {
    const p = this.obj.position;
    while (this.path.length) {
      const q = this.path[0], dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      const k = !back && G.hooks.crossK && d > 0.01 ? G.hooks.crossK(p, dx / d, dz / d) * (G.hooks.gapK ? G.hooks.gapK(this.obj, this.path) : 1) : 1; // pazar caddesinin yaya geçitlerinde (roads.js), önündeki taşıtta (events.js yol düzeni)
      const sp = (back ? 2.6 : p.x > 54 && q.x > 54 ? 12 : this.path.length === 1 && this.state === 'in' ? 2.6 : 5.5) * dt * k;
      if (!back && d > 1e-3) this.obj.rotation.y = lerpAngle(this.obj.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-5 * dt));
      if (d > sp) { p.x += (dx / d) * sp; p.z += (dz / d) * sp; return false; }
      p.x = q.x; p.z = q.z; this.path.shift();
      if (back) return !this.path.length;
    }
    return true;
  }
  hop() { const p = this.obj.position; p.y = heightAt(p.x, p.z); } // köprüde güverteye çıkar
  update(dt) {
    switch (this.state) {
      case 'parked':
        this.showCargo(false);
        if (this.src.stock <= 0 && !moving(this)) {
          // park cebinden ileri çıkar, batı uçtaki dönüş noktasında döner, doğu şeridinden şehre gider
          this.state = 'out'; this.path = [V(this.x - 3.5, 0, 6.9), V(TURN_X + 1.4, 0, LANE_W), V(TURN_X, 0, 6.6), V(TURN_X + 1.4, 0, PASS_Z), V(46, 0, PASS_Z), V(67, 0, LANE_E), V(FAR_X, 0, LANE_E)];
          this.cols = G.colliders.filter((c) => inBay(c, this.x));
          for (const c of this.cols) c.dyn = true; // gelip giden engel: yol ızgarası baştan kurulmaz, küçük harita yeniden çizilmez (world.js navGrid)
          for (const c of this.cols) { const i = G.colliders.indexOf(c); if (i >= 0) G.colliders.splice(i, 1); }
          this.setTitle(`🚚 ${this.name} mal almaya gitti`);
          floatText(V(this.x, 1.5, BAY_Z), '🚚 Mal bitti, kamyon yükü almaya gidiyor', 'neg');
        }
        break;
      case 'out':
        if (this.drive(dt)) { this.state = 'away'; this.t = rand(4, 7); this.obj.visible = false; }
        this.hop();
        break;
      case 'away': // dışarıda yük alır
        this.t -= dt;
        if (this.t <= 0 && !moving(this)) {
          this.state = 'in'; this.obj.visible = true;
          // batı şeridinden gelir, cebe çapraz girip batıya bakarak park eder
          this.obj.position.set(FAR_X, 0, LANE_W); this.obj.rotation.y = -PI / 2;
          this.path = [V(67, 0, LANE_W), V(this.x + 4.5, 0, LANE_W), V(this.x + 0.6, 0, BAY_Z), V(this.x, 0, BAY_Z)];
        }
        break;
      case 'in':
        this.hop();
        if (this.drive(dt)) {
          this.state = 'parked'; this.obj.position.copy(this.park); this.obj.rotation.y = -PI / 2;
          for (const c of this.cols || []) if (!G.colliders.includes(c)) G.colliders.push(c);
          this.cols = null;
          this.src.stock = this.max; this.showCargo(true);
          this.setTitle(this.title);
          floatText(V(this.x, 1.5, BAY_Z), '🚚 Mal geldi!', 'pos');
        }
        break;
    }
  }
}
