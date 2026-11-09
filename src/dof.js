// Alan derinliği (uzak-yakın hissi, 2026-10-28 kullanıcı isteği): yakınlaşınca ya da kamera yataya inince odak oyuncunun
// durduğu mesafede kalır; ondan uzaklaştıkça uzaklar giderek bulanıklaşır, çok yakın ön plan da hafifçe yumuşar.
// Sahne derinlik dokulu bir hedefe çizilir, tek bir tam ekran geçişte derinliğe göre değişen yarıçapla örneklenir
// (16 noktalı döndürülmüş sarmal disk, keskin ön planın arkaya taşmaması için örnek ağırlığı kendi bulanıklığıyla). Ton eşleme ve sRGB
// dönüşümü bu son geçişte yapılır. Güç 0'a yakınken hiç çalışmaz: normal görünümde ek maliyet yok.
import * as THREE from 'three';

let rt = null, quad = null, mat = null, cam2 = null, scene2 = null;
const size = new THREE.Vector2();

const FRAG = `
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform float cNear, cFar, focus, band, range, maxBlur; uniform vec2 texel;
varying vec2 vUv;
float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * cNear * cFar) / (cFar + cNear - z * (cFar - cNear)); }
float coc(float d) {
  float far = clamp((d - focus - band) / range, 0.0, 1.0); // oyuncu ve hemen arkası (band) net
  float nearB = clamp((focus * 0.55 - d) / (focus * 0.35), 0.0, 1.0) * 0.7;
  return max(far * far * (3.0 - 2.0 * far), nearB) * maxBlur;
}
void main() {
  vec4 base = texture2D(tColor, vUv);
  float c = coc(lin(texture2D(tDepth, vUv).x));
  vec3 acc = base.rgb; float w = 1.0;
  if (c > 0.6) {
    // altın açılı sarmal (Vogel diski), her pikselde farklı döndürülür: düzenli örnek deseni elek gibi görünmez
    float rot = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 2.39996323 + rot, r = sqrt((float(i) + 0.5) / 16.0);
      vec2 uv2 = vUv + vec2(cos(a), sin(a)) * (r * c) * texel;
      float c2 = coc(lin(texture2D(tDepth, uv2).x));
      float ww = clamp(c2 / c, 0.0, 1.0);
      acc += texture2D(tColor, uv2).rgb * ww; w += ww;
    }
  }
  gl_FragColor = vec4(acc / w, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function ensure(renderer) {
  renderer.getDrawingBufferSize(size);
  if (!rt) {
    rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(size.x, size.y) });
    mat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, cNear: { value: 0.1 }, cFar: { value: 1000 }, focus: { value: 20 }, band: { value: 3 }, range: { value: 12 }, maxBlur: { value: 0 }, texel: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    mat.toneMapped = true;
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    scene2 = new THREE.Scene(); scene2.add(quad); cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  } else if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);
}

// strength 0-1, focus: kameranın odak noktasına (oyuncuya) uzaklığı
export function renderDof(renderer, scene, camera, strength, focus) {
  if (strength < 0.02) { renderer.render(scene, camera); return; }
  ensure(renderer);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  const u = mat.uniforms, pr = renderer.getPixelRatio();
  u.cNear.value = camera.near; u.cFar.value = camera.far;
  // bulanıklık oyuncunun epey arkasında başlar (kullanıcı: "uzakları daha uzakta blurla"): odak mesafesinin 1,6 katında başlar, 3 katında tam
  u.focus.value = focus; u.band.value = focus * 0.6; u.range.value = focus * 1.4;
  u.maxBlur.value = 6.5 * strength * pr; // en çok ~6,5 CSS pikseli yarıçap
  u.texel.value.set(1 / size.x, 1 / size.y);
  renderer.render(scene2, cam2);
}
