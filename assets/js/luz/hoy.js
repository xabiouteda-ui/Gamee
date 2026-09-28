// «¿A qué hora es más barata la luz hoy?»: precios horarios del PVPC de hoy y mañana desde data/pvpc.json.
import { dayStats } from "./pvpc.js";

const $ = (id) => document.getElementById(id);
const eurKwh = (p) => p.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " €/kWh";
const hh = (h) => `${String(h).padStart(2, "0")}:00`;
const range = (h, len = 1) => `${hh(h)}–${hh((h + len) % 24 || 24)}`.replace("–00:00", "–24:00");
const SVGNS = "http://www.w3.org/2000/svg";

// Fecha de hoy en España peninsular, sea cual sea la zona horaria del visitante.
export function madridDate(offsetDays = 0, now = new Date()) {
  const d = new Date(now.getTime() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(d);
}

const longDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function svg(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function chart(stats) {
  const W = 640, H = 220, L = 46, B = 26, TOP = 18;
  const max = Math.max(...stats.prices.filter((p) => p != null)) * 1.1;
  const slot = (W - L - 6) / 24, bw = slot * 0.72;
  const y = (v) => TOP + (H - TOP - B) * (1 - v / max);
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img", "aria-label": `Precio de la luz por horas, ${longDate(stats.date)}` });
  for (let k = 0; k <= 3; k++) {
    const v = (max * k) / 3;
    root.appendChild(svg("line", { x1: L, x2: W - 6, y1: y(v), y2: y(v), class: k ? "grid" : "axis" }));
    const t = svg("text", { x: L - 6, y: y(v) + 4, class: "tick", "text-anchor": "end" });
    t.textContent = v.toFixed(2).replace(".", ",");
    root.appendChild(t);
  }
  const unit = svg("text", { x: L - 6, y: 10, class: "tick", "text-anchor": "end" });
  unit.textContent = "€/kWh";
  root.appendChild(unit);
  stats.prices.forEach((p, h) => {
    if (p == null) return;
    const x = L + slot * h + (slot - bw) / 2;
    const cheap = stats.cheapest.includes(h);
    const g = svg("g", { class: "bar", tabindex: "0", "data-tip": `${range(h)} · ${eurKwh(p)}${cheap ? " · de las más baratas" : ""}` });
    const top = y(p), r = Math.min(4, (H - B - top) / 2);
    g.appendChild(svg("path", { class: cheap ? "seg-P3" : "seg-P1", d: `M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - B} Z` }));
    g.appendChild(svg("rect", { class: "hit", x: L + slot * h, y: TOP, width: slot, height: H - TOP - B }));
    root.appendChild(g);
    if (h % 3 === 0) {
      const t = svg("text", { x: x + bw / 2, y: H - 8, class: "tick", "text-anchor": "middle" });
      t.textContent = String(h);
      root.appendChild(t);
    }
  });
  return root;
}

function block(stats, title) {
  const wrap = document.createElement("section");
  wrap.className = "day card";
  const h = document.createElement("h2");
  h.textContent = `${title}: ${longDate(stats.date)}`;
  const kpis = document.createElement("div");
  kpis.className = "kpis";
  const tile = (label, value, sub) => {
    const d = document.createElement("div");
    d.className = "kpi";
    d.innerHTML = '<span class="kpi-label"></span><strong class="kpi-value"></strong><span class="kpi-sub"></span>';
    d.children[0].textContent = label;
    d.children[1].textContent = value;
    d.children[2].textContent = sub;
    return d;
  };
  kpis.append(
    tile("Hora más barata", range(stats.min.h), eurKwh(stats.min.p)),
    tile("Hora más cara", range(stats.max.h), eurKwh(stats.max.p)),
    tile("Precio medio", eurKwh(stats.mean), "sin impuestos"),
    tile("Mejor franja de 3 h", stats.best3 ? range(stats.best3.start, 3) : "—", stats.best3 ? "media " + eurKwh(stats.best3.avg) : ""),
  );
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = '<span><i class="sw sw-P3"></i>Las 3 horas más baratas</span><span><i class="sw sw-P1"></i>Resto de horas</span>';
  const det = document.createElement("details");
  det.className = "data-table";
  det.innerHTML = "<summary>Ver los 24 precios en tabla</summary>";
  const tbl = document.createElement("table");
  tbl.innerHTML = "<thead><tr><th>Hora</th><th>€/kWh</th></tr></thead>";
  const tb = tbl.createTBody();
  stats.prices.forEach((p, i) => { const r = tb.insertRow(); r.insertCell().textContent = range(i); const c = r.insertCell(); c.textContent = p == null ? "—" : p.toFixed(4); c.className = "num"; });
  det.appendChild(tbl);
  wrap.append(h, kpis, legend, chart(stats), det);
  return wrap;
}

async function init() {
  const out = $("hoy");
  if (!out) return;
  let pvpc = null;
  try { const r = await fetch(new URL("../../../data/pvpc.json", import.meta.url)); if (r.ok) pvpc = await r.json(); } catch {}
  const today = dayStats(pvpc, madridDate(0));
  if (!today) {
    if (!out.querySelector(".day")) out.querySelector(".hoy-empty").hidden = false;
    return;
  }
  const blocks = [block(today, "Hoy")];
  const tomorrow = dayStats(pvpc, madridDate(1));
  if (tomorrow) blocks.push(block(tomorrow, "Mañana"));
  out.replaceChildren(...blocks);
  const upd = $("hoy-updated");
  if (upd) upd.textContent = `Datos de Red Eléctrica actualizados el ${new Date(pvpc.updated).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" })}.`;
  // Tooltip
  const tipEl = $("tip");
  out.addEventListener("mousemove", (e) => {
    const t = e.target.closest?.("[data-tip]");
    if (!t) { tipEl.hidden = true; return; }
    tipEl.textContent = t.dataset.tip;
    tipEl.hidden = false;
    tipEl.style.left = `${Math.max(8, Math.min(window.innerWidth - tipEl.offsetWidth - 8, e.clientX - tipEl.offsetWidth / 2))}px`;
    tipEl.style.top = `${e.clientY + window.scrollY - tipEl.offsetHeight - 12}px`;
  });
  out.addEventListener("mouseleave", () => { tipEl.hidden = true; });
}

if (typeof document !== "undefined") init();
