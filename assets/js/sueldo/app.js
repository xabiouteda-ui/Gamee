// Interfaz de la calculadora de sueldo neto (/calculadora-sueldo-neto/).
import { sueldoNeto } from "./core.js";

const $ = (id) => document.getElementById(id);
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2, useGrouping: "always" });
const eur0 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });
const pct = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
const li = (label, value, cls = "") => `<li class="${cls}"><span>${label}</span><span>${value}</span></li>`;
const note = (html, warn = false) => `<p class="itp-note${warn ? " warn" : ""}">${html}</p>`;
const int = (id, max = 99) => Math.min(max, Math.max(0, Math.trunc(Number($(id).value) || 0)));

if ($("sn-form")) {
  const pagas = () => Number(document.querySelector('input[name="sn-pagas"]:checked')?.value) || 12;

  // Datos de la URL (?bruto=30000&pagas=14…): enlaces compartidos y páginas por salario.
  const q = new URLSearchParams(location.search);
  if (q.has("bruto")) $("sn-bruto").value = Number(q.get("bruto")) || $("sn-bruto").value;
  if (q.get("periodo") === "mensual") $("sn-periodo").value = "mensual";
  if (q.get("pagas") === "14" || q.get("pagas") === "12") document.querySelector(`input[name="sn-pagas"][value="${q.get("pagas")}"]`).checked = true;
  for (const [k, id] of [["edad", "sn-edad"], ["hijos", "sn-hijos"], ["hijos3", "sn-hijos3"], ["situacion", "sn-situacion"], ["contrato", "sn-contrato"]]) if (q.has(k)) $(id).value = q.get(k);

  function datos() {
    const n = int("sn-hijos", 12), n3 = Math.min(n, int("sn-hijos3", 12));
    const situacion = Number($("sn-situacion").value);
    const entero = situacion === 1 || !$("sn-mitad").checked;
    const hijos = Array.from({ length: n }, (_, i) => ({ menor3: i >= n - n3, entero }));
    const bruto = Math.max(0, Number($("sn-bruto").value) || 0) * ($("sn-periodo").value === "mensual" ? pagas() : 1);
    return {
      bruto, pagas: pagas(), situacion, hijos, edad: int("sn-edad"), contrato: $("sn-contrato").value,
      discapacidad: $("sn-disc").value, movilidadReducida: $("sn-movred").checked, movilidadGeografica: $("sn-movgeo").checked,
      ascendientes65: int("sn-asc65", 4), ascendientes75: int("sn-asc75", 4), prestamoVivienda: $("sn-vivienda").checked, ceutaMelilla: $("sn-ceuta").checked,
    };
  }

  function render() {
    const d = datos();
    $("sn-mitad-wrap").hidden = !(d.hijos.length && d.situacion !== 1);
    $("sn-head-pagas").textContent = `${d.pagas} pagas`;
    if (!d.bruto) {
      $("sn-mes").textContent = "—"; $("sn-extra").textContent = ""; $("sn-lines").innerHTML = "";
      $("sn-notes").innerHTML = note("Escribe tu sueldo bruto para calcular.", true);
      return;
    }
    const r = sueldoNeto(d);
    $("sn-mes").textContent = eur.format(r.mensual.normal);
    $("sn-total-label").textContent = d.pagas === 14 ? "Cobras al mes (12 meses)" : "Cobras al mes";
    $("sn-extra").textContent = d.pagas === 14 ? `+ 2 pagas extra de ${eur.format(r.mensual.extra)}` : "";
    const w = (x) => `${Math.max(0, (x / r.bruto) * 100).toFixed(2)}%`;
    const [bn, bi, bs] = $("sn-bar").children;
    bn.style.width = w(r.netoAnual); bi.style.width = w(r.irpf.importe); bs.style.width = w(r.ss.trabajador.total);
    $("sn-l-neto").textContent = eur0.format(r.netoAnual);
    $("sn-l-irpf").textContent = eur0.format(r.irpf.importe);
    $("sn-l-ss").textContent = eur0.format(r.ss.trabajador.total);
    $("sn-bar").setAttribute("aria-label", `De ${eur0.format(r.bruto)} brutos: ${eur0.format(r.netoAnual)} para ti, ${eur0.format(r.irpf.importe)} de IRPF y ${eur0.format(r.ss.trabajador.total)} de Seguridad Social`);

    const ss = r.ss.trabajador;
    let lines = li("Sueldo bruto anual", eur.format(r.bruto));
    if (d.pagas === 14) lines += li("Bruto de cada paga", eur.format(r.brutoMensual), "dim");
    lines += li(`Seguridad Social (${pct((ss.total / r.bruto) * 100)})`, "−" + eur.format(ss.total));
    lines += li(`Retención de IRPF (${pct(r.irpf.tipo)})`, "−" + eur.format(r.irpf.importe));
    lines += li("Sueldo neto anual", eur.format(r.netoAnual), "strong");
    lines += li("Lo que le cuestas a la empresa", eur.format(r.costeEmpresa), "dim");
    $("sn-lines").innerHTML = lines;

    let notes = "";
    if (r.irpf.exento) notes += note(`Con este sueldo y tu situación familiar <strong>no te tienen que retener IRPF</strong> (estás por debajo del mínimo exento).`);
    for (const a of r.irpf.avisos || []) notes += note(a, true);
    if (r.ss.topada) notes += note(`Tu sueldo supera la base máxima de cotización (5.101,20 € al mes): la Seguridad Social se calcula sobre ese tope, más la <strong>cotización de solidaridad</strong> (${eur.format(ss.solidaridad)} al año) sobre lo que lo supera.`);
    notes += note(`Desglose de la Seguridad Social: contingencias comunes ${eur.format(ss.contingencias)}, desempleo ${eur.format(ss.desempleo)}, MEI ${eur.format(ss.mei)} y formación ${eur.format(ss.formacion)} al año.`);
    notes += note(`Es lo que te retiene la empresa cada mes. En la declaración de la Renta se aplica la escala de tu comunidad y puede salirte a devolver o a pagar. País Vasco y Navarra tienen sus propias tablas.`);
    $("sn-notes").innerHTML = notes;
  }

  $("sn-form").addEventListener("input", render);
  $("sn-form").addEventListener("change", render);
  $("sn-form").addEventListener("submit", (e) => e.preventDefault());
  $("sn-copy").addEventListener("click", async () => {
    const d = datos();
    const p = new URLSearchParams({ bruto: String(d.bruto), pagas: String(d.pagas) });
    if (d.edad !== 30) p.set("edad", d.edad);
    if (d.hijos.length) { p.set("hijos", d.hijos.length); p.set("hijos3", d.hijos.filter((h) => h.menor3).length); }
    if (d.situacion !== 3) p.set("situacion", d.situacion);
    if (d.contrato !== "indefinido") p.set("contrato", d.contrato);
    const url = `${location.origin}${location.pathname}?${p}`;
    try { await navigator.clipboard.writeText(url); $("sn-copy").textContent = "Enlace copiado"; } catch { $("sn-copy").textContent = url; }
    setTimeout(() => { $("sn-copy").textContent = "Copiar enlace con estos datos"; }, 2500);
  });
  render();
}
