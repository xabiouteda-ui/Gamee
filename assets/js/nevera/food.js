// Platos en 3D hechos con código para «¿Qué cocino con lo que tengo?».
// buildDish(receta, i) elige el tipo de plato por el nombre de la receta (tortilla, pizza, espaguetis, crema,
// guiso, paella, ensalada, huevos rotos, hamburguesa…) y lo modela con tostados pintados por vértice,
// relieve de ruido, salsas brillantes y guarnición. Devuelve { group, top, hot }.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------- Azar con semilla (el mismo plato siempre sale igual) ----------
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
let R = Math.random;
const r = (a, b) => a + R() * (b - a);
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const TAU = Math.PI * 2;

// ---------- Ruido para tostados y relieve ----------
const ih = (x, y, z) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(ih(xi, yi, zi), ih(xi + 1, yi, zi), u), l(ih(xi, yi + 1, zi), ih(xi + 1, yi + 1, zi), u), v),
    l(l(ih(xi, yi, zi + 1), ih(xi + 1, yi, zi + 1), u), l(ih(xi, yi + 1, zi + 1), ih(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm = (x, y, z) => (vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15);

let BUMP = null;
function bump() {
  if (BUMP) return BUMP;
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const n = fbm(x / 9, y / 9, 3) * 0.7 + vnoise(x / 2.5, y / 2.5, 7) * 0.3;
    const k = (y * 256 + x) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = n * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  BUMP = new THREE.CanvasTexture(c); BUMP.wrapS = BUMP.wrapT = THREE.RepeatWrapping; BUMP.repeat.set(3, 3); BUMP.userData.shared = true;
  return BUMP;
}

// Pinta cada vértice: fn(x, y, z, color)
function paint(geo, fn) {
  const p = geo.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let k = 0; k < p.count; k++) { fn(p.getX(k), p.getY(k), p.getZ(k), col); c[k * 3] = col.r; c[k * 3 + 1] = col.g; c[k * 3 + 2] = col.b; }
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return geo;
}
// Tostado: color base que se dora y se quema a manchas
function toast(base, dark, burnt, scale = 30, amount = 0.6) {
  const a = new THREE.Color(base), b = new THREE.Color(dark), c = new THREE.Color(burnt);
  return (x, y, z, col) => {
    const n = fbm(x * scale + 11, y * scale + 5, z * scale + 3);
    const t = THREE.MathUtils.smoothstep(n, 0.42, 0.42 + 0.45 * amount);
    col.copy(a).lerp(b, t);
    if (n > 0.66) col.lerp(c, THREE.MathUtils.smoothstep(n, 0.66, 0.8) * 0.8);
  };
}
function lumpy(geo, amt, f = 18, seed = r(0, 50)) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k);
    const n = 1 + amt * (fbm(v.x * f + seed, v.y * f, v.z * f) - 0.5) * 2;
    p.setXYZ(k, v.x * n, v.y * n, v.z * n);
  }
  geo.computeVertexNormals(); return geo;
}

// ---------- Materiales ----------
const M = {
  std: (color, rough = 0.6, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...o }),
  painted: (rough = 0.62, o = {}) => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: rough, bumpMap: bump(), bumpScale: 1.2, ...o }),
  gloss: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.12, ...o }),
  sauce: (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.3 }),
};

// ---------- Piezas ----------
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent?.add(m); return m;
};
function instances(parent, geo, mat, n, colors, place) {
  const im = new THREE.InstancedMesh(geo, mat, n), o = new THREE.Object3D(), c = new THREE.Color();
  for (let k = 0; k < n; k++) {
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
    place(o, k); o.updateMatrix(); im.setMatrixAt(k, o.matrix);
    if (colors) { c.setHex(Array.isArray(colors) ? colors[k % colors.length] : colors).offsetHSL(r(-0.01, 0.01), r(-0.05, 0.05), r(-0.05, 0.05)); im.setColorAt(k, c); }
  }
  im.castShadow = true; im.receiveShadow = true; parent.add(im); return im;
}
const disc = (rad, rmin = 0) => { const a = r(0, TAU), d = Math.sqrt(r(rmin * rmin / (rad * rad), 1)) * rad; return [Math.cos(a) * d, Math.sin(a) * d]; };

// Hoja (lechuga, albahaca, perejil): plano curvado con borde ondulado
function leafGeo(len, wid, curl = 0.5, ruffle = 0.004) {
  const g = new THREE.PlaneGeometry(1, 1, 10, 6), p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const u = p.getX(k), v = p.getY(k), w = Math.pow(Math.sin(Math.PI * (u + 0.5)), 0.7) * wid;
    const x = u * len, z = v * 2 * w;
    p.setXYZ(k, x, (v * v) * curl * wid * 2 + Math.sin(u * 23 + v * 9) * ruffle * Math.abs(v) * 2 - u * u * 0.04 * len, z);
  }
  g.computeVertexNormals(); return g;
}
function herbs(parent, n, rad, y, color = [0x2f7d32, 0x3e9142, 0x276b2b], size = 0.022) {
  instances(parent, leafGeo(size, size * 0.42, 0.4), M.std(0xffffff, 0.45, { side: THREE.DoubleSide }), n, color, (o) => {
    const [x, z] = disc(rad); o.position.set(x, y + r(0, 0.012), z); o.rotation.set(r(-0.5, 0.5), r(0, TAU), r(-0.4, 0.4)); o.scale.setScalar(r(0.7, 1.2));
  });
}
function pepper(parent, n, rad, y) {
  instances(parent, new THREE.IcosahedronGeometry(0.0025, 0), M.std(0x1c1410, 0.8), n, null, (o) => { const [x, z] = disc(rad); o.position.set(x, y + r(0, 0.01), z); o.scale.setScalar(r(0.6, 1.4)); });
}
function oil(parent, n, rad, y, color = 0xd8c23a) {
  instances(parent, new THREE.CircleGeometry(0.012, 16).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 }), n, null, (o) => {
    const [x, z] = disc(rad); o.position.set(x, y, z); o.scale.set(r(0.5, 1.4), 1, r(0.5, 1.2));
  });
}
function shavings(parent, n, rad, y) {
  instances(parent, new THREE.BoxGeometry(0.03, 0.0025, 0.012), M.std(0xf4e2a6, 0.5), n, [0xf4e2a6, 0xeed98f], (o) => {
    const [x, z] = disc(rad); o.position.set(x, y + r(0, 0.02), z); o.rotation.set(r(-0.7, 0.7), r(0, TAU), r(-0.7, 0.7)); o.scale.setScalar(r(0.6, 1.2));
  });
}
function croutons(parent, n, rad, y) {
  const g = paint(new THREE.BoxGeometry(0.026, 0.022, 0.024, 2, 2, 2), toast(0xe7bd6c, 0xb9772c, 0x6b3c15, 60, 0.8));
  instances(parent, g, M.painted(0.7), n, null, (o) => { const [x, z] = disc(rad); o.position.set(x, y, z); o.rotation.set(r(0, 3), r(0, 3), r(0, 3)); });
}
// Cinta de jamón: plano ondulado rosado con veta de grasa
function hamGeo() {
  const g = new THREE.PlaneGeometry(0.09, 0.03, 16, 3), p = g.attributes.position;
  for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(p.getX(k) * 90) * 0.008);
  g.rotateX(-Math.PI / 2);
  return paint(g, (x, y, z, c) => c.setHex(0xb8394a).lerp(new THREE.Color(0xf3dede), THREE.MathUtils.smoothstep(Math.sin(x * 60 + z * 200), 0.75, 0.95)));
}
function ham(parent, n, rad, y) {
  instances(parent, hamGeo(), M.std(0xffffff, 0.45, { vertexColors: true, side: THREE.DoubleSide }), n, null, (o) => {
    const [x, z] = disc(rad); o.position.set(x, y + r(0, 0.015), z); o.rotation.set(r(-0.3, 0.3), r(0, TAU), r(-0.3, 0.3));
  });
}
function chunks(parent, n, rad, y, colors, size = 0.022, gloss = false) {
  instances(parent, lumpy(new THREE.BoxGeometry(size, size * 0.8, size, 2, 2, 2), 0.18, 40), gloss ? M.gloss(0xffffff) : M.std(0xffffff, 0.55), n, colors, (o) => {
    const [x, z] = disc(rad); o.position.set(x, y + r(0, 0.012), z); o.rotation.set(r(0, 3), r(0, 3), r(0, 3)); o.scale.setScalar(r(0.7, 1.2));
  });
}
function strips(parent, n, rad, y, colors) {
  const g = new THREE.TorusGeometry(0.035, 0.006, 6, 12, Math.PI * 0.7); g.scale(1, 1, 1.4);
  instances(parent, g, M.gloss(0xffffff), n, colors, (o) => { const [x, z] = disc(rad); o.position.set(x, y + r(0, 0.01), z); o.rotation.set(Math.PI / 2 + r(-0.3, 0.3), r(-0.3, 0.3), r(0, TAU)); });
}
function peas(parent, n, rad, y, color = 0x6cb043) {
  instances(parent, new THREE.SphereGeometry(0.009, 10, 8), M.gloss(color), n, [color], (o) => { const [x, z] = disc(rad); o.position.set(x, y + r(0, 0.008), z); });
}
function cherryHalves(parent, n, rad, y) {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) {
    const h = new THREE.Group();
    mesh(new THREE.SphereGeometry(0.022, 20, 12, 0, TAU, 0, Math.PI / 2), M.gloss(0xd7261b), 0, 0, 0, h);
    const cut = mesh(new THREE.CircleGeometry(0.021, 20), M.std(0xf05a3c, 0.4), 0, 0.0005, 0, h); cut.rotation.x = -Math.PI / 2;
    for (let s = 0; s < 4; s++) mesh(new THREE.SphereGeometry(0.003, 6, 4), M.std(0xf6d36b, 0.4), Math.cos(s * 1.6) * 0.009, 0.002, Math.sin(s * 1.6) * 0.009, h);
    const [x, z] = disc(rad); h.position.set(x, y, z); h.rotation.set(Math.PI + r(-0.9, -0.4), r(0, TAU), 0); g.add(h);
  }
  parent.add(g);
}
function lemon(parent, x, z, rotY = 0) {
  const g = new THREE.CylinderGeometry(0.04, 0.04, 0.018, 16, 1, false, 0, Math.PI * 0.6); g.rotateX(Math.PI / 2);
  const m = mesh(g, M.gloss(0xf3cf32), x, 0.03, z, parent); m.rotation.set(-0.4, rotY, 0);
}
function drizzle(parent, color, n, rad, y, thick = 0.004) {
  const pts = []; let a = r(0, TAU);
  for (let k = 0; k < n; k++) { a += r(1.8, 2.6); const d = r(0.3, 1) * rad; pts.push(new THREE.Vector3(Math.cos(a) * d, y + r(0, 0.004), Math.sin(a) * d)); }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 12, thick, 6); g.scale(1, 0.6, 1);
  mesh(g, M.sauce(color), 0, 0, 0, parent);
}

