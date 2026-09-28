import { STRINGS, AUDIO_LANGUAGES } from "./i18n.js";
import { clock, bytes, toTXT, toSRT, toVTT } from "./format.js";
import { showAffiliates } from "./afiliados.js";
import { proStatus } from "./pro.js";
import { toDOCX } from "./docx.js";

const LANG = document.documentElement.lang.startsWith("en") ? "en" : "es";
const T = STRINGS[LANG];
const $ = (id) => document.getElementById(id);
const fmt = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ""));

const els = {
  tool: $("tool"),
  drop: $("drop"),
  fileInput: $("file-input"),
  recordBtn: $("record-btn"),
  recordTime: $("record-time"),
  fileBox: $("file-box"),
  fileName: $("file-name"),
  changeBtn: $("change-btn"),
  player: $("player"),
  language: $("opt-language"),
  quality: $("opt-quality"),
  translate: $("opt-translate"),
  startBtn: $("start-btn"),
  cancelBtn: $("cancel-btn"),
  status: $("status"),
  statusText: $("status-text"),
  device: $("device"),
  bar: $("bar"),
  result: $("result"),
  segments: $("segments"),
  showTimes: $("opt-times"),
  copyBtn: $("copy-btn"),
  newBtn: $("new-btn"),
  wordCount: $("word-count"),
  warn: $("warn"),
};

const state = {
  file: null,
  segments: [],
  worker: null,
  running: false,
  phase: null,
  detectedLanguage: null,
  startedAt: 0,
  duration: 0,
};

// ---------- utilidades ----------

