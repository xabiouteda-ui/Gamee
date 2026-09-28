import { STRINGS } from "./i18n.js";
import { showAffiliates } from "../afiliados.js";
import { proStatus } from "../pro.js";
import { segmentsToWords, groupWords, retimeLine, parseSubtitles, linesToSRT, drawCaptions, PRESETS, FONTS, PLATFORMS, drawCredit, autoKeywords, clearAutoKeywords, autoEmojis, clearAutoEmojis, lineEditText } from "./core.js";

// Librería de vídeo (MPL-2.0): lee el vídeo, nos deja dibujar sobre cada fotograma y lo vuelve a codificar.
const MEDIABUNNY_URL = "https://cdn.jsdelivr.net/npm/mediabunny@1.60.0/dist/bundles/mediabunny.min.mjs";
const MAX_SIDE = 1920; // los vídeos más grandes se reducen a 1080p para exportar rápido
const MAX_SIDE_PRO = 3840; // Pro: resolución original hasta 4K

const LANG = document.documentElement.lang.startsWith("en") ? "en" : "es";
const T = STRINGS[LANG];
const $ = (id) => document.getElementById(id);
const fmt = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ""));

const els = {
  tool: $("tool"), drop: $("drop"), fileInput: $("file-input"), fileBox: $("file-box"), fileName: $("file-name"),
  changeBtn: $("change-btn"), language: $("opt-language"), quality: $("opt-quality"), startBtn: $("start-btn"),
  cancelBtn: $("cancel-btn"), translate: $("opt-translate"), subsBtn: $("subs-btn"), subsInput: $("subs-input"), status: $("status"),
  statusText: $("status-text"), bar: $("bar"), device: $("device"), studio: $("studio"), stage: $("stage"),
  video: $("video"), overlay: $("overlay"), presets: $("presets"), lines: $("lines"), exportBtn: $("export-btn"),
  srtBtn: $("srt-btn"), downloadLink: $("download-link"), exportStatus: $("export-status"),
  exportText: $("export-text"), exportBar: $("export-bar"),
  font: $("st-font"), color: $("st-color"), highlight: $("st-highlight"), size: $("st-size"), pos: $("st-pos"),
  words: $("st-words"), wordsVal: $("st-words-val"), upper: $("st-upper"),
  keyColor: $("st-key"), keys: $("st-keys"), emojis: $("st-emojis"), crop: $("st-crop"), cropRow: $("crop-row"),
  credit: $("st-credit"), safe: $("st-safe"), safeRow: $("safe-row"), exportCancel: $("export-cancel"), encoderWarn: $("encoder-warn"),
};

const state = {
  file: null, running: false, phase: null, worker: null, segments: [], lines: [],
  style: { ...PRESETS.karaoke }, preset: "karaoke", exporting: null, wordsExact: true,
  platform: "", crop: false, safe: true, autoKeys: true, autoEmojis: false, credit: true,
  pro: false, max4k: false, waiter: null,
};

