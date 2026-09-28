// PVPC (tarifa regulada 2.0TD): lectura de la API de Red Eléctrica y cálculo del coste de la energía.
// Se usa en el navegador y en Node (scripts/fetch-pvpc.mjs). Sin dependencias del DOM.
import { periodOf, PERIODS } from "./core.js";

// Convierte la respuesta JSON de apidatos.ree.es en { "AAAA-MM-DD": [24 precios €/kWh | null] }.
// Las fechas llegan en hora española ("2026-09-28T13:00:00.000+02:00"): se usa la fecha y la hora locales.
// Si hay varios valores por hora (cuartohorarios o el día de 25 h), se promedian.
export function parseREE(json) {
  const series = (json?.included || []).find((s) => /pvpc/i.test(s.type || "") || /pvpc/i.test(s.attributes?.title || ""));
  if (!series) throw new Error("La respuesta no contiene la serie PVPC");
  const acc = {};
  for (const v of series.attributes?.values || []) {
    const m = String(v.datetime || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2})/);
    if (!m || !Number.isFinite(v.value)) continue;
    const [, date, hh] = m;
    const h = Number(hh);
    acc[date] ||= Array.from({ length: 24 }, () => []);
    acc[date][h].push(v.value / 1000);
  }
  const out = {};
  for (const [date, hours] of Object.entries(acc)) {
    out[date] = hours.map((xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1e5) / 1e5 : null));
  }
  return out;
}

// Estructura que se publica en data/pvpc.json.
export function summarizePvpc(days, updated) {
  const dates = Object.keys(days).sort();
  const last = dates.at(-1);
  // Media por periodo de los últimos 365 días (para el cálculo rápido sin CSV).
  const cutoff = new Date(new Date(last + "T12:00:00Z").getTime() - 365 * 86400000).toISOString().slice(0, 10);
  const sum = { P1: 0, P2: 0, P3: 0 }, n = { P1: 0, P2: 0, P3: 0 };
  for (const d of dates) {
    if (d <= cutoff) continue;
    days[d].forEach((p, h) => { if (p != null) { const k = periodOf(d, h); sum[k] += p; n[k]++; } });
  }
  const avg = Object.fromEntries(PERIODS.map((k) => [k, n[k] ? Math.round((sum[k] / n[k]) * 1e5) / 1e5 : null]));
  return { updated, source: "Red Eléctrica (apidatos.ree.es), PVPC 2.0TD península, €/kWh sin impuestos", from: dates[0], to: last, avg365: avg, days };
}

// Coste de la energía con PVPC para unas filas horarias {date, hour, kwh}.
// Las horas sin precio (fuera del rango descargado) se valoran con la media de su periodo.
export function pvpcEnergy(rows, pvpc) {
  let energy = 0, covered = 0;
  for (const r of rows) {
    const p = pvpc.days[r.date]?.[r.hour];
    if (p != null) { energy += r.kwh * p; covered++; }
    else energy += r.kwh * (pvpc.avg365[periodOf(r.date, r.hour)] ?? 0);
  }
  return { energy, coverage: rows.length ? covered / rows.length : 0 };
}

// Precios de un día concreto con estadísticas para «¿a qué hora es más barata la luz?».
export function dayStats(pvpc, date) {
  const prices = pvpc?.days?.[date];
  if (!prices || prices.every((p) => p == null)) return null;
  const hours = prices.map((p, h) => ({ h, p })).filter((x) => x.p != null);
  const sorted = [...hours].sort((a, b) => a.p - b.p);
  const mean = hours.reduce((a, x) => a + x.p, 0) / hours.length;
  // Mejor bloque de 2 y 3 horas seguidas (para poner lavadora, lavavajillas, cargar el coche…).
  const block = (len) => {
    let best = null;
    for (let h = 0; h + len <= 24; h++) {
      const slice = prices.slice(h, h + len);
      if (slice.some((p) => p == null)) continue;
      const avg = slice.reduce((a, b) => a + b, 0) / len;
      if (!best || avg < best.avg) best = { start: h, avg };
    }
    return best;
  };
  return { date, prices, min: sorted[0], max: sorted.at(-1), mean, cheapest: sorted.slice(0, 3).map((x) => x.h).sort((a, b) => a - b), best2: block(2), best3: block(3) };
}
