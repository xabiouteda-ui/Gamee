// Página del widget: genera el código para copiar según las opciones.
const $ = (id) => document.getElementById(id);
const code = $("widget-code"), tema = $("w-tema"), preview = $("widget-preview");

export function embedCode(widgetUrl, pageUrl, theme = "") {
  const src = widgetUrl + (theme ? `?tema=${encodeURIComponent(theme)}` : "");
  return `<iframe src="${src}" title="Precio de la luz hoy" width="100%" height="330" style="border:0;max-width:420px" loading="lazy"></iframe>
<p style="font-size:12px;margin:4px 0 0">Fuente: <a href="${pageUrl}">precio de la luz hoy</a> en Herramientas Libres</p>`;
}

function update() {
  code.value = embedCode(code.dataset.widget, code.dataset.page, tema.value);
  const u = new URL(preview.getAttribute("src"), location.href);
  if (tema.value) u.searchParams.set("tema", tema.value); else u.searchParams.delete("tema");
  if (preview.src !== u.href) preview.src = u.href;
}

if (code) {
  tema.addEventListener("change", update);
  update();
  $("widget-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(code.value); }
    catch { code.select(); document.execCommand("copy"); }
    $("widget-copied").textContent = "¡Copiado! Pégalo en el HTML de tu página.";
  });
}