const store = {
  get(k) { try { return localStorage.getItem("tl.cap." + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("tl.cap." + k, v); } catch {} },
};

const isMobile = () => matchMedia("(pointer: coarse)").matches || /Mobi|Android/i.test(navigator.userAgent);

function clock(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function setStatus(text, kind = "") {
  els.status.hidden = false;
  els.status.dataset.kind = kind;
  els.statusText.textContent = text;
}
function setBar(p) {
  if (p == null) els.bar.removeAttribute("value");
  else els.bar.value = Math.max(0, Math.min(100, p));
}
function setExport(text, kind = "", p = null) {
  els.exportStatus.hidden = false;
  els.exportStatus.dataset.kind = kind;
  els.exportText.textContent = text;
  if (p == null) els.exportBar.removeAttribute("value");
  else els.exportBar.value = p;
}
const bytes = (n) => (n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : Math.max(1, Math.round(n / 1e6)) + " MB");

// ---------- fuentes ----------

let fontsReady = null;
function loadFonts() {
  if (!fontsReady) {
    fontsReady = Promise.all(Object.values(FONTS).filter((f) => f.file).map(async (f) => {
      try {
        const face = new FontFace(f.family, `url(${new URL(`../../fonts/${f.file}`, import.meta.url)})`, { weight: String(f.weight) });
        document.fonts.add(await face.load());
      } catch (e) { console.warn("No se pudo cargar la fuente", f.family, e); }
    }));
  }
  return fontsReady;
}

// ---------- archivo ----------

function setFile(file) {
  if (state.running || state.exporting) return;
  state.file = file;
  els.fileName.textContent = file.name;
  els.drop.hidden = true;
  els.fileBox.hidden = false;
  els.startBtn.disabled = false;
  els.subsBtn.disabled = false;
  els.status.hidden = true;
  els.studio.hidden = true;
  els.exportStatus.hidden = true;
  els.downloadLink.hidden = true;
  $("afiliados").hidden = true;
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.src = URL.createObjectURL(file);
  els.video.onloadedmetadata = () => {
    layoutStage();
    if (isFinite(els.video.duration)) els.fileName.textContent = `${file.name} · ${clock(els.video.duration)}`;
  };
  // Para ir rápido: en cuanto eliges el vídeo empieza a generar los subtítulos (salvo en «incrustar SRT»).
  if (els.tool.dataset.mode !== "burn") start();
}

function clearFile() {
  state.file = null;
  els.fileInput.value = "";
  els.drop.hidden = false;
  els.fileBox.hidden = true;
  els.startBtn.disabled = true;
  els.subsBtn.disabled = true;
  els.studio.hidden = true;
}

async function decodeAudio(file) {
  const buf = await file.arrayBuffer();
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(1, 16000, 16000);
  const audio = await new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(buf, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / audio.numberOfChannels;
  }
  return out;
}

// ---------- transcripción (mismo worker que Transcribe Libre) ----------

let pendingAudio = null;

function getWorker() {
  if (!state.worker) {
    state.worker = new Worker(new URL("../worker.js", import.meta.url), { type: "module" });
    state.worker.onmessage = onWorkerMessage;
    state.worker.onerror = (e) => {
      e.preventDefault?.();
      finish();
      setStatus(T.engineError, "error");
      state.worker?.terminate();
      state.worker = null;
    };
  }
  return state.worker;
}

function onWorkerMessage({ data: m }) {
  switch (m.type) {
    case "download":
      setBar(m.total ? (m.loaded / m.total) * 100 : null);
      setStatus(fmt(T.downloading, { p: `${bytes(m.loaded)} / ${bytes(m.total)}` }));
      if (m.total && m.loaded >= m.total) setStatus(T.loadingModel);
      break;
    case "ready": {
      if (!pendingAudio) break;
      state.phase = "transcribing";
      els.device.hidden = false;
      els.device.textContent = m.device === "webgpu" ? "WebGPU" : "WebAssembly";
      setStatus(T.transcribingStart);
      setBar(0);
      const audio = pendingAudio;
      pendingAudio = null;
      state.worker.postMessage({
        type: "transcribe", audio, language: els.language.value, fallbackLanguage: LANG, task: els.translate.checked ? "translate" : "transcribe",
        words: els.quality.value === "base-words",
      }, [audio.buffer]);
      break;
    }
    case "wordsUnavailable":
      state.wordsExact = false;
      break;
    case "chunk":
      state.segments.push(...m.segments);
      setBar((m.processed / m.duration) * 100);
      setStatus(fmt(T.transcribing, { p: Math.round((m.processed / m.duration) * 100) }));
      break;
    case "done":
      finish();
      if (!state.segments.length) { setStatus(T.noSpeech, "warn"); settle(false); break; }
      setBar(100);
      setStatus(state.wordsExact ? T.done : T.done + " " + T.wordsFallback, "ok");
      openStudio(segmentsToWords(state.segments));
      settle(true);
      break;
    case "cancelled":
      finish();
      setStatus(T.cancelled, "warn");
      settle(false);
      break;
    case "error":
      finish();
      setStatus(m.stage === "load" ? `${T.engineError} (${m.message})` : fmt(T.error, { msg: m.message }), "error");
      settle(false);
      break;
  }
}

function lockInputs(lock) {
  for (const el of [els.changeBtn, els.language, els.quality, els.subsBtn, els.translate]) el.disabled = lock;
}

function finish() {
  state.running = false;
  state.phase = null;
  els.tool.classList.remove("busy");
  els.startBtn.hidden = false;
  els.cancelBtn.hidden = true;
  lockInputs(false);
}

async function start() {
  if (!state.file || state.running) return;
  state.running = true;
  state.segments = [];
  state.wordsExact = els.quality.value === "base-words";
  els.tool.classList.add("busy");
  els.startBtn.hidden = true;
  els.cancelBtn.hidden = false;
  lockInputs(true);
  setBar(null);
  state.phase = "decoding";
  setStatus(T.decoding);
  let audio;
  try {
    audio = await decodeAudio(state.file);
  } catch (e) {
    console.error(e);
    finish();
    setStatus(T.decodeError, "error");
    return;
  }
  if (!state.running) return;
  pendingAudio = audio;
  state.phase = "loading";
  setStatus(T.loadingEngine);
  getWorker().postMessage({ type: "load", model: els.quality.value });
}

function cancel() {
  if (!state.running) return;
  if (state.phase !== "transcribing") {
    pendingAudio = null;
    if (state.phase === "loading") { state.worker?.terminate(); state.worker = null; }
    finish();
    setStatus(T.cancelled, "warn");
  } else {
    state.worker?.postMessage({ type: "cancel" });
  }
}

async function loadSubtitleFile(file) {
  const segs = parseSubtitles(await file.text());
  if (!segs.length) { setStatus(T.subsError, "error"); return; }
  setStatus(fmt(T.subsLoaded, { n: segs.length }), "ok");
  // Con un SRT el usuario suele querer el estilo clásico, pero puede cambiarlo.
  if (els.tool.dataset.mode === "burn") applyPreset("classic", false);
  openStudio(segmentsToWords(segs, { keepCues: true }));
}

// ---------- estudio: vista previa, estilo y texto ----------

// Palabras clave y emojis automáticos (si están activados) sobre las líneas actuales.
function decorate() {
  if (state.autoKeys) autoKeywords(state.lines); else clearAutoKeywords(state.lines);
  if (state.autoEmojis) autoEmojis(state.lines); else clearAutoEmojis(state.lines);
}

function openStudio(words) {
  state.lines = groupWords(words, { maxWords: state.style.maxWords });
  decorate();
  const noEncoder = typeof VideoEncoder === "undefined";
  els.encoderWarn.hidden = !noEncoder;
  els.exportBtn.disabled = noEncoder;
  els.studio.hidden = false;
  renderLines();
  syncControls();
  loadFonts().then(draw);
  layoutStage();
  els.studio.scrollIntoView({ behavior: "smooth", block: "start" });
}

function regroup() {
  const words = state.lines.flatMap((l) => l.words);
  state.lines = groupWords(words, { maxWords: state.style.maxWords });
  decorate();
  renderLines();
  draw();
}

function renderLines() {
  const frag = document.createDocumentFragment();
  state.lines.forEach((l, i) => {
    const row = document.createElement("div");
    row.className = "line-row";
    const ts = document.createElement("button");
    ts.type = "button";
    ts.className = "ts";
    ts.textContent = clock(l.start);
    ts.dataset.i = i;
    ts.setAttribute("aria-label", `${clock(l.start)}`);
    const input = document.createElement("input");
    input.type = "text";
    input.value = lineEditText(l);
    input.dataset.i = i;
    input.setAttribute("aria-label", `${clock(l.start)}`);
    row.append(ts, input);
    frag.appendChild(row);
  });
  els.lines.replaceChildren(frag);
}

// Encuadre de salida en píxeles del vídeo original: completo o recortado a 9:16 centrado.
function frame(vw, vh) {
  if (state.crop && vw > vh) {
    const cw = Math.round((vh * 9) / 16);
    return { W: cw, H: vh, sx: Math.round((vw - cw) / 2), sw: cw };
  }
  return { W: vw, H: vh, sx: 0, sw: vw };
}

// Estilo efectivo: el del usuario + el ancho máximo de la zona segura de la plataforma elegida.
function effectiveStyle(W, H) {
  const p = PLATFORMS[state.platform];
  if (!p || W >= H) return state.style;
  return { ...state.style, maxWidth: Math.min(state.style.maxWidth ?? 0.88, 1 - 2 * Math.max(p.right, p.left)) };
}

function layoutStage() {
  const v = els.video;
  if (!v.videoWidth) return;
  const horizontal = v.videoWidth > v.videoHeight;
  els.cropRow.hidden = !horizontal;
  if (!horizontal) state.crop = false;
  const f = frame(v.videoWidth, v.videoHeight);
  els.safeRow.hidden = !(PLATFORMS[state.platform] && f.W < f.H);
  els.stage.classList.toggle("crop", f.W !== v.videoWidth);
  els.stage.style.aspectRatio = `${f.W} / ${f.H}`;
  // Los vídeos verticales no deben ocupar más del 70 % de la altura de la pantalla.
  els.stage.style.maxWidth = `${Math.round(window.innerHeight * 0.7 * (f.W / f.H))}px`;
  draw();
}

// Crédito «Hecho con …»: dentro de la zona segura de la plataforma si el vídeo es vertical.
function creditArgs(W, H) {
  if (!state.credit) return null;
  const p = PLATFORMS[state.platform];
  return [els.tool.dataset.credit, p && W < H ? p : null];
}

function drawSafeZone(ctx, W, H) {
  const p = PLATFORMS[state.platform];
  if (!p || !state.safe || W >= H) return;
  ctx.save();
  ctx.fillStyle = "rgba(255, 60, 60, 0.22)";
  ctx.fillRect(0, 0, W, H * p.top);
  ctx.fillRect(0, H * (1 - p.bottom), W, H * p.bottom);
  ctx.fillRect(W * (1 - p.right), H * p.top, W * p.right, H * (1 - p.top - p.bottom));
  ctx.setLineDash([W * 0.02, W * 0.015]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.strokeRect(W * p.left, H * p.top, W * (1 - p.left - p.right), H * (1 - p.top - p.bottom));
  ctx.restore();
}

function draw() {
  const v = els.video, c = els.overlay;
  if (!v.videoWidth || els.studio.hidden) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (!w || !h) return;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext("2d");
  const { W, H } = frame(v.videoWidth, v.videoHeight);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(w / W, 0, 0, h / H, 0, 0);
  drawSafeZone(ctx, W, H);
  drawCaptions(ctx, W, H, v.currentTime, state.lines, effectiveStyle(W, H));
  const cr = creditArgs(W, H);
  if (cr) drawCredit(ctx, W, H, ...cr);
}

function loop() {
  draw();
  if (!els.video.paused && !els.video.ended) requestAnimationFrame(loop);
}

function syncControls() {
  const s = state.style;
  els.font.value = s.font;
  els.color.value = s.color;
  els.highlight.value = s.highlight;
  els.size.value = s.size;
  els.pos.value = s.pos;
  els.words.value = s.maxWords;
  els.wordsVal.textContent = s.maxWords;
  els.upper.checked = s.upper;
  els.keyColor.value = s.keyColor || "#4ade80";
  els.keys.checked = state.autoKeys;
  els.emojis.checked = state.autoEmojis;
  els.crop.checked = state.crop;
  els.credit.checked = state.credit;
  els.safe.checked = state.safe;
  for (const b of document.querySelectorAll(".chip[data-platform]")) b.setAttribute("aria-pressed", String(b.dataset.platform === state.platform));
  for (const b of document.querySelectorAll(".preset[data-preset]")) b.setAttribute("aria-pressed", String(b.dataset.preset === state.preset));
}

function applyPreset(name, save = true) {
  const words = state.style.maxWords;
  state.preset = name;
  const pos = state.style.pos;
  state.style = { ...PRESETS[name] };
  // Con una plataforma elegida se mantiene la posición dentro de su zona segura.
  if (PLATFORMS[state.platform] && name !== "classic") state.style.pos = PLATFORMS[state.platform].pos ?? pos;
  if (save) store.set("preset", name);
  syncControls();
  if (words !== state.style.maxWords && state.lines.length) regroup();
  else draw();
}

// ---------- exportar ----------

async function exportVideo() {
  if (state.exporting || !state.file) return;
  els.exportBtn.disabled = true;
  els.downloadLink.hidden = true;
  setExport(fmt(T.exporting, { p: 0 }), "", 0);
  let conversion = null;
  try {
    await loadFonts();
    const MB = await import(MEDIABUNNY_URL);
    if (typeof VideoEncoder === "undefined") throw Object.assign(new Error("VideoEncoder"), { noEncoder: true });
    const input = new MB.Input({ source: new MB.BlobSource(state.file), formats: MB.ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("sin pista de vídeo");
    const f = frame(track.displayWidth, track.displayHeight);
    const k = Math.min(1, (state.pro && state.max4k ? MAX_SIDE_PRO : MAX_SIDE) / Math.max(f.W, f.H));
    const W = Math.round((f.W * k) / 2) * 2;
    const H = Math.round((f.H * k) / 2) * 2;
    // Los vídeos a 50/60 fps se exportan a 30 fps: la mitad de trabajo y se ven igual en redes sociales.
    let frameRate;
    try { if ((await track.computePacketStats(90)).averagePacketRate > 32) frameRate = 30; } catch {}

    // MP4 (H.264/AAC si el navegador puede; si no, VP9/AV1/Opus dentro de MP4) y, como último recurso, WebM.
    let format = new MB.Mp4OutputFormat({ fastStart: "in-memory" });
    let codec = await MB.getFirstEncodableVideoCodec(["avc", "hevc", "vp9", "av1"].filter((c) => format.getSupportedVideoCodecs().includes(c)), { width: W, height: H });
    if (!codec) {
      format = new MB.WebMOutputFormat();
      codec = await MB.getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width: W, height: H });
    }
    if (!codec) throw Object.assign(new Error("codec"), { noEncoder: true });

    const target = new MB.BufferTarget();
    const output = new MB.Output({ format, target });
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
    const ctx = canvas.getContext("2d");
    const lines = state.lines, style = { ...effectiveStyle(W, H) }, credit = creditArgs(W, H);

    conversion = await MB.Conversion.init({
      input,
      output,
      video: {
        codec,
        forceTranscode: true,
        allowTransformationMetadata: false,
        quality: MB.QUALITY_HIGH,
        processedWidth: W,
        processedHeight: H,
        ...(frameRate ? { frameRate } : {}),
        process: (sample) => {
          ctx.clearRect(0, 0, W, H);
          sample.draw(ctx, f.sx, 0, f.sw, f.H, 0, 0, W, H);
          drawCaptions(ctx, W, H, sample.timestamp + (sample.duration || 0) / 2, lines, style);
          if (credit) drawCredit(ctx, W, H, ...credit);
          return canvas;
        },
      },
    });
    if (!conversion.isValid) throw new Error((conversion.discardedTracks || []).map((d) => d.reason).join(", ") || "conversión no válida");
    const noAudio = (conversion.discardedTracks || []).some((d) => d.track.type === "audio" && d.reason !== "discarded_by_user");
    state.exporting = conversion;
    els.exportCancel.hidden = false;
    const t0 = performance.now();
    conversion.onProgress = (p) => {
      const el = (performance.now() - t0) / 1000;
      const eta = p > 0.05 ? (el / p) * (1 - p) : null;
      setExport(eta == null ? fmt(T.exporting, { p: Math.round(p * 100) }) : fmt(T.exportingEta, { p: Math.round(p * 100), eta: eta < 60 ? `${Math.ceil(eta)} ${T.seconds}` : `${Math.ceil(eta / 60)} ${T.minutes}` }), "", p * 100);
    };
    await conversion.execute();

    const isMp4 = format instanceof MB.Mp4OutputFormat;
    const blob = new Blob([target.buffer], { type: isMp4 ? "video/mp4" : "video/webm" });
    const name = (state.file.name.replace(/\.[^.]+$/, "") || "video") + (LANG === "es" ? "-subtitulado" : "-captioned") + (isMp4 ? ".mp4" : ".webm");
    if (els.downloadLink.href) URL.revokeObjectURL(els.downloadLink.href);
    els.downloadLink.href = URL.createObjectURL(blob);
    els.downloadLink.download = name;
    els.downloadLink.hidden = false;
    els.downloadLink.dataset.size = String(blob.size);
    setExport(fmt(T.exported, { size: bytes(blob.size) }) + (noAudio ? " " + T.noAudio : ""), noAudio ? "warn" : "ok", 100);
    els.downloadLink.click();
    showAffiliates($("afiliados"), "subtitulos", LANG, new URL("../../../data/afiliados.json", import.meta.url));
    return true;
  } catch (e) {
    console.error(e);
    if (e?.name === "ConversionCanceledError") setExport(T.cancelled, "warn");
    else setExport(e?.noEncoder ? T.noEncoder : fmt(T.exportError, { msg: e?.message || String(e) }), "error");
  } finally {
    state.exporting = null;
    els.exportCancel.hidden = true;
    els.exportBtn.disabled = typeof VideoEncoder === "undefined";
  }
}

function downloadSRT() {
  const blob = new Blob([linesToSRT(state.lines, state.style.upper)], { type: "application/x-subrip;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (state.file?.name.replace(/\.[^.]+$/, "") || "subtitulos") + ".srt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- eventos ----------

function init() {
  if (!("Worker" in window) || !("WebAssembly" in window) || !(window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
    setStatus(T.unsupported, "error");
    return;
  }
  if (isMobile()) {
    els.drop.querySelector("strong").textContent = T.dropTitleTouch;
  }
  const q = store.get("quality");
  if (q && [...els.quality.options].some((o) => o.value === q)) els.quality.value = q;
  const l = store.get("language");
  if (l && [...els.language.options].some((o) => o.value === l)) els.language.value = l;
  els.quality.onchange = () => store.set("quality", els.quality.value);
  els.language.onchange = () => store.set("language", els.language.value);
  state.platform = PLATFORMS[store.get("platform")] ? store.get("platform") : "";
  state.autoKeys = store.get("autoKeys") !== "0";
  state.autoEmojis = store.get("autoEmojis") === "1";
  state.credit = store.get("credit") !== "0";
  initPro();
  const p = store.get("preset");
  // Cada página puede preseleccionar plataforma, estilo o traducción (p. ej. «subtítulos para TikTok»).
  const d = els.tool.dataset;
  if (PLATFORMS[d.platform]) state.platform = d.platform;
  if (d.mode === "translate") els.translate.checked = true;
  if (d.mode === "burn") applyPreset("classic", false);
  else if (PRESETS[d.preset]) applyPreset(d.preset, false);
  else if (p && PRESETS[p] && !PRESETS[p].pro) applyPreset(p, false);
  if (PLATFORMS[state.platform] && state.preset !== "classic") state.style.pos = PLATFORMS[state.platform].pos;

  els.drop.onclick = () => els.fileInput.click();
  els.drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.fileInput.click(); } };
  els.fileInput.onchange = () => els.fileInput.files[0] && setFile(els.fileInput.files[0]);
  for (const ev of ["dragenter", "dragover"]) els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.add("over"); });
  for (const ev of ["dragleave", "drop"]) els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.remove("over"); });
  els.tool.addEventListener("dragover", (e) => e.preventDefault());
  els.tool.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    if (/\.(srt|vtt)$/i.test(f.name) && state.file) loadSubtitleFile(f);
    else setFile(f);
  });
  els.changeBtn.onclick = () => { clearFile(); els.fileInput.click(); };
  els.startBtn.onclick = start;
  els.cancelBtn.onclick = cancel;
  els.subsBtn.onclick = () => els.subsInput.click();
  els.subsInput.onchange = () => { const f = els.subsInput.files[0]; els.subsInput.value = ""; if (f) loadSubtitleFile(f); };

  els.presets.addEventListener("click", (e) => {
    const b = e.target.closest(".preset");
    if (b) applyPreset(b.dataset.preset);
  });
  const styleInput = (el, key, parse = (v) => v) => {
    el.addEventListener("input", () => {
      state.style[key] = parse(el.type === "checkbox" ? el.checked : el.value);
      draw();
    });
  };
  styleInput(els.font, "font");
  styleInput(els.color, "color");
  styleInput(els.highlight, "highlight");
  styleInput(els.size, "size", Number);
  styleInput(els.pos, "pos", Number);
  styleInput(els.upper, "upper");
  els.words.addEventListener("input", () => {
    // Al elegir palabras por línea a mano, las líneas de un SRT importado dejan de respetarse.
    for (const l of state.lines) for (const w of l.words) delete w.cue;
    state.style.maxWords = Number(els.words.value);
    els.wordsVal.textContent = els.words.value;
    regroup();
  });

  els.lines.addEventListener("change", (e) => {
    const i = Number(e.target.dataset.i);
    if (e.target.tagName !== "INPUT" || !state.lines[i]) return;
    state.lines[i] = retimeLine(state.lines[i], e.target.value);
    decorate();
    e.target.value = lineEditText(state.lines[i]);
    draw();
  });
  els.lines.addEventListener("click", (e) => {
    const b = e.target.closest(".ts");
    if (!b) return;
    els.video.currentTime = state.lines[Number(b.dataset.i)].start + 0.01;
  });
  els.lines.addEventListener("focusin", (e) => {
    const i = e.target.dataset?.i;
    if (e.target.tagName === "INPUT" && state.lines[i] && els.video.paused) els.video.currentTime = state.lines[i].start + 0.01;
  });

  els.video.addEventListener("play", () => requestAnimationFrame(loop));
  for (const ev of ["seeked", "timeupdate", "loadeddata"]) els.video.addEventListener(ev, draw);
  window.addEventListener("resize", layoutStage);

  els.exportBtn.onclick = exportVideo;
  els.exportCancel.onclick = () => state.exporting?.cancel();
  document.querySelectorAll(".chip[data-platform]").forEach((b) => b.addEventListener("click", () => {
    state.platform = b.dataset.platform;
    store.set("platform", state.platform);
    if (PLATFORMS[state.platform] && state.preset !== "classic") state.style.pos = PLATFORMS[state.platform].pos;
    syncControls();
    layoutStage();
  }));
  els.crop.addEventListener("change", () => { state.crop = els.crop.checked; layoutStage(); });
  els.safe.addEventListener("change", () => { state.safe = els.safe.checked; draw(); });
  els.credit.addEventListener("change", () => { state.credit = els.credit.checked; store.set("credit", state.credit ? "1" : "0"); draw(); });
  els.keys.addEventListener("change", () => { state.autoKeys = els.keys.checked; store.set("autoKeys", state.autoKeys ? "1" : "0"); decorate(); renderLines(); draw(); });
  els.emojis.addEventListener("change", () => { state.autoEmojis = els.emojis.checked; store.set("autoEmojis", state.autoEmojis ? "1" : "0"); decorate(); draw(); });
  els.keyColor.addEventListener("input", () => { state.style.keyColor = els.keyColor.value; draw(); });
  els.srtBtn.onclick = downloadSRT;

  window.addEventListener("beforeunload", (e) => {
    if (state.running || state.exporting) { e.preventDefault(); e.returnValue = ""; }
  });
}

