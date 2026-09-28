// Auditoría de accesibilidad (axe-core) de todas las páginas, en modo claro y oscuro.
//   npm i --no-save playwright axe-core && node build.mjs && node tests/e2e-a11y.cjs
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const { SITE, serve, newContext, checker } = require("./lib.cjs");

const axePath = process.env.AXE_LIB || require.resolve("axe-core/axe.min.js");
const AXE = fs.readFileSync(axePath, "utf8");

function htmlPages(dir, prefix = "/") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory()
    ? htmlPages(path.join(dir, e.name), prefix + e.name + "/")
    : e.name.endsWith(".html") ? [prefix + e.name.replace(/^index\.html$/, "")] : []).sort();
}

(async () => {
  const srv = await serve();
  const browser = await chromium.launch();
  const { check, failures } = checker();
  const pages = htmlPages(SITE);
  for (const colorScheme of ["light", "dark"]) {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 }, colorScheme });
    const page = await ctx.newPage();
    for (const p of pages) {
      await page.goto(srv.base + p);
      // En la herramienta de luz se audita también la vista de resultados (gráficos, tablas, formularios).
      if (await page.locator("#example-btn").count()) { await page.click("#example-btn"); await page.waitForSelector("#results:not([hidden])"); }
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations
        .map((x) => `${x.impact} ${x.id} (${x.nodes.length}): ${x.nodes[0].target.join(" ")}`));
      check(v.length === 0, `${colorScheme} ${p}` + (v.length ? " → " + v.join(" | ") : ""));
    }
    await ctx.close();
  }
  await browser.close();
  srv.server.close();
  console.log(failures() ? `\n${failures()} página(s) con problemas de accesibilidad` : `\nSin problemas de accesibilidad en ${pages.length} páginas (claro y oscuro).`);
  process.exit(failures() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
