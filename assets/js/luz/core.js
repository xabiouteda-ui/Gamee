// Lógica del analizador de consumo eléctrico (tarifa 2.0TD, España). Sin DOM: se prueba con Node.
//
// NORMATIVA (revisar cada año): periodos de la Circular 3/2020 de la CNMC y impuestos vigentes.
export const RULES = {
  reviewed: "2026-09",
  // Festivos nacionales de fecha fija (MM-DD): todo el día es valle (P3). Los festivos sin fecha fija
  // (Viernes Santo) y los autonómicos/locales no cuentan.
  holidays: ["01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25"],
  electricityTax: 0.0511269632, // impuesto especial sobre la electricidad
  meterPerDay: 0.02663,          // alquiler de contador monofásico típico (≈0,81 €/mes)
  vat: 0.21,
};

export const PERIODS = ["P1", "P2", "P3"];

// Periodo de energía de una hora que empieza a las `hour` (0–23) del día `date` (AAAA-MM-DD).
export function periodOf(date, hour) {
  const d = new Date(date + "T12:00:00Z");
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6 || RULES.holidays.includes(date.slice(5))) return "P3";
  if (hour < 8) return "P3";
  if ((hour >= 10 && hour < 14) || (hour >= 18 && hour < 22)) return "P1";
  return "P2";
}