// ---------- Recipientes ----------
const lathe = (pts, seg = 64, a = 0, b = TAU) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, a, b);
const PLATE_STYLES = [[0xd9cfbb, 0x2f7a52], [0xc9643a, 0xf5e2c8], [0x24476e, 0xe9c46a]];
function plate(g, i) {
  const [pc, rc] = PLATE_STYLES[i % 3];
  const m = mesh(lathe([[0, 0.012], [0.22, 0.012], [0.26, 0.02], [0.33, 0.047], [0.365, 0.052], [0.37, 0.046], [0.33, 0.034], [0.25, 0.004], [0.2, 0], [0, 0]]),
    new THREE.MeshPhysicalMaterial({ color: pc, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }), 0, 0, 0, g);
  const rim = mesh(new THREE.TorusGeometry(0.345, 0.0045, 8, 96), M.std(rc, 0.4), 0, 0.05, 0, g); rim.rotation.x = Math.PI / 2;
  m.userData.vessel = rim.userData.vessel = true;
  return m;
}
function bowl(g, i, surface, rad = 0.235, y = 0.17) {
  plate(g, i);
  mesh(lathe([[0, 0], [0.13, 0], [0.15, 0.01], [0.24, 0.1], [0.27, 0.17], [0.262, 0.173], [0.235, 0.115], [0.16, 0.035], [0, 0.035]]),
    new THREE.MeshPhysicalMaterial({ color: 0xf7f2e8, roughness: 0.18, clearcoat: 1, side: THREE.DoubleSide }), 0, 0.012, 0, g);
  // Superficie del líquido con un leve remolino
  const s = new THREE.CircleGeometry(rad, 64, 0, TAU); s.rotateX(-Math.PI / 2);
  const p = s.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k); p.setY(k, (fbm(x * 14, z * 14, 2) - 0.5) * 0.006); }
  s.computeVertexNormals();
  mesh(s, M.sauce(surface), 0, y, 0, g);
  return y;
}

// ---------- Platos ----------
const B = {};

// Tortilla de patatas (o bizcocho): con una cuña cortada que enseña el interior
function wedgeCake(g, i, o) {
  plate(g, i);
  const prof = [[0, 0], [0.12, 0], [0.19, 0.002], [0.212, 0.014], [0.221, o.h * 0.5], [0.213, o.h * 0.83], [0.19, o.h], [0.15, o.h * 1.04], [0.1, o.h * 1.06], [0.05, o.h * 1.07], [0, o.h * 1.07]];
  const gap = 0.95;
  const crust = toast(o.top, o.dark, o.burnt, 26, 0.7);
  const body = (a, b) => paint(lathe(prof, 72, a, b), (x, y, z, c) => { crust(x, y, z, c); if (y < o.h * 0.4) c.lerp(new THREE.Color(o.side), 0.5); });
  const inside = (() => {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 96; const k = cv.getContext("2d");
    k.fillStyle = o.crumb; k.fillRect(0, 0, 256, 96);
    for (let n = 0; n < 70; n++) { k.fillStyle = pick(o.bits); k.globalAlpha = r(0.5, 0.95); k.beginPath(); k.ellipse(r(0, 256), r(10, 86), r(8, 26), r(2.5, 6), r(-0.2, 0.2), 0, TAU); k.fill(); }
    k.globalAlpha = 1; k.fillStyle = o.edge; k.fillRect(0, 0, 256, 7); k.fillRect(0, 89, 256, 7);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 0.222, 1 / (o.h * 1.07)); return t;
  })();
  const cutMat = M.std(0xffffff, 0.75, { map: inside, side: THREE.DoubleSide });
  const shape = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)));
  const cut = (parent, phi) => { const m = mesh(new THREE.ShapeGeometry(shape), cutMat, 0, 0, 0, parent); m.rotation.y = phi - Math.PI / 2; };
  const main = new THREE.Group(); main.position.y = 0.012; g.add(main);
  mesh(body(gap / 2, TAU - gap), M.painted(o.rough ?? 0.55), 0, 0, 0, main);
  cut(main, gap / 2); cut(main, TAU - gap / 2);
  const slice = new THREE.Group(); slice.position.set(0.02, 0.012, 0.075); slice.rotation.y = 0.12; g.add(slice);
  mesh(body(-gap / 2 + 0.06, gap - 0.12), M.painted(o.rough ?? 0.55), 0, 0, 0, slice);
  cut(slice, -gap / 2 + 0.06); cut(slice, gap / 2 - 0.06);
  if (o.garnish) o.garnish(main);
  return o.h + 0.03;
}
B.tortilla = (g, i) => wedgeCake(g, i, { h: 0.066, top: 0xebbb57, dark: 0xb9741f, burnt: 0x6e3c12, side: 0xe7b24e, crumb: "#f1cd63", edge: "#c98a35", bits: ["#f7e3a3", "#f5dc8e", "#efe0b5", "#e9c45a"],
  garnish: (m) => herbs(m, 10, 0.06, 0.072, [0x2f7d32, 0x3e9142], 0.014) });
