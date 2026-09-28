// Genera la web estática en _site/ a partir de src/ y assets/.
// Sin dependencias: `node build.mjs`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { STRINGS, AUDIO_LANGUAGES } from "./assets/js/i18n.js";
import { STRINGS as CAPTIONS_STRINGS } from "./assets/js/captions/i18n.js";
import { STRINGS as LUZ_STRINGS } from "./assets/js/luz/i18n.js";
import { dayStats } from "./assets/js/luz/pvpc.js";
import { madridDate } from "./assets/js/luz/hoy.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "_site");
const site = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
// URL pública = origen + ruta base. La ruta base permite publicar en una subcarpeta
// (p. ej. usuario.github.io/game/) o en la raíz de un dominio propio ("/").
// Solo se usa para URLs absolutas (canonical, hreflang, sitemap, Open Graph, 404);
// los enlaces internos, CSS, JS y el worker usan siempre rutas relativas.
const siteOrigin = (process.env.SITE_ORIGIN || site.siteOrigin).replace(/\/+$/, "");
const basePath = ("/" + (process.env.BASE_PATH || site.basePath || "/") + "/").replace(/\/{2,}/g, "/");
if (!/^https?:\/\/[^/]+$/.test(siteOrigin)) throw new Error(`siteOrigin no válido: "${siteOrigin}" (ej.: https://usuario.github.io)`);
const siteUrl = siteOrigin + basePath.replace(/\/$/, "");

// Lee config.js (el mismo archivo que usa el navegador) para generar ads.txt.
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, "assets/js/config.js"), "utf8"), sandbox);
const adsCfg = sandbox.window.SITE_CONFIG || {};

// Versión Pro (data/pro.json): desactivada por defecto. Con ella desactivada, /pro.html no se indexa.
const proCfg = existsSync(join(ROOT, "data/pro.json")) ? JSON.parse(readFileSync(join(ROOT, "data/pro.json"), "utf8")) : {};
const proOn = proCfg.enabled === true && /^https:\/\//.test(proCfg.checkoutUrl || "");

function proBuy() {
  if (!proOn) return `<p class="muted">Todavía no está a la venta. Las herramientas siguen siendo gratis y sin marca de agua.</p>`;
  return `<a class="btn btn-primary" href="${esc(proCfg.checkoutUrl)}" rel="noopener">Comprar Pro</a>
<p class="muted small">El pago lo gestiona ${esc(proCfg.provider === "stripe" ? "Stripe" : proCfg.provider === "paddle" ? "Paddle" : "la pasarela de pago")}, que emite la factura con el IVA de tu país. Recibirás tu clave de licencia por correo.</p>`;
}

const UI = {
  es: {
    home: "Inicio", transcribe: "Audio a texto", captions: "Subtítulos", luz: "Tarifa de luz", faq: "Preguntas frecuentes", privacy: "Privacidad", legal: "Aviso legal",
    contact: "Contacto", money: "Cómo ganamos dinero", skip: "Saltar al contenido", tagline: "Transcripción de audio y vídeo gratis y privada",
    footerNote: "Herramientas gratuitas financiadas con publicidad. Tus archivos se procesan en tu dispositivo.",
    related: "Más herramientas gratis",
    otherLang: "English", otherLangLabel: "Read in English",
  },
  en: {
    home: "Home", transcribe: "Audio to text", captions: "Captions", faq: "FAQ", privacy: "Privacy", legal: "Legal notice",
    contact: "Contact", money: "How we make money", skip: "Skip to content", tagline: "Free and private audio and video transcription",
    footerNote: "Free tools supported by ads. Your files are processed on your device.",
    related: "More free tools",
    otherLang: "Español", otherLangLabel: "Leer en español",
  },
};

const LINKS = {
  es: { home: "", transcribe: "pasar-audio-a-texto/", captions: "subtitulos-animados/", luz: "luz/", luzhoy: "luz/precio-luz-hoy.html", faq: "preguntas-frecuentes.html", privacy: "privacidad.html", legal: "aviso-legal.html", contact: "contacto.html", money: "como-ganamos-dinero.html" },
  en: { home: "en/", transcribe: "en/audio-to-text/", captions: "en/animated-captions/", faq: "en/faq.html", privacy: "en/privacy.html", legal: "en/legal.html", contact: "en/contact.html", money: "en/how-we-make-money.html" },
};

