// Prueba end-to-end en Chromium con Playwright.
//
//   npm i -D playwright   (o usa uno instalado globalmente con PLAYWRIGHT_PATH)
//   node build.mjs && node tests/e2e.cjs
//
// El motor de IA (Transformers.js) se sustituye por un simulador para que la prueba no dependa de
// descargar modelos de cientos de MB: así se prueba todo el flujo real de la web (leer el audio,
// trocearlo en el worker, mostrar progreso, editar y exportar). Si pasas REAL_LIB=/ruta/transformers.min.js
// también se comprueba que la librería real carga dentro del worker.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const SITE = path.join(__dirname, "..", "_site");
const OUT = process.env.SHOTS || path.join(__dirname, "..", "test-results");
const LIB_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js";

const MOCK_LIB = `
export const env = {};
export class Tensor { constructor(type, data, dims) { this.type = type; this.data = data; this.dims = dims; } }
let n = 0;
export async function pipeline(task, model, opts) {
  if (task !== "automatic-speech-recognition") throw new Error("tarea inesperada");
  for (let i = 1; i <= 4; i++) { opts.progress_callback?.({ status: "progress_total", loaded: i * 25e6, total: 100e6 }); await new Promise(r => setTimeout(r, 50)); }
  const fn = async (audio, o) => {
    n++;
    const d = audio.length / 16000;
    await new Promise(r => setTimeout(r, 150));
    return { text: "", chunks: [
      { timestamp: [0, d / 2], text: " Fragmento " + n + " (" + o.language + ", " + o.task + ")." },
      { timestamp: [d / 2, null], text: " Segunda parte." },
    ] };
  };
  fn.processor = async () => ({ input_features: {} });
  fn.model = {
    generation_config: { decoder_start_token_id: 1, lang_to_id: { "<|en|>": 4, "<|es|>": 5 } },
    generate: async () => ({ sequences: { tolist: () => [[1n, 5n]] } }),
  };
  fn.dispose = async () => {};
  return fn;
}`;

// WAV estéreo de 44,1 kHz y 75 s: "voz" (tonos modulados) con pausas y un tramo de silencio total.
function makeWav(seconds = 75, rate = 44100) {
  const n = seconds * rate, ch = 2;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * ch * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const silent = (t % 7 > 6.2) || (t > 60 && t < 68);
    const v = silent ? 0 : 0.3 * Math.sin(2 * Math.PI * 220 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t));
    const s = Math.round(v * 32767);
    buf.writeInt16LE(s, 44 + i * 4); buf.writeInt16LE(s, 46 + i * 4);
  }
  return buf;
}

// La web se sirve bajo la misma ruta base que en producción (p. ej. /game/), leída del canonical de la
// portada. Cualquier petición fuera de esa ruta es un error: significa que algo usa rutas "/..." absolutas.
const PUBLIC_URL = fs.readFileSync(path.join(SITE, "index.html"), "utf8").match(/<link rel="canonical" href="([^"]+)"/)[1];
const BASE_PATH = new URL(PUBLIC_URL).pathname; // "/game/" o "/"
const outsideBase = [];
const TOOL = "/pasar-audio-a-texto/", TOOL_EN = "/en/audio-to-text/";


function serve() {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };
  const notFound = (res) => { res.writeHead(404, { "Content-Type": types[".html"] }); res.end(fs.readFileSync(path.join(SITE, "404.html"))); };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (!p.startsWith(BASE_PATH)) { outsideBase.push(p); return notFound(res); }
    p = "/" + p.slice(BASE_PATH.length);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(SITE, p);
    if (!file.startsWith(SITE) || !fs.existsSync(file)) return notFound(res);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r(server)));
}