B.cake = (g, i) => wedgeCake(g, i, { h: 0.09, top: 0x9a5a2a, dark: 0x6e3a17, burnt: 0x4a240c, side: 0xa8672f, crumb: "#f2d79a", edge: "#9a5a2a", bits: ["#f7e6b8", "#e9c98a", "#d9b679"], rough: 0.7,
  garnish: (m) => instances(m, new THREE.SphereGeometry(0.0035, 6, 4), M.std(0xffffff, 0.9), 220, null, (o) => { const [x, z] = disc(0.2); o.position.set(x, 0.098, z); }) });

B.pizza = (g, i, look) => {
  plate(g, i);
  const y0 = 0.012;
  mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.012, 64), M.std(0xe8c38a, 0.8), 0, y0 + 0.006, 0, g);
  const crust = paint(lumpy(new THREE.TorusGeometry(0.245, 0.024, 14, 80), 0.12, 30), toast(0xe9be78, 0xb87632, 0x5e3112, 34, 0.9));
  const c = mesh(crust, M.painted(0.7), 0, y0 + 0.018, 0, g); c.rotation.x = Math.PI / 2; c.scale.set(1, 1, 0.75);
  mesh(new THREE.CircleGeometry(0.228, 64).rotateX(-Math.PI / 2), M.sauce(0xb8301c), 0, y0 + 0.0125, 0, g);
  // Queso fundido con zonas doradas
  const cheese = lathe([[0.215, 0], [0.2, 0.004], [0.16, 0.006], [0.12, 0.007], [0.08, 0.007], [0.04, 0.007], [0, 0.007]], 72);
  const p = cheese.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k); p.setY(k, p.getY(k) + (fbm(x * 18, z * 18, 4) - 0.45) * 0.012); }
  cheese.computeVertexNormals();
  paint(cheese, (x, y, z, col) => { const n = fbm(x * 22 + 3, 1, z * 22); col.setHex(0xf7dc8a).lerp(new THREE.Color(0xd99a3e), THREE.MathUtils.smoothstep(n, 0.55, 0.75)); if (fbm(x * 9, 5, z * 9) < 0.33) col.lerp(new THREE.Color(0xc0381f), 0.75); });
  mesh(cheese, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.6 }), 0, y0 + 0.013, 0, g);
  const pep = /jam[oó]n|chorizo|pepperoni|salami|carne|bacon|beicon/.test(look.text);
  if (pep) instances(g, paint(new THREE.CylinderGeometry(0.028, 0.028, 0.005, 24), (x, y, z, col) => col.setHex(0xb02c22).lerp(new THREE.Color(0x6e1610), THREE.MathUtils.smoothstep(Math.hypot(x, z), 0.02, 0.028))), M.gloss(0xffffff, { vertexColors: true }), 9, null, (o) => { const [x, z] = disc(0.17); o.position.set(x, y0 + 0.024, z); o.rotation.set(r(-0.1, 0.1), 0, r(-0.1, 0.1)); });
  else { chunks(g, 14, 0.17, y0 + 0.024, look.accents.length ? look.accents : [0x6cb043, 0xc63b25], 0.018, true); }
  instances(g, leafGeo(0.045, 0.02, 0.35), M.gloss(0x2e7d32, { side: THREE.DoubleSide }), 5, [0x2e7d32, 0x3a8f3a], (o) => { const [x, z] = disc(0.15); o.position.set(x, y0 + 0.03, z); o.rotation.set(0, r(0, TAU), 0); });
  return 0.05;
};

B.burger = (g, i) => {
  plate(g, i);
  const h = new THREE.Group(); h.position.set(-0.05, 0.012, 0); g.add(h);
  const bun = toast(0xd99a45, 0xa8611f, 0x5c3010, 20, 0.6);
  mesh(paint(lathe([[0, 0], [0.12, 0], [0.135, 0.012], [0.137, 0.03], [0, 0.032]], 48), bun), M.painted(0.6), 0, 0, 0, h);
  const patty = paint(lumpy(new THREE.CylinderGeometry(0.142, 0.14, 0.042, 48, 3), 0.06, 30), toast(0x6b3b22, 0x4a2414, 0x24100a, 40, 0.8));
  mesh(patty, M.painted(0.5), 0, 0.054, 0, h);
  const ch = new THREE.PlaneGeometry(0.25, 0.25, 12, 12); ch.rotateX(-Math.PI / 2);
  const cp = ch.attributes.position;
  for (let k = 0; k < cp.count; k++) { const x = cp.getX(k), z = cp.getZ(k), d = Math.max(0, Math.hypot(x, z) - 0.12); cp.setY(k, -d * d * 6 - d * 0.5); }
  ch.computeVertexNormals();
  mesh(ch, new THREE.MeshPhysicalMaterial({ color: 0xf4b03a, roughness: 0.35, clearcoat: 0.5, side: THREE.DoubleSide }), 0, 0.077, 0, h).rotation.y = 0.5;
  const tom = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 32), M.gloss(0xd0291c), 0.01, 0.087, 0.005, h);
  void tom;
  instances(h, leafGeo(0.11, 0.05, 0.25, 0.01), M.std(0xffffff, 0.45, { side: THREE.DoubleSide }), 8, [0x7cc243, 0x92d057, 0x5fa83a], (o, k) => {
    const a = (k / 8) * TAU; o.position.set(Math.cos(a) * 0.085, 0.096, Math.sin(a) * 0.085); o.rotation.set(0, -a, -0.35);
  });
  const top = paint(lathe([[0, 0], [0.138, 0], [0.142, 0.02], [0.13, 0.055], [0.1, 0.08], [0.06, 0.092], [0, 0.096]], 48), toast(0xd38b36, 0xa75c1c, 0x6a3510, 18, 0.5));
  mesh(top, M.painted(0.45, { clearcoat: 0.3 }), 0, 0.1, 0, h);
  instances(h, new THREE.SphereGeometry(0.004, 8, 6), M.std(0xf6ecd0, 0.5), 40, null, (o) => {
    const a = r(0, TAU), d = r(0, 0.11), yy = 0.1 + 0.096 * Math.sqrt(Math.max(0, 1 - (d / 0.14) ** 2)); o.position.set(Math.cos(a) * d, yy, Math.sin(a) * d); o.scale.set(1, 0.6, 1.8); o.rotation.set(0, r(0, 3), 0);
  });
  const fry = paint(new THREE.BoxGeometry(0.013, 0.013, 0.1, 1, 1, 6), toast(0xf2c55c, 0xd99a35, 0x9a5a1c, 30, 0.5));
  instances(g, fry, M.painted(0.6), 16, null, (o) => { o.position.set(0.2 + r(-0.04, 0.04), 0.025 + r(0, 0.03), r(-0.1, 0.1)); o.rotation.set(r(-0.2, 0.2), r(-0.9, 0.9), r(-0.3, 0.3)); });
  return 0.22;
};

