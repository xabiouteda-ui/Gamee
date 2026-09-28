// Pruebas unitarias del analizador de consumo eléctrico (Node, sin dependencias): `node tests/unit-luz.mjs`.
import assert from "node:assert/strict";
import { periodOf, parseConsumptionCSV, summarize, billFor, rankOffers, shift, powerSavingPerYear, sampleRows, DEFAULT_OFFERS, CsvError, maskCups } from "../assets/js/luz/core.js";

// Periodos 2.0TD. 2026-09-28 es lunes; 2026-10-03 sábado; 2026-10-12 festivo nacional (lunes).
assert.equal(periodOf("2026-09-28", 0), "P3");
assert.equal(periodOf("2026-09-28", 7), "P3");
assert.equal(periodOf("2026-09-28", 8), "P2");
assert.equal(periodOf("2026-09-28", 9), "P2");
assert.equal(periodOf("2026-09-28", 10), "P1");
assert.equal(periodOf("2026-09-28", 13), "P1");
assert.equal(periodOf("2026-09-28", 14), "P2");
assert.equal(periodOf("2026-09-28", 18), "P1");
assert.equal(periodOf("2026-09-28", 21), "P1");
assert.equal(periodOf("2026-09-28", 22), "P2");
assert.equal(periodOf("2026-09-28", 23), "P2");
assert.equal(periodOf("2026-10-03", 12), "P3", "sábado");
assert.equal(periodOf("2026-10-04", 19), "P3", "domingo");
assert.equal(periodOf("2026-10-12", 12), "P3", "festivo nacional");
assert.equal(periodOf("2026-04-03", 12), "P1", "Viernes Santo no cuenta (sin fecha fija)");
// Un día laborable tiene 8 h de cada periodo.
const counts = { P1: 0, P2: 0, P3: 0 };
for (let h = 0; h < 24; h++) counts[periodOf("2026-09-29", h)]++;
assert.deepEqual(counts, { P1: 8, P2: 8, P3: 8 });

// CSV formato CNMC (hora 1–24 = fin del intervalo, coma decimal, punto y coma).
const cnmc = "CUPS;Fecha;Hora;Consumo_kWh;Metodo_obtencion\nES0021000000000000AB;28/09/2026;1;0,250;R\nES0021000000000000AB;28/09/2026;11;1,5;R\nES0021000000000000AB;28/09/2026;24;0,3;E\n";
let p = parseConsumptionCSV(cnmc);
assert.deepEqual(p.rows, [{ date: "2026-09-28", hour: 0, kwh: 0.25 }, { date: "2026-09-28", hour: 10, kwh: 1.5 }, { date: "2026-09-28", hour: 23, kwh: 0.3 }]);
assert.equal(p.cups, "ES00…00AB");

// Variante: comas, fecha ISO, hora "HH:MM" (fin de intervalo), BOM y comillas.
p = parseConsumptionCSV('﻿"cups","fecha","hora","consumo","metodoObtencion"\n"ES1","2026/09/28","01:00","0.5","Real"\n"ES1","2026/09/28","24:00","0.7","Real"\n');
assert.deepEqual(p.rows.map((r) => [r.hour, r.kwh]), [[0, 0.5], [23, 0.7]]);

// Cuartohorario: se suma por hora.
p = parseConsumptionCSV("Fecha;Hora;AE_kWh\n28/09/2026;00:15;0,1\n28/09/2026;00:30;0,1\n28/09/2026;00:45;0,1\n28/09/2026;01:00;0,1\n28/09/2026;01:15;0,2\n");
assert.equal(p.rows.length, 2);
assert.ok(Math.abs(p.rows[0].kwh - 0.4) < 1e-9);
assert.equal(p.rows[1].hour, 1);

// Wh → kWh
p = parseConsumptionCSV("Fecha;Hora;Consumo (Wh)\n28/09/2026;1;250\n28/09/2026;2;1250\n");
assert.equal(p.unitWh, true);
assert.equal(p.rows[1].kwh, 1.25);

assert.throws(() => parseConsumptionCSV("hola;adiós\n1;2"), CsvError);
assert.throws(() => parseConsumptionCSV("Fecha;Hora;Consumo\nx;y;z"), CsvError);
assert.equal(maskCups(""), "");

// Resumen de un año de ejemplo.
const s = summarize(sampleRows(365));
assert.equal(s.nDays, 365);
assert.ok(s.kwh > 2000 && s.kwh < 4000, "consumo anual realista: " + s.kwh);
assert.ok(Math.abs(s.byPeriod.P1 + s.byPeriod.P2 + s.byPeriod.P3 - s.kwh) < 1e-6);
assert.equal(s.monthList.length, 12);
assert.ok(s.baseW > 50 && s.baseW < 200, "consumo base ≈ 120 W: " + s.baseW);
assert.equal(s.heat.length, 7);

// Factura: comprobación a mano de una oferta simple.
const bill = billFor({ P1: 100, P2: 100, P3: 100 }, 30, { type: "fixed", energy: [0.1], power: [0.1, 0.05], fee: 0 }, { p1: 4, p2: 4 });
assert.ok(Math.abs(bill.energy - 30) < 1e-9);
assert.ok(Math.abs(bill.power - 18) < 1e-9);
const expected = (30 + 18 + 48 * 0.0511269632 + 0.02663 * 30) * 1.21;
assert.ok(Math.abs(bill.total - expected) < 1e-9);

// Ranking: una oferta más barata en todo gana.
const r = rankOffers(s, [DEFAULT_OFFERS[0], { ...DEFAULT_OFFERS[0], name: "barata", energy: [0.05, 0.05, 0.05] }], { p1: 4.6, p2: 4.6 });
assert.equal(r[0].offer.name, "barata");

// Mover consumo a valle conserva el total.
const sh = shift({ P1: 100, P2: 50, P3: 10 }, 0.2);
assert.deepEqual(sh, { P1: 80, P2: 50, P3: 30 });
assert.ok(powerSavingPerYear(DEFAULT_OFFERS[0], 1) > 60 && powerSavingPerYear(DEFAULT_OFFERS[0], 1) < 90);

console.log("✓ Pruebas unitarias de la herramienta de luz correctas.");
