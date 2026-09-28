// Widget «precio de la luz hoy»: precio de la hora actual, gráfico de 24 horas y horas más barata y más cara.
// Opciones en la URL del iframe: ?tema=claro|oscuro (por defecto, el del sistema).
import { dayStats } from "./pvpc.js";
import { madridDate } from "./hoy.js";

const $ = (id) => document.getElementById(id);
const eur = (p) => p.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const hh = (h) => `${String(h).padStart(2, "0")}`;
const span = (h) => `${hh(h)}–${hh(h + 1)} h`;

const tema = new URLSearchParams(location.search).get("tema");
if (tema === "oscuro") document.documentElement.dataset.theme = "dark";
if (tema === "claro") document.documentElement.dataset.theme = "light";

// Hora actual en España peninsular (0–23), sea cual sea la zona del visitante.
export function madridHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(now));
}

// Nivel de una hora respecto al resto del día: tercio más barato, medio o más caro.
export function level(prices, p) {
  const s = prices.filter((x) => x != null).sort((a, b) => a - b);
  const t1 = s[Math.floor(s.length / 3)], t2 = s[Math.floor((2 * s.length) / 3)];
  return p < t1 ? "cheap" : p < t2 ? "mid" : "dear";
}
const LEVEL_TEXT = { cheap: "de las más baratas", mid: "precio medio", dear: "de las más caras" };

async function load() {
  for (const f of ["pvpc-hoy.json", "pvpc.json"]) {
    try {
      const r = await fetch(new URL(`../../../data/${f}`, import.meta.url));
      if (r.ok) return await r.json();
    } catch {}
  }
  return null;
}

async function init() {
  const st = dayStats(await load(), madridDate(0));
  if (!st) { $("w-now").innerHTML = '<p class="w-empty">Ahora mismo no tenemos los precios de hoy.</p>'; return; }
  $("w-date").textContent = new Date(st.date + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const h = madridHour();
  const p = st.prices[h];
  const now = $("w-now");
  now.replaceChildren();
  if (p != null) {
    const lv = level(st.prices, p);
    const label = Object.assign(document.createElement("p"), { className: "w-label", textContent: `Ahora (${span(h)})` });
    const price = Object.assign(document.createElement("p"), { className: "w-price", textContent: eur(p) });
    const unit = Object.assign(document.createElement("p"), { className: "w-unit", textContent: "€/kWh" });
    const tag = Object.assign(document.createElement("p"), { className: `w-level ${lv}`, textContent: LEVEL_TEXT[lv] });
    now.append(label, price, unit, tag);
  }
  const max = Math.max(...st.prices.filter((x) => x != null));
  const chart = $("w-chart");
  chart.replaceChildren(...st.prices.map((x, i) => {
    const b = document.createElement("span");
    b.style.height = x == null ? "0" : `${Math.max(3, (x / max) * 100)}%`;
    if (st.cheapest.includes(i)) b.classList.add("cheap");
    if (i === h) b.classList.add("now");
    b.title = x == null ? span(i) : `${span(i)}: ${eur(x)} €/kWh`;
    return b;
  }));
  $("w-extremes").textContent = `Más barata: ${span(st.min.h)} (${eur(st.min.p)}) · Más cara: ${span(st.max.h)} (${eur(st.max.p)})`;
}

if (typeof document !== "undefined") init();