B.toast = (g, i, look) => {
  plate(g, i);
  const slice = paint(new THREE.BoxGeometry(0.2, 0.026, 0.16, 12, 2, 10), (x, y, z, c) => {
    const edge = Math.min(0.1 - Math.abs(x), 0.08 - Math.abs(z));
    toast(0xf1d9a3, 0xc98d42, 0x6e3c15, 40, 0.7)(x, y, z, c);
    if (edge < 0.013) c.lerp(new THREE.Color(0x8a4f1e), 0.85);
  });
  const t = look.text;
  [[-0.07, 0.03, 0.25], [0.08, -0.03, -0.3]].forEach(([x, z, ry]) => {
    const s = new THREE.Group(); s.position.set(x, 0.026, z); s.rotation.y = ry; g.add(s);
    mesh(slice, M.painted(0.75), 0, 0, 0, s);
    if (/aguacate/.test(t)) { const a = lumpy(new THREE.BoxGeometry(0.17, 0.016, 0.13, 8, 2, 8), 0.12, 25); mesh(a, M.gloss(0x9cc552), 0, 0.019, 0, s); }
    else { const a = lumpy(new THREE.BoxGeometry(0.17, 0.012, 0.13, 8, 2, 8), 0.15, 25); mesh(a, M.sauce(0xc2321d), 0, 0.017, 0, s); }
    if (/jam[oó]n|serrano/.test(t)) ham(s, 3, 0.05, 0.03);
    if (/queso/.test(t)) shavings(s, 6, 0.06, 0.03);
    if (/huevo/.test(t)) { mesh(new THREE.SphereGeometry(0.03, 20, 12), M.sauce(0xf5a21f), 0, 0.03, 0, s).scale.set(1, 0.5, 1); }
    oil(s, 4, 0.06, 0.0245);
    herbs(s, 4, 0.05, 0.027, undefined, 0.016);
  });
  pepper(g, 25, 0.2, 0.05);
  return 0.07;
};

B.pancakes = (g, i) => {
  plate(g, i);
  const one = paint(lathe([[0, 0], [0.13, 0], [0.142, 0.006], [0.145, 0.014], [0.14, 0.021], [0, 0.023]], 48), (x, y, z, c) => {
    c.setHex(0xf1c98a); if (y > 0.018 || y < 0.003) toast(0xcf8a3c, 0xa45f22, 0x6b3814, 22, 0.6)(x, y, z, c);
  });
  for (let k = 0; k < 4; k++) mesh(one, M.painted(0.6), r(-0.006, 0.006), 0.012 + k * 0.022, r(-0.006, 0.006), g).rotation.y = r(0, 3);
  const top = 0.012 + 4 * 0.022;
  const syrup = lathe([[0.135, -0.004], [0.13, 0.002], [0.08, 0.004], [0, 0.005]], 48);
  mesh(syrup, M.sauce(0x9a4d0e), 0, top, 0, g);
  instances(g, new THREE.CylinderGeometry(0.008, 0.005, 1, 8), M.sauce(0x9a4d0e), 6, null, (o) => { const a = r(0, TAU), len = r(0.02, 0.06); o.position.set(Math.cos(a) * 0.141, top - len / 2, Math.sin(a) * 0.141); o.scale.set(1, len, 1); });
  mesh(new THREE.BoxGeometry(0.04, 0.025, 0.035), M.gloss(0xf8e39a), 0, top + 0.015, 0, g).rotation.y = 0.4;
  instances(g, new THREE.SphereGeometry(0.011, 12, 8), M.gloss(0xffffff), 9, [0xb71c3a, 0x3b3f8f, 0xb71c3a], (o) => { const [x, z] = disc(0.07, 0.035); o.position.set(x, top + 0.01, z); });
  return top + 0.03;
};

// Espaguetis en nido con salsa encima
B.spaghetti = (g, i, look) => {
  plate(g, i);
  const geos = [];
  for (let s = 0; s < 120; s++) {
    const pts = []; let a = r(0, TAU); const rr = r(0.17, 0.25), turns = r(0.8, 1.6), n = 14;
    for (let k = 0; k <= n; k++) {
      const t = k / n, rad = rr * (1 - t * 0.85) + r(-0.008, 0.008); a += (turns * TAU) / n;
      pts.push(new THREE.Vector3(Math.cos(a) * rad, 0.02 + Math.max(0, 1 - rad / 0.25) * 0.12 + r(0, 0.018), Math.sin(a) * rad));
    }
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.0064, 5));
  }
  mesh(mergeGeometries(geos), new THREE.MeshPhysicalMaterial({ color: 0xf0cf74, roughness: 0.32, clearcoat: 0.4, sheen: 0.4 }), 0, 0.006, 0, g);
  const t = look.text, creamy = /carbonara|nata|queso|alfredo|crema/.test(t) && !/tomate/.test(t);
  if (creamy) {
    mesh(lumpy(new THREE.SphereGeometry(0.075, 32, 16), 0.12), M.sauce(0xf3e1a6), 0, 0.085, 0, g).scale.set(1, 0.35, 1);
    chunks(g, 10, 0.09, 0.1, [0xb8564f, 0xc96a5c], 0.016, true);
    pepper(g, 90, 0.13, 0.095);
  } else {
    mesh(lumpy(new THREE.SphereGeometry(0.11, 32, 16), 0.2), M.sauce(/pesto/.test(t) ? 0x4e8a2a : 0xb32a17), 0, 0.105, 0, g).scale.set(1, 0.4, 1);
    chunks(g, 10, 0.08, 0.12, [0xc8341f, 0xd94a2a], 0.014, true);
    if (/bolo|carne/.test(t)) chunks(g, 18, 0.07, 0.1, [0x6e3a22, 0x5a2e1a], 0.014);
  }
  shavings(g, 12, 0.09, 0.13);
  instances(g, leafGeo(0.05, 0.022, 0.35), M.gloss(0x2e7d32, { side: THREE.DoubleSide }), 2, [0x2e7d32], (o, k) => { o.position.set(0.02 - k * 0.03, 0.15, 0.01 * k); o.rotation.set(0.2, k * 2.2, 0.15); });
  return 0.13;
};

B.shortPasta = (g, i, look) => {
  plate(g, i);
  const red = !/carbonara|nata|queso|pesto/.test(look.text) || /tomate/.test(look.text);
  const sauce = /pesto/.test(look.text) ? 0x4e8a2a : red ? 0xb32a17 : 0xf3e1a6;
  mesh(lumpy(new THREE.SphereGeometry(0.2, 40, 16), 0.06), M.sauce(sauce), 0, 0.02, 0, g).scale.set(1, 0.18, 1);
  const tube = new THREE.CylinderGeometry(0.014, 0.014, 0.065, 14, 1, true); tube.rotateZ(Math.PI / 2);
  instances(g, tube, new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.5, side: THREE.DoubleSide }), 85, [0xf0cf74, 0xf0cf74, red ? 0xd0562e : 0xf6e4a8], (o) => {
    const [x, z] = disc(0.17); const d = Math.hypot(x, z); o.position.set(x, 0.035 + (0.17 - d) * 0.45 + r(0, 0.02), z); o.rotation.set(r(0, 3), r(0, 3), r(0, 3));
  });
  if (/bolo|carne|chorizo|at[uú]n/.test(look.text)) chunks(g, 16, 0.13, 0.08, [0x6e3a22, 0x8a4a2a], 0.014);
  shavings(g, 10, 0.12, 0.11);
  herbs(g, 6, 0.08, 0.11, [0x2e7d32], 0.03);
  return 0.13;
};

B.lasagna = (g, i) => {
  plate(g, i);
  const w = 0.24, d = 0.17, layers = [[0xf1d27e, 0.006], [0xa8341f, 0.014], [0xf4ead0, 0.008], [0xf1d27e, 0.006], [0xa8341f, 0.014], [0xf4ead0, 0.008], [0xf1d27e, 0.006]];
  let y = 0.012; const blk = new THREE.Group(); blk.rotation.y = 0.35; g.add(blk);
  for (const [c, h] of layers) { mesh(lumpy(new THREE.BoxGeometry(w, h, d, 10, 1, 8), 0.025, 30), c === 0xa8341f ? M.sauce(c) : M.std(c, 0.5), 0, y + h / 2, 0, blk); y += h; }
  const top = paint(lumpy(new THREE.BoxGeometry(w + 0.006, 0.014, d + 0.006, 16, 2, 12), 0.05, 30), toast(0xf2cf6f, 0xc6812f, 0x6a3610, 30, 0.8));
  mesh(top, M.painted(0.4, { clearcoat: 0.4 }), 0, y + 0.007, 0, blk);
  mesh(lumpy(new THREE.SphereGeometry(0.16, 32, 12), 0.1), M.sauce(0xa8341f), 0.04, 0.008, 0.06, g).scale.set(1, 0.05, 0.7);
  herbs(g, 5, 0.06, y + 0.02, [0x2e7d32], 0.03);
  return y + 0.03;
};