// ---------- versión Pro ----------

// Resuelve la espera de la transcripción en curso (para procesar varios vídeos seguidos).
function settle(ok) {
  const w = state.waiter;
  state.waiter = null;
  w?.(ok);
}

const proEls = {
  box: $("pro-box"), presets: $("presets-pro"), font: $("pro-font"), brandSave: $("brand-save"), brandApply: $("brand-apply"),
  max4k: $("pro-4k"), batchBtn: $("batch-btn"), batchInput: $("batch-input"), msg: $("pro-msg"),
};

function brandKit() {
  try { return JSON.parse(store.get("brand")); } catch { return null; }
}

function applyBrand(kit) {
  if (!kit?.style) return;
  if (kit.platform != null && (kit.platform === "" || PLATFORMS[kit.platform])) state.platform = kit.platform;
  state.preset = PRESETS[kit.preset] ? kit.preset : state.preset;
  state.style = { ...PRESETS[state.preset], ...kit.style };
  if (typeof kit.credit === "boolean") state.credit = kit.credit;
  syncControls();
  layoutStage();
  if (state.lines.length) regroup();
}

async function useFont(name, buf) {
  const face = new FontFace("Caption Custom", buf);
  document.fonts.add(await face.load());
  FONTS.custom = { family: "Caption Custom", weight: 400, file: null };
  let opt = [...els.font.options].find((o) => o.value === "custom");
  if (!opt) { opt = new Option(name, "custom"); els.font.add(opt); }
  opt.textContent = name;
}

