// Lógica de los subtítulos animados: palabras con tiempos, agrupación en líneas, lectura de SRT/VTT,
// estilos y dibujo en un canvas. Sin dependencias del DOM (salvo el contexto 2D que se le pasa) para poder
// usarlo igual en la vista previa, al exportar el vídeo y en las pruebas con Node.

// ---------- palabras ----------

// Peso aproximado de una palabra para repartir el tiempo de una frase (≈ sílabas/letras).
function weight(word) {
  const letters = word.replace(/[^\p{L}\p{N}]/gu, "").length;
  return Math.max(1, letters) + 1.5;
}

// Convierte segmentos {start,end,text,words?} en una lista plana de palabras {text,start,end}.
// Si un segmento no trae tiempos por palabra, se reparten proporcionalmente a su longitud.
// Con { keepCues: true } cada palabra recuerda su segmento para no mezclar líneas de un SRT importado.
export function segmentsToWords(segments, { keepCues = false } = {}) {
  const out = [];
  for (const [cue, seg] of segments.entries()) {
    if (seg.words && seg.words.length) {
      for (const w of seg.words) if (w.text.trim()) out.push({ text: w.text.trim(), start: w.start, end: w.end });
      continue;
    }
    const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const total = tokens.reduce((a, w) => a + weight(w), 0);
    const dur = Math.max(0.1, seg.end - seg.start);
    let t = seg.start;
    for (const tok of tokens) {
      const d = (dur * weight(tok)) / total;
      out.push(keepCues ? { text: tok, start: t, end: t + d, cue } : { text: tok, start: t, end: t + d });
      t += d;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

// Agrupa palabras en líneas cortas (lo que se ve en pantalla a la vez).
export function groupWords(words, { maxWords = 3, maxChars = Math.max(14, maxWords * 8), maxGap = 0.7 } = {}) {
  const lines = [];
  let cur = null;
  for (const w of words) {
    const prev = cur?.words.at(-1);
    if (w.cue != null) {
      // Líneas de un SRT importado: se respetan tal cual.
      if (!cur || prev.cue !== w.cue) { cur = { words: [] }; lines.push(cur); }
      cur.words.push({ ...w });
      continue;
    }
    const chars = cur ? cur.words.reduce((a, x) => a + x.text.length + 1, 0) + w.text.length : 0;
    const breakHere = !cur
      || cur.words.length >= maxWords
      || (cur.words.length > 0 && chars > maxChars)
      || w.start - prev.end > maxGap
      || /[.!?…]["»”']?$/.test(prev.text);
    if (breakHere) {
      cur = { words: [] };
      lines.push(cur);
    }
    cur.words.push({ ...w });
  }
  for (const l of lines) {
    l.start = l.words[0].start;
    l.end = l.words.at(-1).end;
  }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1];
    // Mantiene la línea un poco en pantalla tras la última palabra, sin pisar a la siguiente.
    const hold = next ? Math.min(0.5, Math.max(0, next.start - l.end)) : 0.5;
    l.end += hold;
    l.text = l.words.map((w) => w.text).join(" ");
  }
  return lines;
}

// Sustituye el texto de una línea editada por el usuario, repartiendo su tiempo entre las nuevas palabras.
export function retimeLine(line, newText) {
  const speechEnd = line.words.at(-1)?.end ?? line.end;
  const cue = line.words[0]?.cue;
  const words = newText.trim() ? segmentsToWords([{ start: line.start, end: speechEnd, text: newText }]) : [];
  if (cue != null) for (const w of words) w.cue = cue;
  return { ...line, words, text: words.map((w) => w.text).join(" ") };
}

// ---------- SRT / VTT ----------

function parseTime(s) {
  const m = s.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/);
  if (!m) return NaN;
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000;
}

export function parseSubtitles(text) {
  const blocks = text.replace(/\r/g, "").replace(/^﻿/, "").split(/\n{2,}/);
  const segs = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter((l) => l.trim() !== "");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, z] = lines[i].split("-->");
    const start = parseTime(a), end = parseTime(z);
    const body = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
    if (body && isFinite(start) && isFinite(end) && end > start) segs.push({ start, end, text: body });
  }
  return segs.sort((a, b) => a.start - b.start);
}