// Arroz: paella en paellera o montoncito de arroz salteado
function grains(parent, n, rad, y0, height, colors, dome = true) {
  instances(parent, new THREE.SphereGeometry(0.0046, 7, 5), M.std(0xffffff, 0.42), n, colors, (o) => {
    const [x, z] = disc(rad); const d = Math.hypot(x, z);
    o.position.set(x, y0 + (dome ? (1 - (d / rad) ** 2) * height : 0) + r(0, 0.008), z); o.scale.set(1, 0.75, 2.2); o.rotation.set(r(-0.4, 0.4), r(0, TAU), r(-0.4, 0.4));
  });
}
B.paella = (g, i, look) => {
  const pan = new THREE.MeshStandardMaterial({ color: 0x2f3133, metalness: 0.7, roughness: 0.38 });
  mesh(lathe([[0, 0], [0.31, 0], [0.335, 0.008], [0.35, 0.04], [0.355, 0.042], [0.345, 0.04], [0.33, 0.012], [0.3, 0.006], [0, 0.006]]), new THREE.MeshStandardMaterial({ color: 0x3a3c3e, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }), 0, 0, 0, g);
  for (const s of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 20, Math.PI), pan, s * 0.375, 0.035, 0, g); h.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); }
  grains(g, 2200, 0.31, 0.012, 0.004, [0xf2b83c, 0xf6c855, 0xe9a52e, 0xdc9426], false);
  instances(g, new THREE.SphereGeometry(0.007, 6, 4), M.std(0x7a3d14, 0.7), 140, [0x7a3d14, 0x5e2e0e], (o) => { const [x, z] = disc(0.31, 0.27); o.position.set(x, 0.016, z); o.scale.set(1, 0.6, 2); o.rotation.y = r(0, 3); });
  const seafood = /marisco|paella|gamba|langostino/.test(look.text) && !/pollo|verdura/.test(look.text);
  if (seafood) for (let k = 0; k < 5; k++) {
    const sh = new THREE.Group(), a = (k / 5) * TAU + 0.3;
    for (let s = 0; s < 9; s++) { const t = s / 8, ang = t * Math.PI * 1.15; mesh(new THREE.SphereGeometry(0.016 * (1 - t * 0.55), 12, 8), M.gloss(s % 2 ? 0xf2a07a : 0xe8603a), Math.cos(ang) * 0.035, 0.012, Math.sin(ang) * 0.035, sh); }
    sh.position.set(Math.cos(a) * 0.19, 0.022, Math.sin(a) * 0.19); sh.rotation.y = -a + 1.2; g.add(sh);
  } else chunks(g, 12, 0.24, 0.03, [0xd9a56b, 0xc98e5e], 0.03);
  strips(g, 9, 0.25, 0.026, [0xc0261b]);
  peas(g, 26, 0.26, 0.022);
  lemon(g, 0.08, 0.05, 0.3); lemon(g, -0.1, -0.08, 2.4);
  herbs(g, 14, 0.25, 0.025);
  return 0.05;
};
B.rice = (g, i, look) => {
  plate(g, i);
  const t = look.text, yellow = /curry|azafr|amarillo|paella/.test(t), creamy = /risotto|cremoso/.test(t);
  if (creamy) mesh(lumpy(new THREE.SphereGeometry(0.2, 32, 12), 0.05), M.sauce(0xf3e6c2), 0, 0.02, 0, g).scale.set(1, 0.18, 1);
  grains(g, 900, 0.19, 0.016, 0.09, yellow ? [0xf0c24a, 0xe6b43c] : [0xfaf5e8, 0xf3ecd9, 0xfffbf2]);
  const acc = look.accents.filter((c) => c !== 0xf1e1b4);
  if (/huevo/.test(t)) chunks(g, 10, 0.13, 0.08, [0xf6d046, 0xfaf3d8], 0.02);
  if (acc.length) chunks(g, 14, 0.15, 0.06, acc, 0.016, true);
  peas(g, 18, 0.15, 0.07);
  strips(g, 6, 0.13, 0.08, [0xc0261b, 0x6aa84f]);
  instances(g, new THREE.TorusGeometry(0.008, 0.0025, 6, 12), M.std(0x5fae45, 0.5), 14, [0x5fae45, 0x8bc86a], (o) => { const [x, z] = disc(0.1); o.position.set(x, 0.11, z); o.rotation.set(Math.PI / 2 + r(-0.4, 0.4), 0, 0); });
  if (creamy) shavings(g, 8, 0.1, 0.1);
  return 0.12;
};

// Ensalada con hojas rizadas, tomatitos partidos y aderezo
B.salad = (g, i, look) => {
  plate(g, i);
  const leaves = leafGeo(0.13, 0.055, 0.6, 0.008);
  instances(g, leaves, M.std(0xffffff, 0.42, { side: THREE.DoubleSide }), 60, [0x5ca83a, 0x7cc24e, 0x3f8f2c, 0x9fd36a, 0x5ca83a, 0x7cc24e, 0x7a2a48], (o) => {
    const [x, z] = disc(0.22); const d = Math.hypot(x, z); o.position.set(x, 0.03 + (0.22 - d) * 0.45 + r(0, 0.025), z); o.rotation.set(r(-0.6, 0.6), r(0, TAU), r(-0.5, 0.5));
  });
  cherryHalves(g, 8, 0.15, 0.13);
  const t = look.text;
  if (/pepino/.test(t) || R() > 0.5) instances(g, paint(new THREE.CylinderGeometry(0.022, 0.022, 0.005, 20), (x, y, z, c) => c.setHex(Math.hypot(x, z) > 0.019 ? 0x2f6b2a : 0xdcefb7)), M.gloss(0xffffff, { vertexColors: true }), 6, null, (o) => { const [x, z] = disc(0.15); o.position.set(x, 0.125, z); o.rotation.set(r(-0.6, 0.6), 0, r(-0.6, 0.6)); });
  if (/queso|feta|mozzarella/.test(t)) chunks(g, 12, 0.14, 0.125, [0xfbf7ec], 0.018);
  if (/at[uú]n/.test(t)) chunks(g, 8, 0.1, 0.08, [0xd9b59a, 0xc9a284], 0.02);
  if (/huevo/.test(t)) for (let k = 0; k < 2; k++) { const e = new THREE.Group(); mesh(new THREE.SphereGeometry(0.026, 20, 12, 0, TAU, 0, Math.PI / 2), M.std(0xfbfaf4, 0.35), 0, 0, 0, e); const y = mesh(new THREE.CircleGeometry(0.013, 16), M.std(0xf2b52a, 0.6), 0, 0.001, 0, e); y.rotation.x = -Math.PI / 2; e.rotation.x = Math.PI + 0.3; e.position.set(-0.05 + k * 0.1, 0.085, -0.04 + k * 0.05); g.add(e); }
  instances(g, new THREE.SphereGeometry(0.011, 12, 8), M.gloss(0x1d1a17), 5, [0x1d1a17, 0x3a4a1e], (o) => { const [x, z] = disc(0.15); o.position.set(x, 0.125, z); o.scale.set(1, 1, 1.4); });
  instances(g, new THREE.TorusGeometry(0.02, 0.0035, 6, 20), M.gloss(0x9a3a7a), 4, null, (o) => { const [x, z] = disc(0.12); o.position.set(x, 0.13, z); o.rotation.set(Math.PI / 2 + r(-0.5, 0.5), r(-0.5, 0.5), 0); });
  croutons(g, 7, 0.13, 0.13);
  oil(g, 12, 0.15, 0.14, 0xe6d27a);
  pepper(g, 40, 0.15, 0.13);
  return 0.1;
};

