// Cálculo del sueldo neto en 2026 (territorio común: todo salvo País Vasco y Navarra).
//
// Retención de IRPF: algoritmo oficial de la Agencia Tributaria «Algoritmo de cálculo del tipo de retención a cuenta
// del IRPF para los rendimientos del trabajo personal. Ejercicio 2026 (a partir de 10 de septiembre)».
// https://sede.agenciatributaria.gob.es/static_files/Sede/Programas_ayuda/Retenciones/2026/Algoritmo%20Retenciones-2026_10sept.pdf
//
// Cotizaciones a la Seguridad Social del trabajador y de la empresa en 2026 (Orden PJC/297/2026): base máxima
// 5.101,20 €/mes, contingencias comunes 4,70 %, MEI 0,15 %, desempleo 1,55 % (1,60 % contrato temporal),
// formación profesional 0,10 % y cotización adicional de solidaridad sobre la parte del sueldo que supera la base máxima.
//
// Sin DOM: lo usan la página, las pruebas (tests/unit-sueldo.mjs) y el build (tablas de las páginas por salario).

export const ANIO = 2026;

export const SS = {
  baseMax: 5101.2,
  trabajador: { cc: 4.7, mei: 0.15, fp: 0.1, desempleo: 1.55, desempleoTemporal: 1.6 },
  empresa: { cc: 23.6, mei: 0.75, fp: 0.6, fogasa: 0.2, desempleo: 5.5, desempleoTemporal: 6.7, atep: 1.5 },
  // Cotización adicional de solidaridad: tramos sobre la base máxima (en €/mes) y tipos [empresa, trabajador].
  solidaridad: [
    { hasta: 5611.32, empresa: 0.96, trabajador: 0.19 },
    { hasta: 7651.8, empresa: 1.04, trabajador: 0.21 },
    { hasta: Infinity, empresa: 1.22, trabajador: 0.24 },
  ],
};

// Escala de retención (tabla 2 del algoritmo).
const ESCALA = [
  [0, 0, 12450, 19],
  [12450, 2365.5, 7750, 24],
  [20200, 4225.5, 15000, 30],
  [35200, 8725.5, 24800, 37],
  [60000, 17901.5, 240000, 45],
  [300000, 125901.5, Infinity, 47],
];

// Límites excluyentes de la obligación de retener (tabla 1): [situación][0, 1, 2 o más descendientes].
const EXENTOS = { 1: [null, 17644, 18694], 2: [17197, 18130, 19262], 3: [15876, 16342, 16867] };

export const redondear = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const truncar2 = (x) => Math.trunc(x * 100 + 1e-9) / 100;

export function escala(base) {
  if (base <= 0) return 0;
  for (let i = ESCALA.length - 1; i >= 0; i--) {
    const [desde, cuota, , pct] = ESCALA[i];
    if (base > desde) return cuota + (base - desde) * pct / 100;
  }
  return 0;
}

// Cotizaciones anuales (12 meses; las pagas extra van prorrateadas en la base).
export function cotizaciones(bruto, { temporal = false } = {}) {
  const mes = bruto / 12;
  const base = Math.min(mes, SS.baseMax);
  const t = SS.trabajador, e = SS.empresa;
  const linea = (pct) => redondear(base * pct / 100) * 12;
  const trab = {
    contingencias: linea(t.cc),
    mei: linea(t.mei),
    formacion: linea(t.fp),
    desempleo: linea(temporal ? t.desempleoTemporal : t.desempleo),
    solidaridad: 0,
  };
  const emp = {
    contingencias: linea(e.cc),
    mei: linea(e.mei),
    formacion: linea(e.fp),
    fogasa: linea(e.fogasa),
    desempleo: linea(temporal ? e.desempleoTemporal : e.desempleo),
    accidentes: linea(e.atep),
    solidaridad: 0,
  };
  // Solidaridad: por tramos de la parte del sueldo mensual que supera la base máxima.
  let desde = SS.baseMax;
  for (const tr of SS.solidaridad) {
    const parte = Math.max(0, Math.min(mes, tr.hasta) - desde);
    trab.solidaridad += redondear(parte * tr.trabajador / 100) * 12;
    emp.solidaridad += redondear(parte * tr.empresa / 100) * 12;
    desde = tr.hasta;
    if (mes <= tr.hasta) break;
  }
  const suma = (o) => redondear(Object.values(o).reduce((a, b) => a + b, 0));
  return { base: redondear(base), topada: mes > SS.baseMax, trabajador: { ...trab, total: suma(trab) }, empresa: { ...emp, total: suma(emp) } };
}

