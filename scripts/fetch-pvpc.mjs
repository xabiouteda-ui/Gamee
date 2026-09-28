// Descarga los precios horarios del PVPC (tarifa regulada 2.0TD, península) de la API pública de Red Eléctrica
// y los guarda en data/pvpc.json para la herramienta de luz. Se ejecuta en GitHub Actions antes de cada build
// (y a diario con el cron del workflow). Si REE falla, reutiliza el JSON ya publicado; si tampoco, no rompe el build.
//   node scripts/fetch-pvpc.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizePvpc, parseREE } from "../assets/js/luz/pvpc.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "pvpc.json");
const DAYS_BACK = 400; // un año completo + margen para CSV de Datadis de los últimos 13 meses
const API = "https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real";

const iso = (d) => d.toISOString().slice(0, 10);

async function fetchMonth(from, to) {
  const url = `${API}?start_date=${from}T00:00&end_date=${to}T23:59&time_trunc=hour&geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return parseREE(await r.json());
    } catch (e) {
      console.warn(`  ${from}…${to}: intento ${attempt} fallido (${e.message})`);
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
  return null;
}

async function main() {
  const today = new Date();
  const end = new Date(today.getTime() + 86400000); // mañana (se publica sobre las 20:15)
  let start = new Date(today.getTime() - DAYS_BACK * 86400000);
  const days = {};
  let ok = 0, failed = 0;
  while (start <= end) {
    const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const to = monthEnd < end ? monthEnd : end;
    const res = await fetchMonth(iso(start), iso(to));
    if (res) { Object.assign(days, res); ok++; } else failed++;
    start = new Date(to.getTime() + 86400000);
  }
  if (!Object.keys(days).length) {
    const fallback = process.env.PVPC_FALLBACK_URL;
    if (fallback) {
      try {
        const r = await fetch(fallback, { signal: AbortSignal.timeout(20000) });
        if (r.ok) {
          mkdirSync(dirname(OUT), { recursive: true });
          writeFileSync(OUT, await r.text());
          console.log(`::warning::REE no respondió; se reutiliza el PVPC publicado (${fallback}).`);
          return;
        }
      } catch {}
    }
    console.log("::warning::No se han podido obtener precios del PVPC. La web funcionará sin la comparación con la tarifa regulada.");
    return;
  }
  const data = summarizePvpc(days, new Date().toISOString());
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data));
  console.log(`PVPC: ${Object.keys(days).length} días (${data.from} → ${data.to}), ${ok} peticiones correctas, ${failed} fallidas.`);
}

main().catch((e) => { console.log("::warning::Error descargando el PVPC: " + e.message); });
