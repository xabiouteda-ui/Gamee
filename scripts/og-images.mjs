// Genera una imagen para redes sociales (1200×630, JPG) por cada página indexable: assets/img/og/<nombre>.jpg.
// No se ejecuta en el build (necesita un navegador): se lanza a mano al crear o renombrar páginas y se hace commit
// de las imágenes. `tests/check-site.mjs` avisa si a alguna página le falta la suya.
//   npm i --no-save playwright && node scripts/og-images.mjs
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets/img/og");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const site = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
const host = new URL(site.siteOrigin).host;

// Mismo nombre de archivo que usa build.mjs.
export const ogName = (slug) => slug.replace(/\.html$/, "").replace(/(^|\/)index$/, "$1").replace(/\/$/, "").replace(/\//g, "--") || "index";

const TAGS = {
  luz: { es: "Luz", color: "#f59e0b" },
  captions: { es: "Subtítulos", en: "Captions", color: "#ec4899" },
  transcribe: { es: "Audio a texto", en: "Audio to text", color: "#10b981" },
};
function sectionOf(meta, slug) {
  const dir = slug.includes("/") ? slug.replace(/^en\//, "").split("/")[0] : "";
  if (dir === "luz") return "luz";
  if (dir === "subtitulos-animados" || dir === "animated-captions") return "captions";
  if (dir === "pasar-audio-a-texto" || dir === "audio-to-text" || meta.tool === true) return "transcribe";
  return null;
}

const pages = [];
for (const lang of ["es", "en"]) {
  const dir = join(ROOT, "src/pages", lang);
  for (const f of readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".html"))) {
    const raw = readFileSync(join(dir, f), "utf8");
    const meta = JSON.parse(raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/)[1]);
    if (meta.noindex || meta.bare) continue;
    const h1 = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, "").trim();
    pages.push({ lang, slug: meta.slug, title: h1 || meta.title, lead: meta.description, section: sectionOf(meta, meta.slug) });
  }
}

const font = readFileSync(join(ROOT, "assets/fonts/montserrat-latin-900-normal.woff2")).toString("base64");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = (p) => {
  const tag = p.section && TAGS[p.section][p.lang] ? TAGS[p.section] : null;
  const size = p.title.length > 60 ? 64 : p.title.length > 40 ? 76 : 90;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: M; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 900; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; font-family: system-ui, "DejaVu Sans", sans-serif; color: #fff;
  background: radial-gradient(circle at 85% 15%, #7c74ff 0, transparent 45%), linear-gradient(135deg, #312e81, #4f46e5 60%, #6d28d9);
  padding: 64px 72px; display: flex; flex-direction: column; }
.top { display: flex; align-items: center; gap: 18px; font-size: 34px; font-weight: 700; }
.logo { width: 64px; height: 64px; }
.tag { margin-left: auto; font-size: 26px; font-weight: 700; padding: 8px 20px; border-radius: 999px; background: ${tag ? tag.color : "transparent"}; color: #111; }
h1 { font-family: M; font-weight: 900; font-size: ${size}px; line-height: 1.08; margin-top: auto; letter-spacing: -0.5px; }
p { font-size: 28px; line-height: 1.35; opacity: .88; margin-top: 22px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.foot { margin-top: 34px; font-size: 28px; font-weight: 700; display: flex; justify-content: space-between; opacity: .95; }
</style></head><body>
<div class="top"><svg class="logo" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#fff"/><path d="M8 13v6M12 10v12M16 7v18M20 11v10M24 14v4" stroke="#4f46e5" stroke-width="2.4" stroke-linecap="round"/></svg>${esc(site.siteName)}
${tag ? `<span class="tag">${esc(tag[p.lang])}</span>` : ""}</div>
<h1>${esc(p.title)}</h1>
<p>${esc(p.lead.split(/(?<=\.)\s/)[0])}</p>
<div class="foot"><span>${p.lang === "es" ? "Gratis · Sin registro · En tu navegador" : "Free · No sign-up · In your browser"}</span><span>${esc(host)}</span></div>
</body></html>`;
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const p of pages) {
  await page.setContent(html(p));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, ogName(p.slug) + ".jpg"), type: "jpeg", quality: 82 });
}
await browser.close();
console.log(`${pages.length} imágenes en assets/img/og/`);
