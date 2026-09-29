// Genera las imágenes para directorios y Product Hunt en marketing/assets/ (logo y capturas de las herramientas).
// Genera la web SIN data/pvpc.json local (las capturas no deben mostrar precios de prueba). Playwright:  node scripts/marketing-assets.mjs
import { createRequire } from "node:module";
import { copyFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { serve } = require("../tests/lib.cjs");

const OUT = new URL("../marketing/assets/", import.meta.url).pathname;
const srv = await serve();
const browser = await chromium.launch();
const logo = await browser.newPage({ viewport: { width: 512, height: 512 } });
await logo.setContent(`<body style="margin:0"><svg viewBox="0 0 32 32" width="512" height="512"><rect width="32" height="32" rx="8" fill="#4f46e5"/><path d="M8 13v6M12 10v12M16 7v18M20 11v10M24 14v4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></body>`);
await logo.screenshot({ path: OUT + "logo-512.png", omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.route("**/*", (r) => (r.request().url().startsWith(srv.origin) ? r.continue() : r.abort()));
const page = await ctx.newPage();
for (const [name, path] of [["captura-portada", "/"], ["captura-luz", "/luz/"], ["captura-subtitulos", "/subtitulos-animados/"], ["captura-transcripcion", "/pasar-audio-a-texto/"], ["en-captions", "/en/animated-captions/"]]) {
  await page.goto(srv.base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${name}.png` });
}
copyFileSync(new URL("../assets/img/og.jpg", import.meta.url).pathname, OUT + "portada-1200x630.jpg");
await browser.close();
srv.server.close();
console.log("Imágenes en marketing/assets/");