// ---------- lectura del CSV ----------

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function toNumber(s) {
  s = String(s ?? "").trim().replace(/["\s]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return Number(s);
}

// Devuelve AAAA-MM-DD a partir de DD/MM/AAAA, AAAA/MM/DD o AAAA-MM-DD (con o sin hora pegada).
function toISODate(s) {
  s = String(s).trim().replace(/"/g, "");
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return null;
}

// Hora de inicio (0–23) a partir de "1".."25" (fin de intervalo) o "HH:MM" (fin de intervalo).
function startHour(s) {
  s = String(s ?? "").trim().replace(/"/g, "");
  let m = s.match(/(\d{1,2}):(\d{2})/);
  if (m) {
    const mins = Number(m[1]) * 60 + Number(m[2]);
    return Math.min(23, Math.max(0, Math.floor((mins - 1) / 60)));
  }
  m = s.match(/^\d{1,2}$/);
  if (m) return Math.min(23, Math.max(0, Number(s) - 1));
  return NaN;
}

function splitLine(line, sep) {
  const out = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === sep && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export class CsvError extends Error {}

// Lee un CSV de consumo horario (formato CNMC/Datadis y variantes de las distribuidoras).
export function parseConsumptionCSV(text) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const hi = lines.findIndex((l) => /fecha|date/i.test(l));
  if (hi < 0) throw new CsvError("header");
  const header = lines[hi];
  const sep = [";", ",", "\t"].sort((a, b) => header.split(b).length - header.split(a).length)[0];
  const cols = splitLine(header, sep).map(norm);
  const find = (re, not) => cols.findIndex((c) => re.test(c) && !(not && not.test(c)));
  const iDate = find(/fecha|date/);
  let iHour = find(/^hora|hour/);
  const iKwh = find(/consumo|^ae|kwh|energia|activa/, /metodo|obtencion|real|estimad|vertid|exced|^as/);
  const iCups = find(/cups/);
  if (iDate < 0 || iKwh < 0) throw new CsvError("columns");
  if (iHour === iDate) iHour = -1;

  const byKey = new Map(); // suma cuartohoraria → horaria
  let cups = "";
  let bad = 0;
  for (const line of lines.slice(hi + 1)) {
    const c = splitLine(line, sep);
    const date = toISODate(c[iDate]);
    const hour = iHour >= 0 ? startHour(c[iHour]) : startHour((String(c[iDate]).match(/\d{1,2}:\d{2}/) || [""])[0]);
    const kwh = toNumber(c[iKwh]);
    if (!date || !Number.isFinite(hour) || !Number.isFinite(kwh) || kwh < 0) { bad++; continue; }
    if (!cups && iCups >= 0) cups = String(c[iCups]).trim().replace(/"/g, "");
    const key = date + "|" + hour;
    byKey.set(key, (byKey.get(key) || 0) + kwh);
  }
  if (!byKey.size) throw new CsvError("empty");
  const rows = [...byKey].map(([k, kwh]) => {
    const [date, h] = k.split("|");
    return { date, hour: Number(h), kwh };
  }).sort((a, b) => (a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1));
  // Si parece que los valores vienen en Wh (horas de miles), se pasan a kWh.
  const max = Math.max(...rows.map((r) => r.kwh));
  const wh = max > 60;
  if (wh) for (const r of rows) r.kwh /= 1000;
  return { rows, cups: maskCups(cups), bad, unitWh: wh };
}

export function maskCups(c) {
  return c && c.length > 8 ? c.slice(0, 4) + "…" + c.slice(-4) : c;
}

// ---------- resumen ----------

export function summarize(rows) {
  const s = {
    kwh: 0, byPeriod: { P1: 0, P2: 0, P3: 0 }, months: new Map(),
    heat: Array.from({ length: 7 }, () => new Array(24).fill(0)), heatN: Array.from({ length: 7 }, () => new Array(24).fill(0)),
    days: new Set(), maxHour: { kwh: 0, date: "", hour: 0 }, first: rows[0]?.date, last: rows.at(-1)?.date,
  };
  const dayMin = new Map();
  for (const r of rows) {
    const p = periodOf(r.date, r.hour);
    s.kwh += r.kwh;
    s.byPeriod[p] += r.kwh;
    const m = r.date.slice(0, 7);
    if (!s.months.has(m)) s.months.set(m, { P1: 0, P2: 0, P3: 0, days: new Set() });
    const mm = s.months.get(m);
    mm[p] += r.kwh;
    mm.days.add(r.date);
    // Lunes = 0 … domingo = 6
    const dow = (new Date(r.date + "T12:00:00Z").getUTCDay() + 6) % 7;
    s.heat[dow][r.hour] += r.kwh;
    s.heatN[dow][r.hour] += 1;
    s.days.add(r.date);
    if (r.kwh > s.maxHour.kwh) s.maxHour = { kwh: r.kwh, date: r.date, hour: r.hour };
    dayMin.set(r.date, Math.min(dayMin.get(r.date) ?? Infinity, r.kwh));
  }
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) s.heat[d][h] = s.heatN[d][h] ? s.heat[d][h] / s.heatN[d][h] : 0;
  s.nDays = s.days.size;
  s.hours = rows.length;
  // Consumo base («fantasma»): mediana del mínimo horario de cada día, en vatios.
  const mins = [...dayMin.values()].sort((a, b) => a - b);
  s.baseW = mins.length ? mins[Math.floor(mins.length / 2)] * 1000 : 0;
  s.monthList = [...s.months].map(([month, v]) => ({ month, P1: v.P1, P2: v.P2, P3: v.P3, days: v.days.size }));
  return s;
}

// ---------- coste de una oferta ----------
// offer: { name, type: "fixed"|"periods", energy: [p1,p2,p3] €/kWh (fixed usa energy[0]), power: [p1,p2] €/kW·día, fee: €/mes }
// contract: { p1: kW, p2: kW }
export function billFor(byPeriod, days, offer, contract) {
  const e = offer.type === "fixed" ? [offer.energy[0], offer.energy[0], offer.energy[0]] : offer.energy;
  const energy = byPeriod.P1 * e[0] + byPeriod.P2 * e[1] + byPeriod.P3 * e[2];
  const power = (contract.p1 * offer.power[0] + contract.p2 * offer.power[1]) * days;
  const fee = (offer.fee || 0) * (days * 12 / 365);
  const tax = (energy + power) * RULES.electricityTax;
  const meter = RULES.meterPerDay * days;
  const vat = (energy + power + fee + tax + meter) * RULES.vat;
  const total = energy + power + fee + tax + meter + vat;
  return { energy, power, fee, tax, meter, vat, total, perYear: (total * 365) / days, perMonth: (total * 365) / days / 12 };
}

export function rankOffers(summary, offers, contract) {
  return offers
    .map((o, i) => ({ index: i, offer: o, ...billFor(summary.byPeriod, summary.nDays, o, contract) }))
    .sort((a, b) => a.total - b.total);
}

// Mueve un porcentaje del consumo de punta (P1) a valle (P3).
export function shift(byPeriod, pct) {
  const moved = byPeriod.P1 * pct;
  return { P1: byPeriod.P1 - moved, P2: byPeriod.P2, P3: byPeriod.P3 + moved };
}

// Ahorro anual (con impuestos) por bajar `kw` kilovatios de potencia en ambos periodos.
export function powerSavingPerYear(offer, kw) {
  return kw * (offer.power[0] + offer.power[1]) * 365 * (1 + RULES.electricityTax) * (1 + RULES.vat);
}

// Coste anual (con impuestos, precio medio de la oferta) del consumo base continuo.
export function baseLoadCostPerYear(baseW, offer) {
  const avg = offer.type === "fixed" ? offer.energy[0] : (offer.energy[0] * 8 + offer.energy[1] * 8 + offer.energy[2] * 8) / 24 * (5 / 7) + offer.energy[2] * (2 / 7);
  return (baseW / 1000) * 24 * 365 * avg * (1 + RULES.electricityTax) * (1 + RULES.vat);
}

// Perfil de ejemplo (para probar la herramienta sin CSV): un hogar tipo de ~2.800 kWh/año.
export function sampleRows(days = 365, startISO = "2025-01-01") {
  const rows = [];
  const start = new Date(startISO + "T12:00:00Z");
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let d = 0; d < days; d++) {
    const date = new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
    const month = Number(date.slice(5, 7));
    const winter = [12, 1, 2].includes(month) ? 1.35 : [7, 8].includes(month) ? 1.2 : 1;
    const dow = new Date(date + "T12:00:00Z").getUTCDay();
    const weekend = dow === 0 || dow === 6;
    for (let h = 0; h < 24; h++) {
      let k = 0.12; // consumo base
      if (h >= 7 && h < 9) k += weekend ? 0.15 : 0.35;
      if (h >= 13 && h < 16) k += weekend ? 0.55 : 0.3;
      if (h >= 19 && h < 23) k += 0.55;
      if (weekend && h >= 10 && h < 13) k += 0.3;
      rows.push({ date, hour: h, kwh: Math.round(k * winter * (0.75 + rnd() * 0.5) * 1000) / 1000 });
    }
  }
  return rows;
}

export const DEFAULT_OFFERS = [
  { name: "Precio fijo (ejemplo)", type: "fixed", energy: [0.13, 0.13, 0.13], power: [0.0877, 0.0877], fee: 0 },
  { name: "3 periodos (ejemplo)", type: "periods", energy: [0.19, 0.125, 0.085], power: [0.0877, 0.0877], fee: 0 },
];
