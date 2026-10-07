// «¿Qué cocino con lo que tengo?»: experiencia a pantalla completa.
// Foto de la nevera → la IA (workers/nevera/worker.js → Gemini) reconoce ingredientes y propone 3 recetas.
// La foto se reduce y se pasa a JPEG en el navegador (sin datos EXIF). La escena 3D (scene.js) es decorativa:
// sin WebGL, la interfaz funciona igual.

const $ = (id) => document.getElementById(id);
const API = (window.SITE_CONFIG?.neveraApi || "").trim();
const MAX_SIDE = 1024;

const EXAMPLE = {
  ingredientes: ["huevo", "patata", "cebolla", "pimiento verde", "tomate", "queso rallado", "yogur natural", "calabacín", "jamón serrano", "leche"],
  recetas: [
    {
      nombre: "Tortilla de patatas con cebolla",
      descripcion: "Jugosa por dentro y dorada por fuera, la de toda la vida.",
      minutos: 35, dificultad: "media",
      usa: ["huevo", "patata", "cebolla"], falta: [],
      pasos: ["Pela 3 patatas medianas y córtalas en láminas finas. Pica 1 cebolla.", "Fríelas a fuego medio en abundante aceite unos 15 minutos, hasta que estén tiernas.", "Escúrrelas y mézclalas con 5 huevos batidos y sal. Deja reposar 5 minutos.", "Cuaja la mezcla en una sartén con un poco de aceite, 3 minutos por cada lado.", "Dale la vuelta con un plato y sirve templada."],
    },
    {
      nombre: "Crema de calabacín con jamón crujiente",
      descripcion: "Suave, caliente y con un toque salado que cruje encima.",
      minutos: 25, dificultad: "fácil",
      usa: ["calabacín", "cebolla", "patata", "leche", "jamón serrano"], falta: [],
      pasos: ["Pocha 1 cebolla picada en una olla con aceite, 5 minutos.", "Añade 2 calabacines y 1 patata en dados y cubre con agua. Cuece 15 minutos.", "Tritura con un chorrito de leche y sal hasta que quede fina.", "Dora 40 g de jamón en una sartén sin aceite hasta que cruja.", "Sirve la crema con el jamón por encima."],
    },
    {
      nombre: "Revuelto de pimiento y tomate",
      descripcion: "La cena de diez minutos que siempre sale bien.",
      minutos: 12, dificultad: "fácil",
      usa: ["huevo", "pimiento verde", "tomate", "cebolla"], falta: [],
      pasos: ["Pica medio pimiento verde, media cebolla y 1 tomate.", "Póchalo todo en una sartén con aceite a fuego medio, 6 minutos.", "Añade 4 huevos batidos con sal.", "Remueve sin parar 2 minutos, hasta que cuajen pero sigan jugosos."],
    },
  ],
};
const PHRASES = ["Mirando lo que tienes…", "Contando los huevos…", "Buscando el queso del fondo…", "Revisando ese táper misterioso…", "Calentando la sartén…", "Pensando recetas ricas…"];

const root = $("nevera");
let ingredients = [];
let stuck = ""; // lista que ya está pegada en la puerta
let recipes = [];
let index = 0;
let busy = false;
let isExample = false;
let fridge = null;

// ---------- Escena ----------
let queue = Promise.resolve();
const scene = (fn, ...a) => { queue = queue.then(() => fridge?.[fn]?.(...a)).catch(() => { /* la escena es decorativa */ }); return queue; };

async function load3D() {
  const stage = $("nv-stage");
  const gl = (() => { try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; } })();
  if (!gl) return;
  try {
    const { createFridge } = await import("./scene.js");
    fridge = createFridge(stage, { adaptive: location.hash !== "#debug-nevera" });
    root.classList.add("has-3d");
    if (location.hash === "#debug-nevera") window.nvScene = fridge;
    if (root.dataset.step === "intro") scene("intro");
  } catch { /* sin 3D */ }
}

// ---------- Utilidades ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const setStep = (s) => { root.dataset.step = s; };