async function initPro() {
  const st = await proStatus(new URL("../../../data/pro.json", import.meta.url));
  state.pro = st.active;
  proEls.box.hidden = !(st.enabled || st.active);
  proEls.box.disabled = !st.active;
  if (!st.active) return;
  document.documentElement.classList.add("pro");
  // Con Pro el crédito empieza quitado (si no lo has elegido tú antes).
  if (store.get("credit") == null) state.credit = false;
  const saved = store.get("proFont");
  if (saved) {
    try {
      const { name, data } = JSON.parse(saved);
      await useFont(name, Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer);
    } catch { /* fuente guardada dañada: se ignora */ }
  }
  const kit = brandKit();
  proEls.brandApply.hidden = !kit;
  if (kit) applyBrand(kit);
  else syncControls();
  draw();
}

async function runBatch(files) {
  if (!state.pro || state.running || state.exporting) return;
  let ok = 0;
  for (const [i, f] of files.entries()) {
    proEls.msg.textContent = fmt(T.batchProgress, { i: i + 1, n: files.length, name: f.name });
    const done = new Promise((r) => { state.waiter = r; });
    setFile(f);
    if (els.tool.dataset.mode === "burn") start();
    if (!(await done)) continue;
    if (await exportVideo()) ok++;
  }
  proEls.msg.textContent = fmt(T.batchDone, { n: ok });
}