// Crema o sopa fina: remolino de nata, picatostes y aceite
B.cream = (g, i, look) => {
  const t = look.text;
  const color = /calabaza|zanahoria|naranja/.test(t) ? 0xe9852a : /br[oó]coli|calabac|espinaca|guisante|puerro|verde/.test(t) ? 0x7fae46 : /gazpacho|tomate/.test(t) ? 0xd2482c : /salmorejo/.test(t) ? 0xe2754a : /champi|seta/.test(t) ? 0xb79b78 : /patata|vichy|coliflor/.test(t) ? 0xf1e4bf : look.base;
  const y = bowl(g, i, color);
  const pts = []; for (let k = 0; k <= 60; k++) { const a = k * 0.28, d = 0.015 + k * 0.0022; pts.push(new THREE.Vector3(Math.cos(a) * d, y + 0.002, Math.sin(a) * d)); }
  const sw = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.006, 6); sw.scale(1, 0.35, 1); sw.translate(0, y * 0.65, 0);
  if (!/gazpacho/.test(t)) mesh(sw, M.sauce(0xfbf4e6), 0, 0, 0, g);
  if (/salmorejo/.test(t)) { ham(g, 5, 0.12, y + 0.006); chunks(g, 8, 0.12, y + 0.006, [0xfbf9f2, 0xf2c032], 0.016); }
  else if (/gazpacho/.test(t)) chunks(g, 16, 0.15, y + 0.004, [0x6aa84f, 0xd83c2a, 0xf1e6c8, 0x2f6b2a], 0.013, true);
  else croutons(g, 6, 0.15, y + 0.008);
  instances(g, new THREE.SphereGeometry(0.008, 8, 6), M.std(0x5b7a3a, 0.5), 7, [0x5b7a3a, 0x6f8c45], (o) => { const [x, z] = disc(0.14); o.position.set(x, y + 0.003, z); o.scale.set(1.5, 0.4, 0.8); o.rotation.y = r(0, 3); });
  oil(g, 9, 0.17, y + 0.0015, 0x9cae2a);
  herbs(g, 6, 0.1, y + 0.004, undefined, 0.02);
  pepper(g, 30, 0.16, y + 0.002);
  return y + 0.02;
};
// Guiso de cuchara: legumbres y tropezones asomando del caldo
B.stew = (g, i, look) => {
  const t = look.text;
  const broth = /curry/.test(t) ? 0xd88a2a : /lenteja|chorizo|piment/.test(t) ? 0x8a3f1c : 0xa8682e;
  const y = bowl(g, i, broth, 0.235, 0.16);
  if (/lenteja/.test(t)) instances(g, new THREE.SphereGeometry(0.008, 8, 6), M.gloss(0x6b4a2c), 220, [0x6b4a2c, 0x7d5733, 0x5a3c22], (o) => { const [x, z] = disc(0.22); o.position.set(x, y + r(-0.004, 0.003), z); o.scale.set(1, 0.45, 1); o.rotation.set(r(-0.5, 0.5), 0, r(-0.5, 0.5)); });
  if (/garbanzo|cocido/.test(t)) instances(g, lumpy(new THREE.SphereGeometry(0.014, 14, 10), 0.12, 60), M.std(0xffffff, 0.55), 40, [0xe3c27e, 0xd8b06a], (o) => { const [x, z] = disc(0.21); o.position.set(x, y + r(-0.006, 0.004), z); });
  if (/alubia|fabada/.test(t)) instances(g, new THREE.SphereGeometry(0.013, 12, 8), M.gloss(0xf2ead6), 40, [0xf2ead6, 0x8a2f24], (o) => { const [x, z] = disc(0.21); o.position.set(x, y + r(-0.005, 0.003), z); o.scale.set(1.5, 0.7, 0.9); o.rotation.y = r(0, 3); });
  chunks(g, 9, 0.17, y, [0xef8a2c], 0.02, true);
  chunks(g, 7, 0.17, y, [0xf1e1b4, 0xe9d6a0], 0.026);
  if (/chorizo/.test(t) || /lenteja|garbanzo|alubia|cocido|fabada/.test(t)) instances(g, paint(new THREE.CylinderGeometry(0.02, 0.02, 0.008, 18), (x, yy, z, c) => c.setHex(0xa0261b).lerp(new THREE.Color(0xf1c6b0), fbm(x * 300, 1, z * 300) > 0.68 ? 0.8 : 0)), M.gloss(0xffffff, { vertexColors: true }), 6, null, (o) => { const [x, z] = disc(0.15); o.position.set(x, y + 0.004, z); o.rotation.set(r(-0.4, 0.4), 0, r(-0.4, 0.4)); });
  if (/pollo|carne|ternera|cerdo|estofado/.test(t)) chunks(g, 10, 0.16, y, [0x7a4528, 0x8f5530], 0.03);
  herbs(g, 10, 0.15, y + 0.005, [0x2f7d32, 0x3e9142], 0.016);
  return y + 0.02;
};

// Huevos: fritos sobre patatas (huevos rotos) o revuelto
function friedEgg(parent, x, z, y, s = 1) {
  const e = new THREE.Group(); e.position.set(x, y, z); e.scale.setScalar(s); parent.add(e);
  const pts = []; const n = 40;
  for (let k = 0; k < n; k++) { const a = (k / n) * TAU; const d = 0.085 * (0.8 + fbm(Math.cos(a) * 3 + x * 50, Math.sin(a) * 3, 1) * 0.45); pts.push(new THREE.Vector2(Math.cos(a) * d, Math.sin(a) * d)); }
  const white = new THREE.ShapeGeometry(new THREE.Shape(pts), 24); white.rotateX(-Math.PI / 2);
  const p = white.attributes.position;
  for (let k = 0; k < p.count; k++) { const d = Math.hypot(p.getX(k), p.getZ(k)); p.setY(k, Math.max(0, 0.012 - d * 0.1) + fbm(p.getX(k) * 40, 0, p.getZ(k) * 40) * 0.004); }
  white.computeVertexNormals();
  paint(white, (xx, yy, zz, c) => { const d = Math.hypot(xx, zz); c.setHex(0xffffff); if (d > 0.07) c.lerp(new THREE.Color(0xd9a25a), 0.65 * THREE.MathUtils.smoothstep(d + fbm(xx * 60, 0, zz * 60) * 0.02, 0.078, 0.1)); });
  mesh(white, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide }), 0, 0, 0, e);
  mesh(new THREE.SphereGeometry(0.03, 32, 16), new THREE.MeshPhysicalMaterial({ color: 0xf7a114, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0.5, sheenColor: new THREE.Color(0xffd27a) }), r(-0.01, 0.01), 0.012, r(-0.01, 0.01), e).scale.set(1, 0.55, 1);
}
function potatoes(parent, n, rad, y0, height) {
  const g = paint(lumpy(new THREE.BoxGeometry(0.05, 0.034, 0.04, 3, 3, 3), 0.15, 30), toast(0xf0c868, 0xd59a3a, 0x8a5418, 35, 0.6));
  instances(parent, g, M.painted(0.45, { clearcoat: 0.3 }), n, null, (o) => {
    const [x, z] = disc(rad); const d = Math.hypot(x, z); o.position.set(x, y0 + (1 - d / rad) * height + r(0, 0.015), z); o.rotation.set(r(0, 3), r(0, 3), r(0, 3)); o.scale.set(r(0.8, 1.3), r(0.8, 1.1), r(0.8, 1.5));
  });
}
B.eggs = (g, i, look) => {
  plate(g, i);
  const t = look.text;
  if (/revuelto|scrambl/.test(t)) {
    const blob = lumpy(new THREE.IcosahedronGeometry(0.022, 2), 0.3, 50);
    instances(g, blob, M.gloss(0xffffff), 60, [0xf6cf4c, 0xf3c33d, 0xf8db73, 0xfae7a0], (o) => { const [x, z] = disc(0.17); const d = Math.hypot(x, z); o.position.set(x, 0.025 + (0.17 - d) * 0.3 + r(0, 0.015), z); o.scale.set(r(0.8, 1.4), r(0.5, 0.8), r(0.8, 1.3)); o.rotation.y = r(0, 3); });
    const acc = look.accents.filter((c) => c !== 0xf2c14e);
    if (acc.length) chunks(g, 14, 0.14, 0.05, acc, 0.016, true);
    instances(g, new THREE.CylinderGeometry(0.0022, 0.0022, 0.03, 6), M.std(0x3f8f2c, 0.5), 30, [0x3f8f2c, 0x5aa83c], (o) => { const [x, z] = disc(0.14); o.position.set(x, 0.07, z); o.rotation.set(Math.PI / 2 + r(-0.3, 0.3), 0, r(0, 3)); });
    pepper(g, 40, 0.15, 0.065);
    return 0.09;
  }
  potatoes(g, 40, 0.23, 0.025, 0.035);
  if (/jam[oó]n|serrano/.test(t)) ham(g, 7, 0.17, 0.06);
  if (/chorizo/.test(t)) instances(g, new THREE.CylinderGeometry(0.02, 0.02, 0.008, 18), M.gloss(0xa0261b), 7, null, (o) => { const [x, z] = disc(0.16); o.position.set(x, 0.06, z); o.rotation.set(r(-0.5, 0.5), 0, r(-0.5, 0.5)); });
  friedEgg(g, -0.05, -0.03, 0.098, 1.15); friedEgg(g, 0.07, 0.06, 0.102, 1.05);
  instances(g, new THREE.SphereGeometry(0.0035, 6, 4), M.std(0xc23a1c, 0.6), 50, null, (o) => { const [x, z] = disc(0.12); o.position.set(x, 0.12, z); });
  return 0.13;
};
B.potatoes = (g, i, look) => {
  plate(g, i);
  potatoes(g, 55, 0.22, 0.02, 0.06);
  if (/brava/.test(look.text)) { drizzle(g, 0xc2321d, 7, 0.15, 0.1, 0.007); drizzle(g, 0xf6efdc, 6, 0.15, 0.106, 0.005); }
  else { strips(g, 10, 0.18, 0.06, [0x6aa84f, 0xc0261b]); instances(g, new THREE.TorusGeometry(0.025, 0.004, 6, 20, Math.PI), M.std(0xf2e6c8, 0.4, { transparent: true, opacity: 0.85 }), 10, null, (o) => { const [x, z] = disc(0.17); o.position.set(x, 0.07, z); o.rotation.set(r(0, 3), r(0, 3), 0); }); }
  herbs(g, 10, 0.15, 0.09);
  return 0.12;
};