let toastTimer;
function toast(text) {
  const el = $("nv-status");
  el.textContent = text; el.hidden = !text;
  clearTimeout(toastTimer);
  if (text) toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

let phraseTimer;
function caption(text, cycle = false) {
  clearInterval(phraseTimer);
  const el = $("nv-busy-text");
  const set = (t) => { el.classList.remove("in"); void el.offsetWidth; el.textContent = t; el.classList.add("in"); };
  set(text);
  if (cycle) { let k = 0; phraseTimer = setInterval(() => set(PHRASES[++k % PHRASES.length]), 2300); }
}

// ---------- Tarjeta de receta ----------
function renderCard() {
  const r = recipes[index];
  if (!r) return;
  $("nv-count").textContent = `Receta ${index + 1} de ${recipes.length}${isExample ? " · ejemplo" : ""}`;
  $("nv-name").textContent = r.nombre;
  $("nv-desc").textContent = r.descripcion;
  const falta = r.falta.length ? `<span class="miss">Te falta: ${esc(r.falta.join(", "))}</span>` : '<span class="ok">No te falta nada</span>';
  $("nv-meta").innerHTML = `<span>${r.minutos} min</span><span>${esc(r.dificultad)}</span>${falta}`;
  $("nv-prev").disabled = index === 0;
  $("nv-next").disabled = index === recipes.length - 1;
  [...$("nv-dots").children].forEach((d, i) => { d.hidden = i >= recipes.length; d.classList.toggle("on", i === index); });
  $("nv-ings-n").textContent = ingredients.length;
  const card = $("nv-card");
  card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap");
}
function go(i) {
  if (i < 0 || i >= recipes.length || i === index) return;
  index = i; renderCard(); scene("focus", i);
}

// ---------- Hoja inferior ----------
let lastFocus = null;
function openSheet(html) {
  lastFocus = document.activeElement;
  $("nv-sheet-body").innerHTML = html;
  const sheet = $("nv-sheet");
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add("open"));
  sheet.querySelector(".nv-close").focus({ preventScroll: true });
}
function closeSheet() {
  const sheet = $("nv-sheet");
  if (sheet.hidden) return;
  sheet.classList.remove("open");
  setTimeout(() => { sheet.hidden = true; }, 280);
  lastFocus?.focus?.({ preventScroll: true });
}
const sheetOpen = () => !$("nv-sheet").hidden;

function recipeSheet(i) {
  const r = recipes[i]; if (!r) return;
  const have = new Set(ingredients);
  openSheet(`
    <p class="nv-kicker">${r.minutos} min · dificultad ${esc(r.dificultad)}</p>
    <h2 id="nv-sheet-title" class="nv-sheet-title">${esc(r.nombre)}</h2>
    <p class="nv-sheet-desc">${esc(r.descripcion)}</p>
    <h3>Ingredientes</h3>
    <p class="nv-tags">${r.usa.map((u) => `<span class="nv-tag${have.has(u) || !have.size ? "" : " off"}">${esc(u)}</span>`).join("")}${r.falta.map((f) => `<span class="nv-tag miss">${esc(f)} (falta)</span>`).join("")}</p>
    <h3>Cómo se hace</h3>
    <ol class="nv-steps">${r.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
    <p class="nv-sheet-actions"><button type="button" class="nv-cta nv-cta-sm" data-copy="${i}">Copiar receta</button></p>
    <p class="nv-fine">Receta propuesta por una IA: revisa tiempos y alérgenos.</p>`);
}

function ingredientsSheet(focusInput = false) {
  openSheet(`
    <h2 id="nv-sheet-title" class="nv-sheet-title">${ingredients.length ? "Tus ingredientes" : "¿Qué tienes?"}</h2>
    <p class="nv-sheet-desc">${ingredients.length ? "Quita lo que no sea y añade lo que esté escondido al fondo." : "Escribe lo que tienes, separado por comas."}</p>
    <ul class="nv-chips" id="nv-chips"></ul>
    <form class="nv-add" id="nv-add">
      <label for="nv-new" class="nv-sr">Añadir ingrediente</label>
      <input id="nv-new" type="text" placeholder="huevos, queso, cebolla…" autocomplete="off" maxlength="120" enterkeyhint="done">
      <button type="submit" class="nv-pill">Añadir</button>
    </form>
    <p class="nv-sheet-actions"><button type="button" class="nv-cta nv-cta-sm" id="nv-search">Buscar recetas con esta lista</button></p>`);
  renderChips();
  if (focusInput) setTimeout(() => $("nv-new")?.focus(), 300);
}
function renderChips() {
  const ul = $("nv-chips"); if (!ul) return;
  ul.innerHTML = ingredients.map((n, i) => `<li style="--i:${i}"><span>${esc(n)}</span><button type="button" data-remove="${esc(n)}" aria-label="Quitar ${esc(n)}">×</button></li>`).join("")
    || '<li class="nv-chips-empty">Todavía no hay nada. Añade el primero.</li>';
  $("nv-search").disabled = !ingredients.length;
}
function addIngredients(text) {
  for (const raw of text.split(",")) {
    const n = raw.trim().toLowerCase().slice(0, 40);
    if (n && !ingredients.includes(n) && ingredients.length < 40) ingredients.push(n);
  }
  renderChips();
}

