// Pruebas de la monetización: afiliados, ofertas patrocinadas, placas solares, licencias Pro, DOCX, Telegram.
//   node tests/unit-monetizacion.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickAffiliates } from "../assets/js/afiliados.js";
import { solarEstimate, suggestSize, productionPerKwp } from "../assets/js/luz/solar.js";
import { sampleRows, periodOf, RULES } from "../assets/js/luz/core.js";
import { parseKey, verifyKey } from "../assets/js/pro.js";
import { newKeyPair, issueKey } from "../scripts/pro-keys.mjs";
import { toDOCX, crc32 } from "../assets/js/docx.js";

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

await test("Pro: desactivado por defecto y sin clave pública ni enlace de pago", () => {
  const pro = JSON.parse(readFileSync(new URL("../data/pro.json", import.meta.url), "utf8"));
  assert.equal(pro.enabled, false);
  assert.equal(pro.publicKey, null);
  assert.equal(pro.checkoutUrl, "");
  assert.equal(pro.price, "", "el precio lo decide el titular: no se inventa");
  assert.ok(readFileSync(new URL("../.gitignore", import.meta.url), "utf8").includes("pro-private-key.json"));
});

await test("Pro: una clave firmada se valida; alterada, con otra clave o mal formada, no", async () => {
  const { publicJwk, privateJwk } = await newKeyPair();
  const other = await newKeyPair();
  const key = await issueKey(privateJwk, "pedido-1", "2026-09-28");
  assert.match(key, /^HL1\.[\w-]+\.[\w-]+$/);
  assert.deepEqual(parseKey(key).data, { v: 1, id: "pedido-1", d: "2026-09-28" });
  assert.equal(await verifyKey(key, publicJwk), true);
  assert.equal(await verifyKey("  " + key + "\n", publicJwk), true, "se toleran espacios al pegar");
  assert.equal(await verifyKey(key, other.publicJwk), false);
  const [, data, sig] = key.split(".");
  const forged = "HL1." + Buffer.from(JSON.stringify({ v: 1, id: "pirata", d: "2026-09-28" })).toString("base64url") + "." + sig;
  assert.equal(await verifyKey(forged, publicJwk), false);
  assert.equal(await verifyKey(`HL1.${data}.${sig.slice(0, -2)}AA`, publicJwk), false);
  for (const bad of ["", "hola", "HL1.x", "HL2." + data + "." + sig]) assert.equal(await verifyKey(bad, publicJwk), false, bad);
  assert.equal(await verifyKey(key, null), false);
  assert.ok(!JSON.stringify(parseKey(key).data).includes("@"), "la clave no lleva datos personales");
});

await test("Word: ZIP válido (firmas y CRC) con el texto escapado", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const out = toDOCX([{ time: "0:05", text: "Hola <mundo> & «ñandú»" }, { text: "Adiós." }], { title: "Acta" });
  const dv = new DataView(out.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  const end = out.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50);
  assert.equal(dv.getUint16(end + 10, true), 3);
  // Recorre las entradas locales y comprueba el CRC de cada una.
  const names = [];
  let o = 0;
  const dec = new TextDecoder();
  let doc = "";
  while (dv.getUint32(o, true) === 0x04034b50) {
    const size = dv.getUint32(o + 18, true), nl = dv.getUint16(o + 26, true);
    const name = dec.decode(out.subarray(o + 30, o + 30 + nl));
    const data = out.subarray(o + 30 + nl, o + 30 + nl + size);
    assert.equal(crc32(data), dv.getUint32(o + 14, true), name);
    names.push(name);
    if (name === "word/document.xml") doc = dec.decode(data);
    o += 30 + nl + size;
  }
  assert.deepEqual(names, ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]);
  assert.ok(doc.includes("Hola &lt;mundo&gt; &amp; «ñandú»") && doc.includes("[0:05] ") && doc.includes(">Acta<"));
});

console.log(`\n${n} pruebas de monetización correctas.`);
