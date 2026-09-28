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

// ---------- Formatos reales de distribuidoras (tests/fixtures) ----------
import { readFileSync } from "node:fs";
import { parseREE, summarizePvpc, pvpcEnergy, dayStats } from "../assets/js/luz/pvpc.js";
import { quickSummary, billFromEnergy } from "../assets/js/luz/core.js";
const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
for (const f of ["consumo-cnmc-ide.csv", "consumo-edistribucion.csv", "consumo-datadis.csv"]) {
  const r = parseConsumptionCSV(fx(f));
  assert.deepEqual(r.rows.map((x) => [x.date, x.hour, x.kwh]), [
    ["2026-09-07", 0, 0.215], ["2026-09-07", 1, 0.198], ["2026-09-07", 10, 1.032], ["2026-09-07", 18, 0.876], ["2026-09-07", 23, 0.301],
  ], f + ": lee consumo (no vertido) y horas");
  assert.ok(r.cups.startsWith("ES00") && r.cups.includes("…"), f + ": CUPS enmascarado");
}

// ---------- PVPC (respuesta con la forma de apidatos.ree.es) ----------
const ree = {
  data: { type: "Precios mercado peninsular en tiempo real" },
  included: [
    { type: "Precio mercado spot (€/MWh)", attributes: { title: "Precio mercado spot (€/MWh)", values: [{ value: 50, datetime: "2026-09-28T00:00:00.000+02:00" }] } },
    { type: "PVPC (€/MWh)", attributes: { title: "PVPC (€/MWh)", values: [
      { value: 100, percentage: 1, datetime: "2026-09-28T00:00:00.000+02:00" },
      { value: 120, percentage: 1, datetime: "2026-09-28T00:15:00.000+02:00" }, // cuartohorario → media
      { value: 250, percentage: 1, datetime: "2026-09-28T19:00:00.000+02:00" },
    ] } },
  ],
};
const days = parseREE(ree);
assert.equal(days["2026-09-28"][0], 0.11, "media de los valores de la hora, en €/kWh");
assert.equal(days["2026-09-28"][19], 0.25);
assert.equal(days["2026-09-28"][5], null);
assert.throws(() => parseREE({ included: [] }));

// Un año de PVPC sintético: punta 0,20, llano 0,14, valle 0,08 €/kWh.
const synth = {};
for (let d = 0; d < 400; d++) {
  const date = new Date(Date.UTC(2025, 7, 25) + d * 86400000).toISOString().slice(0, 10);
  synth[date] = Array.from({ length: 24 }, (_, h) => ({ P1: 0.2, P2: 0.14, P3: 0.08 })[periodOf(date, h)]);
}
const pv = summarizePvpc(synth, "2026-09-28T19:30:00Z");
assert.deepEqual(pv.avg365, { P1: 0.2, P2: 0.14, P3: 0.08 });
assert.equal(pv.from, "2025-08-25");
const rowsPv = [{ date: "2026-09-28", hour: 12, kwh: 2 }, { date: "2026-09-28", hour: 3, kwh: 1 }, { date: "2030-01-01", hour: 3, kwh: 1 }];
const e = pvpcEnergy(rowsPv, pv);
assert.ok(Math.abs(e.energy - (2 * 0.2 + 0.08 + 0.08)) < 1e-9, "hora sin precio → media de su periodo");
assert.ok(Math.abs(e.coverage - 2 / 3) < 1e-9);
const ds = dayStats(pv, "2026-09-28");
assert.equal(ds.min.p, 0.08);
assert.deepEqual(ds.cheapest, [0, 1, 2]);
assert.equal(ds.best3.start, 0);
assert.equal(dayStats(pv, "1999-01-01"), null);

// Cálculo rápido y factura desde energía.
const q = quickSummary(250, 0.4);
assert.equal(q.kwh, 3000);
assert.ok(Math.abs(q.byPeriod.P3 - 1200) < 1e-9 && Math.abs(q.byPeriod.P1 + q.byPeriod.P2 - 1800) < 1e-9);
const b1 = billFor({ P1: 10, P2: 10, P3: 10 }, 30, { type: "fixed", energy: [0.1], power: [0.1, 0.1] }, { p1: 4, p2: 4 });
const b2 = billFromEnergy(3, 30, { power: [0.1, 0.1] }, { p1: 4, p2: 4 });
assert.ok(Math.abs(b1.total - b2.total) < 1e-9);

// Catálogo de tarifas: estructura válida y fuentes.
const cat = JSON.parse(readFileSync(new URL("../data/ofertas.json", import.meta.url), "utf8"));
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(cat.verified));
assert.equal(cat.pvpcPower.power.length, 2);
for (const o of cat.offers) {
  assert.ok(o.id && o.company && o.name, "tarifa con nombre");
  assert.ok(o.type === "fixed" ? o.energy.length === 1 : o.energy.length === 3, o.id + ": precios de energía");
  assert.ok(o.energy.every((x) => x > 0.02 && x < 0.5), o.id + ": €/kWh razonables");
  assert.ok(o.power.length === 2 && o.power.every((x) => x >= 0 && x < 0.3), o.id + ": €/kW·día razonables");
  assert.ok(/^https:\/\//.test(o.official) && o.verifiedFrom, o.id + ": fuente");
}
console.log("✓ Formatos reales de CSV, PVPC y catálogo de tarifas correctos.");
