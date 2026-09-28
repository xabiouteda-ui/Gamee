// Pruebas de la monetización: afiliados, ofertas patrocinadas, placas solares, licencias Pro, DOCX, Telegram.
//   node tests/unit-monetizacion.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickAffiliates } from "../assets/js/afiliados.js";

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

console.log(`\n${n} pruebas de monetización correctas.`);
