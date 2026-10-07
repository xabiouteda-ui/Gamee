// «¿Qué cocino con lo que tengo?»: foto de la nevera → ingredientes editables → 3 recetas.
// La foto se reduce y se convierte a JPEG en el navegador (sin datos EXIF) y se envía al intermediario
// (workers/nevera/worker.js), que llama a Gemini. Editar la lista solo envía texto.

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
      nombre: "Calabacín relleno gratinado",
      descripcion: "Cremoso, con jamón y una costra de queso que cruje.",
      minutos: 30, dificultad: "fácil",
      usa: ["calabacín", "cebolla", "tomate", "jamón serrano", "queso rallado"], falta: [],
      pasos: ["Parte 2 calabacines a lo largo y vacíalos con una cuchara.", "Sofríe la cebolla picada 5 minutos y añade la pulpa del calabacín y 1 tomate rallado.", "Incorpora 60 g de jamón en taquitos y cocina 3 minutos más.", "Rellena los calabacines, cubre con queso rallado.", "Hornea 15 minutos a 200 °C hasta que se dore."],
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

let ingredients = [];
let lastList = "";
let busy = false;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

function status(text, isError = false) {
  const el = $("nv-status");
  el.textContent = text;
  el.classList.toggle("is-error", isError);
}

function showBoard(photoUrl) {
  $("nv-start").hidden = true;
  $("nv-board").hidden = false;
  const img = $("nv-photo");
  if (photoUrl) { img.src = photoUrl; img.hidden = false; } else { img.hidden = true; img.removeAttribute("src"); }
}

function renderMagnets(animate = false) {
  const ul = $("nv-magnets");
  ul.classList.toggle("nv-drop", animate);
  ul.innerHTML = ingredients.map((name, i) => {
    const h = hash(name);
    return `<li class="nv-magnet" data-tone="${Math.abs(h) % 5}" style="--r:${(h % 5) * 0.6}deg;--i:${i}"><span>${esc(name)}</span><button type="button" aria-label="Quitar ${esc(name)}" data-remove="${esc(name)}">×</button></li>`;
  }).join("");
  if (!ingredients.length) ul.innerHTML = '<li class="nv-empty">Todavía no hay ingredientes. Añade el primero aquí abajo.</li>';
  $("nv-refresh").hidden = !ingredients.length || ingredients.join("|") === lastList;
}

function renderRecipes(recetas) {
  const box = $("nv-recipes");
  if (!recetas?.length) { box.innerHTML = ""; return; }
  const have = new Set(ingredients);
  box.innerHTML = `<h2 class="nv-recipes-title">Puedes cocinar</h2>` + recetas.map((r, i) => `
    <article class="nv-recipe">
      <header>
        <h3>${esc(r.nombre)}</h3>
        <p class="nv-meta"><span>${r.minutos} min</span><span>Dificultad ${esc(r.dificultad)}</span></p>
      </header>
      <p class="nv-desc">${esc(r.descripcion)}</p>
      <p class="nv-uses"><strong>Usas</strong> ${r.usa.map((u) => `<span class="nv-tag${have.has(u) ? "" : " off"}">${esc(u)}</span>`).join(" ")}</p>
      <p class="nv-uses">${r.falta.length ? `<strong>Te falta</strong> ${r.falta.map((f) => `<span class="nv-tag miss">${esc(f)}</span>`).join(" ")}` : '<span class="nv-ok">No te falta nada</span>'}</p>
      <details${i === 0 ? " open" : ""}>
        <summary>Cómo se hace</summary>
        <ol>${r.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
      </details>
    </article>`).join("");
}

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

async function fromPhoto(file) {
  if (!file || busy) return;
  if (!/^image\//.test(file.type)) { status("Ese archivo no es una imagen. Elige una foto JPEG, PNG o WebP.", true); return; }
  busy = true;
  document.querySelector(".nv").classList.add("is-busy");
  let dataUrl;
  try {
    dataUrl = await shrink(file);
  } catch {
    busy = false; document.querySelector(".nv").classList.remove("is-busy");
    status("No se ha podido abrir esa foto. Prueba con otra.", true); return;
  }
  showBoard(dataUrl);
  ingredients = []; renderMagnets(); renderRecipes([]);
  $("nv-board-title").textContent = "Mirando tu nevera…";
  status("Reconociendo ingredientes y pensando recetas. Tarda unos segundos.");
  try {
    const data = await ask({ imagen: dataUrl, ...prefs() });
    if (data.esComida === false || !data.ingredientes.length) {
      $("nv-board-title").textContent = "No veo comida en esta foto";
      status("Prueba con la puerta de la nevera abierta y buena luz, o escribe tus ingredientes.", true);
    } else {
      ingredients = data.ingredientes; lastList = ingredients.join("|");
      $("nv-board-title").textContent = "Esto es lo que hay";
      renderMagnets(true); renderRecipes(data.recetas); status("");
    }
  } catch (e) {
    $("nv-board-title").textContent = "Esto es lo que hay";
    status(e.message, true);
  } finally {
    busy = false; document.querySelector(".nv").classList.remove("is-busy");
  }
}

async function fromList() {
  if (busy || !ingredients.length) return;
  busy = true;
  document.querySelector(".nv").classList.add("is-busy");
  status("Buscando recetas con tu lista…");
  try {
    const data = await ask({ ingredientes: ingredients, ...prefs() });
    lastList = ingredients.join("|"); renderMagnets(); renderRecipes(data.recetas); status("");
  } catch (e) {
    status(e.message, true);
  } finally {
    busy = false; document.querySelector(".nv").classList.remove("is-busy");
  }
}

function addIngredient(name) {
  const n = name.trim().toLowerCase().slice(0, 40);
  if (n && !ingredients.includes(n)) { ingredients.push(n); renderMagnets(); }
}

if ($("nevera")) {
  if (!API) document.querySelector(".nv").classList.add("is-offline");
  for (const id of ["nv-camera", "nv-gallery"]) $(id).addEventListener("change", (e) => { fromPhoto(e.target.files[0]); e.target.value = ""; });
  $("nv-demo").addEventListener("click", () => {
    showBoard(null);
    ingredients = [...EXAMPLE.ingredientes]; lastList = ingredients.join("|");
    $("nv-board-title").textContent = "Ejemplo: una nevera cualquiera";
    renderMagnets(true); renderRecipes(EXAMPLE.recetas);
    status("Esto es un ejemplo. Haz una foto de tu nevera para ver tus recetas.");
  });
  $("nv-type").addEventListener("click", () => {
    showBoard(null); ingredients = []; lastList = ""; renderMagnets(); renderRecipes([]);
    $("nv-board-title").textContent = "¿Qué tienes?"; status("");
    $("nv-new").focus();
  });
  $("nv-again").addEventListener("click", () => {
    $("nv-board").hidden = true; $("nv-start").hidden = false;
    ingredients = []; lastList = ""; renderRecipes([]); status("");
  });
  $("nv-magnets").addEventListener("click", (e) => {
    const name = e.target.closest("[data-remove]")?.dataset.remove;
    if (name) { ingredients = ingredients.filter((x) => x !== name); renderMagnets(); }
  });
  $("nv-add").addEventListener("submit", (e) => {
    e.preventDefault();
    $("nv-new").value.split(",").forEach(addIngredient);
    $("nv-new").value = "";
  });
  $("nv-refresh").addEventListener("click", fromList);
}
