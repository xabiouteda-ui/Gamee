// «Horarios de la luz»: en qué tramo (punta, llano o valle) estamos ahora, cuándo cambia y cómo quedan hoy y mañana.
// Con data/pvpc.json añade el precio medio del PVPC en cada tramo y si la hora más barata de hoy cae en valle.
// La parte de cálculo no usa el DOM y se prueba con Node (tests/unit-luz-contenido.mjs).
import { periodOf } from "./core.js";
import { dayStats } from "./pvpc.js";

export const NAMES = { P1: "punta", P2: "llano", P3: "valle" };
const hh = (h) => `${String(h).padStart(2, "0")}:00`;

// Fecha (AAAA-MM-DD) y hora (0–23) en España peninsular para un instante dado.
export function madridNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}

export function addDays(date, n) {
  return new Date(Date.parse(date + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
}

// Los 24 tramos de un día.
export const dayPeriods = (date) => Array.from({ length: 24 }, (_, h) => periodOf(date, h));

// Cuándo termina el tramo actual: { period, until: { date, hour } } (busca hasta 4 días por los puentes).
export function nextChange(date, hour) {
  const period = periodOf(date, hour);
  for (let i = 1; i <= 96; i++) {
    const t = hour + i;
    const d = addDays(date, Math.floor(t / 24));
    const p = periodOf(d, t % 24);
    if (p !== period) return { period, next: p, until: { date: d, hour: t % 24 } };
  }
  return { period, next: null, until: null };
}

// ¿Es un día entero de valle? (sábado, domingo o festivo nacional de fecha fija).
export const allValle = (date) => dayPeriods(date).every((p) => p === "P3");

// ---------- interfaz ----------

const longDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const eurKwh = (p) => p.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " €/kWh";

function strip(date, nowHour) {
  const wrap = document.createElement("div");
  wrap.className = "strip-day";
  const title = document.createElement("h2");
  title.textContent = longDate(date)[0].toUpperCase() + longDate(date).slice(1) + (allValle(date) ? ": todo el día valle" : "");
  const row = document.createElement("ol");
  row.className = "strip";
  row.setAttribute("aria-label", `Tramos de la luz, ${longDate(date)}`);
  dayPeriods(date).forEach((p, h) => {
    const li = document.createElement("li");
    li.className = `seg-cell sw-${p}${h === nowHour ? " now" : ""}`;
    li.title = `${hh(h)}–${hh(h + 1)} · ${NAMES[p]}`;
    li.innerHTML = `<span class="sr-only">${hh(h)}: ${NAMES[p]}${h === nowHour ? " (ahora)" : ""}</span>`;
    row.appendChild(li);
  });
  const ticks = document.createElement("div");
  ticks.className = "strip-ticks";
  ticks.setAttribute("aria-hidden", "true");
  ticks.innerHTML = [0, 4, 8, 12, 16, 20, 24].map((h) => `<span>${h}</span>`).join("");
  wrap.append(title, row, ticks);
  return wrap;
}

function tile(label, value, sub, cls = "") {
  const d = document.createElement("div");
  d.className = "kpi " + cls;
  d.innerHTML = '<span class="kpi-label"></span><strong class="kpi-value"></strong><span class="kpi-sub"></span>';
  d.children[0].textContent = label;
  d.children[1].textContent = value;
  d.children[2].textContent = sub;
  return d;
}

async function init() {
  const out = document.getElementById("periodos");
  if (!out) return;
  const { date, hour } = madridNow();
  const ch = nextChange(date, hour);
  const untilTxt = ch.until ? (ch.until.date === date ? `hasta las ${hh(ch.until.hour)}` : ch.until.date === addDays(date, 1) ? `hasta mañana a las ${hh(ch.until.hour)}` : `hasta el ${longDate(ch.until.date)} a las ${hh(ch.until.hour)}`) : "";
  const kpis = document.createElement("div");
  kpis.className = "kpis";
  kpis.append(
    tile(`Ahora (${hh(hour)}, hora peninsular)`, NAMES[ch.period][0].toUpperCase() + NAMES[ch.period].slice(1), untilTxt, "now-" + ch.period),
    tile("Después", ch.next ? NAMES[ch.next][0].toUpperCase() + NAMES[ch.next].slice(1) : "—", ch.until ? `desde las ${hh(ch.until.hour)}` : ""),
  );
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.innerHTML = '<span><i class="sw sw-P1"></i>Punta</span><span><i class="sw sw-P2"></i>Llano</span><span><i class="sw sw-P3"></i>Valle</span>';
  const nodes = [kpis, legend, strip(date, hour), strip(addDays(date, 1), -1)];

  let pvpc = null;
  try { const r = await fetch(new URL("../../../data/pvpc.json", import.meta.url)); if (r.ok) pvpc = await r.json(); } catch {}
  if (pvpc?.avg365?.P1) {
    const box = document.createElement("div");
    box.className = "pvpc-tramos";
    const h = document.createElement("h2");
    h.textContent = "Precio medio del PVPC en cada tramo (últimos 12 meses)";
    const k = document.createElement("div");
    k.className = "kpis";
    for (const p of ["P1", "P2", "P3"]) k.appendChild(tile(NAMES[p][0].toUpperCase() + NAMES[p].slice(1), eurKwh(pvpc.avg365[p]), "energía, sin impuestos"));
    box.append(h, k);
    const today = dayStats(pvpc, date);
    if (today) {
      const p = document.createElement("p");
      p.className = "pvpc-hoy";
      const tramo = NAMES[periodOf(date, today.min.h)];
      p.textContent = `Hoy la hora más barata del PVPC es de ${hh(today.min.h)} a ${hh(today.min.h + 1)} (${eurKwh(today.min.p)}), en tramo ${tramo}${tramo === "valle" ? "." : ": con el PVPC no siempre coincide la hora más barata con el valle."}`;
      box.appendChild(p);
    }
    nodes.push(box);
  }
  out.replaceChildren(...nodes);
}

if (typeof document !== "undefined") init();