let failures = 0;
function check(cond, msg) {
  console.log((cond ? "✓ " : "✗ ") + msg);
  if (!cond) failures++;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const wavPath = path.join(OUT, "prueba.wav");
  fs.writeFileSync(wavPath, makeWav());
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const base = origin + BASE_PATH.replace(/\/$/, ""); // p. ej. http://127.0.0.1:1234/game
  console.log(`Sirviendo _site/ en ${base}/ (URL pública: ${PUBLIC_URL})`);
  const browser = await chromium.launch();

  async function newContext(opts = {}, { lib = MOCK_LIB, config = null, affiliates = null, pro = null } = {}) {
    const ctx = await browser.newContext({ acceptDownloads: true, ...opts });
    const external = [];
    await ctx.route("**/*", async (route) => {
      const url = route.request().url();
      if (url === LIB_URL) return route.fulfill({ contentType: "text/javascript", body: lib, headers: { "Access-Control-Allow-Origin": "*" } });
      if (config && url.endsWith("/assets/js/config.js")) return route.fulfill({ contentType: "text/javascript", body: config });
      if (pro && url.endsWith("/data/pro.json")) return route.fulfill({ contentType: "application/json", body: pro });
      if (affiliates && url.endsWith("/data/afiliados.json")) return route.fulfill({ contentType: "application/json", body: affiliates });
      if (url.startsWith(origin)) return route.continue();
      // El beacon de Cloudflare Web Analytics (sin cookies) se sustituye por un script vacío: no es un tercero de la herramienta.
      if (url.startsWith("https://static.cloudflareinsights.com/")) return route.fulfill({ contentType: "text/javascript", body: "" });
      // URLs absolutas a la web pública (canonical, 404…) se sirven desde el servidor local.
      if (url.startsWith(PUBLIC_URL)) {
        return fetch(base + "/" + url.slice(PUBLIC_URL.length))
          .then(async (r) => route.fulfill({ status: r.status, contentType: r.headers.get("content-type") || undefined, body: Buffer.from(await r.arrayBuffer()) }));
      }
      external.push(url);
      return route.abort();
    });
    return { ctx, external };
  }

  // ---------- 0. Recomendaciones de afiliado (activadas solo en esta prueba) ----------
  {
    const aff = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "afiliados.json"), "utf8"));
    aff.enabled = true;
    for (const it of aff.items) { it.enabled = true; it.url = "https://example.com/ref/" + it.id; }
    const { ctx, external } = await newContext({ viewport: { width: 1280, height: 900 } }, { affiliates: JSON.stringify(aff) });
    const page = await ctx.newPage();
    await page.goto(base + TOOL);
    check(await page.locator("#afiliados").isHidden(), "Afiliados: nada antes de usar la herramienta");
    await page.setInputFiles("#file-input", wavPath);
    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="ok"]', { timeout: 30000 });
    await page.waitForSelector("#afiliados:not([hidden])", { timeout: 5000 }).catch(() => {});
    const links = page.locator("#afiliados a[rel~=sponsored]");
    const ids = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href").split("/").pop()));
    check(ids.join() === "voz-doblaje,transcripcion-humana,traduccion", "Afiliados: tras transcribir salen solo los de transcripción (" + ids.join() + ")");
    check((await links.first().getAttribute("rel")) === "sponsored nofollow noopener", "Afiliados: rel=\"sponsored nofollow\"");
    check((await page.locator("#afiliados .aff-tag").count()) === 3 && /Enlace de afiliado/.test(await page.textContent("#afiliados")), "Afiliados: cada uno lleva la etiqueta «Enlace de afiliado»");
    check(!external.length, "Afiliados: no se pide nada a terceros hasta que se pulsa");
    await page.click("#new-btn");
    check(await page.locator("#afiliados").isHidden(), "Afiliados: se ocultan al empezar otra transcripción");
    await ctx.close();
  }

  // ---------- 0b. Pro: exportar a Word con una licencia válida ----------
  {
    const { newKeyPair, issueKey } = await import("../scripts/pro-keys.mjs");
    const { publicJwk, privateJwk } = await newKeyPair();
    const pro = JSON.stringify({ enabled: true, checkoutUrl: "https://example.com/pagar", publicKey: publicJwk });
    const { ctx } = await newContext({ viewport: { width: 1280, height: 900 } }, { pro });
    const page = await ctx.newPage();
    await page.goto(base + TOOL);
    await page.setInputFiles("#file-input", wavPath);
    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="ok"]', { timeout: 30000 });
    await page.click('[data-export="docx"]');
    await page.waitForURL(/\/pro\.html$/);
    check(true, "Pro sin licencia: el botón de Word lleva a la página de Pro");
    // Activar la licencia en la página de Pro
    await page.fill("#pro-key", "HL1.falsa.falsa");
    await page.click("#pro-form button[type=submit]");
    await page.waitForSelector('#pro-status[data-kind="error"]');
    check(true, "Página de Pro: una clave falsa se rechaza");
    await page.fill("#pro-key", await issueKey(privateJwk));
    await page.click("#pro-form button[type=submit]");
    await page.waitForSelector('#pro-status[data-kind="ok"]');
    check(await page.locator("#pro-off").isVisible(), "Página de Pro: una clave válida se activa");
    await page.goto(base + TOOL);
    await page.setInputFiles("#file-input", wavPath);
    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="ok"]', { timeout: 30000 });
    const [docx] = await Promise.all([page.waitForEvent("download"), page.click('[data-export="docx"]')]);
    const buf = fs.readFileSync(await docx.path());
    check(docx.suggestedFilename() === "prueba.docx" && buf.readUInt32LE(0) === 0x04034b50 && buf.includes("word/document.xml") && buf.includes("Fragmento"), "Pro: la transcripción se descarga en Word (.docx)");
    await ctx.close();
  }

  // ---------- 1. Página principal en escritorio ----------
  {
    const { ctx, external } = await newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(base + TOOL);
    check((await page.title()).includes("audio a texto"), "La portada tiene título SEO en español");
    check(await page.locator("#start-btn").isDisabled(), "El botón Transcribir está desactivado sin archivo");
    check((await page.locator(".ad-slot").count()) === 4, "Hay 4 huecos de anuncios");
    check(await page.locator(".ad-slot").first().isHidden(), "Los huecos de anuncios están ocultos por defecto");
    check(!external.some((u) => u.includes("googlesyndication")), "No se carga AdSense con los anuncios desactivados");
    await page.screenshot({ path: path.join(OUT, "escritorio-inicio.png"), fullPage: false });

    await page.setInputFiles("#file-input", wavPath);
    check(await page.locator("#file-box").isVisible(), "Al elegir archivo se muestra el reproductor");
    check(await page.locator("#start-btn").isEnabled(), "El botón Transcribir se activa");

    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="ok"]', { timeout: 30000 });
    const status = await page.textContent("#status-text");
    check(/Listo/.test(status), "Termina con mensaje de éxito: " + status.trim());
    check(await page.locator("#afiliados").isHidden(), "Sin enlaces de afiliado configurados no se muestra ninguna recomendación");
    check(await page.locator('[data-export="docx"]').isHidden(), "Pro desactivado: no aparece el botón de Word");
    const segCount = await page.locator(".seg").count();
    const chunks = await page.locator(".seg .tx", { hasText: "Fragmento" }).count();
    check(chunks === 3, `El audio de 75 s se trocea en 3 fragmentos (hay ${chunks}) y se muestran ${segCount} segmentos`);
    check((await page.textContent("#segments")).includes("(es, transcribe)"), "Se transcribe en español por defecto");
    const firstTs = await page.locator(".seg .ts").allTextContents();
    check(firstTs[0] === "0:00" && firstTs.every((t) => /^\d+:\d\d$/.test(t)), "Marcas de tiempo con formato m:ss: " + firstTs.join(", "));
    const starts = await page.locator(".seg .ts").evaluateAll((els) => els.map((e) => Number(e.dataset.t)));
    check(starts.every((t, i) => i === 0 || t >= starts[i - 1]), "Las marcas de tiempo van en orden");
    check(starts[starts.length - 1] < 75, "Ninguna marca supera la duración del audio");
    await page.screenshot({ path: path.join(OUT, "escritorio-resultado.png"), fullPage: true });

    // Editar un segmento y exportar
    const tx = page.locator(".seg .tx").first();
    await tx.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" EDITADO");
    const [srt] = await Promise.all([page.waitForEvent("download"), page.click('[data-export="srt"]')]);
    const srtText = fs.readFileSync(await srt.path(), "utf8");
    check(srt.suggestedFilename() === "prueba.srt", "El SRT se llama como el archivo original");
    check(/^1\n00:00:00,000 --> 00:00:\d\d,\d{3}\n.*EDITADO/m.test(srtText), "El SRT tiene formato correcto e incluye la edición");
    const [vtt] = await Promise.all([page.waitForEvent("download"), page.click('[data-export="vtt"]')]);
    check(fs.readFileSync(await vtt.path(), "utf8").startsWith("WEBVTT"), "El VTT empieza por WEBVTT");
    await page.uncheck("#opt-times");
    const [txt] = await Promise.all([page.waitForEvent("download"), page.click('[data-export="txt"]')]);
    const txtText = fs.readFileSync(await txt.path(), "utf8");
    check(!txtText.includes("[0:00]") && txtText.includes("EDITADO"), "El TXT sin marcas de tiempo es texto corrido");

    // Detección automática de idioma + traducción
    await page.selectOption("#opt-language", "auto");
    await page.check("#opt-translate");
    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="ok"]', { timeout: 30000 });
    check((await page.textContent("#segments")).includes("(es, translate)"), "La detección automática elige español y pasa la tarea de traducir");

    // Cancelar
    await page.click("#start-btn");
    await page.click("#cancel-btn");
    await page.waitForSelector('#status[data-kind="warn"]', { timeout: 30000 });
    check(/cancelada/.test(await page.textContent("#status-text")), "Se puede cancelar la transcripción");
    check(await page.locator("#start-btn").isVisible(), "Tras cancelar vuelve el botón Transcribir");

    // Nueva transcripción
    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="ok"]', { timeout: 30000 });
    await page.click("#new-btn");
    check(await page.locator("#drop").isVisible() && await page.locator("#result").isHidden(), "«Nueva transcripción» vuelve al estado inicial");

    // Preferencias guardadas
    await page.reload();
    check((await page.inputValue("#opt-language")) === "auto", "Se recuerda el idioma elegido");
    check(errors.length === 0, "Sin errores en la consola" + (errors.length ? ": " + errors.join(" | ") : ""));
    await ctx.close();
  }

  // ---------- 2. Archivo no válido ----------
  {
    const { ctx } = await newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(base + TOOL);
    await page.setInputFiles("#file-input", { name: "roto.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("esto no es audio") });
    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="error"]', { timeout: 30000 });
    check(/No se pudo leer/.test(await page.textContent("#status-text")), "Un archivo corrupto muestra un error claro");
    await ctx.close();
  }

  // ---------- 3. Móvil ----------
  {
    const { ctx } = await newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    for (const p of ["/", TOOL, "/preguntas-frecuentes.html", "/privacidad.html", "/en/", TOOL_EN, "/subtitulos-automaticos.html"]) {
      await page.goto(base + p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `Móvil ${p}: sin scroll horizontal (${overflow}px)`);
    }
    await page.goto(base + TOOL);
    check((await page.inputValue("#opt-quality")) === "tiny", "En móvil se elige la calidad rápida por defecto");
    await page.screenshot({ path: path.join(OUT, "movil-inicio.png") });
    await page.setInputFiles("#file-input", wavPath);
    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="ok"]', { timeout: 30000 });
    await page.screenshot({ path: path.join(OUT, "movil-resultado.png"), fullPage: true });
    await ctx.close();
  }

  // ---------- 4. Inglés, FAQ y 404 ----------
  {
    const { ctx } = await newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(base + TOOL_EN);
    check((await page.textContent("#start-btn")).trim() === "Transcribe", "La versión inglesa tiene la interfaz en inglés");
    check((await page.inputValue("#opt-language")) === "en", "En inglés el idioma por defecto es inglés");
    await page.click("header a.lang");
    check(new URL(page.url()).pathname === BASE_PATH + TOOL.slice(1), "El selector de idioma lleva a la versión española dentro de " + BASE_PATH);
    await page.goto(base + "/preguntas-frecuentes.html");
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
    check(ld["@type"] === "FAQPage" && ld.mainEntity.length >= 10, `FAQ con datos estructurados (${ld.mainEntity?.length} preguntas)`);
    const res = await page.goto(base + "/no-existe");
    check(res.status() === 404 && (await page.textContent("h1")).includes("no encontrada"), "Página 404 propia");
    const styled = await page.evaluate(() => getComputedStyle(document.querySelector(".site-header")).borderBottomStyle);
    check(styled === "solid", "La 404 carga el CSS aunque se sirva desde otra ruta");
    await page.click(".hero .btn-primary");
    check(new URL(page.url()).pathname === BASE_PATH && (await page.locator(".tool-card").count()) >= 3, "El botón de la 404 lleva a la portada con las herramientas");
    await page.goto(base + "/en/faq.html");
    for (const a of await page.locator("header a, footer a").evaluateAll((els) => els.map((e) => e.href))) {
      check(new URL(a).pathname.startsWith(BASE_PATH), "Enlace de menú dentro de la ruta base: " + new URL(a).pathname);
    }
    await ctx.close();
  }

  // ---------- 5. Anuncios activados ----------
  {
    const config = `window.SITE_CONFIG = { adsEnabled: true, adsenseClient: "ca-pub-1234567890123456", slots: { top: "111", result: "222", content: "", bottom: "444" } };`;
    const { ctx, external } = await newContext({ viewport: { width: 1280, height: 900 } }, { config });
    const page = await ctx.newPage();
    await page.goto(base + TOOL);
    await page.waitForTimeout(300);
    check((await page.locator(".ad-slot.ad-on ins.adsbygoogle").count()) === 3, "Con anuncios activos se rellenan solo los huecos configurados (3)");
    check(await page.locator('.ad-slot[data-slot="content"]').isHidden(), "Un hueco sin ID sigue oculto");
    check(external.some((u) => u.includes("googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456")), "Se pide el script de AdSense con el ID correcto");
    await ctx.close();
  }

  // ---------- 6. Librería real (opcional) ----------
  if (process.env.REAL_LIB) {
    const { ctx, external } = await newContext({ viewport: { width: 1280, height: 900 } }, { lib: fs.readFileSync(process.env.REAL_LIB, "utf8") });
    const page = await ctx.newPage();
    await page.goto(base + TOOL);
    await page.setInputFiles("#file-input", wavPath);
    await page.click("#start-btn");
    await page.waitForSelector('#status[data-kind="error"], #status[data-kind="ok"]', { timeout: 60000 });
    const msg = (await page.textContent("#status-text")).trim();
    const askedModel = external.some((u) => u.includes("onnx-community/whisper-"));
    check(askedModel, "La librería real carga en el worker y pide el modelo Whisper: " + external.filter((u) => u.includes("whisper")).slice(0, 2).join(", "));
    console.log("  (sin acceso a internet el modelo no se descarga; mensaje mostrado: " + msg + ")");
    await ctx.close();
  }

  const stray = outsideBase.filter((p) => p !== "/no-existe");
  check(stray.length === 0, `Ninguna petición fuera de ${BASE_PATH}` + (stray.length ? ": " + [...new Set(stray)].join(", ") : ""));

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} prueba(s) fallida(s)` : "\nTodas las pruebas han pasado.");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
