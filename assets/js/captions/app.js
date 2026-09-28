import { STRINGS } from "./i18n.js";
import { segmentsToWords, groupWords, retimeLine, parseSubtitles, linesToSRT, drawCaptions, PRESETS, FONTS } from "./core.js";

// Librería de vídeo (MPL-2.0): lee el vídeo, nos deja dibujar sobre cada fotograma y lo vuelve a codificar.
const MEDIABUNNY_URL = "https://cdn.jsdelivr.net/npm/mediabunny@1.60.0/dist/bundles/mediabunny.min.mjs";
const MAX_SIDE = 1920; // los vídeos más grandes se reducen a 1080p para exportar rápido

const LANG = document.documentElement.lang.startsWith("en") ? "en" : "es";
const T = STRINGS[LANG];
const $ = (id) => document.getElementById(id);
const fmt = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ""));

const els = {
  tool: $("tool"), drop: $("drop"), fileInput: $("file-input"), fileBox: $("file-box"), fileName: $("file-name"),
  changeBtn: $("change-btn"), language: $("opt-language"), quality: $("opt-quality"), startBtn: $("start-btn"),
  cancelBtn: $("cancel-btn"), subsBtn: $("subs-btn"), subsInput: $("subs-input"), status: $("status"),
  statusText: $("status-text"), bar: $("bar"), device: $("device"), studio: $("studio"), stage: $("stage"),
  video: $("video"), overlay: $("overlay"), presets: $("presets"), lines: $("lines"), exportBtn: $("export-btn"),
  srtBtn: $("srt-btn"), downloadLink: $("download-link"), exportStatus: $("export-status"),
  exportText: $("export-text"), exportBar: $("export-bar"),
  font: $("st-font"), color: $("st-color"), highlight: $("st-highlight"), size: $("st-size"), pos: $("st-pos"),
  words: $("st-words"), wordsVal: $("st-words-val"), upper: $("st-upper"),
};

const state = {
  file: null, running: false, phase: null, worker: null, segments: [], lines: [],
  style: { ...PRESETS.karaoke }, preset: "karaoke", exporting: null, wordsExact: true,
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
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.src = URL.createObjectURL(file);
  els.video.onloadedmetadata = () => {
    layoutStage();
    if (isFinite(els.video.duration)) els.fileName.textContent = `${file.name} · ${clock(els.video.duration)}`;
  };
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
        type: "transcribe", audio, language: els.language.value, fallbackLanguage: LANG, task: "transcribe",
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
      if (!state.segments.length) { setStatus(T.noSpeech, "warn"); break; }
      setBar(100);
      setStatus(state.wordsExact ? T.done : T.done + " " + T.wordsFallback, "ok");
      openStudio(segmentsToWords(state.segments));
      break;
    case "cancelled":
      finish();
      setStatus(T.cancelled, "warn");
      break;
    case "error":
      finish();
      setStatus(m.stage === "load" ? `${T.engineError} (${m.message})` : fmt(T.error, { msg: m.message }), "error");
      break;
  }
}

function lockInputs(lock) {
  for (const el of [els.changeBtn, els.language, els.quality, els.subsBtn]) el.disabled = lock;
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

function openStudio(words) {
  state.lines = groupWords(words, { maxWords: state.style.maxWords });
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
    input.value = l.text;
    input.dataset.i = i;
    input.setAttribute("aria-label", `${clock(l.start)}`);
    row.append(ts, input);
    frag.appendChild(row);
  });
  els.lines.replaceChildren(frag);
}

function layoutStage() {
  const v = els.video;
  if (!v.videoWidth) return;
  const ratio = v.videoWidth / v.videoHeight;
  els.stage.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
  // Los vídeos verticales no deben ocupar más del 70 % de la altura de la pantalla.
  els.stage.style.maxWidth = `${Math.round(window.innerHeight * 0.7 * ratio)}px`;
  draw();
}

function draw() {
  const v = els.video, c = els.overlay;
  if (!v.videoWidth || els.studio.hidden) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (!w || !h) return;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(w / v.videoWidth, 0, 0, h / v.videoHeight, 0, 0);
  drawCaptions(ctx, v.videoWidth, v.videoHeight, v.currentTime, state.lines, state.style);
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
  for (const b of els.presets.querySelectorAll(".preset")) b.setAttribute("aria-pressed", String(b.dataset.preset === state.preset));
}

function applyPreset(name, save = true) {
  const words = state.style.maxWords;
  state.preset = name;
  state.style = { ...PRESETS[name] };
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
    let W = track.displayWidth, H = track.displayHeight;
    const k = Math.min(1, MAX_SIDE / Math.max(W, H));
    W = Math.round((W * k) / 2) * 2;
    H = Math.round((H * k) / 2) * 2;

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
    const lines = state.lines, style = { ...state.style };

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
        process: (sample) => {
          ctx.clearRect(0, 0, W, H);
          sample.draw(ctx, 0, 0, W, H);
          drawCaptions(ctx, W, H, sample.timestamp + (sample.duration || 0) / 2, lines, style);
          return canvas;
        },
      },
    });
    if (!conversion.isValid) throw new Error((conversion.discardedTracks || []).map((d) => d.reason).join(", ") || "conversión no válida");
    state.exporting = conversion;
    conversion.onProgress = (p) => setExport(fmt(T.exporting, { p: Math.round(p * 100) }), "", p * 100);
    await conversion.execute();

    const isMp4 = format instanceof MB.Mp4OutputFormat;
    const blob = new Blob([target.buffer], { type: isMp4 ? "video/mp4" : "video/webm" });
    const name = (state.file.name.replace(/\.[^.]+$/, "") || "video") + (LANG === "es" ? "-subtitulado" : "-captioned") + (isMp4 ? ".mp4" : ".webm");
    if (els.downloadLink.href) URL.revokeObjectURL(els.downloadLink.href);
    els.downloadLink.href = URL.createObjectURL(blob);
    els.downloadLink.download = name;
    els.downloadLink.hidden = false;
    els.downloadLink.dataset.size = String(blob.size);
    setExport(fmt(T.exported, { size: bytes(blob.size) }), "ok", 100);
    els.downloadLink.click();
  } catch (e) {
    console.error(e);
    if (e?.name === "ConversionCanceledError") setExport(T.cancelled, "warn");
    else setExport(e?.noEncoder ? T.noEncoder : fmt(T.exportError, { msg: e?.message || String(e) }), "error");
  } finally {
    state.exporting = null;
    els.exportBtn.disabled = false;
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
  const p = store.get("preset");
  if (els.tool.dataset.mode === "burn") applyPreset("classic", false);
  else if (p && PRESETS[p]) applyPreset(p, false);

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
  els.srtBtn.onclick = downloadSRT;

  window.addEventListener("beforeunload", (e) => {
    if (state.running || state.exporting) { e.preventDefault(); e.returnValue = ""; }
  });
}

init();

// Acceso para las pruebas automáticas.
window.__captions = { state, draw };