// Pescado: lomo con la parte de arriba marcada
B.fish = (g, i, look) => {
  plate(g, i);
  const salmon = /salm[oó]n|trucha/.test(look.text);
  const f = new THREE.BoxGeometry(0.3, 0.06, 0.135, 24, 3, 10), p = f.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), y = p.getY(k); const taper = 1 - Math.abs(x) * 1.6; p.setXYZ(k, x, y * (0.6 + 0.4 * taper) + Math.cos(x * 6) * 0.005, z * (0.75 + 0.25 * taper)); }
  f.computeVertexNormals();
  paint(f, (x, y, z, c) => {
    if (salmon) { c.setHex(0xf08a5a).lerp(new THREE.Color(0xfbe1cf), THREE.MathUtils.smoothstep(Math.sin(x * 120 + z * 20), 0.8, 0.98)); }
    else c.setHex(0xf7f2ea);
    if (y > 0.016) toast(salmon ? 0xe0743f : 0xf2dcb0, 0xc07a35, 0x6e3a14, 40, 0.6)(x, y, z, c);
  });
  mesh(f, M.painted(0.4, { clearcoat: 0.6 }), -0.03, 0.05, -0.03, g).rotation.y = 0.35;
  instances(g, new THREE.CylinderGeometry(0.009, 0.01, 0.2, 10), M.gloss(0x5f9a3a), 7, [0x5f9a3a, 0x6fae45], (o, k) => { o.position.set(0.05 + k * 0.004, 0.024 + (k % 2) * 0.012, 0.12 + k * 0.019); o.rotation.set(0, 0.3 + r(-0.06, 0.06), Math.PI / 2); });
  lemon(g, -0.2, 0.1, 0.8);
  herbs(g, 8, 0.08, 0.075, [0x2f7d32], 0.018);
  oil(g, 10, 0.24, 0.016);
  pepper(g, 30, 0.1, 0.07);
  return 0.09;
};

B.meatballs = (g, i) => {
  plate(g, i);
  mesh(lumpy(new THREE.SphereGeometry(0.21, 40, 16), 0.06), M.sauce(0xa8301b), 0, 0.016, 0, g).scale.set(1, 0.12, 1);
  const ball = paint(lumpy(new THREE.SphereGeometry(0.042, 24, 16), 0.12, 30), toast(0x7a4528, 0x5a2e18, 0x2e160a, 30, 0.7));
  const pos = [[0, 0], [0.09, 0.03], [-0.08, 0.06], [0.03, -0.1], [-0.08, -0.06], [0.1, -0.07], [-0.01, 0.11]];
  instances(g, ball, M.painted(0.45, { clearcoat: 0.6 }), pos.length, null, (o, k) => { o.position.set(pos[k][0], 0.05, pos[k][1]); o.rotation.set(r(0, 3), r(0, 3), 0); });
  chunks(g, 12, 0.18, 0.04, [0xb8341d, 0xc94a2a], 0.016, true);
  herbs(g, 14, 0.15, 0.09);
  shavings(g, 6, 0.12, 0.09);
  return 0.1;
};

// Salteado / plato de carne o pollo (por defecto)
B.saute = (g, i, look) => {
  plate(g, i);
  const t = look.text;
  const meat = /ternera|carne|cerdo|lomo|filete/.test(t) ? [0x6e3a22, 0x7d4529] : /pollo|pavo/.test(t) ? [0xd9a05e, 0xc98a48] : /tofu/.test(t) ? [0xf1e3c2] : /setas|champi/.test(t) ? [0x9a7a58, 0x8a6a48] : null;
  if (meat) {
    const piece = paint(lumpy(new THREE.BoxGeometry(0.065, 0.035, 0.05, 3, 3, 3), 0.18, 30), toast(meat[0], 0x6a3412, 0x2e1608, 30, 0.6));
    instances(g, piece, M.painted(0.35, { clearcoat: 0.7, clearcoatRoughness: 0.1 }), 18, null, (o) => { const [x, z] = disc(0.19); const d = Math.hypot(x, z); o.position.set(x, 0.03 + (0.17 - d) * 0.25 + r(0, 0.02), z); o.rotation.set(r(0, 3), r(0, 3), r(0, 3)); o.scale.setScalar(r(0.8, 1.2)); });
  } else potatoes(g, 30, 0.19, 0.02, 0.04);
  const acc = look.accents.filter((c) => !meat || !meat.includes(c));
  strips(g, 16, 0.18, 0.05, acc.length ? acc.slice(0, 3) : [0xc0261b, 0x6aa84f, 0xf2c14e]);
  if (/br[oó]coli/.test(t) || R() > 0.5) for (let k = 0; k < 6; k++) {
    const fl = new THREE.Group(); const [x, z] = disc(0.15);
    mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.03, 8), M.std(0x9cc46a, 0.5), 0, 0.015, 0, fl);
    instances(fl, new THREE.IcosahedronGeometry(0.013, 1), M.std(0xffffff, 0.6), 16, [0x2f6b22, 0x3d7d2a], (o) => { const [a, b] = disc(0.016); o.position.set(a, 0.032 + r(0, 0.008), b); });
    fl.position.set(x, 0.04, z); fl.rotation.set(r(-0.6, 0.6), 0, r(-0.6, 0.6)); g.add(fl);
  }
  drizzle(g, 0x5a2a10, 6, 0.14, 0.085, 0.005);
  instances(g, new THREE.SphereGeometry(0.003, 6, 4), M.std(0xf6ecd0, 0.5), 50, null, (o) => { const [x, z] = disc(0.15); o.position.set(x, 0.085, z); o.scale.set(1, 0.6, 1.8); });
  instances(g, new THREE.TorusGeometry(0.008, 0.0025, 6, 12), M.std(0x5fae45, 0.5), 14, [0x5fae45, 0x8bc86a], (o) => { const [x, z] = disc(0.12); o.position.set(x, 0.09, z); o.rotation.set(Math.PI / 2 + r(-0.4, 0.4), 0, 0); });
  return 0.11;
};

