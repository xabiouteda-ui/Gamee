// Nevera en 3D (Three.js) para «¿Qué cocino con lo que tengo?».
// Secuencia: cerrada y flotando → se abre y aparece tu foto dentro con un escaneo → se cierra mientras la IA
// piensa (zumbido y luz por la rendija) → se abre y salen tres platos flotando con su nombre.
// Se carga solo si hay WebGL; con «reducir movimiento» se colocan los estados sin animar.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const W = 1.25, H = 2.05, D = 0.9, T = 0.05; // nevera (m)
const OPEN = -1.95; // ángulo de la puerta abierta (rad)
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const back = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function createFridge(container, { onPlate } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const camBase = new THREE.Vector3(0.55, 0.7, 5.1);
  camera.position.copy(camBase);
  const look = new THREE.Vector3(0, 0.05, 0.3);

  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2.5, 4, 3.5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
  scene.add(key, new THREE.HemisphereLight(0xf2fff8, 0x9fb5aa, 0.5));

  // Suelo que solo recibe sombra
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -H / 2 - 0.12; floor.receiveShadow = true;
  scene.add(floor);

  const enamel = new THREE.MeshPhysicalMaterial({ color: 0x6fbf9c, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const inside = new THREE.MeshStandardMaterial({ color: 0xf6f8f7, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecef, metalness: 1, roughness: 0.18 });

  const fridge = new THREE.Group();
  scene.add(fridge);

  // Cuerpo: caja abierta por delante (paredes con grosor) para ver el interior
  const panel = (w, h, d, x, y, z, mat = enamel) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) / 2.2), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; fridge.add(m); return m;
  };
  panel(W, H, T, 0, 0, -D / 2 + T / 2);
  panel(T, H, D, -W / 2 + T / 2, 0, 0);
  panel(T, H, D, W / 2 - T / 2, 0, 0);
  panel(W, T, D, 0, H / 2 - T / 2, 0);
  panel(W, T * 3, D, 0, -H / 2 + T * 1.5, 0);
  // Revestimiento blanco interior
  const liner = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, H - 4 * T, 0.01), inside);
  liner.position.set(0, T, -D / 2 + T + 0.006); fridge.add(liner);
  // Patas
  for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.12, 16), chrome);
    leg.position.set(x, -H / 2 - 0.06, D / 2 - 0.15); fridge.add(leg);
  }

  // La foto, en el fondo de la nevera
  const photoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T - 0.04, H - 4 * T - 0.04), photoMat);
  photo.position.set(0, T, -D / 2 + T + 0.015); fridge.add(photo);

  // Baldas de cristal
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xe8fff6, roughness: 0.05, transmission: 0.9, thickness: 0.02, transparent: true, opacity: 0.5 });
  for (const y of [-0.38, 0.32]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, 0.018, D - T - 0.06), glass);
    s.position.set(0, y, 0.02); fridge.add(s);
  }

  // Línea de escaneo
  const scanMat = new THREE.MeshBasicMaterial({ color: 0x5ff0a6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * T, 0.06), scanMat);
  scan.position.set(0, 0, -D / 2 + T + 0.03); fridge.add(scan);

  // Luz interior
  const lamp = new THREE.PointLight(0xfff2d6, 0, 3, 1.6);
  lamp.position.set(0, H / 2 - 0.25, 0.1); fridge.add(lamp);

  // Puerta con bisagra a la izquierda
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2, 0, D / 2); fridge.add(hinge);
  const door = new THREE.Mesh(new RoundedBoxGeometry(W, H, 0.09, 4, 0.04), enamel);
  door.position.set(W / 2, 0, 0.045); door.castShadow = true; hinge.add(door);
  const handle = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.62, 0.05, 3, 0.02), chrome);
  handle.position.set(W - 0.12, 0.35, 0.13); hinge.add(handle);
  for (const y of [0.08, 0.62]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), chrome);
    foot.position.set(W - 0.12, y, 0.1); hinge.add(foot);
  }
  // Imanes en la puerta (los mismos colores que los ingredientes de la página)
  [[0xffc23a, 0.32, 0.55, 0.2], [0xff7d63, 0.62, 0.42, -0.25], [0xffffff, 0.38, 0.12, 0.1], [0x6f9cff, 0.7, -0.1, 0.3], [0xe77fd8, 0.3, -0.35, -0.15]].forEach(([c, x, y, r]) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.1, 0.03, 3, 0.012), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
    m.position.set(x, y, 0.1); m.rotation.z = r; m.castShadow = true; hinge.add(m);
  });

  // Platos
  const plates = [];
  const foodColors = [0xf2b84b, 0x7cc36a, 0xe2563d];
  const label = (text) => {
    const c = document.createElement("canvas"); c.width = 768; c.height = 160;
    const g = c.getContext("2d");
    g.font = '700 54px "Bricolage Grotesque", "Avenir Next", system-ui, sans-serif';
    const words = text.split(" "); let line = "", lines = [];
    for (const w of words) { const t = line ? line + " " + w : w; if (g.measureText(t).width > 680 && line) { lines.push(line); line = w; } else line = t; }
    lines.push(line); lines = lines.slice(0, 2);
    const h = 44 + lines.length * 58;
    g.fillStyle = "rgba(255,255,255,0.94)"; g.beginPath(); g.roundRect(4, (160 - h) / 2, 760, h, 32); g.fill();
    g.fillStyle = "#1d2a23"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, i) => g.fillText(l, 384, 80 + (i - (lines.length - 1) / 2) * 58));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    sp.renderOrder = 10; sp.scale.set(1.05, 0.22, 1); return sp;
  };
  const makePlate = (i) => {
    const g = new THREE.Group();
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.05, 48), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.6 }));
    dish.castShadow = true; g.add(dish);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 12, 64), new THREE.MeshStandardMaterial({ color: 0x2c6a43, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.028; g.add(rim);
    const food = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16), new THREE.MeshStandardMaterial({ color: foodColors[i % 3], roughness: 0.55 }));
    food.scale.set(1, 0.38, 1); food.position.y = 0.06; food.castShadow = true; g.add(food);
    for (let k = 0; k < 5; k++) { // trocitos encima
      const bit = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: [0x2c6a43, 0xfff3d1, 0xc8432c][k % 3], roughness: 0.5 }));
      const a = (k / 5) * Math.PI * 2 + i; bit.position.set(Math.cos(a) * 0.11, 0.12, Math.sin(a) * 0.11); g.add(bit);
    }
    g.visible = false; g.userData.index = i; scene.add(g); return g;
  };
  for (let i = 0; i < 3; i++) plates.push(makePlate(i));
  const targets = [new THREE.Vector3(-1.0, -0.3, 1.6), new THREE.Vector3(0.15, 0.6, 1.55), new THREE.Vector3(1.2, -0.15, 1.35)];

  // Animación
  const tweens = new Set();
  const tween = (ms, fn, curve = ease) => new Promise((done) => {
    if (reduce) { fn(1); return done(); }
    const t0 = performance.now(); const tw = { t0, ms, fn, curve, done }; tweens.add(tw);
  });
  let doorAngle = 0, humming = false, scanning = false, showing = false, t = 0;
  const setDoor = (to, ms = 900) => { const from = doorAngle; return tween(ms, (k) => { doorAngle = from + (to - from) * k; }); };

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const narrow = camera.aspect < 1.4; // móvil: más lejos y algo a la izquierda para que quepa la puerta abierta
    camera.position.z = camBase.z * (narrow ? 1.3 : 1);
    look.x = narrow ? -0.3 : 0;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container); resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(container);

  const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
  renderer.domElement.addEventListener("pointermove", (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  });
  renderer.domElement.addEventListener("click", () => {
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(plates.filter((p) => p.visible), true)[0];
    if (hit) { let o = hit.object; while (o && o.userData.index === undefined) o = o.parent; if (o) onPlate?.(o.userData.index); }
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta(); t += dt;
    const now = performance.now();
    for (const tw of tweens) {
      const k = Math.min(1, (now - tw.t0) / tw.ms); tw.fn(tw.curve(k));
      if (k >= 1) { tweens.delete(tw); tw.done(); }
    }
    if (!visible) return;
    hinge.rotation.y = doorAngle;
    const float = reduce ? 0 : Math.sin(t * 1.3) * 0.03;
    fridge.position.y = float + (humming && !reduce ? Math.sin(t * 60) * 0.004 : 0);
    fridge.rotation.y = reduce ? -0.12 : -0.12 + Math.sin(t * 0.5) * 0.04;
    lamp.intensity = THREE.MathUtils.lerp(lamp.intensity, -doorAngle > 0.2 ? 2.2 : humming ? 0.6 + Math.sin(t * 4) * 0.3 : 0, 0.1);
    if (scanning) { scan.position.y = T + Math.sin(t * 2.4) * (H / 2 - 0.25); scanMat.opacity = 0.75; } else scanMat.opacity *= 0.9;
    if (showing && !reduce) plates.forEach((p, i) => { p.rotation.y += dt * 0.35; p.position.y = p.userData.y + Math.sin(t * 1.6 + i) * 0.04; });
    ray.setFromCamera(pointer, camera);
    const over = showing && ray.intersectObjects(plates, true).length > 0;
    renderer.domElement.style.cursor = over ? "pointer" : "";
    camera.lookAt(look);
    renderer.render(scene, camera);
  });

  const api = {
    // Abre la puerta y muestra la foto en el fondo con el escaneo
    async showPhoto(url) {
      api.hidePlates();
      const tex = await new THREE.TextureLoader().loadAsync(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      const pw = W - 2 * T - 0.04, ph = H - 4 * T - 0.04, ia = tex.image.width / tex.image.height, pa = pw / ph;
      if (ia > pa) { tex.repeat.set(pa / ia, 1); tex.offset.set((1 - pa / ia) / 2, 0); } else { tex.repeat.set(1, ia / pa); tex.offset.set(0, (1 - ia / pa) / 2); }
      photoMat.map?.dispose(); photoMat.map = tex; photoMat.needsUpdate = true;
      await setDoor(OPEN, 950);
      scanning = true;
      await tween(600, (k) => { photoMat.opacity = k; });
    },
    // Cierra la puerta mientras la IA piensa
    async think() {
      await new Promise((r) => setTimeout(r, reduce ? 0 : 1300));
      scanning = false; humming = true;
      await setDoor(0, 800);
    },
    // Abre y saca los platos
    async serve(recetas) {
      humming = false;
      await setDoor(OPEN, 900);
      showing = true;
      plates.forEach((p, i) => {
        p.children.filter((c) => c.isSprite).forEach((s) => { p.remove(s); s.material.map.dispose(); });
        const name = recetas[i]?.nombre; p.visible = !!name; if (!name) return;
        const sp = label(name); sp.position.set(0, 0.42, 0); p.add(sp);
        // En pantallas estrechas los platos se juntan para no salirse del encuadre
        const spread = Math.min(1, camera.aspect / 1.7), size = 0.75 + 0.25 * spread;
        const to = targets[i].clone(); to.x *= spread;
        p.position.set(0, 0, 0); p.scale.setScalar(0.15); p.userData.y = to.y;
        const from = new THREE.Vector3(0, -0.2 + i * 0.25, 0);
        setTimeout(() => tween(1100, (k) => { p.position.lerpVectors(from, to, k); p.scale.setScalar(0.15 + (size - 0.15) * k); }, back), reduce ? 0 : i * 180);
      });
    },
    hidePlates() { showing = false; plates.forEach((p) => { p.visible = false; }); },
    // Vuelve al estado inicial
    async reset() { api.hidePlates(); scanning = false; humming = false; photoMat.opacity = 0; await setDoor(0, 700); },
    async idleOpen() { await setDoor(OPEN * 0.35, 700); await new Promise((r) => setTimeout(r, 500)); await setDoor(0, 600); },
  };
  return api;
}