// Tarjetas de herramientas (portada y enlaces cruzados al final de cada herramienta).
const CARDS = [
  {
    tool: "transcribe", icon: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-2.07A7 7 0 0 1 5 12Z",
    es: { title: "Pasar audio a texto", text: "Transcribe notas de voz, clases, entrevistas y vídeos. Descarga TXT, SRT o VTT." },
    en: { title: "Audio to text", text: "Transcribe voice notes, lectures, interviews and videos. Download TXT, SRT or VTT." },
  },
  {
    tool: "captions", icon: "M4 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H4Zm2 9h5v2H6v-2Zm7 0h5v2h-5v-2ZM6 10h9v2H6v-2Z",
    es: { title: "Subtítulos animados", text: "Subtítulos tipo karaoke grabados en tu vídeo para Reels, TikTok y Shorts. Sin marca de agua." },
    en: { title: "Animated captions", text: "Karaoke-style captions burned into your video for short-form platforms. No watermark." },
  },
  {
    tool: "luz", icon: "M13 2 4 14h6l-1 8 9-12h-6l1-8Z",
    es: { title: "¿Qué tarifa de luz me conviene?", text: "Compara la tarifa regulada y las más contratadas con tu consumo real, en un clic." },
  },
  {
    tool: "luzhoy", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v4.6l3.2 3.2-1.4 1.4L11 12.4V7h2Z",
    es: { title: "Precio de la luz hoy", text: "La hora más barata de hoy y de mañana, con los datos oficiales de cada hora." },
  },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function readPages() {
  const pages = [];
  for (const lang of ["es", "en"]) {
    const dir = join(ROOT, "src/pages", lang);
    for (const f of readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".html")).sort()) {
      const raw = readFileSync(join(dir, f), "utf8");
      const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
      if (!m) throw new Error(`Falta la cabecera JSON en ${lang}/${f}`);
      const meta = JSON.parse(m[1]);
      pages.push({ lang, file: f, ...meta, body: raw.slice(m[0].length) });
    }
  }
  return pages;
}

// Herramientas del sitio: plantilla HTML, textos y script de cada una.
// En la cabecera JSON de una página, "tool": true equivale a "transcribe".
const TOOLS = {
  transcribe: { partial: "tool.html", strings: STRINGS, script: "assets/js/app.js", category: "MultimediaApplication" },
  captions: { partial: "captions.html", strings: CAPTIONS_STRINGS, script: "assets/js/captions/app.js", category: "MultimediaApplication" },
  gasto: { partial: "gasto.html", strings: LUZ_STRINGS, script: "assets/js/luz/gasto.js", category: "UtilitiesApplication" },
  luzhoy: { partial: "luz-hoy.html", strings: LUZ_STRINGS, script: "assets/js/luz/hoy.js", category: "UtilitiesApplication" },
  luz: { partial: "luz.html", strings: LUZ_STRINGS, script: "assets/js/luz/app.js", category: "FinanceApplication" },
};
const toolOf = (page) => (page.tool === true ? "transcribe" : page.tool || null);

function languageOptions(lang, autoLabel) {
  const langIdx = lang === "es" ? 1 : 2;
  const langs = [...AUDIO_LANGUAGES].sort((a, b) => (a[0] === lang ? -1 : b[0] === lang ? 1 : 0));
  return [`<option value="auto">${esc(autoLabel)}</option>`]
    .concat(langs.map(([code, ...names]) => `<option value="${code}"${code === lang ? " selected" : ""}>${esc(names[langIdx - 1])}</option>`))
    .join("\n        ");
}

