// «¿Cuánto cuesta poner la lavadora / el horno / el aire… hoy?» y «¿a qué hora cargo el coche?».
// Coste de un uso según la hora a la que se empieza, con los precios reales del PVPC de hoy (y de mañana si ya
// están publicados). La parte de cálculo no usa el DOM y se prueba con Node (tests/unit-luz-contenido.mjs).
import { RULES } from "./core.js";
import { madridDate } from "./hoy.js";

// Precio con impuesto eléctrico e IVA.
export const withTaxes = (eur) => eur * (1 + RULES.electricityTax) * (1 + RULES.vat);

// Coste (sin impuestos) de consumir `kwh` repartidos por igual en `hours` horas empezando en `start`.
// prices: precios horarios seguidos (hoy y, si existe, mañana). null si la ventana sale de los datos.
export function windowCost(prices, start, kwh, hours) {
  if (!(hours > 0) || !(kwh >= 0)) return null;
  let cost = 0;
  for (let i = 0; i < Math.ceil(hours - 1e-9); i++) {
    const p = prices[start + i];
    if (p == null) return null;
    cost += p * kwh * (Math.min(1, hours - i) / hours);
  }
  return cost;
}

// Coste de empezar a cada hora. Devuelve [{ start, day, hour, cost }] ordenado por hora de inicio.
// days: [{ date, prices[24] }] (hoy y opcionalmente mañana). from: primera hora posible (índice en la serie).
export function costByStart(days, kwh, hours, from = 0) {
  const series = days.flatMap((d) => d.prices);
  const out = [];
  for (let s = from; s < series.length; s++) {
    const cost = windowCost(series, s, kwh, hours);
    if (cost != null) out.push({ start: s, day: days[Math.floor(s / 24)].date, hour: s % 24, cost });
  }
  return out;
}

// Resumen para mostrar: ahora, la más barata y la más cara (de las horas que quedan), y el ahorro.
export function summary(options, nowIndex) {
  if (!options.length) return null;
  const sorted = [...options].sort((a, b) => a.cost - b.cost);
  const now = options.find((o) => o.start === nowIndex) || null;
  const best = sorted[0], worst = sorted.at(-1);
  return { now, best, worst, saving: (now || worst).cost - best.cost };
}

// Hora actual en Madrid (0–23).
export function madridHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(now));
}

// ---------- interfaz ----------
const $ = (id) => document.getElementById(id);
const eur = (n) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: n < 1 ? 3 : 2 });
const cents = (n) => (n < 1 ? `${(n * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} céntimos` : eur(n));
const hh = (h) => `${String(h % 24).padStart(2, "0")}:00`;
const dayName = (o, today) => (o.day === today ? "hoy" : "mañana");
const num = (id) => Number(String($(id)?.value ?? "").replace(",", "."));

