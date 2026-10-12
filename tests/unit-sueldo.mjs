// Pruebas de la calculadora de sueldo neto: node tests/unit-sueldo.mjs
// Los valores esperados están calculados a mano siguiendo el algoritmo de la AEAT de 2026 (ver core.js).
import { sueldoNeto, retencion, cotizaciones, escala } from "../assets/js/sueldo/core.js";
let fail = 0, n = 0;
function eq(name, got, want) {
  n++;
  if (Math.abs(got - want) > 0.005) { fail++; console.error(`✗ ${name}: esperaba ${want}, salió ${got}`); } else console.log(`✓ ${name}`);
}
const base = { situacion: 3, hijos: [], edad: 30, discapacidad: "no", contrato: "indefinido", pagas: 12 };

eq("Escala: ejemplo del algoritmo (base 24.000)", escala(24000), 5365.5);

// 30.000 € soltero sin hijos
let r = sueldoNeto({ ...base, bruto: 30000 });
eq("30.000: cotizaciones del trabajador", r.ss.trabajador.total, 1950);
eq("30.000: tipo de retención", r.irpf.tipo, 16.42);
eq("30.000: retención anual", r.irpf.importe, 4926);
eq("30.000: neto anual", r.netoAnual, 23124);
eq("30.000: neto mensual (12 pagas)", r.mensual.normal, 1927);

// 30.000 € en 14 pagas: mismo neto anual, repartido distinto
r = sueldoNeto({ ...base, bruto: 30000, pagas: 14 });
eq("30.000 en 14 pagas: neto anual igual", r.netoAnual, 23124);
eq("30.000 en 14 pagas: mes normal", r.mensual.normal, 1628.5);
eq("30.000 en 14 pagas: paga extra", r.mensual.extra, 1791);
eq("30.000 en 14 pagas: 12 meses + 2 extras = neto anual", r.mensual.normal * 12 + r.mensual.extra * 2, 23124);

// 15.000 €: por debajo del límite excluyente (situación 3, sin hijos: 15.876 €)
r = sueldoNeto({ ...base, bruto: 15000 });
eq("15.000: exento de retención", r.irpf.tipo, 0);
eq("15.000: neto anual (cada concepto redondeado al céntimo, como en la nómina)", r.netoAnual, 14024.88);

// 18.000 €: reducción del art. 20 y límite del 43 %
r = sueldoNeto({ ...base, bruto: 18000 });
eq("18.000: reducción por rendimientos del trabajo", r.irpf.reduccion, 3840.5);
eq("18.000: tipo (limitado por el 43 %)", r.irpf.tipo, 5.07);

// 80.000 €: base máxima y cotización de solidaridad
r = sueldoNeto({ ...base, bruto: 80000 });
eq("80.000: cotización de solidaridad del trabajador", r.ss.trabajador.solidaridad, 38.28);
eq("80.000: cotizaciones totales del trabajador", r.ss.trabajador.total, 4017.24);
eq("80.000: tipo de retención", r.irpf.tipo, 28.92);
eq("80.000: neto anual", r.netoAnual, 52846.76);

// Contrato temporal: desempleo al 1,60 % y mínimo del 2 % si dura menos de un año
eq("Temporal: desempleo 1,60 %", cotizaciones(24000, { temporal: true }).trabajador.desempleo, 384);
eq("Contrato de menos de un año: tipo mínimo 2 %", retencion({ bruto: 16000, cotizaciones: 1048, situacion: 3, contrato: "corto" }).tipo, 2);

// Hijos: mínimo por descendientes (2.400 + 2.700 + 2.800 por menor de 3 años)
r = retencion({ bruto: 30000, cotizaciones: 1950, situacion: 3, hijos: [{ menor3: false }, { menor3: true }] });
eq("Dos hijos (uno menor de 3): mínimo personal y familiar", r.minimo, 5550 + 2400 + 2700 + 2800);
eq("Dos hijos: tipo", r.tipo, 11.25);
r = retencion({ bruto: 30000, cotizaciones: 1950, situacion: 3, hijos: [{ menor3: false, entero: false }] });
eq("Un hijo compartido: mínimo a la mitad", r.minimo, 5550 + 1200);

// Mayor de 65 y discapacidad
eq("67 años: mínimo del contribuyente", retencion({ bruto: 30000, cotizaciones: 1950, situacion: 3, edad: 67 }).minimo, 6700);
eq("Discapacidad ≥ 65 %: mínimo (9.000 + 3.000 de asistencia)", retencion({ bruto: 30000, cotizaciones: 1950, situacion: 3, discapacidad: "65" }).minimo, 5550 + 12000);

// Ceuta y Melilla: la cuota se reduce al 40 %
eq("Ceuta o Melilla: tipo", retencion({ bruto: 30000, cotizaciones: 1950, situacion: 3, ceutaMelilla: true }).tipo, 6.56);

console.log(fail ? `\n${fail} de ${n} pruebas fallidas` : `\n${n} pruebas de sueldo neto correctas.`);
process.exit(fail ? 1 : 0);