// Resumen estático de los precios del PVPC de hoy (el día en que se genera la web), para buscadores y para
// quien no tenga JavaScript. En el navegador se sustituye por los datos más recientes y los gráficos.
function pvpcSnapshot() {
  const f = join(ROOT, "data", "pvpc.json");
  if (!existsSync(f)) return "";
  const pvpc = JSON.parse(readFileSync(f, "utf8"));
  const hh = (h) => `${String(h).padStart(2, "0")}:00`;
  const eur = (p) => p.toFixed(3).replace(".", ",") + " €/kWh";
  return [["Hoy", 0], ["Mañana", 1]].map(([label, off]) => {
    const st = dayStats(pvpc, madridDate(off));
    if (!st) return "";
    const date = new Date(st.date + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    return `<section class="day card"><h2>${label}: ${date}</h2><p>La hora más barata es de ${hh(st.min.h)} a ${hh(st.min.h + 1)} (${eur(st.min.p)}) y la más cara de ${hh(st.max.h)} a ${hh(st.max.h + 1)} (${eur(st.max.p)}). Precio medio: ${eur(st.mean)}.${st.best3 ? ` La mejor franja de 3 horas seguidas empieza a las ${hh(st.best3.start)}.` : ""}</p></section>`;
  }).join("\n");
}

// Frase con las medias del PVPC del último año (se genera en el build con data/pvpc.json).
function pvpcAverages() {
  const f = join(ROOT, "data", "pvpc.json");
  if (!existsSync(f)) return "Los precios medios del último año aparecerán aquí en cuanto se publiquen los datos de Red Eléctrica.";
  const { avg365: a, from, to } = JSON.parse(readFileSync(f, "utf8"));
  const e = (p) => p.toFixed(3).replace(".", ",");
  const d = (iso) => iso.split("-").reverse().join("/");
  return `Según los datos de Red Eléctrica (del ${d(from)} al ${d(to)}), el precio medio de la energía del PVPC en los últimos 12 meses fue de ${e(a.P1)} €/kWh en punta, ${e(a.P2)} €/kWh en llano y ${e(a.P3)} €/kWh en valle, sin impuestos. La diferencia entre punta y valle es lo que hace que convenga mover consumo a las horas baratas.`;
}

// Texto del crédito «Hecho con …» de los vídeos. Con dominio propio se añade (se lee bien en un vídeo);
// una dirección larga de github.io, no.
function creditText(lang) {
  const host = new URL(siteUrl).host.replace(/^www\./, "");
  return `${lang === "es" ? "Hecho con" : "Made with"} ${site.siteName}${/github\.io$/.test(host) ? "" : ` · ${host}`}`;
}

function toolHtml(tool, lang, page) {
  const t = TOOLS[tool].strings[lang];
  return readFileSync(join(ROOT, "src/partials", TOOLS[tool].partial), "utf8")
    .replace("{{languageOptions}}", () => languageOptions(lang, t.autoDetect))
    .replace("{{pvpcSnapshot}}", () => pvpcSnapshot())
    .replace(/\{\{credit\}\}/g, () => esc(creditText(lang)))
    .replace(/\{\{mode\}\}/g, esc(page.mode || ""))
    .replace(/\{\{platform\}\}/g, esc(page.platform || ""))
    .replace(/\{\{preset\}\}/g, esc(page.preset || ""))
    .replace(/\{\{t\.(\w+)\}\}/g, (_, k) => {
      if (!(k in t)) throw new Error(`Texto sin traducir (${tool}/${lang}): ${k}`);
      return esc(t[k]);
    });
}

function faqSchema(body) {
  const items = [...body.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (!items.length) return null;
  const strip = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([, q, a]) => ({
      "@type": "Question",
      name: strip(q),
      acceptedAnswer: { "@type": "Answer", text: strip(a) },
    })),
  };
}

function appSchema(page, url) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: page.appName || site.siteName,
    url,
    description: page.description,
    applicationCategory: TOOLS[toolOf(page)].category,
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and WebAssembly",
    inLanguage: page.lang,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };
}

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true" class="logo"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M8 13v6M12 10v12M16 7v18M20 11v10M24 14v4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;

// Página «desnuda» para insertar en otras webs con un iframe (widget): sin cabecera, menú, pie ni anuncios.
function bareLayout(page, url, root) {
  const body = page.body.replace(/\{\{root\}\}/g, root).replace(/\{\{siteUrl\}\}/g, siteUrl);
  return `<!doctype html>
<html lang="${page.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="noindex">
${page.style ? `<link rel="stylesheet" href="${root}${page.style}">` : ""}
</head>
<body>
${body.trim()}
${page.script ? `<script type="module" src="${root}${page.script}"></script>` : ""}
</body>
</html>
`;
}