async function init() {
  const root = $("coste");
  if (!root) return;
  const ev = root.dataset.mode === "coche";
  let pvpc = null;
  try { const r = await fetch(new URL("../../../data/pvpc.json", import.meta.url)); if (r.ok) pvpc = await r.json(); } catch {}
  const today = madridDate(0), tomorrow = madridDate(1);
  const days = [today, tomorrow].filter((d) => pvpc?.days?.[d]?.some((p) => p != null)).map((date) => ({ date, prices: pvpc.days[date] }));
  const out = $("c-result");

  const calc = () => {
    let kwh, hours;
    if (ev) {
      const km = num("c-km"), cons = num("c-cons"), power = num("c-power");
      kwh = (km * cons) / 100 / 0.9; // ~10 % de pérdidas en la carga (orientativo)
      hours = power > 0 ? kwh / power : 0;
    } else {
      hours = num("c-hours");
      kwh = root.dataset.perHour === "1" ? num("c-kwh") * hours : num("c-kwh");
    }
    if (!(kwh > 0) || !(hours > 0) || hours > 24) { out.textContent = "Revisa los datos: deben ser números mayores que cero (y como mucho 24 horas)."; return; }
    if (!days.length || days[0].date !== today) {
      out.innerHTML = "";
      const p = document.createElement("p");
      const avg = pvpc?.avg365 ? (pvpc.avg365.P1 + pvpc.avg365.P2 + pvpc.avg365.P3) / 3 : null;
      p.textContent = avg
        ? `Ahora mismo no tenemos los precios de hoy. Con el precio medio del último año (${avg.toFixed(3).replace(".", ",")} €/kWh sin impuestos) serían unos ${cents(withTaxes(kwh * avg))} por uso.`
        : "Ahora mismo no tenemos los precios de hoy. Vuelve a intentarlo en unos minutos.";
      out.append(p);
      return;
    }
    const nowIdx = madridHour();
    const opts = costByStart(days, kwh, hours, nowIdx);
    const s = summary(opts, nowIdx);
    if (!s) { out.textContent = "No quedan horas con precio publicado para ese tiempo de uso. Los precios de mañana salen hacia las 20:15."; return; }
    const tile = (label, value, sub, cls = "") => `<div class="kpi ${cls}"><span class="kpi-label">${label}</span><strong class="kpi-value">${value}</strong><span class="kpi-sub">${sub}</span></div>`;
    const perYear = Math.max(0, num("c-week")) * 52;
    out.innerHTML = `<div class="kpis">
      ${s.now ? tile(`Si empiezas ahora (${hh(s.now.hour)})`, cents(withTaxes(s.now.cost)), `${kwh.toLocaleString("es-ES", { maximumFractionDigits: 2 })} kWh`) : ""}
      ${tile("Mejor momento", `${dayName(s.best, today)} a las ${hh(s.best.hour)}`, cents(withTaxes(s.best.cost)), "kpi-good")}
      ${tile("Peor momento", `${dayName(s.worst, today)} a las ${hh(s.worst.hour)}`, cents(withTaxes(s.worst.cost)), "kpi-bad")}
      ${ev && num("c-km") > 0 ? tile("Coste cada 100 km", eur(withTaxes(s.best.cost) * 100 / num("c-km")), "cargando en la mejor hora") : ""}
      ${tile("Ahorras eligiendo la mejor hora", cents(withTaxes(s.saving)), perYear ? `≈ ${eur(withTaxes(s.saving) * perYear)} al año con ${num("c-week")} usos por semana` : "por uso")}
    </div>`;
    // Tabla con el coste de empezar a cada hora (barras proporcionales).
    const max = s.worst.cost || 1;
    const rows = opts.map((o) => `<tr${o === s.best ? ' class="is-best"' : ""}><td>${dayName(o, today)} ${hh(o.hour)}</td><td class="num">${cents(withTaxes(o.cost))}</td><td class="bar-cell" aria-hidden="true"><i style="width:${Math.max(3, (o.cost / max) * 100).toFixed(1)}%"></i></td></tr>`).join("");
    const det = document.createElement("details");
    det.className = "data-table";
    det.innerHTML = `<summary>Coste según la hora a la que empieces (${opts.length} opciones)</summary><table><thead><tr><th>Empiezas</th><th>Coste</th><th><span class="sr-only">Comparación</span></th></tr></thead><tbody>${rows}</tbody></table>`;
    out.append(det);
    const note = document.createElement("p");
    note.className = "muted small";
    note.textContent = `Tarifa regulada (PVPC), precios de Red Eléctrica con impuesto eléctrico e IVA. ${ev ? `Energía a cargar: ${kwh.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kWh (incluye ~10 % de pérdidas), unas ${hours.toLocaleString("es-ES", { maximumFractionDigits: 1 })} h de carga. ` : ""}Si tienes una tarifa de precio fijo, el coste es el mismo a cualquier hora.`;
    out.append(note);
  };
  root.addEventListener("input", calc);
  calc();
}

if (typeof document !== "undefined") init();