function stamp(sec, sep) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`;
}

export function linesToSRT(lines, upper = false) {
  return lines.map((l, i) => `${i + 1}\n${stamp(l.start, ",")} --> ${stamp(l.end, ",")}\n${upper ? l.text.toLocaleUpperCase() : l.text}\n`).join("\n");
}

// ---------- estilos ----------

export const FONTS = {
  montserrat: { family: "Caption Montserrat", weight: 900, file: "montserrat-latin-900-normal.woff2" },
  anton: { family: "Caption Anton", weight: 400, file: "anton-latin-400-normal.woff2" },
  bangers: { family: "Caption Bangers", weight: 400, file: "bangers-latin-400-normal.woff2" },
  sans: { family: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", weight: 700, file: null },
};

// size: altura de letra como fracción del lado corto del vídeo. pos: centro vertical (0 arriba, 1 abajo).
export const PRESETS = {
  karaoke: { font: "montserrat", size: 0.075, pos: 0.7, color: "#ffffff", highlight: "#ffe600", outline: "#000000", outlineWidth: 0.16, box: "", activeBox: "", anim: "none", upper: true, maxWords: 3, shadow: true },
  pop: { font: "anton", size: 0.11, pos: 0.62, color: "#ffffff", highlight: "#ffffff", outline: "#000000", outlineWidth: 0.14, box: "", activeBox: "", anim: "pop", upper: true, maxWords: 1, shadow: true },
  box: { font: "montserrat", size: 0.065, pos: 0.72, color: "#ffffff", highlight: "#ffffff", outline: "#000000", outlineWidth: 0, box: "", activeBox: "#7c3aed", anim: "none", upper: false, maxWords: 4, shadow: false },
  bubble: { font: "bangers", size: 0.085, pos: 0.7, color: "#ffffff", highlight: "#22d3ee", outline: "#111111", outlineWidth: 0.18, box: "", activeBox: "", anim: "bounce", upper: true, maxWords: 2, shadow: true },
  classic: { font: "sans", size: 0.05, pos: 0.86, color: "#ffffff", highlight: "#ffffff", outline: "#000000", outlineWidth: 0, box: "rgba(0,0,0,0.65)", activeBox: "", anim: "none", upper: false, maxWords: 8, shadow: false },
};

export function activeLine(lines, t) {
  // Búsqueda binaria de la última línea que empieza antes de t.
  let lo = 0, hi = lines.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].start <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return idx >= 0 && t < lines[idx].end ? lines[idx] : null;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

// Dibuja los subtítulos del instante t sobre un lienzo de W×H (en píxeles del vídeo).
export function drawCaptions(ctx, W, H, t, lines, style) {
  const line = activeLine(lines, t);
  if (!line || !line.words.length) return;
  const font = FONTS[style.font] || FONTS.sans;
  const px = Math.round(Math.min(W, H) * style.size);
  ctx.save();
  ctx.font = `${font.weight} ${px}px ${font.family.includes(",") ? font.family : `"${font.family}"`}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  const words = line.words.map((w) => (style.upper ? w.text.toLocaleUpperCase() : w.text));
  const space = ctx.measureText(" ").width;
  const widths = words.map((w) => ctx.measureText(w).width);
  const pad = px * 0.25;

  // Reparte las palabras en filas que quepan en el 88 % del ancho.
  const maxW = W * 0.88;
  const rows = [[]];
  let rowW = 0;
  words.forEach((_, i) => {
    const add = (rows.at(-1).length ? space : 0) + widths[i];
    if (rows.at(-1).length && rowW + add > maxW) { rows.push([]); rowW = 0; }
    rowW += (rows.at(-1).length ? space : 0) + widths[i];
    rows.at(-1).push(i);
  });
  const lineH = px * 1.22;
  const blockH = rows.length * lineH;
  let cy = Math.min(H - blockH / 2 - px * 0.3, Math.max(blockH / 2 + px * 0.3, style.pos * H)) - blockH / 2 + lineH / 2;

  for (const row of rows) {
    const rw = row.reduce((a, i, k) => a + widths[i] + (k ? space : 0), 0);
    let x = (W - rw) / 2;
    if (style.box) {
      ctx.fillStyle = style.box;
      roundRect(ctx, x - pad, cy - lineH / 2, rw + pad * 2, lineH, px * 0.2);
    }
    for (const i of row) {
      const w = line.words[i];
      const active = t >= w.start && t < (line.words[i + 1]?.start ?? line.end);
      const cx = x + widths[i] / 2;
      ctx.save();
      let scale = 1;
      if (style.anim === "pop" && active) scale = 0.75 + 0.25 * Math.min(1, (t - w.start) / 0.12);
      if (style.anim === "bounce" && active) scale = 1 + 0.12 * Math.sin(Math.min(1, (t - w.start) / 0.18) * Math.PI);
      if (scale !== 1) {
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
      }
      if (active && style.activeBox) {
        ctx.fillStyle = style.activeBox;
        roundRect(ctx, x - pad * 0.6, cy - lineH / 2 + px * 0.06, widths[i] + pad * 1.2, lineH - px * 0.12, px * 0.18);
      }
      if (style.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = px * 0.18;
        ctx.shadowOffsetY = px * 0.05;
      }
      if (style.outlineWidth > 0) {
        ctx.strokeStyle = style.outline;
        ctx.lineWidth = px * style.outlineWidth;
        ctx.strokeText(words[i], x, cy);
        ctx.shadowColor = "transparent";
      }
      ctx.fillStyle = active ? style.highlight : style.color;
      ctx.fillText(words[i], x, cy);
      ctx.restore();
      x += widths[i] + space;
    }
    cy += lineH;
  }
  ctx.restore();
}
