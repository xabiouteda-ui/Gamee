// Pruebas del SEO técnico: sitemap con lastmod real, datos estructurados, migas de pan, enlazado interno e IndexNow.
// Necesita la web generada (`node build.mjs`).   node tests/unit-seo.mjs
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { parseSitemap, pickUrls } from "../scripts/indexnow.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = join(ROOT, "_site");
const site = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
const read = (f) => readFileSync(join(SITE, f), "utf8");
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("✓ " + name); };

await test("Sitemap: lastmod con fecha válida en cada URL y sin páginas noindex", () => {
  const entries = parseSitemap(read("sitemap.xml"));
  assert.ok(entries.length >= 30);
  for (const e of entries) assert.match(e.lastmod, /^\d{4}-\d{2}-\d{2}$/, e.loc);
  assert.ok(!entries.some((e) => /404|widget\/luz-hoy|pro\.html/.test(e.loc)));
});

await test("IndexNow: archivo de clave en la raíz y selección de URL", () => {
  assert.match(site.indexNowKey, /^[a-f0-9]{32}$/);
  assert.equal(read(`${site.indexNowKey}.txt`), site.indexNowKey);
  const e = [{ loc: "a", lastmod: "2026-09-29" }, { loc: "b", lastmod: "2026-09-01" }];
  assert.deepEqual(pickUrls(e, "all", "2026-09-29"), ["a", "b"]);
  assert.deepEqual(pickUrls(e, "today", "2026-09-29"), ["a"]);
});

await test("IndexNow: envía host, clave y URL del sitemap publicado (servidor simulado)", async () => {
  let posted = null;
  const srv = createServer((req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    if (req.method === "POST" && path === "/indexnow") {
      let body = ""; req.on("data", (c) => (body += c));
      req.on("end", () => { posted = JSON.parse(body); res.writeHead(202); res.end(); });
      return;
    }
    const f = join(SITE, path);
    if (!existsSync(f)) { res.writeHead(404); return res.end(); }
    const text = readFileSync(f, "utf8").replaceAll(site.siteOrigin, `http://127.0.0.1:${srv.address().port}`);
    res.writeHead(200); res.end(text);
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${srv.address().port}`;
  const out = await new Promise((resolve) => execFile(process.execPath, ["scripts/indexnow.mjs", "all"], {
    cwd: ROOT, env: { ...process.env, SITE_ORIGIN: origin, BASE_PATH: "/", INDEXNOW_ENDPOINT: origin + "/indexnow" },
  }, (err, stdout) => resolve(stdout)));
  srv.close();
  assert.match(out, /IndexNow: \d+ URL enviadas \(HTTP 202\)/);
  assert.equal(posted.key, site.indexNowKey);
  assert.equal(posted.host, new URL(origin).host);
  assert.equal(posted.keyLocation, `${origin}/${site.indexNowKey}.txt`);
  assert.ok(posted.urlList.includes(`${origin}/luz/precio-luz-hoy.html`));
});

await test("Datos estructurados: WebApplication, FAQ, migas de pan y Dataset del PVPC", () => {
  const hoy = ld(read("luz/precio-luz-hoy.html"));
  const types = hoy.map((s) => s["@type"]);
  for (const t of ["WebApplication", "FAQPage", "BreadcrumbList", "Dataset"]) assert.ok(types.includes(t), t);
  const ds = hoy.find((s) => s["@type"] === "Dataset");
  assert.ok(ds.description.length >= 50 && ds.distribution[0].contentUrl.endsWith("/data/pvpc.json"));
  const bc = hoy.find((s) => s["@type"] === "BreadcrumbList").itemListElement;
  assert.deepEqual(bc.map((x) => x.position), [1, 2, 3]);
  assert.ok(bc.every((x) => x.item.startsWith(site.siteOrigin)));
  const home = ld(read("index.html")).map((s) => s["@type"]);
  assert.ok(home.includes("Organization") && home.includes("WebSite"));
});

await test("Enlazado interno: cada guía enlaza a las demás de su sección", () => {
  const html = read("luz/potencia-contratada.html");
  assert.match(html, /<nav class="guides"/);
  assert.ok(html.includes('href="../luz/precio-luz-hoy.html"'));
  assert.ok(!/<nav class="guides"[\s\S]*potencia-contratada\.html[\s\S]*<\/nav>/.test(html.match(/<nav class="guides"[\s\S]*?<\/nav>/)[0]), "no se enlaza a sí misma");
  assert.ok(!read("index.html").includes('class="crumbs"'), "la portada no lleva migas");
});

await test("Títulos únicos y descripciones únicas en todas las páginas indexables", () => {
  const seen = { t: new Map(), d: new Map() };
  for (const { loc } of parseSitemap(read("sitemap.xml"))) {
    const rel = loc.slice(site.siteOrigin.length + 1) || "index.html";
    const html = read(rel.endsWith("/") ? rel + "index.html" : rel);
    const t = html.match(/<title>([^<]*)/)[1], d = html.match(/name="description" content="([^"]*)/)[1];
    assert.ok(!seen.t.has(t), `Título repetido: ${t} (${rel} y ${seen.t.get(t)})`);
    assert.ok(!seen.d.has(d), `Descripción repetida en ${rel}`);
    seen.t.set(t, rel); seen.d.set(d, rel);
  }
});

console.log(`${n} pruebas de SEO correctas.`);
