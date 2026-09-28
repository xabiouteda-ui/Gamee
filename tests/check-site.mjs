// Comprobaciones estáticas de la web generada (_site/). Sin dependencias: `node tests/check-site.mjs`.
// Se ejecuta en GitHub Actions antes de publicar.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { STRINGS } from "../assets/js/i18n.js";
import { clock, stamp, toTXT, toSRT, toVTT } from "../assets/js/format.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "_site");
let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error("✗ " + msg); } };

// 1. Textos: mismas claves en español e inglés.
const es = Object.keys(STRINGS.es).sort(), en = Object.keys(STRINGS.en).sort();
check(JSON.stringify(es) === JSON.stringify(en), "i18n: las claves de es y en no coinciden");

// 2. Formatos de exportación.
const segs = [{ start: 0, end: 2.5, text: " Hola mundo." }, { start: 3661.2, end: 3663.04, text: "Adiós. " }];
assert.equal(clock(0), "0:00");
assert.equal(clock(75), "1:15");
assert.equal(clock(3661.9), "1:01:01");
assert.equal(stamp(3661.2, ","), "01:01:01,200");
assert.equal(toTXT(segs, false), "Hola mundo. Adiós.\n");
assert.equal(toTXT(segs, true), "[0:00] Hola mundo.\n[1:01:01] Adiós.\n");
assert.equal(toSRT(segs), "1\n00:00:00,000 --> 00:00:02,500\nHola mundo.\n\n2\n01:01:01,200 --> 01:01:03,040\nAdiós.\n");
assert.equal(toVTT(segs).split("\n")[0], "WEBVTT");
assert.ok(toVTT(segs).includes("01:01:01.200 --> 01:01:03.040"));

// 3. Páginas HTML.
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
check(existsSync(SITE), "Falta _site/: ejecuta antes `node build.mjs`");
const htmlFiles = walk(SITE).filter((f) => f.endsWith(".html"));
check(htmlFiles.length >= 12, `Se esperaban al menos 12 páginas y hay ${htmlFiles.length}`);

for (const file of htmlFiles) {
  const rel = file.slice(SITE.length + 1);
  const html = readFileSync(file, "utf8");
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
  check(title.length >= 10 && title.length <= 70, `${rel}: título de ${title.length} caracteres (ideal 10–70)`);
  check(desc.length >= 50 && desc.length <= 170, `${rel}: descripción de ${desc.length} caracteres (ideal 50–170)`);
  check((html.match(/<h1[\s>]/g) || []).length === 1, `${rel}: debe tener exactamente un <h1>`);
  check(/<link rel="canonical" href="https?:\/\//.test(html), `${rel}: falta canonical absoluto`);
  check(/<html lang="(es|en)">/.test(html), `${rel}: falta lang en <html>`);
  check(!/\{\{[^}]*\}\}/.test(html), `${rel}: quedan marcadores {{...}} sin reemplazar`);
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { check(false, `${rel}: JSON-LD no válido`); }
  }
  // Enlaces internos relativos: deben apuntar a archivos existentes.
  if (rel !== "404.html") {
    for (const m of html.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
      const url = m[1];
      if (/^(https?:|mailto:|data:)/.test(url)) continue;
      let target = resolve(dirname(file), url);
      if (url.endsWith("/") || existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
      check(existsSync(target), `${rel}: enlace roto → ${url}`);
    }
  }
  // Anuncios desactivados por defecto: no debe cargarse nada de AdSense en el HTML.
  check(!html.includes("googlesyndication"), `${rel}: el HTML no debe cargar AdSense directamente`);
}

// 4. Archivos auxiliares.
check(existsSync(join(SITE, "sitemap.xml")), "Falta sitemap.xml");
check(existsSync(join(SITE, "robots.txt")), "Falta robots.txt");
check(existsSync(join(SITE, ".nojekyll")), "Falta .nojekyll");
const sitemap = readFileSync(join(SITE, "sitemap.xml"), "utf8");
check(!sitemap.includes("404"), "La página 404 no debe estar en el sitemap");
for (const p of ["privacidad.html", "aviso-legal.html", "contacto.html", "preguntas-frecuentes.html", "en/privacy.html"]) {
  check(existsSync(join(SITE, p)), `Falta la página ${p}`);
}

if (failures) {
  console.error(`\n${failures} comprobación(es) fallida(s).`);
  process.exit(1);
}
console.log(`✓ ${htmlFiles.length} páginas comprobadas, formatos de exportación correctos.`);
