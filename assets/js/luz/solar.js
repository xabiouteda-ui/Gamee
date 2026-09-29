// «¿Te salen a cuenta las placas solares?»: estimación orientativa con el consumo horario del CSV.
// Sin DOM: se prueba con Node. Los parámetros por defecto (producción, coste, precio de excedentes) están en
// data/ofertas.json → "solar", con sus fuentes; aquí solo hay valores de reserva por si falta ese bloque.
import { RULES } from "./core.js";

export const SOLAR_DEFAULTS = {
  yield: { norte: 1150, centro: 1350, sur: 1550 }, // kWh por kWp y año
  costPerKwp: 1300, // € por kWp instalado, IVA incluido, sin baterías
  surplusPrice: 0.06, // €/kWh compensados por la energía vertida (compensación simplificada)
  sizes: [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8],
};

// Reparto de la producción anual por meses (%), orientación sur en la península. Suma 100.
const MONTH_SHARE = [5.5, 6.6, 8.6, 9.2, 10.3, 10.6, 11.4, 10.7, 9.0, 7.4, 5.7, 5.0];
// Horas de sol por mes (latitud ≈ 40° N).
const DAYLEN = [9.6, 10.7, 12, 13.3, 14.4, 15, 14.7, 13.7, 12.4, 11.1, 9.9, 9.3];
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Fracción de la producción de un día que cae en la hora h (h..h+1, hora oficial) del mes m (0–11).
// Curva en seno centrada en el mediodía solar: ≈13:15 en invierno y ≈14:15 en verano (horario de verano).
const SHAPE = MONTH_SHARE.map((_, m) => {
  const noon = m >= 3 && m <= 9 ? 14.25 : 13.25;
  const rise = noon - DAYLEN[m] / 2;
  const raw = Array.from({ length: 24 }, (_, h) => {
    let s = 0;
    for (let k = 0; k < 4; k++) { // 4 muestras por hora
      const t = h + (k + 0.5) / 4;
      if (t > rise && t < rise + DAYLEN[m]) s += Math.sin((Math.PI * (t - rise)) / DAYLEN[m]);
    }
    return s;
  });
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((x) => x / total);
});

// Producción estimada (kWh) de 1 kWp en una hora concreta.
export function productionPerKwp(date, hour, yearlyYield) {
  const m = Number(date.slice(5, 7)) - 1;
  return (yearlyYield * MONTH_SHARE[m]) / 100 / DAYS_IN_MONTH[m] * SHAPE[m][hour];
}

// rows: [{date, hour, kwh}] ; priceAt(date, hour) → €/kWh de energía sin impuestos de la tarifa de referencia.
// Devuelve cifras anualizadas: producción, autoconsumo, excedentes, ahorro (con impuestos), coste y retorno.
export function solarEstimate(rows, { kwp, yearlyYield, costPerKwp, surplusPrice, priceAt }) {
  const days = new Set();
  let production = 0, selfUse = 0, surplus = 0, consumption = 0, saved = 0, sunKwh = 0;
  const month = new Map(); // compensación simplificada: el excedente solo descuenta hasta el coste de energía del mes
  for (const r of rows) {
    days.add(r.date);
    const prod = kwp * productionPerKwp(r.date, r.hour, yearlyYield);
    const used = Math.min(prod, r.kwh);
    const price = priceAt(r.date, r.hour);
    production += prod;
    selfUse += used;
    surplus += prod - used;
    consumption += r.kwh;
    if (prod > 0) sunKwh += r.kwh;
    saved += used * price;
    const key = r.date.slice(0, 7);
    const mm = month.get(key) || { month: key, grid: 0, surplus: 0, consumption: 0, production: 0, selfUse: 0, surplusKwh: 0 };
    mm.grid += (r.kwh - used) * price;
    mm.surplus += (prod - used) * surplusPrice;
    mm.consumption += r.kwh;
    mm.production += prod;
    mm.selfUse += used;
    mm.surplusKwh += prod - used;
    month.set(key, mm);
  }
  let compensated = 0, lost = 0;
  for (const mm of month.values()) {
    compensated += Math.min(mm.grid, mm.surplus);
    lost += Math.max(0, mm.surplus - mm.grid);
  }
  const k = days.size ? 365 / days.size : 0;
  const taxes = (1 + RULES.electricityTax) * (1 + RULES.vat);
  const savingYear = (saved + compensated) * taxes * k;
  const cost = kwp * costPerKwp;
  return {
    kwp,
    production: production * k,
    selfUse: selfUse * k,
    surplus: surplus * k,
    consumption: consumption * k,
    selfShare: production ? selfUse / production : 0, // parte de lo producido que usas en el momento
    coverage: consumption ? selfUse / consumption : 0, // parte de tu consumo que cubren las placas
    savingYear,
    // Excedentes que no se cobran: la compensación simplificada no baja de 0 la energía del mes (€ al año, con impuestos).
    lostYear: lost * taxes * k,
    sunShare: consumption ? sunKwh / consumption : 0, // parte de tu consumo que cae en horas de sol
    months: [...month.values()].sort((a, b) => a.month.localeCompare(b.month)),
    cost,
    payback: savingYear > 0 ? cost / savingYear : Infinity,
  };
}

// Tamaño recomendado: el mayor cuyo plazo de retorno no empeora más de un año respecto al mejor.
export function suggestSize(rows, opts, sizes = SOLAR_DEFAULTS.sizes) {
  const all = sizes.map((kwp) => solarEstimate(rows, { ...opts, kwp }));
  const best = Math.min(...all.map((x) => x.payback));
  if (!Number.isFinite(best)) return all[0];
  return all.filter((x) => x.payback <= best + 1).at(-1);
}
