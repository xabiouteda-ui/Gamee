// Prueba end-to-end de la herramienta de subtítulos animados (Chromium + Playwright).
//
//   npm i --no-save playwright mediabunny@1.60.0
//   node build.mjs && node tests/e2e-captions.cjs
//
// El reconocimiento de voz se simula (no se descargan modelos); la creación del vídeo usa la librería real
// (Mediabunny + WebCodecs) y se comprueba abriendo el MP4 resultante y buscando los subtítulos en sus fotogramas.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const { CDN, localMediabunny, serve, newContext, checker } = require("./lib.cjs");

const OUT = process.env.SHOTS || path.join(__dirname, "..", "test-results");

// Simulador de Transformers.js: devuelve palabras con tiempos (o falla en modo palabra si NO_WORDS).
const mockLib = (noWords) => `
export const env = {};
export class Tensor { constructor(t, d, dims) { this.dims = dims; } }
const WORDS = ["Hola", "a", "todos", "esto", "es", "una", "prueba", "de", "subtítulos", "animados"];
export async function pipeline(task, model, opts) {
  opts.progress_callback?.({ status: "progress_total", loaded: 1, total: 1 });
  const fn = async (audio, o) => {
    const d = audio.length / 16000;
    if (o.return_timestamps === "word") {
      if (${noWords ? "true" : "false"}) throw new Error("sin atenciones cruzadas");
      const step = Math.min(0.5, (d - 0.2) / WORDS.length);
      return { text: WORDS.join(" "), chunks: WORDS.map((w, i) => ({ text: " " + w, timestamp: [0.2 + i * step, 0.2 + (i + 1) * step - 0.05] })) };
    }
    return { text: WORDS.join(" "), chunks: [{ text: " " + WORDS.join(" "), timestamp: [0.2, Math.min(d, 5)] }] };
  };
  fn.processor = async () => ({ input_features: {} });
  fn.model = { generation_config: { decoder_start_token_id: 1, lang_to_id: { "<|es|>": 5 } }, generate: async () => ({ sequences: { tolist: () => [[1n, 5n]] } }) };
  fn.dispose = async () => {};
  return fn;
}`;

// Crea en el navegador un WebM de 6 s (360×640, VP8 + Opus) con un tono como "voz".
async function makeVideo(page, w = 360, h = 640, secs = 6) {
  return page.evaluate(async ([url, w, h, secs]) => {
    const MB = await import(url);
    const target = new MB.BufferTarget();
    const out = new MB.Output({ format: new MB.WebMOutputFormat(), target });
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const video = new MB.CanvasSource(canvas, { codec: "vp8", bitrate: 1e6 });
    out.addVideoTrack(video, { frameRate: 30 });
    const audio = new MB.AudioBufferSource({ codec: "opus", bitrate: 64000 });
    out.addAudioTrack(audio);
    await out.start();
    const rate = 48000;
    for (let i = 0; i < secs * 30; i++) {
      ctx.fillStyle = `hsl(${(i * 2) % 360} 40% 35%)`;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.font = "40px sans-serif";
      ctx.fillText(String(i), 20, 60);
      await video.add(i / 30, 1 / 30);
    }
    const buf = new AudioBuffer({ length: secs * rate, sampleRate: rate, numberOfChannels: 1 });
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = 0.3 * Math.sin(2 * Math.PI * 220 * i / rate) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * i / rate));
    await audio.add(buf);
    await out.finalize();
    let s = "";
    const bytes = new Uint8Array(target.buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, [CDN.mediabunny, w, h, secs]);
}

// Cuenta píxeles "amarillo resaltado" en una región del canvas de vista previa.
const yellowInOverlay = (page) => page.evaluate(() => {
  const c = document.getElementById("overlay");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 190 && d[i + 2] < 90 && d[i + 3] > 200) n++;
  return n;
});

