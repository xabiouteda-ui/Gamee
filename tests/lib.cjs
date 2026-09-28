// Utilidades compartidas por las pruebas end-to-end: servidor estático bajo la ruta base y
// contexto de navegador que sirve las librerías de CDN desde copias locales o simuladores.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const SITE = path.join(__dirname, "..", "_site");
const PUBLIC_URL = fs.readFileSync(path.join(SITE, "index.html"), "utf8").match(/<link rel="canonical" href="([^"]+)"/)[1];
const BASE_PATH = new URL(PUBLIC_URL).pathname;
const CDN = {
  transformers: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js",
  mediabunny: "https://cdn.jsdelivr.net/npm/mediabunny@1.60.0/dist/bundles/mediabunny.min.mjs",
};

function localMediabunny() {
  if (process.env.MEDIABUNNY_LIB) return process.env.MEDIABUNNY_LIB;
  try { return require.resolve("mediabunny/dist/bundles/mediabunny.min.mjs"); } catch { return null; }
}

function serve() {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain", ".woff2": "font/woff2" };
  const outside = [];
  const notFound = (res) => { res.writeHead(404, { "Content-Type": types[".html"] }); res.end(fs.readFileSync(path.join(SITE, "404.html"))); };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (!p.startsWith(BASE_PATH)) { outside.push(p); return notFound(res); }
    p = "/" + p.slice(BASE_PATH.length);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(SITE, p);
    if (!file.startsWith(SITE) || !fs.existsSync(file)) return notFound(res);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => {
    const origin = `http://127.0.0.1:${server.address().port}`;
    r({ server, origin, base: origin + BASE_PATH.replace(/\/$/, ""), outside });
  }));
}

// libs: { [cdnUrl]: contenido JS } ; lo demás de fuera del servidor local se bloquea y se anota.
async function newContext(browser, srv, opts = {}, libs = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, ...opts });
  const external = [];
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (libs[url] != null) return route.fulfill({ contentType: "text/javascript", body: libs[url], headers: { "Access-Control-Allow-Origin": "*" } });
    if (url.startsWith(srv.origin)) return route.continue();
    if (url.startsWith(PUBLIC_URL)) {
      const r = await fetch(srv.base + "/" + url.slice(PUBLIC_URL.length));
      return route.fulfill({ status: r.status, contentType: r.headers.get("content-type") || undefined, body: Buffer.from(await r.arrayBuffer()) });
    }
    external.push(url);
    return route.abort();
  });
  return { ctx, external };
}

function checker() {
  let failures = 0;
  const check = (cond, msg) => {
    console.log((cond ? "✓ " : "✗ ") + msg);
    if (!cond) failures++;
  };
  return { check, failures: () => failures };
}

module.exports = { SITE, PUBLIC_URL, BASE_PATH, CDN, localMediabunny, serve, newContext, checker };
