// Genera la web estática en _site/ a partir de src/ y assets/.
// Sin dependencias: `node build.mjs`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { STRINGS, AUDIO_LANGUAGES } from "./assets/js/i18n.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "_site");
const site = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
const siteUrl = (process.env.SITE_URL || site.siteUrl).replace(/\/+$/, "");

// Lee config.js (el mismo archivo que usa el navegador) para generar ads.txt.
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, "assets/js/config.js"), "utf8"), sandbox);
const adsCfg = sandbox.window.SITE_CONFIG || {};

const UI = {
  es: {
    home: "Transcribir", faq: "Preguntas frecuentes", privacy: "Privacidad", legal: "Aviso legal",
    contact: "Contacto", skip: "Saltar al contenido", tagline: "Transcripción de audio y vídeo gratis y privada",
    footerNote: "Herramienta gratuita financiada con publicidad. El audio se procesa en tu dispositivo.",
    otherLang: "English", otherLangLabel: "Read in English",
  },
  en: {
    home: "Transcribe", faq: "FAQ", privacy: "Privacy", legal: "Legal notice",
    contact: "Contact", skip: "Skip to content", tagline: "Free and private audio and video transcription",
    footerNote: "Free tool supported by ads. Audio is processed on your device.",
    otherLang: "Español", otherLangLabel: "Leer en español",
  },
};

const LINKS = {
  es: { home: "", faq: "preguntas-frecuentes.html", privacy: "privacidad.html", legal: "aviso-legal.html", contact: "contacto.html" },
  en: { home: "en/", faq: "en/faq.html", privacy: "en/privacy.html", legal: "en/legal.html", contact: "en/contact.html" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function readPages() {
  const pages = [];
  for (const lang of ["es", "en"]) {
    const dir = join(ROOT, "src/pages", lang);
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".html")).sort()) {
      const raw = readFileSync(join(dir, f), "utf8");
      const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
      if (!m) throw new Error(`Falta la cabecera JSON en ${lang}/${f}`);
      const meta = JSON.parse(m[1]);
      pages.push({ lang, file: f, ...meta, body: raw.slice(m[0].length) });
    }
  }
  return pages;
}

function toolHtml(lang) {
  const t = STRINGS[lang];
  const langIdx = lang === "es" ? 1 : 2;
  const langs = [...AUDIO_LANGUAGES].sort((a, b) => (a[0] === lang ? -1 : b[0] === lang ? 1 : 0));
  const options = [`<option value="auto">${esc(t.autoDetect)}</option>`]
    .concat(langs.map(([code, ...names]) => `<option value="${code}"${code === lang ? " selected" : ""}>${esc(names[langIdx - 1])}</option>`))
    .join("\n        ");
  return readFileSync(join(ROOT, "src/partials/tool.html"), "utf8")
    .replace("{{languageOptions}}", options)
    .replace(/\{\{t\.(\w+)\}\}/g, (_, k) => {
      if (!(k in t)) throw new Error(`Texto sin traducir: ${k}`);
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
    name: site.siteName,
    url,
    description: page.description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript and WebAssembly",
    inLanguage: page.lang,
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };
}

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true" class="logo"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M8 13v6M12 10v12M16 7v18M20 11v10M24 14v4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;

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

  const schemas = [];
  if (page.tool) schemas.push(appSchema(page, url));
  if (page.faqSchema) { const s = faqSchema(page.body); if (s) schemas.push(s); }
  if (page.slug.endsWith("index.html") || page.slug === "index.html") {
    schemas.push({ "@context": "https://schema.org", "@type": "WebSite", name: site.siteName, url: `${siteUrl}/`, inLanguage: lang });
  }

  let body = page.body
    .replace("{{tool}}", page.tool ? toolHtml(lang) : "")
    .replace(/\{\{ad:(\w+)\}\}/g, (_, s) => `<div class="ad-slot" data-slot="${s}"></div>`)
    .replace(/\{\{cfg\.(\w+)\}\}/g, (_, k) => esc(site[k] ?? ""))
    .replace(/\{\{root\}\}/g, root);

  const nav = (key, label) => `<a href="${href(L[key])}"${L[key] === page.slug.replace(/index\.html$/, "") || L[key] === page.slug ? ' aria-current="page"' : ""}>${label}</a>`;

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
<meta name="robots" content="${page.noindex ? "noindex" : "index, follow"}">
<meta name="theme-color" content="#4f46e5">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.siteName)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${siteUrl}/assets/img/og.png">
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
      ${nav("home", ui.home)}
      ${nav("faq", ui.faq)}
      ${alt ? `<a href="${href(alt.slug.replace(/index\.html$/, ""))}" hreflang="${alt.lang}" lang="${alt.lang}" title="${ui.otherLangLabel}" class="lang">${ui.otherLang}</a>` : ""}
    </nav>
  </div>
</header>
<div class="wrap"><div class="ad-slot" data-slot="top"></div></div>
<main id="main" class="wrap">
${body.trim()}
</main>
<div class="wrap"><div class="ad-slot" data-slot="bottom"></div></div>
<footer class="site-footer">
  <div class="wrap">
    <nav aria-label="${lang === "es" ? "Legal" : "Legal"}">
      ${nav("faq", ui.faq)}
      ${nav("privacy", ui.privacy)}
      ${nav("legal", ui.legal)}
      ${nav("contact", ui.contact)}
    </nav>
    <p class="muted small">© ${new Date().getFullYear()} ${esc(site.siteName)} · ${ui.footerNote}</p>
  </div>
</footer>
<script src="${root}assets/js/config.js"></script>
<script src="${root}assets/js/ads.js" defer></script>
${page.tool ? `<script type="module" src="${root}assets/js/app.js"></script>` : ""}
</body>
</html>
`;
}

function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, "assets"), join(OUT, "assets"), { recursive: true });
  writeFileSync(join(OUT, ".nojekyll"), "");

  const pages = readPages();
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  for (const p of pages) {
    const dest = join(OUT, p.slug);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, layout(p, bySlug));
  }

  const indexable = pages.filter((p) => !p.noindex);
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
