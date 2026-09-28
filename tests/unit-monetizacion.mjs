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
import { buildMessage } from "../scripts/telegram-pvpc.mjs";
import { dayStats } from "../assets/js/luz/pvpc.js";
import { createServer } from "node:http";
import { execFile } from "node:child_process";

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

// Precios de un día de prueba: baratos de 2 a 5, caros de 19 a 21.
const PRICES = Array.from({ length: 24 }, (_, h) => (h >= 2 && h <= 4 ? 0.05 + h / 1000 : h >= 19 && h <= 21 ? 0.25 + h / 1000 : 0.12));

await test("Telegram: mensaje con horas más baratas, más caras, mejor franja y enlace", () => {
  const st = dayStats({ days: { "2026-09-29": PRICES } }, "2026-09-29");
  const msg = buildMessage(st, "https://ejemplo.es/luz/precio-luz-hoy.html?a=1&b=2");
  assert.match(msg, /Precio de la luz mañana, martes, 29 de septiembre/);
  assert.match(msg, /Más baratas:<\/b> 02:00–03:00 \(0,052\), 03:00–04:00 \(0,053\), 04:00–05:00 \(0,054\)/);
  assert.match(msg, /Más caras:<\/b> 19:00–20:00 \(0,269\), 20:00–21:00 \(0,270\), 21:00–22:00 \(0,271\)/);
  assert.match(msg, /Mejor franja de 3 h:<\/b> 02:00–05:00/);
  assert.ok(msg.includes('href="https://ejemplo.es/luz/precio-luz-hoy.html?a=1&amp;b=2"'), "URL escapada en HTML");
  assert.ok(msg.length < 4096, "cabe en un mensaje de Telegram");
});

// Ejecuta el script contra un servidor local que simula REE y Telegram.
async function runTelegram(env, { reeStatus = 200 } = {}) {
  const sent = [];
  const srv = createServer((req, res) => {
    if (req.url.startsWith("/ree")) {
      const date = new URL(req.url, "http://x").searchParams.get("start_date").slice(0, 10);
      if (reeStatus !== 200) { res.writeHead(reeStatus); return res.end(); }
      const values = PRICES.map((p, h) => ({ value: p * 1000, datetime: `${date}T${String(h).padStart(2, "0")}:00:00.000+02:00` }));
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ included: [{ type: "PVPC", attributes: { title: "PVPC", values } }] }));
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => { sent.push({ url: req.url, body: JSON.parse(body) }); res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}'); });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const out = await new Promise((resolve) => execFile(process.execPath, ["scripts/telegram-pvpc.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { PATH: process.env.PATH, REE_API: base + "/ree", TELEGRAM_API: base, RETRY_MS: "10", ...env },
  }, (err, stdout) => resolve({ code: err?.code ?? 0, stdout })));
  srv.close();
  return { ...out, sent };
}

await test("Telegram: sin secretos no publica y no falla", async () => {
  const r = await runTelegram({});
  assert.equal(r.code, 0);
  assert.equal(r.sent.length, 0);
  assert.match(r.stdout, /Faltan los secretos/);
});

await test("Telegram: con secretos publica el precio de mañana en el canal", async () => {
  const r = await runTelegram({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "@canal" });
  assert.equal(r.code, 0);
  assert.equal(r.sent.length, 1);
  assert.equal(r.sent[0].url, "/bot123:abc/sendMessage");
  assert.equal(r.sent[0].body.chat_id, "@canal");
  assert.equal(r.sent[0].body.parse_mode, "HTML");
  assert.match(r.sent[0].body.text, /Más baratas/);
  assert.ok(!r.stdout.includes("123:abc"), "el token no aparece en el registro");
});

await test("Telegram: si REE no tiene los precios, avisa y termina bien", async () => {
  const r = await runTelegram({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "@canal" }, { reeStatus: 500 });
  assert.equal(r.code, 0);
  assert.equal(r.sent.length, 0);
  assert.match(r.stdout, /No hay precios del PVPC/);
});

console.log(`\n${n} pruebas de monetización correctas.`);
