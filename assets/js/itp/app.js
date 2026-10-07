// Interfaz de la calculadora del ITP de vehículos usados (/calculadora-itp-coche/).
import { calcular, COEF } from "./core.js";

const $ = (id) => document.getElementById(id);
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const pct = (n) => String(n).replace(".", ",") + " %";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FIELDS = { ccaa: "itp-ccaa", tipoVeh: "itp-tipo", fechaMatric: "itp-matric", fechaVenta: "itp-venta", precio: "itp-precio", valorTablas: "itp-tablas", cc: "itp-cc", cvf: "itp-cvf", etiqueta: "itp-etiqueta", historico: "itp-historico" };

if ($("itp-form")) {
  const hoy = new Date();
  if (!$("itp-venta").value) $("itp-venta").value = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

  const li = (label, value, cls = "") => `<li class="${cls}"><span>${label}</span><span>${value}</span></li>`;
  const note = (html, warn = false) => `<p class="itp-note${warn ? " warn" : ""}">${html}</p>`;

  function render() {
    const d = {};
    for (const [k, id] of Object.entries(FIELDS)) { const el = $(id); d[k] = el.type === "checkbox" ? el.checked : el.value; }
    let r = d.fechaMatric ? calcular(d) : { error: "Introduce la fecha de primera matriculación para calcular." };
    $("itp-slip-ccaa").textContent = $("itp-ccaa").selectedOptions[0].text;
    document.querySelectorAll(".itp-coef").forEach((el) => el.classList.remove("on"));
    if (r.error || r.foral) {
      $("itp-amount").textContent = "—"; $("itp-badge").innerHTML = ""; $("itp-lines").innerHTML = "";
      $("itp-notes").innerHTML = note(r.error || `${esc(r.nombre)} tiene régimen foral propio y no está incluido en esta calculadora. Consulta su hacienda foral.`, true);
      return;
    }
    document.querySelector(`.itp-coef[data-i="${Math.min(r.edadCompletos, 12)}"]`)?.classList.add("on");
    $("itp-amount").textContent = eur.format(r.cuota);
    let lines = "", notes = "";
    if (r.regla.tipo === "fija") {
      $("itp-badge").innerHTML = '<span class="itp-pill fija">Cuota fija</span>';
      lines += li("Antigüedad", r.edadExacta.toFixed(1).replace(".", ",") + " años");
      lines += li("Cilindrada", `${Number($("itp-cc").value) || 0} cc`);
      lines += li(`Cuota fija de ${esc(r.nombre)}`, eur.format(r.regla.amount), "strong");
    } else {
      $("itp-badge").innerHTML = `<span class="itp-pill">Tipo ${pct(r.regla.rate)}</span>`;
      lines += li("Antigüedad", `${r.edadCompletos} ${r.edadCompletos === 1 ? "año completo" : "años completos"}`);
      if (r.valorFiscal !== null) lines += li(`Valor de tablas × ${r.coef} %`, eur.format(r.valorFiscal), r.usaTablas ? "" : "dim");
      lines += li("Precio de compra", eur.format(r.precio), r.usaTablas ? "dim" : "");
      lines += li("Base imponible", eur.format(r.base), "strong");
      lines += li(`Tipo de ${esc(r.nombre)}`, pct(r.regla.rate));
      if (r.bonif) lines += li("Bonificación", `−${r.bonif * 100} %`);
      lines += li("Cuota", eur.format(r.cuota), "strong");
    }
    $("itp-lines").innerHTML = lines;
    if (r.regla.sinTramite) notes += note(`<strong>No tienes que pagar ITP.</strong> ${esc(r.regla.nota)}`);
    else if (r.regla.nota) notes += note(esc(r.regla.nota), /contrastar|comprueba/.test(r.regla.nota));
    if (r.regla.tipo === "pct" && r.usaTablas) notes += note(`<strong>Hacienda valora tu coche por encima del precio.</strong> Tributas por ${eur.format(r.valorFiscal)}, no por los ${eur.format(r.precio)} que pagas.`, true);
    if (r.regla.tipo === "pct" && r.valorFiscal === null) notes += note("<strong>Falta el valor de tablas.</strong> Sin él calculamos sobre el precio de compra. Si Hacienda valora el coche por encima, pagarás más.", true);
    $("itp-notes").innerHTML = notes;
  }

  // Tabla de porcentajes por antigüedad (en la página, debajo de la herramienta).
  const grid = $("itp-coef-grid");
  if (grid && !grid.children.length) {
    const labels = ["Hasta 1 año", "Más de 1", "Más de 2", "Más de 3", "Más de 4", "Más de 5", "Más de 6", "Más de 7", "Más de 8", "Más de 9", "Más de 10", "Más de 11", "Más de 12"];
    grid.innerHTML = COEF.map((c, i) => `<div class="itp-coef" data-i="${i}"><span>${labels[i]}</span><strong>${c} %</strong></div>`).join("");
  }

  for (const id of Object.values(FIELDS)) { $(id).addEventListener("input", render); $(id).addEventListener("change", render); }
  $("itp-form").addEventListener("submit", (e) => e.preventDefault());
  $("itp-clear").addEventListener("click", () => {
    for (const id of ["itp-precio", "itp-tablas", "itp-cc", "itp-cvf", "itp-matric"]) $(id).value = "";
    $("itp-etiqueta").value = "otra"; $("itp-historico").checked = false;
    $("itp-sample-note").textContent = "Introduce los datos de tu vehículo.";
    $("itp-matric").focus();
    render();
  });
  render();
}
