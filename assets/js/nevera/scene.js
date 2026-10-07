// Escena 3D a pantalla completa de «¿Qué cocino con lo que tengo?» (Three.js).
// Una cocina de noche con una nevera retro que ocupa la pantalla:
//   intro()        las letras imán «¿QUÉ COCINO?» caen sobre la puerta
//   showPhoto(url) la puerta se abre, la cámara entra y escanea tu foto (que está pegada al fondo)
//   think()        la cámara sale, la puerta se cierra de golpe y la nevera zumba con vaho frío
//   stick(lista)   tus ingredientes caen sobre la puerta como imanes de palabras
//   serve(recetas) la puerta se abre y salen tres platos humeando; focus(i) pasa de uno a otro
//   reset()        vuelta al principio
// Todo es decorativo: la interfaz funciona igual sin WebGL. Con «reducir movimiento» no hay animaciones.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { buildDish } from "./food.js";

const W = 1.25, H = 2.05, D = 0.85, T = 0.05; // nevera (m)
const OPEN = -2.25; // puerta abierta (rad)
const FONT = '"Bricolage Grotesque", "Avenir Next", system-ui, sans-serif';
const MAGNETS = [0xffc23a, 0xff6b4a, 0xfaf7f0, 0x5b8cff, 0xe777d4, 0x58d19b];

const E = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  back: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
  expo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};