const store = {
  get(k) { try { return localStorage.getItem("tl." + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("tl." + k, v); } catch {} },
};

function humanDuration(sec) {
  sec = Math.round(sec);
  if (sec < 60) return `${sec} ${T.seconds}`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m} ${T.minutes} ${s} ${T.seconds}` : `${m} ${T.minutes}`;
}

function download(name, text, mime) {
  const blob = new Blob([text], { type: mime + ";charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function baseName() {
  const n = state.file?.name || "transcripcion";
  return n.replace(/\.[^.]+$/, "") || "transcripcion";
}

function setStatus(text, kind = "") {
  els.status.hidden = false;
  els.status.dataset.kind = kind;
  els.statusText.textContent = text;
}

function setBar(p) {
  if (p == null) { els.bar.removeAttribute("value"); return; }
  els.bar.value = Math.max(0, Math.min(100, p));
}

function isMobile() {
  return matchMedia("(pointer: coarse)").matches || /Mobi|Android/i.test(navigator.userAgent);
}

// ---------- decodificación del audio ----------

async function decodeAudio(file) {
  const buf = await file.arrayBuffer();
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(1, 16000, 16000);
  const audio = await new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(buf, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
  if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= audio.numberOfChannels;
  return out;
}

// ---------- archivo y grabación ----------

function setFile(file) {
  state.file = file;
  els.fileName.textContent = file.name;
  if (els.player.src) URL.revokeObjectURL(els.player.src);
  els.player.src = URL.createObjectURL(file);
  els.drop.hidden = true;
  els.fileBox.hidden = false;
  els.startBtn.disabled = false;
  els.warn.hidden = file.size < 300e6;
  els.warn.textContent = T.bigFile;
  els.player.onloadedmetadata = () => {
    if (isFinite(els.player.duration)) {
      els.fileName.textContent = fmt(T.fileInfo, { name: file.name, dur: clock(els.player.duration) });
    }
  };
}

function clearFile() {
  state.file = null;
  els.fileInput.value = "";
  els.drop.hidden = false;
  els.fileBox.hidden = true;
  els.startBtn.disabled = true;
  els.warn.hidden = true;
}

let recorder = null, recordTimer = null;

async function toggleRecording() {
  if (recorder && recorder.state === "recording") { recorder.stop(); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus(T.micDenied, "error");
    return;
  }
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    clearInterval(recordTimer);
    els.recordBtn.classList.remove("recording");
    els.recordBtn.querySelector("span").textContent = T.record;
    els.recordTime.hidden = true;
    const type = recorder.mimeType || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    const stampName = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    setFile(new File(chunks, `${LANG === "es" ? "grabacion" : "recording"}-${stampName}.${ext}`, { type }));
  };
  recorder.start(1000);
  const t0 = Date.now();
  els.recordBtn.classList.add("recording");
  els.recordBtn.querySelector("span").textContent = T.stopRecording;
  els.recordTime.hidden = false;
  els.recordTime.textContent = "0:00";
  recordTimer = setInterval(() => { els.recordTime.textContent = clock((Date.now() - t0) / 1000); }, 500);
}

// ---------- resultado ----------

function renderSegments(newSegs) {
  const frag = document.createDocumentFragment();
  for (const seg of newSegs) {
    const i = state.segments.length;
    state.segments.push(seg);
    const row = document.createElement("p");
    row.className = "seg";
    const ts = document.createElement("button");
    ts.type = "button";
    ts.className = "ts";
    ts.textContent = clock(seg.start);
    ts.dataset.t = seg.start;
    const tx = document.createElement("span");
    tx.className = "tx";
    tx.contentEditable = "true";
    tx.spellcheck = true;
    tx.textContent = seg.text + " ";
    tx.dataset.i = i;
    row.append(ts, tx);
    frag.appendChild(row);
  }
  els.segments.appendChild(frag);
  updateCount();
}

function updateCount() {
  const n = state.segments.reduce((a, s) => a + (s.text.trim() ? s.text.trim().split(/\s+/).length : 0), 0);
  els.wordCount.textContent = fmt(T.words, { n: n.toLocaleString(LANG) });
}

// ---------- worker ----------

function getWorker() {
  if (!state.worker) {
    state.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
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

let pendingAudio = null;

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
      els.device.textContent = m.device === "webgpu" ? T.deviceGpu : T.deviceCpu;
      const language = els.language.value;
      if (language === "auto") setStatus(T.detecting);
      else setStatus(T.transcribingStart);
      setBar(0);
      state.startedAt = performance.now();
      const audio = pendingAudio;
      pendingAudio = null;
      state.worker.postMessage({
        type: "transcribe",
        audio,
        language,
        fallbackLanguage: LANG,
        task: els.translate.checked ? "translate" : "transcribe",
      }, [audio.buffer]);
      break;
    }
    case "language": {
      const row = AUDIO_LANGUAGES.find((l) => l[0] === m.language);
      const name = row ? row[LANG === "es" ? 1 : 2] : m.language;
      state.detectedLanguage = m.language;
      setStatus(fmt(T.detected, { lang: name }) + " · " + T.transcribingStart);
      break;
    }
    case "chunk": {
      els.result.hidden = false;
      renderSegments(m.segments);
      const p = (m.processed / m.duration) * 100;
      const rate = m.elapsed / m.processed;
      const eta = rate * (m.duration - m.processed);
      setBar(p);
      setStatus(fmt(T.transcribing, { p: Math.round(p), eta: humanDuration(eta) }));
      break;
    }
    case "done":
      finish();
      setBar(100);
      if (!state.segments.length) setStatus(T.noSpeech, "warn");
      else {
        setStatus(fmt(T.done, {
          dur: humanDuration(state.duration),
          time: humanDuration((performance.now() - state.startedAt) / 1000),
        }), "ok");
        showAffiliates($("afiliados"), "transcripcion", LANG, new URL("../../data/afiliados.json", import.meta.url));
      }
      break;
    case "cancelled":
      finish();
      setStatus(T.cancelled, "warn");
      break;
    case "error":
      finish();
      // Si falla al cargar (sin conexión, navegador sin soporte…), mensaje comprensible + detalle técnico.
      setStatus(m.stage === "load" ? `${T.engineError} (${m.message})` : fmt(T.error, { msg: m.message }), "error");
      break;
  }
}

function finish() {
  state.running = false;
  state.phase = null;
  els.tool.classList.remove("busy");
  els.startBtn.hidden = false;
  els.cancelBtn.hidden = true;
  for (const el of [els.startBtn, els.changeBtn, els.language, els.quality, els.translate, els.recordBtn]) el.disabled = false;
}

async function start() {
  if (!state.file || state.running) return;
  state.running = true;
  state.segments = [];
  els.segments.textContent = "";
  els.result.hidden = true;
  els.tool.classList.add("busy");
  els.startBtn.hidden = true;
  els.cancelBtn.hidden = false;
  for (const el of [els.changeBtn, els.language, els.quality, els.translate, els.recordBtn]) el.disabled = true;
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
  state.duration = audio.length / 16000;
  pendingAudio = audio;
  state.phase = "loading";
  setStatus(T.loadingEngine);
  getWorker().postMessage({ type: "load", model: els.quality.value });
}

function cancel() {
  if (!state.running) return;
  if (state.phase !== "transcribing") {
    // Aún leyendo el audio o cargando el modelo: paramos aquí (y reiniciamos el worker si ya existía).
    pendingAudio = null;
    if (state.phase === "loading") {
      state.worker?.terminate();
      state.worker = null;
    }
    finish();
    setStatus(T.cancelled, "warn");
  } else {
    state.worker?.postMessage({ type: "cancel" });
  }
}

// ---------- eventos ----------

function init() {
  if (!("Worker" in window) || !("WebAssembly" in window) || !(window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
    setStatus(T.unsupported, "error");
    els.startBtn.disabled = true;
    return;
  }

  els.quality.value = store.get("quality") || (isMobile() ? "tiny" : "base");
  if (isMobile()) {
    els.drop.querySelector("strong").textContent = T.dropTitleTouch;
    els.drop.querySelector(".muted").textContent = T.dropHint.split("·").pop().trim();
  }
  const savedLang = store.get("language");
  if (savedLang && [...els.language.options].some((o) => o.value === savedLang)) els.language.value = savedLang;
  els.quality.onchange = () => store.set("quality", els.quality.value);
  els.language.onchange = () => store.set("language", els.language.value);

  els.drop.onclick = () => els.fileInput.click();
  els.drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); els.fileInput.click(); } };
  els.fileInput.onchange = () => els.fileInput.files[0] && setFile(els.fileInput.files[0]);
  for (const ev of ["dragenter", "dragover"]) els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.add("over"); });
  for (const ev of ["dragleave", "drop"]) els.drop.addEventListener(ev, (e) => { e.preventDefault(); els.drop.classList.remove("over"); });
  els.drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) setFile(f); });
  // Permite soltar el archivo en cualquier parte de la herramienta.
  els.tool.addEventListener("dragover", (e) => e.preventDefault());
  els.tool.addEventListener("drop", (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f && !state.running) setFile(f);
  });

  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) els.recordBtn.hidden = true;
  els.recordBtn.onclick = toggleRecording;
  els.changeBtn.onclick = () => { clearFile(); els.fileInput.click(); };
  els.startBtn.onclick = start;
  els.cancelBtn.onclick = cancel;

  els.segments.addEventListener("input", (e) => {
    const i = e.target.dataset?.i;
    if (i != null) { state.segments[i].text = e.target.textContent.trim(); updateCount(); }
  });
  els.segments.addEventListener("click", (e) => {
    const t = e.target.closest(".ts");
    if (!t) return;
    els.player.currentTime = Number(t.dataset.t);
    els.player.play().catch(() => {});
  });
  els.showTimes.onchange = () => els.segments.classList.toggle("no-times", !els.showTimes.checked);

  els.copyBtn.onclick = async () => {
    const text = toTXT(state.segments, els.showTimes.checked);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    const label = els.copyBtn.querySelector("span");
    label.textContent = T.copied;
    setTimeout(() => (label.textContent = T.copy), 1500);
  };
  document.querySelectorAll("[data-export]").forEach((b) => {
    b.onclick = () => {
      const kind = b.dataset.export;
      if (kind === "txt") download(baseName() + ".txt", toTXT(state.segments, els.showTimes.checked), "text/plain");
      if (kind === "srt") download(baseName() + ".srt", toSRT(state.segments), "application/x-subrip");
      if (kind === "vtt") download(baseName() + ".vtt", toVTT(state.segments), "text/vtt");
      if (kind === "docx") {
        // Pro: sin licencia, el botón lleva a la página de la versión Pro.
        if (!state.pro) { location.href = b.dataset.proHref; return; }
        const paras = state.segments.filter((s) => s.text.trim()).map((s) => ({ time: els.showTimes.checked ? clock(s.start) : "", text: s.text }));
        download(baseName() + ".docx", toDOCX(paras), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      }
    };
  });
  // Versión Pro: el botón de Word solo aparece si Pro está a la venta o ya tienes la licencia.
  proStatus(new URL("../../data/pro.json", import.meta.url)).then((st) => {
    state.pro = st.active;
    for (const el of document.querySelectorAll("[data-pro]")) {
      el.hidden = !(st.enabled || st.active);
      el.classList.toggle("locked", !st.active);
    }
  });
  els.newBtn.onclick = () => {
    els.result.hidden = true;
    $("afiliados").hidden = true;
    els.status.hidden = true;
    state.segments = [];
    els.segments.textContent = "";
    clearFile();
    els.tool.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  window.addEventListener("beforeunload", (e) => {
    if (state.running || state.segments.length) { e.preventDefault(); e.returnValue = ""; }
  });
}

init();
