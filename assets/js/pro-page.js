// Página /pro.html: activar o quitar la licencia Pro en este navegador.
import { activate, deactivate, proStatus } from "./pro.js";

const CFG = new URL("../../data/pro.json", import.meta.url);
const $ = (id) => document.getElementById(id);
const form = $("pro-form"), input = $("pro-key"), off = $("pro-off"), status = $("pro-status");

function say(text, kind) {
  status.hidden = false;
  status.dataset.kind = kind;
  status.textContent = text;
}

async function refresh() {
  const st = await proStatus(CFG);
  off.hidden = !st.active;
  if (st.active) say("Pro está activado en este navegador. ¡Gracias por apoyar las herramientas!", "ok");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!input.value.trim()) return;
  if (await activate(input.value, CFG)) {
    input.value = "";
    await refresh();
  } else {
    say("Esa clave no es válida. Cópiala entera, empieza por «HL1.». Si el problema sigue, escríbenos desde la página de contacto.", "error");
  }
});
off.addEventListener("click", async () => {
  deactivate();
  status.hidden = true;
  await refresh();
});
refresh();
