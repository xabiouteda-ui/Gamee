// Web Worker: carga Whisper con Transformers.js y transcribe el audio sin bloquear la página.
// Todo ocurre en el dispositivo del usuario; el audio nunca se envía a ningún servidor.

const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js";

const MODELS = {
  tiny: "onnx-community/whisper-tiny",
  base: "onnx-community/whisper-base",
  small: "onnx-community/whisper-small",
};

const SAMPLE_RATE = 16000;
const MAX_CHUNK_S = 30;   // Whisper procesa ventanas de 30 s
const MIN_CHUNK_S = 20;   // buscamos el silencio entre los segundos 20 y 30
const SILENCE_RMS = 0.004; // fragmentos más bajos que esto se consideran silencio

let lib = null;
let transcriber = null;
let loadedKey = null;
let cancelled = false;

const post = (msg) => self.postMessage(msg);

async function getLib() {
  if (!lib) {
    lib = await import(TRANSFORMERS_URL);
    lib.env.allowLocalModels = false;
  }
  return lib;
}

async function hasWebGPU() {
  try {
    if (!self.navigator?.gpu) return false;
    return !!(await self.navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

async function load(modelKey) {
  const device = (await hasWebGPU()) ? "webgpu" : "wasm";
  const key = modelKey + "|" + device;
  if (transcriber && loadedKey === key) {
    post({ type: "ready", device, cached: true });
    return;
  }
  const { pipeline } = await getLib();
  if (transcriber) {
    try { await transcriber.dispose(); } catch {}
    transcriber = null;
  }
  const progress_callback = (p) => {
    if (p.status === "progress_total") post({ type: "download", loaded: p.loaded, total: p.total });
  };
  const opts = (dev) => ({
    device: dev,
    dtype: dev === "webgpu"
      ? { encoder_model: "fp32", decoder_model_merged: "q4" }
      : { encoder_model: "q8", decoder_model_merged: "q8" },
    progress_callback,
  });
  try {
    transcriber = await pipeline("automatic-speech-recognition", MODELS[modelKey], opts(device));
    loadedKey = key;
    post({ type: "ready", device });
  } catch (err) {
    if (device !== "webgpu") throw err;
    // Algunos equipos anuncian WebGPU pero fallan al crear la sesión: volvemos a WebAssembly.
    transcriber = await pipeline("automatic-speech-recognition", MODELS[modelKey], opts("wasm"));
    loadedKey = modelKey + "|wasm";
    post({ type: "ready", device: "wasm" });
  }
}

function rms(audio, from, to) {
  let sum = 0;
  const n = Math.max(1, to - from);
  for (let i = from; i < to; i++) sum += audio[i] * audio[i];
  return Math.sqrt(sum / n);
}

// Divide el audio en ventanas de hasta 30 s cortando en el punto más silencioso
// entre los segundos 20 y 30 de cada ventana, para no partir palabras.
function splitPoints(audio) {
  const points = [0];
  const frame = Math.round(SAMPLE_RATE * 0.1);
  let start = 0;
  while (audio.length - start > MAX_CHUNK_S * SAMPLE_RATE) {
    const lo = start + MIN_CHUNK_S * SAMPLE_RATE;
    const hi = start + MAX_CHUNK_S * SAMPLE_RATE - frame;
    let best = hi, bestE = Infinity;
    for (let i = lo; i <= hi; i += frame) {
      const e = rms(audio, i, i + frame);
      if (e < bestE) { bestE = e; best = i; }
    }
    start = best + Math.floor(frame / 2);
    points.push(start);
  }
  points.push(audio.length);
  return points;
}

async function detectLanguage(audio) {
  try {
    const { Tensor } = await getLib();
    const model = transcriber.model;
    const cfg = model.generation_config;
    const sample = audio.subarray(0, Math.min(audio.length, MAX_CHUNK_S * SAMPLE_RATE));
    const { input_features } = await transcriber.processor(sample);
    const sot = BigInt(cfg.decoder_start_token_id);
    const out = await model.generate({
      inputs: input_features,
      decoder_input_ids: new Tensor("int64", BigInt64Array.from([sot]), [1, 1]),
      max_new_tokens: 1,
    });
    const seq = (out.sequences ?? out).tolist()[0];
    const id = Number(seq[seq.length - 1]);
    for (const [token, tid] of Object.entries(cfg.lang_to_id || {})) {
      if (Number(tid) === id) return token.slice(2, -2); // "<|es|>" -> "es"
    }
  } catch (e) {
    console.warn("No se pudo detectar el idioma", e);
  }
  return null;
}

async function transcribe({ audio, language, task, fallbackLanguage }) {
  cancelled = false;
  let lang = language;
  if (lang === "auto") {
    lang = (await detectLanguage(audio)) || fallbackLanguage || "es";
    post({ type: "language", language: lang });
  }
  const points = splitPoints(audio);
  const total = points.length - 1;
  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    if (cancelled) { post({ type: "cancelled" }); return; }
    const from = points[i], to = points[i + 1];
    const offset = from / SAMPLE_RATE;
    const chunkEnd = to / SAMPLE_RATE;
    const chunk = audio.subarray(from, to);
    let segments = [];
    if (rms(chunk, 0, chunk.length) > SILENCE_RMS && chunk.length > SAMPLE_RATE * 0.3) {
      const out = await transcriber(chunk, {
        language: lang,
        task,
        return_timestamps: true,
      });
      const parts = out.chunks && out.chunks.length ? out.chunks : [{ timestamp: [0, null], text: out.text }];
      segments = parts
        .map((c) => {
          const s = offset + (c.timestamp?.[0] ?? 0);
          let e = c.timestamp?.[1] == null ? chunkEnd : offset + c.timestamp[1];
          e = Math.min(Math.max(e, s + 0.2), chunkEnd);
          return { start: s, end: e, text: (c.text || "").trim() };
        })
        .filter((s) => s.text && !/^[\s.…,!?¡¿-]*$/.test(s.text));
    }
    post({
      type: "chunk",
      index: i,
      total,
      processed: to / SAMPLE_RATE,
      duration: audio.length / SAMPLE_RATE,
      elapsed: (performance.now() - t0) / 1000,
      segments,
    });
  }
  post({ type: "done" });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") await load(data.model);
    else if (data.type === "transcribe") await transcribe(data);
    else if (data.type === "cancel") cancelled = true;
  } catch (err) {
    console.error(err);
    post({ type: "error", message: String(err?.message || err) });
  }
};