function layout(page, pagesBySlug) {
  const lang = page.lang;
  const ui = UI[lang];
  const depth = page.slug.split("/").length - 1;
  // La página 404 se sirve desde cualquier ruta, así que usa enlaces absolutos.
  const root = page.absolute ? `${siteUrl}/` : depth ? "../".repeat(depth) : "./";
  const href = (slug) => (slug === "" ? root : root + slug);
  const url = `${siteUrl}/${page.slug.replace(/index\.html$/, "")}`;
  const alt = page.alt != null ? pagesBySlug.get(page.alt) : null;
  const altUrl = alt ? `${siteUrl}/${alt.slug.replace(/index\.html$/, "")}` : null;
  const L = LINKS[lang];
  if (page.bare) return bareLayout(page, url, root);

  const schemas = [];
  const tool = toolOf(page);
  if (tool) schemas.push(appSchema(page, url));
  if (page.faqSchema) { const s = faqSchema(page.body); if (s) schemas.push(s); }
  if (page.slug.endsWith("index.html") || page.slug === "index.html") {
    schemas.push({ "@context": "https://schema.org", "@type": "WebSite", name: site.siteName, url: `${siteUrl}/`, inLanguage: lang });
  }

  const here = page.slug.replace(/index\.html$/, "");
  const nav = (key, label, section = false) => {
    const current = L[key] === here || L[key] === page.slug;
    return `<a href="${href(L[key])}"${current ? ' aria-current="page"' : section ? ' aria-current="true"' : ""}>${label}</a>`;
  };
  const exists = (k) => L[k] && (pagesBySlug.has(L[k]) || pagesBySlug.has(L[k] + "index.html"));
  const cards = (except) => CARDS.filter((c) => c[lang] && c.tool !== except && exists(c.tool))
    .map((c) => `<a class="tool-card" href="${href(L[c.tool])}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${c.icon}"/></svg><strong>${esc(c[lang].title)}</strong><span>${esc(c[lang].text)}</span></a>`).join("\n");

  let body = page.body
    .replace("{{tool}}", () => (tool ? toolHtml(tool, lang, page) : ""))
    .replace(/\{\{ad:(\w+)\}\}/g, (_, s) => `<div class="ad-slot" data-slot="${s}"></div>`)
    .replace(/\{\{cfg\.(\w+)\}\}/g, (_, k) => esc(site[k] ?? ""))
    .replace("{{toolCards}}", () => `<div class="tool-cards">${cards(null)}</div>`)
    .replace("{{pvpcAverages}}", () => pvpcAverages())
    .replace("{{proPrice}}", () => esc(proOn && proCfg.price ? proCfg.price : "Pago único"))
    .replace("{{proBuy}}", () => proBuy())
    .replace(/\{\{siteUrl\}\}/g, siteUrl)
    .replace(/\{\{moneyHref\}\}/g, () => href(L.money))
    .replace(/\{\{proHref\}\}/g, () => href("pro.html"))
    .replace(/\{\{root\}\}/g, root);

  const hreflang = alt
    ? `<link rel="alternate" hreflang="${lang}" href="${url}">
<link rel="alternate" hreflang="${alt.lang}" href="${altUrl}">
<link rel="alternate" hreflang="x-default" href="${lang === "es" ? url : altUrl}">`
    : "";

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
${hreflang}
<meta name="robots" content="${page.noindex || (page.proPage && !proOn) ? "noindex" : "index, follow"}">
<meta name="theme-color" content="#4f46e5">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.siteName)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${siteUrl}/assets/img/og.jpg">
<meta property="og:locale" content="${lang === "es" ? "es_ES" : "en_US"}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}assets/img/icon-180.png">
<link rel="stylesheet" href="${root}assets/css/style.css">
${schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join("\n")}
</head>
<body>
<a class="skip" href="#main">${ui.skip}</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${href(L.home)}">${LOGO}<span>${esc(site.siteName)}</span></a>
    <nav aria-label="${lang === "es" ? "Principal" : "Main"}">
      ${["transcribe", "captions", "luz"].filter((k) => L[k] && pagesBySlug.has(L[k] + "index.html")).map((k) => nav(k, ui[k], tool === k)).join("\n      ")}
    </nav>
    ${alt ? `<a href="${href(alt.slug.replace(/index\.html$/, ""))}" hreflang="${alt.lang}" lang="${alt.lang}" title="${ui.otherLangLabel}" class="lang">${ui.otherLang}</a>` : ""}
  </div>