// Tipo de retención según el algoritmo de la AEAT.
// d: { bruto, cotizaciones, situacion (1|2|3), hijos: [{ menor3, entero }], edad, discapacidad ("no"|"33"|"65"),
//      movilidadReducida, movilidadGeografica, contrato ("indefinido"|"temporal"|"corto"), ascendientes65, ascendientes75,
//      prestamoVivienda, ceutaMelilla, pension (pensionista S. Social), desempleado }
export function retencion(d) {
  const RETRIB = d.bruto;
  const COT = d.cotizaciones;
  const hijos = d.hijos || [];
  const NUMDES = hijos.length;
  let situacion = Number(d.situacion) || 3;
  const avisos = [];
  if (situacion === 1 && NUMDES === 0) { situacion = 3; avisos.push("La situación 1 (familia monoparental) exige al menos un hijo: se calcula como situación 3."); }
  const disc = d.discapacidad || "no";
  const grave = disc === "65" || (disc === "33" && d.movilidadReducida);
  const activo = !d.pension && !d.desempleado;

  // Gastos deducibles
  let otros = 2000 + (d.movilidadGeografica && activo ? 2000 : 0) + (activo ? (grave ? 7750 : disc === "33" ? 3500 : 0) : 0);
  if (RETRIB - COT < 0) otros = 0;
  if (otros > RETRIB - COT) otros = RETRIB - COT;

  // Rendimiento neto y reducción por obtención de rendimientos del trabajo (art. 20 LIRPF)
  const RNT = Math.max(0, RETRIB - COT);
  let red20 = 0;
  if (RNT <= 14852) red20 = 7302;
  else if (RNT <= 17673.52) red20 = 7302 - 1.75 * (RNT - 14852);
  else if (RNT < 19747.5) red20 = 2364.34 - 1.14 * (RNT - 17673.52);
  red20 = redondear(red20);
  const RNTREDU = Math.max(0, RNT - otros - red20);

  const PENSION = d.pension ? 600 : 0;
  const HIJOS = NUMDES > 2 ? 600 : 0;
  const DESEM = d.desempleado ? 1200 : 0;
  const REDU = PENSION + HIJOS + DESEM;
  const BASE = RNTREDU > REDU ? RNTREDU - REDU : 0;

  // Mínimo personal y familiar
  const edad = Number(d.edad) || 30;
  const mincon = 5550 + (edad > 64 ? 1150 : 0) + (edad > 74 ? 1400 : 0);
  const ORDEN = [2400, 2700, 4000];
  let mindes = 0;
  hijos.forEach((h, i) => {
    const k = h.entero === false ? 0.5 : 1;
    mindes += (ORDEN[i] ?? 4500) * k + (h.menor3 ? 2800 * k : 0);
  });
  mindes = redondear(mindes);
  const a65 = Math.max(0, Number(d.ascendientes65) || 0), a75 = Math.max(0, Number(d.ascendientes75) || 0);
  const minas = 1150 * (a65 + a75) + 1400 * a75;
  const mindisc = (disc === "65" ? 9000 : disc === "33" ? 3000 : 0) + (grave ? 3000 : 0);
  const MINPERFA = mincon + mindes + minas + mindisc;

  // Rendimientos exentos de retención
  const col = Math.min(NUMDES, 2);
  const limite = EXENTOS[situacion][col];
  const out = { situacion, avisos, gastos: redondear(COT + otros), otrosGastos: otros, reduccion: red20, base: redondear(BASE), minimo: MINPERFA };
  if (limite !== null && RETRIB <= limite + PENSION + DESEM) return { ...out, exento: true, cuota: 0, tipo: 0, importe: 0 };

  const cuota1 = escala(BASE);
  const cuota2 = escala(MINPERFA);
  let cuota = cuota1 > cuota2 ? cuota1 - cuota2 : 0;
  // Límite del 43 % del exceso sobre el mínimo exento (art. 85.3 RIRPF)
  if (RETRIB <= 35200 && limite !== null) {
    const lim = (RETRIB - (limite + PENSION + DESEM)) * 0.43;
    if (cuota > lim) cuota = lim;
  }
  const ceuta = !!d.ceutaMelilla;
  const minopago = RETRIB < 33007.2 && d.prestamoVivienda ? Math.trunc(RETRIB * 0.02 * 100) / 100 : 0;
  const dif = Math.max(0, (ceuta ? cuota * 0.4 : cuota) - minopago);
  let tipo = truncar2(dif / RETRIB * 100);
  if (d.contrato === "corto") tipo = Math.max(tipo, ceuta ? 0.8 : 2);
  return { ...out, exento: false, cuota: redondear(cuota), tipo, importe: redondear(RETRIB * tipo / 100) };
}

// Cálculo completo para la calculadora y las tablas.
export function sueldoNeto(input) {
  const bruto = Math.max(0, Number(input.bruto) || 0);
  const pagas = Number(input.pagas) === 14 ? 14 : 12;
  const temporal = input.contrato === "temporal" || input.contrato === "corto";
  const ss = cotizaciones(bruto, { temporal });
  const irpf = bruto > 0 ? retencion({ ...input, bruto, cotizaciones: ss.trabajador.total }) : { tipo: 0, importe: 0, exento: true, avisos: [] };
  const netoAnual = redondear(bruto - ss.trabajador.total - irpf.importe);
  const mensual = pagas === 14
    ? { normal: redondear(bruto / 14 - ss.trabajador.total / 12 - bruto / 14 * irpf.tipo / 100), extra: redondear(bruto / 14 * (1 - irpf.tipo / 100)) }
    : { normal: redondear(netoAnual / 12), extra: 0 };
  return {
    bruto, pagas, ss, irpf, netoAnual, mensual,
    brutoMensual: redondear(bruto / pagas),
    costeEmpresa: redondear(bruto + ss.empresa.total),
    tipoTotal: bruto ? redondear((ss.trabajador.total + irpf.importe) / bruto * 100) : 0,
  };
}