(async () => {
  const mb = localMediabunny();
  if (!mb) { console.error("Falta mediabunny: npm i --no-save mediabunny@1.60.0 (o MEDIABUNNY_LIB=/ruta/mediabunny.min.mjs)"); process.exit(1); }
  const libs = { [CDN.mediabunny]: fs.readFileSync(mb, "utf8"), [CDN.transformers]: mockLib(false) };
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const browser = await chromium.launch();
  const { check, failures } = checker();
  const dir = "/subtitulos-animados/";

  // ---------- 1. Flujo completo en escritorio ----------
  const { ctx, external } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, libs);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(srv.base + dir);
  check((await page.title()).includes("Subtítulos animados"), "Portada de subtítulos con título SEO");
  check(await page.locator(".ad-slot").first().isHidden(), "Huecos de anuncios ocultos por defecto");
  const video64 = await makeVideo(page);
  const videoFile = { name: "mi-video.webm", mimeType: "video/webm", buffer: Buffer.from(video64, "base64") };
  fs.writeFileSync(path.join(OUT, "prueba.webm"), videoFile.buffer);
  check(videoFile.buffer.length > 10000, `Vídeo de prueba generado (${Math.round(videoFile.buffer.length / 1024)} KB)`);

  await page.setInputFiles("#file-input", videoFile);
  check(await page.locator("#cancel-btn").isVisible() || await page.locator("#studio").isVisible(), "Al elegir el vídeo empieza a generar los subtítulos solo (sin más clics)");
  await page.waitForSelector("#studio:not([hidden])", { timeout: 60000 });
  check((await page.getAttribute("#status", "data-kind")) === "ok", "Termina con éxito: " + (await page.textContent("#status-text")).trim());
  const nLines = await page.locator(".line-row").count();
  check(nLines === 4, `10 palabras en líneas de 3 → 4 líneas (hay ${nLines})`);
  const firstLine = await page.inputValue(".line-row input");
  check(firstLine === "Hola a todos", "La primera línea es «Hola a todos»: " + firstLine);

  // Vista previa: en t=0,35 s suena «Hola» → debe verse resaltado en amarillo.
  await page.evaluate(() => { const v = document.getElementById("video"); v.currentTime = 0.35; });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__captions.draw());
  const yellow = await yellowInOverlay(page);
  check(yellow > 50, `La vista previa dibuja la palabra activa resaltada (${yellow} píxeles amarillos)`);
  await page.screenshot({ path: path.join(OUT, "subtitulos-escritorio.png"), fullPage: false });

  // Estilo «palabra a palabra»: una palabra por línea.
  await page.click('.preset[data-preset="pop"]');
  check((await page.locator(".line-row").count()) === 10, "El estilo «palabra a palabra» agrupa 1 palabra por línea");
  check((await page.inputValue("#st-words")) === "1", "El control de palabras por línea se sincroniza con el estilo");
  await page.click('.preset[data-preset="karaoke"]');
  check((await page.locator(".line-row").count()) === 4, "Volver a karaoke reagrupa en 4 líneas");

  // Editar una línea
  const input = page.locator(".line-row input").first();
  await input.fill("Hola gente");
  await input.press("Enter");
  await input.blur();
  const edited = await page.evaluate(() => window.__captions.state.lines[0].words.map((w) => w.text).join(" "));
  check(edited === "Hola gente", "Editar una línea reparte el tiempo entre las nuevas palabras");

  // SRT
  const [srt] = await Promise.all([page.waitForEvent("download"), page.click("#srt-btn")]);
  const srtText = fs.readFileSync(await srt.path(), "utf8");
  check(/^1\n00:00:00,\d{3} --> 00:00:0\d,\d{3}\nHOLA GENTE\n/.test(srtText), "El SRT exporta el texto editado (en mayúsculas como el estilo)");

  // Palabras clave automáticas y a mano
  const autoKeys = await page.evaluate(() => window.__captions.state.lines.flatMap((l) => l.words).filter((w) => w.key === "auto").map((w) => w.text));
  check(autoKeys.includes("subtítulos") || autoKeys.includes("animados") || autoKeys.includes("prueba"), "Resalta palabras clave automáticamente: " + autoKeys.join(", "));
  const in2 = page.locator(".line-row input").nth(1);
  await in2.fill("esto es *una*");
  await in2.press("Enter");
  await in2.blur();
  const manual = await page.evaluate(() => window.__captions.state.lines[1].words.find((w) => w.text === "una")?.key);
  check(manual === true && (await in2.inputValue()) === "esto es *una*", "Se puede resaltar una palabra a mano con *asteriscos*");
  await page.uncheck("#st-keys");
  const left = await page.evaluate(() => window.__captions.state.lines.flatMap((l) => l.words).filter((w) => w.key).map((w) => w.key));
  check(left.length === 1 && left[0] === true, "Desactivar las automáticas mantiene las marcadas a mano");
  await page.check("#st-keys");

  // Plataforma: zona segura en la vista previa y posición dentro de ella
  await page.click('.chip[data-platform="tiktok"]');
  check(await page.locator("#safe-row").isVisible(), "Al elegir TikTok se ofrece ver la zona que tapa la app");
  check((await page.inputValue("#st-pos")) === "0.62", "La posición se coloca dentro de la zona segura de TikTok");
  await page.evaluate(() => { document.getElementById("video").currentTime = 0.35; });
  await page.waitForTimeout(300);
  const redTop = await page.evaluate(() => {
    const c = document.getElementById("overlay");
    const d = c.getContext("2d").getImageData(Math.floor(c.width / 2), 2, 1, 1).data;
    return d[0] > d[1] && d[3] > 20;
  });
  check(redTop, "La zona segura se marca en la vista previa");
  await page.click('.preset[data-preset="marker"]');
  await page.evaluate(() => window.__captions.draw());
  check((await yellowInOverlay(page)) > 200, "Estilo «Marcador»: caja amarilla en la palabra activa");
  await page.click('.preset[data-preset="neon"]');
  await page.click('.preset[data-preset="progressive"]');
  await page.click('.preset[data-preset="karaoke"]');
  check((await page.locator(".preset").count()) === 8, "8 estilos disponibles");
  await page.screenshot({ path: path.join(OUT, "subtitulos-tiktok.png"), fullPage: false });

  // Exportar el vídeo
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 180000 }),
    page.click("#export-btn"),
  ]);
  await page.waitForSelector('#export-status[data-kind="ok"]', { timeout: 180000 });
  const outPath = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(outPath);
  check(/^mi-video-subtitulado\.(mp4|webm)$/.test(dl.suggestedFilename()), "El vídeo se descarga con nombre claro: " + dl.suggestedFilename());
  const info = await page.evaluate(async (url) => {
    const MB = await import(url);
    const href = document.getElementById("download-link").href;
    const blob = await (await fetch(href)).blob();
    const input = new MB.Input({ source: new MB.BlobSource(blob), formats: MB.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    const at = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    // Fotograma en t=0,35 s: debe contener texto amarillo (la palabra activa).
    const sink = new MB.CanvasSink(vt);
    const wrapped = await sink.getCanvas(0.35);
    const c = wrapped.canvas;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let yellow = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 180 && d[i + 2] < 100) yellow++;
    // A los 5,8 s ya no hay subtítulos
    const late = (await sink.getCanvas(5.8)).canvas;
    const d2 = late.getContext("2d").getImageData(0, 0, late.width, late.height).data;
    let yellow2 = 0;
    for (let i = 0; i < d2.length; i += 4) if (d2[i] > 200 && d2[i + 1] > 180 && d2[i + 2] < 100) yellow2++;
    return { mime: blob.type, size: blob.size, w: vt.displayWidth, h: vt.displayHeight, codec: vt.codec, audio: at?.codec || null, duration, yellow, yellow2 };
  }, CDN.mediabunny);
  console.log("  vídeo exportado:", JSON.stringify(info));
  check(info.w === 360 && info.h === 640, "Mantiene la resolución vertical 360×640");
  // La zona segura NO se graba: arriba del todo el fotograma exportado no tiene el tinte rojo.
  const tint = await page.evaluate(async (url) => {
    const MB = await import(url);
    const blob = await (await fetch(document.getElementById("download-link").href)).blob();
    const input = new MB.Input({ source: new MB.BlobSource(blob), formats: MB.ALL_FORMATS });
    const c = (await new MB.CanvasSink(await input.getPrimaryVideoTrack()).getCanvas(0.35)).canvas;
    const [r, g, b] = c.getContext("2d").getImageData(Math.floor(c.width / 2), 3, 1, 1).data;
    return { r, g, b };
  }, CDN.mediabunny);
  check(Math.abs(tint.r - tint.g) < 60, "La zona segura no aparece en el vídeo exportado");
  check(Math.abs(info.duration - 6) < 0.3, `Mantiene la duración (${info.duration.toFixed(2)} s)`);
  check(!!info.audio, "Conserva la pista de audio");
  check(info.yellow > 100, `Los subtítulos están grabados en el vídeo (${info.yellow} píxeles amarillos en t=0,35 s)`);
  check(info.yellow2 < 20, "Sin subtítulos cuando no se habla (t=5,8 s)");
  await page.screenshot({ path: path.join(OUT, "subtitulos-exportado.png"), fullPage: true });
  check(!external.some((u) => u.includes("googlesyndication")), "Sin AdSense con los anuncios desactivados");
  check(errors.length === 0, "Sin errores en la consola" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.close();

  // ---------- 1b. Vídeo horizontal → vertical 9:16, cancelar, emojis ----------
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, libs);
    const page = await ctx.newPage();
    await page.goto(srv.base + dir);
    const wide = Buffer.from(await makeVideo(page, 640, 360, 20), "base64");
    await page.setInputFiles("#file-input", { name: "horizontal.webm", mimeType: "video/webm", buffer: wide });
    await page.waitForSelector("#studio:not([hidden])", { timeout: 60000 });
    check(await page.locator("#crop-row").isVisible(), "Con un vídeo horizontal se ofrece pasarlo a vertical 9:16");
    await page.check("#st-crop");
    const ar = await page.evaluate(() => getComputedStyle(document.getElementById("stage")).aspectRatio);
    check(/203 \/ 360/.test(ar), "La vista previa pasa a 9:16: " + ar);
    await page.check("#st-emojis");
    const hasEmojiState = await page.evaluate(() => typeof window.__captions.state.autoEmojis === "boolean" && window.__captions.state.autoEmojis);
    check(hasEmojiState, "Se pueden activar los emojis automáticos");
    // Cancelar
    await page.click("#export-btn");
    await page.waitForSelector("#export-cancel:not([hidden])", { timeout: 30000 });
    await page.click("#export-cancel");
    await page.waitForSelector('#export-status[data-kind="warn"]', { timeout: 30000 });
    check(/Cancelado/.test(await page.textContent("#export-text")), "La exportación se puede cancelar");
    // Exportar recortado
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 180000 }), page.click("#export-btn")]);
    await page.waitForSelector('#export-status[data-kind="ok"]', { timeout: 180000 });
    const dims = await page.evaluate(async (url) => {
      const MB = await import(url);
      const blob = await (await fetch(document.getElementById("download-link").href)).blob();
      const vt = await new MB.Input({ source: new MB.BlobSource(blob), formats: MB.ALL_FORMATS }).getPrimaryVideoTrack();
      return [vt.displayWidth, vt.displayHeight];
    }, CDN.mediabunny);
    check(dims[0] === 204 && dims[1] === 360, "El vídeo horizontal se exporta en vertical 9:16: " + dims.join("×"));
    await ctx.close();
  }

  // ---------- 1c. Navegador sin codificador de vídeo (p. ej. Safari antiguo) ----------
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, libs);
    await ctx.addInitScript(() => { delete window.VideoEncoder; });
    const page = await ctx.newPage();
    await page.goto(srv.base + dir + "incrustar-subtitulos.html");
    await page.setInputFiles("#file-input", videoFile);
    await page.setInputFiles("#subs-input", { name: "s.srt", mimeType: "application/x-subrip", buffer: Buffer.from("1\n00:00:00,500 --> 00:00:02,000\nPara ahorrar dinero\n") });
    await page.waitForSelector("#studio:not([hidden])");
    check(await page.locator("#encoder-warn").isVisible() && await page.locator("#export-btn").isDisabled(), "Sin codificador de vídeo avisa y ofrece el SRT");
    check(await page.locator("#srt-btn").isEnabled(), "…el SRT sigue disponible");
    await page.check("#st-emojis");
    check((await page.evaluate(() => window.__captions.state.lines[0].emoji)) === "💰", "Emoji automático según el texto («ahorrar dinero» → 💰)");
    await ctx.close();
  }

  // ---------- 1d. Páginas por búsqueda: preselección de plataforma, estilo y traducción ----------
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, libs);
    const page = await ctx.newPage();
    const srt = { name: "s.srt", mimeType: "application/x-subrip", buffer: Buffer.from("1\n00:00:00,500 --> 00:00:02,000\nHola\n") };
    for (const [slug, expect] of [["subtitulos-tiktok.html", "tiktok"], ["subtitulos-reels.html", "reels"], ["subtitulos-shorts.html", "shorts"]]) {
      await page.goto(srv.base + dir + slug);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      check((await page.getAttribute("#tool", "data-platform")) === expect, `${slug}: la herramienta viene configurada para ${expect}`);
    }
    await page.goto(srv.base + dir + "subtitulos-en-ingles.html");
    check(await page.isChecked("#opt-translate"), "subtitulos-en-ingles: la traducción al inglés viene marcada");
    await page.goto(srv.base + dir + "subtitulos-podcast.html");
    await page.setInputFiles("#file-input", videoFile);
    await page.waitForSelector("#studio:not([hidden])", { timeout: 60000 });
    check((await page.getAttribute('.preset[data-preset="classic"]', "aria-pressed")) === "true", "subtitulos-podcast: estilo clásico preseleccionado");
    await page.goto(srv.base + dir + "subtitulos-tiktok.html");
    await page.setInputFiles("#file-input", videoFile);
    await page.waitForSelector("#studio:not([hidden])", { timeout: 60000 });
    check((await page.getAttribute('.chip[data-platform="tiktok"]', "aria-pressed")) === "true" && (await page.inputValue("#st-pos")) === "0.62", "subtitulos-tiktok: TikTok y su zona segura activados al abrir el estudio");
    await ctx.close();
  }

  // ---------- 2. Incrustar un SRT existente ----------
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, libs);
    const page = await ctx.newPage();
    await page.goto(srv.base + dir + "incrustar-subtitulos.html");
    await page.setInputFiles("#file-input", videoFile);
    await page.setInputFiles("#subs-input", { name: "subs.srt", mimeType: "application/x-subrip", buffer: Buffer.from("1\n00:00:00,500 --> 00:00:02,000\nPrimera línea del archivo\n\n2\n00:00:02,500 --> 00:00:04,000\nSegunda línea\n") });
    await page.waitForSelector("#studio:not([hidden])");
    check((await page.getAttribute('.preset[data-preset="classic"]', "aria-pressed")) === "true", "En «incrustar» se usa el estilo clásico por defecto");
    const lines = await page.locator(".line-row input").evaluateAll((els) => els.map((e) => e.value));
    check(lines.join(" | ") === "Primera línea del archivo | Segunda línea", "Carga las líneas del SRT: " + lines.join(" | "));
    await ctx.close();
  }

  // ---------- 3. Sin marcas por palabra: se reparten los tiempos ----------
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 1280, height: 900 } }, { ...libs, [CDN.transformers]: mockLib(true) });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(srv.base + dir);
    await page.setInputFiles("#file-input", videoFile);
    await page.waitForSelector("#studio:not([hidden])", { timeout: 60000 });
    check(/aproximados/.test(await page.textContent("#status-text")), "Si el modelo no da tiempos por palabra, avisa y los reparte");
    check((await page.locator(".line-row").count()) === 4, "…y agrupa igualmente las 10 palabras en 4 líneas");
    check(errs.length === 0, "Sin errores de página en el modo aproximado");
    await ctx.close();
  }

  // ---------- 4. Móvil e inglés ----------
  {
    const { ctx } = await newContext(browser, srv, { viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, libs);
    const page = await ctx.newPage();
    for (const p of [dir, dir + "incrustar-subtitulos.html", dir + "subtitulos-para-reels-tiktok-shorts.html", dir + "subtitulos-tiktok.html", dir + "subtitulos-en-ingles.html", "/en/animated-captions/", "/en/animated-captions/burn-subtitles.html"]) {
      await page.goto(srv.base + p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `Móvil ${p}: sin scroll horizontal (${overflow}px)`);
    }
    await page.goto(srv.base + dir);
    check((await page.inputValue("#opt-quality")) === "base-words", "En móvil también se usa palabra a palabra por defecto");
    await page.setInputFiles("#file-input", videoFile);
    await page.waitForSelector("#studio:not([hidden])", { timeout: 60000 });
    await page.screenshot({ path: path.join(OUT, "subtitulos-movil.png"), fullPage: true });
    await page.goto(srv.base + "/en/animated-captions/");
    check((await page.textContent("#start-btn")).trim() === "Generate captions", "La versión inglesa tiene la interfaz en inglés");
    await ctx.close();
  }

  const stray = srv.outside.filter((p) => p !== "/no-existe");
  check(stray.length === 0, "Ninguna petición fuera de la ruta base" + (stray.length ? ": " + stray.join(", ") : ""));
  await browser.close();
  srv.server.close();
  console.log(failures() ? `\n${failures()} prueba(s) fallida(s)` : "\nTodas las pruebas de subtítulos han pasado.");
  process.exit(failures() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
