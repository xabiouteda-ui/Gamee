// Páginas «X euros brutos en netos» (/calculadora-sueldo-neto/<bruto>-euros-brutos.html) y tablas de la calculadora.
// Todas las cifras salen de assets/js/sueldo/core.js (algoritmo de retenciones de la AEAT y cotizaciones de 2026),
// así que cada página tiene sus propios números y se rehace sola si cambia el cálculo.
import { sueldoNeto, ANIO, SS } from "../assets/js/sueldo/core.js";

export const SALARIOS = [15000, 16000, 17000, 18000, 19000, 20000, 21000, 22000, 23000, 24000, 25000, 26000, 27000, 28000, 30000,
  32000, 35000, 38000, 40000, 42000, 45000, 50000, 55000, 60000, 65000, 70000, 80000, 90000, 100000];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const eur = (n, dec = 2) => {
  const v = Math.abs(n) < 0.005 ? 0 : n;
  const [i, d] = v.toFixed(dec).split(".");
  return (v < 0 ? "−" : "") + miles(i.replace("-", "")) + (d ? "," + d : "") + " €";
};
const eur0 = (n) => eur(Math.round(n), 0);
const pct = (n) => n.toFixed(2).replace(".", ",") + " %";
const slugOf = (b) => `calculadora-sueldo-neto/${b}-euros-brutos.html`;
const BASE = { situacion: 3, hijos: [], edad: 30, contrato: "indefinido", discapacidad: "no", pagas: 12 };
const calc = (bruto, extra = {}) => sueldoNeto({ ...BASE, bruto, ...extra });
const hijos = (n, { menor3 = 0, entero = false } = {}) => Array.from({ length: n }, (_, i) => ({ menor3: i >= n - menor3, entero }));

// Tabla de la página principal: un salario por fila, con enlace a su página.
export function sueldoTabla(actual = null, root = "") {
  const rows = SALARIOS.map((b) => {
    const r12 = calc(b), r14 = calc(b, { pagas: 14 });
    const cell = b === actual ? miles(b) + " €" : `<a href="${root}${slugOf(b)}">${miles(b)} €</a>`;
    return `<tr${b === actual ? ' class="here"' : ""}><td>${cell}</td><td>${eur0(r12.netoAnual)}</td><td>${eur0(r12.mensual.normal)}</td><td>${eur0(r14.mensual.normal)}</td><td>${pct(r12.irpf.tipo)}</td></tr>`;
  }).join("\n");
  return `<div class="table-wrap"><table class="sn-table">
<caption class="sr-only">Sueldo neto en ${ANIO} según el bruto anual (soltero, sin hijos, contrato indefinido)</caption>
<thead><tr><th scope="col">Bruto al año</th><th scope="col">Neto al año</th><th scope="col">Neto al mes (12 pagas)</th><th scope="col">Neto al mes (14 pagas)</th><th scope="col">Retención IRPF</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>`;
}

// Tabla por bruto mensual (lo que suele preguntarse: «1.500 euros brutos al mes cuánto es neto»).
export function sueldoTablaMes() {
  const meses = [1221, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2200, 2400, 2500, 2800, 3000, 3500, 4000, 4500, 5000];
  const rows = meses.map((m) => {
    const r14 = calc(m * 14, { pagas: 14 }), r12 = calc(m * 12);
    return `<tr><td>${eur0(m)}</td><td>${eur0(r14.mensual.normal)}</td><td>${eur0(r14.mensual.extra)}</td><td>${eur0(r12.mensual.normal)}</td></tr>`;
  }).join("\n");
  return `<div class="table-wrap"><table class="sn-table">
<caption class="sr-only">Sueldo neto al mes en ${ANIO} según el bruto mensual</caption>
<thead><tr><th scope="col">Bruto al mes</th><th scope="col">Neto (14 pagas)</th><th scope="col">Paga extra neta</th><th scope="col">Neto (12 pagas)</th></tr></thead>
<tbody>
${rows}
</tbody></table></div>`;
}

function tramo(base) {
  const T = [[12450, 19], [20200, 24], [35200, 30], [60000, 37], [300000, 45], [Infinity, 47]];
  return T.find(([h]) => base <= h)[1];
}