</header>
<div class="wrap"><div class="ad-slot" data-slot="top"></div></div>
<main id="main" class="wrap">
${body.trim()}
${tool && cards(tool) ? `<aside class="related" aria-labelledby="related-title"><h2 id="related-title">${ui.related}</h2><div class="tool-cards">${cards(tool)}</div></aside>` : ""}
</main>
<div class="wrap"><div class="ad-slot" data-slot="bottom"></div></div>
<footer class="site-footer">
  <div class="wrap">
    <nav aria-label="${lang === "es" ? "Legal" : "Legal"}">
      ${nav("faq", ui.faq)}
      ${nav("privacy", ui.privacy)}
      ${nav("legal", ui.legal)}
      ${nav("contact", ui.contact)}
      ${exists("money") ? nav("money", ui.money) : ""}
    </nav>
    <p class="muted small">© ${new Date().getFullYear()} ${esc(site.siteName)} · ${ui.footerNote}</p>
  </div>
</footer>
<script src="${root}assets/js/config.js"></script>
<script src="${root}assets/js/ads.js" defer></script>
${tool ? `<script type="module" src="${root}${TOOLS[tool].script}"></script>` : ""}
${page.script ? `<script type="module" src="${root}${page.script}"></script>` : ""}
</body>
</html>
`;
}

function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
  // Datos de las herramientas (tarifas de luz a mano; data/pvpc.json lo genera scripts/fetch-pvpc.mjs en Actions).
  if (existsSync(join(ROOT, "data"))) cpSync(join(ROOT, "data"), join(OUT, "data"), { recursive: true, filter: (src) => !/\/\./.test(src.slice(ROOT.length)) });
  writeFileSync(join(OUT, ".nojekyll"), "");
  // Versión ligera del PVPC para el widget (de ayer a pasado mañana): ~1 KB en vez de todo el año.
  if (existsSync(join(ROOT, "data", "pvpc.json"))) {
    const pv = JSON.parse(readFileSync(join(ROOT, "data", "pvpc.json"), "utf8"));
    const keep = [-1, 0, 1, 2].map((d) => madridDate(d));
    const days = Object.fromEntries(keep.filter((d) => pv.days?.[d]).map((d) => [d, pv.days[d]]));
    writeFileSync(join(OUT, "data", "pvpc-hoy.json"), JSON.stringify({ updated: pv.updated, source: pv.source, days }));
  }

  const pages = readPages();
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  for (const p of pages) {
    const dest = join(OUT, p.slug);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, layout(p, bySlug));
  }

  const indexable = pages.filter((p) => !p.noindex && !p.bare && !(p.proPage && !proOn));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${indexable.map((p) => {
    const loc = `${siteUrl}/${p.slug.replace(/index\.html$/, "")}`;
    const alt = p.alt != null ? bySlug.get(p.alt) : null;
    const links = alt
      ? `\n    <xhtml:link rel="alternate" hreflang="${p.lang}" href="${loc}"/>\n    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${siteUrl}/${alt.slug.replace(/index\.html$/, "")}"/>`
      : "";
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${site.lastUpdated}</lastmod>${links}\n  </url>`;
  }).join("\n")}
</urlset>
`;
  writeFileSync(join(OUT, "sitemap.xml"), sitemap);
  writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

  const client = (adsCfg.adsenseClient || "").trim();
  if (/^ca-pub-\d+$/.test(client)) {
    writeFileSync(join(OUT, "ads.txt"), `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`);
  }
  console.log(`Generadas ${pages.length} páginas en _site/ (URL base: ${siteUrl})${existsSync(join(OUT, "ads.txt")) ? " + ads.txt" : ""}`);
}

build();
