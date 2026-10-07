// Páginas del ITP por comunidad autónoma (/calculadora-itp-coche/<comunidad>.html).
// Todo el contenido variable sale de assets/js/itp/core.js: las reglas, los ejemplos calculados y la posición
// frente al resto de comunidades. Así cada página tiene datos propios y se actualiza sola si cambia la norma.
import { calcular, REGLAS, COEF } from "../assets/js/itp/core.js";

export const ITP_SLUGS = {
  andalucia: "andalucia", aragon: "aragon", asturias: "asturias", baleares: "baleares", canarias: "canarias",
  cantabria: "cantabria", clm: "castilla-la-mancha", cyl: "castilla-y-leon", cataluna: "cataluna",
  valencia: "comunidad-valenciana", extremadura: "extremadura", galicia: "galicia", madrid: "madrid",
  murcia: "murcia", rioja: "la-rioja", ceuta: "ceuta", melilla: "melilla",
};
// Forma corta para títulos y frases ("en Madrid", no "en Comunidad de Madrid").
const CORTO = { madrid: "Madrid", murcia: "Murcia", valencia: "la Comunidad Valenciana", baleares: "Baleares" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eur = (n) => n.toFixed(n % 1 ? 2 : 0).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "\u00a0€";
const pct = (n) => String(n).replace(".", ",") + "\u00a0%";
const VENTA = "2026-10-07";
const matric = (anios) => `${2026 - anios}-03-01`; // cumplidos antes de la fecha de venta

// Coche de ejemplo: gasolina 1.598 cc, 11 CVF, etiqueta C, 22.000 € nuevo en las tablas de Hacienda.
const COCHE = { tipoVeh: "turismo", cc: 1598, cvf: 11, etiqueta: "otra", historico: false, valorTablas: 22000, fechaVenta: VENTA };
const EJEMPLOS = [
  { anios: 2, precio: 16000, txt: "Seminuevo de 2 años" },
  { anios: 6, precio: 9500, txt: "Coche de 6 años" },
  { anios: 11, precio: 4500, txt: "Coche de 11 años" },
  { anios: 16, precio: 2000, txt: "Coche de 16 años" },
];
const calc = (ccaa, extra) => calcular({ ...COCHE, ccaa, ...extra });

// Reglas especiales: se prueban muchos vehículos y se recogen las notas distintas que devuelve la norma.
function reglasEspeciales(key) {
  const fn = REGLAS[key].fn, seen = new Map();
  for (const tipoVeh of ["turismo", "moto", "ciclomotor"]) for (const cc of [49, 125, 600, 900, 1400, 1800, 2500])
    for (const cvf of [9, 17]) for (const etiqueta of ["cero", "eco", "otra"]) for (const edad of [2, 4, 7, 11, 13, 16])
      for (const base of [8000, 25000]) {
        const r = fn({ tipoVeh, cc, cvf, etiqueta, historico: false, edad, base });
        if (r.nota && !seen.has(r.nota)) seen.set(r.nota, r);
      }
  return [...seen.values()];
}

function ranking(extra) {
  const filas = Object.keys(ITP_SLUGS).map((k) => ({ k, cuota: calc(k, extra).cuota }));
  filas.sort((a, b) => a.cuota - b.cuota);
  return filas;
}

export function itpRegionPages(owner) {
  return Object.entries(ITP_SLUGS).map(([key, slug]) => {
    const R = REGLAS[key], nombre = R.nombre, corto = CORTO[key] || nombre;
    const general = R.fn({ tipoVeh: "turismo", cc: 1598, cvf: 11, etiqueta: "otra", historico: false, edad: 3, base: 15000 });
    const tipoGeneral = general.tipo === "pct" ? general.rate : null;
    const especiales = reglasEspeciales(key);
    const ej = EJEMPLOS.map((e) => ({ ...e, r: calc(key, { fechaMatric: matric(e.anios), precio: e.precio }) }));
    const rk = ranking({ fechaMatric: matric(6), precio: 9500 });
    const pos = rk.findIndex((f) => f.cuota === calc(key, { fechaMatric: matric(6), precio: 9500 }).cuota) + 1;
    const mid = ej[1].r;
    const barata = rk[0], cara = rk[rk.length - 1], Cap = (t) => t[0].toUpperCase() + t.slice(1);
    const empates = rk.filter((f) => f.cuota === mid.cuota).length;
    const lista = (c) => { const n = rk.filter((f) => f.cuota === c).map((f) => esc(REGLAS[f.k].nombre)); return n.length > 1 ? n.slice(0, -1).join(", ") + " y " + n.at(-1) : n[0]; };
    const nB = rk.filter((f) => f.cuota === barata.cuota).length, nC = rk.filter((f) => f.cuota === cara.cuota).length;
    const txtB = nB > 1 ? `las más baratas son ${lista(barata.cuota)} (${eur(barata.cuota)})` : `la más barata es ${lista(barata.cuota)} (${eur(barata.cuota)})`;
    const txtC = nC > 1 ? `las más caras son ${lista(cara.cuota)} (${eur(cara.cuota)})` : `la más cara es ${lista(cara.cuota)} (${eur(cara.cuota)})`;
    const comparativa = `Para el coche de 6 años comprado por ${eur(9500)}, ${esc(corto)} cobra ${eur(mid.cuota)}: ` + (
      mid.cuota === barata.cuota ? `es la comunidad más barata${empates > 1 ? ` (empatada con ${empates - 1} más)` : ""} de las ${rk.length} con régimen común; ${txtC}.`
      : mid.cuota === cara.cuota ? `es la más cara${empates > 1 ? ` (empatada con ${empates - 1} más)` : ""} de las ${rk.length} con régimen común; ${txtB}.`
      : `${pos <= rk.length / 2 ? "está entre las más baratas" : "está entre las más caras"} (puesto ${pos} de ${rk.length}, de más barata a más cara). ${Cap(txtB)} y ${txtC}.`
    ) + " Con tu coche puede cambiar: usa la calculadora de arriba con tus datos.";

    const filasEj = ej.map(({ txt, precio, anios, r }) => `<tr><td>${txt}</td><td>${eur(precio)}</td><td>${eur(r.valorFiscal)} <span class="muted small">(${COEF[Math.min(anios, 12)]}\u00a0%)</span></td><td><strong>${eur(r.cuota)}</strong><br>${r.regla.tipo === "fija" ? '<span class="muted small">cuota fija</span>' : `<span class="muted small">al ${pct(r.regla.rate)}${r.bonif ? " −50\u00a0%" : ""}</span>`}</td></tr>`).join("");
    const listaEsp = especiales.length
      ? `<ul>${especiales.map((r) => `<li>${esc(r.nota)}</li>`).join("")}</ul>`
      : `<p>${esc(nombre)} no tiene tipos reducidos, incrementados ni cuotas fijas para vehículos: todos pagan el ${pct(tipoGeneral)} de la base, sea cual sea su antigüedad, potencia o etiqueta.</p>`;

    const resumen = tipoGeneral !== null
      ? `En ${esc(corto)} el ITP de un coche de segunda mano es, con carácter general, el <strong>${pct(tipoGeneral)}</strong> del mayor de dos valores: lo que pagas por él o el valor que le da Hacienda en sus tablas.${especiales.length ? ` Hay ${especiales.length === 1 ? "una excepción" : `${especiales.length} excepciones`} que te pueden ahorrar dinero (o encarecerlo), y las tienes más abajo.` : ""}`
      : `En ${esc(corto)} el ITP de un coche de segunda mano depende de la antigüedad y el valor del vehículo.`;

    const body = `<section class="hero">
  <h1>ITP de un coche de segunda mano en ${esc(corto)} (2026)</h1>
  <p class="lead">${resumen}</p>
</section>

{{tool}}

<article class="content">
  <h2>Cuánto se paga en ${esc(corto)}: ejemplos calculados</h2>
  <p>Un coche de gasolina de 1.598 cc y 11 caballos fiscales que nuevo vale 22.000 € en las tablas de Hacienda, comprado a un particular el 7 de octubre de 2026. Se paga por el mayor entre el precio de compra y el valor de Hacienda:</p>
  <div class="table-wrap">
    <table>
      <thead><tr><th scope="col">Vehículo</th><th scope="col">Precio de compra</th><th scope="col">Valor de Hacienda</th><th scope="col">ITP en ${esc(corto)}</th></tr></thead>
      <tbody>${filasEj}</tbody>
    </table>
  </div>
  <p>${comparativa}</p>

  <h2>Reglas especiales del ITP de vehículos en ${esc(corto)}</h2>
  ${listaEsp}

  {{ad:content}}

  <h2>Cómo se calcula</h2>
  <ol>
    <li><strong>Valor de Hacienda:</strong> el precio del modelo nuevo en las tablas de la Orden HAC/1501/2025 por el porcentaje de su antigüedad (100 % el primer año y 10 % a partir de los 12 años).</li>
    <li><strong>Base:</strong> el mayor entre ese valor y el precio que pagas.</li>
    <li><strong>Cuota:</strong> la base por el tipo de ${esc(corto)}${tipoGeneral !== null ? ` (${pct(tipoGeneral)} en general)` : ""}, o la cuota fija si tu vehículo entra en una de las excepciones.</li>
  </ol>
  <p>Paga siempre el comprador y manda la comunidad donde tiene su residencia fiscal, no la del vendedor ni la del coche. Se presenta en la Hacienda autonómica, normalmente en el plazo de un mes o 30 días hábiles desde la compra, y el justificante te lo pide Tráfico para cambiar la titularidad.</p>

  <h2>Preguntas frecuentes</h2>
  <details>
    <summary>¿Cuánto es el ITP de un coche en ${esc(corto)} en 2026?</summary>
    <div><p>${tipoGeneral !== null ? `El tipo general es el ${pct(tipoGeneral)} de la base. ` : ""}Por ejemplo, un coche de 6 años comprado por 9.500 € paga ${eur(mid.cuota)} y uno de 16 años comprado por 2.000 € paga ${eur(ej[3].r.cuota)}.</p></div>
  </details>
  <details>
    <summary>¿Y si compro el coche más barato de lo que dice Hacienda?</summary>
    <div><p>Pagas por el valor de Hacienda. En el ejemplo de 2 años, aunque pagues ${eur(ej[0].precio)}, la base es ${eur(ej[0].r.base)}${ej[0].r.usaTablas ? " porque el valor de tablas es mayor" : ""}. Si pagas más que el valor de tablas, pagas por lo que has pagado.</p></div>
  </details>
  <details>
    <summary>¿Hay que pagar ITP si compro a un concesionario?</summary>
    <div><p>No. Si el vendedor es un profesional que te cobra IVA, no hay ITP. El impuesto es para compras entre particulares.</p></div>
  </details>

  <p class="muted small">Fuentes: Orden HAC/1501/2025 (Anexo IV, coeficientes por antigüedad) y «Tributación Autonómica. Medidas 2026» del Ministerio de Hacienda. Revisado en octubre de 2026 por <a href="{{root}}sobre-nosotros.html">${esc(owner)}</a>. Es una estimación: confirma el importe en la Hacienda de ${esc(corto)} antes de pagar.</p>
</article>
`;
    const title = `ITP coche segunda mano en ${corto} 2026: calculadora`;
    return {
      lang: "es", file: `calculadora-itp-coche/${slug}.html`, slug: `calculadora-itp-coche/${slug}.html`,
      tool: "itp", itpCcaa: key, itpNombre: nombre, faqSchema: true,
      appName: `Calculadora del ITP de coches en ${corto}`,
      nav: `ITP en ${corto}`,
      title: title.length <= 65 ? title : `ITP coche usado en ${corto} 2026: calculadora`,
      description: `ITP de un coche usado en ${corto} en 2026${tipoGeneral !== null ? ` (${pct(tipoGeneral)} en general)` : ""}: ejemplos calculados, excepciones y calculadora gratis con las tablas de Hacienda.`,
      generated: "scripts/itp-pages.mjs",
      body,
    };
  });
}
