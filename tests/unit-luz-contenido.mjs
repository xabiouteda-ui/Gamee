// Pruebas de las páginas de contenido de la luz: coste por hora de inicio y estudio anual.
//   node tests/unit-luz-contenido.mjs
import assert from "node:assert/strict";
import { windowCost, costByStart, summary, madridHour, withTaxes } from "../assets/js/luz/coste.js";
import { computeStudy, studyCSV, studyDays } from "../assets/js/luz/estudio.js";
import { RULES } from "../assets/js/luz/core.js";
import { madridNow, nextChange, dayPeriods, allValle } from "../assets/js/luz/periodos.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("✓ " + name); };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test("windowCost: reparte el consumo por igual y admite horas partidas", () => {
  const p = [0.1, 0.2, 0.3, 0.4];
  close(windowCost(p, 0, 1, 1), 0.1);
  close(windowCost(p, 0, 2, 2), 0.1 + 0.2);
  close(windowCost(p, 1, 1.5, 1.5), 1 * 0.2 + 0.5 * 0.3); // 1 kWh la 1.ª hora, 0,5 la media siguiente
  assert.equal(windowCost(p, 3, 2, 2), null, "se sale de los datos");
  assert.equal(windowCost([0.1, null], 0, 2, 2), null, "hora sin precio");
  assert.equal(windowCost(p, 0, 1, 0), null);
});

test("costByStart: hoy y mañana seguidos, desde la hora actual", () => {
  const today = Array.from({ length: 24 }, (_, h) => (h === 23 ? 0.01 : 0.2));
  const tomorrow = Array.from({ length: 24 }, (_, h) => (h === 0 ? 0.01 : 0.2));
  const opts = costByStart([{ date: "2026-09-29", prices: today }, { date: "2026-09-30", prices: tomorrow }], 2, 2, 20);
  assert.equal(opts[0].hour, 20);
  const s = summary(opts, 20);
  assert.equal(s.best.hour, 23, "la mejor ventana de 2 h cruza la medianoche");
  assert.equal(s.best.day, "2026-09-29");
  close(s.best.cost, 0.01 + 0.01);
  close(s.saving, s.now.cost - s.best.cost);
  // Solo hoy: la ventana de 2 h no puede empezar a las 23.
  assert.ok(!costByStart([{ date: "2026-09-29", prices: today }], 2, 2).some((o) => o.hour === 23));
});

test("summary sin opciones y hora de Madrid", () => {
  assert.equal(summary([], 0), null);
  assert.equal(madridHour(new Date("2026-07-01T10:30:00Z")), 12); // verano: UTC+2
  assert.equal(madridHour(new Date("2026-01-15T23:30:00Z")), 0); // invierno: UTC+1, ya es otro día
  close(withTaxes(1), (1 + RULES.electricityTax) * (1 + RULES.vat));
});

// PVPC sintético: madrugada barata (0,05), sol a mediodía (0,08), punta de tarde cara (0,25), resto 0,15.
function fakePvpc(year, nDays) {
  const days = {};
  for (let i = 0; i < nDays; i++) {
    const d = new Date(Date.UTC(year, 0, 1 + i)).toISOString().slice(0, 10);
    days[d] = Array.from({ length: 24 }, (_, h) => (h < 7 ? 0.05 : h >= 12 && h < 16 ? 0.08 : h >= 19 && h < 22 ? 0.25 : 0.15));
  }
  days[`${year}-01-10`][3] = null; // día incompleto: se descarta
  days[`${year - 1}-12-31`] = Array(24).fill(0.9); // otro año: se ignora
  return { days };
}

test("Estudio: medias por hora, horas más baratas y cuota de madrugada", () => {
  const st = computeStudy(fakePvpc(2026, 60), 2026);
  assert.equal(st.nDays, 59);
  assert.equal(st.from, "2026-01-01");
  assert.deepEqual(st.dearest3, [19, 20, 21]);
  assert.ok(st.cheapest3.every((h) => h < 7));
  close(st.shareNight, 1); // indexOf del mínimo: siempre la hora 0
  close(st.shareSolar, 0);
  close(st.spread, 0.2);
  assert.equal(st.months.length, 3); // 60 días desde el 1 de enero llegan al 1 de marzo
  assert.equal(st.months[0].name, "enero");
  assert.ok(st.weekday > 0 && st.weekend > 0);
  assert.equal(st.counts.reduce((a, b) => a + b, 0), 59);
});

test("Estudio: hasta una fecha, sin datos suficientes y CSV", () => {
  const pv = fakePvpc(2026, 60);
  assert.equal(computeStudy(pv, 2026, "2026-01-05"), null, "menos de 7 días");
  assert.equal(studyDays(pv, 2026, "2026-01-31").length, 30);
  assert.equal(computeStudy({ days: {} }, 2026), null);
  const csv = studyCSV(pv, 2026, "2026-01-02").trim().split("\n");
  assert.equal(csv[0], "fecha;hora;pvpc_eur_kwh_sin_impuestos");
  assert.equal(csv.length, 1 + 48);
  assert.equal(csv[1], "2026-01-01;00:00;0.05000");
});

test("Horarios: tramo de ahora y cuándo cambia (laborable, viernes noche, festivo)", () => {
  // Lunes 5/10/2026
  assert.deepEqual(dayPeriods("2026-10-05").join(""), "P3".repeat(8) + "P2P2" + "P1".repeat(4) + "P2".repeat(4) + "P1".repeat(4) + "P2P2");
  assert.deepEqual(nextChange("2026-10-05", 9), { period: "P2", next: "P1", until: { date: "2026-10-05", hour: 10 } });
  assert.deepEqual(nextChange("2026-10-05", 23), { period: "P2", next: "P3", until: { date: "2026-10-06", hour: 0 } });
  // Sábado 10/10 de madrugada: valle hasta el martes a las 08:00, porque el lunes 12/10 es festivo nacional.
  assert.deepEqual(nextChange("2026-10-10", 3), { period: "P3", next: "P2", until: { date: "2026-10-13", hour: 8 } });
  assert.ok(allValle("2026-10-12") && allValle("2026-10-10") && !allValle("2026-10-13"));
});

test("Horarios: fecha y hora de Madrid en verano, en invierno y al cruzar la medianoche UTC", () => {
  assert.deepEqual(madridNow(new Date("2026-07-01T22:30:00Z")), { date: "2026-07-02", hour: 0 });
  assert.deepEqual(madridNow(new Date("2026-12-31T23:10:00Z")), { date: "2027-01-01", hour: 0 });
  assert.deepEqual(madridNow(new Date("2026-12-31T10:59:00Z")), { date: "2026-12-31", hour: 11 });
});

console.log(`${n} pruebas de contenido de luz correctas.`);
