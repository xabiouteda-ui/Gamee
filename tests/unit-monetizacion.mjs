// Pruebas de la monetización: afiliados, ofertas patrocinadas, placas solares, licencias Pro, DOCX, Telegram.
//   node tests/unit-monetizacion.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickAffiliates } from "../assets/js/afiliados.js";
import { solarEstimate, suggestSize, productionPerKwp } from "../assets/js/luz/solar.js";
import { sampleRows, periodOf, RULES } from "../assets/js/luz/core.js";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("✓ " + name); };

const cfg = JSON.parse(readFileSync(new URL("../data/afiliados.json", import.meta.url), "utf8"));

await test("Afiliados desactivados por defecto (general y cada enlace, sin URL)", () => {
  assert.equal(cfg.enabled, false);
  for (const it of cfg.items) { assert.equal(it.enabled, false); assert.equal(it.url, ""); assert.ok(it.es?.title && it.en?.title, it.id); }
  assert.deepEqual(pickAffiliates(cfg, "subtitulos", "es"), []);
});

await test("Afiliados: solo los activados, con https, de esa pantalla e idioma", () => {
  const on = structuredClone(cfg);
  on.enabled = true;
  on.items[0].enabled = true; on.items[0].url = "https://example.com/ref?a=1"; // subtítulos + transcripción
  on.items[1].enabled = true; on.items[1].url = "http://inseguro.example"; // sin https: se ignora
  on.items[3].enabled = true; on.items[3].url = "https://example.org/r"; // solo transcripción
  on.items[2].url = "https://example.net"; // con URL pero desactivado
  assert.deepEqual(pickAffiliates(on, "subtitulos", "es").map((x) => x.id), ["voz-doblaje"]);
  assert.deepEqual(pickAffiliates(on, "transcripcion", "en").map((x) => x.id), ["voz-doblaje", "transcripcion-humana"]);
  on.max = 1;
  assert.equal(pickAffiliates(on, "transcripcion", "es").length, 1);
  on.enabled = false;
  assert.deepEqual(pickAffiliates(on, "transcripcion", "es"), []);
});

const ofertas = JSON.parse(readFileSync(new URL("../data/ofertas.json", import.meta.url), "utf8"));

await test("Luz: patrocinios desactivados por defecto y ninguna tarifa marcada", () => {
  assert.equal(ofertas.sponsoredEnabled, false);
  assert.ok(ofertas.offers.every((o) => !o.sponsored && !o.affiliateUrl));
});

await test("Placas: 1 kWp produce al año lo indicado para la zona y nada de noche", () => {
  const rows = sampleRows(365, "2025-01-01");
  const total = rows.reduce((a, r) => a + productionPerKwp(r.date, r.hour, 1350), 0);
  assert.ok(Math.abs(total - 1350) < 15, "producción anual " + total);
  for (const h of [0, 3, 22, 23]) assert.equal(productionPerKwp("2025-06-21", h, 1350), 0);
  assert.ok(productionPerKwp("2025-06-21", 14, 1350) > productionPerKwp("2025-12-21", 14, 1350));
});

await test("Placas: el autoconsumo no supera ni la producción ni el consumo; el ahorro incluye impuestos", () => {
  const rows = sampleRows(365, "2025-01-01");
  const price = { P1: 0.2, P2: 0.12, P3: 0.08 };
  const o = { yearlyYield: 1350, costPerKwp: 1300, surplusPrice: 0.06, priceAt: (d, h) => price[periodOf(d, h)] };
  const small = solarEstimate(rows, { ...o, kwp: 1.5 }), big = solarEstimate(rows, { ...o, kwp: 6 });
  for (const e of [small, big]) {
    assert.ok(e.selfUse <= e.production + 1e-9 && e.selfUse <= e.consumption + 1e-9);
    assert.ok(Math.abs(e.selfUse + e.surplus - e.production) < 1e-6);
    assert.equal(e.cost, e.kwp * 1300);
  }
  assert.ok(big.selfShare < small.selfShare, "cuanto más grande, menos parte de lo producido se usa en el momento");
  assert.ok(big.savingYear > small.savingYear);
  // Sin excedentes pagados, el ahorro es la energía autoconsumida × precio × impuestos.
  const noSurplus = solarEstimate(rows, { ...o, kwp: 1.5, surplusPrice: 0 });
  const kwhSaved = rows.reduce((a, r) => a + Math.min(r.kwh, 1.5 * productionPerKwp(r.date, r.hour, 1350)) * price[periodOf(r.date, r.hour)], 0);
  assert.ok(Math.abs(noSurplus.savingYear - kwhSaved * (1 + RULES.electricityTax) * (1 + RULES.vat)) < 0.01);
  // Compensación simplificada: los excedentes nunca descuentan más que la energía comprada a la red en el mes.
  const huge = solarEstimate(rows, { ...o, kwp: 50, surplusPrice: 5 });
  const maxSaving = rows.reduce((a, r) => a + r.kwh * price[periodOf(r.date, r.hour)], 0) * (1 + RULES.electricityTax) * (1 + RULES.vat);
  assert.ok(huge.savingYear <= maxSaving + 0.01);
  const s = suggestSize(rows, o);
  assert.ok(s.kwp >= 1.5 && s.kwp <= 8 && Number.isFinite(s.payback));
});

console.log(`\n${n} pruebas de monetización correctas.`);
