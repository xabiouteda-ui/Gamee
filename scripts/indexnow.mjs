// Avisa a los buscadores que usan IndexNow (Bing, Yandex, Seznam, Naver…) de las páginas nuevas o cambiadas.
// Lo ejecuta el workflow de publicación justo después de desplegar:
//   node scripts/indexnow.mjs all     → todas las URL del sitemap (tras un push a main)
//   node scripts/indexnow.mjs today   → solo las que tienen lastmod de hoy (despliegue diario de precios)
// Lee el sitemap y el archivo de clave ya publicados. Nunca rompe el workflow: si algo falla, deja un aviso.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";

export function siteUrl(env = process.env) {
  const site = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
  const origin = (env.SITE_ORIGIN || site.siteOrigin).replace(/\/+$/, "");
  const base = ("/" + (env.BASE_PATH || site.basePath || "/") + "/").replace(/\/{2,}/g, "/");
  return { url: origin + base, key: site.indexNowKey };
}

// [{ loc, lastmod }] a partir del XML del sitemap.
export function parseSitemap(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, u]) => ({
    loc: u.match(/<loc>([^<]+)<\/loc>/)?.[1],
    lastmod: u.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] || null,
  })).filter((u) => u.loc);
}

export function pickUrls(entries, mode, today) {
  return entries.filter((e) => mode === "all" || e.lastmod === today).map((e) => e.loc);
}

async function main() {
  const mode = process.argv[2] === "today" ? "today" : "all";
  const { url, key } = siteUrl();
  if (!/^[a-f0-9]{32}$/.test(key || "")) return console.log("::notice::Sin indexNowKey en site.config.json: no se avisa a IndexNow.");
  const get = async (u) => {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`${u} → HTTP ${r.status}`);
    return r.text();
  };
  // Comprobar que el archivo de clave ya está publicado (si no, IndexNow rechaza el aviso).
  const keyLocation = `${url}${key}.txt`;
  if ((await get(`${keyLocation}?t=${Date.now()}`)).trim() !== key) throw new Error("el archivo de clave publicado no coincide");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
  const urlList = pickUrls(parseSitemap(await get(`${url}sitemap.xml?t=${Date.now()}`)), mode, today);
  if (!urlList.length) return console.log("IndexNow: no hay URL que avisar hoy.");
  const host = new URL(url).host;
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key, keyLocation, urlList }),
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 200 || r.status === 202) console.log(`IndexNow: ${urlList.length} URL enviadas (HTTP ${r.status}).`);
  else console.log(`::warning::IndexNow respondió HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => console.log("::warning::IndexNow: " + e.message));
}