const rnd = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Texturas dibujadas en canvas ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const softTex = () => canvasTex(128, 128, (g) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.4, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
});
const ringTex = () => canvasTex(128, 128, (g) => {
  g.strokeStyle = "#fff"; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(64, 64, 9, 0, Math.PI * 2); g.fill();
});
const tileWall = () => {
  const t = canvasTex(512, 512, (g) => {
    g.fillStyle = "#081210"; g.fillRect(0, 0, 512, 512);
    const bw = 128, bh = 64;
    for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
      const ox = x * bw + (y % 2 ? bw / 2 : 0);
      const l = 15 + Math.random() * 4;
      const grad = g.createLinearGradient(0, y * bh, 0, y * bh + bh);
      grad.addColorStop(0, `hsl(160 30% ${l + 3}%)`); grad.addColorStop(1, `hsl(160 30% ${l - 2}%)`);
      g.fillStyle = grad; g.beginPath(); g.roundRect(ox + 3, y * bh + 3, bw - 6, bh - 6, 6); g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 5); return t;
};
const checkerFloor = () => {
  const t = canvasTex(256, 256, (g) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? "#26302c" : "#121a17"; g.fillRect(x * 128, y * 128, 128, 128); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 9); t.anisotropy = 8; return t;
};

export function createFridge(container, { adaptive = true } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x07100d);
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 7, 16);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 40);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.45, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Cocina ----------
  const FLOOR_Y = -H / 2 - 0.1;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ map: tileWall(), roughness: 0.42, metalness: 0 }));
  wall.position.set(0, FLOOR_Y + 4.5, -D / 2 - 0.35); wall.receiveShadow = true; scene.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: checkerFloor(), roughness: 0.28, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; scene.add(floor);
  // Encimera a la derecha (silueta) para dar contexto
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x1b2a25, roughness: 0.6 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 0.95, 0.75), counterMat);
  counter.position.set(W / 2 + 1.62, FLOOR_Y + 0.475, -0.05); counter.receiveShadow = true; counter.castShadow = true; scene.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.05, 0.8), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.3 }));
  top.position.set(counter.position.x, FLOOR_Y + 0.975, -0.03); top.receiveShadow = true; scene.add(top);

  // Luces: lámpara cálida arriba, contraluz frío, y la luz interior de la nevera
  const key = new THREE.SpotLight(0xffe2b8, 24, 12, 0.62, 0.6, 1.4);
  key.position.set(1.6, 3.3, 3.2); key.target.position.set(0, -0.2, 0.3);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.radius = 4;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x7fd8ff, 0.9); rim.position.set(-3, 2.5, -2); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xbfe9db, 0x0b1210, 0.35));

  // ---------- Nevera retro ----------
  const enamel = new THREE.MeshPhysicalMaterial({ color: 0x86d6b4, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.2 });
  const liner = new THREE.MeshStandardMaterial({ color: 0xf4f6f4, roughness: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, metalness: 1, roughness: 0.14 });
  const fridge = new THREE.Group(); scene.add(fridge);
  const add = (geo, mat, x, y, z, parent = fridge, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 4, r);
  add(rb(W, H, T, 0.02), enamel, 0, 0, -D / 2 + T / 2);
  add(rb(T, H, D, 0.02), enamel, -W / 2 + T / 2, 0, 0);
  add(rb(T, H, D, 0.02), enamel, W / 2 - T / 2, 0, 0);
  add(rb(W, T * 2, D, 0.03), enamel, 0, H / 2 - T, 0);
  add(rb(W, T * 3, D, 0.03), enamel, 0, -H / 2 + T * 1.5, 0);
  // Interior blanco
  const IW = W - 2 * T, IH = H - 5 * T, IY = -T / 2;
  add(new THREE.PlaneGeometry(IW, IH), liner, 0, IY, -D / 2 + T + 0.002, fridge, false);
  for (const s of [-1, 1]) { const p = add(new THREE.PlaneGeometry(D - T, IH), liner, s * (IW / 2 - 0.001), IY, 0.02, fridge, false); p.rotation.y = -s * Math.PI / 2; }
  // Zócalo cromado y patas
  add(rb(W - 0.1, 0.06, 0.02, 0.01), chrome, 0, -H / 2 + 0.05, D / 2 + 0.005, fridge, false);
  for (const x of [-W / 2 + 0.13, W / 2 - 0.13]) add(new THREE.CylinderGeometry(0.035, 0.024, 0.1, 20), chrome, x, -H / 2 - 0.05, D / 2 - 0.16);
  // Lámpara del techo interior (brilla con el bloom)
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1d8).multiplyScalar(0.2) });
  add(new THREE.BoxGeometry(IW * 0.6, 0.02, 0.08), lampMat, 0, H / 2 - 2 * T - 0.012, 0.05, fridge, false);
  const inLight = new THREE.SpotLight(0xfff3dc, 0, 7, 1.0, 0.9, 1.2);
  inLight.position.set(0, H / 2 - 0.25, -0.1); inLight.target.position.set(0, -0.6, 3);
  fridge.add(inLight, inLight.target);
  const fill = new THREE.PointLight(0xfff3dc, 0, 1.6, 1.5); fill.position.set(0, 0.2, 0.05); fridge.add(fill);

  // Tu foto, pegada al fondo
  const photoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const PW = IW - 0.06, PH = IH - 0.06;
  const photo = add(new THREE.PlaneGeometry(PW, PH), photoMat, 0, IY, -D / 2 + T + 0.006, fridge, false);
  // Baldas de cristal con canto
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xdffcf0, roughness: 0.04, transmission: 0.92, thickness: 0.02, transparent: true, opacity: 0.45 });
  for (const y of [-0.42, 0.3]) {
    add(new THREE.BoxGeometry(IW, 0.012, D - T - 0.08), glass, 0, y, 0.0, fridge, false);
    add(new THREE.BoxGeometry(IW, 0.02, 0.012), chrome, 0, y, (D - T - 0.08) / 2, fridge, false);
  }
  // Escáner: línea y puntos de detección
  const scanMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6dffb4).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const scan = add(new THREE.PlaneGeometry(PW, 0.03), scanMat, 0, 0, -D / 2 + T + 0.02, fridge, false);
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6dffb4), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, map: softTex() });
  const scanGlow = add(new THREE.PlaneGeometry(PW, 0.45), glowMat, 0, 0, -D / 2 + T + 0.015, fridge, false);
  const ring = ringTex();
  const dots = Array.from({ length: 14 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ring, color: new THREE.Color(0x6dffb4).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.userData.life = 1; fridge.add(s); return s;
  });

  // Puerta con bisagra a la izquierda
  const hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, D / 2); fridge.add(hinge);
  add(rb(W, H, 0.09, 0.05), enamel, W / 2, 0, 0.045, hinge);
  const doorIn = add(new THREE.PlaneGeometry(W - 0.14, H - 0.16), liner, W / 2, 0, -0.002, hinge, false);
  doorIn.rotation.y = Math.PI;
  const bin = new THREE.MeshPhysicalMaterial({ color: 0xe9fff7, roughness: 0.1, transmission: 0.8, transparent: true, opacity: 0.55 });
  for (const y of [-0.55, 0.15]) add(new THREE.BoxGeometry(W - 0.22, 0.13, 0.1), bin, W / 2, y, -0.07, hinge, false);
  [[0xffffff, 0.25, 0.32], [0xf59a2c, 0.45, 0.26], [0x2f6b3a, 0.68, 0.36], [0xd4433a, 0.9, 0.22]].forEach(([c, x, h]) => {
    const b = add(new THREE.CylinderGeometry(0.045, 0.045, h, 20), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.2, clearcoat: 1 }), x, -0.55 + h / 2 - 0.04, -0.07, hinge, false);
    add(new THREE.CylinderGeometry(0.022, 0.03, 0.06, 16), b.material, 0, h / 2 + 0.03, 0, b, false);
  });
  const handle = add(rb(0.05, 0.75, 0.05, 0.022), chrome, W - 0.1, 0.32, 0.16, hinge);
  for (const y of [-0.03, 0.67]) add(new THREE.BoxGeometry(0.035, 0.035, 0.07), chrome, W - 0.1, y, 0.11, hinge);
  add(rb(0.26, 0.045, 0.012, 0.012), chrome, W / 2 - 0.05, H / 2 - 0.13, 0.095, hinge, false); // placa
  // Rendija de luz alrededor de la puerta (se ve cuando la nevera «piensa»)
  const gapMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xc8fff0).multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false });
  const gz = D / 2 + 0.004;
  add(new THREE.PlaneGeometry(0.012, H - 0.06), gapMat, W / 2 + 0.003, 0, gz, fridge, false);
  add(new THREE.PlaneGeometry(W - 0.06, 0.012), gapMat, 0, H / 2 + 0.003, gz, fridge, false);
  add(new THREE.PlaneGeometry(W - 0.06, 0.012), gapMat, 0, -H / 2 - 0.003, gz, fridge, false);
  void handle;

  // ---------- Imanes ----------
  function tileTexture(text, px) {
    const c = document.createElement("canvas"); const g = c.getContext("2d");
    const font = `700 ${px}px ${FONT}`; g.font = font;
    const pad = Math.round(px * 0.42);
    c.width = Math.max(Math.ceil(g.measureText(text).width) + pad * 2, Math.round(px * 1.05));
    c.height = Math.round(px * 1.42);
    g.font = font; g.fillStyle = "#16201c"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, c.width / 2, c.height / 2 + px * 0.05);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return { t, aspect: c.width / c.height };
  }
  function makeTile(text, color, h, px) {
    const { t, aspect } = tileTexture(text, px);
    const w = h * aspect;
    const g = new THREE.Group();
    const body = new THREE.Mesh(rb(w, h, 0.028, Math.min(0.018, h * 0.22)), new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.15 }));
    body.castShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.45, depthWrite: false }));
    face.position.z = 0.0145;
    g.add(body, face); g.userData.w = w; g.userData.h = h;
    return g;
  }
  const DOOR_Z = 0.09 + 0.016;
  const letters = [];
  const words = [];
  const fontReady = (async () => {
    try { await Promise.race([document.fonts.load(`700 64px ${FONT}`), sleep(1500)]); } catch { /* sin fuente propia */ }
  })();

  async function dropTiles(tiles, gap = 70) {
    const all = tiles.map((tile, k) => {
      const to = tile.userData.to;
      tile.visible = true;
      if (reduce) { tile.position.copy(to); tile.rotation.set(0, 0, tile.userData.rz); return Promise.resolve(); }
      const from = to.clone().add(new THREE.Vector3(rnd(-0.15, 0.15), rnd(0.1, 0.35), 1.6));
      const r0 = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1.5, 1.5));
      tile.position.copy(from); tile.scale.setScalar(0.001);
      return sleep(k * gap).then(() => tween(520, (q) => {
        tile.position.lerpVectors(from, to, Math.min(1, q));
        tile.scale.setScalar(Math.max(0.001, 1.25 - 0.25 * q));
        tile.rotation.set(r0.x * (1 - q), r0.y * (1 - q), tile.userData.rz + r0.z * (1 - q));
      }, E.back)).then(() => { shake = Math.max(shake, 0.006); });
    });
    await Promise.all(all);
  }

  // ---------- Platos ----------
  const soft = softTex();
  let plates = [];
  const SPACING = 1.25;
  const plateSpot = (i) => new THREE.Vector3(i * SPACING, -0.3, 1.95);
  // Mesa de madera donde se sirven los platos (sube cuando llegan las recetas)
  const woodTex = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = "#6b4126"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 6; k++) { g.fillStyle = `hsl(${22 + rnd(-3, 3)} ${42 + rnd(-6, 6)}% ${26 + rnd(-4, 5)}%)`; g.fillRect(0, (k * h) / 6, w, h / 6 - 3); }
    for (let k = 0; k < 420; k++) { g.strokeStyle = `rgba(${rnd(0, 1) > 0.5 ? "40,20,8" : "160,110,70"},${rnd(0.05, 0.22)})`; g.lineWidth = rnd(0.5, 2); const y = rnd(0, h); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + y) * rnd(1, 5)); g.stroke(); }
    g.fillStyle = "rgba(20,10,4,.6)"; for (let k = 1; k < 6; k++) g.fillRect(0, (k * h) / 6 - 3, w, 3);
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(2, 1); woodTex.anisotropy = 8;
  const TABLE_TOP = -0.3;
  const table = new THREE.Group(); table.visible = false; scene.add(table);
  { const top = new THREE.Mesh(new RoundedBoxGeometry(SPACING * 2 + 1.8, 0.06, 2.4, 3, 0.02), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.42, metalness: 0 }));
    top.position.set(SPACING, TABLE_TOP - 0.03, 2.25); top.receiveShadow = true; top.castShadow = true; table.add(top);
    for (const x of [-0.75, SPACING * 2 + 0.75]) for (const z of [1.2, 3.3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2, 0.07), new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.5 })); leg.position.set(x, TABLE_TOP - 1.06, z); table.add(leg); } }
  const TABLE_HIDE = -2.6;
  // Servilleta de cuadros y tenedor
  const gingham = canvasTex(256, 256, (g) => {
    g.fillStyle = "#f7f1e6"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(196,48,40,.55)"; for (let k = 0; k < 8; k++) { g.fillRect(k * 32, 0, 16, 256); g.fillRect(0, k * 32, 256, 16); }
  });
  const napkinMat = new THREE.MeshStandardMaterial({ map: gingham, roughness: 0.9 });
  const forkMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.38 });
  function setting(g, i) {
    const nap = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42, 8, 8), napkinMat);
    const np = nap.geometry.attributes.position; for (let k = 0; k < np.count; k++) np.setZ(k, Math.sin(np.getX(k) * 18 + np.getY(k) * 7) * 0.003);
    nap.geometry.computeVertexNormals();
    nap.rotation.set(-Math.PI / 2, 0, 0.25 + i * 0.4); nap.position.set(0.36, 0.002, -0.05); nap.receiveShadow = true; g.add(nap);
    const fork = new THREE.Group();
    const handle = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.008, 0.16, 2, 0.003), forkMat); handle.position.z = 0.09; fork.add(handle);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.04), forkMat); neck.position.z = -0.005; fork.add(neck);
    for (let k = 0; k < 4; k++) { const tine = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.004, 0.055), forkMat); tine.position.set(-0.0105 + k * 0.007, 0, -0.05); fork.add(tine); }
    fork.traverse((o) => { o.castShadow = true; });
    fork.position.set(0.4, 0.008, 0.02); fork.rotation.y = 0.18; g.add(fork);
  }
  // Luz de «foto de comida»: cálida desde delante a la izquierda y contraluz que hace brillar las salsas
  const foodKey = new THREE.SpotLight(0xffe0b8, 0, 5, 0.5, 0.7, 1.2);
  foodKey.castShadow = true; foodKey.shadow.mapSize.set(1024, 1024); foodKey.shadow.bias = -0.0002; foodKey.shadow.radius = 5;
  const foodRim = new THREE.SpotLight(0xfff4e0, 0, 5, 0.6, 0.8, 1.2);
  scene.add(foodKey, foodKey.target, foodRim, foodRim.target);
  function aimFoodLight(i) {
    const p = plateSpot(i);
    foodKey.position.set(p.x - 0.9, p.y + 1.6, p.z + 1.0); foodKey.target.position.copy(p);
    foodRim.position.set(p.x + 0.5, p.y + 1.1, p.z - 1.0); foodRim.target.position.copy(p);
  }

  let lightK = 0;
  const lights = (on) => { const from = lightK; return tween(600, (k) => { lightK = from + (on - from) * k; foodKey.intensity = lightK * 6; foodRim.intensity = lightK * 2.2; key.intensity = 24 * (1 - lightK * 0.8); }); };

  function makePlate(recipe, i) {
    const g = new THREE.Group();
    const spin = new THREE.Group(); g.add(spin);
    const dish = buildDish(recipe, i);
    spin.add(dish.group);
    setting(g, i);
    const steam = [];
    if (dish.hot && !reduce) for (let k = 0; k < 7; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      s.userData.phase = k / 7; s.userData.x = rnd(-0.09, 0.09); s.userData.z = rnd(-0.09, 0.09); g.add(s); steam.push(s);
    }
    g.userData = { spin, steam, top: dish.top, i, kind: dish.kind };
    g.visible = false; scene.add(g);
    return g;
  }
  function clearPlates() {
    for (const p of plates) {
      scene.remove(p);
      p.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material; if (!m || m === napkinMat || m === forkMat) return;
        if (m.map && m.map !== soft && !m.map.userData.shared) m.map.dispose();
        m.dispose?.();
      });
    }
    plates = [];
  }

  // ---------- Vaho frío ----------
  const mist = Array.from({ length: reduce ? 0 : 34 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xdff8ff, transparent: true, opacity: 0, depthWrite: false }));
    s.userData = { life: 1, v: new THREE.Vector3() }; scene.add(s); return s;
  });
  let mistRate = 0, mistAcc = 0;
  const emitMist = (n = 1, burst = false) => {
    for (let k = 0; k < n; k++) {
      const s = mist.find((m) => m.userData.life >= 1); if (!s) return;
      const open = -doorAngle > 0.3;
      s.position.set(rnd(-W / 2, W / 2) * (open ? 0.9 : 1), open ? rnd(-H / 2 + 0.15, 0.2) : -H / 2 + 0.12, D / 2 + (open ? rnd(0, 0.2) : 0.12));
      s.userData.v.set(rnd(-0.06, 0.06), burst ? rnd(-0.25, -0.05) : rnd(-0.12, -0.04), rnd(0.12, burst ? 0.5 : 0.25));
      s.userData.life = 0; s.userData.max = rnd(0.05, 0.1);
    }
  };

  // ---------- Animación ----------
  const tweens = new Set();
  const tween = (ms, fn, curve = E.inOut) => new Promise((done) => {
    if (reduce || ms <= 0) { fn(1); return done(); }
    tweens.add({ t0: performance.now(), ms, fn, curve, done });
  });
  let doorAngle = 0, hum = 0, scanning = false, scanStart = 0, showing = false, shake = 0, t = 0, focusI = 0;
  let inside = 0; // 0 fuera, 1 la luz interior a tope
  let lowPower = false, frames = 0, slow = 0;
  const setDoor = (to, ms = 900, curve = E.inOut) => { const from = doorAngle; return tween(ms, (k) => { doorAngle = from + (to - from) * k; }, curve); };

  // Cámara: planos que se recalculan con el tamaño de pantalla
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let shotName = "intro", camBusy = false;
  const fit = (w, h, aspect = camera.aspect) => {
    const v = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return Math.max(h / 2 / v, w / 2 / (v * aspect));
  };
  function shot(name, i = focusI) {
    const a = camera.aspect, wide = a > 1.05;
    if (name === "intro") {
      if (wide) { const look = new THREE.Vector3(-1.05, -0.05, 0.45); return { look, pos: look.clone().add(new THREE.Vector3(0.55, 0.3, fit(0, H * 1.32))) }; }
      const look = new THREE.Vector3(0.02, -0.3, 0.45);
      return { look, pos: look.clone().add(new THREE.Vector3(0.42, 0.22, fit(W * 1.16, H * 1.05))) };
    }
    if (name === "inside") {
      const look = new THREE.Vector3(0, IY, -D / 2 + T);
      return { look, pos: look.clone().add(new THREE.Vector3(0, 0, fit(PW * 1.02, PH * 1.03))) };
    }
    if (name === "scan") { const s = shot("inside"); s.pos.lerp(s.look, 0.12); return s; }
    const p = plateSpot(i);
    if (wide) { const look = p.clone().add(new THREE.Vector3(-0.62, 0, 0.08)); const d = fit(0, 1.15); return { look, pos: look.clone().add(new THREE.Vector3(0.1, d * 0.77, d * 0.64)) }; }
    const look = p.clone().add(new THREE.Vector3(0, 0, 0.24));
    const d = fit(0.98, 0);
    return { look, pos: look.clone().add(new THREE.Vector3(0, d * 0.83, d * 0.56)) };
  }
  function moveCam(name, ms = 1200, curve = E.inOut, i) {
    shotName = name; if (i !== undefined) focusI = i;
    const to = shot(name, focusI);
    const fp = cam.pos.clone(), fl = cam.look.clone();
    camBusy = true;
    return tween(ms, (k) => { cam.pos.lerpVectors(fp, to.pos, k); cam.look.lerpVectors(fl, to.look, k); }, curve).then(() => { camBusy = false; });
  }

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!camBusy) { const s = shot(shotName); cam.pos.copy(s.pos); cam.look.copy(s.look); }
  };
  new ResizeObserver(resize).observe(container); resize();
  { const s = shot("intro"); cam.pos.copy(s.pos).add(new THREE.Vector3(0, 0.25, 1.2)); cam.look.copy(s.look); }

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(container);

  // Paralaje suave con el ratón (en el móvil, un vaivén lento)
  const par = new THREE.Vector2(), parT = new THREE.Vector2();
  addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") parT.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); }, { passive: true });

  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05); t += dt;
    const now = performance.now();
    for (const tw of tweens) {
      const k = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(tw.curve(k));
      if (k >= 1) { tweens.delete(tw); tw.done(); }
    }
    if (!visible || document.hidden) return;

    hinge.rotation.y = doorAngle + (hum > 0 && !reduce ? Math.sin(t * 38) * 0.0025 * hum : 0);
    fridge.position.x = hum > 0 && !reduce ? Math.sin(t * 61) * 0.0018 * hum : 0;
    const open = Math.min(1, -doorAngle / 1.2);
    inside += ((open > 0.05 ? 1 : 0) - inside) * Math.min(1, dt * 6);
    inLight.intensity = inside * 4.5 * (1 - lightK * 0.9); fill.intensity = inside * 0.7 * (1 - lightK);
    lampMat.color.setRGB(1, 0.95, 0.85).multiplyScalar(0.15 + inside * 2.4);
    gapMat.opacity = open > 0.02 ? 0 : hum * (0.55 + 0.45 * Math.sin(t * 5));

    // Escáner
    if (scanning) {
      const y = IY + Math.sin((t - scanStart) * 1.9 - Math.PI / 2) * (PH / 2 - 0.02);
      scan.position.y = y; scanGlow.position.y = y;
      scanMat.opacity = Math.min(1, scanMat.opacity + dt * 3); glowMat.opacity = scanMat.opacity * 0.7;
      if (Math.random() < dt * 7) {
        const d = dots.find((s) => s.userData.life >= 1);
        if (d) { d.position.set(rnd(-PW / 2 + 0.1, PW / 2 - 0.1), rnd(IY - PH / 2 + 0.1, IY + PH / 2 - 0.1), -D / 2 + T + 0.03); d.userData.life = 0; }
      }
    } else { scanMat.opacity *= 0.9; glowMat.opacity *= 0.9; }
    for (const d of dots) {
      if (d.userData.life >= 1) { d.material.opacity = 0; continue; }
      d.userData.life += dt / 0.9; const l = d.userData.life;
      d.scale.setScalar(0.04 + l * 0.1); d.material.opacity = Math.sin(Math.min(1, l) * Math.PI);
    }

    // Vaho
    if (mist.length) {
      mistAcc += dt * (mistRate + hum * 6);
      while (mistAcc > 1) { emitMist(1); mistAcc -= 1; }
      for (const s of mist) {
        const u = s.userData; if (u.life >= 1) { s.material.opacity = 0; continue; }
        u.life += dt / 2.6; u.v.y = Math.max(u.v.y - dt * 0.05, -0.2);
        s.position.addScaledVector(u.v, dt);
        if (s.position.y < FLOOR_Y + 0.06) { s.position.y = FLOOR_Y + 0.06; u.v.y = 0; u.v.x *= 1.02; }
        s.scale.setScalar(0.25 + u.life * 1.1); s.material.opacity = u.max * Math.sin(Math.min(1, u.life) * Math.PI);
      }
    }

    // Platos: giran despacio y echan humo
    for (const p of plates) {
      if (!p.visible) continue;
      if (!reduce && p.userData.landed) p.userData.spin.rotation.y += dt * 0.12;
      for (const s of p.userData.steam) {
        const k = (t * 0.32 + s.userData.phase) % 1;
        s.position.set(s.userData.x + Math.sin(t * 1.3 + s.userData.phase * 9) * 0.04 * k, p.userData.top + 0.03 + k * 0.55, s.userData.z);
        s.scale.setScalar(0.06 + k * 0.38); s.material.opacity = 0.2 * Math.sin(k * Math.PI) * (showing && p.userData.landed ? 1 : 0);
      }
    }

    // Cámara con paralaje y temblor
    par.lerp(parT, Math.min(1, dt * 3));
    const sway = reduce ? 0 : 1;
    tmp.copy(cam.pos);
    tmp.x += (par.x * 0.25 + Math.sin(t * 0.35) * 0.04) * sway;
    tmp.y += (-par.y * 0.15 + Math.sin(t * 0.5) * 0.02) * sway;
    if (shake > 0.0005 && !reduce) { tmp.x += rnd(-shake, shake); tmp.y += rnd(-shake, shake); shake *= Math.pow(0.02, dt); } else shake = 0;
    camera.position.copy(tmp); camera.lookAt(cam.look);
    if (lowPower) renderer.render(scene, camera); else composer.render();
    // Si el móvil no llega, se baja la calidad (sin bloom y menos píxeles)
    if (adaptive && !lowPower && ++frames > 40) { slow = slow * 0.9 + (dt > 0.034 ? 0.1 : 0); if (slow > 0.6) { lowPower = true; renderer.setPixelRatio(1); resize(); } }
  });

  // Toca un plato: devuelve su índice o -1
  const ray = new THREE.Raycaster();
  function pick(x, y) {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(plates.filter((p) => p.visible), true)[0];
    let o = hit?.object; while (o && o.userData.i === undefined) o = o.parent;
    return o ? o.userData.i : -1;
  }

  async function slam() {
    await setDoor(0, 420, E.in);
    shake = 0.035; emitMist(10, true);
    await setDoor(-0.05, 110, E.out); await setDoor(0, 160, E.in);
  }
  async function retractPlates() {
    if (!plates.length || !plates.some((p) => p.visible)) return;
    showing = false;
    lights(0);
    const t0 = table.position.y;
    tween(700, (k) => { table.position.y = t0 + (TABLE_HIDE - t0) * k; }, E.in).then(() => { table.visible = false; });
    await Promise.all(plates.map((p, i) => { p.userData.landed = false; const from = p.position.clone(), to = new THREE.Vector3(0, 0, -0.1); return sleep(i * 70).then(() => tween(600, (k) => { p.position.lerpVectors(from, to, k); p.scale.setScalar(Math.max(0.001, 1 - k)); }, E.in)); }));
    plates.forEach((p) => { p.visible = false; });
  }
  async function clearWords() {
    const old = words.splice(0);
    await Promise.all(old.map((w, k) => sleep(k * 25).then(() => { const from = w.position.clone(); return tween(320, (q) => { w.position.set(from.x, from.y - q * 0.15, from.z + q * 0.5); w.scale.setScalar(Math.max(0.001, 1 - q)); }, E.in); })));
    old.forEach((w) => { hinge.remove(w); w.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); }); });
  }

  const api = {
    async intro() {
      await fontReady;
      if (!letters.length) {
        const rows = [["¿", "Q", "U", "É"], ["C", "O", "C", "I", "N", "O", "?"]];
        let c = 0;
        rows.forEach((row, ri) => {
          const tiles = row.map((ch) => makeTile(ch, MAGNETS[c++ % MAGNETS.length], 0.135, 96));
          const total = tiles.reduce((s, tl) => s + tl.userData.w, 0) + (tiles.length - 1) * 0.012;
          let x = W / 2 - 0.04 - total / 2;
          tiles.forEach((tl) => {
            tl.userData.to = new THREE.Vector3(x + tl.userData.w / 2, 0.68 - ri * 0.19 + rnd(-0.012, 0.012), DOOR_Z);
            tl.userData.rz = rnd(-0.14, 0.14); x += tl.userData.w + 0.012;
            tl.visible = false; hinge.add(tl); letters.push(tl);
          });
        });
      }
      moveCam("intro", 1800, E.out);
      await sleep(350);
      await dropTiles(letters, 75);
    },
    async showPhoto(url) {
      await retractPlates();
      if (words.length) clearWords();
      const tex = await new THREE.TextureLoader().loadAsync(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      const ia = tex.image.width / tex.image.height, pa = PW / PH;
      if (ia > pa) { tex.repeat.set(pa / ia, 1); tex.offset.set((1 - pa / ia) / 2, 0); } else { tex.repeat.set(1, ia / pa); tex.offset.set(0, (1 - ia / pa) / 2); }
      photoMat.map?.dispose(); photoMat.map = tex; photoMat.opacity = 1; photoMat.needsUpdate = true;
      hum = 0;
      mistRate = 14; emitMist(12, true);
      const door = setDoor(OPEN, 950, E.out);
      await sleep(reduce ? 0 : 250);
      await moveCam("inside", 1300, E.inOut);
      await door; mistRate = 3;
      scanning = true; scanStart = t;
      moveCam("scan", 4000, E.out);
    },
    // Cierra (o sigue cerrada) y zumba mientras la IA piensa
    async think() {
      if (scanning) { const left = 2.6 - (t - scanStart); if (left > 0 && !reduce) await sleep(left * 1000); }
      scanning = false;
      await retractPlates();
      if (-doorAngle > 0.05) { moveCam("intro", 1100, E.inOut); await sleep(reduce ? 0 : 450); mistRate = 0; await slam(); }
      else if (shotName !== "intro") await moveCam("intro", 900);
      hum = 1;
    },
    async stick(list) {
      await fontReady;
      await clearWords();
      const ROW_H = 0.104, X0 = 0.09, X1 = W - 0.2;
      let x = X0, y = 0.26, c = 2;
      for (const name of list.slice(0, 18)) {
        const tl = makeTile(name, MAGNETS[c++ % MAGNETS.length], 0.078, 64);
        const w = tl.userData.w;
        if (x + w > X1) { x = X0; y -= ROW_H; }
        if (y < -0.9) break;
        tl.userData.to = new THREE.Vector3(x + w / 2 + rnd(0, 0.02), y + rnd(-0.01, 0.01), DOOR_Z);
        tl.userData.rz = rnd(-0.1, 0.1); x += w + 0.02;
        tl.visible = false; hinge.add(tl); words.push(tl);
      }
      const keep = hum; hum = Math.min(hum, 0.4);
      await dropTiles(words, 85);
      hum = keep;
    },
    async serve(recetas) {
      scanning = false;
      if (shotName !== "intro" && -doorAngle < 0.05) await moveCam("intro", 700);
      await sleep(reduce ? 0 : 450);
      hum = 0;
      clearPlates();
      plates = recetas.slice(0, 3).map((r, i) => makePlate(r, i));
      mistRate = 16; emitMist(14, true);
      await setDoor(OPEN, 900, E.back);
      showing = true;
      table.visible = true; table.position.y = TABLE_HIDE;
      tween(1100, (k) => { table.position.y = TABLE_HIDE * (1 - k); }, E.out);
      aimFoodLight(0); lights(1);
      const cam0 = moveCam("plates", 1700, E.inOut, 0);
      await Promise.all(plates.map((p, i) => {
        const to = plateSpot(i);
        const from = new THREE.Vector3(0, -0.42 + i * 0.36, -0.1);
        p.position.copy(from); p.scale.setScalar(0.001); p.visible = true; p.userData.landed = false;
        return sleep(reduce ? 0 : 300 + i * 170).then(() => tween(1250, (k) => {
          p.position.lerpVectors(from, to, k); p.position.y += Math.sin(k * Math.PI) * 0.45;
          p.scale.setScalar(Math.max(0.001, Math.min(1, k * 1.3)));
        }, E.out)).then(() => { p.userData.landed = true; });
      }));
      await cam0; mistRate = 2.5;
    },
    focus(i) { if (!plates[i]) return Promise.resolve(); aimFoodLight(i); return moveCam("plates", 750, E.inOut, i); },
    pick,
    async reset() {
      scanning = false; hum = 0; mistRate = 0;
      await retractPlates();
      if (-doorAngle > 0.05) { moveCam("intro", 1000); await sleep(reduce ? 0 : 300); await slam(); }
      else await moveCam("intro", 800);
      photoMat.opacity = 0;
      await clearWords();
    },
  };
  return api;
}