export function sueldoPages(owner) {
  return SALARIOS.map((b, idx) => {
    const r = calc(b), r14 = calc(b, { pagas: 14 });
    const ss = r.ss.trabajador, emp = r.ss.empresa;
    const mesBruto12 = b / 12, mesBruto14 = b / 14;
    const sube = calc(b + 1000);
    const marginal = sube.netoAnual - r.netoAnual;
    const prev = SALARIOS[idx - 1], next = SALARIOS[idx + 1];

    const casos = [
      ["Soltero o casado con pareja que trabaja, sin hijos", {}],
      ["Con 1 hijo (a medias con el otro progenitor)", { hijos: hijos(1) }],
      ["Con 2 hijos, uno menor de 3 años (a medias)", { hijos: hijos(2, { menor3: 1 }) }],
      ["Familia monoparental con 1 hijo", { situacion: 1, hijos: hijos(1, { entero: true }) }],
      ["Casado, la pareja no trabaja", { situacion: 2 }],
      ["Casado, la pareja no trabaja, 2 hijos", { situacion: 2, hijos: hijos(2, { entero: true }) }],
      ["Contrato temporal de menos de un año", { contrato: "corto" }],
      ["Mayor de 65 años", { edad: 66 }],
    ].map(([txt, extra]) => { const x = calc(b, extra); return `<tr><td>${txt}</td><td>${pct(x.irpf.tipo)}</td><td>${eur(x.mensual.normal)}</td><td>${eur0(x.netoAnual)}</td></tr>`; }).join("\n");

    const vecinos = [prev, b, next].filter(Boolean).map((v) => {
      const x = calc(v);
      const cell = v === b ? `${miles(v)} €` : `<a href="{{root}}${slugOf(v)}">${miles(v)} €</a>`;
      return `<tr${v === b ? ' class="here"' : ""}><td>${cell}</td><td>${eur(x.mensual.normal)}</td><td>${pct(x.irpf.tipo)}</td></tr>`;
    }).join("\n");

    // Explicación que depende del tramo en el que cae este sueldo.
    let porque;
    if (r.irpf.exento) {
      porque = `<p>Con ${eur0(b)} brutos y sin hijos <strong>no te tienen que retener IRPF</strong>: la ley fija un mínimo por debajo del cual la empresa no retiene (15.876 € al año para un soltero sin hijos en ${ANIO}). Solo pagas la Seguridad Social, ${eur(ss.total)} al año.</p>`;
    } else if (b <= 35200 && r.irpf.reduccion > 0) {
      porque = `<p>Tu retención es baja porque a sueldos como el tuyo se les aplica la <strong>reducción por rendimientos del trabajo</strong> (${eur(r.irpf.reduccion)} en tu caso), que va desapareciendo a medida que el sueldo sube y se acaba hacia los 21.000 € brutos. Además, la retención no puede superar el 43 % de lo que ganas por encima del mínimo exento.</p>`;
    } else if (r.ss.topada) {
      porque = `<p>Tu sueldo mensual (${eur(mesBruto12)} contando las pagas extra) supera la <strong>base máxima de cotización</strong> de ${eur(SS.baseMax)}: la Seguridad Social normal se calcula solo hasta ese tope, y por lo que lo supera pagas la <strong>cotización de solidaridad</strong>, ${eur(ss.solidaridad)} al año en tu caso. Tu último euro tributa en el tramo del ${tramo(r.irpf.base)} % de la escala de retenciones.</p>`;
    } else {
      porque = `<p>Tu base para la retención es de ${eur(r.irpf.base)} (el bruto menos la Seguridad Social y 2.000 € de gastos que se restan siempre). Sobre ella se aplica la escala de retenciones, y a tu último euro le toca el tramo del <strong>${tramo(r.irpf.base)} %</strong>. Por eso el tipo medio que ves en la nómina (${pct(r.irpf.tipo)}) es bastante más bajo: los primeros euros tributan menos y los 5.550 € de mínimo personal no tributan.</p>`;
    }

    const body = `<section class="hero">
  <h1>${miles(b)} € brutos al año: cuánto es neto en ${ANIO}</h1>
  <p class="lead">Con un sueldo de <strong>${miles(b)} € brutos al año</strong> cobras <strong>${eur(r.mensual.normal)} netos al mes</strong> en 12 pagas, o ${eur(r14.mensual.normal)} al mes más dos pagas extra de ${eur(r14.mensual.extra)} si cobras en 14. Te retienen un ${pct(r.irpf.tipo)} de IRPF y pagas ${eur(ss.total)} al año de Seguridad Social.</p>
</section>

{{tool}}

<article class="content">
  <h2>Desglose de una nómina de ${miles(b)} € brutos</h2>
  <p>Para un trabajador soltero, sin hijos, de menos de 65 años y con contrato indefinido. Cambia tus datos en la calculadora de arriba para ver tu caso.</p>
  <div class="table-wrap"><table class="sn-table">
    <thead><tr><th scope="col">Concepto</th><th scope="col">Al año</th><th scope="col">Al mes (12 pagas)</th></tr></thead>
    <tbody>
      <tr><td>Sueldo bruto</td><td>${eur(b)}</td><td>${eur(mesBruto12)}</td></tr>
      <tr><td>Contingencias comunes (4,70 %)</td><td>${eur(-ss.contingencias)}</td><td>${eur(-ss.contingencias / 12)}</td></tr>
      <tr><td>Desempleo (1,55 %)</td><td>${eur(-ss.desempleo)}</td><td>${eur(-ss.desempleo / 12)}</td></tr>
      <tr><td>Mecanismo de equidad intergeneracional (0,15 %)</td><td>${eur(-ss.mei)}</td><td>${eur(-ss.mei / 12)}</td></tr>
      <tr><td>Formación profesional (0,10 %)</td><td>${eur(-ss.formacion)}</td><td>${eur(-ss.formacion / 12)}</td></tr>
${ss.solidaridad ? `      <tr><td>Cotización de solidaridad</td><td>${eur(-ss.solidaridad)}</td><td>${eur(-ss.solidaridad / 12)}</td></tr>\n` : ""}      <tr><td>Retención de IRPF (${pct(r.irpf.tipo)})</td><td>${eur(-r.irpf.importe)}</td><td>${eur(-r.irpf.importe / 12)}</td></tr>
      <tr class="here"><td>Sueldo neto</td><td>${eur(r.netoAnual)}</td><td>${eur(r.mensual.normal)}</td></tr>
    </tbody>
  </table></div>
  ${porque}

  <h2>¿12 o 14 pagas?</h2>
  <p>Al año cobras lo mismo: ${eur(r.netoAnual)} netos. Cambia el reparto. En <strong>12 pagas</strong> son ${eur(r.mensual.normal)} cada mes. En <strong>14 pagas</strong>, cada paga es de ${eur(mesBruto14)} brutos y cobras ${eur(r14.mensual.normal)} netos en los meses normales y ${eur(r14.mensual.extra)} en las dos pagas extra (en las extra no se descuenta Seguridad Social, porque ya va prorrateada en los otros meses).</p>

  {{ad:content}}

  <h2>Según tu situación familiar</h2>
  <p>La retención de IRPF baja si tienes hijos, si tu pareja no tiene ingresos o si eres mayor de 65 años. La Seguridad Social no cambia (salvo en los contratos temporales, que cotizan un 0,05 % más por desempleo).</p>
  <div class="table-wrap"><table class="sn-table">
    <thead><tr><th scope="col">Situación</th><th scope="col">Retención</th><th scope="col">Neto al mes (12 pagas)</th><th scope="col">Neto al año</th></tr></thead>
    <tbody>
${casos}
    </tbody>
  </table></div>

  <h2>Comparado con sueldos parecidos</h2>
  <p>Si te suben ${eur0(1000)} al año, te quedan ${eur(marginal)} netos más (${eur(marginal / 12)} al mes): el resto se va en IRPF y Seguridad Social.</p>
  <div class="table-wrap"><table class="sn-table">
    <thead><tr><th scope="col">Bruto al año</th><th scope="col">Neto al mes (12 pagas)</th><th scope="col">Retención</th></tr></thead>
    <tbody>
${vecinos}
    </tbody>
  </table></div>
  <p>Consulta otros sueldos en la <a href="{{root}}calculadora-sueldo-neto/#tabla">tabla completa de brutos a netos</a>.</p>

  <h2>Lo que le cuestas a la empresa</h2>
  <p>Además de tu bruto, la empresa paga su parte de la Seguridad Social: ${eur(emp.total)} al año (contingencias comunes, desempleo, FOGASA, formación, MEI${emp.solidaridad ? ", solidaridad" : ""} y una media del 1,5 % por accidentes de trabajo, que depende del sector). En total, un sueldo de ${miles(b)} € brutos le cuesta unos <strong>${eur0(r.costeEmpresa)}</strong> al año.</p>

  <h2>Preguntas frecuentes</h2>
  <details>
    <summary>¿Cuánto es ${miles(b)} € brutos al mes?</summary>
    <div><p>En 12 pagas son ${eur(mesBruto12)} brutos al mes y ${eur(r.mensual.normal)} netos. En 14 pagas, ${eur(mesBruto14)} brutos por paga y ${eur(r14.mensual.normal)} netos en los meses normales.</p></div>
  </details>
  <details>
    <summary>¿Por qué mi nómina no da exactamente esto?</summary>
    <div><p>Puede variar por pluses, horas extra, retribución en especie, el grupo de cotización de tu convenio o porque la empresa regulariza la retención a mitad de año si cambia tu sueldo o tu situación familiar. Si comunicas a la empresa tus hijos o tu situación (modelo 145), la retención se ajusta.</p></div>
  </details>
  <details>
    <summary>¿Lo que me retienen es lo que pago de IRPF?</summary>
    <div><p>No exactamente. La retención es un adelanto. En la declaración de la Renta se aplica la escala de tu comunidad autónoma y tus deducciones, y la diferencia te sale a devolver o a pagar. Con un único pagador y este sueldo, la diferencia suele ser pequeña.</p></div>
  </details>
  <details>
    <summary>¿Sirve para el País Vasco y Navarra?</summary>
    <div><p>No. Tienen su propio IRPF y sus propias tablas de retención. Este cálculo vale para el resto de España.</p></div>
  </details>

  <p class="muted small">Cálculo con el algoritmo oficial de retenciones de la Agencia Tributaria para ${ANIO} (versión del 10 de septiembre) y las bases y tipos de cotización de ${ANIO} (Orden PJC/297/2026). Revisado en octubre de ${ANIO} por <a href="{{root}}sobre-nosotros.html">${esc(owner)}</a>. Es una estimación: tu nómina puede variar por tu convenio y tus circunstancias.</p>
</article>
`;
    return {
      lang: "es", file: slugOf(b), slug: slugOf(b), tool: "sueldo", faqSchema: true,
      sueldo: { bruto: b, pagas: 12 },
      appName: `Calculadora de sueldo neto: ${miles(b)} € brutos`,
      nav: `${miles(b)} € brutos en netos`,
      title: `${miles(b)} € brutos en netos ${ANIO}: cuánto cobras al mes`,
      description: `${miles(b)} € brutos al año son ${eur(r.mensual.normal).replace(" ", " ")} netos al mes en 12 pagas en ${ANIO} (retención del ${pct(r.irpf.tipo).replace(" ", " ")}). Desglose de la nómina, 14 pagas, con hijos y coste para la empresa.`,
      generated: "scripts/sueldo-pages.mjs",
      body,
    };
  });
}