function recipeText(r) {
  return [r.nombre, `${r.minutos} min · dificultad ${r.dificultad}`, "", "Ingredientes: " + r.usa.concat(r.falta).join(", "), "", ...r.pasos.map((p, i) => `${i + 1}. ${p}`), "", `Receta de ${location.origin}${location.pathname}`].join("\n");
}

// ---------- IA ----------
async function shrink(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { bmp = await createImageBitmap(file); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}
async function ask(payload) {
  if (!API) throw new Error("La lectura de fotos todavía no está activada. Mientras, prueba el ejemplo.");
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se ha podido conectar. Comprueba tu conexión y prueba otra vez.");
  return data;
}

const prefs = () => ({ personas: Number($("nv-personas").value), rapido: $("nv-rapido").checked });
const PREFS_KEY = "nevera-prefs";
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    if (p.personas) $("nv-personas").value = String(p.personas);
    $("nv-rapido").checked = p.rapido === true;
  } catch { /* sin almacenamiento */ }
}
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs())); } catch { /* sin almacenamiento */ } }

function stickIfChanged() {
  const key = ingredients.join("|");
  if (key === stuck) return;
  stuck = key;
  scene("stick", ingredients);
}
async function showResults(list) {
  recipes = list; index = 0;
  scene("serve", recipes);
  await queue;
  setStep("results"); renderCard();
}
function backToIntro() {
  recipes = []; ingredients = []; stuck = ""; isExample = false;
  scene("reset"); setStep("intro"); caption("");
}

