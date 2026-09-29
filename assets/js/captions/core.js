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
  const keys = [];
  const clean = newText.replace(/\*([^*\s]+)\*/g, (_, w) => { keys.push(w); return w; });
  const words = clean.trim() ? segmentsToWords([{ start: line.start, end: speechEnd, text: clean }]) : [];
  for (const w of words) if (keys.includes(w.text)) w.key = true;
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
  return lines.map((l, i) => `${i + 1}\n${stamp(l.start, ",")} --> ${stamp(l.end, ",")}\n${(t => (upper ? t.toLocaleUpperCase() : t))(l.words.map((w) => w.text).join(" ") || l.text)}\n`).join("\n");
}

// ---------- estilos ----------

export const FONTS = {
  montserrat: { family: "Caption Montserrat", weight: 900, file: "montserrat-latin-900-normal.woff2" },
  anton: { family: "Caption Anton", weight: 400, file: "anton-latin-400-normal.woff2" },
  bangers: { family: "Caption Bangers", weight: 400, file: "bangers-latin-400-normal.woff2" },
  sans: { family: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", weight: 700, file: null },
};

// size: altura de letra como fracción del lado corto del vídeo. pos: centro vertical (0 arriba, 1 abajo).
// keyColor: color de las palabras clave. maxWidth: ancho máximo del texto (fracción del vídeo).
export const PRESETS = {
  karaoke: { font: "montserrat", size: 0.075, pos: 0.66, color: "#ffffff", highlight: "#ffe600", keyColor: "#4ade80", outline: "#000000", outlineWidth: 0.16, box: "", activeBox: "", anim: "none", upper: true, maxWords: 3, shadow: true },
  pop: { font: "anton", size: 0.11, pos: 0.62, color: "#ffffff", highlight: "#ffffff", keyColor: "#ffe600", outline: "#000000", outlineWidth: 0.14, box: "", activeBox: "", anim: "pop", upper: true, maxWords: 1, shadow: true },
  marker: { font: "montserrat", size: 0.07, pos: 0.66, color: "#ffffff", highlight: "#ffffff", activeText: "#111111", keyColor: "#ffe600", outline: "#000000", outlineWidth: 0.14, box: "", activeBox: "#ffe600", anim: "pop", upper: true, maxWords: 3, shadow: true },
  progressive: { font: "montserrat", size: 0.072, pos: 0.66, color: "#ffffff", highlight: "#22d3ee", keyColor: "#ffe600", outline: "#000000", outlineWidth: 0.16, box: "", activeBox: "", anim: "fill", upper: true, maxWords: 4, shadow: true },
  neon: { font: "anton", size: 0.09, pos: 0.64, color: "#ffffff", highlight: "#ff4fd8", keyColor: "#7df9ff", outline: "#000000", outlineWidth: 0, box: "", activeBox: "", anim: "pop", upper: true, maxWords: 2, shadow: false, glow: true },
  box: { font: "montserrat", size: 0.065, pos: 0.68, color: "#ffffff", highlight: "#ffffff", keyColor: "#ffe600", outline: "#000000", outlineWidth: 0, box: "", activeBox: "#7c3aed", anim: "none", upper: false, maxWords: 4, shadow: false },
  bubble: { font: "bangers", size: 0.085, pos: 0.66, color: "#ffffff", highlight: "#22d3ee", keyColor: "#ffe600", outline: "#111111", outlineWidth: 0.18, box: "", activeBox: "", anim: "bounce", upper: true, maxWords: 2, shadow: true },
  // Estilos Pro
  headline: { font: "anton", size: 0.1, pos: 0.6, color: "#ffffff", highlight: "#ffffff", activeText: "#ffffff", keyColor: "#ffe600", outline: "#000000", outlineWidth: 0.1, box: "", activeBox: "#ef4444", anim: "pop", upper: true, maxWords: 2, shadow: true, pro: true },
  soft: { font: "montserrat", size: 0.06, pos: 0.7, color: "#1f2937", highlight: "#7c3aed", keyColor: "#db2777", outline: "#000000", outlineWidth: 0, box: "rgba(255,255,255,0.9)", activeBox: "", anim: "fill", upper: false, maxWords: 4, shadow: false, pro: true },
  classic: { font: "sans", size: 0.05, pos: 0.86, color: "#ffffff", highlight: "#ffffff", keyColor: "#ffffff", outline: "#000000", outlineWidth: 0, box: "rgba(0,0,0,0.65)", activeBox: "", anim: "none", upper: false, maxWords: 8, shadow: false },
};

// Zonas seguras aproximadas de cada plataforma en vídeo vertical (fracciones del alto/ancho que tapa la interfaz).
// Orientativas: la interfaz de las apps cambia; se deja margen.
export const PLATFORMS = {
  tiktok: { top: 0.1, bottom: 0.2, right: 0.14, left: 0.04, pos: 0.62 },
  reels: { top: 0.1, bottom: 0.22, right: 0.12, left: 0.04, pos: 0.62 },
  shorts: { top: 0.1, bottom: 0.2, right: 0.12, left: 0.04, pos: 0.64 },
};

// ---------- palabras clave y emojis ----------

const STOP = new Set(("a al algo algunos ante antes aquí así aunque bien cada casi como con contra cual cuando de del desde donde dos el él ella ellos en entre era es esa ese eso esta está este esto estos fue ha hay hasta la las le les lo los más me mi mis mucho muy nada ni no nos o otra otro para pero poco por porque que qué se ser si sí sin sobre son su sus también te tiene todo todos tu tus un una unas uno unos ya yo " +
  "about after again all also and any are because been before being but can could did does doing down for from had has have here how into its just more most not now off once only other our out over own same she should some such than that the their them then there these they this those through too under until very was were what when where which while who why will with would you your").split(" "));

const plain = (w) => w.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Marca como clave (key = "auto") como mucho una palabra por línea: números y palabras largas con contenido.
export function autoKeywords(lines) {
  for (const l of lines) {
    for (const w of l.words) if (w.key === "auto") delete w.key;
    if (l.words.some((w) => w.key === true)) continue;
    let best = null, bestScore = 0;
    for (const w of l.words) {
      const p = plain(w.text);
      if (!p || STOP.has(p)) continue;
      const score = /\d/.test(p) ? 20 + p.length : p.length >= 6 ? p.length : 0;
      if (score > bestScore) { bestScore = score; best = w; }
    }
    if (best) best.key = "auto";
  }
  return lines;
}

export function clearAutoKeywords(lines) {
  for (const l of lines) for (const w of l.words) if (w.key === "auto") delete w.key;
  return lines;
}

// Raíces de palabra → emoji (español e inglés). Se usa el primero que aparezca en la línea.
const EMOJI = [
  [/^(diner|pag|€|eur|ahorr|money|cash|pay|sav)/, "💰"], [/^(amor|quier|corazón|love|heart)/, "❤️"], [/^(fueg|brutal|increíbl|incre|fire|amazing|insane)/, "🔥"],
  [/^(idea|truco|consej|tip|hack)/, "💡"], [/^(jaj|risa|gracios|lol|funny|haha)/, "😂"], [/^(comid|comer|cena|desayun|food|eat|pizza)/, "🍕"],
  [/^(viaj|avión|vacacion|travel|trip|flight)/, "✈️"], [/^(músic|canci|music|song)/, "🎵"], [/^(tiemp|minut|hora|reloj|time|minute|hour)/, "⏰"],
  [/^(casa|hogar|home|house)/, "🏠"], [/^(trabaj|empleo|oficin|work|job|office)/, "💼"], [/^(feliz|alegr|happy)/, "😊"],
  [/^(trist|llor|sad|cry)/, "😢"], [/^(ojo|atenci|cuidad|importan|warning|careful|important)/, "⚠️"], [/^(secret|secret)/, "🤫"],
  [/^(gan|éxito|victori|win|success)/, "🏆"], [/^(deport|gym|entren|workout|train)/, "💪"], [/^(libr|estudi|aprend|book|study|learn)/, "📚"],
  [/^(móvil|teléfon|phone|app)/, "📱"], [/^(coche|car)$/, "🚗"], [/^(sol|verano|playa|sun|summer|beach)/, "☀️"], [/^(pregunt|duda|question)/, "❓"],
];

export function autoEmojis(lines) {
  for (const l of lines) {
    if (l.emoji && !l.emojiAuto) continue;
    delete l.emoji; delete l.emojiAuto;
    for (const w of l.words) {
      const p = w.text.toLocaleLowerCase().replace(/[^\p{L}\p{N}€]/gu, "");
      const hit = EMOJI.find(([re]) => re.test(p));
      if (hit) { l.emoji = hit[1]; l.emojiAuto = true; break; }
    }
  }
  return lines;
}

export function clearAutoEmojis(lines) {
  for (const l of lines) if (l.emojiAuto) { delete l.emoji; delete l.emojiAuto; }
  return lines;
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

// Texto de una línea tal y como se edita: *palabra* = palabra clave marcada a mano.
export function lineEditText(line) {
  return line.words.map((w) => (w.key === true ? `*${w.text}*` : w.text)).join(" ");
}


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

  // Reparte las palabras en filas que quepan en el ancho permitido (menos si hay zona segura).
  const maxW = W * (style.maxWidth ?? 0.88);
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

  if (line.emoji && style.emojis !== false) {
    const k = Math.min(1, (t - line.start) / 0.15);
    const ep = px * 1.25 * (0.6 + 0.4 * k);
    ctx.save();
    ctx.font = `${ep}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(line.emoji, W * (style.centerX ?? 0.5), cy - lineH / 2 - px * 0.9);
    ctx.restore();
  }

  for (const row of rows) {
    const rw = row.reduce((a, i, k) => a + widths[i] + (k ? space : 0), 0);
    let x = (W * (style.centerX ?? 0.5)) - rw / 2;
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
      const emoji = EMOJI_RE.test(words[i]);
      if (active && style.activeBox) {
        ctx.fillStyle = style.activeBox;
        roundRect(ctx, x - pad * 0.6, cy - lineH / 2 + px * 0.06, widths[i] + pad * 1.2, lineH - px * 0.12, px * 0.18);
      }
      if (style.shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = px * 0.18;
        ctx.shadowOffsetY = px * 0.05;
      }
      if (style.glow) {
        ctx.shadowColor = active ? style.highlight : w.key ? style.keyColor : style.highlight;
        ctx.shadowBlur = px * (active ? 0.5 : 0.28);
      }
      if (style.outlineWidth > 0 && !emoji) {
        ctx.strokeStyle = style.outline;
        ctx.lineWidth = px * style.outlineWidth;
        ctx.strokeText(words[i], x, cy);
        ctx.shadowColor = "transparent";
      }
      const spoken = style.anim === "fill" && t >= w.start;
      ctx.fillStyle = active && style.activeBox && style.activeText ? style.activeText
        : active || spoken ? style.highlight
        : w.key && style.keys !== false ? style.keyColor : style.color;
      ctx.fillText(words[i], x, cy);
      ctx.restore();
      x += widths[i] + space;
    }
    cy += lineH;
  }
  ctx.restore();
}

// Crédito opcional «Hecho con …» (arriba a la izquierda, dentro de la zona segura si la hay). Pequeño y discreto:
// una píldora semitransparente con el logotipo de barras de la web. safe: { top, left } en fracciones del vídeo.
export function drawCredit(ctx, W, H, text, safe = null) {
  if (!text) return;
  const px = Math.max(10, Math.round(Math.min(W, H) * 0.024));
  const x = W * ((safe?.left ?? 0) + 0.03), y = H * ((safe?.top ?? 0) + 0.02);
  ctx.save();
  ctx.font = `600 ${px}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const icon = px * 1.1, gap = px * 0.45, padX = px * 0.6, h = px * 1.9;
  const w = padX * 2 + icon + gap + ctx.measureText(text).width;
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  roundRect(ctx, x, y, w, h, h / 2);
  // Logotipo: 5 barras de ecualizador.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineCap = "round";
  ctx.lineWidth = icon * 0.13;
  const cy = y + h / 2;
  [0.35, 0.6, 0.9, 0.55, 0.3].forEach((k, i) => {
    const bx = x + padX + (icon * (i + 0.5)) / 5;
    ctx.beginPath();
    ctx.moveTo(bx, cy - (icon * k) / 2);
    ctx.lineTo(bx, cy + (icon * k) / 2);
    ctx.stroke();
  });
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillText(text, x + padX + icon + gap, cy + px * 0.04);
  ctx.restore();
  return { x, y, w, h };
}


// ---------- Reencuadre a 9:16 siguiendo la cara ----------

// Momentos del vídeo en los que se busca la cara: cada `step` s, como mucho `max` muestras.
export function faceSampleTimes(duration, step = 0.5, max = 240) {
  if (!(duration > 0)) return [0];
  const s = Math.max(step, duration / max);
  const out = [];
  for (let t = 0; t < duration; t += s) out.push(+t.toFixed(3));
  return out;
}

// De las caras detectadas (cajas en píxeles) se sigue la más grande: suele ser quien habla.
export function mainFaceX(detections) {
  let best = null;
  for (const d of detections || []) {
    const b = d.boundingBox;
    if (b && (!best || b.width * b.height > best.width * best.height)) best = b;
  }
  return best ? best.originX + best.width / 2 : null;
}

// Muestras {t, x} (centro de la cara en píxeles o null si no hay cara) → recorrido suave del recorte.
// Devuelve [{t, p}] con p entre 0 (recorte pegado a la izquierda) y 1 (a la derecha); null si no hay caras.
// Sin cara se mantiene la última posición conocida; una media móvil quita los tirones del detector y una zona
// muerta evita que la imagen «baile» cuando la persona apenas se mueve.
export function smoothFaceTrack(samples, vw, cw, { win = 3, dead = 0.05 } = {}) {
  const room = vw - cw;
  if (!samples.length || room <= 0) return null;
  const known = samples.map((s, i) => (s.x == null ? -1 : i)).filter((i) => i >= 0);
  if (!known.length) return null;
  const filled = samples.map((s, i) => {
    if (s.x != null) return s.x;
    let best = known[0];
    for (const k of known) if (Math.abs(k - i) < Math.abs(best - i)) best = k;
    return samples[best].x;
  });
  const half = Math.floor(win / 2);
  const avg = filled.map((_, i) => {
    const a = Math.max(0, i - half), b = Math.min(filled.length - 1, i + half);
    let sum = 0;
    for (let j = a; j <= b; j++) sum += filled[j];
    return sum / (b - a + 1);
  });
  const dz = dead * vw;
  let cur = avg[0];
  return samples.map((s, i) => {
    const d = avg[i] - cur;
    if (Math.abs(d) > dz) cur += d - Math.sign(d) * dz;
    const sx = Math.min(room, Math.max(0, cur - cw / 2));
    return { t: s.t, p: +(sx / room).toFixed(4) };
  });
}

// Posición del recorte en el instante t (interpolada entre muestras).
export function cropAt(track, t) {
  if (!track || !track.length) return 0.5;
  if (t <= track[0].t) return track[0].p;
  for (let i = 1; i < track.length; i++) {
    if (t <= track[i].t) {
      const a = track[i - 1], b = track[i];
      return a.p + ((b.p - a.p) * (t - a.t)) / (b.t - a.t);
    }
  }
  return track[track.length - 1].p;
}
