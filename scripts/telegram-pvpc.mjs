// Publica en un canal de Telegram el precio de la luz (PVPC) de mañana: horas más baratas y más caras.
// Lo ejecuta .github/workflows/telegram.yml cada día a las 20:40 (hora de Madrid). Ver README → «Canal de Telegram».
//   TELEGRAM_BOT_TOKEN=… TELEGRAM_CHAT_ID=@micanal node scripts/telegram-pvpc.mjs
// Sin esos secretos no hace nada y termina bien (no rompe el workflow).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseREE, dayStats } from "../assets/js/luz/pvpc.js";
import { madridDate } from "../assets/js/luz/hoy.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Las URL se pueden cambiar solo para las pruebas (servidor local simulado).
const API = process.env.REE_API || "https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real";
const TG = process.env.TELEGRAM_API || "https://api.telegram.org";

const hh = (h) => `${String(h).padStart(2, "0")}:00`;
const span = (h, len = 1) => `${hh(h)}–${hh(h + len)}`;
const eur = (p) => p.toFixed(3).replace(".", ",");
const html = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Mensaje en HTML de Telegram a partir de dayStats(). url: página «precio de la luz hoy» (opcional).
export function buildMessage(st, url = "") {
  const date = new Date(st.date + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const byPrice = st.prices.map((p, h) => ({ h, p })).filter((x) => x.p != null).sort((a, b) => a.p - b.p);
  const cheap = byPrice.slice(0, 3).sort((a, b) => a.h - b.h);
  const dear = byPrice.slice(-3).sort((a, b) => a.h - b.h);
  const lines = [
    `⚡ <b>Precio de la luz mañana, ${html(date)}</b> (PVPC)`,
    "",
    `🟢 <b>Más baratas:</b> ${cheap.map((x) => `${span(x.h)} (${eur(x.p)})`).join(", ")}`,
    `🔴 <b>Más caras:</b> ${dear.map((x) => `${span(x.h)} (${eur(x.p)})`).join(", ")}`,
    st.best3 ? `🧺 <b>Mejor franja de 3 h:</b> ${span(st.best3.start, 3)} (media ${eur(st.best3.avg)})` : "",
    `📊 Media del día: ${eur(st.mean)} €/kWh`,
    "",
    "<i>€/kWh sin impuestos. Solo afecta a la tarifa regulada (PVPC) y a las indexadas. Datos de Red Eléctrica.</i>",
    url ? `👉 <a href="${html(url)}">Gráfico y todas las horas</a>` : "",
  ];
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n").trim();
}

async function fetchDay(date) {
  const url = `${API}?start_date=${date}T00:00&end_date=${date}T23:59&time_trunc=hour&geo_trunc=electric_system&geo_limit=peninsular&geo_ids=8741`;
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`REE respondió HTTP ${r.status}`);
  return dayStats({ days: parseREE(await r.json()) }, date);
}

function pageUrl() {
  const site = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
  const origin = (process.env.SITE_ORIGIN || site.siteOrigin).replace(/\/+$/, "");
  const base = ("/" + (process.env.BASE_PATH || site.basePath || "/") + "/").replace(/\/{2,}/g, "/");
  return `${origin}${base}luz/precio-luz-hoy.html`;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.log("::notice::Faltan los secretos TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID: no se publica nada (ver README).");
    return;
  }
  const date = madridDate(1);
  // REE publica los precios de mañana sobre las 20:15; si aún no están, se reintenta unas veces.
  let st = null;
  for (let i = 1; i <= 4 && !st; i++) {
    try { st = await fetchDay(date); } catch (e) { console.warn(`Intento ${i}: ${e.message}`); }
    if (!st && i < 4) await new Promise((r) => setTimeout(r, Number(process.env.RETRY_MS ?? 5 * 60000)));
  }
  if (!st || st.prices.filter((p) => p != null).length < 20) {
    console.log(`::warning::No hay precios del PVPC para ${date} todavía. No se publica nada hoy.`);
    return;
  }
  const text = buildMessage(st, pageUrl());
  const r = await fetch(`${TG}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(20000),
  });
  const res = await r.json().catch(() => ({}));
  if (!res.ok) {
    // No se imprime el token. Un fallo de Telegram (bot sin permiso en el canal…) se avisa sin romper el workflow.
    console.log(`::warning::Telegram no aceptó el mensaje: ${res.description || `HTTP ${r.status}`}`);
    return;
  }
  console.log(`Publicado el precio de ${date} en ${chat}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => console.log("::warning::Error publicando en Telegram: " + e.message));
}