// Postre en cuenco: yogur, natillas o fruta
B.dessert = (g, i, look) => {
  const t = look.text;
  if (/flan/.test(t)) {
    plate(g, i);
    mesh(lathe([[0, 0], [0.11, 0], [0.105, 0.02], [0.085, 0.07], [0, 0.072]], 48), new THREE.MeshPhysicalMaterial({ color: 0xf2c35a, roughness: 0.25, clearcoat: 1 }), 0, 0.012, 0, g);
    mesh(lathe([[0.0855, 0.068], [0.08, 0.075], [0, 0.077]], 48), M.sauce(0x7a3a0a), 0, 0.012, 0, g);
    mesh(new THREE.CircleGeometry(0.17, 48).rotateX(-Math.PI / 2), M.sauce(0x8a440e), 0, 0.0135, 0, g);
    return 0.1;
  }
  const y = bowl(g, i, /natilla|crema catalana/.test(t) ? 0xf3d27a : /chocolate|cacao/.test(t) ? 0x5a3420 : 0xe9e1d2, 0.235, 0.165);
  if (/natilla/.test(t)) { mesh(paint(new THREE.CylinderGeometry(0.045, 0.045, 0.008, 28), toast(0xd99a52, 0xb06e2a, 0x7a4518, 40, 0.5)), M.painted(0.7), 0, y + 0.006, 0, g); instances(g, new THREE.SphereGeometry(0.004, 5, 4), M.std(0x8a4a1c, 0.8), 80, null, (o) => { const [x, z] = disc(0.2); o.position.set(x, y + 0.001, z); o.scale.set(1, 0.3, 1); }); return y + 0.02; }
  instances(g, new THREE.ConeGeometry(0.018, 0.035, 14), M.gloss(0xc81d33), 5, [0xc81d33, 0xd42a3e], (o) => { const [x, z] = disc(0.15); o.position.set(x, y + 0.01, z); o.rotation.set(Math.PI / 2 + r(-0.6, 0.6), 0, r(0, 3)); });
  instances(g, new THREE.CylinderGeometry(0.02, 0.02, 0.008, 20), M.std(0xf6e9b8, 0.5), 6, null, (o) => { const [x, z] = disc(0.16); o.position.set(x, y + 0.005, z); o.rotation.set(r(-0.4, 0.4), 0, r(-0.4, 0.4)); });
  instances(g, new THREE.SphereGeometry(0.01, 12, 8), M.gloss(0x2c2f6e), 10, [0x2c2f6e, 0x3a3f8a], (o) => { const [x, z] = disc(0.16); o.position.set(x, y + 0.008, z); });
  drizzle(g, 0xd99a1e, 7, 0.14, y + 0.012, 0.004);
  instances(g, leafGeo(0.035, 0.016, 0.3), M.gloss(0x3f9a3a, { side: THREE.DoubleSide }), 2, [0x3f9a3a], (o, k) => { o.position.set(-0.02 + k * 0.02, y + 0.02, 0.01); o.rotation.set(0.2, k * 2.4, 0.2); });
  return y + 0.03;
};

// ---------- Elección del plato ----------
const KINDS = [
  ["pizza", /pizza|coca de/], ["burger", /hamburguesa|burger/], ["pancakes", /tortita|pancake|crep/],
  ["tortilla", /tortilla(?! de trigo| francesa)|frittata/], ["cake", /bizcocho|tarta|magdalena|brownie/],
  ["toast", /tosta|tostada|bocadillo|s[aá]ndwich|torrija|pan con|bruschetta|montadito/],
  ["lasagna", /lasa[ñn]a|canelon/], ["spaghetti", /espagueti|spaghetti|tallarin|fideo|linguin|carbonara|tagliatelle/],
  ["shortPasta", /pasta|macarr|penne|fusilli|[ñn]oqui|tortellini|ravioli/],
  ["paella", /paella|arroz con marisco|arroz a banda|arroz con pollo/], ["rice", /arroz|risotto|cusc[uú]s|quinoa/],
  ["salad", /ensalada|poke|tabul|pipirrana|remoj[oó]n/],
  ["cream", /crema de|pur[eé]|vichyssoise|gazpacho|salmorejo|sopa/],
  ["stew", /lenteja|garbanzo|alubia|potaje|cocido|guiso|estofado|curry|caldo|fabada|marmitako/],
  ["eggs", /revuelto|huevos? (rotos|estrellados|fritos?|al plato)|huevos con/],
  ["potatoes", /patata|bravas|papas/], ["fish", /salm[oó]n|merluza|bacalao|pescado|dorada|lubina|at[uú]n a la|trucha|sardina/],
  ["meatballs", /alb[oó]ndiga/], ["dessert", /yogur|natilla|flan|postre|macedonia|fruta|batido|arroz con leche|mousse/],
];
const COLORS = [
  [/huevo|tortilla|revuelto/, 0xf2c14e], [/tomate|pizza|gazpacho|bolo[ñn]esa|fresa/, 0xd8432a], [/patata|pur[eé]/, 0xe9b65c],
  [/pimiento rojo|piment[oó]n|chorizo/, 0xc63b25], [/zanahoria|calabaza|naranja|curry/, 0xef8a2c],
  [/calabac|espinaca|br[oó]coli|guisante|jud[ií]a|acelga|pesto|lechuga|pepino|aguacate|pimiento verde|puerro/, 0x67a64a],
  [/queso|bechamel|nata|carbonara/, 0xf5dc8c], [/pollo|pavo/, 0xd39a5b], [/carne|ternera|cerdo|lomo|hamburguesa/, 0x7f4a2c],
  [/jam[oó]n|bacon|beicon/, 0xc0545a], [/champi|seta/, 0x9a7a58], [/ma[ií]z/, 0xf3cf45], [/cebolla/, 0xf1e6c8],
];
const COLD = /ensalada|gazpacho|salmorejo|batido|yogur|helado|tartar|carpaccio|fr[ií][oa]|poke|tabul|flan|natilla|macedonia|fruta|pipirrana/;

const FOOD_SCALE = { eggs: 1.3, toast: 1.35, pancakes: 1.45, lasagna: 1.35, potatoes: 1.2, meatballs: 1.2, shortPasta: 1.15, saute: 1.15, rice: 1.15, burger: 1.12 };

export function buildDish(recipe, i = 0) {
  const name = (recipe?.nombre || "").toLowerCase();
  const text = name + " " + (recipe?.usa || []).join(" ").toLowerCase();
  R = seeded(name + i);
  const kind = (KINDS.find(([, re]) => re.test(name)) || ["saute"])[0];
  const colors = [...new Set([...COLORS.filter(([re]) => re.test(name)), ...COLORS.filter(([re]) => re.test(text))].map(([, c]) => c))];
  const look = { text, base: colors[0] ?? 0xd9a55b, accents: colors.slice(1) };
  const group = new THREE.Group();
  let top = B[kind](group, i, look);
  // La comida algo más grande en los platos que se quedaban pequeños
  const k = FOOD_SCALE[kind];
  if (k) { for (const c of group.children) if (!c.userData.vessel) { c.position.multiplyScalar(k); c.scale.multiplyScalar(k); } top *= k; }
  R = Math.random;
  return { group, top, hot: !COLD.test(name), kind };
}
