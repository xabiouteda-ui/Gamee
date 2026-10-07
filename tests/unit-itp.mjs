// Pruebas de la calculadora del ITP de vehículos usados: node tests/unit-itp.mjs
import { calcular, coeficiente } from "../assets/js/itp/core.js";
let fail = 0;
const base = { tipoVeh: "turismo", cc: 1598, cvf: 11, etiqueta: "otra", historico: false, fechaVenta: "2026-10-07" };
function check(name, input, expect) {
  const r = calcular({ ...base, ...input });
  const got = r.foral ? "foral" : r.error ? "error" : r.cuota;
  if (got !== expect) { fail++; console.error(`✗ ${name}: esperaba ${expect}, salió ${got}`); } else console.log(`✓ ${name}`);
}

for (const [y, c] of [[0, 100], [1, 84], [8, 24], [12, 10], [20, 10]]) if (coeficiente(y) !== c) { fail++; console.error(`✗ coeficiente(${y})`); }
check("Madrid: manda el valor de tablas", { ccaa: "madrid", fechaMatric: "2021-05-20", precio: 7500, valorTablas: 22400 }, 349.44);
check("Madrid: manda el precio", { ccaa: "madrid", fechaMatric: "2018-03-15", precio: 9500, valorTablas: 24000 }, 380);
check("Andalucía: más de 15 CVF al 8 %", { ccaa: "andalucia", fechaMatric: "2020-01-01", precio: 15000, cvf: 16 }, 1200);
check("Aragón: más de 10 años y 1.400 cc", { ccaa: "aragon", fechaMatric: "2014-01-01", precio: 3000, cc: 1400 }, 20);
check("Aragón: más de 2.000 cc vuelve al 4 %", { ccaa: "aragon", fechaMatric: "2014-01-01", precio: 3000, cc: 2200 }, 120);
check("Galicia: 15 años y 1.150 cc", { ccaa: "galicia", fechaMatric: "2010-01-01", precio: 1500, cc: 1150 }, 22);
check("Galicia: 3 %", { ccaa: "galicia", fechaMatric: "2019-01-01", precio: 12000 }, 360);
check("Valencia: cuota fija 5-12 años", { ccaa: "valencia", fechaMatric: "2017-01-01", precio: 9000, cc: 1600 }, 180);
check("Valencia: 20.000 € o más al 8 %", { ccaa: "valencia", fechaMatric: "2023-01-01", precio: 25000, cc: 1500 }, 2000);
check("Valencia: híbrido al 6 %", { ccaa: "valencia", fechaMatric: "2023-01-01", precio: 25000, cc: 1800, etiqueta: "eco" }, 1500);
check("Murcia: más de 12 años y 1.900 cc", { ccaa: "murcia", fechaMatric: "2012-01-01", precio: 2500, cc: 1900 }, 50);
check("Canarias: turismo de más de 10 años", { ccaa: "canarias", fechaMatric: "2014-01-01", precio: 3000, cc: 1300 }, 70);
check("Baleares: ECO al 2 %", { ccaa: "baleares", fechaMatric: "2021-01-01", precio: 14000, etiqueta: "eco" }, 280);
check("Ceuta: bonificación del 50 %", { ccaa: "ceuta", fechaMatric: "2021-01-01", precio: 10000 }, 200);
check("País Vasco: foral", { ccaa: "paisvasco", fechaMatric: "2021-01-01", precio: 10000 }, "foral");
check("Fechas al revés", { ccaa: "madrid", fechaMatric: "2027-01-01", precio: 10000 }, "error");
if (fail) { console.error(`${fail} pruebas fallidas`); process.exit(1); }
console.log("✓ ITP: todas las pruebas han pasado");