// Guías de apoyo con cifras calculadas: salario mínimo 2026 en neto y tabla de retenciones por sueldo.
export function sueldoGuias(owner) {
  const SMI = { mes: 1221, anual: 17094, dia: 40.7 };
  const smi = calc(SMI.anual, { pagas: 14 }), smi12 = calc(SMI.anual);
  const casosSMI = [
    ["Soltero, sin hijos", {}],
    ["Con 1 hijo (a medias con el otro progenitor)", { hijos: hijos(1) }],
    ["Con 2 hijos (a medias)", { hijos: hijos(2) }],
    ["Familia monoparental con 1 hijo", { situacion: 1, hijos: hijos(1, { entero: true }) }],
    ["Casado, la pareja no trabaja", { situacion: 2 }],
    ["Contrato temporal de menos de un año", { contrato: "corto" }],
  ].map(([t, x]) => { const r = calc(SMI.anual, { pagas: 14, ...x }); return `<tr><td>${t}</td><td>${pct(r.irpf.tipo)}</td><td>${eur(r.irpf.importe / 14)}</td><td>${eur(r.mensual.normal)}</td><td>${eur(r.mensual.extra)}</td></tr>`; }).join("\n");
  const smiBody = `<section class="hero">
  <h1>Salario mínimo 2026: cuánto se cobra en neto</h1>
  <p class="lead">El salario mínimo interprofesional (SMI) de ${ANIO} es de <strong>1.221 € brutos al mes en 14 pagas</strong> (17.094 € al año, 40,70 € al día). Un trabajador soltero y sin hijos a jornada completa cobra <strong>${eur(smi.mensual.normal)} netos</strong> en los meses normales y ${eur(smi.mensual.extra)} en cada paga extra, porque este año el salario mínimo sí tiene una pequeña retención de IRPF.</p>
</section>

{{tool}}

<article class="content">
  <h2>Nómina del salario mínimo en ${ANIO}</h2>
  <div class="table-wrap"><table class="sn-table">
    <thead><tr><th scope="col">Concepto</th><th scope="col">Mes normal</th><th scope="col">Paga extra</th></tr></thead>
    <tbody>
      <tr><td>Sueldo bruto</td><td>${eur(SMI.mes)}</td><td>${eur(SMI.mes)}</td></tr>
      <tr><td>Seguridad Social (6,50 % sobre ${eur(smi.ss.base)}, con las extras prorrateadas)</td><td>${eur(-smi.ss.trabajador.total / 12)}</td><td>${eur(0)}</td></tr>
      <tr><td>Retención de IRPF (${pct(smi.irpf.tipo)})</td><td>${eur(-SMI.mes * smi.irpf.tipo / 100)}</td><td>${eur(-SMI.mes * smi.irpf.tipo / 100)}</td></tr>
      <tr class="here"><td>Neto</td><td>${eur(smi.mensual.normal)}</td><td>${eur(smi.mensual.extra)}</td></tr>
    </tbody>
  </table></div>
  <p>Al año son ${eur(smi.netoAnual)} netos. Si tu empresa te paga en 12 pagas (con las extras prorrateadas), cobras ${eur(smi12.mensual.normal)} netos cada mes.</p>

  <h2>¿Por qué me retienen IRPF si cobro el salario mínimo?</h2>
  <p>Hasta 2024, cada subida del SMI iba acompañada de un cambio en las tablas de retención para que el salario mínimo no tuviera retención. Desde 2025 el Gobierno lo hace de otra forma: el salario mínimo puede tener una retención pequeña en la nómina y la compensación llega en la <strong>declaración de la Renta</strong>, con una deducción para quien cobra el salario mínimo. Para un soltero sin hijos la retención es del ${pct(smi.irpf.tipo)}, unos ${eur0(smi.irpf.importe / 14)} al mes y ${eur0(smi.irpf.importe)} al año.</p>
  <p>Ese dinero no se pierde: es un adelanto. Para recuperarlo hay que <strong>presentar la declaración de la Renta de ${ANIO}</strong> (en la primavera de ${ANIO + 1}), aunque por tus ingresos no estés obligado a hacerla.</p>

  {{ad:content}}

  <h2>Salario mínimo neto según tu situación</h2>
  <p>La retención depende de tu familia: con hijos o con la pareja sin ingresos, el mínimo exento es más alto y la retención baja o desaparece. Los contratos de menos de un año tienen una retención mínima del 2 %.</p>
  <div class="table-wrap"><table class="sn-table">
    <thead><tr><th scope="col">Situación</th><th scope="col">Retención</th><th scope="col">IRPF al mes</th><th scope="col">Neto al mes</th><th scope="col">Paga extra neta</th></tr></thead>
    <tbody>
${casosSMI}
    </tbody>
  </table></div>

  <h2>Preguntas frecuentes</h2>
  <details>
    <summary>¿Cuánto es el salario mínimo por día en ${ANIO}?</summary>
    <div><p>40,70 € brutos al día, o 1.221 € al mes en 14 pagas.</p></div>
  </details>
  <details>
    <summary>¿Y si trabajo a media jornada?</summary>
    <div><p>El salario mínimo se cobra en proporción a las horas: a media jornada, 610,50 € brutos al mes en 14 pagas. Con ese sueldo no hay retención de IRPF. Puedes calcular tu caso exacto en la calculadora poniendo tu bruto.</p></div>
  </details>
  <details>
    <summary>¿Cuánto le cuesta a la empresa un trabajador con el salario mínimo?</summary>
    <div><p>Unos ${eur0(smi.costeEmpresa)} al año: los 17.094 € de sueldo más ${eur0(smi.ss.empresa.total)} de cotizaciones de la empresa (la cifra exacta depende del sector, por el seguro de accidentes).</p></div>
  </details>

  <p class="muted small">Cálculo con el algoritmo de retenciones de la Agencia Tributaria para ${ANIO} (versión del 10 de septiembre) y las bases y tipos de cotización de ${ANIO}. Revisado en octubre de ${ANIO} por <a href="{{root}}sobre-nosotros.html">${esc(owner)}</a>.</p>
</article>
`;

  // Tabla de retenciones: tipo según el bruto y la situación.
  const sits = [["Soltero sin hijos", {}], ["1 hijo", { hijos: hijos(1) }], ["2 hijos", { hijos: hijos(2) }], ["Pareja sin ingresos", { situacion: 2 }], ["Pareja sin ingresos y 2 hijos", { situacion: 2, hijos: hijos(2, { entero: true }) }]];
  const brutos = [];
  for (let b = 14000; b <= 40000; b += 1000) brutos.push(b);
  for (let b = 42000; b <= 60000; b += 2000) brutos.push(b);
  for (let b = 65000; b <= 100000; b += 5000) brutos.push(b);
  const filas = brutos.map((b) => `<tr><td>${SALARIOS.includes(b) ? `<a href="{{root}}${slugOf(b)}">${miles(b)} €</a>` : `${miles(b)} €`}</td>${sits.map(([, x]) => `<td>${pct(calc(b, x).irpf.tipo)}</td>`).join("")}</tr>`).join("\n");
  const t30 = calc(30000).irpf;
  const tablaBody = `<section class="hero">
  <h1>Tabla de retenciones de IRPF 2026 según tu sueldo</h1>
  <p class="lead">Qué porcentaje de IRPF te retiene la empresa en ${ANIO} según tu sueldo bruto anual y tu situación familiar, calculado con el algoritmo oficial de la Agencia Tributaria. Por ejemplo, con 30.000 € brutos y sin hijos la retención es del ${pct(t30.tipo)}.</p>
</section>

{{tool}}

<article class="content">
  <h2>Porcentaje de retención por sueldo bruto</h2>
  <p>Contrato indefinido, menor de 65 años y sin discapacidad. En la columna de 1 y 2 hijos, los hijos son menores de 25, mayores de 3 y cuentan a medias con el otro progenitor; «pareja sin ingresos» es estar casado con alguien que gana menos de 1.500 € al año.</p>
  <div class="table-wrap"><table class="sn-table">
    <thead><tr><th scope="col">Bruto anual</th>${sits.map(([t]) => `<th scope="col">${t}</th>`).join("")}</tr></thead>
    <tbody>
${filas}
    </tbody>
  </table></div>

  {{ad:content}}

  <h2>La escala de retenciones de ${ANIO}</h2>
  <p>Es la misma para toda España salvo el País Vasco y Navarra, y no ha cambiado respecto a ${ANIO - 1}. Se aplica a la base de retención (el bruto menos la Seguridad Social, 2.000 € de gastos y, en sueldos bajos, la reducción por rendimientos del trabajo), y al resultado se le resta la misma escala aplicada al mínimo personal y familiar.</p>
  <div class="table-wrap"><table class="sn-table">
    <thead><tr><th scope="col">Base de retención</th><th scope="col">Tipo del tramo</th></tr></thead>
    <tbody>
      <tr><td>Hasta 12.450 €</td><td>19 %</td></tr>
      <tr><td>De 12.450 € a 20.200 €</td><td>24 %</td></tr>
      <tr><td>De 20.200 € a 35.200 €</td><td>30 %</td></tr>
      <tr><td>De 35.200 € a 60.000 €</td><td>37 %</td></tr>
      <tr><td>De 60.000 € a 300.000 €</td><td>45 %</td></tr>
      <tr><td>Más de 300.000 €</td><td>47 %</td></tr>
    </tbody>
  </table></div>
  <p>Que tu sueldo entre en el tramo del 30 % no significa que te retengan un 30 %: ese tipo solo se aplica a la parte de la base que cae en ese tramo. Por eso el porcentaje real de la nómina es mucho más bajo.</p>

  <h2>Sueldos que no tienen retención</h2>
  <p>Por debajo de estas cantidades la empresa no te retiene IRPF (artículo 81 del Reglamento del IRPF):</p>
  <div class="table-wrap"><table class="sn-table">
    <thead><tr><th scope="col">Situación</th><th scope="col">Sin hijos</th><th scope="col">1 hijo</th><th scope="col">2 o más hijos</th></tr></thead>
    <tbody>
      <tr><td>Familia monoparental</td><td>—</td><td>17.644 €</td><td>18.694 €</td></tr>
      <tr><td>Casado, pareja con menos de 1.500 € al año</td><td>17.197 €</td><td>18.130 €</td><td>19.262 €</td></tr>
      <tr><td>Resto de situaciones</td><td>15.876 €</td><td>16.342 €</td><td>16.867 €</td></tr>
    </tbody>
  </table></div>

  <h2>Preguntas frecuentes</h2>
  <details>
    <summary>¿Por qué en mi nómina el porcentaje es distinto?</summary>
    <div><p>Puede deberse a pluses y horas extra, a que la empresa regularizó tu retención a mitad de año, a que no le comunicaste tus hijos (modelo 145) o a que pediste voluntariamente un tipo más alto.</p></div>
  </details>
  <details>
    <summary>¿Puedo pedir que me retengan más o menos?</summary>
    <div><p>Más, sí: puedes pedir por escrito un porcentaje mayor. Menos, no: la empresa tiene que aplicar como mínimo el que sale del cálculo oficial.</p></div>
  </details>

  <p class="muted small">Fuente: «Algoritmo de cálculo del tipo de retención a cuenta del IRPF. Ejercicio ${ANIO} (a partir de 10 de septiembre)», Agencia Tributaria. Revisado en octubre de ${ANIO} por <a href="{{root}}sobre-nosotros.html">${esc(owner)}</a>.</p>
</article>
`;
  const base = { lang: "es", tool: "sueldo", faqSchema: true, generated: "scripts/sueldo-pages.mjs" };
  return [
    { ...base, slug: "calculadora-sueldo-neto/salario-minimo-2026-neto.html", file: "calculadora-sueldo-neto/salario-minimo-2026-neto.html",
      sueldo: { bruto: SMI.anual, pagas: 14 }, appName: "Calculadora del salario mínimo neto 2026", nav: "Salario mínimo 2026 en neto",
      title: `Salario mínimo ${ANIO} neto: cuánto se cobra al mes`,
      description: `El SMI de ${ANIO} son 1.221 € brutos en 14 pagas: ${eur(smi.mensual.normal).replace(" ", " ")} netos al mes para un soltero sin hijos. Por qué tiene retención de IRPF y cómo recuperarla.`,
      body: smiBody },
    { ...base, slug: "calculadora-sueldo-neto/tabla-retenciones-irpf-2026.html", file: "calculadora-sueldo-neto/tabla-retenciones-irpf-2026.html",
      sueldo: { bruto: 30000, pagas: 12 }, appName: "Calculadora de la retención de IRPF 2026", nav: "Tabla de retenciones IRPF 2026",
      title: `Tabla de retenciones IRPF ${ANIO}: porcentaje según tu sueldo`,
      description: `Porcentaje de IRPF que te retienen en ${ANIO} según tu sueldo bruto y tu familia, con el algoritmo oficial de Hacienda. Escala de retenciones y sueldos sin retención.`,
      body: tablaBody },
  ];
}