async function fromPhoto(file) {
  if (!file || busy) return;
  if (!/^image\//.test(file.type)) { toast("Ese archivo no es una imagen. Elige una foto JPEG, PNG o WebP."); return; }
  let url;
  try { url = await shrink(file); } catch { toast("No se ha podido abrir esa foto. Prueba con otra."); return; }
  busy = true; isExample = false; toast(""); closeSheet();
  setStep("busy"); caption("Abriendo tu nevera…");
  scene("showPhoto", url).then(() => { if (busy) caption("Mirando lo que tienes…", true); });
  scene("think");
  try {
    const data = await ask({ imagen: url, ...prefs() });
    if (data.esComida === false || !data.ingredientes?.length || !data.recetas?.length) {
      toast("No veo comida en esta foto. Prueba con la puerta abierta y buena luz, o escribe tus ingredientes.");
      backToIntro(); return;
    }
    ingredients = data.ingredientes;
    await queue;
    caption(`¡${ingredients.length} ingredientes!`);
    stickIfChanged();
    await showResults(data.recetas);
  } catch (e) {
    toast(e.message); backToIntro();
  } finally {
    busy = false; clearInterval(phraseTimer);
  }
}

async function fromList(evitar = []) {
  if (busy || !ingredients.length) return;
  closeSheet();
  const before = recipes, beforeStep = root.dataset.step;
  busy = true; isExample = false; toast("");
  setStep("busy"); caption(evitar.length ? "Pensando otras 3 ideas…" : "Pensando recetas…", true);
  scene("think"); stickIfChanged();
  try {
    const data = await ask({ ingredientes: ingredients, evitar, ...prefs() });
    if (!data.recetas?.length) throw new Error("No se me ocurren recetas con esa lista. Añade algún ingrediente más.");
    await showResults(data.recetas);
  } catch (e) {
    toast(e.message);
    if (before.length && beforeStep === "results") await showResults(before);
    else { setStep("intro"); scene("reset"); stuck = ""; }
  } finally {
    busy = false; clearInterval(phraseTimer);
  }
}

async function demo() {
  if (busy) return;
  busy = true; isExample = true; closeSheet(); toast("");
  setStep("busy"); caption("Una nevera cualquiera…");
  ingredients = [...EXAMPLE.ingredientes];
  scene("think"); stickIfChanged();
  await queue;
  await new Promise((r) => setTimeout(r, 400));
  await showResults(EXAMPLE.recetas);
  busy = false;
}

// ---------- Eventos ----------
if (root) {
  root.classList.toggle("is-offline", !API);
  for (const id of ["nv-camera", "nv-gallery"]) $(id).addEventListener("change", (e) => { fromPhoto(e.target.files[0]); e.target.value = ""; });
  $("nv-demo").addEventListener("click", demo);
  $("nv-type").addEventListener("click", () => { ingredients = []; ingredientsSheet(true); });
  $("nv-again").addEventListener("click", () => { if (!busy) backToIntro(); });
  $("nv-ings").addEventListener("click", () => ingredientsSheet());
  $("nv-prev").addEventListener("click", () => go(index - 1));
  $("nv-next").addEventListener("click", () => go(index + 1));
  $("nv-open").addEventListener("click", () => recipeSheet(index));
  $("nv-more").addEventListener("click", () => {
    if (isExample) { toast("Esto es un ejemplo. Haz una foto de tu nevera para ver tus recetas."); return; }
    fromList(recipes.map((r) => r.nombre));
  });

  const sheet = $("nv-sheet");
  sheet.addEventListener("click", async (e) => {
    if (e.target.closest("[data-close]")) { closeSheet(); return; }
    const rm = e.target.closest("[data-remove]");
    if (rm) { ingredients = ingredients.filter((x) => x !== rm.dataset.remove); renderChips(); return; }
    if (e.target.closest("#nv-search")) { fromList(); return; }
    const copy = e.target.closest("[data-copy]");
    if (copy) {
      try { await navigator.clipboard.writeText(recipeText(recipes[Number(copy.dataset.copy)])); copy.textContent = "¡Copiada!"; }
      catch { copy.textContent = "No se ha podido copiar"; }
      setTimeout(() => { copy.textContent = "Copiar receta"; }, 2000);
    }
  });
  sheet.addEventListener("submit", (e) => {
    if (e.target.id !== "nv-add") return;
    e.preventDefault();
    const input = $("nv-new"); addIngredients(input.value); input.value = ""; input.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sheetOpen()) closeSheet();
    if (root.dataset.step === "results" && !sheetOpen() && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    }
  });

  // Deslizar entre recetas y tocar un plato
  let sx = 0, sy = 0, st = 0, tracking = false;
  root.addEventListener("pointerdown", (e) => {
    tracking = root.dataset.step === "results" && !sheetOpen() && !e.target.closest("button, a, label, input, select, .nv-sheet");
    sx = e.clientX; sy = e.clientY; st = performance.now();
  });
  root.addEventListener("pointerup", (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) { go(index + (dx < 0 ? 1 : -1)); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && performance.now() - st < 400 && fridge && !e.target.closest(".nv-card")) {
      const i = fridge.pick(e.clientX, e.clientY);
      if (i >= 0) { if (i !== index) go(i); else recipeSheet(i); }
    }
  });

  loadPrefs();
  $("nv-personas").addEventListener("change", savePrefs);
  $("nv-rapido").addEventListener("change", savePrefs);

  // Arrastrar o pegar una foto en la pantalla inicial
  const canDrop = () => root.dataset.step === "intro" && !busy && API;
  root.addEventListener("dragover", (e) => { if (canDrop()) { e.preventDefault(); root.classList.add("is-drag"); } });
  root.addEventListener("dragleave", () => root.classList.remove("is-drag"));
  root.addEventListener("drop", (e) => { root.classList.remove("is-drag"); if (!canDrop()) return; e.preventDefault(); fromPhoto(e.dataTransfer.files[0]); });
  document.addEventListener("paste", (e) => {
    if (!canDrop()) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (file) fromPhoto(file);
  });

  load3D();
}
