// Formatos de salida de la transcripción (TXT, SRT, VTT) y utilidades de tiempo.
// Módulo sin dependencias del DOM para poder probarlo con Node.

export function clock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function stamp(sec, sep) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(r, 3)}`;
}

export function bytes(n) {
  if (!n) return "";
  return n > 1e9 ? (n / 1e9).toFixed(1) + " GB" : Math.round(n / 1e6) + " MB";
}

export function toTXT(segs, withTimes) {
  return segs.map((s) => (withTimes ? `[${clock(s.start)}] ` : "") + s.text.trim()).join(withTimes ? "\n" : " ")
    .replace(/ {2,}/g, " ").trim() + "\n";
}

export function toSRT(segs) {
  return segs.map((s, i) => `${i + 1}\n${stamp(s.start, ",")} --> ${stamp(s.end, ",")}\n${s.text.trim()}\n`).join("\n");
}

export function toVTT(segs) {
  return "WEBVTT\n\n" + segs.map((s) => `${stamp(s.start, ".")} --> ${stamp(s.end, ".")}\n${s.text.trim()}\n`).join("\n");
}