function initProEvents() {
  proEls.presets.addEventListener("click", (e) => {
    const b = e.target.closest(".preset");
    if (b && state.pro) applyPreset(b.dataset.preset);
  });
  proEls.font.addEventListener("change", async () => {
    const f = proEls.font.files[0];
    proEls.font.value = "";
    if (!f || !state.pro) return;
    try {
      const buf = await f.arrayBuffer();
      const name = f.name.replace(/\.[^.]+$/, "").slice(0, 40);
      await useFont(name, buf);
      state.style.font = "custom";
      syncControls();
      draw();
      // Se guarda en el navegador si no es muy grande (localStorage tiene ~5 MB).
      if (buf.byteLength < 1.5e6) {
        let bin = "";
        const u8 = new Uint8Array(buf);
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
        store.set("proFont", JSON.stringify({ name, data: btoa(bin) }));
      }
      proEls.msg.textContent = fmt(T.fontLoaded, { name });
    } catch (e) {
      console.warn(e);
      proEls.msg.textContent = T.fontError;
    }
  });
  proEls.brandSave.addEventListener("click", () => {
    store.set("brand", JSON.stringify({ style: state.style, preset: state.preset, platform: state.platform, credit: state.credit }));
    proEls.brandApply.hidden = false;
    proEls.msg.textContent = T.brandSaved;
  });
  proEls.brandApply.addEventListener("click", () => applyBrand(brandKit()));
  proEls.max4k.addEventListener("change", () => { state.max4k = proEls.max4k.checked; });
  proEls.batchBtn.addEventListener("click", () => proEls.batchInput.click());
  proEls.batchInput.addEventListener("change", () => {
    const files = [...proEls.batchInput.files];
    proEls.batchInput.value = "";
    if (files.length) runBatch(files);
  });
}

init();
initProEvents();

// Acceso para las pruebas automáticas.
window.__captions = { state, draw };
