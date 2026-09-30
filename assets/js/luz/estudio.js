// «Estudio: las horas más baratas de la luz en <año>». Cálculos sobre data/pvpc.json (precios reales de REE).
// Se ejecuta en el build (build.mjs) y el resultado queda en el HTML: lo leen buscadores, periodistas y quien no
// tenga JavaScript. Sin DOM ni dependencias; se prueba en tests/unit-luz-contenido.mjs.
import { periodOf } from "./core.js";

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Solo días completos (24 horas con precio) del año pedido y hasta `until` (incluido; por defecto, todos).
export function studyDays(pvpc, year, until = "9999-12-31") {
  return Object.entries(pvpc?.days || {})
    .filter(([d, p]) => d.startsWith(`${year}-`) && d <= until && p.length === 24 && p.every((x) => x != null))
    .sort(([a], [b]) => a.localeCompare(b));
}

export function computeStudy(pvpc, year, until) {
  const days = studyDays(pvpc, year, until);
  if (days.length < 7) return null;
  const byHour = Array.from({ length: 24 }, (_, h) => avg(days.map(([, p]) => p[h])));
  const rank = byHour.map((p, h) => ({ h, p })).sort((a, b) => a.p - b.p);
  const mean = avg(days.flatMap(([, p]) => p));

  // Hora más barata de cada día: ¿cuántas veces cae de madrugada (0–8) y cuántas en horas de sol (10–17)?
  const cheapestHour = days.map(([, p]) => p.indexOf(Math.min(...p)));
  const share = (f) => cheapestHour.filter(f).length / days.length;
  const counts = Array.from({ length: 24 }, (_, h) => cheapestHour.filter((x) => x === h).length);

  // Por meses: media, hora media más barata y más cara.
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const md = days.filter(([d]) => Number(d.slice(5, 7)) === m);
    if (!md.length) continue;
    const hours = Array.from({ length: 24 }, (_, h) => avg(md.map(([, p]) => p[h])));
    const r = hours.map((p, h) => ({ h, p })).sort((a, b) => a.p - b.p);
    months.push({ month: m, name: MONTHS[m - 1], days: md.length, mean: avg(md.flatMap(([, p]) => p)), hours, cheapest: r[0], dearest: r.at(-1) });
  }

  // Laborables frente a fines de semana y festivos (todo el día en valle).
  const isValleDay = (d) => periodOf(d, 12) === "P3";
  const weekend = avg(days.filter(([d]) => isValleDay(d)).flatMap(([, p]) => p));
  const weekday = avg(days.filter(([d]) => !isValleDay(d)).flatMap(([, p]) => p));

  const dayMeans = days.map(([d, p]) => ({ date: d, mean: avg(p) })).sort((a, b) => a.mean - b.mean);
  return {
    year, from: days[0][0], to: days.at(-1)[0], nDays: days.length, mean, byHour,
    cheapest3: rank.slice(0, 3).map((x) => x.h).sort((a, b) => a - b), dearest3: rank.slice(-3).map((x) => x.h).sort((a, b) => a - b),
    cheapest: rank[0], dearest: rank.at(-1), spread: rank.at(-1).p - rank[0].p,
    shareNight: share((h) => h < 8), shareSolar: share((h) => h >= 10 && h < 18), counts,
    months, weekday, weekend, cheapestDay: dayMeans[0], dearestDay: dayMeans.at(-1),
  };
}

// CSV con todos los precios del año (fecha;hora;€/kWh) para quien quiera rehacer los cálculos.
export function studyCSV(pvpc, year, until) {
  const rows = studyDays(pvpc, year, until).flatMap(([d, p]) => p.map((x, h) => `${d};${String(h).padStart(2, "0")}:00;${x.toFixed(5)}`));
  return "fecha;hora;pvpc_eur_kwh_sin_impuestos\n" + rows.join("\n") + "\n";
}
